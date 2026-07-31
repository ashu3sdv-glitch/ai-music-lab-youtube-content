import { askClaudeJson, CHEAP_MODEL } from "./claude.js";

const API = "https://www.googleapis.com/youtube/v3";

async function yt(path, params, key) {
  const url = new URL(`${API}/${path}`);
  Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `YouTube API ${response.status}`);
  return data;
}

function channelFilter(value) {
  const raw = value.trim();
  const id = raw.match(/(?:channel\/)?(UC[\w-]{20,})/i)?.[1];
  if (id) return { id };
  const handle = raw.match(/@([\w.-]+)/)?.[1] || raw.replace(/^@/, "");
  return { forHandle: handle };
}

export default async function audience(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "YOUTUBE_API_KEY не задан" });
  const sources = String(req.body?.channels || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8);
  if (!sources.length) return res.status(400).json({ error: "Добавьте хотя бы один YouTube-канал" });

  try {
    const evidence = [];
    const scannedChannels = [];
    let quotaUsed = 0;
    for (const source of sources) {
      const channelData = await yt("channels", {
        part: "snippet,contentDetails,statistics",
        ...channelFilter(source),
      }, key);
      quotaUsed += 1;
      const channel = channelData.items?.[0];
      if (!channel) continue;
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
          views: Number(video.statistics?.viewCount || 0),
          comments: Number(video.statistics?.commentCount || 0),
          publishedAt: video.snippet?.publishedAt,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);
      scannedChannels.push({ title: channel.snippet?.title, videoCount: videos.length });

      for (const video of videos) {
        try {
          const threads = await yt("commentThreads", {
            part: "snippet", videoId: video.id, maxResults: "30", order: "relevance", textFormat: "plainText",
          }, key);
          quotaUsed += 1;
          for (const item of threads.items || []) {
            const snippet = item.snippet?.topLevelComment?.snippet;
            const text = snippet?.textDisplay?.trim();
            if (text && text.length >= 12) {
              evidence.push({
                text: text.slice(0, 800),
                likes: Number(snippet.likeCount || 0),
                videoId: video.id,
                videoTitle: video.title,
                channelTitle: channel.snippet?.title || "",
                videoViews: video.views,
              });
            }
          }
        } catch (error) {
          if (!/commentsDisabled/i.test(error.message)) throw error;
        }
      }
    }
    if (!evidence.length) throw new Error("Не удалось получить комментарии с указанных каналов");

    const usage = { input: 0, output: 0 };
    const compact = evidence.slice(0, 500).map((item, index) =>
      `[${index}] ${item.text} (лайков: ${item.likes}; ролик: ${item.videoTitle})`
    ).join("\n");
    const clustered = await askClaudeJson({
      usage,
      model: CHEAP_MODEL,
      maxTokens: 5000,
      system: `Ты — исследователь аудитории YouTube-канала об AI-музыке. Найди в комментариях реальные повторяющиеся боли, вопросы, непонимание интерфейса и запросы на обучение. Игнорируй похвалу, спам, просьбы оценить песню и разговоры не по теме. Не выдумывай частотность. Английские боли переводи в естественные русские темы роликов. Для каждого commentIndexes верни точный по смыслу русский перевод в evidenceTranslations в том же порядке. Русские комментарии оставляй без изменений. Не добавляй пояснений от себя. Верни строго JSON:
{"topics":[{"topic":"конкретная тема ролика","pain":"что не получается у зрителя","commentIndexes":[0,1],"evidenceTranslations":["русский перевод комментария 0","русский перевод комментария 1"],"confidence":"high|medium","suggestedTitle":"поисковый заголовок без кликбейта"}]}`,
      user: `Сгруппируй комментарии. Одна тема допустима только при наличии явного доказательства. Предпочитай боли, встретившиеся в нескольких комментариях или под сильными роликами.\n\n${compact}`,
    });
    const topics = (clustered.topics || []).slice(0, 15).map((topic) => {
      const items = (topic.commentIndexes || []).map((index) => evidence[index]).filter(Boolean).slice(0, 5);
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
    res.status(200).json({ topics, scannedChannels, commentsScanned: evidence.length, quotaUsed, _usage: usage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Ошибка анализа комментариев" });
  }
}
