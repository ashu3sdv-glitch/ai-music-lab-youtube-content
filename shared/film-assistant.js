const ROUTES = new Set(["auto", "economy", "creative"]);
const ACTION_TYPES = new Set(["add_shot", "update_shot", "move_shot", "delete_shot", "duplicate_shot"]);
const POSITIONS = new Set(["start", "end", "before", "after"]);
const MODES = new Set(["short-film", "music-video"]);
const SHORT_CONTINUITY_STATUSES = new Set(["PASS", "WARNING"]);
const MUSIC_PRIORITIES = new Set(["HERO", "SUPPORT", "REUSE"]);
const MUSIC_METHODS = new Set(["AI_VIDEO", "ANIMATED_STILL", "ORNAMENT", "REUSE"]);
const DIRECTOR_OPTION_IDS = ["simple", "cinematic", "bold"];
const DIRECTOR_RISKS = new Set(["LOW", "MEDIUM", "HIGH"]);
const DIRECTOR_SCOPES = new Set(["project", "scene", "shot"]);

const SHORT_FILM_FIELDS = new Set([
  "sceneId", "duration", "purpose", "shotSize", "camera", "lens", "lighting",
  "action", "emotion", "dialogue", "continuity", "imagePrompt", "motionPrompt",
  "sound", "continuityStatus", "continuityWarning",
]);

const MUSIC_VIDEO_FIELDS = new Set([
  "sectionId", "start", "end", "priority", "method", "storyPurpose", "visual",
  "camera", "transition", "imagePrompt", "videoPrompt", "negativePrompt", "reason",
]);

function text(value, limit = 4000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function editableText(value, limit = 12000) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function stringList(value, limit = 8, itemLimit = 800) {
  return Array.isArray(value)
    ? value.map((item) => text(item, itemLimit)).filter(Boolean).slice(0, limit)
    : [];
}

function jsonClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function safeId(value) {
  return text(value, 160);
}

function normalizePlacement(value, fallback = "end") {
  const source = value && typeof value === "object" ? value : {};
  const position = POSITIONS.has(source.position) ? source.position : fallback;
  return {
    position,
    anchorShotId: ["before", "after"].includes(position) ? safeId(source.anchorShotId) : "",
  };
}

function allowedFields(mode) {
  return mode === "music-video" ? MUSIC_VIDEO_FIELDS : SHORT_FILM_FIELDS;
}

function normalizeShotFields(value, mode, { forUpdate = false } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const fields = allowedFields(mode);
  const result = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!fields.has(key)) continue;
    if (forUpdate && mode === "music-video" && key === "sectionId") continue;
    if (["start", "end"].includes(key)) {
      const number = Number(raw);
      if (Number.isFinite(number) && number >= 0) result[key] = number;
      continue;
    }
    const normalized = editableText(raw, key.includes("Prompt") ? 12000 : 3000);
    if (key === "continuityStatus") {
      if (SHORT_CONTINUITY_STATUSES.has(normalized)) result[key] = normalized;
      continue;
    }
    if (key === "priority") {
      if (MUSIC_PRIORITIES.has(normalized)) result[key] = normalized;
      continue;
    }
    if (key === "method") {
      if (MUSIC_METHODS.has(normalized)) result[key] = normalized;
      continue;
    }
    result[key] = normalized;
  }
  return result;
}

export function normalizeFilmAssistantAction(value, mode = "short-film") {
  const source = value && typeof value === "object" ? value : {};
  if (!ACTION_TYPES.has(source.type)) return null;
  const action = { type: source.type };
  if (["update_shot", "move_shot", "delete_shot", "duplicate_shot"].includes(source.type)) {
    action.shotId = safeId(source.shotId);
    if (!action.shotId) return null;
  }
  if (["add_shot", "move_shot", "duplicate_shot"].includes(source.type)) {
    action.placement = normalizePlacement(source.placement, source.type === "add_shot" ? "end" : "after");
    if (["before", "after"].includes(action.placement.position) && !action.placement.anchorShotId) return null;
  }
  if (source.type === "add_shot") action.shot = normalizeShotFields(source.shot, mode);
  if (source.type === "update_shot") {
    action.changes = normalizeShotFields(source.changes, mode, { forUpdate: true });
    if (!Object.keys(action.changes).length) return null;
  }
  return action;
}

