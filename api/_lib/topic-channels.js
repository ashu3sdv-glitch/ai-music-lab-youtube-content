const API = "https://www.googleapis.com/youtube/v3";
const TEACHING = /(как|обзор|урок|обуч|инструк|гайд|ошиб|tutorial|guide|how to|tips|workflow|review)/iu;

async function yt(path, params, key) {
  const url = new URL(`${API}/${path}`);
  Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `YouTube API ${response.status}`);
  return data;
}

export default async function discoverChannels(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "YOUTUBE_API_KEY не задан" });
  const query = String(req.body?.query || "Suno создание музыки").trim();
  if (!query) return res.status(400).json({ error: "Укажите направление поиска" });
  try {
    const byChannel = new Map();
    for (const q of [`${query} как пользоваться обучение`, `${query} tutorial how to`]) {
      const data = await yt("search", {
        part: "snippet", q, type: "video", maxResults: "25", order: "relevance",
        relevanceLanguage: q.includes("tutorial") ? "en" : "ru",
      }, key);
      for (const item of data.items || []) {
        const channelId = item.snippet?.channelId;
        if (!channelId) continue;
        const current = byChannel.get(channelId) || {
          channelId, title: item.snippet?.channelTitle || "", examples: [], teachingHits: 0,
        };
        const title = item.snippet?.title || "";
        if (!current.examples.includes(title) && current.examples.length < 3) current.examples.push(title);
        if (TEACHING.test(title)) current.teachingHits += 1;
        byChannel.set(channelId, current);
      }
    }
    const ids = [...byChannel.keys()];
    if (!ids.length) return res.status(200).json({ channels: [], quotaUsed: 2 });
    const details = await yt("channels", {
      part: "snippet,statistics", id: ids.join(","), maxResults: "50",
    }, key);
    const channels = (details.items || []).map((channel) => {
      const found = byChannel.get(channel.id);
      return {
        channelId: channel.id,
        url: `https://youtube.com/channel/${channel.id}`,
        title: channel.snippet?.title || found.title,
        subscribers: channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount || 0),
        examples: found.examples,
        teachingHits: found.teachingHits,
        score: found.teachingHits * 10 + found.examples.length,
      };
    }).filter((channel) => channel.teachingHits > 0)
      .sort((a, b) => b.score - a.score || (b.subscribers || 0) - (a.subscribers || 0))
      .slice(0, 12);
    res.status(200).json({ channels, quotaUsed: 3 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Ошибка поиска каналов" });
  }
}
