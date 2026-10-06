import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLinkedInState,
  normalizeSavedTopicsState,
  normalizeTopicsState,
  normalizeWeekPlanState,
} from "../src/lib/persistedState.js";

test("invalid saved topics cannot crash the application", () => {
  assert.deepEqual(normalizeSavedTopicsState({ old: "shape" }), []);
  assert.deepEqual(normalizeSavedTopicsState([null, { query: "AI" }]), [{ query: "AI", evidence: [], topVideos: [] }]);
});

test("old topic research keeps valid fields and repairs collections", () => {
  assert.deepEqual(normalizeTopicsState({ base: "suno", results: {}, audienceTopics: "bad" }), {
    base: "suno",
    results: [],
    audienceTopics: [],
    audienceMeta: null,
  });
});

test("old LinkedIn state repairs nested collections without discarding text", () => {
  const state = normalizeLinkedInState({ sourceText: "Черновик", materials: {}, research: { topics: "bad" } });
  assert.equal(state.sourceText, "Черновик");
  assert.deepEqual(state.materials, []);
  assert.deepEqual(state.plan, []);
  assert.deepEqual(state.research.topics, []);
  assert.deepEqual(state.research.candidates, []);
});

test("nested legacy collections are repaired before hidden tabs render", () => {
  const topics = normalizeTopicsState({ audienceMeta: { channels: "bad" } });
  assert.deepEqual(topics.audienceMeta.channels, []);

  const weeks = normalizeWeekPlanState({ weeks: [{ id: "one", items: "bad", images: {} }] });
  assert.deepEqual(weeks.weeks[0].items, []);
  assert.deepEqual(weeks.weeks[0].images, []);
});
