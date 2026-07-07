import { useState } from "react";

// Кнопка «копировать в буфер» рядом с полем — чтобы не выделять текст вручную.
export default function CopyButton({ text }) {
  const [done, setDone] = useState(false);

  async function copy() {
    const value = typeof text === "function" ? text() : text;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // нет clipboard API (старый браузер/непрозрачный контекст) — запасной путь
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }

  return (
    <button type="button" className="copy-btn" onClick={copy} title="Скопировать в буфер обмена">
      {done ? "✓ Скопировано" : "⧉ Копировать"}
    </button>
  );
}