export function normalizeFilmAssistantProposal(value, mode = "short-film") {
  const source = value && typeof value === "object" ? value : {};
  const fallbackMode = mode === "music-video" ? "music-video" : "short-film";
  const proposalMode = MODES.has(source.mode) ? source.mode : fallbackMode;
  const actions = Array.isArray(source.actions)
    ? source.actions.slice(0, 8).map((action) => normalizeFilmAssistantAction(action, proposalMode)).filter(Boolean)
    : [];
  if (!actions.length) return null;
  return {
    mode: proposalMode,
    summary: text(source.summary, 600) || "Изменить покадровый план",
    actions,
    baseFingerprint: text(source.baseFingerprint, 200),
  };
}

export function normalizeDirectorOption(value, index = 0) {
  const source = value && typeof value === "object" ? value : {};
  const fallbackId = DIRECTOR_OPTION_IDS[index] || `option-${index + 1}`;
  const id = DIRECTOR_OPTION_IDS.includes(source.id) ? source.id : fallbackId;
  const labels = {
    simple: "Простой и надёжный",
    cinematic: "Кинематографичный",
    bold: "Смелый эксперимент",
  };
  const summary = text(source.summary, 1200);
  if (!summary) return null;
  return {
    id,
    label: text(source.label, 120) || labels[id] || `Вариант ${index + 1}`,
    summary,
    viewerEffect: text(source.viewerEffect, 1200),
    shotPlan: stringList(source.shotPlan, 8, 500),
    camera: text(source.camera, 1000),
    lighting: text(source.lighting, 1000),
    movement: text(source.movement, 1000),
    sound: text(source.sound, 1000),
    editRhythm: text(source.editRhythm, 1000),
    generationRisk: DIRECTOR_RISKS.has(source.generationRisk) ? source.generationRisk : "MEDIUM",
    whyItWorks: text(source.whyItWorks, 1200),
  };
}

export function normalizeDirectorPlan(value, mode = "short-film") {
  const source = value && typeof value === "object" ? value : {};
  const seen = new Set();
  const options = (Array.isArray(source.options) ? source.options : [])
    .slice(0, 3)
    .map((option, index) => normalizeDirectorOption(option, index))
    .filter((option) => {
      if (!option || seen.has(option.id)) return false;
      seen.add(option.id);
      return true;
    });
  if (!options.length) return null;
  const recommendation = options.some((option) => option.id === source.recommendation)
    ? source.recommendation
    : (options.find((option) => option.id === "cinematic")?.id || options[0].id);
  const selectedOptionId = options.some((option) => option.id === source.selectedOptionId)
    ? source.selectedOptionId
    : "";
  return {
    id: safeId(source.id) || "DIRECTOR_PLAN",
    mode: MODES.has(source.mode) ? source.mode : (mode === "music-video" ? "music-video" : "short-film"),
    scope: DIRECTOR_SCOPES.has(source.scope) ? source.scope : "project",
    targetId: safeId(source.targetId),
    title: text(source.title, 300) || "Режиссёрский разбор",
    dramaticGoal: text(source.dramaticGoal, 1600),
    viewerJourney: text(source.viewerJourney, 1600),
    recommendation,
    options,
    complete: DIRECTOR_OPTION_IDS.every((id) => options.some((option) => option.id === id)),
    selectedOptionId,
    status: source.status === "approved" && selectedOptionId ? "approved" : "draft",
    baseFingerprint: text(source.baseFingerprint, 200),
    createdAt: text(source.createdAt, 80),
    approvedAt: text(source.approvedAt, 80),
  };
}

