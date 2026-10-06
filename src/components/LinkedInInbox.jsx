import { useState } from "react";
import { callApi } from "../lib/api.js";
import {
  MATERIAL_STATUSES,
  createMaterial,
  normalizeEvidenceClaim,
  normalizeMaterial,
} from "../../shared/linkedin-workspace.js";

export const SOURCE_TYPE_LABELS = {
  manual_note: "Ручная заметка",
  article_url: "URL статьи",
  company_site: "Сайт компании",
  ai_news: "Новость об AI",
  site_review: "Разбор сайта",
  own_product: "Собственная разработка",
  audience_problem: "Проблема аудитории",
  youtube_transcript: "Расшифровка YouTube",
};

const EMPTY_FORM = {
  title: "",
  source_type: "manual_note",
  source_url: "",
  source_text: "",
  author_or_company: "",
  published_at: "",
  language: "ru",
  tags: "",
};

export default function LinkedInInbox({ materials, setMaterials, selectedId, setSelectedId, onUse }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const selected = materials.find((item) => item.id === selectedId) || null;

  function addMaterial() {
    if (!form.title.trim()) return setError("Укажите название материала");
    if (!form.source_text.trim() && !form.source_url.trim()) return setError("Добавьте текст или URL источника");
    const material = createMaterial({
      ...form,
      tags: form.tags.split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean),
    }, { id: crypto.randomUUID() });
    setMaterials([material, ...materials]);
    setSelectedId(material.id);
    setForm(EMPTY_FORM);
    setError("");
  }

  function updateMaterial(id, patch) {
    setMaterials(materials.map((item) => item.id === id ? normalizeMaterial({ ...item, ...patch }) : item));
  }

  async function analyzeEvidence() {
    if (!selected?.source_text.trim()) return setError("Для анализа доказательств вставьте текст источника");
    setBusy("Выделяю факты, выводы и гипотезы…");
    setError("");
    try {
      const response = await callApi("generate-linkedin", {
        mode: "analyze_evidence",
        sourceText: selected.source_text,
        sourceUrl: selected.source_url,
      });
      const evidence = (response.claims || []).map((claim) => ({
        ...normalizeEvidenceClaim(claim),
        id: claim.id || crypto.randomUUID(),
      }));
      updateMaterial(selected.id, { evidence, status: "REVIEWED" });
    } catch (err) {
      setError(err.message || "Не удалось разобрать источник");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>Добавить исходный материал</strong></div>
        <div className="linkedin-settings-grid">
          <div className="field">
            <label>Название</label>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div className="field">
            <label>Тип источника</label>
            <select value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value })}>
              {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>URL источника</label>
            <input value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} placeholder="https://…" />
          </div>
          <div className="field">
            <label>Автор или компания</label>
            <input value={form.author_or_company} onChange={(event) => setForm({ ...form, author_or_company: event.target.value })} />
          </div>
          <div className="field">
            <label>Дата публикации</label>
            <input type="date" value={form.published_at} onChange={(event) => setForm({ ...form, published_at: event.target.value })} />
          </div>
          <div className="field">
            <label>Теги через запятую</label>
            <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Текст или собственная заметка по источнику</label>
          <textarea className="linkedin-source" value={form.source_text} onChange={(event) => setForm({ ...form, source_text: event.target.value })} />
          <div className="muted small">На MVP URL сохраняется как источник. Текст статьи вставляется вручную — автоматический массовый сбор не выполняется.</div>
        </div>
        <button onClick={addMaterial}>Сохранить в материалы</button>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="linkedin-workspace-grid">
        <div className="card linkedin-list-card">
          <div className="card-head"><strong>Материалы — {materials.length}</strong></div>
          {!materials.length && <div className="muted">Материалов пока нет.</div>}
          {materials.map((item) => (
            <button key={item.id} className={`linkedin-list-item ${selectedId === item.id ? "active" : ""}`} onClick={() => setSelectedId(item.id)}>
              <strong>{item.title}</strong>
              <span>{SOURCE_TYPE_LABELS[item.source_type]} · {item.status}</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="card">
            <div className="card-head">
              <strong>{selected.title}</strong>
              <select value={selected.status} onChange={(event) => updateMaterial(selected.id, { status: event.target.value })}>
                {MATERIAL_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            {selected.source_url && <div className="field"><a href={selected.source_url} target="_blank" rel="noreferrer">Открыть источник</a></div>}
            <div className="field">
              <label>Текст источника</label>
              <textarea value={selected.source_text} onChange={(event) => updateMaterial(selected.id, { source_text: event.target.value })} />
            </div>
            <div className="row">
              <button onClick={analyzeEvidence} disabled={!!busy}>{busy || "Выделить доказательства"}</button>
              <button className="secondary" onClick={() => onUse(selected)}>Использовать для контента</button>
              <button className="secondary" onClick={() => updateMaterial(selected.id, { status: "ARCHIVED" })}>В архив</button>
            </div>

            {!!selected.evidence.length && (
              <div className="evidence-list">
                <strong>Evidence Layer</strong>
                {selected.evidence.map((claim) => (
                  <div className={`evidence-card evidence-${claim.evidence_type.toLowerCase()}`} key={claim.id}>
                    <div className="card-head">
                      <span className="topic-badge">{claim.evidence_type}</span>
                      <select value={claim.verification_status} onChange={(event) => updateMaterial(selected.id, {
                        evidence: selected.evidence.map((entry) => entry.id === claim.id ? { ...entry, verification_status: event.target.value } : entry),
                      })}>
                        <option>UNVERIFIED</option><option>VERIFIED</option><option>REJECTED</option>
                      </select>
                    </div>
                    <textarea className="linkedin-opening" value={claim.text} onChange={(event) => updateMaterial(selected.id, {
                      evidence: selected.evidence.map((entry) => entry.id === claim.id ? { ...entry, text: event.target.value } : entry),
                    })} />
                    {claim.source_fragment && <div className="muted small">Фрагмент: «{claim.source_fragment}»</div>}
                    <div className="muted small">Уверенность: {claim.confidence}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
