import { useState } from "react";
import { callApi } from "../lib/api.js";
import LinksPicker from "./LinksPicker.jsx";
import CopyButton from "./CopyButton.jsx";
import {
  appendCustomGeneratedShort,
  buildCustomScriptState,
  isAnthropicCreditError,
  normalizeCustomGenerationProgress,
} from "../../shared/custom-script.js";

const empty = {
  topic: "",
  hooks: [],
  selectedHookIndex: null,
  script: "",
  description: null,
  editingPlan: "",
  selectedLinkIds: [],
  topicResearch: null,
  inputMode: "topic",
  customTitle: "",
  customScript: "",
};

// YouTube Long: тема → хуки → сценарий (+правка) → описание/tags (+правка) → план монтажа.
// onShortsReady/onCommunityReady/onSocialReady — конвейер «Подготовить тексты»: результаты
// уходят в состояние вкладок Shorts, Записи и Соцсети (владелец состояния — App).
export default function LongTab({ state, setState, links, onShortsReady, onCommunityReady, onSocialReady, onPackageReady }) {
  // Основной рабочий режим канала сейчас — четыре самостоятельных Shorts.
  // Старый Long-процесс остаётся ниже в коде, но скрыт до возвращения формата.
  const data = { ...empty, ...state, inputMode: "custom" };
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [hookFix, setHookFix] = useState("");
  const [scriptFix, setScriptFix] = useState("");
  const [descFix, setDescFix] = useState("");
  const [customNotice, setCustomNotice] = useState("");
  const visibleCustomProgress = normalizeCustomGenerationProgress(data.customProgress, {
    title: data.customTitle,
    script: data.customScript,
  });

  function patch(p) {
    setState((current) => ({ ...empty, ...(current || {}), ...p }));
  }

  async function run(label, fn) {
    setError("");
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  const genHooks = () =>
    run("Генерирую хуки…", async () => {
      if (!data.topic.trim()) throw new Error("Введите тему ролика");
      const { hooks } = await callApi("generate-hooks", {
        topic: data.topic,
        topicResearch: data.topicResearch,
        // прошлые варианты — чтобы перегенерация давала другие углы, а не те же три
        previous: data.hooks.length ? data.hooks : undefined,
      });
      patch({ hooks, selectedHookIndex: null, script: "", description: null, editingPlan: "" });
    });

  // Точечная правка выбранного хука: переписывается только он, два других
  // варианта остаются как есть (полная перегенерация меняла бы всё).
  const reworkHook = () =>
    run("Переделываю выбранный хук…", async () => {
      if (!hookFix.trim() || data.selectedHookIndex === null) return;
      const { hooks } = await callApi("generate-hooks", {
        topic: data.topic,
        current: data.hooks[data.selectedHookIndex],
        instruction: hookFix.trim(),
        topicResearch: data.topicResearch,
      });
      if (!hooks?.[0]) throw new Error("Не удалось переделать хук");
      const next = data.hooks.slice();
      next[data.selectedHookIndex] = hooks[0];
      patch({ hooks: next });
      setHookFix("");
    });

  const genScript = () =>
    run("Генерирую сценарий…", async () => {
      const hook = data.hooks[data.selectedHookIndex];
      const { script } = await callApi("generate-script", {
        topic: data.topic,
        hook: hook.text,
        topicResearch: data.topicResearch,
      });
      patch({ script, description: null, editingPlan: "" });
    });

  const reworkScript = () =>
    run("Переделываю сценарий…", async () => {
      if (!scriptFix.trim()) return;
      const { script } = await callApi("generate-script", {
        topic: data.topic,
        currentScript: data.script,
        instruction: scriptFix.trim(),
        // актуальный выбранный хук: если его точечно переделали после генерации
        // сценария, правка сценария обязана подтянуть новое начало
        hook: data.hooks[data.selectedHookIndex]?.text,
        topicResearch: data.topicResearch,
      });
      patch({ script });
      setScriptFix("");
    });

  const genDescription = () =>
    run("Генерирую описание…", async () => {
      if (!data.script.trim()) throw new Error("Сначала нужен финальный сценарий");
      const selectedLinks = links.filter((l) => data.selectedLinkIds.includes(l.id));
      const desc = await callApi("generate-description", {
        topic: data.topic,
        script: data.script,
        links: selectedLinks,
        topicResearch: data.topicResearch,
      });
      patch({ description: desc });
    });

  const reworkDescription = () =>
    run("Переделываю описание…", async () => {
      if (!descFix.trim()) return;
      const selectedLinks = links.filter((l) => data.selectedLinkIds.includes(l.id));
      const desc = await callApi("generate-description", {
        topic: data.topic,
        current: data.description,
        instruction: descFix.trim(),
        links: selectedLinks,
        topicResearch: data.topicResearch,
      });
      patch({ description: desc });
      setDescFix("");
    });

  const genEditingPlan = () =>
    run("Подбираю мемы и врезки…", async () => {
      if (!data.script.trim()) throw new Error("Сначала нужен финальный сценарий");
      const { plan } = await callApi("generate-editing-plan", { script: data.script });
      patch({ editingPlan: plan });
    });

  // Шаг 1 конвейера: сценарий проверен → одним кликом готовим тексты Shorts и Записей.
  // Обложки (дорогая часть) — отдельно, кнопкой на вкладке «Обложки», после проверки текстов.
  const prepareTexts = async () => {
    setError("");
    try {
      if (!data.script.trim()) throw new Error("Сначала нужен финальный сценарий");
      const payload = { topic: data.topic, script: data.script, synopsis: data.description?.synopsis };
      setBusy("Готовлю тексты (1/3): Shorts из сценария…");
      const { shorts } = await callApi("generate-shorts", { fromScript: payload });
      onShortsReady(shorts);
      setBusy("Готовлю тексты (2/3): посты для Записей…");
      const { posts } = await callApi("generate-community", payload);
      onCommunityReady(posts);
      setBusy("Готовлю тексты (3/3): Telegram и Boosty…");
      const social = await callApi("generate-social", payload);
      onSocialReady(social);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  async function prepareCustomPackage() {
    setError("");
    setCustomNotice("");
    let completedShorts = 0;
    let next;
    try {
      next = buildCustomScriptState({ title: data.customTitle, script: data.customScript });
    } catch (e) {
      setError(e.message);
      return;
    }
    try {
      const payload = { topic: next.topic, script: next.script };
      let progress = normalizeCustomGenerationProgress(data.customProgress, {
        title: data.customTitle,
        script: data.customScript,
      });
      if (progress.completedAt) {
        progress = normalizeCustomGenerationProgress(null, { title: data.customTitle, script: data.customScript });
      }
      let shorts = progress.shorts;
      completedShorts = shorts.length;
      for (let index = shorts.length; index < 4; index += 1) {
        setBusy(`Готовлю комплект: Shorts ${index + 1}/4…`);
        const { short } = await callApi("generate-shorts", {
          mode: "curiosity-single",
          title: data.customTitle,
          material: data.customScript,
          shortIndex: index,
          previousTopics: shorts.map((item) => item.topic),
        });
        progress = appendCustomGeneratedShort(progress, short);
        shorts = progress.shorts;
        completedShorts = shorts.length;
        patch({ customProgress: progress });
      }
      // Четыре сценария уже являются самостоятельным полезным результатом.
      // Показываем их сразу, даже если на следующих платных запросах
      // (Community / Telegram / Boosty) закончится баланс провайдера.
      onShortsReady(shorts);
      setBusy("Готовлю комплект (2/3): четыре записи YouTube…");
      let posts = progress.posts;
      if (posts.length !== 4) {
        ({ posts } = await callApi("generate-community", { ...payload, shortsSeries: shorts }));
        progress = { ...progress, posts };
        patch({ customProgress: progress });
      }
      onCommunityReady(posts);
      setBusy("Готовлю комплект (3/3): Telegram и Boosty…");
      let social = progress.social;
      if ((social?.telegram || []).length !== 4 || (social?.boosty || []).length !== 2) {
        social = await callApi("generate-social", { ...payload, shortsSeries: shorts });
        progress = { ...progress, social };
        patch({ customProgress: progress });
      }
      onSocialReady(social);
      if ((shorts || []).length !== 4 || (posts || []).length !== 4 || (social.telegram || []).length !== 4 || (social.boosty || []).length !== 2) {
        throw new Error(`Получено не всё: Shorts ${(shorts || []).length}/4, Записи ${(posts || []).length}/4, Telegram ${(social.telegram || []).length}/4, Boosty ${(social.boosty || []).length}/2. Нажмите кнопку ещё раз.`);
      }
      progress = { ...progress, completedAt: new Date().toISOString() };
      patch({ ...next, customProgress: progress });
      onShortsReady(shorts);
      onCommunityReady(posts);
      onSocialReady(social);
      onPackageReady?.({ shorts, community: posts, telegram: social.telegram || [], boosty: social.boosty || [] });
      setCustomNotice("Готово: 4 Shorts, 4 полезные записи YouTube, 4 Telegram и 2 Boosty разложены по своим вкладкам. Во вкладке «Картинки» можно создать 4 квадратные картинки — по одной на тему — и использовать их в YouTube, Telegram и Boosty. Обложки Shorts вы делаете отдельно.");
    } catch (e) {
      const message = e.message || "Не удалось подготовить комплект";
      const creditError = isAnthropicCreditError(message);
      if (creditError) {
        const saved = completedShorts === 4
          ? " Четыре Shorts сохранены и доступны во вкладке «Shorts»; не готовы только следующие публикации."
          : completedShorts > 0
            ? ` Сохранено Shorts: ${completedShorts}/4.`
            : "";
        setError(`На счёте Anthropic закончились средства. Пополните баланс Anthropic или переключите текстовую генерацию на другой API.${saved}`);
      } else {
        const saved = completedShorts > 0 ? ` Уже сохранено Shorts: ${completedShorts}/4. Нажмите кнопку ещё раз — работа продолжится с этого места.` : "";
        setError(`${message}${saved}`);
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>Контент недели: 4 Curiosity Story Shorts</strong><span className="muted small">Один общий сценарий → четыре самостоятельных ролика</span></div>
        <>
          <div className="field">
            <label>Общее название серии — необязательно</label>
            <input value={data.customTitle} disabled={!!busy} onChange={(e) => patch({ customTitle: e.target.value, customProgress: null })} placeholder="Можно оставить пустым: названия четырёх Shorts будут взяты из сценария" />
          </div>
          <div className="field">
            <label>Общий сценарий с четырьмя разделами</label>
            <textarea className="linkedin-source" value={data.customScript} disabled={!!busy} onChange={(e) => patch({ customScript: e.target.value, customProgress: null })} placeholder="Вставьте общий материал. Внутри должны быть четыре темы или четыре смысловых раздела…" />
          </div>
          <div className="row">
            <button onClick={prepareCustomPackage} disabled={!!busy}>
              {busy.startsWith("Готовлю комплект")
                ? busy
                : (!visibleCustomProgress.completedAt && visibleCustomProgress.shorts.length > 0
                  ? `Продолжить подготовку (${visibleCustomProgress.shorts.length}/4 Shorts)`
                  : "Создать 4 Shorts и публикации")}
            </button>
          </div>
          {busy.startsWith("Готовлю комплект") && (
            <div className="busy" role="status" aria-live="polite">{busy}</div>
          )}
          {!busy && !visibleCustomProgress.completedAt && visibleCustomProgress.shorts.length > 0 && (
            <div className="muted small">Сохранено {visibleCustomProgress.shorts.length}/4 Shorts. Следующий запуск продолжит с этого места.</div>
          )}
          {customNotice && <div className="success" role="status">{customNotice}</div>}
          {error && <div className="error" role="alert">{error}</div>}
          <div className="muted small">Каждый раздел станет отдельным сценарием по формуле Hook → вопрос → доказательство → раскрытие → применение. Комплект: 4 Shorts, 4 записи YouTube, 4 Telegram и 2 Boosty. LinkedIn не изменяется.</div>
        </>
      </div>

      {data.inputMode === "topic" && <>
      <div className="card">
        <div className="card-head"><strong>1. Тема и хук</strong></div>
        <div className="field">
          <label>Тема ролика</label>
          <input
            value={data.topic}
            onChange={(e) => patch({ topic: e.target.value, topicResearch: null })}
            placeholder="О чём видео"
          />
        </div>
        {data.topicResearch?.source === "topic-research" && (
          <div className="research-context">
            <strong>Тема из поискового спроса · скор {data.topicResearch.score}</strong>
            <span className="muted small">
              Формулировка запроса и заголовки конкурентов будут учтены при генерации.
            </span>
          </div>
        )}
        <button onClick={genHooks} disabled={!!busy}>Сгенерировать хуки</button>

        {data.hooks.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {data.hooks.map((h, i) => (
              <div
                key={i}
                className={`hook-option ${data.selectedHookIndex === i ? "selected" : ""}`}
                onClick={() => patch({ selectedHookIndex: i })}
              >
                <input type="radio" checked={data.selectedHookIndex === i} readOnly style={{ marginTop: 3 }} />
                <div>
                  <strong>{h.title}</strong> <span className="muted small">({h.type})</span>
                  <div className="small" style={{ marginTop: 4 }}>{h.text}</div>
                </div>
              </div>
            ))}
            {data.selectedHookIndex !== null && (
              <div className="fix-row">
                <input
                  placeholder="Что поправить в выбранном хуке (например: убери цифру, начни с вопроса)"
                  value={hookFix}
                  onChange={(e) => setHookFix(e.target.value)}
                  disabled={!!busy}
                />
                <button onClick={reworkHook} disabled={!!busy || !hookFix.trim()}>Переделать хук</button>
              </div>
            )}
            <button onClick={genScript} disabled={data.selectedHookIndex === null || !!busy}>
              Сгенерировать сценарий
            </button>
          </div>
        )}
      </div>
      </>}

      {data.inputMode === "topic" && data.script && (
        <div className="card">
          <div className="card-head">
            <strong>{data.topicResearch?.source === "custom-script" ? "Ваш готовый сценарий" : "2. Сценарий"}</strong>
            <CopyButton text={() => data.script} />
          </div>
          <textarea value={data.script} onChange={(e) => patch({ script: e.target.value })} />
          <div className="fix-row">
            <input
              placeholder="Что исправить (например: сделай короче, добавь юмора во вступление)"
              value={scriptFix}
              onChange={(e) => setScriptFix(e.target.value)}
              disabled={!!busy}
            />
            <button onClick={reworkScript} disabled={!!busy || !scriptFix.trim()}>Переделать с учётом правки</button>
          </div>
          <div className="row">
            <button onClick={genDescription} disabled={!!busy}>Сгенерировать описание</button>
            <button className="secondary" onClick={genEditingPlan} disabled={!!busy}>Подобрать мемы и врезки</button>
          </div>
          <div className="row">
            <button onClick={prepareTexts} disabled={!!busy}>Подготовить тексты: Shorts + Записи + Соцсети</button>
            <span className="muted small">
              Шаг 1 конвейера: темы и тексты уйдут во вкладки Shorts, Записи и Соцсети (Telegram/Boosty).
              Проверьте их, затем шаг 2 — «Сгенерировать все обложки» на вкладке Обложки.
            </span>
          </div>
        </div>
      )}

      {data.inputMode === "topic" && data.script && (
        <div className="card">
          <div className="card-head"><strong>Ссылки в описание</strong></div>
          <LinksPicker links={links} selected={data.selectedLinkIds} onChange={(ids) => patch({ selectedLinkIds: ids })} />
        </div>
      )}

      {data.inputMode === "topic" && data.description && (
        <div className="card">
          <div className="card-head"><strong>3. Описание</strong></div>
          <div className="field">
            <div className="label-row">
              <label>Заголовок — вариант A</label>
              <CopyButton text={() => data.description.title} />
            </div>
            <input value={data.description.title} onChange={(e) => patch({ description: { ...data.description, title: e.target.value } })} />
          </div>
          <div className="field">
            <div className="label-row">
              <label>Заголовок — вариант Б (для A/Б-теста в YouTube Studio)</label>
              <CopyButton text={() => data.description.titleB || ""} />
            </div>
            <input value={data.description.titleB || ""} onChange={(e) => patch({ description: { ...data.description, titleB: e.target.value } })} />
          </div>
          <div className="field">
            <div className="label-row">
              <label>Описание (Keywords + хэштеги внутри)</label>
              <CopyButton text={() => data.description.description} />
            </div>
            <textarea
              value={data.description.description}
              onChange={(e) => patch({ description: { ...data.description, description: e.target.value } })}
            />
          </div>
          <div className="field">
            <div className="label-row">
              <label>Tags (метаданные YouTube, через запятую)</label>
              <CopyButton text={() => data.description.tags} />
            </div>
            <textarea
              style={{ minHeight: 60 }}
              value={data.description.tags}
              onChange={(e) => patch({ description: { ...data.description, tags: e.target.value } })}
            />
          </div>
          <div className="field">
            <label>Краткий пересказ (для обложек и постов «Записи», не публикуется)</label>
            <textarea
              style={{ minHeight: 80 }}
              value={data.description.synopsis || ""}
              onChange={(e) => patch({ description: { ...data.description, synopsis: e.target.value } })}
            />
          </div>
          <div className="fix-row">
            <input
              placeholder="Что исправить (например: сократи, убери пункт про Track Start)"
              value={descFix}
              onChange={(e) => setDescFix(e.target.value)}
              disabled={!!busy}
            />
            <button onClick={reworkDescription} disabled={!!busy || !descFix.trim()}>Переделать</button>
          </div>
        </div>
      )}

      {data.inputMode === "topic" && data.editingPlan && (
        <div className="card">
          <div className="card-head">
            <strong>4. Мемы и врезки</strong>
            <CopyButton text={() => data.editingPlan} />
          </div>
          <textarea value={data.editingPlan} onChange={(e) => patch({ editingPlan: e.target.value })} />
        </div>
      )}

      {busy && data.inputMode !== "custom" && <div className="busy">{busy}</div>}
      {error && data.inputMode !== "custom" && <div className="error">{error}</div>}
    </div>
  );
}