export function normalizeFilmAssistantResponse(value, mode = "short-film") {
  const source = value && typeof value === "object" ? value : {};
  return {
    reply: text(source.reply, 8000) || "Я изучил проект, но не смог сформулировать ответ. Попробуйте уточнить вопрос.",
    proposal: normalizeFilmAssistantProposal(source.proposal, mode),
    directorPlan: normalizeDirectorPlan(source.directorPlan, mode),
  };
}

function normalizeMessage(value, fallbackMode = "short-film") {
  const source = value && typeof value === "object" ? value : {};
  const role = source.role === "user" ? "user" : "assistant";
  const messageText = text(source.text, 8000);
  if (!messageText) return null;
  return {
    id: safeId(source.id) || `${role}-${Date.now()}`,
    role,
    text: messageText,
    route: ROUTES.has(source.route) ? source.route : "auto",
    mode: MODES.has(source.mode) ? source.mode : (fallbackMode === "music-video" ? "music-video" : "short-film"),
    createdAt: text(source.createdAt, 80),
  };
}

function normalizeUndo(value) {
  const source = value && typeof value === "object" ? value : {};
  const mode = source.mode === "music-video" ? "music-video" : "short-film";
  const beforeShots = Array.isArray(source.beforeShots)
    ? source.beforeShots.filter((shot) => shot && typeof shot === "object").slice(0, mode === "music-video" ? 40 : 12).map(jsonClone)
    : [];
  if (!beforeShots.length || !text(source.afterFingerprint, 200)) return null;
  return {
    mode,
    label: text(source.label, 600) || "Последнее изменение",
    beforeShots,
    afterFingerprint: text(source.afterFingerprint, 200),
  };
}

export function normalizeFilmAssistantState(value, mode = "short-film") {
  const source = value && typeof value === "object" ? value : {};
  const currentMode = mode === "music-video" ? "music-video" : "short-film";
  return {
    route: ROUTES.has(source.route) ? source.route : "auto",
    activeShotId: safeId(source.activeShotId),
    messages: Array.isArray(source.messages) ? source.messages.map((message) => normalizeMessage(message, currentMode)).filter(Boolean).slice(-30) : [],
    pendingProposal: normalizeFilmAssistantProposal(source.pendingProposal, currentMode),
    directorPlan: normalizeDirectorPlan(source.directorPlan, currentMode),
    undo: normalizeUndo(source.undo),
  };
}

export function selectFilmAssistantRoute(message, requestedRoute = "auto") {
  if (requestedRoute === "economy" || requestedRoute === "creative") return requestedRoute;
  const request = text(message, 4000).toLocaleLowerCase("ru");
  const creativeSignals = [
    "перепиши сценар", "измени сюжет", "переработай сюжет", "переработай всю", "усиль драматург",
    "придумай сцен", "новая история", "новую историю", "проанализируй весь фильм", "проверь всю историю",
    "перепиши истор", "переделай сценар", "сценарий заново", "создай сценар", "создай новый сюжет",
    "придумай сюжет", "измени всю сцен", "переработай сцен", "полностью переработ", "режиссёрская переработ",
    "режиссёрский разбор", "три постанов", "3 постанов", "варианты постанов", "сделай интереснее",
    "свет и камер", "монтажный ритм", "удержание зрител", "творческое направление",
    "rewrite the script", "rewrite the story", "new screenplay",
  ];
  return creativeSignals.some((signal) => request.includes(signal)) ? "creative" : "economy";
}

