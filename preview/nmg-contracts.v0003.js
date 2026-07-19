"use strict";
/* nmg-contracts.js: V0.9.40 QS-1a 命途契市——契约数据表、解锁核验与纯规则函数。
 * 设计稿 DESIGN-QS1-MINGTU-CONTRACTS.md；加载序：nmg-save/nmg-codex 之后、game.v 之前。
 * 状态归属铁律：局外持久=nmg.contracts（safeWriteJson 管线）；局内=runState.mingtuContract；
 * 不新增第三套状态。契只改规则+明码代价，永不做永久数值加法。 */

/* ===== 调参中枢：契的一切数值只许写在这里（AGENTS 六表精神） ===== */
const CONTRACT_BALANCE = Object.freeze({
  emptyPouchTrimCount: 4,      // 空囊契：起始蛊囊移除张数
  emptyPouchTrimPerCategory: 2, // 空囊契：每类（攻/防/辅）至多移除张数
  lonerEliteRelicCount: 1,     // 孤行契：每次击败凶煞额外直得的普通遗物枚数
});

/* ===== 契约池 v1：8 份（通用 2 实装；流派 4 与收藏 2 数据先立，QS-1b/c 翻 implemented 开启） =====
 * implemented=false 的契：不参与解锁核验、不可签、整备栏显示剪影+条件——
 * 避免"已解锁却签了没效果"的欺骗态。unlockCheck 为纯判定，ctx 见 evaluateContractUnlocks。 */
const CONTRACTS = Object.freeze({
  loner: {
    id: "loner", name: "孤行契", glyph: "孤", kind: "通用", heroId: null, implemented: true,
    summary: "每次击败凶煞（精英），额外直接获得一枚随机普通遗物。",
    cost: "本局蛊坊不开门——买牌、疗伤、删牌与寿元互易一并失去。",
    lore: "司命人收起算筹：「不入市集的人，命途只肯在血里给他称量。」",
    unlockHint: "首次完成一场有效结算（通关、身死或退隐）后自动获得。",
    unlockCheck: (ctx) => ctx.validRun,
  },
  emptyPouch: {
    id: "emptyPouch", name: "空囊契", glyph: "空", kind: "通用", heroId: null, implemented: true,
    summary: "司命人在每一层都必定现身，与你做那桩收代价的交易。",
    cost: "起始蛊囊被抽走四张基础蛊（攻、防、辅每类至多两张），容错更薄。",
    lore: "司命人翻检你的蛊囊：「囊轻的人走得快——也摔得重。我随行看账。」",
    unlockHint: "首次完成一场有效结算（通关、身死或退隐）后自动获得。",
    unlockCheck: (ctx) => ctx.validRun,
  },
  deepPoison: {
    id: "deepPoison", name: "深毒契", glyph: "毒", kind: "流派", heroId: "poison", implemented: false,
    summary: "每场战斗，敌人开局自带三层毒性。",
    cost: "本局「万毒归宗」的回合自动施毒停摆，毒要亲手下。",
    lore: "「毒在敌先，是恩赐也是债。」",
    unlockHint: "万蛊录毒道蛊牌收录满 6 种。",
    unlockCheck: (ctx) => ctx.codexFactionCount("毒道") >= 6,
  },
  turbidBlood: {
    id: "turbidBlood", name: "浊血契", glyph: "血", kind: "流派", heroId: "blood", implemented: false,
    summary: "每场战斗你的首次自损，额外获得两层血煞。",
    cost: "本局战后按出牌数回血减半，续航后移。",
    lore: "「血浊了才够浓。战后再谈养伤。」",
    unlockHint: "万蛊录血道蛊牌收录满 6 种。",
    unlockCheck: (ctx) => ctx.codexFactionCount("血道") >= 6,
  },
  foresight: {
    id: "foresight", name: "先知契", glyph: "知", kind: "流派", heroId: "fate", implemented: false,
    summary: "每场战斗第一回合，可看到敌人接下来两步的意图。",
    cost: "本局开局命势不再 +1（含衔命虫加成），启动更慢。",
    lore: "「多看一步，就少借一分势。账要平。」",
    unlockCheck: (ctx) => (ctx.stats?.fateTriggers || 0) >= 6,
    unlockHint: "任意一局内命势圆满满 6 次。",
  },
  shortCandle: {
    id: "shortCandle", name: "短烛契", glyph: "烛", kind: "流派", heroId: "longevity", implemented: false,
    summary: "每次焚寿后，本场战斗内下一张蛊牌费用减一（不叠加）。",
    cost: "本局寿元上限减三，烛短火急。",
    lore: "「烛剪短了，光就密。烧不烧，你说了算。」",
    unlockHint: "以朝暮完成一次有效结算。",
    unlockCheck: (ctx) => ctx.validRun && ctx.runState?.heroId === "longevity",
  },
  guSeeker: {
    id: "guSeeker", name: "识蛊契", glyph: "识", kind: "收藏", heroId: null, implemented: false,
    summary: "本局蛊坊与奖励三选一中，必至少出现一张万蛊录未收录的蛊。",
    cost: "选项被收藏目标占位，当下强度让路。",
    lore: "「认全百蛊的人，塔会另眼相看。」",
    unlockHint: "万蛊录蛊牌总收录满 30 种。",
    unlockCheck: (ctx) => ctx.codexTotalCount() >= 30,
  },
  defyFate: {
    id: "defyFate", name: "逆命契", glyph: "逆", kind: "收藏", heroId: null, implemented: false,
    summary: "每层的逆命搏杀节点必定开启，且奖励再多一个选项。",
    cost: "逆命节点战败直接终局，不再只是止步。",
    lore: "「把命押满的人，司命人也要起身相迎。」",
    unlockHint: "完成任意一次逆命搏杀胜利。",
    unlockCheck: (ctx) => Boolean(ctx.runState?.defyWon),
  },
});
const CONTRACT_IDS = Object.freeze(Object.keys(CONTRACTS));

