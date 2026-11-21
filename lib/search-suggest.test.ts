import { test } from "node:test";
import assert from "node:assert/strict";
import { suggest } from "./search-suggest.ts";

const list = ["Encanador", "Eletricista", "Diarista", "Pintor", "Ar-condicionado", "Personal trainer", "Médico", "Medicina do sono"];

test("só sugere a partir de 2 letras", () => {
  assert.deepEqual(suggest(list, "e"), []);
  assert.deepEqual(suggest(list, ""), []);
});
test("ignora acento e maiúscula", () => {
  assert.deepEqual(suggest(list, "MEDI"), ["Medicina do sono", "Médico"]);
  assert.deepEqual(suggest(list, "medico"), ["Médico"]);
});
test("quem começa com o texto vem antes de quem só contém", () => {
  assert.deepEqual(suggest(list, "tr"), ["Personal trainer", "Eletricista"]);   // palavra que começa vem antes de quem só contém
  assert.equal(suggest(list, "ar")[0], "Ar-condicionado");
});
test("acha pela segunda palavra e respeita o limite", () => {
  assert.ok(suggest(list, "sono").includes("Medicina do sono"));
  assert.equal(suggest(list, "in", 1).length, 1);
});
test("sem repetição", () => {
  assert.deepEqual(suggest(["Pintor", "pintor", "PINTOR"], "pint"), ["Pintor"]);
});
