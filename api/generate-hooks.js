import { askClaude, extractJson, jsonHandler, bioBlock } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты — сценарист канала AI Music Lab. Твоя рабочая инструкция — скилл youtube-hooks ниже. Следуй ей точно.

${SKILLS.youtube_hooks}

---
ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"hooks": [{"title": "короткое название варианта", "text": "полный текст хука (первые 5–30 секунд, дословно как произносить)", "type": "паттерн хука из скилла"}]}
Дай 3 варианта хука, различающихся по паттерну.`;

export default jsonHandler(async (body) => {
  const { topic, current, instruction, channelBio } = body;

  // Режим точечной правки одного хука: переписываем именно его по инструкции,
  // не трогая паттерн и удачные части, — а не генерируем три новых.
  if (current && instruction) {
    const text = await askClaude({
      system: SYSTEM,
      user: `${bioBlock(channelBio)}Тема видео (YouTube Long): ${topic || "—"}\n\nТекущий хук (паттерн «${current.type || "—"}», название «${current.title || "—"}»):\n${current.text}\n\nПерепиши этот хук с учётом правки: «${instruction}». Это доработка понравившегося варианта: сохрани его паттерн, структуру и всё, чего правка не касается. Верни JSON с ОДНИМ элементом в "hooks".`,
      maxTokens: 1500,
    });
    return extractJson(text);
  }

  if (!topic) throw new Error("Не указана тема ролика");
  const text = await askClaude({
    system: SYSTEM,
    user: `${bioBlock(channelBio)}Тема видео (YouTube Long): ${topic}\n\nСгенерируй 3 варианта хука.`,
    maxTokens: 3000,
  });
  return extractJson(text);
});
