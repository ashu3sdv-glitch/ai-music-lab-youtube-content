import { useEffect, useRef, useState } from "react";
import { load, save } from "../../lib/storage.js";

const MODIFIERS = [
  "", "как", "почему", "не", "что", "где", "можно ли", "лучше",
  "бесплатно", "ошибка", "проблема", "настройка", "на русском",
];
const PAIN_SEEDS = [
  "не работает",
  "почему не работает",
  "не генерирует",
  "не создаёт песню",
  "не дописывает песню",
  "обрывает песню",
  "ошибка генерации",
  "как исправить ошибку",
  "не скачивается",
  "не загружается",
  "не открывается",
  "не сохраняет",
  "не принимает промпт",
  "не получается создать",
  "зависает",
  "оплата не проходит",
  "что делать если не работает",
];
const ALPHABET = "абвгдежзиклмнопрстуфхцчшэюя".split("");
const PAIN_PATTERNS = [
  /почему\s+(?:\p{L}+\s+){0,3}не(?:\s|$)/iu,
  /ошиб/iu,
  /проблем/iu,
  /обрыв/iu,
  /обрыва/iu,
  /не\s+работает/iu,
  /не\s+генерирует/iu,
  /не\s+созда[её]т/iu,
  /не\s+дописывает/iu,
  /не\s+скачива/iu,
  /не\s+загружа/iu,
  /не\s+открыва/iu,
  /не\s+сохраня/iu,
  /не\s+принимает/iu,
  /не\s+проходит/iu,
  /не\s+получается/iu,
  /не\s+могу/iu,
  /перестал/iu,
  /завис/iu,
  /как\s+исправить/iu,
  /что\s+делать/iu,
];
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const DAILY_LIMIT = 10000;
const COST_PER_QUERY = 102;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isPainQuery(query) {
  return PAIN_PATTERNS.some((pattern) => pattern.test(String(query || "")));
}

export function buildSeeds(base) {
  const clean = base.trim();
  return [...new Set([
    clean,
    ...MODIFIERS.filter(Boolean).map((modifier) => `${clean} ${modifier}`),
    ...PAIN_SEEDS.map((suffix) => `${clean} ${suffix}`),
    ...ALPHABET.map((letter) => `${clean} ${letter}`),
  ])];
}

function quotaDate(now = new Date()) {
  return new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function resetLabel() {
  const now = new Date();
  const shifted = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const resetShifted = new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1
  ));
  const reset = new Date(resetShifted.getTime() + 8 * 60 * 60 * 1000);
  return reset.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function readQuota() {
  return load(`topics.quota.${quotaDate()}`, { used: 0 }).used || 0;
}

function readCache(query) {
  const cached = load(`topics.cache.${query.toLocaleLowerCase("ru")}`, null);
  return cached && Date.now() - cached.savedAt < CACHE_TTL ? cached.data : null;
}

function writeCache(query, data) {
  save(`topics.cache.${query.toLocaleLowerCase("ru")}`, { savedAt: Date.now(), data });
}

async function analyzeQuery(query) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, regionCode: "RU", relevanceLanguage: "ru" }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.error) {
    const error = new Error(data?.error || `Ошибка анализа ${response.status}`);
    error.code = data?.code;
    throw error;
  }
  return data;
}

export function useTopicResearch({ initialResults = [], onResults }) {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, found: 0, text: "" });
  const [results, setResults] = useState(initialResults);
  const [quotaUsed, setQuotaUsed] = useState(readQuota);
  const [error, setError] = useState("");
  const stopped = useRef(false);

  useEffect(() => onResults?.(results), [results, onResults]);

  function stop() {
    stopped.current = true;
    setStatus("idle");
  }

  async function run({ base, limit, painOnly, manual }) {
    stopped.current = false;
    setError("");
    let queries = manual.split("\n").map((line) => line.trim()).filter(Boolean);

    try {
      if (!queries.length) {
        setStatus("suggesting");
        const suggestions = new Set();
        const seeds = buildSeeds(base);
        for (let index = 0; index < seeds.length; index += 1) {
          if (stopped.current) return;
          const response = await fetch(`/api/suggest?q=${encodeURIComponent(seeds[index])}`);
          const data = await response.json().catch(() => ({ suggestions: [] }));
          (data.suggestions || []).forEach((item) => suggestions.add(item.trim()));
          setProgress({
            current: index + 1,
            total: seeds.length,
            found: suggestions.size,
            text: `Сбор подсказок: ${index + 1} / ${seeds.length}`,
          });
          await wait(180 + Math.round(Math.random() * 70));
        }
        queries = [...suggestions];
      }

      queries = [...new Set(queries)]
        .filter((query) => query.split(/\s+/).length >= 3)
        .filter((query) => !painOnly || isPainQuery(query))
        .slice(0, limit);
      if (!queries.length) throw new Error("Подходящих фраз не найдено. Добавьте их вручную или отключите фильтр боли.");

      const uncachedCount = queries.filter((query) => !readCache(query)).length;
      if (quotaUsed + uncachedCount * COST_PER_QUERY > DAILY_LIMIT) {
        throw new Error(`Недостаточно квоты. Следующий сброс: ${resetLabel()}`);
      }

      setStatus("analyzing");
      const next = [];
      for (let index = 0; index < queries.length; index += 1) {
        if (stopped.current) return;
        const query = queries[index];
        let data = readCache(query);
        let cached = true;
        if (!data) {
          cached = false;
          data = await analyzeQuery(query);
          writeCache(query, data);
          const used = readQuota() + COST_PER_QUERY;
          save(`topics.quota.${quotaDate()}`, { used });
          setQuotaUsed(used);
          await wait(300);
        }
        next.push({ ...data, cached });
        setResults([...next]);
        setProgress({
          current: index + 1,
          total: queries.length,
          found: queries.length,
          text: `Анализ: ${index + 1} / ${queries.length}`,
        });
      }
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return {
    status, progress, results, quotaUsed, quotaLimit: DAILY_LIMIT, error, run, stop,
    resetTime: resetLabel(),
  };
}
