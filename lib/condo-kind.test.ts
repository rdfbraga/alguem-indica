import { test } from "node:test";
import assert from "node:assert/strict";
import { blockText, parseCondoKind, placeLabels, placeText } from "./condo-kind.ts";

test("tipo desconhecido vira prédios", () => {
  assert.equal(parseCondoKind("houses"), "houses");
  assert.equal(parseCondoKind("building"), "building");
  assert.equal(parseCondoKind(undefined), "building");
  assert.equal(parseCondoKind("castelo"), "building");
});
test("textos de prédio e de casa", () => {
  assert.equal(blockText("building", "B"), "Bloco B");
  assert.equal(blockText("houses", "Rua das Acácias"), "Rua das Acácias");
  assert.equal(placeText("building", "B", "204"), "Bloco B, 204");
  assert.equal(placeText("houses", "Rua das Acácias", "123"), "Rua das Acácias, casa 123");
});
test("rótulos do cadastro mudam com o tipo", () => {
  assert.equal(placeLabels("building").primary, "Bloco / Torre");
  assert.equal(placeLabels("houses").primary, "Rua");
  assert.equal(placeLabels("houses").secondary, "Número da casa");
});
