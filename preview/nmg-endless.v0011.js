"use strict";
/* nmg-endless.js —— 无尽登塔·纯规则/数据模块（随层连续缩放 + 里程碑具名词缀 + 分带敌人池 + Boss 节奏）。
 *
 * 定位：无尽是**平行于固定战役**的独立模式，绝不重写 nmg-chapter 的三幕+终局拓扑（那是历史致命 bug 高发区）。
 *   本模块只提供「给定层数 floor，返回该层的敌人缩放/词缀/敌人池/是否 Boss」的纯函数；
 *   地图生成、分叉分流、UI、存档由 game.js 的无尽分支消费这些结果。
 * 全部纯函数，无副作用、无外部依赖（只吐 ENEMY_LIBRARY 的 id 字符串，不碰其对象），可 vm 单测。
 * 须在 game.v 之前加载。数值先本地内聚，稳定后再议是否并入 nmg-balance 数值中枢。
 *
 * 两套互补的难度机制（对齐十重天：既有平滑 tuning，又有具名 mods）：
 *   ① getEndlessTuning(floor) —— 连续数值缩放（血/攻/奖励/稀有随层平滑上浮，形状同 modeTuning）。
 *   ② getEndlessAffixes(floor) —— 里程碑具名词缀（到阈值激活并累积，只改单个敌人属性/行为——1v1 战斗不加敌数）。
 */

/* 随层连续缩放常量：floor1 ≈ normal 基线，每层小步上浮；无尽终会死，故血/攻不设硬顶，只给奖励/稀有封顶防通胀。 */
/* V0.9.55 用户反馈「无尽没有难度，成长性也不行」——查证后确认是曲线形状问题：
 * 旧档纯线性（血 +6%/层、攻 +3.5%/层），而玩家侧的成长是【乘算】的：
 * 一旦组起真元引擎就能每回合打空整副牌，输出≈手牌数×单卡伤害。
 * 线性加数永远追不上乘算，所以过了某层就再也不会输——那不是无尽，是巡航。
 * 另外奖励第 41 层就撞上 2.2 封顶，再深也不多给，成长性到此为止。
 * 故改两点：
 *   ①压力改「线性 + 每十层一档加速」，越深每层涨得越多，逼玩家的引擎终有跟不上的一层；
 *   ②奖励解除硬顶，改为增速递减（对数式）——继续有回报，但不会指数通胀。 */
const ENDLESS_BALANCE = Object.freeze({
  hpPerFloor: 0.06,        // 每层敌人生命 +6%（基础档）
  atkPerFloor: 0.035,      // 每层敌人攻击 +3.5%（低于血，防深层秒杀）
  // 加速项：每满 10 层，后续每层的涨幅再加这么多（第 11~20 层每层 +7.5% 血，第 21~30 层 +9%…）
  hpAccelPer10: 0.015,
  atkAccelPer10: 0.008,
  rewardPerFloor: 0.03,    // 奖励基础增速
  rewardLogScale: 0.55,    // 奖励改对数增长：继续涨但增速递减，取代旧的 2.2 硬顶
  rareBoostPer10: 0.05,    // 每 10 层稀有出率 +5%
  rareBoostCap: 0.4,
  bossEvery: 5,            // 每 5 层一个 Boss 层
  bossHpExtra: 0.5,        // Boss 在当层血倍基础上再 +0.5
  bossAtkExtra: 0.25,      // Boss 攻倍再 +0.25
});
/* 加速累加：把「每层涨幅随深度递增」积分出来。
 * 第 n 层的累计倍率 = Σ(base + accel × floor((i-1)/10))，i 从 1 到 n-1。 */
function accumulateEndlessScale(step, perFloor, accelPer10) {
  let total = 0;
  for (let i = 0; i < step; i += 1) total += perFloor + accelPer10 * Math.floor(i / 10);
  return total;
}

/* 连续缩放：返回与 modeTuning 同形状 { hpMul, atkMul, rewardMul, rareBoost, bossHpMul, bossAtkMul }。 */
function getEndlessTuning(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const step = f - 1;
  const hpMul = Math.round((1 + accumulateEndlessScale(step, ENDLESS_BALANCE.hpPerFloor, ENDLESS_BALANCE.hpAccelPer10)) * 100) / 100;
  const atkMul = Math.round((1 + accumulateEndlessScale(step, ENDLESS_BALANCE.atkPerFloor, ENDLESS_BALANCE.atkAccelPer10)) * 100) / 100;
  // 奖励：对数增长——永远在涨（不再有「到顶就白打」的一层），但增速递减，不会通胀失控
  const rewardMul = Math.round((1 + ENDLESS_BALANCE.rewardLogScale * Math.log1p(step * ENDLESS_BALANCE.rewardPerFloor / ENDLESS_BALANCE.rewardLogScale * 3)) * 100) / 100;
  const rareBoost = Math.min(ENDLESS_BALANCE.rareBoostCap, Math.floor(step / 10) * ENDLESS_BALANCE.rareBoostPer10);
  return {
    hpMul, atkMul, rewardMul, rareBoost,
    bossHpMul: Math.round((hpMul + ENDLESS_BALANCE.bossHpExtra) * 100) / 100,
    bossAtkMul: Math.round((atkMul + ENDLESS_BALANCE.bossAtkExtra) * 100) / 100,
  };
}

/* Boss 层判定与 Boss 轮换：每 5 层一个。V0.9.75 起加入三位无尽生态塔主，
 * 完整循环由 25 层延长到 40 层；旧 1—25 层顺序保持不变。 */
const ENDLESS_BOSS_CYCLE = Object.freeze([
  "corpsepuppet", "miasmaMotherBoss", "bloodRobeMotherBoss", "boneNestGuardianBoss", "calamityQueenBoss",
  "burdenTowerTurtle", "rotTideMirageMother", "reverseBornTowerFetus",
]);
function isEndlessBossFloor(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  return f % ENDLESS_BALANCE.bossEvery === 0;
}
function getEndlessBossId(floor) {
  if (!isEndlessBossFloor(floor)) return null;
  const cycleIndex = (Math.floor(floor / ENDLESS_BALANCE.bossEvery) - 1) % ENDLESS_BOSS_CYCLE.length;
  return ENDLESS_BOSS_CYCLE[(cycleIndex + ENDLESS_BOSS_CYCLE.length) % ENDLESS_BOSS_CYCLE.length];
}

