import { useState } from "react";
import { editImage } from "../lib/openai.js";
import { cropToAspect } from "../lib/crop.js";
import { generateThumbnail } from "../lib/thumbgen.js";
import { callApi } from "../lib/api.js";
import CopyButton from "./CopyButton.jsx";

// Универсальная карточка обложки: Long (16:9), Shorts (9:16), Записи (1:1).
// Пайплайн: промпт (thumbnail-generation через Claude) → gpt-image-2 → обрезка →
// цикл само-оценки vision-моделью → ручные правки через images.edit.
export default function ThumbCard({ label, topic, context, aspect, settings, card, onChange, variant, topicEditable = true }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fixText, setFixText] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const { openaiKey } = settings;
  // Настройка появилась позже — у старых сохранённых настроек её нет, поэтому фолбэк.
  const imageQuality = settings.imageQuality || "medium";
  const state = card || {};
  // Для нередактируемой темы (Long) всегда берём тему из сценария, а не
  // ручной перебив на карточке — тема ролика уже несёт весь нужный контекст.
  const effectiveTopic = topicEditable
    ? (state.topic !== undefined ? state.topic : (topic || ""))
    : (topic || "");

  function update(patch) {
    onChange({ ...state, ...patch });
  }

  async function runAutoLoop() {
    if (!openaiKey) return setError("Введите OpenAI API-ключ во вкладке «Обложки» или «Настройки»");
    if (!effectiveTopic.trim()) return setError("Сначала задайте тему для этой карточки");
    setError("");
    setBusy("Генерирую промпт…");
    try {
      const result = await generateThumbnail({
        settings,
        topic: effectiveTopic,
        context,
        aspect,
        variant,
        onProgress: setBusy,
      });
      update(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function runManualFix() {
    if (!fixText.trim() || !state.image) return;
    setError("");
    setBusy("Переделываю с учётом правки…");
    try {
      const raw = await editImage(openaiKey, state.image, fixText.trim(), aspect, imageQuality);
      const image = await cropToAspect(raw, aspect);
      update({
        image,
        attempts: [...(state.attempts || []), { image, prompt: `правка: ${fixText.trim()}`, score: null, weaknesses: [] }],
      });
      setFixText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = state.image;
    a.download = `${label.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  // Гибридный (дешёвый) путь: приложение делает только промпт (один вызов
  // Claude, копейки), картинку пользователь генерирует в ChatGPT по своей
  // подписке и использует как есть — OpenAI-ключ для этого не нужен.
  async function genPromptOnly() {
    if (!effectiveTopic.trim()) return setError("Сначала задайте тему для этой карточки");
    setError("");
    setBusy("Генерирую промпт для ChatGPT…");
    try {
      const { prompt } = await callApi("generate-thumbnail-prompt", {
        topic: effectiveTopic,
        aspect,
        context,
        variant,
        external: true,
      });
      update({ chatgptPrompt: prompt });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <strong>{label}</strong>
        <span className="muted">{aspect}</span>
      </div>
      {topicEditable ? (
        <div className="field">
          <label>Тема для обложки (можно поправить отдельно от темы видео)</label>
          <input
            value={effectiveTopic}
            onChange={(e) => update({ topic: e.target.value })}
            placeholder="Тема ещё не задана"
          />
        </div>
      ) : (
        <div className="muted small" style={{ marginBottom: 10 }}>
          Тема — из сценария/темы ролика (правится во вкладке YouTube Long)
        </div>
      )}

      {state.image && (
        <>
          <img className={`thumb thumb-${aspect.replace(":", "x")}`} src={state.image} alt={label} />
          <div className="row small">
            {state.score != null && <span>Оценка: <strong>{state.score}/10</strong></span>}
            <button className="link" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? "Скрыть историю" : `История попыток (${(state.attempts || []).length})`}
            </button>
            <button className="link" onClick={download}>Скачать</button>
          </div>
          {showHistory && (
            <div className="history">
              {(state.attempts || []).map((a, i) => (
                <div key={i} className="history-item">
                  <img src={a.image} alt={`попытка ${i + 1}`} />
                  <div className="small">
                    {a.score != null ? `${a.score}/10` : "без оценки"}
                    {a.weaknesses?.length > 0 && <div className="muted">{a.weaknesses.join("; ")}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="fix-row">
            <input
              placeholder="Что исправить (например: убери текст на фоне)"
              value={fixText}
              onChange={(e) => setFixText(e.target.value)}
              disabled={!!busy}
            />
            <button onClick={runManualFix} disabled={!!busy || !fixText.trim()}>Переделать</button>
          </div>
        </>
      )}

      <div className="row">
        <button onClick={runAutoLoop} disabled={!!busy}>
          {state.image ? "Сбросить и сгенерировать заново с нуля" : "Сгенерировать обложку"}
        </button>
        <button className="secondary" onClick={genPromptOnly} disabled={!!busy}>
          Промпт для ChatGPT
        </button>
      </div>

      {state.chatgptPrompt && (
        <div className="field" style={{ marginTop: 10 }}>
          <div className="label-row">
            <label>Промпт для ChatGPT — скопируй, вставь в чат, картинку скачай оттуда</label>
            <CopyButton text={() => state.chatgptPrompt} />
          </div>
          <textarea
            style={{ minHeight: 100 }}
            value={state.chatgptPrompt}
            onChange={(e) => update({ chatgptPrompt: e.target.value })}
          />
        </div>
      )}

      {busy && <div className="busy">{busy}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
