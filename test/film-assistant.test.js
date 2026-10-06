import test from "node:test";
import assert from "node:assert/strict";
import {
  applyFilmAssistantProposal,
  filmCreativeContextFingerprint,
  filmDirectionSourceFingerprint,
  filmShotsFingerprint,
  normalizeFilmAssistantAction,
  normalizeFilmAssistantResponse,
  normalizeDirectorPlan,
  selectFilmAssistantRoute,
  undoFilmAssistantAction,
} from "../shared/film-assistant.js";
import { normalizeFilmState } from "../shared/film-studio.js";

function shortShot(id, extra = {}) {
  return {
    id,
    action: `Действие ${id}`,
    camera: "locked",
    referenceAssetIds: ["REF_1"],
    keyframe: { assetId: `KEY_${id}`, status: "APPROVED", note: "", bypassReason: "", reviewedAt: "now" },
    status: { image: true, video: true, voice: false, sfx: false, final: true },
    ...extra,
  };
}

function shortState(shots = [shortShot("SHOT_001"), shortShot("SHOT_002")]) {
  return {
    studioMode: "short-film",
    project: { concept: { title: "Тест" }, shots },
    musicVideo: { shots: [] },
    assistant: {},
  };
}

function musicShot(id, sectionId, start, end, extra = {}) {
  return {
    id,
    sectionId,
    start,
    end,
    visual: `Кадр ${id}`,
    camera: "locked",
    productionReviewed: true,
    selectedVersion: "director",
    keyframe: { assetId: `KEY_${id}`, status: "APPROVED", note: "", bypassReason: "", reviewedAt: "now" },
    ready: true,
    ...extra,
  };
}

function musicState(shots = [musicShot("MV_SHOT_001", "VERSE", 0, 4), musicShot("MV_SHOT_002", "VERSE", 4, 8)]) {
  return {
    studioMode: "music-video",
    project: null,
    musicVideo: {
      sections: [
        { id: "VERSE", start: 0, end: 10 },
        { id: "CHORUS", start: 10, end: 20 },
      ],
      shots,
    },
    assistant: {},
  };
}

test("assistant accepts only whitelisted actions and creative fields", () => {
  const action = normalizeFilmAssistantAction({
    type: "update_shot",
    shotId: "SHOT_001",
    changes: { action: "Новое действие", id: "HACK", status: { final: true }, keyframe: { status: "APPROVED" } },
  });
  assert.deepEqual(action, { type: "update_shot", shotId: "SHOT_001", changes: { action: "Новое действие" } });
  assert.equal(normalizeFilmAssistantAction({ type: "run_paid_generation" }), null);
});

test("assistant response keeps advice without inventing a proposal", () => {
  const response = normalizeFilmAssistantResponse({ reply: "Оставьте камеру неподвижной", proposal: { actions: [{ type: "unknown" }] } });
  assert.equal(response.reply, "Оставьте камеру неподвижной");
  assert.equal(response.proposal, null);
});

test("assistant refuses storyboard mutations before a valid short-film project exists", () => {
  const proposal = {
    actions: [{ type: "add_shot", placement: { position: "end" }, shot: { action: "Первый кадр" } }],
  };
  assert.throws(() => applyFilmAssistantProposal({ studioMode: "short-film", project: null }, proposal), /Сначала разработайте фильм/);
  assert.throws(() => applyFilmAssistantProposal({ studioMode: "short-film", project: { concept: { title: "Пустой проект" }, shots: [] } }, proposal), /Сначала разработайте фильм/);
});

test("proposal keeps its originating studio mode and cannot be applied in another mode", () => {
  const proposal = normalizeFilmAssistantResponse({
    reply: "Добавлю кадр",
    proposal: { actions: [{ type: "add_shot", placement: { position: "end" }, shot: { action: "Новый кадр" } }] },
  }, "short-film").proposal;
  assert.equal(proposal.mode, "short-film");
  assert.throws(() => applyFilmAssistantProposal(musicState(), proposal), /другого режима/);
});

