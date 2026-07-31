"use strict";
/* nmg-balance.js: V0.9.36 批次C-0，数值中枢基线。
 * 只收拢核心平衡数字，不改数值，不放 UI 尺寸/动画/版本号。须在 nmg-data 与 game.v 之前加载。 */

const PLAYER_BALANCE = Object.freeze({
  heroes: Object.freeze({
    fate: Object.freeze({ maxHp: 60, energy: 3, lifespan: 23 }),
    blood: Object.freeze({ maxHp: 56, energy: 3, lifespan: 20 }),
    poison: Object.freeze({ maxHp: 56, energy: 3, lifespan: 21 }),
    longevity: Object.freeze({ maxHp: 52, energy: 3, lifespan: 42 }),
    dragon: Object.freeze({ maxHp: 58, energy: 3, lifespan: 24 }), // V0.9.51 玩家反馈「龙的那个超标」：不再是全场最高血(命62)，与化龙强度双高的重叠取消
    bone: Object.freeze({ maxHp: 58, energy: 3, lifespan: 22 }),
  }),
  bone: Object.freeze({
    resonanceMax: 6,
    chimeThreshold: 3,
    soulArmorPerPoint: 3,
    soulArmorPerPointGuixu: 4,
    soulRetainTrueForm: 1,
    soulFirstWeakenTrueForm: 1,
    fateArmorSacrificeCap: 12,
    fateArmorSacrificeCapTrueForm: 16,
    fateDamagePerPoint: 2,
    fateDamagePerPointGuixu: 3,
  }),
  /* V0.9.51 玩家反馈「龙的那个超标」调平：龙鳞每回合稳拿 2 枚（首次伤敌+首次护体），
   * 旧值 6 鳞＝3 回合蓄满、化龙 2 回合 ≈四成场次带 +3攻/+3防/+1真元（基础攻击牌 6 伤 → +50%），
   * 与全场最高血叠加过头。现拉长蓄鳞至 7 鳞（3.5 回合）、攻防加成降为 +2（+33%），
   * 保留 +1 真元与 2 回合时长——化龙的爆发感是本角色卖点，削的是"随时都在龙形"的密度。 */
  dragon: Object.freeze({
    scaleMax: 7,
    transformTurns: 2,
    attackBonus: 2,
    defenseBonus: 2,
    energyBonus: 1,
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
    /* V0.9.51 二次调整（玩家反馈「太难」）：难度回到上调前，奖励保留加厚——
     * 打起来不劝退，通关照旧丰厚。压力项(hp/atk/bossHp/bossAtk)＝旧值，
     * 收益项(rewardMul/rareBoost)＝V0.9.51 加厚值，两者刻意脱钩。 */
    elite: Object.freeze({
      hpMul: 1.25,    // 回调：1.35 → 1.25（旧值）
      atkMul: 1.15,   // 回调：1.25 → 1.15（旧值）
      rewardMul: 1.5, // 保留加厚（旧 1.2）
      rareBoost: 0.2, // 保留加厚（旧 0.15）
      bossHpMul: 1.5, // 回调：1.7 → 1.5（旧值）
      bossAtkMul: 1.2, // 回调：1.35 → 1.2（旧值）
    }),
    deathtrial: Object.freeze({
      hpMul: 1.5,     // 回调：1.6 → 1.5（旧值）
      atkMul: 1.4,    // 回调：1.5 → 1.4（旧值）
      rewardMul: 1.9, // 保留加厚（旧 1.45）
      rareBoost: 0.32, // 保留加厚（旧 0.25）
      bossHpMul: 1.9, // 回调：2.1 → 1.9（旧值）
      bossAtkMul: 1.5, // 回调：1.65 → 1.5（旧值）
    }),
  }),
  tian: Object.freeze({
    maxTier: 10,
    // V0.9.51 二次调整：压力项回到上调前，收益项保留加厚（同 modeTuning 的脱钩思路）。
    hpBase: 1.25,               // 回调：1.35 → 1.25（旧值）
    towerPressureHpBonus: 0.15, // 回调：0.2 → 0.15（旧值）
    atkBase: 1.15,              // 回调：1.25 → 1.15（旧值）
    fierceAtkBonus: 0.10,       // 回调：0.15 → 0.10（旧值）
    rewardBase: 1.5,            // 保留加厚（旧 1.2）：一重即厚于旧上限
    rewardSpan: 0.9,            // 保留加厚（旧 0.35）：第十重奖励≈2.4，随重递增
    rewardSteps: 9,
    rareBoost: 0.2,             // 保留加厚（旧 0.15）
    bossHpBase: 1.35,           // 回调：1.5 → 1.35（旧值）
    bossHpTier1Bonus: 0.15,
    bossHpTier10Bonus: 0.40,    // 回调：0.55 → 0.40（旧值）
    bossAtkBase: 1.2,           // 回调：1.3 → 1.2（旧值）
    bossAtkTier2Bonus: 0.10,    // 回调：0.12 → 0.10（旧值）
    bossAtkTier10Bonus: 0.20,   // 回调：0.25 → 0.20（旧值）
    layerTollTier: 5,
    layerTollLifespan: 1,
  }),
  mupan: Object.freeze({
    maxHp: 320,
    poisonResist: 0.15,
    phaseThresholds: Object.freeze({ second: 0.70, final: 0.35 }),
    exposureMultiplier: 1.35,
    finalCountdown: Object.freeze({
      start: 3,
      resetAfterFinalBlow: 2,
      maxExtensions: 2,
    }),
    phases: Object.freeze({
      1: Object.freeze({
        read: Object.freeze({ damage: 8, hits: 1 }),
        pursuit: Object.freeze({ damage: 12, hits: 1 }),
        planned: Object.freeze({ damage: 14, hits: 1 }),
      }),
      2: Object.freeze({
        read: Object.freeze({ damage: 10, hits: 1 }),
        pursuit: Object.freeze({ damage: 8, hits: 2 }),
        planned: Object.freeze({ damage: 9, hits: 2 }),
      }),
      3: Object.freeze({
        read: Object.freeze({ damage: 12, hits: 1 }),
        pursuit: Object.freeze({ damage: 24, hits: 1 }),
        planned: Object.freeze({ damage: 11, hits: 2 }),
        finalBlow: Object.freeze({ damage: 48, hits: 1 }),
      }),
    }),
    actions: Object.freeze({
      phase1: Object.freeze([
        Object.freeze({ id: "mupanPlannedP1", name: "横扫", icon: "扫", kind: "attack", damage: 14, hits: 1, mupanPlanned: true }),
      ]),
      phase2: Object.freeze([
        Object.freeze({ id: "mupanPlannedP2", name: "双轮夹击", icon: "夹", kind: "attack", damage: 9, hits: 2, mupanPlanned: true }),
      ]),
      phase3: Object.freeze([
        Object.freeze({ id: "mupanPlannedP3", name: "逼命连击", icon: "逼", kind: "attack", damage: 11, hits: 2, mupanPlanned: true }),
      ]),
      broken: Object.freeze([]),
    }),
  }),
});

