"use strict";
/* nmg-gulu.js：V0.9.36 批次B-4，蛊庐/归庐日课/香火弹窗抽离；须在 game.v 之前加载。 */
/* ===== V0.9.22 蛊庐（批1）：局外养蛊——材料带出(通关全额/阵亡四成)、孵卵真实时间成长、成蛊两格带入塔、蛊斗喂养本命蛊。 =====
 * 独立存储 nmg.gulu（坏档不碰局内与本命蛊）；时间结算单一入口 settleGuluTime（宽容处理改时钟，单机不较真）；
 * 局外无种子通道，随机走 guluRandom（回归脚本按 return Math.random 白名单放行）。 */
const GULU_KEY = "nmg.gulu";
const GULU_COLLECTION_VERSION = 2;
const GULU_COLLECTION_BUILD = "v0.9.39";
const GULU_HATCH_TIME_VERSION = 2;
const OWNED_GULU_CODEX_SYNC_VERSION = 1;
const GULU_SLOTS = 6; // 基础圃数（V0.9.52 由 4 提到 6：玩家反馈孵化位太少、稀有蛊转不动）
const GULU_SLOTS_MAX = 10; // V0.9.52：圃位扩到十；数组恒补到此，旧档占用圃永不被裁
/* V0.9.52 辟圃阶梯（全部是元进度，不加任何战力，守 hardRules）：
 * 6 基础 → 7 通关任意路线 → 8 本命六转 → 9 本命七转 → 10 本命九转。 */
const GULU_SLOT_LADDER = Object.freeze([
  { cap: 7, stage: 0, cleared: true, hint: "通关任意路线" },
  { cap: 8, stage: 6, cleared: false, hint: "本命蛊六转" },
  { cap: 9, stage: 7, cleared: false, hint: "本命蛊七转" },
  { cap: 10, stage: 9, cleared: false, hint: "本命蛊九转" },
]);
/* V0.9.51 携带上限改为跟随本命蛊转数（五转3 / 七转4 / 九转5），常量保留为基线兜底。
 * 满级玩家反馈"道行没用了"——携带位就是长尾的第一份回报。 */
const GULU_CARRY_BASE = 2;
function getCarryMaxNow() { return typeof getBenmingCarryMax === "function" ? getBenmingCarryMax() : GULU_CARRY_BASE; }
const GULU_INJURY_MS = 8 * 3600 * 1000; // 蛊斗反噬静养 8 小时

/* ===================== V0.9.57 养蛊室（用户定调「蛊虫生态自成一体：养·用·炼，目前缺养」）=====================
 *
 * 【为什么产的是元髓露，不是真元】
 * 用户最初的设想是「灵力泉产真元」。查证后改掉了：真元(energy)在局外代码里【零出现】——
 * 它是纯局内、每回合恢复的战斗资源。塔外攒真元，玩家第一个问题就是「能带进塔吗」：
 * 能带就破坏局内平衡，不能带就不知道攒它干嘛，两头都不通。
 * 而八材里的【元髓露】定位本就是「偏向零费、真元与快速连发」「元髓入炉后流转极快」——
 * 它就是「元」在塔外的形态，产出立刻有用（孵化按材料总数扣、炼蛊要材料）。
 *
 * 【为什么温养只给炉率，不给战力】
 * 硬规则：本命蛊六转以上只开元进度，绝不加战力（再堆会让老玩家碾压新人并逼迫全局重平衡）。
 * 所以温养满了给的是「入炉成功率 +NURTURE_FORGE_BONUS」，且与引火砂共用 FORGE_RATE_CAP 95 封顶
 * ——「不许出现必成」这条设计保留。这样玩家多了第三条路：用时间换成功率
 * （前两条是引火砂买概率、固蛊符买保底）。
 *
 * 【收纳位与蛊圃的关系】
 * 收纳位不占蛊圃，但存放中的蛊【不能随行、不能喂本命蛊、不能作炉料】，要用必须先取出。
 * 本质是把上限从「能拥有多少」改成「能同时活跃多少」——圃位（元进度奖励：六转8/七转9/九转10）
 * 因此仍然稀缺，那条成长线不会被一个无限仓库作废。 */
const NURTURE_SLOTS_MAX = 12;              // 收纳位上限
/* 十二只蛊沿椭圆确定性落位：上半圈缩小压后，下半圈放大抬前。
 * 坐标与动作都不走随机，重渲染后不会跳位，也不污染存档。 */
const NURTURE_ORBIT_SLOTS = Object.freeze([
  Object.freeze({ x: 50, y: 10, scale: 0.72, z: 2, motion: "float" }),
  Object.freeze({ x: 68, y: 15, scale: 0.76, z: 3, motion: "crawl" }),
  Object.freeze({ x: 83, y: 28, scale: 0.84, z: 4, motion: "rest" }),
  Object.freeze({ x: 91, y: 49, scale: 0.94, z: 6, motion: "float" }),
  Object.freeze({ x: 83, y: 70, scale: 1.02, z: 8, motion: "crawl" }),
  Object.freeze({ x: 67, y: 83, scale: 1.12, z: 10, motion: "rest" }),
  Object.freeze({ x: 50, y: 89, scale: 1.17, z: 12, motion: "float" }),
  Object.freeze({ x: 33, y: 83, scale: 1.12, z: 10, motion: "crawl" }),
  Object.freeze({ x: 17, y: 70, scale: 1.02, z: 8, motion: "rest" }),
  Object.freeze({ x: 9, y: 49, scale: 0.94, z: 6, motion: "float" }),
  Object.freeze({ x: 17, y: 28, scale: 0.84, z: 4, motion: "crawl" }),
  Object.freeze({ x: 32, y: 15, scale: 0.76, z: 3, motion: "rest" }),
]);
const NURTURE_SPRING_MAX_LEVEL = 5;
/* 每级：产一滴元髓露所需毫秒 / 储量上限 / 升到【下一级】所需蛊钱与材料。
 * 一级 45 分钟一滴、存 3 滴＝挂机一夜约存满；五级 18 分钟一滴、存 10 滴。
 * 刻意不做成线性：越高级越省时间，给长线一个真实的加速感。 */
const NURTURE_SPRING_LEVELS = Object.freeze([
  Object.freeze({ level: 1, msPerDew: 45 * 60 * 1000, cap: 3, upScrip: 14, upMats: 4 }),
  Object.freeze({ level: 2, msPerDew: 36 * 60 * 1000, cap: 5, upScrip: 22, upMats: 6 }),
  Object.freeze({ level: 3, msPerDew: 28 * 60 * 1000, cap: 7, upScrip: 34, upMats: 9 }),
  Object.freeze({ level: 4, msPerDew: 22 * 60 * 1000, cap: 9, upScrip: 48, upMats: 12 }),
  Object.freeze({ level: 5, msPerDew: 18 * 60 * 1000, cap: 10, upScrip: 0, upMats: 0 }), // 满级
]);
const NURTURE_MAX = 100;                   // 温养度满值
const NURTURE_GAIN_PER_DEW = 20;           // 每滴元髓露温养多少度
const NURTURE_FORGE_BONUS = 8;             // 温养满后入炉成功率加成（引火砂一份 +15，此处刻意更克制）
const ECOLOGY_RECIPE_SCRIP_COST = 4;
const ECOLOGY_MARKET_GOOD = Object.freeze({ count: 2, price: 6, dailyStock: 1 });
const ECOLOGY_RECIPE_COSTS = Object.freeze({
  longBreathGu: Object.freeze({ ecology: "miasmaMossSac", core: "rotLiquid" }),
  chainThunderGu: Object.freeze({ ecology: "mysticHiveWax", core: "insectMolt" }),
  calamityAshGu: Object.freeze({ ecology: "weatheredBoneSalt", core: "boneCrystal" }),
});

function getNurtureSpringLevel(level) {
  const n = Math.max(1, Math.min(NURTURE_SPRING_MAX_LEVEL, Math.floor(Number(level) || 1)));
  return NURTURE_SPRING_LEVELS[n - 1];
}

/* 老档没有 nurture 段，这里补齐；收纳数组恒补到上限，与蛊圃 slots 同款处理。 */
function normalizeNurtureStore(store) {
  const n = (store.nurture && typeof store.nurture === "object" && !Array.isArray(store.nurture)) ? store.nurture : {};
  n.level = Math.max(1, Math.min(NURTURE_SPRING_MAX_LEVEL, Math.floor(Number(n.level) || 1)));
  n.dew = Math.max(0, Math.min(getNurtureSpringLevel(n.level).cap, Math.floor(Number(n.dew) || 0)));
  n.lastTickAt = Math.max(0, Number(n.lastTickAt) || 0);
  if (!Array.isArray(n.slots)) n.slots = [];
  while (n.slots.length < NURTURE_SLOTS_MAX) n.slots.push(null);
  n.slots.length = NURTURE_SLOTS_MAX;
  store.nurture = n;
  return n;
}

/* 灵泉结算：按真实时间把「上次结算到现在」折成元髓露，夹在储量上限内。
 * 与孵化同一口径——离线也算，回来一次性补上；满了就停（溢出不计，逼玩家回来收）。
 * 返回本次新产的滴数，供回执与 UI 提示用。 */
function settleNurtureSpring(store, now) {
  const n = normalizeNurtureStore(store);
  const conf = getNurtureSpringLevel(n.level);
  if (!n.lastTickAt) { n.lastTickAt = now; return 0; }
  if (now <= n.lastTickAt) return 0;
  if (n.dew >= conf.cap) { n.lastTickAt = now; return 0; } // 已满：不累计、也不倒扣时间
  const produced = Math.floor((now - n.lastTickAt) / conf.msPerDew);
  if (produced <= 0) return 0;
  const before = n.dew;
  n.dew = Math.min(conf.cap, before + produced);
  // 只推进「实际用掉」的那部分时间，剩余零头留到下次，不让玩家亏掉半滴
  n.lastTickAt += (n.dew - before) * conf.msPerDew;
  return n.dew - before;
}

/* 收纳：把蛊圃里的成蛊移入养蛊室。随行中的蛊不可收纳（它正要入塔）。 */
function moveGuToNurture(store, guId, now) {
  const cap = getGuluSlotCap();
  const from = store.slots.findIndex((slot, index) => index < cap && slot?.id === guId && slot.state === "gu");
  if (from < 0) return { ok: false, text: "只有蛊圃里的成蛊可以收纳。" };
  const lockText = getGuluSourceLockText(store.slots[from].id);
  if (lockText) return { ok: false, blocked: true, text: lockText };
  if (store.slots[from].carry) return { ok: false, text: "随行中的蛊不能收纳，先取消随行。" };
  const n = normalizeNurtureStore(store);
  const to = n.slots.findIndex((slot) => !slot);
  if (to < 0) return { ok: false, text: "养蛊室已满，先取出一只再收。" };
  const gu = store.slots[from];
  store.slots[from] = null;
  n.slots[to] = { ...gu, nurture: Math.max(0, Math.floor(Number(gu.nurture) || 0)), storedAt: now };
  return { ok: true, name: gu.customName || gu.name || "蛊", text: `${gu.customName || gu.name || "蛊"}已移入养蛊室温养。` };
}

/* 取出：养蛊室 → 蛊圃。温养度随蛊走，取出不清零（否则玩家不敢取）。 */
function takeGuFromNurture(store, guId) {
  const n = normalizeNurtureStore(store);
  const from = n.slots.findIndex((slot) => slot?.id === guId);
  if (from < 0) return { ok: false, text: "养蛊室里没有这只蛊。" };
  const lockText = getGuluSourceLockText(n.slots[from].id);
  if (lockText) return { ok: false, blocked: true, text: lockText };
  const cap = getGuluSlotCap();
  const to = store.slots.findIndex((slot, index) => index < cap && !slot);
  if (to < 0) return { ok: false, text: "蛊圃已满，先腾出一格再取。" };
  const gu = n.slots[from];
  n.slots[from] = null;
  delete gu.storedAt;
  store.slots[to] = gu;
  return { ok: true, name: gu.customName || gu.name || "蛊", text: `${gu.customName || gu.name || "蛊"}已回到蛊圃。` };
}

/* 温养：耗一滴元髓露，给指定的收纳蛊 +NURTURE_GAIN_PER_DEW 温养度（封顶 NURTURE_MAX）。 */
function nurtureGuWithDew(store, guId) {
  const n = normalizeNurtureStore(store);
  const slot = n.slots.find((s) => s?.id === guId);
  if (!slot) return { ok: false, text: "养蛊室里没有这只蛊。" };
  const lockText = getGuluSourceLockText(slot.id);
  if (lockText) return { ok: false, blocked: true, text: lockText };
  if ((slot.nurture | 0) >= NURTURE_MAX) return { ok: false, text: "这只蛊已温养圆满。" };
  if ((n.dew | 0) <= 0) return { ok: false, text: "灵泉尚无元髓露，再等等。" };
  n.dew -= 1;
  slot.nurture = Math.min(NURTURE_MAX, (slot.nurture | 0) + NURTURE_GAIN_PER_DEW);
  const full = slot.nurture >= NURTURE_MAX;
  return {
    ok: true, nurture: slot.nurture, full,
    text: full
      ? `${slot.customName || slot.name || "蛊"}温养圆满：入炉成功率 +${NURTURE_FORGE_BONUS}。`
      : `${slot.customName || slot.name || "蛊"}温养 ${slot.nurture}/${NURTURE_MAX}。`,
  };
}

function getEcologyNurtureCost(cardKey) {
  const recipe = ECOLOGY_RECIPE_COSTS[cardKey];
  return recipe ? { ecology: recipe.ecology, core: recipe.core, ecologyCount: 1, coreCount: 2 } : null;
}

function nurtureGuWithEcology(store, guId) {
  const n = normalizeNurtureStore(store);
  const slot = n.slots.find((entry) => entry?.id === guId);
  if (!slot) return { ok: false, text: "养蛊室里没有这只蛊。" };
  const cost = getEcologyNurtureCost(slot.cardKey);
  if (!cost) return { ok: false, text: "这只蛊尚无匹配的栖地异材。" };
  if ((slot.nurture | 0) >= NURTURE_MAX) return { ok: false, text: "这只蛊已温养圆满。" };
  if (normalizeRedeemOwnedAmount(store.ecologyMaterials[cost.ecology]) < cost.ecologyCount || normalizeRedeemOwnedAmount(store.materials[cost.core]) < cost.coreCount) {
    return { ok: false, text: `温养需${ECOLOGY_MATERIALS[cost.ecology].name}×1、${MATERIALS[cost.core].name}×2。` };
  }
  store.ecologyMaterials[cost.ecology] -= cost.ecologyCount;
  store.materials[cost.core] -= cost.coreCount;
  slot.nurture = Math.min(NURTURE_MAX, (slot.nurture | 0) + NURTURE_GAIN_PER_DEW);
  return { ok: true, nurture: slot.nurture, text: `${slot.customName || slot.name || "蛊"}依栖地异材温养至 ${slot.nurture}/${NURTURE_MAX}。` };
}

/* 升级灵泉：吃蛊钱 + 任意材料（按总数扣，与孵化同口径）。 */
function upgradeNurtureSpring(store) {
  const n = normalizeNurtureStore(store);
  if (n.level >= NURTURE_SPRING_MAX_LEVEL) return { ok: false, text: "灵泉已至五级，再无可凿之处。" };
  const conf = getNurtureSpringLevel(n.level);
  if (normalizeRedeemOwnedAmount(store.market.scrip) < conf.upScrip) return { ok: false, text: `蛊钱不足，需 ${conf.upScrip} 枚。` };
  if (guluMatTotal(store) < conf.upMats) return { ok: false, text: `材料不足，需任意材料共 ${conf.upMats} 份。` };
  store.market.scrip -= conf.upScrip;
  let need = conf.upMats;
  for (const id of MATERIAL_IDS) { // 从存量最多的种类先扣，避免把稀缺材料扣光
    if (need <= 0) break;
    const have = normalizeRedeemOwnedAmount(store.materials[id]);
    const take = Math.min(have, need);
    store.materials[id] = have - take;
    need -= take;
  }
  n.level += 1;
  const next = getNurtureSpringLevel(n.level);
  n.dew = Math.min(next.cap, n.dew);
  return { ok: true, level: n.level, text: `灵泉凿深一层，现为 ${n.level} 级：${Math.round(next.msPerDew / 60000)} 分钟一滴，可存 ${next.cap} 滴。` };
}

/* 温养加成：供九转鼎取用。只有【收纳在养蛊室且温养圆满】的蛊才有；
 * 蛊在蛊圃里（要入炉时必然已取出）时按其自带的 nurture 值判定。 */
function getNurtureForgeBonus(gu) {
  return (Math.floor(Number(gu?.nurture) || 0) >= NURTURE_MAX) ? NURTURE_FORGE_BONUS : 0;
}
const GULU_GRADES = Object.freeze({
  fan: { name: "次品", quality: "次品", rank: 1, feedRank: 1, hatchMs: 10 * 60 * 1000, mats: 2, core: 0, dao: 10, upgrade: 0, forgeBonus: 0, rare: false, track: "base", trackName: "基础", poolLabel: "基础虫卵 · 次品", timeText: "10 分钟" },
  ling: { name: "精品", quality: "精品", rank: 2, feedRank: 1, hatchMs: 1 * 3600 * 1000, mats: 5, core: 0, dao: 10, upgrade: 0, forgeBonus: 8, rare: false, track: "base", trackName: "基础", poolLabel: "基础虫卵 · 精品", timeText: "1 小时" },
  xuan: { name: "次品", quality: "次品", rank: 3, feedRank: 3, hatchMs: 4 * 3600 * 1000, mats: 4, core: 0, dao: 60, upgrade: 1, forgeBonus: 0, rare: true, track: "dao", trackName: "道脉", poolLabel: "道脉虫卵 · 次品", timeText: "4 小时" },
  tian: { name: "精品", quality: "精品", rank: 4, feedRank: 3, hatchMs: 8 * 3600 * 1000, mats: 8, core: 1, dao: 60, upgrade: 1, forgeBonus: 8, rare: true, track: "dao", trackName: "道脉", poolLabel: "道脉虫卵 · 精品", timeText: "8 小时" },
});
function getGuluGradeDisplayName(gradeId) {
  const grade = GULU_GRADES[gradeId] || GULU_GRADES.fan;
  return `${grade.trackName}·${grade.quality}`;
}
function isGuluDaoGrade(gradeId) { return GULU_GRADES[gradeId]?.track === "dao"; }
function getGuluQualityForgeBonus(gu) { return Math.max(0, GULU_GRADES[gu?.grade]?.forgeBonus | 0); }
/* 两条孵化线使用互不替代的材料组：玩家可同时攒基础蛊与流派蛊，而不是资源多后只点最高档。
 * 不新增第九种材料；把既有八材的差异真正用于孵化选择。 */
const GULU_HATCH_MATERIAL_GROUPS = Object.freeze({
  base: Object.freeze(["bloodSand", "insectMolt", "rotLiquid", "fateSilk"]),
  dao: Object.freeze(["remnantSoul", "boneCrystal", "lifeEmber", "yuanDew"]),
});
function getGuluHatchMaterialIds(grade) {
  return GULU_HATCH_MATERIAL_GROUPS[grade?.track] || GULU_HATCH_MATERIAL_GROUPS.base;
}
function getGuluHatchMaterialTotal(store, grade) {
  return getGuluHatchMaterialIds(grade).reduce((sum, id) => sum + Math.max(0, store?.materials?.[id] | 0), 0);
}
function getGuluHatchCostText(grade) {
  const ids = getGuluHatchMaterialIds(grade);
  const groupName = grade?.track === "dao" ? "道脉材" : "基础材";
  const names = ids.map((id) => MATERIALS[id]?.name || id).join("／");
  return `${groupName}×${grade.mats}（${names}）${grade.core ? `＋蛊母残核×${grade.core}` : ""}`;
}
function consumeGuluHatchMaterials(store, grade) {
  let need = Math.max(0, grade?.mats | 0);
  getGuluHatchMaterialIds(grade).slice()
    .sort((a, b) => normalizeRedeemOwnedAmount(store.materials[b]) - normalizeRedeemOwnedAmount(store.materials[a]))
    .forEach((id) => {
      if (need <= 0) return;
      const take = Math.min(need, normalizeRedeemOwnedAmount(store.materials[id]));
      store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) - take;
      need -= take;
    });
  return need === 0;
}
const BAIGUSHI_WARD_MAX = 2;
const BAIGUSHI_SCRIP_RATE = 5;
const BAIGUSHI_SCRIP_RUN_CAP = 12;
const BAIGUSHI_DAILY_STOCK = 3;
const BAIGUSHI_RECIPE_SCRIP_COST = 2;
const BAIGUSHI_WARD_SCRIP_COST = 11;
const BAIGUSHI_MISC_GOODS = Object.freeze({
  featuredEgg: Object.freeze({ name: "今日轮换蛊卵", price: 6, dailyStock: 1 }),
  healingSalve: Object.freeze({ name: "养伤散", price: 5, dailyStock: 1 }),
  materialCrate: Object.freeze({
    name: "炉材匣",
    price: 11,
    dailyStock: 1,
    contents: Object.freeze({ bloodSand: 1, insectMolt: 1, rotLiquid: 1, fateSilk: 1, remnantSoul: 1, boneCrystal: 1, lifeEmber: 1, yuanDew: 1 }),
  }),
  gradeSeal: Object.freeze({ name: "凝质符", price: 9, dailyStock: 1 }),
  marrowJade: Object.freeze({ name: "换髓玉", price: 8, dailyStock: 1 }),
  daoFruit: Object.freeze({ name: "本命道果", price: 10, dailyStock: 1, dao: 60 }),
  // 九转鼎六转以上的硬门槛。
  guEmbryo: Object.freeze({ name: "蛊胎", price: 14, dailyStock: 1, count: 1 }),
  // 炉险保底：限量出售，避免用局外货币一次抹平炸炉风险。
  guWard: Object.freeze({ name: "固蛊符", price: 12, dailyStock: 1, count: 1 }),
  /* 高频资源只保留有明确购买意图的一档，避免同效果换名重复售卖：
   * 残核、引火砂与双生髓保留批量装；材料同时保留「全材料各一」和「自选一种五份」，
   * 前者补齐短板，后者定向备料。破壳锥与自愿广告都能立即破壳，前者消耗蛊钱、后者不耗库存。 */
  coreCrateTriple: Object.freeze({ name: "残核匣·三枚装", price: 32, dailyStock: 1, count: 3 }),
  kindlePouch: Object.freeze({ name: "砂囊", price: 13, dailyStock: 1, count: 3 }),
  twinMarrowPair: Object.freeze({ name: "双生对髓", price: 13, dailyStock: 1, count: 2 }),
  materialBundle: Object.freeze({ name: "百草囊", price: 9, dailyStock: 2, count: 5 }),
  hatchBreaker: Object.freeze({ name: "破壳锥", price: 10, dailyStock: 1 }), // 指定蛊卵立即破壳
});
const BAIGUSHI_MATERIAL_PRICES = Object.freeze({
  bloodSand: 2,
  insectMolt: 2,
  rotLiquid: 2,
  fateSilk: 3,
  remnantSoul: 3,
  boneCrystal: 3,
  lifeEmber: 3,
  yuanDew: 3,
});
const BAIGUSHI_WARD_COST = Object.freeze({
  materials: Object.freeze({ bloodSand: 2, insectMolt: 2, rotLiquid: 2, fateSilk: 2, remnantSoul: 2 }),
  bossCores: 1,
});
const BAIGUSHI_RECIPES = Object.freeze({
  blood: Object.freeze({ name: "血砂育蛊", glyph: "血", cardKey: "bloodBlade", grade: "ling", cost: Object.freeze({ bloodSand: 6, fateSilk: 1 }), tone: "blood" }),
  armor: Object.freeze({ name: "蜕壳育蛊", glyph: "甲", cardKey: "ironSkin", grade: "ling", cost: Object.freeze({ insectMolt: 6, fateSilk: 1 }), tone: "jade" }),
  poison: Object.freeze({ name: "腐沼育蛊", glyph: "毒", cardKey: "greenMiasma", grade: "ling", cost: Object.freeze({ rotLiquid: 6, remnantSoul: 1 }), tone: "poison" }),
  fate: Object.freeze({ name: "牵命育蛊", glyph: "命", cardKey: "reversePath", grade: "ling", cost: Object.freeze({ fateSilk: 6, insectMolt: 1 }), tone: "gold" }),
  soul: Object.freeze({ name: "残魂育蛊", glyph: "魂", cardKey: "burningEssence", grade: "ling", cost: Object.freeze({ remnantSoul: 6, bloodSand: 1 }), tone: "soul" }),
});
const BAIGUSHI_HATCH_MS = 10 * 60 * 1000;
function guluNow() { return Date.now(); }
function guluRandom() { return Math.random(); }
// V0.9.23：圃蛊卡图走万蛊录图鉴资产（cardKey→image），查不到退印章占位。
function getGuluCardArt(cardKey) {
  return (window.GU_CATALOG || []).find((x) => x.cardKey === cardKey)?.image || "";
}
const GULU_GRADE_GLYPHS = Object.freeze({ fan: "次", ling: "精", xuan: "次", tian: "精" });
/* V0.9.51「庐养」印记（用户定调：孵化蛊要在原体数值上和原生蛊有区别，否则对不起等待时间）。
 * 此前孵化蛊与原生蛊是同一张卡、同一套数值，差别只有预带的强化等级——而强化局内炼蛊也能拿到，
 * 于是 8 小时天品 ≡「稀有牌 +2 炼化」，玩家自然选择"直接喂了"。
 * 现给成蛊刻一枚独立于炼蛊的加成：按品阶抬主数值；天品另把炼蛊上限从 +2 提到 +3——
 * 那是原生牌在规则上够不到的高度，这才是等待 8 小时买到的东西。 */
const GULU_GRADE_NURTURE = Object.freeze({ fan: 0, ling: 0, xuan: 2, tian: 2 });
const GULU_TIAN_UPGRADE_CAP = 3; // 天品成蛊专属：局内炼蛊上限 +2 → +3（原生牌规则不变）
function getGuluNurtureBonus(grade) { return GULU_GRADE_NURTURE[grade] || 0; }
function getGuluUpgradeCap(grade) { return isGuluDaoGrade(grade) ? GULU_TIAN_UPGRADE_CAP : 2; }
/* ===== V0.9.52 蛊格（天品之上的三阶，用户定调「天品之上再加几个等级」）=====
 * 品阶（凡/灵/玄/天）是「孵出来的血统」，决定庐养加成与起始转数，孵化池不变；
 * 蛊格是「炼出来的位格」，只由九转鼎的转数决定，天品之上三阶全靠六~九转的献祭段换来。
 * 它不额外加数值——数值早已由转数本身给出——它是称号与门槛：入塔生效上限＝该蛊格允许的转数。
 * 这样「九转」既真生效，又必须付出残核＋蛊胎的硬代价，不会让挂机时长直接兑换战力。 */
const GULU_RANKS = Object.freeze([
  { minTurn: 0, name: "凡格", glyph: "凡" },
  { minTurn: 3, name: "灵格", glyph: "灵" },
  { minTurn: 4, name: "玄格", glyph: "玄" },
  { minTurn: 5, name: "天格", glyph: "天" },
  { minTurn: 6, name: "神格", glyph: "神" },
  { minTurn: 7, name: "皇格", glyph: "皇" },
  { minTurn: 8, name: "祖格", glyph: "祖" },
]);
function getGuluRank(upgradeLevel) {
  const lv = Math.max(0, upgradeLevel | 0);
  return GULU_RANKS.slice().reverse().find((r) => lv >= r.minTurn) || GULU_RANKS[0];
}
/* 随行入塔的生效转数上限：九转鼎炼到几转就生效几转（不再被局内炼蛊上限削掉）。
 * 削减曾让「五转」纯属白炼——玩家烧掉燃料与材料换来 0 收益，是 v0.9.51 两条上限没对齐的漏。 */
function getCarriedTurnCap() { return FORGE_MAX_TURN; }

const GULU_GRADE_TONES = Object.freeze({ fan: "gold", ling: "gold", xuan: "gold", tian: "gold" }); // 未知蛊种时保持中性；成蛊后按战斗定位分色
// V0.9.35 天品随行·蛊气加持：天品成蛊随行入塔时，按其（破卵所抽卡的）维度额外给一份小加成——回应"天品太废"（此前携带仅等于一张 +2 强化的稀有牌）。
// 仅天品(rank4)享；确定性纯加法小值（无 RNG/无除法/无循环，保种子回归与防"0血过关/卡死"）；携带至多 getCarryMaxNow() 只叠加。
// 维度取 CARD_LIBRARY[cardKey].type（ADVANCED 池现有 attack/blood/defense/utility；poison/fate/lifespan 为未来池预留兜底）。
// 天品成蛊只从 ADVANCED_CARD_KEYS 破卵，其 type 仅 attack/blood/defense/utility；未知维度由 carriedTianDimKey 兜底为 utility（生存向）。
const CARRIED_TIAN_DIM = Object.freeze({
  attack: { attackFlat: 2 }, // 本局每次攻击基础伤害 +2
  blood: { openBlood: 2 }, // 每场开局血煞 +2
  defense: { maxHp: 8 }, // 生命上限 +8（建局，满血入场）
  utility: { maxHp: 6 }, // 生命上限 +6（辅助/疗愈向；亦作未知维度兜底）
});
const CARRIED_TIAN_DIM_LABEL = Object.freeze({
  attack: "本局攻击伤害 +2", blood: "每场开局血煞 +2", defense: "生命上限 +8", utility: "生命上限 +6",
});
function carriedTianDimKey(cardKey) {
  const t = CARD_LIBRARY[cardKey] && CARD_LIBRARY[cardKey].type;
  return CARRIED_TIAN_DIM[t] ? t : "utility"; // 未知维度兜底给生存向
}
// 聚合当前随行的天品蛊加成（建局调用）：{attackFlat,openBlood,maxHp}。
// V0.9.35 审计修：加 i<getGuluSlotCap() 门控——未辟圃里的蛊（仅伪造档可能）不计入携带加成，令辟圃锁滴水不漏。
function computeCarriedGuBonus() {
  const acc = { attackFlat: 0, openBlood: 0, maxHp: 0 };
  getGuluStore().slots
    .filter((g, i) => i < getGuluSlotCap() && g && g.state === "gu" && g.carry && isGuluDaoGrade(g.grade) && CARD_LIBRARY[g.cardKey])
    .slice(0, getCarryMaxNow())
    .forEach((g) => {
      const dim = CARRIED_TIAN_DIM[carriedTianDimKey(g.cardKey)];
      Object.keys(dim).forEach((k) => { acc[k] += dim[k]; });
    });
  return acc;
}
let __guluCache = null;
function guluCollectionEntry(store, cardKey, create = false) {
  if (!cardKey) return null;
  if (!store.collection || typeof store.collection !== "object" || Array.isArray(store.collection)) store.collection = {};
  if (!store.collection[cardKey] && create) {
    store.collection[cardKey] = {
      cardKey, hatchedCount: 0, fusionCount: 0, giftedCount: 0, highestGrade: "fan", fedCount: 0, releasedCount: 0,
      firstRecordedAt: guluNow(), firstRecordedVersion: GULU_COLLECTION_BUILD, legacyBackfill: false,
    };
  }
  return store.collection[cardKey] || null;
}
function migrateGuluCollection(store) {
  const oldVersion = Math.max(0, store.collectionVersion | 0);
  let changed = false;
  if (oldVersion < 1) {
    store.collection = {};
    store.collectionUnread = [];
    const grouped = {};
    (store.slots || []).forEach((slot) => {
      if (!slot || slot.state !== "gu" || !slot.cardKey) return;
      const current = grouped[slot.cardKey] || { count: 0, grade: "fan" };
      current.count += 1;
      if ((GULU_GRADES[slot.grade]?.rank || 1) > (GULU_GRADES[current.grade]?.rank || 1)) current.grade = slot.grade;
      grouped[slot.cardKey] = current;
    });
    Object.entries(grouped).forEach(([cardKey, current]) => {
      const entry = guluCollectionEntry(store, cardKey, true);
      entry.hatchedCount = current.count;
      entry.highestGrade = current.grade;
      entry.legacyBackfill = true;
      store.collectionUnread.push(cardKey);
    });
    changed = true;
  } else if (!store.collection || typeof store.collection !== "object" || Array.isArray(store.collection)) {
    store.collection = {};
    changed = true;
  }
  Object.values(store.collection || {}).forEach((entry) => {
    const releasedCount = Math.max(0, entry.releasedCount | 0);
    const fusionCount = Math.max(0, entry.fusionCount | 0);
    const giftedCount = Math.max(0, entry.giftedCount | 0);
    if (entry.releasedCount !== releasedCount) {
      entry.releasedCount = releasedCount;
      changed = true;
    }
    if (entry.fusionCount !== fusionCount) {
      entry.fusionCount = fusionCount;
      changed = true;
    }
    if (entry.giftedCount !== giftedCount) {
      entry.giftedCount = giftedCount;
      changed = true;
    }
  });
  if (oldVersion < GULU_COLLECTION_VERSION) {
    store.collectionVersion = GULU_COLLECTION_VERSION;
    changed = true;
  }
  return changed;
}
// 缩短旧档中尚未破壳的等待时间。只取旧截止时间与新规则截止时间中的较早者，
// 因而迁移绝不会让玩家已经等待的蛊卵反而更晚破壳。
function migrateGuluHatchTimes(store) {
  const oldVersion = Math.max(0, store.hatchTimeVersion | 0);
  if (oldVersion >= GULU_HATCH_TIME_VERSION) return false;
  const now = guluNow();
  (store.slots || []).forEach((slot) => {
    if (!slot || slot.state !== "egg") return;
    const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
    const oldHatchAt = Number(slot.hatchAt) || 0;
    const startedAt = Number(slot.startedAt) || 0;
    const shortenedHatchAt = startedAt > 0 ? startedAt + grade.hatchMs : now + grade.hatchMs;
    slot.hatchAt = oldHatchAt > 0 ? Math.min(oldHatchAt, shortenedHatchAt) : shortenedHatchAt;
  });
  store.hatchTimeVersion = GULU_HATCH_TIME_VERSION;
  return true;
}

/* 同一只蛊必须是独立实例。极少数旧档/热更中断档可能出现重复对象引用或重复 id：
 * 之后按 id 取蛊、按对象升转时就会表现为“动一只，同名几只一起变”。
 * 保留第一次出现的实例与 id；后续重复项复制为独立对象并补新 id，不改品阶、转数或孵化时间。 */
function normalizeGuluInstanceIdentity(store) {
  if (!store || typeof store !== "object") return false;
  const containers = [store.slots, store.nurture?.slots].filter(Array.isArray);
  const seenObjects = new Set();
  const seenIds = new Set();
  let serial = Math.max(0, store.serial | 0);
  containers.forEach((list) => list.forEach((entry) => {
    const match = /^gu(\d+)$/.exec(String(entry?.id || ""));
    if (match) serial = Math.max(serial, Number(match[1]) || 0);
  }));
  const nextId = () => {
    let id = "";
    do { serial += 1; id = `gu${serial}`; } while (seenIds.has(id));
    return id;
  };
  let changed = false;
  containers.forEach((list) => {
    list.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      let isolated = entry;
      if (seenObjects.has(entry)) {
        isolated = { ...entry };
        list[index] = isolated;
        changed = true;
      }
      seenObjects.add(entry);
      const id = String(isolated.id || "");
      if (!id || seenIds.has(id)) {
        isolated = { ...isolated, id: nextId() };
        list[index] = isolated;
        changed = true;
      }
      seenIds.add(String(isolated.id));
    });
  });
  if ((store.serial | 0) !== serial) {
    store.serial = serial;
    changed = true;
  }
  return changed;
}

/* 万蛊录永久发现集合是唯一真源：蛊庐只扫描已经真正拥有的成蛊，
 * 不从蛊卵、市集预览或藏册计数猜测。API 未就绪时不写迁移标记，下次开庐重试。 */
function syncOwnedGuluDiscoveries(store) {
  const result = { ok: false, added: [], skipped: [] };
  if (!store || typeof store !== "object") return result;
  if (typeof markGuDiscovered !== "function" || typeof loadDiscoveredGu !== "function") return result;
  let discovered = null;
  try {
    const loaded = loadDiscoveredGu();
    const discoveredKeys = loaded && typeof loaded[Symbol.iterator] === "function"
      ? Array.from(loaded)
      : [];
    discovered = new Set(discoveredKeys);
  } catch (error) {
    return result;
  }
  const candidates = [
    ...(Array.isArray(store.slots) ? store.slots : []),
    ...(Array.isArray(store.nurture?.slots) ? store.nurture.slots : []),
  ];
  for (const slot of candidates) {
    if (!slot || slot.state !== "gu") continue;
    const cardKey = String(slot.cardKey || "");
    if (!cardKey || typeof CARD_LIBRARY === "undefined" || !CARD_LIBRARY[cardKey]) {
      if (cardKey && !result.skipped.includes(cardKey)) result.skipped.push(cardKey);
      continue;
    }
    if (discovered.has(cardKey)) continue;
    try {
      markGuDiscovered(cardKey);
      discovered.add(cardKey);
      result.added.push(cardKey);
    } catch (error) {
      try { console.warn("蛊庐成蛊未能写入万蛊录。", error); } catch (ignored) { /* 无控制台时静默 */ }
      return result;
    }
  }
  store.codexSyncVersion = OWNED_GULU_CODEX_SYNC_VERSION;
  result.ok = true;
  return result;
}

