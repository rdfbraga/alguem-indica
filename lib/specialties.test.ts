import test from "node:test";
import assert from "node:assert/strict";
import { providerSpecialtyLabels, specialtyCounts, filterBySpecialty, parseSpecialtyFilter } from "./specialties.ts";

const spec = [{ slug: "pediatra", name: "Pediatra" }, { slug: "dermatologista", name: "Dermatologista" }, { slug: "geriatra", name: "Geriatra" }];
const provs = [
  { specialty_slugs: ["pediatra", "alergista"] },
  { specialty_slugs: ["pediatra"] },
  { specialty_slugs: ["dermatologista"] },
  { specialty_slugs: null },
];
test("etiquetas: lista e texto livre no fim", () => {
  assert.deepEqual(providerSpecialtyLabels({ specialty_names: ["Pediatra"], custom_specialty: "Alergia infantil" }), ["Pediatra", "Alergia infantil"]);
  assert.deepEqual(providerSpecialtyLabels({ specialty_names: null, custom_specialty: null }), []);
});
test("contagem só das que existem, da mais comum para a menos", () => {
  assert.deepEqual(specialtyCounts(provs, spec), [
    { slug: "pediatra", name: "Pediatra", count: 2 },
    { slug: "dermatologista", name: "Dermatologista", count: 1 },
  ]);
});
test("filtro e validação do parâmetro", () => {
  assert.equal(filterBySpecialty(provs, "pediatra").length, 2);
  assert.equal(filterBySpecialty(provs, undefined).length, 4);
  assert.equal(filterBySpecialty(provs, "geriatra").length, 0);
  assert.equal(parseSpecialtyFilter("pediatra", spec), "pediatra");
  assert.equal(parseSpecialtyFilter("<script>", spec), undefined);
  assert.equal(parseSpecialtyFilter(undefined, spec), undefined);
});