function fingerprint(value) {
  const serialized = JSON.stringify(value ?? null);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${serialized.length}:${(hash >>> 0).toString(16)}`;
}

export function filmShotsFingerprint(shots) {
  return fingerprint(Array.isArray(shots) ? shots : []);
}

export function filmDirectionSourceFingerprint(state) {
  const selectedTheme = (state?.themes || []).find((item) => item.id === state?.selectedThemeId) || null;
  const selectedIdea = (state?.ideas || []).find((item) => item.id === state?.selectedIdeaId) || null;
  return fingerprint({
    settings: state?.settings || {},
    selectedTheme,
    selectedIdea,
  });
}

export function filmCreativeContextFingerprint(state, mode = state?.studioMode || "short-film") {
  if (mode === "music-video") {
    const music = state?.musicVideo || {};
    const selectedConcept = (music.concepts || []).find((item) => item.id === music.selectedConceptId) || null;
    return fingerprint({
      settings: music.settings || {},
      song: { duration: music.duration, bpm: music.bpm, lyrics: music.lyrics },
      selectedConcept,
      sections: (music.sections || []).map((section) => ({
        id: section.id,
        label: section.label,
        start: section.start,
        end: section.end,
        energy: section.energy,
        purpose: section.purpose,
      })),
      shots: (music.shots || []).map((shot) => ({
        id: shot.id,
        sectionId: shot.sectionId,
        start: shot.start,
        end: shot.end,
        storyPurpose: shot.storyPurpose,
        visual: shot.visual,
        camera: shot.camera,
        transition: shot.transition,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
      })),
    });
  }
  return fingerprint({
    direction: filmDirectionSourceFingerprint(state),
    project: state?.project ? {
      concept: state.project.concept,
      story: state.project.story,
      scenes: (state.project.scenes || []).map((scene) => ({
        id: scene.id,
        title: scene.title,
        purpose: scene.purpose,
        locationId: scene.locationId,
        summary: scene.summary,
      })),
      shots: (state.project.shots || []).map((shot) => ({
        id: shot.id,
        sceneId: shot.sceneId,
        duration: shot.duration,
        purpose: shot.purpose,
        shotSize: shot.shotSize,
        action: shot.action,
        camera: shot.camera,
        lens: shot.lens,
        lighting: shot.lighting,
        emotion: shot.emotion,
        dialogue: shot.dialogue,
        continuity: shot.continuity,
        imagePrompt: shot.imagePrompt,
        motionPrompt: shot.motionPrompt,
        sound: shot.sound,
      })),
    } : null,
  });
}

export function getFilmStudioShots(state, mode = state?.studioMode || "short-film") {
  return mode === "music-video"
    ? (Array.isArray(state?.musicVideo?.shots) ? state.musicVideo.shots : [])
    : (Array.isArray(state?.project?.shots) ? state.project.shots : []);
}

function placementIndex(shots, placement) {
  if (placement.position === "start") return 0;
  if (placement.position === "end") return shots.length;
  const anchorIndex = shots.findIndex((shot) => shot.id === placement.anchorShotId);
  if (anchorIndex < 0) throw new Error(`Кадр ${placement.anchorShotId} больше не найден`);
  return placement.position === "before" ? anchorIndex : anchorIndex + 1;
}

function musicSectionPlacementIndex(shots, placement, sectionId, sections) {
  if (["before", "after"].includes(placement.position)) return placementIndex(shots, placement);
  const matchingIndices = shots.reduce((indices, shot, index) => {
    if (shot.sectionId === sectionId) indices.push(index);
    return indices;
  }, []);
  if (matchingIndices.length) {
    return placement.position === "start" ? matchingIndices[0] : matchingIndices.at(-1) + 1;
  }

  const sectionIndex = sections.findIndex((section) => section.id === sectionId);
  const laterSectionShotIndex = shots.findIndex((shot) => {
    const shotSectionIndex = sections.findIndex((section) => section.id === shot.sectionId);
    return shotSectionIndex > sectionIndex;
  });
  return laterSectionShotIndex >= 0 ? laterSectionShotIndex : shots.length;
}

function freshKeyframe() {
  return { assetId: "", status: "MISSING", note: "", bypassReason: "", reviewedAt: "" };
}

function invalidateShot(shot, mode) {
  const keyframe = shot?.keyframe && typeof shot.keyframe === "object" ? shot.keyframe : freshKeyframe();
  const next = {
    ...shot,
    keyframe: {
      ...keyframe,
      status: keyframe.assetId || keyframe.status === "BYPASSED" ? "STALE" : "MISSING",
      reviewedAt: "",
    },
  };
  if (mode === "music-video") {
    next.ready = false;
    next.productionReviewed = false;
    next.selectedVersion = "original";
  }
  else next.status = { ...(shot.status || {}), image: false, video: false, final: false };
  return next;
}

function newShortFilmShot(fields, id) {
  return {
    id,
    sceneId: "",
    duration: "3 сек",
    purpose: "Промежуточный кадр",
    shotSize: "Крупный план",
    camera: "Статичная камера",
    lens: "",
    lighting: "",
    action: "",
    emotion: "",
    dialogue: "",
    continuity: "Сохранить внешность героя и локацию предыдущего кадра",
    imagePrompt: "",
    motionPrompt: "",
    sound: "",
    continuityStatus: "PASS",
    continuityWarning: "",
    referenceAssetIds: [],
    keyframe: freshKeyframe(),
    status: { image: false, video: false, voice: false, sfx: false, final: false },
    ...fields,
  };
}

function newMusicVideoShot(fields, id) {
  return {
    id,
    sectionId: "",
    start: 0,
    end: 4,
    priority: "SUPPORT",
    method: "ANIMATED_STILL",
    storyPurpose: "Промежуточный кадр",
    visual: "",
    camera: "locked camera",
    transition: "cut",
    imagePrompt: "",
    videoPrompt: "",
    negativePrompt: "face change, costume change, morphing",
    recommendedModel: "Higgsfield — выбрать модель вручную",
    alternativeModel: "",
    reason: "Добавлен по решению автора",
    productionReviewed: false,
    generationDifficulty: "MEDIUM",
    regenerationRisk: "MEDIUM",
    continuityRisk: "MEDIUM",
    riskReasons: [],
    referenceNeeds: [],
    directorVersion: { visual: "", camera: "", imagePrompt: "", videoPrompt: "", reason: "" },
    selectedVersion: "original",
    referenceAssetIds: [],
    keyframe: freshKeyframe(),
    reusable: false,
    ready: false,
    ...fields,
  };
}

function uniqueShotId(mode, shots, idFactory) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${mode === "music-video" ? "MV_SHOT" : "SHOT"}_${idFactory()}`;
    if (!shots.some((shot) => shot.id === candidate)) return candidate;
  }
  throw new Error("Не удалось создать уникальный идентификатор кадра");
}