function getGuluStore() {
  if (!__guluCache) {
    try { const raw = JSON.parse(localStorage.getItem(GULU_KEY)); __guluCache = raw && typeof raw === "object" ? raw : {}; } catch (e) { __guluCache = {}; }
  }
  const s = __guluCache;
  s.materials = s.materials && typeof s.materials === "object" ? s.materials : {};
  if (typeof MATERIAL_IDS !== "undefined") MATERIAL_IDS.forEach((id) => { s.materials[id] = normalizeRedeemOwnedAmount(s.materials[id]); });
  s.ecologyMaterials = s.ecologyMaterials && typeof s.ecologyMaterials === "object" ? s.ecologyMaterials : {};
  const ecologyIds = typeof ECOLOGY_MATERIAL_IDS !== "undefined"
    ? ECOLOGY_MATERIAL_IDS
    : ["miasmaMossSac", "bloodMarshMarrow", "weatheredBoneSalt", "mysticHiveWax"];
  ecologyIds.forEach((id) => { s.ecologyMaterials[id] = normalizeRedeemOwnedAmount(s.ecologyMaterials[id]); });
  s.bossCores = normalizeRedeemOwnedAmount(s.bossCores);
  s.guEmbryo = normalizeRedeemOwnedAmount(s.guEmbryo); // V0.9.52 蛊胎：九转鼎六转以上的硬门槛，老档默认 0
  s.kindleSand = normalizeRedeemOwnedAmount(s.kindleSand); // V0.9.54 引火砂：投一份 +15 成功率
  s.guWard = normalizeRedeemOwnedAmount(s.guWard);         // V0.9.58 固蛊符：高转失败时护回残核与蛊胎
  if (!Array.isArray(s.slots)) s.slots = [];
  while (s.slots.length < GULU_SLOTS_MAX) s.slots.push(null); // V0.9.35：恒补到上限，占用的第四圃永不被裁
  s.injuryUntil = Number(s.injuryUntil) || 0;
  normalizeNurtureStore(s); // V0.9.57 养蛊室：灵泉 + 收纳位（老档自动补齐，见 NURTURE 段注释）
  if (!Array.isArray(s.events)) s.events = [];
  s.serial = s.serial | 0;
  const repairedInstances = normalizeGuluInstanceIdentity(s);
  s.sign = (s.sign && typeof s.sign === "object" && !Array.isArray(s.sign)) ? s.sign : {}; // V0.9.35 归庐日课：{lastDate,streak,total}
  s.market = (s.market && typeof s.market === "object" && !Array.isArray(s.market)) ? s.market : {};
  s.market.scrip = normalizeRedeemOwnedAmount(s.market.scrip);
  if (!Array.isArray(s.pendingRunRewards)) s.pendingRunRewards = [];
  s.market.deathWard = Math.min(BAIGUSHI_WARD_MAX, Math.max(0, s.market.deathWard | 0));
  s.market.purchases = Math.max(0, s.market.purchases | 0);
  s.market.dailyStockDate = String(s.market.dailyStockDate || "");
  // 旧档兼容字段：自不限次激励起不再参与门禁，保留读取避免迁移时破坏存档结构。
  s.market.rewardedScripDate = String(s.market.rewardedScripDate || "");
  s.market.dailyStock = (s.market.dailyStock && typeof s.market.dailyStock === "object" && !Array.isArray(s.market.dailyStock))
    ? s.market.dailyStock : {};
  if (!Array.isArray(s.market.duelRewardIds)) s.market.duelRewardIds = [];
  s.market.duelRewardIds = Array.from(new Set(s.market.duelRewardIds.map(String).filter(Boolean)));
  if (!Array.isArray(s.collectionUnread)) s.collectionUnread = [];
  const migratedCollection = migrateGuluCollection(s);
  const migratedHatchTimes = migrateGuluHatchTimes(s);
  let migratedQualitySemantics = false;
  [...s.slots, ...normalizeNurtureStore(s).slots].filter(Boolean).forEach((slot) => {
    if (slot.state !== "gu" || !GULU_GRADES[slot.grade]) return;
    const expectedNurture = getGuluNurtureBonus(slot.grade);
    if ((slot.guluNurture | 0) !== expectedNurture) {
      slot.guluNurture = expectedNurture;
      migratedQualitySemantics = true;
    }
    if (!slot.customName && CARD_LIBRARY[slot.cardKey]) {
      const expectedName = `${getGuluGradeDisplayName(slot.grade)}·${CARD_LIBRARY[slot.cardKey].name}`;
      if (slot.name !== expectedName) {
        slot.name = expectedName;
        migratedQualitySemantics = true;
      }
    }
  });
  if (migratedCollection || migratedHatchTimes || repairedInstances || migratedQualitySemantics) {
    try { safeWriteJson(GULU_KEY, JSON.stringify(s)); } catch (e) { /* 迁移写回失败不阻塞当前会话 */ }
  }
  return s;
}
function saveGuluStore() { try { safeWriteJson(GULU_KEY, JSON.stringify(getGuluStore())); } catch (e) { /* 存储不可用则忽略 */ } }

/* 蛊斗场随机匹配胜利奖励。邀请房从调用边界和本函数双重拒绝；battleId 留痕防止
 * 重复结算/重放快照多发。内部继续沿用 scrip 字段，兼容所有旧档。 */
function grantOnlineDuelReward(battleId, rewardEligible) {
  const id = String(battleId || "").trim().slice(0, 96);
  if (!rewardEligible || !id) return { ok: false, reason: "ineligible" };
  const store = getGuluStore();
  store.market.duelRewardIds ||= [];
  if (store.market.duelRewardIds.includes(id)) return { ok: false, reason: "claimed" };
  const ecologyIds = typeof ECOLOGY_MATERIAL_IDS !== "undefined"
    ? [...ECOLOGY_MATERIAL_IDS]
    : ["miasmaMossSac", "bloodMarshMarrow", "weatheredBoneSalt", "mysticHiveWax"];
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i += 1) { hash ^= id.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  const materialId = ecologyIds[hash % ecologyIds.length];
  store.market.scrip = normalizeRedeemOwnedAmount(store.market.scrip) + 100;
  store.ecologyMaterials[materialId] = normalizeRedeemOwnedAmount(store.ecologyMaterials[materialId]) + 1;
  store.market.duelRewardIds.push(id);
  guluPushEvent(store, `蛊斗场随机对局获胜：蛊钱 +100，${typeof ECOLOGY_MATERIALS !== "undefined" ? (ECOLOGY_MATERIALS[materialId]?.name || materialId) : materialId} +1。`);
  saveGuluStore();
  return { ok: true, scrip: 100, materialId, materialCount: 1 };
}

/* 局外领取回执只读蛊庐动作前后快照；不保存状态、不补发奖励。 */
function enqueueOutgameReceipt(receipt, focusAnchor) {
  if (typeof NmgOutgameReceipts === "undefined") return false;
  if (focusAnchor && typeof focusAnchor.focus === "function" && focusAnchor.isConnected !== false) {
    try { focusAnchor.focus(); } catch (error) { /* 锚点失效时仍可展示回执。 */ }
  }
  NmgOutgameReceipts.enqueue(receipt);
  if (typeof refreshModalLock === "function") refreshModalLock();
  window.setTimeout(() => dom.outgameReceiptAccept?.focus(), 0);
  return true;
}

function captureOutgameInventory(store = getGuluStore()) {
  const s = store || {};
  const safeAmount = (value) => {
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
  };
  const materialIds = typeof MATERIAL_IDS !== "undefined" ? MATERIAL_IDS : Object.keys(s.materials || {});
  const ecologyIds = typeof ECOLOGY_MATERIAL_IDS !== "undefined" ? ECOLOGY_MATERIAL_IDS : Object.keys(s.ecologyMaterials || {});
  return {
    materials: Object.fromEntries(materialIds.map((id) => [id, safeAmount(s.materials?.[id])])),
    ecologyMaterials: Object.fromEntries(ecologyIds.map((id) => [id, safeAmount(s.ecologyMaterials?.[id])])),
    scrip: safeAmount(s.market?.scrip),
    bossCores: safeAmount(s.bossCores),
    guEmbryo: safeAmount(s.guEmbryo),
    kindleSand: safeAmount(s.kindleSand),
    guWard: safeAmount(s.guWard),
    deathWard: Math.max(0, s.market?.deathWard | 0),
    injuryUntil: Math.max(0, Number(s.injuryUntil) || 0),
    /* V0.9.54：道行不在蛊庐存档里（它属本命蛊），但兑换码/道果都会加它，
     * 不一并快照的话领取弹窗就漏报这项所得。取当前所选蛊修的道行。 */
    dao: (() => {
      try {
        const heroId = progression?.selectedHeroId;
        return (heroId && typeof getBenmingDaoxing === "function") ? Math.max(0, getBenmingDaoxing(heroId) | 0) : 0;
      } catch (e) { return 0; }
    })(),
    nurture: {
      level: Math.max(1, s.nurture?.level | 0),
      dew: Math.max(0, s.nurture?.dew | 0),
      slots: (Array.isArray(s.nurture?.slots) ? s.nurture.slots : []).map((slot) => slot ? {
        id: String(slot.id || ""),
        name: String(slot.customName || slot.name || "蛊"),
        cardKey: String(slot.cardKey || ""),
        grade: String(slot.grade || ""),
        upgradeLevel: Math.max(0, slot.upgradeLevel | 0),
        nurture: Math.max(0, slot.nurture | 0),
      } : null),
    },
    slots: (s.slots || []).map((slot) => slot ? {
      id: String(slot.id || ""), state: String(slot.state || ""), grade: String(slot.grade || ""),
      cardKey: String(slot.cardKey || ""), fixedCardKey: String(slot.fixedCardKey || ""),
      name: String(slot.name || ""), upgradeLevel: Math.max(0, slot.upgradeLevel | 0),
      hatchAt: Math.max(0, Number(slot.hatchAt) || 0),
    } : null),
  };
}

function buildOutgameReceipt(before, after, meta = {}) {
  if (!before || !after) return null;
  const items = [];
  /* V0.9.54 美化接线：每条回执带 tone，弹窗据此分色（材料沿用 MATERIALS 自己的色系，
   * 其余按语义定色）。不带 tone 则回落默认金褐——条目不会因为漏配色而丢失。 */
  const pushCount = (glyph, name, amount, tone = "") => {
    const gained = Math.max(0, Number(amount) || 0);
    if (gained > 0) items.push({ glyph, name, amount: gained, detail: "已入库", tone });
  };
  const materialIds = new Set([...Object.keys(before.materials || {}), ...Object.keys(after.materials || {})]);
  materialIds.forEach((id) => {
    const material = typeof MATERIALS !== "undefined" ? MATERIALS[id] : null;
    pushCount(material?.glyph || "材", material?.name || id, (after.materials?.[id] | 0) - (before.materials?.[id] | 0), material?.tone || "");
  });
  pushCount("契", "蛊钱", after.scrip - before.scrip, "gold");
  pushCount("核", "蛊母残核", after.bossCores - before.bossCores, "boss");
  pushCount("胎", "蛊胎", after.guEmbryo - before.guEmbryo, "tian");
  pushCount("砂", "引火砂", after.kindleSand - before.kindleSand, "blood");
  pushCount("符", "固蛊符", after.guWard - before.guWard, "jade");
  pushCount("匣", "护命蛊匣", after.deathWard - before.deathWard, "jade");
  pushCount("道", "本命蛊道行", (after.dao | 0) - (before.dao | 0), "tian");
  pushCount("露", "元髓露", (after.nurture?.dew | 0) - (before.nurture?.dew | 0), "jade");
  if ((after.nurture?.level | 0) > (before.nurture?.level | 0)) {
    items.push({
      glyph: "泉", name: "灵泉", amount: 1,
      detail: `${before.nurture?.level | 0} 级 → ${after.nurture?.level | 0} 级`, tone: "jade",
    });
  }
  const gradeName = (id) => (typeof getGuluGradeDisplayName === "function" && getGuluGradeDisplayName(id)) || id || "未知品质";
  const oldNurtureSlots = new Map((before.nurture?.slots || []).filter(Boolean).map((slot) => [slot.id, slot]));
  (after.nurture?.slots || []).filter(Boolean).forEach((slot) => {
    const oldSlot = oldNurtureSlots.get(slot.id);
    if (!oldSlot) {
      items.push({
        glyph: "蛊", name: slot.name || "补发成蛊", amount: 1,
        detail: `已入养蛊室 · ${gradeName(slot.grade)} · ${(slot.upgradeLevel | 0) + 1} 转`,
        tone: (typeof GULU_GRADE_TONES !== "undefined" && GULU_GRADE_TONES[slot.grade]) || "gold",
      });
      return;
    }
    const gained = (slot.nurture | 0) - (oldSlot?.nurture | 0);
    if (oldSlot && gained > 0) {
      items.push({
        glyph: "养", name: `${slot.name || "蛊"}·温养`, amount: gained,
        detail: `${oldSlot.nurture | 0} → ${slot.nurture | 0}`, tone: "jade",
      });
    }
  });

  const cardName = (slot) => slot?.name || (typeof CARD_LIBRARY !== "undefined" && CARD_LIBRARY[slot?.cardKey || slot?.fixedCardKey]?.name) || "蛊卵";
  const count = Math.max(before.slots?.length || 0, after.slots?.length || 0);
  for (let index = 0; index < count; index += 1) {
    const oldSlot = before.slots?.[index] || null;
    const newSlot = after.slots?.[index] || null;
    // 已知蛊种按战斗定位取色；蛊卵尚未揭示结果，保持中性。
    const slotTone = (slot) => slot?.cardKey && typeof getGuCombatTone === "function"
      ? getGuCombatTone({ ...(CARD_LIBRARY[slot.cardKey] || {}), fusedFrom: slot.fusedFrom })
      : "gold";
    if (!oldSlot && newSlot) {
      items.push({ glyph: newSlot.state === "gu" ? "蛊" : "卵", name: cardName(newSlot), amount: 1, detail: `已入第 ${index + 1} 圃`, tone: slotTone(newSlot) });
      continue;
    }
    if (!oldSlot || !newSlot) continue;
    if (oldSlot.state === "egg" && newSlot.state === "gu") {
      items.push({ glyph: "蛊", name: cardName(newSlot), amount: 1, detail: `第 ${index + 1} 圃破壳`, tone: slotTone(newSlot) });
    } else if (oldSlot.state === "gu" && newSlot.state === "egg") {
      items.push({ glyph: "髓", name: cardName(newSlot), amount: 1, detail: `第 ${index + 1} 圃换髓重结`, tone: slotTone(newSlot) });
    } else if (oldSlot.grade !== newSlot.grade) {
      items.push({ glyph: "阶", name: "蛊卵凝阶", amount: 1, detail: `${gradeName(oldSlot.grade)} → ${gradeName(newSlot.grade)}`, tone: slotTone(newSlot) });
    } else if (oldSlot.upgradeLevel !== newSlot.upgradeLevel) {
      items.push({ glyph: "转", name: cardName(newSlot), amount: 1, detail: `${oldSlot.upgradeLevel + 1} 转 → ${newSlot.upgradeLevel + 1} 转`, tone: "gold" });
    } else if (oldSlot.state === "egg" && newSlot.hatchAt > 0 && oldSlot.hatchAt > newSlot.hatchAt) {
      items.push({ glyph: "时", name: "破壳加速", amount: 1, detail: "破壳时辰已提前", tone: "jade" });
    }
  }
  if (before.injuryUntil > 0 && after.injuryUntil === 0) {
    items.push({ glyph: "愈", name: "养伤散", amount: 1, detail: "本命蛊静养已解除", tone: "jade" });
  }
  if (!items.length) return null;
  return {
    source: meta.source || "蛊庐",
    title: meta.title || "所得已入库",
    tone: meta.tone || "jade",
    items,
    summary: meta.summary || "实际所得已经写入蛊庐存档。",
  };
}

function showOutgameReceiptFromChange(before, store = getGuluStore(), meta = {}) {
  const receipt = buildOutgameReceipt(before, captureOutgameInventory(store), meta);
  if (!receipt || !receipt.items.length) return null;
  if (!enqueueOutgameReceipt(receipt, dom.guluCloseButton)) return null;
  return receipt;
}
// 全档最高本命蛊转数（辟圃/解锁条件只看最高的那只，换角色不回锁）。
function getGuluTopBenmingStage() {
  if (typeof getBenmingStage !== "function" || typeof getBenmingStore !== "function") return 0;
  try {
    return Object.keys(getBenmingStore() || {}).reduce((top, h) => Math.max(top, getBenmingStage(h) | 0), 0);
  } catch (e) { return 0; }
}
// 可用圃数——数组恒定 GULU_SLOTS_MAX 格，此处只决定"可孵卵/可用"的前 N 格；
// 解锁条件全部单调（通关只增不减、转数只升不降），故永不回锁遮蔽已占用的圃。
function getGuluSlotCap() {
  const cleared = !!(progression && progression.eliteUnlocked);
  const stage = getGuluTopBenmingStage();
  let cap = GULU_SLOTS;
  GULU_SLOT_LADDER.forEach((step) => {
    if (step.cleared ? cleared : stage >= step.stage) cap = Math.max(cap, step.cap);
  });
  return Math.min(GULU_SLOTS_MAX, cap);
}
// 某一格（0 基）尚未辟开时该显示什么条件——占位卡与孵卵守卫共用同一份文案，避免两处写死不同步。
function getGuluSlotUnlockHint(index) {
  const step = GULU_SLOT_LADDER.find((s) => s.cap === (index | 0) + 1);
  return step ? step.hint : "更深的道行";
}
// ===== V0.9.35 归庐日课（每日签到）：局外轻奖励，只发蛊庐材料（禁发战斗资源/残核/道行）；7日循环、温和不逼肝、漏签只断连签不没收既得。=====
const SIGN_CYCLE = 7;
const SIGN_REWARDS = Object.freeze([2, 2, 2, 3, 2, 2, 4]); // day1..7 发放材料份数；第7日里程碑更丰
function guluTodayKey() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; } // 本地墙钟自然日（照 isGuluNight/saveStamp）
// AD-2 局外激励：由任意时间戳取本地自然日键（与 guluTodayKey 同格式），供蛊卵加速/蛊钱每日门禁按传入 now 判定，便于单测。
function guluDateKeyOf(ts) { const d = new Date(Number(ts) || 0); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; }
function signDateToTs(ymd) {
  const str = String(ymd || "");
  const y = Number(str.slice(0, 4)), m = Number(str.slice(4, 6)), d = Number(str.slice(6, 8));
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d).getTime(); // 本地零点；相邻日差经 Math.round 抹平 DST
}
// 今日相对签到态：{signedToday, streak(现连签), nextIdx(今日将领的循环位), nextCount}
function getSignState() {
  const s = getGuluStore();
  const today = guluTodayKey();
  const sign = s.sign;
  const signedToday = sign.lastDate === today;
  const prevTs = sign.lastDate ? signDateToTs(sign.lastDate) : 0;
  const gap = prevTs > 0 ? Math.round((signDateToTs(today) - prevTs) / 86400000) : 999;
  const curStreak = Math.max(0, sign.streak | 0);
  const nextStreak = signedToday ? curStreak : (gap === 1 ? curStreak + 1 : 1); // 今日点卯后的连签数
  const nextIdx = (Math.max(1, nextStreak) - 1) % SIGN_CYCLE;
  // V0.9.35 审计修：断签且今日未点卯时，标题显示的现连签应归 0（与已重置的圆点/按钮自洽），不再显示过期值
  const displayStreak = (signedToday || gap === 1) ? curStreak : 0;
  return { signedToday, streak: curStreak, displayStreak, total: Math.max(0, sign.total | 0), nextStreak, nextIdx, nextCount: SIGN_REWARDS[nextIdx] || 2 };
}
function claimDailySign() {
  const s = getGuluStore();
  const today = guluTodayKey();
  const sign = s.sign;
  if (sign.lastDate === today) return { ok: false, text: "今日已在蛊庐点卯，明日再来。" };
  const st = getSignState();
  sign.streak = st.nextStreak;
  sign.total = Math.max(0, sign.total | 0) + 1;
  sign.lastDate = today;
  const count = SIGN_REWARDS[st.nextIdx] || 2;
  const gained = {};
  for (let n = 0; n < count; n++) {
    const id = MATERIAL_IDS[Math.floor(guluRandom() * MATERIAL_IDS.length)] || MATERIAL_IDS[0];
    s.materials[id] = normalizeRedeemOwnedAmount(s.materials[id]) + 1;
    gained[id] = (gained[id] | 0) + 1;
  }
  sign.lastGainedDate = today;
  sign.lastGained = { ...gained };
  const summary = Object.keys(gained).map((id) => `${MATERIALS[id].name}×${gained[id]}`).join("、");
  const milestone = st.nextIdx === SIGN_CYCLE - 1;
  guluPushEvent(s, `归庐日课·连签第 ${sign.streak} 日：得 ${summary}。`);
  saveGuluStore();
  return { ok: true, text: `点卯得 ${summary}（连签 ${sign.streak} 日）。`, milestone, summary, gained, streak: sign.streak };
}
function guluMatTotal(store) { return MATERIAL_IDS.reduce((n, id) => n + normalizeRedeemOwnedAmount(store.materials[id]), 0); }
function formatBaigushiCost(cost) {
  return Object.entries(cost).map(([id, count]) => `${MATERIALS[id]?.name || id}×${count}`).join("、");
}
function canPayBaigushiMaterials(store, cost) {
  return Object.entries(cost).every(([id, count]) => normalizeRedeemOwnedAmount(store.materials[id]) >= count);
}
function payBaigushiMaterials(store, cost) {
  Object.entries(cost).forEach(([id, count]) => { store.materials[id] = Math.max(0, normalizeRedeemOwnedAmount(store.materials[id]) - count); });
}
/* V0.9.57 堵漏（玩家「青色宇宙」实报）：
 *   「无尽独有的刚入局内就可以点击撤离，所以秒开再秒点出来，就相当于结束了一局，
 *     可以免费白嫖 4 个蛊钱，几分钟能刷上百个。」
 * 根因不在无尽的撤离设计，而在这里：折算基数用的是【持有蛊石】，
 * 而开局白送 REWARD_BALANCE.startingGuStones=20 点，20÷5 正好 4 契——数字完全对得上。
 * 修法是把基数改成【本局净赚】＝ 持有 − 开局本金，夹 0：
 *   · 秒进秒撤：20−20=0，一契不出，漏洞即止；
 *   · 正常推进：赚多少折多少，观感不变（只是不再白送那 4 契）；
 *   · 局内花光蛊石再离塔：夹 0，不倒扣。
 * 刻意不改无尽的「随时可撤离」——那是设计，且改它会波及收手/结算全链路。
 * startingStones 默认 0：老调用点与门禁不传时行为与旧版一致，只有真实结算会传本金。 */
function settleMarketScripFromRun(store, guStones, outcome, startingStones = 0) {
  const living = outcome === "cleared" || outcome === "withdrawn";
  const earned = Math.max(0, (guStones | 0) - Math.max(0, startingStones | 0));
  const available = Math.max(0, earned);
  const uncapped = living ? Math.floor(available / BAIGUSHI_SCRIP_RATE) : 0;
  const gained = Math.min(BAIGUSHI_SCRIP_RUN_CAP, uncapped);
  if (!store.market || typeof store.market !== "object") store.market = {};
  store.market.scrip = normalizeRedeemOwnedAmount(store.market.scrip) + gained;
  return {
    gained,
    spentStones: gained * BAIGUSHI_SCRIP_RATE,
    capped: living && uncapped > gained,
  };
}
/* ===== 局外激励视频入口·纯规则 =====
 * 六处均由 ops/check-rewarded-gulu-market.js 直接 vm 提取校验。
 * 旧 rewardedHatchDate / rewardedScripDate 仅留给旧档兼容；以下资格与发奖不读写它们。
 * 每个 grant 都复核点击时捕获的对象，广告期间换槽、换日或换货一律零奖励。 */
function findGuluEggSlot(store, eggId) {
  if (!store || !Array.isArray(store.slots)) return null;
  const cap = getGuluSlotCap();
  return store.slots.find((slot, i) => i < cap && slot && slot.id === eggId && slot.state === "egg") || null;
}
function canRewardedHatchInstant(store, eggId, egg, now) {
  const slot = findGuluEggSlot(store, eggId);
  if (!slot || slot !== egg) return false;
  if ((Number(slot.hatchAt) || 0) <= now) return false; // 已到破壳点，无需加速
  return true;
}
function grantRewardedHatchInstant(store, eggId, egg, now) {
  if (!canRewardedHatchInstant(store, eggId, egg, now)) return { ok: false };
  const slot = findGuluEggSlot(store, eggId);
  slot.hatchAt = now;
  return { ok: true, slot, instant: true };
}
function canClaimRewardedScrip(store, market) {
  return Boolean(store && market && typeof market === "object" && store.market === market);
}
function grantRewardedScrip(store, market) {
  if (!canClaimRewardedScrip(store, market)) return { ok: false, gained: 0 };
  market.scrip = normalizeRedeemOwnedAmount(market.scrip) + 6;
  return { ok: true, gained: 6, scrip: market.scrip };
}
function normalizeGuluSignReward(gained) {
  const source = gained && typeof gained === "object" && !Array.isArray(gained) ? gained : {};
  return Object.fromEntries(MATERIAL_IDS
    .map((id) => [id, Math.max(0, Math.floor(Number(source[id]) || 0))])
    .filter(([, count]) => count > 0));
}
function fingerprintGuluSignReward(gained) {
  const normalized = normalizeGuluSignReward(gained);
  return MATERIAL_IDS.map((id) => `${id}:${normalized[id] || 0}`).join("|");
}
function canClaimRewardedSign(store, dateKey, fingerprint) {
  if (!store || !store.sign || typeof store.sign !== "object") return false;
  const key = String(dateKey || "");
  const gained = normalizeGuluSignReward(store.sign.lastGained);
  if (!key || store.sign.lastDate !== key || store.sign.lastGainedDate !== key || !Object.keys(gained).length) return false;
  return fingerprintGuluSignReward(gained) === String(fingerprint || "");
}
function grantRewardedSign(store, dateKey, fingerprint) {
  if (!canClaimRewardedSign(store, dateKey, fingerprint)) return { ok: false, gained: {} };
  const gained = normalizeGuluSignReward(store.sign.lastGained);
  Object.entries(gained).forEach(([id, count]) => {
    store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) + count;
  });
  return { ok: true, gained, summary: Object.entries(gained).map(([id, count]) => `${MATERIALS[id]?.name || id}×${count}`).join("、") };
}
function canClaimRewardedDew(store, nurture) {
  if (!store || store.nurture !== nurture || !nurture || typeof nurture !== "object") return false;
  const conf = getNurtureSpringLevel(nurture.level);
  return Math.max(0, nurture.dew | 0) < conf.cap;
}
function grantRewardedDew(store, nurture) {
  if (!canClaimRewardedDew(store, nurture)) return { ok: false, gained: 0 };
  const conf = getNurtureSpringLevel(nurture.level);
  nurture.dew = Math.min(conf.cap, Math.max(0, nurture.dew | 0) + 1);
  return { ok: true, gained: 1, dew: nurture.dew, cap: conf.cap };
}
function findRewardedNurtureSlot(store, guId) {
  if (!store?.nurture || !Array.isArray(store.nurture.slots)) return null;
  return store.nurture.slots.find((slot) => slot?.id === guId && slot.state === "gu") || null;
}
function canRewardedNurture(store, guId, slot) {
  const current = findRewardedNurtureSlot(store, guId);
  return Boolean(current && current === slot && !isGuluSourceLocked(current.id)
    && Math.max(0, current.nurture | 0) < NURTURE_MAX);
}
function grantRewardedNurture(store, guId, slot) {
  if (!canRewardedNurture(store, guId, slot)) return { ok: false, gained: 0 };
  const before = Math.max(0, slot.nurture | 0);
  slot.nurture = Math.min(NURTURE_MAX, before + NURTURE_GAIN_PER_DEW);
  return { ok: true, gained: slot.nurture - before, nurture: slot.nurture, full: slot.nurture >= NURTURE_MAX };
}

/* ===== V0.9.57 印记兑蛊钱（用户定调：获得印记可转换成蛊钱，每枚只可兑一次）=====
 * 防刷是这个功能的【全部】难点：印记是持久成就，本身不会消失，
 * 不记已兑集合就等于无限蛊钱。已兑集合落在 store.market.sealScripClaimed，
 * 随存档导出/导入（与 redeemedCodes 同款），不新增第三套状态。
 *
 * 天印刻意不是布尔而是「已兑到第几重」：玩家从五重打到八重时仍能补兑差额三重，
 * 既防重复领取，又不惩罚继续挑战——若记成布尔，兑过一次后再登高就永远白登。
 *
 * 以下全是纯函数（heroSeals / tianCleared 由调用方传入，不在内部读 localStorage），
 * 便于门禁 vm 直接提取校验「同一枚印记二次兑换必须失败」。 */
const SEAL_SCRIP_VALUES = Object.freeze({ normal: 30, elite: 60, deathtrial: 100 });
const SEAL_SCRIP_LABELS = Object.freeze({ normal: "铜印", elite: "银印", deathtrial: "金印" });
const TIAN_SEAL_SCRIP_PER_TIER = 15;

function ensureSealScripStore(store) {
  if (!store.market || typeof store.market !== "object") store.market = {};
  if (!store.market.sealScripClaimed || typeof store.market.sealScripClaimed !== "object") store.market.sealScripClaimed = {};
  return store.market.sealScripClaimed;
}

/* 列出单个蛊修名下的可兑印记。heroSeals = { normal, elite, deathtrial } 计数；tianCleared = 已通最高重数。 */
function listHeroSealScripOffers(store, heroId, heroName, heroSeals, tianCleared) {
  const claimed = ensureSealScripStore(store);
  const offers = [];
  Object.keys(SEAL_SCRIP_VALUES).forEach((kind) => {
    if (!((heroSeals || {})[kind] | 0)) return; // 没拿到这枚印就不列出来，免得空画饼
    const id = `${heroId}:${kind}`;
    offers.push({
      id, heroId, heroName, kind,
      label: `${heroName} · ${SEAL_SCRIP_LABELS[kind]}`,
      scrip: SEAL_SCRIP_VALUES[kind],
      claimed: !!claimed[id],
    });
  });
  const tier = Math.max(0, Math.floor(Number(tianCleared) || 0));
  if (tier > 0) {
    const paidTier = Math.max(0, Math.floor(Number(claimed[`${heroId}:tian`]) || 0));
    const pendingTiers = Math.max(0, tier - paidTier);
    offers.push({
      id: `${heroId}:tian`, heroId, heroName, kind: "tian", tier, paidTier, pendingTiers,
      label: `${heroName} · 天印第 ${tier} 重`,
      scrip: pendingTiers * TIAN_SEAL_SCRIP_PER_TIER,
      claimed: pendingTiers <= 0,
    });
  }
  return offers;
}

/* 汇总全部蛊修的可兑印记（UI 用）。HEROES/getHeroSeals/getTianCleared 都在 game.js 与 nmg-tian.js，
 * 本文件先于它们加载，故一律运行时取用并留降级分支，不在顶层引用。 */
function listAllSealScripOffers(store) {
  if (typeof HEROES === "undefined" || !HEROES) return [];
  return Object.entries(HEROES).flatMap(([heroId, hero]) => listHeroSealScripOffers(
    store, heroId, hero?.name || heroId,
    typeof getHeroSeals === "function" ? getHeroSeals(heroId) : {},
    typeof getTianCleared === "function" ? getTianCleared(heroId) : 0,
  ));
}

/* 兑换。调用方必须传【刚 list 出来的】offer，不可信任 UI 传回的旧对象——
 * 这里仍对 claimed 做二次判定，任何重复兑换都在此拦死。 */
function claimSealScrip(store, offer) {
  if (!store || !offer || offer.claimed || (offer.scrip | 0) <= 0) {
    return { ok: false, gained: 0, reason: "unavailable" };
  }
  const claimed = ensureSealScripStore(store);
  if (offer.kind === "tian") {
    const paidTier = Math.max(0, Math.floor(Number(claimed[offer.id]) || 0));
    const tier = Math.max(0, Math.floor(Number(offer.tier) || 0));
    if (paidTier >= tier) return { ok: false, gained: 0, reason: "already-claimed" };
    claimed[offer.id] = tier;
  } else {
    if (claimed[offer.id]) return { ok: false, gained: 0, reason: "already-claimed" };
    claimed[offer.id] = 1;
  }
  store.market.scrip = normalizeRedeemOwnedAmount(store.market.scrip) + (offer.scrip | 0);
  return { ok: true, gained: offer.scrip | 0, scrip: store.market.scrip };
}

/* ===== V0.9.51 兑换码：离线签名码——运营者用 ops/gen-redeem-code.js 生成、私发或公告，玩家在百蛊市输入领蛊钱。
 * 无后端约束下的取舍：签名盐内嵌前端（可被拆包提取，属已接受的低风险，奖励仅蛊钱）；
 * 一码一设备一次（market.redeemedCodes 本机持久，随存档导出/导入）。
 * 码型：NMG-XXXXXX-YYYY（6 位 base36 载荷 = 蛊钱数 2 + 失效日 2 + 批号 2；4 位 base36 签名）。 */
const REDEEM_SALT = "ni-ming-gu-tu-2026-yan-huo-xu-ming";
const REDEEM_EPOCH_UTC = Date.UTC(2026, 0, 1); // 失效日基准：自 2026-01-01 起算的天数（0 = 永不过期）
function redeemHash(text) {
  let h = 5381;
  const s = `${text}#${REDEEM_SALT}`;
  for (let i = 0; i < s.length; i += 1) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h;
}
function redeemBase36(value, width) { return Math.max(0, value | 0).toString(36).toUpperCase().padStart(width, "0").slice(-width); }
function buildRedeemCode(scrip, expireDay, batch) {
  const payload = redeemBase36(scrip, 2) + redeemBase36(expireDay, 2) + redeemBase36(batch, 2);
  const sig = redeemBase36(redeemHash(payload) % Math.pow(36, 4), 4);
  return `NMG-${payload}-${sig}`;
}
/* 运营礼包扩展码：兼容旧 NMG 蛊钱码，NMG2 额外编码“每种炼蛊材料数量”。
 * 码型 NMG2-XXXXXXX-YYYY：蛊钱2 + 失效日2 + 每材1 + 批号2；签名把版本前缀一并纳入。 */
function buildRedeemBundleCode(scrip, expireDay, materialCount, batch) {
  const payload = redeemBase36(scrip, 2) + redeemBase36(expireDay, 2)
    + redeemBase36(materialCount, 1) + redeemBase36(batch, 2);
  const sig = redeemBase36(redeemHash(`2${payload}`) % Math.pow(36, 4), 4);
  return `NMG2-${payload}-${sig}`;
}
/* V0.9.54 道行礼包码 NMG3-XXXXXXXXX-YYYY：蛊钱2 + 失效日2 + 每材1 + 道行2 + 批号2。
 * 道行发给「当前所选蛊修」的本命蛊，与百蛊市本命道果同一条发放路径（addBenmingDaoxing）。
 * V0.9.66 起不再设 600 的人为上限；旧格式仍受两位 base36 的编码容量限制，大额奖励改走 NMG5。 */
function buildRedeemDaoCode(scrip, expireDay, materialCount, dao, batch) {
  const payload = redeemBase36(scrip, 2) + redeemBase36(expireDay, 2)
    + redeemBase36(materialCount, 1) + redeemBase36(dao, 2) + redeemBase36(batch, 2);
  const sig = redeemBase36(redeemHash(`3${payload}`) % Math.pow(36, 4), 4);
  return `NMG3-${payload}-${sig}`;
}
/* 玩家补偿码 NMG4：直接发一只指定成蛊，不绕孵化随机。
 * 码型 NMG4-CARDKEY-GTEEBB-SSSS：蛊种 key + 品阶1 + 转数1 + 失效日2 + 批号2 + 签名4。
 * 蛊种写真实 cardKey，避免用会随版本增删而漂移的数组下标。 */
