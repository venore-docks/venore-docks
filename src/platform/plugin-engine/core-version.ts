// Versão do core usada pra checar compatibility.coreVersion dos manifestos de plugin
// (docs/venore-docks.md — "Sistema de plugins"). Mantida à mão, mesmo padrão de
// contexts/themes/contracts/contract-version.ts pro contrato de tema.
//
// Não vem de package.json#version (hoje "0.1.0" — versão do pacote npm, sem relação com este
// conceito) nem do cabeçalho de docs/venore-docks.md ("2.0.0-forge"): em semver, uma prerelease
// X.Y.Z-tag tem precedência MENOR que X.Y.Z puro, então usar a string com sufixo aqui faria toda
// faixa "compatibility.coreVersion" comum (ex: o próprio exemplo do documento, ">=2.0.0 <3.0.0")
// ser tratada como incompatível — verificado com semver.satisfies antes de fixar isso. Este valor
// é só a parte semver "limpa" pra essa checagem; bump manual quando uma mudança no core quebrar
// compatibilidade com plugins existentes (mesmo critério de major bump). Minor sobe quando o SDK
// ganha algo que um plugin novo passa a exigir (faixas ">=2.0.0 <3.0.0" continuam valendo).
// 2.1.0: @venore/plugin-sdk/speech (leitura em voz alta).
export const CORE_VERSION = "2.1.0";
