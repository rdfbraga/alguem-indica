import { test } from "node:test";
import assert from "node:assert/strict";
import { condoSlugFromPath, pickCondo } from "./last-condo.ts";

test("extrai o condomínio do caminho", () => {
  assert.equal(condoSlugFromPath("/c/parque-barueri"), "parque-barueri");
  assert.equal(condoSlugFromPath("/c/parque-barueri/p/123?x=1"), "parque-barueri");
  assert.equal(condoSlugFromPath("/c/parque-barueri?q=a"), "parque-barueri");
});
test("outros caminhos não contam", () => {
  assert.equal(condoSlugFromPath("/r/regiao"), null);
  assert.equal(condoSlugFromPath("/termos"), null);
  assert.equal(condoSlugFromPath("/c/../x"), null);
  assert.equal(condoSlugFromPath("/c/Maiuscula"), null);
});
test("último condomínio vale só se a pessoa ainda é moradora", () => {
  assert.equal(pickCondo(["a", "b"], "b"), "b");
  assert.equal(pickCondo(["a", "b"], "x"), null);
  assert.equal(pickCondo(["a"], "x"), "a");
  assert.equal(pickCondo([], "a"), null);
});
