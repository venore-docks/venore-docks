import { cn } from "@/lib/utils";
import { resolveCoverFit } from "./cover-fit";

// Capa de card/hero que nunca corta arte vertical ou quadrada (post/story de Instagram): abaixo do
// limiar de cover-fit.ts a imagem aparece inteira (object-contain) e uma cópia desfocada e
// escurecida dela mesma preenche o fundo. Foto horizontal (ou sem dimensão conhecida) segue em
// object-cover. Preenche o pai (absolute inset-0) — o pai define proporção, overflow e raio.
// Sem hooks: serve em Server e Client Component.
export function CoverImage({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  // Classes extras da imagem principal (ex: zoom no hover do card).
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const fit = resolveCoverFit(width, height);

  if (fit === "cover") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- mesmo padrão do page-builder, sem domínio remoto configurado pra next/image
      <img src={src} alt={alt} loading={loading} data-cover-fit="cover" className={cn("absolute inset-0 size-full object-cover", className)} />
    );
  }

  return (
    <>
      {/* Fundo decorativo: a mesma arte ampliada e desfocada, só pra não sobrar faixa vazia. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading={loading}
        className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl saturate-125"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-background/25" />
      {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        data-cover-fit="contain"
        className={cn("absolute inset-0 size-full object-contain drop-shadow-md", className)}
      />
    </>
  );
}
