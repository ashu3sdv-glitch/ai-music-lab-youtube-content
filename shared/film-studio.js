import { normalizeDirectorOption, normalizeFilmAssistantState } from "./film-assistant.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function editableText(value) {
  return typeof value === "string" ? value : "";
}

function list(value, limit = 50) {
  return Array.isArray(value) ? value.map(text).filter(Boolean).slice(0, limit) : [];
}

function objects(value, limit, mapper) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").slice(0, limit).map(mapper)
    : [];
}

function uniqueIds(value, limit = 12) {
  return [...new Set(list(value, limit * 2))].slice(0, limit);
}

function uniqueEntityId(value, fallback, used) {
  const base = text(value) || fallback;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

const KEYFRAME_STATUSES = new Set(["MISSING", "PENDING", "APPROVED", "REJECTED", "STALE", "BYPASSED"]);

export function normalizeShotKeyframe(value) {
  const source = value && typeof value === "object" ? value : {};
  const assetId = text(source.assetId);
  let status = KEYFRAME_STATUSES.has(source.status) ? source.status : "MISSING";
  if (!assetId && !["BYPASSED", "STALE"].includes(status)) status = "MISSING";
  return {
    assetId,
    status,
    note: text(source.note),
    bypassReason: text(source.bypassReason),
    reviewedAt: text(source.reviewedAt),
  };
}

export function invalidateShotKeyframe(value) {
  const keyframe = normalizeShotKeyframe(value);
  if (keyframe.assetId || keyframe.status === "BYPASSED") {
    return { ...keyframe, status: "STALE", reviewedAt: "" };
  }
  return { ...keyframe, status: "MISSING", reviewedAt: "" };
}

export function isShotReadyForVideo(value) {
  const status = normalizeShotKeyframe(value).status;
  return status === "APPROVED" || status === "BYPASSED";
}

export function invalidateShotPreparation(shot) {
  const source = shot && typeof shot === "object" ? shot : {};
  const next = { ...source, keyframe: invalidateShotKeyframe(source.keyframe) };
  if (source.status && typeof source.status === "object") {
    next.status = { ...source.status, image: false, video: false, final: false };
  }
  if (Object.prototype.hasOwnProperty.call(source, "ready")) next.ready = false;
  return next;
}

export function selectMusicVideoShotVersion(shot, selectedVersion) {
  const version = selectedVersion === "director" ? "director" : "original";
  if (shot?.selectedVersion === version) return shot;
  return { ...invalidateShotPreparation(shot), selectedVersion: version };
}

export function unlinkReferenceAsset(value, assetId) {
  if (!text(assetId)) return value;
  const source = value && typeof value === "object" ? value : {};
  const unlinkShots = (shots) => Array.isArray(shots) ? shots.map((shot) => {
    if (!shot?.referenceAssetIds?.includes(assetId)) return shot;
    return {
      ...invalidateShotPreparation(shot),
      referenceAssetIds: shot.referenceAssetIds.filter((id) => id !== assetId),
    };
  }) : [];

  return {
    ...source,
    project: source.project ? { ...source.project, shots: unlinkShots(source.project.shots) } : source.project,
    musicVideo: source.musicVideo
      ? { ...source.musicVideo, shots: unlinkShots(source.musicVideo.shots) }
      : source.musicVideo,
  };
}

export function normalizeFilmIdea(item, index = 0) {
  const source = item && typeof item === "object" ? item : {};
  const title = text(source.title) || `Идея ${index + 1}`;
  return {
    id: text(source.id) || `FILM_IDEA_${index + 1}`,
    source: source.source === "manual" ? "manual" : "generated",
    title,
    hook: text(source.hook),
    premise: text(source.premise),
    conflict: text(source.conflict),
    twist: text(source.twist),
    ending: text(source.ending),
    estimatedDuration: text(source.estimatedDuration) || "40 сек",
  };
}

export function normalizeFilmIdeas(value) {
  return objects(value?.ideas, 8, normalizeFilmIdea);
}

export function normalizeFilmTheme(item, index = 0) {
  const source = item && typeof item === "object" ? item : {};
  return {
    id: text(source.id) || `FILM_THEME_${index + 1}`,
    source: source.source === "manual" ? "manual" : "generated",
    title: text(source.title) || `Тема ${index + 1}`,
    universe: text(source.universe),
    centralMystery: text(source.centralMystery),
    protagonist: text(source.protagonist),
    episodeEngine: text(source.episodeEngine),
    visualHook: text(source.visualHook),
    episodeSeeds: list(source.episodeSeeds, 5),
  };
}

export function normalizeFilmThemes(value) {
  return objects(value?.themes, 8, normalizeFilmTheme);
}

export function normalizeCreativeBrief(value) {
  const source = value && typeof value === "object" ? value : {};
  const sourceIndex = ["simple", "cinematic", "bold"].indexOf(source.id);
  const option = normalizeDirectorOption(source, sourceIndex >= 0 ? sourceIndex : 0);
  if (!option || !text(source.sourceFingerprint)) return null;
  return {
    ...option,
    sourceFingerprint: text(source.sourceFingerprint),
    sourceIdeaId: text(source.sourceIdeaId),
    sourceThemeId: text(source.sourceThemeId),
    approvedAt: text(source.approvedAt),
  };
}

export function normalizeFilmPackage(value) {
  const source = value?.project && typeof value.project === "object" ? value.project : value;
  if (!source || typeof source !== "object") throw new Error("Нейросеть не вернула проект фильма");
  const concept = source.concept && typeof source.concept === "object" ? source.concept : {};
  const usedShotIds = new Set();
  const shots = objects(source.shots, 12, (shot, index) => ({
    id: uniqueEntityId(shot.id, `SHOT_${String(index + 1).padStart(3, "0")}`, usedShotIds),
    sceneId: text(shot.sceneId),
    duration: text(shot.duration),
    purpose: text(shot.purpose),
    shotSize: text(shot.shotSize),
    camera: text(shot.camera),
    lens: text(shot.lens),
    lighting: text(shot.lighting),
    action: text(shot.action),
    emotion: text(shot.emotion),
    dialogue: text(shot.dialogue),
    continuity: text(shot.continuity),
    imagePrompt: editableText(shot.imagePrompt),
    motionPrompt: editableText(shot.motionPrompt),
    sound: text(shot.sound),
    continuityStatus: text(shot.continuityStatus) || "PASS",
    continuityWarning: text(shot.continuityWarning),
    referenceAssetIds: uniqueIds(shot.referenceAssetIds),
    keyframe: normalizeShotKeyframe(shot.keyframe),
    status: {
      image: Boolean(shot.status?.image),
      video: Boolean(shot.status?.video),
      voice: Boolean(shot.status?.voice),
      sfx: Boolean(shot.status?.sfx),
      final: Boolean(shot.status?.final),
    },
  }));
  if (!text(concept.title) || shots.length < 1) throw new Error("В проекте отсутствует название или список кадров");
  return {
    id: text(source.id) || "FILM_PROJECT_001",
    planOutdated: Boolean(source.planOutdated),
    concept: {
      title: text(concept.title),
      logline: text(concept.logline),
      hook: text(concept.hook),
      format: text(concept.format) || "9:16",
      duration: text(concept.duration) || "40 сек",
      storyMode: text(concept.storyMode) || "standalone",
    },
    story: text(source.story),
    worldBible: {
      era: text(source.worldBible?.era),
      location: text(source.worldBible?.location),
      technology: text(source.worldBible?.technology),
      visualStyle: text(source.worldBible?.visualStyle),
      rules: list(source.worldBible?.rules, 8),
      organizations: list(source.worldBible?.organizations, 6),
      motifs: list(source.worldBible?.motifs, 6),
      forbiddenContradictions: list(source.worldBible?.forbiddenContradictions, 8),
    },
    characters: objects(source.characters, 3, (character, index) => ({
      id: text(character.id) || `CHAR_${String(index + 1).padStart(3, "0")}`,
      name: text(character.name),
      role: text(character.role),
      appearance: text(character.appearance),
      clothing: text(character.clothing),
      distinctiveFeatures: text(character.distinctiveFeatures),
      personality: text(character.personality),
      voice: text(character.voice),
      emotionalBaseline: text(character.emotionalBaseline),
      visualLock: text(character.visualLock),
      masterPrompt: text(character.masterPrompt),
    })),
    locations: objects(source.locations, 3, (location, index) => ({
      id: text(location.id) || `LOC_${String(index + 1).padStart(3, "0")}`,
      name: text(location.name),
      geometry: text(location.geometry),
      lighting: text(location.lighting),
      colors: text(location.colors),
      anchors: text(location.anchors),
      masterPrompt: text(location.masterPrompt),
    })),
    scenes: objects(source.scenes, 8, (scene, index) => ({
      id: text(scene.id) || `SCENE_${String(index + 1).padStart(2, "0")}`,
      duration: text(scene.duration),
      locationId: text(scene.locationId),
      characterIds: list(scene.characterIds, 3),
      purpose: text(scene.purpose),
      action: text(scene.action),
      dialogue: text(scene.dialogue),
      emotion: text(scene.emotion),
      continuity: text(scene.continuity),
    })),
    shots,
    voiceSheet: objects(source.voiceSheet, 20, (voice) => ({
      time: text(voice.time), characterId: text(voice.characterId), text: text(voice.text), emotion: text(voice.emotion), delivery: text(voice.delivery),
    })),
    soundSheet: objects(source.soundSheet, 30, (sound) => ({ time: text(sound.time), sound: text(sound.sound) })),
    editSheet: objects(source.editSheet, 20, (edit) => ({ time: text(edit.time), shotId: text(edit.shotId), transition: text(edit.transition) })),
    youtube: {
      titles: list(source.youtube?.titles, 3),
      description: text(source.youtube?.description),
      hashtags: list(source.youtube?.hashtags, 8),
      tags: list(source.youtube?.tags, 15),
      thumbnailConcept: text(source.youtube?.thumbnailConcept),
      thumbnailPrompt: text(source.youtube?.thumbnailPrompt),
    },
  };
}

export function normalizeMusicVideoConcepts(value) {
  return objects(value?.concepts, 3, (item, index) => ({
    id: text(item.id) || `MV_CONCEPT_${index + 1}`,
    title: text(item.title) || `Концепция ${index + 1}`,
    logline: text(item.logline),
    visualWorld: text(item.visualWorld),
    storyArc: text(item.storyArc),
    signatureImages: list(item.signatureImages, 5),
    productionApproach: text(item.productionApproach),
  }));
}

export function normalizeMusicVideoShots(value) {
  const usedShotIds = new Set();
  return objects(value?.shots, 40, (shot, index) => {
    const riskLevels = ["LOW", "MEDIUM", "HIGH"];
    const hasCompleteDirectorVersion = Boolean(
      shot.directorVersion
      && typeof shot.directorVersion === "object"
      && text(shot.directorVersion.visual)
      && text(shot.directorVersion.imagePrompt)
      && text(shot.directorVersion.videoPrompt),
    );
    const hasStoredReviewFlag = Object.prototype.hasOwnProperty.call(shot, "productionReviewed");
    const productionReviewed = hasStoredReviewFlag
      ? shot.productionReviewed === true
      : riskLevels.includes(shot.generationDifficulty)
        && riskLevels.includes(shot.regenerationRisk)
        && riskLevels.includes(shot.continuityRisk)
        && hasCompleteDirectorVersion;

    return {
      id: uniqueEntityId(shot.id, `MV_SHOT_${String(index + 1).padStart(3, "0")}`, usedShotIds),
      sectionId: text(shot.sectionId),
      start: Math.max(0, Number(shot.start) || 0),
      end: Math.max(0, Number(shot.end) || 0),
      priority: ["HERO", "SUPPORT", "REUSE"].includes(shot.priority) ? shot.priority : "SUPPORT",
      method: ["AI_VIDEO", "ANIMATED_STILL", "ORNAMENT", "REUSE"].includes(shot.method) ? shot.method : "ANIMATED_STILL",
      storyPurpose: text(shot.storyPurpose),
      visual: text(shot.visual),
      camera: text(shot.camera),
      transition: text(shot.transition),
      imagePrompt: editableText(shot.imagePrompt),
      videoPrompt: editableText(shot.videoPrompt),
      negativePrompt: editableText(shot.negativePrompt),
      recommendedModel: text(shot.recommendedModel) || "Higgsfield — выбрать модель вручную",
      alternativeModel: text(shot.alternativeModel),
      reason: text(shot.reason),
      productionReviewed,
      generationDifficulty: riskLevels.includes(shot.generationDifficulty) ? shot.generationDifficulty : "MEDIUM",
      regenerationRisk: riskLevels.includes(shot.regenerationRisk) ? shot.regenerationRisk : "MEDIUM",
      continuityRisk: riskLevels.includes(shot.continuityRisk) ? shot.continuityRisk : "MEDIUM",
      riskReasons: list(shot.riskReasons, 6),
      referenceNeeds: list(shot.referenceNeeds, 6),
      directorVersion: {
        visual: text(shot.directorVersion?.visual) || text(shot.visual),
        camera: text(shot.directorVersion?.camera) || text(shot.camera),
        imagePrompt: editableText(shot.directorVersion?.imagePrompt) || editableText(shot.imagePrompt),
        videoPrompt: editableText(shot.directorVersion?.videoPrompt) || editableText(shot.videoPrompt),
        reason: text(shot.directorVersion?.reason) || "Исходный кадр уже достаточно простой",
      },
      selectedVersion: shot.selectedVersion === "director" ? "director" : "original",
      referenceAssetIds: uniqueIds(shot.referenceAssetIds),
      keyframe: normalizeShotKeyframe(shot.keyframe),
      reusable: Boolean(shot.reusable),
      ready: Boolean(shot.ready),
    };
  });
}

export function normalizeMusicVideoShotPackage(value, sectionId) {
  const authoritativeSectionId = text(sectionId);
  if (!authoritativeSectionId) throw new Error("Не указана секция музыкального клипа");
  const shots = normalizeMusicVideoShots(value)
    .slice(0, 2)
    .map((shot) => ({ ...shot, sectionId: authoritativeSectionId }));
  if (shots.length < 2) {
    throw new Error("Нейросеть вернула неполный план секции. Повторите эту часть ещё раз.");
  }
  if (shots.some((shot) => !shot.productionReviewed)) {
    throw new Error("Нейросеть не завершила проверку Production Director. Повторите эту часть ещё раз.");
  }
  return shots;
}

function normalizeMusicVideo(value) {
  const source = value && typeof value === "object" ? value : {};
  const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
  return {
    audioName: text(source.audioName),
    duration: Math.max(0, Number(source.duration) || 0),
    bpm: text(source.bpm),
    lyrics: typeof source.lyrics === "string" ? source.lyrics : "",
    sections: objects(source.sections, 20, (section, index) => ({
      id: text(section.id) || `MV_SECTION_${String(index + 1).padStart(2, "0")}`,
      label: editableText(section.label) || `Часть ${index + 1}`,
      start: Math.max(0, Number(section.start) || 0),
      end: Math.max(0, Number(section.end) || 0),
      energy: ["LOW", "MEDIUM", "HIGH", "PEAK"].includes(section.energy) ? section.energy : "MEDIUM",
    })),
    settings: {
      conceptType: text(settings.conceptType) || "Автоматически",
      folkloreStyle: text(settings.folkloreStyle) || "Без фольклорного стиля",
      narrativeBalance: text(settings.narrativeBalance) || "60% история / 40% абстракция",
      realism: text(settings.realism) || "Кинематографичный реализм",
      budgetMode: ["Экономный", "Сбалансированный", "Максимальный"].includes(settings.budgetMode) ? settings.budgetMode : "Сбалансированный",
      format: text(settings.format) || "16:9",
      authorIdea: editableText(settings.authorIdea),
    },
    concepts: Array.isArray(source.concepts) ? normalizeMusicVideoConcepts({ concepts: source.concepts }) : [],
    selectedConceptId: text(source.selectedConceptId),
    shots: Array.isArray(source.shots) ? normalizeMusicVideoShots({ shots: source.shots }) : [],
    planOutdated: Boolean(source.planOutdated),
    generationIncomplete: Boolean(source.generationIncomplete),
    generationSignature: text(source.generationSignature),
  };
}

function repairFilmProject(value) {
  if (!value) return null;
  try {
    return normalizeFilmPackage(value);
  } catch {
    return null;
  }
}

export function normalizeFilmState(value) {
  const source = value && typeof value === "object" ? value : {};
  const studioMode = source.studioMode === "music-video" ? "music-video" : "short-film";
  return {
    studioMode,
    settings: {
      genre: text(source.settings?.genre) || "Научная фантастика",
      theme: editableText(source.settings?.theme),
      mood: editableText(source.settings?.mood) || "Таинственное и кинематографичное",
      duration: text(source.settings?.duration) || "40",
      aspectRatio: text(source.settings?.aspectRatio) || "9:16",
      storyMode: source.settings?.storyMode === "universe" ? "universe" : "standalone",
    },
    manualIdea: editableText(source.manualIdea),
    manualTheme: editableText(source.manualTheme),
    themeRefinement: editableText(source.themeRefinement),
    themes: Array.isArray(source.themes) ? source.themes.map(normalizeFilmTheme).slice(0, 30) : [],
    selectedThemeId: text(source.selectedThemeId),
    ideas: Array.isArray(source.ideas) ? source.ideas.map(normalizeFilmIdea).slice(0, 50) : [],
    selectedIdeaId: text(source.selectedIdeaId),
    creativeBrief: normalizeCreativeBrief(source.creativeBrief),
    project: repairFilmProject(source.project),
    musicVideo: normalizeMusicVideo(source.musicVideo),
    assistant: normalizeFilmAssistantState(source.assistant, studioMode),
  };
}
