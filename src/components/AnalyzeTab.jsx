import { useState } from "react";
import { callApi } from "../lib/api.js";
import CopyButton from "./CopyButton.jsx";

// Анализ YouTube-видео по ссылке: краткое содержание или разбор конкурента.
// Claude работает по метаданным + субтитрам (видео он не смотрит), поэтому
// при недоступных субтитрах результат помечается как ограниченный.
// Любой пункт результата можно звёздочкой сохранить в копилку (вкладка «Идеи»).
export default function AnalyzeTab({ state, setState, ideas, setIdeas }) {
  const data = { url: "", mode: "summary", manualTranscript: "", manualOpen: false, result: null, ...state };
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function patch(p) {
    setState({ ...data, ...p });
  }

  // Двухшаговый поток: сначала быстрая проверка субтитров (пара секунд),
  // и только при их наличии — долгий анализ. Если субтитров нет — сразу
  // говорим об этом и открываем поле ручной вставки, не гоняя анализ впустую.
  async function analyze(force = false) {
    if (!data.url.trim()) return setError("Вставьте ссылку на YouTube-видео");
    setError("");
    setNotice("");
    try {
      const manual = data.manualTranscript.trim();
      if (!manual && !force) {
        setBusy("Проверяю видео и доступность субтитров…");
        const check = await callApi("analyze-video", { url: data.url.trim(), stage: "check" });
        if (!check.hasTranscript) {
          setBusy("");
          patch({ manualOpen: true });
          setNotice(
            `Субтитры для «${check.meta.title}» недоступны. Вставь текст видео в поле «Субтитры вручную» ниже и нажми «Анализировать» ещё раз — или запусти ограниченный анализ без субтитров.`
          );
          return;
        }
      }
      setBusy("Анализирую видео… (развёрнутый разбор, для длинных видео до 2-3 минут)");
      const result = await callApi("analyze-video", {
        url: data.url.trim(),
        mode: data.mode,
        manualTranscript: manual || undefined,
      });
      if (!result?.meta || !result?.analysis) {
        throw new Error("Анализ не завершился — сервер вернул неполный ответ. Попробуйте ещё раз.");
      }
      patch({ result });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setError("");
    setNotice("");
    patch({ url: "", manualTranscript: "", manualOpen: false, result: null });
  }

  // Битый результат (например, обрывок ответа, сохранившийся в localStorage
  // до этой защиты) не рисуем вообще — раньше это роняло всё приложение в
  // белый экран при каждой загрузке страницы.
  const r = data.result?.meta && data.result?.analysis ? data.result : null;
  const a = r?.analysis;
  const isCompetitor = r && a && a.structure !== undefined;

  const savedTexts = new Set((ideas || []).map((i) => i.text));

  function toggleIdea(text) {
    if (savedTexts.has(text)) {
      setIdeas((ideas || []).filter((i) => i.text !== text));
    } else {
      setIdeas([
        ...(ideas || []),
        { id: crypto.randomUUID(), text, source: r?.meta?.title || "", date: new Date().toISOString().slice(0, 10) },
      ]);
    }
  }

  // Звёздочка «в копилку идей» — есть у каждого пункта списка и текстового блока.
  const star = (text) => (
    <button
      type="button"
      className="link"
      style={{ marginLeft: 8, flexShrink: 0 }}
      title={savedTexts.has(text) ? "Убрать из идей" : "Сохранить в идеи"}
      onClick={() => toggleIdea(text)}
    >
      {savedTexts.has(text) ? "★" : "☆"}
    </button>
  );

  const listBlock = (title, items) =>
    Array.isArray(items) && items.length > 0 ? (
      <div className="card">
        <div className="card-head">
          <strong>{title}</strong>
          <CopyButton text={() => items.map((x, i) => `${i + 1}. ${x}`).join("\n")} />
        </div>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {items.map((x, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              {x}
              {star(x)}
            </li>
          ))}
        </ol>
      </div>
    ) : null;

  const textBlock = (title, text) =>
    text ? (
      <div className="card">
        <div className="card-head">
          <strong>{title}</strong>
          <span>
            {star(text)}
            <CopyButton text={text} />
          </span>
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
        <details
          style={{ marginBottom: 12 }}
          open={data.manualOpen || data.result?.transcriptStatus === "none" || undefined}
        >
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
        <div className="row">
          <button onClick={() => analyze(false)} disabled={!!busy}>Анализировать</button>
          {notice && (
            <button className="secondary" onClick={() => analyze(true)} disabled={!!busy}>
              Анализировать без субтитров
            </button>
          )}
          <button className="secondary" onClick={reset} disabled={!!busy}>Сброс</button>
        </div>
        {busy && <div className="busy">{busy}</div>}
        {notice && <div className="muted" style={{ marginTop: 8 }}>{notice}</div>}
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
            <div className="muted small" style={{ marginTop: 8 }}>
              ☆ у пункта — сохранить его в копилку (вкладка «Идеи»).
            </div>
          </div>

          {isCompetitor ? (
            <>
              {textBlock("Хук (первые 15-30 секунд)", a.hook)}
              {listBlock("Структура ролика", a.structure)}
              {listBlock("Приёмы удержания", a.retention)}
              {textBlock("Призывы к действию (CTA)", a.cta)}
              {listBlock("Что позаимствовать", a.takeaways)}
              {listBlock("💡 Ценные идеи и принципы", a.insights)}
            </>
          ) : (
            <>
              {textBlock("О чём видео", a?.about)}
              {listBlock("Ключевые тезисы", a?.key_points)}
              {listBlock("💡 Ценные идеи и принципы", a?.insights)}
              {textBlock("Целевая аудитория", a?.audience)}
            </>
          )}
        </>
      )}
    </div>
  );
}
