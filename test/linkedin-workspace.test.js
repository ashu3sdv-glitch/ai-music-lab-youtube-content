import test from "node:test";
import assert from "node:assert/strict";
import {
  composeLinkedInArticle,
  createMaterial,
  findContentDuplicates,
  hasVerifiedCaseEvidence,
  normalizeArticle,
  normalizeBuildReport,
  normalizeEvidenceClaim,
  normalizeGeneratedImage,
  normalizeNewsDigest,
  normalizePlanItem,
  summarizeResults,
} from "../shared/linkedin-workspace.js";

test("Research Inbox material keeps source metadata and safe defaults", () => {
  const material = createMaterial({ title: " Анализ клиники ", source_type: "company_site", source_url: "https://example.com" }, { id: "m1", now: "2026-09-07T10:00:00.000Z" });
  assert.equal(material.id, "m1");
  assert.equal(material.title, "Анализ клиники");
  assert.equal(material.status, "NEW");
  assert.equal(material.retrieved_at, "2026-09-07T10:00:00.000Z");
});

test("Evidence Layer defaults uncertain claims to hypothesis", () => {
  const claim = normalizeEvidenceClaim({ text: "Автоматизация удвоит продажи", evidence_type: "UNKNOWN" });
  assert.equal(claim.evidence_type, "HYPOTHESIS");
  assert.equal(claim.verification_status, "UNVERIFIED");
  assert.equal(claim.confidence, "low");
});

test("case mode requires a verified fact", () => {
  assert.equal(hasVerifiedCaseEvidence([{ text: "Результат", evidence_type: "FACT", verification_status: "UNVERIFIED" }]), false);
  assert.equal(hasVerifiedCaseEvidence([{ text: "Результат", evidence_type: "FACT", verification_status: "VERIFIED" }]), true);
});

test("article fields are normalized and compose into readable text", () => {
  const article = normalizeArticle({ title: "Статья", sections: [{ title: "Раздел", body: "Текст" }], keywords: ["AI"] });
  assert.equal(article.publication_status, "hypothesis");
  assert.match(composeLinkedInArticle(article), /Статья[\s\S]*Раздел[\s\S]*Текст/);
});

test("generated LinkedIn image keeps only a valid image data URL", () => {
  assert.equal(normalizeGeneratedImage({ dataUrl: "https://example.com/image.png" }).dataUrl, "");
  const image = normalizeGeneratedImage({ dataUrl: "data:image/png;base64,AAAA", aspect: "16:9", quality: "high" });
  assert.equal(image.dataUrl, "data:image/png;base64,AAAA");
  assert.equal(image.aspect, "16:9");
  assert.equal(image.quality, "high");
});

test("duplicate check finds repeated topic and source", () => {
  const plan = [normalizePlanItem({ id: "p1", topic: "Автоматизация ответов клиентам", source_ids: ["m1"] })];
  const duplicates = findContentDuplicates({ topic: "AI автоматизация ответов клиентам", source_ids: ["m1"] }, plan);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].repeatedSources, ["m1"]);
});

test("results avoid conclusions from one publication", () => {
  const one = [normalizePlanItem({ id: "p1", status: "MEASURED", topic: "Тема", metrics: { impressions: 100 } })];
  assert.match(summarizeResults(one).warning, /недостаточно данных/i);
});

test("results compare attention and business signals after two publications", () => {
  const plan = [
    normalizePlanItem({ id: "p1", status: "MEASURED", topic: "Охват", metrics: { impressions: 1000 } }),
    normalizePlanItem({ id: "p2", status: "MEASURED", topic: "Заявки", metrics: { impressions: 500, inquiries: 3, qualified_leads: 1 } }),
  ];
  const summary = summarizeResults(plan);
  assert.equal(summary.bestAttention.id, "p1");
  assert.equal(summary.bestBusiness.id, "p2");
});

test("MVP flow moves sourced content into the measured pipeline", () => {
  const material = createMaterial({ title: "Проблема обработки заявок", source_text: "Заявки теряются", evidence: [{ text: "Заявки теряются", evidence_type: "FACT" }] }, { id: "source-1" });
  const article = normalizeArticle({ title: "Как проверить обработку заявок", sections: [{ title: "Проблема", body: material.source_text }], sources: ["https://example.com"] });
  const planItem = normalizePlanItem({ id: "plan-1", content_type: "article", topic: article.title, source_ids: [material.id], draft: article, image: { dataUrl: "data:image/png;base64,AAAA" }, status: "MEASURED", metrics: { impressions: 100, comments: 2 } });
  assert.equal(planItem.source_ids[0], material.id);
  assert.equal(planItem.draft.title, article.title);
  assert.equal(planItem.metrics.comments, 2);
  assert.match(planItem.image.dataUrl, /^data:image/);
});

test("weekly ChatGPT digest is normalized into safe selectable news", () => {
  const digest = normalizeNewsDigest({ items: [
    { title: " Новая функция ", source_url: "https://example.com/news", summary: " Описание ", claims_to_verify: [" Дата "] },
    { title: "Без содержания", source_url: "javascript:alert(1)", summary: "" },
  ] });
  assert.equal(digest.length, 1);
  assert.equal(digest[0].title, "Новая функция");
  assert.equal(digest[0].source_url, "https://example.com/news");
  assert.deepEqual(digest[0].claims_to_verify, ["Дата"]);
});

test("Build Report keeps facts separate from interpretations and unknowns", () => {
  const report = normalizeBuildReport({
    report_period: "2026-09-08 — 2026-09-14",
    verified_facts: [{ statement: "Получено 0 заявок", source_fragment: "Заявки | 0" }],
    ai_interpretations: ["Возможно, оффер непонятен"], unknown: ["Причина отказов"],
    stories: [{ title: "Запустили рекламу, но заявок нет", angle: "Честный эксперимент" }],
  });
  assert.equal(report.verified_facts[0].statement, "Получено 0 заявок");
  assert.equal(report.ai_interpretations[0], "Возможно, оффер непонятен");
  assert.equal(report.unknown[0], "Причина отказов");
  assert.equal(report.stories.length, 1);
});

test("Build in Public plan item preserves source and series continuity", () => {
  const item = normalizePlanItem({ build_meta: { episode_number: 4, report_period: "Неделя 4", story: "Эксперимент", source_report: "week-4.md", next_step: "Изменить первый экран" } });
  assert.equal(item.build_meta.episode_number, 4);
  assert.equal(item.build_meta.source_report, "week-4.md");
  assert.equal(item.build_meta.next_step, "Изменить первый экран");
});
