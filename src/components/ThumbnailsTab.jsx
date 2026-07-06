import ThumbCard from "./ThumbCard.jsx";

// Собирает 7 обложек вокруг общего ThumbCard: Long (16:9), 3×Shorts (9:16),
// 3×Community (1:1). Темы подтягиваются из уже заполненных вкладок Long/Shorts/Community.
export default function ThumbnailsTab({ state, setState, settings, longState, shortsState, communityState }) {
  const cards = state?.cards || {};

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

  return (
    <div>
      {!settings.openaiKey && (
        <div className="card">
          <div className="error">Введите OpenAI API-ключ во вкладке «Настройки», чтобы генерировать обложки.</div>
        </div>
      )}

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
