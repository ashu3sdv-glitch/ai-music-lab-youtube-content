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

const DEPTH_RULES = `Пиши РАЗВЁРНУТО: каждый пункт списка — 2-4 полных предложения с конкретикой из видео (цифры, примеры, цитаты близко к тексту), а не одна строчка-ярлык. Видео может быть на любую тему (бизнес, психология, продуктивность, YouTube, музыка — что угодно) — извлекай пользу из той темы, которая есть, не подгоняй всё под музыку.`;

const INSIGHTS_FIELD = `"insights": ["ЦЕННЫЕ ИДЕИ И ПРИНЦИПЫ: 4-8 пунктов — принципы бизнеса, мышления, роста канала или личного развития из этого видео, каждый сформулирован так, чтобы его можно было применить: принцип + как именно применить автору. Это самый важный блок ответа."]`;

const SYSTEMS = {
  summary: `Ты анализируешь YouTube-видео по его метаданным и транскрипту для автора YouTube-канала (контекст о канале — в начале сообщения, если задан). Твоя задача — выжать из видео максимум пользы: и содержание, и применимые уроки.

${DEPTH_RULES}

${JSON_RULES}

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"about": "о чём видео: развёрнуто, 4-6 предложений — суть, главный аргумент, к чему приходит автор",
 "key_points": ["тезис с объяснением и примером из видео", "... всего 5-10 развёрнутых тезисов"],
 ${INSIGHTS_FIELD},
 "audience": "для кого это видео: уровень, интересы, что зритель хочет получить",
 "note": "если анализ ограничен (нет субтитров/усечён транскрипт) — одно предложение об этом, иначе пустая строка"}`,
  competitor: `Ты — аналитик YouTube-канала (контекст о канале автора — в начале сообщения, если задан). Разбираешь чужое видео как конкурентное: что в нём работает на удержание и клик, что стоит взять себе — и какие более общие принципы (контент-стратегия, бизнес, психология зрителя) из него можно извлечь.

${DEPTH_RULES} Без общих фраз вроде «качественный контент» — только конкретные наблюдения с примерами.

${JSON_RULES}

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"hook": "что происходит в первые 15-30 секунд, дословно чем открывается видео и почему это цепляет (или не цепляет) — развёрнуто",
 "structure": ["блок 1: что происходит, зачем, как переходит в следующий", "... по реальной структуре ролика"],
 "retention": ["приём удержания внимания с конкретным примером из видео и объяснением, почему работает", "... 3-6 приёмов"],
 "cta": "какие призывы к действию, где стоят, как сформулированы",
 "takeaways": ["что конкретно позаимствовать автору: приём + как применить на его канале — 4-7 развёрнутых пунктов"],
 ${INSIGHTS_FIELD},
 "note": "если анализ ограничен (нет субтитров/усечён транскрипт) — одно предложение об этом, иначе пустая строка"}`,
};

export default jsonHandler(async (body) => {
  const { url, mode = "summary", channelBio, manualTranscript } = body;
  const videoId = parseVideoId(url);
  if (!videoId) throw new Error("Не удалось распознать ссылку на YouTube");
  const system = SYSTEMS[mode] || SYSTEMS.summary;

  const meta = await fetchMeta(videoId);
  // Ручная вставка субтитров — приоритетный источник: YouTube всё чаще
  // блокирует автоматическую выдачу субтитров датацентровым IP Vercel.
  const manual = (manualTranscript || "").replace(/\s+/g, " ").trim();
  const rawTranscript = manual || (await fetchTranscript(videoId));
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
    maxTokens: 8000,
  });
  const analysis = extractJson(text);

  return {
    meta,
    analysis,
    transcriptStatus: transcript ? (manual ? "manual" : truncated ? "truncated" : "full") : "none",
  };
});
