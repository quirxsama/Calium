import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { runInNewContext } from "node:vm";
import { once } from "node:events";
import http from "node:http";
import ts from "typescript";
import { NextRequest } from "next/server.js";

const require = createRequire(import.meta.url);
const video = "https://x.aniziumserver.site/220542/3/5/2160p.original.mp4";
const proxiedVideo = "/api/anizium/asset?url=https%3A%2F%2Fx.aniziumserver.site%2F220542%2F3%2F5%2F2160p.original.mp4";
const videoHosts = ["p.aniziumserver.sbs", "a.aniziumserver.sbs", "a.aniziumserver.site", "x.aniziumserver.site", "next.aniziumserver.sbs", "next.aniziumserver.site", "aniziumserver.sbs", "aniziumserver.site"];
const untrustedVideos = ["https://x.aniziumserver.site.evil.test/a.mp4", "https://evilaniziumserver.site/a.mp4", "https://evilaniziumserver.sbs/a.mp4", "https://aniziumserver.site@evil.test/a.mp4", "https://p.aniziumserver.sbs.evil.test/a.mp4", "https://evil.test/a.mp4", "http://127.0.0.1/a.mp4", "ftp://p.aniziumserver.sbs/a.mp4"];

function load(file, overrides = {}, globals = {}) {
  const filename = resolve(file);
  const compiled = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    module: compiled, exports: compiled.exports, URL, Headers, Response, AbortController,
    setTimeout, clearTimeout, console, process, fetch,
    require: (name) => {
      if (name in overrides) return overrides[name];
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, overrides, globals);
      if (name.startsWith(".")) return load(resolve(dirname(filename), `${name}.ts`), overrides, globals);
      return require(name);
    },
    ...globals,
  }, { filename });
  return compiled.exports;
}

test("video CDN is proxied without widening the host boundary or double wrapping", () => {
  const assets = load("src/lib/anizium/asset-proxy.ts");
  assert.equal(assets.toAniziumAssetProxyUrl(video), proxiedVideo);
  assert.equal(assets.toAniziumAssetProxyUrl(proxiedVideo), proxiedVideo);
  for (const host of videoHosts) {
    const url = `https://${host}/36243/1/1/480p.original.mp4`;
    assert.equal(assets.toAniziumAssetProxyUrl(url), `/api/anizium/asset?url=${encodeURIComponent(url)}`);
    assert.equal(assets.isAniziumAssetUrl(`https://${host}.evil.test/a.mp4`), false);
  }
  for (const url of untrustedVideos) {
    assert.equal(assets.isAniziumAssetUrl(url), false);
  }
});

for (const videoOrigin of [undefined, "https://video.calium.fun"]) {
  test(`episode API proxies MP4 through ${videoOrigin ?? "same origin"} while preserving other sources and metadata`, async () => {
    const raw = {
      groups: [{ name: "Original", items: [{ link: video, quality: 2160, type: "video/mp4" }] },
        { name: "Other", items: [{ link: "https://x.anizium.co/master.m3u8" }, { link: "https://other.test/video.mp4" }] }],
      subtitles: [], content: { name: "Episode", opening: { start: "00:30" } },
    };
    const route = load("src/app/api/anizium/episode/route.ts", {
      "./client": { aniziumFetch: async () => raw },
    }, { process: { env: { ANIZIUM_VIDEO_ORIGIN: videoOrigin } } });
    const response = await route.GET(new NextRequest("http://localhost/api/anizium/episode?animeId=test&season=1&episode=4"));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data.groups[0].items[0], { link: videoOrigin ? `${videoOrigin}${proxiedVideo}` : proxiedVideo, quality: 2160, type: "video/mp4" });
    assert.deepEqual(data.groups[1].items.map((item) => item.link), raw.groups[1].items.map((item) => item.link));
    assert.deepEqual(data.content, raw.content);
    assert.equal(raw.groups[0].items[0].link, video);
  });
}

test("asset API preserves partial video bodies and headers, rejects untrusted hosts and forwards cancellation", async () => {
  let calls = 0;
  const controller = new AbortController();
  const route = load("src/app/api/anizium/asset/route.ts", {
    "@/lib/anizium/client": { aniziumAssetFetch: async (url, options) => {
      calls++;
      assert.equal(url, video);
      assert.equal(options.headers.range, "bytes=0-3");
      assert.equal(options.signal, controller.signal);
      return new Response("test", { status: 206, headers: { "content-type": "video/mp4", "content-length": "4", "content-range": "bytes 0-3/100", "accept-ranges": "bytes" } });
    } },
  });
  const response = await route.GET({ nextUrl: new URL(`http://localhost${proxiedVideo}`), headers: new Headers({ range: "bytes=0-3" }), signal: controller.signal });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 0-3/100");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(await response.text(), "test");
  const rejected = await route.GET({ nextUrl: new URL("http://localhost/api/anizium/asset?url=http://127.0.0.1/") });
  assert.equal(rejected.status, 400);
  assert.equal(calls, 1);
});

for (const host of videoHosts) {
  test(`standalone proxy streams ${host} ranges with official referer and stops upstream on disconnect`, async (t) => {
    const video = `https://${host}/36243/1/1/480p.original.mp4`;
    let server;
    let upstreamSignal;
    load("scripts/anizium-proxy.mjs", {
      http: { createServer: (...args) => (server = http.createServer(...args)) },
    }, {
      process: { env: { PORT: "0", PROXY_API_KEY: "test-key", ANIZIUM_CF_CONTROL: "test", ANIZIUM_USER_SESSION: "test" } },
      fetch: async (url, options) => {
        assert.equal(String(url), video);
        assert.equal(options.headers.referer, "https://x.anizium.co/");
        assert.equal(options.headers.range, "bytes=0-3");
        upstreamSignal = options.signal;
        return new Response("test", { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 0-3/100", "content-length": "4" } });
      },
    });
    t.after(() => { server.closeAllConnections(); server.close(); });
    await once(server, "listening");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/__asset?url=${encodeURIComponent(video)}`, { headers: { "x-proxy-key": "test-key", range: "bytes=0-3" } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 0-3/100");
    assert.equal(await response.text(), "test");
    assert.equal(upstreamSignal.aborted, true);
    for (const url of untrustedVideos) {
      const rejected = await fetch(`http://127.0.0.1:${server.address().port}/__asset?url=${encodeURIComponent(url)}`, { headers: { "x-proxy-key": "test-key" } });
      assert.equal(rejected.status, 400);
      await rejected.text();
    }
  });
}
