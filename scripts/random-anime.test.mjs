import assert from "node:assert/strict";
import { test } from "node:test";
import { CatalogRequestError, selectRandomAnime } from "../src/lib/anizium/random.ts";

function catalog(series, movie, mutate = (value) => value) {
  const calls = [];
  const load = async (kind, page) => {
    calls.push(`${kind}:${page}`);
    const items = kind === "series" ? series : movie;
    return mutate({
      success: true,
      page: {
        page,
        per_page_items: 2,
        total_pages: Math.ceil(items.length / 2),
        data: items.slice((page - 1) * 2, page * 2).map((ID) => ({ ID })),
      },
    }, kind, page);
  };
  return { load, calls };
}

test("every series slot is reachable with equal weight, including partial last pages, without loading movies", async () => {
  const expected = ["s1", "s2", "s3", "s4", "s5"];
  for (let index = 0; index < expected.length; index++) {
    const { load, calls } = catalog(expected, ["m1", "m2", "m3"]);
    assert.equal(await selectRandomAnime(load, () => (index + 0.5) / expected.length), expected[index]);
    assert.ok(calls.length <= 3);
    assert.ok(calls.every((call) => call.startsWith("series:")));
    assert.equal(new Set(calls).size, calls.length);
  }
});

test("empty series rejects even when movies exist", async () => {
  const { load, calls } = catalog([], ["movie"]);
  await assert.rejects(selectRandomAnime(load), /Katalogda anime dizisi bulunamadı/);
  assert.deepEqual(calls, ["series:1"]);
});

test("single-page series uses one request and accepts draw boundaries", async () => {
  for (const [draw, expected] of [[0, "s1"], [1 - Number.EPSILON, "s2"]]) {
    const { load, calls } = catalog(["s1", "s2"], ["movie"]);
    assert.equal(await selectRandomAnime(load, () => draw), expected);
    assert.deepEqual(calls, ["series:1"]);
  }
});

test("invalid draws reject without fallback", async () => {
  for (const draw of [-1, 1, NaN, Infinity]) {
    await assert.rejects(selectRandomAnime(catalog(["series"], []).load, () => draw), /Geçersiz rastgele seçim/);
  }
});

test("first-roll failures report safe page context without retrying or leaking URLs", async () => {
  const calls = [];
  await assert.rejects(selectRandomAnime(async (kind, page) => {
    calls.push(`${kind}:${page}`);
    throw new Error("https://private.example/catalog?token=secret");
  }), { message: "Dizi kataloğu yüklenemedi (sayfa 1)." });
  assert.deepEqual(calls, ["series:1"]);
  await assert.rejects(selectRandomAnime(async () => ({ success: false })), /Geçersiz katalog bilgisi/);
  await assert.rejects(selectRandomAnime(async () => {
    throw new CatalogRequestError(1, 502);
  }), { message: "Dizi kataloğu yüklenemedi (sayfa 1, HTTP 502)." });
});

test("later page failures identify the page without retrying", async () => {
  for (const failedPage of [2, 3]) {
    const { load, calls } = catalog(["1", "2", "3", "4", "5"], []);
    await assert.rejects(selectRandomAnime(async (kind, page) => {
      const response = await load(kind, page);
      if (page === failedPage) throw new Error("private upstream URL");
      return response;
    }, () => 0.5), { message: `Dizi kataloğu yüklenemedi (sayfa ${failedPage}).` });
    assert.equal(calls.filter((call) => call === `series:${failedPage}`).length, 1);
  }
});

test("failed requests, invalid metadata, shifting pages and invalid IDs never fall back", async () => {
  await assert.rejects(selectRandomAnime(async () => { throw new Error("offline"); }));
  for (const mutate of [
    (value) => ({ ...value, success: false }),
    (value) => ({ ...value, page: { ...value.page, total_pages: -1 } }),
    (value) => ({ ...value, page: { ...value.page, per_page_items: 0 } }),
    (value) => ({ ...value, page: { ...value.page, page: 9 } }),
    (value, kind, page) => page === 3 ? { ...value, page: { ...value.page, total_pages: 4 } } : value,
    (value, kind, page) => page === 2 ? { ...value, page: { ...value.page, data: [] } } : value,
    (value) => ({ ...value, page: { ...value.page, data: [{ ID: "" }] } }),
  ]) {
    await assert.rejects(selectRandomAnime(catalog(["1", "2", "3", "4", "5"], [], mutate).load, () => 0.5));
  }
});
