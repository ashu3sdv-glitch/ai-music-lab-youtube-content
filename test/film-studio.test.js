import test from "node:test";
import assert from "node:assert/strict";
import {
  invalidateShotPreparation,
  isShotReadyForVideo,
  normalizeFilmIdeas,
  normalizeFilmPackage,
  normalizeFilmState,
  normalizeFilmThemes,
  normalizeMusicVideoConcepts,
  normalizeMusicVideoShotPackage,
  normalizeMusicVideoShots,
  normalizeShotKeyframe,
  selectMusicVideoShotVersion,
  unlinkReferenceAsset,
} from "../shared/film-studio.js";
import { defaultSongSections, formatTime } from "../src/lib/audioAnalysis.js";
import { applyPendingStateUpdates, normalizeFilmAssetRecord } from "../src/lib/storage.js";

test("film ideas preserve generated and manual concepts", () => {
  const ideas = normalizeFilmIdeas({ ideas: [{ title: "Сигнал", premise: "Ответ из будущего" }] });
  assert.equal(ideas[0].title, "Сигнал");
  assert.equal(ideas[0].estimatedDuration, "40 сек");
  assert.equal(normalizeFilmState({ ideas: [{ title: "Моя идея", source: "manual" }] }).ideas[0].source, "manual");
});

test("film themes preserve a reusable five-episode direction", () => {
  const themes = normalizeFilmThemes({ themes: [{
    title: "Архив чужих воспоминаний",
    centralMystery: "Кому принадлежат воспоминания?",
    episodeSeeds: ["Память 1", "Память 2", "Память 3", "Память 4", "Память 5"],
  }] });
  assert.equal(themes[0].title, "Архив чужих воспоминаний");
  assert.equal(themes[0].episodeSeeds.length, 5);
});

test("film package keeps provider-neutral production prompts and statuses", () => {
  const project = normalizeFilmPackage({
    concept: { title: "Он помнил её" },
    shots: [{ id: "SHOT_001", imagePrompt: "portrait", motionPrompt: "slow push-in" }],
  });
  assert.equal(project.shots[0].motionPrompt, "slow push-in");
  assert.deepEqual(project.shots[0].status, { image: false, video: false, voice: false, sfx: false, final: false });
});

test("music video state stays isolated from short film projects", () => {
  const state = normalizeFilmState({
    studioMode: "music-video",
    musicVideo: {
      duration: 182,
      settings: { budgetMode: "Экономный" },
      generationIncomplete: true,
      generationSignature: "mv-plan-12345678",
    },
  });
  const twice = normalizeFilmState(state);
  assert.equal(state.studioMode, "music-video");
  assert.equal(state.musicVideo.duration, 182);
  assert.equal(state.musicVideo.settings.budgetMode, "Экономный");
  assert.equal(twice.musicVideo.generationIncomplete, true);
  assert.equal(twice.musicVideo.generationSignature, "mv-plan-12345678");
  assert.equal(normalizeFilmState({}).musicVideo.generationIncomplete, false);
  assert.equal(state.project, null);
});

test("song structure covers the full duration without gaps", () => {
  const sections = defaultSongSections(183);
  assert.equal(sections[0].start, 0);
  assert.equal(sections.at(-1).end, 183);
  sections.slice(1).forEach((section, index) => assert.equal(section.start, sections[index].end));
  assert.equal(formatTime(65), "1:05");
});

test("music video concepts and shots are normalized safely", () => {
  const concepts = normalizeMusicVideoConcepts({ concepts: [{ title: "Красная нить", signatureImages: ["лес"] }] });
  const shots = normalizeMusicVideoShots({ shots: [{ sectionId: "MV_SECTION_01", start: 0, end: 4, method: "AI_VIDEO", imagePrompt: "misty forest" }] });
  assert.equal(concepts[0].title, "Красная нить");
  assert.equal(shots[0].method, "AI_VIDEO");
  assert.equal(shots[0].ready, false);
  assert.equal(shots[0].productionReviewed, false);
  assert.equal(shots[0].selectedVersion, "original");
  assert.equal(shots[0].directorVersion.imagePrompt, "misty forest");
});

