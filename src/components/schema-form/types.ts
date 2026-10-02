// Formulário gerado de um schema (spec v8 §9): extraído do FieldControl de
// admin/cms/.../block-fields-panel.tsx como componente genérico, compatível com FormData (cada
// campo tem `name` e envia string, como um <form> nativo) e também controlado (`onChange`).
// Hoje quem usa são as opções do tema (W2); o editor de blocos adota depois.

export type SchemaFormValue = string | number | boolean | null;
export type SchemaFormValues = Readonly<Record<string, SchemaFormValue>>;
export type SchemaFormChoice = { value: string; label: string };

type SchemaFormFieldBase = {
  // Nome no FormData (ex: `option.density`) — também a chave em `values`.
  name: string;
  label: string;
  description?: string;
  // Campos com o mesmo `group` saem num <fieldset> com <legend>.
  group?: string;
  // Só aparece quando outro campo tem esse valor; escondido, o valor atual vai num input hidden.
  visibleWhen?: { name: string; equals: string | boolean };
};

export type SchemaFormField =
  | (SchemaFormFieldBase & { type: "boolean" })
  // `emptyLabel` adiciona uma escolha vazia ("" ⇒ null, ex: "Padrão do tema").
  | (SchemaFormFieldBase & { type: "select"; choices: readonly SchemaFormChoice[]; emptyLabel?: string })
  | (SchemaFormFieldBase & { type: "range"; min: number; max: number; step: number; unit?: string })
  // Hex (#rrggbb) ou oklch(): o seletor nativo só entende hex, o texto aceita os dois.
  | (SchemaFormFieldBase & { type: "color"; placeholder?: string })
  | (SchemaFormFieldBase & { type: "text"; maxLength?: number; multiline?: boolean })
  // Id de mídia; vazio ⇒ null.
  | (SchemaFormFieldBase & { type: "media"; accept: "image" });

export type SchemaFormFieldType = SchemaFormField["type"];
