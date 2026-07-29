import { useMemo, useState } from "react";
import CopyButton from "./CopyButton.jsx";

function exportMarkdown(topics) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`# Сохранённые темы — AI Music Lab (${date})`, ""];
  for (const item of topics) {
    lines.push(`## ${item.query}`);
    if (item.pain) lines.push("", item.pain);
    lines.push("", `- Источник: ${item.sourceLabel || "Исследование тем"}`);
    if (item.researchLabel) lines.push(`- Исследование: ${item.researchLabel}`);
    if (item.score != null) lines.push(`- Скор: ${item.score}`);
    for (const evidence of item.evidence || []) {
      lines.push(`- Комментарий: ${evidence.translatedText || evidence.text}`);
    }
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `sohranennye-temy-${date}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function SavedTopicsTab({ topics, setTopics, onUseTopic }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const list = topics || [];
  const visible = useMemo(() => list
    .filter((item) => filter === "all" || item.sourceType === filter)
    .filter((item) => `${item.query} ${item.pain || ""}`.toLocaleLowerCase("ru")
      .includes(query.trim().toLocaleLowerCase("ru")))
    .slice()
    .reverse(), [list, filter, query]);

  function remove(id) {
    setTopics(list.filter((item) => item.id !== id));
  }

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <div>
            <strong>Сохранённые темы ({list.length})</strong>
            <div className="muted small">Все новые исследования сохраняются сюда автоматически.</div>
          </div>
          {list.length > 0 && (
            <button className="secondary" onClick={() => exportMarkdown(list)}>Скачать .md</button>
          )}
        </div>
        <div className="saved-topics-controls">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти тему…"
          />
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Все источники</option>
            <option value="audience">Комментарии аудитории</option>
            <option value="search">Поисковый спрос</option>
          </select>
        </div>
      </div>

      {list.length === 0 && (
        <div className="card saved-topics-empty">
          <strong>Здесь пока пусто</strong>
          <span className="muted small">
            Запустите поиск во вкладке «Темы» — найденные темы появятся здесь сами.
          </span>
        </div>
      )}
      {list.length > 0 && visible.length === 0 && (
        <div className="muted small">По этому фильтру тем не найдено.</div>
      )}

      <div className="saved-topics-grid">
        {visible.map((item) => (
          <article className="card saved-topic-card" key={item.id}>
            <div className="card-head">
              <strong>{item.query}</strong>
              <span className={`topic-badge ${item.sourceType === "audience" ? "good" : "warn"}`}>
                {item.sourceLabel}
              </span>
            </div>
            {item.pain && <p>{item.pain}</p>}
            <div className="muted small">
              {new Date(item.savedAt).toLocaleDateString("ru-RU")}
              {item.researchLabel ? ` · ${item.researchLabel}` : ""}
              {item.score != null ? ` · скор ${item.score}` : ""}
            </div>
            {(item.evidence || []).length > 0 && (
              <details>
                <summary>Комментарии-доказательства ({item.evidence.length})</summary>
                <div className="pain-evidence">
                  {item.evidence.map((evidence, index) => (
                    <div className="pain-evidence-item" key={`${evidence.videoId}-${index}`}>
                      <strong>«{evidence.translatedText || evidence.text}»</strong>
                      {evidence.translatedFromEnglish && <em>Переведено с английского</em>}
                      {evidence.translatedFromEnglish && (
                        <details>
                          <summary>Показать оригинал</summary>
                          <div>«{evidence.text}»</div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <div className="row saved-topic-actions">
              <button onClick={() => onUseTopic({
                ...item,
                query: item.query,
                topVideos: item.topVideos || (item.evidence || []).map((evidence) => ({
                  title: evidence.videoTitle,
                  videoId: evidence.videoId,
                })),
                metrics: item.metrics || { medianViews: 0 },
              })}>
                В сценарий
              </button>
              <CopyButton text={item.query} />
              <button className="link" onClick={() => remove(item.id)}>Удалить</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
