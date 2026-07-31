"use strict";
/* TapTap leaderboard facade for Endless Tower. */
(function (global) {
  var LEADERBOARD_ID = "16hzguseqkgrr1hk30";
  var REQUEST_TIMEOUT = 8000;
  var lastSubmitted = 0;

  function getManager() {
    try {
      var tapApi = global.tap;
      return tapApi && typeof tapApi.getLeaderboardManager === "function"
        ? tapApi.getLeaderboardManager() || null
        : null;
    } catch (e) { return null; }
  }

  function isSupported() { return !!getManager(); }
  function scoreDisplay(score) { return String(Math.max(0, Math.floor(Number(score) || 0))); }
  function submitResult(ok, score, newBest, reason) {
    return { ok: !!ok, score: score, newBest: !!newBest, scoreDisplay: scoreDisplay(score), reason: reason || "" };
  }
  function failureReason(code, message, fallback) {
    if (typeof fallback !== "string") {
      fallback = typeof message === "string" && message ? message : "request-failed";
      message = "";
    }
    if (code && typeof code === "object" && typeof code.message === "string" && code.message) return code.message;
    if (typeof message === "string" && message) {
      return code === undefined || code === null || code === "" ? message : String(code) + ":" + message;
    }
    if ((typeof code === "string" || typeof code === "number") && String(code)) return String(code);
    return fallback;
  }
  function isValidScoreEntry(entry) {
    return !!entry && typeof entry === "object"
      && entry.rank !== null && entry.rank !== "" && Number.isFinite(Number(entry.rank))
      && entry.score !== null && entry.score !== "" && Number.isFinite(Number(entry.score));
  }
  function normalizeSubmitResponse(response) {
    var firstResult = response && Array.isArray(response.results) && response.results[0];
    var scoreResult = firstResult && firstResult.scoreResult;
    if (!scoreResult || typeof scoreResult !== "object"
      || scoreResult.rawScore === null || scoreResult.rawScore === "" || !Number.isFinite(Number(scoreResult.rawScore))
      || typeof scoreResult.newBest !== "boolean"
      || typeof scoreResult.scoreDisplay !== "string") return null;
    var score = Math.max(0, Math.floor(Number(scoreResult.rawScore)));
    return {
      ok: true,
      score: score,
      newBest: scoreResult.newBest,
      scoreDisplay: scoreResult.scoreDisplay,
      reason: "",
    };
  }
  function normalizeScore(entry) {
    entry = entry || {};
    var rank = Math.max(0, Math.floor(Number(entry.rank) || 0));
    var score = Math.max(0, Math.floor(Number(entry.score) || 0));
    var name = entry.name || entry.nickname || entry.playerName || (entry.user && entry.user.name) || "";
    return { rank: rank, rankDisplay: rank > 0 ? "#" + rank : "-", score: score, scoreDisplay: scoreDisplay(score), name: String(name) };
  }
  function failedList(reason) { return { ok: false, scores: [], reason: reason }; }
  function failedSelf(reason) {
    return { ok: false, rank: 0, rankDisplay: "-", score: 0, scoreDisplay: "0", name: "", reason: reason };
  }
  function callWithTimeout(start, resolve, onTimeout, onError) {
    var done = false;
    var timer = global.setTimeout(function () { finish(onTimeout()); }, REQUEST_TIMEOUT);
    function finish(value, onSettle) {
      if (done) return false;
      done = true;
      if (typeof global.clearTimeout === "function") global.clearTimeout(timer);
      if (typeof onSettle === "function") onSettle();
      resolve(value);
      return true;
    }
    try { start(finish); }
    catch (error) { finish(onError(error)); }
  }

  function submitEndlessFloor(floor) {
    var score = Math.max(0, Math.floor(Number(floor) || 0));
    var manager = getManager();
    if (!manager || typeof manager.submitScores !== "function") return Promise.resolve(submitResult(false, score, false, "unsupported"));
    if (score <= 0) return Promise.resolve(submitResult(false, score, false, "invalid-score"));
    if (score <= lastSubmitted) return Promise.resolve(submitResult(false, score, false, "not-new-best"));
    return new Promise(function (resolve) {
      try {
        callWithTimeout(function (finish) {
          manager.submitScores({
            scores: [{ leaderboardId: LEADERBOARD_ID, score: score }],
            callback: {
              onSuccess: function (response) {
                var normalized = normalizeSubmitResponse(response);
                if (!normalized) {
                  finish(submitResult(false, score, false, "malformed-response"));
                  return;
                }
                finish(normalized, function () {
                  lastSubmitted = Math.max(lastSubmitted, normalized.score);
                });
              },
              onFailure: function (code, message) { finish(submitResult(false, score, false, failureReason(code, message, "submit-failed"))); },
            },
          });
        }, resolve,
        function () { return submitResult(false, score, false, "timeout"); },
        function (error) { return submitResult(false, score, false, failureReason(error, "submit-failed")); });
      } catch (e) { resolve(submitResult(false, score, false, failureReason(e, "submit-failed"))); }
    });
  }

  function fetchTop(count) {
    var manager = getManager();
    var limit = Math.max(1, Math.min(20, Math.floor(Number(count) || 20)));
    if (!manager || typeof manager.loadLeaderboardScores !== "function") return Promise.resolve(failedList("unsupported"));
    return new Promise(function (resolve) {
      try {
        callWithTimeout(function (finish) {
          manager.loadLeaderboardScores({
            leaderboardId: LEADERBOARD_ID,
            maxSize: 20,
            collection: "public",
            callback: {
              onSuccess: function (response) {
                var list = response && (response.scores || response.list || response.data);
                if (!Array.isArray(list) || !list.every(isValidScoreEntry)) {
                  finish(failedList("malformed-response"));
                  return;
                }
                finish({ ok: true, scores: list.slice(0, limit).map(normalizeScore), reason: "" });
              },
              onFailure: function (code, message) { finish(failedList(failureReason(code, message, "load-failed"))); },
            },
          });
        }, resolve,
        function () { return failedList("timeout"); },
        function (error) { return failedList(failureReason(error, "load-failed")); });
      } catch (e) { resolve(failedList(failureReason(e, "load-failed"))); }
    });
  }

  function fetchSelf() {
    var manager = getManager();
    if (!manager || typeof manager.loadCurrentPlayerLeaderboardScore !== "function") return Promise.resolve(failedSelf("unsupported"));
    return new Promise(function (resolve) {
      try {
        callWithTimeout(function (finish) {
          manager.loadCurrentPlayerLeaderboardScore({
            leaderboardId: LEADERBOARD_ID,
            collection: "public",
            callback: {
              onSuccess: function (response) {
                var currentUserScore = response && response.currentUserScore;
                if (response && Object.prototype.hasOwnProperty.call(response, "currentUserScore") && currentUserScore == null) {
                  finish({ ok: true, hasScore: false, rank: 0, rankDisplay: "-", score: 0, scoreDisplay: "0", name: "", reason: "" });
                  return;
                }
                if (!isValidScoreEntry(currentUserScore)) {
                  finish(failedSelf("malformed-response"));
                  return;
                }
                var normalized = normalizeScore(currentUserScore);
                normalized.ok = true;
                normalized.reason = "";
                finish(normalized);
              },
              onFailure: function (code, message) { finish(failedSelf(failureReason(code, message, "load-self-failed"))); },
            },
          });
        }, resolve,
        function () { return failedSelf("timeout"); },
        function (error) { return failedSelf(failureReason(error, "load-self-failed")); });
      } catch (e) { resolve(failedSelf(failureReason(e, "load-self-failed"))); }
    });
  }

  global.NmgLeaderboard = {
    isSupported: isSupported,
    submitEndlessFloor: submitEndlessFloor,
    fetchTop: fetchTop,
    fetchSelf: fetchSelf,
    getLastSubmission: function () { return lastSubmitted; },
    LEADERBOARD_ID: LEADERBOARD_ID,
  };
})(typeof window !== "undefined" ? window : this);
