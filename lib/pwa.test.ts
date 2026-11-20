import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildManifest, installKind } from "./pwa.ts";

const png = (p: string) => {
  const b = readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

test("manifesto: campos essenciais para instalar", () => {
  const m = buildManifest("parque-barueri", "Parque Barueri");
  assert.equal(m.start_url, "/c/parque-barueri");
  assert.equal(m.id, "/c/parque-barueri");
  assert.equal(m.display, "standalone");
  assert.equal(m.name, "Alguém indica? · Parque Barueri");
  assert.ok(m.short_name.length <= 14);
  assert.ok(m.start_url.startsWith("/") && m.scope === "/");
  assert.ok(m.icons.some((i) => i.sizes === "192x192" && i.purpose === "any"));
  assert.ok(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  for (const s of m.shortcuts) assert.ok(s.url.startsWith("/c/parque-barueri/"));
});
test("os ícones existem e têm o tamanho declarado", () => {
  const m = buildManifest("x", "X");
  for (const i of m.icons) {
    const file = `public${i.src}`;
    assert.ok(existsSync(file), file);
    const { w, h } = png(file);
    assert.equal(`${w}x${h}`, i.sizes, file);
  }
});
test("detecta iPhone/iPad no Safari", () => {
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const inApp = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
  assert.equal(installKind(safari, "iPhone", 5), "ios");
  assert.equal(installKind(inApp, "iPhone", 5), "other");
  assert.equal(installKind(android, "Linux armv8l", 5), "other");
  assert.equal(installKind(safari.replace("iPhone", "Macintosh"), "MacIntel", 5), "ios"); // iPad pedindo "site de desktop"
  assert.equal(installKind("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605", "MacIntel", 0), "other");
});