const REWARD_BALANCE = Object.freeze({
  startingGuStones: 20,
  materialRewardChoiceCount: 3,
});

/* 行动经济核心曲线：战斗结算、卡面、升转预览与九转鼎只读这一份。
 * 数组下标 0..8 对应一至九转；cost 保持 1，杜绝零费自循环。 */
const ACTION_ECONOMY_PROGRESSION = Object.freeze({
  essenceGathering: Object.freeze([
    { energy: 2, armor: 0, draw: 0, cost: 1 },
    { energy: 2, armor: 2, draw: 0, cost: 1 },
    { energy: 2, armor: 4, draw: 0, cost: 1 },
    { energy: 3, armor: 4, draw: 0, cost: 1 },
    { energy: 3, armor: 6, draw: 0, cost: 1 },
    { energy: 3, armor: 6, draw: 1, cost: 1 },
    { energy: 3, armor: 8, draw: 1, cost: 1 },
    { energy: 3, armor: 10, draw: 1, cost: 1 },
    { energy: 3, armor: 12, draw: 1, cost: 1, firstPerTurnDraw: 1 },
  ].map(Object.freeze)),
  returnBreath: Object.freeze([
    { draw: 2, discard: 1, armor: 0, cost: 1 },
    { draw: 2, discard: 1, armor: 2, cost: 1 },
    { draw: 3, discard: 2, armor: 2, cost: 1 },
    { draw: 3, discard: 2, armor: 4, cost: 1 },
    { draw: 3, discard: 2, armor: 6, cost: 1 },
    { draw: 2, discard: 0, armor: 6, cost: 1 },
    { draw: 2, discard: 0, armor: 8, cost: 1 },
    { draw: 2, discard: 0, armor: 10, cost: 1 },
    { draw: 2, discard: 0, armor: 12, cost: 1, firstPerTurnDraw: 1 },
  ].map(Object.freeze)),
  swarmBite: Object.freeze([
    { damage: 4, perPlayed: 2, perPlayedCap: 3 },
    { damage: 8, perPlayed: 2, perPlayedCap: 3 },
    { damage: 12, perPlayed: 3, perPlayedCap: 3 },
    { damage: 16, perPlayed: 3, perPlayedCap: 4 },
    { damage: 20, perPlayed: 4, perPlayedCap: 4 },
    { damage: 24, perPlayed: 4, perPlayedCap: 5 },
    { damage: 28, perPlayed: 4, perPlayedCap: 5 },
    { damage: 32, perPlayed: 5, perPlayedCap: 6 },
    { damage: 36, perPlayed: 5, perPlayedCap: 6 },
  ].map(Object.freeze)),
  wineWorm: Object.freeze([
    { draw: 0, damage: 0, cost: 1 },
    { draw: 1, damage: 0, cost: 1 },
    { draw: 1, damage: 2, cost: 1 },
    { draw: 1, damage: 4, cost: 1 },
    { draw: 1, damage: 6, cost: 1 },
    { draw: 1, damage: 8, cost: 1 },
    { draw: 1, damage: 10, cost: 1 },
    { draw: 1, damage: 12, cost: 1 },
    { draw: 1, damage: 14, cost: 1 },
  ].map(Object.freeze)),
  longBreathGu: Object.freeze([
    { draw: 2, discard: 2, armor: 0, cost: 1, exhaust: true },
    { draw: 3, discard: 2, armor: 0, cost: 1, exhaust: true },
    { draw: 3, discard: 1, armor: 0, cost: 1, exhaust: true },
    { draw: 3, discard: 1, armor: 3, cost: 1, exhaust: true },
    { draw: 4, discard: 1, armor: 0, cost: 1, exhaust: true },
    { draw: 3, discard: 0, armor: 0, cost: 1, exhaust: true },
    { draw: 3, discard: 0, armor: 4, cost: 1, exhaust: true },
    { draw: 4, discard: 0, armor: 0, cost: 1, exhaust: true },
    { draw: 4, discard: 0, armor: 6, cost: 1, exhaust: true },
  ].map(Object.freeze)),
  chainThunderGu: Object.freeze([
    { damage: 6, sequenceDamage: 2, sequenceCap: 2, cost: 1 },
    { damage: 8, sequenceDamage: 2, sequenceCap: 2, cost: 1 },
    { damage: 10, sequenceDamage: 3, sequenceCap: 2, cost: 1 },
    { damage: 12, sequenceDamage: 3, sequenceCap: 2, cost: 1 },
    { damage: 14, sequenceDamage: 4, sequenceCap: 2, cost: 1 },
    { damage: 16, sequenceDamage: 4, sequenceCap: 3, cost: 1 },
    { damage: 18, sequenceDamage: 5, sequenceCap: 3, cost: 1 },
    { damage: 20, sequenceDamage: 5, sequenceCap: 3, cost: 1 },
    { damage: 22, sequenceDamage: 6, sequenceCap: 3, cost: 1 },
  ].map(Object.freeze)),
  calamityAshGu: Object.freeze([
    { ashDamage: 2, ashCap: 3, fullArmor: 0, cost: 1, exhaust: true },
    { ashDamage: 2, ashCap: 3, fullArmor: 2, cost: 1, exhaust: true },
    { ashDamage: 3, ashCap: 3, fullArmor: 2, cost: 1, exhaust: true },
    { ashDamage: 3, ashCap: 4, fullArmor: 3, cost: 1, exhaust: true },
    { ashDamage: 4, ashCap: 4, fullArmor: 3, cost: 1, exhaust: true },
    { ashDamage: 4, ashCap: 4, fullArmor: 4, cost: 1, exhaust: true },
    { ashDamage: 5, ashCap: 5, fullArmor: 4, cost: 1, exhaust: true },
    { ashDamage: 5, ashCap: 5, fullArmor: 5, cost: 1, exhaust: true },
    { ashDamage: 6, ashCap: 5, fullArmor: 6, cost: 1, exhaust: true },
  ].map(Object.freeze)),
  redTideGu: Object.freeze([
    { damage: 5, bloodCost: 2, bloodCap: 3, perBlood: 4, ecologyBonus: 3, cost: 1 },
    { damage: 6, bloodCost: 2, bloodCap: 3, perBlood: 4, ecologyBonus: 3, cost: 1 },
    { damage: 7, bloodCost: 2, bloodCap: 4, perBlood: 4, ecologyBonus: 4, cost: 1 },
    { damage: 8, bloodCost: 2, bloodCap: 4, perBlood: 5, ecologyBonus: 4, cost: 1 },
    { damage: 9, bloodCost: 2, bloodCap: 5, perBlood: 5, ecologyBonus: 5, cost: 1 },
    { damage: 10, bloodCost: 2, bloodCap: 5, perBlood: 5, ecologyBonus: 6, cost: 1 },
    { damage: 11, bloodCost: 2, bloodCap: 5, perBlood: 6, ecologyBonus: 6, cost: 1 },
    { damage: 12, bloodCost: 2, bloodCap: 6, perBlood: 6, ecologyBonus: 7, cost: 1 },
    { damage: 14, bloodCost: 2, bloodCap: 6, perBlood: 7, ecologyBonus: 8, cost: 1 },
  ].map(Object.freeze)),
  lifePyreScorpion: Object.freeze([
    { damage: 8, lifespanCost: 2, perActualBurn: 4, ecologyBonus: 3, cost: 1 },
    { damage: 10, lifespanCost: 2, perActualBurn: 4, ecologyBonus: 3, cost: 1 },
    { damage: 12, lifespanCost: 2, perActualBurn: 5, ecologyBonus: 4, cost: 1 },
    { damage: 14, lifespanCost: 2, perActualBurn: 5, ecologyBonus: 4, cost: 1 },
    { damage: 16, lifespanCost: 2, perActualBurn: 6, ecologyBonus: 5, cost: 1 },
    { damage: 18, lifespanCost: 2, perActualBurn: 6, ecologyBonus: 6, cost: 1 },
    { damage: 20, lifespanCost: 2, perActualBurn: 7, ecologyBonus: 6, cost: 1 },
    { damage: 22, lifespanCost: 2, perActualBurn: 7, ecologyBonus: 7, cost: 1 },
    { damage: 24, lifespanCost: 2, perActualBurn: 8, ecologyBonus: 8, cost: 1 },
  ].map(Object.freeze)),
  vicissitudeTurtle: Object.freeze([
    { armor: 7, weaken: 1, weakenCap: 3, perWeakenArmor: 2, armorScaleCap: 2, ecologyArmorRemove: 4, cost: 1 },
    { armor: 9, weaken: 1, weakenCap: 3, perWeakenArmor: 2, armorScaleCap: 2, ecologyArmorRemove: 4, cost: 1 },
    { armor: 11, weaken: 1, weakenCap: 3, perWeakenArmor: 2, armorScaleCap: 3, ecologyArmorRemove: 5, cost: 1 },
    { armor: 13, weaken: 1, weakenCap: 3, perWeakenArmor: 3, armorScaleCap: 3, ecologyArmorRemove: 5, cost: 1 },
    { armor: 15, weaken: 1, weakenCap: 3, perWeakenArmor: 3, armorScaleCap: 3, ecologyArmorRemove: 6, cost: 1 },
    { armor: 17, weaken: 1, weakenCap: 4, perWeakenArmor: 3, armorScaleCap: 4, ecologyArmorRemove: 7, cost: 1 },
    { armor: 19, weaken: 1, weakenCap: 4, perWeakenArmor: 4, armorScaleCap: 4, ecologyArmorRemove: 8, cost: 1 },
    { armor: 21, weaken: 1, weakenCap: 4, perWeakenArmor: 4, armorScaleCap: 4, ecologyArmorRemove: 9, cost: 1 },
    { armor: 23, weaken: 1, weakenCap: 5, perWeakenArmor: 5, armorScaleCap: 5, ecologyArmorRemove: 10, cost: 1 },
  ].map(Object.freeze)),
  ashBreathMayfly: Object.freeze([
    { draw: 2, discard: 2, armor: 0, ashDamage: 2, ashCap: 3, fullArmor: 0, cost: 2, exhaust: true },
    { draw: 3, discard: 2, armor: 0, ashDamage: 2, ashCap: 3, fullArmor: 2, cost: 2, exhaust: true },
    { draw: 3, discard: 1, armor: 0, ashDamage: 3, ashCap: 3, fullArmor: 2, cost: 2, exhaust: true },
    { draw: 3, discard: 1, armor: 3, ashDamage: 3, ashCap: 4, fullArmor: 3, cost: 2, exhaust: true },
    { draw: 4, discard: 1, armor: 0, ashDamage: 4, ashCap: 4, fullArmor: 3, cost: 2, exhaust: true },
    { draw: 3, discard: 0, armor: 0, ashDamage: 4, ashCap: 4, fullArmor: 4, cost: 2, exhaust: true },
    { draw: 3, discard: 0, armor: 4, ashDamage: 5, ashCap: 5, fullArmor: 4, cost: 2, exhaust: true },
    { draw: 4, discard: 0, armor: 0, ashDamage: 5, ashCap: 5, fullArmor: 5, cost: 2, exhaust: true },
    { draw: 4, discard: 0, armor: 6, ashDamage: 6, ashCap: 5, fullArmor: 6, cost: 2, exhaust: true },
  ].map(Object.freeze)),
  returnThunderDragonfly: Object.freeze([
    { damage: 6, sequenceDamage: 2, sequenceCap: 2, draw: 2, discard: 1, armor: 0, cost: 2 },
    { damage: 8, sequenceDamage: 2, sequenceCap: 2, draw: 2, discard: 1, armor: 2, cost: 2 },
    { damage: 10, sequenceDamage: 3, sequenceCap: 2, draw: 3, discard: 2, armor: 2, cost: 2 },
    { damage: 12, sequenceDamage: 3, sequenceCap: 2, draw: 3, discard: 2, armor: 4, cost: 2 },
    { damage: 14, sequenceDamage: 4, sequenceCap: 2, draw: 3, discard: 2, armor: 6, cost: 2 },
    { damage: 16, sequenceDamage: 4, sequenceCap: 3, draw: 2, discard: 0, armor: 6, cost: 2 },
    { damage: 18, sequenceDamage: 5, sequenceCap: 3, draw: 2, discard: 0, armor: 8, cost: 2 },
    { damage: 20, sequenceDamage: 5, sequenceCap: 3, draw: 2, discard: 0, armor: 10, cost: 2 },
    { damage: 22, sequenceDamage: 6, sequenceCap: 3, draw: 2, discard: 0, armor: 12, cost: 2 },
  ].map(Object.freeze)),
  redTideBladeLeech: Object.freeze([
    { damage: 5, bloodCost: 2, bloodCap: 3, perBlood: 4, ecologyBonus: 3, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 6, bloodCost: 2, bloodCap: 3, perBlood: 4, ecologyBonus: 3, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 7, bloodCost: 2, bloodCap: 4, perBlood: 4, ecologyBonus: 4, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 8, bloodCost: 2, bloodCap: 4, perBlood: 5, ecologyBonus: 4, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 9, bloodCost: 2, bloodCap: 5, perBlood: 5, ecologyBonus: 5, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 10, bloodCost: 2, bloodCap: 5, perBlood: 5, ecologyBonus: 6, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 11, bloodCost: 2, bloodCap: 5, perBlood: 6, ecologyBonus: 6, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 12, bloodCost: 2, bloodCap: 6, perBlood: 6, ecologyBonus: 7, selfDamage: 3, bloodGain: 1, cost: 2 },
    { damage: 14, bloodCost: 2, bloodCap: 6, perBlood: 7, ecologyBonus: 8, selfDamage: 3, bloodGain: 1, cost: 2 },
  ].map(Object.freeze)),
  lifePyreSandScorpion: Object.freeze([
    { damage: 8, lifespanCost: 2, perActualBurn: 4, perBattleBurn: 2, ecologyBonus: 3, cost: 2 },
    { damage: 10, lifespanCost: 2, perActualBurn: 4, perBattleBurn: 2, ecologyBonus: 3, cost: 2 },
    { damage: 12, lifespanCost: 2, perActualBurn: 5, perBattleBurn: 2, ecologyBonus: 4, cost: 2 },
    { damage: 14, lifespanCost: 2, perActualBurn: 5, perBattleBurn: 2, ecologyBonus: 4, cost: 2 },
    { damage: 16, lifespanCost: 2, perActualBurn: 6, perBattleBurn: 2, ecologyBonus: 5, cost: 2 },
    { damage: 18, lifespanCost: 2, perActualBurn: 6, perBattleBurn: 2, ecologyBonus: 6, cost: 2 },
    { damage: 20, lifespanCost: 2, perActualBurn: 7, perBattleBurn: 2, ecologyBonus: 6, cost: 2 },
    { damage: 22, lifespanCost: 2, perActualBurn: 7, perBattleBurn: 2, ecologyBonus: 7, cost: 2 },
    { damage: 24, lifespanCost: 2, perActualBurn: 8, perBattleBurn: 2, ecologyBonus: 8, cost: 2 },
  ].map(Object.freeze)),
  witheredMulberryTurtle: Object.freeze([
    { armor: 7, lifespanCost: 1, weaken: 2, weakenCap: 3, perWeakenArmor: 2, armorScaleCap: 2, ecologyArmorRemove: 4, cost: 2 },
    { armor: 9, lifespanCost: 1, weaken: 2, weakenCap: 3, perWeakenArmor: 2, armorScaleCap: 2, ecologyArmorRemove: 4, cost: 2 },
    { armor: 11, lifespanCost: 1, weaken: 2, weakenCap: 3, perWeakenArmor: 2, armorScaleCap: 3, ecologyArmorRemove: 5, cost: 2 },
    { armor: 13, lifespanCost: 1, weaken: 2, weakenCap: 3, perWeakenArmor: 3, armorScaleCap: 3, ecologyArmorRemove: 5, cost: 2 },
    { armor: 15, lifespanCost: 1, weaken: 2, weakenCap: 3, perWeakenArmor: 3, armorScaleCap: 3, ecologyArmorRemove: 6, cost: 2 },
    { armor: 17, lifespanCost: 1, weaken: 3, weakenCap: 4, perWeakenArmor: 3, armorScaleCap: 4, ecologyArmorRemove: 7, cost: 2 },
    { armor: 19, lifespanCost: 1, weaken: 3, weakenCap: 4, perWeakenArmor: 4, armorScaleCap: 4, ecologyArmorRemove: 8, cost: 2 },
    { armor: 21, lifespanCost: 1, weaken: 3, weakenCap: 4, perWeakenArmor: 4, armorScaleCap: 4, ecologyArmorRemove: 9, cost: 2 },
    { armor: 23, lifespanCost: 1, weaken: 3, weakenCap: 5, perWeakenArmor: 5, armorScaleCap: 5, ecologyArmorRemove: 10, cost: 2 },
  ].map(Object.freeze)),
});

