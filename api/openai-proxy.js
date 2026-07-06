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
export const maxDuration = 60;

export async function POST(request) {
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
