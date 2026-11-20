import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInviteMessage, inviteWhatsappLink } from "./invite.ts";

const url = "https://www.alguemindica.app.br/c/parque-barueri";

test("convite usa o primeiro nome e o condomínio sem a palavra 'Condomínio'", () => {
  const t = buildInviteMessage({ residentName: "Maria da Silva", condoName: "Condomínio Parque Barueri", url });
  assert.match(t, /Aqui é Maria\./);
  assert.match(t, /moradores do Parque Barueri/);
  assert.ok(!t.includes("Silva"));
  assert.ok(t.includes(`\n${url}\n`));
});

test("sem nome, não deixa buraco na frase", () => {
  const t = buildInviteMessage({ residentName: "", condoName: "Parque Barueri", url });
  assert.ok(!t.includes("Aqui é"));
  assert.match(t, /Oi, vizinhos! 👋 Estou usando/);
});

test("link do WhatsApp codifica a mensagem", () => {
  const link = inviteWhatsappLink("oi & tchau");
  assert.equal(link, "https://wa.me/?text=oi%20%26%20tchau");
});
