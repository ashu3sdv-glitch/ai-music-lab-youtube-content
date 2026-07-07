import { generateImage, scoreImage } from "./openai.js";
import { cropToAspect } from "./crop.js";
import { callApi } from "./api.js";

// Полный цикл генерации одной обложки: промпт → картинка → обрезка →
// само-оценка vision-моделью → повторы до порога. Вынесен из ThumbCard,
// чтобы батч-режим «Сгенерировать все обложки» использовал ту же логику.
export async function generateThumbnail({ settings, topic, context, aspect, variant, onProgress = () => {} }) {
  const { openaiKey, visionModel, scoreThreshold, maxAttempts } = settings;
  const imageQuality = settings.imageQuality || "medium";

  onProgress("Генерирую промпт…");
  const { prompt } = await callApi("generate-thumbnail-prompt", { topic, aspect, context, variant });
  let currentPrompt = prompt;
  const attempts = [];
  let final = null;

  for (let i = 1; i <= maxAttempts; i++) {
    onProgress(`Попытка ${i}/${maxAttempts}: генерирую картинку…`);
    const raw = await generateImage(openaiKey, currentPrompt, aspect, imageQuality);
    const image = await cropToAspect(raw, aspect);

    onProgress(`Попытка ${i}/${maxAttempts}: оцениваю…`);
    let evalResult;
    try {
      evalResult = await scoreImage(openaiKey, visionModel, image, currentPrompt);
    } catch (e) {
      // оценка упала — показываем картинку без балла, не теряем результат
      attempts.push({ image, prompt: currentPrompt, score: null, weaknesses: [e.message] });
      final = { image, prompt: currentPrompt, score: null };
      break;
    }

    attempts.push({
      image,
      prompt: currentPrompt,
      score: evalResult.score,
      weaknesses: evalResult.weaknesses || [],
    });
    final = { image, prompt: currentPrompt, score: evalResult.score };

    if (evalResult.score >= scoreThreshold) break;
    if (i < maxAttempts && evalResult.improved_prompt) {
      currentPrompt = evalResult.improved_prompt;
    }
  }

  // если порог не взят — возвращаем лучшую попытку
  const best = attempts.reduce((a, b) => ((b.score ?? 0) > (a?.score ?? -1) ? b : a), null);
  if (best && (final?.score ?? 0) < (best.score ?? 0)) {
    final = { image: best.image, prompt: best.prompt, score: best.score };
  }
  return { ...final, attempts, basePrompt: prompt };
}
