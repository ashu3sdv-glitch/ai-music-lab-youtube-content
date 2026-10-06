const LINKS_HEADING = "Ссылки:";

function normalizeLine(line) {
  return line.trim().replace(/^[-*•]\s*/, "");
}

export function selectedDescriptionLinks(links = [], selectedIds = []) {
  const selected = new Set(selectedIds);
  return links.filter((link) => selected.has(link.id) && link.name?.trim() && link.url?.trim());
}

// Ссылки из настроек добавляются приложением, а не моделью. Поэтому повторная
// генерация не может удалить их, а повторное нажатие не создаёт дубликаты.
export function withDescriptionLinks(description = "", links = [], selectedIds = []) {
  const knownLines = new Set(
    links.flatMap((link) => {
      const name = link.name?.trim();
      const url = link.url?.trim();
      return url ? [url, name ? `${name}: ${url}` : ""].filter(Boolean) : [];
    })
  );

  const cleanLines = String(description)
    .split("\n")
    .filter((line) => !knownLines.has(normalizeLine(line)));

  while (cleanLines.length && !cleanLines.at(-1).trim()) cleanLines.pop();
  if (cleanLines.at(-1)?.trim() === LINKS_HEADING) cleanLines.pop();

  const selectedLinks = selectedDescriptionLinks(links, selectedIds);
  if (!selectedLinks.length) return cleanLines.join("\n").trim();

  const block = selectedLinks.map((link) => `${link.name.trim()}: ${link.url.trim()}`).join("\n");
  return `${cleanLines.join("\n").trim()}\n\n${LINKS_HEADING}\n${block}`.trim();
}
