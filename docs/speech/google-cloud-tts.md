# Leitura em voz alta (Google Cloud Text-to-Speech)

O áudio de um texto é gerado **uma vez**, depois da publicação, pela API do Google Cloud
Text-to-Speech (vozes **Chirp 3 HD**), e gravado como MP3 no storage de mídia da instância. Quem lê
o site só baixa esse MP3 — abrir a página, dar play ou recarregar não chama o Google e não gasta
cota. Só gasta cota quando um texto publicado é novo ou mudou.

## Custo

Cota grátis do Google Cloud, renovada todo mês por conta de faturamento
(<https://cloud.google.com/text-to-speech/pricing>):

| Voz | Grátis por mês | Acima da cota |
| --- | --- | --- |
| Chirp 3 HD (a usada aqui) | 1 milhão de caracteres | US$ 30 por milhão |

O Venore tem um **teto mensal próprio** (`speech.monthly_character_limit`, padrão 900 000
caracteres, 90% da cota grátis): ao chegar nele, a geração para e só volta no mês seguinte — o
texto continua publicado, só fica sem áudio até lá. O teto é a proteção que vale de verdade: o
orçamento do Google (passo 6) só **avisa**, não bloqueia cobrança.

Referência de volume: uma cena de graphic novel tem de 100 a 600 caracteres; um artigo, uns 5 000.

## Configuração no Google Cloud (uma vez por conta)

1. **Projeto.** Em <https://console.cloud.google.com/projectcreate>, crie um projeto (ex:
   `venore-tts`). Um projeto pode servir todas as instâncias — a cota grátis é por conta de
   faturamento, então elas dividem o mesmo 1 milhão de caracteres por mês (ajuste o teto de cada
   instância para a soma caber).
2. **Faturamento.** Em **Faturamento**, vincule uma conta de faturamento ao projeto (pede cartão).
   Sem isso a API recusa as chamadas, mesmo dentro da cota grátis.
3. **Ativar a API.** Em <https://console.cloud.google.com/apis/library/texttospeech.googleapis.com>,
   clique em **Ativar**.
4. **Chave de API.** Em **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
   Depois, na chave criada:
   - **Restrições de API → Restringir chave → só "Cloud Text-to-Speech API"**. Assim a chave, se
     vazar, não serve para nenhuma outra API paga.
   - **Restrições de aplicativo: nenhuma** (as chamadas saem dos servidores da Vercel, sem IP fixo).
5. **Cota por minuto (opcional).** Em **IAM e administrador → Cotas**, filtre por
   "Text-to-Speech" e reduza as requisições por minuto — limita o estrago de uma chave vazada.
6. **Alerta de orçamento.** Em **Faturamento → Orçamentos e alertas → Criar orçamento**: valor de
   US$ 1, alertas em 50%, 90% e 100%. Chega por email; não bloqueia cobrança.

## Configuração no Venore

| Onde | O quê |
| --- | --- |
| Vercel → projeto → **Environment Variables** | `GOOGLE_TTS_API_KEY` = a chave do passo 4 (Production; Preview só se quiser áudio nos previews). Redeploy depois. |
| `/admin/settings` → **Leitura em voz alta** | Ligar a geração, escolher a voz e o teto mensal de caracteres. |

Sem `GOOGLE_TTS_API_KEY`, ou com a leitura desligada, nada é gerado e nenhum botão de ouvir
aparece. `GOOGLE_TTS_ENDPOINT` (opcional) só troca o endereço da API — servidor falso em teste
local ou proxy.

## Quando o áudio é gerado (e quando é apagado)

| Conteúdo | Gera | Apaga |
| --- | --- | --- |
| Entry do CMS **publicada e pública** | Job `speech.sync-cms-entries` (cron): toda entry publicada que mudou desde a última passada. Ligar a leitura pela primeira vez enfileira as entries que já estavam publicadas. | Entry arquivada, apagada ou que virou "só logado" (o MP3 é público). Rascunho mantém. |
| Graphic novel (plugin `novels`) | Ao publicar, e ao salvar grafo / editar obra / apagar capítulo de obra publicada: uma faixa por cena e idioma que tem texto próprio. | Obra apagada, ou cena/idioma que saiu da obra publicada. Despublicar mantém. |

- A síntese roda no job `speech.process-pending` (cron, lotes de 4 em paralelo por até ~35 s) e,
  na Vercel, também logo depois da publicação (`waitUntil`, até 12 faixas). Sem o cron configurado
  (`CRON_SECRET` + `.github/workflows/cron.yml`), só essa geração imediata acontece.
- Texto igual ao já gerado não gasta nada: o áudio é identificado por hash de texto + voz + modelo.
  Por isso despublicar e republicar sem mudar o texto é de graça, e **trocar a voz vale para o que
  for publicado ou alterado depois** (o resto continua com a voz antiga).
- Falha do Google (rede, chave errada) tenta de novo nos ticks seguintes, até 3 vezes; republicar
  tenta de novo uma faixa que falhou.
- Texto acima de 30 000 caracteres não ganha áudio (o MP3 passaria de 20 MB).
- Os MP3 ficam na categoria **"Leitura em voz alta"** da biblioteca de mídia; apagar um deles por
  lá mostra o aviso de arquivo em uso.
- Ouvir baixa o MP3 do storage (`preload="none"`: só ao dar play). Isso conta na transferência
  do Vercel Blob/S3, não na cota do Google.

## Para plugins

`@venore/plugin-sdk/speech`: `syncSpeechAudio({ scope, items })` descreve o estado desejado de um
scope do plugin (convenção: começar pela key, ex: `novels.work:<id>`) — o core enfileira o que é
novo ou mudou e apaga o que saiu; `getSpeechAudio({ scopes })` devolve as URLs prontas.
