import { useEffect, useState } from "react";
import { usePersistentState } from "./lib/storage.js";
import LongTab from "./components/LongTab.jsx";
import ShortsTab from "./components/ShortsTab.jsx";
import ThumbnailsTab from "./components/ThumbnailsTab.jsx";
import TimecodesTab from "./components/TimecodesTab.jsx";
import CommunityTab from "./components/CommunityTab.jsx";
import SettingsTab from "./components/SettingsTab.jsx";

const TABS = [
  { id: "long", label: "YouTube Long" },
  { id: "shorts", label: "Shorts" },
  { id: "thumbnails", label: "Обложки" },
  { id: "timecodes", label: "Таймкоды" },
  { id: "community", label: "Записи" },
  { id: "settings", label: "Настройки" },
];

const defaultSettings = {
  openaiKey: "",
  visionModel: "gpt-5.1",
  scoreThreshold: 7,
  maxAttempts: 3,
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div>
      <div className="top-row">
        <h1>AI Music Lab — YouTube Content</h1>
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

      {tab === "long" && <LongTab state={longState} setState={setLongState} links={links} />}
      {tab === "shorts" && <ShortsTab state={shortsState} setState={setShortsState} links={links} />}
      {tab === "thumbnails" && (
        <ThumbnailsTab
          state={thumbState}
          setState={setThumbState}
          settings={settings}
          longState={longState}
          shortsState={shortsState}
          communityState={communityState}
        />
      )}
      {tab === "timecodes" && <TimecodesTab state={timecodesState} setState={setTimecodesState} settings={settings} />}
      {tab === "community" && (
        <CommunityTab state={communityState} setState={setCommunityState} longState={longState} />
      )}
      {tab === "settings" && <SettingsTab links={links} setLinks={setLinks} settings={settings} setSettings={setSettings} />}
    </div>
  );
}
