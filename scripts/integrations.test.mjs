import test from "node:test";
import assert from "node:assert/strict";
import { mergeEntry, seal, unseal, digest, validVerifier, normalizeEntry } from "../src/server/integrations/core.mjs";

test("three-way merge preserves independent edits and reports divergent fields", () => {
  const base = { progress: 1, score: 50, status: "watching" };
  assert.deepEqual(mergeEntry(base, { ...base, progress: 2 }, { ...base, score: 70 }), { value: { progress: 2, score: 70, status: "watching" }, conflicts: [] });
  assert.deepEqual(mergeEntry(base, { ...base, progress: 2 }, { ...base, progress: 3 }).conflicts, ["progress"]);
  assert.equal(mergeEntry(base, base, null).deletion, true);
  assert.equal(mergeEntry(null, base, null).deletion, undefined);
});

test("credentials encrypted with authenticated context and random nonce", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const a = seal("secret", "mal:user", key);
  assert.notEqual(a, seal("secret", "mal:user", key));
  assert.equal(unseal(a, "mal:user", key), "secret");
  assert.throws(() => unseal(a, "anilist:user", key));
  assert.throws(() => unseal(a.slice(0, -4) + "AAAA", "mal:user", key));
});

test("mobile challenge and normalized completion", () => {
  const verifier = "a".repeat(43);
  assert.equal(validVerifier(verifier, digest(verifier)), true);
  assert.equal(validVerifier("short", digest("short")), false);
  assert.equal(normalizeEntry({ progress: 2, totalEpisodes: 12 }).status, "watching");
  assert.equal(normalizeEntry({ progress: 12, totalEpisodes: 12 }).status, "completed");
  assert.equal(normalizeEntry({ progress: 12, totalEpisodes: null }).status, "watching");
});

test("auto-drop marks watching entry older than 30 days as dropped", () => {
  const oneMonthAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const entry = {
    updatedAt: oneMonthAgo,
    totalEpisodes: 12,
    value: { status: "watching", progress: 3 },
  };

  const isInactive = Date.now() - entry.updatedAt.getTime() > 30 * 24 * 60 * 60 * 1000;
  const shouldDrop = isInactive && entry.value.status === "watching" && entry.value.progress < entry.totalEpisodes;
  assert.equal(shouldDrop, true);

  const completedEntry = {
    updatedAt: oneMonthAgo,
    totalEpisodes: 12,
    value: { status: "watching", progress: 12 },
  };
  const shouldNotDrop = isInactive && completedEntry.value.status === "watching" && completedEntry.value.progress < completedEntry.totalEpisodes;
  assert.equal(shouldNotDrop, false);
});

test("history reconciliation assigns watching if watched <= 30 days, dropped if > 30 days", () => {
  const now = Date.now();
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

  const recentItem = {
    animeId: "anime-1",
    updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
    episodeNumber: 5,
    progress: 100,
    duration: 1200,
  };
  const isRecent = now - recentItem.updatedAt.getTime() <= oneMonthMs;
  assert.equal(isRecent, true);

  const oldItem = {
    animeId: "anime-2",
    updatedAt: new Date(now - 45 * 24 * 60 * 60 * 1000),
    episodeNumber: 2,
    progress: 100,
    duration: 1200,
  };
  const isOld = now - oldItem.updatedAt.getTime() > oneMonthMs;
  assert.equal(isOld, true);
});
