"use strict";
/* nmg-tian.js：V0.9.36 批次B-6b，十重天模式解析、天梯进度、重数修饰与调参辅助。
 * 须在 game.v 之前加载；这里只保留纯十重天核心，选人页/开局/结算等主流程仍由 game.js 调用。 */

// V0.9.9 子批6：解析本局生效模式——死劫/精英/十重天需已解锁，否则降级（防越权/坏档）。
function resolveRunMode() {
  if (selectedMode === "tian" && progression.deathtrialCleared) return "tian"; // V0.9.19：死劫金印后解锁
  if (selectedMode === "deathtrial" && progression.deathtrialUnlocked) return "deathtrial";
  if (selectedMode === "elite" && progression.eliteUnlocked) return "elite";
  return "normal";
}

/* ===== V0.9.19 十重天（批1）：死劫金印后的天梯难度，十重递进、按英雄独立爬塔。 =====
 * 数值基线=精英档；每重叠加一条修饰（本批实装数值重一/二/九/十，三~八规则重下批接入）。
 * 进度存 nmg.tianTier（JSON：{heroId: 已通最高重}），第 N 重通关解锁第 N+1 重，可回打低重。 */
const TIAN_TIER_KEY = "nmg.tianTier";
const TIAN_MAX_TIER = 10;
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
// V0.9.19 五重·蚀寿：每登上一层新地界（入二层/入三层），塔先抽走 1 点寿元。
function applyTianLayerToll(layerName) {
  if (!(runState?.mode === "tian" && (runState.tianTier || 0) >= 5)) return;
  reduceRunLifespan(1);
  addLog(`蚀寿：${layerName}的塔风先收走 1 点寿元。`, "damage-log");
  addLogToChannel("journey", `十重天·蚀寿：踏入${layerName}，寿元 -1。`, "system-log");
}

// 十重天调参：精英基线 + 数值重叠加；奖励随重数 1.3→1.8 平滑上浮。
function getTianTuning(tier) {
  const t = clampTianTier(tier);
  return {
    hpMul: 1.25 + 0.15, // 一重·塔压加身（首重即生效）
    atkMul: 1.15 + (t >= 2 ? 0.10 : 0), // 二重·凶戾
    rewardMul: Math.round((1.3 + (t - 1) * (0.5 / 9)) * 100) / 100,
    rareBoost: 0.15,
    bossHpMul: 1.35 + 0.15 + (t >= 10 ? 0.20 : 0), // 十重·逆命天
    bossAtkMul: 1.2 + (t >= 2 ? 0.10 : 0) + (t >= 10 ? 0.20 : 0),
  };
}
