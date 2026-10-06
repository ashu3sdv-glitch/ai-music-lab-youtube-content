import { PIPELINE_STATUSES, normalizePlanItem } from "../../shared/linkedin-workspace.js";

export const METRIC_LABELS = {
  impressions: "Показы",
  reactions: "Реакции",
  comments: "Комментарии",
  reposts: "Репосты",
  saves: "Сохранения",
  profile_views: "Просмотры профиля",
  followers_gained: "Новые подписчики",
  link_clicks: "Переходы по ссылке",
  inquiries: "Обращения",
  qualified_leads: "Целевые заявки",
};

export default function LinkedInPlan({ plan, setPlan, showMetrics = false }) {
  function update(id, patch) {
    setPlan(plan.map((item) => item.id === id ? normalizePlanItem({ ...item, ...patch }) : item));
  }

  function downloadImage(item) {
    if (!item.image?.dataUrl) return;
    const link = document.createElement("a");
    link.href = item.image.dataUrl;
    link.download = `linkedin-${item.id}.png`;
    link.click();
  }

  const visible = plan.filter((item) => showMetrics ? ["PUBLISHED", "MEASURED"].includes(item.status) : item.status !== "ARCHIVED");

  return (
    <div>
      {!visible.length && <div className="card muted">{showMetrics ? "Сначала отметьте публикацию как PUBLISHED." : "Контент-план пока пуст."}</div>}
      {visible.map((item) => (
        <div className="card" key={item.id}>
          <div className="card-head">
            <div><strong>{item.topic || "Без названия"}</strong><div className="muted small">{item.build_meta?.episode_number ? `Строю AI-бизнес с нуля · эпизод ${item.build_meta.episode_number} · ` : ""}{item.content_type === "article" ? "Статья" : "Публикация"}</div></div>
            <select value={item.status} onChange={(event) => update(item.id, { status: event.target.value })}>
              {PIPELINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          {item.build_meta?.episode_number > 0 && <div className="research-context">
            <strong>История выпуска:</strong> {item.build_meta.story || "сюжет не указан"}
            {item.build_meta.report_period && <div>Период: {item.build_meta.report_period}</div>}
            {item.build_meta.source_report && <div>Источник: {item.build_meta.source_report}</div>}
            {item.build_meta.next_step && <div>Следующий эксперимент: {item.build_meta.next_step}</div>}
          </div>}
          <div className="linkedin-settings-grid">
            <div className="field"><label>Плановая дата</label><input type="date" value={item.planned_date} onChange={(event) => update(item.id, { planned_date: event.target.value })} /></div>
            <div className="field"><label>Ссылка на опубликованный материал</label><input value={item.published_url} onChange={(event) => update(item.id, { published_url: event.target.value })} placeholder="https://linkedin.com/…" /></div>
          </div>
          <div className="field"><label>Заметки</label><textarea className="linkedin-opening" value={item.notes} onChange={(event) => update(item.id, { notes: event.target.value })} /></div>
          {item.image?.dataUrl && <div className="linkedin-plan-image"><img src={item.image.dataUrl} alt={item.topic} /><button className="secondary" onClick={() => downloadImage(item)}>Скачать изображение</button></div>}

          {showMetrics && (
            <div className="metrics-grid">
              {Object.entries(METRIC_LABELS).map(([field, label]) => (
                <div className="field" key={field}>
                  <label>{label}</label>
                  <input type="number" min="0" value={item.metrics[field]} onChange={(event) => update(item.id, {
                    metrics: { ...item.metrics, [field]: Number(event.target.value) || 0 },
                  })} />
                </div>
              ))}
              <button onClick={() => update(item.id, { status: "MEASURED" })}>Сохранить результаты</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
