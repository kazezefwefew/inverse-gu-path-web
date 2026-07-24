"use strict";
/* 万命母盘纯规则：只接收数据并返回新状态，不读取 DOM、game 或 runState。 */

const MUPAN_DEBT_TIE_ORDER = Object.freeze(["blood", "life", "fate", "poison", "armor", "haste"]);

const MUPAN_DEBT_DEFINITIONS = Object.freeze({
  blood: Object.freeze({ id: "blood", name: "主动失血", sealName: "主动失血", triggerText: "主动失去生命" }),
  life: Object.freeze({ id: "life", name: "消耗寿元", sealName: "消耗寿元", triggerText: "主动消耗寿元" }),
  fate: Object.freeze({ id: "fate", name: "命势圆满", sealName: "命势圆满", triggerText: "使命势真正圆满" }),
  poison: Object.freeze({ id: "poison", name: "施加毒性", sealName: "施加毒性", triggerText: "给敌人新增毒层" }),
  armor: Object.freeze({ id: "armor", name: "获得护甲", sealName: "获得护甲", triggerText: "实际获得护甲" }),
  haste: Object.freeze({ id: "haste", name: "连续出牌", sealName: "连续出牌", triggerText: "打出本回合第 4 张牌" }),
});

function getMupanFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getMupanNonNegative(value) {
  return Math.max(0, getMupanFiniteNumber(value));
}

function ensureMupanRunStats(stats) {
  if (!stats || typeof stats !== "object") return { selfHpLost: 0, lifespanSpent: 0 };
  stats.selfHpLost = getMupanNonNegative(stats.selfHpLost);
  stats.lifespanSpent = getMupanNonNegative(stats.lifespanSpent);
  return stats;
}

function recordMupanCostDelta(stats, metric, before, after, source = "active") {
  if (source !== "active" || (metric !== "selfHpLost" && metric !== "lifespanSpent")) return 0;
  const target = ensureMupanRunStats(stats);
  const delta = Math.max(0, getMupanNonNegative(before) - getMupanNonNegative(after));
  if (delta <= 0) return 0;
  target[metric] = getMupanNonNegative(target[metric]) + delta;
  return delta;
}

function scoreMupanDebts({ runStats = {}, maxHp = 0, maxLifespan = 0 } = {}) {
  const stats = ensureMupanRunStats({ ...runStats });
  const hpBase = Math.max(20, getMupanNonNegative(maxHp) * 0.75);
  const lifeBase = Math.max(6, getMupanNonNegative(maxLifespan) * 0.25);
  return Object.freeze({
    blood: stats.selfHpLost / hpBase,
    life: stats.lifespanSpent / lifeBase,
    fate: getMupanNonNegative(stats.fateTriggers) / 8,
    poison: getMupanNonNegative(stats.poisonDamage) / 100,
    armor: getMupanNonNegative(stats.armorGained) / 140,
    haste: getMupanNonNegative(stats.cardsPlayed) / 90,
  });
}

function makeMupanDebtChoice(id, scores) {
  return Object.freeze({
    id,
    name: MUPAN_DEBT_DEFINITIONS[id].name,
    sealName: MUPAN_DEBT_DEFINITIONS[id].sealName,
    score: scores[id],
  });
}

function selectMupanDebtSnapshot(input = {}) {
  const scores = scoreMupanDebts(input);
  const allZero = MUPAN_DEBT_TIE_ORDER.every((id) => scores[id] === 0);
  const ordered = allZero
    ? ["haste", "armor"]
    : [...MUPAN_DEBT_TIE_ORDER].sort((left, right) => scores[right] - scores[left]);
  return Object.freeze({
    primary: makeMupanDebtChoice(ordered[0], scores),
    secondary: makeMupanDebtChoice(ordered[1], scores),
    scores,
  });
}

function getMupanMetric(metrics, key) {
  return getMupanNonNegative(metrics?.[key]);
}

function detectMupanHabitTrigger(habitId, before = {}, after = {}) {
  const increases = (key) => getMupanMetric(after, key) > getMupanMetric(before, key);
  if (habitId === "blood") return increases("selfHpLost");
  if (habitId === "life") return increases("lifespanSpent");
  if (habitId === "fate") return increases("fateTriggers");
  if (habitId === "poison") return increases("poisonAdded");
  if (habitId === "armor") return increases("armorGained");
  if (habitId === "haste") {
    return getMupanMetric(before, "cardsPlayed") < 4 && getMupanMetric(after, "cardsPlayed") >= 4;
  }
  return false;
}

