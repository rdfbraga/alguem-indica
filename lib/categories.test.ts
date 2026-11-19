import test from "node:test";
import assert from "node:assert/strict";
import { parseCategoryIds, providerCategoryLabels } from "./categories.ts";

test("lê ids sem repetir e ignora lixo", () => {
  assert.deepEqual(parseCategoryIds(["3", "5", "3", "x", "-1", "0", "2.5", ""]), [3, 5]);
  assert.deepEqual(parseCategoryIds([]), []);
});
test("rótulos: principal primeiro e texto digitado em Outros", () => {
  const p = { category_slug: "eletricista", category_name: "Eletricista", custom_category: null,
    category_slugs: ["eletricista", "encanador"], category_names: ["Eletricista", "Encanador"] };
  assert.deepEqual(providerCategoryLabels(p), ["Eletricista", "Encanador"]);
  const o = { category_slug: "outros", category_name: "Outros", custom_category: "Costureira",
    category_slugs: ["outros", "diarista"], category_names: ["Outros", "Diarista / Limpeza"] };
  assert.deepEqual(providerCategoryLabels(o), ["Costureira", "Diarista / Limpeza"]);
});
test("sem as listas (banco antigo) usa a categoria única", () => {
  assert.deepEqual(providerCategoryLabels({ category_slug: "pintor", category_name: "Pintor" }), ["Pintor"]);
  assert.deepEqual(providerCategoryLabels({ category_slug: "outros", category_name: "Outros", custom_category: "Tradução" }), ["Tradução"]);
});
