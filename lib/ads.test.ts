import { test } from "node:test";
import assert from "node:assert/strict";
import { adsFor, keywordsMatch, pickAd } from "./ads.ts";
import type { AdRow } from "./types.ts";

const ad = (id: string, over: Partial<AdRow> = {}): AdRow =>
  ({ id, condo_id: "c", advertiser: "A", title: "T", body: null, image_url: null, link_url: null, whatsapp: "5511999990000", cta_label: "Ok", starts_on: null, ends_on: null, active: true, created_at: "", scope: "condo", placements: ["home"], category_ids: [], keywords: null, ...over }) as AdRow;

test("tela inicial: só os marcados para ela", () => {
  const list = [ad("a"), ad("b", { placements: ["category"] })];
  assert.deepEqual(adsFor(list, "home").map((x) => x.id), ["a"]);
});
test("categoria: sem categorias vale para todas; com categorias só para elas", () => {
  const list = [ad("todas", { placements: ["category"] }), ad("eletrica", { placements: ["category"], category_ids: [7] })];
  assert.deepEqual(adsFor(list, "category", { categoryIds: [7] }).map((x) => x.id), ["todas", "eletrica"]);
  assert.deepEqual(adsFor(list, "category", { categoryIds: [9] }).map((x) => x.id), ["todas"]);
});
test("busca: casa por categoria dos resultados ou pelas palavras", () => {
  const list = [ad("cat", { placements: ["search"], category_ids: [7] }), ad("kw", { placements: ["search"], keywords: "fios, tomada, material elétrico" })];
  assert.deepEqual(adsFor(list, "search", { categoryIds: [7], query: "pintor" }).map((x) => x.id), ["cat"]);
  assert.deepEqual(adsFor(list, "search", { categoryIds: [], query: "Preciso de TOMADA nova" }).map((x) => x.id), ["kw"]);
  assert.deepEqual(adsFor(list, "search", { categoryIds: [], query: "pintor" }), []);
});
test("palavras: ignora acento e aceita raiz parecida", () => {
  assert.equal(keywordsMatch("eletrica", "eletricista"), true);
  assert.equal(keywordsMatch("elétrico", "ELETRICO"), true);
  assert.equal(keywordsMatch("fio", "fiambre"), false);
  assert.equal(keywordsMatch(null, "qualquer"), false);
});
test("rodízio escolhe um da lista ou nada", () => {
  assert.equal(pickAd([], () => 0.5), null);
  assert.equal(pickAd(["x", "y"], () => 0.99), "y");
});