function getMupanHabitForPhase(state, phase) {
  const primary = state?.core?.debtSnapshot?.primary?.id || "haste";
  const secondary = state?.core?.debtSnapshot?.secondary?.id || "armor";
  if (phase === 2) return secondary;
  if (phase === 3) return state.finalWatchIndex % 2 === 0 ? primary : secondary;
  return primary;
}

function cloneMupanBattleState(state) {
  return {
    ...state,
    core: { ...(state?.core || {}) },
    turn: { ...(state?.turn || {}) },
    rules: { ...(state?.rules || {}) },
    stats: { ...(state?.stats || {}) },
    sealedCards: [...(state?.sealedCards || [])],
  };
}

function getMupanPhaseRules(phase, balance = {}) {
  return balance.phases?.[phase] || balance.phases?.[String(phase)] || {};
}

function makeMupanAttack(id, name, icon, config = {}, flags = {}) {
  return {
    id,
    name,
    icon,
    kind: "attack",
    damage: getMupanNonNegative(config.damage),
    hits: Math.max(1, Math.floor(getMupanNonNegative(config.hits)) || 1),
    ...flags,
  };
}

function getMupanReadAttack(state, balance = {}) {
  const phase = state?.core?.phase || 1;
  return makeMupanAttack(`mupanReadP${phase}`, "看穿", "看", getMupanPhaseRules(phase, balance).read, { mupanRead: true });
}

function getMupanPursuitAttack(state, balance = {}) {
  const phase = state?.core?.phase || 1;
  const names = { 1: "追击", 2: "双轮追击", 3: "逼命追击" };
  return makeMupanAttack(`mupanPursuitP${phase}`, names[phase] || "追击", "追", getMupanPhaseRules(phase, balance).pursuit, { mupanPursuit: true });
}

function getMupanPlannedAttack(state, balance = {}) {
  const phase = state?.core?.phase || 1;
  const names = { 1: "横扫", 2: "双轮夹击", 3: "逼命连击" };
  const icons = { 1: "扫", 2: "夹", 3: "逼" };
  return makeMupanAttack(`mupanPlannedP${phase}`, names[phase] || "横扫", icons[phase] || "扫", getMupanPhaseRules(phase, balance).planned, { mupanPlanned: true });
}

function getMupanFinalBlowAttack(balance = {}) {
  return makeMupanAttack("mupanFinalBlow", "灭命一击", "灭", getMupanPhaseRules(3, balance).finalBlow, { mupanFinalBlow: true });
}

function createMupanBattleState({ debtSnapshot, mode = "normal", tianTier = 0, balance = {} } = {}) {
  const snapshot = debtSnapshot || selectMupanDebtSnapshot();
  const state = {
    core: {
      phase: 1,
      pendingPhase: 0,
      bossDead: false,
      debtSnapshot: snapshot,
      watchedHabitId: snapshot.primary?.id || "haste",
      lastResolution: null,
    },
    mode,
    tianTier,
    turn: { active: false, pursuitTriggered: false, habitTriggered: false, exposureActive: false },
    exposedTurns: 0,
    finalCountdown: Math.max(1, getMupanNonNegative(balance.finalCountdown?.start) || 3),
    finalExtensionsUsed: 0,
    finalWatchIndex: 0,
    currentTurn: 1,
    exposureActive: false,
    exposureMultiplier: getMupanNonNegative(balance.exposureMultiplier) || 1.35,
    sealedCards: [],
    stats: {
      reads: 1,
      successfulBreaks: 0,
      pursuits: 0,
      finalBlows: 0,
    },
  };
  return state;
}

function beginMupanPlayerTurn(state, balance = {}) {
  const next = cloneMupanBattleState(state);
  if (next.core.bossDead) return next;
  next.turn = {
    active: true,
    pursuitTriggered: false,
    habitTriggered: false,
    exposureActive: next.exposedTurns > 0,
  };
  next.exposureActive = next.turn.exposureActive;
  next.currentTurn = Math.max(1, Math.floor(getMupanNonNegative(next.currentTurn)) || 1);
  next.exposureMultiplier = getMupanNonNegative(balance.exposureMultiplier) || next.exposureMultiplier || 1.35;
  return next;
}

