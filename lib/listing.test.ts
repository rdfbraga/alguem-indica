import test from "node:test";
import assert from "node:assert/strict";
import { bayesScore, sortProviders, filterKind, parseOrder, parseKind } from "./listing.ts";
import type { ProviderRow } from "./types.ts";

const mk = (id: string, avg: number, n: number, created = "2026-01-01", kind: "resident" | "external" = "external") =>
  ({ id, avg_rating: avg, review_count: n, created_at: created, kind }) as ProviderRow;

test("1 avaliação nota 5 não vence 20 avaliações 4,8", () => {
  const out = sortProviders([mk("novo", 5, 1), mk("veterano", 4.8, 20)], "melhores");
  assert.deepEqual(out.map((p) => p.id), ["veterano", "novo"]);
});
test("sem avaliações vai para o fim", () => {
  assert.equal(bayesScore(mk("x", 0, 0)), -1);
  const out = sortProviders([mk("a", 0, 0), mk("b", 3, 2)], "melhores");
  assert.deepEqual(out.map((p) => p.id), ["b", "a"]);
});
test("mais avaliados e mais recentes", () => {
  const l = [mk("a", 4, 2, "2026-01-01"), mk("b", 4, 9, "2026-02-01"), mk("c", 4, 5, "2026-03-01")];
  assert.deepEqual(sortProviders(l, "avaliados").map((p) => p.id), ["b", "c", "a"]);
  assert.deepEqual(sortProviders(l, "recentes").map((p) => p.id), ["c", "b", "a"]);
});
test("relevância usa a pontuação da busca", () => {
  const l = [mk("a", 5, 10), mk("b", 3, 1)];
  const out = sortProviders(l, "relevancia", new Map([["a", 0.4], ["b", 0.9]]));
  assert.deepEqual(out.map((p) => p.id), ["b", "a"]);
});
test("filtro por tipo e parsing de parâmetros", () => {
  const l = [mk("a", 4, 1, "2026-01-01", "resident"), mk("b", 4, 1)];
  assert.deepEqual(filterKind(l, "morador").map((p) => p.id), ["a"]);
  assert.deepEqual(filterKind(l, "externo").map((p) => p.id), ["b"]);
  assert.equal(filterKind(l, "todos").length, 2);
  assert.equal(parseOrder("lixo", true), "relevancia");
  assert.equal(parseOrder("relevancia", false), "melhores");
  assert.equal(parseKind("morador"), "morador");
  assert.equal(parseKind("x"), "todos");
});