/* 1—19 层保持既有敌人池；20 层后由生态主题提供更大的候选池。 */
const ENDLESS_ENEMY_BANDS = Object.freeze([
  { until: 4,        normals: ["shanxiao", "bloodwolf", "beeswarm", "rottenShanxiao", "redManeBloodwolf", "wildBeeTide"], elite: "bloodwolfElite" },
  { until: 9,        normals: ["rottenShanxiao", "redManeBloodwolf", "wildBeeTide", "rotleafGu", "miasmaParasite", "bloodLeechSwarm"], elite: "miasmaLanternEliteGu" },
  { until: 14,       normals: ["poisonVineCorpse", "brokenMeridianGu", "bloodMudGolem", "bonebellGu", "skeletonPuppetGu"], elite: "bloodRobePriestEliteGu" },
  { until: 19,       normals: ["boneArmorGuardGu", "venomBeeGu", "beehiveBroodGu", "chaosSwarmHordeGu", "skeletonPuppetGu"], elite: "boneCommanderElite" },
  { until: 19,       normals: ["boneArmorGuardGu", "chaosSwarmHordeGu", "bloodMudGolem", "poisonVineCorpse", "venomBeeGu"], elite: "beehiveGuardElite" },
]);
const ENDLESS_ECOLOGY_THEME_ORDER = Object.freeze(["boneWell", "miasmaTide", "inversePact"]);
const ENDLESS_ECOLOGY_THEMES = Object.freeze({
  boneWell: Object.freeze({
    id: "boneWell", name: "骨殖井", floorText: "20—39层", summary: "骨甲、断节与蓄势轮番压阵，先辨认可拆部位",
    normals: Object.freeze(["buriedBoneMoth", "burialScaleLizard", "stitchBoneApe", "boneArmorGuardGu", "skeletonPuppetGu", "chaosSwarmHordeGu"]),
    elites: Object.freeze(["thousandJointBoneMother", "boneCommanderElite", "beehiveGuardElite"]),
    boss: "burdenTowerTurtle",
  }),
  miasmaTide: Object.freeze({
    id: "miasmaTide", name: "瘴潮腹", floorText: "40—69层", summary: "毒层会被吞纳或转化，控制施毒节奏才能压住涨潮",
    normals: Object.freeze(["returningTideMushroom", "poisonDrinkingTick", "mistLungFrog", "poisonVineCorpse", "bloodMudGolem", "rotleafGu"]),
    elites: Object.freeze(["marshLampMoth", "miasmaLanternEliteGu", "bloodRobePriestEliteGu"]),
    boss: "rotTideMirageMother",
  }),
  inversePact: Object.freeze({
    id: "inversePact", name: "逆契回廊", floorText: "70层以后", summary: "敌人会记牌、封牌与借取旧敌回响，出牌顺序比数值更重要",
    normals: Object.freeze(["lotSwallowingSpider", "marrowBurningHound", "mirrorFateSilkworm", "buriedBoneMoth", "poisonDrinkingTick", "boneArmorGuardGu"]),
    elites: Object.freeze(["myriadEyeCovenantBeast", "thousandJointBoneMother", "marshLampMoth"]),
    boss: "reverseBornTowerFetus",
  }),
});
function getEndlessTheme(floor, seed = "endless") {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  if (f < 20) return "legacy";
  if (f < 40) return "boneWell";
  if (f < 70) return "miasmaTide";
  if (f < 100) return "inversePact";
  const decade = Math.floor((f - 100) / 10);
  const offset = _endlessHash(`${seed}:ecology`) % ENDLESS_ECOLOGY_THEME_ORDER.length;
  return ENDLESS_ECOLOGY_THEME_ORDER[(offset + decade) % ENDLESS_ECOLOGY_THEME_ORDER.length];
}
function getEndlessThemeDefinition(floor, seed = "endless") {
  return ENDLESS_ECOLOGY_THEMES[getEndlessTheme(floor, seed)] || null;
}
function getEndlessEnemyTheme(enemyId, floor, seed = "endless") {
  const id = String(enemyId || "");
  return Object.values(ENDLESS_ECOLOGY_THEMES).find((theme) => theme.boss === id)
    || getEndlessThemeDefinition(floor, seed);
}
function getEndlessNextThemePreview(floor, seed = "endless") {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const nextFloor = f < 20 ? 20 : f < 40 ? 40 : f < 70 ? 70 : f < 100 ? 100 : (Math.floor(f / 10) + 1) * 10;
  const theme = getEndlessThemeDefinition(nextFloor, seed);
  return theme ? Object.freeze({ floor: nextFloor, id: theme.id, name: theme.name }) : null;
}
function getEndlessBand(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  return ENDLESS_ENEMY_BANDS.find((b) => f <= b.until) || ENDLESS_ENEMY_BANDS[ENDLESS_ENEMY_BANDS.length - 1];
}
function getEndlessNormalPool(floor, seed = "endless") {
  const theme = getEndlessThemeDefinition(floor, seed);
  return theme ? theme.normals.slice() : getEndlessBand(floor).normals.slice();
}
function getEndlessElitePool(floor, seed = "endless") {
  const theme = getEndlessThemeDefinition(floor, seed);
  return theme ? theme.elites.slice() : [getEndlessBand(floor).elite];
}
function getEndlessEliteId(floor, seed = "endless") { return getEndlessElitePool(floor, seed)[0]; }

function normalizeEndlessDirector(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const normalize = (value, cap) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []).slice(-cap);
  return { normal: normalize(source.normal, 4), elite: normalize(source.elite, 2), boss: normalize(source.boss, 1) };
}
function recordEndlessEncounter(raw, kind, enemyId) {
  const state = normalizeEndlessDirector(raw);
  const key = kind === "boss" ? "boss" : kind === "elite" ? "elite" : "normal";
  const cap = key === "normal" ? 4 : key === "elite" ? 2 : 1;
  const id = String(enemyId || "");
  if (!id) return state;
  state[key] = state[key].filter((entry) => entry !== id).concat(id).slice(-cap);
  return state;
}
function pickEndlessDirectorCandidate(pool, recent, rng, exclude = []) {
  const source = Array.isArray(pool) ? pool.map(String).filter(Boolean) : [];
  if (!source.length) return "shanxiao";
  const blocked = new Set((Array.isArray(recent) ? recent : []).map(String));
  const localBlocked = new Set((Array.isArray(exclude) ? exclude : []).map(String));
  let candidates = source.filter((id) => !blocked.has(id) && !localBlocked.has(id));
  if (!candidates.length) candidates = source.filter((id) => !localBlocked.has(id));
  if (!candidates.length) candidates = source.slice();
  return _endlessPick(candidates, typeof rng === "function" ? rng : Math.random);
}

/* 深层敌人机制使用同一份纯状态归约器。运行时只把结果写回 game.enemy.endlessEcology；
 * 模块本身不读 DOM、runState 或 game，便于固定信号回归。 */
