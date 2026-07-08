import { useState } from "react";
import CopyButton from "./CopyButton.jsx";

// Копилка ценных идей: сюда звёздочкой сохраняются пункты из «Анализа видео».
// Можно добавить мысль и вручную. Хранится в localStorage вместе с остальным.
export default function IdeasTab({ ideas, setIdeas }) {
  const [draft, setDraft] = useState("");
  const list = ideas || [];

  function addManual() {
    if (!draft.trim()) return;
    setIdeas([
      ...list,
      { id: crypto.randomUUID(), text: draft.trim(), source: "своя заметка", date: new Date().toISOString().slice(0, 10) },
    ]);
    setDraft("");
  }

  function remove(id) {
    setIdeas(list.filter((i) => i.id !== id));
  }

  const allText = () =>
    list.map((i) => `• ${i.text}\n  (${i.source}, ${i.date})`).join("\n\n");

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <strong>Копилка идей</strong>
          {list.length > 0 && <CopyButton text={allText} />}
        </div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Сюда попадают пункты, отмеченные ☆ во вкладке «Анализ видео». Можно записать и свою мысль.
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
      </div>

      {list.length === 0 && (
        <div className="muted small">Пока пусто — отметь ☆ понравившийся вывод в «Анализе видео».</div>
      )}

      {list
        .slice()
        .reverse()
        .map((idea) => (
          <div className="card" key={idea.id}>
            <div style={{ whiteSpace: "pre-wrap" }}>{idea.text}</div>
            <div className="row small" style={{ marginTop: 8, alignItems: "center" }}>
              <span className="muted small">{idea.source} · {idea.date}</span>
              <CopyButton text={idea.text} />
              <button className="link" onClick={() => remove(idea.id)}>Удалить</button>
            </div>
          </div>
        ))}
    </div>
  );
}
