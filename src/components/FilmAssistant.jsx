import { useEffect, useRef, useState } from "react";
import { callApi } from "../lib/api.js";
import {
  applyFilmAssistantProposal,
  describeFilmAssistantAction,
  filmCreativeContextFingerprint,
  filmDirectionSourceFingerprint,
  filmShotsFingerprint,
  getFilmStudioShots,
  normalizeFilmAssistantResponse,
  undoFilmAssistantAction,
} from "../../shared/film-assistant.js";

const ROUTE_LABELS = {
  auto: "Авто",
  economy: "Экономно",
  creative: "Творческая работа",
};

const RISK_LABELS = { LOW: "низкий риск", MEDIUM: "средний риск", HIGH: "высокий риск" };

function DirectorWorkflow({ hasSource, hasPlan, hasApprovedDirection, hasShots, readyForWeave }) {
  const steps = [
    ["Идея", hasSource],
    ["3 постановки", hasPlan],
    ["Выбор автора", hasApprovedDirection],
    ["Сценарий и кадры", hasShots],
    ["Готово для Weave", readyForWeave],
  ];
  return <div className="director-workflow" aria-label="Этапы режиссёрской комнаты">
    {steps.map(([label, complete], index) => <div className={complete ? "complete" : ""} key={label}>
      <span>{complete ? "✓" : index + 1}</span><small>{label}</small>
    </div>)}
  </div>;
}

function DirectorPlanCard({ plan, approvedBrief, stale, hasShots, onApprove, onDiscuss, onRepeat }) {
  if (!plan) return null;
  return <section className="director-plan" aria-label="Варианты режиссёрской постановки">
    <div className="card-head">
      <div><span className="film-kicker">РЕЖИССЁРСКИЙ РАЗБОР</span><h3>{plan.title}</h3></div>
      <span className={`director-plan-state ${plan.complete ? "complete" : "incomplete"}`}>{plan.complete ? "3 варианта" : `${plan.options.length}/3`}</span>
    </div>
    {plan.dramaticGoal && <p><b>Задача сцены:</b> {plan.dramaticGoal}</p>}
    {plan.viewerJourney && <p><b>Что должен пережить зритель:</b> {plan.viewerJourney}</p>}
    {stale && <p className="mv-review-note">После этого разбора проект изменился. Повторите разбор, чтобы не применить устаревшее решение.</p>}
    {!plan.complete && <div className="mv-review-note">Нейросеть вернула не все три постановки. Уже готовые варианты сохранены, но утверждать их пока нельзя.</div>}
    <div className="director-option-list">
      {plan.options.map((option) => {
        const recommended = option.id === plan.recommendation;
        const approved = approvedBrief?.id === option.id;
        return <article className={`director-option ${approved ? "selected" : ""}`} key={option.id}>
          <div className="director-option-head">
            <div><strong>{option.label}</strong>{recommended && <span className="director-recommended">Рекомендуется</span>}</div>
            <span className={`mv-risk-badge ${option.generationRisk.toLowerCase()}`}>{RISK_LABELS[option.generationRisk]}</span>
          </div>
          <p>{option.summary}</p>
          {option.viewerEffect && <p><b>Эффект:</b> {option.viewerEffect}</p>}
          {!!option.shotPlan.length && <ol>{option.shotPlan.map((shot, index) => <li key={index}>{shot}</li>)}</ol>}
          <details>
            <summary>Свет, камера, движение и звук</summary>
            {option.camera && <p><b>Камера:</b> {option.camera}</p>}
            {option.lighting && <p><b>Свет:</b> {option.lighting}</p>}
            {option.movement && <p><b>Движение:</b> {option.movement}</p>}
            {option.sound && <p><b>Звук:</b> {option.sound}</p>}
            {option.editRhythm && <p><b>Монтаж:</b> {option.editRhythm}</p>}
            {option.whyItWorks && <p><b>Почему работает:</b> {option.whyItWorks}</p>}
          </details>
          <button type="button" className={approved ? "secondary" : ""} disabled={stale || !plan.complete || approved} onClick={() => onApprove(option)}>{approved ? "✓ Постановка утверждена" : "Выбрать постановку"}</button>
          {approved && hasShots && <button type="button" className="link" onClick={() => onDiscuss(option)}>Подготовить изменения раскадровки</button>}
        </article>;
      })}
    </div>
    {(stale || !plan.complete) && <button type="button" className="secondary" onClick={onRepeat}>Повторить режиссёрский разбор</button>}
  </section>;
}

