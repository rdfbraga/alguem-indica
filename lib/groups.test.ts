import test from "node:test";
import assert from "node:assert/strict";
import { groupCategories } from "./groups.ts";

const groups = [
  { id: 1, name: "Casa", icon: "🏠" },
  { id: 2, name: "Saúde", icon: "🩺" },
  { id: 3, name: "Vazio", icon: "∅" },
];
test("agrupa na ordem, remove grupos vazios e junta órfãs em Outras", () => {
  const cats = [
    { id: 10, group_id: 1 }, { id: 11, group_id: 2 }, { id: 12, group_id: 1 },
    { id: 13, group_id: null }, { id: 14, group_id: 99 },
  ];
  const s = groupCategories(groups, cats);
  assert.deepEqual(s.map((x) => x.group.name), ["Casa", "Saúde", "Outras"]);
  assert.deepEqual(s[0].categories.map((c) => c.id), [10, 12]);
  assert.deepEqual(s[2].categories.map((c) => c.id), [13, 14]);
});