const REDEEM_GU_GRADE_TOKEN = Object.freeze({ fan: "F", ling: "L", xuan: "X", tian: "T" });
const REDEEM_GU_GRADE_BY_TOKEN = Object.freeze({ F: "fan", L: "ling", X: "xuan", T: "tian" });
function resolveRedeemGuCardKey(raw) {
  const token = String(raw || "").trim().toUpperCase();
  if (!token || !/^[0-9A-Z_]+$/.test(token) || typeof CARD_LIBRARY === "undefined") return "";
  return Object.keys(CARD_LIBRARY).find((key) => String(key).toUpperCase() === token) || "";
}
function buildRedeemGuCode(cardKey, grade, turn, expireDay, batch) {
  const resolvedKey = resolveRedeemGuCardKey(cardKey);
  const gradeId = String(grade || "").trim().toLowerCase();
  const gradeToken = REDEEM_GU_GRADE_TOKEN[gradeId] || REDEEM_GU_GRADE_BY_TOKEN[String(grade || "").trim().toUpperCase()];
  const normalizedGrade = REDEEM_GU_GRADE_TOKEN[gradeToken] ? gradeToken : gradeId;
  const token = REDEEM_GU_GRADE_TOKEN[normalizedGrade];
  const turnNumber = Number(turn) | 0;
  if (!resolvedKey || !token || turnNumber < 1 || turnNumber > 9) return "";
  const payload = token + redeemBase36(turnNumber, 1) + redeemBase36(expireDay, 2) + redeemBase36(batch, 2);
  const keyToken = resolvedKey.toUpperCase();
  const sig = redeemBase36(redeemHash(`4${keyToken}:${payload}`) % Math.pow(36, 4), 4);
  return `NMG4-${keyToken}-${payload}-${sig}`;
}
const REDEEM_UNIVERSAL_TYPES = Object.freeze(new Set([
  "scrip", "material", "ecologyMaterial", "forgeSupply", "daoxing", "gu",
  "guStones", "lifespan", "card", "relic", "satchel",
]));
const REDEEM_FORGE_SUPPLY_IDS = Object.freeze(new Set(["bossCores", "guEmbryo", "guWard", "kindleSand"]));
function redeemCatalogHas(catalogName, id) {
  if (!id) return false;
  if (catalogName === "material") return typeof MATERIAL_IDS !== "undefined" && MATERIAL_IDS.includes(id);
  if (catalogName === "ecologyMaterial") return typeof ECOLOGY_MATERIAL_IDS !== "undefined" && ECOLOGY_MATERIAL_IDS.includes(id);
  if (catalogName === "card" || catalogName === "gu") return typeof CARD_LIBRARY !== "undefined" && Boolean(CARD_LIBRARY[id]);
  if (catalogName === "relic") return typeof ORDINARY_RELICS !== "undefined" && Boolean(ORDINARY_RELICS[id]);
  if (catalogName === "satchel") return typeof BATTLE_ITEMS !== "undefined" && Boolean(BATTLE_ITEMS[id]);
  if (catalogName === "daoxing") return typeof BENMING_GU !== "undefined" && Boolean(BENMING_GU[id]);
  if (catalogName === "forgeSupply") return REDEEM_FORGE_SUPPLY_IDS.has(id);
  return false;
}
function normalizeUniversalRedeemReward(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const type = String(raw.type || "").trim();
  const amount = Number(raw.amount);
  if (!REDEEM_UNIVERSAL_TYPES.has(type) || !Number.isSafeInteger(amount) || amount <= 0) return null;
  if (["scrip", "guStones", "lifespan"].includes(type)) return { type, amount };
  if (type === "daoxing") {
    const heroId = String(raw.heroId || "").trim();
    return redeemCatalogHas("daoxing", heroId) ? { type, heroId, amount } : null;
  }
  const id = String(raw.id || "").trim();
  if (!redeemCatalogHas(type, id)) return null;
  if (type === "gu") {
    const grade = String(raw.grade || "").trim().toLowerCase();
    const turn = Number(raw.turn);
    if (!REDEEM_GU_GRADE_TOKEN[grade] || !Number.isSafeInteger(turn) || turn < 1 || turn > 9) return null;
    return { type, id, grade, turn, amount };
  }
  return { type, id, amount };
}
function validateUniversalRedeemRewards(rewards) {
  if (!Array.isArray(rewards) || !rewards.length) return { ok: false, reason: "reward" };
  const normalized = [];
  for (const reward of rewards) {
    const item = normalizeUniversalRedeemReward(reward);
    if (!item) return { ok: false, reason: "reward" };
    normalized.push(item);
  }
  return { ok: true, rewards: normalized };
}
function encodeRedeemPayload(text) {
  try {
    return btoa(unescape(encodeURIComponent(String(text)))).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  } catch (error) { return ""; }
}
function decodeRedeemPayload(payload) {
  try {
    let raw = String(payload || "").replace(/-/g, "+").replace(/_/g, "/");
    while (raw.length % 4) raw += "=";
    return decodeURIComponent(escape(atob(raw)));
  } catch (error) { return ""; }
}
function redeemBase36Safe(value, width) {
  const encoded = Math.max(0, Math.trunc(Number(value) || 0)).toString(36).toUpperCase();
  return encoded.padStart(width, "0").slice(-width);
}
function buildRedeemUniversalCode(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return "";
  const batch = String(spec.batch || "").trim();
  const expireDay = Number(spec.expireDay || 0);
  const validated = validateUniversalRedeemRewards(spec.rewards);
  if (!/^[0-9A-Za-z._:-]{1,64}$/.test(batch) || !Number.isSafeInteger(expireDay) || expireDay < 0 || !validated.ok) return "";
  const canonical = JSON.stringify({ version: 5, batch, expireDay, rewards: validated.rewards });
  const payload = encodeRedeemPayload(canonical);
  if (!payload || payload.length > 16000) return "";
  const signature = redeemBase36Safe(redeemHash(`5.${payload}`), 8);
  return `NMG5.${payload}.${signature}`;
}
function parseRedeemCode(raw) {
  const universalText = String(raw || "").trim().replace(/\s/g, "");
  const universal = /^NMG5\.([0-9A-Za-z_-]{1,16000})\.([0-9A-Z]{8})$/i.exec(universalText);
  if (universal) {
    const payload = universal[1];
    const signature = universal[2].toUpperCase();
    if (redeemBase36Safe(redeemHash(`5.${payload}`), 8) !== signature) return { ok: false, reason: "sig" };
    const decoded = decodeRedeemPayload(payload);
    let spec = null;
    try { spec = JSON.parse(decoded); } catch (error) { return { ok: false, reason: "format" }; }
    const batch = String(spec?.batch || "").trim();
    const expireDay = Number(spec?.expireDay || 0);
    const validated = validateUniversalRedeemRewards(spec?.rewards);
    if (spec?.version !== 5 || !/^[0-9A-Za-z._:-]{1,64}$/.test(batch)
      || !Number.isSafeInteger(expireDay) || expireDay < 0 || !validated.ok) return { ok: false, reason: "reward" };
    return { ok: true, version: 5, id: `5:${batch}:${signature}`, batch, expireDay, rewards: validated.rewards, scrip: 0, materialCount: 0, daoxing: 0 };
  }
  const text = String(raw || "").trim().toUpperCase().replace(/[\s·。，,]/g, "");
  const gu = /^NMG4-?([0-9A-Z_]+)-?([FLXT][1-9][0-9A-Z]{4})-?([0-9A-Z]{4})$/.exec(text);
  if (gu) {
    const keyToken = gu[1];
    const payload = gu[2];
    if (redeemBase36(redeemHash(`4${keyToken}:${payload}`) % Math.pow(36, 4), 4) !== gu[3]) return { ok: false, reason: "sig" };
    const cardKey = resolveRedeemGuCardKey(keyToken);
    const grade = REDEEM_GU_GRADE_BY_TOKEN[payload.slice(0, 1)] || "";
    const turn = parseInt(payload.slice(1, 2), 36);
    const expireDay = parseInt(payload.slice(2, 4), 36);
    if (!cardKey || !grade || turn < 1 || turn > 9) return { ok: false, reason: "amount" };
    return {
      ok: true, id: `4${keyToken}:${payload}`, scrip: 0, expireDay, materialCount: 0, daoxing: 0,
      gu: { cardKey, grade, turn },
    };
  }
  const dao = /^NMG3-?([0-9A-Z]{9})-?([0-9A-Z]{4})$/.exec(text);
  const bundle = /^NMG2-?([0-9A-Z]{7})-?([0-9A-Z]{4})$/.exec(text);
  const legacy = /^NMG-?([0-9A-Z]{6})-?([0-9A-Z]{4})$/.exec(text);
  const m = dao || bundle || legacy;
  if (!m) return { ok: false, reason: "format" };
  const payload = m[1];
  const version = dao ? "3" : (bundle ? "2" : "");
  if (redeemBase36(redeemHash(`${version}${payload}`) % Math.pow(36, 4), 4) !== m[2]) return { ok: false, reason: "sig" };
  const scrip = parseInt(payload.slice(0, 2), 36);
  const expireDay = parseInt(payload.slice(2, 4), 36);
  const materialCount = (dao || bundle) ? parseInt(payload.slice(4, 5), 36) : 0;
  const daoxing = dao ? parseInt(payload.slice(5, 7), 36) : 0;
  // 三种奖励至少要有一项为正，否则是空码
  if (!(scrip > 0) && !(materialCount > 0) && !(daoxing > 0)) return { ok: false, reason: "amount" };
  return { ok: true, id: `${version}${payload}`, scrip, expireDay, materialCount, daoxing };
}
function findRedeemGuDestination(store) {
  if (!Array.isArray(store.slots)) store.slots = [];
  if (!store.nurture || typeof store.nurture !== "object" || Array.isArray(store.nurture)) store.nurture = {};
  if (typeof normalizeNurtureStore === "function") normalizeNurtureStore(store);
  if (!Array.isArray(store.nurture.slots)) store.nurture.slots = [];
  let mainCap = store.slots.length;
  if (typeof getGuluSlotCap === "function") {
    try { mainCap = Math.min(mainCap, Math.max(0, getGuluSlotCap() | 0)); } catch (error) { /* 独立规则测试无进度模块时用数组长度 */ }
  }
  for (let index = 0; index < mainCap; index += 1) {
    if (!store.slots[index]) return { slots: store.slots, index, location: "gulu" };
  }
  for (let index = 0; index < store.nurture.slots.length; index += 1) {
    if (!store.nurture.slots[index]) return { slots: store.nurture.slots, index, location: "nurture" };
  }
  return null;
}
function createRedeemGuInstance(store, reward) {
  const containers = [store.slots, store.nurture?.slots].filter(Array.isArray);
  const ids = new Set(containers.flatMap((slots) => slots.filter(Boolean).map((slot) => String(slot.id || ""))));
  let serial = Math.max(0, store.serial | 0);
  let id = "";
  do { serial += 1; id = `gu${serial}`; } while (ids.has(id));
  store.serial = serial;
  const gradeName = (typeof getGuluGradeDisplayName === "function" && getGuluGradeDisplayName(reward.grade))
    || ({ fan: "基础·次品", ling: "基础·精品", xuan: "道脉·次品", tian: "道脉·精品" }[reward.grade] || "成蛊");
  const cardName = (typeof CARD_LIBRARY !== "undefined" && CARD_LIBRARY[reward.cardKey]?.name) || reward.cardKey;
  return {
    id, state: "gu", grade: reward.grade, cardKey: reward.cardKey,
    upgradeLevel: reward.turn - 1, name: `${gradeName}·${cardName}`, carry: false,
  };
}
function recordRedeemGuCollection(store, slot, now) {
  if (!store.collection || typeof store.collection !== "object" || Array.isArray(store.collection)) store.collection = {};
  if (!Array.isArray(store.collectionUnread)) store.collectionUnread = [];
  const isNew = !store.collection[slot.cardKey];
  const entry = store.collection[slot.cardKey] || {
    cardKey: slot.cardKey, hatchedCount: 0, fusionCount: 0, giftedCount: 0,
    highestGrade: "fan", fedCount: 0, releasedCount: 0,
    firstRecordedAt: Number(now) || Date.now(),
    firstRecordedVersion: typeof GULU_COLLECTION_BUILD !== "undefined" ? GULU_COLLECTION_BUILD : "redeem",
    legacyBackfill: false,
  };
  entry.giftedCount = Math.max(0, entry.giftedCount | 0) + 1;
  const ranks = { fan: 1, ling: 2, xuan: 3, tian: 4 };
  if ((ranks[slot.grade] || 1) > (ranks[entry.highestGrade] || 1)) entry.highestGrade = slot.grade;
  store.collection[slot.cardKey] = entry;
  if (isNew && !store.collectionUnread.includes(slot.cardKey)) store.collectionUnread.push(slot.cardKey);
}
function normalizeRedeemOwnedAmount(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}
function addRedeemOwnedAmount(current, amount) {
  const before = normalizeRedeemOwnedAmount(current);
  if (!Number.isSafeInteger(amount) || amount < 0 || before > Number.MAX_SAFE_INTEGER - amount) return null;
  return before + amount;
}
function getUniversalRedeemRewardName(reward) {
  if (reward.type === "scrip") return "蛊钱";
  if (reward.type === "guStones") return "蛊石";
  if (reward.type === "lifespan") return "寿元";
  if (reward.type === "material") return (typeof MATERIALS !== "undefined" && MATERIALS[reward.id]?.name) || reward.id;
  if (reward.type === "ecologyMaterial") return (typeof ECOLOGY_MATERIALS !== "undefined" && ECOLOGY_MATERIALS[reward.id]?.name) || reward.id;
  if (reward.type === "forgeSupply") return ({ bossCores: "蛊母残核", guEmbryo: "蛊胎", guWard: "固蛊符", kindleSand: "引火砂" }[reward.id] || reward.id);
  if (reward.type === "daoxing") return `${(typeof BENMING_GU !== "undefined" && BENMING_GU[reward.heroId]?.name) || "本命蛊"}道行`;
  if (reward.type === "gu" || reward.type === "card") return (typeof CARD_LIBRARY !== "undefined" && CARD_LIBRARY[reward.id]?.name) || reward.id;
  if (reward.type === "relic") return (typeof ORDINARY_RELICS !== "undefined" && ORDINARY_RELICS[reward.id]?.name) || reward.id;
  if (reward.type === "satchel") return (typeof BATTLE_ITEMS !== "undefined" && BATTLE_ITEMS[reward.id]?.name) || reward.id;
  return "奖励";
}
function preflightUniversalRedeem(store, parsed, context = {}) {
  let draft;
  try { draft = JSON.parse(JSON.stringify(store && typeof store === "object" ? store : {})); }
  catch (error) { return { ok: false, reason: "save" }; }
  draft.market = draft.market && typeof draft.market === "object" && !Array.isArray(draft.market) ? draft.market : {};
  draft.market.redeemedCodes = Array.isArray(draft.market.redeemedCodes) ? draft.market.redeemedCodes.map(String) : [];
  draft.materials = draft.materials && typeof draft.materials === "object" && !Array.isArray(draft.materials) ? draft.materials : {};
  draft.ecologyMaterials = draft.ecologyMaterials && typeof draft.ecologyMaterials === "object" && !Array.isArray(draft.ecologyMaterials) ? draft.ecologyMaterials : {};
  draft.slots = Array.isArray(draft.slots) ? draft.slots : [];
  draft.nurture = draft.nurture && typeof draft.nurture === "object" && !Array.isArray(draft.nurture) ? draft.nurture : {};
  draft.nurture.slots = Array.isArray(draft.nurture.slots) ? draft.nurture.slots : [];
  draft.collection = draft.collection && typeof draft.collection === "object" && !Array.isArray(draft.collection) ? draft.collection : {};
  draft.collectionUnread = Array.isArray(draft.collectionUnread) ? draft.collectionUnread : [];
  draft.pendingRunRewards = Array.isArray(draft.pendingRunRewards) ? draft.pendingRunRewards.slice() : [];
  const runRewards = [];
  const daoRewards = [];
  const grantedGu = [];
  const rewardLines = [];
  for (const reward of parsed.rewards) {
    rewardLines.push(`${getUniversalRedeemRewardName(reward)} ×${reward.amount}`);
    if (reward.type === "scrip") {
      const total = addRedeemOwnedAmount(draft.market.scrip, reward.amount);
      if (total == null) return { ok: false, reason: "amount" };
      draft.market.scrip = total;
    } else if (reward.type === "material" || reward.type === "ecologyMaterial") {
      const bag = reward.type === "material" ? draft.materials : draft.ecologyMaterials;
      const total = addRedeemOwnedAmount(bag[reward.id], reward.amount);
      if (total == null) return { ok: false, reason: "amount" };
      bag[reward.id] = total;
    } else if (reward.type === "forgeSupply") {
      const total = addRedeemOwnedAmount(draft[reward.id], reward.amount);
      if (total == null) return { ok: false, reason: "amount" };
      draft[reward.id] = total;
    } else if (reward.type === "gu") {
      for (let index = 0; index < reward.amount; index += 1) {
        const destination = findRedeemGuDestination(draft);
        if (!destination) return { ok: false, reason: "space" };
        const slot = createRedeemGuInstance(draft, { cardKey: reward.id, grade: reward.grade, turn: reward.turn });
        destination.slots[destination.index] = slot;
        recordRedeemGuCollection(draft, slot, context.now);
        grantedGu.push({ id: slot.id, cardKey: slot.cardKey, name: slot.name, grade: slot.grade, turn: reward.turn, location: destination.location, index: destination.index });
      }
    } else if (reward.type === "daoxing") {
      daoRewards.push(reward);
    } else {
      runRewards.push({ ...reward });
    }
  }
  const pendingCombined = draft.pendingRunRewards.concat(runRewards);
  const satchelCount = pendingCombined.filter((item) => item.type === "satchel").reduce((sum, item) => sum + item.amount, 0);
  const freshSatchelCap = (typeof PLAYER_BALANCE !== "undefined" && Number(PLAYER_BALANCE?.satchel?.baseCap)) || 3;
  if (satchelCount > freshSatchelCap) return { ok: false, reason: "space" };
  const relicIds = [];
  for (const reward of pendingCombined.filter((item) => item.type === "relic")) {
    if (reward.amount !== 1 || relicIds.includes(reward.id)) return { ok: false, reason: "space" };
    relicIds.push(reward.id);
  }
  if (pendingCombined.length && typeof context.preflightRunRewards === "function") {
    const runCheck = context.preflightRunRewards(pendingCombined);
    if (!runCheck || !runCheck.ok) return { ok: false, reason: runCheck?.reason || "space" };
  }
  draft.pendingRunRewards = pendingCombined;
  draft.market.redeemedCodes.push(parsed.id);
  return { ok: true, draft, daoRewards, runRewards, grantedGu, rewardLines };
}
function applyUniversalRedeem(store, parsed, now, context = {}) {
  const plan = preflightUniversalRedeem(store, parsed, { ...context, now });
  if (!plan.ok) return plan;
  const addDao = typeof context.addDaoxing === "function"
    ? context.addDaoxing
    : (typeof addBenmingDaoxing === "function" ? addBenmingDaoxing : null);
  if (plan.daoRewards.length && !addDao) return { ok: false, reason: "reward" };
  try {
    plan.daoRewards.forEach((reward) => addDao(reward.heroId, reward.amount));
  } catch (error) { return { ok: false, reason: "save" }; }
  Object.keys(store).forEach((key) => { delete store[key]; });
  Object.assign(store, plan.draft);
  if (plan.grantedGu.length && typeof syncOwnedGuluDiscoveries === "function") syncOwnedGuluDiscoveries(store);
  if (typeof guluPushEvent === "function") guluPushEvent(store, `兑换码兑得${plan.rewardLines.join("、")}。`);
  return {
    ok: true,
    version: 5,
    rewardLines: plan.rewardLines,
    gu: plan.grantedGu,
    pendingRunRewardCount: plan.runRewards.reduce((sum, reward) => sum + reward.amount, 0),
    scrip: parsed.rewards.filter((reward) => reward.type === "scrip").reduce((sum, reward) => sum + reward.amount, 0),
    total: store.market.scrip,
  };
}
/* 兑换（纯规则，UI 只呈现 reason 文案）：format/sig=码不对，used=本机已兑过，expired=过期。 */
function redeemCodeApply(store, raw, now, context = {}) {
  const parsed = parseRedeemCode(raw);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const redeemed = Array.isArray(store?.market?.redeemedCodes) ? store.market.redeemedCodes : [];
  if (redeemed.includes(parsed.id)) return { ok: false, reason: "used" };
  if (parsed.expireDay > 0 && Math.floor((now - REDEEM_EPOCH_UTC) / 86400000) > parsed.expireDay) return { ok: false, reason: "expired" };
  if (parsed.version === 5) return applyUniversalRedeem(store, parsed, now, context);
  if (!store.market || typeof store.market !== "object") store.market = {};
  if (!store.materials || typeof store.materials !== "object") store.materials = {};
  if (!Array.isArray(store.market.redeemedCodes)) store.market.redeemedCodes = [];
  if (store.market.redeemedCodes.includes(parsed.id)) return { ok: false, reason: "used" };
  const guDestination = parsed.gu ? findRedeemGuDestination(store) : null;
  if (parsed.gu && !guDestination) return { ok: false, reason: "space" };
  store.market.redeemedCodes.push(parsed.id);
  store.market.scrip = normalizeRedeemOwnedAmount(store.market.scrip) + parsed.scrip;
  if (parsed.materialCount > 0) {
    MATERIAL_IDS.forEach((id) => { store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) + parsed.materialCount; });
  }
  let grantedGu = null;
  if (parsed.gu && guDestination) {
    const slot = createRedeemGuInstance(store, parsed.gu);
    guDestination.slots[guDestination.index] = slot;
    recordRedeemGuCollection(store, slot, now);
    if (typeof syncOwnedGuluDiscoveries === "function") syncOwnedGuluDiscoveries(store);
    grantedGu = {
      id: slot.id, cardKey: slot.cardKey, name: slot.name, grade: slot.grade,
      turn: (slot.upgradeLevel | 0) + 1, location: guDestination.location, index: guDestination.index,
    };
  }
  /* 道行发给当前所选蛊修，与本命道果同一条发放路径。
   * 没选蛊修 / 本命模块不在时，道行部分静默作废但码照样算已兑——
   * 这是刻意的：若在此半途 return，前面的蛊钱与材料已经入库，会变成「兑一半」的坏账。 */
  let daoGranted = 0;
  let daoHeroName = "";
  if (parsed.daoxing > 0) {
    // 注意：可选链挡不住「变量未声明」（那是 ReferenceError），跨模块引用一律先 typeof。
    const heroId = (typeof progression !== "undefined" && progression) ? progression.selectedHeroId : "";
    if (heroId && typeof BENMING_GU !== "undefined" && BENMING_GU[heroId] && typeof addBenmingDaoxing === "function") {
      addBenmingDaoxing(heroId, parsed.daoxing);
      daoGranted = parsed.daoxing;
      daoHeroName = BENMING_GU[heroId].name || "本命蛊";
    }
  }
  const rewardParts = [];
  if (parsed.scrip > 0) rewardParts.push(`蛊钱 ×${parsed.scrip}`);
  if (parsed.materialCount > 0) rewardParts.push(`八种炼蛊材料各 ×${parsed.materialCount}`);
  if (daoGranted > 0) rewardParts.push(`${daoHeroName}道行 +${daoGranted}`);
  if (grantedGu) rewardParts.push(`补发${grantedGu.name}（${grantedGu.turn} 转）`);
  guluPushEvent(store, rewardParts.length ? `兑换码兑得${rewardParts.join("、")}。` : "兑换码已核销。");
  return {
    ok: true, scrip: parsed.scrip, total: store.market.scrip,
    materialCount: parsed.materialCount, daoxing: daoGranted, gu: grantedGu,
  };
}

/* ===== V0.9.54 局外九转鼎：孵化之外给蛊庐第二个存在理由。
 * 规则：消耗同名同转燃料、材料与高转炉料，把目标推高一转，最高九转。
 * 高转炉险只走 guluRandom 局外 RNG，不触碰 runState 或局内种子；失败保留目标并积累下次成功率。
 * 升转只改该蛊的 upgradeLevel，不直接改战斗数值，庐养印记另算。 ===== */
/* V0.9.52 用户定调：合炼开到九转，且九转必须极难。转数 = upgradeLevel + 1，全库单源转名。 */
const GULU_TURN_NAMES = Object.freeze(["一转", "二转", "三转", "四转", "五转", "六转", "七转", "八转", "九转"]);
function guluTurnName(level) { return GULU_TURN_NAMES[Math.max(0, Math.min(GULU_TURN_NAMES.length - 1, level | 0))]; }
const FORGE_MAX_TURN = 8; // upgradeLevel 上限 8 ＝ 九转
/* V0.9.60.1 炉方阶梯：前六转保留同名归一的蛊虫生态，七转后不再要求同名燃料，
 * 让难度转移到材料、蛊母残核、蛊胎与炉险，而不是被十格蛊圃硬卡死。完整递归成本由
 * getForgeJourneyMinimums() 唯一计算，UI 不另写一套总量。 */
const FORGE_RECIPES = Object.freeze({
  1: { fodder: 1, mats: 1, core: 0, embryo: 0, rate: 100, label: "一转 → 二转" },
  2: { fodder: 1, mats: 2, core: 0, embryo: 0, rate: 100, label: "二转 → 三转" },
  3: { fodder: 2, mats: 3, core: 0, embryo: 0, rate: 100, label: "三转 → 四转" },
  4: { fodder: 2, mats: 5, core: 0, embryo: 0, rate: 80, label: "四转 → 五转" },
  /* V0.9.57 通过率上调（旧值 70/60/50/40）。旧曲线四步连乘只有 8.4%，一转到九转 4.9%——
   * 那不是「高风险高回报」，是劝退：玩家备齐 60 个材料 + 5 枚残核 + 2 枚蛊胎，九成概率一无所有。
   * 新值 80/72/64/56 → 裸炼四步 20.6%；每步投一份引火砂 46.4%；备满砂投到封顶仍是 81.5%
   * （FORGE_RATE_CAP 95 不动，「不许出现必成」这条设计保留）。
   * 认真备料的玩家八成能拿下九转，随手一炼的两成——这才是重注该有的样子。 */
  5: { fodder: 1, mats: 12, core: 1, embryo: 1, rate: 80, label: "五转 → 六转" },
  6: { fodder: 0, mats: 32, core: 2, embryo: 1, rate: 72, label: "六转 → 七转" },
  7: { fodder: 0, mats: 44, core: 3, embryo: 2, rate: 64, label: "七转 → 八转" },
  8: { fodder: 0, mats: 60, core: 5, embryo: 2, rate: 56, label: "八转 → 九转" },
});
/* V0.9.60.1 炉险收敛：一至四转升转必成；四转升五转起失败消耗投入但保留目标，并给目标累计保底。
 * 引火砂、温养与失败积累共用 95% 上限。固蛊符不再防删蛊，而是在高转失败时返还残核与蛊胎。 */
const FORGE_KINDLE_BONUS = 15;  // 一份引火砂加多少成功率
const FORGE_RATE_CAP = 95;      // 成功率硬上限：再堆道具也不许出现必成
const FORGE_PITY_STEP = 12;
const FORGE_PITY_CAP = 60;

/* 异蛊合练：两只不同种、同转成蛊按明确配方合为一只既有异变蛊。
 * 键名统一排序，选蛊先后不影响结果；只复用已有战斗逻辑与立绘，不产生“图鉴有名、战斗无物”的空蛊。 */
const GULU_FUSION_RECIPES = Object.freeze({
  "afterEcho+knockArmor": Object.freeze({ left: "afterEcho", right: "knockArmor", result: "resonantCarapace", rationale: "叩甲先裂，余响后发：主动碎甲换来新甲，并把首次受击碎甲炼成反击与续手。" }),
  "apertureGuard+guFeeding": Object.freeze({ left: "apertureGuard", right: "guFeeding", result: "emberRemnant", rationale: "守窍稳壳，饲蛊理牌：抽弃后的余烬凝成护身甲。" }),
  "apertureGuard+yuanReturn": Object.freeze({ left: "apertureGuard", right: "yuanReturn", result: "apertureCurrentGuard", rationale: "守窍结甲，回元引动真元并接续辅助蛊：元流沿甲纹护住空窍。" }),
  "armorBreaker+emberRemnant": Object.freeze({ left: "armorBreaker", right: "emberRemnant", result: "emberArmorPiercer", rationale: "破甲开锋，余烬理牌成甲：敌有护甲时穿势更烈，抽弃后的残烬再护己身。" }),
  "armorBreaker+shellRemnant": Object.freeze({ left: "armorBreaker", right: "shellRemnant", result: "woundedArmorFang", rationale: "破甲牙咬住敌甲，残壳记住己伤：一击兼取破甲追加与受伤增甲。" }),
  "armorMeltPoison+poisonReturn": Object.freeze({ left: "armorMeltPoison", right: "poisonReturn", result: "venomArmorEcho", rationale: "蚀甲先剥敌甲并铺毒，返毒循八层毒势追击：甲蚀之后，毒伤立刻回响。" }),
  "bloodBlade+moonBlade": Object.freeze({ left: "moonBlade", right: "bloodBlade", result: "bloodMoon", rationale: "月刃入煞，血刃付命：炼成借血煞爆发的血月。" }),
  "bloodBlade+redTideGu": Object.freeze({ left: "bloodBlade", right: "redTideGu", result: "redTideBladeLeech", rationale: "血刃以后置生煞承接赤汐耗去的旧煞：旧潮先斩，新血只为下一式蓄势。" }),
  "bloodBlade+swarmBite": Object.freeze({ left: "bloodBlade", right: "swarmBite", result: "bloodSwarmBlade", rationale: "血刃付命生煞，群蛊循前牌追噬：每一道先势都催动血群加深刃伤。" }),
  "bloodMarshGu+bloodSacrifice": Object.freeze({ left: "bloodMarshGu", right: "bloodSacrifice", result: "sacrificialMarshRobe", rationale: "血沼先吞旧煞逐层成甲、满耗续手，血祭随后舍命补煞：新生血煞不能冒充旧煞。" }),
  "bloodReversal+bloodTide": Object.freeze({ left: "bloodReversal", right: "bloodTide", result: "bloodMoon", rationale: "逆血付命，血潮乘煞：血月把代价与血煞倍率合为爆发。" }),
  "bloodRobe+borrowLife": Object.freeze({ left: "bloodRobe", right: "borrowLife", result: "borrowedBloodRobe", rationale: "血衣以伤结甲生煞，借命再从伤口换出真元与续手：一袭血衣兼收两道代价。" }),
  "bloodRobe+meridianShift": Object.freeze({ left: "bloodRobe", right: "meridianShift", result: "meridianBloodRobe", rationale: "血衣裹住伤口，移窍牵动蛊脉：失血同时结甲、生煞并引来新牌。" }),
  "bloodThirst+heartEater": Object.freeze({ left: "bloodThirst", right: "heartEater", result: "heartLeech", rationale: "嗜血随血煞加伤取生，噬心在两层血煞后骤发：血越盛，噬心与回命越紧相随。" }),
  "bloodTide+returnLife": Object.freeze({ left: "bloodTide", right: "returnLife", result: "tideReturningBlood", rationale: "血潮先借全部血煞成势，返命随后吞去三层疗伤：先涌后收，一潮完成伤与愈。" }),
  "breathCicada+yuanVessel": Object.freeze({ left: "breathCicada", right: "yuanVessel", result: "vesselBreathCicada", rationale: "吐纳蝉分初息与续息，承元蛊稳纳真元成甲：玉蝉每催必承元护身，后手续牌。" }),
  "boneBell+breakJoint": Object.freeze({ left: "boneBell", right: "breakJoint", result: "chimingJointBreaker", rationale: "骨铃碎甲作响，断节循声落下：碎去多少旧甲，便添多少杀势，再结新甲压敌。" }),
  "boneCourt+thunderGuide": Object.freeze({ left: "boneCourt", right: "thunderGuide", result: "thunderBoneCourt", rationale: "骨庭借骨鸣层甲，引雷承前牌追击：雷骨同庭，攻守都随既有积势增长。" }),
  "boneMolt+chiBreath": Object.freeze({ left: "boneMolt", right: "chiBreath", result: "dragonMoltBreath", rationale: "蜕骨耗鳞引牌成甲，螭息在龙形中爆发：蜕鳞之后，龙息紧随而出。" }),
  "boneMolt+scaleHiding": Object.freeze({ left: "boneMolt", right: "scaleHiding", result: "circulatingScaleMolt", rationale: "蜕骨耗鳞换牌甲，藏鳞又从蜕壳中回生一鳞：龙鳞在耗与养间循环。" }),
  "burnLife+witheredBloom": Object.freeze({ left: "burnLife", right: "witheredBloom", result: "pyreBloom", rationale: "焚寿随本场烧去的岁月加伤，枯荣以寿换生：同一簇寿火既伤敌也回护血肉。" }),
  "burnLife+lifePyreScorpion": Object.freeze({ left: "burnLife", right: "lifePyreScorpion", result: "lifePyreSandScorpion", rationale: "焚寿记住本场真焰，燃命只认本次实价：砂蝎以两道真实寿火叠成一钩。" }),
  "burningEssence+soulCrack": Object.freeze({ left: "burningEssence", right: "soulCrack", result: "essenceSoulRend", rationale: "燃元以失血换真元与续手，裂魂以寿元换重击：血、寿、元三道代价在一击中并行。" }),
  "calamityAshGu+longBreathGu": Object.freeze({ left: "calamityAshGu", right: "longBreathGu", result: "ashBreathMayfly", rationale: "长息吐旧念，劫灰收离场：蜉蝣以一次长息布下有限灰劫，回合末才归火。" }),
  "chainThunderGu+returnBreath": Object.freeze({ left: "chainThunderGu", right: "returnBreath", result: "returnThunderDragonfly", rationale: "回息整理蛊序，连霆奖励换类：玄蜓以一口回息牵出有数雷节。" }),
  "chaosBee+greenMiasma": Object.freeze({ left: "chaosBee", right: "greenMiasma", result: "rotMiasma", rationale: "乱蜂逐毒，青瘴叠毒：腐瘴令中毒目标再受蚀毒。" }),
  "cloudHorn+reverseScale": Object.freeze({ left: "cloudHorn", right: "reverseScale", result: "stormReverseHorn", rationale: "逆鳞以伤换鳞与杀势，行云角在龙形中续时：未化形养鳞，已化形续云。" }),
  "coiledShell+hollowNeedle": Object.freeze({ left: "coiledShell", right: "hollowNeedle", result: "coiledNeedleShell", rationale: "空窍针只争首发，盘蜕蛊专守收势：针蜕一体，先机刺敌、残局盘甲。" }),
  "erodeAge+prolongLife": Object.freeze({ left: "erodeAge", right: "prolongLife", result: "aeonLeech", rationale: "蚀岁从敌身夺回年华，续命把散岁纳入己身：伤敌之际直接续回寿元。" }),
  "essenceGathering+mysticCarapace": Object.freeze({ left: "essenceGathering", right: "mysticCarapace", result: "mysticEssenceCarapace", rationale: "聚元纳气续手，玄甲承元护身：真元、抽牌与厚甲在同一甲壳中流转。" }),
  "fateThread+lifeFlame": Object.freeze({ left: "fateThread", right: "lifeFlame", result: "fateSever", rationale: "命线借势，寿火付寿：断命以寿元换命势、抽牌与真元。" }),
  "fixedFate+moonBlade": Object.freeze({ left: "fixedFate", right: "moonBlade", result: "fatedMoonGuard", rationale: "月刃先斩，定数随后结甲；若上一式并非护甲，命序便再添一层月护。" }),
  "focalLife+heartEater": Object.freeze({ left: "focalLife", right: "heartEater", result: "lastLightHeart", rationale: "回光焚寿令本回合攻势翻倍，噬心借两层血煞催发：寿火照心，第一击便承受回光。" }),
  "greenMiasma+insectSwarm": Object.freeze({ left: "greenMiasma", right: "insectSwarm", result: "rotMiasma", rationale: "虫群裹瘴：保留虫群追击，以腐瘴强化持续毒性。" }),
  "greenMiasma+shadowBind": Object.freeze({ left: "greenMiasma", right: "shadowBind", result: "miasmaShadowCarapace", rationale: "青瘴铺毒，缚影攻守同出：瘴气缠成影甲，一式同时伤敌、护身与施毒。" }),
  "hiddenMeridian+thunderGuide": Object.freeze({ left: "hiddenMeridian", right: "thunderGuide", result: "hiddenThunderMeridian", rationale: "伏脉留甲至后，引雷承前牌追击：雷势入脉，当前与下回合皆有护持。" }),
  "ironSkin+moltingShell": Object.freeze({ left: "ironSkin", right: "moltingShell", result: "venomMoltCarapace", rationale: "铁皮固甲，蜕壳只在既存毒势中引牌：毒蜕铁甲守住中毒触发条件。" }),
  "ironSkin+mulberryField": Object.freeze({ left: "ironSkin", right: "mulberryField", result: "boneBell", rationale: "铁皮固守，桑田催老：骨铃以护甲镇身并使敌衰老。" }),
  "jadeFang+mirrorCarapace": Object.freeze({ left: "jadeFang", right: "mirrorCarapace", result: "jadeMirrorFang", rationale: "玉牙借己甲催锋，镜壳照敌甲增护：獠甲同时辨认敌我甲势，攻守各取其强。" }),
  "lifeLamp+wineWorm": Object.freeze({ left: "wineWorm", right: "lifeLamp", result: "drunkFateWorm", rationale: "酒虫催攻，命灯聚势：醉命虫在命势中倍攻续手。" }),
  "mulberryField+vicissitudeTurtle": Object.freeze({ left: "mulberryField", right: "vicissitudeTurtle", result: "witheredMulberryTurtle", rationale: "桑田催岁，沧龟驮痕：枯桑只在五道岁纹内压敌结甲，尸傀无岁则不强催。" }),
  "returnBreath+reversePath": Object.freeze({ left: "returnBreath", right: "reversePath", result: "fateSever", rationale: "回息续手，逆途聚势：断命把命势与抽牌炼成一体。" }),
  "rustMite+silenceMoth": Object.freeze({ left: "rustMite", right: "silenceMoth", result: "rustSilenceMoth", rationale: "锈螨蚀开甲缝布毒，息蛾吞声衰势回护：锈尘与寂粉相合，甲、毒、衰老同时受制。" }),
});
/* 新生态蛊先完成基础投放、克制闭环与真实强度验证，再进入异蛊合练。
 * 这里集中登记暂缓原因，避免覆盖审计被静默跳过，也避免为过门禁仓促复用旧产物。 */
