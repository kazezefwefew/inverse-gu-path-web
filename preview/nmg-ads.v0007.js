"use strict";
/* nmg-ads.js: AD-1 TapTap 激励视频广告接线（正式模式，仅 TapTap H5 小游戏容器生效）。
 *
 * 铁律一·能力探测门控：
 *   - 仅当宿主注入全局 tap.createRewardedVideoAd、且配了广告位 ID 时才「可用」。
 *   - 网页版(nimingutu.com)、本地开发、非 TapTap 环境 tap 未定义 → 全部降级为不可用；
 *     调用方据 NmgAds.isRewardedAvailable()/isRewardedReady() 决定「看广告」入口显隐，游戏零影响。
 *   - 同一套代码在所有环境安全运行，绝不因广告报错影响玩法。
 *
 * 铁律二·官方生命周期（吸取 codex v0.9.44 回退教训）：
 *   - 正常生命周期复用单例；load/show 超时或不可恢复错误时隔离旧实例并重建，绝不传 multiton。
 *   - 先 onLoad 再 show：绝不「创建即当就绪」，也绝不「先 show 再 load」。
 *   - 关闭后由宿主自动预载下一条；本模块只在需要时显式补一次 load。
 *   - 只有 onClose 回调 res.isEnded === true 才发奖；加载与播放使用分离 watchdog 防永久 busy。
 *
 * 广告位 ID 1054323 = TapTap 官方「小游戏广告」横屏激励视频位(space_id，对应 tap.createRewardedVideoAd 的 adUnitId)。
 * 【v0.9.48 关键修正】此前误用 1059636（那是 Dirichlet 媒体平台的推广位，属另一套要软著的独立广告网络，
 *   本游戏的广告变现走的不是那条），导致真机永远不填充/没按钮。经 TapTap 官方 MCP(check_ads_status)
 *   实拉后台确认：本应用广告状态=已生效，横屏位(type=1)=1054323、竖屏位(type=2)=1054324；本游戏横屏，取 1054323。
 * 走 TapTap「H5 小游戏桥接」路径(宿主注入 tap 全局)，不是 Dirichlet 原生 Android SDK。
 */
