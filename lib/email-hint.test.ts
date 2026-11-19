import test from "node:test";
import assert from "node:assert/strict";
import { isMicrosoftMail } from "./email-hint.ts";

test("detecta e-mails da Microsoft", () => {
  for (const e of ["a@hotmail.com", "a@Hotmail.com.br", "a@outlook.com", "a@outlook.com.br", "a@live.com", "a@msn.com", " a@hotmail.com "]) {
    assert.equal(isMicrosoftMail(e), true, e);
  }
});
test("não confunde com outros provedores", () => {
  for (const e of ["a@gmail.com", "a@empresa.com.br", "a@hotmail.example.org", "hotmail@gmail.com", "", "a@outlookx.com"]) {
    assert.equal(isMicrosoftMail(e), false, e);
  }
});
