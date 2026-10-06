import { useCallback, useEffect, useState } from "react";
import { useLargePersistentState, usePersistentState } from "./lib/storage.js";
import { usageToday } from "./lib/api.js";
import { withDescriptionLinks } from "./lib/descriptionLinks.js";
import {
  normalizeLinkedInState,
  normalizeSavedTopicsState,
  normalizeTopicsState,
  normalizeWeekPlanState,
} from "./lib/persistedState.js";

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
import WeekPlanTab from "./components/WeekPlanTab.jsx";
import LinkedInTab from "./components/LinkedInTab.jsx";
import TabErrorBoundary from "./components/TabErrorBoundary.jsx";
import FilmStudioTab from "./components/FilmStudioTab.jsx";
import { syncContentPackageToWeek } from "../shared/content-week.js";
import { normalizeFilmState } from "../shared/film-studio.js";

const MUSIC_TABS = [
  { id: "long", label: "Контент недели" },
  { id: "shorts", label: "Shorts" },
  { id: "community", label: "Записи YouTube" },
  { id: "social", label: "Telegram + Boosty" },
  { id: "thumbnails", label: "Картинки" },
  { id: "week", label: "План публикаций" },
  { id: "topics", label: "Темы" },
  { id: "analyze", label: "Анализ видео" },
  { id: "ideas", label: "Идеи" },
  { id: "saved-topics", label: "Сохранённые темы" },
  { id: "settings", label: "Настройки" },
];

const BUSINESS_TABS = [{ id: "linkedin", label: "LinkedIn" }];
const FILM_TABS = [{ id: "film-studio", label: "AI Film Studio" }];

const defaultSettings = {
  openaiKey: "",
  visionModel: "gpt-5.1",
  scoreThreshold: 7,
  maxAttempts: 3,
  imageQuality: "medium",
  telegramBotToken: "",
  telegramChatId: "",
};

