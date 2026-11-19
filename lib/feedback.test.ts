import test from "node:test";
import assert from "node:assert/strict";
import { parseFeedbackKind, validateMessage } from "./feedback.ts";

test("aceita só os tipos conhecidos", () => {
  assert.equal(parseFeedbackKind("problema"), "problema");
  assert.equal(parseFeedbackKind("sugestao"), "sugestao");
  assert.equal(parseFeedbackKind("hack"), null);
  assert.equal(parseFeedbackKind(null), null);
});
test("valida tamanho e remove espaços", () => {
  assert.deepEqual(validateMessage("  Oi, tudo bem?  "), { ok: true, text: "Oi, tudo bem?" });
  assert.equal(validateMessage("oi").ok, false);
  assert.equal(validateMessage("   ").ok, false);
  assert.equal(validateMessage("x".repeat(1001)).ok, false);
  assert.equal(validateMessage("x".repeat(1000)).ok, true);
  assert.equal(validateMessage("x".repeat(11), 10).ok, false);
});
