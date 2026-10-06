import { useEffect, useMemo, useState } from "react";
import {
  invalidateShotPreparation,
  isShotReadyForVideo,
  normalizeShotKeyframe,
} from "../../shared/film-studio.js";
import CopyButton from "./CopyButton.jsx";

const CATEGORIES = [
  ["character", "Персонаж"],
  ["costume", "Одежда"],
  ["location", "Локация"],
  ["object", "Предмет"],
  ["vehicle", "Транспорт"],
  ["style", "Визуальный стиль"],
  ["other", "Другое"],
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES);
export const KEYFRAME_LABELS = {
  MISSING: "Keyframe не добавлен",
  PENDING: "Ожидает проверки",
  APPROVED: "Keyframe утверждён",
  REJECTED: "Нужно переделать",
  STALE: "Устарел после изменений",
  BYPASSED: "Разрешено без keyframe",
};

function formatBytes(value) {
  const megabytes = Number(value) / (1024 * 1024);
  return `${Math.max(0, megabytes).toFixed(megabytes >= 1 ? 1 : 2)} МБ`;
}

function validateImage(file) {
  if (!file) throw new Error("Выберите изображение");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Поддерживаются изображения PNG, JPEG и WebP");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Одно изображение не должно превышать 10 МБ");
}

export function AssetImage({ asset, alt, className = "" }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!(asset?.blob instanceof Blob)) {
      setUrl("");
      return undefined;
    }
    let nextUrl = "";
    try {
      nextUrl = URL.createObjectURL(asset.blob);
    } catch {
      setUrl("");
      return undefined;
    }
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [asset?.blob]);

  if (!url) return <span className={`film-asset-missing ${className}`}>Файл недоступен</span>;
  return <img className={className} src={url} alt={alt || asset.label || "Референс"} />;
}

