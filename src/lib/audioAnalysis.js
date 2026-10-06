export function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function defaultSongSections(duration) {
  const total = Math.max(20, Math.round(Number(duration) || 180));
  const templates = total < 75
    ? [["Интро", .08], ["Куплет", .27], ["Припев", .25], ["Развитие", .25], ["Финал", .15]]
    : [["Интро", .06], ["Куплет 1", .18], ["Припев 1", .17], ["Куплет 2", .18], ["Припев 2", .17], ["Бридж / проигрыш", .13], ["Финальный припев", .08], ["Аутро", .03]];
  let cursor = 0;
  return templates.map(([label, share], index) => {
    const end = index === templates.length - 1 ? total : Math.max(cursor + 1, Math.round(cursor + total * share));
    const section = {
      id: `MV_SECTION_${String(index + 1).padStart(2, "0")}`,
      label,
      start: cursor,
      end,
      energy: /припев|финал/i.test(label) ? "HIGH" : /интро|аутро/i.test(label) ? "LOW" : "MEDIUM",
    };
    cursor = end;
    return section;
  });
}

function sectionEnergy(samples, sampleRate, start, end) {
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(samples.length, Math.floor(end * sampleRate));
  if (to <= from) return 0;
  const stride = Math.max(1, Math.floor((to - from) / 12000));
  let sum = 0;
  let count = 0;
  for (let index = from; index < to; index += stride) {
    sum += samples[index] * samples[index];
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

export async function analyzeAudioFile(file) {
  if (!file) throw new Error("Выберите аудиофайл");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Браузер не поддерживает анализ аудио");
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const sections = defaultSongSections(buffer.duration);
    const samples = buffer.getChannelData(0);
    const values = sections.map((section) => sectionEnergy(samples, buffer.sampleRate, section.start, section.end));
    const peak = Math.max(...values, .0001);
    return {
      name: file.name,
      duration: Math.round(buffer.duration),
      sections: sections.map((section, index) => {
        const relative = values[index] / peak;
        return { ...section, energy: relative > .82 ? "PEAK" : relative > .58 ? "HIGH" : relative > .32 ? "MEDIUM" : "LOW" };
      }),
    };
  } catch {
    throw new Error("Не удалось прочитать аудио. Попробуйте MP3, WAV, M4A или AAC");
  } finally {
    context.close().catch(() => {});
  }
}
