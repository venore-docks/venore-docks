"""Worker de leitura em voz alta do Venore Docks (SPEECH_DRIVER=worker).

Roda no GitHub Actions (.github/workflows/speech-worker.yml). Para cada instância de CRON_TARGETS
({"nome": {"url": ..., "secret": <CRON_SECRET>}}), pega a fila em /api/speech/worker, gera o áudio
com modelos abertos (Kokoro e Piper, escolhidos por idioma e voz em voices.json), converte para
MP3 e devolve. Sem fila em nenhuma instância, termina antes de carregar os modelos.

Uso:
  python worker.py                 # processa a fila de todas as instâncias
  python worker.py --check         # só diz se há fila (exit 0; imprime has_work=true|false)
  python worker.py --samples DIR   # gera amostras de todas as vozes em DIR (sem instância)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
VOICES = {key: value for key, value in json.loads((HERE / "voices.json").read_text()).items() if not key.startswith("_")}
MP3_KBPS = 48  # fala em mono: 48 kbps cabe ~12 min no limite de 4,4 MB; acima disso cai para 32/24
MAX_MP3_BYTES = 4_400_000
CLAIM_BATCH = 1  # um por vez: o painel mostra como "gerando agora" só o que está sendo gerado
PROGRESS_EVERY_SECONDS = 4
CHUNK_CHARS = 280  # trecho gerado de uma vez; folga para o limite de 510 fonemas da Kokoro
SENTENCE_PAUSE = 0.22  # segundos entre frases
PARAGRAPH_PAUSE = 0.6  # segundos entre parágrafos
KOKORO_REPO = "hexgrad/Kokoro-82M"
KOKORO_LANG = {"pt": "p", "en-US": "a", "en-GB": "b", "en": "a", "es": "e", "fr": "f", "it": "i", "ja": "j"}
PIPER_DIR = Path(os.environ.get("PIPER_VOICES_DIR", Path.home() / ".cache" / "piper-voices"))

SAMPLE_TEXT = {
    "pt-BR": (
        "A tempestade chegou antes do previsto. Do cais, você vê o farol apagado no alto do rochedo, "
        "e o barco do velho Tomé balança perto demais das pedras.\n"
        "— Alguém precisa subir até lá — diz Marina, sem tirar os olhos da água. — Agora.\n"
        "Você sente o vento frio no rosto… e percebe que ninguém mais vai se oferecer."
    ),
    "en-US": "The storm arrived earlier than expected. From the pier, you see the dark lighthouse on the cliff.",
    "es-ES": "La tormenta llegó antes de lo previsto. Desde el muelle, ves el faro apagado en lo alto del acantilado.",
    "fr-FR": "La tempête est arrivée plus tôt que prévu. Depuis le quai, tu vois le phare éteint en haut du rocher.",
    "it-IT": "La tempesta è arrivata prima del previsto. Dal molo vedi il faro spento in cima alla scogliera.",
    "de-DE": "Der Sturm kam früher als erwartet. Vom Kai aus siehst du den dunklen Leuchtturm auf dem Felsen.",
    "ja-JP": "嵐は予想より早くやって来た。桟橋から、崖の上の消えた灯台が見える。",
}


def log(message: str) -> None:
    print(message, flush=True)


# ---------------------------------------------------------------- motores (carregados sob demanda)

class Engines:
    def __init__(self) -> None:
        self._kokoro_model = None
        self._kokoro_pipelines: dict[str, object] = {}
        self._piper_voices: dict[str, object] = {}

    def voice_for(self, language_code: str, voice: str) -> dict:
        table = VOICES.get(language_code) or next(
            (value for key, value in VOICES.items() if key.split("-")[0] == language_code.split("-")[0]), None
        )
        if not table:
            raise ValueError(f"Sem voz configurada para {language_code} (voices.json).")
        return table.get(voice) or table["female"]

    def synthesize(self, text: str, language_code: str, voice: str, on_progress=None) -> tuple[bytes, int]:
        """Devolve (PCM 16 bits mono, taxa de amostragem).

        Texto preparado (travessão de diálogo, símbolos), dividido em parágrafos e cada parágrafo em
        trechos que terminam em fim de frase. Cada trecho é gerado inteiro (a entonação não quebra
        no meio da frase), o silêncio das bordas é aparado e as pausas são as nossas: curta entre
        frases, maior entre parágrafos. on_progress(fração 0..1) depois de cada trecho."""
        import numpy as np

        choice = self.voice_for(language_code, voice)
        speed = float(choice.get("speed", 1.0))
        plan = [(index, chunk) for index, paragraph in enumerate(split_paragraphs(prepare_text(text))) for chunk in split_chunks(paragraph)]
        total = sum(len(chunk) for _, chunk in plan) or 1
        pieces: list = []
        sample_rate = 0
        last_paragraph = None
        done = 0
        for paragraph, chunk in plan:
            if choice["engine"] == "kokoro":
                sentences, sample_rate = self._kokoro(chunk, language_code, choice["voice"], speed)
            elif choice["engine"] == "piper":
                sentences, sample_rate = self._piper(chunk, choice["voice"], speed)
            else:
                raise ValueError(f"Motor desconhecido: {choice['engine']}")
            for audio in sentences:
                audio = trim_silence(audio)
                if audio.size == 0:
                    continue
                if pieces:
                    pause = PARAGRAPH_PAUSE if paragraph != last_paragraph else SENTENCE_PAUSE
                    pieces.append(np.zeros(int(sample_rate * pause), dtype=np.float32))
                pieces.append(audio)
                last_paragraph = paragraph
            done += len(chunk)
            if on_progress:
                on_progress(done / total)
        if not pieces:
            raise ValueError("Nenhum áudio gerado.")
        audio = np.concatenate(pieces)
        peak = float(np.max(np.abs(audio))) or 1.0
        audio = np.clip(audio * (0.95 / peak), -1.0, 1.0)  # mesmo volume em toda faixa
        return (audio * 32767).astype("<i2").tobytes(), sample_rate

    def _kokoro(self, text: str, language_code: str, voice: str, speed: float) -> tuple[list, int]:
        import numpy as np
        from kokoro import KModel, KPipeline

        lang = KOKORO_LANG.get(language_code) or KOKORO_LANG.get(language_code.split("-")[0])
        if not lang:
            raise ValueError(f"Kokoro não fala {language_code}.")
        if lang == "j":
            ensure_japanese()
        if self._kokoro_model is None:
            self._kokoro_model = KModel(repo_id=KOKORO_REPO).to("cpu").eval()
        pipeline = self._kokoro_pipelines.get(lang)
        if pipeline is None:
            pipeline = KPipeline(lang_code=lang, repo_id=KOKORO_REPO, model=self._kokoro_model)
            self._kokoro_pipelines[lang] = pipeline

        # split_pattern=None: o trecho já vem do tamanho certo (split_chunks), a Kokoro não corta de novo.
        parts = [
            result.audio.detach().cpu().numpy().astype(np.float32)
            for result in pipeline(text, voice=voice, speed=speed, split_pattern=None)
            if result.audio is not None
        ]
        return ([np.concatenate(parts)] if parts else []), 24_000

    def _piper(self, text: str, voice: str, speed: float) -> tuple[list, int]:
        import numpy as np
        from piper import PiperVoice, SynthesisConfig
        from piper.download_voices import download_voice

        loaded = self._piper_voices.get(voice)
        if loaded is None:
            PIPER_DIR.mkdir(parents=True, exist_ok=True)
            model_path = PIPER_DIR / f"{voice}.onnx"
            if not model_path.exists():
                download_voice(voice, PIPER_DIR)
            loaded = PiperVoice.load(model_path)
            self._piper_voices[voice] = loaded

        sentences = []
        sample_rate = 22_050
        # O Piper devolve uma frase por pedaço; as pausas entre elas são as do synthesize.
        for chunk in loaded.synthesize(text, syn_config=SynthesisConfig(length_scale=1.0 / speed)):
            sample_rate = chunk.sample_rate
            sentences.append(np.frombuffer(chunk.audio_int16_bytes, dtype="<i2").astype(np.float32) / 32768.0)
        return sentences, sample_rate


# ---------------------------------------------------------------- preparo do texto

SENTENCE_END = r"(?<=[.!?…。！？])[\"”’»)]*\s+"


def prepare_text(text: str) -> str:
    """Tira do texto o que o modelo lê errado: travessão de diálogo, ênfase de markdown, aspas
    (não se leem). Reticências viram "..." (a pausa que o modelo conhece)."""
    import re

    lines = []
    for line in text.replace("\r", "").split("\n"):
        line = line.strip()
        line = re.sub(r"^[—–-]\s*", "", line)  # "— Olá" (fala) -> "Olá"
        line = re.sub(r"([.!?…])\s*[—–]\s*", r"\1 ", line)  # "água. — Agora." -> "água. Agora."
        line = re.sub(r"\s+[—–]\s+", ", ", line)  # "— disse ele —" no meio -> vírgulas
        line = re.sub(r"[—–]", ", ", line)
        line = line.replace("…", "...")
        line = re.sub(r"[*_#~`|<>\[\]{}\"“”«»]", "", line)  # aspas não se leem; a frase basta
        line = re.sub(r"\s{2,}", " ", line).strip(" ,")
        lines.append(line)
    return "\n".join(lines)


def split_paragraphs(text: str) -> list[str]:
    import re

    return [part.strip() for part in re.split(r"\n+", text) if part.strip()]


def split_chunks(paragraph: str) -> list[str]:
    """Frases agrupadas até CHUNK_CHARS (sempre terminando em fim de frase). Frase maior que isso
    é dividida em vírgula/ponto e vírgula; só em último caso, em espaço. Mantém cada trecho longe
    do limite de 510 fonemas da Kokoro, que corta o que passa dele."""
    import re

    pieces: list[str] = []
    for sentence in (part.strip() for part in re.split(SENTENCE_END, paragraph)):
        if not sentence:
            continue
        if len(sentence) <= CHUNK_CHARS:
            pieces.append(sentence)
            continue
        current = ""
        for clause in re.split(r"(?<=[,;:])\s+", sentence):
            while len(clause) > CHUNK_CHARS:
                cut = clause.rfind(" ", 0, CHUNK_CHARS)
                cut = cut if cut > 0 else CHUNK_CHARS
                if current:
                    pieces.append(current)
                    current = ""
                pieces.append(clause[:cut].strip())
                clause = clause[cut:].strip()
            if current and len(current) + len(clause) + 1 > CHUNK_CHARS:
                pieces.append(current)
                current = clause
            else:
                current = f"{current} {clause}".strip()
        if current:
            pieces.append(current)

    chunks: list[str] = []
    for piece in pieces:
        if chunks and len(chunks[-1]) + len(piece) + 1 <= CHUNK_CHARS:
            chunks[-1] = f"{chunks[-1]} {piece}"
        else:
            chunks.append(piece)
    return chunks


def trim_silence(audio, threshold: float = 0.01, keep_seconds: float = 0.04, sample_rate: int = 24_000):
    """Apara o silêncio das bordas (cada motor deixa uma sobra diferente), mantendo um respiro."""
    import numpy as np

    loud = np.flatnonzero(np.abs(audio) > threshold)
    if loud.size == 0:
        return audio[:0]
    keep = int(sample_rate * keep_seconds)
    return audio[max(0, loud[0] - keep) : loud[-1] + keep]


def ensure_japanese() -> None:
    """misaki[ja] é pesado (dicionário unidic); só instala se aparecer texto em japonês."""
    try:
        import pyopenjtalk  # noqa: F401
        import unidic  # noqa: F401
        return
    except ImportError:
        pass
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "misaki[ja]==0.9.4"])
    subprocess.check_call([sys.executable, "-m", "unidic", "download"])


def to_mp3(pcm: bytes, sample_rate: int, kbps: int = MP3_KBPS) -> bytes:
    import lameenc

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(kbps)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(1)
    encoder.set_quality(2)
    return bytes(encoder.encode(pcm) + encoder.flush())


# ---------------------------------------------------------------- API das instâncias

def load_targets() -> dict[str, dict]:
    raw = os.environ.get("CRON_TARGETS", "").strip()
    if not raw:
        return {}
    try:
        targets = json.loads(raw)
    except json.JSONDecodeError as error:
        # Valor colado pela metade ou com quebra de linha no secret: falha visível, não silenciosa.
        log(f"::error::CRON_TARGETS não é um JSON válido ({error.msg}, linha {error.lineno}, coluna {error.colno}).")
        sys.exit(1)
    for target in targets.values():
        print(f"::add-mask::{target['secret']}", flush=True)
    return targets


def api(target: dict, method: str, path: str, **kwargs) -> requests.Response:
    headers = {"Authorization": f"Bearer {target['secret']}", **kwargs.pop("headers", {})}
    return requests.request(method, f"{target['url'].rstrip('/')}{path}", headers=headers, timeout=60, **kwargs)


def signal(target: dict, path: str, payload: dict) -> dict | None:
    """Aviso ao painel (fase do worker, andamento). Instância sem essas rotas (versão antiga) ou
    fora do ar não interrompe a geração."""
    try:
        response = api(target, "POST", path, json=payload)
        return response.json() if response.status_code == 200 else None
    except (requests.RequestException, ValueError):
        return None


def heartbeat(target: dict, stage: str, detail: str | None = None) -> None:
    signal(target, "/api/speech/worker/heartbeat", {"stage": stage, "detail": detail})


def pending_work(targets: dict[str, dict]) -> dict[str, int]:
    found = {}
    for name, target in targets.items():
        try:
            response = api(target, "GET", "/api/speech/worker/claim")
        except requests.RequestException as error:
            log(f"{name}: sem resposta ({error})")
            continue
        if response.status_code != 200:
            # 404: instância ainda sem o recurso; 503: sem CRON_SECRET.
            log(f"{name}: HTTP {response.status_code}")
            continue
        status = response.json()
        log(f"{name}: modo={status.get('mode')} ligado={status.get('enabled')} fila={status.get('pending')}")
        if status.get("mode") == "worker" and status.get("pending", 0) > 0:
            found[name] = status["pending"]
    return found


def process(targets: dict[str, dict], names: list[str], deadline: float) -> int:
    engines = Engines()
    failures = 0
    for name in names:
        target = targets[name]
        heartbeat(target, "generating")
        done = 0
        while time.time() < deadline:
            response = api(target, "POST", "/api/speech/worker/claim", json={"limit": CLAIM_BATCH})
            response.raise_for_status()
            claim = response.json()
            jobs = claim.get("jobs", [])
            if not jobs:
                if claim.get("limitReached"):
                    log(f"{name}: teto do mês atingido")
                break
            for job in jobs:
                started = time.time()
                last_report = 0.0

                def on_progress(fraction: float, job=job) -> None:
                    nonlocal last_report
                    if time.time() - last_report < PROGRESS_EVERY_SECONDS or fraction >= 1:
                        return
                    last_report = time.time()
                    signal(target, f"/api/speech/worker/clips/{job['id']}/progress", {"textHash": job["textHash"], "percent": round(fraction * 100)})

                try:
                    signal(target, f"/api/speech/worker/clips/{job['id']}/progress", {"textHash": job["textHash"], "percent": 0})
                    pcm, sample_rate = engines.synthesize(job["text"], job["languageCode"], job["voice"], on_progress)
                    mp3 = to_mp3(pcm, sample_rate)
                    for kbps in (32, 24):  # texto muito longo: menos bitrate para caber na entrega
                        if len(mp3) <= MAX_MP3_BYTES:
                            break
                        mp3 = to_mp3(pcm, sample_rate, kbps=kbps)
                    upload = api(
                        target,
                        "PUT",
                        f"/api/speech/worker/clips/{job['id']}",
                        data=mp3,
                        headers={"Content-Type": "audio/mpeg", "X-Speech-Text-Hash": job["textHash"]},
                    )
                    upload.raise_for_status()
                    stored = upload.json().get("stored")
                    done += 1
                    heartbeat(target, "generating", f"{done} pronto(s) nesta execução")
                    log(
                        f"{name}: {job['languageCode']}/{job['voice']} {len(job['text'])} caracteres -> "
                        f"{len(mp3) // 1024} KB em {time.time() - started:.1f}s{'' if stored else ' (descartado: texto mudou)'}"
                    )
                except Exception as error:  # noqa: BLE001 — qualquer falha vira tentativa contada
                    failures += 1
                    log(f"::warning::{name}: falhou {job['id']} ({job['languageCode']}): {error}")
                    try:
                        api(
                            target,
                            "POST",
                            f"/api/speech/worker/clips/{job['id']}/failure",
                            json={"textHash": job["textHash"], "error": str(error)[:500]},
                        )
                    except requests.RequestException:
                        pass
        heartbeat(target, "finished", f"{done} áudio(s) gerado(s)")
    return failures


def samples(out_dir: Path) -> int:
    engines = Engines()
    out_dir.mkdir(parents=True, exist_ok=True)
    failures = 0
    for language_code, table in VOICES.items():
        for voice, choice in table.items():
            name = f"{language_code}-{voice}-{choice['engine']}-{choice['voice']}.mp3"
            started = time.time()
            try:
                pcm, sample_rate = engines.synthesize(SAMPLE_TEXT[language_code], language_code, voice)
                (out_dir / name).write_bytes(to_mp3(pcm, sample_rate))
                log(f"amostra {name}: {time.time() - started:.1f}s")
            except Exception as error:  # noqa: BLE001
                failures += 1
                log(f"::error::amostra {name}: {error}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--samples", type=Path)
    parser.add_argument("--budget-minutes", type=float, default=float(os.environ.get("SPEECH_WORKER_BUDGET_MINUTES", "40")))
    args = parser.parse_args()

    if args.samples:
        return 1 if samples(args.samples) else 0

    targets = load_targets()
    if not targets:
        log("::warning::CRON_TARGETS não configurado — nada a fazer.")
        if args.check:
            print("has_work=false")
        return 0

    work = pending_work(targets)
    if args.check:
        # Achou fila: o painel mostra "preparando as vozes" enquanto o workflow instala os modelos.
        for name in work:
            heartbeat(targets[name], "preparing", f"{work[name]} na fila")
        print(f"has_work={'true' if work else 'false'}")
        return 0
    if not work:
        log("Nenhuma fila de leitura em voz alta.")
        return 0

    failures = process(targets, list(work), time.time() + args.budget_minutes * 60)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