export function ReferencePack({ assets, requirements = [], loading, storageError, onSaveAsset, onDeleteReference }) {
  const references = useMemo(() => assets.filter((asset) => asset.kind === "reference"), [assets]);
  const [category, setCategory] = useState("character");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setError("");
    if (references.length + files.length > 30) {
      setError("В Reference Pack можно сохранить до 30 изображений");
      return;
    }
    const currentSize = references.reduce((sum, asset) => sum + (Number(asset.size) || 0), 0);
    const nextSize = files.reduce((sum, file) => sum + file.size, currentSize);
    if (nextSize > 80 * 1024 * 1024) {
      setError("Общий размер Reference Pack не должен превышать 80 МБ");
      return;
    }

    setBusy(true);
    try {
      for (const file of files) {
        validateImage(file);
        await onSaveAsset({
          id: crypto.randomUUID(),
          kind: "reference",
          category,
          label: label.trim() || file.name.replace(/\.[^.]+$/, "") || "Референс",
          fileName: file.name,
          blob: file,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setLabel("");
    } catch (cause) {
      setError(cause.message || "Не удалось сохранить изображение");
    } finally {
      setBusy(false);
    }
  }

  async function removeReference(id) {
    setError("");
    setBusy(true);
    try {
      await onDeleteReference(id);
    } catch (cause) {
      setError(cause.message || "Не удалось удалить изображение");
    } finally {
      setBusy(false);
    }
  }

  return <div className="card film-reference-pack">
    <div className="card-head">
      <div><strong>Reference Pack</strong><div className="muted small">Общие образы для всех кадров фильма и клипа</div></div>
      <span className="film-badge">{references.length}/30 изображений</span>
    </div>

    {!!requirements.length && <details className="film-reference-requirements" open>
      <summary><strong>Что желательно подготовить</strong> · {requirements.length}</summary>
      <p className="muted small">Скопируйте готовый промпт, создайте изображение в выбранном генераторе и загрузите результат ниже.</p>
      <div className="film-requirement-list">{requirements.map((item, index) => {
        const structured = item && typeof item === "object";
        const title = structured ? item.title : item;
        const prompt = structured ? item.prompt : "";
        return <article className="film-requirement-item" key={structured ? (item.id || `${title}-${index}`) : `${item}-${index}`}>
          <div className="label-row">
            <strong>{title}</strong>
            {prompt && <CopyButton text={() => prompt} label="Копировать промпт" />}
          </div>
          {prompt && <details>
            <summary>Показать промпт</summary>
            <pre>{prompt}</pre>
          </details>}
        </article>;
      })}</div>
    </details>}

    <div className="film-reference-add">
      <div className="field">
        <label>Тип референса</label>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select>
      </div>
      <div className="field">
        <label>Название — необязательно</label>
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Например: героиня, вид ¾" />
      </div>
      <label className={`film-file-button ${busy ? "disabled" : ""}`}>
        {busy ? "Сохраняю…" : "+ Добавить изображения"}
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} onChange={addFiles} />
      </label>
    </div>

    <p className="muted small">PNG, JPEG или WebP до 10 МБ. Файлы сохраняются только в этом браузере и не отправляются на сервер.</p>
    {(error || storageError) && <div className="error" role="alert">{error || storageError}</div>}
    {loading && <p className="muted">Загружаю сохранённые изображения…</p>}
    {!loading && !references.length && <div className="film-empty-preparation">Добавьте лицо героя, одежду, ключевые локации или образец визуального стиля.</div>}

    {!!references.length && <div className="film-reference-grid">{references.map((asset) => <article className="film-reference-card" key={asset.id}>
      <AssetImage asset={asset} className="film-reference-thumb" />
      <div className="film-reference-meta">
        <span className="film-source">{CATEGORY_LABELS[asset.category] || "Другое"}</span>
        <strong>{asset.label}</strong>
        <small>{formatBytes(asset.size)}</small>
        <button className="link" type="button" disabled={busy} onClick={() => removeReference(asset.id)}>Удалить</button>
      </div>
    </article>)}</div>}
  </div>;
}

export function ShotKeyframeReview({
  shot,
  assets,
  loading,
  disabled = false,
  onBusyChange = () => {},
  onPatch,
  onSaveAsset,
  onDeleteAsset,
}) {
  const references = useMemo(() => assets.filter((asset) => asset.kind === "reference"), [assets]);
  const keyframe = normalizeShotKeyframe(shot.keyframe);
  const keyframeAsset = assets.find((asset) => asset.id === keyframe.assetId);
  const canProceed = keyframe.status === "BYPASSED"
    || (isShotReadyForVideo(keyframe) && Boolean(keyframeAsset));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patchInvalidated(next = {}) {
    onPatch({ ...invalidateShotPreparation({ ...shot, ...next }) });
  }

  function toggleReference(assetId) {
    const selected = new Set(shot.referenceAssetIds || []);
    if (selected.has(assetId)) selected.delete(assetId);
    else selected.add(assetId);
    patchInvalidated({ referenceAssetIds: [...selected].slice(0, 12) });
  }

  async function uploadKeyframe(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    onBusyChange(true);
    try {
      validateImage(file);
      const assetId = keyframe.assetId || crypto.randomUUID();
      await onSaveAsset({
        id: assetId,
        kind: "keyframe",
        category: "other",
        label: `Keyframe ${shot.id || "кадра"}`,
        fileName: file.name,
        blob: file,
        createdAt: keyframeAsset?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      onPatch((currentShot) => {
        const invalidated = invalidateShotPreparation(currentShot);
        return {
          ...invalidated,
          keyframe: { assetId, status: "PENDING", note: "", bypassReason: "", reviewedAt: "" },
        };
      });
    } catch (cause) {
      setError(cause.message || "Не удалось сохранить keyframe");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  function approveKeyframe() {
    if (!keyframeAsset || keyframe.status === "APPROVED") return;
    const next = {
      ...shot,
      keyframe: { ...keyframe, status: "APPROVED", bypassReason: "", reviewedAt: new Date().toISOString() },
    };
    if (shot.status) next.status = { ...shot.status, image: true, video: false, final: false };
    if (Object.prototype.hasOwnProperty.call(shot, "ready")) next.ready = false;
    onPatch(next);
  }

  function rejectKeyframe() {
    const next = invalidateShotPreparation(shot);
    onPatch({ ...next, keyframe: { ...keyframe, status: "REJECTED", reviewedAt: new Date().toISOString() } });
  }

  function toggleBypass() {
    if (keyframe.status === "BYPASSED") {
      const next = invalidateShotPreparation(shot);
      onPatch({ ...next, keyframe: { ...keyframe, status: keyframe.assetId ? "PENDING" : "MISSING", bypassReason: "", reviewedAt: "" } });
      return;
    }
    const next = invalidateShotPreparation(shot);
    onPatch({
      ...next,
      keyframe: {
        ...keyframe,
        status: "BYPASSED",
        bypassReason: "Пользователь решил продолжить без утверждённого keyframe",
        reviewedAt: new Date().toISOString(),
      },
    });
  }

  async function removeKeyframe() {
    const assetId = keyframe.assetId;
    const next = invalidateShotPreparation(shot);
    onPatch({ ...next, keyframe: normalizeShotKeyframe(null) });
    if (!assetId) return;
    setError("");
    setBusy(true);
    onBusyChange(true);
    try {
      await onDeleteAsset(assetId);
    } catch (cause) {
      setError(cause.message || "Keyframe отвязан, но файл не удалось удалить из хранилища");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  const statusClass = keyframe.status.toLowerCase();

  return <div className="film-keyframe-review">
    <div className="card-head">
      <div><strong>Подготовка к генерации видео</strong><div className="muted small">Референсы → keyframe → проверка → видео</div></div>
      <span className={`film-keyframe-status ${statusClass}`}>{KEYFRAME_LABELS[keyframe.status]}</span>
    </div>

    <details className="film-shot-references" open={!shot.referenceAssetIds?.length}>
      <summary><strong>Референсы этого кадра</strong> · {shot.referenceAssetIds?.length || 0}</summary>
      {!references.length ? <p className="muted small">Сначала добавьте изображения в общий Reference Pack.</p> : <div className="film-reference-picker">{references.map((asset) => <label className={shot.referenceAssetIds?.includes(asset.id) ? "selected" : ""} key={asset.id}>
        <input type="checkbox" disabled={disabled || busy} checked={Boolean(shot.referenceAssetIds?.includes(asset.id))} onChange={() => toggleReference(asset.id)} />
        <AssetImage asset={asset} className="film-reference-picker-thumb" />
        <span>{asset.label}</span>
      </label>)}</div>}
    </details>

    <div className="film-keyframe-layout">
      <div className="film-keyframe-preview">
        {keyframeAsset ? <AssetImage asset={keyframeAsset} alt={`Keyframe ${shot.id || "кадра"}`} /> : <div className="film-keyframe-placeholder">{keyframe.assetId && !loading ? "Файл keyframe недоступен" : "Здесь появится выбранный keyframe"}</div>}
      </div>
      <div className="film-keyframe-controls">
        <a className="button-link secondary" href="https://higgsfield.ai/" target="_blank" rel="noreferrer">Открыть Higgsfield для изображения</a>
        <label className={`film-file-button ${busy || disabled ? "disabled" : ""}`}>
          {keyframeAsset ? "Заменить keyframe" : "Загрузить keyframe"}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || disabled} onChange={uploadKeyframe} />
        </label>
        {keyframeAsset && <button type="button" className="secondary" onClick={removeKeyframe} disabled={busy || disabled}>Удалить keyframe</button>}
      </div>
    </div>

    {error && <div className="error" role="alert">{error}</div>}
    <div className="row film-keyframe-actions">
      <button type="button" onClick={approveKeyframe} disabled={!keyframeAsset || keyframe.status === "APPROVED" || busy || disabled}>{keyframe.status === "APPROVED" ? "Keyframe принят" : "Принять keyframe"}</button>
      <button type="button" className="secondary" onClick={rejectKeyframe} disabled={!keyframeAsset || busy || disabled}>Нужно переделать</button>
      <button type="button" className="link" disabled={busy || disabled} onClick={toggleBypass}>{keyframe.status === "BYPASSED" ? "Отменить пропуск" : "Продолжить без keyframe"}</button>
    </div>

    {canProceed
      ? <div className="film-video-ready"><span>Кадр допущен к созданию видео.</span><a className="button-link" href="https://higgsfield.ai/" target="_blank" rel="noreferrer">Перейти к созданию видео</a></div>
      : <p className="film-video-locked">Сначала примите keyframe или выберите «Продолжить без keyframe».</p>}
  </div>;
}
