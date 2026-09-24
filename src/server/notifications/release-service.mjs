export async function processLatestEpisodes(db, latestItems, { notifyUser } = {}) {
  if (!Array.isArray(latestItems) || latestItems.length === 0) {
    return { newEpisodes: 0, notifications: 0, baseline: false };
  }

  const existingCount = await db.releasedEpisode.count();
  if (existingCount === 0) {
    for (const item of latestItems) {
      const animeId = String(item.ID);
      const seasonNumber = Number(item.season ?? 1) || 1;
      const episodeNumber = Number(item.episode ?? 1) || 1;
      try {
        await db.releasedEpisode.create({
          data: {
            animeId,
            seasonNumber,
            episodeNumber,
            title: item.name || null,
          },
        });
      } catch {}
    }
    return { newEpisodes: latestItems.length, notifications: 0, baseline: true };
  }

  let newEpisodes = 0;
  let notifications = 0;

  for (const item of latestItems) {
    const animeId = String(item.ID);
    const seasonNumber = Number(item.season ?? 1) || 1;
    const episodeNumber = Number(item.episode ?? 1) || 1;

    const existing = await db.releasedEpisode.findUnique({
      where: {
        animeId_seasonNumber_episodeNumber: {
          animeId,
          seasonNumber,
          episodeNumber,
        },
      },
    });

    if (existing) continue;

    try {
      await db.releasedEpisode.create({
        data: {
          animeId,
          seasonNumber,
          episodeNumber,
          title: item.name || null,
        },
      });
      newEpisodes++;
    } catch {
      continue;
    }

    const favorites = await db.favorite.findMany({
      where: { animeId },
      include: {
        user: {
          select: { id: true, dndEnabled: true },
        },
      },
    });

    for (const fav of favorites) {
      if (!fav.user || fav.user.dndEnabled) continue;

      if (typeof notifyUser === "function") {
        try {
          await notifyUser(fav.userId, "new_episode", {
            animeId,
            animeTitle: item.name,
            seasonNumber,
            episodeNumber,
            poster: item.poster || null,
          });
          notifications++;
        } catch (err) {
          if (process.env.DEBUG) {
            console.error("[release-service] notify error:", err);
          }
        }
      }
    }
  }

  return { newEpisodes, notifications, baseline: false };
}