function resolveMupanImmediatePursuit(state, { triggeredHabitId = "", balance = {} } = {}) {
  const next = cloneMupanBattleState(state);
  const canTrigger = !next.core.bossDead
    && next.turn.active
    && !next.turn.pursuitTriggered
    && triggeredHabitId === next.core.watchedHabitId;
  if (!canTrigger) return { state: next, triggered: false, attack: null };
  next.turn.pursuitTriggered = true;
  next.turn.habitTriggered = true;
  next.stats.pursuits = getMupanNonNegative(next.stats.pursuits) + 1;
  if (next.core.phase === 3) next.finalCountdown = Math.max(0, getMupanNonNegative(next.finalCountdown) - 1);
  return { state: next, triggered: true, attack: getMupanPursuitAttack(next, balance) };
}

function setMupanPhaseNow(state, phase) {
  const target = Math.max(1, Math.min(3, Math.floor(getMupanNonNegative(phase)) || 1));
  if (target <= state.core.phase) return;
  state.core.phase = target;
  state.core.pendingPhase = 0;
  if (target === 3) state.finalWatchIndex = 0;
  state.core.watchedHabitId = getMupanHabitForPhase(state, target);
  state.stats.reads = getMupanNonNegative(state.stats.reads) + 1;
}

function resolveMupanEndPlayerTurn(state, { balance = {} } = {}) {
  const next = cloneMupanBattleState(state);
  if (next.core.bossDead) return { state: next, avoidedPursuit: false, cancelPlannedAttack: true, attack: null };
  const phaseAtResolution = next.core.phase;
  const triggered = Boolean(next.turn.pursuitTriggered || next.turn.habitTriggered);
  if (next.turn.exposureActive && next.exposedTurns > 0) next.exposedTurns -= 1;

  const avoidedPursuit = !triggered;
  let cancelPlannedAttack = false;
  let attack = null;
  if (phaseAtResolution === 3) {
    next.finalCountdown = Math.max(0, getMupanNonNegative(next.finalCountdown) - 1);
  }

  if (avoidedPursuit) {
    next.stats.successfulBreaks = getMupanNonNegative(next.stats.successfulBreaks) + 1;
    next.exposedTurns = 1;
    next.exposureActive = false;
    if (phaseAtResolution === 3) {
      const maxExtensions = Math.max(0, getMupanNonNegative(balance.finalCountdown?.maxExtensions) || 2);
      if (next.finalExtensionsUsed < maxExtensions) {
        next.finalCountdown += 1;
        next.finalExtensionsUsed += 1;
      }
    }
  }
  if (phaseAtResolution === 3 && next.finalCountdown <= 0) {
    attack = getMupanFinalBlowAttack(balance);
    next.finalCountdown = Math.max(1, getMupanNonNegative(balance.finalCountdown?.resetAfterFinalBlow) || 2);
    next.stats.finalBlows = getMupanNonNegative(next.stats.finalBlows) + 1;
  } else {
    attack = getMupanPlannedAttack({ ...next, core: { ...next.core, phase: phaseAtResolution } }, balance);
  }

  next.turn = { active: false, pursuitTriggered: false, habitTriggered: false, exposureActive: false };
  next.currentTurn += 1;
  if (next.core.pendingPhase > next.core.phase) {
    setMupanPhaseNow(next, next.core.pendingPhase);
  } else if (next.core.phase === 3) {
    next.finalWatchIndex = (next.finalWatchIndex + 1) % 2;
    next.core.watchedHabitId = getMupanHabitForPhase(next, 3);
    next.stats.reads = getMupanNonNegative(next.stats.reads) + 1;
  }
  return { state: next, avoidedPursuit, cancelPlannedAttack, attack };
}

function markMupanBossDead(state) {
  const next = cloneMupanBattleState(state);
  next.core.bossDead = true;
  next.core.pendingPhase = 0;
  next.turn = { active: false, pursuitTriggered: false, habitTriggered: false, exposureActive: false };
  next.exposedTurns = 0;
  next.exposureActive = false;
  next.core.lastResolution = { kind: "battle", id: "boss", result: "bossDead" };
  return next;
}

