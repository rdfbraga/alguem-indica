import test from "node:test";
import assert from "node:assert/strict";
import { profileOrigin, shareProfileText, shareProfileLink } from "./origin.ts";

test("origem do perfil", () => {
  assert.equal(profileOrigin({ owner_id: "u1", self_pending: true }), "confirmed");
  assert.equal(profileOrigin({ owner_id: null, self_pending: true }), "self_pending");
  assert.equal(profileOrigin({ owner_id: null, self_pending: false }), "neighbor");
  assert.equal(profileOrigin({}), "neighbor");
});
test("mensagem de compartilhamento", () => {
  const t = shareProfileText({ name: "Bia Nails", categories: ["Manicure", "Depilação / Estética", "Massagista"], url: "https://x.com/c/y/p/1" });
  assert.match(t, /\(Manicure \/ Depilação \/ Estética\)/);
  assert.ok(t.endsWith("https://x.com/c/y/p/1"));
  assert.equal(shareProfileText({ name: "A", categories: [], url: "u" }).includes("()"), false);
  const link = shareProfileLink("olá & tudo bem?");
  assert.equal(link, "https://wa.me/?text=ol%C3%A1%20%26%20tudo%20bem%3F");
});