test("assistant validates storyboard enums and ignores invalid enum values", () => {
  const shortAction = normalizeFilmAssistantAction({
    type: "update_shot",
    shotId: "SHOT_001",
    changes: { continuityStatus: "BROKEN", action: "Сохранить" },
  }, "short-film");
  assert.deepEqual(shortAction.changes, { action: "Сохранить" });

  const musicAction = normalizeFilmAssistantAction({
    type: "add_shot",
    placement: { position: "end" },
    shot: { sectionId: "VERSE", priority: "URGENT", method: "MAGIC", visual: "Орнамент" },
  }, "music-video");
  assert.deepEqual(musicAction.shot, { sectionId: "VERSE", visual: "Орнамент" });
});

test("add shot inserts at the requested place and creates a clean production state", () => {
  const state = shortState();
  const baseFingerprint = filmShotsFingerprint(state.project.shots);
  const result = applyFilmAssistantProposal(state, {
    summary: "Добавить деталь руки",
    baseFingerprint,
    actions: [{
      type: "add_shot",
      placement: { position: "after", anchorShotId: "SHOT_001" },
      shot: { action: "На руке появляется орнамент", camera: "macro close-up", duration: "3 сек" },
    }],
  }, { idFactory: () => "NEW" });
  assert.deepEqual(result.state.project.shots.map((shot) => shot.id), ["SHOT_001", "SHOT_NEW", "SHOT_002"]);
  assert.equal(result.state.project.shots[1].keyframe.status, "MISSING");
  assert.equal(result.state.project.shots[1].status.final, false);
  assert.equal(result.state.project.planOutdated, true);
});

test("updating a shot makes its approved keyframe stale and resets dependent statuses", () => {
  const state = shortState();
  const result = applyFilmAssistantProposal(state, {
    summary: "Изменить свет",
    actions: [{ type: "update_shot", shotId: "SHOT_001", changes: { lighting: "Мягкий красный свет" } }],
  });
  const shot = result.state.project.shots[0];
  assert.equal(shot.lighting, "Мягкий красный свет");
  assert.equal(shot.keyframe.status, "STALE");
  assert.equal(shot.status.video, false);
  assert.equal(shot.status.final, false);
});

test("move keeps the approved image while changing only the order", () => {
  const state = shortState();
  const result = applyFilmAssistantProposal(state, {
    summary: "Переставить второй кадр",
    actions: [{ type: "move_shot", shotId: "SHOT_002", placement: { position: "before", anchorShotId: "SHOT_001" } }],
  });
  assert.deepEqual(result.state.project.shots.map((shot) => shot.id), ["SHOT_002", "SHOT_001"]);
  assert.equal(result.state.project.shots[0].keyframe.status, "APPROVED");
});

test("duplicate preserves references but never shares a keyframe or completion state", () => {
  const state = shortState();
  const result = applyFilmAssistantProposal(state, {
    summary: "Дублировать первый кадр",
    actions: [{ type: "duplicate_shot", shotId: "SHOT_001", placement: { position: "after", anchorShotId: "SHOT_001" } }],
  }, { idFactory: () => "COPY" });
  const copy = result.state.project.shots[1];
  assert.equal(copy.id, "SHOT_COPY");
  assert.deepEqual(copy.referenceAssetIds, ["REF_1"]);
  assert.equal(copy.keyframe.assetId, "");
  assert.equal(copy.status.image, false);
  assert.equal(copy.status.final, false);
});

test("assistant refuses stale proposals, missing anchors and deleting the last shot", () => {
  const state = shortState();
  assert.throws(() => applyFilmAssistantProposal(state, {
    baseFingerprint: "old-plan",
    actions: [{ type: "delete_shot", shotId: "SHOT_001" }],
  }), /уже изменился/);
  assert.throws(() => applyFilmAssistantProposal(state, {
    actions: [{ type: "move_shot", shotId: "SHOT_001", placement: { position: "after", anchorShotId: "SHOT_404" } }],
  }), /больше не найден/);
  assert.throws(() => applyFilmAssistantProposal(shortState([shortShot("ONLY")]), {
    actions: [{ type: "delete_shot", shotId: "ONLY" }],
  }), /последний кадр/);
});

