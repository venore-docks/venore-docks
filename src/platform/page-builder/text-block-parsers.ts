// Blocos editados por texto (textarea) — um formato simples em vez de um editor de lista próprio.
// Funções puras: o renderer e os testes usam as mesmas.

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function cells(line: string): string[] {
  return line.split("|").map((cell) => cell.trim());
}

// Tabela: uma linha por linha, células separadas por "|". Linhas com menos células são completadas.
export function parseTableRows(text: string): string[][] {
  const rows = lines(text).map(cells);
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => [...row, ...Array<string>(width - row.length).fill("")]);
}

// FAQ: blocos separados por linha em branco; 1ª linha = pergunta, o resto = resposta.
export function parseFaqItems(text: string): { question: string; answer: string }[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((chunk) => lines(chunk))
    .filter((chunkLines) => chunkLines.length > 0)
    .map(([question, ...answer]) => ({ question, answer: answer.join("\n") }))
    .filter((item) => item.answer.length > 0);
}

// Números: "valor | rótulo".
export function parseStatItems(text: string): { value: string; label: string }[] {
  return lines(text)
    .map(cells)
    .map(([value, ...label]) => ({ value: value ?? "", label: label.join(" | ") }))
    .filter((item) => item.value.length > 0);
}

// Linha do tempo: "data | título | descrição".
export function parseTimelineItems(text: string): { date: string; title: string; description: string }[] {
  return lines(text)
    .map(cells)
    .map(([date, title, ...description]) => ({ date: date ?? "", title: title ?? "", description: description.join(" | ") }))
    .filter((item) => item.date.length > 0 || item.title.length > 0);
}