/* V0.9.58 资源蛊安全升转：行动经济继续由 game.js 的 getResourceFieldLevel 封顶，
 * 封顶后只抬定位主值。配置放在数值中枢，战斗、升转预览与九转鼎共读这一份。 */
const RESOURCE_POST_CAP_PROGRESSION = Object.freeze({
  burningEssence: Object.freeze({ capLevel: 0, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "真元与抽牌保持安全值，每转额外获得 2 点防御。" }),
  meridianShift: Object.freeze({ capLevel: 0, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "抽牌保持安全值，每转额外获得 2 点防御。" }),
  yuanReturn: Object.freeze({ capLevel: 1, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "辅助抽牌固定为 1；真元二转封顶，之后每转额外获得 2 点防御。" }),
  guFeeding: Object.freeze({ capLevel: 0, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "抽弃数量保持安全值，每转额外获得 2 点防御。" }),
  emberRemnant: Object.freeze({ capLevel: 2, role: "defense", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "抽牌三转封顶，之后每转提高 2 点弃牌成甲。" }),
  borrowLife: Object.freeze({ capLevel: 1, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "真元与抽牌固定为 1；二转降低生命反噬，之后每转额外获得 2 点防御。" }),
  focalLife: Object.freeze({ capLevel: 2, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "抽牌与寿元代价三转封顶，之后每转额外获得 2 点防御。" }),
  bloodSacrifice: Object.freeze({ capLevel: 2, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "血煞与抽牌三转封顶，之后每转额外获得 2 点防御。" }),
  cloudHorn: Object.freeze({ capLevel: 0, role: "defense", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "龙鳞与续形保持安全值，每转额外获得 2 点防御。" }),
  bloodMoon: Object.freeze({ capLevel: 0, role: "attack", growth: Object.freeze({ damage: 2 }), effectLabel: "伤害", copy: "血煞倍率保持安全值，每转额外提高 2 点伤害。" }),
  moltedArmor: Object.freeze({ capLevel: 0, role: "defense", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "条件抽牌保持安全值，每转额外提高 2 点防御。" }),
  fateSever: Object.freeze({ capLevel: 1, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "命势与抽牌保持安全值，真元二转封顶，之后每转额外获得 2 点防御。" }),
  drunkFateWorm: Object.freeze({ capLevel: 1, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "条件抽牌二转封顶，之后每转额外获得 2 点防御。" }),
  soulBurn: Object.freeze({ capLevel: 1, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "真元二转封顶、降费保持安全值，之后每转额外获得 2 点防御。" }),
  mutantFate: Object.freeze({ capLevel: 1, role: "support", growth: Object.freeze({ armor: 2 }), effectLabel: "防御", copy: "真元保持安全值、抽牌二转封顶，之后每转额外获得 2 点防御。" }),
});

