// heic-decode não publica tipos. Só o que image-original.ts usa: `all()` lê as dimensões de cada
// imagem do contêiner sem decodificar os pixels (dá pra recusar foto gigante antes de alocar).
declare module "heic-decode" {
  type DecodedHeicImage = { width: number; height: number; data: Uint8ClampedArray };
  type HeicImageHandle = { width: number; height: number; decode: () => Promise<DecodedHeicImage> };
  type HeicImageList = HeicImageHandle[] & { dispose: () => void };

  function decode(input: { buffer: Uint8Array }): Promise<DecodedHeicImage>;
  namespace decode {
    function all(input: { buffer: Uint8Array }): Promise<HeicImageList>;
  }
  export = decode;
}
