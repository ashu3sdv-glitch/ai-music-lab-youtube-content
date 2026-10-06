function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function objectArray(value) {
  return array(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

export function normalizeObjectState(value) {
  return object(value);
}

export function normalizeSavedTopicsState(value) {
  return objectArray(value).map((item) => ({
    ...item,
    evidence: objectArray(item.evidence),
    topVideos: objectArray(item.topVideos),
  }));
}

export function normalizeTopicsState(value) {
  const state = object(value);
  return {
    ...state,
    results: objectArray(state.results),
    audienceTopics: objectArray(state.audienceTopics).map((item) => ({
      ...item,
      evidence: objectArray(item.evidence),
    })),
    audienceMeta: state.audienceMeta == null ? null : {
      ...object(state.audienceMeta),
      channels: objectArray(state.audienceMeta?.channels),
      skippedChannels: objectArray(state.audienceMeta?.skippedChannels),
    },
  };
}

export function normalizeWeekPlanState(value) {
  const state = object(value);
  if (!Array.isArray(state.weeks)) return state;
  return {
    ...state,
    weeks: objectArray(state.weeks).map((week) => ({
      ...week,
      items: objectArray(week.items),
      images: array(week.images),
    })),
  };
}

export function normalizeLinkedInState(value) {
  const state = object(value);
  const research = object(state.research);
  return {
    ...state,
    materials: objectArray(state.materials),
    plan: objectArray(state.plan),
    research: {
      ...research,
      candidates: objectArray(research.candidates),
      selected: array(research.selected),
      topics: objectArray(research.topics).map((item) => ({
        ...item,
        evidence: objectArray(item.evidence),
      })),
      channelLanguages: object(research.channelLanguages),
      buildReports: objectArray(research.buildReports),
      meta: research.meta == null ? null : {
        ...object(research.meta),
        channels: objectArray(research.meta?.channels),
        skippedChannels: objectArray(research.meta?.skippedChannels),
      },
    },
  };
}
