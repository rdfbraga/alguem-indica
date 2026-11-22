import { test } from "node:test";
import assert from "node:assert/strict";
import { naturalCompare } from "./natural.ts";

test("números dentro do nome ordenam como número", () => {
  const out = ["Alphaville 10", "Alphaville 2", "Alphaville 0", "Alphaville 12", "Alphaville 1", "Alphaville 11", "Alphaville 3"].sort(naturalCompare);
  assert.deepEqual(out, ["Alphaville 0", "Alphaville 1", "Alphaville 2", "Alphaville 3", "Alphaville 10", "Alphaville 11", "Alphaville 12"]);
});
test("ignora acento e maiúscula nas letras", () => {
  assert.deepEqual(["Éden", "alfa", "Zeta", "Bela"].sort(naturalCompare), ["alfa", "Bela", "Éden", "Zeta"]);
});
