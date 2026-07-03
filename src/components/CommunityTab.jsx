import { useState } from "react";
import { callApi } from "../lib/api.js";

const emptyState = { posts: [], intervalDays: 2, baseDate: "" };

// Посты для «Записей»: 3 тизера, привязанных к темам Shorts, + график публикации.
export default function CommunityTab({ state, setState, longState, shortsState }) {
  const data = { ...emptyState, ...state };
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fixText, setFixText] = useState(["", "", ""]);

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

  const shortsTopics = (shortsState?.cards || []).map((c) => c.topic).filter(Boolean);

  const generate = () =>
    run("Генерирую посты…", async () => {
      if (!longState?.topic && !longState?.script) throw new Error("Сначала заполните тему/сценарий в YouTube Long");
      const { posts } = await callApi("generate-community", {
        topic: longState?.topic,
        script: longState?.script,
        shortsTopics,
      });
      patch({ posts });
    });

  const rework = (i) =>
    run(`Переделываю пост ${i + 1}…`, async () => {
      const instruction = fixText[i];
      if (!instruction?.trim()) return;
      const { posts } = await callApi("generate-community", {
        current: data.posts[i],
        instruction: instruction.trim(),
      });
      const next = data.posts.slice();
      next[i] = posts[0];
      patch({ posts: next });
      const nf = fixText.slice();
      nf[i] = "";
      setFixText(nf);
    });

  function scheduleFor(i) {
    if (!data.baseDate) return null;
    const d = new Date(data.baseDate);
    d.setDate(d.getDate() + data.intervalDays * (i + 1));
    return d.toISOString().slice(0, 10);
  }

  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>График публикации</strong></div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Дата выхода Long-видео</label>
            <input type="date" value={data.baseDate} onChange={(e) => patch({ baseDate: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Интервал между постами (дней)</label>
            <input
              type="text"
              inputMode="numeric"
              value={data.intervalDays}
              onChange={(e) => patch({ intervalDays: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
        <button onClick={generate} disabled={!!busy}>Сгенерировать посты для Записей</button>
      </div>

      <div className="grid-3">
        {data.posts.map((post, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Пост #{i + 1}</strong>
              {data.baseDate && <span className="muted small">{scheduleFor(i)}</span>}
            </div>
            <div className="muted small">Shorts: {post.shortsTopic}</div>
            <textarea style={{ minHeight: 120 }} value={post.text} onChange={(e) => {
              const next = data.posts.slice();
              next[i] = { ...post, text: e.target.value };
              patch({ posts: next });
            }} />
            <div className="fix-row">
              <input
                placeholder="Что исправить"
                value={fixText[i] || ""}
                onChange={(e) => {
                  const next = fixText.slice();
                  next[i] = e.target.value;
                  setFixText(next);
                }}
                disabled={!!busy}
              />
              <button onClick={() => rework(i)} disabled={!!busy || !fixText[i]?.trim()}>Переделать</button>
            </div>
          </div>
        ))}
      </div>

      <div className="muted small">Публикация в YouTube — вручную (автопостинг в эту версию не входит).</div>
      {busy && <div className="busy">{busy}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
