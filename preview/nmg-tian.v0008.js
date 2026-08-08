"use strict";
/* nmg-tian.js：V0.9.36 批次B-6b，十重天模式解析、天梯进度、重数修饰与调参辅助。
 * 须在 game.v 之前加载；这里只保留纯十重天核心，选人页/开局/结算等主流程仍由 game.js 调用。 */

/* V0.9.9 子批6：解析本局生效模式——未解锁一律降级（防越权/坏档）。
 * V0.9.55 移除死劫：十重天改由「通关任意路线」解锁，与精英/无尽同门槛；
 * deathtrial 从此不再是可开的新局（老档进行中的死劫局由 runState.mode 自带，不经此函数）。 */
function resolveRunMode() {
  if (selectedMode === "tian" && progression.eliteUnlocked) return "tian";
  if (selectedMode === "elite" && progression.eliteUnlocked) return "elite";
  if (selectedMode === "endless" && progression.eliteUnlocked) return "endless"; // V0.9.51 无尽：与精英同门槛
  return "normal";
}

/* ===== V0.9.19 十重天（批1）：死劫金印后的天梯难度，十重递进、按英雄独立爬塔。 =====
 * 数值基线=精英档；每重叠加一条修饰（本批实装数值重一/二/九/十，三~八规则重下批接入）。
 * 进度存 nmg.tianTier（JSON：{heroId: 已通最高重}），第 N 重通关解锁第 N+1 重，可回打低重。 */
const TIAN_TIER_KEY = "nmg.tianTier";
const TIAN_MAX_TIER = ENEMY_BALANCE.tian.maxTier;
/* 十重天组合不是 UI 缓存：它是 runState 中可复核的难度契约。
 * 同一命途种子、敌人和重天必定导出同一组规则，旧档缺失时仅补齐契约，
 * 不触碰奖励、路线或随机序列。 */
const TIAN_MECHANIC_SCHEMA = 1;
const TIAN_MECHANIC_PRIMARY = Object.freeze({
  id: "tian_frequency",
  family: "frequency",
  warningId: "tian-frequency",
  title: "天压连袭",
  detail: "攻击额外追加一段。",
});
const TIAN_MECHANIC_SECONDARIES = Object.freeze([
  Object.freeze({ id: "tian_poison_dot", family: "poison_dot", warningId: "tian-poison", title: "蚀命毒息", detail: "攻击附加 1 层毒性。", field: "playerPoison" }),
  Object.freeze({ id: "tian_draw_reduction", family: "draw_reduction", warningId: "tian-draw", title: "乱识铃压", detail: "攻击使你下回合少抽 1 张。", field: "disorientBell" }),
  Object.freeze({ id: "tian_energy_reduction", family: "energy_reduction", warningId: "tian-energy", title: "锁窍天压", detail: "攻击使你下回合真元恢复 -1。", field: "energyDrain" }),
  Object.freeze({ id: "tian_hand_size_reduction", family: "hand_size_reduction", warningId: "tian-hand", title: "束手天网", detail: "攻击使你下回合手牌上限 -1。", field: "handSizePenalty" }),
]);
const TIAN_MECHANIC_PHASE = Object.freeze({
  id: "tian_phase_rewrite",
  warningId: "tian-phase",
  title: "天相改写",
  detail: "半血后攻击额外 +2。",
});
const TIAN_MECHANIC_CONFLICTS = Object.freeze([
  Object.freeze(["draw_reduction", "hand_size_reduction"]),
  Object.freeze(["energy_reduction", "hand_size_reduction"]),
]);
// 各重修饰的名目与说明（批1 先全部列出，三~八标注待实装，进塔前所见即所得）。
const TIAN_TIER_MODS = Object.freeze([
  { tier: 1, name: "塔压加身", desc: "敌人生命 +15%", live: true },
  { tier: 2, name: "凶戾", desc: "敌人攻击 +10%", live: true },
  { tier: 3, name: "薄囊", desc: "丹囊上限 3→2", live: true },
  { tier: 4, name: "贵市", desc: "蛊坊价格 +25%", live: true },
  { tier: 5, name: "蚀寿", desc: "踏入二层/三层时各焚 1 点寿元", live: true },
  { tier: 6, name: "炉险", desc: "炼蛊反噬概率 +10%", live: true },
  { tier: 7, name: "天妒", desc: "稀有牌出率减半", live: true },
  { tier: 8, name: "孤行", desc: "本命遗物仅前两枚可选", live: true },
  { tier: 9, name: "残躯", desc: "生命上限 -10%", live: true },
  { tier: 10, name: "逆命天", desc: "Boss 血/攻再 +20%，无续局", live: true },
]);
let selectedTianTier = 1; // 会话内选择的挑战重数；渲染时按当前英雄进度收敛
function clampTianTier(tier) { return Math.max(1, Math.min(TIAN_MAX_TIER, Math.floor(Number(tier) || 1))); }
function getTianProgress() {
  try { return JSON.parse(localStorage.getItem(TIAN_TIER_KEY)) || {}; } catch (e) { return {}; }
}
function getTianCleared(heroId) {
  const v = Number(getTianProgress()[heroId]);
  return Number.isFinite(v) ? Math.max(0, Math.min(TIAN_MAX_TIER, Math.floor(v))) : 0;
}
function setTianCleared(heroId, tier) {
  try {
    const p = getTianProgress();
    p[heroId] = Math.max(getTianCleared(heroId), clampTianTier(tier));
    localStorage.setItem(TIAN_TIER_KEY, JSON.stringify(p));
  } catch (e) { /* 存储不可用则忽略 */ }
}
function getTianMaxSelectable(heroId) { return Math.min(TIAN_MAX_TIER, getTianCleared(heroId) + 1); }