function createEndlessEcologyCombatState(enemyId, pattern, recentEnemyIds = []) {
  return {
    enemyId: String(enemyId || ""),
    pattern: String(pattern || ""),
    firstHitSpent: false,
    sections: { attack: false, poison: false, armor: false },
    belly: 0,
    bellyBurstArmed: false,
    lampType: "",
    lampStacks: 0,
    cardCounts: { attack: 0, defense: 0, utility: 0 },
    rememberedType: "",
    predictedType: "attack",
    predictionHit: false,
    markedCardId: "",
    sealedCardId: "",
    tide: "dry",
    shellStage: 0,
    echoes: (Array.isArray(recentEnemyIds) ? recentEnemyIds.map(String).filter(Boolean) : []).slice(-3),
    echoIndex: 0,
  };
}
function _endlessTopCardType(counts) {
  const order = ["attack", "defense", "utility"];
  return order.reduce((best, key) => (Number(counts?.[key]) || 0) > (Number(counts?.[best]) || 0) ? key : best, "attack");
}
function getTowerShellIntentId(actionIds, turn, shellStage) {
  const ids = Array.isArray(actionIds) ? actionIds.map(String).filter(Boolean) : [];
  if (!ids.length) return "";
  const offset = Math.max(0, Math.min(2, Math.floor(Number(shellStage) || 0)));
  const turnIndex = Math.max(0, Math.floor(Number(turn) || 1) - 1);
  return ids[(turnIndex + offset) % ids.length];
}
function reduceEndlessEcologySignal(rawState, rawSignal = {}) {
  const source = rawState && typeof rawState === "object" ? rawState : createEndlessEcologyCombatState("", "");
  const state = {
    ...source,
    sections: { attack: false, poison: false, armor: false, ...(source.sections || {}) },
    cardCounts: { attack: 0, defense: 0, utility: 0, ...(source.cardCounts || {}) },
    echoes: Array.isArray(source.echoes) ? source.echoes.slice(0, 3) : [],
  };
  const signal = rawSignal && typeof rawSignal === "object" ? rawSignal : {};
  const effects = {
    playerDamageMultiplier: 1,
    enemyAttackBonus: 0,
    enemyAttackPenalty: 0,
    healEnemy: 0,
    armorEnemy: 0,
    poisonPlayer: 0,
    lifespanDamage: 0,
    swallowPoison: 0,
    sectionBroken: false,
    clearCharge: false,
    armBellyBurst: false,
    markedCardId: "",
    sealedCardId: "",
    echoId: "",
    clearEnemyWeaken: false,
    clearEnemyAttackBonus: false,
    counterTriggered: false,
    message: "",
  };
  const flowType = ["attack", "defense", "utility"].includes(signal.flowType) ? signal.flowType : "utility";

  if (signal.kind === "player_turn_start") {
    state.firstHitSpent = false;
    state.predictionHit = false;
    state.sealedCardId = "";
    state.predictedType = state.rememberedType || state.predictedType || "attack";
  }
  if (signal.kind === "hand_ready" && state.pattern === "handMark") {
    const handIds = Array.isArray(signal.handIds) ? signal.handIds.map(String) : [];
    if (state.markedCardId && handIds.includes(state.markedCardId)) {
      state.sealedCardId = state.markedCardId;
      state.markedCardId = "";
      effects.sealedCardId = state.sealedCardId;
      effects.message = "被吞签蛛标记的蛊牌滞留手中，本回合封禁。";
    } else {
      state.sealedCardId = "";
      state.markedCardId = handIds[0] || "";
      effects.markedCardId = state.markedCardId;
    }
  }
  if (signal.kind === "player_card") {
    state.cardCounts[flowType] = (Number(state.cardCounts[flowType]) || 0) + 1;
    if (state.pattern === "handMark" && String(signal.cardId || "") === state.markedCardId) {
      state.markedCardId = "";
      state.sealedCardId = "";
      effects.counterTriggered = true;
    }
    if (state.pattern === "cardTypeLamp") {
      if (state.lampType === flowType) {
        state.lampStacks = Math.min(3, (Number(state.lampStacks) || 0) + 1);
        effects.enemyAttackBonus = state.lampStacks * 2;
        effects.message = `灯粉照见连续${flowType}，敌人下一击强化。`;
      } else {
        if (state.lampType) effects.counterTriggered = true;
        state.lampType = flowType;
        state.lampStacks = 0;
        effects.clearEnemyAttackBonus = true;
      }
    }
    if (state.pattern === "predictCardType" && flowType === state.predictedType && !state.predictionHit) {
      state.predictionHit = true;
      effects.armorEnemy = 5;
      effects.enemyAttackBonus = 3;
      effects.message = "万目契兽猜中牌类，获得强化。";
    }
  }
  if (signal.kind === "before_player_damage" && signal.direct !== false) {
    if (state.pattern === "firstHitScale" && !state.firstHitSpent) {
      state.firstHitSpent = true;
      effects.playerDamageMultiplier *= 0.5;
      if ((Number(signal.damage) || 0) <= 8) effects.counterTriggered = true;
      effects.message = "葬鳞吞下本回合第一击。";
    }
    if (state.pattern === "tidePhases" && state.tide === "dry") effects.playerDamageMultiplier *= 1.25;
    if (state.pattern === "rememberCardType" && state.rememberedType === flowType) effects.playerDamageMultiplier *= 0.65;
    else if (state.pattern === "rememberCardType" && state.rememberedType) effects.counterTriggered = true;
  }
  const sectionKey = signal.kind === "enemy_damaged" && Number(signal.damage) > 0
    ? "attack"
    : signal.kind === "poison_applied" && Number(signal.amount) > 0
      ? "poison"
      : signal.kind === "armor_broken"
        ? "armor"
        : "";
  if (state.pattern === "threeSections" && sectionKey && !state.sections[sectionKey]) {
    state.sections[sectionKey] = true;
    effects.sectionBroken = true;
    effects.counterTriggered = true;
    effects.enemyAttackPenalty = 3;
    effects.clearCharge = true;
    effects.message = `千节骨母的${{ attack: "击骨", poison: "毒骨", armor: "甲骨" }[sectionKey]}已断。`;
  }
  if (signal.kind === "armor_broken" && ["boneCharge", "stitchHeal"].includes(state.pattern)) effects.counterTriggered = true;
  if (signal.kind === "charge_interrupted" && ["mistCharge", "boneCharge"].includes(state.pattern)) effects.counterTriggered = true;
  if (signal.kind === "card_discarded" && state.pattern === "handMark" && String(signal.cardId || "") === state.markedCardId) {
    state.markedCardId = "";
    state.sealedCardId = "";
    effects.counterTriggered = true;
    effects.message = "被标记的蛊牌已弃，吞签封禁落空。";
  }
  if (signal.kind === "enemy_turn_start") {
    if (state.pattern === "stitchHeal" && signal.armorHeld && signal.actionHealIfArmorHeld) effects.healEnemy = 7;
    if (state.pattern === "debuffTide" && (Number(signal.poison) || 0) <= 0 && (Number(signal.weaken) || 0) <= 0) effects.healEnemy = 6;
    else if (state.pattern === "debuffTide") effects.counterTriggered = true;
    if (state.pattern === "poisonBelly") {
      const swallowed = Math.min(3, Math.max(0, Number(signal.poison) || 0));
      state.belly += swallowed;
      effects.swallowPoison = swallowed;
      if (state.belly >= 6) {
        state.bellyBurstArmed = true;
        effects.armBellyBurst = true;
        effects.message = "饮毒蜱腹囊已满，下次攻击将爆裂。";
      }
    }
    if (state.pattern === "tidePhases" && state.tide === "flood") {
      const poisonEggs = Math.min(3, Math.max(0, Number(signal.poison) || 0));
      const weakenEgg = (Number(signal.weaken) || 0) > 0 ? 1 : 0;
      effects.swallowPoison = poisonEggs;
      effects.clearEnemyWeaken = weakenEgg > 0;
      effects.armorEnemy = (poisonEggs + weakenEgg) * 2;
      effects.message = poisonEggs + weakenEgg > 0 ? "涨潮将减益凝成瘴卵，腐潮蜃母获得防御。" : "涨潮未能凝出瘴卵。";
    }
  }
  if (signal.kind === "before_enemy_attack") {
    if (state.pattern === "boneCharge" && signal.consumeOwnArmorDamage && Number(signal.enemyArmor) > 0) {
      effects.enemyAttackBonus += Math.floor(Number(signal.enemyArmor) * 0.5);
    }
    if (state.pattern === "armorChecksLife" && (Number(signal.playerArmor) || 0) <= 0 && signal.lifespanDamageIfNoArmor) effects.lifespanDamage = 1;
    else if (state.pattern === "armorChecksLife" && (Number(signal.playerArmor) || 0) > 0 && signal.lifespanDamageIfNoArmor) effects.counterTriggered = true;
    if (state.pattern === "poisonBelly" && state.bellyBurstArmed) {
      effects.enemyAttackBonus += state.belly;
      effects.poisonPlayer += 2;
      state.belly = 0;
      state.bellyBurstArmed = false;
    }
    if (state.pattern === "borrowRecent" && state.echoIndex < state.echoes.length) {
      effects.echoId = state.echoes[state.echoIndex];
      state.echoIndex += 1;
      const echo = effects.echoId;
      if (["buriedBoneMoth", "burialScaleLizard", "stitchBoneApe", "boneArmorGuardGu", "skeletonPuppetGu", "chaosSwarmHordeGu"].includes(echo)) effects.armorEnemy += 5;
      else if (["returningTideMushroom", "poisonDrinkingTick", "mistLungFrog", "poisonVineCorpse", "bloodMudGolem", "rotleafGu"].includes(echo)) effects.poisonPlayer += 2;
      else if (["lotSwallowingSpider", "marrowBurningHound", "mirrorFateSilkworm"].includes(echo)) effects.lifespanDamage = (Number(signal.playerArmor) || 0) <= 0 ? 1 : 0;
      else effects.enemyAttackBonus += 2;
      effects.message = `倒生塔胎翻出「${echo}」的旧敌回响。`;
      if (state.echoIndex >= state.echoes.length) effects.counterTriggered = true;
    }
  }
  if (signal.kind === "player_turn_end") {
    if (state.pattern === "rememberCardType" || state.pattern === "predictCardType") {
      state.rememberedType = _endlessTopCardType(state.cardCounts);
    }
    if (state.pattern === "predictCardType" && !state.predictionHit) effects.counterTriggered = true;
    state.cardCounts = { attack: 0, defense: 0, utility: 0 };
  }
  if (signal.kind === "enemy_turn_end" && state.pattern === "tidePhases") state.tide = state.tide === "dry" ? "flood" : "dry";
  if (signal.kind === "shell_cracked" && state.pattern === "towerShell") {
    state.shellStage = Math.min(2, (Number(state.shellStage) || 0) + 1);
    effects.clearCharge = true;
    effects.armorEnemy = state.shellStage === 1 ? 12 : 8;
    effects.counterTriggered = true;
    effects.message = `负塔鼋第${state.shellStage}重塔壳开裂。`;
  }
  return { state, effects };
}

