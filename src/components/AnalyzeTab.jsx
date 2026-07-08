import { useState } from "react";
import { callApi } from "../lib/api.js";
import CopyButton from "./CopyButton.jsx";

// Анализ YouTube-видео по ссылке: краткое содержание или разбор конкурента.
// Claude работает по метаданным + субтитрам (видео он не смотрит), поэтому
// при недоступных субтитрах результат помечается как ограниченный.
export default function AnalyzeTab({ state, setState }) {
  const data = { url: "", mode: "summary", manualTranscript: "", result: null, ...state };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patch(p) {
    setState({ ...data, ...p });
  }

  async function analyze() {
    if (!data.url.trim()) return setError("Вставьте ссылку на YouTube-видео");
    setError("");
    setBusy(true);
    try {
      const result = await callApi("analyze-video", {
        url: data.url.trim(),
        mode: data.mode,
        manualTranscript: data.manualTranscript.trim() || undefined,
      });
      patch({ result });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const r = data.result;
  const a = r?.analysis;
  const isCompetitor = r && a && a.structure !== undefined;

  const listBlock = (title, items) =>
    Array.isArray(items) && items.length > 0 ? (
      <div className="card">
        <div className="card-head">
          <strong>{title}</strong>
          <CopyButton text={() => items.map((x, i) => `${i + 1}. ${x}`).join("\n")} />
        </div>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {items.map((x, i) => (
            <li key={i} style={{ marginBottom: 6 }}>{x}</li>
          ))}
        </ol>
      </div>
    ) : null;

  const textBlock = (title, text) =>
    text ? (
      <div className="card">
        <div className="card-head">
          <strong>{title}</strong>
          <CopyButton text={text} />
        </div>
        <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    ) : null;

  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>Анализ YouTube-видео</strong></div>
        <div className="field">
          <label>Ссылка на видео (своё или конкурента)</label>
          <input
            value={data.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
        <div className="field">
          <label>Режим</label>
          <div className="row">
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                checked={data.mode === "summary"}
                onChange={() => patch({ mode: "summary" })}
              />
              Краткое описание
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                checked={data.mode === "competitor"}
                onChange={() => patch({ mode: "competitor" })}
              />
              Разбор конкурента
            </label>
          </div>
        </div>
        <details style={{ marginBottom: 12 }} open={data.result?.transcriptStatus === "none" || undefined}>
          <summary style={{ cursor: "pointer" }} className="muted small">
            Субтитры вручную (если автоматически не достались)
          </summary>
          <div className="muted small" style={{ margin: "8px 0" }}>
            YouTube часто не отдаёт субтитры нашему серверу. Надёжный способ: открой видео на YouTube →
            под описанием нажми «…ещё» → «Показать текст видео» → выдели весь текст, скопируй и вставь сюда.
            Таймкоды перед строками не мешают.
          </div>
          <textarea
            style={{ minHeight: 100 }}
            placeholder="Сюда можно вставить текст субтитров с страницы видео…"
            value={data.manualTranscript}
            onChange={(e) => patch({ manualTranscript: e.target.value })}
          />
        </details>
        <button onClick={analyze} disabled={busy}>Анализировать</button>
        {busy && <div className="busy">Анализирую видео… (метаданные → субтитры → разбор, до минуты)</div>}
        {error && <div className="error">{error}</div>}
      </div>

      {r && (
        <>
          <div className="card">
            <div className="card-head"><strong>{r.meta.title}</strong></div>
            <div className="muted small">
              {r.meta.channel} · {r.meta.publishedAt} · {r.meta.duration} · {r.meta.views.toLocaleString("ru-RU")} просмотров
            </div>
            {r.transcriptStatus === "none" && (
              <div className="error" style={{ marginTop: 8 }}>
                Субтитры недоступны — ограниченный анализ только по метаданным. Для полного анализа
                вставь текст видео в поле «Субтитры вручную» выше и нажми «Анализировать» ещё раз.
              </div>
            )}
            {r.transcriptStatus === "manual" && (
              <div className="muted small" style={{ marginTop: 8 }}>
                Анализ по вручную вставленным субтитрам.
              </div>
            )}
            {r.transcriptStatus === "truncated" && (
              <div className="muted small" style={{ marginTop: 8 }}>
                Видео длинное — анализ по сокращённой версии транскрипта (начало и конец).
              </div>
            )}
            {a?.note && <div className="muted small" style={{ marginTop: 8 }}>{a.note}</div>}
          </div>

          {isCompetitor ? (
            <>
              {textBlock("Хук (первые 15-30 секунд)", a.hook)}
              {listBlock("Структура ролика", a.structure)}
              {listBlock("Приёмы удержания", a.retention)}
              {textBlock("Призывы к действию (CTA)", a.cta)}
              {listBlock("Что позаимствовать для AI Music Lab", a.takeaways)}
            </>
          ) : (
            <>
              {textBlock("О чём видео", a?.about)}
              {listBlock("Ключевые тезисы", a?.key_points)}
              {textBlock("Целевая аудитория", a?.audience)}
            </>
          )}
        </>
      )}
    </div>
  );
}
