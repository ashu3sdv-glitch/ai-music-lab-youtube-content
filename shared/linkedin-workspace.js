export const MATERIAL_STATUSES = ["NEW", "REVIEWED", "SELECTED", "USED", "ARCHIVED"];
export const EVIDENCE_TYPES = ["FACT", "INFERENCE", "HYPOTHESIS"];
export const VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED"];
export const PIPELINE_STATUSES = ["IDEA", "RESEARCH", "DRAFT", "FACT_CHECK", "READY", "PUBLISHED", "MEASURED", "ARCHIVED"];

const MATERIAL_SOURCE_TYPES = [
  "manual_note", "article_url", "company_site", "ai_news", "site_review",
  "own_product", "audience_problem", "youtube_transcript", "build_report",
];

const CONTENT_TYPES = [
  "site_review", "ai_news", "industry_ai", "business_process", "own_product",
  "business_hypothesis", "advertising_loss", "case", "freeform",
  "build_in_public",
];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value, limit = 100) {
  return (Array.isArray(value) ? value : [])
    .map(text)
    .filter(Boolean)
    .slice(0, limit);
}

export function normalizeMaterial(value = {}) {
  return {
    id: text(value.id),
    title: text(value.title),
    source_type: MATERIAL_SOURCE_TYPES.includes(value.source_type) ? value.source_type : "manual_note",
    source_url: text(value.source_url),
    source_text: text(value.source_text),
    author_or_company: text(value.author_or_company),
    published_at: text(value.published_at),
    retrieved_at: text(value.retrieved_at),
    language: text(value.language) || "ru",
    tags: list(value.tags, 20),
    status: MATERIAL_STATUSES.includes(value.status) ? value.status : "NEW",
    evidence: (Array.isArray(value.evidence) ? value.evidence : []).map(normalizeEvidenceClaim).slice(0, 30),
    build_meta: normalizeBuildMeta(value.build_meta),
  };
}

export function createMaterial(value = {}, { id, now = new Date().toISOString() } = {}) {
  return normalizeMaterial({ ...value, id: id || value.id, retrieved_at: value.retrieved_at || now });
}

export function normalizeBuildMeta(value = {}) {
  return {
    episode_number: Math.max(0, Math.trunc(Number(value.episode_number) || 0)),
    report_period: text(value.report_period),
    story: text(value.story),
    source_report: text(value.source_report),
    previous_next_step: text(value.previous_next_step),
    current_result: text(value.current_result),
    next_step: text(value.next_step),
  };
}

export function normalizeBuildReport(value = {}) {
  const facts = (Array.isArray(value.verified_facts) ? value.verified_facts : []).map((item) => ({
    statement: text(item?.statement), source_fragment: text(item?.source_fragment),
  })).filter((item) => item.statement).slice(0, 20);
  return {
    report_id: text(value.report_id),
    report_period: text(value.report_period),
    main_events: list(value.main_events, 15),
    metrics: (Array.isArray(value.metrics) ? value.metrics : []).map((item) => ({
      name: text(item?.name), value: text(item?.value), source_fragment: text(item?.source_fragment),
    })).filter((item) => item.name && item.value).slice(0, 20),
    experiments: list(value.experiments, 15),
    main_learning: text(value.main_learning),
    next_experiment: text(value.next_experiment),
    verified_facts: facts,
    ai_interpretations: list(value.ai_interpretations, 15),
    unknown: list(value.unknown, 15),
    stories: (Array.isArray(value.stories) ? value.stories : []).map((item) => ({
      title: text(item?.title), angle: text(item?.angle), why_interesting: text(item?.why_interesting),
    })).filter((item) => item.title).slice(0, 3),
    headline_options: list(value.headline_options, 8),
  };
}

export function normalizeEvidenceClaim(value = {}) {
  return {
    id: text(value.id),
    text: text(value.text),
    evidence_type: EVIDENCE_TYPES.includes(value.evidence_type) ? value.evidence_type : "HYPOTHESIS",
    source_url: text(value.source_url),
    source_fragment: text(value.source_fragment),
    confidence: ["high", "medium", "low"].includes(value.confidence) ? value.confidence : "low",
    verification_status: VERIFICATION_STATUSES.includes(value.verification_status)
      ? value.verification_status
      : "UNVERIFIED",
  };
}