function musicSections(state) {
  return Array.isArray(state?.musicVideo?.sections)
    ? state.musicVideo.sections.filter((section) => section && typeof section === "object")
    : [];
}

function musicSectionById(sections, sectionId) {
  return sections.find((section) => section.id === sectionId) || null;
}

function validateMusicSection(section) {
  const start = Number(section?.start);
  const end = Number(section?.end);
  if (!section || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("У выбранной части песни некорректные границы времени");
  }
  return { ...section, start, end };
}

function validateMusicShotTimes(shot, section) {
  const start = Number(shot?.start);
  const end = Number(shot?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Конец музыкального кадра должен быть позже начала");
  }
  if (start < section.start || end > section.end) {
    throw new Error(`Время кадра должно находиться внутри части песни ${section.id}`);
  }
  return { start, end };
}

function resolveMusicAddFields(action, shots, sections) {
  const fields = { ...(action.shot || {}) };
  const placement = action.placement;
  const anchor = ["before", "after"].includes(placement.position)
    ? shots.find((shot) => shot.id === placement.anchorShotId)
    : null;
  if (["before", "after"].includes(placement.position) && !anchor) {
    throw new Error(`Кадр ${placement.anchorShotId} больше не найден`);
  }

  const sectionId = fields.sectionId || anchor?.sectionId || "";
  const section = validateMusicSection(musicSectionById(sections, sectionId));
  if (anchor && anchor.sectionId !== sectionId) {
    throw new Error("Новый кадр можно поставить рядом с другим кадром только внутри той же части песни");
  }
  fields.sectionId = sectionId;

  const hasStart = Object.prototype.hasOwnProperty.call(fields, "start");
  const hasEnd = Object.prototype.hasOwnProperty.call(fields, "end");
  if (hasStart !== hasEnd) {
    throw new Error("Для музыкального кадра укажите и начало, и конец времени");
  }

  if (!hasStart) {
    const sectionDuration = section.end - section.start;
    const duration = Math.min(4, sectionDuration);
    if (anchor && placement.position === "before") {
      const end = Math.min(section.end, Math.max(section.start + duration, Number(anchor.start) || section.start));
      fields.start = Math.max(section.start, end - duration);
      fields.end = fields.start + duration;
    } else if (anchor && placement.position === "after") {
      const anchorEnd = Number(anchor.end);
      const start = Math.min(section.end - duration, Math.max(section.start, Number.isFinite(anchorEnd) ? anchorEnd : section.start));
      fields.start = start;
      fields.end = start + duration;
    } else {
      fields.start = section.start;
      fields.end = section.start + duration;
    }
  }

  const time = validateMusicShotTimes(fields, section);
  return { ...fields, ...time };
}

