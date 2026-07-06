/* =====================================================================
 * 《逆命蛊途》Service Worker —— V0.9.24 离线护符
 *
 * 背景：github.io 在部分网络下被间歇性连接重置(ERR_CONNECTION_RESET)，
 * 玩家（尤其 app 壳）启动即白屏。本 SW 让玩家只要成功进过一次游戏，
 * 之后断网/被重置也能离线开玩；网络恢复时照常走 V0.9.8.8 更新闸拉新版。
 *
 * 策略总览：
 * - 页面导航(index.html)：网络优先。超时(5s)只是"先用缓存应答导航"，网络请求
 *   绝不中断——一旦成功就后台成套回填，慢网玩家下次启动即新版。网络请求保留
 *   原查询串(?_upd/?dev)，更新闸的 CDN 击穿语义不变。
 * - 壳芯成套(原子核心集)：缓存里的 index 与它引用的快照永远成套更新——先把
 *   index 引用的全部核心文件(game/style/audio/telemetry 快照、gu_catalog)备齐，
 *   才落盘新 index；任何一个失败都保持旧的一整套。绝不出现"新壳找不到新芯"。
 * - version.json：永不拦截、永不缓存——更新闸必须看到真实线上版本。
 *   （旧 PWA 时代的 sw.js 把 version.json 也缓存了，正是"更新后仍旧版"的帮凶，切勿重蹈。）
 * - 其余同源资源(图片/音频等)：缓存优先，未中取网络、先回响应后台回填。
 *   注意：不带版本号的资源(assets/ 下图片音频)一旦入缓存即长期生效——原地替换
 *   同名图对已装 SW 的玩家不生效，换图请改文件名（与快照版本化同一纪律）。
 * - 版本化快照回填时清同族旧版（同族=同目录同名不同 vNNNN），缓存不膨胀。
 * - 媒体 Range 请求：缓存命中时切出标准 206 片段；未命中且从 0 起读则整取缓存，
 *   未命中且中途 seek 则直连网络不缓存残片。避免 206 残片进缓存。
 * - 双入口隔离：缓存名掺 scope 路径，正式根与 preview/ 各用各的缓存；根 SW 对
 *   子目录(preview/)的导航一律放行不接管。
 * - 跨域请求(遥测等)一律不拦截。
 * - 本文件不做版本化快照：SW 有自己的更新机制（按 URL 字节比对），文件名必须稳定。
 * ===================================================================== */

const SCOPE_PATH = new URL(self.registration.scope).pathname; // 如 "/" 或 "/inverse-gu-path-web/preview/"
const CACHE_NAME = "nmg-off-v2::" + SCOPE_PATH;               // 掺 scope：正式根与 preview 互不串缓存
const INDEX_KEY = new URL("./index.html", self.registration.scope).href;
const NAV_TIMEOUT_MS = 5000;      // 超时只决定"何时先用缓存应答"，不中断网络请求
const INSTALL_PRECACHE_MS = 15000; // install 预缓存的软上限：超时放行安装，导航自会回填

/* "永不拦截/永不缓存"名单：fetch 拦截与消息补录共用同一谓词，防两处漂移 */
function isBypassed(url) {
  return /(?:^|\/)(version\.json|sw\.js)$/.test(url.pathname);
}

/* 版本化快照的"同族"识别（同族只保留最新一份）。
 * 用完整 pathname 只把 vNNNN 归一，天然区分目录（根/preview 同名快照不同族）、
 * 且自动覆盖将来新增的任何 xxx.vNNNN.js/css 族，无需维护名单。 */
function versionFamily(url) {
  if (/(?:^|\/)[^/]+\.v\d+\.(?:js|css)$/.test(url.pathname)) return url.pathname.replace(/\.v\d+\./, ".v#.");
  if (/(?:^|\/)gu_catalog\.js$/.test(url.pathname)) return url.pathname; // 靠 ?v= 查询串区分版本
  return null;
}

async function pruneFamily(cache, url) {
  const fam = versionFamily(url);
  if (!fam) return;
  const keys = await cache.keys();
  await Promise.all(keys.map((k) => {
    const ku = new URL(k.url);
    return (ku.href !== url.href && versionFamily(ku) === fam) ? cache.delete(k) : null;
  }));
}

async function putWithPrune(cache, url, resp) {
  await cache.put(url.href, resp);
  await pruneFamily(cache, url);
}

