# Leitura em voz alta

O autor escolhe o que tem áudio: opção **"Gerar áudio (leitura em voz alta)"** na edição da entry
do CMS e no formulário da obra do `novels` (desligada por padrão). O áudio de cada texto escolhido
é gerado **uma vez**, depois de publicado, e guardado como MP3 na biblioteca de mídia. Quem lê o site só baixa esse MP3 — abrir a
página, dar play ou recarregar não gera nada de novo. Contexto: `src/contexts/speech`.

## Provedores (`SPEECH_DRIVER`)

| Driver | Custo | Como gera | Quando o áudio fica pronto |
| --- | --- | --- | --- |
| **`worker`** (recomendado) | Zero, sem conta em provedor | GitHub Actions (`.github/workflows/speech-worker.yml`) com modelos abertos — Kokoro (Apache-2.0) e Piper — escolhidos por idioma em `scripts/speech-worker/voices.json` | Até ~15 min depois de publicar (o worker roda a cada 15 min) |
| `google` | Cota grátis mensal, mas conta nova no Brasil exige pré-pagamento de R$ 200 | Google Cloud TTS, vozes Chirp 3 HD — ver [google-cloud-tts.md](google-cloud-tts.md) | Na hora, na Vercel |

Sem `SPEECH_DRIVER` (e sem `GOOGLE_TTS_API_KEY`) a leitura fica desligada e nenhum botão de ouvir
aparece.

## Configurar o worker (grátis)

1. **Cron já configurado** — o worker usa o mesmo secret `CRON_TARGETS` do `cron.yml`
   (`{"nome": {"url": "https://...", "secret": "<CRON_SECRET>"}}`) e a env `CRON_SECRET` de cada
   projeto na Vercel. Sem `CRON_SECRET` o modo worker fica desligado.
2. Na Vercel → projeto → **Environment Variables**: `SPEECH_DRIVER=worker`. Redeploy.
3. Em `/admin/settings` → **Leitura em voz alta**: ligar (chave geral do site), escolher a voz
   (feminina/masculina) e o teto mensal de caracteres (no worker não há cobrança; o teto só limita
   o volume de trabalho).
4. Em cada entry/obra que deve ter áudio: marcar **"Gerar áudio"** e salvar.

Repositório público = minutos de Actions sem custo. A cada 15 min o worker consulta a fila de cada
instância (`GET /api/speech/worker/claim`) e só instala os modelos se houver trabalho.

### Vozes

| Idioma | Feminina | Masculina |
| --- | --- | --- |
| pt-BR | Kokoro `pf_dora` | Piper `pt_BR-faber-medium` |
| en | Kokoro `af_heart` | Kokoro `am_michael` |
| es | Kokoro `ef_dora` | Kokoro `em_alex` |
| fr | Kokoro `ff_siwis` | Piper `fr_FR-tom-medium` |
| it | Kokoro `if_sara` | Kokoro `im_nicola` |
| de | Piper `de_DE-kerstin-low` | Piper `de_DE-thorsten-medium` |
| ja | Kokoro `jf_alpha` | Kokoro `jm_kumo` |

Para ouvir antes de escolher: **Actions → Leitura em voz alta (worker) → Run workflow** com
"Só gerar amostras" marcado (ou qualquer push que mexa em `scripts/speech-worker/`) — o run deixa o
artifact **amostras-de-voz** com um MP3 de cada voz. Trocar uma voz em `voices.json` vale para o
que for publicado ou alterado depois.

### API do worker (Bearer `CRON_SECRET`)

| Rota | O que faz |
| --- | --- |
| `GET /api/speech/worker/claim` | `{ mode, enabled, pending }` |
| `POST /api/speech/worker/claim` `{ limit }` | Reserva textos e a cota do mês deles: `{ jobs: [{ id, textHash, locale, languageCode, voice, text }], limitReached }` |
| `PUT /api/speech/worker/clips/<id>` | Corpo `audio/mpeg`, header `X-Speech-Text-Hash`. `{ stored: false }` quando o texto mudou no meio (o MP3 é descartado) |
| `POST /api/speech/worker/clips/<id>/failure` `{ textHash, error }` | Devolve a cota e conta a tentativa |

Reserva vencida (worker que morreu no meio) volta para a fila depois de 10 min.

## Quando o áudio é gerado (e quando é apagado)

| Conteúdo | Gera | Apaga |
| --- | --- | --- |
| Entry do CMS com **"Gerar áudio"** marcado (`data.speech`), **publicada e aberta** | Job `speech.sync-cms-entries` (cron): toda entry assim que mudou desde a última passada (marcar a opção conta como mudança). A tela de edição mostra a situação (fila, pronto). | Opção desmarcada, entry arquivada, apagada ou que virou "só logado" (o MP3 é público). Rascunho mantém. |
| Obra do plugin `novels` com **"Gerar áudio"** marcado (`works.speech_enabled`) | Ao publicar, ao marcar a opção, e ao salvar grafo / editar obra / apagar capítulo de obra publicada: uma faixa por cena e idioma que tem texto próprio. A tela da obra mostra "X de Y faixas prontas". | Opção desmarcada, obra apagada, ou cena/idioma que saiu da obra publicada. Despublicar mantém. |

- Texto igual ao já gerado não gasta nada: o áudio é identificado por hash de texto + voz + modelo.
  Por isso despublicar e republicar sem mudar o texto é de graça, e **trocar a voz vale para o que
  for publicado ou alterado depois** (o resto continua com a voz antiga).
- Falha na síntese (rede, modelo, chave errada) tenta de novo nos ciclos seguintes, até 3 vezes;
  republicar tenta de novo uma faixa que falhou.
- Texto acima de 15 000 caracteres (~2 500 palavras) não ganha áudio: no modo worker o MP3 volta no
  corpo de uma requisição, e a Vercel corta acima de 4,5 MB.
- Os MP3 ficam na categoria **"Leitura em voz alta"** da biblioteca de mídia; apagar um deles por
  lá mostra o aviso de arquivo em uso.
- Ouvir baixa o MP3 do storage (`preload="none"`: só ao dar play). Isso conta na transferência
  do Vercel Blob/S3, nunca no provedor de voz.

## Para plugins

`@venore/plugin-sdk/speech`: `syncSpeechAudio({ scope, items })` descreve o estado desejado de um
scope do plugin (convenção: começar pela key, ex: `novels.work:<id>`) — o core enfileira o que é
novo ou mudou e apaga o que saiu; `getSpeechAudio({ scopes })` devolve as URLs prontas.
