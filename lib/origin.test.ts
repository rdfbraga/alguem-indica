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
  const t = shareProfileText({ categories: ["Manicure", "Depilação / Estética", "Massagista"], url: "https://x.com/c/y/p/1" });
  assert.equal(t, "Oi, vizinhos! 👋 Meu perfil de *Manicure e Depilação / Estética* já está no Alguém indica?, o app de indicações do nosso condomínio.\n\nSe você já usou meu trabalho, me ajuda com uma avaliação? Leva 1 minuto:\nhttps://x.com/c/y/p/1\n\nValeu, vizinhos! 🙏");
  assert.match(shareProfileText({ categories: [], url: "u" }), /^Oi, vizinhos! 👋 Meu perfil já está/);
  const link = shareProfileLink("olá & tudo bem?");
  assert.equal(link, "https://wa.me/?text=ol%C3%A1%20%26%20tudo%20bem%3F");
});
