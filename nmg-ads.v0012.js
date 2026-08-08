"use strict";
/*
 * TapTap H5 激励视频统一运行时。
 *
 * 约束：
 * - 只有宿主注入 tap.createRewardedVideoAd 时才启用；
 * - 同一时刻只允许一个奖励请求；
 * - 只有 onClose({ isEnded: true }) 才视为完整观看；
 * - 加载、播放超时或不可恢复错误会隔离旧实例，避免迟到回调污染新请求；
 * - 归因事件默认只留在调用方注入的内存 sink，不主动联网。
 */
(function (global) {
  const REWARDED_AD_UNIT_ID = "1054323";
  const LOAD_WAIT_MS = 15 * 1000;
  const SHOW_WAIT_MS = 120 * 1000;
  const SESSION_AD_DELAY_MS = 60 * 1000;

  const PLACEMENTS = Object.freeze({
    PRE_BATTLE_BLESS: "pre_battle_bless",
    BATTLE_REVIVE: "battle_revive",
    BATTLE_REWARD_REROLL: "battle_reward_reroll",
    RUN_HARVEST_DOUBLE: "run_harvest_double",
    GULU_HATCH_INSTANT: "gulu_hatch_instant",
    MARKET_GU_COIN: "market_gu_coin",
    DAILY_SIGN_REPEAT: "daily_sign_repeat",
    NURTURE_DEW: "nurture_dew",
    NURTURE_PROGRESS: "nurture_progress",
    MARKET_RESTOCK: "market_restock",
    BATTLE_MATERIAL_SALVAGE: "battle_material_salvage",
    SHOP_REFRESH: "shop_refresh",
    BOSS_MATERIAL_SALVAGE: "boss_material_salvage",
    FORGE_FAILURE_RECLAIM: "forge_failure_reclaim",
    PARK_TICKET: "park_ticket",
    DAILY_LUCK: "daily_luck",
    STARTER_GU_UNLOCK: "starter_gu_unlock",
    MARKET_DAO_UNLOCK: "market_dao_unlock",
    MARKET_PARK_TICKET: "market_park_ticket",
  });
  const PLACEMENT_IDS = Object.freeze(Object.values(PLACEMENTS));
  const OUTGAME_IMMEDIATE_PLACEMENTS = Object.freeze(new Set([
    PLACEMENTS.GULU_HATCH_INSTANT,
    PLACEMENTS.MARKET_GU_COIN,
    PLACEMENTS.DAILY_SIGN_REPEAT,
    PLACEMENTS.NURTURE_DEW,
    PLACEMENTS.NURTURE_PROGRESS,
    PLACEMENTS.MARKET_RESTOCK,
    PLACEMENTS.PARK_TICKET,
    PLACEMENTS.DAILY_LUCK,
    PLACEMENTS.STARTER_GU_UNLOCK,
    PLACEMENTS.MARKET_DAO_UNLOCK,
    PLACEMENTS.MARKET_PARK_TICKET,
  ]));
  const RESULT = Object.freeze({
    COMPLETED: "completed",
    CLOSED: "closed",
    UNAVAILABLE: "unavailable",
    NO_FILL: "no_fill",
    ERROR: "error",
    TIMEOUT: "timeout",
    BUSY: "busy",
  });
  const sessionStartedAt = Date.now();

  let _ad = null;
  let _instance = null;
  let _instanceGeneration = 0;
  let _requestGeneration = 0;
  let _pendingReward = null;
  let _eventSink = null;
  const _seenOffers = new Set();

  function isKnownPlacement(placementId) {
    return PLACEMENT_IDS.includes(placementId);
  }

  function isSessionEligible() {
    return Date.now() - sessionStartedAt >= SESSION_AD_DELAY_MS;
  }

  function isPlacementSessionEligible(placementId) {
    return OUTGAME_IMMEDIATE_PLACEMENTS.has(placementId) || isSessionEligible();
  }

  function getSessionEligibilityDelayMs() {
    return Math.max(0, SESSION_AD_DELAY_MS - (Date.now() - sessionStartedAt));
  }

  function isPlayerEligible(firstBattleComplete) {
    return isSessionEligible() && firstBattleComplete === true;
  }

  function setEventSink(sink) {
    _eventSink = typeof sink === "function" ? sink : null;
  }

  function emitAdEvent(stage, placementId, extra = {}) {
    if (!isKnownPlacement(placementId)) return false;
    const event = Object.freeze({
      stage: String(stage || ""),
      placement_id: placementId,
      result_code: String(extra.result_code || ""),
      reward_kind: String(extra.reward_kind || ""),
      reward_amount_bucket: String(extra.reward_amount_bucket || ""),
      scene: String(extra.scene || ""),
      route_step_bucket: String(extra.route_step_bucket || ""),
      returning_bucket: String(extra.returning_bucket || ""),
    });
    try {
      if (_eventSink) _eventSink(event);
    } catch (error) {
      // 统计接收方异常不得影响奖励结算。
    }
    return true;
  }

  function trackOffer(placementId, offerKey, context = {}) {
    if (!isKnownPlacement(placementId) || !offerKey) return false;
    const key = `${placementId}|${String(offerKey)}`;
    if (_seenOffers.has(key)) return false;
    _seenOffers.add(key);
    return emitAdEvent("offer_visible", placementId, context);
  }

  function trackRewardGranted(placementId, context = {}) {
    return emitAdEvent("reward_granted", placementId, context);
  }

  function hasHostAd() {
    return Boolean(
      global.tap
      && typeof global.tap.createRewardedVideoAd === "function",
    );
  }

  function isRewardedAvailable() {
    return hasHostAd() && Boolean(REWARDED_AD_UNIT_ID);
  }

  function isRewardedReady() {
    const state = ensureAd();
    return Boolean(
      isRewardedAvailable()
      && state
      && state.loaded
      && !state.loadToken
      && !state.activeRequest,
    );
  }

  function safeToast(title) {
    try {
      if (global.tap && typeof global.tap.showToast === "function") {
        global.tap.showToast({ title, icon: "none" });
      }
    } catch (error) {
      // 宿主提示失败不影响玩法。
    }
  }

  function clearWait(request) {
    if (!request || request.timer === null) return;
    try {
      clearTimeout(request.timer);
    } catch (error) {
      // 无需向业务层抛出。
    }
    request.timer = null;
  }

  function classifyAdError(error) {
    const code = String(error?.code ?? error?.errCode ?? "").toLowerCase();
    const message = String(error?.message ?? error?.errMsg ?? "").toLowerCase();
    if (
      code === "no_fill"
      || code === "nofill"
      || message.includes("no fill")
      || message.includes("no ad")
    ) {
      return RESULT.NO_FILL;
    }
    return RESULT.ERROR;
  }

  function finishPending(request, result, { toast = false } = {}) {
    if (!request || request.done) return false;
    request.done = true;
    clearWait(request);
    if (_pendingReward === request) _pendingReward = null;
    if (result === RESULT.COMPLETED) {
      emitAdEvent("completed", request.placementId);
    } else {
      emitAdEvent("failed", request.placementId, { result_code: result });
    }
    if (toast) safeToast("暂无广告，请稍后再试");
    try {
      request.callback(result);
    } catch (error) {
      // 业务回调异常不得破坏广告实例。
    }
    return true;
  }

  function armWait(request, state) {
    if (!request || request.done || _pendingReward !== request) return;
    clearWait(request);
    const waitMs = request.phase === "showing" ? SHOW_WAIT_MS : LOAD_WAIT_MS;
    request.timer = setTimeout(() => {
      if (_pendingReward !== request || request.done) return;
      finishPending(request, RESULT.TIMEOUT, { toast: true });
      retireInstance(state);
      ensureAd();
    }, waitMs);
  }

  function isCurrentInstance(state) {
    return Boolean(
      state
      && !state.retired
      && _instance === state
      && _ad === state.ad,
    );
  }

  function detachListener(ad, name, handler) {
    try {
      if (typeof ad?.[name] === "function") ad[name](handler);
    } catch (error) {
      // 某些宿主版本不支持解绑，闭包代次仍会隔离迟到回调。
    }
  }

  function retireInstance(state) {
    if (!state || state.retired) return;
    state.retired = true;
    detachListener(state.ad, "offLoad", state.handlers.load);
    detachListener(state.ad, "offError", state.handlers.error);
    detachListener(state.ad, "offClose", state.handlers.close);
    try {
      if (typeof state.ad?.destroy === "function") state.ad.destroy();
    } catch (error) {
      // 销毁失败时仍由 state.retired 隔离旧回调。
    }
    if (_instance === state) {
      _instance = null;
      _ad = null;
    }
  }

  function recoverInstance(state, request = null, error = null) {
    retireInstance(state);
    if (request && _pendingReward === request) {
      finishPending(request, classifyAdError(error), { toast: true });
    }
    ensureAd();
  }

  function requestLoad(state) {
    if (!isCurrentInstance(state) || state.loadToken || state.activeRequest) return false;
    const token = { instanceGeneration: state.generation };
    state.loadToken = token;
    state.loaded = false;
    try {
      const promise = state.ad.load();
      if (promise && typeof promise.catch === "function") {
        promise.catch((error) => {
          if (!isCurrentInstance(state) || state.loadToken !== token) return;
          state.loadToken = null;
          recoverInstance(state, state.waitingRequest, error);
        });
      }
      return true;
    } catch (error) {
      if (isCurrentInstance(state) && state.loadToken === token) {
        state.loadToken = null;
      }
      recoverInstance(state, state.waitingRequest, error);
      return false;
    }
  }

  function doShow(state, request) {
    if (
      !isCurrentInstance(state)
      || !request
      || request.done
      || _pendingReward !== request
      || !state.loaded
      || state.activeRequest
    ) {
      return false;
    }
    clearWait(request);
    const token = {
      instanceGeneration: state.generation,
      requestGeneration: request.generation,
    };
    state.showToken = token;
    state.waitingRequest = null;
    state.activeRequest = request;
    request.phase = "showing";
    state.loaded = false;
    try {
      const promise = state.ad.show();
      emitAdEvent("sdk_show_start", request.placementId);
      if (promise && typeof promise.catch === "function") {
        promise.catch((error) => {
          if (
            !isCurrentInstance(state)
            || state.showToken !== token
            || state.activeRequest !== request
          ) {
            return;
          }
          recoverInstance(state, request, error);
        });
      }
      armWait(request, state);
      return true;
    } catch (error) {
      recoverInstance(state, request, error);
      return false;
    }
  }

  function ensureAd() {
    if (isCurrentInstance(_instance) || !isRewardedAvailable()) return _instance;
    try {
      const ad = global.tap.createRewardedVideoAd({ adUnitId: REWARDED_AD_UNIT_ID });
      const state = {
        generation: ++_instanceGeneration,
        ad,
        loaded: false,
        retired: false,
        loadToken: null,
        showToken: null,
        waitingRequest: null,
        activeRequest: null,
        handlers: {},
      };
      _ad = ad;
      _instance = state;

      state.handlers.load = () => {
        if (!isCurrentInstance(state) || !state.loadToken) return;
        state.loadToken = null;
        state.loaded = true;
        const request = state.waitingRequest;
        if (request && request === _pendingReward && !request.done) {
          doShow(state, request);
        }
      };

      state.handlers.error = (error) => {
        if (!isCurrentInstance(state)) return;
        try {
          console.warn("[广告] 激励视频错误", error);
        } catch (ignored) {
          // 控制台不可用时忽略。
        }
        recoverInstance(
          state,
          state.activeRequest || state.waitingRequest,
          error,
        );
      };

      state.handlers.close = (response) => {
        if (!isCurrentInstance(state)) return;
        const request = state.activeRequest;
        if (!request || !state.showToken || request.phase !== "showing") return;
        state.activeRequest = null;
        state.showToken = null;
        state.loaded = false;
        const result = response?.isEnded === true
          ? RESULT.COMPLETED
          : RESULT.CLOSED;
        if (request === _pendingReward) finishPending(request, result);
        requestLoad(state);
      };

      ad.onLoad(state.handlers.load);
      ad.onError(state.handlers.error);
      ad.onClose(state.handlers.close);
      requestLoad(state);
      return isCurrentInstance(state) ? state : _instance;
    } catch (error) {
      if (_instance) retireInstance(_instance);
      _ad = null;
      _instance = null;
      return null;
    }
  }

  function preloadRewarded() {
    const state = ensureAd();
    if (state && !state.loaded && !state.loadToken && !state.activeRequest) {
      requestLoad(state);
    }
  }

  function showRewardedFor(placementId, onResult) {
    const done = (result) => {
      try {
        if (typeof onResult === "function") onResult(result);
      } catch (error) {
        // 调用方异常不外溢。
      }
    };

    if (!isKnownPlacement(placementId) || !isPlacementSessionEligible(placementId)) {
      done(RESULT.UNAVAILABLE);
      return;
    }
    if (_pendingReward) {
      emitAdEvent("failed", placementId, { result_code: RESULT.BUSY });
      done(RESULT.BUSY);
      return;
    }

    emitAdEvent("click", placementId);
    const state = ensureAd();
    if (!state) {
      emitAdEvent("failed", placementId, { result_code: RESULT.UNAVAILABLE });
      done(RESULT.UNAVAILABLE);
      return;
    }

    const request = {
      generation: ++_requestGeneration,
      placementId,
      callback: done,
      phase: state.loaded ? "ready" : "loading",
      timer: null,
      done: false,
    };
    _pendingReward = request;
    state.waitingRequest = request;
    if (state.loaded) {
      doShow(state, request);
    } else {
      if (!state.loadToken) requestLoad(state);
      armWait(request, state);
    }
  }

  function showRewarded(onResult) {
    showRewardedFor(PLACEMENTS.BATTLE_REWARD_REROLL, (result) => {
      try {
        if (typeof onResult === "function") {
          onResult(result === RESULT.COMPLETED);
        }
      } catch (error) {
        // 兼容回调异常不外溢。
      }
    });
  }

  global.NmgAds = {
    PLACEMENTS,
    RESULT,
    isRewardedAvailable,
    isRewardedReady,
    isSessionEligible,
    getSessionEligibilityDelayMs,
    isPlayerEligible,
    preloadRewarded,
    showRewardedFor,
    showRewarded,
    setEventSink,
    trackOffer,
    trackRewardGranted,
    __adUnitConfigured: () => Boolean(REWARDED_AD_UNIT_ID),
  };
})(typeof window !== "undefined" ? window : this);
