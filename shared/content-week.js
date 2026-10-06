const HOURS = {
  community: [0, 48, 120, 168],
  telegram: [2, 50, 122, 170],
  boosty: [24, 96],
};

function localDateTime(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function normalizeCollection(value) {
  if (Array.isArray(value?.weeks)) return value;
  if (!value || (!value.items?.length && !value.images?.length)) return { weeks: [], activeWeekId: "" };
  const id = value.id || "legacy-week";
  return { weeks: [{ ...value, id }], activeWeekId: id };
}

export function buildContentWeekItems({ community = [], telegram = [], boosty = [], oldItems = [], startAt } = {}) {
  const previous = new Map(oldItems.map((item) => [item.id, item]));
  const base = startAt ? new Date(startAt) : new Date();
  const groups = { community, telegram, boosty };
  const items = [];
  for (const [platform, posts] of Object.entries(groups)) {
    posts.forEach((post, index) => {
      const id = `${platform}-${index}`;
      const old = previous.get(id) || {};
      const sourceIndex = Number.isInteger(post.sourceIndex)
        ? Math.max(0, Math.min(3, post.sourceIndex))
        : platform === "boosty" ? Math.min(3, index * 2) : Math.min(3, index);
      const postText = post.text || "";
      items.push({
        ...old,
        id,
        platform,
        index,
        sourceIndex,
        imageIndex: sourceIndex,
        title: post.title || "",
        angle: post.angle || "",
        text: postText,
        scheduledAt: old.scheduledAt || localDateTime(new Date(base.getTime() + (HOURS[platform]?.[index] || 0) * 3600000)),
        status: old.status || "draft",
        error: "",
        hasVideoLink: postText.includes("[ссылка на видео]") || old.hasVideoLink || false,
      });
    });
  }
  return items;
}

export function syncContentPackageToWeek(value, content, { id, now = new Date() } = {}) {
  const collection = normalizeCollection(value);
  const activeId = collection.activeWeekId || collection.weeks[0]?.id || id;
  const existing = collection.weeks.find((week) => week.id === activeId);
  const title = content.title?.trim() || `4 Shorts — ${now.toLocaleDateString("ru-RU")}`;
  const items = buildContentWeekItems({
    community: content.community,
    telegram: content.telegram,
    boosty: content.boosty,
    oldItems: existing?.items || [],
    startAt: existing?.releaseAt || localDateTime(now),
  });
  const week = {
    ...(existing || {}),
    id: activeId,
    title,
    createdAt: existing?.createdAt || now.toISOString(),
    releaseAt: existing?.releaseAt || localDateTime(now),
    items,
    images: existing?.images || [],
    preparedAt: now.toISOString(),
    archived: false,
  };
  const weeks = existing
    ? collection.weeks.map((item) => item.id === activeId ? week : item)
    : [week, ...collection.weeks];
  return { ...collection, weeks, activeWeekId: activeId };
}
