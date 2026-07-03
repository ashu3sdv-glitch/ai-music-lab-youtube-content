import { useRef, useState } from "react";
import { transcribe } from "../lib/openai.js";

const emptyState = { externalUrl: "", entries: [] };

function formatTime(sec) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const pad2 = String(ss).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${pad2}` : `${mm}:${pad2}`;
}

// Таймкоды по финальному смонтированному ролику: локальный файл или ссылка,
// отметки на смысловых переходах во время просмотра + запасной путь через Whisper.
export default function TimecodesTab({ state, setState, settings }) {
  const data = { ...emptyState, ...state };
  const [localUrl, setLocalUrl] = useState("");
  const [label, setLabel] = useState("");
  const videoRef = useRef(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [segments, setSegments] = useState([]);

  function patch(p) {
    setState({ ...data, ...p });
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (file) setLocalUrl(URL.createObjectURL(file));
  }

  function mark() {
    const t = videoRef.current?.currentTime ?? 0;
    const entries = [...data.entries, { time: t, label: label.trim() || "Блок" }].sort((a, b) => a.time - b.time);
    patch({ entries });
    setLabel("");
  }

  function removeEntry(i) {
    patch({ entries: data.entries.filter((_, idx) => idx !== i) });
  }

  function updateEntryLabel(i, text) {
    const entries = data.entries.slice();
    entries[i] = { ...entries[i], label: text };
    patch({ entries });
  }

  const block = data.entries.map((e) => `${formatTime(e.time)} ${e.label}`).join("\n");

  async function copyBlock() {
    try {
      await navigator.clipboard.writeText(block);
    } catch {
      // буфер обмена недоступен — пользователь скопирует вручную из textarea ниже
    }
  }

  async function runTranscribe(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!settings.openaiKey) return setError("Введите OpenAI API-ключ в «Настройках»");
    setError("");
    setBusy("Транскрибирую (Whisper)…");
    try {
      const segs = await transcribe(settings.openaiKey, file);
      setSegments(segs);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const src = localUrl || data.externalUrl;

  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>Видео</strong></div>
        <div className="field">
          <label>Загрузить экспортированный файл</label>
          <input type="file" accept="video/*" onChange={onFile} />
        </div>
        <div className="field">
          <label>или ссылка на видео</label>
          <input value={data.externalUrl} onChange={(e) => patch({ externalUrl: e.target.value })} placeholder="https://..." />
        </div>
        {src && <video ref={videoRef} src={src} controls />}
      </div>

      {src && (
        <div className="card">
          <div className="card-head"><strong>Отметки</strong></div>
          <div className="fix-row">
            <input placeholder="Название блока" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button onClick={mark}>Отметить (текущее время)</button>
          </div>
          {data.entries.length > 0 && (
            <>
              <ul className="timecode-list">
                {data.entries.map((e, i) => (
                  <li key={i}>
                    <span>{formatTime(e.time)}</span>
                    <input
                      style={{ flex: 1, margin: "0 8px" }}
                      value={e.label}
                      onChange={(ev) => updateEntryLabel(i, ev.target.value)}
                    />
                    <button className="link" onClick={() => removeEntry(i)}>Удалить</button>
                  </li>
                ))}
              </ul>
              <div className="field">
                <label>Готовый блок для описания</label>
                <textarea readOnly style={{ minHeight: 120 }} value={block} />
              </div>
              <button className="secondary" onClick={copyBlock}>Скопировать</button>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head"><strong>Запасной вариант: транскрипция (Whisper)</strong></div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Если удобнее не отмечать вручную — загрузите аудио/видео, получите сегменты речи с
          таймкодами и сопоставьте с блоками сценария сами.
        </div>
        <input type="file" accept="audio/*,video/*" onChange={runTranscribe} />
        {segments.length > 0 && (
          <ul className="timecode-list" style={{ marginTop: 10 }}>
            {segments.map((s, i) => (
              <li key={i}>
                <span>{formatTime(s.start)}</span>
                <span style={{ flex: 1, margin: "0 8px" }} className="small">{s.text}</span>
                <button className="link" onClick={() => patch({ entries: [...data.entries, { time: s.start, label: s.text.slice(0, 40) }].sort((a, b) => a.time - b.time) })}>
                  Добавить как таймкод
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {busy && <div className="busy">{busy}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
