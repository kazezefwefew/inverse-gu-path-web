"use strict";
/* =====================================================================
 * TapTap H5 云存档适配器
 * 本地 localStorage 是即时真相；云端只做异步备份与启动恢复。
 * 任何宿主/API/文件错误都必须降级为本地游戏，绝不向玩法层抛错。
 * ===================================================================== */
(function createCloudSaveModule(global) {
  const PLATFORM = "taptap-h5-demo";
  const ARCHIVE_NAME = "auto_save";
  const ARCHIVE_PATH = "nmg_auto_save.json";
  const META_HASH_KEY = "nmg.cloud.lastSyncedHash";
  const META_UPLOAD_AT_KEY = "nmg.cloud.lastUploadAt";
  const UPLOAD_INTERVAL_MS = 60000;
  const DIRTY_CHECK_MS = 15000;
  const OPERATION_TIMEOUT_MS = 8000;

  let cloudManager = null;
  let fileManager = null;
  let archive = null;
  let pendingConflict = null;
  let bootstrapPromise = null;
  let uploadPromise = null;
  let pollTimer = null;
  let retryTimer = null;
  const listeners = new Set();
  let state = Object.freeze({ status: "idle", message: "云存档尚未检查", lastSyncAt: 0, error: "" });

  function publish(status, message, extra = {}) {
    state = Object.freeze({ ...state, status, message, error: "", ...extra });
    listeners.forEach((listener) => { try { listener(state); } catch (e) { /* UI 监听失败不影响同步 */ } });
    return state;
  }
  function failState(error, message = "云存档同步失败，本机进度仍已保留") {
    const detail = error && typeof error === "object" ? String(error.errMsg || error.message || "") : String(error || "");
    return publish("error", message, { error: detail.slice(0, 180) });
  }
  function getStoredNumber(key) {
    try { return Number(global.localStorage?.getItem(key)) || 0; } catch (e) { return 0; }
  }
  function getStoredText(key) {
    try { return global.localStorage?.getItem(key) || ""; } catch (e) { return ""; }
  }
  function setStored(key, value) {
    try { global.localStorage?.setItem(key, String(value)); } catch (e) { /* 元数据失败不影响存档 */ }
  }
  function parseLocal() {
    return parseCloudSavePayload(buildCloudSavePayload());
  }
  function callHost(target, method, options = {}, timeoutMs = OPERATION_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        fn(value);
      };
      const timer = global.setTimeout(() => finish(reject, new Error(`${method} timeout`)), timeoutMs);
      timer?.unref?.();
      try {
        if (!target || typeof target[method] !== "function") throw new Error(`${method} unavailable`);
        target[method]({
          ...options,
          success: (result) => finish(resolve, result || {}),
          fail: (error) => finish(reject, error || new Error(`${method} failed`)),
        });
      } catch (error) {
        finish(reject, error);
      }
    });
  }
  async function writeLocalCloudFile(text) {
    const filePath = `${global.tap.env.USER_DATA_PATH}/${ARCHIVE_PATH}`;
    await callHost(fileManager, "writeFile", { filePath, data: text, encoding: "utf8" });
    return filePath;
  }
  async function downloadArchive(target) {
    const targetFilePath = `${global.tap.env.USER_DATA_PATH}/nmg_auto_save_download.json`;
    const result = await callHost(cloudManager, "getArchiveData", {
      archiveUUID: target.uuid,
      archiveFileId: target.fileId,
      targetFilePath,
    });
    const fileResult = await callHost(fileManager, "readFile", { filePath: result.filePath || targetFilePath, encoding: "utf8" });
    return String(fileResult.data || "");
  }
  async function uploadText(text, parsed, { ignoreThrottle = false } = {}) {
    if (uploadPromise) return uploadPromise;
    const now = Date.now();
    const lastUploadAt = getStoredNumber(META_UPLOAD_AT_KEY);
    const waitMs = UPLOAD_INTERVAL_MS - (now - lastUploadAt);
    if (!ignoreThrottle && waitMs > 0) {
      publish("pending", "本机进度已保存，等待云端同步");
      if (!retryTimer) {
        retryTimer = global.setTimeout(() => {
          retryTimer = null;
          requestSync("throttle-retry");
        }, waitMs + 20);
        retryTimer?.unref?.();
      }
      return state;
    }
    uploadPromise = (async () => {
      publish("syncing", "正在同步云存档…");
      const filePath = await writeLocalCloudFile(text);
      const options = {
        archiveMetaData: {
          name: ARCHIVE_NAME,
          summary: `逆命蛊途 ${global.__NMG_BUILD__ || ""} · ${new Date(parsed.payload.savedAt).toLocaleString()}`,
          playtime: 0,
        },
        archiveFilePath: filePath,
      };
      if (archive) {
        await callHost(cloudManager, "updateArchive", { archiveUUID: archive.uuid, ...options });
      } else {
        const created = await callHost(cloudManager, "createArchive", options);
        archive = { name: ARCHIVE_NAME, uuid: created.uuid || created.archiveUUID || "", fileId: created.fileId || "" };
      }
      const syncedAt = Date.now();
      setStored(META_HASH_KEY, parsed.payload.hash);
      setStored(META_UPLOAD_AT_KEY, syncedAt);
      return publish("synced", "云存档已同步", { lastSyncAt: syncedAt });
    })().catch((error) => failState(error)).finally(() => { uploadPromise = null; });
    return uploadPromise;
  }
  async function requestSync(reason = "manual") {
    try {
      if (state.status === "error") {
        if (reason !== "manual") return state;
        bootstrapPromise = null;
        cloudManager = null;
        fileManager = null;
        archive = null;
        return await bootstrap();
      }
      if (state.status === "conflict") return state;
      if (!cloudManager || !fileManager || state.status === "unavailable" || state.status === "checking") return state;
      const parsed = parseLocal();
      if (!parsed.ok || !hasCloudGameplayData(parsed.payload)) return publish("ready", "暂无需要同步的进度");
      if (parsed.payload.hash === getStoredText(META_HASH_KEY)) return publish("synced", "云存档已同步", { lastSyncAt: getStoredNumber(META_UPLOAD_AT_KEY) });
      publish("pending", reason === "manual" ? "正在准备云端同步…" : "检测到新进度，等待云端同步");
      return await uploadText(JSON.stringify(parsed.payload), parsed);
    } catch (error) {
      return failState(error);
    }
  }
  function startDirtyPolling() {
    if (pollTimer || state.status === "unavailable") return;
    pollTimer = global.setInterval(() => { requestSync("dirty-check"); }, DIRTY_CHECK_MS);
    pollTimer?.unref?.();
  }
  async function bootstrapInternal() {
    if (global.NMG_PLATFORM !== PLATFORM) return publish("unavailable", "当前环境不使用 TapTap 云存档");
    try {
      if (!global.tap || typeof global.tap.getCloudSaveManager !== "function" || typeof global.tap.getFileSystemManager !== "function" || !global.tap.env?.USER_DATA_PATH) {
        return publish("unavailable", "当前 TapTap 环境未开放云存档");
      }
      publish("checking", "正在检查云存档…");
      cloudManager = global.tap.getCloudSaveManager();
      fileManager = global.tap.getFileSystemManager();
      const listResult = await callHost(cloudManager, "getArchiveList");
      const saves = Array.isArray(listResult.saves) ? listResult.saves : [];
      archive = saves.find((item) => item && item.name === ARCHIVE_NAME) || null;
      const local = parseLocal();
      if (!local.ok) throw new Error(local.err || "local save invalid");
      if (!archive) {
        if (!hasCloudGameplayData(local.payload)) {
          const ready = publish("ready", "云存档已就绪，暂无本机进度");
          startDirtyPolling();
          return ready;
        }
        const uploaded = await uploadText(JSON.stringify(local.payload), local, { ignoreThrottle: true });
        startDirtyPolling();
        return uploaded;
      }
      const cloudText = await downloadArchive(archive);
      const cloud = parseCloudSavePayload(cloudText);
      if (!cloud.ok) throw new Error(cloud.err || "cloud save invalid");
      if (!hasCloudGameplayData(local.payload)) {
        if (!applyCloudSavePayload(cloud.payload)) throw new Error("cloud restore failed");
        setStored(META_HASH_KEY, cloud.payload.hash);
        pendingConflict = null;
        const restored = publish("restored", "已从云端恢复上次进度", { lastSyncAt: cloud.payload.savedAt });
        startDirtyPolling();
        return restored;
      }
      if (local.payload.hash === cloud.payload.hash) {
        setStored(META_HASH_KEY, cloud.payload.hash);
        pendingConflict = null;
        const synced = publish("synced", "云存档已同步", { lastSyncAt: Math.max(cloud.payload.savedAt, getStoredNumber(META_UPLOAD_AT_KEY)) });
        startDirtyPolling();
        return synced;
      }
      const lastSyncedHash = getStoredText(META_HASH_KEY);
      if (lastSyncedHash && local.payload.hash === lastSyncedHash) {
        if (!applyCloudSavePayload(cloud.payload)) throw new Error("newer cloud restore failed");
        setStored(META_HASH_KEY, cloud.payload.hash);
        pendingConflict = null;
        const restored = publish("restored", "已从云端恢复较新的进度", { lastSyncAt: cloud.payload.savedAt });
        startDirtyPolling();
        return restored;
      }
      if (lastSyncedHash && cloud.payload.hash === lastSyncedHash) {
        pendingConflict = null;
        const uploaded = await uploadText(JSON.stringify(local.payload), local, { ignoreThrottle: true });
        startDirtyPolling();
        return uploaded;
      }
      pendingConflict = { local, cloud, localText: JSON.stringify(local.payload) };
      const conflict = publish("conflict", "检测到本机与云端进度不同，请选择保留版本", { error: "未选择前不会覆盖任何一边" });
      startDirtyPolling();
      return conflict;
    } catch (error) {
      const failed = failState(error);
      startDirtyPolling();
      return failed;
    }
  }
  function bootstrap() {
    if (!bootstrapPromise) bootstrapPromise = bootstrapInternal().catch((error) => failState(error));
    return bootstrapPromise;
  }
  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    try { listener(state); } catch (e) { /* 忽略 */ }
    return () => listeners.delete(listener);
  }
  async function resolveConflict(choice) {
    try {
      if (state.status !== "conflict" || !pendingConflict) return state;
      if (choice === "local") {
        const chosen = pendingConflict;
        const result = await uploadText(chosen.localText, chosen.local, { ignoreThrottle: true });
        if (result.status === "synced") pendingConflict = null;
        return result;
      }
      if (choice === "cloud") {
        const chosen = pendingConflict;
        setStored("nmg.cloud.conflictLocalBackup", chosen.localText);
        if (!applyCloudSavePayload(chosen.cloud.payload)) throw new Error("conflict cloud restore failed");
        setStored(META_HASH_KEY, chosen.cloud.payload.hash);
        pendingConflict = null;
        const restored = publish("restored", "已恢复云端进度，本机冲突档已留作备份", { lastSyncAt: chosen.cloud.payload.savedAt });
        const reloadTimer = global.setTimeout(() => { try { global.location?.reload?.(); } catch (e) { /* 重载失败时玩家可手动重开 */ } }, 350);
        reloadTimer?.unref?.();
        return restored;
      }
      return state;
    } catch (error) {
      return failState(error, "处理存档冲突失败，两份进度均未主动删除");
    }
  }

  global.NMGCloudSave = Object.freeze({
    bootstrap,
    requestSync,
    flush: (reason = "lifecycle") => requestSync(reason),
    resolveConflict,
    getStatus: () => state,
    subscribe,
  });
})(typeof window !== "undefined" ? window : globalThis);
