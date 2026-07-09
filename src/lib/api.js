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
  // Разбираем сами через text(): при оборванном/пустом ответе res.json()
  // превращался в пустой объект, компоненты рисовали «результат» без данных
  // и падали в белый экран. Теперь это честная ошибка с текстом.
  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // не JSON — ниже отдадим понятную ошибку
  }
  if (!res.ok || !data || data.error) {
    throw new Error(
      data?.error || (res.ok ? "Сервер вернул неполный ответ — попробуйте ещё раз" : `Ошибка ${res.status}`)
    );
  }
  return data;
}
