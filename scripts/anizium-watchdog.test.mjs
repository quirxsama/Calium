import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWatchdog, probeUpstream } from "../src/server/anizium-watchdog.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "calium-watchdog-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let time = 1000;
  let result = "failure";
  let executions = 0;
  const options = {
    directory,
    now: () => time,
    probe: async () => result,
    execute: async () => { executions++; },
  };
  const watchdog = createWatchdog(options);
  return {
    directory, options, watchdog,
    setTime: (value) => { time = value; },
    setResult: (value) => { result = value; },
    executions: () => executions,
    state: async () => JSON.parse(await readFile(join(directory, "state.json"), "utf8")),
  };
}

test("failure spam executes once; fresh probe recovery rearms", async (t) => {
  const f = await fixture(t);
  await Promise.all(Array.from({ length: 20 }, () => f.watchdog.check()));
  for (let i = 0; i < 10; i++) await f.watchdog.check();
  assert.equal(f.executions(), 1);
  assert.equal((await f.state()).status, "waiting");
  f.setResult("success");
  f.setTime(300999);
  await f.watchdog.check();
  assert.equal((await f.state()).status, "ready");
  f.setResult("failure");
  await f.watchdog.check();
  assert.equal(f.executions(), 2);
});

for (const time of [301000, 301001, 900000]) {
  test(`HTTP 200 at ${time} locks permanently`, async (t) => {
    const f = await fixture(t);
    await f.watchdog.check();
    f.setTime(time);
    f.setResult("success");
    await f.watchdog.check();
    assert.equal((await f.state()).status, "locked");
    f.setResult("failure");
    await f.watchdog.check();
    f.setResult("success");
    await f.watchdog.check();
    assert.equal((await f.state()).status, "locked");
    assert.equal(f.executions(), 1);
  });
}

test("restart preserves waiting and expired deadlines", async (t) => {
  const f = await fixture(t);
  await f.watchdog.check();
  const restarted = createWatchdog(f.options);
  await restarted.check();
  assert.equal(f.executions(), 1);
  f.setTime(301000);
  await createWatchdog(f.options).check();
  assert.equal((await f.state()).status, "locked");
});

test("probe started before deadline but completed at deadline cannot rearm", async (t) => {
  const f = await fixture(t);
  await f.watchdog.check();
  f.setTime(300999);
  const restarted = createWatchdog({ ...f.options, probe: async () => {
    f.setTime(301000);
    return "success";
  } });
  await restarted.check();
  assert.equal((await f.state()).status, "locked");
  assert.equal(f.executions(), 1);
});

test("independent instances share atomic execution guard", async (t) => {
  const f = await fixture(t);
  await Promise.all([f.watchdog.check(), createWatchdog(f.options).check()]);
  await createWatchdog(f.options).check();
  assert.equal(f.executions(), 1);
});

test("corruption and crash lock fail closed", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.directory, "state.json"), "broken");
  await f.watchdog.check();
  assert.equal(f.executions(), 0);
  assert.equal((await f.state()).status, "locked");
  await mkdir(join(f.directory, "lock"));
  await createWatchdog(f.options).check();
  assert.equal(f.executions(), 0);
});

test("configuration/expected responses never execute; stopped watchdog stays stopped", async (t) => {
  const f = await fixture(t);
  f.setResult("ignore");
  await f.watchdog.check();
  assert.equal(f.executions(), 0);
  f.watchdog.stop();
  f.setResult("failure");
  await f.watchdog.check();
  assert.equal(f.executions(), 0);
});

test("probe bypasses cache, recognizes proxy auth and upstream rejection", async () => {
  const env = { ANIZIUM_WORKER_URL: "https://worker.invalid" };
  for (const [status, error, expected] of [
    [200, "", "success"], [400, "", "ignore"], [404, "", "ignore"],
    [401, "Unauthorized", "ignore"], [403, "Forbidden", "ignore"],
    [403, "HTTP 403", "failure"], [502, "fetch failed", "failure"],
    [500, "missing credentials", "ignore"],
  ]) {
    const result = await probeUpstream(env, undefined, async (url, options) => {
      assert.equal(new URL(url).pathname, "/page/calendar");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers["cache-control"], "no-cache, no-store");
      return new Response(JSON.stringify({ error }), { status });
    });
    assert.equal(result, expected);
  }
  assert.equal(await probeUpstream({}, undefined, () => assert.fail("missing credentials")), "ignore");
  assert.equal(await probeUpstream(env, undefined, async () => { throw new TypeError("fetch failed"); }), "failure");
});
