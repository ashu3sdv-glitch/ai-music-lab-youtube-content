import { AssetImage, KEYFRAME_LABELS } from "./FilmPreparation.jsx";

export default function FilmStoryboardStrip({ shots = [], assets = [], activeShotId = "", onSelect, onMove, canMove }) {
  if (!shots.length) {
    return <div className="card film-storyboard-strip">
      <div className="card-head"><div><strong>Покадровая лента</strong><div className="muted small">Сначала создайте сценарий или план клипа</div></div></div>
      <div className="film-empty-preparation">Здесь появятся фотографии будущего фильма в порядке монтажа.</div>
    </div>;
  }

  function selectShot(shotId) {
    onSelect?.(shotId);
    requestAnimationFrame(() => {
      const target = document.getElementById(`film-shot-${shotId}`);
      if (target?.tagName === "DETAILS") target.open = true;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return <section className="card film-storyboard-strip" aria-label="Покадровая лента">
    <div className="card-head">
      <div><strong>Покадровая лента</strong><div className="muted small">Сначала соберите историю из фотографий, затем оживляйте утверждённые кадры</div></div>
      <span className="film-badge">{shots.length} кадров</span>
    </div>
    <div className="film-storyboard-track">
      {shots.map((shot, index) => {
        const keyframeAsset = assets.find((asset) => asset.id === shot.keyframe?.assetId && asset.kind === "keyframe");
        const status = shot.keyframe?.status || "MISSING";
        return <article className={`film-storyboard-card ${activeShotId === shot.id ? "selected" : ""}`} key={shot.id}>
          <button type="button" className="film-storyboard-select" aria-pressed={activeShotId === shot.id} onClick={() => selectShot(shot.id)}>
            <span className="film-storyboard-number">{index + 1}</span>
            {keyframeAsset
              ? <AssetImage asset={keyframeAsset} className="film-storyboard-image" alt={`Кадр ${index + 1}`} />
              : <span className="film-storyboard-placeholder">Фотография<br />ещё не добавлена</span>}
            <strong>{shot.id}</strong>
            <span>{shot.action || shot.visual || shot.purpose || shot.storyPurpose || "Кадр"}</span>
            <small>{shot.duration || (Number.isFinite(shot.end - shot.start) ? `${Math.max(0, shot.end - shot.start)} сек` : "")}</small>
            <span className={`film-keyframe-status ${status.toLowerCase()}`}>{KEYFRAME_LABELS[status] || status}</span>
          </button>
          <div className="film-storyboard-order">
            <button type="button" className="secondary" disabled={index === 0 || canMove?.(shot, index, -1) === false} onClick={() => onMove?.(shot.id, -1)} aria-label={`Переместить ${shot.id} влево`}>←</button>
            <button type="button" className="secondary" disabled={index === shots.length - 1 || canMove?.(shot, index, 1) === false} onClick={() => onMove?.(shot.id, 1)} aria-label={`Переместить ${shot.id} вправо`}>→</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
