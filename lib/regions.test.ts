import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewAuthorLabel } from "./regions.ts";

const prov = { condo_id: "A", condo_name: "Parque Barueri" };

test("mesmo condomínio do prestador: mostra o bloco", () => {
  assert.equal(reviewAuthorLabel({ author_label: "Maria S. · Bloco B" }, prov, "A"), "Maria S. · Bloco B");
});
test("quem vem de fora vê o condomínio, nunca o bloco", () => {
  assert.equal(reviewAuthorLabel({ author_label: "Maria S. · Bloco B" }, prov, "B"), "Maria S. · Parque Barueri");
});
test("autor de outro condomínio já vem sem bloco", () => {
  const r = { author_label: "Bruno S. · Cond. Vizinho", author_origin: "Cond. Vizinho" };
  assert.equal(reviewAuthorLabel(r, prov, "A"), "Bruno S. · Cond. Vizinho");
  assert.equal(reviewAuthorLabel(r, prov, "B"), "Bruno S. · Cond. Vizinho");
});
test("sem nome do condomínio usa um texto neutro", () => {
  assert.equal(reviewAuthorLabel({ author_label: "Ana P. · Bloco C" }, { condo_id: "A" }, "B"), "Ana P. · Condomínio vizinho");
});
