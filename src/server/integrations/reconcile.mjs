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

    if (existing?.deleted || (existing && existing.updatedAt >= item.updatedAt)) continue;

    const isFinished = item.duration > 0 && item.progress >= item.duration * 0.85;
    const isRecent = (now - item.updatedAt.getTime()) <= oneMonthMs;
    const episode = Number.isInteger(item.episodeNumber) && item.episodeNumber > 0 ? item.episodeNumber : null;
    const progress = episode ? episode - (isFinished ? 0 : 1) : 0;
    if (!existing && !progress && item.progress <= 0) continue;

    let targetStatus = "watching";
    if (existing?.totalEpisodes > 0 && progress >= existing.totalEpisodes) {
      targetStatus = "completed";
    } else if (isRecent) {
      targetStatus = "watching";
    } else {
      targetStatus = "dropped";
    }

    if (existing) {
      const val = JSON.parse(existing.value);
      const isManualUnstarted = (val.status === "plan_to_watch" || val.status === "on_hold" || val.status === "dropped") && progress === 0;
      const finalStatus = val.status === "completed" || isManualUnstarted || item.progress <= 0 ? val.status : targetStatus;
      const finalProgress = Math.max(val.progress ?? 0, progress);
      const newVal = {
        ...val,
        status: finalStatus,
        progress: finalProgress,
        poster: item.poster || val.poster || null,
      };
      if (JSON.stringify(newVal) !== existing.value) {
        await db.trackingEntry.updateMany({
          where: { id: existing.id, version: existing.version, deleted: false },
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
