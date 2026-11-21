import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequestEmail, requestEmailLink } from "./request-email.ts";

const base = "https://app.exemplo.com";
const r = { email: "a@b.com", label: "Tapeceiro", condo_slug: "parque-barueri", category_slug: "tapecaria", provider_name: "Estofados da Rita" };

test("link vai para a categoria quando o pedido tinha uma", () => {
  assert.equal(requestEmailLink(r, base), "https://app.exemplo.com/c/parque-barueri/categoria/tapecaria");
});
test("sem categoria, o link busca pelo que foi pedido", () => {
  assert.equal(requestEmailLink({ ...r, category_slug: null, label: "Cortina sob medida" }, base), "https://app.exemplo.com/c/parque-barueri?q=Cortina%20sob%20medida");
});
test("e-mail cita o pedido e o profissional, sem telefone", () => {
  const m = buildRequestEmail(r, base);
  assert.match(m.subject, /Tapeceiro/);
  assert.match(m.text, /Estofados da Rita/);
  assert.ok(!/\d{8,}/.test(m.text));
});
test("html escapa texto digitado pelo morador", () => {
  const m = buildRequestEmail({ ...r, label: '<script>alert("x")</script>' }, base);
  assert.ok(!m.html.includes("<script>"));
  assert.match(m.html, /&lt;script&gt;/);
});
