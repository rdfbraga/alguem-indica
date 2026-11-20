/* Service worker mínimo do Alguém indica?
 * - Só trata NAVEGAÇÕES: tenta a rede e, se estiver sem internet, mostra /offline.html.
 * - Não guarda páginas, dados nem respostas da API (conteúdo é privado dos moradores).
 * - Qualquer outra requisição segue direto para a rede. */
const CACHE = "ai-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/logo-icon.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Só abrir páginas (GET). Envios de formulário, API e arquivos seguem direto para a rede.
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
