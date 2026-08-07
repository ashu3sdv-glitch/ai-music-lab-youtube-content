// У gpt-image-2 нет ровно 16:9/9:16 — генерируем ближайший размер (3:2 / 2:3 / 1:1)
// и обрезаем до точного YouTube-формата на canvas.
const TARGETS = {
  "16:9": { w: 1536, h: 864 },
  "9:16": { w: 864, h: 1536 },
  "1:1": null, // 1024×1024 совпадает точно, обрезка не нужна
};

// Заголовочный текст по промпту всегда живёт в верхней трети (16:9) или у
// левого края (баннеры Shorts, 9:16) — но словесная инструкция "оставь
// отступ" не даёт генератору картинок точного контроля над пикселями:
// буквы на практике всё равно упираются в самый край кадра, даже с частичной
// защитой (пробовали 15%/85% — и то срезало). Раз AI ненадёжен в этом,
// защищаемся кодом по максимуму: с "опасной" стороны (верх / левый край)
// не снимаем вообще ничего, весь запас обрезки уходит с безопасной стороны.
const CROP_BIAS = {
  "16:9": 0, // 0% обрезки — сверху, 100% — снизу
  "9:16": 0, // 0% обрезки — слева, 100% — справа
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

// Универсальная версия для недельного пакета: из одной базовой картинки
// получаем лёгкие JPEG-файлы нужных размеров для разных площадок.
export async function cropToSize(dataUrl, width, height, quality = 0.88) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Не удалось подготовить формат картинки"));
    el.src = dataUrl;
  });
  const scale = Math.max(width / img.width, height / img.height);
  const srcW = width / scale;
  const srcH = height / scale;
  const srcX = (img.width - srcW) / 2;
  const srcY = (img.height - srcH) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, srcX, srcY, srcW, srcH, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

// Вписывает исходную картинку целиком, не срезая заголовки и объекты.
// Пустое пространство заполняется затемнённой размытой копией изображения,
// поэтому квадрат выглядит как полноценный пост, а не как картинка с полосами.
export async function fitToSize(dataUrl, width, height, quality = 0.88) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Не удалось подготовить безопасный формат картинки"));
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  const coverScale = Math.max(width / img.width, height / img.height);
  const coverW = img.width * coverScale;
  const coverH = img.height * coverScale;
  context.save();
  context.filter = "blur(28px) brightness(0.45)";
  context.drawImage(img, (width - coverW) / 2, (height - coverH) / 2, coverW, coverH);
  context.restore();

  const containScale = Math.min(width / img.width, height / img.height);
  const containW = img.width * containScale;
  const containH = img.height * containScale;
  context.drawImage(img, (width - containW) / 2, (height - containH) / 2, containW, containH);
  return canvas.toDataURL("image/jpeg", quality);
}
