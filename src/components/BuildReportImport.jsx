import { useMemo, useState } from "react";
import { callApi } from "../lib/api.js";
import { normalizeBuildReport } from "../../shared/linkedin-workspace.js";

const EMPTY_REPORT = { report_id: "", report_period: "", stories: [], verified_facts: [], metrics: [], ai_interpretations: [], unknown: [] };

export default function BuildReportImport({ history = [], onCreate }) {
  const [fileName, setFileName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [report, setReport] = useState(EMPTY_REPORT);
  const [storyIndex, setStoryIndex] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const episode = useMemo(() => Math.max(0, ...history.map((item) => Number(item?.build_meta?.episode_number) || 0)) + 1, [history]);
  const previous = history.find((item) => item?.build_meta?.next_step)?.build_meta;

  async function loadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(json|md)$/iu.test(file.name)) return setError("Поддерживаются только файлы .json и .md");
    if (file.size > 300_000) return setError("Файл слишком большой: максимум 300 КБ");
    setFileName(file.name); setSourceText(await file.text()); setReport(EMPTY_REPORT); setError("");
  }

  async function analyze() {
    if (!sourceText.trim()) return setError("Загрузите отчёт или вставьте его текст");
    setBusy("Проверяю факты и ищу историю…"); setError("");
    try {
      const response = await callApi("generate-linkedin", { mode: "analyze_build_report", sourceText });
      const next = normalizeBuildReport(response.report);
      if (!next.stories.length) throw new Error("В отчёте не удалось выделить самостоятельную историю");
      setReport(next); setStoryIndex(0);
    } catch (err) { setError(err.message || "Не удалось разобрать отчёт"); }
    finally { setBusy(""); }
  }

  function create(format, length) {
    const story = report.stories[storyIndex];
    const facts = report.verified_facts.map((item) => `- ${item.statement}`).join("\n");
    const metrics = report.metrics.map((item) => `- ${item.name}: ${item.value}`).join("\n");
    const source = [
      `Серия: «Строю AI-бизнес с нуля». Эпизод ${episode}.`,
      `Период отчёта: ${report.report_period || "не указан"}.`,
      previous?.next_step ? `Обещанный в прошлом выпуске шаг: ${previous.next_step}` : "",
      `Выбранная история: ${story.title}. ${story.angle}`,
      `Подтверждённые отчётом факты:\n${facts || "Нет извлечённых фактов"}`,
      metrics ? `Показатели:\n${metrics}` : "",
      report.main_learning ? `Вывод из отчёта: ${report.main_learning}` : "",
      report.next_experiment ? `Следующий эксперимент: ${report.next_experiment}` : "",
      `Желаемый формат: ${length}. Не использовать сведения из AI INTERPRETATION как установленные факты.`,
      `Исходный Build Report:\n${sourceText}`,
    ].filter(Boolean).join("\n\n");
    const evidence = report.verified_facts.map((item) => ({
      id: crypto.randomUUID(), text: item.statement, evidence_type: "FACT", source_url: "",
      source_fragment: item.source_fragment, confidence: "high", verification_status: "VERIFIED",
    }));
    onCreate({
      title: `Эпизод ${episode}: ${story.title}`, sourceType: "build_report", sourceText: source,
      contentMode: "build_in_public", contentFormat: format, evidence,
      tags: ["Build in Public", "AI-бизнес", "эксперимент"],
      buildMeta: { episode_number: episode, report_period: report.report_period, story: story.title,
        source_report: fileName || report.report_id || "вставленный отчёт", previous_next_step: previous?.next_step || "",
        current_result: report.main_learning, next_step: report.next_experiment },
    });
  }

  return <div className="card">
    <div className="card-head"><strong>Import Build Report</strong><span className="muted small">Серия «Строю AI-бизнес с нуля» · следующий эпизод {episode}</span></div>
    {previous?.next_step && <div className="research-context"><strong>Связь с прошлой неделей:</strong> {previous.next_step}</div>}
    <div className="field"><label>Файл Weekly Build Report (.json или .md)</label><input type="file" accept=".json,.md,application/json,text/markdown" onChange={loadFile} /></div>
    <div className="field"><label>Содержимое отчёта</label><textarea className="linkedin-source" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Можно загрузить файл или вставить отчёт вручную…" /></div>
    <button onClick={analyze} disabled={!!busy}>{busy || "Analyze: проверить факты и найти историю"}</button>
    {error && <div className="error">{error}</div>}
    {!!report.stories.length && <div className="linkedin-news-results">
      <div className="card-head"><strong>Story Finder — выберите один сюжет</strong><span className="muted small">Период: {report.report_period || "не указан"}</span></div>
      {report.stories.map((story, index) => <label className="linkedin-news-card" key={`${story.title}-${index}`}>
        <input type="radio" checked={storyIndex === index} onChange={() => setStoryIndex(index)} /> <strong>{story.title}</strong>
        <p>{story.angle}</p><div className="muted small">{story.why_interesting}</div>
      </label>)}
      <details><summary>Подтверждённые факты — {report.verified_facts.length}</summary><ul>{report.verified_facts.map((item, index) => <li key={index}>{item.statement}</li>)}</ul></details>
      <details><summary>Показатели — {report.metrics.length}</summary><ul>{report.metrics.map((item, index) => <li key={index}>{item.name}: {item.value}</li>)}</ul></details>
      <details><summary>AI-интерпретации — {report.ai_interpretations.length}</summary><ul>{report.ai_interpretations.map((item, index) => <li key={index}>{item}</li>)}</ul></details>
      <details><summary>Неизвестно — {report.unknown.length}</summary><ul>{report.unknown.map((item, index) => <li key={index}>{item}</li>)}</ul></details>
      {!!report.headline_options.length && <div className="research-context"><strong>Варианты заголовка:</strong><ul>{report.headline_options.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      <div className="row">
        <button onClick={() => create("post", "короткий LinkedIn Short Post")}>Короткий пост</button>
        <button onClick={() => create("post", "подробный LinkedIn Long Post")}>Подробный пост</button>
        <button onClick={() => create("article", "полноценная LinkedIn Article")}>Статья</button>
      </div>
    </div>}
  </div>;
}