const GULU_FUSION_DEFERRED = Object.freeze({});
function guluFusionKey(firstKey, secondKey) {
  return [String(firstKey || ""), String(secondKey || "")].sort().join("+");
}
function getGuluFusionRecipe(firstKey, secondKey) {
  return GULU_FUSION_RECIPES[guluFusionKey(firstKey, secondKey)] || null;
}
function getGuluFusionPartners(cardKey) {
  const key = String(cardKey || "");
  if (!key) return [];
  return [...new Set(Object.values(GULU_FUSION_RECIPES).flatMap((recipe) => {
    if (recipe.left === key) return [recipe.right];
    if (recipe.right === key) return [recipe.left];
    return [];
  }))].sort();
}
function getGuluFusionMaterialCost(level) {
  return 8 + Math.max(0, Math.min(FORGE_MAX_TURN, level | 0)) * 4;
}
function planGuluFusion({ first, second, materialTotal = 0 } = {}) {
  if (!first || !second || first.state !== "gu" || second.state !== "gu") return { ok: false, reason: "请选择两只成蛊。" };
  if (!first.id || first.id === second.id) return { ok: false, reason: "合练需要两只不同的蛊。" };
  if (first.carry || second.carry) return { ok: false, reason: "随行中的蛊不能合练，先取消随行。" };
  if (first.cardKey === second.cardKey) return { ok: false, reason: "同名蛊请走升转炉方；异蛊合练需要两个不同蛊种。" };
  if ((first.upgradeLevel | 0) !== (second.upgradeLevel | 0)) return { ok: false, reason: "两只蛊必须同转，不能以低转蛊替代高转投入。" };
  const recipe = getGuluFusionRecipe(first.cardKey, second.cardKey);
  if (!recipe) return { ok: false, reason: "这组蛊性尚无可用合练方。" };
  const level = first.upgradeLevel | 0;
  const materialCost = getGuluFusionMaterialCost(level);
  if ((materialTotal | 0) < materialCost) return { ok: false, reason: `材料不足：需 ${materialCost} 份，现有 ${Math.max(0, materialTotal | 0)} 份。`, materialCost };
  const firstRank = GULU_GRADES[first.grade]?.rank || 1;
  const secondRank = GULU_GRADES[second.grade]?.rank || 1;
  return {
    ok: true,
    recipe,
    materialCost,
    resultCardKey: recipe.result,
    resultLevel: level,
    resultGrade: secondRank > firstRank ? second.grade : first.grade,
  };
}
const GULU_FUSION_VALUE_LABELS = Object.freeze({
  damage: "伤害", armor: "防御", draw: "抽牌", discard: "弃牌", energy: "真元",
  poison: "毒性", selfDamage: "自身失血", heal: "生命恢复", minHeal: "最低恢复",
  bloodGain: "血煞", bloodMultiplier: "血煞倍率", bloodCap: "血煞消耗上限",
  perBloodArmor: "每层血煞防御", fateGain: "命势", lifespanCost: "寿元代价",
  lifeGain: "寿元夺回", lifeHeal: "寿元恢复", costReduction: "消耗降低",
  armorRemove: "削去防御", weaken: "衰老", shatter: "碎甲", nextTurnArmor: "下回合防御",
  scaleGain: "龙鳞", scaleCost: "龙鳞消耗", transformedBonus: "龙化增伤",
  extendTurns: "龙化延长", perBoneArmor: "每层骨鸣防御", supportDraw: "辅助蛊抽牌",
  armorBonus: "破甲加伤", hurtArmor: "受伤加甲", comboDamage: "连携伤害",
  enemyBreakDamage: "碎甲反击", enemyBreakDraw: "碎甲抽牌",
  bloodCost: "血煞消耗", perPlayed: "此前每张追加", empoweredDamage: "条件伤害",
  attackMultiplier: "攻击倍率",
  poisonBonus: "毒势加伤", poisonThreshold: "毒性阈值", perBurn: "每点焚寿加伤",
  ashDamage: "每灰伤害", ashCap: "劫灰上限", fullArmor: "满灰防御",
  sequenceDamage: "雷序伤害", sequenceCap: "雷序次数", perBlood: "每层耗煞伤害",
  ecologyBonus: "生态相克伤害", perActualBurn: "每点实焚伤害", perBattleBurn: "每点本场焚寿伤害",
  weakenCap: "衰老上限", perWeakenArmor: "每层衰老防御", armorScaleCap: "计甲衰老上限",
  ecologyArmorRemove: "生态蚀甲",
});
function buildGuluFusionSnapshot(first, second, store) {
  return {
    storeRef: store,
    firstRef: first,
    secondRef: second,
    firstId: String(first?.id || ""),
    secondId: String(second?.id || ""),
    firstCardKey: String(first?.cardKey || ""),
    secondCardKey: String(second?.cardKey || ""),
    firstLevel: first?.upgradeLevel | 0,
    secondLevel: second?.upgradeLevel | 0,
    firstGrade: String(first?.grade || ""),
    secondGrade: String(second?.grade || ""),
    firstCarry: Boolean(first?.carry),
    secondCarry: Boolean(second?.carry),
    materialSignature: MATERIAL_IDS.map((id) => `${id}:${Math.max(0, store?.materials?.[id] | 0)}`).join("|"),
  };
}
function isGuluFusionSnapshotCurrent(snapshot, first, second, store) {
  if (!snapshot || snapshot.storeRef !== store || snapshot.firstRef !== first || snapshot.secondRef !== second) return false;
  const current = buildGuluFusionSnapshot(first, second, store);
  return ["firstId", "secondId", "firstCardKey", "secondCardKey", "firstLevel", "secondLevel",
    "firstGrade", "secondGrade", "firstCarry", "secondCarry", "materialSignature"]
    .every((field) => current[field] === snapshot[field]);
}
function buildGuluFusionPreview(first, second, store) {
  const materialTotal = guluMatTotal(store);
  const plan = planGuluFusion({ first, second, materialTotal });
  const slotIds = [String(first?.id || ""), String(second?.id || "")];
  if (!plan.ok) return { ...plan, slotIds, text: plan.reason };
  const resultSlot = {
    ...first,
    state: "gu",
    cardKey: plan.resultCardKey,
    grade: plan.resultGrade,
    upgradeLevel: plan.resultLevel,
    carry: false,
    nurture: 0,
    forgePity: 0,
    guluNurture: typeof getGuluNurtureBonus === "function" ? getGuluNurtureBonus(plan.resultGrade) : 0,
    guluRank: typeof getGuluRank === "function" ? getGuluRank(plan.resultLevel)?.name || "" : "",
    fusedFrom: [first.cardKey, second.cardKey],
  };
  const firstDetail = buildGuluDetailModel(first);
  const secondDetail = buildGuluDetailModel(second);
  const resultDetail = buildGuluDetailModel(resultSlot);
  if (!firstDetail || !secondDetail || !resultDetail) return { ok: false, slotIds, text: "合练效果暂不可预览，请重新打开合蛊坛。" };
  const allFields = new Set([
    ...Object.keys(firstDetail.currentValues || {}),
    ...Object.keys(secondDetail.currentValues || {}),
    ...Object.keys(resultDetail.currentValues || {}),
  ]);
  const changedFields = [...allFields].map((field) => {
    const firstValue = Number.isFinite(firstDetail.currentValues?.[field]) ? firstDetail.currentValues[field] : null;
    const secondValue = Number.isFinite(secondDetail.currentValues?.[field]) ? secondDetail.currentValues[field] : null;
    const resultValue = Number.isFinite(resultDetail.currentValues?.[field]) ? resultDetail.currentValues[field] : null;
    return {
      field,
      label: GULU_FUSION_VALUE_LABELS[field] || "效果值",
      first: firstValue,
      second: secondValue,
      result: resultValue,
    };
  }).filter(({ first: firstValue, second: secondValue, result: resultValue }) =>
    [firstValue, secondValue, resultValue].some((value) => value !== null)
      && (firstValue !== resultValue || secondValue !== resultValue));
  return {
    ...plan,
    plan,
    kind: "fusion",
    slotIds,
    rationale: plan.recipe.rationale,
    firstDetail,
    secondDetail,
    resultDetail,
    resultSlot,
    changedFields,
    snapshot: buildGuluFusionSnapshot(first, second, store),
  };
}
function getForgeSuccessRate(level, kindle = 0, nurtureBonus = 0, pityBonus = 0, qualityBonus = 0) {
  if ((level | 0) < 3) return 100;
  const base = getForgeRecipe(level)?.rate;
  if (!Number.isFinite(base)) return 0;
  return Math.max(5, Math.min(FORGE_RATE_CAP,
    base + Math.max(0, kindle | 0) * FORGE_KINDLE_BONUS
      + Math.max(0, nurtureBonus | 0) + Math.max(0, pityBonus | 0) + Math.max(0, qualityBonus | 0)));
}
function getForgeRecipe(level) { return FORGE_RECIPES[Math.max(0, Number(level) || 0) + 1] || null; }
function getForgeJourneyMinimums(startLevel) {
  let totalEquivalentGu = 1;
  let materials = 0;
  let cores = 0;
  let embryos = 0;
  let peakSlots = 1;
  for (let level = Math.max(0, startLevel | 0); level < FORGE_MAX_TURN; level += 1) {
    const recipe = getForgeRecipe(level);
    const branches = (recipe.fodder | 0) + 1;
    totalEquivalentGu *= branches;
    materials = materials * branches + (recipe.mats | 0);
    cores = cores * branches + (recipe.core | 0);
    embryos = embryos * branches + (recipe.embryo | 0);
    peakSlots += recipe.fodder | 0;
  }
  return {
    totalEquivalentGu,
    additionalEquivalentGu: totalEquivalentGu - 1,
    materials,
    cores,
    embryos,
    peakSlots,
  };
}
function planForgeFailure({ currentPity = 0, hasWard = false, core = 0, embryo = 0 } = {}) {
  return {
    targetLost: false,
    targetFalls: false,
    nextPity: Math.min(FORGE_PITY_CAP, Math.max(0, currentPity | 0) + FORGE_PITY_STEP),
    refundCore: hasWard ? Math.max(0, core | 0) : 0,
    refundEmbryo: hasWard ? Math.max(0, embryo | 0) : 0,
    wardConsumed: Boolean(hasWard),
  };
}
/* 找可作燃料的同名同转成蛊（排除目标自身与已随行的蛊——随行蛊不该被误吃）。 */
function findForgeFodder(store, target) {
  if (!store || !target) return [];
  const cap = getGuluSlotCap();
  return (store.slots || []).filter((g, i) => i < cap && g && g.id !== target.id
    && g.state === "gu" && !g.carry && !isGuluSourceLocked(g.id)
    && g.cardKey === target.cardKey
    && (g.upgradeLevel | 0) === (target.upgradeLevel | 0));
}
/* 可否升转：未达上限、燃料够、材料够、（六转起）残核够。返回 {ok, reason, recipe, fodder} 供 UI 直接用。 */
function canForgeUp(store, target) {
  if (!store || !target || target.state !== "gu") return { ok: false, reason: "只有成蛊可入炉。" };
  const lockText = getGuluSourceLockText(target.id);
  if (lockText) return { ok: false, blocked: true, reason: lockText };
  if (target.carry) return { ok: false, blocked: true, reason: "随行中的蛊不能入炉，先取消随行。" };
  const level = target.upgradeLevel | 0;
  if (level >= FORGE_MAX_TURN) return { ok: false, reason: "已至九转，蛊道尽头。" };
  const recipe = getForgeRecipe(level);
  if (!recipe) return { ok: false, reason: "无对应炉方。" };
  const fodder = findForgeFodder(store, target);
  if (fodder.length < recipe.fodder) {
    const hasLockedFodder = (store.slots || []).some((g, i) => i < getGuluSlotCap() && g && g.id !== target.id
      && g.state === "gu" && !g.carry && isGuluSourceLocked(g.id)
      && g.cardKey === target.cardKey && (g.upgradeLevel | 0) === level);
    if (hasLockedFodder) return { ok: false, blocked: true, reason: "此蛊正在塔中随行", recipe, fodder };
    return { ok: false, reason: `需另备 ${recipe.fodder} 只同名同转的蛊（现有 ${fodder.length} 只；随行中的不计）。`, recipe, fodder };
  }
  const total = MATERIAL_IDS.reduce((sum, id) => sum + normalizeRedeemOwnedAmount(store.materials[id]), 0);
  if (total < recipe.mats) return { ok: false, reason: `材料不足：需 ${recipe.mats} 份，现有 ${total} 份。`, recipe, fodder };
  if ((recipe.core | 0) > 0 && (store.bossCores | 0) < recipe.core) {
    return { ok: false, reason: `缺蛊母残核：需 ${recipe.core} 枚（Boss 战利，须活着带出塔）。`, recipe, fodder };
  }
  if ((recipe.embryo | 0) > 0 && (store.guEmbryo | 0) < recipe.embryo) {
    return { ok: false, reason: `缺蛊胎：需 ${recipe.embryo} 枚（百蛊市奇物行限量）。`, recipe, fodder };
  }
  return { ok: true, recipe, fodder };
}
/* 执行升转：先扣料，再掷一次成败。
 * 成：目标 +1 转并清空失败积累。败：燃料与材料照样没了，目标保留原转数并累积下次成功率。
 * 备有固蛊符时失败自动消耗一张，并返还本炉残核与蛊胎。
 * 只掷一次 guluRandom（局外 RNG），不触碰 runState 与局内种子。 */
function forgeUp(store, target, opts = {}) {
  const check = canForgeUp(store, target);
  if (!check.ok) return { ok: false, text: check.reason };
  const { recipe, fodder } = check;
  const name = target.customName || target.name || CARD_LIBRARY[target.cardKey]?.name || "成蛊";
  const fromTurn = guluTurnName(target.upgradeLevel);
  // 引火砂：玩家在确认弹窗里选投几份，投多少扣多少（成功与否都消耗——那是投进炉里的东西）
  const risky = (target.upgradeLevel | 0) >= 3;
  const kindle = risky ? Math.max(0, Math.min(store.kindleSand | 0, opts.kindle | 0)) : 0;
  const nurtureBonus = getNurtureForgeBonus(target);
  const pityBonus = risky ? Math.max(0, Math.min(FORGE_PITY_CAP, target.forgePity | 0)) : 0;
  const qualityBonus = risky ? getGuluQualityForgeBonus(target) : 0;
  const rate = getForgeSuccessRate(target.upgradeLevel, kindle, nurtureBonus, pityBonus, qualityBonus);
  /* 这份快照与资产扣除属于同一次结算。后续大仪式只读它，绝不再查库存、掷骰或写存档。 */
  const settlementBase = {
    guName: name,
    fromLevel: target.upgradeLevel | 0,
    fromTurn,
    consumed: {
      fodder: recipe.fodder | 0,
      materials: recipe.mats | 0,
      core: recipe.core | 0,
      embryo: recipe.embryo | 0,
      kindle,
      ward: 0,
    },
    refunded: { core: 0, embryo: 0 },
    pityBefore: pityBonus,
    pityAfter: pityBonus,
  };
  fodder.slice(0, recipe.fodder).forEach((g) => {
    const i = store.slots.findIndex((slot) => slot?.id === g.id);
    if (i >= 0) store.slots[i] = null;
  });
  let need = recipe.mats;
  MATERIAL_IDS.slice().sort((a, b) => normalizeRedeemOwnedAmount(store.materials[b]) - normalizeRedeemOwnedAmount(store.materials[a])).forEach((id) => {
    if (need <= 0) return;
    const take = Math.min(need, normalizeRedeemOwnedAmount(store.materials[id]));
    store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) - take;
    need -= take;
  });
  if ((recipe.core | 0) > 0) store.bossCores = (store.bossCores | 0) - recipe.core; // 六转起收蛊母残核
  if ((recipe.embryo | 0) > 0) store.guEmbryo = (store.guEmbryo | 0) - recipe.embryo; // 六转起收蛊胎
  if (kindle > 0) store.kindleSand = (store.kindleSand | 0) - kindle;
  if ((target.upgradeLevel | 0) < 3 || guluRandom() * 100 < rate) {
    target.upgradeLevel = (target.upgradeLevel | 0) + 1;
    target.forgePity = 0;
    target.nurture = 0;
    const turnName = guluTurnName(target.upgradeLevel);
    guluPushEvent(store, `九转鼎：${name}炼至${turnName}，同名蛊 ${recipe.fodder} 只并入炉中${(recipe.core | 0) > 0 ? `，耗残核 ${recipe.core} 枚` : ""}；新转数温养归零。`);
    return {
      ok: true, forged: true, rate, text: `炉火收势——已炼至${turnName}，新转数温养归零。`, level: target.upgradeLevel,
      settlement: { ...settlementBase, toLevel: target.upgradeLevel, toTurn: turnName, pityAfter: 0 },
    };
  }
  const failure = planForgeFailure({
    currentPity: pityBonus,
    hasWard: (store.guWard | 0) > 0,
    core: recipe.core,
    embryo: recipe.embryo,
  });
  target.forgePity = failure.nextPity;
  if (failure.wardConsumed) {
    store.guWard = (store.guWard | 0) - 1;
    store.bossCores = (store.bossCores | 0) + failure.refundCore;
    store.guEmbryo = (store.guEmbryo | 0) + failure.refundEmbryo;
    guluPushEvent(store, `九转鼎失手：${name}仍在${fromTurn}，固蛊符碎并护回残核 ${failure.refundCore}、蛊胎 ${failure.refundEmbryo}；失败积累 +${FORGE_PITY_STEP}%。`);
    return {
      ok: true, forged: false, preserved: true, warded: true, rate, pity: target.forgePity,
      text: `炉火失衡——目标仍在${fromTurn}；固蛊符护回稀有炉料，下次成功率再 +${target.forgePity}%。`, level: target.upgradeLevel,
      settlement: {
        ...settlementBase,
        toLevel: target.upgradeLevel,
        toTurn: fromTurn,
        consumed: { ...settlementBase.consumed, ward: 1 },
        refunded: { core: failure.refundCore, embryo: failure.refundEmbryo },
        pityAfter: target.forgePity,
      },
    };
  }
  guluPushEvent(store, `九转鼎失手：${name}仍在${fromTurn}，燃料与材料耗尽；失败积累 +${FORGE_PITY_STEP}%。`);
  return {
    ok: true, forged: false, preserved: true, rate, pity: target.forgePity,
    text: `炉火失衡——${name}仍在${fromTurn}，本次投入已耗；下次成功率再 +${target.forgePity}%。`, level: target.upgradeLevel,
    settlement: { ...settlementBase, toLevel: target.upgradeLevel, toTurn: fromTurn, pityAfter: target.forgePity },
  };
}

function consumeGuluMaterials(store, amount) {
  let need = Math.max(0, amount | 0);
  MATERIAL_IDS.slice().sort((a, b) => normalizeRedeemOwnedAmount(store.materials[b]) - normalizeRedeemOwnedAmount(store.materials[a])).forEach((id) => {
    if (need <= 0) return;
    const take = Math.min(need, normalizeRedeemOwnedAmount(store.materials[id]));
    store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) - take;
    need -= take;
  });
  return need === 0;
}

function fuseGuluPair(store, slotIds, expectedSnapshot = null) {
  const ids = Array.isArray(slotIds) ? slotIds.slice(0, 2).map(String) : [];
  const firstIndex = store?.slots?.findIndex((slot) => slot?.id === ids[0]) ?? -1;
  const secondIndex = store?.slots?.findIndex((slot) => slot?.id === ids[1]) ?? -1;
  const first = firstIndex >= 0 ? store.slots[firstIndex] : null;
  const second = secondIndex >= 0 ? store.slots[secondIndex] : null;
  if (expectedSnapshot && !isGuluFusionSnapshotCurrent(expectedSnapshot, first, second, store)) {
    return { ok: false, stale: true, text: "蛊圃状态已改变，请重新确认。" };
  }
  const lockedId = [first, second].find((slot) => isGuluSourceLocked(slot?.id))?.id;
  if (lockedId) return { ok: false, blocked: true, text: getGuluSourceLockText(lockedId) };
  const preview = buildGuluFusionPreview(first, second, store);
  if (!preview.ok) return { ok: false, text: preview.reason || preview.text };
  const plan = preview.plan;
  if (!consumeGuluMaterials(store, plan.materialCost)) return { ok: false, text: "炉材结算失败，请重新打开九转鼎。" };
  const grade = GULU_GRADES[plan.resultGrade] || GULU_GRADES.fan;
  const resultName = CARD_LIBRARY[plan.resultCardKey]?.name || plan.resultCardKey;
  const resultGradeName = typeof getGuluGradeDisplayName === "function"
    ? getGuluGradeDisplayName(plan.resultGrade)
    : `${grade.trackName || "蛊卵"}·${grade.quality || grade.name || "品质不明"}`;
  const result = {
    ...preview.resultSlot,
    name: `${resultGradeName}·${resultName}`,
  };
  store.slots[firstIndex] = result;
  store.slots[secondIndex] = null;
  recordGuluFusion(store, result);
  syncOwnedGuluDiscoveries(store);
  const text = `异蛊合练功成：${CARD_LIBRARY[first.cardKey]?.name || first.cardKey}与${CARD_LIBRARY[second.cardKey]?.name || second.cardKey}归一，炼成${guluTurnName(plan.resultLevel)}「${resultName}」。`;
  guluPushEvent(store, `${text}耗材料 ${plan.materialCost} 份。`);
  return { ok: true, fused: true, forged: true, text, resultCardKey: plan.resultCardKey, resultName, level: plan.resultLevel };
}

// 蛊庐 UI 门控：宿主广告能力可用时才显示；网页/无 tap 恒 false，局外入口静默隐藏。
function guluRewardedAdReady() {
  return typeof NmgAds !== "undefined" && NmgAds.isRewardedAvailable() && NmgAds.isSessionEligible();
}
function renderGuluRewardedAdNotice() {
  return guluRewardedAdReady() ? '<p class="gulu-rewarded-note">主动观看，完整看完才发放。</p>' : "";
}
function getBaigushiDailyStock(store, dateKey = guluTodayKey()) {
  if (!store.market || typeof store.market !== "object") store.market = {};
  const key = String(dateKey || guluTodayKey());
  if (store.market.dailyStockDate !== key) {
    store.market.dailyStockDate = key;
    store.market.dailyStock = Object.fromEntries(MATERIAL_IDS.map((id) => [id, BAIGUSHI_DAILY_STOCK]));
  } else {
    if (!store.market.dailyStock || typeof store.market.dailyStock !== "object") store.market.dailyStock = {};
    MATERIAL_IDS.forEach((id) => {
      const current = Number(store.market.dailyStock[id]);
      store.market.dailyStock[id] = Number.isFinite(current)
        ? Math.min(BAIGUSHI_DAILY_STOCK, Math.max(0, current | 0))
        : BAIGUSHI_DAILY_STOCK;
    });
  }
  return store.market.dailyStock;
}
function getBaigushiFeaturedPool() {
  const exclusive = typeof HERO_EXCLUSIVE_CARD_KEYS === "object"
    ? new Set(Object.values(HERO_EXCLUSIVE_CARD_KEYS).flat())
    : new Set();
  return STANDARD_REWARD_CARD_KEYS.filter((key) => CARD_LIBRARY[key] && !exclusive.has(key));
}
function getBaigushiFeaturedCardKey(dateKey) {
  const pool = getBaigushiFeaturedPool();
  if (!pool.length) return "";
  const hash = String(dateKey || "").split("").reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 17);
  return pool[hash % pool.length];
}
function getBaigushiDailyGoods(store, dateKey = guluTodayKey()) {
  if (!store.market || typeof store.market !== "object") store.market = {};
  const key = String(dateKey || guluTodayKey());
  if (store.market.dailyGoodsDate !== key) {
    store.market.dailyGoodsDate = key;
    store.market.dailyGoods = {
      featuredCardKey: getBaigushiFeaturedCardKey(key),
      stock: Object.fromEntries(Object.entries(BAIGUSHI_MISC_GOODS).map(([id, good]) => [id, good.dailyStock])),
    };
  } else {
    const daily = store.market.dailyGoods && typeof store.market.dailyGoods === "object" ? store.market.dailyGoods : {};
    daily.featuredCardKey = CARD_LIBRARY[daily.featuredCardKey] && getBaigushiFeaturedPool().includes(daily.featuredCardKey)
      ? daily.featuredCardKey
      : getBaigushiFeaturedCardKey(key);
    daily.stock = daily.stock && typeof daily.stock === "object" ? daily.stock : {};
    Object.entries(BAIGUSHI_MISC_GOODS).forEach(([id, good]) => {
      const current = Number(daily.stock[id]);
      daily.stock[id] = Number.isFinite(current)
        ? Math.min(good.dailyStock, Math.max(0, current | 0))
        : good.dailyStock;
    });
    store.market.dailyGoods = daily;
  }
  return store.market.dailyGoods;
}

function getBaigushiEcologyDaily(store, dateKey = guluTodayKey()) {
  const key = String(dateKey || guluTodayKey());
  const hash = key.split("").reduce((sum, char) => ((sum * 33) + char.charCodeAt(0)) >>> 0, 29);
  if (store.market.ecologyDate !== key) {
    const rotated = ECOLOGY_MATERIAL_IDS.map((_, index) => ECOLOGY_MATERIAL_IDS[(hash + index) % ECOLOGY_MATERIAL_IDS.length]);
    store.market.ecologyDate = key;
    store.market.ecologyDaily = { ids: rotated.slice(0, 2), stock: Object.fromEntries(rotated.slice(0, 2).map((id) => [id, ECOLOGY_MARKET_GOOD.dailyStock])) };
  }
  return store.market.ecologyDaily;
}

function buyBaigushiEcologyMaterial(materialId, dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const daily = getBaigushiEcologyDaily(store, dateKey);
  if (!daily.ids.includes(materialId) || !ECOLOGY_MATERIALS[materialId]) return { ok: false, text: "此异材今日未随行脚商入市。" };
  if ((daily.stock[materialId] | 0) <= 0) return { ok: false, text: `${ECOLOGY_MATERIALS[materialId].name}今日已售罄。` };
  if (normalizeRedeemOwnedAmount(store.market.scrip) < ECOLOGY_MARKET_GOOD.price) return { ok: false, text: `蛊钱不足：需要 ${ECOLOGY_MARKET_GOOD.price} 枚。` };
  store.market.scrip -= ECOLOGY_MARKET_GOOD.price;
  daily.stock[materialId] -= 1;
  store.ecologyMaterials[materialId] += ECOLOGY_MARKET_GOOD.count;
  store.market.purchases += 1;
  saveGuluStore();
  return { ok: true, text: `购得${ECOLOGY_MATERIALS[materialId].name}×${ECOLOGY_MARKET_GOOD.count}，余蛊钱 ${store.market.scrip}。` };
}

function buyBaigushiEcologyRecipe(cardKey) {
  const store = getGuluStore();
  const recipe = ECOLOGY_RECIPE_COSTS[cardKey];
  const slotIndex = store.slots.findIndex((slot, index) => index < getGuluSlotCap() && !slot);
  if (!recipe || !CARD_LIBRARY[cardKey]) return { ok: false, text: "此生态蛊方尚未收录。" };
  if (slotIndex < 0) return { ok: false, text: "蛊圃已满，请先空出一圃。" };
  if (normalizeRedeemOwnedAmount(store.ecologyMaterials[recipe.ecology]) < 2 || normalizeRedeemOwnedAmount(store.materials[recipe.core]) < 4) return { ok: false, text: `需${ECOLOGY_MATERIALS[recipe.ecology].name}×2、${MATERIALS[recipe.core].name}×4。` };
  if (normalizeRedeemOwnedAmount(store.market.scrip) < ECOLOGY_RECIPE_SCRIP_COST) return { ok: false, text: `蛊钱不足：需要 ${ECOLOGY_RECIPE_SCRIP_COST} 枚。` };
  store.ecologyMaterials[recipe.ecology] -= 2;
  store.materials[recipe.core] -= 4;
  store.market.scrip -= ECOLOGY_RECIPE_SCRIP_COST;
  store.serial += 1;
  const now = guluNow();
  store.slots[slotIndex] = { id: `gu${store.serial}`, state: "egg", grade: "ling", fixedCardKey: cardKey, startedAt: now, hatchAt: now + BAIGUSHI_HATCH_MS, carry: false, ecologyRecipe: true };
  store.market.purchases += 1;
  saveGuluStore();
  return { ok: true, cardKey, slotIndex, text: `生态蛊卵已落入第 ${slotIndex + 1} 圃：将育成「基础·精品·${CARD_LIBRARY[cardKey].name}」。` };
}
function canRewardedBaigushiRestock(store, dateKey, dailyGoods, goodId) {
  const key = String(dateKey || "");
  if (!store?.market || store.market.dailyGoodsDate !== key || !BAIGUSHI_MISC_GOODS[goodId]) return false;
  const currentDaily = getBaigushiDailyGoods(store, key);
  return currentDaily === dailyGoods && Math.max(0, Number(dailyGoods.stock?.[goodId]) || 0) === 0;
}
function grantRewardedBaigushiRestock(store, dateKey, dailyGoods, goodId) {
  if (!canRewardedBaigushiRestock(store, dateKey, dailyGoods, goodId)) return { ok: false, gained: 0 };
  const currentDaily = getBaigushiDailyGoods(store, dateKey);
  const current = Math.max(0, Number(currentDaily.stock?.[goodId]) || 0);
  currentDaily.stock[goodId] = current + 1;
  return { ok: true, gained: 1, goodId, name: BAIGUSHI_MISC_GOODS[goodId].name, stock: currentDaily.stock[goodId] };
}
function listRewardedBaigushiRestockGoods(store, dateKey, dailyGoods) {
  const key = String(dateKey || "");
  if (!store?.market || store.market.dailyGoodsDate !== key || getBaigushiDailyGoods(store, key) !== dailyGoods) return [];
  return Object.entries(BAIGUSHI_MISC_GOODS)
    .filter(([id]) => Math.max(0, Number(dailyGoods.stock?.[id]) || 0) === 0)
    .map(([id, good]) => ({ id, name: good.name }));
}
function canBuyBaigushiDailyGood(store, goodId, dateKey) {
  const good = BAIGUSHI_MISC_GOODS[goodId];
  const daily = getBaigushiDailyGoods(store, dateKey);
  if (!good || (daily.stock?.[goodId] | 0) <= 0) return { ok: false, good, daily, text: "此物今日已售罄。" };
  if (normalizeRedeemOwnedAmount(store.market.scrip) < good.price) return { ok: false, good, daily, text: `蛊钱不足：需要 ${good.price} 枚。` };
  return { ok: true, good, daily };
}
function settleBaigushiDailyGood(store, goodId, purchase) {
  purchase.daily.stock[goodId] -= 1;
  store.market.scrip -= purchase.good.price;
  store.market.purchases += 1;
}
function buyBaigushiHealingSalve(dateKey = guluTodayKey(), now = guluNow()) {
  const store = getGuluStore();
  if (!(store.injuryUntil > now)) return { ok: false, text: "本命蛊当前无需静养。" };
  const purchase = canBuyBaigushiDailyGood(store, "healingSalve", dateKey);
  if (!purchase.ok) return purchase;
  store.injuryUntil = 0;
  settleBaigushiDailyGood(store, "healingSalve", purchase);
  guluPushEvent(store, "百蛊市养伤散化去本命蛊反噬，静养状态立即解除。");
  saveGuluStore();
  return { ok: true, text: `养伤散已服，本命蛊可再次蛊斗，余蛊钱 ${store.market.scrip}。` };
}
function buyBaigushiMaterialCrate(dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const purchase = canBuyBaigushiDailyGood(store, "materialCrate", dateKey);
  if (!purchase.ok) return purchase;
  Object.entries(purchase.good.contents).forEach(([id, count]) => {
    store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) + count;
  });
  settleBaigushiDailyGood(store, "materialCrate", purchase);
  guluPushEvent(store, `百蛊市购得炉材匣：${formatBaigushiCost(purchase.good.contents)}。`);
  saveGuluStore();
  return { ok: true, text: `炉材匣已开：${formatBaigushiCost(purchase.good.contents)}，余蛊钱 ${store.market.scrip}。` };
}

function getNextGuluGrade(gradeId) {
  return ({ fan: "ling", xuan: "tian" })[gradeId] || "";
}

function buyBaigushiGradeSeal(eggId, dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const slot = store.slots.find((entry, index) => index < getGuluSlotCap() && entry?.id === eggId && entry.state === "egg");
  const nextGrade = slot ? getNextGuluGrade(slot.grade) : "";
  if (!slot) return { ok: false, text: "没有找到可凝质的蛊卵。" };
  if (!nextGrade) return { ok: false, text: "这枚蛊卵已是精品，无法继续凝质。" };
  const purchase = canBuyBaigushiDailyGood(store, "gradeSeal", dateKey);
  if (!purchase.ok) return purchase;
  const beforeName = GULU_GRADES[slot.grade]?.name || slot.grade;
  slot.grade = nextGrade;
  settleBaigushiDailyGood(store, "gradeSeal", purchase);
  guluPushEvent(store, `凝质符落印：${beforeName}蛊卵升为${GULU_GRADES[nextGrade].name}。`);
  saveGuluStore();
  return { ok: true, eggId, grade: nextGrade, text: `凝质完成：蛊卵已升为${GULU_GRADES[nextGrade].name}，余蛊钱 ${store.market.scrip}。` };
}

function getBaigushiMarrowReplacement(cardKey) {
  const pool = getBaigushiFeaturedPool();
  if (pool.length < 2) return "";
  const currentIndex = pool.indexOf(cardKey);
  return pool[(currentIndex >= 0 ? currentIndex + 1 : 0) % pool.length];
}

function buyBaigushiMarrowJade(guId, dateKey = guluTodayKey(), now = guluNow()) {
  const store = getGuluStore();
  const slot = store.slots.find((entry, index) => index < getGuluSlotCap() && entry?.id === guId && entry.state === "gu");
  if (!slot) return { ok: false, text: "没有找到可换髓的成蛊。" };
  const lockText = getGuluSourceLockText(slot.id);
  if (lockText) return { ok: false, blocked: true, text: lockText };
  const replacement = getBaigushiMarrowReplacement(slot.cardKey);
  if (!replacement || replacement === slot.cardKey) return { ok: false, text: "市册中没有可替换的通用蛊。" };
  const purchase = canBuyBaigushiDailyGood(store, "marrowJade", dateKey);
  if (!purchase.ok) return purchase;
  const oldName = slot.name || CARD_LIBRARY[slot.cardKey]?.name || "旧蛊";
  // 换髓只换蛊种，不降转。必须在删去成蛊字段前把实例的真实转数随卵保存，
  // 否则破壳会回落到品质默认值（玩家实报七转重结成二转）。
  slot.fixedUpgradeLevel = Math.max(0, Math.min(FORGE_MAX_TURN, slot.upgradeLevel | 0));
  slot.state = "egg";
  slot.fixedCardKey = replacement;
  slot.startedAt = now;
  slot.hatchAt = now + BAIGUSHI_HATCH_MS;
  slot.carry = false;
  delete slot.cardKey;
  delete slot.name;
  settleBaigushiDailyGood(store, "marrowJade", purchase);
  guluPushEvent(store, `换髓玉重结「${oldName}」：保留路线与品质，10 分钟后育成${CARD_LIBRARY[replacement]?.name || "另一通用蛊"}。`);
  saveGuluStore();
  return { ok: true, guId, cardKey: replacement, text: `换髓完成：保留路线与品质重新结卵，余蛊钱 ${store.market.scrip}。` };
}

/* V0.9.52 蛊胎：六转以上炉方的硬耗材。限量、贵，且只在奇物行出——刻意让九转是长期目标。
 * V0.9.54 起同一入口兼管引火砂与固蛊符（同为「计数式炉料」，共用一条买入路径免三处写重）。 */
/* V0.9.57：砂囊（kindlePouch）复用同一条耗材管线，只是 count 为 3。
 * 走同一个 buyBaigushiForgeSupply 就不必再写一份扣费/落盘逻辑，也不会漏掉每日库存结算。 */
const FORGE_SUPPLY_FIELDS = Object.freeze({ guEmbryo: "guEmbryo", guWard: "guWard", kindlePouch: "kindleSand" });
const FORGE_SUPPLY_NAMES = Object.freeze({ guEmbryo: "蛊胎", guWard: "固蛊符", kindlePouch: "引火砂" });
function buyBaigushiForgeSupply(goodId, dateKey = guluTodayKey()) {
  const field = FORGE_SUPPLY_FIELDS[goodId];
  if (!field) return { ok: false, text: "市册里没有此物。" };
  const store = getGuluStore();
  const purchase = canBuyBaigushiDailyGood(store, goodId, dateKey);
  if (!purchase.ok) return purchase;
  store[field] = (store[field] | 0) + (purchase.good.count | 0);
  settleBaigushiDailyGood(store, goodId, purchase);
  const name = FORGE_SUPPLY_NAMES[goodId];
  guluPushEvent(store, `奇物行购得${name} ${purchase.good.count} 份，现存 ${store[field]} 份。`);
  saveGuluStore();
  return { ok: true, text: `${name}入库，现存 ${store[field]} 份，余蛊钱 ${store.market.scrip}。` };
}
function buyBaigushiGuEmbryo(dateKey = guluTodayKey()) { return buyBaigushiForgeSupply("guEmbryo", dateKey); }
function buyBaigushiDaoFruit(dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const heroId = progression?.selectedHeroId;
  if (!heroId || !BENMING_GU[heroId]) return { ok: false, text: "请先选择一位蛊修。" };
  const purchase = canBuyBaigushiDailyGood(store, "daoFruit", dateKey);
  if (!purchase.ok) return purchase;
  addBenmingDaoxing(heroId, purchase.good.dao);
  settleBaigushiDailyGood(store, "daoFruit", purchase);
  guluPushEvent(store, `本命道果由${BENMING_GU[heroId].name}吞下：道行 +${purchase.good.dao}。`);
  saveGuluStore();
  return { ok: true, heroId, text: `${BENMING_GU[heroId].name}道行 +${purchase.good.dao}，余蛊钱 ${store.market.scrip}。` };
}

/* ===== 百蛊市批量货品规则层 =====
 * 全部复用 canBuyBaigushiDailyGood / settleBaigushiDailyGood 这对既有闸门：
 * 前者校验蛊钱与当日库存，后者扣费并记账。自己另写扣费＝迟早漏掉某一半。 */

/* 残核匣·三枚装：九转全程要 11 枚残核，旧货架一天只卖一枚。 */
function buyBaigushiCoreCrateTriple(dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const purchase = canBuyBaigushiDailyGood(store, "coreCrateTriple", dateKey);
  if (!purchase.ok) return purchase;
  store.bossCores = (store.bossCores | 0) + purchase.good.count;
  settleBaigushiDailyGood(store, "coreCrateTriple", purchase);
  guluPushEvent(store, `蛊母残核匣（三枚装）开启：蛊母残核×${purchase.good.count}。`);
  saveGuluStore();
  return { ok: true, text: `获得蛊母残核×${purchase.good.count}，现存 ${store.bossCores} 枚，余蛊钱 ${store.market.scrip}。` };
}

/* 砂囊：引火砂 ×3。走 buyBaigushiForgeSupply 单源（kindlePouch 映射到 kindleSand 字段）。 */
function buyBaigushiKindlePouch(dateKey = guluTodayKey()) { return buyBaigushiForgeSupply("kindlePouch", dateKey); }

/* 双生对髓：一次照同一只成蛊结两枚同名三转卵。
 * 旧规则照抄样本转数，高转样本可直接复制高转燃料，数分钟堆出九转；现固定三转作为坊市供给基线。
 * 必须先确认有【两个】空圃，否则结到一半没地方放。 */
function buyBaigushiTwinMarrowPair(guId, dateKey = guluTodayKey(), now = guluNow()) {
  const store = getGuluStore();
  const cap = getGuluSlotCap();
  const source = store.slots.find((entry, index) => index < cap && entry?.id === guId && entry.state === "gu");
  if (!source) return { ok: false, text: "没有找到可取样的成蛊。" };
  const empty = store.slots.reduce((n, slot, index) => n + (index < cap && !slot ? 1 : 0), 0);
  const purchase = canBuyBaigushiDailyGood(store, "twinMarrowPair", dateKey);
  const need = purchase.ok ? (purchase.good.count | 0) : 2;
  if (empty < need) return { ok: false, text: `双生对髓需 ${need} 个空圃，当前只有 ${empty} 个。` };
  if (!purchase.ok) return purchase;
  for (let i = 0; i < need; i += 1) {
    const slotIndex = store.slots.findIndex((slot, index) => index < cap && !slot);
    if (slotIndex < 0) break;
    store.serial += 1;
    store.slots[slotIndex] = {
      id: `gu${store.serial}`, state: "egg", grade: source.grade, heroId: source.heroId || progression?.selectedHeroId || "",
      fixedCardKey: source.cardKey, fixedUpgradeLevel: 2,
      startedAt: now, hatchAt: now + BAIGUSHI_HATCH_MS, carry: false,
    };
  }
  settleBaigushiDailyGood(store, "twinMarrowPair", purchase);
  guluPushEvent(store, `双生对髓照出 ${need} 枚同名三转之卵。`);
  saveGuluStore();
  return { ok: true, text: `双生对髓结出 ${need} 枚卵，余蛊钱 ${store.market.scrip}。` };
}

/* 百草囊：自选一种材料 ×5。孵化按材料【总数】扣，5 份刚好够一次玄品。 */
function buyBaigushiMaterialBundle(materialId, dateKey = guluTodayKey()) {
  const store = getGuluStore();
  if (!MATERIALS[materialId]) return { ok: false, text: "此物不可装入百草囊。" };
  const purchase = canBuyBaigushiDailyGood(store, "materialBundle", dateKey);
  if (!purchase.ok) return purchase;
  store.materials[materialId] = normalizeRedeemOwnedAmount(store.materials[materialId]) + purchase.good.count;
  settleBaigushiDailyGood(store, "materialBundle", purchase);
  guluPushEvent(store, `百草囊解开：${MATERIALS[materialId].name}×${purchase.good.count}。`);
  saveGuluStore();
  return { ok: true, materialId, text: `取出${MATERIALS[materialId].name}×${purchase.good.count}，余蛊钱 ${store.market.scrip}。` };
}

/* 破壳锥：指定蛊卵立即破壳。此前「立即破壳」只有看广告一条路，
 * 不看广告的玩家没有等价选择；这件与广告版并行，互不排斥、各自限次。 */
