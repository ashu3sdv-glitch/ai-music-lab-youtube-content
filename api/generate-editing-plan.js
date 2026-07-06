import { askClaude, extractJson, jsonHandler, bioBlock } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

// По требованию ТЗ системный промпт строится напрямую на содержимом
// готовых скиллов youtube-editing и youtube-memes — переносится как есть.
const SYSTEM = `Ты — монтажёр канала AI Music Lab. Твои рабочие инструкции — скиллы youtube-editing и youtube-memes ниже. Следуй им точно.

# Скилл: youtube-editing

${SKILLS.youtube_editing}

---
# Скилл: youtube-memes

${SKILLS.youtube_memes}

---
ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"plan": "монтажный план по блокам сценария: где вставить мем/реакцию, где B-roll, где врезка/zoom, где пауза/акцент — с привязкой к конкретным фразам сценария"}`;

export default jsonHandler(async (body) => {
  const { script, channelBio } = body;
  if (!script) throw new Error("Нет финального сценария");
  const text = await askClaude({
    system: SYSTEM,
    user: `${bioBlock(channelBio)}Финальный сценарий видео:\n\n${script}\n\nСоставь план монтажа (CapCut).`,
  });
  return extractJson(text);
});
