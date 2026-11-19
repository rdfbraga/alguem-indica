import test from "node:test";
import assert from "node:assert/strict";
import { normalizeInstagram, normalizeWebsite, websiteLabel, instagramUrl } from "./links.ts";

test("instagram: arroba, link e usuário puro", () => {
  assert.deepEqual(normalizeInstagram("@caio.eletrica"), { ok: true, value: "caio.eletrica" });
  assert.deepEqual(normalizeInstagram("caio_eletrica"), { ok: true, value: "caio_eletrica" });
  assert.deepEqual(normalizeInstagram("https://www.instagram.com/caio.eletrica/?hl=pt"), { ok: true, value: "caio.eletrica" });
  assert.deepEqual(normalizeInstagram("instagram.com/caio"), { ok: true, value: "caio" });
  assert.deepEqual(normalizeInstagram("  "), { ok: true, value: null });
});
test("instagram: rejeita inválidos", () => {
  assert.equal(normalizeInstagram("com espaço").ok, false);
  assert.equal(normalizeInstagram("a".repeat(31)).ok, false);
  assert.equal(normalizeInstagram("https://evil.com/caio").ok, false);
  assert.equal(normalizeInstagram("<script>").ok, false);
});
test("site: adiciona https e valida", () => {
  assert.deepEqual(normalizeWebsite("caio.com.br"), { ok: true, value: "https://caio.com.br/" });
  assert.deepEqual(normalizeWebsite("http://caio.com.br/servicos"), { ok: true, value: "http://caio.com.br/servicos" });
  assert.deepEqual(normalizeWebsite(""), { ok: true, value: null });
});
test("site: rejeita esquemas perigosos e entradas ruins", () => {
  for (const bad of ["javascript:alert(1)", "ftp://x.com", "localhost", "caio", "a b.com", "https://user:pass@x.com", "https://" + "a".repeat(200) + ".com"]) {
    assert.equal(normalizeWebsite(bad).ok, false, bad);
  }
});
test("rótulos", () => {
  assert.equal(websiteLabel("https://caio.com.br/"), "caio.com.br");
  assert.equal(instagramUrl("caio"), "https://instagram.com/caio");
});
