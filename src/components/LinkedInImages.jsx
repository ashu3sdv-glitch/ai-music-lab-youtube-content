import { useState } from "react";
import { generateImage } from "../lib/openai.js";
import { cropToAspect } from "../lib/crop.js";
import { buildLinkedInImagePrompt, normalizeImageBrief } from "../../shared/linkedin-workspace.js";
import CopyButton from "./CopyButton.jsx";

export default function LinkedInImages({ brief, onBriefChange, generatedImage, onImageChange, settings, sourceType }) {
  const imageBrief = normalizeImageBrief(brief);
  const [aspect, setAspect] = useState(generatedImage?.aspect || "1:1");
  const [quality, setQuality] = useState(generatedImage?.quality || settings.imageQuality || "medium");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function patchBrief(patch) {
    onBriefChange({ ...imageBrief, ...patch });
  }

  async function createImage() {
    if (!settings.openaiKey) return setError("Введите OpenAI API-ключ во вкладке «Настройки»");
    if (!imageBrief.image_prompt.trim()) return setError("Сначала подготовьте или введите промпт изображения");
    setBusy("Создаю изображение…");
    setError("");
    try {
      const finalPrompt = buildLinkedInImagePrompt(imageBrief.image_prompt, { sourceType, visualStyle: imageBrief.visual_style });
      const raw = await generateImage(settings.openaiKey, finalPrompt, aspect, quality);
      const imageDataUrl = await cropToAspect(raw, aspect);
      onImageChange({
        dataUrl: imageDataUrl,
        prompt: finalPrompt,
        aspect,
        quality,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message || "Не удалось создать изображение");
    } finally {
      setBusy("");
    }
  }

  function downloadImage() {
    if (!generatedImage?.dataUrl) return;
    const link = document.createElement("a");
    link.href = generatedImage.dataUrl;
    link.download = `linkedin-${generatedImage.aspect === "1:1" ? "square" : "horizontal"}.png`;
    link.click();
  }

  return (
    <div className="card">
      <div className="card-head">
        <strong>Изображение для LinkedIn</strong>
        <CopyButton label="Скопировать промпт" text={() => imageBrief.image_prompt} />
      </div>
      <div className="field"><label>Заголовок</label><input value={imageBrief.image_title} onChange={(event) => patchBrief({ image_title: event.target.value })} /></div>
      <div className="field"><label>Подзаголовок</label><input value={imageBrief.image_subtitle} onChange={(event) => patchBrief({ image_subtitle: event.target.value })} /></div>
      <div className="field"><label>Концепция</label><textarea value={imageBrief.image_concept} onChange={(event) => patchBrief({ image_concept: event.target.value })} /></div>
      <div className="field"><label>Промпт</label><textarea value={imageBrief.image_prompt} onChange={(event) => patchBrief({ image_prompt: event.target.value })} /></div>
      <div className="field"><label>Визуальные элементы — по одному в строке</label><textarea className="linkedin-opening" value={imageBrief.visual_elements.join("\n")} onChange={(event) => patchBrief({ visual_elements: event.target.value.split("\n") })} /></div>
      <div className="linkedin-settings-grid">
        <div className="field">
          <label>Стиль изображения</label>
          <select value={imageBrief.visual_style} onChange={(event) => patchBrief({ visual_style: event.target.value })} disabled={!!busy}>
            <option value="auto">Авто — по типу материала</option>
            <option value="realistic">Реалистичное рабочее фото</option>
            <option value="editorial">Редакционная иллюстрация</option>
            <option value="process">Живая сцена процесса</option>
          </select>
        </div>
        <div className="field">
          <label>Размер</label>
          <select value={aspect} onChange={(event) => setAspect(event.target.value)} disabled={!!busy}>
            <option value="1:1">Квадратное 1:1</option>
            <option value="16:9">Горизонтальное 16:9</option>
          </select>
        </div>
        <div className="field">
          <label>Качество</label>
          <select value={quality} onChange={(event) => setQuality(event.target.value)} disabled={!!busy}>
            <option value="low">low — экономное</option>
            <option value="medium">medium — рабочее</option>
            <option value="high">high — максимальное</option>
          </select>
        </div>
        <div className="field"><label>Формат дизайна</label><input value={imageBrief.recommended_format} onChange={(event) => patchBrief({ recommended_format: event.target.value })} /></div>
        <div className="field"><label>Лимит текста</label><input value={imageBrief.text_limit} onChange={(event) => patchBrief({ text_limit: event.target.value })} /></div>
      </div>
      {!settings.openaiKey && <div className="warning-box">Для генерации добавьте OpenAI API-ключ в «Настройки». Промпт можно использовать вручную и без ключа.</div>}
      <div className="row">
        <button onClick={createImage} disabled={!!busy}>{busy || (generatedImage?.dataUrl ? "Создать другой вариант" : "Создать изображение")}</button>
        {generatedImage?.dataUrl && <button className="secondary" onClick={downloadImage}>Скачать PNG</button>}
      </div>
      {error && <div className="error">{error}</div>}
      {generatedImage?.dataUrl && (
        <div className="linkedin-image-preview">
          <img src={generatedImage.dataUrl} alt={imageBrief.image_title || "Изображение LinkedIn"} />
          <div className="muted small">{generatedImage.aspect} · качество {generatedImage.quality}</div>
        </div>
      )}
      <div className="muted small">Надписи внутри изображения запрещены. Стиль «Авто» выбирает живой формат по типу материала. Генерация расходует OpenAI API.</div>
    </div>
  );
}