/* ===== 局外持久：nmg.contracts（走 safeWriteJson 原子写；nmg. 前缀自动纳入存档导出白名单） ===== */
const CONTRACT_STORE_KEY = "nmg.contracts";
function loadContractStore() {
  const raw = loadJsonStore(CONTRACT_STORE_KEY);
  if (!raw.unlocked || typeof raw.unlocked !== "object" || Array.isArray(raw.unlocked)) raw.unlocked = {};
  if (!raw.chosenCount || typeof raw.chosenCount !== "object" || Array.isArray(raw.chosenCount)) raw.chosenCount = {};
  return raw;
}
function isContractUnlocked(id) { return Boolean(loadContractStore().unlocked[id]); }
function getUnlockedContractIds() {
  const store = loadContractStore();
  return CONTRACT_IDS.filter((id) => store.unlocked[id]);
}
function unlockContract(id) {
  if (!CONTRACTS[id]) return false;
  const store = loadContractStore();
  if (store.unlocked[id]) return false;
  store.unlocked[id] = Date.now();
  // 结算页只会提示本函数确认成功的递契；必须读取 safeWriteJson 的真实结果，禁止存储失败时假解锁。
  try { return safeWriteJson(CONTRACT_STORE_KEY, JSON.stringify(store)) === true; } catch (e) { return false; }
}
function markContractChosen(id) {
  if (!CONTRACTS[id]) return;
  const store = loadContractStore();
  store.chosenCount[id] = (store.chosenCount[id] || 0) + 1;
  saveJsonStore(CONTRACT_STORE_KEY, store);
}

function getContractDefinition(id) { return (id && CONTRACTS[id]) || null; }
/* 契是否在本局生效：runState 记的契必须仍存在且已实装（旧档记了未实装契一律视为无契，零迁移风险）。 */
function getActiveContract(run) {
  const def = getContractDefinition(run?.mingtuContract);
  return def && def.implemented ? def : null;
}

