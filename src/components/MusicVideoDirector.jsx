import { useMemo, useState } from "react";
import { callApi } from "../lib/api.js";
import { analyzeAudioFile, defaultSongSections, formatTime } from "../lib/audioAnalysis.js";
import {
  completedMusicVideoSectionIds,
  generateMusicVideoPlanSections,
  musicVideoPlanSignature,
} from "../lib/musicVideoPlan.js";
import { invalidateShotPreparation, selectMusicVideoShotVersion } from "../../shared/film-studio.js";
import CopyButton from "./CopyButton.jsx";
import { KEYFRAME_LABELS, ShotKeyframeReview } from "./FilmPreparation.jsx";

const ENERGY = ["LOW", "MEDIUM", "HIGH", "PEAK"];
const METHODS = { AI_VIDEO: "AI-видео", ANIMATED_STILL: "Оживлённый кадр", ORNAMENT: "Орнамент / графика", REUSE: "Повторное использование" };
const RISK_LABELS = { LOW: "низкий", MEDIUM: "средний", HIGH: "высокий" };

export default function MusicVideoDirector({
  data,
  setData,
  filmAssets = [],
  filmAssetsLoading,
  onSaveAsset,
  onDeleteAsset,
  preparationBusy = 0,
  onPreparationBusyChange = () => {},
  activeShotId = "",
}) {
  const music = data || {};
  const settings = music.settings || {};
  const sections = music.sections || [];
  const concepts = music.concepts || [];
  const shots = music.shots || [];
  const selectedConcept = concepts.find((item) => item.id === music.selectedConceptId);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const workBusy = Boolean(busy) || preparationBusy > 0;
  const patch = (next) => setData((current) => ({ ...(current || {}), ...next }));
  const planInputChanged = {
    generationIncomplete: false,
    generationSignature: "",
    planOutdated: Boolean(shots.length) || Boolean(music.planOutdated),
  };
  const patchSettings = (next) => patch({ settings: { ...(music.settings || {}), ...next }, ...planInputChanged });

  const generationSignature = musicVideoPlanSignature({
    selectedConceptId: music.selectedConceptId,
    sections,
    settings,
    lyrics: music.lyrics,
  });
  const canResumePlan = Boolean(
    music.generationIncomplete
    && !music.planOutdated
    && music.generationSignature === generationSignature,
  );
  const completedSectionCount = completedMusicVideoSectionIds(sections, shots).size;

  function replaceShots(nextShots, next = {}) {
    patch({
      ...next,
      shots: nextShots,
      planOutdated: next.planOutdated ?? false,
      generationIncomplete: next.generationIncomplete ?? false,
      generationSignature: next.generationSignature ?? "",
    });
  }

  const summary = useMemo(() => {
    const uniqueSeconds = shots.filter((shot) => shot.method !== "REUSE").reduce((sum, shot) => sum + Math.max(0, shot.end - shot.start), 0);
    const methods = shots.reduce((acc, shot) => ({ ...acc, [shot.method]: (acc[shot.method] || 0) + 1 }), {});
    const difficultyCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    shots.filter((shot) => shot.productionReviewed).forEach((shot) => { difficultyCounts[shot.generationDifficulty] += 1; });
    const references = [...new Set(shots.flatMap((shot) => shot.referenceNeeds || []))];
    return {
      uniqueSeconds: Math.round(uniqueSeconds),
      methods,
      difficultyCounts,
      references,
      directorSelected: shots.filter((shot) => shot.selectedVersion === "director").length,
      unreviewed: shots.filter((shot) => !shot.productionReviewed).length,
    };
  }, [shots]);

  function canCreateVideo(shot) {
    if (shot.keyframe?.status === "BYPASSED") return true;
    return shot.keyframe?.status === "APPROVED"
      && filmAssets.some((asset) => asset.id === shot.keyframe.assetId && asset.kind === "keyframe");
  }

  async function run(label, work) {
    setError(""); setBusy(label);
    try { await work(); }
    catch (cause) { setError((cause.message || "Не удалось выполнить запрос").replace("выберите меньше каналов", "повторите попытку")); }
    finally { setBusy(""); }
  }

  const loadAudio = (event) => run("Анализирую песню в браузере…", async () => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await analyzeAudioFile(file);
    replaceShots([], { ...result, concepts: [], selectedConceptId: "" });
  });

  function patchSection(index, next) {
    const updated = sections.slice();
    updated[index] = { ...updated[index], ...next };
    patch({ sections: updated, ...planInputChanged });
  }

  function addSection() {
    const start = sections.at(-1)?.end || music.duration || 0;
    patch({
      sections: [...sections, { id: crypto.randomUUID(), label: "Новая часть", start, end: start + 10, energy: "MEDIUM" }],
      ...planInputChanged,
    });
  }

  function removeSection(index) {
    const sectionId = sections[index]?.id;
    const nextShots = shots.filter((shot) => shot.sectionId !== sectionId);
    replaceShots(nextShots, {
      sections: sections.filter((_, sectionIndex) => sectionIndex !== index),
      planOutdated: Boolean(nextShots.length),
    });
  }

  const generateConcepts = () => run("Создаю три концепции клипа…", async () => {
    if (!music.duration) throw new Error("Сначала загрузите песню");
    const response = await callApi("generate-script", {
      mode: "music-video-concepts",
      musicVideo: { duration: music.duration, bpm: music.bpm, lyrics: music.lyrics, sections, settings },
    });
    replaceShots([], { concepts: response.concepts || [], selectedConceptId: response.concepts?.[0]?.id || "" });
  });

  const generatePlan = () => run(canResumePlan ? "Продолжаю покадровый план…" : "Готовлю покадровый план…", async () => {
    if (!selectedConcept) throw new Error("Сначала выберите концепцию");
    if (!sections.length) throw new Error("Добавьте структуру песни");
    try {
      const result = await generateMusicVideoPlanSections({
        sections,
        existingShots: shots,
        resume: canResumePlan,
        requestSection: async ({ section, sectionIndex, allSections }) => {
          setBusy(`Планирую часть ${sectionIndex + 1} из ${allSections.length}: ${section.label}…`);
          const response = await callApi("generate-script", {
            mode: "music-video-shots",
            concept: selectedConcept,
            settings,
            sections: [section],
            allSections,
            lyrics: music.lyrics,
          });
          return response.shots || [];
        },
        onProgress: ({ shots: savedShots }) => replaceShots(savedShots, {
          generationIncomplete: true,
          generationSignature,
          planOutdated: false,
        }),
      });
      replaceShots(result.shots, { generationIncomplete: false, generationSignature: "", planOutdated: false });
    } catch (cause) {
      if (cause.savedSectionCount > 0) {
        throw new Error(`Готовые части сохранены: ${cause.savedSectionCount} из ${cause.totalSectionCount}. ${cause.message}. Нажмите «Продолжить покадровый план».`);
      }
      throw cause;
    }
  });

  function patchShot(index, next, expectedShotId = shots[index]?.id) {
    setData((current) => {
      const currentShots = Array.isArray(current?.shots) ? current.shots : [];
      const currentShot = currentShots[index];
      if (!currentShot || (expectedShotId && currentShot.id !== expectedShotId)) return current;
      const patchValue = typeof next === "function" ? next(currentShot) : next;
      const updated = currentShots.slice();
      updated[index] = { ...currentShot, ...patchValue };
      return { ...(current || {}), shots: updated };
    });
  }

  function patchDirectorVersion(index, next) {
    patchShot(index, (shot) => ({ directorVersion: { ...(shot.directorVersion || {}), ...next }, ready: false }));
  }

  return <div>
    <div className="card film-hero">
      <span className="film-kicker">AI FILM STUDIO · MUSIC VIDEO DIRECTOR</span>
      <h2>Режиссёр музыкального клипа</h2>
      <p className="muted">Песня → структура → концепция → план кадров → промпты для внешней генерации. Аудио анализируется только в вашем браузере и никуда не загружается.</p>
    </div>

    <div className="card">
      <div className="card-head"><strong>1. Песня и замысел</strong><span className="muted small">MP3, WAV, M4A или AAC</span></div>
      <div className="field"><label>Аудиофайл</label><input type="file" accept="audio/*" onChange={loadAudio} disabled={workBusy} /></div>
      {music.audioName && <div className="row"><span className="film-badge">{music.audioName}</span><span className="film-badge">{formatTime(music.duration)}</span><span className="film-badge">файл остаётся на устройстве</span></div>}
      <div className="film-settings-grid">
        <div className="field"><label>BPM — необязательно</label><input value={music.bpm || ""} onChange={(e) => patch({ bpm: e.target.value, ...planInputChanged })} placeholder="Например: 96" /></div>
        <div className="field"><label>Формат</label><select value={settings.format || "16:9"} onChange={(e) => patchSettings({ format: e.target.value })}><option>16:9</option><option>9:16</option><option>1:1</option></select></div>
      </div>
      <div className="field"><label>Моя идея клипа — главный ориентир</label><textarea value={settings.authorIdea || ""} onChange={(e) => patchSettings({ authorIdea: e.target.value })} placeholder="Опишите героя, мир, историю, символы или отдельные сцены. Можно оставить сырой набросок." /></div>
      <div className="field"><label>Текст песни — необязательно, но помогает связать образы со смыслом</label><textarea className="film-idea-input" value={music.lyrics || ""} onChange={(e) => patch({ lyrics: e.target.value, ...planInputChanged })} placeholder="Вставьте текст песни…" /></div>
    </div>

    <div className="card">
      <div className="card-head"><strong>2. Структура песни</strong><button className="link" disabled={workBusy} onClick={() => replaceShots([], { sections: defaultSongSections(music.duration || 180) })}>Собрать заново</button></div>
      {!sections.length && <p className="muted">После загрузки появятся части песни. Границы примерные — их можно исправить вручную.</p>}
      <div className="mv-section-list">{sections.map((section, index) => <div className="mv-section-row" key={section.id}>
        <input aria-label="Название части" value={section.label} onChange={(e) => patchSection(index, { label: e.target.value })} />
        <label>с <input type="number" min="0" value={section.start} onChange={(e) => patchSection(index, { start: Number(e.target.value) })} /></label>
        <label>до <input type="number" min="0" value={section.end} onChange={(e) => patchSection(index, { end: Number(e.target.value) })} /></label>
        <select value={section.energy} onChange={(e) => patchSection(index, { energy: e.target.value })}>{ENERGY.map((item) => <option key={item}>{item}</option>)}</select>
        <button className="link" disabled={workBusy} onClick={() => removeSection(index)}>Удалить</button>
      </div>)}</div>
      <button className="secondary" onClick={addSection}>+ Добавить часть</button>
    </div>

    <div className="card">
      <div className="card-head"><strong>3. Режиссёрские настройки</strong><span className="muted small">Можно менять перед новой генерацией</span></div>
      <div className="film-settings-grid">
        <div className="field"><label>Тип концепции</label><select value={settings.conceptType} onChange={(e) => patchSettings({ conceptType: e.target.value })}>{["Автоматически", "Кинематографичная история", "Перформанс + история", "Визуальная поэзия", "Фольклор", "Научная фантастика", "Гибрид"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Фольклорный язык</label><select value={settings.folkloreStyle} onChange={(e) => patchSettings({ folkloreStyle: e.target.value })}>{["Без фольклорного стиля", "Хохломские мотивы", "Гжельские мотивы", "Вышивка и текстиль", "Растительный орнамент", "Деревянная резьба", "Современный фолк"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>История / абстракция</label><select value={settings.narrativeBalance} onChange={(e) => patchSettings({ narrativeBalance: e.target.value })}>{["80% история / 20% абстракция", "60% история / 40% абстракция", "40% история / 60% абстракция"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Визуальная подача</label><select value={settings.realism} onChange={(e) => patchSettings({ realism: e.target.value })}>{["Кинематографичный реализм", "Стилизация", "Сюрреализм", "Живописная анимация"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Бюджет генерации</label><select value={settings.budgetMode} onChange={(e) => patchSettings({ budgetMode: e.target.value })}>{["Экономный", "Сбалансированный", "Максимальный"].map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <button onClick={generateConcepts} disabled={workBusy || !music.duration}>Предложить 3 концепции клипа</button>
    </div>

    {!!concepts.length && <div className="card"><div className="card-head"><strong>4. Выберите концепцию</strong><span className="muted small">После выбора создадим монтажный план</span></div>
      <div className="film-theme-grid">{concepts.map((concept) => <label className={`film-theme-card ${concept.id === music.selectedConceptId ? "selected" : ""}`} key={concept.id}>
        <input type="radio" name="mv-concept" disabled={workBusy} checked={concept.id === music.selectedConceptId} onChange={() => replaceShots([], { selectedConceptId: concept.id })} />
        <strong>{concept.title}</strong><span>{concept.logline}</span><span><b>Мир:</b> {concept.visualWorld}</span><span><b>Дуга:</b> {concept.storyArc}</span><small>{concept.signatureImages.join(" · ")}</small><span><b>Производство:</b> {concept.productionApproach}</span>
      </label>)}</div>
      <button onClick={generatePlan} disabled={workBusy || !selectedConcept}>{canResumePlan ? `Продолжить покадровый план (${completedSectionCount}/${sections.length})` : "Создать покадровый план клипа"}</button>
      {canResumePlan && <p className="mv-review-note">Готовые части уже сохранены. Повторный запуск продолжит с первой незавершённой части и не будет оплачивать их ещё раз.</p>}
    </div>}

    {busy && <div className="busy" role="status">{busy}</div>}{error && <div className="error" role="alert">{error}</div>}

    {!!shots.length && <div className="card">
      <div className="card-head"><strong>5. Production Board</strong><span className="muted small">{shots.length} кадров · ≈ {summary.uniqueSeconds} уникальных секунд</span></div>
      <div className="row mv-summary">{Object.entries(summary.methods).map(([method, count]) => <span className="film-badge" key={method}>{METHODS[method] || method}: {count}</span>)}</div>
      {!summary.unreviewed && <div className="row mv-risk-summary" aria-label="Сводка сложности кадров">
        {Object.entries(summary.difficultyCounts).map(([level, count]) => <span className={`mv-risk-badge ${level.toLowerCase()}`} key={level}>Сложность {RISK_LABELS[level]}: {count}</span>)}
        <span className="film-badge">Выбрано упрощённых: {summary.directorSelected}</span>
      </div>}
      {!!summary.unreviewed && <p className="mv-review-note">В сохранённом плане ещё нет проверки Production Director. Создайте покадровый план заново, чтобы получить риски и упрощённые версии.</p>}
      {music.planOutdated && <p className="mv-review-note">Структура песни изменена. Сохранённые кадры не удалены, но перед продолжением лучше создать покадровый план заново.</p>}
      <p className="muted small">Изображения из Reference Pack выбираются отдельно для каждого кадра. Файлы остаются в браузере; в Higgsfield вы прикрепляете их вручную.</p>
      {sections.map((section) => {
        const sectionShots = shots.map((shot, index) => ({ shot, index })).filter(({ shot }) => shot.sectionId === section.id);
        if (!sectionShots.length) return null;
        return <details className="film-section" open key={section.id}><summary><strong>{section.label}</strong> · {formatTime(section.start)}–{formatTime(section.end)} · {section.energy}</summary>
          {sectionShots.map(({ shot, index }) => {
            const useDirectorVersion = shot.selectedVersion === "director";
            const activeVersion = useDirectorVersion ? shot.directorVersion : shot;
            return <details className="film-shot" id={`film-shot-${shot.id}`} open={index === 0 || activeShotId === shot.id} key={shot.id}><summary><strong>{shot.id}</strong><span>{formatTime(shot.start)}–{formatTime(shot.end)} · {METHODS[shot.method]}</span><span className={`film-keyframe-status ${shot.keyframe.status.toLowerCase()}`}>{KEYFRAME_LABELS[shot.keyframe.status]}</span><span className="film-pass">{shot.priority}</span></summary><div className="film-shot-body">
              <p><b>Задача:</b> {shot.storyPurpose}</p>

              {shot.productionReviewed ? <div className="mv-production-audit">
                <div className="card-head"><strong>Production Director · исходная постановка</strong><span className="muted small">предварительная оценка до генерации</span></div>
                <div className="mv-risk-row">
                  <span className={`mv-risk-badge ${shot.generationDifficulty.toLowerCase()}`}>Сложность: {RISK_LABELS[shot.generationDifficulty]}</span>
                  <span className={`mv-risk-badge ${shot.regenerationRisk.toLowerCase()}`}>Риск перегенерации: {RISK_LABELS[shot.regenerationRisk]}</span>
                  <span className={`mv-risk-badge ${shot.continuityRisk.toLowerCase()}`}>Continuity: {RISK_LABELS[shot.continuityRisk]}</span>
                </div>
                {!!shot.riskReasons.length && <div className="mv-audit-list"><b>Что может быть сложно:</b><ul>{shot.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
                {!!shot.referenceNeeds.length && <div className="mv-audit-list"><b>Подготовить референсы:</b><ul>{shot.referenceNeeds.map((reference) => <li key={reference}>{reference}</li>)}</ul></div>}
              </div> : <p className="mv-review-note">Этот кадр создан до появления Production Director. Для анализа пересоздайте покадровый план.</p>}

              {shot.productionReviewed && <div className="mv-variant-grid" role="radiogroup" aria-label={`Версия кадра ${shot.id}`}>
                <label className={`mv-variant-card ${!useDirectorVersion ? "selected" : ""}`}>
                  <input type="radio" name={`shot-version-${shot.id}`} checked={!useDirectorVersion} onChange={() => patchShot(index, selectMusicVideoShotVersion(shot, "original"))} />
                  <strong>Исходная версия</strong>
                  <span>{shot.visual}</span>
                  <small><b>Камера:</b> {shot.camera || "не указана"}</small>
                </label>
                <label className={`mv-variant-card ${useDirectorVersion ? "selected" : ""}`}>
                  <input type="radio" name={`shot-version-${shot.id}`} checked={useDirectorVersion} onChange={() => patchShot(index, selectMusicVideoShotVersion(shot, "director"))} />
                  <strong>Упрощённая режиссёрская версия</strong>
                  <span>{shot.directorVersion.visual}</span>
                  <small><b>Камера:</b> {shot.directorVersion.camera || "не указана"}</small>
                  <small><b>Почему надёжнее:</b> {shot.directorVersion.reason}</small>
                </label>
              </div>}

              <div className="mv-active-version"><strong>{useDirectorVersion ? "Выбрана упрощённая версия" : "Выбрана исходная версия"}</strong><p><b>Кадр:</b> {activeVersion.visual}</p><p><b>Камера:</b> {activeVersion.camera}</p><p><b>Переход:</b> {shot.transition}</p></div>
              <div className="field"><div className="label-row"><label>Image Prompt · выбранная версия</label><CopyButton text={() => activeVersion.imagePrompt} /></div><textarea value={activeVersion.imagePrompt} onChange={(event) => {
                const updated = useDirectorVersion
                  ? { ...shot, directorVersion: { ...shot.directorVersion, imagePrompt: event.target.value } }
                  : { ...shot, imagePrompt: event.target.value };
                patchShot(index, invalidateShotPreparation(updated));
              }} /></div>
              <ShotKeyframeReview
                shot={shot}
                assets={filmAssets}
                loading={filmAssetsLoading}
                disabled={Boolean(busy)}
                onBusyChange={onPreparationBusyChange}
                onPatch={(next) => patchShot(index, next)}
                onSaveAsset={onSaveAsset}
                onDeleteAsset={onDeleteAsset}
              />
              <div className="field"><div className="label-row"><label>Video Prompt · выбранная версия</label><CopyButton text={() => activeVersion.videoPrompt} /></div><textarea value={activeVersion.videoPrompt} onChange={(e) => useDirectorVersion ? patchDirectorVersion(index, { videoPrompt: e.target.value }) : patchShot(index, { videoPrompt: e.target.value, ready: false })} /></div>
              <div className="field"><div className="label-row"><label>Negative Prompt · общий</label><CopyButton text={() => shot.negativePrompt} /></div><textarea value={shot.negativePrompt} onChange={(e) => patchShot(index, { negativePrompt: e.target.value, ready: false })} /></div>
              <p><b>Инструмент:</b> {shot.recommendedModel}</p><p className="muted"><b>Почему выбран метод:</b> {shot.reason}</p>
              <div className="row"><label className={`checkbox-row ${!canCreateVideo(shot) && !shot.ready ? "disabled" : ""}`} title={!canCreateVideo(shot) && !shot.ready ? "Сначала примите keyframe или разрешите продолжить без него" : ""}><input type="checkbox" disabled={!canCreateVideo(shot) && !shot.ready} checked={shot.ready} onChange={() => patchShot(index, { ready: !shot.ready })} />Видео кадра готово</label></div>
            </div></details>;
          })}
        </details>;
      })}
    </div>}
  </div>;
}
