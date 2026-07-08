import { YoutubeTranscript } from "youtube-transcript";
import { askClaude, extractJson, jsonHandler, bioBlock } from "./_lib/claude.js";

// Анализатор YouTube-видео: ссылка → метаданные (YouTube Data API v3) +
// транскрипт (внутренний timedtext API) → структурированный разбор от Claude.
// Claude не смотрит видео — работает только с текстом, поэтому без субтитров
// анализ честно помечается как ограниченный.

// --- 1. Video ID из любых форматов ссылки ---
function parseVideoId(url) {
  const m = String(url || "")
    .trim()
    .match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// --- 2. Метаданные через YouTube Data API v3 ---
async function fetchMeta(videoId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY не задан в переменных окружения Vercel");
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${key}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `YouTube API: ошибка ${res.status}`);
  const item = data.items?.[0];
  if (!item) throw new Error("Видео не найдено — возможно, оно приватное или удалено");
  const sn = item.snippet || {};
  return {
    title: sn.title || "",
    channel: sn.channelTitle || "",
    publishedAt: (sn.publishedAt || "").slice(0, 10),
    description: sn.description || "",
    tags: sn.tags || [],
    duration: isoDuration(item.contentDetails?.duration || ""),
    views: Number(item.statistics?.viewCount || 0),
    likes: Number(item.statistics?.likeCount || 0),
  };
}

// PT1H2M3S → "1:02:03"
function isoDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const [h, min, s] = [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
  const mm = h ? String(min).padStart(2, "0") : String(min);
  return `${h ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

// --- 3. Транскрипт (может быть недоступен — это не фатально) ---
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchTranscript(videoId) {
  const attempts = [{ lang: "ru" }, undefined, { lang: "en" }];
  for (const cfg of attempts) {
    try {
      const parts = await YoutubeTranscript.fetchTranscript(videoId, cfg);
      const text = decodeEntities(parts.map((p) => p.text).join(" ")).replace(/\s+/g, " ").trim();
      if (text) return text;
    } catch {
      // пробуем следующий вариант языка
    }
  }
  return null;
}

// --- 4. Усечение длинных транскриптов: первые 40% + последние 15% ---
const MAX_CHARS = 60000; // ~15к токенов для русского текста
function truncateTranscript(text) {
  if (text.length <= MAX_CHARS) return { text, truncated: false };
  const head = text.slice(0, Math.floor(MAX_CHARS * 0.72));
  const tail = text.slice(-Math.floor(MAX_CHARS * 0.28));
  return {
    text: `${head}\n\n[...середина видео пропущена из-за длины...]\n\n${tail}`,
    truncated: true,
  };
}

// --- 5. Режимы анализа: разные системные промпты, один вызов ---
const JSON_RULES = `Внутри строковых значений JSON не используй прямые двойные кавычки — только «ёлочки». Отвечай по-русски.`;

const SYSTEMS = {
  summary: `Ты анализируешь YouTube-видео по его метаданным и транскрипту для автора канала AI Music Lab. Дай краткое, конкретное содержание — без воды и общих слов.

${JSON_RULES}

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"about": "о чём видео, 2-3 предложения по сути",
 "key_points": ["тезис 1", "тезис 2", "... всего 3-6 конкретных тезисов с фактами/приёмами из видео"],
 "audience": "для кого это видео: уровень, интересы, что зритель хочет получить",
 "note": "если анализ ограничен (нет субтитров/усечён транскрипт) — одно предложение об этом, иначе пустая строка"}`,
  competitor: `Ты — аналитик YouTube-канала AI Music Lab (обучающие видео про создание музыки в Suno). Разбираешь чужое видео как конкурентное: что в нём работает на удержание и клик, что стоит взять себе. Пиши конкретно, с примерами из транскрипта, без общих фраз вроде «качественный контент».

${JSON_RULES}

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"hook": "что происходит в первые 15-30 секунд и почему это цепляет (или не цепляет)",
 "structure": ["блок 1: что происходит и зачем", "блок 2: ...", "... по реальной структуре ролика"],
 "retention": ["приём удержания внимания 1", "... 2-5 приёмов с примерами из видео"],
 "cta": "какие призывы к действию и где они стоят",
 "takeaways": ["что конкретно позаимствовать для AI Music Lab — 3-5 пунктов, применимых к нашим темам"],
 "note": "если анализ ограничен (нет субтитров/усечён транскрипт) — одно предложение об этом, иначе пустая строка"}`,
};

export default jsonHandler(async (body) => {
  const { url, mode = "summary", channelBio } = body;
  const videoId = parseVideoId(url);
  if (!videoId) throw new Error("Не удалось распознать ссылку на YouTube");
  const system = SYSTEMS[mode] || SYSTEMS.summary;

  const meta = await fetchMeta(videoId);
  const rawTranscript = await fetchTranscript(videoId);
  const { text: transcript, truncated } = rawTranscript
    ? truncateTranscript(rawTranscript)
    : { text: null, truncated: false };

  const metaBlock = [
    `Название: ${meta.title}`,
    `Канал: ${meta.channel}`,
    `Опубликовано: ${meta.publishedAt}, длительность: ${meta.duration}, просмотры: ${meta.views}`,
    meta.tags.length ? `Теги: ${meta.tags.slice(0, 20).join(", ")}` : "",
    `Описание:\n${meta.description.slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const transcriptBlock = transcript
    ? `Транскрипт (субтитры)${truncated ? " — УСЕЧЁН: первые ~40% и последние ~15%" : ""}:\n${transcript}`
    : "Транскрипт НЕДОСТУПЕН (у видео нет субтитров или YouTube отказал в выдаче) — анализируй только по метаданным и честно отрази это ограничение в note.";

  const text = await askClaude({
    system,
    user: `${bioBlock(channelBio)}${metaBlock}\n\n${transcriptBlock}\n\nСделай анализ.`,
    maxTokens: 4000,
  });
  const analysis = extractJson(text);

  return {
    meta,
    analysis,
    transcriptStatus: transcript ? (truncated ? "truncated" : "full") : "none",
  };
});
