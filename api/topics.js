import suggest from "./_lib/topic-suggest.js";
import analyze from "./_lib/topic-analyze.js";
import audience from "./_lib/topic-audience.js";
import discoverChannels from "./_lib/topic-channels.js";

export default function handler(req, res) {
  if (req.query?.action === "suggest") return suggest(req, res);
  if (req.query?.action === "analyze") return analyze(req, res);
  if (req.query?.action === "audience") return audience(req, res);
  if (req.query?.action === "discover-channels") return discoverChannels(req, res);
  res.status(404).json({ error: "Неизвестное действие модуля тем" });
}
