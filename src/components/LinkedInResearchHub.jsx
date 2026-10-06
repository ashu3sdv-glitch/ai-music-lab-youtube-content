import { useState } from "react";
import BusinessAudienceResearch from "./BusinessAudienceResearch.jsx";
import { callApi } from "../lib/api.js";
import BuildReportImport from "./BuildReportImport.jsx";

const SOURCES = [
  {
    id: "audit",
    title: "Разбор бизнеса и рекламы",
    description: "Вставьте готовый анализ из вашего рекламного сервиса.",
  },
  {
    id: "youtube",
    title: "Тема из YouTube",
    description: "Найдите реальные вопросы предпринимателей и идеи автоматизации.",
  },
  {
    id: "news",
    title: "Новость AI или рекламы",
    description: "Добавьте важную новость и объясните её пользу для бизнеса.",
  },
  {
    id: "build",
    title: "Недельный отчёт о запуске",
    description: "Превратите Build Report в честный выпуск серии о создании AI-бизнеса.",
  },
];

const EMPTY_AUDIT = { title: "", url: "", text: "" };
const EMPTY_NEWS = { title: "", url: "", publishedAt: "", text: "", angle: "" };

export default function LinkedInResearchHub({ research, setResearch, onCreateFromOpportunity, onCreateFromSource, busy, history = [] }) {
  const [source, setSource] = useState("audit");
  const [audit, setAudit] = useState(EMPTY_AUDIT);
  const [news, setNews] = useState(EMPTY_NEWS);
  const [newsMode, setNewsMode] = useState("digest");
  const [newsFocus, setNewsFocus] = useState("products");
  const [digest, setDigest] = useState("");
  const [digestItems, setDigestItems] = useState([]);
  const [digestBusy, setDigestBusy] = useState("");
  const [error, setError] = useState("");

  function submitAudit() {
    if (!audit.title.trim()) return setError("Укажите название компании или разбора");
    if (!audit.text.trim()) return setError("Вставьте готовый анализ из рекламного сервиса");
    setError("");
    onCreateFromSource({
      title: audit.title,
      sourceType: "site_review",
      sourceUrl: audit.url,
      sourceText: audit.text,
      contentMode: "site_review",
      tags: ["бизнес", "реклама", "разбор"],
    });
  }

  function submitNews() {
    if (!news.title.trim()) return setError("Укажите заголовок новости");
    if (!news.url.trim()) return setError("Добавьте ссылку на первоисточник новости");
    if (!news.text.trim()) return setError("Вставьте текст или подробное содержание новости");
    setError("");
    const sourceText = [
      `Новость: ${news.title.trim()}`,
      news.publishedAt ? `Дата публикации: ${news.publishedAt}` : "",
      `Содержание источника:\n${news.text.trim()}`,
      news.angle.trim() ? `Предварительный практический угол автора:\n${news.angle.trim()}` : "",
      "Задача: объяснить практическое значение новости для предпринимателей. Не придумывать результаты внедрения или факты, которых нет в источнике.",
    ].filter(Boolean).join("\n\n");
    onCreateFromSource({
      title: news.title,
      sourceType: "ai_news",
      sourceUrl: news.url,
      sourceText,
      publishedAt: news.publishedAt,
      contentMode: "ai_news",
      tags: ["AI", "реклама", "новости"],
    });
  }

  async function parseDigest() {
    if (!digest.trim()) return setError("Вставьте недельную подборку из ChatGPT");
    setDigestBusy("Разбираю подборку…");
    setError("");
    try {
      const response = await callApi("generate-linkedin", { mode: "parse_news_digest", sourceText: digest });
      const items = Array.isArray(response.items) ? response.items : [];
      if (!items.length) throw new Error("Не удалось выделить новости. Проверьте текст подборки и повторите попытку");
      setDigestItems(items);
    } catch (err) {
      setError(err.message || "Не удалось разобрать подборку");
    } finally {
      setDigestBusy("");
    }
  }

  async function searchNews() {
    setDigestBusy("Ищу свежие новости…");
    setError("");
    try {
      const response = await callApi("generate-linkedin", { mode: "search_news", focus: newsFocus });
      const items = Array.isArray(response.items) ? response.items : [];
      if (!items.length) throw new Error("Свежие новости не найдены. Попробуйте другое направление");
      setDigestItems(items);
    } catch (err) {
      setError(err.message || "Не удалось загрузить официальные новостные ленты");
    } finally {
      setDigestBusy("");
    }
  }

  function selectDigestItem(item) {
    const details = [
      item.summary,
      item.business_impact ? `Значение для бизнеса:\n${item.business_impact}` : "",
      item.claims_to_verify?.length ? `Требует проверки:\n${item.claims_to_verify.map((claim) => `- ${claim}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
    setNews({
      title: item.title || "",
      url: item.source_url || "",
      publishedAt: item.published_at || "",
      text: details,
      angle: item.suggested_angle || "",
    });
    setNewsMode("single");
    setError("");
  }

  return (
    <div>
      <div className="card linkedin-rhythm">
        <strong>Единая система LinkedIn · одна сильная публикация в неделю</strong>
        <div className="muted small">Чередуйте: Build in Public → разбор бизнеса → тема из YouTube → важная новость. Сильный недельный отчёт можно выпускать чаще, если в нём есть новый результат или решение.</div>
      </div>

      <div className="linkedin-source-grid">
        {SOURCES.map((item, index) => (
          <button key={item.id} className={`linkedin-source-card ${source === item.id ? "active" : ""}`} onClick={() => { setSource(item.id); setError(""); }}>
            <span className="linkedin-source-number">{index + 1}</span>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>

      {source === "audit" && (
        <div className="card">
          <div className="card-head"><strong>Готовый разбор из рекламного сервиса</strong><span className="muted small">Сайт здесь повторно не анализируется</span></div>
          <div className="linkedin-settings-grid">
            <div className="field"><label>Компания или название разбора</label><input value={audit.title} onChange={(event) => setAudit({ ...audit, title: event.target.value })} placeholder="Например: разбор сайта туристического агентства" /></div>
            <div className="field"><label>Ссылка на сайт — необязательно</label><input value={audit.url} onChange={(event) => setAudit({ ...audit, url: event.target.value })} placeholder="https://…" /></div>
          </div>
          <div className="field"><label>Анализ из рекламного сервиса</label><textarea className="linkedin-source" value={audit.text} onChange={(event) => setAudit({ ...audit, text: event.target.value })} placeholder="Вставьте сюда полный результат разбора…" /></div>
          <button onClick={submitAudit} disabled={!!busy}>{busy || "Подготовить статью и обложку"}</button>
          {error && <div className="error">{error}</div>}
        </div>
      )}

      {source === "youtube" && (
        <BusinessAudienceResearch state={research} setState={setResearch} onCreatePost={onCreateFromOpportunity} />
      )}

      {source === "build" && <BuildReportImport history={history} onCreate={onCreateFromSource} />}

      {source === "news" && (
        <div className="card">
          <div className="card-head"><strong>Важная новость об AI или рекламе</strong><span className="muted small">Используйте первоисточник, а не пересказ без ссылки</span></div>
          <div className="topic-mode-tabs linkedin-news-mode">
            <button className={newsMode === "automatic" ? "" : "secondary"} onClick={() => { setNewsMode("automatic"); setError(""); }}>Собрать автоматически</button>
            <button className={newsMode === "digest" ? "" : "secondary"} onClick={() => { setNewsMode("digest"); setError(""); }}>Недельная подборка ChatGPT</button>
            <button className={newsMode === "single" ? "" : "secondary"} onClick={() => { setNewsMode("single"); setError(""); }}>Одна новость вручную</button>
          </div>

          {newsMode === "automatic" && <>
            <div className="linkedin-settings-grid">
              <div className="field"><label>Направление новостей</label><select value={newsFocus} onChange={(event) => setNewsFocus(event.target.value)}>
                <option value="products">Новые AI-продукты и обновления</option>
                <option value="advertising">AI в рекламе и маркетинге</option>
                <option value="automation">Автоматизация реального бизнеса</option>
              </select></div>
              <div className="research-context">Новости бесплатно загружаются из официальных лент OpenAI, Google AI и Microsoft, затем заголовки и описания переводятся на русский одним запросом Claude. Обычно показываются свежие публикации за последние 45 дней.</div>
            </div>
            <button onClick={searchNews} disabled={!!digestBusy || !!busy}>{digestBusy || "Собрать и перевести подборку"}</button>
            {digestItems.length > 0 && <div className="linkedin-news-results">
              <div className="card-head"><strong>Выберите одну новость — {digestItems.length}</strong></div>
              {digestItems.map((item, index) => <article className="linkedin-news-card" key={`${item.title}-${index}`}>
                <strong>{item.title}</strong><p>{item.summary}</p>
                <div className="muted small">{[item.published_at, item.source_url].filter(Boolean).join(" · ")}</div>
                <button onClick={() => selectDigestItem(item)}>Выбрать эту новость</button>
              </article>)}
            </div>}
          </>}

          {newsMode === "digest" && <>
            <div className="field"><label>Вся подборка из задачи ChatGPT</label><textarea className="linkedin-source" value={digest} onChange={(event) => setDigest(event.target.value)} placeholder="Скопируйте и вставьте сюда весь недельный выпуск…" /></div>
            <button onClick={parseDigest} disabled={!!digestBusy || !!busy}>{digestBusy || "Разобрать подборку"}</button>
            {digestItems.length > 0 && <div className="linkedin-news-results">
              <div className="card-head"><strong>Выберите одну новость — {digestItems.length}</strong></div>
              {digestItems.map((item, index) => <article className="linkedin-news-card" key={`${item.title}-${index}`}>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                {item.business_impact && <div><strong>Для бизнеса:</strong> {item.business_impact}</div>}
                <div className="muted small">{[item.published_at, item.source_url].filter(Boolean).join(" · ") || "Дата и источник требуют проверки"}</div>
                <button onClick={() => selectDigestItem(item)}>Выбрать эту новость</button>
              </article>)}
            </div>}
          </>}

          {newsMode === "single" && <>
          <div className="linkedin-settings-grid">
            <div className="field"><label>Заголовок новости</label><input value={news.title} onChange={(event) => setNews({ ...news, title: event.target.value })} /></div>
            <div className="field"><label>Ссылка на первоисточник</label><input value={news.url} onChange={(event) => setNews({ ...news, url: event.target.value })} placeholder="https://…" /></div>
            <div className="field"><label>Дата новости</label><input type="date" value={news.publishedAt} onChange={(event) => setNews({ ...news, publishedAt: event.target.value })} /></div>
            <div className="field"><label>Практический угол — необязательно</label><input value={news.angle} onChange={(event) => setNews({ ...news, angle: event.target.value })} placeholder="Что это меняет для предпринимателя или рекламы?" /></div>
          </div>
          <div className="field"><label>Текст или подробное содержание новости</label><textarea className="linkedin-source" value={news.text} onChange={(event) => setNews({ ...news, text: event.target.value })} /></div>
          <button onClick={submitNews} disabled={!!busy}>{busy || "Подготовить статью и обложку"}</button>
          </>}
          {error && <div className="error">{error}</div>}
        </div>
      )}
    </div>
  );
}