/* 从 index.html 文本里解析核心引用（快照 js/css 与 gu_catalog）——"芯"的清单 */
function extractCoreRefs(html) {
  const refs = new Set();
  const re = /(?:src|href)="([^"]+\.v\d+\.(?:js|css)|gu_catalog\.js(?:\?[^"]*)?)"/g;
  let m;
  while ((m = re.exec(html))) {
    try { refs.add(new URL(m[1], INDEX_KEY).href); } catch (e) {}
  }
  return [...refs];
}

function htmlResponse(html) {
  // 合成干净 200：顺带规避"redirected 响应回给导航被判网络错误"的浏览器行为
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function fetchFreshIndexHtml(reqUrl) {
  const resp = await fetch(reqUrl, { cache: "no-store" });
  if (!resp || !resp.ok) throw new Error("index http " + (resp && resp.status));
  return await resp.text();
}

/* 壳芯成套落盘：先备齐 index 引用的全部核心文件，再写 index，最后清同族旧版。
 * 任何核心文件失败即整体放弃（抛错），缓存保持旧的一整套。 */
async function cacheIndexAtomic(html) {
  const cache = await caches.open(CACHE_NAME);
  const refs = extractCoreRefs(html);
  for (const href of refs) {
    if (await cache.match(href)) continue;
    const r = await fetch(href);
    if (!r || r.status !== 200) throw new Error("核心资源未备齐: " + href);
    await cache.put(href, r);
  }
  await cache.put(INDEX_KEY, htmlResponse(html));
  for (const href of refs) {
    try { await pruneFamily(cache, new URL(href)); } catch (e) {}
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // 预缓存整套壳芯：让"首访后立刻断网/秒关页"也有完整可玩的一套；
    // 软超时放行安装（劣质网络下不拖死 SW 生命周期），导航时自会回填
    await Promise.race([
      fetchFreshIndexHtml(INDEX_KEY).then((html) => cacheIndexAtomic(html)).catch(() => {}),
      new Promise((res) => setTimeout(res, INSTALL_PRECACHE_MS)),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // 只清理：旧 PWA 时代缓存、v1 旧名缓存、本 scope 的其他版本缓存。
    // 其他 scope（如 preview）的缓存是别人的家当，不碰。
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      const legacy = k.startsWith("niming-pwa-") || k === "nmg-off-v1";
      const mineOld = k.startsWith("nmg-off-") && k.endsWith("::" + SCOPE_PATH) && k !== CACHE_NAME;
      return (legacy || mineOld) ? caches.delete(k) : null;
    }));
    await self.clients.claim(); // 立即接管已开页面，首访补录才有对象
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 遥测等跨域：直连不拦截
  if (isBypassed(url)) return;                     // version.json / sw.js：直连网络，绝不缓存
  if (req.mode === "navigate") {
    // 只接管指向本 scope index 的导航；子目录（根 scope 下的 preview/）放行直连，
    // 免得根 SW 把正式 index 喂给 preview 地址、污染 dev 自测
    if (url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + "index.html") {
      event.respondWith(handleNavigate(event, req));
    }
    return;
  }
  event.respondWith(handleAsset(event, req, url));
});

/* 导航：网络优先。5s 内网络到 → 直接用新的；超时/失败 → 回缓存离线开。
 * 关键：超时不中断网络请求，成功后 waitUntil 里成套回填——慢网玩家本次玩缓存版，
 * 下次启动即新版，不会被钉死在旧版（更新闸的"立即更新"也因此总能自愈）。 */
function handleNavigate(event, req) {
  const netPromise = fetchFreshIndexHtml(req.url); // 保留 ?_upd/?dev 查询串
  event.waitUntil(netPromise.then((html) => cacheIndexAtomic(html)).catch(() => {}));
  return (async () => {
    const winner = await Promise.race([
      netPromise.then((html) => htmlResponse(html)).catch(() => null),
      new Promise((res) => setTimeout(() => res("timeout"), NAV_TIMEOUT_MS)),
    ]);
    if (winner && winner !== "timeout") return winner;
    const cached = await (await caches.open(CACHE_NAME)).match(INDEX_KEY);
    if (cached) return cached;
    // 无缓存兜底（首访即断网/首访慢网）：死等网络——8 秒能成也比 5 秒判死强
    return netPromise.then((html) => htmlResponse(html));
  })();
}

/* 资源：缓存优先 → 未中取网络。先回响应、写缓存挂 waitUntil，不阻塞页面收流。 */
async function handleAsset(event, req, url) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url.href);
  const rangeHeader = req.headers.get("range");
  if (cached) {
    return rangeHeader ? sliceCachedRange(cached, rangeHeader) : cached;
  }
  if (rangeHeader && !/^bytes=0-$/i.test(rangeHeader.trim())) {
    return fetch(req); // 中途 seek 且无缓存：直连拿 206，不把残片写进缓存
  }
  const resp = await fetch(url.href); // 剥掉 Range 整取（对 bytes=0- 回 200 整文件，浏览器接受）
  if (resp && resp.status === 200) {
    const clone = resp.clone();
    event.waitUntil((async () => {
      try { await putWithPrune(cache, url, clone); } catch (e) {}
    })());
  }
  return resp;
}

/* 从缓存的完整 200 里切出标准 206 片段（老内核 WebView 媒体栈 seek 依赖 206） */
async function sliceCachedRange(cached, rangeHeader) {
  const m = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) return cached; // 多段等罕见 Range：回整 200，浏览器自行消化
  const buf = await cached.clone().arrayBuffer();
  const total = buf.byteLength;
  const start = Number(m[1]);
  const end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
  if (start >= total || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + total } });
  }
  const headers = new Headers(cached.headers);
  headers.set("Content-Range", "bytes " + start + "-" + end + "/" + total);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: "Partial Content", headers });
}

/* 首访补录：SW 首次安装时页面资源已加载完（不经 SW，不会自动进缓存）。
 * 页面把已加载的同源资源清单发过来（页面侧已增量去重），这里逐条补进缓存。
 * 注：图片多命中 HTTP 缓存不重复下载；HTMLAudio 分段读过的音频会整文件补一遍
 * ——这是离线可玩音频的必要成本，串行执行以免挤占前台带宽。 */
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "NMG_CACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const raw of data.urls) {
      try {
        const url = new URL(raw, self.location.href);
        if (url.protocol !== "http:" && url.protocol !== "https:") continue; // blob:/data: 之类不进缓存
        if (url.origin !== self.location.origin) continue;
        if (isBypassed(url)) continue;
        if (await cache.match(url.href)) continue;
        const resp = await fetch(url.href);
        if (resp && resp.status === 200) await putWithPrune(cache, url, resp);
      } catch (e) { /* 单条失败不影响其余 */ }
    }
  })());
});
