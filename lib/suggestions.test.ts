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

import { findSimilarCategories } from "./suggestions.ts";
const cats = [
  { name: "Médico(a)", slug: "medico", keywords: "doutor clinico pediatra dermatologista consulta" },
  { name: "Eletricista", slug: "eletricista", keywords: "luz tomada chuveiro" },
  { name: "Diarista / Limpeza", slug: "diarista", keywords: "faxina faxineira limpeza domestica" },
  { name: "Dedetização", slug: "dedetizacao", keywords: "praga barata cupim" },
  { name: "Cabeleireiro(a)", slug: "cabeleireiro", keywords: "cabelo corte escova" },
  { name: "Fotógrafo(a)", slug: "fotografo", keywords: "foto video ensaio" },
  { name: "Outros", slug: "outros", keywords: "" },
];
test("acha categoria equivalente por nome, erro de digitação e sinônimo", () => {
  assert.equal(findSimilarCategories("Dedetização", cats)[0].slug, "dedetizacao");
  assert.equal(findSimilarCategories("dedetizacao", cats)[0].slug, "dedetizacao");
  assert.equal(findSimilarCategories("eletrecista", cats)[0].slug, "eletricista");
  assert.equal(findSimilarCategories("Pediatra", cats)[0].slug, "medico");
  assert.equal(findSimilarCategories("faxineira", cats)[0].slug, "diarista");
  assert.equal(findSimilarCategories("Fotógrafa", cats)[0].slug, "fotografo");
  assert.equal(findSimilarCategories("cabelo", cats)[0].slug, "cabeleireiro");
});
test("sem equivalente devolve vazio e nunca sugere Outros", () => {
  assert.deepEqual(findSimilarCategories("Costureira", cats), []);
  assert.deepEqual(findSimilarCategories("de", cats), []);
  assert.ok(!findSimilarCategories("outros", cats).some((c) => c.slug === "outros"));
});
