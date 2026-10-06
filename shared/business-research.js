function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBusinessOpportunity(value = {}) {
  return {
    topic: text(value.topic),
    pain: text(value.pain),
    automationIdea: text(value.automationIdea),
    businessValue: text(value.businessValue),
    audienceSignals: {
      ru: text(value.audienceSignals?.ru),
      en: text(value.audienceSignals?.en),
      shared: text(value.audienceSignals?.shared),
    },
    suggestedTitle: text(value.suggestedTitle),
    confidence: value.confidence === "high" ? "high" : "medium",
    mentions: Number(value.mentions || 0),
    evidence: Array.isArray(value.evidence) ? value.evidence.slice(0, 3) : [],
  };
}

export function buildLinkedInSourceFromOpportunity(value, researchQuery = "") {
  const item = normalizeBusinessOpportunity(value);
  const evidence = item.evidence.map((entry, index) => {
    const quote = text(entry.translatedText || entry.text);
    const source = entry.videoId ? `https://youtube.com/watch?v=${entry.videoId}` : "источник не указан";
    return `${index + 1}. Комментарий: «${quote}»\nИсточник: ${source}`;
  }).join("\n\n");

  return [
    "Исследование потребности бизнеса по комментариям YouTube.",
    researchQuery ? `Направление поиска: ${text(researchQuery)}` : "",
    `Тема: ${item.topic}`,
    `Подтверждённая боль: ${item.pain}`,
    `Предлагаемая автоматизация (гипотеза): ${item.automationIdea}`,
    `Возможная польза для бизнеса (гипотеза): ${item.businessValue}`,
    item.audienceSignals.ru ? `Сигнал русскоязычной аудитории: ${item.audienceSignals.ru}` : "",
    item.audienceSignals.en ? `Сигнал англоязычной аудитории: ${item.audienceSignals.en}` : "",
    item.audienceSignals.shared ? `Совпадение двух аудиторий: ${item.audienceSignals.shared}` : "",
    evidence ? `Доказательства из комментариев:\n${evidence}` : "",
    "Важно: комментарии подтверждают проблему, но не подтверждают эффективность предлагаемой автоматизации. Необходимо представить её как идею для проверки или пилота.",
  ].filter(Boolean).join("\n\n");
}

export function selectBalancedChannels(candidates = [], limit = 4) {
  const russian = candidates.filter((channel) => channel.language === "ru").slice(0, 2);
  const english = candidates.filter((channel) => channel.language === "en").slice(0, 2);
  const selected = [...russian, ...english];
  for (const channel of candidates) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.channelId === channel.channelId)) selected.push(channel);
  }
  return selected.slice(0, limit).map((channel) => channel.channelId);
}

export function selectedChannelLanguages(candidates = [], selected = []) {
  return Object.fromEntries(candidates
    .filter((channel) => selected.includes(channel.channelId))
    .map((channel) => [channel.url, channel.language || "unknown"]));
}
