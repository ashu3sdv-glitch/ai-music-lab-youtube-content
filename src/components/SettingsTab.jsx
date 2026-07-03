import { useState } from "react";

// Раздел «Настройки»: библиотека ссылок (гайды, Boosty и т.д.), OpenAI-ключ
// и параметры цикла само-оценки обложек. Всё хранится в localStorage (App.jsx).
export default function SettingsTab({ links, setLinks, settings, setSettings }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  function addLink() {
    if (!name.trim() || !url.trim()) return;
    setLinks([...links, { id: crypto.randomUUID(), name: name.trim(), url: url.trim() }]);
    setName("");
    setUrl("");
  }

  function removeLink(id) {
    setLinks(links.filter((l) => l.id !== id));
  }

  return (
    <div>
      <div className="card">
        <div className="card-head"><strong>Библиотека ссылок</strong></div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Ссылки, которые можно точечно подставлять в описания (Long, Shorts) чекбоксами.
        </div>
        {links.map((l) => (
          <div className="link-item" key={l.id}>
            <input value={l.name} readOnly />
            <input value={l.url} readOnly />
            <button className="secondary" onClick={() => removeLink(l.id)}>Удалить</button>
          </div>
        ))}
        <div className="link-item">
          <input placeholder="Название (например, Boosty)" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <button onClick={addLink}>Добавить</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><strong>OpenAI API-ключ</strong></div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Используется только в браузере для генерации обложек, их само-оценки и (опционально)
          транскрипции. На наш сервер не отправляется.
        </div>
        <div className="field">
          <input
            type="password"
            placeholder="sk-..."
            value={settings.openaiKey}
            onChange={(e) => setSettings({ ...settings, openaiKey: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><strong>Само-оценка обложек</strong></div>
        <div className="field">
          <label>Vision-модель</label>
          <input
            value={settings.visionModel}
            onChange={(e) => setSettings({ ...settings, visionModel: e.target.value })}
          />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Порог оценки (из 10)</label>
            <input
              type="text"
              inputMode="numeric"
              value={settings.scoreThreshold}
              onChange={(e) => setSettings({ ...settings, scoreThreshold: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Лимит попыток</label>
            <input
              type="text"
              inputMode="numeric"
              value={settings.maxAttempts}
              onChange={(e) => setSettings({ ...settings, maxAttempts: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