function tianMechanicHash(value) {
  let hash = 2166136261;
  const source = String(value || "");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validateTianMechanicFamilies(rawFamilies) {
  // nmg-tian 先于 PVE 模块加载；进入战斗后的选择则复用 Task9 的同一冲突白名单。
  if (window.NmgPveMechanics?.validatePressureRules) return window.NmgPveMechanics.validatePressureRules(rawFamilies);
  const accepted = [];
  const rejected = [];
  (Array.isArray(rawFamilies) ? rawFamilies : []).map((family) => String(family || "")).filter(Boolean).forEach((family) => {
    const passiveDot = /_dot$/.test(family);
    const conflicts = TIAN_MECHANIC_CONFLICTS.some((pair) => pair.includes(family) && pair.some((entry) => accepted.includes(entry)));
    const duplicateDot = passiveDot && accepted.some((entry) => /_dot$/.test(entry));
    if (conflicts || duplicateDot) rejected.push(family);
    else accepted.push(family);
  });
  return Object.freeze({ accepted: Object.freeze(accepted), rejected: Object.freeze(rejected) });
}

function deriveTianMechanicSelection(seed, enemyId, tier, enemyDefinition) {
  const resolvedTier = clampTianTier(tier);
  const source = `${String(seed || "")}:${String(enemyId || "")}:${resolvedTier}`;
  const isPhaseTarget = enemyDefinition?.isElite === true || enemyDefinition?.isBoss === true;
  const secondaryAllowed = resolvedTier >= 4;
  const phaseRewrite = resolvedTier >= 7 && resolvedTier <= 9 && isPhaseTarget;
  const secondaryIndex = tianMechanicHash(`${source}:secondary`) % TIAN_MECHANIC_SECONDARIES.length;
  const requestedSecondary = secondaryAllowed ? [TIAN_MECHANIC_SECONDARIES[secondaryIndex].family] : [];
  const validation = validateTianMechanicFamilies(requestedSecondary);
  const secondary = validation.accepted.length
    ? TIAN_MECHANIC_SECONDARIES.find((rule) => rule.family === validation.accepted[0]) || null
    : null;
  const pressures = [TIAN_MECHANIC_PRIMARY, ...(secondary ? [secondary] : [])];
  const warningIds = pressures.map((rule) => rule.warningId);
  return Object.freeze({
    schema: TIAN_MECHANIC_SCHEMA,
    seed: String(seed || ""),
    enemyId: String(enemyId || ""),
    tier: resolvedTier,
    primary: TIAN_MECHANIC_PRIMARY.id,
    secondary: secondary?.id || "",
    phaseRewrite: phaseRewrite ? TIAN_MECHANIC_PHASE.id : "",
    pressureIds: Object.freeze(pressures.map((rule) => rule.id)),
    warningIds: Object.freeze(warningIds),
    phaseWarningId: phaseRewrite ? TIAN_MECHANIC_PHASE.warningId : "",
    rejectedFamilies: validation.rejected,
  });
}

function normalizeTianMechanicSelections(run) {
  if (!run || typeof run !== "object" || run.mode !== "tian") return null;
  const source = run.tianMechanics && typeof run.tianMechanics === "object" ? run.tianMechanics : {};
  const selections = source.selections && typeof source.selections === "object" ? source.selections : {};
  run.tianMechanics = { schema: TIAN_MECHANIC_SCHEMA, selections: { ...selections } };
  return run.tianMechanics;
}

function getTianMechanicSelection(run, enemyId, enemyDefinition) {
  if (!run || run.mode !== "tian") return null;
  const store = normalizeTianMechanicSelections(run);
  const key = String(enemyId || "");
  const seed = String(run.trialSeed || run.seed || "");
  const tier = clampTianTier(run.tianTier);
  const expected = deriveTianMechanicSelection(seed, key, tier, enemyDefinition);
  const saved = store.selections[key];
  if (!saved || saved.schema !== TIAN_MECHANIC_SCHEMA || saved.seed !== expected.seed
    || saved.enemyId !== expected.enemyId || saved.tier !== expected.tier) {
    store.selections[key] = { ...expected, warningIds: [...expected.warningIds], pressureIds: [...expected.pressureIds], rejectedFamilies: [...expected.rejectedFamilies] };
  }
  return Object.freeze({ ...store.selections[key], warningIds: Object.freeze([...(store.selections[key].warningIds || [])]), pressureIds: Object.freeze([...(store.selections[key].pressureIds || [])]), rejectedFamilies: Object.freeze([...(store.selections[key].rejectedFamilies || [])]) });
}

function getTianMechanicRule(ruleId) {
  if (ruleId === TIAN_MECHANIC_PRIMARY.id) return TIAN_MECHANIC_PRIMARY;
  if (ruleId === TIAN_MECHANIC_PHASE.id) return TIAN_MECHANIC_PHASE;
  return TIAN_MECHANIC_SECONDARIES.find((rule) => rule.id === ruleId) || null;
}

function formatTianMechanicSelection(selection) {
  if (!selection) return "无额外天机";
  const labels = [...(selection.pressureIds || []), selection.phaseRewrite].filter(Boolean)
    .map((ruleId) => getTianMechanicRule(ruleId)?.title).filter(Boolean);
  return labels.length ? labels.join("、") : "无额外天机";
}

function applyTianMechanicToAction(rawAction, selection, phaseActive) {
  const action = rawAction && typeof rawAction === "object" ? rawAction : {};
  if (!selection || action.kind !== "attack") return action;
  const next = { ...action };
  if ((selection.pressureIds || []).includes(TIAN_MECHANIC_PRIMARY.id)) next.hits = Math.max(1, Number(next.hits) || 1) + 1;
  const secondary = getTianMechanicRule(selection.secondary);
  if (secondary?.field) next[secondary.field] = Math.max(0, Number(next[secondary.field]) || 0) + 1;
  if (phaseActive && selection.phaseRewrite === TIAN_MECHANIC_PHASE.id) next.damage = Math.max(0, Number(next.damage) || 0) + 2;
  return Object.freeze(next);
}
// V0.9.19 五重·蚀寿：每登上一层新地界（入二层/入三层），塔先抽走 1 点寿元。
function applyTianLayerToll(layerName) {
  if (!(runState?.mode === "tian" && (runState.tianTier || 0) >= ENEMY_BALANCE.tian.layerTollTier)) return;
  reduceRunLifespan(ENEMY_BALANCE.tian.layerTollLifespan, { source: "mode" });
  addLog(`蚀寿：${layerName}的塔风先收走 1 点寿元。`, "damage-log");
  addLogToChannel("journey", `十重天·蚀寿：踏入${layerName}，寿元 -1。`, "system-log");
}

// 十重天调参：精英基线 + 数值重叠加；奖励随重数 1.3→1.8 平滑上浮。
function getTianTuning(tier) {
  const t = clampTianTier(tier);
  const b = ENEMY_BALANCE.tian;
  return {
    hpMul: b.hpBase + b.towerPressureHpBonus, // 一重·塔压加身（首重即生效）
    atkMul: b.atkBase + (t >= 2 ? b.fierceAtkBonus : 0), // 二重·凶戾
    rewardMul: Math.round((b.rewardBase + (t - 1) * (b.rewardSpan / b.rewardSteps)) * 100) / 100,
    rareBoost: b.rareBoost,
    bossHpMul: b.bossHpBase + b.bossHpTier1Bonus + (t >= 10 ? b.bossHpTier10Bonus : 0), // 十重·逆命天
    bossAtkMul: b.bossAtkBase + (t >= 2 ? b.bossAtkTier2Bonus : 0) + (t >= 10 ? b.bossAtkTier10Bonus : 0),
  };
}