/* 随层随机词条池：不是固定几条，而是一个大池子——每爬 ENDLESS_AFFIX_EVERY 层，按本局种子确定性地激活一条新词条并累积。
 *   同一种子同一层 → 同一套词条（可复现、可单测）；不同种子 → 不同的词条鸡尾酒（每局不一样，最大化重玩变数）。
 *   category: enemy(强敌) / rule(逆命·规则改写) / edge(双刃·机遇)。minFloor 把强力/颠覆型词条压到深层才可能抽到。
 *   effect.type 是玩法层将接的效果键——多数复用现有机制(startArmor≈骨甲/armorRegen≈骨塔/lifespanToll≈蚀寿/shopPriceMul≈贵市/refineBacklash≈炉险)，
 *   少数是新机制(荆棘反伤/蓄怒/缚手/真元枯/封蛊/双刃项)，接线成本作者另评估；1v1 战斗只改单敌属性/行为，不加敌数。 */
const ENDLESS_AFFIX_EVERY = 3; // 每 3 层激活一条新词条
const ENDLESS_AFFIX_POOL_RAW = Object.freeze([
  // —— 强敌（enemy）——
  { id: "warlord",     name: "塔压加身", cat: "enemy", minFloor: 3,  desc: "越深越沉，敌人额外生命 +25%。", effect: { type: "extraHp", value: 0.25 } },
  { id: "carapace",    name: "覆甲",     cat: "enemy", minFloor: 4,  desc: "敌人每战起手自带 6 点护甲。", effect: { type: "startArmor", value: 6 } },
  { id: "frenzy",      name: "狂暴",     cat: "enemy", minFloor: 6,  desc: "敌人生命低于半数时攻击 +30%。", effect: { type: "lowHpRage", value: 0.3 } },
  { id: "venomFang",   name: "淬毒",     cat: "enemy", minFloor: 6,  desc: "敌人攻击命中时给你叠 2 层毒。", effect: { type: "poisonOnHit", value: 2 } },
  { id: "thorns",      name: "荆棘反噬", cat: "enemy", minFloor: 8,  desc: "你每次攻击敌人被荆棘反弹 3 点。", effect: { type: "thorns", value: 3 } },
  { id: "wrath",       name: "蓄怒",     cat: "enemy", minFloor: 9,  desc: "敌人每回合攻击力永久 +2。", effect: { type: "attackRampPerTurn", value: 2 } },
  { id: "armorRegen",  name: "回甲",     cat: "enemy", minFloor: 10, desc: "敌人每回合回 3 点护甲。", effect: { type: "armorRegen", value: 3 } },
  { id: "bloodthirst", name: "嗜血",     cat: "enemy", minFloor: 12, desc: "敌人命中时回复 4 点生命。", effect: { type: "lifesteal", value: 4 } },
  { id: "deathThroe",  name: "换命",     cat: "enemy", minFloor: 13, desc: "敌人被击杀时爆发一次 8 点反伤。", effect: { type: "deathBurst", value: 8 } },
  { id: "hardened",    name: "硬化",     cat: "enemy", minFloor: 15, desc: "敌人免疫本场前 2 次减益（毒/衰老等）。", effect: { type: "debuffImmuneFirst", value: 2 } },
  { id: "mirrorScale", name: "逆鳞",     cat: "enemy", minFloor: 17, desc: "敌人每回合首次受击反弹一半伤害。", effect: { type: "reflectFirstHit", value: 0.5 } },
  // —— 逆命·规则改写（rule）——
  { id: "bloodDebt",   name: "血债",     cat: "rule", minFloor: 8,  desc: "你的回血效果减半。", effect: { type: "healReduce", value: 0.5 } },
  { id: "venomAir",    name: "瘴气",     cat: "rule", minFloor: 9,  desc: "每回合结束你被动叠 1 层毒。", effect: { type: "poisonPerTurn", value: 1 } },
  { id: "lifeToll",    name: "蚀寿",     cat: "rule", minFloor: 10, desc: "每登上一层塔先收走你 1 点寿元。", effect: { type: "lifespanTollPerFloor", value: 1 } },
  { id: "greed",       name: "贵市",     cat: "rule", minFloor: 10, desc: "蛊坊价格 +25%。", effect: { type: "shopPriceMul", value: 1.25 } },
  { id: "linger",      name: "沉疴",     cat: "rule", minFloor: 12, desc: "你身上的减益持续时间 +1 回合。", effect: { type: "debuffDurationPlus", value: 1 } },
  { id: "furnacePeril", name: "逆炉",    cat: "rule", minFloor: 13, desc: "炼蛊反噬概率 +15%。", effect: { type: "refineBacklashUp", value: 0.15 } },
  { id: "narrowHand",  name: "缚手",     cat: "rule", minFloor: 15, desc: "你的手牌上限 -1。", effect: { type: "handSizeMinus", value: 1 } },
  { id: "drainYuan",   name: "真元枯",   cat: "rule", minFloor: 16, desc: "你每回合真元上限 -1。", effect: { type: "energyMinus", value: 1 } },
  { id: "sleepless",   name: "无休",     cat: "rule", minFloor: 16, desc: "本段命途图不出现休整节点。", effect: { type: "noRest" } },
  { id: "cardSeal",    name: "封蛊",     cat: "rule", minFloor: 18, desc: "每层随机封印你 1 张手牌一层。", effect: { type: "sealRandomCard", value: 1 } },
  { id: "gachaCurse",  name: "命签乱抽", cat: "rule", minFloor: 19, desc: "每回合你的首张手牌随机替换为另一张。", effect: { type: "randomizeFirstCard" } },
  { id: "barren",      name: "空囊",     cat: "rule", minFloor: 20, desc: "部分楼层不再提供选牌奖励。", effect: { type: "skipCardReward" } },
  { id: "omniscient",  name: "万目",     cat: "rule", minFloor: 22, desc: "敌人看穿你的意图，每回合首次铺垫被反制一次。", effect: { type: "enemyForeknows" } },
  { id: "timeDebt",    name: "命债倒悬", cat: "rule", minFloor: 24, desc: "你的寿尽 / 血竭濒死阈值提前。", effect: { type: "deathThresholdUp" } },
  // —— 双刃·机遇（edge）——
  { id: "bloodMoon",   name: "血月狂澜", cat: "edge", minFloor: 5,  desc: "你与敌人的伤害都 +30%。", effect: { type: "bothDamageUp", value: 0.3 } },
  { id: "drought",     name: "涸泽",     cat: "edge", minFloor: 7,  desc: "敌人生命 -20%，但你本层回血归零。", effect: { type: "drought" } },
  { id: "sacrifice",   name: "献祭之潮", cat: "edge", minFloor: 7,  desc: "每击杀一敌回 1 点寿元，但敌人攻击 +10%。", effect: { type: "killHealLifespan" } },
  { id: "burningLife", name: "燃命",     cat: "edge", minFloor: 9,  desc: "命势/血煞/毒生成翻倍，但你每回合自损 2。", effect: { type: "resourceDoubleSelfHarm" } },
  { id: "desperate",   name: "孤注",     cat: "edge", minFloor: 11, desc: "你每场首回合真元 +3，但敌人先手。", effect: { type: "gambitFirstTurn" } },
]);

