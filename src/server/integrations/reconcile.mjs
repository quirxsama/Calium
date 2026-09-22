export async function reconcileHistoryToLibrary(userId, db) {
  const historyItems = await db.historyItem.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (!historyItems.length) return;

  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const item of historyItems) {
    const existing = await db.trackingEntry.findFirst({
      where: { userId, sourceId: item.animeId },
    });

    const isFinished = item.duration > 0 && item.progress >= item.duration * 0.85;
    const isRecent = (now - item.updatedAt.getTime()) <= oneMonthMs;
    const progress = item.episodeNumber && item.episodeNumber > 0 ? item.episodeNumber : 1;

    let targetStatus = "watching";
    if ((isFinished && existing?.totalEpisodes && progress >= existing.totalEpisodes) || item.pendingNext) {
      targetStatus = "completed";
    } else if (isRecent) {
      targetStatus = "watching";
    } else {
      targetStatus = "dropped";
    }

    if (existing) {
      const val = JSON.parse(existing.value);
      const finalStatus = val.status === "completed" ? "completed" : targetStatus;
      const finalProgress = Math.max(val.progress ?? 0, progress);
      const newVal = {
        ...val,
        status: finalStatus,
        progress: finalProgress,
        poster: item.poster || val.poster || null,
      };
      if (JSON.stringify(newVal) !== existing.value) {
        await db.trackingEntry.update({
          where: { id: existing.id },
          data: {
            title: item.animeName,
            value: JSON.stringify(newVal),
            version: { increment: 1 },
          },
        });
      }
    } else {
      const val = {
        status: targetStatus,
        progress,
        score: 0,
        repeat: 0,
        rewatching: false,
        startedAt: item.updatedAt.toISOString().split("T")[0],
        completedAt: targetStatus === "completed" ? item.updatedAt.toISOString().split("T")[0] : null,
        poster: item.poster ?? null,
      };
      await db.trackingEntry.create({
        data: {
          userId,
          sourceId: item.animeId,
          title: item.animeName,
          totalEpisodes: null,
          mapping: "calium",
          value: JSON.stringify(val),
        },
      });
    }
  }
}
