export const OFFICIAL_NEWS_FEEDS = [
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { name: "Google AI", url: "https://blog.google/innovation-and-ai/technology/ai/rss/" },
  { name: "Microsoft Source", url: "https://news.microsoft.com/source/feed/" },
];

const FOCUS_WORDS = {
  products: ["launch", "release", "update", "model", "product", "agent", "запуск", "обновлен", "модел", "продукт", "агент"],
  advertising: ["advert", "marketing", "campaign", "brand", "commerce", "реклам", "маркет", "бренд", "продаж"],
  automation: ["automat", "workflow", "business", "enterprise", "customer", "автомат", "бизнес", "процесс", "клиент"],
};

function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/gu, " ")
    .trim();
}

function tag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "iu"));
    if (match) return decodeXml(match[1]);
  }
  return "";
}

function itemLink(block) {
  const direct = tag(block, ["link", "guid"]);
  if (/^https?:\/\//iu.test(direct)) return direct;
  const atom = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/iu);
  return atom && /^https?:\/\//iu.test(atom[1]) ? decodeXml(atom[1]) : "";
}

export function parseOfficialFeed(xml, source = "") {
  const blocks = String(xml || "").match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/giu) || [];
  return blocks.map((block) => ({
    title: tag(block, ["title"]).slice(0, 300),
    source_url: itemLink(block),
    published_at: tag(block, ["pubDate", "published", "updated"]).slice(0, 80),
    summary: tag(block, ["description", "summary", "content:encoded", "content"]).slice(0, 1_500),
    source,
  })).filter((item) => item.title && item.source_url && item.summary);
}

export function selectOfficialNews(items = [], focus = "products", now = new Date()) {
  const words = FOCUS_WORDS[focus] || FOCUS_WORDS.products;
  const oldest = now.getTime() - 45 * 24 * 60 * 60 * 1000;
  const seen = new Set();
  return items.map((item) => {
    const timestamp = Date.parse(item.published_at) || 0;
    const haystack = `${item.title} ${item.summary}`.toLocaleLowerCase();
    const relevance = words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
    return { ...item, timestamp, relevance };
  }).filter((item) => {
    if (item.timestamp && item.timestamp < oldest) return false;
    const key = item.source_url.replace(/^https?:\/\/(www\.)?/iu, "").replace(/\/$/u, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.relevance - a.relevance || b.timestamp - a.timestamp)
    .slice(0, 8)
    .map(({ timestamp: _timestamp, relevance: _relevance, source, ...item }) => ({
      ...item,
      summary: `${source}: ${item.summary}`,
      business_impact: "",
      suggested_angle: "Объяснить, что изменилось и какую практическую возможность или риск это создаёт для бизнеса.",
      claims_to_verify: ["Перед публикацией проверить детали по официальному первоисточнику."],
    }));
}