/* 这些卡虽含资源字段，但已有伤害、防御、疗愈或毒性主值逐转成长；
 * 显式列出理由，防止以后新增资源字段时靠人工名单漏掉。 */
const RESOURCE_SAFE_EXEMPTIONS = Object.freeze({
  wineWorm: Object.freeze({ role: "attack-support", reason: "九转抽牌、费用与下一击加伤由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  essenceGathering: Object.freeze({ role: "support", reason: "九转真元、抽牌与防御由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  returnBreath: Object.freeze({ role: "support", reason: "九转抽弃、防御与首次额外抽牌由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  longBreathGu: Object.freeze({ role: "support", reason: "九转抽弃数量、一次性消耗与护甲曲线由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  chainThunderGu: Object.freeze({ role: "attack", reason: "九转基础伤害、换类追击与公开触发上限由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  calamityAshGu: Object.freeze({ role: "attack-support", reason: "九转灰伤、灰上限与满灰护甲由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  redTideGu: Object.freeze({ role: "attack", reason: "九转耗煞终结曲线由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  lifePyreScorpion: Object.freeze({ role: "attack", reason: "九转实际焚寿曲线由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  vicissitudeTurtle: Object.freeze({ role: "defense", reason: "九转有限衰老与承伤曲线由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  ashBreathMayfly: Object.freeze({ role: "attack-support", reason: "九转抽弃、灰伤、灰上限与本场消耗由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  returnThunderDragonfly: Object.freeze({ role: "attack-support", reason: "九转伤害、雷序、抽弃与防御由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  redTideBladeLeech: Object.freeze({ role: "attack", reason: "九转旧煞终结、固定反噬与后置生煞由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  lifePyreSandScorpion: Object.freeze({ role: "attack", reason: "九转实际焚寿与本场焚寿伤害由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  witheredMulberryTurtle: Object.freeze({ role: "defense", reason: "九转寿元代价、有限衰老与承伤由 ACTION_ECONOMY_PROGRESSION 明确列出" }),
  breathCicada: Object.freeze({ role: "defense", reason: "真元与抽牌固定，防御每转成长" }),
  yuanVessel: Object.freeze({ role: "defense", reason: "真元固定，防御每转成长" }),
  vesselBreathCicada: Object.freeze({ role: "defense", reason: "真元与条件抽牌固定，防御每转成长" }),
  bloodBlade: Object.freeze({ role: "attack", reason: "伤害每转成长" }),
  bloodReversal: Object.freeze({ role: "attack", reason: "伤害每转成长" }),
  bloodTide: Object.freeze({ role: "attack", reason: "伤害每转成长" }),
  swarmBite: Object.freeze({ role: "attack", reason: "伤害每转成长" }),
  bloodRobe: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  lifeLamp: Object.freeze({ role: "healing", reason: "疗愈每转成长" }),
  reversePath: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  bloodThirst: Object.freeze({ role: "attack", reason: "伤害与疗愈每转成长" }),
  moltingShell: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  scaleHiding: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  reverseScale: Object.freeze({ role: "attack", reason: "伤害每转成长" }),
  boneMolt: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  afterEcho: Object.freeze({ role: "attack", reason: "反击伤害每转成长" }),
  bloodMarshGu: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  resonantCarapace: Object.freeze({ role: "defense", reason: "防御与碎甲反击伤害每转成长" }),
  emberArmorPiercer: Object.freeze({ role: "attack", reason: "伤害、破甲追加与弃牌成甲每转成长" }),
  bloodSwarmBlade: Object.freeze({ role: "attack", reason: "基础伤害与此前出牌追加每转成长" }),
  borrowedBloodRobe: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  meridianBloodRobe: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  heartLeech: Object.freeze({ role: "attack", reason: "伤害与疗愈每转成长" }),
  tideReturningBlood: Object.freeze({ role: "attack", reason: "伤害与疗愈每转成长" }),
  lastLightHeart: Object.freeze({ role: "attack", reason: "普通与血煞催发伤害每转成长" }),
  essenceSoulRend: Object.freeze({ role: "attack", reason: "裂魂伤害每转成长" }),
  apertureCurrentGuard: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  mysticEssenceCarapace: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  dragonMoltBreath: Object.freeze({ role: "attack-support", reason: "伤害与防御每转成长" }),
  circulatingScaleMolt: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  stormReverseHorn: Object.freeze({ role: "attack", reason: "伤害每转成长" }),
  venomMoltCarapace: Object.freeze({ role: "defense", reason: "防御每转成长" }),
  sacrificialMarshRobe: Object.freeze({ role: "defense", reason: "基础防御每转成长" }),
});

/* 付出独立稀缺代价、且必须受 1 张入塔上限约束的关键产物，可越过通用低转双轴禁线。 */
const ACTION_ECONOMY_DUAL_AXIS_EXEMPTIONS = Object.freeze({
  mutantFate: Object.freeze({ reason: "异变关键产物会消耗寿元，且入塔同名最多 1 张", requiredCopyLimit: 1 }),
});

const START_DECK_COPY_LIMIT_RULES = Object.freeze({
  engineLimit: 2,
  exclusiveLimit: 1,
  engineKeys: Object.freeze([
    "wineWorm", "burningEssence", "essenceGathering", "swarmBite", "meridianShift",
    "yuanReturn", "guFeeding", "returnBreath", "emberRemnant", "borrowLife",
  ]),
  criticalKeys: Object.freeze(["mutantBlade", "mutantArmor", "mutantPoison", "mutantFate"]),
});

/* V0.9.57 酒虫治理（玩家「bhzy」实报「酒虫的机制改一下，有点超模」）。
 *
 * 旧规则是 ×2^层（1层×2 / 2层×4 / 3层×8），三张 1 费辅助换一击 ×8，
 * 而且它与「回光翻倍」相乘（上限 ×16），之后还要再叠暴击与四枚倍率遗物。
 * 这是全局最强的乘算来源——与 V0.9.55「资源型数值锁死」治的是同一个病：
 * 乘算才是失衡的根源，加算不会爆炸。
 * 另外卡面只写「翻倍」，玩家攒到三层才发现是 ×8，属文案与实现不符。
 *
 * 新规则：倍率按层递减（×2 / ×2.5 / ×3），封顶三层不变。
 * 「攒一发」的手感留着，指数爆炸砍掉：三层从 ×8 降到 ×3，
 * 与回光相乘的上限从 ×16 降到 ×6。索引 0 是未醉，故首位为 1。 */
const DRUNK_DAMAGE_MULTIPLIERS = Object.freeze([1, 2, 2.5, 3]);
const DRUNK_MAX_STACKS = DRUNK_DAMAGE_MULTIPLIERS.length - 1;
function getDrunkMultiplier(stacks) {
  const n = Math.max(0, Math.min(DRUNK_MAX_STACKS, Math.floor(Number(stacks) || 0)));
  return DRUNK_DAMAGE_MULTIPLIERS[n];
}

/* V0.9.58 毒修反制收敛：毒抗仍保留敌人身份，但不允许一次吃掉过多铺毒；
 * 青蟒连续触发蚀毒会逐步破抗，使专精构筑能在长战中穿透抗性。 */
const POISON_COUNTERPLAY_BALANCE = Object.freeze({
  maxResistedPerApplication: 2,
  corrosionResistShred: 0.05,
  corrosionResistShredCap: 0.15,
});

function calculateEnemyPoisonApplication(amount, baseResist, resistShred, maxResisted = 2) {
  const requested = Math.max(0, Math.floor(Number(amount) || 0));
  const normalizedBase = Math.max(0, Math.min(1, Number(baseResist) || 0));
  const normalizedShred = Math.max(0, Math.min(normalizedBase, Number(resistShred) || 0));
  const effectiveResist = Math.max(0, normalizedBase - normalizedShred);
  const proportionalApplied = requested > 0
    ? Math.max(1, Math.ceil(requested * (1 - effectiveResist)))
    : 0;
  const resisted = Math.max(0, Math.min(
    requested - proportionalApplied,
    Math.max(0, Math.floor(Number(maxResisted) || 0)),
  ));
  return {
    requested,
    applied: requested - resisted,
    resisted,
    baseResist: normalizedBase,
    effectiveResist,
  };
}

function planEnemyPoisonSwallow(poison, hp, maxHp, rule) {
  const currentPoison = Math.max(0, Math.floor(Number(poison) || 0));
  const currentHp = Math.max(0, Number(hp) || 0);
  const hpCap = Math.max(currentHp, Number(maxHp) || currentHp);
  const threshold = Math.max(1, Math.floor(Number(rule?.threshold) || 0));
  if (currentPoison < threshold) {
    return { triggered: false, swallowed: 0, poisonAfter: currentPoison, healed: 0, hpAfter: currentHp };
  }
  const swallowed = threshold;
  const healed = Math.max(0, Math.min(Number(rule?.heal) || 0, hpCap - currentHp));
  return {
    triggered: true,
    swallowed,
    poisonAfter: currentPoison - swallowed,
    healed,
    hpAfter: currentHp + healed,
  };
}

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
