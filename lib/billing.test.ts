import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentMessage, formatBRL, parseBRL, planAmount } from "./billing.ts";

test("valores em reais", () => {
  assert.equal(formatBRL(2900).replace(/\s/g, " "), "R$ 29,00");
  assert.equal(parseBRL("29"), 2900);
  assert.equal(parseBRL("R$ 29,90"), 2990);
  assert.equal(parseBRL("1.290,50"), 129050);
  assert.equal(parseBRL(""), null);
  assert.equal(parseBRL("abc"), null);
  assert.equal(parseBRL("0"), null);
});
test("trimestre com desconto, igual ao banco", () => {
  assert.equal(planAmount(2900, 1, 15), 2900);
  assert.equal(planAmount(2900, 3, 15), 7395);
  assert.equal(planAmount(2900, 3, 0), 8700);
});
test("mensagem de pagamento cita perfil, período e valor", () => {
  const m = buildPaymentMessage({ providerName: "João Eletricista", amountCents: 7395, months: 3, condoName: "Parque Barueri" });
  assert.match(m, /João Eletricista/);
  assert.match(m, /3 meses/);
  assert.match(m, /R\$\s?73,95/);
});