test("a failed multi-action proposal leaves the original state untouched", () => {
  const state = shortState();
  assert.throws(() => applyFilmAssistantProposal(state, {
    actions: [
      { type: "update_shot", shotId: "SHOT_001", changes: { action: "Временная правка" } },
      { type: "delete_shot", shotId: "SHOT_404" },
    ],
  }), /больше не найден/);
  assert.equal(state.project.shots[0].action, "Действие SHOT_001");
});

test("undo restores the exact previous storyboard and refuses to overwrite later edits", () => {
  const state = shortState();
  const applied = applyFilmAssistantProposal(state, {
    summary: "Удалить второй кадр",
    actions: [{ type: "delete_shot", shotId: "SHOT_002" }],
  });
  const restored = undoFilmAssistantAction(applied.state, applied.undo);
  assert.deepEqual(restored.project.shots, state.project.shots);
  const manuallyChanged = { ...applied.state, project: { ...applied.state.project, shots: [shortShot("OTHER")] } };
  assert.throws(() => undoFilmAssistantAction(manuallyChanged, applied.undo), /небезопасна/);
});

test("assistant chat, pending proposal and undo survive film-state normalization", () => {
  const state = shortState();
  const applied = applyFilmAssistantProposal(state, {
    summary: "Удалить второй кадр",
    actions: [{ type: "delete_shot", shotId: "SHOT_002" }],
  });
  const normalized = normalizeFilmState({
    ...applied.state,
    assistant: {
      route: "creative",
      activeShotId: "SHOT_001",
      messages: [{ id: "M1", role: "user", text: "Сделай сцену сильнее" }],
      pendingProposal: { summary: "Обновить кадр", actions: [{ type: "update_shot", shotId: "SHOT_001", changes: { camera: "slow push-in" } }] },
      undo: applied.undo,
    },
  });
  assert.equal(normalized.assistant.route, "creative");
  assert.equal(normalized.assistant.messages.length, 1);
  assert.equal(normalized.assistant.messages[0].mode, "short-film");
  assert.equal(normalized.assistant.pendingProposal.actions[0].type, "update_shot");
  assert.equal(normalized.assistant.pendingProposal.mode, "short-film");
  assert.equal(normalized.assistant.undo.beforeShots.length, 2);
});

test("assistant messages preserve their mode and legacy messages inherit the current mode", () => {
  const state = normalizeFilmState({
    studioMode: "music-video",
    assistant: {
      messages: [
        { id: "OLD", role: "user", text: "Старое сообщение" },
        { id: "SHORT", role: "assistant", text: "Ответ про фильм", mode: "short-film" },
      ],
    },
  });
  assert.equal(state.assistant.messages[0].mode, "music-video");
  assert.equal(state.assistant.messages[1].mode, "short-film");
});

test("auto routing uses economy for normal commands and creative model for major rewrites", () => {
  assert.equal(selectFilmAssistantRoute("Добавь кадр после третьего", "auto"), "economy");
  assert.equal(selectFilmAssistantRoute("Перепиши сценарий и усили драматургию", "auto"), "creative");
  assert.equal(selectFilmAssistantRoute("Перепиши историю полностью", "auto"), "creative");
  assert.equal(selectFilmAssistantRoute("Создай новый сюжет для этого фильма", "auto"), "creative");
  assert.equal(selectFilmAssistantRoute("Сделай сценарий заново", "auto"), "creative");
  assert.equal(selectFilmAssistantRoute("Перепиши сценарий", "economy"), "economy");
});

