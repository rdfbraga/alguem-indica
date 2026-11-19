import test from "node:test";
import assert from "node:assert/strict";
import { delta, deltaText, niceMax, parsePeriod, shortDate, longDate } from "./stats.ts";

test("variação contra o período anterior", () => {
  assert.deepEqual(delta(15, 10), { kind: "up", pct: 50 });
  assert.deepEqual(delta(5, 10), { kind: "down", pct: -50 });
  assert.deepEqual(delta(10, 10), { kind: "same", pct: 0 });
  assert.deepEqual(delta(3, 0), { kind: "new", pct: null });
  assert.deepEqual(delta(0, 0), { kind: "none", pct: null });
  assert.deepEqual(delta(0, 4), { kind: "down", pct: -100 });
});
test("texto da variação", () => {
  assert.equal(deltaText(delta(15, 10), 7), "▲ 50% vs. 7 dias anteriores");
  assert.equal(deltaText(delta(5, 10), 30), "▼ 50% vs. 30 dias anteriores");
  assert.equal(deltaText(delta(0, 0), 30), "sem dados ainda");
});
test("topo do eixo e período", () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(3), 3);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(23), 50);
  assert.equal(niceMax(101), 200);
  assert.equal(parsePeriod("7"), 7);
  assert.equal(parsePeriod("abc"), 30);
  assert.equal(parsePeriod("15"), 30);
});
test("datas", () => {
  assert.equal(shortDate("2026-11-19"), "19/11");
  assert.equal(longDate("2026-11-19"), "qui, 19/11");
});