function advanceMupanBattlePhase(state, { bossHp, bossMaxHp, balance = {} } = {}) {
  if (getMupanFiniteNumber(bossHp) <= 0) return markMupanBossDead(state);
  const next = cloneMupanBattleState(state);
  if (next.core.bossDead) return next;
  const maxHp = Math.max(1, getMupanNonNegative(bossMaxHp));
  const ratio = getMupanNonNegative(bossHp) / maxHp;
  const second = getMupanNonNegative(balance.phaseThresholds?.second) || 0.70;
  const final = getMupanNonNegative(balance.phaseThresholds?.final) || 0.35;
  const target = ratio <= final ? 3 : ratio <= second ? 2 : 1;
  if (target <= next.core.phase) return next;
  if (next.turn.active) next.core.pendingPhase = Math.max(next.core.pendingPhase || 0, target);
  else setMupanPhaseNow(next, target);
  return next;
}

function getMupanCurrentAction(state, balance = {}) {
  return getMupanPlannedAttack(state, balance);
}

function getMupanDamageTakenMultiplier(state) {
  if (!state || state.core?.bossDead) return 1;
  return state.turn?.exposureActive
    ? getMupanNonNegative(state.exposureMultiplier) || 1.35
    : 1;
}

function getMupanIntentDamage(action = {}, { attackMultiplier = 1, rageBonus = 0, weaken = 0, attackBonusMultiplier = 1 } = {}) {
  const hits = Math.max(1, Math.floor(getMupanNonNegative(action.hits)) || 1);
  const multiplier = Math.max(0, getMupanFiniteNumber(attackMultiplier)) * Math.max(0, getMupanFiniteNumber(attackBonusMultiplier));
  const weakened = Math.max(0, 1 - getMupanNonNegative(weaken));
  const segments = Array.isArray(action.fixedSegments)
    ? action.fixedSegments.map((value) => Math.max(0, Math.round((getMupanNonNegative(value) + getMupanNonNegative(rageBonus)) * multiplier * weakened)))
    : Array.from({ length: hits }, () => Math.max(0, Math.round((getMupanNonNegative(action.damage) + getMupanNonNegative(rageBonus)) * multiplier * weakened)));
  const total = segments.reduce((sum, value) => sum + value, 0);
  return { perHit: segments[0] || 0, hits: segments.length, segments, total };
}

/* 旧版调用点的过渡壳：在 game.js 完成接入前保持开发入口可运行。 */
function createMupanCoreState(debtSnapshot) {
  return createMupanBattleState({ debtSnapshot }).core;
}

function advanceMupanPhase(core, context = {}) {
  return advanceMupanBattlePhase({ core, turn: {}, stats: {}, sealedCards: [] }, context).core;
}

function beginMupanEnemyAction(state, turn) {
  const next = cloneMupanBattleState(state);
  next.currentTurn = Math.max(1, Math.floor(getMupanNonNegative(turn)) || next.currentTurn || 1);
  return next;
}

function completeMupanBattleEnemyAction(state, { bossHp, bossMaxHp, balance = {} } = {}) {
  return advanceMupanBattlePhase(state, { bossHp, bossMaxHp, balance });
}

function resolveMupanBattlePlayerTurn(state, metrics = {}) {
  const next = cloneMupanBattleState(state);
  next.turn.active = true;
  next.turn.pursuitTriggered = Boolean(metrics.habitTriggered);
  next.turn.habitTriggered = Boolean(metrics.habitTriggered);
  return resolveMupanEndPlayerTurn(next, { balance: metrics.balance || {} }).state;
}

function resolveMupanBattleArmorAttack(state) {
  return cloneMupanBattleState(state);
}

function breakMupanSealWithCard(state) {
  return cloneMupanBattleState(state);
}

function resolveMupanBattleFailure(state) {
  return { state: cloneMupanBattleState(state), payload: { extraDamage: 0, energyPenalty: 0, attackMultiplier: 1 } };
}

function getMupanRewriteAction(action = {}) {
  const next = { ...action, mupanRewritten: true, energyDrain: 1 };
  if (Array.isArray(action.fixedSegments)) next.fixedSegments = action.fixedSegments.map((value) => Math.max(0, getMupanNonNegative(value) - 2));
  else next.damage = Math.max(0, getMupanNonNegative(action.damage) - (getMupanNonNegative(action.hits) > 1 ? 2 : 4));
  return next;
}

function restoreMupanSealedCards({ hand = [], discardPile = [], sealedCards = [] } = {}) {
  return { hand: [...hand], discardPile: [...discardPile, ...sealedCards], sealedCards: [] };
}

function getMupanTestOutcome(victory) {
  return victory ? "mupanTestVictory" : "mupanTestDefeat";
}
