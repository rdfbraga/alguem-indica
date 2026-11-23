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

import { buildRegionInviteMessage } from "./invite.ts";

test("convite da região fala dos condomínios da região e leva o link da região", () => {
  const t = buildRegionInviteMessage({ residentName: "Maria da Silva", regionName: "Parque Barueri", url: "https://x.app/r/parque-barueri" });
  assert.match(t, /Aqui é Maria\./);
  assert.match(t, /condomínios da nossa região/);
  assert.match(t, /Escolha o seu condomínio/);
  assert.ok(t.includes("\nhttps://x.app/r/parque-barueri\n"));
  assert.ok(!t.includes("Silva"));
});

import { buildProviderClaimMessage } from "./invite.ts";

test("mensagem para o profissional leva o link e só o primeiro nome de quem indicou", () => {
  const t = buildProviderClaimMessage({ providerName: "Maria", residentName: "João da Silva", condoName: "Condomínio Parque Barueri", url: "https://x.app/c/pb/assumir/1" });
  assert.match(t, /Aqui é João, do Parque Barueri/);
  assert.ok(t.includes("\nhttps://x.app/c/pb/assumir/1"));
  assert.ok(!t.includes("Silva"));
});

import { buildHelpRequestMessage } from "./invite.ts";

test("pedido de ajuda cita o que procura, o condomínio e leva o link", () => {
  const t = buildHelpRequestMessage({ residentName: "Maria da Silva", condoName: "Condomínio Parque Barueri", what: "  concerto   de impressora ", url: "https://x.app/c/pb/novo?servico=x" });
  assert.match(t, /Aqui é Maria\./);
  assert.match(t, /\*concerto de impressora\*/);
  assert.match(t, /app de indicações do Parque Barueri/);
  assert.ok(t.includes("\nhttps://x.app/c/pb/novo?servico=x\n"));
  assert.ok(!t.includes("Silva"));
});
test("o que se procura é limitado a 60 letras", () => {
  const t = buildHelpRequestMessage({ condoName: "X", what: "a".repeat(200), url: "u" });
  assert.ok(t.includes(`*${"a".repeat(60)}*`));
  assert.ok(!t.includes("a".repeat(61)));
});
