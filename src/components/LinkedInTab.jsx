import { useState } from "react";
import { callApi } from "../lib/api.js";
import { composeLinkedInPost, normalizeHashtags, normalizeLinkedInPost } from "../../shared/linkedin.js";
import { buildLinkedInSourceFromOpportunity } from "../../shared/business-research.js";
import { buildLinkedInImagePrompt, composeLinkedInArticle, createMaterial, findContentDuplicates, normalizeArticle, normalizeImageBrief, normalizeMaterial, normalizePlanItem } from "../../shared/linkedin-workspace.js";
import { generateImage } from "../lib/openai.js";
import { cropToAspect } from "../lib/crop.js";
import CopyButton from "./CopyButton.jsx";
import LinkedInResearchHub from "./LinkedInResearchHub.jsx";
import LinkedInInbox from "./LinkedInInbox.jsx";
import LinkedInPlan from "./LinkedInPlan.jsx";
import LinkedInResults from "./LinkedInResults.jsx";
import LinkedInImages from "./LinkedInImages.jsx";

const DEFAULT_STATE = {
  sourceType: "site_review", sourceText: "", audience: "small_business", goal: "free_audit", language: "ru",
  contentFormat: "post", contentMode: "site_review", result: null, article: null, imageBrief: null, generatedImage: null,
  research: {}, materials: [], selectedMaterialId: "", plan: [],
};

const STATUS_LABELS = { fact: "Факт", case: "Кейс", prototype: "Прототип", hypothesis: "Гипотеза" };
const VIEWS = [["research", "Исследование"], ["materials", "Материалы"], ["create", "Создание контента"], ["images", "Изображения"], ["plan", "Контент-план"], ["results", "Результаты"]];
const CONTENT_MODES = {
  site_review: "Разбор сайта или бизнеса", ai_news: "Объяснение новости об AI", industry_ai: "AI в конкретной отрасли",
  business_process: "Разбор бизнес-процесса", own_product: "Собственная разработка",
  business_hypothesis: "Практическая бизнес-гипотеза", advertising_loss: "Ошибка или потеря в рекламе",
  case: "Кейс с подтверждёнными результатами", build_in_public: "Build in Public — строю AI-бизнес", freeform: "Свободный авторский материал",
};

