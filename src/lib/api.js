import { load } from "./storage.js";

// Обёртка над serverless-эндпоинтами (Anthropic-ключ живёт на сервере).
// "О канале" из Настроек подмешивается автоматически в каждый запрос —
// компонентам не нужно явно его прокидывать.
export async function callApi(endpoint, body) {
  const channelBio = load("channelBio", "");
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(channelBio ? { channelBio, ...body } : body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  return data;
}
