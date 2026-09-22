import { randomUUID } from "node:crypto";
import { configuration, fields, mergeEntry, seal, unseal } from "./core.mjs";
import { readList, writeEntry, tokens, bridge, searchProvider, ProviderError } from "./providers.mjs";

const interval = 15 * 60 * 1000;
const leaseMs = 90 * 1000;
const json = (value) => value == null ? null : JSON.stringify(value);
const parse = (value) => value == null ? null : JSON.parse(value);

export async function enqueue(db, userId) {
  await db.integration.updateMany({ where: { userId, status: { not: "reauth_required" } }, data: { nextRunAt: new Date(), generation: { increment: 1 } } });
}
export async function runOne(db, now = new Date()) {
  const candidate = await db.integration.findFirst({ where: { nextRunAt: { lte: now }, status: { notIn: ["reauth_required", "disabled"] }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, orderBy: { nextRunAt: "asc" } });
  if (!candidate) return false;
  const leaseToken = randomUUID();
  const claimed = await db.integration.updateMany({ where: { id: candidate.id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { leaseToken, leaseUntil: new Date(Date.now() + leaseMs) } });
  if (!claimed.count) return false;
  const owned = { id: candidate.id, leaseToken };
  async function heartbeat() {
    const result = await db.integration.updateMany({ where: owned, data: { leaseUntil: new Date(Date.now() + leaseMs) } });
    if (!result.count) throw new ProviderError("lease_lost");
  }
  async function pace() {
    await heartbeat();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    await heartbeat();
  }
  try {
    if (!configuration(candidate.provider).configured) throw new ProviderError("integration_not_configured", 300);
    let credentials = parse(unseal(candidate.credentials, `${candidate.provider}:${candidate.userId}`));
    if (candidate.expiresAt.getTime() <= Date.now() + 60000) {
      if (candidate.provider !== "mal" || !credentials.refresh_token) throw new ProviderError("reauth_required");
      await heartbeat();
      credentials = await tokens("mal", { grant_type: "refresh_token", refresh_token: credentials.refresh_token });
      const saved = await db.integration.updateMany({ where: owned, data: { credentials: seal(json(credentials), `mal:${candidate.userId}`), expiresAt: new Date(Date.now() + credentials.expires_in * 1000) } });
      if (!saved.count) throw new ProviderError("lease_lost");
    }
    const remoteEntries = await readList(candidate.provider, credentials.access_token, candidate.providerUserId, pace);
    const syncFields = candidate.provider === "mal" ? fields.filter((field) => field !== "startedAt" && field !== "completedAt") : fields;
    const same = (left, right) => left && right && syncFields.every((field) => left[field] === right[field]);
    const remoteById = new Map(remoteEntries.map((entry) => [candidate.provider === "mal" ? entry.malId : entry.anilistId, entry]));
    for (const remote of remoteEntries) {
      await heartbeat();
      let entry = await db.trackingEntry.findFirst({
        where: {
          userId: candidate.userId,
          OR: [
            ...(remote.malId ? [{ malId: remote.malId }] : []),
            ...(remote.anilistId ? [{ anilistId: remote.anilistId }] : []),

          ],
        },
      });
      if (!entry) {
        const matches = await db.trackingEntry.findMany({ where: { userId: candidate.userId, deleted: false, title: remote.title, ...(remote.malId ? { malId: null } : {}), ...(remote.anilistId ? { anilistId: null } : {}) } });
        if (matches.length === 1) entry = matches[0];
      }
      if (!entry) {
        entry = await db.trackingEntry.create({ data: { userId: candidate.userId, malId: remote.malId, anilistId: remote.anilistId, title: remote.title, totalEpisodes: remote.totalEpisodes, value: json(remote.value) } });
      }
      if (entry) {
        const data = {};
        if (remote.anilistId && !entry.anilistId) data.anilistId = remote.anilistId;
        if (remote.malId && !entry.malId) data.malId = remote.malId;
        if (Object.keys(data).length) {
          await db.trackingEntry.update({ where: { id: entry.id }, data });
          if (data.anilistId) entry.anilistId = data.anilistId;
          if (data.malId) entry.malId = data.malId;
        }
      }
    }
    const entries = await db.trackingEntry.findMany({ where: { userId: candidate.userId } });
    for (let entry of entries) {
      await heartbeat();
      if (candidate.provider === "anilist" && !entry.anilistId) {
        await pace();
        const found = entry.malId ? await bridge(credentials.access_token, entry.malId) : await searchProvider("anilist", credentials.access_token, entry.title);
        if (found) {
          const anilistId = found.id ?? found.anilistId;
          const malId = found.idMal ?? found.malId;
          entry = await db.trackingEntry.update({
            where: { id: entry.id },
            data: { ...(anilistId ? { anilistId } : {}), ...(malId && !entry.malId ? { malId } : {}) },
          });
        }
      } else if (candidate.provider === "mal" && !entry.malId) {
        await pace();
        const found = await searchProvider("mal", credentials.access_token, entry.title);
        if (found?.malId) {
          entry = await db.trackingEntry.update({ where: { id: entry.id }, data: { malId: found.malId } });
        }
      }
      const providerId = candidate.provider === "mal" ? entry.malId : entry.anilistId;
      if (!providerId) continue;
      const remote = remoteById.get(providerId)?.value ?? null;
      const where = { integrationId_entryId: { integrationId: candidate.id, entryId: entry.id } };
      const snapshot = await db.syncSnapshot.findUnique({ where });
      if (snapshot?.conflict) {
        if (snapshot.remote !== json(remote)) await db.syncSnapshot.update({ where, data: { remote: json(remote), version: { increment: 1 } } });
        continue;
      }
      const local = entry.deleted ? null : parse(entry.value);
      const result = entry.deleted && remote
        ? { value: null, conflicts: ["deletion"] }
        : mergeEntry(parse(snapshot?.base), local, remote, syncFields);
      if (result.conflicts.length) {
        const data = { remote: json(remote), conflict: json(result.conflicts), version: (snapshot?.version ?? 0) + 1 };
        await db.syncSnapshot.upsert({ where, create: { integrationId: candidate.id, entryId: entry.id, ...data }, update: data });
        continue;
      }
      if (!result.value) continue;
      let merged = result.value;
      if (candidate.provider === "mal") merged = { ...merged, score: Math.round(merged.score / 10) * 10 };
      if (json(merged) !== json(local)) {
        const changed = await db.trackingEntry.updateMany({ where: { id: entry.id, version: entry.version }, data: { value: json(merged), version: { increment: 1 } } });
        if (!changed.count) continue;
        entry = { ...entry, value: json(merged), version: entry.version + 1 };
        await enqueue(db, candidate.userId);
      }
      if (!same(merged, remote)) {
        await pace();
        const current = await db.trackingEntry.findUnique({ where: { id: entry.id } });
        if (!current || current.version !== entry.version) continue;
        merged = await writeEntry(candidate.provider, credentials.access_token, entry, merged);
      }
      await heartbeat();
      const data = { base: json(merged), remote: json(merged), version: entry.version, conflict: null };
      await db.syncSnapshot.upsert({ where, create: { integrationId: candidate.id, entryId: entry.id, ...data }, update: data });
    }
    const current = await db.integration.findUnique({ where: { id: candidate.id } });
    await db.integration.updateMany({ where: owned, data: { leaseToken: null, leaseUntil: null, status: "connected", error: null, attempts: 0, lastSyncedAt: new Date(), nextRunAt: new Date(Date.now() + (current?.generation === candidate.generation ? interval : 5000)) } });
  } catch (error) {
    const code = error instanceof ProviderError ? error.message : "sync_failed";
    const delay = Math.max(error instanceof ProviderError ? error.retryAfter * 1000 : 0, Math.min(interval * 4, 30000 * 2 ** Math.min(candidate.attempts, 7)));
    await db.integration.updateMany({ where: owned, data: { leaseToken: null, leaseUntil: null, status: code === "reauth_required" ? code : "retrying", error: code, attempts: { increment: 1 }, nextRunAt: new Date(Date.now() + delay + Math.random() * 5000) } });
  }
  return true;
}
export async function autoDropInactive(db) {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const candidates = await db.trackingEntry.findMany({
    where: {
      deleted: false,
      updatedAt: { lt: oneMonthAgo },
    },
  });
  for (const entry of candidates) {
    const val = parse(entry.value);
    if (!val || val.status !== "watching") continue;
    if (entry.totalEpisodes && val.progress >= entry.totalEpisodes) continue;
    val.status = "dropped";
    await db.trackingEntry.update({
      where: { id: entry.id },
      data: { value: json(val), version: { increment: 1 } },
    });
    await enqueue(db, entry.userId);
  }
}

export function startWorker(db) {
  let running = false;
  let stopped = false;
  let lastAutoDrop = 0;
  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try {
      await db.oAuthTransaction.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3600000) } } });
      if (Date.now() - lastAutoDrop > 3600000) {
        lastAutoDrop = Date.now();
        await autoDropInactive(db);
      }
      await runOne(db);
    } catch (e) {
      if (process.env.DEBUG) console.error("[integrations] worker:", e?.message ?? e);
    } finally { running = false; }
  }, 5000);
  timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
