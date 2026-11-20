import test from "node:test";
import assert from "node:assert/strict";
import { condoNext, withNext } from "./next-path.ts";

const slug = "parque-barueri";
test("aceita só caminhos do próprio condomínio", () => {
  assert.equal(condoNext(slug, "/c/parque-barueri/p/123"), "/c/parque-barueri/p/123");
  assert.equal(condoNext(slug, "/c/parque-barueri"), "/c/parque-barueri");
  assert.equal(condoNext(slug, "/c/parque-barueri/novo?eu=1"), "/c/parque-barueri/novo?eu=1");
});
test("rejeita outros condomínios, sites externos e truques", () => {
  for (const bad of ["/c/outro-condo/p/1", "https://evil.com", "//evil.com", "/c/parque-barueri/../outro", "/c/parque-barueri\\x", "/c/parque-baruerix", "/admin", "", null, undefined, "/c/parque-barueri/p/1\nSet-Cookie: x"]) {
    assert.equal(condoNext(slug, bad as string), "/c/parque-barueri", String(bad));
  }
});
test("withNext só acrescenta quando há destino específico", () => {
  assert.equal(withNext("/c/parque-barueri/entrar", slug, "/c/parque-barueri/p/9"), "/c/parque-barueri/entrar?next=%2Fc%2Fparque-barueri%2Fp%2F9");
  assert.equal(withNext("/c/parque-barueri/entrar", slug, "/c/parque-barueri"), "/c/parque-barueri/entrar");
  assert.equal(withNext("/c/parque-barueri/entrar", slug, "https://evil.com"), "/c/parque-barueri/entrar");
});
