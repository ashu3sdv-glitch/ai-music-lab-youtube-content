// Обёртка над serverless-эндпоинтами (Anthropic-ключ живёт на сервере).
export async function callApi(endpoint, body) {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  return data;
}