/* 结算页只读本局 runState.runStats，汇总已实际触发的契约效果；旧档缺字段时按 0 处理。 */
function getContractTriggerSummary(run) {
  const id = getActiveContract(run)?.id;
  const count = (key) => {
    const value = Number(run?.runStats?.[key]);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  };
  if (id === "loner") {
    return `蛊坊闭门 ${count("contractShopClosures")} 次；额外获得普通遗物 ${count("contractExtraOrdinaryRelics")} 枚。`;
  }
  if (id === "emptyPouch") {
    return `起始裁去 ${count("contractStarterCardsTrimmed")} 张基础蛊；契约强制促成司命人相逢 ${count("contractForcedSimingEncounters")} 次。`;
  }
  return "";
}

/* ===== 解锁核验：结算时统一跑一遍（finalizeRun 非 abandoned 后调用）。
 * 只核验 implemented 的契；返回本次新解锁的契定义数组（结算页据此渲染司命人递契通报）。 ===== */
function evaluateContractUnlocks(run, stats) {
  const ctx = {
    validRun: true, // 调用方已保证非 abandoned
    runState: run,
    stats: stats || null,
    codexFactionCount(faction) {
      try {
        const d = getDiscoveredGuKeys();
        return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && it.faction === faction && isGuUnlocked(it, d)).length;
      } catch (e) { return 0; }
    },
    codexTotalCount() {
      try {
        const d = getDiscoveredGuKeys();
        return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && isGuUnlocked(it, d)).length;
      } catch (e) { return 0; }
    },
  };
  const fresh = [];
  CONTRACT_IDS.forEach((id) => {
    const def = CONTRACTS[id];
    if (!def.implemented || isContractUnlocked(id)) return;
    let hit = false;
    try { hit = Boolean(def.unlockCheck(ctx)); } catch (e) { hit = false; }
    if (hit && unlockContract(id)) fresh.push(def);
  });
  return fresh;
}

/* ===== 通用契纯规则（game.js 战斗/建局侧只调这些入口，便于门禁 vm 断言） ===== */

/* 孤行契：蛊坊闭门判定。 */
function isContractShopClosed(run) { return getActiveContract(run)?.id === "loner"; }
/* 孤行契：凶煞（精英节点）胜利的额外普通遗物枚数。逆命搏杀（defy）按设计稿不在"凶煞"范围。 */
function getContractEliteRelicBonus(run) {
  return getActiveContract(run)?.id === "loner" ? CONTRACT_BALANCE.lonerEliteRelicCount : 0;
}
/* 空囊契：司命人层层必遇判定（roll 照常消耗、结果强制，保证契局与无契局事件序列同构）。 */
function isContractSimingGuaranteed(run) { return getActiveContract(run)?.id === "emptyPouch"; }

/* 空囊契：起始蛊囊裁剪——纯函数，输入牌 key 数组与分类器，返回应移除的下标数组。
 * 规则：按数组顺序扫描，攻/防/辅每类至多移除 emptyPouchTrimPerCategory 张，总数到 emptyPouchTrimCount 止。
 * 无 RNG（起始牌组顺序固定 → 结果确定），不动携带蛊（调用方只传基础牌段）。 */
function pickEmptyPouchTrimIndices(keys, categoryOf) {
  const perCap = CONTRACT_BALANCE.emptyPouchTrimPerCategory;
  const total = CONTRACT_BALANCE.emptyPouchTrimCount;
  const removedByCategory = { attack: 0, defense: 0, support: 0 };
  const indices = [];
  for (let i = 0; i < keys.length && indices.length < total; i += 1) {
    const raw = categoryOf(keys[i]);
    const cat = raw === "attack" || raw === "defense" ? raw : "support";
    if (removedByCategory[cat] >= perCap) continue;
    removedByCategory[cat] += 1;
    indices.push(i);
  }
  return indices;
}
