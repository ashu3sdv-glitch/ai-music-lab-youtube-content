import test from "node:test";
import assert from "node:assert/strict";

import { channelFilter, mapWithConcurrency, topicMatchScore } from "../api/_lib/topic-audience-utils.js";

test("channelFilter understands channel IDs and handles", () => {
  assert.deepEqual(
    channelFilter("https://youtube.com/channel/UCj83I0PrbdTDmoUXBosTyXg"),
    { id: "UCj83I0PrbdTDmoUXBosTyXg" }
  );
  assert.deepEqual(channelFilter("https://youtube.com/@example.channel"), {
    forHandle: "example.channel",
  });
  assert.deepEqual(channelFilter("@example-channel"), { forHandle: "example-channel" });
});

test("mapWithConcurrency preserves order and respects its limit", async () => {
  let active = 0;
  let peak = 0;
  const values = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 10;
  });

  assert.deepEqual(values, [10, 20, 30, 40, 50, 60]);
  assert.equal(peak, 2);
});

test("business topic matching prefers relevant video titles", () => {
  const relevant = topicMatchScore({
    title: "AI automation for customer support",
    description: "CRM workflow",
  }, "customer support automation");
  const unrelated = topicMatchScore({
    title: "AI image generation tutorial",
    description: "Create illustrations",
  }, "customer support automation");
  assert.ok(relevant > unrelated);
});
