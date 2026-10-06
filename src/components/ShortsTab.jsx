import { useState } from "react";
import { callApi } from "../lib/api.js";
import CopyButton from "./CopyButton.jsx";
import { withDescriptionLinks } from "../lib/descriptionLinks.js";

const makeEmptyCard = () => ({
  topic: "",
  script: "",
  hook: "",
  openQuestion: "",
  payoff: "",
  screenPlan: [],
  coverTexts: [],
  angles: [],
  hooks: [],
  selectedAngle: 0,
  selectedHook: 0,
  audit: {},
  review: {},
  titles: null,
  description: "",
  selectedLinkIds: [],
});
const SHORTS_COUNT = 4;

// 4 карточки YouTube Shorts: тема → описание + 2 заголовка, генерация все сразу
// или по одной, точечная правка на каждой карточке отдельно. Кнопка «из сценария»
// перевыбирает темы по шагам Long-сценария, не перегенерируя Записи/Соцсети.
export default function ShortsTab({ state, setState, links, longState }) {
  const automaticLinkIds = links.map((link) => link.id);
  const cards = Array.from({ length: SHORTS_COUNT }, (_, i) => ({
    ...makeEmptyCard(),
    ...(state?.cards?.[i] || {}),
    selectedLinkIds: automaticLinkIds,
    description: withDescriptionLinks(
      state?.cards?.[i]?.description || "",
      links,
      automaticLinkIds
    ),
  }));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fixText, setFixText] = useState(Array(SHORTS_COUNT).fill(""));

  function setCards(next) {
    setState({ cards: next });
  }
  function patchCard(i, p) {
    const next = cards.slice();
    next[i] = { ...next[i], ...p };
    setCards(next);
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

  const genOne = (i) =>
    run(`Генерирую карточку ${i + 1}…`, async () => {
      const card = cards[i];
      if (!card.topic.trim()) throw new Error(`Введите тему для карточки ${i + 1}`);
      const { shorts } = await callApi("generate-shorts", { topics: [card.topic] });
      patchCard(i, {
        titles: shorts[0].titles,
        description: withDescriptionLinks(shorts[0].description, links, automaticLinkIds),
      });
    });

  const genAll = () =>
    run("Генерирую все 4 карточки…", async () => {
      const missing = cards.filter((c) => !c.topic.trim());
      if (missing.length) throw new Error("Заполните тему во всех четырёх карточках");
      const { shorts } = await callApi("generate-shorts", { topics: cards.map((c) => c.topic) });
      setCards(cards.map((c, i) => ({
        ...c,
        titles: shorts[i].titles,
        description: withDescriptionLinks(shorts[i].description, links, automaticLinkIds),
      })));
    });

  // Перевыбор тем из сценария Long (Shorts #N = Шаг N) — только эта вкладка,
  // без перегенерации Записей и Соцсетей, в отличие от «Подготовить тексты».
  const genFromScript = () =>
    run("Беру 4 темы из шагов сценария…", async () => {
      if (!longState?.script?.trim()) throw new Error("Сначала нужен сценарий во вкладке YouTube Long");
      const { shorts } = await callApi("generate-shorts", {
        fromScript: {
          topic: longState.topic,
          script: longState.script,
          synopsis: longState.description?.synopsis,
        },
      });
      setCards(
        cards.map((c, i) => ({
          ...c,
          topic: shorts[i]?.topic ?? c.topic,
          titles: shorts[i]?.titles ?? null,
          description: shorts[i]
            ? withDescriptionLinks(shorts[i].description, links, automaticLinkIds)
            : c.description,
        }))
      );
    });

  const rework = (i) =>
    run(`Переделываю карточку ${i + 1}…`, async () => {
      const instruction = fixText[i];
      if (!instruction?.trim()) return;
      const card = cards[i];
      const { shorts } = await callApi("generate-shorts", {
        current: { topic: card.topic, titles: card.titles, description: card.description },
        instruction: instruction.trim(),
      });
      patchCard(i, {
        titles: shorts[0].titles,
        description: withDescriptionLinks(shorts[0].description, links, automaticLinkIds),
      });
      const next = fixText.slice();
      next[i] = "";
      setFixText(next);
    });

  const reworkStory = (i) =>
    run(`Пересобираю сценарий ${i + 1}…`, async () => {
      const card = cards[i];
      const selectedAngle = card.angles?.[card.selectedAngle || 0];
      const selectedHook = card.hooks?.[card.selectedHook || 0];
      if (!selectedAngle || !selectedHook) throw new Error("Сначала выберите угол подачи и хук");
      const { short } = await callApi("generate-shorts", {
        mode: "curiosity-rework",
        current: card,
        selectedAngle,
        selectedHook,
      });
      patchCard(i, {
        ...short,
        description: withDescriptionLinks(short.description, links, automaticLinkIds),
        selectedLinkIds: automaticLinkIds,
      });
    });

  return (
    <div>
      <div className="card">
        <strong>Четыре готовых Shorts</strong>
        <div className="muted small" style={{ marginTop: 6 }}>
          Сценарии, экранный план, заголовки и описания появились из общего материала во вкладке «Контент недели». Здесь их можно проверить и отредактировать перед публикацией.
        </div>
      </div>
      <div className="grid-3">
        {cards.map((card, i) => (
          <div className="card" key={i}>
            <div className="card-head"><strong>Shorts #{i + 1}</strong></div>
            <div className="field">
              <label>Тема Shorts</label>
              <input value={card.topic} onChange={(e) => patchCard(i, { topic: e.target.value })} />
            </div>
            {card.script && (
              <>
                {(card.angles || []).length > 0 && (
                  <div className="field">
                    <label>Угол подачи — выберите один</label>
                    <div className="story-options">
                      {card.angles.map((angle, angleIndex) => (
                        <button
                          type="button"
                          className={`story-option ${card.selectedAngle === angleIndex ? "selected" : ""}`}
                          key={`${angle.type}-${angleIndex}`}
                          onClick={() => patchCard(i, { selectedAngle: angleIndex })}
                          disabled={!!busy}
                        >
                          <strong>{angle.label || angle.type}</strong>
                          <span>{angle.promise || angle.centralQuestion}</span>
                          {angle.finalDiscovery && <small>Финал: {angle.finalDiscovery}</small>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(card.hooks || []).length > 0 && (
                  <div className="field">
                    <label>Hook Lab — выберите начало</label>
                    <div className="story-options">
                      {card.hooks.map((hook, hookIndex) => (
                        <button
                          type="button"
                          className={`story-option ${card.selectedHook === hookIndex ? "selected" : ""}`}
                          key={`${hook.mechanism}-${hookIndex}`}
                          onClick={() => patchCard(i, { selectedHook: hookIndex })}
                          disabled={!!busy}
                        >
                          <strong>{hook.mechanism}</strong>
                          <span>{hook.text}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      className="secondary"
                      onClick={() => reworkStory(i)}
                      disabled={!!busy || !(card.angles || []).length || !(card.hooks || []).length}
                    >
                      Пересобрать по выбранному углу и хуку
                    </button>
                  </div>
                )}
                <div className="field">
                  <div className="label-row">
                    <label>Сценарий диктора</label>
                    <CopyButton text={() => card.script} />
                  </div>
                  <textarea
                    style={{ minHeight: 240 }}
                    value={card.script}
                    onChange={(e) => patchCard(i, { script: e.target.value })}
                  />
                </div>
                <div className="research-context">
                  <strong>Открытый вопрос</strong>
                  <span className="small">{card.openQuestion || "—"}</span>
                  <strong>Практический вывод</strong>
                  <span className="small">{card.payoff || "—"}</span>
                </div>
                <div className="field">
                  <label>Что происходит на экране</label>
                  <textarea
                    style={{ minHeight: 110 }}
                    value={(card.screenPlan || []).join("\n")}
                    onChange={(e) => patchCard(i, { screenPlan: e.target.value.split("\n").filter(Boolean) })}
                  />
                </div>
                {(card.coverTexts || []).length > 0 && (
                  <div className="muted small">Текст для вашей обложки: {card.coverTexts.join(" · ")}</div>
                )}
                {(card.audit?.strengths?.length > 0 || card.audit?.risks?.length > 0) && (
                  <details className="story-audit">
                    <summary><strong>Аудит сценария</strong></summary>
                    {card.audit.strengths?.length > 0 && <div><strong>Сильные стороны</strong><ul>{card.audit.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
                    {card.audit.risks?.length > 0 && <div><strong>Риски</strong><ul>{card.audit.risks.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
                    {card.audit.valueDensity && <p><strong>Плотность пользы:</strong> {card.audit.valueDensity}</p>}
                    {card.audit.promiseAlignment && <p><strong>Обещание и результат:</strong> {card.audit.promiseAlignment}</p>}
                    {card.audit.openLoops?.length > 0 && <div><strong>Открытые вопросы</strong><ul>{card.audit.openLoops.map((item, index) => <li key={index}>{item.loop} → {item.payoff || "нет ответа"} ({item.status || "не проверено"})</li>)}</ul></div>}
                    {card.audit.experiment && <p><strong>Эксперимент после публикации:</strong> {card.audit.experiment}</p>}
                  </details>
                )}
              </>
            )}

            {!card.titles && <button onClick={() => genOne(i)} disabled={!!busy}>Подготовить заголовки и описание</button>}

            {card.titles && (
              <>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Варианты заголовка</label>
                  {card.titles.map((t, ti) => (
                    <div className="copy-input-row" key={ti}>
                      <input
                        value={t}
                        onChange={(e) => {
                          const titles = card.titles.slice();
                          titles[ti] = e.target.value;
                          patchCard(i, { titles });
                        }}
                      />
                      <CopyButton text={t} />
                    </div>
                  ))}
                </div>
                <div className="field">
                  <div className="label-row">
                    <label>Описание</label>
                    <CopyButton text={() => card.description} />
                  </div>
                  <textarea
                    style={{ minHeight: 140 }}
                    value={card.description}
                    onChange={(e) => patchCard(i, {
                      description: withDescriptionLinks(e.target.value, links, automaticLinkIds),
                    })}
                  />
                </div>
                <div className="fix-row">
                  <input
                    placeholder="Что исправить в заголовках или описании"
                    value={fixText[i] || ""}
                    onChange={(e) => {
                      const next = fixText.slice();
                      next[i] = e.target.value;
                      setFixText(next);
                    }}
                    disabled={!!busy}
                  />
                  <button onClick={() => rework(i)} disabled={!!busy || !fixText[i]?.trim()}>Переделать упаковку</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {busy && <div className="busy">{busy}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
