import { useState } from "react";
import CopyButton from "./CopyButton.jsx";
import { callApi } from "../lib/api.js";

// Банк идей: сюда звёздочкой попадают пункты из «Анализа видео» и свои заметки.
// У каждой идеи — суть в одно предложение (сжимается Claude в фоне), категория,
// статус-судьба (Новая → Попробовать → В работе → Сделано/Отброшена).
// Хранится в localStorage этого браузера — кнопка «Скачать .md» это страховка.

const STATUSES = [
  ["new", "Новая"],
  ["try", "Попробовать"],
  ["doing", "В работе"],
  ["done", "Сделано"],
  ["dropped", "Отброшена"],
];
const CATEGORIES = ["Канал", "Контент", "Бизнес", "Личное"];

export function makeIdea(text, source) {
  return {
    id: crypto.randomUUID(),
    text,
    summary: "",
    category: "",
    status: "new",
    source,
    date: new Date().toISOString().slice(0, 10),
  };
}

// Фоновое сжатие идеи до одного предложения + автокатегория. Не блокирует
// сохранение: идея сразу в банке с полным текстом, суть подтягивается позже.
export function condenseIdea(idea, setIdeas) {
  callApi("condense-idea", { text: idea.text })
    .then(({ summary, category }) =>
      setIdeas((prev) =>
        (prev || []).map((i) =>
          i.id === idea.id
            ? { ...i, summary: summary || i.summary, category: i.category || category || "" }
            : i
        )
      )
    )
    .catch(() => {
      // не сжалось — идея остаётся с полным текстом, ничего не теряем
    });
}

export default function IdeasTab({ ideas, setIdeas }) {
  const [draft, setDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const list = ideas || [];

  function addManual() {
    if (!draft.trim()) return;
    const idea = makeIdea(draft.trim(), "своя заметка");
    setIdeas([...list, idea]);
    condenseIdea(idea, setIdeas);
    setDraft("");
  }

  function update(id, patch) {
    setIdeas(list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function remove(id) {
    setIdeas(list.filter((i) => i.id !== id));
  }

  const statusOf = (i) => i.status || "new";
  const visible = list
    .filter(
      (i) =>
        (statusFilter === "all" || statusOf(i) === statusFilter) &&
        (catFilter === "all" || (i.category || "") === catFilter)
    )
    .slice()
    .reverse();

  const allText = () =>
    list.map((i) => `• ${i.summary || i.text}\n  (${i.source}, ${i.date})`).join("\n\n");

  // Экспорт всего банка в markdown-файл — страховка от потери localStorage.
  function exportMd() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [`# Банк идей — AI Music Lab (${today})`, ""];
    for (const [key, label] of STATUSES) {
      const group = list.filter((i) => statusOf(i) === key);
      if (!group.length) continue;
      lines.push(`## ${label}`, "");
      for (const i of group) {
        lines.push(`- **${(i.summary || i.text).replace(/\n/g, " ")}**${i.category ? ` \`${i.category}\`` : ""}`);
        if (i.summary) lines.push(`  - ${i.text.replace(/\n/g, " ")}`);
        lines.push(`  - _${i.source}, ${i.date}_`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bank-idei-${today}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const countBy = (key) => list.filter((i) => statusOf(i) === key).length;

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <strong>Банк идей ({list.length})</strong>
          <span>
            {list.length > 0 && <CopyButton text={allText} />}
            {list.length > 0 && (
              <button
                className="link"
                onClick={exportMd}
                title="Скачать весь банк файлом — страховка: идеи хранятся только в этом браузере"
              >
                ⬇ Скачать .md
              </button>
            )}
          </span>
        </div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Сюда попадают пункты, отмеченные ☆ во вкладке «Анализ видео» — суть сжимается до одного
          предложения автоматически. Раз в неделю: просмотри «Новые» и переведи 1-2 в «Попробовать».
        </div>
        <div className="fix-row">
          <input
            placeholder="Своя мысль/идея…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
          />
          <button onClick={addManual} disabled={!draft.trim()}>Добавить</button>
        </div>
        {list.length > 0 && (
          <div className="row small" style={{ marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className={statusFilter === "all" ? "" : "secondary"} onClick={() => setStatusFilter("all")}>
              Все ({list.length})
            </button>
            {STATUSES.map(([key, label]) => (
              <button
                key={key}
                className={statusFilter === key ? "" : "secondary"}
                onClick={() => setStatusFilter(key)}
              >
                {label} ({countBy(key)})
              </button>
            ))}
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">Все категории</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {list.length === 0 && (
        <div className="muted small">Пока пусто — отметь ☆ понравившийся вывод в «Анализе видео».</div>
      )}
      {list.length > 0 && visible.length === 0 && (
        <div className="muted small">Под этот фильтр идей нет.</div>
      )}

      {visible.map((idea) => (
        <div className="card" key={idea.id}>
          <div style={{ fontWeight: 600 }}>{idea.summary || idea.text}</div>
          {idea.summary && idea.summary !== idea.text && (
            <details style={{ marginTop: 6 }}>
              <summary className="muted small" style={{ cursor: "pointer" }}>Полный текст</summary>
              <div className="small" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{idea.text}</div>
            </details>
          )}
          <div className="row small" style={{ marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={statusOf(idea)} onChange={(e) => update(idea.id, { status: e.target.value })}>
              {STATUSES.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select value={idea.category || ""} onChange={(e) => update(idea.id, { category: e.target.value })}>
              <option value="">Без категории</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="muted small">{idea.source} · {idea.date}</span>
            <CopyButton text={idea.summary || idea.text} />
            <button className="link" onClick={() => remove(idea.id)}>Удалить</button>
          </div>
        </div>
      ))}
    </div>
  );
}
