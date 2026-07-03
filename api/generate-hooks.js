import { askClaude, extractJson, jsonHandler } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты — сценарист канала AI Music Lab. Твоя рабочая инструкция — скилл youtube-hooks ниже. Следуй ей точно.

${SKILLS.youtube_hooks}

---
ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"hooks": [{"title": "короткое название варианта", "text": "полный текст хука (первые 5–30 секунд, дословно как произносить)", "type": "паттерн хука из скилла"}]}
Дай 3 варианта хука, различающихся по паттерну.`;

export default jsonHandler(async (body) => {
  const { topic } = body;
  if (!topic) throw new Error("Не указана тема ролика");
  const text = await askClaude({
    system: SYSTEM,
    user: `Тема видео (YouTube Long): ${topic}\n\nСгенерируй 3 варианта хука.`,
    maxTokens: 3000,
  });
  return extractJson(text);
});
