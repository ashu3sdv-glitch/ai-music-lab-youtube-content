import { Fragment, useMemo, useState } from "react";
import { topicLabel } from "./scoring.js";

const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function exportCsv(rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Фраза", "Скор", "Метка", "Медиана просмотров", "Медиана подписчиков", "Свежесть", "Аномалия"],
    ...rows.map((row) => {
      const label = topicLabel(row.score, row.topVideos?.length > 0).text;
      return [
        row.query, row.score, label, row.metrics.medianViews, row.metrics.medianSubs,
        `${Math.round(row.metrics.freshShare * 100)}%`,
        row.metrics.viewsToSubsRatio > 5 ? "Да" : "Нет",
      ];
    }),
  ];
  const blob = new Blob([`\uFEFF${lines.map((line) => line.map(escape).join(";")).join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `topics-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TopicsTable({ rows, onUse }) {
  const [sort, setSort] = useState({ key: "score", direction: -1 });
  const [expanded, setExpanded] = useState("");

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const read = (row) => {
      if (sort.key === "query") return row.query.toLocaleLowerCase("ru");
      if (sort.key === "score") return row.score;
      return row.metrics?.[sort.key] || 0;
    };
    const av = read(a);
    const bv = read(b);
    return (typeof av === "string" ? av.localeCompare(bv, "ru") : av - bv) * sort.direction;
  }), [rows, sort]);

  function changeSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key ? current.direction * -1 : key === "query" ? 1 : -1,
    }));
  }

  const header = (key, label) => (
    <button className="table-sort" onClick={() => changeSort(key)}>
      {label}{sort.key === key ? (sort.direction > 0 ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <div className="card">
      <div className="card-head">
        <strong>Найденные темы — {rows.length}</strong>
        <button className="secondary" onClick={() => exportCsv(sorted)}>Экспорт CSV</button>
      </div>
      <div className="topics-table-wrap">
        <table className="topics-table">
          <thead>
            <tr>
              <th>{header("query", "Фраза")}</th>
              <th>{header("score", "Скор")}</th>
              <th>Метка</th>
              <th>{header("medianViews", "Мед. просмотры")}</th>
              <th>{header("medianSubs", "Мед. подписчики")}</th>
              <th>{header("freshShare", "Свежесть")}</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const hasData = row.topVideos?.length > 0;
              const label = topicLabel(row.score, hasData);
              const isOpen = expanded === row.query;
              return (
                <Fragment key={row.query}>
                  <tr className="topic-row" onClick={() => setExpanded(isOpen ? "" : row.query)}>
                    <td>
                      <strong>{row.query}</strong>
                      {row.cached && <span className="topic-badge muted">кэш</span>}
                    </td>
                    <td className="topic-score">{row.score}</td>
                    <td>
                      <span className={`topic-badge ${label.tone}`}>{label.text}</span>
                      {row.metrics.viewsToSubsRatio > 5 && <span className="topic-badge anomaly">Аномалия</span>}
                    </td>
                    <td>{number.format(row.metrics.medianViews)}</td>
                    <td>{number.format(row.metrics.medianSubs)}</td>
                    <td>{Math.round(row.metrics.freshShare * 100)}%</td>
                    <td>
                      <button onClick={(event) => { event.stopPropagation(); onUse(row); }}>В сценарий</button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${row.query}-details`}>
                      <td colSpan="7">
                        <div className="topic-videos">
                          {hasData ? row.topVideos.map((video, index) => (
                            <a
                              key={video.videoId}
                              href={`https://www.youtube.com/watch?v=${video.videoId}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {index + 1}. {video.title}
                              <span>{video.channelTitle} · {number.format(video.viewCount)} просмотров</span>
                            </a>
                          )) : <span className="muted">Видео не найдены</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
