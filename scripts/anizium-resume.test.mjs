import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { once } from "node:events";
import http from "node:http";
import ts from "typescript";

const require = createRequire(import.meta.url);
const video = "https://x.aniziumserver.site/220542/3/5/2160p.original.mp4";

function load(file, overrides = {}, globals = {}) {
  const filename = resolve(file);
  const compiled = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    module: compiled, exports: compiled.exports, URL, Headers, Response, ReadableStream, AbortController,
    Buffer, setTimeout, clearTimeout, console, process,
    require: (name) => {
      if (name in overrides) return overrides[name];
      if (name.startsWith("./")) return load(resolve(dirname(filename), `${name}.mjs`), overrides, globals);
      return require(name);
    },
    ...globals,
  }, { filename });
  return compiled.exports;
}

test("prod proxy resumes a video range after the upstream closes early", async (t) => {
  const watchDir = mkdtempSync(join(tmpdir(), "anizium-resume-"));
  const calls = [];
  let server;
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), range: options.headers.range });
    if (calls.length === 1) {
      return new Response("abcd", {
        status: 206,
        headers: { "content-type": "video/mp4", "content-range": "bytes 0-9/10", "content-length": "10" },
      });
    }
    return new Response("efghij", {
      status: 206,
      headers: { "content-type": "video/mp4", "content-range": "bytes 4-9/10", "content-length": "6" },
    });
  };
  const env = {
    PORT: "0",
    PROXY_API_KEY: "test-key",
    ANIZIUM_ACCOUNTS: JSON.stringify([{ name: "test", cfControl: "c", userSession: "s", viaWarp: false }]),
    ANIZIUM_WATCH_DIR: watchDir,
  };

  load("scripts/anizium-proxy.prod.mjs", {
    http: { createServer: (...args) => (server = http.createServer(...args)) },
    "node-fetch": { __esModule: true, default: fakeFetch },
    "socks-proxy-agent": { SocksProxyAgent: class {} },
  }, { process: { env } });
  t.after(() => {
    server.closeAllConnections();
    server.close();
    rmSync(watchDir, { recursive: true, force: true });
  });
  await once(server, "listening");

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/__asset?url=${encodeURIComponent(video)}`,
    { headers: { "x-proxy-key": "test-key" } }
  );
  assert.equal(response.status, 206);
  assert.equal(await response.text(), "abcdefghij");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].range, "bytes=0-");
  assert.equal(calls[1].range, "bytes=4-9");

  let audit = "";
  for (let i = 0; i < 20; i++) {
    audit = readFileSync(join(watchDir, "asset.jsonl"), "utf8");
    if (audit.includes('"type":"close"')) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.match(audit, /"type":"reconnect"/);
  assert.match(audit, /"type":"resumed"/);
  assert.match(audit, /"outcome":"ok"/);
  assert.match(audit, /"sent":10/);
});
