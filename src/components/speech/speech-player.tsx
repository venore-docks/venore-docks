import { Headphones } from "lucide-react";

// Player do áudio gerado pela leitura em voz alta (contexts/speech). Controle nativo do
// navegador: acessível por teclado e leitor de tela, com avanço/retrocesso sem JS próprio.
// preload="none": o MP3 só é baixado quando a pessoa der play (transferência do storage custa).
export function SpeechPlayer({ src, label = "Ouvir este texto" }: { src: string; label?: string }) {
  return (
    <figure className="my-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
      <figcaption className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
        <Headphones aria-hidden className="size-4 text-muted-foreground" />
        {label}
      </figcaption>
      <audio controls preload="none" src={src} className="h-9 w-full min-w-0">
        <a href={src}>Baixar o áudio</a>
      </audio>
    </figure>
  );
}
