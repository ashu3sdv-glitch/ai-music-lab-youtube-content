function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildCustomScriptState({ title, script } = {}) {
  const suppliedTitle = clean(title);
  const topic = suppliedTitle || "Серия из четырёх Shorts";
  const readyScript = clean(script);
  if (!readyScript) throw new Error("Вставьте готовый сценарий");
  return {
    inputMode: "custom",
    topic,
    script: readyScript,
    hooks: [],
    selectedHookIndex: null,
    description: null,
    editingPlan: "",
    topicResearch: { source: "custom-script", title: suppliedTitle },
  };
}
