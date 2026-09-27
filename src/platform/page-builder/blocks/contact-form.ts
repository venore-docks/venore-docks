import type { BlockDefinition } from "@/contexts/cms";

export const CONTACT_FORM_BLOCK_KEY = "core.form.contact";

// Formulário de contato: a mensagem vai por e-mail (EMAIL_DRIVER) para `recipient`. O destinatário
// nunca aparece no HTML — segue cifrado no token do formulário (platform/contact/contact-token.ts).
export const contactFormBlockDefinition: BlockDefinition = {
  key: CONTACT_FORM_BLOCK_KEY,
  label: "Formulário de contato",
  category: "formulários",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { recipient: "", title: "Fale com a gente", submitLabel: "Enviar mensagem", successMessage: "Mensagem enviada. Obrigado!" },
  requiredDataFields: ["recipient"],
  missingConfigMessage: "Informe o e-mail que recebe as mensagens",
  editorFields: [
    { name: "recipient", type: "text", label: "Enviar para (e-mail, não aparece no site)" },
    { name: "title", type: "text", label: "Título" },
    { name: "submitLabel", type: "text", label: "Texto do botão" },
    { name: "successMessage", type: "text", label: "Mensagem após o envio" },
  ],
};
