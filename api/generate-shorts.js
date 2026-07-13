import { askClaude, extractJson, jsonHandler, bioBlock } from "./_lib/claude.js";
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
  const { topics, links, current, instruction, channelBio } = body;

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
      user: `${bioBlock(channelBio)}Текущая карточка Shorts:\nТема: ${current.topic}\nЗаголовки: ${JSON.stringify(current.titles)}\nОписание:\n${current.description}\n\nПерепиши её с учётом правки: «${instruction}». Меняй только то, чего касается правка. Верни JSON с одним элементом в "shorts".${linksBlock}`,
      maxTokens: 2500,
    });
    return extractJson(text);
  }

  // Режим конвейера: тем ещё нет — сами выбираем 3 сильных момента из сценария Long.
  if (body.fromScript) {
    const { topic, script, synopsis } = body.fromScript;
    if (!script || !script.trim()) throw new Error("Нет сценария Long-видео");
    const text = await askClaude({
      system: SYSTEM,
      user: `${bioBlock(channelBio)}Готовим нарезку Shorts из готового Long-видео.\n\nТема Long: ${topic || "—"}\nКраткий пересказ: ${synopsis || "—"}\n\nСценарий:\n${script.slice(0, 8000)}\n\nПРАВИЛО ВЫБОРА ТЕМ (главное): если в сценарии есть явные шаги урока ([Шаг 1: …], [Шаг 2: …], [Шаг 3: …] или нумерованные приёмы) — Shorts соответствуют им СТРОГО один к одному и в том же порядке: Shorts #1 = Шаг 1, Shorts #2 = Шаг 2, Shorts #3 = Шаг 3. Тема каждого Shorts — конкретный приём этого шага и его результат. Вступление/хук, блок «проблема» и финал НЕ используются как тема Shorts ни при каких условиях. И только если явных шагов в сценарии нет — выбери 3 самых сильных самодостаточных момента из ОСНОВНОЙ обучающей части (по-прежнему не из вступления).\n\nДля каждого: поле "topic" — короткая формулировка темы по-русски (она же пойдёт в обложку), плюс описание и 2 варианта заголовка по правилам скилла. Верни JSON с тремя элементами в "shorts".${linksBlock}`,
      maxTokens: 4000,
    });
    return extractJson(text);
  }

  if (!Array.isArray(topics) || !topics.length) {
    throw new Error("Не указаны темы Shorts");
  }
  const text = await askClaude({
    system: SYSTEM,
    user: `${bioBlock(channelBio)}Темы Shorts:\n${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}${linksBlock}\n\nНа каждую тему: описание + 2 варианта заголовка.`,
    maxTokens: 4000,
  });
  return extractJson(text);
});
