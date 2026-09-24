import assert from "node:assert/strict";
import { test } from "node:test";
import { selectRandomAnime } from "../src/lib/anizium/random.ts";

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

test("every series and movie slot is reachable with equal weight, including partial last pages", async () => {
  const expected = ["s1", "s2", "s3", "s4", "s5", "m1", "m2", "m3"];
  for (let index = 0; index < expected.length; index++) {
    const { load, calls } = catalog(expected.slice(0, 5), expected.slice(5));
    assert.equal(await selectRandomAnime(load, () => (index + 0.5) / 8), expected[index]);
    assert.ok(calls.length <= 5);
    assert.equal(new Set(calls).size, calls.length);
  }
});

test("empty category works, entirely empty catalog rejects", async () => {
  assert.equal(await selectRandomAnime(catalog([], ["movie"]).load, () => 0), "movie");
  await assert.rejects(selectRandomAnime(catalog([], []).load));
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
