import { useEffect, useMemo, useState } from "react";
import { callApi } from "../lib/api.js";
import { useFilmAssets } from "../lib/storage.js";
import CopyButton from "./CopyButton.jsx";
import {
  invalidateShotPreparation,
  normalizeFilmIdea,
  normalizeFilmPackage,
  normalizeFilmTheme,
  unlinkReferenceAsset,
} from "../../shared/film-studio.js";
import { KEYFRAME_LABELS, ReferencePack, ShotKeyframeReview } from "./FilmPreparation.jsx";
import MusicVideoDirector from "./MusicVideoDirector.jsx";
import FilmAssistant from "./FilmAssistant.jsx";
import FilmStoryboardStrip from "./FilmStoryboardStrip.jsx";
import { filmDirectionSourceFingerprint } from "../../shared/film-assistant.js";

const STATUS_LABELS = { image: "Изображение", video: "Видео", voice: "Голос", sfx: "Звук", final: "Готово" };

function TextList({ items }) {
  if (!items?.length) return <span className="muted">—</span>;
  return <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

export default function FilmStudioTab({ state, setState, stateReady = true }) {
  const data = state || {};
  const studioMode = data.studioMode || "short-film";
  const settings = data.settings || {};
  const ideas = data.ideas || [];
  const themes = data.themes || [];
  const project = data.project;
  const selectedTheme = useMemo(() => themes.find((theme) => theme.id === data.selectedThemeId), [themes, data.selectedThemeId]);
  const selectedIdea = useMemo(() => ideas.find((idea) => idea.id === data.selectedIdeaId), [ideas, data.selectedIdeaId]);
  const directionSourceFingerprint = filmDirectionSourceFingerprint(data);
  const approvedCreativeBrief = data.creativeBrief?.sourceFingerprint === directionSourceFingerprint ? data.creativeBrief : null;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preparationBusy, setPreparationBusy] = useState(0);
  const {
    assets: filmAssets,
    loading: filmAssetsLoading,
    error: filmAssetsError,
    saveAsset,
    removeAsset,
  } = useFilmAssets();

  const patch = (next) => setState((current) => ({ ...(current || {}), ...next }));
  const patchSettings = (next) => patch({ settings: { ...settings, ...next } });
  const workBusy = Boolean(busy) || preparationBusy > 0;
  const setPreparationOperation = (active) => setPreparationBusy((current) => Math.max(0, current + (active ? 1 : -1)));

  function replaceProject(nextProject, next = {}) {
    patch({ ...next, project: nextProject });
  }

  useEffect(() => {
    if (!stateReady || filmAssetsLoading) return undefined;
    const timer = setTimeout(() => {
      const activeIds = new Set([
        ...(project?.shots || []),
        ...(data.musicVideo?.shots || []),
        ...(data.assistant?.undo?.beforeShots || []),
      ].map((shot) => shot.keyframe?.assetId).filter(Boolean));
      const orphanIds = filmAssets
        .filter((asset) => asset.kind === "keyframe" && !activeIds.has(asset.id))
        .map((asset) => asset.id);
      if (!orphanIds.length) return;
      Promise.allSettled(orphanIds.map((id) => removeAsset(id))).then((results) => {
        if (results.some((result) => result.status === "rejected")) {
          setError("Часть неиспользуемых keyframe не удалось удалить из локального хранилища");
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [stateReady, filmAssetsLoading, filmAssets, project?.shots, data.musicVideo?.shots, data.assistant?.undo?.beforeShots, removeAsset]);

  async function run(label, work) {
    setError("");
    setBusy(label);
    try { await work(); } catch (cause) { setError(cause.message || "Не удалось выполнить запрос"); } finally { setBusy(""); }
  }

  function addManualIdea() {
    const raw = data.manualIdea?.trim();
    if (!raw) return;
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
    const idea = normalizeFilmIdea({
      id: crypto.randomUUID(),
      source: "manual",
      title: lines[0].slice(0, 100),
      premise: lines.slice(1).join(" ") || lines[0],
      estimatedDuration: `${settings.duration || 40} сек`,
    });
    replaceProject(null, { ideas: [idea, ...ideas], selectedIdeaId: idea.id, manualIdea: "" });
  }

  function addManualTheme() {
    const raw = data.manualTheme?.trim();
    if (!raw) return;
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
    const theme = normalizeFilmTheme({
      id: crypto.randomUUID(),
      source: "manual",
      title: lines[0].slice(0, 100),
      universe: lines.slice(1).join(" ") || lines[0],
      centralMystery: "Уточняется вместе с автором",
      episodeEngine: "Пять самостоятельных историй внутри выбранного мира",
    });
    replaceProject(null, { themes: [theme, ...themes], selectedThemeId: theme.id, manualTheme: "", themeRefinement: "" });
  }

  function removeIdea(id) {
    const next = {
      ideas: ideas.filter((idea) => idea.id !== id),
      selectedIdeaId: data.selectedIdeaId === id ? "" : data.selectedIdeaId,
    };
    if (data.selectedIdeaId === id) replaceProject(null, next);
    else patch(next);
  }

  const generateThemes = () => run("Предлагаю шесть направлений сериала…", async () => {
    const responses = [];
    for (const batchIndex of [0, 1, 2]) {
      setBusy(`Создаю темы: ${batchIndex * 2 + 1}–${batchIndex * 2 + 2} из 6…`);
      responses.push(await callApi("generate-script", { mode: "film-themes", settings, count: 2, batchIndex }));
    }
    const generated = responses.flatMap((response) => response.themes || []).slice(0, 6)
      .map((theme) => ({ ...theme, id: crypto.randomUUID(), source: "generated" }));
    if (generated.length < 6) throw new Error(`Получено тем: ${generated.length}/6. Нажмите кнопку ещё раз.`);
    patch({ themes: [...generated, ...themes].slice(0, 30), selectedThemeId: generated[0]?.id || data.selectedThemeId, themeRefinement: "" });
  });

  const generateIdeas = () => run("Создаю пять эпизодов выбранной серии…", async () => {
    if (!selectedTheme) throw new Error("Сначала отметьте тему сериала");
    const responses = [];
    for (const batch of [{ count: 3, batchIndex: 0 }, { count: 2, batchIndex: 1 }]) {
      setBusy(batch.batchIndex === 0 ? "Создаю эпизоды 1–3 из 5…" : "Создаю эпизоды 4–5 из 5…");
      responses.push(await callApi("generate-script", {
        mode: "film-ideas",
        settings: { ...settings, storyMode: "universe" },
        selectedTheme,
        refinement: data.themeRefinement,
        ...batch,
      }));
    }
    const generated = responses.flatMap((response) => response.ideas || []).slice(0, 5)
      .map((idea) => ({ ...idea, id: crypto.randomUUID(), source: "generated" }));
    if (generated.length < 5) throw new Error(`Получено эпизодов: ${generated.length}/5. Нажмите кнопку ещё раз.`);
    patch({ ideas: [...generated, ...ideas].slice(0, 50), selectedIdeaId: generated[0]?.id || data.selectedIdeaId });
  });

  const generatePackage = () => run("Готовлю сценарий, кадры и производственный пакет…", async () => {
    if (!selectedIdea) throw new Error("Сначала выберите идею");
    const response = await callApi("generate-script", {
      mode: "film-package",
      settings: { ...settings, storyMode: selectedTheme ? "universe" : settings.storyMode },
      idea: selectedIdea,
      selectedTheme,
      creativeBrief: approvedCreativeBrief,
    });
    replaceProject(normalizeFilmPackage(response.project));
  });

  function patchShot(shotIndex, next, expectedShotId = project?.shots?.[shotIndex]?.id) {
    setState((current) => {
      const currentProject = current?.project;
      const currentShot = currentProject?.shots?.[shotIndex];
      if (!currentShot || (expectedShotId && currentShot.id !== expectedShotId)) return current;
      const patchValue = typeof next === "function" ? next(currentShot) : next;
      const shots = currentProject.shots.slice();
      shots[shotIndex] = { ...currentShot, ...patchValue };
      return { ...(current || {}), project: { ...currentProject, shots } };
    });
  }

  function toggleStatus(shotIndex, field) {
    patchShot(shotIndex, (shot) => ({ status: { ...shot.status, [field]: !shot.status?.[field] } }));
  }

  async function deleteReferenceAsset(assetId) {
    setState((current) => unlinkReferenceAsset(current, assetId));
    await removeAsset(assetId);
  }

  const shortFilmRequirements = useMemo(() => {
    if (!project) return [];
    return [
      ...project.characters.map((character) => ({
        id: `character-${character.id}`,
        title: `Персонаж: ${character.name || character.id} — лицо, ¾ и профиль`,
        prompt: character.masterPrompt,
      })),
      ...project.characters.filter((character) => character.clothing).map((character) => ({
        id: `costume-${character.id}`,
        title: `Одежда: ${character.name || character.id}`,
        prompt: character.masterPrompt,
      })),
      ...project.locations.map((location) => ({
        id: `location-${location.id}`,
        title: `Локация: ${location.name || location.id}`,
        prompt: location.masterPrompt,
      })),
      ...(project.worldBible?.visualStyle ? [{
        id: "visual-style",
        title: "Образец визуального стиля",
        prompt: project.worldBible.visualStyle,
      }] : []),
    ];
  }, [project]);

  const musicVideoRequirements = useMemo(() => [
    ...new Set((data.musicVideo?.shots || []).flatMap((shot) => shot.referenceNeeds || [])),
  ], [data.musicVideo?.shots]);

  const currentShots = studioMode === "music-video" ? (data.musicVideo?.shots || []) : (project?.shots || []);
  const currentRequirements = studioMode === "music-video" ? musicVideoRequirements : shortFilmRequirements;

  function selectAssistantShot(shotId) {
    setState((current) => ({
      ...(current || {}),
      assistant: { ...(current?.assistant || {}), activeShotId: shotId },
    }));
  }

  function moveStoryboardShot(shotId, direction) {
    const visibleIndex = currentShots.findIndex((shot) => shot.id === shotId);
    const visibleTarget = currentShots[visibleIndex + direction];
    if (studioMode === "music-video" && visibleTarget && visibleTarget.sectionId !== currentShots[visibleIndex]?.sectionId) {
      setError("Кадры музыкального клипа можно переставлять только внутри одной части песни");
      return;
    }
    setState((current) => {
      const mode = current?.studioMode === "music-video" ? "music-video" : "short-film";
      const shots = mode === "music-video" ? current?.musicVideo?.shots : current?.project?.shots;
      if (!Array.isArray(shots)) return current;
      const index = shots.findIndex((shot) => shot.id === shotId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= shots.length) return current;
      if (mode === "music-video" && shots[index].sectionId !== shots[nextIndex].sectionId) return current;
      const reordered = shots.slice();
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      const assistant = { ...(current.assistant || {}), pendingProposal: null, undo: null, activeShotId: shotId };
      return mode === "music-video"
        ? { ...current, assistant, musicVideo: { ...(current.musicVideo || {}), shots: reordered, planOutdated: true } }
        : { ...current, assistant, project: { ...(current.project || {}), shots: reordered, planOutdated: true } };
    });
  }

  function switchStudioMode(nextMode) {
    if (nextMode === studioMode) return;
    setState((current) => ({
      ...(current || {}),
      studioMode: nextMode,
      assistant: {
        ...(current?.assistant || {}),
        activeShotId: "",
        pendingProposal: null,
        undo: null,
      },
    }));
  }

  function canCreateVideo(shot) {
    if (shot.keyframe?.status === "BYPASSED") return true;
    return shot.keyframe?.status === "APPROVED"
      && filmAssets.some((asset) => asset.id === shot.keyframe.assetId && asset.kind === "keyframe");
  }

  const modeSwitch = <div className="card mv-mode-switch" aria-label="Режим Film Studio">
    <button type="button" aria-pressed={studioMode === "short-film"} className={studioMode === "short-film" ? "active" : "secondary"} onClick={() => switchStudioMode("short-film")}>Короткий фильм</button>
    <button type="button" aria-pressed={studioMode === "music-video"} className={studioMode === "music-video" ? "active" : "secondary"} onClick={() => switchStudioMode("music-video")}>Музыкальный клип</button>
  </div>;

  const preparationWorkspace = <>
    <ReferencePack
      assets={filmAssets}
      requirements={currentRequirements}
      loading={filmAssetsLoading}
      storageError={filmAssetsError}
      onSaveAsset={saveAsset}
      onDeleteReference={deleteReferenceAsset}
    />
    <FilmStoryboardStrip
      shots={currentShots}
      assets={filmAssets}
      activeShotId={data.assistant?.activeShotId || ""}
      onSelect={selectAssistantShot}
      onMove={moveStoryboardShot}
      canMove={(shot, index, direction) => studioMode !== "music-video"
        || currentShots[index + direction]?.sectionId === shot.sectionId}
    />
  </>;

  if (studioMode === "music-video") return <div className="film-studio-workspace">
    <main className="film-studio-main">
      {modeSwitch}
      {preparationWorkspace}
      <MusicVideoDirector
        data={data.musicVideo}
        setData={(next) => setState((current) => ({ ...(current || {}), musicVideo: typeof next === "function" ? next(current?.musicVideo || {}) : next }))}
        filmAssets={filmAssets}
        filmAssetsLoading={filmAssetsLoading}
        filmAssetsError={filmAssetsError}
        onSaveAsset={saveAsset}
        onDeleteAsset={removeAsset}
        preparationBusy={preparationBusy}
        onPreparationBusyChange={setPreparationOperation}
        activeShotId={data.assistant?.activeShotId || ""}
      />
    </main>
    <FilmAssistant state={data} setState={setState} />
  </div>;

  return (
    <div className="film-studio-workspace">
      <main className="film-studio-main">
        {modeSwitch}
      <div className="card film-hero">
        <div>
          <span className="film-kicker">AI FILM STUDIO</span>
          <h2>Короткие фантастические фильмы</h2>
          <p className="muted">Идея → сценарий → персонажи и мир → 6–12 кадров → промпты → производство. Финальные изображения, видео и голос создаются во внешних сервисах.</p>
          <span className="film-badge">Тексты и сценарии: Claude Sonnet 5</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><strong>1. Направление фильма</strong><span className="muted small">По умолчанию: 40 сек · 9:16</span></div>
        <div className="film-settings-grid">
          <div className="field"><label>Жанр</label><select value={settings.genre || "Научная фантастика"} onChange={(e) => patchSettings({ genre: e.target.value })}><option>Научная фантастика</option><option>Андроиды</option><option>Космос</option><option>Путешествия во времени</option><option>Мистика</option><option>Постапокалипсис</option><option>Триллер</option><option>Драма</option></select></div>
          <div className="field"><label>Тема</label><input value={settings.theme || ""} onChange={(e) => patchSettings({ theme: e.target.value })} placeholder="Например: андроид помнит прошлую жизнь" /></div>
          <div className="field"><label>Настроение</label><input value={settings.mood || ""} onChange={(e) => patchSettings({ mood: e.target.value })} /></div>
          <div className="field"><label>Длительность, секунд</label><select value={settings.duration || "40"} onChange={(e) => patchSettings({ duration: e.target.value })}><option value="30">30</option><option value="40">40</option><option value="50">50</option></select></div>
          <div className="field"><label>Формат</label><select value={settings.aspectRatio || "9:16"} onChange={(e) => patchSettings({ aspectRatio: e.target.value })}><option value="9:16">9:16 · Shorts</option><option value="16:9">16:9 · на будущее</option></select></div>
          <div className="field"><label>Тип истории</label><select value={settings.storyMode || "standalone"} onChange={(e) => patchSettings({ storyMode: e.target.value })}><option value="standalone">Самостоятельная история</option><option value="universe">Общая вселенная / серия</option></select></div>
        </div>
        <button onClick={generateThemes} disabled={!!busy}>Предложить 6 тем для сериала</button>
      </div>

      <div className="card">
        <div className="card-head"><strong>2. Своя тема сериала</strong><span className="muted small">Если ни одно предложение не подходит</span></div>
        <textarea className="film-idea-input" value={data.manualTheme || ""} onChange={(e) => patch({ manualTheme: e.target.value })} placeholder={'Первая строка — название темы или вселенной.\nНиже опишите, о чём должны быть серии.'} />
        <button onClick={addManualTheme} disabled={!data.manualTheme?.trim() || workBusy}>Добавить мою тему</button>
      </div>

      {!!themes.length && <div className="card">
        <div className="card-head"><strong>3. Выберите тему</strong><span className="muted small">Одна тема → пять разных эпизодов</span></div>
        <div className="film-theme-grid">
          {themes.map((theme) => <label className={`film-theme-card ${theme.id === data.selectedThemeId ? "selected" : ""}`} key={theme.id}>
            <input type="radio" name="film-theme" disabled={workBusy} checked={theme.id === data.selectedThemeId} onChange={() => replaceProject(null, { selectedThemeId: theme.id })} />
            <span className="film-source">{theme.source === "manual" ? "МОЯ ТЕМА" : "ПРЕДЛОЖЕНИЕ AI"}</span>
            <strong>{theme.title}</strong>
            <span>{theme.universe}</span>
            {theme.centralMystery && <span><b>Главная загадка:</b> {theme.centralMystery}</span>}
            {theme.episodeEngine && <span><b>Почему получится серия:</b> {theme.episodeEngine}</span>}
            {theme.episodeSeeds?.length > 0 && <small>Примеры: {theme.episodeSeeds.join(" · ")}</small>}
          </label>)}
        </div>
        <div className="field"><label>Моё уточнение к выбранной теме — необязательно</label><textarea className="film-refinement" value={data.themeRefinement || ""} onChange={(e) => patch({ themeRefinement: e.target.value })} placeholder="Например: главный герой — обычный человек; меньше диалогов; больше тайны; финал каждой серии должен удивлять" /></div>
        <button onClick={generateIdeas} disabled={!!busy || !selectedTheme}>Создать 5 эпизодов по выбранной теме</button>
      </div>}

      <div className="card">
        <div className="card-head"><strong>4. Своя идея отдельного эпизода</strong><span className="muted small">Можно записать даже сырой набросок</span></div>
        <textarea className="film-idea-input" value={data.manualIdea || ""} onChange={(e) => patch({ manualIdea: e.target.value })} placeholder={'Первая строка — рабочее название.\nНиже опишите идею, сцену, героя или неожиданный финал.'} />
        <button onClick={addManualIdea} disabled={!data.manualIdea?.trim() || workBusy}>Добавить мою идею</button>
      </div>

      {!!ideas.length && <div className="card">
        <div className="card-head"><strong>5. Эпизоды</strong><span className="muted small">Выберите один для подробной разработки</span></div>
        <div className="film-idea-grid">
          {ideas.map((idea) => <div className={`film-idea-card ${idea.id === data.selectedIdeaId ? "selected" : ""}`} key={idea.id}>
            <button className="film-idea-select" disabled={workBusy} onClick={() => replaceProject(null, { selectedIdeaId: idea.id })}>
              <span className="film-source">{idea.source === "manual" ? "МОЯ ИДЕЯ" : "СГЕНЕРИРОВАНО"}</span>
              <strong>{idea.title}</strong>
              {idea.hook && <span><b>Хук:</b> {idea.hook}</span>}
              <span>{idea.premise}</span>
              {idea.twist && <span><b>Поворот:</b> {idea.twist}</span>}
              <small>{idea.estimatedDuration}</small>
            </button>
            <button className="link" disabled={workBusy} onClick={() => removeIdea(idea.id)}>Удалить</button>
          </div>)}
        </div>
        {selectedIdea && !approvedCreativeBrief && <p className="director-room-hint">Можно создать сценарий сразу, но лучше сначала попросить в Режиссёрской комнате три постановки и выбрать одну.</p>}
        {approvedCreativeBrief && <p className="director-room-hint approved"><b>Постановка утверждена:</b> {approvedCreativeBrief.label}. Она будет использована при создании сценария и кадров.</p>}
        <button onClick={generatePackage} disabled={workBusy || !selectedIdea}>{approvedCreativeBrief ? "Создать сценарий по утверждённой постановке" : "Разработать выбранный фильм"}</button>
      </div>}

      {busy && <div className="busy" role="status">{busy}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      {project && <>
        <div className="card film-project-head">
          <span className="film-kicker">ПРОИЗВОДСТВЕННЫЙ ПАКЕТ</span>
          <h2>{project.concept.title}</h2>
          <p>{project.concept.logline}</p>
          <div className="row"><span className="film-badge">{project.concept.duration}</span><span className="film-badge">{project.concept.format}</span><span className="film-badge">{project.shots.length} кадров</span></div>
          <CopyButton text={() => project.story} label="Копировать сценарий" />
        </div>

        {preparationWorkspace}

        <details className="card film-section" open><summary><strong>Сценарий</strong></summary><pre>{project.story}</pre></details>
        <details className="card film-section"><summary><strong>World Bible</strong></summary><p><b>Эпоха:</b> {project.worldBible.era}</p><p><b>Место:</b> {project.worldBible.location}</p><p><b>Технологии:</b> {project.worldBible.technology}</p><p><b>Визуальный стиль:</b> {project.worldBible.visualStyle}</p><b>Правила мира</b><TextList items={project.worldBible.rules} /><b>Нельзя противоречить</b><TextList items={project.worldBible.forbiddenContradictions} /></details>

        <details className="card film-section"><summary><strong>Персонажи · Character Bible</strong></summary>{project.characters.map((character) => <div className="film-subcard" key={character.id}><div className="label-row"><strong>{character.id} · {character.name}</strong><CopyButton text={() => character.masterPrompt} label="Копировать Master Prompt" /></div><p>{character.role} · {character.appearance}</p><p><b>Одежда:</b> {character.clothing}</p><p><b>Visual Lock:</b> {character.visualLock}</p><p><b>Голос:</b> {character.voice}</p></div>)}</details>

        <details className="card film-section"><summary><strong>Локации · Location Bible</strong></summary>{project.locations.map((location) => <div className="film-subcard" key={location.id}><div className="label-row"><strong>{location.id} · {location.name}</strong><CopyButton text={() => location.masterPrompt} label="Копировать Master Prompt" /></div><p>{location.geometry}</p><p><b>Свет:</b> {location.lighting}</p><p><b>Якоря:</b> {location.anchors}</p></div>)}</details>

        <details className="card film-section"><summary><strong>Сцены</strong></summary>{project.scenes.map((scene) => <div className="film-subcard" key={scene.id}><strong>{scene.id} · {scene.duration}</strong><p><b>Цель:</b> {scene.purpose}</p><p>{scene.action}</p>{scene.dialogue && <p><b>Реплика:</b> {scene.dialogue}</p>}<p className="muted"><b>Continuity:</b> {scene.continuity}</p></div>)}</details>

        <div className="card">
          <div className="card-head"><strong>Storyboard и Production Board</strong><span className="muted small">Сначала утвердите keyframe, затем создавайте видео</span></div>
          {project.planOutdated && <p className="mv-review-note">Порядок или состав кадров изменён. Проверьте монтажный план перед финальной сборкой.</p>}
          {project.shots.map((shot, shotIndex) => <details className="film-shot" id={`film-shot-${shot.id}`} key={shot.id} open={shotIndex === 0 || data.assistant?.activeShotId === shot.id}>
            <summary>
              <strong>{shot.id}</strong>
              <span>{shot.duration} · {shot.shotSize} · {shot.purpose}</span>
              <span className={`film-keyframe-status ${shot.keyframe.status.toLowerCase()}`}>{KEYFRAME_LABELS[shot.keyframe.status]}</span>
              <span className={shot.continuityStatus === "WARNING" ? "film-warning" : "film-pass"}>{shot.continuityStatus}</span>
            </summary>
            <div className="film-shot-body">
              <p><b>Действие:</b> {shot.action}</p>
              <p><b>Камера:</b> {shot.camera} · {shot.lens} · {shot.lighting}</p>
              {shot.dialogue && <p><b>Реплика:</b> {shot.dialogue}</p>}
              <p><b>Continuity:</b> {shot.continuity} {shot.continuityWarning}</p>
              <div className="field">
                <div className="label-row"><label>Image Prompt</label><CopyButton text={() => shot.imagePrompt} /></div>
                <textarea value={shot.imagePrompt} onChange={(event) => patchShot(shotIndex, invalidateShotPreparation({ ...shot, imagePrompt: event.target.value }))} />
              </div>
              <ShotKeyframeReview
                shot={shot}
                assets={filmAssets}
                loading={filmAssetsLoading}
                disabled={Boolean(busy)}
                onBusyChange={setPreparationOperation}
                onPatch={(next) => patchShot(shotIndex, next)}
                onSaveAsset={saveAsset}
                onDeleteAsset={removeAsset}
              />
              <div className="field">
                <div className="label-row"><label>Motion / Video Prompt</label><CopyButton text={() => shot.motionPrompt} /></div>
                <textarea value={shot.motionPrompt} onChange={(event) => patchShot(shotIndex, {
                  motionPrompt: event.target.value,
                  status: { ...shot.status, video: false, final: false },
                })} />
              </div>
              <p><b>Звук:</b> {shot.sound}</p>
              <div className="film-status-row">{Object.entries(STATUS_LABELS).map(([field, label]) => {
                const locked = ["video", "final"].includes(field) && !canCreateVideo(shot) && !shot.status?.[field];
                return <label className={`checkbox-row ${locked ? "disabled" : ""}`} title={locked ? "Сначала примите keyframe или разрешите продолжить без него" : ""} key={field}><input type="checkbox" disabled={locked} checked={Boolean(shot.status?.[field])} onChange={() => toggleStatus(shotIndex, field)} />{label}</label>;
              })}</div>
            </div>
          </details>)}
        </div>

        <details className="card film-section"><summary><strong>Voice, Sound и Edit Sheet</strong></summary><h3>Голос</h3>{project.voiceSheet.map((item, index) => <p key={index}><b>{item.time} · {item.characterId}</b> — {item.text} <span className="muted">({item.emotion}; {item.delivery})</span></p>)}<h3>Звук</h3>{project.soundSheet.map((item, index) => <p key={index}><b>{item.time}</b> — {item.sound}</p>)}<h3>Монтаж</h3>{project.editSheet.map((item, index) => <p key={index}><b>{item.time}</b> — {item.shotId} · {item.transition}</p>)}</details>

        <details className="card film-section" open><summary><strong>YouTube Package</strong></summary><div className="field"><label>Заголовки</label>{project.youtube.titles.map((title, index) => <div className="copy-input-row" key={index}><input value={title} readOnly /><CopyButton text={title} /></div>)}</div><div className="field"><div className="label-row"><label>Описание</label><CopyButton text={() => project.youtube.description} /></div><textarea value={project.youtube.description} readOnly /></div><p><b>Хэштеги:</b> {project.youtube.hashtags.join(" ")}</p><p><b>Концепция обложки:</b> {project.youtube.thumbnailConcept}</p><div className="label-row"><span className="muted small">Промпт обложки</span><CopyButton text={() => project.youtube.thumbnailPrompt} /></div><pre>{project.youtube.thumbnailPrompt}</pre></details>
      </>}
      </main>
      <FilmAssistant state={data} setState={setState} />
    </div>
  );
}
