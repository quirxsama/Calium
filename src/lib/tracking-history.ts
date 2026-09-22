import { prisma } from "@/lib/db";
import { normalizeEntry } from "@/server/integrations/core.mjs";
import { reconcileHistoryToLibrary as reconcileLegacyHistory } from "@/server/integrations/reconcile.mjs";

export async function reconcileHistoryToLibrary(userId: string) {
  await reconcileLegacyHistory(userId, {
    trackingEntry: prisma.trackingEntry,
    historyItem: { findMany: () => prisma.historyItem.findMany({ where: { userId, completedEpisodes: null }, orderBy: { updatedAt: "desc" } }) },
  });
  const history = await prisma.historyItem.findMany({ where: { userId, completedEpisodes: { not: null } } });
  for (const item of history) {
    await prisma.$transaction(async (db) => {
      const existing = await db.trackingEntry.findUnique({ where: { userId_sourceId: { userId, sourceId: item.animeId } } });
      if (existing?.deleted || (existing && existing.updatedAt >= item.updatedAt)) return;
      const previous = existing ? JSON.parse(existing.value) : {};
      const progress = Math.max(previous.progress ?? 0, item.completedEpisodes ?? 0);
      const totalEpisodes = item.totalEpisodes ?? existing?.totalEpisodes ?? null;
      const isCompleted = Boolean((totalEpisodes && progress >= totalEpisodes) || item.pendingNext || previous.status === "completed");
      const status = isCompleted
        ? "completed"
        : previous.status === "plan_to_watch" && progress === 0
        ? "plan_to_watch"
        : previous.status === "on_hold" && progress === 0
        ? "on_hold"
        : previous.status === "dropped" && progress === 0
        ? "dropped"
        : "watching";
      const value = JSON.stringify(normalizeEntry({ ...previous, progress, status, poster: item.poster ?? previous.poster }));
      if (existing) {
        if (value === existing.value && totalEpisodes === existing.totalEpisodes) return;
        await db.trackingEntry.updateMany({ where: { id: existing.id, version: existing.version, deleted: false }, data: { value, totalEpisodes, version: { increment: 1 } } });
      } else {
        await db.trackingEntry.create({ data: { userId, sourceId: item.animeId, title: item.animeName, totalEpisodes, mapping: "calium", value } });
      }
    });
  }
}
