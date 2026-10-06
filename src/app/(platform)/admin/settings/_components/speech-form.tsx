import { getSpeechStatus, SPEECH_VOICES } from "@/contexts/speech";
import { SpeechFormFields } from "./speech-form-fields";

const number = (value: number) => value.toLocaleString("pt-BR");

// Leitura em voz alta (docs/speech/google-cloud-tts.md). A página de configurações já passou
// pelo gate (getSettingsPageData → settings.manage); a action autoriza de novo.
export async function SpeechForm() {
  const status = await getSpeechStatus();
  if (!status.success) return null;
  const { configured, enabled, voice, monthlyCharacterLimit, month, usedCharacters, clips } = status.data;

  return (
    <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <h2 className="text-sm font-semibold text-foreground">Leitura em voz alta</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O áudio de cada texto publicado é gerado uma vez pelo Google Cloud Text-to-Speech (vozes Chirp 3 HD) e guardado na
        biblioteca de mídia. Ouvir não gasta cota; só texto novo ou alterado gasta. Ao chegar no teto do mês, a geração para e
        volta no mês seguinte. Trocar a voz vale para o que for publicado ou alterado depois.
      </p>
      {!configured && (
        <p className="mt-3 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning">
          Falta a variável de ambiente GOOGLE_TTS_API_KEY: sem ela nenhum áudio é gerado. Veja docs/speech/google-cloud-tts.md.
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Usado em {month}</dt>
          <dd className="font-medium text-foreground">
            {number(usedCharacters)} de {number(monthlyCharacterLimit)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Prontos</dt>
          <dd className="font-medium text-foreground">{number(clips.ready)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Na fila</dt>
          <dd className="font-medium text-foreground">{number(clips.pending + clips.processing)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Com falha</dt>
          <dd className="font-medium text-foreground">{number(clips.failed)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <SpeechFormFields
          enabled={enabled}
          voice={voice}
          monthlyCharacterLimit={monthlyCharacterLimit}
          voices={SPEECH_VOICES.map(({ key, label }) => ({ key, label }))}
        />
      </div>
    </section>
  );
}
