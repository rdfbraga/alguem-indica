import test from "node:test";
import assert from "node:assert/strict";
import { buildContactMessage, contactIntent, greetingFor, hourInSaoPaulo, shortProviderName, bareCondoName } from "./contact.ts";

test("saudação pela hora", () => {
  assert.equal(greetingFor(5), "Bom dia");
  assert.equal(greetingFor(11), "Bom dia");
  assert.equal(greetingFor(12), "Boa tarde");
  assert.equal(greetingFor(17), "Boa tarde");
  assert.equal(greetingFor(18), "Boa noite");
  assert.equal(greetingFor(2), "Boa noite");
});
test("hora de São Paulo (UTC-3)", () => {
  assert.equal(hourInSaoPaulo(new Date("2026-11-19T12:30:00Z")), 9);
  assert.equal(hourInSaoPaulo(new Date("2026-11-19T02:00:00Z")), 23);
  assert.equal(hourInSaoPaulo(new Date("2026-11-19T03:00:00Z")), 0);
});
test("intenção por categoria", () => {
  assert.equal(contactIntent("eletricista"), "orcamento");
  assert.equal(contactIntent("manicure"), "agendar");
  assert.equal(contactIntent("medico"), "agendar");
  assert.equal(contactIntent("marmita"), "pedido");
  assert.equal(contactIntent("categoria-nova-criada-pelo-admin"), "orcamento");
});
test("nomes", () => {
  assert.equal(shortProviderName("Dra. Helena Prado – Pediatra"), "Dra. Helena Prado");
  assert.equal(shortProviderName("Dr. Gustavo Lima - Trabalhista"), "Dr. Gustavo Lima");
  assert.equal(shortProviderName("Caio Eletricista"), "Caio Eletricista");
  assert.equal(shortProviderName("Ar-condicionado Frio-Certo"), "Ar-condicionado Frio-Certo"); // hífen sem espaços não corta
  assert.equal(bareCondoName("Condomínio Parque Barueri"), "Parque Barueri");
  assert.equal(bareCondoName("Residencial Sol"), "Residencial Sol");
});
test("mensagem completa", () => {
  const m = buildContactMessage({ providerName: "Caio Eletricista", residentName: "Maria da Silva", condoName: "Parque Barueri", categorySlug: "eletricista", hour: 9 });
  assert.equal(m, "Bom dia, Caio Eletricista! Meu nome é Maria e moro no condomínio Parque Barueri. Vi seu perfil no Alguém indica? e gostaria de pedir um orçamento. Pode me ajudar?");
  const m2 = buildContactMessage({ providerName: "Studio Priscila Nails", residentName: "  ", condoName: "Condomínio Vila Verde", categorySlug: "manicure", hour: 15 });
  assert.equal(m2, "Boa tarde, Studio Priscila Nails! Moro no condomínio Vila Verde. Vi seu perfil no Alguém indica? e gostaria de saber sobre horários e valores. Pode me ajudar?");
  assert.match(buildContactMessage({ providerName: "Marmitas da Lúcia", condoName: "X", categorySlug: "marmita", hour: 20 }), /^Boa noite, .*fazer um pedido/);
  assert.ok(m.length < 220);
  const withLink = buildContactMessage({ providerName: "Caio Eletricista", residentName: "Maria", condoName: "Parque Barueri", categorySlug: "eletricista", hour: 9, profileUrl: "https://www.alguemindica.app.br/c/parque-barueri/p/abc" });
  assert.equal(withLink, m.replace("Maria da Silva", "Maria") + "\n\nSeu perfil: https://www.alguemindica.app.br/c/parque-barueri/p/abc");
});
