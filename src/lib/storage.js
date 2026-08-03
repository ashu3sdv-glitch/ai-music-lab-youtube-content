// Всё пользовательское состояние — только в localStorage браузера.
import { useEffect, useRef, useState } from "react";

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

const DB_NAME = "aml-youtube-content";
const DB_VERSION = 1;
const LARGE_STATE_STORE = "large-state";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB недоступна"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LARGE_STATE_STORE)) {
        database.createObjectStore(LARGE_STATE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLargeState(key) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(LARGE_STATE_STORE, "readonly")
        .objectStore(LARGE_STATE_STORE)
        .get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function writeLargeState(key, value) {
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(LARGE_STATE_STORE, "readwrite");
      transaction.objectStore(LARGE_STATE_STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

// Большие результаты исследований храним в IndexedDB: localStorage обычно
// ограничена примерно 5 МБ и переполняется роликами и комментариями.
// При первом запуске переносим прежнее значение из localStorage.
export function useLargePersistentState(key, fallback) {
  const [value, setValue] = useState(() => load(key, fallback));
  const ready = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await readLargeState(key);
        if (cancelled) return;
        if (stored !== undefined) {
          setValue(stored);
        } else {
          const legacy = load(key, fallback);
          setValue(legacy);
          await writeLargeState(key, legacy);
        }
      } catch (error) {
        console.error(`Не удалось загрузить ${key} из IndexedDB`, error);
      } finally {
        if (!cancelled) ready.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (!ready.current) return;
    writeLargeState(key, value).catch((error) => {
      console.error(`Не удалось сохранить ${key} в IndexedDB`, error);
    });
  }, [key, value]);

  return [value, setValue];
}
