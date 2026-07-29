export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Только GET" });
    return;
  }

  const seed = String(req.query?.q || "").trim();
  if (!seed) {
    res.status(400).json({ seed, suggestions: [], error: "Не указан q" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url =
      "https://suggestqueries.google.com/complete/search" +
      `?client=firefox&ds=yt&hl=ru&ie=utf-8&oe=utf-8&q=${encodeURIComponent(seed)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`suggest ${response.status}`);
    const data = await response.json();
    const suggestions = Array.isArray(data?.[1])
      ? data[1].filter((value) => typeof value === "string")
      : [];
    res.status(200).json({ seed, suggestions });
  } catch (error) {
    res.status(200).json({
      seed,
      suggestions: [],
      error: error?.name === "AbortError" ? "timeout" : "unavailable",
    });
  } finally {
    clearTimeout(timer);
  }
}