test("music-video changes use the music board and preserve the short-film project", () => {
  const state = {
    ...musicState([musicShot("MV_SHOT_001", "VERSE", 0, 4, { visual: "Певица у окна" })]),
    project: { concept: { title: "Фильм" }, shots: [shortShot("SHOT_001")] },
  };
  const result = applyFilmAssistantProposal(state, {
    actions: [{ type: "add_shot", placement: { position: "after", anchorShotId: "MV_SHOT_001" }, shot: { visual: "Орнамент покрывает стекло", videoPrompt: "ornament grows slowly" } }],
  }, { idFactory: () => "NEW" });
  assert.equal(result.state.musicVideo.shots.length, 2);
  assert.equal(result.state.musicVideo.shots[1].id, "MV_SHOT_NEW");
  assert.equal(result.state.musicVideo.shots[1].sectionId, "VERSE");
  assert.equal(result.state.musicVideo.shots[1].start, 4);
  assert.equal(result.state.musicVideo.shots[1].end, 8);
  assert.equal(result.state.project.shots.length, 1);
});

test("music-video add requires a real section and keeps time inside its boundaries", () => {
  assert.throws(() => applyFilmAssistantProposal(musicState(), {
    actions: [{ type: "add_shot", placement: { position: "end" }, shot: { visual: "Нет секции" } }],
  }), /границы времени/);

  assert.throws(() => applyFilmAssistantProposal(musicState(), {
    actions: [{
      type: "add_shot",
      placement: { position: "end" },
      shot: { sectionId: "VERSE", start: 8, end: 12, visual: "Выходит за куплет" },
    }],
  }), /внутри части песни/);

  assert.throws(() => applyFilmAssistantProposal(musicState(), {
    actions: [{
      type: "add_shot",
      placement: { position: "end" },
      shot: { sectionId: "VERSE", start: 6, end: 6, visual: "Нулевая длина" },
    }],
  }), /позже начала/);
});

test("music-video start and end placement stay local to the selected song section", () => {
  const state = musicState([
    musicShot("MV_SHOT_VERSE", "VERSE", 0, 4),
    musicShot("MV_SHOT_CHORUS_1", "CHORUS", 10, 14),
    musicShot("MV_SHOT_CHORUS_2", "CHORUS", 14, 18),
  ]);

  const verseEnd = applyFilmAssistantProposal(state, {
    actions: [{
      type: "add_shot",
      placement: { position: "end" },
      shot: { sectionId: "VERSE", start: 6, end: 9, visual: "Финал куплета" },
    }],
  }, { idFactory: () => "VERSE_END" });
  assert.deepEqual(verseEnd.state.musicVideo.shots.map((shot) => shot.id), [
    "MV_SHOT_VERSE", "MV_SHOT_VERSE_END", "MV_SHOT_CHORUS_1", "MV_SHOT_CHORUS_2",
  ]);

  const chorusStart = applyFilmAssistantProposal(state, {
    actions: [{
      type: "add_shot",
      placement: { position: "start" },
      shot: { sectionId: "CHORUS", start: 10, end: 12, visual: "Начало припева" },
    }],
  }, { idFactory: () => "CHORUS_START" });
  assert.deepEqual(chorusStart.state.musicVideo.shots.map((shot) => shot.id), [
    "MV_SHOT_VERSE", "MV_SHOT_CHORUS_START", "MV_SHOT_CHORUS_1", "MV_SHOT_CHORUS_2",
  ]);

  const emptyVerse = musicState([musicShot("MV_SHOT_ONLY_CHORUS", "CHORUS", 10, 14)]);
  const insertedBeforeLaterSection = applyFilmAssistantProposal(emptyVerse, {
    actions: [{
      type: "add_shot",
      placement: { position: "end" },
      shot: { sectionId: "VERSE", start: 0, end: 4, visual: "Первый кадр куплета" },
    }],
  }, { idFactory: () => "FIRST_VERSE" });
  assert.deepEqual(insertedBeforeLaterSection.state.musicVideo.shots.map((shot) => shot.id), [
    "MV_SHOT_FIRST_VERSE", "MV_SHOT_ONLY_CHORUS",
  ]);
});

