import { useEffect, useMemo, useRef, useState } from "react";
import { sendTelegramPost } from "../lib/telegram.js";
import CopyButton from "./CopyButton.jsx";
import { buildContentWeekItems } from "../../shared/content-week.js";

const OFFSETS = {
  community: [0, 2 * 24, 5 * 24, 7 * 24],
  boosty: [24, 4 * 24],
  telegram: [-24, 2, 3 * 24, 6 * 24],
};
const PLATFORM_LABEL = { community: "YouTube", boosty: "Boosty", telegram: "Telegram" };
const STATUS_LABEL = {
  draft: "Черновик",
  approved: "Утверждено",
  scheduled: "Запланировано",
  published: "Опубликовано",
  skipped: "Пропущено",
  sending: "Отправляется…",
  error: "Ошибка",
};

function hasWeekContent(value) {
  return Boolean(value && (value.items?.length || value.images?.length || value.releaseAt || value.videoUrl || value.preparedAt));
}

function weekTitle(week) {
  if (week.title) return week.title;
  if (week.releaseAt) return `Неделя от ${new Date(week.releaseAt).toLocaleDateString("ru-RU")}`;
  return "Новая неделя";
}

function normalizeWeeks(value) {
  if (Array.isArray(value?.weeks)) return value;
  if (!hasWeekContent(value)) return { weeks: [], activeWeekId: "" };
  const id = value.id || "legacy-week";
  return { weeks: [{ ...value, id, title: value.title || weekTitle(value), archived: false }], activeWeekId: id };
}

