"use strict";
/* 批次 E-2b1：万命母盘命债评分与纯规则状态机。
 * 本模块不读取任何运行态或界面对象；调用方必须通过参数传入数据并接收返回状态。 */

const MUPAN_DEBT_TIE_ORDER = Object.freeze(["blood", "life", "fate", "poison", "armor", "haste"]);

const MUPAN_DEBT_DEFINITIONS = Object.freeze({
  blood: Object.freeze({ id: "blood", name: "血债", sealName: "血债签·血竭" }),
  life: Object.freeze({ id: "life", name: "寿债", sealName: "寿债签·灯尽" }),
  fate: Object.freeze({ id: "fate", name: "势债", sealName: "势债签·势缚" }),
  poison: Object.freeze({ id: "poison", name: "毒债", sealName: "毒债签·毒归" }),
  armor: Object.freeze({ id: "armor", name: "甲债", sealName: "甲债签·壳葬" }),
  haste: Object.freeze({ id: "haste", name: "息债", sealName: "息债签·手乱" }),
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

function evaluateMupanAttachments(metrics, attachments = {}) {
  const cardsPlayed = getMupanNonNegative(metrics.cardsPlayed);
  const energyRemaining = getMupanNonNegative(metrics.energyRemaining);
  if (Number.isFinite(Number(attachments.maxCards)) && cardsPlayed > Number(attachments.maxCards)) return false;
  if (Number.isFinite(Number(attachments.minEnergy)) && energyRemaining < Number(attachments.minEnergy)) return false;
  return true;
}

function evaluateMupanSealCondition(sealId, metrics = {}, attachments = {}) {
  if (!MUPAN_DEBT_DEFINITIONS[sealId] || sealId === "armor" || metrics.turnEnded !== true) return false;
  if (!evaluateMupanAttachments(metrics, attachments)) return false;
  const cardsPlayed = getMupanNonNegative(metrics.cardsPlayed);
  const selfHpLost = getMupanNonNegative(metrics.selfHpLost);
  const lifespanSpent = getMupanNonNegative(metrics.lifespanSpent);
  const fateTriggers = getMupanNonNegative(metrics.fateTriggers);
  const poisonAdded = getMupanNonNegative(metrics.poisonAdded);
  const nonPoisonDamage = getMupanNonNegative(metrics.nonPoisonDamage);
  const energyRemaining = getMupanNonNegative(metrics.energyRemaining);
  if (sealId === "blood") return cardsPlayed >= 2 && selfHpLost === 0;
  if (sealId === "life") return cardsPlayed >= 1 && lifespanSpent === 0 && energyRemaining >= 1;
  if (sealId === "fate") return cardsPlayed >= 3 && fateTriggers === 0;
  if (sealId === "poison") return nonPoisonDamage >= 12 && poisonAdded === 0;
  if (sealId === "haste") return cardsPlayed <= 3 && nonPoisonDamage >= 12;
  return false;
}

function cloneMupanSeal(seal) {
  if (!seal) return null;
  return {
    ...seal,
    attachments: { ...(seal.attachments || {}) },
    sealIds: Array.isArray(seal.sealIds) ? [...seal.sealIds] : undefined,
    completedSealIds: Array.isArray(seal.completedSealIds) ? [...seal.completedSealIds] : undefined,
  };
}

function cloneMupanCoreState(state) {
  return {
    ...state,
    activeSeal: cloneMupanSeal(state.activeSeal),
    pendingFinalSeal: state.pendingFinalSeal ? { ...state.pendingFinalSeal, sealIds: [...state.pendingFinalSeal.sealIds] } : null,
    lastResolution: state.lastResolution ? { ...state.lastResolution } : null,
  };
}

function createMupanCoreState(debtSnapshot) {
  return {
    phase: 1,
    bossDead: false,
    debtSnapshot,
    activeSeal: null,
    pendingFinalSeal: null,
    enemyActionEnds: 0,
    lastResolution: null,
  };
}

function makeMupanOrdinarySeal(id, options = {}) {
  return {
    kind: "ordinary",
    id,
    status: "active",
    remainingAttempts: 2,
    attachments: { ...(options.attachments || {}) },
    armorPrepared: false,
  };
}

function makeMupanFinalSeal(sealIds) {
  return {
    kind: "final",
    id: "final",
    status: "active",
    remainingAttempts: 3,
    sealIds: [...sealIds],
    completedSealIds: [],
    attachments: {},
    armorPrepared: false,
  };
}

function activateMupanSeal(state, sealId, options = {}) {
  const next = cloneMupanCoreState(state);
  if (next.bossDead || next.activeSeal || next.pendingFinalSeal || !MUPAN_DEBT_DEFINITIONS[sealId]) return next;
  next.activeSeal = makeMupanOrdinarySeal(sealId, options);
  return next;
}

function setMupanFinalActivationAfterClose(state, during) {
  if (!state.pendingFinalSeal || state.pendingFinalSeal.activateAfterEnemyActionEnd != null) return;
  state.pendingFinalSeal.activateAfterEnemyActionEnd = state.enemyActionEnds + (during === "enemy" ? 2 : 1);
}

function closeMupanActiveSeal(state, { result = "success", during = "player" } = {}) {
  const next = cloneMupanCoreState(state);
  if (!next.activeSeal) return next;
  const closed = next.activeSeal;
  next.activeSeal = null;
  next.lastResolution = { kind: closed.kind, id: closed.id, result };
  setMupanFinalActivationAfterClose(next, during);
  return next;
}

function resolveMupanFinalPlayerTurn(state, metrics) {
  const next = cloneMupanCoreState(state);
  const seal = next.activeSeal;
  const completed = new Set(seal.completedSealIds || []);
  for (const sealId of seal.sealIds || []) {
    if (completed.has(sealId)) continue;
    if (sealId === "armor") {
      seal.armorPrepared = evaluateMupanAttachments(metrics, seal.attachments);
      seal.armorAwaitingValidation = true;
      continue;
    }
    if (evaluateMupanSealCondition(sealId, metrics, seal.attachments)) completed.add(sealId);
  }
  seal.completedSealIds = [...completed];
  if (seal.sealIds.every((sealId) => completed.has(sealId))) return closeMupanActiveSeal(next, { result: "success", during: "player" });
  if (seal.armorAwaitingValidation && !completed.has("armor")) return next;
  seal.remainingAttempts = Math.max(0, seal.remainingAttempts - 1);
  if (seal.remainingAttempts === 0) seal.status = "awaitingFailure";
  return next;
}

function resolveMupanPlayerTurn(state, metrics = {}) {
  const next = cloneMupanCoreState(state);
  const seal = next.activeSeal;
  if (!seal || seal.status !== "active" || metrics.turnEnded !== true) return next;
  if (seal.kind === "final") return resolveMupanFinalPlayerTurn(next, metrics);
  if (seal.id === "armor") {
    seal.armorPrepared = evaluateMupanAttachments(metrics, seal.attachments);
    return next;
  }
  if (evaluateMupanSealCondition(seal.id, metrics, seal.attachments)) {
    return closeMupanActiveSeal(next, { result: "success", during: "player" });
  }
  seal.remainingAttempts = Math.max(0, seal.remainingAttempts - 1);
  if (seal.remainingAttempts === 0) seal.status = "awaitingFailure";
  return next;
}

function resolveMupanArmorAttack(state, { isAttack = false, hpDamage = 0 } = {}) {
  const next = cloneMupanCoreState(state);
  const seal = next.activeSeal;
  const isOrdinaryArmor = seal?.kind === "ordinary" && seal.id === "armor";
  const isFinalArmor = seal?.kind === "final" && seal.sealIds?.includes("armor") && !(seal.completedSealIds || []).includes("armor");
  if (!seal || seal.status !== "active" || (!isOrdinaryArmor && !isFinalArmor) || !isAttack) return next;
  const blocked = seal.armorPrepared && getMupanNonNegative(hpDamage) === 0;
  if (blocked && isOrdinaryArmor) {
    return closeMupanActiveSeal(next, { result: "success", during: "enemy" });
  }
  if (blocked && isFinalArmor) {
    seal.completedSealIds = [...(seal.completedSealIds || []), "armor"];
    seal.armorPrepared = false;
    seal.armorAwaitingValidation = false;
    if (seal.sealIds.every((sealId) => seal.completedSealIds.includes(sealId))) {
      return closeMupanActiveSeal(next, { result: "success", during: "enemy" });
    }
  }
  seal.remainingAttempts = Math.max(0, seal.remainingAttempts - 1);
  seal.armorPrepared = false;
  seal.armorAwaitingValidation = false;
  if (seal.remainingAttempts === 0) seal.status = "awaitingFailure";
  return next;
}

function markMupanBossDead(state) {
  const next = cloneMupanCoreState(state);
  next.bossDead = true;
  next.activeSeal = null;
  next.pendingFinalSeal = null;
  next.lastResolution = { kind: "battle", id: "boss", result: "bossDead" };
  return next;
}

function advanceMupanPhase(state, { bossHp, bossMaxHp, thresholds = {} } = {}) {
  if (getMupanFiniteNumber(bossHp) <= 0) return markMupanBossDead(state);
  const next = cloneMupanCoreState(state);
  if (next.bossDead) return next;
  const maxHp = Math.max(1, getMupanNonNegative(bossMaxHp));
  const ratio = getMupanNonNegative(bossHp) / maxHp;
  const secondThreshold = getMupanNonNegative(thresholds.second);
  const finalThreshold = getMupanNonNegative(thresholds.final);
  const targetPhase = finalThreshold > 0 && ratio <= finalThreshold
    ? 3
    : secondThreshold > 0 && ratio <= secondThreshold ? 2 : 1;
  if (targetPhase <= next.phase) return next;
  next.phase = targetPhase;
  if (targetPhase === 3 && !next.pendingFinalSeal && next.activeSeal?.kind !== "final") {
    const sealIds = [next.debtSnapshot.primary.id, next.debtSnapshot.secondary.id];
    next.pendingFinalSeal = {
      sealIds,
      activateAfterEnemyActionEnd: next.activeSeal ? null : next.enemyActionEnds + 1,
    };
  }
  return next;
}

function completeMupanEnemyAction(state) {
  const next = cloneMupanCoreState(state);
  if (next.bossDead) return next;
  next.enemyActionEnds += 1;
  const pending = next.pendingFinalSeal;
  if (
    pending
    && !next.activeSeal
    && pending.activateAfterEnemyActionEnd != null
    && next.enemyActionEnds >= pending.activateAfterEnemyActionEnd
  ) {
    next.activeSeal = makeMupanFinalSeal(pending.sealIds);
    next.pendingFinalSeal = null;
  }
  return next;
}

function cloneMupanBattleState(state) {
  return {
    ...state,
    core: cloneMupanCoreState(state.core),
    stats: { ...(state.stats || {}) },
  };
}

function getMupanModeRules({ mode = "normal", tianTier = 0 } = {}, balance = {}) {
  let phase2Attachments = [null, null];
  let sealEnergyCost = 1;
  let sealDrawPenalty = 0;
  let failureMode = mode;
  if (mode === "elite") phase2Attachments = [null, { minEnergy: 1 }];
  if (mode === "deathtrial") {
    phase2Attachments = [{ maxCards: 4 }, { minEnergy: 1 }];
    sealDrawPenalty = 1;
  }
  if (mode === "tian") {
    failureMode = "normal";
    if (tianTier >= 10) {
      phase2Attachments = [{ maxCards: 4, minEnergy: 1 }, { maxCards: 4, minEnergy: 1 }];
      sealEnergyCost = 2;
    } else if (tianTier >= 5) {
      phase2Attachments = [{ maxCards: 4 }, { minEnergy: 1 }];
    } else {
      phase2Attachments = [null, { minEnergy: 1 }];
    }
  }
  return Object.freeze({
    phase2Attachments: Object.freeze(phase2Attachments.map((item) => item ? Object.freeze({ ...item }) : null)),
    sealEnergyCost,
    sealDrawPenalty,
    failureDamage: balance.failureDamage?.[failureMode] || balance.failureDamage?.normal || {},
  });
}

function createMupanBattleState({ debtSnapshot, mode = "normal", tianTier = 0, balance = {} } = {}) {
  return {
    core: createMupanCoreState(debtSnapshot),
    mode,
    tianTier,
    rules: getMupanModeRules({ mode, tianTier }, balance),
    actionIndex: 0,
    phase2SealCount: 0,
    exposureActive: false,
    broken: false,
    rageStacks: 0,
    currentTurn: 1,
    nextSettleBonus: 0,
    finalFailureAttackMultiplier: 1,
    exposureMultiplier: getMupanNonNegative(balance.exposureMultiplier) || 1,
    brokenMultiplier: getMupanNonNegative(balance.brokenMultiplier) || 1,
    configuredFinalFailureAttackMultiplier: getMupanNonNegative(balance.finalFailureAttackMultiplier) || 1,
    stats: {
      sealsShown: 0,
      behaviorBreaks: 0,
      sealedBreaks: 0,
      failedSeals: 0,
      finalResult: "未触发",
    },
  };
}

function getMupanActionCycle(state, balance = {}) {
  if (state.broken) return balance.actions?.broken || [];
  if (state.core.phase >= 3) return balance.actions?.phase3 || [];
  if (state.core.phase === 2) return balance.actions?.phase2 || [];
  return balance.actions?.phase1 || [];
}

function getMupanCurrentAction(state, balance = {}) {
  const capTurn = getMupanNonNegative(balance.rage?.capTurn) || 20;
  if (state.currentTurn >= capTurn) {
    return {
      id: "mupanFinalCap",
      name: "万命归一",
      icon: "一",
      kind: "attack",
      damage: getMupanNonNegative(balance.rage?.capDamage) || 40,
      hits: 1,
      mupanCap: true,
    };
  }
  const cycle = getMupanActionCycle(state, balance);
  if (!cycle.length) return {};
  return { ...cycle[state.actionIndex % cycle.length] };
}

function setMupanBattleTurn(state, turn, balance = {}) {
  const next = cloneMupanBattleState(state);
  next.currentTurn = Math.max(1, Math.floor(getMupanNonNegative(turn)) || 1);
  const startTurn = getMupanNonNegative(balance.rage?.startTurn) || 15;
  const maxStacks = getMupanNonNegative(balance.rage?.maxStacks) || 5;
  next.rageStacks = next.currentTurn >= startTurn
    ? Math.min(maxStacks, next.currentTurn - startTurn + 1)
    : 0;
  return next;
}

function beginMupanEnemyAction(state, turn, balance = {}) {
  const next = setMupanBattleTurn(state, turn, balance);
  next.exposureActive = false;
  return next;
}

function advanceMupanBattlePhase(state, { bossHp, bossMaxHp, source = "player", balance = {} } = {}) {
  const next = cloneMupanBattleState(state);
  const previousPhase = next.core.phase;
  next.core = advanceMupanPhase(next.core, { bossHp, bossMaxHp, source, thresholds: balance.phaseThresholds });
  if (next.core.phase !== previousPhase) next.actionIndex = 0;
  return next;
}

function getMupanPhase2Attachments(state) {
  const list = state.rules?.phase2Attachments || [null, null];
  return list[state.phase2SealCount % list.length] || {};
}

function completeMupanBattleEnemyAction(state, { actionId, bossHp, bossMaxHp, balance = {} } = {}) {
  let next = cloneMupanBattleState(state);
  if (getMupanFiniteNumber(bossHp) <= 0) {
    next.core = markMupanBossDead(next.core);
    return next;
  }
  const action = [...(balance.actions?.phase1 || []), ...(balance.actions?.phase2 || []), ...(balance.actions?.phase3 || []), ...(balance.actions?.broken || [])]
    .find((entry) => entry.id === actionId) || {};
  if (action.primesSettle) next.nextSettleBonus = getMupanNonNegative(action.primesSettle);
  next.core = completeMupanEnemyAction(next.core);
  if (action.activatesSeal && !next.core.activeSeal && !next.core.pendingFinalSeal && !next.broken) {
    const sealId = next.core.phase === 1
      ? next.core.debtSnapshot.primary.id
      : (next.phase2SealCount % 2 === 0 ? next.core.debtSnapshot.primary.id : next.core.debtSnapshot.secondary.id);
    const attachments = next.core.phase === 2 ? getMupanPhase2Attachments(next) : {};
    next.core = activateMupanSeal(next.core, sealId, { attachments });
    if (next.core.phase === 2) next.phase2SealCount += 1;
    next.stats.sealsShown += 1;
  }
  const cycle = getMupanActionCycle(next, balance);
  if (cycle.some((entry) => entry.id === actionId) && !action.mupanCap) {
    next.actionIndex = (next.actionIndex + 1) % cycle.length;
  }
  return next;
}

function applyMupanSuccessfulResolution(state, beforeSeal, method) {
  const next = cloneMupanBattleState(state);
  if (!beforeSeal || next.core.activeSeal) return next;
  if (method === "behavior") next.stats.behaviorBreaks += 1;
  if (method === "sealed") next.stats.sealedBreaks += 1;
  if (beforeSeal.kind === "final") {
    next.broken = true;
    next.exposureActive = false;
    next.stats.finalResult = "已破除";
  } else if (method === "behavior" && next.core.phase >= 2) {
    next.exposureActive = true;
  }
  return next;
}

function resolveMupanBattlePlayerTurn(state, metrics = {}) {
  const beforeSeal = cloneMupanSeal(state.core.activeSeal);
  const next = cloneMupanBattleState(state);
  next.core = resolveMupanPlayerTurn(next.core, metrics);
  return applyMupanSuccessfulResolution(next, beforeSeal, "behavior");
}

function resolveMupanBattleArmorAttack(state, attack = {}) {
  const beforeSeal = cloneMupanSeal(state.core.activeSeal);
  const next = cloneMupanBattleState(state);
  next.core = resolveMupanArmorAttack(next.core, attack);
  return applyMupanSuccessfulResolution(next, beforeSeal, "behavior");
}

function breakMupanSealWithCard(state, sealId) {
  const next = cloneMupanBattleState(state);
  const seal = next.core.activeSeal;
  if (!seal || seal.status !== "active") return next;
  if (seal.kind === "ordinary") {
    if (seal.id !== sealId) return next;
    const beforeSeal = cloneMupanSeal(seal);
    next.core = closeMupanActiveSeal(next.core, { result: "sealed", during: "player" });
    return applyMupanSuccessfulResolution(next, beforeSeal, "sealed");
  }
  if (!seal.sealIds.includes(sealId) || seal.completedSealIds.includes(sealId)) return next;
  seal.completedSealIds = [...seal.completedSealIds, sealId];
  next.stats.sealedBreaks += 1;
  if (seal.sealIds.every((id) => seal.completedSealIds.includes(id))) {
    next.core = closeMupanActiveSeal(next.core, { result: "sealed", during: "player" });
    next.broken = true;
    next.exposureActive = false;
    next.stats.finalResult = "已破除";
  }
  return next;
}

function resolveMupanBattleFailure(state, { actionId, balance = {} } = {}) {
  const next = cloneMupanBattleState(state);
  const seal = next.core.activeSeal;
  if (!seal || seal.status !== "awaitingFailure") {
    return { state: next, payload: { extraDamage: 0, energyPenalty: 0, attackMultiplier: 1 } };
  }
  const phaseKey = seal.kind === "final" ? "final" : next.core.phase === 1 ? "phase1" : "phase2";
  let extraDamage = getMupanNonNegative(next.rules?.failureDamage?.[phaseKey]);
  if (phaseKey === "phase2") extraDamage += next.nextSettleBonus || 0;
  next.nextSettleBonus = 0;
  next.core = closeMupanActiveSeal(next.core, { result: "failure", during: "enemy" });
  next.stats.failedSeals += 1;
  if (seal.kind === "final") {
    next.finalFailureAttackMultiplier = next.configuredFinalFailureAttackMultiplier;
    next.stats.finalResult = "未破除";
  }
  return {
    state: next,
    payload: {
      actionId,
      extraDamage,
      energyPenalty: 1,
      attackMultiplier: next.finalFailureAttackMultiplier,
    },
  };
}

function getMupanDamageTakenMultiplier(state) {
  if (state.broken) return state.brokenMultiplier || 1;
  if (state.exposureActive) return state.exposureMultiplier || 1;
  return 1;
}

function getMupanIntentDamage(action = {}, { attackMultiplier = 1, rageBonus = 0, weaken = 0, attackBonusMultiplier = 1 } = {}) {
  const hits = Math.max(1, Math.floor(getMupanNonNegative(action.hits)) || 1);
  let segments;
  if (Array.isArray(action.fixedSegments)) {
    segments = action.fixedSegments.slice(0, hits).map(getMupanNonNegative);
  } else {
    const perHit = Math.max(0, Math.round(getMupanNonNegative(action.damage) * getMupanNonNegative(attackMultiplier) * getMupanNonNegative(attackBonusMultiplier)));
    segments = Array(hits).fill(perHit);
    if (segments.length) segments[0] += getMupanNonNegative(rageBonus);
  }
  let total = segments.reduce((sum, value) => sum + value, 0);
  const weakenCut = Math.min(total, getMupanNonNegative(weaken));
  total -= weakenCut;
  if (weakenCut > 0 && segments.length) segments[0] = Math.max(0, segments[0] - weakenCut);
  return Object.freeze({ hits, segments: Object.freeze(segments), total, weakenCut });
}

function getMupanRewriteAction(action = {}) {
  const hits = Math.max(1, Math.floor(getMupanNonNegative(action.hits)) || 1);
  const cut = hits === 2 ? 2 : 4;
  const next = {
    ...action,
    name: "夺息刻",
    icon: "夺",
    energyDrain: 1,
    mupanRewritten: true,
  };
  if (Array.isArray(action.fixedSegments)) {
    next.fixedSegments = action.fixedSegments.map((value) => Math.max(0, getMupanNonNegative(value) - cut));
    next.damage = next.fixedSegments[0] || 0;
  } else {
    next.damage = Math.max(0, getMupanNonNegative(action.damage) - cut);
  }
  return next;
}

function restoreMupanSealedCards({ hand = [], discardPile = [], sealedCards = [] } = {}) {
  const restored = [...discardPile];
  for (const card of sealedCards) {
    if (!restored.some((entry) => entry.instanceId === card.instanceId) && !hand.some((entry) => entry.instanceId === card.instanceId)) {
      restored.push(card);
    }
  }
  return { hand: [...hand], discardPile: restored, sealedCards: [] };
}

function getMupanTestOutcome(victory) {
  return victory ? "mupanTestVictory" : "mupanTestDefeat";
}
