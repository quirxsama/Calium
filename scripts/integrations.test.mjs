import test from "node:test";
import assert from "node:assert/strict";
import { mergeEntry, seal, unseal, digest, validVerifier, normalizeEntry } from "../src/server/integrations/core.mjs";
import { reconcileHistoryToLibrary } from "../src/server/integrations/reconcile.mjs";
import { runOne, autoDropInactive } from "../src/server/integrations/worker.mjs";
import { writeEntry } from "../src/server/integrations/providers.mjs";

const value = (changes = {}) => normalizeEntry({ status: "watching", ...changes });

test("three-way merge preserves independent edits and reports divergent fields", () => {
  const base = value({ progress: 1, score: 50 });
  assert.deepEqual(mergeEntry(base, { ...base, progress: 2 }, { ...base, score: 70 }), { value: { ...base, progress: 2, score: 70 }, conflicts: [] });
  assert.deepEqual(mergeEntry(base, { ...base, progress: 2 }, { ...base, progress: 3 }).conflicts, ["progress"]);
  assert.equal(mergeEntry(base, base, null).deletion, true);
  assert.equal(mergeEntry(null, base, null).deletion, undefined);
  assert.deepEqual(mergeEntry(null, value({ status: "plan_to_watch" }), base).conflicts, ["status", "progress", "score"]);
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
  assert.equal(normalizeEntry({ status: "plan_to_watch", progress: 12, totalEpisodes: 12 }).status, "plan_to_watch");
});

async function reconcile(history, existing = null) {
  const writes = [];
  await reconcileHistoryToLibrary("user", {
    historyItem: { findMany: async () => [{ animeId: "anime", animeName: "Anime", updatedAt: new Date(), episodeNumber: 5, progress: 0, duration: 1200, ...history }] },
    trackingEntry: {
      findFirst: async () => existing,
      create: async ({ data }) => writes.push(data),
      updateMany: async ({ where, data }) => { assert.equal(where.version, existing.version); writes.push(data); return { count: 1 }; },
    },
  });
  return writes.map((data) => JSON.parse(data.value));
}

test("stale history preserves all newer manual statuses and deleted entries", async () => {
  for (const status of ["plan_to_watch", "on_hold", "dropped", "watching", "completed"]) {
    assert.deepEqual(await reconcile({ updatedAt: new Date(1000), progress: 1200 }, { id: "entry", updatedAt: new Date(2000), version: 2, value: JSON.stringify(value({ status })) }), []);
  }
  assert.deepEqual(await reconcile({}, { deleted: true }), []);
});

test("history counts completed episodes, not zero-second or partial next episode", async () => {
  assert.equal((await reconcile({}))[0].progress, 4);
  assert.equal((await reconcile({ progress: 100 }))[0].progress, 4);
  assert.equal((await reconcile({ progress: 1100 }))[0].progress, 5);
  assert.deepEqual(await reconcile({ episodeNumber: 1 }), []);
  assert.equal((await reconcile({ episodeNumber: null, progress: 1100 }))[0].progress, 0);
});

test("history completion requires known total, not pendingNext", async () => {
  assert.equal((await reconcile({ pendingNext: true, progress: 1200 }))[0].status, "watching");
  const existing = { id: "entry", version: 1, updatedAt: new Date(0), totalEpisodes: 5, value: JSON.stringify(value()) };
  assert.equal((await reconcile({ progress: 1200 }, existing))[0].status, "completed");
  assert.equal((await reconcile({ progress: 100 }, existing))[0].status, "watching");
  assert.equal((await reconcile({ updatedAt: new Date(1000), progress: 100 }))[0].status, "dropped");
});

test("auto-drop executes only for inactive watching entries without completed totals", async () => {
  const writes = [];
  await autoDropInactive({
    trackingEntry: {
      findMany: async () => [
        { id: "watching", userId: "user", totalEpisodes: 12, value: JSON.stringify(value({ progress: 3 })) },
        { id: "complete", totalEpisodes: 12, value: JSON.stringify(value({ progress: 12 })) },
        { id: "planned", value: JSON.stringify(value({ status: "plan_to_watch" })) },
      ],
      update: async ({ data }) => writes.push(JSON.parse(data.value)),
    },
    integration: { updateMany: async () => ({ count: 1 }) },
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, "dropped");
});

test("MAL dates do not prevent status/progress writes", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.body.get("status"), "plan_to_watch");
    assert.equal(options.body.get("num_watched_episodes"), "0");
    assert.equal(options.body.has("start_date"), false);
    return Response.json({ status: "plan_to_watch", score: 0, num_episodes_watched: 0, is_rewatching: false });
  });
  const result = await writeEntry("mal", "token", { malId: 1 }, value({ status: "plan_to_watch", startedAt: "2020-01-01" }));
  assert.equal(result.startedAt, "2020-01-01");
});

