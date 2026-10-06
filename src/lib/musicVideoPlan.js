const MIN_SHOTS_PER_SECTION = 2;

function validSections(value) {
  return Array.isArray(value)
    ? value.filter((section) => section && typeof section === "object" && section.id)
    : [];
}

function validShots(value) {
  return Array.isArray(value)
    ? value.filter((shot) => shot && typeof shot === "object")
    : [];
}

export function musicVideoPlanSignature({ selectedConceptId, sections, settings, lyrics }) {
  const source = JSON.stringify({
    selectedConceptId: String(selectedConceptId || ""),
    sections: validSections(sections).map(({ id, label, start, end, energy }) => ({ id, label, start, end, energy })),
    settings: settings && typeof settings === "object" ? settings : {},
    lyrics: String(lyrics || ""),
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `mv-plan-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function completedMusicVideoSectionIds(sections, shots) {
  const sectionIds = new Set(validSections(sections).map((section) => section.id));
  const counts = new Map();
  validShots(shots).forEach((shot) => {
    if (!sectionIds.has(shot.sectionId)) return;
    counts.set(shot.sectionId, (counts.get(shot.sectionId) || 0) + 1);
  });
  return new Set([...sectionIds].filter((sectionId) => (counts.get(sectionId) || 0) >= MIN_SHOTS_PER_SECTION));
}

export function mergeMusicVideoSectionShots(sections, currentShots, sectionId, sectionShots) {
  const orderedSections = validSections(sections);
  const sectionOrder = new Map(orderedSections.map((section, index) => [section.id, index]));
  const nextShots = [
    ...validShots(currentShots).filter((shot) => sectionOrder.has(shot.sectionId) && shot.sectionId !== sectionId),
    ...validShots(sectionShots).filter((shot) => shot.sectionId === sectionId),
  ];

  return nextShots
    .map((shot, index) => ({ shot, index }))
    .sort((left, right) => {
      const sectionDelta = sectionOrder.get(left.shot.sectionId) - sectionOrder.get(right.shot.sectionId);
      return sectionDelta || left.index - right.index;
    })
    .map(({ shot }, index) => ({
      ...shot,
      id: `MV_SHOT_${String(index + 1).padStart(3, "0")}`,
    }));
}

function generationError(cause, completedCount, totalCount, failedSectionId) {
  const error = new Error(cause?.message || "Не удалось создать покадровый план");
  error.savedSectionCount = completedCount;
  error.totalSectionCount = totalCount;
  error.failedSectionId = failedSectionId;
  return error;
}

export async function generateMusicVideoPlanSections({
  sections,
  existingShots = [],
  resume = false,
  requestSection,
  onProgress = () => {},
}) {
  const orderedSections = validSections(sections);
  const validSectionIds = new Set(orderedSections.map((section) => section.id));
  let generated = resume
    ? validShots(existingShots).filter((shot) => validSectionIds.has(shot.sectionId))
    : [];
  let completed = completedMusicVideoSectionIds(orderedSections, generated);

  for (let index = 0; index < orderedSections.length; index += 1) {
    const section = orderedSections[index];
    if (completed.has(section.id)) continue;

    let responseShots;
    try {
      responseShots = await requestSection({ section, sectionIndex: index, allSections: orderedSections });
    } catch (cause) {
      throw generationError(cause, completed.size, orderedSections.length, section.id);
    }

    const sectionShots = validShots(responseShots).filter((shot) => shot.sectionId === section.id);
    if (sectionShots.length < MIN_SHOTS_PER_SECTION) {
      throw generationError(
        new Error(`Нейросеть вернула меньше двух кадров для части «${section.label || index + 1}»`),
        completed.size,
        orderedSections.length,
        section.id,
      );
    }

    generated = mergeMusicVideoSectionShots(orderedSections, generated, section.id, sectionShots);
    completed = completedMusicVideoSectionIds(orderedSections, generated);
    await onProgress({
      shots: generated,
      section,
      completedSectionIds: [...completed],
      completedCount: completed.size,
      totalCount: orderedSections.length,
    });
  }

  return {
    shots: generated,
    completedSectionIds: [...completed],
    completedCount: completed.size,
    totalCount: orderedSections.length,
  };
}
