import { askClaude, extractJson, jsonHandler } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты готовишь посты для вкладки «Записи» (Community) канала AI Music Lab. Правила голоса и ограничения канала — в скилле content-youtube ниже. Следуй им точно.

# Скилл: content-youtube

${SKILLS.content_youtube}

---
ЗАДАЧА: 3 коротких поста для «Записей». Каждый пост — тизер/анонс, связанный с темой главного Long-видео, и каждый из трёх — под своим ракурсом (разный угол/деталь/акцент, не пересказ одного и того же тремя способами). Если пост привязан к конкретному Shorts — тизерь именно его ракурс. Без упоминаний «AI», «нейросеть», без Suno-атрибуции.

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"posts": [{"shortsTopic": "тема Shorts, к которому привязан пост (или краткое название ракурса, если Shorts не задан)", "text": "текст поста"}]}
Порядок постов — тот же, что порядок тем Shorts в запросе.`;

export default jsonHandler(async (body) => {
  const { topic, script, synopsis, shortsTopics, current, instruction } = body;

  // Режим точечной правки одного поста.
  if (current && instruction) {
    const text = await askClaude({
      system: SYSTEM,
      user: `Текущий пост (привязан к Shorts «${current.shortsTopic}»):\n\n${current.text}\n\nПерепиши его с учётом правки: «${instruction}». Верни JSON с одним элементом в "posts".`,
      maxTokens: 1500,
    });
    return extractJson(text);
  }

  if (!topic && !script && !synopsis) throw new Error("Нет темы, пересказа или сценария главного ролика");
  const topicsList =
    Array.isArray(shortsTopics) && shortsTopics.length
      ? shortsTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(темы Shorts не заданы — придумай 3 разных ракурса из сценария/пересказа)";
  const text = await askClaude({
    system: SYSTEM,
    user: `Тема Long-видео: ${topic || "—"}\n\nКраткий пересказ: ${synopsis || "—"}\n\nСценарий (для деталей):\n${script ? script.slice(0, 6000) : "—"}\n\nТемы трёх Shorts:\n${topicsList}\n\nНапиши 3 поста для «Записей», каждый под своим ракурсом.`,
    maxTokens: 2500,
  });
  return extractJson(text);
});
