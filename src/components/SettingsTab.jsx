import { useState } from "react";
import { usePersistentState } from "../lib/storage.js";

// Раздел «Настройки»: библиотека ссылок (гайды, Boosty и т.д.), "о канале",
// OpenAI-ключ и параметры цикла само-оценки обложек. Всё хранится в localStorage.
export default function SettingsTab({ links, setLinks, settings, setSettings }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [channelBio, setChannelBio] = usePersistentState("channelBio", "");

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
        <div className="card-head"><strong>О канале</strong></div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Кратко: чем вы занимаетесь и о чём канал. Это автоматически добавляется в контекст
          каждой генерации (хуки, сценарий, описание, обложки, посты) — писать это в каждом
          модуле отдельно не нужно. Сюда же полезно вписать актуальные детали интерфейса
          Suno (названия кнопок/вкладок прямо сейчас) — знания модели о нём быстро устаревают,
          и без этого поля сценарий может описывать старую версию интерфейса.
        </div>
        <textarea
          style={{ minHeight: 100 }}
          placeholder="Например: веду канал о создании музыки в Suno — учу писать промпты, структурировать треки, разбираю ошибки новичков. Личный, разговорный тон. Сейчас в Suno: режим Custom, поля Lyrics и Style of Music, переключатель Auto/Write own..."
          value={channelBio}
          onChange={(e) => setChannelBio(e.target.value)}
        />
      </div>

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