test("production director keeps risks, references and the user-selected version", () => {
  const [shot] = normalizeMusicVideoShots({ shots: [{
    sectionId: "MV_SECTION_02",
    visual: "Героиня бежит сквозь толпу",
    camera: "orbit",
    imagePrompt: "crowded square",
    videoPrompt: "camera orbits a running singer",
    generationDifficulty: "HIGH",
    regenerationRisk: "HIGH",
    continuityRisk: "MEDIUM",
    riskReasons: ["Много людей", "Бег и сложная камера"],
    referenceNeeds: ["Лицо героини", "Героиня в полный рост"],
    selectedVersion: "director",
    directorVersion: {
      visual: "Крупный план героини, толпа проходит силуэтами",
      camera: "slow push-in",
      imagePrompt: "close portrait with crowd silhouettes",
      videoPrompt: "slow push-in, silhouettes pass behind her",
      reason: "Один герой и простое движение камеры",
    },
  }] });
  assert.equal(shot.generationDifficulty, "HIGH");
  assert.equal(shot.productionReviewed, true);
  assert.equal(shot.riskReasons.length, 2);
  assert.equal(shot.referenceNeeds[0], "Лицо героини");
  assert.equal(shot.selectedVersion, "director");
  assert.match(shot.directorVersion.videoPrompt, /slow push-in/);
});

test("music video section package requires two complete Production Director reviews", () => {
  const completeShot = {
    generationDifficulty: "LOW",
    regenerationRisk: "LOW",
    continuityRisk: "LOW",
    visual: "Героиня у окна",
    imagePrompt: "woman near window",
    videoPrompt: "slow push-in",
    directorVersion: {
      visual: "Силуэт героини у окна",
      imagePrompt: "silhouette near window",
      videoPrompt: "locked camera",
    },
  };
  const shots = normalizeMusicVideoShotPackage({ shots: [completeShot, completeShot] }, "VERSE");
  assert.equal(shots.length, 2);
  assert.equal(shots.every((shot) => shot.sectionId === "VERSE" && shot.productionReviewed), true);
  assert.throws(
    () => normalizeMusicVideoShotPackage({ shots: [completeShot] }, "VERSE"),
    /неполный план секции/,
  );
  assert.throws(
    () => normalizeMusicVideoShotPackage({ shots: [completeShot, { ...completeShot, directorVersion: {} }] }, "VERSE"),
    /Production Director/,
  );
});

test("production director survives a full film-state normalization cycle", () => {
  const input = {
    studioMode: "music-video",
    musicVideo: {
      shots: [{
        visual: "Исходная версия",
        imagePrompt: "original image prompt",
        videoPrompt: "original video prompt",
        productionReviewed: true,
        generationDifficulty: "HIGH",
        regenerationRisk: "MEDIUM",
        continuityRisk: "LOW",
        selectedVersion: "director",
        ready: true,
        directorVersion: {
          visual: "Простая версия",
          camera: "locked camera",
          imagePrompt: "edited director image prompt",
          videoPrompt: "edited director video prompt",
          reason: "Меньше одновременных действий",
        },
      }],
    },
  };

  const once = normalizeFilmState(input);
  const twice = normalizeFilmState(once);
  assert.equal(twice.musicVideo.shots[0].selectedVersion, "director");
  assert.equal(twice.musicVideo.shots[0].ready, true);
  assert.equal(twice.musicVideo.shots[0].directorVersion.imagePrompt, "edited director image prompt");
  assert.equal(twice.musicVideo.shots[0].productionReviewed, true);
});

