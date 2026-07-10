import { useState } from "react";
import { callApi } from "../lib/api.js";
import CopyButton from "./CopyButton.jsx";

const emptyState = { telegram: [], boosty: [] };

// Соцсети: 3-4 поста для Telegram и 2 для Boosty из сценария Long-видео.
// Картинки не генерируются сознательно: Telegram живёт текстом/кружками/скринами,
// для Boosty при желании переиспользуется готовая YouTube-обложка.
export default function SocialTab({ state, setState, longState }) {
  const data = { ...emptyState, ...state };
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fixText, setFixText] = useState({});

  function patch(p) {
    setState({ ...data, ...p });
  }

  async function run(label, fn) {
    setError("");
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  const generate = () =>
    run("Готовлю посты для Telegram и Boosty…", async () => {
      if (!longState?.topic && !longState?.script) throw new Error("Сначала заполните тему/сценарий в YouTube Long");
      const { telegram = [], boosty = [] } = await callApi("generate-social", {
        topic: longState?.topic,
        script: longState?.script,
        synopsis: longState?.description?.synopsis,
      });
      patch({ telegram, boosty });
    });

  const fixKey = (platform, i) => `${platform}:${i}`;

  const rework = (platform, i) =>
    run(`Переделываю пост…`, async () => {
      const instruction = fixText[fixKey(platform, i)];
      if (!instruction?.trim()) return;
      const res = await callApi("generate-social", {
        current: data[platform][i],
        instruction: instruction.trim(),
        platform,
      });
      const post = (res[platform] || [])[0];
      if (!post) throw new Error("Не удалось переделать пост");
      const next = data[platform].slice();
      next[i] = post;
      patch({ [platform]: next });
      setFixText({ ...fixText, [fixKey(platform, i)]: "" });
    });

  function updatePost(platform, i, p) {
    const next = data[platform].slice();
    next[i] = { ...next[i], ...p };
    patch({ [platform]: next });
  }

  const fixRow = (platform, i) => (
    <div className="fix-row">
      <input
        placeholder="Что исправить"
        value={fixText[fixKey(platform, i)] || ""}
        onChange={(e) => setFixText({ ...fixText, [fixKey(platform, i)]: e.target.value })}
        disabled={!!busy}
      />
      <button onClick={() => rework(platform, i)} disabled={!!busy || !fixText[fixKey(platform, i)]?.trim()}>
        Переделать
      </button>
    </div>
  );

  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>Telegram + Boosty</strong></div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Из сценария Long-видео: 3-4 поста для Telegram (анонс, закулисье, микро-польза, вопрос)
          и 2 для Boosty (за кулисами, бонус). Картинки не нужны: Telegram живёт текстом,
          для Boosty можно переиспользовать готовую YouTube-обложку из вкладки «Обложки».
        </div>
        <button onClick={generate} disabled={!!busy}>Сгенерировать из сценария Long</button>
      </div>

      {data.telegram.length > 0 && (
        <>
          <h3 style={{ margin: "16px 0 8px" }}>Telegram</h3>
          {data.telegram.map((post, i) => (
            <div className="card" key={`tg-${i}`}>
              <div className="card-head">
                <strong>Пост {i + 1}</strong>
                <span>
                  <span className="muted small" style={{ marginRight: 8 }}>{post.angle}</span>
                  <CopyButton text={() => post.text} />
                </span>
              </div>
              <textarea
                style={{ minHeight: 120 }}
                value={post.text}
                onChange={(e) => updatePost("telegram", i, { text: e.target.value })}
              />
              {fixRow("telegram", i)}
            </div>
          ))}
        </>
      )}

      {data.boosty.length > 0 && (
        <>
          <h3 style={{ margin: "16px 0 8px" }}>Boosty</h3>
          {data.boosty.map((post, i) => (
            <div className="card" key={`bo-${i}`}>
              <div className="card-head">
                <strong>Пост {i + 1}</strong>
                <span>
                  <span className="muted small" style={{ marginRight: 8 }}>{post.angle}</span>
                  <CopyButton text={() => `${post.title}\n\n${post.text}`} />
                </span>
              </div>
              <div className="field">
                <label>Заголовок</label>
                <input value={post.title || ""} onChange={(e) => updatePost("boosty", i, { title: e.target.value })} />
              </div>
              <textarea
                style={{ minHeight: 140 }}
                value={post.text}
                onChange={(e) => updatePost("boosty", i, { text: e.target.value })}
              />
              {fixRow("boosty", i)}
            </div>
          ))}
        </>
      )}

      {busy && <div className="busy">{busy}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
