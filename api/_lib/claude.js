import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// Вызывает Claude с системным промптом (контент скилла + обвязка) и возвращает текст.
export async function askClaude({ system, user, maxTokens = 8000 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY не задан в переменных окружения Vercel");
  }
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

// Короткое "о себе/о канале" от автора — если задано, добавляется первым
// блоком в user-сообщение каждого эндпоинта, чтобы контент был точнее
// про этот конкретный канал, а не обезличенный.
export function bioBlock(channelBio) {
  return channelBio && channelBio.trim()
    ? `О канале (контекст от автора, учитывай при генерации): ${channelBio.trim()}\n\n`
    : "";
}

// Вырезает JSON из ответа модели (модель может обернуть его в ```json ... ```).
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("В ответе модели нет JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// Общая обвязка HTTP-обработчика: только POST, JSON-ответ, ошибки в JSON.
export function jsonHandler(fn) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Только POST" });
      return;
    }
    try {
      const result = await fn(req.body || {});
      res.status(200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "Внутренняя ошибка" });
    }
  };
}
