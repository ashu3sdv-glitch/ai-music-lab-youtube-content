export function channelFilter(value) {
  const raw = value.trim();
  const id = raw.match(/(?:channel\/)?(UC[\w-]{20,})/i)?.[1];
  if (id) return { id };
  const handle = raw.match(/@([\w.-]+)/)?.[1] || raw.replace(/^@/, "");
  return { forHandle: handle };
}

export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  );
  return results;
}

export function topicMatchScore(video, query) {
  const words = String(query || "")
    .toLocaleLowerCase("ru")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
  if (!words.length) return 0;
  const title = String(video?.title || "").toLocaleLowerCase("ru");
  const description = String(video?.description || "").toLocaleLowerCase("ru");
  return words.reduce((score, word) => (
    score + (title.includes(word) ? 3 : 0) + (description.includes(word) ? 1 : 0)
  ), 0);
}
