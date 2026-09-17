export type EditorFieldType = "text" | "textarea" | "richtext" | "number" | "boolean" | "select" | "icon" | "image" | "audio" | "url";

export type EditorField = {
  name: string;
  type: EditorFieldType;
  label: string;
  options?: { value: string; label: string }[];
};

export type AreaDefinition = {
  key: string;
  label: string;
  // Regra de posição dentro da area: só blocos com key nesta lista podem entrar aqui.
  allowedBlockKeys: string[];
};

export type BlockStructure = "leaf" | "areas";

// contexts/cms não conhece nenhum bloco concreto — este é só o formato que qualquer bloco
// (definido em plugins) precisa satisfazer para ser validado/renderizado.
export type BlockDefinition = {
  key: string;
  label: string;
  category: string;
  structure: BlockStructure;
  defaultData: Record<string, unknown>;
  editorFields: EditorField[];
  // Regra de posição na raiz: só blocos com allowedInRoot === true podem entrar no nível
  // raiz da composição. Presente sempre (não só quando structure === "areas").
  allowedInRoot: boolean;
  // Só quando structure === "areas".
  areaDefinitions?: AreaDefinition[];
  // Ausente/vazio = bloco sempre considerado configurado (ex: row, blocos de plugin sem
  // pré-requisito). Cada nome aqui precisa existir em `data` e, se for string, não pode ficar
  // vazia após trim — checado por isBlockConfigured (contracts/block-config.ts), a única fonte
  // da verdade sobre "este bloco tem o que precisa pra renderizar" (renderer e builder nunca
  // espalham esse `if`). BlockDefinition é dado puro e precisa continuar serializável (atravessa
  // o boundary RSC como prop de client component) — nada de função aqui; por isso lista de
  // campos, não predicado.
  requiredDataFields?: string[];
  // Linha exibida no placeholder do modo "edit" quando isBlockConfigured(definition, data) é
  // false, e usada na lista de pendências ao tentar publicar uma entry com bloco incompleto.
  missingConfigMessage?: string;
};

export type ResolveBlockDefinition = (key: string) => BlockDefinition | null;
