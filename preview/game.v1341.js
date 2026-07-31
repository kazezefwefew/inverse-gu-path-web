"use strict";

/*
 * 《逆命蛊途》V0.9.17「入塔旧因」
 * 结构说明：
 * 1. CARD_LIBRARY / ENEMY_LIBRARY / RELICS / REFINEMENTS 只保存数据；
 * 2. game 保存单场战斗状态，runState 保存完整命途试炼的继承数据；
 * 3. 结算函数不直接拼界面，统一由 render 系列函数刷新；
 * 4. 动画只是战斗反馈层，不参与数值，便于后续加入地图、事件和多场战斗。
 */

// V0.9.36 批次B-1：静态数据（CARD_LIBRARY … REFINEMENTS）已抽至 nmg-data.js，须在本文件之前加载。

const dom = {};
let game = null;
let runState = null;
let lastRuntimeDiagnostic = null;

/* ===== 蛊斗场 game 真相桥接 ===== */
function cloneOnlineBattleValue(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function startOnlineDuelBattle(snapshot) {
  const core = window.NmgOnlineBattleCore;
  if (!core?.validateState?.(snapshot)) return { ok: false, error: "战斗状态无效" };
  if (game && !game.isOnlineDuelBattle) return { ok: false, error: "当前单人战斗尚未结束" };
  const initial = cloneOnlineBattleValue(snapshot);
  game = { status: "online", isOnlineDuelBattle: true, inputLocked: false, online: initial };
  return { ok: true, state: cloneOnlineBattleValue(game.online) };
}

function createOnlineDuelBattle(options) {
  const core = window.NmgOnlineBattleCore;
  if (!core?.createBattle) return { ok: false, error: "联机战斗规则未就绪" };
  return startOnlineDuelBattle(core.createBattle(options || {}));
}

function applyOnlineDuelAction(actorId, action) {
  const core = window.NmgOnlineBattleCore;
  if (!game?.isOnlineDuelBattle || !core?.applyAction) return { ok: false, error: "联机战斗尚未开始" };
  const result = core.applyAction(game.online, actorId, action);
  if (!result.ok) return result;
  game.online = result.state;
  return { ok: true, state: cloneOnlineBattleValue(game.online) };
}

function acceptOnlineDuelSnapshot(snapshot) {
  const core = window.NmgOnlineBattleCore;
  if (!game?.isOnlineDuelBattle || !core?.acceptSnapshot) return startOnlineDuelBattle(snapshot);
  const result = core.acceptSnapshot(game.online, snapshot);
  if (!result.ok) return result;
  game.online = result.state;
  return { ok: true, state: cloneOnlineBattleValue(game.online) };
}

function forfeitOnlineDuelBattle(loserId, reason) {
  const core = window.NmgOnlineBattleCore;
  if (!game?.isOnlineDuelBattle || !core?.forfeit) return { ok: false, error: "联机战斗尚未开始" };
  const next = core.forfeit(game.online, String(loserId || ""), reason || "leave");
  if (!core.validateState(next) || Number(next.revision) <= Number(game.online.revision)) return { ok: false, error: "认负状态无效" };
  game.online = next;
  return { ok: true, state: cloneOnlineBattleValue(game.online) };
}

function getOnlineDuelBattle() {
  return game?.isOnlineDuelBattle ? cloneOnlineBattleValue(game.online) : null;
}

function endOnlineDuelBattle() {
  if (game?.isOnlineDuelBattle) game = null;
  return true;
}

window.NmgOnlineGameBridge = {
  create: createOnlineDuelBattle,
  start: startOnlineDuelBattle,
  applyAction: applyOnlineDuelAction,
  acceptSnapshot: acceptOnlineDuelSnapshot,
  forfeit: forfeitOnlineDuelBattle,
  getState: getOnlineDuelBattle,
  end: endOnlineDuelBattle,
};
/* ===== 蛊斗场桥接结束 ===== */

function recordRuntimeDiagnostic(error, source = "runtime") {
  const message = String(error?.message || error || "unknown error").slice(0, 240);
  lastRuntimeDiagnostic = { source, message, at: new Date().toISOString() };
}

function runOptionalBattleEffect(effect, source = "battle effect") {
  try {
    return effect?.();
  } catch (error) {
    recordRuntimeDiagnostic(error, source);
    return false;
  }
}

window.addEventListener("error", (event) => recordRuntimeDiagnostic(event?.error || event?.message, "window.error"));
window.addEventListener("unhandledrejection", (event) => recordRuntimeDiagnostic(event?.reason, "unhandledrejection"));
let pendingMupanTestConfig = null;
let pendingTowerMupanBattle = false; // E-2c4 塔心正式母盘战入场标志（与开发测试 config 分离；不接收任何强制参数）
let towerMupanFinaleTimer = null; // E-2c4 盘心断裂演出计时器
let cardSerial = 0;
let bannerTimer = null;
let castTimer = null;
let enemyTurnTimer = null;
let cardUnlockTimer = null;
let mupanResultTimer = null;
let mapNoticeTimer = null;
let mapTransitionTimer = null;
let mapFocusTimer = null;
let mapTransitionLock = false; // V0.9.12.1：转场 520ms 窗口内锁地图点击，防连点两个节点造成确认面板被顶掉/被拖进先点的战斗
const HAND_TRANSITION_MS = 220;
let handTransitionTimer = 0;
let battleLogs = [];
let journeyLogs = [];
let activeLogChannel = "battle";
let logsExpanded = { battle: false, journey: false };
const LOG_PREVIEW_COUNT = 6;
const MAX_BATTLE_LOGS = 100;
const EFFECT_STORAGE_KEY = "reverseGu.effects.enabled";
const TUTORIAL_STORAGE_KEY = "reverseGu.tutorial.seen";
// V0.9.36 B-6c：序章存储键已抽至 nmg-story.js，须在本文件之前加载。
const BATTLE_TIPS_STORAGE_KEY = "reverseGu.battleTips.seen";
// V0.9.36 B-6c：残卷存储键已抽至 nmg-story.js，须在本文件之前加载。
const TRIAL_MODE_STORAGE_KEY = "reverseGu.trial.mode";
const TRIAL_SEED_STORAGE_KEY = "reverseGu.trial.seedDraft";
const GAME_VERSION = "V0.9.66 蛊斗鸣锋";
window.GAME_VERSION = GAME_VERSION;
// V0.9.11 路线系统抽象：临门段与死亡分段仍保留在旧流程；Boss 身份由 nmg-chapter.js 声明。
const ROUTE_STAGE_CONFIG = Object.freeze({
  restStep: 8, // V0.9.51 段数 6→9：临门休整段由第 5 段移至第 8 段
  earlyEndStep: 2,
  midEndStep: 6, // V0.9.51：中段收手点随扩容后移
  layerDefaultName: "命途塔",
});
const OUTER_ROUTE_DEFINITION = getMingtuRouteById("act-outer-stairs", "outer");
const MAX_ROUTE_STEP = OUTER_ROUTE_DEFINITION.maxLegacyStep;
const REST_ROUTE_STEP = ROUTE_STAGE_CONFIG.restStep;
function getCurrentRunNode(state = runState) {
  if (isEndlessRun(state)) return getEndlessCurrentNode(state);
  return state ? getMingtuActiveRuntimeNode(state) : null;
}
function getCurrentRouteStep(state = runState) {
  if (isEndlessRun(state)) return getEndlessStep(state);
  return state ? getMingtuProgressStep(state) : 1;
}
function getCurrentActLayer(state = runState) {
  return state ? getMingtuProgressLayer(state) : 1;
}
function isLayer2Run(state = runState) {
  return Boolean(state && isMingtuAct(state, "act-debt-depths"));
}
function isLayer3Run(state = runState) {
  return Boolean(state && isMingtuAct(state, "act-mirror-wilds"));
}
function getCurrentRouteId(state = runState) {
  return state ? getMingtuProgressRouteLegacyId(state) : "outer";
}
function getCurrentRouteName(state = runState) {
  return state ? getMingtuProgressRouteName(state) : "命途塔";
}
function getRouteMaxStep(state = null) {
  if (isEndlessRun(state || runState)) return ENDLESS_FLOOR_STEPS;
  return (state ? getMingtuProgressRoute(state) : OUTER_ROUTE_DEFINITION)?.maxLegacyStep || MAX_ROUTE_STEP;
}
function getRestRouteStep() {
  return ROUTE_STAGE_CONFIG.restStep;
}
function clampRouteStep(step) {
  const n = Number(step) || 1;
  return Math.max(1, Math.min(getRouteMaxStep(), n));
}
function getNextRouteStep(step) {
  return clampRouteStep((Number(step) || 1) + 1);
}
function isRouteBossSegment(step, state = runState) {
  return isMingtuBossSegment(state || {}, step);
}
function isRestRouteStep(step) {
  return Number(step) === getRestRouteStep();
}
function getRouteSteps() {
  return Array.from({ length: getRouteMaxStep() }, (_, index) => index + 1);
}
function isBossRouteNode(node, state = runState) {
  return isMingtuBossNode(state || {}, node);
}
function isCurrentBossRoute() {
  if (!runState) return false;
  const node = getCurrentRunNode();
  return node
    ? isBossRouteNode(node, runState)
    : isRouteBossSegment(getCurrentRouteStep(), runState);
}
function getRouteStageTitle(step, { layerName = "", layerActive = false } = {}) {
  if (layerActive) {
    if (isRouteBossSegment(step)) return `末段 · ${layerName || "深径"}之主`;
    if (isRestRouteStep(step)) return `第 ${step} 段 · 临门`;
    return `第 ${step} 段 · ${layerName || "深径"}`;
  }
  if (isRestRouteStep(step)) return `第 ${step} 段 · 临门分岔`;
  if (isRouteBossSegment(step)) return `第 ${step} 段 · 尸盘门`;
  return `第 ${step} 段`;
}
function getRoutePhaseBand(step) {
  const n = Number(step) || 0;
  if (n <= 0) return "unknown";
  if (n <= ROUTE_STAGE_CONFIG.earlyEndStep) return "early";
  if (n <= ROUTE_STAGE_CONFIG.midEndStep) return "middle";
  return "late";
}
function validateRouteMapState(mapState, context = "route", actId = "act-outer-stairs", routeId = "outer") {
  const issues = [];
  if (!mapState || !Array.isArray(mapState.segments)) {
    console.warn(`[RouteCheck] ${context}: mapState.segments 缺失。`);
    return mapState;
  }
  if (mapState.segments.length !== getRouteMaxStep()) {
    issues.push(`段数 ${mapState.segments.length} ≠ ${getRouteMaxStep()}`);
  }
  mapState.segments.forEach((segment, index) => {
    const expectedStep = index + 1;
    if (!Array.isArray(segment) || !segment.length) {
      issues.push(`第 ${expectedStep} 段为空`);
      return;
    }
    segment.forEach((node) => {
      if (!node || Number(node.step) !== expectedStep) {
        issues.push(`节点 ${node?.id || "未知"} step=${node?.step || "-"}，应为 ${expectedStep}`);
      }
    });
  });
  const bossDefinition = getMingtuBossDefinition(actId, routeId);
  const bossSegment = mapState.segments.find((segment) => segment.some((node) => bossDefinition
    && (bossDefinition.legacyNodeIds.includes(node?.id) || node?.enemyId === bossDefinition.enemyId))) || [];
  if (!bossDefinition || !bossSegment.some((node) => node?.enemyId === bossDefinition.enemyId)) {
    issues.push(`${routeId} 缺少数据声明的 Boss 节点`);
  }
  const restSegment = mapState.segments[getRestRouteStep() - 1] || [];
  if (!restSegment.length) {
    issues.push(`第 ${getRestRouteStep()} 段临门段为空`);
  }
  if (issues.length) {
    console.warn(`[RouteCheck] ${context}: ${issues.join("；")}`);
  }
  return mapState;
}
const TRIAL_MODES = Object.freeze({
  normal: { id: "normal", name: "正常模式", brief: "随机路线、奖励与机缘。", note: "适合正常试玩。" },
  balance: { id: "balance", name: "平衡测试模式", brief: "显示测试入口，可填种子复现路线。", note: "适合复制统计。" },
});
const MAX_EFFECT_NODES = 56;
const MAX_FLOAT_NODES = 36;
const animationClassTimers = new WeakMap();
let effectsEnabled = true;
let mupanVfxTimer = null;
let tutorialPageIndex = 0;
let tutorialAutoPrompted = false;
// V0.9.36 B-6c：序章弹窗状态已抽至 nmg-story.js，须在本文件之前加载。
let pendingEliteNodeId = "";
let pendingShopRemoveCardId = "";
let trialMode = "normal";
let trialSeedDraft = "";
// ===== V0.9.8.3 精英模式：通关后解锁的强化挑战（敌人数值/奖励更高），与试炼 trialMode 正交 =====
const ELITE_UNLOCK_KEY = "nmg.elite.unlocked";
const DEATHTRIAL_UNLOCK_KEY = "nmg.deathtrial.unlocked"; // V0.9.9 子批6：精英通关后解锁死劫
const DEATHTRIAL_CLEARED_KEY = "nmg.deathtrial.cleared"; // V0.9.9 子批6：死劫通关「金印」（持久成就）
const XIANGHUO_HIDE_PROMPT_KEY = "nmg.xianghuo.hidePrompt"; // V0.9.29 香火供奉：结算页轻提示「不再提示」

// ===== V0.9.36 平台隔离：香火供奉（外部微信收款码）仅网页版可见。 =====
// 铁律：微信/抖音小游戏严禁「外部收款码/二维码收款」。本 flag 只做【运行时】门控（渲染处不出入口 + openXianghuo 兜底 return + 根类 CSS 兜底）。
// ⚠【发行小游戏包时还必须在构建期物理剥离】：删 index.html 的 #xianghuoOverlay 整段与设置香火按钮、不打包 qr_wechat*.png——
// 仅翻 flag 不删字节，审核方仍能在包内查到收款码。平台由 index.html 顶部 window.NMG_PLATFORM 指定（web=网页版）。
const NMG_PLATFORM = (typeof window !== "undefined" && window.NMG_PLATFORM) || "web";
const NMG_XIANGHUO_ENABLED = NMG_PLATFORM === "web";

// ===== V0.9.36 合规·年龄门槛：首次进入弹一次「适龄提示 + 年龄确认」，确认后记住不再弹。纯 UI，不碰 runState/game。=====
const AGE_GATE_KEY = "nmg.ageGate.ack";
const SUGGESTED_AGE = 16; // 建议适龄（暗黑东方奇幻题材，含战斗/毒/死亡/赌命等暗黑描写）；单一来源，调这一处即可
let ageGateAcknowledged = false; // V0.9.36 会话内存守卫：坏/不可写 localStorage（隐私模式/WebView禁存/配额满）下也不重弹，否则确认后 flag 没落盘会被无限弹回、玩家永远进不去（与序章 prologueAutoPrompted 同理）

/* ===== V0.9.14 蛊修印录：英雄×模式通关印记 + 本局称号收藏（localStorage 持久，自本版本起收录） ===== */
const HERO_SEALS_KEY = "nmg.heroSeals"; // { heroId: { normal: n, elite: n, deathtrial: n } }
const TITLE_COLLECTION_KEY = "nmg.titleCollection"; // { titleId: 获得次数 }
// V0.9.36 批次B-2：存档基础设施（loadJsonStore … applySaveImport）已抽至 nmg-save.js，须在本文件之前加载。

function markHeroSeal(heroId, mode) {
  if (!heroId || !mode) return;
  const o = loadJsonStore(HERO_SEALS_KEY);
  o[heroId] = o[heroId] || {};
  o[heroId][mode] = (o[heroId][mode] | 0) + 1;
  saveJsonStore(HERO_SEALS_KEY, o);
}
function getHeroSeals(heroId) { return loadJsonStore(HERO_SEALS_KEY)[heroId] || {}; }
function getHeroBestSealMode(heroId) {
  const s = getHeroSeals(heroId);
  return s.deathtrial ? "deathtrial" : (s.elite ? "elite" : (s.normal ? "normal" : ""));
}
/* 印阶命名对齐既有设定：死劫通关=「金印」（V0.9.9 起模式页/称号文案均如此），故三阶为 铜印/银印/金印。 */
const SEAL_MODE_META = Object.freeze({
  normal: { label: "铜印", full: "铜印 · 普通通关", cls: "seal-normal" },
  elite: { label: "银印", full: "银印 · 精英通关", cls: "seal-elite" },
  deathtrial: { label: "金印", full: "金印 · 死劫通关", cls: "seal-deathtrial" },
});
function markTitleCollected(titleId) {
  if (!titleId) return false;
  const o = loadJsonStore(TITLE_COLLECTION_KEY);
  const isNew = !o[titleId];
  o[titleId] = (o[titleId] | 0) + 1;
  saveJsonStore(TITLE_COLLECTION_KEY, o);
  return isNew;
}

/* 称号总表：generateRunTitle 按 id 取词条（文案单一事实源），万蛊录「蛊修印录」页按此展示收藏进度。 */
const TITLE_CATALOG = Object.freeze([
  { id: "deathtrialClear", title: "死劫 · 焚命渡劫者", sub: "九死无生处，你以一身焚烬踏碎死劫——金印加身。", hint: "以死劫模式通关" },
  { id: "layer3Clear", title: "三层踏尽", sub: "骨塔与蜂窟皆已踏尽，绝域之主尽数伏于你的蛊息之下。", hint: "击破第三层之主" },
  { id: "boneBossFall", title: "骨巢破封者", sub: "骨巢之巅，你与守墓王同葬于这片万骨高陵。", hint: "败于骨巢守墓王" },
  { id: "queenFall", title: "蜂后伏诛者", sub: "魔巢深处，万翅同振，你倒在蜂后的毒潮之中。", hint: "败于灾厄蜂后" },
  { id: "boneRouteFall", title: "骨塔折铃", sub: "森白骨铃乱响，你的命途断折在这座万骨高陵之上。", hint: "陨落于骨塔高陵" },
  { id: "beehiveRouteFall", title: "蜂窟坠命", sub: "毒翅蔽空，你坠入蜂窟魔巢，命数为万蜂所噬。", hint: "陨落于蜂窟魔巢" },
  { id: "layer2Clear", title: "逆命行者", sub: "深泽尽头，你以一身蛊息逆改了既定的命数。", hint: "击破第二层之主" },
  { id: "miasmaBossFall", title: "百瘴留名", sub: "瘴林深处，你的名字与百瘴一同被刻入残卷。", hint: "败于百瘴母蛊" },
  { id: "bloodBossFall", title: "血衣未冷", sub: "血沼之主未及收衣，你已倒在它的影下。", hint: "败于血衣蛊母" },
  { id: "layer1Clear", title: "尸盘破局者", sub: "你踏碎尸盘，却未再向深处迈出一步。", hint: "破一层 Boss 后就此收功" },
  { id: "miasmaFall", title: "瘴林折戟", sub: "瘴雾蚀骨，你的兵刃折断在这片墨绿之中。", hint: "陨落于瘴林深径" },
  { id: "bloodmarshFall", title: "血沼沉骨", sub: "血泥吞没了你的躯壳，连蛊息也归于沉寂。", hint: "陨落于血沼沉渊" },
  { id: "layer2Unfinished", title: "逆命未成", sub: "命途已近尽头，你却未能跨过最后一道关。", hint: "止步于第二层深处" },
  { id: "layer2Explore", title: "深泽初探", sub: "你已踏入第二层的生态深径，却止步于半途。", hint: "初入第二层而未竟" },
  { id: "poisonStyle", title: "毒蛊成势", sub: "毒雾缠经，敌命自内而溃，此局毒势已成。", hint: "以毒道成势的一局" },
  { id: "bloodStyle", title: "血灯将熄", sub: "以血换刃，灯火将熄而锋芒未钝。", hint: "以血道成势的一局" },
  { id: "armorStyle", title: "铁壳负命", sub: "壳厚如山，你以坚守背负这条逆命之途。", hint: "以护甲成势的一局" },
  { id: "earlyFall", title: "初入蛊途", sub: "刚踏入命途塔，你便折损于浅滩。", hint: "折损于命途前段" },
  { id: "midFall", title: "蛊道未稳", sub: "蛊道未稳，行至中途便难以为继。", hint: "折损于命途中段" },
  { id: "lateFall", title: "命途多舛", sub: "你已走得很远，命途却仍多舛难测。", hint: "折损于命途后段" },
  { id: "wanderer", title: "断途行者", sub: "残卷未尽，蛊路可再行。", hint: "命途中折的兜底之名" },
]);
const TITLE_CATALOG_MAP = TITLE_CATALOG.reduce((m, t) => { m[t.id] = t; return m; }, {});
let selectedMode = "normal"; // "normal" | "elite" | "tian" | "endless（V0.9.55 起 deathtrial 仅存于老档，不可再选"，开局写入 runState.mode
// V0.9.36 C-0：模式倍率数字集中到 ENEMY_BALANCE；本地别再重复写表。
const MODE_TUNING = ENEMY_BALANCE.modeTuning;
function getModeTuning() {
  const mode = (runState && runState.mode) || "normal";
  if (mode === "tian") return getTianTuning(runState?.tianTier || 1); // V0.9.19 十重天：按重数计算
  if (mode === "endless") return getEndlessTuning(runState?.endlessFloor || 1); // V0.9.51 无尽：按层数计算
  return MODE_TUNING[mode] || MODE_TUNING.normal;
}
// V0.9.9 子批6：模式中文名，供结算/反馈文案统一显示，避免「死劫被显示成普通」。V0.9.19 加十重天（带重数）。
function getRunModeLabel(mode) {
  if (mode === "tian") return `十重天·第${runState?.tianTier || 1}重`;
  if (mode === "endless") return `无尽·第${runState?.endlessFloor || 1}层`;
  return mode === "deathtrial" ? "死劫" : mode === "elite" ? "精英" : "普通";
}
// V0.9.36 B-6b：十重天模式解析、天梯进度、重数修饰与蚀寿辅助已抽至 nmg-tian.js。
// V0.9.36 B-6a：本命蛊数据、道行、形态、被动与立绘辅助已抽至 nmg-benming.js。

// V0.9.36 批次B-4：蛊庐、归庐日课与香火弹窗已抽至 nmg-gulu.js，须在本文件之前加载。

// V0.9.36 B-6b：十重天调参辅助已抽至 nmg-tian.js。

const KEYWORD_HELP = Object.freeze({
  真元: "催动蛊牌的资源；每回合开始恢复。",
  防御: "先抵挡伤害；敌方行动结束后清零。",
  寿元: "长期代价；部分强力蛊会消耗。",
  血煞: "血道爆发资源；会强化血道攻击。",
  铺垫: "先打出一张非血道牌，为本回合下一张血道牌准备缝煞。",
  代偿: "主动消耗 3 层血煞，减少当前血道攻击牌造成的自损；不会自动触发。",
  追毒: "每回合先完整打出一张攻击牌，再用之后的一张牌施毒：这次施毒在毒抗结算后额外 +2 层。先打施毒牌会错过本回合机会。",
  借毒: "敌人准备攻击时，每回合一次主动移除敌人 4 层毒，立即获得 6 点护甲；移除的毒会降低回合末毒伤。",
  毒性: "敌方回合结束时造成毒伤。",
  蚀毒: "敌人已中毒时再次施毒，追加伤害。",
  命势: "交替使用不同类型卡积累；满层回真元并抽牌。",
  命途契: "司命人的暗契：签下后本局改写一条规则，并标明一份代价。首次有效结算后解锁，整备页可签，也可以不签。",
  炼化: "蛊牌强化为 +1 或 +2。",
  异变: "炼蛊中蛊性变化，变成新蛊。",
  反噬: "炼蛊失控产生代价。",
  蛊庐藏册: "记录你亲手孵化、随行与投喂过的蛊虫；来历和战斗效果仍在万蛊录查看。",
  易伤: "每次受到敌方攻击伤害时，该次伤害提升 50%（向上取整）并消耗 1 层。",
  破防: "护甲被一次攻击彻底打穿（原本有甲、扣后归零）时，被破防方叠 1 层易伤（下次受击 ×1.5）。留甲卡线苟活者，一旦让甲破就易被雪崩收割。",
  毒刺: "每回合开始固定受到等同层数的伤害，不衰减；需击败施加者解除。",
  乱铃: "乱铃缠耳，下一回合补牌数减少；保底至少抽 1 张。",
  骨鸣: "闻铃的战斗资源，上限 6。每回合首次以蛊牌得甲、首次被敌人击碎防御、首次主动碎去至少 4 点防御时各得 1 点；同一张牌的结算不会重复计数。",
  碎甲: "主动碎去自身现有防御。实际碎去量不会超过卡牌上限或当前防御；闻铃每回合首次主动碎去至少 4 点防御时会获得 1 点骨鸣。",
  叩铃: "骨鸣达到 3 点后每回合可发动一次。镇魂把骨鸣化为防御，断命碎去自身防御并造成无视护甲的直接伤害；发动后消耗骨鸣。",
  /* V0.9.13 关键词直查：补齐此前无处可查的自造术语 */
  酒意: "下一张攻击蛊按层数获得 ×2／×2.5／×3 伤害倍率，最多 3 层；攻击结算后清空。",
  酒虫: "使用后获得 1 层酒意；酒意倍率依次为 ×2／×2.5／×3，攻击结算后清空。",
  回光: "回光返照：本回合所有攻击蛊的伤害翻倍（不限流派；不加成非伤害效果）。",
  焚寿: "以寿元为薪：朝暮寿元越低伤害越高（过半 +3／残寿 +6／垂暮 +10），本场累计焚寿还会强化焚寿蛊。",
  衰老: "使敌人的攻击伤害永久平减，可叠加；对蓄势重击同样有效。",
  暴击: "攻击有概率暴击：最终伤害 ×1.6（在护甲抵挡之前结算）。",
  骨甲: "骨塔敌人每回合回复固定几点骨甲（有上限，并非回满），持续强攻破甲或用毒绕甲皆可压制；骨甲蛊卫带甲时攻击更重。",
  血道: "以血煞为资源的流派：攻击引用血煞加伤，战后按出牌数回血。",
  毒道: "以毒性为核心的流派：叠毒、蚀毒与拖回合消耗。",
  寿道: "以寿元为燃料的流派：焚寿驱动蛊术，寿元越低越凶。",
});

// V0.9.59 新手说明只讲一轮可完成的核心闭环；角色细节在选择卡，系统细节在首次触达时再讲。
const TUTORIAL_PAGES = Object.freeze([
  {
    title: "先走一圈",
    lines: [
      "① 选一名蛊修；选择卡只讲他的核心打法。",
      "② 进入教学战，学会看敌人意图、出牌和结束回合。",
      "③ 战后去蛊圃下第一枚蛊卵，认识材料、孵化与成蛊。",
      "④ 回首页，核心循环就完成了；其他系统会在第一次进入时再说明。",
    ],
  },
  {
    title: "战斗只记三件事",
    lines: [
      "先看敌人意图：挡得住就叠防御，能击杀就抢输出。",
      "点手牌出牌会消耗真元；真元不够就结束回合。",
      "防御挡伤，但敌人行动后会清零。角色独有资源会在实战中就地提示。",
    ],
  },
  {
    title: "遇到问题再查",
    lines: ["不必第一遍记住所有系统。点下面的问题，只看眼前需要的一件事。"],
    topics: true,
  },
]);
const GUIDE_TOPICS = Object.freeze({
  battle: Object.freeze({ title: "战斗怎么打", lines: ["先看敌人意图，再决定防御或抢杀。", "点牌查看完整效果；真元不足就结束回合。"] }),
  hatch: Object.freeze({ title: "蛊卵会出什么", lines: ["基础卵出常用通用蛊；道脉卵出进阶蛊与当前流派专属蛊。", "蛊圃里的“查看两类虫池”会列出当前真实名单。"] }),
  forge: Object.freeze({ title: "升转与重结", lines: ["九转鼎只做同名同转升转；高转重结仍应保持原蛊与原转数。", "详情只在对应成长出现后展示封顶与替代成长。"] }),
  fusion: Object.freeze({ title: "异蛊怎么合", lines: ["合蛊坛使用两只同转、不同种蛊归一。", "先在合练谱看配方，再回坛中选择两只原蛊。"] }),
  build: Object.freeze({ title: "牌组怎么养", lines: ["低转先保证真元与手牌不同时亏空，再围绕流派核心补强。", "高转才逐步开放长循环，不必第一局追满。"] }),
  codex: Object.freeze({ title: "奖励在哪里领", lines: ["首页万蛊录出现“待领取”时，点进去会直达图鉴任务。", "任务页签上的数字就是可领取数量。"] }),
});

// V0.9.36 B-6c：命蛊残卷数据与状态已抽至 nmg-story.js，须在本文件之前加载。

function getBloodMax() {
  const benmingBonus = (benmingPassive("blood", 2) ? 2 : 0) + (benmingPassive("blood", 4) ? 2 : 0); // V0.9.20 赤茧蛊·成虫血煞上限+2；V0.9.33 神化再+2
  const base = BLOOD_MAX + Math.max(0, Number(runState?.bloodMaxBonus) || 0) + benmingBonus;
  return hasOrdinaryRelic("bloodAbyss") ? base * 2 : base; // V0.9.9.2 血溟囊：血煞上限翻倍
}

function safeStatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function createRunStats() {
  return {
    benmingPath: "",
    battleCount: 0,
    totalTurns: 0,
    battleTurns: [],
    battleSummaries: [],
    playerDamage: 0,
    enemyDamage: 0,
    armorGained: 0,
    healing: 0,
    selfHpLost: 0,
    lifespanSpent: 0,
    poisonDamage: 0,
    bloodBonusDamage: 0,
    fateTriggers: 0,
    fateTriads: 0,
    fateRewrites: 0,
    fateRewriteKept: 0,
    fateRewriteWaitTurns: 0,
    bloodStitchTriggers: 0,
    bloodStitchHpSaved: 0,
    bloodAtonementUses: 0,
    bloodAtonementSpent: 0,
    bloodAtonementHpSaved: 0,
    poisonAfterstrikeTriggers: 0,
    poisonAfterstrikeAdded: 0,
    poisonBorrowedScaleUses: 0,
    poisonBorrowedScalePoisonSpent: 0,
    poisonBorrowedScaleArmorGained: 0,
    poisonBorrowedScaleReturns: 0,
    dragonScalesGained: 0,
    dragonTransforms: 0,
    dragonTransformTurns: 0,
    wineWormTriggers: 0,
    bossPoisonSuppressions: 0,
    bossPoisonSuppressedLayers: 0,
    bossHighestPoison: 0,
    bossPhase2Triggered: false,
    heroEvents: 0,
    lastHeroEvent: "",
    layer2Entered: false,
    layer2Route: "",
    layer2BossDefeated: false,
    layer3Entered: false,
    layer3Route: "",
    layer3BossDefeated: false,
    stableRefines: 0,
    mutations: 0,
    backlashes: 0,
    cardsPlayed: 0,
    cardStats: {},
    bossTurns: 0,
    clearHp: 0,
    deathNode: "",
    deathEnemy: "",
    contractShopClosures: 0,
    contractExtraOrdinaryRelics: 0,
    contractStarterCardsTrimmed: 0,
    contractForcedSimingEncounters: 0,
    // V0.9.51 六契触发统计（结算摘要 getContractTriggerSummary 逐契读取）
    contractDeepPoisonBattles: 0,
    contractAutoPoisonSkipped: 0,
    contractTurbidBloodTriggers: 0,
    contractHealHalvedAmount: 0,
    contractForesightBattles: 0,
    contractMomentumForfeited: 0,
    contractCandleDiscounts: 0,
    contractGuSeekerOffers: 0,
    contractDefyBonusStones: 0,
    contractDefyExtraRewards: 0,
    boneResonanceGained: 0,
    boneArmorSacrificed: 0,
    boneChimeUses: 0,
    boneSoulUses: 0,
    boneFateUses: 0,
    ecologyCounterTriggers: 0,
    ecologyCounterDamage: 0,
    ecologyCounterArmorRemoved: 0,
  };
}

function ensureRunStats(stats) {
  const defaults = createRunStats();
  const target = stats
    && Object.prototype.toString.call(stats) === "[object Object]"
    ? stats
    : {};
  Object.entries(defaults).forEach(([key, fallback]) => {
    const value = target[key];
    if (typeof fallback === "number") {
      const numeric = Number(value);
      target[key] = Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
    } else if (typeof fallback === "boolean") {
      target[key] = typeof value === "boolean" ? value : fallback;
    } else if (typeof fallback === "string") {
      target[key] = typeof value === "string" ? value : fallback;
    } else if (Array.isArray(fallback)) {
      if (!Array.isArray(value)) target[key] = fallback.slice();
    } else {
      const isPlainRecord = value
        && Object.prototype.toString.call(value) === "[object Object]";
      if (!isPlainRecord) target[key] = { ...fallback };
    }
  });
  return target;
}

function createBattleStats(enemyDefinition, node) {
  return {
    enemyName: enemyDefinition?.name || "未知敌人",
    nodeType: node?.type || "battle",
    nodeName: node?.name || "",
    turns: 0,
    playerHp: 0,
    playerDamage: 0,
    enemyDamage: 0,
    armorGained: 0,
    healing: 0,
    poisonDamage: 0,
    cardsPlayed: 0,
    victory: false,
  };
}

function getRunStats() {
  runState.runStats = ensureMupanRunStats(ensureRunStats(runState.runStats));
  if (typeof getBenmingPathDisplayName === "function") {
    runState.runStats.benmingPath = getBenmingPathDisplayName(runState);
  }
  return runState.runStats;
}

function getCardStatKey(card) {
  const level = getUpgradeLevel(card);
  const status = [
    card.mutated ? "m" : "",
    card.damaged ? "d" : "",
    card.skewed ? "s" : "",
  ].filter(Boolean).join("");
  return `${card.instanceId || card.deckInstanceId || card.key}|${card.key}|${level}|${status}`;
}

function getCardStatLabel(card) {
  const status = getEntryStatusLabels(card);
  const suffix = status.length ? `【${status.join("·")}】` : "";
  const seal = getGuSeal(card);
  return `${getDisplayCardName(card.key, getUpgradeLevel(card))}${suffix}${seal ? ` · 蛊印${seal}` : ""}`;
}

function ensureCardStat(card, key = getCardStatKey(card)) {
  const stats = getRunStats();
  if (!stats.cardStats[key]) {
    stats.cardStats[key] = {
      key,
      name: getCardStatLabel(card),
      cardKey: card.key,
      upgradeLevel: getUpgradeLevel(card),
      mutated: Boolean(card.mutated),
      uses: 0,
      damage: 0,
      armor: 0,
      healing: 0,
      poisonApplied: 0,
      bloodBonusDamage: 0,
      fateGain: 0,
    };
  }
  return stats.cardStats[key];
}

function recordBattleStarted() {
  if (!runState || !game?.battleStats) return;
  const stats = getRunStats();
  stats.battleCount += 1;
  if (game.player.armor > 0) {
    recordArmorGained(game.player.armor);
  }
}

function recordCardPlayed(card) {
  const stats = getRunStats();
  const key = getCardStatKey(card);
  const cardStats = ensureCardStat(card, key);
  cardStats.uses += 1;
  stats.cardsPlayed += 1;
  if (game?.battleStats) game.battleStats.cardsPlayed += 1;
  return key;
}

function isActiveCardSource(sourceName) {
  if (!game?.activeCardContext) return false;
  return sourceName === game.activeCardContext.cardName || sourceName === game.activeCardContext.baseName;
}

function recordCardMetric(metric, amount, sourceName = "") {
  const value = safeStatNumber(amount);
  if (value <= 0 || !game?.activeCardContext) return;
  if (sourceName && !isActiveCardSource(sourceName)) return;
  const cardStats = ensureCardStat(game.activeCardContext.cardSnapshot, game.activeCardContext.cardStatsKey);
  cardStats[metric] = safeStatNumber(cardStats[metric]) + value;
}

function recordPlayerDamage(amount, { card = false, poison = false } = {}) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.playerDamage += value;
  if (game?.battleStats) game.battleStats.playerDamage += value;
  if (card) recordCardMetric("damage", value);
  if (!poison && isMupanBattle() && game.mupanTurnMetrics) {
    game.mupanTurnMetrics.nonPoisonDamage += value;
  }
}

function recordEnemyDamage(amount) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.enemyDamage += value;
  if (game?.battleStats) game.battleStats.enemyDamage += value;
}

function recordArmorGained(amount, sourceName = "") {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.armorGained += value;
  if (game?.battleStats) game.battleStats.armorGained += value;
  if (sourceName) recordCardMetric("armor", value, sourceName);
}

function recordHealing(amount, sourceName = "") {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.healing += value;
  if (game?.battleStats) game.battleStats.healing += value;
  if (sourceName) recordCardMetric("healing", value, sourceName);
}

function recordPoisonDamage(amount, { card = false } = {}) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.poisonDamage += value;
  if (game?.battleStats) game.battleStats.poisonDamage += value;
  recordPlayerDamage(value, { card, poison: true });
}

function recordBloodBonusDamage(amount) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.bloodBonusDamage += value;
  recordCardMetric("bloodBonusDamage", value);
}

function recordFateGain(amount) {
  recordCardMetric("fateGain", amount);
}

/* 激励续命发生在 recordBattleFinished(false) 之后：先留一份仅含本次收口副作用的回滚点，
 * 完整观看且仍是同一死亡现场时恢复它；牌堆、敌人和整场 battleStats 均不重建。 */
function captureProvisionalBattleLossStats(stats) {
  return {
    totalTurns: safeStatNumber(stats?.totalTurns),
    battleTurnsLength: Array.isArray(stats?.battleTurns) ? stats.battleTurns.length : 0,
    battleSummariesLength: Array.isArray(stats?.battleSummaries) ? stats.battleSummaries.length : 0,
    deathNode: stats?.deathNode,
    deathEnemy: stats?.deathEnemy,
    bossTurns: stats?.bossTurns,
  };
}

function rollbackProvisionalBattleLossStats(stats, snapshot) {
  if (!stats || !snapshot) return false;
  stats.totalTurns = snapshot.totalTurns;
  if (Array.isArray(stats.battleTurns)) stats.battleTurns.length = snapshot.battleTurnsLength;
  if (Array.isArray(stats.battleSummaries)) stats.battleSummaries.length = snapshot.battleSummariesLength;
  stats.deathNode = snapshot.deathNode;
  stats.deathEnemy = snapshot.deathEnemy;
  stats.bossTurns = snapshot.bossTurns;
  return true;
}

function extractBloodBonusFromDetail(detail, realDamage) {
  const match = String(detail || "").match(/(\d+)\s*层血煞(?:×(\d+))?/);
  if (!match) return 0;
  const layers = Number(match[1]) || 0;
  const multiplier = Number(match[2]) || 1;
  return Math.min(Math.max(0, layers * multiplier), Math.max(0, realDamage));
}

function recordBattleFinished(victory, { recordDefeatCause = true } = {}) {
  if (!runState || !game?.battleStats) return;
  const stats = getRunStats();
  const provisionalLossStats = victory ? null : captureProvisionalBattleLossStats(stats);
  const summary = {
    enemyName: game.enemy.definition.name,
    nodeType: getCurrentRunNode()?.type || game.battleStats.nodeType || "battle",
    nodeName: getCurrentRunNode()?.name || game.battleStats.nodeName || "",
    turns: game.turn,
    playerHp: game.player.hp,
    playerDamage: game.battleStats.playerDamage,
    enemyDamage: game.battleStats.enemyDamage,
    armorGained: game.battleStats.armorGained,
    healing: game.battleStats.healing,
    poisonDamage: game.battleStats.poisonDamage,
    cardsPlayed: game.battleStats.cardsPlayed,
    victory: Boolean(victory),
  };
  stats.totalTurns += game.turn;
  stats.battleTurns.push(game.turn);
  stats.battleSummaries.push(summary);
  if (getCurrentRunNode()?.type === "boss" || game.enemy.definition.isBoss) {
    stats.bossTurns = game.turn;
  }
  if (victory && (getCurrentRunNode()?.type === "boss" || game.enemy.definition.isBoss)) {
    stats.clearHp = game.player.hp;
  }
  if (!victory && recordDefeatCause) {
    stats.deathNode = getCurrentRunNode()?.name || `第 ${getCurrentRouteStep()} 段`;
    stats.deathEnemy = game.enemy.definition.name;
  }
  game.rewardedReviveStatsRollback = provisionalLossStats;
}

// progression 仅保存标题界面的选择；整局命途状态统一由 runState 管理。
const progression = {
  selectedHeroId: "fate",
  selectedRelicId: "jadeMarrow",
  selectedStarterGuKeys: [...STARTER_GU_DEFAULT_KEYS],
  selectedBenmingPath: null,
  selectedContract: null, // V0.9.40 QS-1a 命途契：整备暂存，与 selectedBenmingPath 同生命周期（建局写入 runState 后即失效）

  eliteUnlocked: getStoredFlag(ELITE_UNLOCK_KEY), // V0.9.8.3：首次通关后置 true 并落盘
  deathtrialUnlocked: getStoredFlag(DEATHTRIAL_UNLOCK_KEY), // V0.9.9 子批6：精英通关后解锁死劫
  deathtrialCleared: getStoredFlag(DEATHTRIAL_CLEARED_KEY), // V0.9.9 子批6：死劫金印（持久成就）
  xianghuoHidePrompt: getStoredFlag(XIANGHUO_HIDE_PROMPT_KEY), // V0.9.29 香火供奉：玩家已选「不再提示」结算轻提示
};

const HERO_DIFFICULTY_LABELS = Object.freeze({
  fate: "上手·平稳",
  blood: "上手·冒险",
  poison: "上手·进阶",
  longevity: "上手·严苛",
  dragon: "上手·进阶",
  bone: "上手·进阶",
});
const HERO_CORE_SUMMARIES = Object.freeze({
  fate: "异类出牌积命势，圆满后回真元并抽牌。",
  blood: "以生命换血煞，爆发后靠血道出牌回血。",
  poison: "持续叠毒并触发蚀毒，越拖越强。",
  longevity: "燃烧寿元换取伤害，寿元越低攻势越强。",
  dragon: "攻守各养一鳞，龙鳞蓄满后主动化龙爆发。",
  // 选择卡合读即为「闻铃：得甲、破甲与主动碎甲积骨鸣」；卡头已有姓名，摘要不重复写。
  bone: "得甲、破甲与主动碎甲积骨鸣，叩铃在护身与直伤间抉择。",
});
let activePrepStep = "hero";
let activeStartView = "home";
let intentCollapsed = false;
let selectedMapNodeId = "";
let deckActiveTab = "cards";
let deckCardPage = 0;
let selectedDeckCardId = "";
let deckReorderGesture = null;
let suppressDeckEntryClickUntil = 0;
const DECK_PAGE_SIZE = 6;

function cacheDom() {
  [
    "startScreen", "homeHubView", "prepScreenView", "newRunButton", "prepBackButton", "moreMenuButton", "moreMenuPanel", "mobileOrientationOverlay", "mobileLogButton", "mobileAudioToggle", "mobileAudioClose", "startPrepShell", "prepStepTabs", "prepPathTab", "prepSelectionSummary", "heroChoices", "heroDetailOverlay", "heroDetailClose", "heroDetailPortrait", "heroDetailPortraitImage", "heroDetailRole", "heroDetailName", "heroDetailStats", "heroDetailPassive", "heroDetailQuest", "benmingPathSection", "benmingPathTitle", "benmingPathHint", "benmingPathChoices", "starterGuChoices", "relicChoices", "modeChoices", "contractSection", "contractTitle", "contractHint", "contractChoices", "advancedCardPreview", "startBattleButton", "runProgress", "trialModeHint",
    "resumeRunButton", "resumeRunSummary", "overwriteConfirmOverlay", "overwriteConfirmText", "overwriteConfirmCancel", "overwriteConfirmOk", // V0.9.8.7 自动续局
    "towerHeartScreen", "towerHeartEyebrow", "towerHeartTitle", "towerHeartBody", "towerHeartActions", "towerHeartFoot", // E-2c2 塔心全屏场景壳
    "relicOfferOverlay", "relicOfferSource", "relicOfferChip", "relicOfferGlyph", "relicOfferTitle", "relicOfferDesc", "relicOfferAccept", "relicOfferDecline", // V0.9.9.2 遗物掉落可选
    "updateGateOverlay", "updateGateText", "updateGateHint", "updateGateButton", "updateGateContinue", // V0.9.8.8 更新闸
    "tutorialOpenButton", "tutorialResetButton", "tutorialDrillButton", "tutorialDrillFromTutorial", "loreOpenButton", "trialSettingsButton", "settingsOpenButton", "tutorialOverlay", "tutorialCloseButton", "tutorialTitle", "tutorialBody",
    "balanceOpenButton", "balanceOverlay", "balanceCloseButton", "balanceSummary", "balanceCopyButton",
    "tutorialPageText", "tutorialDots", "tutorialPrevButton", "tutorialNextButton", "tutorialSkipButton",
    "prologueOverlay", "prologueCloseButton", "prologueTitle", "prologueBody", "prologuePageText", "prologueDots", "prologuePrevButton", "prologueNextButton", "prologueSkipButton", "settingsPrologueButton", // V0.9.18 塔中回声：开场序章
    "riteOverlay", "riteEyebrow", "riteSeal", "riteArt", "riteWatermark", "riteTitle", "riteText", "riteHint", // V0.9.19 仪式弹窗：Boss对峙/十重天登塔
    "guluOverlay", "guluCloseButton", "guluTitle", "guluBody", "guluOpenButton", "baigushiOpenButton", "forgeOpenButton", "leaderboardOpenButton", "leaderboardEntryTitle", "leaderboardEntryHint", "collectionBadge", "guluBadge", "guluActionConfirm", "guluActionConfirmClose", "guluActionConfirmTitle", "guluActionConfirmText", "guluActionConfirmCancel", "guluActionConfirmOk", "guluForgeKindleControls", "guluForgeKindleDecrease", "guluForgeKindleValue", "guluForgeKindleMax", "guluForgeKindleIncrease", "guluForgeResultOverlay", "guluForgeResultSeal", "guluForgeResultTitle", "guluForgeResultGu", "guluForgeResultTurns", "guluForgeResultConsumed", "guluForgeResultRefunded", "guluForgeResultPity", "guluForgeResultAccept", // V0.9.22/F-0/P71 蛊庐与局外收藏
    "outgameReceiptOverlay", "outgameReceiptAccept", "endlessLeaderboardOverlay", "endlessLeaderboardStatus", "endlessLeaderboardSubmission", "endlessLeaderboardSelf", "endlessLeaderboardList", "endlessLeaderboardRefresh", "endlessLeaderboardRetry", "endlessLeaderboardClose",
    "battleCoach", "battleCoachClose", "keywordTooltip",
    "mapScreen", "mapRoute", "mapHint", "mapDescription", "mapProgress", "mapStatus", "mapNotice", "mapSelectionPanel", "mapSelectionKind", "mapSelectionName", "mapSelectionRisk", "mapSelectionReward", "mapNodeConfirmButton", "mapTransition", "mapTransitionText", "mapGuStones", "topMaterials", "mapDeckButton", "mapBlessAdButton", "endlessWithdrawButton", "topGuStone",
    "deckViewButton", "resultDeckButton", "resultLoreButton", "deckOverlay", "deckCloseButton", "deckLoreButton", "deckTabs", "deckSummary", "deckMaterials", "deckRelics", "deckMarks", "deckList", "deckCardDetail", "deckPrevPage", "deckNextPage", "deckPageLabel",
    "fxLayer", "mupanEnvironment", "effectLayer", "audioControls", "effectToggle", "effectStatus", "turnBanner", "turnBannerKicker", "turnBannerText", "floorEyebrow", "towerProgress", "topRelicGlyph",
    "topRelicName", "turnNumber", "playerSideLabel", "playerTitle", "playerPortrait", "playerPortraitFallback", "playerPortraitImage",
    "playerPortraitCaption", "playerHp", "playerMaxHp", "playerHpBar", "playerEnergy",
    "playerArmor", "playerLifespan", "playerBlood", "buffList", "mobileBuffRail", "activeRelicGlyph",
    "activeRelicName", "combatRelicStrip", "satchelStrip", "enemySideLabel", "enemyTitle", "enemyHp", "enemyMaxHp", "enemyHpBar", "enemyPortrait",
    "battleBackgroundSlot", "battleIntentRegion", "intentBox", "intentIcon", "intentName", "intentDescription", "enemyCriticalMetrics", "intentSummary", "intentCollapseButton", "fateRewriteButton", "fateRewriteChoice", "poisonBorrowButton", "boneChimeButton", "boneChimeOverlay", "boneChimeClose", "boneChimeLead", "boneChimeSoul", "boneChimeSoulPreview", "boneChimeFate", "boneChimeFatePreview", "mupanSealPanel", "enemyPower", "enemyStatusList", "arenaKicker",
    "drawCount", "discardCount", "battleMessage", "endTurnButton", "endTurnHint", "logTitle", "logBattleTab", "logJourneyTab", "battleLog", "journeyLog", "clearLogButton", "logHistoryToggle", "logChatterToggle",
    "hand", "handCollapseToggle", "battleActionBar", "selectedCardActions", "selectedCardName", "selectedCardDetailButton", "selectedCardPlayButton", "castDisplay", "castGlyph", "castName", "resultOverlay", "resultSeal",
    "resultEyebrow", "resultTitle", "resultDescription", "resultTurns", "resultHp", "bossRewardReceipt", "bossRewardStones", "bossRewardCores", "cardRewardPanel",
    "cardRewardChoices", "skipRewardButton", "materialRewardPanel", "materialRewardChoices", "skipMaterialButton", "refinePanel", "refineChoices", "runSummary",
    "cardRewardConfirm", "cardRewardConfirmText", "cardRewardConfirmButton", "cardRewardReselectButton", // V0.9.31 卡牌奖励两段式
    "materialRewardConfirm", "materialRewardConfirmText", "materialRewardConfirmButton", "materialRewardReselectButton", // V0.9.31 材料奖励两段式
    "furnacePanel", "furnaceMaterialList", "furnaceMaterialChoices", "furnaceChoices", "furnaceConfirm", "furnaceComplete", "furnaceSkipButton",
    "furnaceConfirmOriginal", "furnaceConfirmUpgraded", "furnaceRouteSummary", "confirmFurnaceButton", "backFurnaceButton",
    "eventPanel", "eventName", "eventStory", "eventChoices", "eventResult", "eliteConfirmPanel", "eliteConfirmButton", "eliteCancelButton",
    "eventConfirm", "eventConfirmText", "eventConfirmButton", "eventReselectButton", // V0.9.32 机缘/休整两段式
    "shopPanel", "shopGuStones", "shopOverview", "shopCardChoices", "shopActions", "shopRemovePanel", "shopRemoveChoices", "shopRemoveConfirm", "shopRemoveConfirmText", "shopConfirmRemoveButton", "shopBackRemoveButton", "shopCancelRemoveButton",
    "removePickerOverlay", "removePickerClose", "removePickerEyebrow", "removePickerTitle", // V0.9.25 删卡独立弹窗
    "mupanLedgerOverlay", "mupanLedgerTitle", "mupanLedgerLead", "mupanLedgerDebts", "mupanLedgerStartButton",
    "xianghuoOverlay", "xianghuoClose", "settingsXianghuoButton", // V0.9.29 香火供奉
    "ageGateOverlay", "ageGateConfirm", // V0.9.36 年龄门槛
    "loreOverlay", "loreCloseButton", "loreList", "loreProgress", "loreAnimationToggle", "loreResetButton",
    "trialSettingsOverlay", "trialSettingsCloseButton", "trialSettingsTitle", "trialModeChoices", "trialSeedInput", "trialSeedClearButton", "trialSettingsApplyButton",
    "settingsOverlay", "settingsCloseButton", "settingsTitle", "settingsVersion", "settingsMusicToggle", "settingsVolume", "settingsEffectToggle", "settingsPerfToggle", "settingsRecordingToggle", "settingsLoreAnimationToggle", "settingsHomeButton", "settingsRestartButton", "settingsTutorialResetButton", "settingsLoreResetButton",
    "settingsCloudSavePanel", "settingsCloudSaveStatus", "settingsCloudSaveSync", "settingsCloudConflictActions", "settingsCloudKeepLocal", "settingsCloudUseRemote", // TapTap H5 云存档
    "settingsSaveExport", "settingsSaveImportToggle", "settingsSaveImportBox", "settingsSaveImportText", "settingsSaveImportFile", "settingsSaveImportRun", "settingsSaveImportMsg", // V0.9.25 存档保险
    "resultPrimaryButton", "resultSecondaryButton", "shopCloseButton",
    "reviveOfferPanel", "reviveWatchAdButton", "reviveDeclineButton", "rewardRerollButton", // AD-2 局内激励入口
  ].forEach((id) => { dom[id] = document.getElementById(id); });
}

function getStoredFlag(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch (error) {
    console.warn("[本地设置读取失败]", key, error);
    return false;
  }
}

function setStoredFlag(key, value) {
  try {
    if (value) localStorage.setItem(key, "true");
    else localStorage.removeItem(key);
  } catch (error) {
    console.warn("[本地设置写入失败]", key, error);
  }
}

function getStoredText(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (error) {
    console.warn("[本地设置读取失败]", key, error);
    return fallback;
  }
}

function setStoredText(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch (error) {
    console.warn("[本地设置写入失败]", key, error);
  }
}

function refreshModalLock() {
  const hasModal = [dom.resultOverlay, dom.deckOverlay, dom.tutorialOverlay, dom.prologueOverlay, dom.loreOverlay, dom.balanceOverlay, dom.trialSettingsOverlay, dom.settingsOverlay, dom.overwriteConfirmOverlay, dom.relicOfferOverlay, dom.guluOverlay, dom.guluForgeResultOverlay, dom.removePickerOverlay, dom.xianghuoOverlay, dom.ageGateOverlay, dom.heroDetailOverlay, dom.endlessLeaderboardOverlay, dom.boneChimeOverlay] // V0.9.9.2：遗物抉择弹窗纳入模态锁；V0.9.18 序章；V0.9.22 蛊庐；V0.9.25 删卡弹窗；V0.9.29 香火供奉；V0.9.36 年龄门槛；UX-1 蛊修详情
    .some((node) => node && !node.classList.contains("hidden"));
  const receiptOpen = typeof NmgOutgameReceipts !== "undefined" && NmgOutgameReceipts.isOpen();
  document.body.classList.toggle("modal-open", hasModal || receiptOpen);
  if (dom.mobileLogButton) updateMobileViewportState();
}

let endlessSubmissionRequestToken = 0;
let endlessLeaderboardSessionToken = 0;
let endlessLeaderboardTriggerFocus = null;

function getEndlessDeepestScore(run = runState) {
  if (!run || run.mode !== "endless") return 0;
  return Math.max(0, Math.floor(Math.max(Number(run.endlessDeepest) || 0, Number(run.endlessFloor) || 0)));
}

function updateEndlessSubmissionViews() {
  const state = runState?.endlessLeaderboardSubmission || null;
  const text = state?.message || "尚未报入排行榜";
  const conclusionStatus = document.getElementById("endlessSubmissionStatus");
  if (conclusionStatus) conclusionStatus.textContent = text;
  if (dom.endlessLeaderboardSubmission) dom.endlessLeaderboardSubmission.textContent = `最近一次报分：${text}`;
  const retryButtons = [dom.endlessLeaderboardRetry, document.querySelector("[data-endless-leaderboard-retry]")].filter(Boolean);
  retryButtons.forEach((button) => button.classList.toggle("hidden", state?.state !== "failure" || getEndlessDeepestScore() <= 0));
}

async function submitEndlessScoreWithStatus(score) {
  const requestRun = runState;
  const requestToken = ++endlessSubmissionRequestToken;
  const deepest = getEndlessDeepestScore(requestRun);
  void score; // 调用方只能触发本局真实最深层；不接受手填分数。
  if (!requestRun || deepest <= 0) return { ok: false, score: 0, reason: "invalid-score" };
  requestRun.endlessLeaderboardSubmission = { state: "pending", score: deepest, message: "正在报入排行榜" };
  updateEndlessSubmissionViews();
  let result = { ok: false, score: deepest, reason: "unsupported" };
  try {
    result = typeof NmgLeaderboard !== "undefined"
      ? await NmgLeaderboard.submitEndlessFloor(deepest)
      : result;
  } catch (error) { /* 门面本应永不 reject；此处再兜底，结算不可被网络阻塞。 */ }
  if (runState !== requestRun || requestToken !== endlessSubmissionRequestToken) return result;
  const accepted = !!result?.ok || result?.reason === "not-new-best";
  requestRun.endlessLeaderboardSubmission = accepted
    ? { state: "success", score: deepest, message: "已报入排行榜" }
    : { state: "failure", score: deepest, message: "本次报入失败，可在排行榜中重试" };
  updateEndlessSubmissionViews();
  return result;
}

function restoreEndlessLeaderboardTriggerFocus() {
  const target = endlessLeaderboardTriggerFocus;
  endlessLeaderboardTriggerFocus = null;
  if (!target || typeof target.focus !== "function" || target.isConnected === false) return;
  try { target.focus(); } catch (error) { /* 已移除的触发节点不阻塞关闭。 */ }
}

function closeEndlessLeaderboard() {
  endlessLeaderboardSessionToken += 1;
  dom.endlessLeaderboardOverlay?.classList.add("hidden");
  if (dom.endlessLeaderboardRefresh) {
    dom.endlessLeaderboardRefresh.disabled = false;
    dom.endlessLeaderboardRefresh.removeAttribute?.("aria-busy");
  }
  refreshModalLock();
  restoreEndlessLeaderboardTriggerFocus();
}

async function refreshEndlessLeaderboard() {
  if (!dom.endlessLeaderboardOverlay) return;
  const requestToken = ++endlessLeaderboardSessionToken;
  dom.endlessLeaderboardRefresh.disabled = true;
  dom.endlessLeaderboardRefresh.setAttribute?.("aria-busy", "true");
  dom.endlessLeaderboardStatus.textContent = "正在读取排行榜";
  dom.endlessLeaderboardSelf.textContent = "正在读取我的成绩";
  dom.endlessLeaderboardList.replaceChildren();
  updateEndlessSubmissionViews();
  try {
    if (typeof NmgLeaderboard === "undefined" || !NmgLeaderboard.isSupported()) {
      dom.endlessLeaderboardStatus.textContent = "当前环境无法读取 TapTap 排行榜";
      dom.endlessLeaderboardSelf.textContent = "请在支持排行榜的 TapTap 环境中查看本人名次与历史最深。";
      return;
    }
    const [top, self] = await Promise.all([NmgLeaderboard.fetchTop(20), NmgLeaderboard.fetchSelf()]);
    if (requestToken !== endlessLeaderboardSessionToken || dom.endlessLeaderboardOverlay.classList.contains("hidden")) return;
    if (!top.ok) {
      dom.endlessLeaderboardStatus.textContent = "排行榜读取失败，请稍后刷新";
    } else if (!self.ok) {
      dom.endlessLeaderboardStatus.textContent = "公共榜已更新，本人成绩暂不可用";
    } else {
      dom.endlessLeaderboardStatus.textContent = "排行榜已更新";
    }
    dom.endlessLeaderboardSelf.textContent = self.ok
      ? (self.hasScore === false ? "尚未报入排行榜" : `${self.rankDisplay} · ${self.name || "昵称未公开"} · 历史最深第 ${self.scoreDisplay} 层`)
      : "本人名次与历史最深暂不可用";
    if (!top.ok || !top.scores.length) {
      dom.endlessLeaderboardList.textContent = top.ok ? "公共榜尚无成绩" : "公共榜暂不可用";
      return;
    }
    top.scores.slice(0, 20).forEach((score) => {
      const row = document.createElement("div");
      row.className = "endless-leaderboard-row";
      [score.rankDisplay, score.name || "昵称未公开", `第 ${score.scoreDisplay} 层`].forEach((value) => {
        const cell = document.createElement("span");
        cell.textContent = String(value);
        row.appendChild(cell);
      });
      dom.endlessLeaderboardList.appendChild(row);
    });
  } catch (error) {
    if (requestToken === endlessLeaderboardSessionToken && !dom.endlessLeaderboardOverlay.classList.contains("hidden")) {
      dom.endlessLeaderboardStatus.textContent = "排行榜读取失败，请稍后刷新";
      dom.endlessLeaderboardSelf.textContent = "本人名次与历史最深暂不可用";
    }
  } finally {
    if (requestToken === endlessLeaderboardSessionToken) {
      dom.endlessLeaderboardRefresh.disabled = false;
      dom.endlessLeaderboardRefresh.removeAttribute?.("aria-busy");
    }
  }
}

function openEndlessLeaderboard() {
  if (!progression.eliteUnlocked || !dom.endlessLeaderboardOverlay) return false;
  if (dom.endlessLeaderboardOverlay.classList.contains("hidden")) {
    const active = document.activeElement;
    endlessLeaderboardTriggerFocus = active && typeof active.focus === "function" ? active : null;
  }
  dom.endlessLeaderboardOverlay.classList.remove("hidden");
  refreshModalLock();
  refreshEndlessLeaderboard();
  window.setTimeout(() => dom.endlessLeaderboardClose?.focus(), 0);
  return true;
}

function isMobilePortraitPrompt(viewport = getAppViewportSnapshot()) {
  return viewport.width <= 900 && viewport.height > viewport.width;
}

function isMobileLandscapePlay(viewport = getAppViewportSnapshot()) {
  return viewport.width <= 1024 && viewport.height <= 600 && viewport.width > viewport.height;
}

function isCompactAudioViewport(viewport = getAppViewportSnapshot()) {
  return viewport.width >= 901 && viewport.width <= 1300;
}

// TapTap/Android WebView 在横屏切页、系统栏变化与回前台时，布局视口和可视视口可能分帧更新。
// 只在连续两次采样稳定后提交 CSS 变量，避免把过渡半高锁进 overflow:hidden 的全屏壳。
const APP_VIEWPORT_SYNC_DELAYS = Object.freeze([80, 240]);
const APP_VIEWPORT_STABLE_TOLERANCE = 1;
const APP_VIEWPORT_SYNC_MAX_PASSES = 3;
const APP_VIEWPORT_FRAME_FALLBACK_MS = 48;
const APP_VIEWPORT_MIN_USABLE_HEIGHT = 160;
const APP_VIEWPORT_MAX_ASPECT_RATIO = 4;
const APP_VIEWPORT_COLLAPSE_HEIGHT_RATIO = 0.55;
const APP_VIEWPORT_PROPORTIONAL_COLLAPSE_RATIO = 0.7;
const APP_VIEWPORT_SCALE_MATCH_TOLERANCE = 0.12;
const appViewportSyncTimers = new Set();
const appViewportSyncFrames = new Set();
let appViewportSyncScheduled = false;
let appViewportSyncPass = 0;
let appViewportSyncGeneration = 0;
let appViewportChangeGeneration = 0;
let pendingAppViewportSample = null;
let lastGoodAppViewport = null;
const lastGoodAppViewports = { landscape: null, portrait: null };
let lastObservedAppViewport = null;

function measureAppViewport(viewportWindow = window, viewportDocument = document) {
  const visual = viewportWindow?.visualViewport;
  const scale = Number(visual?.scale) || 1;
  const visualWidth = Number(visual?.width) || 0;
  const visualHeight = Number(visual?.height) || 0;
  const root = viewportDocument?.documentElement;
  const clientWidth = Number(root?.clientWidth) || 0;
  const clientHeight = Number(root?.clientHeight) || 0;
  const innerWidth = Math.max(0, Number(viewportWindow?.innerWidth) || 0);
  const innerHeight = Math.max(0, Number(viewportWindow?.innerHeight) || 0);
  const screenWidth = Math.max(0, Number(viewportWindow?.screen?.width) || 0);
  const screenHeight = Math.max(0, Number(viewportWindow?.screen?.height) || 0);
  const devicePixelRatio = Math.max(1, Number(viewportWindow?.devicePixelRatio) || 1);
  const candidates = [];
  if (visualWidth > 0 && visualHeight > 0 && Math.abs(scale - 1) <= 0.05) candidates.push({ width: visualWidth, height: visualHeight, source: "visualViewport" });
  if (clientWidth > 0 && clientHeight > 0) candidates.push({ width: clientWidth, height: clientHeight, source: "clientViewport" });
  if (innerWidth > 0 && innerHeight > 0) candidates.push({ width: innerWidth, height: innerHeight, source: "innerViewport" });
  if (screenWidth > 0 && screenHeight > 0) candidates.push({ width: screenWidth, height: screenHeight, source: "screen" });
  const preferred = candidates.find((candidate) => candidate.source === "visualViewport")
    || candidates.find((candidate) => candidate.source === "clientViewport")
    || candidates.find((candidate) => candidate.source === "innerViewport")
    || { width: 0, height: 0, source: "unknown" };
  return { ...preferred, scale, devicePixelRatio, candidates };
}

function areAppViewportSamplesStable(previous, next, tolerance = APP_VIEWPORT_STABLE_TOLERANCE) {
  if (!previous || !next || previous.width <= 0 || previous.height <= 0 || next.width <= 0 || next.height <= 0) return false;
  return Math.abs(previous.width - next.width) <= tolerance
    && Math.abs(previous.height - next.height) <= tolerance;
}

function isAppViewportSamplePlausible(sample, lastGood = null) {
  const width = Number(sample?.width) || 0;
  const height = Number(sample?.height) || 0;
  if (width <= 0 || height < APP_VIEWPORT_MIN_USABLE_HEIGHT) return false;
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  if (!Number.isFinite(aspectRatio) || aspectRatio > APP_VIEWPORT_MAX_ASPECT_RATIO) return false;

  const goodWidth = Number(lastGood?.width) || 0;
  const goodHeight = Number(lastGood?.height) || 0;
  if (goodWidth <= 0 || goodHeight <= 0) return true;
  const sameOrientation = (width >= height) === (goodWidth >= goodHeight);
  // 地址栏、软键盘等瞬时坍缩通常只改高度；若宽度也明显改变，说明是
  // 真实窗口/设备横屏尺寸切换（如 1280×720 → 900×356），不能继续锁住旧高度。
  const widthStable = width >= goodWidth * 0.9 && width <= goodWidth * 1.1;
  const heightCollapsed = height < goodHeight * APP_VIEWPORT_COLLAPSE_HEIGHT_RATIO;
  if (sameOrientation && widthStable && heightCollapsed) return false;
  const widthScale = width / goodWidth;
  const heightScale = height / goodHeight;
  const proportionalCollapse = sameOrientation
    && widthScale < APP_VIEWPORT_PROPORTIONAL_COLLAPSE_RATIO
    && heightScale < APP_VIEWPORT_PROPORTIONAL_COLLAPSE_RATIO
    && Math.abs(widthScale - heightScale) <= APP_VIEWPORT_SCALE_MATCH_TOLERANCE
    && Math.abs((width / height) - (goodWidth / goodHeight)) <= 0.12;
  return !proportionalCollapse;
}

function getAppViewportScreenReferences(sample) {
  const candidates = Array.isArray(sample?.candidates) ? sample.candidates : [];
  const screen = candidates.find((candidate) => candidate?.source === "screen");
  const width = Number(screen?.width) || 0;
  const height = Number(screen?.height) || 0;
  if (width <= 0 || height <= 0) return [];
  const references = [{ width, height, source: "screen-raw" }];
  const dpr = Math.max(1, Number(sample?.devicePixelRatio) || 1);
  if (dpr > 1.05) {
    const normalizedWidth = width / dpr;
    const normalizedHeight = height / dpr;
    if (normalizedWidth > 0 && normalizedHeight > 0) {
      references.push({ width: normalizedWidth, height: normalizedHeight, source: "screen-css" });
    }
  }
  return references;
}

function isAppViewportColdStartTrusted(sample) {
  const candidates = Array.isArray(sample?.candidates) ? sample.candidates : null;
  // 单元测试和旧调用方可能没有候选来源；真实协调器总会提供候选，缺失时不改变兼容路径。
  if (!candidates) return true;
  const width = Number(sample?.width) || 0;
  const height = Number(sample?.height) || 0;
  if (width <= 0 || height <= 0) return false;
  const references = getAppViewportScreenReferences(sample);
  if (!references.length) return false;
  const orientedReferences = references.flatMap((reference) => [
    reference,
    { width: reference.height, height: reference.width, source: `${reference.source}-rotated` },
  ]);
  const aspectRatio = width / height;
  const matchesScreen = orientedReferences.some((reference) => {
    const widthScale = width / reference.width;
    const heightScale = height / reference.height;
    const aspectDelta = Math.abs(aspectRatio - (reference.width / reference.height));
    return widthScale >= 0.72 && widthScale <= 1.2
      && heightScale >= 0.72 && heightScale <= 1.2
      && Math.abs(widthScale - heightScale) <= 0.2
      && aspectDelta <= 0.3;
  });
  if (matchesScreen) return true;
  const proportionalCollapse = orientedReferences.some((reference) => {
    const widthScale = width / reference.width;
    const heightScale = height / reference.height;
    return widthScale > 0
      && heightScale > 0
      && widthScale < APP_VIEWPORT_PROPORTIONAL_COLLAPSE_RATIO
      && heightScale < APP_VIEWPORT_PROPORTIONAL_COLLAPSE_RATIO
      && Math.abs(widthScale - heightScale) <= APP_VIEWPORT_SCALE_MATCH_TOLERANCE
      && Math.abs(aspectRatio - (reference.width / reference.height)) <= 0.12;
  });
  // screen 既可能是 CSS 像素，也可能是物理像素；只有所有可信参照都无法匹配且呈同比坍缩时才拒绝。
  return !proportionalCollapse;
}

function resolveAppViewportSample(previous, next, finalAttempt = false, lastGood = null) {
  const changePending = previous?.changeGeneration !== next?.changeGeneration;
  const settled = !changePending && areAppViewportSamplesStable(previous, next);
  const plausible = isAppViewportSamplePlausible(next, lastGood);
  const coldStartTrusted = lastGood ? true : isAppViewportColdStartTrusted(next);
  return {
    commit: finalAttempt && settled && plausible && coldStartTrusted ? next : null,
    retry: finalAttempt && (!settled || !plausible || !coldStartTrusted),
    changePending: finalAttempt && changePending,
  };
}

function commitAppViewportSample(sample) {
  if (!sample || sample.width <= 0 || sample.height <= 0) return false;
  lastGoodAppViewport = { ...sample };
  lastGoodAppViewports[sample.width >= sample.height ? "landscape" : "portrait"] = { ...sample };
  const root = document.documentElement;
  root.style.setProperty("--app-width", `${sample.width}px`);
  root.style.setProperty("--app-height", `${sample.height}px`);
  root.dataset.appViewportSource = sample.source;
  return true;
}

function requestAppViewportFrame(callback, syncGeneration) {
  let settled = false;
  let frameId = null;
  let fallbackTimerId = null;
  const finish = () => {
    if (settled) return;
    settled = true;
    if (frameId !== null) {
      appViewportSyncFrames.delete(frameId);
      window.cancelAnimationFrame?.(frameId);
    }
    if (fallbackTimerId !== null) {
      appViewportSyncTimers.delete(fallbackTimerId);
      window.clearTimeout(fallbackTimerId);
    }
    if (syncGeneration !== appViewportSyncGeneration || !appViewportSyncScheduled) return;
    callback();
  };
  if (typeof window.requestAnimationFrame === "function") {
    frameId = window.requestAnimationFrame(finish);
    appViewportSyncFrames.add(frameId);
  }
  fallbackTimerId = window.setTimeout(finish, APP_VIEWPORT_FRAME_FALLBACK_MS);
  appViewportSyncTimers.add(fallbackTimerId);
}

function sampleAppViewport(finalAttempt = false, syncGeneration = appViewportSyncGeneration) {
  if (syncGeneration !== appViewportSyncGeneration || !appViewportSyncScheduled) return;
  if (document.visibilityState === "hidden") {
    if (finalAttempt) cancelAppViewportSync();
    return;
  }
  const sample = { ...measureAppViewport(), changeGeneration: appViewportChangeGeneration };
  const orientation = sample.width >= sample.height ? "landscape" : "portrait";
  const resolution = resolveAppViewportSample(pendingAppViewportSample, sample, finalAttempt, lastGoodAppViewports[orientation] || lastGoodAppViewport);
  if (resolution.commit) {
    commitAppViewportSample(resolution.commit);
    applyMobileViewportState();
  }
  pendingAppViewportSample = sample;
  if (!finalAttempt) return;
  pendingAppViewportSample = null;
  if (resolution.changePending) {
    appViewportSyncPass = 1;
    startAppViewportSyncPass(syncGeneration);
    return;
  }
  if (resolution.retry && appViewportSyncPass < APP_VIEWPORT_SYNC_MAX_PASSES) {
    appViewportSyncPass += 1;
    startAppViewportSyncPass(syncGeneration);
    return;
  }
  appViewportSyncScheduled = false;
  appViewportSyncPass = 0;
}

function queueAppViewportSample(delay, finalAttempt, syncGeneration) {
  const begin = () => {
    if (syncGeneration !== appViewportSyncGeneration || !appViewportSyncScheduled) return;
    requestAppViewportFrame(() => {
      requestAppViewportFrame(() => sampleAppViewport(finalAttempt, syncGeneration), syncGeneration);
    }, syncGeneration);
  };
  if (delay <= 0) {
    begin();
    return;
  }
  let timerId = 0;
  timerId = window.setTimeout(() => {
    appViewportSyncTimers.delete(timerId);
    begin();
  }, delay);
  appViewportSyncTimers.add(timerId);
}

function startAppViewportSyncPass(syncGeneration) {
  if (syncGeneration !== appViewportSyncGeneration || !appViewportSyncScheduled) return;
  pendingAppViewportSample = null;
  queueAppViewportSample(0, false, syncGeneration);
  APP_VIEWPORT_SYNC_DELAYS.forEach((delay, index) => {
    queueAppViewportSample(delay, index === APP_VIEWPORT_SYNC_DELAYS.length - 1, syncGeneration);
  });
}

function scheduleAppViewportSync() {
  if (document.visibilityState === "hidden" || appViewportSyncScheduled) return;
  appViewportSyncScheduled = true;
  appViewportSyncPass = 1;
  appViewportSyncGeneration += 1;
  lastObservedAppViewport = measureAppViewport();
  startAppViewportSyncPass(appViewportSyncGeneration);
}

function cancelAppViewportSync() {
  appViewportSyncGeneration += 1;
  appViewportSyncScheduled = false;
  appViewportSyncPass = 0;
  pendingAppViewportSample = null;
  appViewportSyncTimers.forEach((timerId) => window.clearTimeout(timerId));
  appViewportSyncTimers.clear();
  appViewportSyncFrames.forEach((frameId) => {
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(frameId);
    else window.clearTimeout(frameId);
  });
  appViewportSyncFrames.clear();
}

function forceAppViewportSync() {
  cancelAppViewportSync();
  updateMobileViewportState();
}

function handleAppViewportResize() {
  const observed = measureAppViewport();
  if (!areAppViewportSamplesStable(lastObservedAppViewport, observed)) appViewportChangeGeneration += 1;
  lastObservedAppViewport = observed;
  updateMobileViewportState();
}

function getAppViewportSnapshot() {
  const measured = measureAppViewport();
  const orientation = measured.width >= measured.height ? "landscape" : "portrait";
  return lastGoodAppViewports[orientation] || measured;
}

function getAppViewportLockState(options) {
  const { trustedViewport = false, combatSafe = false, startOpen = false } = options || {};
  const viewportTrusted = Boolean(trustedViewport);
  return {
    viewportTrusted,
    combatLock: viewportTrusted && Boolean(combatSafe),
    startLock: viewportTrusted && Boolean(startOpen),
  };
}

function getAppViewportDebugText() {
  const root = document.documentElement;
  const rootRect = root.getBoundingClientRect();
  const visual = window.visualViewport;
  const stable = lastGoodAppViewport;
  const trustedOrientation = stable ? (stable.width >= stable.height ? "landscape" : "portrait") : "none";
  const cssHeight = window.getComputedStyle?.(root)?.getPropertyValue("--app-height").trim() || "-";
  const visualText = visual
    ? `${Math.round(visual.width)}×${Math.round(visual.height)}@${Number(visual.scale || 1).toFixed(2)}`
    : "不支持";
  const stableText = stable ? `${Math.round(stable.width)}×${Math.round(stable.height)}(${stable.source})` : "待稳定";
  const orientation = window.screen?.orientation?.type || (window.innerWidth > window.innerHeight ? "landscape" : "portrait");
  const screen = window.screen ? `${window.screen.width}×${window.screen.height}` : "不支持";
  const dpr = Number(window.devicePixelRatio || 1).toFixed(2);
  const tapTapVersion = window.__TAPTAP_PACKAGE_VERSION__ || document.documentElement.dataset.taptapPackageVersion || "网页";
  return `视口诊断：screen ${screen} / dpr ${dpr} / inner ${window.innerWidth}×${window.innerHeight} / client ${root.clientWidth}×${root.clientHeight} / visual ${visualText} / root ${Math.round(rootRect.width)}×${Math.round(rootRect.height)} / trusted ${stableText}(${trustedOrientation}) / css ${cssHeight} / ${orientation} / ${document.visibilityState} / 游戏 ${GAME_VERSION} / TapTap包 ${tapTapVersion}`;
}

// 手机横屏安全布局判定：横屏 + 视口足够小（手机量级），桌面大屏不触发。
function isMobileLandscapeSafe(viewport = getAppViewportSnapshot()) {
  return viewport.width > viewport.height && viewport.height <= 720 && viewport.width <= 1280;
}

function closeMobileLogPanel() {
  document.body.classList.remove("mobile-log-open");
  dom.mobileLogButton?.setAttribute("aria-expanded", "false");
}

function closeMobileAudioPanel() {
  document.body.classList.remove("mobile-audio-open");
  dom.mobileAudioToggle?.setAttribute("aria-expanded", "false");
}

function toggleMobileLogPanel() {
  const willOpen = !document.body.classList.contains("mobile-log-open");
  document.body.classList.toggle("mobile-log-open", willOpen);
  dom.mobileLogButton?.setAttribute("aria-expanded", String(willOpen));
}

function toggleMobileAudioPanel() {
  const willOpen = !document.body.classList.contains("mobile-audio-open");
  document.body.classList.toggle("mobile-audio-open", willOpen);
  dom.mobileAudioToggle?.setAttribute("aria-expanded", String(willOpen));
}

function shouldReduceHandMotion() {
  return !effectsEnabled
    || document.body.classList.contains("effects-off")
    || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function clearHandTransition() {
  window.clearTimeout(handTransitionTimer);
  handTransitionTimer = 0;
  document.body.classList.remove("hand-transitioning");
}

function setCombatHandActive(active) {
  const next = Boolean(active);
  clearHandTransition();
  document.body.classList.toggle("combat-hand-active", next);
  if (!next) {
    document.body.classList.remove("hand-collapsed", "hand-dealing");
    selectedHandCardId = "";
    dom.hand?.querySelectorAll(".card.is-selected").forEach((card) => card.classList.remove("is-selected"));
    updateSelectedCardActions();
  }
  updateMobileHandToggleCopy();
}

function updateMobileHandToggleCopy() {
  if (!dom.handCollapseToggle) return;
  const handCount = game?.hand?.length || 0;
  const collapsed = document.body.classList.contains("hand-collapsed");
  const title = dom.handCollapseToggle.querySelector(".hand-toggle-title");
  const count = dom.handCollapseToggle.querySelector(".hand-toggle-count");
  const action = dom.handCollapseToggle.querySelector(".hand-toggle-action");
  dom.handCollapseToggle.dataset.handCount = String(handCount);
  dom.handCollapseToggle.setAttribute("aria-expanded", String(!collapsed));
  dom.handCollapseToggle.setAttribute("aria-label", collapsed ? `展开手牌，当前 ${handCount} 张` : `收起手牌，当前 ${handCount} 张`);
  if (title) title.textContent = collapsed ? `手牌 ×${handCount}` : "收起手牌";
  if (count) count.textContent = collapsed ? "牌匣已合" : `手牌 ×${handCount}`;
  if (action) action.textContent = collapsed ? "展开" : "收起";
}

function setHandCollapsed(collapsed) {
  const canCollapse = document.body.classList.contains("mobile-combat-safe");
  const next = Boolean(collapsed) && canCollapse;
  const changed = document.body.classList.contains("hand-collapsed") !== next;
  clearHandTransition();
  if (changed && canCollapse && !shouldReduceHandMotion()) {
    document.body.classList.add("hand-transitioning");
  }
  document.body.classList.toggle("hand-collapsed", next);
  if (document.body.classList.contains("hand-transitioning")) {
    handTransitionTimer = window.setTimeout(clearHandTransition, HAND_TRANSITION_MS);
  }
  updateMobileHandToggleCopy();
}

function toggleHandCollapsed() {
  setHandCollapsed(!document.body.classList.contains("hand-collapsed"));
}

function shouldCollapseMobileHandFromTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  if (target.closest(".hand, .hand-collapse-toggle, .selected-card-actions")) return false;
  if (target.closest("button, a, input, select, textarea, [role=\"button\"], [data-keyword]")) return false;
  return Boolean(target.closest(".arena-panel, .player-panel, .enemy-panel, .battle-intent-region"));
}

function applyMobileViewportState() {
  const viewport = getAppViewportSnapshot();
  const viewportOrientation = viewport.width >= viewport.height ? "landscape" : "portrait";
  const trustedViewport = lastGoodAppViewports[viewportOrientation];
  const portraitPrompt = isMobilePortraitPrompt(viewport);
  const landscapePlay = isMobileLandscapePlay(viewport);
  const compactAudio = isCompactAudioViewport(viewport);
  const landscapeSafe = isMobileLandscapeSafe(viewport);
  const modalOpen = document.body.classList.contains("modal-open");
  const inActiveRun = !!dom.startScreen && dom.startScreen.classList.contains("hidden");
  const startOpen = !!dom.startScreen && !dom.startScreen.classList.contains("hidden");
  const prepOpen = startOpen && !!dom.prepScreenView && !dom.prepScreenView.classList.contains("hidden");
  const mapOpen = !!dom.mapScreen && !dom.mapScreen.classList.contains("hidden");
  // 战斗页安全布局：横屏手机 + 当前处于战斗（game 存在）。离开战斗 game 置空即自动移除。
  const combatSafe = landscapeSafe && !!game;
  const lockState = getAppViewportLockState({ trustedViewport, combatSafe, startOpen });
  // 极矮横屏（如部分手机全屏横屏高度 <= 430）再压一档氛围装饰，纯展示。
  const compactLowHeight = landscapeSafe && viewport.height <= 430;
  const showLogButton = combatSafe && inActiveRun && !mapOpen && !modalOpen;
  const showAudioButton = (landscapePlay || compactAudio) && !modalOpen;
  document.body.classList.toggle("mobile-portrait-lock", portraitPrompt);
  document.body.classList.toggle("mobile-landscape-play", landscapePlay);
  document.body.classList.toggle("mobile-landscape", landscapeSafe);
  document.body.classList.toggle("compact-audio-ui", compactAudio);
  document.body.classList.toggle("mobile-combat-safe", combatSafe);
  if (combatSafe && intentCollapsed) setIntentCollapsed(false);
  document.body.classList.toggle("app-viewport-trusted", lockState.viewportTrusted);
  document.body.classList.toggle("app-viewport-untrusted", !lockState.viewportTrusted);
  if (!combatSafe) setHandCollapsed(false);
  document.body.classList.toggle("start-prep-active", prepOpen);
  document.body.classList.toggle("start-home-active", startOpen && !prepOpen);
  document.body.classList.toggle("compact-low-height", combatSafe && compactLowHeight);
  document.documentElement.classList.toggle("combat-lock-html", lockState.combatLock);
  document.documentElement.classList.toggle("start-prep-lock", lockState.startLock);
  dom.mobileOrientationOverlay?.classList.toggle("hidden", !portraitPrompt);
  dom.mobileLogButton?.classList.toggle("hidden", !showLogButton);
  dom.mobileAudioToggle?.classList.toggle("hidden", !showAudioButton);
  if (!showLogButton) closeMobileLogPanel();
  if (!showAudioButton) closeMobileAudioPanel();
}

function updateMobileViewportState() {
  scheduleAppViewportSync();
  applyMobileViewportState();
}

// V0.9.36 B-6c：残卷解锁与设置辅助已抽至 nmg-story.js，须在本文件之前加载。

function normalizeTrialMode(mode) {
  return TRIAL_MODES[mode] ? mode : "normal";
}

function getTrialModeInfo(mode = trialMode) {
  return TRIAL_MODES[normalizeTrialMode(mode)] || TRIAL_MODES.normal;
}

function isBalanceTrialMode() {
  return trialMode === "balance";
}

function normalizeTrialSeed(value = "") {
  const compact = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^MT/, "").slice(0, 4);
  return compact.length === 4 ? `MT-${compact}` : "";
}

function generateTrialSeed() {
  return `MT-${Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0")}`;
}

function seedToNumber(seed, { raw = false } = {}) {
  // V0.9.12.1：raw=true 直接哈希原串。通道种子（MT-XXXX-route 等）此前被 normalizeTrialSeed 截回 MT-XXXX，
  // 八个通道初始状态完全相同、分通道隔离名存实亡；修复后既有种子的路线/奖励会整体变化（随版本声明）。
  const text = raw ? String(seed || "MT-0000").toUpperCase() : (normalizeTrialSeed(seed) || String(seed || "MT-0000").toUpperCase());
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seedToNumber(seed) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

function createRngChannel(seed, channel) {
  return {
    seed: `${normalizeTrialSeed(seed) || seed}-${channel}`,
    state: seedToNumber(`${normalizeTrialSeed(seed) || seed}-${channel}`, { raw: true }) || 0x9e3779b9,
    uses: 0,
  };
}

function nextRngValue(channelState) {
  if (!channelState) return Math.random();
  let state = Number(channelState.state) || 0x9e3779b9;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  channelState.state = state >>> 0;
  channelState.uses = (Number(channelState.uses) || 0) + 1;
  return (channelState.state / 4294967296);
}

function createRunRngState(seed) {
  return {
    seed: normalizeTrialSeed(seed) || seed,
    channels: {
      route: createRngChannel(seed, "route"),
      enemyOrder: createRngChannel(seed, "enemy-order"),
      reward: createRngChannel(seed, "reward"),
      event: createRngChannel(seed, "event"),
      refine: createRngChannel(seed, "refine"),
      intent: createRngChannel(seed, "intent"),
      draw: createRngChannel(seed, "draw"),
      combat: createRngChannel(seed, "combat"),
    },
  };
}

function getRunRandom(channel = "route") {
  if (!runState?.rngState?.channels) return Math.random();
  if (!runState.rngState.channels[channel]) {
    runState.rngState.channels[channel] = createRngChannel(runState.trialSeed || generateTrialSeed(), channel);
  }
  return nextRngValue(runState.rngState.channels[channel]);
}

function getRunRandomInt(max, channel = "route") {
  const limit = Math.floor(Number(max) || 0);
  if (limit <= 0) return 0;
  return Math.floor(getRunRandom(channel) * limit);
}

function pickWithRunRandom(items, channel = "route") {
  if (!Array.isArray(items) || !items.length) return null;
  return items[getRunRandomInt(items.length, channel)] ?? items[0] ?? null;
}

function sampleWithRunRandom(items, count, channel = "route") {
  return sample(items, count, () => getRunRandom(channel));
}

function initTrialSettings() {
  trialMode = normalizeTrialMode(getStoredText(TRIAL_MODE_STORAGE_KEY, "normal"));
  trialSeedDraft = normalizeTrialSeed(getStoredText(TRIAL_SEED_STORAGE_KEY, ""));
  updateTrialModeControls();
}

function setTrialMode(mode, { silent = false } = {}) {
  trialMode = normalizeTrialMode(mode);
  setStoredText(TRIAL_MODE_STORAGE_KEY, trialMode);
  updateTrialModeControls();
  renderTrialSettingsOverlay();
  if (!silent && dom.runProgress) {
    dom.runProgress.textContent = `${getTrialModeInfo().name}已保存，将从下一局开始生效。`;
    dom.runProgress.classList.remove("hidden");
  }
}

function getSeedForNextRun() {
  const savedSeed = isBalanceTrialMode() ? normalizeTrialSeed(trialSeedDraft) : "";
  return savedSeed || generateTrialSeed();
}

function updateTrialModeControls() {
  const info = getTrialModeInfo();
  document.body.classList.toggle("trial-mode-balance", trialMode === "balance");
  document.body.dataset.trialMode = trialMode;
  if (dom.trialModeHint) {
    if (trialMode === "balance") {
      dom.trialModeHint.textContent = `平衡测试模式：${trialSeedDraft ? `下局使用 ${trialSeedDraft}` : "下局会生成可复现种子"}。`;
      dom.trialModeHint.classList.remove("hidden");
    } else {
      dom.trialModeHint.classList.add("hidden");
    }
  }
  if (dom.balanceOpenButton) {
    const showBalance = trialMode === "balance";
    dom.balanceOpenButton.classList.toggle("hidden", !showBalance);
  }
  if (dom.trialSettingsButton) dom.trialSettingsButton.title = `当前：${info.name}`;
}

function renderTrialSettingsOverlay() {
  if (!dom.trialModeChoices) return;
  dom.trialModeChoices.innerHTML = Object.values(TRIAL_MODES).map((mode) => `
    <button class="trial-mode-card ${trialMode === mode.id ? "selected" : ""}" type="button" data-trial-mode="${mode.id}" aria-pressed="${trialMode === mode.id}">
      <strong>${mode.name}</strong>
      <span>${mode.brief}</span>
      <small>${mode.note}</small>
    </button>
  `).join("");
  if (dom.trialSeedInput) {
    dom.trialSeedInput.value = trialSeedDraft;
    dom.trialSeedInput.disabled = trialMode !== "balance";
    dom.trialSeedInput.placeholder = trialMode === "balance" ? "如 MT-7F3A" : "仅平衡测试模式使用";
  }
}

function openTrialSettingsOverlay() {
  if (!dom.trialSettingsOverlay) return;
  closeSettingsOverlay();
  renderTrialSettingsOverlay();
  dom.trialSettingsOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeTrialSettingsOverlay() {
  dom.trialSettingsOverlay?.classList.add("hidden");
  refreshModalLock();
}

function saveTrialSeedDraft(value) {
  trialSeedDraft = normalizeTrialSeed(value);
  setStoredText(TRIAL_SEED_STORAGE_KEY, trialSeedDraft);
  updateTrialModeControls();
  renderTrialSettingsOverlay();
}

function renderSettingsOverlay() {
  if (!dom.settingsOverlay) return;
  const audioState = window.AudioManager?.getState?.();
  if (dom.settingsVersion) {
    const cls = document.body.classList;
    dom.settingsVersion.textContent = [
      `当前版本：${GAME_VERSION}`,
      `build：${window.__NMG_BUILD__ ?? "-"}`,
      getAppViewportDebugText(),
      getPerformanceDebugText(),
      `mobile-landscape：${cls.contains("mobile-landscape") ? "是" : "否"}`,
      `mobile-combat-safe：${cls.contains("mobile-combat-safe") ? "是" : "否"}`,
      `compact-low-height：${cls.contains("compact-low-height") ? "是" : "否"}`,
      `音频：${audioState ? `${audioState.muted ? "静音" : "开"} 音量${audioState.volume}` : "未就绪"}`,
    ].join(" · ");
  }
  if (dom.settingsMusicToggle) dom.settingsMusicToggle.textContent = `音乐：${audioState?.muted ? "关" : "开"}`;
  if (dom.settingsVolume && audioState) dom.settingsVolume.value = String(audioState.volume);
  if (dom.settingsEffectToggle) dom.settingsEffectToggle.textContent = `战斗特效：${effectsEnabled ? "开" : "关"}`;
  if (dom.settingsRecordingToggle) {
  }
  if (dom.settingsLoreAnimationToggle) dom.settingsLoreAnimationToggle.textContent = `跳过残卷动画：${loreSkipAnimation ? "开" : "关"}`;
}

function openSettingsOverlay() {
  if (!dom.settingsOverlay) return;
  closeTrialSettingsOverlay();
  renderSettingsOverlay();
  dom.settingsOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeSettingsOverlay() {
  dom.settingsOverlay?.classList.add("hidden");
  refreshModalLock();
}

function confirmReturnToTitle() {
  const message = "返回首页将视为主动放弃：不结算带出资源，也不计死亡或阶段收手。确定继续吗？";
  if (!window.confirm(message)) return;
  playUiSfx();
  closeSettingsOverlay();
  resetRunToTitle();
}

function confirmRestartRun() {
  const message = "重新开始将主动放弃当前试炼：不结算带出资源，也不计死亡或阶段收手。确定继续吗？";
  if (!window.confirm(message)) return;
  const restartBenmingPath = getRunBenmingPath(runState);
  playUiSfx();
  closeSettingsOverlay();
  clearCombatEffects();
  hideRewardPanels();
  dom.resultOverlay?.classList.add("hidden");
  dom.deckOverlay?.classList.add("hidden");
  dom.loreOverlay?.classList.add("hidden");
  if (runState?.status === "running") finalizeRun("abandoned", { showConclusion: false });
  if (restartBenmingPath) progression.selectedBenmingPath = restartBenmingPath;
  startNewRun();
}

function keywordAttr(keyword) {
  const text = KEYWORD_HELP[keyword];
  return text ? ` data-keyword="${keyword}" aria-label="${escapeAttribute(`${keyword}：${text}`)}"` : "";
}

function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sample(items, count, random = Math.random) {
  return shuffle(items, random).slice(0, count);
}

function getUpgradeLevel(cardOrEntry) {
  // V0.9.51：天品成蛊带 guluUpgradeCap=3，其余一律封顶 2（原生牌规则不变）。
  // V0.9.52：九转鼎炼出的随行蛊带 guluCarriedTurn=true，按实际转数生效（上限九转），不再被削。
  const carried = cardOrEntry && cardOrEntry.guluCarriedTurn;
  const cap = carried ? 8 : Math.max(2, Math.min(3, Number(cardOrEntry?.guluUpgradeCap) || 2));
  return Math.min(cap, Math.max(0, Number(cardOrEntry?.upgradeLevel) || 0));
}

const GULU_CARD_METADATA_FIELDS = Object.freeze([
  "guluSourceId", "guluGrade", "guluNurture", "guluUpgradeCap", "guluCarriedTurn", "guluFused",
]);

function copyGuluCardMetadata(source, target = {}) {
  GULU_CARD_METADATA_FIELDS.forEach((field) => {
    if (source && Object.prototype.hasOwnProperty.call(source, field)) target[field] = source[field];
  });
  return target;
}

function getStartDeckCopyLimit(entry) {
  if (!entry?.key) return Infinity;
  const exclusiveKeys = new Set(Object.values(HERO_EXCLUSIVE_CARD_KEYS || {}).flat());
  if (entry.guluFused || START_DECK_COPY_LIMIT_RULES.criticalKeys.includes(entry.key) || exclusiveKeys.has(entry.key)) {
    return START_DECK_COPY_LIMIT_RULES.exclusiveLimit;
  }
  if (START_DECK_COPY_LIMIT_RULES.engineKeys.includes(entry.key)) return START_DECK_COPY_LIMIT_RULES.engineLimit;
  return Infinity;
}

function validateStartDeckCopyLimits(entries) {
  const counts = new Map();
  (entries || []).forEach((entry) => {
    if (!entry?.key) return;
    const current = counts.get(entry.key) || { count: 0, limit: Infinity, fused: false };
    current.count += 1;
    current.limit = Math.min(current.limit, getStartDeckCopyLimit(entry));
    current.fused ||= Boolean(entry.guluFused);
    counts.set(entry.key, current);
  });
  const violations = [...counts.entries()]
    .filter(([, state]) => Number.isFinite(state.limit) && state.count > state.limit)
    .map(([key, state]) => ({
      key,
      name: CARD_LIBRARY[key]?.name || key,
      count: state.count,
      limit: state.limit,
      fused: state.fused,
    }));
  return { ok: violations.length === 0, violations };
}

function getDisplayCardName(key, upgradeLevel = 0) {
  const base = CARD_LIBRARY[key]?.name || key;
  return upgradeLevel > 0 ? `${base} · ${getRefineTurnName(upgradeLevel)}` : base;
}

function createDeckEntry(key) {
  cardSerial += 1;
  return {
    key,
    originalKey: key,
    instanceId: `deck-card-${cardSerial}`,
    upgradeLevel: 0,
    mutated: false,
    damaged: false,
    skewed: false,
    costPenalty: 0,
  };
}

function syncRunDeckKeys() {
  if (!runState?.deckCards) return;
  runState.deckKeys = runState.deckCards.map((card) => card.key);
}

function addRunDeckCard(key) {
  const entry = createDeckEntry(key);
  runState.deckCards.push(entry);
  syncRunDeckKeys();
  markGuDiscovered(key);
  return entry;
}

// V0.9.36 B-5b: relic acquisition, offer, and choice flow moved to nmg-relics.js.

/* ===== V0.9.16 丹囊：拾取 / 使用 / 渲染 ===== */
function pickBattleItemId() {
  const heroFaction = runState?.heroId;
  const pool = BATTLE_ITEM_IDS.filter((id) => {
    const f = BATTLE_ITEMS[id].faction;
    return f === "common" || f === heroFaction;
  });
  return pool.length ? sampleWithRunRandom(pool, 1, "reward")[0] : null;
}
function grantBattleItem(itemId, sourceName = "命途所得") {
  if (!runState || !BATTLE_ITEMS[itemId]) return false;
  runState.satchel = runState.satchel || [];
  const item = BATTLE_ITEMS[itemId];
  if (runState.satchel.length >= getSatchelCap()) {
    gainGuStones(PLAYER_BALANCE.satchel.fullFallbackGuStones, `丹囊已满，「${item.name}」折算`, { raw: true });
    return false;
  }
  runState.satchel.push(itemId);
  addLog(`${sourceName}：丹囊收入「${item.name}」——${item.description}`, "positive-log");
  return true;
}
/* 无效使用防呆：明显零收益时拒绝使用（不消耗），防手滑白耗稀缺消耗品。 */
function getItemBlockReason(itemId) {
  if (itemId === "huihunDan" && game.player.hp >= game.player.maxHp) return "生命已满";
  if (itemId === "qingzhangSan" && !(game.player.poison > 0) && !(game.player.poisonStingStack > 0)) return "身上无毒可清";
  if (itemId === "yinluChong" && !game.drawPile.length && !game.discardPile.length) return "已无牌可抽";
  if (itemId === "zhuyanLu" && game.player.lifespan >= (game.player.maxLifespan ?? game.player.lifespan)) return "寿元已满";
  return "";
}
let satchelUnlockTimer = null;
/* 战斗内点击丹囊芯片使用：仅玩家回合（inputLocked 为假）可用；效果全走现有入口。 */
function useBattleItem(index) {
  if (!game || game.status !== "playing" || game.inputLocked || !runState) return;
  const satchel = runState.satchel || [];
  const itemId = satchel[index];
  const item = BATTLE_ITEMS[itemId];
  if (!item) return;
  const blockReason = getItemBlockReason(itemId);
  if (blockReason) { setBattleMessage(`${blockReason}，暂不必动用「${item.name}」。`); return; }
  const mupanMetricsBefore = captureMupanActionMetrics();
  // 与出牌同款防连点：结算期间锁输入，防手机误双击把下一件也捏碎（V0.9.16 审查修复）
  game.inputLocked = true;
  window.clearTimeout(satchelUnlockTimer);
  satchelUnlockTimer = window.setTimeout(() => {
    if (game && game.status === "playing") { game.inputLocked = false; render(); }
  }, 260);
  satchel.splice(index, 1);
  playUiSfx();
  addLog(`你捏碎「${item.name}」：${item.description}`, "player-log");
  switch (itemId) {
    case "huihunDan": healPlayer(8, item.name); break;
    case "huxinJia":
      game.player.armor += 8;
      recordArmorGained(8);
      spawnFloatText(dom.playerPortrait, "+8 防御", "defense-float");
      break;
    case "yinluChong": drawCards(2); break;
    case "ningyuanSha":
      game.player.energy += 1;
      spawnFloatText(dom.playerPortrait, "+1 真元", "resource-float");
      break;
    case "ningshaPo": gainBlood(3); break;
    case "chixueLu": {
      const dmg = applyMupanIncomingDamage(6);
      game.enemy.hp = Math.max(0, game.enemy.hp - dmg);
      recordPlayerDamage(dmg, { card: false });
      spawnFloatText(dom.enemyPortrait, `炽血 -${dmg}`, "");
      animateHit(dom.enemyPortrait);
      // 直伤必须补 Boss 转阶段检查（V0.9.12.1 势爆符漏检的教训）
      checkCorpseDiskPhase2();
      checkLayer2BossPhase2();
      break;
    }
    case "baoduNang": applyEnemyPoison(4, item.name, { corrosive: false }); break;
    case "qingzhangSan": {
      const cured = Math.min(4, game.player.poison || 0);
      const sting = Math.min(2, game.player.poisonStingStack || 0);
      game.player.poison = Math.max(0, (game.player.poison || 0) - 4);
      game.player.poisonStingStack = Math.max(0, (game.player.poisonStingStack || 0) - 2);
      spawnFloatText(dom.playerPortrait, `清瘴${cured > 0 ? ` -${cured}毒` : ""}${sting > 0 ? ` -${sting}刺` : ""}`, "heal-float");
      break;
    }
    case "yinshiLing": gainFateMomentum(2); break;
    case "dingpanZhu":
      game.player.nextCardCostReduction = (game.player.nextCardCostReduction || 0) + 1;
      spawnFloatText(dom.playerPortrait, "下张牌 -1 费", "resource-float");
      break;
    case "zhuyanLu": gainLifespan(3, item.name); break;
    case "suijinXiang":
      game.enemy.weaken = (game.enemy.weaken || 0) + 2;
      spawnFloatText(dom.enemyPortrait, "+2 衰老", "resource-float");
      addLog(`${item.name}烟起：敌人衰老 +2，攻击伤害永久平减。`, "positive-log");
      break;
    default: break;
  }
  const battleEnded = checkBattleResult();
  if (!battleEnded) resolveMupanPostPlayerAction(mupanMetricsBefore);
  render();
}
/* 丹囊条：战斗内常驻（空囊隐藏），点击即用；与遗物条同款芯片视觉。 */
function renderSatchelStrip() {
  if (!dom.satchelStrip || !runState) return;
  const satchel = runState.satchel || [];
  const sig = satchel.join(",");
  if (dom.satchelStrip.dataset.sig === sig) return;
  dom.satchelStrip.dataset.sig = sig;
  dom.satchelStrip.innerHTML = satchel.map((id, i) => {
    const it = BATTLE_ITEMS[id];
    if (!it) return "";
    return `<button type="button" class="satchel-chip" data-satchel-index="${i}" title="${it.name}：${it.description}" aria-label="使用${it.name}：${it.description}"><b>${it.glyph}</b><span>${it.name}</span></button>`;
  }).join("");
  dom.satchelStrip.classList.toggle("hidden", satchel.length === 0);
}

// V0.9.36 B-5b: combat relic strip and trigger feedback moved to nmg-relics.js.

function getRandomPoisonCardKey(channel = "reward") {
  const pool = [
    "greenMiasma", "insectSwarm", "moltingShell", "poisonReturn",
    "armorMeltPoison", "chaosBee", "mutantPoison",
  ].filter((key) => CARD_LIBRARY[key]);
  return sampleWithRunRandom(pool, 1, channel)[0] || "armorMeltPoison";
}

function removeRandomDeckCard(channel = "event") {
  if (!runState || runState.deckCards.length <= 6) return null;
  const index = getRunRandomInt(runState.deckCards.length, channel);
  const [removed] = runState.deckCards.splice(index, 1);
  syncRunDeckKeys();
  return removed || null;
}

function getSkewPenaltyText(cardOrEntry) {
  const key = cardOrEntry?.key;
  const definition = CARD_LIBRARY[key] || {};
  if (definition.category === "attack") return "偏斜：使用后失去 1 点生命";
  if (definition.category === "defense") return "偏斜：使用后弃 1 张随机手牌";
  if (definition.type === "poison" || definition.typeName?.includes("毒道")) return "偏斜：使用后失去 1 点生命";
  return "偏斜：使用后失去 1 点寿元（不致死，不计入焚寿加伤）";
}

function getEntryStatusLabels(entryOrCard) {
  const labels = [];
  if (entryOrCard?.mutated) labels.push("异变");
  if (entryOrCard?.damaged) labels.push("受损");
  if (entryOrCard?.skewed) labels.push("偏斜");
  return labels;
}

function getCardEffectForEntry(entry) {
  const notes = [];
  if (entry?.damageBonus > 0) notes.push(`悟道：本局伤害 +${entry.damageBonus}`);
  if (entry?.damaged && entry.costPenalty > 0) notes.push(`受损：本局消耗 +${entry.costPenalty}`);
  if (entry?.skewed) notes.push(getSkewPenaltyText(entry));
  const resourceGrowth = getResourcePostCapValues(entry?.key, getUpgradeLevel(entry));
  const resourceRule = RESOURCE_POST_CAP_PROGRESSION[entry?.key];
  Object.entries(resourceGrowth).forEach(([field, value]) => {
    if (value <= 0) return;
    const labels = { damage: "伤害", armor: "防御", heal: "疗愈", poison: "毒性", weaken: "衰老" };
    notes.push(`升转余势：${resourceRule?.effectLabel || labels[field] || field} +${value}`);
  });
  const baseEffect = getCardEffect(entry, getUpgradeLevel(entry));
  return notes.length ? `${baseEffect}<br><small>${notes.join("；")}</small>` : baseEffect;
}

function withChinesePeriod(textOrHtml) {
  const content = String(textOrHtml || "").trim();
  if (!content) return "";
  const plain = stripTags(content).trim();
  return /[。！？]$/.test(plain) ? content : `${content}。`;
}

/* V0.9.51 用户定调：局内炼化由「+N」改用转数表述——"+2"是个数字，"三转"才是蜕变。
 * 所有蛊天生一转（卡牌详情原本就写死「一转蛊」），故 转数 = 炼化等级 + 1。
 * 天品孵化蛊炼蛊上限 +3，正好是局内够不到的四转。数值一概未动，只换称呼。 */
const REFINE_TURN_NAMES = Object.freeze(["一转", "二转", "三转", "四转", "五转", "六转", "七转", "八转", "九转"]);
function getRefineTurnName(level) {
  const v = Math.max(0, Math.min(REFINE_TURN_NAMES.length - 1, Number(level) || 0));
  return REFINE_TURN_NAMES[v];
}

function getRefineText(level) {
  const value = Math.max(0, Math.min(8, Number(level) || 0));
  return value > 0 ? `${getRefineTurnName(value)}（炼化 ${value} 次）` : "一转（未炼化）";
}

function getCardNatureText(entryOrCard) {
  const labels = getEntryStatusLabels(entryOrCard);
  return labels.length ? labels.join(" / ") : "稳定";
}

function getCardTypeDisplay(cardDefinition = {}) {
  const typeName = cardDefinition.typeName || "";
  if (cardDefinition.type === "blood" || typeName.includes("血道")) return "血道蛊";
  if (cardDefinition.type === "poison" || typeName.includes("毒道")) return "毒道蛊";
  if (cardDefinition.type === "fate") return "命势蛊";
  if (cardDefinition.category === "defense") return "护甲蛊";
  if (cardDefinition.category === "attack") return "攻击蛊";
  return "辅助蛊";
}

function getCardTitle(entryOrCard, { states = true } = {}) {
  const level = getUpgradeLevel(entryOrCard);
  const key = entryOrCard?.key;
  const title = getDisplayCardName(key, level);
  const labels = states ? getEntryStatusLabels(entryOrCard) : [];
  return labels.length ? `${title}${labels.map((label) => `【${label}】`).join("")}` : title;
}

function getCompactCardTitle(entryOrCard) {
  const base = CARD_LIBRARY[entryOrCard?.key]?.name || entryOrCard?.key || "未知蛊牌";
  const level = getUpgradeLevel(entryOrCard);
  // V0.9.51 庐养与炼蛊分开标：「月刃蛊+2 庐2」＝炼过两次、且是玄品成蛊带来的 +2 主数值。
  const nurture = Math.max(0, Number(entryOrCard?.guluNurture) || 0);
  const upgraded = level > 0 ? `${base}·${getRefineTurnName(level)}` : base;
  return nurture > 0 ? `${upgraded} 庐${nurture}` : upgraded;
}

function getPrimaryDeckBadge(entryOrCard) {
  const level = getUpgradeLevel(entryOrCard);
  if (entryOrCard?.damaged) return { text: "受损", className: "badge-damaged" };
  if (entryOrCard?.skewed) return { text: "偏斜", className: "badge-skewed" };
  if (entryOrCard?.mutated) return { text: "异变", className: "badge-mutated" };
  if ((Number(entryOrCard?.guluNurture) || 0) > 0) return { text: `庐养 +${entryOrCard.guluNurture}${level > 0 ? ` · ${getRefineTurnName(level)}` : ""}`, className: "badge-nurture" };
  if (level > 0) return { text: getRefineTurnName(level), className: "badge-upgrade" };
  return { text: "未炼化", className: "badge-unrefined" };
}

function getDeckEntryCost(entry) {
  const definition = CARD_LIBRARY[entry.key] || {};
  // 抽牌蛊不能靠升转降到 0 费，否则酒虫/回息蛊会免费替换自身并重开无限循环。
  return (definition.cost || 0) + Math.max(0, Number(entry.costPenalty) || 0);
}

function getGuSeal(entry) {
  const deck = runState?.deckCards || [];
  const speciesKey = entry.originalKey || entry.key;
  const siblings = deck.filter((item) => (item.originalKey || item.key) === speciesKey);
  if (siblings.length <= 1) return "";
  const index = siblings.findIndex((item) => item.instanceId === entry.instanceId);
  if (index < 0) return "";
  const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const numerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const stem = stems[Math.floor(index / numerals.length)] || "癸";
  const numeral = numerals[index % numerals.length] || String(index + 1);
  return `${stem}${numeral}`;
}

function renderCardStateBadges(entryOrCard, { includeUnrefined = false } = {}) {
  const level = getUpgradeLevel(entryOrCard);
  const badges = [];
  if (level > 0) badges.push(`<i class="badge-upgrade"${keywordAttr("炼化")}>${getRefineTurnName(level)}</i>`);
  else if (includeUnrefined) badges.push(`<i class="badge-unrefined"${keywordAttr("炼化")}>未炼化</i>`);
  if (entryOrCard?.mutated) badges.push(`<i class="badge-mutated"${keywordAttr("异变")}>异变</i>`);
  if (entryOrCard?.damaged) badges.push(`<i class="badge-damaged"${keywordAttr("反噬")}>受损</i>`);
  if (entryOrCard?.skewed) badges.push(`<i class="badge-skewed"${keywordAttr("反噬")}>偏斜</i>`);
  return badges.length ? `<div class="deck-state-badges">${badges.join("")}</div>` : "";
}

function renderCardInfoRows(entry, { includeSeal = true, includeOrigin = true } = {}) {
  const definition = CARD_LIBRARY[entry.key] || {};
  const originalDefinition = CARD_LIBRARY[entry.originalKey || entry.key];
  const seal = includeSeal ? getGuSeal(entry) : "";
  const rows = [
    ["品阶", `${getRefineTurnName(getUpgradeLevel(entry))}蛊`],
    ["类型", getCardTypeDisplay(definition)],
    ["消耗", `${getDeckEntryCost(entry)} 真元`],
    ["炼化", getRefineText(getUpgradeLevel(entry))],
    ["蛊性", getCardNatureText(entry)],
  ];
  if (includeOrigin && (entry.originalKey || entry.key) !== entry.key) {
    rows.push(["源蛊", originalDefinition?.name || "旧蛊"]);
  }
  if (seal) rows.push(["蛊印", seal]);
  return `<dl class="deck-card-info">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}

function renderCompactDeckMeta(entry) {
  const definition = CARD_LIBRARY[entry.key] || {};
  const seal = getGuSeal(entry);
  const nature = `蛊性：${getCardNatureText(entry)}`;
  const sealText = seal ? ` · 蛊印：${seal}` : "";
  return `<div class="deck-card-meta">${getRefineTurnName(getUpgradeLevel(entry))}蛊 · ${getCardTypeDisplay(definition)} · ${getDeckEntryCost(entry)} 真元</div>
    <div class="deck-card-submeta">${nature}${sealText}</div>`;
}

function createCardFromDeckEntry(entry) {
  const base = CARD_LIBRARY[entry.key];
  const upgradeLevel = getUpgradeLevel(entry);
  const costPenalty = Math.max(0, Number(entry.costPenalty) || 0);
  const cost = getDeckEntryCost(entry);
  return copyGuluCardMetadata(entry, {
    ...base,
    key: entry.key,
    originalKey: entry.originalKey || entry.key,
    baseName: base.name,
    name: getDisplayCardName(entry.key, upgradeLevel),
    cost,
    printedCost: base.cost,
    costPenalty,
    effect: getCardEffectForEntry(entry),
    upgradeLevel,
    upgradeConfig: CARD_UPGRADE_CONFIG[entry.key] || getDefaultUpgradeConfig(base),
    instanceId: entry.instanceId,
    deckInstanceId: entry.instanceId,
    damageBonus: Math.max(0, Number(entry.damageBonus) || 0),
    mutated: Boolean(entry.mutated),
    mutationMaterialId: entry.mutationMaterialId || "",
    damaged: Boolean(entry.damaged),
    skewed: Boolean(entry.skewed),
  });
}

function createCard(key) {
  return createCardFromDeckEntry(createDeckEntry(key));
}

function normalizeStarterGuSelection(keys = progression.selectedStarterGuKeys) {
  const validKeys = new Set(STARTER_GU_CHOICE_KEYS);
  const normalized = [...new Set(Array.isArray(keys) ? keys : [])]
    .filter((key) => validKeys.has(key))
    .slice(0, 2);
  [...STARTER_GU_DEFAULT_KEYS, ...STARTER_GU_CHOICE_KEYS].forEach((key) => {
    if (normalized.length < 2 && validKeys.has(key) && !normalized.includes(key)) normalized.push(key);
  });
  return normalized.slice(0, 2);
}

function applyStarterGuSelection(deckKeys, selectedKeys) {
  const keys = [...deckKeys];
  const starterGuKeys = normalizeStarterGuSelection(selectedKeys);
  const moonIndex = keys.indexOf("moonBlade");
  const ironIndex = keys.indexOf("ironSkin");
  if (moonIndex >= 0) keys[moonIndex] = starterGuKeys[0];
  if (ironIndex >= 0) keys[ironIndex] = starterGuKeys[1];
  return { keys, starterGuKeys };
}

function buildStarterDeckKeys(heroId = progression.selectedHeroId, selectedKeys = progression.selectedStarterGuKeys) {
  const baseKeys = HERO_STARTER_DECKS[heroId] || HERO_STARTER_DECKS.fate;
  const resolved = applyStarterGuSelection(baseKeys, selectedKeys);
  return { ...resolved, advancedKeys: HERO_EXCLUSIVE_CARD_KEYS[heroId] || [] };
}

function getDefaultUpgradeConfig(cardDefinition) {
  if (cardDefinition?.category === "defense") return { rule: "默认护甲卡：基础防御每级 +4" };
  if (cardDefinition?.category === "attack") return { rule: "默认攻击卡：基础伤害每级 +4" };
  return { rule: "默认辅助卡：每级提高主要数值 1 点" };
}

/* ===== V0.9.58 资源字段有限成长 =====
 * 真元、抽牌、命势、血煞与倍率只允许卡表明确写出的二/三转断点，三转后封顶；
 * 线性资源、每张追加、延长回合与降费继续锁在基础值，避免九转重新形成无限引擎。 */
const RESOURCE_LOCKED_FIELDS = Object.freeze([
  "energy",        // 产真元
  "draw",          // 抽牌
  "supportDraw",   // 辅助牌额外抽
  "perPlayed",     // 群蛊噬：按本回合已出牌数追加
  "cost",          // 费用下调（等价于产能）
  "costReduction",
  "extendTurns",   // 延长增益回合＝变相多出牌
  "fateGain",      // 命势积累速度
  "scaleGain",     // 龙鳞积累速度
  "bloodGain",     // 血煞积累速度
  "bloodMultiplier", // 血煞乘算最多到三转
]);
function getResourceFieldLevel(cardKey, field, level) {
  if (ACTION_ECONOMY_PROGRESSION[cardKey]) return Math.max(0, Math.min(8, level | 0));
  const breakpoint = [
    "wineWorm.draw",
    "essenceGathering.energy", "essenceGathering.draw",
    "yuanReturn.energy", "yuanReturn.supportDraw",
    "focalLife.draw", "bloodRobe.bloodGain", "lifeLamp.fateGain",
    "returnBreath.draw", "emberRemnant.draw", "borrowLife.draw",
    "reversePath.fateGain", "bloodSacrifice.bloodGain", "bloodSacrifice.draw",
    "moltingShell.draw", "fateSever.energy", "drunkFateWorm.draw",
    "soulBurn.energy", "mutantFate.draw",
    "bloodReversal.bloodMultiplier", "bloodTide.bloodMultiplier",
  ].includes(`${cardKey}.${field}`);
  return breakpoint ? Math.max(0, Math.min(2, level | 0)) : 0;
}
function getResourcePostCapValues(cardKey, level) {
  const rule = RESOURCE_POST_CAP_PROGRESSION[cardKey];
  if (!rule) return {};
  const steps = Math.max(0, (level | 0) - rule.capLevel);
  return Object.fromEntries(
    Object.entries(rule.growth).map(([field, gain]) => [field, gain * steps]),
  );
}
function getCardValues(cardOrKey, forcedLevel = null) {
  const values = getCardBaseValues(cardOrKey, forcedLevel);
  if (values && typeof values === "object") {
    const key = typeof cardOrKey === "string" ? cardOrKey : cardOrKey?.key;
    const requestedLevel = forcedLevel === null
      ? getUpgradeLevel(cardOrKey)
      : Math.max(0, Number(forcedLevel) || 0);
    const byLevel = new Map();
    RESOURCE_LOCKED_FIELDS.forEach((field) => {
      if (typeof values[field] !== "number") return;
      const resourceLevel = getResourceFieldLevel(key, field, requestedLevel);
      if (!byLevel.has(resourceLevel)) {
        const source = (cardOrKey && typeof cardOrKey === "object")
          ? { ...cardOrKey, upgradeLevel: resourceLevel }
          : { key, upgradeLevel: resourceLevel };
        try { byLevel.set(resourceLevel, getCardBaseValues(source, resourceLevel)); }
        catch (e) { byLevel.set(resourceLevel, {}); }
      }
      const capped = byLevel.get(resourceLevel);
      if (typeof capped[field] === "number") values[field] = capped[field];
    });
    const postCap = getResourcePostCapValues(key, requestedLevel);
    Object.entries(postCap).forEach(([field, gain]) => {
      values[field] = (Number(values[field]) || 0) + gain;
    });
  }
  /* V0.9.51 庐养加成：把品阶加成加到"主数值"上。
   * 只加一项（按 damage > armor > heal > poison 优先级取首个正数字段），避免攻防双属性卡双吃。 */
  const nurture = (cardOrKey && typeof cardOrKey === "object") ? (Number(cardOrKey.guluNurture) || 0) : 0;
  if (nurture > 0 && values && typeof values === "object") {
    const primary = ["damage", "armor", "heal", "poison"].find((k) => typeof values[k] === "number" && values[k] > 0);
    if (primary) values[primary] += nurture;
  }
  return values;
}
function getCardTurnSignature(cardKey, level) {
  const values = getCardValues(
    { key: cardKey, upgradeLevel: level, guluCarriedTurn: true },
    level,
  );
  return JSON.stringify(
    Object.entries(values || {})
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}
function getResourceProgressionSummary(cardOrKey, forcedLevel = null) {
  const cardKey = typeof cardOrKey === "string" ? cardOrKey : cardOrKey?.key;
  const rule = RESOURCE_POST_CAP_PROGRESSION[cardKey];
  if (!rule) return "";
  const source = (cardOrKey && typeof cardOrKey === "object")
    ? { ...cardOrKey, key: cardKey }
    : { key: cardKey };
  const base = getCardBaseValues(
    { ...source, upgradeLevel: 0 },
    0,
  );
  const labels = {
    energy: "真元", draw: "抽牌", supportDraw: "辅助抽牌", cost: "降费",
    costReduction: "降费", fateGain: "命势", bloodGain: "血煞", scaleGain: "龙鳞",
    perPlayed: "每张追加", extendTurns: "续形", bloodMultiplier: "倍率",
  };
  const locked = Object.keys(base)
    .filter((field) => RESOURCE_LOCKED_FIELDS.includes(field))
    .map((field) => {
      let lastChange = 0;
      let previous = null;
      for (let turnLevel = 0; turnLevel <= 8; turnLevel += 1) {
        const resourceLevel = getResourceFieldLevel(cardKey, field, turnLevel);
        const values = getCardBaseValues(
          { ...source, upgradeLevel: resourceLevel },
          resourceLevel,
        );
        if (turnLevel > 0 && values[field] !== previous) lastChange = turnLevel;
        previous = values[field];
      }
      const cap = lastChange + 1;
      return `${labels[field] || field}${cap === 1 ? "基础值" : `${cap}转`}封顶`;
    });
  const current = forcedLevel === null
    ? getUpgradeLevel(source)
    : getUpgradeLevel({ ...source, upgradeLevel: forcedLevel });
  const maxLevel = getUpgradeLevel({ ...source, upgradeLevel: 8 });
  const next = Math.min(maxLevel, current + 1);
  const deltaText = current >= maxLevel
    ? ""
    : getRefineDeltaText(source, current, next);
  const reachedTurn = maxLevel >= 8 ? "九转" : `${maxLevel + 1}转`;
  const nextText = current >= maxLevel ? `已达${reachedTurn}` : `下一转：${deltaText || "暂无数值变化"}`;
  return `${locked.join("、")}；${rule.copy} ${nextText}`;
}
/* 这张卡升转到底能不能变强？——纯资源牌（锁定后各转数值完全一致）升转是白花钱，
 * 必须在花材料【之前】告诉玩家。九转鼎与局内炼蛊共用此判定。 */
/* 升一转到底变了什么——把数值差写成人话，供局内炼蛊选卡页与九转鼎共用。
 * 玩家反馈「局内炼蛊看不到下一转的数值」：此前选卡列表只写当前效果，
 * 下一转预览要选完才出现，等于盲选花材料。 */
const REFINE_DELTA_LABELS = Object.freeze({
  damage: "伤害", armor: "防御", heal: "疗愈", poison: "毒性",
  energy: "真元", draw: "抽牌", supportDraw: "辅助抽牌", cost: "真元消耗", costReduction: "降费",
  fateGain: "命势", bloodGain: "血煞", scaleGain: "龙鳞", extendTurns: "续形",
  selfDamage: "生命反噬", lifespanCost: "寿元消耗",
  empoweredDamage: "强化伤害", bloodMultiplier: "血煞倍率", armorBonus: "破甲加成",
  hurtArmor: "受损护甲", armorRemove: "蚀甲", nextTurnArmor: "伏甲", weaken: "衰老",
  lifeHeal: "寿元疗愈", fateBonus: "命势加成", conditionArmor: "条件护甲",
  poisonBonus: "毒伤加成", transformedBonus: "龙形加成", comboDamage: "连携伤害",
  perPlayed: "每张追加", enemyBreakDamage: "碎甲反击", enemyBreakDraw: "碎甲抽牌",
  guardedBonus: "持甲增伤", openingBonus: "先机增伤", enemyArmorBonus: "敌甲增护", lowHandArmor: "少牌增护",
  weakenedArmor: "衰老增护", corrodedPoison: "腐蚀增毒", poisonThreshold: "毒发门槛",
  discard: "弃牌", bloodCost: "血煞消耗", perBurn: "每次焚寿", lifeGain: "寿元恢复",
  scaleCost: "龙鳞消耗", shatter: "碎甲", perBoneArmor: "每枚骨铃增护",
  bloodCap: "血煞上限", perBlood: "每层耗煞增伤", perActualBurn: "每点实焚增伤",
  perBloodArmor: "每层血煞增护", poisonedBonus: "中毒增伤",
  ecologyBonus: "生态克制增伤", weakenCap: "衰老上限", perWeakenArmor: "每层衰老增护",
  armorScaleCap: "衰老计甲上限", ecologyArmorRemove: "生态蚀甲",
  attackMultiplier: "攻击倍率", healRate: "吸血比例", minHeal: "最低疗愈", utilityBonus: "辅助效果",
});
function getRefineDeltaText(cardOrKey, fromLevel, toLevel) {
  const key = typeof cardOrKey === "string" ? cardOrKey : cardOrKey?.key;
  if (!key || !CARD_LIBRARY[key]) return "";
  const src = (cardOrKey && typeof cardOrKey === "object") ? cardOrKey : { key };
  let a = null; let b = null;
  try {
    a = getCardValues({ ...src, upgradeLevel: fromLevel }, fromLevel);
    b = getCardValues({ ...src, upgradeLevel: toLevel }, toLevel);
  } catch (e) { return ""; }
  if (!a || !b) return "";
  const parts = [];
  Object.keys(b).forEach((f) => {
    if (typeof b[f] !== "number" || typeof a[f] !== "number" || b[f] === a[f]) return;
    const label = REFINE_DELTA_LABELS[f] || "效果变化";
    parts.push(`${label} ${a[f]} → ${b[f]}`);
  });
  return parts.join("；");
}

function getActionEconomyUpgradeRule(card) {
  if (!ACTION_ECONOMY_PROGRESSION[card?.key]) return "";
  const current = getUpgradeLevel(card);
  const maxLevel = getUpgradeLevel({ ...card, upgradeLevel: 8 });
  if (current >= maxLevel) return `已达${maxLevel + 1}转，当前数值由统一曲线实时生成。`;
  const next = Math.min(maxLevel, current + 1);
  return `下一转：${getRefineDeltaText(card, current, next) || "定位强化"}`;
}
function cardGainsFromRefine(cardOrKey) {
  const key = typeof cardOrKey === "string" ? cardOrKey : cardOrKey?.key;
  if (!key || !CARD_LIBRARY[key]) return true;
  try {
    const a = getCardValues({ key, upgradeLevel: 0, guluCarriedTurn: true }, 0);
    const b = getCardValues({ key, upgradeLevel: 8, guluCarriedTurn: true }, 8);
    return Object.keys(b || {}).some((f) => typeof b[f] === "number" && typeof a[f] === "number" && b[f] !== a[f]);
  } catch (e) { return true; }
}

function getCardBaseValues(cardOrKey, forcedLevel = null) {
  const key = typeof cardOrKey === "string" ? cardOrKey : cardOrKey.key;
  /* V0.9.55 修：forcedLevel 分支此前只传 upgradeLevel，把来源卡的上限标记（guluUpgradeCap /
   * guluCarriedTurn）丢掉了，于是任何「按指定转数预览」都被硬夹在三转——
   * 九转鼎的升转阶梯因此从三转起一路平着不动。上限语义必须随来源一起带过去。 */
  const level = forcedLevel === null ? getUpgradeLevel(cardOrKey) : getUpgradeLevel({
    upgradeLevel: forcedLevel,
    guluUpgradeCap: (cardOrKey && typeof cardOrKey === "object") ? cardOrKey.guluUpgradeCap : undefined,
    guluCarriedTurn: (cardOrKey && typeof cardOrKey === "object") ? cardOrKey.guluCarriedTurn : undefined,
  });
  const mutationLevel = Math.max(1, level);
  const mutationBoost = Math.max(0, mutationLevel - 1);
  switch (key) {
    case "moonBlade": return { damage: 6 + level * 4 };
    case "ironSkin": return { armor: 7 + level * 4 };
    case "wineWorm": return { ...ACTION_ECONOMY_PROGRESSION.wineWorm[level] };
    case "bloodBlade": return { selfDamage: 3, damage: 13 + level * 4, bloodGain: 1 };
    case "burningEssence": return { selfDamage: 2, energy: 2 + level, draw: 1 };
    case "heartEater": return { damage: 12 + level * 4, empoweredDamage: 20 + level * 4 };
    case "bloodReversal": return { selfDamage: 4, damage: 16 + level * 4, bloodMultiplier: 2 + level, bloodGain: 1 };
    case "bloodTide": return { damage: 5 + level * 4, bloodMultiplier: 3 + level };
    case "lifeFlame": return { lifespanCost: 1, damage: 10 + level * 4 };
    case "witheredBloom": return { lifespanCost: 2, heal: 10 + level * 4 };
    case "essenceGathering": return { ...ACTION_ECONOMY_PROGRESSION.essenceGathering[level] };
    case "mysticCarapace": return { armor: 16 + level * 4 };
    case "returnLife": return { bloodCost: 3, heal: 16 + level * 5 };
    case "swarmBite": return { ...ACTION_ECONOMY_PROGRESSION.swarmBite[level] };
    case "meridianShift": return { selfDamage: 3, draw: 2 + level };
    case "armorBreaker": return { damage: 5 + level * 4, armorBonus: 6 + level * 2 };
    case "yuanReturn": return { energy: 1 + (level >= 1 ? 1 : 0), supportDraw: 1 };
    case "shellRemnant": return { armor: 6 + level * 4, hurtArmor: 6 + level * 2 };
    case "guFeeding": return { draw: 2 + level, discard: 1 };
    case "soulCrack": return { damage: 18 + level * 4, lifespanCost: 1 };
    case "burnLife": return { lifespanCost: 2, damage: 6 + level * 4, perBurn: 2 };
    case "erodeAge": return { damage: 8 + level * 4, lifeGain: 2 };
    case "focalLife": return { lifespanCost: Math.max(1, 3 - level), draw: level >= 2 ? 1 : 0 }; // 每级降 1 寿元消耗，+1 不再白强化
    case "mulberryField": return { lifespanCost: 1, weaken: 3 + level };
    case "prolongLife": return { lifeHeal: 6 + level * 2 };
    case "armorMeltPoison": return { damage: 3 + level * 2, poison: 3 + level, armorRemove: 5 + level * 2 };
    case "bloodRobe": return { selfDamage: 2, armor: 12 + level * 4, bloodGain: 1 + (level >= 2 ? 1 : 0) };
    case "lifeLamp": return { fateGain: 1 + (level >= 2 ? 1 : 0), heal: 4 + level * 2 };
    case "returnBreath": return { ...ACTION_ECONOMY_PROGRESSION.returnBreath[level] };
    case "longBreathGu": return { ...ACTION_ECONOMY_PROGRESSION.longBreathGu[level] };
    case "chainThunderGu": return { ...ACTION_ECONOMY_PROGRESSION.chainThunderGu[level] };
    case "calamityAshGu": return { ...ACTION_ECONOMY_PROGRESSION.calamityAshGu[level] };
    case "redTideGu": return { ...ACTION_ECONOMY_PROGRESSION.redTideGu[level] };
    case "lifePyreScorpion": return { ...ACTION_ECONOMY_PROGRESSION.lifePyreScorpion[level] };
    case "vicissitudeTurtle": return { ...ACTION_ECONOMY_PROGRESSION.vicissitudeTurtle[level] };
    case "ashBreathMayfly": return { ...ACTION_ECONOMY_PROGRESSION.ashBreathMayfly[level] };
    case "returnThunderDragonfly": return { ...ACTION_ECONOMY_PROGRESSION.returnThunderDragonfly[level] };
    case "redTideBladeLeech": return { ...ACTION_ECONOMY_PROGRESSION.redTideBladeLeech[level] };
    case "lifePyreSandScorpion": return { ...ACTION_ECONOMY_PROGRESSION.lifePyreSandScorpion[level] };
    case "witheredMulberryTurtle": return { ...ACTION_ECONOMY_PROGRESSION.witheredMulberryTurtle[level] };
    case "hiddenMeridian": return { armor: 5 + level * 2, nextTurnArmor: 5 + level * 2 };
    case "thunderGuide": return { damage: 8 + (level >= 1 ? 3 : 0), comboDamage: 4 + (level >= 2 ? 2 : 0) };
    case "apertureGuard": return { armor: 10 + level * 4 };
    case "emberRemnant": return { draw: 2 + (level >= 2 ? 1 : 0), discard: 1, armor: 5 + (level >= 1 ? 3 : 0) };
    case "shadowBind": return { damage: 5 + level * 2, armor: 5 + level * 2 };
    case "borrowLife": return { selfDamage: Math.max(1, 2 - (level >= 1 ? 1 : 0)), energy: 1, draw: 1 };
    case "jadeFang": return { damage: 7 + level * 3, guardedBonus: 5 + level * 2 };
    case "hollowNeedle": return { damage: 6 + level * 3, openingBonus: 7 + level * 2 };
    case "coiledShell": return { armor: 7 + level * 3, lowHandArmor: 5 + level * 2 };
    case "mirrorCarapace": return { armor: 8 + level * 3, enemyArmorBonus: 4 + level * 2 };
    case "breathCicada": return { armor: 3 + level * 2, energy: 1, draw: 1 };
    case "yuanVessel": return { armor: 5 + level * 3, energy: 1 };
    case "rustMite": return { armorRemove: 6 + level * 2, poison: 2 + level, corrodedPoison: 2 };
    case "silenceMoth": return { weaken: 1, armor: 4 + level * 3, weakenedArmor: 4 + level * 2 };
    case "jadeMirrorFang": return { damage: 12 + level * 4, armor: 10 + level * 3, guardedBonus: 6 + level * 2, enemyArmorBonus: 6 + level * 2 };
    case "coiledNeedleShell": return { damage: 10 + level * 3, armor: 8 + level * 3, openingBonus: 8 + level * 2, lowHandArmor: 6 + level * 2 };
    case "vesselBreathCicada": return { armor: 9 + level * 4, energy: 1, draw: 1 };
    case "rustSilenceMoth": return { armorRemove: 8 + level * 2, poison: 4 + level, corrodedPoison: 2, weaken: 1, armor: 8 + level * 3, weakenedArmor: 5 };
    case "fateThread": return { damage: 8 + level * 4, fateBonus: 6 + level * 2 };
    case "reversePath": return { armor: 3 + level * 3, fateGain: 1 + (level >= 2 ? 1 : 0) };
    case "fixedFate": return { armor: 9 + level * 4, conditionArmor: 3 + level * 2 };
    case "bloodSacrifice": return { selfDamage: 3, bloodGain: 2 + (level >= 2 ? 1 : 0), draw: 1 + (level >= 1 ? 1 : 0) };
    case "bloodThirst": return { damage: 7 + level * 4, bloodMultiplier: 1 + (level >= 2 ? 1 : 0), heal: 4 + level };
    case "greenMiasma": return { poison: 4 + level * 2 };
    case "insectSwarm": return { damage: 4 + level * 2, poison: 4 + level };
    case "moltingShell": return { armor: 8 + level * 4, draw: 1 + (level >= 2 ? 1 : 0) };
    case "poisonReturn": return { damage: 6 + level * 3, poisonBonus: 8 + level * 3, poisonThreshold: 8 };
    case "scaleHiding": return { armor: 8 + level * 4, scaleGain: 1 };
    case "reverseScale": return { selfDamage: 2, damage: 9 + level * 4, scaleGain: 2 };
    case "chiBreath": return { damage: 14 + level * 4, transformedBonus: 8 + level * 2 };
    case "boneMolt": return { scaleCost: 2, draw: 2, armor: 6 + level * 3 };
    case "cloudHorn": return { scaleGain: 1 + level, extendTurns: 1 }; // 每级 +1 龙鳞，+1 不再白强化
    case "bloodMoon": return { selfDamage: 2, damage: 12 + mutationBoost * 4, bloodMultiplier: 1 };
    case "moltedArmor": return { armor: 9 + mutationBoost * 4, draw: 1 };
    case "rotMiasma": return { poison: 6 + mutationBoost * 2, forceCorrosion: true };
    case "fateSever": return { fateGain: 1, draw: 1, lifespanCost: 1, energy: level >= 1 ? 1 : 0 };
    case "leechBlade": return { selfDamage: 4, damage: 15 + mutationBoost * 4, healRate: 0.2, minHeal: 4 };
    case "drunkFateWorm": return { draw: level >= 1 ? 2 : 1 };
    case "soulBurn": return { selfDamage: 3, energy: 2 + (level >= 1 ? 1 : 0), costReduction: 1 };
    case "resonantCarapace": return { shatter: 4, armor: 10 + level * 3, enemyBreakDamage: 6 + level * 3, enemyBreakDraw: 1 };
    case "emberArmorPiercer": return { damage: 5 + level * 3, armorBonus: 6 + level * 2, draw: 2, discard: 1, armor: 5 + level * 2 };
    case "woundedArmorFang": return { damage: 5 + level * 3, armorBonus: 6 + level * 2, armor: 6 + level * 3, hurtArmor: 6 + level * 2 };
    case "chimingJointBreaker": return { shatter: 8, damage: 5 + level * 3, armor: 6 + level * 3, weaken: 1 + (level >= 2 ? 1 : 0) };
    case "thunderBoneCourt": return { damage: 8 + level * 3, comboDamage: 4 + (level >= 2 ? 2 : 0), armor: 5 + level * 3, perBoneArmor: 2 };
    case "hiddenThunderMeridian": return { damage: 8 + level * 3, comboDamage: 4 + (level >= 2 ? 2 : 0), armor: 5 + level * 2, nextTurnArmor: 5 + level * 2 };
    case "bloodSwarmBlade": return { selfDamage: 3, damage: 9 + level * 4, bloodMultiplier: 1, bloodGain: 1, perPlayed: 2 + level };
    case "borrowedBloodRobe": return { selfDamage: 2, armor: 10 + level * 4, bloodGain: 1 + (level >= 2 ? 1 : 0), energy: 1, draw: 1 + (level >= 1 ? 1 : 0) };
    case "meridianBloodRobe": return { selfDamage: 3, armor: 10 + level * 4, bloodGain: 1 + (level >= 2 ? 1 : 0), draw: 2 + level };
    case "heartLeech": return { damage: 7 + level * 4, bloodMultiplier: 1 + (level >= 2 ? 1 : 0), empoweredDamage: 8 + level * 2, heal: 4 + level };
    case "tideReturningBlood": return { damage: 5 + level * 4, bloodMultiplier: 3 + level, bloodCost: 3, heal: 12 + level * 4 };
    case "lastLightHeart": return { lifespanCost: Math.max(1, 3 - level), attackMultiplier: 2, damage: 12 + level * 4, empoweredDamage: 20 + level * 4, draw: level >= 2 ? 1 : 0 };
    case "venomArmorEcho": return { damage: 4 + level * 3, poison: 3 + level, armorRemove: 5 + level * 2, poisonBonus: 8 + level * 3, poisonThreshold: 8 };
    case "miasmaShadowCarapace": return { damage: 5 + level * 3, armor: 5 + level * 3, poison: 4 + level };
    case "pyreBloom": return { lifespanCost: 2, damage: 6 + level * 4, perBurn: 2, heal: 10 + level * 4 };
    case "essenceSoulRend": return { selfDamage: 2, lifespanCost: 1, energy: 2 + level, draw: 1, damage: 18 + level * 4 };
    case "aeonLeech": return { damage: 8 + level * 4, lifeHeal: 6 + level * 2 };
    case "fatedMoonGuard": return { damage: 6 + level * 3, armor: 9 + level * 3, conditionArmor: 3 + level * 2 };
    case "apertureCurrentGuard": return { armor: 10 + level * 3, energy: 1, supportDraw: 1 };
    case "mysticEssenceCarapace": return { energy: 2 + level, draw: 1, armor: 14 + level * 4 };
    case "dragonMoltBreath": return { scaleCost: 2, draw: 2, armor: 6 + level * 4, damage: 14 + level * 4, transformedBonus: 8 + level * 2 };
    case "circulatingScaleMolt": return { scaleCost: 2, draw: 2, armor: 8 + level * 4, scaleGain: 1 };
    case "stormReverseHorn": return { selfDamage: 2, damage: 9 + level * 4, scaleGain: 2, extendTurns: 1 };
    case "venomMoltCarapace": return { armor: 10 + level * 4, draw: 1 };
    case "sacrificialMarshRobe": return { selfDamage: 3, bloodGain: 2, armor: 5 + level * 3, bloodCap: 2, perBloodArmor: 5, draw: 1 };
    case "mutantBlade": return { selfDamage: 2, damage: 14 + mutationBoost * 4 };
    case "mutantArmor": return { armor: 14 + mutationBoost * 4, discard: 1 };
    case "mutantPoison": return { selfDamage: 2, poison: 9 + mutationBoost * 2 };
    case "mutantFate": return { energy: 2, draw: 1 + (level >= 1 ? 1 : 0), lifespanCost: 1 };
    case "boneBell": return { armor: 6 + level * 3, weaken: 1 + (level >= 2 ? 1 : 0) };
    case "knockArmor": return { shatter: 4, armor: 10 + level * 3 };
    case "breakJoint": return { shatter: 8, damage: 5 + level * 3 };
    case "afterEcho": return { damage: 6 + level * 3, draw: 1 };
    case "boneCourt": return { armor: 5 + level * 3, perBoneArmor: 2 };
    case "chaosBee": return { damage: 6 + level * 2, poison: 3 + level, poisonedBonus: 2 };
    case "bloodMarshGu": return { armor: 4 + level * 3, bloodCap: 2, perBloodArmor: 5, draw: 1 };
    default: {
      const definition = CARD_LIBRARY[key] || {};
      if (definition.category === "defense") return { armor: 4 * level };
      if (definition.category === "attack") return { damage: 4 * level };
      return { utilityBonus: level };
    }
  }
}

function getCardEffect(cardOrKey, upgradeLevel = 0) {
  const key = typeof cardOrKey === "string" ? cardOrKey : cardOrKey?.key;
  const v = getCardValues(cardOrKey, upgradeLevel);
  switch (key) {
    case "moonBlade": return `对敌人造成 <em>${v.damage}</em> 点伤害`;
    case "ironSkin": return `获得 <em>${v.armor}</em> 点防御`;
    case "wineWorm": {
      const drawText = v.draw > 0 ? `，并抽 <em>${v.draw}</em> 张牌` : "";
      const flatText = v.damage > 0 ? `，下一击额外 +<em>${v.damage}</em> 伤害` : "";
      return `获得 <em>1</em> 层酒意（倍率依次 ×2／×2.5／×3，攻击后清空）${flatText}${drawText}`;
    }
    case "bloodBlade": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage} + 当前血煞</em> 点伤害，获得 <em>${v.bloodGain}</em> 层血煞`;
    case "burningEssence": return `获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌，失去 <em>${v.selfDamage}</em> 点生命`;
    case "heartEater": return `造成 <em>${v.damage}</em> 点伤害；血煞不少于 2 层时改为 <em>${v.empoweredDamage}</em>`;
    case "bloodReversal": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage} + 血煞×${v.bloodMultiplier}</em> 点伤害，获得 <em>${v.bloodGain}</em> 层血煞`;
    case "bloodTide": return `造成 <em>${v.damage} + 血煞×${v.bloodMultiplier}</em> 点伤害`;
    case "lifeFlame": return `消耗 <em>${v.lifespanCost}</em> 寿元，造成 <em>${v.damage}</em> 点伤害`;
    case "witheredBloom": return `消耗 <em>${v.lifespanCost}</em> 寿元，恢复 <em>${v.heal}</em> 点生命`;
    case "essenceGathering": return `获得 <em>${v.energy}</em> 点真元${v.armor > 0 ? `与 <em>${v.armor}</em> 点防御` : ""}${v.draw > 0 ? `，抽 <em>${v.draw}</em> 张牌` : ""}${v.firstPerTurnDraw > 0 ? `；本回合首次使用再抽 <em>${v.firstPerTurnDraw}</em> 张` : ""}`;
    case "mysticCarapace": return `获得 <em>${v.armor}</em> 点防御`;
    case "returnLife": return `消耗 <em>${v.bloodCost}</em> 层血煞，恢复 <em>${v.heal}</em> 点生命`;
    case "swarmBite": return `造成 <em>${v.damage}</em> 点伤害；本回合此前每出 1 张牌，追加 <em>${v.perPlayed}</em>，最多计 <em>${v.perPlayedCap}</em> 张`;
    case "meridianShift": return `失去 <em>${v.selfDamage}</em> 点生命，抽 <em>${v.draw}</em> 张牌`;
    case "armorBreaker": return `造成 <em>${v.damage}</em> 点伤害；若敌人有防御，额外造成 <em>${v.armorBonus}</em> 点伤害`;
    case "yuanReturn": return `获得 <em>${v.energy}</em> 点真元；本回合下一张辅助蛊抽 <em>${v.supportDraw}</em> 张牌`;
    case "shellRemnant": return `获得 <em>${v.armor}</em> 点防御；若本回合已受伤，额外获得 <em>${v.hurtArmor}</em> 点防御`;
    case "guFeeding": return `抽 <em>${v.draw}</em> 张牌，然后弃 <em>${v.discard}</em> 张牌`;
    case "soulCrack": return `造成 <em>${v.damage}</em> 点伤害；失去 <em>${v.lifespanCost}</em> 点寿元`;
    case "burnLife": return `消耗 <em>${v.lifespanCost}</em> 寿元，造成 <em>${v.damage}</em> 点伤害；本场每焚去 1 点寿元额外 <em>+${v.perBurn}</em>（含本次）`;
    case "erodeAge": return `造成 <em>${v.damage}</em> 点伤害，并夺回 <em>${v.lifeGain}</em> 点寿元（不超过上限）`;
    case "focalLife": return `消耗 <em>${v.lifespanCost}</em> 寿元，本回合攻击蛊伤害<em>翻倍</em>${v.draw > 0 ? `，并抽 <em>${v.draw}</em> 张牌` : ""}`;
    case "mulberryField": return `消耗 <em>${v.lifespanCost}</em> 寿元，使敌人<em>衰老 ${v.weaken}</em>（攻击意图永久 -${v.weaken}，可叠加）`;
    case "prolongLife": return `恢复 <em>${v.lifeHeal}</em> 点寿元（不超过上限）`;
    case "armorMeltPoison": return `造成 <em>${v.damage}</em> 点伤害，施加 <em>${v.poison}</em> 层毒性；若敌人有防御，移除其 <em>${v.armorRemove}</em> 点防御`;
    case "bloodRobe": return `失去 <em>${v.selfDamage}</em> 点生命，获得 <em>${v.armor}</em> 点防御，并获得 <em>${v.bloodGain}</em> 层血煞`;
    case "lifeLamp": return `若出牌前命势已满，恢复 <em>${v.heal}</em> 点生命；否则获得 <em>${v.fateGain}</em> 层命势`;
    case "returnBreath": return `抽 <em>${v.draw}</em> 张牌${v.discard > 0 ? `，随机弃 <em>${v.discard}</em> 张` : ""}${v.armor > 0 ? `，获得 <em>${v.armor}</em> 点防御` : ""}${v.firstPerTurnDraw > 0 ? `；本回合首次使用再抽 <em>${v.firstPerTurnDraw}</em> 张` : ""}`;
    case "longBreathGu": return `抽 <em>${v.draw}</em> 张牌${v.discard > 0 ? `，主动弃 <em>${v.discard}</em> 张` : ""}${v.armor > 0 ? `，获得 <em>${v.armor}</em> 点防御` : ""}；本场消耗`;
    case "chainThunderGu": return `造成 <em>${v.damage}</em> 点伤害；本回合之后每次切换出牌类别，再造成 <em>${v.sequenceDamage}</em> 点伤害，最多 <em>${v.sequenceCap}</em> 次`;
    case "calamityAshGu": return `本回合每主动弃牌或消耗另一张牌，积 1 灰；回合末每灰造成 <em>${v.ashDamage}</em> 点伤害，最多 <em>${v.ashCap}</em> 灰${v.fullArmor > 0 ? `，积满获得 <em>${v.fullArmor}</em> 点防御` : ""}；本场消耗`;
    case "redTideGu": return `至少需要 <em>${v.bloodCost}</em> 层血煞；吞下至多 <em>${v.bloodCap}</em> 层，造成 <em>${v.damage} + 实际耗煞×${v.perBlood}</em> 点伤害；对「血食」敌人本回合首次额外 <em>+${v.ecologyBonus}</em>`;
    case "lifePyreScorpion": return `焚去 <em>${v.lifespanCost}</em> 寿元，造成 <em>${v.damage} + 实际焚寿×${v.perActualBurn}</em> 点伤害；对「腐生」敌人本回合首次额外 <em>+${v.ecologyBonus}</em>`;
    case "vicissitudeTurtle": return `使敌人衰老 <em>${v.weaken}</em>（本卡最多叠至 ${v.weakenCap}；尸傀免疫），获得 <em>${v.armor} + 衰老×${v.perWeakenArmor}</em> 点防御（最多计 ${v.armorScaleCap} 层）；对「甲壳」敌人本回合首次蚀甲 <em>${v.ecologyArmorRemove}</em>`;
    case "ashBreathMayfly": return `布下劫灰后抽 <em>${v.draw}</em> 张牌${v.discard > 0 ? `，主动弃 <em>${v.discard}</em> 张` : ""}；每次主动弃牌或消耗另一张牌积 1 灰，回合末每灰造成 <em>${v.ashDamage}</em> 点伤害，最多 <em>${v.ashCap}</em> 灰${v.fullArmor > 0 ? `，积满获得 <em>${v.fullArmor}</em> 点防御` : ""}；自身化灰计 1，本场消耗`;
    case "returnThunderDragonfly": return `造成 <em>${v.damage}</em> 点伤害；之后每次切换出牌类别，再造成 <em>${v.sequenceDamage}</em> 点伤害，最多 <em>${v.sequenceCap}</em> 次；抽 <em>${v.draw}</em> 张牌${v.discard > 0 ? `，随机弃 <em>${v.discard}</em> 张` : ""}${v.armor > 0 ? `，获得 <em>${v.armor}</em> 点防御` : ""}`;
    case "redTideBladeLeech": return `至少需要 <em>${v.bloodCost}</em> 层旧血煞；先吞下至多 <em>${v.bloodCap}</em> 层，造成 <em>${v.damage} + 实际耗煞×${v.perBlood}</em> 点伤害，再失去 <em>${v.selfDamage}</em> 点生命并获得 <em>${v.bloodGain}</em> 层新血煞；对「血食」敌人本回合首次额外 <em>+${v.ecologyBonus}</em>`;
    case "lifePyreSandScorpion": return `焚去 <em>${v.lifespanCost}</em> 寿元，造成 <em>${v.damage} + 实际焚寿×${v.perActualBurn} + 本场焚寿×${v.perBattleBurn}</em> 点伤害；对「腐生」敌人本回合首次额外 <em>+${v.ecologyBonus}</em>`;
    case "witheredMulberryTurtle": return `焚去 <em>${v.lifespanCost}</em> 寿元，使敌人衰老 <em>${v.weaken}</em>（最多叠至 ${v.weakenCap}；尸傀免疫），获得 <em>${v.armor} + 衰老×${v.perWeakenArmor}</em> 点防御（最多计 ${v.armorScaleCap} 层）；对「甲壳」敌人本回合首次蚀甲 <em>${v.ecologyArmorRemove}</em>`;
    case "hiddenMeridian": return `获得 <em>${v.armor}</em> 点防御；下回合开始时再获得 <em>${v.nextTurnArmor}</em> 点防御`;
    case "thunderGuide": return `造成 <em>${v.damage}</em> 点伤害；本回合此前打出过牌时，额外造成 <em>${v.comboDamage}</em> 点伤害`;
    case "apertureGuard": return `获得 <em>${v.armor}</em> 点防御`;
    case "emberRemnant": return `抽 <em>${v.draw}</em> 张牌，随机弃 <em>${v.discard}</em> 张；若成功弃牌，获得 <em>${v.armor}</em> 点防御`;
    case "shadowBind": return `造成 <em>${v.damage}</em> 点伤害并获得 <em>${v.armor}</em> 点防御`;
    case "borrowLife": return `失去 <em>${v.selfDamage}</em> 点生命，获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌；不会令你死亡`;
    case "jadeFang": return `造成 <em>${v.damage}</em> 点伤害；你有防御时额外造成 <em>${v.guardedBonus}</em> 点`;
    case "hollowNeedle": return `造成 <em>${v.damage}</em> 点伤害；若是本回合第一张牌，额外造成 <em>${v.openingBonus}</em> 点`;
    case "coiledShell": return `获得 <em>${v.armor}</em> 点防御；出牌后手牌不多于 3 张时额外获得 <em>${v.lowHandArmor}</em> 点`;
    case "mirrorCarapace": return `获得 <em>${v.armor}</em> 点防御；敌人有防御时额外获得 <em>${v.enemyArmorBonus}</em> 点`;
    case "breathCicada": return `获得 <em>${v.armor}</em> 点防御；若是本回合第一张牌，获得 <em>${v.energy}</em> 点真元，否则抽 <em>${v.draw}</em> 张牌`;
    case "yuanVessel": return `获得 <em>${v.energy}</em> 点真元与 <em>${v.armor}</em> 点防御`;
    case "rustMite": return `移除敌人 <em>${v.armorRemove}</em> 点防御并施加 <em>${v.poison}</em> 层毒性；成功蚀甲时再施加 <em>${v.corrodedPoison}</em> 层`;
    case "silenceMoth": return `使敌人衰老 <em>${v.weaken}</em>，获得 <em>${v.armor}</em> 点防御；敌人已有衰老时额外获得 <em>${v.weakenedArmor}</em> 点`;
    case "jadeMirrorFang": return `造成 <em>${v.damage}</em> 点伤害并获得 <em>${v.armor}</em> 点防御；你有防御时伤害 +<em>${v.guardedBonus}</em>，敌人有防御时护甲 +<em>${v.enemyArmorBonus}</em>`;
    case "coiledNeedleShell": return `造成 <em>${v.damage}</em> 点伤害并获得 <em>${v.armor}</em> 点防御；首张伤害 +<em>${v.openingBonus}</em>，出牌后手牌不多于 3 张时护甲 +<em>${v.lowHandArmor}</em>`;
    case "vesselBreathCicada": return `获得 <em>${v.energy}</em> 点真元与 <em>${v.armor}</em> 点防御；若不是本回合第一张牌，再抽 <em>${v.draw}</em> 张牌`;
    case "rustSilenceMoth": return `移除敌人 <em>${v.armorRemove}</em> 点防御，施加 <em>${v.poison}</em> 层毒性与 <em>${v.weaken}</em> 层衰老，并获得 <em>${v.armor}</em> 点防御；成功蚀甲再施毒 <em>${v.corrodedPoison}</em>，已有衰老时护甲 +<em>${v.weakenedArmor}</em>`;
    case "fateThread": return `造成 <em>${v.damage}</em> 点伤害；若命势不少于 <em>2</em> 层，额外造成 <em>${v.fateBonus}</em> 点伤害`;
    case "reversePath": return `获得 <em>${v.armor}</em> 点防御，并获得 <em>${v.fateGain}</em> 层命势`;
    case "fixedFate": return `获得 <em>${v.armor}</em> 点防御；若本回合上一张牌不是护甲蛊，额外获得 <em>${v.conditionArmor}</em> 点防御`;
    case "bloodSacrifice": return `失去 <em>${v.selfDamage}</em> 点生命，获得 <em>${v.bloodGain}</em> 层血煞，抽 <em>${v.draw}</em> 张牌`;
    case "bloodThirst": return `造成 <em>${v.damage} + 当前血煞${v.bloodMultiplier > 1 ? `×${v.bloodMultiplier}` : ""}</em> 点伤害；恢复 <em>${v.heal}</em> 点生命`;
    case "greenMiasma": return `施加 <em>${v.poison}</em> 层毒性`;
    case "insectSwarm": return `造成 <em>${v.damage}</em> 点伤害，并施加 <em>${v.poison}</em> 层毒性`;
    case "moltingShell": return `获得 <em>${v.armor}</em> 点防御；若敌人已中毒，抽 <em>${v.draw}</em> 张牌`;
    case "poisonReturn": return `造成 <em>${v.damage}</em> 点伤害；若敌人中毒不少于 <em>${v.poisonThreshold}</em> 层，额外造成 <em>${v.poisonBonus}</em> 点伤害`;
    case "scaleHiding": return `获得 <em>${v.armor}</em> 点防御，并获得 <em>${v.scaleGain}</em> 枚龙鳞`;
    case "reverseScale": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害，并获得 <em>${v.scaleGain}</em> 枚龙鳞`;
    case "chiBreath": return `造成 <em>${v.damage}</em> 点伤害；龙化期间额外造成 <em>${v.transformedBonus}</em> 点伤害`;
    case "boneMolt": return `消耗 <em>${v.scaleCost}</em> 枚龙鳞，抽 <em>${v.draw}</em> 张牌并获得 <em>${v.armor}</em> 点防御（龙化期间免龙鳞消耗，直接抽牌获甲）`;
    case "cloudHorn": return `获得 <em>${v.scaleGain}</em> 枚龙鳞；龙化期间改为延长 <em>${v.extendTurns}</em> 回合（每次龙化限一次）`;
    case "bloodMoon": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害；若拥有血煞，额外造成当前血煞层数的伤害`;
    case "moltedArmor": return `获得 <em>${v.armor}</em> 点防御；若本回合未受伤，抽 <em>${v.draw}</em> 张牌`;
    case "rotMiasma": return `施加 <em>${v.poison}</em> 层毒性；若敌人已经中毒，额外触发一次蚀毒`;
    case "fateSever": return `获得 <em>${v.fateGain}</em> 层命势，抽 <em>${v.draw}</em> 张牌${v.energy ? `，获得 <em>${v.energy}</em> 点真元` : ""}；失去 <em>${v.lifespanCost}</em> 点寿元`;
    case "leechBlade": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害；恢复造成伤害的 20% 生命，至少恢复 <em>${v.minHeal}</em> 点`;
    case "drunkFateWorm": return `下一张攻击蛊伤害翻倍；若本回合已获得命势，抽 <em>${v.draw}</em> 张牌`;
    case "soulBurn": return `获得 <em>${v.energy}</em> 点真元，失去 <em>${v.selfDamage}</em> 点生命；本回合下一张蛊牌消耗 -<em>${v.costReduction}</em>，最低为 0`;
    case "resonantCarapace": return `主动碎去至多 <em>${v.shatter}</em> 点防御，再获得 <em>${v.armor}</em> 点防御；本回合敌人首次击碎防御时，反击 <em>${v.enemyBreakDamage}</em> 点并抽 <em>${v.enemyBreakDraw}</em> 张牌`;
    case "emberArmorPiercer": return `造成 <em>${v.damage}</em> 点伤害；敌人有防御时额外造成 <em>${v.armorBonus}</em> 点。抽 <em>${v.draw}</em> 张并弃 <em>${v.discard}</em> 张，成功弃牌则获得 <em>${v.armor}</em> 点防御`;
    case "woundedArmorFang": return `造成 <em>${v.damage}</em> 点伤害；敌人有防御时额外造成 <em>${v.armorBonus}</em> 点。获得 <em>${v.armor}</em> 点防御，本回合已受伤则再获得 <em>${v.hurtArmor}</em> 点`;
    case "chimingJointBreaker": return `主动碎去至多 <em>${v.shatter}</em> 点防御，造成 <em>${v.damage} + 实际碎甲</em> 点伤害；再获得 <em>${v.armor}</em> 点防御并使敌人衰老 <em>${v.weaken}</em>`;
    case "thunderBoneCourt": return `造成 <em>${v.damage}</em> 点伤害，本回合此前打出过牌时额外造成 <em>${v.comboDamage}</em> 点；获得 <em>${v.armor} + 骨鸣×${v.perBoneArmor}</em> 点防御`;
    case "hiddenThunderMeridian": return `造成 <em>${v.damage}</em> 点伤害，本回合此前打出过牌时额外造成 <em>${v.comboDamage}</em> 点；获得 <em>${v.armor}</em> 点防御，下回合再获得 <em>${v.nextTurnArmor}</em> 点`;
    case "bloodSwarmBlade": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage} + 当前血煞×${v.bloodMultiplier} + 此前出牌×${v.perPlayed}</em> 点伤害，并获得 <em>${v.bloodGain}</em> 层血煞`;
    case "borrowedBloodRobe": return `失去 <em>${v.selfDamage}</em> 点生命，获得 <em>${v.armor}</em> 点防御与 <em>${v.bloodGain}</em> 层血煞，再获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌`;
    case "meridianBloodRobe": return `失去 <em>${v.selfDamage}</em> 点生命，获得 <em>${v.armor}</em> 点防御与 <em>${v.bloodGain}</em> 层血煞，并抽 <em>${v.draw}</em> 张牌`;
    case "heartLeech": return `造成 <em>${v.damage} + 当前血煞×${v.bloodMultiplier}</em> 点伤害；血煞不少于 2 层时额外造成 <em>${v.empoweredDamage}</em> 点；恢复 <em>${v.heal}</em> 点生命`;
    case "tideReturningBlood": return `造成 <em>${v.damage} + 血煞×${v.bloodMultiplier}</em> 点伤害，随后消耗 <em>${v.bloodCost}</em> 层血煞并恢复 <em>${v.heal}</em> 点生命`;
    case "lastLightHeart": return `消耗 <em>${v.lifespanCost}</em> 寿元，本回合攻击蛊伤害×<em>${v.attackMultiplier}</em>；造成 <em>${v.damage}</em> 点伤害，血煞不少于 2 层时改为 <em>${v.empoweredDamage}</em>${v.draw > 0 ? `，并抽 <em>${v.draw}</em> 张牌` : ""}`;
    case "venomArmorEcho": return `移除敌人 <em>${v.armorRemove}</em> 点防御，造成 <em>${v.damage}</em> 点伤害；敌人毒性不少于 <em>${v.poisonThreshold}</em> 层时额外造成 <em>${v.poisonBonus}</em> 点，并施加 <em>${v.poison}</em> 层毒性`;
    case "miasmaShadowCarapace": return `造成 <em>${v.damage}</em> 点伤害，获得 <em>${v.armor}</em> 点防御，并施加 <em>${v.poison}</em> 层毒性`;
    case "pyreBloom": return `消耗 <em>${v.lifespanCost}</em> 寿元，造成 <em>${v.damage} + 本场焚寿×${v.perBurn}</em> 点伤害，并恢复 <em>${v.heal}</em> 点生命`;
    case "essenceSoulRend": return `失去 <em>${v.selfDamage}</em> 点生命与 <em>${v.lifespanCost}</em> 点寿元，获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌，造成 <em>${v.damage}</em> 点伤害`;
    case "aeonLeech": return `造成 <em>${v.damage}</em> 点伤害，并恢复 <em>${v.lifeHeal}</em> 点寿元（不超过上限）`;
    case "fatedMoonGuard": return `造成 <em>${v.damage}</em> 点伤害并获得 <em>${v.armor}</em> 点防御；本回合上一张牌不是护甲蛊时，额外获得 <em>${v.conditionArmor}</em> 点防御`;
    case "apertureCurrentGuard": return `获得 <em>${v.armor}</em> 点防御与 <em>${v.energy}</em> 点真元；本回合下一张辅助蛊抽 <em>${v.supportDraw}</em> 张牌`;
    case "mysticEssenceCarapace": return `获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌，再获得 <em>${v.armor}</em> 点防御`;
    case "dragonMoltBreath": return `消耗 <em>${v.scaleCost}</em> 枚未化形龙鳞，抽 <em>${v.draw}</em> 张牌并获得 <em>${v.armor}</em> 点防御，再造成 <em>${v.damage}</em> 点伤害；龙化期间免龙鳞消耗并额外造成 <em>${v.transformedBonus}</em> 点`;
    case "circulatingScaleMolt": return `消耗 <em>${v.scaleCost}</em> 枚未化形龙鳞，抽 <em>${v.draw}</em> 张牌、获得 <em>${v.armor}</em> 点防御并回生 <em>${v.scaleGain}</em> 枚龙鳞；龙化期间免龙鳞消耗`;
    case "stormReverseHorn": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害并获得 <em>${v.scaleGain}</em> 枚龙鳞；龙化期间改为延长 <em>${v.extendTurns}</em> 回合，每次龙化限一次`;
    case "venomMoltCarapace": return `获得 <em>${v.armor}</em> 点防御；若敌人已中毒，抽 <em>${v.draw}</em> 张牌`;
    case "sacrificialMarshRobe": return `先消耗至多 <em>${v.bloodCap}</em> 层已有血煞，获得 <em>${v.armor} + 每层×${v.perBloodArmor}</em> 点防御；消耗 ${v.bloodCap} 层血煞时抽 <em>${v.draw}</em> 张牌，随后失去 <em>${v.selfDamage}</em> 点生命并获得 <em>${v.bloodGain}</em> 层血煞`;
    case "mutantBlade": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害`;
    case "mutantArmor": return `获得 <em>${v.armor}</em> 点防御；弃 <em>${v.discard}</em> 张随机手牌`;
    case "mutantPoison": return `施加 <em>${v.poison}</em> 层毒性；你失去 <em>${v.selfDamage}</em> 点生命`;
    case "mutantFate": return `获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌；失去 <em>${v.lifespanCost}</em> 点寿元`;
    case "boneBell": return `获得 <em>${v.armor}</em> 点防御，使敌人<em>衰老 ${v.weaken}</em>（攻击意图永久 -${v.weaken}，可叠加）`;
    case "knockArmor": return `主动碎去至多 <em>${v.shatter}</em> 点防御，再获得 <em>${v.armor}</em> 点防御`;
    case "breakJoint": return `主动碎去至多 <em>${v.shatter}</em> 点防御，造成 <em>${v.damage} + 实际碎甲</em> 点伤害`;
    case "afterEcho": return `本回合敌人首次击碎你的防御时，反击 <em>${v.damage}</em> 点并抽 <em>${v.draw}</em> 张牌`;
    case "boneCourt": return `获得 <em>${v.armor} + 骨鸣×${v.perBoneArmor}</em> 点防御；不会因此直接获得骨鸣`;
    case "chaosBee": return `造成 <em>${v.damage}</em> 点伤害并施加 <em>${v.poison}</em> 层毒性；敌人已中毒时再施加 <em>${v.poisonedBonus}</em> 层`;
    case "bloodMarshGu": return `获得 <em>${v.armor}</em> 点防御；消耗至多 <em>${v.bloodCap}</em> 层血煞，每层再获得 <em>${v.perBloodArmor}</em> 点防御；消耗 ${v.bloodCap} 层时抽 <em>${v.draw}</em> 张牌`;
    default:
      return CARD_LIBRARY[key]?.effect || "未知蛊术效果";
  }
}

function createMapState({ seed = "", mode = trialMode, random = null } = {}) {
  const bossDefinition = getMingtuBossDefinition("act-outer-stairs", "outer");
  const routeRandom = typeof random === "function" ? random : createSeededRandom(seed || generateTrialSeed());
  const normalizedMode = normalizeTrialMode(mode);
  const firstPool = normalizedMode === "demo"
    ? ["bloodwolf", "shanxiao", ...NORMAL_ENEMY_IDS.filter((id) => id !== "bloodwolf" && id !== "shanxiao")]
    : NORMAL_ENEMY_IDS;
  const firstEnemies = shuffle(firstPool, routeRandom).slice(0, 2);
  if (normalizedMode === "demo" && !firstEnemies.some((id) => id === "bloodwolf" || id === "shanxiao")) {
    firstEnemies[0] = routeRandom() > 0.5 ? "bloodwolf" : "shanxiao";
  }
  const firstSegment = firstEnemies.map((enemyId, index) => ({
    id: `normal-${index + 1}`,
    step: 1,
    type: "battle",
    enemyId,
    icon: "兽",
    name: ENEMY_LIBRARY[enemyId].name,
    description: MAP_NODE_DESCRIPTIONS.battle,
  }));
  const secondBaseNodes = [
    { id: "chance-1", step: 2, type: "event", icon: "缘", name: "机缘", description: MAP_NODE_DESCRIPTIONS.event },
    { id: "shop-1", step: 2, type: "shop", icon: "坊", name: "蛊坊", description: MAP_NODE_DESCRIPTIONS.shop },
    { id: "elite-1", step: 2, type: "elite", enemyId: "bloodwolfElite", icon: "煞", name: "血纹狼王", description: MAP_NODE_DESCRIPTIONS.elite },
  ];
  const secondSegment = normalizedMode === "demo" ? secondBaseNodes : shuffle(secondBaseNodes, routeRandom);
  // V0.9.8.6：中段需更多普通敌（去掉首段已用），用于 seg3/seg5 战斗
  const midPool = shuffle(NORMAL_ENEMY_IDS.filter((enemyId) => !firstEnemies.includes(enemyId)), routeRandom);
  const seg3EnemyId = midPool[0] || "shanxiao";
  const seg5EnemyId = midPool[1] || midPool[0] || "bloodwolf";
  const restName4 = REST_NODE_NAMES[Math.floor(routeRandom() * REST_NODE_NAMES.length)] || "残灯小憩";
  const restName5 = REST_NODE_NAMES[Math.floor(routeRandom() * REST_NODE_NAMES.length)] || "塔隙养蛊";
  /* 段3（step3）：硬战 / 机缘 —— 中段多样性分岔 */
  const thirdSegment = shuffle([
    { id: "normal-3", step: 3, type: "battle", enemyId: seg3EnemyId, enemyHpMultiplier: 1.15,
      icon: "兽", name: ENEMY_LIBRARY[seg3EnemyId].name, description: "塔压渐沉，凶影更硬。" },
    { id: "chance-2", step: 3, type: "event", icon: "缘", name: "机缘", description: MAP_NODE_DESCRIPTIONS.event },
  ], routeRandom);
  /* 段4（step4）：蛊坊 / 休整 / 逆命 —— 安稳收益 vs 搏命三选一 */
  const fourthSegment = shuffle([
    { id: "shop-2", step: 4, type: "shop", icon: "坊", name: "蛊坊", description: MAP_NODE_DESCRIPTIONS.shop },
    { id: "rest-2", step: 4, type: "rest", icon: "息", name: restName4, description: MAP_NODE_DESCRIPTIONS.rest },
    { id: "defy-1", step: 4, type: "defy", enemyId: "bloodwolfElite", enemyHpMultiplier: 1.5,
      icon: "逆", name: "逆命搏杀", description: MAP_NODE_DESCRIPTIONS.defy },
  ], routeRandom);
  /* 段5（step REST_ROUTE_STEP=5）：临门分岔——再搏一场硬战 / 塔隙休整 */
  const fifthSegment = shuffle([
    { id: "normal-4", step: 5, type: "battle", enemyId: seg5EnemyId, enemyHpMultiplier: 1.2,
      icon: "兽", name: ENEMY_LIBRARY[seg5EnemyId].name, description: "临门凶兽，挡在塔阶。" },
    { id: "rest-1", step: 5, type: "rest", icon: "息", name: restName5, description: MAP_NODE_DESCRIPTIONS.rest },
  ], routeRandom);
  /* V0.9.51 段数 6→9：一层新增第 6/7/8 段。第 8 段沿用原「临门」定位（REST_ROUTE_STEP 已移到 8），
   * 新增段用本版新敌（石阶蛊隼/蚀碑石傀/缚魂藤妪/啖影犬），节点 id 全为新增，老 id 一个未动。 */
  const seg6EnemyId = sampleWithRunRandom(["stoneGuFalcon", "shadowHound"], 1, "route")[0] || "stoneGuFalcon";
  const sixthSegment = shuffle([
    { id: "normal-5", step: 6, type: "battle", enemyId: seg6EnemyId, enemyHpMultiplier: 1.1,
      icon: "兽", name: ENEMY_LIBRARY[seg6EnemyId].name, description: "石阶深处，凶影再起。" },
    { id: "chance-3", step: 6, type: "event", icon: "机", name: "命途机缘", description: MAP_NODE_DESCRIPTIONS.event },
  ], routeRandom);
  const seventhSegment = shuffle([
    { id: "shop-3", step: 7, type: "shop", icon: "坊", name: "蛊坊", description: MAP_NODE_DESCRIPTIONS.shop },
    { id: "elite-2", step: 7, type: "elite", enemyId: "steleGolem", enemyHpMultiplier: 1.25,
      icon: "煞", name: ENEMY_LIBRARY.steleGolem.name, description: MAP_NODE_DESCRIPTIONS.elite },
    { id: "rest-3", step: 7, type: "rest", icon: "息", name: restName4, description: MAP_NODE_DESCRIPTIONS.rest },
  ], routeRandom);
  const seg8EnemyId = sampleWithRunRandom(["vineCrone", "shadowHound"], 1, "route")[0] || "vineCrone";
  const eighthSegment = shuffle([
    { id: "normal-6", step: 8, type: "battle", enemyId: seg8EnemyId, enemyHpMultiplier: 1.2,
      icon: "兽", name: ENEMY_LIBRARY[seg8EnemyId].name, description: "临门凶兽，挡在塔阶。" },
    { id: "chance-4", step: 8, type: "event", icon: "机", name: "命途机缘", description: MAP_NODE_DESCRIPTIONS.event },
  ], routeRandom);
  /* 现有一区末段 Boss；身份与旧节点映射由章节数据声明。 */
  const bossSegment = [{
    id: bossDefinition.legacyNodeIds[0],
    step: bossDefinition.legacyStep,
    type: "boss",
    enemyId: bossDefinition.enemyId,
    icon: "盘",
    name: "尸盘监守",
    description: MAP_NODE_DESCRIPTIONS.boss,
  }];
  return {
    segments: [firstSegment, secondSegment, thirdSegment, fourthSegment, fifthSegment, sixthSegment, seventhSegment, eighthSegment, bossSegment],
  };
}

function getAllMapNodes() {
  return runState?.mapState?.segments?.flat() || [];
}

function getMapNodeById(id) {
  return getAllMapNodes().find((node) => node.id === id) || null;
}

function getCurrentMapSegmentNodes() {
  // V0.9.51 无尽不走章节体系，层内步进用自有 endlessStep。
  if (runState?.mode === "endless") return getEndlessSegmentNodes(runState);
  return runState?.mapState?.segments?.[Math.max(0, getCurrentRouteStep() - 1)] || [];
}

// V0.9.36 BGM 冷加载再治理：把「下一层 BGM 预热」提前整整一层。
// 旧法只在「进该层地图」时预热，只有数秒窗口，慢网/手机常来不及下完 3~6MB → 进战仍卡。
// 新法用「当前层的数分钟游戏时长」当下载窗口：一层期间就把二层两条路线 BGM 预热好、二层期间预热三层+结算，
// 到达时已在浏览器缓存里、秒起播。纯提前预热、不改音质；两条路线都预热（不知玩家会选哪条，多下的那条也进 SW 缓存、利于后续局）。
// 小错峰（setTimeout）让当前层要用的曲子先下完，再在后台补下一层。
let __bgmWarmedLayer2 = false, __bgmWarmedLayer3 = false;
function warmLayerBgmAhead(nextLayer) {
  const AM = window.AudioManager;
  if (!AM || typeof AM.warmScene !== "function") return;
  if (nextLayer === 2 && !__bgmWarmedLayer2) {
    __bgmWarmedLayer2 = true;
    window.setTimeout(() => { try { AM.warmScene("layer2Miasma"); AM.warmScene("layer2Bloodmarsh"); } catch (e) { /* 忽略 */ } }, 8000); // 先让一层战斗曲下完
  } else if (nextLayer === 3 && !__bgmWarmedLayer3) {
    __bgmWarmedLayer3 = true;
    window.setTimeout(() => { try { AM.warmScene("layer3Bone"); AM.warmScene("layer3Beehive"); AM.warmScene("conclusion"); } catch (e) { /* 忽略 */ } }, 6000);
  }
}
const RUN_OUTCOME_POLICIES = Object.freeze({
  running: Object.freeze({ showConclusion: false, settleCarryover: false, deathMemory: false, materialRatio: 0, keepBossCores: false, keepCarriedGu: true, clearRewards: false }),
  dead: Object.freeze({ showConclusion: true, settleCarryover: true, deathMemory: true, materialRatio: 0.4, keepBossCores: false, keepCarriedGu: false, clearRewards: false }),
  withdrawn: Object.freeze({ showConclusion: true, settleCarryover: true, deathMemory: false, materialRatio: 1, keepBossCores: true, keepCarriedGu: true, clearRewards: false }),
  abandoned: Object.freeze({ showConclusion: false, settleCarryover: false, deathMemory: false, materialRatio: 0, keepBossCores: false, keepCarriedGu: true, clearRewards: false }),
  cleared: Object.freeze({ showConclusion: true, settleCarryover: true, deathMemory: false, materialRatio: 1, keepBossCores: true, keepCarriedGu: true, clearRewards: true }),
});

function normalizeRunOutcome(status) {
  if (status === "failed") return "dead";
  return typeof status === "string" && Object.prototype.hasOwnProperty.call(RUN_OUTCOME_POLICIES, status)
    ? status
    : null;
}

/* 续局/导入档的生命数值边界：JSON 会把运行时 NaN 落成 null，旧档或手工导入也可能带数值字符串。
 * 在 runState 进入地图/战斗前一次性收口，避免非有限值被回血、自损继续扩散。 */
function normalizeRunHealthState(run) {
  if (!run || typeof run !== "object") return run;
  const heroBaseHp = typeof HEROES !== "undefined" ? Number(HEROES[run.heroId]?.maxHp) : NaN;
  const rawMaxHp = Number(run.maxHp);
  const maxHp = Number.isFinite(rawMaxHp) && rawMaxHp >= 1
    ? Math.floor(rawMaxHp)
    : (Number.isFinite(heroBaseHp) && heroBaseHp >= 1 ? Math.floor(heroBaseHp) : 1);
  const rawCurrentHp = run.currentHp == null ? NaN : Number(run.currentHp);
  run.maxHp = maxHp;
  run.currentHp = Number.isFinite(rawCurrentHp) && rawCurrentHp > 0
    ? Math.min(maxHp, Math.floor(rawCurrentHp))
    : maxHp;
  return run;
}

function normalizeBattlePlayerHealth(player, runHp, heroBaseHp = 1) {
  if (!player || typeof player !== "object") return player;
  const rawMaxHp = Number(player.maxHp);
  const rawHeroBaseHp = Number(heroBaseHp);
  const maxHp = Number.isFinite(rawMaxHp) && rawMaxHp >= 1
    ? Math.floor(rawMaxHp)
    : (Number.isFinite(rawHeroBaseHp) && rawHeroBaseHp >= 1 ? Math.floor(rawHeroBaseHp) : 1);
  const rawHp = player.hp == null ? NaN : Number(player.hp);
  const rawRunHp = runHp == null ? NaN : Number(runHp);
  const fallbackHp = Number.isFinite(rawRunHp) ? rawRunHp : maxHp;
  player.maxHp = maxHp;
  player.hp = Number.isFinite(rawHp)
    ? Math.max(0, Math.min(maxHp, rawHp))
    : Math.max(0, Math.min(maxHp, fallbackHp));
  return player;
}

function getRunOutcomePolicy(outcome) {
  const normalized = normalizeRunOutcome(outcome);
  return normalized ? RUN_OUTCOME_POLICIES[normalized] : null;
}

function normalizeLoadedRunState(run) {
  if (!run || typeof run !== "object") return null;
  const normalized = normalizeRunOutcome(run.status);
  if (normalized) run.status = normalized;
  normalizeRunHealthState(run);
  if (typeof ensureRunStats === "function") {
    const normalizedStats = ensureRunStats(run.runStats);
    run.runStats = typeof ensureMupanRunStats === "function"
      ? ensureMupanRunStats(normalizedStats)
      : normalizedStats;
  }
  if (Array.isArray(run.deckCards)) {
    run.deckCards.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      if (!Object.prototype.hasOwnProperty.call(entry, "guluSourceId")) entry.guluSourceId = "";
      if (!Object.prototype.hasOwnProperty.call(entry, "guluGrade")) entry.guluGrade = "";
      if (!Object.prototype.hasOwnProperty.call(entry, "guluNurture")) entry.guluNurture = 0;
      if (!Object.prototype.hasOwnProperty.call(entry, "guluUpgradeCap")) entry.guluUpgradeCap = 2;
      if (!Object.prototype.hasOwnProperty.call(entry, "guluCarriedTurn")) entry.guluCarriedTurn = false;
    });
  }
  return run;
}

function getRunOutcomeLabel(outcome = runState?.status) {
  return ({ running: "试炼进行中", dead: "角色死亡", withdrawn: "阶段收手", abandoned: "主动放弃", cleared: "章节通关" })[normalizeRunOutcome(outcome)] || "结果未明";
}

function calculateBenmingOutcomeDaoxing(outcome, defeatedCount, rewardMul) {
  const policy = getRunOutcomePolicy(outcome);
  if (!policy?.settleCarryover) return 0;
  return Math.round((Math.max(0, Number(defeatedCount) || 0) * 2 + (policy.clearRewards ? 15 : 0)) * (Number(rewardMul) || 1));
}

function calculateRunMaterialCarryover(outcome, amount) {
  const policy = getRunOutcomePolicy(outcome);
  if (!policy?.settleCarryover) return 0;
  return Math.floor(Math.max(0, Number(amount) || 0) * policy.materialRatio);
}

let lastContractUnlocks = []; // V0.9.40 QS-1a：本次结算新解锁的契（finalizeRun 写、showRunConclusion 读）
let __lastHarvestSnapshot = null; // 结算广告加发：本局入库量快照（每局只可领取一次）

/* 看广告完整观看后，把点击时这局实际入库的材料/残核/蛊钱/道行照数再发一遍。
 * 只允许同一终局、同一非空快照的第一次完整观看发奖。 */
function grantDoubledHarvest(context) {
  const current = {
    run: runState,
    status: runState?.status,
    outcome: normalizeRunOutcome(runState?.status),
    snapshot: __lastHarvestSnapshot,
    panel: dom.runSummary,
    overlay: dom.resultOverlay,
    panelVisible: !dom.runSummary?.classList?.contains("hidden"),
    resultVisible: !dom.resultOverlay?.classList?.contains("hidden"),
  };
  if (!isRewardedHarvestContextCurrent(context, current)) return "";
  const snap = context.snapshot;
  const ads = ensureRunRewardedAds(context.run);
  ads.harvestDoubleUsed = true;
  const store = getGuluStore();
  const parts = [];
  Object.keys(snap.materials || {}).forEach((id) => {
    const add = Number(snap.materials[id]) || 0;
    if (add > 0 && MATERIALS[id]) { store.materials[id] = (store.materials[id] | 0) + add; parts.push(`${MATERIALS[id].name}×${add}`); }
  });
  if (snap.cores > 0) { store.bossCores = (store.bossCores | 0) + snap.cores; parts.push(`蛊母残核×${snap.cores}`); }
  if (snap.scrip > 0 && store.market) { store.market.scrip = (store.market.scrip | 0) + snap.scrip; parts.push(`蛊钱×${snap.scrip}`); }
  if (snap.daoxing > 0 && snap.heroId && typeof addBenmingDaoxing === "function") { addBenmingDaoxing(snap.heroId, snap.daoxing); parts.push(`道行×${snap.daoxing}`); }
  if (parts.length) {
    guluPushEvent(store, `广告加持·本局收获再领：${parts.join("、")}。`);
    saveGuluStore();
    addLogToChannel("journey", `看广告再领：${parts.join("、")}已再入蛊庐。`, "positive-log");
  }
  return parts.join("、");
}

function runGuluReceiptAction(meta, action) {
  const before = captureOutgameInventory(getGuluStore());
  const result = action();
  if (result?.ok) showOutgameReceiptFromChange(before, getGuluStore(), meta);
  return result;
}
function finalizeRun(outcome, options) {
  options = options || {};
  const normalized = normalizeRunOutcome(outcome);
  if (!normalized || normalized === "running") throw new TypeError(`无效的命途结算结果：${String(outcome)}`);
  if (!runState || runState.status !== "running") return false;
  if (normalized === "cleared" && !isMingtuTowerHeartReadyToClear(runState)) return false;
  const policy = getRunOutcomePolicy(normalized);
  runState.status = normalized;
  // 无尽结算立即进入 pending；官方回调成功后才标记已报入，失败可在结算或榜单重试。
  if (runState.mode === "endless" && normalized !== "abandoned") submitEndlessScoreWithStatus(getEndlessDeepestScore());
  clearRunAutosave();
  if (normalized === "abandoned") {
    if (typeof addJourneyLog === "function") addJourneyLog("本局结果：主动放弃。", "system-log");
    return true;
  }
  // V0.9.40 QS-1a 命途契：有效结算（非 abandoned）统一核验解锁；演武局不算。
  // 数据变更在此（不依赖 UI 路径），结算页只读 lastContractUnlocks 渲染递契通报。
  lastContractUnlocks = [];
  if (!runState.tutorialDrill && typeof evaluateContractUnlocks === "function") {
    try { lastContractUnlocks = evaluateContractUnlocks(runState, getRunStats()); } catch (e) { lastContractUnlocks = []; }
  }
  if (options.showConclusion !== false && policy.showConclusion) showRunConclusion(normalized);
  return true;
}

// runState 是整局命途试炼的唯一真相：地图、货币、持久生命、卡组与奖励都由它继承。
function createRunState() {
  __bgmWarmedLayer2 = false; __bgmWarmedLayer3 = false; // 新局重置预热闸
  warmLayerBgmAhead(2); // 一层期间就把二层两路 BGM 预热好（数分钟下载窗口，进二层秒起播）
  const hero = HEROES[progression.selectedHeroId];
  const benmingPathEligible = Boolean(BENMING_PATHS[progression.selectedHeroId])
    && getEffectiveBenmingStage(progression.selectedHeroId) >= 3;
  const benmingPath = benmingPathEligible
    ? (getBenmingPathDefinition(progression.selectedHeroId, progression.selectedBenmingPath)?.id || null)
    : null;
  // V0.9.40 QS-1a 命途契：只有"已解锁+已实装"的契才能入局；教学演武强制无契（演武是练手场，不吃局规则改写）。
  const contractDef = (!pendingTutorialDrill && typeof CONTRACTS !== "undefined") ? getContractDefinition(progression.selectedContract) : null;
  // V0.9.51 流派契限本道英雄：收益/代价都挂在流派机制上，跨道签=纯白嫖（深毒契+非毒道零代价），建局兜底拦。
  const mingtuContract = (contractDef && contractDef.implemented && isContractUnlocked(contractDef.id)
    && (!contractDef.heroId || contractDef.heroId === progression.selectedHeroId)) ? contractDef.id : null;
  // V0.9.19 十重天：模式与重数最先解析——九重残躯改血量上限、八重孤行改可用遗物，都要在下面取值前生效。
  const runMode = resolveRunMode();
  const tianTier = runMode === "tian" ? clampTianTier(Math.min(selectedTianTier, getTianMaxSelectable(progression.selectedHeroId))) : 0;
  // 八重·孤行兜底：即便 UI 被绕过，被锁遗物也在开局回落第一枚（必须在 relicId 捕获之前）。
  if (tianTier >= 8 && Object.keys(RELICS).indexOf(progression.selectedRelicId) >= 2) {
    progression.selectedRelicId = Object.keys(RELICS)[0];
  }
  const relicId = progression.selectedRelicId;
  const starterDeck = buildStarterDeckKeys(progression.selectedHeroId);
  let contractStarterCardsTrimmed = 0;
  // V0.9.40 QS-1a 空囊契：起始蛊囊裁剪只动基础牌段（携带蛊在下方另行并入，不受影响）；纯下标裁剪无 RNG。
  if (mingtuContract === "emptyPouch") {
    const trim = pickEmptyPouchTrimIndices(starterDeck.keys, (key) => CARD_LIBRARY[key]?.category);
    contractStarterCardsTrimmed = trim.length;
    for (let i = trim.length - 1; i >= 0; i -= 1) starterDeck.keys.splice(trim[i], 1);
  }
  const deckCards = starterDeck.keys.map(createDeckEntry);
  starterDeck.keys.forEach((key) => markGuDiscovered(key));
  markRelicDiscovered(relicId); // V0.9.9.2 遗物谱：本命遗物开局即录入
  // V0.9.35 天品随行·蛊气加持：建局先聚合随行天品的维度加成（生命/寿元上限并入下方，攻击/开局项存入 runState 供逐场消费）。
  const carriedGuBonus = computeCarriedGuBonus();
  const maxHp = Math.round((hero.maxHp + (relicId === "jadeMarrow" ? 8 : 0) + carriedGuBonus.maxHp) * (tianTier >= 9 ? 0.9 : 1)); // 九重·残躯：生命上限 -10%
  // V0.9.9 寿道·子批2c：maxLifespan=初始寿元；饲岁轮 +12 且起始寿元同涨（满寿入场）。
  // V0.9.20 灯芯蛊·幼虫：寿道本命蛊寿元上限 +2（同涨起始寿元）。
  const benmingLifespanBonus = (progression.selectedHeroId === "longevity" && getBenmingStage("longevity") >= 1) ? (getBenmingStage("longevity") >= 4 ? 4 : 2) : 0; // V0.9.33 神化：寿元上限 2→4
  // V0.9.51 短烛契代价：本局寿元上限 -3（Math.max 夹底防 0 寿开局＝朝暮直接寿尽）。
  const contractLifespanCut = (mingtuContract === "shortCandle" && typeof getContractLifespanPenalty === "function")
    ? getContractLifespanPenalty({ mingtuContract }) : 0;
  const maxLifespan = Math.max(1, hero.lifespan + (relicId === "siSuiLun" ? 12 : 0) + benmingLifespanBonus - contractLifespanCut);
  // V0.9.22 蛊庐：携带蛊入塔（至多 2 只并入起手牌组）。V0.9.23：通关保留、陨落失去——快照本局随行蛊 id 供结算判生死。
  const carriedGuIds = [];
  getGuluStore().slots
    .filter((g, i) => i < getGuluSlotCap() && g && g.state === "gu" && g.carry && CARD_LIBRARY[g.cardKey]) // V0.9.35 审计修：未辟圃的蛊不入塔
    .slice(0, typeof getBenmingCarryMax === "function" ? getBenmingCarryMax() : 2) // V0.9.51：携带上限随本命蛊转数
    .forEach((g) => {
      const entry = createDeckEntry(g.cardKey);
      // V0.9.51 庐养印记：品阶加成刻进卡牌实例，与炼蛊强化各算各的。
      // V0.9.52 修：随行蛊按九转鼎实际炼到的转数生效（旧代码削到 2/3，让五转白炼）；
      //           局内炼蛊炉的上限仍是 2/3，不受影响——那是原生牌的规则。
      const __cap = typeof getGuluUpgradeCap === "function" ? getGuluUpgradeCap(g.grade) : 2;
      const __carriedCap = typeof getCarriedTurnCap === "function" ? getCarriedTurnCap() : __cap;
      entry.upgradeLevel = Math.min(__carriedCap, g.upgradeLevel | 0);
      entry.guluGrade = g.grade || "";
      entry.guluSourceId = g.id;
      entry.guluNurture = typeof getGuluNurtureBonus === "function" ? getGuluNurtureBonus(g.grade) : 0;
      entry.guluUpgradeCap = __cap;
      entry.guluCarriedTurn = true; // 标记「来自九转鼎」：getUpgradeLevel 据此放行到九转
      entry.guluFused = Boolean(g.fusedFrom?.length); // 合练产物入塔同名限 1；局外圃位库存不受影响
      entry.guluRank = typeof getGuluRank === "function" ? getGuluRank(entry.upgradeLevel).name : "";
      deckCards.push(entry);
      markGuDiscovered(g.cardKey);
      carriedGuIds.push(g.id);
    });
  const seed = getSeedForNextRun();
  const mode = trialMode;
  const rngState = createRunRngState(seed);
  const mapState = validateRouteMapState(createMapState({ seed, mode, random: () => nextRngValue(rngState.channels.route) }), "layer1");
  const nextRun = {
    status: "running",
    chapterProgress: createMingtuChapterProgress("act-outer-stairs", "outer", "map-route-outer-step-1"),
    heroId: progression.selectedHeroId,
    benmingPath,
    benmingPathSchema: BENMING_PATH_SCHEMA,
    mingtuContract, // V0.9.40 QS-1a：本局所签命途契（null=无契局；旧档无此字段同义）
    starterGuKeys: [...starterDeck.starterGuKeys],

    relicId,
    trialMode: mode,
    mode: runMode, // V0.9.8.3/子批6：普通/精英/死劫/十重天，未解锁自动降级
    tianTier, // V0.9.19 十重天：本局挑战的重数（非十重天局为 0）
    endlessFloor: selectedMode === "endless" ? 1 : 0, // V0.9.51 无尽：当前层数（非无尽局为 0）
    endlessDeepest: 0, // V0.9.51 无尽：本局抵达的最深层（结算与排行榜用）
    trialSeed: seed,
    rngState,
    currentHp: maxHp,
    maxHp,
    lifespan: maxLifespan,
    maxLifespan,
    baseEnergy: hero.energy + (relicId === "yuanCicada" ? 1 : 0),
    deckCards,
    deckKeys: deckCards.map((card) => card.key),
    initialAdvancedKeys: starterDeck.advancedKeys,
    normalEnemyOrder: shuffle(NORMAL_ENEMY_IDS, () => nextRngValue(rngState.channels.enemyOrder)),
    defeatedEnemies: [],
    guStones: REWARD_BALANCE.startingGuStones,
    mapState,
    bossCores: 0, // V0.9.22 蛊庐：本局拿到的蛊母残核（通关才带出）
    carriedGuIds, // V0.9.23 蛊庐：本局随行圃蛊 id（通关保留、陨落失去）
    carriedGuBonus: { attackFlat: carriedGuBonus.attackFlat, openBlood: carriedGuBonus.openBlood }, // V0.9.35 天品随行·每击/每场开局加成（生命上限已并入 maxHp）
    completedNodes: [],
    lockedNodes: [],
    eventHistory: [],
    rewardedAds: { reviveUsed: false, rewardRerollUsed: false, harvestDoubleUsed: false, blessCount: 0, blessPending: 0 },
    simingMetCount: 0, // V0.9.18 塔中回声：本局遇司命人次数
    simingMetLayers: [], // V0.9.18：已遇司命人的层（同层不重复）
    restHistory: [],
    lastRestChoice: "",
    lastRestResult: "",
    routeHistory: [],
    lastMapNotice: "",
    lastEventNotice: "",
    shopPurchases: {},
    activeShopStock: [],
    pendingShopRemoveCardId: "",
    activeEventId: "",
    eliteDefeated: false,
    ordinaryRelics: [],
    relicHistory: [],
    eventRelicGained: false,
    bossPrepRelicGranted: false,
    shopDiscountUsed: false,
    lastBattleRewards: null,
    pendingRelicOffer: null, // V0.9.9.2 待玩家在命途图抉择收取的遗物 {relicId, source}
    pendingRelicOfferQueue: [], // V0.9.12.1 槽位被占时的排队遗物，防覆盖丢失
    satchel: [], // V0.9.16 丹囊：战斗消耗品（≤3 格），随局持久
    materialHistory: {},
    nextBattleHpLoss: 0,
    nextBattleEnemyAttackBonus: 0,
    bloodMaxBonus: 0,
    refinements: [],
    materials: MATERIAL_IDS.reduce((bag, id) => {
      bag[id] = 0;
      return bag;
    }, {}),
    ecologyMaterials: ECOLOGY_MATERIAL_IDS.reduce((bag, id) => {
      bag[id] = 0;
      return bag;
    }, {}),
    ecologyRewardedNodeIds: [],
    mutationCount: 0,
    backlashCount: 0,
    stableCount: 0,
    runStats: {
      ...createRunStats(),
      benmingPath: getBenmingPathDefinition(progression.selectedHeroId, benmingPath)?.name || "未启用",
      contractStarterCardsTrimmed,
    },
    backlashMitigated: false,
    bloodAttackBonus: 0,
    startArmorBonus: 0,
    rewardResolved: false,
    materialRewardResolved: false,
    refinementResolved: false,
    furnaceResolved: false,
    pendingMaterialIds: [],
    pendingFurnaceCandidates: [],
    selectedFurnaceMaterialId: null,
    selectedFurnaceCardId: null,
    pendingFurnacePlan: null,
  };
  nextRun.runStats.benmingPath = getBenmingPathDisplayName(nextRun);
  syncMingtuLegacyLocationShadow(nextRun);
  return nextRun;
}

function getPendingRunRedeemRewards(store = (typeof getGuluStore === "function" ? getGuluStore() : null)) {
  if (!store || !Array.isArray(store.pendingRunRewards)) return [];
  return store.pendingRunRewards
    .filter((reward) => reward && ["guStones", "lifespan", "card", "relic", "satchel"].includes(reward.type))
    .map((reward) => ({ ...reward }));
}

function clearPendingRunRedeemRewards(store = (typeof getGuluStore === "function" ? getGuluStore() : null)) {
  if (!store || typeof store !== "object") return false;
  store.pendingRunRewards = [];
  return true;
}

function getRunRedeemSatchelCap(run) {
  const base = Math.max(0, Number(PLAYER_BALANCE?.satchel?.baseCap) || 3);
  const thin = Math.max(0, Number(PLAYER_BALANCE?.satchel?.tianThinPouchCap) || 2);
  return run?.mode === "tian" && (run.tianTier || 0) >= 3 ? thin : base;
}

function applyPendingRunRedeemRewards(run, rewards, options = {}) {
  if (!run || !Array.isArray(rewards)) return { ok: false, reason: "reward" };
  if (!rewards.length) return { ok: true, applied: 0, rewardLines: [] };
  let guStones = Number(run.guStones) || 0;
  let lifespan = Number(run.lifespan) || 0;
  let maxLifespan = Number(run.maxLifespan) || lifespan;
  const cardKeys = [];
  const relics = Array.isArray(run.ordinaryRelics) ? run.ordinaryRelics.slice() : [];
  const satchel = Array.isArray(run.satchel) ? run.satchel.slice() : [];
  const rewardLines = [];
  let applied = 0;
  const safeAdd = (before, amount) => Number.isSafeInteger(before) && before >= 0
    && Number.isSafeInteger(amount) && amount > 0 && before <= Number.MAX_SAFE_INTEGER - amount
    ? before + amount : null;
  for (const reward of rewards) {
    const amount = Number(reward?.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, reason: "amount" };
    if (reward.type === "guStones") {
      guStones = safeAdd(guStones, amount);
      if (guStones == null) return { ok: false, reason: "amount" };
      rewardLines.push(`蛊石 ×${amount}`);
    } else if (reward.type === "lifespan") {
      lifespan = safeAdd(lifespan, amount);
      maxLifespan = safeAdd(maxLifespan, amount);
      if (lifespan == null || maxLifespan == null) return { ok: false, reason: "amount" };
      rewardLines.push(`寿元 ×${amount}`);
    } else if (reward.type === "card") {
      if (!CARD_LIBRARY[reward.id]) return { ok: false, reason: "reward" };
      for (let index = 0; index < amount; index += 1) cardKeys.push(reward.id);
      rewardLines.push(`${CARD_LIBRARY[reward.id].name} ×${amount}`);
    } else if (reward.type === "relic") {
      if (!ORDINARY_RELICS[reward.id] || amount !== 1 || relics.includes(reward.id)) return { ok: false, reason: "space" };
      relics.push(reward.id);
      rewardLines.push(`${ORDINARY_RELICS[reward.id].name} ×1`);
    } else if (reward.type === "satchel") {
      if (!BATTLE_ITEMS[reward.id]) return { ok: false, reason: "reward" };
      if (satchel.length > getRunRedeemSatchelCap(run) - amount) return { ok: false, reason: "space" };
      for (let index = 0; index < amount; index += 1) satchel.push(reward.id);
      rewardLines.push(`${BATTLE_ITEMS[reward.id].name} ×${amount}`);
    } else return { ok: false, reason: "reward" };
    applied += amount;
  }
  const prospectiveDeck = (run.deckCards || []).concat(cardKeys.map((key, index) => ({ instanceId: `redeem-preview-${index}`, key, originalKey: key, upgradeLevel: 0 })));
  if (typeof validateStartDeckCopyLimits === "function") {
    const copyValidation = validateStartDeckCopyLimits(prospectiveDeck);
    if (!copyValidation.ok) return { ok: false, reason: "space", violations: copyValidation.violations || [] };
  }
  if (options.commit === false) return { ok: true, applied, rewardLines };
  run.guStones = guStones;
  run.lifespan = lifespan;
  run.maxLifespan = maxLifespan;
  run.deckCards = Array.isArray(run.deckCards) ? run.deckCards : [];
  cardKeys.forEach((key) => run.deckCards.push(createDeckEntry(key)));
  run.deckKeys = run.deckCards.map((card) => card.key);
  run.ordinaryRelics = relics;
  run.relicHistory = Array.isArray(run.relicHistory) ? run.relicHistory : [];
  rewards.filter((reward) => reward.type === "relic").forEach((reward) => {
    if (!run.relicHistory.includes(reward.id)) run.relicHistory.push(reward.id);
    if (typeof markRelicDiscovered === "function") markRelicDiscovered(reward.id);
  });
  run.satchel = satchel;
  return { ok: true, applied, rewardLines };
}

function getEnemyIdForFloor(floor) {
  if (pendingMupanTestConfig || pendingTowerMupanBattle) return "wanmingMupan"; // E-2c4：正式塔心终局战同用万命母盘
  const node = getCurrentRunNode();
  if (node?.enemyId) return node.enemyId;
  if (isRouteBossSegment(floor, runState)) return getMingtuProgressRoute(runState)?.boss?.enemyId || "corpsepuppet";
  return runState.normalEnemyOrder[floor - 1];
}

const DRAGON_BALANCE = PLAYER_BALANCE.dragon;
const BONE_BALANCE = PLAYER_BALANCE.bone;

function createBoneBattleState(heroId) {
  return {
    enabled: heroId === "bone", resonance: 0,
    cardArmorGrantedThisTurn: false,
    boneShatterResonanceGrantedThisTurn: false, residualBonePinTriggeredThisTurn: false,
    enemyBreakGrantedThisAction: false, chimeUsedThisTurn: false,
    afterEchoPrimed: false, afterEchoDamage: 6, afterEchoDraw: 1, afterEchoSourceName: "余响蛊", cardArmorLockedThisTurn: false,
    reachedThreeThisBattle: false, reachedSixThisBattle: false,
    soulSettlingUsedThisBattle: false, boneSealUsedThisBattle: false,
    listeningCaseTriggered: false, listeningCasePrimed: false,
  };
}

function isBoneHero() {
  return Boolean(game?.bone?.enabled && game?.player?.heroId === "bone");
}

function getActiveBoneBenmingPath() {
  if (!isBoneHero() || !benmingPassive("bone", 3) || isLegacyBenmingRun(runState)) return null;
  return getRunBenmingPath(runState);
}

function dealBoneDirectDamage(amount, sourceName) {
  if (!game?.enemy || game.enemy.hp <= 0 || amount <= 0) return 0;
  const damage = applyMupanIncomingDamage(Math.max(0, Math.floor(amount)));
  game.enemy.hp = Math.max(0, game.enemy.hp - damage);
  recordPlayerDamage(damage);
  game.enemy.dmgTakenThisTurn = (game.enemy.dmgTakenThisTurn || 0) + damage;
  addLog(`${sourceName}直击${game.enemy.definition.name}，造成 ${damage} 点伤害（无视护甲）。`, "player-log");
  spawnDelayedFloatText(dom.enemyPortrait, `骨响 -${damage}`, "fate-float", 60);
  if (damage > 0) animateHit(dom.enemyPortrait);
  checkCorpseDiskPhase2();
  checkLayer2BossPhase2();
  return damage;
}

function gainBoneResonance(amount, sourceName = "骨道共鸣") {
  if (!isBoneHero() || amount <= 0) return 0;
  const context = game.activeCardContext;
  if (context?.boneResonanceGranted) return 0;
  const before = game.bone.resonance;
  game.bone.resonance = Math.min(BONE_BALANCE.resonanceMax, before + Math.floor(amount));
  const gained = game.bone.resonance - before;
  if (gained <= 0) return 0;
  if (context) context.boneResonanceGranted = true;
  getRunStats().boneResonanceGained += gained;
  addLog(`${sourceName}：骨鸣 +${gained}（${game.bone.resonance}/${BONE_BALANCE.resonanceMax}）。`, "positive-log");
  spawnFloatText(dom.playerPortrait, `骨鸣 +${gained}`, "resource-float");
  window.AudioManager?.playSfx?.("boneNoteGain", { volumeScale: 0.68 });
  if (before < 3 && game.bone.resonance >= 3) {
    window.AudioManager?.playSfx?.("boneThresholdThree", { volumeScale: 0.76 });
    if (benmingPassive("bone", 2) && !game.bone.reachedThreeThisBattle) {
      game.bone.reachedThreeThisBattle = true;
      gainArmor(3, "叩寿骨铃", "首次三响护身", { suppressBone: true });
    }
    setBattleMessage("骨鸣三响——本回合可发动「叩铃」。", "important");
  }
  if (before < 6 && game.bone.resonance >= 6) {
    window.AudioManager?.playSfx?.("boneThresholdSix", { volumeScale: 0.82 });
    if (hasOrdinaryRelic("hollowChimeMolt") && !game.bone.reachedSixThisBattle) {
      game.bone.reachedSixThisBattle = true;
      drawCards(2);
      addLog("空腔铃蜕：本场首次骨鸣满响，抽 2 张牌。", "positive-log");
      notifyRelicTrigger("hollowChimeMolt", "满响·抽2");
    }
  }
  return gained;
}

function recordBoneArmorGain(amount, sourceName, { suppressBone = false } = {}) {
  if (!isBoneHero() || suppressBone || amount <= 0 || !game.activeCardContext) return 0;
  if (!isActiveCardSource(sourceName) || game.bone.cardArmorGrantedThisTurn) return 0;
  game.bone.cardArmorGrantedThisTurn = true;
  return gainBoneResonance(1, "本回合首次以蛊牌护体");
}

function sacrificeBoneArmor(cap, sourceName, { suppressBone = false } = {}) {
  if (!isBoneHero() || cap <= 0 || game.player.armor <= 0) return 0;
  const sacrificed = Math.min(game.player.armor, Math.max(0, Math.floor(cap)));
  game.player.armor -= sacrificed;
  getRunStats().boneArmorSacrificed += sacrificed;
  addLog(`${sourceName}主动碎去 ${sacrificed} 点防御。`, "system-log");
  spawnFloatText(dom.playerPortrait, `碎甲 -${sacrificed}`, "defense-float");
  if (sacrificed >= 4) {
    if (!suppressBone && !game.bone.boneShatterResonanceGrantedThisTurn) {
      game.bone.boneShatterResonanceGrantedThisTurn = true;
      gainBoneResonance(1, "主动碎甲回响");
    }
    window.AudioManager?.playSfx?.("boneVoluntaryShatter", { volumeScale: 0.7 });
    if (hasOrdinaryRelic("residualBonePin") && !game.bone.residualBonePinTriggeredThisTurn) {
      game.bone.residualBonePinTriggeredThisTurn = true;
      dealBoneDirectDamage(3, "残音骨簪");
      notifyRelicTrigger("residualBonePin", "碎甲·直伤3");
    }
  }
  return sacrificed;
}

function recordBoneArmorBreak() {
  if (runState.relicId === "listeningBoneCase" && !game.bone.listeningCaseTriggered) {
    game.bone.listeningCaseTriggered = true;
    game.bone.listeningCasePrimed = true;
    addLog("听骨匣记下碎甲之声：下回合获得 4 点防御并抽 1 张牌。", "positive-log");
  }
  if (!isBoneHero() || game.bone.enemyBreakGrantedThisAction) return;
  game.bone.enemyBreakGrantedThisAction = true;
  gainBoneResonance(1, "敌势击碎骨甲");
  if (game.bone.afterEchoPrimed) {
    game.bone.afterEchoPrimed = false;
    const sourceName = game.bone.afterEchoSourceName || "余响蛊";
    const drawCount = Math.max(0, game.bone.afterEchoDraw | 0);
    dealBoneDirectDamage(game.bone.afterEchoDamage || 6, sourceName);
    if (drawCount > 0) drawCards(drawCount);
    game.bone.afterEchoSourceName = "余响蛊";
    window.AudioManager?.playSfx?.("boneAfterEcho", { volumeScale: 0.76 });
    addLog(`${sourceName}应声反击${drawCount > 0 ? `，并抽 ${drawCount} 张牌` : ""}。`, "positive-log");
  }
}

function canUseBoneChime() {
  return Boolean(isBoneHero() && game.status === "playing" && !game.inputLocked
    && !game.bone.chimeUsedThisTurn && game.bone.resonance >= BONE_BALANCE.chimeThreshold);
}

function getBoneChimeOutcome({
  mode,
  resonance,
  armor,
  pathId,
  stage,
  soulUsed = false,
  extraRetainedResonance = 0,
}) {
  const points = Math.max(0, Math.min(BONE_BALANCE.resonanceMax, Math.floor(Number(resonance) || 0)));
  const currentArmor = Math.max(0, Math.floor(Number(armor) || 0));
  const trueForm = Number(stage) >= 3;
  const guixu = Number(stage) >= 5;
  if (mode === "soul") {
    const onPath = pathId === "soulSettling" && trueForm;
    const perPoint = onPath && guixu
      ? BONE_BALANCE.soulArmorPerPointGuixu
      : BONE_BALANCE.soulArmorPerPoint;
    return {
      armorGained: points * perPoint,
      armorSacrificed: 0,
      directDamage: 0,
      retainedResonance: Math.min(2,
        (onPath ? BONE_BALANCE.soulRetainTrueForm : 0)
        + Math.max(0, Math.floor(Number(extraRetainedResonance) || 0))),
      weakenAdded: (points >= 5 ? 1 : 0)
        + (onPath && !soulUsed ? BONE_BALANCE.soulFirstWeakenTrueForm : 0),
      lockCardArmor: false,
    };
  }
  if (mode === "fate") {
    const onPath = pathId === "fateBreaking" && trueForm;
    const cap = onPath
      ? BONE_BALANCE.fateArmorSacrificeCapTrueForm
      : BONE_BALANCE.fateArmorSacrificeCap;
    const sacrificed = Math.min(currentArmor, cap);
    const perPoint = onPath && guixu
      ? BONE_BALANCE.fateDamagePerPointGuixu
      : BONE_BALANCE.fateDamagePerPoint;
    return {
      armorGained: 0,
      armorSacrificed: sacrificed,
      directDamage: sacrificed + points * perPoint,
      retainedResonance: 0,
      weakenAdded: 0,
      lockCardArmor: onPath && guixu,
    };
  }
  return null;
}

function resolveBoneChime(mode) {
  if (mode !== "soul" && mode !== "fate") return false;
  if (!canUseBoneChime()) return false;
  const resonance = game.bone.resonance;
  const pathId = getActiveBoneBenmingPath();
  const actionName = mode === "soul" ? "镇魂" : "断命";
  const stage = getEffectiveBenmingStage("bone");
  const extraRetainedResonance = mode === "soul"
    && hasOrdinaryRelic("boneSealSlip")
    && !game.bone.boneSealUsedThisBattle ? 1 : 0;
  const outcome = getBoneChimeOutcome({
    mode,
    resonance,
    armor: game.player.armor,
    pathId,
    stage,
    soulUsed: game.bone.soulSettlingUsedThisBattle,
    extraRetainedResonance,
  });
  if (!outcome || (mode === "fate" && outcome.armorSacrificed <= 0)) return false;
  game.bone.chimeUsedThisTurn = true;
  game.bone.resonance = 0;
  getRunStats().boneChimeUses += 1;
  triggerHeroVoice("chime");
  if (mode === "soul") {
    gainArmor(outcome.armorGained, "叩铃·镇魂", `${resonance} 响归甲`, { suppressBone: true });
    if (extraRetainedResonance > 0) {
      game.bone.boneSealUsedThisBattle = true;
      notifyRelicTrigger("boneSealSlip", "镇魂·留响1");
    }
    game.bone.resonance = outcome.retainedResonance;
    if (outcome.weakenAdded > 0) game.enemy.weaken = (game.enemy.weaken || 0) + outcome.weakenAdded;
    if (pathId === "soulSettling" && !game.bone.soulSettlingUsedThisBattle) {
      game.bone.soulSettlingUsedThisBattle = true;
    }
    getRunStats().boneSoulUses += 1;
    window.AudioManager?.playSfx?.("boneChimeSoul", { volumeScale: 0.82 });
    const pathBonus = pathId === "soulSettling" ? `（${BENMING_PATHS.bone.soulSettling.name}）` : "";
    addLog(`${actionName}${pathBonus}：${resonance} 响化甲${game.bone.resonance ? `，保留 ${game.bone.resonance} 点骨鸣` : ""}${outcome.weakenAdded ? `，衰老 +${outcome.weakenAdded}` : ""}。`, "important");
  } else if (mode === "fate") {
    const sacrificed = sacrificeBoneArmor(outcome.armorSacrificed, "叩铃·断命", { suppressBone: true });
    dealBoneDirectDamage(outcome.directDamage, "叩铃·断命");
    if (outcome.lockCardArmor) game.bone.cardArmorLockedThisTurn = true;
    getRunStats().boneFateUses += 1;
    window.AudioManager?.playSfx?.("boneChimeFate", { volumeScale: 0.86 });
    const pathBonus = pathId === "fateBreaking" ? `（${BENMING_PATHS.bone.fateBreaking.name}）` : "";
    addLog(`${actionName}${pathBonus}：碎甲 ${sacrificed}，直伤 ${outcome.directDamage}，消耗 ${resonance} 点骨鸣${outcome.lockCardArmor ? "；本回合蛊牌得甲已锁" : ""}。`, "important");
  }
  render();
  checkBattleResult();
  return true;
}

function closeBoneChime() {
  dom.boneChimeOverlay?.classList.add("hidden");
  refreshModalLock();
}

function openBoneChime() {
  if (!canUseBoneChime() || !dom.boneChimeOverlay) return false;
  const resonance = game.bone.resonance;
  const pathId = getActiveBoneBenmingPath();
  const stage = getEffectiveBenmingStage("bone");
  const extraRetainedResonance = hasOrdinaryRelic("boneSealSlip")
    && !game.bone.boneSealUsedThisBattle ? 1 : 0;
  const commonInput = {
    resonance,
    armor: game.player.armor,
    pathId,
    stage,
    soulUsed: game.bone.soulSettlingUsedThisBattle,
    extraRetainedResonance,
  };
  const soulOutcome = getBoneChimeOutcome({ ...commonInput, mode: "soul" });
  const fateOutcome = getBoneChimeOutcome({ ...commonInput, mode: "fate" });
  dom.boneChimeLead.textContent = `当前骨鸣 ${resonance}/${BONE_BALANCE.resonanceMax}，本回合叩铃后不能再次发动。`;
  dom.boneChimeSoulPreview.textContent = `获得 ${soulOutcome.armorGained} 防御${soulOutcome.retainedResonance ? `，保留 ${soulOutcome.retainedResonance} 点骨鸣` : ""}${soulOutcome.weakenAdded ? `，衰老 +${soulOutcome.weakenAdded}` : ""}`;
  dom.boneChimeFatePreview.textContent = game.player.armor > 0
    ? `碎去 ${fateOutcome.armorSacrificed} 防御，直伤 ${fateOutcome.directDamage}${fateOutcome.lockCardArmor ? "；本回合蛊牌不能再获得防御" : ""}`
    : "当前无防御，不能断命";
  dom.boneChimeFate.disabled = game.player.armor <= 0;
  dom.boneChimeOverlay.classList.remove("hidden");
  refreshModalLock();
  return true;
}

function createDragonBattleState(heroId) {
  return {
    scale: 0,
    transformed: false,
    turnsRemaining: 0,
    attackScaleGrantedThisTurn: false,
    defenseScaleGrantedThisTurn: false,
    scaleReadySfxPlayed: false,
    readyArmorGranted: false,
    extendedThisTransform: false,
    enabled: heroId === "dragon",
  };
}

function isDragonHero() {
  return Boolean(game?.dragon?.enabled && game?.player?.heroId === "dragon");
}

function getDragonAttackBonus() {
  return isDragonHero() && game.dragon.transformed ? DRAGON_BALANCE.attackBonus : 0;
}

function getDragonDefenseBonus() {
  return isDragonHero() && game.dragon.transformed ? DRAGON_BALANCE.defenseBonus : 0;
}

function getDragonEnergyBonus() {
  return isDragonHero() && game.dragon.transformed ? DRAGON_BALANCE.energyBonus : 0;
}

function gainDragonScale(amount, sourceName = "龙裔蛊术") {
  if (!isDragonHero() || game.dragon.transformed || amount <= 0) return 0;
  const before = game.dragon.scale;
  game.dragon.scale = Math.min(DRAGON_BALANCE.scaleMax, before + amount);
  const gained = game.dragon.scale - before;
  if (gained > 0) {
    const stats = getRunStats();
    stats.dragonScalesGained = (Number(stats.dragonScalesGained) || 0) + gained;
    spawnFloatText(dom.playerPortrait, `龙鳞 +${gained}`, "resource-float");
    addLog(`${sourceName}唤醒逆鳞：龙鳞 +${gained}（${game.dragon.scale}/${DRAGON_BALANCE.scaleMax}）。`, "positive-log");
    if (before < DRAGON_BALANCE.scaleMax
      && game.dragon.scale >= DRAGON_BALANCE.scaleMax
      && !game.dragon.scaleReadySfxPlayed) {
      game.dragon.scaleReadySfxPlayed = true;
      const readyArmor = getDragonBenmingReadyArmor(getEffectiveBenmingStage("dragon"), game.dragon.readyArmorGranted);
      if (readyArmor > 0) {
        game.dragon.readyArmorGranted = true;
        gainArmor(readyArmor, "烬脉龙蛊", "龙鳞初次俱醒");
      }
      window.AudioManager?.playSfx?.("dragonScaleReady", { volumeScale: 0.72 });
      setBattleMessage(`龙鳞已满（${DRAGON_BALANCE.scaleMax}/${DRAGON_BALANCE.scaleMax}），点击下方「化龙」即可显露真形。`, "important");
    } else if (game.dragon.scale === DRAGON_BALANCE.scaleMax - 1 && before < DRAGON_BALANCE.scaleMax - 1) {
      // V0.9.47：临近化龙的主动提示——刚攒到「差 1 鳞」时提醒一次，玩家不用自己盯龙鳞进度（反馈#7）。
      setBattleMessage(`龙鳞 ${game.dragon.scale}/${DRAGON_BALANCE.scaleMax}——再得 1 鳞即可化龙。`);
    }
  }
  return gained;
}

function spendDragonScale(amount, sourceName) {
  if (!isDragonHero() || game.dragon.transformed || game.dragon.scale < amount) return false;
  game.dragon.scale -= amount;
  if (game.dragon.scale < DRAGON_BALANCE.scaleMax) game.dragon.scaleReadySfxPlayed = false;
  addLog(`${sourceName}消耗 ${amount} 枚龙鳞。`, "system-log");
  return true;
}

function recordDragonAttackResult(realDamage, card) {
  if (!isDragonHero() || game.dragon.transformed || realDamage <= 0 || card?.category !== "attack") return;
  if (game.dragon.attackScaleGrantedThisTurn) return;
  game.dragon.attackScaleGrantedThisTurn = true;
  gainDragonScale(1, "本回合首次伤敌");
}

function recordDragonDefenseResult(amount, card = game?.activeCardContext?.cardSnapshot) {
  if (!isDragonHero() || game.dragon.transformed || amount <= 0 || card?.category !== "defense") return;
  if (game.dragon.defenseScaleGrantedThisTurn) return;
  game.dragon.defenseScaleGrantedThisTurn = true;
  gainDragonScale(1, "本回合首次护体");
}

function advanceDragonTransformTurn() {
  if (!isDragonHero()) return;
  game.dragon.attackScaleGrantedThisTurn = false;
  game.dragon.defenseScaleGrantedThisTurn = false;
  if (!game.dragon.transformed) return;
  const stats = getRunStats();
  stats.dragonTransformTurns = (Number(stats.dragonTransformTurns) || 0) + 1;
  game.dragon.turnsRemaining = Math.max(0, game.dragon.turnsRemaining - 1);
  if (game.dragon.turnsRemaining > 0) return;
  game.dragon.transformed = false;
  game.dragon.scale = 0;
  game.dragon.extendedThisTransform = false;
  document.body.classList.remove("dragon-form-active", "dragon-transforming");
  addLog("龙形退去，逆鳞重新沉入骨血。", "system-log");
  setBattleMessage(`龙形已尽，需重新在攻守之间养出 ${DRAGON_BALANCE.scaleMax} 枚龙鳞。`);
}

function activateDragonTransform() {
  if (!isDragonHero() || game.status !== "playing") return false;
  if (game.dragon.transformed || game.inputLocked) return false;
  if (game.dragon.scale < DRAGON_BALANCE.scaleMax) return false;
  game.inputLocked = true;
  game.dragon.scale = 0;
  game.dragon.scaleReadySfxPlayed = false;
  game.dragon.transformed = true;
  game.dragon.turnsRemaining = DRAGON_BALANCE.transformTurns;
  game.dragon.extendedThisTransform = false;
  const stats = getRunStats();
  stats.dragonTransforms = (Number(stats.dragonTransforms) || 0) + 1;
  game.player.energy += DRAGON_BALANCE.energyBonus;
  const benmingBonus = getDragonBenmingTransformBonus(
    getEffectiveBenmingStage("dragon"),
    getRunBenmingPath(runState),
  );
  if (benmingBonus.energy > 0) {
    game.player.energy += benmingBonus.energy;
    addLog(`烬脉龙蛊·焚脉腾渊：化龙额外真元 +${benmingBonus.energy}。`, "positive-log");
  }
  if (benmingBonus.armor > 0) {
    gainArmor(benmingBonus.armor, "烬脉龙蛊·玄甲镇脉", "化龙护命");
  }
  // V0.9.51 #27 龙血珀：化龙显形瞬间回复 6 点生命
  if (hasOrdinaryRelic("dragonBloodAmber")) {
    healPlayer(6, "龙血珀");
    addLog("龙血珀熔于鳞火：化龙回血 6 点。", "positive-log");
    notifyRelicTrigger("dragonBloodAmber", "化龙·回血 6");
  }
  document.body.classList.add("dragon-transforming", "dragon-form-active");
  const transformBattle = game;
  triggerHeroVoice("transform");
  window.AudioManager?.playSfx?.("dragonRoar", { volumeScale: 0.58 });
  window.setTimeout(() => {
    if (game !== transformBattle || game.status !== "playing" || !game.dragon?.transformed) return;
    window.AudioManager?.playSfx?.("dragonTransformImpact", { volumeScale: 0.86 });
  }, 620);
  spawnCenterEffect("effect-dragon-title", "逆鳞化龙", 1080);
  pulseElement(dom.playerPortrait, "portrait-dragon-shift", 1080);
  addLog(`烬鳞引满鳞归骨，显露龙形：持续 ${DRAGON_BALANCE.transformTurns} 回合，真元 +${DRAGON_BALANCE.energyBonus}，攻击蛊 +${DRAGON_BALANCE.attackBonus}、防御蛊 +${DRAGON_BALANCE.defenseBonus}。`, "important");
  setBattleMessage("龙吟震塔，黑金鳞火沿经脉尽数点燃。", "important");
  render();
  window.setTimeout(() => {
    document.body.classList.remove("dragon-transforming");
    if (!game || game.status !== "playing") return;
    game.inputLocked = false;
    render();
  }, 1080);
  return true;
}

function createBattleState() {
  normalizeRunHealthState(runState);
  const hero = HEROES[runState.heroId];
  const currentNode = getCurrentRunNode();
  const enemyId = getEnemyIdForFloor(getCurrentRouteStep());
  const isTutorialDrillBattle = pendingTutorialDrill || Boolean(runState?.tutorialDrill);
  /* V0.9.7：无条件登记万蛊录（一层/二层混存，按 enemyId 去重；解掉只在 layer2.active 的旧限制）。演武木人不入图鉴。 */
  if (!isTutorialDrillBattle && typeof layer2MarkBestiary === "function") layer2MarkBestiary(enemyId);
  const enemyDefinition = isTutorialDrillBattle ? TUTORIAL_DRILL_ENEMY : ENEMY_LIBRARY[enemyId];
  const enemyHpMultiplier = Number(currentNode?.enemyHpMultiplier) || 1;
  // V0.9.8.3 精英模式：在原 HP 系数上再乘模式系数（Boss 用更高 bossHpMul），不改 ENEMY_LIBRARY 原值。
  const __mt = pendingMupanTestConfig
    ? getMupanTestModeTuning(pendingMupanTestConfig)
    : getModeTuning(); // V0.9.19：走统一入口（十重天按重数计算；此前直查 MODE_TUNING 会让 tian 回落普通档）
  const modeHpMul = enemyDefinition.isBoss ? __mt.bossHpMul : __mt.hpMul;
  const enemyMaxHp = Math.max(1, Math.ceil(enemyDefinition.maxHp * enemyHpMultiplier * modeHpMul));
  const startingArmor = (typeof getBirthRelicStartingArmor === "function"
    ? getBirthRelicStartingArmor(runState.relicId)
    : (runState.relicId === "boneCarapace" ? 4 : 0)) + runState.startArmorBonus;
  const deck = runState.deckCards.map(createCardFromDeckEntry);
  const combatRelic = {
    tailCutUsed: false,
    bloodJadeHealsThisTurn: 0,
    greenPouchCardName: "",
    emberRobeUsed: false, // V0.9.51 #27 燃烬衣：每场首次焚寿+1真元（每场重置）
    // V0.9.57 遗物扩量：三枚「每场限一次」的一次性标记，随 combatRelic 每场重建即自动重置
    whetstoneUsed: false, // 磨蛊石：本场首次攻击蛊 +4 伤害
    ashLanternUsed: false, // 烬灯：本场首次焚寿 +5 防御
    weaveKnotUsed: false, // 织结：本场首次命势圆满额外抽 1
  };
  if (hasOrdinaryRelic("greenPouchBug")) {
    const poisonCards = deck.filter((card) => card.type === "poison" || card.typeName.includes("毒道"));
    const target = sampleWithRunRandom(poisonCards, 1, "reward")[0];
    if (target) {
      target.cost = Math.max(0, target.cost - 1);
      target.temporaryCostReduction = 1;
      combatRelic.greenPouchCardName = target.name;
    }
  }
  return {
    status: "playing",
    floor: getCurrentRouteStep(),
    turn: 1,
    inputLocked: false,
    lifespanDeath: false, // V0.9.9 寿道·子批2b：战斗内焚寿致寿元归零的死亡标记（每场重置）
    burnedLifespanThisBattle: 0, // V0.9.9 寿道·子批3：本场主动焚寿累计（焚寿蛊加伤），每场重置
    contractTurbidBloodUsed: false, // V0.9.51 浊血契：本场首次自损化血煞已触发（每场重置）
    duskRelightUsedThisTurn: false, // V0.9.51 #29 朝暮回灯：本回合首次焚寿已换血（每回合重置）
    spellDoubleThisTurn: false, // V0.9.9 寿道·子批3：回光——本回合蛊术伤害翻倍，beginNextTurn 重置
    handTarget: 5,
    attackBonus: 0,
    blessAttackBonus: 0,
    defenseBonus: 0,
    nextTurnArmor: 0,
    bloodAttackBonus: runState.bloodAttackBonus,
    cardsPlayedThisTurn: 0,
    actionEconomyFirstDrawUsedThisTurn: {},
    ecologyCountersUsedThisTurn: {},
    ecologyTriggerCount: 0,
    bloodCardsPlayedThisBattle: 0,
    tutorialDrill: isTutorialDrillBattle,
    drillPlayedAny: false,
    bloodStitchState: "unprepared",
    bloodAtonementUsesThisTurn: 0,
    poisonAfterstrikeState: "waitingAttack",
    poisonBorrowedScaleUsedThisTurn: false,
    poisonBorrowedScalePendingAttack: false,
    lastCardCategoryThisTurn: null,
    thunderSequence: null,
    calamityAsh: null,
    activeCardContext: null,
    pendingEnemyPoisonPulse: false,
    fateGainedThisTurn: false,
    fateBurstsThisTurn: 0,
    fateTriad: [],
    fateTriadGraceUsedThisTurn: false,
    fateRouteGuardUsedThisTurn: false,
    fateRewritePending: false,
    fateRewriteUsedThisTurn: false,
    fateRewriteCandidate: null,
    supportDrawPrimed: 0,
    enemyAttackBonus: runState.nextBattleEnemyAttackBonus || 0,
    enemyAttackMultiplier: enemyDefinition.isBoss ? __mt.bossAtkMul : __mt.atkMul, // V0.9.8.3 精英模式攻击乘法（Boss 用 bossAtkMul），只乘基础攻击项

    combatRelic,
    dragon: createDragonBattleState(runState.heroId),
    bone: createBoneBattleState(runState.heroId),
    battleStats: createBattleStats(enemyDefinition, currentNode),
    player: {
      heroId: runState.heroId,
      definition: hero,
      hp: runState.currentHp,
      maxHp: runState.maxHp,
      energy: runState.baseEnergy,
      baseEnergy: runState.baseEnergy,
      nextTurnEnergyPenalty: 0,
      armor: startingArmor,
      lifespan: runState.lifespan,
      maxLifespan: runState.maxLifespan ?? hero.lifespan, // V0.9.9 寿道·子批2c：老存档无此字段时兜底回初始寿元
      blood: 0,
      poison: 0,
      vulnerable: 0,
      fateMomentum: fateRemnantCarry(), // V0.9.9.2 残势续燃：默认0，持该遗物则取上场留存的半势
      lastCardFlowType: null,
      drunkStacks: 0,
      drunkFlatBonus: 0,
      nextCardCostReduction: 0,
      wasDamagedThisTurn: false,
      nextTurnDrawPenalty: 0,
      poisonStingStack: 0,
    },
    enemy: {
      id: enemyId,
      definition: enemyDefinition,
      hp: enemyMaxHp,
      maxHp: enemyMaxHp,
      armor: Number(enemyDefinition.def && enemyDefinition.def.boneArmorStart) || 0, // V0.9.8.9 骨塔硬核：开局自带骨甲
      chargedBonus: 0,
      poison: 0,
      weaken: 0, // V0.9.9 寿道·子批3：桑田蛊施加的衰老（攻击意图永久减，可叠加），每场重置
      intent: null,
      phase2: false,
      enraged: false,
      enrageName: "",
      charging: false,
      currentInterruptThreshold: 0,
      swarmStack: 0,
      commanderEffect: 0,
      counterArmed: false,
      phase2TurnCounter: 0,
      dmgTakenThisTurn: 0,
      lastConvertTurn: null, // V0.9.8.4 转毒冷却计时（每战重置，防串场）
      poisonResistShred: 0, // V0.9.58 蚀毒破抗：每次 +5%，单场封顶 15%
      poisonSwallowArmed: false, // V0.9.58 吞毒改为可见敌方意图，不再回合末自动触发
      poisonSwallowOriginalIntent: null,
      towerPressure: enemyHpMultiplier > 1,
      towerPressurePercent: Math.max(0, Math.round((enemyHpMultiplier - 1) * 100)),
    },
    drawPile: shuffle(deck, () => getRunRandom("draw")),
    discardPile: [],
    exhaustPile: [],
    hand: [],
  };
}

function syncRunStateFromBattle() {
  if (!runState || !game) return;
  normalizeBattlePlayerHealth(game.player, runState.currentHp, HEROES[game.player?.heroId]?.maxHp);
  runState.currentHp = game.player.hp;
  runState.maxHp = game.player.maxHp;
  runState.lifespan = game.player.lifespan;
  runState.maxLifespan = game.player.maxLifespan; // V0.9.9 寿道·子批2c：寿元上限随局持久化（含老存档兜底值回写）
}

function updatePrepSelectionSummary() {
  if (!dom.prepSelectionSummary) return;
  const hero = HEROES[progression.selectedHeroId] || HEROES.fate;
  const starterGuKeys = normalizeStarterGuSelection(progression.selectedStarterGuKeys);
  const relic = RELICS[progression.selectedRelicId];
  const path = getBenmingPathDefinition(progression.selectedHeroId, progression.selectedBenmingPath);
  const modeNames = { normal: "普通", elite: "精英", deathtrial: "死劫", tian: `十重天·${selectedTianTier}重` };
  const contract = typeof CONTRACTS !== "undefined" ? getContractDefinition(progression.selectedContract) : null;
  dom.prepSelectionSummary.innerHTML = [
    `<span><b>蛊修</b>${hero.name}</span>`,
    path ? `<span><b>本命</b>${path.name}</span>` : "",
    `<span><b>择蛊</b>${starterGuKeys.map((key) => CARD_LIBRARY[key]?.name).filter(Boolean).join("、")}</span>`,
    `<span><b>遗物</b>${relic?.name || "未择"}</span>`,
    `<span><b>试炼</b>${modeNames[selectedMode] || "普通"}</span>`,
    contract ? `<span><b>契</b>${contract.name}</span>` : "",
  ].filter(Boolean).join("");
}

let moreMenuHistoryArmed = false;

function setMoreMenuOpen(open, options) {
  const shouldOpen = Boolean(open);
  const fromHistory = Boolean(options?.fromHistory);
  dom.moreMenuPanel?.classList.toggle("hidden", !shouldOpen);
  dom.moreMenuButton?.setAttribute("aria-expanded", String(shouldOpen));
  document.body.classList.toggle("more-menu-open", shouldOpen);

  if (shouldOpen && !fromHistory && !moreMenuHistoryArmed) {
    try {
      window.history.pushState({ ...(window.history.state || {}), nmgOverlay: "more-menu" }, "");
      moreMenuHistoryArmed = true;
    } catch (error) {
      moreMenuHistoryArmed = false;
    }
    return;
  }

  if (!shouldOpen && fromHistory) {
    moreMenuHistoryArmed = false;
    return;
  }

  if (!shouldOpen && moreMenuHistoryArmed) {
    moreMenuHistoryArmed = false;
    try { window.history.back(); } catch (error) {}
  }
}

function setStartView(view, { focus = true } = {}) {
  activeStartView = view === "prep" ? "prep" : "home";
  const prepOpen = activeStartView === "prep";
  dom.homeHubView?.classList.toggle("hidden", prepOpen);
  dom.prepScreenView?.classList.toggle("hidden", !prepOpen);
  setMoreMenuOpen(false);
  if (prepOpen) {
    setPrepStep("hero", { focus: false });
    renderTitleScreen();
  } else {
    updateResumeRunButton();
    refreshCollectionHubBadges();
  }
  updateMobileViewportState();
  if (focus) {
    window.setTimeout(() => {
      const target = prepOpen
        ? dom.startPrepShell?.querySelector("button:not([disabled])")
        : (dom.resumeRunButton && !dom.resumeRunButton.classList.contains("hidden") ? dom.resumeRunButton : dom.newRunButton);
      target?.focus();
    }, 0);
  }
}

function syncPrepStepUi() {
  if (!dom.startPrepShell) return;
  dom.startPrepShell.dataset.prepStep = activePrepStep;
  dom.startPrepShell.querySelectorAll("[data-prep-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.prepPanel === activePrepStep);
  });
  dom.prepStepTabs?.querySelectorAll("[data-prep-step]").forEach((tab) => {
    const selected = tab.dataset.prepStep === activePrepStep;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
}

function setPrepStep(step, { focus = true } = {}) {
  const allowed = new Set(["hero", "starter", "relic", "mode"]);
  let next = allowed.has(step) ? step : "hero";
  activePrepStep = next;
  syncPrepStepUi();
  if (focus) {
    const panel = dom.startPrepShell?.querySelector(`[data-prep-panel="${next}"]`);
    window.setTimeout(() => panel?.querySelector("button:not([disabled])")?.focus(), 0);
  }
}

function openHeroDetail(heroId) {
  const hero = HEROES[heroId];
  if (!hero || !dom.heroDetailOverlay) return;
  const portrait = Array.isArray(PORTRAIT_PATHS.heroes[heroId]) ? PORTRAIT_PATHS.heroes[heroId][0] : PORTRAIT_PATHS.heroes[heroId];
  dom.heroDetailRole.textContent = `${hero.role} · ${HERO_DIFFICULTY_LABELS[heroId] || "上手·进阶"}`;
  dom.heroDetailName.textContent = hero.name;
  dom.heroDetailStats.textContent = `生命 ${hero.maxHp}　真元 ${hero.energy}　寿元 ${hero.lifespan}`;
  dom.heroDetailPassive.innerHTML = `<b>${hero.passiveName}</b>：${hero.passive}`;
  dom.heroDetailQuest.textContent = hero.quest || "";
  dom.advancedCardPreview.innerHTML = buildStarterDeckKeys(heroId).keys
    .map((key) => `<span>${CARD_LIBRARY[key].name}</span>`).join("");
  if (dom.heroDetailPortraitImage) {
    dom.heroDetailPortraitImage.alt = `${hero.name}立绘`;
    loadPortraitImage(dom.heroDetailPortraitImage, portrait, `${hero.name}立绘`, dom.heroDetailPortrait);
  }
  dom.heroDetailOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeHeroDetail() {
  dom.heroDetailOverlay?.classList.add("hidden");
  refreshModalLock();
}

function isBenmingPathRequiredForTitle() {
  return Boolean(BENMING_PATHS[progression.selectedHeroId])
    && getEffectiveBenmingStage(progression.selectedHeroId) >= 3;
}

function getStarterGuArtHtml(key, card) {
  const art = getCardArtImage(key);
  return art
    ? `<span class="starter-gu-art has-art" aria-hidden="true"><img class="${getCardArtImgClass(key)}" src="${art}" alt="" loading="lazy" decoding="async"></span>`
    : `<span class="starter-gu-glyph" aria-hidden="true">${card.glyph}</span>`;
}

function renderStarterGuSelection() {
  if (!dom.starterGuChoices) return;
  const selectedKeys = normalizeStarterGuSelection(progression.selectedStarterGuKeys);
  progression.selectedStarterGuKeys = selectedKeys;
  dom.starterGuChoices.innerHTML = STARTER_GU_CHOICE_KEYS.map((key) => {
    const card = CARD_LIBRARY[key];
    const selectedIndex = selectedKeys.indexOf(key);
    const selected = selectedIndex >= 0;
    return `<button class="starter-gu-choice tone-${card.type} ${selected ? "selected" : ""}" type="button"
      data-starter-gu-key="${key}" aria-pressed="${selected}"
      aria-label="${escapeAttribute(`${card.name}，${card.typeName}。${stripTags(card.effect)}`)}"
      title="${escapeAttribute(`${card.name}｜${stripTags(card.effect)}`)}">
      ${getStarterGuArtHtml(key, card)}
      <span class="starter-gu-copy">
        <small>${card.typeName} · <b class="starter-gu-cost">${card.cost} 真元</b></small>
        <strong>${card.name}</strong>
        <span class="starter-gu-effect">${card.effect}</span>
      </span>
      ${selected ? `<b class="starter-gu-order">${selectedIndex + 1}</b>` : ""}
    </button>`;
  }).join("");
}

function getRelicChoiceArtHtml(id, relic) {
  const art = PORTRAIT_PATHS.relics?.[id];
  return art
    ? `<span class="relic-choice-art has-art" aria-hidden="true"><img src="${art}" alt="" loading="lazy" decoding="async"></span>`
    : `<span class="relic-choice-glyph" aria-hidden="true">${relic.glyph}</span>`;
}

function renderBenmingPathSelection() {
  if (!dom.benmingPathSection || !dom.benmingPathChoices) return;
  const eligible = isBenmingPathRequiredForTitle();
  dom.benmingPathSection.classList.toggle("hidden", !eligible);
  if (!eligible) {
    dom.benmingPathSection.classList.remove("has-selection");
    progression.selectedBenmingPath = null;
    dom.benmingPathChoices.innerHTML = "";
    return;
  }

  const heroId = progression.selectedHeroId;
  const gu = BENMING_GU[heroId];
  const paths = BENMING_PATHS[heroId] || {};
  const selected = getBenmingPathDefinition(heroId, progression.selectedBenmingPath)?.id || null;
  if (!selected) progression.selectedBenmingPath = null;
  dom.benmingPathSection.classList.toggle("has-selection", Boolean(selected));
  const effectiveStage = getEffectiveBenmingStage(heroId);
  if (dom.benmingPathTitle) dom.benmingPathTitle.textContent = `${gu?.name || "本命蛊"} · 选择本局路线`;
  dom.benmingPathChoices.setAttribute("aria-label", `选择${gu?.name || "本命蛊"}本命路线`);
  if (dom.benmingPathHint) {
    dom.benmingPathHint.textContent = effectiveStage >= 5
      ? "五转已成。两条路线互斥，每局重新选择；所选路线同时启用五转强化。"
      : "三转已成。两条路线互斥，每局重新选择。";
  }
  dom.benmingPathChoices.innerHTML = Object.values(paths).map((path) => `
    <button class="benming-path-choice ${selected === path.id ? "selected" : ""}" type="button"
      data-benming-path="${path.id}" aria-pressed="${selected === path.id}"
      title="${escapeAttribute([
        `${path.name}（${path.kind}）`,
        `玩法：${path.guide.play}`,
        `注意：${path.guide.caution}`,
        path.guide.benefit ? `优势：${path.guide.benefit}` : "",
        path.guide.guixu ? `五转强化：${path.guide.guixu}` : "",
        `适合：${path.guide.fit}`,
      ].filter(Boolean).join("｜"))}">
      <span class="benming-path-glyph" aria-hidden="true">${path.glyph}</span>
      <span class="benming-path-copy">
        <small>${path.kind}</small>
        <strong>${path.name}</strong>
        <em class="benming-path-guide">
          <span><b>玩法：</b>${path.guide.play}</span>
          <span><b>注意：</b>${path.guide.caution}</span>
          ${path.guide.benefit ? `<span><b>优势：</b>${path.guide.benefit}</span>` : ""}
          ${path.guide.guixu ? `<span><b>五转强化：</b>${path.guide.guixu}</span>` : ""}
          <span><b>适合：</b>${path.guide.fit}</span>
        </em>
        <i class="benming-path-world"><b>身世：</b>${path.lore}</i>
      </span>
    </button>`).join("");
}

/* V0.9.40 QS-1a 命途契栏：挂在整备「挑战模式」步内。契市未解锁（一份契都没有）时整块隐藏零噪音；
 * 解锁后列全部契——可签（已解锁+已实装）/剪影（未解锁：显示条件）/契文将至（数据已立、后批开启）。
 * 点已选契=解约（空签永远合法）。 */
function renderContractSelection() {
  if (!dom.contractSection || !dom.contractChoices || typeof CONTRACTS === "undefined") return;
  // 整备页每次点击都全量重绘：契存储只读一次，map 内复用（低端机 8 次 JSON.parse 会落在点击响应路径上）。
  const contractStore = loadContractStore();
  const unlockedIds = CONTRACT_IDS.filter((id) => contractStore.unlocked[id]);
  dom.contractSection.classList.toggle("hidden", unlockedIds.length === 0);
  if (unlockedIds.length === 0) { progression.selectedContract = null; dom.contractChoices.innerHTML = ""; return; }
  const selectedDef = getContractDefinition(progression.selectedContract);
  // V0.9.51 流派契限本道：换英雄后已签的跨道契自动解约（与建局兜底同一规则）。
  if (!selectedDef || !selectedDef.implemented || !contractStore.unlocked[selectedDef.id]
    || (selectedDef.heroId && selectedDef.heroId !== progression.selectedHeroId)) progression.selectedContract = null;
  const selected = progression.selectedContract;
  if (dom.contractHint) {
    dom.contractHint.textContent = selected
      ? "点已签的契可解约。契只随下一局生效，互斥单签。"
      : "司命人的暗契：改一条规则，标一份代价。可以不签。";
  }
  dom.contractChoices.innerHTML = CONTRACT_IDS.map((id) => {
    const def = CONTRACTS[id];
    const unlocked = Boolean(contractStore.unlocked[id]);
    const heroMismatch = Boolean(def.heroId && def.heroId !== progression.selectedHeroId); // V0.9.51 流派契限本道
    const signable = unlocked && def.implemented && !heroMismatch;
    if (!signable) {
      const heroName = def.heroId ? (HEROES[def.heroId]?.name || def.heroId) : "";
      const stateText = !unlocked ? `未解锁 · ${def.unlockHint}`
        : heroMismatch ? `限${heroName}可签 · 换其出战方可落契`
        : "契文将至 · 下版开签";
      return `<div class="contract-choice is-locked" aria-disabled="true">
        <span class="contract-glyph" aria-hidden="true">${def.glyph}</span>
        <span class="contract-copy"><small>${def.kind}</small><strong>${def.name}</strong><em>${stateText}</em></span>
      </div>`;
    }
    /* V0.9.57 窄横屏信息密度（玩家实报「把选择页面缩小一下」「排版和字幕太难受」）：
     * 「解：解锁出处」保留——那是 QS-1a 定下的设计（让玩家知道契从何来），不擅自推翻；
     * 只在窄横屏用 CSS 收起（见 style.css），且完整内容始终在下面这个 title 里兜底。
     * title 同时写明「整局不可更改」，回应另一位玩家「后悔选了那个不能进坊市的契约」。 */
    return `<button class="contract-choice ${selected === id ? "selected" : ""}" type="button"
      data-contract-id="${id}" aria-pressed="${selected === id}"
      title="${escapeAttribute(`${def.name}｜得：${def.summary}｜偿：${def.cost}｜解：${def.unlockHint}（签下后整局不可更改）`)}">
      <span class="contract-glyph" aria-hidden="true">${def.glyph}</span>
      <span class="contract-copy">
        <small>${def.kind}</small>
        <strong>${def.name}</strong>
        <em><b>得：</b>${def.summary}</em>
        <em class="contract-cost"><b>偿：</b>${def.cost}</em>
        <em class="contract-unlock-source"><b>解：</b>${def.unlockHint}</em>
        <i class="contract-lore">${def.lore}</i>
      </span>
    </button>`;
  }).join("");
}

function ensureBenmingPathSelected() {
  if (!isBenmingPathRequiredForTitle()) return true;
  const heroId = progression.selectedHeroId;
  if (getBenmingPathDefinition(heroId, progression.selectedBenmingPath)) return true;
  const names = Object.values(BENMING_PATHS[heroId] || {}).map((path) => `「${path.name}」`).join("或");
  if (dom.runProgress) {
    dom.runProgress.textContent = `${BENMING_GU[heroId]?.name || "本命蛊"}已至三转，请先选择${names}。`;
    dom.runProgress.classList.remove("hidden");
  }
  dom.benmingPathSection?.classList.add("needs-choice");
  setPrepStep("hero", { focus: false });
  window.setTimeout(() => dom.benmingPathChoices?.querySelector("button")?.focus(), 180);
  return false;
}

function renderTitleScreen() {
  const selectedHeroId = HEROES[progression.selectedHeroId] ? progression.selectedHeroId : "fate";
  progression.selectedHeroId = selectedHeroId;
  const fateCards = Object.entries(HEROES).map(([id, hero]) => {
    const selected = id === selectedHeroId;
    const thumb = Array.isArray(PORTRAIT_PATHS.heroes[id]) ? PORTRAIT_PATHS.heroes[id][0] : PORTRAIT_PATHS.heroes[id];
    const bestSeal = getHeroBestSealMode(id);
    const tianTierN = getTianCleared(id);
    const mark = tianTierN > 0
      ? `<b class="hero-seal-mark seal-tian" title="天印 · 已通至第 ${tianTierN} 重">天${tianTierN}</b>`
      : (bestSeal ? `<b class="hero-seal-mark ${SEAL_MODE_META[bestSeal].cls}" title="${SEAL_MODE_META[bestSeal].full}">${SEAL_MODE_META[bestSeal].label}</b>` : "");
    const bi = getBenmingStageInfo(id);
    const gu = BENMING_GU[id];
    const guMark = (gu && bi.stage > 0) ? `<em class="hero-benming-mark" title="${gu.name} · ${bi.stageName}">${gu.glyph}</em>` : "";
    return `<article class="hero-fate-card tone-${id} ${selected ? "selected" : ""}">
      <button class="hero-fate-select" type="button" data-hero-id="${id}" aria-pressed="${selected}" title="选择${hero.name}">
        <span class="hero-fate-thumb"><i>${hero.glyph}</i><img src="${thumb}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>
        <span class="hero-fate-copy">
          <small>${hero.role}<em>${HERO_DIFFICULTY_LABELS[id]}</em></small>
          <strong>${hero.name}</strong>
          <span class="hero-fate-passive" title="${escapeAttribute(`${hero.passiveName}：${hero.passive}`)}">${HERO_CORE_SUMMARIES[id]}</span>
        </span>
        ${mark}${guMark}
      </button>
      <button class="hero-fate-detail" type="button" data-hero-detail="${id}" aria-label="查看${hero.name}完整详情">详情</button>
    </article>`;
  }).join("");
  dom.heroChoices.innerHTML = `<div class="hero-fate-grid">${fateCards}</div>`;
  renderBenmingPathSelection();
  renderStarterGuSelection();

  // V0.9.19 十重天·八重孤行：选十重天且重数≥8 时，本命遗物只开放前两枚（后两枚上锁标注）。
  // V0.9.55：十重天解锁条件由死劫金印改为精英通关，此处同步换闸，否则老玩家选到八重却不触发孤行。
  const tianLoneWalk = selectedMode === "tian" && progression.eliteUnlocked && selectedTianTier >= 8;
  const relicEntries = Object.entries(RELICS);
  if (tianLoneWalk && relicEntries.findIndex(([id]) => id === progression.selectedRelicId) >= 2) {
    progression.selectedRelicId = relicEntries[0][0]; // 已选中被锁遗物则回落第一枚
  }
  dom.relicChoices.innerHTML = relicEntries.map(([id, relic], idx) => {
    const lockedByLoneWalk = tianLoneWalk && idx >= 2;
    return `<button class="relic-choice ${id === progression.selectedRelicId ? "selected" : ""} ${lockedByLoneWalk ? "is-locked" : ""}"
      type="button" data-relic-id="${id}" aria-pressed="${id === progression.selectedRelicId}"
      aria-label="${escapeAttribute(`${relic.name}。${lockedByLoneWalk ? "孤行第八重，此遗物不可选择。" : relic.description}`)}"
      title="${escapeAttribute(`${relic.name}｜${lockedByLoneWalk ? "孤行第八重，此遗物不可选择。" : relic.description}`)}"${lockedByLoneWalk ? " disabled aria-disabled=\"true\"" : ""}>
      ${getRelicChoiceArtHtml(id, relic)}
      <div><strong>${relic.name}${lockedByLoneWalk ? "（锁）" : ""}</strong><small>${lockedByLoneWalk ? "孤行（第八重）：此行只许两件行囊。" : relic.description}</small></div>
    </button>`;
  }).join("");

  renderModeChoices();
  renderContractSelection(); // V0.9.40 QS-1a：契栏随整备重绘（未解锁契市时自隐藏）
  updatePrepSelectionSummary();
  syncPrepStepUi();
  updateResumeRunButton(); // V0.9.8.7 自动续局：有存档则显示「继续上一局」
  dom.runProgress.classList.add("hidden");
  refreshCollectionHubBadges();
}

function refreshCollectionHubBadges() {
  const apply = (element, notice) => {
    if (!element) return;
    const visible = Boolean(notice && notice.count > 0 && notice.label);
    element.textContent = visible ? notice.label : "";
    element.classList.toggle("hidden", !visible);
  };
  apply(dom.collectionBadge, typeof getCodexHubNotice === "function" ? getCodexHubNotice() : null);
  apply(dom.guluBadge, typeof getGuluHubNotice === "function" ? getGuluHubNotice() : null);
  refreshHomeLeaderboardEntry();
}

// 主页登天榜入口始终占位；未解锁时禁用并明示条件，避免功能凭空消失。
// 无尽与精英共用同一把解锁钥匙（progression.eliteUnlocked＝通关任意路线），与 renderModeChoices 同源。
function refreshHomeLeaderboardEntry() {
  const unlocked = !!progression.eliteUnlocked;
  if (dom.leaderboardOpenButton) {
    dom.leaderboardOpenButton.disabled = !unlocked;
    dom.leaderboardOpenButton.classList.toggle("is-locked", !unlocked);
    dom.leaderboardOpenButton.title = unlocked
      ? "登天榜：无尽登塔 · 最深层名次"
      : "登天榜未解锁：通关任意路线后开放";
  }
  if (dom.leaderboardEntryTitle) dom.leaderboardEntryTitle.textContent = unlocked ? "登天榜" : "登天榜 · 未解锁";
  if (dom.leaderboardEntryHint) {
    dom.leaderboardEntryHint.textContent = unlocked ? "无尽登塔 · 最深层名次" : "未解锁 · 通关任意路线";
  }
}

// V0.9.8.3：开始界面挑战模式选择（普通/精英），精英在首次通关前锁定。
function renderModeChoices() {
  if (!dom.modeChoices) return;
  const unlocked = !!progression.eliteUnlocked;
  /* V0.9.55 用户定调：移除死劫模式。
   * 理由（查证后确认的结构冗余）：死劫压力 1.5/1.4、奖励 1.9，唯一功能是解锁十重天；
   * 而十重天第三四重即全面追平其压力与奖励、第十重同样无续局。金印到手后再无理由重进，
   * 它只是占着模式列表的一格徒增认知负担。
   * 十重天改由「精英通关」解锁；deathtrialCleared 仅作历史金印保留，不再是任何门槛。 */
  const tianUnlocked = unlocked;
  if (!unlocked && selectedMode === "elite") selectedMode = "normal";
  if (selectedMode === "deathtrial") selectedMode = "normal"; // 老档若停在死劫，选择页一律回落普通
  if (!tianUnlocked && selectedMode === "tian") selectedMode = "normal"; // 未解锁十重天则回落
  if (!unlocked && selectedMode === "endless") selectedMode = "normal"; // V0.9.51 未通关则无尽回落
  const heroId = progression.selectedHeroId;
  const tianCleared = getTianCleared(heroId);
  const tianMaxSel = getTianMaxSelectable(heroId);
  selectedTianTier = clampTianTier(Math.min(selectedTianTier, tianMaxSel)); // 换英雄后按其进度收敛
  const tianDesc = tianUnlocked
    ? `天梯十重，层层加压，重重厚赏——登得越高，赏得越厚；${HEROES[heroId]?.name || "此蛊修"}已通至第 ${tianCleared} 重。第十重无续局。`
    : "通关任意路线后解锁。";
  const modes = [
    { id: "normal", name: "普通模式", desc: "标准命途，稳步求生。", locked: false },
    { id: "elite", name: "精英模式", desc: unlocked ? "万蛊更凶，回报更厚（敌人约 +25% 强、奖励 +50%）。" : "通关任意路线后解锁。", locked: !unlocked },
    { id: "tian", name: "十重天", desc: tianDesc, locked: !tianUnlocked }, // V0.9.19 批1
    // V0.9.51 无尽：通关任意路线后解锁；无终点，越深越凶，每 3 层加一条词条。
    { id: "endless", name: "无尽登塔", desc: unlocked
      ? "塔无尽头——层层加压，每 3 层添一条命途词条；死于何层，便是此行的答案。"
      : "通关任意路线后解锁。", locked: !unlocked },
  ];
  let html = modes.map((m) => {
    const modeButton = `<button class="mode-choice ${selectedMode === m.id ? "selected" : ""} ${m.locked ? "is-locked" : ""}"
      type="button" data-run-mode="${m.id}" aria-pressed="${selectedMode === m.id}"${m.locked ? " aria-disabled=\"true\"" : ""}>
      <strong>${m.name}${m.locked ? "（锁）" : ""}</strong>
      <small>${m.desc}</small>
    </button>`;
    if (m.id !== "endless") return modeButton;
    return `<div class="mode-choice-shell mode-choice-endless">${modeButton}
      <button class="mode-choice-leaderboard" type="button" data-endless-leaderboard-open="mode" ${m.locked ? "disabled" : ""}>${m.locked ? "排行榜未解锁" : "查看排行榜"}</button>
    </div>`;
  }).join("");
  // V0.9.19 十重天：选中时显示重数步进条 + 当前重生效修饰清单（进塔前所见即所得；不嵌进按钮避免非法嵌套）。
  if (tianUnlocked && selectedMode === "tian") {
    const mods = TIAN_TIER_MODS.filter((m) => m.tier <= selectedTianTier)
      .map((m) => `${m.name}(${m.desc})${m.live ? "" : "〔待实装〕"}`).join("、");
    html += `<div class="tian-stepper" aria-label="选择挑战重数">
      <button type="button" data-tian-delta="-1" ${selectedTianTier <= 1 ? "disabled" : ""} aria-label="降低重数">−</button>
      <b>挑战第 ${selectedTianTier} 重</b><i>／可至第 ${tianMaxSel} 重 · 奖励 ×${getTianTuning(selectedTianTier).rewardMul}</i>
      <button type="button" data-tian-delta="1" ${selectedTianTier >= tianMaxSel ? "disabled" : ""} aria-label="提高重数">＋</button>
      <p class="tian-mods">${mods}</p>
    </div>`;
  }
  dom.modeChoices.innerHTML = html;
  if (unlocked && dom.modeChoices.dataset.unlockToast !== "1") {
    dom.modeChoices.dataset.unlockToast = "1";
  }
}

function showStartScreen() {
  if (typeof NmgOutgameReceipts !== "undefined") NmgOutgameReceipts.clear();
  dom.endlessLeaderboardOverlay?.classList.add("hidden");
  dom.heroDetailOverlay?.classList.add("hidden");
  if (dom.resultOverlay) dom.resultOverlay.classList.add("hidden");
  if (dom.deckOverlay) dom.deckOverlay.classList.add("hidden");
  if (dom.loreOverlay) dom.loreOverlay.classList.add("hidden");
  if (dom.balanceOverlay) dom.balanceOverlay.classList.add("hidden");
  if (dom.trialSettingsOverlay) dom.trialSettingsOverlay.classList.add("hidden");
  if (dom.settingsOverlay) dom.settingsOverlay.classList.add("hidden");
  if (dom.prologueOverlay) dom.prologueOverlay.classList.add("hidden"); // V0.9.18：与其他弹窗一致，回标题时强制收起序章
  hideRiteOverlay(); // V0.9.19：回标题时收起仪式弹窗
  if (dom.guluOverlay) { window.clearInterval(guluRefreshTimer); stopGuluAudio(); dom.guluOverlay.classList.add("hidden"); } // V0.9.22 蛊庐同收；V0.9.26 心跳/虫鸣同停
  dom.removePickerOverlay?.classList.add("hidden"); // V0.9.25 删卡弹窗同收
  dom.towerHeartScreen?.classList.add("hidden"); // E-2c2 塔心场景屏同收
  if (dom.mapScreen) dom.mapScreen.classList.add("hidden");
  // V0.9.18：清掉通关结算给 resultDescription 留下的 pre-line（两局之间唯一的必经点），避免泄漏到下一局事件文案。
  if (dom.resultDescription) dom.resultDescription.style.whiteSpace = "";
  closeBattleCoach(false);
  hideKeywordTooltip();
  refreshModalLock();
  dom.startScreen.classList.remove("hidden");
  document.body.classList.add("title-open");
  renderTitleScreen();
  setStartView("home", { focus: false });
  updateTrialModeControls();
  updateMobileViewportState();
  reportGuluNewsOnTitle(); // V0.9.22 蛊庐：离线破卵/静养复元回标题即汇报
  maybeAutoOpenIntro();
  // V0.9.36 BGM 冷加载再治理：菜单驻留（选人/遗物/模式）期间就把首战 BGM + 敌方立绘预热好，进第一场秒起播。
  // 错峰 6s 让菜单曲先下；battleAssetsPreloaded 幂等，只真正跑一次，重复进标题不叠计时器。
  if (typeof battleAssetsPreloaded !== "undefined" && !battleAssetsPreloaded) {
    window.setTimeout(() => { try { preloadBattleAssets(); } catch (e) { /* 忽略 */ } }, 6000);
  }
}

/* V0.9.51 通用货币图标（用户定调：不要汉字）：蛊石＝一枚缠蛊纹的六棱石印。
 * 纯内联 SVG（无外部资源、随字色走 currentColor），比"蛊石"二字更快辨认，也不吃字体。 */
const GU_STONE_ICON = '<svg class="gu-stone-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M12 2.6 20.2 7v10L12 21.4 3.8 17V7z" fill="rgba(120,84,32,.34)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'
  + '<path d="M12 7.4c-2.5 0-3.6 1.7-3.6 3.2 0 1.6 1.2 2.7 2.7 2.7 1.2 0 2-.7 2-1.6 0-.8-.6-1.3-1.3-1.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
  + '<circle cx="12" cy="16.1" r="1.05" fill="currentColor"/></svg>';

function updateGuStoneDisplays() {
  const value = runState?.guStones ?? 0;
  if (dom.topGuStone) dom.topGuStone.innerHTML = `${GU_STONE_ICON}<strong>${value}</strong>`;
  if (dom.mapGuStones) dom.mapGuStones.innerHTML = `${GU_STONE_ICON}<strong>${value}</strong>`;
  if (dom.shopGuStones) dom.shopGuStones.textContent = value;
  updateTopMaterials();
}

/* V0.9.51 顶栏材料常驻条（用户定调）：只列持有量 >0 的材料，一件都没有时整条隐藏不占位——
 * 既让材料随时可见，又不给空栏挤掉本就紧张的横屏顶栏。数字走 title 备注全名，符印取 MATERIALS.glyph。 */
function updateTopMaterials() {
  const el = dom.topMaterials;
  if (!el) return;
  const owned = runState
    ? MATERIAL_IDS.filter((id) => (runState.materials?.[id] || 0) > 0)
    : [];
  if (!owned.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.classList.remove("hidden");
  const collapsed = el.classList.contains("is-collapsed");
  const total = owned.reduce((sum, id) => sum + Math.max(0, runState.materials[id] | 0), 0);
  const chips = owned.map((id) => {
    const m = MATERIALS[id];
    return `<span class="top-mat mat-${escapeAttribute(m.tone)}" title="${escapeAttribute(m.name)}：${escapeAttribute(m.short)}"><b>${escGu(m.glyph)}</b><i>${runState.materials[id]}</i></span>`;
  }).join("");
  el.innerHTML = `<button type="button" class="top-materials-toggle" data-top-materials-toggle="1" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? `展开炼蛊材料，共 ${owned.length} 种 ${total} 份` : "收起炼蛊材料"}" title="${collapsed ? `材料 ${owned.length} 种 · 共 ${total} 份` : "收起材料栏"}">${collapsed ? `材 ${owned.length}` : "收"}</button>${chips}`;
}

function gainGuStones(amount, source = "命途所得", { raw = false, log = true } = {}) {
  if (!runState || !amount) return 0;
  // V0.9.8.3 精英模式：蛊石收益按模式系数提升（战斗/事件/休整统一更肥）。
  // V0.9.12.1：raw=true 跳过模式系数——等价兑换类收入（焚寿易石/命轨铜钱）不吃奖励加成，堵死劫"一买一卖净套利"。
  if (!raw) amount = Math.round(amount * (getModeTuning().rewardMul || 1));
  runState.guStones += amount;
  if (log) addLog(`${source}：获得 ${amount} 蛊石。`, "positive-log");
  updateGuStoneDisplays();
  return amount;
}

function spendGuStones(amount) {
  if (!runState || runState.guStones < amount) return false;
  runState.guStones -= amount;
  updateGuStoneDisplays();
  return true;
}

function gainMaterial(materialId, count = 1, source = "命途所得", { log = true } = {}) {
  if (!runState || !MATERIALS[materialId]) return;
  runState.materials[materialId] = (runState.materials[materialId] || 0) + count;
  runState.materialHistory[materialId] = (runState.materialHistory[materialId] || 0) + count;
  if (log) addLog(`${source}：获得「${MATERIALS[materialId].name}」x${count}。`, "positive-log");
  unlockLorePage("fiveMaterials", { silent: !log });
  updateTopMaterials(); // V0.9.51 顶栏材料条随获得即时刷新
}

function getCurrentEcologyMaterialId(node = getCurrentRunNode()) {
  const theme = node?.l2theme || node?.l3theme || getCurrentRouteId?.();
  return ({ miasma: "miasmaMossSac", bloodmarsh: "bloodMarshMarrow", bone: "weatheredBoneSalt", beehive: "mysticHiveWax" })[theme] || "";
}

function gainEcologyMaterial(materialId, count = 1, source = "栖地所得") {
  if (!runState || !ECOLOGY_MATERIALS[materialId]) return 0;
  runState.ecologyMaterials ||= {};
  runState.ecologyMaterials[materialId] = (runState.ecologyMaterials[materialId] | 0) + Math.max(0, count | 0);
  addLog(`${source}：获得「${ECOLOGY_MATERIALS[materialId].name}」×${count}。`, "positive-log");
  return count;
}

function grantEcologyBattleReward(node = getCurrentRunNode()) {
  const materialId = getCurrentEcologyMaterialId(node);
  if (!materialId || !["battle", "elite", "defy"].includes(node?.type)) return 0;
  const guaranteed = node.type === "elite" || node.type === "defy";
  if (!guaranteed && getRunRandom("reward") >= 0.3) return 0;
  return gainEcologyMaterial(materialId, 1, guaranteed ? "凶煞栖地战利" : "栖地战利");
}

function grantEcologyEventReward(node = getCurrentRunNode()) {
  const materialId = getCurrentEcologyMaterialId(node);
  if (!materialId || node?.type !== "event") return 0;
  runState.ecologyRewardedNodeIds ||= [];
  if (runState.ecologyRewardedNodeIds.includes(node.id)) return 0;
  runState.ecologyRewardedNodeIds.push(node.id);
  return gainEcologyMaterial(materialId, 1 + getRunRandomInt(2, "reward"), "生态机缘");
}

function hideRewardPanels() {
  dom.resultOverlay?.querySelector(".result-card")?.classList.remove("reward-choice-active", "reward-confirming", "material-choice-active", "material-confirming", "furnace-choice-active", "furnace-confirming");
  dom.cardRewardConfirm?.classList.add("hidden");
  dom.materialRewardConfirm?.classList.add("hidden");
  if (runState) {
    runState.pendingRewardPick = null;
    runState.pendingMaterialPick = null;
  }
  dom.cardRewardPanel?.classList.add("hidden");
  dom.bossRewardReceipt?.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel?.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.shopRemovePanel?.classList.add("hidden");
  dom.removePickerOverlay?.classList.add("hidden"); // V0.9.25 删卡弹窗随重置收起
  dom.shopCloseButton?.classList.add("hidden"); // V0.9.9.2 蛊坊叉号：非蛊坊态隐藏
  dom.runSummary?.classList.add("hidden");
  dom.resultLoreButton?.classList.add("hidden");
}

function showBossRewardReceipt() {
  const reward = runState?.lastBattleRewards;
  if (!dom.bossRewardReceipt || reward?.type !== "boss") {
    dom.bossRewardReceipt?.classList.add("hidden");
    return;
  }
  dom.bossRewardStones.textContent = Math.max(0, Number(reward.stones) || 0);
  dom.bossRewardCores.textContent = Math.max(0, Number(reward.bossCores) || 0);
  dom.bossRewardReceipt.classList.remove("hidden");
}

function triggerHeroVoice(event) {
  try {
    const heroId = game?.player?.heroId || runState?.heroId || progression?.selectedHeroId;
    return window.NMGVoiceDirector?.trigger?.(event, { heroId, turn: game?.turn }) || false;
  } catch (error) {
    recordRuntimeDiagnostic(error, "hero voice");
    return false;
  }
}

function checkHeroLowLife(beforeHp) {
  if (!game?.player) return;
  if (beforeHp > game.player.maxHp * 0.3 && game.player.hp <= game.player.maxHp * 0.3) triggerHeroVoice("lowlife");
}

function showMapScreen() {
  if (!runState || !dom.mapScreen) return;
  window.NMGVoiceDirector?.stop?.();
  dom.towerHeartScreen?.classList.add("hidden"); // E-2c2：命途图与塔心屏互斥（重开新局等路径兜底）
  clearCombatEffects();
  game = null;
  switchLogChannel("journey");
  dom.startScreen.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  dom.deckOverlay?.classList.add("hidden");
  dom.trialSettingsOverlay?.classList.add("hidden");
  dom.settingsOverlay?.classList.add("hidden");
  dom.mapScreen.classList.remove("hidden");
  document.body.classList.remove("title-open");
  refreshModalLock();
  window.AudioManager?.playScene("menu", { duration: 520, quiet: true });
  renderMapScreen();
  updateMobileViewportState();
  saveRunStateToStorage(); // V0.9.8.7 自动续局：每次回到地图（节点之间）写档
  flushPendingRelicOffer(); // V0.9.9.2 回图统一弹出待抉择遗物（收取/舍弃）
  scheduleCurrentMapSegmentFocus();
}

function getMapNodeState(node) {
  const currentStep = getCurrentRouteStep();
  if (runState.completedNodes.includes(node.id)) return "completed";
  if (runState.lockedNodes.includes(node.id)) return "locked";
  if (node.step < currentStep) return "locked";
  if (node.step > currentStep) return "unlocked";
  return "available";
}

function getMapMaterialSummary() {
  if (!runState) return "材料 0";
  const total = MATERIAL_IDS.reduce((sum, id) => sum + (runState.materials[id] || 0), 0);
  const owned = MATERIAL_IDS
    .filter((id) => (runState.materials[id] || 0) > 0)
    .map((id) => `${MATERIALS[id].name}x${runState.materials[id]}`)
    .join("、");
  return owned || String(total);
}

function getMapDefeatedSummary() {
  return runState?.defeatedEnemies?.length ? runState.defeatedEnemies.join("、") : "0";
}

function getMapNodeStateLabel(node, state) {
  if (state === "completed") return "已踏破";
  if (state === "available") return "当前可选";
  if (state === "locked") {
    if (runState.lockedNodes.includes(node.id)) return "岔路封闭";
    return "未解锁";
  }
  return "未解锁";
}

function getMapTransitionText(type) {
  switch (type) {
    case "battle": return "凶影拦路";
    case "event": return "命途中现异兆";
    case "shop": return "残灯下有蛊坊开门";
    case "elite": return "血煞盘踞，退路已断";
    case "defy": return "逆命搏杀，退路自断";
    case "rest": return "塔隙微明，可暂整蛊息";
    case "boss": return isLayer3Run()
      ? "绝域之主盘踞，杀机已现"
      : (isLayer2Run() ? "生态之主盘踞，杀机已现" : "尸盘转动，守关者苏醒");
    default: return "命途流转";
  }
}

/* ===== V0.9.51 卡死逃生水位线 =====
 * 玩家线上反馈「残卷点进去卡住」，本地无法复现（选牌/跳过/二层/三层路径全通）。
 * 与其针对猜测的具体成因打补丁，不如立一道通用兜底：
 *   结算层(resultOverlay)可见、但其中连续 6 秒没有任何可点击按钮 → 顶部亮出「强行返回命途图」逃生口。
 * 逃生动作只做最小清理（关结算层、解模态锁、回地图），不动存档不动战斗态——
 * 宁可玩家多点一次进错层，不可让人卡死重开。v0.9.46 残卷卡死同款思路的通用化。 */
let stuckWatchdogTimer = null;
let mapWatchdogTimer = null; // V0.9.52 命线图自愈（与结算层看门狗同源、分表）
function startStuckWatchdog() {
  window.clearInterval(stuckWatchdogTimer);
  window.clearInterval(mapWatchdogTimer);
  stuckWatchdogTimer = window.setInterval(() => {
    try {
      const overlay = dom.resultOverlay;
      const escape = document.getElementById("stuckEscapeButton");
      if (!overlay || overlay.classList.contains("hidden") || !runState || runState.status !== "running") {
        if (escape) escape.classList.add("hidden");
        window.__stuckSince = 0;
        return;
      }
      // 结算层里是否存在任何可见可点的按钮（含选牌/确认/继续/逃生自身除外）
      const clickable = [...overlay.querySelectorAll("button:not([disabled])")].some((b) => {
        if (b.id === "stuckEscapeButton") return false;
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !b.closest(".hidden");
      });
      if (clickable) { window.__stuckSince = 0; if (escape) escape.classList.add("hidden"); return; }
      const now = Date.now();
      if (!window.__stuckSince) { window.__stuckSince = now; return; }
      if (now - window.__stuckSince > 6000 && escape) escape.classList.remove("hidden");
    } catch (e) { /* 看门狗自身绝不能抛错 */ }
  }, 1500);
  /* V0.9.52 命线图卡死自愈（玩家反馈「进命线图会卡死」，截图无报错、点击无响应）。
   * 两个已知能造成此症状、又都无法稳定复现的状态残留，各配一道自愈：
   * a) mapTransitionLock 滞留 true：转场锁本该 520ms 由定时器解开，但移动端 WebView 冻结页面时
   *    定时器可能被吞——锁一直在，所有节点点击被 selectMapNode 第一行静默忽略（有点按高亮、无反应）。
   *    锁持续 >4s 即强制解锁并收掉转场幕布。
   * b) 本段无任何可选节点：lockSiblingNodes 后若后续入口没走完（v0.9.46 残卷卡死的通用形态），
   *    本段节点全 locked 且无 completed → 全图无可点。持续 >6s 即解封本段岔路、重渲染，玩家重选。
   * 只在命线图可见、无弹窗时判定；两个动作都不动存档结构、不动战斗态。 */
  mapWatchdogTimer = window.setInterval(() => {
    try {
      const mapVisible = dom.mapScreen && !dom.mapScreen.classList.contains("hidden");
      if (!mapVisible || !runState || runState.status !== "running") {
        window.__mapLockSince = 0; window.__mapDeadSince = 0;
        return;
      }
      // 注意不能用 body.modal-open 当总闸：实测存在年龄门等弹窗未收干净、modal-open 恒 true 的档，
      // 那正是玩家卡死的现场。解滞留锁永远无害；解封岔路只需结算层（节点流程唯一宿主）不在即可。
      const now = Date.now();
      if (mapTransitionLock) {
        if (!window.__mapLockSince) window.__mapLockSince = now;
        else if (now - window.__mapLockSince > 4000) {
          mapTransitionLock = false;
          dom.mapTransition?.classList.add("hidden");
          dom.mapTransition?.classList.remove("show");
          window.__mapLockSince = 0;
          addJourneyLog("命途异动：一阵停滞的雾气散去，脚下的命线重新亮起。", "system-log");
        }
        return; // 锁未解前不判 b——解锁后节点自然可点
      }
      window.__mapLockSince = 0;
      if (dom.resultOverlay && !dom.resultOverlay.classList.contains("hidden")) { window.__mapDeadSince = 0; return; } // 奖励/事件/确认正开着，岔路锁着是常态
      const step = getCurrentRouteStep();
      const nodes = (runState.mapState?.segments || []).flat().filter((n) => n && n.step === step);
      const anyAvailable = nodes.some((n) => getMapNodeState(n) === "available");
      const anyCompleted = nodes.some((n) => runState.completedNodes.includes(n.id));
      if (!nodes.length || anyAvailable || anyCompleted) { window.__mapDeadSince = 0; return; }
      if (!window.__mapDeadSince) { window.__mapDeadSince = now; return; }
      if (now - window.__mapDeadSince > 6000) {
        window.__mapDeadSince = 0;
        const ids = new Set(nodes.map((n) => n.id));
        runState.lockedNodes = runState.lockedNodes.filter((id) => !ids.has(id));
        addJourneyLog("命途异动：被封死的岔路裂开一线，本段命线重新可选。", "system-log");
        renderMapScreen();
      }
    } catch (e) { /* 自愈自身绝不能抛错 */ }
  }, 1500);
}
function escapeStuckOverlay() {
  try {
    window.__stuckSince = 0;
    document.getElementById("stuckEscapeButton")?.classList.add("hidden");
    dom.resultOverlay?.classList.add("hidden");
    hideRewardPanels();
    refreshModalLock();
    if (runState && runState.status === "running") showMapScreen();
    addJourneyLog("命途异动：你从一处停滞的界面脱身，回到命途图。", "system-log");
  } catch (e) { /* 逃生自身兜底 */ }
}

function showMapTransition(text, callback) {
  window.clearTimeout(mapTransitionTimer);
  if (!dom.mapTransition || !dom.mapTransitionText) {
    mapTransitionLock = false;
    callback?.();
    return;
  }
  dom.mapTransitionText.textContent = text;
  dom.mapTransition.classList.remove("hidden");
  dom.mapTransition.classList.remove("show");
  void dom.mapTransition.offsetWidth;
  dom.mapTransition.classList.add("show");
  mapTransitionLock = true;
  mapTransitionTimer = window.setTimeout(() => {
    dom.mapTransition.classList.add("hidden");
    dom.mapTransition.classList.remove("show");
    mapTransitionLock = false;
    callback?.();
  }, 520);
}

function showMapNotice(text) {
  window.clearTimeout(mapNoticeTimer);
  if (!dom.mapNotice || !text) return;
  dom.mapNotice.textContent = text;
  dom.mapNotice.classList.remove("hidden");
  mapNoticeTimer = window.setTimeout(() => {
    dom.mapNotice.classList.add("hidden");
    if (runState?.lastMapNotice === text) runState.lastMapNotice = "";
  }, 1200);
}

function scheduleCurrentMapSegmentFocus() {
  window.clearTimeout(mapFocusTimer);
  mapFocusTimer = window.setTimeout(() => {
    focusCurrentMapSegment();
  }, 90);
}

function focusCurrentMapSegment() {
  if (!runState || !dom.mapScreen || !dom.mapRoute || dom.mapScreen.classList.contains("hidden")) return;
  const maxStep = getRouteMaxStep();
  const currentStep = Math.max(1, Math.min(maxStep, getCurrentRouteStep()));
  const availableSegment = dom.mapRoute.querySelector(".map-node.available")?.closest(".map-segment");
  const target = dom.mapRoute.querySelector(`[data-map-step="${currentStep}"]`)
    || availableSegment
    || dom.mapRoute.querySelector(".map-segment");
  if (!target) return;

  dom.mapRoute.querySelectorAll(".map-segment-focus").forEach((segment) => {
    segment.classList.remove("map-segment-focus");
  });

  const scrollHost = target.closest(".map-card") || dom.mapScreen;
  const targetTop = Math.max(0, target.offsetTop - 12);
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (typeof scrollHost.scrollTo === "function") {
    scrollHost.scrollTo({ top: targetTop, left: 0, behavior: reduceMotion ? "auto" : "smooth" });
  } else {
    scrollHost.scrollTop = targetTop;
  }

  target.classList.add("map-segment-focus");
  window.clearTimeout(mapFocusTimer);
  mapFocusTimer = window.setTimeout(() => {
    target.classList.remove("map-segment-focus");
    mapFocusTimer = null;
  }, 1500);
}

function getNodeCompleteNotice(node) {
  if (!node) return "";
  if (node.type === "shop") return "蛊坊交易已毕";
  if (node.type === "event") return runState.lastEventNotice || "机缘已定";
  if (node.type === "elite") return `${ENEMY_LIBRARY[node.enemyId]?.name || "精英"}已败`;
  if (node.type === "defy") return `逆命搏杀：${ENEMY_LIBRARY[node.enemyId]?.name || "绝敌"}已伏诛`;
  if (node.type === "rest") return runState.lastRestResult || "休整已毕";
  if (node.type === "boss") return `${ENEMY_LIBRARY[node.enemyId]?.name || "尸盘监守"}已破`;
  return `${node.name}已伏诛`;
}

const MAP_NODE_PRESENTATIONS = Object.freeze({
  battle: { name: "凶兽交锋", glyph: "⚔", preview: "敌影未明" },
  elite: { name: "凶煞拦路", glyph: "煞", preview: "强敌盘踞" },
  defy: { name: "逆命搏杀", glyph: "逆", preview: "绝敌未明" },
  boss: { name: "区域主宰", glyph: "主", preview: "主宰盘踞" },
  event: { name: "未知机缘", glyph: "？", preview: "吉凶未定" },
  shop: { name: "蛊坊交易", glyph: "石", preview: "以石易物" },
  rest: { name: "塔隙休整", glyph: "息", preview: "调息整备" },
  reward: { name: "残卷馈赠", glyph: "卷", preview: "取卷择道" },
});

function getMapNodePublicName(node) {
  const presentation = MAP_NODE_PRESENTATIONS[node?.type];
  return presentation ? presentation.name : "未知命途";
}

function getMapNodeGlyph(node) {
  return MAP_NODE_PRESENTATIONS[node?.type]?.glyph || node?.icon || "·";
}

function getMapNodePreviewText(node) {
  return MAP_NODE_PRESENTATIONS[node?.type]?.preview || "前路未明";
}

function describeMapNodeChoice(node) {
  const type = node?.type || "unknown";
  const presentations = {
    battle: { kind: "凶兽节点", risk: "风险：遭遇当前区域的普通敌人。", reward: "收益：战后蛊牌与材料。" },
    elite: { kind: "凶煞节点", risk: "风险：更强敌人，失败即止步。", reward: "收益：稀有蛊牌、额外资源与炼蛊机会。" },
    defy: { kind: "逆命搏杀", risk: "风险：舍弃安稳路线，直面强敌。", reward: "收益：厚赏与炼蛊机会。" },
    boss: { kind: "区域主宰", risk: "风险：本区域最终检验。", reward: "收益：Boss 核心与深入命途的资格。" },
    event: { kind: "机缘节点", risk: "风险：选择可能伴随代价。", reward: "收益：由你的抉择决定。" },
    shop: { kind: "蛊坊节点", risk: "风险：需要消耗蛊石。", reward: "收益：购入蛊牌、材料或整顿蛊囊。" },
    rest: { kind: "休整节点", risk: "风险：放弃本段战利。", reward: "收益：恢复状态，为下一战整备。" },
    reward: { kind: "残卷节点", risk: "风险：路线将由此锁定。", reward: "收益：取得当前路线的残卷馈赠。" },
  };
  return presentations[type] || { kind: "命途节点", risk: "风险：前路未明。", reward: "收益：踏入后揭晓。" };
}

function renderMapSelection() {
  const node = selectedMapNodeId ? getMapNodeById(selectedMapNodeId) : null;
  const available = node && getMapNodeState(node) === "available";
  const copy = describeMapNodeChoice(available ? node : null);
  if (dom.mapSelectionKind) dom.mapSelectionKind.textContent = copy.kind;
  if (dom.mapSelectionName) dom.mapSelectionName.textContent = available ? getMapNodePublicName(node) : "尚未择路";
  if (dom.mapSelectionRisk) dom.mapSelectionRisk.textContent = copy.risk;
  if (dom.mapSelectionReward) dom.mapSelectionReward.textContent = copy.reward;
  if (dom.mapNodeConfirmButton) {
    dom.mapNodeConfirmButton.disabled = !available;
    dom.mapNodeConfirmButton.textContent = available ? `踏入 · ${getMapNodePublicName(node)}` : "踏入";
  }
  dom.mapRoute?.querySelectorAll("[data-map-node]").forEach((button) => {
    const selected = available && button.dataset.mapNode === node.id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderMapScreen() {
  if (!runState || !dom.mapRoute) return;
  updateGuStoneDisplays();
  const currentStep = getCurrentRouteStep();
  const stepText = currentStep <= getRouteMaxStep() ? `第 ${currentStep} 段` : "终局";
  const __isL3Map = isLayer3Run();
  const __isL2Map = isLayer2Run();
  dom.mapDescription.textContent = __isL3Map
    ? (currentStep === 1
        ? "绝域歧路重新铺开，两头凶影各踞一径。择一而行，另一岔路将闭。"
        : currentStep === 2
          ? "深处再裂：迎绝域精英、探机缘，或入残灯蛊坊。"
          : isRouteBossSegment(currentStep, runState)
            ? "绝域之主盘踞末路，破之则命途踏尽。"
            : isRestRouteStep(currentStep)
              ? "临门：残卷遗落于此，拾之倾向此径之道，或在此偷得一息。"
              : "绝域深处岔口交错：凶影、机缘、蛊坊与逆命搏杀错落，择一而行。")
    : __isL2Map
    ? (currentStep === 1
        ? "生态歧路重新铺开，两头凶影各踞一径。择一而行，另一岔路将闭。"
        : currentStep === 2
          ? "深处再裂：迎生态精英、探机缘，或入残灯蛊坊。"
          : isRouteBossSegment(currentStep, runState)
            ? "生态之主盘踞末路，破之则深行已尽。"
            : isRestRouteStep(currentStep)
              ? "临门：残卷遗落于此，拾之倾向此径之道，或在此偷得一息。"
              : "生态深处岔口交错：凶影、机缘、蛊坊与逆命搏杀错落，择一而行。")
    : (currentStep === 1
    ? "塔路初分，凶兽各踞一阶。择一而行，另一岔路将闭。"
    : currentStep === 2
      ? "命途再裂：取机缘、入蛊坊，或迎血煞精英。"
      : isRouteBossSegment(currentStep, runState)
        ? "尸盘已转，守关者在塔顶等你。"
        : isRestRouteStep(currentStep)
          ? "临门分岔：再搏一场，或在塔隙中稍作休整。"
          : "命途深处岔口交错：凶影、机缘、蛊坊与逆命搏杀错落，择一而行。");
  dom.mapHint.textContent = currentStep <= getRouteMaxStep()
    ? "选择发亮节点继续；灰暗岔路本局不再开启。"
    : "命途已尽，等待结算。";
  if (dom.mapStatus) dom.mapStatus.innerHTML = `<span><em>当前</em><strong>${stepText}</strong></span><span class="map-status-hp"><em>生命</em><strong>${runState.currentHp}/${runState.maxHp}</strong></span><span><em>种子</em><strong>${escGu(runState.trialSeed || "无")}</strong></span><span><em>蛊石</em><strong>${runState.guStones}</strong></span>`;
  if (dom.mapProgress) {
    dom.mapProgress.innerHTML = getRouteSteps().map((step) => {
      const state = step < currentStep ? "completed" : step === currentStep ? "current" : "locked";
      return `<span class="${state}">${state === "completed" ? "成" : step}<small>第 ${step} 段</small></span>`;
    }).join("<i></i>");
  }
  const routeNodes = runState.mapState.segments.flat();
  const currentNodes = routeNodes.filter(node => node.step === currentStep);
  const availableIds = currentNodes.filter((node) => getMapNodeState(node) === "available").map((node) => node.id);
  if (!availableIds.includes(selectedMapNodeId)) selectedMapNodeId = availableIds[0] || "";
  const layerName = (__isL3Map || __isL2Map) ? getCurrentRouteName() : "命途塔";
  const segmentTitle = getRouteStageTitle(currentStep, { layerName, layerActive: __isL3Map || __isL2Map });
  const nodes = currentNodes.map((node) => {
    const state = getMapNodeState(node);
    const disabled = state !== "available";
    return `<button class="map-node ${node.type} ${state}" type="button" data-map-node="${node.id}" aria-pressed="false" ${disabled ? "disabled" : ""}>
      <span class="map-node-icon">${getMapNodeGlyph(node)}</span>
      <span class="map-node-type">${getMapNodePublicName(node)}</span>
      <strong>${getMapNodePreviewText(node)}</strong>
      <small>${getMapNodeStateLabel(node, state)}</small>
      <p>${node.description}</p>
    </button>`;
  }).join("");
  dom.mapRoute.innerHTML = `<section class="map-segment segment-step-${currentStep} current" data-map-step="${currentStep}">
    <div class="map-segment-label"><span>${segmentTitle}</span><i></i></div>
    <div class="map-node-row node-count-${currentNodes.length}">${nodes}</div>
  </section>`;
  renderMapSelection();
  renderTowerProgress();
  updateEndlessWithdrawButton();
  updateMapBlessButton();
  if (runState.lastMapNotice) showMapNotice(runState.lastMapNotice);
}

function getMapBlessCurrentContext() {
  const mapVisible = Boolean(dom.mapScreen && !dom.mapScreen.classList.contains("hidden"));
  const rewardVisible = Boolean(dom.resultOverlay && !dom.resultOverlay.classList.contains("hidden"));
  const blockingPanelVisible = [
    dom.deckOverlay, dom.tutorialOverlay, dom.prologueOverlay, dom.loreOverlay, dom.balanceOverlay,
    dom.trialSettingsOverlay, dom.settingsOverlay, dom.overwriteConfirmOverlay, dom.relicOfferOverlay,
    dom.guluOverlay, dom.guluForgeResultOverlay, dom.removePickerOverlay, dom.xianghuoOverlay, dom.ageGateOverlay,
    dom.heroDetailOverlay, dom.endlessLeaderboardOverlay, dom.boneChimeOverlay,
  ].some((panel) => panel && !panel.classList.contains("hidden"));
  return {
    run: runState,
    panel: dom.mapScreen,
    runStatus: runState?.status,
    mapVisible,
    // body.modal-open 可能因旧年龄门等残留而失真；只认地图转场、结算层与当前真实可见的阻塞面板。
    mapOperable: mapVisible && mapTransitionLock !== true && !rewardVisible && !blockingPanelVisible,
    battleActive: Boolean(game),
    rewardVisible,
    finalVisible: Boolean(runState && runState.status !== "running"),
  };
}

/* 战前加持只在可操作命途图出现；非 TapTap 环境无入口。已有待用层数不阻止继续叠加。 */
function updateMapBlessButton() {
  const btn = dom.mapBlessAdButton;
  if (!btn) return;
  const adReady = typeof NmgAds !== "undefined" && NmgAds.isRewardedAvailable() && NmgAds.isSessionEligible();
  const current = getMapBlessCurrentContext();
  const show = adReady && canOfferPreBattleBless(current);
  btn.classList.toggle("hidden", !show);
  if (!show || btn.dataset.busy === "1") return;
  const ads = ensureRunRewardedAds(runState);
  const pending = Math.max(0, Math.floor(Number(ads.blessPending) || 0));
  const label = btn.querySelector("strong");
  const small = btn.querySelector("small");
  btn.removeAttribute("disabled");
  if (label) label.textContent = `看广告 · 战前加持：+${PRE_BATTLE_BLESS.openArmor} 护甲 / +${PRE_BATTLE_BLESS.attackBonus} 攻击`;
  if (small) small.textContent = pending ? `下一场已备 ${pending} 层 · 完整看完才发放` : "主动观看，完整看完才发放";
}

function updateEndlessWithdrawButton() {
  const button = dom.endlessWithdrawButton;
  if (!button) return;
  const visible = Boolean(runState?.status === "running" && isEndlessRun());
  button.classList.toggle("hidden", !visible);
  button.disabled = !visible;
  if (visible) button.textContent = `收手结算 · 带出第 ${Math.max(1, runState.endlessDeepest || runState.endlessFloor || 1)} 层所得`;
}

function withdrawEndlessRun() {
  if (!runState || runState.status !== "running" || !isEndlessRun()) return false;
  const deepest = Math.max(1, runState.endlessDeepest || runState.endlessFloor || 1);
  if (!window.confirm(`将在无尽第 ${deepest} 层收手：本局材料、残核与随行蛊会按“阶段收手”完整带出，并进入排行榜结算。确定离塔吗？`)) return false;
  if (!finalizeRun("withdrawn")) return false;
  updateEndlessWithdrawButton();
  dom.resultOverlay?.classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (typeof updateMobileViewportState === "function") updateMobileViewportState();
  return true;
}

function lockSiblingNodes(node) {
  getCurrentMapSegmentNodes()
    .filter((item) => item.id !== node.id && !runState.lockedNodes.includes(item.id))
    .forEach((item) => runState.lockedNodes.push(item.id));
}

function enterMapNode(node) {
  if (!runState || !node) return;
  if (isEndlessRun()) runState.endlessNodeId = node.id;
  else enterMingtuChapterNode(runState, node);
  /* 残卷奖励节点：只存在于第二/三层，走专门奖励入口（不进战斗）。
     真机卡死修（v0.9.46）：奖励节点必须永远能打开奖励面板。此前仅以 isLayer2Run()/isLayer3Run()（依 act 状态）
     判定分层，一旦续局/坏档致 act 与地图不同步（act 掉回第一层但地图仍是二/三层残卷节点），
     两个分支都不命中 → 落到下方通用分支又无 reward 处理 → lockSiblingNodes 锁死该段 → 全图无可点节点＝卡死。
     现改为：act 状态优先，节点自带 layer3/layer2 标记兜底，再以 openLayer2Reward 作最终兜底，杜绝残卷节点无处可去。 */
  if (node.type === "reward") {
    lockSiblingNodes(node);
    addLog(`命途分岔：你选择了${node.name}。`, "important");
    if (isLayer3Run() || node.layer3) openLayer3Reward({ name: node.name });
    else openLayer2Reward({ name: node.name });
    return;
  }
  lockSiblingNodes(node);
  addLog(`命途分岔：你选择了${node.name}。`, "important");
  if (node.enemyId && (isLayer3Run() || isLayer2Run()) && typeof layer2MarkBestiary === "function") layer2MarkBestiary(node.enemyId);
  if (node.type === "battle" || node.type === "elite" || node.type === "boss" || node.type === "defy") {
    startFloorBattle();
  } else if (node.type === "event") {
    openChanceEvent();
  } else if (node.type === "shop") {
    openShopNode();
  } else if (node.type === "rest") {
    openRestNode();
  }
}

function selectMapNode(nodeId) {
  if (!runState) return;
  if (mapTransitionLock) return; // V0.9.12.1：转场进行中忽略节点点击
  const node = getMapNodeById(nodeId);
  if (!node || getMapNodeState(node) !== "available") return;
  // V0.9.40 QS-1a 空囊契：每层第一次真正前行前，先让司命人独立现身。
  // 拦在 enterMingtuChapterNode / lockSiblingNodes 之前，契事件不吞掉玩家原本选择的节点；相逢后回图重选。
  if (typeof isContractSimingGuaranteed === "function" && isContractSimingGuaranteed(runState) && maybeMeetSiming()) {
    runState.contractForcedSimingPending = true;
    return;
  }
  playUiSfx();
  if (node.type === "elite" || node.type === "defy") {
    openEliteConfirm(node); // 逆命节点复用精英二次确认管线（内部按 node.type 切文案）
    return;
  }
  if (node.type === "reward") { showMapTransition("生态残卷遗落", () => enterMapNode(node)); return; }
  showMapTransition(getMapTransitionText(node.type), () => enterMapNode(node));
}

function openEliteConfirm(node) {
  pendingEliteNodeId = node.id;
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result elite-confirm-result";
  hideRewardPanels();
  const __isDefy = node.type === "defy"; // V0.9.8.6 逆命节点复用此确认面板
  dom.resultSeal.textContent = __isDefy ? "逆" : "煞";
  dom.resultEyebrow.textContent = __isDefy ? "命途分岔 · 逆命" : "命途分岔 · 精英";
  dom.resultTitle.textContent = (node.enemyId && typeof ENEMY_LIBRARY !== "undefined" && ENEMY_LIBRARY[node.enemyId]?.name) || (__isDefy ? "逆命绝敌" : "血纹狼王");
  dom.resultDescription.textContent = __isDefy
    ? "逆命搏杀：舍弃本段常规收益，立挑强于寻常的绝敌；胜则厚赏（稀有蛊·额外蛊石·遗物·蛊炉），败则命殒。若暂不搏命，可回命途图另择一径。"
    : "此战风险更高，胜后奖励更厚。若暂不进入，可回到命途图重新考虑。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.eliteConfirmPanel?.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function confirmEliteBattle() {
  const node = getMapNodeById(pendingEliteNodeId);
  if (!node || getMapNodeState(node) !== "available") return;
  pendingEliteNodeId = "";
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  dom.mapScreen?.classList.remove("hidden");
  showMapTransition(getMapTransitionText(node.type), () => enterMapNode(node));
}

function cancelEliteBattle() {
  pendingEliteNodeId = "";
  dom.resultOverlay.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  refreshModalLock();
  showMapScreen();
}

function completeCurrentNodeAndReturnMap() {
  if (isEndlessRun()) return completeEndlessNodeAndReturnMap();
  const node = getCurrentRunNode();
  if (!runState || !node) return;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  runState.lastMapNotice = getNodeCompleteNotice(node);
  if (node.step === 2 && !runState.bossPrepRelicGranted) {
    const relicId = queueRelicOffer("命途整备"); // V0.9.9.2：改为登记待抉择，回图弹窗由玩家收取/舍弃
    runState.bossPrepRelicGranted = true;
    if (relicId) {
      runState.lastMapNotice = `${runState.lastMapNotice}；命途整备得遗物「${ORDINARY_RELICS[relicId].name}」待抉择`;
    }
  }
  addLog(`命途记录：${runState.lastMapNotice}。`, "important");
  advanceMingtuChapterNode(runState, node);
  showMapScreen();
}

function completeCurrentBattleNode() {
  const node = getCurrentRunNode();
  if (!runState || !node) return;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  syncMingtuLegacyLocationShadow(runState, node);
}

function startNewRun() {
  if (!ensureBenmingPathSelected()) return false;
  cardSerial = 0;
  const nextRun = createRunState();
  const pendingRedeemStore = typeof getGuluStore === "function" ? getGuluStore() : null;
  const pendingRedeemRewards = typeof getPendingRunRedeemRewards === "function"
    ? getPendingRunRedeemRewards(pendingRedeemStore)
    : [];
  const pendingRedeemResult = typeof applyPendingRunRedeemRewards === "function"
    ? applyPendingRunRedeemRewards(nextRun, pendingRedeemRewards)
    : { ok: true };
  const copyValidation = validateStartDeckCopyLimits(nextRun.deckCards);
  if (!copyValidation.ok) {
    const detail = copyValidation.violations
      .map((item) => `${item.name} ${item.count} 张（同名最多 ${item.limit} 张）`)
      .join("；");
    if (dom.prepSelectionSummary) dom.prepSelectionSummary.textContent = `暂不能入塔：${detail}。请在蛊庐调整随行蛊。`;
    return false;
  }
  if (pendingRedeemResult.ok && pendingRedeemRewards.length) {
    if (typeof clearPendingRunRedeemRewards === "function") clearPendingRunRedeemRewards(pendingRedeemStore);
    if (typeof saveGuluStore === "function") saveGuluStore();
  }
  runState = nextRun;
  window.NMGVoiceDirector?.resetRun?.();
  progression.selectedBenmingPath = null;
  progression.selectedContract = null; // V0.9.40 契与路线同步清空：每局重新郑重签订
  resetAllLogs();
  addJourneyLog(`命途图展开：塔路分岔已显现。命途种子：${runState.trialSeed}。`, "important");
  addJourneyLog(`试炼模式：${getTrialModeInfo(runState.trialMode).name}。`, "system-log");
  if (pendingRedeemResult.ok && pendingRedeemResult.applied > 0) {
    addJourneyLog(`兑换码待领取奖励已入命途：${pendingRedeemResult.rewardLines.join("、")}。`, "positive-log");
  } else if (!pendingRedeemResult.ok && pendingRedeemRewards.length) {
    addJourneyLog("兑换码待领取奖励与本局蛊囊或丹囊冲突，仍保留在蛊庐待领取。", "system-log");
  }
  if (getRunBenmingPath(runState)) {
    addJourneyLog(`本命路线：${getBenmingPathDisplayName(runState)}。`, "important");
  }
  // V0.9.40 QS-1a 命途契：签契入局明示（命途札记留痕）+ 局外计数。
  if (runState.mingtuContract && typeof CONTRACTS !== "undefined") {
    const __contract = getContractDefinition(runState.mingtuContract);
    if (__contract) {
      markContractChosen(__contract.id);
      addJourneyLog(`命途契已签：「${__contract.name}」——${__contract.summary}代价：${__contract.cost}`, "important");
      const __trimmed = Math.max(0, Number(runState.runStats?.contractStarterCardsTrimmed) || 0);
      if (__contract.id === "emptyPouch" && __trimmed > 0) {
        addJourneyLog(`空囊契生效：起始蛊囊裁去 ${__trimmed} 张基础蛊。`, "system-log");
      }
    }
  }
  // V0.9.51 无尽：不走章节体系，建局即进第 1 层（enterEndlessFloor 内含 showMapScreen）。
  if (runState.mode === "endless") {
    enterEndlessFloor(1);
    triggerHeroVoice("start");
    return true;
  }
  showMapScreen();
  triggerHeroVoice("start");
  // V0.9.19 十重天：登塔明示仪式——本局全部生效修饰开局压给你看（所见即所得）。
  if (runState.mode === "tian") {
    const tier = runState.tianTier || 1;
    const mods = TIAN_TIER_MODS.filter((m) => m.tier <= tier && m.live)
      .map((m) => `${m.name}——${m.desc}`).join("\n");
    showRiteOverlay({
      tone: "tian", eyebrow: "十重天 · 天梯垂压", seal: "天",
      title: `第 ${tier} 重`, text: mods || "天色未沉，此重尚宽。", hint: "点击任意处 · 登塔", autoMs: 6500,
    });
    addJourneyLog(`十重天·第 ${tier} 重：${TIAN_TIER_MODS.filter((m) => m.tier <= tier && m.live).map((m) => m.name).join("、")}加身。`, "important");
  }
  return true;
}

/* ===================== V0.9.8.7 自动续局存档 =====================
 * 唯一真相 = runState（不引入第三套状态）。普通区域仅在地图态写档；塔心仅在章节安全检查点写档。
 * 不序列化战斗态；战斗中途退出按各区域的安全恢复规则处理。一局结束后清档。 */
const RUN_AUTOSAVE_KEY = "nmg.run.autosave";
const RUN_AUTOSAVE_VERSION = 1;

function saveRunStateToStorage() {
  try {
    // V0.9.32.1：存档导入进行中（即将 reload 到导入态）——不写档，避免用导入前的旧局覆盖刚导入的续局档。
    if (savesImporting) return;
    // 普通区域只认地图锚点；塔心由 chapterProgress 声明安全场景。
    if (!runState || runState.status !== "running" || !isMingtuSafeRunCheckpoint(runState)) return;
    // V0.9.9 子批6：死劫无续局（permadeath）——不写档，死亡即终局、中途退出亦不可续，落实「失误即死」。
    if (runState.mode === "deathtrial") return;
    // V0.9.19 十重天·逆命天：第十重同死劫无续局。
    if (runState.mode === "tian" && (runState.tianTier || 0) >= 10) return;
    // V0.9.8.7 防御：任何结算/选择面板（奖励/炼炉/命途更深/精英确认等都挂在 resultOverlay）展开期间不写档，
    // 只在干净地图态存——避免「Boss胜利后停在深入/结算面板」等 currentNode 已空但非地图态的窗口写出坏档。
    if (dom.resultOverlay && !dom.resultOverlay.classList.contains("hidden") && !isMingtuTowerHeart(runState)) return;
    syncMingtuLegacyLocationShadow(runState);
    const payload = { version: RUN_AUTOSAVE_VERSION, savedAt: Date.now(), build: window.__NMG_BUILD__ || "", run: runState };
    // V0.9.25 存档保险：原子写 + 覆盖前落 last-known-good（载入坏档时可回滚）。
    safeWriteJson(RUN_AUTOSAVE_KEY, JSON.stringify(payload), { keepLkg: true });
  } catch (err) { /* 存储不可用则忽略，不影响游戏 */ }
}

// 单份档的解析+完整性校验（供主档与 last-known-good 复用）
function parseRunAutosaveRaw(raw) {
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (!payload || payload.version !== RUN_AUTOSAVE_VERSION || !payload.run) return null;
    const run = normalizeLoadedRunState(payload.run);
    if (!run) return null;
    // 完整性校验：进行中、英雄合法；普通区域还必须保留既有地图结构。
    if (run.status !== "running" || !run.heroId || !HEROES[run.heroId]) return null;
    ensureMingtuChapterProgress(run);
    if (!isMingtuTowerHeart(run)
        && (!run.mapState || !Array.isArray(run.mapState.segments) || !run.mapState.segments.length)) return null;
    return payload;
  } catch (err) { return null; }
}

function loadRunAutosave() {
  try {
    // FUNNEL-1 教学演武兜底：演武中途崩溃/关页留下的演武档不作续局，恢复演武前的真实档。
    const rawPeek = parseRunAutosaveRaw(localStorage.getItem(RUN_AUTOSAVE_KEY));
    if (rawPeek?.run?.tutorialDrill) {
      restoreDrillBackup();
    }
    const main = parseRunAutosaveRaw(localStorage.getItem(RUN_AUTOSAVE_KEY));
    if (main?.run?.tutorialDrill) return null; // 双保险：无备份可还原时也绝不把演武当续局
    if (main) return main;
    // V0.9.25：主档缺失/损坏 → 尝试 last-known-good 回滚（回滚成功则转正并提示）。
    const lkgRaw = localStorage.getItem(RUN_AUTOSAVE_KEY + SAVE_LKG_SUFFIX);
    const lkg = parseRunAutosaveRaw(lkgRaw);
    if (lkg) {
      try { localStorage.setItem(RUN_AUTOSAVE_KEY, lkgRaw); } catch (e) { /* 忽略 */ }
      console.warn("[存档保险] 主续局档损坏，已回滚到上一份完好档。");
      if (dom?.runProgress) {
        dom.runProgress.textContent = "检测到续局档损坏，已自动回滚到上一份完好存档。";
        dom.runProgress.classList.remove("hidden");
      }
      return lkg;
    }
    return null;
  } catch (err) { return null; }
}

function clearRunAutosave() {
  try {
    localStorage.removeItem(RUN_AUTOSAVE_KEY);
    localStorage.removeItem(RUN_AUTOSAVE_KEY + SAVE_LKG_SUFFIX); // 一局终局，回滚档同清
  } catch (err) { /* 忽略 */ }
}

function hasResumableRun() { return !!loadRunAutosave(); }

// E-2c1 仅提供塔心结构恢复锚点；正式场景与交互由 E-2c2 接入。
/* E-2c1 的结构恢复占位卡已被 E-2c2 的塔心全屏场景壳（showTowerHeartScene）取代。 */

function resumeRunFromAutosave() {
  const payload = loadRunAutosave();
  if (!payload) return false;
  runState = payload.run;
  ensureMingtuChapterProgress(runState);
  // V0.9.32.1 安全：续局档来自可导入的存档码（校验和非密钥、可被离线伪造），trialSeed 会被拼进多处 innerHTML。
  // 在此把它规范化回合法的 MT-XXXX（非法一律归空），从源头消毒，杜绝经伪造存档触发的存储型 XSS。正常种子为恒等变换。
  if (typeof runState.trialSeed === "string") runState.trialSeed = normalizeTrialSeed(runState.trialSeed);
  // V0.9.9 寿道·子批2c：老存档无 maxLifespan 字段，兜底回初始寿元（饲岁轮 +12 在新局已并入 createRunState）。
  if (runState.maxLifespan == null) runState.maxLifespan = (HEROES[runState.heroId]?.lifespan) ?? runState.lifespan ?? 1;
  // 还原 cardSerial 到现有最大序号，避免续局后新卡 instanceId 撞号。
  let maxSerial = 0;
  (runState.deckCards || []).forEach((entry) => {
    const m = /deck-card-(\d+)/.exec(entry && entry.instanceId || "");
    if (m) maxSerial = Math.max(maxSerial, Number(m[1]) || 0);
  });
  cardSerial = maxSerial;
  game = null;
  if (isMingtuTowerHeart(runState)) {
    resetAllLogs();
    const scene = getMingtuTowerHeartScene(runState);
    addJourneyLog(`续局：自命途种子 ${runState.trialSeed || "未知"} 处接续，停于塔心·${scene?.name || "未明之处"}。`, "important");
    showTowerHeartScene(); // E-2c2：塔心续局直入全屏场景（gate=正式UI，其余=占位+兼容结算）
    return true;
  }
  const resumeNode = getCurrentRunNode();
  const resumeStep = getCurrentRouteStep();
  if (resumeNode?.id) {
    runState.completedNodes = (runState.completedNodes || []).filter((id) => id !== resumeNode.id);
  }
  setMingtuChapterMapPosition(runState, runState.chapterProgress.actId, runState.chapterProgress.routeId, resumeStep);
  resetAllLogs();
  const layerName = getCurrentActLayer() === 3 ? "第三层" : getCurrentActLayer() === 2 ? "第二层" : "第一层";
  addJourneyLog(`续局：自命途种子 ${runState.trialSeed || "未知"} 处接续，停于${layerName}第 ${getCurrentRouteStep()} 段。`, "important");
  showMapScreen();
  return true;
}

// 开始界面「继续上一局」入口：有有效存档则显示并附摘要。
function updateResumeRunButton() {
  if (!dom.resumeRunButton) return;
  const payload = loadRunAutosave();
  if (!payload) { dom.resumeRunButton.classList.add("hidden"); return; }
  const run = payload.run;
  const hero = HEROES[run.heroId];
  if (isMingtuTowerHeart(run)) {
    const scene = getMingtuTowerHeartScene(run);
    if (dom.resumeRunSummary) dom.resumeRunSummary.textContent = `${hero ? hero.name : "蛊修"} · ${getBenmingPathDisplayName(run)} · 塔心·${scene?.name || "未明之处"} · 生命 ${run.currentHp}/${run.maxHp}`;
    dom.resumeRunButton.classList.remove("hidden");
    return;
  }
  const layerName = getCurrentActLayer(run) === 3 ? "第三层" : getCurrentActLayer(run) === 2 ? "第二层" : "第一层";
  if (dom.resumeRunSummary) dom.resumeRunSummary.textContent = `${hero ? hero.name : "蛊修"} · ${getBenmingPathDisplayName(run)} · ${layerName}第 ${getCurrentRouteStep(run)} 段 · 生命 ${run.currentHp}/${run.maxHp}`;
  dom.resumeRunButton.classList.remove("hidden");
}

// 新开一局前：若有未完成存档，先弹确认（用户选「先弹确认再覆盖」）。
function showNewRunOverwriteConfirm() {
  const payload = loadRunAutosave();
  if (dom.overwriteConfirmText && payload) {
    const run = payload.run; const hero = HEROES[run.heroId];
    const position = isMingtuTowerHeart(run)
      ? `塔心·${getMingtuTowerHeartScene(run)?.name || "未明之处"}`
      : `第 ${getCurrentRouteStep(run)} 段`;
    dom.overwriteConfirmText.textContent = `开新局将覆盖上一局存档（${hero ? hero.name : "蛊修"} · ${position}），确定继续？`;
  }
  dom.overwriteConfirmOverlay?.classList.remove("hidden");
  refreshModalLock();
}

function beginNewRunFresh() {
  if (!ensureBenmingPathSelected()) return false;
  clearRunAutosave();
  preloadBattleAssets();
  return startNewRun();
}

function getRandomRewardCardKey({ rare = false, channel = "reward" } = {}) {
  const exclusive = HERO_EXCLUSIVE_CARD_KEYS[runState.heroId] || [];
  const pool = rare ? [...ADVANCED_CARD_KEYS, ...V08_COMMON_CARD_KEYS, ...exclusive] : [...STANDARD_REWARD_CARD_KEYS, ...exclusive];
  return sampleWithRunRandom(pool, 1, channel)[0] || "moonBlade";
}

function healRunHp(amount, sourceName) {
  if (!runState || amount <= 0) return 0;
  const before = runState.currentHp;
  runState.currentHp = Math.min(runState.maxHp, runState.currentHp + amount);
  const healed = runState.currentHp - before;
  if (game?.player) game.player.hp = runState.currentHp;
  if (dom.resultHp) dom.resultHp.textContent = runState.currentHp;
  if (healed > 0) addLog(`${sourceName}：恢复 ${healed} 点生命。`, "positive-log");
  return healed;
}

function reduceRunMaxHp(amount, sourceName) {
  if (!runState || amount <= 0) return;
  const beforeHp = runState.currentHp;
  runState.maxHp = Math.max(1, runState.maxHp - amount);
  runState.currentHp = Math.min(runState.currentHp, runState.maxHp);
  recordMupanCostDelta(getRunStats(), "selfHpLost", beforeHp, runState.currentHp, "active");
  if (game?.player) {
    game.player.maxHp = runState.maxHp;
    game.player.hp = Math.min(game.player.hp, runState.maxHp);
  }
  if (dom.resultHp) dom.resultHp.textContent = runState.currentHp;
  addLog(`${sourceName}：最大生命 -${amount}。`, "damage-log");
}

function removeDeckEntryById(instanceId) {
  const index = runState.deckCards.findIndex((entry) => entry.instanceId === instanceId);
  if (index < 0) return null;
  const [removed] = runState.deckCards.splice(index, 1);
  syncRunDeckKeys();
  return removed;
}

function removeRandomBasicCard(channel = "event") {
  const basics = new Set(["moonBlade", "ironSkin", "wineWorm", "burningEssence", "bloodBlade"]);
  const candidates = runState.deckCards.filter((entry) => basics.has(entry.originalKey || entry.key));
  if (!candidates.length || runState.deckCards.length <= 6) return null;
  const target = sampleWithRunRandom(candidates, 1, channel)[0];
  return removeDeckEntryById(target.instanceId);
}

/* ============================================================
 * V0.9.6 第二层「生态关卡」最小可玩流程（加性·不重构地图）
 * 设计：不进入 mapState 分段引擎，单独用 runState.layer2 线性推进，
 *       每个节点通过 chapterProgress 进入后复用现有
 *       startFloorBattle / openChanceEvent / openShopNode / openRestNode，
 *       战斗/事件完成回到 layer2 调度而非 completeCurrentNodeAndReturnMap。
 * ============================================================ */

/* 两条路线定义：介绍/推荐流派/风险/敌人序列 + 倾向奖励权重（用现有卡，不新增卡） */
const LAYER2_ROUTES = {
  miasma: {
    id: "miasma",
    name: "瘴林深径",
    icon: "瘴",
    intro: "瘴气终年不散的腐林，毒越积越深。久战者烂，速攻者亦难全身而退。",
    recommend: "推荐流派：毒道 / 虫群（叠毒滚雪球）",
    risk: "风险：敌人持续施毒，毒层越高其伤越重；拖延越久越危险。",
    enemiesPreview: "可能遭遇：腐叶蛊虫 · 青瘴寄生 · 毒藤尸 · 瘴林执灯者 · 百瘴母蛊",
    /* 节点链：普通→普通→三选一→精英→奖励→Boss（结构最小、复用现有节点类型） */
    nodes: [
      { kind: "battle", enemyId: "rotleafGu", name: "腐叶林径" },
      { kind: "battle", enemyId: "miasmaParasite", name: "青瘴湿洼", enemyHpMultiplier: 1.05 },
      { kind: "branch", name: "瘴径分岔" },
      { kind: "elite", enemyId: "miasmaLanternEliteGu", name: "执灯者" },
      { kind: "reward", name: "瘴林残卷" },
      { kind: "boss", enemyId: getMingtuBossDefinition("act-debt-depths", "miasma").enemyId, name: "百瘴巢穴" },
    ],
    bossId: getMingtuBossDefinition("act-debt-depths", "miasma").enemyId,
    /* 倾向奖励：在现有牌池里加权这些 key（不改池、不新增卡） */
    favoredCardKeys: ["greenMiasma", "poisonReturn", "insectSwarm", "heartEater"],
    loreId: "loreMiasma", /* V0.9.15：瘴林专属残卷（卷九） */
    codexTaskId: "codex_miasmaProbe",
    bossTaskId: "codex_miasmaName",
  },
  bloodmarsh: {
    id: "bloodmarsh",
    name: "血沼沉渊",
    icon: "血",
    intro: "尸血淤积的深沼，血道蛊修在此以命饲蛊。你越虚弱，沼中之物越亢奋。",
    recommend: "推荐流派：血道（以血煞爆发收割）",
    risk: "风险：敌人自损换攻、吸血续命；你血量越低，它们压迫越强。",
    enemiesPreview: "可能遭遇：血蛭群 · 断脉蛊徒 · 血泥傀 · 血衣祭蛊者 · 血衣蛊母",
    nodes: [
      { kind: "battle", enemyId: "bloodLeechSwarm", name: "蛭潮浅滩" },
      { kind: "battle", enemyId: "brokenMeridianGu", name: "断脉血径", enemyHpMultiplier: 1.05 },
      { kind: "branch", name: "血沼分岔" },
      { kind: "elite", enemyId: "bloodRobePriestEliteGu", name: "血衣祭坛" },
      { kind: "reward", name: "血道残谱" },
      { kind: "boss", enemyId: getMingtuBossDefinition("act-debt-depths", "bloodmarsh").enemyId, name: "血池深渊" },
    ],
    bossId: getMingtuBossDefinition("act-debt-depths", "bloodmarsh").enemyId,
    favoredCardKeys: ["bloodBlade", "returnLife", "heartEater", "bloodReversal", "bloodMarshGu"],
    loreId: "loreBloodmarsh", /* V0.9.15：血沼专属残卷（卷十） */
    codexTaskId: "codex_bloodmarshProbe",
    bossTaskId: "codex_bloodRobeName",
  },
};

/* 第二层进度持久化（仅供图鉴任务 count() 只读展示，不发奖） */
const LAYER2_PROGRESS_KEY = "nmg.layer2.progress";
function layer2LoadProgress() {
  try { const r = localStorage.getItem(LAYER2_PROGRESS_KEY); const o = r ? JSON.parse(r) : {}; return (o && typeof o === "object") ? o : {}; }
  catch (err) { return {}; }
}
function layer2SaveProgress(o) {
  try { localStorage.setItem(LAYER2_PROGRESS_KEY, JSON.stringify(o && typeof o === "object" ? o : {})); } catch (err) { /* 忽略 */ }
}
function layer2MarkProgress(field) {
  const o = layer2LoadProgress();
  o[field] = (o[field] | 0) + 1;
  layer2SaveProgress(o);
}

/* 第二层万蛊录解锁：enemy/boss 条目无 cardKey，单独用持久集合记“已遭遇” */
const LAYER2_BESTIARY_KEY = "nmg.layer2.bestiary";
function layer2LoadBestiary() {
  try { const r = localStorage.getItem(LAYER2_BESTIARY_KEY); const a = r ? JSON.parse(r) : []; return new Set(Array.isArray(a) ? a : []); }
  catch (err) { return new Set(); }
}
function layer2MarkBestiary(enemyId) {
  if (!enemyId) return;
  const set = layer2LoadBestiary();
  if (set.has(enemyId)) return;
  set.add(enemyId);
  try { localStorage.setItem(LAYER2_BESTIARY_KEY, JSON.stringify([...set])); } catch (err) { /* 忽略 */ }
}

/* ===== 命途未尽：一层 Boss 胜利后的选择面板（结算 / 深入） ===== */
function showUnfinishedPathChoice() {
  /* 复用 result-overlay 与两个现成按钮，不新增 index.html DOM */
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result unfinished-path-result";
  dom.resultSeal.textContent = "途";
  dom.resultEyebrow.textContent = "命途未尽 · 塔顶之上";
  dom.resultTitle.textContent = "尸盘已破，去路未尽";
  dom.resultDescription.textContent = "尸盘监守倒下，塔顶裂开一道向下的暗径——瘴气与血腥自深处涌上。此时可收手离塔并带走所得，或踏入更深的生态。";
  showBossRewardReceipt();
  dom.resultDeckButton?.classList.remove("hidden");
  dom.resultLoreButton?.classList.remove("hidden");
  dom.resultPrimaryButton.textContent = "继续深入";
  dom.resultPrimaryButton.dataset.action = "enterLayer2";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultSecondaryButton.textContent = "收手离塔";
  dom.resultSecondaryButton.dataset.action = "settleLayer1";
  dom.resultSecondaryButton.classList.remove("hidden");
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  refreshModalLock();
}

/* 选择「收手离塔」：阶段收手，不触发完整通关。 */
function settleAtLayer1() {
  dom.resultSecondaryButton.dataset.action = "";
  dom.resultSecondaryButton.classList.add("hidden");
  finalizeRun("withdrawn");
}

/* ===== 路线选择面板 ===== */
function showLayer2RouteSelect() {
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result layer2-route-result";
  dom.resultSeal.textContent = "径";
  dom.resultEyebrow.textContent = "第二层 · 生态分岔";
  dom.resultTitle.textContent = "择一径深入";
  dom.resultDescription.textContent = "两条生态歧路在脚下展开，择定便难回头。";
  /* 用 runSummary 容器铺两张路线卡（复用其滚动样式） */
  /* V0.9.51 一屏化：去掉纯氛围的 intro（上方描述已铺过场景），只留决策要素——
   * 流派推荐 / 风险 / 可能遭遇；后两行 CSS 钳两行，全文走 title 悬浮查看。 */
  const card = (r) => `
    <button type="button" class="layer2-route-card" data-layer2-route="${r.id}" title="${escapeAttribute(r.intro)}">
      <span class="layer2-route-head"><span class="layer2-route-icon">${r.icon}</span><strong class="layer2-route-name">${r.name}</strong></span>
      <p class="layer2-route-line layer2-route-rec">${r.recommend}</p>
      <p class="layer2-route-line layer2-route-risk" title="${escapeAttribute(r.risk)}">${r.risk}</p>
      <p class="layer2-route-line layer2-route-foes" title="${escapeAttribute(r.enemiesPreview)}">${r.enemiesPreview}</p>
    </button>`;
  dom.runSummary.innerHTML = `<div class="layer2-route-grid">${card(LAYER2_ROUTES.miasma)}${card(LAYER2_ROUTES.bloodmarsh)}</div>`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
  /* 委托点击：在 bindEvents 已加 runSummary 监听 */
}

/* 选定路线，初始化 layer2 状态并推进首个节点 */
function chooseLayer2Route(routeId) {
  const route = LAYER2_ROUTES[routeId];
  if (!route || !runState) return;
  applyTianLayerToll("第二层"); // V0.9.19 五重·蚀寿
  setMingtuChapterMapPosition(runState, "act-debt-depths", routeId, 1);
  setMingtuActRuntimeData(runState, "act-debt-depths", {
    routeName: route.name,
    nodeIndex: 0,
    branchChoice: "",
    bossDefeated: false,
    nodesCleared: 0,
    lastNodeName: "第二层入口",
  });
  /* V0.9.12.1 修复双计数：进层持久计数只在 enterLayer2Map 记一次（DEV 直跳同口径），此处不再重复累加 */
  getRunStats().layer2Entered = true;
  getRunStats().layer2Route = route.name;
  unlockLorePage(route.loreId || "unfinished");
  dom.runSummary.classList.add("hidden");
  /* V0.9.6.1：不再走线性 layer2Advance，进入真正的第二层分岔地图 */
  enterLayer2Map(routeId);
}

/* 第二层调度：依 nodeIndex 取节点，写入合成 currentNode，复用现有节点入口 */
function layer2Advance() {
  const st = runState?.layer2;
  if (!st || !isLayer2Run()) return;
  const route = LAYER2_ROUTES[getCurrentRouteId()];
  const node = route.nodes[st.nodeIndex];
  if (!node) { showCommandPathChoice(); return; }
  st.lastNodeName = `${route.name}·${node.name}`;
  if (node.kind === "branch") { showLayer2Branch(node); return; }
  if (node.kind === "reward") { openLayer2Reward(node); return; }
  /* battle / elite / boss：写合成节点后复用 startFloorBattle */
  const synthType = node.kind === "boss" ? "boss" : (node.kind === "elite" ? "elite" : "battle");
  const syntheticNode = {
    id: `layer2-${getCurrentRouteId()}-${st.nodeIndex}`,
    step: MAX_ROUTE_STEP, /* 让 startFloorBattle 不误判普通层进度；层级判断改走 layer2.active */
    type: synthType,
    enemyId: node.enemyId,
    enemyHpMultiplier: node.enemyHpMultiplier || (synthType === "boss" ? 1 : 1),
    icon: synthType === "boss" ? "盘" : (synthType === "elite" ? "煞" : "兽"),
    name: node.name,
    description: synthType === "boss" ? "生态之主，破之深行。" : (synthType === "elite" ? "生态精英，厚利藏险。" : "生态凶影，胜后取蛊。"),
    layer2: true,
  };
  const mappedNode = runState.mapState?.segments?.flat()?.find((item) => item.enemyId === syntheticNode.enemyId && item.type === syntheticNode.type);
  if (mappedNode) enterMingtuChapterNode(runState, mappedNode);
  layer2MarkBestiary(node.enemyId);
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  startFloorBattle();
}

/* ===================================================================
 * V0.9.6.1 第二层「地图化」核心
 * 设计：不另写一套地图渲染/点击/推进。进二层时，把 runState.mapState
 * 换成「与一层同形」的 segments 结构（createLayer2MapState 生成），并把
 * chapterProgress 切到二区、重置节点完成记录，
 * 然后调用现成 showMapScreen()。renderMapScreen / selectMapNode /
 * enterMapNode / lockSiblingNodes / getMapNodeState / getMapNodeStateLabel
 * 全部原样复用（它们只读 runState.mapState.segments + currentRouteStep）。
 * 只在 4 个“层感知”收口点做最小分支（见 jsEdits）。
 * 节点结构：起点(2普通分岔)→中段(精英/事件/休整/蛊坊 多选)→残卷奖励→Boss。
 * 主题：theme = miasma | bloodmarsh，影响普通战/精英/Boss 敌人与文案。
 * =================================================================== */

/* 第二层主题敌人池（取自 V0.9.6 已定义的 ENEMY_LIBRARY 条目，不新增敌人） */
const LAYER2_THEME_POOLS = {
  miasma: {
    normals: ["rotleafGu", "miasmaParasite", "poisonVineCorpse"],
    elite: "miasmaLanternEliteGu",
    boss: getMingtuBossDefinition("act-debt-depths", "miasma").enemyId,
  },
  bloodmarsh: {
    normals: ["bloodLeechSwarm", "brokenMeridianGu", "bloodMudGolem"],
    elite: "bloodRobePriestEliteGu",
    boss: getMingtuBossDefinition("act-debt-depths", "bloodmarsh").enemyId,
  },
};

/* 第二层非战斗节点文案占位（缺内容也不报错） */
const LAYER2_NODE_TEXT = {
  battle: "生态凶影，胜后取蛊。",
  event: "深处异兆，三念定局。",
  rest: "塔隙微明，可暂养息一息。",
  shop: "残灯下蛊坊半掩，以蛊石易牌。",
  elite: "生态精英，厚利藏险。",
  defy: "舍此段常规之利，搏命挑绝域强敌；胜则厚赏。",
  reward: "生态残卷遗落，倾向此径之道。",
  boss: "生态之主盘踞末路，破之深行。",
};

/* 第二层主题文案前缀（仅用于非战斗节点 eyebrow/标题/story 包装，复用一层机制，不另写逻辑） */
function getLayer2ThemeText(kind) {
  const theme = getCurrentRouteId();
  const isMiasma = theme === "miasma";
  const routeName = getCurrentRouteName() || (isMiasma ? "瘴林深径" : "血沼沉渊");
  const map = {
    rest: {
      eyebrow: `第二层 · ${routeName} · 临隙`,
      title: isMiasma ? "瘴隙喘息" : "血泊偷生",
      storyPrefix: isMiasma ? "瘴气低伏，腐风暂止。此处不能久留，只能择一调理。" : "血腥稍歇，沼气翻涌。喘息只此一刻，择一事便走。",
    },
    shop: {
      eyebrow: `第二层 · ${routeName} · 蛊坊`,
      title: isMiasma ? "瘴林暗坊" : "血沼残坊",
      desc: isMiasma ? "瘴雾里蛊坊半掩，灯火将熄。买定离手，离开后本段命途即定。" : "血灯下蛊坊低伏，残货半遮。买定离手，离开后本段命途即定。",
    },
    event: {
      eyebrow: `第二层 · ${routeName} · 机缘`,
      title: isMiasma ? "瘴中异兆" : "血沼异兆",
      desc: isMiasma ? "瘴林深处并非全是死路，但每一次伸手都要付出代价。" : "血沼之下藏机缘，亦藏杀机。每一次伸手都要付出代价。",
    },
  };
  return map[kind] || null;
}

/* 抽取一个主题普通战敌人（带去重，避免一局重复太多） */
function pickLayer2Normal(theme, used, channel = "route") {
  const pool = (LAYER2_THEME_POOLS[theme]?.normals || LAYER2_THEME_POOLS.miasma.normals)
    .filter((id) => ENEMY_LIBRARY[id]);
  const fresh = pool.filter((id) => !used.has(id));
  const id = pickWithRunRandom(fresh.length ? fresh : pool, channel) || pool[0];
  used.add(id);
  return id;
}

/* 生成与一层同形的第二层地图 segments：
 *   段1：2 个普通战分岔（左/右，倾向标记仅作文案，敌人都来自主题池）
 *   段2：精英 + 事件/休整/蛊坊 三选一中的两条分岔（精英为高风险路）
 *   段3：生态残卷（reward，单节点）
 *   段4：第二层 Boss
 * routeId 即主题 theme（miasma/bloodmarsh）。 */
/* V0.9.51 无尽模式地图：纯规则出骨架（buildEndlessFloorPlan），此处只做装饰与 RNG 注入。
 * RNG 走 route 通道并把层数拌进种子——同一存档同一层恒定可复现，与固定战役同规矩。 */
function createEndlessMapState(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const rng = () => getRunRandom("route");
  const plan = buildEndlessFloorPlan(f, rng);
  const ICONS = { battle: "兽", elite: "煞", boss: "盘", event: "机", shop: "坊", rest: "息", defy: "逆" };
  const NAMES = { event: "命途机缘", shop: "蛊坊", rest: "塔隙养息", defy: "逆命搏杀" };
  const segments = plan.segments.map((seg) => seg.map((n) => {
    const def = n.enemyId ? ENEMY_LIBRARY[n.enemyId] : null;
    return {
      ...n,
      endless: true,
      icon: ICONS[n.type] || "途",
      name: def ? def.name : (NAMES[n.type] || "命途节点"),
      description: MAP_NODE_DESCRIPTIONS[n.type] || "塔中未名之地。",
    };
  }));
  return { segments, floor: f };
}

function createLayer2MapState(theme) {
  const pool = LAYER2_THEME_POOLS[theme] || LAYER2_THEME_POOLS.miasma;
  const bossDefinition = getMingtuBossDefinition("act-debt-depths", theme) || getMingtuBossDefinition("act-debt-depths", "miasma");
  const used = new Set();
  const n1 = pickLayer2Normal(theme, used);
  const n2 = pickLayer2Normal(theme, used);
  const n3 = pickLayer2Normal(theme, used);
  const themeName = theme === "miasma" ? "瘴" : "血";
  /* 段1：三路普通战分岔，择一而行其余封闭（无死路，每路都通向段2） */
  const seg1 = [
    { id: "l2-1-a", step: 1, type: "battle", enemyId: n1, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n1]?.name || "生态凶影", description: LAYER2_NODE_TEXT.battle },
    { id: "l2-1-b", step: 1, type: "battle", enemyId: n2, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n2]?.name || "生态凶影", description: LAYER2_NODE_TEXT.battle },
    { id: "l2-1-c", step: 1, type: "battle", enemyId: n3, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n3]?.name || "生态凶影", description: LAYER2_NODE_TEXT.battle },
  ];
  /* 段2：精英(高风险高奖，必选其一路) + 机缘事件 + 软节点(休整|蛊坊，随机其一)，三选其一，保证 ≥2 软/硬可选无死路 */
  const softNode = getRunRandom("route") < 0.5
    ? { id: "l2-2-c", step: 2, type: "shop", layer2: true, l2theme: theme, icon: "坊", name: theme === "miasma" ? "瘴林暗坊" : "血沼残坊", description: LAYER2_NODE_TEXT.shop }
    : { id: "l2-2-c", step: 2, type: "rest", layer2: true, l2theme: theme, icon: "息", name: theme === "miasma" ? "瘴隙喘息" : "血泊偷生", description: LAYER2_NODE_TEXT.rest };
  const seg2 = [
    { id: "l2-2-a", step: 2, type: "elite", enemyId: pool.elite, layer2: true, l2theme: theme,
      icon: "煞", name: ENEMY_LIBRARY[pool.elite]?.name || "生态精英", description: LAYER2_NODE_TEXT.elite },
    { id: "l2-2-b", step: 2, type: "event", layer2: true, l2theme: theme, icon: "缘", name: theme === "miasma" ? "瘴中异兆" : "血沼异兆", description: LAYER2_NODE_TEXT.event },
    softNode,
  ];
  /* V0.9.8.6：段3（step3）战斗 / 机缘 —— 中段多样性 */
  const n4 = pickLayer2Normal(theme, used);
  const seg3 = [
    { id: "l2-3-a", step: 3, type: "battle", enemyId: n4, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n4]?.name || "生态凶影", description: LAYER2_NODE_TEXT.battle },
    { id: "l2-3-b", step: 3, type: "event", layer2: true, l2theme: theme, icon: "缘",
      name: theme === "miasma" ? "瘴中异兆" : "血沼异兆", description: LAYER2_NODE_TEXT.event },
  ];
  /* 段4（step4）：蛊坊 / 休整 / 逆命 —— 安稳收益 vs 搏命三选一 */
  const seg4 = [
    { id: "l2-4-a", step: 4, type: "shop", layer2: true, l2theme: theme, icon: "坊",
      name: theme === "miasma" ? "瘴林暗坊" : "血沼残坊", description: LAYER2_NODE_TEXT.shop },
    { id: "l2-4-b", step: 4, type: "rest", layer2: true, l2theme: theme, icon: "息",
      name: theme === "miasma" ? "瘴隙喘息" : "血泊偷生", description: LAYER2_NODE_TEXT.rest },
    { id: "l2-4-c", step: 4, type: "defy", enemyId: pool.elite, enemyHpMultiplier: 1.5, layer2: true, l2theme: theme,
      icon: "逆", name: "逆命搏杀", description: LAYER2_NODE_TEXT.defy },
  ];
  /* 段5（step REST_ROUTE_STEP=5）：生态残卷 / 临门休整 —— 免费选牌 vs 回血 */
  const seg5 = [
    { id: "l2-5-a", step: 5, type: "reward", layer2: true, l2theme: theme,
      icon: "卷", name: theme === "miasma" ? "瘴林残卷" : "血道残谱", description: LAYER2_NODE_TEXT.reward },
    { id: "l2-5-b", step: 5, type: "rest", layer2: true, l2theme: theme, icon: "息",
      name: theme === "miasma" ? "瘴隙偷息" : "血泊喘息", description: LAYER2_NODE_TEXT.rest },
  ];
  /* V0.9.51 段数 6→9：二层新增第 6/7/8 段，用本版新敌（涎瘴蟾君/裂颅瘴僧/溯血鳗母/沉尸傀偶师）。 */
  const l2seg6Pool = theme === "miasma" ? ["miasmaToad", "splitSkullMonk"] : ["bloodEelMother", "sunkenPuppeteer"];
  const l2e6 = sampleWithRunRandom(l2seg6Pool, 1, "route")[0] || l2seg6Pool[0];
  const seg6 = [
    { id: "l2-6-a", step: 6, type: "battle", enemyId: l2e6, enemyHpMultiplier: 1.1, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[l2e6].name, description: LAYER2_NODE_TEXT.battle },
    { id: "l2-6-b", step: 6, type: "battle", enemyId: l2seg6Pool[1], enemyHpMultiplier: 1.15, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[l2seg6Pool[1]].name, description: LAYER2_NODE_TEXT.battle },
  ];
  const seg7 = [
    { id: "l2-7-a", step: 7, type: "shop", layer2: true, l2theme: theme, icon: "坊", name: "蛊坊", description: LAYER2_NODE_TEXT.shop },
    { id: "l2-7-b", step: 7, type: "elite", enemyId: pool.elite, enemyHpMultiplier: 1.3, layer2: true, l2theme: theme,
      icon: "煞", name: ENEMY_LIBRARY[pool.elite].name, description: LAYER2_NODE_TEXT.elite },
    { id: "l2-7-c", step: 7, type: "rest", layer2: true, l2theme: theme, icon: "息",
      name: theme === "miasma" ? "瘴隙偷息" : "血泊喘息", description: LAYER2_NODE_TEXT.rest },
  ];
  const l2e8 = sampleWithRunRandom(l2seg6Pool, 1, "route")[0] || l2seg6Pool[0];
  const seg8 = [
    { id: "l2-8-a", step: 8, type: "battle", enemyId: l2e8, enemyHpMultiplier: 1.25, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[l2e8].name, description: LAYER2_NODE_TEXT.battle },
    { id: "l2-8-b", step: 8, type: "event", layer2: true, l2theme: theme, icon: "机", name: "命途机缘", description: LAYER2_NODE_TEXT.event },
  ];
  /* 现有二区末段 Boss；身份与旧节点映射由章节数据声明。 */
  const bossSeg = [
    { id: bossDefinition.legacyNodeIds[0], step: bossDefinition.legacyStep, type: "boss", enemyId: bossDefinition.enemyId, layer2: true, l2theme: theme,
      icon: themeName, name: ENEMY_LIBRARY[pool.boss]?.name || "生态之主", description: LAYER2_NODE_TEXT.boss },
  ];
  return { segments: [seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, bossSeg], theme };
}

/* 进入第二层地图：复用一层渲染管线（替换 mapState + 重置步进 + layer=2） */
function enterLayer2Map(routeId) {
  const route = LAYER2_ROUTES[routeId];
  if (!route || !runState) return;
  const theme = routeId; /* miasma / bloodmarsh */
  setMingtuChapterMapPosition(runState, "act-debt-depths", routeId, 1);
  setMingtuActRuntimeData(runState, "act-debt-depths", {
    routeName: route.name,
    branchChoice: "",
    bossDefeated: false,
    nodesCleared: 0,
    lastNodeName: "第二层入口",
  });
  // V0.9.33 BGM 冷加载治理：进二层即预热本路线 BGM（一层期间通常已由 warmLayerBgmAhead 预热好；此处兜底，warmPool 幂等不重下）。
  window.AudioManager?.warmScene?.(routeId === "bloodmarsh" ? "layer2Bloodmarsh" : "layer2Miasma");
  warmLayerBgmAhead(3); // V0.9.36：二层期间就把三层两路 + 结算曲预热好（进三层/Boss 后秒起播）
  /* 用第二层地图替换一层地图（一层地图体验不受影响：此时一层已结束） */
  runState.mapState = createLayer2MapState(theme);
  validateRouteMapState(runState.mapState, `layer2:${routeId}`, "act-debt-depths", routeId);
  runState.completedNodes = [];
  runState.lockedNodes = [];
  setMingtuChapterMapPosition(runState, "act-debt-depths", routeId, 1);
  runState.bossPrepRelicGranted = true; /* 二层不再触发一层 Boss 前整备遗物 */
  layer2MarkProgress(routeId === "miasma" ? "miasmaEntered" : "bloodmarshEntered");
  getRunStats().layer2Entered = true;
  getRunStats().layer2Route = route.name;
  addJourneyLog(`命途未尽：你踏入第二层「${route.name}」，生态歧路在脚下重新铺开。`, "important");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  showMapScreen();
}

/* ===== V0.9.51 无尽模式局内流程 =====
 * 与固定战役的分工：无尽不走 act/route 章节体系，自成一套「层」——每层一张 6 段地图，
 * 打完该层 capstone（Boss 层是 Boss，否则精英）即进下一层，层数只增不减，直到身死。
 * 复用点：地图渲染、战斗、奖励、蛊坊全部照旧；只是"下一层"取代了"下一区"。 ===== */
const ENDLESS_FLOOR_STEPS = 6; // 无尽每层固定 6 段（骨架由 buildEndlessFloorPlan 产出）
function isEndlessRun(run = runState) { return run?.mode === "endless"; }
/* 无尽层内位置自成一套（endlessStep），与章节体系的位置影子字段互不干涉。 */
function getEndlessStep(run = runState) { return Math.max(1, Math.min(ENDLESS_FLOOR_STEPS, Number(run?.endlessStep) || 1)); }
function getEndlessSegmentNodes(run = runState) {
  const segs = run?.mapState?.segments || [];
  return segs[getEndlessStep(run) - 1] || [];
}
function getEndlessCurrentNode(run = runState) {
  const id = run?.endlessNodeId;
  return id ? (getEndlessSegmentNodes(run).find((n) => n.id === id) || null) : null;
}
function isEndlessCapstone(node) {
  return !!node && (node.type === "boss" || Number(node.step) >= ENDLESS_FLOOR_STEPS);
}

function enterEndlessFloor(floor) {
  if (!runState) return;
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  runState.endlessFloor = f;
  runState.endlessDeepest = Math.max(runState.endlessDeepest || 0, f);
  runState.mapState = createEndlessMapState(f);
  runState.completedNodes = [];
  runState.lockedNodes = [];
  /* V0.9.57 玩家实报「无尽的坊市不会自动刷新」的根因：
   * getShopState() 以【节点 id】作键存进 runState.shopPurchases，而无尽每层的节点 id 是
   * 固定复用的（e-shop-1 / e-shop-2，见 nmg-endless.js 的层内布局）。此前只清了
   * completedNodes 与 lockedNodes，shopPurchases 一路带到下一层——于是第二层进坊市，
   * 三张牌、疗伤、删牌、材料、寿元买卖、丹囊全是上一层留下的「已交易」，连 itemKey 都不换。
   * 普通模式不受影响：章节体系的节点 id 全局唯一，不会撞键。
   * 按层清而不是按局清：同一层内退出坊市再进来，买过就该还是买过。 */
  runState.shopPurchases = {};
  runState.endlessNodeId = null;
  runState.endlessStep = 1; // V0.9.51 无尽自有层内步进，不碰章节体系的旧位置影子字段
  runState.bossPrepRelicGranted = true; // 无尽不走一层 Boss 前整备
  const affixes = typeof getEndlessActiveAffixes === "function"
    ? getEndlessActiveAffixes(f, runState.trialSeed || "endless") : [];
  runState.endlessAffixes = affixes.map((a) => a.id);
  window.AudioManager?.warmScene?.("endless");
  const affixText = affixes.length ? `；加身词条：${affixes.map((a) => a.name).join("、")}` : "";
  addJourneyLog(`无尽第 ${f} 层——塔身在脚下重排${affixText}。`, "important");
  if (isEndlessBossFloor(f)) addJourneyLog(`第 ${f} 层镇着一位塔主，末段即是它。`, "boss-log");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay?.classList.add("hidden");
  refreshModalLock();
  showMapScreen();
}

/* 该层 capstone 打完 → 进下一层（无尽没有"通关"，只有更深）。 */
function advanceEndlessFloor() {
  if (!isEndlessRun()) return;
  const next = (runState.endlessFloor || 1) + 1;
  addJourneyLog(`第 ${runState.endlessFloor} 层已破，塔阶继续向下。`, "positive-log");
  enterEndlessFloor(next);
}

/* 无尽节点完成只推进 endlessStep；绝不借用普通章节的 chapterProgress。
 * 末段镇守完成后再换层，确保战斗结算与奖励先完整展示。 */
function completeEndlessNodeAndReturnMap() {
  if (!isEndlessRun(runState)) return false;
  const node = getEndlessCurrentNode(runState);
  if (!node) return false;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  runState.lastMapNotice = getNodeCompleteNotice(node);
  addLog(`无尽记录：${runState.lastMapNotice}。`, "important");
  runState.endlessNodeId = null;
  if (isEndlessCapstone(node)) {
    advanceEndlessFloor();
    return true;
  }
  runState.endlessStep = Math.min(ENDLESS_FLOOR_STEPS, Math.max(getEndlessStep(runState), Number(node.step) + 1));
  showMapScreen();
  return true;
}

/* 第二层奖励节点（残卷）：复用 V0.9.6 倾向选牌；完成后回二层地图 */
function enterLayer2RewardNode(node) {
  enterMingtuChapterNode(runState, node);
  lockSiblingNodes(node);
  openLayer2Reward({ name: node.name }); /* 复用现成奖励面板；完成走 completeOverlayNode→二层返图 */
}

/* ============================================================
 * V0.9.8 第三层「命途更深」核心（A1：镜像第二层，只新增不改二层）
 * 严格镜像 LAYER2_* / createLayer2MapState / enterLayer2Map /
 * layer2CompleteNodeAndReturnMap / showUnfinishedPathChoice /
 * showLayer2RouteSelect / chooseLayer2Route / settleAtLayer1 /
 * showLayer2Conclusion / openLayer2Reward / generateLayer2RewardChoices。
 * 复用同一地图渲染/点击/推进管线（chapterProgress 切到三区、mapState 替换）。
 * 万蛊录复用 layer2MarkBestiary 混存，不另建 bestiary 键。
 * 敌人 id 由 A2 批补入 ENEMY_LIBRARY，此处仅引用 id 与 .name（全 || 兜底）。
 * ============================================================ */

/* 两条第三层路线：骨塔高陵（护身叠甲）/ 蜂窟魔巢（毒道控场） */
const LAYER3_ROUTES = {
  bone: {
    id: "bone",
    name: "骨塔高陵",
    icon: "骨",
    intro: "白骨堆叠成塔的枯陵，亡蛊以骨为甲、以铃乱心。攻不破甲者，终将被这座塔吞没。",
    recommend: "推荐流派：护身 / 防御（叠甲固本，借甲反伤）",
    risk: "风险：敌人厚甲、蓄力重击、骨铃乱心扰你抽牌；硬碰硬只会被骨甲耗尽真元。",
    enemiesPreview: "可能遭遇：骨铃巡蛊 · 朽甲蛊兵 · 骨甲蛊卫 · 骨塔执令者 · 骨巢守墓王",
    bossId: getMingtuBossDefinition("act-mirror-wilds", "bone").enemyId,
    favoredCardKeys: ["ironSkin", "mysticCarapace", "shellRemnant", "moltingShell", "armorBreaker", "boneBell"],
    loreId: "loreBone", /* V0.9.15：骨塔专属残卷（卷十一） */
    codexTaskId: "codex_boneProbe",
    bossTaskId: "codex_boneName",
  },
  beehive: {
    id: "beehive",
    name: "蜂窟魔巢",
    icon: "蜂",
    intro: "万翅嗡鸣的蜡质魔巢，毒蜂蛊以巢为军、以蜂为潮。久战者中毒愈深，浪战者引来蜂群暴动。",
    recommend: "推荐流派：毒道 / 控场（叠毒反制，压制蜂群孵化）",
    risk: "风险：毒刺持续掉血、蜂群越孵越多、出牌过急触发蜂潮抢攻；节奏失控便被群起淹没。",
    enemiesPreview: "可能遭遇：毒蜂蛊 · 蜂巢虫蛊 · 蜂潮蛊涌 · 蜂窟守卫 · 灾厄蜂后",
    bossId: getMingtuBossDefinition("act-mirror-wilds", "beehive").enemyId,
    favoredCardKeys: ["greenMiasma", "poisonReturn", "insectSwarm", "chaosBee"],
    loreId: "loreBeehive", /* V0.9.15：蜂窟专属残卷（卷十二） */
    codexTaskId: "codex_beehiveProbe",
    bossTaskId: "codex_beehiveName",
  },
};

/* 第三层进度持久化（仅供图鉴任务 count() 只读展示，不发奖） */
const LAYER3_PROGRESS_KEY = "nmg.layer3.progress";
function layer3LoadProgress() {
  try { const r = localStorage.getItem(LAYER3_PROGRESS_KEY); const o = r ? JSON.parse(r) : {}; return (o && typeof o === "object") ? o : {}; }
  catch (err) { return {}; }
}
function layer3SaveProgress(o) {
  try { localStorage.setItem(LAYER3_PROGRESS_KEY, JSON.stringify(o && typeof o === "object" ? o : {})); } catch (err) { /* 忽略 */ }
}
function layer3MarkProgress(field) {
  const o = layer3LoadProgress();
  o[field] = (o[field] | 0) + 1;
  layer3SaveProgress(o);
}

/* 第三层主题敌人池（取自 A2 批补入 ENEMY_LIBRARY 的条目，全 || 兜底） */
const LAYER3_THEME_POOLS = {
  bone: {
    normals: ["bonebellGu", "skeletonPuppetGu", "boneArmorGuardGu"],
    elite: "boneCommanderElite",
    boss: getMingtuBossDefinition("act-mirror-wilds", "bone").enemyId,
  },
  beehive: {
    normals: ["venomBeeGu", "beehiveBroodGu", "chaosSwarmHordeGu"],
    elite: "beehiveGuardElite",
    boss: getMingtuBossDefinition("act-mirror-wilds", "beehive").enemyId,
  },
};

/* 第三层非战斗节点文案占位（缺内容也不报错） */
const LAYER3_NODE_TEXT = {
  battle: "绝域凶影，胜后取蛊。",
  event: "深处异兆，三念定局。",
  rest: "塔隙微光，可暂养息一息。",
  shop: "残灯下蛊坊半掩，以蛊石易牌。",
  elite: "绝域精英，厚利藏险。",
  defy: "舍此段常规之利，搏命挑绝域强敌；胜则厚赏。",
  reward: "绝域残卷遗落，倾向此径之道。",
  boss: "绝域之主盘踞末路，破之功成。",
};

/* 第三层主题文案前缀（镜像 getLayer2ThemeText，仅包装非战斗节点 eyebrow/标题/story） */
function getLayer3ThemeText(kind) {
  const theme = getCurrentRouteId();
  const isBone = theme === "bone";
  const routeName = getCurrentRouteName() || (isBone ? "骨塔高陵" : "蜂窟魔巢");
  const map = {
    rest: {
      eyebrow: `第三层 · ${routeName} · 临隙`,
      title: isBone ? "塔隙喘息" : "蜂舍偷生",
      storyPrefix: isBone ? "骨风暂止，铃声低伏。此处不能久留，只能择一调理。" : "蜂鸣稍歇，蜡气翻涌。喘息只此一刻，择一事便走。",
    },
    shop: {
      eyebrow: `第三层 · ${routeName} · 蛊坊`,
      title: isBone ? "骨阶残卷" : "蜂蜡残卷",
      desc: isBone ? "枯骨间蛊坊半掩，灯火将熄。买定离手，离开后本段命途即定。" : "蜡灯下蛊坊低伏，残货半遮。买定离手，离开后本段命途即定。",
    },
    event: {
      eyebrow: `第三层 · ${routeName} · 机缘`,
      title: isBone ? "塔中异兆" : "蜂窟异兆",
      desc: isBone ? "骨塔深处并非全是死路，但每一次伸手都要付出代价。" : "蜂窟之下藏机缘，亦藏杀机。每一次伸手都要付出代价。",
    },
  };
  return map[kind] || null;
}

/* 抽取一个主题普通战敌人（带去重，镜像 pickLayer2Normal） */
function pickLayer3Normal(theme, used, channel = "route") {
  const pool = (LAYER3_THEME_POOLS[theme]?.normals || LAYER3_THEME_POOLS.bone.normals)
    .filter((id) => ENEMY_LIBRARY[id]);
  if (!pool.length) return null;
  const fresh = pool.filter((id) => !used.has(id));
  const id = pickWithRunRandom(fresh.length ? fresh : pool, channel) || pool[0];
  used.add(id);
  return id;
}

/* 生成与一层/二层同形的第三层地图 segments（镜像 createLayer2MapState：
 *   段1：三路普通战分岔 / 段2：精英+机缘+软节点三选一 / 段3：残卷 / 段4：Boss）
 * routeId 即主题 theme（bone/beehive）。 */
function createLayer3MapState(theme) {
  const pool = LAYER3_THEME_POOLS[theme] || LAYER3_THEME_POOLS.bone;
  const bossDefinition = getMingtuBossDefinition("act-mirror-wilds", theme) || getMingtuBossDefinition("act-mirror-wilds", "bone");
  const used = new Set();
  const n1 = pickLayer3Normal(theme, used);
  const n2 = pickLayer3Normal(theme, used);
  const n3 = pickLayer3Normal(theme, used);
  const themeName = theme === "bone" ? "骨" : "蜂";
  /* 段1：三路普通战分岔，择一而行其余封闭（无死路，每路都通向段2） */
  const seg1 = [
    { id: "l3-1-a", step: 1, type: "battle", enemyId: n1, layer3: true, l3theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n1]?.name || "绝域凶影", description: LAYER3_NODE_TEXT.battle },
    { id: "l3-1-b", step: 1, type: "battle", enemyId: n2, layer3: true, l3theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n2]?.name || "绝域凶影", description: LAYER3_NODE_TEXT.battle },
    { id: "l3-1-c", step: 1, type: "battle", enemyId: n3, layer3: true, l3theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n3]?.name || "绝域凶影", description: LAYER3_NODE_TEXT.battle },
  ];
  /* 段2：精英(高风险高奖) + 机缘事件 + 软节点(休整|蛊坊，随机其一)，三选其一无死路 */
  const softNode = getRunRandom("route") < 0.5
    ? { id: "l3-2-c", step: 2, type: "shop", layer3: true, l3theme: theme, icon: "坊", name: theme === "bone" ? "骨阶残坊" : "蜂蜡残坊", description: LAYER3_NODE_TEXT.shop }
    : { id: "l3-2-c", step: 2, type: "rest", layer3: true, l3theme: theme, icon: "息", name: theme === "bone" ? "塔隙喘息" : "蜂舍偷生", description: LAYER3_NODE_TEXT.rest };
  const seg2 = [
    { id: "l3-2-a", step: 2, type: "elite", enemyId: pool.elite, layer3: true, l3theme: theme,
      icon: "煞", name: ENEMY_LIBRARY[pool.elite]?.name || "绝域精英", description: LAYER3_NODE_TEXT.elite },
    { id: "l3-2-b", step: 2, type: "event", layer3: true, l3theme: theme, icon: "缘", name: theme === "bone" ? "塔中异兆" : "蜂窟异兆", description: LAYER3_NODE_TEXT.event },
    softNode,
  ];
  /* V0.9.8.6：段3（step3）战斗 / 机缘 —— 中段多样性 */
  const n4 = pickLayer3Normal(theme, used);
  const seg3 = [
    { id: "l3-3-a", step: 3, type: "battle", enemyId: n4, layer3: true, l3theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n4]?.name || "绝域凶影", description: LAYER3_NODE_TEXT.battle },
    { id: "l3-3-b", step: 3, type: "event", layer3: true, l3theme: theme, icon: "缘",
      name: theme === "bone" ? "塔中异兆" : "蜂窟异兆", description: LAYER3_NODE_TEXT.event },
  ];
  /* 段4（step4）：蛊坊 / 休整 / 逆命 —— 安稳收益 vs 搏命三选一 */
  const seg4 = [
    { id: "l3-4-a", step: 4, type: "shop", layer3: true, l3theme: theme, icon: "坊",
      name: theme === "bone" ? "骨阶残坊" : "蜂蜡残坊", description: LAYER3_NODE_TEXT.shop },
    { id: "l3-4-b", step: 4, type: "rest", layer3: true, l3theme: theme, icon: "息",
      name: theme === "bone" ? "塔隙喘息" : "蜂舍偷生", description: LAYER3_NODE_TEXT.rest },
    { id: "l3-4-c", step: 4, type: "defy", enemyId: pool.elite, enemyHpMultiplier: 1.5, layer3: true, l3theme: theme,
      icon: "逆", name: "逆命搏杀", description: LAYER3_NODE_TEXT.defy },
  ];
  /* 段5（step REST_ROUTE_STEP=5）：绝域残卷 / 临门休整 */
  const seg5 = [
    { id: "l3-5-a", step: 5, type: "reward", layer3: true, l3theme: theme,
      icon: "卷", name: theme === "bone" ? "骨阶残卷" : "蜂蜡残卷", description: LAYER3_NODE_TEXT.reward },
    { id: "l3-5-b", step: 5, type: "rest", layer3: true, l3theme: theme, icon: "息",
      name: theme === "bone" ? "塔隙养息" : "蜂舍喘息", description: LAYER3_NODE_TEXT.rest },
  ];
  /* V0.9.51 段数 6→9：三层新增第 6/7/8 段，用本版新敌（锁骨钟卫/啃碑骨蛭/蜡封蜂侍/蜜噬母胎）。 */
  const l3pool6 = theme === "bone" ? ["boneBellGuard", "steleLeech"] : ["waxAttendant", "honeyWomb"];
  const l3e6 = sampleWithRunRandom(l3pool6, 1, "route")[0] || l3pool6[0];
  const seg6 = [
    { id: "l3-6-a", step: 6, type: "battle", enemyId: l3e6, enemyHpMultiplier: 1.1, layer3: true, l3theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[l3e6].name, description: LAYER3_NODE_TEXT.battle },
    { id: "l3-6-b", step: 6, type: "battle", enemyId: l3pool6[1], enemyHpMultiplier: 1.15, layer3: true, l3theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[l3pool6[1]].name, description: LAYER3_NODE_TEXT.battle },
  ];
  const seg7 = [
    { id: "l3-7-a", step: 7, type: "shop", layer3: true, l3theme: theme, icon: "坊", name: "蛊坊", description: LAYER3_NODE_TEXT.shop },
    { id: "l3-7-b", step: 7, type: "elite", enemyId: pool.elite, enemyHpMultiplier: 1.35, layer3: true, l3theme: theme,
      icon: "煞", name: ENEMY_LIBRARY[pool.elite].name, description: LAYER3_NODE_TEXT.elite },
    { id: "l3-7-c", step: 7, type: "rest", layer3: true, l3theme: theme, icon: "息",
      name: theme === "bone" ? "塔隙养息" : "蜂舍喘息", description: LAYER3_NODE_TEXT.rest },
  ];
  const l3e8 = sampleWithRunRandom(l3pool6, 1, "route")[0] || l3pool6[0];
  const seg8 = [
    { id: "l3-8-a", step: 8, type: "battle", enemyId: l3e8, enemyHpMultiplier: 1.3, layer3: true, l3theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[l3e8].name, description: LAYER3_NODE_TEXT.battle },
    { id: "l3-8-b", step: 8, type: "event", layer3: true, l3theme: theme, icon: "机", name: "命途机缘", description: LAYER3_NODE_TEXT.event },
  ];
  /* 现有三区末段 Boss；身份与旧节点映射由章节数据声明。 */
  const bossSeg = [
    { id: bossDefinition.legacyNodeIds[0], step: bossDefinition.legacyStep, type: "boss", enemyId: bossDefinition.enemyId, layer3: true, l3theme: theme,
      icon: themeName, name: ENEMY_LIBRARY[pool.boss]?.name || "绝域之主", description: LAYER3_NODE_TEXT.boss },
  ];
  return { segments: [seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, bossSeg], theme };
}

/* 进入第三层地图：复用一层/二层渲染管线（替换 mapState + 重置步进 + layer=3） */
function enterLayer3Map(routeId) {
  const route = LAYER3_ROUTES[routeId];
  if (!route || !runState) return;
  applyTianLayerToll("第三层"); // V0.9.19 五重·蚀寿
  // V0.9.33 BGM 冷加载治理：进三层地图即预热本路线 BGM + 结算曲（Boss 后即用）
  window.AudioManager?.warmScene?.(routeId === "beehive" ? "layer3Beehive" : "layer3Bone");
  window.AudioManager?.warmScene?.("conclusion");
  const theme = routeId; /* bone / beehive */
  setMingtuChapterMapPosition(runState, "act-mirror-wilds", routeId, 1);
  setMingtuActRuntimeData(runState, "act-mirror-wilds", {
    routeName: route.name,
    branchChoice: "",
    bossDefeated: false,
    nodesCleared: 0,
    lastNodeName: "第三层入口",
  });
  /* 用第三层地图替换地图（此时一层/二层已结束，体验不受影响） */
  runState.mapState = createLayer3MapState(theme);
  validateRouteMapState(runState.mapState, `layer3:${routeId}`, "act-mirror-wilds", routeId);
  runState.completedNodes = [];
  runState.lockedNodes = [];
  setMingtuChapterMapPosition(runState, "act-mirror-wilds", routeId, 1);
  runState.bossPrepRelicGranted = true; /* 三层不再触发一层 Boss 前整备遗物 */
  layer3MarkProgress(routeId === "bone" ? "boneEntered" : "beehiveEntered");
  getRunStats().layer3Entered = true;
  getRunStats().layer3Route = route.name;
  unlockLorePage(route.loreId || "unfinished");
  addJourneyLog(`命途更深：你踏入第三层「${route.name}」，绝域歧路在脚下重新铺开。`, "important");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  showMapScreen();
}

/* 第三层奖励节点（残卷）：复用倾向选牌；完成后回三层地图（镜像 enterLayer2RewardNode） */
function enterLayer3RewardNode(node) {
  enterMingtuChapterNode(runState, node);
  lockSiblingNodes(node);
  openLayer3Reward({ name: node.name });
}

/* 第三层战斗/非战斗完成后：推进步进、回三层地图；Boss → 三层结算（镜像 layer2CompleteNodeAndReturnMap） */
function layer3CompleteNodeAndReturnMap() {
  const st = runState?.layer3;
  const node = getCurrentRunNode();
  if (!st || !node || !isLayer3Run()) return;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  st.nodesCleared = (st.nodesCleared || 0) + 1;
  st.lastNodeName = `${getCurrentRouteName()}·${node.name}`;
  if (node.type === "boss") {
    st.bossDefeated = true;
    getRunStats().layer3BossDefeated = true;
    layer3MarkProgress(getCurrentRouteId() === "bone" ? "boneBossDefeated" : "beehiveBossDefeated");
    showTowerHeartEntryChoice(); // 三区之主伏诛 → 唯一终局入口「步入塔心」
    return;
  }
  runState.lastMapNotice = `第三层 · ${node.name}已了`;
  advanceMingtuChapterNode(runState, node);
  showMapScreen();
}

/* ===== 塔心入口与断契之门：三区 Boss 胜利后仅能进入固定塔心终局。 ===== */
function showTowerHeartEntryChoice() {
  document.body.classList.add("tower-heart-invitation");
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result unfinished-path-result command-path-result";
  dom.resultSeal.textContent = "心";
  dom.resultEyebrow.textContent = "命途塔 · 塔心在望";
  dom.resultTitle.textContent = "塔心在望";
  dom.resultDescription.textContent = "三区之主已伏诛，塔身深处传来迟缓而巨大的心跳——塔心之门正在头顶缓缓显形。踏过断契之门，直面写定万命的塔心。";
  showBossRewardReceipt();
  dom.resultDeckButton?.classList.remove("hidden");
  dom.resultLoreButton?.classList.remove("hidden");
  dom.resultPrimaryButton.textContent = "步入塔心 · 断契之门";
  dom.resultPrimaryButton.dataset.action = "enterTowerHeart";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultSecondaryButton.dataset.action = "";
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  playTowerHeartThresholdVfx();
  refreshModalLock();
}
/* 选择页拒绝反馈：写进弹窗正文（玩家看得见），不再只落铭刻——杜绝"点了没反应"。 */
function showTowerHeartChoiceRejection(text) {
  addLog(text, "damage-log");
  if (dom.resultDescription) dom.resultDescription.textContent = text;
}
/* 步入塔心：写 gate 场景 + 存检查点 + 展示断契之门。 */
function enterTowerHeartFromChoice() {
  if (!enterMingtuTowerHeart(runState)) { showTowerHeartChoiceRejection("塔心之门未应——只有「进行中」且三区蛊主已伏的命途可入。若本局已结算，请返回首页开一局新的再来。"); return; }
  // 在玩家确认入塔的手势内切入终局曲；后续同曲场景调用会保持续播。
  window.AudioManager?.playScene?.("mupanBoss", { duration: 900, quiet: true });
  document.body.classList.remove("tower-heart-invitation");
  dom.resultPrimaryButton.dataset.action = "";
  dom.resultSecondaryButton.dataset.action = "";
  dom.resultOverlay.classList.add("hidden");
  document.body.classList.remove("modal-open");
  saveRunStateToStorage();
  addJourneyLog("三区之主尽伏。你踏上最后一段阶梯，立于断契之门前。", "important");
  showTowerHeartScene();
}
/* 塔心场景调度：gate=正式全屏 UI；其余诸境（E-2c3/c4 范围）暂给结构占位 + 兼容结算退路。 */
function showTowerHeartScene() {
  if (!runState || !isMingtuTowerHeart(runState) || !dom.towerHeartScreen) return;
  const scene = getMingtuTowerHeartScene(runState);
  if (!scene) return;
  document.body.classList.remove("tower-heart-invitation");
  hideRewardPanels();
  dom.startScreen?.classList.add("hidden");
  dom.mapScreen?.classList.add("hidden");
  dom.battleScreen?.classList.add("hidden");
  dom.resultOverlay?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  document.body.classList.remove("title-open");
  switchLogChannel("journey");
  dom.towerHeartEyebrow.textContent = "命途塔 · 塔心";
  dom.towerHeartTitle.textContent = scene.name || "塔心";
  if (scene.id === "tower-heart-gate") {
    dom.towerHeartBody.textContent = "三区蛊主尽伏，塔身第一次安静下来。\n眼前石门古拙，门心一道旧契文缓缓亮起——凡入此门者，与「命由塔定」之契，就此两断。\n门后再无命途图与蛊坊，只有塔心六境，与万命母盘的心跳。";
    dom.towerHeartActions.innerHTML = '<button type="button" class="tower-heart-btn" data-tower-action="gateConfirm">断契入塔心</button>';
    dom.towerHeartFoot.textContent = "断契之后不可回返命途图。前方没有岔路，只有塔心与万命母盘。";
  } else if (scene.id === "tower-heart-prepare") {
    renderTowerPrepareScene(); // E-2c3
  } else if (scene.id === "tower-heart-question") {
    renderTowerQuestionScene(); // E-2c3
  } else if (scene.id === "tower-heart-reflection") {
    renderTowerReflectionScene(); // E-2c3
  } else if (scene.id === "tower-heart-boss") {
    renderTowerBossScene(); // E-2c4 正式终局战入口
  } else if (scene.id === "tower-heart-ending") {
    renderTowerEndingScene(); // E-2c4 结构（结局正文 E-2c5 展开）
  } else {
    // 防御分支：未知节点（理论不可达）——不提供任何结算捷径
    dom.towerHeartBody.textContent = `塔心已录下你的位置——「${scene.name || "未明之境"}」。`;
    dom.towerHeartActions.innerHTML = '<button type="button" class="tower-heart-btn is-secondary" data-tower-action="returnTitle">返回首页（主动放弃）</button>';
    dom.towerHeartFoot.textContent = "若你看到此页，说明位置数据异常——请通过反馈渠道告知开发者。";
  }
  // E-2c3.1 压迫感入场：重放入场镜头 + 播撒余烬 + 盘心一记心跳（受战斗特效开关门控；CSS 侧另尊重系统减动效）
  dom.towerHeartScreen.classList.remove("is-entering");
  if (effectsEnabled) {
    void dom.towerHeartScreen.offsetWidth; // 强制重排以重放入场动画
    dom.towerHeartScreen.classList.add("is-entering");
    spawnTowerHeartEmbers();
    window.AudioManager?.playSfx?.("guluHeartbeat", { volumeScale: 0.45 });
  }
  dom.towerHeartScreen.classList.remove("hidden");
  playTowerHeartSceneVfx(scene.id);
  refreshModalLock();
}
/* E-2c3.1 余烬粒子：纯观感（guluRandom=UI flavor 白名单通道，不碰种子）；transform/opacity 动画，数量克制。 */
function spawnTowerHeartEmbers() {
  const host = document.getElementById("towerHeartEmbers");
  if (!host) return;
  let html = "";
  for (let i = 0; i < 12; i++) {
    const left = Math.round(16 + guluRandom() * 68);
    const dur = (6 + guluRandom() * 7).toFixed(1);
    const delay = (guluRandom() * 6).toFixed(1);
    const drift = Math.round(-26 + guluRandom() * 52);
    const size = guluRandom() < 0.3 ? 4 : 3;
    html += `<i style="left:${left}%;width:${size}px;height:${size}px;--ember-x:${drift}px;animation-duration:${dur}s;animation-delay:${delay}s;animation-iteration-count:infinite"></i>`;
  }
  host.innerHTML = html;
}
/* E-2c3.1 阶段化确认进行中：焚毁/黑幕演出期间挡住重复点击。 */
let towerActionStaging = false;
/* ===== E-2c3 塔心战前三场景：整备 / 司命终问 / 命债照见 ===== */
/* 塔心整备：一次固定整备，四操作与普通休整同源（REST_OP_VALUES），只允许完成一项，不刷新不随机（材料抽取走同一 reward 种子通道）。 */
function renderTowerPrepareScene() {
  const canRemove = runState.deckCards.length > REST_OP_VALUES.deckMin;
  const canFeed = runState.guStones >= REST_OP_VALUES.feedCost;
  const bloodBonus = runState.heroId === "blood" ? REST_OP_VALUES.healBloodBonus : 0;
  dom.towerHeartBody.textContent = "门在身后合拢。盘缘留出一方静地，蛊火低伏——塔心只容一次整备，四事择一，毕则前行。";
  dom.towerHeartActions.innerHTML = `<div class="tower-heart-options">
    <button type="button" class="tower-heart-option" data-tower-action="prepHeal"><strong>调息养命</strong><small>恢复 ${REST_OP_VALUES.heal + bloodBonus} 点生命${bloodBonus ? "（含血道调血）" : ""}，不超过最大生命。</small></button>
    <button type="button" class="tower-heart-option" data-tower-action="prepRemove" ${canRemove ? "" : "disabled"}><strong>整理蛊囊</strong><small>${canRemove ? `移除 1 张卡牌（蛊囊至少保留 ${REST_OP_VALUES.deckMin} 张）。` : `蛊囊至少保留 ${REST_OP_VALUES.deckMin} 张，暂不可整理。`}</small></button>
    <button type="button" class="tower-heart-option" data-tower-action="prepMaterial"><strong>添火入炉</strong><small>获得 1 份随机炼蛊材料，并获得 ${REST_OP_VALUES.materialStones} 蛊石。</small></button>
    <button type="button" class="tower-heart-option" data-tower-action="prepFeed" ${canFeed ? "" : "disabled"}><strong>饲养本命蛊</strong><small>${canFeed ? `喂 ${REST_OP_VALUES.feedCost} 蛊石：${BENMING_GU[runState.heroId]?.name || "本命蛊"}道行 +${REST_OP_VALUES.feedDao}，本局最大生命 +${REST_OP_VALUES.feedMaxHp}。` : `蛊石不足 ${REST_OP_VALUES.feedCost}。`}</small></button>
  </div>`;
  dom.towerHeartFoot.textContent = "整备只此一次，选定即前行。未选之前此处是安全检查点，可随时离开续局。";
}
function resolveTowerPrepareChoice(choice) {
  if (!runState || runState.status !== "running" || !isMingtuTowerHeart(runState)) return;
  if (runState.chapterProgress.nodeId !== "tower-heart-prepare") return;
  if (choice === "heal") {
    const bonus = runState.heroId === "blood" ? REST_OP_VALUES.healBloodBonus : 0;
    const healed = healRunHp(REST_OP_VALUES.heal + bonus, "塔心整备");
    finishTowerPrepare("调息养命", `恢复 ${healed} 点生命${bonus ? `（血道调血 +${bonus}）` : ""}。`);
    return;
  }
  if (choice === "feed") {
    if (runState.guStones < REST_OP_VALUES.feedCost || !spendGuStones(REST_OP_VALUES.feedCost)) return;
    addBenmingDaoxing(runState.heroId, REST_OP_VALUES.feedDao);
    runState.maxHp += REST_OP_VALUES.feedMaxHp;
    runState.currentHp = Math.min(runState.maxHp, runState.currentHp + REST_OP_VALUES.feedMaxHp);
    const info = getBenmingStageInfo(runState.heroId);
    finishTowerPrepare("饲养本命蛊", `${BENMING_GU[runState.heroId]?.name || "本命蛊"}饱食一顿：道行 +${REST_OP_VALUES.feedDao}（现 ${info.dao}，${info.stageName}），本局最大生命 +${REST_OP_VALUES.feedMaxHp}。`);
    return;
  }
  if (choice === "material") {
    const id = sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0];
    gainMaterial(id, 1, "塔心整备");
    gainGuStones(REST_OP_VALUES.materialStones, "塔心整备");
    finishTowerPrepare("添火入炉", `获得${MATERIALS[id].name}与 ${REST_OP_VALUES.materialStones} 蛊石。`);
    return;
  }
  if (choice === "remove") {
    if (runState.deckCards.length <= REST_OP_VALUES.deckMin) return;
    openTowerPrepareRemovePicker();
  }
}
/* 整备生效收口：先进下一节点、再写档（设计 E2C0 §7.1——防刷新重复领取）。 */
function finishTowerPrepare(label, text) {
  if (!completeMingtuTowerHeartScene(runState, "tower-heart-prepare")) return;
  addLog(`塔心整备：${label}。${text}`, "positive-log");
  addLogToChannel("journey", `命途札记：塔心整备——${label}，${text}`, "system-log");
  saveRunStateToStorage();
  showTowerHeartScene();
}
/* 整备·整理蛊囊：复用独立删卡弹窗（overlay 压在场景壳之上），塔心上下文由标志位路由。 */
let towerPrepareRemoveActive = false;
function openTowerPrepareRemovePicker() {
  towerPrepareRemoveActive = true;
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  if (dom.shopCancelRemoveButton) dom.shopCancelRemoveButton.textContent = "返回整备";
  dom.shopRemoveConfirm?.classList.add("hidden");
  dom.shopRemoveChoices.innerHTML = runState.deckCards
    .map((entry) => renderDeckEntryCard(entry, { button: true, action: "data-shop-remove-card" }))
    .join("");
  showRemovePickerOverlay({ eyebrow: "塔心整备 · 整理蛊囊", title: `选一只蛊移出（当前 ${runState.deckCards.length} 张，至少保留 ${REST_OP_VALUES.deckMin} 张）` });
}
function removeTowerPrepareCard(instanceId) {
  if (!towerPrepareRemoveActive || !runState || runState.status !== "running" || !isMingtuTowerHeart(runState)) return;
  if (runState.chapterProgress.nodeId !== "tower-heart-prepare" || runState.deckCards.length <= REST_OP_VALUES.deckMin) return;
  const removed = removeDeckEntryById(instanceId);
  if (!removed) return;
  towerPrepareRemoveActive = false;
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  hideRemovePickerOverlay();
  finishTowerPrepare("整理蛊囊", `移除「${CARD_LIBRARY[removed.key].name}」。`);
}
/* 司命终问：固定主线对话，只此一问、确认即过（chooseMingtuTowerHeartQuestion 幂等）。 */
function renderTowerQuestionScene() {
  dom.towerHeartBody.textContent = "司命人不知何时立于盘侧，声音贴着地面爬来：\n「再向前一步，塔就再也不能替你改命了。多少人爬到这里，只求塔赐一条好命——你却要亲手斩断它。\n想清楚。断了此念，前方只剩你自己写的结局。」";
  dom.towerHeartActions.innerHTML = '<button type="button" class="tower-heart-btn" data-tower-action="questionConfirm">我意已决 · 拒受写定之命</button>';
  dom.towerHeartFoot.textContent = "司命终问只答一次，不可反悔。此处没有交易，也没有回头路。";
}
function confirmTowerQuestion() {
  if (!chooseMingtuTowerHeartQuestion(runState, "reject-written-fate")) return;
  addJourneyLog("司命终问已过——你拒受写定之命，前路自此只由自己执笔。", "important");
  unlockTowerLorePage("simingDuty"); // E-2c5b 终卷·中：守账之人（unlockLorePage 自带播报行）
  saveRunStateToStorage();
  showTowerHeartScene();
}
/* 命债照见：六类命债由本局行迹纯函数推得（nmg-mupan 评分），主副签快照读档重算不变；确认即锁签应战。 */
const TOWER_DEBT_METRIC_LABELS = Object.freeze({
  blood: ["主动失血", (s) => s.selfHpLost], life: ["焚耗寿元", (s) => s.lifespanSpent],
  fate: ["命势触发", (s) => s.fateTriggers], poison: ["毒伤总量", (s) => s.poisonDamage],
  armor: ["累计得甲", (s) => s.armorGained], haste: ["出牌次数", (s) => s.cardsPlayed],
});
function getTowerDebtSnapshot() {
  return selectMupanDebtSnapshot({ runStats: getRunStats(), maxHp: runState.maxHp, maxLifespan: runState.maxLifespan });
}
function renderTowerReflectionScene() {
  const snapshot = getTowerDebtSnapshot();
  const stats = getRunStats();
  const maxScore = Math.max(...MUPAN_DEBT_TIE_ORDER.map((id) => snapshot.scores[id]), 0.0001);
  const rows = MUPAN_DEBT_TIE_ORDER.map((id, rowIndex) => {
    const def = MUPAN_DEBT_DEFINITIONS[id];
    const [metricLabel, pick] = TOWER_DEBT_METRIC_LABELS[id];
    const value = Math.round(getMupanNonNegative(pick(stats)));
    const badge = id === snapshot.primary.id ? '<b class="tower-debt-badge is-primary">主签</b>' : (id === snapshot.secondary.id ? '<b class="tower-debt-badge">副签</b>' : "");
    const width = Math.max(2, Math.round((snapshot.scores[id] / maxScore) * 100));
    return `<div class="tower-debt-row${id === snapshot.primary.id ? " is-primary" : ""}${id === snapshot.secondary.id ? " is-secondary" : ""}" style="--row-i:${rowIndex}">
      <span class="tower-debt-name">${def.name}${badge}</span>
      <span class="tower-debt-bar"><i style="width:${width}%"></i></span>
      <span class="tower-debt-metric">${metricLabel} ${value}</span>
    </div>`;
  }).join("");
  window.AudioManager?.warmScene?.("mupanBoss"); // E-2c5b：照见即预热终局曲（约3.7MB，应战前足够下完）
  dom.towerHeartBody.textContent = "母盘读出了你最常用的战法，并已针对布置。";
  dom.towerHeartActions.innerHTML = `<div class="tower-heart-debts">${rows}</div>
    <button type="button" class="tower-heart-btn" data-tower-action="reflectionConfirm">合上账页 · 应战</button>`;
  dom.towerHeartFoot.textContent = `主防「${snapshot.primary.name}」 · 次防「${snapshot.secondary.name}」；避开它盯防的行为，可令盘心暴露。`;
}
function confirmTowerReflection() {
  const snapshot = getTowerDebtSnapshot();
  if (!lockMingtuTowerHeartReflection(runState, { primaryId: snapshot.primary.id, secondaryId: snapshot.secondary.id })) return;
  addJourneyLog(`母盘看穿了你的习惯：最常「${snapshot.primary.name}」、次常「${snapshot.secondary.name}」。`, "important");
  saveRunStateToStorage();
  showTowerHeartScene();
}

/* 断契确认：gate → prepare，推进即存检查点（isMingtuSafeRunCheckpoint 放行塔心安全场景）。 */
function confirmTowerHeartGate() {
  if (!completeMingtuTowerHeartScene(runState, "tower-heart-gate")) return;
  saveRunStateToStorage();
  addJourneyLog("断契之门开——与「命由塔定」之契，就此两断。", "important");
  showTowerHeartScene();
}
/* 塔心固定链路：gate→整备→终问→照见→母盘战→角色结局→cleared。 */

/* ===== E-2c4 终局战入口场景 + 角色结局场景 ===== */
/* 万命母盘·战前：主副签回执 + 启战。战败即殒；中途关闭从此处（锁签后检查点）恢复、整场重开（§7.2）。 */
function renderTowerBossScene() {
  // E-2c5b.2 玩家要求：终局曲在「合上账页·应战」进入战前场景时即起，开战时同曲无缝续播（playScene 同键不重启）。
  window.AudioManager?.playScene?.("mupanBoss", { duration: 900, quiet: true });
  const locked = runState.chapterProgress?.towerHeart?.reflection || null;
  const primaryName = locked ? MUPAN_DEBT_DEFINITIONS[locked.primaryId]?.sealName : "未明";
  const secondaryName = locked ? MUPAN_DEBT_DEFINITIONS[locked.secondaryId]?.sealName : "未明";
  dom.towerHeartBody.textContent = `母盘主防「${primaryName}」，次防「${secondaryName}」。\n触发当前盯防会被追击；避开则令盘心暴露。`;
  dom.towerHeartActions.innerHTML = '<button type="button" class="tower-heart-btn" data-tower-action="bossStart">启战 · 万命母盘</button>';
  dom.towerHeartFoot.textContent = "终局之战：战败即陨（不可收手）；中途离开将回到此处、整场重开。";
}
/* ===== E-2c5b 四角色结局正文（定稿：DESIGN-E2C5-ENDINGS-AND-SCROLLS.md §一）=====
 * 无名双路线只差一句（衔命虫那一眼）；其余角色单稿。结算摘要 ≤40 字。 */
const TOWER_ENDINGS = Object.freeze({
  fate: Object.freeze({
    title: "无名之名",
    summary: "无名者掰断死局判词，命途自此由己执笔。",
    closing: "「命格断我是死局。现在，判词由我来写。」",
    tail: "塔门外风很大，吹开的不是路——是整张还没落笔的蛊源大陆。",
    wormLine: Object.freeze({
      threeWeave: "虫不作声，三色命线在虫口交缠成一股，另一头空空荡荡——",
      devourOmen: "虫不作声，齿间还叼着半枚没咽下去的碎签，命线另一头空空荡荡——",
      default: "虫不作声，命线在虫口悬着，另一头空空荡荡——",
    }),
    bodyOf(path) {
      const worm = this.wormLine[path] || this.wormLine.default;
      return `盘心碎后，塔内安静得能听见自己的心跳——不是母盘的，是他自己的。\n他在断契之门前放过血，在司命终问前立过誓，可直到此刻他才发现：塔从头到尾都没能写下他的名字。求命者入塔要以名立契，他无名，契上便始终留着一处空白。母盘穷尽万命，也填不满这一格。\n原来他能走到盘心，靠的不是比谁都强，而是他从进塔那天起，就没把笔交出去过。\n他低头看了看掌心的衔命虫。${worm}\n好。空着就空着。往后一笔一划，他自己来。`;
    },
  }),
  blood: Object.freeze({
    title: "血账两讫",
    summary: "绛妄血账两讫，此后每滴血都由自己定价。",
    closing: "「我的血，从此只记在我自己的账上。」",
    tail: "她把刀背在身后走出塔门，塔外的血腥味很淡——大陆很大，还没有哪笔账非流血不可。",
    bodyOf() {
      return "血债签碎成灰的时候，绛妄下意识去摸刀——多年来，每一次变强，她都要先摸到自己的伤。\n以血换力，以痛换生。塔最喜欢她这样的人：账目清楚，回回照付，从不赊欠。母盘把她的付法编成命签，想让她死在自己最熟练的那笔账上。\n她没有。她把最后一滴该付的血，付在了盘心上。\n旧伤不会消失。指节上的裂口、肋下的暗痕，都还在，往后也会一直在。但从今往后，她再流的每一滴血，都得先问过她自己——\n这就够了。";
    },
  }),
  poison: Object.freeze({
    title: "与毒同行",
    summary: "青蟒与毒立誓同行，边界自此由她看守。",
    closing: "「毒未负我，我亦不弃毒。」",
    tail: "出塔时她放慢了脚步——瘴林在南，大陆的风里有她没闻过的百种毒香。",
    bodyOf() {
      return "毒债签熄灭时，青蟒等了很久——等那股熟悉的、从骨缝里往外爬的痒。\n它没有消失。\n她其实早就知道会这样。塔能碎，签能断，可她血里的毒是她自己一口一口喂大的，是被弃在瘴林那些年里，唯一肯留在她身体里的东西。母盘想把「毒终将反噬其主」写成她的结局；盘心碎了，这句判词没了下文——但毒还在，失控的边界也还在，只是从今往后，站在边界上守着的不是塔，是她。\n她抬手，看鳞纹在腕上明明灭灭。\n不驯，不祛。同行。";
    },
  }),
  longevity: Object.freeze({
    title: "余烬为灯",
    summary: "朝暮以余烬点灯，残岁虽短，火由自己掌。",
    closing: "「朝如青丝暮成雪——可这雪，是我自己落的。」",
    tail: "她提着那盏小灯走进塔外的夜色里，大陆无边，灯照多远，她就走多远。",
    bodyOf() {
      return "走出盘心的时候，朝暮数了数自己剩下的日子。\n不多。焚掉的寿元一天也不会回来——塔碎了也不会。她入塔前就白了的头发，如今连眉梢都染上了霜色。母盘曾把这笔账摊开给她看：灯尽签上写着，她终将在某个借来的黎明前熄灭。\n可她比谁都清楚：那些岁月不是被偷走的，是她一盏一盏，亲手点出去的。照过路，救过人，烧穿过这座塔。\n账可以认，命不能由它写。\n她从怀里摸出最后一截灯芯，就着盘心的余烬点燃。火很小，握在她自己手里。\n这一次，烧多久，由她说了算。";
    },
  }),
  bone: Object.freeze({
    title: "铃止由心",
    summary: "闻铃收起叩寿骨铃，从此只听骨响，不替天数命。",
    closing: "「骨会响，命却不该由谁替你数尽。」",
    tail: "她走出塔门时没有回头。远处千骨各有回声，却再没有一声替众生宣判死期。",
    bodyOf() {
      return "盘心碎裂后，闻铃听见满塔遗骨同时发出细响。\n那不是哀哭，也不是索命。是被母盘记作数目的无数条命，终于从判词里挣脱出来。她曾以为叩寿骨铃能听见天数：哪根骨将断，哪口气将尽，铃都会先一步告诉她。直到此刻她才明白，铃听见的从来不是天命，只是塔强塞给众生的答案。\n她把叩寿骨铃握在掌中，没有再敲。骨缝里的余响一声声远去，最后只剩自己的心跳。\n往后她仍会听骨、护命、断敌，却不再替任何人宣判还能活多久。";
    },
  }),
});
function getTowerEnding() {
  return TOWER_ENDINGS[runState?.heroId] || TOWER_ENDINGS.fate;
}
/* E-2c5b 终卷解锁：持久解锁走 unlockLorePage（重复通关自然去重），本局新启另记入 runStats 供结算页展示。 */
function unlockTowerLorePage(id) {
  if (!unlockLorePage(id)) return false;
  const stats = getRunStats();
  if (!Array.isArray(stats.newLorePages)) stats.newLorePages = [];
  if (!stats.newLorePages.includes(id)) stats.newLorePages.push(id);
  return true;
}
function renderTowerEndingScene() {
  const ending = getTowerEnding();
  dom.towerHeartEyebrow.textContent = "命途塔 · 角色结局";
  dom.towerHeartTitle.textContent = `《${ending.title}》`;
  dom.towerHeartBody.textContent = `${ending.bodyOf(runState.benmingPath || "")}\n\n${ending.closing}`;
  dom.towerHeartActions.innerHTML = '<button type="button" class="tower-heart-btn" data-tower-action="endingConfirm">执笔封卷 · 章节通关</button>';
  dom.towerHeartFoot.textContent = ending.tail;
}
/* 结局确认：completeMingtuTowerHeartEnding → finalizeRun("cleared")（唯一通关正门）；揭幕归调用方。 */
function confirmTowerEnding() {
  if (!runState || runState.status !== "running") return;
  if (!completeMingtuTowerHeartEnding(runState)) return;
  unlockTowerLorePage("afterTower"); // E-2c5b 终卷·下：断盘之后（通关结算节拍解锁，结算页新启格可见）
  addJourneyLog(`角色结局《${getTowerEnding().title}》已封卷。`, "important");
  if (!finalizeRun("cleared")) return;
  dom.towerHeartScreen?.classList.add("hidden");
  devRevealRunConclusion(); // 与 finishBattle 尾部同构的揭幕（掀结算页+模态锁+视口刷新）
}

/* ===== 命途更深：二层 Boss 胜利后的选择面板（结算 / 深入第三层），镜像 showUnfinishedPathChoice ===== */
function showCommandPathChoice() {
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result unfinished-path-result command-path-result";
  dom.resultSeal.textContent = "深";
  dom.resultEyebrow.textContent = "命途未尽 · 深入绝域";
  dom.resultTitle.textContent = "命途未尽";
  dom.resultDescription.textContent = "深泽已破，蛊息却未止。远处骨塔有铃声摇动，蜂窟中万翅齐鸣……此时可收手离塔并带走所得，或继续深入绝域。";
  showBossRewardReceipt();
  dom.resultDeckButton?.classList.remove("hidden");
  dom.resultLoreButton?.classList.remove("hidden");
  dom.resultPrimaryButton.textContent = "继续深入";
  dom.resultPrimaryButton.dataset.action = "enterLayer3";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultSecondaryButton.textContent = "收手离塔";
  dom.resultSecondaryButton.dataset.action = "settleLayer2";
  dom.resultSecondaryButton.classList.remove("hidden");
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  refreshModalLock();
}

/* 选择「收手离塔」：阶段收手，不触发完整通关。 */
function settleAtLayer2() {
  dom.resultSecondaryButton.dataset.action = "";
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultPrimaryButton.dataset.action = "";
  showLayer2Conclusion();
}

/* ===== 第三层路线选择面板（镜像 showLayer2RouteSelect） ===== */
function showLayer3RouteSelect() {
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result layer3-route-result";
  dom.resultSeal.textContent = "径";
  dom.resultEyebrow.textContent = "第三层 · 绝域分岔";
  dom.resultTitle.textContent = "择一径深入";
  dom.resultDescription.textContent = "两条绝域歧路在脚下展开，择定便难回头。";
  const card = (r) => `
    <button type="button" class="layer2-route-card layer3-route-card" data-layer3-route="${r.id}">
      <span class="layer2-route-icon">${r.icon}</span>
      <strong class="layer2-route-name">${r.name}</strong>
      <p class="layer2-route-intro">${r.intro}</p>
      <p class="layer2-route-line layer2-route-rec">${r.recommend}</p>
      <p class="layer2-route-line layer2-route-risk">${r.risk}</p>
      <p class="layer2-route-line layer2-route-foes">${r.enemiesPreview}</p>
    </button>`;
  dom.runSummary.innerHTML = `<div class="layer2-route-grid layer3-route-grid">${card(LAYER3_ROUTES.bone)}${card(LAYER3_ROUTES.beehive)}</div>`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

/* 选定第三层路线，初始化 layer3 状态并进入第三层地图（镜像 chooseLayer2Route） */
function chooseLayer3Route(routeId) {
  const route = LAYER3_ROUTES[routeId];
  if (!route || !runState) return;
  setMingtuChapterMapPosition(runState, "act-mirror-wilds", routeId, 1);
  setMingtuActRuntimeData(runState, "act-mirror-wilds", {
    routeName: route.name,
    branchChoice: "",
    bossDefeated: false,
    nodesCleared: 0,
    lastNodeName: "第三层入口",
  });
  /* V0.9.12.1 修复双计数：进层持久计数只在 enterLayer3Map 记一次（DEV 直跳同口径），此处不再重复累加 */
  getRunStats().layer3Entered = true;
  getRunStats().layer3Route = route.name;
  unlockLorePage(route.loreId || "unfinished");
  dom.runSummary.classList.add("hidden");
  enterLayer3Map(routeId);
}

/* 第三层三选一分岔：机缘 / 休整 / 蛊坊（镜像 showLayer2Branch） */
function showLayer3Branch(node) {
  const st = runState.layer3;
  const route = LAYER3_ROUTES[getCurrentRouteId()];
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result layer3-branch-result";
  dom.cardRewardPanel.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultSeal.textContent = "岔";
  dom.resultEyebrow.textContent = `第三层 · ${route.name}`;
  dom.resultTitle.textContent = node.name;
  dom.resultDescription.textContent = "三念定局，择一而行。";
  dom.runSummary.innerHTML = `<div class="layer2-branch-grid layer3-branch-grid">
    <button type="button" class="layer2-branch-card" data-layer3-branch="event"><strong>探秘机缘</strong><small>触发一次绝域机缘事件</small></button>
    <button type="button" class="layer2-branch-card" data-layer3-branch="rest"><strong>塔隙休整</strong><small>回血或固本，养息一息</small></button>
    <button type="button" class="layer2-branch-card" data-layer3-branch="shop"><strong>残灯蛊坊</strong><small>以蛊石易牌与炼化机会</small></button>
  </div>`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

/* 选定第三层分岔类型：复用现有非战斗节点入口；完成回调统一走 layer3（镜像 chooseLayer2Branch） */
function chooseLayer3Branch(kind) {
  const st = runState?.layer3;
  if (!st || !isLayer3Run()) return;
  st.branchChoice = kind;
  dom.runSummary.classList.add("hidden");
  const node = getCurrentMapSegmentNodes().find((candidate) => candidate.type === kind);
  if (!node) return;
  enterMingtuChapterNode(runState, node);
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  if (kind === "event") openChanceEvent();
  else if (kind === "rest") openRestNode();
  else if (kind === "shop") openShopNode();
}

/* 第三层奖励节点：在现有牌奖励池上对该路线倾向 key 加权（镜像 openLayer2Reward） */
function openLayer3Reward(node) {
  const st = runState.layer3 || {};
  const route = LAYER3_ROUTES[getCurrentRouteId()] || { name: getCurrentRouteName() || "绝域深径", loreId: "unfinished", favoredCardKeys: [] };
  if (route.loreId) unlockLorePage(route.loreId);
  runState.layer3.rewardResolved = false;
  runState.rewardResolved = false;
  runState.materialRewardResolved = false;
  const choices = generateLayer3RewardChoices(route);
  runState.pendingRewardKeys = choices;
  dom.resultOverlay.querySelector(".result-card").className = "result-card";
  initializeCardRewardLayout();
  dom.resultSeal.textContent = "获";
  dom.resultEyebrow.textContent = `第三层 · ${route.name || "绝域深径"} 残卷`;
  dom.resultTitle.textContent = "绝域收获";
  dom.resultDescription.textContent = node?.name
    ? `${node.name}遗落绝域深处的蛊卵，倾向此径之道。三选其一，或舍弃前行。`
    : "绝域深处遗落的蛊卵，倾向此径之道。三选其一，或舍弃前行。";
  dom.runSummary?.classList.add("hidden");
  dom.cardRewardChoices.innerHTML = choices.map((key) => {
    const item = CARD_LIBRARY[key];
    return `<button class="reward-card" type="button" data-reward-card="${key}">
      ${getRewardGlyphHtml(key, item.glyph)}<strong>${item.name}</strong>
      <small>${item.typeName} · ${item.cost} 真元</small><p>${getCardEffect(key, 0)}</p>
    </button>`;
  }).join("");
  dom.skipRewardButton.disabled = false;
  dom.cardRewardPanel.classList.remove("hidden");
  dom.refinePanel.classList.add("hidden");
  // V0.9.57：原为手写的「一并藏掉休整/炼炉/材料」清单，因漏了蛊坊而与坊市穿模（玩家实报）。
  // 面板互斥已上移到 initializeCardRewardLayout 的 hideRewardPanels 单源，此处不再重复列举。
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

/* 第三层倾向加权选牌（镜像 generateLayer2RewardChoices，favoredCardKeys 为三层版） */
// V0.9.8.5b：非血道英雄无法产血煞，returnLife(消耗3血煞回血)对其是100%废牌——从奖励/拿牌事件中过滤掉，避免整页非本流派牌、拿牌事件空过。
function rewardKeyUsableByHero(key) {
  if (key === "returnLife" && runState?.heroId !== "blood") return false;
  return true;
}
function generateLayer3RewardChoices(route) {
  const used = new Set();
  const out = [];
  const favored = ((route && route.favoredCardKeys) || []).filter((k) => CARD_LIBRARY[k] && rewardKeyUsableByHero(k));
  // V0.9.8.4：血道英雄进入三层(骨/蜂主题)时，专属奖励节点保底塞 1 张 returnLife，避免整页非本流派牌。
  if (runState?.heroId === "blood" && CARD_LIBRARY["returnLife"] && !used.has("returnLife")) {
    out.push("returnLife"); used.add("returnLife");
  }
  while (out.length < 3 && favored.length) {
    const k = takeUniqueRandom(favored, used, "reward");
    if (!k) break;
    out.push(k); used.add(k);
  }
  while (out.length < 3) {
    const k = getRandomRewardCardKey({ rare: getRunRandom("reward") < 0.4, channel: "reward" });
    if (!k) break;
    if (!used.has(k)) { out.push(k); used.add(k); }
    if (used.size > 30) break;
  }
  return out.slice(0, 3);
}

/* 第二层战斗/非战斗完成后：推进步进、回到二层地图；Boss → 二层结算 */
function layer2CompleteNodeAndReturnMap() {
  const st = runState?.layer2;
  const node = getCurrentRunNode();
  if (!st || !node || !isLayer2Run()) return;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  st.nodesCleared = (st.nodesCleared || 0) + 1;
  st.lastNodeName = `${getCurrentRouteName()}·${node.name}`;
  if (node.type === "boss") {
    st.bossDefeated = true;
    getRunStats().layer2BossDefeated = true;
    layer2MarkProgress(getCurrentRouteId() === "miasma" ? "miasmaBossDefeated" : "bloodmarshBossDefeated");
    // V0.9.8.7：不在此清空 currentNode——保持为 Boss 节点，使 saveRunStateToStorage 门控（!currentNode）在「命途更深」选择面板期间拒绝写档，避免切后台写入「Boss已completed、currentRouteStep=6」坏档致续局二层地图卡死。currentNode 由 enterLayer3Map 重置或随结算终局。与一层（completeCurrentBattleNode 不清 currentNode）一致。
    // V0.9.8：二层 Boss 破后不直接结算，先弹「命途更深」让玩家选 深入第三层 / 就此结算
    showCommandPathChoice();
    return;
  }
  runState.lastMapNotice = `第二层 · ${node.name}已了`;
  advanceMingtuChapterNode(runState, node);
  showMapScreen();
}

/* 第二层节点完成后推进（被 finishBattle 胜利分支 / 奖励完成 / 事件完成调用） */
function layer2OnNodeCleared() {
  const st = runState?.layer2;
  if (!st || !isLayer2Run()) return false;
  const route = LAYER2_ROUTES[getCurrentRouteId()];
  const node = route.nodes[st.nodeIndex];
  st.nodesCleared += 1;
  if (node && node.kind === "boss") {
    st.bossDefeated = true;
    getRunStats().layer2BossDefeated = true;
    layer2MarkProgress(getCurrentRouteId() === "miasma" ? "miasmaBossDefeated" : "bloodmarshBossDefeated");
    st.nodeIndex += 1;
    showCommandPathChoice();
    return true;
  }
  st.nodeIndex += 1;
  layer2Advance();
  return true;
}

/* 三选一分岔：普通战 / 休整 / 蛊坊（复用现有事件、休整、蛊坊入口） */
function showLayer2Branch(node) {
  const st = runState.layer2;
  const route = LAYER2_ROUTES[getCurrentRouteId()];
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result layer2-branch-result";
  dom.cardRewardPanel.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultSeal.textContent = "岔";
  dom.resultEyebrow.textContent = `第二层 · ${route.name}`;
  dom.resultTitle.textContent = node.name;
  dom.resultDescription.textContent = "三念定局，择一而行。";
  dom.runSummary.innerHTML = `<div class="layer2-branch-grid">
    <button type="button" class="layer2-branch-card" data-layer2-branch="event"><strong>探秘机缘</strong><small>触发一次生态机缘事件</small></button>
    <button type="button" class="layer2-branch-card" data-layer2-branch="rest"><strong>沼隙休整</strong><small>回血或固本，养息一息</small></button>
    <button type="button" class="layer2-branch-card" data-layer2-branch="shop"><strong>残灯蛊坊</strong><small>以蛊石易牌与炼化机会</small></button>
  </div>`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

/* 选定分岔类型：复用现有非战斗节点入口；完成回调统一走 layer2 */
function chooseLayer2Branch(kind) {
  const st = runState?.layer2;
  if (!st || !isLayer2Run()) return;
  st.branchChoice = kind;
  dom.runSummary.classList.add("hidden");
  const node = getCurrentMapSegmentNodes().find((candidate) => candidate.type === kind);
  if (!node) return;
  enterMingtuChapterNode(runState, node);
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  if (kind === "event") openChanceEvent();
  else if (kind === "rest") openRestNode();
  else if (kind === "shop") openShopNode();
}

/* 第二层奖励节点：在现有牌奖励池上对该路线倾向 key 加权（不改池、不新增卡） */
function openLayer2Reward(node) {
  const st = runState.layer2 || {};
  const route = LAYER2_ROUTES[getCurrentRouteId()] || { name: getCurrentRouteName() || "生态深径", loreId: "unfinished", favoredCardKeys: [] };
  if (route.loreId) unlockLorePage(route.loreId); /* 复用现成残卷页，作“路线残卷”露出 */
  runState.layer2.rewardResolved = false;
  runState.rewardResolved = false;
  runState.materialRewardResolved = false;
  /* 复用 openCardReward 的展示，但用倾向选牌覆盖候选 */
  const choices = generateLayer2RewardChoices(route);
  runState.pendingRewardKeys = choices;
  dom.resultOverlay.querySelector(".result-card").className = "result-card";
  initializeCardRewardLayout();
  dom.resultSeal.textContent = "获";
  dom.resultEyebrow.textContent = `第二层 · ${route.name || "生态深径"} 残卷`;
  dom.resultTitle.textContent = "生态收获";
  dom.resultDescription.textContent = node?.name
    ? `${node.name}遗落生态深处的蛊卵，倾向此径之道。三选其一，或舍弃前行。`
    : "生态深处遗落的蛊卵，倾向此径之道。三选其一，或舍弃前行。";
  dom.runSummary?.classList.add("hidden");
  dom.cardRewardChoices.innerHTML = choices.map((key) => {
    const item = CARD_LIBRARY[key];
    return `<button class="reward-card" type="button" data-reward-card="${key}">
      ${getRewardGlyphHtml(key, item.glyph)}<strong>${item.name}</strong>
      <small>${item.typeName} · ${item.cost} 真元</small><p>${getCardEffect(key, 0)}</p>
    </button>`;
  }).join("");
  dom.skipRewardButton.disabled = false;
  dom.cardRewardPanel.classList.remove("hidden");
  dom.refinePanel.classList.add("hidden");
  // V0.9.57：原为手写的「一并藏掉休整/炼炉/材料」清单，因漏了蛊坊而与坊市穿模（玩家实报）。
  // 面板互斥已上移到 initializeCardRewardLayout 的 hideRewardPanels 单源，此处不再重复列举。
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

/* 倾向加权选牌：优先从 favoredCardKeys 取，余位用现有通用池补（去重） */
function generateLayer2RewardChoices(route) {
  const used = new Set();
  const out = [];
  const favored = ((route && route.favoredCardKeys) || []).filter((k) => CARD_LIBRARY[k] && rewardKeyUsableByHero(k));
  // V0.9.8.4：血道英雄进入二层(瘴林主题无回血)时，专属奖励节点保底塞 1 张 returnLife（血沼路线 favored 本就含，去重不重复）。
  if (runState?.heroId === "blood" && CARD_LIBRARY["returnLife"] && !used.has("returnLife")) {
    out.push("returnLife"); used.add("returnLife");
  }
  /* 主题卡优先填满到 3 张（favored 充足时整页主题卡；不足则余位走通用池） */
  while (out.length < 3 && favored.length) {
    const k = takeUniqueRandom(favored, used, "reward");
    if (!k) break;
    out.push(k); used.add(k);
  }
  while (out.length < 3) {
    const k = getRandomRewardCardKey({ rare: getRunRandom("reward") < 0.35, channel: "reward" });
    if (!k) break;
    if (!used.has(k)) { out.push(k); used.add(k); }
    if (used.size > 30) break;
  }
  return out.slice(0, 3);
}

/* 第二层阶段收手结算页：扩展显示路线/Boss/节点/新增条目数。 */
function showLayer2Conclusion() {
  const st = runState.layer2 || {};
  if (!finalizeRun("withdrawn")) return false;
  /* 在结算 summary 顶部补一段第二层信息（DOM 追加，不改 showRunConclusion 主体） */
  const route = LAYER2_ROUTES[getCurrentRouteId()] || null;
  const routeName = route?.name || getCurrentRouteName() || "未进入";
  const bossName = (route && typeof ENEMY_LIBRARY !== "undefined" && ENEMY_LIBRARY[route.bossId]?.name) || "生态之主";
  const bestiaryCount = (typeof layer2LoadBestiary === "function" ? layer2LoadBestiary().size : 0);
  const extra = document.createElement("div");
  extra.className = "run-summary-item wide layer2-summary-block";
  extra.innerHTML = `<span>第二层 · ${routeName}</span><strong>` +
    `Boss「${bossName}」${st.bossDefeated ? "已破" : "未破"} · ` +
    `推进 ${st.nodesCleared || 0} 节点 · 终点「${st.lastNodeName || "-"}」 · ` +
    `万蛊录新增 ${bestiaryCount} 条</strong>`;
  dom.runSummary?.prepend(extra);
  // 关键：finishBattle 的二层分支提前 return，不会走到通用的显示遮罩处，这里自己显示，避免 Boss 胜利后卡住。
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateMobileViewportState();
  return true;
}

function completeOverlayNode() {
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  // 空囊契的逐层司命人相逢发生在节点入场前，此时没有 currentNode；完成交易后只需安全回图，不能误推进路线。
  if (runState?.activeEventId === "siming" && !getCurrentRunNode()) {
    runState.activeEventId = null;
    showMapScreen();
    return;
  }
  if (isLayer3Run()) { layer3CompleteNodeAndReturnMap(); return; }
  if (isLayer2Run()) { layer2CompleteNodeAndReturnMap(); return; }
  completeCurrentNodeAndReturnMap();
}

function getEventChoiceTone(option) {
  if ([
    "rareCard", "cardNextHurt", "lifespanMaterial", "bloodMaterials", "bloodLimit",
    "stealMaterialEnemyBuff", "hurtRelic", "lifespanTwoMaterials", "randomUpgradeBacklash", "poisonBloodResidue",
    "boneBellChime", "waxStonesPoison", "boneScrollImprint",
    "heroFateThreadCard", "heroBloodOathLimit", "heroPoisonClaim", "heroLongevityLampRefine",
    "heroDragonEmberOath", // V0.9.51 #28 烬鳞旧誓：自损换下一场龙鳞
  ].includes(option.kind)) return "risk";
  if (["material", "heal", "stones", "removeBasic", "buyRandomCard", "removeAnyCard", "poisonCard",
    "boneFragmentDefense", "boneScrollArmorOrHp", "waxSmokeHeal", "honeyPoisonCard", "honeyBurnRemoveOrStones"].includes(option.kind)) return "steady";
  return "safe";
}

function getEventChoiceMeta(option) {
  if (getEventChoiceTone(option) === "risk") return "高风险";
  if (getEventChoiceTone(option) === "steady") return "稳妥收益";
  return "安全";
}

function getEventMapNotice(event, option, resultText) {
  if (option?.materialId) return `你带走了${MATERIALS[option.materialId].name}`;
  if (option?.kind === "bloodMaterials") return "你带走了血砂与腐液";
  if (option?.kind === "stealMaterialEnemyBuff") return "你夺得一味材料，但惊动了后路";
  if (option?.kind === "hurtRelic") return "血签落定，一件遗物入囊";
  if (option?.kind === "poisonBloodResidue") return "毒血残留，腐液入囊";
  if (option?.kind === "heroFateThreadCard") return "旧命线入囊，命丝随身";
  if (option?.kind === "heroBloodOathLimit") return "血契回咬，血煞更深";
  if (option?.kind === "heroPoisonClaim") return "井毒认主，腐液入囊";
  if (option?.kind === "heroLongevityLampRefine") return "寿灯借火，炉火转稳";
  if (option?.kind === "heroDragonEmberOath") return "旧誓续燃，下一战鳞火先行"; // V0.9.51 #28
  if (option?.kind === "leave") return `${event.name}：你安全离开`;
  return `${event.name}已定`;
}

function getChanceEventPool() {
  if (isLayer3Run() && typeof LAYER3_THEME_EVENTS !== "undefined") {
    const layer3Pool = LAYER3_THEME_EVENTS[getCurrentRouteId()];
    if (Array.isArray(layer3Pool) && layer3Pool.length) return layer3Pool;
  }
  const heroPool = HERO_CHANCE_EVENTS[runState?.heroId] || [];
  const base = heroPool.length ? [...CHANCE_EVENTS, ...heroPool] : [...CHANCE_EVENTS];
  // V0.9.51 #28 层2主题事件：混入（非层3式整池替换）——保多样性同时带出生态风味。
  if (isLayer2Run() && typeof LAYER2_THEME_EVENTS !== "undefined") {
    const layer2Pool = LAYER2_THEME_EVENTS[getCurrentRouteId()];
    if (Array.isArray(layer2Pool) && layer2Pool.length) return [...base, ...layer2Pool];
  }
  return base;
}

function findChanceEventById(id) {
  let event = CHANCE_EVENTS.find((item) => item.id === id);
  if (event) return event;
  for (const pool of Object.values(HERO_CHANCE_EVENTS)) {
    event = (pool || []).find((item) => item.id === id);
    if (event) return event;
  }
  if (typeof LAYER3_THEME_EVENTS !== "undefined") {
    Object.keys(LAYER3_THEME_EVENTS).some((theme) => {
      const hit = (LAYER3_THEME_EVENTS[theme] || []).find((item) => item.id === id);
      if (hit) { event = hit; return true; }
      return false;
    });
  }
  // V0.9.51 #28 层2主题事件：弹窗关掉再回来时按 activeEventId 复原，新池必须可查。
  if (!event && typeof LAYER2_THEME_EVENTS !== "undefined") {
    Object.keys(LAYER2_THEME_EVENTS).some((theme) => {
      const hit = (LAYER2_THEME_EVENTS[theme] || []).find((item) => item.id === id);
      if (hit) { event = hit; return true; }
      return false;
    });
  }
  return event || null;
}

// V0.9.36 B-6c：司命人跨局死亡计数辅助已抽至 nmg-story.js；事件流程仍留在此处。
function currentLayerKey() { return getCurrentActLayer(); }
function maybeMeetSiming() {
  if (!runState) return false;
  runState.simingMetLayers = runState.simingMetLayers || [];
  const layer = currentLayerKey();
  if (runState.simingMetLayers.includes(layer)) return false;
  const met = runState.simingMetCount || 0;
  if (met > 0) {
    const missed = getRunRandom("event") >= 0.35; // 首遇必出；之后每层 35% 概率
    // V0.9.40 QS-1a 空囊契：司命人层层必遇——roll 照常消耗（契局与无契局事件序列同构），结果强制。
    const guaranteed = typeof isContractSimingGuaranteed === "function" && isContractSimingGuaranteed(runState);
    if (missed && !guaranteed) return false;
  }
  openSimingEvent();
  return true;
}
function openSimingEvent() {
  // V0.9.18.1：相遇计数移到 resolveSimingChoice 才记——弹窗打开后切后台被自动存档，重进不该丢掉这次相遇。
  const deaths = getSimingDeaths();
  const met = runState.simingMetCount || 0;
  let opening;
  if (met === 0 && deaths > 0) opening = SIMING.afterDeath(deaths);
  else if (met > 0) opening = SIMING.reunion;
  else opening = SIMING.firstMeet;
  const heroLine = SIMING.heroLine[runState.heroId] || "";
  runState.activeEventId = "siming";
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result";
  hideRewardPanels();
  dom.resultSeal.textContent = "司";
  dom.resultEyebrow.textContent = "命途分岔 · 司命人";
  dom.resultTitle.textContent = "塔中回声";
  dom.resultDescription.textContent = "收代价的人在此等你。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.eventName.textContent = SIMING.name;
  dom.eventStory.textContent = opening + (heroLine ? "\n" + heroLine : "");
  dom.eventChoices.innerHTML = SIMING.options.map((o, i) => {
    const tone = o.kind === "simingLeave" ? "safe" : "steady";
    return `<button class="event-choice ${tone}" type="button" data-event-choice="${i}"><strong>${o.label}</strong><small>${o.detail}</small></button>`;
  }).join("");
  dom.eventResult.classList.add("hidden");
  dom.eventResult.textContent = "";
  dom.eventPanel.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}
function resolveSimingChoice(index) {
  const option = SIMING.options[Number(index)];
  if (!option) return;
  dom.eventChoices.querySelectorAll("button").forEach((b) => { b.disabled = true; });
  // V0.9.18.1：做出选择才算真正相遇（同层去重 + 重逢台词的依据），弹窗中途丢档不消耗本层机会。
  runState.simingMetLayers = runState.simingMetLayers || [];
  const metLayer = currentLayerKey();
  const firstMeeting = !runState.simingMetLayers.includes(metLayer);
  const contractForcedMeeting = firstMeeting && Boolean(runState.contractForcedSimingPending);
  if (firstMeeting) {
    runState.simingMetLayers.push(metLayer);
    runState.simingMetCount = (runState.simingMetCount || 0) + 1;
  }
  runState.contractForcedSimingPending = false;
  if (contractForcedMeeting) {
    const stats = getRunStats();
    stats.contractForcedSimingEncounters = safeStatNumber(stats.contractForcedSimingEncounters) + 1;
  }
  let resultText = "";
  if (option.kind === "simingBlood") {
    const lost = reduceRunHpSafely(EVENT_BALANCE.siming.bloodHpCost);
    gainGuStones(EVENT_BALANCE.siming.bloodGuStones, SIMING.name, { log: false });
    const id = sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0];
    gainMaterial(id, 1, SIMING.name, { log: false });
    resultText = `你割血奉上，失去 ${lost} 点生命，换得 ${EVENT_BALANCE.siming.bloodGuStones} 蛊石与「${MATERIALS[id].name}」。司命人颔首：「记下了。」`;
  } else if (option.kind === "simingLife") {
    reduceRunLifespan(EVENT_BALANCE.siming.lifeLifespanCost);
    const key = getRandomRewardCardKey({ rare: true, channel: "reward" });
    addRunDeckCard(key);
    resultText = `你焚去 ${EVENT_BALANCE.siming.lifeLifespanCost} 点寿元，青袍人递来一枚蛊卵——「${CARD_LIBRARY[key].name}」入囊。`;
  } else {
    resultText = "「代价不急，来日方长。」青袍人隐入灯影，前路重新亮起。";
  }
  runState.eventHistory.push(`${SIMING.name}：${option.label}`);
  runState.lastEventNotice = `${SIMING.name}·${option.label}`;
  if (contractForcedMeeting) {
    addJourneyLog(`空囊契生效：司命人受契现身，与你相逢并完成「${option.label}」。`, "important");
  } else {
    addJourneyLog(`命途札记：与${SIMING.name}相逢，${option.label}。`, "system-log");
  }
  dom.eventResult.textContent = resultText;
  dom.eventResult.classList.remove("hidden");
  dom.resultDescription.textContent = resultText;
  dom.resultPrimaryButton.textContent = "继续前行";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
}

function openChanceEvent() {
  dom.eventConfirm?.classList.add("hidden"); // V0.9.32 新事件重置两段式确认条
  if (runState) runState.pendingEventChoice = null;
  if (maybeMeetSiming()) return;
  const event = sampleWithRunRandom(getChanceEventPool(), 1, "event")[0];
  if (!event) return;
  runState.activeEventId = event.id;
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result";
  hideRewardPanels();
  const __l2Event = isLayer3Run() ? getLayer3ThemeText("event") : (isLayer2Run() ? getLayer2ThemeText("event") : null);
  dom.resultSeal.textContent = "缘";
  dom.resultEyebrow.textContent = __l2Event ? __l2Event.eyebrow : "命途分岔 · 机缘";
  dom.resultTitle.textContent = __l2Event ? __l2Event.title : "机缘入局";
  dom.resultDescription.textContent = __l2Event ? __l2Event.desc : "这不是战斗，但每一次伸手都要付出代价。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.eventName.textContent = event.name;
  dom.eventStory.textContent = event.story;
  dom.eventChoices.innerHTML = event.options.map((option, index) => `
    <button class="event-choice ${getEventChoiceTone(option)}" type="button" data-event-choice="${index}">
      <strong>${option.label}</strong><em>${getEventChoiceMeta(option)}</em><small>${option.detail}</small>
    </button>`).join("");
  dom.eventResult.classList.add("hidden");
  dom.eventResult.textContent = "";
  dom.eventPanel.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function resolveChanceChoice(index) {
  if (runState?.activeEventId === "siming") { resolveSimingChoice(index); return; }
  const event = findChanceEventById(runState?.activeEventId);
  const option = event?.options?.[Number(index)];
  if (!event || !option) return;
  dom.eventChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  if (event.heroId) {
    const stats = getRunStats();
    stats.heroEvents = (stats.heroEvents || 0) + 1;
    stats.lastHeroEvent = event.name;
  }
  let resultText = "";
  switch (option.kind) {
    case "rareCard": {
      const lost = reduceRunHpSafely(EVENT_BALANCE.chance.rareCardHpCost);
      const key = getRandomRewardCardKey({ rare: true, channel: "reward" });
      addRunDeckCard(key);
      resultText = `井底旧蜕划破掌心，你失去 ${lost} 点生命，获得「${CARD_LIBRARY[key].name}」。`;
      break;
    }
    case "material":
      gainMaterial(option.materialId, 1, event.name);
      resultText = `你收下「${MATERIALS[option.materialId].name}」。`;
      break;
    case "heal":
      resultText = `碑下气息回转，恢复 ${healRunHp(option.amount, event.name)} 点生命。`;
      break;
    case "attackInsight": {
      const attacks = runState.deckCards.filter((entry) => CARD_LIBRARY[entry.key]?.category === "attack");
      if (attacks.length) {
        const target = sampleWithRunRandom(attacks, 1, "event")[0];
        target.damageBonus = (target.damageBonus || 0) + 3;
        resultText = `残碑杀诀烙入「${CARD_LIBRARY[target.key].name}」，本局伤害 +3。`;
        addLog(`残碑悟道：${CARD_LIBRARY[target.key].name}本局伤害 +3。`, "positive-log");
      } else {
        resultText = "你没有可悟道的攻击蛊，碑光自行熄灭。";
      }
      break;
    }
    case "cardNextHurt": {
      const key = getRandomRewardCardKey({ channel: "reward" });
      addRunDeckCard(key);
      runState.nextBattleHpLoss += 4;
      resultText = `蛊卵孵出「${CARD_LIBRARY[key].name}」，下一场战斗开始会反噬 4 点生命。`;
      addLog(`蛊卵异动：获得${CARD_LIBRARY[key].name}，下一场战斗开始失去 4 点生命。`, "damage-log");
      break;
    }
    case "stones":
      gainGuStones(option.amount, event.name);
      resultText = `你获得 ${option.amount} 蛊石。`;
      break;
    case "lifespanMaterial":
      reduceRunLifespan(1);
      gainMaterial(option.materialId, 1, event.name);
      resultText = `残魂入袖，你失去 1 点寿元，获得「${MATERIALS[option.materialId].name}」。`;
      break;
    case "bloodMaterials": {
      const lost = reduceRunHpSafely(5);
      gainMaterial("bloodSand", 1, event.name);
      gainMaterial("rotLiquid", 1, event.name);
      resultText = `血灯吞火，你失去 ${lost} 点生命，获得血砂与腐液。`;
      break;
    }
    case "removeBasic": {
      const removed = removeRandomBasicCard();
      resultText = removed ? `旧蛊焚尽：「${CARD_LIBRARY[removed.key].name}」已从蛊囊移除。` : "没有可移除的基础蛊，或卡组已接近最低数量。";
      if (removed) addLog(`血灯夜祭：移除${CARD_LIBRARY[removed.key].name}。`, "positive-log");
      break;
    }
    case "bloodLimit":
      runState.bloodMaxBonus += 1;
      reduceRunMaxHp(3, event.name);
      resultText = "血灯余焰入体，血煞上限 +1，但最大生命 -3。";
      break;
    case "buyRandomCard": {
      if (!spendGuStones(option.cost || 10)) {
        resultText = "蛊石不足，商队收起货箱。";
        break;
      }
      const key = getRandomRewardCardKey({ channel: "reward" });
      addRunDeckCard(key);
      resultText = `你花费 ${option.cost || 10} 蛊石，购得「${CARD_LIBRARY[key].name}」。`;
      addLog(`断桥商队：购得${CARD_LIBRARY[key].name}。`, "positive-log");
      break;
    }
    case "stealMaterialEnemyBuff": {
      const id = sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0];
      gainMaterial(id, 1, event.name);
      runState.nextBattleEnemyAttackBonus += 2;
      resultText = `残箱中藏着「${MATERIALS[id].name}」，但商队怨蛊惊动了前路；下一场敌人攻击 +2。`;
      break;
    }
    case "hurtRelic": {
      const lost = reduceRunHpSafely(4);
      if (runState.eventRelicGained) {
        gainGuStones(8, event.name);
        resultText = `血签已认过旧主，你失去 ${lost} 点生命，只从签灰中取到 8 蛊石。`;
      } else {
        const relicId = queueRelicOffer(event.name, "reward");
        runState.eventRelicGained = Boolean(relicId);
        resultText = relicId
          ? `血签入掌，你失去 ${lost} 点生命，得遗物「${ORDINARY_RELICS[relicId].name}」之机——回命途图时可抉择收取。`
          : `你失去 ${lost} 点生命，但已无可得遗物。`;
      }
      break;
    }
    case "lifespanTwoMaterials": {
      reduceRunLifespan(1);
      const ids = [sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0], sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0]];
      ids.forEach((id) => gainMaterial(id, 1, event.name));
      resultText = `血签换材，你失去 1 点寿元，获得${ids.map((id) => MATERIALS[id].name).join("与")}。`;
      break;
    }
    case "removeAnyCard": {
      const removed = removeRandomDeckCard("event");
      resultText = removed ? `遗骸炉火吞去「${CARD_LIBRARY[removed.key].name}」。` : "卡组已接近最低数量，旧炉没有吞噬你的蛊。";
      if (removed) addLog(`蛊师遗骸：移除${CARD_LIBRARY[removed.key].name}。`, "positive-log");
      break;
    }
    case "randomUpgradeBacklash": {
      const candidates = getUpgradeableDeckEntries();
      if (!candidates.length) {
        resultText = "蛊匣里没有可炼化的蛊，小炉自行熄灭。";
        break;
      }
      const target = sampleWithRunRandom(candidates, 1, "refine")[0];
      const backlash = getRunRandom("refine") < EVENT_BALANCE.chance.smallFurnaceBacklashChance;
      const result = backlash ? applyBacklashFurnace(target) : applyStableFurnace(target, null, `遗骸小炉：${getDisplayCardName(target.key, getUpgradeLevel(target))}炉火转稳。`);
      resultText = backlash
        ? `小炉逆冲，${getCompactCardTitle(target)}遭遇反噬。`
        : `小炉余焰炼成「${getCompactCardTitle(target)}」。`;
      runState.lastEventNotice = `${event.name}：${result.title}`;
      break;
    }
    case "poisonCard": {
      const key = getRandomPoisonCardKey("reward");
      addRunDeckCard(key);
      resultText = `毒潭吐出「${CARD_LIBRARY[key].name}」，已纳入蛊囊。`;
      addLog(`毒潭照影：获得${CARD_LIBRARY[key].name}。`, "poison-log");
      break;
    }
    case "poisonBloodResidue":
      runState.nextBattleHpLoss += 3;
      gainMaterial("rotLiquid", 1, event.name);
      resultText = "毒血残留入体：下一场战斗开局失去 3 点生命，获得腐液。";
      break;
    case "heroFateThreadCard": {
      const lost = reduceRunHpSafely(4);
      gainMaterial("fateSilk", 1, event.name);
      const pool = (HERO_EXCLUSIVE_CARD_KEYS.fate || []).filter((key) => CARD_LIBRARY[key]);
      const key = pickWithRunRandom(pool, "reward") || "fateThread";
      addRunDeckCard(key);
      resultText = `旧命线割入掌心，你失去 ${lost} 点生命，获得命丝与「${CARD_LIBRARY[key].name}」。`;
      addLog(`断命旧线：获得命丝与${CARD_LIBRARY[key].name}。`, "positive-log");
      break;
    }
    case "heroBloodOathLimit": {
      const lost = reduceRunHpSafely(6);
      runState.bloodMaxBonus = (runState.bloodMaxBonus || 0) + 1;
      gainMaterial("bloodSand", 1, event.name);
      resultText = `旧契咬回血肉，你失去 ${lost} 点生命，血煞上限 +1，并获得血砂。`;
      addLog("血债小祠：血煞上限 +1，获得血砂。", "blood-log");
      break;
    }
    case "heroPoisonClaim": {
      const key = getRandomPoisonCardKey("reward");
      addRunDeckCard(key);
      gainMaterial("rotLiquid", 1, event.name);
      runState.nextBattleHpLoss += 2;
      resultText = `井底毒虫伏入袖中，「${CARD_LIBRARY[key].name}」认你为主；你获得腐液，下一场战斗开局失去 2 点生命。`;
      addLog(`袖底毒井：获得${CARD_LIBRARY[key].name}与腐液。`, "poison-log");
      break;
    }
    case "heroDragonEmberOath": {
      // V0.9.51 #28 烬鳞专属：以血续誓——下一场战斗开局龙鳞 +2（startFloorBattle 消费 nextBattleDragonScale）。
      const lost = reduceRunHpSafely(4);
      runState.nextBattleDragonScale = (runState.nextBattleDragonScale || 0) + 2;
      resultText = `焦鳞贴掌认主，你失去 ${lost} 点生命；旧誓续燃，下一场战斗开局龙鳞 +2。`;
      addLog("烬鳞旧誓：以血续誓，下一场开局龙鳞 +2。", "positive-log");
      break;
    }
    case "heroLongevityLampRefine": {
      reduceRunLifespan(1);
      const candidates = getUpgradeableDeckEntries();
      if (candidates.length) {
        const target = sampleWithRunRandom(candidates, 1, "refine")[0];
        const result = applyStableFurnace(target, null, `借寿残灯：${getDisplayCardName(target.key, getUpgradeLevel(target))}借火炼成。`);
        resultText = `寿灯借走一息寿数，炉火转稳：${result.title}。`;
      } else {
        gainMaterial("remnantSoul", 1, event.name);
        resultText = "寿灯无蛊可炼，只吐出一缕残魂；你失去 1 点寿元，获得残魂。";
      }
      break;
    }

    /* ===== V0.9.8 第三层主题机缘事件分支（加性，全 || 兜底） ===== */
    case "boneBellChime": {
      gainGuStones(14, event.name);
      runState.nextBattleEnemyAttackBonus += 3;
      resultText = "骨铃震出 14 蛊石，铃音却唤醒守陵死骨——下一场战斗敌人攻击 +3。";
      addLog(`断铃石龛：得 14 蛊石，下一场敌人攻击 +3。`, "damage-log");
      break;
    }
    case "boneFragmentDefense": {
      const __pool = ["ironSkin", "mysticCarapace", "shellRemnant", "moltedArmor", "fixedFate", "moltingShell"].filter((k) => CARD_LIBRARY[k]);
      const key = sampleWithRunRandom(__pool, 1, "reward")[0] || "ironSkin";
      addRunDeckCard(key);
      resultText = `铃下残片凝出「${CARD_LIBRARY[key].name}」，已纳入蛊囊。`;
      addLog(`断铃石龛：获得防御蛊${CARD_LIBRARY[key].name}。`, "positive-log");
      break;
    }
    case "boneScrollArmorOrHp": {
      if (getRunRandom("event") < 0.5) {
        const __pool = ["ironSkin", "mysticCarapace", "shellRemnant", "moltedArmor", "fixedFate", "moltingShell"].filter((k) => CARD_LIBRARY[k]);
        const key = sampleWithRunRandom(__pool, 1, "reward")[0] || "ironSkin";
        addRunDeckCard(key);
        resultText = `护身诀化作「${CARD_LIBRARY[key].name}」，烙入蛊囊。`;
        addLog(`骨阶残卷：获得防御蛊${CARD_LIBRARY[key].name}。`, "positive-log");
      } else {
        const __add = 5;
        runState.maxHp = (runState.maxHp || 0) + __add;
        runState.currentHp = Math.min(runState.maxHp, (runState.currentHp || 0) + __add);
        if (game?.player) { game.player.maxHp = runState.maxHp; }
        if (dom.resultHp) dom.resultHp.textContent = runState.currentHp;
        resultText = `护身蛊诀淬骨入体，最大生命 +${__add}。`;
        addLog(`骨阶残卷：最大生命 +${__add}。`, "positive-log");
      }
      break;
    }
    case "boneScrollImprint": {
      const lost = reduceRunHpSafely(3);
      const healed = healRunHp(8, event.name);
      resultText = `你失去 ${lost} 点生命拓下蛊纹，悟道反哺恢复 ${healed} 点生命。`;
      break;
    }
    case "waxStonesPoison": {
      gainGuStones(13, event.name);
      runState.nextBattleHpLoss += 3;
      resultText = "取蜡得 13 蛊石，毒蛹却被惊起——下一场战斗开局毒刺反噬，失去 3 点生命。";
      addLog(`蜂蜡虫巢：得 13 蛊石，下一场开局失去 3 点生命。`, "damage-log");
      break;
    }
    case "waxSmokeHeal":
      resultText = `蜡烟熏散蜂群，暖息回养，恢复 ${healRunHp(10, event.name)} 点生命。`;
      break;
    case "honeyPoisonCard": {
      const key = getRandomPoisonCardKey("reward");
      addRunDeckCard(key);
      resultText = `噬蜜残蛊化作「${CARD_LIBRARY[key].name}」，已纳入蛊囊。`;
      addLog(`噬蜜残蛊：获得${CARD_LIBRARY[key].name}。`, "poison-log");
      break;
    }
    case "honeyBurnRemoveOrStones": {
      const removed = removeRandomDeckCard("event");
      if (removed) {
        resultText = `蜂火逼蛊，焚去「${CARD_LIBRARY[removed.key].name}」。`;
        addLog(`噬蜜残蛊：移除${CARD_LIBRARY[removed.key].name}。`, "positive-log");
      } else {
        gainGuStones(9, event.name);
        resultText = "蛊囊已近底，无可焚之蛊，只从蜡灰中拾得 9 蛊石。";
      }
      break;
    }
    default:
      resultText = "你没有触碰机缘，安全离开。";
      addLog(`${event.name}：安全离开。`, "system-log");
  }
  runState.eventHistory.push(`${event.name}：${option.label}`);
  addLog(`${event.name}：${option.label}。${stripTags(resultText)}`, event.heroId ? "important" : (option.kind === "leave" ? "system-log" : "important"));
  runState.lastEventNotice = getEventMapNotice(event, option, resultText);
  addLogToChannel("journey", `命途札记：${runState.lastEventNotice}。`, "system-log");
  dom.eventResult.textContent = resultText;
  dom.eventResult.classList.remove("hidden");
  dom.resultDescription.textContent = resultText;
  dom.resultPrimaryButton.textContent = "继续前行";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
}

/* E-2c3 休整四操作数值单源：普通休整节点与塔心整备共用（AGENTS §5 数值集中）。改这里，两处同变。 */
const REST_OP_VALUES = Object.freeze({ heal: 12, healBloodBonus: 4, feedCost: 8, feedDao: 8, feedMaxHp: 2, materialStones: 5, deckMin: 6 });
function openRestNode() {
  const node = getCurrentRunNode();
  runState.lastRestChoice = "";
  runState.lastRestResult = "";
  dom.eventConfirm?.classList.add("hidden"); // V0.9.32 新休整重置两段式确认条
  if (runState) runState.pendingEventChoice = null;
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result rest-result";
  hideRewardPanels();
  const __l2Rest = isLayer3Run() ? getLayer3ThemeText("rest") : (isLayer2Run() ? getLayer2ThemeText("rest") : null);
  dom.resultSeal.textContent = "息";
  dom.resultEyebrow.textContent = __l2Rest ? __l2Rest.eyebrow : `第 ${node?.step ?? getRestRouteStep()} 段 · ${isRestRouteStep(node?.step) ? "临门分岔" : "塔隙休整"}`; // V0.9.11：段位判断走路线配置，段4/临门休整都可复用
  dom.resultTitle.textContent = node?.name || (__l2Rest ? __l2Rest.title : "休整节点");
  dom.resultDescription.textContent = "塔隙只容一息。选一件事，便继续前行。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.eventName.textContent = node?.name || (__l2Rest ? __l2Rest.title : "休整");
  dom.eventStory.textContent = __l2Rest ? __l2Rest.storyPrefix : "腐风暂止，蛊火低伏。此处不能久留，只能择一调理。";
  const canRemove = runState.deckCards.length > REST_OP_VALUES.deckMin;
  dom.eventChoices.innerHTML = `
    <button class="event-choice steady" type="button" data-rest-choice="heal">
      <strong>调息养命</strong><em>稳妥休整</em><small>恢复 ${REST_OP_VALUES.heal} 点生命，不超过最大生命。</small>
    </button>
    <button class="event-choice ${canRemove ? "steady" : "safe"}" type="button" data-rest-choice="remove" ${canRemove ? "" : "disabled"}>
      <strong>整理蛊囊</strong><em>${canRemove ? "删去一蛊" : `卡组至少保留 ${REST_OP_VALUES.deckMin} 张`}</em><small>移除 1 张卡牌，不能让蛊囊少于 ${REST_OP_VALUES.deckMin} 张。</small>
    </button>
    <button class="event-choice steady" type="button" data-rest-choice="material">
      <strong>添火入炉</strong><em>炉材入囊</em><small>获得 1 个随机炼蛊材料，并获得 ${REST_OP_VALUES.materialStones} 蛊石。</small>
    </button>
    <button class="event-choice ${runState.guStones >= REST_OP_VALUES.feedCost ? "steady" : "safe"}" type="button" data-rest-choice="feed" ${runState.guStones >= REST_OP_VALUES.feedCost ? "" : "disabled"}>
      <strong>饲养本命蛊</strong><em>${runState.guStones >= REST_OP_VALUES.feedCost ? "以石饲蛊" : `蛊石不足 ${REST_OP_VALUES.feedCost}`}</em><small>喂 ${REST_OP_VALUES.feedCost} 蛊石：${BENMING_GU[runState.heroId]?.name || "本命蛊"}道行 +${REST_OP_VALUES.feedDao}，本局最大生命 +${REST_OP_VALUES.feedMaxHp}。</small>
    </button>`;
  dom.eventResult.classList.add("hidden");
  dom.eventResult.textContent = "";
  dom.eventPanel.classList.remove("hidden");
  dom.shopRemovePanel?.classList.add("hidden");
  dom.removePickerOverlay?.classList.add("hidden"); // V0.9.25
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function setRestChoiceButtonsDisabled(disabled) {
  dom.eventChoices?.querySelectorAll("[data-rest-choice]").forEach((button) => {
    if (button.dataset.restChoice === "remove" && runState.deckCards.length <= REST_OP_VALUES.deckMin) {
      button.disabled = true;
    } else {
      button.disabled = disabled;
    }
  });
}

function completeRestChoice(label, resultText, logClass = "positive-log") {
  if (!runState || runState.lastRestChoice) return;
  runState.lastRestChoice = label;
  runState.lastRestResult = `${getCurrentRunNode()?.name || "休整节点"}：${resultText}`;
  runState.restHistory.push(`${label}：${resultText}`);
  setRestChoiceButtonsDisabled(true);
  dom.eventResult.textContent = resultText;
  dom.eventResult.classList.remove("hidden");
  dom.resultDescription.textContent = resultText;
  addLog(`休整节点：${label}。${resultText}`, logClass);
  addLogToChannel("journey", `命途札记：${runState.lastRestResult}。`, "system-log");
  dom.resultPrimaryButton.textContent = "继续前行";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
}

function resolveRestChoice(choice) {
  if (!runState || getCurrentRunNode()?.type !== "rest" || runState.lastRestChoice) return;
  playUiSfx();
  if (choice === "heal") {
    // V0.9.8.3：血道续航补强——休整对血道额外恢复（缓解自损循环），其他流派不变。数值走 REST_OP_VALUES 单源。
    const restBonus = runState.heroId === "blood" ? REST_OP_VALUES.healBloodBonus : 0;
    const healed = healRunHp(REST_OP_VALUES.heal + restBonus, getCurrentRunNode().name);
    completeRestChoice("调息养命", `恢复 ${healed} 点生命${restBonus ? `（血道调血 +${restBonus}）` : ""}。`);
    return;
  }
  if (choice === "feed") {
    // V0.9.20 本命蛊·饲蛊：蛊石 → 道行（跨局）+ 本局最大生命（当局小增益）
    if (!spendGuStones(REST_OP_VALUES.feedCost)) return;
    const gu = BENMING_GU[runState.heroId];
    addBenmingDaoxing(runState.heroId, REST_OP_VALUES.feedDao);
    runState.maxHp += REST_OP_VALUES.feedMaxHp;
    runState.currentHp = Math.min(runState.maxHp, runState.currentHp + REST_OP_VALUES.feedMaxHp);
    if (dom.resultHp) dom.resultHp.textContent = runState.currentHp;
    const info = getBenmingStageInfo(runState.heroId);
    completeRestChoice("饲养本命蛊", `${gu?.name || "本命蛊"}饱食一顿：道行 +${REST_OP_VALUES.feedDao}（现 ${info.dao}，${info.stageName}），本局最大生命 +${REST_OP_VALUES.feedMaxHp}。`);
    return;
  }
  if (choice === "material") {
    const id = sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0];
    gainMaterial(id, 1, getCurrentRunNode().name);
    gainGuStones(REST_OP_VALUES.materialStones, getCurrentRunNode().name);
    completeRestChoice("添火入炉", `获得${MATERIALS[id].name}与 ${REST_OP_VALUES.materialStones} 蛊石。`);
    return;
  }
  if (choice === "remove") {
    if (runState.deckCards.length <= REST_OP_VALUES.deckMin) return;
    setRestChoiceButtonsDisabled(true);
    openRestRemovePicker();
  }
}
// ===== V0.9.32 防误触批2：机缘/休整两段式——选中先高亮不生效，确认才执行(机缘含扣血不可逆)，可重选。=====
function selectEventChoice(kind, value, btn) {
  if (!runState) return;
  runState.pendingEventChoice = { kind, value };
  dom.eventChoices?.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
  btn?.classList.add("selected");
  const label = btn?.querySelector("strong")?.textContent || "此抉择";
  if (dom.eventConfirm) dom.eventConfirm.classList.remove("hidden");
  if (dom.eventConfirmText) dom.eventConfirmText.textContent = `确认「${label}」？`;
  try { playUiSfx(); } catch (e) { /* 忽略 */ }
}
function confirmEventChoice() {
  const pick = runState && runState.pendingEventChoice;
  if (!pick) return;
  runState.pendingEventChoice = null;
  dom.eventConfirm?.classList.add("hidden");
  if (pick.kind === "rest") resolveRestChoice(pick.value);
  else {
    resolveChanceChoice(pick.value);
    grantEcologyEventReward();
  }
}
function resetEventSelection() {
  if (runState) runState.pendingEventChoice = null;
  dom.eventConfirm?.classList.add("hidden");
  dom.eventChoices?.querySelectorAll(".selected").forEach((b) => b.classList.remove("selected"));
  try { playUiSfx(); } catch (e) { /* 忽略 */ }
}

function openRestRemovePicker() {
  try {
    if (!runState || getCurrentRunNode()?.type !== "rest") return;
    if (runState.deckCards.length <= 6) {
      dom.eventResult.textContent = "卡组不可少于 6 张。";
      dom.eventResult.classList.remove("hidden");
      setRestChoiceButtonsDisabled(false);
      return;
    }
    pendingShopRemoveCardId = "";
    runState.pendingShopRemoveCardId = "";
    // V0.9.25：不再借蛊坊面板当空壳——直接开独立删卡弹窗（休整界面留在弹窗下方原样待命）。
    if (dom.shopCancelRemoveButton) dom.shopCancelRemoveButton.textContent = "返回休整";
    dom.shopRemoveConfirm?.classList.add("hidden");
    dom.shopRemoveChoices.innerHTML = runState.deckCards
      .map((entry) => renderDeckEntryCard(entry, { button: true, action: "data-shop-remove-card" }))
      .join("");
    showRemovePickerOverlay({ eyebrow: "休整 · 整理蛊匣", title: `选一只蛊移出（当前 ${runState.deckCards.length} 张，至少保留 6 张）` });
  } catch (error) {
    console.error("休整整理蛊囊：打开删卡界面失败", error);
    dom.eventPanel?.classList.remove("hidden");
    dom.shopPanel?.classList.add("hidden");
    dom.eventResult.textContent = "蛊囊一时紊乱，请重试。";
    dom.eventResult.classList.remove("hidden");
    setRestChoiceButtonsDisabled(false);
  }
}

function removeRestCard(instanceId) {
  if (!runState || getCurrentRunNode()?.type !== "rest" || runState.lastRestChoice || runState.deckCards.length <= REST_OP_VALUES.deckMin) return;
  const removed = removeDeckEntryById(instanceId);
  if (!removed) return;
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  hideRemovePickerOverlay(); // V0.9.25 独立弹窗
  dom.eventPanel?.classList.remove("hidden");
  completeRestChoice("整理蛊囊", `移除「${CARD_LIBRARY[removed.key].name}」。`, "positive-log");
}

function getShopState() {
  const nodeId = getCurrentRunNode()?.id || "shop";
  if (!runState.shopPurchases[nodeId]) {
    runState.shopPurchases[nodeId] = {
      cards: [false, false, false, false],
      reroll: false,
      heal: false,
      remove: false,
      material: false,
      lifeBuy: false, // V0.9.9 子批5：蛊石→寿元（续寿），每坊一次
      lifeSell: false, // V0.9.9 子批5：寿元→蛊石（焚寿易石），每坊一次
      item: false, // V0.9.16 丹囊：每坊一件消耗品
      itemKey: pickBattleItemId(), // 进坊时按流派偏发选定（走 reward 种子通道）
    };
  }
  const state = runState.shopPurchases[nodeId];
  if (!Array.isArray(state.cards)) state.cards = [];
  while (state.cards.length < 4) state.cards.push(false);
  if (typeof state.reroll !== "boolean") state.reroll = false;
  return state;
}

const SHOP_CARD_SLOT_LABELS = Object.freeze(["通用", "通用", "进阶", "流派契合"]);
const SHOP_SEQUENCE_ENGINE_KEYS = Object.freeze([
  "essenceGathering", "meridianShift", "yuanReturn", "guFeeding",
  "returnBreath", "emberRemnant", "breathCicada", "longBreathGu",
]);
const SHOP_BLOOD_SURVIVAL_KEYS = Object.freeze([
  "bloodRobe", "bloodThirst", "returnLife", "bloodSacrifice", "bloodReversal", "redTideGu",
]);

function countShopSequenceEngines(deckCards = runState?.deckCards || []) {
  const engineKeys = new Set(SHOP_SEQUENCE_ENGINE_KEYS);
  return deckCards.filter((entry) => engineKeys.has(entry?.key)).length;
}

function takeWeightedShopCard(pool, used) {
  const available = pool.filter((key) => CARD_LIBRARY[key] && !used.has(key));
  return available.length ? pickWithRunRandom(available, "reward") : null;
}

function getShopSynergyPool(heroId, deckCards = runState?.deckCards || []) {
  const owned = new Set(deckCards.map((entry) => entry?.key));
  let pool = heroId === "blood"
    ? SHOP_BLOOD_SURVIVAL_KEYS.filter((key) => !owned.has(key))
    : (HERO_EXCLUSIVE_CARD_KEYS[heroId] || []).filter((key) => !owned.has(key));
  if (!pool.length) pool = heroId === "blood"
    ? SHOP_BLOOD_SURVIVAL_KEYS.slice()
    : (HERO_EXCLUSIVE_CARD_KEYS[heroId] || []).slice();
  if (countShopSequenceEngines(deckCards) >= 2) {
    pool = pool.filter((key) => key !== "swarmBite");
    pool.push("swarmBite", "swarmBite", "swarmBite");
  }
  if (heroId !== "blood") pool = pool.filter((key) => key !== "returnLife");
  return pool;
}

function generateShopCardStock(heroId, deckCards = runState?.deckCards || []) {
  const used = new Set();
  const result = [];
  const take = (pool) => {
    const key = takeWeightedShopCard(pool, used);
    if (key) { used.add(key); result.push(key); }
  };
  take(STANDARD_REWARD_CARD_KEYS);
  take(STANDARD_REWARD_CARD_KEYS);
  take(ADVANCED_CARD_KEYS);
  take(getShopSynergyPool(heroId, deckCards));
  const fallback = [...STANDARD_REWARD_CARD_KEYS, ...ADVANCED_CARD_KEYS, ...(HERO_EXCLUSIVE_CARD_KEYS[heroId] || [])];
  while (result.length < 4) {
    const key = takeWeightedShopCard(fallback, used);
    if (!key) break;
    used.add(key);
    result.push(key);
  }
  return result;
}

function openShopNode() {
  // V0.9.40 QS-1a 孤行契：蛊坊闭门——不生成商品（短路在 RNG 消耗之前）、不开交易面板，只留离开。
  if (typeof isContractShopClosed === "function" && isContractShopClosed(runState)) {
    const stats = getRunStats();
    stats.contractShopClosures = safeStatNumber(stats.contractShopClosures) + 1;
    runState.activeShopStock = null;
    dom.mapScreen?.classList.add("hidden");
    dom.resultOverlay.querySelector(".result-card").className = "result-card map-result";
    hideRewardPanels();
    dom.resultSeal.textContent = "闭";
    dom.resultEyebrow.textContent = "命途分岔 · 蛊坊";
    dom.resultTitle.textContent = "蛊坊闭门";
    dom.resultDescription.textContent = "孤行契在身，灯下无人应门。";
    dom.resultTurns.textContent = "—";
    dom.resultHp.textContent = runState.currentHp;
    dom.eventName.textContent = "孤行契 · 闭门谢客";
    dom.eventStory.textContent = "坊门上贴着司命人的封条：「此人孤行，市不与易。」买牌、疗伤、删牌与寿元互易今日皆不可得——你要的一切，得从凶煞尸骸上取。";
    dom.eventChoices.innerHTML = "";
    dom.eventResult.classList.add("hidden");
    dom.eventResult.textContent = "";
    dom.eventPanel.classList.remove("hidden");
    addJourneyLog("孤行契：蛊坊闭门，本段命途无市可入。", "system-log");
    dom.resultPrimaryButton.textContent = "转身离开";
    dom.resultPrimaryButton.dataset.action = "completeNode";
    dom.resultPrimaryButton.classList.remove("hidden");
    dom.resultSecondaryButton.classList.add("hidden");
    dom.resultOverlay.classList.remove("hidden");
    refreshModalLock();
    return;
  }
  runState.activeShopStock = generateShopCardStock(runState.heroId);
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result shop-result";
  hideRewardPanels();
  const __l2Shop = isLayer3Run() ? getLayer3ThemeText("shop") : (isLayer2Run() ? getLayer2ThemeText("shop") : null);
  dom.resultSeal.textContent = "坊";
  dom.resultEyebrow.textContent = __l2Shop ? __l2Shop.eyebrow : "命途分岔 · 蛊坊";
  dom.resultTitle.textContent = __l2Shop ? __l2Shop.title : "暗灯蛊坊";
  dom.resultDescription.textContent = __l2Shop ? __l2Shop.desc : "蛊坊只开一刻。买定离手，离开后本段命途即定。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.shopPanel.classList.remove("hidden");
  dom.shopCloseButton?.classList.remove("hidden"); // V0.9.9.2 蛊坊右上角常驻叉号，随时可离开（滚动卡住也能退）
  renderShop();
  dom.resultPrimaryButton.textContent = "离开蛊坊";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function getShopTradeLabel(purchased, price) {
  if (purchased) return "已交易";
  if (runState.guStones < price) return "蛊石不足";
  return `${price} 蛊石`;
}

function hasShopDiscountAvailable() {
  return hasOrdinaryRelic("shopContract") && !runState.shopDiscountUsed;
}

/* ===== V0.9.27 六表中枢化·SHOP：蛊坊基价单一真源 =====
 * 此前每个基价在渲染(renderShop)与扣费(各 buy 函数、removeShopCard)两处各写死一次，删牌公式甚至三处——
 * 改价必须多改否则"显示价≠实扣价"。现全部收进此表，render/charge/门控都读同一处。
 * 折扣(蛊坊残契)与涨价(十重天贵市)仍走 getShopPrice 统一变换，此表只管基价。 */
const SHOP_PRICES = Object.freeze({
  card: 12,        // 购牌
  reroll: 6,       // 每坊一次，只重置四个蛊牌卡位，不吃残契折扣
  heal: 9,         // 疗伤（回 14 血）
  material: 11,    // 购材
  item: 9,         // 丹囊（原 SHOP_ITEM_PRICE）
  removeBase: 18,  // 删牌基价（层 1）
  removeLayerStep: 6, // 每深一层删牌 +6 → 18/24/30
});
function currentShopLayer() { return getCurrentActLayer(); }
function shopRemoveBasePrice() { return SHOP_PRICES.removeBase + (currentShopLayer() - 1) * SHOP_PRICES.removeLayerStep; }

function getShopPrice(basePrice) {
  let price = basePrice;
  // V0.9.19 十重天·四重贵市：蛊坊全线 +25%（向上取整）；蛊坊残契七折在涨价后再算。
  if (runState?.mode === "tian" && (runState.tianTier || 0) >= 4) price = Math.ceil(price * 1.25);
  return hasShopDiscountAvailable() ? Math.floor(price * 0.7) : price;
}

function spendShopStones(basePrice) {
  const discounted = hasShopDiscountAvailable();
  const price = getShopPrice(basePrice);
  if (!spendGuStones(price)) return false;
  if (discounted) {
    runState.shopDiscountUsed = true;
    addLog(`蛊坊残契生效：本次交易价格降为 ${price} 蛊石。`, "positive-log");
  }
  return true;
}

function renderShopOverview() {
  if (!dom.shopOverview) return;
  dom.shopOverview.innerHTML = `
    <span><em>蛊石</em><strong>${runState.guStones}</strong></span>
    <span><em>生命</em><strong>${runState.currentHp}/${runState.maxHp}</strong></span>
    <span><em>寿元</em><strong>${runState.lifespan}/${runState.maxLifespan ?? runState.lifespan}</strong></span>
    <span><em>蛊牌</em><strong>${runState.deckCards.length} 张</strong></span>`;
}

// V0.9.32 蛊坊防误触：寿元买卖(不可逆/耗精贵资源)走「二次点击确认」——首点武装、再点才成交，3秒自动解除。廉价蛊石买卖保持一点即买。
let shopArmedKey = null;
let shopArmTimer = null;
function disarmShop() {
  window.clearTimeout(shopArmTimer);
  shopArmTimer = null;
  dom.shopPanel?.querySelectorAll(".shop-armed").forEach((b) => b.classList.remove("shop-armed"));
  shopArmedKey = null;
}
// 返回 true=本次仅武装(等确认)；false=已是二次点击(应执行成交)
function shopArmConfirm(key, btn) {
  if (shopArmedKey === key) { disarmShop(); return false; }
  disarmShop();
  shopArmedKey = key;
  btn?.classList.add("shop-armed");
  shopArmTimer = window.setTimeout(disarmShop, 3000);
  try { playUiSfx(); } catch (e) { /* 忽略 */ }
  return true;
}
function renderShop() {
  disarmShop(); // 每次重渲染(开坊/成交后)清武装态，防跨坊残留 key 致下次首点即成交
  const state = getShopState();
  updateGuStoneDisplays();
  renderShopOverview();
  const cardPrice = getShopPrice(SHOP_PRICES.card);
  const healPrice = getShopPrice(SHOP_PRICES.heal);
  const removePrice = getShopPrice(shopRemoveBasePrice()); // V0.9.8.5 删牌价随层 18/24/30；V0.9.27 走 SHOP_PRICES
  const materialPrice = getShopPrice(SHOP_PRICES.material);
  pendingShopRemoveCardId = "";
  if (runState) runState.pendingShopRemoveCardId = "";
  dom.shopRemoveConfirm?.classList.add("hidden");
  const cardItems = runState.activeShopStock.map((key, index) => {
    const item = CARD_LIBRARY[key];
    const disabled = state.cards[index] || runState.guStones < cardPrice;
    return `<button class="shop-card-item reward-card" type="button" data-shop-card-index="${index}" ${disabled ? "disabled" : ""}>
      <span class="shop-slot-kind">${SHOP_CARD_SLOT_LABELS[index] || "蛊牌"}</span>
      ${getRewardGlyphHtml(key, item.glyph)}<strong>${item.name}</strong>
      <small>${item.typeName} · ${item.cost} 真元</small>
      <p>${getCardEffect(key, 0)}</p>
      <em class="shop-buy-state">${getShopTradeLabel(state.cards[index], cardPrice)}</em>
    </button>`;
  }).join("");
  const rerollDisabled = state.reroll || runState.guStones < SHOP_PRICES.reroll;
  const rerollText = state.reroll ? "本坊已重置" : runState.guStones < SHOP_PRICES.reroll ? "蛊石不足" : `换一批 · ${SHOP_PRICES.reroll} 蛊石`;
  dom.shopCardChoices.innerHTML = `<div class="shop-card-heading"><h4 class="shop-group-title">购入蛊牌</h4><button type="button" class="shop-reroll-button" data-shop-reroll ${rerollDisabled ? "disabled" : ""}>${rerollText}</button></div>${cardItems}`;
  const canRemove = runState.deckCards.length > 6 && runState.guStones >= removePrice && !state.remove;
  const removeReason = state.remove ? "已交易" : runState.deckCards.length <= 6 ? "卡组至少保留 6 张" : runState.guStones < removePrice ? "蛊石不足" : `${removePrice} 蛊石`;
  dom.shopActions.innerHTML = `
    <h4 class="shop-group-title">疗伤</h4>
    <button type="button" data-shop-action="heal" ${state.heal || runState.guStones < healPrice ? "disabled" : ""}><strong>调息疗伤</strong><small>恢复 14 生命</small><em>${getShopTradeLabel(state.heal, healPrice)}</em></button>
    <h4 class="shop-group-title">移除蛊牌</h4>
    <button type="button" data-shop-action="remove" ${canRemove ? "" : "disabled"}><strong>焚去一蛊</strong><small>删除 1 张卡</small><em>${removeReason}</em></button>
    <h4 class="shop-group-title">购入材料</h4>
    <button type="button" data-shop-action="material" ${state.material || runState.guStones < materialPrice ? "disabled" : ""}><strong>购入炉材</strong><small>随机获得 1 个材料</small><em>${getShopTradeLabel(state.material, materialPrice)}</em></button>
    ${renderShopItemTrade(state)}
    ${renderShopLifeExchange(state)}`;
}

// V0.9.9 子批5：蛊石↔寿元双向兑换——寿元作货币的核心。续寿固定 12 石→+10 寿(夹上限)；焚寿易石 焚 10 寿→+10 石。各坊一次，不走蛊坊残契折扣(避免占用一次性折扣到兑换上)。
const LIFE_BUY_STONE_COST = 12;
const LIFE_BUY_GAIN = 10;
const LIFE_SELL_LIFE_COST = 10;
const LIFE_SELL_STONE_GAIN = 10;
function renderShopLifeExchange(state) {
  const maxLife = runState.maxLifespan ?? runState.lifespan;
  const buyDisabled = state.lifeBuy || runState.guStones < LIFE_BUY_STONE_COST || runState.lifespan >= maxLife;
  const buyReason = state.lifeBuy ? "已交易" : runState.guStones < LIFE_BUY_STONE_COST ? "蛊石不足" : runState.lifespan >= maxLife ? "寿元已满" : `${LIFE_BUY_STONE_COST} 蛊石`;
  // 焚寿易石：需留至少 1 点寿元（焚后 lifespan ≥ 1），故要求当前 > LIFE_SELL_LIFE_COST。
  const sellDisabled = state.lifeSell || runState.lifespan <= LIFE_SELL_LIFE_COST;
  const sellReason = state.lifeSell ? "已交易" : runState.lifespan <= LIFE_SELL_LIFE_COST ? "寿元不足" : `焚 ${LIFE_SELL_LIFE_COST} 寿元`;
  return `<h4 class="shop-group-title">寿元兑换</h4>
    <button type="button" data-shop-action="buyLife" ${buyDisabled ? "disabled" : ""}><strong>续寿延年</strong><small>恢复 ${LIFE_BUY_GAIN} 寿元（不超上限）</small><em>${buyReason}</em></button>
    <button type="button" data-shop-action="sellLife" ${sellDisabled ? "disabled" : ""}><strong>焚寿易石</strong><small>焚寿换 ${LIFE_SELL_STONE_GAIN} 蛊石</small><em>${sellReason}</em></button>`;
}

function buyShopCard(index) {
  const state = getShopState();
  const key = runState.activeShopStock[Number(index)];
  if (!key || state.cards[index] || !spendShopStones(SHOP_PRICES.card)) return;
  state.cards[index] = true;
  addRunDeckCard(key);
  addLog(`蛊坊购牌：${CARD_LIBRARY[key].name}加入蛊囊。`, "positive-log");
  renderShop();
}

function rerollShopCards() {
  const state = getShopState();
  if (state.reroll || !spendGuStones(SHOP_PRICES.reroll)) return false;
  state.reroll = true;
  state.cards = [false, false, false, false];
  runState.activeShopStock = generateShopCardStock(runState.heroId);
  addLog(`蛊坊换池：支付 ${SHOP_PRICES.reroll} 蛊石，四个蛊牌卡位已重置。`, "positive-log");
  renderShop();
  return true;
}

function buyShopHeal() {
  const state = getShopState();
  if (state.heal || !spendShopStones(SHOP_PRICES.heal)) return;
  state.heal = true;
  healRunHp(14, "蛊坊调息");
  renderShop();
}

function buyShopMaterial() {
  const state = getShopState();
  if (state.material || !spendShopStones(SHOP_PRICES.material)) return;
  state.material = true;
  const id = sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0];
  gainMaterial(id, 1, "蛊坊购材");
  renderShop();
}

/* V0.9.16 丹囊：蛊坊丹囊格——每坊一件（进坊时按流派偏发选定），满囊时禁购。 */
const SHOP_ITEM_PRICE = SHOP_PRICES.item; // V0.9.27：并入 SHOP_PRICES，保留常量名兼容既有引用
function renderShopItemTrade(state) {
  const item = BATTLE_ITEMS[state.itemKey];
  if (!item) return "";
  const satchelFull = (runState.satchel || []).length >= getSatchelCap();
  const disabled = state.item || satchelFull || runState.guStones < getShopPrice(SHOP_ITEM_PRICE);
  const reason = state.item ? "已售出" : satchelFull ? "丹囊已满" : getShopTradeLabel(state.item, getShopPrice(SHOP_ITEM_PRICE));
  return `<h4 class="shop-group-title">丹囊</h4>
    <button type="button" data-shop-action="item" ${disabled ? "disabled" : ""}><strong>购入${item.name}</strong><small>${item.description}</small><em>${reason}</em></button>`;
}
function buyShopItem() {
  const state = getShopState();
  const item = BATTLE_ITEMS[state.itemKey];
  if (!item || state.item || (runState.satchel || []).length >= getSatchelCap()) return;
  if (!spendShopStones(SHOP_ITEM_PRICE)) return;
  state.item = true;
  grantBattleItem(state.itemKey, "蛊坊丹囊");
  renderShop();
}

// V0.9.9 子批5：续寿——蛊石换寿元（夹上限）。固定价、不走折扣、每坊一次。
function buyShopLifespan() {
  const state = getShopState();
  const maxLife = runState.maxLifespan ?? runState.lifespan;
  if (state.lifeBuy || runState.guStones < LIFE_BUY_STONE_COST || runState.lifespan >= maxLife) return;
  if (!spendGuStones(LIFE_BUY_STONE_COST)) return;
  state.lifeBuy = true;
  const before = runState.lifespan;
  runState.lifespan = Math.min(maxLife, runState.lifespan + LIFE_BUY_GAIN);
  const gained = runState.lifespan - before;
  addLog(`蛊坊续寿：耗 ${LIFE_BUY_STONE_COST} 蛊石，续回 ${gained} 点寿元。`, "positive-log");
  updateGuStoneDisplays();
  renderShop();
}

// V0.9.9 子批5：焚寿易石——焚寿元换蛊石（战外焚寿，不触发寿尽；保留至少 1 点）。每坊一次。
function sellShopLifespan() {
  const state = getShopState();
  if (state.lifeSell || runState.lifespan <= LIFE_SELL_LIFE_COST) return;
  state.lifeSell = true;
  const before = runState.lifespan;
  runState.lifespan = Math.max(1, runState.lifespan - LIFE_SELL_LIFE_COST);
  recordMupanCostDelta(getRunStats(), "lifespanSpent", before, runState.lifespan, "active");
  gainGuStones(LIFE_SELL_STONE_GAIN, "焚寿易石", { raw: true });
  addLog(`蛊坊焚寿易石：焚去 ${LIFE_SELL_LIFE_COST} 点寿元，换得 ${LIFE_SELL_STONE_GAIN} 蛊石。`, "system-log");
  renderShop();
}

/* V0.9.25 P0-2：删卡选择器升格独立全屏弹窗（此前内嵌在蛊坊模块串末尾，视口外+确认条溢出）。 */
function showRemovePickerOverlay({ eyebrow, title, panel = "remove" } = {}) {
  if (dom.removePickerEyebrow && eyebrow) dom.removePickerEyebrow.textContent = eyebrow;
  if (dom.removePickerTitle && title) dom.removePickerTitle.textContent = title;
  dom.shopRemovePanel?.classList.toggle("hidden", panel !== "remove");
  dom.removePickerOverlay?.classList.remove("hidden");
  const card = dom.removePickerOverlay?.querySelector(".remove-picker-card");
  if (card) card.scrollTop = 0;
  refreshModalLock();
}
function hideRemovePickerOverlay() {
  dom.shopRemovePanel?.classList.add("hidden");
  dom.removePickerOverlay?.classList.add("hidden");
  refreshModalLock();
}

function restoreMupanSealedCardsToBattle() {
  if (!isMupanBattle() || !game.mupan.sealedCards?.length) return;
  const restored = restoreMupanSealedCards({
    hand: game.hand,
    discardPile: game.discardPile,
    sealedCards: game.mupan.sealedCards,
  });
  game.hand = restored.hand;
  game.discardPile = restored.discardPile;
  game.mupan.sealedCards = restored.sealedCards;
  game.mupan.pendingSealId = "";
}

const MUPAN_TEST_RUN_FIELD_KEYS = Object.freeze([
  "rewardResolved",
  "materialRewardResolved",
  "refinementResolved",
  "furnaceResolved",
  "currentHp",
  "nextBattleHpLoss",
  "siSuiLunYuanPrimed",
  "nextBattleEnemyAttackBonus",
]);

function captureMupanTestRunFields() {
  if (!runState) return {};
  return Object.fromEntries(MUPAN_TEST_RUN_FIELD_KEYS.map((key) => [key, runState[key]]));
}

function restoreMupanTestRunFields() {
  if (!runState || !isMupanBattle() || !game.mupan.runFieldsBefore) return;
  for (const key of MUPAN_TEST_RUN_FIELD_KEYS) runState[key] = game.mupan.runFieldsBefore[key];
}

function openShopRemovePicker() {
  const state = getShopState();
  const price = getShopPrice(shopRemoveBasePrice()); // V0.9.27 走 SHOP_PRICES
  if (state.remove || runState.deckCards.length <= 6 || runState.guStones < price) return;
  if (dom.shopCancelRemoveButton) dom.shopCancelRemoveButton.textContent = "返回蛊坊";
  dom.shopRemoveConfirm?.classList.add("hidden");
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  dom.shopRemoveChoices.innerHTML = runState.deckCards
    .map((entry) => renderDeckEntryCard(entry, { button: true, action: "data-shop-remove-card" }))
    .join("");
  showRemovePickerOverlay({ eyebrow: "蛊坊 · 焚牌删卡", title: `选一只蛊焚去（${price} 蛊石）` });
}

function cancelShopRemovePicker() {
  if (towerPrepareRemoveActive) { // E-2c3 塔心整备：取消回整备场景，四操作仍可选
    towerPrepareRemoveActive = false;
    pendingShopRemoveCardId = "";
    if (runState) runState.pendingShopRemoveCardId = "";
    dom.shopRemoveConfirm?.classList.add("hidden");
    hideRemovePickerOverlay();
    showTowerHeartScene();
    return;
  }
  pendingShopRemoveCardId = "";
  if (runState) runState.pendingShopRemoveCardId = "";
  dom.shopRemoveConfirm?.classList.add("hidden");
  hideRemovePickerOverlay(); // V0.9.25 独立弹窗
  if (getCurrentRunNode()?.type === "rest" && !runState.lastRestChoice) {
    dom.shopPanel?.classList.add("hidden");
    dom.eventPanel?.classList.remove("hidden");
    dom.eventResult.classList.add("hidden");
    dom.resultDescription.textContent = "塔隙只容一息。选一件事，便继续前行。";
    setRestChoiceButtonsDisabled(false);
  }
}

function previewShopRemoveCard(instanceId) {
  const entry = runState?.deckCards.find((card) => card.instanceId === instanceId);
  if (!entry || !dom.shopRemoveConfirm) return;
  pendingShopRemoveCardId = instanceId;
  runState.pendingShopRemoveCardId = instanceId;
  const level = getUpgradeLevel(entry);
  const status = [
    level > 0 ? `炼化至${getRefineTurnName(level)}` : "一转（未炼化）",
    ...getEntryStatusLabels(entry),
  ].join(" · ");
  const suffix = towerPrepareRemoveActive ? "整备后此蛊将离开蛊囊。" : (getCurrentRunNode()?.type === "rest" ? "休整后此蛊将离开蛊囊。" : "移除后不会返还蛊石。");
  dom.shopRemoveConfirmText.textContent = `${getDisplayCardName(entry.key, level)}（${status || "稳定"}）。${suffix}`;
  dom.shopRemoveConfirm.classList.remove("hidden");
}

function confirmShopRemoveCard() {
  if (!pendingShopRemoveCardId) return;
  if (towerPrepareRemoveActive) { removeTowerPrepareCard(pendingShopRemoveCardId); return; } // E-2c3 塔心整备上下文
  if (getCurrentRunNode()?.type === "rest") {
    removeRestCard(pendingShopRemoveCardId);
    return;
  }
  removeShopCard(pendingShopRemoveCardId);
}

function removeShopCard(instanceId) {
  const state = getShopState();
  if (state.remove || runState.deckCards.length <= 6 || !spendShopStones(shopRemoveBasePrice())) return; // V0.9.27 删牌价随层 18/24/30，走 SHOP_PRICES 单一真源
  const removed = removeDeckEntryById(instanceId);
  if (!removed) return;
  state.remove = true;
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  addLog(`蛊坊：移除${CARD_LIBRARY[removed.key].name}。`, "positive-log");
  hideRemovePickerOverlay(); // V0.9.25 独立弹窗
  renderShop();
}

function getBattleSceneKey({ mupan = false } = {}) {
  if (mupan) return "tower-heart";
  if (isLayer3Run()) return getCurrentRouteId() === "beehive" ? "beehive" : "bone";
  if (isLayer2Run()) return getCurrentRouteId() === "bloodmarsh" ? "bloodmarsh" : "miasma";
  return "tower";
}

function updateBattleBackgroundScene(options = {}) {
  if (!dom.battleBackgroundSlot) return;
  dom.battleBackgroundSlot.dataset.battleScene = getBattleSceneKey(options);
}

function startFloorBattle() {
  if (!runState) return;
  setHandCollapsed(false);
  const currentNode = getCurrentRunNode();
  const mupanTestConfig = pendingMupanTestConfig ? { ...pendingMupanTestConfig } : null;
  const isMupanTest = Boolean(mupanTestConfig);
  const isTowerMupan = pendingTowerMupanBattle; // E-2c4 正式塔心终局战（无任何强制参数）
  const isBossNode = isMupanTest || isTowerMupan || isCurrentBossRoute();
  const isDefyNode = currentNode?.type === "defy"; // V0.9.8.6 逆命节点：当作高强度战，借 Boss 级 BGM/时长烘托
  // V0.9.8.5：第二/三层按路线放专属 BGM（整层含 Boss 用同一关卡曲）；第一层仍用通用 battle/boss。
  let musicScene;
  let musicDuration = (isBossNode || isDefyNode) ? 600 : 520;
  // 章节进度直接给出当前区域，三层优先级不再依赖旧 active 影子。
  if (isTowerMupan) {
    musicScene = "mupanBoss"; // E-2c5b 终局战专属曲
  } else if (isLayer3Run()) {
    musicScene = getCurrentRouteId() === "beehive" ? "layer3Beehive" : "layer3Bone";
  } else if (isLayer2Run()) {
    musicScene = getCurrentRouteId() === "bloodmarsh" ? "layer2Bloodmarsh" : "layer2Miasma";
  } else {
    musicScene = (isBossNode || isDefyNode) ? "boss" : "battle";
  }
  window.AudioManager?.playScene(musicScene, { duration: musicDuration });
  document.body.classList.add("hand-dealing");
  window.setTimeout(() => document.body.classList.remove("hand-dealing"), 900);
  clearCombatEffects();
  game = createBattleState();
  setCombatHandActive(true);
  window.NMGVoiceDirector?.resetBattle?.();
  setIntentCollapsed(false);
  updateBattleBackgroundScene({ mupan: isMupanTest || isTowerMupan });
  if (isMupanTest) initializeMupanTestBattle(game, mupanTestConfig);
  if (isTowerMupan) initializeTowerMupanBattle(game); // E-2c4：主副签取自命债照见锁定结果
  pendingMupanTestConfig = null;
  pendingTowerMupanBattle = false;
  recordBattleStarted();
  if (typeof applyBattleStartRelics === "function") applyBattleStartRelics(); // V0.9.57 空瓢/鳞屑囊的开场一次性效果
  if (isBossNode) triggerHeroVoice("boss");
  else if (currentNode?.type === "elite" || isDefyNode) triggerHeroVoice("elite");
  else if (currentNode?.type === "battle") triggerHeroVoice("battle");
  runState.rewardResolved = false;
  runState.materialRewardResolved = isBossNode;
  runState.refinementResolved = true;
  runState.furnaceResolved = currentNode?.type !== "elite" && currentNode?.type !== "defy"; // V0.9.8.6 逆命也开炉
  switchLogChannel("battle");
  resetBattleLog();
  // V0.9.18 塔中回声：Boss 战前对峙文本（按敌人 id）——进战斗日志，并作为开场压迫感横幅（见下方 setBattleMessage，覆盖通用 intro）。
  const bossTaunt = isTowerMupan
    ? "万命母盘不语。六页命债当空摊开——它要把你一路的活法，写成你的死法。"
    : (isMupanTest
      ? "它不预知未来，只把你已经付出的代价刻成命签。"
      : (isBossNode ? (BOSS_TAUNTS[game.enemy?.id] || "") : ""));
  if (bossTaunt) addLog(bossTaunt, "boss-log");
  // V0.9.13 关键词直查：一次性提示可点按查术语（此前该能力只在更新公告里提过一句，玩家无从发现）
  if (!getStoredFlag("nmg.kwHintShown")) {
    setStoredFlag("nmg.kwHintShown", true);
    addLog("提示：点开卡牌详情、或点按状态图标与带虚线的词语，随时可查看术语说明。", "important");
  }
  dom.startScreen.classList.add("hidden");
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  document.body.classList.remove("modal-open");
  dom.resultOverlay.querySelector(".result-card").className = "result-card";
  hideRewardPanels();
  dom.furnaceMaterialChoices?.classList.add("hidden");
  dom.furnaceMaterialList?.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  document.body.classList.remove("title-open");
  // 首页可直接进入新手训练，DEV 也可直跳母盘战；两条路径都绕过地图页的视口刷新。
  // 此时 game 已创建且标题/地图已收起，立即重算才能在首帧挂上 mobile-combat-safe /
  // compact-low-height，避免极矮横屏仍按 720px 桌面战斗排版、把手牌压到首屏外。
  updateMobileViewportState();

  if (runState.nextBattleHpLoss > 0) {
    const hpBefore = game.player.hp;
    const lost = Math.min(runState.nextBattleHpLoss, Math.max(0, game.player.hp - 1));
    game.player.hp -= lost;
    recordMupanCostDelta(getRunStats(), "selfHpLost", hpBefore, game.player.hp, "active");
    runState.currentHp = game.player.hp;
    addLog(`命途余毒：本场战斗开始失去 ${lost} 点生命。`, "damage-log");
    runState.nextBattleHpLoss = 0;
  }
  if (runState.siSuiLunYuanPrimed) {
    // V0.9.9 寿道·子批2c：饲岁轮反哺——上场焚寿换来本场首回合 +2 真元（仅首回合，beginNextTurn 之后回归 baseEnergy）。
    game.player.energy += 2;
    addLog("饲岁轮反哺：以焚去的岁月换取真元，本场首回合真元 +2。", "positive-log");
    runState.siSuiLunYuanPrimed = false;
  }
  if (game.enemyAttackBonus > 0) {
    addLog(`岔路恶果：本场战斗敌人攻击 +${game.enemyAttackBonus}。`, "damage-log");
    runState.nextBattleEnemyAttackBonus = 0;
  }
  if (game.enemy.towerPressure) {
    addLog("塔压：此战敌人生命略微提高。", "enemy-log");
  }
  if (game.combatRelic?.greenPouchCardName) {
    addLog(`青囊虫生效：本场「${game.combatRelic.greenPouchCardName}」消耗 -1。`, "positive-log");
    notifyRelicTrigger("greenPouchBug", `${game.combatRelic.greenPouchCardName} 消耗-1`, 700);
  }
  // V0.9.9.2 饲血符：每场战斗开始自带 5 层血煞
  if (game.player.heroId === "blood" && hasOrdinaryRelic("bloodPrimer")) {
    gainBlood(5);
    addLog("饲血符：战意先行，开局自带 5 层血煞。", "positive-log");
  }
  // V0.9.51 #27 胆铁印：每场开局 +3 护甲
  if (hasOrdinaryRelic("ironGallSeal")) {
    gainArmor(3, "胆铁印", "开局铸甲");
    notifyRelicTrigger("ironGallSeal", "开局护甲 +3");
  }
  // V0.9.51 #27 锻鳞炉：龙裔每场开局 +1 龙鳞
  if (hasOrdinaryRelic("scaleForge") && isDragonHero()) {
    gainDragonScale(1, "锻鳞炉");
    notifyRelicTrigger("scaleForge", "开局龙鳞 +1");
  }
  // V0.9.51 #28 烬鳞旧誓：机缘许下的下一场开局龙鳞（一次性消费；pending 前置短路供门禁沙箱免桩）
  if ((runState?.nextBattleDragonScale || 0) > 0 && typeof isDragonHero === "function" && isDragonHero()) {
    gainDragonScale(runState.nextBattleDragonScale, "烬鳞旧誓");
    runState.nextBattleDragonScale = 0;
  }
  // V0.9.20 本命蛊·开局被动（V0.9.33 归墟阶再加码）
  if (benmingPassive("blood", 1)) {
    const bloodOpen = isLegacyBenmingRun(runState) && benmingPassive("blood", 5) ? 4 : 2;
    gainBlood(bloodOpen);
    addLog(`赤茧蛊苏醒：开局血煞 +${bloodOpen}。`, "positive-log");
  }
  if (benmingPassive("fate", 1)) {
    // V0.9.51 先知契代价：开局命势不再 +1（含衔命虫加成），启动更慢。
    if (typeof isContractStartMomentumCut === "function" && isContractStartMomentumCut(runState)) {
      const __fCut = benmingPassive("fate", 4) ? 2 : 1;
      getRunStats().contractMomentumForfeited = safeStatNumber(getRunStats().contractMomentumForfeited) + __fCut;
      addLog("先知契：多看一步，少借一分势——开局命势让渡。", "system-log");
    } else {
      const fateOpen = benmingPassive("fate", 4) ? 2 : 1; // 神化：开局命势 1→2
      game.player.fateMomentum = Math.min(FATE_MOMENTUM_MAX, (game.player.fateMomentum || 0) + fateOpen);
      addLog(`衔命虫牵线：开局命势 +${fateOpen}。`, "positive-log");
    }
  }
  if (benmingPassive("dragon", 1)) {
    const openingScale = getDragonBenmingOpeningScale(getEffectiveBenmingStage("dragon"));
    gainDragonScale(openingScale, "烬脉龙蛊");
  }
  if (benmingPassive("bone", 1)) {
    gainBoneResonance(benmingPassive("bone", 4) ? 2 : 1, "叩寿骨铃苏醒");
  }
  // D-2c：旧真形/归墟的开局施毒仅旧规则局保留；新分支局由「逆鳞后毒 / 蜕鳞借毒」路线取代，不叠加。
  if (isLegacyBenmingRun(runState) && benmingPassive("poison", 3) && game.enemy) {
    const venomOpen = benmingPassive("poison", 5) ? 4 : 2; // 归墟：敌开局中毒 2→4
    applyEnemyPoison(venomOpen, "蜕鳞蛊", { corrosive: false });
    addLog(`蜕鳞蛊先行探路：敌人开场中毒 ${venomOpen} 层。`, "positive-log");
  }
  // V0.9.51 深毒契：每场战斗敌人开局自带毒（corrosive:false 避免误触蚀毒）。
  if (typeof getContractEnemyStartPoison === "function" && game.enemy) {
    const __dpOpen = getContractEnemyStartPoison(runState);
    if (__dpOpen > 0) {
      applyEnemyPoison(__dpOpen, "深毒契", { corrosive: false });
      addLog(`深毒契：毒在敌先，开场中毒 ${__dpOpen} 层。`, "positive-log");
      getRunStats().contractDeepPoisonBattles = safeStatNumber(getRunStats().contractDeepPoisonBattles) + 1;
    }
  }
  // 战前加持：下一场非教学、非母盘战一次消费全部待用层；新 battle state 会把攻击加成自然清零。
  const __rewardedAds = ensureRunRewardedAds(runState);
  const __bless = consumePreBattleBless({ rewardedAds: __rewardedAds, tutorial: game.tutorialDrill, mupan: isMupanBattle() });
  if (__bless.layers > 0) {
    runState.rewardedAds.blessPending = 0;
    game.player.armor += __bless.armor;
    recordArmorGained(__bless.armor);
    game.blessAttackBonus = __bless.attackBonus;
    addLog(`战前加持 ×${__bless.layers}：开局护甲 +${__bless.armor}，本场攻击 +${__bless.attackBonus}。`, "positive-log");
  }
  // V0.9.35 天品随行·蛊气加持：按随行天品维度施加加成（生命上限已于建局并入；开局血煞每场施加；攻击加成每击生效，此处一次性提示避免逐击刷屏）。
  const __cgb = runState && runState.carriedGuBonus;
  if (__cgb) {
    if (__cgb.attackFlat > 0) addLog(`道脉随行·蛊气加持：本局攻击伤害 +${__cgb.attackFlat}。`, "positive-log");
    if (__cgb.openBlood > 0) { gainBlood(__cgb.openBlood); addLog(`道脉随行·蛊气加持：开局血煞 +${__cgb.openBlood}。`, "positive-log"); }
  }

  drawToHandSize(game.handTarget);
  chooseEnemyIntent();
  resolveExistingFateAfterIntent();
  const enemyName = game.enemy.definition.name;
  const heroName = game.player.definition.name;
  addLog(isTowerMupan
    ? `${heroName}立于盘心之下——${enemyName}缓缓睁开，六页命债当空垂落。`
    : (isMupanTest
      ? `${heroName}进入独立母盘测试，章节位置与解锁内容保持不变。`
      : `${heroName}踏入命途图第 ${getCurrentRouteStep()} 段，${enemyName}自晦暗中现身。`), "system-log");
  if (isMupanTest) addJourneyLog("开发挑战：踏入塔心演武场，万命母盘开始照见本局命债；主线位置与解锁均不改变。", "boss-log");
  if (isTowerMupan) addJourneyLog("塔心终局：万命母盘启战——六债为签，命由己书。", "boss-log");
  addLog(`当前蛊匣共 ${runState.deckCards.length} 张牌；生命与寿元承接上一层。`, "system-log");
  addLog(`第 1 回合开始：真元恢复至 ${game.player.energy}，抽牌至 ${game.handTarget} 张。`, "important");
  applyHeroTurnStartPassive(true);
  logPassiveOpening();
  setBattleMessage(bossTaunt || game.enemy.definition.intro); // V0.9.18：Boss 战优先显示对峙台词
  // V0.9.19：Boss 对峙升格为全屏仪式弹窗（此前只有横幅一行字，玩家反馈没存在感）。
  if (bossTaunt) {
    showRiteOverlay({
      tone: "blood", eyebrow: "命途塔 · 对峙", seal: "劫",
      title: game.enemy.definition.name, text: bossTaunt, hint: "点击任意处 · 应战",
    });
  }
  render();
  showTurnBanner("第 1 回合", "真元回涌");
  maybeShowBattleCoach();
  if (currentNode?.type === "elite") {
    addLog("精英：血纹狼王现身。", "damage-log");
    showTurnBanner("精英现身", "血纹狼王现身");
  }
  if (isDefyNode) {
    addLog(`逆命搏杀：${enemyName}自绝域现身，气势远胜寻常。`, "damage-log");
    showTurnBanner("逆命搏杀", `${enemyName}现身`);
  }
  if (isBossNode || isDefyNode) playBossWakeEffect();
  if (isMupanBattle()) openMupanLedger(); // 测试与正式同看命债账目开场
}

function resetRunToTitle() {
  if (runState?.status === "running") finalizeRun("abandoned", { showConclusion: false });
  document.body.classList.remove("tower-heart-invitation");
  // 彻底移除上一局的界面残留，避免日志、手牌或动画带入新局。
  clearCombatEffects();
  window.clearTimeout(mapNoticeTimer);
  window.clearTimeout(mapTransitionTimer);
  window.clearTimeout(mapFocusTimer);
  mapNoticeTimer = null;
  mapTransitionTimer = null;
  mapFocusTimer = null;
  mapTransitionLock = false; // V0.9.12.1：清残留转场锁，防新局地图点击被锁死
  pendingEliteNodeId = "";
  pendingShopRemoveCardId = "";
  progression.selectedBenmingPath = null;
  runState = null;
  game = null;
  cardSerial = 0;
  resetAllLogs();
  dom.hand.innerHTML = "";
  dom.buffList.innerHTML = "";
  dom.enemyStatusList.innerHTML = "";
  dom.towerProgress.innerHTML = "";
  dom.mapScreen?.classList.add("hidden");
  hideRewardPanels();
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultPrimaryButton.dataset.action = "";
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  dom.deckOverlay?.classList.add("hidden");
  closeBattleCoach(false);
  hideKeywordTooltip();
  refreshModalLock();
  window.AudioManager?.playScene("menu", { duration: 560, quiet: true });
  showStartScreen();
}

function logPassiveOpening() {
  const relic = RELICS[runState.relicId];
  const hero = game.player.definition;
  addLog(`蛊修被动「${hero.passiveName}」：${hero.passive}`, "system-log");
  addLog(`本命遗物「${relic.name}」已生效：${relic.description}`, "system-log");
  if (BENMING_PATHS[runState.heroId] && (getRunBenmingPath(runState) || isLegacyBenmingRun(runState))) {
    addLog(`${BENMING_GU[runState.heroId]?.name || "本命蛊"}本局路线：${getBenmingPathDisplayName(runState)}。`, "system-log");
  }
  if (runState.ordinaryRelics.length) {
    const ordinaryText = runState.ordinaryRelics.map((id) => `${ORDINARY_RELICS[id].name}`).join("、");
    addLog(`随身遗物：${ordinaryText}。`, "system-log");
  }
  if (runState.relicId === "boneCarapace") {
    spawnFloatText(dom.playerPortrait, "+4 护甲", "defense-float");
    playArmorEffect();
  }
  // V0.9.51 蕴鳞瓮：龙裔开局 +2 龙鳞；其余蛊修用不上龙鳞，等价折为 4 点护甲（不做废选项）。
  if (runState.relicId === "ridgeScaleUrn") {
    if (isDragonHero()) {
      gainDragonScale(2, "蕴鳞瓮");
    } else {
      gainArmor(4, "蕴鳞瓮", "瓮中鳞息");
    }
  }
  if (runState.relicId === "listeningBoneCase") {
    spawnFloatText(dom.playerPortrait, "+5 护甲", "defense-float");
    playArmorEffect();
  }
  if (runState.startArmorBonus > 0) {
    addLog("炼蛊强化「玄甲蛊壳」生效：本场战斗开始获得 5 点防御。", "positive-log");
    spawnFloatText(dom.playerPortrait, "+5 护甲", "defense-float");
    playArmorEffect();
  }
}

function maybeAutoOpenTutorial() {
  if (!dom.tutorialOverlay || tutorialAutoPrompted || getStoredFlag(TUTORIAL_STORAGE_KEY)) return;
  tutorialAutoPrompted = true;
  window.setTimeout(() => {
    if (!dom.startScreen.classList.contains("hidden") && dom.tutorialOverlay.classList.contains("hidden")) {
      openTutorial();
    }
  }, 180);
}

function openTutorial(page = 0) {
  if (!dom.tutorialOverlay) return;
  tutorialPageIndex = Math.max(0, Math.min(TUTORIAL_PAGES.length - 1, page));
  renderTutorialPage();
  dom.tutorialOverlay.classList.remove("hidden");
  refreshModalLock();
  dom.tutorialNextButton?.focus();
}

function closeTutorial({ markSeen = true } = {}) {
  dom.tutorialOverlay?.classList.add("hidden");
  if (markSeen) setStoredFlag(TUTORIAL_STORAGE_KEY, true);
  refreshModalLock();
}

/* ===== V0.9.18 塔中回声：开场序章弹窗（黑石—命途塔—入塔）。首次进开始界面自动弹一次，设置里可重看。 ===== */
// 新玩家先看序章（世界观），再看新手教程（玩法）；序章由 closePrologue 关闭后自动接教程。
function maybeAutoOpenIntro() {
  if (maybeShowAgeGate()) return; // V0.9.36：年龄门槛未确认 → 先弹年龄门，确认后再续序章/教程
  if (maybeAutoOpenPrologue()) return;
  maybeAutoOpenTutorial();
}

// V0.9.36 年龄门槛：首次进入弹一次；已确认或无门（容错）则放行。确认后由 confirmAgeGate 续走序章/教程。
function maybeShowAgeGate() {
  if (ageGateAcknowledged || getStoredFlag(AGE_GATE_KEY)) return false; // 内存守卫在前：坏档下确认过即放行
  if (!dom.ageGateOverlay) return false;
  try { dom.ageGateOverlay.querySelectorAll("[data-age-num]").forEach((el) => { el.textContent = SUGGESTED_AGE; }); } catch (e) { /* 忽略 */ } // 年龄单一来源
  dom.ageGateOverlay.classList.remove("hidden");
  refreshModalLock();
  try { dom.ageGateConfirm && dom.ageGateConfirm.focus(); } catch (e) { /* 忽略 */ }
  return true;
}
function confirmAgeGate() {
  ageGateAcknowledged = true; // 先置内存守卫，确保即便 setStoredFlag 静默失败也不会重弹
  setStoredFlag(AGE_GATE_KEY, true);
  dom.ageGateOverlay && dom.ageGateOverlay.classList.add("hidden");
  refreshModalLock();
  maybeAutoOpenIntro(); // 确认后接序章/教程/更新公告
}

// V0.9.36 B-6c：序章弹窗辅助已抽至 nmg-story.js，须在本文件之前加载。

/* ===== V0.9.19 仪式弹窗：全屏压迫感演出（Boss 战前对峙 / 十重天登塔明示）。 =====
 * 点击任意处或超时自动散场；纯演出层，不入模态锁（战斗/地图已在下方就位，卡死零风险）。 */
let riteDismissTimer = null;
function showRiteOverlay({ tone = "blood", eyebrow = "", seal = "劫", title = "", text = "", hint = "点击任意处 · 继续", autoMs = 5200, art = "" } = {}) {
  if (!dom.riteOverlay) return;
  // V0.9.51 用户定调：炼蛊等仪式接入蛊虫立绘增沉浸感。传 art 则以立绘替印章，不传照旧。
  if (dom.riteArt) {
    if (art) { dom.riteArt.src = art; dom.riteArt.classList.remove("hidden"); }
    else { dom.riteArt.classList.add("hidden"); dom.riteArt.removeAttribute("src"); }
  }
  dom.riteSeal.classList.toggle("hidden", Boolean(art));
  dom.riteEyebrow.textContent = eyebrow;
  dom.riteSeal.textContent = seal;
  dom.riteWatermark.textContent = seal;
  dom.riteTitle.textContent = title;
  dom.riteText.textContent = text;
  if (dom.riteHint) dom.riteHint.textContent = hint;
  dom.riteOverlay.className = `rite-overlay rite-${tone}`; // 去掉 hidden 同时重置 tone；下一行强制回流以重放入场动画
  void dom.riteOverlay.offsetWidth;
  window.clearTimeout(riteDismissTimer);
  riteDismissTimer = window.setTimeout(hideRiteOverlay, autoMs);
}
function hideRiteOverlay() {
  window.clearTimeout(riteDismissTimer);
  riteDismissTimer = null;
  dom.riteOverlay?.classList.add("hidden");
}

// V0.9.36 B-6c：序章回翻与残卷弹窗展示辅助已抽至 nmg-story.js，须在本文件之前加载。

function renderTutorialPage() {
  const page = TUTORIAL_PAGES[tutorialPageIndex];
  if (!page) return;
  dom.tutorialTitle.textContent = page.title;
  const topicButtons = page.topics
    ? `<div class="tutorial-topic-grid">${Object.entries(GUIDE_TOPICS).map(([id, topic]) => `<button type="button" data-guide-topic="${id}">${topic.title}<small>点开查看</small></button>`).join("")}</div><div class="tutorial-topic-detail" data-guide-topic-detail><p>选择一个问题查看两句答案。</p></div>`
    : "";
  dom.tutorialBody.innerHTML = `<ul>${page.lines.map((line) => `<li>${line}</li>`).join("")}</ul>${topicButtons}`;
  dom.tutorialPageText.textContent = `${tutorialPageIndex + 1} / ${TUTORIAL_PAGES.length}`;
  dom.tutorialDots.innerHTML = TUTORIAL_PAGES.map((_, index) => `<b class="${index === tutorialPageIndex ? "current" : ""}"></b>`).join("");
  dom.tutorialPrevButton.disabled = tutorialPageIndex === 0;
  dom.tutorialNextButton.textContent = tutorialPageIndex === TUTORIAL_PAGES.length - 1 ? "完成" : "下一页";
}

function nextTutorialPage() {
  if (tutorialPageIndex >= TUTORIAL_PAGES.length - 1) {
    closeTutorial();
    return;
  }
  tutorialPageIndex += 1;
  renderTutorialPage();
}

function previousTutorialPage() {
  tutorialPageIndex = Math.max(0, tutorialPageIndex - 1);
  renderTutorialPage();
}

function resetNewPlayerGuidance() {
  setStoredFlag(TUTORIAL_STORAGE_KEY, false);
  setStoredFlag(BATTLE_TIPS_STORAGE_KEY, false);
  tutorialAutoPrompted = false;
  closeBattleCoach(false);
  openTutorial(0);
  if (dom.runProgress) {
    dom.runProgress.textContent = "新手提示已重置。";
    dom.runProgress.classList.remove("hidden");
  }
}

function maybeShowBattleCoach() {
  if (game?.tutorialDrill) return; // 演武有自己的分步指引面板
  if (!dom.battleCoach || getStoredFlag(BATTLE_TIPS_STORAGE_KEY)) return;
  dom.battleCoach.classList.remove("hidden");
}

function closeBattleCoach(markSeen = true) {
  if (markSeen) setStoredFlag(BATTLE_TIPS_STORAGE_KEY, true);
  dom.battleCoach?.classList.add("hidden");
}

/* FUNNEL-1：行为触发式入塔提示——每条一生仅一次，在玩家真正做出该行为的当口就地弹一句。
 * 不碰 RNG/不脚本化战斗（种子工程红线），只做反应式教学。 */
/* FUNNEL-1 存档保险：记录最近导出时间，供结算页决定是否提示本机灾备。 */
const SAVE_EXPORT_AT_KEY = "nmg.lastSaveExportAt";
function isSaveExportDue() {
  const t = Number(localStorage.getItem(SAVE_EXPORT_AT_KEY)) || 0;
  return !t || (Date.now() - t) > 7 * 86400000;
}
async function performSaveExport(button, idleLabel) {
  const code = buildSaveExport();
  let copied = false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); copied = true; } } catch (e) { copied = false; }
  const downloaded = downloadTextFile(`逆命蛊途-存档-${saveStamp()}.txt`, code);
  if (copied || downloaded) {
    try { localStorage.setItem(SAVE_EXPORT_AT_KEY, String(Date.now())); } catch (e) { /* 存储不可用不阻断 */ }
  }
  if (button) {
    button.textContent = copied || downloaded
      ? `备份完成（${copied ? "已复制" : ""}${copied && downloaded ? "+" : ""}${downloaded ? "已下载" : ""}）`
      : "备份失败，请重试";
    if (idleLabel) window.setTimeout(() => { if (button.isConnected) button.textContent = idleLabel; }, 3000);
  }
  return copied || downloaded;
}

/* ===== FUNNEL-1 教学演武：独立练手战——木人陪练、分步指引、不发奖励、不动真实存档。
 * 状态铁律照守：演武就是一个被标记的正常 run（runState.tutorialDrill），
 * 弃局走 finalizeRun("abandoned") 正规通道；真实续局档进演武前备份、出演武即还原。 ===== */
const DRILL_BACKUP_KEY = "nmg.run.autosave.drillBackup";
const FIRST_HATCH_GUIDE_KEY = "nmg.firstHatchGuide.v1";
const TUTORIAL_DRILL_ENEMY = Object.freeze({
  name: "练手木人", title: "新手训练", maxHp: 24,
  kicker: "演武场无风，木人无怨", intro: "一具练手木人立在场中——它不会真的想杀你。",
  caption: "新手训练 · 木人陪练",
  actions: {
    tap: { name: "木掌", icon: "掌", kind: "attack", damage: 3 },
    swing: { name: "横扫", icon: "扫", kind: "attack", damage: 4 },
    brace: { name: "蓄势", icon: "势", kind: "charge", bonus: 4, interruptThreshold: 6 },
  },
});
let pendingTutorialDrill = false;

function restoreDrillBackup() {
  try {
    const backup = localStorage.getItem(DRILL_BACKUP_KEY);
    if (backup) localStorage.setItem(RUN_AUTOSAVE_KEY, backup);
    else localStorage.removeItem(RUN_AUTOSAVE_KEY);
    localStorage.removeItem(DRILL_BACKUP_KEY);
  } catch (e) { /* 存储不可用不阻断 */ }
}

function startTutorialDrill() {
  if (game && game.status === "playing") return;
  if (runState?.status === "running" && !runState.tutorialDrill) {
    // 从首页进入时通常无进行中的局；若有（理论上仅设置页误触），先按主动放弃收掉，真实档由备份还原。
  }
  try {
    const cur = localStorage.getItem(RUN_AUTOSAVE_KEY);
    if (cur) localStorage.setItem(DRILL_BACKUP_KEY, cur);
    else localStorage.removeItem(DRILL_BACKUP_KEY);
  } catch (e) { /* 无档可备份则照常 */ }
  const prevHero = progression.selectedHeroId;
  const prevPath = progression.selectedBenmingPath;
  const prevContract = progression.selectedContract; // V0.9.40：演武强制无契（createRunState 另有 pendingTutorialDrill 双保险）
  // V0.9.51 用户定调「每个角色都设置教学」：演武改为跟随当前选中的蛊修（原写死无名逆命者），
  // 路线取该修第一条（已开路线阶才给），让玩家用自己要玩的角色练自己的核心机制。
  const drillHero = HEROES[prevHero] ? prevHero : "fate";
  progression.selectedHeroId = drillHero;
  const drillPaths = (typeof BENMING_PATHS !== "undefined" && BENMING_PATHS[drillHero]) ? Object.keys(BENMING_PATHS[drillHero]) : [];
  progression.selectedBenmingPath = (drillPaths.length && getEffectiveBenmingStage(drillHero) >= 3) ? drillPaths[0] : null;
  progression.selectedContract = null;
  pendingTutorialDrill = true;
  const started = startNewRun();
  progression.selectedHeroId = prevHero;
  progression.selectedBenmingPath = prevPath;
  progression.selectedContract = prevContract;
  if (!started || !runState) { pendingTutorialDrill = false; restoreDrillBackup(); return; }
  runState.tutorialDrill = true;
  startFloorBattle(); // 直接开打，跳过命途图
  pendingTutorialDrill = false;
}

function finishTutorialDrill(victory) {
  const won = Boolean(victory);
  // V0.9.51：须在 resetRunToTitle 清局之前取蛊修，结束语才能按修分流。
  const __drillHeroId = game?.player?.heroId || runState?.heroId || "fate";
  if (game) { game.status = won ? "victory" : "defeat"; game.inputLocked = true; }
  document.getElementById("drillCoachPanel")?.classList.add("hidden");
  resetRunToTitle(); // 演武局按主动放弃正规收掉：零奖励、零死亡计数
  restoreDrillBackup(); // 还原演武前的真实续局档
  if (won) {
    try {
      if (!localStorage.getItem(FIRST_HATCH_GUIDE_KEY)) localStorage.setItem(FIRST_HATCH_GUIDE_KEY, "ready");
    } catch (e) { /* 存储不可用不阻断出演武 */ }
  }
  renderTitleScreen();
  if (won) document.getElementById("guluOpenButton")?.classList.add("is-onboarding-next");
  showRiteOverlay({
    tone: won ? "gold" : "blood", eyebrow: "新手训练", seal: "习",
    title: won ? "演武礼成" : "演武暂歇",
    text: won
      ? `${getDrillLesson(__drillHeroId)}——入塔的门道你已握住。\n下一步：回首页进入蛊庐，第一枚基础·次品蛊卵免材料并立即破壳。`
      : `木人无怨，演武不作数。\n记住：${getDrillLesson(__drillHeroId)}。`,
    hint: "点击任意处 · 回首页",
  });
}

/* V0.9.51「每个角色都设置教学」：一句话总结该修的核心套路，演武收尾时给。 */
function getDrillLesson(heroId) {
  switch (heroId) {
    case "blood": return "以自损换血煞、以血煞放大攻击，见蓄力则打断";
    case "poison": return "先叠毒、让回合末替你结算，见蓄力则打断";
    case "longevity": return "以寿元换伤害、寿越低烧得越亮，见蓄力则打断";
    case "dragon": return "先伤敌再护体攒满龙鳞、化龙爆发，见蓄力则打断";
    default: return "交替出牌攒命势、圆满兑真元，见蓄力则打断";
  }
}

function updateTutorialDrillCoach() {
  if (!game?.tutorialDrill) {
    document.getElementById("drillCoachPanel")?.classList.add("hidden");
    return;
  }
  let panel = document.getElementById("drillCoachPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "drillCoachPanel";
    panel.className = "drill-coach-panel hidden";
    panel.addEventListener("click", (event) => {
      if (event.target?.id === "drillQuitButton") finishTutorialDrill(false);
    });
    document.body.appendChild(panel);
  }
  if (game.status !== "playing") { panel.classList.add("hidden"); return; }
  const action = game.enemy?.intent ? getCurrentEnemyAction() : null;
  let step;
  if (action?.kind === "charge" && action.interruptThreshold) {
    // 打断蓄力是全角色通用的第一课，任何蛊修都先教这个。
    step = `木人在蓄力——本回合对它打出 ${action.interruptThreshold} 点伤害就能打断；打不出就叠护甲硬接。`;
  } else if (!game.drillPlayedAny) {
    step = getDrillOpeningTip(game.player.heroId);
  } else {
    step = getDrillHeroTip(game.player.heroId);
  }
  panel.innerHTML = "<strong>新手训练</strong><p></p><button type=\"button\" id=\"drillQuitButton\">退出演武</button>";
  panel.querySelector("p").textContent = step;
  panel.classList.remove("hidden");
}

/* V0.9.51「每个角色都设置教学」：演武教练按蛊修讲各自的核心机制，
 * 不再一律用命道的命势话术（其余四修此前照着练也学不到自己的套路）。 */
function getDrillOpeningTip(heroId) {
  switch (heroId) {
    case "blood": return "点一张血道攻击蛊打出去——绛妄的牌多半要自损，血是她的弹药。";
    case "poison": return "先点一张施毒蛊——青蟒不求一击毙命，毒会在回合末替你结算。";
    case "longevity": return "点一张攻击蛊起手——朝暮的寿元既是命，也是随时能烧的燃料。";
    case "dragon": return "点一张攻击蛊打出去——烬鳞每回合首次伤敌与首次护体各攒 1 枚龙鳞。";
    default: return "点一张「攻击蛊」打出去（比如月刃蛊）。";
  }
}
function getDrillHeroTip(heroId) {
  const p = game.player;
  switch (heroId) {
    case "blood": {
      const b = p.blood || 0;
      return b < 3
        ? `打带自损的血道蛊攒血煞（现 ${b} 层）——血煞越厚，血道攻击越狠。`
        : `血煞已有 ${b} 层：现在打血道攻击，伤害会按血煞层数放大。`;
    }
    case "poison": {
      const ep = game.enemy?.poison || 0;
      return ep < 5
        ? `继续叠毒（木人现 ${ep} 层）——毒在每回合末结算，叠得越高滚得越快。`
        : `毒已 ${ep} 层：现在补攻击收割，或继续叠毒等它自己毒发。`;
    }
    case "longevity": {
      const burned = game.burnedLifespanThisBattle || 0;
      return burned > 0
        ? "焚过寿了——寿元越低，焚寿燃命的伤害加成越高；但别把命也烧没了。"
        : "试着打一张焚寿蛊：用寿元换伤害，这是朝暮的核心买卖。";
    }
    case "dragon": {
      const sc = game.dragon?.scale || 0;
      if (game.dragon?.transformed) return "龙形期间攻防都有加成、真元也多一点——趁这两回合把伤害打出去。";
      return `龙鳞 ${sc}/${DRAGON_BALANCE.scaleMax}：每回合先伤敌、再护体，各攒 1 枚；集满点「化龙」爆发。`;
    }
    default: {
      const m = p.fateMomentum || 0;
      if (m < 1) return "换一种类型再打一张（护甲或辅助）——类型交替，命势才会 +1。";
      if (m < FATE_MOMENTUM_MAX) return `继续交替出牌，把命势攒到 ${FATE_MOMENTUM_MAX}（现在 ${m}）；真元不够就结束回合。`;
      return "命势圆满会自动兑现：真元 +1、抽 1 张——乘胜追击，击败木人！";
    }
  }
}

const COACH_TIP_STORE_KEY = "nmg.coachTips.v1";
/* V0.9.57：任何在【覆盖层之上】显示的提示都须传 { forceToast: true }。
 * 原实现在 mobile-combat-safe 时一律降级成 addLog——那是【战斗日志】，
 * 而蛊庐/九转鼎/百蛊市（满屏覆盖层）与战后结算页都会把日志整个盖住，降级等于没提示。
 * TapTap 用户全是手机横屏，正好命中该分支。实测：结算页展开时日志区命中测试返回「被盖住」。 */
function showCoachTip(key, text, options) {
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(COACH_TIP_STORE_KEY) || "{}") || {}; } catch (e) { seen = {}; }
  if (seen[key]) return;
  seen[key] = 1;
  try { localStorage.setItem(COACH_TIP_STORE_KEY, JSON.stringify(seen)); } catch (e) { /* 存储不可用仍显示本次 */ }
  if (!options?.forceToast && document.body.classList.contains("mobile-combat-safe")) {
    addLog(`提示：${text}`, "important");
    return;
  }
  let toast = document.getElementById("coachTipToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "coachTipToast";
    toast.className = "coach-tip-toast hidden";
    toast.addEventListener("click", () => toast.classList.add("hidden"));
    document.body.appendChild(toast);
  }
  // 局外（蛊庐/九转鼎/百蛊市）说「入塔提示」不合语境——这些界面根本不在塔里。
  toast.innerHTML = "<strong></strong><p></p>";
  toast.querySelector("strong").textContent = options?.outOfRunTitle ? "塔外指引" : "入塔提示";
  toast.querySelector("p").textContent = text;
  toast.classList.remove("hidden");
  window.clearTimeout(showCoachTip.__timer);
  showCoachTip.__timer = window.setTimeout(() => toast.classList.add("hidden"), 6500);
}

function showKeywordTooltip(target) {
  if (!target || !dom.keywordTooltip) return;
  const lookupKey = target.dataset.keyword;
  const keyword = target.dataset.statusTitle || lookupKey;
  const text = target.dataset.statusDetail || KEYWORD_HELP[lookupKey] || ENEMY_STATUS_HELP[lookupKey];
  if (!text) return;
  dom.keywordTooltip.innerHTML = "<strong></strong><span></span>";
  dom.keywordTooltip.querySelector("strong").textContent = keyword;
  dom.keywordTooltip.querySelector("span").textContent = text;
  dom.keywordTooltip.classList.remove("hidden");
  dom.keywordTooltip.dataset.activeKeyword = lookupKey;
  window.requestAnimationFrame(() => positionKeywordTooltip(target));
}

function positionKeywordTooltip(target) {
  if (!target || !dom.keywordTooltip || dom.keywordTooltip.classList.contains("hidden")) return;
  const rect = target.getBoundingClientRect();
  const tip = dom.keywordTooltip;
  const tipRect = tip.getBoundingClientRect();
  const margin = 10;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - tipRect.width - margin, left));
  let top = rect.top - tipRect.height - 8;
  if (top < margin) top = rect.bottom + 8;
  top = Math.max(margin, Math.min(window.innerHeight - tipRect.height - margin, top));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideKeywordTooltip() {
  if (!dom.keywordTooltip) return;
  dom.keywordTooltip.classList.add("hidden");
  delete dom.keywordTooltip.dataset.activeKeyword;
}

function closeTopLayerByEsc() {
  if (typeof isGuluForgeResultRitualOpen === "function" && isGuluForgeResultRitualOpen()) {
    advanceGuluForgeResultRitual();
    return;
  }
  if (typeof NmgOutgameReceipts !== "undefined" && NmgOutgameReceipts.isOpen()) {
    NmgOutgameReceipts.dismiss();
    refreshModalLock();
    return;
  }
  if (dom.endlessLeaderboardOverlay && !dom.endlessLeaderboardOverlay.classList.contains("hidden")) {
    closeEndlessLeaderboard();
    return;
  }
  if (dom.moreMenuPanel && !dom.moreMenuPanel.classList.contains("hidden")) {
    setMoreMenuOpen(false);
    return;
  }
  if (dom.heroDetailOverlay && !dom.heroDetailOverlay.classList.contains("hidden")) {
    closeHeroDetail();
    return;
  }
  if (dom.xianghuoOverlay && !dom.xianghuoOverlay.classList.contains("hidden")) { // V0.9.29 香火弹窗盖在最上，优先收
    closeXianghuo();
    return;
  }
  if (dom.settingsOverlay && !dom.settingsOverlay.classList.contains("hidden")) {
    closeSettingsOverlay();
    return;
  }
  if (dom.trialSettingsOverlay && !dom.trialSettingsOverlay.classList.contains("hidden")) {
    closeTrialSettingsOverlay();
    return;
  }
  if (dom.balanceOverlay && !dom.balanceOverlay.classList.contains("hidden")) {
    closeBalanceOverlay();
    return;
  }
  if (dom.loreOverlay && !dom.loreOverlay.classList.contains("hidden")) {
    closeLoreOverlay();
    return;
  }
  if (dom.removePickerOverlay && !dom.removePickerOverlay.classList.contains("hidden")) {
    cancelShopRemovePicker();
    return;
  }
  if (typeof isGuluActionConfirmOpen === "function" && isGuluActionConfirmOpen()) {
    closeGuluActionConfirm();
    return;
  }
  if (typeof isBaigushiRedeemOpen === "function" && isBaigushiRedeemOpen()) {
    closeBaigushiRedeem();
    return;
  }
  if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) {
    closeGulu();
    return;
  }
  if (dom.prologueOverlay && !dom.prologueOverlay.classList.contains("hidden")) {
    closePrologue();
    return;
  }
  if (dom.tutorialOverlay && !dom.tutorialOverlay.classList.contains("hidden")) {
    closeTutorial();
    return;
  }
  if (dom.deckOverlay && !dom.deckOverlay.classList.contains("hidden")) {
    closeDeckOverlay();
    return;
  }
  if (dom.battleCoach && !dom.battleCoach.classList.contains("hidden")) {
    closeBattleCoach();
    return;
  }
  if (document.body.classList.contains("mobile-audio-open")) {
    closeMobileAudioPanel();
    return;
  }
  if (document.body.classList.contains("mobile-log-open")) {
    closeMobileLogPanel();
    return;
  }
  hideKeywordTooltip();
}

// 主角被动统一在回合开始触发，避免分散到开局和后续回合两套逻辑中。
function applyHeroTurnStartPassive(isFirstTurn = false) {
  if (game.player.heroId === "poison") {
    // V0.9.51 深毒契代价：万毒归宗的回合自动施毒停摆，毒要亲手下。
    if (typeof isContractAutoPoisonDisabled === "function" && isContractAutoPoisonDisabled(runState)) {
      if (isFirstTurn) addLog("深毒契：万毒归宗停摆——这一局，毒要亲手下。", "system-log");
      getRunStats().contractAutoPoisonSkipped = safeStatNumber(getRunStats().contractAutoPoisonSkipped) + 1;
      return;
    }
    applyEnemyPoison(1, "万毒归宗", { corrosive: false, logClass: "system-log" });
    if (isFirstTurn) addLog("毒道被动「万毒归宗」已启：重复施毒会触发蚀毒。", "system-log");
  }
}

function drawOneCard() {
  if (game.drawPile.length === 0) {
    if (game.discardPile.length === 0) return false;
    // V0.9.12.1 修复：战斗中期重洗此前落在默认 Math.random，固定种子战斗不可复现；改走 draw 种子通道（与开局洗牌同源）。
    game.drawPile = shuffle(game.discardPile, () => getRunRandom("draw"));
    game.discardPile = [];
    addLog("蛊匣轮转：弃牌堆已洗回抽牌堆。", "system-log");
  }
  game.hand.push(game.drawPile.pop());
  return true;
}

function drawCards(count) {
  let drawn = 0;
  for (let i = 0; i < count; i += 1) {
    if (!drawOneCard()) break;
    drawn += 1;
  }
  if (drawn > 0) playDrawCardEffect(drawn);
}

function drawToHandSize(targetSize) {
  while (game.hand.length < targetSize) {
    if (!drawOneCard()) break;
  }
}

function isMupanBattle() {
  // E-2c4：开发测试（isMupanTest）与正式塔心终局（isTowerMupan）共用全部母盘战斗逻辑；两种身份的收口各自分流（见 finishBattle）。
  return Boolean((game?.isMupanTest || game?.isTowerMupan) && game?.enemy?.id === "wanmingMupan" && game?.mupan);
}

const MUPAN_SEAL_VFX_THEMES = Object.freeze({
  blood: Object.freeze({ color: "#b9433e", accent: "#f0a070", glyph: "血" }),
  life: Object.freeze({ color: "#c8a85d", accent: "#f1dc9a", glyph: "寿" }),
  fate: Object.freeze({ color: "#d2b45e", accent: "#fff0aa", glyph: "命" }),
  poison: Object.freeze({ color: "#689b5d", accent: "#b6da82", glyph: "毒" }),
  armor: Object.freeze({ color: "#8097a0", accent: "#c4d5d8", glyph: "甲" }),
  haste: Object.freeze({ color: "#5d9c94", accent: "#9adbd0", glyph: "息" }),
});

function getMupanVfxBudget(options = {}) {
  if (options.effects === false) return 0;
  if (options.reduced) return 4;
  return options.mobile ? 10 : 22;
}

function getMupanVfxContext() {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const mobile = document.body.classList.contains("mobile-combat-safe")
    || window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches === true;
  return { effects: effectsEnabled, reduced, mobile };
}

function getMupanVfxDuration(type, context = getMupanVfxContext()) {
  if (!context.effects) return 0;
  if (context.reduced) return type === "broken" ? 360 : 240;
  const desktop = { threshold: 1450, entrance: 1250, phase2: 1080, phase3: 1180, broken: 1600 };
  const mobile = { threshold: 920, entrance: 820, phase2: 720, phase3: 780, broken: 1050 };
  return (context.mobile ? mobile : desktop)[type] || (context.mobile ? 520 : 680);
}

function createMupanVfxNode(className, duration, text = "") {
  const node = document.createElement("span");
  node.className = `mupan-vfx ${className}`;
  if (text) node.textContent = text;
  return appendEffectNode(node, duration + 160);
}

function createMupanGeometry(type, theme, duration, context) {
  const budget = getMupanVfxBudget(context);
  if (!budget) return;
  const geometryBudget = Math.max(3, Math.ceil(budget * 0.72));
  const kinds = type === "broken"
    ? ["mupan-vfx-orbit", "mupan-vfx-crack", "mupan-vfx-shard"]
    : type === "phase3"
      ? ["mupan-vfx-orbit", "mupan-vfx-chain-link", "mupan-vfx-rune", "mupan-vfx-crack"]
      : type === "phase2"
        ? ["mupan-vfx-orbit", "mupan-vfx-rune", "mupan-vfx-chain-link"]
        : type.startsWith("seal-")
          ? ["mupan-vfx-rune", "mupan-vfx-crack", "mupan-vfx-shard"]
          : type === "threshold" || type === "entrance"
            ? ["mupan-vfx-orbit", "mupan-vfx-rune", "mupan-vfx-chain-link"]
            : ["mupan-vfx-orbit", "mupan-vfx-crack", "mupan-vfx-shard"];
  for (let index = 0; index < geometryBudget; index += 1) {
    const kind = kinds[index % kinds.length];
    const glyph = kind === "mupan-vfx-rune" ? ["命", "血", "寿", "毒", "甲", "息"][index % 6] : "";
    const node = createMupanVfxNode(`mupan-vfx-geometry ${kind} is-${type}`, duration, glyph);
    if (!node) break;
    node.style.setProperty("--mupan-seal-color", theme.color);
    node.style.setProperty("--mupan-seal-accent", theme.accent);
    node.style.setProperty("--geometry-i", String(index));
    node.style.setProperty("--geometry-angle", `${(index * 137.5) % 360}deg`);
    node.style.setProperty("--geometry-delay", `${(index % 6) * 42}ms`);
    node.style.setProperty("--geometry-radius", `${18 + (index % 5) * 7}vmin`);
  }
}

function spawnMupanVfxParticles(type, theme, duration, context) {
  const budget = getMupanVfxBudget(context);
  for (let index = 0; index < budget; index += 1) {
    const node = createMupanVfxNode(`mupan-vfx-particle is-${type}`, duration);
    if (!node) break;
    node.style.setProperty("--mupan-seal-color", theme.color);
    node.style.setProperty("--mupan-seal-accent", theme.accent);
    node.style.setProperty("--particle-x", `${8 + ((index * 37) % 84)}vw`);
    node.style.setProperty("--particle-y", `${18 + ((index * 23) % 62)}vh`);
    node.style.setProperty("--particle-delay", `${(index % 7) * 38}ms`);
    node.style.setProperty("--particle-turn", `${(index * 47) % 220 - 110}deg`);
  }
}

function playMupanVfx(type, options = {}) {
  if ((!isMupanBattle() && !options.allowOutsideBattle) || !effectsAllowed()) {
    options.onComplete?.();
    return 0;
  }
  const context = getMupanVfxContext();
  const duration = options.duration ?? getMupanVfxDuration(type, context);
  const theme = MUPAN_SEAL_VFX_THEMES[options.sealId] || MUPAN_SEAL_VFX_THEMES.fate;
  const sealClass = type.startsWith("seal-") ? "mupan-vfx-seal " : "";
  const variantClass = options.variant ? ` is-${type}-${options.variant}` : "";
  const root = createMupanVfxNode(`${sealClass}mupan-vfx-scene is-${type}${variantClass}`, duration, options.glyph || "");
  if (root) {
    root.style.setProperty("--mupan-seal-color", theme.color);
    root.style.setProperty("--mupan-seal-accent", theme.accent);
  }
  spawnMupanVfxParticles(type, theme, duration, context);
  createMupanGeometry(type, theme, duration, context);
  pulseElement(dom.mupanEnvironment, `is-${type}`, duration);
  if (["phase2", "phase3", "seal-fail", "broken"].includes(type)) triggerScreenShake();
  if (options.onComplete) window.setTimeout(options.onComplete, duration);
  return duration;
}

function playTowerHeartThresholdVfx() {
  const context = getMupanVfxContext();
  const duration = getMupanVfxDuration("threshold", context);
  playMupanVfx("threshold", { allowOutsideBattle: true, duration, glyph: "心" });
}

function playTowerHeartSceneVfx(sceneId) {
  if (!effectsAllowed()) return;
  const config = {
    "tower-heart-gate": ["threshold", "fate", "心"],
    "tower-heart-prepare": ["entrance", "life", "备"],
    "tower-heart-question": ["seal-active", "fate", "问"],
    "tower-heart-reflection": ["phase2", "blood", "债"],
    "tower-heart-boss": ["phase3", "fate", "战"],
  }[sceneId];
  if (!config) return;
  playMupanVfx(config[0], { allowOutsideBattle: true, sealId: config[1], glyph: config[2] });
}

function playMupanEntranceSequence() {
  if (!isMupanBattle()) return;
  window.clearTimeout(mupanVfxTimer);
  game.inputLocked = true;
  game.mupanVfxInputLock = true;
  const finish = () => {
    mupanVfxTimer = null;
    if (game?.status === "playing") {
      game.mupanVfxInputLock = false;
      game.inputLocked = false;
      render();
    }
  };
  const duration = playMupanVfx("entrance");
  if (duration > 0) {
    showTurnBanner("塔心终局", "命债归盘 · 万命母盘苏醒");
    mupanVfxTimer = window.setTimeout(finish, duration);
  } else finish();
}

function playMupanSealFeedback(kind, sealId = "fate") {
  const type = ({ active: "seal-active", break: "seal-break", burn: "seal-burn", fail: "seal-fail" })[kind];
  if (!type) return;
  const theme = MUPAN_SEAL_VFX_THEMES[sealId] || MUPAN_SEAL_VFX_THEMES.fate;
  playMupanVfx(type, { sealId, glyph: theme.glyph });
}

function playMupanActionVfx(action = {}) {
  if (!isMupanBattle()) return;
  const kind = action.lifespanDamage ? "siphon" : (action.hits || 1) > 1 ? "slash" : action.settlesSeal ? "stamp" : "wave";
  playMupanVfx("action", { variant: kind, glyph: ({ siphon: "夺", slash: "斩", stamp: "签", wave: "震" })[kind] });
  pulseElement(dom.enemyPortrait, `mupan-action-${kind}`, 620);
}

function getMupanPortraitPhase() {
  if (!isMupanBattle()) return "";
  if (game.mupan.visualPhase === "broken" || game.enemy.hp <= 0) return "broken";
  return `phase${Math.max(1, Math.min(3, game.mupan.core.phase || 1))}`;
}

function getMupanPortraitPath(phase = getMupanPortraitPhase()) {
  return ({
    phase1: PORTRAIT_PATHS.enemies.wanmingMupanPhase1,
    phase2: PORTRAIT_PATHS.enemies.wanmingMupanPhase2,
    phase3: PORTRAIT_PATHS.enemies.wanmingMupanPhase3,
    broken: PORTRAIT_PATHS.enemies.wanmingMupanBroken,
  })[phase] || PORTRAIT_PATHS.enemies.wanmingMupan;
}

function syncMupanArenaVisualState() {
  const active = isMupanBattle();
  const enemyPanel = document.querySelector(".enemy-panel");
  document.body.classList.toggle("mupan-arena-active", active);
  if (active) {
    const phase = getMupanPortraitPhase();
    document.body.dataset.mupanPhase = phase;
    if (enemyPanel?.dataset.mupanVisualPhase !== phase) {
      enemyPanel.scrollTop = 0;
      enemyPanel.dataset.mupanVisualPhase = phase;
    }
  } else {
    delete document.body.dataset.mupanPhase;
    if (enemyPanel) delete enemyPanel.dataset.mupanVisualPhase;
  }
}

function playMupanPhaseTransition(phase) {
  if (!isMupanBattle() || ![2, 3].includes(phase)) return;
  const previousImage = dom.enemyPortrait?.querySelector(".portrait-image")?.cloneNode(true);
  renderEnemyPortrait();
  if (previousImage && effectsAllowed()) {
    previousImage.className = "mupan-phase-ghost";
    previousImage.setAttribute("aria-hidden", "true");
    dom.enemyPortrait.appendChild(previousImage);
    window.setTimeout(() => previousImage.remove(), 900);
  }
  const duration = playMupanVfx(phase === 3 ? "phase3" : "phase2");
  pulseElement(dom.enemyPortrait, "mupan-phase-transition", duration || 1);
  pulseElement(document.querySelector(".enemy-panel"), "mupan-phase-panel", duration || 1);
  addJourneyLog(phase === 3
    ? "万命母盘进入第三阶段·逼命：追击会压低灭命倒计时，归零后发动灭命一击。"
    : "万命母盘进入第二阶段·双轮：改为看穿你的次常行为，追击与夹击均为两段。", "boss-log");
}

function playMupanBrokenSequence() {
  if (!isMupanBattle()) return;
  game.mupan.visualPhase = "broken";
  syncMupanArenaVisualState();
  renderEnemyPortrait();
  const duration = playMupanVfx("broken");
  pulseElement(dom.enemyPortrait, "mupan-broken-transition", duration || 1);
  pulseElement(document.querySelector(".enemy-panel"), "mupan-broken-panel", duration || 1);
  showTurnBanner("母盘·断裂", "所有追击停止，盘心已经击破");
  addLog("万命母盘盘心断裂，所有看穿与追击随之停止。", "important");
  addJourneyLog(game.isMupanTest
    ? "开发挑战：万命母盘盘心断裂；本次胜利只记测试结果，不推进章节终点。"
    : "盘心断裂——万命母盘再也写不出任何人的命。角色结局，自此开启。", "important");
}

function getMupanTestModeTuning(config = {}) {
  if (config.mode === "tian") return getTianTuning(config.tianTier || 1);
  if (config.mode === "endless") return getEndlessTuning(config.endlessFloor || 1);
  return ENEMY_BALANCE.modeTuning[config.mode] || ENEMY_BALANCE.modeTuning.normal;
}

function createForcedMupanDebtSnapshot(primaryId, secondaryId) {
  const ids = MUPAN_DEBT_TIE_ORDER;
  const primary = ids.includes(primaryId) ? primaryId : "haste";
  const secondary = ids.includes(secondaryId) && secondaryId !== primary
    ? secondaryId
    : ids.find((id) => id !== primary);
  const scores = Object.freeze(Object.fromEntries(ids.map((id) => [id, id === primary ? 2 : id === secondary ? 1 : 0])));
  const makeChoice = (id) => Object.freeze({
    id,
    name: MUPAN_DEBT_DEFINITIONS[id].name,
    sealName: MUPAN_DEBT_DEFINITIONS[id].sealName,
    score: scores[id],
  });
  return Object.freeze({ primary: makeChoice(primary), secondary: makeChoice(secondary), scores });
}

function getMupanDebtSnapshot(config = {}) {
  if (config.primaryDebt || config.secondaryDebt) {
    return createForcedMupanDebtSnapshot(config.primaryDebt, config.secondaryDebt);
  }
  return selectMupanDebtSnapshot({
    runStats: getRunStats(),
    maxHp: runState.maxHp,
    maxLifespan: runState.maxLifespan,
  });
}

function initializeMupanTestBattle(battle, config = {}) {
  battle.isMupanTest = true;
  battle.mupan = createMupanBattleState({
    debtSnapshot: getMupanDebtSnapshot(config),
    mode: config.mode || "normal",
    tianTier: config.tianTier || 0,
    balance: ENEMY_BALANCE.mupan,
  });
  battle.mupan.sealedCards = [];
  battle.mupan.chapterProgressBefore = JSON.stringify(runState.chapterProgress || null);
  battle.mupan.deckCountBefore = runState.deckCards?.length || 0;
  battle.mupan.runFieldsBefore = { ...(config.runFieldsBefore || {}) };
  battle.mupan.config = { ...config };
  battle.mupan.rewrittenAction = null;
  battle.mupan.rewriteEnergyDrainAppliedTurn = 0;
  battle.mupanTurnMetrics = null;
  if (config.phase === 2 || config.phase === 3) {
    const ratio = config.phase === 3 ? 0.34 : 0.69;
    battle.enemy.hp = Math.max(1, Math.floor(battle.enemy.maxHp * ratio));
    battle.mupan = advanceMupanBattlePhase(battle.mupan, {
      bossHp: battle.enemy.hp,
      bossMaxHp: battle.enemy.maxHp,
      source: "dev",
      balance: ENEMY_BALANCE.mupan,
    });
  }
  resetMupanTurnMetrics();
  battle.mupan = beginMupanPlayerTurn(battle.mupan, ENEMY_BALANCE.mupan);
}

function getMupanDebtLedgerLine(choice) {
  const stats = getRunStats();
  const values = {
    blood: `本局主动失去生命 ${stats.selfHpLost || 0}`,
    life: `本局主动消耗寿元 ${stats.lifespanSpent || 0}`,
    fate: `本局命势圆满 ${stats.fateTriggers || 0} 次`,
    poison: `本局毒性伤害 ${stats.poisonDamage || 0}`,
    armor: `本局获得防御 ${stats.armorGained || 0}`,
    haste: `本局打出蛊牌 ${stats.cardsPlayed || 0} 张`,
  };
  return `${choice.name} · ${values[choice.id]}`;
}

function openMupanLedger() {
  if (!isMupanBattle()) return;
  const debts = game.mupan.core.debtSnapshot;
  game.inputLocked = true;
  dom.mupanLedgerLead.textContent = `母盘已从本局行迹看穿「${debts.primary.name}」与「${debts.secondary.name}」。它每阶段只盯一种，触发就会立即追击。`;
  const refineCount = (getRunStats().stableRefines || 0) + (getRunStats().mutations || 0) + (getRunStats().backlashes || 0);
  dom.mupanLedgerDebts.innerHTML = `
    <div><span>最常行为</span><strong>${getMupanDebtLedgerLine(debts.primary)}</strong></div>
    <div><span>次常行为</span><strong>${getMupanDebtLedgerLine(debts.secondary)}</strong></div>
    <div><span>另已登记</span><strong>炼蛊 ${refineCount} 次 · 反噬 ${getRunStats().backlashes || 0} 次</strong></div>`;
  dom.mupanLedgerOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeMupanLedger() {
  if (!isMupanBattle()) return;
  dom.mupanLedgerOverlay.classList.add("hidden");
  refreshModalLock();
  playMupanEntranceSequence();
}

function startMupanTestBattle(config = {}) {
  if (!runState || runState.status !== "running") return false;
  restoreMupanSealedCardsToBattle();
  restoreMupanTestRunFields();
  dom.resultOverlay?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  pendingMupanTestConfig = {
    mode: config.mode || "normal",
    tianTier: config.tianTier || 0,
    primaryDebt: config.primaryDebt || "",
    secondaryDebt: config.secondaryDebt || "",
    phase: config.phase || 1,
    runFieldsBefore: captureMupanTestRunFields(),
  };
  startFloorBattle();
  return isMupanBattle();
}

function revealMupanTestResult(victory, debtSnapshot) {
  const card = dom.resultOverlay.querySelector(".result-card");
  card.className = `result-card ${victory ? "victory" : "defeat"}`;
  hideRewardPanels();
  closeBattleCoach(false);
  dom.resultSeal.textContent = victory ? "破" : "败";
  dom.resultEyebrow.textContent = "开发挑战 · 不计主线结算";
  dom.resultTitle.textContent = "母盘测试结束";
  dom.resultDescription.textContent = victory
    ? `万命母盘的追击已止。它看穿了 ${debtSnapshot.primary.name} 与 ${debtSnapshot.secondary.name}；本次胜利不会触发通关或任何解锁。`
    : `测试战斗已结束。母盘看穿了 ${debtSnapshot.primary.name} 与 ${debtSnapshot.secondary.name}；不会计入死亡、通关或主线进度。`;
  dom.resultTurns.textContent = game.turn;
  dom.resultHp.textContent = Math.max(0, game.player.hp);
  dom.resultPrimaryButton.textContent = "返回命途图";
  dom.resultPrimaryButton.dataset.action = "mupanTestClose";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateMobileViewportState();
  render();
}

function finishMupanTestBattle(victory) {
  if (!isMupanBattle()) return false;
  const outcome = getMupanTestOutcome(victory);
  restoreMupanSealedCardsToBattle();
  game.status = outcome;
  game.inputLocked = true;
  if (game.player) {
    game.player.drunkStacks = 0;
    game.player.drunkFlatBonus = 0;
  }
  clearCombatEffects();
  recordBattleFinished(victory, { recordDefeatCause: false });
  const debtSnapshot = game.mupan.core.debtSnapshot;
  const chapterUnchanged = JSON.stringify(runState.chapterProgress || null) === game.mupan.chapterProgressBefore;
  const deckUnchanged = (runState.deckCards?.length || 0) === game.mupan.deckCountBefore;
  const summary = {
    outcome,
    primary: debtSnapshot.primary.id,
    secondary: debtSnapshot.secondary.id,
    reads: game.mupan.stats.reads,
    successfulBreaks: game.mupan.stats.successfulBreaks,
    pursuits: game.mupan.stats.pursuits,
    finalBlows: game.mupan.stats.finalBlows,
    turns: game.turn,
    chapterUnchanged,
    deckUnchanged,
  };
  getRunStats().mupan = summary;
  window.clearTimeout(mupanResultTimer);
  if (victory) {
    playMupanBrokenSequence();
    mupanResultTimer = window.setTimeout(() => {
      mupanResultTimer = null;
      revealMupanTestResult(true, debtSnapshot);
    }, getMupanVfxDuration("broken") + 120);
  } else {
    revealMupanTestResult(false, debtSnapshot);
  }
  return true;
}

function closeMupanTestResult() {
  window.clearTimeout(mupanResultTimer);
  mupanResultTimer = null;
  window.clearTimeout(mupanVfxTimer);
  mupanVfxTimer = null;
  restoreMupanSealedCardsToBattle();
  dom.resultOverlay.classList.add("hidden");
  document.body.classList.remove("modal-open");
  document.body.classList.remove("mupan-arena-active");
  delete document.body.dataset.mupanPhase;
  showMapScreen();
}

/* ===== E-2c4 正式塔心终局战：入口 / 初始化 / 收口（与开发测试彻底分流，不接收任何强制参数） ===== */
/* 初始化：主副签取自命债照见锁定的 reflection；分值以当局真实统计重算（纯函数，理论恒等；万一漂移以锁定签为准）。
 * 不设 runFieldsBefore / chapterProgressBefore——正式战没有"测试回滚"语义。模式调参走 getModeTuning() 真实模式。 */
function initializeTowerMupanBattle(battle) {
  const locked = runState.chapterProgress?.towerHeart?.reflection || null;
  let snapshot = getMupanDebtSnapshot({});
  if (!locked || snapshot.primary.id !== locked.primaryId || snapshot.secondary.id !== locked.secondaryId) {
    snapshot = createForcedMupanDebtSnapshot(locked?.primaryId, locked?.secondaryId);
  }
  battle.isTowerMupan = true;
  battle.mupan = createMupanBattleState({
    debtSnapshot: snapshot,
    mode: runState.mode || "normal",
    tianTier: runState.tianTier || 0,
    balance: ENEMY_BALANCE.mupan,
  });
  battle.mupan.sealedCards = [];
  battle.mupan.pendingSealId = "";
  battle.mupan.rewrittenAction = null;
  battle.mupan.rewriteEnergyDrainAppliedTurn = 0;
  battle.mupanTurnMetrics = null;
  resetMupanTurnMetrics();
  battle.mupan = beginMupanPlayerTurn(battle.mupan, ENEMY_BALANCE.mupan);
}
/* 入口：只认「塔心 boss 节点 + 照见已锁签」；startMingtuTowerHeartBoss 幂等（inBattle 重入=整场重开，符合 §7.2）。 */
function startTowerHeartMupanBattle() {
  if (!runState || runState.status !== "running" || !isMingtuTowerHeart(runState)) return;
  if (runState.chapterProgress.nodeId !== "tower-heart-boss") return;
  if (!startMingtuTowerHeartBoss(runState)) return;
  pendingTowerMupanBattle = true;
  dom.towerHeartScreen?.classList.add("hidden");
  startFloorBattle();
  if (!isMupanBattle()) pendingTowerMupanBattle = false; // 兜底：进战失败不留脏标志
}
/* 母盘统计入账（正式）：与测试 summary 同构，另记 isTower 以便反馈区分。 */
function writeTowerMupanStats(outcome) {
  const debtSnapshot = game.mupan.core.debtSnapshot;
  getRunStats().mupan = {
    outcome,
    isTower: true,
    primary: debtSnapshot.primary.id,
    secondary: debtSnapshot.secondary.id,
    reads: game.mupan.stats.reads,
    successfulBreaks: game.mupan.stats.successfulBreaks,
    pursuits: game.mupan.stats.pursuits,
    finalBlows: game.mupan.stats.finalBlows,
    turns: game.turn,
  };
}
/* 正式胜利收口（设计 E2C0 §11）：恢复封存牌→写统计→推进 ending→存检查点→盘心断裂演出→回塔心壳（角色结局）。
 * 不发 Boss 蛊石/蛊母残核、不显示测试结束、不返回命途图、不直接 cleared——通关奖励统一在角色结局确认后的 cleared 结算发放。 */
function finishTowerMupanBattle() {
  if (!isMupanBattle() || game.isMupanTest) return false;
  restoreMupanSealedCardsToBattle();
  game.status = "victory";
  game.inputLocked = true;
  if (game.player) {
    game.player.drunkStacks = 0;
    game.player.drunkFlatBonus = 0;
  }
  clearCombatEffects();
  recordBattleFinished(true);
  syncRunStateFromBattle();
  if (game.player.hp <= 0) { game.player.hp = 1; runState.currentHp = 1; } // 同归零判胜的 0 血保底，与通用结算一致
  writeTowerMupanStats("victory");
  if (!runState.defeatedEnemies.includes(game.enemy.definition.name)) runState.defeatedEnemies.push(game.enemy.definition.name);
  addLog("万命母盘倒下——盘心裸露于世。", "important");
  if (!completeMingtuTowerHeartBoss(runState)) return false; // inBattle→defeated + 推进 ending（唯一正门）
  if (unlockTowerLorePage("mupanTruth")) addJourneyLog("命蛊残卷新页已显：《终卷·上：万命为盘》", "important"); // E-2c5b：战斗频道行由 unlockLorePage 自记，札记另记一行
  saveRunStateToStorage(); // §7.2：先存 ending 检查点，断裂演出中关闭也从角色结局恢复
  window.AudioManager?.playSfx?.("victory", { volumeScale: 0.5 });
  playMupanBrokenSequence(); // boss4 击破立绘 + 震屏 + 裂纹（复用 E-2b2 演出）
  window.clearTimeout(towerMupanFinaleTimer);
  towerMupanFinaleTimer = window.setTimeout(() => {
    towerMupanFinaleTimer = null;
    document.body.classList.remove("mupan-arena-active");
    delete document.body.dataset.mupanPhase;
    game = null;
    showTowerHeartScene(); // 角色结局场景
  }, Math.max(420, getMupanVfxDuration("broken") + 140));
  return true;
}

function resetMupanTurnMetrics() {
  if (!isMupanBattle()) return;
  const stats = getRunStats();
  game.mupanTurnMetrics = {
    selfHpLostStart: stats.selfHpLost || 0,
    lifespanSpentStart: stats.lifespanSpent || 0,
    fateTriggersStart: stats.fateTriggers || 0,
    armorGainedStart: stats.armorGained || 0,
    nonPoisonDamage: 0,
    poisonAdded: 0,
  };
}

function getMupanTurnMetrics() {
  const turn = game.mupanTurnMetrics || {};
  const stats = getRunStats();
  return {
    turnEnded: true,
    cardsPlayed: game.cardsPlayedThisTurn || 0,
    selfHpLost: Math.max(0, (stats.selfHpLost || 0) - (turn.selfHpLostStart || 0)),
    lifespanSpent: Math.max(0, (stats.lifespanSpent || 0) - (turn.lifespanSpentStart || 0)),
    fateTriggers: Math.max(0, (stats.fateTriggers || 0) - (turn.fateTriggersStart || 0)),
    poisonAdded: turn.poisonAdded || 0,
    armorGained: Math.max(0, (stats.armorGained || 0) - (turn.armorGainedStart || 0)),
    nonPoisonDamage: turn.nonPoisonDamage || 0,
    energyRemaining: game.player.energy || 0,
  };
}

function captureMupanActionMetrics() {
  if (!isMupanBattle()) return null;
  const metrics = getMupanTurnMetrics();
  return {
    cardsPlayed: metrics.cardsPlayed,
    selfHpLost: metrics.selfHpLost,
    lifespanSpent: metrics.lifespanSpent,
    fateTriggers: metrics.fateTriggers,
    poisonAdded: metrics.poisonAdded,
    armorGained: metrics.armorGained,
  };
}

function performMupanImmediatePursuit(action) {
  if (!isMupanBattle() || !action || game.status !== "playing" || game.enemy.hp <= 0) return false;
  game.inputLocked = true;
  playBossActionEffect(action);
  playMupanActionVfx(action);
  const damage = getMupanActionDamage(action);
  const rawDamage = damage.total;
  const armorBefore = game.player.armor || 0;
  const blocked = Math.min(armorBefore, rawDamage);
  const received = Math.max(0, rawDamage - armorBefore);
  game.player.armor = Math.max(0, armorBefore - rawDamage);
  if (game.bone) game.bone.enemyBreakGrantedThisAction = false;
  if (armorBefore > 0 && game.player.armor === 0) recordBoneArmorBreak();
  if (game.player.vulnerable > 0 && rawDamage > 0) {
    game.player.vulnerable = Math.max(0, game.player.vulnerable - 1);
  }
  const hpBefore = game.player.hp;
  game.player.hp = Math.max(0, game.player.hp - received);
  if (received > 0) {
    game.lastHurtSource = "mupanPursuit";
    game.player.wasDamagedThisTurn = true;
    checkHeroLowLife(hpBefore);
    recordEnemyDamage(received);
    playCombatHitSfx(received, { crit: action.hits > 1, blocked, volumeScale: 0.55 });
    spawnFloatText(dom.playerPortrait, `追击 -${received}`, "");
    animateHit(dom.playerPortrait);
    playPlayerHitEffect();
  } else if (blocked > 0) {
    spawnFloatText(dom.playerPortrait, `格挡 ${blocked}`, "defense-float");
  }
  const segmentText = damage.hits > 1 ? `${damage.perHit}×${damage.hits}` : `${damage.total}`;
  addLog(`你触发了母盘看穿的行为。${action.name}立即插入，造成 ${segmentText} 点伤害；防御抵挡 ${blocked}，实际受到 ${received}。`, "boss-log");
  setBattleMessage(`${action.name}强行截断动作；你承受 ${received} 点伤害。`);
  const ended = checkBattleResult();
  if (!ended && game.status === "playing") game.inputLocked = false;
  render();
  return !ended;
}

function resolveMupanPostPlayerAction(beforeMetrics) {
  if (!beforeMetrics || !isMupanBattle() || game.status !== "playing" || game.enemy.hp <= 0) return false;
  const afterMetrics = captureMupanActionMetrics();
  const watchedHabitId = game.mupan.core.watchedHabitId;
  if (!detectMupanHabitTrigger(watchedHabitId, beforeMetrics, afterMetrics)) return false;
  const result = resolveMupanImmediatePursuit(game.mupan, {
    triggeredHabitId: watchedHabitId,
    balance: ENEMY_BALANCE.mupan,
  });
  game.mupan = result.state;
  if (!result.triggered || !result.attack || game.enemy.hp <= 0 || game.status !== "playing") return false;
  return performMupanImmediatePursuit(result.attack);
}

function getMupanActionDamage(action = getCurrentEnemyAction()) {
  const fixed = Array.isArray(action.fixedSegments);
  const vulnerableMultiplier = !fixed && (game.player.vulnerable || 0) > 0 ? 1.5 : 1;
  return getMupanIntentDamage(action, {
    attackMultiplier: game.enemyAttackMultiplier || 1,
    attackBonusMultiplier: vulnerableMultiplier,
    weaken: fixed ? 0 : (game.enemy.weaken || 0),
  });
}

function applyMupanIncomingDamage(amount) {
  if (!isMupanBattle()) return amount;
  return Math.max(0, Math.round(amount * getMupanDamageTakenMultiplier(game.mupan)));
}

function announceMupanPhaseChange(previousPhase) {
  if (!isMupanBattle() || game.mupan.core.phase === previousPhase) return;
  const label = game.mupan.core.phase === 2 ? "双轮" : "逼命";
  addLog(`万命母盘转入${label}阶段；当前玩家行动结算完毕后，新阶段威胁开始生效。`, "boss-log");
  showTurnBanner(`母盘·${label}`, game.mupan.core.phase === 3 ? "灭命倒计时开始" : "改为看穿次常行为");
  playMupanPhaseTransition(game.mupan.core.phase);
}

function updateMupanPhase(source = "player") {
  if (!isMupanBattle() || game.enemy.hp <= 0) return;
  const before = game.mupan.core.phase;
  game.mupan = advanceMupanBattlePhase(game.mupan, {
    bossHp: game.enemy.hp,
    bossMaxHp: game.enemy.maxHp,
    source,
    balance: ENEMY_BALANCE.mupan,
  });
  announceMupanPhaseChange(before);
}

function chooseEnemyIntent() {
  // FUNNEL-1 教学演武：木人固定套路（掌→扫→蓄），按回合驱动、零 RNG 调用
  if (game?.tutorialDrill) {
    const seq = ["tap", "swing", "brace"];
    game.enemy.intent = seq[(game.turn - 1) % seq.length];
    return;
  }
  if (isMupanBattle()) {
    game.enemy.intent = getMupanCurrentAction(game.mupan, ENEMY_BALANCE.mupan).id;
    game.mupan.rewrittenAction = null;
    return;
  }
  // V0.9.51 先知契：意图队列——第一回合预掷的未来意图按序复用为后续回合实际意图，
  // "intent" 通道总掷次与无契局一致（只是提前掷），保证 RNG 序列同构。
  if (Array.isArray(game.enemy.foresightQueue) && game.enemy.foresightQueue.length) {
    game.enemy.intent = game.enemy.foresightQueue.shift();
    return;
  }
  const keys = Object.keys(game.enemy.definition.actions);
  game.enemy.intent = keys[getRunRandomInt(keys.length, "intent")];
  if (game.turn === 1 && typeof getContractForesightDepth === "function") {
    const depth = getContractForesightDepth(runState);
    if (depth > 0) {
      game.enemy.foresightQueue = [];
      for (let i = 0; i < depth; i += 1) game.enemy.foresightQueue.push(keys[getRunRandomInt(keys.length, "intent")]);
      getRunStats().contractForesightBattles = safeStatNumber(getRunStats().contractForesightBattles) + 1;
      addLog(`先知契：窥见敌人后 ${depth} 步意图——${game.enemy.foresightQueue.map((id) => getEnemyActionForIntent(id)?.name || "未知").join("、")}。`, "positive-log");
    }
  }
}

function getEnemyActionForIntent(intentId) {
  if (intentId === "__poisonSwallow") {
    const rule = game?.enemy?.definition?.poisonSwallow || {};
    return {
      id: "__poisonSwallow",
      name: "吞毒",
      icon: "吞",
      kind: "poisonSwallow",
      threshold: Math.max(1, Number(rule.threshold) || 1),
      heal: Math.max(0, Number(rule.heal) || 0),
    };
  }
  if (isMupanBattle()) {
    if (game.mupan.pendingEnemyAction?.id === intentId) return game.mupan.pendingEnemyAction;
    if (game.mupan.rewrittenAction && game.mupan.rewrittenAction.originalIntentId === intentId) {
      return game.mupan.rewrittenAction;
    }
    const actions = Object.values(ENEMY_BALANCE.mupan.actions).flat();
    return actions.find((entry) => entry.id === intentId)
      || getMupanCurrentAction(game.mupan, ENEMY_BALANCE.mupan);
  }
  const action = game.enemy.definition.actions[intentId];
  if (!action) return {};
  if (game.enemy.phase2) {
    // 尸盘监守（一层 Boss）相位改写，保持原值不动
    if (game.enemy.id === "corpsepuppet") {
      if (intentId === "corpseClaw") return { ...action, damage: 12 };
      if (intentId === "guFireBreath") return { ...action, damage: 8, playerPoison: 3 };
      if (intentId === "corpseCharge") return { ...action, bonus: 9 };
    }
    // 第二层 Boss · 百瘴母蛊「瘴母苏醒」：毒更猛
    if (game.enemy.id === "miasmaMotherBoss") {
      if (intentId === "maternalLash") return { ...action, damage: 11, playerPoison: 3 };
      if (intentId === "hundredMiasma") return { ...action, damage: 7, playerPoison: 6 };
      if (intentId === "broodCharge") return { ...action, bonus: 9 };
    }
    // 第二层 Boss · 血衣蛊母「血衣覆身」：吸血与压迫更强
    if (game.enemy.id === "bloodRobeMotherBoss") {
      if (intentId === "robeLash") return { ...action, damage: 12, lifesteal: 7 };
      if (intentId === "bloodOffering") return { ...action, damage: 17, lowHpExtra: 8 };
      if (intentId === "crimsonGather") return { ...action, bonus: 9, lifesteal: 6 };
    }
    // 第三层 Boss · 骨巢守墓王「骨巢开裂」：重击与蓄力增强
    if (game.enemy.id === "boneNestGuardianBoss") {
      if (intentId === "tombCrush") return { ...action, damage: 14 };
      if (intentId === "boneVolley") return { ...action, damage: 8, hits: 2 };
      if (intentId === "sepulchreCharge") return { ...action, bonus: 12, interruptThreshold: 16 };
    }
    // 第三层 Boss · 灾厄蜂后「蜂群暴动」：多段与毒刺增强
    if (game.enemy.id === "calamityQueenBoss") {
      if (intentId === "queenSting") return { ...action, damage: 6, hits: 3, playerPoisonSting: 2 };
      if (intentId === "swarmBurst") return { ...action, damage: 7, playerPoison: 4 };
      if (intentId === "broodCharge") return { ...action, bonus: 10 };
    }
  }
  return action;
}

function getCurrentEnemyAction() {
  return getEnemyActionForIntent(game.enemy.intent);
}

function getFateRewriteAlternatives() {
  if (!game?.enemy?.definition?.actions) return [];
  return Object.keys(game.enemy.definition.actions).filter((intentId) => intentId !== game.enemy.intent);
}

function getFateRewriteCandidateSummary(action) {
  if (!action) return "技能信息未明";
  if (action.kind === "charge") {
    const extras = [];
    if (action.armor) extras.push(`防御 +${action.armor}`);
    if (action.lifesteal) extras.push(`吸血 ${action.lifesteal}`);
    return `本回合不攻击；下次攻击 +${action.bonus || 0}${extras.length ? `，${extras.join("，")}` : ""}`;
  }
  const hits = Math.max(1, Number(action.hits) || 1);
  const extras = [];
  if (hits > 1) extras.push(`${hits} 次连击`);
  if (action.playerPoison) extras.push(`施毒 ${action.playerPoison}`);
  if (action.playerPoisonSting) extras.push(`毒刺 ${action.playerPoisonSting}`);
  if (action.lifespanDamage) extras.push(`损寿 ${action.lifespanDamage}`);
  if (action.energyDrain) extras.push(`下回合真元 -${action.energyDrain}`);
  if (action.lifesteal) extras.push(`吸血 ${action.lifesteal}`);
  return `基础伤害 ${Math.max(0, Number(action.damage) || 0) * hits}${extras.length ? `，${extras.join("，")}` : ""}`;
}

function completeFateRewrite({ useCandidate, fallback = false } = {}) {
  if (!game?.fateRewritePending || getActiveFateBenmingPath() !== "devourOmen") return false;
  const candidate = game.fateRewriteCandidate;
  const oldIntent = game.enemy.intent;
  const oldName = getEnemyActionForIntent(oldIntent).name || "原技能";
  let newName = oldName;
  if (useCandidate && candidate?.intentId) {
    if (oldIntent === "__poisonSwallow") {
      game.enemy.poisonSwallowArmed = false;
      game.enemy.poisonSwallowOriginalIntent = null;
    }
    if (isMupanBattle() && candidate.action) {
      game.mupan.rewrittenAction = { ...candidate.action, originalIntentId: oldIntent };
    } else {
      game.enemy.intent = candidate.intentId;
    }
    newName = getCurrentEnemyAction().name || "新技能";
    getRunStats().fateRewrites = (getRunStats().fateRewrites || 0) + 1;
    addLog(`噬签改命：敌人准备的「${oldName}」已改为「${newName}」。`, "important");
  } else if (!fallback && candidate) {
    getRunStats().fateRewriteKept = (getRunStats().fateRewriteKept || 0) + 1;
    addLog(`噬签改命：已看过「${candidate.name}」，仍保留原技能「${oldName}」。`, "important");
  } else {
    addLog("噬签改命：此敌没有其他技能可换，当前技能不变，命势圆满照常结算。", "system-log");
  }

  const routeGuard = planFateRouteGuard("devourOmen", "rewriteComplete", game.fateRouteGuardUsedThisTurn);
  game.fateRouteGuardUsedThisTurn = routeGuard.used;
  if (routeGuard.armor > 0) {
    game.player.armor += routeGuard.armor;
    recordArmorGained(routeGuard.armor);
    spawnFloatText(dom.playerPortrait, `改命护持 +${routeGuard.armor}`, "defense-float");
    addLog(`噬签改命：完成取舍，获得 ${routeGuard.armor} 点防御。`, "positive-log");
  }

  game.fateRewriteUsedThisTurn = true;
  game.fateRewritePending = false;
  game.fateRewriteCandidate = null;
  game.inputLocked = false;
  game.player.fateMomentum = FATE_MOMENTUM_MAX;
  resolveFateFull();
  const ended = checkBattleResult();
  render();
  if (!ended && game.status === "playing") setBattleMessage(`敌人准备使用的技能已确定：${newName}。命势圆满随之结算。`);
  return true;
}

function requestFateRewrite() {
  if (!game || game.status !== "playing" || game.inputLocked || !game.fateRewritePending) return false;
  if (getActiveFateBenmingPath() !== "devourOmen" || game.fateRewriteUsedThisTurn) return false;
  if (isMupanBattle()) {
    const current = getCurrentEnemyAction();
    if (current.kind !== "attack") return completeFateRewrite({ useCandidate: false, fallback: true });
    const damage = getMupanActionDamage(current);
    const rewritten = getMupanRewriteAction({ ...current, fixedSegments: [...damage.segments] });
    const segmentText = rewritten.fixedSegments.length > 1
      ? `${rewritten.fixedSegments.join("+")}，共 ${rewritten.fixedSegments.reduce((sum, value) => sum + value, 0)}`
      : `${rewritten.fixedSegments[0] || 0}`;
    game.fateRewriteCandidate = {
      intentId: game.enemy.intent,
      action: rewritten,
      name: "夺息刻",
      summary: `最终伤害 ${segmentText}；下回合真元恢复 -1；当前看穿行为与灭命倒计时仍会继续。`,
    };
    if (benmingPassive("fate", 5)) {
      game.inputLocked = true;
      addLog("噬签改命·五转：已看见夺息刻，可选择采用或保留原技能；母盘的看穿仍会继续。", "important");
      render();
      return true;
    }
    return completeFateRewrite({ useCandidate: true });
  }
  const alternatives = getFateRewriteAlternatives();
  if (!alternatives.length) return completeFateRewrite({ useCandidate: false, fallback: true });

  const intentId = alternatives[getRunRandomInt(alternatives.length, "intent")];
  const action = getEnemyActionForIntent(intentId);
  if (benmingPassive("fate", 5)) {
    game.fateRewriteCandidate = {
      intentId,
      name: action.name || "未知技能",
      summary: getFateRewriteCandidateSummary(action),
    };
    game.inputLocked = true;
    addLog(`噬签改命·五转：已看到新技能「${game.fateRewriteCandidate.name}」，请选择采用新技能或保留原技能。`, "important");
    render();
    return true;
  }

  game.fateRewriteCandidate = { intentId, name: action.name || "未知技能", summary: getFateRewriteCandidateSummary(action) };
  return completeFateRewrite({ useCandidate: true });
}

function getLogList(channel = activeLogChannel) {
  return channel === "journey" ? journeyLogs : battleLogs;
}

function setLogList(channel, list) {
  if (channel === "journey") journeyLogs = list;
  else battleLogs = list;
}

function getLogElement(channel = activeLogChannel) {
  return channel === "journey" ? dom.journeyLog : dom.battleLog;
}

function updateLogTabs() {
  dom.logBattleTab?.classList.toggle("active", activeLogChannel === "battle");
  dom.logJourneyTab?.classList.toggle("active", activeLogChannel === "journey");
  dom.logBattleTab?.setAttribute("aria-selected", String(activeLogChannel === "battle"));
  dom.logJourneyTab?.setAttribute("aria-selected", String(activeLogChannel === "journey"));
  dom.battleLog?.classList.toggle("hidden", activeLogChannel !== "battle");
  dom.journeyLog?.classList.toggle("hidden", activeLogChannel !== "journey");
  if (dom.logTitle) dom.logTitle.textContent = activeLogChannel === "journey" ? "命途札记" : "战斗铭刻";
}

function isLogAtBottom(channel = activeLogChannel) {
  const target = getLogElement(channel);
  if (!target) return true;
  return target.scrollHeight - target.scrollTop - target.clientHeight <= 16;
}

// 双日志分卷：战斗铭刻记录战斗，命途札记记录路线、机缘、蛊坊、炼蛊和残卷。
/* V0.9.51 日志分级：一场战斗几十条，暴击/遗物触发/濒危与"抽了2张牌"混在一起＝字墙。
 * 默认只留「要事」——伤害、增益、毒血、Boss、玩家/敌人行动；
 * system-log 是回合流水（抽牌数、真元恢复、被动已启这类），默认折起，开关可全看。
 * 只影响呈现，日志数据一条不丢（展开即见全量）。 */
const LOG_CHATTER_CLASSES = Object.freeze(["system-log"]);
let logShowChatter = false;
function isChatterLog(entry) {
  return LOG_CHATTER_CLASSES.some((c) => String(entry?.className || "").includes(c));
}
function toggleLogChatter() {
  logShowChatter = !logShowChatter;
  renderLogChannel(activeLogChannel, { scrollMode: "bottom" });
}

function renderLogChannel(channel = activeLogChannel, { scrollMode = "bottom", previousScrollTop = 0 } = {}) {
  const target = getLogElement(channel);
  if (!target || !dom.logHistoryToggle) return;
  const rawList = getLogList(channel);
  // 战斗频道才做要事过滤；命途札记(journey)本就是稀疏的大事记，不过滤。
  const list = (channel === "battle" && !logShowChatter) ? rawList.filter((e) => !isChatterLog(e)) : rawList;
  const chatterHidden = channel === "battle" ? rawList.length - list.length : 0;
  const hiddenCount = Math.max(0, list.length - LOG_PREVIEW_COUNT);
  const expanded = Boolean(logsExpanded[channel]);
  const visibleLogs = expanded ? list : list.slice(-LOG_PREVIEW_COUNT);
  target.innerHTML = visibleLogs.map((entry) => (
    `<li class="${entry.className || ""}">${entry.message}</li>`
  )).join("");

  if (channel === activeLogChannel) {
    dom.logHistoryToggle.classList.toggle("hidden", hiddenCount === 0);
    dom.logHistoryToggle.textContent = expanded
      ? "收起旧记录"
      : `展开更早记录（${hiddenCount}）`;
    dom.logHistoryToggle.setAttribute("aria-expanded", String(expanded));
    // V0.9.51：仅战斗频道、且确有流水被折起时才出现开关，避免空按钮占位。
    if (dom.logChatterToggle) {
      const showChatter = channel === "battle" && (chatterHidden > 0 || logShowChatter);
      dom.logChatterToggle.classList.toggle("hidden", !showChatter);
      dom.logChatterToggle.textContent = logShowChatter ? "只看要事" : `显示回合流水（${chatterHidden}）`;
      dom.logChatterToggle.setAttribute("aria-pressed", String(logShowChatter));
    }
  }

  if (scrollMode === "preserve") target.scrollTop = previousScrollTop;
  else if (scrollMode === "top") target.scrollTop = 0;
  else target.scrollTop = target.scrollHeight;
}

function switchLogChannel(channel) {
  if (!["battle", "journey"].includes(channel)) return;
  activeLogChannel = channel;
  updateLogTabs();
  renderLogChannel(channel, { scrollMode: "bottom" });
}

function resetLogChannel(channel, summary = "") {
  setLogList(channel, []);
  logsExpanded[channel] = false;
  if (summary) setLogList(channel, [{ message: summary, className: "system-log" }]);
  renderLogChannel(channel);
}

function resetAllLogs() {
  battleLogs = [];
  journeyLogs = [];
  logsExpanded = { battle: false, journey: false };
  renderLogChannel("battle");
  renderLogChannel("journey");
}

function resetBattleLog() {
  resetLogChannel("battle");
}

function addLogToChannel(channel, message, className = "") {
  const wasAtBottom = isLogAtBottom(channel);
  const target = getLogElement(channel);
  const previousScrollTop = target?.scrollTop || 0;
  const list = getLogList(channel);
  list.push({ message, className });
  if (list.length > MAX_BATTLE_LOGS) list.shift();
  setLogList(channel, list);
  const shouldPreserve = logsExpanded[channel] && !wasAtBottom;
  renderLogChannel(channel, {
    scrollMode: shouldPreserve ? "preserve" : "bottom",
    previousScrollTop,
  });
}

function addLog(message, className = "") {
  addLogToChannel("battle", message, className);
}

function addJourneyLog(message, className = "") {
  addLogToChannel("journey", message, className);
}

function toggleOlderLogs() {
  const list = getLogList(activeLogChannel);
  if (list.length <= LOG_PREVIEW_COUNT) return;
  logsExpanded[activeLogChannel] = !logsExpanded[activeLogChannel];
  renderLogChannel(activeLogChannel, { scrollMode: logsExpanded[activeLogChannel] ? "top" : "bottom" });
}

function setBattleMessage(message) {
  dom.battleMessage.innerHTML = emphasizeCombatHtml(message);
}

function emphasizeCombatHtml(html) {
  if (!html) return "";
  return String(html).split(/(<[^>]+>)/).map((segment) => {
    if (segment.startsWith("<")) return segment;
    return escapeAttribute(segment).replace(/([+-]?\d+(?:\.\d+)?%?(?:\s*(?:点|层|张|次|血|真元|防御|护甲|寿元|生命|伤害|毒性|毒刺|血煞|命势))?)/g, '<strong class="combat-key-number">$1</strong>');
  }).join("");
}

function getEffectiveCardCost(card) {
  const reduction = Math.max(0, game?.player?.nextCardCostReduction || 0);
  return Math.max(0, card.cost - reduction);
}

function getCardBlockReason(card) {
  const values = getCardValues(card);
  if (game.player.energy < getEffectiveCardCost(card)) return "真元不足";
  const bloodCost = values.bloodCost || card.bloodCost || 0;
  const lifespanCost = values.lifespanCost || card.lifespanCost || 0;
  if (bloodCost && game.player.blood < bloodCost) return `需要 ${bloodCost} 层血煞`;
  if (lifespanCost && game.player.lifespan < lifespanCost) return "寿元不足";
  if (card.key === "borrowLife" && game.player.hp <= values.selfDamage) return "生命不足";
  // V0.9.47：龙化期间龙鳞归 0 且无法再获得，若仍禁用则蜕骨蛊在爆发窗口彻底死牌卡手（玩家反馈）。
  // 改为龙化期间免龙鳞消耗、始终可打（详见出牌逻辑）；仅未化形且龙鳞不足时才禁用。
  if (values.scaleCost && (!isDragonHero() || (!game.dragon.transformed && game.dragon.scale < values.scaleCost))) {
    return `需要 ${values.scaleCost} 枚未化形龙鳞`;
  }
  return "";
}

function playUiSfx() {
  window.AudioManager?.playSfx?.("uiClick", { volumeScale: 0.42 });
}

/* ===== PERF-1 性能模式（TapTap 玩家反馈卡顿）：auto=低端机自动省电 / lite=强制省电 / full=全效。
 * 省电只砍常驻装饰合成层（标题动画/余烬/雾/纸纹覆膜），战斗数值与信息展示零影响。 ===== */
const PERF_MODE_KEY = "nmg.perfMode";
const PERF_FRAME_SAMPLE_COUNT = 18;
const PERF_FRAME_SAMPLE_TIMEOUT_MS = 1800;
let perfModeSetting = "auto";
let autoPerfDecision = { mode: "full", reason: "设备信息待测", frameMs: 0, sampleFrames: true };
let autoPerfSampleGeneration = 0;
let autoPerfSampleRunning = false;
let autoPerfSampleComplete = false;

function classifyAutoPerformance(signals) {
  signals = signals || {};
  const deviceMemory = Math.max(0, Number(signals.deviceMemory) || 0);
  const hardwareConcurrency = Math.max(0, Number(signals.hardwareConcurrency) || 0);
  if (signals.saveData === true) return { mode: "lite", reason: "系统已开启省流量", frameMs: 0, sampleFrames: false };
  if (signals.reducedMotion === true) return { mode: "lite", reason: "系统偏好减少动态效果", frameMs: 0, sampleFrames: false };
  if (deviceMemory > 0 && deviceMemory <= 4) return { mode: "lite", reason: `设备内存提示 ${deviceMemory}GB`, frameMs: 0, sampleFrames: false };
  if (hardwareConcurrency > 0 && hardwareConcurrency <= 4) return { mode: "lite", reason: `处理器并发提示 ${hardwareConcurrency} 核`, frameMs: 0, sampleFrames: false };
  // V0.9.50 真机兼容根治（玩家反馈"不开省电就无法正常显示/游玩"）：常驻装饰层（雾 filter:blur(70px)/余烬/纸纹 mix-blend）
  // 在弱 GPU 上会把整屏拖崩，而"能否扛住装饰"取决于 GPU，navigator 又不暴露 GPU 能力。
  //   ① 只有【内存≥8G 且 ≥8 核】这种明确高端信号才自动起全效，并用帧采样在"全效实测"下随时降级（降级向，保安全）。
  //   ② 其余一切（规格未知的 WebView、仅报 8 核但 GPU 弱的中端机、6G 机等）一律默认省电，且【不采样上升】——
  //      旧逻辑的致命缺陷：省电下采样必然流畅，会把弱机误判为"可全效"再升上去而崩。省电起步就不再据省电采样误升。
  //   ③ 玩家可随时在设置手动切全效（自负其责）。这样任何机型的默认体验都是已验证可玩的省电态。
  // V0.9.51 用户定调·统一默认省电：高 DPR 真机全效常致卡顿/半屏，而"够力"无法由 navigator 可靠判断(不少游戏机报高规格却仍卡)。
  //   故 auto 一律省电，绝不自动全效；省电只关主页常驻装饰(塔动效/雾/余烬/纸纹覆膜)，战斗打击特效由「战斗特效」开关另管、省电不碰。
  //   想要全效的玩家仍可在设置手动切 full。deviceMemory/hardwareConcurrency 仅保留作诊断"原因"，不再决定档位。
  const hint = (deviceMemory >= 8 && hardwareConcurrency >= 8) ? `设备 ${deviceMemory}G · ${hardwareConcurrency} 核` : "任何机型";
  return { mode: "lite", reason: `统一默认省电(${hint})：仅减主页装饰，战斗特效照旧；设置可手动切全效`, frameMs: 0, sampleFrames: false };
}

function classifyFrameCadence(intervals = []) {
  const valid = intervals
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 5 && value <= 120)
    .sort((left, right) => left - right);
  if (valid.length < 8) return { mode: null, reason: "帧率样本不足", frameMs: 0 };
  const percentileIndex = Math.min(valid.length - 1, Math.floor((valid.length - 1) * 0.75));
  const frameMs = Math.round(valid[percentileIndex] * 10) / 10;
  if (frameMs >= 27) return { mode: "lite", reason: `持续帧间隔约 ${frameMs}ms`, frameMs };
  return { mode: "full", reason: `持续帧间隔约 ${frameMs}ms`, frameMs };
}

function getAutoPerformanceSignals() {
  let reducedMotion = false;
  try { reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true; } catch (e) { reducedMotion = false; }
  return {
    platform: window.NMG_PLATFORM || "web",
    deviceMemory: Number(navigator.deviceMemory) || 0,
    hardwareConcurrency: Number(navigator.hardwareConcurrency) || 0,
    saveData: navigator.connection?.saveData === true,
    reducedMotion,
  };
}

function detectLowEndDevice() {
  return classifyAutoPerformance(getAutoPerformanceSignals()).mode === "lite";
}
function isPerfLite() {
  if (perfModeSetting === "lite") return true;
  if (perfModeSetting === "full") return false;
  return autoPerfDecision.mode === "lite";
}
function applyPerfMode() {
  document.body.classList.toggle("perf-lite", isPerfLite());
  if (typeof syncTitleSceneLive === "function") syncTitleSceneLive();
  const label = { auto: `自动 · 当前${isPerfLite() ? "省电" : "全效"}`, lite: "省电", full: "全效" }[perfModeSetting] || "自动";
  if (dom.settingsPerfToggle) dom.settingsPerfToggle.textContent = `性能模式：${label}`;
}

function resetAutoPerformanceDecision() {
  autoPerfSampleGeneration += 1;
  autoPerfSampleRunning = false;
  autoPerfSampleComplete = false;
  autoPerfDecision = classifyAutoPerformance(getAutoPerformanceSignals());
}

function cancelAutoPerformanceSample() {
  autoPerfSampleGeneration += 1;
  autoPerfSampleRunning = false;
}

function scheduleAutoPerformanceSample() {
  if (perfModeSetting !== "auto" || !autoPerfDecision.sampleFrames || autoPerfSampleRunning || autoPerfSampleComplete) return;
  if (document.visibilityState === "hidden" || typeof window.requestAnimationFrame !== "function") return;
  autoPerfSampleRunning = true;
  const generation = ++autoPerfSampleGeneration;
  const intervals = [];
  let previousTimestamp = 0;
  let frameId = 0;
  let timeoutId = 0;
  let settled = false;
  const finish = () => {
    if (settled || generation !== autoPerfSampleGeneration) return;
    settled = true;
    autoPerfSampleRunning = false;
    if (frameId && window.cancelAnimationFrame) window.cancelAnimationFrame(frameId);
    if (timeoutId) window.clearTimeout(timeoutId);
    const cadence = classifyFrameCadence(intervals);
    if (!cadence.mode) {
      autoPerfDecision = { ...autoPerfDecision, reason: `${autoPerfDecision.reason}；${cadence.reason}` };
      applyPerfMode();
      return;
    }
    autoPerfSampleComplete = true;
    autoPerfDecision = { ...cadence, sampleFrames: false };
    applyPerfMode();
  };
  const sampleFrame = (timestamp) => {
    if (generation !== autoPerfSampleGeneration || perfModeSetting !== "auto") return;
    if (document.visibilityState === "hidden") {
      cancelAutoPerformanceSample();
      return;
    }
    if (previousTimestamp > 0) intervals.push(timestamp - previousTimestamp);
    previousTimestamp = timestamp;
    if (intervals.length >= PERF_FRAME_SAMPLE_COUNT) {
      finish();
      return;
    }
    frameId = window.requestAnimationFrame(sampleFrame);
  };
  frameId = window.requestAnimationFrame(sampleFrame);
  timeoutId = window.setTimeout(finish, PERF_FRAME_SAMPLE_TIMEOUT_MS);
}

function getPerformanceDebugText() {
  const frameText = autoPerfDecision.frameMs > 0 ? `${autoPerfDecision.frameMs}ms` : "待测";
  return `性能诊断：设置 ${perfModeSetting} / 当前 ${isPerfLite() ? "省电" : "全效"} / 原因 ${autoPerfDecision.reason} / 帧间隔 ${frameText}`;
}

function initPerfMode() {
  let stored = null;
  try { stored = localStorage.getItem(PERF_MODE_KEY); } catch (e) { stored = null; }
  if (stored === "lite" || stored === "full" || stored === "auto") perfModeSetting = stored;
  if (perfModeSetting === "auto") resetAutoPerformanceDecision();
  applyPerfMode();
  if (!stored && isPerfLite()) {
    showCoachTip("perfLiteAuto", "已默认省电模式以确保任何机型都能流畅正常显示（仅减少画面装饰，玩法与信息零影响）；设备够力可在设置里改为全效。");
  }
  scheduleAutoPerformanceSample();
  // 页面转后台：暂停一切动画——省电，回前台不掉帧
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("page-hidden", document.hidden);
    if (document.hidden) cancelAutoPerformanceSample();
    else scheduleAutoPerformanceSample();
  });
}
function cyclePerfMode() {
  perfModeSetting = perfModeSetting === "auto" ? "lite" : (perfModeSetting === "lite" ? "full" : "auto");
  try { localStorage.setItem(PERF_MODE_KEY, perfModeSetting); } catch (e) { /* 存储不可用则本次会话生效 */ }
  cancelAutoPerformanceSample();
  if (perfModeSetting === "auto") resetAutoPerformanceDecision();
  applyPerfMode();
  scheduleAutoPerformanceSample();
}

function initEffectSettings() {
  // 视觉特效只影响表现，不参与任何战斗数值；设置持久化到 localStorage。
  try {
    const stored = localStorage.getItem(EFFECT_STORAGE_KEY);
    effectsEnabled = stored !== "false";
  } catch {
    effectsEnabled = true;
  }
  updateEffectControls();
  if (typeof updatePrologueMotionMode === "function") updatePrologueMotionMode();
}

function updateEffectControls() {
  document.body.classList.toggle("effects-off", !effectsEnabled);
  if (!dom.effectToggle || !dom.effectStatus) return;
  dom.effectToggle.setAttribute("aria-pressed", String(effectsEnabled));
  dom.effectToggle.classList.toggle("is-off", !effectsEnabled);
  dom.effectStatus.textContent = effectsEnabled ? "开" : "关";
  if (dom.settingsEffectToggle) dom.settingsEffectToggle.textContent = `战斗特效：${effectsEnabled ? "开" : "关"}`;
}

function setEffectsEnabled(enabled) {
  effectsEnabled = Boolean(enabled);
  try {
    localStorage.setItem(EFFECT_STORAGE_KEY, effectsEnabled ? "true" : "false");
  } catch {
    // 本地存储不可用时仍允许本次页面内切换，不影响游戏运行。
  }
  if (!effectsEnabled) clearEffectLayerOnly();
  updateEffectControls();
  if (typeof updatePrologueMotionMode === "function") updatePrologueMotionMode();
  if (typeof syncTitleSceneLive === "function") syncTitleSceneLive(); // V0.9.38 标题画动效随开关联动
}

function toggleVisualEffects() {
  setEffectsEnabled(!effectsEnabled);
}

/* ===== V0.9.38 血月塔影：标题画动效 =====
 * 蛊萤绕塔（前后双元素过塔身真遮挡）+ 命线流光爬塔 + 覆盖式定尺寸。
 * 关键帧全部按固定参数生成（确定性、零随机，不触碰种子 RNG）；
 * 动画统一由 .ts-live 门控——战斗特效开关关闭时标题画退化为静态版。 */
const TITLE_SCENE_EMBERS = [
  { x: "38%", s: "4px", c: "#ffb26a", g: "rgba(255,170,100,.7)", d: "8.5s", dl: "0s", dx: "22px", o: ".95" },
  { x: "45%", s: "3px", c: "#ff7a48", g: "rgba(255,110,70,.7)", d: "11s", dl: "1.8s", dx: "-16px", o: ".8" },
  { x: "52%", s: "4px", c: "#ffc27e", g: "rgba(255,180,110,.7)", d: "7.5s", dl: "3.4s", dx: "26px", o: "1" },
  { x: "57%", s: "3px", c: "#ff8352", g: "rgba(255,120,75,.65)", d: "10s", dl: "1.1s", dx: "-20px", o: ".75" },
  { x: "63%", s: "5px", c: "#ffd190", g: "rgba(255,190,120,.8)", d: "6.8s", dl: "2.5s", dx: "16px", o: "1" },
  { x: "70%", s: "4px", c: "#ffb26a", g: "rgba(255,170,100,.75)", d: "8s", dl: "0.6s", dx: "24px", o: ".95" },
  { x: "74%", s: "3px", c: "#ffc27e", g: "rgba(255,180,110,.6)", d: "10.5s", dl: "4.3s", dx: "-18px", o: ".8" },
  { x: "79%", s: "4px", c: "#ff8352", g: "rgba(255,120,75,.7)", d: "9s", dl: "2.2s", dx: "18px", o: ".9" },
  { x: "84%", s: "3px", c: "#ffb26a", g: "rgba(255,170,100,.6)", d: "11.5s", dl: "6s", dx: "-14px", o: ".7" },
  { x: "89%", s: "4px", c: "#ffd190", g: "rgba(255,190,120,.7)", d: "8.8s", dl: "3.9s", dx: "22px", o: ".9" },
  { x: "24%", s: "3px", c: "#ff9a5e", g: "rgba(255,150,90,.55)", d: "13s", dl: "2.9s", dx: "12px", o: ".6" },
  { x: "12%", s: "3px", c: "#ffb26a", g: "rgba(255,170,100,.5)", d: "14s", dl: "6.8s", dx: "-10px", o: ".55" },
  { x: "95%", s: "3px", c: "#ff8352", g: "rgba(255,120,75,.55)", d: "12.5s", dl: "1.5s", dx: "14px", o: ".65" },
  { x: "31%", s: "3px", c: "#ffc27e", g: "rgba(255,180,110,.5)", d: "12s", dl: "8.1s", dx: "16px", o: ".6" },
  { x: "60%", s: "3px", c: "#ffb26a", g: "rgba(255,170,100,.6)", d: "9.6s", dl: "5s", dx: "-15px", o: ".75" },
  { x: "76%", s: "5px", c: "#ffd190", g: "rgba(255,190,120,.75)", d: "7.2s", dl: "7.2s", dx: "20px", o: ".95" },
];

function sizeTitleScene() {
  const scene = document.getElementById("titleScene");
  if (!scene) return;
  // 16:9 覆盖框：短边溢出裁切，层内百分比坐标（蛊萤/流光）始终对齐画面
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;
  const w = Math.ceil(Math.max(vw, vh * (16 / 9)));
  const h = Math.ceil(w * 9 / 16);
  scene.style.width = `${w}px`;
  scene.style.height = `${h}px`;
  // 聚焦塔月（画面 x≈62%、y≈45%）：竖屏/超窄窗裁切时保住主体，且始终完整覆盖视口
  const left = Math.min(0, Math.max(vw - w, Math.round(vw * 0.5 - w * 0.62)));
  const top = Math.min(0, Math.max(vh - h, Math.round(vh * 0.5 - h * 0.45)));
  scene.style.left = `${left}px`;
  scene.style.top = `${top}px`;
  scene.style.transform = "none"; // 覆盖 CSS 兜底的居中 translate
}

function syncTitleSceneLive() {
  const scene = document.getElementById("titleScene");
  if (scene) scene.classList.toggle("ts-live", Boolean(effectsEnabled) && !(typeof isPerfLite === "function" && isPerfLite()));
}

function initTitleSceneAmbience() {
  const scene = document.getElementById("titleScene");
  const flyBack = document.getElementById("titleFlyBack");
  const flyFront = document.getElementById("titleFlyFront");
  const emberHost = document.getElementById("titleEmbers");
  if (!scene || !flyBack || !flyFront || !emberHost) return;
  sizeTitleScene();
  window.addEventListener("resize", sizeTitleScene);
  window.addEventListener("orientationchange", () => window.setTimeout(sizeTitleScene, 120)); // 部分安卓WebView只发orientationchange
  syncTitleSceneLive();
  emberHost.innerHTML = TITLE_SCENE_EMBERS.map((e) =>
    `<i style="--x:${e.x};--s:${e.s};--c:${e.c};--g:${e.g};--d:${e.d};--dl:${e.dl};--dx:${e.dx};--o:${e.o}"></i>`).join("");
  // ---- 生成蛊萤/流光关键帧（与标题画中缠塔命线同参数） ----
  const CX = 0.660, YB = 0.735, YT = 0.115;
  const halfW = (t) => 0.054 - t * (0.054 - 0.016);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  let css = "";
  for (let k = 0; k < 8; k++) {
    const dur = 13 + ((k * 37) % 17) * 0.5;
    const revs = 1.8 + ((k * 13) % 5) * 0.35;
    const ph = k * 0.83 + ((k * 7) % 3) * 0.3;
    const rf = 1.5 + ((k * 11) % 4) * 0.3;
    let fx = "", bx = "";
    const STEPS = 40;
    for (let j = 0; j <= STEPS; j++) {
      const t = j / STEPS;
      const th = ph + t * Math.PI * 2 * revs;
      const s = Math.sin(th);
      const x = (CX + Math.cos(th) * (halfW(t) * rf + 0.008)) * 100;
      const y = (YB - (YB - YT) * t) * 100;
      const endFade = t < 0.05 ? t / 0.05 : (t > 0.93 ? Math.max(0, (1 - t) / 0.07) : 1);
      const frontVis = clamp01((s + 0.12) / 0.34);
      const scale = (0.7 + 0.35 * Math.max(0, s)).toFixed(3);
      const pct = (t * 100).toFixed(2);
      const tf = `translate3d(${x.toFixed(2)}%,${y.toFixed(2)}%,0) scale(${scale})`;
      fx += `${pct}%{transform:${tf};opacity:${(frontVis * endFade).toFixed(3)};}`;
      bx += `${pct}%{transform:${tf};opacity:${((1 - frontVis) * endFade * 0.8).toFixed(3)};}`;
    }
    css += `@keyframes tsBugF${k}{${fx}}@keyframes tsBugB${k}{${bx}}`;
    css += `.ts-live .tsBugF${k}{animation:tsBugF${k} ${dur}s linear infinite;animation-delay:-${(k * dur / 8).toFixed(2)}s;}`;
    css += `.ts-live .tsBugB${k}{animation:tsBugB${k} ${dur}s linear infinite;animation-delay:-${(k * dur / 8).toFixed(2)}s;}`;
  }
  // 流光：地面命线（Catmull-Rom）→ 缠塔螺旋 → 塔尖熄灭
  const GROUND = [[-0.02, 0.985], [0.16, 0.925], [0.30, 0.955], [0.435, 0.875], [0.545, 0.905], [0.615, 0.845], [0.660, 0.741]];
  const pts = [];
  for (let i = 0; i < GROUND.length - 1; i++) {
    const p0 = GROUND[Math.max(0, i - 1)], p1 = GROUND[i], p2 = GROUND[i + 1], p3 = GROUND[Math.min(GROUND.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.25) {
      const t2 = t * t, t3 = t2 * t;
      pts.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        1,
      ]);
    }
  }
  const SREVS = 2.75, SPH = Math.PI * 0.9;
  for (let j = 0; j <= 30; j++) {
    const st = j / 30;
    const th = SPH + st * Math.PI * 2 * SREVS;
    pts.push([CX + Math.cos(th) * (halfW(st) * 1.38 + 0.006), YB - (YB - YT) * st, clamp01((Math.sin(th) + 0.12) / 0.34)]);
  }
  let sfx = "", sbx = "";
  for (let j = 0; j < pts.length; j++) {
    const frac = j / (pts.length - 1);
    const pct = (frac * 88).toFixed(2);
    const p = pts[j];
    const tf = `translate3d(${(p[0] * 100).toFixed(2)}%,${(p[1] * 100).toFixed(2)}%,0)`;
    const glow = 0.5 + frac * 0.5;
    sfx += `${pct}%{transform:${tf};opacity:${(p[2] * glow).toFixed(3)};}`;
    sbx += `${pct}%{transform:${tf};opacity:${((1 - p[2]) * glow).toFixed(3)};}`;
  }
  sfx += "90%{opacity:0;}100%{opacity:0;}";
  sbx += "90%{opacity:0;}100%{opacity:0;}";
  css += `@keyframes tsSparkF{${sfx}}@keyframes tsSparkB{${sbx}}`;
  css += ".ts-live .tsSparkF{animation:tsSparkF 10.5s linear infinite;}.ts-live .tsSparkB{animation:tsSparkB 10.5s linear infinite;}";
  css += ".ts-live .ts-tail1{animation-delay:0.16s;}.ts-live .ts-tail2{animation-delay:0.32s;}";
  const styleEl = document.createElement("style");
  styleEl.id = "titleSceneKeyframes";
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  for (let k = 0; k < 8; k++) {
    const b = document.createElement("div");
    b.className = `ts-fly ts-bug tsBugB${k}`;
    b.innerHTML = "<i></i>";
    const f = document.createElement("div");
    f.className = `ts-fly ts-bug tsBugF${k}`;
    f.innerHTML = "<i></i>";
    flyBack.appendChild(b);
    flyFront.appendChild(f);
  }
  [["ts-spark-head tsSparkF", flyFront], ["ts-spark-head tsSparkB", flyBack],
   ["ts-spark-tail tsSparkF ts-tail1", flyFront], ["ts-spark-tail tsSparkB ts-tail1", flyBack],
   ["ts-spark-tail tsSparkF ts-tail2", flyFront], ["ts-spark-tail tsSparkB ts-tail2", flyBack]].forEach(([cls, host]) => {
    const el = document.createElement("div");
    el.className = `ts-fly ${cls}`;
    el.innerHTML = "<i></i>";
    host.appendChild(el);
  });
}

function playCardSfx(card) {
  window.AudioManager?.playSfx?.("cardPlay", { volumeScale: 0.56 });
  window.setTimeout(() => {
    if (card.type === "poison" || card.typeName.includes("毒道")) {
      window.AudioManager?.playSfx?.("poisonApply", { volumeScale: 0.62 });
    } else if (card.category === "defense") {
      window.AudioManager?.playSfx?.("block", { volumeScale: 0.58 });
    } else if (card.category === "attack") {
      const heavy = card.cost >= 2 || card.type === "blood" || stripTags(card.effect).includes("16");
      window.AudioManager?.playSfx?.(heavy ? "hitHeavy" : "hitLight", { volumeScale: heavy ? 0.58 : 0.52 });
    }
  }, 80);
}

// 更新公告（只记正式版本；最新的放最前）。
const UPDATE_LOG = [
  { v: "V0.9.66", title: "蛊斗鸣锋", notes: [
    "蛊斗场大厅重排为身份、模式、匹配、邀请与整备五个独立页面；随机匹配显示等待动画和真实可用的候场信息，邀请房改用双段蛊印并支持原房再战。",
    "六名蛊修补齐三层战斗被动，局内常驻显示蚀毒、被动层数和延迟回元；出牌加入选中确认、打击特效、角色语音、专属音效与六枚原创快捷表情。",
    "斗蛊池二十二只蛊全部使用各自立绘，净瘴、赤牙、瘴孢、玄甲、回春、穿心、夺元与避劫补齐八张原创图；头像昵称授权按钮恢复可见可点。"
  ] },
  { v: "V0.9.65.1", title: "蛊斗显门", notes: [
    "修复 TapTap 宿主能力稍晚注入时首页蛊斗场一直隐藏；入口会在短时窗口内重新探测登录与联机能力。",
    "九转鼎手机横屏不再让直达九转总账溢出遮住炉体；蛊庐操作回执约 1.8 秒后自动收起。"
  ] },
  { v: "V0.9.65", title: "蛊斗争锋", notes: [
    "蛊斗场开放真人公平单挑：可随机匹配，也可创建邀请房并凭房间码加入；双方选择蛊修后使用同规格临时蛊组。",
    "随机匹配胜者获得蛊钱 100 与随机生态异材 1 份；邀请切磋无奖励，胜利奖励按本局标识只结算一次。",
    "换髓重结不再令高转蛊跌转，云档恢复会阻止本命、十重天或成蛊转数倒退；手机手牌改为可读横滑卡带，蛊囊支持长按拖动排序。"
  ] },
  { v: "V0.9.64", title: "双命共斗", notes: [
    "两名蛊修都准备后会自动进入无奖励的“双命试战”，轮流催动三种蛊术共击双首尸螟。",
    "联机战斗改由房主统一裁定并广播状态，另一端只提交出手意图，避免两台手机各自结算产生分歧。",
    "头像昵称原生授权层在连接、匹配和开战时会主动销毁并透明挂载，不再以巨大红字覆盖联机大厅。"
  ] },
  { v: "V0.9.63.1", title: "准备回响热修", notes: [
    "修正 TapTap 双人房准备接口的数据字段，解决点击准备后提示 data is invalid。",
    "同步兼容 TapTap 官方准备状态回调结构，双方现在可正确看到彼此的准备状态。",
    "本热修仍只验证联机链路，不进入战斗、不结算奖励，也不改动单人存档。"
  ] },
  { v: "V0.9.63", title: "双命初联", notes: [
    "TapTap 版首页新增“双命联机”入口：先登录，再连接联机服务，随后两台手机可进入同一双人房。",
    "双人房现支持玩家进出、准备状态与“同频回声”消息互通，用来验证两端身份、房间与通信链路。",
    "本阶段不进入战斗、不结算奖励，也不改动单人存档；普通网页环境不会显示联机入口。"
  ] },
  { v: "V0.9.62", title: "异蛊归一", notes: [
    "新增劫息蜉蝣、回霆玄蜓、赤汐刃蛭、燎命砂蝎与枯桑驮碑五种合练蛊，均有一至九转真实成长与独立立绘。",
    "五道新方各自保留两只原蛊的核心机制，并按旧煞、实际焚寿、有限雷序、劫灰封顶与尸傀免疫等规则阻断伪收益。",
    "合蛊坛现有 43 道同转配方；万蛊录同步补齐五种产物的栖地、食性、性情、相济与克制资料。"
  ] },
  { v: "V0.9.61", title: "万蛊相克", notes: [
    "新增赤汐蛊、燃命蝎、沧桑龟：分别以真实耗煞、真实焚寿与有限衰老构筑，均有一至九转成长和独立立绘。",
    "血食、腐生、甲壳、尸傀等敌人生态标签进入战斗状态栏，可点查克制条件；每种克制每回合最多触发一次。",
    "生态克制的次数、额外伤害与蚀甲会进入本局统计、结算摘要和复制反馈，规则与结果都可追溯。"
  ] },
  { v: "V0.9.60", title: "生态入局", notes: [
    "新增长息蛊、连霆蛊、劫灰蛊：分别围绕手牌周转、类别雷序与主动弃牌／消耗构筑，均有一至九转真实成长与独立立绘。",
    "新增瘴苔囊、血沼髓、风化骨盐、玄巢蜡四类生态异材，可从对应栖地战、凶煞与机缘中获得，并在离塔后带回蛊庐。",
    "百蛊市新增每日生态异材轮换、生态定向落卵与匹配温养，让万蛊录中的栖地关系正式进入收集和养成循环。"
  ] },
  { v: "V0.9.59.2", title: "轻赏定锚", notes: [
    "蛊庐使用或投喂物品后会保留手机横屏左栏的原有滚动位置，不再自动跳回顶部。",
    "十处自愿激励入口统一缩成按内容自适应的小卡片；奖励、次数与触发规则不变。",
    "孵化说明补清基础通用蛊与高级通用蛊：两者分别使用常用／进阶牌池，并标明起始转数、局内上限及流派蛊来源。",
    "蛊庐新增一级入口合蛊坛，独立承接 38 道异种同转合练方；九转鼎只保留同名升转。合练谱可按攻击、防御、辅助筛选。",
    "局内炼蛊升转变化全部改用中文效果名，候选卡可独立上下滑动查看完整说明，不再露出内部英文字段或裁掉末行。",
    "纠正战后选牌旧提示：重复蛊只显示牌组已有数量；局内炼蛊消耗材料强化单张蛊，不存在两张同名蛊合练。",
    "手机横屏丹囊改为单行横滑；遗物与战斗状态栏、顶部材料栏均可一键收起，内容再多也不会挤掉战斗空间。",
  ] },
  { v: "V0.9.59.1", title: "孵化重整", notes: [
    "万蛊录只按通用蛊、流派蛊、合练蛊分类；颜色只表示攻击、防御、辅助与合练定位，不再兼用品质含义。",
    "蛊庐拆为基础与道脉两条孵化路线，各自使用四种材料；两线材料互不替代，可以同时积攒。",
    "每条路线都有次品与精品：同路线战斗属性、喂养道行和风险相同，精品只在五转后提供升转成功率 +8%。",
    "桌面蛊圃改为宽卡两列，手机横屏改为三列内部滚动；凝质、换髓、护命、兑换码和九转鼎提示同步新口径。",
  ] },
  { v: "V0.9.59", title: "异蛊显形", notes: [
    "九转鼎 34 道合练方对应的 31 种结果全部拥有独立立绘；万蛊录不再拿原料蛊图片代替合练异蛊。",
    "六只本命蛊补齐六至九转共 24 张连续进化立绘；高转不再显示空图或重复低转形态，元进度规则与战斗数值不变。",
    "蛊庐成蛊可直接查看真实效果，并会补录万蛊录；资源蛊高转按伤害或防御继续成长，不再出现升转无收益。",
    "九转鼎升转成功与失败都改为中央仪式演出，结果、转数变化和保底积累一眼可见。",
    "修复少数新设备把云端老档误判为新号；兑换码现可直接补发指定蛊虫，并保留领取回执。",
    "TapTap 横屏材料、角色立绘与手牌区域重新适配；广告入口数量不变，只有整局结算奖励限制为每局一次。",
    "万蛊录只按通用蛊、流派蛊、合练蛊分类；颜色统一为攻红、守蓝、辅绿、合练紫，不再拿颜色表示品质。",
    "百蛊市双生对髓固定产出同名三转蛊卵，不再复制高转样本，堵住快速堆九转的漏洞。",
    "孵化分为基础与道脉两条并列路线，各自消耗四种不同材料；每线分次品与精品，同路线战斗属性和道行相同，精品从四转升五转起提高升转成功率。",
  ] },
  { v: "V0.9.58", title: "泉鸣归庐", notes: [
    "毒修反制重做：毒抗每次最多抵去 2 层，青蟒触发蚀毒可逐步破抗；瘴林普通敌人不再同时叠多种反毒机制。",
    "吞毒从回合末自动清空改为可见敌方行动：占用一次攻击，只吞固定阈值，超过阈值的余毒继续发作；转毒补齐阈值与冷却提示。",
    "十处自愿激励入口已恢复：九处在场景仍满足时可重复观看；只有整局结算收获每局一次。主动观看，完整看完才发放。",
    "百蛊市合并同效果的单份与礼包货品：残核、引火砂和双生髓只保留批量装；材料保留“全材料各一”和“自选一种五份”两种不同用途，旧存档里的旧库存字段会被安全忽略。",
    "修温养圆满加成只写在说明里、没有进入九转鼎结算：现在鼎内牌面、入炉确认与真实掷骰统一增加 8%，并继续受 95% 上限约束。",
    "百蛊市补货只补写明的售罄货品；蛊卵立即破壳、蛊钱 +6、日课材料、灵泉与温养等入口均按当前对象状态结算。",
    "养蛊室有了独立曲与灵泉滴水声；在蛊圃、九转鼎、养蛊室和百蛊市之间切换时，背景音乐与环境音会随场景正确交接。",
    "修局外领取弹窗偶尔显示英文色调键；元髓露立凝、蛊虫温养与灵泉升级现在都会给出真实的中央回执。",
    "登天榜未解锁时不再从首页消失，会直接写明通关任意路线的开放条件；解锁后原位可点。",
    "修局内炼蛊后两首背景音乐重叠：炼化过程只播放短鼎震与成败音效，战斗曲会保持唯一。",
    "修无尽排行榜仍加载旧接口快照；公共榜可正常读取，本人尚未报分时会显示空记录，不再误报整榜失败。",
    "闻铃新增「镇魂律 / 断命律」双路线；结算、反馈与叩铃日志会分别写明本命路线和实际动作。手机横屏路线卡选定后收为短签。",
    "九转鼎一至四转升转稳炼必成；四转升五转起失败保留目标，每次给该蛊积累下次成功率 +12%，固蛊符在失败时护回残核与蛊胎。",
    "资源蛊不再高转白升，也不会恢复无限产能：真元、抽牌、降费等仍在安全断点封顶；之后每转改加本蛊定位对应的伤害或防御，升转预览会写清本次所得。",
    "无名逆命者保留每回合最多两次命势圆满；三相织命首次凑齐三类牌、噬签改命完成取舍时各得 3 点防御，并修正了三类牌其实顺序不限的说明。",
    "随行蛊会保留真实转数、温养与上限；活动本局的 source 蛊在喂养、收纳、换髓、合练与入鼎时统一受保护。",
    "骨铃蛊、乱蜂蛊与血沼蛊现为真实可得蛊牌；万蛊录同步开放命途异闻与流派源流，不再只摆空分类。",
    "九转鼎开放七道异蛊合练明方：两只不同种、同转、非随行成蛊必成一只同转异蛊，未知组合不会吞蛊。",
  ] },
  /* V0.9.57 文案精简：本版公告原为 17 条 1609 字（全库平均每条 57 字，本版却写到 95）。
   * 公告是给玩家看「改了什么、对我有何影响」的，不是开发记录——
   * 砍掉「为什么这么改」的推演与内部数据，只留结论与可感知的变化。现 17 条 856 字。 */
  { v: "V0.9.57", title: "入塔有引", notes: [
    "修（玩家实报，OPPO R11 Plus 一类窄横屏）：整备页的本命蛊路线卡文字被从半行处切断，「五转强化」「适合」两条整个看不见；蛊庐里本命蛊祭坛压住材料条与第五圃。两处都已修好——路线卡改为逐条留头带省略号、长按可看全文，蛊庐左右两栏不再互相越界。",
    "三个新的自愿广告位：灵泉立凝一滴、温养立刻一轮（不耗元髓露）、百蛊市补一件售罄的货。都是你自己想点才点，不会自动弹；灵泉储量满时按钮自动收起，货架也只对真正售罄的那件开放。",
    "蛊庐新开「养蛊室」：蛊虫终于有了「养」这一层。中央一眼幽碧灵泉按真实时间凝出元髓露（关掉游戏也在凝，满了会冒泡等你来收）；泉边十二个收纳位存放暂时用不上的成蛊——收纳中的蛊不占蛊圃，但不能随行、不能喂本命蛊、也不能作炉料，要用先取出。以元髓露温养，蛊身会一点点浸出水光，温养圆满者入炉成功率 +8。灵泉可凿深至五级，越深出露越快、能存越多。",
    "酒虫削顶：旧版指数叠层已改为 ×2/×2.5/×3。攒满仍是最重的一击，但不再一击抹平难度；卡面也照实写清了层数与倍率。",
    "手机横屏整备页瘦身：契约卡由 189 像素压到 100，选择页不再需要长滑，五行信息一行没少。",
    "契约代价改为赤色醒目标注，并写明「签下后整局不可更改」——不必等签完才发现这局进不了蛊坊。",
    "修：从蛊坊进入临门残卷时，坊市面板没收起、与选牌页叠在一起。",
    "堵漏：离塔兑换蛊钱改按「本局净赚的蛊石」折算。此前秒开一局再立刻收手，一颗蛊石没赚也能白拿 4 枚，几分钟可刷上百；正常推进的收益不变。",
    "遗物 34 → 42 枚，补在最薄的通用池与龙裔：磨蛊石（本场首击 +4 伤害）、空瓢（开场真元 +1）、缀甲线（防御清零留 2 点）、余烬袋（战后回 4 血）、鳞屑囊（开场龙鳞 +1）、龙脉核（龙形每回合真元 +1）、烬灯（本场首次焚寿得 5 防御）、织结（本场首次命势圆满多抽 1 张）。",
    "奇遇 11 → 20 条，跑图不再总是同几张脸。",
    "百蛊市新添五件：残核匣·三枚装、砂囊（引火砂×3）、双生对髓（一次结两枚同名同转卵）、百草囊（自选材料×5）、破壳锥（指定蛊卵立即破壳）。前四件为打包折价，九转鼎备料不必再按周攒。",
    "五位蛊修的专属机缘各由 1 条增至 3 条，每人的机缘池 12 → 23 条。",
    "九转鼎通过率上调：六转以后由 70/60/50/40 提到 80/72/64/56，裸炼五转到九转的成算由 8% 升至 21%，每步投一份引火砂近五成。引火砂日限 3→5。",
    "百蛊市新开「印记阁」：通关印与天印可折算成蛊钱，每枚只兑一次，兑过的仍留在列表里。天印按重数结算，登得更高可补兑差额。",
    "新手引导补齐：九转鼎、蛊庐、百蛊市第一次打开时各讲一句「这是干什么的」，不再让你自己猜。",
    "战后选牌会标出牌组里已有的同名蛊数量，帮助判断重复取牌是否会让牌组臃肿。局内炼蛊只消耗材料强化单张蛊，不消耗重复牌。",
    "蛊圃孵卵按钮改为「任意材料×N」，并说明材料不分种类、按总数扣。",
    "敌人意图与回合交替改在你第一次真遇上时讲，不再堆在开局。",
    "修：无尽登塔从第二层起，坊市全都顶着上一层的「已交易」，等于整座作废。现已按层重开。",
    "修：局外提示浮层此前被蛊庐等全屏界面盖住，手机上等于没提示。",
  ] },
  { v: "V0.9.56", title: "登天有榜", notes: [
    "登天榜移到主界面第一层：未解锁时也会显示入口与通关条件；通关任意路线解锁无尽后即可直接查看名次，不必再进模式选择页或等结算。",
  ] },
  { v: "V0.9.55", title: "炉火归位 · 平衡校正", notes: [
    "炼蛊规则调整：炼化只提升「一下打得更重」的数值（伤害、防御、疗愈、毒性等），不再提升「一回合打得更多」的数值（真元、抽牌、每张追加等）。此前两类共用同一条成长线，导致真元一路滚到几十点、群蛊噬单张打出两百余伤，塔再深也构不成威胁。战力蛊完全不受影响。",
    "炼蛊前先告诉你值不值：局内炼蛊选卡时每张蛊都会写出「下一转」的具体数值变化；资源产能封顶后会改列伤害或防御成长。九转鼎同理，并给出一转到九转的完整数值阶梯。",
    "无尽登塔重做曲线：压力改为越深每层涨得越多（每十层加一档），奖励取消原本第 41 层就撞上的封顶、改为持续增长但增速递减——越深越险，也越有奔头。",
    "移除死劫模式。十重天改由「通关任意路线」解锁，不再需要死劫金印；已得的金印保留为历史印记，进行中的死劫续局可照常打完。",
    "九转鼎配齐专属音效：投料、鼎震、功成、符护、化灰各有其声，盲听即可分辨结果。",
    "修敌人「提线自护」一类防御意图显示「造成 NaN 点伤害」，且这类敌人的护甲此前从未真正生效——现已按设定叠甲。",
    "修手机横屏下每日点卯、随行加持、本命蛊形态全览、藏册滑动先后消失的问题。",
    "攻击蛊补一条炼化材料路：锐骨晶现同样适用于攻击蛊。",
    "包体瘦身：清掉约 19MB 从未被加载的音频残件，另压缩两首过大的场景曲。",
  ] },
  { v: "V0.9.54", title: "鼎火沉浸 · 无尽修复", notes: [
    "九转鼎改为中央大鼎炉台：八段炉方围鼎排列，炉险、库存与待炼成蛊首屏可见；确认入炉后依次播放投料、炼化与炼后演出，功成、符护、化灰各有不同反馈。",
    "修复蛊圃与九转鼎页签来回切换时背景音乐不换；百蛊市在手机横屏可用手指正常上下滑动，页面外层不跟着滚。",
    "炉险正式接入引火砂与固蛊符：确认层会显示成功率、投入和失败后果，所有数值仍由同一套炉方规则结算。",
    "无尽模式补齐战斗后奖励、路线推进、主动收手与排行榜状态；局外领取统一为屏幕中央回执，局内状态可点按查看具体效果。",
  ] },
  { v: "V0.9.53", title: "九转鼎 · 合炼至九转", notes: [
    "「炼蛊房」更名「九转鼎」，从蛊庐里独立出来搬上主界面，有自己的炉火音景。",
    "九转鼎采用可达炉方：一转起零失败共需同源蛊 72 只、材料 248、残核 11、蛊胎 6，峰值仅占 8 格；七转起不再要求同名燃料。",
    "天品之上新增蛊格：六转神格、七转皇格、八转祖格。蛊格由转数得来，不额外加数值，是位格与门槛。",
    "修「炼到五转却只按三/四转生效」：随行蛊此前被削回局内炼蛊上限，多炼的转数是白炼。现在炉里炼到几转，入塔就生效几转。",
    "百蛊市新增两货：双生髓（照指定成蛊结一枚同名同转之卵，专解燃料难凑）、蛊胎（六转以上炉方必需）。",
    "蛊庐横屏改版：十格蛊圃排在一屏内，整页不再上下滑动；材料退成一条细带，蛊圃占满主区。",
  ] },
  { v: "V0.9.52", title: "炼蛊房开门 · 蛊圃扩至十 · 稀有孵化修正", notes: [
    "蛊庐新增「炼蛊房」页签（此前升转入口藏在圃卡上，很多蛊修根本没找到）：炉方全表一目了然，庐中成蛊按同名同转归堆，差几只燃料、差多少材料直接写在卡上，够料即可入炉升转，至多五转。",
    "蛊圃由六格扩至十格：基础即开六圃；第七圃通关任意路线辟出，第八/九/十圃随本命蛊六转/七转/九转渐次辟开（皆为元进度，不加战力）。",
    "修正稀有孵化池（玩家实测「桑田、续命、夺寿、回光一只都孵不出来」——不是运气差，是这些蛊此前根本不在孵化池里）：玄品与天品蛊卵现在从「通用稀有＋落卵时所选蛊修的本道专属蛊」中破卵；寿道可出桑田/续命/回光等、龙裔可出蜕骨/行云角等，孵卵按钮上会列出完整蛊单。已下的卵按落卵时的蛊修结算，换角色不改口味。",
    "命线图卡死自愈（玩家反馈「进命线图偶尔点不动」）：若转场雾幕滞留不散或本段岔路被全部封死，数秒后自动散雾解封、命线重新可选，不动任何存档进度。",
    "修手机横屏三处显示塌陷：命线图右侧被裁（「查看蛊囊」看不见）、状态栏叠字、战斗顶栏材料条消失。",
  ] },
  { v: "V0.9.51", title: "本命转数改名 · 龙裔调平 · 蛊牌注解", notes: [
    "本命蛊形态改用「转」称呼：蛊卵 → 一转 → 二转 → 三转 → 四转 → 五转。对应旧名：幼虫＝一转、成虫＝二转、真形＝三转、神化＝四转、归墟＝五转；道行阈值与各阶被动一概未动，只换称呼。之所以不用「品」，是因为蛊庐孵出的蛊本就按凡／灵／玄／天品分级，两处同名会混。旧版更新日志里仍写着旧名，看到时按此对照即可。",
    "烬鳞调平（玩家反馈「龙的那个超标」）：化龙所需龙鳞 6 → 7 枚，龙形攻击与防御加成各 +3 → +2，生命上限 62 → 58；化龙时长与额外真元保持不变——削的是「几乎全程龙形」的密度，不削化龙那一下的爆发。",
    "本命遗物补第五枚「蕴鳞瓮」：每场战斗开局获得 2 枚龙鳞；非龙裔蛊修改为获得 4 点防御。开局遗物由四选一变五选一。",
    "局内蛊牌详情补注解（玩家反馈「蛊虫详情注解不清晰」）：蛊囊里点开任意蛊牌，除战斗效果外还会显示一句话说明与相济 / 相克，并可一键直达万蛊录看生态习性与来历全解。",
    "移除录屏模式与「录屏演示模式」试炼档：此功能只用于开发期录制，对玩家无用。原先选了该档的存档会自动回落为正常模式，不影响任何进度。",
  ] },
  { v: "V0.9.50", title: "七处自愿激励 · 不限次数", notes: [
    "「看广告 · 续命一次」仅在生命归零（非寿尽）、且已打通至少一场之后出现，完整观看可回复三成生命、续战本局；不再限制每局次数。塔心母盘终局战不提供。",
    "普通战「看广告 · 重抽奖励」在已击败两名以上敌人、尚未选牌时可反复观看并重抽三枚蛊卵牌面，蛊石与丹囊照旧保留。",
    "蛊庐「立即破壳」、日课材料再领与百蛊市「领 6 蛊钱」均解除每日/每卵次数门禁；只要入口自身条件仍成立，每次完整观看都发一次奖励。",
    "七处激励入口（含战前加持与结算收获再领）全部不限观看次数，仍只由玩家主动点击、完整观看才发奖；非 TapTap 环境（网页版）不会出现广告入口，玩法零影响。",
  ] },
  { v: "V0.9.49", title: "卡顿止血 · 排版归位", notes: [
    "修复部分机型「一登录就卡顿、遮住选择点不动」：①省电模式此前在读不到设备规格的容器里会默认全效、动画全开拖慢弱机——现改为读不到规格先起省电、实测流畅再自动升全效；②动态首页背景层此前会意外拦截点击——已改为完全不吃点击，选择区随时点得动。",
    "修复「临门·残卷馈赠」取卷页面板互相遮挡、排版杂乱：取卷选牌面板打开时会把可能残留的休整/炼炉/材料面板一并收起，不再多面板重叠。",
    "修复蛊炉强化时「选蛊牌显示不全」：横屏下给选卡滑轨保底高度，卡牌的蛊性、上限与效果不再被裁掉。",
  ] },
  { v: "V0.9.48", title: "激励视频复活", notes: [
    "结算「看广告 · 再领本局收获」在 TapTap 版本恢复：此前误用了错误的广告位 ID 导致真机永不填充、按钮不出；经 TapTap 官方核对，已换成正确的横屏激励视频广告位，每次完整观看都可把本局入库材料与道行再领一份。纯自愿、只在你主动点击时播放。",
  ] },
  { v: "V0.9.47", title: "龙化顺手 · 局外看血", notes: [
    "龙化不再卡手：龙化期间蜕骨蛊改为免龙鳞消耗、直接抽 2 张牌并获甲（此前龙化后龙鳞归 0 又无法再攒，蜕骨蛊在爆发窗口是死牌），现在它成了帮你摸攻击牌、加快输出的过牌工具。",
    "龙鳞进度看得见：手机端龙鳞角标改为显示当前枚数（此前恒显示上限 6，看不出攒了几鳞）；攒到「差 1 鳞化龙」时主动提示一次，不用自己盯。",
    "择蛊页显示费用：开局选通用蛊时直接标出每张的真元消耗，不必进局才知道。",
    "命途图显示生命：命线图状态栏新增当前生命/上限，局外（非战斗）也能一眼看到血量。",
  ] },
  { v: "V0.9.46", title: "残卷急修 · 强化归位", notes: [
    "急修：第二、三层「临门·残卷馈赠」节点在极少数续局情形下点击后会卡死在空白命途图——现已让残卷节点无论命途状态如何都能正常打开取卷面板，彻底堵死这一卡点。",
    "蛊炉强化修正：行云角蛊、回光蛊等辅助蛊此前首次 +1 强化后数值无变化（形同白强化）——行云角蛊改为每级额外 +1 龙鳞，回光蛊改为每级少耗 1 点寿元，强化说明同步更新。",
  ] },
  { v: "V0.9.45", title: "烬脉龙蛊 · 古鼎开炉", notes: [
    "烬鳞补齐六阶段本命蛊「烬脉龙蛊」与七张阶段立绘：真形分焚脉、玄甲双路线，后续神化与归墟继续强化所选龙化路线。",
    "炼蛊改为古鼎开炉界面：八类材料在横屏一屏内全部可见，蛊牌改用横向滑轨，并加入炉火、蒸汽、符环与开炉冲击反馈；关闭特效时同步停用动画。",
    "战后炼材新增锐骨晶、寿烬与元髓露；百蛊市奇物行扩至八件实用货品，护命蛊匣上限提高至 2，只能用闯塔结算所得蛊钱换取。",
    "继续压缩开局整备、战后奖励、敌人意图与底部状态栏的信息密度，常见手机及桌面横屏不再依赖页面上下滑动。",
  ] },
  { v: "V0.9.44", title: "移动端战斗与局外养成优化", notes: [
    "移动端手牌支持收起、展开与过渡动画；选中的手牌持续高亮，状态改为紧凑符印横栏，战斗信息不再挤压顶部操作区。",
    "开局整备收束为蛊修、择蛊、遗物、试炼四步；可自选两只不同的通用蛊，等量替换一张月刃蛊与铁皮蛊，专属蛊与起始蛊囊厚度不变。",
    "命途图节点信息改为更直观的类型标识，终段 Boss 增加专属战利品反馈，奖励选择页在横屏首屏内完整呈现。",
    "蛊庐孵化时间整体缩短并增加可解锁孵化位；百蛊市开放定向育蛊与护命蛊匣，局内身死时可保住一只携带的天品蛊。",
  ] },
  { v: "V0.9.42", title: "蛊有其面 · 战斗有声", notes: [
    "四十七张蛊虫立绘登上卡面：手牌、战后奖励、蛊坊与临门选牌不再只是文字方块——你打出的每一只蛊长什么样，一眼可见（与万蛊录同图同源）。",
    "战斗手感补声：命中、重击（单次 12 点以上或暴击）、完全格挡与毒发各有其声——打人有回响，挨打有分量。",
  ] },
  { v: "V0.9.41", title: "蛊修有声 · 四人全语音", notes: [
    "四名蛊修全部开口：选人、入塔、迎战、遇凶煞、对峙 Boss、施展本命核心（焚寿 / 圆满 / 血祭 / 蚀毒）、濒血、回血、胜负与结局，共五十二句专属语音按时机触发。",
    "语音走现有音频通道与音量设置，静音时不发声；同类语音短时间内不重复轰炸，高优先级台词（Boss 对峙、陨落、结局）可打断低优先级。",
    "另含整备页与万蛊录的契约栏渲染提速（低端机点击响应更跟手），以及若干发布链与门禁加固。",
  ] },
  { v: "V0.9.40.1", title: "安卓 App 视口恢复热修", notes: [
    "修复部分安卓应用容器在切换页面或恢复前台后，偶发把短暂异常的小高度锁进布局，导致画面只剩半屏或内容区被压扁的问题。异常尺寸现在不会覆盖上一份正常视口，并会在短时复测中等待真实高度恢复。",
    "安卓套壳在回到前台与重新隐藏系统栏后，会主动通知网页重同步视口；该恢复过程只做有限次数短重试，不改变玩法、存档或数值。",
  ] },
  { v: "V0.9.40", title: "命途契市 · 第一期", notes: [
    "图鉴与挑战达成不再是死胡同：完成一场有效结算（通关、身死或退隐）后，司命人会递上「命途契」——下一局整备的「挑战模式」栏可择一签契，改写一条规则并标明代价，也可以不签。",
    "第一期实装两契：「孤行契」本局蛊坊闭门，作为交换，每次击败凶煞额外直得一枚随机普通遗物；「空囊契」起始蛊囊被抽走四张基础蛊（攻防辅每类至多两张），作为交换，司命人在每一层都必定现身与你交易。",
    "深毒、浊血、先知、短烛、识蛊、逆命六契的契文与解锁条件已在万蛊录新增的「命途契」小节公示，图鉴任务的奖励预告同步兑现为实际契名，后续版本陆续开签。",
    "签契与契约生效点都会写入命途札记；战斗状态条置顶显示所签之契，结算页记录签契与新递之契。教学演武不受契影响。",
  ] },
  { v: "V0.9.39.1", title: "视口修复 · 省电模式 · 教学演武", notes: [
    "修复在 TapTap 等应用容器里进入新页面时，画面只显示一半、无法操作的问题：现在以实际可视区域为准测量视口，尺寸连续变化时合并到稳定后再一次应用。",
    "新增省电模式：设置中可在「自动 / 省电 / 全效」间切换；应用容器与低配设备会自动进入省电档，关闭纸纹、雾气、余烬等装饰动画，切到后台时动画全部暂停。",
    "新增「教学演武」：从更多菜单或新手教程可进入独立练手场，对练手木人演练出牌节奏与打断蓄势，练完即散，不影响正式进度与存档。",
    "新手教程精简为三页，改为在战斗中按时机弹出一次性小提示；结算页新增「跨局收获」一览与存档备份入口，首页「备」按钮超过七日未备份会亮起红点。",
  ] },
  { v: "V0.9.39", title: "蜕鳞蛊双路线 · 血月塔影", notes: [
    "青蟒的蜕鳞蛊达到三转后，每局可在「逆鳞后毒」与「蜕鳞借毒」中选择一条互斥路线，取代旧的开局施毒。",
    "逆鳞后毒：每回合先完整打出一张攻击牌，之后第一张施毒牌在毒抗结算后额外 +2 层；先打施毒牌会错过本回合机会（归墟后不再永久错过）。同时攻击并施毒的牌不能为自己铺垫。",
    "蜕鳞借毒：敌人准备攻击时，意图区会出现「借毒」按钮——每回合一次移除敌人 4 层毒，立即获得 6 点护甲；归墟后若这次攻击没伤到生命，攻击结束返还 2 层毒。",
    "旧续局与更新前开的局不半途改规则，仍沿用原真形/归墟的开局施毒；新局路线同步显示在战斗状态、蛊庐、万蛊录、统计、结算与反馈信息中。",
    "首页标题画全新「血月塔影」：分层实景塔影替换线框月亮，蛊萤缠塔、命线流光、雾漂窗火；关闭战斗特效时自动退化为静态版。",
  ] },
  { v: "V0.9.38", title: "塔心终局", notes: [
    "命途塔主线现已通向独立塔心终局：断契、整备、终问、命债照见、万命母盘与四名蛊修结局构成完整篇章。",
    "开始界面的万蛊录与蛊庐成为同级局外入口；蛊庐新增藏册，从本版起记录亲手孵化、随行和投喂过的蛊虫。",
  ] },
  { v: "V0.9.37", title: "衔命虫双路线", notes: [
    "无名逆命者的衔命虫达到三转后，每局可在「三相织命」与「噬签改命」中选择一条互斥路线：前者凑齐三类牌，后者改换敌人准备使用的技能。",
    "三相织命：攻击、护甲、辅助三类各打出一张，顺序不限；第三类额外获得命势，每回合首次凑齐再得 3 点防御，凑齐前重复类型会重新起算。",
    "噬签改命：每回合第一次命势圆满时，敌人意图区会出现醒目的「改签」按钮；完成取舍后获得 3 点防御，新技能不一定更弱，归墟后可先看再决定。",
    "旧续局不会半途改规则，仍沿用原有真形与归墟圆满余泽；新局路线会同步显示在战斗状态、蛊庐、万蛊录、统计、结算与反馈信息中。",
  ] },
  { v: "V0.9.36", title: "适龄提示与合规打磨", notes: [
    "新增开场「适龄提示」：首次进入会有一次年龄确认，建议 16 周岁以上体验（暗黑东方奇幻，含战斗、蛊毒、生死与赌命等暗黑描写）；确认一次后不再打扰。开始界面也常驻一行适龄与「纯单机 · 不含实物交易」说明。",
    "修复蛊庐破壳提示错乱：此前圃中已有别的成蛊时，新蛊破壳的仪式可能错误显示成另一只的名字（尤以第四圃常见）——感谢群里玩家反馈，现已修正，破壳仪式只认刚出的这一只（蛊本身从未出错，只是弹窗显示）。",
    "后续关卡 BGM 加载再优化：把每一层的背景乐提前整整一层在后台预热（一层时就悄悄下好二层的、二层时下好三层与结算曲），用你打当前层的这几分钟当下载时间——到下一层时曲子已就位、进战即响，慢网/手机也不再干等。感谢反馈 BGM 加载慢的玩家。",
    "（幕后）为将来上架更多平台做了合规准备与构建流程整理，网页版体验一切照旧。",
  ] },
  { v: "V0.9.35", title: "辟圃·日课·天品随行", notes: [
    "蛊庐辟第四圃：通关任意路线后，蛊庐永久多开一格蛊圃，多养一只蛊、多一分带出选择。未通关前该格显示为「未辟」占位，明示解锁条件。",
    "新增「归庐日课」每日签到：每天回蛊庐点卯一次即得蛊庐材料，七日一循环、连签越久单日越丰（第七日更厚），漏签只断连签、绝不没收既得——纯锦上添花，不逼肝、不设体力条。",
    "天品随行终于名副其实（回应「天品太废」）：天品成蛊带入塔，除了那张自带 +2 强化的稀有牌，再按其维度多给一份「蛊气加持」——攻击天品每击伤害 +2 / 血道天品开局血煞 +2 / 防御天品生命上限 +8 / 辅助天品生命上限 +6，携带两只可叠加。蛊庐里每只天品都会标出它的随行加持。",
  ] },
  { v: "V0.9.34", title: "神化归墟立绘·夜鸣调优", notes: [
    "本命蛊「神化 / 归墟」两阶补上专属立绘：真形之上的两重蜕变各有其相——衔命化神织星、赤茧血海临朝、蜕鳞九首吐瘴、灯芯焚寿映银河。登顶的蛊修翻开图鉴，终于不再复用真形那张图。",
    "蛊庐夜间虫鸣调优：不再整夜长鸣，改「一阵鸣、一阵静」的间歇（约 22 秒鸣、48 秒静），整体音量也调轻了些——夜里久留蛊庐不再聒噪。",
  ] },
  { v: "V0.9.33", title: "手感与说明", notes: [
    "修复后续关卡 BGM 加载慢：进第二/三层地图时就在后台预热本层曲子，进战即秒起播，不再卡顿（第一关本就不卡，这次治的是之后每一层）。",
    "本命蛊真形之上再开两阶「神化 / 归墟」：满级（真形）的蛊修有了新追求——道行 800 化神、1500 归墟，各带一档更强的本命被动（命势 +2 / 血煞上限 +4 / 攻毒额外 +4 / 焚寿加成 +50% 等）。",
    "蛊庐孵卵按钮讲清产出了：现在直接显示「抽哪个池 · 破卵带几级强化 · 喂本命蛊多少道行」——玄/天品出稀有蛊（含寿火、枯荣等寿道蛊），天品自带 +2 强化、喂本命蛊 +150 道行，一眼看出天品的价值在养本命蛊。",
    "蛊坊滑动手感优化：去掉了卡列与动作列各自的内层滚动（那会跟外层结算滚动打架、发涩、滑动条一堆），现在整个蛊坊一条顺滑滚动，并开了手机惯性滚动。",
    "顺带修了三处：灯芯蛊焚寿续命后满血却被误判死亡；存档导入后偶被自动存档覆盖；试炼种子的一处安全隐患。",
  ] },
  { v: "V0.9.32", title: "防误触批2", notes: [
    "机缘事件、休整（养命/添火/饲蛊）也改两段式了：点一下只是「选中」，再点「确认」才真执行——尤其机缘里那些会扣血、不可逆的抉择，手滑点错不再当场见血；选错随时「重选」。",
    "蛊坊「续寿延年 / 焚寿易石」这类动寿元的买卖加了二次确认：首点亮起「再点一次确认」、再点才成交，3 秒没点自动取消。廉价的蛊石买卖仍是一点即买、不拖沓。",
    "（卡牌/材料奖励、炼蛊、删卡在前几版已有确认，一并齐活。）",
  ] },
  { v: "V0.9.31", title: "防误触与万蛊录横排", notes: [
    "卡牌奖励、材料奖励改为两段式：先点一下只是「选中高亮」，再点「确认」才真收进蛊匣/炉灰，选错了随时「重选」——手滑点错不再当场亏一张牌/一份材料。（炼蛊、删卡本就有确认，不变）",
    "万蛊录蛊虫详情排版优化：别名/品阶/道脉这些字少的信息不再一条独占一整行，短的自动并排、长的仍占整行，一屏看得更多。",
  ] },
  { v: "V0.9.30", title: "炼蛊有味道", notes: [
    "开炉终于有仪式感了：确认炼化后，结果不再是一行小字，而是砸下全屏仪式——稳定(金)/异变(玄紫)/反噬(血)各有其色、其印、其声，收蛊那一刻总算有了分量。",
    "新增稀有「逆火淬体」：炼蛊反噬掷出时有极小概率被炉火逆炼翻盘——非但不罚，反把这蛊淬净强化，独一份的青碧仪式。最怕的结果，偶尔成了最爽的。",
    "决策页加了炉火概率三色条：稳定/异变/反噬按占比一眼看清，配材料契合提示，赌一把之前心里更有数。",
    "炼蛊结果各配了音（成型/异变/反噬各不同），开炉不再是闷声升级。",
  ] },
  { v: "V0.9.29", title: "香火供奉", notes: [
    "蛊庐里点了盏长明灯——纯自愿的「香火」赞助入口来了。灯油自备，蛊修在此拱手谢过。",
    "把话撂前头：这是打赏、不是内购。一炷香火解锁不了任何蛊、任何牌、任何隐藏结局。你不点，游戏一个字都不少；你点了，作者能多熬两个通宵搓更新（血赚）。",
    "三处能添香火：蛊庐的长明灯、走得够远/通关后的结算页末尾、以及设置页常驻条目。结算那条嫌唠叨可「不再提示」，从此眼不见心不烦。",
    "微信扫码即可，手机长按图片存下来去「扫一扫·相册」也认。香火有情、蛊修铭记——没香火照样更新，别有半点压力。",
    "顺带：蛊庐「陶罐开合」的音效换了一版（旧的作者自己听腻了）。",
  ] },
  { v: "V0.9.28", title: "蛊庐生命化", notes: [
    "蛊庐里的蛊活了：圃中成蛊在框内轻轻呼吸起伏（品阶越高越显生机），本命蛊祭坛随心跳缓缓律动，静养时气息虚弱。",
    "戳一戳：点圃中的蛊/蛊卵会挤压回弹并发出甲壳轻叩；抚摸祭坛的本命蛊则回以一声心跳。纯手感反馈，不耗资源。",
    "蛊卵会晃、会裂：孵化倒计时进入末段（最后一成时长）蛊卵晃动加剧、壳面浮现裂纹，破壳更有临场感。",
    "给蛊起名：成蛊标题旁点「题」即可命名（至多 12 字），自定义名以暖金显示；留空则还原默认蛊名。",
  ] },
  { v: "V0.9.27", title: "攻防与治理", notes: [
    "新机制「破防」：护甲被一次攻击彻底打穿时，被破防方叠 1 层易伤（下次受击 ×1.5）。贴着敌人意图卡线留甲、低血龟缩的苟活流，一旦算错让甲破就易被雪崩收割——面板会预告「破甲则易伤」，可放心规划。",
    "平衡·燃元蛊：修正「0 费无限燃元」——同一回合连打燃元蛊，真元收益逐张递减（首张给足、之后每张 -1）。每回合稳打 1 张的正常续航不受影响，只斩断一回合抽干全副牌的滚雪球。",
    "平衡·经济：蛊石生息遗物固定给 3 枚（与描述一致），不再被死劫/十重天奖励系数抬成 5，抑制后期蛊石通胀。",
    "内部：蛊坊价格改为单一配置源（此前显示价与实扣价分写两处，改价易不一致）——玩家无感，为后续平衡调整打底。",
  ] },
  { v: "V0.9.26", title: "蛊庐音景", notes: [
    "蛊庐有声音了：专属氛围曲进场（与外界音乐交叉淡入淡出）；入夜（19:00–06:00 真实时间）虫鸣渐起，天亮渐息。",
    "本命蛊祭坛加了心跳——道行越深，心跳越沉越密。站在祭坛前听听你的蛊长到哪一步了。",
    "破壳四品各有其声：凡品沉闷、灵品清亮、玄品带回响、天品余音袅袅——与仪式分色同帧共鸣。",
    "喂食、落卵入土（陶罐开合）、蛊庐内点击（甲壳质感）各有音效；全部尊重音乐/音量开关，页面切后台自动静默省电。",
  ] },
  { v: "V0.9.25", title: "存档保险", notes: [
    "设置页新增「备份存档 / 恢复存档」：一键把全部进度（续局/本命蛊/蛊庐/天梯/图鉴/印录）打包成存档码——同时复制到剪贴板并下载文件；在任何设备任何地址粘贴导入即可搬家。换域名/换手机/清浏览器前，先备一份。",
    "导入有三重保险：存档码带校验和（缺损/被改动会被拒绝）、导入前自动下载当前档备份、确认弹窗写明覆盖范围。",
    "写档防坏档：所有关键存档改为「先写后验再覆盖」的原子写；续局档额外保留上一份完好档，检测到损坏自动回滚并提示。",
    "向浏览器申请持久化存储，降低系统自动清档的概率（老内核不支持则静默跳过）。",
    "蛊坊焚牌删卡/休整整理蛊匣改为独立选牌弹窗——此前列表藏在蛊坊长页底部（点了像没反应），确认条还会溢出面板压住其他模块，一并修正。",
  ] },
  { v: "V0.9.24", title: "离线护符", notes: [
    "给游戏佩上离线护符：只要成功进过一次游戏，资源就会悄悄存进本机——之后哪怕网络不通（部分网络下站点会被间歇性掐断），启动照常开玩，读的是本地。",
    "更新不受影响：网络正常时进游戏照旧检查新版本，更新闸与之前完全一致；且首页改为强制取最新，新版本生效比以前更快。",
    "存档零影响：续局、本命蛊、蛊庐进度全部原样保留——不换域名、不用重装 app。",
    "（含 V0.9.23.1 修复：手机端蛊庐祭坛/圃蛊卡图失控放大——窄屏祭坛立绘收为 92px 横排卡，单列蛊圃卡图定高不再撑满全宽。）",
  ] },
  { v: "V0.9.23", title: "蛊庐·家", notes: [
    "蛊庐升格全屏场景：不再是小弹窗——开始界面新增第二主按钮「归返蛊庐」，与「踏入命途塔」并立：一个进塔，一个回家。",
    "本命蛊祭坛入驻蛊庐：立绘常驻、四形态被动全览（当前档高亮）、身世小传、静养状态——本命蛊的一切一屋看尽。",
    "圃蛊有脸了：破壳的蛊直接亮出图鉴立绘；破壳升格全屏仪式（凡铜/灵青/玄紫/天血金四色）；越级蛊斗的胜败也各有全屏演出。",
    "随行规则落定：带入塔的蛊「通关保留、陨落同殒」——蛊本就是会死的东西，活着回来它才还是你的。无蛊入塔永远可行，蛊只是增益。",
    "（含 V0.9.22 蛊庐批1 全部内容：材料带出/真实时间孵卵/蛊斗喂养反噬。）",
  ] },
  { v: "V0.9.22", title: "蛊庐", notes: [
    "新系统「蛊庐」：塔外的家。开始界面新入口——塔里的材料现在能带出来了：通关全额入库、陨落折四成；Boss 新掉「蛊母残核」，只有活着走出塔才带得出。",
    "蛊圃养蛊：用带出的材料孵卵——凡品 30 分钟、灵品 4 小时、玄品 12 小时、天品 24 小时（真实时间，无任何加速位；离线也在长，回来看「蛊庐动静」）。天品要蛊母残核。",
    "养成的蛊 = 一张可带入塔的蛊牌（品阶越高牌越强）：至多带 2 只入塔随行，不消耗、局局可用。",
    "蛊斗喂养：把成蛊喂给本命蛊换道行——压制线内安稳吞下；越级喂养就是一场蛊斗，胜则道行加倍，败则反噬（掉一成道行 + 静养 8 小时，静养期形态降一档）。喂，还是带，一只蛊两条路。",
    "本批为蛊庐第一批，圃内互噬、词缀、品阶深化在后续批次。",
  ] },
  { v: "V0.9.21", title: "选人舞台", notes: [
    "开始界面选人全面收纳：四张大卡改为「一排印章 + 立绘舞台」——印章一眼看四修的印记与本命蛊，选中谁，谁的立绘大图登台。界面高度砍半，手机进来不再是一条长卷。",
    "换人即演出：舞台随流派换色（命势金 / 血道红 / 毒道绿 / 寿道橙），切换时立绘浮现、光波扫过、流派色余烬环绕。",
    "印章角标齐全：天印/金印等最高印记 + 本命蛊苏醒微标，成就一排看尽。",
    "累积修复：序章闪屏（老内核）、老内核手机战斗布局错乱（vivo 等机型手牌收纳钮压牌/卡牌拉伸）、选人卡印记角标被立绘遮挡。",
  ] },
  { v: "V0.9.20", title: "本命蛊", notes: [
    "新系统「本命蛊」：每位蛊修一只跨局成长的本命蛊——衔命虫（命势）、赤茧蛊（血道）、蜕鳞蛊（毒道）、灯芯蛊（寿道）。这是全游戏第一条死了不清零的养成线。",
    "道行局末自动结算（输赢都有）：每胜一战 +2、通关 +15，高难度按奖励系数放大；蛊卵→幼虫→成虫→真形四段形态，每段解锁一条常驻被动（强度约半件~一件遗物，刻意保守）。",
    "休整节点新增「饲养本命蛊」：喂 8 蛊石得 8 道行 + 本局最大生命 +2——跨局养成与局内抉择缝在一起。",
    "形态跨阈值的那局，结算时有全屏蜕变仪式；选人卡直接看每只蛊的形态与道行进度；万蛊录新开「本命」页可看四蛊十六形态全览。",
    "道行只增不减，无任何加速位，纯时间沉淀。",
  ] },
  { v: "V0.9.19", title: "十重天", notes: [
    "新难度「十重天」全量登场：死劫金印后解锁的天梯——十重递进，每登一重多压一条修饰，第 N 重通关解锁第 N+1 重，可随时回打低重；奖励随重数上浮（约 1.3→1.8 倍）。",
    "十重修饰全部实装：塔压加身(敌血+15%)、凶戾(敌攻+10%)、薄囊(丹囊3→2)、贵市(蛊坊+25%)、蚀寿(入二/三层各焚1寿)、炉险(反噬+10%)、天妒(稀有减半)、孤行(本命遗物仅前两枚)、残躯(血上限-10%)、逆命天(Boss血/攻再+20%，无续局)。",
    "四位蛊修各自爬天梯：进度按英雄独立；通关得「天印」——选人卡与蛊修印录均展示已通重数，通满十重为天印圆满。",
    "登塔仪式：开十重天局时全屏明示本局全部生效修饰，所见即所得。",
    "Boss 对峙升格全屏仪式弹窗：五名 Boss 战前压迫感演出（此前只有横幅一行小字，很多人没看见），点击任意处应战。",
    "开场序章勘误与出处闭环：序章文本与《命蛊残卷·卷一》严格同源（修正「黑石开口」与卷一「石缝里没有神声」的矛盾），看完序章自动解锁卷一入图鉴；序章与仪式弹窗的花纹特效全面加强。",
  ] },
  { v: "V0.9.18.2", title: "术语正名：丹囊", notes: [
    "战斗消耗品系统正名「丹囊」：此前与卡组的老名字「蛊囊」重名，掉落日志写着「蛊囊收入」，很容易被当成一张牌进了卡组——新系统因此被不少人整个错过。",
    "现在名字各归各位：「蛊囊」专指你的卡组（战斗右上按钮、图鉴里的「起手蛊囊」都不变）；「丹囊」专指随身 3 格消耗品（战斗中央芯片条，点击即用、用完即失）。",
    "丹囊的获取一直都在：普通战斗约 1/4 掉落（结算页会点名）、蛊坊「丹囊」格购买、炼蛊「蛊损」反噬补偿；囊满自动折算 4 蛊石。",
    "纯文案统一，不改任何数值、掉率与逻辑。",
  ] },
  { v: "V0.9.18", title: "塔中回声", notes: [
    "新增开场序章：首次进入游戏自动播放「黑石—命途塔—入塔」三幕神话，交代蛊即代价、命途塔从不赐终局的世界观；设置里可随时「重看序章」。",
    "新增塔中 NPC「司命人」：每层机缘节点可能遇一次（首遇必出、之后随机），台词随所选蛊修、是否重逢、以及你跨局陨落的次数而变——你折得越多，他记得越清。",
    "与司命人可「以血奉司命」换蛊石材料、「以寿换蛊」得稀有蛊牌，或转身不理。",
    "四位蛊修各得专属通关结局：通关结算页会依「所求」显示一段尾声，入塔动机与结局首尾呼应。",
    "五名 Boss 战前新增对峙台词，压迫感拉满。",
    "本次为世界观与叙事补全，不改战斗数值与掉落。",
  ] },
  { v: "V0.9.17", title: "入塔旧因", notes: [
    "新增第一批角色专属机缘：无名逆命者、绛妄、青蟒、朝暮各有 1 个只在对应蛊修局内混入的机缘事件。",
    "专属机缘围绕入塔旧因与流派代价展开：命线、血契、袖毒、寿灯分别对应命势、血道、毒道与寿道收益。",
    "本局统计、结算页和复制反馈会记录专属机缘触发次数，方便内测复盘；第三层主题机缘仍保持骨塔/蜂窟生态池。",
    "修复首次战斗引导可能盖住奖励卡牌的问题，胜利进入奖励/结算层前会自动收起引导浮层。",
  ] },
  { v: "V0.9.16.1", title: "命途图回卷", notes: [
    "命途图回图体验修复：战斗、机缘、蛊坊、休整等节点结束后，回到命途图会自动定位到当前第 N 段，并给当前段一次短暂高亮。",
    "修复手机端路线较长时，每段结束后需要手动上滑寻找下一段的问题；本次不改战斗数值、掉落与敌人强度。",
  ] },
  { v: "V0.9.16", title: "丹囊", notes: [
    "新系统「丹囊」：随身 3 格战斗消耗品——囊中养的活蛊，战斗中点击即用、用一次即失，给你出牌之外的第二个答案。",
    "12 种囊中蛊：通用 4 种（回血/护甲/抽牌/回真元）+ 各流派专属 2 种（如血道炽血露直伤、毒道爆毒囊、命势引势铃、寿道驻颜露），按流派偏发。",
    "获取途径：普通战斗约四分之一掉落、蛊坊新增丹囊格、炼蛊「蛊损」反噬改为补偿一件消耗品（蛊损不再白亏）；丹囊满时自动折算 4 蛊石。",
    "战斗界面中央新增丹囊条（手机横屏落在空腰扩展位）；万蛊录新开「丹囊」分类可查全部 12 种。",
    "数值调校从保守起步（宁弱勿强），后续按实战反馈调整。",
  ] },
  { v: "V0.9.15", title: "路线残卷与所求", notes: [
    "命蛊残卷补全四卷：瘴林深径、血沼沉渊、骨塔高陵、蜂窟魔巢各得其卷——踏入路线即显现，四大生态的来历不再是空白。",
    "地图上的「瘴林残卷/骨阶残卷」等路线残卷节点，现在真的会解锁对应残卷（此前是占位复用）。",
    "四位蛊修补上「所求」——他们为什么入塔：选人界面与蛊修列传均可见。",
    "本次为世界观内容补全，不改任何战斗数值与掉落。",
  ] },
  { v: "V0.9.14", title: "蛊修印录", notes: [
    "万蛊录新开「蛊修印录」：每位蛊修独立记录 普通铜印/精英银印/死劫金印 的通关印记——4 蛊修 × 3 难度共 12 枚印，等你集齐。",
    "结算称号入收藏：21 个称号全部可收集，未获得的显示获取线索；每局结算的称号自动入录，新称号会记进命途札记。",
    "选人界面直接亮出每位蛊修的最高通关印记——选人卡就是你的成就墙。",
    "说明：印记与称号自本版本起开始记录，此前的通关暂无法回溯（历史存档未按英雄记录），见谅。",
  ] },
  { v: "V0.9.13", title: "关键词直查", notes: [
    "点开卡牌详情：效果文字里的术语（血煞/命势/蚀毒/焚寿/酒意等）带虚线可点按，详情下方直接列出本卡涉及术语的解释——手机不再需要悬停。",
    "补齐术语词典：酒意/回光/焚寿/衰老/暴击/骨甲等此前无处可查的自造词全部入册，蛊囊浏览里的卡牌效果同样可点按。",
    "首次进战斗会提示「术语可点按查看说明」；教学与开始界面补上朝暮（此前仍写三名蛊修）。",
    "本次为信息呈现改进，不改任何战斗数值与掉落。",
  ] },
  { v: "V0.9.12.2", title: "手机战斗HUD止血", notes: [
    "遗物条改为单行横向滑动：遗物再多也不再被裁切或藏进第二行，触发闪光完整可见。",
    "本命遗物以金边芯片常驻遗物条首位——此前手机战斗里完全看不到自己的本命遗物。",
    "牌堆/弃牌数量回到手机战斗界面（结束回合按钮右侧的迷你计数），不再两眼一抹黑。",
    "敌方「蓄势」提示不再双份占位（意图条内已计入），右列省出一行留给状态显示。",
    "本次仅手机横屏战斗界面布局调整，桌面端与战斗数值零改动。",
  ] },
  { v: "V0.9.12.1", title: "结算与战斗修复", notes: [
    "精英/逆命/血签的待领遗物不再被「命途整备」顶掉：多份遗物会依次弹出，结算里承诺的那件一定拿得到。",
    "敌人意图预报补算「易伤 ×1.5」，并新增乱铃少抽预告——面板显示的伤害与实际结算一致，可放心按面板留甲。",
    "骨塔敌人蓄力叠甲补上上限（此前可无限滚甲导致低输出构筑僵死）；骨铃巡蛊「乱铃摇魂」的少抽效果正式生效。",
    "转毒封顶不再反向清掉你身上超额的毒；蚀毒/势爆符直伤打过半血也会正确触发 Boss 转阶段。",
    "死因分析修正：自损致死、死于蓄力重击不再被误报为「护甲不足」。",
    "第三层地图不再串台二层「生态」文案；焚寿易石/命轨铜钱不再吃精英·死劫奖励加成（堵蛊坊套利）。",
    "固定种子修复：战斗中期洗牌与八个随机通道此前未正确隔离——修复后旧种子的路线与战斗会整体变化，属预期。",
    "杂项：偏斜辅助卡在寿元仅剩 1 时会被禁用并标明代价；更新闸强刷不再丢失网址参数；命途图转场期间不再响应连点。",
  ] },
  { v: "V0.9.12", title: "万蛊录任务转正", notes: [
    "最新提示：打开“万蛊录 → 图鉴任务”，达成条件后点击“领取图鉴印记”；印记只做收藏记录，不影响战斗强度。",
    "万蛊录里的图鉴任务从预告状态转为正式轻目标，达成后可领取图鉴印记。",
    "图鉴印记只做收藏和记录，不改变卡组、奖励池、敌人强度或战斗数值。",
    "蛊虫详情会显示相关图鉴任务的进行中、可领取或已领取状态，便于内测玩家按路线补录。"
  ] },
  { v: "V0.9.11.2", title: "固定种子路线回归", notes: [
    "新增开发用路线回归检查脚本，固定校验六段路线配置、Boss 段、临门段和三层地图自检入口。",
    "本次不新增玩法、不改数值、不改奖励，只降低后续路线扩展时接错段或漏校验的风险。",
    "网页试玩与正式发布目录同步更新，方便内测反馈确认已进入路线回归构建。",
  ] },
  { v: "V0.9.11.1", title: "路线回归校验", notes: [
    "新增路线结构自检：新局、第二层、第三层地图生成后会检查段数、节点 step、临门段和 Boss 段",
    "本次不新增内容、不改数值，只给路线系统加一道开发期保险，避免后续扩展时段数写散",
    "同步网页试玩版本，方便反馈时确认当前构建"
  ] },
  { v: "V0.9.11", title: "路线系统抽象", notes: [
    "多层六段路线的总段数、临门段、Boss 段判断集中到路线配置里，减少散落硬编码",
    "本次不新增节点、不改数值，主要为后续多 Boss、第二幕和每日命局做底层收束",
    "同步更新版本与反馈信息，便于内测时定位当前构建"
  ] },
  { v: "V0.9.10", title: "命途种子可复现", notes: [
    "命途种子接入统一 RNG：路线、奖励、事件、蛊坊材料、炼蛊结果、敌人意图等关键随机更稳定",
    "同一种子下可复现主要路线与关键抉择结果，便于群内挑战、复盘和反馈定位",
    "保留新局种子生成与启动氛围字幕的即时随机，不影响正式游玩"
  ] },
  { v: "V0.9.9.5", title: "局内 UI 收口", notes: [
    "手机横屏战斗页重排玩家面板：生命与真元等关键数值更紧凑，立绘不再被手牌压住",
    "玩家加成与随身遗物条移到立绘下方，以小标签保留状态信息",
    "敌人面板同步压缩，横屏下优先显示生命、意图与关键状态"
  ] },
  { v: "V0.9.9.4", title: "匿名统计接入", notes: [
    "新增仅开发者可见的匿名访问统计：记录访问、开始游玩与在线心跳，用于判断试玩人数与时段分布",
    "统计不在游戏内显示，不记录姓名、账号、IP 或卡组细节；玩家界面与战斗数值不受影响",
  ] },
  { v: "V0.9.9.3", title: "血沼续航校准", notes: [
    "血泥傀、血衣祭蛊者等血沼敌人的蓄势护甲加入上限，避免护甲无限累积导致僵局",
    "下调血泥傀、血衣祭蛊者、血衣蛊母的过量吸血，保留血沼续航压迫但不再拖成打不死",
  ] },
  { v: "V0.9.9.2", title: "万蛊遗物 · 暴击", notes: [
    "遗物系统大改：战斗里常驻「随身遗物条」——随时看得见带了哪些遗物；触发时立绘飘醒目金字、遗物条脉冲高亮，再不会不知不觉",
    "遗物掉落改为「收取 / 舍弃」自选弹窗，不再默默塞给你",
    "新开暴击系统 + 20 余枚「改规则」遗物（命势/血道/毒道/寿道各有专属，按流派偏发，局局打法不同）",
    "万蛊录新增「遗物谱」：本命+随身遗物尽录、本命遗物配立绘、获得即解锁",
    "寿道五蛊（焚寿/蚀岁/回光/桑田/续命）补上立绘",
  ] },
  { v: "V0.9.9.1", title: "滚动修复 · 蛊坊叉号", notes: [
    "修复部分屏幕下起始页划不动、够不到「踏入命途塔」（换细窗暗金滚动条）",
    "蛊坊右上角新增叉号——滑不到底也能随时退出；结算/蛊坊卡片加触屏惯性滚动",
  ] },
  { v: "V0.9.9", title: "寿道·朝暮 — 焚命渡劫", notes: [
    "新蛊修「朝暮」入塔，本命「焚寿燃命」：寿元既是命数也是燃料，焚寿驱动蛊术、寿元越低蛊术越凶（满寿 +0／过半 +3／残寿 +6／垂暮 +10）；立绘由青丝转雪，寿元归零即陨",
    "寿道一脉五新蛊：焚寿、蚀岁、回光（本回合蛊术翻倍）、桑田（令敌衰老·攻势永减）、续命（焚岁疗愈）",
    "寿元当本钱：蛊坊「续寿」蛊石换命、「焚寿易石」焚命换石双向兑换；新遗物「饲岁轮」寿元上限 +12、战后焚寿换下场首回合真元",
    "新难度「死劫」：精英通关后解锁，九死无生——敌人极凶、失误即死、无续局，唯死中求活者得金印",
    "万蛊录新开「蛊修列传」：四名入塔蛊修的本命与传记恒可查",
  ] },
  { v: "V0.9.8.9", title: "骨塔硬核 · 老机型修复", notes: [
    "骨塔诸蛊换上硬核厚甲：常驻骨甲、每回合覆甲，攻不破甲者将被骨甲耗尽真元（破甲／护身／绕甲毒更吃香）",
    "修复部分华为／老内核手机进塔后命途图卡死、节点点不动、上下滑不动",
    "手机端卡牌名字补全，不再缺末尾「蛊」字；桌面端窗口白条修复",
  ] },
  { v: "V0.9.8.8", title: "游戏内更新闸 · 手牌横屏自适配", notes: [
    "新增「更新闸」：每次进游戏自动检测线上是否有新版本，有则提示「立即更新」（一键强制刷新取最新），不更新挡住——不再卡在旧版",
    "手机横屏手牌不再溢出截断：卡片弹性收缩，N 张牌自动铺满一屏",
    "说明：更新后请等约 1-2 分钟（站点重建）再打开；旧版玩家本次需手动刷新一次以载入更新闸，之后即自动提示",
  ] },
  { v: "V0.9.8.7", title: "移动端优化 · 自动续局", notes: [
    "新增「自动续局」：中途退出会自动保存进度，下次打开可在开始界面「继续上一局」接着玩；一局通关或殒落后存档清除",
    "手机 / 触屏 / 窄屏隐藏多余的「全屏」按钮，不再遮挡第一张手牌（桌面宽屏仍保留全屏功能）",
    "战斗界面左侧「血煞」不再重复显示，归入资源格子",
  ] },
  { v: "V0.9.8.6", title: "地图深化 · 逆命搏杀", notes: [
    "每层命途路 4 段 → 6 段，岔口更密：机缘、蛊坊、休整、精英不再因路短而错过",
    "新增「逆命节点」：可主动舍弃本段常规收益，立挑强于寻常的绝敌；胜则厚赏（稀有蛊·额外蛊石·遗物·蛊炉），败则命殒",
    "命途塔 / 生态 / 绝域 三层同步加长加岔，每一趟探索都更耐玩",
  ] },
  { v: "V0.9.8.5e", title: "万蛊录补全 · 关卡蛊虫归录", notes: [
    "关卡中获取的 25 张蛊虫（血潮 / 寿火 / 破甲 / 血祭 / 魂燃……）全部录入「蛊虫秘录」，张张配专属立绘",
    "万蛊录蛊虫条目 14 → 39，每条补全流派、效果、生态、来历等资料",
    "首次获得即录入，翻开万蛊录便可查其说明与立绘",
  ] },
  { v: "V0.9.8.5", title: "平衡与炼蛊救活", notes: [
    "「蛊炉炼蛊」救活：二、三层精英战后也能开炉，反噬惩罚减轻、首次开炉加引导——赌一把更值得",
    "无名逆命者「命势」满层后每回合爆发封顶，遏制回合内无限滚雪球",
    "燃元蛊重做为 0 费爆发起手（+2 真元 / +1 抽 / −2 命）；寒玉髓战后回血、蜕骨甲每回合护甲 +4",
    "经济收紧、绛妄血道战内续航增强（血煞上限提至 10、战后按出血道牌数回血）；修复精英战卡死 / 零血过关等致命问题",
  ] },
  { v: "V0.9.8.3", title: "精英模式与体验强化", notes: [
    "新增「精英模式」：通关任意路线后解锁的强化挑战，敌人更强、奖励更厚",
    "酒虫醉气改为层数叠加（旧版倍率，后续版本已削顶），血道流派多项补强",
    "敌人立绘改为完整显示，观感更佳",
  ] },
  { v: "V0.9.8", title: "第三层 · 骨塔与蜂窟", notes: [
    "二层 Boss 后再启第三层，两条主题绝域：骨塔高陵（骨道）与蜂窟魔巢（虫群）",
    "新增 9 类敌人机制——骨甲减伤、召唤护卫、群蜂叠伤、反击、扰铃乱心、指挥标记、压毒蜇刺……",
    "新敌与首领（骨巢守墓王 / 灾厄蜂后）皆配立绘，万蛊录同步收录",
  ] },
  { v: "V0.9.7", title: "命途结算与死因复盘", notes: [
    "通关或殒落后给出完整结算：分段战报、本局称号、死因分析",
    "可一键复制本局战报，方便反馈",
    "结算融入命蛊残卷氛围，胜负皆有交代",
  ] },
  { v: "V0.9.6.4", title: "启动加载界面", notes: [
    "打开网页即见全屏启动界面，预加载立绘与音频并显示进度",
    "点「入局」后解锁音频、淡入主菜单，首屏不再闪现或无声",
  ] },
  { v: "V0.9.6.1", title: "第二层地图化 + 敌人状态说明", notes: [
    "第二层升级为真正的分岔地图：起点双岔→精英/机缘/蛊坊多选→生态残卷→第二层 Boss，复用一层地图的渲染与点击",
    "瘴林 / 血沼主题影响普通战与精英、Boss 敌人池，进二层即有「新一关」感",
    "敌人状态图标可点击 / 长按查看说明（毒性、防御、塔压、狂怒、尸盘压毒等），与玩家状态共用同一套说明",
    "保留「命途未尽」入口与第二层结算字段（路线 / Boss / 节点数 / 新增万蛊录）",
  ] },
  { v: "V0.9.6", title: "第二层生态关卡预览", notes: [
    "一层 Boss 后新增「命途未尽」：可就此结算，或继续深入第二层",
    "第二层两条生态路线：瘴林深径（毒道）与血沼沉渊（血道），各含普通/三选一/精英/奖励/Boss",
    "新增 10 名生态敌人与 2 名生态 Boss（百瘴母蛊 / 血衣蛊母，皆有半血相位）",
    "万蛊录开放「敌怪图谱」「首领残卷」「生态」条目，遭遇即录、无立绘走暗色占位",
    "图鉴任务预埋瘴林初探/血沼初探/百瘴留名/血衣未散；结算与反馈新增第二层信息",
  ] },
  { v: "V0.9.4", title: "战斗手感与卡牌预览", notes: [
    "敌人意图新增「预计掉 X 血（已算护甲）」，大威胁时意图框红光警示",
    "出牌、受击加入轻微振动反馈（手机）",
    "点手牌可放大预览，看完整效果再决定出牌；预览弹窗加暗纹与寓言短句",
    "第四段首领（尸盘）立绘在手机上更大、露出头部",
  ] },
  { v: "V0.9.3", title: "移动端全屏与战斗界面重构", notes: [
    "手机横屏支持浏览器全屏（无地址栏），退出后可一键重进",
    "战斗界面重构：信息更集中、双方状态完整显示、立绘对称、手牌可收纳",
    "每局开战加入发牌动画；背景音乐与立绘大幅压缩，加载更快",
  ] },
];
// V0.9.36 批次B-3：万蛊录/图鉴系统（含 escGu 等工具）已抽至 nmg-codex.js，须在本文件之前加载。

let updateLogEl = null;
function showUpdateLog() {
  if (!updateLogEl) {
    updateLogEl = document.createElement("div");
    updateLogEl.className = "update-log-overlay hidden";
    let html = '<div class="update-log-backdrop"></div><div class="update-log-panel" role="dialog" aria-modal="true">'
      + '<div class="update-log-head"><h2>更新公告</h2><button type="button" id="updateLogClose" aria-label="关闭">×</button></div>'
      + '<div class="update-log-body">';
    html += '<div class="update-log-entry update-log-prompt"><p class="update-log-ver">最新更新提示</p><ul><li>检测到新版本，本公告会自动弹出；请先查看最新变动，再继续命途试炼。</li></ul></div>';
    UPDATE_LOG.forEach((entry) => {
      html += '<div class="update-log-entry"><p class="update-log-ver">' + entry.v + ' · ' + entry.title + '</p><ul>';
      entry.notes.forEach((note) => { html += '<li>' + note + '</li>'; });
      html += '</ul></div>';
    });
    updateLogEl.innerHTML = html + '</div></div>';
    document.body.appendChild(updateLogEl);
    updateLogEl.querySelector(".update-log-backdrop").addEventListener("click", hideUpdateLog);
    updateLogEl.querySelector("#updateLogClose").addEventListener("click", hideUpdateLog);
  }
  updateLogEl.classList.remove("hidden");
}
function hideUpdateLog() { if (updateLogEl) updateLogEl.classList.add("hidden"); }
// 检测到新正式版本或新 build 时，首次进入自动弹一次更新公告。
function maybeAutoShowUpdateLog() {
  try {
    // V0.9.18：从未看过序章的玩家先走「序章→新手引导」，不用更新公告打扰；序章看过后才自动弹更新公告（仍可手动开）。
    if (!getStoredFlag(PROLOGUE_STORAGE_KEY)) return;
    const latest = UPDATE_LOG[0].v;
    const build = window.__NMG_BUILD__ || latest;
    const seenUpdateKey = `${latest}|${build}`;
    if (localStorage.getItem("niming.seenUpdateBuild") !== seenUpdateKey) {
      showUpdateLog();
      localStorage.setItem("niming.seenUpdate", latest);
      localStorage.setItem("niming.seenUpdateBuild", seenUpdateKey);
    }
  } catch (err) { /* localStorage 不可用则忽略 */ }
}

let cardPreviewEl = null;
let readOnlyCardDetailEl = null;
let selectedHandCardId = "";
let cardLongPressTimer = null;
let cardPointerHold = null;
let suppressCardClickId = "";
const CARD_LONG_PRESS_MS = 380;
const CARD_LONG_PRESS_MOVE_PX = 10;

function resolveCardPointerIntent(sample) {
  const elapsed = Number(sample && sample.elapsed) || 0;
  const distance = Number(sample && sample.distance) || 0;
  if (distance > 10) return "cancel";
  return elapsed >= 380 ? "preview" : "select";
}

function cancelCardLongPress() {
  window.clearTimeout(cardLongPressTimer);
  cardLongPressTimer = null;
  cardPointerHold = null;
}

function beginCardLongPress(event) {
  const cardButton = event.target.closest?.(".card[data-card-id]");
  if (!cardButton || event.button > 0) return;
  cancelCardLongPress();
  cardPointerHold = {
    id: cardButton.dataset.cardId,
    startedAt: performance.now(),
    startX: event.clientX,
    startY: event.clientY,
    previewed: false,
  };
  cardLongPressTimer = window.setTimeout(() => {
    if (!cardPointerHold) return;
    cardPointerHold.previewed = true;
    suppressCardClickId = cardPointerHold.id;
  }, CARD_LONG_PRESS_MS);
}

function finishCardLongPress(event) {
  if (!cardPointerHold) return;
  const hold = cardPointerHold;
  const distance = Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY);
  const intent = resolveCardPointerIntent({ elapsed: performance.now() - hold.startedAt, distance });
  window.clearTimeout(cardLongPressTimer);
  if (intent === "preview") {
    suppressCardClickId = hold.id;
    showCardPreview(hold.id);
  }
  cardLongPressTimer = null;
  cardPointerHold = null;
}

function updateSelectedCardActions() {
  const card = game?.hand?.find((entry) => entry.instanceId === selectedHandCardId) || null;
  if (!card) selectedHandCardId = "";
  dom.selectedCardActions?.classList.toggle("hidden", !card);
  if (!card) return;
  if (dom.selectedCardName) dom.selectedCardName.textContent = `${card.baseName || card.name} · ${getEffectiveCardCost(card)} 真元`;
  const blocked = game?.status !== "playing" || game?.inputLocked || Boolean(getCardBlockReason(card));
  if (dom.selectedCardPlayButton) {
    dom.selectedCardPlayButton.disabled = blocked;
    dom.selectedCardPlayButton.title = blocked ? getCardBlockReason(card) || "当前不可操作" : `催动${card.baseName || card.name}`;
  }
}

function selectHandCard(instanceId) {
  if (!game?.hand?.some((card) => card.instanceId === instanceId)) return;
  selectedHandCardId = instanceId;
  renderHand();
}

function showSelectedCardDetails() {
  if (selectedHandCardId) showCardPreview(selectedHandCardId);
}

function playSelectedHandCard() {
  const card = game?.hand?.find((entry) => entry.instanceId === selectedHandCardId);
  if (!card || game.status !== "playing" || game.inputLocked || getCardBlockReason(card)) return;
  if (getBloodAtonementPlan(card, false).eligible) {
    showCardPreview(card.instanceId);
    return;
  }
  playCard(card.instanceId);
}
// 卡牌预览底部的氛围寓言短句（按类型变化，纯展示文案）。
function cardFlavorText(card) {
  const t = card.typeName || "";
  if (t.indexOf("毒") >= 0) return "毒入膏肓，无声蚀命。";
  if (t.indexOf("血") >= 0) return "血债血偿，煞气凝形。";
  if (card.type === "attack") return "蛊牙噬骨，一击索命。";
  if (card.type === "defense") return "甲胄覆身，万邪退避。";
  return "蛊术无形，唯心可御。";
}
// 手机端点牌放大预览：弹出大图看完整效果，点“使用”才出牌、“取消/背景”关闭。只动展示，不改出牌逻辑。
/* ===== V0.9.13 关键词直查：把效果文字里的术语包上 data-keyword（走既有 #keywordTooltip 点按/长按管线） ===== */
let keywordWrapRegex = null;
function getKeywordWrapRegex() {
  if (keywordWrapRegex) return keywordWrapRegex;
  const terms = [...new Set([...Object.keys(KEYWORD_HELP), ...Object.keys(ENEMY_STATUS_HELP)])]
    .sort((a, b) => b.length - a.length); // 长词优先，防"蚀毒"被"毒性"拆走
  keywordWrapRegex = new RegExp(terms.join("|"), "g");
  return keywordWrapRegex;
}
function wrapKeywords(html) {
  if (!html) return html || "";
  // 只处理标签之外的文本段，避免污染属性与既有标签
  return String(html).split(/(<[^>]+>)/).map((seg) => {
    if (seg.startsWith("<")) return seg;
    return seg.replace(getKeywordWrapRegex(), (kw) => `<span class="kw-term" data-keyword="${kw}" role="button" tabindex="0">${kw}</span>`);
  }).join("");
}

function getFateCardLiveStatus(card, value = game?.player?.fateMomentum ?? 0) {
  if (!card || !["fateThread", "lifeLamp", "reversePath"].includes(card.key)) return "";
  const momentum = Math.max(0, Math.min(FATE_MOMENTUM_MAX, Number(value) || 0));
  if (card.key === "fateThread") {
    return momentum >= 2
      ? `当前命势 ${momentum}/3：本次强化已生效`
      : `当前命势 ${momentum}/3：还差 ${2 - momentum} 层触发强化`;
  }
  if (card.key === "lifeLamp") {
    return momentum >= FATE_MOMENTUM_MAX
      ? `当前命势 ${momentum}/3：出牌前命势已满，本次回复生命`
      : `当前命势 ${momentum}/3：本次只获得命势，不回复生命`;
  }
  return `当前命势 ${momentum}/3：本次获得命势`;
}

/* 卡牌预览的术语解释行：类别解释（getCardKeywordHelp）+ 效果文字中出现的术语，按词去重、封顶 5 行 */
function getCardPreviewHelpLines(card) {
  const lines = (getCardKeywordHelp(card) || []).slice();
  const covered = new Set(lines.map((l) => String(l).split("：")[0]));
  const found = stripTags(String(card.effect || "")).match(getKeywordWrapRegex()) || [];
  for (const kw of found) {
    if (covered.has(kw)) continue;
    const help = KEYWORD_HELP[kw] || ENEMY_STATUS_HELP[kw];
    if (!help) continue;
    covered.add(kw);
    lines.push(`${kw}：${help}`);
  }
  const bloodPath = game ? getActiveBloodBenmingPath() : null;
  if (bloodPath === "bloodStitch" && card?.type === "blood") {
    lines.unshift(`缝煞成茧：${BENMING_PATHS.blood.bloodStitch.summary}`);
  }
  if (bloodPath === "bloodAtonement" && card?.type === "blood" && card?.category === "attack" && (getCardValues(card).selfDamage || 0) > 0) {
    lines.unshift(`裂茧代偿：${BENMING_PATHS.blood.bloodAtonement.summary}`);
  }
  const poisonPath = game ? getActivePoisonBenmingPath() : null;
  if (poisonPath === "poisonAfterstrike" && (card?.category === "attack" || (getCardValues(card).poison || 0) > 0)) {
    lines.unshift(`逆鳞后毒：${BENMING_PATHS.poison.poisonAfterstrike.summary}`);
  }
  const fateStatus = getFateCardLiveStatus(card);
  if (fateStatus) lines.unshift(fateStatus);
  return lines.slice(0, 5);
}

function showCardPreview(instanceId) {
  const card = game && game.hand ? game.hand.find((c) => c.instanceId === instanceId) : null;
  if (!card) { playCard(instanceId); return; }
  if (!cardPreviewEl) {
    cardPreviewEl = document.createElement("div");
    cardPreviewEl.className = "card-preview-overlay hidden";
    cardPreviewEl.innerHTML = '<div class="card-preview-backdrop"></div>'
      + '<div class="card-preview-panel" role="dialog" aria-modal="true">'
      + '<div class="card-preview-head"><h3 id="cardPreviewName"></h3><span id="cardPreviewCost"></span></div>'
      + '<div id="cardPreviewType" class="card-preview-type"></div>'
      + '<p id="cardPreviewEffect" class="card-preview-effect"></p>'
      + '<div id="cardPreviewKeywords" class="card-preview-keywords"></div>'
      + '<p id="cardPreviewAtonementHelp" class="card-preview-atonement hidden"></p>'
      + '<p id="cardPreviewFlavor" class="card-preview-flavor"></p>'
      + '<div class="card-preview-actions"><button type="button" id="cardPreviewCancel">取消</button>'
      + '<button type="button" id="cardPreviewPlay">正常使用</button>'
      + '<button type="button" id="cardPreviewAtonement" class="hidden">裂茧代偿</button></div></div>';
    document.body.appendChild(cardPreviewEl);
    cardPreviewEl.querySelector(".card-preview-backdrop").addEventListener("click", hideCardPreview);
    cardPreviewEl.querySelector("#cardPreviewCancel").addEventListener("click", hideCardPreview);
    cardPreviewEl.querySelector("#cardPreviewPlay").addEventListener("click", () => {
      const id = cardPreviewEl.dataset.cardId;
      hideCardPreview();
      if (id) playCard(id);
    });
    cardPreviewEl.querySelector("#cardPreviewAtonement").addEventListener("click", () => {
      const id = cardPreviewEl.dataset.cardId;
      hideCardPreview();
      if (id) playCard(id, { bloodAtonement: true });
    });
  }
  cardPreviewEl.dataset.cardId = instanceId;
  cardPreviewEl.querySelector("#cardPreviewName").textContent = card.name || "";
  const effectiveCost = game ? getEffectiveCardCost(card) : card.cost;
  cardPreviewEl.querySelector("#cardPreviewCost").textContent = "消耗 " + effectiveCost;
  cardPreviewEl.querySelector("#cardPreviewType").textContent = card.typeName || "";
  // V0.9.13 关键词直查：效果文字术语可点按，下方直接列出本卡涉及术语的解释（手机零 hover 也能看懂）
  cardPreviewEl.querySelector("#cardPreviewEffect").innerHTML = wrapKeywords(card.effect || "");
  const helpLines = getCardPreviewHelpLines(card);
  const kwBox = cardPreviewEl.querySelector("#cardPreviewKeywords");
  kwBox.innerHTML = helpLines.map((line) => `<span>${line}</span>`).join("");
  kwBox.classList.toggle("hidden", helpLines.length === 0);
  const previewBlockReason = game?.status !== "playing" || game?.inputLocked ? "暂不可用" : getCardBlockReason(card);
  const normalPlayButton = cardPreviewEl.querySelector("#cardPreviewPlay");
  normalPlayButton.disabled = Boolean(previewBlockReason);
  normalPlayButton.textContent = previewBlockReason || "正常使用";
  const atonementPlan = getBloodAtonementPlan(card, false);
  const atonementButton = cardPreviewEl.querySelector("#cardPreviewAtonement");
  atonementButton.disabled = Boolean(previewBlockReason);
  const atonementHelp = cardPreviewEl.querySelector("#cardPreviewAtonementHelp");
  atonementButton.classList.toggle("hidden", !atonementPlan.eligible);
  atonementHelp.classList.toggle("hidden", !atonementPlan.eligible);
  atonementHelp.textContent = atonementPlan.eligible
    ? `可代偿：消耗 3 层血煞，自损 ${getCardValues(card).selfDamage} → ${atonementPlan.selfDamageIfApplied}；本次攻击仍按当前 ${atonementPlan.bloodSnapshot} 层血煞计算。`
    : "";
  cardPreviewEl.querySelector("#cardPreviewFlavor").textContent = cardFlavorText(card);
  cardPreviewEl.classList.remove("hidden");
}

/* 接受完整 entry 的共用只读详情层：不依赖 game.hand，也不提供任何变更实例的动作。 */
function openReadOnlyCardDetail(entry, { guluModel = null } = {}) {
  if (!entry || typeof entry !== "object") return false;
  if (!readOnlyCardDetailEl) {
    readOnlyCardDetailEl = document.createElement("div");
    readOnlyCardDetailEl.className = "card-preview-overlay read-only-card-detail-overlay gulu-card-detail hidden";
    readOnlyCardDetailEl.innerHTML = '<div class="card-preview-backdrop" data-readonly-close="1"></div>'
      + '<div class="card-preview-panel" role="dialog" aria-modal="true" aria-label="蛊虫完整效果">'
      + '<div class="card-preview-head"><h3 data-readonly-name></h3><span data-readonly-cost></span></div>'
      + '<div class="card-preview-type" data-readonly-meta></div><div class="gulu-card-detail-body" data-readonly-body></div>'
      + '<div class="card-preview-actions"><button type="button" data-readonly-close="1">关闭</button></div></div>';
    document.body.appendChild(readOnlyCardDetailEl);
    readOnlyCardDetailEl.addEventListener("click", (event) => {
      const codex = event.target.closest("[data-gulu-codex]");
      if (codex) {
        const cardKey = codex.dataset.guluCodex;
        readOnlyCardDetailEl.classList.add("hidden");
        if (cardKey && typeof openWanGuLuEntry === "function") openWanGuLuEntry(cardKey);
        return;
      }
      if (event.target.closest("[data-readonly-close]")) readOnlyCardDetailEl.classList.add("hidden");
    });
  }
  const model = guluModel;
  const safe = (value) => escapeAttribute(String(value || ""));
  readOnlyCardDetailEl.querySelector("[data-readonly-name]").textContent = model?.displayName || entry.name || "蛊虫详情";
  readOnlyCardDetailEl.querySelector("[data-readonly-cost]").textContent = Number.isFinite(Number(entry.cost)) ? `消耗 ${entry.cost}` : "";
  readOnlyCardDetailEl.querySelector("[data-readonly-meta]").textContent = model
    ? `${model.gradeName} · ${model.turnName} · ${model.rankName}`
    : getCardTypeDisplay(entry);
  const effect = model?.currentEffect || getCardEffectForEntry(entry);
  const body = model
    ? `<section><h4>当前效果</h4><p>${wrapKeywords(effect)}</p></section>
       <section><h4>${model.nextValues ? "下一转" : "升转上限"}</h4><p>${safe(model.nextSummary)}</p>${model.nextEffect ? `<small>${wrapKeywords(model.nextEffect)}</small>` : ""}</section>
       ${model.resourceCaps?.length ? `<section><h4>资源与替代成长</h4><p>${safe(model.resourceCapSummary)}</p>${model.replacementSummary ? `<small>${safe(model.replacementSummary)}</small>` : ""}</section>` : ""}
       <section><h4>来源与实例</h4><p>${safe(model.sourceSummary)}</p><small class="${model.activeSourceLocked ? "is-locked" : ""}">${safe(model.lockSummary)}</small></section>
       ${model.codexCardKey ? `<button type="button" class="deck-detail-codex" data-gulu-codex="${safe(model.codexCardKey)}">前往万蛊录 ›</button>` : ""}`
    : `<section><h4>当前效果</h4><p>${wrapKeywords(effect)}</p></section>`;
  readOnlyCardDetailEl.querySelector("[data-readonly-body]").innerHTML = body;
  readOnlyCardDetailEl.classList.remove("hidden");
  const detailPanel = readOnlyCardDetailEl.querySelector(".card-preview-panel");
  if (detailPanel) detailPanel.scrollTop = 0;
  readOnlyCardDetailEl.querySelector(".card-preview-actions [data-readonly-close]")?.focus({ preventScroll: true });
  // 旧版 WebView 可能忽略 preventScroll；焦点完成后再归顶，保证首屏始终从标题开始。
  if (detailPanel) detailPanel.scrollTop = 0;
  return true;
}

function openGuluGuDetail(guId) {
  if (typeof getGuluStore !== "function" || typeof findOwnedGuluById !== "function" || typeof buildGuluDetailModel !== "function") return false;
  const slot = findOwnedGuluById(getGuluStore(), String(guId || ""));
  if (!slot) return false;
  const model = buildGuluDetailModel(slot);
  if (!model) return false;
  return openReadOnlyCardDetail(model.entry, { guluModel: model });
}
function hideCardPreview() {
  if (cardPreviewEl) cardPreviewEl.classList.add("hidden");
}

function getBattleCardCastPresentation(card) {
  const values = getCardValues(card) || {};
  const effectType = getCardEffectType(card);
  const offensive = card?.category === "attack"
    || Number(values.damage) > 0
    || Number(values.poison) > 0
    || Number(values.applyPoison) > 0
    || effectType === "blade"
    || effectType === "poison";
  return {
    target: offensive ? dom.enemyPortrait : dom.playerPortrait,
    kind: offensive ? "attack" : (effectType === "armor" ? "defense" : "support"),
  };
}

function playCard(instanceId, options = {}) {
  hideCardPreview();
  if (!game || game.status !== "playing" || game.inputLocked) return;
  const cardIndex = game.hand.findIndex((card) => card.instanceId === instanceId);
  if (cardIndex < 0) return;
  const card = game.hand[cardIndex];
  const blockReason = getCardBlockReason(card);
  if (blockReason) {
    setBattleMessage(`${blockReason}，无法催动${card.name}。`);
    addLog(`${blockReason}，${card.name}未能催动。`);
    return;
  }
  const requestedAtonement = Boolean(options.bloodAtonement);
  const atonementPlan = getBloodAtonementPlan(card, requestedAtonement);
  if (requestedAtonement && !atonementPlan.eligible) {
    setBattleMessage(atonementPlan.reason || "此牌当前不能代偿。", "warning");
    return;
  }
  const mupanMetricsBefore = captureMupanActionMetrics();

  // 一次出牌结算期间锁住输入，避免双击同一张牌造成重复扣费或重复伤害。
  game.inputLocked = true;
  safeVibrate(14);
  window.clearTimeout(cardUnlockTimer);
  const cardElement = dom.hand.querySelector(`[data-card-id="${instanceId}"]`);
  if (cardElement) {
    cardElement.disabled = true;
    cardElement.classList.add("is-casting");
  }
  let settled = false;
  function resolvePlayedCardAtImpact() {
    if (settled) return;
    settled = true;
    showCastDisplay(card);
    playCardUseEffect(card);
    const usedCostReduction = game.player.nextCardCostReduction > 0;
    game.player.energy -= getEffectiveCardCost(card);
    if (usedCostReduction) game.player.nextCardCostReduction = 0;
    game.hand.splice(cardIndex, 1);
    card.exhaust ? game.exhaustPile.push(card) : game.discardPile.push(card);
    const cardStatsKey = recordCardPlayed(card);
    game.activeCardContext = {
      key: card.key,
      cardStatsKey,
      cardName: card.name,
      baseName: card.baseName,
      cardSnapshot: { ...card },
      corrosionTriggered: false,
    };
    applyBloodBenmingCardPlan(card, requestedAtonement ? atonementPlan : null);
    applyPoisonBenmingCardPlan(card);
    playCardSfx(card);
    resolveCard(card);
    if (card.exhaust && card.key !== "calamityAshGu") registerCalamityAsh("消耗", 1);
    resolveThunderSequenceAfterCard(card);
    applySupportDrawFollowup(card);
    applySkewPenalty(card);
    applyFateCardFlow(card);
    if (game.tutorialDrill) game.drillPlayedAny = true;
    // FUNNEL-1 coach：命势蛊修连打同类型（且命势未满）→ 就地教"交替"
    if (game.player.heroId === "fate" && game.lastCardCategoryThisTurn
      && getCardFlowType(card) === game.lastCardCategoryThisTurn
      && (game.player.fateMomentum || 0) < FATE_MOMENTUM_MAX) {
      showCoachTip("fateAlternate", "命势要「交替」：打出与上一张不同类型的牌才会 +1，连打同类不攒命势。");
    }
    game.lastCardCategoryThisTurn = getCardFlowType(card);
    game.activeCardContext = null;
    game.cardsPlayedThisTurn += 1;
    if (card.type === "blood") game.bloodCardsPlayedThisBattle = (game.bloodCardsPlayedThisBattle || 0) + 1; // V0.9.8.5 血道战后回血计数
    const battleEnded = checkBattleResult();
    if (!battleEnded) resolveMupanPostPlayerAction(mupanMetricsBefore);
    render();
    if (!battleEnded && game.status === "playing") {
      cardUnlockTimer = window.setTimeout(() => {
        if (!game || game.status !== "playing") return;
        game.inputLocked = false;
        render();
      }, 220);
    }
  }

  const castPresentation = getBattleCardCastPresentation(card);
  if (window.NmgCardCast?.present) {
    window.NmgCardCast.present({
      source: cardElement || dom.hand,
      target: castPresentation.target,
      card: {
        name: card.name,
        art: getCardArtImage(card.key) || "",
        turn: Math.max(1, (Number(card.upgradeLevel) || 0) + 1),
      },
      side: "self",
      kind: castPresentation.kind,
      onImpact: resolvePlayedCardAtImpact,
    }).catch(resolvePlayedCardAtImpact);
  } else resolvePlayedCardAtImpact();
}

function getActiveBloodBenmingPath() {
  if (!game || !runState || game.player?.heroId !== "blood" || !benmingPassive("blood", 3)) return null;
  if (isLegacyBenmingRun(runState)) return null;
  return getRunBenmingPath(runState);
}

function getBloodAtonementPlan(card, confirmed = false) {
  const active = getActiveBloodBenmingPath() === "bloodAtonement";
  const values = card ? getCardValues(card) : {};
  if (!active) {
    return {
      eligible: false, applied: false, reason: "本局未选择裂茧代偿",
      bloodSnapshot: game?.player?.blood || 0,
      bloodAfter: game?.player?.blood || 0,
      bloodSpent: 0,
      selfDamageAfter: Math.max(0, Number(values.selfDamage) || 0),
      hpSaved: 0,
      usesAfter: game?.bloodAtonementUsesThisTurn || 0,
      maxUses: benmingPassive("blood", 5) ? 2 : 1,
    };
  }
  return planBloodAtonement({
    blood: game.player.blood,
    usesThisTurn: game.bloodAtonementUsesThisTurn,
    isBloodCard: card?.type === "blood",
    isAttack: card?.category === "attack",
    selfDamage: values.selfDamage,
    guixu: benmingPassive("blood", 5),
    cardAlreadyAtoned: Boolean(game.activeCardContext?.bloodAtonementApplied),
    confirmed,
  });
}

function applyBloodBenmingCardPlan(card, atonementPlan = null) {
  const path = getActiveBloodBenmingPath();
  const values = getCardValues(card);
  if (path === "bloodStitch") {
    const result = resolveBloodStitchFlow(game.bloodStitchState, {
      isBloodCard: card.type === "blood",
      selfDamage: values.selfDamage,
      guixu: benmingPassive("blood", 5),
    });
    game.bloodStitchState = result.state;
    game.activeCardContext.bloodSelfDamageReduction = result.selfDamageReduction;
    game.activeCardContext.bloodBonusGain = result.bonusBlood;
    game.activeCardContext.bloodBonusGainUsed = false;
    if (result.triggered) {
      const stats = getRunStats();
      stats.bloodStitchTriggers += 1;
      stats.bloodStitchHpSaved += result.selfDamageReduction;
      addLog(`缝煞成茧：${card.name}少失去 ${result.selfDamageReduction} 点生命，并额外获得 ${result.bonusBlood} 层血煞。`, "positive-log");
    } else if (result.consumed && card.type === "blood") {
      addLog(`缝煞铺垫被${card.name}收束，但此牌没有自损，未获得减伤与额外血煞。`, "system-log");
    } else if (result.forfeited) {
      addLog(`本回合先打出血道牌，缝煞机会已错过。`, "system-log");
    }
  }
  if (path === "bloodAtonement" && atonementPlan?.applied) {
    game.player.blood = atonementPlan.bloodAfter;
    game.bloodAtonementUsesThisTurn = atonementPlan.usesAfter;
    game.activeCardContext.bloodAtonementApplied = true;
    game.activeCardContext.bloodSelfDamageReduction = atonementPlan.hpSaved;
    game.activeCardContext.bloodAttackSnapshot = atonementPlan.bloodSnapshot;
    const stats = getRunStats();
    stats.bloodAtonementUses += 1;
    stats.bloodAtonementSpent += atonementPlan.bloodSpent;
    stats.bloodAtonementHpSaved += atonementPlan.hpSaved;
    addLog(`裂茧代偿：消耗 ${atonementPlan.bloodSpent} 层血煞，${card.name}少失去 ${atonementPlan.hpSaved} 点生命；本次攻击仍按支付前 ${atonementPlan.bloodSnapshot} 层血煞计算。`, "positive-log");
  }
}

function getActiveCardSelfDamage(baseAmount) {
  const base = Math.max(0, Number(baseAmount) || 0);
  const reduction = Math.max(0, Number(game?.activeCardContext?.bloodSelfDamageReduction) || 0);
  return Math.max(0, base - reduction);
}

function gainActiveCardBlood(baseAmount) {
  const context = game?.activeCardContext;
  const bonus = context && !context.bloodBonusGainUsed
    ? Math.max(0, Number(context.bloodBonusGain) || 0)
    : 0;
  if (context) context.bloodBonusGainUsed = true;
  return gainBlood(Math.max(0, Number(baseAmount) || 0) + bonus);
}

function getActiveBloodAttackSnapshot() {
  const snapshot = Number(game?.activeCardContext?.bloodAttackSnapshot);
  return Number.isFinite(snapshot) ? Math.max(0, snapshot) : game.player.blood;
}

// ===== D-2c 蜕鳞蛊双路线（规则依据：DESIGN-D2A-TUILIN-PATHS.md）=====
function getActivePoisonBenmingPath() {
  if (!game || !runState || game.player?.heroId !== "poison" || !benmingPassive("poison", 3)) return null;
  if (isLegacyBenmingRun(runState)) return null;
  return getRunBenmingPath(runState);
}

// 逆鳞后毒：以出牌前状态推演本张牌；追加毒层只写入 activeCardContext，
// 由 applyEnemyPoison 在毒抗换算后并入该牌自身的施毒事件，不得二次施毒。
function applyPoisonBenmingCardPlan(card) {
  if (getActivePoisonBenmingPath() !== "poisonAfterstrike") return;
  const values = getCardValues(card);
  const result = resolvePoisonAfterstrikeFlow(game.poisonAfterstrikeState, {
    isAttackCard: card.category === "attack",
    appliesPoison: (Number(values.poison) || 0) > 0,
    guixu: benmingPassive("poison", 5),
  });
  game.poisonAfterstrikeState = result.state;
  if (result.triggered) {
    game.activeCardContext.poisonAfterstrikeBonus = result.bonusPoison;
    game.activeCardContext.poisonAfterstrikeBonusUsed = false;
  } else if (result.primed) {
    addLog("逆鳞已开：本回合下一张施毒牌将追毒 +2。", "system-log");
  } else if (result.forfeited) {
    addLog(`本回合先打出施毒牌，逆鳞后毒机会已错过。`, "system-log");
  }
}

function getPoisonBorrowPlan(confirmed = false) {
  const active = getActivePoisonBenmingPath() === "poisonBorrowedScale";
  const action = active && game?.enemy ? getCurrentEnemyAction() : null;
  return planPoisonBorrowedScale({
    poison: game?.enemy?.poison || 0,
    enemyAttacking: Boolean(action && action.kind !== "charge"),
    usedThisTurn: Boolean(game?.poisonBorrowedScaleUsedThisTurn),
    guixu: benmingPassive("poison", 5),
    confirmed: active && confirmed,
  });
}

function requestPoisonBorrow() {
  if (!game || game.status !== "playing" || game.inputLocked) return false;
  if (getActivePoisonBenmingPath() !== "poisonBorrowedScale") return false;
  const plan = getPoisonBorrowPlan(true);
  if (!plan.applied) {
    if (plan.reason) setBattleMessage(plan.reason);
    return false;
  }
  // 移除不是毒伤、驱散或施毒：直接改毒层（沿吞毒/凝甲惯例），不触发蚀毒、浓毒瓶、
  // 幼虫首次施毒、施毒统计，也不计入母盘毒债（poisonAdded）。
  game.enemy.poison = Math.max(0, plan.poisonAfter);
  game.pendingEnemyPoisonPulse = true;
  // 护甲固定 6 点走直写（同骨甲蛊壳惯例），不吃 defenseBonus；与其他护甲正常叠加、由敌方攻击依次消耗。
  game.player.armor += plan.armorGain;
  recordArmorGained(plan.armorGain, "蜕鳞借毒");
  game.poisonBorrowedScaleUsedThisTurn = true;
  game.poisonBorrowedScalePendingAttack = true;
  const stats = getRunStats();
  stats.poisonBorrowedScaleUses += 1;
  stats.poisonBorrowedScalePoisonSpent += plan.poisonCost;
  stats.poisonBorrowedScaleArmorGained += plan.armorGain;
  addLog(`蜕鳞借毒：剥走敌人 ${plan.poisonCost} 层毒，护甲 +${plan.armorGain}。`, "positive-log");
  spawnFloatText(dom.playerPortrait, `+${plan.armorGain} 防御`, "defense-float");
  spawnFloatText(dom.enemyPortrait, `-${plan.poisonCost} 毒性`, "poison-float");
  playArmorEffect();
  render();
  return true;
}

// 归墟借毒验收：该次敌方攻击全段合计生命伤害为 0 → 攻击结束后、回合末毒伤前返还 2 层旧毒。
// 返还是恢复先前移除的毒，不是施毒：不过毒抗，不触发浓毒瓶/幼虫/蚀毒/施毒统计，不计入母盘毒债。
// 敌方未实际执行攻击（蓄力、改签成非攻击）时已支付资源不回滚也不返还；命签落定等非攻击段伤害不参与验收。
function settlePoisonBorrowedScaleAfterEnemyAction(action, attackLifeDamage) {
  if (!game.poisonBorrowedScalePendingAttack) return;
  game.poisonBorrowedScalePendingAttack = false;
  if (!action || action.kind === "charge") return;
  const plan = planPoisonBorrowedReturn({
    pending: true,
    guixu: benmingPassive("poison", 5),
    lifeDamage: Math.max(0, Number(attackLifeDamage) || 0),
  });
  if (plan.returned <= 0) return;
  game.enemy.poison += plan.returned;
  game.pendingEnemyPoisonPulse = true;
  getRunStats().poisonBorrowedScaleReturns += 1;
  addLog(`蜕鳞借毒·五转：这一击未伤生命，返还敌人 ${plan.returned} 层旧毒。`, "positive-log");
  spawnFloatText(dom.enemyPortrait, `+${plan.returned} 毒性`, "poison-float");
}

function applySupportDrawFollowup(card) {
  if (!game?.supportDrawPrimed || card.key === "yuanReturn" || card.category !== "utility") return;
  const drawCount = Math.max(1, game.supportDrawPrimed);
  game.supportDrawPrimed = 0;
  drawCards(drawCount);
  addLog(`回元余韵：下一张辅助蛊已生效，抽 ${drawCount} 张牌。`, "positive-log");
}

function consumeActionEconomyFirstDraw(cardKey, bonus) {
  const amount = Math.max(0, Number(bonus) || 0);
  if (amount <= 0) return 0;
  game.actionEconomyFirstDrawUsedThisTurn ||= {};
  if (game.actionEconomyFirstDrawUsedThisTurn[cardKey]) return 0;
  game.actionEconomyFirstDrawUsedThisTurn[cardKey] = true;
  return amount;
}

function getSwarmBitePlayedCount(values) {
  return Math.min(
    Math.max(0, game.cardsPlayedThisTurn || 0),
    Math.max(0, Number(values?.perPlayedCap) || 0),
  );
}

function registerCalamityAsh(source, count = 1) {
  if (!game?.calamityAsh) return 0;
  const state = game.calamityAsh;
  const before = state.ashes;
  state.ashes = Math.min(state.cap, state.ashes + Math.max(0, count | 0));
  const gained = state.ashes - before;
  if (gained > 0) addLog(`劫灰蛊收下${source}：劫灰 +${gained}（${state.ashes}/${state.cap}）。`, "positive-log");
  return gained;
}

function resolveThunderSequenceAfterCard(card) {
  const state = game?.thunderSequence;
  if (!state || card.key === "chainThunderGu" || state.triggers >= state.cap) return 0;
  const currentCategory = getCardFlowType(card);
  if (!game.lastCardCategoryThisTurn || currentCategory === game.lastCardCategoryThisTurn) return 0;
  state.triggers += 1;
  resolveAttack(state.card, state.damage, `雷序 ${state.triggers}/${state.cap}`);
  return state.damage;
}

function settleCalamityAshAtTurnEnd() {
  const state = game?.calamityAsh;
  if (!state || state.ashes <= 0) return 0;
  const damage = state.ashes * state.damage;
  resolveAttack(state.card, damage, `${state.ashes} 灰焚尽`);
  if (state.ashes >= state.cap && state.fullArmor > 0) gainArmor(state.fullArmor, "劫灰蛊", "灰满护身");
  game.calamityAsh = null;
  return damage;
}

function planRedTideStrike(blood, values = {}) {
  const available = Math.max(0, Number(blood) || 0);
  const minimum = Math.max(0, Number(values.bloodCost) || 0);
  const bloodSpent = Math.min(available, Math.max(minimum, Number(values.bloodCap) || 0));
  return {
    eligible: available >= minimum,
    bloodSpent,
    bloodAfter: Math.max(0, available - bloodSpent),
    damage: Math.max(0, Number(values.damage) || 0) + bloodSpent * Math.max(0, Number(values.perBlood) || 0),
  };
}

function planLifePyreStrike(actualBurn, values = {}) {
  const paid = Math.max(0, Number(actualBurn) || 0);
  return {
    actualBurn: paid,
    damage: Math.max(0, Number(values.damage) || 0) + paid * Math.max(0, Number(values.perActualBurn) || 0),
  };
}

function planVicissitudeTurtle(currentWeaken, values = {}, ecologyTags = []) {
  const before = Math.max(0, Number(currentWeaken) || 0);
  const corpseImmune = Array.isArray(ecologyTags) && ecologyTags.includes("corpse");
  const cap = Math.max(0, Number(values.weakenCap) || 0);
  const weakenAdded = corpseImmune
    ? 0
    : Math.max(0, Math.min(Math.max(0, Number(values.weaken) || 0), cap - before));
  const weakenAfter = before + weakenAdded;
  const armorScale = Math.min(weakenAfter, Math.max(0, Number(values.armorScaleCap) || 0));
  return {
    weakenAdded,
    weakenAfter,
    armor: Math.max(0, Number(values.armor) || 0) + armorScale * Math.max(0, Number(values.perWeakenArmor) || 0),
    corpseImmune,
  };
}

function planRedTideBladeLeech(currentBlood, values = {}) {
  const available = Math.max(0, Number(currentBlood) || 0);
  const minimum = Math.max(0, Number(values.bloodCost) || 0);
  const eligible = available >= minimum;
  const bloodSpent = eligible ? Math.min(available, Math.max(minimum, Number(values.bloodCap) || 0)) : 0;
  return {
    eligible,
    bloodSpent,
    bloodAfterSpend: Math.max(0, available - bloodSpent),
    damage: Math.max(0, Number(values.damage) || 0) + bloodSpent * Math.max(0, Number(values.perBlood) || 0),
  };
}

function planLifePyreSandScorpion(actualBurn, battleBurn, values = {}) {
  const paid = Math.max(0, Number(actualBurn) || 0);
  const accumulated = Math.max(0, Number(battleBurn) || 0);
  return {
    actualBurn: paid,
    battleBurn: accumulated,
    damage: Math.max(0, Number(values.damage) || 0)
      + paid * Math.max(0, Number(values.perActualBurn) || 0)
      + accumulated * Math.max(0, Number(values.perBattleBurn) || 0),
  };
}

function planWitheredMulberryTurtle(currentWeaken, values = {}, ecologyTags = []) {
  const before = Math.max(0, Number(currentWeaken) || 0);
  const corpseImmune = Array.isArray(ecologyTags) && ecologyTags.includes("corpse");
  const cap = Math.max(0, Number(values.weakenCap) || 0);
  const weakenAdded = corpseImmune
    ? 0
    : Math.max(0, Math.min(Math.max(0, Number(values.weaken) || 0), cap - before));
  const weakenAfter = before + weakenAdded;
  const armorScale = Math.min(weakenAfter, Math.max(0, Number(values.armorScaleCap) || 0));
  return {
    weakenAdded,
    weakenAfter,
    armor: Math.max(0, Number(values.armor) || 0) + armorScale * Math.max(0, Number(values.perWeakenArmor) || 0),
    corpseImmune,
  };
}

function planEcologyCounter(cardKey, ecologyTags = [], used = {}, values = {}, context = {}) {
  const rules = {
    redTideGu: { tag: "bloodFeeder", label: "血食", requires: () => (Number(context.bloodSpent) || 0) > 0, damageField: "ecologyBonus" },
    redTideBladeLeech: { tag: "bloodFeeder", label: "血食", requires: () => (Number(context.bloodSpent) || 0) > 0, damageField: "ecologyBonus" },
    lifePyreScorpion: { tag: "decay", label: "腐生", requires: () => (Number(context.actualBurn) || 0) > 0, damageField: "ecologyBonus" },
    lifePyreSandScorpion: { tag: "decay", label: "腐生", requires: () => (Number(context.actualBurn) || 0) > 0, damageField: "ecologyBonus" },
    vicissitudeTurtle: { tag: "armor", label: "甲壳", requires: () => (Number(context.enemyArmor) || 0) > 0, armorField: "ecologyArmorRemove" },
    witheredMulberryTurtle: { tag: "armor", label: "甲壳", requires: () => (Number(context.enemyArmor) || 0) > 0, armorField: "ecologyArmorRemove" },
  };
  const rule = rules[cardKey];
  if (!rule || !Array.isArray(ecologyTags) || !ecologyTags.includes(rule.tag) || !rule.requires()) {
    return { triggered: false, key: "", bonusDamage: 0, armorRemove: 0, label: "" };
  }
  const key = `${cardKey}:${rule.tag}`;
  if (used && used[key]) return { triggered: false, key, bonusDamage: 0, armorRemove: 0, label: rule.label };
  return {
    triggered: true,
    key,
    bonusDamage: rule.damageField ? Math.max(0, Number(values[rule.damageField]) || 0) : 0,
    armorRemove: rule.armorField
      ? Math.min(Math.max(0, Number(context.enemyArmor) || 0), Math.max(0, Number(values[rule.armorField]) || 0))
      : 0,
    label: rule.label,
  };
}

function applyEcologyCounter(card, values, context = {}) {
  const result = planEcologyCounter(
    card?.key,
    game?.enemy?.definition?.ecologyTags || [],
    game?.ecologyCountersUsedThisTurn || {},
    values,
    context,
  );
  if (!result.triggered) return result;
  game.ecologyCountersUsedThisTurn ||= {};
  game.ecologyCountersUsedThisTurn[result.key] = true;
  game.ecologyTriggerCount = (game.ecologyTriggerCount || 0) + 1;
  const stats = getRunStats();
  // 生态相克统计统一写入既有 runStats，供本局统计、结算与反馈复制复用。
  stats.ecologyCounterTriggers += 1;
  stats.ecologyCounterDamage += result.bonusDamage;
  stats.ecologyCounterArmorRemoved += result.armorRemove;
  if (result.armorRemove > 0) removeEnemyArmor(result.armorRemove, `${card.name}·生态相克`);
  spawnFloatText(dom.enemyPortrait, `生态相克·${result.label}`, "resource-float");
  addLog(`生态相克：${card.name}克制「${result.label}」，${result.bonusDamage > 0 ? `额外伤害 +${result.bonusDamage}` : `蚀甲 ${result.armorRemove}`}。`, "positive-log");
  return result;
}

function resolveCard(card) {
  const v = getCardValues(card);
  switch (card.key) {
    case "moonBlade":
      resolveAttack(card, v.damage);
      break;
    case "ironSkin":
      gainArmor(v.armor, card.name);
      break;
    case "wineWorm":
      // V0.9.57：倍率走 getDrunkMultiplier 单源（递减 ×2/×2.5/×3），不再是 Math.pow(2, 层)。
      game.player.drunkStacks = Math.min((game.player.drunkStacks || 0) + 1, DRUNK_MAX_STACKS);
      game.player.drunkFlatBonus = (game.player.drunkFlatBonus || 0) + (v.damage || 0);
      if (v.draw > 0) {
        drawCards(v.draw);
        addLog(`酒虫醺意入匣：抽 ${v.draw} 张牌。`, "positive-log");
      }
      addLog(`你使用酒虫，酒意缠身：下一张攻击蛊伤害×${getDrunkMultiplier(game.player.drunkStacks)}（酒意 ${game.player.drunkStacks} 层）${v.damage > 0 ? `，再加 ${v.damage} 点` : ""}${v.draw > 0 ? `，并抽 ${v.draw} 张牌` : ""}。`, "player-log");
      setBattleMessage(`酒意：下次攻击×${getDrunkMultiplier(game.player.drunkStacks)}（${game.player.drunkStacks} 层）。`);
      break;
    case "bloodBlade": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      {
        const bloodBefore = getActiveBloodAttackSnapshot();
        const gained = gainActiveCardBlood(v.bloodGain);
        addLog(`血刃反噬，你失去 ${selfDamage} 点生命，并获得 ${gained} 层血煞。`, "damage-log");
        resolveAttack(card, v.damage + bloodBefore, bloodBefore ? `${bloodBefore} 层血煞` : "");
      }
      break;
    }
    case "burningEssence": {
      losePlayerHealth(v.selfDamage);
      // V0.9.27 核心循环治理：燃元蛊 0 费净产真元+抽牌，配合重洗可半无限过牌+囤真元（对抗验证 CONFIRMED，
      // 且无任何手牌/真元上限拦截）。同回合递减封顶：首张给足、之后每张 -1 快速趋零，斩断"0费自给循环"，
      // 保留单张爆发手感。计数器每回合于 9794 重置。
      game.player._burningEssenceCount = (game.player._burningEssenceCount || 0) + 1;
      const burnGain = Math.max(0, v.energy - Math.max(0, game.player._burningEssenceCount - 1));
      game.player.energy += burnGain;
      if (burnGain > 0) spawnFloatText(document.querySelector(".player-portrait"), `+${burnGain} 真元`, "yuan-float");
      if (v.draw > 0) drawCards(v.draw);
      if (burnGain > 0) {
        addLog(`你使用燃元蛊，失去 ${v.selfDamage} 点生命，获得 ${burnGain} 点真元${v.draw > 0 ? `，抽 ${v.draw} 张牌` : ""}。`, "damage-log");
        setBattleMessage("精血化元，短暂的力量灼烧着你的经脉。");
      } else {
        addLog(`你再度燃元，失去 ${v.selfDamage} 点生命，${v.draw > 0 ? `抽 ${v.draw} 张牌，但` : ""}经脉已透支，本回合燃元不再产真元。`, "damage-log");
        setBattleMessage("燃元递减：经脉透支，此张不再化出真元。");
      }
      break;
    }
    case "heartEater": {
      const empowered = game.player.blood >= 2;
      resolveAttack(card, empowered ? v.empoweredDamage : v.damage, empowered ? "血煞催发" : "");
      break;
    }
    case "bloodReversal": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      {
        const bloodBefore = getActiveBloodAttackSnapshot();
        const bloodBonus = bloodBefore * v.bloodMultiplier;
        resolveAttack(card, v.damage + bloodBonus, bloodBefore ? `${bloodBefore} 层血煞×${v.bloodMultiplier}` : "");
        const gained = gainActiveCardBlood(v.bloodGain);
        addLog(`逆血蛊反行经脉：你失去 ${selfDamage} 点生命，获得 ${gained} 层血煞。`, "damage-log");
      }
      break;
    }
    case "bloodTide":
      resolveAttack(card, v.damage + game.player.blood * v.bloodMultiplier, `${game.player.blood} 层血煞×${v.bloodMultiplier}`);
      break;
    case "lifeFlame":
      spendLifespan(v.lifespanCost, card.name);
      resolveAttack(card, v.damage, "寿火燃烧");
      break;
    case "witheredBloom":
      spendLifespan(v.lifespanCost, card.name);
      healPlayer(v.heal, card.name);
      break;
    case "essenceGathering": {
      const bonusDraw = consumeActionEconomyFirstDraw("essenceGathering", v.firstPerTurnDraw);
      const totalDraw = v.draw + bonusDraw;
      game.player.energy += v.energy;
      if (v.armor > 0) gainArmor(v.armor, card.name);
      if (totalDraw > 0) drawCards(totalDraw);
      spawnFloatText(document.querySelector(".player-portrait"), `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用聚元蛊，获得 ${v.energy} 点真元${v.armor > 0 ? `、${v.armor} 点防御` : ""}${totalDraw > 0 ? `并抽 ${totalDraw} 张牌` : ""}${bonusDraw > 0 ? "（本回合首次额外抽牌）" : ""}。`, "positive-log");
      setBattleMessage("游离真元被蛊群纳入空窍，蛊匣随之轻鸣。");
      break;
    }
    case "mysticCarapace":
      gainArmor(v.armor, card.name);
      break;
    case "returnLife":
      game.player.blood -= v.bloodCost;
      healPlayer(v.heal, card.name);
      addLog(`返命蛊吞去 ${v.bloodCost} 层血煞，逆转伤势。`, "positive-log");
      break;
    case "swarmBite": {
      const countedCards = getSwarmBitePlayedCount(v);
      resolveAttack(card, v.damage + countedCards * v.perPlayed, `此前出牌计 ${countedCards}/${v.perPlayedCap} 张`);
      break;
    }
    case "meridianShift":
      losePlayerHealth(v.selfDamage);
      drawCards(v.draw);
      addLog(`你使用移窍蛊，失去 ${v.selfDamage} 点生命并抽 ${v.draw} 张牌。`, "damage-log");
      setBattleMessage("窍穴移位，剧痛中有新的蛊鸣回应。");
      break;
    case "armorBreaker": {
      const hasArmor = (game.enemy.armor || 0) > 0;
      resolveAttack(card, v.damage + (hasArmor ? v.armorBonus : 0), hasArmor ? "破甲" : "");
      break;
    }
    case "yuanReturn":
      game.player.energy += v.energy;
      game.supportDrawPrimed = Math.max(game.supportDrawPrimed || 0, v.supportDraw);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用回元蛊，获得 ${v.energy} 点真元；下一张辅助蛊抽 ${v.supportDraw} 张牌。`, "positive-log");
      setBattleMessage("真元回流，蛊匣中有细声回应。");
      break;
    case "shellRemnant": {
      const extra = game.player.wasDamagedThisTurn;
      gainArmor(v.armor + (extra ? v.hurtArmor : 0), card.name, extra ? "本回合已受伤" : "");
      break;
    }
    case "guFeeding":
      drawCards(v.draw);
      discardRandomHand(v.discard, card.name);
      addLog(`你使用饲蛊术，抽 ${v.draw} 张牌后弃 ${v.discard} 张牌。`, "player-log");
      setBattleMessage("蛊虫啃食旧息，换来新的蛊鸣。");
      break;
    case "soulCrack":
      spendLifespan(v.lifespanCost, card.name);
      resolveAttack(card, v.damage, "裂魂");
      break;
    case "burnLife":
      // 先焚寿（累计入 burnedLifespanThisBattle），再按本场累计焚寿量加伤——本次焚的 2 点也计入。
      spendLifespan(v.lifespanCost, card.name);
      resolveAttack(card, v.damage + (game.burnedLifespanThisBattle || 0) * v.perBurn, `本场焚寿 ${game.burnedLifespanThisBattle || 0}`);
      break;
    case "erodeAge":
      resolveAttack(card, v.damage, "蚀岁夺寿");
      gainLifespan(v.lifeGain, card.name);
      break;
    case "focalLife":
      spendLifespan(v.lifespanCost, card.name);
      game.spellDoubleThisTurn = true;
      if (v.draw > 0) drawCards(v.draw);
      addLog(`你使用${card.name}，回光返照：本回合攻击蛊伤害翻倍${v.draw > 0 ? `，并抽 ${v.draw} 张牌` : ""}。`, "positive-log");
      setBattleMessage("回光返照，残寿尽燃，蛊术之力霎时暴涨。");
      break;
    case "mulberryField":
      spendLifespan(v.lifespanCost, card.name);
      game.enemy.weaken = (game.enemy.weaken || 0) + v.weaken;
      spawnFloatText(dom.enemyPortrait, `衰老 +${v.weaken}`, "resource-float");
      addLog(`你使用${card.name}，沧海桑田：${game.enemy.definition.name}衰老 +${v.weaken}（攻击意图共 -${game.enemy.weaken}）。`, "player-log");
      setBattleMessage("桑田易海，岁月加身，敌势随之老朽。");
      break;
    case "prolongLife":
      gainLifespan(v.lifeHeal, card.name);
      break;
    case "armorMeltPoison": {
      const removed = removeEnemyArmor(v.armorRemove, card.name);
      resolveAttack(card, v.damage, removed ? `蚀去防御 ${removed}` : "");
      applyEnemyPoison(v.poison, card.name);
      break;
    }
    case "bloodRobe": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      gainArmor(v.armor, card.name);
      const gained = gainActiveCardBlood(v.bloodGain);
      addLog(`血衣蛊缠身：失去 ${selfDamage} 点生命，血煞 +${gained}。`, "damage-log");
      break;
    }
    case "lifeLamp": {
      const fateBefore = game.player.fateMomentum;
      const wasFull = game.player.heroId === "fate" && fateBefore >= FATE_MOMENTUM_MAX;
      const gained = gainFateMomentum(v.fateGain);
      if (wasFull) healPlayer(v.heal, card.name);
      else if (gained > 0) addLog(`命灯蛊燃起，命势 +${gained}。`, "positive-log");
      else addLog("命灯蛊微燃，但未牵动你的命势。", "system-log");
      break;
    }
    case "returnBreath": {
      const bonusDraw = consumeActionEconomyFirstDraw("returnBreath", v.firstPerTurnDraw);
      const totalDraw = v.draw + bonusDraw;
      if (v.armor > 0) gainArmor(v.armor, card.name);
      drawCards(totalDraw);
      const discarded = v.discard > 0 ? discardRandomHand(v.discard, card.name) : 0;
      addLog(`回息蛊调匀气脉，抽 ${totalDraw} 张牌${discarded > 0 ? `并随机弃 ${discarded} 张` : ""}${v.armor > 0 ? `，获得 ${v.armor} 点防御` : ""}${bonusDraw > 0 ? "（本回合首次额外抽牌）" : ""}。`, "positive-log");
      break;
    }
    case "hiddenMeridian":
      gainArmor(v.armor, card.name);
      game.player.nextTurnArmor = (game.player.nextTurnArmor || 0) + v.nextTurnArmor;
      addLog(`伏脉蛊将 ${v.nextTurnArmor} 点防御伏入下回合。`, "positive-log");
      break;
    case "thunderGuide": {
      const linked = game.cardsPlayedThisTurn > 0;
      resolveAttack(card, v.damage + (linked ? v.comboDamage : 0), linked ? "雷意连携" : "");
      break;
    }
    case "apertureGuard":
      gainArmor(v.armor, card.name);
      break;
    case "emberRemnant": {
      drawCards(v.draw);
      const discarded = discardRandomHand(v.discard, card.name);
      if (discarded > 0) gainArmor(v.armor, card.name, "弃牌成功");
      break;
    }
    case "shadowBind":
      resolveAttack(card, v.damage, "缚影");
      gainArmor(v.armor, card.name);
      break;
    case "borrowLife":
      losePlayerHealth(v.selfDamage);
      game.player.energy += v.energy;
      drawCards(v.draw);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`借命蛊以 ${v.selfDamage} 点生命换得 ${v.energy} 点真元，并抽 ${v.draw} 张牌。`, "damage-log");
      break;
    case "jadeFang": {
      const guarded = game.player.armor > 0;
      resolveAttack(card, v.damage + (guarded ? v.guardedBonus : 0), guarded ? "借甲催牙" : "");
      break;
    }
    case "hollowNeedle": {
      const opening = game.cardsPlayedThisTurn === 0;
      resolveAttack(card, v.damage + (opening ? v.openingBonus : 0), opening ? "先机刺窍" : "");
      break;
    }
    case "coiledShell": {
      const lowHand = game.hand.length <= 3;
      gainArmor(v.armor + (lowHand ? v.lowHandArmor : 0), card.name, lowHand ? "收势盘蜕" : "");
      break;
    }
    case "mirrorCarapace": {
      const mirrored = game.enemy.armor > 0;
      gainArmor(v.armor + (mirrored ? v.enemyArmorBonus : 0), card.name, mirrored ? "照见敌甲" : "");
      break;
    }
    case "breathCicada": {
      const opening = game.cardsPlayedThisTurn === 0;
      gainArmor(v.armor, card.name, opening ? "开息" : "续息");
      if (opening) {
        game.player.energy += v.energy;
        spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      } else {
        drawCards(v.draw);
      }
      addLog(`吐纳蝉${opening ? `开息：真元 +${v.energy}` : `续息：抽 ${v.draw} 张牌`}。`, "positive-log");
      break;
    }
    case "yuanVessel":
      game.player.energy += v.energy;
      gainArmor(v.armor, card.name, "承元成甲");
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      break;
    case "rustMite": {
      const removed = removeEnemyArmor(v.armorRemove, card.name);
      applyEnemyPoison(v.poison + (removed > 0 ? v.corrodedPoison : 0), card.name);
      break;
    }
    case "silenceMoth": {
      const alreadyWeakened = game.enemy.weaken > 0;
      game.enemy.weaken = (game.enemy.weaken || 0) + v.weaken;
      spawnFloatText(dom.enemyPortrait, `衰老 +${v.weaken}`, "resource-float");
      gainArmor(v.armor + (alreadyWeakened ? v.weakenedArmor : 0), card.name, alreadyWeakened ? "旧声已息" : "");
      addLog(`息声蛾压低敌势：衰老 +${v.weaken}。`, "positive-log");
      break;
    }
    case "jadeMirrorFang": {
      const guarded = game.player.armor > 0;
      const mirrored = game.enemy.armor > 0;
      resolveAttack(card, v.damage + (guarded ? v.guardedBonus : 0), guarded ? "借甲催獠" : "");
      gainArmor(v.armor + (mirrored ? v.enemyArmorBonus : 0), card.name, mirrored ? "镜照敌甲" : "");
      break;
    }
    case "coiledNeedleShell": {
      const opening = game.cardsPlayedThisTurn === 0;
      const lowHand = game.hand.length <= 3;
      resolveAttack(card, v.damage + (opening ? v.openingBonus : 0), opening ? "针抢先机" : "");
      gainArmor(v.armor + (lowHand ? v.lowHandArmor : 0), card.name, lowHand ? "盘蜕收势" : "");
      break;
    }
    case "vesselBreathCicada": {
      const opening = game.cardsPlayedThisTurn === 0;
      game.player.energy += v.energy;
      gainArmor(v.armor, card.name, opening ? "承住初息" : "续息引蛊");
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      if (!opening) drawCards(v.draw);
      addLog(`承息玉蝉蛊承元护身${opening ? "。" : `，并抽 ${v.draw} 张牌。`}`, "positive-log");
      break;
    }
    case "rustSilenceMoth": {
      const alreadyWeakened = game.enemy.weaken > 0;
      const removed = removeEnemyArmor(v.armorRemove, card.name);
      applyEnemyPoison(v.poison + (removed > 0 ? v.corrodedPoison : 0), card.name);
      game.enemy.weaken = (game.enemy.weaken || 0) + v.weaken;
      spawnFloatText(dom.enemyPortrait, `衰老 +${v.weaken}`, "resource-float");
      gainArmor(v.armor + (alreadyWeakened ? v.weakenedArmor : 0), card.name, alreadyWeakened ? "寂意回甲" : "");
      addLog(`锈寂螟蛊蚀甲封声：衰老 +${v.weaken}。`, "positive-log");
      break;
    }
    case "longBreathGu": {
      drawCards(v.draw);
      if (v.discard > 0) discardRandomHand(v.discard, card.name, { active: true });
      if (v.armor > 0) gainArmor(v.armor, card.name);
      break;
    }
    case "chainThunderGu":
      resolveAttack(card, v.damage, "引雷成序");
      game.thunderSequence = { card: { ...card }, damage: v.sequenceDamage, cap: v.sequenceCap, triggers: 0 };
      break;
    case "calamityAshGu":
      game.calamityAsh = { card: { ...card }, damage: v.ashDamage, cap: v.ashCap, fullArmor: v.fullArmor, ashes: 0 };
      addLog(`劫灰已候：本回合主动弃牌与后续消耗将积灰，最多 ${v.ashCap}。`, "positive-log");
      break;
    case "redTideGu": {
      const plan = planRedTideStrike(game.player.blood, v);
      game.player.blood = plan.bloodAfter;
      const ecology = applyEcologyCounter(card, v, { bloodSpent: plan.bloodSpent, enemyArmor: game.enemy.armor });
      resolveAttack(card, plan.damage + ecology.bonusDamage, `吞煞 ${plan.bloodSpent} 层`);
      addLog(`${card.name}吞去 ${plan.bloodSpent} 层血煞，赤潮归于一击。`, "player-log");
      break;
    }
    case "lifePyreScorpion": {
      const actualBurn = spendLifespan(v.lifespanCost, card.name);
      const plan = planLifePyreStrike(actualBurn, v);
      const ecology = applyEcologyCounter(card, v, { actualBurn, enemyArmor: game.enemy.armor });
      resolveAttack(card, plan.damage + ecology.bonusDamage, `实际焚寿 ${actualBurn}`);
      break;
    }
    case "vicissitudeTurtle": {
      const plan = planVicissitudeTurtle(game.enemy.weaken, v, game.enemy.definition.ecologyTags || []);
      game.enemy.weaken = plan.weakenAfter;
      const ecology = applyEcologyCounter(card, v, { enemyArmor: game.enemy.armor });
      gainArmor(plan.armor, card.name, `衰老 ${plan.weakenAfter}/${v.armorScaleCap}`);
      if (plan.weakenAdded > 0) {
        spawnFloatText(dom.enemyPortrait, `衰老 +${plan.weakenAdded}`, "resource-float");
        addLog(`${card.name}吐出岁息：${game.enemy.definition.name}衰老 +${plan.weakenAdded}（本卡上限 ${v.weakenCap}）。`, "positive-log");
      } else if (plan.corpseImmune) {
        addLog(`${game.enemy.definition.name}带有「尸傀」生态，免疫${card.name}新增衰老。`, "system-log");
      } else {
        addLog(`${card.name}的衰老已达本卡上限 ${v.weakenCap}，仅按旧衰结甲。`, "system-log");
      }
      if (ecology.armorRemove > 0) setBattleMessage("岁纹爬上甲壳，旧甲随沧桑剥落。");
      break;
    }
    case "ashBreathMayfly":
      game.calamityAsh = { card: { ...card }, damage: v.ashDamage, cap: v.ashCap, fullArmor: v.fullArmor, ashes: 0 };
      drawCards(v.draw);
      if (v.discard > 0) discardRandomHand(v.discard, card.name, { active: true });
      if (v.armor > 0) gainArmor(v.armor, card.name);
      addLog(`劫息已候：主动弃牌、后续消耗与自身化灰将积灰，最多 ${v.ashCap}。`, "positive-log");
      break;
    case "returnThunderDragonfly":
      resolveAttack(card, v.damage, "回息引霆");
      game.thunderSequence = { card: { ...card }, damage: v.sequenceDamage, cap: v.sequenceCap, triggers: 0 };
      drawCards(v.draw);
      if (v.discard > 0) discardRandomHand(v.discard, card.name);
      if (v.armor > 0) gainArmor(v.armor, card.name);
      break;
    case "redTideBladeLeech": {
      const plan = planRedTideBladeLeech(game.player.blood, v);
      game.player.blood = plan.bloodAfterSpend;
      const ecology = applyEcologyCounter(card, v, { bloodSpent: plan.bloodSpent, enemyArmor: game.enemy.armor });
      resolveAttack(card, plan.damage + ecology.bonusDamage, `旧煞 ${plan.bloodSpent} 层`);
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      const gained = gainActiveCardBlood(v.bloodGain);
      addLog(`${card.name}先吞 ${plan.bloodSpent} 层旧煞，再反噬 ${selfDamage} 点生命，后生 ${gained} 层新煞。`, "damage-log");
      break;
    }
    case "lifePyreSandScorpion": {
      const actualBurn = spendLifespan(v.lifespanCost, card.name);
      const plan = planLifePyreSandScorpion(actualBurn, game.burnedLifespanThisBattle || 0, v);
      const ecology = applyEcologyCounter(card, v, { actualBurn, enemyArmor: game.enemy.armor });
      resolveAttack(card, plan.damage + ecology.bonusDamage, `实际焚寿 ${actualBurn} · 本场 ${plan.battleBurn}`);
      break;
    }
    case "witheredMulberryTurtle": {
      spendLifespan(v.lifespanCost, card.name);
      const plan = planWitheredMulberryTurtle(game.enemy.weaken, v, game.enemy.definition.ecologyTags || []);
      game.enemy.weaken = plan.weakenAfter;
      const ecology = applyEcologyCounter(card, v, { enemyArmor: game.enemy.armor });
      gainArmor(plan.armor, card.name, `衰老 ${plan.weakenAfter}/${v.weakenCap}`);
      addLog(plan.corpseImmune
        ? `${card.name}驮碑而守：尸傀无岁可老，仍结 ${plan.armor} 点岁甲。`
        : `${card.name}催生枯桑：敌人衰老 +${plan.weakenAdded}，岁甲 ${plan.armor}。`, "positive-log");
      if (ecology.armorRemove > 0) setBattleMessage("枯桑压甲，旧岁沿敌壳剥落。");
      break;
    }
    case "fateThread": {
      const empowered = game.player.fateMomentum >= 2;
      resolveAttack(card, empowered ? v.damage + v.fateBonus : v.damage, empowered ? "命势不少于 2 层" : "");
      break;
    }
    case "reversePath":
      gainArmor(v.armor, card.name);
      gainFateMomentum(v.fateGain);
      break;
    case "fixedFate": {
      const extra = Boolean(game.lastCardCategoryThisTurn) && game.lastCardCategoryThisTurn !== "defense";
      gainArmor(extra ? v.armor + v.conditionArmor : v.armor, card.name, extra ? "上一张牌不是护甲蛊" : "");
      break;
    }
    case "bloodSacrifice": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      const gained = gainActiveCardBlood(v.bloodGain);
      drawCards(v.draw);
      addLog(`血祭蛊反噬：失去 ${selfDamage} 点生命，血煞 +${gained}，抽 ${v.draw} 张牌。`, "damage-log");
      setBattleMessage("血祭入蛊，煞气沿着伤口回涌。");
      break;
    }
    case "bloodThirst":
      resolveAttack(card, v.damage + game.player.blood * v.bloodMultiplier, game.player.blood ? `${game.player.blood} 层血煞${v.bloodMultiplier > 1 ? `×${v.bloodMultiplier}` : ""}` : "");
      healPlayer(v.heal, card.name);
      break;
    case "greenMiasma":
      applyEnemyPoison(v.poison, card.name);
      setBattleMessage("青色瘴气吞没敌影，毒蛊开始啃噬经络。");
      break;
    case "insectSwarm":
      resolveAttack(card, v.damage);
      applyEnemyPoison(v.poison, card.name);
      break;
    case "moltingShell":
      gainArmor(v.armor, card.name);
      if (game.enemy.poison > 0) {
        drawCards(v.draw);
        addLog(`蜕壳蛊感应毒势：敌人已中毒，抽 ${v.draw} 张牌。`, "positive-log");
      }
      break;
    case "poisonReturn": {
      const empowered = game.enemy.poison >= v.poisonThreshold;
      resolveAttack(card, empowered ? v.damage + v.poisonBonus : v.damage, empowered ? `敌人毒性不少于 ${v.poisonThreshold} 层` : "");
      break;
    }
    case "scaleHiding":
      gainArmor(v.armor, card.name);
      gainDragonScale(v.scaleGain, card.name);
      break;
    case "reverseScale":
      losePlayerHealth(v.selfDamage);
      resolveAttack(card, v.damage, "逆鳞灼血");
      gainDragonScale(v.scaleGain, card.name);
      break;
    case "chiBreath":
      resolveAttack(card, v.damage + (game.dragon?.transformed ? v.transformedBonus : 0), game.dragon?.transformed ? "龙形螭息" : "");
      break;
    case "boneMolt":
      // V0.9.47：龙化期间免龙鳞消耗——此时龙鳞已归 0 且不可再得，直接抽牌+获甲，让蜕骨蛊在爆发窗口当过牌工具而非死牌卡手。
      if (game.dragon?.transformed) {
        drawCards(v.draw);
        gainArmor(v.armor, card.name, "蜕骨成甲");
        addLog(`${card.name}：龙化免龙鳞，抽 ${v.draw} 张牌并获得 ${v.armor} 点防御。`, "positive-log");
      } else if (spendDragonScale(v.scaleCost, card.name)) {
        drawCards(v.draw);
        gainArmor(v.armor, card.name, "蜕骨成甲");
      }
      break;
    case "cloudHorn":
      if (game.dragon?.transformed) {
        if (!game.dragon.extendedThisTransform) {
          game.dragon.turnsRemaining += v.extendTurns;
          game.dragon.extendedThisTransform = true;
          addLog(`${card.name}牵云续形：龙化延长 ${v.extendTurns} 回合。`, "positive-log");
        } else {
          addLog(`${card.name}的续形之力本次龙化已用尽。`, "system-log");
        }
      } else {
        gainDragonScale(v.scaleGain, card.name);
      }
      break;
    case "bloodMoon": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      const bloodBefore = getActiveBloodAttackSnapshot();
      losePlayerHealth(selfDamage);
      resolveAttack(card, v.damage + (bloodBefore > 0 ? bloodBefore * v.bloodMultiplier : 0), bloodBefore > 0 ? `${bloodBefore} 层血煞` : "");
      addLog(`血月蛊反噬：你失去 ${selfDamage} 点生命。`, "damage-log");
      break;
    }
    case "moltedArmor":
      gainArmor(v.armor, card.name);
      if (!game.player.wasDamagedThisTurn) {
        drawCards(v.draw);
        addLog(`蜕甲蛊完整铺展：本回合未受伤，抽 ${v.draw} 张牌。`, "positive-log");
      }
      break;
    case "rotMiasma": {
      const wasPoisoned = game.enemy.poison > 0;
      applyEnemyPoison(v.poison, card.name, { forceCorrosion: wasPoisoned });
      setBattleMessage("腐瘴入体，毒蛊沿伤口钻入敌影。");
      break;
    }
    case "fateSever":
      gainFateMomentum(v.fateGain);
      drawCards(v.draw);
      if (v.energy) {
        game.player.energy += v.energy;
        spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      }
      spendLifespan(v.lifespanCost, card.name);
      addLog(`你使用断命蛊，命势 +${v.fateGain}，抽 ${v.draw} 张牌。`, "player-log");
      break;
    case "leechBlade": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      const dealt = resolveAttack(card, v.damage, "血蛭噬咬");
      const heal = Math.max(v.minHeal, Math.floor(dealt * v.healRate));
      healPlayer(heal, card.name);
      addLog(`血蛭刃反噬：你失去 ${selfDamage} 点生命。`, "damage-log");
      break;
    }
    case "drunkFateWorm":
      game.player.drunkStacks = Math.min((game.player.drunkStacks || 0) + 1, DRUNK_MAX_STACKS);
      if (game.fateGainedThisTurn) {
        drawCards(v.draw);
        addLog(`醉命虫牵动命势：本回合已获得命势，抽 ${v.draw} 张牌。`, "positive-log");
      }
      addLog(`你使用醉命虫，下一张攻击蛊伤害×${getDrunkMultiplier(game.player.drunkStacks)}（酒意 ${game.player.drunkStacks} 层）。`, "player-log");
      setBattleMessage(`醉意入命：下次攻击×${getDrunkMultiplier(game.player.drunkStacks)}（${game.player.drunkStacks} 层）。`);
      break;
    case "soulBurn":
      losePlayerHealth(v.selfDamage);
      game.player.energy += v.energy;
      game.player.nextCardCostReduction = Math.max(game.player.nextCardCostReduction, v.costReduction);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用魂燃蛊，失去 ${v.selfDamage} 点生命，获得 ${v.energy} 点真元；下一张蛊牌消耗 -${v.costReduction}。`, "damage-log");
      break;
    case "resonantCarapace":
      sacrificeBoneArmor(v.shatter, card.name);
      gainArmor(v.armor, card.name);
      game.bone.afterEchoPrimed = true;
      game.bone.afterEchoDamage = v.enemyBreakDamage;
      game.bone.afterEchoDraw = v.enemyBreakDraw;
      game.bone.afterEchoSourceName = card.name;
      addLog(`${card.name}伏入甲缝：等待敌人击碎防御。`, "positive-log");
      break;
    case "emberArmorPiercer": {
      const hasArmor = (game.enemy.armor || 0) > 0;
      resolveAttack(card, v.damage + (hasArmor ? v.armorBonus : 0), hasArmor ? "烬穿敌甲" : "");
      drawCards(v.draw);
      const discarded = discardRandomHand(v.discard, card.name);
      if (discarded > 0) gainArmor(v.armor, card.name, "弃牌成甲");
      break;
    }
    case "woundedArmorFang": {
      const hasArmor = (game.enemy.armor || 0) > 0;
      const hurt = Boolean(game.player.wasDamagedThisTurn);
      resolveAttack(card, v.damage + (hasArmor ? v.armorBonus : 0), hasArmor ? "伤牙破甲" : "");
      gainArmor(v.armor + (hurt ? v.hurtArmor : 0), card.name, hurt ? "本回合已受伤" : "");
      break;
    }
    case "chimingJointBreaker": {
      const shattered = sacrificeBoneArmor(v.shatter, card.name);
      resolveAttack(card, v.damage + shattered, shattered ? `碎甲 +${shattered}` : "");
      gainArmor(v.armor, card.name);
      game.enemy.weaken = (game.enemy.weaken || 0) + v.weaken;
      spawnFloatText(dom.enemyPortrait, `衰老 +${v.weaken}`, "resource-float");
      break;
    }
    case "thunderBoneCourt": {
      const linked = game.cardsPlayedThisTurn > 0;
      resolveAttack(card, v.damage + (linked ? v.comboDamage : 0), linked ? "雷骨连携" : "");
      gainArmor(v.armor + game.bone.resonance * v.perBoneArmor, card.name, `${game.bone.resonance} 点骨鸣`, { suppressBone: true });
      break;
    }
    case "hiddenThunderMeridian": {
      const linked = game.cardsPlayedThisTurn > 0;
      resolveAttack(card, v.damage + (linked ? v.comboDamage : 0), linked ? "伏雷连携" : "");
      gainArmor(v.armor, card.name);
      game.player.nextTurnArmor = (game.player.nextTurnArmor || 0) + v.nextTurnArmor;
      break;
    }
    case "bloodSwarmBlade": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      const bloodBefore = getActiveBloodAttackSnapshot();
      losePlayerHealth(selfDamage);
      const gained = gainActiveCardBlood(v.bloodGain);
      const comboDamage = game.cardsPlayedThisTurn * v.perPlayed;
      resolveAttack(card, v.damage + bloodBefore * v.bloodMultiplier + comboDamage,
        `${bloodBefore} 层血煞；此前出牌 ${game.cardsPlayedThisTurn} 张`);
      addLog(`${card.name}反噬：失去 ${selfDamage} 点生命，血煞 +${gained}。`, "damage-log");
      break;
    }
    case "borrowedBloodRobe": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      gainArmor(v.armor, card.name);
      const gained = gainActiveCardBlood(v.bloodGain);
      game.player.energy += v.energy;
      drawCards(v.draw);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`${card.name}借命成衣：失去 ${selfDamage} 点生命，血煞 +${gained}，真元 +${v.energy}，抽 ${v.draw} 张牌。`, "damage-log");
      break;
    }
    case "meridianBloodRobe": {
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      gainArmor(v.armor, card.name);
      const gained = gainActiveCardBlood(v.bloodGain);
      drawCards(v.draw);
      addLog(`${card.name}移窍成衣：失去 ${selfDamage} 点生命，血煞 +${gained}，抽 ${v.draw} 张牌。`, "damage-log");
      break;
    }
    case "heartLeech": {
      const empowered = game.player.blood >= 2;
      const damage = v.damage + game.player.blood * v.bloodMultiplier + (empowered ? v.empoweredDamage : 0);
      resolveAttack(card, damage, empowered ? "血煞噬心" : "嗜血回命");
      healPlayer(v.heal, card.name);
      break;
    }
    case "tideReturningBlood": {
      const bloodBefore = game.player.blood;
      resolveAttack(card, v.damage + game.player.blood * v.bloodMultiplier, `${bloodBefore} 层血煞×${v.bloodMultiplier}`);
      game.player.blood -= v.bloodCost;
      healPlayer(v.heal, card.name);
      addLog(`${card.name}吞去 ${v.bloodCost} 层血煞，潮势返命。`, "positive-log");
      break;
    }
    case "lastLightHeart": {
      spendLifespan(v.lifespanCost, card.name);
      game.spellDoubleThisTurn = true;
      if (v.draw > 0) drawCards(v.draw);
      const empowered = game.player.blood >= 2;
      resolveAttack(card, empowered ? v.empoweredDamage : v.damage, empowered ? "回光噬心" : "回光一击");
      break;
    }
    case "venomArmorEcho": {
      const removed = removeEnemyArmor(v.armorRemove, card.name);
      const poisoned = game.enemy.poison >= v.poisonThreshold;
      resolveAttack(card, v.damage + (poisoned ? v.poisonBonus : 0), removed ? `蚀去防御 ${removed}` : "");
      applyEnemyPoison(v.poison, card.name);
      break;
    }
    case "miasmaShadowCarapace":
      resolveAttack(card, v.damage, "瘴影缠身");
      gainArmor(v.armor, card.name);
      applyEnemyPoison(v.poison, card.name);
      break;
    case "pyreBloom": {
      spendLifespan(v.lifespanCost, card.name);
      const burned = game.burnedLifespanThisBattle || 0;
      resolveAttack(card, v.damage + burned * v.perBurn, `本场焚寿 ${burned}`);
      healPlayer(v.heal, card.name);
      break;
    }
    case "essenceSoulRend":
      losePlayerHealth(v.selfDamage);
      spendLifespan(v.lifespanCost, card.name);
      game.player.energy += v.energy;
      drawCards(v.draw);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      resolveAttack(card, v.damage, "燃元裂魂");
      break;
    case "aeonLeech":
      resolveAttack(card, v.damage, "蚀岁续命");
      gainLifespan(v.lifeHeal, card.name);
      break;
    case "fatedMoonGuard": {
      const extra = Boolean(game.lastCardCategoryThisTurn) && game.lastCardCategoryThisTurn !== "defense";
      resolveAttack(card, v.damage, "定月");
      gainArmor(v.armor + (extra ? v.conditionArmor : 0), card.name, extra ? "上一张牌不是护甲蛊" : "");
      break;
    }
    case "apertureCurrentGuard":
      gainArmor(v.armor, card.name);
      game.player.energy += v.energy;
      game.supportDrawPrimed = Math.max(game.supportDrawPrimed || 0, v.supportDraw);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      break;
    case "mysticEssenceCarapace":
      game.player.energy += v.energy;
      drawCards(v.draw);
      gainArmor(v.armor, card.name);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      break;
    case "dragonMoltBreath": {
      const transformed = Boolean(game.dragon?.transformed);
      if (transformed || spendDragonScale(v.scaleCost, card.name)) {
        drawCards(v.draw);
        gainArmor(v.armor, card.name, "蜕骨成甲");
        resolveAttack(card, v.damage + (transformed ? v.transformedBonus : 0), transformed ? "龙形螭息" : "蜕骨螭息");
      }
      break;
    }
    case "circulatingScaleMolt": {
      const transformed = Boolean(game.dragon?.transformed);
      if (transformed || spendDragonScale(v.scaleCost, card.name)) {
        drawCards(v.draw);
        gainArmor(v.armor, card.name, "藏蜕成甲");
        gainDragonScale(v.scaleGain, card.name);
      }
      break;
    }
    case "stormReverseHorn":
      losePlayerHealth(v.selfDamage);
      resolveAttack(card, v.damage, "逆云破势");
      if (game.dragon?.transformed) {
        if (!game.dragon.extendedThisTransform) {
          game.dragon.turnsRemaining += v.extendTurns;
          game.dragon.extendedThisTransform = true;
          addLog(`${card.name}逆云续形：龙化延长 ${v.extendTurns} 回合。`, "positive-log");
        }
      } else {
        gainDragonScale(v.scaleGain, card.name);
      }
      break;
    case "venomMoltCarapace": {
      const wasPoisoned = game.enemy.poison > 0;
      gainArmor(v.armor, card.name);
      if (wasPoisoned) {
        drawCards(v.draw);
        addLog(`毒蜕铁甲蛊感应既存毒势：抽 ${v.draw} 张牌。`, "positive-log");
      }
      break;
    }
    case "sacrificialMarshRobe": {
      const bloodBefore = Math.max(0, game.player.blood || 0);
      const spent = Math.min(v.bloodCap, bloodBefore);
      game.player.blood -= spent;
      gainArmor(v.armor + spent * v.perBloodArmor, card.name, spent ? `吞下 ${spent} 层旧血煞` : "无旧煞可吞");
      if (spent >= v.bloodCap) drawCards(v.draw);
      const selfDamage = getActiveCardSelfDamage(v.selfDamage);
      losePlayerHealth(selfDamage);
      const gained = gainActiveCardBlood(v.bloodGain);
      addLog(`祭沼血甲先吞 ${spent} 层旧血煞成甲${spent >= v.bloodCap ? `并抽 ${v.draw} 张牌` : ""}，再失去 ${selfDamage} 点生命、补回 ${gained} 层血煞。`, "damage-log");
      break;
    }
    case "mutantBlade":
      losePlayerHealth(v.selfDamage);
      resolveAttack(card, v.damage, "异变锋芒");
      addLog(`异刃蛊噬主：你失去 ${v.selfDamage} 点生命。`, "damage-log");
      break;
    case "mutantArmor":
      gainArmor(v.armor, card.name);
      discardRandomHand(v.discard, "异甲蛊");
      break;
    case "mutantPoison":
      applyEnemyPoison(v.poison, card.name);
      losePlayerHealth(v.selfDamage);
      addLog(`异毒蛊腐蚀掌心：你失去 ${v.selfDamage} 点生命。`, "damage-log");
      break;
    case "mutantFate":
      game.player.energy += v.energy;
      drawCards(v.draw);
      spendLifespan(v.lifespanCost, card.name);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用异命蛊，获得 ${v.energy} 点真元并抽 ${v.draw} 张牌。`, "positive-log");
      break;
    case "boneBell":
      gainArmor(v.armor, card.name);
      game.enemy.weaken = (game.enemy.weaken || 0) + v.weaken;
      spawnFloatText(dom.enemyPortrait, `衰老 +${v.weaken}`, "resource-float");
      addLog(`骨铃乱响：${game.enemy.definition.name}衰老 +${v.weaken}（攻击意图共 -${game.enemy.weaken}）。`, "player-log");
      setBattleMessage("骨铃摄魂，敌势随幽响衰落。");
      break;
    case "knockArmor":
      sacrificeBoneArmor(v.shatter, card.name);
      gainArmor(v.armor, card.name);
      break;
    case "breakJoint": {
      const shattered = sacrificeBoneArmor(v.shatter, card.name);
      resolveAttack(card, v.damage + shattered, shattered ? `碎甲 +${shattered}` : "");
      break;
    }
    case "afterEcho":
      game.bone.afterEchoPrimed = true;
      game.bone.afterEchoDamage = v.damage;
      game.bone.afterEchoDraw = v.draw;
      game.bone.afterEchoSourceName = card.name;
      addLog("余响蛊伏入骨腔：等待敌人击碎防御。", "positive-log");
      break;
    case "boneCourt":
      gainArmor(v.armor + game.bone.resonance * v.perBoneArmor, card.name, `${game.bone.resonance} 点骨鸣`, { suppressBone: true });
      break;
    case "chaosBee": {
      const wasPoisoned = game.enemy.poison > 0;
      resolveAttack(card, v.damage, wasPoisoned ? "群蜂追毒" : "蜂刺齐发");
      applyEnemyPoison(v.poison + (wasPoisoned ? v.poisonedBonus : 0), card.name);
      break;
    }
    case "bloodMarshGu": {
      const spent = Math.min(v.bloodCap, Math.max(0, game.player.blood || 0));
      game.player.blood -= spent;
      gainArmor(v.armor + spent * v.perBloodArmor, card.name, spent ? `吞下 ${spent} 层血煞` : "无血可吞");
      if (spent >= v.bloodCap) drawCards(v.draw);
      addLog(`血沼蛊吞下 ${spent} 层血煞，化出 ${v.armor + spent * v.perBloodArmor} 点防御${spent >= v.bloodCap ? `，并抽 ${v.draw} 张牌` : ""}。`, "positive-log");
      break;
    }
    default:
      break;
  }
  applyResourcePostCapBattleValue(card, v);
}

function applyResourcePostCapBattleValue(card, values = getCardValues(card)) {
  if (!game?.player || game.player.hp <= 0) return;
  const level = getUpgradeLevel(card);
  const gains = getResourcePostCapValues(card?.key, level);
  if (!Object.keys(gains).length) return;
  const base = getCardBaseValues(card, level);
  if (gains.armor > 0 && values.armor > 0 && typeof base.armor !== "number") {
    gainArmor(values.armor, card.name, "升转余势");
  }
  if (gains.heal > 0 && values.heal > 0 && typeof base.heal !== "number") {
    healPlayer(values.heal, card.name);
  }
  if (gains.poison > 0 && values.poison > 0 && typeof base.poison !== "number") {
    applyEnemyPoison(values.poison, card.name);
  }
  if (gains.weaken > 0 && values.weaken > 0 && typeof base.weaken !== "number" && game.enemy) {
    game.enemy.weaken = (game.enemy.weaken || 0) + values.weaken;
    spawnFloatText(dom.enemyPortrait, `衰老 +${values.weaken}`, "resource-float");
  }
}

function losePlayerHealth(amount) {
  normalizeBattlePlayerHealth(game?.player, runState?.currentHp, HEROES[game?.player?.heroId]?.maxHp);
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return;
  // V0.9.12.1：玩家已倒下后不再结算自损（如毒发致死后血溟囊仍会触发），防止覆写真实死因来源。
  if (game.player.hp <= 0) return;
  // V0.9.12.1 死因修复：自损扣血统一标记来源，否则自损致死会沿用上次受击的 enemyAttack、死因误报"护甲不足"。
  game.lastHurtSource = "selfCard";
  const beforeHp = game.player.hp;
  game.player.hp = Math.max(0, game.player.hp - safeAmount);
  const actualLost = beforeHp - game.player.hp;
  checkHeroLowLife(beforeHp);
  if (actualLost > 0 && game?.player?.heroId === "blood" && game.activeCardContext?.cardSnapshot?.type === "blood") triggerHeroVoice("sacrifice");
  recordMupanCostDelta(getRunStats(), "selfHpLost", beforeHp, game.player.hp, "active");
  game.player.wasDamagedThisTurn = true;
  spawnFloatText(document.querySelector(".player-portrait"), `-${actualLost}`, "");
  animateHit(document.querySelector(".player-portrait"));
  pulseElement(dom.playerHpBar, "hp-damage-pulse", 520);
  playPlayerHitEffect();
  checkTailCutRelic();
  // V0.9.9.2 血偿契：受伤时按损失生命的一半转为血煞
  if (game?.player?.heroId === "blood" && hasOrdinaryRelic("bloodRepay")) {
    const __b = Math.floor(actualLost / 2);
    if (__b > 0) { gainBlood(__b); addLog(`血偿契：以伤化煞，血煞 +${__b}。`, "positive-log"); notifyRelicTrigger("bloodRepay", `以伤化煞·血煞+${__b}`); }
  }
  // V0.9.51 浊血契：每场战斗首次自损额外化血煞（latch 在 createBattleState 每场重置）。
  if (actualLost > 0 && !game.contractTurbidBloodUsed && typeof getContractFirstHurtBloodshaBonus === "function") {
    const __tb = getContractFirstHurtBloodshaBonus(runState);
    if (__tb > 0) {
      game.contractTurbidBloodUsed = true;
      gainBlood(__tb);
      addLog(`浊血契：首损即浊，血煞 +${__tb}。`, "positive-log");
      getRunStats().contractTurbidBloodTriggers = safeStatNumber(getRunStats().contractTurbidBloodTriggers) + 1;
    }
  }
}

// V0.9.36 B-5b: tail-cut relic trigger moved to nmg-relics.js.

function discardRandomHand(count, sourceName, { active = true } = {}) {
  let discarded = 0;
  for (let i = 0; i < count; i += 1) {
    if (!game.hand.length) break;
    const index = getRunRandomInt(game.hand.length, "draw");
    const [card] = game.hand.splice(index, 1);
    game.discardPile.push(card);
    discarded += 1;
  }
  if (discarded > 0) {
    if (active) registerCalamityAsh("主动弃牌", discarded);
    addLog(`${sourceName}弃去 ${discarded} 张随机手牌。`, "damage-log");
    playDiscardCardEffect(discarded);
  }
  return discarded;
}

function applySkewPenalty(card) {
  if (!card.skewed || game.status !== "playing") return;
  if (card.category === "defense") {
    discardRandomHand(1, `${card.name}偏斜`, { active: false });
    return;
  }
  if (card.category === "attack" || card.type === "poison" || (card.typeName || "").includes("毒道")) {
    losePlayerHealth(1);
    addLog(`${card.name}偏斜反噬：你失去 1 点生命。`, "damage-log");
    return;
  }
  // V0.9.12.1：偏斜焚寿是"反噬"而非主动焚寿——不走 spendLifespan，不计入 burnedLifespanThisBattle（否则对朝暮反成焚寿加伤收益）、不触发薪火符以寿换甲。
  // 反噬不致死：朝暮（寿尽即陨）保底燃至剩 1 寿——否则寿元剩 1 时一张"看似免费"的辅助牌会无预警杀死玩家；其余蛊修照旧夹 0 无死亡风险。
  const beforeLife = game.player.lifespan;
  const floorLife = game.player.heroId === "longevity" ? 1 : 0;
  game.player.lifespan = Math.max(floorLife, beforeLife - 1);
  recordMupanCostDelta(getRunStats(), "lifespanSpent", beforeLife, game.player.lifespan, "active");
  if (game.player.lifespan < beforeLife) {
    spawnFloatText(document.querySelector(".player-portrait"), "-1 寿元", "resource-float");
    addLog(`${card.name}偏斜反噬：燃去 1 点寿元。`, "damage-log");
  } else {
    addLog(`${card.name}偏斜反噬：你的寿元已近枯竭，反噬未能再燃。`, "system-log");
  }
}

function gainBlood(baseAmount) {
  const before = game.player.blood;
  game.player.blood = Math.min(getBloodMax(), game.player.blood + baseAmount);
  const gained = game.player.blood - before;
  spawnFloatText(dom.playerPortrait, `+${gained} 血煞`, "blood-float");
  // V0.9.20 赤茧蛊·真形：每场首次血煞满溢时恢复 4 点生命
  if (isLegacyBenmingRun(runState) && benmingPassive("blood", 3) && game.player.blood >= getBloodMax() && !game.benmingBloodFullHealed) {
    game.benmingBloodFullHealed = true;
    healPlayer(4, "赤茧蛊");
    addLog("赤茧蛊破茧吮煞：血煞满溢，恢复 4 点生命。", "positive-log");
  }
  if (gained > 0) {
    playBloodGainEffect();
    if (hasOrdinaryRelic("bloodJadeCup") && (game.combatRelic?.bloodJadeHealsThisTurn || 0) < 2) {
      game.combatRelic.bloodJadeHealsThisTurn += 1;
      healPlayer(1, "血玉盏");
      addLog("血玉盏汲煞回温：恢复 1 点生命。", "positive-log");
      notifyRelicTrigger("bloodJadeCup", "汲煞·回血 1");
    }
  }
  return gained;
}

function healPlayer(amount, sourceName) {
  normalizeBattlePlayerHealth(game?.player, runState?.currentHp, HEROES[game?.player?.heroId]?.maxHp);
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return 0;
  const before = game.player.hp;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + safeAmount);
  const healed = game.player.hp - before;
  recordHealing(healed, sourceName);
  spawnFloatText(document.querySelector(".player-portrait"), `+${healed} 生命`, "heal-float");
  if (healed > 0) {
    triggerHeroVoice("restore");
    pulseElement(dom.playerHpBar, "hp-heal-pulse", 560);
    playHealEffect();
    if (getCardEffectType(game.activeCardContext?.cardSnapshot) === "blood") playBloodReturnEffect();
  }
  addLog(`你使用${sourceName}，恢复 ${healed} 点生命。`, "positive-log");
  setBattleMessage("枯败血肉重现生机，命火暂得喘息。");
}

function spendLifespan(amount, sourceName) {
  if (amount <= 0) return 0;
  const before = game.player.lifespan;
  game.player.lifespan = Math.max(0, before - amount);
  recordMupanCostDelta(getRunStats(), "lifespanSpent", before, game.player.lifespan, "active");
  // V0.9.9 寿道·子批3：累计本场「主动焚寿」真实减少量（夹 0 后的实际差值），供焚寿蛊加伤。敌啃寿不计入（非主动焚寿）。
  const __grossBurn = before - game.player.lifespan; // V0.9.51 #29：焚寿毛值，须在灯芯蛊返还之前取
  game.burnedLifespanThisBattle = (game.burnedLifespanThisBattle || 0) + __grossBurn;
  if (before > game.player.lifespan && game.player.heroId === "longevity") triggerHeroVoice("burn");
  spawnFloatText(document.querySelector(".player-portrait"), `-${amount} 寿元`, "resource-float");
  addLog(`${sourceName}燃去 ${amount} 点寿元。`, "damage-log");
  // V0.9.9 寿道·子批2b：战斗内焚寿把寿元烧到归零＝寿尽而陨。before>0 守卫确保只有"这次焚寿跨过 0"才触发（开局即 0 入场不致死）。
  markLifespanDeathIfExhausted(before);
  // V0.9.51 #27 燃烬衣：每场首次焚寿 +1 真元（每场限一次，latch 在 combatRelic）
  if (hasOrdinaryRelic("emberRobe") && !game.combatRelic?.emberRobeUsed && before - game.player.lifespan > 0) {
    if (game.combatRelic) game.combatRelic.emberRobeUsed = true;
    game.player.energy += 1;
    spawnFloatText(dom.playerPortrait, "+1 真元", "yuan-float");
    addLog("燃烬衣引焰：本场首次焚寿，真元 +1。", "positive-log");
    notifyRelicTrigger("emberRobe", "首焚·真元+1");
  }
  // V0.9.57 烬灯：与燃烬衣同为「本场首次焚寿」，但给的是防御；两枚可叠，各记各的 latch。
  if (before - game.player.lifespan > 0 && typeof applyAshLanternOnBurn === "function") applyAshLanternOnBurn();
  // V0.9.9.2 薪火符：焚寿时每焚 1 点寿元额外获得 1 点护甲（以寿换甲）
  if (hasOrdinaryRelic("lifeKindle")) {
    const __burned = before - game.player.lifespan;
    if (__burned > 0) { game.player.armor += __burned; recordArmorGained(__burned); spawnFloatText(dom.playerPortrait, `+${__burned} 护甲`, "defense-float"); notifyRelicTrigger("lifeKindle", `以寿换甲·护甲+${__burned}`); }
  }
  // V0.9.20 灯芯蛊·成虫：每局首次主动焚寿返还 1 点寿元（灯芯不灭）
  if (benmingPassive("longevity", 2) && !runState.benmingBurnRefunded && before - game.player.lifespan > 0) {
    runState.benmingBurnRefunded = true;
    gainLifespan(1, "灯芯蛊");
    // V0.9.32.1 修结算顺序：上方 markLifespanDeathIfExhausted(before) 已 latch 了「寿尽而陨」；
    // 灯芯不灭把寿元续回 >0 后，本次焚寿并未真正烧尽——必须撤销该 latch，否则保命被静默吞掉、玩家满血却寿尽白死。
    if (game.player.lifespan > 0 && game.lifespanDeath) {
      game.lifespanDeath = false;
      if (game.lastHurtSource === "lifespanExhausted") game.lastHurtSource = "selfCard";
    }
    addLog("灯芯蛊回芯：本局首次焚寿，返还 1 点寿元。", "positive-log");
  }
  // V0.9.51 #29 朝暮回灯：每回合首次焚寿按焚量回血（五转 1.5 倍）。latch 每回合重置。
  if (typeof getDuskRelightHeal === "function" && game.player.heroId === "longevity" && !game.duskRelightUsedThisTurn) {
    // 与积薪成炬同口径用毛值：灯芯蛊的返还是另一份恩惠，不该反过来削减本路线的转化量。
    const __heal = getDuskRelightHeal(getEffectiveBenmingStage("longevity"), getRunBenmingPath(runState), __grossBurn);
    if (__heal > 0) {
      game.duskRelightUsedThisTurn = true;
      healPlayer(__heal, "朝暮回灯");
      addLog(`朝暮回灯：焚去 ${__grossBurn} 点寿元，换回 ${__heal} 点生命。`, "positive-log");
    }
  }
  // V0.9.51 短烛契：每次主动焚寿后，下一张蛊牌费用 -1（Math.max 不叠加，照魂燃蛊先例）。
  // 必须放在灯芯蛊回芯之后：灯芯把寿元续回、撤销寿尽 latch 的救命局，这次焚寿仍应给折扣；
  // 真寿尽（latch 未被撤销）那一下才不给。
  if (typeof isContractShortCandle === "function" && isContractShortCandle(runState)
    && before - game.player.lifespan > 0 && !game.lifespanDeath) {
    game.player.nextCardCostReduction = Math.max(game.player.nextCardCostReduction || 0, 1);
    getRunStats().contractCandleDiscounts = safeStatNumber(getRunStats().contractCandleDiscounts) + 1;
    addLog("短烛契：烛短火密，下一张蛊牌消耗 -1。", "positive-log");
  }
  // 返回全部返还与免耗结算后的净减少量；燃命蝎只按真正付出的寿元获利。
  return Math.max(0, before - game.player.lifespan);
}

// V0.9.9 寿道·子批3：续回寿元（夹 maxLifespan 上限）。蚀岁/续命用。
function gainLifespan(amount, sourceName) {
  if (amount <= 0) return;
  const max = game.player.maxLifespan ?? game.player.definition?.lifespan ?? game.player.lifespan;
  const before = game.player.lifespan;
  game.player.lifespan = Math.min(max, before + amount);
  const gained = game.player.lifespan - before;
  if (gained > 0) {
    spawnFloatText(document.querySelector(".player-portrait"), `+${gained} 寿元`, "resource-float");
    addLog(`${sourceName}续回 ${gained} 点寿元。`, "positive-log");
  } else {
    addLog(`${sourceName}：寿元已满，无可续回。`, "system-log");
  }
}

// V0.9.9 寿道·子批2b：寿元由 >0 被本次扣减压到 ≤0 时标记寿尽死亡（由 checkBattleResult 收口）。
function markLifespanDeathIfExhausted(before) {
  // 寿尽即陨为朝暮（寿道）专属机制，与子批2a「焚寿燃命」伤害加成同口径（仅 longevity 吃）；
  // 其余蛊修焚寿仅夹 0、不致死，沿用旧行为（命势/血道/毒道未围绕寿元死亡线做平衡）。
  if (game.player.heroId !== "longevity") return;
  // 已被本次行动的 HP 伤害击杀时不抢死因：避免把致命的 HP 一击误标成「寿元焚尽」（敌啃寿块在 HP 伤害之后结算）。
  if (game.player.hp <= 0) return;
  if (before > 0 && game.player.lifespan <= 0) {
    game.lifespanDeath = true;
    game.lastHurtSource = "lifespanExhausted";
  }
}

function gainArmor(baseAmount, sourceName, detail = "", options = {}) {
  if (isBoneHero() && game.bone.cardArmorLockedThisTurn && game.activeCardContext && isActiveCardSource(sourceName)) {
    addLog(`断命余震未散：${sourceName}本回合不能再以蛊牌获得防御。`, "damage-log");
    return 0;
  }
  const amount = baseAmount + game.defenseBonus + getDragonDefenseBonus();
  game.player.armor += amount;
  recordDragonDefenseResult(amount);
  recordArmorGained(amount, sourceName);
  recordBoneArmorGain(amount, sourceName, options);
  flashCombatResource(".armor-resource");
  spawnFloatText(document.querySelector(".player-portrait"), `+${amount} 护甲`, "defense-float");
  playArmorEffect();
  addLog(`你使用${sourceName}，获得 ${amount} 点防御${detail ? `（${detail}）` : ""}。`, "positive-log");
  setBattleMessage("蛊甲覆体，替你承受来袭的杀机。");
  return amount;
}

function removeEnemyArmor(amount, sourceName) {
  const before = game.enemy.armor || 0;
  if (before <= 0 || amount <= 0) return 0;
  const removed = Math.min(before, amount);
  game.enemy.armor = Math.max(0, before - removed);
  spawnFloatText(dom.enemyPortrait, `-${removed} 防御`, "defense-float");
  addLog(`${sourceName}蚀去${game.enemy.definition.name} ${removed} 点防御。`, "poison-log");
  return removed;
}

function getCardFlowType(card) {
  if (card.category === "attack") return "attack";
  if (card.category === "defense") return "defense";
  return "utility";
}

function getCardFlowName(flowType) {
  return ({ attack: "攻击", defense: "护甲", utility: "辅助" })[flowType] || "未知";
}

function getActiveFateBenmingPath() {
  if (!game || !runState || game.player?.heroId !== "fate" || !benmingPassive("fate", 3)) return null;
  return getRunBenmingPath(runState);
}

// 无名逆命者的核心循环：牌面命势先结算，随后才处理牌类流转与三相。
function applyFateCardFlow(card) {
  if (game.player.heroId !== "fate") return;
  const currentFlow = getCardFlowType(card);
  const lastFlow = game.player.lastCardFlowType;
  const pathId = getActiveFateBenmingPath();
  const chainFate = hasOrdinaryRelic("chainFate");

  if (pathId === "threeWeave") {
    const result = resolveFateTriadFlow(
      game.fateTriad,
      game.fateTriadGraceUsedThisTurn,
      currentFlow,
      lastFlow,
      chainFate,
      benmingPassive("fate", 5),
    );
    game.fateTriad = result.sequence;
    game.fateTriadGraceUsedThisTurn = result.graceUsed;
    if (result.completed) {
      getRunStats().fateTriads = (getRunStats().fateTriads || 0) + 1;
      addLog("三相织命：攻击、护甲、辅助三类各已打出一张，本张牌额外获得命势。", "important");
      const routeGuard = planFateRouteGuard("threeWeave", "triadComplete", game.fateRouteGuardUsedThisTurn);
      game.fateRouteGuardUsedThisTurn = routeGuard.used;
      if (routeGuard.armor > 0) {
        game.player.armor += routeGuard.armor;
        recordArmorGained(routeGuard.armor);
        spawnFloatText(dom.playerPortrait, `三相护持 +${routeGuard.armor}`, "defense-float");
        addLog(`三相护持：本回合首次凑齐三类牌，获得 ${routeGuard.armor} 点防御。`, "positive-log");
      }
    } else if (result.graceConsumed) {
      addLog(`三相织命·五转：本回合第一次重复${getCardFlowName(currentFlow)}类型，这次不会重新起算。`, "positive-log");
    } else if (result.repeated) {
      addLog(`三相织命：${getCardFlowName(currentFlow)}类型重复，三类牌顺序重新起算。`, "system-log");
    }
    if (result.fateGain > 0) gainFateMomentum(result.fateGain, { allowOverflow: result.completed });
  } else if (lastFlow && (lastFlow !== currentFlow || chainFate)) {
    gainFateMomentum(1);
  }
  game.player.lastCardFlowType = currentFlow;
}

function enterFateRewritePending() {
  if (game.fateRewritePending) return false;
  game.fateRewritePending = true;
  game.player.fateMomentum = FATE_MOMENTUM_MAX;
  closeBattleCoach();
  spawnFloatText(dom.playerPortrait, "命势已满 · 可改签", "fate-float");
  playFateFullEffect();
  addLog("噬签改命：命势已满，圆满效果暂未结算。点击敌人意图旁的「改签」，可更换其准备使用的技能。", "important");
  setBattleMessage("命势已满：可改换敌人准备使用的技能，也可暂时不改；此时不能继续获得命势。", "important");
  return true;
}

function resolveFateFull({ overflow = 0 } = {}) {
  if (!game || game.player?.heroId !== "fate" || (game.fateBurstsThisTurn || 0) >= 2) {
    if (game?.player?.heroId === "fate") game.player.fateMomentum = FATE_MOMENTUM_MAX;
    return false;
  }

  game.fateBurstsThisTurn = (game.fateBurstsThisTurn || 0) + 1;
  getRunStats().fateTriggers += 1;
  triggerHeroVoice("fulfill");
  showCoachTip("fateFull", "命势圆满！真元 +1 并抽 1 张牌——保持交替出牌就能连环圆满。");
  game.fateRewritePending = false;
  game.fateRewriteCandidate = null;
  game.player.fateMomentum = Math.max(0, Math.min(FATE_MOMENTUM_MAX - 1, Number(overflow) || 0));
  game.player.energy += 1;
  drawCards(1);
  // V0.9.57 织结：本场首次圆满再多抽 1 张。跨模块调用一律带 typeof 守卫——
  // nmg-relics.js 运行时先于 game.js 加载必定存在，但门禁沙箱只注入片段，不守卫会炸。
  if (typeof applyWeaveKnotOnFateFull === "function") applyWeaveKnotOnFateFull();
  spawnFloatText(dom.playerPortrait, "+1 真元", "yuan-float");
  playFateFullEffect();
  addLog("命势圆满：真元 +1，抽 1 张牌。", "important");
  if (hasOrdinaryRelic("fateCoin")) {
    game.player.armor += 1;
    recordArmorGained(1);
    gainGuStones(1, "命轨铜钱", { raw: true });
    spawnFloatText(dom.playerPortrait, "+1 防御", "defense-float");
    addLog("命轨铜钱随命势一转：防御 +1，蛊石 +1。", "positive-log");
    notifyRelicTrigger("fateCoin", "圆满·防御+1 蛊石+1");
  }
  if (hasOrdinaryRelic("fateSurge")) {
    drawCards(1);
    addLog("势盈引：命势圆满，额外抽 1 张牌。", "positive-log");
    notifyRelicTrigger("fateSurge", "圆满·额外抽1");
  }
  // V0.9.51 #27 织命梭：命势圆满 → 下一张蛊牌费用 -1（Math.max 不叠加，照魂燃蛊先例）
  if (hasOrdinaryRelic("fateLoom")) {
    game.player.nextCardCostReduction = Math.max(game.player.nextCardCostReduction || 0, 1);
    addLog("织命梭引线：下一张蛊牌消耗 -1。", "positive-log");
    notifyRelicTrigger("fateLoom", "圆满·下张-1费");
  }
  if (hasOrdinaryRelic("fateBurst") && game.enemy && game.enemy.hp > 0) {
    const fateBurstDamage = applyMupanIncomingDamage(6);
    game.enemy.hp = Math.max(0, game.enemy.hp - fateBurstDamage);
    recordPlayerDamage(fateBurstDamage, { card: true });
    spawnDelayedFloatText(dom.enemyPortrait, `命势爆 -${fateBurstDamage}`, "fate-float", 60);
    addLog(`势爆符：命势圆满，直击敌人 ${fateBurstDamage} 点（无视护甲）。`, "player-log");
    notifyRelicTrigger("fateBurst", `圆满·直伤${fateBurstDamage}`);
    checkCorpseDiskPhase2();
    checkLayer2BossPhase2();
  }
  if (benmingPassive("fate", 2) && !game.benmingFateFullDrawn) {
    game.benmingFateFullDrawn = true;
    drawCards(1);
    addLog("衔命虫振翅：本场首次圆满，额外抽 1 张牌。", "positive-log");
  }
  // 仅无 benmingPath 自有字段的老续局保留旧真形/归墟圆满余泽；新路线和显式 null 均不回退。
  if (isLegacyBenmingRun(runState) && benmingPassive("fate", 3)) {
    const fateBoon = benmingPassive("fate", 5) ? 2 : 1;
    game.player.armor += fateBoon;
    recordArmorGained(fateBoon);
    gainGuStones(fateBoon, "衔命虫", { raw: true });
    addLog(`衔命虫衔来余泽：防御 +${fateBoon}，蛊石 +${fateBoon}。`, "positive-log");
  }
  setBattleMessage("命势圆满，逆命蛊群同时鸣动。");
  return true;
}

function gainFateMomentum(amount, { allowOverflow = false } = {}) {
  if (game.player.heroId !== "fate" || amount <= 0 || game.fateRewritePending) return 0;
  const pathId = getActiveFateBenmingPath();
  const plan = planFateMomentumGain(
    game.player.fateMomentum,
    amount,
    game.fateBurstsThisTurn,
    allowOverflow,
    pathId === "devourOmen" && !game.fateRewriteUsedThisTurn,
  );
  game.player.fateMomentum = Math.min(FATE_MOMENTUM_MAX, game.player.fateMomentum + plan.gained);
  if (plan.gained > 0) {
    recordFateGain(plan.gained);
    game.fateGainedThisTurn = true;
    spawnFloatText(dom.playerPortrait, `+${plan.gained} 命势`, "fate-float");
    playFateGainEffect();
    addLog(`命势流转：获得 ${plan.gained} 层命势。`, "positive-log");
  }
  if (plan.pending) {
    enterFateRewritePending();
  } else if (plan.settlements > 0) {
    game.player.fateMomentum = FATE_MOMENTUM_MAX;
    resolveFateFull({ overflow: plan.momentumAfter });
  } else {
    game.player.fateMomentum = plan.momentumAfter;
  }
  return plan.gained;
}

function resolveExistingFateAfterIntent() {
  if (!game || game.player?.heroId !== "fate" || game.player.fateMomentum < FATE_MOMENTUM_MAX) return false;
  if ((game.fateBurstsThisTurn || 0) >= 2) return false;
  const pathId = getActiveFateBenmingPath();
  if (pathId === "threeWeave") {
    addLog("三相织命：已有满命势，在敌人技能出现后立即结算圆满。", "important");
    return resolveFateFull();
  }
  if (pathId === "devourOmen" && !game.fateRewriteUsedThisTurn) return enterFateRewritePending();
  return false;
}

function armEnemyPoisonSwallowIntent() {
  if (!game?.enemy || game.enemy.hp <= 0 || isMupanBattle()) return false;
  const rule = game.enemy.definition?.poisonSwallow;
  if (!rule || game.enemy.poisonSwallowArmed || game.enemy.poison < rule.threshold) return false;
  game.enemy.poisonSwallowArmed = true;
  game.enemy.poisonSwallowOriginalIntent = game.enemy.intent;
  game.enemy.intent = "__poisonSwallow";
  addLog(`${game.enemy.definition.name}腹囊鼓胀：已准备吞下 ${rule.threshold} 层毒性，本回合将放弃攻击。`, "boss-log");
  setBattleMessage(`${game.enemy.definition.name}正在酝酿吞毒——超过阈值的毒性不会被吞掉。`);
  return true;
}

function applyEnemyPoison(amount, sourceName, { corrosive = true, forceCorrosion = false, logClass = "poison-log" } = {}) {
  if (amount <= 0) return;
  // V0.9.58 毒抗收敛：按比例折算，但每次至多挡 2 层；蚀毒会逐步削弱有效毒抗。
  const poisonResist = game.enemy.definition.poisonResist || 0;
  if (poisonResist > 0) {
    const poisonPlan = calculateEnemyPoisonApplication(
      amount,
      poisonResist,
      game.enemy.poisonResistShred || 0,
      POISON_COUNTERPLAY_BALANCE.maxResistedPerApplication,
    );
    if (poisonPlan.resisted > 0) {
      const effectivePct = Math.round(poisonPlan.effectiveResist * 100);
      addLog(`${game.enemy.definition.name}毒抗抵去 ${poisonPlan.resisted} 层，实得 ${poisonPlan.applied} 层（当前有效毒抗 ${effectivePct}%）。`, "enemy-log");
      amount = poisonPlan.applied;
    }
  }
  // D-2c 逆鳞后毒：路线追加的 2 层在毒抗换算完成后并入本次事件（不再受第二次毒抗），
  // 与牌面施毒合并为一次毒获得事件后，再统一进入浓毒瓶、幼虫首次施毒与统计；每张牌至多一次。
  const afterstrikeContext = game.activeCardContext;
  if (afterstrikeContext && (Number(afterstrikeContext.poisonAfterstrikeBonus) || 0) > 0 && !afterstrikeContext.poisonAfterstrikeBonusUsed) {
    afterstrikeContext.poisonAfterstrikeBonusUsed = true;
    amount += afterstrikeContext.poisonAfterstrikeBonus;
    const afterstrikeStats = getRunStats();
    afterstrikeStats.poisonAfterstrikeTriggers += 1;
    afterstrikeStats.poisonAfterstrikeAdded += afterstrikeContext.poisonAfterstrikeBonus;
    addLog(`逆鳞后毒：毒雾钻入新伤，追毒 +${afterstrikeContext.poisonAfterstrikeBonus}。`, "positive-log");
  }
  if (hasOrdinaryRelic("thickVenom")) amount += 1; // V0.9.9.2 浓毒瓶：每次施毒额外 +1 层
  // V0.9.20 蜕鳞蛊·幼虫：每场首次施毒额外 +1 层
  if (benmingPassive("poison", 1) && !game.benmingFirstVenomUsed) {
    game.benmingFirstVenomUsed = true;
    amount += 1;
    addLog("蜕鳞蛊淬鳞：本场首次施毒 +1 层。", "positive-log");
  }
  const wasPoisoned = game.enemy.poison > 0;
  const poisonBefore = game.enemy.poison;
  game.enemy.poison += amount;
  if (isMupanBattle() && game.mupanTurnMetrics) {
    game.mupanTurnMetrics.poisonAdded += Math.max(0, game.enemy.poison - poisonBefore);
  }
  recordBossPoisonPeak();
  recordCardMetric("poisonApplied", amount, sourceName);
  addLog(`${sourceName}施毒：${game.enemy.definition.name}获得 ${amount} 层毒性。`, logClass);
  spawnFloatText(dom.enemyPortrait, `+${amount} 毒性`, "poison-float");
  game.pendingEnemyPoisonPulse = true;
  playPoisonApplyEffect();

  // 蚀毒只由青蟒的“本次出牌”触发，每张卡最多触发一次，避免多段施毒重复结算。
  const canCorrode = corrosive
    && (forceCorrosion || game.player.heroId === "poison")
    && wasPoisoned
    && (!game.activeCardContext || !game.activeCardContext.corrosionTriggered);
  if (canCorrode) {
    if (game.activeCardContext) game.activeCardContext.corrosionTriggered = true;
    if (game.activeCardContext && game.player.heroId === "poison") triggerHeroVoice("corrosion");
    const corrosionDamage = applyMupanIncomingDamage(2);
    game.enemy.hp = Math.max(0, game.enemy.hp - corrosionDamage);
    recordPoisonDamage(corrosionDamage, { card: true });
    spawnFloatText(dom.enemyPortrait, `蚀毒 -${corrosionDamage}`, "poison-float");
    animateHit(dom.enemyPortrait);
    playCorrosionEffect();
    addLog(`蚀毒发作：额外造成 ${corrosionDamage} 点伤害。`, "poison-log");
    const basePoisonResist = Math.max(0, Number(game.enemy.definition.poisonResist) || 0);
    if (basePoisonResist > 0) {
      const shredBefore = Math.max(0, Number(game.enemy.poisonResistShred) || 0);
      game.enemy.poisonResistShred = Math.min(0.15, basePoisonResist, shredBefore + 0.05);
      const shredGain = game.enemy.poisonResistShred - shredBefore;
      if (shredGain > 0) {
        addLog(`蚀毒破抗：${game.enemy.definition.name}的有效毒抗降低 ${Math.round(shredGain * 100)}%。`, "positive-log");
      }
    }
    checkCorpseDiskPhase2();
    checkLayer2BossPhase2(); // V0.9.12.1 修复：蚀毒直伤跨半血此前不触发二三层 Boss 转阶段
  }
  armEnemyPoisonSwallowIntent();
}

function isCorpseDiskBoss() {
  return Boolean(game?.enemy?.definition?.isBoss && game.enemy.id === "corpsepuppet");
}

// 第二层 Boss 半血相位：复用尸盘监守的检测/触发结构，仅换 id 与文案
function isLayer2PhaseBoss() {
  return Boolean(game?.enemy?.definition?.isBoss && (game.enemy.id === "miasmaMotherBoss" || game.enemy.id === "bloodRobeMotherBoss" || game.enemy.id === "boneNestGuardianBoss" || game.enemy.id === "calamityQueenBoss"));
}
function checkLayer2BossPhase2() {
  if (!isLayer2PhaseBoss()) return false;
  if (game.enemy.phase2 || game.enemy.hp <= 0) return false;
  if (game.enemy.hp > game.enemy.maxHp * 0.5) return false;
  game.enemy.phase2 = true;
  getRunStats().bossPhase2Triggered = true;
  // V0.9.8 三层 Boss 二阶预埋：骨巢守墓王进二阶先叠甲并埋下执令，灾厄蜂后蜂群拉满。
  if (game.enemy.id === "boneNestGuardianBoss") {
    game.enemy.armor = (game.enemy.armor || 0) + 8;
    game.enemy.commanderEffect = 6;
  } else if (game.enemy.id === "calamityQueenBoss") {
    game.enemy.swarmStack = Math.max(game.enemy.swarmStack || 0, 4);
    game.player.poisonStingStack = Math.min(10, (game.player.poisonStingStack || 0) + 2);
  }
  const bossId = game.enemy.id;
  let title = "瘴母苏醒";
  let desc = "百瘴翻涌，毒雾遮天，杀意暴涨。";
  if (bossId === "bloodRobeMotherBoss") { title = "血衣覆身"; desc = "血衣无风自动，血债加倍偿还。"; }
  else if (bossId === "boneNestGuardianBoss") { title = "骨巢开裂"; desc = "骨巢崩裂，碎甲翻涌，重击连绵。"; }
  else if (bossId === "calamityQueenBoss") { title = "蜂群暴动"; desc = "万翅齐振，蜂群暴涨，毒刺如雨。"; }
  addLog(`${title}：${desc}`, "boss-log");
  setBattleMessage(`${title}：${desc}`);
  showTurnBanner(title, desc);
  renderEnemyPortrait();
  renderEnemyStatuses();
  renderIntent();
  document.querySelector(".enemy-panel")?.classList.add("phase2-mode");
  return true;
}

function recordBossPoisonPeak() {
  if (!isCorpseDiskBoss()) return;
  const stats = getRunStats();
  stats.bossHighestPoison = Math.max(stats.bossHighestPoison || 0, game.enemy.poison || 0);
}

function checkCorpseDiskPhase2() {
  if (!isCorpseDiskBoss()) return false;
  if (game.enemy.phase2 || game.enemy.hp <= 0) return false;
  if (game.enemy.hp > game.enemy.maxHp * 0.5) return false;
  game.enemy.phase2 = true;
  getRunStats().bossPhase2Triggered = true;
  // V0.9.8 三层 Boss 二阶预埋：骨巢守墓王进二阶先叠甲并埋下执令，灾厄蜂后蜂群拉满。
  if (game.enemy.id === "boneNestGuardianBoss") {
    game.enemy.armor = (game.enemy.armor || 0) + 8;
    game.enemy.commanderEffect = 6;
  } else if (game.enemy.id === "calamityQueenBoss") {
    game.enemy.swarmStack = Math.max(game.enemy.swarmStack || 0, 4);
    game.player.poisonStingStack = Math.min(10, (game.player.poisonStingStack || 0) + 2);
  }
  addLog("尸盘转轮，死气倒灌，守关者杀意渐盛。", "boss-log");
  setBattleMessage("尸盘转轮：死气倒灌，守关者杀意渐盛。");
  showTurnBanner("尸盘转轮", "死气倒灌，守关者杀意渐盛。");
  renderEnemyPortrait();
  renderEnemyStatuses();
  renderIntent();
  document.querySelector(".enemy-panel")?.classList.add("phase2-mode");
  playCorpseDiskPhase2Effect();
  return true;
}

// 攻击统一从这里结算，遗物、炼蛊和酒虫不会散落到每张卡的代码中。
// 朝暮·焚寿燃命：寿元越低，蛊术伤害越高（满+0／过半+3／残+6／垂暮+10），与立绘档位同口径
function getLifespanDamageBonus(player) {
  const base = [0, 3, 6, 10][longevityTier(player)] || 0;
  let bonus = hasOrdinaryRelic("soulBurnMirror") ? base * 2 : base; // V0.9.9.2 焚魂镜：焚寿燃命伤害加成翻倍
  // V0.9.51 #29：旧「焚寿燃命 +25%/+50%」仅旧规则局保留；新局由「积薪成炬 / 朝暮回灯」路线取代，不叠加。
  if (isLegacyBenmingRun(runState) && benmingPassive("longevity", 3)) {
    bonus = Math.round(bonus * (benmingPassive("longevity", 5) ? 1.5 : 1.25));
  }
  return bonus;
}

// V0.9.9.2 暴击系统（用户授权破框架红线）：暴击率来自遗物/条件累加，命中则最终伤害 ×CRIT_MULTIPLIER（护甲抵挡之前，酒虫/回光/焚寿之后）。
const CRIT_MULTIPLIER = 1.6;
function getAttackCritChance(card) {
  if (!game || !game.enemy) return 0;
  let chance = 0;
  // 淬毒尖牙：攻击中毒的敌人有几率暴击（毒道暴击流入口；Batch4 更多暴击来源在此累加）
  if (hasOrdinaryRelic("venomFang") && (game.enemy.poison || 0) > 0) chance += 0.34;
  return Math.min(chance, 1);
}

function resolveAttack(card, baseDamage, detail = "") {
  const bloodBonus = isBloodAttackCard(card) ? game.bloodAttackBonus : 0;
  const instanceBonus = Math.max(0, Number(card.damageBonus) || 0);
  // V0.9.9.2 蚀骨毒：攻击中毒的敌人时，额外造成其当前毒层数的伤害
  const boneVenomBonus = (hasOrdinaryRelic("boneVenom") && (game.enemy?.poison || 0) > 0) ? game.enemy.poison : 0;
  // V0.9.20 蜕鳞蛊·成虫：攻击中毒的敌人时伤害 +2
  const benmingVenomBonus = (benmingPassive("poison", 2) && (game.enemy?.poison || 0) > 0) ? (benmingPassive("poison", 4) ? 4 : 2) : 0; // V0.9.33 神化：攻毒敌额外伤害 2→4
  const carriedAtkBonus = (runState && runState.carriedGuBonus && runState.carriedGuBonus.attackFlat) || 0; // V0.9.35 天品随行·攻击维度：本局每击基础伤害 +2
  const blessAttackBonus = Math.max(0, Number(game.blessAttackBonus) || 0);
  // V0.9.51 #29 积薪成炬：按本场累计焚寿量抬攻击（纯规则见 nmg-benming）。
  const pyreBonus = (typeof getKindlingPyreAttackBonus === "function" && game.player.heroId === "longevity")
    ? getKindlingPyreAttackBonus(getEffectiveBenmingStage("longevity"), getRunBenmingPath(runState), game.burnedLifespanThisBattle || 0)
    : 0;
  // V0.9.57 磨蛊石：本场首次攻击蛊 +4。与其它平加项同层，故落在倍率之前的 modifiedBase 里；
  // latch 在 getWhetstoneBonus 内部按 combatRelic 记，一场只会返回一次非零值。
  const whetstoneBonus = typeof getWhetstoneBonus === "function" ? getWhetstoneBonus(card) : 0;
  const drunkFlatBonus = Math.max(0, Number(game.player.drunkFlatBonus) || 0);
  const modifiedBase = baseDamage + game.attackBonus + blessAttackBonus + bloodBonus + instanceBonus + boneVenomBonus + benmingVenomBonus + carriedAtkBonus + pyreBonus + whetstoneBonus + getDragonAttackBonus();
  /* V0.9.8.3 酒虫层数化；V0.9.57 去指数：倍率由 ×2^层 改为按层递减的 ×2/×2.5/×3
   * （单源 getDrunkMultiplier）。攻击结算后仍清空全部层。 */
  const drunk = game.player.drunkStacks || 0;
  // V0.9.9 寿道·子批3：回光翻倍与酒虫同属「基础值倍率」，相乘作用于 modifiedBase；
  // 焚寿燃命加成在所有倍率「之后」才相加，沿用子批2a 约定（不被 ×2^层/回光放大成爆炸数值）。
  const spellDoubled = !!game.spellDoubleThisTurn;
  const baseMultiplier = getDrunkMultiplier(drunk) * (spellDoubled ? 2 : 1);
  const lifespanBonus = (game.player.heroId === "longevity") ? getLifespanDamageBonus(game.player) : 0;
  const preCritDamage = (baseMultiplier > 1 ? Math.round(modifiedBase * baseMultiplier) : modifiedBase) + lifespanBonus + drunkFlatBonus;
  // V0.9.9.2 暴击：按暴击率掷骰，命中则最终伤害 ×CRIT_MULTIPLIER（在护甲抵挡之前）
  const critChance = getAttackCritChance(card);
  const isCrit = critChance > 0 && getRunRandom("combat") < critChance;
  let damage = isCrit ? Math.round(preCritDamage * CRIT_MULTIPLIER) : preCritDamage;
  // V0.9.9.2 通用增幅：险中契(生命<50% +25%) / 孤勇符(手牌≤2 +30%)
  let __relicMul = 1;
  if (hasOrdinaryRelic("desperatePact") && game.player.hp < game.player.maxHp * 0.5) __relicMul *= 1.25;
  if (hasOrdinaryRelic("loneValor") && (game.hand?.length || 0) <= 2) __relicMul *= 1.3;
  // V0.9.51 #27 逆鳞怒纹：龙形期间攻击 ×1.2；烙血玺：血煞攒满 ×1.15
  if (hasOrdinaryRelic("dragonFury") && isDragonHero() && game.dragon.transformed) __relicMul *= 1.2;
  if (hasOrdinaryRelic("bloodBrandSeal") && game.player.heroId === "blood" && (game.player.blood || 0) >= getBloodMax()) __relicMul *= 1.15;
  if (__relicMul > 1) damage = Math.round(damage * __relicMul);
  damage = applyMupanIncomingDamage(damage);
  if (drunk > 0) {
    game.player.drunkStacks = 0;
    game.player.drunkFlatBonus = 0;
  }
  const enemyBlocked = Math.min(game.enemy.armor || 0, damage);
  const realDamage = Math.max(0, damage - enemyBlocked);
  game.enemy.armor = Math.max(0, (game.enemy.armor || 0) - damage);
  game.enemy.hp = Math.max(0, game.enemy.hp - realDamage);
  recordDragonAttackResult(realDamage, card);
  playCombatHitSfx(realDamage, { crit: isCrit, blocked: enemyBlocked }); // EXP-1a：我方命中有声
  // V0.9.6.3 蓄力打断计数：本玩家回合对敌累计伤害（每玩家回合 beginNextTurn 归零）。
  game.enemy.dmgTakenThisTurn = (game.enemy.dmgTakenThisTurn || 0) + realDamage;
  // V0.9.8 三层·蓄力打断：蓄力中且本玩家回合累计伤害达阈值，打断蓄力（清空附加伤害）。
  if (game.enemy.charging && game.enemy.chargedBonus > 0 && (game.enemy.currentInterruptThreshold || 0) > 0
      && game.enemy.dmgTakenThisTurn >= game.enemy.currentInterruptThreshold) {
    game.enemy.chargedBonus = 0;
    game.enemy.charging = false;
    game.enemy.currentInterruptThreshold = 0;
    addLog(`${game.enemy.definition.name}的蓄力被你打断，重击未能落下！`, "player-log");
    spawnDelayedFloatText(dom.enemyPortrait, "蓄力被打断", "resource-float", 60);
  }
  // V0.9.8 三层·蜂群孵化打断：对敌造成实伤可压下一层蜂群。
  if (realDamage > 0 && (game.enemy.swarmStack || 0) > 0) {
    game.enemy.swarmStack = Math.max(0, game.enemy.swarmStack - 1);
  }

  const notes = [];
  if (detail) notes.push(detail);
  if (game.attackBonus > 0) notes.push(`炼蛊 +${game.attackBonus}`);
  if (blessAttackBonus > 0) notes.push(`战前加持 +${blessAttackBonus}`);
  if (pyreBonus > 0) notes.push(`积薪成炬 +${pyreBonus}`);
  if (bloodBonus > 0) notes.push(`血纹残片 +${bloodBonus}`);
  if (instanceBonus > 0) notes.push(`悟道 +${instanceBonus}`);
  if (drunk > 0) notes.push(`酒虫×${getDrunkMultiplier(drunk)}`);
  if (lifespanBonus > 0) notes.push(`焚寿燃命 +${lifespanBonus}`);
  if (spellDoubled) notes.push("回光×2");
  if (isCrit) notes.push(`暴击×${CRIT_MULTIPLIER}`);
  if (enemyBlocked > 0) notes.push(`敌方防御抵挡 ${enemyBlocked}`);
  const noteText = notes.length ? `（${notes.join("，")}）` : "";
  recordPlayerDamage(realDamage, { card: true });
  const bloodContribution = extractBloodBonusFromDetail(detail, realDamage);
  recordBloodBonusDamage(bloodContribution);
  if (drunk > 0) {
    getRunStats().wineWormTriggers += 1;
    playWineTriggerEffect();
  }
  addLog(`你使用${card.name}，对${game.enemy.definition.name}造成 ${realDamage} 点伤害${noteText}。`, "player-log");
  setBattleMessage(`${card.name}命中${game.enemy.definition.name}，造成 ${realDamage} 点伤害！`);
  if (enemyBlocked > 0) spawnDelayedFloatText(dom.enemyPortrait, `格挡 ${enemyBlocked}`, "defense-float", 60);
  if (realDamage > 0) {
    const damageKind = isCrit ? "crit-float" : (getCardEffectType(card) === "blood" ? "blood-float" : "");
    spawnDelayedFloatText(dom.enemyPortrait, isCrit ? `暴击 -${realDamage}` : `-${realDamage}`, damageKind, 80);
    animateHit(dom.enemyPortrait);
    if (isCrit) {
      safeVibrate(28);
      if (hasOrdinaryRelic("venomFang") && (game.enemy.poison || 0) > 0) notifyRelicTrigger("venomFang", "淬毒暴击");
    }
  }
  playAttackEffect(card);
  checkCorpseDiskPhase2();
  checkLayer2BossPhase2();
  // V0.9.9.2 噬血回响：血道攻击时按当前血煞 30% 回血
  if (isBloodAttackCard(card) && hasOrdinaryRelic("bloodEcho")) {
    const __h = Math.floor((game.player.blood || 0) * 0.3);
    if (__h > 0) { healPlayer(__h, "噬血回响"); notifyRelicTrigger("bloodEcho", `噬血·回血${__h}`); }
  }
  return realDamage;
}

function isBloodAttackCard(card) {
  return card.category === "attack" && (card.type === "blood" || card.typeName.includes("血道"));
}

function endTurn() {
  if (!game || game.status !== "playing" || game.inputLocked) return;
  settleCalamityAshAtTurnEnd();
  if (checkBattleResult()) return;
  if (game.fateRewritePending) {
    const stats = getRunStats();
    stats.fateRewriteWaitTurns = (stats.fateRewriteWaitTurns || 0) + 1;
    addLog("噬签改命：暂不改签，当前技能不变；满命势保留到下一回合。", "system-log");
  }
  if (isMupanBattle()) {
    const phaseBeforeResolution = game.mupan.core.phase;
    const result = resolveMupanEndPlayerTurn(game.mupan, { balance: ENEMY_BALANCE.mupan });
    game.mupan = result.state;
    game.mupan.pendingEnemyAction = result.attack;
    announceMupanPhaseChange(phaseBeforeResolution);
    if (result.avoidedPursuit) {
      addLog(`你整回合避开了母盘看穿的行为：没有触发即时追击；母盘仍会施展「${result.attack?.name || "当前技能"}」。下一回合母盘承受伤害 +35%。`, "important");
      spawnFloatText(dom.enemyPortrait, "避开追击 · 易伤", "fate-float");
    }
    if (result.attack?.mupanFinalBlow) addLog("灭命倒计时归零：母盘将打出 48 点灭命一击。", "boss-log");
  }
  game.inputLocked = true;
  render();
  const action = getCurrentEnemyAction();
  showTurnBanner("敌方行动", `${game.enemy.definition.name}施展：${action.name}`);
  window.clearTimeout(enemyTurnTimer);
  enemyTurnTimer = window.setTimeout(resolveEnemyTurn, 620);
}

function resolveEnemyPoisonSwallowAction(action) {
  const plan = planEnemyPoisonSwallow(
    game.enemy.poison,
    game.enemy.hp,
    game.enemy.maxHp,
    { threshold: action.threshold, heal: action.heal },
  );
  game.enemy.poisonSwallowArmed = false;
  game.enemy.poisonSwallowOriginalIntent = null;
  if (!plan.triggered) {
    addLog(`${game.enemy.definition.name}试图吞毒，却因毒性不足而失败；本回合不攻击。`, "boss-log");
    setBattleMessage(`${game.enemy.definition.name}腹囊空鸣，吞毒失败。`);
    return false;
  }
  game.enemy.poison = plan.poisonAfter;
  game.enemy.hp = plan.hpAfter;
  game.pendingEnemyPoisonPulse = true;
  addLog(`${game.enemy.definition.name}吞毒：吞噬 ${plan.swallowed} 层毒性${plan.healed > 0 ? `，回复 ${plan.healed} 点生命` : ""}；余下 ${plan.poisonAfter} 层继续发作，本回合不攻击。`, "boss-log");
  spawnFloatText(dom.enemyPortrait, `吞毒 -${plan.swallowed}`, "poison-float");
  if (plan.healed > 0) spawnDelayedFloatText(dom.enemyPortrait, `回血 +${plan.healed}`, "heal-float", 140);
  setBattleMessage(`${game.enemy.definition.name}吞下定量毒性，余毒仍在体内翻涌。`);
  return true;
}

function resolveEnemyTurn() {
  if (!game || game.status !== "playing") return;
  enemyTurnTimer = null;
  if (isMupanBattle()) game.mupan = beginMupanEnemyAction(game.mupan, game.turn, ENEMY_BALANCE.mupan);
  const action = getCurrentEnemyAction();
  playBossActionEffect(action);
  if (isMupanBattle()) playMupanActionVfx(action);
  const enemyName = game.enemy.definition.name;
  const enemyLogClass = game.enemy.definition.isBoss ? "boss-log" : "enemy-log";
  let borrowAttackLifeDamage = 0; // D-2c 蜕鳞借毒归墟验收：该次攻击实际生命伤害快照
  if (game.bone) game.bone.enemyBreakGrantedThisAction = false;

  // V0.9.8.9 骨塔硬核·骨甲覆身：每回合回甲到上限，使骨塔敌人常驻护甲、攻不破甲者难伤其身。
  // 上限封顶防无限滚雪球；回甲量小于一次普通攻击伤害，破甲蛊/直伤/绕甲的毒仍能压制（厚甲难破但不致卡死）。
  const __bd = game.enemy.definition.def;
  if (__bd && __bd.boneArmorRegen && (game.enemy.armor || 0) < (__bd.boneArmorCap || 99)) {
    const __regen = Math.min(__bd.boneArmorRegen, (__bd.boneArmorCap || 99) - (game.enemy.armor || 0));
    if (__regen > 0) {
      game.enemy.armor = (game.enemy.armor || 0) + __regen;
      addLog(`${enemyName}骨甲覆身，护甲 +${__regen}。`, enemyLogClass);
      spawnDelayedFloatText(dom.enemyPortrait, `骨甲 +${__regen}`, "defense-float", 60);
    }
  }

  if (action.kind === "poisonSwallow") {
    resolveEnemyPoisonSwallowAction(action);
  } else if (action.kind === "charge") {
    game.enemy.chargedBonus = action.bonus;
    let chargeArmorText = "";
    // V0.9.8 三层·蓄力打断：charge 携带 interruptThreshold 时点亮蓄力，本玩家回合累计伤害达阈值可打断。
    // V0.9.12.1 修复蓄力残留：连续蓄力时无条件重置，防止旧阈值残留使"不可打断"的蓄力被打断。
    game.enemy.charging = !!action.interruptThreshold;
    game.enemy.currentInterruptThreshold = action.interruptThreshold || 0;
    // V0.9.8 三层·执令（骨塔执令者）：charge 时种下「执令」，下一次攻击额外 +6。
    if (action.commanderMark) {
      game.enemy.commanderEffect = 6;
      addLog(`${enemyName}打出执令印记，下一击将更凶狠。`, enemyLogClass);
      spawnDelayedFloatText(dom.enemyPortrait, "执令 +6", "resource-float", 80);
    }
    // V0.9.8 三层·召卫（骨巢守墓王）：每隔一回合在蓄力时再叠护甲（隔回合触发 + 护甲上限 18，防无限甲滚雪球，破甲/直伤仍可压制）。
    if ((game.enemy.definition.def && game.enemy.definition.def.summonGuard) && (game.turn % 2 === 0) && (game.enemy.armor || 0) < 18) {
      const guardArmor = 6;
      game.enemy.armor = (game.enemy.armor || 0) + guardArmor;
      addLog(`${enemyName}召出骨卫，护甲 +${guardArmor}。`, enemyLogClass);
      spawnDelayedFloatText(dom.enemyPortrait, `召卫 +${guardArmor} 防御`, "defense-float", 100);
    }
    if (action.armor) {
      // V0.9.12.1 修复：骨塔蓄力动作未写 armorCap，叠加每回合骨甲回填可无限滚甲（低输出构筑软卡死）——无动作上限时回退用 def.boneArmorCap 封顶。
      const armorCap = Number(action.armorCap) || Number(game.enemy.definition.def && game.enemy.definition.def.boneArmorCap) || 0;
      const currentArmor = game.enemy.armor || 0;
      const armorGain = armorCap > 0
        ? Math.max(0, Math.min(action.armor, armorCap - currentArmor))
        : action.armor;
      if (armorGain > 0) {
        game.enemy.armor = currentArmor + armorGain;
        spawnFloatText(dom.enemyPortrait, `+${armorGain} 防御`, "defense-float");
        chargeArmorText = `，并获得 ${armorGain} 点防御${armorCap ? `（上限 ${armorCap}）` : ""}`;
      } else if (armorCap > 0) {
        chargeArmorText = `，护甲已至上限 ${armorCap}`;
      }
      // V0.9.6.3 凝甲蚀毒：def.blockPurge —— 获甲时额外清掉自身 N 层毒（毒藤尸）。
      const purge = game.enemy.definition.blockPurge || 0;
      if (armorGain > 0 && purge > 0 && game.enemy.poison > 0) {
        const removed = Math.min(purge, game.enemy.poison);
        game.enemy.poison = Math.max(0, game.enemy.poison - removed);
        game.pendingEnemyPoisonPulse = true;
        addLog(`${enemyName}凝甲蚀毒，压去自身 ${removed} 层毒性。`, enemyLogClass);
        spawnDelayedFloatText(dom.enemyPortrait, `凝甲蚀毒 -${removed}`, "poison-float", 60);
      }
    }
    addLog(`${enemyName}使用${action.name}，下一次攻击将额外造成 ${action.bonus} 点伤害${chargeArmorText}。`, enemyLogClass);
    setBattleMessage(`${enemyName}压低身形，危险气息正在聚拢……`);
    spawnFloatText(dom.enemyPortrait, `蓄势 +${action.bonus}`, "resource-float");
    // V0.9.6.3 蓄势动作携带的吸血/自损（veinTap 自损 / sanguineWard·crimsonGather 吸血）。蓄势无伤害，lifesteal 直接按上限回血。
    if (action.lifesteal) {
      const chargeHealed = Math.min(action.lifesteal, game.enemy.maxHp - game.enemy.hp);
      if (chargeHealed > 0) {
        game.enemy.hp += chargeHealed;
        addLog(`${enemyName}噬血回复 ${chargeHealed} 点生命。`, enemyLogClass);
        spawnDelayedFloatText(dom.enemyPortrait, `回血 +${chargeHealed}`, "heal-float", 120);
      }
    }
    if (action.selfBleed) {
      const chargeBefore = game.enemy.hp;
      game.enemy.hp = Math.max(0, game.enemy.hp - action.selfBleed);
      if (game.enemy.hp < chargeBefore) {
        addLog(`${enemyName}以${action.name}割伤自身，自损 ${action.selfBleed} 点。`, enemyLogClass);
        spawnDelayedFloatText(dom.enemyPortrait, `-${action.selfBleed} 自损`, "", 160);
        animateHit(dom.enemyPortrait);
        checkLayer2BossPhase2();
        checkCorpseDiskPhase2();
      }
    }
  } else if (action.kind === "defend" && !(Number(action.damage) > 0)) {
    /* P0 修（玩家实测「将造成 NaN 点伤害」，以及此前报过的「生命值 NaN」）：
     * 全库 7 个纯防御意图（碑阵合围/盘根/隐入影中/伪祷凝息/提线自护/骨甲合围/重塑蜡壳）
     * 此前在这里【没有任何分支】，一律掉进下面的伤害分支：
     *   Math.round(undefined * hits * mul) === NaN → 玩家真的吃到 NaN 伤害，生命值被污染成 NaN。
     * 同时它们的 block 只被 getIntentSummary 当文案读过，【从未真正加到敌人护甲上】——
     * 也就是说这七个敌人的「防御」十几个版本以来一直是摆设。
     * 现在按定义把 block 结算为护甲，且本回合不产生任何伤害。 */
    const blockGain = Math.max(0, Number(action.block ?? action.armor) || 0);
    if (blockGain > 0) {
      const defArmorCap = Number(action.armorCap) || Number(game.enemy.definition.def && game.enemy.definition.def.boneArmorCap) || 0;
      const beforeArmor = game.enemy.armor || 0;
      const applied = defArmorCap > 0
        ? Math.max(0, Math.min(blockGain, defArmorCap - beforeArmor))
        : blockGain;
      if (applied > 0) {
        game.enemy.armor = beforeArmor + applied;
        addLog(`${enemyName}收势自护，护甲 +${applied}。`, enemyLogClass);
        spawnFloatText(dom.enemyPortrait, `+${applied} 防御`, "defense-float");
      } else {
        addLog(`${enemyName}收势自护，但护甲已至上限 ${defArmorCap}。`, enemyLogClass);
      }
    } else {
      addLog(`${enemyName}收势自护，本回合不攻击。`, enemyLogClass);
    }
  } else {
    const hitCount = action.hits || 1;
    const lowHpBonus = action.lowHpExtra && game.player.hp < game.player.maxHp / 2 ? action.lowHpExtra : 0;
    const enrageBonus = game.enemy.definition.enrage && game.enemy.hp <= game.enemy.maxHp * game.enemy.definition.enrage.threshold
      ? game.enemy.definition.enrage.attackBonus
      : 0;
    const routeBonus = game.enemyAttackBonus || 0;
    const mupanDamage = isMupanBattle() ? getMupanActionDamage(action) : null;
    // 兜底：缺 damage 一律按 0，绝不让 NaN 进入实际结算污染玩家生命值（与 renderIntent 同口径）。
    let rawDamage = mupanDamage
      ? mupanDamage.total
      : Math.round((Number(action.damage) || 0) * hitCount * (game.enemyAttackMultiplier || 1)) + game.enemy.chargedBonus + lowHpBonus + enrageBonus + routeBonus;
    const enemyDef = game.enemy.definition.def || {};
    // V0.9.8 三层新机制附加伤害：累加为 mechBonus，置于易伤×1.5【之后】平伤生效，避免被二次放大造成不可预测尖伤（renderIntent 同口径，玩家可按面板规划护甲）。
    let mechBonus = 0;
    // V0.9.8 三层·骨甲强化（骨甲蛊卫）：自身有护甲时攻击附加 def.boneArmorBonus。
    if ((game.enemy.armor || 0) > 0 && enemyDef.boneArmorBonus) {
      mechBonus += enemyDef.boneArmorBonus;
    }
    // V0.9.8 三层·蜂群（蜂巢虫蛊/灾厄蜂后）：敌回合蜂群 +1 后按层数叠伤（每层 swarmDamagePerLayer，默认 2）。
    if (enemyDef.hasSwarmMechanic) {
      game.enemy.swarmStack = (game.enemy.swarmStack || 0) + 1;
      mechBonus += game.enemy.swarmStack * (enemyDef.swarmDamagePerLayer || 2);
    }
    // V0.9.8 三层·执令兑现（骨塔执令者）：上轮种下的执令本次攻击生效一次后清零。
    if (game.enemy.commanderEffect > 0) {
      mechBonus += game.enemy.commanderEffect;
      game.enemy.commanderEffect = 0;
    }
    // V0.9.8 三层·抢攻（蜂潮蛊涌/蜂窟守卫）：本玩家回合出牌数 > counterAttackThreshold（默认 4）则该次攻击 +counterDamage（默认 8）。意图侧已提前预警。
    if (enemyDef.hasCounterAttack && (game.cardsPlayedThisTurn || 0) > (enemyDef.counterAttackThreshold || 4)) {
      mechBonus += (enemyDef.counterDamage || 8);
      game.enemy.counterArmed = true;
      addLog(`${enemyName}被密集出牌激怒，乱翅抢攻额外 +${enemyDef.counterDamage || 8}。`, enemyLogClass);
    } else {
      game.enemy.counterArmed = false;
    }
    // V0.9.6.3 易伤：玩家 vulnerable>0 时本次受到的攻击伤害 *1.5（向上取整）并消耗 1 层。仅放大基础攻击，不放大三层机制附加。
    let vulnerableApplied = 0;
    if (mupanDamage && game.player.vulnerable > 0 && rawDamage > 0) {
      game.player.vulnerable = Math.max(0, game.player.vulnerable - 1);
      vulnerableApplied = 1;
    } else if (game.player.vulnerable > 0 && rawDamage > 0) {
      rawDamage = Math.ceil(rawDamage * 1.5);
      game.player.vulnerable = Math.max(0, game.player.vulnerable - 1);
      vulnerableApplied = 1;
    }
    rawDamage += mechBonus;
    // V0.9.9 寿道·子批3：桑田·衰老——对最终攻击伤害平减（夹 0），与 renderIntent 同口径，玩家可按面板规划护甲。
    const weakenCut = mupanDamage ? mupanDamage.weakenCut : Math.min(rawDamage, game.enemy.weaken || 0);
    if (!mupanDamage && weakenCut > 0) rawDamage -= weakenCut;
    const bonus = game.enemy.chargedBonus;
    const blocked = Math.min(game.player.armor, rawDamage);
    const received = Math.max(0, rawDamage - game.player.armor);
    // V0.9.27 破防易伤：护甲被一次攻击彻底打穿（本有甲、扣后归零），下次受击 +1 层易伤。
    // 直接惩罚"贴着敌意图卡线留甲、低血龟缩苟活"——一旦算错让甲破，雪崩。与断脉蛊徒共用同一 vulnerable 计数防爆层。
    const playerArmorBefore = game.player.armor;
    game.player.armor = Math.max(0, game.player.armor - rawDamage);
    if (playerArmorBefore > 0 && game.player.armor === 0) recordBoneArmorBreak();
    if (playerArmorBefore > 0 && game.player.armor === 0 && received > 0) {
      const breakVuln = Number(game.enemy.definition?.def?.breakVuln) || 1; // 精英/骨塔可 def.breakVuln=2
      game.player.vulnerable = (game.player.vulnerable || 0) + breakVuln;
      addLog(`护甲被击穿：破防·易伤 +${breakVuln}（下次受击 ×1.5）。`, "damage-log");
      spawnFloatText(dom.playerPortrait, `破防·易伤 +${breakVuln}`, "resource-float");
    }
    if (received > 0) {
      game.lastHurtSource = "enemyAttack";
      // V0.9.12.1 死因修复：蓄力兑现即清零，checkBattleResult 晚于此处执行，
      // 死于蓄力重击时快照读到的 chargedBonus/打断阈值恒为 0，故在清零前留痕供 snapshotDeathContext 读取。
      game.lastHitWasCharged = bonus > 0;
      game.lastHitInterruptThreshold = bonus > 0 ? (game.enemy.currentInterruptThreshold || 0) : 0;
    }
    const hpBefore = game.player.hp;
    game.player.hp = Math.max(0, game.player.hp - received);
    playCombatHitSfx(received, { crit: bonus > 0, blocked, volumeScale: 0.55 }); // EXP-1a：挨打有声（蓄力兑现按重击响）
    checkHeroLowLife(hpBefore);
    recordEnemyDamage(received);
    borrowAttackLifeDamage = received;
    game.enemy.chargedBonus = 0;
    game.enemy.charging = false;
    game.enemy.currentInterruptThreshold = 0;

    const detail = [
      hitCount > 1 ? `${hitCount} 次连击` : "",
      bonus > 0 ? `蓄势 +${bonus}` : "",
      lowHpBonus > 0 ? `追魂 +${lowHpBonus}` : "",
      enrageBonus > 0 ? `${(game.enemy.definition.enrage && game.enemy.definition.enrage.name) || "狂怒"} +${enrageBonus}` : "",
      routeBonus > 0 ? `岔路恶果 +${routeBonus}` : "",
      vulnerableApplied > 0 ? "易伤 ×1.5" : "",
    ].filter(Boolean).join("，");
    addLog(`${enemyName}使用${action.name}，造成 ${rawDamage} 点伤害${detail ? `（${detail}）` : ""}；防御抵挡 ${blocked} 点，你受到 ${received} 点伤害。`, enemyLogClass);

    if (blocked > 0) spawnFloatText(document.querySelector(".player-portrait"), `格挡 ${blocked}`, "defense-float");
    if (received > 0) {
      game.player.wasDamagedThisTurn = true;
      spawnFloatText(document.querySelector(".player-portrait"), `-${received}`, "");
      animateHit(document.querySelector(".player-portrait"));
      playPlayerHitEffect();
      checkTailCutRelic();
      setBattleMessage(`${enemyName}的${action.name}撕开防线，你受到 ${received} 点伤害！`);
    } else {
      setBattleMessage(`蛊甲震颤，完整挡下${enemyName}的${action.name}。`);
    }

    if (action.lifespanDamage) {
      const lifeBefore = game.player.lifespan;
      game.player.lifespan = Math.max(0, lifeBefore - action.lifespanDamage);
      addLog(`${action.name}啃去你 ${action.lifespanDamage} 点寿元。`, "damage-log");
      spawnFloatText(document.querySelector(".player-portrait"), `-${action.lifespanDamage} 寿元`, "resource-float");
      // V0.9.9 寿道·子批2b：敌啃寿把寿元啃到归零亦判寿尽（lifeBefore>0 守卫：开局即 0 入场被啃不致死）。
      markLifespanDeathIfExhausted(lifeBefore);
    }
    if (action.energyDrain) {
      game.player.nextTurnEnergyPenalty = Math.max(game.player.nextTurnEnergyPenalty, action.energyDrain);
      addLog(`${action.name}封住空窍：下回合真元恢复减少 ${action.energyDrain}。`, "damage-log");
    }
    if (action.playerPoison) {
      game.player.poison += action.playerPoison;
      addLog(`${action.name}使你获得 ${action.playerPoison} 层毒性。`, "damage-log");
      spawnFloatText(dom.playerPortrait, `+${action.playerPoison} 毒性`, "resource-float");
      spawnEffectAt(dom.playerPortrait, "effect-poison-mist", { duration: 620 });
    }
    // V0.9.8 三层·毒刺（毒蜂蛊/灾厄蜂后）：action.playerPoisonSting 给玩家叠毒刺，回合开始固定扣血、不衰减，封顶 10。
    if (action.playerPoisonSting) {
      game.player.poisonStingStack = Math.min(10, (game.player.poisonStingStack || 0) + action.playerPoisonSting);
      addLog(`${action.name}刺入毒针：毒刺 +${action.playerPoisonSting}（每回合开始固定扣血）。`, "damage-log");
      spawnFloatText(dom.playerPortrait, `+${action.playerPoisonSting} 毒刺`, "resource-float");
    }
    // V0.9.12.1 乱铃摇魂：disorientBell 使玩家下回合少抽牌（此前该标志从未被消费，属死机制修复）。
    if (action.disorientBell) {
      game.player.nextTurnDrawPenalty = Math.max(game.player.nextTurnDrawPenalty || 0, action.disorientBell);
      addLog(`${action.name}铃音扰神：下回合抽牌 -${action.disorientBell}。`, "damage-log");
      spawnFloatText(dom.playerPortrait, `乱铃 -${action.disorientBell} 抽牌`, "resource-float");
    }
    // V0.9.6.3 易伤：action.applyVulnerable 给玩家叠易伤（断脉蛊徒等）。
    if (action.applyVulnerable) {
      game.player.vulnerable = (game.player.vulnerable || 0) + action.applyVulnerable;
      addLog(`${action.name}撕裂你的护蛊：易伤 +${action.applyVulnerable}。`, "damage-log");
      spawnFloatText(dom.playerPortrait, `+${action.applyVulnerable} 易伤`, "resource-float");
    }
    // V0.9.6.3 吸血：action.lifesteal —— 命中（received>0）后回复，最多补满 maxHp。
    if (action.lifesteal && received > 0) {
      const healed = Math.min(action.lifesteal, game.enemy.maxHp - game.enemy.hp);
      if (healed > 0) {
        game.enemy.hp += healed;
        addLog(`${enemyName}噬血回复 ${healed} 点生命。`, enemyLogClass);
        spawnDelayedFloatText(dom.enemyPortrait, `回血 +${healed}`, "heal-float", 120);
      }
    }
    // V0.9.6.3 自损：action.selfBleed —— 结算后扣自身生命；扣血后补一次半血相位/狂怒判定（不重复）。
    if (action.selfBleed) {
      const before = game.enemy.hp;
      game.enemy.hp = Math.max(0, game.enemy.hp - action.selfBleed);
      if (game.enemy.hp < before) {
        addLog(`${enemyName}以${action.name}割伤自身，自损 ${action.selfBleed} 点。`, enemyLogClass);
        spawnDelayedFloatText(dom.enemyPortrait, `-${action.selfBleed} 自损`, "", 160);
        animateHit(dom.enemyPortrait);
        checkLayer2BossPhase2();
        checkCorpseDiskPhase2();
      }
    }
  }

  // 防御在敌方行动完成后清零，既符合回合规则，也能真正抵挡本回合意图。
  // V0.9.57 缀甲线：清零时保留至多 2 点到下一回合（取清零【前】的值来算，别在归零后再问）。
  game.player.armor = typeof getMendingThreadKeep === "function" ? getMendingThreadKeep(game.player.armor) : 0;
  settlePoisonBorrowedScaleAfterEnemyAction(action, borrowAttackLifeDamage);
  resolvePoisonAtEnemyTurnEnd();
  if (isMupanBattle()) {
    render();
    if (checkBattleResult()) return;
    updateMupanPhase("poison");
    game.mupan.pendingEnemyAction = null;
    game.mupan.rewrittenAction = null;
    render();
    enemyTurnTimer = window.setTimeout(beginNextTurn, 360);
    return;
  }
  render();
  if (checkBattleResult()) return;
  enemyTurnTimer = window.setTimeout(beginNextTurn, 360);
}

/* === V0.9.6.3 新增独立函数：二层敌人转毒机制 + 敌人动作 flag 检测 === */

// 转毒仍在毒伤前按阈值与冷却结算；吞毒自 V0.9.58 起已改为可见敌方意图，不再由此处自动触发。
function checkLayer2EnemyPoisonMechanics() {
  if (!game || !game.enemy || game.enemy.hp <= 0) return;
  const def = game.enemy.definition;
  // 转毒/吐毒：enemy.poison >= threshold -> 自身毒减半、玩家获得 give 层毒。
  // V0.9.8.4 反制：玩家毒封顶 cap（避免每回合复利叠加导致必死），可选 cooldown 回合冷却。
  if (def.poisonConvert && game.enemy.poison >= def.poisonConvert.threshold) {
    const cv = def.poisonConvert;
    const cd = cv.cooldown || 0;
    const onCooldown = cd > 0 && game.enemy.lastConvertTurn != null && (game.turn - game.enemy.lastConvertTurn) < cd;
    if (!onCooldown) {
      const before = game.enemy.poison;
      game.enemy.poison = Math.floor(before / 2);
      game.pendingEnemyPoisonPulse = true;
      const cap = cv.cap != null ? cv.cap : cv.give * 2;
      const prev = game.player.poison;
      // V0.9.12.1 修复：封顶只限制增量、不反向削减存量——此前玩家毒超上限时反被压回 cap（等于替玩家清毒）。
      game.player.poison = Math.max(prev, Math.min(cap, prev + cv.give));
      const added = game.player.poison - prev;
      game.enemy.lastConvertTurn = game.turn;
      if (added > 0) {
        addLog(`${def.name}吐毒：反施 ${added} 层毒性于你（封顶 ${cap}），自身毒减半（${before}→${game.enemy.poison}）。`, "enemy-log");
        spawnFloatText(dom.playerPortrait, `+${added} 毒性`, "resource-float");
      } else {
        addLog(`${def.name}吐毒受阻：你的毒已达上限 ${cap}，自身毒减半（${before}→${game.enemy.poison}）。`, "enemy-log");
      }
      spawnDelayedFloatText(dom.enemyPortrait, `吐毒 -${before - game.enemy.poison}`, "poison-float", 60);
    }
  }
}

// 辅助：当前敌人 actions 中是否存在某 flag 字段（用于状态栏推 吸血/自损 标记）。
function enemyHasActionFlag(flag) {
  const actions = game.enemy?.definition?.actions;
  if (!actions) return false;
  return Object.values(actions).some((a) => a && a[flag]);
}

function resolvePoisonAtEnemyTurnEnd() {
  if (game.enemy.poison <= 0) return;
  // 转毒在毒伤前判定；吞毒已经由本回合可见意图完成定量消费，余毒照常结算。
  checkLayer2EnemyPoisonMechanics();
  if (game.enemy.poison <= 0) return;
  recordBossPoisonPeak();
  applyCorpseDiskPoisonSuppression();
  const damage = applyMupanIncomingDamage(game.enemy.poison);
  if (damage <= 0) return;
  game.enemy.hp = Math.max(0, game.enemy.hp - damage);
  recordPoisonDamage(damage);
  checkLayer2BossPhase2();
  addLog(`毒性发作，对${game.enemy.definition.name}造成 ${damage} 点伤害。`, "poison-log");
  setBattleMessage(`毒蛊侵入经络，${game.enemy.definition.name}受到 ${damage} 点毒性伤害！`);
  spawnFloatText(dom.enemyPortrait, `毒 -${damage}`, "poison-float");
  animateHit(dom.enemyPortrait);
  playPoisonTickEffect();
  checkCorpseDiskPhase2();
}

function applyCorpseDiskPoisonSuppression() {
  if (!isCorpseDiskBoss()) return;
  if (game.enemy.hp <= 0) return;
  if (game.enemy.poison <= 12) return;
  const removed = Math.min(3, game.enemy.poison);
  game.enemy.poison = Math.max(0, game.enemy.poison - removed);
  const stats = getRunStats();
  stats.bossPoisonSuppressions += 1;
  stats.bossPoisonSuppressedLayers += removed;
  addLog(`尸盘转动，压去 ${removed} 层毒性。`, "boss-log");
  spawnDelayedFloatText(dom.enemyPortrait, `压毒 -${removed}`, "poison-float", 60);
  playCorpseDiskPoisonSuppressionEffect(removed);
  game.pendingEnemyPoisonPulse = true;
}

function beginNextTurn() {
  if (!game || game.status !== "playing") return;
  enemyTurnTimer = null;
  game.turn += 1;
  advanceDragonTransformTurn();
  if (game.bone) {
    game.bone.cardArmorGrantedThisTurn = false;
    game.bone.boneShatterResonanceGrantedThisTurn = false;
    game.bone.residualBonePinTriggeredThisTurn = false;
    game.bone.enemyBreakGrantedThisAction = false;
    game.bone.chimeUsedThisTurn = false;
    game.bone.afterEchoPrimed = false;
    game.bone.cardArmorLockedThisTurn = false;
  }
  game.bloodStitchState = "unprepared";
  game.bloodAtonementUsesThisTurn = 0;
  game.poisonAfterstrikeState = "waitingAttack";
  game.poisonBorrowedScaleUsedThisTurn = false;
  game.poisonBorrowedScalePendingAttack = false; // 兜底：验收只跟随当次敌方攻击，进入新回合必然清空
  if (isMupanBattle()) {
    game.mupan.currentTurn = game.turn;
    resetMupanTurnMetrics();
    game.mupan = beginMupanPlayerTurn(game.mupan, ENEMY_BALANCE.mupan);
  }
  game.player.wasDamagedThisTurn = false;
  resolvePlayerPoisonAtTurnStart();
  // V0.9.9.2 血溟囊：每回合开始自损 2（置于死亡判定前，统一判死）
  if (game.player.heroId === "blood" && hasOrdinaryRelic("bloodAbyss")) {
    losePlayerHealth(2);
    addLog("血溟囊噬主：每回合开始自损 2 点生命。", "damage-log");
  }
  if (game.player.hp <= 0) {
    render();
    checkBattleResult();
    return;
  }
  const penalty = game.player.nextTurnEnergyPenalty;
  game.player.energy = Math.max(1, game.player.baseEnergy + getDragonEnergyBonus() - penalty);
  game.player.nextTurnEnergyPenalty = 0;
  const delayedArmor = Math.max(0, game.player.nextTurnArmor || 0);
  game.player.nextTurnArmor = 0;
  if (delayedArmor > 0) {
    gainArmor(delayedArmor, "伏脉蛊", "伏脉显化");
    addLog(`伏脉显化：获得 ${delayedArmor} 点防御。`, "positive-log");
  }
  game.cardsPlayedThisTurn = 0;
  game.actionEconomyFirstDrawUsedThisTurn = {};
  game.ecologyCountersUsedThisTurn = {};
  game.player._burningEssenceCount = 0; // V0.9.27：燃元蛊递减封顶按回合重置
  game.lastCardCategoryThisTurn = null;
  game.thunderSequence = null;
  game.calamityAsh = null;
  game.fateGainedThisTurn = false;
  game.fateBurstsThisTurn = 0;
  game.fateTriadGraceUsedThisTurn = false;
  game.fateRouteGuardUsedThisTurn = false;
  game.fateRewriteUsedThisTurn = false;
  game.fateRewriteCandidate = null;
  game.spellDoubleThisTurn = false; // V0.9.9 寿道·子批3：回光翻倍仅限本回合，跨回合重置
  game.duskRelightUsedThisTurn = false; // V0.9.51 #29 朝暮回灯：每回合首次焚寿才换血
  if (game.enemy) game.enemy.dmgTakenThisTurn = 0;
  game.supportDrawPrimed = 0;
  if (game.combatRelic) game.combatRelic.bloodJadeHealsThisTurn = 0;

  if (runState.relicId === "boneCarapace") {
    game.player.armor += 4;
    recordArmorGained(4);
    spawnFloatText(document.querySelector(".player-portrait"), "+4 护甲", "defense-float");
    playArmorEffect();
  }
  // V0.9.9.2 引毒幡：回合开始若敌人中毒，毒性 +2
  if (game.enemy && game.enemy.poison > 0 && hasOrdinaryRelic("venomLead")) {
    game.enemy.poison += 2;
    addLog("引毒幡：毒性蔓延，敌人毒性 +2。", "poison-log");
    spawnFloatText(dom.enemyPortrait, "+2 毒性", "poison-float");
    notifyRelicTrigger("venomLead", "毒蔓延·毒性+2");
  }
  // V0.9.51 #27 毒心珠：回合开始敌毒 ≥5 层回 2 血
  if (game.enemy && (game.enemy.poison || 0) >= 5 && hasOrdinaryRelic("venomHeartPearl")) {
    healPlayer(2, "毒心珠");
    addLog("毒心珠共鸣：敌毒深重，反哺 2 点生命。", "positive-log");
    notifyRelicTrigger("venomHeartPearl", "毒深·回血 2");
  }
  // V0.9.51 #27 鳞甲蜕：龙形期间每回合开始 +3 护甲（hasOrdinaryRelic 前置短路，供门禁沙箱免桩）
  if (hasOrdinaryRelic("dragonHide") && isDragonHero() && game.dragon.transformed) {
    gainArmor(3, "鳞甲蜕", "龙形护体");
    notifyRelicTrigger("dragonHide", "龙形·护甲+3");
  }
  applyHeroTurnStartPassive();
  // V0.9.8 三层·乱铃（骨铃巡蛊）：本回合少抽 nextTurnDrawPenalty 张，保底抽至 1 张，随后清零。
  const drawPenalty = game.player.nextTurnDrawPenalty || 0;
  drawToHandSize(Math.max(1, game.handTarget - drawPenalty));
  if (game.bone?.listeningCasePrimed) {
    game.bone.listeningCasePrimed = false;
    gainArmor(4, "听骨匣", "碎甲回响", { suppressBone: true });
    drawCards(1);
    addLog("听骨匣回响：防御 +4，并额外抽 1 张牌。", "positive-log");
  }
  if (drawPenalty > 0) {
    addLog(`乱铃缠耳，本回合少抽 ${drawPenalty} 张。`, "damage-log");
    game.player.nextTurnDrawPenalty = 0;
  }
  /* V0.9.57 玩家实报：「打完一轮牌后会自动补充卡牌、回复真元……这些教程都没讲，摸索的过程好痛苦」。
   * 同样是「讲过但记不住」——改到他第一次真经历回合交替的当下讲。战斗中走日志降级正合适。 */
  showCoachTip("firstTurnRefill", "回合交替：你结束回合、敌人行动完，下一回合会自动把手牌补满并恢复真元——所以手里的牌该打就打，留着不会累积，攒牌反而亏一轮。防御则会在敌人行动后清零。");
  // V0.9.9.2 焚牌饲岁：寿元每低一档，回合开始额外抽 1 张（满0/过半1/残2/垂暮3）
  if (game.player.heroId === "longevity" && hasOrdinaryRelic("burnDraw")) {
    const __ld = longevityTier(game.player);
    if (__ld > 0) { drawCards(__ld); addLog(`焚牌饲岁：寿元${__ld}档，额外抽 ${__ld} 张牌。`, "positive-log"); notifyRelicTrigger("burnDraw", `寿低·额外抽${__ld}`); }
  }
  chooseEnemyIntent();
  if (resolveExistingFateAfterIntent() && checkBattleResult()) return;
  game.inputLocked = false;
  addLog(`第 ${game.turn} 回合开始：真元恢复至 ${game.player.energy}，手牌补至 ${game.handTarget} 张。`, "important");
  if (penalty > 0) addLog(`镇魂余力未散，本回合真元少恢复 ${penalty} 点。`, "damage-log");
  if (typeof applyTurnStartRelics === "function") applyTurnStartRelics(); // V0.9.57 龙脉核：龙形期间回合开始真元 +1（须在真元结算之后）
  render();
  showTurnBanner(`第 ${game.turn} 回合`, "真元回涌");
}

function resolvePlayerPoisonAtTurnStart() {
  // V0.9.8 三层·毒刺：回合开始按 poisonStingStack 固定扣血，不衰减，独立于普通中毒。
  if ((game.player.poisonStingStack || 0) > 0) {
    const stingDamage = game.player.poisonStingStack;
    game.lastHurtSource = "poisonTick";
    const hpBefore = game.player.hp;
    game.player.hp = Math.max(0, game.player.hp - stingDamage);
    checkHeroLowLife(hpBefore);
    recordEnemyDamage(stingDamage);
    game.player.wasDamagedThisTurn = true;
    addLog(`蜂窟毒刺发作：你受到 ${stingDamage} 点伤害（毒刺不衰减）。`, "damage-log");
    window.AudioManager?.playSfx?.("poisonApply", { volumeScale: 0.4 }); // EXP-1a：毒刺发作有声
    spawnFloatText(dom.playerPortrait, `毒刺 -${stingDamage}`, "poison-float");
  }
  if (game.player.poison <= 0) return;
  const damage = game.player.poison;
  game.lastHurtSource = "poisonTick";
  const hpBefore = game.player.hp;
  game.player.hp = Math.max(0, game.player.hp - damage);
  checkHeroLowLife(hpBefore);
  recordEnemyDamage(damage);
  game.player.poison = Math.max(0, game.player.poison - 1);
  game.player.wasDamagedThisTurn = true;
  addLog(`蛊火毒性发作：你受到 ${damage} 点伤害，毒性衰减 1 层。`, "damage-log");
  window.AudioManager?.playSfx?.("poisonApply", { volumeScale: 0.4 }); // EXP-1a：毒发有声（与施毒同色低量）
  spawnFloatText(dom.playerPortrait, `毒 -${damage}`, "poison-float");
  animateHit(dom.playerPortrait);
  spawnEffectAt(dom.playerPortrait, "effect-poison-corrosion", { duration: 620 });
  playPlayerHitEffect();
  checkTailCutRelic();
}

/* ============ 激励视频局内入口·纯规则 ============
 * 战前加持、续命与普通战重抽按场景可重复；整局收获每局一次。
 * UI 回调必须严格 ok === true，并在发奖前复核 click-time 身份。 */
function ensureRunRewardedAds(run) {
  const base = { reviveUsed: false, rewardRerollUsed: false, harvestDoubleUsed: false, blessCount: 0, blessPending: 0 };
  if (!run) return base;
  const r = run.rewardedAds || {};
  run.rewardedAds = {
    // 旧字段只为存档兼容；新流程不读取、不写回它们。
    reviveUsed: r.reviveUsed === true,
    rewardRerollUsed: r.rewardRerollUsed === true,
    harvestDoubleUsed: r.harvestDoubleUsed === true,
    blessCount: Math.max(0, Math.floor(Number(r.blessCount) || 0)),
    blessPending: Math.max(0, Math.floor(Number(r.blessPending) || 0)),
  };
  return run.rewardedAds;
}

const PRE_BATTLE_BLESS = Object.freeze({ openArmor: 8, attackBonus: 1 });

function canOfferPreBattleBless(ctx) {
  ctx = ctx || {};
  return ctx.runStatus === "running"
    && ctx.mapVisible === true
    && ctx.mapOperable === true
    && ctx.battleActive !== true
    && ctx.rewardVisible !== true
    && ctx.finalVisible !== true;
}

function resolvePreBattleBless(ctx) {
  ctx = ctx || {};
  const ads = ctx.rewardedAds || {};
  return {
    blessCount: Math.max(0, Math.floor(Number(ads.blessCount) || 0)) + 1,
    blessPending: Math.max(0, Math.floor(Number(ads.blessPending) || 0)) + 1,
  };
}

function consumePreBattleBless(ctx) {
  ctx = ctx || {};
  const layers = Math.max(0, Math.floor(Number(ctx.rewardedAds?.blessPending) || 0));
  const consume = ctx.tutorial !== true && ctx.mupan !== true && layers > 0;
  return {
    layers: consume ? layers : 0,
    armor: consume ? PRE_BATTLE_BLESS.openArmor * layers : 0,
    attackBonus: consume ? PRE_BATTLE_BLESS.attackBonus * layers : 0,
    blessPending: consume ? 0 : layers,
  };
}

function isRewardedMapBlessContextCurrent(captured, current) {
  return Boolean(captured?.run && current
    && captured.run === current.run
    && captured.panel === current.panel
    && canOfferPreBattleBless(current));
}

// 战败续命：生命归零、第二场起；无尽、母盘与逆命契直接终局不提供。
function canOfferRewardedRevive(ctx) {
  ctx = ctx || {};
  return ctx.deathCause === "hp" && Number(ctx.battlesCleared) >= 1
    && ctx.isEndless !== true && ctx.isMupan !== true && ctx.isDefyTerminal !== true;
}
// 续命结算(纯)：恢复到 30% 最大生命，保持敌方场面；不写旧 reviveUsed。
function resolveRewardedRevive(ctx) {
  ctx = ctx || {};
  const maxHp = Math.max(1, Number(ctx.maxHp) || 1);
  return { hp: Math.max(1, Math.ceil(maxHp * 0.3)), enemyHp: Number(ctx.enemyHp) || 0 };
}

function isRewardedReviveContextCurrent(captured, current) {
  return Boolean(captured?.run && current
    && captured.run === current.run
    && captured.battle === current.battle
    && captured.node === current.node
    && captured.enemy === current.enemy
    && captured.panel === current.panel
    && captured.overlay === current.overlay
    && current.runStatus === "running"
    && current.deathPanelVisible === true
    && current.resultVisible === true
    && canOfferRewardedRevive(current));
}

// 普通战奖励重抽：普通战、击败至少两敌、尚未选牌；不读旧 rewardRerollUsed。
function canOfferRewardReroll(ctx) {
  ctx = ctx || {};
  return ctx.nodeType === "battle" && Number(ctx.enemiesDefeated) >= 2 && ctx.rewardResolved !== true;
}
// 重抽结算(纯)：只换三选一牌面并保留其他战利品；不写旧 rewardRerollUsed。
function resolveRewardReroll(ctx) {
  ctx = ctx || {};
  return { otherLoot: ctx.otherLoot };
}

function isRewardedRerollContextCurrent(captured, current) {
  if (!captured?.run || !current) return false;
  if (captured.run !== current.run
      || captured.nodeId !== current.nodeId
      || captured.rewardKeys !== current.rewardKeys
      || captured.pendingPick !== current.pendingPick
      || captured.panel !== current.panel
      || captured.overlay !== current.overlay
      || current.runStatus !== "running"
      || current.rewardPanelVisible !== true
      || current.resultVisible !== true
      || !canOfferRewardReroll(current)) return false;
  if (!Array.isArray(current.rewardKeys) || current.rewardKeys.length !== captured.rewardKeysSnapshot.length) return false;
  return current.rewardKeys.every((key, index) => key === captured.rewardKeysSnapshot[index]);
}

function isNonEmptyHarvestSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  const materialTotal = Object.values(snapshot.materials || {}).reduce((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0);
  return materialTotal > 0 || Number(snapshot.cores) > 0 || Number(snapshot.scrip) > 0 || Number(snapshot.daoxing) > 0;
}

function isRewardedHarvestContextCurrent(captured, current) {
  const terminal = ["dead", "withdrawn", "cleared"].includes(current?.status);
  return Boolean(captured?.run && current && terminal
    && captured.run === current.run
    && captured.status === current.status
    && captured.outcome === current.outcome
    && captured.snapshot === current.snapshot
    && captured.panel === current.panel
    && captured.overlay === current.overlay
    && current.panelVisible === true
    && current.resultVisible === true
    && isNonEmptyHarvestSnapshot(captured.snapshot)
    && ensureRunRewardedAds(captured.run).harvestDoubleUsed !== true);
}

/* AD-2 战败续命·UI 侧：结算 overlay 内呈现「看广告续命 / 结束本局」选择面板。此时死亡尚未结算(未 finalizeRun)。 */
function presentRewardedReviveOffer() {
  const card = dom.resultOverlay?.querySelector(".result-card");
  if (card) card.className = "result-card defeat";
  hideRewardPanels();
  // 关掉一切可能残留的战后子面板，只留续命选择面板，杜绝重叠。
  dom.cardRewardPanel?.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel?.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultSeal.textContent = "危";
  dom.resultEyebrow.textContent = `止步第 ${getCurrentRouteStep()} 段 · 命火将熄`;
  dom.resultTitle.textContent = "生死一线";
  dom.resultDescription.textContent = "你的生命归零——命火尚有一线，可自愿观看广告续命，完整观看后续战本局。";
  // 复位续命按钮态（防上一次残留忙碌/禁用）。
  if (dom.reviveWatchAdButton) {
    dom.reviveWatchAdButton.dataset.busy = "";
    dom.reviveWatchAdButton.removeAttribute("aria-busy");
    dom.reviveWatchAdButton.removeAttribute("disabled");
    const lbl = dom.reviveWatchAdButton.querySelector("strong");
    if (lbl) lbl.textContent = "看广告 · 续命：回复 30% 生命";
  }
  if (dom.reviveDeclineButton) dom.reviveDeclineButton.disabled = false;
  dom.reviveOfferPanel?.classList.remove("hidden");
}

function getRewardedReviveCurrentContext() {
  const node = getCurrentRunNode();
  const battlesCleared = runState
    ? getRunStats().battleSummaries.filter((summary) => summary && summary.victory).length
    : 0;
  const isDefyTerminal = node?.type === "defy"
    && typeof isContractDefyFatal === "function" && isContractDefyFatal(runState);
  return {
    run: runState,
    runStatus: runState?.status,
    battle: game,
    node,
    enemy: game?.enemy,
    panel: dom.reviveOfferPanel,
    overlay: dom.resultOverlay,
    deathPanelVisible: Boolean(dom.reviveOfferPanel && !dom.reviveOfferPanel.classList.contains("hidden")),
    resultVisible: Boolean(dom.resultOverlay && !dom.resultOverlay.classList.contains("hidden")),
    deathCause: game?.lifespanDeath ? "lifespan" : (game?.player?.hp <= 0 && game?.status === "defeat" && game?.battleFinished ? "hp" : ""),
    battlesCleared,
    isEndless: isEndlessRun(runState),
    isMupan: isMupanBattle(),
    isDefyTerminal,
  };
}

/* 完整观看后续命：回 30% 生命、续战本局。不重建敌人/牌堆/状态对象；死亡发生在敌人回合末(主流)→ 给玩家一个干净新回合。 */
function applyRewardedRevive(context) {
  const current = getRewardedReviveCurrentContext();
  if (!isRewardedReviveContextCurrent(context, current)) return false;
  if (runState.status !== "running") return false;
  // 撤销本场战败在 recordBattleFinished 里写入的临时 summary/turns/death 字段。
  const stats = getRunStats();
  rollbackProvisionalBattleLossStats(stats, game.rewardedReviveStatsRollback);
  game.rewardedReviveStatsRollback = null;
  const rev = resolveRewardedRevive({ maxHp: game.player.maxHp, enemyHp: game.enemy?.hp || 0 });
  game.player.hp = rev.hp;
  runState.currentHp = rev.hp;
  game.lifespanDeath = false;
  game.battleFinished = false;
  game.status = "playing";
  game.inputLocked = true; // beginNextTurn 末尾会解锁
  addLog(`逆命一线：你观广续命，回复 ${rev.hp} 点生命，续战本局。`, "important");
  // 收起结算 overlay，回到战斗界面。
  dom.reviveOfferPanel?.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  document.body.classList.remove("modal-open");
  setCombatHandActive(true);
  updateMobileViewportState();
  // 死亡发生在敌人回合结算末尾（主流场景，此时敌人已行动完毕）→ 直接开启玩家新回合（抽牌/回真元/回合起始触发）。
  // 若玩家回合内自损致死，则续命慷慨地跳过一次敌方回合；每次均须完整看广告。
  beginNextTurn();
  render();
  return true;
}

/* 放弃续命 / 广告失败 → 走原死亡结算。 */
function declineRewardedReviveAndDie() {
  dom.reviveOfferPanel?.classList.add("hidden");
  finalizeBattleDefeat();
  dom.resultTurns.textContent = game.turn;
  dom.resultHp.textContent = Math.max(0, game.player.hp);
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateMobileViewportState();
  render();
}

function checkBattleResult() {
  // 同一张蛊若令双方同时归零，蛊修完成以命换命，仍判定夺得传承。
  if (game.enemy.hp <= 0) {
    finishBattle(true);
    return true;
  }
  if (isMupanBattle()) updateMupanPhase("player");
  if (game.player.hp <= 0) {
    finishBattle(false);
    return true;
  }
  // V0.9.9 寿道·子批2b：寿元归零即陨——仅由战斗内焚寿/敌啃寿跨过 0 触发（lifespanDeath 标记），战后焚寿/夹 0 不致死。
  if (game.lifespanDeath) {
    finishBattle(false);
    return true;
  }
  return false;
}

/* 真正离开本场战斗时才清掉临时战斗态。激励续命选择期间仍是同一场战斗，不能提前抹掉龙化、龙鳞或酒意。 */
function settleBattleTransientState() {
  if (!game) return;
  if (game.dragon) {
    game.dragon.transformed = false;
    game.dragon.turnsRemaining = 0;
    game.dragon.scale = 0;
  }
  if (game.player) {
    game.player.drunkStacks = 0;
    game.player.drunkFlatBonus = 0;
  }
  document.body.classList.remove("dragon-form-active", "dragon-transforming");
  clearCombatEffects();
}

function finishBattle(victory) {
  if (!game || game.battleFinished) return false;
  game.battleFinished = true;
  // 奖励、炼蛊与结算仍会沿用 game 读取本场数据；单独关闭手牌运行态，
  // 避免浮动牌匣和发牌动画跨层压在所有战后页面之上。
  setCombatHandActive(false);
  if (game?.tutorialDrill) { settleBattleTransientState(); finishTutorialDrill(victory); return; } // 教学演武：不进奖励与结算管线
  if (isMupanBattle()) {
    // E-2c4 身份分流：开发测试整场走测试收口；正式塔心胜利走专属收口；正式败北恢复封存牌+落统计后，继续走通用死亡结算（dead）。
    if (game.isMupanTest) { settleBattleTransientState(); finishMupanTestBattle(victory); return; }
    if (victory) { settleBattleTransientState(); finishTowerMupanBattle(); return; }
    restoreMupanSealedCardsToBattle();
    writeTowerMupanStats("defeat");
  }
  const currentNode = getCurrentRunNode();
  const rewardedReviveAvailable = !victory
    && canOfferRewardedRevive({
      deathCause: game.lifespanDeath ? "lifespan" : "hp",
      battlesCleared: getRunStats().battleSummaries.filter((summary) => summary && summary.victory).length,
      isEndless: isEndlessRun(runState),
      isMupan: isMupanBattle(),
      isDefyTerminal: currentNode?.type === "defy"
        && typeof isContractDefyFatal === "function" && isContractDefyFatal(runState),
    })
    && typeof NmgAds !== "undefined" && NmgAds.isRewardedAvailable() && NmgAds.isSessionEligible();
  game.status = victory ? "victory" : "defeat";
  game.inputLocked = true;
  if (!rewardedReviveAvailable) settleBattleTransientState();
  recordBattleFinished(victory);
  syncRunStateFromBattle();
  // V0.9.8.5 胜利结算前置增益（放 sync 之后、各层 return 分支之前，覆盖一/二/三层全部胜利）：
  if (victory) {
    // V0.9.8.5b 修「0血过关」：checkBattleResult 先判敌死，双方同归零判胜（命换命）→ 玩家会停在0血带进下一层（活着的0血=坏状态）。险胜保底夹到1血。
    if (game.player.hp <= 0) { game.player.hp = 1; runState.currentHp = 1; }
    grantEcologyBattleReward(currentNode);
    if (runState.relicId === "jadeMarrow") healRunHp(6, "寒玉髓"); // 寒玉髓续航引擎：每场战斗后回 6 生命
    if (typeof applyCinderPouchOnVictory === "function") applyCinderPouchOnVictory(); // V0.9.57 余烬袋：战斗胜利后回 4 生命
    if (currentNode?.type === "boss") {
      const bossStones = gainGuStones(15, "Boss胜利"); // 所有 Boss 胜利补蛊石（type==="boss" 覆盖一/二/三层 Boss）。结算回执显示实际入账（含模式倍率）。
      // V0.9.22 蛊庐：Boss 掉蛊母残核（孵天品蛊卵的钥匙）——只有活着走出塔才带得出（阵亡散逸）。
      runState.bossCores = (runState.bossCores || 0) + 1;
      runState.lastBattleRewards = { type: "boss", stones: bossStones, bossCores: 1 };
      addLog("蛊母残核入手：活着带出塔，方能在蛊庐孵道脉精品蛊卵。", "important");
    }
    if (runState.heroId === "blood") {
      let __bn = Math.min(8, game.bloodCardsPlayedThisBattle || 0); // 血道被动：战后按本场血道出牌数回血（每张+1，上限8）
      // V0.9.51 浊血契代价：战后按出牌数回血减半（先夹 8 再折半，上限 4）。
      if (typeof getContractPostBattleHealFactor === "function") {
        const __hf = getContractPostBattleHealFactor(runState);
        if (__hf < 1 && __bn > 0) {
          const __cut = __bn - Math.floor(__bn * __hf);
          __bn -= __cut;
          getRunStats().contractHealHalvedAmount = safeStatNumber(getRunStats().contractHealHalvedAmount) + __cut;
        }
      }
      if (__bn > 0) healRunHp(__bn, "血海饲蛊·战意续息");
    }
    // V0.9.51 #27 暮灯盏：战斗胜利且本场焚过寿元 → 回 4 生命
    if (hasOrdinaryRelic("duskLamp") && (game.burnedLifespanThisBattle || 0) > 0) {
      healRunHp(4, "暮灯盏");
      notifyRelicTrigger("duskLamp", "焚寿归灯·回血 4");
    }
    if (runState.heroId === "fate" && hasOrdinaryRelic("fateRemnant")) runState.carriedFate = Math.floor((game.player.fateMomentum || 0) / 2); // V0.9.9.2 残势续燃：胜后留半数命势带入下场
    if (hasOrdinaryRelic("stoneInterest")) gainGuStones(3, "蛊石生息", { raw: true }); // V0.9.9.2 蛊石生息：每段战斗胜利额外 3 蛊石。V0.9.27：固定 3（描述本写死"额外 3 枚"），走 raw 不再被死劫/十重天 rewardMul×1.7 抬成 5——堵经济通胀的规格违背
    if (runState.relicId === "siSuiLun") {
      // 饲岁轮：战后焚 2 寿（夹 0、不致死——战后焚寿不触发寿尽，与子批2b约定一致），并蓄上下场首回合 +2 真元。
      const __lifeBefore = runState.lifespan;
      runState.lifespan = Math.max(0, runState.lifespan - 2);
      game.player.lifespan = runState.lifespan;
      recordMupanCostDelta(getRunStats(), "lifespanSpent", __lifeBefore, runState.lifespan, "active");
      const __burned = __lifeBefore - runState.lifespan;
      if (__burned > 0) addLog(`饲岁轮吞噬岁月：战斗结束焚去 ${__burned} 点寿元。`, "system-log");
      runState.siSuiLunYuanPrimed = true;
    }
  }
  const card = dom.resultOverlay.querySelector(".result-card");
  card.className = `result-card ${victory ? "victory" : "defeat"}`;
  hideRewardPanels();
  // 战斗引导浮层固定在战斗页上；进入奖励/结算弹窗前必须收起，避免盖住奖励按钮。
  closeBattleCoach(false);
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");

  if (victory) {
    // 音画是可选副作用：延后到结算路径已确定之后，且逐项隔离，旧 WebView 音频异常不得卡住奖励/地图。
    window.setTimeout(() => {
      runOptionalBattleEffect(() => currentNode?.type === "boss" ? triggerHeroVoice("bossWin") : triggerHeroVoice("victory"), "victory voice");
      runOptionalBattleEffect(() => window.AudioManager?.playSfx?.("victory", { volumeScale: 0.5 }), "victory sfx");
      runOptionalBattleEffect(() => playVictoryEffect(), "victory effect");
    }, 0);
    if (!runState.defeatedEnemies.includes(game.enemy.definition.name)) {
      runState.defeatedEnemies.push(game.enemy.definition.name);
    }
    addLog(`${game.enemy.definition.name}倒下。命途图第 ${getCurrentRouteStep()} 段已经踏破！`, "important");
    if (currentNode?.type !== "boss") runState.lastBattleRewards = null;
    if (currentNode?.type === "elite") {
      runState.eliteDefeated = true;
      unlockLorePage("direGuard");
      const eliteStones = gainGuStones(16, "精英战胜利"); // V0.9.12.1：结算页显示实际入账（含模式系数），不再低报
      const eliteMaterial = sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0];
      gainMaterial(eliteMaterial, 1, "精英战利品");
      // V0.9.40 QS-1a 孤行契：凶煞额外遗物"直接入账"须先于 queueRelicOffer——后者选池会排除已拥有，避免同枚撞发。
      if (typeof getContractEliteRelicBonus === "function" && getContractEliteRelicBonus(runState) > 0) {
        let gainedContractRelics = 0;
        for (let i = 0; i < getContractEliteRelicBonus(runState); i += 1) {
          if (gainRandomOrdinaryRelic("孤行契·凶煞战利品", "reward", "journey")) gainedContractRelics += 1;
        }
        if (gainedContractRelics > 0) {
          const stats = getRunStats();
          stats.contractExtraOrdinaryRelics = safeStatNumber(stats.contractExtraOrdinaryRelics) + gainedContractRelics;
        }
      }
      const eliteRelic = queueRelicOffer("精英战利品", "reward");
      runState.lastBattleRewards = { type: "elite", stones: eliteStones, materialId: eliteMaterial, relicId: eliteRelic, furnace: true };
      addLog(`精英：${game.enemy.definition.name}已败，蛊炉机会已开启。`, "important");
    } else if (currentNode?.type === "defy") {
      // V0.9.8.6 逆命节点：高风险高回报——比精英更厚（24石+材料+遗物+蛊炉），选牌保底稀有（见 generateCardRewardChoices）
      runState.eliteDefeated = true;
      runState.defyWon = true; // V0.9.51 逆命契解锁条件：本局逆命搏杀胜利（finalizeRun 时 unlockCheck 读取）
      const defyStones = gainGuStones(24, "逆命搏杀胜利"); // 逆命敌随层不同（一层血纹狼王/二三层生态精英），不复用 direGuard 图鉴页避免串台
      // V0.9.51 逆命契：搏杀胜利额外蛊石（raw 固定值，不再吃模式奖励系数二次放大）。
      if (typeof getContractDefyBonusStones === "function") {
        const __defyBonus = getContractDefyBonusStones(runState);
        if (__defyBonus > 0) {
          gainGuStones(__defyBonus, "逆命契·押命厚赏", { raw: true });
          getRunStats().contractDefyBonusStones = safeStatNumber(getRunStats().contractDefyBonusStones) + __defyBonus;
        }
      }
      const defyMaterial = sampleWithRunRandom(MATERIAL_IDS, 1, "reward")[0];
      gainMaterial(defyMaterial, 1, "逆命战利品");
      const defyRelic = queueRelicOffer("逆命战利品", "reward");
      runState.lastBattleRewards = { type: "defy", stones: defyStones, materialId: defyMaterial, relicId: defyRelic, furnace: true };
      addLog(`逆命搏杀：${game.enemy.definition.name}伏诛，你以命换厚赏，蛊炉机会已开启。`, "important");
    } else if (currentNode?.type === "battle") {
      unlockLorePage("bloodStone");
      const battleStones = gainGuStones(8, "普通战斗胜利");
      // V0.9.16 丹囊：普通战约 1/4 掉 1 个消耗品（走 reward 种子通道；满囊自动折算蛊石）。
      // 掉落写入 lastBattleRewards，结算面板可见——否则玩家只能翻日志才知道掉了东西。
      let droppedItemId = null;
      if (getRunRandom("reward") < 0.25) {
        const dropId = pickBattleItemId();
        if (dropId && grantBattleItem(dropId, "战利丹囊")) droppedItemId = dropId;
      }
      runState.lastBattleRewards = { type: "battle", stones: battleStones, materialId: null, furnace: false, itemId: droppedItemId };
    }
    // TODO: 后续多幕路线扩展时抽象 finalNode / bossNode。
    // V0.9.8.5（1-A）：所有层的精英战胜利都走 openCardReward→选牌→蛊炉路径（关炉后 advanceToNextFloor 7696+ 已按层自动回对应层地图）。须置于 layer3/layer2 早返回之前，否则二/三层精英会被提前 return 回地图、永不开炉。V0.9.8.6：逆命节点同走此管线。
    if (currentNode?.type === "elite" || currentNode?.type === "defy") {
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = game.player.hp;
      openCardReward();
      // V0.9.8.5b 修卡死：精英分支提前 return，必须自己显示结算 overlay（否则选牌面板在隐藏 overlay 里、看不见点不了 → 卡死）。
      dom.resultOverlay.classList.remove("hidden");
      document.body.classList.add("modal-open");
      updateMobileViewportState();
      render();
      return;
    }
    // V0.9.51 无尽：必须先显示真实战后结算；玩家收完奖励后再推进段位/层数。
    // 此分支提前 return，故揭开 overlay 的动作不能依赖函数尾部通用收口。
    if (isEndlessRun()) {
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = game.player.hp;
      const __node = getEndlessCurrentNode();
      if (__node?.type === "battle") {
        openCardReward();
      } else {
        dom.resultSeal.textContent = __node?.type === "boss" ? "破" : "胜";
        dom.resultEyebrow.textContent = `无尽第 ${runState.endlessFloor || 1} 层 · 第 ${getEndlessStep()} 段踏破`;
        dom.resultTitle.textContent = isEndlessCapstone(__node) ? "塔层镇守已破" : "战斗告捷";
        dom.resultDescription.textContent = isEndlessCapstone(__node)
          ? "此层镇守已经伏诛。本场所得已记入本局，确认后进入更深一层。"
          : "敌影已经伏诛。本场所得已记入本局，确认后返回无尽命途图。";
        showBossRewardReceipt();
        showNextFloorButton();
        if (isEndlessCapstone(__node)) dom.resultPrimaryButton.textContent = "进入无尽下一层";
      }
      dom.resultOverlay.classList.remove("hidden");
      document.body.classList.add("modal-open");
      updateMobileViewportState();
      render();
      return;
    }
    if (isLayer3Run()) {
      // 第三层战斗：胜利后回第三层地图（Boss→三层结算），复用地图推进
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = game.player.hp;
      layer3CompleteNodeAndReturnMap();
      return;
    }
    if (isLayer2Run()) {
      // 第二层战斗：胜利后回第二层地图（Boss→二层结算），复用地图推进
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = game.player.hp;
      layer2CompleteNodeAndReturnMap();
      return;
    }
    if (isCurrentBossRoute()) {
      unlockLorePage("unfinished");
      completeCurrentBattleNode();
      // 一层 Boss 胜利不再强制结算：先弹「命途未尽」让玩家选结算/深入
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = game.player.hp;
      showUnfinishedPathChoice();
      render();
      return;
    } else {
      openCardReward();
    }
  } else {
    // 战败续命：仅「生命归零」战败(非寿尽)、第二场起且广告可用——每次符合条件都可自愿观看，先暂缓死亡结算。
    // 塔心母盘战排除：其封存牌/统计在上方已按战败收口，续命回战会与之冲突，风险不值当。
    // V0.9.51 逆命契代价：逆命搏杀战败直接终局——不给看广告续命的后路。
    const __defyFatal = getCurrentRunNode()?.type === "defy"
      && typeof isContractDefyFatal === "function" && isContractDefyFatal(runState);
    const __canRevive = rewardedReviveAvailable;
    if (__defyFatal) addLog("逆命契：押满的命没有回手——直接终局。", "enemy-log");
    if (__canRevive) {
      presentRewardedReviveOffer();
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = Math.max(0, game.player.hp);
      dom.resultOverlay.classList.remove("hidden");
      document.body.classList.add("modal-open");
      updateMobileViewportState();
      render();
      return; // 暂不 finalizeRun；玩家看完广告续战、或点「结束本局」再走死亡结算
    }
    finalizeBattleDefeat();
  }

  dom.resultTurns.textContent = game.turn;
  dom.resultHp.textContent = game.player.hp;
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateMobileViewportState();
  render();
}

// AD-2：战败死亡结算（从 finishBattle 抽出，供「不满足续命条件」与「玩家放弃续命」两条路径共用）。
function finalizeBattleDefeat() {
  settleBattleTransientState();
  const currentNode = getCurrentRunNode();
  window.setTimeout(() => {
    runOptionalBattleEffect(() => triggerHeroVoice("defeat"), "defeat voice");
    runOptionalBattleEffect(() => window.AudioManager?.playSfx?.("defeat", { volumeScale: 0.5 }), "defeat sfx");
    runOptionalBattleEffect(() => playDefeatEffect(), "defeat effect");
  }, 0);
  // V0.9.9 寿道·子批2b：寿尽与血竭分流播报。
  addLog(game.lifespanDeath ? "你的寿元焚尽，命火熄灭，道途断绝。" : "你的生命归零，道途断绝。", "damage-log");
  // V0.9.7：死亡上下文快照（纯派生死因分析用，全 ||/?. 兜底，拿不到 unknown）
  try { getRunStats().deathContext = snapshotDeathContext(); } catch (e) { getRunStats().deathContext = { source: "unknown" }; }
  // V0.9.6.3：二层阵亡需在结算前记录节点/敌名（layer2 失败分支不会清 currentNode，但保险起见在此即时取）
  if (isLayer3Run()) {
    const __l3Node = currentNode?.name || "未知节点";
    const __l3Enemy = game.enemy?.definition?.name || "未知敌人";
    getRunStats().deathNode = `第三层 · ${getCurrentRouteName()} · ${__l3Node}`;
    getRunStats().deathEnemy = __l3Enemy;
  } else if (isLayer2Run()) {
    const __l2Node = currentNode?.name || "未知节点";
    const __l2Enemy = game.enemy?.definition?.name || "未知敌人";
    getRunStats().deathNode = `第二层 · ${getCurrentRouteName()} · ${__l2Node}`;
    getRunStats().deathEnemy = __l2Enemy;
  }
  finalizeRun("dead");
}

/* 奖励页只提示牌组里已有多少张同名蛊，不再暗示不存在的局内重复蛊合练机制。 */
function countRunDeckSameKey(key) {
  if (!runState?.deckCards) return 0;
  return runState.deckCards.filter((entry) => entry.key === key).length;
}

function renderCardRewardChoices(choices = runState?.pendingRewardKeys || []) {
  if (!dom.cardRewardChoices) return;
  /* 同名数量只用于帮助玩家判断牌组冗余；局内炼蛊是材料强化单卡，不消耗重复牌。 */
  dom.cardRewardChoices.innerHTML = choices.map((key) => {
    const item = CARD_LIBRARY[key];
    if (!item) return "";
    const owned = countRunDeckSameKey(key);
    const dupHint = owned > 0
      ? `<em class="reward-card-dup" title="${escapeAttribute(`牌组里已有 ${owned} 张同名${item.name}；再次选择会再加入一张，请按牌组需要取舍。`)}">牌组已有 ×${owned}</em>`
      : "";
    return `<button class="reward-card" type="button" data-reward-card="${key}">
      ${getRewardGlyphHtml(key, item.glyph)}<strong>${item.name}</strong>
      <small>${item.typeName} · ${item.cost} 真元</small><p>${getCardEffect(key, 0)}</p>${dupHint}
    </button>`;
  }).join("");
}

function initializeCardRewardLayout() {
  /* V0.9.57（玩家「bhzy」实报「蓝色的选择残谱的页面……和蛊石坊市穿模了」）：
   * 选牌布局必须先把【所有】兄弟面板收干净，否则上一个面板会留在 resultOverlay 上叠着。
   * 此前 openLayer2Reward 尾部有一份手写的「一并藏掉」清单，但只列了休整/炼炉/材料三个，
   * 漏了蛊坊——从蛊坊进临门残卷就会两层同显。改走 hideRewardPanels 单源，
   * 它已覆盖 shopPanel/shopRemovePanel/shopCloseButton 等全部面板，今后新增面板也不会再漏。
   * 注意顺序：这里统一藏掉（含 cardRewardPanel 自己），调用方随后再 remove("hidden") 显示自己。 */
  hideRewardPanels();
  const resultCard = dom.resultOverlay?.querySelector(".result-card");
  dom.cardRewardChoices?.querySelectorAll(".is-claimed").forEach((choice) => {
    choice.classList.remove("is-claimed", "selected");
    choice.removeAttribute("data-claimed-label");
  });
  resultCard?.classList.remove("material-choice-active", "material-confirming", "reward-confirming", "furnace-choice-active", "furnace-confirming");
  resultCard?.classList.add("reward-choice-active");
  if (resultCard) resultCard.scrollTop = 0;
  if (runState) runState.pendingRewardPick = null;
  dom.cardRewardConfirm?.classList.add("hidden");
  return resultCard;
}

function openCardReward() {
  const currentNode = getCurrentRunNode();
  const resultCard = initializeCardRewardLayout();
  resultCard?.classList.remove("material-choice-active", "material-confirming");
  resultCard?.classList.add("reward-choice-active");
  runState.rewardResolved = false;
  const choices = generateCardRewardChoices(runState.heroId);
  runState.pendingRewardKeys = choices;
  dom.resultSeal.textContent = "获";
  dom.resultEyebrow.textContent = `命途图 · 第 ${getCurrentRouteStep()} 段踏破`;
  dom.resultTitle.textContent = "炼蛊收获";
  if (currentNode?.type === "elite" || currentNode?.type === "defy") {
    const __defy = currentNode?.type === "defy"; // V0.9.8.6
    const material = MATERIALS[runState.lastBattleRewards?.materialId];
    const relic = ORDINARY_RELICS[runState.lastBattleRewards?.relicId];
    dom.resultEyebrow.textContent = __defy
      ? `逆命战利品 · ${game.enemy?.definition?.name || "绝敌"}伏诛`
      : `精英战利品 · ${game.enemy?.definition?.name || "精英"}已败`;
    dom.resultDescription.textContent = `已获得 ${runState.lastBattleRewards?.stones ?? (__defy ? 24 : 16)} 蛊石${material ? `、${material.name}` : ""}${relic ? `，另有遗物「${relic.name}」待你在命途图抉择` : ""}；${__defy ? "三枚蛊卵中必有稀有，" : ""}选牌后将获得一次炼蛊机会。`;
  } else {
    // V0.9.16 丹囊：普通战掉落的消耗品在结算文案里点名，别让玩家错过
    const __droppedItem = BATTLE_ITEMS[runState.lastBattleRewards?.itemId];
    dom.resultDescription.textContent = `从三枚新生蛊卵中收纳一枚，或舍弃收获继续前行。${__droppedItem ? `丹囊另收入「${__droppedItem.name}」。` : ""}`;
  }
  renderCardRewardChoices(choices);
  updateRewardRerollButton(); // 普通战(≥2杀/未选) + 广告可用时显示「看广告重抽」，可反复观看重抽
  dom.skipRewardButton.disabled = false;
  dom.cardRewardPanel.classList.remove("hidden");
  dom.refinePanel.classList.add("hidden");
  // V0.9.57：原为手写的「一并藏掉休整/炼炉/材料」清单，因漏了蛊坊而与坊市穿模（玩家实报）。
  // 面板互斥已上移到 initializeCardRewardLayout 的 hideRewardPanels 单源，此处不再重复列举。
  dom.resultPrimaryButton.classList.add("hidden");
}

/* 普通战奖励重抽·当前是否可提供（普通战 + 已打通 ≥2 场 + 尚未选牌；不限重抽次数）。
 * "已击败 ≥2 敌"以本局胜场数(battleSummaries 中 victory 数，含当前这场)为准，与续命同口径；
 * 不用 defeatedEnemies.length——后者按敌名去重，同名敌连战会漏计。 */
function canOfferRewardRerollNow() {
  if (!runState) return false;
  const battlesWon = getRunStats().battleSummaries.filter((s) => s && s.victory).length;
  return canOfferRewardReroll({
    nodeType: getCurrentRunNode()?.type,
    enemiesDefeated: battlesWon,
    rewardResolved: runState.rewardResolved,
    rewardedAds: runState.rewardedAds,
  });
}

function getRewardedRerollCurrentContext() {
  const node = getCurrentRunNode();
  const battlesWon = runState
    ? getRunStats().battleSummaries.filter((summary) => summary && summary.victory).length
    : 0;
  return {
    run: runState,
    runStatus: runState?.status,
    node,
    nodeId: node?.id,
    nodeType: node?.type,
    enemiesDefeated: battlesWon,
    rewardResolved: runState?.rewardResolved,
    rewardKeys: runState?.pendingRewardKeys,
    pendingPick: runState?.pendingRewardPick ?? null,
    panel: dom.cardRewardPanel,
    overlay: dom.resultOverlay,
    rewardPanelVisible: Boolean(dom.cardRewardPanel && !dom.cardRewardPanel.classList.contains("hidden")),
    resultVisible: Boolean(dom.resultOverlay && !dom.resultOverlay.classList.contains("hidden")),
  };
}

/* AD-2：按可提供性 + 广告可用性显隐「看广告重抽」按钮，并复位其忙碌态。 */
function updateRewardRerollButton() {
  if (!dom.rewardRerollButton) return;
  const show = canOfferRewardRerollNow()
    && typeof NmgAds !== "undefined" && NmgAds.isRewardedAvailable() && NmgAds.isSessionEligible();
  dom.rewardRerollButton.classList.toggle("hidden", !show);
  if (show) {
    dom.rewardRerollButton.dataset.busy = "";
    dom.rewardRerollButton.removeAttribute("aria-busy");
    dom.rewardRerollButton.removeAttribute("disabled");
    const lbl = dom.rewardRerollButton.querySelector("strong");
    if (lbl) lbl.textContent = "看广告 · 重抽三枚蛊卵";
  }
}

/* 完整观看后重抽三选一牌面。必须还是点击时同一 run/node/牌面快照/奖励 panel；
 * 只换 pendingRewardKeys，蛊石、材料、残核、丹囊等 lastBattleRewards 一律不动。 */
function resolveRewardRerollWatched(context) {
  if (!isRewardedRerollContextCurrent(context, getRewardedRerollCurrentContext())) {
    updateRewardRerollButton();
    return false;
  }
  const otherLoot = runState.lastBattleRewards;
  const choices = generateCardRewardChoices(runState.heroId);
  resolveRewardReroll({ otherLoot });
  runState.pendingRewardKeys = choices;
  runState.pendingRewardPick = null;
  dom.cardRewardConfirm?.classList.add("hidden");
  renderCardRewardChoices(choices);
  addLogToChannel("journey", "看广告重抽：三枚蛊卵已重新凝形，蛊石与丹囊照旧。", "positive-log");
  updateRewardRerollButton(); // 复位忙碌并保持入口可见，可继续自愿重抽
  return true;
}

function takeUniqueRandom(pool, used, channel = "reward") {
  const available = pool.filter((key) => !used.has(key));
  if (!available.length) return null;
  return pickWithRunRandom(available, channel);
}

function generateCardRewardChoices(heroId) {
  const exclusivePool = HERO_EXCLUSIVE_CARD_KEYS[heroId] || [];
  const commonPool = [...STANDARD_REWARD_CARD_KEYS, ...exclusivePool];
  const rarePool = [...ADVANCED_CARD_KEYS, ...V08_COMMON_CARD_KEYS];
  // V0.9.8.3：血道续航补强——血道英雄局内奖励池对回血/续航牌加权（returnLife×3、bloodThirst×1），缓解纯自损循环（仅加权出现率，不新增卡）。
  if (heroId === "blood") rarePool.push("returnLife", "returnLife", "bloodThirst");
  const choices = [];
  const used = new Set();
  // V0.9.8.5b：非血道英雄从奖励池剔除 returnLife（需血煞、对其废牌），避免选牌页出现用不了的牌。
  if (heroId !== "blood") {
    for (let i = commonPool.length - 1; i >= 0; i--) if (commonPool[i] === "returnLife") commonPool.splice(i, 1);
    for (let i = rarePool.length - 1; i >= 0; i--) if (rarePool[i] === "returnLife") rarePool.splice(i, 1);
  }

  // V0.9.8.6 逆命节点：选牌保底一张稀有（搏命厚赏）
  if (getCurrentRunNode()?.type === "defy") {
    const defyRare = takeUniqueRandom(rarePool, used, "reward");
    if (defyRare) { choices.push(defyRare); used.add(defyRare); }
  }

  // V0.9.51 识蛊契：保底一张万蛊录未永久收录的蛊。用 loadDiscoveredGu（局外永久集合），
  // 不用 getDiscoveredGuKeys——后者并入本局牌组，会把"刚拿到但未录"误判为已录。
  if (typeof isContractGuSeekerActive === "function" && isContractGuSeekerActive(runState) && typeof loadDiscoveredGu === "function") {
    const __permDiscovered = loadDiscoveredGu();
    const __unseenPool = [...rarePool, ...commonPool].filter((k) => !used.has(k) && !__permDiscovered.has(k));
    const __unseenPick = takeUniqueRandom(__unseenPool, used, "reward");
    if (__unseenPick) {
      choices.push(__unseenPick);
      used.add(__unseenPick);
      getRunStats().contractGuSeekerOffers = safeStatNumber(getRunStats().contractGuSeekerOffers) + 1;
    }
  }

  // V0.9.51 逆命契：逆命节点奖励再多一个选项。
  let rewardTarget = 3;
  if (getCurrentRunNode()?.type === "defy" && typeof getContractDefyExtraChoices === "function") {
    const __defyExtra = getContractDefyExtraChoices(runState);
    if (__defyExtra > 0) {
      rewardTarget += __defyExtra;
      getRunStats().contractDefyExtraRewards = safeStatNumber(getRunStats().contractDefyExtraRewards) + 1;
    }
  }

  while (choices.length < rewardTarget) {
    const preferRare = getRunRandom("reward") < (0.3 + (getModeTuning().rareBoost || 0)) * ((runState?.mode === "tian" && (runState.tianTier || 0) >= 7) ? 0.5 : 1); // V0.9.8.3 精英提升稀有率；V0.9.19 七重天妒：稀有出率减半
    let key = preferRare
      ? takeUniqueRandom(rarePool, used, "reward")
      : takeUniqueRandom(commonPool, used, "reward");
    if (!key) key = takeUniqueRandom(preferRare ? commonPool : rarePool, used, "reward");
    if (!key) break;
    choices.push(key);
    used.add(key);
  }

  return choices;
}

// V0.9.36 B-5a: refining material reward helpers moved to nmg-refining.js.
function resolveCardReward(cardKey = null) {
  if (!runState || runState.rewardResolved) return;
  if (cardKey && !runState.pendingRewardKeys.includes(cardKey)) return;
  runState.rewardResolved = true;
  dom.resultOverlay?.querySelector(".result-card")?.classList.remove("reward-choice-active", "reward-confirming");
  runState.pendingRewardPick = null; // V0.9.31 收尾两段式：确认/舍弃都收起确认条
  dom.cardRewardConfirm?.classList.add("hidden");
  if (cardKey) {
    addRunDeckCard(cardKey);
    const claimedChoice = dom.cardRewardChoices.querySelector(`[data-reward-card="${cardKey}"]`);
    if (claimedChoice) {
      claimedChoice.classList.remove("selected");
      claimedChoice.dataset.claimedLabel = "已收录";
      claimedChoice.classList.add("is-claimed");
    }
    addLog(`炼蛊收获：${CARD_LIBRARY[cardKey].name}已加入蛊匣。`, "positive-log");
  } else {
    addLog("你舍弃了本层炼蛊收获。", "system-log");
  }
  dom.cardRewardChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.skipRewardButton.disabled = true;
  const currentNode = getCurrentRunNode();
  if (isLayer3Run() && currentNode?.type === "reward") {
    window.setTimeout(() => { dom.resultOverlay.classList.add("hidden"); refreshModalLock(); layer3CompleteNodeAndReturnMap(); }, 220);
  } else if (isLayer2Run() && currentNode?.type === "reward") {
    window.setTimeout(() => { dom.resultOverlay.classList.add("hidden"); refreshModalLock(); layer2CompleteNodeAndReturnMap(); }, 220);
  } else if (currentNode?.type === "elite" || currentNode?.type === "defy") {
    window.setTimeout(openFurnace, 420); // 确认金印留出可读时间，再开炉
  } else {
    window.setTimeout(openMaterialReward, 420);
  }
}
// ===== V0.9.31 卡牌/材料奖励两段式：选中先高亮不落袋，确认才生效、可重选，防误触。回退只限确认前重选，不做跨界面回退。=====
function selectCardRewardCandidate(cardKey) {
  if (!runState || runState.rewardResolved) return;
  if (!runState.pendingRewardKeys?.includes(cardKey)) return;
  runState.pendingRewardPick = cardKey;
  dom.resultOverlay?.querySelector(".result-card")?.classList.add("reward-confirming");
  dom.cardRewardChoices?.querySelectorAll("[data-reward-card]").forEach((b) => b.classList.toggle("selected", b.dataset.rewardCard === cardKey));
  if (dom.cardRewardConfirm) dom.cardRewardConfirm.classList.remove("hidden");
  if (dom.cardRewardConfirmText) dom.cardRewardConfirmText.textContent = `收纳「${CARD_LIBRARY[cardKey]?.name || cardKey}」入蛊匣？`;
  try { playUiSfx(); } catch (e) { /* 忽略 */ }
}
function confirmCardReward() {
  if (!runState || runState.rewardResolved || !runState.pendingRewardPick) return;
  const pick = runState.pendingRewardPick;
  runState.pendingRewardPick = null;
  dom.cardRewardConfirm?.classList.add("hidden");
  resolveCardReward(pick);
}
function resetCardRewardSelection() {
  if (runState) runState.pendingRewardPick = null;
  dom.resultOverlay?.querySelector(".result-card")?.classList.remove("reward-confirming");
  dom.cardRewardConfirm?.classList.add("hidden");
  dom.cardRewardChoices?.querySelectorAll(".selected").forEach((b) => b.classList.remove("selected"));
  try { playUiSfx(); } catch (e) { /* 忽略 */ }
}
// V0.9.36 B-5a: material confirmation, refining choices, and upgradeable deck lookup moved to nmg-refining.js.
function renderDeckEntryCard(entry, { button = false, action = "", selected = false } = {}) {
  const level = getUpgradeLevel(entry);
  const tag = button ? "button" : "article";
  const buttonAttrs = button ? ` type="button" ${action ? `${action}="${entry.instanceId}"` : ""}` : "";
  const upgradedClass = level > 0 ? `upgraded upgrade-${level}` : "";
  const badge = getPrimaryDeckBadge(entry);
  const badgeKeyword = badge.text === "异变" ? "异变" : badge.text === "受损" || badge.text === "偏斜" ? "反噬" : "炼化";
  return `<${tag} class="deck-list-card ${upgradedClass} ${entry.mutated ? "is-mutated" : ""} ${entry.damaged ? "is-damaged" : ""} ${entry.skewed ? "is-skewed" : ""} ${selected ? "selected" : ""}"${buttonAttrs}>
    <div class="deck-card-head">
      <strong class="deck-card-name">${getCompactCardTitle(entry)}</strong>
      <span class="deck-primary-badge ${badge.className}"${keywordAttr(badgeKeyword)}>${badge.text}</span>
    </div>
    ${renderCompactDeckMeta(entry)}
    <p class="deck-card-effect">${button ? withChinesePeriod(getCardEffectForEntry(entry)) : wrapKeywords(withChinesePeriod(getCardEffectForEntry(entry)))}</p>
  </${tag}>`;
}

// V0.9.36 B-5a: furnace card/material rendering and result copy moved to nmg-refining.js.
// V0.9.36 B-5b: relic inventory rendering moved to nmg-relics.js.

// V0.9.36 B-5a: furnace stable/mutation/backlash resolution and flow moved to nmg-refining.js.
function showNextFloorButton() {
  dom.resultPrimaryButton.textContent = "返回命途图";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultPrimaryButton.focus();
}

function advanceToNextFloor() {
  const currentNode = getCurrentRunNode();
  if (isEndlessRun()) {
    if (currentNode?.type === "battle" && (!runState.rewardResolved || !runState.materialRewardResolved)) return;
    if ((currentNode?.type === "elite" || currentNode?.type === "defy")
      && (!runState.rewardResolved || !runState.furnaceResolved)) return;
    completeEndlessNodeAndReturnMap();
    return;
  }
  if (!runState?.rewardResolved) return;
  if (currentNode?.type === "battle" && !runState.materialRewardResolved) return;
  if ((currentNode?.type === "elite" || currentNode?.type === "defy") && !runState.furnaceResolved) return; // V0.9.8.6 逆命也须等炼炉结算
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  if (isLayer3Run()) { layer3CompleteNodeAndReturnMap(); return; }
  if (isLayer2Run()) { layer2CompleteNodeAndReturnMap(); return; }
  completeCurrentNodeAndReturnMap();
}

// V0.9.36 B-5a: run mutation/backlash markers moved to nmg-refining.js.
function getConclusionSubtitle() {
  const lines = [];
  lines.push(runState.eliteDefeated ? "你踏碎凶煞，命途更深。" : "你避开凶险，稳步登塔。");
  if (hasRunMutation()) lines.push("蛊性异变，命途已偏。");
  if (hasRunBacklash()) lines.push("炉火曾逆，仍未断途。");
  return lines.join(" ");
}

function getKeyCardSummary() {
  const scored = (runState?.deckCards || []).map((entry) => {
    const definition = CARD_LIBRARY[entry.key] || {};
    let score = getUpgradeLevel(entry) * 3 + (entry.mutated ? 5 : 0) + (entry.damageBonus || 0);
    if (definition.category === "attack") score += 2;
    if (entry.skewed || entry.damaged) score -= 1;
    return { entry, score };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0]?.entry;
  if (!best) return "尚无关键蛊牌";
  const status = getEntryStatusLabels(best);
  const level = getUpgradeLevel(best);
  const suffix = status.length ? `【${status.join("·")}】` : "";
  return `${getDisplayCardName(best.key, level)}${suffix}`;
}

// V0.9.36 B-5a: highest refining summary moved to nmg-refining.js.
// V0.9.36 B-5b: ordinary relic summary moved to nmg-relics.js.

function getCardStatsArray() {
  return Object.values(getRunStats().cardStats || {});
}

function getTopCardStat(metric) {
  return getCardStatsArray()
    .filter((item) => safeStatNumber(item[metric]) > 0)
    .sort((a, b) => safeStatNumber(b[metric]) - safeStatNumber(a[metric]))[0] || null;
}

function formatTopCardStat(metric, unit = "") {
  const item = getTopCardStat(metric);
  if (!item) return "尚无记录";
  return `${item.name}（${safeStatNumber(item[metric])}${unit}）`;
}

function getRouteSummaryText() {
  const routeNames = [...(runState?.routeHistory || [])];
  const currentNode = getCurrentRunNode();
  if (currentNode && !routeNames.includes(currentNode.name)) routeNames.push(currentNode.name);
  return routeNames.length ? routeNames.join(" → ") : "尚未踏入分岔";
}

function getRouteNodeByStep(step) {
  if (!runState) return null;
  const nodes = getAllMapNodes();
  const currentNode = getCurrentRunNode();
  if (currentNode?.step === step) return currentNode;
  return nodes.find((node) => node.step === step && runState.completedNodes.includes(node.id)) || null;
}

function getThirdStepChoiceSummary() {
  const node = getRouteNodeByStep(getRestRouteStep());
  if (!node) return "尚未抵达";
  if (node.type === "rest") return `休整节点：${node.name}`;
  if (node.type === "battle") return `凶兽节点：${node.name}`;
  return node.name || "无";
}

function getRestResultSummary() {
  if (!runState?.restHistory?.length) return "无";
  return runState.restHistory[runState.restHistory.length - 1] || "无";
}

function getRunEvaluation(outcome = runState?.status) {
  const stats = getRunStats();
  const normalized = normalizeRunOutcome(outcome);
  if (normalized === "dead") return "残灯未灭，蛊路可再行。";
  if (normalized === "withdrawn") return "阶段收手，所得已随身带出。";
  if (normalized !== "cleared") return "此局命途已止。";
  const currentHp = Number(runState?.currentHp) || 0;
  const maxHp = Math.max(1, Number(runState?.maxHp) || 1);
  const hpRatio = currentHp / maxHp;
  if (hpRatio <= 0.2) {
    return stats.bloodBonusDamage > 0 ? "以血换刃，险死还生。" : "血尽命悬，终破尸盘。";
  }
  if (stats.bloodBonusDamage >= Math.max(stats.poisonDamage, stats.playerDamage * 0.25) && stats.bloodBonusDamage > 0 && hpRatio <= 0.45) {
    return "血煞盈刃，命悬一线。";
  }
  if (stats.poisonDamage >= Math.max(stats.bloodBonusDamage, stats.playerDamage * 0.35) && stats.poisonDamage > 0) {
    return "毒雾缠身，敌未近而命已蚀。";
  }
  if (stats.fateTriggers >= 3) return "命势回环，出牌如织。";
  if (stats.backlashes > 0) return "炉火曾逆，仍未断途。";
  if (hpRatio >= 0.55 && stats.armorGained >= Math.max(30, stats.enemyDamage)) return "步步稳行，命途已破。";
  return "尸盘已破，命途未尽。";
}

// ===== V0.9.7 结算反馈：死亡上下文快照 + 5 个纯派生函数（不持久化，全 || 兜底） =====
// 死亡上下文快照：在 finishBattle(false) 调用，拿不到全部 unknown
function snapshotDeathContext() {
  const rs = (typeof runState !== "undefined" && runState) ? runState : {};
  const en = (typeof game !== "undefined" && game && game.enemy) ? game.enemy : null;
  const def = en && en.definition ? en.definition : {};
  const pl = (typeof game !== "undefined" && game && game.player) ? game.player : {};
  const maxHp = Math.max(1, Number(rs.maxHp) || 1);
  const curHp = Number(rs.currentHp) || 0;
  const enemyActionHasFlag = (flag) => {
    const acts = def && def.actions;
    if (!acts) return false;
    try { return Object.values(acts).some((a) => a && a[flag]); } catch (e) { return false; }
  };
  return {
    source: (typeof game !== "undefined" && game && game.lastHurtSource) ? game.lastHurtSource : "unknown",
    enemyName: def.name || "未知敌人",
    isBoss: !!def.isBoss,
    isElite: !!def.isElite,
    armorWas0: (Number(pl.armor) || 0) === 0,
    lowHp: (curHp / maxHp) <= 0.3,
    playerPoison: Number(pl.poison) || 0,
    enemyLifesteal: enemyActionHasFlag("lifesteal"),
    enemySwallow: !!(def.poisonSwallow || def.poisonConvert),
    enemyEnrage: !!def.enrage,
    // V0.9.12.1 死因修复：蓄力兑现时 chargedBonus 已被清零，补读 lastHitWasCharged（致命一击是否蓄力重击）。
    enemyCharge: (typeof game !== "undefined" && game && (game.lastHitWasCharged || (game.enemy && (Number(game.enemy.chargedBonus) || 0) > 0))),
    enemyPhase2: !!(en && (en.phase2 || en.phase2Triggered)) || !!((typeof getRunStats === "function") && getRunStats().bossPhase2Triggered),
    enemyChargeInterrupt: Number((typeof game !== "undefined" && game && (game.enemy && game.enemy.currentInterruptThreshold || game.lastHitInterruptThreshold)) || 0) || 0,
    enemySwarm: !!(def.hasSwarmMechanic || (def.def && def.def.hasSwarmMechanic)),
    swarmStack: Number((typeof game !== "undefined" && game && game.enemy && game.enemy.swarmStack) || 0) || 0,
    enemyCounter: !!(def.hasCounterAttack || (def.def && def.def.hasCounterAttack)),
    counterArmed: !!((typeof game !== "undefined" && game && game.enemy && game.enemy.counterArmed)),
    enemyBoneArmor: Number(def.boneArmorBonus || (def.def && def.def.boneArmorBonus) || 0) || 0,
    // 正式母盘战死时记录当前看穿行为与阶段。
    mupanWatchedHabit: (typeof isMupanBattle === "function" && isMupanBattle() && game.mupan.core.watchedHabitId) || "",
    mupanPhase: (typeof isMupanBattle === "function" && isMupanBattle() && Number(game.mupan.core.phase)) || 0,
    layer: getCurrentActLayer(rs),
    route: getCurrentActLayer(rs) > 1 ? getCurrentRouteName(rs) : "",
    floor: getCurrentRouteStep(rs),
    nodeType: getCurrentRunNode(rs)?.type || "",
  };
}

// 1) 本局称号：14 称号优先级命中即返回（已修：地点/逆命未成 置于深泽初探之前、删冗余与不可达分支）
function generateRunTitle(stats, runState, outcome = runState?.status) {
  const s = stats || {};
  const rs = runState || {};
  const normalized = normalizeRunOutcome(outcome);
  const cleared = normalized === "cleared";
  const withdrawn = normalized === "withdrawn";
  const dead = normalized === "dead";
  const l2 = rs.layer2 || {};
  const dc = (rs.runStats && rs.runStats.deathContext) || s.deathContext || {};
  const route = String(s.layer2Route || dc.route || "");
  const deathEnemy = String(s.deathEnemy || dc.enemyName || "");
  const l2BossDefeated = !!(s.layer2BossDefeated || l2.bossDefeated);
  const l2Entered = !!s.layer2Entered;
  const poison = Number(s.poisonDamage) || 0;
  const blood = Number(s.bloodBonusDamage) || 0;
  const armor = Number(s.armorGained) || 0;
  const floor = getCurrentRouteStep(rs);
  // V0.9.14 蛊修印录：称号文案收口进 TITLE_CATALOG（单一事实源），此处只按 id 取词条。
  const wrap = (id) => { const t = TITLE_CATALOG_MAP[id] || TITLE_CATALOG_MAP.wanderer; return { id: TITLE_CATALOG_MAP[id] ? id : "wanderer", title: t.title, sub: t.sub }; };
  // V0.9.9 子批6：死劫通关称号优先于一切——九死无生者得金印。
  if (cleared && rs.mode === "deathtrial") return wrap("deathtrialClear");
  const l3 = rs.layer3 || {};
  const l3Route = String(s.layer3Route || (getCurrentActLayer(rs) === 3 ? getCurrentRouteName(rs) : ""));
  const l3Theme = getCurrentActLayer(rs) === 3 ? getCurrentRouteId(rs) : "";
  const l3BossDefeated = !!(s.layer3BossDefeated || l3.bossDefeated);
  const l3Entered = !!s.layer3Entered;
  const deathNode = String(s.deathNode || "");
  const inLayer3Death = dead && (l3Entered || deathNode.indexOf("第三层") >= 0);
  const isBoneRoute = l3Theme === "bone" || l3Route.indexOf("骨塔") >= 0 || deathNode.indexOf("骨塔") >= 0;
  const isBeehiveRoute = l3Theme === "beehive" || l3Route.indexOf("蜂窟") >= 0 || deathNode.indexOf("蜂窟") >= 0;
  // ⓪ 三层通关（通关第三层 Boss）——最高优先级，勿被二层通关遮蔽
  if (cleared && l3BossDefeated) return wrap("layer3Clear");
  // ⓪ 败于三层 Boss 留名
  if (dead && deathEnemy.indexOf("骨巢守墓王") >= 0) return wrap("boneBossFall");
  if (dead && deathEnemy.indexOf("灾厄蜂后") >= 0) return wrap("queenFall");
  // ⓪ 三层路线阵亡
  if (inLayer3Death && isBoneRoute) return wrap("boneRouteFall");
  if (inLayer3Death && isBeehiveRoute) return wrap("beehiveRouteFall");
  // ① 通关二层
  if ((withdrawn || cleared) && l2BossDefeated) return wrap("layer2Clear");
  // ② 败于二层 Boss 留名
  if (dead && deathEnemy.indexOf("百瘴母蛊") >= 0) return wrap("miasmaBossFall");
  if (dead && deathEnemy.indexOf("血衣蛊母") >= 0) return wrap("bloodBossFall");
  // ③ 击败一层 Boss 未进二层（通关收束）
  if (withdrawn && !l2Entered) return wrap("layer1Clear");
  // ④ 死亡地点（瘴/血）——置于「深泽初探」之前，确保专属称号可达
  if (dead && route.indexOf("瘴") >= 0) return wrap("miasmaFall");
  if (dead && (route.indexOf("血沼") >= 0 || route.indexOf("血") >= 0)) return wrap("bloodmarshFall");
  // ⑤ 进二层未破二层 Boss 而死（无明确路线染色时的兜底）
  if (l2Entered && !l2BossDefeated && dead) return wrap("layer2Unfinished");
  // ⑥ 进二层但 stats 标记入二层、route 缺失的更弱兜底
  if (l2Entered && dead) return wrap("layer2Explore");
  // ⑦ 流派
  if (poison > 0 && poison >= blood && poison >= armor) return wrap("poisonStyle");
  if (blood > 0 && blood >= poison && blood >= armor) return wrap("bloodStyle");
  if (armor > 0 && armor >= poison && armor >= blood) return wrap("armorStyle");
  // ⑧ 一层前/中后期死亡：阈值走 ROUTE_STAGE_CONFIG，后续扩展路线时只改配置。
  const routeBand = getRoutePhaseBand(floor);
  if (dead && routeBand === "early") return wrap("earlyFall");
  if (dead && routeBand === "middle") return wrap("midFall");
  if (dead && routeBand === "late") return wrap("lateFall");
  // 兜底
  return wrap("wanderer");
}

// 2) 死因分析（仅失败用）
function analyzeDeathCause(stats, runState) {
  const s = stats || {};
  const rs = runState || {};
  const dc = (rs.runStats && rs.runStats.deathContext) || s.deathContext || {};
  const route = String(dc.route || getCurrentRouteName(rs) || "");
  const lastBattle = (s.battleSummaries && s.battleSummaries.length) ? s.battleSummaries[s.battleSummaries.length - 1] : null;
  const lastHurt = (lastBattle && Number(lastBattle.enemyDamage)) || 0;
  const detail = `末战承伤 ${lastHurt}、累计护甲 ${Number(s.armorGained) || 0}、累计承伤 ${Number(s.enemyDamage) || 0}`;
  const make = (cause, reason) => ({ cause: cause || "资源耗尽", reason: reason || "主要死因：资源耗尽，未能撑过敌方攻势。", detail });
  const enemyName = String(dc.enemyName || s.deathEnemy || "");
  const totalTurns = Number(s.totalTurns) || 0;
  // V0.9.9 寿道·子批2b：寿尽优先于一切——焚寿燃命透支寿元而陨。
  if (dc.source === "lifespanExhausted") return make("寿元焚尽", "主要死因：焚寿燃命透支寿元，寿尽命熄。焚命换威需留足寿元退路。");
  // 三层·蜂后半血蜂群暴动节奏失控（优先于通用 Boss 相位强化）
  if (dc.isBoss && dc.enemyPhase2 && (enemyName.indexOf("灾厄蜂后") >= 0 || dc.enemySwarm)) return make("蜂群暴动失控", "灾厄蜂后半血触发蜂群暴动，蜂群层数滚雪般叠加，节奏一旦失控便难以收场。");
  // 三层·未打断骨塔蓄力重击
  if (dc.enemyCharge && dc.source === "enemyAttack" && (dc.enemyChargeInterrupt > 0 || enemyName.indexOf("骨巢守墓王") >= 0 || enemyName.indexOf("朽甲蛊兵") >= 0)) return make("未打断骨塔蓄力", "骨塔敌人蓄力重击未被打断，承受了完整一击；蓄力可在受够阈值伤害后打断。");
  // 三层·骨甲过高输出突不破
  if (dc.enemyBoneArmor > 0 && totalTurns >= 8 && dc.source === "enemyAttack") return make("骨甲僵持过久", "骨甲蛊卫有甲愈凶，护甲未破时输出难以突破，僵持过久被反噬拖垮。");
  // 三层·蜂群抢攻频繁护甲不足
  if (dc.enemyCounter && (dc.counterArmed || dc.armorWas0) && dc.source === "enemyAttack") return make("抢攻反噬护甲不足", "蜂窟敌人会因你单回合出牌过密而抢攻反噬，护甲不足时被额外重击击穿。");
  // Boss 相位强化
  if (dc.isBoss && dc.enemyPhase2) return make("Boss 相位强化", "第二层 Boss 相位强化后伤害过高，未能在转相前终结。");
  // 瘴林吞毒
  if (dc.enemySwallow && route.indexOf("瘴") >= 0) return make("瘴林反毒压制", "瘴林敌人的抗毒、转毒或吞毒拖慢了毒道节奏。");
  // 血沼吸血
  if (dc.enemyLifesteal && route.indexOf("血") >= 0) return make("血沼吸血拖战", "血沼敌人吸血拖长战斗，资源逐渐被耗尽。");
  // 中毒毒发
  // V0.9.12.1：兜底子句排除 selfCard——自损致死时若身上带毒，此前会被抢报为「中毒毒发」。
  if (dc.source === "poisonTick" || ((Number(dc.playerPoison) || 0) > 0 && dc.source !== "enemyAttack" && dc.source !== "selfCard")) return make("中毒毒发", "中毒层数过高，回合结束时毒发身亡。");
  // 自损透支
  if (dc.source === "selfCard") return make("自损透支", "自损过度，未能及时止血。");
  // 护甲不足
  if (dc.armorWas0 && dc.source === "enemyAttack") return make("护甲不足", "主要死因：护甲不足，被攻势直接击穿。");
  // 低血连击
  if (dc.lowHp && dc.source === "enemyAttack") return make("低血连击", "残血状态下被连击收割，未能稳住生命。");
  // 未打断蓄力
  if (dc.enemyCharge && dc.source === "enemyAttack") return make("未打断蓄力", "未及时打断敌人蓄力重击，承受了完整一击。");
  // 兜底
  return make("资源耗尽", "主要死因：资源耗尽，未能撑过敌方攻势。");
}

// 3) 通关评语（仅通关用）
function getRunCommentary(stats, runState) {
  const s = stats || {};
  const rs = runState || {};
  const l2 = rs.layer2 || {};
  const l2BossDefeated = !!(s.layer2BossDefeated || l2.bossDefeated);
  const l2Entered = !!s.layer2Entered;
  const poison = Number(s.poisonDamage) || 0;
  const blood = Number(s.bloodBonusDamage) || 0;
  const armor = Number(s.armorGained) || 0;
  if (l2BossDefeated) return "你越过尸盘，又踏破深泽。瘴林与血沼皆未能留住你的命数。";
  if (poison > 0 && poison >= blood && poison >= armor) return "你以毒铺路，令敌命从内而溃。此局毒势已成。";
  if (blood > 0 && blood >= poison && blood >= armor) return "你以己血换敌命，灯残而刃未钝。";
  if (armor > 0 && armor >= poison && armor >= blood) return "壳厚如山，敌势难侵。此局胜在稳守。";
  if (!l2Entered) return "尸盘已碎，你选择就此收束命途。此行虽止，蛊息未绝。";
  return "尸盘已破，命途未尽。你已走到许多人未及之处。";
}

// 4) 流派倾向（权重折算）
function inferFactionTendency(stats) {
  const s = stats || {};
  const poison = Math.max(0, Number(s.poisonDamage) || 0);
  const blood = Math.max(0, Number(s.bloodBonusDamage) || 0);
  const armor = Math.max(0, Number(s.armorGained) || 0) * 0.6;
  const fate = Math.max(0, Number(s.fateTriggers) || 0) * 12;
  const cardsPlayed = Number(s.cardsPlayed) || 0;
  const total = poison + blood + armor + fate;
  if (cardsPlayed < 3 || total <= 0) {
    return { primary: "流派未明", secondary: "", percentages: { 毒道: 0, 血道: 0, 护甲: 0, 命势: 0 }, fallback: "流派未明·数据不足" };
  }
  const pct = (v) => Math.round((v / total) * 100);
  const percentages = { 毒道: pct(poison), 血道: pct(blood), 护甲: pct(armor), 命势: pct(fate) };
  const ranked = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
  const primary = ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : "流派未明";
  const secondary = ranked[1] && ranked[1][1] > 0 ? ranked[1][0] : "";
  return { primary, secondary, percentages, fallback: "" };
}

// 5) 下一步建议
function getNextStepHint(stats, runState, outcome, cause, faction) {
  const s = stats || {};
  const rs = runState || {};
  const deckCount = (rs.deckCards && rs.deckCards.length) || 0;
  const c = String(cause || "");
  const normalized = normalizeRunOutcome(outcome);
  if (normalized === "cleared") {
    return "建议：尝试不同构筑、难度或十重天，继续验证完整命途。";
  }
  if (normalized === "withdrawn") {
    const l2 = rs.layer2 || {};
    if (!s.layer2Entered) return "建议：尝试踏入第二层，挑战瘴林或血沼路线。";
    if (s.layer2Route && s.layer2Route.indexOf("瘴") >= 0) return "建议：尝试另一条第二层路线——血沼沉渊。";
    if (s.layer2Route && s.layer2Route.indexOf("血") >= 0) return "建议：尝试另一条第二层路线——瘴林深径。";
    return "建议：尝试不同构筑，或查看万蛊录新增条目。";
  }
  if (normalized !== "dead") return "建议：重新选择蛊修与路线，再入命途塔。";
  if (c.indexOf("瘴林反毒") >= 0) return "建议：用连续蚀毒逐步破抗；吞毒亮起时可继续堆过阈值，余毒仍会结算。";
  if (c.indexOf("血沼吸血") >= 0) return "建议：血沼敌人会吸血，拖久压力会变大，需提高爆发。";
  if (c.indexOf("护甲不足") >= 0) return "建议：下次多保留防御牌，应对精英与 Boss 的蓄力。";
  if (c.indexOf("未打断蓄力") >= 0) return "建议：敌人蓄力时优先叠护甲或打断，避免吃满重击。";
  if (c.indexOf("中毒") >= 0) return "建议：注意自身中毒层数，及时清毒或补足回复。";
  if (c.indexOf("自损") >= 0) return "建议：血道自损构筑需搭配稳定回复，避免透支。";
  if (c.indexOf("Boss 相位") >= 0) return "建议：进入第二层 Boss 前尽量补足回复与护甲。";
  if (deckCount >= 22) return "建议：卡组过厚会降低核心牌出现率，适当精简。";
  return "建议：进入第二层前尽量补足回复或护甲。";
}


function getBattleStatsLines() {
  const battles = getRunStats().battleSummaries || [];
  if (!battles.length) return ["尚无铭刻"];
  return battles.map((battle, index) => {
    const result = battle.victory ? "胜" : "败";
    return `${index + 1}. ${battle.enemyName}（${result}）：${battle.turns} 回合，造成 ${battle.playerDamage}，承伤 ${battle.enemyDamage}`;
  });
}

function renderStatsList(items) {
  if (!items.length) return '<p>尚无铭刻。</p>';
  return `<ul class="stats-list">${items.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join("")}</ul>`;
}

function renderCardRanking(metric, unit = "", limit = 5) {
  const cards = getCardStatsArray()
    .filter((item) => safeStatNumber(item[metric]) > 0)
    .sort((a, b) => safeStatNumber(b[metric]) - safeStatNumber(a[metric]))
    .slice(0, limit);
  if (!cards.length) return "<p>尚无铭刻。</p>";
  return `<ul class="stats-list">${cards.map((item, index) => (
    `<li><span>${index + 1}. ${item.name}</span><strong>${safeStatNumber(item[metric])}${unit}</strong></li>`
  )).join("")}</ul>`;
}

/* 玩家态统计面板仍按 V0.9.51 定调保持移除；开发反馈复制保留一份精简、可复现的本局摘要。 */
function getRunStatsCopyText(outcome = runState?.status) {
  if (!runState) return "《逆命蛊途》本局反馈\n尚无本局数据";
  const normalized = normalizeRunOutcome(outcome) || "running";
  const stats = getRunStats();
  return [
    "《逆命蛊途》本局反馈",
    `版本：${GAME_VERSION}`,
    `结算结果：${getRunOutcomeLabel(normalized)}`,
    `角色：${HEROES[runState.heroId]?.name || "未知蛊修"}`,
    `本命路线：${getBenmingPathDisplayName(runState)}`,
    `命途种子：${runState.trialSeed || "无"}`,
    `骨鸣获得 / 主动碎甲：${stats.boneResonanceGained || 0} / ${stats.boneArmorSacrificed || 0}`,
    `叩铃总计 / 镇魂 / 断命：${stats.boneChimeUses || 0} / ${stats.boneSoulUses || 0} / ${stats.boneFateUses || 0}`,
    `生态克制次数 / 增伤 / 蚀甲：${stats.ecologyCounterTriggers || 0} / ${stats.ecologyCounterDamage || 0} / ${stats.ecologyCounterArmorRemoved || 0}`,
    `总回合：${stats.totalTurns || 0}`,
    `剩余生命：${runState.currentHp || 0} / ${runState.maxHp || 0}`,
    "提示：若复现问题，请附截图或录屏。",
  ].join("\n");
}

function applyRunOutcomeProgression(outcome) {
  const policy = getRunOutcomePolicy(outcome);
  if (!policy) throw new TypeError(`无效的命途结算结果：${String(outcome)}`);
  if (policy.deathMemory) bumpSimingDeaths();
  if (!policy.clearRewards) return false;
  if (!progression.eliteUnlocked) {
    progression.eliteUnlocked = true;
    setStoredFlag(ELITE_UNLOCK_KEY, true);
    if (typeof game !== "undefined" && game) game.eliteJustUnlocked = true;
  }
  /* V0.9.55 死劫已移除：不再新授「死劫解锁」标志（老档已有的保留，只作历史金印用）。
   * 仍保留 deathtrial 通关的金印落盘——老玩家可能正打着一局死劫续局，
   * 让它打完照常拿印，而不是把人家半局作废。 */
  const deathtrialJustCleared = runState.mode === "deathtrial";
  if (deathtrialJustCleared && !progression.deathtrialCleared) {
    progression.deathtrialCleared = true;
    setStoredFlag(DEATHTRIAL_CLEARED_KEY, true);
  }
  if (runState.mode === "tian") {
    const clearedTier = clampTianTier(runState.tianTier || 1);
    const prevTier = getTianCleared(runState.heroId);
    setTianCleared(runState.heroId, clearedTier);
    if (clearedTier > prevTier && clearedTier < TIAN_MAX_TIER) {
      addLogToChannel("journey", `十重天：第 ${clearedTier} 重已破，第 ${clearedTier + 1} 重开启。`, "system-log");
    } else if (clearedTier >= TIAN_MAX_TIER) {
      addLogToChannel("journey", "十重天：第十重已破——天梯尽处，再无天命。", "system-log");
    }
  }
  markHeroSeal(runState.heroId, runState.mode || "normal");
  return true;
}

function showRunConclusion(outcome) {
  if (typeof NmgAds !== "undefined") NmgAds.preloadRewarded(); // AD-1b：进结算即预载激励视频，减少点广告时等待
  const normalized = normalizeRunOutcome(outcome);
  const policy = getRunOutcomePolicy(normalized);
  if (!policy || !policy.showConclusion || runState?.status !== normalized) throw new TypeError("结算页必须读取 runState 的明确终局结果");
  const cleared = policy.clearRewards;
  if (cleared) triggerHeroVoice("ending");
  const withdrawn = normalized === "withdrawn";
  const dead = normalized === "dead";
  const deathtrialJustCleared = cleared && runState.mode === "deathtrial";
  applyRunOutcomeProgression(normalized);
  let __benmingGain = null; // FUNNEL-1 收获卡：结算页要把"没白打"摆上台面
  let __carryTaken = [];
  let __guSettlement = null;
  // 本命蛊：死亡/收手/通关都结算击敌道行；只有完整通关追加 15，主动放弃不进本段。
  {
    const benmingEarn = calculateBenmingOutcomeDaoxing(normalized, runState.defeatedEnemies.length, getModeTuning().rewardMul || 1);
    if (benmingEarn > 0) {
      const gu = BENMING_GU[runState.heroId];
      const stageBefore = getBenmingStage(runState.heroId);
      addBenmingDaoxing(runState.heroId, benmingEarn);
      const infoAfter = getBenmingStageInfo(runState.heroId);
      __benmingGain = { earn: benmingEarn, info: infoAfter, stageUp: infoAfter.stage > stageBefore };
      addLogToChannel("journey", `本命蛊：${gu?.name || "本命蛊"}食此局因果，道行 +${benmingEarn}（现 ${infoAfter.dao}，${infoAfter.stageName}${infoAfter.next ? `，距${infoAfter.next.name}还差 ${infoAfter.toNext}` : "·圆满"}）。`, "system-log");
      if (infoAfter.stage > stageBefore) {
        // 进化仪式压在结算页之上（rite z=130），点击散场后继续看结算。
        window.setTimeout(() => {
          window.AudioManager?.playSfx?.("benmingAscend", { volumeScale: 1 }); // V0.9.51 九转蜕变专属演出曲
          showRiteOverlay({
            tone: "gold", eyebrow: "本命蛊 · 蜕变", seal: gu?.glyph || "蛊",
            title: `${gu?.name || "本命蛊"} · ${infoAfter.stageName}`,
            text: `${BENMING_STAGES[infoAfter.stage].name}已成。\n${gu?.stagePassives?.[infoAfter.stage] || ""}`,
            hint: "点击任意处 · 收蛊", autoMs: 7000,
          });
        }, 650);
      }
    }
  }
  // 蛊庐：完整通关或阶段收手全额带出，陨落材料折四成且残核散逸；主动放弃不进本段。
  {
    const guluStore = getGuluStore();
    const takenParts = [];
    // AD-1b「看广告翻倍收获」：捕获本局实际入库量的快照，广告看完照此再发一遍（翻倍，纯局外奖励）。
    const harvestSnapshot = { materials: {}, cores: 0, scrip: 0, daoxing: 0, heroId: runState.heroId };
    MATERIAL_IDS.forEach((id) => {
      const have = Number(runState.materials?.[id]) || 0;
      const take = calculateRunMaterialCarryover(normalized, have);
      if (take > 0) {
        guluStore.materials[id] = (guluStore.materials[id] | 0) + take;
        takenParts.push(`${MATERIALS[id].name}×${take}`);
        harvestSnapshot.materials[id] = take;
      }
    });
    ECOLOGY_MATERIAL_IDS.forEach((id) => {
      const have = Number(runState.ecologyMaterials?.[id]) || 0;
      const take = calculateRunMaterialCarryover(normalized, have);
      if (take > 0) {
        guluStore.ecologyMaterials[id] = (guluStore.ecologyMaterials[id] | 0) + take;
        takenParts.push(`${ECOLOGY_MATERIALS[id].name}×${take}`);
      }
    });
    const cores = policy.keepBossCores ? (runState.bossCores | 0) : 0;
    if (cores > 0) { guluStore.bossCores = (guluStore.bossCores | 0) + cores; takenParts.push(`蛊母残核×${cores}`); harvestSnapshot.cores = cores; }
    if (takenParts.length) {
      guluPushEvent(guluStore, `塔中带出：${takenParts.join("、")}${dead ? "（陨落仅四成入库）" : ""}。`);
      saveGuluStore();
      addLogToChannel("journey", `蛊庐入库：${takenParts.join("、")}${dead ? "（陨落仅四成入库）" : ""}。`, "system-log");
    }
    __carryTaken = takenParts;
    const finalGuStones = Math.max(0, runState.guStones | 0);
    // V0.9.57：传入开局本金，蛊钱只按【本局净赚】折算——秒进秒撤白嫖 4 契的漏洞堵在这里。
    const scripSettlement = settleMarketScripFromRun(guluStore, finalGuStones, normalized, REWARD_BALANCE.startingGuStones);
    if (scripSettlement.gained > 0) {
      const capText = scripSettlement.capped ? "（已达本局兑换上限）" : "";
      guluPushEvent(guluStore, `离塔兑契：蛊石 ${scripSettlement.spentStones} 换得蛊钱 ${scripSettlement.gained}${capText}。`);
      addLogToChannel("journey", `百蛊市：蛊石 ${scripSettlement.spentStones} 换得蛊钱 ${scripSettlement.gained}${capText}。`, "positive-log");
      takenParts.push(`蛊钱×${scripSettlement.gained}`);
      harvestSnapshot.scrip = scripSettlement.gained;
      saveGuluStore();
    }
    harvestSnapshot.daoxing = __benmingGain ? (__benmingGain.earn || 0) : 0;
    // 供「看广告翻倍」按钮读取：只有确有可翻倍的收获时才留快照，否则清空（按钮隐藏）。
    __lastHarvestSnapshot = (Object.keys(harvestSnapshot.materials).length || harvestSnapshot.cores || harvestSnapshot.scrip || harvestSnapshot.daoxing) ? harvestSnapshot : null;
    if (dead && (runState.bossCores | 0) > 0) {
      addLogToChannel("journey", "蛊母残核随陨落散逸——只有活着走出塔，残核才是你的。", "system-log");
    }
    // 百蛊市：通关仍全数归圃；陨落时护命蛊匣只保全一只天品随行蛊，其余仍同殒。
    if (Array.isArray(runState.carriedGuIds) && runState.carriedGuIds.length) {
      const guSettlement = settleCarriedGuAfterRun(guluStore, runState.carriedGuIds, policy.keepCarriedGu);
      __guSettlement = guSettlement;
      if (guSettlement.missing?.length) {
        console.warn("[gulu] carried source missing during exact-id settlement", guSettlement.missing);
      }
      if (policy.keepCarriedGu) {
        guluPushEvent(guluStore, "随行之蛊全身而退，归圃休憩。");
        saveGuluStore();
      } else {
        if (guSettlement.wardConsumed && guSettlement.preserved.length) {
          guluPushEvent(guluStore, `护命蛊匣碎裂，道脉随行蛊「${guSettlement.preserved.join("」「")}」得以归圃。`);
          addLogToChannel("journey", `百蛊市·护命蛊匣生效：「${guSettlement.preserved.join("」「")}」免于同殒。`, "positive-log");
        }
        if (guSettlement.fallen.length) {
          guluPushEvent(guluStore, `随行之蛊「${guSettlement.fallen.join("」「")}」随你陨落塔中，未能归圃。`);
          addLogToChannel("journey", `随行之蛊「${guSettlement.fallen.join("」「")}」同殒塔中。`, "system-log");
        }
        saveGuluStore();
      }
    }
  }
  window.AudioManager?.playScene("conclusion", { duration: 600, quiet: true });
  const hero = HEROES[runState.heroId];
  const relic = RELICS[runState.relicId];
  const stats = getRunStats();
  const defeated = runState.defeatedEnemies.length ? runState.defeatedEnemies.join("、") : "尚未击败敌人";
  const routeText = getRouteSummaryText();
  const materialText = MATERIAL_IDS
    .filter((id) => (runState.materialHistory[id] || 0) > 0)
    .map((id) => `${MATERIALS[id].name}x${runState.materialHistory[id]}`)
    .join("、") || "尚未获得材料";
  const keyCard = getKeyCardSummary();
  const relicText = getOrdinaryRelicSummary();
  const deathStepText = `第 ${getCurrentRouteStep()} 段`;
  const topDamageCard = formatTopCardStat("damage", " 点");
  const topArmorCard = formatTopCardStat("armor", " 点");
  const lastBattleSummary = stats.battleSummaries[stats.battleSummaries.length - 1];
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.resultSeal.textContent = cleared ? (deathtrialJustCleared ? "劫" : "通") : (withdrawn ? "收" : "绝");
  dom.resultEyebrow.textContent = cleared
    ? (deathtrialJustCleared ? "死劫 · 九死无生" : "命途终点 · 功成")
    : (withdrawn
      ? (isEndlessRun() ? `无尽第 ${Math.max(runState.endlessDeepest || 0, runState.endlessFloor || 0)} 层 · 主动收手` : `${getCurrentActLayer() === 2 ? "第二层" : "第一层"} Boss 已破 · 主动离塔`)
      : `止步第 ${getCurrentRouteStep()} 段`);
  dom.resultTitle.textContent = cleared ? (deathtrialJustCleared ? "死劫·渡尽" : "命途塔通关") : (withdrawn ? "阶段收手" : "道途断绝");
  // V0.9.9 子批6：死劫通关→结算卡金身样式（金印仪式感）。
  const __resultCard = dom.resultOverlay?.querySelector(".result-card");
  if (__resultCard) __resultCard.classList.toggle("deathtrial-cleared", !!deathtrialJustCleared);
  // V0.9.18 塔中回声：通关时在评价后附英雄专属结局尾声（呼应"所求"，pre-line 让结局单独成段）
  if (cleared) {
    dom.resultDescription.style.whiteSpace = "pre-line";
    // 塔心角色结局完成后显示专属标题与摘要；历史终局存档仍保留通用评价兜底。
    const __towerEnding = (isMingtuTowerHeart(runState) && runState.chapterProgress?.nodeId === "tower-heart-ending") ? getTowerEnding() : null;
    dom.resultDescription.textContent = __towerEnding
      ? `《${__towerEnding.title}》——${__towerEnding.summary}\n\n${getRunEvaluation(normalized)}`
      : getRunEvaluation(normalized) + (HERO_ENDINGS[runState.heroId] ? "\n\n" + HERO_ENDINGS[runState.heroId] : "");
  } else if (withdrawn) {
    dom.resultDescription.style.whiteSpace = "";
    dom.resultDescription.textContent = isEndlessRun()
      ? `你在无尽第 ${Math.max(runState.endlessDeepest || 0, runState.endlessFloor || 0)} 层主动收手，所得资源与随行蛊已完整带出，并以本局最深层参与排行榜。`
      : `你在击败本区域 Boss 后主动收手，所得资源与随行蛊已带出。本次不算命途塔通关，也不会触发难度、天印、印记或英雄尾声。`;
  } else {
    dom.resultDescription.style.whiteSpace = "";
    dom.resultDescription.textContent = `${stats.deathEnemy || game?.enemy?.definition?.name || "未知敌人"}终结了此局命途，死于${deathStepText}。${getRunEvaluation(normalized)}`;
  }
  // === V0.9.7 结算反馈：7 分区重构（全 ||/?. 兜底，绝不 undefined/null/NaN） ===
  const __titleInfo = generateRunTitle(stats, runState, normalized);
  // V0.9.14 蛊修印录：本局称号入录（新获得的写进命途札记，引导去万蛊录看收藏）。
  if (markTitleCollected(__titleInfo.id) && typeof addJourneyLog === "function") {
    addJourneyLog(`蛊修印录：新称号「${__titleInfo.title}」已入录万蛊录。`, "positive-log");
  }
  const __faction = inferFactionTendency(stats);
  const __cause = dead ? analyzeDeathCause(stats, runState) : null;
  const __hint = getNextStepHint(stats, runState, normalized, __cause ? __cause.cause : "", __faction);
  const __l3 = runState.layer3 || {};
  const __l3Active = isLayer3Run();
  const __routeName = String((getCurrentActLayer() > 1 && getCurrentRouteName()) || (stats.deathContext && stats.deathContext.route) || "");
  const __routeClass = __routeName.indexOf("骨塔") >= 0 ? " run-sec-bone" : (__routeName.indexOf("蜂窟") >= 0 ? " run-sec-beehive" : (__routeName.indexOf("瘴") >= 0 ? " run-sec-miasma" : (__routeName.indexOf("血") >= 0 ? " run-sec-bloodmarsh" : "")));
  const __layer = getCurrentActLayer();
  const __layerText = __layer === 3
    ? `第三层 · ${getCurrentRouteName() || "绝域深径"}`
    : (__layer === 2 ? `第二层 · ${getCurrentRouteName() || "生态深径"}` : "第一层 · 命途塔");
  const __routeLine = __layer === 3
    ? `${getCurrentRouteName() || "绝域深径"} · Boss${__l3.bossDefeated ? "已破" : "未破"} · 终点「${__l3.lastNodeName || "-"}」`
    : (__layer === 2
      ? `${getCurrentRouteName() || "生态深径"} · Boss${runState.layer2?.bossDefeated ? "已破" : "未破"} · 终点「${runState.layer2?.lastNodeName || "-"}」`
      : routeText);
  const __finalNode = cleared
    ? "命途塔终点"
    : (withdrawn
      ? (__layer === 2 ? ((runState.layer2 && runState.layer2.lastNodeName) || "生态尽头") : "塔顶尸盘")
      : `${deathStepText} · ${stats.deathNode || getCurrentRunNode()?.name || "命途未明"} · ${stats.deathEnemy || "未知敌人"}`);
  const __bestiaryCount = (typeof layer2LoadBestiary === "function" ? layer2LoadBestiary().size : 0);
  const __pctBar = (label, val) => `<div class="faction-bar-row"><span>${label}</span><div class="faction-bar-track"><i style="width:${Math.max(0, Math.min(100, Number(val) || 0))}%"></i></div><em>${Math.max(0, Math.min(100, Number(val) || 0))}%</em></div>`;
  const __factionBars = __faction.fallback
    ? `<p class="faction-fallback">${__faction.fallback}</p>`
    : (__pctBar("毒道", __faction.percentages["毒道"]) + __pctBar("血道", __faction.percentages["血道"]) + __pctBar("护甲", __faction.percentages["护甲"]) + __pctBar("命势", __faction.percentages["命势"]));
  const __sec4 = cleared
    ? `<section class="run-summary-section run-sec-commentary"><h4>通关评语</h4><p class="run-sec-text">${getRunCommentary(stats, runState)}</p></section>`
    : (withdrawn
      ? `<section class="run-summary-section run-sec-commentary"><h4>阶段回顾</h4><p class="run-sec-text">${getRunCommentary(stats, runState)}</p></section>`
      // V0.9.51 结算精简：死因主文已前置到顶部「本局结果」段，折叠区只补更细的推断细节，不再整段重复。
      : `<section class="run-summary-section run-sec-deathcause"><h4>死因细节</h4><p class="run-sec-detail">${(__cause && __cause.detail) || "无更多细节。"}</p></section>`);
  // E-2c5b 本局新启残卷（终卷三连等）：仅列本局首次解锁的，重复通关不再出现
  const __newLore = Array.isArray(stats.newLorePages)
    ? stats.newLorePages.map((id) => LORE_PAGES.find((p) => p.id === id)).filter(Boolean)
    : [];
  const __activeContract = typeof getActiveContract === "function" ? getActiveContract(runState) : null;
  const __contractTriggerSummary = __activeContract && typeof getContractTriggerSummary === "function"
    ? getContractTriggerSummary(runState)
    : "";
  dom.runSummary.innerHTML = `
    ${(typeof game !== "undefined" && game && game.eliteJustUnlocked) ? `<section class="run-summary-section run-sec-elite-unlock"><h4>精英模式已解锁</h4><p class="run-sec-sub">万蛊更凶，回报更厚——返回主菜单可在「挑战模式」选择精英模式再战。</p></section>` : ""}
    ${__newLore.length ? `<section class="run-summary-section run-sec-lore-unlock"><h4>本局新启残卷</h4><p class="run-sec-sub">${__newLore.map((p) => `《${escGu(p.title)}》`).join(" · ")}——已录入万蛊录 · 命蛊残卷。</p></section>` : ""}
    ${(Array.isArray(lastContractUnlocks) && lastContractUnlocks.length) ? `<section class="run-summary-section run-sec-contract-unlock">
      <h4>司命人递契</h4>
      <p class="run-sec-text">「走完一程的人，才配看这几页账。」司命人递来${lastContractUnlocks.map((c) => `「${c.name}」`).join("与")}。</p>
      <p class="run-sec-sub">${lastContractUnlocks.map((c) => `${c.name}：${c.summary}`).join(" ")}下一局整备时，可在「挑战模式」栏择一签契——也可以不签。</p>
    </section>` : ""}
    <section class="run-summary-section run-sec-result ${cleared ? "run-sec-clear" : (withdrawn ? "run-sec-withdrawn" : "run-sec-death")}">
      <h4>本局结果</h4>
      <p class="run-sec-result-text">${cleared ? "命途塔通关 · 功成" : (withdrawn ? "阶段收手 · 活着离塔" : `道途断绝 · 止步${deathStepText}`)}</p>
      <p class="run-sec-title-name">${__titleInfo.title}</p>
      <p class="run-sec-title-sub">${__titleInfo.sub}</p>
      ${dead ? `<p class="run-sec-cause-title">${(__cause && __cause.cause) || "资源耗尽"}</p><p class="run-sec-text">${(__cause && __cause.reason) || "主要死因：资源耗尽，未能撑过敌方攻势。"}</p>` : ""}
      <p class="run-sec-sub">${hero?.name || "未知蛊修"} · ${relic?.name || "未知遗物"} · 本命路线 ${getBenmingPathDisplayName(runState)} · ${getRunModeLabel(runState.mode)} · 存活 ${stats.totalTurns || 0} 回合</p>
      ${runState.mode === "endless" ? `<div class="run-sec-endless">无尽最深：<strong>第 ${getEndlessDeepestScore()} 层</strong>
        <p id="endlessSubmissionStatus">${runState.endlessLeaderboardSubmission?.message || "正在报入排行榜"}</p>
        <div class="run-sec-endless-actions"><button type="button" data-endless-leaderboard-open="result">查看排行榜</button>
        <button type="button" class="hidden" data-endless-leaderboard-retry>重试报入本局最深层</button></div>
      </div>` : ""}
      ${__activeContract ? `<p class="run-sec-sub run-sec-contract-line">命途契「${__activeContract.name}」随行整局——${__activeContract.summary}</p>
      <p class="run-sec-sub run-sec-contract-trigger">本局触发：${__contractTriggerSummary}</p>` : ""}
    </section>
    ${(__benmingGain || __carryTaken.length || __guSettlement?.wardConsumed) ? `<section class="run-summary-section run-sec-harvest">
      <h4>跨局收获</h4>
      ${__benmingGain ? `<p class="run-sec-text">${BENMING_GU[runState.heroId]?.name || "本命蛊"}食此局因果，道行 <strong>+${__benmingGain.earn}</strong>（现 ${__benmingGain.info.dao} · ${__benmingGain.info.stageName}${__benmingGain.stageUp ? " · 已蜕变！" : ""}）</p>
      <div class="faction-bar-row"><span>${__benmingGain.info.next ? `距${__benmingGain.info.next.name}` : "道行圆满"}</span><div class="faction-bar-track"><i style="width:${__benmingGain.info.next ? Math.max(2, Math.min(100, Math.round((__benmingGain.info.dao - BENMING_STAGES[__benmingGain.info.stage].threshold) / Math.max(1, __benmingGain.info.next.threshold - BENMING_STAGES[__benmingGain.info.stage].threshold) * 100))) : 100}%"></i></div><em>${__benmingGain.info.next ? `还差 ${__benmingGain.info.toNext}` : "圆满"}</em></div>` : ""}
      ${__carryTaken.length ? `<p class="run-sec-sub">蛊庐入库：${__carryTaken.join("、")}${dead ? "（陨落仅四成入库）" : ""}——回蛊庐可孵蛊卵、可喂本命蛊。</p>` : ""}
      ${__guSettlement?.wardConsumed ? `<p class="run-sec-sub run-sec-ward-save">护命蛊匣已碎，道脉随行蛊「${__guSettlement.preserved.join("」「")}」已安全归圃。</p>` : ""}
      ${dead ? `<p class="run-sec-sub run-sec-harvest-hope">陨落非空手——这些收获已存进蛊庐，下一局更强。</p>` : ""}
      ${(__lastHarvestSnapshot && !ensureRunRewardedAds(runState).harvestDoubleUsed && typeof NmgAds !== "undefined" && NmgAds.isRewardedAvailable() && NmgAds.isSessionEligible()) ? `<button type="button" id="resultRewardedDouble" class="run-rewarded-btn"><strong>看广告 · 本局收获再领一次</strong><small>每局一次 · 主动观看，完整看完才发放</small></button>` : ""}
    </section>` : ""}
    <section class="run-summary-section run-sec-next">
      <h4>推荐下一步</h4>
      <p class="run-sec-text">${__hint}</p>
    </section>
    ${(cleared || isSaveExportDue()) ? `<section class="run-summary-section run-sec-backup">
      <h4>存档保险</h4>
      <p class="run-sec-sub">道行、蛊庐与图鉴都存在本机——清缓存或换设备前，先备份存档码。</p>
      <button type="button" id="resultSaveExport" class="run-backup-btn">一键备份存档（复制并下载）</button>
    </section>` : ""}
    <details class="run-summary-fold">
      <summary>展开完整战报（命途简报 · 关键数据 · 流派 · 建议）</summary>
    <section class="run-summary-section run-sec-brief${__routeClass}">
      <h4>命途简报</h4>
      <div class="run-sec-grid">
        <div><span>所在层</span><strong>${__layerText}</strong></div>
        <div><span>走过路线</span><strong>${__routeLine}</strong></div>
        <div><span>${cleared ? "通关节点" : (withdrawn ? "收手节点" : "最终节点")}</span><strong>${__finalNode}</strong></div>
        <div><span>存活回合</span><strong>${stats.totalTurns || 0} 回合</strong></div>
      </div>
    </section>
    ${__sec4}
    <section class="run-summary-section run-sec-data">
      <h4>关键数据</h4>
      <div class="run-sec-grid">
        <div><span>剩余生命</span><strong>${runState.currentHp || 0} / ${runState.maxHp || 0}</strong></div>
        <div><span>击败精英</span><strong>${runState.eliteDefeated ? "是" : "否"}</strong></div>
        <div><span>最高伤害卡</span><strong>${topDamageCard}</strong></div>
        <div><span>累计总伤害</span><strong>${stats.playerDamage || 0}</strong></div>
        <div><span>最终卡组</span><strong>${(runState.deckCards && runState.deckCards.length) || 0} 张</strong></div>
        <div><span>最终蛊石</span><strong>${runState.guStones || 0}</strong></div>
      </div>
      <details class="run-sec-more"><summary>更多数据</summary><div class="run-sec-grid">
        <div><span>最高防御卡</span><strong>${topArmorCard}</strong></div>
        <div><span>累计护甲</span><strong>${stats.armorGained || 0}</strong></div>
        <div><span>累计中毒伤害</span><strong>${stats.poisonDamage || 0}</strong></div>
        <div><span>血煞额外伤害</span><strong>${stats.bloodBonusDamage || 0}</strong></div>
        <div><span>累计回血</span><strong>${stats.healing || 0}</strong></div>
        <div><span>主动失血</span><strong>${stats.selfHpLost || 0}</strong></div>
        <div><span>主动耗寿</span><strong>${stats.lifespanSpent || 0}</strong></div>
        <div><span>用牌数</span><strong>${stats.cardsPlayed || 0}</strong></div>
        <div><span>Boss 战回合</span><strong>${stats.bossTurns || "未遭遇"}</strong></div>
        <div><span>Boss 二相</span><strong>${stats.bossPhase2Triggered ? "已触发" : "未触发"}</strong></div>
        <div><span>Boss 压毒次数</span><strong>${stats.bossPoisonSuppressions || 0}</strong></div>
        <div><span>Boss 最高毒层</span><strong>${stats.bossHighestPoison || 0}</strong></div>
        <div><span>Boss 压去毒层</span><strong>${stats.bossPoisonSuppressedLayers || 0}</strong></div>
        <div><span>炼蛊 稳/异/噬</span><strong>${stats.stableRefines || 0} / ${stats.mutations || 0} / ${stats.backlashes || 0}</strong></div>
        <div><span>命势圆满 / 三相</span><strong>${stats.fateTriggers || 0} / ${stats.fateTriads || 0}</strong></div>
        <div><span>噬签 采用/保留/等待</span><strong>${stats.fateRewrites || 0} / ${stats.fateRewriteKept || 0} / ${stats.fateRewriteWaitTurns || 0}</strong></div>
        <div><span>缝煞 触发/少失生命</span><strong>${stats.bloodStitchTriggers || 0} / ${stats.bloodStitchHpSaved || 0}</strong></div>
        <div><span>代偿 次数/耗煞/少失生命</span><strong>${stats.bloodAtonementUses || 0} / ${stats.bloodAtonementSpent || 0} / ${stats.bloodAtonementHpSaved || 0}</strong></div>
        <div><span>逆鳞 追毒/额外毒层</span><strong>${stats.poisonAfterstrikeTriggers || 0} / ${stats.poisonAfterstrikeAdded || 0}</strong></div>
        <div><span>借毒 次数/剥毒/得甲/返毒</span><strong>${stats.poisonBorrowedScaleUses || 0} / ${stats.poisonBorrowedScalePoisonSpent || 0} / ${stats.poisonBorrowedScaleArmorGained || 0} / ${stats.poisonBorrowedScaleReturns || 0}</strong></div>
        <div><span>骨鸣 获得/主动碎甲</span><strong>${stats.boneResonanceGained || 0} / ${stats.boneArmorSacrificed || 0}</strong></div>
        <div><span>叩铃 总/镇魂/断命</span><strong>${stats.boneChimeUses || 0} / ${stats.boneSoulUses || 0} / ${stats.boneFateUses || 0}</strong></div>
        <div><span>生态克制 次数/增伤/蚀甲</span><strong>${stats.ecologyCounterTriggers || 0} / ${stats.ecologyCounterDamage || 0} / ${stats.ecologyCounterArmorRemoved || 0}</strong></div>
        <div><span>最高炼化</span><strong>${getHighestUpgradeSummary() || "无"}</strong></div>
        <div><span>命途种子</span><strong>${escGu(runState.trialSeed || "无")}</strong></div>
        <div><span>临门段选择</span><strong>${getThirdStepChoiceSummary() || "无"}</strong></div>
        <div><span>休整结果</span><strong>${getRestResultSummary() || "无"}</strong></div>
        <div><span>专属机缘</span><strong>${stats.heroEvents || 0}</strong></div>
        <div class="wide"><span>${dead ? `抵达第 ${getCurrentRouteStep()} 段 · 已击败` : "击败敌人"}</span><strong>${defeated}</strong></div>
        <div class="wide"><span>材料与蛊石</span><strong>${materialText} · 蛊石 ${runState.guStones || 0}</strong></div>
        <div class="wide"><span>获得遗物</span><strong>${relicText}</strong></div>
      </div></details>
    </section>
    <section class="run-summary-section run-sec-faction">
      <h4>本局流派</h4>
      <p class="run-sec-faction-head">主修：${__faction.fallback ? "未明" : __faction.primary}${__faction.secondary ? ` · 次修：${__faction.secondary}` : ""}</p>
      <div class="faction-bars">${__factionBars}</div>
      <p class="run-sec-bestiary">${__bestiaryCount > 0 ? `万蛊录已遇敌怪/首领 ${__bestiaryCount} 条` : "本局未新增万蛊录条目"}</p>
    </section>
    <section class="run-summary-section run-sec-feedback">
      <h4>内测反馈</h4>
      <p class="run-sec-text">你觉得哪张蛊最强？如果卡组过强或过弱，请记录角色、遗物和关键蛊牌。</p>
    </section>
    </details>
    ${(NMG_XIANGHUO_ENABLED && (cleared || withdrawn || __layer >= 2) && !progression.xianghuoHidePrompt) ? `<section class="run-summary-section run-sec-xianghuo">
      <p class="run-xianghuo-line">若这趟逆命还算值得，<button type="button" class="run-xianghuo-link" data-xianghuo-open="result">添一炷香火 →</button></p>
      <button type="button" class="run-xianghuo-hide" data-xianghuo-hide="1">不再提示</button>
    </section>` : ""}`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.textContent = "再入命途塔";
  dom.resultPrimaryButton.dataset.action = "newRun";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultLoreButton?.classList.remove("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultPrimaryButton.focus();
}

// fxLayer 与 effectLayer 都只承载临时视觉节点；关闭战斗特效时必须一起清理。
function clearEffectLayerOnly() {
  if (dom.effectLayer) dom.effectLayer.innerHTML = "";
  if (dom.fxLayer) dom.fxLayer.innerHTML = "";
  window.clearTimeout(mupanVfxTimer);
  mupanVfxTimer = null;
  if (game?.mupanVfxInputLock) {
    game.mupanVfxInputLock = false;
    if (game.status === "playing") game.inputLocked = false;
  }
  if (dom.mupanEnvironment) dom.mupanEnvironment.className = "mupan-environment";
  document.body.classList.remove("screen-shake-lite", "hit-pause-lite");
  document.querySelectorAll(".panel-hit-heavy, .status-bounce, .fate-pulse, .blood-pulse, .resource-pulse, .yuan-pulse, .armor-guard-pulse, .hp-damage-pulse, .hp-heal-pulse, .blood-trail, .boss-awake, .boss-phase-flash, .boss-phase-flash-strong, .boss-charge-glow, .portrait-dimmed, .portrait-phase-shift, .portrait-phase-zoom, .furnace-active, .furnace-forging").forEach((element) => {
    element.classList.remove("panel-hit-heavy", "status-bounce", "fate-pulse", "blood-pulse", "resource-pulse", "yuan-pulse", "armor-guard-pulse", "hp-damage-pulse", "hp-heal-pulse", "blood-trail", "boss-awake", "boss-phase-flash", "boss-phase-flash-strong", "boss-charge-glow", "portrait-dimmed", "portrait-phase-shift", "portrait-phase-zoom", "furnace-active", "furnace-forging");
  });
}

function clearCombatEffects() {
  restoreMupanSealedCardsToBattle();
  restoreMupanTestRunFields();
  window.clearTimeout(mupanResultTimer);
  mupanResultTimer = null;
  document.body.classList.remove("mupan-arena-active");
  delete document.body.dataset.mupanPhase;
  window.clearTimeout(bannerTimer);
  window.clearTimeout(castTimer);
  window.clearTimeout(enemyTurnTimer);
  window.clearTimeout(cardUnlockTimer);
  window.clearTimeout(mupanVfxTimer);
  bannerTimer = null;
  castTimer = null;
  enemyTurnTimer = null;
  cardUnlockTimer = null;
  mupanVfxTimer = null;
  if (dom.fxLayer) dom.fxLayer.innerHTML = "";
  clearEffectLayerOnly();
  dom.turnBanner?.classList.remove("show");
  dom.castDisplay?.classList.remove("show");
  document.querySelectorAll(".panel-hit, .panel-hit-heavy, .damage-flash, .hit-shake, .status-bounce, .fate-pulse, .blood-pulse, .resource-pulse, .yuan-pulse, .armor-guard-pulse, .hp-damage-pulse, .hp-heal-pulse, .blood-trail, .boss-awake, .boss-phase-flash, .boss-phase-flash-strong, .boss-charge-glow, .portrait-dimmed, .portrait-phase-shift, .portrait-phase-zoom, .furnace-active, .furnace-forging").forEach((element) => {
    element.classList.remove("panel-hit", "panel-hit-heavy", "damage-flash", "hit-shake", "status-bounce", "fate-pulse", "blood-pulse", "resource-pulse", "yuan-pulse", "armor-guard-pulse", "hp-damage-pulse", "hp-heal-pulse", "blood-trail", "boss-awake", "boss-phase-flash", "boss-phase-flash-strong", "boss-charge-glow", "portrait-dimmed", "portrait-phase-shift", "portrait-phase-zoom", "furnace-active", "furnace-forging");
  });
}

function showTurnBanner(kicker, text) {
  window.clearTimeout(bannerTimer);
  dom.turnBannerKicker.textContent = kicker;
  dom.turnBannerText.textContent = text;
  dom.turnBanner.classList.remove("show");
  void dom.turnBanner.offsetWidth;
  dom.turnBanner.classList.add("show");
  bannerTimer = window.setTimeout(() => dom.turnBanner.classList.remove("show"), 900);
}

function showCastDisplay(card) {
  window.clearTimeout(castTimer);
  dom.castGlyph.textContent = card.glyph;
  dom.castName.textContent = card.name;
  dom.castDisplay.classList.remove("show");
  void dom.castDisplay.offsetWidth;
  dom.castDisplay.classList.add("show");
  castTimer = window.setTimeout(() => dom.castDisplay.classList.remove("show"), 760);
}

function animateCardPlay(element, card) {
  if (!effectsAllowed()) return;
  const rect = element.getBoundingClientRect();
  const arenaRect = document.querySelector(".arena-panel").getBoundingClientRect();
  const clone = element.cloneNode(true);
  clone.classList.add("card-phantom", getCardPhantomClass(card));
  clone.setAttribute("aria-hidden", "true");
  clone.style.setProperty("--card-x", `${rect.left}px`);
  clone.style.setProperty("--card-y", `${rect.top}px`);
  clone.style.setProperty("--card-w", `${rect.width}px`);
  clone.style.setProperty("--card-h", `${rect.height}px`);
  clone.style.setProperty("--card-dx", `${arenaRect.left + arenaRect.width / 2 - rect.left - rect.width / 2}px`);
  clone.style.setProperty("--card-dy", `${arenaRect.top + arenaRect.height * 0.28 - rect.top - rect.height / 2}px`);
  clone.title = card.name;
  appendEffectNode(clone, 680);
  clone.addEventListener("animationend", () => clone.remove(), { once: true });
  window.setTimeout(() => clone.remove(), 720);
}

function spawnFloatText(target, text, kind) {
  if (!effectsAllowed() || !target || !dom.fxLayer) return;
  const rect = target.getBoundingClientRect();
  const item = document.createElement("span");
  const readabilityClass = getFloatTextReadabilityClass(text, kind);
  item.className = `float-text ${kind || ""} ${readabilityClass}`.trim();
  item.textContent = text;
  item.style.left = `${rect.left + rect.width / 2}px`;
  item.style.top = `${rect.top + rect.height * 0.44}px`;
  dom.fxLayer.appendChild(item);
  trimFloatLayer();
  item.addEventListener("animationend", () => item.remove(), { once: true });
  window.setTimeout(() => item.remove(), readabilityClass.includes("core-float") ? 1500 : 1200);
}

function getFloatTextReadabilityClass(text, kind = "") {
  const value = `${text || ""} ${kind || ""}`;
  const classes = [];
  const isCore = /伤害|防御|护甲|格挡|毒|血煞|命势|寿元|生命|真元|反噬|受损|偏斜|-\d|\+\d/.test(value);
  if (isCore) classes.push("core-float");
  if (/毒|poison/.test(value)) classes.push("poison-core-float");
  if (/防御|护甲|格挡|defense/.test(value)) classes.push("defense-core-float");
  if (/血煞|blood/.test(value)) classes.push("blood-core-float");
  if (/命势|fate/.test(value)) classes.push("fate-core-float");
  if (/寿元|反噬|受损|偏斜|resource/.test(value)) classes.push("lifespan-core-float");
  if (/真元|yuan/.test(value)) classes.push("yuan-core-float");
  if (/-\d/.test(value) && !/寿元|真元/.test(value)) classes.push("damage-core-float");
  return classes.join(" ");
}

function animateHit(element) {
  if (element && element.closest && element.closest(".player-panel")) safeVibrate(16);
  if (!effectsAllowed() || !element) return;
  const panel = element.closest(".combatant");
  restartTimedClass(element, "damage-flash", 380);
  if (panel) restartTimedClass(panel, "panel-hit", 380);
}

function effectsAllowed() {
  return Boolean(effectsEnabled && dom.effectLayer);
}

// 轻振动：特性检测 + try/catch，仅在 navigator.vibrate 存在时调用；桌面无害。
function safeVibrate(ms) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch (err) { /* 部分浏览器非用户手势会抛错，忽略 */ }
}

function appendEffectNode(node, fallbackDuration = 900) {
  if (!effectsAllowed() || !node) return null;
  dom.effectLayer.appendChild(node);
  trimEffectLayer();
  window.setTimeout(() => node.remove(), fallbackDuration);
  return node;
}

function trimEffectLayer() {
  if (!dom.effectLayer) return;
  while (dom.effectLayer.children.length > MAX_EFFECT_NODES) {
    dom.effectLayer.firstElementChild?.remove();
  }
}

function trimFloatLayer() {
  if (!dom.fxLayer) return;
  while (dom.fxLayer.children.length > MAX_FLOAT_NODES) {
    dom.fxLayer.firstElementChild?.remove();
  }
}

function getTargetPoint(target, yRatio = 0.5) {
  const rect = target?.getBoundingClientRect?.();
  if (rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height * yRatio,
    };
  }
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
}

function spawnEffectAt(target, className, { text = "", duration = 900, yRatio = 0.5 } = {}) {
  if (!effectsAllowed()) return null;
  const point = getTargetPoint(target, yRatio);
  const node = document.createElement("span");
  node.className = `battle-effect ${className}`;
  if (text) node.textContent = text;
  node.style.left = `${point.x}px`;
  node.style.top = `${point.y}px`;
  appendEffectNode(node, duration + 120);
  node.addEventListener("animationend", () => node.remove(), { once: true });
  return node;
}

function spawnCenterEffect(className, text = "", duration = 900) {
  if (!effectsAllowed()) return null;
  const node = document.createElement("span");
  node.className = `battle-effect center-effect ${className}`;
  if (text) node.textContent = text;
  appendEffectNode(node, duration + 120);
  node.addEventListener("animationend", () => node.remove(), { once: true });
  return node;
}

function pulseElement(element, className, duration = 460) {
  if (!effectsAllowed() || !element) return;
  restartTimedClass(element, className, duration);
}

function clearAnimationClassTimer(element, className) {
  if (!element || !className) return;
  const timers = animationClassTimers.get(element);
  if (!timers) return;
  const timer = timers.get(className);
  if (timer) window.clearTimeout(timer);
  timers.delete(className);
  if (timers.size === 0) animationClassTimers.delete(element);
}

function scheduleAnimationClassRemoval(element, className, duration) {
  if (!element || !className) return;
  clearAnimationClassTimer(element, className);
  let timers = animationClassTimers.get(element);
  if (!timers) {
    timers = new Map();
    animationClassTimers.set(element, timers);
  }
  const timer = window.setTimeout(() => {
    element.classList.remove(className);
    const activeTimers = animationClassTimers.get(element);
    if (activeTimers) {
      activeTimers.delete(className);
      if (activeTimers.size === 0) animationClassTimers.delete(element);
    }
  }, duration);
  timers.set(className, timer);
}

function restartTimedClass(element, className, duration = 460) {
  if (!element || !className) return;
  clearAnimationClassTimer(element, className);
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  scheduleAnimationClassRemoval(element, className, duration);
}

function queryEffectElement(selector) {
  return document.querySelector(selector);
}

function triggerScreenShake() {
  if (!effectsAllowed()) return;
  restartTimedClass(document.body, "screen-shake-lite", 120);
}

function triggerHitPause(duration = 90) {
  if (!effectsAllowed()) return;
  restartTimedClass(document.body, "hit-pause-lite", duration);
}

function spawnDelayedFloatText(target, text, kind = "", delay = 70) {
  if (delay <= 0) {
    spawnFloatText(target, text, kind);
    return;
  }
  window.setTimeout(() => spawnFloatText(target, text, kind), delay);
}

function getCardPhantomClass(card) {
  return `phantom-${getCardEffectType(card)}`;
}

function getCardEffectType(card) {
  return card?.effectType || CARD_LIBRARY[card?.key]?.effectType || inferCardEffectType(card || {});
}

function flashCombatResource(selector, className = "resource-pulse", duration = 520) {
  pulseElement(queryEffectElement(selector), className, duration);
}

function playCardUseEffect(card) {
  if (!effectsAllowed()) return;
  switch (getCardEffectType(card)) {
    case "blade":
      spawnEffectAt(dom.enemyPortrait, "effect-moon-slash effect-moon-slash-prime", { duration: 340, yRatio: 0.48 });
      break;
    case "blood":
      spawnEffectAt(dom.enemyPortrait, "effect-blood-rune effect-blood-rune-prime", { duration: 520, yRatio: 0.48 });
      flashCombatResource(".blood-resource", "blood-pulse", 520);
      break;
    case "poison":
      spawnEffectAt(dom.enemyPortrait, "effect-poison-mist effect-poison-mist-prime", { duration: 680, yRatio: 0.52 });
      spawnEffectAt(dom.enemyPortrait, "effect-bug-shadow effect-bug-shadow-prime", { duration: 680, yRatio: 0.36 });
      break;
    case "armor":
      spawnEffectAt(dom.playerPortrait, "effect-armor-sigil effect-armor-guard", { duration: 620, yRatio: 0.48 });
      flashCombatResource(".armor-resource");
      break;
    case "yuan":
      spawnEffectAt(dom.playerPortrait, "effect-yuan-flow effect-yuan-strong", { duration: 640, yRatio: 0.52 });
      flashCombatResource(".yuan-resource", "yuan-pulse");
      if ((game?.player?.drunkStacks || 0) > 0 || card.key === "wineWorm" || card.key === "drunkFateWorm") {
        flashCombatResource(".buff-list", "status-bounce", 420);
      }
      break;
    case "fate":
      spawnEffectAt(dom.playerPortrait, "effect-fate-ring effect-fate-ring-prime", { duration: 640, yRatio: 0.5 });
      playFateGainEffect();
      break;
    default:
      spawnCenterEffect("effect-utility-rune effect-utility-prime", card.glyph || "", 600);
      break;
  }
}

function playAttackEffect(card) {
  if (!effectsAllowed()) return;
  window.setTimeout(() => playAttackImpactEffect(card), 240);
}

function playAttackImpactEffect(card) {
  if (!effectsAllowed()) return;
  const effectType = getCardEffectType(card);
  if (effectType === "blood") {
    const highBlood = (game?.player?.blood || 0) >= Math.max(5, Math.floor(getBloodMax() * 0.65));
    spawnEffectAt(dom.enemyPortrait, highBlood ? "effect-blood-rune effect-blood-rune-overflow" : "effect-blood-rune effect-blood-rune-prime", { duration: 560 });
    pulseElement(dom.enemyPortrait, "blood-trail", 420);
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit-heavy", 430);
    if (game?.player?.hp <= game?.player?.maxHp * 0.35) flashCombatResource(".blood-resource", "blood-pulse", 680);
    triggerHitPause(105);
    triggerScreenShake();
    return;
  }
  if (effectType === "poison") {
    spawnEffectAt(dom.enemyPortrait, "effect-poison-mist effect-poison-mist-prime", { duration: 720 });
    spawnEffectAt(dom.enemyPortrait, "effect-bug-shadow effect-bug-shadow-prime", { duration: 680, yRatio: 0.36 });
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit", 360);
    return;
  }
  if (effectType === "blade") {
    spawnEffectAt(dom.enemyPortrait, "effect-moon-slash effect-moon-slash-prime", { duration: 430 });
    if (card.key === "armorBreaker" || card.key === "armorMeltPoison") {
      spawnEffectAt(dom.enemyPortrait, "effect-armor-crack", { duration: 520, yRatio: 0.5 });
    }
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit", 360);
    return;
  }
  const heavy = isBloodAttackCard(card) || card.type === "blood" || card.cost >= 2 || card.key === "bloodBlade";
  if (heavy) {
    spawnEffectAt(dom.enemyPortrait, "effect-blood-rune effect-blood-rune-prime", { duration: 520 });
    pulseElement(dom.enemyPortrait, "blood-trail", 360);
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit-heavy", 360);
    triggerHitPause(95);
    triggerScreenShake();
  } else {
    spawnEffectAt(dom.enemyPortrait, "effect-moon-slash effect-moon-slash-prime", { duration: 420 });
  }
}

function playPlayerHitEffect() {
  if (!effectsAllowed()) return;
  spawnEffectAt(dom.playerPortrait, "effect-blood-splash", { duration: 430 });
  pulseElement(document.querySelector(".player-panel"), "panel-hit-heavy", 340);
}

function playArmorEffect() {
  spawnEffectAt(dom.playerPortrait, "effect-armor-sigil effect-armor-guard", { duration: 720, yRatio: 0.48 });
  pulseElement(queryEffectElement(".armor-resource"), "armor-guard-pulse", 620);
}

function playHealEffect() {
  spawnEffectAt(dom.playerPortrait, "effect-heal-sparks effect-heal-return", { duration: 820, yRatio: 0.58 });
}

function playBloodReturnEffect() {
  if (!effectsAllowed()) return;
  spawnEffectAt(dom.playerPortrait, "effect-blood-return", { duration: 720, yRatio: 0.52 });
  pulseElement(dom.playerHpBar, "hp-heal-pulse", 560);
}

function playPoisonApplyEffect() {
  spawnEffectAt(dom.enemyPortrait, "effect-poison-mist effect-poison-mist-prime", { duration: 760 });
  spawnEffectAt(dom.enemyPortrait, "effect-bug-shadow effect-bug-shadow-prime", { duration: 700, yRatio: 0.36 });
  pulseElement(dom.enemyStatusList, "status-bounce", 420);
}

function playPoisonTickEffect() {
  spawnEffectAt(dom.enemyPortrait, "effect-poison-corrosion effect-poison-corrosion-prime", { duration: 760 });
}

function playCorrosionEffect() {
  spawnEffectAt(dom.enemyPortrait, "effect-poison-burst effect-poison-burst-prime", { text: "蚀毒", duration: 760 });
}

function playFateGainEffect() {
  pulseElement(queryEffectElement(".fate-status"), "fate-pulse", 520);
}

function playFateFullEffect() {
  spawnCenterEffect("effect-fate-wheel effect-fate-wheel-prime", "命势圆满", 980);
  spawnCenterEffect("effect-fate-reward", "真元 +1 · 抽 1 张牌", 900);
}

function playBloodGainEffect() {
  pulseElement(queryEffectElement(".blood-status"), "blood-pulse", 520);
  flashCombatResource(".blood-resource", "blood-pulse", (game?.player?.blood || 0) >= 6 ? 760 : 560);
}

function playWineTriggerEffect() {
  if (!effectsAllowed()) return;
  flashCombatResource(".buff-list", "status-bounce", 520);
  flashCombatResource(".yuan-resource", "yuan-pulse", 520);
  spawnCenterEffect("effect-yuan-trigger", "酒意催发", 720);
}

function playDrawCardEffect(count = 1) {
  if (!effectsAllowed()) return;
  const text = count > 1 ? `牵引 ${count} 张` : "牵引";
  spawnEffectAt(dom.hand, "effect-card-draw-line", { text, duration: 620, yRatio: 0.24 });
}

function playDiscardCardEffect(count = 1) {
  if (!effectsAllowed()) return;
  const text = count > 1 ? `弃 ${count}` : "弃";
  spawnEffectAt(dom.hand, "effect-card-discard-dust", { text, duration: 620, yRatio: 0.28 });
}

function playCorpseDiskPoisonSuppressionEffect(removed) {
  if (!effectsAllowed()) return;
  spawnEffectAt(dom.enemyPortrait, "effect-boss-poison-suppression", { text: `压毒 -${removed}`, duration: 760, yRatio: 0.46 });
  pulseElement(dom.enemyStatusList, "boss-charge-glow", 620);
}

function playBossWakeEffect() {
  if (!effectsAllowed()) return;
  pulseElement(document.querySelector(".enemy-panel"), "boss-awake", 940);
  spawnEffectAt(dom.enemyPortrait, "effect-boss-mist", { duration: 940 });
  spawnCenterEffect("effect-boss-title", `${game.enemy?.definition?.name || "守关者"}苏醒`, 980);
}

function playCorpseDiskPhase2Effect() {
  if (!effectsAllowed()) return;
  triggerHitPause(300);
  const enemyPanel = document.querySelector(".enemy-panel");
  pulseElement(enemyPanel, "boss-phase-flash", 1120);
  pulseElement(enemyPanel, "boss-phase-flash-strong", 1120);
  pulseElement(dom.enemyPortrait, "portrait-phase-shift", 1020);
  pulseElement(dom.enemyPortrait, "portrait-phase-zoom", 1020);
  spawnCenterEffect("effect-boss-title effect-boss-title-prime", "尸盘转轮", 1120);
  spawnCenterEffect("effect-boss-subtitle", "死气倒灌，守关者杀意渐盛。", 1120);
  spawnCenterEffect("effect-boss-phase-haze effect-boss-phase-haze-strong", "", 1120);
  spawnEffectAt(dom.enemyPortrait, "effect-blood-rune effect-blood-rune-overflow", { duration: 860, yRatio: 0.48 });
}

function playBossActionEffect(action) {
  if (!effectsAllowed() || !isCorpseDiskBoss() || !game.enemy.phase2) return;
  if (game.enemy.intent === "corpseClaw") {
    spawnEffectAt(dom.playerPortrait, "effect-boss-claw effect-boss-claw-prime", { duration: 700, yRatio: 0.48 });
    triggerHitPause(90);
    triggerScreenShake();
  } else if (game.enemy.intent === "guFireBreath") {
    spawnEffectAt(dom.playerPortrait, "effect-boss-greenfire effect-boss-greenfire-prime", { duration: 760, yRatio: 0.48 });
  } else if (game.enemy.intent === "corpseCharge" || action?.kind === "charge") {
    pulseElement(dom.enemyStatusList, "boss-charge-glow", 920);
    spawnEffectAt(dom.enemyPortrait, "effect-boss-mist effect-boss-charge-mist", { duration: 900 });
  }
}

function playVictoryEffect() {
  if (!effectsAllowed()) return;
  pulseElement(dom.enemyPortrait, "portrait-dimmed", 900);
  spawnCenterEffect("effect-gold-seal", "命途已破", 900);
}

function playDefeatEffect() {
  if (!effectsAllowed()) return;
  pulseElement(dom.playerPortrait, "portrait-dimmed", 900);
  spawnCenterEffect("effect-crack", "道途断绝", 900);
}

// V0.9.36 B-5a: furnace open/complete effects moved to nmg-refining.js.
function render() {
  updateTutorialDrillCoach();
  if (!game) return;
  updateMobileViewportState();
  syncMupanArenaVisualState();
  const { player, enemy } = game;
  const relic = RELICS[runState.relicId];
  const hero = player.definition;
  const currentNode = getCurrentRunNode();
  const nodeLabel = currentNode?.type === "elite" ? "精英" : currentNode?.type === "boss" ? "Boss" : "战斗";
  dom.turnNumber.textContent = game.turn;
  dom.floorEyebrow.textContent = game.isTowerMupan
    ? "塔心 · 最终战"
    : (isMobileLandscapeSafe()
      ? `第${getCurrentRouteStep()}段 · ${nodeLabel}`
      : `命途图 · 第 ${getCurrentRouteStep()} 段 · ${nodeLabel}`);
  dom.playerSideLabel.textContent = hero.role;
  dom.playerTitle.textContent = hero.name;
  dom.playerPortraitCaption.textContent = hero.caption;
  dom.playerPortrait.setAttribute("aria-label", `${hero.name}立绘`);
  dom.playerHp.textContent = player.hp;
  dom.playerMaxHp.textContent = player.maxHp;
  dom.playerHpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  dom.playerEnergy.textContent = `${player.energy} / ${player.baseEnergy + getDragonEnergyBonus()}`;
  dom.playerArmor.textContent = player.armor;
  dom.playerLifespan.textContent = player.lifespan;
  dom.playerBlood.textContent = `${player.blood} / ${getBloodMax()}`;
  dom.topRelicGlyph.textContent = relic.glyph;
  dom.topRelicName.textContent = relic.name;
  dom.activeRelicGlyph.textContent = relic.glyph;
  dom.activeRelicName.textContent = relic.name;
  renderCombatRelicStrip();
  renderSatchelStrip(); // V0.9.16 丹囊条（原名蛊囊条，V0.9.18.2 正名）
  updateGuStoneDisplays();

  dom.enemyTitle.textContent = enemy.definition.name;
  dom.enemySideLabel.textContent = enemy.definition.title;
  dom.enemyHp.textContent = enemy.hp;
  dom.enemyMaxHp.textContent = enemy.maxHp;
  dom.enemyHpBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
  dom.arenaKicker.textContent = enemy.definition.kicker;
  dom.endTurnHint.textContent = `${enemy.definition.name}将执行意图`;
  dom.drawCount.textContent = game.drawPile.length;
  dom.discardCount.textContent = game.discardPile.length;
  const enemyPanel = document.querySelector(".enemy-panel");
  enemyPanel?.classList.toggle("boss-mode", Boolean(enemy.definition.isBoss));
  enemyPanel?.classList.toggle("elite-mode", Boolean(enemy.definition.isElite));
  enemyPanel?.classList.toggle("phase2-mode", Boolean(enemy.phase2));

  renderTowerProgress();
  renderPlayerPortrait();
  renderEnemyPortrait();
  renderBuffs();
  renderIntent();
  renderEnemyStatuses();
  renderHand();
  if (dom.boneChimeButton) {
    const showBoneChime = isBoneHero();
    const ready = showBoneChime && canUseBoneChime();
    dom.boneChimeButton.classList.toggle("hidden", !showBoneChime);
    dom.boneChimeButton.classList.toggle("is-ready", ready);
    dom.boneChimeButton.disabled = !ready;
    const hint = !showBoneChime ? ""
      : game.bone.chimeUsedThisTurn ? "本回合已叩"
        : game.bone.resonance < BONE_BALANCE.chimeThreshold
          ? `骨鸣 ${game.bone.resonance}/${BONE_BALANCE.chimeThreshold}`
          : `骨鸣 ${game.bone.resonance}/${BONE_BALANCE.resonanceMax}`;
    dom.boneChimeButton.querySelector("small").textContent = hint;
  }
  dom.endTurnButton.disabled = game.status !== "playing" || game.inputLocked;
}

function getCombatBuffDetail(buff) {
  const base = buff?.title || KEYWORD_HELP[buff?.keyword] || `${buff?.label || "状态"}。`;
  const className = String(buff?.className || "");
  if (className.includes("refinement-status")) return `${base} 本局持续生效。`;
  if (className.includes("mingtu-contract-status")) return `${base} 所签命途契在本局持续生效。`;
  if (className.includes("path-status")) return `${base} 本命路线在本场战斗持续生效。`;
  if (className.includes("passive-status")) return `${base} 蛊修被动在本场战斗持续生效。`;
  return base;
}

function renderBuffs() {
  const buffs = [];
  let benmingPathBuff = null;
  if (game.player.heroId === "poison") {
    buffs.push({ label: "毒道被动：万毒归宗", title: game.player.definition.passive, className: "poison-passive-status", keyword: "蚀毒" });
  } else {
    buffs.push({ label: `被动：${game.player.definition.passiveName}`, title: game.player.definition.passive, className: "passive-status" });
  }
  if (game.player.heroId === "fate") {
    const fatePath = getActiveFateBenmingPath();
    buffs.push({
      label: `命势：${game.player.fateMomentum}/${FATE_MOMENTUM_MAX}`,
      title: "打出与上一张不同类型的卡牌时获得 1 层命势；满 3 层后真元 +1 并抽 1 张牌。",
      className: "fate-status",
      keyword: "命势",
    });
    if (fatePath === "threeWeave") {
      const triadNames = (game.fateTriad || []).map(getCardFlowName);
      benmingPathBuff = {
        label: `三相织命：${triadNames.length ? `已打 ${triadNames.join(" · ")}` : "尚未开始"}`,
        title: BENMING_PATHS.fate.threeWeave.summary,
        className: "fate-path-status",
      };
    } else if (fatePath === "devourOmen") {
      benmingPathBuff = {
        label: game.fateRewritePending ? "噬签改命：命势已满 · 可改签" : "噬签改命：等待命势圆满",
        title: BENMING_PATHS.fate.devourOmen.summary,
        className: game.fateRewritePending ? "fate-path-status is-pending" : "fate-path-status",
      };
    } else if (isLegacyBenmingRun(runState) && benmingPassive("fate", 3)) {
      benmingPathBuff = { label: "衔命虫：旧规则·圆满余泽", title: "此老续局沿用改名前的三转与五转规则。", className: "fate-path-status" };
    }
  } else if (game.player.heroId === "blood") {
    const bloodPath = getActiveBloodBenmingPath();
    if (bloodPath === "bloodStitch") {
      const stateCopy = {
        unprepared: "未铺垫 · 先打非血道牌",
        prepared: "已铺垫 · 下一张血道牌收束",
        spent: "本回合已用",
        forfeited: "本回合已错过",
      }[game.bloodStitchState] || "未铺垫";
      benmingPathBuff = {
        label: `缝煞成茧：${stateCopy}`,
        title: BENMING_PATHS.blood.bloodStitch.summary,
        className: game.bloodStitchState === "prepared" ? "blood-path-status is-ready" : "blood-path-status",
        keyword: "铺垫",
      };
    } else if (bloodPath === "bloodAtonement") {
      const maxUses = benmingPassive("blood", 5) ? 2 : 1;
      const remaining = Math.max(0, maxUses - (game.bloodAtonementUsesThisTurn || 0));
      benmingPathBuff = {
        label: `裂茧代偿：剩余 ${remaining}/${maxUses} 次 · 需 3 血煞`,
        title: BENMING_PATHS.blood.bloodAtonement.summary,
        className: game.player.blood >= 3 && remaining > 0 ? "blood-path-status is-ready" : "blood-path-status",
        keyword: "代偿",
      };
    } else if (isLegacyBenmingRun(runState) && benmingPassive("blood", 3)) {
      benmingPathBuff = { label: "赤茧蛊：旧规则·破茧吮煞", title: "此老续局沿用改名前的三转与五转规则。", className: "blood-path-status" };
    }
  } else if (game.player.heroId === "poison") {
    const poisonPath = getActivePoisonBenmingPath();
    if (poisonPath === "poisonAfterstrike") {
      const stateCopy = {
        waitingAttack: "待攻击 · 先打攻击牌",
        primed: "逆鳞已开 · 下张施毒牌追毒 +2",
        spent: "本回合已用",
        forfeited: "本回合已错过",
      }[game.poisonAfterstrikeState] || "待攻击";
      benmingPathBuff = {
        label: `逆鳞后毒：${stateCopy}`,
        title: BENMING_PATHS.poison.poisonAfterstrike.summary,
        className: game.poisonAfterstrikeState === "primed" ? "poison-path-status is-ready" : "poison-path-status",
        keyword: "追毒",
      };
    } else if (poisonPath === "poisonBorrowedScale") {
      const borrowPlan = getPoisonBorrowPlan(false);
      benmingPathBuff = {
        label: game.poisonBorrowedScaleUsedThisTurn
          ? "蜕鳞借毒：本回合已用"
          : `蜕鳞借毒：4 毒换 6 甲 · 敌毒 ${game.enemy?.poison || 0} 层`,
        title: BENMING_PATHS.poison.poisonBorrowedScale.summary,
        className: borrowPlan.eligible ? "poison-path-status is-ready" : "poison-path-status",
        keyword: "借毒",
      };
    } else if (isLegacyBenmingRun(runState) && benmingPassive("poison", 3)) {
      benmingPathBuff = { label: "蜕鳞蛊：旧规则·宿毒入局", title: "此老续局沿用改名前的三转与五转规则。", className: "poison-path-status" };
    }
  } else if (game.player.heroId === "bone") {
    const bonePath = getActiveBoneBenmingPath();
    const boneReady = canUseBoneChime();
    buffs.push({
      label: game.bone.chimeUsedThisTurn
        ? `骨鸣：${game.bone.resonance}/${BONE_BALANCE.resonanceMax} · 本回合已叩`
        : boneReady
          ? `骨鸣：${game.bone.resonance}/${BONE_BALANCE.resonanceMax} · 可叩铃`
          : `骨鸣：${game.bone.resonance}/${BONE_BALANCE.chimeThreshold}`,
      title: "每回合首次以蛊牌获得防御、敌人首次击碎防御、首次主动碎去至少 4 点防御时，各可获得 1 点骨鸣。达到 3 点后可叩铃。",
      className: boneReady ? "bone-status is-ready" : "bone-status",
      keyword: "骨鸣",
      action: boneReady ? "boneChime" : "",
    });
    if (bonePath) {
      benmingPathBuff = {
        label: `${BENMING_PATHS.bone[bonePath].name}：${bonePath === "soulSettling" ? "镇魂护命" : "断命碎甲"}`,
        title: BENMING_PATHS.bone[bonePath].summary,
        className: "bone-path-status",
        keyword: "叩铃",
      };
    }
  }
  if (benmingPathBuff) buffs.unshift(benmingPathBuff);
  if (isDragonHero()) {
    const dragonPath = getRunBenmingPath(runState);
    if (dragonPath) {
      buffs.unshift({
        label: `${BENMING_PATHS.dragon[dragonPath].name}：${dragonPath === "emberAscension" ? "化龙爆发" : "化龙护命"}`,
        title: BENMING_PATHS.dragon[dragonPath].summary,
        className: "dragon-path-status",
      });
    }
    buffs.unshift({
      label: game.dragon.transformed
        ? `龙化：余 ${game.dragon.turnsRemaining} 回合`
        : `龙鳞：${game.dragon.scale}/${DRAGON_BALANCE.scaleMax}`,
      title: game.dragon.transformed
        ? `龙化期间每回合真元 +${DRAGON_BALANCE.energyBonus}，攻击蛊伤害 +${DRAGON_BALANCE.attackBonus}，护甲蛊防御 +${DRAGON_BALANCE.defenseBonus}；期间不能继续获得龙鳞。`
        : `每回合首次以攻击蛊实际伤敌、首次以护甲蛊实际获得防御，各获得 1 枚龙鳞；满 ${DRAGON_BALANCE.scaleMax} 枚可主动化龙。`,
      className: game.dragon.transformed ? "dragon-status is-transformed" : "dragon-status",
      keyword: "龙鳞",
    });
  }
  // V0.9.40 QS-1a 命途契 chip：置顶于路线 chip 之上（后 unshift 者最顶），玩家整场都看得见契在身。
  const __activeContract = typeof getActiveContract === "function" ? getActiveContract(runState) : null;
  if (__activeContract) {
    buffs.unshift({
      label: `命途契：${__activeContract.name}`,
      title: `${__activeContract.summary}代价：${__activeContract.cost}`,
      className: "mingtu-contract-status",
      keyword: "命途契",
    });
  }
  if ((game.player.drunkStacks || 0) > 0) {
    const drunkFlatBonus = Math.max(0, Number(game.player.drunkFlatBonus) || 0);
    const drunkFlatText = drunkFlatBonus > 0 ? `，再加 ${drunkFlatBonus} 点` : "";
    buffs.unshift({
      label: `酒 ×${getDrunkMultiplier(game.player.drunkStacks)} · ${game.player.drunkStacks}层`,
      title: `下一张攻击蛊伤害×${getDrunkMultiplier(game.player.drunkStacks)}${drunkFlatText}（酒意 ${game.player.drunkStacks} 层，最多 ${DRUNK_MAX_STACKS} 层：一层×2、二层×2.5、三层×3），触发后清空全部层。`,
      className: "immediate-status wine-status",
      keyword: "酒意",
    });
  }
  // V0.9.8.7 去重：血煞已在左侧资源格子（playerBlood，与真元/防御/寿元同组）常驻显示，buff 列表不再重复——血煞是持久资源而非临时状态，归属资源格子语义更清晰。
  if (game.player.poison > 0) buffs.push({ label: `中毒：${game.player.poison} 层`, title: "敌方回合结束后受到等同层数的伤害，随后衰减 1 层。", className: "poison-status", keyword: "毒性" });
  if (game.player.vulnerable > 0) buffs.push({ label: `易伤：${game.player.vulnerable} 层`, title: "每次受到敌方攻击伤害时该次伤害 ×1.5（向上取整）并消耗 1 层。", className: "vulnerable-status", keyword: "易伤" });
  if ((game.player.poisonStingStack || 0) > 0) buffs.push({ label: `毒刺：${game.player.poisonStingStack} 层`, title: "每回合开始固定受到等同层数的伤害，不会衰减；需击败施加者解除。", className: "poison-status", keyword: "毒刺" });
  if ((game.player.nextTurnDrawPenalty || 0) > 0) buffs.push({ label: `乱铃：少抽 ${game.player.nextTurnDrawPenalty} 张`, title: "下一回合补牌数减少；保底至少抽 1 张。", className: "vulnerable-status", keyword: "乱铃" });
  runState.refinements.forEach((id) => buffs.push({ label: `炼蛊：${REFINEMENTS[id].name}`, title: REFINEMENTS[id].description, className: "refinement-status", keyword: "炼化" }));
  dom.buffList.innerHTML = buffs.length
    ? buffs.map((buff) => `<span class="buff-tag ${buff.className || ""}"${statusDetailAttr(buff.keyword || buff.label, getCombatBuffDetail(buff), buff.label)} title="${escapeAttribute(getCombatBuffDetail(buff))}">${buff.label}</span>`).join(" ")
    : '<span class="empty-buff">暂无蛊术加持</span>';
  dom.buffList.classList.remove("has-status-overflow");
  delete dom.buffList.dataset.overflowCount;
  renderMobileBuffRail(buffs);
}

function getMobileStatusSigil(buff) {
  const label = String(buff?.label || "状态");
  const statusName = label.split(/[：:]/, 1)[0].replace(/^(?:被动|命途契|炼蛊)$/, (name) => ({
    被动: "命",
    命途契: "契",
    炼蛊: "炼",
  })[name] || name);
  const keywordGlyphs = {
    命势: "命",
    铺垫: "缝",
    代偿: "偿",
    追毒: "追",
    借毒: "借",
    骨鸣: "骨",
    叩铃: "铃",
    毒性: "毒",
    易伤: "伤",
    毒刺: "刺",
    乱铃: "铃",
    炼化: "炼",
  };
  const glyph = keywordGlyphs[buff?.keyword] || statusName.slice(0, 2) || "态";
  const numbers = label.match(/\d+(?:\.\d+)?/g) || [];
  // V0.9.47：龙鳞进度「X/6」的手机角标要显示当前枚数 X（首数），而非上限 6（末数）——
  // 否则手机上龙鳞角标永远是 6、玩家看不出攒了几鳞，只能点开详情（玩家反馈"不想主动点击"）。
  const badge = buff?.keyword === "龙鳞" ? (numbers[0] || "0") : (numbers.at(-1) || "");
  return {
    glyph,
    badge,
    detailKey: label,
  };
}

function renderMobileBuffRail(buffs) {
  if (!dom.mobileBuffRail) return;
  const relicMarkup = typeof buildCombatRelicRailMarkup === "function"
    ? buildCombatRelicRailMarkup()
    : "";
  const statusMarkup = buffs.map((buff) => {
    const sigil = getMobileStatusSigil(buff);
    const detail = getCombatBuffDetail(buff);
    const content = `<span aria-hidden="true">${escapeAttribute(sigil.glyph)}</span>${sigil.badge ? `<strong aria-hidden="true">${escapeAttribute(sigil.badge)}</strong>` : ""}`;
    if (buff.action) {
      return `<button class="mobile-status-sigil ${buff.className || ""}" type="button" data-combat-status-action="${escapeAttribute(buff.action)}" aria-label="${escapeAttribute(buff.label)}" title="${escapeAttribute(detail)}">${content}</button>`;
    }
    return `<span class="mobile-status-sigil ${buff.className || ""}"${statusDetailAttr(buff.keyword || sigil.detailKey, detail, sigil.detailKey)} title="${escapeAttribute(detail)}">${content}</span>`;
  }).join("");
  const dragonReady = isDragonHero() && !game.dragon.transformed && game.dragon.scale >= DRAGON_BALANCE.scaleMax;
  const dragonAction = dragonReady
    ? `<button class="dragon-transform-action" type="button" aria-label="消耗${DRAGON_BALANCE.scaleMax}枚龙鳞，显露龙形"><span>化龙</span><strong>满鳞俱醒</strong></button>`
    : "";
  const relicCount = (runState?.relicId ? 1 : 0) + (runState?.ordinaryRelics || []).filter((id) => ORDINARY_RELICS[id]).length;
  const itemCount = relicCount + buffs.length + (dragonReady ? 1 : 0);
  const collapsed = dom.mobileBuffRail.classList.contains("is-collapsed");
  const railToggle = itemCount > 0
    ? `<button type="button" class="mobile-status-rail-toggle" data-mobile-status-toggle="1" data-status-count="${itemCount}" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? `展开遗物与状态，共 ${itemCount} 项` : "收起遗物与状态"}">${collapsed ? `状态 ${itemCount}` : "收"}</button>`
    : "";
  dom.mobileBuffRail.innerHTML = statusMarkup + relicMarkup + dragonAction + railToggle;
  dom.mobileBuffRail.classList.toggle("is-empty", buffs.length === 0 && !relicMarkup && !dragonAction);
}

function toggleCombatRelicOverflow(button) {
  if (!button) return;
  const rail = button.closest(".combat-relic-strip, .mobile-buff-rail");
  if (!rail) return;
  const expanded = !rail.classList.contains("is-expanded");
  rail.classList.toggle("is-expanded", expanded);
  button.setAttribute("aria-expanded", String(expanded));
  const hiddenCount = rail.querySelectorAll(".relic-overflow-chip").length;
  button.textContent = expanded ? "收" : `+${hiddenCount}`;
  button.setAttribute("aria-label", expanded ? "收起额外遗物" : `展开其余 ${hiddenCount} 件遗物`);
}

function getStatusOverflowCount(totalCount, visibleCount) {
  const total = Math.max(0, Number.isFinite(Number(totalCount)) ? Math.floor(Number(totalCount)) : 0);
  const visible = Math.max(0, Number.isFinite(Number(visibleCount)) ? Math.floor(Number(visibleCount)) : 0);
  return Math.max(0, total - visible);
}

function updateStatusScrollAffordance(list, totalCount) {
  if (!list) return;
  const update = () => {
    const children = Array.from(list.children).filter((child) => child.matches(".buff-tag, .enemy-status"));
    const visibleBottom = list.clientHeight;
    const visibleCount = children.filter((child) => child.offsetTop + child.offsetHeight <= visibleBottom + 1).length;
    const overflowCount = list.scrollHeight > list.clientHeight + 1
      ? getStatusOverflowCount(totalCount, visibleCount)
      : 0;
    list.classList.toggle("has-status-overflow", overflowCount > 0);
    if (overflowCount > 0) list.dataset.overflowCount = String(overflowCount);
    else delete list.dataset.overflowCount;
  };
  update();
  window.requestAnimationFrame?.(update);
}

function refreshStatusScrollAffordances() {
  if (dom?.enemyStatusList) updateStatusScrollAffordance(dom.enemyStatusList, dom.enemyStatusList.querySelectorAll(".enemy-status").length);
}

function renderTowerProgress() {
  if (game && game.isTowerMupan) {
    dom.towerProgress.innerHTML = '<span class="tower-node current tower-heart-node" aria-label="塔心最终战">心</span><span class="tower-floor-label">塔心终局<strong>万命母盘</strong></span>';
    return;
  }
  const floor = clampRouteStep(getCurrentRouteStep());
  const parts = getRouteSteps().map((number) => {
    const state = number < floor ? "completed" : number === floor ? "current" : "locked";
    const node = `<span class="tower-node ${state}" aria-label="第 ${number} 段${state === "completed" ? "已完成" : state === "current" ? "当前" : "未解锁"}">${state === "completed" ? "成" : number}</span>`;
    const link = number < getRouteMaxStep() ? `<i class="tower-link ${floor > number ? "completed" : ""}"></i>` : "";
    return `${node}${link}`;
  });
  dom.towerProgress.innerHTML = `${parts.join("")}<span class="tower-floor-label">命途图进度<strong>第 ${floor} 段 / 第 ${getRouteMaxStep()} 段</strong></span>`;
}

function getDeckStats() {
  const stats = { total: 0, attack: 0, defense: 0, utility: 0, blood: 0, poison: 0, upgraded: 0 };
  (runState?.deckCards || []).forEach((entry) => {
    const card = CARD_LIBRARY[entry.key];
    stats.total += 1;
    if (card.category === "attack") stats.attack += 1;
    if (card.category === "defense") stats.defense += 1;
    if (card.category === "utility") stats.utility += 1;
    if (card.type === "blood" || card.typeName.includes("血道")) stats.blood += 1;
    if (card.type === "poison" || card.typeName.includes("毒道")) stats.poison += 1;
    if (getUpgradeLevel(entry) > 0) stats.upgraded += 1;
  });
  return stats;
}

function getTemporaryMarks() {
  const marks = [];
  if (!runState) return marks;
  if (runState.nextBattleHpLoss > 0) marks.push({ kind: "cost", label: `毒血残留：下一场开局失去 ${runState.nextBattleHpLoss} 生命`, duration: "下一场战斗" });
  if (runState.nextBattleEnemyAttackBonus > 0) marks.push({ kind: "cost", label: `劫箱余祸：下一场敌人攻击 +${runState.nextBattleEnemyAttackBonus}`, duration: "下一场战斗" });
  if (runState.bloodMaxBonus > 0) marks.push({ kind: "benefit", label: `血灯烙印：血煞上限 +${runState.bloodMaxBonus}`, duration: "本局" });
  runState.deckCards.forEach((entry) => {
    if (entry.damageBonus > 0) marks.push({ kind: "card", label: `${CARD_LIBRARY[entry.key]?.name || "蛊牌"}伤害 +${entry.damageBonus}`, duration: "本局" });
  });
  if (game?.combatRelic?.greenPouchCardName) {
    marks.push({ kind: "benefit", label: `${game.combatRelic.greenPouchCardName}消耗 -1`, duration: "本场战斗" });
  }
  return marks;
}

function renderTemporaryMarksInventory() {
  const marks = getTemporaryMarks();
  if (!marks.length) return `<h3>命途印记</h3><p class="empty-inventory">本局尚无命途印记。</p>`;
  const sections = [
    ["benefit", "助益", "本局获得的正面效果"],
    ["cost", "代价", "本局或下一场战斗的负面效果"],
    ["card", "卡牌烙印", "单张蛊牌获得的强化"],
  ];
  return `<h3>命途印记</h3>${sections.map(([kind, title, hint]) => {
    const entries = marks.filter((mark) => mark.kind === kind);
    return `<section class="mark-group mark-${kind}"><header><strong>${title}</strong><small>${hint}</small></header>${entries.length
      ? `<div>${entries.map((mark) => `<span class="curse-chip"><strong>${mark.label}</strong><small>持续：${mark.duration}</small></span>`).join("")}</div>`
      : `<p class="empty-inventory">暂无${title}。</p>`}</section>`;
  }).join("")}`;
}

function paginateDeckCards(cards, page, pageSize = DECK_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const safePage = Math.max(0, Math.min(totalPages - 1, Number(page) || 0));
  return { page: safePage, totalPages, items: cards.slice(safePage * pageSize, (safePage + 1) * pageSize) };
}

function moveDeckCardByInstanceId(cards, sourceId, targetId) {
  const list = Array.isArray(cards) ? cards.slice() : [];
  const sourceIndex = list.findIndex((entry) => entry?.instanceId === sourceId);
  const originalTargetIndex = list.findIndex((entry) => entry?.instanceId === targetId);
  if (sourceIndex < 0 || originalTargetIndex < 0 || sourceIndex === originalTargetIndex) return list;
  const [source] = list.splice(sourceIndex, 1);
  const targetIndex = list.findIndex((entry) => entry?.instanceId === targetId);
  const insertionIndex = sourceIndex < originalTargetIndex ? targetIndex + 1 : targetIndex;
  list.splice(insertionIndex, 0, source);
  return list;
}

function clearDeckReorderGesture() {
  if (deckReorderGesture?.timer) window.clearTimeout(deckReorderGesture.timer);
  dom.deckList?.classList.remove("is-reordering");
  dom.deckList?.querySelectorAll(".is-drag-source,.is-drag-target").forEach((entry) => {
    entry.classList.remove("is-drag-source", "is-drag-target");
  });
  deckReorderGesture = null;
}

function beginDeckReorderGesture(event) {
  const entry = event.target?.closest?.("[data-deck-entry]");
  if (!entry || !runState || event.button > 0) return;
  clearDeckReorderGesture();
  const gesture = {
    pointerId: event.pointerId,
    sourceId: entry.dataset.deckEntry,
    targetId: entry.dataset.deckEntry,
    active: false,
    timer: null,
  };
  gesture.timer = window.setTimeout(() => {
    if (deckReorderGesture !== gesture) return;
    gesture.active = true;
    suppressDeckEntryClickUntil = Date.now() + 650;
    dom.deckList?.classList.add("is-reordering");
    entry.classList.add("is-drag-source");
    try { dom.deckList?.setPointerCapture?.(gesture.pointerId); } catch (e) { /* 老内核无需捕获 */ }
    try { navigator.vibrate?.(24); } catch (e) { /* 无振动能力时静默 */ }
  }, 430);
  deckReorderGesture = gesture;
}

function moveDeckReorderGesture(event) {
  const gesture = deckReorderGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (!gesture.active) {
    if ((event.buttons | 0) === 0) clearDeckReorderGesture();
    return;
  }
  event.preventDefault();
  const hit = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.("[data-deck-entry]");
  if (!hit || !dom.deckList?.contains(hit)) return;
  gesture.targetId = hit.dataset.deckEntry;
  dom.deckList.querySelectorAll(".is-drag-target").forEach((entry) => entry.classList.remove("is-drag-target"));
  if (gesture.targetId !== gesture.sourceId) hit.classList.add("is-drag-target");
}

function finishDeckReorderGesture(event) {
  const gesture = deckReorderGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const shouldMove = gesture.active && gesture.targetId && gesture.targetId !== gesture.sourceId;
  const sourceId = gesture.sourceId;
  const targetId = gesture.targetId;
  clearDeckReorderGesture();
  if (!shouldMove || !runState) return;
  runState.deckCards = moveDeckCardByInstanceId(runState.deckCards, sourceId, targetId);
  selectedDeckCardId = sourceId;
  saveRunStateToStorage();
  renderDeckOverlay();
  playUiSfx();
}

function renderDeckCardDetail(entry) {
  if (!dom.deckCardDetail) return;
  if (!entry) {
    dom.deckCardDetail.innerHTML = `<p class="empty-inventory">本页没有蛊牌。</p>`;
    return;
  }
  const badge = getPrimaryDeckBadge(entry);
  /* V0.9.51 玩家反馈「蛊虫详情注解不清晰」：此前局内只显示一行机械效果，
   * 而万蛊录同一只蛊备有一句话说明 / 相济 / 相克 / 来历。按 cardKey 反查图鉴补上，
   * 并给直达万蛊录的入口——局内看牌不必再靠记忆。图鉴查不到时静默降级为原版式。 */
  const codexItem = (typeof window !== "undefined" && Array.isArray(window.GU_CATALOG))
    ? window.GU_CATALOG.find((it) => it.cardKey === entry.key)
    : null;
  const noteRow = (label, value) => (value
    ? `<div class="deck-detail-note"><span>${escGu(label)}</span><i>${escGu(value)}</i></div>`
    : "");
  const codexHtml = codexItem
    ? `${codexItem.descriptionShort ? `<p class="deck-detail-short">${escGu(codexItem.descriptionShort)}</p>` : ""}
       ${noteRow("相济", codexItem.synergy)}${noteRow("相克", codexItem.counteredBy)}
       <button type="button" class="deck-detail-codex" data-deck-codex="${escGu(entry.key)}">查万蛊录全解 ›</button>`
    : "";
  dom.deckCardDetail.innerHTML = `
    <small>蛊牌详情</small>
    <h3>${getCompactCardTitle(entry)}</h3>
    ${renderCompactDeckMeta(entry)}
    <p>${wrapKeywords(withChinesePeriod(getCardEffectForEntry(entry)))}</p>
    <span class="deck-primary-badge ${badge.className}">${badge.text}</span>
    ${codexHtml}`;
}

function setDeckTab(tab) {
  const allowed = new Set(["cards", "materials", "relics", "marks", "stats"]);
  deckActiveTab = allowed.has(tab) ? tab : "cards";
  dom.deckTabs?.querySelectorAll("[data-deck-tab]").forEach((button) => {
    const selected = button.dataset.deckTab === deckActiveTab;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  dom.deckOverlay?.querySelectorAll("[data-deck-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.deckPanel === deckActiveTab);
  });
}

function renderDeckOverlay() {
  if (!runState) return;
  const stats = getDeckStats();
  const refinementText = runState.refinements.length
    ? runState.refinements.map((id) => REFINEMENTS[id].name).join("、")
    : "暂无炼蛊择变";
  dom.deckSummary.innerHTML = `
    <span>当前卡组总数 <strong>${stats.total}</strong></span>
    <span>已炼化 <strong>${stats.upgraded}</strong></span>
    <span>本命路线 <strong>${getBenmingPathDisplayName(runState)}</strong></span>
    ${(typeof getActiveContract === "function" && getActiveContract(runState)) ? `<span>命途契 <strong>${getActiveContract(runState).name}</strong></span>` : ""}
    <span>当前命途 <strong>第 ${clampRouteStep(getCurrentRouteStep())} 段</strong></span>
    <span>命途种子 <strong>${escGu(runState.trialSeed || "无")}</strong></span>
    <span>蛊石 <strong>${runState.guStones}</strong></span>
    <span>普通遗物 <strong>${runState.ordinaryRelics.length}</strong></span>
    <span>炼蛊强化 <strong>${refinementText}</strong></span>
    <span>整理蛊囊 <strong>长按拖动蛊牌</strong></span>`;
  dom.deckMaterials.innerHTML = `<h3>炼蛊材料</h3><div>${renderMaterialInventory()}</div>`;
  if (dom.deckRelics) dom.deckRelics.innerHTML = `<h3>遗物</h3><div>${renderRelicInventory()}</div>`;
  if (dom.deckMarks) dom.deckMarks.innerHTML = renderTemporaryMarksInventory();
  const page = paginateDeckCards(runState.deckCards, deckCardPage);
  deckCardPage = page.page;
  if (!page.items.some((entry) => entry.instanceId === selectedDeckCardId)) selectedDeckCardId = page.items[0]?.instanceId || "";
  dom.deckList.innerHTML = page.items.map((entry) => renderDeckEntryCard(entry, {
    button: true,
    action: "data-deck-entry",
    selected: entry.instanceId === selectedDeckCardId,
  })).join("");
  renderDeckCardDetail(runState.deckCards.find((entry) => entry.instanceId === selectedDeckCardId));
  if (dom.deckPageLabel) dom.deckPageLabel.textContent = `${page.page + 1} / ${page.totalPages}`;
  if (dom.deckPrevPage) dom.deckPrevPage.disabled = page.page <= 0;
  if (dom.deckNextPage) dom.deckNextPage.disabled = page.page >= page.totalPages - 1;
  setDeckTab(deckActiveTab);
}

function openDeckOverlay() {
  if (!runState || !dom.deckOverlay) return;
  deckActiveTab = "cards";
  deckCardPage = 0;
  selectedDeckCardId = runState.deckCards[0]?.instanceId || "";
  renderDeckOverlay();
  dom.deckOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeDeckOverlay() {
  dom.deckOverlay?.classList.add("hidden");
  refreshModalLock();
}

function getEnemyDamageSummary(enemy) {
  const actions = Object.values(enemy.actions || {});
  const damages = actions
    .flatMap((action) => [action.damage, action.baseDamage, action.secondDamage].filter((value) => Number(value) > 0))
    .map(Number);
  if (!damages.length) return "特殊行动";
  return `${Math.min(...damages)}-${Math.max(...damages)}`;
}

function getBalanceSummaryText() {
  const heroLines = Object.values(HEROES).map((hero) => `${hero.name}：生命 ${hero.maxHp}，真元 ${hero.energy}，寿元 ${hero.lifespan}`);
  const enemyLines = Object.values(ENEMY_LIBRARY).map((enemy) => `${enemy.name}：生命 ${Number(enemy.maxHp) || 0}，伤害 ${getEnemyDamageSummary(enemy)}`);
  const shopLines = [
    "买卡：12 蛊石",
    "治疗：9 蛊石 / 14 生命",
    "移除：18 蛊石",
    "随机材料：11 蛊石",
    "蛊坊残契：首次交易 7 折",
  ];
  const furnaceLines = [
    "材料契合：稳定 70% / 异变 20% / 反噬 10%",
    "材料相冲：稳定 50% / 异变 25% / 反噬 25%",
    "残魂入炉：稳定 40% / 异变 40% / 反噬 20%",
  ];
  return [
    "《逆命蛊途》平衡摘要",
    "",
    "主角基础属性",
    ...heroLines,
    "",
    "敌人生命与伤害",
    ...enemyLines,
    "",
    "蛊坊价格",
    ...shopLines,
    "",
    "炼蛊概率",
    ...furnaceLines,
    "",
    `当前卡牌数量：${Object.keys(CARD_LIBRARY).length}`,
    `当前遗物数量：${Object.keys(RELICS).length + Object.keys(ORDINARY_RELICS).length}`,
    `当前事件数量：${CHANCE_EVENTS.length}`,
    `当前敌人数量：${Object.keys(ENEMY_LIBRARY).length}`,
  ].join("\n");
}

function renderBalanceOverlay() {
  if (!dom.balanceSummary) return;
  dom.balanceSummary.innerHTML = getBalanceSummaryText()
    .split("\n\n")
    .map((block) => `<pre>${escapeAttribute(block)}</pre>`)
    .join("");
}

function openBalanceOverlay() {
  if (!dom.balanceOverlay || trialMode !== "balance") return;
  renderBalanceOverlay();
  dom.balanceOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeBalanceOverlay() {
  dom.balanceOverlay?.classList.add("hidden");
  refreshModalLock();
}

async function copyBalanceSummary() {
  const text = getBalanceSummaryText();
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(text);
    if (dom.runProgress) dom.runProgress.textContent = "平衡摘要已复制。";
  } catch (error) {
    console.warn("[平衡摘要复制失败]", error);
    if (dom.runProgress) dom.runProgress.textContent = "当前浏览器未开放剪贴板。";
  }
}

/* ===================================================================
 * V0.9.6.1 敌人状态说明：复用玩家那套 keyword tooltip（#keywordTooltip）。
 * 思路：扩 KEYWORD_HELP 增补“敌人侧”关键词；renderEnemyStatuses 里每个
 * 状态 span 用 enemyStatusAttr() 输出 data-keyword（命中则走统一 tooltip），
 * 命不中时回退到原 title。全局 pointerover/focusin/click/长按监听已覆盖
 * [data-keyword]（见 jsEdits 的长按补丁），桌面悬停/点击、手机长按/点击皆可看。
 * 无专属文案的状态：至少给“名 + 基础效果”兜底，Console 不报错。
 * =================================================================== */

/* 敌人状态说明（与玩家共用 KEYWORD_HELP；这里补敌人侧词条） */
const ENEMY_STATUS_HELP = {
  尸盘压毒: "毒性超过 12 层时，敌方回合结束清除 3 层毒性。",
  尸盘转轮: "生命过半后进入二阶，攻击与蓄势增强。",
  塔压: "此战敌人生命略微提高。",
  狂怒: "生命低于阈值后进入狂怒，攻击力提升。",
  自损: "以割伤自身换取更高伤害；你血量越低它越亢奋。",
  吸血: "命中后回复等量生命，续战不退。",
  蓄势: "本回合蓄力，下次攻击附加额外伤害。",
  护体: "覆一层血衣/护甲，先抵挡伤害后清零。",
  毒抗: "对毒性有抗性：每次施毒最多抵去 2 层；青蟒触发蚀毒可逐步降低本场有效毒抗。",
  转毒: "自身毒性达阈值且冷却完毕时，吐出部分毒性反施给你（你的毒有上限，不会无限叠加），自身毒减半。",
  吐毒: "自身毒性达阈值时，吐出部分毒性反施给你，自身毒减半。",
  吞毒: "毒性达阈值后，下一次行动改为吞下固定层数并回复生命；它会放弃攻击，超过阈值的毒仍会发作。",
  凝甲蚀毒: "获得护甲时清除自身部分毒性。",
  蓄力: "正在蓄力重击；本玩家回合对它打出足够伤害可打断。",
  瘴母苏醒: "生命过半后进入二阶，瘴毒更猛、杀意暴涨。",
  血衣覆身: "生命过半后进入二阶，血债加倍、吸血压迫更强。",
  蜂群: "蜂群每回合孵化叠加，按层数附加攻击伤害；对它造成伤害可压下一层。",
  执令: "已种下执令印记，下一次攻击额外加重伤害。",
  抢攻: "本玩家回合出牌过多会激怒它，该回合攻击额外加重；克制可控制出牌节奏。",
  骨甲强化: "自身带护甲时攻击额外加重；破甲后削弱。",
  骨巢开裂: "生命过半后进入二阶，叠甲、重击与蓄力连绵增强。",
  蜂群暴动: "生命过半后进入二阶，蜂群拉满、毒刺与多段齐发。",
  毒刺: "每回合开始固定受到等同层数的伤害，不衰减；击败施加者方可解除。",
  乱铃: "乱铃缠耳，下一回合补牌数减少（保底抽 1 张）。",
};
const ECOLOGY_TAG_LABELS = Object.freeze({
  bloodFeeder: "血食",
  decay: "腐生",
  armor: "甲壳",
  swarm: "虫群",
  corpse: "尸傀",
});
const ECOLOGY_TAG_DETAILS = Object.freeze({
  bloodFeeder: "以鲜血或生命为食。赤汐蛊实际吞煞后，本回合首次对其触发生态相克增伤。",
  decay: "依腐肉、瘴泥或朽败生机而存。燃命蝎实际焚寿后，本回合首次对其触发生态相克增伤。",
  armor: "外覆甲壳、骨甲或硬质躯壳。沧桑龟本回合首次对其触发生态相克并蚀去防御。",
  swarm: "以群体繁衍、协同行动形成威胁。当前仅公开标签，后续生态蛊将继续接入。",
  corpse: "无自然寿数的尸身或傀偶。免疫沧桑龟新增的衰老，但已有其他衰老规则照常结算。",
});

/* 生成局内状态详情属性：优先使用调用方传入的精确动态说明，
 * 缺失时再回退词典；同时补齐键盘聚焦和按钮语义。 */
function statusDetailAttr(keyword, fallback, displayTitle = keyword) {
  const text = fallback || KEYWORD_HELP[keyword] || ENEMY_STATUS_HELP[keyword] || `${keyword}：敌方状态。`;
  return ` data-keyword="${escapeAttribute(keyword)}" data-status-title="${escapeAttribute(displayTitle)}" data-status-detail="${escapeAttribute(text)}" tabindex="0" role="button" aria-label="${escapeAttribute(`${displayTitle}：${text}`)}"`;
}

function enemyStatusAttr(keyword, fallback, displayTitle = keyword) {
  return statusDetailAttr(keyword, fallback, displayTitle);
}

function renderEnemyStatuses() {
  const statuses = [];
  if (isMupanBattle()) {
    const phaseName = ["", "试探", "双轮", "逼命"][game.mupan.core.phase] || "试探";
    const phaseDetail = ({
      试探: "一阶段：母盘照见你最常用的出牌习惯，并据此发动追击；生命降至七成后转入双轮。",
      双轮: "二阶段：母盘的追击与计划攻击同时施压；生命降至三成五后转入逼命。",
      逼命: "三阶段：逼命倒数持续推进；归零时发动灭命重击，直至盘心断裂。",
    })[phaseName] || "万命母盘当前阶段。";
    statuses.push(`<span class="enemy-status enemy-boss-phase"${enemyStatusAttr("母盘阶段", phaseDetail, `母盘阶段：${phaseName}`)}>${phaseName}</span>`);
    if (game.mupan.exposureActive) statuses.push(`<span class="enemy-status enemy-charge-status"${enemyStatusAttr("盘心暴露", "你上一回合避开了母盘照见的习惯。本玩家回合母盘受到的伤害提高 35%，回合结束后消失。", "盘心暴露：承伤 +35%")}>盘心暴露 · 承伤 +35%</span>`);
  }
  if (game.enemy.id === "corpsepuppet") {
    statuses.push(`<span class="enemy-status enemy-boss-passive"${enemyStatusAttr("尸盘压毒")}>尸盘压毒</span>`);
    if (game.enemy.phase2) {
      statuses.push(`<span class="enemy-status enemy-boss-phase"${enemyStatusAttr("尸盘转轮")}>尸盘转轮</span>`);
    }
  }
  /* 第二层敌人狂怒相位（V0.9.6 enrage）可查询：改读 def.enrage 阈值即时判定，并同步 enraged/enrageName 供日志/显示一致。 */
  const def = game.enemy.definition;
  const ecologyTags = Array.isArray(def.ecologyTags) ? def.ecologyTags.filter((tag) => ECOLOGY_TAG_LABELS[tag]) : [];
  ecologyTags.forEach((tag) => {
    const label = ECOLOGY_TAG_LABELS[tag];
    statuses.push(`<span class="enemy-status enemy-ecology-status"${enemyStatusAttr(`生态·${label}`, ECOLOGY_TAG_DETAILS[tag], `生态标签：${label}`)}>生态·${label}</span>`);
  });
  const enrageActive = Boolean(def.enrage) && game.enemy.hp <= game.enemy.maxHp * def.enrage.threshold && game.enemy.hp > 0;
  game.enemy.enraged = enrageActive;
  game.enemy.enrageName = enrageActive ? (def.enrage.name || "狂怒") : "";
  if (enrageActive) {
    const enrageLabel = def.enrage.name || "狂怒";
    const enrageBonus = Math.max(0, Number(def.enrage.attackBonus) || 0);
    const enrageThreshold = Math.round((Number(def.enrage.threshold) || 0) * 100);
    statuses.push(`<span class="enemy-status enemy-enrage-status"${enemyStatusAttr(enrageLabel, `生命降至最大生命的 ${enrageThreshold}% 后触发；每次攻击行动总伤害 +${enrageBonus}，本场持续。`, `${enrageLabel}：攻击 +${enrageBonus}`)}>${enrageLabel} <strong>+${enrageBonus}</strong></span>`);
  }
  /* 二层半血相位标记（瘴母苏醒 / 血衣覆身） */
  if (game.enemy.phase2 && def.isBoss) {
    if (game.enemy.id === "miasmaMotherBoss") statuses.push(`<span class="enemy-status enemy-boss-phase"${enemyStatusAttr("瘴母苏醒")}>瘴母苏醒</span>`);
    else if (game.enemy.id === "bloodRobeMotherBoss") statuses.push(`<span class="enemy-status enemy-boss-phase"${enemyStatusAttr("血衣覆身")}>血衣覆身</span>`);
  }
  /* 二层敌人机制标记（毒抗/转毒/吞毒/吸血/自损/蓄力），按 def/action 推送，全部接 tooltip。 */
  if (def.poisonResist > 0) {
    const basePct = Math.round(def.poisonResist * 100);
    const shredPct = Math.round((game.enemy.poisonResistShred || 0) * 100);
    const effectivePct = Math.max(0, basePct - shredPct);
    statuses.push(`<span class="enemy-status"${enemyStatusAttr("毒抗", `每次施毒按 ${effectivePct}% 抵抗，但至多抵去 2 层；青蟒触发蚀毒可逐步破抗，单场最多降低 15%。`, `毒抗：${effectivePct}%${shredPct ? `（已破 ${shredPct}%）` : ""}`)}>毒抗 ${effectivePct}%${shredPct ? ` ↓${shredPct}%` : ""}</span>`);
  }
  if (def.poisonSwallow) {
    const sw = def.poisonSwallow;
    const armed = game.enemy.poisonSwallowArmed;
    statuses.push(`<span class="enemy-status${armed ? " enemy-charge-status" : ""}"${enemyStatusAttr("吞毒", `毒性达到 ${sw.threshold} 层后，下一次行动改为吞噬 ${sw.threshold} 层、回复至多 ${sw.heal} 点生命并放弃攻击；超过阈值的毒会保留。`, `吞毒：${sw.threshold} 层${armed ? " · 已准备" : ""}`)}>吞毒 ${sw.threshold}${armed ? " · 已准备" : ""}</span>`);
  }
  if (def.poisonConvert) {
    const cv = def.poisonConvert;
    const remaining = cv.cooldown && game.enemy.lastConvertTurn != null ? Math.max(0, cv.cooldown - (game.turn - game.enemy.lastConvertTurn)) : 0;
    statuses.push(`<span class="enemy-status"${enemyStatusAttr("转毒", `自身毒达到 ${cv.threshold} 层时减半，并向你施加至多 ${cv.give} 层毒；冷却 ${cv.cooldown || 0} 回合。`, `转毒：阈值 ${cv.threshold}${remaining ? ` · 冷却 ${remaining}` : ""}`)}>转毒 ${cv.threshold}${remaining ? ` · 冷却${remaining}` : ""}</span>`);
  }
  if (def.blockPurge) statuses.push(`<span class="enemy-status"${enemyStatusAttr("凝甲蚀毒", "获甲时清除自身部分毒性。")}>凝甲蚀毒</span>`);
  if (enemyHasActionFlag("lifesteal")) statuses.push(`<span class="enemy-status"${enemyStatusAttr("吸血")}>吸血</span>`);
  if (enemyHasActionFlag("selfBleed")) statuses.push(`<span class="enemy-status"${enemyStatusAttr("自损")}>自损</span>`);
  if (game.enemy.charging) {
    const thr = game.enemy.currentInterruptThreshold || 0;
    const chargeLabel = thr > 0 ? `蓄力·受 ${thr} 伤可打断` : "蓄力";
    statuses.push(`<span class="enemy-status enemy-charge-status"${enemyStatusAttr("蓄力", thr > 0 ? `正在蓄力重击；本玩家回合对它累计造成 ${thr} 点伤害可打断，回合结束前未打断则释放。` : undefined, chargeLabel)}>${chargeLabel}</span>`);
  }
  // V0.9.8 三层新机制状态显示
  if ((game.enemy.swarmStack || 0) > 0) statuses.push(`<span class="enemy-status"${enemyStatusAttr("蜂群", undefined, `蜂群：${game.enemy.swarmStack} 层`)}>蜂群 <strong>${game.enemy.swarmStack}</strong></span>`);
  if ((game.enemy.commanderEffect || 0) > 0) {
    const commandBonus = game.enemy.commanderEffect;
    statuses.push(`<span class="enemy-status"${enemyStatusAttr("执令", `下一次攻击行动总伤害 +${commandBonus}，生效一次后清除。`, `执令：下次攻击 +${commandBonus}`)}>执令 <strong>+${commandBonus}</strong></span>`);
  }
  if (def.def && def.def.hasCounterAttack) statuses.push(`<span class="enemy-status enemy-charge-status"${enemyStatusAttr("抢攻", `本玩家回合出牌超过 ${def.def.counterAttackThreshold || 4} 张，敌方该次攻击额外 +${def.def.counterDamage || 8}；敌方行动后重新计数。`, `抢攻：出牌 >${def.def.counterAttackThreshold || 4} 触发`)}>抢攻·出牌>${def.def.counterAttackThreshold || 4}触发</span>`);
  if (game.enemy.phase2 && def.isBoss && game.enemy.id === "boneNestGuardianBoss") statuses.push(`<span class="enemy-status enemy-boss-phase"${enemyStatusAttr("骨巢开裂")}>骨巢开裂</span>`);
  if (game.enemy.phase2 && def.isBoss && game.enemy.id === "calamityQueenBoss") statuses.push(`<span class="enemy-status enemy-boss-phase"${enemyStatusAttr("蜂群暴动")}>蜂群暴动</span>`);
  if (game.enemy.towerPressure) {
    const pressurePercent = Math.max(0, Number(game.enemy.towerPressurePercent) || 0);
    statuses.push(`<span class="enemy-status"${enemyStatusAttr("塔压", `路线压力使本场敌人最大生命提高 ${pressurePercent}%；进入战斗时已经计入。`, `塔压：最大生命 +${pressurePercent}%`)}>塔压 <strong>+${pressurePercent}%</strong></span>`);
  }
  if ((game.enemy.armor || 0) > 0) statuses.push(`<span class="enemy-status enemy-armor-status"${enemyStatusAttr("防御", "受到伤害时优先抵挡，抵挡后按实际伤害扣减；未耗尽的防御会保留。", `防御：${game.enemy.armor}`)}>防御 <strong>${game.enemy.armor}</strong></span>`);
  if (game.enemy.poison > 0) statuses.push(`<span class="enemy-status enemy-poison-status"${enemyStatusAttr("毒性", "敌方回合结束后受到等同层数的伤害，随后衰减 1 层。", `毒性：${game.enemy.poison} 层`)}>毒性 <strong>${game.enemy.poison}</strong></span>`);
  if ((game.enemy.weaken || 0) > 0) statuses.push(`<span class="enemy-status enemy-weaken-status"${enemyStatusAttr("衰老", "桑田蛊施加：敌人每次攻击意图永久降低，可叠加，本场持续。", `衰老：攻击 -${game.enemy.weaken}`)}>衰老 <strong>${game.enemy.weaken}</strong></span>`);
  dom.enemyStatusList.innerHTML = statuses.join("");
  if (typeof updateStatusScrollAffordance === "function") updateStatusScrollAffordance(dom.enemyStatusList, statuses.length);
  if (game.pendingEnemyPoisonPulse) {
    game.pendingEnemyPoisonPulse = false;
    pulseElement(dom.enemyStatusList.querySelector(".enemy-poison-status") || dom.enemyStatusList, "status-bounce", 420);
  }
}

function renderMupanThreatPanel() {
  if (!dom.mupanSealPanel) return;
  dom.intentBox?.classList.toggle("mupan-active", isMupanBattle());
  if (!isMupanBattle()) {
    dom.mupanSealPanel.classList.add("hidden");
    dom.mupanSealPanel.innerHTML = "";
    return;
  }
  const phase = game.mupan.core.phase || 1;
  const phaseName = ({ 1: "一阶段 · 试探", 2: "二阶段 · 双轮", 3: "三阶段 · 逼命" })[phase] || "一阶段 · 试探";
  const habit = MUPAN_DEBT_DEFINITIONS[game.mupan.core.watchedHabitId] || MUPAN_DEBT_DEFINITIONS.haste;
  const pursuit = getMupanPursuitAttack(game.mupan, ENEMY_BALANCE.mupan);
  const damage = getMupanActionDamage(pursuit);
  const pursuitText = damage.hits > 1 ? `${damage.perHit}×${damage.hits}（共 ${damage.total}）` : `${damage.total}`;
  const countdown = phase === 3
    ? `<div class="mupan-threat-countdown"><span>灭命倒计时</span><strong>${game.mupan.finalCountdown}</strong><small>剩余延缓 ${Math.max(0, 2 - (game.mupan.finalExtensionsUsed || 0))} 次</small></div>`
    : "";
  dom.mupanSealPanel.classList.remove("hidden");
  dom.mupanSealPanel.innerHTML = `<div class="mupan-threat-head"><span>${phaseName}</span><b>当前看穿：${habit.name}</b></div>
    <div class="mupan-threat-grid">
      <div><small>触发条件</small><strong>${habit.triggerText}</strong></div>
      <div><small>触发追击</small><strong>${pursuit.name} · ${pursuitText} 伤害</strong></div>
      <div><small>避开追击</small><strong>下一回合母盘承受伤害 +35%；结束回合后仍会施展上方技能</strong></div>
      ${countdown}
    </div>`;
}

function getIntentSummary(action) {
  const source = action || {};
  const name = source.name || "未明意图";
  const damage = Math.max(0, Number(source.damage ?? source.baseDamage) || 0);
  const hits = Math.max(1, Number(source.hits) || 1);
  if (damage > 0) return hits > 1 ? `${name}｜${damage}×${hits}伤害` : `${name}｜${damage}伤害`;
  const block = Math.max(0, Number(source.block ?? source.armor) || 0);
  if (block > 0) return `${name}｜${block}护甲`;
  if (source.lifespanDamage) return `${name}｜${Number(source.lifespanDamage)}寿元`;
  return `${name}｜特殊效果`;
}

function setIntentCollapsed(collapsed) {
  const mobileLockedOpen = document.body.classList.contains("mobile-combat-safe");
  intentCollapsed = Boolean(collapsed) && !mobileLockedOpen;
  dom.battleIntentRegion?.classList.toggle("is-collapsed", intentCollapsed);
  dom.intentCollapseButton?.setAttribute("aria-expanded", String(!intentCollapsed));
  if (dom.intentCollapseButton) {
    dom.intentCollapseButton.textContent = intentCollapsed ? "⌄" : "⌃";
    dom.intentCollapseButton.setAttribute("aria-label", intentCollapsed ? "展开敌方意图" : "收起敌方意图");
  }
}

function renderEnemyCriticalMetrics() {
  if (!dom.enemyCriticalMetrics || !game?.enemy) return;
  const def = game.enemy.definition?.def || game.enemy.definition || {};
  const metrics = [];
  const armor = Math.max(0, Number(game.enemy.armor) || 0);
  if (armor > 0) {
    metrics.push(`<span class="enemy-critical-metric enemy-armor-metric"${statusDetailAttr("防御", "敌方当前护甲；受到伤害时会优先抵挡。")}>甲 ${armor}</span>`);
  }
  const chargedBonus = Math.max(0, Number(game.enemy.chargedBonus) || 0);
  if (chargedBonus > 0) {
    metrics.push(`<span class="enemy-critical-metric enemy-charge-bonus-metric"${statusDetailAttr("蓄势", "已经积蓄的额外伤害，会计入下一次攻击。")}>蓄势 +${chargedBonus}</span>`);
  }
  if (def.hasCounterAttack) {
    const threshold = Math.max(1, Number(def.counterAttackThreshold) || 4);
    const triggerAt = threshold + 1;
    const played = Math.max(0, Number(game.cardsPlayedThisTurn) || 0);
    const remaining = Math.max(0, triggerAt - played);
    const text = played >= triggerAt
      ? `抢攻 已触发（第${triggerAt}张）`
      : `抢攻 ${played}/${threshold} · 再出${remaining}张触发（第${triggerAt}张）`;
    metrics.push(`<span class="enemy-critical-metric enemy-counter-metric"${statusDetailAttr("抢攻", "本回合出牌超过阈值后，敌方本次攻击会获得额外伤害。")}>${text}</span>`);
  }
  const interrupt = Math.max(0, Number(game.enemy.currentInterruptThreshold) || 0);
  if (game.enemy.charging && interrupt > 0) {
    metrics.push(`<span class="enemy-critical-metric enemy-interrupt-metric"${statusDetailAttr("蓄力", `本回合累计造成 ${interrupt} 点伤害即可打断。`)}>蓄力 · ${interrupt} 伤打断</span>`);
  }
  dom.enemyCriticalMetrics.innerHTML = metrics.join("");
  dom.enemyCriticalMetrics.classList.toggle("hidden", !metrics.length);
}

/* V0.9.51 用户定调：意图「详」按钮多此一举（很少有玩家点、还耽误时间）——按钮已删。
 * 完整说明保留在 ENEMY_STATUS_HELP 词典（意图名本身仍可点按/长按查词，走既有 keyword 管线）。 */
function updateIntentDetailAccess(action) {
  if (!action) return;
  const keyword = `意图·${action.name}`;
  const parts = [
    dom.intentDescription?.textContent?.trim(),
    dom.intentBox?.querySelector(".intent-net-damage:not(.hidden)")?.textContent?.trim(),
    dom.enemyCriticalMetrics?.textContent?.trim(),
  ].filter(Boolean);
  ENEMY_STATUS_HELP[keyword] = parts.join("；") || "敌人将在你结束回合后施展此招。";
}

function renderIntent() {
  const action = getCurrentEnemyAction();
  /* V0.9.57 玩家实报：「敌人的攻击不是像我们一样丢卡牌，而只是在上面显示一段文字，这些教程都没讲」。
   * 教程第 2 页其实写着「敌人意图会提前显示：能守就守，能斩就抢」——问题不在没写，
   * 在于它躺在开局那一次性弹窗里，玩家读时还没见过意图牌，读完就忘。改到他第一次真看见时讲。 */
  if (game?.status === "playing") {
    showCoachTip("firstIntent", "敌人不出牌：它下一步要干什么，提前写在这块「意图」上——打多少、叠多少甲、上什么状态，你结束回合前就全看得见。所以先看意图再决定：挡得住就叠防御，斩得掉就抢输出。");
  }
  let intentSummary = getIntentSummary(action);
  dom.intentBox.title = `敌人将在你结束回合后施展「${action.name}」。`;
  dom.intentIcon.textContent = action.icon;
  dom.intentName.textContent = action.name;
  if (isMupanBattle()) {
    const damage = getMupanActionDamage(action);
    const segmentText = damage.hits > 1 ? `${damage.segments.join(" + ")}，共 ${damage.total}` : `${damage.total}`;
    const extras = [];
    if (damage.hits > 1) extras.push(`${damage.hits} 次连击`);
    if (action.mupanRewritten) extras.push("夺息刻：下回合真元恢复 -1");
    dom.intentDescription.innerHTML = emphasizeCombatHtml(`将造成 ${segmentText} 点伤害${extras.length ? `（${extras.join("；")}）` : ""}`);
    intentSummary = damage.hits > 1 ? `${action.name}｜${damage.total}总伤害` : `${action.name}｜${damage.total}伤害`;
    updateIntentThreat(Math.max(0, damage.total - (game.player.armor || 0)));
  } else if (action.kind === "poisonSwallow") {
    const currentPoison = Math.max(0, Number(game.enemy.poison) || 0);
    const overflow = Math.max(0, currentPoison - action.threshold);
    dom.intentDescription.innerHTML = emphasizeCombatHtml(`吞噬 ${action.threshold} 层毒性，回复至多 ${action.heal} 点生命；余下 ${overflow} 层继续发作，本回合不攻击。`);
    intentSummary = `${action.name}｜吞 ${action.threshold} 毒·不攻击`;
    updateIntentThreat(0);
  } else if (action.kind === "charge") {
    const chargeExtras = [];
    if (action.lifesteal) chargeExtras.push(`吸血 ${action.lifesteal}`);
    if (action.selfBleed) chargeExtras.push(`自损 ${action.selfBleed}`);
    if (action.interruptThreshold) chargeExtras.push(`受 ${action.interruptThreshold} 伤可打断`);
    const chargeArmorText = action.armor
      ? `，获得 ${action.armor} 防御${action.armorCap ? `（上限 ${action.armorCap}）` : ""}`
      : "";
    dom.intentDescription.innerHTML = emphasizeCombatHtml(`本回合不攻击；下一次攻击 +${action.bonus}${chargeArmorText}${chargeExtras.length ? `（本回合${chargeExtras.join("，")}）` : ""}`);
    intentSummary = action.armor ? `${action.name}｜${action.armor}护甲` : `${action.name}｜蓄势`;
    // FUNNEL-1 coach：首次见到可打断的蓄力，就地教打断
    if (action.interruptThreshold && game.status === "playing") {
      showCoachTip("chargeInterrupt", `敌人在蓄力：本回合对它造成 ${action.interruptThreshold} 点伤害就能打断这次重击；打不出就叠护甲硬接。`);
    }
    updateIntentThreat(0);
  } else if (action.kind === "defend" && !(Number(action.damage) > 0)) {
    /* 玩家实测「提线自护 · 将造成 NaN 点伤害」：纯防御意图（kind:"defend"、只有 block、没有 damage）
     * 此前掉进下面的通用攻击分支，Math.round(undefined * …) 直接算出 NaN 摆在脸上。
     * 全库共 7 个纯防御意图，个个中招。这里给它们自己的分支，照实说「叠甲不攻击」。
     * 注意条件带 damage>0 判断：将来若出现「又叠甲又打人」的防御意图，仍走下面的伤害分支，不会被这里吞掉。 */
    const defendExtras = [];
    if (action.heal) defendExtras.push(`回复 ${action.heal} 点生命`);
    if (action.lifesteal) defendExtras.push(`吸血 ${action.lifesteal}`);
    if (action.playerPoison) defendExtras.push(`施加 ${action.playerPoison} 层毒性`);
    if (action.applyVulnerable) defendExtras.push(`施易伤 ${action.applyVulnerable}`);
    if ((game.enemy.definition.poisonResist || 0) > 0) {
      const effectiveResist = Math.max(0, game.enemy.definition.poisonResist - (game.enemy.poisonResistShred || 0));
      defendExtras.push(`${Math.round(effectiveResist * 100)}% 有效毒抗`);
    }
    const blockValue = Math.max(0, Number(action.block) || 0);
    dom.intentDescription.innerHTML = emphasizeCombatHtml(
      `本回合不攻击${blockValue > 0 ? `，自身获得 ${blockValue} 点防御` : ""}${defendExtras.length ? `（${defendExtras.join("，")}）` : ""}`,
    );
    intentSummary = blockValue > 0 ? `${action.name}｜自叠${blockValue}甲` : `${action.name}｜自护`;
    updateIntentThreat(0);
  } else {
    const hitCount = action.hits || 1;
    const lowHpBonus = action.lowHpExtra && game.player.hp < game.player.maxHp / 2 ? action.lowHpExtra : 0;
    const enrageBonus = game.enemy.definition.enrage && game.enemy.hp <= game.enemy.maxHp * game.enemy.definition.enrage.threshold
      ? game.enemy.definition.enrage.attackBonus
      : 0;
    const routeBonus = game.enemyAttackBonus || 0;
    // V0.9.8 三层机制附加（与 resolveEnemyTurn mechBonus 同口径：骨甲/蜂群/执令为确定性加伤，计入净伤预估；抢攻取决于本回合出牌数，仅条件预警不直接计入避免误报）。
    const ed = game.enemy.definition.def || {};
    let mechBonus = 0;
    const boneArmorAdd = (game.enemy.armor || 0) > 0 && ed.boneArmorBonus ? ed.boneArmorBonus : 0;
    const swarmAdd = ed.hasSwarmMechanic ? ((game.enemy.swarmStack || 0) + 1) * (ed.swarmDamagePerLayer || 2) : 0;
    const commanderAdd = (game.enemy.commanderEffect || 0) > 0 ? game.enemy.commanderEffect : 0;
    mechBonus = boneArmorAdd + swarmAdd + commanderAdd;
    // V0.9.12.1 修复：易伤 ×1.5 此前未计入意图预报，面板低报伤害误导玩家留甲。
    // 与 resolveEnemyTurn 同口径：基础段（含蓄势/追魂/狂怒/岔路）先 ×1.5 向上取整，mechBonus 之后平加。
    // 兜底：任何意图缺 damage 都按 0 算，绝不让 NaN 流到面板（玩家实测见过「将造成 NaN 点伤害」）。
    const baseDamage = Number(action.damage) || 0;
    let baseTotal = Math.round(baseDamage * hitCount * (game.enemyAttackMultiplier || 1)) + game.enemy.chargedBonus + lowHpBonus + enrageBonus + routeBonus;
    const vulnerablePreview = (game.player.vulnerable || 0) > 0 && baseTotal > 0;
    if (vulnerablePreview) baseTotal = Math.ceil(baseTotal * 1.5);
    const rawTotal = baseTotal + mechBonus;
    // V0.9.9 寿道·子批3：桑田·衰老平减（与 resolveEnemyTurn 同口径），面板直接显示削后伤害。
    const weakenCut = Math.min(rawTotal, game.enemy.weaken || 0);
    const totalDamage = Math.max(0, rawTotal - weakenCut);
    const extras = [];
    if (hitCount > 1) extras.push(`${hitCount} 次连击`);
    if (vulnerablePreview) extras.push("易伤 ×1.5");
    if (game.enemy.chargedBonus > 0) extras.push("蓄势已计入");
    if (lowHpBonus > 0) extras.push(`追魂 +${lowHpBonus}`);
    if (enrageBonus > 0) extras.push((game.enemy.definition.enrage && game.enemy.definition.enrage.name) || "狂怒");
    if (routeBonus > 0) extras.push(`岔路恶果 +${routeBonus}`);
    if (boneArmorAdd > 0) extras.push(`骨甲强化 +${boneArmorAdd}`);
    if (swarmAdd > 0) extras.push(`蜂群 +${swarmAdd}`);
    if (commanderAdd > 0) extras.push(`执令 +${commanderAdd}`);
    if (weakenCut > 0) extras.push(`衰老 -${weakenCut}`);
    if (ed.hasCounterAttack) extras.push(`出牌>${ed.counterAttackThreshold || 4}则抢攻 +${ed.counterDamage || 8}`);
    if (action.lifespanDamage) extras.push(`另损 ${action.lifespanDamage} 寿元`);
    if (action.energyDrain) extras.push(`下回合少 ${action.energyDrain} 真元`);
    if (action.playerPoison) extras.push(`施加 ${action.playerPoison} 层毒性`);
    if (action.playerPoisonSting) extras.push(`刺入 ${action.playerPoisonSting} 毒刺`);
    if (action.disorientBell) extras.push(`乱铃：下回合抽牌 -${action.disorientBell}`);
    if (action.lifesteal) extras.push(`吸血 ${action.lifesteal}`);
    // V0.9.27 破防易伤预告：本有甲、且此击总伤严格打穿(> 护甲，与 resolveEnemyTurn received>0 同口径)→提示破防叠易伤。
    // 注意：ed 本身已是 definition.def（12383 行），breakVuln 直接从 ed 取，勿再 .def（否则恒 undefined、精英配 2 也只显示 1）。
    if ((game.player.armor || 0) > 0 && totalDamage > (game.player.armor || 0)) {
      extras.push(`破甲则易伤 +${Number(ed.breakVuln) || 1}`);
    }
    if (action.selfBleed) extras.push(`自损 ${action.selfBleed}`);
    if (action.applyVulnerable) extras.push(`施易伤 ${action.applyVulnerable}`);
    if ((game.enemy.definition.poisonResist || 0) > 0) {
      const effectiveResist = Math.max(0, game.enemy.definition.poisonResist - (game.enemy.poisonResistShred || 0));
      extras.push(`${Math.round(effectiveResist * 100)}% 有效毒抗`);
    }
    if (action.charge) extras.push(`蓄力·受 ${action.charge.interruptThreshold} 伤可打断`);
    dom.intentDescription.innerHTML = emphasizeCombatHtml(`将造成 ${totalDamage} 点伤害${extras.length ? `（${extras.join("，")}）` : ""}`);
    intentSummary = hitCount > 1 ? `${action.name}｜${totalDamage}总伤害` : `${action.name}｜${totalDamage}伤害`;
    // 净伤宣示：护甲一次性全量抵消（与 resolveEnemyTurn 同逻辑），预计掉血 = max(0, 总伤 - 当前护甲)。
    const netDamage = Math.max(0, totalDamage - (game.player.armor || 0));
    updateIntentThreat(netDamage);
  }
  // V0.9.51 先知契：第一回合把预掷的后两步意图亮给玩家（读队列不掷 RNG）。
  if (game.turn === 1 && Array.isArray(game.enemy?.foresightQueue) && game.enemy.foresightQueue.length) {
    const foreNames = game.enemy.foresightQueue
      .map((id) => getEnemyActionForIntent(id)?.name || "未知")
      .join(" → ");
    intentSummary = `${intentSummary}｜先知窥意：${foreNames}`;
  }
  if (dom.intentSummary) dom.intentSummary.textContent = intentSummary;
  renderMupanThreatPanel();
  dom.enemyPower.innerHTML = emphasizeCombatHtml(`蓄势：下次攻击 +${game.enemy.chargedBonus}`);
  dom.enemyPower.classList.toggle("hidden", game.enemy.chargedBonus === 0);
  const rewriteReady = getActiveFateBenmingPath() === "devourOmen"
    && game.fateRewritePending
    && !game.fateRewriteUsedThisTurn;
  const showingChoice = rewriteReady && Boolean(game.fateRewriteCandidate);
  dom.intentBox.classList.toggle("fate-rewrite-ready", rewriteReady);
  dom.intentBox.classList.toggle("fate-rewrite-choice-open", showingChoice);
  if (dom.fateRewriteButton) {
    dom.fateRewriteButton.classList.toggle("hidden", !rewriteReady || showingChoice);
    dom.fateRewriteButton.disabled = !rewriteReady || showingChoice || game.inputLocked;
  }
  // D-2c 蜕鳞借毒：仅在选择该路线且敌方当前意图为攻击时显示按钮；毒不足/已用/输入锁时禁用并给原因。
  if (dom.poisonBorrowButton) {
    const borrowActive = getActivePoisonBenmingPath() === "poisonBorrowedScale";
    const borrowAction = borrowActive && game.enemy ? getCurrentEnemyAction() : null;
    const showBorrow = Boolean(borrowAction && borrowAction.kind !== "charge");
    dom.poisonBorrowButton.classList.toggle("hidden", !showBorrow);
    if (showBorrow) {
      const borrowPlan = getPoisonBorrowPlan(false);
      dom.poisonBorrowButton.disabled = !borrowPlan.eligible || game.inputLocked;
      dom.poisonBorrowButton.querySelector("small").textContent = borrowPlan.eligible
        ? "4 毒换 6 甲"
        : (borrowPlan.reason || "暂不可用");
      dom.poisonBorrowButton.classList.toggle("is-ready", borrowPlan.eligible && !game.inputLocked);
    }
  }
  if (dom.fateRewriteChoice) {
    dom.fateRewriteChoice.classList.toggle("hidden", !showingChoice);
    dom.fateRewriteChoice.innerHTML = showingChoice ? `
      <div class="fate-rewrite-candidate">
        <span>归墟预览 · 新技能</span>
        <strong>${game.fateRewriteCandidate.name}</strong>
        <small>${game.fateRewriteCandidate.summary}</small>
      </div>
      <div class="fate-rewrite-actions">
        <button type="button" data-fate-rewrite-choice="keep">保留原意图</button>
        <button type="button" data-fate-rewrite-choice="accept">采用新意图</button>
      </div>` : "";
  }
  if (rewriteReady) {
    dom.intentBox.title = showingChoice
      ? "已看到一个新技能：请选择采用新技能或保留原技能，随后结算命势圆满。"
      : "命势已满。点击醒目的「改签」按钮，可改换敌人准备使用的技能并结算圆满。";
    dom.endTurnHint.textContent = showingChoice ? "请选择新技能或原技能" : "可先改签，也可保留满命势过回合";
  } else {
    dom.endTurnHint.textContent = `${game.enemy.definition.name}将执行意图`;
  }
  renderEnemyCriticalMetrics();
  const intentTextLength = (dom.intentDescription?.textContent || "").trim().length
    + (dom.enemyCriticalMetrics?.textContent || "").trim().length;
  dom.intentBox?.classList.toggle("is-dense", intentTextLength > 38);
  updateIntentDetailAccess(action);
}

// 意图框内「预计掉 X 血（已算护甲）」一行 + 高威胁红光脉动。节点建一次后复用(切 hidden)，避免反复增删触发 aria-live 播报；脉动受 effectsAllowed 控制。
function updateIntentThreat(netDamage) {
  if (!dom.intentBox) return;
  let line = dom.intentBox.querySelector(".intent-net-damage");
  if (!line) {
    line = document.createElement("p");
    line.className = "intent-net-damage hidden";
    line.setAttribute("aria-hidden", "true");
    const host = dom.intentDescription && dom.intentDescription.parentNode ? dom.intentDescription.parentNode : dom.intentBox;
    host.appendChild(line);
  }
  if (netDamage > 0) {
    line.innerHTML = emphasizeCombatHtml(`预计掉 ${netDamage} 血（已算护甲）`);
    line.classList.remove("hidden");
    const playerHp = game.player ? game.player.hp : 0;
    const highThreat = effectsAllowed() && (netDamage >= 12 || (playerHp > 0 && netDamage > playerHp / 3));
    line.classList.toggle("is-high-threat", highThreat);
    dom.intentBox.classList.toggle("intent-threat-high", highThreat);
  } else {
    line.classList.add("hidden");
    line.classList.remove("is-high-threat");
    dom.intentBox.classList.remove("intent-threat-high");
  }
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, "");
}

function escapeAttribute(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getCardKeywordHelp(card) {
  const keywords = [];
  if (card.category === "attack") keywords.push("攻击：造成伤害，可被酒虫翻倍。");
  if (card.category === "defense") keywords.push("护甲：获得防御，优先抵挡敌方伤害。");
  if (card.category === "utility") keywords.push("辅助：提供抽牌、真元或特殊状态。");
  if (card.type === "fate") {
    keywords.push("命势：不同类型卡牌交替出牌可叠加，满 3 层真元 +1 并抽 1 张牌。");
    const fatePath = game ? getActiveFateBenmingPath() : null;
    if (fatePath === "threeWeave") keywords.push(`三相织命：${BENMING_PATHS.fate.threeWeave.summary}`);
    if (fatePath === "devourOmen") keywords.push(`噬签改命：${BENMING_PATHS.fate.devourOmen.summary}`);
  }
  if (isBloodAttackCard(card) || card.type === "blood") keywords.push(`血煞：上限 ${getBloodMax()}，血道攻击按牌面引用当前血煞。`);
  if (card.type === "poison" || card.typeName.includes("毒道")) keywords.push("毒性：敌方回合结束时造成等同层数的伤害；重复施毒可触发蚀毒。");
  if (card.upgradeLevel > 0) {
    const resourceProgress = getResourceProgressionSummary(card);
    keywords.push(`炼化：当前 +${card.upgradeLevel}；${getActionEconomyUpgradeRule(card) || resourceProgress || card.upgradeConfig?.rule || "强化了主要数值。"}`);
  }
  if (card.mutated) keywords.push("异变：由蛊炉材料炼蛊转化而来，不能再次异变。");
  if (card.damaged) keywords.push("受损：蛊性受创，徒留旧痕。");
  if (card.skewed) keywords.push(getSkewPenaltyText(card));
  return keywords;
}


function getCardTooltip(card, blockReason = "") {
  const effectiveCost = game ? getEffectiveCardCost(card) : card.cost;
  const lines = [
    blockReason ? `无法使用：${blockReason}` : `使用${card.name}`,
    `${card.typeName} · 消耗 ${effectiveCost} 真元${effectiveCost !== card.cost ? `（原消耗 ${card.cost}）` : ""}`,
    stripTags(card.effect),
    ...getCardKeywordHelp(card),
  ];
  return lines.join("\n");
}

/* ===== EXP-1a 卡面接立绘：万蛊录 47 张蛊图上卡面（手牌/奖励/蛊坊/临门） =====
 * 映射读 GU_CATALOG 的 cardKey→image（单一真源，图鉴与卡面永远同图）；无图的卡保持字符 art。
 * Map 首次使用时构建一次；GU_CATALOG 是 defer 脚本先于 game.v 加载，运行期必已就绪。 */
let __cardArtMap = null;
function getCardArtImage(key) {
  if (!__cardArtMap) {
    __cardArtMap = new Map();
    (window.GU_CATALOG || []).forEach((item) => {
      if (item.category === "gu" && item.cardKey && item.image) __cardArtMap.set(item.cardKey, item.image);
    });
    if (!__cardArtMap.size) { __cardArtMap = null; return null; } // 图鉴未加载成功则本次不缓存，下次再试
  }
  return __cardArtMap.get(key) || null;
}
/* 带伪字立绘的收紧取景名单（详见 assets/source/gu-art-with-text/清单.md）：
 * 这些图的文字集中在四周排版区，取景放大到躯体中心区可裁掉大部分文字；重生成纯立绘版后此名单清空。 */
const CARD_ART_TIGHT_KEYS = new Set([
  "bloodBlade", "shellRemnant", "burningEssence", "fateThread", "greenMiasma", "ironSkin", "moltingShell",
  "moonBlade", "poisonReturn", "bloodReversal", "insectSwarm", "wineWorm", "bloodSacrifice", "fixedFate",
  "guFeeding", "reversePath", "lifeLamp", "soulCrack",
]);
function getCardArtImgClass(key) { return CARD_ART_TIGHT_KEYS.has(key) ? "art-tight" : ""; }
/* 奖励/蛊坊/临门共用的印章位：有立绘出图、无立绘出字符印。 */
function getRewardGlyphHtml(key, glyph) {
  const art = getCardArtImage(key);
  return art
    ? `<span class="reward-card-glyph has-art"><img class="${getCardArtImgClass(key)}" src="${art}" alt="" decoding="async"></span>`
    : `<span class="reward-card-glyph">${glyph}</span>`;
}

/* ===== EXP-1a 战斗手感音：hitLight/hitHeavy/block 通道与文件早已入库，本批补齐触发点 =====
 * 实伤≥12 或暴击=重击音；实伤 0 且有格挡=击盾音（block 与"获得护甲"共用音色，语义都是盾响）。 */
const COMBAT_HEAVY_HIT_THRESHOLD = 12;
function playCombatHitSfx(realDamage, { crit = false, blocked = 0, volumeScale = 0.6 } = {}) {
  if (realDamage > 0) {
    window.AudioManager?.playSfx?.(crit || realDamage >= COMBAT_HEAVY_HIT_THRESHOLD ? "hitHeavy" : "hitLight", { volumeScale });
  } else if (blocked > 0) {
    window.AudioManager?.playSfx?.("block", { volumeScale: Math.max(0.3, volumeScale - 0.15) });
  }
}

function getMobileHandFanGeometry(index, count) {
  const total = Math.max(1, Number(count) || 1);
  const center = (total - 1) / 2;
  const distance = index - center;
  const span = total > 1 ? Math.min(650, 118 * (total - 1)) : 0;
  const step = total > 1 ? span / (total - 1) : 0;
  const normalized = center > 0 ? distance / center : 0;
  return {
    x: Math.round(distance * step),
    angle: Number((normalized * 7).toFixed(2)),
    rise: Math.round(Math.abs(normalized) * 10),
  };
}

function renderHand() {
  const locked = game.status !== "playing" || game.inputLocked;
  if (!game.hand.some((card) => card.instanceId === selectedHandCardId)) selectedHandCardId = "";
  dom.hand.style.setProperty("--hand-count", String(Math.max(1, game.hand.length)));
  dom.hand.classList.toggle("hand-overflow", game.hand.length > 5);
  updateMobileHandToggleCopy();
  dom.hand.innerHTML = game.hand.map((card, index) => {
    const blockReason = getCardBlockReason(card);
    const disabled = locked;
    const blockClass = blockReason === "真元不足" ? "insufficient-energy" : blockReason ? "insufficient-resource" : "";
    const upgradeClass = card.upgradeLevel > 0 ? `upgraded-card upgrade-${card.upgradeLevel}` : "";
    const statusLabels = getEntryStatusLabels(card);
    const effectiveCost = getEffectiveCardCost(card);
    const title = getCardTooltip(card, blockReason);
    const plainEffect = stripTags(card.effect);
    const fullCardName = card.baseName || CARD_LIBRARY[card.key]?.name || stripTags(card.name);
    // V0.9.8.8b：手机端也显示完整蛊名——原 toShortCardName 会去掉末尾「蛊」(血潮蛊→血潮)致玩家觉得名字缺字；3 字蛊名在卡宽内放得下，过长由 CSS ellipsis 兜底。
    const combatCardName = fullCardName;
    const fan = getMobileHandFanGeometry(index, game.hand.length);
    return `
      <button class="card ${card.type} category-${card.category} ${blockClass} ${upgradeClass} ${card.mutated ? "is-mutated" : ""} ${card.damaged ? "is-damaged" : ""} ${card.skewed ? "is-skewed" : ""} ${selectedHandCardId === card.instanceId ? "is-selected" : ""} ${getCardArtImage(card.key) ? "card-with-art" : ""}" type="button"
        data-card-id="${card.instanceId}" data-glyph="${card.glyph}" data-category="${card.category}"
        style="--hand-fan-x:${fan.x}px;--hand-fan-angle:${fan.angle}deg;--hand-fan-rise:${fan.rise}px"
        ${disabled ? "disabled" : ""} title="${escapeAttribute(title)}" aria-disabled="${disabled || Boolean(blockReason)}"
        aria-label="${escapeAttribute(`${card.name}，消耗 ${effectiveCost} 点真元，${plainEffect}`)}">
        <div class="card-title-row">
          <h3>${combatCardName}</h3>
          <span class="card-top-marks">
            <span class="card-cost ${effectiveCost !== card.cost ? "discounted" : ""}" aria-label="真元消耗">${effectiveCost}</span>
            ${card.upgradeLevel > 0 ? `<span class="card-upgrade-badge" aria-label="炼化等级">+${card.upgradeLevel}</span>` : ""}
          </span>
        </div>
        <div class="card-meta-row">
          <span class="card-type">${card.typeName}</span>
          ${statusLabels.length ? `<span class="card-state-badges">${statusLabels.map((label) => `<i>${label}</i>`).join("")}</span>` : ""}
        </div>
        <div class="card-art ${getCardArtImage(card.key) ? "has-art" : ""}" aria-hidden="true">${getCardArtImage(card.key) ? `<img class="${getCardArtImgClass(card.key)}" src="${getCardArtImage(card.key)}" alt="" decoding="async">` : card.art}</div>
        <p class="card-effect">${emphasizeCombatHtml(card.effect)}</p>
        ${blockReason ? `<span class="card-block-reason">${blockReason}</span>` : ""}
      </button>`;
  }).join("");
  updateSelectedCardActions();
}

function loadPortraitImage(image, path, label, owner, options = {}) {
  if (!image || !owner || !path) return;
  if (image.dataset.requestedPath === path) return;
  image.dataset.requestedPath = path;
  owner.classList.remove("image-loaded");
  image.classList.remove("image-load-error");
  image.hidden = false;
  image.onload = () => {
    image.dataset.loadedPath = path;
    delete image.dataset.failedPath;
    owner.classList.add("image-loaded");
  };
  image.onerror = () => {
    image.dataset.failedPath = path;
    image.classList.add("image-load-error");
    if (options.fallbackPath && options.fallbackPath !== path) {
      console.warn(`[立绘加载失败] ${label}：${path}。已回退至一相立绘。`);
      image.dataset.requestedPath = "";
      loadPortraitImage(image, options.fallbackPath, options.fallbackLabel || label, owner);
      return;
    }
    image.hidden = true;
    owner.classList.remove("image-loaded");
    console.warn(`[立绘加载失败] ${label}：${path}。已启用符号占位图。`);
  };
  image.src = path;
}

// 朝暮寿道：按寿元相对满寿(maxLifespan，含饲岁轮加成)的比率分 4 档（满/过半/残/垂暮）
function longevityTier(player) {
  const base = (player && (player.maxLifespan || (player.definition && player.definition.lifespan))) || 1;
  const ratio = (player.lifespan || 0) / base;
  if (ratio >= 0.75) return 0;
  if (ratio >= 0.5) return 1;
  if (ratio >= 0.25) return 2;
  return 3;
}

function renderPlayerPortrait() {
  const heroId = game.player.heroId;
  const dragonForm = heroId === "dragon" && Boolean(game.dragon?.transformed);
  const entry = dragonForm ? PORTRAIT_PATHS.heroes.dragonTransformed : PORTRAIT_PATHS.heroes[heroId];
  let path = entry;
  let tier = -1;
  if (Array.isArray(entry)) {
    tier = longevityTier(game.player);
    path = entry[Math.min(tier, entry.length - 1)] || entry[0];
  }
  const prevTier = dom.playerPortrait.dataset.longTier;
  if (dom.playerPortrait.dataset.heroId === heroId
      && dom.playerPortrait.dataset.dragonForm === String(dragonForm)
      && dom.playerPortraitImage.dataset.requestedPath === path) return;
  dom.playerPortrait.dataset.heroId = heroId;
  dom.playerPortrait.dataset.dragonForm = String(dragonForm);
  dom.playerPortrait.dataset.longTier = String(tier);
  dom.playerPortraitFallback.innerHTML = `<span class="portrait-rune">${game.player.definition.glyph}</span>`;
  dom.playerPortraitImage.alt = `${game.player.definition.name}立绘`;
  loadPortraitImage(dom.playerPortraitImage, path, game.player.definition.name, dom.playerPortrait);
  // 朝暮：寿元档位真正变化(且非首次设置)时，播形态切换动画(焚寿衰老)；换图逻辑已在上方照常执行，不受特效开关影响
  if (tier >= 0 && prevTier !== undefined && prevTier !== "-1" && prevTier !== String(tier)
      && typeof pulseElement === "function"
      && (typeof effectsAllowed !== "function" || effectsAllowed())) {
    pulseElement(dom.playerPortrait, "portrait-form-shift", 900);
  }
}

function renderEnemyPortrait() {
  const isMupan = isMupanBattle();
  const portraitPhase = isMupan
    ? getMupanPortraitPhase()
    : (game.enemy.id === "corpsepuppet" && game.enemy.phase2 ? "phase2" : "phase1");
  const portraitPath = isMupan
    ? getMupanPortraitPath(portraitPhase)
    : (portraitPhase === "phase2" ? PORTRAIT_PATHS.enemies.corpsepuppetPhase2 : PORTRAIT_PATHS.enemies[game.enemy.id]);
  if (dom.enemyPortrait.dataset.enemyId === game.enemy.id && dom.enemyPortrait.dataset.phase === portraitPhase) return;
  dom.enemyPortrait.dataset.enemyId = game.enemy.id;
  dom.enemyPortrait.dataset.phase = portraitPhase;
  dom.enemyPortrait.className = `portrait enemy-portrait enemy-${game.enemy.id} enemy-${portraitPhase} ${portraitPhase === "phase2" ? "enemy-phase2" : ""}`;
  dom.enemyPortrait.setAttribute("aria-label", `${game.enemy.definition.name}立绘`);
  const caption = isMupan
    ? ({ phase1: "完整母盘 · 看穿习惯", phase2: "双轮转动 · 两段追击", phase3: "逼命倒数 · 灭命将至", broken: "盘心断裂 · 追击停止" }[portraitPhase])
    : game.enemy.definition.caption;
  dom.enemyPortrait.innerHTML = `<div class="portrait-fallback" aria-hidden="true">${getEnemySvg(game.enemy.id)}</div>
    <img class="portrait-image" alt="${game.enemy.definition.name}立绘" decoding="async">
    <span class="portrait-image-shade" aria-hidden="true"></span>
    <span class="portrait-caption">${caption}</span>`;
  const image = dom.enemyPortrait.querySelector(".portrait-image");
  loadPortraitImage(image, portraitPath, game.enemy.definition.name, dom.enemyPortrait, {
    fallbackPath: !isMupan && portraitPhase === "phase2" ? PORTRAIT_PATHS.enemies.corpsepuppet : "",
    fallbackLabel: `${game.enemy.definition.name}一相立绘`,
  });
}

function getEnemySvg(enemyId) {
  const fallbacks = {
    shanxiao: { glyph: "魈", color: "#b94137" },
    rottenShanxiao: { glyph: "腐", color: "#8cae5d" },
    bloodwolf: { glyph: "狼", color: "#b94137" },
    redManeBloodwolf: { glyph: "鬃", color: "#c34a3e" },
    bloodwolfElite: { glyph: "狼", color: "#d14b43" },
    beeswarm: { glyph: "蜂", color: "#8cae5d" },
    wildBeeTide: { glyph: "潮", color: "#8cae5d" },
    corpsepuppet: { glyph: "尸", color: "#72a587" },
    wanmingMupan: { glyph: "盘", color: "#c7a85a" },
  };
  const fallback = fallbacks[enemyId] || { glyph: "邪", color: "#bda26d" };
  return `<svg class="enemy-figure-svg" viewBox="0 0 260 190" aria-hidden="true">
    <circle cx="130" cy="94" r="65" fill="none" stroke="${fallback.color}" stroke-opacity=".22"/>
    <circle cx="130" cy="94" r="49" fill="${fallback.color}" fill-opacity=".07" stroke="${fallback.color}" stroke-opacity=".34" stroke-dasharray="5 7"/>
    <path d="M65 150 Q130 22 196 150" fill="none" stroke="${fallback.color}" stroke-opacity=".18"/>
    <text x="130" y="112" text-anchor="middle" fill="${fallback.color}" font-size="58" font-family="KaiTi">${fallback.glyph}</text>
  </svg>`;
}

function initCloudSaveUi() {
  const panel = dom.settingsCloudSavePanel;
  const api = window.NMGCloudSave;
  if (!panel || window.NMG_PLATFORM !== "taptap-h5-demo" || !api) {
    panel?.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  api.subscribe((next) => {
    const labels = {
      idle: "云存档：尚未检查",
      checking: "云存档：正在检查…",
      ready: "云存档：已就绪",
      pending: "云存档：等待同步",
      syncing: "云存档：正在同步…",
      synced: "云存档：已同步",
      restored: "云存档：已恢复上次进度",
      conflict: "云存档：检测到进度冲突，已保留本机档",
      error: "云存档：同步失败，本机进度已保留",
      unavailable: "云存档：当前环境不可用",
    };
    if (dom.settingsCloudSaveStatus) dom.settingsCloudSaveStatus.textContent = labels[next.status] || `云存档：${next.message || "状态未知"}`;
    panel.classList.toggle("is-error", next.status === "error" || next.status === "conflict");
    const conflicted = next.status === "conflict";
    dom.settingsCloudConflictActions?.classList.toggle("hidden", !conflicted);
    dom.settingsCloudSaveSync?.classList.toggle("hidden", conflicted);
    if (dom.settingsCloudSaveSync) dom.settingsCloudSaveSync.disabled = next.status === "checking" || next.status === "syncing" || next.status === "unavailable";
  });
}

function releaseRunRewardedBusy(button, label, idleText) {
  if (button) {
    button.dataset.busy = "";
    button.removeAttribute("aria-busy");
  }
  if (label) label.textContent = idleText;
}

function bindEvents() {
  dom.mobileBuffRail?.addEventListener("click", (event) => {
    const statusToggle = event.target.closest("[data-mobile-status-toggle]");
    if (statusToggle) {
      playUiSfx();
      const collapsed = !dom.mobileBuffRail.classList.contains("is-collapsed");
      dom.mobileBuffRail.classList.toggle("is-collapsed", collapsed);
      statusToggle.setAttribute("aria-expanded", String(!collapsed));
      const count = Math.max(0, Number(statusToggle.dataset.statusCount) || 0);
      statusToggle.textContent = collapsed ? `状态 ${count}` : "收";
      statusToggle.setAttribute("aria-label", collapsed ? `展开遗物与状态，共 ${count} 项` : "收起遗物与状态");
      return;
    }
    const relicToggle = event.target.closest(".combat-relic-toggle");
    if (relicToggle) {
      playUiSfx();
      toggleCombatRelicOverflow(relicToggle);
      return;
    }
    const boneChimeAction = event.target.closest('[data-combat-status-action="boneChime"]');
    if (boneChimeAction) {
      playUiSfx();
      openBoneChime();
      return;
    }
    const action = event.target.closest(".dragon-transform-action");
    if (!action) return;
    playUiSfx();
    activateDragonTransform();
  });
  dom.combatRelicStrip?.addEventListener("click", (event) => {
    const relicToggle = event.target.closest(".combat-relic-toggle");
    if (!relicToggle) return;
    playUiSfx();
    toggleCombatRelicOverflow(relicToggle);
  });
  dom.topMaterials?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-top-materials-toggle]");
    if (!toggle) return;
    playUiSfx();
    dom.topMaterials.classList.toggle("is-collapsed");
    updateTopMaterials();
  });
  dom.newRunButton?.addEventListener("click", () => {
    playUiSfx();
    setStartView("prep");
  });
  dom.prepBackButton?.addEventListener("click", () => {
    playUiSfx();
    setStartView("home");
  });
  dom.moreMenuButton?.addEventListener("click", (event) => {
    event.stopImmediatePropagation();
    playUiSfx();
    const opening = dom.moreMenuPanel?.classList.contains("hidden");
    setMoreMenuOpen(opening);
  });
  dom.moreMenuPanel?.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    if (!dom.moreMenuPanel?.classList.contains("hidden")) setMoreMenuOpen(false);
  });
  window.addEventListener("popstate", () => {
    if (moreMenuHistoryArmed || !dom.moreMenuPanel?.classList.contains("hidden")) {
      setMoreMenuOpen(false, { fromHistory: true });
    }
  });
  dom.heroChoices.addEventListener("click", (event) => {
    const detail = event.target.closest("[data-hero-detail]");
    if (detail) {
      playUiSfx();
      openHeroDetail(detail.dataset.heroDetail);
      return;
    }
    const choice = event.target.closest("[data-hero-id]");
    if (!choice) return;
    playUiSfx();
    if (progression.selectedHeroId !== choice.dataset.heroId) progression.selectedBenmingPath = null;
    progression.selectedHeroId = choice.dataset.heroId;
    triggerHeroVoice("select");
    renderTitleScreen();
  });
  dom.prepStepTabs?.addEventListener("click", (event) => {
    const step = event.target.closest("[data-prep-step]");
    if (!step || step.classList.contains("hidden")) return;
    playUiSfx();
    setPrepStep(step.dataset.prepStep);
  });
  dom.starterGuChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-starter-gu-key]");
    if (!choice || !STARTER_GU_CHOICE_KEYS.includes(choice.dataset.starterGuKey)) return;
    const current = normalizeStarterGuSelection(progression.selectedStarterGuKeys);
    const key = choice.dataset.starterGuKey;
    if (current.includes(key)) return;
    playUiSfx();
    progression.selectedStarterGuKeys = [...current.slice(1), key].slice(0, 2);
    renderStarterGuSelection();
    updatePrepSelectionSummary();
  });
  dom.heroDetailClose?.addEventListener("click", () => {
    playUiSfx();
    closeHeroDetail();
  });
  dom.heroDetailOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.heroDetailOverlay) closeHeroDetail();
  });
  dom.benmingPathChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-benming-path]");
    if (!choice || !getBenmingPathDefinition(progression.selectedHeroId, choice.dataset.benmingPath)) return;
    playUiSfx();
    progression.selectedBenmingPath = choice.dataset.benmingPath;
    dom.benmingPathSection?.classList.remove("needs-choice");
    renderBenmingPathSelection();
    updatePrepSelectionSummary();
    dom.runProgress?.classList.add("hidden");
  });
  dom.relicChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-relic-id]");
    if (!choice) return;
    playUiSfx();
    progression.selectedRelicId = choice.dataset.relicId;
    renderTitleScreen();
  });
  // V0.9.40 QS-1a 命途契：单签互斥；点已签的契=解约（空签永远合法）。
  dom.contractChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-contract-id]");
    if (!choice || typeof CONTRACTS === "undefined") return;
    const id = choice.dataset.contractId;
    const def = getContractDefinition(id);
    if (!def || !def.implemented || !isContractUnlocked(id)) return;
    if (def.heroId && def.heroId !== progression.selectedHeroId) return; // V0.9.51 流派契限本道英雄
    playUiSfx();
    progression.selectedContract = progression.selectedContract === id ? null : id;
    renderContractSelection();
    updatePrepSelectionSummary();
  });
  // V0.9.8.3：挑战模式选择（精英未解锁不可选）。V0.9.19：加十重天与重数步进。
  dom.modeChoices?.addEventListener("click", (event) => {
    const leaderboardButton = event.target.closest("[data-endless-leaderboard-open]");
    if (leaderboardButton) {
      if (!leaderboardButton.disabled) { playUiSfx(); openEndlessLeaderboard(); }
      return;
    }
    const step = event.target.closest("[data-tian-delta]");
    if (step) {
      if (step.disabled) return;
      playUiSfx();
      selectedTianTier = clampTianTier(selectedTianTier + Number(step.dataset.tianDelta));
      renderTitleScreen();
      return;
    }
    const choice = event.target.closest("[data-run-mode]");
    if (!choice) return;
    const id = choice.dataset.runMode;
    if (id === "elite" && !progression.eliteUnlocked) { setBattleMessage?.("精英模式需先通关任意路线解锁。"); return; }
    if (id === "deathtrial") return; // V0.9.55 死劫已移除：老档/伪造点击一律无效
    if (id === "tian" && !progression.eliteUnlocked) { setBattleMessage?.("十重天需先通关任意路线解锁。"); return; }
    playUiSfx();
    selectedMode = id;
    renderTitleScreen();
  });
  dom.tutorialOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openTutorial(0);
  });
  document.getElementById("updateLogButton")?.addEventListener("click", () => {
    playUiSfx();
    setMoreMenuOpen(false);
    showUpdateLog();
  });
  document.getElementById("wanGuLuButton")?.addEventListener("click", () => {
    playUiSfx();
    openWanGuLu();
  });
  // V0.9.22 蛊庐
  dom.guluOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openGulu();
  });
  dom.baigushiOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openBaigushi();
  });
  dom.forgeOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openGuluForge(); // V0.9.52 九转鼎：主界面直入，自带炉火 BGM
  });
  dom.leaderboardOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openEndlessLeaderboard(); // 主页第一层直入；未解锁时按钮禁用，openEndlessLeaderboard 内仍有兜底闸
  });
  dom.guluCloseButton?.addEventListener("click", () => {
    playGuluClick(); // V0.9.26 蛊庐专属甲壳点击
    closeGulu();
  });
  dom.guluForgeResultOverlay?.addEventListener("click", () => {
    advanceGuluForgeResultRitual();
  });
  dom.outgameReceiptAccept?.addEventListener("click", () => {
    NmgOutgameReceipts.dismiss();
    refreshModalLock();
  });
  dom.outgameReceiptOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.outgameReceiptOverlay) {
      NmgOutgameReceipts.dismiss();
      refreshModalLock();
    }
  });
  dom.endlessLeaderboardClose?.addEventListener("click", closeEndlessLeaderboard);
  dom.endlessLeaderboardOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.endlessLeaderboardOverlay) closeEndlessLeaderboard();
  });
  dom.endlessLeaderboardRefresh?.addEventListener("click", refreshEndlessLeaderboard);
  dom.endlessLeaderboardRetry?.addEventListener("click", () => submitEndlessScoreWithStatus(getEndlessDeepestScore()));
  dom.guluOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.guluOverlay) { closeGulu(); return; }
    const recipeOverlay = dom.guluBody?.querySelector("[data-gulu-recipes-overlay]");
    const poolOverlay = dom.guluBody?.querySelector("[data-gulu-pool-preview-overlay]");
    const poolOpen = event.target.closest("[data-gulu-pool-preview-open]");
    if (poolOpen && poolOverlay) {
      playGuluClick();
      poolOverlay.classList.remove("hidden");
      dom.guluBody.classList.add("is-pool-preview-open");
      poolOpen.setAttribute("aria-expanded", "true");
      poolOverlay.querySelector("[data-gulu-pool-preview-close]")?.focus?.();
      return;
    }
    if (poolOverlay && (event.target === poolOverlay || event.target.closest("[data-gulu-pool-preview-close]"))) {
      playGuluClick();
      poolOverlay.classList.add("hidden");
      dom.guluBody.classList.remove("is-pool-preview-open");
      const poolTrigger = dom.guluBody?.querySelector("[data-gulu-pool-preview-open]");
      poolTrigger?.setAttribute("aria-expanded", "false");
      poolTrigger?.focus?.();
      return;
    }
    const recipeOpen = event.target.closest("[data-gulu-recipes-open]");
    if (recipeOpen && recipeOverlay) {
      playGuluClick();
      recipeOverlay.classList.remove("hidden");
      recipeOpen.setAttribute("aria-expanded", "true");
      recipeOverlay.querySelector("[data-gulu-recipes-close]")?.focus?.();
      return;
    }
    if (recipeOverlay && (event.target === recipeOverlay || event.target.closest("[data-gulu-recipes-close]"))) {
      playGuluClick();
      recipeOverlay.classList.add("hidden");
      const recipeTrigger = dom.guluBody?.querySelector("[data-gulu-recipes-open]");
      recipeTrigger?.setAttribute("aria-expanded", "false");
      recipeTrigger?.focus?.();
      return;
    }
    const recipeFilter = event.target.closest("[data-gulu-recipes-filter]");
    if (recipeFilter && recipeOverlay) {
      playGuluClick();
      const role = recipeFilter.dataset.guluRecipesFilter || "all";
      recipeOverlay.querySelectorAll("[data-gulu-recipes-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button === recipeFilter)));
      recipeOverlay.querySelectorAll("[data-gulu-recipe-role]").forEach((row) => row.classList.toggle("hidden", role !== "all" && row.dataset.guluRecipeRole !== role));
      return;
    }
    if (event.target === dom.guluActionConfirm || event.target.closest("#guluActionConfirmClose, #guluActionConfirmCancel")) {
      playGuluClick();
      closeGuluActionConfirm();
      return;
    }
    if (event.target.closest("#guluActionConfirmOk")) {
      playGuluClick();
      const receiptBefore = captureOutgameInventory(getGuluStore());
      const result = confirmGuluAction();
      guluNoticeText = result.text;
      if (result.ok && result.action === "release") window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.75 });
      if (result.ok && result.action === "feed") window.AudioManager?.playSfx?.("guluFeed", { volumeScale: 1 });
      renderGulu();
      if (result.ok && (result.action === "forge" || result.action === "fusion")) {
        playGuluForgeSequence(result, () => {
          if (result.action === "fusion" && result.fused) {
            showOutgameReceiptFromChange(receiptBefore, getGuluStore(), { source: "合蛊坛", title: "异蛊合练功成", summary: result.text });
          }
        });
      }
      if (result.action === "feed") {
        const heroGuNow = BENMING_GU[progression.selectedHeroId];
        if (result.ok && result.kind === "win") {
          showRiteOverlay({
            tone: "gold", eyebrow: "蛊斗 · 强吞", seal: "吞",
            title: `${heroGuNow?.name || "本命蛊"}胜`, text: result.text, hint: "点击任意处 · 收势", autoMs: 6000,
          });
        } else if (result.ok && result.kind === "lose") {
          showRiteOverlay({
            tone: "blood", eyebrow: "蛊斗 · 反噬", seal: "噬",
            title: `${result.eatenName || "凶蛊"}反噬`, text: result.text, hint: "点击任意处 · 忍痛", autoMs: 6500,
          });
        }
      }
      return;
    }
    const kindleControl = event.target.closest("[data-gulu-forge-kindle]");
    if (kindleControl && !kindleControl.disabled) {
      playGuluClick();
      adjustGuluForgeKindle(kindleControl.dataset.guluForgeKindle === "increase" ? 1 : -1);
      return;
    }
    if (event.target.closest(".gulu-action-confirm-card")) return;
    const guluTab = event.target.closest("[data-gulu-tab]");
    if (guluTab) {
      playGuluClick();
      const nextGuluTab = guluTab.dataset.guluTab;
      // V0.9.52：炼蛊房与藏册同级页签；V0.9.57 加养蛊室；其余一律回蛊圃（含伪造值）
      guluActiveTab = ["collection", "forge", "fusion", "nurture"].includes(nextGuluTab) ? nextGuluTab : "home";
      if (dom.guluTitle) dom.guluTitle.textContent = "蛊庐";
      renderGulu();
      syncGuluTabAudio(guluActiveTab);
      showGuluFirstVisitTip(guluActiveTab);
      return;
    }
    /* ===== V0.9.57 养蛊室四个动作 =====
     * 全部走 runGuluReceiptAction，与蛊庐既有交互同一套回执与音效。
     * 收纳/取出是纯搬运（无得失），故不弹回执，只更新提示条。 */
    const nurtureFocus = event.target.closest("[data-nurture-focus]");
    if (nurtureFocus) {
      playGuluClick();
      setGuluNurtureFocus(nurtureFocus.dataset.nurtureFocus);
      renderGulu();
      return;
    }
    const nurtureStore = event.target.closest("[data-nurture-store]");
    if (nurtureStore && !nurtureStore.disabled) {
      playGuluClick();
      const s = getGuluStore();
      const r = moveGuToNurture(s, nurtureStore.dataset.nurtureStore, guluNow());
      if (r.ok) { saveGuluStore(); window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 }); }
      guluNoticeText = r.text;
      renderGulu();
      return;
    }
    const nurtureTake = event.target.closest("[data-nurture-take]");
    if (nurtureTake && !nurtureTake.disabled) {
      playGuluClick();
      const s = getGuluStore();
      const r = takeGuFromNurture(s, nurtureTake.dataset.nurtureTake);
      if (r.ok) { saveGuluStore(); window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 }); }
      guluNoticeText = r.text;
      renderGulu();
      return;
    }
    const nurtureFeed = event.target.closest("[data-nurture-feed]");
    if (nurtureFeed && !nurtureFeed.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "养蛊室", title: "灵泉温养" }, () => {
        const s = getGuluStore();
        const r = nurtureGuWithDew(s, nurtureFeed.dataset.nurtureFeed);
        if (r.ok) saveGuluStore();
        return r;
      });
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluFeed", { volumeScale: 0.8 });
      renderGulu();
      return;
    }
    const nurtureEcology = event.target.closest("[data-nurture-ecology]");
    if (nurtureEcology && !nurtureEcology.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "养蛊室", title: "栖地异材温养" }, () => {
        const s = getGuluStore();
        const r = nurtureGuWithEcology(s, nurtureEcology.dataset.nurtureEcology);
        if (r.ok) saveGuluStore();
        return r;
      });
      guluNoticeText = result.text;
      renderGulu();
      return;
    }
    const nurtureUpgrade = event.target.closest("[data-nurture-upgrade]");
    if (nurtureUpgrade && !nurtureUpgrade.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "养蛊室", title: "灵泉凿深" }, () => {
        const s = getGuluStore();
        const r = upgradeNurtureSpring(s);
        if (r.ok) saveGuluStore();
        return r;
      });
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 1 });
      renderGulu();
      return;
    }
    const marketStall = event.target.closest("[data-baigushi-stall]");
    if (marketStall) {
      playGuluClick();
      const stall = marketStall.dataset.baigushiStall;
      if (["insects", "materials", "curios", "ward", "seals"].includes(stall)) guluMarketStall = stall;
      renderGulu();
      return;
    }
    /* V0.9.57 印记兑蛊钱：按钮只带 offer id，兑换前【重新 list 一次】再按 id 取当前 offer，
     * 绝不信任 DOM 上的旧值——否则玩家改个 data 属性就能重复兑换。 */
    const sealClaim = event.target.closest("[data-baigushi-seal]");
    if (sealClaim && !sealClaim.disabled) {
      playGuluClick();
      const offerId = sealClaim.dataset.baigushiSeal;
      const result = runGuluReceiptAction({ source: "百蛊市 · 印记阁", title: "印记已折蛊钱" }, () => {
        const store = getGuluStore();
        const offer = listAllSealScripOffers(store).find((o) => o.id === offerId);
        if (!offer) return { ok: false, text: "找不到这枚印记。" };
        if (offer.claimed) return { ok: false, text: "这枚印记已经折算过了。" };
        const claim = claimSealScrip(store, offer);
        if (!claim.ok) return { ok: false, text: "这枚印记已经折算过了。" };
        saveGuluStore();
        return { ok: true, text: `${offer.label} 折得 ${claim.gained} 蛊钱（现有 ${claim.scrip}）。` };
      });
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 });
      renderGulu();
      return;
    }
    const featuredEgg = event.target.closest("[data-baigushi-featured-egg]");
    if (featuredEgg && !featuredEgg.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "轮换蛊卵已落圃" }, () => buyBaigushiFeaturedEgg());
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 });
      renderGulu();
      return;
    }
    // 局外激励：绑定点击时 store/eggId/egg；完整观看后让该卵进入正常破壳结算。
    const hatchAdBtn = event.target.closest("[data-gulu-rewarded-hatch]");
    if (hatchAdBtn) {
      if (guluRewardedAdBusy) return;
      if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
      const eggId = hatchAdBtn.dataset.guluRewardedHatch;
      const hatchStore = getGuluStore();
      const hatchEgg = findGuluEggSlot(hatchStore, eggId);
      if (!canRewardedHatchInstant(hatchStore, eggId, hatchEgg, guluNow())) return;
      playGuluClick();
      guluRewardedAdBusy = true;
      NmgAds.showRewarded((ok) => {
        guluRewardedAdBusy = false;
        if (ok !== true || getGuluStore() !== hatchStore) { renderGulu(); return; }
        const callbackNow = guluNow();
        const res = grantRewardedHatchInstant(hatchStore, eggId, hatchEgg, callbackNow);
        if (res.ok) {
          saveGuluStore();
          guluNoticeText = "广告加持：蛊卵已到破壳时辰。";
        }
        renderGulu();
      });
      return;
    }
    // 局外激励：绑定点击时 store/market；每次完整观看领 6 蛊钱。
    const scripAdBtn = event.target.closest("[data-baigushi-rewarded-scrip]");
    if (scripAdBtn) {
      if (guluRewardedAdBusy) return;
      if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
      const scripStore = getGuluStore();
      const scripMarket = scripStore.market;
      if (!canClaimRewardedScrip(scripStore, scripMarket)) return;
      playGuluClick();
      guluRewardedAdBusy = true;
      NmgAds.showRewarded((ok) => {
        guluRewardedAdBusy = false;
        if (ok !== true || getGuluStore() !== scripStore) { renderGulu(); return; }
        const receiptBefore = captureOutgameInventory(scripStore);
        const res = grantRewardedScrip(scripStore, scripMarket);
        if (res.gained > 0) {
          saveGuluStore();
          guluPushEvent(scripStore, `广告加持·百蛊市领取蛊钱 ${res.gained} 枚。`);
          guluNoticeText = `广告加持：领得蛊钱 ${res.gained} 枚（现 ${res.scrip}）。`;
          window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 });
          showOutgameReceiptFromChange(receiptBefore, scripStore, { source: "百蛊市 · 广告加发", title: "蛊钱已领取" });
        }
        renderGulu();
      });
      return;
    }
    // 局外激励：今日点卯所得按点击时 lastGained 指纹原样再领，不重新随机。
    const signRewardedBtn = event.target.closest("[data-gulu-rewarded-sign]");
    if (signRewardedBtn) {
      if (guluRewardedAdBusy) return;
      if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
      const signStore = getGuluStore();
      const signDateKey = guluTodayKey();
      const signFingerprint = fingerprintGuluSignReward(signStore.sign?.lastGained);
      if (!canClaimRewardedSign(signStore, signDateKey, signFingerprint)) return;
      playGuluClick();
      guluRewardedAdBusy = true;
      NmgAds.showRewarded((ok) => {
        guluRewardedAdBusy = false;
        if (ok !== true || getGuluStore() !== signStore || guluTodayKey() !== signDateKey) { renderGulu(); return; }
        const receiptBefore = captureOutgameInventory(signStore);
        const res = grantRewardedSign(signStore, signDateKey, signFingerprint);
        if (res.ok) {
          saveGuluStore();
          guluPushEvent(signStore, `广告加持·日课材料再领：${res.summary}。`);
          guluNoticeText = `日课再领：${res.summary}。`;
          window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 });
          showOutgameReceiptFromChange(receiptBefore, signStore, { source: "归庐日课 · 广告加发", title: "日课材料已再领" });
        }
        renderGulu();
      });
      return;
    }
    // 局外激励：同一养蛊室对象未满时立凝一滴，不改 lastTickAt。
    const dewRewardedBtn = event.target.closest("[data-nurture-rewarded-dew]");
    if (dewRewardedBtn) {
      if (guluRewardedAdBusy) return;
      if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
      const dewStore = getGuluStore();
      const dewNurture = dewStore.nurture;
      if (!canClaimRewardedDew(dewStore, dewNurture)) return;
      playGuluClick();
      guluRewardedAdBusy = true;
      NmgAds.showRewarded((ok) => {
        guluRewardedAdBusy = false;
        if (ok !== true || getGuluStore() !== dewStore) { renderGulu(); return; }
        const receiptBefore = captureOutgameInventory(dewStore);
        const res = grantRewardedDew(dewStore, dewNurture);
        if (res.ok) {
          saveGuluStore();
          guluPushEvent(dewStore, "广告加持·灵泉立凝元髓露 1 滴。");
          guluNoticeText = `灵泉立凝：元髓露 ${res.dew}/${res.cap}。`;
          window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 });
          showOutgameReceiptFromChange(receiptBefore, dewStore, { source: "养蛊室 · 广告加发", title: "元髓露已入泉" });
        }
        renderGulu();
      });
      return;
    }
    // 局外激励：绑定 guId 与收纳 slot 对象，温养 +20、封顶 100，不耗元髓露。
    const rewardedNurtureBtn = event.target.closest("[data-nurture-rewarded-gu]");
    if (rewardedNurtureBtn) {
      if (guluRewardedAdBusy) return;
      if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
      const rewardedNurtureStore = getGuluStore();
      const rewardedNurtureGuId = rewardedNurtureBtn.dataset.nurtureRewardedGu;
      const rewardedNurtureSlot = findRewardedNurtureSlot(rewardedNurtureStore, rewardedNurtureGuId);
      if (!canRewardedNurture(rewardedNurtureStore, rewardedNurtureGuId, rewardedNurtureSlot)) return;
      playGuluClick();
      guluRewardedAdBusy = true;
      NmgAds.showRewarded((ok) => {
        guluRewardedAdBusy = false;
        if (ok !== true || getGuluStore() !== rewardedNurtureStore) { renderGulu(); return; }
        const receiptBefore = captureOutgameInventory(rewardedNurtureStore);
        const res = grantRewardedNurture(rewardedNurtureStore, rewardedNurtureGuId, rewardedNurtureSlot);
        if (res.ok) {
          saveGuluStore();
          const nurtureName = rewardedNurtureSlot.customName || rewardedNurtureSlot.name || "蛊";
          guluPushEvent(rewardedNurtureStore, `广告加持·${nurtureName}温养 +${res.gained}。`);
          guluNoticeText = `${nurtureName}温养 ${res.nurture}/100。`;
          window.AudioManager?.playSfx?.("guluFeed", { volumeScale: 0.8 });
          showOutgameReceiptFromChange(receiptBefore, rewardedNurtureStore, { source: "养蛊室 · 广告加发", title: "温养一轮完成" });
        }
        renderGulu();
      });
      return;
    }
    // 局外激励：只给点击日真实 dailyGoods 中指定售罄商品补 1 件。
    const restockRewardedBtn = event.target.closest("[data-baigushi-rewarded-restock]");
    if (restockRewardedBtn) {
      if (guluRewardedAdBusy) return;
      if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
      const restockStore = getGuluStore();
      const restockDateKey = guluTodayKey();
      const restockDailyGoods = getBaigushiDailyGoods(restockStore, restockDateKey);
      const restockGoodId = restockRewardedBtn.dataset.baigushiRewardedRestock;
      if (!canRewardedBaigushiRestock(restockStore, restockDateKey, restockDailyGoods, restockGoodId)) return;
      playGuluClick();
      guluRewardedAdBusy = true;
      NmgAds.showRewarded((ok) => {
        guluRewardedAdBusy = false;
        if (ok !== true || getGuluStore() !== restockStore || guluTodayKey() !== restockDateKey) { renderGulu(); return; }
        const res = grantRewardedBaigushiRestock(restockStore, restockDateKey, restockDailyGoods, restockGoodId);
        if (res.ok) {
          saveGuluStore();
          guluPushEvent(restockStore, `广告加持·百蛊市「${res.name}」补货 1 件。`);
          guluNoticeText = `${res.name}已补货 1 件。`;
          window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 });
        }
        renderGulu();
      });
      return;
    }
    const redeemOpenBtn = event.target.closest("[data-baigushi-redeem-open]");
    if (redeemOpenBtn) {
      playGuluClick();
      openBaigushiRedeem();
      return;
    }
    const redeemCloseBtn = event.target.closest("[data-baigushi-redeem-close]");
    if (redeemCloseBtn) {
      playGuluClick();
      closeBaigushiRedeem();
      return;
    }
    // V0.9.51 兑换码：百蛊市输入离线签名码领蛊钱（一码一设备一次，纯规则见 nmg-gulu.js redeemCodeApply）。
    const redeemBtn = event.target.closest("[data-baigushi-redeem]");
    if (redeemBtn) {
      const input = document.getElementById("baigushiRedeemInput");
      const raw = input ? input.value : "";
      if (!String(raw).trim()) { guluNoticeText = "请先输入兑换码。"; renderGulu(); focusBaigushiRedeemInput(raw); return; }
      playGuluClick();
      const store = getGuluStore();
      const receiptBefore = captureOutgameInventory(store);
      const activeRun = runState?.status === "running" ? runState : null;
      const res = redeemCodeApply(store, raw, guluNow(), {
        preflightRunRewards: (rewards) => activeRun
          ? applyPendingRunRedeemRewards(activeRun, rewards, { commit: false })
          : { ok: true },
      });
      if (res.ok) {
        guluRedeemOpen = false;
        let runRewardState = "";
        const pendingRunRewards = getPendingRunRedeemRewards(store);
        if (pendingRunRewards.length && activeRun) {
          const applied = applyPendingRunRedeemRewards(activeRun, pendingRunRewards);
          if (applied.ok) {
            clearPendingRunRedeemRewards(store);
            saveRunStateToStorage();
            runRewardState = "，局内奖励已入当前命途";
          }
        } else if (pendingRunRewards.length) {
          runRewardState = "，局内奖励将在下局领取";
        }
        saveGuluStore();
        const rewardParts = Array.isArray(res.rewardLines) ? res.rewardLines.slice() : [];
        if (res.scrip > 0) rewardParts.push(`蛊钱 +${res.scrip}（现 ${res.total}）`);
        if (res.materialCount > 0) rewardParts.push(`八种炼蛊材料各 +${res.materialCount}`);
        if (res.daoxing > 0) rewardParts.push(`本命蛊道行 +${res.daoxing}`);
        if (res.gu && !Array.isArray(res.gu)) rewardParts.push(`补发 ${res.gu.name}（${res.gu.turn} 转，已入${res.gu.location === "nurture" ? "养蛊室" : `第 ${res.gu.index + 1} 圃`}）`);
        guluNoticeText = `兑换成功：${rewardParts.join("，") || "奖励已发放"}${runRewardState}。`;
        window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 });
        showOutgameReceiptFromChange(receiptBefore, getGuluStore(), { source: "百蛊市 · 兑换码", title: "兑换成功" });
      } else {
        guluNoticeText = res.reason === "used" ? "这枚兑换码在本机已兑换过。"
          : res.reason === "expired" ? "这枚兑换码已过期。"
          : res.reason === "space" ? "领取空间不足；请先腾出蛊位、丹囊位或检查重复遗物，兑换码不会失效。"
          : res.reason === "reward" ? "兑换码包含当前版本不存在的奖励。"
          : res.reason === "amount" ? "兑换码奖励数量无效。"
          : res.reason === "save" ? "奖励暂未能写入存档，兑换码未消耗，请稍后重试。"
          : "兑换码不对——请核对后重输。";
      }
      renderGulu();
      if (!res.ok) focusBaigushiRedeemInput(raw);
      return;
    }
    const healingSalve = event.target.closest("[data-baigushi-healing-salve]");
    if (healingSalve && !healingSalve.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "本命蛊伤势已愈" }, () => buyBaigushiHealingSalve());
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluFeed", { volumeScale: 0.85 });
      renderGulu();
      return;
    }
    const materialCrate = event.target.closest("[data-baigushi-material-crate]");
    if (materialCrate && !materialCrate.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "炉材匣已开启" }, () => buyBaigushiMaterialCrate());
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.82 });
      renderGulu();
      return;
    }
    const gradeEgg = event.target.closest("[data-baigushi-grade-egg]");
    if (gradeEgg && !gradeEgg.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "蛊卵凝阶完成" }, () => buyBaigushiGradeSeal(gradeEgg.dataset.baigushiGradeEgg));
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluFeed", { volumeScale: 0.9 });
      renderGulu();
      return;
    }
    const marrowGu = event.target.closest("[data-baigushi-marrow-gu]");
    if (marrowGu && !marrowGu.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "换髓重结完成" }, () => buyBaigushiMarrowJade(marrowGu.dataset.baigushiMarrowGu));
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.88 });
      renderGulu();
      return;
    }
    const daoFruit = event.target.closest("[data-baigushi-dao-fruit]");
    if (daoFruit && !daoFruit.disabled) {
      playGuluClick();
      const result = buyBaigushiDaoFruit();
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluFeed", { volumeScale: 1 });
      renderGulu();
      return;
    }
    /* ===== 百蛊市批量货品入口（砂囊复用 data-baigushi-forge-supply，不必单列）=====
     * 都走 runGuluReceiptAction，与既有商品同一套回执与音效，行为一致。 */
    const coreTriple = event.target.closest("[data-baigushi-core-triple]");
    if (coreTriple && !coreTriple.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "残核匣（三枚装）已开启" }, () => buyBaigushiCoreCrateTriple());
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.95 });
      renderGulu();
      return;
    }
    const twinPair = event.target.closest("[data-baigushi-twin-pair]");
    if (twinPair && !twinPair.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "双生对髓已落圃" }, () => buyBaigushiTwinMarrowPair(twinPair.dataset.baigushiTwinPair));
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.95 });
      renderGulu();
      return;
    }
    const bundleMaterial = event.target.closest("[data-baigushi-bundle-material]");
    if (bundleMaterial && !bundleMaterial.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "百草囊已解开" }, () => buyBaigushiMaterialBundle(bundleMaterial.dataset.baigushiBundleMaterial));
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.95 });
      renderGulu();
      return;
    }
    const hatchBreaker = event.target.closest("[data-baigushi-hatch-breaker]");
    if (hatchBreaker && !hatchBreaker.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "破壳锥已用" }, () => buyBaigushiHatchBreaker(hatchBreaker.dataset.baigushiHatchBreaker));
      guluNoticeText = result.text;
      renderGulu();
      return;
    }
    const forgeSupply = event.target.closest("[data-baigushi-forge-supply]");
    if (forgeSupply && !forgeSupply.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "炉料已入库" }, () => buyBaigushiForgeSupply(forgeSupply.dataset.baigushiForgeSupply));
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.95 });
      renderGulu();
      return;
    }
    const marketRecipe = event.target.closest("[data-baigushi-recipe]");
    if (marketRecipe && !marketRecipe.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "配方蛊卵已落圃" }, () => buyBaigushiRecipe(marketRecipe.dataset.baigushiRecipe));
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 });
      renderGulu();
      return;
    }
    const ecologyRecipe = event.target.closest("[data-baigushi-ecology-recipe]");
    if (ecologyRecipe && !ecologyRecipe.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "生态定向蛊卵已落圃" }, () => buyBaigushiEcologyRecipe(ecologyRecipe.dataset.baigushiEcologyRecipe));
      guluNoticeText = result.text;
      renderGulu();
      return;
    }
    const marketWard = event.target.closest("[data-baigushi-ward]");
    if (marketWard && !marketWard.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "护命蛊匣已入库" }, () => buyBaigushiDeathWard());
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.95 });
      renderGulu();
      return;
    }
    const marketMaterial = event.target.closest("[data-baigushi-material]");
    if (marketMaterial && !marketMaterial.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "炼蛊材料已入库" }, () => buyBaigushiMaterial(marketMaterial.dataset.baigushiMaterial));
      guluNoticeText = result.text;
      if (result.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.72 });
      renderGulu();
      return;
    }
    const ecologyMaterial = event.target.closest("[data-baigushi-ecology-material]");
    if (ecologyMaterial && !ecologyMaterial.disabled) {
      playGuluClick();
      const result = runGuluReceiptAction({ source: "百蛊市", title: "生态异材已入库" }, () => buyBaigushiEcologyMaterial(ecologyMaterial.dataset.baigushiEcologyMaterial));
      guluNoticeText = result.text;
      renderGulu();
      return;
    }
    const collectionFilter = event.target.closest("[data-gulu-collection-filter]");
    if (collectionFilter) {
      playGuluClick();
      guluCollectionFilter = collectionFilter.dataset.guluCollectionFilter || "all";
      renderGulu();
      return;
    }
    const guluDetail = event.target.closest("[data-gulu-detail]");
    if (guluDetail) {
      playGuluClick();
      openGuluGuDetail(guluDetail.dataset.guluDetail);
      return;
    }
    const codexEntry = event.target.closest("[data-gulu-codex]");
    if (codexEntry) {
      playGuluClick();
      if (typeof openWanGuLuEntry === "function") openWanGuLuEntry(codexEntry.dataset.guluCodex);
      return;
    }
    // V0.9.28 命名中：点到命名框以外任何处 = 提交当前命名（点击即保存），本次点击到此为止。
    // 这一条挡在戳蛊/带入塔等分支之前，杜绝命名时误戳蛊图令输入悬空、guluRenaming 卡 true。
    if (guluRenaming && !event.target.closest(".gulu-rename-box")) {
      const box = dom.guluBody && dom.guluBody.querySelector(".gulu-rename-box");
      const idxEl = box && box.closest("[data-slot-index]");
      const inp = box && box.querySelector("input");
      if (idxEl && inp) commitGuluRename(Number(idxEl.dataset.slotIndex), inp.value);
      else { guluRenaming = false; renderGulu(); } // 兜底自愈：标志真时但输入已不在
      return;
    }
    // V0.9.28 戳蛊回弹（不重渲染）
    const poke = event.target.closest("[data-gulu-poke]");
    if (poke) { guluPokeEl(poke, poke.dataset.guluPoke === "altar" ? "heartbeat" : "click"); return; }
    // V0.9.28 命名：确认/取消/开启就地输入
    const renameOk = event.target.closest("[data-gulu-rename-ok]");
    if (renameOk) { const inp = renameOk.parentElement && renameOk.parentElement.querySelector("input"); commitGuluRename(Number(renameOk.dataset.guluRenameOk), inp ? inp.value : ""); return; }
    const renameCancel = event.target.closest("[data-gulu-rename-cancel]");
    if (renameCancel) { guluRenaming = false; renderGulu(); return; }
    const renameBtn = event.target.closest("[data-gulu-rename]");
    if (renameBtn) { playGuluClick(); startGuluRename(Number(renameBtn.dataset.guluRename)); return; }
    // V0.9.35 归庐日课：点卯领材料（幂等，今日已领由 claimDailySign 兜底拒绝）
    const signEl = event.target.closest("[data-gulu-sign]");
    if (signEl && !signEl.disabled) {
      playGuluClick();
      const r = runGuluReceiptAction({ source: "归庐日课", title: "点卯所得已入库" }, () => claimDailySign());
      guluNoticeText = r.text;
      if (r.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.85 });
      renderGulu();
      if (r.ok && r.milestone) {
        showRiteOverlay({ tone: "jade", eyebrow: "归庐日课 · 满旬", seal: "旬", title: `连签 ${r.streak} 日`, text: `旬日不辍，蛊庐厚赠。\n${r.summary}`, hint: "点击任意处 · 收下", autoMs: 5000 });
      }
      return;
    }
    const hatch = event.target.closest("[data-gulu-hatch]");
    if (hatch && !hatch.disabled) {
      playGuluClick();
      const [idx, gid] = hatch.dataset.guluHatch.split(":");
      const hatchResult = runGuluReceiptAction({ source: "蛊圃", title: "蛊卵已入土" }, () => guluStartHatch(Number(idx), gid));
      guluNoticeText = hatchResult.text;
      if (hatchResult.ok) window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 }); // 落卵入土·陶罐开合
      renderGulu();
      return;
    }
    const carry = event.target.closest("[data-gulu-carry]");
    if (carry) {
      playGuluClick();
      guluNoticeText = guluToggleCarry(Number(carry.dataset.guluCarry)).text;
      renderGulu();
      return;
    }
    const release = event.target.closest("[data-gulu-release]");
    if (release) {
      playGuluClick();
      openGuluActionConfirm("release", Number(release.dataset.guluRelease));
      return;
    }
    const feed = event.target.closest("[data-gulu-feed]");
    if (feed && !feed.disabled) {
      playGuluClick();
      openGuluActionConfirm("feed", Number(feed.dataset.guluFeed));
      return;
    }
    const fusionPick = event.target.closest("[data-gulu-fusion-pick]");
    if (fusionPick && !fusionPick.disabled) {
      playGuluClick();
      const result = toggleGuluFusionPick(fusionPick.dataset.guluFusionPick);
      if (!result.ok) guluNoticeText = result.text;
      renderGulu();
      return;
    }
    const fusionConfirm = event.target.closest("[data-gulu-fusion-confirm]");
    if (fusionConfirm && !fusionConfirm.disabled) {
      playGuluClick();
      openGuluFusionConfirm();
      return;
    }
    // V0.9.51 炼蛊房：入炉升转（消耗同名同转成蛊 + 材料）。不可逆，走既有确认管线
    // （不用 window.confirm——无头浏览器会卡死，历史踩过）。
    const forge = event.target.closest("[data-gulu-forge]");
    if (forge && !forge.disabled) {
      playGuluClick();
      openGuluActionConfirm("forge", Number(forge.dataset.guluForge));
      return;
    }
  });
  maybeAutoShowUpdateLog();
  dom.loreOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openLoreOverlay();
  });
  dom.trialSettingsButton?.addEventListener("click", () => {
    playUiSfx();
    openTrialSettingsOverlay();
  });
  dom.trialSettingsCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeTrialSettingsOverlay();
  });
  dom.trialSettingsOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.trialSettingsOverlay) closeTrialSettingsOverlay();
  });
  dom.trialModeChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-trial-mode]");
    if (!choice) return;
    playUiSfx();
    setTrialMode(choice.dataset.trialMode);
  });
  dom.trialSeedInput?.addEventListener("input", (event) => {
    event.target.value = String(event.target.value).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 7);
  });
  dom.trialSeedClearButton?.addEventListener("click", () => {
    playUiSfx();
    saveTrialSeedDraft("");
  });
  dom.trialSettingsApplyButton?.addEventListener("click", () => {
    playUiSfx();
    saveTrialSeedDraft(dom.trialSeedInput?.value || "");
    if (dom.runProgress) {
      dom.runProgress.textContent = "试炼设置已保存。";
      dom.runProgress.classList.remove("hidden");
    }
    closeTrialSettingsOverlay();
  });
  dom.settingsOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openSettingsOverlay();
  });
  dom.settingsCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeSettingsOverlay();
  });
  dom.settingsOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.settingsOverlay) closeSettingsOverlay();
  });
  dom.settingsMusicToggle?.addEventListener("click", () => {
    playUiSfx();
    window.AudioManager?.toggleMute?.();
    window.setTimeout(renderSettingsOverlay, 60);
  });
  dom.settingsVolume?.addEventListener("input", (event) => {
    window.AudioManager?.setVolume?.(event.target.value);
    renderSettingsOverlay();
  });
  dom.settingsEffectToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleVisualEffects();
    renderSettingsOverlay();
  });
  dom.settingsPerfToggle?.addEventListener("click", () => {
    playUiSfx();
    cyclePerfMode();
  });
  dom.settingsLoreAnimationToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleLoreAnimationSkip();
  });
  dom.settingsHomeButton?.addEventListener("click", () => {
    confirmReturnToTitle();
  });
  dom.settingsRestartButton?.addEventListener("click", () => {
    confirmRestartRun();
  });
  dom.settingsTutorialResetButton?.addEventListener("click", () => {
    playUiSfx();
    resetNewPlayerGuidance();
  });
  dom.settingsLoreResetButton?.addEventListener("click", () => {
    playUiSfx();
    resetLoreUnlocks();
  });
  // V0.9.25 存档保险：本机备份导出（复制+下载双通道）/ 导入（校验和把关 + 导入前自动备份现档）
  // FUNNEL-1：导出动作抽为 performSaveExport，供设置页与结算页共用并记录最近导出时间。
  dom.settingsSaveExport?.addEventListener("click", async () => {
    playUiSfx();
    await performSaveExport(dom.settingsSaveExport, "导出本机备份");
  });
  dom.settingsCloudSaveSync?.addEventListener("click", async () => {
    playUiSfx();
    dom.settingsCloudSaveSync.disabled = true;
    try { await window.NMGCloudSave?.requestSync("manual"); } catch (e) { /* 云端失败不影响本机档 */ }
    finally { dom.settingsCloudSaveSync.disabled = false; }
  });
  dom.settingsCloudKeepLocal?.addEventListener("click", async () => {
    playUiSfx();
    if (!window.confirm("将用这台手机的进度覆盖当前云端存档。另一台设备上的云端进度会被替换，确定保留本机进度？")) return;
    dom.settingsCloudKeepLocal.disabled = true;
    if (dom.settingsCloudUseRemote) dom.settingsCloudUseRemote.disabled = true;
    try { await window.NMGCloudSave?.resolveConflict("local"); } catch (e) { /* 两份档均保留 */ }
    finally {
      dom.settingsCloudKeepLocal.disabled = false;
      if (dom.settingsCloudUseRemote) dom.settingsCloudUseRemote.disabled = false;
    }
  });
  dom.settingsCloudUseRemote?.addEventListener("click", async () => {
    playUiSfx();
    if (!window.confirm("将恢复云端进度并替换这台手机当前进度；替换前会在本机保留冲突备份。确定恢复云端？")) return;
    dom.settingsCloudUseRemote.disabled = true;
    if (dom.settingsCloudKeepLocal) dom.settingsCloudKeepLocal.disabled = true;
    try { await window.NMGCloudSave?.resolveConflict("cloud"); } catch (e) { /* 两份档均保留 */ }
    finally {
      dom.settingsCloudUseRemote.disabled = false;
      if (dom.settingsCloudKeepLocal) dom.settingsCloudKeepLocal.disabled = false;
    }
  });
  dom.runSummary?.addEventListener("click", async (event) => {
    const leaderboardOpen = event.target?.closest?.("[data-endless-leaderboard-open]");
    if (leaderboardOpen) { playUiSfx(); openEndlessLeaderboard(); return; }
    const leaderboardRetry = event.target?.closest?.("[data-endless-leaderboard-retry]");
    if (leaderboardRetry) {
      playUiSfx();
      await submitEndlessScoreWithStatus(getEndlessDeepestScore());
      return;
    }
    // 结算收获加发：绑定点击时 terminal run/status/outcome/精确快照；每局一次。
    const adBtn = event.target?.closest?.("#resultRewardedDouble");
    if (adBtn) {
      if (adBtn.dataset.busy === "1") return;
      if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
      const harvestContext = {
        run: runState,
        status: runState?.status,
        outcome: normalizeRunOutcome(runState?.status),
        snapshot: __lastHarvestSnapshot,
        panel: dom.runSummary,
        overlay: dom.resultOverlay,
      };
      const harvestCurrent = {
        ...harvestContext,
        panelVisible: Boolean(dom.runSummary && !dom.runSummary.classList.contains("hidden")),
        resultVisible: Boolean(dom.resultOverlay && !dom.resultOverlay.classList.contains("hidden")),
      };
      if (!isRewardedHarvestContextCurrent(harvestContext, harvestCurrent)) return;
      adBtn.dataset.busy = "1";
      adBtn.setAttribute("aria-busy", "true");
      playUiSfx();
      const label = adBtn.querySelector("strong");
      const idle = label ? label.textContent : "";
      if (label) label.textContent = "广告加载中…";
      NmgAds.showRewarded((ok) => {
        releaseRunRewardedBusy(adBtn, label, idle);
        if (ok === true) {
          const receiptBefore = captureOutgameInventory(getGuluStore());
          const summary = grantDoubledHarvest(harvestContext);
          if (summary) showOutgameReceiptFromChange(receiptBefore, getGuluStore(), { source: "结算 · 广告加发", title: "本局收获已再领", summary });
          if (summary) adBtn.setAttribute("disabled", "true");
          if (label) label.textContent = summary ? "本局已领取" : idle;
        }
      });
      return;
    }
    const btn = event.target?.closest?.("#resultSaveExport");
    if (!btn) return;
    playUiSfx();
    await performSaveExport(btn, "一键备份存档（复制并下载）");
  });
  dom.settingsSaveImportToggle?.addEventListener("click", () => {
    playUiSfx();
    const box = dom.settingsSaveImportBox;
    if (!box) return;
    const open = box.classList.toggle("hidden");
    dom.settingsSaveImportToggle.setAttribute("aria-expanded", String(!open));
    if (dom.settingsSaveImportMsg) dom.settingsSaveImportMsg.textContent = "";
  });
  dom.settingsSaveImportFile?.addEventListener("change", () => {
    const file = dom.settingsSaveImportFile.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (dom.settingsSaveImportText) dom.settingsSaveImportText.value = String(reader.result || ""); };
    reader.readAsText(file);
  });
  dom.settingsSaveImportRun?.addEventListener("click", () => {
    playUiSfx();
    const msg = dom.settingsSaveImportMsg;
    const result = parseSaveExport(dom.settingsSaveImportText?.value);
    if (!result.ok) { if (msg) { msg.textContent = result.err; msg.classList.add("is-error"); } return; }
    const stampText = result.payload.at ? new Date(result.payload.at).toLocaleString() : "未知时间";
    if (!window.confirm(`将用备份（${stampText}${result.payload.build ? " · " + result.payload.build : ""}）覆盖当前全部进度并刷新页面。\n当前档会先自动下载备份。确定导入？`)) return;
    if (msg) { msg.classList.remove("is-error"); msg.textContent = "校验通过，正在导入并重载……"; }
    if (!applySaveImport(result.payload)) { if (msg) { msg.textContent = "导入写入失败（存储不可用或空间不足），已回滚为导入前的原档，进度未受影响。"; msg.classList.add("is-error"); } }
  });
  dom.balanceOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openBalanceOverlay();
  });
  dom.balanceCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeBalanceOverlay();
  });
  dom.balanceOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.balanceOverlay) closeBalanceOverlay();
  });
  dom.balanceCopyButton?.addEventListener("click", () => {
    playUiSfx();
    copyBalanceSummary();
  });
  // FUNNEL-1 教学演武入口：更多菜单 + 教程弹窗末排
  const enterTutorialDrill = () => {
    playUiSfx();
    dom.moreMenuPanel?.classList.add("hidden");
    dom.tutorialOverlay?.classList.add("hidden");
    startTutorialDrill();
  };
  dom.tutorialDrillButton?.addEventListener("click", () => {
    playUiSfx();
    openTutorial(0);
  });
  dom.tutorialDrillFromTutorial?.addEventListener("click", enterTutorialDrill);
  dom.tutorialResetButton?.addEventListener("click", () => {
    playUiSfx();
    setMoreMenuOpen(false);
    resetNewPlayerGuidance();
  });
  dom.tutorialCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeTutorial();
  });
  dom.tutorialSkipButton?.addEventListener("click", () => {
    playUiSfx();
    closeTutorial();
  });
  dom.tutorialPrevButton?.addEventListener("click", () => {
    playUiSfx();
    previousTutorialPage();
  });
  dom.tutorialNextButton?.addEventListener("click", () => {
    playUiSfx();
    nextTutorialPage();
  });
  dom.tutorialOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.tutorialOverlay) { closeTutorial(); return; }
    const topicButton = event.target.closest("[data-guide-topic]");
    if (!topicButton) return;
    playUiSfx();
    const topic = GUIDE_TOPICS[topicButton.dataset.guideTopic];
    const detail = dom.tutorialBody?.querySelector("[data-guide-topic-detail]");
    if (!topic || !detail) return;
    dom.tutorialBody.querySelectorAll("[data-guide-topic]").forEach((button) => button.classList.toggle("is-active", button === topicButton));
    detail.innerHTML = `<h3>${topic.title}</h3><ul>${topic.lines.map((line) => `<li>${line}</li>`).join("")}</ul>`;
  });
  // V0.9.18 塔中回声：开场序章弹窗
  dom.prologueCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closePrologue();
  });
  dom.prologueSkipButton?.addEventListener("click", () => {
    playUiSfx();
    closePrologue();
  });
  dom.prologuePrevButton?.addEventListener("click", () => {
    playUiSfx();
    previousProloguePage();
  });
  dom.prologueNextButton?.addEventListener("click", () => {
    playUiSfx();
    nextProloguePage();
  });
  dom.prologueOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.prologueOverlay) closePrologue();
  });
  // V0.9.19 仪式弹窗：点任意处散场
  dom.riteOverlay?.addEventListener("click", () => { hideRiteOverlay(); });
  // V0.9.25 删卡独立弹窗：叉号/点背景 = 取消（与「返回蛊坊/休整」同路）
  dom.removePickerClose?.addEventListener("click", () => {
    playUiSfx();
    cancelShopRemovePicker();
  });
  dom.removePickerOverlay?.addEventListener("click", (event) => {
    if (event.target !== dom.removePickerOverlay) return;
    cancelShopRemovePicker();
  });
  dom.settingsPrologueButton?.addEventListener("click", () => {
    playUiSfx();
    closeSettingsOverlay();
    openPrologue({ page: 0, auto: false }); // 设置里重看：不接教程
  });
  // V0.9.29 香火供奉：关闭（按钮/背景/Esc 已在 closeTopLayerByEsc）
  dom.xianghuoClose?.addEventListener("click", () => { playGuluClick(); closeXianghuo(); });
  dom.xianghuoOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.xianghuoOverlay) closeXianghuo();
  });
  // 三入口共用委托：蛊庐长明灯 / 结算轻提示「添香火」/ 设置常驻条目 → 开弹窗；结算「不再提示」→ 落盘并隐藏本段
  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-xianghuo-open]");
    if (open) { openXianghuo(); return; } // openXianghuo 自带陶罐音，不再叠 UI 音
    const hide = event.target.closest("[data-xianghuo-hide]");
    if (hide) { playUiSfx(); setXianghuoHidePrompt(true, hide); }
  });
  // V0.9.36 年龄门槛：确认进入（唯一出口，不设背景点击/Esc 关闭，防误跳）
  dom.ageGateConfirm?.addEventListener("click", () => { try { playUiSfx(); } catch (e) { /* 忽略 */ } confirmAgeGate(); });
  // V0.9.36 平台隔离：非网页版隐藏设置页香火常驻入口（蛊庐长明灯/结算轻提示段已在各自渲染处按开关剔除）
  if (!NMG_XIANGHUO_ENABLED) dom.settingsXianghuoButton && dom.settingsXianghuoButton.classList.add("hidden");
  dom.loreCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeLoreOverlay();
  });
  dom.loreOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.loreOverlay) closeLoreOverlay();
  });
  dom.loreList?.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-lore-open]");
    if (openButton) {
      playUiSfx();
      openLoreDetail(openButton.dataset.loreOpen);
      return;
    }
    const backButton = event.target.closest("[data-lore-back]");
    if (backButton) {
      playUiSfx();
      selectedLoreId = "";
      renderLoreOverlay();
      return;
    }
    const copyButton = event.target.closest("[data-lore-copy]");
    if (copyButton) {
      playUiSfx();
      copyLoreQuote(copyButton.dataset.loreCopy);
      return;
    }
    const detail = event.target.closest("[data-lore-detail]");
    if (detail && !loreSkipAnimation) detail.classList.add("animation-complete");
  });
  dom.loreAnimationToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleLoreAnimationSkip();
  });
  dom.loreResetButton?.addEventListener("click", () => {
    playUiSfx();
    resetLoreUnlocks();
  });
  dom.battleCoachClose?.addEventListener("click", () => {
    playUiSfx();
    closeBattleCoach();
  });
  dom.startBattleButton.addEventListener("click", () => {
    playUiSfx();
    if (!ensureBenmingPathSelected()) return;
    // V0.9.8.7：若有未完成存档，先弹确认再覆盖（用户所选）。
    if (hasResumableRun()) { showNewRunOverwriteConfirm(); return; }
    preloadBattleAssets();
    startNewRun();
  });
  // V0.9.8.7 自动续局：开始界面「继续上一局」
  dom.resumeRunButton?.addEventListener("click", () => {
    playUiSfx();
    preloadBattleAssets();
    resumeRunFromAutosave();
  });
  dom.overwriteConfirmCancel?.addEventListener("click", () => {
    playUiSfx();
    dom.overwriteConfirmOverlay?.classList.add("hidden");
    refreshModalLock();
  });
  dom.overwriteConfirmOk?.addEventListener("click", () => {
    playUiSfx();
    dom.overwriteConfirmOverlay?.classList.add("hidden");
    refreshModalLock();
    beginNewRunFresh();
  });
  // V0.9.9.2 遗物抉择弹窗：收取 / 舍弃
  dom.relicOfferAccept?.addEventListener("click", () => { playUiSfx(); resolveRelicOffer(true); });
  dom.relicOfferDecline?.addEventListener("click", () => { playUiSfx(); resolveRelicOffer(false); });
  // V0.9.8.8 更新闸
  dom.updateGateButton?.addEventListener("click", () => { playUiSfx(); applyUpdateNow(); });
  dom.updateGateContinue?.addEventListener("click", () => { playUiSfx(); dismissUpdateGate(); });
  [dom.deckViewButton, dom.mapDeckButton, dom.resultDeckButton].forEach((button) => {
    button?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      playUiSfx();
      openDeckOverlay();
    });
  });
  dom.mapRoute?.addEventListener("click", (event) => {
    const node = event.target.closest("[data-map-node]");
    if (!node || node.disabled) return;
    playUiSfx();
    selectedMapNodeId = node.dataset.mapNode;
    renderMapSelection();
  });
  dom.mapNodeConfirmButton?.addEventListener("click", () => {
    if (!selectedMapNodeId || dom.mapNodeConfirmButton.disabled) return;
    selectMapNode(selectedMapNodeId);
  });
  dom.resultLoreButton?.addEventListener("click", () => {
    playUiSfx();
    openLoreOverlay();
  });
  dom.deckLoreButton?.addEventListener("click", () => {
    playUiSfx();
    openLoreOverlay();
  });
  dom.deckCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeDeckOverlay();
  });
  dom.effectToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleVisualEffects();
  });
  dom.mobileLogButton?.addEventListener("click", () => {
    playUiSfx();
    toggleMobileLogPanel();
  });
  dom.mobileAudioToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleMobileAudioPanel();
  });
  dom.mobileAudioClose?.addEventListener("click", () => {
    playUiSfx();
    closeMobileAudioPanel();
  });
  dom.deckOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.deckOverlay) { closeDeckOverlay(); return; }
    const tab = event.target.closest("[data-deck-tab]");
    if (tab) {
      playUiSfx();
      setDeckTab(tab.dataset.deckTab);
      return;
    }
    // V0.9.51 玩家反馈：局内蛊牌详情直达万蛊录全解（生态习性/来历/相济相克）。
    const codexJump = event.target.closest("[data-deck-codex]");
    if (codexJump) {
      playUiSfx();
      if (typeof openWanGuLuEntry === "function") openWanGuLuEntry(codexJump.dataset.deckCodex);
      return;
    }
    const entryButton = event.target.closest("[data-deck-entry]");
    if (entryButton) {
      if (Date.now() < suppressDeckEntryClickUntil) return;
      playUiSfx();
      selectedDeckCardId = entryButton.dataset.deckEntry;
      renderDeckOverlay();
      return;
    }
    if (event.target.closest("#deckPrevPage")) {
      playUiSfx();
      deckCardPage -= 1;
      selectedDeckCardId = "";
      renderDeckOverlay();
      return;
    }
    if (event.target.closest("#deckNextPage")) {
      playUiSfx();
      deckCardPage += 1;
      selectedDeckCardId = "";
      renderDeckOverlay();
    }
  });
  dom.deckOverlay?.addEventListener("pointerdown", beginDeckReorderGesture);
  dom.deckOverlay?.addEventListener("pointermove", moveDeckReorderGesture, { passive: false });
  dom.deckOverlay?.addEventListener("pointerup", finishDeckReorderGesture);
  dom.deckOverlay?.addEventListener("pointercancel", clearDeckReorderGesture);
  document.addEventListener("keydown", (event) => {
    if (typeof isGuluForgeResultRitualOpen === "function" && isGuluForgeResultRitualOpen()
      && (event.key === "Enter" || event.key === " " || event.key === "Escape")) {
      event.preventDefault();
      advanceGuluForgeResultRitual();
      return;
    }
    if (event.key === "Escape") closeTopLayerByEsc();
  });
  window.addEventListener("resize", handleAppViewportResize);
  window.visualViewport?.addEventListener?.("resize", handleAppViewportResize);
  window.screen?.orientation?.addEventListener?.("change", forceAppViewportSync);
  window.addEventListener("orientationchange", forceAppViewportSync);
  window.addEventListener("pageshow", forceAppViewportSync);
  window.addEventListener("focus", forceAppViewportSync);
  window.addEventListener("resize", refreshStatusScrollAffordances);
  window.addEventListener("orientationchange", refreshStatusScrollAffordances);
  // V0.9.8.7 自动续局兜底：退出/切后台时写档（saveRunStateToStorage 仅在地图态生效，不会覆盖战斗中途）。
  window.addEventListener("pagehide", () => {
    cancelAppViewportSync();
    // 冲突选云端后本机盘已是云档、内存仍是旧档；重载前绝不能让旧内存反写或触发云同步。
    if (window.NMGCloudSave?.getStatus?.()?.reloadRequired) return;
    saveRunStateToStorage();
    try { window.NMGCloudSave?.flush("pagehide"); } catch (e) { /* 云端失败不影响退出写档 */ }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      cancelAppViewportSync();
      if (window.NMGCloudSave?.getStatus?.()?.reloadRequired) return;
      saveRunStateToStorage();
      try { window.NMGCloudSave?.flush("visibility-hidden"); } catch (e) { /* 云端失败不影响本机档 */ }
      return;
    }
    forceAppViewportSync();
  });
  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest?.("[data-keyword]");
    if (target) showKeywordTooltip(target);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest?.("[data-keyword]")) hideKeywordTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest?.("[data-keyword]");
    if (target) showKeywordTooltip(target);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.("[data-keyword]")) hideKeywordTooltip();
  });
  /* 手机长按状态图标看说明（玩家/敌人共用 data-keyword） */
  let __kwLongPressTimer = null;
  document.addEventListener("touchstart", (event) => {
    const target = event.target.closest?.("[data-keyword]");
    if (!target) return;
    window.clearTimeout(__kwLongPressTimer);
    __kwLongPressTimer = window.setTimeout(() => showKeywordTooltip(target), 320);
  }, { passive: true });
  let __kwHideTimer = null;
  document.addEventListener("touchend", (event) => {
    window.clearTimeout(__kwLongPressTimer);
    // V0.9.13：停留时长按词条长度给足（每字≈90ms、2.6 秒起步）——此前固定 1.6 秒，本版新增的 30~60 字长词条根本读不完。
    // 点按其他任意位置仍会经 click 监听立刻关闭，不会挡操作。
    window.clearTimeout(__kwHideTimer);
    const kwTarget = event.target.closest?.("[data-keyword]");
    const kw = kwTarget ? kwTarget.dataset.keyword || "" : "";
    const helpText = kwTarget ? (kwTarget.dataset.statusDetail || KEYWORD_HELP[kw] || ENEMY_STATUS_HELP[kw] || "") : "";
    const stay = kwTarget ? Math.max(2600, (kw.length + helpText.length) * 90) : 1600;
    __kwHideTimer = window.setTimeout(hideKeywordTooltip, stay);
  }, { passive: true });
  document.addEventListener("touchmove", () => { window.clearTimeout(__kwLongPressTimer); }, { passive: true });
  document.addEventListener("click", (event) => {
    if (document.body.classList.contains("mobile-audio-open")) {
      const insideAudio = dom.audioControls?.contains(event.target);
      const onAudioToggle = dom.mobileAudioToggle?.contains(event.target);
      if (!insideAudio && !onAudioToggle) closeMobileAudioPanel();
    }
    const target = event.target.closest?.("[data-keyword]");
    if (target) showKeywordTooltip(target);
    else hideKeywordTooltip();
  });
  // V0.9.16 丹囊：点击芯片使用消耗品（委托，索引从 data-satchel-index 取）
  dom.satchelStrip?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-satchel-index]");
    if (chip) useBattleItem(Number(chip.dataset.satchelIndex));
  });
  dom.fateRewriteButton?.addEventListener("click", () => {
    playUiSfx();
    requestFateRewrite();
  });
  dom.poisonBorrowButton?.addEventListener("click", () => {
    playUiSfx();
    requestPoisonBorrow();
  });
  dom.boneChimeButton?.addEventListener("click", () => {
    playUiSfx();
    openBoneChime();
  });
  dom.boneChimeClose?.addEventListener("click", () => {
    playUiSfx();
    closeBoneChime();
  });
  dom.boneChimeOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.boneChimeOverlay) closeBoneChime();
  });
  dom.boneChimeSoul?.addEventListener("click", () => {
    playUiSfx();
    closeBoneChime();
    resolveBoneChime("soul");
  });
  dom.boneChimeFate?.addEventListener("click", () => {
    playUiSfx();
    closeBoneChime();
    resolveBoneChime("fate");
  });
  dom.intentCollapseButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    playUiSfx();
    setIntentCollapsed(!intentCollapsed);
  });
  dom.fateRewriteChoice?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-fate-rewrite-choice]");
    if (!choice) return;
    playUiSfx();
    completeFateRewrite({ useCandidate: choice.dataset.fateRewriteChoice === "accept" });
  });
  dom.mupanLedgerStartButton?.addEventListener("click", closeMupanLedger);
  dom.handCollapseToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleHandCollapsed();
  });
  dom.hand.addEventListener("click", (event) => {
    const cardButton = event.target.closest(".card");
    if (!cardButton) return;
    const id = cardButton.dataset.cardId;
    if (suppressCardClickId === id) {
      suppressCardClickId = "";
      return;
    }
    selectHandCard(id);
  });
  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("mobile-combat-safe")
      || document.body.classList.contains("hand-collapsed")
      || document.body.classList.contains("modal-open")) return;
    if (shouldCollapseMobileHandFromTarget(event.target)) setHandCollapsed(true);
  });
  dom.battleActionBar?.addEventListener("pointerdown", (event) => event.stopPropagation());
  dom.battleActionBar?.addEventListener("click", (event) => event.stopPropagation());
  dom.hand.addEventListener("pointerdown", beginCardLongPress);
  dom.hand.addEventListener("pointermove", (event) => {
    if (!cardPointerHold) return;
    const distance = Math.hypot(event.clientX - cardPointerHold.startX, event.clientY - cardPointerHold.startY);
    if (resolveCardPointerIntent({ elapsed: 0, distance }) === "cancel") {
      suppressCardClickId = cardPointerHold.id;
      cancelCardLongPress();
    }
  });
  dom.hand.addEventListener("pointerup", finishCardLongPress);
  dom.hand.addEventListener("pointercancel", cancelCardLongPress);
  dom.hand.addEventListener("pointerleave", (event) => {
    if (event.buttons) cancelCardLongPress();
  });
  dom.selectedCardDetailButton?.addEventListener("click", () => {
    playUiSfx();
    showSelectedCardDetails();
  });
  dom.selectedCardPlayButton?.addEventListener("click", () => {
    playUiSfx();
    playSelectedHandCard();
  });
  dom.endTurnButton.addEventListener("click", () => {
    playUiSfx();
    endTurn();
  });
  dom.logHistoryToggle.addEventListener("click", toggleOlderLogs);
  document.getElementById("stuckEscapeButton")?.addEventListener("click", () => { playUiSfx(); escapeStuckOverlay(); }); // V0.9.51 逃生口
  dom.logChatterToggle?.addEventListener("click", () => { playUiSfx(); toggleLogChatter(); }); // V0.9.51 要事/全量切换
  dom.logBattleTab?.addEventListener("click", () => switchLogChannel("battle"));
  dom.logJourneyTab?.addEventListener("click", () => switchLogChannel("journey"));
  dom.clearLogButton.addEventListener("click", () => {
    if (activeLogChannel === "journey") {
      const currentNode = getCurrentRunNode();
      const nodeText = currentNode ? `当前节点：${currentNode.name || "命途节点"}。` : "命途札记已清。";
      resetLogChannel("journey", nodeText);
      return;
    }
    if (!game) {
      resetLogChannel("battle", "战斗铭刻已清。");
      return;
    }
    resetLogChannel("battle", `第 ${clampRouteStep(getCurrentRouteStep())} 段：${game.player.definition.name}对阵${game.enemy.definition.name}。`);
    addLog(`当前第 ${game.turn} 回合；生命 ${game.player.hp}/${game.player.maxHp}，敌人生命 ${game.enemy.hp}/${game.enemy.maxHp}。`, "system-log");
  });
  dom.cardRewardChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-reward-card]");
    if (choice && !choice.disabled) selectCardRewardCandidate(choice.dataset.rewardCard); // V0.9.31 点一下只选中，确认才入组
  });
  dom.cardRewardConfirmButton?.addEventListener("click", () => { playUiSfx(); confirmCardReward(); });
  dom.cardRewardReselectButton?.addEventListener("click", resetCardRewardSelection);
  dom.skipRewardButton.addEventListener("click", () => {
    playUiSfx();
    resolveCardReward(null);
  });
  dom.materialRewardChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-material-id]");
    if (choice && !choice.disabled) selectMaterialCandidate(choice.dataset.materialId); // V0.9.31 点一下只选中，确认才取
  });
  dom.materialRewardConfirmButton?.addEventListener("click", () => { playUiSfx(); confirmMaterialReward(); });
  dom.materialRewardReselectButton?.addEventListener("click", resetMaterialSelection);
  dom.skipMaterialButton?.addEventListener("click", () => {
    playUiSfx();
    resolveMaterialReward(null);
  });
  dom.eventChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-event-choice]");
    if (choice && !choice.disabled) { selectEventChoice("event", choice.dataset.eventChoice, choice); return; } // V0.9.32 点一下只选中，确认才执行
    const restChoice = event.target.closest("[data-rest-choice]");
    if (restChoice && !restChoice.disabled) {
      const c = restChoice.dataset.restChoice;
      if (c === "remove") { resetEventSelection(); resolveRestChoice(c); return; } // 删卡本就有选牌确认，不叠一层
      selectEventChoice("rest", c, restChoice);
    }
  });
  dom.eventConfirmButton?.addEventListener("click", () => { playUiSfx(); confirmEventChoice(); });
  dom.eventReselectButton?.addEventListener("click", resetEventSelection);
  dom.eliteConfirmButton?.addEventListener("click", () => {
    playUiSfx();
    confirmEliteBattle();
  });
  dom.eliteCancelButton?.addEventListener("click", () => {
    playUiSfx();
    cancelEliteBattle();
  });
  dom.shopCardChoices?.addEventListener("click", (event) => {
    const reroll = event.target.closest("[data-shop-reroll]");
    if (reroll && !reroll.disabled) {
      playUiSfx();
      rerollShopCards();
      return;
    }
    const choice = event.target.closest("[data-shop-card-index]");
    if (choice) {
      playUiSfx();
      buyShopCard(choice.dataset.shopCardIndex);
    }
  });
  dom.shopActions?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-shop-action]");
    const action = btn?.dataset.shopAction;
    if (!action || btn.disabled) return;
    if (action === "remove") { disarmShop(); playUiSfx(); openShopRemovePicker(); return; } // 删卡本就有选牌确认
    // V0.9.32 寿元买卖二次确认：首点武装、再点成交
    if ((action === "buyLife" || action === "sellLife") && shopArmConfirm("action:" + action, btn)) return;
    playUiSfx();
    if (action === "heal") buyShopHeal();
    else if (action === "material") buyShopMaterial();
    else if (action === "item") buyShopItem(); // V0.9.16 丹囊
    else if (action === "buyLife") buyShopLifespan();
    else if (action === "sellLife") sellShopLifespan();
  });
  dom.shopRemoveChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-shop-remove-card]");
    if (choice) {
      playUiSfx();
      previewShopRemoveCard(choice.dataset.shopRemoveCard);
    }
  });
  dom.shopConfirmRemoveButton?.addEventListener("click", () => {
    playUiSfx();
    confirmShopRemoveCard();
  });
  dom.shopBackRemoveButton?.addEventListener("click", () => {
    playUiSfx();
    if (getCurrentRunNode()?.type === "rest" && !runState.lastRestChoice) {
      cancelShopRemovePicker();
      return;
    }
    dom.shopRemoveConfirm?.classList.add("hidden");
    pendingShopRemoveCardId = "";
    if (runState) runState.pendingShopRemoveCardId = "";
  });
  dom.shopCancelRemoveButton?.addEventListener("click", () => {
    playUiSfx();
    cancelShopRemovePicker();
  });
  dom.refineChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-refinement-id]");
    if (choice) {
      playUiSfx();
      chooseRefinement(choice.dataset.refinementId);
    }
  });
  dom.furnaceMaterialChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-furnace-material]");
    if (choice) {
      playUiSfx();
      selectFurnaceMaterial(choice.dataset.furnaceMaterial);
    }
  });
  dom.furnaceChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-furnace-card]");
    if (choice) {
      playUiSfx();
      selectFurnaceCandidate(choice.dataset.furnaceCard);
    }
  });
  dom.confirmFurnaceButton?.addEventListener("click", () => {
    playUiSfx();
    confirmFurnaceUpgrade();
  });
  dom.backFurnaceButton?.addEventListener("click", () => {
    playUiSfx();
    returnToFurnaceChoices();
  });
  dom.furnaceSkipButton?.addEventListener("click", () => {
    playUiSfx();
    skipFurnace();
  });
  dom.resultPrimaryButton.addEventListener("click", () => {
    playUiSfx();
    const action = dom.resultPrimaryButton.dataset.action;
    if (action === "enterLayer2") { showLayer2RouteSelect(); return; }
    else if (action === "enterLayer3") { showLayer3RouteSelect(); return; }
    else if (action === "enterTowerHeart") { enterTowerHeartFromChoice(); return; } // E-2c2 步入塔心
    else if (action === "nextFloor") advanceToNextFloor();
    else if (action === "completeNode") {
      if (runState?.activeEventId === "siming" || ["event", "shop", "rest"].includes(getCurrentRunNode()?.type)) completeOverlayNode();
      else advanceToNextFloor();
    }
    else if (action === "newRun") resetRunToTitle();
    else if (action === "mupanTestClose") closeMupanTestResult();
  });
  // V0.9.9.2 蛊坊右上角叉号 = 离开蛊坊（滚动卡住也能退出）
  dom.shopCloseButton?.addEventListener("click", () => {
    playUiSfx();
    if (getCurrentRunNode()?.type === "shop") completeOverlayNode();
    else dom.resultPrimaryButton?.click();
  });
  dom.resultSecondaryButton.addEventListener("click", () => {
    playUiSfx();
    if (dom.resultSecondaryButton.dataset.action === "settleLayer1") { settleAtLayer1(); return; }
    if (dom.resultSecondaryButton.dataset.action === "settleLayer2") { settleAtLayer2(); return; }
    resetRunToTitle();
  });
  // 战败续命：绑定点击时 run/game/node/enemy/death panel；每次重新符合死亡现场均可观看。
  dom.reviveWatchAdButton?.addEventListener("click", () => {
    const btn = dom.reviveWatchAdButton;
    if (btn.dataset.busy === "1") return;
    if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
    const reviveCurrent = getRewardedReviveCurrentContext();
    const reviveContext = {
      run: reviveCurrent.run,
      battle: reviveCurrent.battle,
      node: reviveCurrent.node,
      enemy: reviveCurrent.enemy,
      panel: reviveCurrent.panel,
      overlay: reviveCurrent.overlay,
    };
    if (!isRewardedReviveContextCurrent(reviveContext, reviveCurrent)) return;
    btn.dataset.busy = "1";
    btn.setAttribute("aria-busy", "true");
    playUiSfx();
    const label = btn.querySelector("strong");
    const idle = label ? label.textContent : "";
    if (label) label.textContent = "广告加载中…";
    // 「结束本局」始终保持可点；迟到回调会因 run/game/node/enemy/panel 任一变化而零奖。
    NmgAds.showRewarded((ok) => {
      releaseRunRewardedBusy(btn, label, idle);
      if (ok === true) {
        const current = getRewardedReviveCurrentContext();
        if (isRewardedReviveContextCurrent(reviveContext, current)) applyRewardedRevive(reviveContext);
      }
    });
  });
  dom.reviveDeclineButton?.addEventListener("click", () => {
    playUiSfx();
    declineRewardedReviveAndDie();
  });
  // 普通战奖励重抽：绑定点击时 run/node/牌面快照/panel；未选牌前可连续重抽。
  dom.rewardRerollButton?.addEventListener("click", () => {
    const btn = dom.rewardRerollButton;
    if (btn.dataset.busy === "1") return;
    if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
    if (!canOfferRewardRerollNow()) { updateRewardRerollButton(); return; }
    const rerollCurrent = getRewardedRerollCurrentContext();
    const rerollContext = {
      run: rerollCurrent.run,
      nodeId: rerollCurrent.nodeId,
      rewardKeys: rerollCurrent.rewardKeys,
      rewardKeysSnapshot: Array.isArray(rerollCurrent.rewardKeys) ? [...rerollCurrent.rewardKeys] : [],
      pendingPick: rerollCurrent.pendingPick,
      panel: rerollCurrent.panel,
      overlay: rerollCurrent.overlay,
    };
    if (!isRewardedRerollContextCurrent(rerollContext, rerollCurrent)) return;
    btn.dataset.busy = "1";
    btn.setAttribute("aria-busy", "true");
    playUiSfx();
    const label = btn.querySelector("strong");
    const idle = label ? label.textContent : "";
    if (label) label.textContent = "广告加载中…";
    NmgAds.showRewarded((ok) => {
      releaseRunRewardedBusy(btn, label, idle);
      if (ok === true) {
        const current = getRewardedRerollCurrentContext();
        if (isRewardedRerollContextCurrent(rerollContext, current)) resolveRewardRerollWatched(rerollContext);
      }
    });
  });
  // 战前加持：绑定点击时同一 running run 与可操作地图；每次完整观看继续叠层。
  dom.mapBlessAdButton?.addEventListener("click", () => {
    const btn = dom.mapBlessAdButton;
    if (btn.dataset.busy === "1") return;
    if (typeof NmgAds === "undefined" || !NmgAds.isRewardedAvailable() || !NmgAds.isSessionEligible()) return;
    const blessCurrent = getMapBlessCurrentContext();
    const mapBlessContext = { run: blessCurrent.run, panel: blessCurrent.panel };
    if (!isRewardedMapBlessContextCurrent(mapBlessContext, blessCurrent)) { updateMapBlessButton(); return; }
    btn.dataset.busy = "1";
    btn.setAttribute("aria-busy", "true");
    playUiSfx();
    const label = btn.querySelector("strong");
    const idle = label ? label.textContent : "";
    if (label) label.textContent = "广告加载中…";
    NmgAds.showRewarded((ok) => {
      releaseRunRewardedBusy(btn, label, idle);
      if (ok === true) {
        const current = getMapBlessCurrentContext();
        if (isRewardedMapBlessContextCurrent(mapBlessContext, current)) {
          const ads = ensureRunRewardedAds(mapBlessContext.run);
          const next = resolvePreBattleBless({ rewardedAds: ads });
          ads.blessCount = next.blessCount;
          ads.blessPending = next.blessPending;
          addJourneyLog(`战前加持已备 ${next.blessPending} 层：下一场累计护甲 +${PRE_BATTLE_BLESS.openArmor * next.blessPending}、攻击 +${PRE_BATTLE_BLESS.attackBonus * next.blessPending}。`, "positive-log");
          showMapNotice(`战前加持已备 ${next.blessPending} 层——可继续观看叠加。`);
          saveRunStateToStorage();
        }
      }
      updateMapBlessButton();
    });
  });
  dom.endlessWithdrawButton?.addEventListener("click", () => {
    playUiSfx();
    withdrawEndlessRun();
  });
  // 塔心场景动作委托：断契 / 整备 / 终问 / 照见 / 最终战 / 角色结局 / 返回首页
  // E-2c3.1 不可回头感：确认类动作先演出（选中燃金、其余焚毁、黑幕顿挫），随后才真正执行；特效关则立即执行。
  dom.towerHeartActions?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tower-action]");
    if (!btn || towerActionStaging) return;
    playUiSfx();
    const act = btn.dataset.towerAction;
    const run = () => {
      if (act === "gateConfirm") confirmTowerHeartGate();
      else if (act === "prepHeal") resolveTowerPrepareChoice("heal"); // E-2c3 整备四操作
      else if (act === "prepRemove") resolveTowerPrepareChoice("remove");
      else if (act === "prepMaterial") resolveTowerPrepareChoice("material");
      else if (act === "prepFeed") resolveTowerPrepareChoice("feed");
      else if (act === "questionConfirm") confirmTowerQuestion(); // E-2c3 司命终问
      else if (act === "reflectionConfirm") confirmTowerReflection(); // E-2c3 命债照见
      else if (act === "bossStart") startTowerHeartMupanBattle(); // E-2c4 终局战入口
      else if (act === "endingConfirm") confirmTowerEnding(); // E-2c4 章节通关正门
      else if (act === "returnTitle") confirmReturnToTitle();
    };
    // prepRemove 只是打开删卡选择器（可取消，非最终承诺），不做焚毁演出；返回首页走原生确认，也不演。
    const staged = ["gateConfirm", "prepHeal", "prepMaterial", "prepFeed", "questionConfirm", "reflectionConfirm", "bossStart", "endingConfirm"];
    if (!effectsEnabled || !staged.includes(act)) { run(); return; }
    towerActionStaging = true;
    btn.classList.add("is-chosen");
    dom.towerHeartActions.querySelectorAll("button").forEach((b) => {
      if (b !== btn) { b.classList.add("is-burned"); b.disabled = true; } // 其余选项焚毁成烬（选过的路不能再回头）
    });
    const veil = document.getElementById("towerHeartVeil");
    window.setTimeout(() => { if (veil) { veil.classList.remove("is-flash"); void veil.offsetWidth; veil.classList.add("is-flash"); } }, 260);
    window.setTimeout(() => { towerActionStaging = false; run(); }, 640);
  });
  dom.runSummary?.addEventListener("click", (event) => {
    const route3Btn = event.target.closest("[data-layer3-route]");
    if (route3Btn) { playUiSfx(); chooseLayer3Route(route3Btn.dataset.layer3Route); return; }
    const branch3Btn = event.target.closest("[data-layer3-branch]");
    if (branch3Btn) { playUiSfx(); chooseLayer3Branch(branch3Btn.dataset.layer3Branch); return; }
    const routeBtn = event.target.closest("[data-layer2-route]");
    if (routeBtn) { playUiSfx(); chooseLayer2Route(routeBtn.dataset.layer2Route); return; }
    const branchBtn = event.target.closest("[data-layer2-branch]");
    if (branchBtn) { playUiSfx(); chooseLayer2Branch(branchBtn.dataset.layer2Branch); return; }
  });
}

/* ===================== DEV MODE 开发者测试面板 · V0.9.6.2 ===================== */
/* 纯加性：Preview 或本机/局域网开发地址带 ?dev=kaan 时注入；正式域名根路径绝不启用。 */
/* 不改 CARD_LIBRARY / 初始卡组 / 敌人 / Boss 数值 / 音频状态机 / 手机战斗 HUD。 */
function isDevMode() {
  try {
    const host = location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1"
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    const isAllowedPath = location.pathname.includes("/preview/") || isLocalHost;
    return isAllowedPath && new URLSearchParams(location.search).get("dev") === "kaan";
  } catch (err) { return false; }
}

function devNotify(msg, cls = "system-log") {
  // 战斗中走战斗日志，否则走旅程日志，无则 console
  try {
    if (typeof game !== "undefined" && game && typeof addLog === "function") { addLog(`[DEV] ${msg}`, cls); return; }
    if (typeof addJourneyLog === "function") { addJourneyLog(`[DEV] ${msg}`, cls); return; }
  } catch (err) {}
  console.log(`[DEV] ${msg}`);
}

function devRender() { try { if (typeof render === "function") render(); } catch (err) { console.warn("[DEV] render 失败", err); } }

function devRequireBattle() {
  if (typeof game === "undefined" || !game || !game.player || !game.enemy) {
    devNotify("当前不在战斗中，此操作无效。", "damage-log");
    return false;
  }
  return true;
}

function devRequireRun() {
  if (typeof runState === "undefined" || !runState) {
    devNotify("当前无命途状态（未开始游戏）。", "damage-log");
    return false;
  }
  return true;
}

/* 测试套牌：只往当前 runState.deckCards 临时加现有 CARD_LIBRARY 卡；不存在跳过 + console.warn */
function devAddTestDeck(label, keys) {
  if (!devRequireRun()) return;
  if (typeof addRunDeckCard !== "function" || typeof CARD_LIBRARY === "undefined") {
    devNotify("加卡函数/卡库不可用。", "damage-log"); return;
  }
  let added = 0;
  keys.forEach((k) => {
    if (CARD_LIBRARY[k]) { addRunDeckCard(k); added += 1; }
    else console.warn(`[DEV] 测试套牌跳过：CARD_LIBRARY 中无 key "${k}"`);
  });
  devNotify(`已加入${label}测试套牌 ${added}/${keys.length} 张。`, "positive-log");
  devRender();
}

/* 万蛊录：解锁全部条目（卡 + 二层敌人/Boss + 残卷）。仅 dev 模式、用户主动点击时写 localStorage。 */
function devUnlockAllCodex() {
  let cardN = 0;
  if (typeof window !== "undefined" && Array.isArray(window.GU_CATALOG) && typeof markGuDiscovered === "function") {
    window.GU_CATALOG.forEach((item) => { if (item && item.cardKey) { markGuDiscovered(item.cardKey); cardN += 1; } });
  }
  // 兜底：把当前 CARD_LIBRARY 全部 key 也写入发现集合
  if (typeof CARD_LIBRARY !== "undefined" && typeof markGuDiscovered === "function") {
    Object.keys(CARD_LIBRARY).forEach((k) => markGuDiscovered(k));
  }
  // 二层敌人/Boss
  const L2_ENEMIES = ["rotleafGu", "miasmaParasite", "miasmaLanternEliteGu", "miasmaMotherBoss",
    "bloodLeechSwarm", "brokenMeridianGu", "bloodRobePriestEliteGu", "bloodRobeMotherBoss",
    "shanxiao", "rottenShanxiao", "bloodwolf", "redManeBloodwolf", "bloodwolfElite", "beeswarm", "wildBeeTide", "corpsepuppet"];
  if (typeof layer2MarkBestiary === "function") L2_ENEMIES.forEach((id) => layer2MarkBestiary(id));
  // 残卷
  if (typeof LORE_PAGES !== "undefined" && Array.isArray(LORE_PAGES) && typeof unlockLorePage === "function") {
    LORE_PAGES.forEach((p) => { if (p && p.id) unlockLorePage(p.id, { silent: true }); });
  }
  devNotify(`已解锁全部万蛊录：卡 ${cardN} 条 + 二层敌人/Boss + 残卷。`, "positive-log");
  devRender();
}

function devResetCodex() {
  try { localStorage.removeItem("niming.discoveredGu"); } catch (err) {}
  try { if (typeof LAYER2_BESTIARY_KEY !== "undefined") localStorage.removeItem(LAYER2_BESTIARY_KEY); } catch (err) {}
  try { localStorage.removeItem("nmg.layer2.progress"); } catch (err) {}
  try { if (typeof resetLoreUnlocks === "function") resetLoreUnlocks(); } catch (err) {}
  devNotify("已重置万蛊录发现数据（卡/二层敌人/二层进度/残卷）。", "important");
  devRender();
}

function devMarkLayer2Enemies() {
  const L2_ENEMIES = ["rotleafGu", "miasmaParasite", "miasmaLanternEliteGu", "miasmaMotherBoss",
    "bloodLeechSwarm", "brokenMeridianGu", "bloodRobePriestEliteGu", "bloodRobeMotherBoss",
    "shanxiao", "rottenShanxiao", "bloodwolf", "redManeBloodwolf", "bloodwolfElite", "beeswarm", "wildBeeTide", "corpsepuppet"];
  if (typeof layer2MarkBestiary !== "function") { devNotify("layer2MarkBestiary 不可用。", "damage-log"); return; }
  L2_ENEMIES.forEach((id) => layer2MarkBestiary(id));
  devNotify("已标记第二层敌人/Boss 为已遭遇。", "positive-log");
  devRender();
}

function devMarkLayer2BossDefeated() {
  if (!devRequireRun()) return;
  if (runState.layer2 && isLayer2Run()) {
    runState.layer2.bossDefeated = true;
    const rid = getCurrentRouteId();
    if (typeof layer2MarkProgress === "function") {
      layer2MarkProgress(rid === "miasma" ? "miasmaBossDefeated" : "bloodmarshBossDefeated");
    }
    devNotify("已标记第二层 Boss 已击败。", "positive-log");
  } else {
    devNotify("当前不在第二层，无法标记 Boss 击败。", "damage-log");
  }
  devRender();
}

/* 跳转：直接开一层/二层 Boss 战。设置 currentNode 后 startFloorBattle()（createBattleState 优先读 currentNode.enemyId）。 */
function devJumpBoss(opts) {
  if (!devRequireRun()) return;
  let actId = "act-outer-stairs";
  let routeId = "outer";
  if (opts.layer3) {
    actId = "act-mirror-wilds";
    routeId = opts.routeId;
    runState.mapState = createLayer3MapState(routeId);
    setMingtuActRuntimeData(runState, actId, { routeName: opts.routeName || "", branchChoice: "", bossDefeated: false, nodesCleared: 0, lastNodeName: "DEV-Boss直跳" });
  } else if (opts.layer2) {
    actId = "act-debt-depths";
    routeId = opts.routeId;
    runState.mapState = createLayer2MapState(routeId);
    setMingtuActRuntimeData(runState, actId, { routeName: opts.routeName || "", branchChoice: "", bossDefeated: false, nodesCleared: 0, lastNodeName: "DEV-Boss直跳" });
  } else {
    runState.mapState = createMapState({ seed: runState.trialSeed, mode: runState.trialMode, random: () => 0.5 });
  }
  const route = getMingtuRouteById(actId, routeId);
  setMingtuChapterMapPosition(runState, actId, routeId, route.boss.legacyStep);
  const bossNode = runState.mapState.segments.flat().find((node) => node.enemyId === route.boss.enemyId);
  enterMingtuChapterNode(runState, bossNode);
  runState.routeHistory = runState.routeHistory || []; runState.completedNodes = runState.completedNodes || [];
  devNotify(`跳转至 Boss：${opts.name}`, "important");
  if (typeof startFloorBattle === "function") startFloorBattle();
}

function devCopyToClipboard(label, obj) {
  let text;
  try { text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2); } catch (err) { text = String(obj); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => devNotify(`${label} 已复制到剪贴板。`, "system-log"))
      .catch((err) => { console.warn("[DEV] 复制失败", err); console.log(`[DEV] ${label}:`, obj); devNotify(`${label} 复制失败，已打印到 console。`, "damage-log"); });
  } else {
    console.log(`[DEV] ${label}:`, obj);
    devNotify(`剪贴板不可用，${label} 已打印到 console。`, "system-log");
  }
}

/* ===== V0.9.7 结算模拟：预置假 stats/runState 字段 + game.enemy 兜底，直接打开 showRunConclusion ===== */
/* 给当前 runState 注入一组结算所需的最小快照字段（仅用于 Dev 预览结算页，不影响真实对局逻辑）。 */
function devSeedRunStats(opts) {
  if (typeof getRunStats !== "function") return null;
  const stats = getRunStats();
  stats.deathNode = opts.deathNode || stats.deathNode || "";
  stats.deathEnemy = opts.deathEnemy || stats.deathEnemy || "";
  if (opts.layer2Entered != null) stats.layer2Entered = opts.layer2Entered;
  if (opts.layer2Route) stats.layer2Route = opts.layer2Route;
  if (opts.layer2BossDefeated != null) stats.layer2BossDefeated = opts.layer2BossDefeated;
  if (opts.bossPhase2Triggered != null) stats.bossPhase2Triggered = opts.bossPhase2Triggered;
  // V0.9.7：注入死亡上下文，使 analyzeDeathCause 死因分支可在 Dev 结算模拟中逐个点验。
  if (opts.outcome !== "dead") { stats.deathContext = undefined; return stats; }
  const __route = String(opts.layer2Route || opts.routeName || "");
  const __enemy = String(opts.deathEnemy || "");
  const __isBoss = __enemy.indexOf("母蛊") >= 0 || __enemy.indexOf("蛊母") >= 0;
  const __dc = {
    source: "enemyAttack", enemyName: __enemy || "未知敌人",
    isBoss: __isBoss, isElite: false,
    armorWas0: true, lowHp: true, playerPoison: 0,
    enemyLifesteal: __route.indexOf("血") >= 0,
    enemySwallow: __route.indexOf("瘴") >= 0,
    enemyEnrage: false, enemyCharge: false,
    enemyPhase2: !!opts.bossPhase2Triggered,
    layer: opts.layer2 ? 2 : 1, route: __route,
    floor: getCurrentRouteStep(), nodeType: "",
  };
  // 一层默认演示「护甲不足」，二层 Boss 演示「相位强化」，瘴/血路线演示吞毒/吸血。
  if (!opts.layer2) { __dc.armorWas0 = true; __dc.lowHp = false; }
  stats.deathContext = __dc;
  return stats;
}

/* 为无战斗时的结算页提供 game.enemy 兜底（showRunConclusion 读 game.enemy?.definition?.name）。 */
function devEnsureEnemyFallback(enemyId, name) {
  if (typeof game === "undefined" || !game) return;
  if (game.enemy && game.enemy.definition) return;
  const def = (typeof ENEMY_LIBRARY !== "undefined" && enemyId && ENEMY_LIBRARY[enemyId])
    ? ENEMY_LIBRARY[enemyId]
    : { name: name || "未知敌人" };
  game.enemy = game.enemy || {};
  game.enemy.definition = game.enemy.definition || def;
}

function devSimRunConclusion(opts) {
  if (!devRequireRun()) return;
  if (opts.layer2) {
    setMingtuChapterMapPosition(runState, "act-debt-depths", opts.routeId || "miasma", 1);
    setMingtuActRuntimeData(runState, "act-debt-depths", { routeName: opts.routeName || getCurrentRouteName() });
    if (opts.lastNodeName) runState.layer2.lastNodeName = opts.lastNodeName;
    if (opts.bossDefeated != null) runState.layer2.bossDefeated = opts.bossDefeated;
  }
  devSeedRunStats(opts);
  devEnsureEnemyFallback(opts.enemyId, opts.deathEnemy);
  if (typeof finalizeRun === "function") {
    finalizeRun(opts.outcome);
    devRevealRunConclusion(); // E-1c 接手修：showRunConclusion 只填内容、揭幕是调用方职责——dev 模拟也要掀开结算页
    devNotify(opts.label || "已打开模拟结算页。", "important");
  } else {
    devNotify("finalizeRun 不可用。", "damage-log");
  }
}
/* dev 模拟结算的揭幕（与 finishBattle 尾部一致：掀结算页+模态锁+视口刷新） */
function devRevealRunConclusion() {
  dom.resultOverlay?.classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (typeof updateMobileViewportState === "function") updateMobileViewportState();
}

function devSimL1Death() {
  devSimRunConclusion({ outcome: "dead", layer2: false,
    deathNode: "命途塔·塔阶", deathEnemy: "血纹狼王", enemyId: "bloodwolfElite",
    layer2Entered: false, label: "模拟：一层死亡结算。" });
}
function devSimL2Death() {
  devSimRunConclusion({ outcome: "dead", layer2: true, routeId: "miasma", routeName: "瘴林",
    lastNodeName: "瘴林·深径", bossDefeated: false,
    deathNode: "第二层·瘴林·深径", deathEnemy: "瘴林执灯者", enemyId: "miasmaLanternEliteGu",
    layer2Entered: true, layer2Route: "瘴林", layer2BossDefeated: false, label: "模拟：二层死亡结算。" });
}
function devSimMiasmaBossDeath() {
  devSimRunConclusion({ outcome: "dead", layer2: true, routeId: "miasma", routeName: "瘴林",
    lastNodeName: "瘴林·之主", bossDefeated: false,
    deathNode: "第二层·瘴林·之主", deathEnemy: "百瘴母蛊", enemyId: "miasmaMotherBoss",
    layer2Entered: true, layer2Route: "瘴林", layer2BossDefeated: false, bossPhase2Triggered: true,
    label: "模拟：败于百瘴母蛊结算。" });
}
function devSimBloodBossDeath() {
  devSimRunConclusion({ outcome: "dead", layer2: true, routeId: "bloodmarsh", routeName: "血沼",
    lastNodeName: "血沼·之主", bossDefeated: false,
    deathNode: "第二层·血沼·之主", deathEnemy: "血衣蛊母", enemyId: "bloodRobeMotherBoss",
    layer2Entered: true, layer2Route: "血沼", layer2BossDefeated: false, bossPhase2Triggered: true,
    label: "模拟：败于血衣蛊母结算。" });
}
function devSimL2Clear() {
  devSimRunConclusion({ outcome: "withdrawn", layer2: true, routeId: "miasma", routeName: "瘴林",
    lastNodeName: "瘴林·之主", bossDefeated: true,
    deathEnemy: "百瘴母蛊", enemyId: "miasmaMotherBoss",
    layer2Entered: true, layer2Route: "瘴林", layer2BossDefeated: true, label: "模拟：二层通关结算。" });
}
function devCopyRunSummary() {
  if (!devRequireRun()) return;
  if (typeof getRunStatsCopyText === "function") {
    const lines = getRunStatsCopyText();
    const text = Array.isArray(lines) ? lines.join("\n") : String(lines);
    devCopyToClipboard("本局结算反馈", text);
  } else {
    devCopyToClipboard("runState（结算数据）", runState);
  }
}

/* ===== 第三层 / 塔心 Dev 配套：死亡样本与角色结局完成样本 ===== */
function devMarkLayer3Enemies() {
  const L3 = ["bonebellGu", "skeletonPuppetGu", "boneArmorGuardGu", "boneCommanderElite", "boneNestGuardianBoss",
    "venomBeeGu", "beehiveBroodGu", "chaosSwarmHordeGu", "beehiveGuardElite", "calamityQueenBoss"];
  if (typeof layer2MarkBestiary !== "function") { devNotify("layer2MarkBestiary 不可用。", "damage-log"); return; }
  L3.forEach((id) => layer2MarkBestiary(id));
  devNotify("已标记第三层 10 敌人/Boss 为已遭遇（万蛊录）。", "positive-log"); devRender();
}
function devClearLayer3Test() {
  try { if (typeof LAYER3_PROGRESS_KEY !== "undefined") localStorage.removeItem(LAYER3_PROGRESS_KEY); } catch (e) {}
  if (typeof runState !== "undefined" && runState) {
    runState.mapState = createLayer2MapState("miasma");
    setMingtuChapterMapPosition(runState, "act-debt-depths", "miasma", 1);
    setMingtuActRuntimeData(runState, "act-debt-depths", { routeName: LAYER2_ROUTES.miasma.name });
    const s = (typeof getRunStats === "function") ? getRunStats() : null;
    if (s) { s.layer3Entered = false; s.layer3Route = ""; s.layer3BossDefeated = false; }
  }
  devNotify("已清除第三层测试状态（progress/runState.layer3/stats）。", "important"); devRender();
}
function devSimL3Death() {
  if (!devRequireRun()) return;
  runState.mapState = createLayer3MapState("bone");
  setMingtuChapterMapPosition(runState, "act-mirror-wilds", "bone", 4);
  setMingtuActRuntimeData(runState, "act-mirror-wilds", { routeName: "骨塔高陵", branchChoice: "", bossDefeated: false, nodesCleared: 2, lastNodeName: "骨塔高陵·骨甲回廊" });
  const s = getRunStats();
  s.layer3Entered = true; s.layer3Route = "骨塔高陵"; s.layer3BossDefeated = false;
  s.deathNode = "第三层 · 骨塔高陵 · 骨甲回廊"; s.deathEnemy = "骨甲蛊卫"; s.totalTurns = 10;
  // 注入第三层 deathContext，使 analyzeDeathCause 命中「骨甲僵持过久」死因（演示用，不影响真实对局）。
  s.deathContext = { source: "enemyAttack", enemyName: "骨甲蛊卫", isBoss: false, isElite: false,
    enemyBoneArmor: 4, armorWas0: true, lowHp: true, layer: 3, route: "骨塔高陵",
    enemyCharge: false, enemyPhase2: false, enemySwarm: false, enemyCounter: false };
  if (typeof devEnsureEnemyFallback === "function") devEnsureEnemyFallback("boneArmorGuardGu", "骨甲蛊卫");
  if (typeof finalizeRun === "function") { finalizeRun("dead"); devRevealRunConclusion(); devNotify("模拟：三层死亡结算（骨甲僵持死因）。", "important"); }
}
function devSimTowerHeartClear() {
  if (!devRequireRun()) return;
  runState.chapterProgress = createMingtuChapterProgress("act-tower-heart", "route-tower-heart-fixed", "tower-heart-ending", {
    completedSceneIds: ["tower-heart-gate", "tower-heart-prepare", "tower-heart-question", "tower-heart-reflection", "tower-heart-boss"],
    questionChoice: "reject-written-fate",
    reflection: { primaryId: "blood", secondaryId: "life" },
    bossStatus: "defeated",
  });
  if (!completeMingtuTowerHeartEnding(runState) || !finalizeRun("cleared")) {
    devNotify("无法模拟塔心结局完成态。", "damage-log");
    return;
  }
  devRevealRunConclusion();
  devNotify("模拟：塔心角色结局完成并通关。", "important");
}

/* E-2c2 QA：一键抵达三区 Boss 胜利后的「塔心在望」选择页（补齐塔心入境全部门槛：一二三区 Boss 记录 + boss 节点完成）。 */
function devSimTowerHeartEntry() {
  if (!devRequireRun()) return;
  if (runState.status !== "running") { devNotify(`当前局已终局（${getRunOutcomeLabel()}）——请先返回首页开一局新的，再模拟塔心入口。`, "damage-log"); return; }
  runState.mapState = createLayer3MapState("beehive");
  setMingtuChapterMapPosition(runState, "act-mirror-wilds", "beehive", 6);
  setMingtuActRuntimeData(runState, "act-debt-depths", { routeName: "瘴林深径", bossDefeated: true });
  setMingtuActRuntimeData(runState, "act-mirror-wilds", { routeName: "蜂窟魔巢", branchChoice: "", bossDefeated: true, nodesCleared: 4, lastNodeName: "蜂窟魔巢·之主" });
  const s = getRunStats();
  s.layer2BossDefeated = true; s.layer3Entered = true; s.layer3Route = "蜂窟魔巢"; s.layer3BossDefeated = true; s.deathContext = undefined;
  if (typeof devEnsureEnemyFallback === "function") devEnsureEnemyFallback("calamityQueenBoss", "灾厄蜂后");
  enterMingtuChapterNode(runState, { id: "l3-6-boss", step: 6, type: "boss", enemyId: "calamityQueenBoss", name: "灾厄蜂后" });
  if (!runState.completedNodes.includes("l3-6-boss")) runState.completedNodes.push("l3-6-boss"); // 入塔门槛：boss 节点须已完成
  showTowerHeartEntryChoice();
  devNotify("模拟：三区Boss胜利 → 塔心在望选择页。", "important");
}

/* Dev 动作映射表：id -> handler。全部调用真实游戏函数/字段后 devRender()。 */
const DEV_ACTIONS = {
  // —— 资源 ——
  "stone100": () => { if (typeof gainGuStones === "function" && devRequireRun()) { gainGuStones(100, "DEV测试"); devRender(); } },
  "stone999": () => { if (typeof gainGuStones === "function" && devRequireRun()) { gainGuStones(999, "DEV测试"); devRender(); } },
  "healFull": () => { if (!devRequireBattle()) return; game.player.hp = game.player.maxHp; if (runState) runState.currentHp = game.player.hp; devNotify("生命已回满。", "positive-log"); devRender(); },
  "hp1": () => { if (!devRequireBattle()) return; game.player.hp = 1; if (runState) runState.currentHp = 1; devNotify("当前生命设为 1。", "damage-log"); devRender(); },
  "energy3": () => { if (!devRequireBattle()) return; game.player.energy += 3; devNotify("真元 +3。", "positive-log"); devRender(); },
  "energy10": () => { if (!devRequireBattle()) return; game.player.energy += 10; devNotify("真元 +10。", "positive-log"); devRender(); },
  // —— 战斗 ——
  "enemyHp1": () => { if (!devRequireBattle()) return; game.enemy.hp = 1; devNotify("敌人生命降为 1。", "damage-log"); devRender(); },
  "killEnemy": () => { if (!devRequireBattle()) return; game.enemy.hp = 0; devNotify("立刻击败当前敌人，触发胜利结算。", "important"); if (typeof checkBattleResult === "function") checkBattleResult(); else devRender(); },
  "armor20": () => { if (!devRequireBattle()) return; if (typeof gainArmor === "function") gainArmor(20, "DEV测试"); else game.player.armor += 20; devRender(); },
  "enemyPoison10": () => { if (!devRequireBattle()) return; if (typeof applyEnemyPoison === "function") applyEnemyPoison(10, "DEV毒性", { corrosive: false }); else game.enemy.poison += 10; devRender(); },
  "clearPlayerDebuff": () => { if (!devRequireBattle()) return; game.player.poison = 0; devNotify("已清除玩家负面状态（毒）。", "positive-log"); devRender(); },
  "clearEnemyState": () => { if (!devRequireBattle()) return; game.enemy.poison = 0; game.enemy.armor = 0; game.enemy.chargedBonus = 0; game.enemy.phase2 = false; devNotify("已清除敌人状态（毒/甲/蓄势/相位标记）。", "positive-log"); devRender(); },
  "previewFurnace": () => {
    if (!devRequireRun()) return;
    runState.materials = runState.materials || {};
    MATERIAL_IDS.forEach((id) => { runState.materials[id] = Math.max(2, runState.materials[id] | 0); });
    dom.resultOverlay?.querySelector(".result-card")?.classList.remove("map-result");
    dom.resultOverlay?.classList.remove("hidden");
    document.body.classList.add("modal-open");
    openFurnace();
    document.querySelector(".dev-panel")?.classList.add("hidden");
    if (typeof updateMobileViewportState === "function") updateMobileViewportState();
  },
  // —— 跳转 ——
  "jumpL1Boss": () => devJumpBoss({ layer2: false, enemyId: "corpsepuppet", name: "尸盘监守" }),
  "jumpL2Miasma": () => { if (!devRequireRun()) return; if (typeof enterLayer2Map === "function") enterLayer2Map("miasma"); devNotify("跳转至第二层地图·瘴林。", "important"); },
  "jumpL2Blood": () => { if (!devRequireRun()) return; if (typeof enterLayer2Map === "function") enterLayer2Map("bloodmarsh"); devNotify("跳转至第二层地图·血沼。", "important"); },
  "jumpRouteSelect": () => { if (!devRequireRun()) return; if (typeof showLayer2RouteSelect === "function") showLayer2RouteSelect(); devNotify("打开第二层路线选择。", "important"); },
  "jumpMiasmaBoss": () => devJumpBoss({ layer2: true, routeId: "miasma", routeName: "瘴林", enemyId: "miasmaMotherBoss", name: "百瘴母蛊" }),
  "jumpBloodBoss": () => devJumpBoss({ layer2: true, routeId: "bloodmarsh", routeName: "血沼", enemyId: "bloodRobeMotherBoss", name: "血衣蛊母" }),
  "showConclusion": () => { if (!devRequireRun()) return; devSimTowerHeartClear(); },
  // —— 卡牌测试 ——
  "draw3": () => { if (!devRequireBattle()) return; if (typeof drawCards === "function") drawCards(3); devNotify("抽 3 张牌。", "system-log"); devRender(); },
  "rewardRandom": () => { if (!devRequireRun()) return; if (typeof getRandomRewardCardKey === "function" && typeof addRunDeckCard === "function") { const k = getRandomRewardCardKey(); addRunDeckCard(k); devNotify(`获得随机奖励牌：${k}`, "positive-log"); devRender(); } },
  "openReward": () => { if (!devRequireRun()) return; if (typeof openCardReward === "function") openCardReward(); },
  "deckPoison": () => devAddTestDeck("毒道", ["greenMiasma", "poisonReturn", "insectSwarm", "moltingShell"]),
  "deckBlood": () => devAddTestDeck("血道", ["bloodBlade", "bloodReversal", "burningEssence", "heartEater"]),
  "deckFate": () => devAddTestDeck("命势", ["fateThread", "reversePath", "fixedFate", "lifeLamp"]),
  "deckArmor": () => devAddTestDeck("护甲", ["ironSkin", "mysticCarapace", "shellRemnant", "moltedArmor"]),
  // —— 万蛊录 ——
  "codexUnlockAll": devUnlockAllCodex,
  "codexReset": devResetCodex,
  "codexMarkL2": devMarkLayer2Enemies,
  "codexMarkBoss": devMarkLayer2BossDefeated,
  // —— 结算模拟 ——
  "simL1Death": devSimL1Death,
  "simL2Death": devSimL2Death,
  "simMiasmaBossDeath": devSimMiasmaBossDeath,
  "simBloodBossDeath": devSimBloodBossDeath,
  "simL2Clear": devSimL2Clear,
  "copyRunSummary": devCopyRunSummary,
  // —— 第三层（V0.9.8） ——
  "jumpBoneMap": () => { if (!devRequireRun()) return; if (typeof enterLayer3Map === "function") enterLayer3Map("bone"); devNotify("跳转至第三层地图·骨塔高陵。", "important"); },
  "jumpBeehiveMap": () => { if (!devRequireRun()) return; if (typeof enterLayer3Map === "function") enterLayer3Map("beehive"); devNotify("跳转至第三层地图·蜂窟魔巢。", "important"); },
  "jumpBoneKing": () => devJumpBoss({ layer3: true, routeId: "bone", routeName: "骨塔高陵", enemyId: "boneNestGuardianBoss", name: "骨巢守墓王" }),
  "jumpCalamityQueen": () => devJumpBoss({ layer3: true, routeId: "beehive", routeName: "蜂窟魔巢", enemyId: "calamityQueenBoss", name: "灾厄蜂后" }),
  "jumpCommandPath": () => { if (!devRequireRun()) return; if (typeof showCommandPathChoice === "function") showCommandPathChoice(); devNotify("打开命途更深面板。", "important"); },
  "simL3Death": devSimL3Death,
  "simTowerClear": devSimTowerHeartClear,
  "simTowerHeartEntry": devSimTowerHeartEntry, // E-2c2 塔心入口选择页
  "codexMarkL3": devMarkLayer3Enemies,
  "clearL3Test": devClearLayer3Test,
  // —— 精英模式（V0.9.8.3） ——
  "eliteUnlock": () => { progression.eliteUnlocked = true; setStoredFlag(ELITE_UNLOCK_KEY, true); devNotify("精英模式已解锁。", "positive-log"); renderTitleScreen(); },
  "eliteForceNormal": () => { selectedMode = "normal"; if (runState) runState.mode = "normal"; devNotify("已强制普通模式。", "important"); renderTitleScreen(); devRender(); },
  "eliteForceElite": () => { progression.eliteUnlocked = true; setStoredFlag(ELITE_UNLOCK_KEY, true); selectedMode = "elite"; if (runState) runState.mode = "elite"; devNotify("已强制精英模式（含本局）。", "important"); renderTitleScreen(); devRender(); },
  "elitePrintMode": () => { const t = getModeTuning(); devNotify(`选择=${selectedMode} 本局=${runState?.mode || "-"}${runState?.mode === "tian" ? `(第${runState.tianTier}重)` : ""} 已解锁=${progression.eliteUnlocked} HP×${t.hpMul}/攻×${t.atkMul}/奖×${t.rewardMul}`, "system-log"); console.log("[DEV] mode", { selectedMode, runMode: runState?.mode, tianTier: runState?.tianTier, eliteUnlocked: progression.eliteUnlocked, tuning: t }); },
  "elitePrintWine": () => { if (!devRequireBattle()) return; const d = game.player.drunkStacks || 0; devNotify(`酒虫层数=${d}，下次攻击×${getDrunkMultiplier(d)}`, "system-log"); },
  "deckWine": () => devAddTestDeck("酒虫连击", ["wineWorm", "wineWorm", "moonBlade", "bloodBlade"]),
  "deckBloodFull": () => devAddTestDeck("血道全谱", ["bloodBlade", "heartEater", "bloodReversal", "bloodTide", "returnLife", "bloodRobe", "leechBlade", "bloodThirst"]),
  "eliteSimClear": () => { if (!devRequireRun()) return; devSimTowerHeartClear(); },
  "elitePrintPortrait": () => { const el = dom.enemyPortrait; const img = el && el.querySelector(".portrait-image"); devNotify(el ? `敌立绘容器 ${el.clientWidth}×${el.clientHeight}；图 ${img ? img.naturalWidth + "×" + img.naturalHeight + " fit=" + getComputedStyle(img).objectFit : "无"}` : "无 enemyPortrait", "system-log"); },
  // —— 调试 ——
  "copyRun": () => { if (!devRequireRun()) return; devCopyToClipboard("runState", runState); },
  "copyGame": () => { if (!devRequireBattle()) return; devCopyToClipboard("game", game); },
  "copyMap": () => { if (!devRequireRun()) return; devCopyToClipboard("mapState", runState.mapState); },
  "logState": () => { console.log("=== DEV runState ===", typeof runState !== "undefined" ? runState : null); console.log("=== DEV game ===", typeof game !== "undefined" ? game : null); console.log("=== DEV mapState ===", (typeof runState !== "undefined" && runState) ? runState.mapState : null); devNotify("已打印 runState/game/mapState 到 console（F12）。", "system-log"); },
  "showVersion": () => { const v = (typeof GAME_VERSION !== "undefined") ? GAME_VERSION : "-"; const b = (typeof window !== "undefined" && window.__NMG_BUILD__) ? window.__NMG_BUILD__ : "-"; devNotify(`版本：${v} | Build：${b}`, "system-log"); console.log(`[DEV] 版本：${v} | Build：${b}`); devRender(); },
  // V0.9.19 十重天批1：preview 自测指令
  "tianUnlock": () => {
    // V0.9.55：十重天与无尽的解锁条件都已改为「通关任意路线」，一个 eliteUnlocked 即可。
    progression.eliteUnlocked = true; setStoredFlag(ELITE_UNLOCK_KEY, true);
    devNotify("已补发通关标志：十重天与无尽可选（回开始界面生效）。", "positive-log");
    if (dom.startScreen && !dom.startScreen.classList.contains("hidden")) renderTitleScreen();
  },
  "tianSet9": () => {
    setTianCleared(progression.selectedHeroId, 9);
    devNotify(`${HEROES[progression.selectedHeroId]?.name || "当前蛊修"}天梯进度已设为 9（可挑战第十重）。`, "positive-log");
    if (dom.startScreen && !dom.startScreen.classList.contains("hidden")) renderTitleScreen();
  },
  "tianReset": () => {
    try { localStorage.removeItem(TIAN_TIER_KEY); } catch (e) {}
    devNotify("天梯进度已清空（全英雄回到第一重）。", "important");
    if (dom.startScreen && !dom.startScreen.classList.contains("hidden")) renderTitleScreen();
  },
  "tianPrint": () => { const p = getTianProgress(); devNotify(`天梯进度：${JSON.stringify(p)}`, "system-log"); console.log("[DEV] 十重天进度", p); },
  // E-2b2 万命母盘：全部为独立测试战，不改 chapterProgress、不触发解锁或 cleared。
  "mupanTestNormal": () => { if (devRequireRun()) startMupanTestBattle({ mode: "normal" }); },
  "mupanTestElite": () => { if (devRequireRun()) startMupanTestBattle({ mode: "elite" }); },
  "mupanTestDeath": () => { if (devRequireRun()) startMupanTestBattle({ mode: "deathtrial" }); },
  "mupanTestTian1": () => { if (devRequireRun()) startMupanTestBattle({ mode: "tian", tianTier: 1 }); },
  "mupanTestTian5": () => { if (devRequireRun()) startMupanTestBattle({ mode: "tian", tianTier: 5 }); },
  "mupanTestTian10": () => { if (devRequireRun()) startMupanTestBattle({ mode: "tian", tianTier: 10 }); },
  "mupanForceDebts": () => {
    if (!devRequireRun()) return;
    const raw = window.prompt("输入最常/次常行为：blood life fate poison armor haste", "blood,life");
    if (!raw) return;
    const [primaryDebt, secondaryDebt] = raw.split(/[，,\s/]+/).filter(Boolean);
    if (!MUPAN_DEBT_DEFINITIONS[primaryDebt] || !MUPAN_DEBT_DEFINITIONS[secondaryDebt] || primaryDebt === secondaryDebt) {
      devNotify("行为组合无效：最常与次常行为必须是两种不同类型。", "damage-log");
      return;
    }
    startMupanTestBattle({ mode: "normal", primaryDebt, secondaryDebt });
  },
  "mupanForcePhase2": () => { if (devRequireRun()) startMupanTestBattle({ mode: "normal", phase: 2 }); },
  "mupanForceFinal": () => { if (devRequireRun()) startMupanTestBattle({ mode: "normal", phase: 3 }); },
  "mupanTriggerSeal": () => {
    if (!devRequireRun()) return;
    if (!isMupanBattle()) startMupanTestBattle({ mode: "normal" });
    dom.mupanLedgerOverlay?.classList.add("hidden");
    game.inputLocked = false;
    const result = resolveMupanImmediatePursuit(game.mupan, {
      triggeredHabitId: game.mupan.core.watchedHabitId,
      balance: ENEMY_BALANCE.mupan,
    });
    game.mupan = result.state;
    if (result.triggered) performMupanImmediatePursuit(result.attack);
    else devNotify("本回合已经追击过；请结束回合后再试。", "damage-log");
  },
  "mupanTriggerArmor": () => { if (devRequireRun()) startMupanTestBattle({ mode: "normal", primaryDebt: "armor", secondaryDebt: "haste" }); },
  "mupanVfxThreshold": () => {
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden");
    document.body.classList.add("tower-heart-invitation");
    playTowerHeartThresholdVfx();
    window.setTimeout(() => document.body.classList.remove("tower-heart-invitation"), getMupanVfxDuration("threshold") + 900);
  },
  "mupanVfxEntrance": () => {
    if (!devRequireRun()) return;
    startMupanTestBattle({ mode: "normal" });
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden");
    playMupanEntranceSequence();
  },
  "mupanVfxPhase2": () => {
    if (!devRequireRun()) return;
    startMupanTestBattle({ mode: "normal", phase: 2 });
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden"); game.inputLocked = false;
    playMupanPhaseTransition(2);
  },
  "mupanVfxPhase3": () => {
    if (!devRequireRun()) return;
    startMupanTestBattle({ mode: "normal", phase: 3 });
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden"); game.inputLocked = false;
    playMupanPhaseTransition(3);
  },
  "mupanVfxSealBreak": () => {
    if (!isMupanBattle() && devRequireRun()) startMupanTestBattle({ mode: "normal" });
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden"); if (game) game.inputLocked = false;
    playMupanSealFeedback("break", "fate");
  },
  "mupanVfxSealBurn": () => {
    if (!isMupanBattle() && devRequireRun()) startMupanTestBattle({ mode: "normal" });
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden"); if (game) game.inputLocked = false;
    playMupanSealFeedback("burn", "blood");
  },
  "mupanVfxSealFail": () => {
    if (!isMupanBattle() && devRequireRun()) startMupanTestBattle({ mode: "normal" });
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden"); if (game) game.inputLocked = false;
    playMupanSealFeedback("fail", "blood");
  },
  "mupanVfxBroken": () => {
    if (!isMupanBattle() && devRequireRun()) startMupanTestBattle({ mode: "normal" });
    hideRiteOverlay();
    dom.mupanLedgerOverlay?.classList.add("hidden"); if (game) game.inputLocked = false;
    playMupanVfx("broken");
  },
  // V0.9.20 本命蛊：preview 自测指令
  "benmingAdd60": () => { addBenmingDaoxing(progression.selectedHeroId, 60); const i = getBenmingStageInfo(progression.selectedHeroId); devNotify(`${BENMING_GU[progression.selectedHeroId]?.name} 道行 +60 → ${i.dao}（${i.stageName}）。`, "positive-log"); if (dom.startScreen && !dom.startScreen.classList.contains("hidden")) renderTitleScreen(); },
  "benmingReset": () => { try { localStorage.removeItem(BENMING_KEY); } catch (e) {} __benmingCache = null; devNotify("本命蛊道行已清空（全英雄回蛊卵）。", "important"); if (dom.startScreen && !dom.startScreen.classList.contains("hidden")) renderTitleScreen(); },
  "benmingPrint": () => { const s = getBenmingStore(); devNotify(`本命蛊道行：${JSON.stringify(s)}`, "system-log"); console.log("[DEV] 本命蛊", s); },
  // V0.9.22 蛊庐：preview 自测指令
  "guluMats": () => { const s = getGuluStore(); MATERIAL_IDS.forEach((id) => { s.materials[id] = (s.materials[id] | 0) + 5; }); s.bossCores = (s.bossCores | 0) + 2; saveGuluStore(); devNotify("蛊庐入库：各材料 +5、蛊母残核 +2。", "positive-log"); },
  "guluFast": () => {
    const s = getGuluStore(); const now = guluNow(); let n = 0;
    s.slots.forEach((slot) => { if (slot && slot.state === "egg") { slot.hatchAt = now; n++; } });
    if (s.injuryUntil > now) { s.injuryUntil = now; n++; }
    saveGuluStore();
    devNotify(`时间快进：${n} 项到期。`, "important");
    // 蛊庐开着就让 renderGulu 去结算——破壳仪式演出走正常管线；没开着才静默结算
    if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) renderGulu();
    else settleGuluTime();
  },
  "guluReset": () => { try { localStorage.removeItem(GULU_KEY); } catch (e) {} __guluCache = null; devNotify("蛊庐已清空。", "important"); },
  "guluPrint": () => { const s = getGuluStore(); devNotify(`蛊庐：${JSON.stringify(s).slice(0, 200)}`, "system-log"); console.log("[DEV] 蛊庐", s); },
  // V0.9.35 QA：重置今日签到（可反复点卯自测）
  "signReset": () => { const s = getGuluStore(); s.sign = {}; saveGuluStore(); devNotify("归庐日课已重置（可再次点卯）。", "important"); if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) renderGulu(); },
  // V0.9.35 QA：灌满材料 + 残核（便于孵天品测随行）
  "guluGrantMats": () => { const s = getGuluStore(); MATERIAL_IDS.forEach((id) => { s.materials[id] = (s.materials[id] | 0) + 20; }); s.bossCores = (s.bossCores | 0) + 5; saveGuluStore(); devNotify("材料 +20/种、残核 +5。", "positive-log"); if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) renderGulu(); },
  // V0.9.35 QA：第一空圃直接放一只已成的天品·攻击蛊并入行囊（测随行加成）
  "guluGrantTian": () => { const s = getGuluStore(); const i = s.slots.findIndex((g) => !g); if (i < 0 || i >= getGuluSlotCap()) { devNotify("无可用空圃（或第四圃未辟）。", "important"); return; } s.serial += 1; s.slots[i] = { id: `gu${s.serial}`, state: "gu", grade: "tian", cardKey: "swarmBite", upgradeLevel: 2, name: "天品·群蛊噬", carry: true, startedAt: guluNow(), hatchAt: guluNow() }; saveGuluStore(); devNotify(`第 ${i + 1} 圃已放天品·攻击蛊（随行）。`, "positive-log"); if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) renderGulu(); },
};

/* 面板分类结构（按钮文案 + action id） */
const DEV_PANEL_GROUPS = [
  { title: "资源", buttons: [
    ["蛊石 +100", "stone100"], ["蛊石 +999", "stone999"],
    ["回满生命", "healFull"], ["生命设为1", "hp1"],
    ["真元 +3", "energy3"], ["真元 +10", "energy10"],
  ] },
  { title: "战斗（需战斗中）", buttons: [
    ["敌血降为1", "enemyHp1"], ["立刻击败敌人", "killEnemy"],
    ["自身 +20护甲", "armor20"], ["敌人 +10毒", "enemyPoison10"],
    ["清玩家负面", "clearPlayerDebuff"], ["清敌人状态", "clearEnemyState"],
  ] },
  { title: "跳转", buttons: [
    ["一层Boss·尸盘监守", "jumpL1Boss"],
    ["二层地图·瘴林", "jumpL2Miasma"], ["二层地图·血沼", "jumpL2Blood"],
    ["二层路线选择", "jumpRouteSelect"],
    ["百瘴母蛊(开战)", "jumpMiasmaBoss"], ["血衣蛊母(开战)", "jumpBloodBoss"],
    ["打开结算页", "showConclusion"],
  ] },
  { title: "卡牌测试", buttons: [
    ["抽3张牌", "draw3"], ["随机奖励牌", "rewardRandom"],
    ["打开选牌奖励", "openReward"], ["打开古鼎炼蛊", "previewFurnace"],
    ["加毒道套牌", "deckPoison"], ["加血道套牌", "deckBlood"],
    ["加命势套牌", "deckFate"], ["加护甲套牌", "deckArmor"],
  ] },
  { title: "万蛊录", buttons: [
    ["解锁全部条目", "codexUnlockAll"], ["重置发现数据", "codexReset"],
    ["标记二层敌人已见", "codexMarkL2"], ["标记二层Boss已击败", "codexMarkBoss"],
  ] },
  { title: "结算模拟", buttons: [
    ["模拟一层死亡", "simL1Death"], ["模拟二层死亡", "simL2Death"],
    ["败百瘴母蛊", "simMiasmaBossDeath"], ["败血衣蛊母", "simBloodBossDeath"],
    ["二层通关", "simL2Clear"], ["复制结算反馈", "copyRunSummary"],
  ] },
  { title: "第三层（V0.9.8）", buttons: [
    ["跳骨塔地图", "jumpBoneMap"], ["跳蜂窟地图", "jumpBeehiveMap"],
    ["骨巢守墓王(开战)", "jumpBoneKing"], ["灾厄蜂后(开战)", "jumpCalamityQueen"],
    ["命途更深面板", "jumpCommandPath"],
    ["模拟三层死亡", "simL3Death"], ["模拟塔心通关", "simTowerClear"], ["塔心入口", "simTowerHeartEntry"],
    ["标三层万蛊录已见", "codexMarkL3"], ["清三层测试状态", "clearL3Test"],
  ] },
  { title: "精英模式（V0.9.8.3）", buttons: [
    ["解锁精英", "eliteUnlock"], ["强制普通", "eliteForceNormal"], ["强制精英", "eliteForceElite"],
    ["打印当前模式", "elitePrintMode"], ["打印酒虫层数倍率", "elitePrintWine"],
    ["加酒虫连击套牌", "deckWine"], ["加血道全谱套牌", "deckBloodFull"],
    ["快速模拟通关", "eliteSimClear"], ["查敌立绘尺寸", "elitePrintPortrait"],
  ] },
  { title: "十重天（V0.9.19 批1）", buttons: [
    ["解锁十重天(补金印)", "tianUnlock"], ["当前蛊修通至9重", "tianSet9"],
    ["清空天梯进度", "tianReset"], ["打印天梯进度", "tianPrint"],
  ] },
  { title: "万命母盘（E-2b2）", buttons: [
    ["万命母盘最终战", "mupanTestNormal"], ["精英样本", "mupanTestElite"], ["死劫样本", "mupanTestDeath"],
    ["十重天1重", "mupanTestTian1"], ["十重天5重", "mupanTestTian5"], ["十重天10重", "mupanTestTian10"],
    ["指定最常/次常行为", "mupanForceDebts"], ["跳第二阶段", "mupanForcePhase2"], ["跳第三阶段·逼命", "mupanForceFinal"],
    ["立即触发当前追击", "mupanTriggerSeal"], ["护甲行为样本", "mupanTriggerArmor"],
  ] },
  { title: "最终战特效预览（E-2c5b.5）", buttons: [
    ["塔心阈门", "mupanVfxThreshold"], ["入场苏醒", "mupanVfxEntrance"], ["二阶段·阴阳并账", "mupanVfxPhase2"], ["三阶段·万命并书", "mupanVfxPhase3"],
    ["行为破签", "mupanVfxSealBreak"], ["封蛊燃签", "mupanVfxSealBurn"], ["命签失败", "mupanVfxSealFail"], ["盘心断裂", "mupanVfxBroken"],
  ] },
  { title: "本命蛊（V0.9.20）", buttons: [
    ["当前蛊修道行+60", "benmingAdd60"], ["清空本命蛊", "benmingReset"], ["打印道行", "benmingPrint"],
  ] },
  { title: "蛊庐（V0.9.22）", buttons: [
    ["材料+5·残核+2", "guluMats"], ["时间快进(全到期)", "guluFast"],
    ["清空蛊庐", "guluReset"], ["打印蛊庐", "guluPrint"],
    ["重置今日签到", "signReset"], ["材料+20·残核+5", "guluGrantMats"], ["放天品·随行", "guluGrantTian"],
  ] },
  { title: "调试", buttons: [
    ["复制 runState", "copyRun"], ["复制 game", "copyGame"],
    ["复制 mapState", "copyMap"], ["打印到 console", "logState"],
    ["显示版本+build", "showVersion"],
  ] },
];

let __devPanelBuilt = false;

function buildDevPanelDom() {
  if (__devPanelBuilt) return;
  __devPanelBuilt = true;

  // 角落 DEV MODE 小标识
  const badge = document.createElement("div");
  badge.className = "dev-mode-badge";
  badge.textContent = "DEV MODE";
  document.body.appendChild(badge);

  // 右下角 DEV 开关按钮
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "dev-mode-button";
  toggleBtn.textContent = "DEV";
  document.body.appendChild(toggleBtn);

  // 面板
  const panel = document.createElement("div");
  panel.className = "dev-panel hidden";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "开发者测试模式");

  const header = document.createElement("div");
  header.className = "dev-panel-header";
  header.innerHTML =
    '<div class="dev-panel-titles">' +
    '<strong class="dev-panel-title">开发者测试模式</strong>' +
    '<span class="dev-panel-sub">仅用于作者调试、录屏、平衡测试。当前数据不代表正式玩家体验。</span>' +
    '</div>';
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "dev-panel-close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "关闭");
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "dev-panel-body";
  DEV_PANEL_GROUPS.forEach((group) => {
    const sec = document.createElement("section");
    sec.className = "dev-group";
    const gh = document.createElement("button");
    gh.type = "button";
    gh.className = "dev-group-header";
    gh.innerHTML = `<span>${group.title}</span><i class="dev-group-caret">▾</i>`;
    const grid = document.createElement("div");
    grid.className = "dev-group-grid";
    group.buttons.forEach(([label, action]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dev-action-btn";
      b.textContent = label;
      b.dataset.devAction = action;
      grid.appendChild(b);
    });
    gh.addEventListener("click", () => { sec.classList.toggle("collapsed"); });
    sec.appendChild(gh);
    sec.appendChild(grid);
    body.appendChild(sec);
  });
  panel.appendChild(body);
  document.body.appendChild(panel);

  // 开关
  toggleBtn.addEventListener("click", () => { panel.classList.toggle("hidden"); });
  closeBtn.addEventListener("click", () => { panel.classList.add("hidden"); });

  // 事件委托：所有 action 按钮
  body.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-dev-action]");
    if (!btn) return;
    const action = btn.dataset.devAction;
    const handler = DEV_ACTIONS[action];
    if (typeof handler !== "function") { console.warn(`[DEV] 未知 action：${action}`); return; }
    try { handler(); }
    catch (err) { console.error(`[DEV] action "${action}" 执行出错`, err); devNotify(`操作出错：${action}（见 console）`, "damage-log"); }
  });
}

// ===================== V0.9.6.4 boot-loader 预加载清单（全相对路径，4 优先级，仅确认存在的真实文件） =====================
// priority 1 首屏必需（主角立绘 + 菜单 BGM）→ 2 一层首战（敌人立绘 + 战斗/首领 BGM + 常用 SFX）
// → 3 二层敌人/Boss 立绘 → 4 万蛊录卡牌图鉴 + 尾列 SFX。任一失败仅 console.warn + 计入完成，绝不白屏。
const PRELOAD_ASSETS = [
  // ---- 优先级 1：菜单首屏 + 主角立绘 ----
  // V0.9.38 血月塔影标题画分层（首屏必见，最高优先）
  { url: "assets/scenes/title-base.webp", type: "image", priority: 1, label: "标题画·基底" },
  { url: "assets/scenes/title-moontex.webp", type: "image", priority: 1, label: "标题画·月面" },
  { url: "assets/scenes/title-tower.webp", type: "image", priority: 1, label: "标题画·塔身" },
  { url: "assets/scenes/title-fateglow.webp", type: "image", priority: 1, label: "标题画·命线" },
  { url: "assets/scenes/title-windows.webp", type: "image", priority: 1, label: "标题画·窗火" },
  { url: "assets/scenes/title-doorglow.webp", type: "image", priority: 1, label: "标题画·门光" },
  { url: "assets/scenes/title-foga.webp", type: "image", priority: 1, label: "标题画·暖雾" },
  { url: "assets/scenes/title-fogb.webp", type: "image", priority: 1, label: "标题画·谷雾" },
  { url: "assets/portraits/hero-fate-web.jpg", type: "image", priority: 1, label: "命途主角" },
  { url: "assets/portraits/hero-blood-web.jpg", type: "image", priority: 1, label: "血道主角" },
  { url: "assets/portraits/hero-poison-web.jpg", type: "image", priority: 1, label: "毒道主角" },
  { url: "assets/portraits/hero-longevity-1-web.jpg", type: "image", priority: 1, label: "寿道主角" }, // V0.9.9：朝暮满寿档立绘(其余3档战中按需载)
  // 注：菜单/战斗/Boss BGM 不在此预载——由 audio.js 在解锁后/进战时按需加载，避免手机弱网启动抢带宽拖慢入局。
  // ---- 优先级 2：一层首战敌人立绘 + 常用 SFX（BGM 走 audio.js 懒加载）----
  { url: "assets/portraits/enemy-shanxiao-web.jpg", type: "image", priority: 2, label: "山魈" },
  { url: "assets/portraits/enemy-bloodwolf-web.jpg", type: "image", priority: 2, label: "血狼" },
  { url: "assets/portraits/enemy-beeswarm-web.jpg", type: "image", priority: 2, label: "蜂潮" },
  { url: "assets/portraits/enemy-corpsepuppet-web.jpg", type: "image", priority: 2, label: "尸傀" },
  { url: "assets/audio/sfx/card-play.mp3", type: "audio", priority: 2, label: "出牌音效" },
  { url: "assets/audio/sfx/hit-light.mp3", type: "audio", priority: 2, label: "轻击音效" },
  { url: "assets/audio/sfx/hit-heavy.mp3", type: "audio", priority: 2, label: "重击音效" },
  { url: "assets/audio/sfx/block.mp3", type: "audio", priority: 2, label: "格挡音效" },
  { url: "assets/audio/sfx/poison-apply.mp3", type: "audio", priority: 2, label: "施毒音效" },
  { url: "assets/audio/sfx/ui-click.mp3", type: "audio", priority: 2, label: "界面音效" },
  // ---- 优先级 3：二层瘴林/血沼敌人 + Boss 立绘 ----
  { url: "assets/portraits/rot-leaf-gu-insect.webp", type: "image", priority: 3, label: "腐叶蛊虫" },
  { url: "assets/portraits/green-miasma-parasite.webp", type: "image", priority: 3, label: "青瘴寄生" },
  { url: "assets/portraits/poison-vine-thrall.webp", type: "image", priority: 3, label: "毒藤傀儡" },
  { url: "assets/portraits/miasma-lantern-keeper.webp", type: "image", priority: 3, label: "瘴灯守" },
  { url: "assets/portraits/hundred-miasma-mother-gu.webp", type: "image", priority: 3, label: "百瘴母蛊" },
  { url: "assets/portraits/red-marsh-leech-swarm.webp", type: "image", priority: 3, label: "赤沼水蛭" },
  { url: "assets/portraits/severed-meridian-cultist.webp", type: "image", priority: 3, label: "断脉教徒" },
  { url: "assets/portraits/blood-mud-puppet.webp", type: "image", priority: 3, label: "血泥傀儡" },
  { url: "assets/portraits/bloodrobe-gu-sacrificer.webp", type: "image", priority: 3, label: "血袍祭蛊" },
  { url: "assets/portraits/bloodrobe-gu-mother.webp", type: "image", priority: 3, label: "血袍母蛊" },
  { url: "assets/portraits/enemy-corpsepuppet-phase2-web.jpg", type: "image", priority: 3, label: "尸傀·变" },
  // ---- 优先级 4：万蛊录卡牌图鉴 + 尾列 SFX ----
  { url: "assets/codex/gu/moonblade-gu.webp", type: "image", priority: 4, label: "月刃蛊" },
  { url: "assets/codex/gu/iron-shell-gu.webp", type: "image", priority: 4, label: "铁甲蛊" },
  { url: "assets/codex/gu/wineworm-gu.webp", type: "image", priority: 4, label: "酒虫蛊" },
  { url: "assets/codex/gu/bloodblade-gu.webp", type: "image", priority: 4, label: "血刃蛊" },
  { url: "assets/codex/gu/green-miasma-gu.webp", type: "image", priority: 4, label: "青瘴蛊" },
  { url: "assets/codex/gu/swarm-gu.webp", type: "image", priority: 4, label: "群蜂蛊" },
  { url: "assets/codex/gu/fate-thread-gu.webp", type: "image", priority: 4, label: "命丝蛊" },
  { url: "assets/codex/gu/burning-yuan-gu.webp", type: "image", priority: 4, label: "焚元蛊" },
  { url: "assets/codex/gu/heart-devour-gu.webp", type: "image", priority: 4, label: "噬心蛊" },
  { url: "assets/codex/gu/reverse-blood-gu.webp", type: "image", priority: 4, label: "逆血蛊" },
  { url: "assets/codex/gu/broken-shell-gu.webp", type: "image", priority: 4, label: "破甲蛊" },
  { url: "assets/codex/gu/inverse-path-gu.webp", type: "image", priority: 4, label: "逆命蛊" },
  { url: "assets/codex/gu/molting-shell-gu.webp", type: "image", priority: 4, label: "蜕壳蛊" },
  { url: "assets/codex/gu/return-poison-gu.webp", type: "image", priority: 4, label: "回毒蛊" },
  { url: "assets/codex/gu/bonebell-gu.webp", type: "image", priority: 4, label: "骨铃蛊" },
  { url: "assets/codex/gu/chaos-bee-gu.webp", type: "image", priority: 4, label: "乱蜂蛊" },
  { url: "assets/codex/gu/bloodmarsh-gu.webp", type: "image", priority: 4, label: "血沼蛊" },
  { url: "assets/audio/sfx/victory.mp3", type: "audio", priority: 4, label: "胜利音效" },
  { url: "assets/audio/sfx/defeat.mp3", type: "audio", priority: 4, label: "败北音效" },
  // ---- V0.9.26 蛊庐音频批（后台静默预载→经首访补录进 SW 离线缓存；BGM 4.9MB 放尾列不卡入局）----
  { url: "assets/audio/gulu/gulu-click.v1.mp3", type: "audio", priority: 4, label: "蛊庐点击" },
  { url: "assets/audio/gulu/gulu-pot.v2.mp3", type: "audio", priority: 4, label: "陶罐开合" },
  { url: "assets/audio/gulu/gulu-feed.v1.mp3", type: "audio", priority: 4, label: "喂食音" },
  { url: "assets/audio/gulu/gulu-heartbeat.v1.mp3", type: "audio", priority: 4, label: "祭坛心跳" },
  { url: "assets/audio/gulu/gulu-hatch-gray.v1.mp3", type: "audio", priority: 4, label: "破壳·凡" },
  { url: "assets/audio/gulu/gulu-hatch-green.v1.mp3", type: "audio", priority: 4, label: "破壳·灵" },
  { url: "assets/audio/gulu/gulu-hatch-purple.v1.mp3", type: "audio", priority: 4, label: "破壳·玄" },
  { url: "assets/audio/gulu/gulu-hatch-gold.v1.mp3", type: "audio", priority: 4, label: "破壳·天" },
  { url: "assets/audio/gulu/gulu-night-insects.v1.mp3", type: "audio", priority: 4, label: "夜间虫鸣" },
  { url: "assets/audio/gulu/gulu-loop.v1.mp3", type: "audio", priority: 4, label: "蛊庐音景" },
];

// 随机残卷副文案（暗黑东方·古籍感），boot-loader 启动时随机取一句。
const BOOT_SUBTITLES = [
  "残卷无言，蛊鸣自起。",
  "以蛊为刃，以命为薪。",
  "命途塔中，从来没有天命之人。",
  "毒入骨髓时，方知此身非身。",
  "千蛊噬命，唯逆者生。",
  "瘴起为林，血凝为沼，皆是修行。",
  "此卷一开，再无回头之路。",
];

// boot-loader 状态文字轮换（与优先级阶段呼应，纯展示）。
const BOOT_STATUS_TEXTS = [
  "凝神聚气，开启命途……",
  "唤醒沉睡的蛊群……",
  "推演塔中分岔之路……",
  "翻检万蛊残卷……",
  "命途已通，静候入局。",
];


/* ===================== V0.9.6.4 全屏启动加载界面 boot-loader（加性，绝不重构音频状态机） ===================== */
let bootLoaderActive = false;
const bootLoaderTimers = [];
function bootLoaderClearTimers() {
  while (bootLoaderTimers.length) {
    const id = bootLoaderTimers.pop();
    try { window.clearTimeout(id); } catch (e) {}
    try { window.clearInterval(id); } catch (e) {}
  }
}

// 预加载单个资源：成功/失败都 resolve（失败 console.warn），永不 reject，确保不白屏。
function bootPreloadAsset(asset) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => { if (settled) return; settled = true; resolve(); };
    try {
      if (asset.type === "image") {
        const img = new Image();
        img.decoding = "async";
        img.onload = done;
        img.onerror = () => { console.warn("[boot-loader] 资源加载失败：" + asset.url); done(); };
        img.src = asset.url;
        if (img.complete) done(); // 命中缓存的极端情况
      } else if (asset.type === "audio") {
        const au = document.createElement("audio");
        au.preload = "auto";
        au.muted = true;
        const onok = () => done();
        au.addEventListener("canplaythrough", onok, { once: true });
        au.addEventListener("loadeddata", onok, { once: true });
        au.addEventListener("error", () => { console.warn("[boot-loader] 资源加载失败：" + asset.url); done(); }, { once: true });
        au.src = asset.url;
        try { au.load(); } catch (e) { console.warn("[boot-loader] 音频 load 异常：" + asset.url); done(); }
      } else {
        done();
      }
    } catch (err) {
      console.warn("[boot-loader] 预加载异常：" + (asset && asset.url), err);
      done();
    }
  });
}

// 淡出并彻底隐藏 boot-loader（清定时器、解除滚动锁，无残留）。
function bootLoaderHide() {
  const el = document.getElementById("bootLoader");
  bootLoaderActive = false;
  bootLoaderClearTimers();
  document.body.classList.remove("boot-active");
  if (!el) return;
  el.classList.add("boot-hidden");
  const tid = window.setTimeout(() => {
    if (el && el.parentNode) el.parentNode.removeChild(el); // 彻底移除，释放装饰动画/DOM
  }, 700);
  // 该计时器属于隐藏阶段，单独跟踪以便页面卸载时清理。
  bootLoaderTimers.push(tid);
}

// 「点击入局」：调现有音频解锁 + 触发菜单 BGM（不重构状态机、不叠播），随后淡出进主菜单。
function bootLoaderEnter() {
  const btn = document.getElementById("bootLoaderStart");
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try { playUiSfx(); } catch (e) {}
  try { window.AudioManager && window.AudioManager.unlockAudio && window.AudioManager.unlockAudio(); } catch (e) {}
  // 触发菜单 BGM 淡入（解锁后此调用方能过守门）；与现有 showMapScreen 的菜单场景一致，不另开通道。
  try { window.AudioManager && window.AudioManager.playScene && window.AudioManager.playScene("menu", { duration: 600, quiet: true }); } catch (e) {}
  bootLoaderHide();
}

// boot-loader 主流程：显示→随机文案→逐个预加载更新进度→完成/超时(最大10s)放行→显「点击入局」。
function initBootLoader() {
  const el = document.getElementById("bootLoader");
  if (!el) { return; } // 无标记则不阻塞，正常进菜单（容错）
  bootLoaderActive = true;
  document.body.classList.add("boot-active");

  const fillEl = document.getElementById("bootLoaderFill");
  const percentEl = document.getElementById("bootLoaderPercent");
  const statusEl = document.getElementById("bootLoaderStatus");
  const subtitleEl = document.getElementById("bootLoaderSubtitle");
  const startBtn = document.getElementById("bootLoaderStart");

  // 随机残卷副文案
  try {
    if (subtitleEl && Array.isArray(BOOT_SUBTITLES) && BOOT_SUBTITLES.length) {
      subtitleEl.textContent = BOOT_SUBTITLES[Math.floor(Math.random() * BOOT_SUBTITLES.length)];
    }
  } catch (e) {}

  // 状态文字轮换（纯展示，2.2s 一换）
  let statusIdx = 0;
  if (statusEl && typeof BOOT_STATUS_TEXTS !== "undefined" && Array.isArray(BOOT_STATUS_TEXTS) && BOOT_STATUS_TEXTS.length) {
    statusEl.textContent = BOOT_STATUS_TEXTS[0];
    const rot = window.setInterval(() => {
      if (!bootLoaderActive) return;
      statusIdx = (statusIdx + 1) % BOOT_STATUS_TEXTS.length;
      statusEl.textContent = BOOT_STATUS_TEXTS[statusIdx];
    }, 2200);
    bootLoaderTimers.push(rot);
  }

  const list = (typeof PRELOAD_ASSETS !== "undefined" && Array.isArray(PRELOAD_ASSETS)) ? PRELOAD_ASSETS.slice() : [];
  // V0.9.8.2 启动提速：只让 priority<=1（首屏必需的主角立绘）阻塞「入局」按钮；
  // priority>=2（一层敌人立绘 / SFX / 各层图鉴图）后台静默预载，不卡入局、不计入进度。
  const blocking = list.filter((a) => (a && typeof a.priority === "number" ? a.priority : 99) <= 1);
  const background = list.filter((a) => (a && typeof a.priority === "number" ? a.priority : 99) > 1);
  const total = blocking.length || 1;
  let completed = 0;
  let revealed = false;

  const updateProgress = () => {
    const pct = Math.min(100, Math.round((completed / total) * 100));
    if (fillEl) fillEl.style.width = pct + "%";
    if (percentEl) percentEl.textContent = String(pct);
  };
  updateProgress();

  const reveal = (timedOut) => {
    if (revealed) return;
    revealed = true;
    if (fillEl) fillEl.style.width = "100%";
    if (percentEl) percentEl.textContent = "100";
    if (statusEl) statusEl.textContent = timedOut ? "命途已通（部分资源延后），可入局。" : "命途已通，静候入局。";
    if (startBtn) {
      startBtn.classList.remove("hidden");
      startBtn.addEventListener("click", bootLoaderEnter, { once: false });
    } else {
      // 极端容错：无按钮则直接淡出（不在非用户手势路径解锁音频）
      bootLoaderHide();
    }
  };

  // 只等首屏资源，超时缩到 6s（弱网/离线也快速放行不卡死）
  const timeoutId = window.setTimeout(() => { reveal(true); }, 6000);
  bootLoaderTimers.push(timeoutId);

  if (!blocking.length) {
    reveal(false);
  } else {
    Promise.all(blocking.map((asset) =>
      bootPreloadAsset(asset).then(() => {
        completed += 1;
        updateProgress();
      })
    )).then(() => {
      try { window.clearTimeout(timeoutId); } catch (e) {}
      reveal(false);
    }).catch(() => {
      // Promise.all 在子 promise 永不 reject 的前提下不会走到此分支，仍兜底放行
      reveal(false);
    });
  }
  // 首屏资源发起后再启动后台预载，避免抢占首屏带宽；永不 reject、失败忽略。
  background.forEach((asset) => { try { bootPreloadAsset(asset).catch(() => {}); } catch (e) {} });
}
// 页面卸载时清理 boot-loader 定时器，避免泄漏
window.addEventListener("pagehide", bootLoaderClearTimers);
/* ===================== /V0.9.6.4 boot-loader ===================== */

function initDevMode() {
  if (!isDevMode()) return; // 门控不满足：不注入任何 DOM / 按钮
  document.body.classList.add("dev-mode-on");
  buildDevPanelDom();
  console.log("[DEV] 开发者测试模式已启用（preview + dev=kaan）。");
}
/* =================== /DEV MODE =================== */

/* ===================== V0.9.8.8 游戏内更新闸 =====================
 * 静态站靠版本化快照(game.vXXXX/style.vXXXX)防缓存，但 index.html 本身会被浏览器/CDN 缓存 ~10 分钟，
 * 导致更新后玩家仍打开旧版。这里加一道更新闸：每次进游戏拉取不缓存的 version.json，与当前已加载 build 比对，
 * 发现线上更新即弹「立即更新」(用查询串强制刷新绕过缓存)，不更新挡住开始界面。失败/离线不阻断；
 * 强制刷新一次后仍不一致(CDN 缓存延迟)给「先以当前版本继续」逃生口，绝不锁死玩家。 */
const VERSION_MANIFEST_URL = "version.json";
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
const UPDATE_CHECK_THROTTLE_MS = 5000;
let updateCheckPromise = null;
let lastUpdateCheckAt = 0;
function checkForUpdate(options = {}) {
  const loaded = window.__NMG_BUILD__ || "";
  if (!loaded) return Promise.resolve(null); // 拿不到当前 build 不检查，避免误判
  const force = options === true || Boolean(options && options.force);
  const now = Date.now();
  if (updateCheckPromise) return updateCheckPromise;
  if (!force && now - lastUpdateCheckAt < UPDATE_CHECK_THROTTLE_MS) return Promise.resolve(null);
  lastUpdateCheckAt = now;
  let url;
  try { url = VERSION_MANIFEST_URL + "?_=" + now; } catch (e) { return Promise.resolve(null); }
  updateCheckPromise = fetch(url, { cache: "no-store" })
    .then((r) => (r && r.ok ? r.json() : null))
    .then((m) => {
      const latest = m && typeof m.build === "string" ? m.build : "";
      if (!latest || latest === loaded) return null; // 已是最新 / 清单无效
      const tried = /[?&]_upd=/.test(location.search); // 是否已强制刷新过一次
      showUpdateGate(latest, tried);
      return latest;
    })
    .catch(() => null) // 离线/检查失败：不阻断，恢复网络后会再次检查
    .finally(() => { updateCheckPromise = null; });
  return updateCheckPromise;
}
function setupUpdateDeliveryChecks() {
  const checkWhileVisible = () => {
    if (document.visibilityState === "hidden") return;
    checkForUpdate();
  };
  window.addEventListener("pageshow", checkWhileVisible);
  window.addEventListener("focus", checkWhileVisible);
  window.addEventListener("online", checkWhileVisible);
  document.addEventListener("visibilitychange", checkWhileVisible);
  window.setInterval(checkWhileVisible, UPDATE_CHECK_INTERVAL_MS);
}
// 安卓 WebView onResume 使用的稳定入口；网页端生命周期监听也走同一检查器。
window.NMGCheckForUpdate = () => checkForUpdate({ force: true });
window.NMGOnAndroidResume = () => forceAppViewportSync();
function showUpdateGate(latest, tried) {
  if (!dom.updateGateOverlay) return;
  if (dom.updateGateText) {
    dom.updateGateText.textContent = tried
      ? "新版本正在生效，可能是网络缓存延迟。可稍候重开，或先以当前版本继续。"
      : "命途已有新版本。请更新后继续修行——旧版可能与最新内容不一致。";
  }
  if (dom.updateGateHint) dom.updateGateHint.textContent = `最新版本：${latest}`;
  if (dom.updateGateButton) dom.updateGateButton.textContent = tried ? "重试更新" : "立即更新";
  if (dom.updateGateContinue) dom.updateGateContinue.classList.toggle("hidden", !tried); // 仅在已试过一次后露逃生口
  dom.updateGateOverlay.classList.remove("hidden");
  document.body.classList.add("update-gated");
}
function applyUpdateNow() {
  try {
    // V0.9.12.1 修复：此前强刷会丢弃全部原查询参数（?dev=kaan 等随之丢失）——保留原参数，仅更新 _upd。
    // V0.9.24 注：装了 SW(sw.js) 后导航由其接管——SW 对导航按 no-store 直取网络且保留本查询串，
    // "绕缓存"语义不变；若网络慢到超时，本次会回缓存旧版，但 SW 会后台把新版成套回填，下次启动即新。
    const params = new URLSearchParams(location.search);
    params.set("_upd", String(Date.now()));
    location.replace(location.pathname + "?" + params.toString()); // 查询串绕过 index.html 缓存，强制取最新
  } catch (e) { location.reload(); }
}
function dismissUpdateGate() {
  dom.updateGateOverlay?.classList.add("hidden");
  document.body.classList.remove("update-gated");
}

async function bootstrapCloudSaveBeforeGameInit() {
  let result;
  try { result = await window.NMGCloudSave?.bootstrap?.(); }
  catch (e) { return true; }
  if (!result?.reloadRequired) return true;
  try { window.location.reload(); } catch (e) { /* 重载失败也不得用旧内存继续进入游戏 */ }
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();
  initCloudSaveUi();
  if (!(await bootstrapCloudSaveBeforeGameInit())) return;
  try { document.querySelectorAll("[data-age-num]").forEach((el) => { el.textContent = SUGGESTED_AGE; }); } catch (e) { /* 忽略 */ } // V0.9.36 年龄数字单一来源：全页占位注入
  initLoreSystem();
  initEffectSettings();
  initPerfMode();
  initTitleSceneAmbience(); // V0.9.38 血月塔影标题画（须在 initEffectSettings 之后读 effectsEnabled）
  initTrialSettings();
  // V0.9.51 修：录屏模式整体移除时删了 initRecordingMode 定义，却漏删这处调用——
  // 它抛 ReferenceError 直接中断初始化链，导致其后的 bindEvents 从未执行、全页按钮点击失效。
  updateTrialModeControls();
  bindEvents();
  startStuckWatchdog(); // V0.9.51 卡死逃生水位线
  updateMobileViewportState();
  // V0.9.6.4：先启动全屏 boot-loader（已在 DOM 中、z-index 最高、盖住主菜单与 DEV 按钮）。
  // 预加载资源、显进度，玩家点击「入局」→解锁音频→淡出后才露出下方主菜单与 DEV 按钮。
  initBootLoader();
  showStartScreen();
  initDevMode();
  setupUpdateDeliveryChecks();
  checkForUpdate({ force: true }); // 首次进入立即检查；后续由前台恢复与可见轮询接管
});
