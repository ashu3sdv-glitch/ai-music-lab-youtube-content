import { askClaude, extractJson, jsonHandler } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты готовишь метаданные YouTube Long видео канала AI Music Lab. Твои рабочие инструкции — скиллы youtube-titles (заголовок) и content-youtube (описание, keywords, хэштеги, правила канала) ниже. Следуй им точно.

# Скилл: youtube-titles

${SKILLS.youtube_titles}

---
# Скилл: content-youtube

${SKILLS.content_youtube}

---
ЖЁСТКИЕ ПРАВИЛА КАНАЛА (из content-youtube, продублированы для надёжности):
- Не упоминать «AI», «нейросеть», «нейросети» в заголовке, описании и хэштегах.
- Не добавлять строку об AI-музыке / атрибуцию Suno.

СТРУКТУРА ОПИСАНИЯ:
- Основной текст описания.
- Если переданы ссылки — блок ссылок в едином формате: «Название: URL», каждая с новой строки.
- Блок Keywords (RU + EN) в теле описания.
- Хэштеги последней строкой.
- Место для таймкодов НЕ добавляй — они подставляются отдельно после монтажа.

ТАКЖЕ верни поле "synopsis" — краткий пересказ сути ролика в 2-3 предложениях простым языком (не для публикации, для внутреннего использования: по нему потом генерируются промпты обложек и посты для «Записей», поэтому он должен передавать конкретную суть и детали, а не общие слова).

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"title": "заголовок видео", "description": "полный текст описания с блоком ссылок (если есть), Keywords и хэштегами", "tags": "теги видео через запятую, суммарно до 500 символов (это поле метаданных YouTube, не блок Keywords)", "synopsis": "краткий пересказ сути ролика, 2-3 предложения"}`;

export default jsonHandler(async (body) => {
  const { topic, script, links, current, instruction } = body;

  const linksBlock =
    Array.isArray(links) && links.length
      ? `\n\nВставь в описание блок этих ссылок (в едином формате «Название: URL»):\n${links
          .map((l) => `${l.name}: ${l.url}`)
          .join("\n")}`
      : "";

  // Режим правки существующего описания.
  if (current && instruction) {
    const text = await askClaude({
      system: SYSTEM,
      user: `Текущие метаданные видео (тема: ${topic || "—"}):\n\nЗаголовок: ${current.title}\n\nОписание:\n${current.description}\n\nTags: ${current.tags}\n\nSynopsis: ${current.synopsis || "—"}\n\nПерепиши их с учётом правки: «${instruction}». Меняй только то, чего касается правка (synopsis меняй только если правка касается сути ролика — иначе верни его как есть).${linksBlock}`,
      maxTokens: 4000,
    });
    return extractJson(text);
  }

  if (!script) throw new Error("Нет финального текста сценария");
  const text = await askClaude({
    system: SYSTEM,
    user: `Тема видео: ${topic || "—"}\n\nФинальный сценарий видео:\n\n${script}${linksBlock}\n\nСгенерируй заголовок, описание, tags и synopsis.`,
    maxTokens: 4000,
  });
  return extractJson(text);
});
