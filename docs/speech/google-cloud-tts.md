# Leitura em voz alta pelo Google Cloud Text-to-Speech (`SPEECH_DRIVER=google`)

Alternativa ao worker gratuito — regras gerais em [leitura-em-voz-alta.md](leitura-em-voz-alta.md).
**Conta de faturamento nova no Brasil exige pré-pagamento de R$ 200** (vira saldo, reembolsável ao
encerrar a conta) antes de liberar a API, mesmo dentro da cota grátis.

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
| Vercel → projeto → **Environment Variables** | `SPEECH_DRIVER=google` e `GOOGLE_TTS_API_KEY` = a chave do passo 4 (Production; Preview só se quiser áudio nos previews). Redeploy depois. |
| Editorial → **Áudios** (`/admin/speech`) | Ligar a geração, escolher a voz e o teto mensal de caracteres. |

Sem `GOOGLE_TTS_API_KEY`, ou com a leitura desligada, nada é gerado e nenhum botão de ouvir
aparece. `GOOGLE_TTS_ENDPOINT` (opcional) só troca o endereço da API — servidor falso em teste
local ou proxy.

Com o Google a síntese roda no próprio app: job `speech.process-pending` (cron, lotes de 4 em
paralelo por até ~35 s) e, na Vercel, logo depois da publicação (`waitUntil`, até 12 faixas).
