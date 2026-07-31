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

/* Boss 层判定与 Boss 轮换：每 5 层一个，循环现有 5 Boss（后续把无尽专属 Boss 插进此表即可）。 */
const ENDLESS_BOSS_CYCLE = Object.freeze([
  "corpsepuppet", "miasmaMotherBoss", "bloodRobeMotherBoss", "boneNestGuardianBoss", "calamityQueenBoss",
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

/* 敌人池按层深分带：越深越掺入高层敌人（用现有 ENEMY_LIBRARY id；无尽专属新敌人加入时插进对应带即可）。 */
const ENDLESS_ENEMY_BANDS = Object.freeze([
  { until: 4,        normals: ["shanxiao", "bloodwolf", "beeswarm", "rottenShanxiao", "redManeBloodwolf", "wildBeeTide"], elite: "bloodwolfElite" },
  { until: 9,        normals: ["rottenShanxiao", "redManeBloodwolf", "wildBeeTide", "rotleafGu", "miasmaParasite", "bloodLeechSwarm"], elite: "miasmaLanternEliteGu" },
  { until: 14,       normals: ["poisonVineCorpse", "brokenMeridianGu", "bloodMudGolem", "bonebellGu", "skeletonPuppetGu"], elite: "bloodRobePriestEliteGu" },
  { until: 19,       normals: ["boneArmorGuardGu", "venomBeeGu", "beehiveBroodGu", "chaosSwarmHordeGu", "skeletonPuppetGu"], elite: "boneCommanderElite" },
  { until: Infinity, normals: ["boneArmorGuardGu", "chaosSwarmHordeGu", "bloodMudGolem", "poisonVineCorpse", "venomBeeGu"], elite: "beehiveGuardElite" },
]);
function getEndlessBand(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  return ENDLESS_ENEMY_BANDS.find((b) => f <= b.until) || ENDLESS_ENEMY_BANDS[ENDLESS_ENEMY_BANDS.length - 1];
}
function getEndlessNormalPool(floor) { return getEndlessBand(floor).normals.slice(); }
function getEndlessEliteId(floor) { return getEndlessBand(floor).elite; }

/* 随层随机词条池：不是固定几条，而是一个大池子——每爬 ENDLESS_AFFIX_EVERY 层，按本局种子确定性地激活一条新词条并累积。
 *   同一种子同一层 → 同一套词条（可复现、可单测）；不同种子 → 不同的词条鸡尾酒（每局不一样，最大化重玩变数）。
 *   category: enemy(强敌) / rule(逆命·规则改写) / edge(双刃·机遇)。minFloor 把强力/颠覆型词条压到深层才可能抽到。
 *   effect.type 是玩法层将接的效果键——多数复用现有机制(startArmor≈骨甲/armorRegen≈骨塔/lifespanToll≈蚀寿/shopPriceMul≈贵市/refineBacklash≈炉险)，
 *   少数是新机制(荆棘反伤/蓄怒/缚手/真元枯/封蛊/双刃项)，接线成本作者另评估；1v1 战斗只改单敌属性/行为，不加敌数。 */
const ENDLESS_AFFIX_EVERY = 3; // 每 3 层激活一条新词条
const ENDLESS_AFFIX_POOL = Object.freeze([
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

// 确定性洗牌（本局种子驱动，不用 Math.random，纯可复现）
function _endlessHash(str) { let h = 2166136261 >>> 0; str = String(str == null ? "endless" : str); for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function _endlessRng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function _endlessShuffle(arr, seed) { const rng = _endlessRng(_endlessHash(seed)); const a = arr.slice(); for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* 给定层数与本局种子，返回已激活的词条（数组）。单调累积：爬得越深词条越多；同种子同层可复现。 */
function getEndlessActiveAffixes(floor, seed) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const milestones = Math.floor(f / ENDLESS_AFFIX_EVERY);
  if (milestones <= 0) return [];
  const order = _endlessShuffle(ENDLESS_AFFIX_POOL, seed == null ? "endless" : seed);
  // 洗牌顺序前 milestones 个中，minFloor 已达者激活（未达者随层深自然解锁，集合只增不减）
  return order.filter((a, i) => i < milestones && (a.minFloor || 0) <= f);
}
function hasEndlessAffix(floor, seed, id) { return getEndlessActiveAffixes(floor, seed).some((a) => a.id === id); }

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
function buildEndlessFloorPlan(floor, rng) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const r = typeof rng === "function" ? rng : Math.random;
  const normals = getEndlessNormalPool(f);
  const eliteId = getEndlessEliteId(f);
  const two = _endlessTwoDistinct(normals, r);
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
    { id: "e-battle-3", step: 3, type: "battle", enemyId: _endlessPick(normals, r) },
    { id: "e-event-2", step: 3, type: "event" },
  ], r);
  const seg4 = _endlessShuffleWith([
    { id: "e-shop-2", step: 4, type: "shop" },
    { id: "e-rest-1", step: 4, type: "rest" },
    { id: "e-defy-1", step: 4, type: "defy", enemyId: eliteId },
  ], r);
  const seg5 = _endlessShuffleWith([
    { id: "e-battle-4", step: 5, type: "battle", enemyId: _endlessPick(normals, r) },
    { id: "e-rest-2", step: 5, type: "rest" },
  ], r);
  const bossFloor = isEndlessBossFloor(f);
  const capstone = bossFloor
    ? [{ id: "e-boss", step: 6, type: "boss", enemyId: getEndlessBossId(f) }]
    : [{ id: "e-capstone-elite", step: 6, type: "elite", enemyId: eliteId }];
  return { floor: f, isBossFloor: bossFloor, segments: [seg1, seg2, seg3, seg4, seg5, capstone] };
}

/* 便捷：某层的整体描述（供 UI/存档；纯派生）。 */
function getEndlessFloorSummary(floor, seed) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  return {
    floor: f,
    isBoss: isEndlessBossFloor(f),
    bossId: getEndlessBossId(f),
    tuning: getEndlessTuning(f),
    affixes: getEndlessActiveAffixes(f, seed).map((a) => ({ id: a.id, name: a.name, cat: a.cat, desc: a.desc })),
  };
}

// 供 vm 门禁按同源引用（脚本升级时不误红）；玩法层直接调用上面的全局函数。
if (typeof window !== "undefined") {
  window.NmgEndless = {
    getEndlessTuning, isEndlessBossFloor, getEndlessBossId,
    getEndlessNormalPool, getEndlessEliteId, getEndlessActiveAffixes, hasEndlessAffix, getEndlessFloorSummary,
    buildEndlessFloorPlan,
    ENDLESS_BALANCE, ENDLESS_AFFIX_POOL, ENDLESS_AFFIX_EVERY, ENDLESS_BOSS_CYCLE,
  };
}