function buyBaigushiHatchBreaker(eggId, dateKey = guluTodayKey(), now = guluNow()) {
  const store = getGuluStore();
  const slot = store.slots.find((entry, index) => index < getGuluSlotCap() && entry?.id === eggId && entry.state === "egg");
  if (!slot) return { ok: false, text: "没有可破壳的蛊卵。" };
  if ((Number(slot.hatchAt) || 0) <= now) return { ok: false, text: "这枚卵已经可以破壳了。" };
  const purchase = canBuyBaigushiDailyGood(store, "hatchBreaker", dateKey);
  if (!purchase.ok) return purchase;
  slot.hatchAt = now; // 与广告版同一口径：把破壳点拉到当下，由既有孵化流程接手
  settleBaigushiDailyGood(store, "hatchBreaker", purchase);
  guluPushEvent(store, `破壳锥凿开${slot.name || "蛊卵"}的壳，此卵立即可破。`);
  saveGuluStore();
  return { ok: true, text: `破壳锥已用，蛊卵立即破壳，余蛊钱 ${store.market.scrip}。` };
}
function buyBaigushiFeaturedEgg(dateKey = guluTodayKey(), now = guluNow()) {
  const store = getGuluStore();
  const slotIndex = store.slots.findIndex((slot, index) => index < getGuluSlotCap() && !slot);
  if (slotIndex < 0) return { ok: false, text: "蛊圃已满，请先空出一圃。" };
  const purchase = canBuyBaigushiDailyGood(store, "featuredEgg", dateKey);
  if (!purchase.ok) return purchase;
  const cardKey = purchase.daily.featuredCardKey;
  if (!CARD_LIBRARY[cardKey]) return { ok: false, text: "今日轮换蛊卵暂不可用。" };
  store.serial += 1;
  store.slots[slotIndex] = {
    id: `gu${store.serial}`, state: "egg", grade: "ling", fixedCardKey: cardKey,
    startedAt: now, hatchAt: now + BAIGUSHI_HATCH_MS, carry: false, marketFeatured: true,
  };
  settleBaigushiDailyGood(store, "featuredEgg", purchase);
  const cardName = CARD_LIBRARY[cardKey].name || cardKey;
  guluPushEvent(store, `百蛊市轮换落卵：第 ${slotIndex + 1} 圃将育成「基础·精品·${cardName}」。`);
  saveGuluStore();
  return { ok: true, slotIndex, cardKey, text: `轮换蛊卵已落入第 ${slotIndex + 1} 圃：10 分钟后育成「基础·精品·${cardName}」。` };
}
function buyBaigushiMaterial(materialId, dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const price = BAIGUSHI_MATERIAL_PRICES[materialId];
  if (!price || !MATERIALS[materialId]) return { ok: false, text: "此物不在今日市册中。" };
  const stock = getBaigushiDailyStock(store, dateKey);
  if ((stock[materialId] | 0) <= 0) return { ok: false, text: `${MATERIALS[materialId].name}今日已售罄。` };
  if (normalizeRedeemOwnedAmount(store.market.scrip) < price) return { ok: false, text: `蛊钱不足：需要 ${price} 枚。` };
  store.market.scrip -= price;
  stock[materialId] -= 1;
  store.materials[materialId] = normalizeRedeemOwnedAmount(store.materials[materialId]) + 1;
  store.market.purchases += 1;
  guluPushEvent(store, `百蛊市购得${MATERIALS[materialId].name}×1，耗蛊钱 ${price}。`);
  saveGuluStore();
  return { ok: true, materialId, price, text: `购得${MATERIALS[materialId].name}×1，余蛊钱 ${store.market.scrip}。` };
}
function buyBaigushiRecipe(recipeId) {
  const store = getGuluStore();
  const recipe = BAIGUSHI_RECIPES[recipeId];
  if (!recipe) return { ok: false, text: "此育蛊方并不存在。" };
  const slotIndex = store.slots.findIndex((slot, i) => i < getGuluSlotCap() && !slot);
  if (slotIndex < 0) return { ok: false, text: "蛊圃已满，请先空出一圃。" };
  if (!canPayBaigushiMaterials(store, recipe.cost)) return { ok: false, text: `材料不足：需 ${formatBaigushiCost(recipe.cost)}。` };
  if (normalizeRedeemOwnedAmount(store.market.scrip) < BAIGUSHI_RECIPE_SCRIP_COST) return { ok: false, text: `蛊钱不足：定向育蛊另需 ${BAIGUSHI_RECIPE_SCRIP_COST} 枚。` };
  payBaigushiMaterials(store, recipe.cost);
  store.market.scrip -= BAIGUSHI_RECIPE_SCRIP_COST;
  store.serial += 1;
  const now = guluNow();
  store.slots[slotIndex] = {
    id: `gu${store.serial}`, state: "egg", grade: recipe.grade, fixedCardKey: recipe.cardKey,
    startedAt: now, hatchAt: now + BAIGUSHI_HATCH_MS, carry: false, marketRecipe: recipeId,
  };
  store.market.purchases += 1;
  const cardName = CARD_LIBRARY[recipe.cardKey]?.name || recipe.cardKey;
  guluPushEvent(store, `百蛊市定向落卵：第 ${slotIndex + 1} 圃将育成「基础·精品·${cardName}」（10 分钟破壳）。`);
  saveGuluStore();
  return { ok: true, slotIndex, cardKey: recipe.cardKey, text: `已落卵第 ${slotIndex + 1} 圃：10 分钟后必定育成「基础·精品·${cardName}」。` };
}
function buyBaigushiDeathWard() {
  const store = getGuluStore();
  if ((store.market.deathWard | 0) >= BAIGUSHI_WARD_MAX) return { ok: false, text: `护命蛊匣已备妥，库存上限为 ${BAIGUSHI_WARD_MAX}。` };
  if ((store.bossCores | 0) < BAIGUSHI_WARD_COST.bossCores || !canPayBaigushiMaterials(store, BAIGUSHI_WARD_COST.materials)) {
    return { ok: false, text: `所需：${formatBaigushiCost(BAIGUSHI_WARD_COST.materials)}、蛊母残核×${BAIGUSHI_WARD_COST.bossCores}。` };
  }
  if (normalizeRedeemOwnedAmount(store.market.scrip) < BAIGUSHI_WARD_SCRIP_COST) return { ok: false, text: `蛊钱不足：护命蛊匣另需 ${BAIGUSHI_WARD_SCRIP_COST} 枚。` };
  payBaigushiMaterials(store, BAIGUSHI_WARD_COST.materials);
  store.bossCores -= BAIGUSHI_WARD_COST.bossCores;
  store.market.scrip -= BAIGUSHI_WARD_SCRIP_COST;
  store.market.deathWard += 1;
  store.market.purchases += 1;
  guluPushEvent(store, "百蛊市购得护命蛊匣：下次陨落时可自动保全一只道脉随行蛊。");
  saveGuluStore();
  return { ok: true, text: "护命蛊匣已入库：只在陨落且有道脉随行蛊时自动消耗。" };
}
function settleCarriedGuAfterRun(store, carriedGuIds, keepCarriedGu) {
  const ids = Array.isArray(carriedGuIds) ? [...new Set(carriedGuIds.filter((id) => typeof id === "string" && id))] : [];
  const result = { fallen: [], preserved: [], missing: [], wardConsumed: false };
  if (!ids.length) return result;
  const containers = [store.slots, normalizeNurtureStore(store).slots].filter(Array.isArray);
  const locations = ids.map((id) => ({
    id,
    found: containers.flatMap((slots) => slots
      .map((slot, index) => ({ slots, index, slot }))
      .filter(({ slot }) => slot?.id === id)),
  }));
  result.missing = locations.filter(({ found }) => !found.length).map(({ id }) => id);
  if (keepCarriedGu) {
    result.preserved = locations.flatMap(({ found }) => found.map(({ slot }) => getGuluDisplayName(slot)));
    return result;
  }
  const wardLocation = (store.market?.deathWard | 0) > 0
    ? locations.flatMap(({ found }) => found).find(({ slot }) => slot.state === "gu" && isGuluDaoGrade(slot.grade))
    : null;
  if (wardLocation) {
    result.wardConsumed = true;
    result.preserved.push(getGuluDisplayName(wardLocation.slot));
    store.market.deathWard -= 1;
  }
  locations.forEach(({ found }) => {
    found.forEach((location) => {
      if (location === wardLocation) return;
      result.fallen.push(getGuluDisplayName(location.slot));
      location.slots[location.index] = null;
    });
  });
  return result;
}
function guluPushEvent(store, text) {
  store.events.push({ at: guluNow(), text });
  if (store.events.length > 30) store.events.splice(0, store.events.length - 30);
}
function recordGuluHatch(store, slot) {
  if (!slot?.cardKey) return;
  const isNew = !guluCollectionEntry(store, slot.cardKey, false);
  const entry = guluCollectionEntry(store, slot.cardKey, true);
  entry.hatchedCount = Math.max(0, entry.hatchedCount | 0) + 1;
  const oldRank = GULU_GRADES[entry.highestGrade]?.rank || 0;
  if ((GULU_GRADES[slot.grade]?.rank || 1) > oldRank) entry.highestGrade = slot.grade;
  if (isNew && !store.collectionUnread.includes(slot.cardKey)) store.collectionUnread.push(slot.cardKey);
}
function recordGuluFusion(store, slot) {
  if (!slot?.cardKey) return;
  const isNew = !guluCollectionEntry(store, slot.cardKey, false);
  const entry = guluCollectionEntry(store, slot.cardKey, true);
  entry.fusionCount = Math.max(0, entry.fusionCount | 0) + 1;
  const oldRank = GULU_GRADES[entry.highestGrade]?.rank || 0;
  if ((GULU_GRADES[slot.grade]?.rank || 1) > oldRank) entry.highestGrade = slot.grade;
  if (isNew && !store.collectionUnread.includes(slot.cardKey)) store.collectionUnread.push(slot.cardKey);
}
function recordGuluFeed(store, slot) {
  if (!slot?.cardKey) return;
  const entry = guluCollectionEntry(store, slot.cardKey, true);
  entry.fedCount = Math.max(0, entry.fedCount | 0) + 1;
}
function recordGuluRelease(store, slot) {
  if (!slot?.cardKey) return;
  const entry = guluCollectionEntry(store, slot.cardKey, true);
  const oldRank = GULU_GRADES[entry.highestGrade]?.rank || 0;
  if ((GULU_GRADES[slot.grade]?.rank || 1) > oldRank) entry.highestGrade = slot.grade;
  entry.releasedCount = Math.max(0, entry.releasedCount | 0) + 1;
}
function getGuluCollectionCurrentCounts(store, cardKey) {
  const slots = (store.slots || []).filter((slot) => slot && slot.state === "gu" && slot.cardKey === cardKey);
  return { inGulu: slots.length, carried: slots.filter((slot) => slot.carry).length };
}
function getGuluHubNotice() {
  const store = getGuluStore();
  const ready = store.slots.filter((slot) => slot && slot.state === "egg" && guluNow() >= Number(slot.hatchAt || 0)).length;
  const signReady = !getSignState().signedToday;
  const fresh = store.collectionUnread.length;
  const count = ready + (signReady ? 1 : 0) + fresh;
  const label = ready ? `孵化完成 ${ready}` : (signReady ? "可签到" : (fresh ? `新收录 ${fresh}` : ""));
  return { count, ready, signReady, fresh, label };
}
function getGuluCollectionSummary() {
  const entries = Object.values(getGuluStore().collection || {});
  return {
    entries: entries.length,
    hatched: entries.reduce((sum, entry) => sum + Math.max(0, entry.hatchedCount | 0), 0),
    fed: entries.reduce((sum, entry) => sum + Math.max(0, entry.fedCount | 0), 0),
    released: entries.reduce((sum, entry) => sum + Math.max(0, entry.releasedCount | 0), 0),
  };
}
// 本次 settleGuluTime 刚破壳的蛊（slot 对象，破壳顺序）。破壳仪式据此认准"刚出的这只"，而非全圃 hatchAt 最大者。
let guluLastHatched = [];
// 时间结算单一入口：到期蛊卵破壳、静养期满复元。返回本次新发生的事件文案（供「蛊庐动静」汇报）。
/* V0.9.52 破壳蛊池（玩家实锤：「桑田/续命/夺寿/回光 一只都没孵出来过」）。
 * 病根：玄/天品此前只从 ADVANCED_CARD_KEYS 这 9 张里抽，五道专属蛊（寿道桑田/续命/夺寿/回光、
 * 龙裔赤气/蜕骨/行云角…）从来不在任何孵化池里——不是概率低，是数学上不可能。
 * 改法照局内稀有奖励池的语义：稀有档 = 通用稀有 + 落卵时那名蛊修的专属蛊；凡/灵品维持通用池不变，
 * 保住「品阶越高越出好东西」的梯度。 */
function getGuluHatchPool(grade, slot) {
  const fusionResults = new Set(Object.values(GULU_FUSION_RECIPES).map((recipe) => recipe.result));
  const hatchable = (keys) => [...new Set(keys)]
    .filter((key) => CARD_LIBRARY[key] && !fusionResults.has(key));
  if (!grade || !grade.rare) return hatchable(STANDARD_REWARD_CARD_KEYS);
  const heroId = slot?.heroId || progression?.selectedHeroId || "";
  const exclusive = (typeof HERO_EXCLUSIVE_CARD_KEYS === "object" && HERO_EXCLUSIVE_CARD_KEYS[heroId]) || [];
  const pool = hatchable([...ADVANCED_CARD_KEYS, ...exclusive]);
  return pool.length ? pool : hatchable(ADVANCED_CARD_KEYS);
}
function getGuluHatchPoolPreview(heroId) {
  const baseGrade = Object.values(GULU_GRADES).find((grade) => !grade.rare) || GULU_GRADES.fan;
  const daoGrade = Object.values(GULU_GRADES).find((grade) => grade.rare) || GULU_GRADES.xuan;
  const toRows = (pool) => pool.map((cardKey) => {
    const card = CARD_LIBRARY[cardKey];
    if (!card) return null;
    return { cardKey, name: card.name, role: typeof getGuCombatTone === "function" ? getGuCombatTone(card) : "support" };
  }).filter(Boolean);
  return { base: toRows(getGuluHatchPool(baseGrade, { heroId })), dao: toRows(getGuluHatchPool(daoGrade, { heroId })) };
}
function renderGuluHatchPoolPreview(heroId) {
  const preview = getGuluHatchPoolPreview(heroId);
  const labels = { attack: "攻", defense: "守", support: "辅", mutation: "异" };
  const table = (title, hint, rows) => `<section><header><h4>${title}</h4><small>${hint} · 共 ${rows.length} 种</small></header><div class="gulu-pool-preview-table">${rows.map((row) => {
    const art = getGuluCardArt(row.cardKey);
    return `<span class="tone-${row.role}"><span class="gulu-pool-preview-portrait">${art ? `<img src="${escGu(art)}" alt="" loading="lazy" decoding="async">` : `<i>${labels[row.role] || "蛊"}</i>`}</span><b>${escGu(row.name)}</b></span>`;
  }).join("")}</div></section>`;
  return `<div class="gulu-pool-preview-overlay hidden" role="dialog" aria-modal="true" aria-label="虫池预览" data-gulu-pool-preview-overlay="1"><div class="gulu-pool-preview-card"><header><div><small>蛊圃 · 落卵去向</small><h3>两类虫池</h3><p>名单直接取自当前真实孵化规则；品阶只改变起始转数与炉性。</p></div><button type="button" data-gulu-pool-preview-close="1" aria-label="关闭虫池预览">×</button></header><div class="gulu-pool-preview-scroll">${table("基础虫池", "常用通用蛊 · 一转起步", preview.base)}${table("道脉虫池", "进阶通用蛊 + 当前蛊修专属蛊 · 二转起步", preview.dao)}</div></div></div>`;
}
function settleGuluTime() {
  const s = getGuluStore();
  const now = guluNow();
  const news = [];
  const hatchedNow = [];
  s.slots.forEach((slot, i) => {
    if (slot && slot.state === "egg" && now >= slot.hatchAt) {
      const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
      const pool = getGuluHatchPool(grade, slot);
      const key = (slot.fixedCardKey && CARD_LIBRARY[slot.fixedCardKey])
        ? slot.fixedCardKey
        : (pool[Math.floor(guluRandom() * pool.length)] || "moonBlade");
      slot.state = "gu";
      slot.cardKey = key;
      // V0.9.52 双生髓结出的卵带 fixedUpgradeLevel：破壳即与取样对象同转，否则按品阶给起始转数。
      slot.upgradeLevel = Number.isFinite(Number(slot.fixedUpgradeLevel))
        ? Math.max(0, Math.min(FORGE_MAX_TURN, slot.fixedUpgradeLevel | 0))
        : grade.upgrade;
      delete slot.fixedUpgradeLevel;
      slot.name = `${getGuluGradeDisplayName(slot.grade)}·${CARD_LIBRARY[key]?.name || key}`;
      recordGuluHatch(s, slot);
      news.push(`蛊圃第 ${i + 1} 栏破卵：「${slot.name}」成蛊。`);
      hatchedNow.push(slot);
    }
  });
  if (hatchedNow.length) syncOwnedGuluDiscoveries(s);
  guluLastHatched = hatchedNow; // 每次结算都重置：无新破壳即为空，仪式不误触
  if (s.injuryUntil && now >= s.injuryUntil) {
    s.injuryUntil = 0;
    news.push("本命蛊静养期满，蛊性复元。");
  }
  if (news.length) {
    news.forEach((t) => guluPushEvent(s, t));
    saveGuluStore();
  }
  return news;
}
function getFirstHatchGuideState() {
  const key = typeof FIRST_HATCH_GUIDE_KEY !== "undefined" ? FIRST_HATCH_GUIDE_KEY : "nmg.firstHatchGuide.v1";
  try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
}
function isFirstHatchGuideReady(gradeId = "fan") {
  return gradeId === "fan" && getFirstHatchGuideState() === "ready";
}
function guluStartHatch(slotIndex, gradeId) {
  const s = getGuluStore();
  const grade = GULU_GRADES[gradeId];
  const guidedStarter = isFirstHatchGuideReady(gradeId);
  if (slotIndex >= getGuluSlotCap()) return { ok: false, text: `第 ${slotIndex + 1} 圃尚未辟开（${getGuluSlotUnlockHint(slotIndex)}后解锁）。` };
  if (!grade || s.slots[slotIndex]) return { ok: false, text: "此栏已有蛊。" };
  if (!guidedStarter && getGuluHatchMaterialTotal(s, grade) < grade.mats) return { ok: false, text: `材料不足：需${getGuluHatchCostText(grade)}。` };
  if (!guidedStarter && (s.bossCores | 0) < grade.core) return { ok: false, text: "缺蛊母残核（Boss 战利，须活着带出塔）。" };
  if (!guidedStarter) {
    if (!consumeGuluHatchMaterials(s, grade)) return { ok: false, text: "孵化材料结算失败，请重新打开蛊庐。" };
    s.bossCores -= grade.core;
  }
  s.serial += 1;
  // V0.9.51 八转元进度：孵化时间缩短 20%（仅影响等待，不碰蛊的强度）。
  const __hatchMs = Math.round(grade.hatchMs * (typeof getBenmingHatchSpeedup === "function" ? getBenmingHatchSpeedup() : 1));
  // V0.9.52：落卵时记下当时的蛊修——玄/天品破壳要从「通用稀有 + 该道专属」里抽，
  // 记在卵上而不是破壳时现查，玩家换角色不会让已下的卵改口味。
  s.slots[slotIndex] = { id: `gu${s.serial}`, state: "egg", grade: gradeId, heroId: progression?.selectedHeroId || "", startedAt: guluNow(), hatchAt: guidedStarter ? guluNow() : guluNow() + __hatchMs, carry: false, ...(guidedStarter ? { fixedCardKey: "moonBlade" } : {}) };
  if (guidedStarter) {
    const guideKey = typeof FIRST_HATCH_GUIDE_KEY !== "undefined" ? FIRST_HATCH_GUIDE_KEY : "nmg.firstHatchGuide.v1";
    try { localStorage.setItem(guideKey, "done"); } catch (e) { /* 存储不可用仍完成本次 */ }
  }
  guluPushEvent(s, guidedStarter
    ? `蛊圃第 ${slotIndex + 1} 栏落下第一枚蛊卵，卵壳应声而裂。`
    : `蛊圃第 ${slotIndex + 1} 栏落卵：${getGuluGradeDisplayName(gradeId)}蛊卵入土（${grade.timeText}破壳）。`);
  saveGuluStore();
  return { ok: true, text: guidedStarter ? "第一枚基础·次品蛊卵免费落圃，立即破壳。" : `${getGuluGradeDisplayName(gradeId)}蛊卵已入土，${grade.timeText}后破壳。` };
}
function guluToggleCarry(slotIndex) {
  const s = getGuluStore();
  const slot = s.slots[slotIndex];
  if (!slot || slot.state !== "gu") return { ok: false, text: "此栏无成蛊。" };
  if (!slot.carry && s.slots.filter((g) => g && g.state === "gu" && g.carry).length >= getCarryMaxNow()) {
    return { ok: false, text: `入塔携带至多 ${getCarryMaxNow()} 只。` };
  }
  slot.carry = !slot.carry;
  saveGuluStore();
  return { ok: true, text: slot.carry ? `「${slot.name}」已入行囊，下局随行入塔。` : `「${slot.name}」已归圃。` };
}
function getGuluRunningRun() {
  if (typeof runState !== "undefined" && runState) return runState.status === "running" ? runState : null;
  if (typeof loadRunAutosave === "function") {
    const payload = loadRunAutosave();
    if (payload?.run?.status === "running") return payload.run;
  }
  return null;
}
function isGuluSourceLocked(guId, activeRun = getGuluRunningRun()) {
  return Boolean(guId && activeRun?.status === "running"
    && Array.isArray(activeRun.carriedGuIds)
    && activeRun.carriedGuIds.includes(guId));
}
function getGuluSourceLockText(guId) {
  return isGuluSourceLocked(guId) ? "此蛊正在塔中随行" : "";
}
function findOwnedGuluById(store, guId) {
  const id = String(guId || "");
  if (!id || !store || typeof store !== "object") return null;
  const all = [
    ...(Array.isArray(store.slots) ? store.slots : []),
    ...(Array.isArray(store.nurture?.slots) ? store.nurture.slots : []),
  ];
  return all.find((slot) => slot?.state === "gu" && String(slot.id) === id) || null;
}

/* 只读详情模型保留完整蛊庐实例元数据，所有数值继续委托 game.js 的真实战斗函数。 */
function buildGuluDetailModel(slot) {
  if (!slot || slot.state !== "gu") return null;
  const definition = (typeof CARD_LIBRARY !== "undefined" && CARD_LIBRARY[slot.cardKey]) || null;
  const level = Math.max(0, Math.min(typeof FORGE_MAX_TURN === "number" ? FORGE_MAX_TURN : 8, slot.upgradeLevel | 0));
  const grade = (typeof GULU_GRADES !== "undefined" && GULU_GRADES[slot.grade]) || null;
  const nurtureBonus = Math.max(0, Number(slot.guluNurture)
    || (typeof getGuluNurtureBonus === "function" ? getGuluNurtureBonus(slot.grade) : 0));
  const rankName = String(slot.guluRank
    || (typeof getGuluRank === "function" ? getGuluRank(level)?.name : "")
    || "凡格");
  const entry = {
    ...slot,
    ...(definition || {}),
    key: definition ? slot.cardKey : "",
    originalKey: definition ? slot.cardKey : "",
    name: definition?.name || "蛊性不明",
    upgradeLevel: level,
    guluSourceId: String(slot.id || ""),
    guluGrade: String(slot.grade || "fan"),
    guluNurture: nurtureBonus,
    guluUpgradeCap: typeof getGuluUpgradeCap === "function" ? getGuluUpgradeCap(slot.grade) : 2,
    guluCarriedTurn: true,
    guluRank: rankName,
  };
  let currentValues = {};
  let nextValues = null;
  let currentEffect = "蛊性不明，暂无法辨识其战斗效果。";
  let nextEffect = "";
  let nextDelta = "";
  if (definition && typeof getCardValues === "function") {
    try { currentValues = getCardValues(entry, level) || {}; } catch (error) { currentValues = {}; }
    if (level < 8) {
      const nextEntry = { ...entry, upgradeLevel: level + 1 };
      try { nextValues = getCardValues(nextEntry, level + 1) || {}; } catch (error) { nextValues = {}; }
      if (typeof getRefineDeltaText === "function") nextDelta = getRefineDeltaText(entry, level, level + 1) || "";
      if (typeof getCardEffect === "function") {
        try { nextEffect = getCardEffect(nextEntry, level + 1) || ""; } catch (error) { nextEffect = ""; }
      }
    }
    if (typeof getCardEffect === "function") {
      try { currentEffect = getCardEffect(entry, level) || currentEffect; } catch (error) { /* 保留降级文案 */ }
    }
  }

  const resourceLabels = {
    draw: "抽牌", energy: "真元", supportDraw: "额外抽牌", cost: "消耗", costReduction: "减费",
    perPlayed: "每张追加", extendTurns: "延长回合", fateGain: "命势", scaleGain: "龙鳞",
    bloodGain: "血煞", bloodMultiplier: "血煞倍率",
  };
  const resourceFields = (typeof RESOURCE_LOCKED_FIELDS !== "undefined" && Array.isArray(RESOURCE_LOCKED_FIELDS))
    ? RESOURCE_LOCKED_FIELDS
    : Object.keys(resourceLabels);
  const resourceCaps = [];
  if (definition && typeof getCardValues === "function" && level > 0) {
    const history = [];
    for (let lv = 0; lv <= level; lv += 1) {
      try { history.push(getCardValues({ ...entry, upgradeLevel: lv }, lv) || {}); }
      catch (error) { history.push({}); }
    }
    resourceFields.forEach((field) => {
      const label = resourceLabels[field];
      if (!label) return;
      const values = history.map((valuesAtLevel) => valuesAtLevel[field]);
      if (!values.every((value) => typeof value === "number")) return;
      let lastChange = 0;
      for (let index = 1; index < values.length; index += 1) {
        if (values[index] !== values[index - 1]) lastChange = index;
      }
      if (lastChange >= level) return;
      resourceCaps.push({ field, label, value: values[level], capLevel: lastChange, capTurn: guluTurnName(lastChange) });
    });
  }
  const activeLockText = typeof getGuluSourceLockText === "function" ? getGuluSourceLockText(slot.id) : "";
  const gradeName = typeof getGuluGradeDisplayName === "function" ? getGuluGradeDisplayName(slot.grade) : (grade?.name || "品质不明");
  const turnName = typeof guluTurnName === "function" ? guluTurnName(level) : `${level + 1}转`;
  const sourceSummary = nurtureBonus > 0
    ? `${gradeName}庐养主值 +${nurtureBonus}；九转鼎炼至${turnName}，当前${rankName}。`
    : `${gradeName}成蛊；九转鼎炼至${turnName}，当前${rankName}。`;
  const resourceCapSummary = resourceCaps.length
    ? resourceCaps.map((item) => `${item.label}于${item.capTurn}封顶（${item.value}）`).join("；")
    : "";
  const replacementSummary = resourceCaps.length && nextDelta
    ? `核心资源封顶后改为定位成长：${nextDelta}。`
    : "";
  return {
    guId: String(slot.id || ""), entry,
    displayName: slot.customName || slot.name || definition?.name || "蛊性不明",
    cardName: definition?.name || "蛊性不明",
    gradeName, turnName, rankName,
    currentValues, currentEffect, nextValues, nextEffect,
    nextSummary: level >= 8 ? "已达九转，不再显示下一转预览。" : (nextDelta || "下一转暂无数值变化。"),
    resourceCaps, resourceCapSummary, replacementSummary, sourceSummary,
    activeSourceLocked: Boolean(activeLockText),
    lockSummary: activeLockText
      ? `${activeLockText}：可查看详情，但不能合练、升转、喂养、移动或遣归。`
      : "当前不是本局随行来源，可按蛊庐规则进行养成操作。",
    codexCardKey: definition ? slot.cardKey : "",
  };
}
function getGuluDisplayName(slot) {
  return slot?.customName || slot?.name || CARD_LIBRARY[slot?.cardKey]?.name || "此蛊";
}
function isGuluCarriedInRun(slot, activeRun) {
  return isGuluSourceLocked(slot?.id, activeRun);
}
function getGuluReleasePreview(slotIndex, activeRun = getGuluRunningRun()) {
  const s = getGuluStore();
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= getGuluSlotCap()) {
    return { ok: false, text: "此蛊圃尚不可用。" };
  }
  const slot = s.slots[slotIndex];
  if (!slot || slot.state !== "gu") return { ok: false, text: "此栏无可遣归的成蛊。" };
  if (isGuluCarriedInRun(slot, activeRun)) {
    return { ok: false, blocked: true, text: "此蛊正在塔中随行，结束本局后才能遣归。" };
  }
  const displayName = getGuluDisplayName(slot);
  const isTian = isGuluDaoGrade(slot.grade);
  const warnedName = isTian && !displayName.startsWith("道脉·") ? `道脉·${displayName}` : displayName;
  return {
    ok: true,
    kind: "release",
    slotId: slot.id,
    slotIndex,
    isTian,
    title: isTian ? "遣归道脉蛊？" : "遣蛊归野",
    text: isTian
      ? `即将遣归「${warnedName}」。其随行加持与投入材料均不会返还，此操作不能撤销。`
      : `确定遣归「${displayName}」？此蛊将永久离开蛊庐，不能找回，也不会返还孵化材料。`,
    cancelLabel: "暂且留下",
    confirmLabel: isTian ? "确认遣归道脉蛊" : "确认遣归",
  };
}
function guluReleaseToWild(slotIndex, activeRun = getGuluRunningRun()) {
  const preview = getGuluReleasePreview(slotIndex, activeRun);
  if (!preview.ok) return preview;
  const s = getGuluStore();
  const slot = s.slots[slotIndex];
  if (!slot || slot.state !== "gu" || slot.id !== preview.slotId) return { ok: false, text: "此蛊圃状态已改变，请重新确认。" };
  if (isGuluSourceLocked(slot.id, activeRun)) return { ok: false, blocked: true, text: "此蛊正在塔中随行，结束本局后才能遣归。" };
  const displayName = getGuluDisplayName(slot);
  slot.carry = false;
  recordGuluRelease(s, slot);
  s.slots[slotIndex] = null;
  const text = `「${displayName}」已遣归荒野，第 ${slotIndex + 1} 圃重新空出。`;
  guluPushEvent(s, text);
  saveGuluStore();
  return { ok: true, action: "release", text, releasedName: displayName, slotIndex };
}
function getGuluFeedPreview(slotIndex) {
  const s = getGuluStore();
  const slot = s.slots[slotIndex];
  if (!slot || slot.state !== "gu") return { ok: false, text: "此栏无成蛊。" };
  const lockText = getGuluSourceLockText(slot.id);
  if (lockText) return { ok: false, blocked: true, text: lockText };
  if (s.injuryUntil && guluNow() < s.injuryUntil) return { ok: false, text: "本命蛊仍在静养，不可进食。" };
  const heroId = progression.selectedHeroId;
  const gu = BENMING_GU[heroId];
  if (!gu) return { ok: false, text: "无本命蛊。" };
  const stage = getBenmingStage(heroId);
  const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
  const over = grade.feedRank - (stage + 1);
  const displayName = getGuluDisplayName(slot);
  const successRate = over <= 0 ? 100 : (over === 1 ? 50 : 20);
  const gain = over > 0 ? grade.dao * 2 : grade.dao;
  return {
    ok: true,
    kind: over > 0 ? "risk" : "safe",
    slotId: slot.id,
    slotIndex,
    over,
    successRate,
    gain,
    title: over > 0 ? "越级蛊斗？" : "喂给本命蛊？",
    text: over > 0
      ? `${gu.name}将越级吞食「${displayName}」：成功率 ${successRate}%，成功获得 ${gain} 道行；失败损失当前道行的 10%，并静养 8 小时。无论胜败，此蛊都会消失。`
      : `${gu.name}将安全压制「${displayName}」，获得 ${gain} 道行；此蛊会被消耗，不能找回。`,
    cancelLabel: "暂且留下",
    confirmLabel: over > 0 ? "确认蛊斗" : "确认喂养",
  };
}
// 蛊斗喂养：压制线内安稳吞下；越级是赌局——胜则道行加倍，败则反噬（损一成道行+静养，静养期形态降一档）。
function guluFeedToBenming(slotIndex) {
  const preview = getGuluFeedPreview(slotIndex);
  if (!preview.ok) return preview;
  const s = getGuluStore();
  const slot = s.slots[slotIndex];
  if (!slot || slot.state !== "gu" || slot.id !== preview.slotId) return { ok: false, text: "此蛊圃状态已改变，请重新确认。" };
  const lockText = getGuluSourceLockText(slot.id);
  if (lockText) return { ok: false, blocked: true, text: lockText };
  const heroId = progression.selectedHeroId;
  const gu = BENMING_GU[heroId];
  const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
  const over = preview.over; // 压制线按孵化路线，而不是次品/精品品质判定
  let text;
  const win = over <= 0 ? true : guluRandom() < (over === 1 ? 0.5 : 0.2);
  let kind = "safe";
  if (win) {
    if (over > 0) kind = "win";
    const dao = over > 0 ? grade.dao * 2 : grade.dao;
    addBenmingDaoxing(heroId, dao);
    const info = getBenmingStageInfo(heroId);
    text = over > 0
      ? `蛊斗胜！${gu.name}强吞「${slot.name}」，道行 +${dao}（现 ${info.dao} · ${info.stageName}）。`
      : `${gu.name}安然吞下「${slot.name}」，道行 +${dao}（现 ${info.dao} · ${info.stageName}）。`;
  } else {
    kind = "lose";
    const cur = getBenmingDaoxing(heroId);
    const lost = Math.floor(cur * 0.1);
    const bStore = getBenmingStore();
    bStore[heroId] = Math.max(0, cur - lost);
    try { safeWriteJson(BENMING_KEY, JSON.stringify(bStore)); } catch (e) { /* 忽略 */ }
    s.injuryUntil = guluNow() + GULU_INJURY_MS;
    text = `蛊斗败！「${slot.name}」临死反噬${gu.name}——道行 -${lost}，静养 8 小时（期间形态降一档）。`;
  }
  const eatenName = slot.name;
  recordGuluFeed(s, slot);
  s.slots[slotIndex] = null;
  guluPushEvent(s, text);
  saveGuluStore();
  return { ok: true, text, kind, eatenName };
}
function formatGuluRemain(ms) {
  if (ms <= 0) return "即将破壳";
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return h > 0 ? `约 ${h} 小时 ${m} 分` : `约 ${m} 分钟`;
}
let guluRefreshTimer = null;
let guluNoticeText = "";
let guluNoticeTimer = null;
let guluNoticeScheduledText = "";
let guluActiveTab = "home";
let guluNurtureFocusId = ""; // 纯 UI 焦点，不进蛊庐存档/runState/game
function scheduleGuluNoticeDismissal() {
  const expectedText = String(guluNoticeText || "");
  if (!expectedText) {
    if (guluNoticeTimer) window.clearTimeout(guluNoticeTimer);
    guluNoticeTimer = null;
    guluNoticeScheduledText = "";
    return;
  }
  if (guluNoticeTimer && guluNoticeScheduledText === expectedText) return;
  if (guluNoticeTimer) window.clearTimeout(guluNoticeTimer);
  guluNoticeScheduledText = expectedText;
  guluNoticeTimer = window.setTimeout(() => {
    guluNoticeTimer = null;
    if (guluNoticeText !== expectedText) return;
    guluNoticeText = "";
    guluNoticeScheduledText = "";
    if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) renderGulu();
  }, 1800);
}
function setGuluNurtureFocus(guId) {
  guluNurtureFocusId = String(guId || "");
}
function resolveGuluNurtureFocus(nurtureStore) {
  const occupied = nurtureStore.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => Boolean(slot));
  if (!occupied.length) {
    guluNurtureFocusId = "";
    return null;
  }
  const selected = occupied.find(({ slot }) => String(slot.id) === guluNurtureFocusId) || occupied[0];
  guluNurtureFocusId = String(selected.slot.id);
  return selected;
}
let guluForgeKindle = 0; // V0.9.54 本次入炉押上的引火砂份数（确认层内可加减，入炉后归零）
let guluFusionSelectionIds = []; // 纯 UI 合练选择；真正结果仍只写 guluStore
let guluMarketStall = "insects";
let guluRedeemOpen = false; // 纯 UI 弹窗态，不进入蛊庐存档/runState/game
function isBaigushiRedeemOpen() { return guluRedeemOpen; }
function focusBaigushiRedeemInput(value = null) {
  window.setTimeout(() => {
    const input = document.getElementById("baigushiRedeemInput");
    if (!input) return;
    if (value !== null) input.value = String(value || "");
    input.focus();
  }, 0);
}
function openBaigushiRedeem() {
  guluRedeemOpen = true;
  renderGulu();
  focusBaigushiRedeemInput();
}
function closeBaigushiRedeem() {
  guluRedeemOpen = false;
  renderGulu();
  window.setTimeout(() => document.querySelector("[data-baigushi-redeem-open]")?.focus(), 0);
}
let guluRewardedAdBusy = false; // AD-2：局外激励视频请求进行中，挡并发点击（广告全屏遮罩期间）
let guluCollectionFilter = "all";
let guluPendingAction = null;
let guluForgeSequenceTimers = [];
let guluForgeSequenceFinish = null;
let guluForgeRitualState = null; // 纯演出态；资产真相已经封存在 forgeUp 返回的 settlement
function isGuluActionConfirmOpen() {
  return !!(dom.guluActionConfirm && !dom.guluActionConfirm.classList.contains("hidden"));
}
function closeGuluActionConfirm() {
  guluPendingAction = null;
  guluForgeKindle = 0;
  dom.guluActionConfirm?.classList.add("hidden");
  dom.guluActionConfirm?.classList.remove("is-tian", "is-feed-risk");
}
function normalizeGuluFusionSelection(store = getGuluStore()) {
  const valid = new Set((store.slots || []).filter((slot) => slot?.state === "gu" && !slot.carry && !isGuluSourceLocked(slot.id)).map((slot) => String(slot.id)));
  guluFusionSelectionIds = [...new Set(guluFusionSelectionIds.map(String))].filter((id) => valid.has(id)).slice(0, 2);
  if (guluFusionSelectionIds.length === 2) {
    const first = (store.slots || []).find((slot) => String(slot?.id) === guluFusionSelectionIds[0]);
    const second = (store.slots || []).find((slot) => String(slot?.id) === guluFusionSelectionIds[1]);
    const sameTurn = first && second && (first.upgradeLevel | 0) === (second.upgradeLevel | 0);
    if (!sameTurn || !getGuluFusionRecipe(first?.cardKey, second?.cardKey)) {
      guluFusionSelectionIds = guluFusionSelectionIds.slice(0, 1);
    }
  }
  return guluFusionSelectionIds;
}
function toggleGuluFusionPick(slotId) {
  const store = getGuluStore();
  normalizeGuluFusionSelection(store);
  const id = String(slotId || "");
  const slot = store.slots.find((entry) => entry?.id === id);
  if (!slot || slot.state !== "gu" || slot.carry) return { ok: false, text: "这只蛊当前不可投入合练。" };
  const lockText = getGuluSourceLockText(slot.id);
  if (lockText) return { ok: false, blocked: true, text: lockText };
  if (guluFusionSelectionIds.includes(id)) guluFusionSelectionIds = guluFusionSelectionIds.filter((entry) => entry !== id);
  else if (guluFusionSelectionIds.length === 1) {
    const first = store.slots.find((entry) => String(entry?.id) === guluFusionSelectionIds[0]);
    if (!first || !getGuluFusionRecipe(first.cardKey, slot.cardKey)
      || (first.upgradeLevel | 0) !== (slot.upgradeLevel | 0)) {
      return { ok: false, text: "两只蛊性不相合，或转数不同；请选择列出的兼容同转伙伴。" };
    }
    guluFusionSelectionIds.push(id);
  } else guluFusionSelectionIds = [id];
  return { ok: true, selected: guluFusionSelectionIds.slice() };
}
function getGuluFusionPreview(slotIds = guluFusionSelectionIds) {
  const store = getGuluStore();
  const ids = Array.isArray(slotIds) ? slotIds.slice(0, 2).map(String) : [];
  const first = store.slots.find((slot) => slot?.id === ids[0]);
  const second = store.slots.find((slot) => slot?.id === ids[1]);
  const lockedId = [first, second].find((slot) => isGuluSourceLocked(slot?.id))?.id;
  if (lockedId) return { ok: false, blocked: true, slotIds: ids, text: getGuluSourceLockText(lockedId), reason: getGuluSourceLockText(lockedId) };
  const preview = buildGuluFusionPreview(first, second, store);
  if (!preview.ok) return { ...preview, slotIds: ids, text: preview.reason || preview.text };
  const firstName = CARD_LIBRARY[first.cardKey]?.name || first.name || "前蛊";
  const secondName = CARD_LIBRARY[second.cardKey]?.name || second.name || "后蛊";
  const resultName = CARD_LIBRARY[preview.resultCardKey]?.name || preview.resultCardKey;
  return {
    ...preview,
    slotIds: ids,
    title: `异蛊合练 · ${resultName}`,
    text: `投入${guluTurnName(preview.resultLevel)}「${firstName}」与「${secondName}」，消耗任意材料 ${preview.materialCost} 份。\n必定炼成同转「${resultName}」并继承较高路线品质；两只原蛊不可逆消失，温养与保底清零。`,
    confirmLabel: "确认合练",
    cancelLabel: "再想想",
    isTian: false,
  };
}
function openGuluFusionConfirm() {
  const preview = getGuluFusionPreview();
  if (!preview.ok) {
    guluNoticeText = preview.text;
    renderGulu();
    return preview;
  }
  if (!dom.guluActionConfirm) return { ok: false, text: "确认层暂不可用。" };
  guluPendingAction = { kind: "fusion", slotIds: preview.slotIds.slice(), snapshot: preview.snapshot };
  dom.guluActionConfirmTitle.textContent = preview.title;
  dom.guluActionConfirmText.textContent = preview.text;
  renderGuluForgeKindleControls({ kind: "fusion", kindleHave: 0 });
  dom.guluActionConfirmCancel.textContent = preview.cancelLabel;
  dom.guluActionConfirmOk.textContent = preview.confirmLabel;
  dom.guluActionConfirm.classList.toggle("is-tian", !!preview.isTian);
  dom.guluActionConfirm.classList.remove("is-feed-risk");
  dom.guluActionConfirm.classList.remove("hidden");
  window.setTimeout(() => dom.guluActionConfirmCancel?.focus(), 0);
  return preview;
}
function getGuluForgeKindleMax(preview) {
  return Math.max(0, Math.min(preview.kindleHave, Math.ceil((FORGE_RATE_CAP - preview.baseRate) / FORGE_KINDLE_BONUS)));
}
function renderGuluForgeKindleControls(preview) {
  const visible = preview.kind === "risk" && preview.kindleHave > 0;
  if (!visible) guluForgeKindle = 0;
  dom.guluForgeKindleControls?.classList.toggle("hidden", !visible);
  dom.guluForgeKindleControls?.toggleAttribute("hidden", !visible);
  if (!visible) return;
  const max = getGuluForgeKindleMax(preview);
  const kindle = Math.max(0, Math.min(max, guluForgeKindle | 0));
  guluForgeKindle = kindle;
  dom.guluForgeKindleValue.textContent = kindle;
  dom.guluForgeKindleMax.textContent = max;
  dom.guluForgeKindleDecrease.disabled = kindle <= 0;
  dom.guluForgeKindleIncrease.disabled = kindle >= max;
}
function refreshGuluForgeConfirmText(preview) {
  dom.guluActionConfirmText.textContent = preview.text;
  renderGuluForgeKindleControls(preview);
}
function adjustGuluForgeKindle(delta) {
  if (guluPendingAction?.kind !== "forge") return null;
  const before = getGuluForgePreview(guluPendingAction.slotIndex);
  if (!before.ok || before.slotId !== guluPendingAction.slotId) return before;
  guluForgeKindle = Math.max(0, Math.min(getGuluForgeKindleMax(before), (guluForgeKindle | 0) + delta));
  const preview = getGuluForgePreview(guluPendingAction.slotIndex);
  if (preview.ok) refreshGuluForgeConfirmText(preview);
  return preview;
}
/* V0.9.51 炼蛊房预览：与遣蛊/喂养同构，复用同一套确认管线（含 slotId 防状态漂移）。 */
function getGuluForgePreview(slotIndex) {
  const s = getGuluStore();
  const slot = s.slots?.[slotIndex];
  if (!slot || slot.state !== "gu") return { ok: false, text: "此圃无成蛊可炼。" };
  const chk = canForgeUp(s, slot);
  if (!chk.ok) return { ok: false, text: chk.reason };
  const turnNext = guluTurnName((slot.upgradeLevel | 0) + 1);
  // V0.9.54：把「投几份引火砂」做进确认层——赌注要在按下之前看得见。
  const kindleHave = Math.max(0, s.kindleSand | 0);
  const risky = (slot.upgradeLevel | 0) >= 3;
  const nurtureBonus = risky ? getNurtureForgeBonus(slot) : 0;
  const pityBonus = risky ? Math.max(0, Math.min(FORGE_PITY_CAP, slot.forgePity | 0)) : 0;
  const qualityBonus = risky ? getGuluQualityForgeBonus(slot) : 0;
  const recipeRate = getForgeSuccessRate(slot.upgradeLevel, 0, 0);
  const baseRate = getForgeSuccessRate(slot.upgradeLevel, 0, nurtureBonus, pityBonus, qualityBonus);
  const kindleMax = risky ? Math.max(0, Math.min(kindleHave, Math.ceil((FORGE_RATE_CAP - baseRate) / FORGE_KINDLE_BONUS))) : 0;
  guluForgeKindle = Math.max(0, Math.min(kindleMax, guluForgeKindle | 0));
  const kindle = guluForgeKindle;
  const rate = getForgeSuccessRate(slot.upgradeLevel, kindle, nurtureBonus, pityBonus, qualityBonus);
  const warded = risky && (s.guWard | 0) > 0;
  const cost = `同伴 ${chk.recipe.fodder} 只 ＋ 材料 ${chk.recipe.mats}`
    + ((chk.recipe.core | 0) > 0 ? ` ＋ 残核 ${chk.recipe.core}` : "")
    + ((chk.recipe.embryo | 0) > 0 ? ` ＋ 蛊胎 ${chk.recipe.embryo}` : "")
    + (kindle > 0 ? ` ＋ 引火砂 ${kindle}` : "");
  return {
    ok: true, kind: risky ? "risk" : "stable", slotId: slot.id, kindle, kindleHave, kindleMax, recipeRate, nurtureBonus, pityBonus, qualityBonus, baseRate, rate,
    title: `入炉 · 炼至${turnNext}`,
    text: risky
      ? `成功率 ${rate}%（炉方 ${recipeRate}%${qualityBonus > 0 ? ` ＋ 精品 ${qualityBonus}%` : ""}${nurtureBonus > 0 ? ` ＋ 温养 ${nurtureBonus}%` : ""}${pityBonus > 0 ? ` ＋ 失败积累 ${pityBonus}%` : ""}${kindle > 0 ? ` ＋ 引火砂 ${kindle} 份` : ""}）。\n投入：${cost}，成败都不退；成功后新转数温养归零，失败保留原转数与温养并使下次 +${FORGE_PITY_STEP}%。\n`
        + (warded
          ? "固蛊符将在失败时自动碎裂，返还本次消耗的蛊母残核与蛊胎。"
          : "没有固蛊符：失败仍保留目标，但残核与蛊胎不返还。")
      : `稳炼 · 必成。\n投入：${cost}。一至四转升转不消耗引火砂或固蛊符；成功后新转数温养归零。`,
    confirmLabel: "入炉", cancelLabel: "再想想",
    isTian: false,
  };
}
function openGuluActionConfirm(kind, slotIndex) {
  if (kind !== "forge") guluForgeKindle = 0;
  const preview = kind === "release" ? getGuluReleasePreview(slotIndex)
    : kind === "forge" ? getGuluForgePreview(slotIndex)
    : getGuluFeedPreview(slotIndex);
  if (!preview.ok) {
    guluNoticeText = preview.text;
    renderGulu();
    return preview;
  }
  if (!dom.guluActionConfirm) return { ok: false, text: "确认层暂不可用。" };
  guluPendingAction = { kind, slotIndex, slotId: preview.slotId };
  dom.guluActionConfirmTitle.textContent = preview.title;
  refreshGuluForgeConfirmText(preview);
  dom.guluActionConfirmCancel.textContent = preview.cancelLabel;
  dom.guluActionConfirmOk.textContent = preview.confirmLabel;
  dom.guluActionConfirm.classList.toggle("is-tian", !!preview.isTian);
  dom.guluActionConfirm.classList.toggle("is-feed-risk", preview.kind === "risk");
  dom.guluActionConfirm.classList.remove("hidden");
  window.setTimeout(() => dom.guluActionConfirmCancel?.focus(), 0);
  return preview;
}
function confirmGuluAction() {
  const pending = guluPendingAction;
  if (!pending) return { ok: false, text: "没有待确认的蛊庐操作。" };
  if (pending.kind === "fusion") {
    const preview = getGuluFusionPreview(pending.slotIds);
    if (!preview.ok) {
      closeGuluActionConfirm();
      return { ok: false, action: "fusion", text: preview.text };
    }
    const result = fuseGuluPair(getGuluStore(), pending.slotIds, pending.snapshot);
    if (result.ok) {
      saveGuluStore();
      guluFusionSelectionIds = [];
    }
    closeGuluActionConfirm();
    return { ...result, action: "fusion" };
  }
  const slot = getGuluStore().slots[pending.slotIndex];
  if (!slot || slot.state !== "gu" || slot.id !== pending.slotId) {
    closeGuluActionConfirm();
    return { ok: false, action: pending.kind, text: "此蛊圃状态已改变，请重新确认。" };
  }
  const result = pending.kind === "release"
    ? guluReleaseToWild(pending.slotIndex)
    : pending.kind === "forge"
      ? (() => {
        const st = getGuluStore();
        const r = forgeUp(st, st.slots[pending.slotIndex], { kindle: guluForgeKindle | 0 });
        if (r.ok) saveGuluStore();
        guluForgeKindle = 0; // 每次入炉后归零，免得下一次悄悄又押上
        return r;
      })()
      : guluFeedToBenming(pending.slotIndex);
  closeGuluActionConfirm();
  return { ...result, action: pending.kind };
}
function clearGuluForgeSequence() {
  guluForgeSequenceTimers.forEach((timer) => window.clearTimeout(timer));
  guluForgeSequenceTimers = [];
  guluForgeSequenceFinish = null;
}
function buildGuluForgeResultModel(result) {
  const settled = result && result.settlement ? result.settlement : {};
  const consumed = settled.consumed || {};
  const refunded = settled.refunded || {};
  const positiveParts = (pairs) => pairs
    .filter((pair) => Math.max(0, Number(pair[1]) || 0) > 0)
    .map((pair) => `${pair[0]} ${Math.max(0, Number(pair[1]) || 0)}`);
  const consumedParts = positiveParts([
    ["同名蛊", consumed.fodder], ["材料", consumed.materials], ["残核", consumed.core],
    ["蛊胎", consumed.embryo], ["引火砂", consumed.kindle], ["固蛊符", consumed.ward],
  ]);
  const refundParts = positiveParts([["残核", refunded.core], ["蛊胎", refunded.embryo]]);
  const toLevel = Math.max(0, Number(settled.toLevel) || 0);
  let tone = result?.warded ? "warded" : (result?.forged ? "success" : "failure");
  let title = result?.warded ? "固蛊符护炉 · 稀料归囊" : (result?.forged ? "合炼功成" : "炉火失衡 · 留蛊蓄火");
  let seal = result?.warded ? "护" : (result?.forged ? "成" : "留");
  if (result?.forged && toLevel === 5) { tone = "divine"; title = "六转神格 · 蛊性登神"; seal = "神"; }
  if (result?.forged && toLevel === 6) { tone = "imperial"; title = "七转皇格 · 皇命初成"; seal = "皇"; }
  if (result?.forged && toLevel === 8) { tone = "ancestor"; title = "九转祖格 · 祖蛊归位"; seal = "祖"; }
  const pityBefore = Math.max(0, Number(settled.pityBefore) || 0);
  const pityAfter = Math.max(0, Number(settled.pityAfter) || 0);
  return {
    tone, title, seal,
    guName: String(settled.guName || "成蛊"),
    turnsText: `${String(settled.fromTurn || "原转数")} → ${String(settled.toTurn || settled.fromTurn || "原转数")}`,
    consumedText: consumedParts.length ? consumedParts.join(" · ") : "无额外投入",
    refundText: refundParts.length ? refundParts.join(" · ") : "无返还",
    pityText: `${pityBefore}% → ${pityAfter}%`,
  };
}
function isGuluForgeResultRitualOpen() {
  return !!(dom.guluForgeResultOverlay && !dom.guluForgeResultOverlay.classList.contains("hidden"));
}
function openGuluForgeResultRitual(result) {
  if (!dom.guluForgeResultOverlay || result?.action !== "forge" || !result?.settlement) return null;
  const model = buildGuluForgeResultModel(result);
  guluForgeRitualState = { phase: "animating", model };
  dom.guluForgeResultOverlay.dataset.tone = model.tone;
  dom.guluForgeResultOverlay.dataset.phase = "animating";
  dom.guluForgeResultSeal.textContent = model.seal;
  dom.guluForgeResultTitle.textContent = model.title;
  dom.guluForgeResultGu.textContent = model.guName;
  dom.guluForgeResultTurns.textContent = model.turnsText;
  dom.guluForgeResultConsumed.textContent = model.consumedText;
  dom.guluForgeResultRefunded.textContent = model.refundText;
  dom.guluForgeResultPity.textContent = model.pityText;
  dom.guluForgeResultAccept.textContent = "跳过动势";
  dom.guluForgeResultOverlay.classList.remove("hidden");
  if (typeof refreshModalLock === "function") refreshModalLock();
  window.setTimeout(() => dom.guluForgeResultAccept?.focus(), 0);
  return model;
}
function finishGuluForgeResultRitual() {
  if (!guluForgeRitualState || guluForgeRitualState.phase === "final") return;
  guluForgeRitualState.phase = "final";
  if (dom.guluForgeResultOverlay) dom.guluForgeResultOverlay.dataset.phase = "final";
  if (dom.guluForgeResultAccept) dom.guluForgeResultAccept.textContent = "收势";
}
function closeGuluForgeResultRitual() {
  dom.guluForgeResultOverlay?.classList.add("hidden");
  if (dom.guluForgeResultOverlay) delete dom.guluForgeResultOverlay.dataset.phase;
  guluForgeRitualState = null;
  if (typeof refreshModalLock === "function") refreshModalLock();
  window.setTimeout(() => {
    const forgeTab = dom.guluBody?.querySelector('[data-gulu-tab="forge"]');
    (forgeTab || dom.guluCloseButton)?.focus?.();
  }, 0);
}
function advanceGuluForgeResultRitual() {
  if (!isGuluForgeResultRitualOpen()) return false;
  if (guluForgeRitualState?.phase !== "final") {
    if (typeof guluForgeSequenceFinish === "function") guluForgeSequenceFinish();
    else finishGuluForgeResultRitual();
  } else closeGuluForgeResultRitual();
  return true;
}
/* 九转鼎只把演出状态留在 DOM：炼蛊结果仍以 guluStore 为唯一真相。
 * 三段顺序固定为投料 → 炼化 → 炼后，避免结果弹窗先盖住鼎、玩家只看到库存突然变化。 */
