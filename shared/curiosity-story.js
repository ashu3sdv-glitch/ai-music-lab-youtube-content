function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value, limit) {
  return Array.isArray(value) ? value.map(text).filter(Boolean).slice(0, limit) : [];
}

function objects(value, limit, normalize) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").slice(0, limit).map(normalize)
    : [];
}

export function normalizeCuriosityShort(item, index = 0) {
  const sourceItem = item && typeof item === "object" ? item : {};
  const topic = text(sourceItem.topic);
  const script = text(sourceItem.script);
  if (!topic || !script) throw new Error(`В Shorts №${index + 1} отсутствует тема или сценарий`);
  const angles = objects(sourceItem.angles, 3, (angle) => ({
    type: text(angle.type),
    label: text(angle.label),
    centralQuestion: text(angle.centralQuestion),
    promise: text(angle.promise),
    gap: text(angle.gap),
    finalDiscovery: text(angle.finalDiscovery),
  }));
  const hooks = objects(sourceItem.hooks, 3, (hook) => ({
    mechanism: text(hook.mechanism),
    text: text(hook.text),
  }));
  const auditSource = sourceItem.audit && typeof sourceItem.audit === "object" ? sourceItem.audit : {};
  return {
    topic,
    script,
    hook: text(sourceItem.hook) || hooks[0]?.text || "",
    openQuestion: text(sourceItem.openQuestion),
    payoff: text(sourceItem.payoff),
    screenPlan: strings(sourceItem.screenPlan, 10),
    titles: strings(sourceItem.titles, 2),
    description: text(sourceItem.description),
    coverTexts: strings(sourceItem.coverTexts, 3),
    angles,
    hooks,
    selectedAngle: Math.min(Math.max(Number(sourceItem.selectedAngle) || 0, 0), Math.max(angles.length - 1, 0)),
    selectedHook: Math.min(Math.max(Number(sourceItem.selectedHook) || 0, 0), Math.max(hooks.length - 1, 0)),
    audit: {
      strengths: strings(auditSource.strengths, 4),
      risks: strings(auditSource.risks, 4),
      experiment: text(auditSource.experiment),
      openLoops: objects(auditSource.openLoops, 4, (loop) => ({
        loop: text(loop.loop),
        payoff: text(loop.payoff),
        status: text(loop.status),
      })),
      valueDensity: text(auditSource.valueDensity),
      promiseAlignment: text(auditSource.promiseAlignment),
    },
    review: {
      hook: text(sourceItem.review?.hook),
      curiosity: text(sourceItem.review?.curiosity),
      proof: text(sourceItem.review?.proof),
      payoff: text(sourceItem.review?.payoff),
      honesty: text(sourceItem.review?.honesty),
    },
  };
}

export function normalizeCuriosityShorts(value) {
  const source = Array.isArray(value?.shorts) ? value.shorts : [];
  if (source.length !== 4) {
    throw new Error(`Нейросеть выделила ${source.length} разделов вместо 4. Проверьте, что в общем сценарии есть четыре отдельные темы.`);
  }
  return source.map(normalizeCuriosityShort);
}