test("an incomplete director version is not presented as a completed review", () => {
  const [shot] = normalizeMusicVideoShots({ shots: [{
    visual: "Исходный кадр",
    imagePrompt: "original image",
    videoPrompt: "original motion",
    generationDifficulty: "HIGH",
    regenerationRisk: "HIGH",
    continuityRisk: "HIGH",
    directorVersion: {},
  }] });

  assert.equal(shot.productionReviewed, false);
  assert.equal(shot.selectedVersion, "original");
  assert.equal(shot.directorVersion.visual, "Исходный кадр");
});

test("legacy film shots receive safe preparation defaults without losing finished work", () => {
  const state = normalizeFilmState({
    project: {
      concept: { title: "Старый проект" },
      shots: [{ id: "SHOT_001", status: { image: true, video: true, final: true } }],
    },
    musicVideo: { shots: [{ id: "MV_SHOT_001", ready: true }] },
  });

  assert.deepEqual(state.project.shots[0].referenceAssetIds, []);
  assert.equal(state.project.shots[0].keyframe.status, "MISSING");
  assert.equal(state.project.shots[0].status.final, true);
  assert.equal(state.musicVideo.shots[0].keyframe.status, "MISSING");
  assert.equal(state.musicVideo.shots[0].ready, true);
});

test("reference links and keyframe review survive repeated normalization", () => {
  const input = {
    project: {
      concept: { title: "Проект с keyframe" },
      shots: [{
        id: "SHOT_001",
        referenceAssetIds: ["REF_1", "REF_1", "REF_2"],
        keyframe: { assetId: "KEY_1", status: "APPROVED", note: "Лицо совпадает", reviewedAt: "2026-10-01" },
      }],
    },
  };

  const twice = normalizeFilmState(normalizeFilmState(input));
  assert.deepEqual(twice.project.shots[0].referenceAssetIds, ["REF_1", "REF_2"]);
  assert.equal(twice.project.shots[0].keyframe.assetId, "KEY_1");
  assert.equal(twice.project.shots[0].keyframe.status, "APPROVED");
  assert.equal(twice.project.shots[0].keyframe.note, "Лицо совпадает");
});

test("approved status without an image is downgraded while manual bypass remains explicit", () => {
  assert.equal(normalizeShotKeyframe({ status: "APPROVED" }).status, "MISSING");
  assert.equal(normalizeShotKeyframe({ status: "UNKNOWN", assetId: "KEY_1" }).status, "MISSING");
  assert.equal(normalizeShotKeyframe({ status: "BYPASSED" }).status, "BYPASSED");
  assert.equal(isShotReadyForVideo({ status: "BYPASSED" }), true);
});

test("changing a selected version makes an approved keyframe stale and resets video completion", () => {
  const original = {
    selectedVersion: "original",
    imagePrompt: "original prompt",
    directorVersion: { imagePrompt: "director prompt" },
    referenceAssetIds: ["REF_1"],
    keyframe: { assetId: "KEY_1", status: "APPROVED" },
    ready: true,
  };

  const changed = selectMusicVideoShotVersion(original, "director");
  assert.equal(changed.selectedVersion, "director");
  assert.equal(changed.imagePrompt, "original prompt");
  assert.equal(changed.directorVersion.imagePrompt, "director prompt");
  assert.equal(changed.keyframe.status, "STALE");
  assert.equal(changed.ready, false);
});

test("editing image preparation resets only dependent production milestones", () => {
  const changed = invalidateShotPreparation({
    keyframe: { assetId: "KEY_1", status: "APPROVED" },
    status: { image: true, video: true, voice: true, sfx: true, final: true },
  });
  assert.equal(changed.keyframe.status, "STALE");
  assert.deepEqual(changed.status, { image: false, video: false, voice: true, sfx: true, final: false });
});