export function normalizeNewsDigest(value = {}) {
  const items = Array.isArray(value?.items) ? value.items : [];
  return items.map((item) => ({
    title: text(item?.title),
    source_url: /^https?:\/\//i.test(text(item?.source_url)) ? text(item.source_url) : "",
    published_at: text(item?.published_at),
    summary: text(item?.summary),
    business_impact: text(item?.business_impact),
    suggested_angle: text(item?.suggested_angle),
    claims_to_verify: list(item?.claims_to_verify, 10),
  })).filter((item) => item.title && item.summary).slice(0, 8);
}

export function normalizeImageBrief(value = {}) {
  return {
    image_title: text(value.image_title || value.imageTitle),
    image_subtitle: text(value.image_subtitle),
    image_concept: text(value.image_concept || value.imageConcept),
    image_prompt: text(value.image_prompt || value.imagePrompt),
    recommended_format: text(value.recommended_format) || "живое редакционное изображение",
    visual_style: ["auto", "realistic", "editorial", "process"].includes(value.visual_style)
      ? value.visual_style
      : "auto",
    visual_elements: list(value.visual_elements, 10),
    text_limit: text(value.text_limit) || "без текста на изображении",
  };
}

const IMAGE_STYLES = {
  realistic: "Photorealistic documentary business photography, believable people and workplace, natural light, authentic details, premium editorial composition.",
  editorial: "Premium editorial illustration with a strong visual metaphor, tactile materials, restrained business color palette, dimensional lighting, not an infographic.",
  process: "Cinematic real-world scene that visually shows a business process through actions, objects and spatial flow, without diagrams, arrows or interface mockups.",
};

export function buildLinkedInImagePrompt(prompt, { sourceType = "", visualStyle = "auto" } = {}) {
  const automaticStyle = sourceType === "site_review" || sourceType === "company_site"
    ? "realistic"
    : sourceType === "ai_news" || sourceType === "industry_news"
      ? "editorial"
      : "process";
  const style = visualStyle === "auto" ? automaticStyle : visualStyle;
  return [
    IMAGE_STYLES[style] || IMAGE_STYLES.editorial,
    text(prompt),
    "Create one coherent visual scene with one clear focal point. No text, no typography, no letters, no numbers, no captions, no labels, no logos, no watermarks, no UI text. Avoid text cards, presentation slides, infographics, generic robots, glowing AI brains and stock-photo handshakes.",
  ].filter(Boolean).join("\n\n");
}

export function normalizeArticle(value = {}) {
  return {
    title: text(value.title),
    subtitle: text(value.subtitle),
    opening: text(value.opening),
    sections: (Array.isArray(value.sections) ? value.sections : []).map((section) => ({
      title: text(section?.title),
      body: text(section?.body),
    })).filter((section) => section.title || section.body).slice(0, 12),
    conclusion: text(value.conclusion),
    cta: text(value.cta),
    cover_title: text(value.cover_title),
    cover_prompt: text(value.cover_prompt),
    seo_title: text(value.seo_title),
    seo_description: text(value.seo_description),
    keywords: list(value.keywords, 15),
    sources: list(value.sources, 20),
    claims_to_verify: list(value.claims_to_verify, 20),
    image_brief: normalizeImageBrief(value.image_brief),
    publication_status: ["fact", "case", "prototype", "hypothesis"].includes(value.publication_status)
      ? value.publication_status
      : "hypothesis",
  };
}

export function composeLinkedInArticle(value = {}) {
  const article = normalizeArticle(value);
  return [
    article.title,
    article.subtitle,
    article.opening,
    ...article.sections.flatMap((section) => [section.title, section.body]),
    article.conclusion,
    article.cta,
  ].filter(Boolean).join("\n\n");
}

