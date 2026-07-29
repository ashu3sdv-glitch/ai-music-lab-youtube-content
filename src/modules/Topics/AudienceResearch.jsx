import { useState } from "react";

export default function AudienceResearch({ state, setState, onUseTopic }) {
  const [channels, setChannels] = useState(state?.audienceChannels || "");
  const [discoverQuery, setDiscoverQuery] = useState(state?.discoverQuery || "Suno создание музыки");
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const topics = state?.audienceTopics || [];
  const meta = state?.audienceMeta;

  async function discover() {
    setDiscovering(true);
    setError("");
    try {
      const response = await fetch("/api/topics?action=discover-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: discoverQuery }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `Ошибка ${response.status}`);
      setCandidates(data.channels || []);
      setSelected((data.channels || []).slice(0, 8).map((channel) => channel.channelId));
      setState((current) => ({ ...(current || {}), discoverQuery }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDiscovering(false);
    }
  }

  function useSelected() {
    setChannels(
      candidates
        .filter((channel) => selected.includes(channel.channelId))
        .map((channel) => channel.url)
        .join("\n")
    );
  }

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
        <div className="channel-discovery">
          <div className="field">
            <label>Направление для автоматического поиска каналов</label>
            <input
              value={discoverQuery}
              onChange={(event) => setDiscoverQuery(event.target.value)}
              placeholder="Например: Suno создание музыки"
              disabled={discovering || busy}
            />
          </div>
          <button onClick={discover} disabled={discovering || busy || !discoverQuery.trim()}>
            {discovering ? "Ищу обучающие каналы…" : "Найти каналы автоматически"}
          </button>
        </div>
        {candidates.length > 0 && (
          <div className="channel-candidates">
            <div className="card-head">
              <strong>Найденные обучающие каналы — {candidates.length}</strong>
              <button className="secondary" onClick={useSelected} disabled={!selected.length}>
                Использовать выбранные ({selected.length})
              </button>
            </div>
            {candidates.map((channel) => (
              <label className="channel-candidate" key={channel.channelId}>
                <input
                  type="checkbox"
                  checked={selected.includes(channel.channelId)}
                  onChange={(event) => setSelected((current) =>
                    event.target.checked
                      ? [...current, channel.channelId].slice(0, 8)
                      : current.filter((id) => id !== channel.channelId)
                  )}
                />
                <span>
                  <strong>{channel.title}</strong>
                  <span className="muted small">
                    {channel.subscribers == null
                      ? "подписчики скрыты"
                      : `${channel.subscribers.toLocaleString("ru-RU")} подписчиков`}
                  </span>
                  <span className="small">{channel.examples?.[0]}</span>
                </span>
              </label>
            ))}
          </div>
        )}
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
                      <div className="pain-evidence-item" key={`${evidence.videoId}-${evidenceIndex}`}>
                        <strong>«{evidence.translatedText || evidence.text}»</strong>
                        {evidence.translatedFromEnglish && <em>Переведено с английского</em>}
                        {evidence.translatedFromEnglish && (
                          <details>
                            <summary>Показать оригинал</summary>
                            <div>«{evidence.text}»</div>
                          </details>
                        )}
                        <a
                          href={`https://youtube.com/watch?v=${evidence.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {evidence.channelTitle} · {evidence.videoTitle}
                        </a>
                      </div>
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
