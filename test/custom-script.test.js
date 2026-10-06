import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomScriptState } from "../shared/custom-script.js";

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
