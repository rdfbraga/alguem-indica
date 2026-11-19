import test from "node:test";
import assert from "node:assert/strict";
import { parseOtpType, parseTokenHash, condoPathFrom } from "./auth-link.ts";

test("aceita só os tipos usados", () => {
  assert.equal(parseOtpType("email"), "email");
  assert.equal(parseOtpType("magiclink"), "magiclink");
  assert.equal(parseOtpType("recovery"), null);
  assert.equal(parseOtpType(null), null);
});
test("valida o formato do token", () => {
  assert.equal(parseTokenHash("pkce_6e837d9bef2f83dd275b4992bfc286ce95fc194ebfcfded4fd4675d2"), "pkce_6e837d9bef2f83dd275b4992bfc286ce95fc194ebfcfded4fd4675d2");
  assert.equal(parseTokenHash("curto"), null);
  assert.equal(parseTokenHash("tem espaço e <script>"), null);
  assert.equal(parseTokenHash(null), null);
});
test("extrai o caminho do condomínio", () => {
  assert.equal(condoPathFrom("/c/parque-barueri"), "/c/parque-barueri");
  assert.equal(condoPathFrom("/c/parque-barueri/novo"), "/c/parque-barueri");
  assert.equal(condoPathFrom("/outra/coisa"), null);
});
