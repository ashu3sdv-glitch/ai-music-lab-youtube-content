export async function telegramRequest(payload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);
  let res;
  try {
    res = await fetch("/api/openai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Proxy-Service": "telegram" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Telegram не ответил за 45 секунд. Попробуйте ещё раз");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Telegram: ошибка ${res.status}`);
  return data;
}

export function testTelegram(botToken, chatId) {
  return telegramRequest({ action: "test", botToken, chatId });
}

export function sendTelegramPost({ botToken, chatId, text, image, videoUrl }) {
  return telegramRequest({
    action: "send",
    botToken,
    chatId,
    text,
    image,
    buttonUrl: videoUrl || "",
    buttonText: "Смотреть полное видео",
  });
}
