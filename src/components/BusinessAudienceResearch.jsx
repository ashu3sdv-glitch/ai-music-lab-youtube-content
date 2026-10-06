import { useState } from "react";
import { callApi } from "../lib/api.js";
import {
  normalizeBusinessOpportunity,
  selectBalancedChannels,
  selectedChannelLanguages,
} from "../../shared/business-research.js";

const DEFAULT_RESEARCH = {
  channelQueryRu: "AI-автоматизация в бизнесе реальные кейсы",
  channelQueryEn: "AI automation for business case studies",
  topicQuery: "AI-автоматизация рутинных бизнес-процессов",
  channels: "",
  channelLanguages: {},
  candidates: [],
  selected: [],
  topics: [],
  meta: null,
};

export default function BusinessAudienceResearch({ state, setState, onCreatePost }) {
  const data = { ...DEFAULT_RESEARCH, ...(state || {}) };
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function patch(next) {
    setState((current) => ({ ...DEFAULT_RESEARCH, ...(current || {}), ...next }));
  }

  async function run(label, task) {
    setBusy(label);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(err.message || "Не удалось выполнить исследование");
    } finally {
      setBusy("");
    }
  }

  function discover() {
    return run("Ищу каналы с кейсами…", async () => {
      if (!data.channelQueryRu.trim() || !data.channelQueryEn.trim()) throw new Error("Укажите запросы для двух языков");
      const response = await callApi("topics?action=discover-channels", {
        query: data.channelQueryRu.trim(),
        englishQuery: data.channelQueryEn.trim(),
      });
      const candidates = response.channels || [];
      patch({
        candidates,
        selected: selectBalancedChannels(candidates),
      });
    });
  }

  function useSelected() {
    const selectedCandidates = data.candidates.filter((channel) => data.selected.includes(channel.channelId));
    patch({
      channels: selectedCandidates.map((channel) => channel.url).join("\n"),
      channelLanguages: selectedChannelLanguages(data.candidates, data.selected),
    });
  }

  function analyze() {
    return run("Изучаю комментарии и бизнес-боли…", async () => {
      if (!data.channels.trim()) throw new Error("Выберите или добавьте хотя бы один канал");
      if (!data.topicQuery.trim()) throw new Error("Укажите тему для анализа");
      const response = await callApi("topics?action=audience", {
        channels: data.channels,
        channelLanguages: data.channelLanguages,
        researchType: "business",
        researchQuery: data.topicQuery,
      });
      patch({
        topics: (response.topics || []).map(normalizeBusinessOpportunity),
        meta: {
          channels: response.scannedChannels || [],
          comments: response.commentsScanned || 0,
          analyzedComments: response.commentsAnalyzed || 0,
          quota: response.quotaUsed || 0,
          skippedChannels: response.skippedChannels || [],
        },
      });
    });
  }

  const groups = [
    { key: "ru", title: "Русскоязычные каналы", items: data.candidates.filter((channel) => channel.language === "ru") },
    { key: "en", title: "Англоязычные каналы, включая американские", items: data.candidates.filter((channel) => channel.language === "en") },
    { key: "mixed", title: "Каналы, найденные в обоих поисках", items: data.candidates.filter((channel) => !["ru", "en"].includes(channel.language)) },
  ].filter((group) => group.items.length > 0);

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <div>
            <strong>Поиск бизнес-болей и AI-автоматизаций</strong>
            <div className="muted small">Находит обучающие каналы и реальные проблемы людей в комментариях. Идеи автоматизации показываются как гипотезы.</div>
          </div>
        </div>

        <div className="linkedin-settings-grid">
          <div className="field">
            <label>Поиск русскоязычных каналов</label>
            <input
              value={data.channelQueryRu}
              onChange={(event) => patch({ channelQueryRu: event.target.value })}
              placeholder="AI-автоматизация в бизнесе реальные кейсы"
              disabled={!!busy}
            />
          </div>
          <div className="field">
            <label>Поиск англоязычных каналов</label>
            <input
              value={data.channelQueryEn}
              onChange={(event) => patch({ channelQueryEn: event.target.value })}
              placeholder="AI automation for business case studies"
              disabled={!!busy}
            />
          </div>
        </div>
        <button onClick={discover} disabled={!!busy}>{busy === "Ищу каналы с кейсами…" ? busy : "Найти русские и англоязычные каналы"}</button>

        {data.candidates.length > 0 && (
          <div className="channel-candidates">
            <div className="card-head">
              <strong>Найденные каналы — {data.candidates.length}</strong>
              <button className="secondary" onClick={useSelected} disabled={!!busy || !data.selected.length}>
                Использовать выбранные ({data.selected.length})
              </button>
            </div>
            {groups.map((group) => (
              <div className="channel-language-group" key={group.key}>
                <div className="muted small channel-language-title">{group.title} — {group.items.length}</div>
                {group.items.map((channel) => (
                  <label className="channel-candidate" key={channel.channelId}>
                    <input
                      type="checkbox"
                      checked={data.selected.includes(channel.channelId)}
                      onChange={(event) => patch({
                        selected: event.target.checked
                          ? [...data.selected, channel.channelId].slice(0, 4)
                          : data.selected.filter((id) => id !== channel.channelId),
                      })}
                    />
                    <span>
                      <strong>{channel.title}</strong>
                      <span className="muted small">
                        {channel.country ? `${channel.country} · ` : ""}
                        {channel.subscribers == null ? "подписчики скрыты" : `${channel.subscribers.toLocaleString("ru-RU")} подписчиков`}
                      </span>
                      <span className="small">{channel.examples?.[0]}</span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="field">
          <label>Ссылки на YouTube-каналы — максимум 4</label>
          <textarea
            className="channel-input"
            value={data.channels}
            onChange={(event) => patch({ channels: event.target.value })}
            placeholder={"https://youtube.com/@channel-one\nhttps://youtube.com/@channel-two"}
            disabled={!!busy}
          />
        </div>
        <div className="field">
          <label>Тема, по которой искать боли в выбранных каналах</label>
          <input
            list="business-topic-options"
            value={data.topicQuery}
            onChange={(event) => patch({ topicQuery: event.target.value })}
            placeholder="Введите любую тему"
            disabled={!!busy}
          />
          <datalist id="business-topic-options">
            <option value="Автоматизация обработки заявок и поддержки клиентов" />
            <option value="AI для рекламы и создания рекламных креативов" />
            <option value="Автоматизация продаж и работы с CRM" />
            <option value="Обработка документов и отчётности с помощью AI" />
            <option value="Внутренние AI-помощники для сотрудников" />
            <option value="Создание собственных AI-приложений для бизнеса" />
          </datalist>
        </div>
        <button onClick={analyze} disabled={!!busy}>Найти боли и возможности автоматизации</button>
        {busy && <div className="busy">{busy}</div>}
        {error && <div className="error">{error}</div>}
        {data.meta && (
          <div className="muted small" style={{ marginTop: 8 }}>
            Каналов: {data.meta.channels.length} · найдено комментариев: {data.meta.comments}
            {data.meta.analyzedComments ? ` · проанализировано: ${data.meta.analyzedComments}` : ""}
            {` · квота анализа: ~${data.meta.quota}`}
          </div>
        )}
      </div>

      {data.topics.length > 0 && (
        <div className="pain-grid">
          {data.topics.map((item, index) => (
            <article className="card pain-card" key={`${item.topic}-${index}`}>
              <div className="card-head">
                <strong>{item.topic}</strong>
                <span className={`topic-badge ${item.confidence === "high" ? "good" : "warn"}`}>
                  {item.confidence === "high" ? "сильный сигнал" : "есть сигнал"}
                </span>
              </div>
              <p><strong>Боль:</strong> {item.pain}</p>
              <p><strong>Идея автоматизации:</strong> {item.automationIdea}</p>
              <p><strong>Чем может помочь:</strong> {item.businessValue}</p>
              {(item.audienceSignals.ru || item.audienceSignals.en || item.audienceSignals.shared) && (
                <div className="audience-comparison">
                  {item.audienceSignals.ru && <div><strong>Русскоязычная аудитория:</strong> {item.audienceSignals.ru}</div>}
                  {item.audienceSignals.en && <div><strong>Англоязычная аудитория:</strong> {item.audienceSignals.en}</div>}
                  {item.audienceSignals.shared && <div><strong>Совпадает:</strong> {item.audienceSignals.shared}</div>}
                </div>
              )}
              <div className="muted small">Предлагаемый заголовок: {item.suggestedTitle}</div>
              <details>
                <summary>Доказательства из комментариев ({item.mentions})</summary>
                <div className="pain-evidence">
                  {item.evidence.map((evidence, evidenceIndex) => (
                    <div className="pain-evidence-item" key={`${evidence.videoId}-${evidenceIndex}`}>
                      <strong>«{evidence.translatedText || evidence.text}»</strong>
                      <a href={`https://youtube.com/watch?v=${evidence.videoId}`} target="_blank" rel="noreferrer">
                        {evidence.channelTitle} · {evidence.videoTitle}
                      </a>
                    </div>
                  ))}
                </div>
              </details>
              <button onClick={() => onCreatePost(item, data.topicQuery)} disabled={!!busy}>Подготовить статью и обложку</button>
            </article>
          ))}
        </div>
      )}
      {data.meta && data.topics.length === 0 && (
        <div className="card saved-topics-empty">
          <strong>По этой теме подтверждённых болей не найдено</strong>
          <div className="muted small">
            Выберите другие каналы или сформулируйте тему шире. Система не придумывает боли, которых нет в комментариях.
          </div>
        </div>
      )}
    </div>
  );
}
