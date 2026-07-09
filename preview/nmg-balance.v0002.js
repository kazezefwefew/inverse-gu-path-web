"use strict";
/* nmg-balance.js: V0.9.36 批次C-0，数值中枢基线。
 * 只收拢核心平衡数字，不改数值，不放 UI 尺寸/动画/版本号。须在 nmg-data 与 game.v 之前加载。 */

const PLAYER_BALANCE = Object.freeze({
  heroes: Object.freeze({
    fate: Object.freeze({ maxHp: 60, energy: 3, lifespan: 23 }),
    blood: Object.freeze({ maxHp: 56, energy: 3, lifespan: 20 }),
    poison: Object.freeze({ maxHp: 56, energy: 3, lifespan: 21 }),
    longevity: Object.freeze({ maxHp: 52, energy: 3, lifespan: 42 }),
  }),
  satchel: Object.freeze({
    baseCap: 3,
    tianThinPouchCap: 2,
    fullFallbackGuStones: 4,
  }),
});

const ENEMY_BALANCE = Object.freeze({
  modeTuning: Object.freeze({
    normal: Object.freeze({ hpMul: 1, atkMul: 1, rewardMul: 1, rareBoost: 0, bossHpMul: 1, bossAtkMul: 1 }),
    elite: Object.freeze({
      hpMul: 1.25,
      atkMul: 1.15,
      rewardMul: 1.2, // C-1a：压低精英长期资源回补，避免奖励抵消压力。
      rareBoost: 0.15,
      bossHpMul: 1.5, // C-1a：拉长精英 Boss 战，限制爆发过早结束。
      bossAtkMul: 1.2,
    }),
    deathtrial: Object.freeze({
      hpMul: 1.5,
      atkMul: 1.4,
      rewardMul: 1.45, // C-1a：死劫不再靠高额奖励越打越富。
      rareBoost: 0.25, // C-1a：降低稀有补偿，保留压力曲线。
      bossHpMul: 1.9, // C-1a：死劫 Boss 更耐打，惩罚纯爆发抢杀。
      bossAtkMul: 1.5,
    }),
  }),
  tian: Object.freeze({
    maxTier: 10,
    hpBase: 1.25,
    towerPressureHpBonus: 0.15,
    atkBase: 1.15,
    fierceAtkBonus: 0.10,
    rewardBase: 1.2, // C-1a：十重天前几重奖励不厚于精英。
    rewardSpan: 0.35, // C-1a：压低高重奖励上限，避免高压被资源抵消。
    rewardSteps: 9,
    rareBoost: 0.15,
    bossHpBase: 1.35,
    bossHpTier1Bonus: 0.15,
    bossHpTier10Bonus: 0.40, // C-1a：第十重 Boss 血压追平死劫 Boss 档。
    bossAtkBase: 1.2,
    bossAtkTier2Bonus: 0.10,
    bossAtkTier10Bonus: 0.20,
    layerTollTier: 5,
    layerTollLifespan: 1,
  }),
});

const REWARD_BALANCE = Object.freeze({
  startingGuStones: 20,
  materialRewardChoiceCount: 3,
});

const REFINING_BALANCE = Object.freeze({
  maxRunMutations: 2,
  furnaceProbabilities: Object.freeze({
    remnantSoul: Object.freeze({ stable: 40, mutation: 40, backlash: 20, label: "残魂高风险" }),
    matched: Object.freeze({ stable: 75, mutation: 20, backlash: 5, label: "材料匹配" }),
    mismatched: Object.freeze({ stable: 50, mutation: 25, backlash: 25, label: "材料不匹配" }),
  }),
  tianFurnaceShiftTier: 6,
  tianFurnaceBacklashShift: 10,
  reverseForgeBacklashShare: 0.125,
  backlash: Object.freeze({
    hurtPlayer: Object.freeze({ normal: 6, mitigated: 3 }),
    loseLifespan: Object.freeze({ normal: 2, mitigated: 1 }),
  }),
});

const EVENT_BALANCE = Object.freeze({
  siming: Object.freeze({
    bloodHpCost: 6,
    bloodGuStones: 12,
    lifeLifespanCost: 2,
  }),
  chance: Object.freeze({
    rareCardHpCost: 8,
    smallFurnaceBacklashChance: 0.2,
  }),
});
