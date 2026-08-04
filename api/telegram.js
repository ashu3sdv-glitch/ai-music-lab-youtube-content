const TELEGRAM_BASE = "https://api.telegram.org";

function reply(res, status, body) {
  res.status(status).json(body);
}

async function telegram(botToken, method, options = {}) {
  const response = await fetch(`${TELEGRAM_BASE}/bot${botToken}/${method}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API: ошибка ${response.status}`);
  }
  return data.result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return reply(res, 405, { ok: false, error: "Метод не поддерживается" });
  const { action, botToken, chatId, text, image, buttonUrl, buttonText } = req.body || {};
  if (!botToken) return reply(res, 400, { ok: false, error: "Не указан токен Telegram-бота" });

  try {
    if (action === "test") {
      const bot = await telegram(botToken, "getMe");
      return reply(res, 200, { ok: true, bot: { id: bot.id, username: bot.username, name: bot.first_name } });
    }
    if (action !== "send") return reply(res, 400, { ok: false, error: "Неизвестное действие" });
    if (!chatId || !text) return reply(res, 400, { ok: false, error: "Нужны ID канала и текст поста" });

    const replyMarkup = buttonUrl
      ? JSON.stringify({ inline_keyboard: [[{ text: buttonText || "Смотреть видео", url: buttonUrl }]] })
      : undefined;
    let result;
    if (image?.startsWith("data:image/")) {
      const match = image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (!match) throw new Error("Некорректный формат картинки");
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("caption", text.slice(0, 1024));
      form.append("photo", new Blob([Buffer.from(match[2], "base64")], { type: match[1] }), "post.jpg");
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
    return reply(res, 200, { ok: true, messageId: result.message_id });
  } catch (error) {
    return reply(res, 502, { ok: false, error: error.message || "Не удалось обратиться к Telegram" });
  }
}
