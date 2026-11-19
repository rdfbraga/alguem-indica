import test from "node:test";
import assert from "node:assert/strict";
import { parseFlags, premiumAvailable, premiumTeaser, planState, adIsLive, todayInSaoPaulo, NO_FLAGS } from "./features.ts";

test("chaves: padrão desligado e ignora lixo", () => {
  assert.deepEqual(parseFlags(null), NO_FLAGS);
  assert.deepEqual(parseFlags([{ feature: "ads", enabled: true }, { feature: "x", enabled: true }]), { ...NO_FLAGS, ads: true });
});
test("recurso premium: igual à regra do banco", () => {
  const off = NO_FLAGS;
  assert.equal(premiumAvailable(off, true, "showcase"), false);                                   // chave desligada
  const showcaseOnly = { ...NO_FLAGS, showcase: true };
  assert.equal(premiumAvailable(showcaseOnly, false, "showcase"), true);                          // plano desligado = liberado
  const plansOn = { ...NO_FLAGS, showcase: true, plans: true };
  assert.equal(premiumAvailable(plansOn, false, "showcase"), false);                              // plano ligado, sem plano ativo
  assert.equal(premiumAvailable(plansOn, true, "showcase"), true);
  assert.equal(premiumAvailable(plansOn, true, "replies"), false);                                // outra chave desligada
});
test("convite ao plano só com plano ligado e sem plano ativo", () => {
  const f = { ...NO_FLAGS, showcase: true, plans: true };
  assert.equal(premiumTeaser(f, false, "showcase"), true);
  assert.equal(premiumTeaser(f, true, "showcase"), false);
  assert.equal(premiumTeaser({ ...f, plans: false }, false, "showcase"), false);
  assert.equal(premiumTeaser(NO_FLAGS, false, "showcase"), false);
});
test("estado do plano", () => {
  const now = new Date("2026-11-19T12:00:00Z");
  assert.deepEqual(planState(null, now), { kind: "none", trialAvailable: true });
  const active = planState({ current_period_end: "2026-12-19T12:00:00Z", trial_used: true, source: "trial", note: null }, now);
  assert.equal(active.kind, "active");
  assert.equal(active.kind === "active" && active.daysLeft, 30);
  assert.equal(active.kind === "active" && active.trial, true);
  const expired = planState({ current_period_end: "2026-11-01T00:00:00Z", trial_used: true, source: "trial", note: null }, now);
  assert.deepEqual(expired, { kind: "expired", endedAt: "2026-11-01T00:00:00Z", trialAvailable: false });
  assert.equal(planState({ current_period_end: "2026-11-01T00:00:00Z", trial_used: false, source: "manual", note: null }, now).kind, "expired");
});
test("anúncio vigente", () => {
  const today = "2026-11-19";
  assert.equal(adIsLive({ active: true, starts_on: null, ends_on: null }, today), true);
  assert.equal(adIsLive({ active: false, starts_on: null, ends_on: null }, today), false);
  assert.equal(adIsLive({ active: true, starts_on: "2026-11-20", ends_on: null }, today), false);
  assert.equal(adIsLive({ active: true, starts_on: null, ends_on: "2026-11-18" }, today), false);
  assert.equal(adIsLive({ active: true, starts_on: "2026-11-19", ends_on: "2026-11-19" }, today), true);
});
test("data de hoje em São Paulo", () => {
  assert.equal(todayInSaoPaulo(new Date("2026-11-19T01:00:00Z")), "2026-11-18");  // 22h do dia anterior em SP
  assert.equal(todayInSaoPaulo(new Date("2026-11-19T15:00:00Z")), "2026-11-19");
});
