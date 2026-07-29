import { useCallback, useEffect, useState } from "react";
import { usePersistentState } from "./lib/storage.js";
import { usageToday } from "./lib/api.js";

// Бейдж расходов Claude в шапке: последний запрос + итог за сегодня.
// Считает только текстовые генерации (Anthropic); картинки — счёт OpenAI.
function CostBadge() {
  const [usage, setUsage] = useState(() => ({ last: null, ...usageToday() }));
  useEffect(() => {
    const onUsage = (e) => setUsage({ last: e.detail.last, cost: e.detail.today, calls: e.detail.calls });
    window.addEventListener("claude-usage", onUsage);
    return () => window.removeEventListener("claude-usage", onUsage);
  }, []);
  if (!usage.calls) return null;
  return (
    <span className="muted small" title="Расход Claude API (тексты). Картинки считаются отдельно, на счету OpenAI.">
      {usage.last != null && <>запрос ${usage.last.toFixed(3)} · </>}
      сегодня ${usage.cost.toFixed(2)} ({usage.calls})
    </span>
  );
}
import LongTab from "./components/LongTab.jsx";
import ShortsTab from "./components/ShortsTab.jsx";
import ThumbnailsTab from "./components/ThumbnailsTab.jsx";
import TimecodesTab from "./components/TimecodesTab.jsx";
import CommunityTab from "./components/CommunityTab.jsx";
import SocialTab from "./components/SocialTab.jsx";
import AnalyzeTab from "./components/AnalyzeTab.jsx";
import IdeasTab from "./components/IdeasTab.jsx";
import SavedTopicsTab from "./components/SavedTopicsTab.jsx";
import SettingsTab from "./components/SettingsTab.jsx";
import TopicsPanel from "./modules/Topics/TopicsPanel.jsx";

const TABS = [
  { id: "topics", label: "Темы" },
  { id: "long", label: "YouTube Long" },
  { id: "shorts", label: "Shorts" },
  { id: "thumbnails", label: "Обложки" },
  { id: "timecodes", label: "Таймкоды" },
  { id: "community", label: "Записи" },
  { id: "social", label: "Соцсети" },
  { id: "analyze", label: "Анализ видео" },
  { id: "ideas", label: "Идеи" },
  { id: "saved-topics", label: "Сохранённые темы" },
  { id: "settings", label: "Настройки" },
];

const defaultSettings = {
  openaiKey: "",
  visionModel: "gpt-5.1",
  scoreThreshold: 7,
  maxAttempts: 3,
  imageQuality: "medium",
};

