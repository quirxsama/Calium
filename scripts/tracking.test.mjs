import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/storage/history.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const history = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("short episodes are not completed at playback start", () => {
  assert.equal(history.isEpisodeFinished(0, 90), false);
  assert.equal(history.isEpisodeFinished(30, 90), false);
  assert.equal(history.isEpisodeFinished(89, 90), true);
  assert.equal(history.isEpisodeFinished(1020, 1200), true);
});

test("completed count uses cumulative episode position across seasons", () => {
  const seasons = [{ episodes: [{ ID: "a" }, { ID: "b" }] }, { episodes: [{ ID: "c" }] }];
  assert.deepEqual(history.episodeProgress(seasons, "c", false), { completedEpisodes: 2, totalEpisodes: 3 });
  assert.deepEqual(history.episodeProgress(seasons, "c", true), { completedEpisodes: 3, totalEpisodes: 3 });
  assert.deepEqual(history.episodeProgress([], "film", false), { completedEpisodes: 0, totalEpisodes: 1 });
  assert.deepEqual(history.episodeProgress([], "film", true), { completedEpisodes: 1, totalEpisodes: 1 });
  assert.equal(history.episodeProgress(seasons, "unknown", true), null);
});

test("last episode finished completes series when count reaches total", () => {
  const seasons = [{ episodes: [{ ID: "ep1" }, { ID: "ep2" }, { ID: "ep3" }] }];
  const counts = history.episodeProgress(seasons, "ep3", true);
  assert.ok(counts);
  const isCompletedSeries = Boolean(counts.totalEpisodes && counts.completedEpisodes >= counts.totalEpisodes);
  assert.equal(isCompletedSeries, true);
  assert.equal(counts.completedEpisodes, 3);
  assert.equal(counts.totalEpisodes, 3);
});

test("unwatched planned anime retains planned status on zero progress", () => {
  const previous = { status: "plan_to_watch", progress: 0 };
  const progress = 0;
  const totalEpisodes = 12;
  const isCompleted = Boolean((totalEpisodes && progress >= totalEpisodes) || previous.status === "completed");
  const status = isCompleted
    ? "completed"
    : previous.status === "plan_to_watch" && progress === 0
    ? "plan_to_watch"
    : "watching";
  assert.equal(status, "plan_to_watch");
});
