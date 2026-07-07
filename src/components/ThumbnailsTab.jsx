import { useState } from "react";
import ThumbCard from "./ThumbCard.jsx";
import { generateThumbnail } from "../lib/thumbgen.js";

// Собирает 7 обложек вокруг общего ThumbCard: Long (16:9), 3×Shorts (9:16),
// 3×Community (1:1). Темы подтягиваются из уже заполненных вкладок Long/Shorts/Community.
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
  const longContext = [longState?.description?.title, synopsis, longState?.script]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  function shortsContext(i) {
    const c = shortsState?.cards?.[i];
    if (!c) return "";
    return [...(c.titles || []), c.description].filter(Boolean).join("\n\n");
  }

  function communityContext(i) {
    return (
      communityState?.posts?.[i]?.text ||
      synopsis ||
      (longState?.script ? longState.script.slice(0, 1500) : "")
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
      { key: "longA", label: "Long A", topic: longState?.topic, context: longContext, aspect: "16:9", variant: "A" },
      { key: "longB", label: "Long Б", topic: longState?.topic, context: longContext, aspect: "16:9", variant: "B" },
      ...[0, 1, 2].map((i) => ({
        key: `shorts${i}`,
        label: `Shorts #${i + 1}`,
        topic: cardTopic(`shorts${i}`, shortsTopics[i]),
        context: shortsContext(i),
        aspect: "9:16",
      })),
      ...[0, 1, 2].map((i) => ({
        key: `community${i}`,
        label: `Пост #${i + 1}`,
        topic: cardTopic(`community${i}`, communityTopics[i] || longState?.topic),
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
          Шаг 2 конвейера: когда тексты во вкладках Long/Shorts/Записи проверены — эта кнопка
          последовательно генерирует весь набор (2 Long + 3 Shorts + 3 поста). Карточки без темы
          пропускаются. Во время работы карточки не трогайте — результат сохраняется после каждой обложки.
        </div>
        <button onClick={generateAll} disabled={!!busy}>Сгенерировать все обложки</button>
        {busy && <div className="busy">{busy}</div>}
        {batchNotes.map((n, i) => (
          <div key={i} className="muted small" style={{ marginTop: 6 }}>{n}</div>
        ))}
      </div>

      <h3>YouTube Long — A/Б тест обложек</h3>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Два содержательно разных варианта — их можно загрузить в «Test and compare» в YouTube Studio.
      </div>
      <div className="grid-3">
        <ThumbCard
          label="Обложка Long — вариант A"
          topic={longState?.topic}
          context={longContext}
          aspect="16:9"
          settings={settings}
          card={cards.longA}
          onChange={(v) => patchCard("longA", v)}
          variant="A"
          topicEditable={false}
        />
        <ThumbCard
          label="Обложка Long — вариант Б"
          topic={longState?.topic}
          context={longContext}
          aspect="16:9"
          settings={settings}
          card={cards.longB}
          onChange={(v) => patchCard("longB", v)}
          variant="B"
          topicEditable={false}
        />
      </div>

      <h3>Shorts</h3>
      <div className="grid-3">
        {[0, 1, 2].map((i) => (
          <ThumbCard
            key={i}
            label={`Обложка Shorts #${i + 1}`}
            topic={shortsTopics[i]}
            context={shortsContext(i)}
            aspect="9:16"
            settings={settings}
            card={cards[`shorts${i}`]}
            onChange={(v) => patchCard(`shorts${i}`, v)}
          />
        ))}
      </div>

      <h3>Записи (Community)</h3>
      <div className="grid-3">
        {[0, 1, 2].map((i) => (
          <ThumbCard
            key={i}
            label={`Картинка для поста #${i + 1}`}
            topic={communityTopics[i] || longState?.topic}
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
