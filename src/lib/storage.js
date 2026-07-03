// Всё пользовательское состояние — только в localStorage браузера.
import { useEffect, useState } from "react";

const PREFIX = "aml-yt.";

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // квота переполнена (например, большие data URL) — молча пропускаем
  }
}

// React-состояние, автоматически зеркалящееся в localStorage.
export function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => load(key, fallback));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue];
}