function messageId(role) {
  return `${role}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
}

function buildContext(state, mode) {
  if (mode === "music-video") {
    const music = state.musicVideo || {};
    const selectedConcept = (music.concepts || []).find((item) => item.id === music.selectedConceptId) || null;
    return {
      settings: music.settings,
      song: { duration: music.duration, bpm: music.bpm, lyrics: String(music.lyrics || "").slice(0, 6000) },
      selectedConcept,
      sections: music.sections,
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
        keyframeStatus: shot.keyframe?.status,
      })),
    };
  }

  const project = state.project;
  const directionSourceFingerprint = filmDirectionSourceFingerprint(state);
  const currentCreativeBrief = state.creativeBrief?.sourceFingerprint === directionSourceFingerprint
    ? state.creativeBrief
    : null;
  return {
    settings: state.settings,
    selectedTheme: (state.themes || []).find((item) => item.id === state.selectedThemeId) || null,
    selectedIdea: (state.ideas || []).find((item) => item.id === state.selectedIdeaId) || null,
      project: project ? {
      concept: project.concept,
      story: project.story,
      worldBible: project.worldBible,
      characters: project.characters,
      locations: project.locations,
      scenes: project.scenes,
      soundSheet: project.soundSheet,
      editSheet: project.editSheet,
      shots: (project.shots || []).map((shot) => ({
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
        keyframeStatus: shot.keyframe?.status,
      })),
    } : null,
    creativeBrief: currentCreativeBrief,
  };
}

export default function FilmAssistant({ state, setState }) {
  const mode = state?.studioMode === "music-video" ? "music-video" : "short-film";
  const assistant = state?.assistant || { route: "auto", messages: [], pendingProposal: null, directorPlan: null, undo: null, activeShotId: "" };
  const shots = getFilmStudioShots(state, mode);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const latestStateRef = useRef(state);
  const requestIdRef = useRef(0);
  latestStateRef.current = state;

  const visibleMessages = (assistant.messages || []).filter((message) => (message.mode || mode) === mode);
  const creativeContextFingerprint = filmCreativeContextFingerprint(state, mode);
  const directionSourceFingerprint = filmDirectionSourceFingerprint(state);
  const directorPlan = assistant.directorPlan?.mode === mode ? assistant.directorPlan : null;
  const directorPlanStale = Boolean(directorPlan?.baseFingerprint && directorPlan.baseFingerprint !== creativeContextFingerprint);
  const approvedBrief = mode === "short-film" && state?.creativeBrief?.sourceFingerprint === directionSourceFingerprint
    ? state.creativeBrief
    : null;
  const selectedIdea = (state?.ideas || []).find((item) => item.id === state?.selectedIdeaId) || null;
  const selectedConcept = (state?.musicVideo?.concepts || []).find((item) => item.id === state?.musicVideo?.selectedConceptId) || null;
  const hasSource = mode === "music-video" ? Boolean(selectedConcept || state?.musicVideo?.settings?.authorIdea) : Boolean(selectedIdea || state?.project);
  const promptsReady = shots.length > 0 && shots.every((shot) => mode === "music-video"
    ? Boolean((shot.selectedVersion === "director" ? shot.directorVersion?.imagePrompt : shot.imagePrompt) && (shot.selectedVersion === "director" ? shot.directorVersion?.videoPrompt : shot.videoPrompt))
    : Boolean(shot.imagePrompt && shot.motionPrompt));
  const hasApprovedDirection = mode === "music-video" ? Boolean(selectedConcept) : Boolean(approvedBrief);
  const readyForWeave = hasApprovedDirection && promptsReady;

  function patchAssistant(next) {
    setState((current) => {
      const currentAssistant = current?.assistant || {};
      const patch = typeof next === "function" ? next(currentAssistant) : next;
      return { ...(current || {}), assistant: { ...currentAssistant, ...patch } };
    });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [visibleMessages.length, assistant.pendingProposal]);

  useEffect(() => {
    if (assistant.activeShotId && !shots.some((shot) => shot.id === assistant.activeShotId)) {
      patchAssistant({ activeShotId: "" });
    }
  }, [assistant.activeShotId, shots]);

  useEffect(() => {
    const undo = assistant.undo;
    if (!undo) return;
    const undoShots = getFilmStudioShots(state, undo.mode);
    if (filmShotsFingerprint(undoShots) !== undo.afterFingerprint) patchAssistant({ undo: null });
  }, [assistant.undo, state.project?.shots, state.musicVideo?.shots]);

  useEffect(() => {
    const proposal = assistant.pendingProposal;
    if (!proposal) return;
    if (proposal.mode !== mode || (proposal.baseFingerprint && proposal.baseFingerprint !== filmShotsFingerprint(shots))) {
      patchAssistant({ pendingProposal: null });
    }
  }, [assistant.pendingProposal, mode, shots]);

  async function sendMessage(event) {
    event?.preventDefault?.();
    const message = draft.trim();
    if (!message || busy) return;
    setError("");
    setBusy(true);
    setDraft("");
    const createdAt = new Date().toISOString();
    const userMessage = { id: messageId("user"), role: "user", text: message, route: assistant.route || "auto", mode, createdAt };
    const baseFingerprint = filmShotsFingerprint(shots);
    const baseContextFingerprint = filmCreativeContextFingerprint(state, mode);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    patchAssistant((current) => ({ messages: [...(current.messages || []), userMessage].slice(-30), pendingProposal: null }));
    try {
      const response = await callApi("generate-script", {
        mode: "film-assistant",
        studioMode: mode,
        route: assistant.route || "auto",
        message,
        activeShotId: assistant.activeShotId || "",
        history: visibleMessages.slice(-8).map(({ role, text }) => ({ role, text })),
        context: buildContext(state, mode),
      });
      const latestState = latestStateRef.current;
      const contextChanged = requestIdRef.current !== requestId
        || (latestState?.studioMode === "music-video" ? "music-video" : "short-film") !== mode
        || filmShotsFingerprint(getFilmStudioShots(latestState, mode)) !== baseFingerprint
        || filmCreativeContextFingerprint(latestState, mode) !== baseContextFingerprint;
      if (contextChanged) {
        setError("Проект изменился, пока помощник готовил ответ. Отправьте вопрос ещё раз для текущей версии.");
        return;
      }
      const normalized = normalizeFilmAssistantResponse(response, mode);
      const assistantMessage = {
        id: messageId("assistant"),
        role: "assistant",
        text: normalized.reply,
        route: response.routeUsed || assistant.route || "auto",
        mode,
        createdAt: new Date().toISOString(),
      };
      setState((current) => {
        const currentMode = current?.studioMode === "music-video" ? "music-video" : "short-film";
        if (currentMode !== mode
          || filmShotsFingerprint(getFilmStudioShots(current, mode)) !== baseFingerprint
          || filmCreativeContextFingerprint(current, mode) !== baseContextFingerprint) return current;
        const currentAssistant = current?.assistant || {};
        return {
          ...(current || {}),
          assistant: {
            ...currentAssistant,
            messages: [...(currentAssistant.messages || []), assistantMessage].slice(-30),
            pendingProposal: normalized.proposal ? { ...normalized.proposal, mode, baseFingerprint } : null,
            directorPlan: normalized.directorPlan
              ? { ...normalized.directorPlan, mode, baseFingerprint: baseContextFingerprint, createdAt: new Date().toISOString() }
              : currentAssistant.directorPlan,
          },
        };
      });
    } catch (cause) {
      setError(cause.message || "Film Assistant не ответил. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  function applyProposal() {
    setError("");
    try {
      applyFilmAssistantProposal(state, assistant.pendingProposal, { mode });
      setState((current) => {
        try {
          const result = applyFilmAssistantProposal(current, assistant.pendingProposal, { mode });
          return {
            ...result.state,
            assistant: {
              ...(result.state.assistant || assistant),
              pendingProposal: null,
              undo: result.undo,
              activeShotId: assistant.activeShotId,
            },
          };
        } catch (cause) {
          queueMicrotask(() => setError(cause.message || "Не удалось применить предложение"));
          return current;
        }
      });
    } catch (cause) {
      setError(cause.message || "Не удалось применить предложение");
    }
  }

  function undoLastAction() {
    setError("");
    try {
      undoFilmAssistantAction(state, assistant.undo);
      setState((current) => {
        try {
          const restored = undoFilmAssistantAction(current, assistant.undo);
          return {
            ...restored,
            assistant: { ...(restored.assistant || assistant), undo: null, pendingProposal: null },
          };
        } catch (cause) {
          queueMicrotask(() => setError(cause.message || "Не удалось отменить изменение"));
          return current;
        }
      });
    } catch (cause) {
      setError(cause.message || "Не удалось отменить изменение");
    }
  }

  function approveDirectorOption(option) {
    setError("");
    setState((current) => {
      const currentMode = current?.studioMode === "music-video" ? "music-video" : "short-film";
      const currentAssistant = current?.assistant || {};
      const plan = currentAssistant.directorPlan;
      if (currentMode !== "short-film" || !plan || !plan.complete) return current;
      if (plan.baseFingerprint && plan.baseFingerprint !== filmCreativeContextFingerprint(current, currentMode)) {
        queueMicrotask(() => setError("Проект изменился после разбора. Сначала повторите режиссёрский разбор."));
        return current;
      }
      const selected = plan.options?.find((item) => item.id === option.id);
      if (!selected) return current;
      const now = new Date().toISOString();
      return {
        ...current,
        creativeBrief: {
          ...selected,
          sourceFingerprint: filmDirectionSourceFingerprint(current),
          sourceIdeaId: current.selectedIdeaId || "",
          sourceThemeId: current.selectedThemeId || "",
          approvedAt: now,
        },
        assistant: {
          ...currentAssistant,
          directorPlan: { ...plan, selectedOptionId: selected.id, status: "approved", approvedAt: now },
        },
      };
    });
  }

  function discussApprovedOption(option) {
    setDraft(`Я утверждаю постановку «${option.label}». Подготовь конкретные изменения текущей раскадровки, чтобы она точно следовала этому направлению. Сначала покажи безопасное предложение и ничего не меняй без моего подтверждения.`);
  }

  function repeatDirectorPlan() {
    setDraft(assistant.activeShotId
      ? "Повтори полный режиссёрский разбор выбранного кадра и предложи ровно три постановки: простую, кинематографичную и смелую."
      : "Повтори полный режиссёрский разбор и предложи ровно три постановки фильма: простую, кинематографичную и смелую.");
  }

  const quickPrompts = mode === "music-video"
    ? (shots.length
      ? ["Как сделать выбранный кадр кинематографичнее?", "Упрости выбранный кадр для надёжной генерации", "Проверь ритм клипа и удержание внимания"]
      : ["Помоги выбрать визуальную концепцию клипа", "Объясни, с чего начать работу"])
    : (hasSource
      ? ["Предложи три режиссёрские постановки: простую, кинематографичную и смелую", "Проверь, будет ли история удерживать внимание", "Объясни свет и камеру простыми словами"]
      : ["Помоги сформулировать идею первого простого фильма", "Объясни, с чего начать работу"]);

  return <aside className="film-assistant" aria-label="Film Assistant">
    <div className="film-assistant-head">
      <div><span className="film-kicker">AI FILM DIRECTOR</span><h2>Режиссёрская комната</h2></div>
      {!!assistant.undo && <button type="button" className="secondary" onClick={undoLastAction}>↶ Отменить</button>}
    </div>
    <p className="muted small">Расскажите идею обычными словами. Режиссёрская комната предложит постановку, свет, камеру, движение, звук и ритм. Изменения применяются только после вашего подтверждения.</p>

    <DirectorWorkflow
      hasSource={hasSource}
      hasPlan={Boolean(directorPlan && !directorPlanStale)}
      hasApprovedDirection={hasApprovedDirection}
      hasShots={shots.length > 0}
      readyForWeave={readyForWeave}
    />

    <div className="film-assistant-controls">
      <div className="field">
        <label htmlFor="film-assistant-route">Режим ответа</label>
        <select id="film-assistant-route" value={assistant.route || "auto"} onChange={(event) => patchAssistant({ route: event.target.value })} disabled={busy}>
          {Object.entries(ROUTE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="film-assistant-shot">Какой кадр обсуждаем</label>
        <select id="film-assistant-shot" value={assistant.activeShotId || ""} onChange={(event) => patchAssistant({ activeShotId: event.target.value })} disabled={busy}>
          <option value="">Весь проект</option>
          {shots.map((shot, index) => <option value={shot.id} key={shot.id}>{index + 1}. {shot.id} · {shot.action || shot.visual || shot.purpose || shot.storyPurpose || "кадр"}</option>)}
        </select>
      </div>
    </div>

    <div className="film-assistant-messages" aria-live="polite">
      {!visibleMessages.length && <div className="film-assistant-empty">Начните с идеи или попросите три постановки. Вам не нужно знать названия планов, объективов и схем света — режиссёр предложит их сам и объяснит выбор.</div>}
      {visibleMessages.map((message) => <div className={`film-assistant-message ${message.role}`} key={message.id}>
        <strong>{message.role === "user" ? "Вы" : "Film Assistant"}</strong>
        <p>{message.text}</p>
        {message.role === "assistant" && <small>{ROUTE_LABELS[message.route] || "Авто"}</small>}
      </div>)}
      {busy && <div className="film-assistant-message assistant"><strong>Film Assistant</strong><p>Изучаю проект…</p></div>}
      <div ref={messagesEndRef} />
    </div>

    {mode === "short-film" && <DirectorPlanCard
      plan={directorPlan}
      approvedBrief={approvedBrief}
      stale={directorPlanStale}
      hasShots={shots.length > 0}
      onApprove={approveDirectorOption}
      onDiscuss={discussApprovedOption}
      onRepeat={repeatDirectorPlan}
    />}

    {mode === "short-film" && approvedBrief && <div className="director-approved-note">
      <span className="film-kicker">УТВЕРЖДЁННОЕ НАПРАВЛЕНИЕ</span>
      <strong>{approvedBrief.label}</strong>
      <p>{approvedBrief.summary}</p>
      {!shots.length && <small>Теперь выберите «Разработать фильм» в основной части Film Studio — сценарий и кадры будут созданы по этой постановке.</small>}
      {shots.length > 0 && !readyForWeave && <small>Проверьте промпты и референсы кадров. После этого проект будет готов к переносу в Weave.</small>}
      {readyForWeave && <small className="success">Сценарий, постановка и промпты готовы. Следующий этап — производство в Weave.</small>}
    </div>}

    {!!assistant.pendingProposal && <div className="film-assistant-proposal">
      <span className="film-kicker">ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ</span>
      <strong>{assistant.pendingProposal.summary}</strong>
      <ul>{assistant.pendingProposal.actions.map((action, index) => <li key={`${action.type}-${index}`}>{describeFilmAssistantAction(action)}</li>)}</ul>
      <div className="row">
        <button type="button" onClick={applyProposal}>Применить</button>
        <button type="button" className="secondary" onClick={() => patchAssistant({ pendingProposal: null })}>Отклонить</button>
      </div>
    </div>}

    {error && <div className="error" role="alert">{error}</div>}

    <div className="film-assistant-quick">{quickPrompts.map((prompt) => <button type="button" className="link" key={prompt} onClick={() => setDraft(prompt)} disabled={busy}>{prompt}</button>)}</div>

    <form className="film-assistant-composer" onSubmit={sendMessage}>
      <label htmlFor="film-assistant-message">Сообщение режиссёру</label>
      <textarea id="film-assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} placeholder="Например: хочу, чтобы сцена была тревожной и трогательной; сам предложи свет, планы и движение камеры" />
      <div className="film-assistant-actions">
        <button type="submit" disabled={busy || !draft.trim()}>Обсудить с режиссёром</button>
      </div>
      <small className="muted">Если на компьютере включена системная диктовка, можно надиктовать текст в это поле. Это функция компьютера, а не встроенный микрофон приложения.</small>
    </form>
  </aside>;
}
