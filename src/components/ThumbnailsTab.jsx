import { useState } from "react";
import ThumbCard from "./ThumbCard.jsx";
import { generateThumbnail } from "../lib/thumbgen.js";

// Четыре квадратные картинки: по одной на каждый Shorts/пост сообщества.
// Те же изображения можно использовать в Telegram и Boosty.
// Обложки Shorts пользователь делает отдельно; приложение их не генерирует.
export default function ThumbnailsTab({ state, setState, settings, longState, shortsState, communityState }) {
  const cards = state?.cards || {};
  const [busy, setBusy] = useState("");
  const [batchNotes, setBatchNotes] = useState([]);

  function patchCard(key, value) {
    setState({ cards: { ...cards, [key]: value } });
  }

  const shortsTopics = (shortsState?.cards || []).map((c) => c.topic).filter(Boolean);
  const communityTopics = (communityState?.posts || []).map((p) => p.angle).filter(Boolean);

  // Контекст для промпта обложки — не только тема, а конкретное содержание.
  // Пересказ (synopsis) задаёт фокус/угол, но сам по себе слишком тонкий
  // материал для конкретной картинки — полный сценарий передаём тоже,
  // чтобы было из чего взять конкретную деталь/сцену/пример.
  const synopsis = longState?.description?.synopsis;

  function shortsContext(i) {
    const c = shortsState?.cards?.[i];
    if (!c) return "";
    return [c.topic, c.script, c.payoff, ...(c.titles || []), c.description].filter(Boolean).join("\n\n");
  }

  function communityContext(i) {
    return (
      communityState?.posts?.[i]?.text ||
      shortsContext(i)
    );
  }

  // Тема карточки с учётом ручного перебива (та же логика, что в ThumbCard).
  function cardTopic(key, fallback) {
    const c = cards[key];
    return c && c.topic !== undefined ? c.topic : fallback;
  }

  // Батч: все обложки одной кнопкой, последовательно, с сохранением после каждой —
  // упавшая карточка не роняет остальные, её можно перегенерировать отдельно.
  async function generateAll() {
    if (!settings.openaiKey) {
      setBatchNotes(["Введите OpenAI API-ключ во вкладке «Настройки»."]);
      return;
    }
    const all = [
      ...[0, 1, 2, 3].map((i) => ({
        key: `community${i}`,
        label: `Универсальная картинка #${i + 1}`,
        topic: cardTopic(`community${i}`, shortsTopics[i] || communityTopics[i]),
        context: communityContext(i),
        aspect: "1:1",
      })),
    ];
    const jobs = all.filter((j) => j.topic && String(j.topic).trim());
    const skipped = all.filter((j) => !jobs.includes(j)).map((j) => j.label);
    if (!jobs.length) {
      setBatchNotes(["Нет ни одной темы — сначала заполните Long/Shorts/Записи (кнопка «Подготовить тексты» на вкладке YouTube Long)."]);
      return;
    }
    setBatchNotes([]);
    const notes = skipped.length ? [`Пропущено (нет темы): ${skipped.join(", ")}`] : [];

    let next = { ...cards };
    for (let n = 0; n < jobs.length; n++) {
      const j = jobs[n];
      try {
        const result = await generateThumbnail({
          settings,
          topic: j.topic,
          context: j.context,
          aspect: j.aspect,
          variant: j.variant,
          onProgress: (msg) => setBusy(`Обложка ${n + 1}/${jobs.length} — ${j.label}: ${msg}`),
        });
        next = { ...next, [j.key]: { ...(next[j.key] || {}), ...result } };
        setState({ cards: next });
      } catch (e) {
        notes.push(`${j.label}: ${e.message}`);
      }
    }
    setBusy("");
    setBatchNotes(notes.length ? notes : ["Все обложки готовы."]);
  }

  return (
    <div>
      {!settings.openaiKey && (
        <div className="card">
          <div className="error">Введите OpenAI API-ключ во вкладке «Настройки», чтобы генерировать обложки.</div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><strong>Все обложки одной кнопкой</strong></div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          После проверки текстов эта кнопка создаёт 4 квадратные картинки — по одной для каждой темы.
          Их можно использовать в записях YouTube, Telegram и Boosty. Обложки Shorts вы готовите отдельно. Карточки без темы
          пропускаются. Во время работы карточки не трогайте — результат сохраняется после каждой обложки.
        </div>
        <button onClick={generateAll} disabled={!!busy}>Сгенерировать 4 картинки</button>
        {busy && <div className="busy">{busy}</div>}
        {batchNotes.map((n, i) => (
          <div key={i} className="muted small" style={{ marginTop: 6 }}>{n}</div>
        ))}
      </div>

      <h3>Четыре картинки для публикаций</h3>
      <div className="grid-3">
        {[0, 1, 2, 3].map((i) => (
          <ThumbCard
            key={i}
            label={`Универсальная картинка #${i + 1}`}
            topic={shortsTopics[i] || communityTopics[i]}
            context={communityContext(i)}
            aspect="1:1"
            settings={settings}
            card={cards[`community${i}`]}
            onChange={(v) => patchCard(`community${i}`, v)}
          />
        ))}
      </div>
    </div>
  );
}