test("music-video update cannot change section and validates changed timing", () => {
  const normalized = normalizeFilmAssistantAction({
    type: "update_shot",
    shotId: "MV_SHOT_001",
    changes: { sectionId: "CHORUS", visual: "Новый образ" },
  }, "music-video");
  assert.deepEqual(normalized.changes, { visual: "Новый образ" });

  assert.throws(() => applyFilmAssistantProposal(musicState(), {
    actions: [{ type: "update_shot", shotId: "MV_SHOT_001", changes: { start: 9 } }],
  }), /позже начала/);

  assert.throws(() => applyFilmAssistantProposal(musicState(), {
    actions: [{ type: "update_shot", shotId: "MV_SHOT_001", changes: { start: 1, end: 11 } }],
  }), /внутри части песни/);
});

test("music-video content updates invalidate director review and selected version", () => {
  const result = applyFilmAssistantProposal(musicState(), {
    actions: [{ type: "update_shot", shotId: "MV_SHOT_001", changes: { visual: "Героиня смотрит в камеру" } }],
  });
  const shot = result.state.musicVideo.shots[0];
  assert.equal(shot.productionReviewed, false);
  assert.equal(shot.selectedVersion, "original");
  assert.equal(shot.ready, false);
  assert.equal(shot.keyframe.status, "STALE");
});

test("music-video move and duplicate stay inside one section and use relative placement", () => {
  const state = musicState([
    musicShot("MV_SHOT_001", "VERSE", 0, 4),
    musicShot("MV_SHOT_002", "VERSE", 4, 8),
    musicShot("MV_SHOT_003", "CHORUS", 10, 14),
  ]);

  assert.throws(() => applyFilmAssistantProposal(state, {
    actions: [{ type: "move_shot", shotId: "MV_SHOT_001", placement: { position: "start" } }],
  }), /только до или после/);

  assert.throws(() => applyFilmAssistantProposal(state, {
    actions: [{ type: "move_shot", shotId: "MV_SHOT_001", placement: { position: "before", anchorShotId: "MV_SHOT_003" } }],
  }), /внутри одной части песни/);

  assert.throws(() => applyFilmAssistantProposal(state, {
    actions: [{ type: "duplicate_shot", shotId: "MV_SHOT_001", placement: { position: "after", anchorShotId: "MV_SHOT_003" } }],
  }), /внутри одной части песни/);

  const moved = applyFilmAssistantProposal(state, {
    actions: [{ type: "move_shot", shotId: "MV_SHOT_002", placement: { position: "before", anchorShotId: "MV_SHOT_001" } }],
  });
  assert.deepEqual(moved.state.musicVideo.shots.map((shot) => shot.id), ["MV_SHOT_002", "MV_SHOT_001", "MV_SHOT_003"]);
});

test("director room keeps three canonical approaches and strips unknown fields", () => {
  const plan = normalizeDirectorPlan({
    title: "Как поставить сцену",
    recommendation: "cinematic",
    options: [
      { id: "simple", summary: "Один спокойный план", generationRisk: "LOW", shotPlan: ["Общий план", "Деталь предмета"], paidRunAuthorized: true },
      { id: "cinematic", summary: "Контраст общего и крупного", generationRisk: "MEDIUM", camera: "Медленное приближение" },
      { id: "bold", summary: "Субъективная камера", generationRisk: "HIGH", secret: "remove" },
    ],
    executeWeave: true,
  });

  assert.equal(plan.complete, true);
  assert.equal(plan.recommendation, "cinematic");
  assert.deepEqual(plan.options.map((option) => option.id), ["simple", "cinematic", "bold"]);
  assert.equal(plan.options[0].paidRunAuthorized, undefined);
  assert.equal(plan.options[2].secret, undefined);
  assert.deepEqual(plan.options[0].shotPlan, ["Общий план", "Деталь предмета"]);
});

