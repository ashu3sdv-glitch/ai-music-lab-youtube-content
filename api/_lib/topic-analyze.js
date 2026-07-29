const API_BASE = "https://www.googleapis.com/youtube/v3";

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function calculateScore({ medianViews, medianSubs, freshShare, exactMatchCount }) {
  const demand = clamp((Math.log10(medianViews + 1) / 6) * 100);
  const competition = clamp(100 - (Math.log10(medianSubs + 1) / 6) * 100);
  const freshness = clamp(freshShare * 100);
  const gap = clamp(100 - exactMatchCount * 12);
  return Math.round(demand * 0.4 + competition * 0.3 + freshness * 0.2 + gap * 0.1);
}

async function youtube(path, params, apiKey) {
  const url = new URL(`${API_BASE}/${path}`);
  Object.entries({ ...params, key: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    const error = new Error(data?.error?.message || `YouTube API: ${response.status}`);
    error.status = response.status;
    error.reason = reason;
    throw error;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Только POST" });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "YOUTUBE_API_KEY не задан в переменных окружения Vercel" });
    return;
  }

  const query = String(req.body?.query || "").trim();
  if (!query) {
    res.status(400).json({ error: "Не указан поисковый запрос" });
    return;
  }

  try {
    const search = await youtube(
      "search",
      {
        part: "snippet",
        q: query,
        type: "video",
        maxResults: "10",
        regionCode: req.body?.regionCode || "RU",
        relevanceLanguage: req.body?.relevanceLanguage || "ru",
        order: "relevance",
      },
      apiKey
    );

    const found = search.items || [];
    const ids = found.map((item) => item.id?.videoId).filter(Boolean);
    if (!ids.length) {
      res.status(200).json({
        query,
        topVideos: [],
        metrics: { medianViews: 0, medianSubs: 0, freshShare: 0, exactMatchCount: 0, viewsToSubsRatio: 0 },
        score: 0,
      });
      return;
    }

    const [videos, channels] = await Promise.all([
      youtube("videos", { part: "statistics,contentDetails", id: ids.join(",") }, apiKey),
      youtube(
        "channels",
        {
          part: "statistics",
          id: [...new Set(found.map((item) => item.snippet?.channelId).filter(Boolean))].join(","),
        },
        apiKey
      ),
    ]);

    const videoById = new Map((videos.items || []).map((item) => [item.id, item]));
    const subsByChannel = new Map(
      (channels.items || []).map((item) => [
        item.id,
        item.statistics?.hiddenSubscriberCount ? null : Number(item.statistics?.subscriberCount || 0),
      ])
    );
    const normalizedQuery = normalize(query);
    const freshSince = new Date();
    freshSince.setMonth(freshSince.getMonth() - 6);

    const topVideos = found.map((item) => {
      const detail = videoById.get(item.id.videoId);
      const publishedAt = item.snippet?.publishedAt;
      return {
        videoId: item.id.videoId,
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt,
        viewCount: Number(detail?.statistics?.viewCount || 0),
        subscriberCount: subsByChannel.get(item.snippet?.channelId) ?? null,
        duration: detail?.contentDetails?.duration || "",
        titleMatch: normalize(item.snippet?.title).includes(normalizedQuery),
        fresh: publishedAt ? new Date(publishedAt) >= freshSince : false,
      };
    });

    const medianViews = median(topVideos.map((video) => video.viewCount));
    const medianSubs = median(topVideos.map((video) => video.subscriberCount).filter((value) => value !== null));
    const freshShare = topVideos.filter((video) => video.fresh).length / topVideos.length;
    const exactMatchCount = topVideos.filter((video) => video.titleMatch).length;
    const viewsToSubsRatio = medianSubs > 0 ? medianViews / medianSubs : 0;
    const metrics = { medianViews, medianSubs, freshShare, exactMatchCount, viewsToSubsRatio };

    res.status(200).json({ query, topVideos, metrics, score: calculateScore(metrics) });
  } catch (error) {
    if (error.reason === "quotaExceeded" || error.reason === "dailyLimitExceeded") {
      res.status(429).json({ error: "Квота YouTube Data API исчерпана", code: "quotaExceeded" });
      return;
    }
    if (error.status === 403) {
      res.status(403).json({
        error: "Проверь YOUTUBE_API_KEY и включён ли YouTube Data API v3 в Google Cloud",
        code: "forbidden",
      });
      return;
    }
    console.error(error);
    res.status(500).json({ error: error.message || "Ошибка YouTube API" });
  }
}