function playGuluForgeSequence(result, onSettled) {
  clearGuluForgeSequence();
  if (result?.action === "forge") openGuluForgeResultRitual(result);
  const stage = dom.guluBody?.querySelector(".gulu-forge-stage, .gulu-fusion-stage");
  if (!stage || !result?.ok || !["forge", "fusion"].includes(result.action)) {
    finishGuluForgeResultRitual();
    if (typeof onSettled === "function") onSettled();
    return;
  }
  const status = stage.querySelector(".gulu-forge-stage-status");
  const outcomeClass = result.forged ? "is-result-success" : (result.warded ? "is-result-warded" : "is-result-preserved");
  const outcomeTitle = result.forged ? "合炼功成" : (result.warded ? "符护炉料" : "留蛊蓄火");
  const reducedMotion = (typeof effectsEnabled !== "undefined" && !effectsEnabled)
    || (typeof document !== "undefined" && document.body?.classList?.contains("effects-off"))
    || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  stage.setAttribute("aria-busy", reducedMotion ? "false" : "true");
  stage.classList.remove("is-result-success", "is-result-warded", "is-result-preserved", "is-result-lost");
  if (!reducedMotion) stage.classList.add("is-feeding");
  if (status) {
    status.textContent = outcomeTitle;
    status.setAttribute("data-detail", result.text || outcomeTitle);
  }
  if (!reducedMotion) window.AudioManager?.playSfx?.("forgeFeed", { volumeScale: 0.95 }); // V0.9.55：九转鼎自己的投料声，不再借喂蛊音
  const schedule = (fn, delay) => {
    const timer = window.setTimeout(fn, delay);
    guluForgeSequenceTimers.push(timer);
  };
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    guluForgeSequenceTimers.forEach((timer) => window.clearTimeout(timer));
    guluForgeSequenceTimers = [];
    if (stage.isConnected) {
      stage.classList.remove("is-feeding", "is-forging");
      stage.classList.add(outcomeClass);
      stage.setAttribute("aria-busy", "false");
    }
    finishGuluForgeResultRitual();
    window.AudioManager?.playSfx?.(result.forged ? "forgeSuccess" : (result.warded ? "forgeWard" : "forgeFail"), { volumeScale: 1 });
    guluForgeSequenceFinish = null;
    if (typeof onSettled === "function") onSettled();
  };
  guluForgeSequenceFinish = settle;
  if (reducedMotion) { settle(); return; }
  schedule(() => {
    if (!stage.isConnected) return;
    stage.classList.remove("is-feeding");
    stage.classList.add("is-forging");
    window.AudioManager?.playSfx?.("forgeRumble", { volumeScale: 1 }); // 鼎震：判定前的悬念，刻意不收束
  }, 520);
  schedule(settle, 1580);
}
function renderGuluTabs() {
  return `<nav class="gulu-tabs" aria-label="蛊庐页签">
    <button type="button" class="gulu-tab${guluActiveTab === "home" ? " is-active" : ""}" data-gulu-tab="home">蛊圃</button>
    <button type="button" class="gulu-tab${guluActiveTab === "nurture" ? " is-active" : ""}" data-gulu-tab="nurture">养蛊室</button>
    <button type="button" class="gulu-tab${guluActiveTab === "forge" ? " is-active" : ""}" data-gulu-tab="forge">九转鼎</button>
    <button type="button" class="gulu-tab${guluActiveTab === "fusion" ? " is-active" : ""}" data-gulu-tab="fusion">合蛊坛</button>
    <button type="button" class="gulu-tab${guluActiveTab === "collection" ? " is-active" : ""}" data-gulu-tab="collection">藏册</button>
  </nav>`;
}
/* V0.9.52 九转鼎（局外合炼，主界面直入）：炉方全表、材料/残核存量、「同名同转」成堆情况一次摊开，
 * 够料的那组直接给入炉按钮。纯展示 + 复用既有 data-gulu-forge 管线，不新增任何规则与状态。 */
/* ===== V0.9.55 升转阶梯（用户定调 B：看全程，不只看当前）=====
 * 九转要花约 112 蛊钱 + 11 残核 + 6 蛊胎 + 十来局通关，玩家必须在投入【之前】
 * 看得见整条回报曲线，否则这套系统只会劝退。故列出一转→九转每一转的主数值，
 * 标出当前所在与随行入塔实际生效的上限。
 * 取值一律走 getCardValues(key, forcedLevel) 同一条真相路径，绝不另算一套。 */
const GU_LADDER_FIELDS = Object.freeze([
  { key: "damage", label: "伤害" },
  { key: "armor", label: "防御" },
  { key: "heal", label: "疗愈" },
  { key: "poison", label: "毒性" },
]);
function getGuLadderRows(cardKey) {
  if (typeof getCardValues !== "function" || !CARD_LIBRARY[cardKey]) return null;
  const rows = [];
  for (let lv = 0; lv <= FORGE_MAX_TURN; lv += 1) {
    let values = null;
    try { values = getCardValues({ key: cardKey, upgradeLevel: lv, guluCarriedTurn: true }, lv); } catch (e) { values = null; }
    if (!values) return null;
    const field = GU_LADDER_FIELDS.find((f) => typeof values[f.key] === "number" && values[f.key] > 0);
    rows.push({ lv, turn: guluTurnName(lv), label: field ? field.label : "", value: field ? values[field.key] : null });
  }
  // 整条都取不到主数值（纯规则牌，如抽牌/上状态）就不画阶梯，免得给一列空格
  return rows.some((r) => r.value !== null) ? rows : null;
}
function renderGuTurnLadder(slot) {
  const rows = getGuLadderRows(slot?.cardKey);
  if (!rows) return "";
  const now = slot.upgradeLevel | 0;
  const label = rows.find((r) => r.label)?.label || "";
  const cells = rows.map((r) => `<li class="${r.lv === now ? "is-now" : (r.lv < now ? "is-past" : "")}">
    <b>${r.turn.slice(0, 1)}</b><i>${r.value === null ? "—" : r.value}</i></li>`).join("");
  const first = rows[0].value;
  const last = rows[rows.length - 1].value;
  const growth = (first > 0 && last > 0) ? `一转 ${first} → 九转 ${last}（约 ${(last / first).toFixed(1)} 倍）` : "";
  return `<details class="gulu-turn-ladder">
    <summary>升转阶梯${label ? ` · ${label}` : ""}${growth ? `<span>${growth}</span>` : ""}</summary>
    <ol>${cells}</ol>
    <p>标亮者为当前转数；随行入塔按此表实际生效（局内炼蛊炉另有基础三转／道脉四转的上限）。</p>
  </details>`;
}
/* ===== V0.9.57 养蛊室渲染 =====
 * 布局语言刻意与九转鼎同构（中央大物 + 环绕小物 + 底部 kicker/status），
 * 玩家一眼能认出是同一个世界的两个房间：那边炉火、这边泉水。
 *
 * 「让人愿意多待」的三个着力点（拆自禅境花园，本项目已有前两条的底子）：
 *   ① 进度长在物件上——温养度做成蛊虫身上的浸润水光，不是一根进度条；
 *   ② 满了必须一眼看见——泉满则冒气泡（挂机产出若不提示，等于白产）；
 *   ③ 满了就停、不腐败、不惩罚——玩家想起来再收，这是它能让人放松的前提。 */
function renderGuluNurture(store, now) {
  const n = normalizeNurtureStore(store);
  const conf = getNurtureSpringLevel(n.level);
  const nextConf = n.level < NURTURE_SPRING_MAX_LEVEL ? getNurtureSpringLevel(n.level + 1) : null;
  const full = n.dew >= conf.cap;
  const fillPct = Math.round((n.dew / conf.cap) * 100);
  const minutes = Math.round(conf.msPerDew / 60000);
  // 距下一滴还有多久——挂机类界面里，这个数字本身就是让人回来的理由
  const waited = Math.max(0, now - (n.lastTickAt || now));
  const remainMs = full ? 0 : Math.max(0, conf.msPerDew - (waited % conf.msPerDew));
  const remainText = full ? "已满 · 待取" : `下一滴 ${formatGuluRemain(remainMs)}`;

  const cap = getGuluSlotCap();
  const storable = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < cap && slot?.state === "gu" && !slot.carry && !isGuluSourceLocked(slot.id));
  const storeButtons = storable.length
    ? storable.map(({ slot, index }) => `<button type="button" class="nurture-move-in" data-nurture-store="${escGu(slot.id)}">收第 ${index + 1} 圃<small>${escGu(slot.customName || slot.name || "蛊")}</small></button>`).join("")
    : `<p class="gulu-tip">蛊圃暂无可收纳的成蛊（随行中的蛊需先取消随行）。</p>`;

  const occupied = n.slots.filter(Boolean).length;
  const focus = resolveGuluNurtureFocus(n);
  const ring = n.slots.map((slot, index) => {
    const pos = NURTURE_ORBIT_SLOTS[index];
    const orbitStyle = `--orbit-x:${pos.x}%;--orbit-y:${pos.y}%;--orbit-scale:${pos.scale};--orbit-z:${pos.z};--motion-delay:${(-index * 0.37).toFixed(2)}s`;
    if (!slot) return `<li class="nurture-orbit-slot is-empty" style="${orbitStyle}" aria-hidden="true"><span class="nurture-perch"></span></li>`;
    const val = Math.max(0, Math.min(NURTURE_MAX, slot.nurture | 0));
    const done = val >= NURTURE_MAX;
    const selected = Boolean(focus && String(focus.slot.id) === String(slot.id));
    const name = escGu(slot.customName || slot.name || "蛊");
    const art = getGuluCardArt(slot.cardKey);
    const fallback = escGu(CARD_LIBRARY[slot.cardKey]?.glyph || "蛊");
    return `<li class="nurture-orbit-slot${done ? " is-ripe" : ""}${selected ? " is-selected" : ""}" style="${orbitStyle};--soak:${val}%">
      <button type="button" class="nurture-creature motion-${pos.motion}" data-nurture-focus="${escGu(slot.id)}"
        aria-label="查看${name}，温养 ${val}/${NURTURE_MAX}" aria-pressed="${selected ? "true" : "false"}">
        <span class="nurture-soak" aria-hidden="true"></span>
        <span class="nurture-gu-art">${art
          ? `<img src="${escGu(art)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
          : `<i aria-hidden="true">${fallback}</i>`}</span>
        <span class="nurture-creature-label">${name}</span>
      </button>
    </li>`;
  }).join("");

  const focusPanel = (() => {
    if (!focus) return `<aside class="nurture-focus-panel is-empty"><p>泉边尚无蛊虫，先从蛊圃收纳一只。</p></aside>`;
    const slot = focus.slot;
    const val = Math.max(0, Math.min(NURTURE_MAX, slot.nurture | 0));
    const done = val >= NURTURE_MAX;
    const name = escGu(slot.customName || slot.name || "蛊");
    const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
    const art = getGuluCardArt(slot.cardKey);
    const fallback = escGu(CARD_LIBRARY[slot.cardKey]?.glyph || "蛊");
    const focusId = escGu(slot.id);
    const sourceLocked = isGuluSourceLocked(slot.id);
    const ecologyCost = getEcologyNurtureCost(slot.cardKey);
    const ecologyReady = ecologyCost && normalizeRedeemOwnedAmount(store.ecologyMaterials[ecologyCost.ecology]) >= 1 && normalizeRedeemOwnedAmount(store.materials[ecologyCost.core]) >= 2;
    const rewardedNurtureButton = guluRewardedAdReady() && canRewardedNurture(store, slot.id, slot)
      ? `<button type="button" class="gulu-rewarded-btn" data-nurture-rewarded-gu="${focusId}">看广告 · 温养 +${NURTURE_GAIN_PER_DEW}</button>`
      : "";
    return `<aside class="nurture-focus-panel${done ? " is-ripe" : ""}" aria-live="polite">
      <span class="nurture-focus-art">${art
        ? `<img src="${escGu(art)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
        : `<i aria-hidden="true">${fallback}</i>`}</span>
      <span class="nurture-focus-copy"><strong>${name}</strong><small>${escGu(getGuluGradeDisplayName(slot.grade))} · ${escGu(guluTurnName(slot.upgradeLevel | 0))}</small><em>温养 ${val}/${NURTURE_MAX}${done ? ` · 入炉成功率 +${NURTURE_FORGE_BONUS}` : ""}</em></span>
      <span class="nurture-focus-actions">
        <button type="button" data-gulu-detail="${focusId}">查看详情</button>
        <button type="button" data-nurture-feed="${focusId}" ${(n.dew | 0) > 0 && !done && !sourceLocked ? "" : "disabled"}>温养</button>
        ${ecologyCost ? `<button type="button" data-nurture-ecology="${focusId}" ${ecologyReady && !done && !sourceLocked ? "" : "disabled"}>栖材温养</button>` : ""}
        ${rewardedNurtureButton}
        <button type="button" data-nurture-take="${focusId}" ${sourceLocked ? "disabled" : ""}>取出</button>
      </span>
    </aside>`;
  })();
  const rewardedDewButton = guluRewardedAdReady() && canClaimRewardedDew(store, n)
    ? `<button type="button" class="gulu-rewarded-btn" data-nurture-rewarded-dew="1">看广告 · 元髓露 +1</button>`
    : "";

  const upgradeLine = nextConf
    ? `<button type="button" class="nurture-upgrade" data-nurture-upgrade="1"
        ${(normalizeRedeemOwnedAmount(store.market.scrip) >= conf.upScrip && guluMatTotal(store) >= conf.upMats) ? "" : "disabled"}>
        凿深灵泉 · ${n.level} → ${n.level + 1} 级
        <small>蛊钱 ${conf.upScrip} · 任意材料 ${conf.upMats} ｜ 升后 ${Math.round(nextConf.msPerDew / 60000)} 分钟一滴、可存 ${nextConf.cap} 滴</small>
      </button>`
    : `<p class="gulu-tip">灵泉已至五级，再无可凿之处。</p>`;

  return `<section class="gulu-nurture">
    <header class="gulu-nurture-head">
      <h3>灵泉温养 <small>蛊虫收纳 ${occupied}/${NURTURE_SLOTS_MAX}</small></h3>
      <p class="gulu-tip">收纳中的蛊不占蛊圃，但不能随行、不能喂本命蛊、也不能作炉料——要用先取出。</p>
    </header>
    ${renderGuluRewardedAdNotice()}
    <section class="gulu-nurture-ring-wrap">
      <h4>泉边温养 <small>一滴元髓露 +${NURTURE_GAIN_PER_DEW} 度，满 ${NURTURE_MAX} 度入炉成功率 +${NURTURE_FORGE_BONUS}</small></h4>
      <div class="nurture-habitat" role="group" aria-label="灵泉与十二处蛊虫栖位">
        <div class="nurture-stage${full ? " is-brimming" : ""}" aria-live="polite">
          <span class="nurture-aura" aria-hidden="true"></span>
          <img src="assets/ui/spirit-spring.webp" alt="幽碧灵泉自兽面石雕口中垂落">
          <span class="nurture-stream" aria-hidden="true"></span>
          <span class="nurture-water" style="--fill:${fillPct}%" aria-hidden="true"></span>
          ${full ? '<span class="nurture-bubble" aria-hidden="true"></span>' : ""}
          <span class="nurture-stage-kicker">灵泉 · ${n.level} 级 · ${minutes} 分钟一滴</span>
          <strong class="nurture-stage-status" data-detail="${escGu(remainText)}">元髓露 ${n.dew}/${conf.cap}</strong>
        </div>
        <ol class="nurture-ring" aria-label="泉边蛊虫">${ring}</ol>
      </div>
      ${rewardedDewButton}
      ${focusPanel}
    </section>
    <section class="gulu-nurture-actions">
      <h4>收纳入室</h4>
      <div class="nurture-store-row">${storeButtons}</div>
      ${upgradeLine}
    </section>
  </section>`;
}

function renderGuluFusionPanel(store) {
  normalizeGuluFusionSelection(store);
  const candidates = (store.slots || []).map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "gu" && !slot.carry && !isGuluSourceLocked(slot.id));
  const firstSelected = store.slots.find((slot) => String(slot?.id) === guluFusionSelectionIds[0]) || null;
  const partnerKeys = new Set(firstSelected ? getGuluFusionPartners(firstSelected.cardKey) : []);
  const cards = candidates.map(({ slot, index }) => {
    const selected = guluFusionSelectionIds.includes(String(slot.id));
    const isIncompatible = Boolean(firstSelected && !selected
      && (!partnerKeys.has(slot.cardKey) || (slot.upgradeLevel | 0) !== (firstSelected.upgradeLevel | 0)));
    const card = CARD_LIBRARY[slot.cardKey] || {};
    const art = getGuluCardArt(slot.cardKey);
    return `<button type="button" class="gulu-fusion-pick${selected ? " is-selected" : ""}${isIncompatible ? " is-incompatible" : ""}" data-gulu-fusion-pick="${escGu(slot.id)}" aria-pressed="${selected}" ${isIncompatible ? "disabled" : ""}>
      <span>${art ? `<img src="${escGu(art)}" alt="" loading="lazy" decoding="async">` : `<i>${escGu(card.glyph || "蛊")}</i>`}</span>
      <strong>第 ${index + 1} 圃 · ${escGu(card.name || slot.name || "成蛊")}</strong><small>${escGu(guluTurnName(slot.upgradeLevel | 0))} · ${escGu(getGuluGradeDisplayName(slot.grade))}</small>
    </button>`;
  }).join("");
  const preview = guluFusionSelectionIds.length === 2 ? getGuluFusionPreview(guluFusionSelectionIds) : null;
  const chosen = guluFusionSelectionIds.map((id) => store.slots.find((slot) => String(slot?.id) === id)).filter(Boolean);
  const chosenText = chosen.length
    ? chosen.map((slot) => CARD_LIBRARY[slot.cardKey]?.name || slot.name || "成蛊").join(" ＋ ")
    : "尚未选择投入蛊";
  const availablePartnerNames = firstSelected
    ? [...new Set(candidates.filter(({ slot }) => slot.id !== firstSelected.id && partnerKeys.has(slot.cardKey)
      && (slot.upgradeLevel | 0) === (firstSelected.upgradeLevel | 0))
      .map(({ slot }) => CARD_LIBRARY[slot.cardKey]?.name || slot.name || "成蛊"))]
    : [];
  const partnerGuide = firstSelected
    ? `<p class="gulu-fusion-partners"><b>当前兼容伙伴</b>${availablePartnerNames.length ? escGu(availablePartnerNames.join("、")) : "当前尚无可合练对象"}</p>`
    : "";
  const renderEffect = (detail, label) => `<article><small>${escGu(label)}</small><b>${escGu(detail?.cardName || "蛊性不明")}</b><p>${detail?.currentEffect || "蛊效暂不可见"}</p></article>`;
  const valuePreview = preview?.ok ? `<div class="gulu-fusion-value-preview">
    <p class="gulu-fusion-rationale">${escGu(preview.rationale)}</p>
    <div class="gulu-fusion-effects">
      ${renderEffect(preview.firstDetail, "投入一 · 当前效果")}
      ${renderEffect(preview.secondDetail, "投入二 · 当前效果")}
      ${renderEffect(preview.resultDetail, `产物 · ${guluTurnName(preview.resultLevel)}效果`)}
    </div>
    <ul class="gulu-fusion-deltas">${preview.changedFields.length
      ? preview.changedFields.map((field) => `<li><b>${escGu(field.label)}</b><span>${field.first ?? "—"} / ${field.second ?? "—"} → ${field.result ?? "—"}</span></li>`).join("")
      : "<li><span>产物以条件机制重组双方蛊效。</span></li>"}</ul>
    <p class="gulu-fusion-cost">继承${escGu(guluTurnName(preview.resultLevel))}与较高路线品质「${escGu(getGuluGradeDisplayName(preview.resultGrade))}」 · 任意材料 ${preview.materialCost} 份</p>
    <p class="gulu-fusion-reset">温养清零 · 炉火保底清零</p>
    <p class="gulu-fusion-irreversible">不可逆消耗：确认后两只原蛊消失，只保留第一投入的原槽位与蛊虫身份。</p>
  </div>` : "";
  const outcome = preview?.ok
    ? `<strong>${escGu(chosenText)} → ${escGu(CARD_LIBRARY[preview.resultCardKey]?.name || preview.resultCardKey)}</strong>${valuePreview}`
    : `<strong>${escGu(chosenText)}</strong><small>${escGu(preview?.reason || (chosen.length ? "请从兼容名单选择一只同转成蛊" : "先选择一只成蛊"))}</small>`;
  const recipeList = Object.values(GULU_FUSION_RECIPES).map((recipe) => {
    const leftArt = getGuluCardArt(recipe.left);
    const rightArt = getGuluCardArt(recipe.right);
    const resultArt = getGuluCardArt(recipe.result);
    const resultType = CARD_LIBRARY[recipe.result]?.type || "utility";
    const role = resultType === "defense" ? "defense" : (["attack", "blood", "poison"].includes(resultType) ? "attack" : "support");
    const portrait = (key, art) => art
      ? `<span class="gulu-recipe-art"><img src="${escGu(art)}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="gulu-recipe-art"><i>${escGu(CARD_LIBRARY[key]?.glyph || "蛊")}</i></span>`;
    return `<li class="tone-${role}" data-gulu-recipe-role="${role}">
      <div class="gulu-recipe-formula">
        <figure>${portrait(recipe.left, leftArt)}<figcaption>${escGu(CARD_LIBRARY[recipe.left]?.name || recipe.left)}</figcaption></figure>
        <b aria-hidden="true">＋</b>
        <figure>${portrait(recipe.right, rightArt)}<figcaption>${escGu(CARD_LIBRARY[recipe.right]?.name || recipe.right)}</figcaption></figure>
        <b aria-hidden="true">→</b>
        <figure class="is-result">${portrait(recipe.result, resultArt)}<figcaption>${escGu(CARD_LIBRARY[recipe.result]?.name || recipe.result)}</figcaption></figure>
      </div><p>${escGu(recipe.rationale)}</p>
    </li>`;
  }).join("");
  return `<section class="gulu-fusion" aria-label="异蛊合练">
    <header><div><h3>异蛊合练 <small>不同蛊种 · 同转归一</small></h3><p>合练必成；两只原蛊消失，产物继承转数与较高路线品质。</p></div><span aria-hidden="true">合</span></header>
    ${partnerGuide}
    <div class="gulu-fusion-layout">
      <div class="gulu-fusion-picks">${cards || '<p class="gulu-tip">当前没有可合练的非随行成蛊。</p>'}</div>
      <aside class="gulu-fusion-result">${outcome}<button type="button" data-gulu-fusion-confirm="1" ${preview?.ok ? "" : "disabled"}>${preview?.ok ? "入坛合练" : `已选 ${chosen.length}/2`}</button></aside>
    </div>
    <button type="button" class="gulu-fusion-recipes" data-gulu-recipes-open="1" aria-expanded="false">合练谱 · ${Object.keys(GULU_FUSION_RECIPES).length} 方</button>
    <div class="gulu-recipe-overlay hidden" role="dialog" aria-modal="true" aria-label="异蛊合练谱" data-gulu-recipes-overlay="1">
      <section class="gulu-recipe-atlas">
        <header><div><small>合蛊坛 · 异蛊归一</small><h3>合练谱</h3><p>同转原蛊归一；立绘与产物一览。</p></div><button type="button" data-gulu-recipes-close="1" aria-label="关闭合练谱">×</button></header>
        <nav class="gulu-recipe-filters" aria-label="合练谱筛选">
          <button type="button" data-gulu-recipes-filter="all" aria-pressed="true">全部</button>
          <button type="button" data-gulu-recipes-filter="attack" aria-pressed="false">攻击</button>
          <button type="button" data-gulu-recipes-filter="defense" aria-pressed="false">防御</button>
          <button type="button" data-gulu-recipes-filter="support" aria-pressed="false">辅助</button>
        </nav>
        <div class="gulu-recipe-scroll"><ul>${recipeList}</ul></div>
      </section>
    </div>
  </section>`;
}

