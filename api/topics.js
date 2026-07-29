import suggest from "./_lib/topic-suggest.js";
import analyze from "./_lib/topic-analyze.js";

export default function handler(req, res) {
  if (req.query?.action === "suggest") return suggest(req, res);
  if (req.query?.action === "analyze") return analyze(req, res);
  res.status(404).json({ error: "Неизвестное действие модуля тем" });
}
