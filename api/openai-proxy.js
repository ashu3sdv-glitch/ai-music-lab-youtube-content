// OpenAI API не отдаёт CORS-заголовки для прямых запросов из браузера —
// fetch с фронтенда напрямую в api.openai.com падает с "Failed to fetch"
// ещё до получения ответа. Это тонкий прокси сервер-сервер (не подчиняется
// CORS): просто перекладывает запрос как есть, включая multipart-тело
// (images/edits, audio/transcriptions), не сохраняя и не логируя ключ —
// он транзитом идёт в заголовке из браузера и используется только в рамках
// этого одного запроса.
//
// Сигнатура Web API (Request/Response), а не классическая (req, res):
// это официально задокументированный у Vercel способ получить СЫРОЕ тело
// запроса (await request.arrayBuffer()) без риска, что платформа уже
// распарсила/потребила поток за нас — что произошло бы с классическим
// req.body в обычной (не Next.js) serverless-функции.
//
// maxDuration для этой функции задан в vercel.json (api/openai-proxy.js →
// 300 сек) — export const maxDuration в самом файле работает только для
// Next.js и в обычном проекте (наш случай) молча игнорируется.

const TELEGRAM_BASE = "https://api.telegram.org";

async function telegram(botToken, method, options = {}) {
  const response = await fetch(`${TELEGRAM_BASE}/bot${botToken}/${method}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram API: ошибка ${response.status}`);
  return data.result;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function handleTelegram(request) {
  const { action, botToken, chatId, text, image, buttonUrl, buttonText } = await request.json();
  if (!botToken) return jsonResponse({ ok: false, error: "Не указан токен Telegram-бота" }, 400);
  try {
    if (action === "test") {
      const bot = await telegram(botToken, "getMe");
      return jsonResponse({ ok: true, bot: { id: bot.id, username: bot.username, name: bot.first_name } });
    }
    if (action !== "send") return jsonResponse({ ok: false, error: "Неизвестное действие" }, 400);
    if (!chatId || !text) return jsonResponse({ ok: false, error: "Нужны ID канала и текст поста" }, 400);

    const replyMarkup = buttonUrl
      ? JSON.stringify({ inline_keyboard: [[{ text: buttonText || "Смотреть видео", url: buttonUrl }]] })
      : undefined;
    let result;
    if (image?.startsWith("data:image/")) {
      const match = image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (!match) throw new Error("Некорректный формат картинки");
      const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("caption", text.slice(0, 1024));
      form.append("photo", new Blob([bytes], { type: match[1] }), "post.jpg");
      if (replyMarkup) form.append("reply_markup", replyMarkup);
      result = await telegram(botToken, "sendPhoto", { method: "POST", body: form });
      if (text.length > 1024) {
        result = await telegram(botToken, "sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: text.slice(1024) }),
        });
      }
    } else {
      result = await telegram(botToken, "sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup ? JSON.parse(replyMarkup) : undefined }),
      });
    }
    return jsonResponse({ ok: true, messageId: result.message_id });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || "Не удалось обратиться к Telegram" }, 502);
  }
}

export async function POST(request) {
  if (request.headers.get("x-proxy-service") === "telegram") return handleTelegram(request);
  const path = request.headers.get("x-openai-path");
  const apiKey = request.headers.get("x-openai-key");
  if (!path || !apiKey) {
    return new Response(JSON.stringify({ error: "Не хватает заголовков X-OpenAI-Path / X-OpenAI-Key" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const bodyBuffer = await request.arrayBuffer();
    const upstream = await fetch(`https://api.openai.com/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
      body: bodyBuffer,
    });

    const data = await upstream.arrayBuffer();
    return new Response(data, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Не удалось связаться с OpenAI" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
