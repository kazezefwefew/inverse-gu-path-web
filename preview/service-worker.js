"use strict";
/* 逆命蛊途 PWA service worker（V0.9.7.1）
   策略：导航/HTML/JS/CSS = network-first（网络成功则更新缓存，失败回退缓存，不锁旧版）；
        图片/音频 = cache-first（命中即返回，未命中网络取并存）；其它直通。
   activate 清非当前版本旧缓存 + clients.claim；不 skipWaiting（配合页面“新版本提示”，用户决定是否激活）。
   全程 try/catch / catch()，注册或取数失败都不影响游戏。
   ★维护提醒：每次升级版本化文件名（如 game.vNNNN.js / style.vNNNN.css / audio.vNNNN.js / gu_catalog?v=...）
     务必同步修改下方 CACHE 版本号与 CORE 列表，否则弱网 network-first 回退可能命中旧资源。 */
const CACHE = "nmg-pwa-v0972";
const CORE = [
  "./",
  "./index.html",
  "./style.v0972.css",
  "./game.v0972.js",
  "./audio.v0962.js",
  "./gu_catalog.js?v=v0970",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  // 逐个 add，单个资源失败不致整批 install 失败（保守，不一次缓存过多大资源）。
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return Promise.all(CORE.map((url) => cache.add(url).catch(() => {})));
    }).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});

function isHtmlLike(req, url) {
  return req.mode === "navigate" ||
    req.destination === "document" ||
    req.destination === "script" ||
    req.destination === "style" ||
    /\.(html|js|mjs|css)(\?|$)/.test(url.pathname);
}

function isMediaLike(req, url) {
  return req.destination === "image" ||
    req.destination === "audio" ||
    req.destination === "video" ||
    req.destination === "font" ||
    /\.(png|jpe?g|gif|webp|avif|svg|ico|mp3|m4a|ogg|wav|woff2?|ttf|otf)(\?|$)/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  // 仅处理同源请求，跨域（CDN/字体等）直通，避免缓存不透明响应。
  if (url.origin !== self.location.origin) return;

  if (isHtmlLike(req, url)) {
    // network-first：网络成功更新缓存；失败回退缓存；导航失败兜底 index.html。
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          // 离线兜底：脚本/样式带 query 时也尝试忽略 query 命中预缓存裸路径项。
          return caches.match(req, { ignoreSearch: true }).then((loose) => {
            if (loose) return loose;
            if (req.mode === "navigate" || req.destination === "document") {
              return caches.match("./index.html");
            }
            return undefined;
          });
        });
      })
    );
    return;
  }

  if (isMediaLike(req, url)) {
    // cache-first：命中即返回；未命中网络取并存。
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }
  // 其它请求直通（不调用 respondWith）。
});