export default function LinkedInTab({ state, setState, settings = {} }) {
  const data = { ...DEFAULT_STATE, ...(state || {}) };
  const materials = (data.materials || []).map(normalizeMaterial);
  const plan = (data.plan || []).map(normalizePlanItem);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [view, setView] = useState("research");
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);

  function patch(next) { setState((current) => ({ ...DEFAULT_STATE, ...(current || {}), ...next })); }
  function setMaterials(next) { patch({ materials: next }); }
  function setPlan(next) { patch({ plan: next }); }
  function updateResult(next) { patch({ result: { ...normalizeLinkedInPost(data.result), ...next } }); }
  function updateArticle(next) { patch({ article: { ...normalizeArticle(data.article), ...next } }); }

  async function run(label, task) {
    setBusy(label); setError("");
    try { await task(); } catch (err) { setError(err.message || "Не удалось подготовить материал"); }
    finally { setBusy(""); }
  }

  function useMaterial(material) {
    patch({ selectedMaterialId: material.id, sourceType: material.source_type, sourceText: material.source_text,
      contentMode: material.source_type === "ai_news" ? "ai_news" : material.source_type === "own_product" ? "own_product" : material.source_type === "build_report" ? "build_in_public" : "freeform" });
    setView("create");
  }

  async function generate(overrides = {}) {
    const sourceText = overrides.sourceText ?? data.sourceText;
    const contentFormat = overrides.contentFormat ?? data.contentFormat;
    const sourceType = overrides.sourceType ?? data.sourceType;
    return run(contentFormat === "article" ? "Готовлю статью и обложку…" : "Готовлю публикацию и картинку…", async () => {
      if (!sourceText.trim()) throw new Error("Выберите материал или вставьте исходный текст");
      const selected = materials.find((item) => item.id === data.selectedMaterialId);
      const sourceUrls = overrides.sourceUrls ?? (selected?.source_url ? [selected.source_url] : []);
      const evidence = overrides.evidence ?? selected?.evidence ?? [];
      const response = await callApi("generate-linkedin", {
        mode: "generate", contentFormat, contentMode: overrides.contentMode ?? data.contentMode,
        sourceType, sourceText, audience: data.audience, goal: data.goal, language: data.language,
        sourceUrls,
        evidence,
      });
      if (contentFormat === "article") {
        const article = normalizeArticle(response.article);
        const imageBrief = normalizeImageBrief(article.image_brief);
        patch({ article, imageBrief, generatedImage: null, contentFormat, sourceText, sourceType });
        if (settings.openaiKey && imageBrief.image_prompt) {
          try {
            const finalPrompt = buildLinkedInImagePrompt(imageBrief.image_prompt, { sourceType, visualStyle: imageBrief.visual_style });
            const raw = await generateImage(settings.openaiKey, finalPrompt, "16:9", settings.imageQuality || "medium");
            const dataUrl = await cropToAspect(raw, "16:9");
            patch({ generatedImage: { dataUrl, prompt: finalPrompt, aspect: "16:9",
              quality: settings.imageQuality || "medium", createdAt: new Date().toISOString() } });
          } catch (imageError) {
            setError(`Статья готова, но изображение не создалось: ${imageError.message || "повторите генерацию"}`);
          }
        }
      } else {
        const result = normalizeLinkedInPost(response);
        const imageBrief = normalizeImageBrief(response.imageBrief || result);
        patch({ result, imageBrief, generatedImage: null, contentFormat, sourceText, sourceType });
        if (settings.openaiKey && imageBrief.image_prompt) {
          try {
            const finalPrompt = buildLinkedInImagePrompt(imageBrief.image_prompt, { sourceType, visualStyle: imageBrief.visual_style });
            const raw = await generateImage(settings.openaiKey, finalPrompt, "1:1", settings.imageQuality || "medium");
            const dataUrl = await cropToAspect(raw, "1:1");
            patch({ generatedImage: { dataUrl, prompt: finalPrompt, aspect: "1:1",
              quality: settings.imageQuality || "medium", createdAt: new Date().toISOString() } });
          } catch (imageError) {
            setError(`Публикация готова, но изображение не создалось: ${imageError.message || "повторите генерацию"}`);
          }
        }
      }
    });
  }

  function rework() {
    return run("Переделываю публикацию…", async () => {
      if (!data.result) throw new Error("Сначала подготовьте публикацию");
      if (!instruction.trim()) throw new Error("Напишите, что изменить");
      const response = await callApi("generate-linkedin", { mode: "rework", sourceType: data.sourceType, audience: data.audience,
        goal: data.goal, language: data.language, currentPost: data.result, instruction: instruction.trim() });
      patch({ result: normalizeLinkedInPost(response) });
      setInstruction("");
    });
  }

  function createFromOpportunity(item, researchQuery) {
    const sourceText = buildLinkedInSourceFromOpportunity(item, researchQuery);
    const evidence = [
      ...(item.evidence || []).map((entry) => ({ id: crypto.randomUUID(), text: entry.translatedText || entry.text || item.pain,
        evidence_type: "FACT", source_url: entry.videoId ? `https://youtube.com/watch?v=${entry.videoId}` : "",
        source_fragment: entry.translatedText || entry.text || "", confidence: item.confidence || "medium", verification_status: "UNVERIFIED" })),
      { id: crypto.randomUUID(), text: item.automationIdea, evidence_type: "HYPOTHESIS", source_url: "", source_fragment: "", confidence: "low", verification_status: "UNVERIFIED" },
    ].filter((claim) => claim.text);
    const material = createMaterial({ title: item.suggestedTitle || item.topic, source_type: "audience_problem", source_text: sourceText,
      language: "ru", tags: ["AI", "автоматизация", "бизнес"], status: "SELECTED", evidence }, { id: crypto.randomUUID() });
    patch({ materials: [material, ...materials], selectedMaterialId: material.id, sourceType: material.source_type, sourceText,
      contentFormat: "article", contentMode: "business_hypothesis" });
    setView("create");
    return generate({ sourceText, sourceType: material.source_type, contentFormat: "article", contentMode: "business_hypothesis", evidence });
  }

  function createFromSource({ title, sourceType, sourceUrl = "", sourceText, publishedAt = "", contentMode, contentFormat = "article", tags = [], evidence = [], buildMeta = {} }) {
    const material = createMaterial({ title, source_type: sourceType, source_url: sourceUrl, source_text: sourceText,
      published_at: publishedAt, language: "ru", tags, status: "SELECTED", evidence, build_meta: buildMeta }, { id: crypto.randomUUID() });
    patch({ materials: [material, ...materials], selectedMaterialId: material.id, sourceType: material.source_type,
      sourceText: material.source_text, contentFormat, contentMode });
    setView("create");
    return generate({ sourceText: material.source_text, sourceType: material.source_type, contentFormat,
      contentMode, sourceUrls: material.source_url ? [material.source_url] : [], evidence: material.evidence });
  }

  function saveToPlan() {
    const isArticle = data.contentFormat === "article";
    const draft = isArticle ? normalizeArticle(data.article) : normalizeLinkedInPost(data.result);
    if (isArticle ? !draft.title : !draft.opening) return setError("Сначала создайте материал");
    const sourceIds = data.selectedMaterialId ? [data.selectedMaterialId] : [];
    const topic = isArticle ? draft.title : draft.opening;
    setDuplicateWarnings(findContentDuplicates({ topic, title: topic, source_ids: sourceIds }, plan));
    const item = normalizePlanItem({ id: crypto.randomUUID(), planned_date: "", content_type: data.contentFormat, topic,
      audience: data.audience, goal: data.goal, status: "DRAFT", source_ids: sourceIds, draft,
      image_brief: data.imageBrief, image: data.generatedImage, created_at: new Date().toISOString(),
      build_meta: materials.find((material) => material.id === data.selectedMaterialId)?.build_meta });
    setPlan([item, ...plan]);
    if (data.selectedMaterialId) setMaterials(materials.map((material) => material.id === data.selectedMaterialId ? { ...material, status: "USED" } : material));
    setView("plan");
  }

  const result = data.result ? normalizeLinkedInPost(data.result) : null;
  const article = data.article ? normalizeArticle(data.article) : null;
  const imageBrief = normalizeImageBrief(data.imageBrief || article?.image_brief || result || {});

  return (
    <div className="linkedin-tab">
      <div className="linkedin-positioning">Я изучаю реальные проблемы бизнеса, нахожу точки роста и показываю, как реклама, AI и автоматизация могут помочь их проверить и решить.</div>
      <div className="topic-mode-tabs linkedin-nav">{VIEWS.map(([id, label]) => <button key={id} className={view === id ? "" : "secondary"} onClick={() => setView(id)}>{label}</button>)}</div>

      {view === "research" && <LinkedInResearchHub
        research={data.research}
        setResearch={(updater) => patch({ research: typeof updater === "function" ? updater(data.research || {}) : updater })}
        onCreateFromOpportunity={createFromOpportunity}
        onCreateFromSource={createFromSource}
        busy={busy}
        history={plan}
      />}
      {view === "materials" && <LinkedInInbox materials={materials} setMaterials={setMaterials} selectedId={data.selectedMaterialId} setSelectedId={(selectedMaterialId) => patch({ selectedMaterialId })} onUse={useMaterial} />}

      {view === "create" && <div>
        <div className="card">
          <div className="card-head"><strong>Готовый комплект для LinkedIn</strong><span className="muted small">Текст + одна картинка; публикация выполняется вручную</span></div>
          <div className="linkedin-settings-grid">
            <div className="field"><label>Формат</label><select value={data.contentFormat} onChange={(event) => patch({ contentFormat: event.target.value })}><option value="post">Короткая публикация</option><option value="article">Полноценная статья</option></select></div>
            <div className="field"><label>Режим</label><select value={data.contentMode} onChange={(event) => patch({ contentMode: event.target.value })}>{Object.entries(CONTENT_MODES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="field"><label>Аудитория</label><select value={data.audience} onChange={(event) => patch({ audience: event.target.value })}><option value="small_business">Владельцы малого бизнеса</option><option value="marketers">Маркетологи</option><option value="construction">Строительные компании</option><option value="clinics_services">Клиники и сервисные компании</option><option value="developers_ai">Разработчики и AI-специалисты</option><option value="general_business">Общая деловая аудитория</option></select></div>
            <div className="field"><label>Цель</label><select value={data.goal} onChange={(event) => patch({ goal: event.target.value })}><option value="expertise">Показать компетентность</option><option value="free_audit">Получить заявки на разбор</option><option value="explain_news">Объяснить новость</option><option value="show_product">Показать разработку</option><option value="discussion">Вызвать обсуждение</option></select></div>
          </div>
          <div className="field"><label>Исходный материал</label><textarea className="linkedin-source" value={data.sourceText} onChange={(event) => patch({ sourceText: event.target.value })} /></div>
          {data.selectedMaterialId && <div className="research-context">Источник сохранён в Research Inbox. Перед публикацией проверьте его Evidence Layer во вкладке «Материалы».</div>}
          {materials.find((item) => item.id === data.selectedMaterialId)?.source_url && <div className="field"><a href={materials.find((item) => item.id === data.selectedMaterialId).source_url} target="_blank" rel="noreferrer">Открыть исходный источник</a></div>}
          {!!findContentDuplicates({ topic: materials.find((item) => item.id === data.selectedMaterialId)?.title || data.sourceText.slice(0, 120), source_ids: data.selectedMaterialId ? [data.selectedMaterialId] : [] }, plan).length && <div className="warning-box">Похожая тема или этот источник уже встречались в контент-плане. Проверьте повторы перед генерацией.</div>}
          <button onClick={() => generate()} disabled={!!busy}>{busy || (data.contentFormat === "article" ? "Создать заново статью и обложку" : "Создать заново пост и картинку")}</button>
          {error && <div className="error">{error}</div>}
        </div>

        {data.contentFormat === "post" && result && <div className="card">
          <div className="card-head"><strong>Готовая публикация</strong><span className="topic-badge">{STATUS_LABELS[result.publicationStatus]}</span></div>
          <div className="linkedin-copy-actions"><CopyButton label="Скопировать весь пост" text={() => composeLinkedInPost(result)} /><CopyButton label="Короткая версия" text={() => result.shortVersion} /></div>
          <div className="field"><label>Первая фраза</label><textarea className="linkedin-opening" value={result.opening} onChange={(event) => updateResult({ opening: event.target.value })} /></div>
          <div className="field"><label>Основной текст</label><textarea value={result.body} onChange={(event) => updateResult({ body: event.target.value })} /></div>
          <div className="field"><label>CTA</label><textarea className="linkedin-opening" value={result.cta} onChange={(event) => updateResult({ cta: event.target.value })} /></div>
          <div className="field"><label>Хештеги — максимум 5</label><input value={result.hashtags.join(" ")} onChange={(event) => updateResult({ hashtags: normalizeHashtags(event.target.value) })} /></div>
          <div className="field"><label>Короткая версия</label><textarea value={result.shortVersion} onChange={(event) => updateResult({ shortVersion: event.target.value })} /></div>
          <div className="fix-row"><input placeholder="Что изменить?" value={instruction} onChange={(event) => setInstruction(event.target.value)} /><button onClick={rework} disabled={!!busy || !instruction.trim()}>Переделать</button></div>
          {!!result.claimsToVerify.length && <div className="linkedin-claims"><strong>Проверить перед публикацией</strong><ul>{result.claimsToVerify.map((claim, i) => <li key={i}>{claim}</li>)}</ul></div>}
          <button style={{ marginTop: 14 }} onClick={saveToPlan}>Сохранить в контент-план</button>
        </div>}

        {data.contentFormat === "article" && article && <div className="card">
          <div className="card-head"><strong>Полноценная статья</strong><CopyButton label="Скопировать статью" text={() => composeLinkedInArticle(article)} /></div>
          {["title", "subtitle", "opening"].map((field) => <div className="field" key={field}><label>{field === "title" ? "Заголовок" : field === "subtitle" ? "Подзаголовок" : "Вступление"}</label><textarea className="linkedin-opening" value={article[field]} onChange={(event) => updateArticle({ [field]: event.target.value })} /></div>)}
          {article.sections.map((section, index) => <div className="article-section" key={index}><input value={section.title} onChange={(event) => updateArticle({ sections: article.sections.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /><textarea value={section.body} onChange={(event) => updateArticle({ sections: article.sections.map((item, i) => i === index ? { ...item, body: event.target.value } : item) })} /></div>)}
          <button className="secondary" onClick={() => updateArticle({ sections: [...article.sections, { title: "Новый раздел", body: "" }] })}>Добавить раздел</button>
          <div className="field"><label>Заключение</label><textarea value={article.conclusion} onChange={(event) => updateArticle({ conclusion: event.target.value })} /></div>
          <div className="field"><label>CTA</label><textarea className="linkedin-opening" value={article.cta} onChange={(event) => updateArticle({ cta: event.target.value })} /></div>
          <div className="linkedin-settings-grid"><div className="field"><label>SEO-заголовок</label><input value={article.seo_title} onChange={(event) => updateArticle({ seo_title: event.target.value })} /></div><div className="field"><label>Ключевые слова</label><input value={article.keywords.join(", ")} onChange={(event) => updateArticle({ keywords: event.target.value.split(",") })} /></div></div>
          <div className="field"><label>SEO-описание</label><textarea className="linkedin-opening" value={article.seo_description} onChange={(event) => updateArticle({ seo_description: event.target.value })} /></div>
          <div className="linkedin-settings-grid"><div className="field"><label>Заголовок обложки</label><input value={article.cover_title} onChange={(event) => updateArticle({ cover_title: event.target.value })} /></div><div className="field"><label>Источники — по одному URL в строке</label><textarea className="linkedin-opening" value={article.sources.join("\n")} onChange={(event) => updateArticle({ sources: event.target.value.split("\n") })} /></div></div>
          <div className="field"><label>Промпт обложки</label><textarea value={article.cover_prompt} onChange={(event) => updateArticle({ cover_prompt: event.target.value })} /></div>
          <div className="field"><label>Утверждения для проверки — по одному в строке</label><textarea value={article.claims_to_verify.join("\n")} onChange={(event) => updateArticle({ claims_to_verify: event.target.value.split("\n") })} /></div>
          <button style={{ marginTop: 14 }} onClick={saveToPlan}>Сохранить в контент-план</button>
        </div>}

        {(article || result) && <LinkedInImages brief={imageBrief} onBriefChange={(imageBrief) => patch({ imageBrief })}
          generatedImage={data.generatedImage} onImageChange={(generatedImage) => patch({ generatedImage })} settings={settings} sourceType={data.sourceType} />}
      </div>}

      {view === "images" && <LinkedInImages brief={imageBrief} onBriefChange={(imageBrief) => patch({ imageBrief })} generatedImage={data.generatedImage} onImageChange={(generatedImage) => patch({ generatedImage })} settings={settings} sourceType={data.sourceType} />}
      {view === "plan" && <><LinkedInPlan plan={plan} setPlan={setPlan} />{!!duplicateWarnings.length && <div className="card warning-box"><strong>Возможные повторы</strong>{duplicateWarnings.map(({ item, similarity }) => <div key={item.id}>{item.topic} · совпадение ключевых слов {Math.round(similarity * 100)}%</div>)}</div>}</>}
      {view === "results" && <LinkedInResults plan={plan} setPlan={setPlan} />}
    </div>
  );
}
