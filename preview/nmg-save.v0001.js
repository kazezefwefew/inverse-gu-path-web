"use strict";
/* =====================================================================
 * 《逆命蛊途》存档基础设施模块  nmg-save.js  (V0.9.36 批次B-2 模块化)
 * 从 game.js 抽出的存档写入/迁移/导出导入基础设施：loadJsonStore/saveJsonStore、
 * safeWriteJson(原子写唯一入口)、SAVE_VERSION+migrateSavesIfNeeded、导出导入四件套、savesImporting 标志。
 * ⚠ 必须在 game.js 之前加载：本模块含顶层立即执行 migrateSavesIfNeeded()/requestPersistentStorage()，
 *   且 game.js 运行期大量写档走 safeWriteJson；先加载确保迁移在任何读档前完成。与 nmg-data 无依赖、先后无所谓，均排在 game.v 之前。
 * ===================================================================== */

function loadJsonStore(key) {
  // 数组也要拒绝：往数组挂字符串键后 JSON.stringify 会静默丢弃，成就将永久写不进去。
  try { const o = JSON.parse(localStorage.getItem(key)); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}
function saveJsonStore(key, obj) {
  try { safeWriteJson(key, JSON.stringify(obj)); } catch (e) { /* 存储不可用忽略，不影响游戏 */ }
}

/* ===== V0.9.25 存档保险（P0-1）=====
 * b. 原子写：先写临时键→读回校验可解析→再覆盖主键；关键档（续局）覆盖前把旧值落 last-known-good，载入失败自动回滚。
 * c. navigator.storage.persist() 申请持久化（老内核无此 API 静默跳过）。
 * d. SAVE_VERSION + migrateSavesIfNeeded：跨版本存档结构迁移从此收拢一处，新迁移一律加 case。 */
const SAVE_VERSION = 1;
const SAVE_VERSION_KEY = "nmg.save.version";
const SAVE_LKG_SUFFIX = ".lkg";
function safeWriteJson(key, jsonText, { keepLkg = false } = {}) {
  try {
    const tmpKey = key + ".tmp";
    localStorage.setItem(tmpKey, jsonText);
    const back = localStorage.getItem(tmpKey);
    if (back !== jsonText) { localStorage.removeItem(tmpKey); return false; }
    JSON.parse(back); // 校验可解析（写坏/截断在此抛出，主键不受影响）
    if (keepLkg) {
      const cur = localStorage.getItem(key);
      if (cur) localStorage.setItem(key + SAVE_LKG_SUFFIX, cur);
    }
    localStorage.setItem(key, back);
    localStorage.removeItem(tmpKey);
    return true;
  } catch (e) {
    try { localStorage.removeItem(key + ".tmp"); } catch (e2) { /* 忽略 */ }
    // 配额兜底（code-review 抓的坑）：三份同存(主+lkg+tmp)在临界设备会让写档静默停更——
    // 先确认内容本身可解析，再清掉本键工作副本腾空间，退回旧式原地覆盖（宁可没有回滚档也不能停更）。
    try { JSON.parse(jsonText); } catch (e3) { return false; } // 坏内容绝不直写，也不动 lkg
    try {
      localStorage.removeItem(key + SAVE_LKG_SUFFIX);
      localStorage.setItem(key, jsonText);
      return true;
    } catch (e4) { return false; }
  }
}
function requestPersistentStorage() {
  try { navigator.storage?.persist?.().then(() => {}).catch(() => {}); } catch (e) { /* 老内核跳过 */ }
}
function migrateSavesIfNeeded() {
  let v = 0;
  try { v = Number(localStorage.getItem(SAVE_VERSION_KEY)) || 0; } catch (e) { return; }
  if (v >= SAVE_VERSION) return;
  try {
    // v0 → v1：首个版本仅盖章。既有零散老档兜底（maxLifespan 回填等）保持原位；今后结构性迁移在这里加 case。
    localStorage.setItem(SAVE_VERSION_KEY, String(SAVE_VERSION));
  } catch (e) { /* 忽略 */ }
}
migrateSavesIfNeeded();
requestPersistentStorage();

/* a. 存档导出/导入：本游戏前缀键打包（JSON→base64+校验和），剪贴板与文件双通道；导入前校验+自动备份现档。
 * 导出与导入两侧使用同一前缀白名单（code-review 抓的不对称坑：github.io 同 origin 上其他项目的键
 * 会被打包泄露、导入时又被旧快照覆盖）。 */
const SAVE_EXPORT_PREFIX = "NMGV1.";
const SAVE_OWN_PREFIXES = Object.freeze(["nmg.", "reverseGu.", "niming."]);
function isOwnSaveKey(k) { return !!k && SAVE_OWN_PREFIXES.some((p) => k.startsWith(p)); }
function saveChecksum(s) { let h = 5381; for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; } return h.toString(36); }
function collectAllSaveData() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!isOwnSaveKey(k) || k.endsWith(".tmp") || k.endsWith(SAVE_LKG_SUFFIX)) continue;
      data[k] = localStorage.getItem(k);
    }
  } catch (e) { /* 忽略 */ }
  return data;
}
function buildSaveExport() {
  const payload = { fmt: "nmg-save", v: SAVE_VERSION, at: Date.now(), build: window.__NMG_BUILD__ || "", data: collectAllSaveData() };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return SAVE_EXPORT_PREFIX + saveChecksum(json) + "." + b64;
}
function parseSaveExport(text) {
  const t = String(text || "").trim();
  if (!t.startsWith(SAVE_EXPORT_PREFIX)) return { ok: false, err: "这不是本游戏的存档码（头部不符）。" };
  const rest = t.slice(SAVE_EXPORT_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot <= 0) return { ok: false, err: "存档码结构不完整。" };
  let json;
  try { json = decodeURIComponent(escape(atob(rest.slice(dot + 1)))); } catch (e) { return { ok: false, err: "解码失败——存档码可能被截断，请重新完整复制。" }; }
  if (saveChecksum(json) !== rest.slice(0, dot)) return { ok: false, err: "校验和不符（内容缺损或被改动），已拒绝导入。" };
  let payload;
  try { payload = JSON.parse(json); } catch (e) { return { ok: false, err: "内容无法解析。" }; }
  if (!payload || payload.fmt !== "nmg-save" || !payload.data || typeof payload.data !== "object") return { ok: false, err: "不是本游戏的存档格式。" };
  // code-review 抓的坑：新版本导出的档灌进旧构建会按旧结构误读且版本戳被抬高、错过未来迁移——拒绝并提示先升级。
  if (Number(payload.v) > SAVE_VERSION) return { ok: false, err: `此存档来自更新版本的游戏（存档结构 v${payload.v}），请先把本端更新到最新版再导入。` };
  return { ok: true, payload };
}
function downloadTextFile(filename, text) {
  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { return false; }
}
function saveStamp() { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }
// V0.9.32.1：导入落盘后到 reload 的窗口内，pagehide/visibilitychange 触发的自动存档会用导入前的旧局覆盖刚导入的续局档——导入期间置真，令 saveRunStateToStorage 让路。
let savesImporting = false;
// 导入 = 先自动下载当前档备份 → 内存快照兜底 → 清掉本游戏前缀键 → 只写白名单键 → 刷新页面重载。
// code-review 抓的坑：原先「先删后写、无回滚」在配额爆掉时会把现档就地毁掉（半删半写）——
// 现在任何一步失败都用内存快照原样回滚，现档无损。
function applySaveImport(payload) {
  downloadTextFile(`逆命蛊途-导入前备份-${saveStamp()}.txt`, buildSaveExport()); // 尽力而为的外部备份
  const snapshot = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isOwnSaveKey(k)) snapshot[k] = localStorage.getItem(k);
    }
  } catch (e) { return false; }
  const restoreSnapshot = () => {
    try {
      const cur = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isOwnSaveKey(k)) cur.push(k); }
      cur.forEach((k) => localStorage.removeItem(k));
      Object.entries(snapshot).forEach(([k, v]) => localStorage.setItem(k, v));
      return true;
    } catch (e) { return false; }
  };
  try {
    Object.keys(snapshot).forEach((k) => localStorage.removeItem(k));
    Object.entries(payload.data).forEach(([k, v]) => {
      if (typeof v !== "string") return;
      if (!isOwnSaveKey(k)) return; // 只接受本游戏白名单键（防外来键覆盖同域其他数据）
      if (k.endsWith(".tmp") || k.endsWith(SAVE_LKG_SUFFIX)) return; // 内部工作键不接受外来写入
      localStorage.setItem(k, v);
    });
  } catch (e) {
    const restored = restoreSnapshot();
    console.warn(`[存档导入] 写入失败，${restored ? "已回滚原档" : "回滚可能不完整"}。`, e);
    return false;
  }
  // V0.9.32.1 数据保险：导入已落盘、即将 reload。reload 会触发 pagehide/visibilitychange 的自动存档，
  // 若此刻内存仍是导入前的旧局（地图态），会用旧局覆盖刚导入的续局档。置标志令自动存档在 reload 前让路。
  savesImporting = true;
  window.setTimeout(() => window.location.reload(), 600);
  return true;
}