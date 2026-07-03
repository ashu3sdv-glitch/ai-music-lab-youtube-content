import { askClaude, extractJson, jsonHandler } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты готовишь посты для вкладки «Записи» (Community) канала AI Music Lab. Правила голоса и ограничения канала — в скилле content-youtube ниже. Следуй им точно.

# Скилл: content-youtube

${SKILLS.content_youtube}

---
ЗАДАЧА: 3 коротких поста для «Записей». Каждый пост — тизер/анонс соответствующего Shorts, связанный с темой главного Long-видео. Без упоминаний «AI», «нейросеть», без Suno-атрибуции.

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"posts": [{"shortsTopic": "тема Shorts, к которому привязан пост", "text": "текст поста"}]}
Порядок постов — тот же, что порядок тем Shorts в запросе.`;

export default jsonHandler(async (body) => {
  const { topic, script, shortsTopics, current, instruction } = body;

  // Режим точечной правки одного поста.
  if (current && instruction) {
    const text = await askClaude({
      system: SYSTEM,
      user: `Текущий пост (привязан к Shorts «${current.shortsTopic}»):\n\n${current.text}\n\nПерепиши его с учётом правки: «${instruction}». Верни JSON с одним элементом в "posts".`,
      maxTokens: 1500,
    });
    return extractJson(text);
  }

  if (!topic && !script) throw new Error("Нет темы или сценария главного ролика");
  const topicsList =
    Array.isArray(shortsTopics) && shortsTopics.length
      ? shortsTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(темы Shorts не заданы — придумай 3 ракурса из сценария)";
  const text = await askClaude({
    system: SYSTEM,
    user: `Тема Long-видео: ${topic || "—"}\n\nСценарий (для контекста):\n${script ? script.slice(0, 6000) : "—"}\n\nТемы трёх Shorts:\n${topicsList}\n\nНапиши 3 поста для «Записей».`,
    maxTokens: 2500,
  });
  return extractJson(text);
});
