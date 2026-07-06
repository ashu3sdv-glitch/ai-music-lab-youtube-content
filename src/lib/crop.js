// У gpt-image-2 нет ровно 16:9/9:16 — генерируем ближайший размер (3:2 / 2:3 / 1:1)
// и обрезаем до точного YouTube-формата на canvas.
const TARGETS = {
  "16:9": { w: 1536, h: 864 },
  "9:16": { w: 864, h: 1536 },
  "1:1": null, // 1024×1024 совпадает точно, обрезка не нужна
};

// Заголовочный текст по промпту всегда живёт в верхней трети (16:9) или у
// левого края (баннеры Shorts, 9:16) — но словесная инструкция "оставь
// отступ" не даёт генератору картинок точного контроля над пикселями, и
// буквы всё равно иногда цепляют край кадра. Симметричная обрезка по центру
// в этом смысле рискованна вдвойне: чем меньше отступ на "опасной" стороне,
// тем больше шанс срезать буквы. Смещаем окно обрезки так, чтобы с опасной
// стороны (верх / левый край) снималось намного меньше, чем с безопасной.
const CROP_BIAS = {
  "16:9": 0.15, // 15% обрезки — сверху, 85% — снизу
  "9:16": 0.15, // 15% обрезки — слева, 85% — справа
};

export async function cropToAspect(dataUrl, aspect) {
  const target = TARGETS[aspect];
  if (!target) return dataUrl;

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Не удалось загрузить картинку для обрезки"));
    el.src = dataUrl;
  });

  const scale = Math.max(target.w / img.width, target.h / img.height);
  const srcW = target.w / scale;
  const srcH = target.h / scale;
  const bias = CROP_BIAS[aspect] ?? 0.5;
  const srcX = (img.width - srcW) * bias;
  const srcY = (img.height - srcH) * bias;

  const canvas = document.createElement("canvas");
  canvas.width = target.w;
  canvas.height = target.h;
  canvas
    .getContext("2d")
    .drawImage(img, srcX, srcY, srcW, srcH, 0, 0, target.w, target.h);
  return canvas.toDataURL("image/png");
}
