import test from "node:test";
import assert from "node:assert/strict";
import { parseOfficialFeed, selectOfficialNews } from "../shared/free-news.js";

test("official RSS is parsed without a third-party library", () => {
  const xml = `<rss><channel><item><title>AI &amp; business launch</title><link>https://example.com/news</link><description><![CDATA[<b>Useful</b> update]]></description><pubDate>Sun, 13 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const items = parseOfficialFeed(xml, "Official");
  assert.deepEqual(items[0], { title: "AI & business launch", source_url: "https://example.com/news", published_at: "Sun, 13 Sep 2026 10:00:00 GMT", summary: "Useful update", source: "Official" });
});

test("official news selection prioritizes the requested focus and removes old items", () => {
  const items = selectOfficialNews([
    { title: "AI marketing platform launch", source_url: "https://one.example/new", published_at: "2026-09-13", summary: "Advertising campaign update", source: "One" },
    { title: "Old marketing item", source_url: "https://one.example/old", published_at: "2025-01-01", summary: "Advertising", source: "One" },
    { title: "General update", source_url: "https://two.example/new", published_at: "2026-09-12", summary: "News", source: "Two" },
  ], "advertising", new Date("2026-09-14T12:00:00Z"));
  assert.equal(items.length, 2);
  assert.equal(items[0].source_url, "https://one.example/new");
  assert.match(items[0].summary, /^One:/);
});
