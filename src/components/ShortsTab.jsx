import { useState } from "react";
import { callApi } from "../lib/api.js";
import LinksPicker from "./LinksPicker.jsx";
import CopyButton from "./CopyButton.jsx";

const emptyCard = { topic: "", titles: null, description: null, selectedLinkIds: [] };

// 3 карточки YouTube Shorts: тема → описание + 2 заголовка, генерация все сразу
// или по одной, точечная правка на каждой карточке отдельно.
export default function ShortsTab({ state, setState, links }) {
  const cards = state?.cards || [emptyCard, emptyCard, emptyCard];
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fixText, setFixText] = useState(["", "", ""]);

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
      const selectedLinks = links.filter((l) => card.selectedLinkIds.includes(l.id));
      const { shorts } = await callApi("generate-shorts", { topics: [card.topic], links: selectedLinks });
      patchCard(i, { titles: shorts[0].titles, description: shorts[0].description });
    });

  const genAll = () =>
    run("Генерирую все 3 карточки…", async () => {
      const missing = cards.filter((c) => !c.topic.trim());
      if (missing.length) throw new Error("Заполните тему во всех трёх карточках");
      const { shorts } = await callApi("generate-shorts", { topics: cards.map((c) => c.topic) });
      setCards(cards.map((c, i) => ({ ...c, titles: shorts[i].titles, description: shorts[i].description })));
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
      patchCard(i, { titles: shorts[0].titles, description: shorts[0].description });
      const next = fixText.slice();
      next[i] = "";
      setFixText(next);
    });

  return (
    <div>
      <div className="row">
        <button onClick={genAll} disabled={!!busy}>Сгенерировать все 3</button>
      </div>
      <div className="grid-3">
        {cards.map((card, i) => (
          <div className="card" key={i}>
            <div className="card-head"><strong>Shorts #{i + 1}</strong></div>
            <div className="field">
              <label>Тема Shorts</label>
              <input value={card.topic} onChange={(e) => patchCard(i, { topic: e.target.value })} />
            </div>
            <LinksPicker links={links} selected={card.selectedLinkIds} onChange={(ids) => patchCard(i, { selectedLinkIds: ids })} />
            <button onClick={() => genOne(i)} disabled={!!busy}>Сгенерировать</button>

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
                  <textarea style={{ minHeight: 140 }} value={card.description} onChange={(e) => patchCard(i, { description: e.target.value })} />
                </div>
                <div className="fix-row">
                  <input
                    placeholder="Что исправить"
                    value={fixText[i] || ""}
                    onChange={(e) => {
                      const next = fixText.slice();
                      next[i] = e.target.value;
                      setFixText(next);
                    }}
                    disabled={!!busy}
                  />
                  <button onClick={() => rework(i)} disabled={!!busy || !fixText[i]?.trim()}>Переделать</button>
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