function localDateTime(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function addHours(value, hours) {
  const base = value ? new Date(value) : new Date();
  return localDateTime(new Date(base.getTime() + hours * 3600000));
}

function replaceVideoLink(text, videoUrl) {
  if (!text) return "";
  return text.replaceAll("[ссылка на видео]", videoUrl || "[ссылка на видео]");
}

function buildItems(community, telegram, boosty, releaseAt, videoUrl, oldItems = []) {
  const previous = new Map(oldItems.map((item) => [item.id, item]));
  const groups = [
    ["community", community || []],
    ["boosty", boosty || []],
    ["telegram", telegram || []],
  ];
  const items = [];
  for (const [platform, posts] of groups) {
    posts.forEach((post, index) => {
      const id = `${platform}-${index}`;
      const old = previous.get(id);
      const rawText = post.text || "";
      const hasVideoLink = rawText.includes("[ссылка на видео]") || platform === "community";
      items.push({
        id,
        platform,
        index,
        title: post.title || "",
        angle: post.angle || "",
        text: replaceVideoLink(rawText, videoUrl),
        scheduledAt: old?.scheduledAt || addHours(releaseAt, OFFSETS[platform][index] ?? index * 24),
        status: old?.status || "draft",
        error: old?.error || "",
        imageIndex: old?.imageIndex ?? (index % 3),
        hasVideoLink,
      });
    });
  }
  return items;
}

export default function WeekPlanTab({
  state,
  setState,
  longState,
  communityState,
  setCommunityState,
  socialState,
  setSocialState,
  shortsState,
  thumbState,
  onOpenImages,
  settings,
}) {
  const collection = normalizeWeeks(state || {});
  const weeks = collection.weeks || [];
  const activeWeekId = collection.activeWeekId || weeks[0]?.id || "";
  const data = weeks.find((week) => week.id === activeWeekId) || {};
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const sending = useRef(new Set());
  const items = data.items || [];
  const images = [0, 1, 2, 3].map((index) => {
    const card = thumbState?.cards?.[`community${index}`];
    return card?.image ? { label: `Тема ${index + 1}`, square: card.image, prompt: card.prompt, score: card.score } : null;
  });
  const allPlanned = items.length === 10 && items.every((item) => ["scheduled", "published", "skipped"].includes(item.status));

  const counts = useMemo(() => ({
    community: items.filter((x) => x.platform === "community").length,
    boosty: items.filter((x) => x.platform === "boosty").length,
    telegram: items.filter((x) => x.platform === "telegram").length,
  }), [items]);

  function patch(next) {
    setState((current) => {
      const normalized = normalizeWeeks(current || {});
      return {
        ...normalized,
        activeWeekId,
        weeks: normalized.weeks.map((week) => week.id === activeWeekId ? { ...week, ...next } : week),
      };
    });
  }

  function updateItem(id, next) {
    setState((current) => ({
      ...normalizeWeeks(current || {}),
      activeWeekId,
      weeks: normalizeWeeks(current || {}).weeks.map((week) => week.id === activeWeekId ? {
        ...week,
        items: (week.items || []).map((item) => item.id === id ? { ...item, ...next } : item),
      } : week),
    }));
  }

  function createWeek() {
    const id = crypto.randomUUID();
    const now = new Date();
    const releaseDate = new Date(now);
    releaseDate.setHours(18, 0, 0, 0);
    const week = {
      id,
      title: `${now.toLocaleDateString("ru-RU")}${longState?.topic ? ` — ${longState.topic}` : ""}`,
      createdAt: now.toISOString(),
      releaseAt: localDateTime(releaseDate),
      videoUrl: "",
      items: [],
      images: [],
      archived: false,
    };
    setState((current) => {
      const normalized = normalizeWeeks(current || {});
      return { ...normalized, weeks: [week, ...normalized.weeks], activeWeekId: id };
    });
    setError("");
  }

  function selectWeek(id) {
    setState((current) => ({ ...normalizeWeeks(current || {}), activeWeekId: id }));
    setError("");
  }

  function toggleArchive() {
    patch({ archived: !data.archived });
  }

  function changeReleaseAt(releaseAt) {
    patch({
      releaseAt,
      items: items.map((item) => ({
        ...item,
        scheduledAt: addHours(releaseAt, OFFSETS[item.platform]?.[item.index] ?? item.index * 24),
      })),
    });
  }

  function changeVideoUrl(videoUrl) {
    const oldUrl = data.videoUrl || "[ссылка на видео]";
    patch({
      videoUrl,
      items: items.map((item) => ({
        ...item,
        text: item.hasVideoLink ? item.text.replaceAll(oldUrl, videoUrl || "[ссылка на видео]") : item.text,
      })),
    });
  }

  async function prepareTexts() {
    const community = (communityState?.posts || []).slice(0, 4);
    const telegram = (socialState?.telegram || []).slice(0, 4);
    const boosty = (socialState?.boosty || []).slice(0, 2);
    if (community.length !== 4 || telegram.length !== 4 || boosty.length !== 2) {
      return setError("Сначала подготовьте комплект во вкладке «Контент недели»");
    }
    setError("");
    patch({
      items: buildContentWeekItems({ community, telegram, boosty, oldItems: items, startAt: data.releaseAt }),
      preparedAt: new Date().toISOString(),
    });
  }

  function approveAll() {
    patch({
      items: items.map((item) => ({
        ...item,
        status: ["published", "skipped"].includes(item.status) ? item.status : "scheduled",
        error: "",
      })),
      approvedAt: new Date().toISOString(),
    });
    setError("");
  }

  async function sendTelegram(item, automatic = false) {
    if (sending.current.has(item.id)) return;
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      if (!automatic) setError("Укажите токен бота и ID Telegram-канала в Настройках");
      return;
    }
    sending.current.add(item.id);
    updateItem(item.id, { status: "sending", error: "" });
    if (!automatic) setBusy(`Отправляю ${item.id}…`);
    try {
      const image = images[item.imageIndex]?.square || "";
      await sendTelegramPost({
        botToken: settings.telegramBotToken,
        chatId: settings.telegramChatId,
        text: item.text,
        image,
        videoUrl: item.hasVideoLink ? data.videoUrl : "",
      });
      updateItem(item.id, {
        status: "published",
        error: "",
        result: "Сообщение успешно отправлено в Telegram",
        publishedAt: new Date().toISOString(),
      });
    } catch (e) {
      updateItem(item.id, { status: "error", error: e.message, result: "" });
      if (!automatic) setError(e.message);
    } finally {
      sending.current.delete(item.id);
      if (!automatic) setBusy("");
    }
  }

  // Локальный автопланировщик. Работает только пока вкладка приложения открыта.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const item of items) {
        if (item.platform !== "telegram" || item.status !== "scheduled") continue;
        if (new Date(item.scheduledAt).getTime() <= now) sendTelegram(item, true);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [items, images, settings.telegramBotToken, settings.telegramChatId, data.videoUrl]);

  function downloadImage(image, platform, index) {
    const source = image.square;
    const link = document.createElement("a");
    link.href = source;
    link.download = `week-${index + 1}-${platform}.jpg`;
    link.click();
  }

  return (
    <div>
      <div className="card week-switcher">
        <div className="card-head"><strong>Мои недели</strong><span className="muted small">Сохранено: {weeks.length}</span></div>
        {weeks.length > 0 && (
          <div className="week-tabs" aria-label="Переключение между неделями">
            {weeks.map((week, index) => (
              <button
                key={week.id}
                className={`week-tab ${week.id === activeWeekId ? "active" : ""}`}
                onClick={() => selectWeek(week.id)}
                title={weekTitle(week)}
              >
                <span>{week.archived ? "✓ " : ""}{index === 0 ? "Новая: " : "Прошлая: "}{weekTitle(week)}</span>
                <small>{(week.items || []).filter((item) => item.status === "published").length}/{(week.items || []).length || 9} опубликовано</small>
              </button>
            ))}
          </div>
        )}
        <div className="week-switcher-controls">
          <div className="field">
            <label>Открытая неделя — можно выбрать и здесь</label>
            <select value={activeWeekId} onChange={(e) => selectWeek(e.target.value)} disabled={!weeks.length}>
              {!weeks.length && <option value="">Пока нет недель</option>}
              {weeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.archived ? "✓ " : ""}{weekTitle(week)}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <button onClick={createWeek}>+ Создать новую неделю</button>
            {activeWeekId && <button className="secondary" onClick={toggleArchive}>{data.archived ? "Вернуть в работу" : "Завершить неделю"}</button>}
          </div>
        </div>
        <div className="muted small">Чтобы вернуться назад, нажмите кнопку «Прошлая» выше. Новая неделя не удаляет неопубликованные посты из предыдущей.</div>
      </div>

      {!activeWeekId && (
        <div className="card"><strong>Создайте первую неделю, чтобы подготовить публикации.</strong></div>
      )}

      {activeWeekId && <>
      <div className="card">
        <div className="card-head"><strong>План публикаций</strong><span className="muted small">4 Shorts → 10 публикаций → 4 тематические картинки</span></div>
        <div className="week-controls">
          <div className="field">
            <label>Начало публикационной недели</label>
            <input type="datetime-local" value={data.releaseAt || ""} onChange={(e) => changeReleaseAt(e.target.value)} />
          </div>
          <div className="field">
            <label>Ссылка на канал или плейлист — необязательно</label>
            <input type="url" placeholder="https://youtu.be/..." value={data.videoUrl || ""} onChange={(e) => changeVideoUrl(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <button onClick={prepareTexts} disabled={!!busy}>1. Обновить из готовых вкладок</button>
          <button onClick={onOpenImages} disabled={!!busy || !items.length}>2. Открыть картинки</button>
          <button onClick={approveAll} disabled={!!busy || items.length !== 10}>
            {allPlanned ? "✓ 10 публикаций запланированы" : "3. Утвердить и запланировать"}
          </button>
        </div>
        <div className="muted small">YouTube: {counts.community}/4 · Boosty: {counts.boosty}/2 · Telegram: {counts.telegram}/4. Автоотправка Telegram сработает в назначенное время, пока эта страница открыта.</div>
        {allPlanned && <div className="success">Готово: публикации утверждены и получили статус «Запланировано».</div>}
        {busy && <div className="busy">{busy}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      {images.some(Boolean) && (
        <div className="card">
          <div className="card-head"><strong>Четыре квадратные картинки</strong><span className="muted small">по одной на тему; переиспользуются в YouTube, Telegram и Boosty</span></div>
          <div className="week-images">
            {images.map((image, index) => (
              image ? <div key={index}>
                <img src={image.square} alt={image.label} />
                <strong className="small">{index + 1}. {image.label}</strong>
                <div className="row small">
                  <button className="link" onClick={() => downloadImage(image, "community", index)}>Скачать 1080 × 1080</button>
                </div>
              </div> : null
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="week-list">
          {items.map((item) => (
            <div className="card week-item" key={item.id}>
              <div className="card-head">
                <strong>{PLATFORM_LABEL[item.platform]} #{item.index + 1}</strong>
                <span className={`status status-${item.status}`}>{STATUS_LABEL[item.status]}</span>
              </div>
              <div className="muted small">{item.angle}</div>
              {item.title && <input value={item.title} onChange={(e) => updateItem(item.id, { title: e.target.value })} />}
              <textarea value={item.text} onChange={(e) => updateItem(item.id, { text: e.target.value })} />
              <div className="week-item-controls">
                <div className="field">
                  <label>Дата публикации</label>
                  <input type="datetime-local" value={item.scheduledAt || ""} onChange={(e) => updateItem(item.id, { scheduledAt: e.target.value })} />
                </div>
                <div className="field">
                  <label>Картинка</label>
                  <select value={item.imageIndex} onChange={(e) => updateItem(item.id, { imageIndex: Number(e.target.value) })}>
                    {[0, 1, 2, 3].map((index) => <option key={index} value={index}>Картинка {index + 1}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Статус</label>
                  <select value={item.status} onChange={(e) => updateItem(item.id, { status: e.target.value, error: "" })}>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div className="row">
                <CopyButton text={() => `${item.title ? `${item.title}\n\n` : ""}${item.text}`} />
                {images[item.imageIndex] && <button className="secondary" onClick={() => downloadImage(images[item.imageIndex], item.platform, item.imageIndex)}>Скачать картинку</button>}
                {item.platform === "telegram" && (
                  <button onClick={() => sendTelegram(item)} disabled={item.status === "sending" || item.status === "published"}>
                    {item.status === "sending" ? "Отправляю…" : item.status === "published" ? "Уже отправлено" : "Отправить сейчас"}
                  </button>
                )}
              </div>
              {item.result && <div className="success">{item.result}</div>}
              {item.error && <div className="error">{item.error}</div>}
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
