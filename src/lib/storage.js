// Всё пользовательское состояние хранится локально в браузере.
import { useCallback, useEffect, useRef, useState } from "react";

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
const DB_VERSION = 2;
const LARGE_STATE_STORE = "large-state";
const FILM_ASSET_STORE = "film-assets";

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
      if (!database.objectStoreNames.contains(FILM_ASSET_STORE)) {
        database.createObjectStore(FILM_ASSET_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    // При открытой старой вкладке браузер сам продолжит upgrade после её
    // закрытия. Promise намеренно остаётся pending: так мы не запишем поверх
    // IndexedDB устаревший fallback из localStorage.
    request.onblocked = () => console.warn("Обновление локальной базы ожидает закрытия другой вкладки приложения");
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

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

const FILM_ASSET_KINDS = new Set(["reference", "keyframe"]);
const FILM_ASSET_CATEGORIES = new Set(["character", "costume", "location", "object", "vehicle", "style", "other"]);

export function normalizeFilmAssetRecord(value) {
  const source = value && typeof value === "object" ? value : {};
  const blob = source.blob;
  if (!cleanText(source.id)) throw new Error("У изображения отсутствует идентификатор");
  if (!(blob instanceof Blob) || !blob.type.startsWith("image/")) {
    throw new Error("Можно сохранить только изображение PNG, JPEG или WebP");
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type)) {
    throw new Error("Поддерживаются изображения PNG, JPEG и WebP");
  }
  if (blob.size > 10 * 1024 * 1024) throw new Error("Изображение больше 10 МБ");

  return {
    id: cleanText(source.id),
    kind: FILM_ASSET_KINDS.has(source.kind) ? source.kind : "reference",
    category: FILM_ASSET_CATEGORIES.has(source.category) ? source.category : "other",
    label: cleanText(source.label) || cleanText(source.fileName) || "Изображение",
    fileName: cleanText(source.fileName) || "image",
    mimeType: blob.type,
    size: blob.size,
    createdAt: cleanText(source.createdAt) || new Date().toISOString(),
    updatedAt: cleanText(source.updatedAt) || new Date().toISOString(),
    blob,
  };
}

export async function readFilmAssets() {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(FILM_ASSET_STORE, "readonly")
        .objectStore(FILM_ASSET_STORE)
        .getAll();
      request.onsuccess = () => resolve((Array.isArray(request.result) ? request.result : [])
        .filter((asset) => asset && typeof asset === "object" && asset.blob instanceof Blob && asset.blob.type.startsWith("image/")));
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function writeFilmAsset(value) {
  const asset = normalizeFilmAssetRecord(value);
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(FILM_ASSET_STORE, "readwrite");
      transaction.objectStore(FILM_ASSET_STORE).put(asset);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return asset;
  } finally {
    database.close();
  }
}

export async function deleteFilmAsset(id) {
  if (!cleanText(id)) return;
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(FILM_ASSET_STORE, "readwrite");
      transaction.objectStore(FILM_ASSET_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function useFilmAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    readFilmAssets()
      .then((stored) => {
        if (!cancelled) setAssets(stored.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause.message || "Не удалось открыть локальное хранилище изображений");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const saveAsset = useCallback(async (value) => {
    try {
      const asset = await writeFilmAsset(value);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setError("");
      return asset;
    } catch (cause) {
      const message = cause.message || "Не удалось сохранить изображение";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const removeAsset = useCallback(async (id) => {
    try {
      await deleteFilmAsset(id);
      setAssets((current) => current.filter((item) => item.id !== id));
      setError("");
    } catch (cause) {
      const message = cause.message || "Не удалось удалить изображение";
      setError(message);
      throw new Error(message);
    }
  }, []);

  return { assets, loading, error, saveAsset, removeAsset };
}

// Большие результаты исследований храним в IndexedDB: localStorage обычно
// ограничена примерно 5 МБ и переполняется роликами и комментариями.
// При первом запуске переносим прежнее значение из localStorage.
const identity = (value) => value;

export function applyPendingStateUpdates(base, updates, normalize = identity) {
  return updates.reduce(
    (current, next) => normalize(typeof next === "function" ? next(current) : next),
    normalize(base),
  );
}

export function useLargePersistentState(key, fallback, normalize = identity) {
  const [value, setValue] = useState(() => normalize(load(key, fallback)));
  const [hydrated, setHydrated] = useState(false);
  const ready = useRef(false);
  const pendingUpdates = useRef([]);

  const setSafeValue = useCallback((next) => {
    if (!ready.current) pendingUpdates.current.push(next);
    setValue((current) => normalize(typeof next === "function" ? next(current) : next));
  }, [normalize]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await readLargeState(key);
        if (cancelled) return;
        const needsMigration = stored === undefined;
        const base = needsMigration ? load(key, fallback) : stored;
        const hydratedValue = applyPendingStateUpdates(base, pendingUpdates.current.splice(0), normalize);
        ready.current = true;
        setValue(hydratedValue);
        setHydrated(true);
        if (needsMigration) {
          writeLargeState(key, hydratedValue).catch((error) => {
            console.error(`Не удалось перенести ${key} в IndexedDB`, error);
          });
        }
      } catch (error) {
        console.error(`Не удалось загрузить ${key} из IndexedDB`, error);
        if (!cancelled) {
          pendingUpdates.current = [];
          ready.current = true;
          setHydrated(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [key, normalize]);

  useEffect(() => {
    if (!ready.current) return;
    writeLargeState(key, value).catch((error) => {
      console.error(`Не удалось сохранить ${key} в IndexedDB`, error);
    });
  }, [key, value]);

  return [value, setSafeValue, { ready: hydrated }];
}
