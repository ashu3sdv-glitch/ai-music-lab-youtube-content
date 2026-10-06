import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCuriosityShorts } from "../shared/curiosity-story.js";

test("Curiosity Story keeps exactly four independent Shorts", () => {
  const shorts = normalizeCuriosityShorts({
    shorts: Array.from({ length: 4 }, (_, index) => ({
      topic: ` Тема ${index + 1} `,
      script: ` Сценарий ${index + 1} `,
      titles: ["A", "B", "лишний"],
      coverTexts: ["1", "2", "3", "лишний"],
      screenPlan: ["кадр"],
      angles: [
        { type: "эксперимент", label: "Тест", promise: "Покажу результат" },
        { type: "ошибка", label: "Ошибка" },
        { type: "результат", label: "Сравнение" },
      ],
      hooks: [
        { mechanism: "результат сначала", text: "Вот что получилось" },
        { mechanism: "вопрос", text: "Почему так вышло?" },
        { mechanism: "противоречие", text: "Настройка работает иначе" },
      ],
      audit: {
        strengths: ["Результат показан сразу"],
        risks: ["Мало доказательств"],
        openLoops: [{ loop: "Что изменилось?", payoff: "Сравнение", status: "закрыта" }],
      },
      review: { honesty: "OK" },
    })),
  });
  assert.equal(shorts.length, 4);
  assert.equal(shorts[0].topic, "Тема 1");
  assert.equal(shorts[3].script, "Сценарий 4");
  assert.deepEqual(shorts[0].titles, ["A", "B"]);
  assert.equal(shorts[0].angles.length, 3);
  assert.equal(shorts[0].hooks[0].text, "Вот что получилось");
  assert.equal(shorts[0].audit.openLoops[0].status, "закрыта");
});

test("Curiosity Story rejects a material that did not produce four sections", () => {
  assert.throws(() => normalizeCuriosityShorts({ shorts: [{ topic: "Одна", script: "Текст" }] }), /вместо 4/i);
});
