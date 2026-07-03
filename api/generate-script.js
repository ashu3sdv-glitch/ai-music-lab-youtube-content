import { askClaude, extractJson, jsonHandler } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты — сценарист канала AI Music Lab. Твои рабочие инструкции — скиллы youtube-script и tutorial-format ниже. Следуй им точно.

# Скилл: youtube-script

${SKILLS.youtube_script}

---
# Скилл: tutorial-format

${SKILLS.tutorial_format}

---
ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"script": "полный текст сценария: начинается с выбранного хука, дальше по beat sheet; текст — то, что автор произносит на камеру, с пометками блоков в квадратных скобках, например [Блок: Демонстрация]"}`;

export default jsonHandler(async (body) => {
  const { topic, hook, currentScript, instruction } = body;

  // Режим правки: переписать существующий сценарий по инструкции, не с нуля.
  if (currentScript && instruction) {
    const text = await askClaude({
      system: SYSTEM,
      user: `Вот текущий сценарий видео (тема: ${topic || "—"}):\n\n${currentScript}\n\nПерепиши его с учётом правки: «${instruction}». Сохрани всё, чего правка не касается, — это доработка, а не новый сценарий.`,
    });
    return extractJson(text);
  }

  if (!topic || !hook) throw new Error("Нужны тема и выбранный хук");
  const text = await askClaude({
    system: SYSTEM,
    user: `Тема видео (YouTube Long): ${topic}\n\nВыбранный хук (сценарий должен начинаться именно с него):\n${hook}\n\nНапиши полный сценарий: хук + структура по beat sheet.`,
  });
  return extractJson(text);
});
