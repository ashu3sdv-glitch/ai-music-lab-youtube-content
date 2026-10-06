import LinkedInPlan from "./LinkedInPlan.jsx";
import { summarizeResults } from "../../shared/linkedin-workspace.js";

export default function LinkedInResults({ plan, setPlan }) {
  const summary = summarizeResults(plan);
  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>Выводы по результатам</strong></div>
        {summary.warning ? <div className="muted">{summary.warning}</div> : (
          <div className="results-summary">
            <div><strong>Больше внимания</strong><span>{summary.bestAttention.topic} — {summary.bestAttention.metrics.impressions.toLocaleString("ru-RU")} показов</span></div>
            <div><strong>Больше содержательных действий</strong><span>{summary.bestDiscussion.topic} — комментарии: {summary.bestDiscussion.metrics.comments}, сохранения: {summary.bestDiscussion.metrics.saves}, репосты: {summary.bestDiscussion.metrics.reposts}</span></div>
            <div><strong>Лучший бизнес-сигнал</strong><span>{summary.bestBusiness.topic} — обращения: {summary.bestBusiness.metrics.inquiries}, целевые заявки: {summary.bestBusiness.metrics.qualified_leads}</span></div>
            <div><strong>Кандидат на новый тест</strong><span>Повторить формат «{summary.bestAttention.content_type === "article" ? "статья" : "короткая публикация"}» на новой теме. Самый слабый охват пока у материала «{summary.weakest.topic}».</span></div>
            <div className="muted small">Это наблюдения по вашим данным, а не доказательство причинности. Проверяйте рекомендацию следующим материалом.</div>
          </div>
        )}
      </div>
      <LinkedInPlan plan={plan} setPlan={setPlan} showMetrics />
    </div>
  );
}