function renderGuluFusionAltar(store) {
  const materialTotal = MATERIAL_IDS.reduce((sum, id) => sum + normalizeRedeemOwnedAmount(store.materials[id]), 0);
  return `<section class="gulu-fusion-altar" aria-label="合蛊坛">
    <header class="gulu-fusion-altar-header">
      <div><small>异种同转 · 双蛊归一</small><h3>合蛊坛</h3><p>择两只不同蛊种的同转成蛊，循明方归一为新的异蛊。</p></div>
      <dl><div><dt>合练方</dt><dd>${Object.keys(GULU_FUSION_RECIPES).length}</dd></div><div><dt>现有材料</dt><dd>${materialTotal}</dd></div></dl>
    </header>
    <div class="gulu-fusion-stage" aria-live="polite" aria-busy="false">
      <img class="gulu-fusion-stage-art" src="assets/scenes/fusion-altar.webp" alt="" decoding="async">
      <span class="gulu-fusion-stage-glow" aria-hidden="true"></span>
      <span class="gulu-fusion-stage-sparks" aria-hidden="true"></span>
      <span class="gulu-forge-stage-kicker">双蛊待契</span>
      <strong class="gulu-forge-stage-status" data-detail="选择下方两只同转成蛊">择蛊归一</strong>
    </div>
    ${renderGuluFusionPanel(store)}
  </section>`;
}

