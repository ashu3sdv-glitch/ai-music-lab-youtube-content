export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function scoreComponents(metrics) {
  return {
    demand: clamp((Math.log10((metrics.medianViews || 0) + 1) / 6) * 100),
    competition: clamp(100 - (Math.log10((metrics.medianSubs || 0) + 1) / 6) * 100),
    freshness: clamp((metrics.freshShare || 0) * 100),
    gap: clamp(100 - (metrics.exactMatchCount || 0) * 12),
  };
}

export function topicLabel(score, hasData = true) {
  if (!hasData) return { text: "Нет данных", tone: "muted" };
  if (score >= 70) return { text: "Брать", tone: "good" };
  if (score >= 50) return { text: "Можно", tone: "warn" };
  return { text: "Слабая", tone: "muted" };
}