export default function App() {
  const [tab, setTab] = useState("long");
  const [lastContentTab, setLastContentTab] = useState("long");
  const [theme, setTheme] = usePersistentState("theme", "light");
  const [links, setLinks] = usePersistentState("links", []);
  const [settings, setSettings] = usePersistentState("settings", defaultSettings);
  const [longState, setLongState] = usePersistentState("long", {});
  const [shortsState, setShortsState] = usePersistentState("shorts", {});
  const [thumbState, setThumbState] = usePersistentState("thumbnails", {});
  const [timecodesState, setTimecodesState] = usePersistentState("timecodes", {});
  const [communityState, setCommunityState] = usePersistentState("community", {});
  const [socialState, setSocialState] = usePersistentState("social", {});
  const [weekState, setWeekState] = useLargePersistentState("week-plan", {}, normalizeWeekPlanState);
  const [analyzeState, setAnalyzeState] = usePersistentState("analyze", {});
  const [ideas, setIdeas] = usePersistentState("ideas", []);
  const [topicsState, setTopicsState] = useLargePersistentState("topics", {}, normalizeTopicsState);
  const [savedTopics, setSavedTopics] = useLargePersistentState("saved-topics", [], normalizeSavedTopicsState);
  const [linkedinState, setLinkedinState] = useLargePersistentState("linkedin", {}, normalizeLinkedInState);
  const [filmState, setFilmState, filmStateMeta] = useLargePersistentState("film-studio", {}, normalizeFilmState);

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
      inputMode: "custom",
      customTitle: result.query,
      customScript: "",
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

  useEffect(() => {
    if (tab !== "film-studio") setLastContentTab(tab);
  }, [tab]);

  const isFilmWorkspace = tab === "film-studio";

  return (
    <div className={`app-shell ${isFilmWorkspace ? "film-workspace-shell" : "content-workspace-shell"}`}>
      {isFilmWorkspace ? <div className="film-workspace-header">
        <button className="secondary" onClick={() => setTab(lastContentTab)}>← Вернуться в Content Studio</button>
        <div className="film-workspace-title"><span className="film-kicker">ОТДЕЛЬНОЕ РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>AI Film Studio</h1></div>
        <CostBadge />
        <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
        </button>
      </div> : <>
        <div className="top-row">
          <h1>AI Content Studio</h1>
          <CostBadge />
          <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
          </button>
        </div>
        <div className="tab-sections">
        <div className="tab-section">
          <span className="tab-section-label">YouTube · AI Music Lab</span>
          <div className="tabs">
            {MUSIC_TABS.map((t) => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tab-section business-tabs">
          <span className="tab-section-label">LinkedIn · AI и бизнес</span>
          <div className="tabs">
            {BUSINESS_TABS.map((t) => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tab-section film-tabs">
          <span className="tab-section-label">YouTube · фантастические фильмы</span>
          <div className="tabs">
            {FILM_TABS.map((t) => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        </div>
      </>}

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
            setShortsState((current) => ({
              cards: (shorts || []).slice(0, 4).map((s, i) => ({
                ...s,
                topic: s.topic || "",
                titles: s.titles || null,
                description: withDescriptionLinks(
                  s.description || "",
                  links,
                  links.map((link) => link.id)
                ),
                selectedLinkIds: links.map((link) => link.id),
              })),
            }))
          }
          onCommunityReady={(posts) => setCommunityState((prev) => ({ ...(prev || {}), posts }))}
          onSocialReady={({ telegram, boosty }) =>
            setSocialState({ telegram: telegram || [], boosty: boosty || [] })
          }
          onPackageReady={({ community, telegram, boosty }) =>
            setWeekState((current) => syncContentPackageToWeek(current, {
              title: longState.customTitle,
              community,
              telegram,
              boosty,
            }, { id: crypto.randomUUID() }))
          }
          onOpenShorts={() => setTab("shorts")}
        />
      </div>
      <div style={{ display: tab === "topics" ? "block" : "none" }}>
        <TabErrorBoundary label="Темы" onReset={() => setTopicsState({})}>
          <TopicsPanel
            state={topicsState}
            setState={setTopicsState}
            onUseTopic={useTopicInScript}
            onSaveTopics={saveFoundTopics}
          />
        </TabErrorBoundary>
      </div>
      <div style={{ display: tab === "week" ? "block" : "none" }}>
        <TabErrorBoundary label="План недели" onReset={() => setWeekState({})}>
          <WeekPlanTab
            state={weekState}
            setState={setWeekState}
            longState={longState}
            communityState={communityState}
            setCommunityState={setCommunityState}
            socialState={socialState}
            setSocialState={setSocialState}
            shortsState={shortsState}
            thumbState={thumbState}
            onOpenImages={() => setTab("thumbnails")}
            settings={settings}
          />
        </TabErrorBoundary>
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
        <TabErrorBoundary label="Сохранённые темы" onReset={() => setSavedTopics([])}>
          <SavedTopicsTab topics={savedTopics} setTopics={setSavedTopics} onUseTopic={useTopicInScript} />
        </TabErrorBoundary>
      </div>
      <div style={{ display: tab === "settings" ? "block" : "none" }}>
        <SettingsTab links={links} setLinks={setLinks} settings={settings} setSettings={setSettings} />
      </div>
      <div style={{ display: tab === "linkedin" ? "block" : "none" }}>
        <TabErrorBoundary label="LinkedIn" onReset={() => setLinkedinState({})}>
          <LinkedInTab state={linkedinState} setState={setLinkedinState} settings={settings} />
        </TabErrorBoundary>
      </div>
      <div style={{ display: tab === "film-studio" ? "block" : "none" }}>
        <TabErrorBoundary label="AI Film Studio" onReset={() => setFilmState({})}>
          <FilmStudioTab state={filmState} setState={setFilmState} stateReady={filmStateMeta.ready} />
        </TabErrorBoundary>
      </div>
    </div>
  );
}