export default function App() {
  const [tab, setTab] = useState("long");
  const [theme, setTheme] = usePersistentState("theme", "light");
  const [links, setLinks] = usePersistentState("links", []);
  const [settings, setSettings] = usePersistentState("settings", defaultSettings);
  const [longState, setLongState] = usePersistentState("long", {});
  const [shortsState, setShortsState] = usePersistentState("shorts", {});
  const [thumbState, setThumbState] = usePersistentState("thumbnails", {});
  const [timecodesState, setTimecodesState] = usePersistentState("timecodes", {});
  const [communityState, setCommunityState] = usePersistentState("community", {});
  const [socialState, setSocialState] = usePersistentState("social", {});
  const [analyzeState, setAnalyzeState] = usePersistentState("analyze", {});
  const [ideas, setIdeas] = usePersistentState("ideas", []);
  const [topicsState, setTopicsState] = usePersistentState("topics", {});
  const [savedTopics, setSavedTopics] = usePersistentState("saved-topics", []);

  const saveFoundTopics = useCallback((items, context = {}) => {
    if (!items?.length) return;
    const savedAt = new Date().toISOString();
    setSavedTopics((current) => {
      const next = [...(current || [])];
      for (const item of items) {
        const query = item.query || item.suggestedTitle || item.topic;
        if (!query) continue;
        const sourceType = context.sourceType || "search";
        const fingerprint = `${sourceType}:${query.toLocaleLowerCase("ru").trim()}`;
        const existingIndex = next.findIndex((saved) => saved.fingerprint === fingerprint);
        const saved = {
          ...(existingIndex >= 0 ? next[existingIndex] : {}),
          ...item,
          id: existingIndex >= 0 ? next[existingIndex].id : crypto.randomUUID(),
          fingerprint,
          query,
          savedAt,
          sourceType,
          sourceLabel: context.sourceLabel || "Поисковый спрос",
          researchLabel: context.researchLabel || "",
        };
        if (existingIndex >= 0) next[existingIndex] = saved;
        else next.push(saved);
      }
      return next.slice(-300);
    });
  }, [setSavedTopics]);

  const useTopicInScript = useCallback((result) => {
    setLongState((current) => ({
      ...(current || {}),
      topic: result.query,
      hooks: [],
      selectedHookIndex: null,
      script: "",
      description: null,
      editingPlan: "",
      topicResearch: {
        topic: result.query,
        score: result.score,
        competitorTitles: (result.topVideos || []).slice(0, 5).map((video) => video.title),
        medianViews: result.metrics?.medianViews || 0,
        source: "topic-research",
      },
    }));
    setTab("long");
  }, [setLongState]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div>
      <div className="top-row">
        <h1>AI Music Lab — YouTube Content</h1>
        <CostBadge />
        <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
        </button>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Все вкладки остаются смонтированными и только скрываются через CSS —
          иначе переключение вкладки размонтирует компонент и оборвёт
          отслеживание уже запущенной генерации (хук/сценарий/обложка и т.д.),
          даже если сам запрос на сервере продолжает выполняться. */}
      <div style={{ display: tab === "long" ? "block" : "none" }}>
        <LongTab
          state={longState}
          setState={setLongState}
          links={links}
          onShortsReady={(shorts) =>
            setShortsState({
              cards: (shorts || []).slice(0, 3).map((s) => ({
                topic: s.topic || "",
                titles: s.titles || null,
                description: s.description || "",
                selectedLinkIds: [],
              })),
            })
          }
          onCommunityReady={(posts) => setCommunityState((prev) => ({ ...(prev || {}), posts }))}
          onSocialReady={({ telegram, boosty }) =>
            setSocialState({ telegram: telegram || [], boosty: boosty || [] })
          }
        />
      </div>
      <div style={{ display: tab === "topics" ? "block" : "none" }}>
        <TopicsPanel
          state={topicsState}
          setState={setTopicsState}
          onUseTopic={useTopicInScript}
          onSaveTopics={saveFoundTopics}
        />
      </div>
      <div style={{ display: tab === "shorts" ? "block" : "none" }}>
        <ShortsTab state={shortsState} setState={setShortsState} links={links} longState={longState} />
      </div>
      <div style={{ display: tab === "thumbnails" ? "block" : "none" }}>
        <ThumbnailsTab
          state={thumbState}
          setState={setThumbState}
          settings={settings}
          longState={longState}
          shortsState={shortsState}
          communityState={communityState}
        />
      </div>
      <div style={{ display: tab === "timecodes" ? "block" : "none" }}>
        <TimecodesTab state={timecodesState} setState={setTimecodesState} settings={settings} />
      </div>
      <div style={{ display: tab === "community" ? "block" : "none" }}>
        <CommunityTab state={communityState} setState={setCommunityState} longState={longState} />
      </div>
      <div style={{ display: tab === "social" ? "block" : "none" }}>
        <SocialTab state={socialState} setState={setSocialState} longState={longState} />
      </div>
      <div style={{ display: tab === "analyze" ? "block" : "none" }}>
        <AnalyzeTab state={analyzeState} setState={setAnalyzeState} ideas={ideas} setIdeas={setIdeas} />
      </div>
      <div style={{ display: tab === "ideas" ? "block" : "none" }}>
        <IdeasTab ideas={ideas} setIdeas={setIdeas} />
      </div>
      <div style={{ display: tab === "saved-topics" ? "block" : "none" }}>
        <SavedTopicsTab topics={savedTopics} setTopics={setSavedTopics} onUseTopic={useTopicInScript} />
      </div>
      <div style={{ display: tab === "settings" ? "block" : "none" }}>
        <SettingsTab links={links} setLinks={setLinks} settings={settings} setSettings={setSettings} />
      </div>
    </div>
  );
}
