import test from "node:test";
import assert from "node:assert/strict";
import { askClaudeJson } from "../api/_lib/claude.js";

test("truncated Claude JSON is continued once and parsed without repeating the request", async () => {
  const calls = [];
  const requestClaude = async (options) => {
    calls.push(options);
    if (calls.length === 1) {
      options.responseMeta.stopReason = "max_tokens";
      return '{"shots":[{"id":"S1"';
    }
    options.responseMeta.stopReason = "end_turn";
    return '}]}';
  };

  const result = await askClaudeJson({
    requestClaude,
    system: "system",
    user: "original request",
    maxTokens: 8000,
    maxContinuations: 1,
    continuationMaxTokens: 3000,
  });

  assert.equal(result.shots[0].id, "S1");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].maxTokens, 3000);
  assert.deepEqual(calls[1].messages.map((message) => message.role), ["user", "assistant", "user"]);
  assert.equal(calls[1].messages[0].content, "original request");
  assert.match(calls[1].messages[2].content, /следующего символа/);
});

test("a second token-limit stop is not continued indefinitely", async () => {
  let calls = 0;
  const requestClaude = async (options) => {
    calls += 1;
    options.responseMeta.stopReason = "max_tokens";
    return calls === 1 ? '{"shots":[' : '{"id":"unfinished"';
  };

  await assert.rejects(
    askClaudeJson({
      requestClaude,
      system: "system",
      user: "request",
      maxTokens: 8000,
      maxContinuations: 1,
    }),
    (error) => error.code === "MODEL_OUTPUT_TRUNCATED" && /не успела завершить/.test(error.message),
  );
  assert.equal(calls, 2);
});
