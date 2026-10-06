import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCustomGeneratedShort,
  buildCustomScriptState,
  customScriptFingerprint,
  normalizeCustomGenerationProgress,
} from "../shared/custom-script.js";

test("custom script replaces the researched title and clears generated content", () => {
  const state = buildCustomScriptState({ title: " Моё новое название ", script: " Готовый текст " });
  assert.equal(state.topic, "Моё новое название");
  assert.equal(state.script, "Готовый текст");
  assert.equal(state.topicResearch.source, "custom-script");
  assert.deepEqual(state.hooks, []);
  assert.equal(state.description, null);
});

test("custom Shorts script allows an empty series title but requires a body", () => {
  const state = buildCustomScriptState({ title: "", script: "Текст" });
  assert.equal(state.topic, "Серия из четырёх Shorts");
  assert.equal(state.topicResearch.title, "");
  assert.throws(() => buildCustomScriptState({ title: "Название", script: "" }), /сценарий/i);
});

test("custom generation fingerprint changes only when its title or script changes", () => {
  const original = customScriptFingerprint({ title: "Серия", script: "Первый\nВторой" });
  assert.equal(customScriptFingerprint({ title: " Серия ", script: " Первый\nВторой " }), original);
  assert.notEqual(customScriptFingerprint({ title: "Другая серия", script: "Первый\nВторой" }), original);
  assert.notEqual(customScriptFingerprint({ title: "Серия", script: "Первый\nТретий" }), original);
});

test("custom generation resumes only valid sequential Shorts from the same source", () => {
  const input = { title: "Серия", script: "Четыре раздела" };
  const sourceFingerprint = customScriptFingerprint(input);
  const saved = normalizeCustomGenerationProgress({
    version: 1,
    sourceFingerprint,
    shorts: [
      { topic: "Первая", script: "Готовый первый сценарий" },
      { topic: "", script: "Повреждённый второй сценарий" },
      { topic: "Третья", script: "Не должна перескочить повреждённый элемент" },
    ],
  }, input);
  assert.equal(saved.shorts.length, 1);
  assert.equal(saved.shorts[0].topic, "Первая");
  assert.equal(normalizeCustomGenerationProgress(saved, { ...input, script: "Другой материал" }).shorts.length, 0);
});

test("a generated Shorts card is normalized and invalidates dependent publication stages", () => {
  const input = { title: "Серия", script: "Четыре раздела" };
  const progress = normalizeCustomGenerationProgress(null, input);
  const next = appendCustomGeneratedShort({
    ...progress,
    posts: [{ text: "Старый пост" }],
    social: { telegram: [{ text: "Старый пост" }], boosty: [] },
  }, { topic: " Первая ", script: " Текст " });
  assert.equal(next.shorts.length, 1);
  assert.equal(next.shorts[0].topic, "Первая");
  assert.deepEqual(next.posts, []);
  assert.equal(next.social, null);
});
