import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLinkedInSourceFromOpportunity,
  normalizeBusinessOpportunity,
  selectBalancedChannels,
  selectedChannelLanguages,
} from "../shared/business-research.js";

test("business opportunity response is normalized", () => {
  const item = normalizeBusinessOpportunity({
    topic: "  Обработка заявок ",
    pain: "Менеджеры отвечают вручную",
    confidence: "unexpected",
  });
  assert.equal(item.topic, "Обработка заявок");
  assert.equal(item.automationIdea, "");
  assert.equal(item.confidence, "medium");
  assert.deepEqual(item.evidence, []);
});

test("channel selection balances Russian and English sources", () => {
  const candidates = [
    { channelId: "ru1", url: "ru1", language: "ru" },
    { channelId: "ru2", url: "ru2", language: "ru" },
    { channelId: "ru3", url: "ru3", language: "ru" },
    { channelId: "en1", url: "en1", language: "en" },
    { channelId: "en2", url: "en2", language: "en" },
  ];
  const selected = selectBalancedChannels(candidates);
  assert.deepEqual(selected, ["ru1", "ru2", "en1", "en2"]);
  assert.deepEqual(selectedChannelLanguages(candidates, selected), {
    ru1: "ru",
    ru2: "ru",
    en1: "en",
    en2: "en",
  });
});

test("LinkedIn source separates confirmed pain from automation hypothesis", () => {
  const source = buildLinkedInSourceFromOpportunity({
    topic: "Ответы клиентам",
    pain: "Повторяющиеся вопросы обрабатываются вручную",
    automationIdea: "Подготовка черновика ответа с проверкой сотрудником",
    businessValue: "Может сократить время первичной обработки",
    evidence: [{
      text: "We answer the same questions every day",
      translatedText: "Мы каждый день отвечаем на одни и те же вопросы",
      videoId: "abc123",
    }],
  }, "AI automation for business");

  assert.match(source, /Подтверждённая боль/);
  assert.match(source, /автоматизация \(гипотеза\)/i);
  assert.match(source, /не подтверждают эффективность/i);
  assert.match(source, /youtube\.com\/watch\?v=abc123/);
});