function validateMusicRelativePlacement(action, shots, sections) {
  if (!["before", "after"].includes(action.placement?.position)) {
    throw new Error("Музыкальный кадр можно перемещать или дублировать только до или после другого кадра");
  }
  const source = shots.find((shot) => shot.id === action.shotId);
  const anchor = shots.find((shot) => shot.id === action.placement.anchorShotId);
  if (!anchor) throw new Error(`Кадр ${action.placement.anchorShotId} больше не найден`);
  const sourceSection = validateMusicSection(musicSectionById(sections, source?.sectionId));
  validateMusicSection(musicSectionById(sections, anchor.sectionId));
  if (sourceSection.id !== anchor.sectionId) {
    throw new Error("Музыкальные кадры можно перемещать и дублировать только внутри одной части песни");
  }
}

export function applyFilmAssistantProposal(state, proposal, options = {}) {
  const mode = options.mode === "music-video" ? "music-video" : (state?.studioMode === "music-video" ? "music-video" : "short-film");
  const normalized = normalizeFilmAssistantProposal(proposal, mode);
  if (!normalized) throw new Error("В предложении помощника нет допустимых изменений");
  if (normalized.mode !== mode) {
    throw new Error("Предложение подготовлено для другого режима Film Studio. Попросите помощника подготовить его заново.");
  }
  if (mode === "short-film" && (!state?.project || !text(state.project?.concept?.title, 300) || !Array.isArray(state.project?.shots) || !state.project.shots.length)) {
    throw new Error("Сначала разработайте фильм и получите покадровый план, затем Film Assistant сможет изменять кадры");
  }
  const beforeShots = getFilmStudioShots(state, mode);
  const currentFingerprint = filmShotsFingerprint(beforeShots);
  if (normalized.baseFingerprint && normalized.baseFingerprint !== currentFingerprint) {
    throw new Error("Покадровый план уже изменился. Попросите помощника подготовить предложение заново.");
  }
  const maxShots = mode === "music-video" ? 40 : 12;
  const sections = mode === "music-video" ? musicSections(state) : [];
  const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  let shots = beforeShots.map((shot) => ({ ...shot }));

  for (const action of normalized.actions) {
    if (action.type === "add_shot") {
      if (shots.length >= maxShots) throw new Error(`В этом режиме можно сохранить не более ${maxShots} кадров`);
      const id = uniqueShotId(mode, shots, idFactory);
      const shot = mode === "music-video"
        ? newMusicVideoShot(resolveMusicAddFields(action, shots, sections), id)
        : newShortFilmShot(action.shot, id);
      const insertAt = mode === "music-video"
        ? musicSectionPlacementIndex(shots, action.placement, shot.sectionId, sections)
        : placementIndex(shots, action.placement);
      shots.splice(insertAt, 0, shot);
      continue;
    }

    const shotIndex = shots.findIndex((shot) => shot.id === action.shotId);
    if (shotIndex < 0) throw new Error(`Кадр ${action.shotId} больше не найден`);

    if (action.type === "update_shot") {
      const updated = { ...shots[shotIndex], ...action.changes };
      if (mode === "music-video" && (Object.prototype.hasOwnProperty.call(action.changes, "start") || Object.prototype.hasOwnProperty.call(action.changes, "end"))) {
        const section = validateMusicSection(musicSectionById(sections, updated.sectionId));
        validateMusicShotTimes(updated, section);
      }
      shots[shotIndex] = invalidateShot(updated, mode);
    } else if (action.type === "delete_shot") {
      if (shots.length <= 1) throw new Error("Нельзя удалить последний кадр проекта");
      shots.splice(shotIndex, 1);
    } else if (action.type === "move_shot") {
      if (action.placement.anchorShotId === action.shotId) throw new Error("Кадр нельзя переместить относительно самого себя");
      if (mode === "music-video") validateMusicRelativePlacement(action, shots, sections);
      const [shot] = shots.splice(shotIndex, 1);
      shots.splice(placementIndex(shots, action.placement), 0, shot);
    } else if (action.type === "duplicate_shot") {
      if (shots.length >= maxShots) throw new Error(`В этом режиме можно сохранить не более ${maxShots} кадров`);
      if (mode === "music-video") validateMusicRelativePlacement(action, shots, sections);
      const original = shots[shotIndex];
      const id = uniqueShotId(mode, shots, idFactory);
      const copy = {
        ...jsonClone(original),
        id,
        keyframe: freshKeyframe(),
        ...(mode === "music-video"
          ? { ready: false }
          : { status: { image: false, video: false, voice: false, sfx: false, final: false } }),
      };
      shots.splice(placementIndex(shots, action.placement), 0, copy);
    }
  }

  const nextState = mode === "music-video"
    ? { ...state, musicVideo: { ...(state.musicVideo || {}), shots, planOutdated: true } }
    : { ...state, project: { ...(state.project || {}), shots, planOutdated: true } };
  const afterFingerprint = filmShotsFingerprint(shots);
  return {
    state: nextState,
    undo: {
      mode,
      label: normalized.summary,
      beforeShots: beforeShots.map(jsonClone),
      afterFingerprint,
    },
  };
}

