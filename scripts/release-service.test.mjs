import test from "node:test";
import assert from "node:assert/strict";
import { processLatestEpisodes } from "../src/server/notifications/release-service.mjs";

test("baseline run records episodes without sending notifications", async () => {
  const store = {
    released: [],
    favorites: [],
  };

  const mockDb = {
    releasedEpisode: {
      count: async () => store.released.length,
      create: async ({ data }) => {
        store.released.push(data);
        return data;
      },
      findUnique: async ({ where }) => {
        const { animeId, seasonNumber, episodeNumber } = where.animeId_seasonNumber_episodeNumber;
        return store.released.find(
          (r) => r.animeId === animeId && r.seasonNumber === seasonNumber && r.episodeNumber === episodeNumber
        ) || null;
      },
    },
    favorite: {
      findMany: async () => store.favorites,
    },
  };

  const latestItems = [
    { ID: "101", name: "Frieren", season: 1, episode: 1 },
    { ID: "102", name: "Jujutsu Kaisen", season: 2, episode: 10 },
  ];

  const notified = [];
  const result = await processLatestEpisodes(mockDb, latestItems, {
    notifyUser: async (userId, type, payload) => {
      notified.push({ userId, type, payload });
    },
  });

  assert.equal(result.baseline, true);
  assert.equal(result.newEpisodes, 2);
  assert.equal(result.notifications, 0);
  assert.equal(notified.length, 0);
  assert.equal(store.released.length, 2);
});

test("new episode notifies favorited users and respects DND", async () => {
  const store = {
    released: [
      { animeId: "101", seasonNumber: 1, episodeNumber: 1, title: "Frieren" },
    ],
    favorites: [
      { userId: "u1", animeId: "101", user: { id: "u1", dndEnabled: false } },
      { userId: "u2", animeId: "101", user: { id: "u2", dndEnabled: true } },
      { userId: "u3", animeId: "999", user: { id: "u3", dndEnabled: false } },
    ],
  };

  const mockDb = {
    releasedEpisode: {
      count: async () => store.released.length,
      create: async ({ data }) => {
        store.released.push(data);
        return data;
      },
      findUnique: async ({ where }) => {
        const { animeId, seasonNumber, episodeNumber } = where.animeId_seasonNumber_episodeNumber;
        return store.released.find(
          (r) => r.animeId === animeId && r.seasonNumber === seasonNumber && r.episodeNumber === episodeNumber
        ) || null;
      },
    },
    favorite: {
      findMany: async ({ where }) => {
        return store.favorites.filter((f) => f.animeId === where.animeId);
      },
    },
  };

  const notified = [];
  const latestItems = [
    { ID: "101", name: "Frieren", season: 1, episode: 1 }, // Already exists
    { ID: "101", name: "Frieren", season: 1, episode: 2 }, // New!
  ];

  const result = await processLatestEpisodes(mockDb, latestItems, {
    notifyUser: async (userId, type, payload) => {
      notified.push({ userId, type, payload });
    },
  });

  assert.equal(result.baseline, false);
  assert.equal(result.newEpisodes, 1);
  assert.equal(result.notifications, 1);
  assert.equal(notified.length, 1);
  assert.equal(notified[0].userId, "u1");
  assert.equal(notified[0].payload.episodeNumber, 2);
  assert.equal(notified[0].payload.animeTitle, "Frieren");

  // Second run with same data must not re-notify
  const secondNotified = [];
  const secondResult = await processLatestEpisodes(mockDb, latestItems, {
    notifyUser: async (userId, type, payload) => {
      secondNotified.push({ userId, type, payload });
    },
  });

  assert.equal(secondResult.newEpisodes, 0);
  assert.equal(secondResult.notifications, 0);
  assert.equal(secondNotified.length, 0);
});
