import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLabel, groupSuggestions, capitalizeFirst } from "./suggestions.ts";

test("normaliza acento, caixa e espaços", () => {
  assert.equal(normalizeLabel("  Dedetização  "), "dedetizacao");
  assert.equal(normalizeLabel("FOTÓGRAFO   de   festas"), "fotografo de festas");
});
test("agrupa sugestões equivalentes e usa a grafia mais comum", () => {
  const items = [
    { id: "1", custom_category: "Dedetização" },
    { id: "2", custom_category: "dedetizacao" },
    { id: "3", custom_category: "Dedetização " },
    { id: "4", custom_category: "Fotógrafo" },
    { id: "5", custom_category: null },
  ];
  const g = groupSuggestions(items);
  assert.equal(g.length, 2);
  assert.equal(g[0].label, "Dedetização");
  assert.deepEqual(g[0].items.map((i) => i.id), ["1", "2", "3"]);
  assert.equal(g[1].label, "Fotógrafo");
});
test("capitaliza a primeira letra", () => {
  assert.equal(capitalizeFirst(" dedetização"), "Dedetização");
});