export function normalizePlanItem(value = {}) {
  return {
    id: text(value.id),
    planned_date: text(value.planned_date),
    content_type: value.content_type === "article" ? "article" : "post",
    topic: text(value.topic),
    audience: text(value.audience),
    goal: text(value.goal),
    status: PIPELINE_STATUSES.includes(value.status) ? value.status : "IDEA",
    source_ids: list(value.source_ids, 30),
    draft: value.draft && typeof value.draft === "object" ? value.draft : {},
    image_brief: normalizeImageBrief(value.image_brief),
    image: normalizeGeneratedImage(value.image),
    published_url: text(value.published_url),
    notes: text(value.notes),
    metrics: normalizeMetrics(value.metrics),
    created_at: text(value.created_at),
    build_meta: normalizeBuildMeta(value.build_meta),
  };
}

export function normalizeGeneratedImage(value = {}) {
  return {
    dataUrl: typeof value.dataUrl === "string" && value.dataUrl.startsWith("data:image/") ? value.dataUrl : "",
    prompt: text(value.prompt),
    aspect: value.aspect === "16:9" ? "16:9" : "1:1",
    quality: ["low", "medium", "high"].includes(value.quality) ? value.quality : "medium",
    createdAt: text(value.createdAt),
  };
}

export function normalizeMetrics(value = {}) {
  const fields = [
    "impressions", "reactions", "comments", "reposts", "saves", "profile_views",
    "followers_gained", "link_clicks", "inquiries", "qualified_leads",
  ];
  return Object.fromEntries(fields.map((field) => [field, Math.max(0, Number(value[field]) || 0)]));
}

const STOP_WORDS = new Set(["для", "как", "или", "это", "при", "что", "the", "and", "with", "from"]);

export function topicKeywords(value = "") {
  return [...new Set(text(value).toLocaleLowerCase("ru")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)))];
}

export function findContentDuplicates(candidate = {}, plan = []) {
  const candidateWords = topicKeywords(`${candidate.topic || ""} ${candidate.title || ""}`);
  const candidateSources = new Set(candidate.source_ids || []);
  return plan.map(normalizePlanItem).map((item) => {
    const words = topicKeywords(`${item.topic} ${item.draft?.title || item.draft?.opening || ""}`);
    const intersection = candidateWords.filter((word) => words.includes(word));
    const denominator = Math.max(1, Math.min(candidateWords.length, words.length));
    const similarity = intersection.length / denominator;
    const repeatedSources = item.source_ids.filter((id) => candidateSources.has(id));
    return { item, similarity, repeatedSources };
  }).filter(({ similarity, repeatedSources }) => similarity >= 0.5 || repeatedSources.length > 0)
    .sort((a, b) => b.similarity - a.similarity);
}

export function summarizeResults(plan = []) {
  const measured = plan.map(normalizePlanItem).filter((item) => item.status === "MEASURED");
  if (measured.length < 2) {
    return {
      count: measured.length,
      warning: "Для выводов недостаточно данных: добавьте результаты минимум двух публикаций.",
      bestAttention: null,
      bestBusiness: null,
      bestDiscussion: null,
      weakest: null,
    };
  }
  const byAttention = [...measured].sort((a, b) => b.metrics.impressions - a.metrics.impressions);
  const businessScore = (item) => item.metrics.inquiries + item.metrics.qualified_leads * 3 + item.metrics.profile_views * 0.1;
  const byBusiness = [...measured].sort((a, b) => businessScore(b) - businessScore(a));
  const discussionScore = (item) => item.metrics.comments + item.metrics.reposts + item.metrics.saves;
  const byDiscussion = [...measured].sort((a, b) => discussionScore(b) - discussionScore(a));
  return {
    count: measured.length,
    warning: "",
    bestAttention: byAttention[0],
    bestBusiness: byBusiness[0],
    bestDiscussion: byDiscussion[0],
    weakest: byAttention.at(-1),
  };
}

export function isContentType(value) {
  return CONTENT_TYPES.includes(value);
}

export function hasVerifiedCaseEvidence(evidence = []) {
  return evidence.map(normalizeEvidenceClaim).some((claim) =>
    claim.evidence_type === "FACT" && claim.verification_status === "VERIFIED");
}
