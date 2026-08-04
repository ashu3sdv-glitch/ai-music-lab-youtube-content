export async function telegramRequest(payload) {
  const res = await fetch("/api/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Telegram: ошибка ${res.status}`);
  return data;
}

export function testTelegram(botToken) {
  return telegramRequest({ action: "test", botToken });
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