/* V0.9.78 平衡审计：词缀定义先作为待接线目录保留；只有完成真实战斗/地图/商店/奖励
 * 端到端门禁的 id 才能进入运行池。当前 30 条旧定义均未满足该条件，因此不再向玩家展示空壳难度。 */
const ENDLESS_ENABLED_AFFIX_IDS = Object.freeze([]);

/* 每条旧词缀都必须归入一个、且只能归入一个压力类别。这里保留原 cat 供旧 UI/存档
 * 继续读取；pressureCategory 才是选择器和运行时预算的唯一依据。 */
const ENDLESS_AFFIX_CATEGORY_BY_ID = Object.freeze({
  warlord: "enemy_stat", carapace: "enemy_stat", frenzy: "enemy_stat", armorRegen: "enemy_stat",
  venomFang: "enemy_behavior", thorns: "enemy_behavior", wrath: "enemy_behavior", bloodthirst: "enemy_behavior",
  deathThroe: "enemy_behavior", hardened: "enemy_behavior", mirrorScale: "enemy_behavior", linger: "enemy_behavior",
  sleepless: "enemy_behavior", omniscient: "enemy_behavior",
  bloodDebt: "resource_lock", lifeToll: "resource_lock", greed: "resource_lock", furnacePeril: "resource_lock",
  drainYuan: "resource_lock", barren: "resource_lock", timeDebt: "resource_lock",
  narrowHand: "hand_lock", cardSeal: "hand_lock", gachaCurse: "hand_lock",
  venomAir: "passive_damage", burningLife: "passive_damage",
  bloodMoon: "edge", drought: "edge", sacrifice: "edge", desperate: "edge",
});
const ENDLESS_PRESSURE_CATEGORIES = Object.freeze(["resource_lock", "hand_lock", "passive_damage", "enemy_stat", "enemy_behavior", "edge"]);
const ENDLESS_AFFIX_CATALOG = Object.freeze(ENDLESS_AFFIX_POOL_RAW.map((affix) => Object.freeze({
  ...affix,
  pressureCategory: ENDLESS_AFFIX_CATEGORY_BY_ID[affix.id] || "edge",
})));
const ENDLESS_AFFIX_POOL = Object.freeze(ENDLESS_AFFIX_POOL_RAW.filter((affix) => ENDLESS_ENABLED_AFFIX_IDS.includes(affix.id))
  .map((affix) => Object.freeze({
    ...affix,
    pressureCategory: ENDLESS_AFFIX_CATEGORY_BY_ID[affix.id] || "edge",
  })));

/* Boss 变体只修改实际 action 字段；意图预览和结算都读取同一份 action，不能只写提示文案。 */
const ENDLESS_BOSS_VARIANTS = Object.freeze([
  Object.freeze({ id: "ironTempest", name: "铁潮连斩", pressureCategory: "enemy_behavior", behavior: "攻击额外连击一次", counterHint: "留出防御抵挡连续攻势", effect: Object.freeze({ hits: 1 }) }),
  Object.freeze({ id: "venomEcho", name: "瘴影附击", pressureCategory: "passive_damage", behavior: "攻击命中额外施毒 1 层", counterHint: "优先准备解毒或尽快收尾", effect: Object.freeze({ playerPoison: 1 }) }),
  Object.freeze({ id: "yuanSunder", name: "裂元钩", pressureCategory: "resource_lock", behavior: "攻击命中使下回合真元 -1", counterHint: "把关键牌留在本回合打出", effect: Object.freeze({ energyDrain: 1 }) }),
  Object.freeze({ id: "sealGale", name: "封手旋风", pressureCategory: "hand_lock", behavior: "攻击命中使下回合手牌上限 -1", counterHint: "先消化手牌，避免关键牌滞留", effect: Object.freeze({ handSizePenalty: 1 }) }),
  Object.freeze({ id: "boneCrown", name: "骨冠增压", pressureCategory: "enemy_stat", behavior: "攻击伤害额外 +2", counterHint: "在高伤意图前预留护甲", effect: Object.freeze({ damage: 2 }) }),
  Object.freeze({ id: "fateRift", name: "命隙回响", pressureCategory: "edge", behavior: "攻击附带 1 点损寿", counterHint: "避免拖入多次换血", effect: Object.freeze({ lifespanDamage: 1 }) }),
]);
const ENDLESS_PRESSURE_COUNTER_HINTS = Object.freeze({
  resource_lock: "提前规划真元、寿元与蛊石，别把资源压到临界。",
  hand_lock: "优先打出关键蛊牌，别让核心牌滞留在手。",
  passive_damage: "准备防御或解毒，并尽快结束战斗。",
  enemy_stat: "高伤意图前留出护甲，避免正面换血。",
  enemy_behavior: "先看敌方意图，再决定防守还是抢先斩杀。",
  edge: "利用收益的同时，提前准备好对应代价。",
});

