import test from "node:test";
import assert from "node:assert/strict";
import {
  completedMusicVideoSectionIds,
  generateMusicVideoPlanSections,
  musicVideoPlanSignature,
} from "../src/lib/musicVideoPlan.js";

const sections = [
  { id: "S1", label: "Интро", start: 0, end: 8, energy: "LOW" },
  { id: "S2", label: "Куплет", start: 8, end: 24, energy: "MEDIUM" },
  { id: "S3", label: "Припев", start: 24, end: 40, energy: "HIGH" },
];

function shotsFor(section, marker = section.id) {
  return [
    { id: "MV_SHOT_001", sectionId: section.id, visual: `${marker}-a` },
    { id: "MV_SHOT_002", sectionId: section.id, visual: `${marker}-b` },
  ];
}

test("music video plan signature changes when a creative input changes", () => {
  const input = { selectedConceptId: "C1", sections, settings: { format: "16:9" }, lyrics: "Строка" };
  assert.equal(musicVideoPlanSignature(input), musicVideoPlanSignature({ ...input }));
  assert.notEqual(musicVideoPlanSignature(input), musicVideoPlanSignature({ ...input, lyrics: "Другая строка" }));
  assert.notEqual(musicVideoPlanSignature(input), musicVideoPlanSignature({ ...input, selectedConceptId: "C2" }));
});

test("music video plan requests and saves one section at a time", async () => {
  const calls = [];
  const snapshots = [];
  const result = await generateMusicVideoPlanSections({
    sections,
    requestSection: async ({ section, allSections }) => {
      calls.push({ sectionIds: [section.id], allSectionIds: allSections.map((item) => item.id) });
      return shotsFor(section);
    },
    onProgress: ({ shots, completedCount }) => snapshots.push({ shots: structuredClone(shots), completedCount }),
  });

  assert.deepEqual(calls.map((call) => call.sectionIds), [["S1"], ["S2"], ["S3"]]);
  calls.forEach((call) => assert.deepEqual(call.allSectionIds, ["S1", "S2", "S3"]));
  assert.deepEqual(snapshots.map((snapshot) => snapshot.completedCount), [1, 2, 3]);
  assert.deepEqual(snapshots.map((snapshot) => snapshot.shots.length), [2, 4, 6]);
  assert.equal(new Set(result.shots.map((shot) => shot.id)).size, result.shots.length);
  assert.deepEqual(result.shots.map((shot) => shot.id), [
    "MV_SHOT_001", "MV_SHOT_002", "MV_SHOT_003", "MV_SHOT_004", "MV_SHOT_005", "MV_SHOT_006",
  ]);
});

test("failed generation keeps paid progress and retry skips completed sections", async () => {
  let savedShots = [];
  await assert.rejects(
    generateMusicVideoPlanSections({
      sections,
      requestSection: async ({ section }) => {
        if (section.id === "S2") throw new Error("временный сбой");
        return shotsFor(section, "first-run");
      },
      onProgress: ({ shots }) => { savedShots = structuredClone(shots); },
    }),
    (error) => {
      assert.equal(error.savedSectionCount, 1);
      assert.equal(error.totalSectionCount, 3);
      assert.equal(error.failedSectionId, "S2");
      assert.match(error.message, /временный сбой/);
      return true;
    },
  );

  assert.equal(savedShots.length, 2);
  assert.equal(completedMusicVideoSectionIds(sections, savedShots).has("S1"), true);

  const retryCalls = [];
  const result = await generateMusicVideoPlanSections({
    sections,
    existingShots: savedShots,
    resume: true,
    requestSection: async ({ section }) => {
      retryCalls.push(section.id);
      return shotsFor(section, "retry");
    },
  });

  assert.deepEqual(retryCalls, ["S2", "S3"]);
  assert.deepEqual(result.shots.slice(0, 2).map((shot) => shot.visual), ["first-run-a", "first-run-b"]);
  assert.equal(new Set(result.shots.map((shot) => shot.id)).size, result.shots.length);
  assert.equal(result.completedCount, 3);
});

test("fresh regeneration ignores an outdated partial plan and rejects incomplete sections", async () => {
  const calls = [];
  const oldShots = shotsFor(sections[0], "old");
  const result = await generateMusicVideoPlanSections({
    sections,
    existingShots: oldShots,
    resume: false,
    requestSection: async ({ section }) => {
      calls.push(section.id);
      return shotsFor(section, "new");
    },
  });
  assert.deepEqual(calls, ["S1", "S2", "S3"]);
  assert.equal(result.shots[0].visual, "new-a");

  await assert.rejects(
    generateMusicVideoPlanSections({
      sections: [sections[0]],
      requestSection: async ({ section }) => shotsFor(section).slice(0, 1),
    }),
    (error) => error.savedSectionCount === 0 && /меньше двух кадров/.test(error.message),
  );
});
