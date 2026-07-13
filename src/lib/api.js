import { load, save } from "./storage.js";

// Счётчик расходов Claude: суммируем _usage каждого ответа в дневной итог
// (localStorage) и шлём событие — бейдж в шапке App его слушает.
function trackUsage(u) {
  try {
    const key = `claudeUsage.${new Date().toISOString().slice(0, 10)}`;
    const today = load(key, { cost: 0, calls: 0 });
    today.cost += u.cost || 0;
    today.calls += 1;
    save(key, today);
    window.dispatchEvent(new CustomEvent("claude-usage", { detail: { last: u.cost || 0, today: today.cost, calls: today.calls } }));
  } catch {
    // счётчик не должен ломать основную работу
  }
}

export function usageToday() {
  return load(`claudeUsage.${new Date().toISOString().slice(0, 10)}`, { cost: 0, calls: 0 });
}

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
  if (data._usage) trackUsage(data._usage);
  return data;
}
