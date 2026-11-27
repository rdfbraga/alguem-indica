import { test } from "node:test";
import assert from "node:assert/strict";
import { isStorageImageUrl, storagePathFromUrl } from "./photo.ts";

const S = "https://abc.supabase.co";
const U = "11111111-1111-1111-1111-111111111111";
const ok = `${S}/storage/v1/object/public/provider-photos/${U}/${U}.jpg`;

test("aceita só imagem do Storage do projeto, no bucket certo", () => {
  assert.equal(isStorageImageUrl(ok, "provider-photos", S), true);
  assert.equal(isStorageImageUrl(ok, "ad-images", S), false);
  assert.equal(isStorageImageUrl(`https://evil.com/provider-photos/${U}/${U}.jpg`, "provider-photos", S), false);
  assert.equal(isStorageImageUrl(`${S}/storage/v1/object/public/provider-photos/../x.jpg`, "provider-photos", S), false);
  assert.equal(isStorageImageUrl(ok, "provider-photos", undefined), false);
});

test("devolve o caminho do arquivo", () => {
  assert.equal(storagePathFromUrl(ok, "provider-photos", S), `${U}/${U}.jpg`);
  assert.equal(storagePathFromUrl("https://x.com/a.jpg", "provider-photos", S), null);
});
