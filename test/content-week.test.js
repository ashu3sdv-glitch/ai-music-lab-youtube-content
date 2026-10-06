import test from "node:test";
import assert from "node:assert/strict";
import { buildContentWeekItems, syncContentPackageToWeek } from "../shared/content-week.js";

test("content week maps four topics onto four reusable image slots", () => {
  const items = buildContentWeekItems({
    community: Array.from({ length: 4 }, (_, i) => ({ angle: `C${i}`, text: `c${i}`, sourceIndex: i })),
    telegram: Array.from({ length: 4 }, (_, i) => ({ angle: `T${i}`, text: `t${i}`, sourceIndex: i })),
    boosty: [{ title: "B1", text: "b1", sourceIndex: 1 }, { title: "B2", text: "b2", sourceIndex: 3 }],
    startAt: "2026-09-17T10:00",
  });
  assert.equal(items.length, 10);
  assert.deepEqual(items.filter((item) => item.platform === "community").map((item) => item.imageIndex), [0, 1, 2, 3]);
  assert.deepEqual(items.filter((item) => item.platform === "boosty").map((item) => item.imageIndex), [1, 3]);
});

test("publication plan remembers which post needs a video link", () => {
  const [item] = buildContentWeekItems({ community: [{ text: "Подробнее: [ссылка на видео]" }] });
  assert.equal(item.hasVideoLink, true);
});

test("generated package appears in the active publication week", () => {
  const next = syncContentPackageToWeek({}, {
    title: "Моя серия",
    community: Array.from({ length: 4 }, (_, i) => ({ text: `c${i}` })),
    telegram: Array.from({ length: 4 }, (_, i) => ({ text: `t${i}` })),
    boosty: Array.from({ length: 2 }, (_, i) => ({ text: `b${i}` })),
  }, { id: "week-1", now: new Date("2026-09-17T10:00:00Z") });
  assert.equal(next.activeWeekId, "week-1");
  assert.equal(next.weeks[0].title, "Моя серия");
  assert.equal(next.weeks[0].items.length, 10);
});