test("deleting a shared reference unlinks only dependent shots in both studio modes", () => {
  const state = unlinkReferenceAsset({
    project: {
      shots: [
        { id: "S1", referenceAssetIds: ["REF_1", "REF_2"], keyframe: { assetId: "K1", status: "APPROVED" }, status: { image: true, video: true, final: true } },
        { id: "S2", referenceAssetIds: ["REF_2"], keyframe: { assetId: "K2", status: "APPROVED" }, status: { image: true } },
      ],
    },
    musicVideo: {
      shots: [{ id: "M1", referenceAssetIds: ["REF_1"], keyframe: { assetId: "K3", status: "APPROVED" }, ready: true }],
    },
  }, "REF_1");

  assert.deepEqual(state.project.shots[0].referenceAssetIds, ["REF_2"]);
  assert.equal(state.project.shots[0].keyframe.status, "STALE");
  assert.equal(state.project.shots[1].keyframe.status, "APPROVED");
  assert.deepEqual(state.musicVideo.shots[0].referenceAssetIds, []);
  assert.equal(state.musicVideo.shots[0].ready, false);
});

test("film assets accept local image blobs and reject unsupported files", () => {
  const blob = new Blob(["pixels"], { type: "image/png" });
  const asset = normalizeFilmAssetRecord({ id: "REF_1", kind: "reference", category: "character", label: "Герой", fileName: "hero.png", blob });
  assert.equal(asset.id, "REF_1");
  assert.equal(asset.size, blob.size);
  assert.equal(asset.mimeType, "image/png");
  assert.equal(asset.blob, blob);
  assert.throws(() => normalizeFilmAssetRecord({ id: "BAD", blob: new Blob(["x"], { type: "text/plain" }) }), /только изображение/);
});

test("live editable fields preserve spaces and line breaks through normalization", () => {
  const state = normalizeFilmState({
    manualIdea: "Герой ",
    themeRefinement: "Строка 1\n",
    project: {
      concept: { title: "Фильм" },
      shots: [{ imagePrompt: "cinematic hero ", motionPrompt: "slow move\n" }],
    },
    musicVideo: {
      sections: [{ id: "S1", label: "Новый куплет " }],
      shots: [{
        imagePrompt: "portrait ",
        videoPrompt: "slow push-in ",
        negativePrompt: "bad hands ",
        directorVersion: { imagePrompt: "simple portrait ", videoPrompt: "locked shot " },
      }],
    },
  });

  assert.equal(state.manualIdea, "Герой ");
  assert.equal(state.themeRefinement, "Строка 1\n");
  assert.equal(state.project.shots[0].imagePrompt, "cinematic hero ");
  assert.equal(state.project.shots[0].motionPrompt, "slow move\n");
  assert.equal(state.musicVideo.sections[0].label, "Новый куплет ");
  assert.equal(state.musicVideo.shots[0].directorVersion.videoPrompt, "locked shot ");
});

test("malformed saved projects are repaired without weakening strict API validation", () => {
  assert.equal(normalizeFilmState({ project: {} }).project, null);
  assert.throws(() => normalizeFilmPackage({}), /не вернула проект фильма|отсутствует название/);
});

test("duplicate model shot IDs are made unique for stable selection and ordering", () => {
  const project = normalizeFilmPackage({
    concept: { title: "Повторяющиеся кадры" },
    shots: [{ id: "SHOT_SAME" }, { id: "SHOT_SAME" }, { id: "SHOT_SAME_2" }],
  });
  assert.deepEqual(project.shots.map((shot) => shot.id), ["SHOT_SAME", "SHOT_SAME_2", "SHOT_SAME_2_2"]);

  const musicShots = normalizeMusicVideoShots({
    shots: [{ id: "MV_SAME" }, { id: "MV_SAME" }, { id: "MV_SAME_2" }],
  });
  assert.deepEqual(musicShots.map((shot) => shot.id), ["MV_SAME", "MV_SAME_2", "MV_SAME_2_2"]);
});

test("edits queued during IndexedDB hydration are replayed over the latest stored state", () => {
  const stored = { latestResearch: "from IndexedDB", draft: "old" };
  const hydrated = applyPendingStateUpdates(stored, [
    (current) => ({ ...current, draft: "typed while loading" }),
  ]);
  assert.deepEqual(hydrated, { latestResearch: "from IndexedDB", draft: "typed while loading" });
});
