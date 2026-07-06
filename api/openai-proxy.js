// OpenAI API не отдаёт CORS-заголовки для прямых запросов из браузера —
// fetch с фронтенда напрямую в api.openai.com падает с "Failed to fetch"
// ещё до получения ответа. Это тонкий прокси сервер-сервер (не подчиняется
// CORS): просто перекладывает запрос как есть, включая multipart-тело
// (images/edits, audio/transcriptions), не сохраняя и не логируя ключ —
// он транзитом идёт в заголовке из браузера и используется только в рамках
// этого одного запроса.
export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Только POST" });
    return;
  }

  const path = req.headers["x-openai-path"];
  const apiKey = req.headers["x-openai-key"];
  if (!path || !apiKey) {
    res.status(400).json({ error: "Не хватает заголовков X-OpenAI-Path / X-OpenAI-Key" });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyBuffer = Buffer.concat(chunks);

    const upstream = await fetch(`https://api.openai.com/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": req.headers["content-type"] || "application/json",
      },
      body: bodyBuffer,
    });

    const data = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(data);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || "Не удалось связаться с OpenAI" });
  }
}
