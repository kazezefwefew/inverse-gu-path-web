"use strict";
/* nmg-benming.js：V0.9.37 D-1b，本命蛊数据、道行、形态、路线与立绘辅助。须在 game.v 之前加载。 */
/* ===== V0.9.20 本命蛊：跨局养成——每位蛊修一只本命蛊，局末结道行、跨局进形态，被动常驻。 =====
 * 道行只增不减（nmg.benming JSON {heroId: 道行}），形态由阈值推导不落盘（坏档零风险）。
 * 被动强度封顶：真形全档叠加约等于两件普通遗物；十重天不豁免不加成。 */
const BENMING_KEY = "nmg.benming";
const BENMING_STAGES = Object.freeze([
  { stage: 0, name: "蛊卵", threshold: 0 },
  { stage: 1, name: "幼虫", threshold: 60 },
  { stage: 2, name: "成虫", threshold: 180 },
  { stage: 3, name: "真形", threshold: 420 },
  { stage: 4, name: "神化", threshold: 800 },  // V0.9.33 真形之上再开两阶，给满级玩家新追求
  { stage: 5, name: "归墟", threshold: 1500 },
]);
const BENMING_GU = Object.freeze({
  fate: {
    name: "衔命虫", glyph: "衔",
    lore: "衔着他被判死的那根命线，至今不肯松口。",
    stagePassives: ["尚在卵中沉睡。", "开局命势 +1。", "每场首次命势圆满时，额外抽 1 张牌。", "每局开局从「三相织命 / 噬签改命」中选择一条互斥路线。", "开局命势再 +1（累计 +2）。", "所选路线获得归墟强化。"],
  },
  blood: {
    name: "赤茧蛊", glyph: "茧",
    lore: "血债结成的茧，茧里裹着没讨回来的旧仇。",
    stagePassives: ["尚在卵中沉睡。", "每场战斗开局自带 2 层血煞。", "血煞上限 +2。", "每局开局从「缝煞成茧 / 裂茧代偿」中选择一条互斥路线。", "血煞上限再 +2（累计 +4）。", "所选路线获得归墟强化。"],
  },
  poison: {
    name: "蜕鳞蛊", glyph: "鳞",
    lore: "万毒噬身那夜蜕下的第一片鳞，还带着牙印。",
    stagePassives: ["尚在卵中沉睡。", "每场首次施毒额外 +1 层。", "攻击中毒的敌人时，伤害 +2。", "每场开局敌人自带 2 层毒性。", "攻击中毒敌人的额外伤害再 +2（累计 +4）。", "每场开局敌人自带毒性再 +2（累计 4 层）。"],
  },
  longevity: {
    name: "灯芯蛊", glyph: "芯",
    lore: "半盏寿灯里没烧完的芯，一头连着朝，一头连着暮。",
    stagePassives: ["尚在卵中沉睡。", "寿元上限 +2。", "每局首次焚寿时，返还 1 点寿元。", "焚寿燃命的伤害加成 +25%。", "寿元上限再 +2（累计 +4）。", "焚寿燃命的伤害加成再 +25%（累计 +50%）。"],
  },
});
const BENMING_PATHS = Object.freeze({
  fate: Object.freeze({
    threeWeave: Object.freeze({
      id: "threeWeave",
      name: "三相织命",
      glyph: "织",
      kind: "安排出牌顺序",
      summary: "按顺序打出攻击、护甲、辅助三类牌，第三类额外获得命势；重复类型会重新起算。",
      guide: Object.freeze({
        play: "依次打出攻击、护甲、辅助三类牌，第三类额外获得命势。",
        caution: "三类凑齐前打出重复类型，会重新起算。",
        benefit: "命势圆满后，多出的1点命势可以保留。",
        fit: "喜欢安排出牌顺序、频繁触发命势圆满的玩家。",
      }),
      lore: "衔命虫把杀意、护壳、蛊术三股蛊息绞成活结。少一股，命结不成；重复一股，命线打结，只能重新织起。",
      trueForm: "依次打出攻击、护甲、辅助三类牌，第三类额外获得命势；凑齐前重复类型会重新起算，圆满后多出的 1 点命势可以保留。",
      guixu: "每回合第一次打出重复类型时，这次不会重新起算；该牌仍按原规则获得命势。",
    }),
    devourOmen: Object.freeze({
      id: "devourOmen",
      name: "噬签改命",
      glyph: "签",
      kind: "改换敌人技能",
      summary: "每回合第一次命势圆满时，可改换敌人准备使用的技能；新技能不一定更弱。",
      guide: Object.freeze({
        play: "每回合第一次命势圆满时，可以改换敌人当前准备使用的技能。",
        caution: "新技能不一定更弱；也可以暂时不改，但满命势期间不能继续获得命势。",
        guixu: "可以先看一个新意图，再决定更换还是保留。",
        fit: "熟悉敌人技能、喜欢临场应变的玩家。",
      }),
      lore: "衔命虫把圆满命势压在齿间，等敌势显形后咬碎命签（敌人当前准备使用的技能）。改来的未必更好，但结果不再由天先写死。",
      trueForm: "每回合第一次命势圆满时，可改换敌人当前准备使用的技能；满命势期间不能继续获得命势。",
      guixu: "可以先看敌人一个新技能，再决定更换还是保留原技能；决定后结算命势圆满。",
    }),
  }),
  blood: Object.freeze({
    bloodStitch: Object.freeze({
      id: "bloodStitch",
      name: "缝煞成茧",
      glyph: "缝",
      kind: "先铺垫，再收束自损",
      summary: "先打出一张非血道牌完成铺垫，再打出的第一张血道牌会少失去 1 点生命，并额外获得 1 层血煞。",
      guide: Object.freeze({
        play: "每回合先打出一张非血道牌，再用血道牌收束。",
        caution: "真形时若先打血道牌，本回合会错过缝煞；没有自损的血道牌也会用掉铺垫，但不会获得减伤和额外血煞。",
        benefit: "有自损的血道牌少失去 1 点生命，并在该牌原本获得血煞时额外获得 1 层。",
        guixu: "归墟后，提前打血道牌不会错过本回合机会，之后仍可先铺垫再触发。",
        fit: "适合愿意安排出牌顺序、用非血道牌为爆发做铺垫的玩家。",
      }),
      lore: "赤茧蛊以异息作针，把将落未落的血债缝回茧壳。",
      trueForm: "每回合先打出一张非血道牌完成铺垫；之后第一张血道牌若会令你失去生命，则少失去 1 点生命，并额外获得 1 层血煞。提前打出血道牌会错过本回合机会。",
      guixu: "提前打出血道牌不再令本回合错过缝煞；之后仍可用非血道牌铺垫，并触发一次缝煞。",
    }),
    bloodAtonement: Object.freeze({
      id: "bloodAtonement",
      name: "裂茧代偿",
      glyph: "偿",
      kind: "主动支付血煞，抵消自损",
      summary: "打出会自损的血道攻击牌时，可主动消耗 3 层血煞，少失去 3 点生命；该次攻击仍按支付前的血煞计算。",
      guide: Object.freeze({
        play: "打出会自损的血道攻击牌时，在确认页主动选择代偿。",
        caution: "每次消耗 3 层血煞；不适用于非攻击牌、没有自损的攻击牌或遗物造成的自损。",
        benefit: "本次自损减少 3 点，且本次攻击仍按支付前的血煞计算。",
        guixu: "归墟后每回合最多可代偿两次；同一张牌仍只能代偿一次。",
        fit: "适合保留血煞作为生存筹码、在关键攻击前主动权衡的玩家。",
      }),
      lore: "赤茧蛊撕开旧茧，以三缕血煞替宿主承下一笔现世血债。",
      trueForm: "每回合一次：打出会自损的血道攻击牌时，可主动消耗 3 层血煞，使该牌少令你失去 3 点生命；本次攻击按支付前的血煞计算。",
      guixu: "每回合最多可代偿两次；同一张牌最多一次。",
    }),
  }),
});
const BENMING_PATH_SCHEMA = 2;
const BENMING_FATE_MAX = 3;
const BENMING_FATE_BURST_MAX = 2;
let __benmingCache = null;
function getBenmingStore() {
  if (__benmingCache) return __benmingCache;
  try { __benmingCache = JSON.parse(localStorage.getItem(BENMING_KEY)) || {}; } catch (e) { __benmingCache = {}; }
  return __benmingCache;
}
function getBenmingDaoxing(heroId) {
  const v = Number(getBenmingStore()[heroId]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}
function addBenmingDaoxing(heroId, amount) {
  if (!heroId || !(amount > 0)) return;
  const store = getBenmingStore();
  store[heroId] = getBenmingDaoxing(heroId) + Math.floor(amount);
  try { safeWriteJson(BENMING_KEY, JSON.stringify(store)); } catch (e) { /* 存储不可用则忽略 */ }
}
function getBenmingStage(heroId) {
  const dao = getBenmingDaoxing(heroId);
  let stage = 0;
  BENMING_STAGES.forEach((s) => { if (dao >= s.threshold) stage = s.stage; });
  return stage;
}
function getBenmingStageInfo(heroId) {
  const stage = getBenmingStage(heroId);
  const dao = getBenmingDaoxing(heroId);
  const next = BENMING_STAGES[stage + 1] || null;
  return { stage, stageName: BENMING_STAGES[stage].name, dao, next, toNext: next ? next.threshold - dao : 0 };
}

function getEffectiveBenmingStage(heroId) {
  let effective = getBenmingStage(heroId);
  const guluStore = typeof getGuluStore === "function" ? getGuluStore() : null;
  const now = typeof guluNow === "function" ? guluNow() : Date.now();
  if (guluStore?.injuryUntil && now < guluStore.injuryUntil) effective = Math.max(0, effective - 1);
  return effective;
}

function getBenmingPathDefinition(heroId, pathId) {
  return BENMING_PATHS[heroId]?.[pathId] || null;
}

function getRunBenmingPath(run) {
  if (!run || !Object.prototype.hasOwnProperty.call(run, "benmingPath")) return null;
  return getBenmingPathDefinition(run.heroId || "fate", run.benmingPath)?.id || null;
}

function isLegacyBenmingRun(run) {
  if (!run) return false;
  if (run.heroId === "fate") return !Object.prototype.hasOwnProperty.call(run, "benmingPath");
  if (run.heroId === "blood") return Number(run.benmingPathSchema) !== BENMING_PATH_SCHEMA;
  return false;
}

function getBenmingPathDisplayName(run) {
  if (!run) return "未启用";
  if (isLegacyBenmingRun(run)) return run.heroId === "blood" ? "旧规则·破茧吮煞" : "旧规则·圆满余泽";
  return getBenmingPathDefinition(run.heroId, getRunBenmingPath(run))?.name || "未启用";
}

function getBenmingStagePassiveText(heroId, stage, pathId = null, legacy = false) {
  const gu = BENMING_GU[heroId];
  if (!gu) return "";
  if (!(["fate", "blood"].includes(heroId)) || (stage !== 3 && stage !== 5)) return gu.stagePassives[stage] || "";
  if (legacy) {
    if (heroId === "blood") return stage === 3
      ? "每场首次血煞满溢时，恢复 4 点生命。"
      : "每场开局自带血煞再 +2（累计 4 层）。";
    return stage === 3
      ? "命势圆满时，额外获得 1 点防御与 1 蛊石。"
      : "命势圆满的额外收益翻倍（+2 防御、+2 蛊石）。";
  }
  const path = getBenmingPathDefinition(heroId, pathId);
  if (!path) return gu.stagePassives[stage] || "";
  return stage === 3 ? path.trueForm : path.guixu;
}

// 纯规则：规划本回合缝煞状态，不读写 runState、game 或 DOM。
function resolveBloodStitchFlow(currentState, options = {}) {
  const state = ["unprepared", "prepared", "spent", "forfeited"].includes(currentState)
    ? currentState
    : "unprepared";
  const isBloodCard = Boolean(options.isBloodCard);
  const selfDamage = Math.max(0, Number(options.selfDamage) || 0);
  const guixu = Boolean(options.guixu);
  const unchanged = {
    state, triggered: false, consumed: false, forfeited: false,
    selfDamageReduction: 0, bonusBlood: 0,
  };
  if (state === "spent" || state === "forfeited") return unchanged;
  if (!isBloodCard) return { ...unchanged, state: "prepared" };
  if (state === "prepared") {
    return {
      state: "spent",
      triggered: selfDamage > 0,
      consumed: true,
      forfeited: false,
      selfDamageReduction: selfDamage > 0 ? 1 : 0,
      bonusBlood: selfDamage > 0 ? 1 : 0,
    };
  }
  if (guixu) return unchanged;
  return { ...unchanged, state: "forfeited", forfeited: true };
}

// 纯规则：预览或确认一次裂茧代偿；副作用由 game.js 在确认后执行。
function planBloodAtonement(options = {}) {
  const blood = Math.max(0, Number(options.blood) || 0);
  const usesThisTurn = Math.max(0, Number(options.usesThisTurn) || 0);
  const selfDamage = Math.max(0, Number(options.selfDamage) || 0);
  const maxUses = options.guixu ? 2 : 1;
  const eligible = Boolean(options.isBloodCard)
    && Boolean(options.isAttack)
    && selfDamage > 0
    && blood >= 3
    && usesThisTurn < maxUses
    && !options.cardAlreadyAtoned;
  const applied = eligible && Boolean(options.confirmed);
  return {
    eligible,
    applied,
    reason: eligible ? "" : (blood < 3 ? "血煞不足 3 层" : (usesThisTurn >= maxUses ? "本回合代偿次数已用尽" : "此牌不能代偿")),
    bloodSnapshot: blood,
    bloodAfter: applied ? blood - 3 : blood,
    bloodSpent: applied ? 3 : 0,
    selfDamageAfter: applied ? Math.max(0, selfDamage - 3) : selfDamage,
    selfDamageIfApplied: eligible ? Math.max(0, selfDamage - 3) : selfDamage,
    hpSaved: applied ? Math.min(3, selfDamage) : 0,
    usesAfter: applied ? usesThisTurn + 1 : usesThisTurn,
    maxUses,
  };
}

// 纯规则函数：只规划三相序列与本张出牌命势，战斗副作用仍由 game.js 统一执行。
function resolveFateTriadFlow(sequence, graceUsed, currentFlow, lastFlow, chainFate, guixu) {
  const validFlows = ["attack", "defense", "utility"];
  let nextSequence = Array.isArray(sequence)
    ? sequence.filter((flow, index, list) => validFlows.includes(flow) && list.indexOf(flow) === index)
    : [];
  if (!validFlows.includes(currentFlow)) {
    return { sequence: nextSequence, graceUsed: Boolean(graceUsed), fateGain: 0, completed: false, repeated: false };
  }

  const repeated = nextSequence.includes(currentFlow);
  let nextGraceUsed = Boolean(graceUsed);
  const graceConsumed = repeated && guixu && !nextGraceUsed;
  if (repeated) {
    if (graceConsumed) nextGraceUsed = true;
    else nextSequence = [currentFlow];
  } else {
    nextSequence.push(currentFlow);
  }

  const gainsByFlow = Boolean(lastFlow) && (lastFlow !== currentFlow || Boolean(chainFate));
  let fateGain = gainsByFlow ? 1 : 0;
  const completed = !repeated && validFlows.every((flow) => nextSequence.includes(flow));
  if (completed) {
    fateGain = gainsByFlow ? 2 : 0;
    nextSequence = [];
  }
  return { sequence: nextSequence, graceUsed: nextGraceUsed, fateGain, completed, repeated, graceConsumed };
}

// 纯规则函数：单次命势来源至多结算一次；第三次圆满永远被两次上限截住。
function planFateMomentumGain(momentum, amount, burstsThisTurn, allowOverflow, deferFull) {
  const before = Math.max(0, Math.min(BENMING_FATE_MAX, Number(momentum) || 0));
  const gainAmount = Math.max(0, Number(amount) || 0);
  const bursts = Math.max(0, Number(burstsThisTurn) || 0);
  if (gainAmount <= 0) return { gained: 0, momentumAfter: before, settlements: 0, pending: false };

  if (bursts >= BENMING_FATE_BURST_MAX) {
    return {
      gained: Math.max(0, Math.min(gainAmount, BENMING_FATE_MAX - before)),
      momentumAfter: Math.min(BENMING_FATE_MAX, before + gainAmount),
      settlements: 0,
      pending: false,
    };
  }

  const total = before + gainAmount;
  if (total < BENMING_FATE_MAX) {
    return { gained: gainAmount, momentumAfter: total, settlements: 0, pending: false };
  }

  const gained = Math.max(0, allowOverflow && before < BENMING_FATE_MAX
    ? gainAmount
    : Math.min(gainAmount, BENMING_FATE_MAX - before));
  if (deferFull) {
    return { gained, momentumAfter: BENMING_FATE_MAX, settlements: 0, pending: true };
  }
  const overflow = allowOverflow && before < BENMING_FATE_MAX
    ? Math.min(BENMING_FATE_MAX - 1, Math.max(0, total - BENMING_FATE_MAX))
    : 0;
  return { gained, momentumAfter: overflow, settlements: 1, pending: false };
}

// 战斗内被动判定：本局蛊修是该蛊之主，且形态已到档。V0.9.22：蛊斗反噬静养期内形态降一档。
function benmingPassive(heroId, stage) {
  if (!runState || runState.heroId !== heroId) return false;
  return getEffectiveBenmingStage(heroId) >= stage;
}
// V0.9.34 神化/归墟(stage4/5)专属立绘已就位（heroId-4/5.jpg）；不再封顶复用真形。
function getBenmingImagePath(heroId, stage) { return `assets/codex/benming/${heroId}-${Number(stage) || 0}.jpg`; }
