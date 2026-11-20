import test from "node:test";
import assert from "node:assert/strict";
import { commonCategoryIds, categoriesByFrequency } from "./specialty-admin.ts";
import { groupByLabel, groupSuggestions } from "./suggestions.ts";

test("categorias em comum", () => {
  assert.deepEqual(commonCategoryIds([[1, 2], [2, 3], [2, 1]]), [2]);
  assert.deepEqual(commonCategoryIds([[1], [2]]), []);
  assert.deepEqual(commonCategoryIds([[5, 6]]), [5, 6]);
  assert.deepEqual(commonCategoryIds([]), []);
});
test("categorias por frequência", () => {
  assert.deepEqual(categoriesByFrequency([[1, 2], [2], [2, 3]]), [2, 1, 3]);
  assert.deepEqual(categoriesByFrequency([]), []);
});
test("agrupa o texto livre das especialidades como as categorias", () => {
  const items = [
    { id: "1", custom_specialty: "Alergia infantil" },
    { id: "2", custom_specialty: "alergia  infantil " },
    { id: "3", custom_specialty: "Medicina do sono" },
    { id: "4", custom_specialty: null },
  ];
  const g = groupByLabel(items, (i) => i.custom_specialty);
  assert.equal(g.length, 2);
  assert.equal(g[0].label, "Alergia infantil");
  assert.deepEqual(g[0].items.map((i) => i.id), ["1", "2"]);
  // o atalho antigo continua funcionando
  assert.equal(groupSuggestions([{ id: "9", custom_category: "Costureira" }]).length, 1);
});