async function sync(t, local, remote, snapshot = null) {
  const env = { ...process.env };
  Object.assign(process.env, { MAL_CLIENT_ID: "test", MAL_CLIENT_SECRET: "test", OAUTH_PUBLIC_ORIGIN: "https://example.test", OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") });
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); });
  const entries = local ? [{ id: "entry", userId: "user", sourceId: "anime", malId: 1, version: 1, deleted: false, title: "Anime", ...local, value: JSON.stringify(local.value) }] : [];
  const candidate = { id: "integration", userId: "user", provider: "mal", providerUserId: "1", expiresAt: new Date(Date.now() + 3600000), credentials: seal(JSON.stringify({ access_token: "test" }), "mal:user"), generation: 0, attempts: 0 };
  const writes = [];
  let state = snapshot;
  let outcome;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    if (options.method === "PATCH") {
      writes.push(options.body);
      return Response.json({ status: options.body.get("status"), score: Number(options.body.get("score")), num_episodes_watched: Number(options.body.get("num_watched_episodes")), is_rewatching: false });
    }
    return Response.json({ data: remote ? [{ node: { id: 1, title: "Anime", num_episodes: 12 }, list_status: { status: remote.status, score: remote.score / 10, num_episodes_watched: remote.progress, num_times_rewatched: remote.repeat, is_rewatching: remote.rewatching, start_date: remote.startedAt, finish_date: remote.completedAt } }] : [] });
  });
  await runOne({
    integration: {
      findFirst: async () => candidate,
      updateMany: async ({ data }) => { if (data.status) outcome = data; return { count: 1 }; },
      findUnique: async () => candidate,
    },
    trackingEntry: {
      findFirst: async () => entries[0] ?? null,
      findMany: async ({ where }) => { assert.equal(where.sourceId, undefined); return entries; },
      create: async ({ data }) => { const entry = { id: "imported", version: 1, deleted: false, sourceId: null, ...data }; entries.push(entry); return entry; },
      update: async ({ data }) => Object.assign(entries[0], data),
      updateMany: async ({ data }) => { Object.assign(entries[0], data, { version: entries[0].version + 1 }); return { count: 1 }; },
      findUnique: async () => entries[0],
    },
    syncSnapshot: {
      findUnique: async () => state,
      upsert: async ({ create, update }) => { state = state ? { ...state, ...update } : create; },
      update: async ({ data }) => { state = { ...state, ...data }; },
    },
  });
  assert.equal(outcome?.status, "connected", outcome?.error);
  return { entries, state, writes };
}

test("first sync surfaces disagreements instead of fabricating common baseline", async (t) => {
  const result = await sync(t, { value: value({ status: "plan_to_watch" }) }, value({ progress: 5 }));
  assert.deepEqual(JSON.parse(result.state.conflict), ["status", "progress"]);
  assert.equal(result.state.base, undefined);
  assert.equal(result.writes.length, 0);
});

test("remote-only planned entry imported without fabricated source ID", async (t) => {
  const result = await sync(t, null, value({ status: "plan_to_watch" }));
  assert.equal(result.entries[0].sourceId, null);
  assert.equal(JSON.parse(result.entries[0].value).status, "plan_to_watch");
  assert.equal(result.writes.length, 0);
  assert.equal(result.state.conflict, null);
});

test("MAL date-only differences neither conflict nor trigger writes", async (t) => {
  const result = await sync(t, { value: value({ startedAt: "2020-01-01" }) }, value());
  assert.equal(result.state.conflict, null);
  assert.equal(result.writes.length, 0);
  assert.equal(JSON.parse(result.entries[0].value).startedAt, "2020-01-01");
});

test("existing conflict refreshes remote without writing either side", async (t) => {
  const snapshot = { base: JSON.stringify(value()), remote: JSON.stringify(value({ progress: 2 })), conflict: JSON.stringify(["progress"]), version: 3 };
  const result = await sync(t, { value: value({ progress: 1 }) }, value({ progress: 4 }), snapshot);
  assert.equal(JSON.parse(result.state.remote).progress, 4);
  assert.equal(JSON.parse(result.entries[0].value).progress, 1);
  assert.equal(result.state.conflict, snapshot.conflict);
  assert.equal(result.writes.length, 0);
});

test("deleted local entry conflicts instead of silently resurrecting", async (t) => {
  const result = await sync(t, { deleted: true, value: value() }, value());
  assert.deepEqual(JSON.parse(result.state.conflict), ["deletion"]);
  assert.equal(result.entries[0].deleted, true);
  assert.equal(result.writes.length, 0);
});
