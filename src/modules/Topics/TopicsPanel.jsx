import { useCallback, useState } from "react";
import TopicsTable from "./TopicsTable.jsx";
import { useTopicResearch } from "./useTopicResearch.js";

export default function TopicsPanel({ state, setState, onUseTopic }) {
  const [base, setBase] = useState(state?.base || "suno");
  const [limit, setLimit] = useState(state?.limit || 30);
  const [painOnly, setPainOnly] = useState(state?.painOnly ?? true);
  const [manual, setManual] = useState("");
  const persistResults = useCallback(
    (results) => setState((current) => ({ ...(current || {}), base, limit, painOnly, results })),
    [setState, base, limit, painOnly]
  );
  const research = useTopicResearch({ initialResults: state?.results || [], onResults: persistResults });
  const running = research.status === "suggesting" || research.status === "analyzing";
  const quotaPercent = Math.min(100, (research.quotaUsed / research.quotaLimit) * 100);

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <div>
            <strong>Поиск тем по реальным запросам YouTube</strong>
            <div className="muted small">Собирает формулировки зрителей и оценивает спрос, конкуренцию и свежесть выдачи.</div>
          </div>
          <span className="quota-label">Квота: {research.quotaUsed} / {research.quotaLimit}</span>
        </div>
        <div className="quota-track"><span style={{ width: `${quotaPercent}%` }} /></div>

        <div className="topics-controls">
          <div className="field">
            <label>Сид-слово</label>
            <input value={base} onChange={(event) => setBase(event.target.value)} disabled={running} />
          </div>
          <div className="field">
            <label>Фраз для анализа</label>
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} disabled={running}>
              {[10, 20, 30, 50].map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
        </div>

        <label className="checkbox-row topics-checkbox">
          <input type="checkbox" checked={painOnly} onChange={(event) => setPainOnly(event.target.checked)} disabled={running} />
          <span>
            <strong>Только запросы с болью</strong>
            <span className="muted small">не работает, почему, ошибка, проблема, обрывает</span>
          </span>
        </label>

        <details className="manual-topics">
          <summary>Ввести фразы вручную</summary>
          <label>По одной фразе на строку — пригодится, если автоподсказка недоступна</label>
          <textarea
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            disabled={running}
            placeholder={"suno не дописывает песню\nsuno почему обрывает трек"}
          />
        </details>

        <div className="row">
          {!running ? (
            <button
              onClick={() => research.run({ base, limit, painOnly, manual })}
              disabled={!base.trim() && !manual.trim()}
            >
              Собрать темы
            </button>
          ) : (
            <button className="secondary" onClick={research.stop}>Остановить</button>
          )}
          <span className="muted small">Неиспользованные результаты берутся из кэша 7 дней. Сброс квоты: {research.resetTime}.</span>
        </div>

        {running && (
          <div className="research-progress">
            <div className="progress-track">
              <span style={{ width: `${research.progress.total ? research.progress.current / research.progress.total * 100 : 0}%` }} />
            </div>
            <div className="small">{research.progress.text}{research.status === "suggesting" ? ` · найдено ${research.progress.found}` : ""}</div>
          </div>
        )}
        {research.error && <div className="error">{research.error}</div>}
      </div>

      {research.results.length > 0 && <TopicsTable rows={research.results} onUse={onUseTopic} />}
    </div>
  );
}
