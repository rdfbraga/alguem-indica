import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWhatsapp, formatWhatsapp, whatsappLink } from "./phone.ts";

test("normaliza formatos comuns", () => {
  assert.equal(normalizeWhatsapp("(11) 99999-8888"), "5511999998888");
  assert.equal(normalizeWhatsapp("+55 11 99999-8888"), "5511999998888");
  assert.equal(normalizeWhatsapp("011999998888"), "5511999998888");
  assert.equal(normalizeWhatsapp("1133334444"), "551133334444");
});
test("rejeita inválidos", () => {
  assert.equal(normalizeWhatsapp("12345"), null);
  assert.equal(normalizeWhatsapp("(11) 89999-8888"), null);
  assert.equal(normalizeWhatsapp("(10) 99999-8888"), null);
});
test("formata e gera link", () => {
  assert.equal(formatWhatsapp("5511999998888"), "(11) 99999-8888");
  assert.equal(formatWhatsapp("551133334444"), "(11) 3333-4444");
  assert.equal(whatsappLink("5511999998888", "Oi, tudo bem?"), "https://wa.me/5511999998888?text=Oi%2C%20tudo%20bem%3F");
});