(function (global) {
  const REWARDED_AD_UNIT_ID = "1054323"; // TapTap 官方小游戏横屏激励视频位(MCP 实拉，type=1)
  const LOAD_WAIT_MS = 15000;            // 素材 15 秒仍未就绪就退回按钮并重建，避免“广告加载中”卡死
  const SHOW_WAIT_MS = 120000;           // 播放最长等 120 秒 onClose，不能用旧 30 秒误杀长视频
  /* V0.9.51 用户定调·去掉会话门禁：60 秒延迟不是 TapTap 硬性规定（官方接入工作流无时长要求），
   *   系当初 AD-2 自定的 UX 保护；现改为「进游戏即可显示激励入口」，isSessionEligible 恒真。
   *   保留此函数与所有 isSessionEligible() 调用点（入口显隐仍走它），日后要恢复门禁只需改这里一处。 */
  function isSessionEligible() {
    return true;
  }

  let _ad = null;             // 当前可用实例（正常生命周期复用；故障恢复才替换）
  let _instance = null;       // 当前实例状态；每组 SDK listeners 闭包绑定自己的 state
  let _instanceGeneration = 0;
  let _requestGeneration = 0;
  let _pendingReward = null;  // 当前玩家请求；唯一跨 placement 并发锁
  let _waitTimer = null;

  function hasHostAd() {
    return typeof global.tap !== "undefined"
      && global.tap
      && typeof global.tap.createRewardedVideoAd === "function";
  }
  /* 对外可用性：宿主有广告能力 且 配了广告位 ID。用于门控入口是否存在。 */
  function isRewardedAvailable() {
    return hasHostAd() && Boolean(REWARDED_AD_UNIT_ID);
  }
  /* 更强的「此刻能不能立刻放」：可用 且 素材已就绪。用于「仅广告就绪才显示按钮」，避免玩家点了没反应。 */
  function isRewardedReady() {
    const state = ensureAd();
    return Boolean(isRewardedAvailable() && state && state.loaded && !state.loadToken && !state.activeRequest);
  }

  function safeToast(title) {
    try { if (global.tap && global.tap.showToast) global.tap.showToast({ title, icon: "none" }); } catch (e) { /* 忽略 */ }
  }
  function clearWait(request) {
    if (!request || request.timer === null) return;
    try { clearTimeout(request.timer); } catch (e) {}
    if (_waitTimer === request.timer) _waitTimer = null;
    request.timer = null;
  }

  function finishPending(request, ok, { toast = false } = {}) {
    if (!request || request.done) return false;
    request.done = true;
    clearWait(request);
    if (_pendingReward === request) _pendingReward = null;
    if (toast) safeToast("暂无广告，请稍后再试");
    try { request.callback(ok === true); } catch (e) { /* 业务回调异常不外溢 */ }
    return true;
  }

  function armWait(request, state) {
    if (!request || request.done || _pendingReward !== request) return;
    clearWait(request);
    const waitMs = request.phase === "showing" ? SHOW_WAIT_MS : LOAD_WAIT_MS;
    request.timer = setTimeout(() => {
      if (_pendingReward !== request || request.done) return;
      finishPending(request, false, { toast: true });
      // 超时是实例级不可恢复终态：隔离旧 listeners/Promise，并立刻准备新实例，后续请求不会饿死。
      retireInstance(state);
      ensureAd();
    }, waitMs);
    _waitTimer = request.timer;
  }

  function isCurrentInstance(state) {
    return Boolean(state && !state.retired && _instance === state && _ad === state.ad);
  }

  function detachListener(ad, name, handler) {
    try { if (typeof ad?.[name] === "function") ad[name](handler); } catch (e) { /* 宿主可不支持解绑 */ }
  }

  function retireInstance(state) {
    if (!state || state.retired) return;
    state.retired = true;
    detachListener(state.ad, "offLoad", state.handlers.load);
    detachListener(state.ad, "offError", state.handlers.error);
    detachListener(state.ad, "offClose", state.handlers.close);
    try { if (typeof state.ad?.destroy === "function") state.ad.destroy(); } catch (e) { /* 闭包代次仍会隔离旧回调 */ }
    if (_instance === state) { _instance = null; _ad = null; }
  }

  function recoverInstance(state, request = null) {
    if (request && _pendingReward === request) finishPending(request, false, { toast: true });
    retireInstance(state);
    ensureAd();
  }

  function requestLoad(state) {
    if (!isCurrentInstance(state) || state.loadToken || state.activeRequest) return false;
    const token = { instanceGeneration: state.generation };
    state.loadToken = token;
    state.loaded = false;
    try {
      const p = state.ad.load();
      if (p && p.catch) p.catch(() => {
        if (!isCurrentInstance(state) || state.loadToken !== token) return;
        state.loadToken = null;
        recoverInstance(state, state.waitingRequest);
      });
      return true;
    } catch (e) {
      if (isCurrentInstance(state) && state.loadToken === token) state.loadToken = null;
      recoverInstance(state, state.waitingRequest);
      return false;
    }
  }

  /* 真正调用 show——只在素材就绪时进入。 */
  function doShow(state, request) {
    if (!isCurrentInstance(state) || !request || request.done || _pendingReward !== request || !state.loaded || state.activeRequest) return false;
    clearWait(request);
    const token = { instanceGeneration: state.generation, requestGeneration: request.generation };
    state.showToken = token;
    state.waitingRequest = null;
    state.activeRequest = request;
    request.phase = "showing";
    state.loaded = false;
    try {
      const p = state.ad.show();
      if (p && p.catch) p.catch(() => {
        if (!isCurrentInstance(state) || state.showToken !== token || state.activeRequest !== request) return;
        recoverInstance(state, request);
      });
      armWait(request, state);
      return true;
    } catch (e) {
      recoverInstance(state, request);
      return false;
    }
  }

  function ensureAd() {
    if (isCurrentInstance(_instance) || !isRewardedAvailable()) return _instance;
    try {
      const ad = global.tap.createRewardedVideoAd({ adUnitId: REWARDED_AD_UNIT_ID }); // 正常复用；故障恢复才重建
      const state = {
        generation: ++_instanceGeneration,
        ad, loaded: false, retired: false,
        loadToken: null, showToken: null,
        waitingRequest: null, activeRequest: null,
        handlers: {},
      };
      _ad = ad;
      _instance = state;
      state.handlers.load = () => {
        if (!isCurrentInstance(state) || !state.loadToken) return;
        state.loadToken = null;
        state.loaded = true;
        const request = state.waitingRequest;
        if (request && request === _pendingReward && !request.done) doShow(state, request);
      };
      state.handlers.error = (err) => {
        if (!isCurrentInstance(state)) return;
        try { console.warn("[广告] 激励视频错误", err); } catch (e) {}
        recoverInstance(state, state.activeRequest || state.waitingRequest);
      };
      state.handlers.close = (res) => {
        if (!isCurrentInstance(state)) return;
        const request = state.activeRequest;
        if (!request || !state.showToken || request.phase !== "showing") return; // 重复/无主 close
        state.activeRequest = null;
        state.showToken = null;
        const ok = res?.isEnded === true; // 只有宿主明确返回布尔 true 才算完整观看
        state.loaded = false;
        if (request === _pendingReward) finishPending(request, ok);
        requestLoad(state); // 正常关闭后沿用同一实例预载下一条
      };
      ad.onLoad(state.handlers.load);
      ad.onError(state.handlers.error);
      ad.onClose(state.handlers.close);
      requestLoad(state);
      return isCurrentInstance(state) ? state : _instance;
    } catch (e) {
      if (_instance) retireInstance(_instance);
      _ad = null; _instance = null;
      return null;
    }
  }

  /* 进入结算等有广告入口的界面前调用，提前把素材备好，减少点广告时的等待。 */
  function preloadRewarded() {
    const state = ensureAd();
    if (state && !state.loaded && !state.loadToken && !state.activeRequest) requestLoad(state);
  }

  /* 展示激励视频。onResult(true)=完整观看应发奖；onResult(false)=中途退出/无广告/失败，不发奖。
   * 调用方务必把「发奖」写在 onResult(true) 分支里，绝不能在 show 之前先发。 */
  function showRewarded(onResult) {
    const done = (ok) => { if (typeof onResult === "function") { try { onResult(ok); } catch (e) {} } };
    if (!isSessionEligible()) { done(false); return; } // AD-2：开局 60 秒门禁——过早点击一律不放、不发奖
    const state = ensureAd();
    if (!state) { done(false); return; }
    if (_pendingReward) { done(false); return; } // 上一次还没结束，拒绝并发
    const request = {
      generation: ++_requestGeneration,
      callback: (ok) => onResult && onResult(ok),
      phase: state.loaded ? "ready" : "loading",
      timer: null,
      done: false,
    };
    _pendingReward = request;
    state.waitingRequest = request;
    if (state.loaded) doShow(state, request);
    else {
      if (!state.loadToken) requestLoad(state);
      armWait(request, state);
    }
  }

  global.NmgAds = {
    isRewardedAvailable,
    isRewardedReady,
    isSessionEligible,
    preloadRewarded,
    showRewarded,
    __adUnitConfigured: () => Boolean(REWARDED_AD_UNIT_ID),
  };
})(typeof window !== "undefined" ? window : this);