test("an incomplete director response is preserved but cannot masquerade as all three variants", () => {
  const response = normalizeFilmAssistantResponse({
    reply: "Успел подготовить один вариант",
    directorPlan: { options: [{ id: "cinematic", summary: "Тихая напряжённая сцена" }] },
  });
  assert.equal(response.directorPlan.options.length, 1);
  assert.equal(response.directorPlan.complete, false);
  assert.equal(response.directorPlan.status, "draft");
});

test("director-room requests use the creative model route", () => {
  assert.equal(selectFilmAssistantRoute("Предложи три постановки этой сцены", "auto"), "creative");
  assert.equal(selectFilmAssistantRoute("Сделай режиссёрский разбор фильма", "auto"), "creative");
  assert.equal(selectFilmAssistantRoute("Объясни свет и камеру", "auto"), "creative");
});

test("direction fingerprint follows the selected idea while creative context also follows the project", () => {
  const state = {
    settings: { mood: "Тревожно" },
    themes: [{ id: "T1", title: "Дом" }],
    selectedThemeId: "T1",
    ideas: [{ id: "I1", title: "Игрушка", premise: "Робот находит игрушку" }],
    selectedIdeaId: "I1",
    project: { concept: { title: "Черновик" }, story: "Версия 1", scenes: [], shots: [] },
  };
  const source = filmDirectionSourceFingerprint(state);
  const context = filmCreativeContextFingerprint(state, "short-film");
  assert.equal(filmDirectionSourceFingerprint({ ...state, project: { ...state.project, story: "Версия 2" } }), source);
  assert.notEqual(filmCreativeContextFingerprint({ ...state, project: { ...state.project, story: "Версия 2" } }, "short-film"), context);
  assert.notEqual(filmDirectionSourceFingerprint({ ...state, selectedIdeaId: "I2" }), source);

  const withShot = {
    ...state,
    project: {
      ...state.project,
      shots: [{ id: "SHOT-1", action: "Робот открывает дверь", keyframe: { status: "MISSING", assetId: "" } }],
    },
  };
  const shotContext = filmCreativeContextFingerprint(withShot, "short-film");
  const withUploadedReference = {
    ...withShot,
    project: {
      ...withShot.project,
      shots: [{
        ...withShot.project.shots[0],
        keyframe: { status: "READY", assetId: "asset-1" },
        generationStatus: "READY",
      }],
    },
  };
  assert.equal(filmCreativeContextFingerprint(withUploadedReference, "short-film"), shotContext);
  assert.notEqual(filmCreativeContextFingerprint({
    ...withShot,
    project: { ...withShot.project, shots: [{ ...withShot.project.shots[0], action: "Робот закрывает дверь" }] },
  }, "short-film"), shotContext);
});

test("approved direction and latest director plan survive film-state normalization", () => {
  const state = normalizeFilmState({
    settings: { mood: "Тревожно" },
    ideas: [{ id: "I1", title: "Игрушка" }],
    selectedIdeaId: "I1",
    creativeBrief: {
      id: "cinematic",
      summary: "Медленное раскрытие через деталь",
      sourceFingerprint: "source-1",
      sourceIdeaId: "I1",
      approvedAt: "2026-10-04T10:00:00.000Z",
    },
    assistant: {
      directorPlan: {
        mode: "short-film",
        options: [
          { id: "simple", summary: "Просто" },
          { id: "cinematic", summary: "Кинематографично" },
          { id: "bold", summary: "Смело" },
        ],
        selectedOptionId: "cinematic",
        status: "approved",
      },
    },
  });
  assert.equal(state.creativeBrief.id, "cinematic");
  assert.equal(state.creativeBrief.sourceIdeaId, "I1");
  assert.equal(state.assistant.directorPlan.complete, true);
  assert.equal(state.assistant.directorPlan.status, "approved");
});
