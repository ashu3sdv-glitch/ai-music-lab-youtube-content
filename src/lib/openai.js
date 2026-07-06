// OpenAI API не поддерживает CORS для запросов напрямую из браузера
// (see api/openai-proxy.js) — поэтому ключ пользователя передаётся в
// заголовке на наш собственный serverless-прокси, который транзитом
// пересылает запрос в OpenAI и не сохраняет и не логирует ключ.
const PROXY = "/api/openai-proxy";

// Точные YouTube-форматы недоступны у gpt-image-2 — берём ближайший размер,
// точная обрезка делается на фронтенде (см. crop.js).
export const SIZE_BY_ASPECT = {
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "1:1": "1024x1024",
};

async function openaiFetch(apiKey, path, options) {
  const res = await fetch(PROXY, {
    ...options,
    headers: {
      "X-OpenAI-Key": apiKey,
      "X-OpenAI-Path": path,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI: ошибка ${res.status}`);
  }
  return data;
}

export async function generateImage(apiKey, prompt, aspect) {
  const data = await openaiFetch(apiKey, "/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      size: SIZE_BY_ASPECT[aspect] || "1024x1024",
      quality: "high",
      n: 1,
    }),
  });
  return `data:image/png;base64,${data.data[0].b64_json}`;
}

// Правка существующей картинки: текущая картинка как референс + инструкция.
export async function editImage(apiKey, imageDataUrl, prompt, aspect) {
  const blob = await (await fetch(imageDataUrl)).blob();
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("image", blob, "image.png");
  form.append("prompt", prompt);
  form.append("size", SIZE_BY_ASPECT[aspect] || "1024x1024");
  form.append("quality", "high");
  const data = await openaiFetch(apiKey, "/images/edits", {
    method: "POST",
    body: form,
  });
  return `data:image/png;base64,${data.data[0].b64_json}`;
}

// Само-оценка обложки vision-моделью: балл 1–10, слабые места, улучшенный промпт.
export async function scoreImage(apiKey, visionModel, imageDataUrl, originalPrompt) {
  const data = await openaiFetch(apiKey, "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Это обложка для YouTube. Промпт, по которому она сгенерирована:\n"${originalPrompt}"\n\nОцени её по 10-балльной шкале как YouTube-обложку (читаемость в мелком размере, композиция, эмоция, отсутствие артефактов, соответствие промпту). Верни строго JSON:\n{"score": число 1-10, "weaknesses": ["слабое место", ...], "improved_prompt": "улучшенный промпт с учётом слабых мест (на английском)"}`,
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  const text = data.choices[0].message.content;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Vision-модель не вернула JSON");
  return JSON.parse(text.slice(start, end + 1));
}

// Запасной вариант таймкодов: транскрипция аудио/видео с сегментами.
export async function transcribe(apiKey, file) {
  const form = new FormData();
  form.append("model", "whisper-1");
  form.append("file", file);
  form.append("response_format", "verbose_json");
  const data = await openaiFetch(apiKey, "/audio/transcriptions", {
    method: "POST",
    body: form,
  });
  return (data.segments || []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));
}
