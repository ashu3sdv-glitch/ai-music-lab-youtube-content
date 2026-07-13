import { askClaude, extractJson, jsonHandler, bioBlock } from "./_lib/claude.js";
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

ТАКЖЕ верни поле "titleB" — второй вариант заголовка для A/Б-теста в YouTube Studio. Он должен цеплять ЗА СЧЁТ ДРУГОГО УГЛА, а не быть синонимичной перефразировкой title (например: title через факт/цифру, titleB через вопрос/провокацию — или наоборот). Оба заголовка следуют правилам скилла youtube-titles.

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"title": "заголовок видео — вариант A", "titleB": "заголовок видео — вариант Б, другой угол подачи", "description": "полный текст описания с блоком ссылок (если есть), Keywords и хэштегами", "tags": "теги видео через запятую, суммарно до 500 символов (это поле метаданных YouTube, не блок Keywords)", "synopsis": "краткий пересказ сути ролика, 2-3 предложения"}`;

export default jsonHandler(async (body, usage) => {
  const { topic, script, links, current, instruction, channelBio } = body;

  const linksBlock =
    Array.isArray(links) && links.length
      ? `\n\nВставь в описание блок этих ссылок (в едином формате «Название: URL»):\n${links
          .map((l) => `${l.name}: ${l.url}`)
          .join("\n")}`
      : "";

  // Режим правки существующего описания.
  if (current && instruction) {
    const text = await askClaude({ usage,
      system: SYSTEM,
      user: `${bioBlock(channelBio)}Текущие метаданные видео (тема: ${topic || "—"}):\n\nЗаголовок A: ${current.title}\n\nЗаголовок Б: ${current.titleB || "—"}\n\nОписание:\n${current.description}\n\nTags: ${current.tags}\n\nSynopsis: ${current.synopsis || "—"}\n\nПерепиши их с учётом правки: «${instruction}». Меняй только то, чего касается правка (synopsis и titleB меняй только если правка явно их касается — иначе верни как есть).${linksBlock}`,
      maxTokens: 4000,
    });
    return extractJson(text);
  }

  if (!script) throw new Error("Нет финального текста сценария");
  const text = await askClaude({ usage,
    system: SYSTEM,
    user: `${bioBlock(channelBio)}Тема видео: ${topic || "—"}\n\nФинальный сценарий видео:\n\n${script}${linksBlock}\n\nСгенерируй title, titleB, описание, tags и synopsis.`,
    maxTokens: 4000,
  });
  return extractJson(text);
});
