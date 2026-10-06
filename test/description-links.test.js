import test from "node:test";
import assert from "node:assert/strict";
import { withDescriptionLinks } from "../src/lib/descriptionLinks.js";

const links = [
  { id: "boosty", name: "Boosty", url: "https://boosty.example/me" },
  { id: "donate", name: "Донаты", url: "https://donate.example/me" },
];

test("adds only selected settings links to a Shorts description", () => {
  const result = withDescriptionLinks("Описание\n#shorts", links, ["boosty"]);
  assert.match(result, /Boosty: https:\/\/boosty\.example\/me/);
  assert.doesNotMatch(result, /donate\.example/);
});

test("adds every settings link when Shorts uses automatic links", () => {
  const result = withDescriptionLinks("Описание", links, links.map((link) => link.id));
  assert.match(result, /boosty\.example/);
  assert.match(result, /donate\.example/);
});

test("does not duplicate links after regeneration", () => {
  const once = withDescriptionLinks("Описание", links, ["boosty", "donate"]);
  const twice = withDescriptionLinks(once, links, ["boosty", "donate"]);
  assert.equal(twice, once);
});

test("removes a link when its checkbox is cleared", () => {
  const both = withDescriptionLinks("Описание", links, ["boosty", "donate"]);
  const boostyOnly = withDescriptionLinks(both, links, ["boosty"]);
  assert.match(boostyOnly, /boosty\.example/);
  assert.doesNotMatch(boostyOnly, /donate\.example/);
});