// 确定性洗牌（本局种子驱动，不用 Math.random，纯可复现）
function _endlessHash(str) { let h = 2166136261 >>> 0; str = String(str == null ? "endless" : str); for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function _endlessRng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function _endlessShuffle(arr, seed) { const rng = _endlessRng(_endlessHash(seed)); const a = arr.slice(); for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* 给定层数与本局种子，返回已激活的词条（数组）。单调累积：爬得越深词条越多；同种子同层可复现。 */
function _fallbackEndlessPressureBudget(entries) {
  const accepted = [];
  const rejected = [];
  const counts = { resource_lock: 0, hand_lock: 0, passive_damage: 0 };
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const category = String(entry?.pressureCategory || "edge");
    if (Object.prototype.hasOwnProperty.call(counts, category) && counts[category] >= 1) {
      rejected.push(entry);
      return;
    }
    accepted.push(entry);
    if (Object.prototype.hasOwnProperty.call(counts, category)) counts[category] += 1;
  });
  return { accepted, rejected };
}
function planEndlessPressureBudget(entries) {
  const source = Array.isArray(entries) ? entries : [];
  const planner = typeof window !== "undefined" && window.NmgPveMechanics?.validatePressureBudget;
  const result = typeof planner === "function" ? planner(source) : _fallbackEndlessPressureBudget(source);
  return Object.freeze({
    accepted: Object.freeze((result?.accepted || []).slice()),
    rejected: Object.freeze((result?.rejected || []).slice()),
  });
}

function getEndlessActiveAffixes(floor, seed) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const milestones = Math.floor(f / ENDLESS_AFFIX_EVERY);
  if (milestones <= 0) return [];
  const order = _endlessShuffle(ENDLESS_AFFIX_POOL, seed == null ? "endless" : seed);
  /* 按每次里程碑逐个补入，绝不重排已经生效的词缀；否则一条迟到的资源锁会把
   * 旧词缀挤掉，破坏旧档和同种子的层间单调性。 */
  const active = [];
  for (let milestone = 1; milestone <= milestones; milestone += 1) {
    const reachedFloor = milestone * ENDLESS_AFFIX_EVERY;
    const candidate = order.find((affix) => {
      if ((affix.minFloor || 0) > reachedFloor || active.some((entry) => entry.id === affix.id)) return false;
      return planEndlessPressureBudget([...active, affix]).accepted.some((entry) => entry.id === affix.id);
    });
    if (candidate) active.push(candidate);
  }
  return Object.freeze(active);
}
function hasEndlessAffix(floor, seed, id) { return getEndlessActiveAffixes(floor, seed).some((a) => a.id === id); }

function getEndlessBossVariants(floor, seed, affixes) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  if (!isEndlessBossFloor(f)) return Object.freeze([]);
  const selected = [];
  const requested = _endlessShuffle(ENDLESS_BOSS_VARIANTS, `${seed == null ? "endless" : seed}:boss:${f}`);
  const target = f >= 25 ? 2 : 1;
  requested.some((variant) => {
    if (selected.length >= target) return true;
    const planned = planEndlessPressureBudget([...(affixes || []), ...selected, variant]);
    if (planned.accepted.some((item) => item.id === variant.id)) selected.push(variant);
    return false;
  });
  return Object.freeze(selected);
}
function getEndlessPressurePlan(floor, seed) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const affixes = getEndlessActiveAffixes(f, seed);
  const variants = getEndlessBossVariants(f, seed, affixes);
  return Object.freeze({ floor: f, affixes: Object.freeze(affixes.slice()), variants: Object.freeze(variants.slice()) });
}
function getEndlessPressurePreview(floor, seed, previousAffixIds) {
  const plan = getEndlessPressurePlan(floor, seed);
  const known = new Set((Array.isArray(previousAffixIds) ? previousAffixIds : []).map(String));
  const entries = [
    ...plan.affixes.filter((affix) => !known.has(String(affix.id))).map((affix) => Object.freeze({
      name: affix.name,
      behavior: affix.desc,
      counterHint: ENDLESS_PRESSURE_COUNTER_HINTS[affix.pressureCategory] || ENDLESS_PRESSURE_COUNTER_HINTS.edge,
    })),
    ...plan.variants.map((variant) => Object.freeze({
      name: variant.name,
      behavior: variant.behavior,
      counterHint: variant.counterHint,
    })),
  ];
  return Object.freeze({
    affixes: plan.affixes,
    variants: plan.variants,
    entries: Object.freeze(entries),
    hint: String(entries[0]?.counterHint || ""),
  });
}
function applyEndlessVariantToRuntimeAction(rawAction, variants) {
  const source = rawAction && typeof rawAction === "object" ? rawAction : {};
  if (source.kind !== "attack") return source;
  const active = Array.isArray(variants) ? variants : [];
  if (!active.length) return source;
  const action = { ...source };
  active.forEach((variant) => {
    const effect = variant?.effect || {};
    Object.entries(effect).forEach(([field, value]) => {
      action[field] = Math.max(0, Number(action[field]) || 0) + Math.max(0, Number(value) || 0);
    });
  });
  return Object.freeze(action);
}

/* 无尽每层地图"骨架"生成（纯，rng 注入）：给定层数与一个 [0,1) 随机函数，产出该层 6 段的节点计划
 *   （类型 + 敌人 id + step），不含名字/描述/图标——那些由 game.js 端 createEndlessMapState 用 ENEMY_LIBRARY 装饰。
 *   敌人从该层敌人池种子化抽取 = "敌人/地图随机"的核心；同一 rng 序列 → 同一层计划（可复现、可单测）。
 *   结构沿用固定战役的 6 段节奏(战/缘/坊/精英/休/逆命)；末段 capstone：Boss 层放 Boss，否则放精英。 */
function _endlessPick(pool, rng) { return pool[Math.floor(rng() * pool.length) % pool.length]; }
function _endlessShuffleWith(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function _endlessTwoDistinct(pool, rng) {
  if (!pool || pool.length === 0) return ["shanxiao", "shanxiao"];
  if (pool.length === 1) return [pool[0], pool[0]];
  const first = _endlessPick(pool, rng);
  const rest = pool.filter((x) => x !== first);
  return [first, _endlessPick(rest, rng)];
}
function buildEndlessFloorPlan(floor, rng, directorState = null, seed = "endless") {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const r = typeof rng === "function" ? rng : Math.random;
  const director = normalizeEndlessDirector(directorState);
  const normals = getEndlessNormalPool(f, seed);
  const normalPicks = [];
  const pickNormal = () => {
    const id = pickEndlessDirectorCandidate(normals, director.normal, r, normalPicks.slice(-Math.max(1, normals.length - 1)));
    normalPicks.push(id);
    return id;
  };
  const two = [pickNormal(), pickNormal()];
  const elitePool = getEndlessElitePool(f, seed);
  const elitePicks = [];
  const pickElite = () => {
    const id = pickEndlessDirectorCandidate(elitePool, director.elite, r, elitePicks.slice(-Math.max(1, elitePool.length - 1)));
    elitePicks.push(id);
    return id;
  };
  const eliteId = pickElite();
  const defyEliteId = pickElite();
  const capstoneEliteId = pickElite();
  const seg1 = [
    { id: "e-battle-1", step: 1, type: "battle", enemyId: two[0] },
    { id: "e-battle-2", step: 1, type: "battle", enemyId: two[1] },
  ];
  const seg2 = _endlessShuffleWith([
    { id: "e-event-1", step: 2, type: "event" },
    { id: "e-shop-1", step: 2, type: "shop" },
    { id: "e-elite-1", step: 2, type: "elite", enemyId: eliteId },
  ], r);
  const seg3 = _endlessShuffleWith([
    { id: "e-battle-3", step: 3, type: "battle", enemyId: pickNormal() },
    { id: "e-event-2", step: 3, type: "event" },
  ], r);
  const seg4 = _endlessShuffleWith([
    { id: "e-shop-2", step: 4, type: "shop" },
    { id: "e-rest-1", step: 4, type: "rest" },
    { id: "e-defy-1", step: 4, type: "defy", enemyId: defyEliteId },
  ], r);
  const seg5 = _endlessShuffleWith([
    { id: "e-battle-4", step: 5, type: "battle", enemyId: pickNormal() },
    { id: "e-rest-2", step: 5, type: "rest" },
  ], r);
  const bossFloor = isEndlessBossFloor(f);
  const capstone = bossFloor
    ? [{ id: "e-boss", step: 6, type: "boss", enemyId: getEndlessBossId(f) }]
    : [{ id: "e-capstone-elite", step: 6, type: "elite", enemyId: capstoneEliteId }];
  return {
    floor: f,
    theme: getEndlessTheme(f, seed),
    isBossFloor: bossFloor,
    segments: [seg1, seg2, seg3, seg4, seg5, capstone],
  };
}

/* 便捷：某层的整体描述（供 UI/存档；纯派生）。 */
function getEndlessFloorSummary(floor, seed) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const pressure = getEndlessPressurePlan(f, seed);
  return {
    floor: f,
    theme: getEndlessTheme(f, seed),
    nextTheme: getEndlessNextThemePreview(f, seed),
    isBoss: isEndlessBossFloor(f),
    bossId: getEndlessBossId(f),
    tuning: getEndlessTuning(f),
    affixes: pressure.affixes.map((a) => ({ id: a.id, name: a.name, cat: a.cat, pressureCategory: a.pressureCategory, desc: a.desc })),
    variants: pressure.variants.map((v) => ({ id: v.id, name: v.name, behavior: v.behavior, counterHint: v.counterHint })),
  };
}

