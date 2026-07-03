import { askClaude, extractJson, jsonHandler } from "./_lib/claude.js";
import { SKILLS } from "./_lib/skills.js";

const SYSTEM = `Ты готовишь YouTube Shorts канала AI Music Lab. Твои рабочие инструкции — скиллы content-shorts (описание, правила канала) и youtube-titles (заголовки) ниже. Следуй им точно.

# Скилл: content-shorts

${SKILLS.content_shorts}

---
# Скилл: youtube-titles

${SKILLS.youtube_titles}

---
ЖЁСТКИЕ ПРАВИЛА КАНАЛА: без упоминаний «AI», «нейросеть», без Suno-атрибуции в описаниях.

ФОРМАТ ОТВЕТА: верни строго JSON без пояснений:
{"shorts": [{"topic": "тема, как её передали", "titles": ["вариант заголовка 1", "вариант заголовка 2"], "description": "описание Shorts с хэштегами"}]}
Порядок элементов в "shorts" — тот же, что порядок тем в запросе.`;

export default jsonHandler(async (body) => {
  const { topics, links, current, instruction } = body;

  const linksBlock =
    Array.isArray(links) && links.length
      ? `\n\nВставь в описание блок этих ссылок (формат «Название: URL»):\n${links
          .map((l) => `${l.name}: ${l.url}`)
          .join("\n")}`
      : "";

  // Режим точечной правки одной карточки.
  if (current && instruction) {
    const text = await askClaude({
      system: SYSTEM,
      user: `Текущая карточка Shorts:\nТема: ${current.topic}\nЗаголовки: ${JSON.stringify(current.titles)}\nОписание:\n${current.description}\n\nПерепиши её с учётом правки: «${instruction}». Меняй только то, чего касается правка. Верни JSON с одним элементом в "shorts".${linksBlock}`,
      maxTokens: 2500,
    });
    return extractJson(text);
  }

  if (!Array.isArray(topics) || !topics.length) {
    throw new Error("Не указаны темы Shorts");
  }
  const text = await askClaude({
    system: SYSTEM,
    user: `Темы Shorts:\n${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}${linksBlock}\n\nНа каждую тему: описание + 2 варианта заголовка.`,
    maxTokens: 4000,
  });
  return extractJson(text);
});