function renderGuluForge(store) {
  const cap = getGuluSlotCap();
  const matTotal = MATERIAL_IDS.reduce((sum, id) => sum + normalizeRedeemOwnedAmount(store.materials[id]), 0);
  const recipeRows = Object.keys(FORGE_RECIPES).map((lvl, index) => {
    const r = FORGE_RECIPES[lvl];
    const stable = Number(lvl) <= 3;
    const cost = `同名同转 ${r.fodder} 只，材料 ${r.mats}${(r.core | 0) > 0 ? `，残核 ${r.core}` : ""}${(r.embryo | 0) > 0 ? `，蛊胎 ${r.embryo}` : ""}`;
    return `<li style="--orbit-index:${index}" title="${escGu(cost)}" aria-label="${escGu(r.label)}，${escGu(cost)}，${stable ? "稳炼必成" : `基础成功率 ${r.rate}%`}"><b>${escGu(r.label)}</b><em class="gulu-forge-rate">${stable ? "稳炼" : `成 ${r.rate}%`}</em></li>`;
  }).join("");
  const oneTurnJourney = getForgeJourneyMinimums(0);
  const twoTurnJourney = getForgeJourneyMinimums(1);
  // 炉险必须在动手前说明；逐转成功率只在炉方环与目标卡各显示一次。
  const rulesBoard = `<section class="gulu-forge-warn" role="note">
    <h4><span aria-hidden="true">炼</span>入炉四则</h4>
    <ol>
      <li>一至四转升转：稳炼必成</li>
      <li>四转升五转起：失败留蛊，积累 +${FORGE_PITY_STEP}%</li>
      <li>固蛊符：失败时护回残核与蛊胎</li>
      <li>温养、积累、引火砂共用 ${FORGE_RATE_CAP}% 上限</li>
    </ol>
    <p class="gulu-forge-journey">零失败直达九转：一转起共需 ${oneTurnJourney.totalEquivalentGu} 只（含当前目标，另备 ${oneTurnJourney.additionalEquivalentGu} 只）、材料 ${oneTurnJourney.materials}、残核 ${oneTurnJourney.cores}、蛊胎 ${oneTurnJourney.embryos}，峰值 ${oneTurnJourney.peakSlots} 格；二转起共需 ${twoTurnJourney.totalEquivalentGu} 只（另备 ${twoTurnJourney.additionalEquivalentGu} 只）、材料 ${twoTurnJourney.materials}，峰值 ${twoTurnJourney.peakSlots} 格。未计失败追加消耗。</p>
    <p class="gulu-forge-stock">现存 · 引火砂 <b>${store.kindleSand | 0}</b> 份 · 固蛊符 <b>${store.guWard | 0}</b> 张 · 蛊胎 <b>${store.guEmbryo | 0}</b> 枚 · 残核 <b>${store.bossCores | 0}</b> 枚</p>
  </section>`;
  // 按「同名 + 同转」归堆——这正是炉方的计量单位，玩家一眼能看出还差几只。
  const groups = new Map();
  store.slots.forEach((slot, index) => {
    if (index >= cap || !slot || slot.state !== "gu") return;
    const key = `${slot.cardKey}@${slot.upgradeLevel | 0}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ slot, index });
  });
  const cards = [...groups.values()].map((entries) => {
    // 随行蛊不能入炉：同组优先选可用的非随行实例，避免随行实例抢占整组操作入口。
    const target = entries.find((e) => !e.slot.carry) || entries[0];
    const chk = canForgeUp(store, target.slot);
    const turn = guluTurnName(target.slot.upgradeLevel);
    const name = CARD_LIBRARY[target.slot.cardKey]?.name || target.slot.name || "成蛊";
    const fodderNow = chk.fodder ? chk.fodder.length : 0;
    const need = chk.recipe ? chk.recipe.fodder : 0;
    const risky = (target.slot.upgradeLevel | 0) >= 3;
    const nurtureBonus = risky ? getNurtureForgeBonus(target.slot) : 0;
    const pityBonus = risky ? Math.max(0, Math.min(FORGE_PITY_CAP, target.slot.forgePity | 0)) : 0;
    const qualityBonus = risky ? getGuluQualityForgeBonus(target.slot) : 0;
    const shownRate = getForgeSuccessRate(target.slot.upgradeLevel, 0, nurtureBonus, pityBonus, qualityBonus);
    const requirementRows = [
      ["同伴", fodderNow, need],
      ["材料", matTotal, chk.recipe?.mats | 0],
      ["残核", store.bossCores | 0, chk.recipe?.core | 0],
      ["蛊胎", store.guEmbryo | 0, chk.recipe?.embryo | 0],
    ];
    const requirementMarkup = `<div class="gulu-forge-requirements">${requirementRows.map(([label, now, required]) =>
      `<span class="gulu-forge-requirement${required > 0 && now >= required ? " is-ready" : ""}${required <= 0 ? " is-unused" : ""}"><b>${label}</b> ${now}/${required}</span>`
    ).join("")}</div>`;
    const line = chk.recipe
      ? `<span><b class="gulu-forge-rate">${risky ? `成功率 ${shownRate}%${qualityBonus > 0 || nurtureBonus > 0 || pityBonus > 0 ? `（${qualityBonus > 0 ? `精品 +${qualityBonus}%` : ""}${qualityBonus > 0 && (nurtureBonus > 0 || pityBonus > 0) ? " · " : ""}${nurtureBonus > 0 ? `温养 +${nurtureBonus}%` : ""}${nurtureBonus > 0 && pityBonus > 0 ? " · " : ""}${pityBonus > 0 ? `失败积累 +${pityBonus}%` : ""}）` : ""}` : "稳炼 · 必成"}</b></span>
         ${requirementMarkup}`
      : "<span>已至九转 · 蛊道尽头</span>";
    const progressionCard = {
      key: target.slot.cardKey,
      upgradeLevel: target.slot.upgradeLevel | 0,
      guluCarriedTurn: true,
    };
    const progressionSummary = typeof getResourceProgressionSummary === "function"
      ? getResourceProgressionSummary(progressionCard)
      : "";
    const journey = getForgeJourneyMinimums(target.slot.upgradeLevel | 0);
    const journeySummary = (target.slot.upgradeLevel | 0) < FORGE_MAX_TURN
      ? `直达九转最低：共需同源蛊 ${journey.totalEquivalentGu} 只（含当前目标，另备 ${journey.additionalEquivalentGu} 只） · 材料 ${journey.materials} · 残核 ${journey.cores} · 蛊胎 ${journey.embryos} · 峰值 ${journey.peakSlots} 格；未计失败追加消耗。`
      : "";
    return `<article class="gulu-forge-card${chk.ok ? " is-ready" : ""}">
      <h4>${escGu(name)} <b>${turn}</b><small>庐中共 ${entries.length} 只${target.slot.carry ? " · 目标随行中" : ""}</small></h4>
      <div class="gulu-forge-lines">${line}</div>
      ${progressionSummary ? `<p class="gulu-forge-why">${escGu(progressionSummary)}</p>` : ""}
      ${journeySummary ? `<p class="gulu-forge-journey">${escGu(journeySummary)}</p>` : ""}
      ${renderGuTurnLadder(target.slot)}
      ${(!chk.ok && chk.reason) ? `<p class="gulu-forge-why">${escGu(chk.reason)}</p>` : ""}
      <button type="button" class="gulu-forge-btn" data-gulu-forge="${target.index}" ${chk.ok ? "" : "disabled"}>${chk.ok ? "入炉 · 升一转" : "炉方未备"}</button>
    </article>`;
  }).join("");
  const stockBoard = `<aside class="gulu-forge-stock-board" aria-label="鼎中库存">
    <h3>炉藏</h3>
    <dl>
      <div><dt>引火砂</dt><dd>${store.kindleSand | 0}</dd></div>
      <div><dt>固蛊符</dt><dd>${store.guWard | 0}</dd></div>
      <div><dt>蛊胎</dt><dd>${store.guEmbryo | 0}</dd></div>
      <div><dt>残核</dt><dd>${store.bossCores | 0}</dd></div>
      <div><dt>材料</dt><dd>${matTotal}</dd></div>
    </dl>
    <p><span>孵化路线：基础／道脉</span><br><span>品质：次品／精品（精品炉率 +8%）</span><br><span>炼成蛊格：六神 · 七皇 · 八九祖</span><br>六转起另耗残核与蛊胎</p>
  </aside>`;
  return `<section class="gulu-forge-workbench" aria-label="九转鼎炼蛊台">
    ${rulesBoard}
    <div class="gulu-forge-orbit">
      <ol class="gulu-forge-recipes" aria-label="九转炉方">${recipeRows}</ol>
      <div class="gulu-forge-stage" aria-live="polite" aria-busy="false">
        <i class="gulu-forge-ingredient ingredient-one" aria-hidden="true">蛊</i>
        <i class="gulu-forge-ingredient ingredient-two" aria-hidden="true">砂</i>
        <i class="gulu-forge-ingredient ingredient-three" aria-hidden="true">核</i>
        <i class="gulu-forge-ingredient ingredient-four" aria-hidden="true">符</i>
        <span class="gulu-forge-aura" aria-hidden="true"></span>
        <img src="assets/ui/nine-turn-cauldron.webp" alt="炉火翻涌的九转鼎">
        <span class="gulu-forge-stage-kicker">鼎火待命</span>
        <strong class="gulu-forge-stage-status" data-detail="选择下方成蛊入炉">择蛊入炉</strong>
      </div>
    </div>
    ${stockBoard}
    <section class="gulu-forge-target-ring">
      <h3>择蛊入炉 <small>同名同转作燃料 · 随行蛊不入炉</small></h3>
      <div class="gulu-forge-grid">${cards || "<p class=\"gulu-tip\">蛊圃暂无成蛊，破壳后再来。</p>"}</div>
    </section>
  </section>`;
}
function renderGuluOverview(store) {
  const cap = getGuluSlotCap();
  const visible = store.slots.slice(0, cap);
  const openPlots = visible.filter((slot) => !slot).length;
  const hatching = visible.filter((slot) => slot?.state === "egg").length;
  const mature = visible.filter((slot) => slot?.state === "gu").length;
  const carried = visible.filter((slot) => slot?.state === "gu" && slot.carry).length;
  return `<section class="gulu-overview" aria-label="蛊庐总览">
    <div><span>空圃</span><strong>${openPlots}</strong><small>可落卵</small></div>
    <div><span>孵化</span><strong>${hatching}</strong><small>等待破壳</small></div>
    <div><span>成蛊</span><strong>${mature}</strong><small>当前在庐</small></div>
    <div><span>随行</span><strong>${carried}/${getCarryMaxNow()}</strong><small>带入命途</small></div>
  </section>`;
}
function renderBaigushiDescription(text) {
  return `<details class="baigushi-description"><summary>查看说明</summary><p>${text}</p></details>`;
}
function renderBaigushi(store) {
  const scripNow = normalizeRedeemOwnedAmount(store.market.scrip);
  const dailyStock = getBaigushiDailyStock(store);
  const dailyGoods = getBaigushiDailyGoods(store);
  const ecologyDaily = getBaigushiEcologyDaily(store);
  const now = guluNow();
  const dateKey = guluTodayKey();
  const rewardedRestock = guluRewardedAdReady()
    ? listRewardedBaigushiRestockGoods(store, dateKey, dailyGoods)[0]
    : null;
  const rewardedRestockButton = rewardedRestock
    ? `<button type="button" class="gulu-rewarded-btn baigushi-quick-card" data-baigushi-rewarded-restock="${escGu(rewardedRestock.id)}"><span aria-hidden="true">补</span><strong>看广告 · 补货</strong><small>「${escGu(rewardedRestock.name)}」×1</small></button>`
    : "";
  /* V0.9.51 用户定调「这么多材料不能都显示」：只列持有量 >0 的，0 的不占位（此前 9 种恒显、多半是 ×0 噪音）。
   * 一件都没有时给一句提示，不留空白。 */
  const ownedMats = MATERIAL_IDS.filter((id) => normalizeRedeemOwnedAmount(store.materials[id]) > 0)
    .map((id) => `<span class="gulu-mat tone-${MATERIALS[id].tone || "jade"}"><b>${MATERIALS[id].glyph}</b>${MATERIALS[id].name}<i>×${normalizeRedeemOwnedAmount(store.materials[id])}</i></span>`).join("")
    + ECOLOGY_MATERIAL_IDS.filter((id) => normalizeRedeemOwnedAmount(store.ecologyMaterials[id]) > 0)
      .map((id) => `<span class="gulu-mat tone-${ECOLOGY_MATERIALS[id].tone || "jade"}"><b>${ECOLOGY_MATERIALS[id].glyph}</b>${ECOLOGY_MATERIALS[id].name}<i>×${normalizeRedeemOwnedAmount(store.ecologyMaterials[id])}</i></span>`).join("")
    + (normalizeRedeemOwnedAmount(store.bossCores) > 0 ? `<span class="gulu-mat tone-boss"><b>核</b>蛊母残核<i>×${normalizeRedeemOwnedAmount(store.bossCores)}</i></span>` : "");
  const resources = ownedMats || `<span class="gulu-mat-empty">尚无资材——通关带出或在此购入。</span>`;
  const materialShelf = MATERIAL_IDS.map((id) => {
    const price = BAIGUSHI_MATERIAL_PRICES[id];
    const left = dailyStock[id] | 0;
    const affordable = scripNow >= price;
    return `<article class="baigushi-material tone-${MATERIALS[id].tone || "jade"}">
      <span aria-hidden="true">${MATERIALS[id].glyph}</span>
      <div><strong>${MATERIALS[id].name}</strong><small>今日余 ${left}/3</small></div>
      <button type="button" data-baigushi-material="${id}" ${left > 0 && affordable ? "" : "disabled"}>${left <= 0 ? "售罄" : (affordable ? `${price} 蛊钱` : "蛊钱不足")}</button>
    </article>`;
  }).join("");
  const ecologyShelf = ecologyDaily.ids.map((id) => {
    const material = ECOLOGY_MATERIALS[id];
    const left = ecologyDaily.stock[id] | 0;
    const affordable = scripNow >= ECOLOGY_MARKET_GOOD.price;
    return `<article class="baigushi-material tone-${material.tone || "jade"}"><span aria-hidden="true">${material.glyph}</span><div><strong>${material.name}×${ECOLOGY_MARKET_GOOD.count}</strong><small>生态行脚 · 今日余 ${left}/1</small></div><button type="button" data-baigushi-ecology-material="${id}" ${left > 0 && affordable ? "" : "disabled"}>${left <= 0 ? "售罄" : (affordable ? `${ECOLOGY_MARKET_GOOD.price} 蛊钱` : "蛊钱不足")}</button></article>`;
  }).join("");
  const ecologyRecipes = Object.keys(ECOLOGY_RECIPE_COSTS).map((cardKey) => {
    const recipe = ECOLOGY_RECIPE_COSTS[cardKey];
    const card = CARD_LIBRARY[cardKey];
    const affordable = normalizeRedeemOwnedAmount(store.ecologyMaterials[recipe.ecology]) >= 2 && normalizeRedeemOwnedAmount(store.materials[recipe.core]) >= 4 && scripNow >= ECOLOGY_RECIPE_SCRIP_COST;
    const hasPlot = store.slots.some((slot, index) => index < getGuluSlotCap() && !slot);
    return `<article class="baigushi-recipe tone-jade"><span class="baigushi-glyph" aria-hidden="true">${card.glyph}</span><div><h4>${card.name}定向卵</h4><strong>${ECOLOGY_MATERIALS[recipe.ecology].name}×2 · ${MATERIALS[recipe.core].name}×4</strong>${renderBaigushiDescription(stripTags(getCardEffect(cardKey, 0)))}<small>蛊钱 ${ECOLOGY_RECIPE_SCRIP_COST} · 生态定向破壳</small></div><button type="button" data-baigushi-ecology-recipe="${cardKey}" ${affordable && hasPlot ? "" : "disabled"}>${hasPlot ? (affordable ? "落卵此方" : "资材不足") : "蛊圃已满"}</button></article>`;
  }).join("");
  const recipes = Object.entries(BAIGUSHI_RECIPES).map(([id, recipe]) => {
    const card = CARD_LIBRARY[recipe.cardKey];
    const canAfford = canPayBaigushiMaterials(store, recipe.cost) && scripNow >= BAIGUSHI_RECIPE_SCRIP_COST;
    const hasPlot = store.slots.some((slot, i) => i < getGuluSlotCap() && !slot);
    return `<article class="baigushi-recipe tone-${recipe.tone}">
      <span class="baigushi-glyph" aria-hidden="true">${recipe.glyph}</span>
      <div><h4>${recipe.name}</h4><strong>基础·精品·${card?.name || recipe.cardKey}</strong>
      ${renderBaigushiDescription(card ? stripTags(getCardEffect(recipe.cardKey, GULU_GRADES[recipe.grade]?.upgrade || 0)) : "蛊性未明")}
      <small>${formatBaigushiCost(recipe.cost)} · 蛊钱 ${BAIGUSHI_RECIPE_SCRIP_COST} · 10 分钟定向破壳</small></div>
      <button type="button" data-baigushi-recipe="${id}" ${canAfford && hasPlot ? "" : "disabled"}>${hasPlot ? (canAfford ? "落卵此方" : "材料不足") : "蛊圃已满"}</button>
    </article>`;
  }).join("");
  const wardCount = store.market.deathWard | 0;
  const wardAffordable = canPayBaigushiMaterials(store, BAIGUSHI_WARD_COST.materials)
    && normalizeRedeemOwnedAmount(store.bossCores) >= BAIGUSHI_WARD_COST.bossCores
    && scripNow >= BAIGUSHI_WARD_SCRIP_COST;
  const featuredCard = CARD_LIBRARY[dailyGoods.featuredCardKey];
  const featuredGood = BAIGUSHI_MISC_GOODS.featuredEgg;
  const featuredLeft = dailyGoods.stock.featuredEgg | 0;
  const hasPlot = store.slots.some((slot, index) => index < getGuluSlotCap() && !slot);
  const featuredEgg = `<article class="baigushi-featured">
    <span class="baigushi-glyph" aria-hidden="true">${featuredCard?.glyph || "卵"}</span>
    <div><h4>今日轮换蛊卵</h4><strong>基础·精品·${featuredCard?.name || "待定蛊虫"}</strong>
    ${renderBaigushiDescription(featuredCard ? stripTags(getCardEffect(dailyGoods.featuredCardKey, GULU_GRADES.ling.upgrade)) : "市册正在重排。")}
    <small>10 分钟定向破壳 · 今日余 ${featuredLeft}/1 · 蛊钱 ${featuredGood.price}</small></div>
    <button type="button" data-baigushi-featured-egg="1" ${featuredLeft > 0 && hasPlot && scripNow >= featuredGood.price ? "" : "disabled"}>${featuredLeft <= 0 ? "今日售罄" : (!hasPlot ? "蛊圃已满" : (scripNow >= featuredGood.price ? "购入轮换卵" : "蛊钱不足"))}</button>
  </article>`;
  const insectStall = `<section class="baigushi-stall-panel" data-market-panel="insects">
    <h3>灵虫铺 <small>轮换蛊卵与五份定向明方</small></h3>
    ${featuredEgg}
    <h3>栖地定向卵 <small>异材 2 + 匹配炉材 4 + 蛊钱 4</small></h3>
    <div class="baigushi-grid">${ecologyRecipes}</div>
    <div class="baigushi-grid">${recipes}</div>
  </section>`;
  const materialStall = `<section class="baigushi-stall-panel" data-market-panel="materials">
    <h3>炉材摊 <small>每日每种限购 3 份 · 本地零时补货</small></h3>
    <div class="baigushi-material-shelf">${materialShelf}</div>
    <h3>生态行脚 <small>每日轮换 2 种 · 每份含 2 件</small></h3>
    <div class="baigushi-material-shelf">${ecologyShelf}</div>
  </section>`;
  const salveGood = BAIGUSHI_MISC_GOODS.healingSalve;
  const salveLeft = dailyGoods.stock.healingSalve | 0;
  const crateGood = BAIGUSHI_MISC_GOODS.materialCrate;
  const crateLeft = dailyGoods.stock.materialCrate | 0;
  const gradeGood = BAIGUSHI_MISC_GOODS.gradeSeal;
  const gradeLeft = dailyGoods.stock.gradeSeal | 0;
  const gradeTargets = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "egg" && getNextGuluGrade(slot.grade))
    .map(({ slot, index }) => `<button type="button" data-baigushi-grade-egg="${escGu(slot.id)}" ${gradeLeft > 0 && scripNow >= gradeGood.price ? "" : "disabled"}>第 ${index + 1} 圃升阶</button>`).join("") || '<button type="button" disabled>暂无可升阶蛊卵</button>';
  const marrowGood = BAIGUSHI_MISC_GOODS.marrowJade;
  const marrowLeft = dailyGoods.stock.marrowJade | 0;
  const marrowTargets = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "gu" && getBaigushiMarrowReplacement(slot.cardKey))
    .map(({ slot, index }) => `<button type="button" data-baigushi-marrow-gu="${escGu(slot.id)}" ${marrowLeft > 0 && scripNow >= marrowGood.price && !isGuluSourceLocked(slot.id) ? "" : "disabled"}>重结第 ${index + 1} 圃</button>`).join("") || '<button type="button" disabled>暂无可换髓成蛊</button>';
  const daoGood = BAIGUSHI_MISC_GOODS.daoFruit;
  const daoLeft = dailyGoods.stock.daoFruit | 0;
  const embryoGood = BAIGUSHI_MISC_GOODS.guEmbryo;
  const embryoLeft = dailyGoods.stock.guEmbryo | 0;
  const wardGood = BAIGUSHI_MISC_GOODS.guWard;
  const wardLeft = dailyGoods.stock.guWard | 0;
  const selectedBenming = BENMING_GU[progression?.selectedHeroId];
  /* ===== 去重后的批量货品货架 ===== */
  const coreTripleGood = BAIGUSHI_MISC_GOODS.coreCrateTriple;
  const coreTripleLeft = dailyGoods.stock.coreCrateTriple | 0;
  const pouchGood = BAIGUSHI_MISC_GOODS.kindlePouch;
  const pouchLeft = dailyGoods.stock.kindlePouch | 0;
  const twinPairGood = BAIGUSHI_MISC_GOODS.twinMarrowPair;
  const twinPairLeft = dailyGoods.stock.twinMarrowPair | 0;
  const emptyPlots = store.slots.reduce((n, slot, index) => n + (index < getGuluSlotCap() && !slot ? 1 : 0), 0);
  const twinPairTargets = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "gu")
    .map(({ slot, index }) => `<button type="button" data-baigushi-twin-pair="${escGu(slot.id)}" ${twinPairLeft > 0 && emptyPlots >= (twinPairGood.count | 0) && scripNow >= twinPairGood.price ? "" : "disabled"}>取第 ${index + 1} 圃双生</button>`).join("")
    || `<button type="button" disabled>暂无成蛊</button>`;
  const bundleGood = BAIGUSHI_MISC_GOODS.materialBundle;
  const bundleLeft = dailyGoods.stock.materialBundle | 0;
  const bundleTargets = MATERIAL_IDS.map((id) => `<button type="button" data-baigushi-bundle-material="${id}" ${bundleLeft > 0 && scripNow >= bundleGood.price ? "" : "disabled"}>${MATERIALS[id].glyph}·${MATERIALS[id].name}</button>`).join("");
  const breakerGood = BAIGUSHI_MISC_GOODS.hatchBreaker;
  const breakerLeft = dailyGoods.stock.hatchBreaker | 0;
  const breakerTargets = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "egg" && (Number(slot.hatchAt) || 0) > now)
    .map(({ slot, index }) => `<button type="button" data-baigushi-hatch-breaker="${escGu(slot.id)}" ${breakerLeft > 0 && scripNow >= breakerGood.price ? "" : "disabled"}>凿第 ${index + 1} 圃</button>`).join("")
    || `<button type="button" disabled>暂无未破壳的卵</button>`;
  const curiosStall = `<section class="baigushi-stall-panel" data-market-panel="curios">
    <h3>奇物行 <small>蛊钱只由活着闯关所得 · 每日限量</small></h3>
    <div class="baigushi-curio-grid">
      <article class="baigushi-curio"><span>散</span><div><h4>养伤散</h4>${renderBaigushiDescription("立即解除本命蛊的静养状态。")}<small>今日余 ${salveLeft}/1 · 蛊钱 ${salveGood.price}</small></div><button type="button" data-baigushi-healing-salve="1" ${salveLeft > 0 && store.injuryUntil > now && scripNow >= salveGood.price ? "" : "disabled"}>${store.injuryUntil > now ? (salveLeft > 0 ? (scripNow >= salveGood.price ? "立即养伤" : "蛊钱不足") : "今日售罄") : "无需静养"}</button></article>
      <article class="baigushi-curio"><span>匣</span><div><h4>炉材匣</h4>${renderBaigushiDescription(`${formatBaigushiCost(crateGood.contents)}。`)}<small>今日余 ${crateLeft}/1 · 蛊钱 ${crateGood.price}</small></div><button type="button" data-baigushi-material-crate="1" ${crateLeft > 0 && scripNow >= crateGood.price ? "" : "disabled"}>${crateLeft <= 0 ? "今日售罄" : (scripNow >= crateGood.price ? "购入炉材匣" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio"><span>质</span><div><h4>凝质符</h4>${renderBaigushiDescription("指定未破壳的次品蛊卵提升为同路线精品；不会跨到另一条孵化路线。")}<small>今日余 ${gradeLeft}/1 · 蛊钱 ${gradeGood.price}</small></div><div class="baigushi-curio-actions">${gradeTargets}</div></article>
      <article class="baigushi-curio"><span>髓</span><div><h4>换髓玉</h4>${renderBaigushiDescription("指定成蛊保留路线与品质重新结卵，换成另一只通用蛊。")}<small>今日余 ${marrowLeft}/1 · 蛊钱 ${marrowGood.price}</small></div><div class="baigushi-curio-actions">${marrowTargets}</div></article>
      <article class="baigushi-curio"><span>道</span><div><h4>本命道果</h4>${renderBaigushiDescription(`${selectedBenming?.name || "当前本命蛊"}吞服后，道行立即 +${daoGood.dao}。`)}<small>今日余 ${daoLeft}/1 · 蛊钱 ${daoGood.price}</small></div><button type="button" data-baigushi-dao-fruit="1" ${daoLeft > 0 && selectedBenming && scripNow >= daoGood.price ? "" : "disabled"}>${daoLeft <= 0 ? "今日售罄" : (scripNow >= daoGood.price ? "吞服道果" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio"><span>胎</span><div><h4>蛊胎</h4>${renderBaigushiDescription(`九转鼎六转以上炉方的必需之物。现存 ${normalizeRedeemOwnedAmount(store.guEmbryo)} 枚。`)}<small>今日余 ${embryoLeft}/1 · 蛊钱 ${embryoGood.price}</small></div><button type="button" data-baigushi-forge-supply="guEmbryo" ${embryoLeft > 0 && scripNow >= embryoGood.price ? "" : "disabled"}>${embryoLeft <= 0 ? "今日售罄" : (scripNow >= embryoGood.price ? "购入蛊胎" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio"><span>固</span><div><h4>固蛊符</h4>${renderBaigushiDescription(`高转合炼失败时自动碎裂，返还本炉消耗的蛊母残核与蛊胎；不提高成功率。现存 ${normalizeRedeemOwnedAmount(store.guWard)} 张。`)}<small>今日余 ${wardLeft}/1 · 蛊钱 ${wardGood.price}</small></div><button type="button" data-baigushi-forge-supply="guWard" ${wardLeft > 0 && scripNow >= wardGood.price ? "" : "disabled"}>${wardLeft <= 0 ? "今日售罄" : (scripNow >= wardGood.price ? "购入固蛊符" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio"><span>匣</span><div><h4>残核匣 · 三枚装</h4>${renderBaigushiDescription(`一次得蛊母残核 ${coreTripleGood.count} 枚。九转全程要 11 枚，这是主要来源。现存 ${store.bossCores | 0} 枚。`)}<small>今日余 ${coreTripleLeft}/${coreTripleGood.dailyStock} · 蛊钱 ${coreTripleGood.price}</small></div><button type="button" data-baigushi-core-triple="1" ${coreTripleLeft > 0 && scripNow >= coreTripleGood.price ? "" : "disabled"}>${coreTripleLeft <= 0 ? "今日售罄" : (scripNow >= coreTripleGood.price ? "购入三枚" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio"><span>囊</span><div><h4>砂囊</h4>${renderBaigushiDescription(`一次得引火砂 ${pouchGood.count} 份；每份可使一次入炉成功率 +${FORGE_KINDLE_BONUS}。现存 ${store.kindleSand | 0} 份。`)}<small>今日余 ${pouchLeft}/${pouchGood.dailyStock} · 蛊钱 ${pouchGood.price}</small></div><button type="button" data-baigushi-forge-supply="kindlePouch" ${pouchLeft > 0 && scripNow >= pouchGood.price ? "" : "disabled"}>${pouchLeft <= 0 ? "今日售罄" : (scripNow >= pouchGood.price ? "购入砂囊" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio"><span>对</span><div><h4>双生对髓</h4>${renderBaigushiDescription(`照指定成蛊一次结 ${twinPairGood.count} 枚同名三转之卵；只取蛊种，不复制样本转数。需 ${twinPairGood.count} 个空圃，当前空 ${emptyPlots} 个。`)}<small>今日余 ${twinPairLeft}/${twinPairGood.dailyStock} · 蛊钱 ${twinPairGood.price}</small></div><div class="baigushi-curio-actions">${twinPairTargets}</div></article>
      <article class="baigushi-curio"><span>草</span><div><h4>百草囊</h4>${renderBaigushiDescription(`自选一种炼蛊材料，一次得 ${bundleGood.count} 份。基础材与道脉材分别结算，不能跨组替代。`)}<small>今日余 ${bundleLeft}/${bundleGood.dailyStock} · 蛊钱 ${bundleGood.price}</small></div><div class="baigushi-curio-actions">${bundleTargets}</div></article>
      <article class="baigushi-curio"><span>锥</span><div><h4>破壳锥</h4>${renderBaigushiDescription("凿开指定蛊卵，立即破壳，不必再等。与看广告破壳各自独立、互不占用次数。")}<small>今日余 ${breakerLeft}/${breakerGood.dailyStock} · 蛊钱 ${breakerGood.price}</small></div><div class="baigushi-curio-actions">${breakerTargets}</div></article>
    </div>
  </section>`;
  const wardStall = `<section class="baigushi-stall-panel" data-market-panel="ward">
    <h3>护命柜 <small>保全稀有随行蛊，不提供永久数值成长</small></h3>
    <section class="baigushi-ward ${wardCount ? "is-owned" : ""}">
      <span class="baigushi-glyph" aria-hidden="true">匣</span>
      <div><h4>护命蛊匣 <em>${wardCount}/${BAIGUSHI_WARD_MAX}</em></h4>
      ${renderBaigushiDescription("下次真实陨落时，若有道脉蛊随行，自动保全其中一只；没有道脉蛊时绝不浪费。")}
      <small>${formatBaigushiCost(BAIGUSHI_WARD_COST.materials)}、蛊母残核×${BAIGUSHI_WARD_COST.bossCores}、蛊钱 ${BAIGUSHI_WARD_SCRIP_COST}</small></div>
      <button type="button" data-baigushi-ward="1" ${wardCount < BAIGUSHI_WARD_MAX && wardAffordable ? "" : "disabled"}>${wardCount >= BAIGUSHI_WARD_MAX ? "已达上限" : (wardAffordable ? "换取蛊匣" : "资材不足")}</button>
    </section>
  </section>`;
  /* V0.9.57 印记阁：把通关印与天印这类【已经拿到手却毫无用处】的成就折成蛊钱。
   * 每枚只兑一次，兑过的仍留在列表里显示「已兑」，让玩家看得见自己的成就墙而不是凭空消失。 */
  const sealOffers = listAllSealScripOffers(store);
  const sealPending = sealOffers.filter((o) => !o.claimed);
  const sealRows = sealOffers.length
    ? sealOffers.map((o) => `<article class="baigushi-seal-row${o.claimed ? " is-claimed" : ""}">
        <span class="baigushi-seal-glyph" aria-hidden="true">${o.kind === "tian" ? "天" : SEAL_SCRIP_LABELS[o.kind].slice(0, 1)}</span>
        <div><h4>${escGu(o.label)}</h4><p>${o.kind === "tian"
          ? (o.claimed ? `第 ${o.tier} 重已全数折算，再登高一重可继续兑换。` : `未折算 ${o.pendingTiers} 重，每重 ${TIAN_SEAL_SCRIP_PER_TIER} 蛊钱。`)
          : (o.claimed ? "此印已折算过，成就永久保留。" : `此印可折 ${o.scrip} 蛊钱，仅此一次。`)}</p></div>
        <button type="button" data-baigushi-seal="${escGu(o.id)}" ${o.claimed ? "disabled" : ""}>${o.claimed ? "已兑换" : `兑 ${o.scrip} 蛊钱`}</button>
      </article>`).join("")
    : `<p class="empty-inventory">尚无可折算的印记。通关任意路线得铜印、精英通关得银印、十重天每登一重得天印。</p>`;
  const sealStall = `<section class="baigushi-stall-panel" data-market-panel="seals">
    <h3>印记阁 <small>成就折蛊钱 · 每枚只可兑一次${sealPending.length ? ` · 待兑 ${sealPending.length} 枚` : ""}</small></h3>
    <div class="baigushi-seal-list">${sealRows}</div>
  </section>`;
  const stallPanels = { insects: insectStall, materials: materialStall, curios: curiosStall, ward: wardStall, seals: sealStall };
  if (!stallPanels[guluMarketStall]) guluMarketStall = "insects";
  const stallNav = [["insects", "灵虫铺"], ["materials", "炉材摊"], ["curios", "奇物行"], ["ward", "护命柜"], ["seals", "印记阁"]]
    .map(([id, label]) => `<button type="button" class="${guluMarketStall === id ? "is-active" : ""}" data-baigushi-stall="${id}" aria-pressed="${guluMarketStall === id}">${label}</button>`).join("");
  const rewardedScripButton = (guluRewardedAdReady() && canClaimRewardedScrip(store, store.market))
    ? `<button type="button" class="gulu-rewarded-btn baigushi-quick-card" data-baigushi-rewarded-scrip="1"><span aria-hidden="true">契</span><strong>看广告 · 领 6 蛊钱</strong><small>完整观看后发放</small></button>`
    : "";
  return `<section class="baigushi-shell">
    <header class="baigushi-header"><div><small>塔外夜市 · 明价易物</small><p>蛊钱只在塔外流通。活着离塔时，每余 5 蛊石可换 1 蛊钱，每局至多换 12 枚。</p></div><span aria-hidden="true">市</span></header>
    <section class="gulu-sec baigushi-wallet"><h3><img class="gu-coin-icon" src="assets/icons/gu-coin.svg" alt="">蛊钱与资材 <small>蛊钱 ${scripNow} · 不可带入命途</small><button type="button" class="baigushi-redeem-open" data-baigushi-redeem-open="1">兑换码</button></h3>${renderGuluRewardedAdNotice()}<div class="baigushi-quick-grid">${rewardedScripButton}${rewardedRestockButton}</div><div class="gulu-mats">${resources}</div></section>
    <nav class="baigushi-stall-nav" aria-label="百蛊市摊位">${stallNav}</nav>
    ${stallPanels[guluMarketStall]}
    <div class="baigushi-redeem-dialog${guluRedeemOpen ? "" : " hidden"}" role="dialog" aria-modal="true" aria-labelledby="baigushiRedeemTitle">
      <button type="button" class="baigushi-redeem-backdrop" data-baigushi-redeem-close="1" aria-label="关闭兑换码弹窗"></button>
      <section class="baigushi-redeem-card">
        <header><div><small>百蛊市 · 暗契验印</small><h3 id="baigushiRedeemTitle">兑换码</h3></div><button type="button" class="baigushi-redeem-close" data-baigushi-redeem-close="1" aria-label="关闭">×</button></header>
        <p>输入有效暗契，所得蛊钱、炼材或补发蛊会直接收入蛊庐。</p>
        <div class="baigushi-redeem"><input id="baigushiRedeemInput" type="text" inputmode="latin" autocomplete="off" maxlength="16384" placeholder="输入兑换码（NMG / NMG2 / NMG3 / NMG4 / NMG5）" aria-label="兑换码"><button type="button" data-baigushi-redeem="1">兑换</button></div>
      </section>
    </div>
  </section>`;
}
function renderGuluCollection(store) {
  const entries = Object.values(store.collection || {}).sort((a, b) => {
    const rankDiff = (GULU_GRADES[b.highestGrade]?.rank || 0) - (GULU_GRADES[a.highestGrade]?.rank || 0);
    return rankDiff || String(CARD_LIBRARY[a.cardKey]?.name || a.cardKey).localeCompare(String(CARD_LIBRARY[b.cardKey]?.name || b.cardKey), "zh-CN");
  });
  const shown = entries.filter((entry) => {
    const counts = getGuluCollectionCurrentCounts(store, entry.cardKey);
    if (guluCollectionFilter === "present") return counts.inGulu > 0;
    if (guluCollectionFilter === "carried") return counts.carried > 0;
    if (guluCollectionFilter === "fed") return (entry.fedCount | 0) > 0;
    if (guluCollectionFilter === "released") return (entry.releasedCount | 0) > 0;
    return true;
  });
  const filters = [["all", "全部"], ["present", "当前在庐"], ["carried", "随行"], ["fed", "已投喂"], ["released", "已归野"]]
    .map(([id, label]) => `<button type="button" class="gulu-collection-filter${guluCollectionFilter === id ? " is-active" : ""}" data-gulu-collection-filter="${id}">${label}</button>`).join("");
  const cards = shown.map((entry) => {
    const card = CARD_LIBRARY[entry.cardKey];
    const counts = getGuluCollectionCurrentCounts(store, entry.cardKey);
    const grade = GULU_GRADES[entry.highestGrade] || GULU_GRADES.fan;
    const art = getGuluCardArt(entry.cardKey);
    const combatTone = typeof getGuCombatTone === "function" ? getGuCombatTone({ ...(card || {}), stage: entry.fusionCount > 0 ? "合练异蛊" : "" }) : "support";
    return `<button type="button" class="gulu-collection-item tone-${combatTone}" data-gulu-codex="${escGu(entry.cardKey)}">
      <span class="gulu-collection-art">${art ? `<img src="${art}" alt="" loading="lazy" decoding="async">` : `<i>${escGu(card?.glyph || "蛊")}</i>`}</span>
      <span class="gulu-collection-copy"><strong>${escGu(card?.name || entry.cardKey)}</strong><small>最高 ${getGuluGradeDisplayName(entry.highestGrade)} · 累计孵化 ${entry.hatchedCount | 0} · 合练所得 ${entry.fusionCount | 0}${(entry.giftedCount | 0) > 0 ? ` · 补发所得 ${entry.giftedCount | 0}` : ""}</small>
      <small>在庐 ${counts.inGulu} · 随行 ${counts.carried} · 已投喂 ${entry.fedCount | 0} · 已归野 ${entry.releasedCount | 0}</small>
      <em>${entry.legacyBackfill ? "旧档现存蛊已安全补录 · 自本版起收录" : `首次收录 ${new Date(entry.firstRecordedAt || 0).toLocaleDateString()} · ${entry.firstRecordedVersion || GULU_COLLECTION_BUILD}`}</em></span>
    </button>`;
  }).join("");
  return `<section class="gulu-collection"><header><div><h3>蛊庐藏册</h3><p>只记亲手孵化与养成；蛊虫来历、战斗效果仍查万蛊录。</p></div><span>已收录 ${entries.length}</span></header>
    <div class="gulu-collection-filters">${filters}</div>
    <div class="gulu-collection-grid">${cards || '<div class="gulu-collection-empty"><b>藏册尚空</b><span>蛊卵破壳后会在此留下第一笔记录。</span></div>'}</div>
  </section>`;
}
function getGuluScrollContainer() {
  if (!dom.guluBody) return null;
  const nested = typeof dom.guluBody.querySelectorAll === "function"
    ? Array.from(dom.guluBody.querySelectorAll(".gulu-main, .baigushi-shell, .gulu-collection"))
      .find((candidate) => candidate.scrollHeight > candidate.clientHeight)
    : null;
  return nested && nested.scrollHeight > nested.clientHeight ? nested : dom.guluBody;
}
function restoreGuluScroll(scrollTop) {
  if (!(scrollTop > 0)) return;
  const apply = () => {
    const target = getGuluScrollContainer();
    if (!target) return;
    target.scrollTop = Math.min(scrollTop, Math.max(0, target.scrollHeight - target.clientHeight));
  };
  apply();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
  }
  window.setTimeout(apply, 0);
  // 字体/图片在重渲染后才撑开高度；过早按当时的短页面上限裁剪，会只恢复到几十像素。
  window.setTimeout(apply, 320);
}
function renderGulu({ preserveScroll = true } = {}) {
  if (!dom.guluBody) return;
  scheduleGuluNoticeDismissal();
  const previousScrollTop = preserveScroll ? (getGuluScrollContainer()?.scrollTop || 0) : 0;
  const previousRecipeOverlay = dom.guluBody.querySelector?.("[data-gulu-recipes-overlay]") || null;
  const previousRecipeFilter = previousRecipeOverlay?.querySelector('[data-gulu-recipes-filter][aria-pressed="true"]')?.dataset.guluRecipesFilter || "all";
  const previousRecipeState = {
    open: Boolean(previousRecipeOverlay && !previousRecipeOverlay.classList.contains("hidden")),
    filter: previousRecipeFilter,
    scrollTop: previousRecipeOverlay?.querySelector(".gulu-recipe-scroll")?.scrollTop || 0,
  };
  const previousPoolPreviewOpen = Boolean(dom.guluBody.querySelector?.("[data-gulu-pool-preview-overlay]:not(.hidden)"));
  const setGuluMarkup = (markup) => {
    if (document.activeElement && dom.guluBody.contains(document.activeElement)
      && typeof document.activeElement.blur === "function") document.activeElement.blur();
    dom.guluBody.innerHTML = markup;
    if (previousRecipeState.open) {
      const overlay = dom.guluBody.querySelector?.("[data-gulu-recipes-overlay]") || null;
      const trigger = dom.guluBody.querySelector?.("[data-gulu-recipes-open]") || null;
      if (overlay) {
        overlay.classList.remove("hidden");
        trigger?.setAttribute("aria-expanded", "true");
        overlay.querySelectorAll("[data-gulu-recipes-filter]").forEach((button) => {
          button.setAttribute("aria-pressed", String((button.dataset.guluRecipesFilter || "all") === previousRecipeState.filter));
        });
        overlay.querySelectorAll("[data-gulu-recipe-role]").forEach((row) => {
          row.classList.toggle("hidden", previousRecipeState.filter !== "all" && row.dataset.guluRecipeRole !== previousRecipeState.filter);
        });
        const recipeScroll = overlay.querySelector(".gulu-recipe-scroll");
        if (recipeScroll) window.requestAnimationFrame(() => { recipeScroll.scrollTop = previousRecipeState.scrollTop; });
      }
    }
    if (previousPoolPreviewOpen) {
      const poolOverlay = dom.guluBody.querySelector?.("[data-gulu-pool-preview-overlay]") || null;
      const poolTrigger = dom.guluBody.querySelector?.("[data-gulu-pool-preview-open]") || null;
      poolOverlay?.classList.remove("hidden");
      poolTrigger?.setAttribute("aria-expanded", "true");
    }
    restoreGuluScroll(previousScrollTop);
  };
  dom.guluBody.classList.toggle("is-forge-view", guluActiveTab === "forge");
  dom.guluBody.classList.toggle("is-fusion-view", guluActiveTab === "fusion");
  dom.guluBody.classList.toggle("is-market-view", guluActiveTab === "market");
  dom.guluBody.classList.toggle("is-nurture-view", guluActiveTab === "nurture");
  guluRenaming = false; // 整体重渲染必然作废就地输入框——顺手清标志，防其卡 true 冻结 30s 自动刷新
  const receiptBefore = captureOutgameInventory(getGuluStore());
  const news = settleGuluTime();
  if (news.length) showOutgameReceiptFromChange(receiptBefore, getGuluStore(), { source: "蛊圃", title: "蛊卵破壳", summary: news.join("\n") });
  const s = getGuluStore();
  const now = guluNow();
  if (guluActiveTab === "collection") {
    setGuluMarkup(renderGuluTabs() + renderGuluCollection(s));
    if (s.collectionUnread.length) { s.collectionUnread = []; saveGuluStore(); }
    if (typeof refreshCollectionHubBadges === "function") refreshCollectionHubBadges();
    return;
  }
  if (guluActiveTab === "nurture") {
    // V0.9.57：进养蛊室先结灵泉——离线产出在这里补上，与孵化同一口径
    const gained = settleNurtureSpring(s, now);
    if (gained > 0) { saveGuluStore(); guluPushEvent(s, `灵泉凝出元髓露 ${gained} 滴。`); }
    setGuluMarkup(renderGuluTabs()
      + (guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : "")
      + renderGuluNurture(s, now));
    return;
  }
  if (guluActiveTab === "forge") {
    setGuluMarkup(renderGuluTabs()
      + (guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : "")
      + renderGuluForge(s));
    return;
  }
  if (guluActiveTab === "fusion") {
    setGuluMarkup(renderGuluTabs()
      + (guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : "")
      + renderGuluFusionAltar(s));
    return;
  }
  if (guluActiveTab === "market") {
    setGuluMarkup((guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : "")
      + renderBaigushi(s));
    return;
  }
  const heroId = progression.selectedHeroId;
  const heroGu = BENMING_GU[heroId];
  const bi = getBenmingStageInfo(heroId);
  const injured = s.injuryUntil && now < s.injuryUntil;
  const currentRunHero = typeof runState !== "undefined" && runState?.heroId === heroId;
  const legacyBenmingRun = currentRunHero && isLegacyBenmingRun(runState);
  const altarPathId = currentRunHero
    ? getRunBenmingPath(runState)
    : getBenmingPathDefinition(heroId, progression.selectedBenmingPath)?.id;
  const carriedCount = s.slots.filter((g) => g && g.state === "gu" && g.carry).length;
  const slotCap = getGuluSlotCap(); // V0.9.35 辟圃：可用圃数（3 或 4）
  const signState = getSignState(); // V0.9.35 归庐日课
  const signBtn = signState.signedToday
    ? `<button type="button" class="gulu-sign-btn is-done" disabled>今日已点卯</button>`
    : `<button type="button" class="gulu-sign-btn" data-gulu-sign="1">点卯 · 领日课（${signState.nextCount} 份材料）</button>`;
  const signDateKey = guluTodayKey();
  const signFingerprint = fingerprintGuluSignReward(s.sign.lastGained);
  const signRewardedBtn = guluRewardedAdReady() && canClaimRewardedSign(s, signDateKey, signFingerprint)
    ? `<button type="button" class="gulu-rewarded-btn" data-gulu-rewarded-sign="1"><strong>看广告 · 日课材料再领</strong></button>`
    : "";
  const signDots = Array.from({ length: SIGN_CYCLE }, (_, k) => `<i class="gulu-sign-dot${k === SIGN_CYCLE - 1 ? " is-mile" : ""}${(!signState.signedToday && k === signState.nextIdx) ? " is-next" : ""}">${SIGN_REWARDS[k]}</i>`).join("");
  const signSection = `<section class="gulu-sec gulu-daily">
    <h3>归庐日课 <small>每日点卯得材料 · 连签 ${signState.displayStreak} 日 · 累计 ${signState.total} 日</small></h3>
    ${renderGuluRewardedAdNotice()}
    <div class="gulu-sign-row"><div class="gulu-sign-dots" title="七日循环，末日更丰">${signDots}</div>${signBtn}${signRewardedBtn}</div>
  </section>`;
  const matChips = MATERIAL_IDS.map((id) => `<span class="gulu-mat tone-${MATERIALS[id].tone || "jade"}"><b>${MATERIALS[id].glyph}</b>${MATERIALS[id].name}<i>×${normalizeRedeemOwnedAmount(s.materials[id])}</i></span>`).join("")
    + `<span class="gulu-mat tone-boss"><b>核</b>蛊母残核<i>×${s.bossCores | 0}</i></span>`;
  const slots = s.slots.map((slot, i) => {
    if (i >= slotCap) {
      // 未辟的圃——占位卡，明示本格自己的解锁条件，不出孵卵按钮（守卫在 guluStartHatch 兜底）
      return `<div class="gulu-slot is-locked"><h4>第 ${i + 1} 圃 · 未辟</h4>
        <div class="gulu-slot-lock"><span class="gulu-lock-glyph" aria-hidden="true">封</span><p>${escGu(getGuluSlotUnlockHint(i))}后<br>辟出第 ${i + 1} 圃</p></div></div>`;
    }
    if (!slot) {
      const buttonsByTrack = { base: [], dao: [] };
      Object.entries(GULU_GRADES).forEach(([gid, g]) => {
        const guidedStarter = isFirstHatchGuideReady(gid);
        const can = guidedStarter || (getGuluHatchMaterialTotal(s, g) >= g.mats && (s.bossCores | 0) >= g.core);
        // V0.9.33 产出透传：把"抽哪个池/破卵带几级/喂本命蛊多少道行"写到按钮上，让玄/天品的价值看得见（回应"天品太废"多为不知其值）
        // V0.9.52：稀有档已并入「本道专属蛊」，按钮上把这件事说清楚——玩家先前完全不知道专属蛊压根抽不到。
        const poolLabel = g.poolLabel || (g.rare ? "高阶蛊池" : "基础蛊池");
        const qualityValue = g.forgeBonus > 0 ? `精品炉性 +${g.forgeBonus}%` : "次品 · 省材速孵";
        const yieldLine = `${poolLabel} · 破卵+${g.upgrade} · ${qualityValue}`;
        const rarePoolNames = g.rare
          ? getGuluHatchPool(g, { heroId: heroId }).map((k) => CARD_LIBRARY[k]?.name).filter(Boolean).join("、")
          : "";
        const costText = getGuluHatchCostText(g);
        const title = `${g.trackName}虫卵·${g.quality}：消耗${costText}。从${poolLabel}${g.rare ? `（${rarePoolNames}）` : "（13 种基础蛊）"}随机破卵；同路线次品与精品的战斗属性、道行收益相同，精品仅使五转后的升转成功率 +${g.forgeBonus}%。`;
        buttonsByTrack[g.track].push(`<button type="button" class="gulu-grade quality-${g.quality === "精品" ? "high" : "low"}${guidedStarter ? " is-guided-starter" : ""}" data-gulu-hatch="${i}:${gid}" title="${escGu(title)}" ${can ? "" : "disabled"}>${g.quality}<small>${guidedStarter ? "新手落卵 · 免费即成" : `${costText} · ${g.timeText}`}</small><small class="gulu-grade-yield">${yieldLine}</small></button>`);
      });
      const btns = `<div class="gulu-hatch-tracks">
        <section class="gulu-hatch-track is-base"><h5>基础虫卵 <small>血砂 · 虫蜕 · 腐液 · 命丝</small></h5><div class="gulu-grades">${buttonsByTrack.base.join("")}</div></section>
        <section class="gulu-hatch-track is-dao"><h5>道脉虫卵 <small>残魂 · 锐骨晶 · 寿烬 · 元髓露</small></h5><div class="gulu-grades">${buttonsByTrack.dao.join("")}</div></section>
      </div>`;
      return `<div class="gulu-slot is-empty"><h4>第 ${i + 1} 圃 · 空土</h4>${btns}</div>`;
    }
    if (slot.state === "egg") {
      const grade = GULU_GRADES[slot.grade];
      const span = Math.max(1, (slot.hatchAt || 0) - (slot.startedAt || 0));
      const soon = slot.startedAt > 0 && (now - slot.startedAt) / span >= 0.9; // 末段 10% 现裂纹（startedAt 缺失的旧档不误判为临孵）
      const hatchAdBtn = guluRewardedAdReady() && canRewardedHatchInstant(s, slot.id, slot, now)
        ? `<button type="button" class="gulu-rewarded-btn" data-gulu-rewarded-hatch="${escGu(slot.id)}"><strong>看广告 · 立即破壳</strong></button>`
        : "";
      return `<div class="gulu-slot is-egg quality-${grade.quality === "精品" ? "high" : "low"}" data-slot-index="${i}"><h4>第 ${i + 1} 圃 · ${getGuluGradeDisplayName(slot.grade)}蛊卵</h4>
        <p class="gulu-egg-glyph${soon ? " is-hatching" : ""}" data-gulu-poke="egg" title="戳一戳">${GULU_GRADE_GLYPHS[slot.grade] || "卵"}</p><p class="gulu-remain">${formatGuluRemain(slot.hatchAt - now)}破壳</p>${hatchAdBtn}</div>`;
    }
    const card = CARD_LIBRARY[slot.cardKey];
    const art = getGuluCardArt(slot.cardKey);
    const displayName = slot.customName || slot.name; // V0.9.28 命名：自定义优先
    const named = !!slot.customName;
    const combatTone = typeof getGuCombatTone === "function" ? getGuCombatTone({ ...(card || {}), fusedFrom: slot.fusedFrom }) : "support";
    const turnTag = `<b class="gulu-gu-turn-tag" title="九转鼎可继续升转">${guluTurnName(slot.upgradeLevel)}</b>`; // 转数收进标题角标（炉方全表在九转鼎页）
    return `<div class="gulu-slot is-gu tone-${combatTone}" data-slot-index="${i}"><h4>第 ${i + 1} 圃 · <span class="gulu-gu-name${named ? " is-named" : ""}">${escGu(displayName)}</span>${turnTag}<small class="gulu-quality-label">${escGu(getGuluGradeDisplayName(slot.grade))}</small><button type="button" class="gulu-rename-btn" data-gulu-rename="${i}" title="命名" aria-label="给这只蛊命名">题</button></h4>
      <div class="gulu-gu-art" data-gulu-poke="gu" title="戳一戳"><i>${GULU_GRADE_GLYPHS[slot.grade] || "蛊"}</i>${art ? `<img src="${art}" alt="${escGu(displayName)}" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        ${slot.carry ? `<span class="gulu-carry-flag">随行</span>` : ""}</div>
      <p class="gulu-gu-desc">${card ? getCardEffect(slot.cardKey, slot.upgradeLevel | 0) : "蛊性不明"}</p>
      ${isGuluDaoGrade(slot.grade) ? `<p class="gulu-carry-boon" title="道脉蛊随行入塔时额外生效">道脉加持 · ${CARRIED_TIAN_DIM_LABEL[carriedTianDimKey(slot.cardKey)]}</p>` : ""}
      <div class="gulu-slot-actions">
        <button type="button" data-gulu-detail="${escGu(slot.id)}">查看详情</button>
        <button type="button" data-gulu-carry="${i}" class="${slot.carry ? "is-on" : ""}">${slot.carry ? "已入行囊" : "带入塔"}</button>
        <button type="button" data-gulu-feed="${i}" ${injured ? "disabled" : ""}>喂给${heroGu?.name || "本命蛊"}</button>
        <div class="gulu-slot-release-row"><button type="button" class="gulu-release-button" data-gulu-release="${i}">遣蛊归野</button></div>
      </div></div>`;
  }).join("");
  const events = s.events.slice(-8).reverse().map((e) => `<li>${escGu(e.text)}</li>`).join("") || "<li>蛊庐尚静，塔中带出材料便可孵卵。</li>";
  // 本命蛊祭坛：立绘 + 四形态被动全览（当前档高亮）+ 身世 + 静养状态
  const altarStages = BENMING_STAGES.map((st) => `<li class="${bi.stage >= st.stage ? "is-reached" : ""} ${bi.stage === st.stage ? "is-current" : ""}">
    <b>${st.name}</b><span>${getBenmingStagePassiveText(heroId, st.stage, altarPathId, legacyBenmingRun)}</span></li>`).join("");
  const altarPaths = BENMING_PATHS[heroId] && bi.stage >= 3 ? `<div class="benming-path-overview gulu-benming-paths ${injured && getEffectiveBenmingStage(heroId) < 3 ? "is-suppressed" : ""}">
    <p><strong>三转双路线</strong><span>${legacyBenmingRun ? "当前老续局沿用旧规则" : (injured && getEffectiveBenmingStage(heroId) < 3 ? "静养降阶，路线暂失效" : (altarPathId ? `本局：${getBenmingPathDefinition(heroId, altarPathId)?.name}` : "新局入塔前二择一"))}</span></p>
    ${Object.values(BENMING_PATHS[heroId]).map((path) => `<section class="benming-path-entry ${altarPathId === path.id ? "is-active" : ""}">
      <b>${path.glyph}</b><div><strong>${path.name}</strong><span>${path.summary}</span><small>五转：${path.guixu}</small></div>
    </section>`).join("")}
  </div>` : "";
  const altar = heroGu ? `
    <aside class="gulu-altar ${injured ? "is-injured" : ""}">
      <h3>本命蛊祭坛</h3>
      <div class="gulu-altar-art" data-gulu-poke="altar" title="抚蛊"><i>${heroGu.glyph}</i><img src="${getBenmingImagePath(heroId, bi.stage, altarPathId)}" alt="${heroGu.name}" loading="lazy" decoding="async" onerror="this.remove()"></div>
      <strong class="gulu-altar-name">${heroGu.name} · ${bi.stageName}</strong>
      <p class="gulu-altar-dao">道行 ${bi.dao}${bi.next ? ` / ${bi.next.threshold}` : " · 圆满"}${injured ? `<b>静养中 · ${formatGuluRemain(s.injuryUntil - now)}复元（形态降一档）</b>` : ""}</p>
      <p class="gulu-altar-lore">${heroGu.lore}</p>
      <ul class="gulu-altar-stages">${altarStages}</ul>
      ${altarPaths}
      <p class="gulu-tip">喂养压制按路线判定，与次品／精品无关：基础蛊可直接安全喂养；本命蛊二转后可安全吞食道脉蛊。越级喂养即蛊斗——胜则道行加倍，败则反噬静养。</p>
    </aside>` : "";
  setGuluMarkup(`
    ${renderGuluTabs()}
    ${renderGuluOverview(s)}
    ${guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : ""}
    <div class="gulu-layout">
      <div class="gulu-main">
        ${signSection}
        <section class="gulu-sec"><h3>材料仓 <small>通关全额带出 · 陨落折四成 · 残核仅通关可带</small></h3><div class="gulu-mats">${matChips}</div></section>
        <section class="gulu-sec gulu-plots-sec"><h3>蛊圃 <small>两条孵化线可同时积材</small><button type="button" class="gulu-pool-preview-open" data-gulu-pool-preview-open="1" aria-expanded="false">查看两类虫池</button></h3><p class="gulu-tip">基础卵出常用通用蛊，道脉卵出进阶蛊与当前流派专属蛊；两类材料互不替代。每线都有次品与精品，战斗属性相同；次品省材，精品只提高四转升五转后的升转成功率。成蛊可随行（${carriedCount}/${getCarryMaxNow()}）或喂养本命蛊。</p><div class="gulu-slots">${slots}</div></section>
        <section class="gulu-sec gulu-events-sec"><h3>蛊庐动静</h3><ul class="gulu-events">${events}</ul></section>
        ${NMG_XIANGHUO_ENABLED ? `<div class="gulu-lamp-row"><button type="button" class="gulu-lamp" data-xianghuo-open="gulu" aria-label="香火供奉"><i class="gulu-lamp-glyph" aria-hidden="true">灯</i><span>长明灯 · 添一炷香火</span></button></div>` : ""}
      </div>
      ${altar}
    </div>
    ${renderGuluHatchPoolPreview(heroId)}`);
  // V0.9.23 破壳强反馈：本次结算里有新破壳且蛊庐可见 → 走破壳仪式（按品阶分色）
  // V0.9.36 修：只认「本次刚破壳」的蛊（guluLastHatched），而非全圃 hatchAt 最大者——否则圃里已有别的成蛊时，
  //         仪式会张冠李戴（玩家报「第四圃出寿火蛊，仪式却写聚元蛊」）。多只同批破壳则取其中最迟破壳的一只。
  if (guluLastHatched.length && dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) {
    const newest = guluLastHatched.slice().sort((a, b) => (b.hatchAt || 0) - (a.hatchAt || 0))[0];
    if (newest && newest.state === "gu") {
      const grade = GULU_GRADES[newest.grade] || GULU_GRADES.fan;
      window.AudioManager?.playSfx?.(GULU_HATCH_SFX[newest.grade] || "guluHatchFan", { volumeScale: 1 }); // V0.9.26：破壳音与仪式分色同帧、同品驱动
      showRiteOverlay({
        tone: ({ attack: "blood", defense: "tian", support: "jade", mutation: "poison" })[typeof getGuCombatTone === "function" ? getGuCombatTone({ ...(CARD_LIBRARY[newest.cardKey] || {}), fusedFrom: newest.fusedFrom }) : ""] || "gold",
        eyebrow: "蛊圃 · 破壳", seal: GULU_GRADE_GLYPHS[newest.grade] || "蛊",
        title: newest.name,
        text: `${getGuluGradeDisplayName(newest.grade)}之蛊破壳而出。\n${CARD_LIBRARY[newest.cardKey] ? stripTags(getCardEffect(newest.cardKey, newest.upgradeLevel | 0)) : ""}`,
        hint: "点击任意处 · 收蛊", autoMs: (newest.grade === "xuan" || newest.grade === "tian") ? 1800 : 1600,
      });
    }
  }
}
/* ===== V0.9.26 蛊庐音频（接线清单）：BGM交叉/夜间虫鸣按昼夜/祭坛心跳按道行 ===== */
const GULU_HATCH_SFX = Object.freeze({ fan: "guluHatchFan", ling: "guluHatchLing", xuan: "guluHatchXuan", tian: "guluHatchTian" });
let guluAudioTimer = null; // 1s 节拍器：驱动心跳重触发 + 昼夜虫鸣检查
let guluHeartbeatDue = 0;
let guluNightOn = false;
let guluChirpOn = false;      // V0.9.34 夜间虫鸣间歇占空：当前是否处于「鸣」相
let guluChirpPhaseUntil = 0;  // 当前相（鸣/静）结束时间戳
const GULU_CHIRP_ON_MS = 22000;   // 一阵鸣约 22s
const GULU_CHIRP_OFF_MS = 48000;  // 再静约 48s——久驻不聒噪（回应“晚上虫叫太频繁”）
function isGuluNight() {
  try { const h = new Date().getHours(); return h >= 19 || h < 6; } catch (e) { return false; } // 取不到时间→白天（静默降级不叠虫鸣）
}
function guluAudioTick() {
  if (!dom.guluOverlay || dom.guluOverlay.classList.contains("hidden")) return;
  if (document.hidden) return; // 页面不可见：持续音语义由 AudioManager 生命周期兜底，节拍不推进
  const now = Date.now();
  // 祭坛心跳：按道行深浅调间隔与音量（浅 1.6s/0.4 → 深 0.9s/0.7），单拍重触发而非整段 loop
  if (now >= guluHeartbeatDue) {
    const dao = Math.min(getBenmingDaoxing(progression.selectedHeroId), 420);
    const depth = dao / 420;
    window.AudioManager?.playSfx?.("guluHeartbeat", { volumeScale: 0.4 + depth * 0.3 });
    guluHeartbeatDue = now + Math.round((1.6 - depth * 0.7) * 1000);
  }
  // 夜间虫鸣：真实时间昼夜。不再整夜长鸣，改「一阵鸣、一阵静」的间歇占空（约22s鸣/48s静），久驻不聒噪。
  const night = isGuluNight();
  if (!night) {
    if (guluNightOn) window.AudioManager?.stopAmbient?.({ fadeMs: 2000 }); // 入白天：收虫鸣
    guluNightOn = false; guluChirpOn = false; guluChirpPhaseUntil = 0;
  } else {
    guluNightOn = true;
    if (now >= guluChirpPhaseUntil) { // 相到点：鸣↔静切换（开面板即先来一阵，随后转静）
      guluChirpOn = !guluChirpOn;
      if (guluChirpOn) { window.AudioManager?.playAmbient?.("guluNight", { fadeMs: 2500 }); guluChirpPhaseUntil = now + GULU_CHIRP_ON_MS; }
      else { window.AudioManager?.stopAmbient?.({ fadeMs: 2500 }); guluChirpPhaseUntil = now + GULU_CHIRP_OFF_MS; }
    }
  }
}
function stopGuluAudio() {
  window.clearInterval(guluAudioTimer);
  guluAudioTimer = null;
  guluNightOn = false;
  guluChirpOn = false; guluChirpPhaseUntil = 0;
  window.AudioManager?.stopAmbient?.({ fadeMs: 800 });
}
function startGuluAudio() {
  window.AudioManager?.playScene?.("gulu", { duration: 800, quiet: true });
  // V0.9.58 从养蛊室切回蛊圃走的是这里（不经 stopGuluAudio），若不收滴水会一路响到蛊圃。
  // 环境层单通道，夜间紧随其后的 guluAudioTick 会立刻重新起虫鸣，不会留空。
  window.AudioManager?.stopAmbient?.({ fadeMs: 600 });
  guluHeartbeatDue = 0;
  guluNightOn = false;
  guluChirpOn = false;
  guluChirpPhaseUntil = 0;
  window.clearInterval(guluAudioTimer);
  guluAudioTimer = window.setInterval(guluAudioTick, 1000);
  guluAudioTick();
}
function syncGuluTabAudio(tab = guluActiveTab) {
  if (tab === "forge" || tab === "fusion") {
    stopGuluAudio();
    window.AudioManager?.playScene?.("guluForge", { duration: 800, quiet: true });
    return;
  }
  // V0.9.58 养蛊室：专属曲 + 灵泉滴水环境层。stopGuluAudio 先收掉祭坛心跳与夜间虫鸣
  // ——心跳属蛊圃的祭坛、虫鸣属屋外，进内室都不该再听见（与 forge 同一套路）。
  if (tab === "nurture") {
    stopGuluAudio();
    // 滴水必须等 BGM 换完再起：playScene 是异步的（要先把蛊庐曲淡出，约 0.7s），
    // 若同步就 playAmbient，那 0.7s 听到的是「上一个房间的曲子 + 这个房间的水声」。
    // 尾部再判一次页签，防止玩家在淡出期间切走后滴水才姗姗来迟地响起。
    Promise.resolve(window.AudioManager?.playScene?.("guluSpring", { duration: 800, quiet: true }))
      .then(() => {
        if (guluActiveTab === "nurture") window.AudioManager?.playAmbient?.("guluSpringDrip", { fadeMs: 2200 });
      })
      .catch(() => { /* 播放被策略拒绝时静默降级，与其余音频路径一致 */ });
    return;
  }
  if (tab === "market") {
    stopGuluAudio();
    return;
  }
  startGuluAudio();
}
// 蛊庐专属甲壳质感点击（不污染全局通用点击）
function playGuluClick() { window.AudioManager?.playSfx?.("guluClick", { volumeScale: 0.8 }); }

// ===== V0.9.28 蛊庐生命化：戳蛊回弹 + 就地命名（均不整体重渲染，避免打断动画/输入焦点）=====
let guluRenaming = false;
function guluPokeEl(el, sound) {
  if (!el) return;
  el.classList.remove("is-poked");
  void el.offsetWidth; // 强制重排以重启一次性动画（连点也能触发）
  el.classList.add("is-poked");
  if (sound === "heartbeat") window.AudioManager?.playSfx?.("guluHeartbeat", { volumeScale: 0.6 }); // 本命蛊=血肉·心跳
  else playGuluClick(); // 蛊/卵=甲壳·轻叩
  window.setTimeout(() => el && el.classList.remove("is-poked"), 600);
}
// 命名：把该栏标题就地换成输入框（不整体重渲染以保住输入焦点）
function startGuluRename(i) {
  const s = getGuluStore();
  const slot = s.slots[i];
  if (!slot || slot.state !== "gu") return;
  const slotEl = dom.guluBody && dom.guluBody.querySelector(`.gulu-slot[data-slot-index="${i}"]`);
  const h4 = slotEl && slotEl.querySelector("h4");
  if (!h4) return;
  guluRenaming = true; // 暂停 30s 自动重渲染，免得吞掉输入
  const cur = slot.customName || slot.name;
  h4.innerHTML = `第 ${i + 1} 圃 · <span class="gulu-rename-box"><input type="text" class="gulu-rename-input" maxlength="12" value="${escGu(cur)}" aria-label="蛊名"><button type="button" class="gulu-rename-ok" data-gulu-rename-ok="${i}" title="确认">定</button><button type="button" class="gulu-rename-cancel" data-gulu-rename-cancel="${i}" title="取消">弃</button></span>`;
  const input = h4.querySelector("input");
  if (input) {
    input.focus();
    try { input.select(); } catch (e) { /* 忽略 */ }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitGuluRename(i, input.value); }
      else if (e.key === "Escape") { e.preventDefault(); guluRenaming = false; renderGulu(); }
    });
  }
}
function commitGuluRename(i, value) {
  guluRenaming = false;
  const s = getGuluStore();
  const slot = s.slots[i];
  if (!slot || slot.state !== "gu") { renderGulu(); return; }
  const name = String(value || "").replace(/[\r\n\t]/g, "").trim().slice(0, 12);
  if (!name || name === slot.name) {
    const had = !!slot.customName;
    delete slot.customName; // 空或还原默认→清除自定义
    guluNoticeText = had ? "已恢复默认蛊名。" : "";
  } else {
    slot.customName = name;
    guluNoticeText = `已命名为「${name}」。`;
  }
  saveGuluStore();
  renderGulu();
}

function openGulu(tab = "home") {
  if (!dom.guluOverlay) return;
  const syncStore = getGuluStore();
  const previousSyncVersion = syncStore.codexSyncVersion;
  const syncResult = syncOwnedGuluDiscoveries(syncStore);
  if (syncResult.ok && (syncResult.added.length || previousSyncVersion !== syncStore.codexSyncVersion)) saveGuluStore();
  guluActiveTab = (tab === "market" || tab === "forge") ? tab : "home";
  if (dom.guluTitle) dom.guluTitle.textContent = guluActiveTab === "market" ? "百蛊市" : "蛊庐";
  guluNoticeText = "";
  renderGulu({ preserveScroll: false });
  if (dom.guluBody) dom.guluBody.scrollTop = 0;
  dom.guluOverlay.classList.remove("hidden");
  refreshModalLock();
  window.clearInterval(guluRefreshTimer);
  guluRefreshTimer = window.setInterval(() => {
    if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) { if (!guluRenaming) renderGulu(); } // 命名中不重渲染，免吞输入
    else window.clearInterval(guluRefreshTimer);
  }, 30000);
  // 当前视图决定蛊庐/炉房音轨；百蛊市入口会紧接着换到自己的市集曲目。
  syncGuluTabAudio(guluActiveTab);
  window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 });
  showGuluFirstVisitTip(guluActiveTab);
  dom.guluCloseButton?.focus();
}

/* V0.9.57 局外首触引导：玩家（TapTap 五星评价，玩满 70 分钟）原话——
 * 「主页里那个九鼎炉还是什么的有什么作用？孵卵是用来干嘛的？」
 * 查证后确认这不是「教程写少了」，而是说明全堆在开局那 3 页纯文字弹窗里，
 * 玩家真正站在这些界面前时无人告知。showCoachTip 首触机制早就有（只用了 4 处、全在战斗内），
 * 这里把三个局外主入口补上：只在第一次打开时讲一句，讲完落 localStorage 不再打扰。 */
function showGuluFirstVisitTip(tab) {
  if (typeof showCoachTip !== "function") return;
  // 满屏覆盖层下必须走 toast（不能降级成被盖住的战斗日志）；outOfRunTitle 让标题说「塔外指引」而非「入塔提示」。
  const asOutOfRun = { forceToast: true, outOfRunTitle: true };
  if (tab === "forge") {
    showCoachTip("firstForge", "九转鼎只负责同名同转升转；一至四转升转必成，四转升五转起失败会保留目标并积累成功率，引火砂加成，固蛊符护回残核与蛊胎。不同蛊种的同转异蛊合练请前往「合蛊坛」；合练必成，但两只原蛊都会消失。", asOutOfRun);
    return;
  }
  if (tab === "fusion") {
    showCoachTip("firstFusion", "合蛊坛：投入两只不同蛊种、同转、非随行的成蛊，只有合练谱中已有明方的搭档会亮起。合练必成并继承转数与较高品质，但两只原蛊都会不可逆消失。", asOutOfRun);
    return;
  }
  if (tab === "market") {
    showCoachTip("firstMarket", "百蛊市：用蛊钱换炼蛊材料、蛊卵与奇物。先点上方摊位快速分类，商品效果点击「查看说明」展开；购买需再次确认。蛊钱由活着离塔和局内结算积攒。", asOutOfRun);
    return;
  }
  if (tab === "nurture") {
    showCoachTip("firstNurture", "养蛊室：把成蛊收纳进室内，再用元髓露温养。温养提高养主值并产出灵泉；灵泉会离线累积，但室内容量有限。", asOutOfRun);
    return;
  }
  if (tab === "collection") {
    showCoachTip("firstGuluCollection", "蛊庐藏册只记你亲手孵化、合练、随行或投喂过的蛊；想看所有蛊虫、敌怪与世界知识，请回首页进入万蛊录。", asOutOfRun);
    return;
  }
  showCoachTip("firstGulu", "先选一条孵化线落卵；点“查看两类虫池”可确认具体产物。材料不足时再去百蛊市补齐。", asOutOfRun);
}
function openBaigushi() {
  guluMarketStall = "insects";
  openGulu("market");
  window.AudioManager?.playScene?.("baigushi", { duration: 800, quiet: true });
}
/* V0.9.52 九转鼎独立入口（主界面直入）：换自己的场景 BGM（炉火），不再沿用蛊庐虫鸣。 */
function openGuluForge() {
  openGulu("forge");
}
function closeGulu() {
  guluRenaming = false; // 关面板即离开命名态，防标志滞留冻结下次自动刷新
  guluRedeemOpen = false;
  dom.guluBody?.classList.remove("is-pool-preview-open");
  clearGuluForgeSequence();
  dom.guluForgeResultOverlay?.classList.add("hidden");
  guluForgeRitualState = null;
  closeGuluActionConfirm();
  window.clearInterval(guluRefreshTimer);
  if (guluNoticeTimer) window.clearTimeout(guluNoticeTimer);
  guluNoticeTimer = null;
  guluNoticeScheduledText = "";
  stopGuluAudio(); // V0.9.26：虫鸣淡出 + 心跳停
  dom.guluOverlay?.classList.add("hidden");
  refreshModalLock();
  window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 });
  window.AudioManager?.playScene?.("menu", { duration: 800, quiet: true }); // 回标题音景交叉回切
  if (dom.startScreen && !dom.startScreen.classList.contains("hidden")) renderTitleScreen(); // 携带变化可能影响下局
}
// ===== V0.9.29 香火供奉：自愿赞助弹窗（三入口共用；纯 UI，不碰 runState/game，只读 progression.xianghuoHidePrompt）=====
function openXianghuo() {
  if (!NMG_XIANGHUO_ENABLED) return; // V0.9.36 平台隔离：非网页版彻底不开香火（入口已在渲染处剔除，此处兜底）
  if (!dom.xianghuoOverlay) return;
  // 首开时才加载收款码（懒加载但不吃隐藏容器的 IntersectionObserver 失灵，也不在每次进游戏时白下 191KB）
  const qr = dom.xianghuoOverlay.querySelector(".xianghuo-qr");
  if (qr && !qr.getAttribute("src") && qr.dataset.src) qr.setAttribute("src", qr.dataset.src);
  dom.xianghuoOverlay.classList.remove("hidden");
  refreshModalLock();
  window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 }); // 复用蛊庐陶罐开合·启龛
  dom.xianghuoClose?.focus();
}
function closeXianghuo() {
  dom.xianghuoOverlay?.classList.add("hidden");
  refreshModalLock();
}
// 「不再提示」：结算轻提示的持久开关，归入 progression（勿另起状态源），点后隐藏当前提示段。
function setXianghuoHidePrompt(hide, fromEl) {
  progression.xianghuoHidePrompt = !!hide;
  setStoredFlag(XIANGHUO_HIDE_PROMPT_KEY, !!hide);
  if (hide && fromEl) fromEl.closest(".run-sec-xianghuo")?.classList.add("hidden");
}
// 回开始界面时结算离线动静，破卵/复元消息落在 runProgress 提示行
function reportGuluNewsOnTitle() {
  const news = settleGuluTime();
  if (news.length && dom.runProgress) {
    dom.runProgress.textContent = `蛊庐动静：${news.join(" ")}`;
    dom.runProgress.classList.remove("hidden");
  }
  if (typeof refreshCollectionHubBadges === "function") refreshCollectionHubBadges();
}
