// Run with: node --test scripts/player-regression.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePlayerPreferences, getPreferredQualityIndex, parseQualityHeight } from "../src/lib/storage/player-preferences.ts";
import { bindSpaceSpeedBoost } from "../src/components/player/space-speed-boost.ts";

const qualities = [{ quality: 1080 }, { quality: 720 }, { quality: 480 }];

test("preferences default to enabled Space hold and migrate numeric quality", () => {
  assert.equal(normalizePlayerPreferences({}).holdSpaceToSpeedUp, true);
  assert.equal(normalizePlayerPreferences({ holdSpaceToSpeedUp: false }).holdSpaceToSpeedUp, false);
  assert.equal(normalizePlayerPreferences({ defaultQuality: 720 }).defaultQuality, "720p");
  assert.equal(normalizePlayerPreferences({ defaultQuality: "nonsense" }).defaultQuality, "auto");
});

test("quality is resolved by height for each source list, not an old index", () => {
  assert.equal(parseQualityHeight("720p"), 720);
  assert.equal(parseQualityHeight("1080"), 1080);
  assert.equal(parseQualityHeight(null), undefined);
  assert.equal(getPreferredQualityIndex(qualities, "720p"), 1);
  assert.equal(getPreferredQualityIndex([{ quality: 720 }, { quality: 480 }], "720p"), 0);
  assert.equal(getPreferredQualityIndex(qualities, "1440p"), 0);
  assert.equal(getPreferredQualityIndex([{ quality: 2160 }, { quality: 1080 }], "720p"), 1);
  assert.equal(getPreferredQualityIndex([{ quality: 480 }, { quality: 1080 }, { quality: 720 }], "720p"), 2);
  assert.equal(getPreferredQualityIndex([{ quality: 1080 }, { quality: undefined }, { quality: 480 }], "720p"), 2);
  assert.equal(getPreferredQualityIndex(qualities, "auto"), 0);
});

class PlayerElement extends EventTarget {
  closest() { return null; }
  contains(target) { return target === this; }
}
function key(target, type, extras = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { key: " ", code: "Space", repeat: false, ...extras });
  target.dispatchEvent(event);
  return event;
}
function setup(t, { enabled = true, paused = false, rate = 1.5 } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const win = new EventTarget();
  const globals = { document: doc, window: win, Element: PlayerElement };
  const previousGlobals = new Map();
  for (const [name, value] of Object.entries(globals)) {
    previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const el = new PlayerElement();
  const changes = [];
  let toggles = 0;
  const player = { playbackRate: rate, paused, remoteControl: { togglePaused() { toggles++; player.paused = !player.paused; } } };
  const cleanup = bindSpaceSpeedBoost(el, player, enabled, (active) => changes.push(active));
  t.after(() => {
    cleanup();
    for (const [name, previous] of previousGlobals) {
      if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name];
    }
  });
  return { el, doc, win, player, changes, cleanup, toggles: () => toggles };
}

test("short Space toggles once on release without starting boost", (t) => {
  const x = setup(t);
  assert.equal(key(x.el, "keydown").defaultPrevented, true);
  t.mock.timers.tick(100);
  key(x.doc, "keyup");
  assert.equal(x.toggles(), 1);
  assert.equal(x.player.playbackRate, 1.5);
});

test("long Space ignores repeats, preserves playback state, restores the previous rate", (t) => {
  const x = setup(t);
  key(x.el, "keydown");
  t.mock.timers.tick(500);
  assert.equal(x.player.playbackRate, 2);
  key(x.el, "keydown", { repeat: true });
  assert.equal(x.toggles(), 0);
  assert.equal(x.player.paused, false);
  key(x.doc, "keyup");
  assert.equal(x.player.playbackRate, 1.5);
  assert.equal(x.toggles(), 0);
  assert.deepEqual(x.changes, [true, false]);
});

test("a paused video remains paused throughout a long press", (t) => {
  const x = setup(t, { paused: true });
  key(x.el, "keydown");
  t.mock.timers.tick(500);
  key(x.doc, "keyup");
  assert.equal(x.player.paused, true);
  assert.equal(x.toggles(), 0);
});

test("disabled hold keeps normal Space toggle and never boosts", (t) => {
  const x = setup(t, { enabled: false });
  key(x.el, "keydown");
  key(x.el, "keydown", { repeat: true });
  t.mock.timers.tick(1000);
  key(x.doc, "keyup");
  assert.equal(x.toggles(), 1);
  assert.equal(x.player.playbackRate, 1.5);
});

for (const reason of ["blur", "hidden", "cleanup", "focusout"]) {
  test(`${reason} cancels a hold and restores rate without toggling`, (t) => {
    const x = setup(t);
    key(x.el, "keydown");
    t.mock.timers.tick(500);
    if (reason === "blur") x.win.dispatchEvent(new Event("blur"));
    if (reason === "hidden") { x.doc.hidden = true; x.doc.dispatchEvent(new Event("visibilitychange")); }
    if (reason === "cleanup") x.cleanup();
    if (reason === "focusout") x.el.dispatchEvent(new Event("focusout"));
    key(x.doc, "keyup");
    assert.equal(x.player.playbackRate, 1.5);
    assert.equal(x.toggles(), 0);
  });
}

test("modifiers and editable/control targets retain their own keyboard behavior", (t) => {
  const x = setup(t);
  assert.equal(key(x.el, "keydown", { ctrlKey: true }).defaultPrevented, false);
  x.el.closest = () => x.el;
  assert.equal(key(x.el, "keydown").defaultPrevented, false);
  t.mock.timers.tick(1000);
  assert.equal(x.toggles(), 0);
  assert.equal(x.player.playbackRate, 1.5);
});
