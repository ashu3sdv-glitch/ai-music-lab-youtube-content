import { askClaudeJson, CHEAP_MODEL } from "./claude.js";
import { channelFilter, mapWithConcurrency, topicMatchScore } from "./topic-audience-utils.js";

const API = "https://www.googleapis.com/youtube/v3";
const CHANNEL_CONCURRENCY = 3;
const VIDEO_CONCURRENCY = 3;
const COMMENTS_PER_VIDEO = 20;
const MAX_EVIDENCE_FOR_CLAUDE = 320;

async function yt(path, params, key) {
  const url = new URL(`${API}/${path}`);
  Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `YouTube API ${response.status}`);
  return data;
}

export default async function audience(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "YOUTUBE_API_KEY не задан" });
  const sources = String(req.body?.channels || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 4);
  const researchType = req.body?.researchType === "business" ? "business" : "music";
  const researchQuery = String(req.body?.researchQuery || "").trim().slice(0, 300);
  const channelLanguages = req.body?.channelLanguages && typeof req.body.channelLanguages === "object"
    ? req.body.channelLanguages
    : {};
  if (!sources.length) return res.status(400).json({ error: "Добавьте хотя бы один YouTube-канал" });

  try {
    const channelResults = await mapWithConcurrency(sources, CHANNEL_CONCURRENCY, async (source) => {
      try {
        const audienceLanguage = ["ru", "en", "mixed"].includes(channelLanguages[source])
          ? channelLanguages[source]
          : "unknown";
        let quotaUsed = 0;
        const channelData = await yt("channels", {
          part: "snippet,contentDetails,statistics",
          ...channelFilter(source),
        }, key);
        quotaUsed += 1;
        const channel = channelData.items?.[0];
        if (!channel) return { evidence: [], quotaUsed, skipped: source };

        const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
        const playlist = await yt("playlistItems", {
          part: "snippet,contentDetails", playlistId: uploads, maxResults: "20",
        }, key);
        quotaUsed += 1;
        const ids = (playlist.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean);
        const details = await yt("videos", { part: "snippet,statistics", id: ids.join(",") }, key);
        quotaUsed += 1;
        const videos = (details.items || [])
          .map((video) => ({
            id: video.id,
            title: video.snippet?.title || "",
            description: video.snippet?.description || "",
            views: Number(video.statistics?.viewCount || 0),
            relevance: researchType === "business" ? topicMatchScore({
              title: video.snippet?.title,
              description: video.snippet?.description,
            }, researchQuery) : 0,
          }))
          .sort((a, b) => researchType === "business"
            ? b.relevance - a.relevance || b.views - a.views
            : b.views - a.views)
          .slice(0, 5);

        const commentResults = await mapWithConcurrency(videos, VIDEO_CONCURRENCY, async (video) => {
          try {
            const threads = await yt("commentThreads", {
              part: "snippet", videoId: video.id, maxResults: String(COMMENTS_PER_VIDEO),
              order: "relevance", textFormat: "plainText",
            }, key);
            return {
              quotaUsed: 1,
              evidence: (threads.items || []).flatMap((item) => {
                const snippet = item.snippet?.topLevelComment?.snippet;
                const text = snippet?.textDisplay?.trim();
                if (!text || text.length < 12) return [];
                return [{
                  text: text.slice(0, 800),
                  likes: Number(snippet.likeCount || 0),
                  videoId: video.id,
                  videoTitle: video.title,
                  channelTitle: channel.snippet?.title || "",
                  videoViews: video.views,
                  audienceLanguage,
                }];
              }),
            };
          } catch (error) {
            // Один закрытый или временно недоступный ролик не должен отменять
            // анализ остальных каналов.
            console.warn(`Не удалось прочитать комментарии ${video.id}:`, error.message);
            return { evidence: [], quotaUsed: 1 };
          }
        });

        return {
          evidence: commentResults.flatMap((result) => result.evidence),
          scannedChannel: { title: channel.snippet?.title, videoCount: videos.length, language: audienceLanguage },
          quotaUsed: quotaUsed + commentResults.reduce((sum, result) => sum + result.quotaUsed, 0),
        };
      } catch (error) {
        console.warn(`Не удалось обработать канал ${source}:`, error.message);
        return { evidence: [], quotaUsed: 0, skipped: source };
      }
    });

    const evidence = channelResults.flatMap((result) => result.evidence);
    const scannedChannels = channelResults.map((result) => result.scannedChannel).filter(Boolean);
    const skippedChannels = channelResults.map((result) => result.skipped).filter(Boolean);
    const quotaUsed = channelResults.reduce((sum, result) => sum + result.quotaUsed, 0);
    if (!evidence.length) throw new Error("Не удалось получить комментарии с указанных каналов");

    const usage = { input: 0, output: 0 };
    const compactEvidence = evidence
      .sort((a, b) => b.likes - a.likes || b.videoViews - a.videoViews)
      .slice(0, MAX_EVIDENCE_FOR_CLAUDE);
    const compact = compactEvidence.map((item, index) =>
      `[${index}] ${item.text} (аудитория: ${item.audienceLanguage || "unknown"}; лайков: ${item.likes}; ролик: ${item.videoTitle})`
    ).join("\n");
    const clustered = await askClaudeJson({
      usage,
      model: CHEAP_MODEL,
      maxTokens: 6000,
      system: researchType === "business"
        ? `Ты — исследователь реального применения AI и автоматизации в бизнесе. По комментариям под обучающими роликами и кейсами выявляй конкретные повторяющиеся рабочие проблемы людей: ручные операции, потерю времени, ошибки, сложности с рекламой, продажами, поддержкой, документами и данными. Для каждой подтверждённой боли предложи реалистичную идею автоматизации и объясни практическую ценность. Не придумывай внедрения, программы, клиентов, цифры или финансовый эффект. Отделяй свидетельство из комментария от своей гипотезы автоматизации. Игнорируй похвалу, спам и разговоры не по теме. Верни не более 10 тем и не более 3 commentIndexes для каждой. Английские комментарии переводи на русский. Верни строго JSON:
{"topics":[{"topic":"краткая тема","pain":"конкретная рабочая проблема","automationIdea":"какую автоматизацию можно предложить как гипотезу","businessValue":"чем это может помочь бизнесу без обещаний","audienceSignals":{"ru":"что подтверждает русскоязычная аудитория или пустая строка","en":"что подтверждает англоязычная аудитория или пустая строка","shared":"что совпадает у обеих аудиторий или пустая строка"},"commentIndexes":[0,1],"evidenceTranslations":["русский перевод"],"confidence":"high|medium","suggestedTitle":"профессиональный заголовок статьи LinkedIn"}]}`
        : `Ты — исследователь аудитории YouTube-канала об AI-музыке. Найди в комментариях реальные повторяющиеся боли, вопросы, непонимание интерфейса и запросы на обучение. Игнорируй похвалу, спам, просьбы оценить песню и разговоры не по теме. Не выдумывай частотность. Верни не более 10 тем и не более 3 commentIndexes для каждой темы. Формулировки делай краткими. Английские боли переводи в естественные русские темы роликов. Для каждого commentIndexes верни краткий точный русский перевод в evidenceTranslations в том же порядке. Русские комментарии оставляй без изменений. Не добавляй пояснений от себя. Верни строго JSON:
{"topics":[{"topic":"конкретная тема ролика","pain":"что не получается у зрителя","commentIndexes":[0,1],"evidenceTranslations":["русский перевод комментария 0","русский перевод комментария 1"],"confidence":"high|medium","suggestedTitle":"поисковый заголовок без кликбейта"}]}`,
      user: researchType === "business"
        ? `Точная тема исследования: ${researchQuery || "разные способы применения AI в реальном бизнесе"}. Сгруппируй только подтверждённые комментариями рабочие боли. Учитывай метки аудитории ru/en/mixed у комментариев. В audienceSignals отдельно покажи сигнал русскоязычной аудитории, англоязычной аудитории и реальное совпадение между ними; не выдумывай сравнение, если данных одной группы нет. Автоматизацию помечай как предлагаемую гипотезу, а не существующий факт. Максимум 10 тем и 3 доказательства на тему.\n\n${compact}`
        : `Сгруппируй комментарии. Верни максимум 10 тем, для каждой максимум 3 доказательства. Одна тема допустима только при наличии явного доказательства. Предпочитай боли, встретившиеся в нескольких комментариях или под сильными роликами.\n\n${compact}`,
    });
    const topics = (clustered.topics || []).slice(0, 15).map((topic) => {
      const items = (topic.commentIndexes || []).map((index) => compactEvidence[index]).filter(Boolean).slice(0, 5);
      const translations = Array.isArray(topic.evidenceTranslations) ? topic.evidenceTranslations : [];
      return {
        ...topic,
        evidence: items.map((item, index) => ({
          ...item,
          translatedText: translations[index] || item.text,
          translatedFromEnglish: !/[А-Яа-яЁё]/.test(item.text),
        })),
        mentions: items.length,
        score: topic.confidence === "high" ? 80 : 60,
      };
    });
    res.status(200).json({
      topics,
      scannedChannels,
      skippedChannels,
      commentsScanned: evidence.length,
      commentsAnalyzed: compactEvidence.length,
      researchType,
      quotaUsed,
      _usage: usage,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Ошибка анализа комментариев" });
  }
}
