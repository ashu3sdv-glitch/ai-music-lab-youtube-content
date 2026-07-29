import { useState } from "react";

export default function AudienceResearch({ state, setState, onUseTopic }) {
  const [channels, setChannels] = useState(state?.audienceChannels || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const topics = state?.audienceTopics || [];
  const meta = state?.audienceMeta;

  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/topics?action=audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `Ошибка ${response.status}`);
      setState((current) => ({
        ...(current || {}),
        audienceChannels: channels,
        audienceTopics: data.topics,
        audienceMeta: {
          channels: data.scannedChannels,
          comments: data.commentsScanned,
          quota: data.quotaUsed,
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <strong>Боли аудитории из комментариев</strong>
            <div className="muted small">Находит повторяющиеся вопросы под сильными роликами конкурентов.</div>
          </div>
        </div>
        <div className="field">
          <label>Ссылки на YouTube-каналы или @handle — по одному на строку, максимум 8</label>
          <textarea
            className="channel-input"
            value={channels}
            onChange={(event) => setChannels(event.target.value)}
            placeholder={"https://youtube.com/@channel-one\n@channel-two"}
            disabled={busy}
          />
        </div>
        <div className="row">
          <button onClick={run} disabled={busy || !channels.trim()}>
            {busy ? "Читаю ролики и комментарии…" : "Найти боли аудитории"}
          </button>
          <span className="muted small">Берём 5 самых просматриваемых из 20 свежих роликов каждого канала.</span>
        </div>
        {error && <div className="error">{error}</div>}
        {meta && (
          <div className="muted small">
            Каналов: {meta.channels?.length || 0} · комментариев: {meta.comments} · квота YouTube: ~{meta.quota} единиц
          </div>
        )}
      </div>

      {topics.length > 0 && (
        <div className="card">
          <div className="card-head"><strong>Подтверждённые боли — {topics.length}</strong></div>
          <div className="pain-grid">
            {topics.map((item, index) => (
              <article className="pain-card" key={`${item.topic}-${index}`}>
                <div className="card-head">
                  <strong>{item.topic}</strong>
                  <span className={`topic-badge ${item.confidence === "high" ? "good" : "warn"}`}>
                    {item.confidence === "high" ? "сильный сигнал" : "есть сигнал"}
                  </span>
                </div>
                <p>{item.pain}</p>
                <div className="muted small">Предлагаемый заголовок: {item.suggestedTitle}</div>
                <details>
                  <summary>Доказательства из комментариев ({item.mentions})</summary>
                  <div className="pain-evidence">
                    {(item.evidence || []).map((evidence, evidenceIndex) => (
                      <a
                        key={`${evidence.videoId}-${evidenceIndex}`}
                        href={`https://youtube.com/watch?v=${evidence.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        «{evidence.text}»
                        <span>{evidence.channelTitle} · {evidence.videoTitle}</span>
                      </a>
                    ))}
                  </div>
                </details>
                <button onClick={() => onUseTopic({
                  query: item.suggestedTitle || item.topic,
                  score: item.score,
                  topVideos: (item.evidence || []).map((evidence) => ({
                    title: evidence.videoTitle,
                    videoId: evidence.videoId,
                  })),
                  metrics: { medianViews: 0 },
                })}>
                  В сценарий
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
