import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// Цены модели за миллион токенов (USD) — для счётчика расходов в шапке приложения.
const PRICE_PER_MTOK = { input: 3, output: 15 };

// Вызывает Claude с системным промптом (контент скилла + обвязка) и возвращает текст.
// usage — необязательный коллектор: в него суммируются потраченные токены вызова,
// jsonHandler превращает их в поле _usage ответа (счётчик стоимости на фронте).
export async function askClaude({ system, user, maxTokens = 8000, usage }) {
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
  if (usage && response.usage) {
    usage.input += response.usage.input_tokens || 0;
    usage.output += response.usage.output_tokens || 0;
  }
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export function usageCost(usage) {
  return (usage.input * PRICE_PER_MTOK.input + usage.output * PRICE_PER_MTOK.output) / 1e6;
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
// Вторым аргументом fn получает коллектор usage — если endpoint передал его
// в askClaude, в ответ добавляется _usage (токены и стоимость вызова).
export function jsonHandler(fn) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Только POST" });
      return;
    }
    const usage = { input: 0, output: 0 };
    try {
      const result = await fn(req.body || {}, usage);
      if (result && typeof result === "object" && !Array.isArray(result) && usage.input > 0) {
        result._usage = { ...usage, cost: usageCost(usage) };
      }
      res.status(200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "Внутренняя ошибка" });
    }
  };
}
