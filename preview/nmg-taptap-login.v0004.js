"use strict";
/* TapTap 登录与头像昵称授权门面。一次性登录凭证只用于当次宿主调用，绝不对外返回或持久化。 */
(function createTapLoginFacade(global) {
  var profile = null;
  var authenticated = false;
  var status = "idle";
  var reason = "";

  function supported() {
    return !!(global.tap && typeof global.tap.login === "function");
  }

  function safeReason(error, fallback) {
    if (!error) return fallback || "unknown";
    return String(error.errMsg || error.message || error.msg || fallback || "unknown").slice(0, 160);
  }

  function profileFailureReason(error) {
    var message = safeReason(error, "用户取消授权");
    return /privacy api permission/i.test(message) ? "privacy-api-permission" : message;
  }

  function callTap(method, options) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      function done(fn, value) {
        if (settled) return;
        settled = true;
        fn(value || {});
      }
      try {
        if (!global.tap || typeof global.tap[method] !== "function") throw new Error(method + " unavailable");
        var result = global.tap[method](Object.assign({}, options || {}, {
          success: function (value) { done(resolve, value); },
          fail: function (error) { done(reject, error); }
        }));
        if (result && typeof result.then === "function") result.then(function (value) { done(resolve, value); }, function (error) { done(reject, error); });
      } catch (error) { done(reject, error); }
    });
  }

  function normalizeProfile(userInfo) {
    if (!userInfo || typeof userInfo !== "object") return null;
    var nickname = String(userInfo.nickName || userInfo.nickname || "").trim().slice(0, 32);
    var avatarUrl = String(userInfo.avatarUrl || userInfo.avatar || "").trim().slice(0, 600);
    if (!nickname && !avatarUrl) return null;
    return { nickname: nickname || "求命者", avatarUrl: avatarUrl };
  }

  async function refreshProfile() {
    if (!global.tap || typeof global.tap.getSetting !== "function") return null;
    try {
      var setting = await callTap("getSetting");
      if (!setting.authSetting || setting.authSetting["scope.userInfo"] !== true) return null;
      if (typeof global.tap.getUserInfo !== "function") return null;
      var result = await callTap("getUserInfo");
      profile = normalizeProfile(result.userInfo || result);
      return profile;
    } catch (error) { return null; }
  }

  async function login() {
    if (!supported()) {
      status = "unsupported";
      reason = "unsupported";
      return { ok: false, status: status, profile: null, reason: reason };
    }
    status = "authenticating";
    reason = "";
    try {
      await callTap("login");
      authenticated = true;
      await refreshProfile();
      status = profile ? "ready" : "profile-pending";
      reason = profile ? "" : "profile-not-authorized";
      return { ok: true, status: status, profile: profile, reason: reason };
    } catch (error) {
      authenticated = false;
      status = "failed";
      reason = safeReason(error, "login-failed");
      return { ok: false, status: status, profile: null, reason: reason };
    }
  }

  function mountProfileButton(rect, onGranted, onRejected) {
    if (status === "profile-unavailable") return { ok: false, permanent: true, reason: reason, destroy: function () {} };
    if (!global.tap || typeof global.tap.createUserInfoButton !== "function") return { ok: false, destroy: function () {} };
    var button;
    try {
      button = global.tap.createUserInfoButton({
        type: "text",
        text: "授权头像昵称",
        style: {
          left: Math.round(Number(rect && rect.left) || 0),
          top: Math.round(Number(rect && rect.top) || 0),
          width: Math.max(1, Math.round(Number(rect && rect.width) || 1)),
          height: Math.max(1, Math.round(Number(rect && rect.height) || 1)),
          backgroundColor: "#245a4b",
          borderColor: "#6ca38f",
          borderWidth: 1,
          color: "#d8e8df",
          fontSize: 14,
          textAlign: "center"
        }
      });
      if (!button || typeof button.onTap !== "function") throw new Error("profile button unavailable");
      button.onTap(function (result) {
        var next = normalizeProfile(result && (result.userInfo || result));
        if (!next) {
          var rejectedReason = profileFailureReason(result);
          if (rejectedReason === "privacy-api-permission") { status = "profile-unavailable"; reason = rejectedReason; }
          if (typeof onRejected === "function") onRejected(rejectedReason);
          return;
        }
        profile = next;
        status = "ready";
        reason = "";
        if (typeof onGranted === "function") onGranted(profile);
      });
      return {
        ok: true,
        destroy: function () { try { if (button && typeof button.destroy === "function") button.destroy(); } catch (error) {} }
      };
    } catch (error) {
      var rejectedReason = profileFailureReason(error);
      var permanent = rejectedReason === "privacy-api-permission";
      if (permanent) { status = "profile-unavailable"; reason = rejectedReason; }
      if (typeof onRejected === "function") onRejected(rejectedReason);
      return { ok: false, permanent: permanent, reason: rejectedReason, destroy: function () {} };
    }
  }

  function getState() {
    return { supported: supported(), authenticated: authenticated, status: status, profile: profile, reason: reason };
  }

  global.NmgTapLogin = {
    isSupported: supported,
    login: login,
    refreshProfile: refreshProfile,
    mountProfileButton: mountProfileButton,
    getState: getState
  };
})(typeof window !== "undefined" ? window : this);
