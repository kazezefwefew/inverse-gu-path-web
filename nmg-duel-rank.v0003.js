"use strict";
/* 蛊斗场荣誉段位与本地奖励计划。客户端领取账本只负责本机体验与幂等，
 * 不宣称具备服务端防篡改能力；同一战局、同对手与每日上限仍用于降低误触和互刷收益。 */
(function createDuelRank(global) {
  const RANK_VERSION = 2;
  const DAILY_RATED_CAP = 8;
  const DAILY_SAME_OPPONENT_CAP = 2;
  const DAILY_BOT_RATED_CAP = 3;
  const PROVISIONAL_MATCHES = 5;
  const WIN_POINTS = 32;
  const LOSS_POINTS = 12;
  const STREAK_STEP = 3;
  const STREAK_CAP = 9;
  const TIERS = Object.freeze([
    Object.freeze({ id: "dormant", name: "蛰蛊", glyph: "蛰", min: 0, tone: "ash", icon: "assets/ui/duel-ranks/dormant.webp" }),
    Object.freeze({ id: "cocoon", name: "破茧", glyph: "茧", min: 100, tone: "bronze", icon: "assets/ui/duel-ranks/cocoon.webp" }),
    Object.freeze({ id: "spirit", name: "灵蜕", glyph: "灵", min: 250, tone: "jade", icon: "assets/ui/duel-ranks/spirit.webp" }),
    Object.freeze({ id: "mystic", name: "玄脉", glyph: "玄", min: 450, tone: "indigo", icon: "assets/ui/duel-ranks/mystic.webp" }),
    Object.freeze({ id: "heaven", name: "天命", glyph: "天", min: 700, tone: "gold", icon: "assets/ui/duel-ranks/heaven.webp" }),
    Object.freeze({ id: "imperial", name: "皇极", glyph: "皇", min: 1000, tone: "crimson", icon: "assets/ui/duel-ranks/imperial.webp" }),
    Object.freeze({ id: "ancestral", name: "祖庭", glyph: "祖", min: 1400, tone: "violet", icon: "assets/ui/duel-ranks/ancestral.webp" }),
  ]);
  const EMPTY_GRANTS = Object.freeze({ scrip: 0, materialEach: 0, randomMaterial: 0, bossCores: 0, guEmbryo: 0, kindleSand: 0, guWard: 0, titleId: "" });
  const DAILY_REWARDS = Object.freeze({
    firstMatch: Object.freeze({ scrip: 20, randomMaterial: 1 }),
    humanFirstWin: Object.freeze({ scrip: 40, randomMaterial: 2, bossCores: 1 }),
    botFirstWin: Object.freeze({ scrip: 20, randomMaterial: 1 }),
    weeklyFive: Object.freeze({ scrip: 100, materialEach: 1, bossCores: 2 }),
  });
  const PROMOTION_REWARDS = Object.freeze({
    cocoon: Object.freeze({ scrip: 60, materialEach: 2 }),
    spirit: Object.freeze({ scrip: 120, materialEach: 3, bossCores: 2 }),
    mystic: Object.freeze({ scrip: 200, materialEach: 5, bossCores: 4, guEmbryo: 1 }),
    heaven: Object.freeze({ scrip: 320, materialEach: 8, bossCores: 6, kindleSand: 3 }),
    imperial: Object.freeze({ scrip: 500, materialEach: 12, bossCores: 10, guEmbryo: 2, kindleSand: 5, guWard: 2 }),
    ancestral: Object.freeze({ scrip: 800, materialEach: 20, bossCores: 16, guEmbryo: 3, kindleSand: 8, guWard: 4, titleId: "duelAncestral" }),
  });
  const SEASON_REWARDS = Object.freeze({
    dormant: Object.freeze({ scrip: 50, materialEach: 1 }),
    cocoon: Object.freeze({ scrip: 100, materialEach: 2 }),
    spirit: Object.freeze({ scrip: 180, materialEach: 3, bossCores: 1 }),
    mystic: Object.freeze({ scrip: 300, materialEach: 5, bossCores: 2, kindleSand: 1 }),
    heaven: Object.freeze({ scrip: 500, materialEach: 8, bossCores: 4, kindleSand: 2, guWard: 1 }),
    imperial: Object.freeze({ scrip: 800, materialEach: 12, bossCores: 7, kindleSand: 4, guWard: 2 }),
    ancestral: Object.freeze({ scrip: 1200, materialEach: 20, bossCores: 12, guEmbryo: 2, kindleSand: 6, guWard: 3 }),
  });

  function dayKey(at) {
    const date = new Date(Number(at) || Date.now());
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  }
  function seasonId(at) {
    const date = new Date(Number(at) || Date.now());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  function weekKey(at) {
    const date = new Date(Number(at) || Date.now());
    const day = (date.getDay() + 6) % 7;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  }
  function tierFor(points) {
    const safe = Math.max(0, Number(points) || 0);
    return TIERS.slice().reverse().find((tier) => safe >= tier.min) || TIERS[0];
  }
  function normalize(raw, at) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const currentSeason = seasonId(at);
    const rewardClaims = Array.from(new Set((Array.isArray(source.rewardClaims) ? source.rewardClaims : []).map(String).filter(Boolean))).slice(-500);
    const currentWeek = weekKey(at);
    if (source.seasonId !== currentSeason) {
      return { version: RANK_VERSION, seasonId: currentSeason, points: 0, wins: 0, losses: 0, streak: 0, bestPoints: 0, bestTierId: "dormant", battleIds: [], daily: {}, weekly: { weekKey: currentWeek, rated: 0 }, rewardClaims };
    }
    const daily = source.daily && typeof source.daily === "object" && !Array.isArray(source.daily) ? source.daily : {};
    return {
      version: RANK_VERSION, seasonId: currentSeason,
      points: Math.max(0, source.points | 0), wins: Math.max(0, source.wins | 0), losses: Math.max(0, source.losses | 0),
      streak: Math.max(0, source.streak | 0), bestPoints: Math.max(0, source.bestPoints | 0),
      bestTierId: tierFor(Math.max(0, source.bestPoints | 0)).id,
      battleIds: Array.from(new Set((Array.isArray(source.battleIds) ? source.battleIds : []).map(String).filter(Boolean))).slice(-120),
      daily,
      weekly: source.weekly?.weekKey === currentWeek
        ? { weekKey: currentWeek, rated: Math.max(0, source.weekly.rated | 0) }
        : { weekKey: currentWeek, rated: 0 },
      rewardClaims,
    };
  }
  function cloneGrants(reward) {
    const source = reward && typeof reward === "object" ? reward : EMPTY_GRANTS;
    return {
      scrip: Math.max(0, source.scrip | 0), materialEach: Math.max(0, source.materialEach | 0),
      randomMaterial: Math.max(0, source.randomMaterial | 0), bossCores: Math.max(0, source.bossCores | 0),
      guEmbryo: Math.max(0, source.guEmbryo | 0), kindleSand: Math.max(0, source.kindleSand | 0),
      guWard: Math.max(0, source.guWard | 0), titleId: String(source.titleId || ""),
    };
  }
  function rewardPlan(state, context, claimKey, reward) {
    const grants = cloneGrants(reward);
    if (!claimKey || state.rewardClaims.includes(claimKey)) {
      return { state, grants: cloneGrants(null), claims: [], progress: rewardProgress(state, context.at), hasReward: false };
    }
    state.rewardClaims.push(claimKey);
    state.rewardClaims = state.rewardClaims.slice(-500);
    return { state, grants, claims: [claimKey], progress: rewardProgress(state, context.at), hasReward: Object.values(grants).some(Boolean) };
  }
  function rewardProgress(state, at) {
    const daily = state.daily?.[dayKey(at)] || {};
    return {
      ratedToday: Math.max(0, daily.rewardRated | 0), botRatedToday: Math.max(0, daily.botRated | 0),
      ratedThisWeek: state.weekly?.weekKey === weekKey(at) ? Math.max(0, state.weekly.rated | 0) : 0,
      weeklyTarget: 5,
    };
  }
  function getRewardPlan(raw, context = {}) {
    const at = Number(context.at) || Date.now();
    const state = normalize(raw, at);
    const kind = String(context.kind || "");
    const today = dayKey(at);
    const daily = state.daily[today] && typeof state.daily[today] === "object" ? { ...state.daily[today] } : {};
    state.daily = { ...state.daily, [today]: daily };
    if (kind === "invite-win") return rewardPlan(state, context, "", null);
    if (kind === "rated-match") {
      daily.rewardRated = Math.max(0, daily.rewardRated | 0) + 1;
      state.weekly.rated += 1;
      return rewardPlan(state, context, `daily:${today}:first-match`, DAILY_REWARDS.firstMatch);
    }
    if (kind === "human-win") return rewardPlan(state, context, `daily:${today}:human-first-win`, DAILY_REWARDS.humanFirstWin);
    if (kind === "bot-win") {
      return rewardPlan(state, context, `daily:${today}:bot-first-win`, DAILY_REWARDS.botFirstWin);
    }
    if (kind === "weekly") {
      const key = `weekly:${state.weekly.weekKey}:five`;
      return rewardPlan(state, context, state.weekly.rated >= 5 ? key : "", DAILY_REWARDS.weeklyFive);
    }
    if (kind === "promotion") {
      const tierId = String(context.tierId || "");
      const reward = PROMOTION_REWARDS[tierId];
      return rewardPlan(state, context, reward ? `promotion:${state.seasonId}:${tierId}` : "", reward);
    }
    if (kind === "season") {
      const tierId = String(context.tierId || state.bestTierId || "dormant");
      const reward = SEASON_REWARDS[tierId];
      const settledSeason = String(context.seasonId || state.seasonId);
      return rewardPlan(state, context, reward ? `season:${settledSeason}:${tierId}` : "", reward);
    }
    return rewardPlan(state, context, "", null);
  }
  function applyResult(raw, result) {
    const at = Number(result?.at) || Date.now();
    const state = normalize(raw, at);
    const battleId = String(result?.battleId || "").trim().slice(0, 96);
    const opponentId = String(result?.opponentId || "").trim().slice(0, 96);
    const isBot = result?.mode === "bot";
    if (!["random", "bot"].includes(result?.mode) || !battleId || !opponentId) return { ok: false, reason: "ineligible", state };
    if (state.battleIds.includes(battleId)) return { ok: false, reason: "duplicate", state };
    const key = dayKey(at);
    const ledger = state.daily[key] && typeof state.daily[key] === "object" ? state.daily[key] : { rated: 0, botRated: 0, opponents: {} };
    ledger.rated = Math.max(0, ledger.rated | 0);
    ledger.botRated = Math.max(0, ledger.botRated | 0);
    ledger.opponents = ledger.opponents && typeof ledger.opponents === "object" ? ledger.opponents : {};
    const sameOpponent = Math.max(0, ledger.opponents[opponentId] | 0);
    state.battleIds.push(battleId);
    state.battleIds = state.battleIds.slice(-120);
    if (ledger.rated >= DAILY_RATED_CAP) return { ok: false, recorded: true, reason: "daily-cap", state };
    if (isBot && ledger.botRated >= DAILY_BOT_RATED_CAP) return { ok: false, recorded: true, reason: "bot-cap", state };
    if (!isBot && sameOpponent >= DAILY_SAME_OPPONENT_CAP) return { ok: false, recorded: true, reason: "opponent-cap", state };
    ledger.rated += 1;
    if (isBot) ledger.botRated += 1; else ledger.opponents[opponentId] = sameOpponent + 1;
    state.daily = { [key]: ledger };
    const before = state.points;
    const provisional = state.wins + state.losses < PROVISIONAL_MATCHES;
    if (result.won) {
      state.wins += 1;
      state.streak = isBot ? state.streak : state.streak + 1;
      state.points += isBot ? Math.floor(WIN_POINTS / 2) : WIN_POINTS + Math.min(STREAK_CAP, Math.floor(Math.max(0, state.streak - 1) / 2) * STREAK_STEP);
    } else {
      state.losses += 1;
      if (!isBot) {
        state.streak = 0;
        if (!provisional) state.points = Math.max(0, state.points - LOSS_POINTS);
      }
    }
    state.bestPoints = Math.max(state.bestPoints, state.points);
    state.bestTierId = tierFor(state.bestPoints).id;
    return { ok: true, state, before, after: state.points, delta: state.points - before, tier: tierFor(state.points), promoted: tierFor(before).id !== tierFor(state.points).id };
  }

  global.NmgDuelRank = Object.freeze({
    version: RANK_VERSION, tiers: TIERS, dailyRatedCap: DAILY_RATED_CAP, dailyBotRatedCap: DAILY_BOT_RATED_CAP, sameOpponentCap: DAILY_SAME_OPPONENT_CAP,
    DAILY_REWARDS, PROMOTION_REWARDS, SEASON_REWARDS,
    seasonId, dayKey, weekKey, tierFor, normalize, applyResult, getRewardPlan,
  });
})(typeof window !== "undefined" ? window : this);
