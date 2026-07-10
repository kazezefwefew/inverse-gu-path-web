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
    stagePassives: ["尚在卵中沉睡。", "每场战斗开局自带 2 层血煞。", "血煞上限 +2。", "每场首次血煞满溢时，恢复 4 点生命。", "血煞上限再 +2（累计 +4）。", "每场开局自带血煞再 +2（累计 4 层）。"],
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
      kind: "生成路线",
      summary: "连续织入攻击、护甲、辅助三类牌时，第三类的出牌命势改为 +2，溢出保留；重复牌类会重置三相。",
      lore: "衔命虫把杀意、护壳、蛊术三股蛊息绞成活结。少一股，命结不成；重复一股，命线打结，只能重新织起。",
      trueForm: "三类牌齐备时，第三类的出牌命势改为 +2，溢出保留；重复牌类会重置三相。",
      guixu: "每回合第一次牌类重复不再重置三相；该牌仍只按原规则获得命势。",
    }),
    devourOmen: Object.freeze({
      id: "devourOmen",
      name: "噬签改命",
      glyph: "签",
      kind: "消费路线",
      summary: "每回合首次命势盈满时暂不结算；点击敌人意图随机改签，然后结算圆满。",
      lore: "衔命虫把圆满命势压在齿间，等敌势显形后咬碎塔中落下的命签。改来的未必更好，但结果不再由天先写死。",
      trueForm: "每回合首次命势盈满时暂不结算；点击敌人意图随机改签，然后结算圆满。",
      guixu: "点击敌人意图后先看见一张新命签，可选择改签或保留原意图；选择后结算圆满。",
    }),
  }),
});
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
  return Boolean(run && run.heroId === "fate" && !Object.prototype.hasOwnProperty.call(run, "benmingPath"));
}

function getBenmingPathDisplayName(run) {
  if (!run || run.heroId !== "fate") return "未启用";
  if (isLegacyBenmingRun(run)) return "旧规则·圆满余泽";
  return getBenmingPathDefinition("fate", getRunBenmingPath(run))?.name || "未启用";
}

function getBenmingStagePassiveText(heroId, stage, pathId = null, legacy = false) {
  const gu = BENMING_GU[heroId];
  if (!gu) return "";
  if (heroId !== "fate" || (stage !== 3 && stage !== 5)) return gu.stagePassives[stage] || "";
  if (legacy) return stage === 3
    ? "命势圆满时，额外获得 1 点防御与 1 蛊石。"
    : "命势圆满的额外收益翻倍（+2 防御、+2 蛊石）。";
  const path = getBenmingPathDefinition(heroId, pathId);
  if (!path) return gu.stagePassives[stage] || "";
  return stage === 3 ? path.trueForm : path.guixu;
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
