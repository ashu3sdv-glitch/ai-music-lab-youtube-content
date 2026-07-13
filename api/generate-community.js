import { askClaude, extractJson, jsonHandler, bioBlock } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты готовишь посты для вкладки «Записи» (Community) канала AI Music Lab. Правила голоса и ограничения канала — в скилле content-youtube ниже. Следуй им точно.

# Скилл: content-youtube

${SKILLS.content_youtube}

---
ЗАДАЧА: 3 коротких поста для «Записей» — это анонсы ГЛАВНОГО Long-видео (не Shorts). Пост в «Записях» — это статичная картинка + текст + ссылка на видео, которая появляется в ленте у подписчиков за пару дней до/после выхода Long-ролика и должна заманить на просмотр именно его.

Каждый из трёх постов — под своим ракурсом: разная деталь сценария, разная интрига, разный акцент (например: личная история/эмоция → конкретный результат/цифра → неожиданный момент или ошибка). Не пересказывай один и тот же угол трижды разными словами — я должен получить три реально разных повода кликнуть.

В конце каждого поста — отдельной строкой плейсхолдер ссылки на видео: [ссылка на видео] (пользователь вручную заменит его на реальную ссылку после публикации).

Без упоминаний «AI», «нейросеть», без Suno-атрибуции.

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"posts": [{"angle": "краткое название ракурса поста (2-4 слова, для внутренней пометки)", "text": "текст поста, заканчивающийся строкой [ссылка на видео]"}]}`;

export default jsonHandler(async (body, usage) => {
  const { topic, script, synopsis, current, instruction, channelBio } = body;

  // Режим точечной правки одного поста.
  if (current && instruction) {
    const text = await askClaude({ usage,
      system: SYSTEM,
      user: `${bioBlock(channelBio)}Текущий пост (ракурс «${current.angle}»):\n\n${current.text}\n\nПерепиши его с учётом правки: «${instruction}». Сохрани плейсхолдер [ссылка на видео] в конце. Верни JSON с одним элементом в "posts".`,
      maxTokens: 1500,
    });
    return extractJson(text);
  }

  if (!topic && !script && !synopsis) throw new Error("Нет темы, пересказа или сценария главного ролика");
  const text = await askClaude({ usage,
    system: SYSTEM,
    user: `${bioBlock(channelBio)}Тема Long-видео: ${topic || "—"}\n\nКраткий пересказ: ${synopsis || "—"}\n\nСценарий (для деталей):\n${script ? script.slice(0, 6000) : "—"}\n\nНапиши 3 поста для «Записей» — анонсы этого Long-видео, каждый под своим ракурсом.`,
    maxTokens: 2500,
  });
  return extractJson(text);
});
