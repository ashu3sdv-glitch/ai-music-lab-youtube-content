import { normalizeCuriosityShort } from "./curiosity-story.js";

export const CUSTOM_GENERATION_VERSION = 1;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function customScriptFingerprint({ title, script } = {}) {
  const serialized = `curiosity-single-v${CUSTOM_GENERATION_VERSION}\u0000${clean(title)}\u0000${clean(script)}`;
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${serialized.length}:${(hash >>> 0).toString(16)}`;
}

function cleanObjectArray(value, limit) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").slice(0, limit)
    : [];
}

export function normalizeCustomGenerationProgress(value, input = {}) {
  const sourceFingerprint = customScriptFingerprint(input);
  const source = value && typeof value === "object" ? value : {};
  if (source.version !== CUSTOM_GENERATION_VERSION || source.sourceFingerprint !== sourceFingerprint) {
    return { version: CUSTOM_GENERATION_VERSION, sourceFingerprint, shorts: [], posts: [], social: null, completedAt: "" };
  }
  const shorts = [];
  for (const item of Array.isArray(source.shorts) ? source.shorts.slice(0, 4) : []) {
    try {
      shorts.push(normalizeCuriosityShort(item, shorts.length));
    } catch {
      break;
    }
  }
  const social = source.social && typeof source.social === "object"
    ? {
      telegram: cleanObjectArray(source.social.telegram, 4),
      boosty: cleanObjectArray(source.social.boosty, 2),
    }
    : null;
  return {
    version: CUSTOM_GENERATION_VERSION,
    sourceFingerprint,
    shorts,
    posts: cleanObjectArray(source.posts, 4),
    social,
    completedAt: clean(source.completedAt),
  };
}

export function appendCustomGeneratedShort(progress, short) {
  const current = progress && typeof progress === "object" ? progress : {};
  const shorts = Array.isArray(current.shorts) ? current.shorts.slice(0, 4) : [];
  if (shorts.length >= 4) return { ...current, shorts };
  return {
    ...current,
    shorts: [...shorts, normalizeCuriosityShort(short, shorts.length)],
    posts: [],
    social: null,
    completedAt: "",
  };
}

export function isAnthropicCreditError(value) {
  return /credit balance|plans\s*&\s*billing|purchase credits|слишком низк.*баланс/i.test(String(value || ""));
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
