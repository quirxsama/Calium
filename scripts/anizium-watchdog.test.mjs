import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWatchdog, probeAll, probeAsset, probeUpstream } from "../src/server/anizium-watchdog.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "calium-watchdog-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let time = 1000;
  let result = "failure";
  let executions = 0;
  let executeError = false;
  const options = {
    directory,
    now: () => time,
    probe: async () => result,
    execute: async () => {
      executions++;
      if (executeError) throw new Error("recovery unavailable");
    },
  };
  const watchdog = createWatchdog(options);
  return {
    directory, options, watchdog,
    setTime: (value) => { time = value; },
    setResult: (value) => { result = value; },
    setExecuteError: (value) => { executeError = value; },
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

test("expired observation window retries instead of locking", async (t) => {
  for (const time of [301000, 301001, 900000]) {
    const f = await fixture(t);
    await f.watchdog.check();
    const first = await f.state();
    assert.equal(first.status, "waiting");
    assert.equal(first.attempts, 1);
    assert.equal(first.deadline, 301000);
    assert.equal(f.executions(), 1);

    f.setTime(time);
    await f.watchdog.check();
    const retried = await f.state();
    assert.equal(retried.status, "waiting");
    assert.equal(retried.attempts, 2);
    assert.equal(retried.deadline, time + 60_000);
    assert.equal(f.executions(), 2);

    f.setResult("success");
    f.setTime(time + 1);
    await f.watchdog.check();
    assert.equal((await f.state()).status, "ready");
    assert.equal(f.executions(), 2);
  }
});

test("success after the observation window recovers without an extra execution", async (t) => {
  const f = await fixture(t);
  await f.watchdog.check();
  f.setTime(301000);
  f.setResult("success");
  await f.watchdog.check();
  assert.equal((await f.state()).status, "ready");
  assert.equal(f.executions(), 1);
});

test("restart preserves waiting and retries after expiry", async (t) => {
  const f = await fixture(t);
  await f.watchdog.check();
  await createWatchdog(f.options).check();
  assert.equal(f.executions(), 1);
  assert.equal((await f.state()).status, "waiting");

  f.setTime(301000);
  await createWatchdog(f.options).check();
  const state = await f.state();
  assert.equal(state.status, "waiting");
  assert.equal(state.attempts, 2);
  assert.equal(f.executions(), 2);
});

test("a probe that completes after the deadline still decides the outcome", async (t) => {
  const success = await fixture(t);
  await success.watchdog.check();
  success.setTime(300999);
  await createWatchdog({ ...success.options, probe: async () => {
    success.setTime(301000);
    return "success";
  } }).check();
  assert.equal((await success.state()).status, "ready");
  assert.equal(success.executions(), 1);

  const failure = await fixture(t);
  await failure.watchdog.check();
  failure.setTime(300999);
  await createWatchdog({ ...failure.options, probe: async () => {
    failure.setTime(301000);
    return "failure";
  } }).check();
  assert.equal((await failure.state()).status, "waiting");
  assert.equal((await failure.state()).attempts, 2);
  assert.equal(failure.executions(), 2);
});

test("a failed recovery command is retried after the observation window", async (t) => {
  const f = await fixture(t);
  f.setExecuteError(true);
  await f.watchdog.check();
  assert.equal((await f.state()).status, "waiting");
  assert.equal(f.executions(), 1);

  f.setExecuteError(false);
  f.setTime(301000);
  await f.watchdog.check();
  assert.equal((await f.state()).status, "waiting");
  assert.equal((await f.state()).attempts, 2);
  assert.equal(f.executions(), 2);
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

test("clock moving backwards resets a waiting state to ready", async (t) => {
  const f = await fixture(t);
  await f.watchdog.check();
  f.setTime(500);
  f.setResult("success");
  await f.watchdog.check();
  assert.equal((await f.state()).status, "ready");
  assert.equal(f.executions(), 1);
});

test("asset probe checks a real range through the worker", async () => {
  const env = {
    ANIZIUM_WORKER_URL: "https://worker.invalid",
    ANIZIUM_PROXY_KEY: "secret",
    ANIZIUM_WATCHDOG_ASSET_URL: "https://p.aniziumserver.site/a.mp4",
  };
  const result = await probeAsset(env, undefined, async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/__asset");
    assert.equal(parsed.searchParams.get("url"), env.ANIZIUM_WATCHDOG_ASSET_URL);
    assert.equal(options.headers.range, "bytes=0-1023");
    assert.equal(options.headers["x-proxy-key"], "secret");
    assert.equal(options.cache, "no-store");
    return new Response(new Uint8Array([1, 2, 3]), { status: 206 });
  });
  assert.equal(result, "success");

  for (const [status, expected] of [[404, "ignore"], [400, "ignore"], [401, "ignore"], [403, "ignore"], [429, "ignore"], [500, "failure"], [502, "failure"]]) {
    const actual = await probeAsset(env, undefined, async () => new Response("{}", { status }));
    assert.equal(actual, expected, `status ${status}`);
  }

  assert.equal(await probeAsset(env, undefined, async () => new Response(null, { status: 200 })), "failure");
  assert.equal(await probeAsset(env, undefined, async () => { throw new TypeError("fetch failed"); }), "failure");
  assert.equal(await probeAsset({ ...env, ANIZIUM_WATCHDOG_ASSET_URL: undefined }, undefined, () => assert.fail("missing asset url")), "ignore");
  assert.equal(await probeAsset({ ...env, ANIZIUM_WORKER_URL: undefined }, undefined, () => assert.fail("missing worker")), "ignore");
});

test("combined probe requires both API and data plane to be healthy", async () => {
  const env = {
    ANIZIUM_WORKER_URL: "https://worker.invalid",
    ANIZIUM_PROXY_KEY: "secret",
    ANIZIUM_WATCHDOG_ASSET_URL: "https://p.aniziumserver.site/a.mp4",
  };
  const fetcher = (calendarStatus, assetStatus) => async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/page/calendar") return new Response("{}", { status: calendarStatus });
    return new Response(new Uint8Array([1]), { status: assetStatus });
  };
  assert.equal(await probeAll(env, undefined, fetcher(200, 206)), "success");
  assert.equal(await probeAll(env, undefined, fetcher(500, 206)), "failure");
  assert.equal(await probeAll(env, undefined, fetcher(200, 502)), "failure");
  assert.equal(await probeAll(env, undefined, fetcher(200, 404)), "success");
  assert.equal(await probeAll({ ...env, ANIZIUM_WATCHDOG_ASSET_URL: undefined }, undefined, fetcher(200, 504)), "success");
  assert.equal(await probeAll({}, undefined, async () => assert.fail("no credentials")), "ignore");
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
