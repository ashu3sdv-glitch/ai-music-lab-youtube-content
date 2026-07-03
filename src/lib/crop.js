// У gpt-image-2 нет ровно 16:9/9:16 — генерируем ближайший размер (3:2 / 2:3 / 1:1)
// и обрезаем по центру до точного YouTube-формата на canvas.
const TARGETS = {
  "16:9": { w: 1536, h: 864 },
  "9:16": { w: 864, h: 1536 },
  "1:1": null, // 1024×1024 совпадает точно, обрезка не нужна
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
  const srcX = (img.width - srcW) / 2;
  const srcY = (img.height - srcH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = target.w;
  canvas.height = target.h;
  canvas
    .getContext("2d")
    .drawImage(img, srcX, srcY, srcW, srcH, 0, 0, target.w, target.h);
  return canvas.toDataURL("image/png");
}
