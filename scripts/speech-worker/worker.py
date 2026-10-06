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
MP3_KBPS = 32  # fala em mono: 32 kbps cabe ~18 min no limite de 4,4 MB da entrega
MAX_MP3_BYTES = 4_400_000
CLAIM_BATCH = 5
KOKORO_REPO = "hexgrad/Kokoro-82M"
KOKORO_LANG = {"pt": "p", "en-US": "a", "en-GB": "b", "en": "a", "es": "e", "fr": "f", "it": "i", "ja": "j"}
PIPER_DIR = Path(os.environ.get("PIPER_VOICES_DIR", Path.home() / ".cache" / "piper-voices"))

SAMPLE_TEXT = {
    "pt-BR": "A tempestade chegou antes do previsto. Do cais, você vê o farol apagado no alto do rochedo.",
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

    def synthesize(self, text: str, language_code: str, voice: str) -> tuple[bytes, int]:
        """Devolve (PCM 16 bits mono, taxa de amostragem)."""
        choice = self.voice_for(language_code, voice)
        if choice["engine"] == "kokoro":
            return self._kokoro(text, language_code, choice["voice"])
        if choice["engine"] == "piper":
            return self._piper(text, choice["voice"])
        raise ValueError(f"Motor desconhecido: {choice['engine']}")

    def _kokoro(self, text: str, language_code: str, voice: str) -> tuple[bytes, int]:
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

        pause = np.zeros(int(24_000 * 0.3), dtype=np.float32)
        parts = []
        for result in pipeline(text, voice=voice, split_pattern=r"\n+"):
            if result.audio is not None:
                parts.extend([result.audio.detach().cpu().numpy().astype(np.float32), pause])
        if not parts:
            raise ValueError("Kokoro não gerou áudio.")
        audio = np.clip(np.concatenate(parts), -1.0, 1.0)
        return (audio * 32767).astype("<i2").tobytes(), 24_000

    def _piper(self, text: str, voice: str) -> tuple[bytes, int]:
        from piper import PiperVoice
        from piper.download_voices import download_voice

        loaded = self._piper_voices.get(voice)
        if loaded is None:
            PIPER_DIR.mkdir(parents=True, exist_ok=True)
            model_path = PIPER_DIR / f"{voice}.onnx"
            if not model_path.exists():
                download_voice(voice, PIPER_DIR)
            loaded = PiperVoice.load(model_path)
            self._piper_voices[voice] = loaded

        pcm = bytearray()
        sample_rate = 22_050
        for chunk in loaded.synthesize(text):
            sample_rate = chunk.sample_rate
            pcm += chunk.audio_int16_bytes
        if not pcm:
            raise ValueError("Piper não gerou áudio.")
        return bytes(pcm), sample_rate


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
    targets = json.loads(raw)
    for target in targets.values():
        print(f"::add-mask::{target['secret']}", flush=True)
    return targets


def api(target: dict, method: str, path: str, **kwargs) -> requests.Response:
    headers = {"Authorization": f"Bearer {target['secret']}", **kwargs.pop("headers", {})}
    return requests.request(method, f"{target['url'].rstrip('/')}{path}", headers=headers, timeout=60, **kwargs)


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
                try:
                    pcm, sample_rate = engines.synthesize(job["text"], job["languageCode"], job["voice"])
                    mp3 = to_mp3(pcm, sample_rate)
                    if len(mp3) > MAX_MP3_BYTES:
                        mp3 = to_mp3(pcm, sample_rate, kbps=24)
                    upload = api(
                        target,
                        "PUT",
                        f"/api/speech/worker/clips/{job['id']}",
                        data=mp3,
                        headers={"Content-Type": "audio/mpeg", "X-Speech-Text-Hash": job["textHash"]},
                    )
                    upload.raise_for_status()
                    stored = upload.json().get("stored")
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
        print(f"has_work={'true' if work else 'false'}")
        return 0
    if not work:
        log("Nenhuma fila de leitura em voz alta.")
        return 0

    failures = process(targets, list(work), time.time() + args.budget_minutes * 60)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