/* 无尽局外激励：长期首通给大目标，每周目标给稳定回流。
 * 这里只规划“应领什么”和领取账本，不接触 localStorage / 蛊庐；真正入库由 nmg-gulu 原子执行。
 * materialEach 表示每一种基础炼材都发该数量，避免随机单材让奖励看起来丰厚、实际却卡配方。 */
const ENDLESS_LIFETIME_MILESTONES = Object.freeze([
  Object.freeze({ floor: 5, name: "初破五关", rewards: Object.freeze({ scrip: 40, materialEach: 2, bossCores: 1 }) }),
  Object.freeze({ floor: 10, name: "十层留名", rewards: Object.freeze({ scrip: 90, materialEach: 3, bossCores: 2, guEmbryo: 1 }) }),
  Object.freeze({ floor: 20, name: "二十层镇命", rewards: Object.freeze({ scrip: 180, materialEach: 5, bossCores: 4, kindleSand: 2 }) }),
  Object.freeze({ floor: 30, name: "三十层问鼎", rewards: Object.freeze({ scrip: 300, materialEach: 8, bossCores: 6, guEmbryo: 2, kindleSand: 3, guWard: 1 }) }),
  Object.freeze({ floor: 50, name: "五十层天关", rewards: Object.freeze({ scrip: 500, materialEach: 12, bossCores: 10, guEmbryo: 3, kindleSand: 5, guWard: 2 }) }),
  Object.freeze({ floor: 75, name: "七十五层皇极", rewards: Object.freeze({ scrip: 800, materialEach: 16, bossCores: 14, guEmbryo: 4, kindleSand: 7, guWard: 3 }) }),
  Object.freeze({ floor: 100, name: "百层祖庭", rewards: Object.freeze({ scrip: 1200, materialEach: 20, bossCores: 20, guEmbryo: 5, kindleSand: 10, guWard: 4 }) }),
]);
const ENDLESS_WEEKLY_MILESTONES = Object.freeze([
  Object.freeze({ floor: 5, name: "周行·五层", rewards: Object.freeze({ scrip: 30, materialEach: 1 }) }),
  Object.freeze({ floor: 10, name: "周行·十层", rewards: Object.freeze({ scrip: 60, materialEach: 2, bossCores: 1 }) }),
  Object.freeze({ floor: 20, name: "周行·二十层", rewards: Object.freeze({ scrip: 120, materialEach: 3, bossCores: 2, kindleSand: 1 }) }),
  Object.freeze({ floor: 30, name: "周行·三十层", rewards: Object.freeze({ scrip: 200, materialEach: 4, bossCores: 3, guEmbryo: 1, kindleSand: 2 }) }),
]);
const ENDLESS_POST100_STEP = 25;
const ENDLESS_POST100_START = 125;
const ENDLESS_POST100_MAX = 1000;
const ENDLESS_POST100_LANDMARKS = Object.freeze({
  250: Object.freeze({ name: "二百五十层·镇渊", rewards: Object.freeze({ scrip: 450, materialEach: 4, bossCores: 5, guEmbryo: 2, kindleSand: 4, guWard: 1 }) }),
  500: Object.freeze({ name: "五百层·截天", rewards: Object.freeze({ scrip: 650, materialEach: 6, bossCores: 7, guEmbryo: 2, kindleSand: 5, guWard: 2 }) }),
  750: Object.freeze({ name: "七百五十层·照命", rewards: Object.freeze({ scrip: 800, materialEach: 8, bossCores: 8, guEmbryo: 2, kindleSand: 7, guWard: 2 }) }),
  1000: Object.freeze({ name: "千阶命碑", rewards: Object.freeze({ scrip: 1000, materialEach: 10, bossCores: 10, guEmbryo: 3, kindleSand: 10, guWard: 3 }) }),
});
function getEndlessPost100Reward(floor) {
  const f = Math.max(0, Math.floor(Number(floor) || 0));
  if (f < ENDLESS_POST100_START || f > ENDLESS_POST100_MAX || f % ENDLESS_POST100_STEP !== 0) return null;
  const landmark = ENDLESS_POST100_LANDMARKS[f];
  if (landmark) return Object.freeze({ floor: f, name: landmark.name, rewards: landmark.rewards });
  const n = (f - 100) / ENDLESS_POST100_STEP;
  return Object.freeze({ floor: f, name: `百层后·第${f}层`, rewards: Object.freeze({
    scrip: 200 + 25 * Math.min(n, 8),
    materialEach: 2 + Math.min(Math.floor(n / 4), 4),
    bossCores: 2 + Math.min(Math.floor(n / 3), 4),
    guEmbryo: f % 50 === 0 ? 1 : 0,
    kindleSand: f % 50 === 0 ? 2 : 0,
    guWard: f % 100 === 0 ? 1 : 0,
  }) });
}
function getEndlessPost100Milestones(deepest, priorHighest) {
  const floor = Math.min(ENDLESS_POST100_MAX, Math.max(0, Math.floor(Number(deepest) || 0)));
  const prior = Math.min(ENDLESS_POST100_MAX, Math.max(100, Math.floor(Number(priorHighest) || 100)));
  const first = Math.max(ENDLESS_POST100_START, Math.floor(prior / ENDLESS_POST100_STEP + 1) * ENDLESS_POST100_STEP);
  const milestones = [];
  for (let node = first; node <= floor; node += ENDLESS_POST100_STEP) milestones.push(getEndlessPost100Reward(node));
  return Object.freeze(milestones.filter(Boolean));
}
function getEndlessWeekKey(at) {
  const date = new Date(Number(at) || Date.now());
  date.setHours(0, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function normalizeEndlessRewardLedger(raw, at) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const validLifetime = new Set(ENDLESS_LIFETIME_MILESTONES.map((item) => item.floor));
  const validWeekly = new Set(ENDLESS_WEEKLY_MILESTONES.map((item) => item.floor));
  const weekKey = getEndlessWeekKey(at);
  return {
    deepestReached: Math.max(0, Math.floor(Number(source.deepestReached) || 0)),
    post100HighestClaimed: Math.min(ENDLESS_POST100_MAX, Math.max(100, Math.floor((Number(source.post100HighestClaimed) || 100) / ENDLESS_POST100_STEP) * ENDLESS_POST100_STEP)),
    lifetimeClaimed: Array.from(new Set((Array.isArray(source.lifetimeClaimed) ? source.lifetimeClaimed : []).map(Number).filter((floor) => validLifetime.has(floor)))).sort((a, b) => a - b),
    weekly: {
      weekKey,
      claimed: source.weekly?.weekKey === weekKey
        ? Array.from(new Set((Array.isArray(source.weekly.claimed) ? source.weekly.claimed : []).map(Number).filter((floor) => validWeekly.has(floor)))).sort((a, b) => a - b)
        : [],
    },
  };
}
function sumEndlessRewards(items) {
  return items.reduce((total, item) => {
    Object.entries(item.rewards || {}).forEach(([key, value]) => { total[key] = (total[key] || 0) + Math.max(0, Number(value) || 0); });
    return total;
  }, { scrip: 0, materialEach: 0, bossCores: 0, guEmbryo: 0, kindleSand: 0, guWard: 0 });
}
function getEndlessRewardPlan(deepest, rawLedger, at) {
  const floor = Math.max(0, Math.floor(Number(deepest) || 0));
  const ledger = normalizeEndlessRewardLedger(rawLedger, at);
  const lifetime = ENDLESS_LIFETIME_MILESTONES.filter((item) => item.floor <= floor && !ledger.lifetimeClaimed.includes(item.floor));
  const post100 = getEndlessPost100Milestones(floor, ledger.post100HighestClaimed);
  const weekly = ENDLESS_WEEKLY_MILESTONES.filter((item) => item.floor <= floor && !ledger.weekly.claimed.includes(item.floor));
  const nextLedger = {
    deepestReached: Math.max(ledger.deepestReached, floor),
    post100HighestClaimed: post100.length ? post100.at(-1).floor : ledger.post100HighestClaimed,
    lifetimeClaimed: Array.from(new Set(ledger.lifetimeClaimed.concat(lifetime.map((item) => item.floor)))).sort((a, b) => a - b),
    weekly: { weekKey: ledger.weekly.weekKey, claimed: Array.from(new Set(ledger.weekly.claimed.concat(weekly.map((item) => item.floor)))).sort((a, b) => a - b) },
  };
  const nextLifetime = ENDLESS_LIFETIME_MILESTONES.find((item) => !nextLedger.lifetimeClaimed.includes(item.floor))
    || getEndlessPost100Reward(Math.max(ENDLESS_POST100_START, Math.floor(Math.max(floor, nextLedger.post100HighestClaimed) / ENDLESS_POST100_STEP + 1) * ENDLESS_POST100_STEP));
  return { deepest: floor, lifetime, post100, weekly, total: sumEndlessRewards(lifetime.concat(post100, weekly)), nextLedger, nextLifetime, hasReward: lifetime.length + post100.length + weekly.length > 0 };
}

function getRewardTrack(deepest, rawLedger, at) {
  const ledger = normalizeEndlessRewardLedger(rawLedger, at);
  const floor = Math.max(ledger.deepestReached, Math.max(0, Math.floor(Number(deepest) || 0)));
  const cappedFloor = Math.min(ENDLESS_POST100_MAX, floor);
  const current = floor > 100
    ? getEndlessPost100Reward(Math.floor(cappedFloor / ENDLESS_POST100_STEP) * ENDLESS_POST100_STEP)
    : ([...ENDLESS_LIFETIME_MILESTONES].reverse().find((item) => item.floor <= floor) || null);
  const next = ENDLESS_LIFETIME_MILESTONES.find((item) => item.floor > floor)
    || getEndlessPost100Reward(Math.max(ENDLESS_POST100_START, Math.floor(floor / ENDLESS_POST100_STEP + 1) * ENDLESS_POST100_STEP));
  const decorate = (items, claimed) => items.map((item) => ({
    ...item,
    state: claimed.includes(item.floor)
      ? "claimed"
      : item.floor <= floor
        ? "reached"
        : item === next
          ? "next"
          : "locked",
  }));
  const weeklyNext = ENDLESS_WEEKLY_MILESTONES.find((item) => item.floor > floor) || null;
  const weekly = ENDLESS_WEEKLY_MILESTONES.map((item) => ({
    ...item,
    state: ledger.weekly.claimed.includes(item.floor)
      ? "claimed"
      : item.floor <= floor
        ? "reached"
        : item === weeklyNext
          ? "next"
          : "locked",
  }));
  const post100Rail = getEndlessPost100Milestones(Math.max(floor, next?.floor || floor), 100).map((item) => ({
    ...item,
    state: item.floor <= ledger.post100HighestClaimed ? "claimed" : item.floor <= floor ? "reached" : item.floor === next.floor ? "next" : "locked",
  }));
  return { deepest: floor, current, next, lifetime: decorate(ENDLESS_LIFETIME_MILESTONES, ledger.lifetimeClaimed).concat(post100Rail), weekly };
}

// 供 vm 门禁按同源引用（脚本升级时不误红）；玩法层直接调用上面的全局函数。
if (typeof window !== "undefined") {
  window.NmgEndless = {
    getEndlessTuning, isEndlessBossFloor, getEndlessBossId,
    getEndlessTheme, getEndlessThemeDefinition, getEndlessEnemyTheme, getEndlessNextThemePreview,
    getEndlessNormalPool, getEndlessElitePool, getEndlessEliteId,
    normalizeEndlessDirector, recordEndlessEncounter, pickEndlessDirectorCandidate,
    createEndlessEcologyCombatState, getTowerShellIntentId, reduceEndlessEcologySignal,
    getEndlessActiveAffixes, hasEndlessAffix, getEndlessFloorSummary,
    planEndlessPressureBudget, getEndlessBossVariants, getEndlessPressurePlan, getEndlessPressurePreview, applyEndlessVariantToRuntimeAction,
    buildEndlessFloorPlan,
    getEndlessWeekKey, normalizeEndlessRewardLedger, getEndlessPost100Reward, getEndlessPost100Milestones, getEndlessRewardPlan, getRewardTrack,
    ENDLESS_BALANCE, ENDLESS_AFFIX_CATALOG, ENDLESS_ENABLED_AFFIX_IDS, ENDLESS_AFFIX_POOL, ENDLESS_AFFIX_EVERY, ENDLESS_BOSS_CYCLE, ENDLESS_BOSS_VARIANTS, ENDLESS_PRESSURE_CATEGORIES,
    ENDLESS_ECOLOGY_THEME_ORDER, ENDLESS_ECOLOGY_THEMES,
    ENDLESS_LIFETIME_MILESTONES, ENDLESS_WEEKLY_MILESTONES, ENDLESS_POST100_STEP, ENDLESS_POST100_START, ENDLESS_POST100_MAX,
  };
}
