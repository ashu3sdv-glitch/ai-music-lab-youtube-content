import { askClaude, extractJson, jsonHandler } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты создаёшь промпт для генерации обложки (image prompt) канала AI Music Lab. Твоя рабочая инструкция — скилл thumbnail-canva ниже. Следуй ей точно.

# Скилл: thumbnail-canva

${SKILLS.thumbnail_canva}

---
ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"prompt": "готовый промпт на английском для OpenAI Images API: композиция, стиль, свет, эмоция, текст на обложке (если нужен — коротко и по-русски), с учётом указанного соотношения сторон"}`;

const FORMAT_NOTES = {
  "16:9": "YouTube Long thumbnail, горизонтальная 16:9, композиция под мелкий размер превью",
  "9:16": "YouTube Shorts cover, вертикальная 9:16, ключевой объект в центре (верх и низ перекрывается UI)",
  "1:1": "Community post image, квадрат 1:1",
};

export default jsonHandler(async (body) => {
  const { topic, aspect = "16:9", context } = body;
  if (!topic) throw new Error("Не указана тема для обложки");
  const text = await askClaude({
    system: SYSTEM,
    user: `Тема: ${topic}\n\nФормат: ${FORMAT_NOTES[aspect] || aspect}${context ? `\n\nКонтекст (заголовок/описание):\n${context}` : ""}\n\nСгенерируй промпт обложки.`,
    maxTokens: 1500,
  });
  return extractJson(text);
});