export function undoFilmAssistantAction(state, undoValue) {
  const undo = normalizeUndo(undoValue);
  if (!undo) throw new Error("Нет изменения, которое можно отменить");
  const currentShots = getFilmStudioShots(state, undo.mode);
  if (filmShotsFingerprint(currentShots) !== undo.afterFingerprint) {
    throw new Error("После команды покадровый план изменился вручную, поэтому автоматическая отмена небезопасна");
  }
  return undo.mode === "music-video"
    ? { ...state, musicVideo: { ...(state.musicVideo || {}), shots: undo.beforeShots.map(jsonClone), planOutdated: true } }
    : { ...state, project: { ...(state.project || {}), shots: undo.beforeShots.map(jsonClone), planOutdated: true } };
}

export function describeFilmAssistantAction(action) {
  if (!action) return "Неизвестное действие";
  const labels = {
    add_shot: "Добавить новый кадр",
    update_shot: `Изменить кадр ${action.shotId}`,
    move_shot: `Переместить кадр ${action.shotId}`,
    delete_shot: `Удалить кадр ${action.shotId}`,
    duplicate_shot: `Дублировать кадр ${action.shotId}`,
  };
  const detail = action.shot?.action || action.shot?.visual || action.changes?.action || action.changes?.visual || "";
  return detail ? `${labels[action.type]} — ${detail}` : labels[action.type];
}
