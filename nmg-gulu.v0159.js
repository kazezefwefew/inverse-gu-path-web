"use strict";
/* nmg-gulu.js：V0.9.36 批次B-4，蛊庐/归庐日课/香火弹窗抽离；须在 game.v 之前加载。 */
/* ===== V0.9.22 蛊庐（批1）：局外养蛊——材料带出(通关全额/阵亡四成)、孵卵真实时间成长、成蛊两格带入塔、蛊斗喂养本命蛊。 =====
 * 独立存储 nmg.gulu（坏档不碰局内与本命蛊）；时间结算单一入口 settleGuluTime（宽容处理改时钟，单机不较真）；
 * 局外无种子通道，随机走 guluRandom（回归脚本按 return Math.random 白名单放行）。 */
const GULU_KEY = "nmg.gulu";
const STARTER_GU_UNLOCK_SCRIP_COST = 36;
const GULU_COLLECTION_VERSION = 2;
const GULU_COLLECTION_BUILD = "v0.9.39";
const GULU_HATCH_TIME_VERSION = 2;
const OWNED_GULU_CODEX_SYNC_VERSION = 1;
const GULU_SLOTS = 6; // 基础圃数（V0.9.52 由 4 提到 6：玩家反馈孵化位太少、稀有蛊转不动）
const GULU_SLOTS_MAX = 12; // V0.9.80：圃位扩到十二；数组恒补到此，旧档占用圃永不被裁
/* V0.9.80 辟圃阶梯（全部是元进度，不加任何战力，守 hardRules）：
 * 6 基础 → 7 通关任意路线 → 8/9/10/12 分别由本命六/七/八/九转开放。 */
const GULU_SLOT_LADDER = Object.freeze([
  { cap: 7, stage: 0, cleared: true, hint: "通关任意路线" },
  { cap: 8, stage: 6, cleared: false, hint: "本命蛊六转" },
  { cap: 9, stage: 7, cleared: false, hint: "本命蛊七转" },
  { cap: 10, stage: 8, cleared: false, hint: "本命蛊八转" },
  { cap: 12, stage: 9, cleared: false, hint: "本命蛊九转" },
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
 * 收纳位不占蛊圃；存放中的蛊不能随行、不能喂本命蛊，但可在九转鼎中直接作为合格祭蛊。
 * 本质是把上限从「能拥有多少」改成「能同时活跃多少」——圃位（元进度奖励：六转8/七转9/九转10）
 * 因此仍然稀缺，那条成长线不会被一个无限仓库作废。 */
const NURTURE_SLOTS_BASE = 12;
const NURTURE_SLOTS_MID = 24;
const NURTURE_SLOTS_MAX = 30;
function getNurtureSlotCapForStage(stage) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  if (safeStage >= 9) return NURTURE_SLOTS_MAX;
  if (safeStage >= 6) return NURTURE_SLOTS_MID;
  return NURTURE_SLOTS_BASE;
}
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
function getNurtureOrbitSlot(index, capacity) {
  const safeIndex = Math.max(0, index | 0);
  if (safeIndex < NURTURE_ORBIT_SLOTS.length) return NURTURE_ORBIT_SLOTS[safeIndex];
  const innerCount = Math.max(1, Math.min(NURTURE_SLOTS_MAX - NURTURE_ORBIT_SLOTS.length, (capacity | 0) - NURTURE_ORBIT_SLOTS.length));
  const innerIndex = safeIndex - NURTURE_ORBIT_SLOTS.length;
  const angle = (-Math.PI / 2) + (innerIndex / innerCount) * Math.PI * 2;
  const y = 50 + Math.sin(angle) * 25;
  return Object.freeze({
    x: 50 + Math.cos(angle) * 27,
    y,
    scale: 0.62 + (y / 100) * 0.18,
    z: 3 + Math.round(y / 12),
    motion: ["float", "crawl", "rest"][innerIndex % 3],
  });
}
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
  const nurtureCap = getNurtureSlotCap();
  const to = n.slots.findIndex((slot, index) => index < nurtureCap && !slot);
  if (to < 0) return { ok: false, text: "养蛊室已满，先取出一只再收。" };
  const gu = store.slots[from];
  store.slots[from] = null;
  n.slots[to] = { ...gu, nurture: Math.max(0, Math.floor(Number(gu.nurture) || 0)), storedAt: now };
  if (typeof acknowledgeFirstReturnEgg === "function") acknowledgeFirstReturnEgg(store, gu.id, "nurture", now);
  if (typeof recordEcologyRetentionAction === "function") recordEcologyRetentionAction(store, "store", now);
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
  if (typeof recordEcologyRetentionAction === "function") recordEcologyRetentionAction(store, "nurture", Date.now());
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
  if (typeof recordEcologyRetentionAction === "function") recordEcologyRetentionAction(store, "nurture", Date.now());
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
function getBaigushiWardMax() {
  return Math.max(1, getCarryMaxNow() | 0);
}
const BAIGUSHI_SCRIP_RATE = 5;
const BAIGUSHI_SCRIP_RUN_CAP = 12;
const BAIGUSHI_DAILY_STOCK = 3;
const BAIGUSHI_RECIPE_SCRIP_COST = 2;
const BAIGUSHI_WARD_SCRIP_COST = 11;
const BAIGUSHI_MARKET_RULES = Object.freeze({
  primaryDailyStock: 3,
  otherPathDailyStock: 3,
  ordinaryDailyStock: 36,
  refreshLimit: 2,
  refreshCost: 12,
  parkTicketDailyLimit: 2,
  otherPathUnlockStage: 3,
  primaryPrices: Object.freeze([72, 84, 96]),
  otherPathPrices: Object.freeze([84, 96, 108]),
  ordinaryPrices: Object.freeze([5, 6, 7, 8, 9]),
});
const BAIGUSHI_SEAL_SUNSET_DATE = "2026-09-04";
function getBaigushiSealSunsetState(now = guluNow()) {
  const deadline = new Date(`${BAIGUSHI_SEAL_SUNSET_DATE}T23:59:59+08:00`).getTime();
  const remainingMs = Math.max(0, deadline - Number(now || 0));
  return Object.freeze({
    active: Number(now || 0) <= deadline,
    days: Math.max(0, Math.ceil(remainingMs / 86400000)),
  });
}

function hashBaigushiMarketSeed(value) {
  return String(value || "").split("").reduce((hash, char) => (((hash * 33) ^ char.charCodeAt(0)) >>> 0), 2166136261);
}

function rotateBaigushiMarketPool(pool, seed, count) {
  const source = Array.from(new Set((Array.isArray(pool) ? pool : []).filter(Boolean)));
  if (!source.length || count <= 0) return [];
  const offset = hashBaigushiMarketSeed(seed) % source.length;
  const stride = source.length > 2 ? ((hashBaigushiMarketSeed(`${seed}|stride`) % (source.length - 1)) + 1) : 1;
  const result = [];
  let cursor = offset;
  let guard = 0;
  while (result.length < Math.min(count, source.length) && guard < source.length * 3) {
    const key = source[cursor % source.length];
    if (!result.includes(key)) result.push(key);
    cursor += stride;
    guard += 1;
  }
  source.forEach((key) => { if (result.length < Math.min(count, source.length) && !result.includes(key)) result.push(key); });
  return result;
}

function getBaigushiPrimaryHeroId(heroIds, daoByHero, selectedHeroId) {
  const ids = (Array.isArray(heroIds) ? heroIds : []).filter(Boolean);
  if (!ids.length) return "";
  const maxDao = ids.reduce((max, heroId) => Math.max(max, Math.max(0, Number(daoByHero?.[heroId]) || 0)), 0);
  if (ids.includes(selectedHeroId) && Math.max(0, Number(daoByHero?.[selectedHeroId]) || 0) === maxDao) return selectedHeroId;
  return ids.find((heroId) => Math.max(0, Number(daoByHero?.[heroId]) || 0) === maxDao) || ids[0];
}

function buildBaigushiMarketCatalog({
  dateKey, refreshIndex = 0, heroIds = [], heroExclusiveKeys = {}, standardKeys = [], cardLibrary = {},
  daoByHero = {}, stageByHero = {}, selectedHeroId = "",
} = {}) {
  const validHeroes = heroIds.filter((heroId) => heroExclusiveKeys[heroId]?.some((key) => cardLibrary[key]));
  const primaryHeroId = getBaigushiPrimaryHeroId(validHeroes, daoByHero, selectedHeroId);
  const makeOffers = (heroId, prices, seedPrefix) => rotateBaigushiMarketPool(
    heroExclusiveKeys[heroId]?.filter((key) => cardLibrary[key]), `${dateKey}|${seedPrefix}|${heroId}`, 3,
  ).map((cardKey, index) => ({
    id: `${seedPrefix}-${heroId}-${index}`,
    heroId,
    cardKey,
    grade: "tian",
    price: prices[index] || prices[prices.length - 1],
  }));
  const primaryOffers = primaryHeroId ? makeOffers(primaryHeroId, BAIGUSHI_MARKET_RULES.primaryPrices, "primary") : [];
  const otherPaths = validHeroes.filter((heroId) => heroId !== primaryHeroId).map((heroId) => ({
    heroId,
    unlocked: Math.max(0, Number(stageByHero?.[heroId]) || 0) >= BAIGUSHI_MARKET_RULES.otherPathUnlockStage,
    offers: makeOffers(heroId, BAIGUSHI_MARKET_RULES.otherPathPrices, "other"),
  }));
  const exclusive = new Set(Object.values(heroExclusiveKeys).flat());
  const ordinaryPool = standardKeys.filter((key) => cardLibrary[key] && !exclusive.has(key));
  const seed = `${dateKey}|ordinary|${Math.max(0, refreshIndex | 0)}`;
  const rotated = rotateBaigushiMarketPool(ordinaryPool, seed, ordinaryPool.length);
  const ordinaryOffers = Array.from({ length: Math.min(BAIGUSHI_MARKET_RULES.ordinaryDailyStock, rotated.length) }, (_, index) => {
    const cardKey = rotated[index];
    return {
      id: `ordinary-${Math.max(0, refreshIndex | 0)}-${index}`,
      cardKey,
      grade: "ling",
      price: BAIGUSHI_MARKET_RULES.ordinaryPrices[hashBaigushiMarketSeed(`${seed}|${cardKey}`) % BAIGUSHI_MARKET_RULES.ordinaryPrices.length],
    };
  });
  return { dateKey: String(dateKey || ""), refreshIndex: Math.max(0, refreshIndex | 0), primaryHeroId, primaryOffers, otherPaths, ordinaryOffers };
}

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
const GULU_FORGE_SUPPLY_ART = Object.freeze({
  bossCores: "assets/codex/materials/gu-mother-core.webp",
  guEmbryo: "assets/codex/materials/gu-embryo.webp",
  kindleSand: "assets/codex/materials/kindle-sand.webp",
  guWard: "assets/codex/materials/gu-ward.webp",
});
const BAIGUSHI_CURIO_ART = Object.freeze({
  healingSalve: "assets/codex/market/healing-salve.webp",
  materialCrate: "assets/codex/market/material-crate.webp",
  gradeSeal: "assets/codex/market/grade-seal.webp",
  marrowJade: "assets/codex/market/marrow-jade.webp",
  daoFruit: "assets/codex/market/dao-fruit.webp",
  guEmbryo: "assets/codex/market/gu-embryo-case.webp",
  guWard: "assets/codex/market/gu-ward-scroll.webp",
  coreTriple: "assets/codex/market/core-triple-casket.webp",
  kindlePouch: "assets/codex/market/kindle-pouch.webp",
  twinMarrowPair: "assets/codex/market/twin-marrow-pair.webp",
  materialBundle: "assets/codex/market/material-bundle.webp",
  hatchBreaker: "assets/codex/market/hatch-breaker.webp",
});
function renderGuluMaterialArt(material, className = "gulu-mat-art") {
  if (!material?.image) return `<span class="${className}" aria-hidden="true">${escGu(material?.glyph || "材")}</span>`;
  return `<span class="${className}" aria-hidden="true"><img src="${escGu(material.image)}" alt="" loading="lazy" decoding="async"></span>`;
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
  { minTurn: 2, name: "灵格", glyph: "灵" },
  { minTurn: 3, name: "玄格", glyph: "玄" },
  { minTurn: 4, name: "天格", glyph: "天" },
  { minTurn: 5, name: "神格", glyph: "神" },
  { minTurn: 6, name: "皇格", glyph: "皇" },
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
    if (slot.retentionSource === "first-return") return;
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

const GULU_LIFE_RECORD_VERSION = 1;
function getGuluLifeOrigin(slot, override = {}) {
  const stored = slot?.life?.origin && typeof slot.life.origin === "object" ? slot.life.origin : null;
  const requestedKind = String(override.kind || stored?.kind || "");
  const inferredKind = requestedKind
    || (Array.isArray(slot?.fusedFrom) && slot.fusedFrom.length ? "fusion" : "")
    || (slot?.marketRecipe ? "market" : "")
    || (slot?.retentionSource === "first-return" ? "return" : "")
    || "legacy";
  const labels = {
    hatch: "蛊圃孵化", fusion: "合蛊坛合练", market: "百蛊市定向孵化",
    return: "眠种归来", gift: "活动赠予", legacy: "旧档留存",
  };
  return {
    kind: labels[inferredKind] ? inferredKind : "legacy",
    label: String(override.label || stored?.label || labels[inferredKind] || labels.legacy),
    at: Math.max(0, Number(override.at ?? stored?.at) || 0),
    version: String(override.version || stored?.version || ""),
  };
}

function normalizeGuluLifeRecord(slot, originOverride = {}) {
  if (!slot || typeof slot !== "object" || slot.state !== "gu") return false;
  const before = JSON.stringify(slot.life || null);
  const source = slot.life && typeof slot.life === "object" && !Array.isArray(slot.life) ? slot.life : {};
  const journey = source.journey && typeof source.journey === "object" && !Array.isArray(source.journey) ? source.journey : {};
  const events = Array.isArray(journey.events) ? journey.events : [];
  slot.life = {
    version: GULU_LIFE_RECORD_VERSION,
    origin: getGuluLifeOrigin(slot, originOverride),
    journey: {
      runs: Math.max(0, Math.floor(Number(journey.runs) || 0)),
      battles: Math.max(0, Math.floor(Number(journey.battles) || 0)),
      bossWins: Math.max(0, Math.floor(Number(journey.bossWins) || 0)),
      events: events.filter((event) => event && typeof event === "object").slice(-6).map((event) => ({
        at: Math.max(0, Number(event.at) || 0),
        outcome: String(event.outcome || ""),
        label: String(event.label || "随行归来").slice(0, 36),
      })),
    },
  };
  return before !== JSON.stringify(slot.life);
}

function recordCarriedGuJourney(store, carriedGuIds, context = {}) {
  if (!store || typeof store !== "object") return 0;
  const ids = new Set(Array.isArray(carriedGuIds) ? carriedGuIds.map(String).filter(Boolean) : []);
  if (!ids.size) return 0;
  const all = [
    ...(Array.isArray(store.slots) ? store.slots : []),
    ...(Array.isArray(store.nurture?.slots) ? store.nurture.slots : []),
  ];
  let changed = 0;
  all.forEach((slot) => {
    if (!slot || !ids.has(String(slot.id || "")) || slot.state !== "gu") return;
    normalizeGuluLifeRecord(slot);
    const journey = slot.life.journey;
    journey.runs += 1;
    journey.battles += Math.max(0, Math.floor(Number(context.battles) || 0));
    if (context.bossDefeated) journey.bossWins += 1;
    journey.events.push({
      at: Math.max(0, Number(context.at) || Date.now()),
      outcome: String(context.outcome || ""),
      label: String(context.label || "完成一次正式随行").slice(0, 36),
    });
    if (journey.events.length > 6) journey.events.splice(0, journey.events.length - 6);
    changed += 1;
  });
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
  if (result.added.length && typeof recordEcologyRetentionAction === "function") {
    recordEcologyRetentionAction(store, "codex", Date.now());
  }
  result.ok = true;
  return result;
}

const FIRST_RETURN_EGG_HATCH_MS = 10 * 3600 * 1000;
const FIRST_RETURN_EGG_SOURCE = "first-return";

function normalizeFirstReturnEggState(store) {
  if (!store.retention || typeof store.retention !== "object" || Array.isArray(store.retention)) store.retention = {};
  const current = store.retention.firstReturnEgg;
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    store.retention.firstReturnEgg = null;
    return null;
  }
  const legacyViewedAt = current.viewedAt || (["view", "detail"].includes(String(current.claimedBy || "")) ? current.claimedAt : 0);
  const matchingCarriedSlot = Array.isArray(store.slots) && store.slots.some((slot) => slot?.state === "gu"
    && slot.carry && slot.retentionSource === FIRST_RETURN_EGG_SOURCE
    && String(slot.id || "") === String(current.guId || current.eggId || ""));
  const legacyCarriedAt = current.carriedAt || (legacyViewedAt && matchingCarriedSlot
    ? Math.max(1, Number(current.claimedAt) || Number(current.hatchedAt) || Number(current.grantedAt) || 1)
    : 0);
  const rewardClaimedAt = Math.max(0, Number(current.validationRewardClaimedAt) || 0);
  const status = ["pending", "placed", "hatched", "claimed"].includes(current.status) ? current.status : "pending";
  store.retention.firstReturnEgg = {
    status,
    eggId: String(current.eggId || ""),
    guId: String(current.guId || current.eggId || ""),
    heroId: String(current.heroId || ""),
    grantedAt: Math.max(0, Number(current.grantedAt) || 0),
    hatchAt: Math.max(0, Number(current.hatchAt) || 0),
    hatchedAt: Math.max(0, Number(current.hatchedAt) || 0),
    claimedAt: Math.max(0, Number(current.claimedAt) || 0),
    claimedBy: String(current.claimedBy || ""),
    viewedAt: Math.max(0, Number(legacyViewedAt) || 0),
    carriedAt: Math.max(0, Number(legacyCarriedAt) || 0),
    validatedAt: Math.max(0, Number(current.validatedAt) || 0),
    validationRewardClaimedAt: rewardClaimedAt,
    journeyRetiredAt: Math.max(0, Number(current.journeyRetiredAt) || 0),
    validationStats: current.validationStats && typeof current.validationStats === "object" && !Array.isArray(current.validationStats)
      ? {
        uses: Math.max(0, Number(current.validationStats.uses) || 0),
        damage: Math.max(0, Number(current.validationStats.damage) || 0),
        armor: Math.max(0, Number(current.validationStats.armor) || 0),
        healing: Math.max(0, Number(current.validationStats.healing) || 0),
      }
      : { uses: 0, damage: 0, armor: 0, healing: 0 },
  };
  return store.retention.firstReturnEgg;
}

/* 首回访承诺复用真实蛊圃。空圃直接落卵；满圃而养蛊室有位时，只收纳未随行、未锁定成蛊；
 * 两处都满则把同一承诺保留为 pending。hatchAt 从首次授予计算，晚腾位置不会重新计时。 */
function ensureFirstReturnEgg(store, now = Date.now(), options = {}) {
  if (!store || typeof store !== "object") return { ok: false, created: false, placement: "invalid" };
  if (!Array.isArray(store.slots)) store.slots = [];
  if (!store.nurture || typeof store.nurture !== "object" || Array.isArray(store.nurture)) store.nurture = {};
  if (!Array.isArray(store.nurture.slots)) store.nurture.slots = [];
  if (!store.retention || typeof store.retention !== "object" || Array.isArray(store.retention)) store.retention = {};
  let promise = normalizeFirstReturnEggState(store);
  const existing = store.slots.find((slot) => slot?.retentionSource === FIRST_RETURN_EGG_SOURCE);
  if (existing) {
    if (!promise) promise = store.retention.firstReturnEgg = {};
    promise.status = existing.state === "gu" ? (promise.claimedAt ? "claimed" : "hatched") : "placed";
    promise.eggId = String(existing.id || promise.eggId || "");
    promise.guId = existing.state === "gu" ? promise.eggId : String(promise.guId || "");
    promise.heroId = String(existing.heroId || promise.heroId || "");
    promise.grantedAt = Math.max(0, Number(promise.grantedAt) || Number(existing.startedAt) || now);
    promise.hatchAt = Math.max(0, Number(promise.hatchAt) || Number(existing.hatchAt) || (promise.grantedAt + FIRST_RETURN_EGG_HATCH_MS));
    return { ok: true, created: false, changed: false, placement: "existing", slot: existing, promise };
  }
  if (promise && ["hatched", "claimed"].includes(promise.status)) {
    return { ok: true, created: false, changed: false, placement: promise.status, promise };
  }
  const granted = !promise?.grantedAt;
  if (!promise) promise = store.retention.firstReturnEgg = {};
  promise.status = "pending";
  promise.heroId = String(promise.heroId || options.heroId || "");
  promise.grantedAt = Math.max(0, Number(promise.grantedAt) || now);
  promise.hatchAt = Math.max(0, Number(promise.hatchAt) || (promise.grantedAt + FIRST_RETURN_EGG_HATCH_MS));
  promise.eggId = String(promise.eggId || "");
  promise.guId = String(promise.guId || "");
  promise.hatchedAt = Math.max(0, Number(promise.hatchedAt) || 0);
  promise.claimedAt = Math.max(0, Number(promise.claimedAt) || 0);
  promise.claimedBy = String(promise.claimedBy || "");

  const mainCap = Math.max(0, Math.min(store.slots.length, Number.isFinite(Number(options.mainCap))
    ? Math.floor(Number(options.mainCap))
    : (typeof getGuluSlotCap === "function" ? getGuluSlotCap() : store.slots.length)));
  let slotIndex = store.slots.findIndex((slot, index) => index < mainCap && !slot);
  let placement = "gulu";
  let relocatedGu = null;
  let nurtureSlotIndex = -1;
  if (slotIndex < 0) {
    const nurtureCap = Math.max(0, Math.min(store.nurture.slots.length, Number.isFinite(Number(options.nurtureCap))
      ? Math.floor(Number(options.nurtureCap))
      : (typeof getNurtureSlotCap === "function" ? getNurtureSlotCap() : store.nurture.slots.length)));
    const nurtureIndex = store.nurture.slots.findIndex((slot, index) => index < nurtureCap && !slot);
    const locked = new Set(Array.isArray(options.lockedGuIds) ? options.lockedGuIds.map(String) : []);
    let moveIndex = -1;
    for (let index = mainCap - 1; index >= 0; index -= 1) {
      const slot = store.slots[index];
      if (slot?.state === "gu" && !slot.carry && !locked.has(String(slot.id || ""))) { moveIndex = index; break; }
    }
    if (nurtureIndex >= 0 && moveIndex >= 0) {
      relocatedGu = { ...store.slots[moveIndex], storedAt: now };
      nurtureSlotIndex = nurtureIndex;
      store.nurture.slots[nurtureIndex] = relocatedGu;
      store.slots[moveIndex] = null;
      slotIndex = moveIndex;
      placement = "nurture-relocate";
    }
  }
  if (slotIndex < 0) {
    return { ok: true, created: false, changed: granted, granted, placement: "pending", promise };
  }

  const knownIds = new Set([
    ...store.slots,
    ...store.nurture.slots,
  ].filter(Boolean).map((slot) => String(slot.id || "")));
  let serial = Math.max(0, store.serial | 0);
  let id = "";
  do { serial += 1; id = `gu${serial}`; } while (knownIds.has(id));
  store.serial = serial;
  const egg = {
    id, state: "egg", grade: "ling", heroId: promise.heroId,
    startedAt: promise.grantedAt, hatchAt: promise.hatchAt, carry: false,
    retentionSource: FIRST_RETURN_EGG_SOURCE, displayName: "眠种蛊卵",
  };
  store.slots[slotIndex] = egg;
  promise.status = "placed";
  promise.eggId = id;
  promise.guId = id;
  return { ok: true, created: true, changed: true, granted, placement, slotIndex, slot: egg, promise, relocatedGu, nurtureSlotIndex };
}

function acknowledgeFirstReturnEgg(store, guId, action = "view", now = Date.now()) {
  const promise = normalizeFirstReturnEggState(store);
  if (!promise || !["hatched", "claimed"].includes(promise.status)
    || String(promise.guId || promise.eggId) !== String(guId || "")) return false;
  if (!promise.viewedAt) promise.viewedAt = Math.max(1, Number(now) || Date.now());
  promise.status = "claimed";
  promise.claimedAt = Math.max(1, Number(promise.claimedAt) || Number(now) || Date.now());
  promise.claimedBy = String(action || "view");
  return true;
}

/* V0.9.79：眠种仍是一次性回访赠蛊，但“查看→随行→实战”任务正式退役。
 * 旧奖励改为一次性自动补偿，完全不依赖眠种实体是否仍在仓位，解决玩家已喂养后永久卡任务。 */
function retireFirstReturnJourney(store, now = Date.now()) {
  const promise = normalizeFirstReturnEggState(store);
  if (!promise || promise.journeyRetiredAt) return { changed: false, gained: 0 };
  const at = Math.max(1, Number(now) || Date.now());
  if (!store.market || typeof store.market !== "object" || Array.isArray(store.market)) store.market = {};
  let gained = 0;
  if (!promise.validationRewardClaimedAt) {
    store.market.scrip = Math.max(0, Math.floor(Number(store.market.scrip) || 0)) + 20;
    promise.validationRewardClaimedAt = at;
    gained = 20;
  }
  promise.journeyRetiredAt = at;
  return { changed: true, gained };
}

/* 四日养蛊记不是连续签到：玩家在任意四个本地自然日完成一次真实养蛊行为即可。
 * 进度永久保留、没有过期字段；同日多做只丰富记录，不会刷多天。 */
const ECOLOGY_RETENTION_TARGET_DAYS = 4;
const ECOLOGY_RETENTION_REWARD_PER_MATERIAL = 1;
const ECOLOGY_RETENTION_ACTIONS = Object.freeze({
  hatch: "见证破壳",
  store: "收纳成蛊",
  nurture: "完成温养",
  fusion: "异蛊合练",
  carry: "带蛊入塔",
  validate: "眠种实战",
  codex: "新蛊收录",
});

function ecologyRetentionDateKey(now = Date.now()) {
  const date = new Date(Number(now) || Date.now());
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeEcologyRetentionJournal(store) {
  if (!store.retention || typeof store.retention !== "object" || Array.isArray(store.retention)) store.retention = {};
  const current = store.retention.ecologyJournal;
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    store.retention.ecologyJournal = { startedAt: 0, days: {}, completedAt: 0, rewardClaimedAt: 0 };
    return store.retention.ecologyJournal;
  }
  const normalizedDays = {};
  Object.keys(current.days && typeof current.days === "object" && !Array.isArray(current.days) ? current.days : {})
    .filter((key) => /^\d{8}$/.test(key))
    .sort()
    .slice(0, ECOLOGY_RETENTION_TARGET_DAYS)
    .forEach((key) => {
      const actions = Array.isArray(current.days[key]) ? current.days[key] : [];
      normalizedDays[key] = Array.from(new Set(actions.map(String).filter((action) => ECOLOGY_RETENTION_ACTIONS[action])));
      if (!normalizedDays[key].length) delete normalizedDays[key];
    });
  store.retention.ecologyJournal = {
    startedAt: Math.max(0, Number(current.startedAt) || 0),
    days: normalizedDays,
    completedAt: Math.max(0, Number(current.completedAt) || 0),
    rewardClaimedAt: Math.max(0, Number(current.rewardClaimedAt) || 0),
  };
  return store.retention.ecologyJournal;
}

function recordEcologyRetentionAction(store, action, now = Date.now()) {
  return { ok: false, retired: true, days: 0, newDay: false };
}

function getEcologyRetentionSummary(store, now = Date.now()) {
  const journal = normalizeEcologyRetentionJournal(store);
  const dates = Object.keys(journal.days).sort();
  const todayActions = [...(journal.days[ecologyRetentionDateKey(now)] || [])];
  return {
    days: dates.length,
    targetDays: ECOLOGY_RETENTION_TARGET_DAYS,
    dates,
    todayActions,
    ready: dates.length >= ECOLOGY_RETENTION_TARGET_DAYS && !journal.rewardClaimedAt,
    claimed: Boolean(journal.rewardClaimedAt),
    expired: false,
    started: Boolean(journal.startedAt),
    remaining: Math.max(0, ECOLOGY_RETENTION_TARGET_DAYS - dates.length),
  };
}

function claimEcologyRetentionReward(store, now = Date.now()) {
  const summary = getEcologyRetentionSummary(store, now);
  const journal = normalizeEcologyRetentionJournal(store);
  if (!summary.ready) return { ok: false, claimed: summary.claimed, text: summary.claimed ? "四日养蛊记已经结清。" : `还需在 ${summary.remaining} 个自然日留下养蛊记录。` };
  if (!store.materials || typeof store.materials !== "object" || Array.isArray(store.materials)) store.materials = {};
  const ids = typeof MATERIAL_IDS !== "undefined" ? MATERIAL_IDS : [];
  ids.forEach((id) => {
    store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) + ECOLOGY_RETENTION_REWARD_PER_MATERIAL;
  });
  journal.rewardClaimedAt = Math.max(1, Number(now) || Date.now());
  if (typeof unlockTitle === "function") unlockTitle("guluKeeper", { autoEquip: false });
  return {
    ok: true,
    claimed: true,
    titleId: "guluKeeper",
    materialTotal: ids.length * ECOLOGY_RETENTION_REWARD_PER_MATERIAL,
    text: `四日养蛊记结清：八种基础材料各 ${ECOLOGY_RETENTION_REWARD_PER_MATERIAL} 份，称号「蛊庐守候者」已入录。`,
  };
}

function settleRetiredEcologyRetentionReward(store, now = Date.now()) {
  const result = claimEcologyRetentionReward(store, now);
  return { ...result, migrated: result.ok === true };
}

const NEW_REWARDED_DAILY_LIMIT = 8;
const NEW_REWARDED_PLACEMENT_LIMITS = Object.freeze({
  battle_material_salvage: 6,
  shop_refresh: 3,
  boss_material_salvage: 2,
  forge_failure_reclaim: 2,
});

function normalizeRewardedDailyLedger(store, dateKey) {
  if (!store || typeof store !== "object") return null;
  const key = String(dateKey || guluTodayKey());
  const source = store.rewardedAdsDaily
    && store.rewardedAdsDaily.dateKey === key
    && typeof store.rewardedAdsDaily === "object"
    ? store.rewardedAdsDaily
    : {};
  const counts = {};
  Object.keys(NEW_REWARDED_PLACEMENT_LIMITS).forEach((placementId) => {
    counts[placementId] = Math.max(0, Math.floor(Number(source.counts?.[placementId]) || 0));
  });
  store.rewardedAdsDaily = {
    dateKey: key,
    counts,
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
  };
  return store.rewardedAdsDaily;
}

function canGrantNewRewardedPlacement(store, placementId, dateKey) {
  const limit = NEW_REWARDED_PLACEMENT_LIMITS[placementId];
  if (!limit) return false;
  const ledger = normalizeRewardedDailyLedger(store, dateKey);
  return Boolean(
    ledger
    && ledger.total < NEW_REWARDED_DAILY_LIMIT
    && ledger.counts[placementId] < limit,
  );
}

function recordNewRewardedGrant(store, placementId, dateKey) {
  if (!canGrantNewRewardedPlacement(store, placementId, dateKey)) return false;
  const ledger = normalizeRewardedDailyLedger(store, dateKey);
  ledger.counts[placementId] += 1;
  ledger.total += 1;
  return true;
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
  normalizeFirstReturnEggState(s);
  normalizeEcologyRetentionJournal(s);
  const retiredEcologyRetention = settleRetiredEcologyRetentionReward(s, guluNow());
  if (retiredEcologyRetention.migrated) {
    guluPushEvent(s, "旧日照料印记已经结清，材料与「蛊庐守候者」已补入。");
  }
  if (!Array.isArray(s.events)) s.events = [];
  s.serial = s.serial | 0;
  const repairedInstances = normalizeGuluInstanceIdentity(s);
  let migratedLifeRecords = false;
  [...s.slots, ...normalizeNurtureStore(s).slots].filter(Boolean).forEach((slot) => {
    if (slot.state === "gu" && normalizeGuluLifeRecord(slot)) migratedLifeRecords = true;
  });
  s.sign = (s.sign && typeof s.sign === "object" && !Array.isArray(s.sign)) ? s.sign : {}; // V0.9.35 归庐日课：{lastDate,streak,total}
  const dailyLuckBefore = JSON.stringify(s.dailyLuck || null);
  normalizeDailyLuckStore(s);
  const migratedDailyLuck = JSON.stringify(s.dailyLuck) !== dailyLuckBefore;
  s.market = (s.market && typeof s.market === "object" && !Array.isArray(s.market)) ? s.market : {};
  s.market.scrip = normalizeRedeemOwnedAmount(s.market.scrip);
  normalizeStarterGuUnlocks(s);
  const retiredFirstReturnJourney = retireFirstReturnJourney(s, guluNow());
  if (retiredFirstReturnJourney.gained > 0) {
    guluPushEvent(s, "眠种实战任务已退役，旧奖励蛊钱 20 已直接补入。");
  }
  s.endlessRewards = (s.endlessRewards && typeof s.endlessRewards === "object" && !Array.isArray(s.endlessRewards)) ? s.endlessRewards : {};
  if (!Array.isArray(s.duelRankRewardClaims)) s.duelRankRewardClaims = [];
  s.duelRankRewardClaims = Array.from(new Set(s.duelRankRewardClaims.map(String).filter(Boolean))).slice(-500);
  if (!Array.isArray(s.duelRankTitles)) s.duelRankTitles = [];
  s.duelRankTitles = Array.from(new Set(s.duelRankTitles.map(String).filter(Boolean)));
  const parkBefore = JSON.stringify(s.park || null);
  normalizeParkStore(s, guluTodayKey());
  const migratedPark = JSON.stringify(s.park) !== parkBefore;
  normalizeRewardedDailyLedger(s, guluTodayKey());
  if (!Array.isArray(s.pendingRunRewards)) s.pendingRunRewards = [];
  s.market.deathWard = Math.min(getBaigushiWardMax(), Math.max(0, s.market.deathWard | 0));
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
  if (migratedCollection || migratedHatchTimes || repairedInstances || migratedLifeRecords || migratedQualitySemantics || migratedPark || migratedDailyLuck || retiredFirstReturnJourney.changed || retiredEcologyRetention.migrated) {
    try { safeWriteJson(GULU_KEY, JSON.stringify(s)); } catch (e) { /* 迁移写回失败不阻塞当前会话 */ }
  }
  return s;
}
function saveGuluStore(storeOverride) {
  try {
    const store = storeOverride && typeof storeOverride === "object" ? storeOverride : getGuluStore();
    if (store.retention?.firstReturnEgg?.status === "pending" && store.retention.firstReturnEgg.grantedAt) {
      const active = typeof getGuluRunningRun === "function" ? getGuluRunningRun() : null;
      ensureFirstReturnEgg(store, guluNow(), {
        heroId: store.retention.firstReturnEgg.heroId,
        lockedGuIds: Array.isArray(active?.carriedGuIds) ? active.carriedGuIds : [],
      });
    }
    return safeWriteJson(GULU_KEY, JSON.stringify(store));
  } catch (e) { return false; }
}

function normalizeStarterGuUnlocks(store) {
  if (!store || typeof store !== "object") return [];
  store.market = (store.market && typeof store.market === "object" && !Array.isArray(store.market)) ? store.market : {};
  const eligible = typeof STARTER_GU_CHOICE_KEYS !== "undefined" ? new Set(STARTER_GU_CHOICE_KEYS) : null;
  const open = typeof STARTER_GU_OPEN_COHORT_KEYS !== "undefined" ? new Set(STARTER_GU_OPEN_COHORT_KEYS) : new Set();
  store.market.starterUnlocks = Array.from(new Set((Array.isArray(store.market.starterUnlocks) ? store.market.starterUnlocks : [])
    .map(String)
    .filter((key) => (!eligible || eligible.has(key)) && !open.has(key))));
  return store.market.starterUnlocks;
}

function unlockStarterGuPermanently(store, cardKey, method, save = saveGuluStore) {
  const key = String(cardKey || "");
  const eligible = typeof STARTER_GU_CHOICE_KEYS !== "undefined" && STARTER_GU_CHOICE_KEYS.includes(key);
  if (!store || typeof store !== "object" || !eligible || !["scrip", "ad"].includes(method)) {
    return { ok: false, reason: "invalid" };
  }
  const existing = normalizeStarterGuUnlocks(store);
  if (existing.includes(key) || (typeof STARTER_GU_OPEN_COHORT_KEYS !== "undefined" && STARTER_GU_OPEN_COHORT_KEYS.includes(key))) {
    return { ok: false, reason: "already-unlocked" };
  }
  const candidate = JSON.parse(JSON.stringify(store));
  const unlocks = normalizeStarterGuUnlocks(candidate);
  candidate.market.scrip = normalizeRedeemOwnedAmount(candidate.market.scrip);
  if (method === "scrip") {
    if (candidate.market.scrip < STARTER_GU_UNLOCK_SCRIP_COST) return { ok: false, reason: "insufficient-scrip" };
    candidate.market.scrip -= STARTER_GU_UNLOCK_SCRIP_COST;
  }
  unlocks.push(key);
  candidate.market.starterUnlocks = Array.from(new Set(unlocks));
  if (!commitParkCandidate(store, candidate, save)) return { ok: false, reason: "persistence-failed" };
  return { ok: true, cardKey: key, method, scrip: candidate.market.scrip };
}

/* 无尽里程碑与周目标统一入库。领取账本与奖励在同一个蛊庐存档对象中一并写回，
 * 避免“奖励到账但领取标记丢失”或相反方向的半结算。排行榜报分与本函数完全解耦。 */
function claimEndlessProgressRewards(store, deepest, at = Date.now()) {
  if (!store || typeof store !== "object" || typeof NmgEndless === "undefined" || typeof NmgEndless.getEndlessRewardPlan !== "function") {
    return { ok: false, reason: "unavailable" };
  }
  const candidate = JSON.parse(JSON.stringify(store));
  candidate.market = candidate.market && typeof candidate.market === "object" ? candidate.market : {};
  candidate.materials = candidate.materials && typeof candidate.materials === "object" ? candidate.materials : {};
  const plan = NmgEndless.getEndlessRewardPlan(deepest, candidate.endlessRewards, at);
  if (!plan.hasReward) {
    const priorDeepest = Math.max(0, Math.floor(Number(candidate.endlessRewards?.deepestReached) || 0));
    if (plan.nextLedger.deepestReached > priorDeepest) {
      candidate.endlessRewards = plan.nextLedger;
      if (saveGuluStore(candidate) === false) return { ok: false, reason: "persistence-failed", plan };
      Object.assign(store, candidate);
    }
    return { ok: false, reason: "claimed", plan, nextMilestone: plan.nextLifetime?.floor || 0 };
  }
  const reward = plan.total;
  candidate.market.scrip = normalizeRedeemOwnedAmount(candidate.market.scrip) + (reward.scrip | 0);
  (typeof MATERIAL_IDS !== "undefined" ? MATERIAL_IDS : []).forEach((id) => {
    candidate.materials[id] = normalizeRedeemOwnedAmount(candidate.materials[id]) + (reward.materialEach | 0);
  });
  candidate.bossCores = normalizeRedeemOwnedAmount(candidate.bossCores) + (reward.bossCores | 0);
  candidate.guEmbryo = normalizeRedeemOwnedAmount(candidate.guEmbryo) + (reward.guEmbryo | 0);
  candidate.kindleSand = normalizeRedeemOwnedAmount(candidate.kindleSand) + (reward.kindleSand | 0);
  candidate.guWard = normalizeRedeemOwnedAmount(candidate.guWard) + (reward.guWard | 0);
  candidate.endlessRewards = plan.nextLedger;
  const claimedNames = plan.lifetime.concat(plan.post100 || [], plan.weekly).map((item) => item.name);
  const rewardLines = [
    reward.scrip > 0 ? `蛊钱 +${reward.scrip}` : "",
    reward.materialEach > 0 ? `全套基础炼材各 +${reward.materialEach}` : "",
    reward.bossCores > 0 ? `蛊母残核 +${reward.bossCores}` : "",
    reward.guEmbryo > 0 ? `蛊胎 +${reward.guEmbryo}` : "",
    reward.kindleSand > 0 ? `引火砂 +${reward.kindleSand}` : "",
    reward.guWard > 0 ? `固蛊符 +${reward.guWard}` : "",
  ].filter(Boolean);
  guluPushEvent(candidate, `无尽重赏「${claimedNames.join("、")}」：${rewardLines.join("，")}。`);
  if (saveGuluStore(candidate) === false) return { ok: false, reason: "persistence-failed", plan };
  Object.assign(store, candidate);
  return { ok: true, plan, reward, claimedNames, rewardLines, nextMilestone: plan.nextLifetime?.floor || 0 };
}

/* 排位奖励的资产与领取凭据写入同一个蛊庐存档。传入的 rankState 用于计算进度，
 * 蛊庐内的凭据会先合并进去，因此即使大厅段位存档写回失败也不会重复发放。 */
function claimDuelRankRewards(rankState, context) {
  if (typeof NmgDuelRank === "undefined" || typeof NmgDuelRank.getRewardPlan !== "function") return { ok: false, reason: "unavailable", rankState };
  const sourceStore = getGuluStore();
  const store = JSON.parse(JSON.stringify(sourceStore));
  const at = Number(context?.at) || Date.now();
  const normalized = NmgDuelRank.normalize(rankState, at);
  normalized.rewardClaims = Array.from(new Set([
    ...(Array.isArray(normalized.rewardClaims) ? normalized.rewardClaims : []),
    ...(Array.isArray(store.duelRankRewardClaims) ? store.duelRankRewardClaims : []),
  ])).slice(-500);
  const plan = NmgDuelRank.getRewardPlan(normalized, { ...(context || {}), at });
  if (!plan.hasReward || !plan.claims.length) return { ok: false, reason: "claimed", rankState: plan.state, plan };
  const reward = plan.grants;
  store.market = store.market && typeof store.market === "object" ? store.market : {};
  store.materials = store.materials && typeof store.materials === "object" ? store.materials : {};
  store.market.scrip = normalizeRedeemOwnedAmount(store.market.scrip) + (reward.scrip | 0);
  const materialIds = typeof MATERIAL_IDS !== "undefined" ? MATERIAL_IDS : [];
  materialIds.forEach((id) => {
    store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) + (reward.materialEach | 0);
  });
  let randomMaterialId = "";
  if ((reward.randomMaterial | 0) > 0 && materialIds.length) {
    const seed = plan.claims.join("|");
    let hash = 2166136261 >>> 0;
    for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619) >>> 0; }
    randomMaterialId = materialIds[hash % materialIds.length];
    store.materials[randomMaterialId] = normalizeRedeemOwnedAmount(store.materials[randomMaterialId]) + (reward.randomMaterial | 0);
  }
  store.bossCores = normalizeRedeemOwnedAmount(store.bossCores) + (reward.bossCores | 0);
  store.guEmbryo = normalizeRedeemOwnedAmount(store.guEmbryo) + (reward.guEmbryo | 0);
  store.kindleSand = normalizeRedeemOwnedAmount(store.kindleSand) + (reward.kindleSand | 0);
  store.guWard = normalizeRedeemOwnedAmount(store.guWard) + (reward.guWard | 0);
  store.duelRankRewardClaims = plan.state.rewardClaims.slice(-500);
  if (reward.titleId) store.duelRankTitles = Array.from(new Set([...(store.duelRankTitles || []), reward.titleId]));
  const rewardLines = [
    reward.scrip > 0 ? `蛊钱 +${reward.scrip}` : "",
    reward.materialEach > 0 ? `全套基础炼材各 +${reward.materialEach}` : "",
    reward.randomMaterial > 0 ? `随机基础炼材 +${reward.randomMaterial}` : "",
    reward.bossCores > 0 ? `蛊母残核 +${reward.bossCores}` : "",
    reward.guEmbryo > 0 ? `蛊胎 +${reward.guEmbryo}` : "",
    reward.kindleSand > 0 ? `引火砂 +${reward.kindleSand}` : "",
    reward.guWard > 0 ? `固蛊符 +${reward.guWard}` : "",
    reward.titleId ? "称号「祖庭问鼎」" : "",
  ].filter(Boolean);
  guluPushEvent(store, `蛊斗场排位奖励：${rewardLines.join("，")}。`);
  if (saveGuluStore(store) === false) return { ok: false, reason: "persistence-failed", rankState: normalized, plan };
  Object.assign(sourceStore, store);
  if (reward.titleId && typeof unlockTitle === "function") unlockTitle(reward.titleId, { autoEquip: true });
  return { ok: true, rankState: plan.state, reward, rewardLines, randomMaterialId, claims: plan.claims };
}

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
  const ecologyMaterialIds = new Set([...Object.keys(before.ecologyMaterials || {}), ...Object.keys(after.ecologyMaterials || {})]);
  ecologyMaterialIds.forEach((id) => {
    const material = typeof ECOLOGY_MATERIALS !== "undefined" ? ECOLOGY_MATERIALS[id] : null;
    pushCount(material?.glyph || "异", material?.name || id, (after.ecologyMaterials?.[id] | 0) - (before.ecologyMaterials?.[id] | 0), material?.tone || "jade");
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
function getNurtureSlotCap() { return getNurtureSlotCapForStage(getGuluTopBenmingStage()); }
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
// 每日幸运只发既有局外资产；forbidden reward kinds: card, egg, gu, rare-gu。
const DAILY_LUCK_FORBIDDEN_REWARD_KINDS = Object.freeze(["card", "egg", "gu", "rare-gu"]);
const DAILY_LUCK_REWARD_POOL = Object.freeze([
  Object.freeze({ id: "scrip12", kind: "scrip", amount: 12, glyph: "契", label: "蛊钱 ×12" }),
  Object.freeze({ id: "materials4", kind: "materials", amount: 4, glyph: "材", label: "基础炉材 ×4" }),
  Object.freeze({ id: "ecology2", kind: "ecology", amount: 2, glyph: "栖", label: "生态异材 ×2" }),
  Object.freeze({ id: "core1", kind: "boss-core", amount: 1, glyph: "核", label: "蛊母残核 ×1" }),
  Object.freeze({ id: "embryo1", kind: "embryo", amount: 1, glyph: "胎", label: "蛊胎 ×1" }),
  Object.freeze({ id: "kindle2", kind: "kindle", amount: 2, glyph: "砂", label: "引火砂 ×2" }),
  Object.freeze({ id: "ward1", kind: "ward", amount: 1, glyph: "符", label: "固蛊符 ×1" }),
]);
function hashDailyLuckSeed(value) {
  let hash = 2166136261 >>> 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
function createDailyLuckStoreSeed(store) {
  try {
    const values = new Uint32Array(2);
    globalThis.crypto?.getRandomValues?.(values);
    if (values[0] || values[1]) return `${values[0].toString(36)}${values[1].toString(36)}`;
  } catch (error) { /* 老 WebView 回落到本地熵 */ }
  return hashDailyLuckSeed(`${Date.now()}|${Math.random()}|${store?.serial | 0}`).toString(36);
}
function deriveDailyLuckFallbackSeed(store) {
  const collection = Object.keys(store?.collection || {}).sort().slice(0, 12).join(",");
  return hashDailyLuckSeed(`${store?.serial | 0}|${store?.sign?.total | 0}|${collection}`).toString(36);
}
function normalizeDailyLuckStore(store) {
  const source = store?.dailyLuck && typeof store.dailyLuck === "object" && !Array.isArray(store.dailyLuck)
    ? store.dailyLuck : {};
  store.dailyLuck = {
    seed: String(source.seed || createDailyLuckStoreSeed(store)),
    claimedDate: /^\d{8}$/.test(String(source.claimedDate || "")) ? String(source.claimedDate) : "",
    rewardId: String(source.rewardId || ""),
  };
  return store.dailyLuck;
}
function getDailyLuckOffer(store = getGuluStore(), dateKey = guluTodayKey()) {
  if (!store || !DAILY_LUCK_REWARD_POOL.length) return { ok: false, reason: "unavailable" };
  const key = String(dateKey || guluTodayKey());
  const source = store.dailyLuck && typeof store.dailyLuck === "object" && !Array.isArray(store.dailyLuck) ? store.dailyLuck : {};
  const state = {
    seed: String(source.seed || deriveDailyLuckFallbackSeed(store)),
    claimedDate: /^\d{8}$/.test(String(source.claimedDate || "")) ? String(source.claimedDate) : "",
    rewardId: String(source.rewardId || ""),
  };
  const reward = DAILY_LUCK_REWARD_POOL[hashDailyLuckSeed(`逆命蛊途|${state.seed}|${key}`) % DAILY_LUCK_REWARD_POOL.length];
  const detailHash = hashDailyLuckSeed(`${state.seed}|${key}|${reward.id}|detail`);
  let materialId = "";
  let label = reward.label;
  if (reward.kind === "materials" && typeof MATERIAL_IDS !== "undefined" && MATERIAL_IDS.length) {
    materialId = MATERIAL_IDS[detailHash % MATERIAL_IDS.length];
    label = `${MATERIALS[materialId]?.name || "基础炉材"} ×${reward.amount}`;
  } else if (reward.kind === "ecology" && typeof ECOLOGY_MATERIAL_IDS !== "undefined" && ECOLOGY_MATERIAL_IDS.length) {
    materialId = ECOLOGY_MATERIAL_IDS[detailHash % ECOLOGY_MATERIAL_IDS.length];
    label = `${ECOLOGY_MATERIALS[materialId]?.name || "生态异材"} ×${reward.amount}`;
  }
  return { ok: true, dateKey: key, seed: state.seed, claimed: state.claimedDate === key, reward: { ...reward, materialId, label } };
}
function grantDailyLuckReward(store = getGuluStore(), options = {}) {
  const dateKey = String(options.dateKey || guluTodayKey());
  const offer = getDailyLuckOffer(store, dateKey);
  if (!offer.ok || offer.claimed || (options.rewardId && options.rewardId !== offer.reward.id)) {
    return { ok: false, reason: offer.claimed ? "claimed" : "expired", text: offer.claimed ? "今日福缘已经领取。" : "今日福缘已经变化，请重新揭签。" };
  }
  const candidate = JSON.parse(JSON.stringify(store));
  normalizeDailyLuckStore(candidate);
  candidate.materials = candidate.materials && typeof candidate.materials === "object" ? candidate.materials : {};
  candidate.ecologyMaterials = candidate.ecologyMaterials && typeof candidate.ecologyMaterials === "object" ? candidate.ecologyMaterials : {};
  candidate.market = candidate.market && typeof candidate.market === "object" ? candidate.market : {};
  const reward = offer.reward;
  if (reward.kind === "scrip") candidate.market.scrip = normalizeRedeemOwnedAmount(candidate.market.scrip) + reward.amount;
  else if (reward.kind === "materials") candidate.materials[reward.materialId] = normalizeRedeemOwnedAmount(candidate.materials[reward.materialId]) + reward.amount;
  else if (reward.kind === "ecology") candidate.ecologyMaterials[reward.materialId] = normalizeRedeemOwnedAmount(candidate.ecologyMaterials[reward.materialId]) + reward.amount;
  else if (reward.kind === "boss-core") candidate.bossCores = normalizeRedeemOwnedAmount(candidate.bossCores) + reward.amount;
  else if (reward.kind === "embryo") candidate.guEmbryo = normalizeRedeemOwnedAmount(candidate.guEmbryo) + reward.amount;
  else if (reward.kind === "kindle") candidate.kindleSand = normalizeRedeemOwnedAmount(candidate.kindleSand) + reward.amount;
  else if (reward.kind === "ward") candidate.guWard = normalizeRedeemOwnedAmount(candidate.guWard) + reward.amount;
  else return { ok: false, reason: "forbidden", text: "这支福签不可结算。" };
  candidate.dailyLuck = { seed: offer.seed, claimedDate: dateKey, rewardId: reward.id };
  guluPushEvent(candidate, `每日福缘：${reward.label}已入库。`);
  if (saveGuluStore(candidate) === false) return { ok: false, reason: "persistence-failed", text: "福签未能落印，奖励未扣未发，请重试。" };
  Object.keys(store).forEach((key) => { delete store[key]; });
  Object.assign(store, candidate);
  return { ok: true, reward, text: `今日福缘：${reward.label}已入库。` };
}
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
  "guStones", "lifespan", "card", "relic", "satchel", "parkTicket",
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
  if (["scrip", "guStones", "lifespan", "parkTicket"].includes(type)) return { type, amount };
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
  let nurtureCap = store.nurture.slots.length;
  if (typeof getNurtureSlotCap === "function") {
    try { nurtureCap = Math.min(nurtureCap, Math.max(0, getNurtureSlotCap() | 0)); } catch (error) { /* 独立规则测试无进度模块时用数组长度 */ }
  }
  for (let index = 0; index < nurtureCap; index += 1) {
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
  if (reward.type === "parkTicket") return "游园帖";
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
  draft.park = draft.park && typeof draft.park === "object" && !Array.isArray(draft.park) ? draft.park : {};
  draft.park.tickets = Math.max(0, Math.floor(Number(draft.park.tickets) || 0));
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
    } else if (reward.type === "parkTicket") {
      const ticketCap = typeof PARK_TICKET_CAP !== "undefined" ? PARK_TICKET_CAP : 15;
      if (draft.park.tickets > ticketCap - reward.amount) return { ok: false, reason: "space" };
      draft.park.tickets += reward.amount;
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
 * 规则：低转二合一；高转献同名三／四／五转祭蛊，并消耗材料、炉料与蛊钱，把目标推高一转，最高九转。
 * 高转炉险只走 guluRandom 局外 RNG，不触碰 runState 或局内种子；失败保留目标并积累下次成功率。
 * 升转只改该蛊的 upgradeLevel，不直接改战斗数值，温养加成另算。 ===== */
/* V0.9.52 用户定调：合炼开到九转，且九转必须极难。转数 = upgradeLevel + 1，全库单源转名。 */
const GULU_TURN_NAMES = Object.freeze(["一转", "二转", "三转", "四转", "五转", "六转", "七转", "八转", "九转"]);
function guluTurnName(level) { return GULU_TURN_NAMES[Math.max(0, Math.min(GULU_TURN_NAMES.length - 1, level | 0))]; }
const FORGE_MAX_TURN = 8; // upgradeLevel 上限 8 ＝ 九转

/* 普通个体蛊的里程碑蜕变只寄存在现有蛊实例上。旧档读取时保持惰性：
 * 没有真实信号或玩家确认选择前，不给旧蛊补写 evolution。 */
const GU_EVOLUTION_VERSION = 1;
const GU_EVOLUTION_SIGNAL_CAP = 999;

function normalizeGuEvolution(slot, { create = false } = {}) {
  if (!slot || typeof slot !== "object") return null;
  const raw = slot.evolution;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    if (!create) return null;
    const initial = {
      version: GU_EVOLUTION_VERSION,
      signals: { rush: 0, guard: 0, resonance: 0 },
      signalBattles: 0,
      third: null,
      sixth: null,
      ninth: null,
    };
    slot.evolution = initial;
    return initial;
  }
  const safeCount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(GU_EVOLUTION_SIGNAL_CAP, Math.floor(numeric)));
  };
  const chosenAt = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
  };
  const thirdPaths = new Set(["rush", "guard", "resonance"]);
  const sixthMethods = new Set(["tamed", "unbound"]);
  const ninthOaths = new Set(["origin", "inverse"]);
  const normalized = {
    version: GU_EVOLUTION_VERSION,
    signals: {
      rush: safeCount(raw.signals?.rush),
      guard: safeCount(raw.signals?.guard),
      resonance: safeCount(raw.signals?.resonance),
    },
    signalBattles: safeCount(raw.signalBattles),
    third: thirdPaths.has(raw.third?.path)
      ? { path: raw.third.path, chosenAt: chosenAt(raw.third.chosenAt), rerolled: raw.third.rerolled === true }
      : null,
    sixth: sixthMethods.has(raw.sixth?.method)
      ? { method: raw.sixth.method, chosenAt: chosenAt(raw.sixth.chosenAt) }
      : null,
    ninth: ninthOaths.has(raw.ninth?.oath)
      ? { oath: raw.ninth.oath, chosenAt: chosenAt(raw.ninth.chosenAt) }
      : null,
  };
  if (create) {
    slot.evolution = normalized;
    return slot.evolution;
  }
  return normalized;
}

function getGuEvolutionSnapshot(slot) {
  const evolution = normalizeGuEvolution(slot, { create: false });
  return evolution ? JSON.parse(JSON.stringify(evolution)) : null;
}

function getGuEvolutionMilestoneState(slot) {
  const level = Math.max(0, Math.min(FORGE_MAX_TURN, Number(slot?.upgradeLevel) | 0));
  const evolution = normalizeGuEvolution(slot, { create: false });
  return {
    third: evolution?.third ? "chosen" : (level >= 2 ? "ready" : "locked"),
    sixth: evolution?.sixth ? "chosen" : (level >= 5 ? "ready" : "locked"),
    ninth: evolution?.ninth ? "chosen" : (level >= 8 ? "ready" : "locked"),
  };
}

function commitGuEvolutionSignals(store, entries) {
  if (!store || typeof store !== "object" || !Array.isArray(entries)) return { ok: false, reason: "invalid-input" };
  const merged = new Map();
  entries.forEach((entry) => {
    const guId = String(entry?.guId || "");
    if (!guId) return;
    const current = merged.get(guId) || { guId, rush: false, guard: false, resonance: false };
    current.rush = current.rush || Boolean(entry.rush);
    current.guard = current.guard || Boolean(entry.guard);
    current.resonance = current.resonance || Boolean(entry.resonance);
    merged.set(guId, current);
  });
  const candidate = JSON.parse(JSON.stringify(store));
  const owned = [
    ...(Array.isArray(candidate.slots) ? candidate.slots : []),
    ...(Array.isArray(candidate.nurture?.slots) ? candidate.nurture.slots : []),
  ];
  const updated = [];
  merged.forEach((entry, guId) => {
    if (!entry.rush && !entry.guard && !entry.resonance) return;
    const slot = owned.find((item) => item?.state === "gu" && String(item.id || "") === guId);
    if (!slot) return;
    const evolution = normalizeGuEvolution(slot, { create: true });
    if (entry.rush) evolution.signals.rush = Math.min(GU_EVOLUTION_SIGNAL_CAP, evolution.signals.rush + 1);
    if (entry.guard) evolution.signals.guard = Math.min(GU_EVOLUTION_SIGNAL_CAP, evolution.signals.guard + 1);
    if (entry.resonance) evolution.signals.resonance = Math.min(GU_EVOLUTION_SIGNAL_CAP, evolution.signals.resonance + 1);
    evolution.signalBattles = Math.min(GU_EVOLUTION_SIGNAL_CAP, evolution.signalBattles + 1);
    updated.push(guId);
  });
  if (!updated.length) return { ok: false, reason: "no-signals" };
  if (saveGuluStore(candidate) === false) return { ok: false, reason: "persistence-failed" };
  Object.assign(store, candidate);
  return { ok: true, updated };
}

function commitGuEvolutionChoice(store, guId, milestone, choice, options = {}) {
  if (!store || typeof store !== "object") return { ok: false, reason: "invalid-input" };
  const id = String(guId || "");
  const candidate = JSON.parse(JSON.stringify(store));
  const owned = [
    ...(Array.isArray(candidate.slots) ? candidate.slots : []),
    ...(Array.isArray(candidate.nurture?.slots) ? candidate.nurture.slots : []),
  ];
  const slot = owned.find((item) => item?.state === "gu" && String(item.id || "") === id);
  if (!slot) return { ok: false, reason: "gu-not-found" };
  const level = Math.max(0, Math.min(FORGE_MAX_TURN, Number(slot.upgradeLevel) | 0));
  const evolution = normalizeGuEvolution(slot, { create: true });
  const at = Math.max(1, Math.floor(Number(options.at) || Date.now()));

  if (milestone === "third") {
    if (!new Set(["rush", "guard", "resonance"]).has(choice)) return { ok: false, reason: "invalid-choice" };
    if (level < 2) return { ok: false, reason: "turn-locked" };
    if (evolution.third) {
      if (!options.reroll) {
        return evolution.third.path === choice
          ? { ok: true, changed: false, reason: "already-chosen" }
          : { ok: false, reason: "already-chosen" };
      }
      if (evolution.third.rerolled) return { ok: false, reason: "reroll-used" };
      if (level > 4 || evolution.sixth) return { ok: false, reason: "reroll-locked" };
      candidate.nurture = candidate.nurture && typeof candidate.nurture === "object" ? candidate.nurture : { slots: [] };
      if (Math.max(0, candidate.nurture.dew | 0) < 1) return { ok: false, reason: "dew-required" };
      candidate.nurture.dew = Math.max(0, candidate.nurture.dew | 0) - 1;
      evolution.third = { path: choice, chosenAt: at, rerolled: true };
    } else {
      if (options.reroll) return { ok: false, reason: "choice-required" };
      evolution.third = { path: choice, chosenAt: at, rerolled: false };
    }
  } else if (milestone === "sixth") {
    if (!new Set(["tamed", "unbound"]).has(choice)) return { ok: false, reason: "invalid-choice" };
    if (level < 5) return { ok: false, reason: "turn-locked" };
    if (!evolution.third) return { ok: false, reason: "third-required" };
    if (evolution.sixth) {
      return evolution.sixth.method === choice
        ? { ok: true, changed: false, reason: "already-chosen" }
        : { ok: false, reason: "already-chosen" };
    }
    evolution.sixth = { method: choice, chosenAt: at };
  } else if (milestone === "ninth") {
    if (!new Set(["origin", "inverse"]).has(choice)) return { ok: false, reason: "invalid-choice" };
    if (level < 8) return { ok: false, reason: "turn-locked" };
    if (!evolution.third) return { ok: false, reason: "third-required" };
    if (!evolution.sixth) return { ok: false, reason: "sixth-required" };
    if (evolution.ninth) {
      return evolution.ninth.oath === choice
        ? { ok: true, changed: false, reason: "already-chosen" }
        : { ok: false, reason: "already-chosen" };
    }
    evolution.ninth = { oath: choice, chosenAt: at };
  } else {
    return { ok: false, reason: "invalid-milestone" };
  }

  if (saveGuluStore(candidate) === false) return { ok: false, reason: "persistence-failed" };
  Object.assign(store, candidate);
  return { ok: true, changed: true, milestone, choice };
}

function getGuEvolutionChoiceModel(slot) {
  if (!slot || slot.state !== "gu") return null;
  const level = Math.max(0, Math.min(FORGE_MAX_TURN, Number(slot.upgradeLevel) | 0));
  const evolution = normalizeGuEvolution(slot, { create: false });
  const states = getGuEvolutionMilestoneState(slot);
  const pathNames = { rush: "疾行", guard: "护主", resonance: "共鸣" };
  const methodNames = { tamed: "驯炼", unbound: "纵炼" };
  const oathNames = { origin: "归真", inverse: "逆炼" };
  const signal = evolution?.signals || { rush: 0, guard: 0, resonance: 0 };
  const recommended = Object.entries(signal).sort((a, b) => b[1] - a[1])[0];
  const evidence = evolution && evolution.signalBattles > 0
    ? `倾向证据：疾行 ${signal.rush}、护主 ${signal.guard}、共鸣 ${signal.resonance}（${evolution.signalBattles} 场）；当前更常形成${pathNames[recommended?.[0]] || "未定"}。`
    : "倾向证据尚少；三个方向全部开放，不会替你随机作答。";
  const summary = `${evidence} 行性：${pathNames[evolution?.third?.path] || (level >= 2 ? "待定" : "三转解锁")}；养法：${methodNames[evolution?.sixth?.method] || (level >= 5 ? "待定" : "六转解锁")}；祖誓：${oathNames[evolution?.ninth?.oath] || (level >= 8 ? "待定" : "九转解锁")}。`;
  const thirdChoices = [
    { id: "rush", name: "疾行", condition: "前 2 回合首次催动", effect: "原卡结算后恢复 1 点真元", cost: "每场 1 次" },
    { id: "guard", name: "护主", condition: "生命不高于 50%", effect: "原卡结算后获得 4 点防御", cost: "每场 1 次" },
    { id: "resonance", name: "共鸣", condition: "本回合此前已催动另一张牌", effect: "抽 1 张，再选择弃 1 张", cost: "每场 1 次" },
  ];
  if (states.third === "ready") return { guId: String(slot.id || ""), milestone: "third", title: "三转·择定行性", hint: evidence, summary, reroll: false, choices: thirdChoices };
  if (states.sixth === "ready" && evolution?.third) {
    return {
      guId: String(slot.id || ""), milestone: "sixth", title: "六转·择定养法", hint: `保留${pathNames[evolution.third.path]}行性；选择只改变触发门槛或一次效果与反噬。`, summary, reroll: false,
      choices: [
        { id: "tamed", name: "驯炼", condition: "放宽当前行性的触发门槛", effect: "数值不变，触发更稳定", cost: "无额外反噬" },
        { id: "unbound", name: "纵炼", condition: "保留原触发门槛", effect: "回元/防御/抽牌强化", cost: "触发后该实例本场后续费用 +1" },
      ],
    };
  }
  if (states.ninth === "ready" && evolution?.third && evolution?.sixth) {
    return {
      guId: String(slot.id || ""), milestone: "ninth", title: "九转·择定祖誓", hint: "归真保留每局改养法的自由；逆炼永久锁路，换取每场第二次触发并在随后沉眠。", summary, reroll: false,
      choices: [
        { id: "origin", name: "归真", condition: "锁定三转行性", effect: "每次正式开局前可免费切换一次驯炼/纵炼", cost: "本场仍只触发 1 次" },
        { id: "inverse", name: "逆炼", condition: "永久锁定当前行性与养法", effect: "每场最多触发 2 次", cost: "第二次结算后，该实例本场沉眠" },
      ],
    };
  }
  const mayReroll = evolution?.third && !evolution.third.rerolled && level >= 2 && level <= 4 && !evolution.sixth;
  if (mayReroll) return { guId: String(slot.id || ""), milestone: "third", title: "三至五转·换性", hint: "一生仅此一次；确认后消耗 1 滴元髓露。", summary, reroll: true, choices: thirdChoices };
  return { guId: String(slot.id || ""), milestone: "", title: "蜕变已定", hint: "当前没有待确认的里程碑。", summary, reroll: false, choices: [] };
}

/* 玩家术语兼容层：保留旧档 grade / upgradeLevel / nurture 原值，
 * 只在展示边界拆成孵化路线、品质、转数、蛊格与温养。 */
function getGuluGradeTerms(gradeId) {
  const known = Object.prototype.hasOwnProperty.call(GULU_GRADES, gradeId);
  const normalizedId = known ? gradeId : "fan";
  const grade = GULU_GRADES[normalizedId];
  return Object.freeze({
    known,
    gradeId: normalizedId,
    track: grade.track,
    trackName: grade.trackName,
    quality: grade.quality,
    displayName: `${grade.trackName}·${grade.quality}`,
  });
}

function getGuluTurnTerms(upgradeLevel) {
  const numeric = Number(upgradeLevel);
  const normalizedLevel = Math.max(0, Math.min(FORGE_MAX_TURN, Number.isFinite(numeric) ? Math.floor(numeric) : 0));
  return Object.freeze({
    upgradeLevel: normalizedLevel,
    turn: normalizedLevel + 1,
    turnName: guluTurnName(normalizedLevel),
    rankName: getGuluRank(normalizedLevel).name,
  });
}

function getGuluNurtureTerms(value) {
  const numeric = Number(value);
  const normalizedValue = Math.max(0, Math.min(NURTURE_MAX, Number.isFinite(numeric) ? Math.floor(numeric) : 0));
  return Object.freeze({
    value: normalizedValue,
    max: NURTURE_MAX,
    full: normalizedValue >= NURTURE_MAX,
    displayName: `温养 ${normalizedValue}/${NURTURE_MAX}`,
  });
}
/* V0.9.80 炉方阶梯：一至六转维持同名同转二合一；六转以上改用同名低转祭品，
 * 让高转同时消耗玩家积存的低转蛊、材料、蛊钱、残核与蛊胎。完整递归成本由
 * getForgeJourneyMinimums() 唯一计算，UI 不另写一套总量。 */
const FORGE_RECIPES = Object.freeze({
  1: { fodder: 1, mats: 1, core: 0, embryo: 0, rate: 100, label: "一转 → 二转" },
  2: { fodder: 1, mats: 2, core: 0, embryo: 0, rate: 100, label: "二转 → 三转" },
  3: { fodder: 1, mats: 5, core: 0, embryo: 0, rate: 100, label: "三转 → 四转" },
  4: { fodder: 1, mats: 8, core: 0, embryo: 0, rate: 80, label: "四转 → 五转" },
  5: { fodder: 1, mats: 12, core: 1, embryo: 1, rate: 80, label: "五转 → 六转" },
  6: { fodder: 1, sacrificeLevel: 3, mats: 40, core: 3, embryo: 1, scrip: 30, rate: 65, kindleCap: 1, label: "六转 → 七转" },
  7: { fodder: 1, sacrificeLevel: 4, mats: 60, core: 5, embryo: 2, scrip: 60, rate: 50, kindleCap: 2, label: "七转 → 八转" },
  8: { fodder: 1, sacrificeLevel: 5, mats: 90, core: 8, embryo: 3, scrip: 120, rate: 35, kindleCap: 2, label: "八转 → 九转" },
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
  "cloudHorn+reverseScale": Object.freeze({ left: "cloudHorn", right: "reverseScale", result: "stormReverseHorn", rationale: "逆鳞以伤换鳞与杀势，行云角在龙形中续时：未化形养鳞，已化形续云。" }),
  "coiledShell+hollowNeedle": Object.freeze({ left: "coiledShell", right: "hollowNeedle", result: "coiledNeedleShell", rationale: "空窍针只争首发，盘蜕蛊专守收势：针蜕一体，先机刺敌、残局盘甲。" }),
  "erodeAge+prolongLife": Object.freeze({ left: "erodeAge", right: "prolongLife", result: "aeonLeech", rationale: "蚀岁从敌身夺回年华，续命把散岁纳入己身：伤敌之际直接续回寿元。" }),
  "essenceGathering+mysticCarapace": Object.freeze({ left: "essenceGathering", right: "mysticCarapace", result: "mysticEssenceCarapace", rationale: "聚元纳气续手，玄甲承元护身：真元、抽牌与厚甲在同一甲壳中流转。" }),
  "fixedFate+moonBlade": Object.freeze({ left: "fixedFate", right: "moonBlade", result: "fatedMoonGuard", rationale: "月刃先斩，定数随后结甲；若上一式并非护甲，命序便再添一层月护。" }),
  "focalLife+heartEater": Object.freeze({ left: "focalLife", right: "heartEater", result: "lastLightHeart", rationale: "回光焚寿令本回合攻势翻倍，噬心借两层血煞催发：寿火照心，第一击便承受回光。" }),
  "greenMiasma+shadowBind": Object.freeze({ left: "greenMiasma", right: "shadowBind", result: "miasmaShadowCarapace", rationale: "青瘴铺毒，缚影攻守同出：瘴气缠成影甲，一式同时伤敌、护身与施毒。" }),
  "hiddenMeridian+thunderGuide": Object.freeze({ left: "hiddenMeridian", right: "thunderGuide", result: "hiddenThunderMeridian", rationale: "伏脉留甲至后，引雷承前牌追击：雷势入脉，当前与下回合皆有护持。" }),
  "ironSkin+moltingShell": Object.freeze({ left: "ironSkin", right: "moltingShell", result: "venomMoltCarapace", rationale: "铁皮固甲，蜕壳只在既存毒势中引牌：毒蜕铁甲守住中毒触发条件。" }),
  "ironSkin+mulberryField": Object.freeze({ left: "ironSkin", right: "mulberryField", result: "boneBell", rationale: "铁皮固守，桑田催老：骨铃以护甲镇身并使敌衰老。" }),
  "jadeFang+mirrorCarapace": Object.freeze({ left: "jadeFang", right: "mirrorCarapace", result: "jadeMirrorFang", rationale: "玉牙借己甲催锋，镜壳照敌甲增护：獠甲同时辨认敌我甲势，攻守各取其强。" }),
  "lifeLamp+wineWorm": Object.freeze({ left: "wineWorm", right: "lifeLamp", result: "drunkFateWorm", rationale: "酒虫催攻，命灯聚势：醉命虫在命势中倍攻续手。" }),
  "mulberryField+vicissitudeTurtle": Object.freeze({ left: "mulberryField", right: "vicissitudeTurtle", result: "witheredMulberryTurtle", rationale: "桑田催岁，沧龟驮痕：枯桑只在五道岁纹内压敌结甲，尸傀无岁则不强催。" }),
  "rustMite+silenceMoth": Object.freeze({ left: "rustMite", right: "silenceMoth", result: "rustSilenceMoth", rationale: "锈螨蚀开甲缝布毒，息蛾吞声衰势回护：锈尘与寂粉相合，甲、毒、衰老同时受制。" }),
});
/* 新生态蛊先完成基础投放、克制闭环与真实强度验证，再进入异蛊合练。
 * 这里集中登记暂缓原因，避免覆盖审计被静默跳过，也避免为过门禁仓促复用旧产物。 */
const GULU_FUSION_DEFERRED = Object.freeze({
  boneStingBee: "新通用蛊先完成衰老追击强度验证；暂不仓促复用旧攻击产物，避免丢失弱化联动。",
  bloodReversal: "旧逆血+血潮配方会把高倍率引擎合成低倍率血月，已暂停；待有独占终结机制后再开放。",
  chaosBee: "乱蜂+青瘴会丢失乱蜂的直接攻击，已暂停；待有保留追毒攻击的独立产物后再开放。",
  fateThread: "命线+寿火会把两种稳定资源交换压成越级断命，已暂停；待产物同时保留命势经营与寿元代价后再开放。",
  insectSwarm: "虫群+青瘴的旧产物会全面覆盖前期毒系通用蛊，已暂停；待产物拥有不可替代的群袭触发后再开放。",
  lifeFlame: "寿火+命线会把两种稳定资源交换压成越级断命，已暂停；待产物同时保留命势经营与寿元代价后再开放。",
  pulseReturningSilkworm: "新通用蛊先验证半血分支的实战价值；暂不合练，避免产物抹平疗伤与护甲二择。",
  reversePath: "回息+逆途与命线+寿火共用断命蛊但语义不符，已暂停；待有安全的命势理牌独立产物后再开放。",
  sequenceCicada: "新通用蛊先验证换序续手的跨流派强度；暂不合练，避免重复既有抽弃类产物。",
  tideRendingMantis: "新通用蛊先验证先碎甲后攻击的节奏；暂不合练，避免与旧破甲产物同质化。",
  venomLurkingSpider: "新通用蛊先验证毒势护甲的防守曲线；暂不合练，避免复用旧毒甲产物造成数值覆盖。",
});
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
  bloodCost: "血煞消耗", perPlayed: "此前每张追加", perPlayedCap: "此前出牌上限",
  baseHeal: "基础恢复", bloodPerHeal: "每次恢复所需血煞", healCap: "恢复上限",
  poisonPerArmor: "每点防御所需毒性", armorCap: "追加防御上限", empoweredDamage: "条件伤害",
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
  const origin = Math.max(0, Math.min(FORGE_MAX_TURN, startLevel | 0));
  const costToReach = (targetLevel) => {
    if (targetLevel <= origin) return { gu: 1, materials: 0, cores: 0, embryos: 0, scrip: 0, peakSlots: 1 };
    let total = { gu: 1, materials: 0, cores: 0, embryos: 0, scrip: 0, peakSlots: 1 };
    for (let level = origin; level < targetLevel; level += 1) {
      const recipe = getForgeRecipe(level);
      const sacrificeTarget = recipe.sacrificeLevel ? Math.max(origin, recipe.sacrificeLevel - 1) : level;
      const sacrifice = recipe.fodder > 0
        ? (recipe.sacrificeLevel ? costToReach(sacrificeTarget) : { ...total })
        : { gu: 0, materials: 0, cores: 0, embryos: 0, scrip: 0, peakSlots: 0 };
      total = {
        gu: total.gu + sacrifice.gu,
        materials: total.materials + sacrifice.materials + (recipe.mats | 0),
        cores: total.cores + sacrifice.cores + (recipe.core | 0),
        embryos: total.embryos + sacrifice.embryos + (recipe.embryo | 0),
        scrip: total.scrip + sacrifice.scrip + (recipe.scrip | 0),
        peakSlots: Math.max(total.peakSlots, sacrifice.peakSlots + 1),
      };
    }
    return total;
  };
  const total = costToReach(FORGE_MAX_TURN);
  /* 同源等价总账：一转直达九转共 60 只、材料 321、残核 17、蛊胎 7、蛊钱 210。 */
  return {
    totalEquivalentGu: total.gu,
    additionalEquivalentGu: total.gu - 1,
    materials: total.materials,
    cores: total.cores,
    embryos: total.embryos,
    scrip: total.scrip,
    peakSlots: total.peakSlots,
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
/* 找可作燃料的同名成蛊：六转前取同转，六转以上按炉方取三/四/五转祭品。 */
function findForgeFodder(store, target) {
  if (!store || !target) return [];
  const plotSlots = (store.slots || []).filter((g, i) => i < getGuluSlotCap() && g);
  const nurtureSlots = Array.isArray(store.nurture?.slots)
    ? store.nurture.slots.filter((g, i) => i < getNurtureSlotCap() && g)
    : [];
  const recipe = getForgeRecipe(target.upgradeLevel | 0);
  const requiredLevel = recipe?.sacrificeLevel ? recipe.sacrificeLevel - 1 : (target.upgradeLevel | 0);
  return [...plotSlots, ...nurtureSlots].filter((g) => g.id !== target.id
    && g.state === "gu" && !g.carry && !isGuluSourceLocked(g.id)
    && g.cardKey === target.cardKey
    && (g.upgradeLevel | 0) === requiredLevel);
}
function removeForgeFodderById(store, guId) {
  const plotIndex = (store.slots || []).findIndex((slot, index) => index < getGuluSlotCap() && slot?.id === guId);
  if (plotIndex >= 0) { store.slots[plotIndex] = null; return true; }
  const nurtureSlots = Array.isArray(store.nurture?.slots) ? store.nurture.slots : [];
  const nurtureIndex = nurtureSlots.findIndex((slot, index) => index < getNurtureSlotCap() && slot?.id === guId);
  if (nurtureIndex >= 0) { nurtureSlots[nurtureIndex] = null; return true; }
  return false;
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
    const candidateSlots = [
      ...(store.slots || []).filter((g, i) => i < getGuluSlotCap() && g),
      ...(Array.isArray(store.nurture?.slots) ? store.nurture.slots.filter((g, i) => i < getNurtureSlotCap() && g) : []),
    ];
    const hasLockedFodder = candidateSlots.some((g) => g.id !== target.id
      && g.state === "gu" && !g.carry && isGuluSourceLocked(g.id)
      && g.cardKey === target.cardKey
      && (g.upgradeLevel | 0) === (recipe.sacrificeLevel ? recipe.sacrificeLevel - 1 : level));
    if (hasLockedFodder) return { ok: false, blocked: true, reason: "此蛊正在塔中随行", recipe, fodder };
    const sacrificeName = recipe.sacrificeLevel ? `同名${guluTurnName(recipe.sacrificeLevel - 1)}祭品` : "同名同转的蛊";
    return { ok: false, reason: `需另备 ${recipe.fodder} 只${sacrificeName}（现有 ${fodder.length} 只；随行中的不计）。`, recipe, fodder };
  }
  const total = MATERIAL_IDS.reduce((sum, id) => sum + normalizeRedeemOwnedAmount(store.materials[id]), 0);
  if (total < recipe.mats) return { ok: false, reason: `材料不足：需 ${recipe.mats} 份，现有 ${total} 份。`, recipe, fodder };
  if ((recipe.core | 0) > 0 && (store.bossCores | 0) < recipe.core) {
    return { ok: false, reason: `缺蛊母残核：需 ${recipe.core} 枚（Boss 战利，须活着带出塔）。`, recipe, fodder };
  }
  if ((recipe.embryo | 0) > 0 && (store.guEmbryo | 0) < recipe.embryo) {
    return { ok: false, reason: `缺蛊胎：需 ${recipe.embryo} 枚（百蛊市奇物行限量）。`, recipe, fodder };
  }
  const scrip = normalizeRedeemOwnedAmount(store.market?.scrip);
  if ((recipe.scrip | 0) > 0 && scrip < recipe.scrip) {
    return { ok: false, reason: `蛊钱不足：需 ${recipe.scrip} 枚，现有 ${scrip} 枚。`, recipe, fodder };
  }
  return { ok: true, recipe, fodder };
}

function getForgeReclaimMaterial(settlement) {
  const consumed = settlement?.consumed?.materialsById;
  if (!consumed || typeof consumed !== "object") return "";
  let chosen = "";
  let chosenAmount = 0;
  MATERIAL_IDS.forEach((materialId) => {
    const amount = normalizeRedeemOwnedAmount(consumed[materialId]);
    if (amount > chosenAmount) {
      chosen = materialId;
      chosenAmount = amount;
    }
  });
  return chosen;
}

function canOfferForgeFailureReclaim(context = {}) {
  const { store, result, currentStore, currentResult, ritualOpen, dateKey, currentDateKey } = context;
  const reclaim = result?.settlement?.rewardedReclaim;
  return Boolean(
    store
    && result?.ok === true
    && result.forged !== true
    && result.warded !== true
    && ritualOpen === true
    && (!currentStore || currentStore === store)
    && (!currentResult || currentResult === result)
    && String(dateKey || "") !== ""
    && String(currentDateKey || "") === String(dateKey)
    && reclaim
    && reclaim.claimed !== true
    && MATERIAL_IDS.includes(reclaim.materialId)
    && normalizeRedeemOwnedAmount(result.settlement?.consumed?.materialsById?.[reclaim.materialId]) > 0
    && canGrantNewRewardedPlacement(store, "forge_failure_reclaim", dateKey)
  );
}

function grantForgeFailureReclaim(context = {}) {
  if (!canOfferForgeFailureReclaim(context)) return { ok: false, amount: 0 };
  const { store, result, dateKey } = context;
  const reclaim = result.settlement.rewardedReclaim;
  const materialId = reclaim.materialId;
  const before = normalizeRedeemOwnedAmount(store.materials?.[materialId]);
  if (!store.materials || typeof store.materials !== "object") return { ok: false, amount: 0 };
  reclaim.claimed = true;
  store.materials[materialId] = before + 1;
  if (!recordNewRewardedGrant(store, "forge_failure_reclaim", dateKey)) {
    store.materials[materialId] = before;
    reclaim.claimed = false;
    return { ok: false, amount: 0 };
  }
  return { ok: true, materialId, amount: 1 };
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
  const kindleLimit = Number.isFinite(recipe.kindleCap) ? recipe.kindleCap : (store.kindleSand | 0);
  const kindle = risky ? Math.max(0, Math.min(store.kindleSand | 0, kindleLimit, opts.kindle | 0)) : 0;
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
      materialsById: {},
      core: recipe.core | 0,
      embryo: recipe.embryo | 0,
      scrip: recipe.scrip | 0,
      kindle,
      ward: 0,
    },
    refunded: { core: 0, embryo: 0 },
    pityBefore: pityBonus,
    pityAfter: pityBonus,
  };
  fodder.slice(0, recipe.fodder).forEach((g) => {
    removeForgeFodderById(store, g.id);
  });
  let need = recipe.mats;
  MATERIAL_IDS.slice().sort((a, b) => normalizeRedeemOwnedAmount(store.materials[b]) - normalizeRedeemOwnedAmount(store.materials[a])).forEach((id) => {
    if (need <= 0) return;
    const take = Math.min(need, normalizeRedeemOwnedAmount(store.materials[id]));
    store.materials[id] = normalizeRedeemOwnedAmount(store.materials[id]) - take;
    if (take > 0) settlementBase.consumed.materialsById[id] = take;
    need -= take;
  });
  if ((recipe.core | 0) > 0) store.bossCores = (store.bossCores | 0) - recipe.core; // 六转起收蛊母残核
  if ((recipe.embryo | 0) > 0) store.guEmbryo = (store.guEmbryo | 0) - recipe.embryo; // 六转起收蛊胎
  if ((recipe.scrip | 0) > 0) store.market.scrip = normalizeRedeemOwnedAmount(store.market?.scrip) - recipe.scrip;
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
  const settlement = { ...settlementBase, toLevel: target.upgradeLevel, toTurn: fromTurn, pityAfter: target.forgePity };
  const reclaimMaterialId = getForgeReclaimMaterial(settlement);
  if (reclaimMaterialId) settlement.rewardedReclaim = { materialId: reclaimMaterialId, claimed: false };
  return {
    ok: true, forged: false, preserved: true, rate, pity: target.forgePity,
    text: `炉火失衡——${name}仍在${fromTurn}，本次投入已耗；下次成功率再 +${target.forgePity}%。`, level: target.upgradeLevel,
    settlement,
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
  if (typeof recordEcologyRetentionAction === "function") recordEcologyRetentionAction(store, "fusion", Date.now());
  syncOwnedGuluDiscoveries(store);
  const text = `异蛊合练功成：${CARD_LIBRARY[first.cardKey]?.name || first.cardKey}与${CARD_LIBRARY[second.cardKey]?.name || second.cardKey}归一，炼成${guluTurnName(plan.resultLevel)}「${resultName}」。`;
  guluPushEvent(store, `${text}耗材料 ${plan.materialCost} 份。`);
  return { ok: true, fused: true, forged: true, text, resultCardKey: plan.resultCardKey, resultName, level: plan.resultLevel };
}

// 蛊庐 UI 门控：宿主广告能力可用时才显示；网页/无 tap 恒 false，局外入口静默隐藏。
function guluRewardedAdReady() {
  return typeof isOutgameRewardedPlayerEligible === "function" && isOutgameRewardedPlayerEligible();
}
function guluTrackRewardedOffer(placement, offerKey, context = {}) {
  if (!guluRewardedAdReady() || typeof NmgAds.trackOffer !== "function") return false;
  return NmgAds.trackOffer(placement, offerKey, context);
}
function renderGuluRewardedAdNotice() {
  return "";
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

function getBaigushiMarketState(store, dateKey = guluTodayKey()) {
  if (!store.market || typeof store.market !== "object") store.market = {};
  const key = String(dateKey || guluTodayKey());
  if (!store.market.catalog || store.market.catalog.dateKey !== key) {
    store.market.catalog = { dateKey: key, refreshIndex: 0, bought: {}, daoUnlocks: {}, parkTicketCount: 0 };
  }
  const state = store.market.catalog;
  state.refreshIndex = Math.max(0, Math.min(BAIGUSHI_MARKET_RULES.refreshLimit, state.refreshIndex | 0));
  state.bought = state.bought && typeof state.bought === "object" ? state.bought : {};
  state.daoUnlocks = state.daoUnlocks && typeof state.daoUnlocks === "object" ? state.daoUnlocks : {};
  state.parkTicketCount = Math.max(0, Math.min(BAIGUSHI_MARKET_RULES.parkTicketDailyLimit, state.parkTicketCount | 0));
  return state;
}

function getCurrentBaigushiMarketCatalog(store, dateKey = guluTodayKey()) {
  const state = getBaigushiMarketState(store, dateKey);
  const heroIds = typeof BENMING_GU === "object" ? Object.keys(BENMING_GU) : Object.keys(HERO_EXCLUSIVE_CARD_KEYS || {});
  return buildBaigushiMarketCatalog({
    dateKey: state.dateKey,
    refreshIndex: state.refreshIndex,
    heroIds,
    heroExclusiveKeys: typeof HERO_EXCLUSIVE_CARD_KEYS === "object" ? HERO_EXCLUSIVE_CARD_KEYS : {},
    standardKeys: typeof STANDARD_REWARD_CARD_KEYS === "object" ? STANDARD_REWARD_CARD_KEYS : [],
    cardLibrary: CARD_LIBRARY,
    daoByHero: Object.fromEntries(heroIds.map((heroId) => [heroId, typeof getBenmingDaoxing === "function" ? getBenmingDaoxing(heroId) : 0])),
    stageByHero: Object.fromEntries(heroIds.map((heroId) => [heroId, typeof getBenmingStage === "function" ? getBenmingStage(heroId) : 0])),
    selectedHeroId: progression?.selectedHeroId || "",
  });
}

function findBaigushiMarketOffer(catalog, offerId) {
  const target = String(offerId || "");
  const primary = catalog.primaryOffers.find((offer) => offer.id === target);
  if (primary) return { offer: primary, section: "primary", unlocked: true };
  for (const path of catalog.otherPaths) {
    const offer = path.offers.find((entry) => entry.id === target);
    if (offer) return { offer, section: "other", path, unlocked: path.unlocked };
  }
  const ordinary = catalog.ordinaryOffers.find((offer) => offer.id === target);
  return ordinary ? { offer: ordinary, section: "ordinary", unlocked: true } : null;
}

function buyBaigushiMarketOffer(offerId, dateKey = guluTodayKey(), now = guluNow()) {
  const store = getGuluStore();
  const state = getBaigushiMarketState(store, dateKey);
  const catalog = getCurrentBaigushiMarketCatalog(store, dateKey);
  const found = findBaigushiMarketOffer(catalog, offerId);
  if (!found) return { ok: false, text: "这枚蛊卵已不在今日市册中。" };
  if (state.bought[found.offer.id]) return { ok: false, text: "这枚蛊卵今日已经售出。" };
  if (found.section === "other" && !found.unlocked && !state.daoUnlocks[found.path.heroId]) {
    return { ok: false, locked: true, heroId: found.path.heroId, text: "这条异脉尚未开放，可提升本命境界或从今日广告契中解锁。" };
  }
  const slotIndex = store.slots.findIndex((slot, index) => index < getGuluSlotCap() && !slot);
  if (slotIndex < 0) return { ok: false, text: "蛊圃已满，请先空出一圃。" };
  const price = Math.max(0, found.offer.price | 0);
  if (normalizeRedeemOwnedAmount(store.market.scrip) < price) return { ok: false, text: `蛊钱不足：需要 ${price} 枚。` };
  store.serial = Math.max(0, store.serial | 0) + 1;
  store.market.scrip -= price;
  store.market.purchases = Math.max(0, store.market.purchases | 0) + 1;
  state.bought[found.offer.id] = true;
  const grade = found.offer.grade;
  store.slots[slotIndex] = {
    id: `gu${store.serial}`,
    state: "egg",
    grade,
    heroId: found.offer.heroId || "",
    fixedCardKey: found.offer.cardKey,
    startedAt: now,
    hatchAt: now + (GULU_GRADES[grade]?.hatchMs || BAIGUSHI_HATCH_MS),
    carry: false,
    marketCatalog: true,
  };
  saveGuluStore();
  const cardName = CARD_LIBRARY[found.offer.cardKey]?.name || "蛊卵";
  return { ok: true, offerId: found.offer.id, cardKey: found.offer.cardKey, slotIndex, text: `${cardName}已落入第 ${slotIndex + 1} 圃，余蛊钱 ${store.market.scrip}。` };
}

function refreshBaigushiOrdinaryMarket(dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const state = getBaigushiMarketState(store, dateKey);
  if (state.refreshIndex >= BAIGUSHI_MARKET_RULES.refreshLimit) return { ok: false, text: "今日两次换市机会已经用尽。" };
  if (normalizeRedeemOwnedAmount(store.market.scrip) < BAIGUSHI_MARKET_RULES.refreshCost) return { ok: false, text: `蛊钱不足：换市需要 ${BAIGUSHI_MARKET_RULES.refreshCost} 枚。` };
  store.market.scrip -= BAIGUSHI_MARKET_RULES.refreshCost;
  state.refreshIndex += 1;
  saveGuluStore();
  return { ok: true, refreshIndex: state.refreshIndex, text: `普通蛊池已换市，今日还可刷新 ${BAIGUSHI_MARKET_RULES.refreshLimit - state.refreshIndex} 次。` };
}

function canUnlockBaigushiDaoPath(store, heroId, dateKey = guluTodayKey()) {
  const state = getBaigushiMarketState(store, dateKey);
  const catalog = getCurrentBaigushiMarketCatalog(store, dateKey);
  const path = catalog.otherPaths.find((entry) => entry.heroId === heroId);
  return Boolean(path && !path.unlocked && !state.daoUnlocks[heroId]);
}

function grantBaigushiDaoPathUnlock(store, heroId, dateKey = guluTodayKey(), options = {}) {
  if (!canUnlockBaigushiDaoPath(store, heroId, dateKey)) return { ok: false, text: "这条异脉当前无需解锁。" };
  const unlocks = getBaigushiMarketState(store, dateKey).daoUnlocks;
  const hadUnlock = Object.prototype.hasOwnProperty.call(unlocks, heroId);
  const beforeUnlock = unlocks[heroId];
  unlocks[heroId] = true;
  const save = typeof options.save === "function" ? options.save : saveGuluStore;
  if (save(store) === false) {
    if (hadUnlock) unlocks[heroId] = beforeUnlock;
    else delete unlocks[heroId];
    return { ok: false, reason: "persistence-failed", text: "本地保存失败，今日寄售未解锁。" };
  }
  return { ok: true, heroId, text: `${BENMING_GU?.[heroId]?.name || "异脉"}今日寄售已开放。` };
}

function canClaimBaigushiMarketParkTicket(store, dateKey = guluTodayKey(), options = {}) {
  const state = getBaigushiMarketState(store, dateKey);
  const tickets = Math.max(0, store?.park?.tickets | 0);
  if (options.adAvailable === false || (options.adAvailable == null && !guluRewardedAdReady())) return { ok: false, reason: "ad-unavailable", count: state.parkTicketCount, remaining: BAIGUSHI_MARKET_RULES.parkTicketDailyLimit - state.parkTicketCount };
  if (tickets >= PARK_TICKET_CAP) return { ok: false, reason: "ticket-cap", count: state.parkTicketCount, remaining: BAIGUSHI_MARKET_RULES.parkTicketDailyLimit - state.parkTicketCount };
  if (state.parkTicketCount >= BAIGUSHI_MARKET_RULES.parkTicketDailyLimit) return { ok: false, reason: "daily-cap", count: state.parkTicketCount, remaining: 0 };
  return { ok: true, count: state.parkTicketCount, remaining: BAIGUSHI_MARKET_RULES.parkTicketDailyLimit - state.parkTicketCount };
}

function grantBaigushiMarketParkTicket(store, dateKey = guluTodayKey(), options = {}) {
  const eligibility = canClaimBaigushiMarketParkTicket(store, dateKey, options);
  if (!eligibility.ok) return eligibility;
  const state = getBaigushiMarketState(store, dateKey);
  const beforeTickets = store.park.tickets | 0;
  const beforeCount = state.parkTicketCount | 0;
  store.park.tickets = Math.min(PARK_TICKET_CAP, beforeTickets + 1);
  state.parkTicketCount = beforeCount + 1;
  const save = typeof options.save === "function" ? options.save : saveGuluStore;
  if (save(store) === false) {
    store.park.tickets = beforeTickets;
    state.parkTicketCount = beforeCount;
    return { ok: false, reason: "persistence-failed", count: beforeCount, remaining: BAIGUSHI_MARKET_RULES.parkTicketDailyLimit - beforeCount };
  }
  return { ok: true, count: state.parkTicketCount, remaining: BAIGUSHI_MARKET_RULES.parkTicketDailyLimit - state.parkTicketCount, text: `百蛊市游园帖 +1（今日 ${state.parkTicketCount}/${BAIGUSHI_MARKET_RULES.parkTicketDailyLimit}）。` };
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

/* 残核匣·三枚装：V0.9.80 一转直达九转零失败共要 17 枚残核。 */
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
  const wardMax = getBaigushiWardMax();
  if ((store.market.deathWard | 0) >= wardMax) return { ok: false, text: `护命蛊匣已备妥，库存上限为 ${wardMax}。` };
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
  const originKind = slot.retentionSource === FIRST_RETURN_EGG_SOURCE
    ? "return"
    : (slot.marketRecipe ? "market" : "hatch");
  normalizeGuluLifeRecord(slot, { kind: originKind, at: guluNow(), version: "V0.9.76" });
  const isNew = !guluCollectionEntry(store, slot.cardKey, false);
  const entry = guluCollectionEntry(store, slot.cardKey, true);
  entry.hatchedCount = Math.max(0, entry.hatchedCount | 0) + 1;
  const oldRank = GULU_GRADES[entry.highestGrade]?.rank || 0;
  if ((GULU_GRADES[slot.grade]?.rank || 1) > oldRank) entry.highestGrade = slot.grade;
  if (isNew && !store.collectionUnread.includes(slot.cardKey)) store.collectionUnread.push(slot.cardKey);
  if (typeof recordEcologyRetentionAction === "function") recordEcologyRetentionAction(store, "hatch", Date.now());
}
function recordGuluFusion(store, slot) {
  if (!slot?.cardKey) return;
  normalizeGuluLifeRecord(slot, { kind: "fusion", at: guluNow(), version: "V0.9.76" });
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
  const slots = [
    ...(Array.isArray(store?.slots) ? store.slots : []),
    ...(Array.isArray(store?.nurture?.slots) ? store.nurture.slots : []),
  ].filter((slot) => slot && slot.state === "gu" && slot.cardKey === cardKey);
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
      if (slot.retentionSource === FIRST_RETURN_EGG_SOURCE) {
        const firstReturnEgg = normalizeFirstReturnEggState(s);
        if (firstReturnEgg && String(firstReturnEgg.eggId) === String(slot.id)) {
          firstReturnEgg.status = "hatched";
          firstReturnEgg.guId = String(slot.id);
          firstReturnEgg.hatchedAt = now;
          firstReturnEgg.claimedAt = 0;
          firstReturnEgg.claimedBy = "";
          firstReturnEgg.viewedAt = 0;
          firstReturnEgg.carriedAt = 0;
          firstReturnEgg.validatedAt = 0;
          firstReturnEgg.validationRewardClaimedAt = 0;
          firstReturnEgg.validationStats = { uses: 0, damage: 0, armor: 0, healing: 0 };
        }
      }
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
  if (!slot.carry && CARD_LIBRARY[slot.cardKey]?.parkRare === true
    && s.slots.some((g) => g && g.state === "gu" && g.carry && CARD_LIBRARY[g.cardKey]?.parkRare === true)) {
    return { ok: false, text: "珍稀蛊每局最多随行 1 只；请先让另一只珍稀蛊归圃。" };
  }
  slot.carry = !slot.carry;
  if (slot.carry && typeof recordEcologyRetentionAction === "function") recordEcologyRetentionAction(s, "carry", guluNow());
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
  if (typeof normalizeGuluLifeRecord === "function") normalizeGuluLifeRecord(slot);
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
  let finalValues = {};
  let currentEffect = "蛊性不明，暂无法辨识其战斗效果。";
  let nextEffect = "";
  let finalEffect = "蛊性不明，暂无法推演九转终境。";
  let nextDelta = "";
  let finalDelta = "";
  const finalLevel = typeof FORGE_MAX_TURN === "number" ? FORGE_MAX_TURN : 8;
  if (definition && typeof getCardValues === "function") {
    try { currentValues = getCardValues(entry, level) || {}; } catch (error) { currentValues = {}; }
    if (level < finalLevel) {
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
    const finalEntry = { ...entry, upgradeLevel: finalLevel };
    try { finalValues = getCardValues(finalEntry, finalLevel) || {}; } catch (error) { finalValues = {}; }
    if (typeof getCardEffect === "function") {
      try { finalEffect = getCardEffect(finalEntry, finalLevel) || finalEffect; } catch (error) { /* 保留降级文案 */ }
    }
    if (level < finalLevel && typeof getRefineDeltaText === "function") {
      finalDelta = getRefineDeltaText(entry, level, finalLevel) || "";
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
  const origin = slot.life?.origin || { kind: "legacy", label: "旧档留存", at: 0, version: "" };
  const journey = slot.life?.journey || { runs: 0, battles: 0, bossWins: 0, events: [] };
  const originDate = origin.at > 0 ? new Date(origin.at).toLocaleDateString("zh-CN") : "日期未留存";
  const originSummary = `${origin.label} · ${originDate}${origin.version ? ` · ${origin.version}` : ""}`;
  const journeySummary = `随行 ${journey.runs} 局 · 经历 ${journey.battles} 场战斗 · 首领胜局 ${journey.bossWins}`;
  const journeyEvents = (journey.events || []).slice().reverse().map((event) => `${event.label}${event.at ? ` · ${new Date(event.at).toLocaleDateString("zh-CN")}` : ""}`);
  const resourceCapSummary = resourceCaps.length
    ? resourceCaps.map((item) => `${item.label}于${item.capTurn}封顶（${item.value}）`).join("；")
    : "";
  const replacementSummary = resourceCaps.length && nextDelta
    ? `核心资源封顶后改为定位成长：${nextDelta}。`
    : "";
  const isFinalTurn = level >= finalLevel;
  const evolutionModel = typeof getGuEvolutionChoiceModel === "function" ? getGuEvolutionChoiceModel(slot) : null;
  return {
    guId: String(slot.id || ""), entry,
    displayName: slot.customName || slot.name || definition?.name || "蛊性不明",
    cardName: definition?.name || "蛊性不明",
    gradeName, turnName, rankName,
    currentValues, currentEffect, nextValues, nextEffect,
    finalValues, finalEffect, isFinalTurn,
    nextSummary: isFinalTurn ? "已达九转，不再显示下一转预览。" : (nextDelta || "下一转暂无数值变化。"),
    finalSummary: isFinalTurn
      ? "九转已成：当前效果即为这只蛊的最终战斗效果。"
      : `九转终境：${finalDelta || "最终转数暂未产生额外数值变化。"}。`,
    resourceCaps, resourceCapSummary, replacementSummary, sourceSummary,
    originSummary, journeySummary, journeyEvents,
    evolutionSummary: evolutionModel?.summary || "尚未形成个体蜕变记录。",
    evolutionAction: evolutionModel?.choices?.length ? {
      milestone: evolutionModel.milestone,
      label: evolutionModel.reroll ? "消耗元髓露换性" : `查看${evolutionModel.title}`,
    } : null,
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
const PARK_ACTIVITY_IDS = Object.freeze(["quiz", "spring"]);
let parkActivityFocusId = ""; // 纯 UI 焦点，不进蛊庐存档/runState/game
function setParkActivityFocus(activityId) {
  const next = String(activityId || "");
  if (PARK_ACTIVITY_IDS.includes(next)) parkActivityFocusId = next;
  return parkActivityFocusId;
}
function resolveParkActivityFocus(context) {
  if (PARK_ACTIVITY_IDS.includes(parkActivityFocusId)) return parkActivityFocusId;
  return setParkActivityFocus(!context?.quizDone && context?.quiz?.ok ? "quiz" : "spring");
}
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
let guluForgeStepSelected = -1; // 纯 UI 炉方焦点；点击环鼎大写数字后才展开概率与消耗
let guluForgeCostTargetId = ""; // 纯 UI 成长/直达九转成本阅读目标；详情脱离横向卡片，避免短横屏裁切
const GULU_FORGE_ENTRY_HINT_MS = 2000;
let guluForgeEntryHintVisible = false;
let guluForgeEntryHintTimer = null;
function showGuluForgeEntryHint() {
  if (guluForgeEntryHintTimer) window.clearTimeout(guluForgeEntryHintTimer);
  guluForgeEntryHintVisible = true;
  guluForgeEntryHintTimer = window.setTimeout(() => {
    guluForgeEntryHintTimer = null;
    guluForgeEntryHintVisible = false;
    if (guluActiveTab === "forge" && dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) renderGulu();
  }, GULU_FORGE_ENTRY_HINT_MS);
}
let guluFusionSelectionIds = []; // 纯 UI 合练选择；真正结果仍只写 guluStore
let guluMarketStall = "market";
let guluOrdinaryMarketOpen = false; // 纯 UI 市集视图态；每日库存仍只读 marketState
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
function openParkGuDonationConfirm(guId) {
  const preview = getParkGuDonationPreview(getGuluStore(), guId);
  if (!preview.ok) { guluNoticeText = preview.text; renderGulu(); return preview; }
  if (!dom.guluActionConfirm) return { ok: false, text: "确认层暂不可用。" };
  guluPendingAction = { kind: "park-gu", guId: preview.guId };
  dom.guluActionConfirmTitle.textContent = "不可逆捐纳成蛊";
  dom.guluActionConfirmText.textContent = `${preview.text}\n确认后不能取回；若存档写入失败，本次不会移除成蛊。`;
  renderGuluForgeKindleControls({ kind: "park-gu", kindleHave: 0 });
  dom.guluActionConfirmCancel.textContent = "暂且留下";
  dom.guluActionConfirmOk.textContent = "确认捐纳";
  dom.guluActionConfirm.classList.remove("is-tian", "is-feed-risk");
  dom.guluActionConfirm.classList.remove("hidden");
  window.setTimeout(() => dom.guluActionConfirmCancel?.focus(), 0);
  return preview;
}
function getGuluForgeKindleMax(preview) {
  return Math.max(0, Math.min(preview.kindleHave, preview.recipeKindleCap, Math.ceil((FORGE_RATE_CAP - preview.baseRate) / FORGE_KINDLE_BONUS)));
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
  const recipeKindleCap = Number.isFinite(chk.recipe.kindleCap) ? chk.recipe.kindleCap : kindleHave;
  const kindleMax = risky ? Math.max(0, Math.min(kindleHave, recipeKindleCap, Math.ceil((FORGE_RATE_CAP - baseRate) / FORGE_KINDLE_BONUS))) : 0;
  guluForgeKindle = Math.max(0, Math.min(kindleMax, guluForgeKindle | 0));
  const kindle = guluForgeKindle;
  const rate = getForgeSuccessRate(slot.upgradeLevel, kindle, nurtureBonus, pityBonus, qualityBonus);
  const warded = risky && (s.guWard | 0) > 0;
  const companion = chk.recipe.sacrificeLevel ? `同名${guluTurnName(chk.recipe.sacrificeLevel - 1)}祭品` : "同名同转蛊";
  const cost = `${companion} ${chk.recipe.fodder} 只 ＋ 材料 ${chk.recipe.mats}`
    + ((chk.recipe.core | 0) > 0 ? ` ＋ 残核 ${chk.recipe.core}` : "")
    + ((chk.recipe.embryo | 0) > 0 ? ` ＋ 蛊胎 ${chk.recipe.embryo}` : "")
    + ((chk.recipe.scrip | 0) > 0 ? ` ＋ 蛊钱 ${chk.recipe.scrip}` : "")
    + (kindle > 0 ? ` ＋ 引火砂 ${kindle}` : "");
  return {
    ok: true, kind: risky ? "risk" : "stable", slotId: slot.id, kindle, kindleHave, kindleMax, recipeKindleCap, recipeRate, nurtureBonus, pityBonus, qualityBonus, baseRate, rate,
    title: `入炉 · 炼至${turnNext}`,
    text: risky
      ? `成功率 ${rate}%（炉方 ${recipeRate}%${qualityBonus > 0 ? ` ＋ 精品 ${qualityBonus}%` : ""}${nurtureBonus > 0 ? ` ＋ 温养 ${nurtureBonus}%` : ""}${pityBonus > 0 ? ` ＋ 失败积累 ${pityBonus}%` : ""}${kindle > 0 ? ` ＋ 引火砂 ${kindle} 份` : ""}）。\n投入：${cost}，成败都不退；成功后新转数温养归零，失败保留原转数与温养并使下次 +${FORGE_PITY_STEP}%。\n`
        + (warded
          ? "固蛊符将在失败时自动碎裂，返还本次消耗的蛊母残核与蛊胎。"
          : "没有固蛊符：失败仍保留目标，但残核与蛊胎不返还。")
      : `稳炼 · 必成。\n投入：${cost}。一至六转采用同名同转二合一；一至四转升转不消耗引火砂或固蛊符；成功后新转数温养归零。`,
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
  if (pending.kind === "park-gu") {
    const result = donateParkGu(getGuluStore(), pending.guId);
    closeGuluActionConfirm();
    return { ...result, action: "park-gu" };
  }
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
    ["蛊胎", consumed.embryo], ["蛊钱", consumed.scrip], ["引火砂", consumed.kindle], ["固蛊符", consumed.ward],
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
  guluForgeRitualState = { phase: "animating", model, result };
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
  const reclaimStore = getGuluStore();
  const reclaimDateKey = guluTodayKey();
  const showReclaim = typeof isOutgameRewardedPlayerEligible === "function"
    && isOutgameRewardedPlayerEligible()
    && canOfferForgeFailureReclaim({
      store: reclaimStore,
      result,
      currentStore: reclaimStore,
      currentResult: result,
      ritualOpen: true,
      dateKey: reclaimDateKey,
      currentDateKey: reclaimDateKey,
    });
  dom.guluForgeRewardedReclaim?.classList.toggle("hidden", !showReclaim);
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
  dom.guluForgeRewardedReclaim?.classList.add("hidden");
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
 * 三段顺序固定为投料 → 升转 → 炼后，避免结果弹窗先盖住鼎、玩家只看到库存突然变化。 */
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
/* ===================== 万蛊游园 · 轻宗门营造 =====================
 * 永久态只并入 GULU_KEY 的 park 子对象。营造等级只改变园景繁盛度、园景名阶与展示，
 * 不提供攻击、生命、真元、抽牌、护甲或炼蛊成功率。所有资产结算先写候选档，
 * safeWriteJson 成功后再回写缓存对象，存储失败不会吞掉玩家资产。 */
const PARK_VERSION = 3;
const PARK_DAILY_TICKETS = 2;
const PARK_TICKET_CAP = 15;
const PARK_REWARDED_DAILY_LIMIT = 3;
const PARK_HISTORY_LIMIT = 60;
const PARK_LOW_TURN_MAX_LEVEL = 1; // upgradeLevel 0/1 = 一/二转
const PARK_DONATIONS = Object.freeze({
  scrip: Object.freeze({ cost: 20, buildExp: 10, chitin: 2 }),
  material: Object.freeze({ cost: 3, buildExp: 8, chitin: 1 }),
  gu: Object.freeze({ buildExp: 12, chitin: 5 }),
});
const PARK_LEVELS = Object.freeze([
  Object.freeze({ level: 1, exp: 0, title: "荒庭初辟", scene: "石径初扫，蛊灯一盏。", change: "母茧微光、稀雾与初点蛊灯" }),
  Object.freeze({ level: 2, exp: 40, title: "引泉成圃", scene: "灵泉入庭，虫鸣渐密。", change: "泉纹与虫灯更明" }),
  Object.freeze({ level: 3, exp: 100, title: "百蛊来栖", scene: "蛊木成荫，奇茧悬枝。", change: "虫群、脉光与孢子增盛" }),
  Object.freeze({ level: 4, exp: 180, title: "万蛊朝园", scene: "园门重开，万蛊循灯而来。", change: "琥珀金雾与亭台灯火增强" }),
  Object.freeze({ level: 5, exp: 280, title: "逆命祖庭", scene: "宿缘成碑，来客皆见宗门旧痕。", change: "祖庭金辉与全园光路达到最高" }),
]);
const PARK_QUIZ_REWARDS = Object.freeze({
  correct: Object.freeze({ chitin: 4, affinity: 0, buildExp: 3 }),
  wrong: Object.freeze({ chitin: 2, affinity: 0, buildExp: 0 }),
});
const PARK_SPRING_REWARDS = Object.freeze([
  Object.freeze({ id: "spring-heart", maxDistance: 0.12, label: "泉心", chitin: 6, affinity: 2, buildExp: 2 }),
  Object.freeze({ id: "spring-ring", maxDistance: 0.30, label: "近泉", chitin: 4, affinity: 1, buildExp: 1 }),
  Object.freeze({ id: "spring-bank", maxDistance: 1, label: "岸边", chitin: 2, affinity: 0, buildExp: 0 }),
]);
const PARK_COCOON_PITY = 5;
const PARK_COCOON_REWARDS = Object.freeze([
  Object.freeze({ id: "molt", max: 0.60, label: "奇蜕添枝", chitin: 3, affinity: 0, buildExp: 0 }),
  Object.freeze({ id: "affinity", max: 0.90, label: "宿缘微明", chitin: 3, affinity: 1, buildExp: 0 }),
  Object.freeze({ id: "garden", max: 1, label: "园景营造", chitin: 3, affinity: 0, buildExp: 4 }),
]);
const PARK_RARE_DIRECT_RATE = 0.005;
const PARK_RARE_FRAGMENT_STEP = 12;
const PARK_RARE_SELECT_COST = 6;
const PARK_RARE_HARD_SELECT_OPENS = PARK_RARE_FRAGMENT_STEP * PARK_RARE_SELECT_COST;
const PARK_RARE_POOLS = Object.freeze([
  Object.freeze(["hiddenGlowGourd", "burdenLampSnail", "borrowTideSilkworm"]),
  Object.freeze(["bloodMiasmaMediator", "fateMeasureInchworm", "returnCasketMayfly"]),
  Object.freeze(["riftMantis", "debtEatingAnt", "emberCasketFirefly"]),
]);
const PARK_RARE_PURSUIT_COPY = Object.freeze({
  hiddenGlowGourd: "封存余元，下回合首攻爆发",
  burdenLampSnail: "先借护甲，后续防御清债返护",
  borrowTideSilkworm: "把牌序前移，提前抽牌减费再还债",
  bloodMiasmaMediator: "把既有毒层转成爆发，接通毒血构筑",
  fateMeasureInchworm: "完成三类出牌，扩展下一次命势候选",
  returnCasketMayfly: "取回关键弃牌，以自身沉眠换牌序重构",
  riftMantis: "走过攻防辅三式，让裂锋逐类追斩",
  debtEatingAnt: "吞下一笔护甲债或真元债，把契痕结成甲",
  emberCasketFirefly: "照见有限化灰蛊牌，完成一场一次的终式",
});

function getParkRarePool(dateKey = guluTodayKey()) {
  const digits = String(dateKey || "").replace(/\D/g, "");
  const month = Math.max(1, Math.min(12, Number(digits.slice(4, 6)) || 1));
  return PARK_RARE_POOLS[month % PARK_RARE_POOLS.length].slice();
}

function getParkLevel(buildExp) {
  const exp = Math.max(0, Math.floor(Number(buildExp) || 0));
  return PARK_LEVELS.slice().reverse().find((entry) => exp >= entry.exp) || PARK_LEVELS[0];
}

function getParkTicketClarity(tickets) {
  const balance = Math.max(0, Math.min(PARK_TICKET_CAP, Math.floor(Number(tickets) || 0)));
  return Object.freeze({
    balance,
    daily: `每日补 ${PARK_DAILY_TICKETS} 帖`,
    cap: `最多存 ${PARK_TICKET_CAP} 帖`,
    cost: "开 1 茧耗 1 帖",
    available: `当前可开 ${balance} 茧`,
    cadence: "每日补给，不是每日限次",
  });
}

function getParkLevelPresentation(buildExp) {
  const exp = Math.max(0, Math.floor(Number(buildExp) || 0));
  const level = getParkLevel(exp);
  const next = PARK_LEVELS.find((entry) => entry.level === level.level + 1) || null;
  return Object.freeze({
    level,
    next,
    current: `营造 ${level.level} 级 · ${level.title}`,
    progress: next ? `${exp}/${next.exp}` : `${exp}`,
    currentChange: `当前园景：${level.change}`,
    nextChange: next ? `下一级变化：${next.change}` : "园景已全开",
    boundary: "纯园景成长 · 不加战力",
  });
}

function grantDailyParkTickets(park, dateKey = guluTodayKey()) {
  if (!park || typeof park !== "object") return { granted: 0, dateKey: String(dateKey || "") };
  const key = String(dateKey || guluTodayKey());
  if (park.ticketDate === key) return { granted: 0, dateKey: key, tickets: park.tickets | 0 };
  const before = Math.max(0, Math.min(PARK_TICKET_CAP, Math.floor(Number(park.tickets) || 0)));
  park.ticketDate = key;
  park.tickets = Math.min(PARK_TICKET_CAP, before + PARK_DAILY_TICKETS);
  return { granted: park.tickets - before, dateKey: key, tickets: park.tickets };
}

function normalizeParkStore(store, dateKey = guluTodayKey()) {
  if (!store || typeof store !== "object") return null;
  const source = store.park && typeof store.park === "object" && !Array.isArray(store.park) ? store.park : {};
  const fullActivityHistory = Array.isArray(source.activityHistory)
    ? source.activityHistory.filter((item) => item && typeof item === "object")
    : [];
  source.version = PARK_VERSION;
  source.sectName = String(source.sectName || "无名蛊园").trim().slice(0, 12) || "无名蛊园";
  // 旧档没有显式题名锁；已有自定义名字视为已经落款，避免更新后再次改名。
  source.sectNamed = source.sectNamed === true || source.sectName !== "无名蛊园";
  source.buildExp = Math.max(0, Math.floor(Number(source.buildExp) || 0));
  source.level = getParkLevel(source.buildExp).level;
  source.ticketDate = String(source.ticketDate || "");
  source.tickets = Math.max(0, Math.min(PARK_TICKET_CAP, Math.floor(Number(source.tickets) || 0)));
  source.chitin = Math.max(0, Math.floor(Number(source.chitin) || 0));
  source.affinity = Math.max(0, Math.floor(Number(source.affinity) || 0));
  source.daily = source.daily && typeof source.daily === "object" && !Array.isArray(source.daily) ? source.daily : {};
  const latestLegacyDate = (type) => String(fullActivityHistory.slice().reverse().find((entry) => entry.type === type && entry.dateKey)?.dateKey || "");
  source.daily.quizDate = String(source.daily.quizDate || latestLegacyDate("quiz"));
  source.daily.springDate = String(source.daily.springDate || latestLegacyDate("spring"));
  source.rewarded = source.rewarded && typeof source.rewarded === "object" && !Array.isArray(source.rewarded) ? source.rewarded : {};
  const rewardedDate = String(source.rewarded.date || "");
  source.rewarded.date = rewardedDate === String(dateKey) ? rewardedDate : String(dateKey);
  source.rewarded.count = rewardedDate === String(dateKey)
    ? Math.max(0, Math.min(PARK_REWARDED_DAILY_LIMIT, Math.floor(Number(source.rewarded.count) || 0)))
    : 0;
  source.activityHistory = fullActivityHistory.slice(-PARK_HISTORY_LIMIT);
  source.pity = source.pity && typeof source.pity === "object" && !Array.isArray(source.pity) ? source.pity : {};
  source.pity.cocoon = Math.max(0, Math.min(PARK_COCOON_PITY - 1, Math.floor(Number(source.pity.cocoon) || 0)));
  source.rare = source.rare && typeof source.rare === "object" && !Array.isArray(source.rare) ? source.rare : {};
  source.rare.opens = Math.max(0, Math.floor(Number(source.rare.opens) || 0));
  source.rare.fragmentProgress = Math.max(0, Math.min(PARK_RARE_FRAGMENT_STEP - 1, Math.floor(Number(source.rare.fragmentProgress) || 0)));
  source.rare.fragments = Math.max(0, Math.floor(Number(source.rare.fragments) || 0));
  source.rare.pending = Array.isArray(source.rare.pending)
    ? source.rare.pending.map(String).filter((key) => typeof CARD_LIBRARY !== "undefined" && CARD_LIBRARY[key]?.parkRare).slice(0, 12)
    : [];
  grantDailyParkTickets(source, dateKey);
  store.park = source;
  return source;
}

function cloneParkCandidate(store, dateKey = guluTodayKey()) {
  const candidate = JSON.parse(JSON.stringify(store && typeof store === "object" ? store : {}));
  normalizeParkStore(candidate, dateKey);
  candidate.market = candidate.market && typeof candidate.market === "object" ? candidate.market : {};
  candidate.market.scrip = Math.max(0, Math.floor(Number(candidate.market.scrip) || 0));
  candidate.materials = candidate.materials && typeof candidate.materials === "object" ? candidate.materials : {};
  return candidate;
}

function canGrantRewardedParkTicket(store, options = {}) {
  const dateKey = String(options.dateKey || guluTodayKey());
  const park = normalizeParkStore(store, dateKey);
  if (!park) return { ok: false, reason: "unavailable", dateKey, count: 0 };
  const count = Math.max(0, Math.min(PARK_REWARDED_DAILY_LIMIT, park.rewarded?.count | 0));
  if (options.adAvailable === false || (options.adAvailable == null && !guluRewardedAdReady())) {
    return { ok: false, reason: "ad-unavailable", dateKey, count, remaining: PARK_REWARDED_DAILY_LIMIT - count };
  }
  if (park.tickets >= PARK_TICKET_CAP) return { ok: false, reason: "ticket-cap", dateKey, count, remaining: PARK_REWARDED_DAILY_LIMIT - count };
  if (count >= PARK_REWARDED_DAILY_LIMIT) return { ok: false, reason: "daily-cap", dateKey, count, remaining: 0 };
  return { ok: true, dateKey, count, remaining: PARK_REWARDED_DAILY_LIMIT - count, tickets: park.tickets };
}

function grantRewardedParkTicket(store, options = {}) {
  const dateKey = String(options.dateKey || guluTodayKey());
  const candidate = cloneParkCandidate(store, dateKey);
  const eligibility = canGrantRewardedParkTicket(candidate, { dateKey, adAvailable: options.adAvailable !== false });
  if (!eligibility.ok) return { ok: false, ...eligibility, text: eligibility.reason === "ticket-cap" ? `游园帖已存满 ${PARK_TICKET_CAP} 帖。` : "今日广告游园帖已领完。" };
  candidate.park.tickets += 1;
  candidate.park.rewarded.date = dateKey;
  candidate.park.rewarded.count = eligibility.count + 1;
  if (!commitParkCandidate(store, candidate, options.save || saveGuluStore)) {
    return { ok: false, reason: "persistence-failed", text: "游园帖未能写入存档，本次领取次数没有消耗。" };
  }
  return {
    ok: true, gained: 1, tickets: store.park.tickets, count: store.park.rewarded.count,
    remaining: PARK_REWARDED_DAILY_LIMIT - store.park.rewarded.count,
    text: `广告游园帖 +1（今日 ${store.park.rewarded.count}/${PARK_REWARDED_DAILY_LIMIT}）。`,
  };
}

function commitParkCandidate(store, candidate, save = saveGuluStore) {
  try {
    if (typeof save !== "function" || save(candidate) === false) return false;
    Object.keys(store).forEach((key) => { if (!Object.prototype.hasOwnProperty.call(candidate, key)) delete store[key]; });
    Object.assign(store, candidate);
    return true;
  } catch (error) { return false; }
}

function appendParkHistory(park, entry) {
  park.activityHistory.push({ ...entry, at: Math.max(0, Number(entry.at) || Date.now()) });
  park.activityHistory = park.activityHistory.slice(-PARK_HISTORY_LIMIT);
}

function refreshParkLevel(park) {
  const before = park.level | 0;
  park.level = getParkLevel(park.buildExp).level;
  return park.level > before;
}

function hasParkDailyActivity(park, type, dateKey) {
  const key = String(dateKey);
  const field = type === "quiz" ? "quizDate" : (type === "spring" ? "springDate" : "");
  if (field && park.daily?.[field] === key) return true;
  return park.activityHistory.some((entry) => entry.type === type && entry.dateKey === key);
}

function markParkDailyActivity(park, type, dateKey) {
  const field = type === "quiz" ? "quizDate" : (type === "spring" ? "springDate" : "");
  if (!field) return;
  park.daily = park.daily && typeof park.daily === "object" && !Array.isArray(park.daily) ? park.daily : {};
  park.daily[field] = String(dateKey);
}

function applyParkReward(park, reward) {
  park.chitin += Math.max(0, reward.chitin | 0);
  park.affinity += Math.max(0, reward.affinity | 0);
  park.buildExp += Math.max(0, reward.buildExp | 0);
  return refreshParkLevel(park);
}

function hasParkRareGu(store, cardKey) {
  if (store?.collection?.[cardKey]) return true;
  return [store?.slots, store?.nurture?.slots]
    .filter(Array.isArray)
    .some((slots) => slots.some((slot) => slot?.state === "gu" && slot.cardKey === cardKey));
}

function placeParkRareGu(candidate, cardKey, now = Date.now()) {
  const destination = findRedeemGuDestination(candidate);
  if (!destination) {
    candidate.park.rare.pending.push(cardKey);
    return { pending: true, cardKey };
  }
  const slot = createRedeemGuInstance(candidate, { cardKey, grade: "ling", turn: 1 });
  destination.slots[destination.index] = slot;
  recordRedeemGuCollection(candidate, slot, now);
  return { pending: false, cardKey, slot, location: destination.location };
}

function rollParkRareReward(candidate, options = {}) {
  const rare = candidate.park.rare;
  rare.opens += 1;
  rare.fragmentProgress += 1;
  let fragmentGranted = 0;
  if (rare.fragmentProgress >= PARK_RARE_FRAGMENT_STEP) {
    rare.fragmentProgress = 0;
    rare.fragments += 1;
    fragmentGranted = 1;
  }
  const rng = options.rareRng || guluRandom;
  const hitRoll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  if (hitRoll >= PARK_RARE_DIRECT_RATE) return { hit: false, fragmentGranted };
  const pool = getParkRarePool(options.dateKey);
  const unowned = pool.filter((key) => !hasParkRareGu(candidate, key) && !rare.pending.includes(key));
  if (!unowned.length) {
    rare.fragments += 1;
    return { hit: true, duplicate: true, fragmentGranted: fragmentGranted + 1 };
  }
  const pickRoll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  const cardKey = unowned[Math.min(unowned.length - 1, Math.floor(pickRoll * unowned.length))];
  return { hit: true, duplicate: false, fragmentGranted, ...placeParkRareGu(candidate, cardKey, options.now) };
}

function claimParkRareGu(store, cardKey, options = {}) {
  const dateKey = String(options.dateKey || guluTodayKey());
  const candidate = cloneParkCandidate(store, dateKey);
  const key = String(cardKey || "");
  const pool = getParkRarePool(dateKey);
  const pendingIndex = candidate.park.rare.pending.indexOf(key);
  const fromPending = options.fromPending === true && pendingIndex >= 0;
  if (!fromPending && !pool.includes(key)) return { ok: false, text: "这只珍稀蛊不在当期游园池。" };
  if (!fromPending && candidate.park.rare.fragments < PARK_RARE_SELECT_COST) return { ok: false, text: `珍稀残蜕不足，需 ${PARK_RARE_SELECT_COST} 枚。` };
  if (fromPending) candidate.park.rare.pending.splice(pendingIndex, 1);
  else candidate.park.rare.fragments -= PARK_RARE_SELECT_COST;
  if (!fromPending && hasParkRareGu(candidate, key)) {
    candidate.park.rare.fragments += 1;
    if (!commitParkCandidate(store, candidate, options.save || saveGuluStore)) return { ok: false, reason: "persistence-failed", text: "自选结果未能写入存档，残蜕没有消耗。" };
    return { ok: true, duplicate: true, cardKey: key, text: "已拥有的珍稀蛊化为 1 枚珍稀残蜕。" };
  }
  const destination = findRedeemGuDestination(candidate);
  if (!destination) return { ok: false, reason: "capacity", text: "蛊圃与养蛊室已满；奇蛊仍在待领处，不会消失。" };
  const slot = createRedeemGuInstance(candidate, { cardKey: key, grade: "ling", turn: 1 });
  destination.slots[destination.index] = slot;
  recordRedeemGuCollection(candidate, slot, options.now || Date.now());
  if (!commitParkCandidate(store, candidate, options.save || saveGuluStore)) return { ok: false, reason: "persistence-failed", text: "奇蛊未能写入存档，残蜕与待领状态没有改变。" };
  return { ok: true, cardKey: key, slot, location: destination.location, text: `珍稀蛊「${CARD_LIBRARY[key]?.name || key}」已收入${destination.location === "nurture" ? "养蛊室" : "蛊圃"}。` };
}

function buildParkRareAcquirePresentation(result, source = "direct") {
  if (!result || result.ok === false || result.hit === false) return null;
  const cardKey = String(result.cardKey || "");
  const card = (typeof CARD_LIBRARY !== "undefined" && CARD_LIBRARY[cardKey]) || null;
  const image = typeof getGuluCardArt === "function" ? getGuluCardArt(cardKey) : "";
  const isDuplicate = result.duplicate === true;
  const isPending = result.pending === true;
  const isSelected = source === "select";
  const parkReward = result.parkReward || null;
  const rewardParts = [];
  if (parkReward) {
    rewardParts.push(`奇蜕 +${parkReward.chitin || 0}`);
    if (parkReward.affinity) rewardParts.push(`宿缘 +${parkReward.affinity}`);
    if (parkReward.buildExp) rewardParts.push(`营造 +${parkReward.buildExp}`);
  }
  if (result.fragmentGranted) rewardParts.push(`珍稀残蜕 +${result.fragmentGranted}`);
  const rewardSummary = rewardParts.length ? `本次另得：${rewardParts.join("，")}。` : "";
  if (isDuplicate) {
    return {
      kind: "duplicate", state: "重复转化", title: card?.name || "珍稀灵光归蜕",
      glyph: card?.glyph || "蜕", art: card?.art || "蜕", image,
      reason: cardKey ? (PARK_RARE_PURSUIT_COPY[cardKey] || "独有构筑机制") : "当期珍稀蛊已经集齐",
      destination: result.fragmentGranted
        ? `当期奇蛊已齐，重复结果已计入本次残蜕所得，不会得到无用重复蛊。${rewardSummary}`
        : `已化为珍稀残蜕 +1，不会得到无用重复蛊。${rewardSummary}`,
      guId: "", canViewDetail: false,
    };
  }
  return {
    kind: isPending ? "pending" : "new",
    state: isPending ? "灵光暂栖" : (isSelected ? "残蜕自选 · 新得珍稀蛊" : "新得珍稀蛊"),
    title: card?.name || "珍稀蛊",
    glyph: card?.glyph || "奇", art: card?.art || card?.glyph || "蛊", image,
    reason: PARK_RARE_PURSUIT_COPY[cardKey] || "独有构筑机制",
    destination: isPending
      ? `蛊圃与养蛊室已满，奇蛊已安置在待领处，不会消失。${rewardSummary}`
      : `已收入${result.location === "nurture" ? "养蛊室" : "蛊圃"}，可在个体详情查看来源与成长。${rewardSummary}`,
    guId: String(result.slot?.id || ""), canViewDetail: Boolean(result.slot?.id),
  };
}

function closeParkRareAcquire() {
  if (!dom?.parkRareAcquireOverlay) return;
  dom.parkRareAcquireOverlay.classList.add("hidden");
  delete dom.parkRareAcquireOverlay.dataset.kind;
  delete dom.parkRareAcquireOverlay.dataset.guId;
  refreshModalLock();
}

function showParkRareAcquire(result, source = "direct") {
  const model = buildParkRareAcquirePresentation(result, source);
  if (!model || !dom?.parkRareAcquireOverlay) return false;
  const overlay = dom.parkRareAcquireOverlay;
  overlay.dataset.kind = model.kind;
  overlay.dataset.guId = model.guId;
  dom.parkRareAcquireState.textContent = model.state;
  dom.parkRareAcquireName.textContent = model.title;
  dom.parkRareAcquireSeal.textContent = model.glyph;
  dom.parkRareAcquireArt.querySelector("em").textContent = model.art;
  dom.parkRareAcquireArt.classList.toggle("has-image", Boolean(model.image));
  if (model.image) dom.parkRareAcquireArtImage.src = model.image;
  else dom.parkRareAcquireArtImage.removeAttribute("src");
  dom.parkRareAcquireReason.textContent = model.reason;
  dom.parkRareAcquireDestination.textContent = model.destination;
  dom.parkRareAcquireAccept.textContent = model.kind === "pending" ? "知道了" : (model.kind === "duplicate" ? "收下残蜕" : "收入蛊庐");
  dom.parkRareAcquireDetail.classList.toggle("hidden", !model.canViewDetail);
  dom.parkRareAcquireDetail.disabled = !model.canViewDetail;
  overlay.classList.remove("hidden");
  refreshModalLock();
  window.AudioManager?.playSfx?.("guluHatchLing", { volumeScale: model.kind === "new" ? 1 : 0.72 });
  dom.parkRareAcquireAccept.focus({ preventScroll: true });
  return true;
}

function renameParkSect(store, name, save = saveGuluStore) {
  const candidate = cloneParkCandidate(store);
  if (candidate.park.sectNamed) return { ok: false, reason: "already-named", text: "宗门题名已经落款，不可再次更改。" };
  const normalized = String(name || "").trim().replace(/[<>]/g, "").slice(0, 12);
  if (normalized.length < 2) return { ok: false, text: "宗门名至少写两个字。" };
  candidate.park.sectName = normalized;
  candidate.park.sectNamed = true;
  if (!commitParkCandidate(store, candidate, save)) return { ok: false, reason: "persistence-failed", text: "宗门名未能写入存档，请稍后重试。" };
  return { ok: true, sectName: normalized, text: `宗门题名为「${normalized}」。` };
}

function buildParkRewardReceipt(result, meta = {}) {
  if (!result?.ok || !result.reward) return null;
  const reward = result.reward;
  const items = [];
  const push = (glyph, name, amount, detail, tone) => {
    const count = Math.max(0, Math.floor(Number(amount) || 0));
    if (count > 0) items.push({ glyph, name, amount: count, detail, tone });
  };
  push("蜕", "奇蜕", reward.chitin, "已入游园库", "jade");
  push("缘", "宿缘", reward.affinity, "已入游园库", "gold");
  push("造", "营造进度", reward.buildExp, result.leveled ? "园景已升阶" : "已计入园景", "boss");
  push("残", "珍稀残蜕", result.rare?.fragmentGranted, "十二茧留痕", "tian");
  if (!items.length) return null;
  return {
    source: meta.source || "万蛊游园",
    title: meta.title || "游园所得",
    subtitle: meta.subtitle || "所得已写入宗门游园",
    items,
    summary: meta.summary || result.text || "本次所得已经写入存档。",
  };
}

function showParkRewardReceipt(result, meta = {}) {
  const receipt = buildParkRewardReceipt(result, meta);
  if (!receipt || !enqueueOutgameReceipt(receipt, dom.guluCloseButton)) return null;
  return receipt;
}

function donateParkResources(store, donation = {}, save = saveGuluStore) {
  const candidate = cloneParkCandidate(store);
  const kind = donation.kind === "material" ? "material" : "scrip";
  const conf = PARK_DONATIONS[kind];
  let detail = "";
  if (kind === "scrip") {
    if (candidate.market.scrip < conf.cost) return { ok: false, text: `蛊钱不足，固定捐纳需 ${conf.cost}。` };
    candidate.market.scrip -= conf.cost;
    detail = `蛊钱 ${conf.cost}`;
  } else {
    const materialId = String(donation.materialId || "");
    if (!(typeof MATERIAL_IDS !== "undefined" && MATERIAL_IDS.includes(materialId))) return { ok: false, text: "这份材料不可用于营造。" };
    const have = Math.max(0, Math.floor(Number(candidate.materials[materialId]) || 0));
    if (have < conf.cost) return { ok: false, text: `材料不足，固定捐纳需 ${conf.cost} 份。` };
    candidate.materials[materialId] = have - conf.cost;
    detail = `${MATERIALS[materialId]?.name || "炼蛊材料"} ${conf.cost}`;
  }
  const reward = { chitin: conf.chitin, affinity: 0, buildExp: conf.buildExp };
  const leveled = applyParkReward(candidate.park, reward);
  appendParkHistory(candidate.park, { type: `donate-${kind}`, detail, reward });
  if (!commitParkCandidate(store, candidate, save)) return { ok: false, reason: "persistence-failed", text: "捐纳未能写入存档，资产没有扣除。" };
  return { ok: true, reward, leveled, text: `${detail}已入营造册：营造 +${reward.buildExp}，奇蜕 +${reward.chitin}。` };
}

function getParkOwnedGuRefs(store) {
  const refs = [];
  (Array.isArray(store?.slots) ? store.slots : []).forEach((slot, index) => { if (slot?.state === "gu") refs.push({ slot, area: "slots", index }); });
  (Array.isArray(store?.nurture?.slots) ? store.nurture.slots : []).forEach((slot, index) => { if (slot?.state === "gu") refs.push({ slot, area: "nurture", index }); });
  return refs;
}

function getParkGuDonationPreview(store, guId, activeRun = getGuluRunningRun()) {
  const refs = getParkOwnedGuRefs(store);
  const ref = refs.find((entry) => String(entry.slot.id) === String(guId || ""));
  if (!ref) return { ok: false, text: "找不到这只成蛊。" };
  const slot = ref.slot;
  if (slot.carry) return { ok: false, text: "随行中的蛊不能捐纳。" };
  if (isGuluSourceLocked(slot.id, activeRun)) return { ok: false, text: "此蛊正在当前命途中，结束本局后才能捐纳。" };
  if ((slot.upgradeLevel | 0) > PARK_LOW_TURN_MAX_LEVEL) return { ok: false, text: "只收一转或二转的重复成蛊。" };
  const duplicates = refs.filter((entry) => entry !== ref && entry.slot.cardKey === slot.cardKey);
  if (!duplicates.length) return { ok: false, text: "同名成蛊至少要留下另一只。" };
  const name = slot.customName || CARD_LIBRARY[slot.cardKey]?.name || slot.name || "成蛊";
  return {
    ok: true, guId: String(slot.id), name, area: ref.area, index: ref.index,
    reward: { chitin: PARK_DONATIONS.gu.chitin, affinity: 0, buildExp: PARK_DONATIONS.gu.buildExp },
    text: `不可逆捐纳「${name}」；将永久移除此实例，同名成蛊仍保留 ${duplicates.length} 只。`,
  };
}

function donateParkGu(store, guId, options = {}) {
  const candidate = cloneParkCandidate(store, options.dateKey);
  const activeRun = Object.prototype.hasOwnProperty.call(options, "activeRun") ? options.activeRun : getGuluRunningRun();
  const preview = getParkGuDonationPreview(candidate, guId, activeRun);
  if (!preview.ok) return preview;
  if (preview.area === "nurture") candidate.nurture.slots[preview.index] = null;
  else candidate.slots[preview.index] = null;
  const leveled = applyParkReward(candidate.park, preview.reward);
  appendParkHistory(candidate.park, { type: "donate-gu", guId: preview.guId, name: preview.name, reward: preview.reward });
  if (!commitParkCandidate(store, candidate, options.save || saveGuluStore)) return { ok: false, reason: "persistence-failed", text: "捐纳未能写入存档，这只蛊仍在原处。" };
  return { ok: true, reward: preview.reward, leveled, text: `${preview.name}已不可逆捐入游园：营造 +${preview.reward.buildExp}，奇蜕 +${preview.reward.chitin}。` };
}

function parkRandomIndex(length, rng) {
  if (!(length > 0)) return 0;
  const roll = Math.max(0, Math.min(0.999999, Number((rng || guluRandom)()) || 0));
  return Math.floor(roll * length);
}

function getParkDiscoveredCommonKeys(store) {
  const exclusive = new Set(typeof HERO_EXCLUSIVE_CARD_KEYS === "object" ? Object.values(HERO_EXCLUSIVE_CARD_KEYS).flat() : []);
  const allowed = typeof STANDARD_REWARD_CARD_KEYS !== "undefined" ? STANDARD_REWARD_CARD_KEYS : Object.keys(CARD_LIBRARY || {});
  const discovered = new Set(Object.entries(store?.collection || {}).map(([key, entry]) => String(entry?.cardKey || key)));
  if (typeof loadDiscoveredGu === "function") {
    try {
      const permanent = loadDiscoveredGu();
      if (permanent && typeof permanent[Symbol.iterator] === "function") {
        Array.from(permanent).forEach((key) => discovered.add(String(key || "")));
      }
    } catch (error) { /* 永久图鉴读取失败时仍可用蛊庐藏册兜底 */ }
  }
  return allowed.filter((key) => CARD_LIBRARY[key] && discovered.has(key) && !exclusive.has(key));
}

function buildParkQuiz(store, rng = guluRandom) {
  const pool = getParkDiscoveredCommonKeys(store);
  if (pool.length < 3) return { ok: false, options: [], text: `再收录 ${3 - pool.length} 种通用蛊，才可听息辨蛊。` };
  const answerKey = pool[parkRandomIndex(pool.length, rng)];
  const others = pool.filter((key) => key !== answerKey);
  const options = [answerKey];
  while (options.length < 3 && others.length) options.push(others.splice(parkRandomIndex(others.length, rng), 1)[0]);
  const ordered = [];
  while (options.length) ordered.push(options.splice(parkRandomIndex(options.length, rng), 1)[0]);
  const effect = String(CARD_LIBRARY[answerKey]?.effect || "蛊息难明").replace(/<[^>]+>/g, "");
  return { ok: true, prompt: `哪只通用蛊显出此息：${effect}`, answerKey, options: ordered };
}

function settleParkQuiz(store, quiz, selectedKey, options = {}) {
  const dateKey = String(options.dateKey || guluTodayKey());
  const candidate = cloneParkCandidate(store, dateKey);
  if (hasParkDailyActivity(candidate.park, "quiz", dateKey)) return { ok: false, reason: "daily-complete", text: "今日已经听息辨蛊。" };
  if (!quiz?.ok || !Array.isArray(quiz.options) || quiz.options.length !== 3 || !quiz.options.includes(quiz.answerKey) || !quiz.options.includes(selectedKey)) {
    return { ok: false, text: "这道蛊息已散，请重新辨识。" };
  }
  const correct = selectedKey === quiz.answerKey;
  const reward = { ...(correct ? PARK_QUIZ_REWARDS.correct : PARK_QUIZ_REWARDS.wrong) };
  const leveled = applyParkReward(candidate.park, reward);
  markParkDailyActivity(candidate.park, "quiz", dateKey);
  appendParkHistory(candidate.park, { type: "quiz", dateKey, correct, answerKey: quiz.answerKey, reward });
  if (!commitParkCandidate(store, candidate, options.save || saveGuluStore)) return { ok: false, reason: "persistence-failed", text: "辨识结果未能写入存档，本次不作结算。" };
  return { ok: true, correct, reward, leveled, text: correct ? `辨息无误：奇蜕 +${reward.chitin}，营造 +${reward.buildExp}。` : `蛊息认错，仍拾得奇蜕 +${reward.chitin}。` };
}

function scoreParkSpringCup(position) {
  const normalized = Math.max(0, Math.min(1, Number(position) || 0));
  const distance = Math.abs(normalized - 0.5);
  const band = PARK_SPRING_REWARDS.find((entry) => distance <= entry.maxDistance) || PARK_SPRING_REWARDS[PARK_SPRING_REWARDS.length - 1];
  return { id: band.id, label: band.label, chitin: band.chitin, affinity: band.affinity, buildExp: band.buildExp, position: normalized };
}

function settleParkSpringCup(store, position, options = {}) {
  const dateKey = String(options.dateKey || guluTodayKey());
  const candidate = cloneParkCandidate(store, dateKey);
  if (hasParkDailyActivity(candidate.park, "spring", dateKey)) return { ok: false, reason: "daily-complete", text: "今日已经投过灵泉盏。" };
  if (!Number.isFinite(Number(position))) return { ok: false, text: "泉盏尚未落下。" };
  const reward = scoreParkSpringCup(position);
  const leveled = applyParkReward(candidate.park, reward);
  markParkDailyActivity(candidate.park, "spring", dateKey);
  appendParkHistory(candidate.park, { type: "spring", dateKey, band: reward.id, position: reward.position, reward });
  if (!commitParkCandidate(store, candidate, options.save || saveGuluStore)) return { ok: false, reason: "persistence-failed", text: "投盏结果未能写入存档，本次不作结算。" };
  return { ok: true, reward, leveled, text: `泉盏落在${reward.label}：奇蜕 +${reward.chitin}${reward.affinity ? `，宿缘 +${reward.affinity}` : ""}${reward.buildExp ? `，营造 +${reward.buildExp}` : ""}。` };
}

function openParkCocoon(store, options = {}) {
  const dateKey = String(options.dateKey || guluTodayKey());
  const candidate = cloneParkCandidate(store, dateKey);
  const ticketClarity = getParkTicketClarity(candidate.park.tickets);
  if (candidate.park.tickets < 1) return { ok: false, text: `游园帖不足；下一次本地自然日补给后可继续开茧。${ticketClarity.daily}，${ticketClarity.cap}；${ticketClarity.cadence}。` };
  const pityBefore = candidate.park.pity.cocoon | 0;
  const guaranteed = pityBefore >= PARK_COCOON_PITY - 1;
  const roll = Math.max(0, Math.min(0.999999, Number((options.rng || guluRandom)()) || 0));
  const tier = guaranteed
    ? { id: "pity", label: "五茧宿缘保底", chitin: 3, affinity: 2, buildExp: 0 }
    : (PARK_COCOON_REWARDS.find((entry) => roll < entry.max) || PARK_COCOON_REWARDS[PARK_COCOON_REWARDS.length - 1]);
  const reward = { chitin: tier.chitin, affinity: tier.affinity, buildExp: tier.buildExp };
  candidate.park.tickets -= 1;
  candidate.park.pity.cocoon = reward.affinity > 0 ? 0 : Math.min(PARK_COCOON_PITY - 1, pityBefore + 1);
  const leveled = applyParkReward(candidate.park, reward);
  const rare = rollParkRareReward(candidate, { ...options, dateKey });
  appendParkHistory(candidate.park, { type: "cocoon", dateKey, tier: tier.id, guaranteed, reward, rare });
  if (!commitParkCandidate(store, candidate, options.save || saveGuluStore)) return { ok: false, reason: "persistence-failed", text: "奇茧未能写入存档，游园帖没有消耗。" };
  const rareText = rare.hit
    ? (rare.duplicate ? " 珍稀灵光命中：当期珍稀蛊已齐，转为珍稀残蜕 +1。" : ` 珍稀灵光命中：${CARD_LIBRARY[rare.cardKey]?.name || rare.cardKey}${rare.pending ? "已进入待领，不会因仓满消失" : "已收入蛊庐"}。`)
    : (rare.fragmentGranted ? " 十二茧留痕：珍稀残蜕 +1。" : "");
  return { ok: true, reward, rare, guaranteed, pity: store.park.pity.cocoon, leveled, text: `${tier.label}：奇蜕 +${reward.chitin}${reward.affinity ? `，宿缘 +${reward.affinity}` : ""}${reward.buildExp ? `，营造 +${reward.buildExp}` : ""}。${rareText}` };
}

function getParkHistoryResult(park, type, dateKey = guluTodayKey()) {
  return park.activityHistory.slice().reverse().find((entry) => entry.type === type && entry.dateKey === String(dateKey)) || null;
}

function buildParkOrbitCards() {
  return Array.from({ length: 12 }, (_, index) => `<i class="park-orbit-card" aria-hidden="true" style="--orbit-index:${index};--orbit-angle:${index * 30}deg"></i>`).join("");
}

function getParkOrbitAnimationTiming(now = Date.now()) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const durationMs = reduced ? 60000
    : (typeof document !== "undefined" && document.body?.classList.contains("perf-lite")) ? 42000
      : (typeof document !== "undefined" && document.body?.classList.contains("effects-off")) ? 34000
        : 22000;
  return { durationMs, delayMs: -(Math.max(0, Number(now) || 0) % durationMs) };
}

function renderPark(store) {
  const park = normalizeParkStore(store);
  const ticketClarity = getParkTicketClarity(park.tickets);
  const levelPresentation = getParkLevelPresentation(park.buildExp);
  const level = levelPresentation.level;
  const todayKey = guluTodayKey();
  const rewardedTicket = canGrantRewardedParkTicket(store, { dateKey: todayKey, adAvailable: true });
  const rewardedTicketReady = guluRewardedAdReady();
  const rewardedCount = park.rewarded?.count | 0;
  if (rewardedTicket.ok && rewardedTicketReady) {
    guluTrackRewardedOffer(
      NmgAds.PLACEMENTS.PARK_TICKET,
      `park-ticket:${todayKey}:${rewardedCount}:${park.tickets}`,
      { scene: "park", reward_kind: "park_ticket", reward_amount_bucket: "1" },
    );
  }
  const quizDone = hasParkDailyActivity(park, "quiz", todayKey);
  const springDone = hasParkDailyActivity(park, "spring", todayKey);
  const quizResult = quizDone ? getParkHistoryResult(park, "quiz", todayKey) : null;
  const springResult = springDone ? getParkHistoryResult(park, "spring", todayKey) : null;
  const quiz = quizDone ? null : buildParkQuiz(store);
  const rarePool = getParkRarePool(todayKey);
  const rareChoices = rarePool.map((key) => {
    const owned = hasParkRareGu(store, key);
    return `<button type="button" class="park-rare-choice" data-park-rare-select="${escGu(key)}" ${park.rare.fragments < PARK_RARE_SELECT_COST ? "disabled" : ""}><b>${escGu(CARD_LIBRARY[key]?.name || key)}</b><em>${escGu(PARK_RARE_PURSUIT_COPY[key] || "独有构筑机制")}</em><small>${owned ? "已拥有·重复将转 1 残蜕" : "当期可自选"}</small></button>`;
  }).join("");
  const pendingRare = park.rare.pending.map((key) => `<button type="button" data-park-rare-pending="${escGu(key)}">领取 ${escGu(CARD_LIBRARY[key]?.name || key)}</button>`).join("");
  const quizMarkup = quizDone
    ? `<p class="park-result">今日已完成 · ${quizResult ? (quizResult.correct ? "识得真蛊" : "虽误亦有所得") : "听息已定"}</p>`
    : (quiz?.ok ? `<p>${escGu(quiz.prompt)}</p><div class="park-choice-row">${quiz.options.map((key) => `<button type="button" data-park-quiz="${escGu(key)}" data-park-quiz-answer="${escGu(quiz.answerKey)}" data-park-quiz-options="${escGu(quiz.options.join(","))}">${escGu(CARD_LIBRARY[key]?.name || key)}</button>`).join("")}</div>` : `<p>${escGu(quiz?.text || "蛊息未聚。")}</p>`);
  const springMarkup = springDone
    ? `<p class="park-result">今日已完成 · ${springResult ? `泉盏落在${escGu(springResult.reward?.label || "泉畔")}` : "泉盏已定"}</p>`
    : `<div class="park-spring-track park-spring-basin" data-park-spring-track="1" aria-label="灵泉投盏池"><span class="park-spring-ring ring-one"></span><span class="park-spring-ring ring-two"></span><b aria-hidden="true"></b><i class="park-spring-cup" aria-hidden="true">盏</i><em>泉心</em></div><button type="button" data-park-spring="start">凝神投盏</button>`;
  const materials = (typeof MATERIAL_IDS !== "undefined" ? MATERIAL_IDS : []).map((id) => `<button type="button" data-park-donate="material" data-park-material="${escGu(id)}" ${(store.materials?.[id] | 0) < PARK_DONATIONS.material.cost ? "disabled" : ""}>${escGu(MATERIALS[id]?.name || id)}×${PARK_DONATIONS.material.cost}</button>`).join("");
  const guCandidates = getParkOwnedGuRefs(store).map((entry) => getParkGuDonationPreview(store, entry.slot.id)).filter((entry) => entry.ok)
    .map((entry) => `<button type="button" data-park-gu-preview="${escGu(entry.guId)}">不可逆捐纳 · ${escGu(entry.name)}</button>`).join("");
  const springTable = PARK_SPRING_REWARDS.map((entry) => `<span><b>${entry.label}</b>奇蜕 ${entry.chitin}${entry.affinity ? ` · 宿缘 ${entry.affinity}` : ""}${entry.buildExp ? ` · 营造 ${entry.buildExp}` : ""}</span>`).join("");
  const cocoonTable = PARK_COCOON_REWARDS.map((entry, index) => `<span><b>${index === 0 ? "60%" : index === 1 ? "30%" : "10%"}</b>${entry.label} · 奇蜕 ${entry.chitin}${entry.affinity ? ` · 宿缘 ${entry.affinity}` : ""}${entry.buildExp ? ` · 营造 ${entry.buildExp}` : ""}</span>`).join("");
  const focusActivity = resolveParkActivityFocus({ quizDone, springDone, quiz });
  const activityNav = `<nav class="park-activity-nav" aria-label="游园活动">
    <button type="button" data-park-activity="quiz" aria-pressed="${focusActivity === "quiz" ? "true" : "false"}"><span class="park-activity-seal" aria-hidden="true">息</span><span class="park-activity-copy"><b>听息辨蛊</b><small>${quizDone ? "已完成" : (quiz?.ok ? "可玩" : "尚未解锁")}</small></span></button>
    <button type="button" data-park-activity="spring" aria-pressed="${focusActivity === "spring" ? "true" : "false"}"><span class="park-activity-seal" aria-hidden="true">泉</span><span class="park-activity-copy"><b>灵泉投盏</b><small>${springDone ? "已完成" : "可玩"}</small></span></button>
  </nav>`;
  const focusContent = focusActivity === "quiz"
    ? `<h4>听息辨蛊 <small>每日一次 · 答错也有所得</small></h4>${quizMarkup}`
    : `<h4>灵泉投盏 <small>每日一次 · 看准泉心落盏</small></h4>${springMarkup}<details class="park-rules"><summary>查看落点奖励</summary><div class="park-reward-table">${springTable}</div></details>`;
  const poolShowcase = rarePool.map((key) => {
    const art = getGuluCardArt(key);
    return `<article class="park-pool-gu" data-park-pool-card="${escGu(key)}"><button type="button" data-park-gu-key="${escGu(key)}" aria-label="查看${escGu(CARD_LIBRARY[key]?.name || key)}">${art ? `<img src="${escGu(art)}" alt="" loading="lazy">` : `<i>${escGu(CARD_LIBRARY[key]?.glyph || "奇")}</i>`}</button><b>${escGu(CARD_LIBRARY[key]?.name || key)}</b><small>${escGu(PARK_RARE_PURSUIT_COPY[key] || "独有构筑机制")}</small></article>`;
  }).join("");
  const orbitTiming = getParkOrbitAnimationTiming();
  const drawStage = `<section class="park-draw-stage" data-park-draw-stage>
    <header><div><small>当期镇园奇蛊 · 月轮池</small><h3>奇茧启封</h3></div><p><b>0.5%</b> 固定直出 · 每 12 茧 1 残蜕 · 6 枚自选 · <b>72 茧硬自选</b></p></header>
    <div class="park-draw-arena">
      <div class="park-orbit" data-park-orbit style="--park-orbit-delay:${orbitTiming.delayMs}ms">${buildParkOrbitCards()}</div>
      <div class="park-draw-core">
        <div class="park-reveal-card" data-park-reveal-card>
          <div class="park-reveal-face park-reveal-back"><img src="assets/ui/gulu/wangu-park-card-back.v1.webp" alt="奇茧卡背"></div>
          <div class="park-reveal-face park-reveal-front"><img data-park-reveal-image alt=""><span data-park-reveal-glyph>茧</span><b data-park-reveal-name>灵光待显</b></div>
        </div>
        <button type="button" class="park-draw-button" data-park-cocoon="1" ${park.tickets < 1 ? "disabled" : ""}>启茧寻蛊 <small>${escGu(ticketClarity.cost)}</small></button>
      </div>
    </div>
    <div class="park-draw-ledger"><span>${escGu(ticketClarity.available)}</span><span>已开 <b>${park.rare.opens}</b> 茧</span><span>残蜕 <b>${park.rare.fragments}/${PARK_RARE_SELECT_COST}</b></span><span>下枚残蜕 <b>${park.rare.fragmentProgress}/${PARK_RARE_FRAGMENT_STEP}</b></span>${rewardedTicket.ok && rewardedTicketReady ? `<button type="button" class="park-rewarded-ticket" data-park-rewarded-ticket="1">看广告得 1 帖 · 今日 ${rewardedCount}/${PARK_REWARDED_DAILY_LIMIT}</button>` : ""}</div>
    <div class="park-pool-showcase">${poolShowcase}</div>
    ${pendingRare ? `<div class="park-pending-row"><strong>待领珍稀蛊</strong>${pendingRare}</div>` : ""}
    <details class="park-rules park-draw-rules park-probability-scroll"><summary>查看完整概率、保底与当期自选</summary><div class="park-reward-table">${cocoonTable}</div><p>珍稀蛊独立直出率 <b>0.5%</b>，概率不递增。每 12 茧固定得到 1 枚珍稀残蜕，6 枚可从当期三只中自选，故每 72 茧必有一次硬自选。直出优先未拥有，重复转 1 残蜕；开茧数、残蜕与进度跨轮换保留。</p><div class="park-choice-row">${rareChoices}</div></details>
  </section>`;
  const secondaryFocusContent = focusContent;
  return `<section class="gulu-park is-level-${level.level}">
    <div class="park-scene-layer" aria-hidden="true">
      <i class="park-cocoon-glow"></i>
      <i class="park-mist-back"></i>
      <i class="park-mist-front"></i>
      <i class="park-firefly-field"></i>
      <i class="park-spore-field"></i>
      <i class="park-spring-ripple"></i>
    </div>
    ${drawStage}
    <header class="park-banner"><div><small>万蛊游园 · ${escGu(level.title)}</small><h3>${escGu(park.sectName)}</h3>${park.sectNamed ? `<div class="park-identity"><span>宗门题名</span><small>已落款 · 不可更改</small></div>` : ""}<p>${escGu(level.scene)}</p></div><div class="park-level"><b>${escGu(levelPresentation.current)}</b><span>${escGu(levelPresentation.progress)}</span><small class="park-current-change">${escGu(levelPresentation.currentChange)}</small><small class="park-next-change">${escGu(levelPresentation.nextChange)}</small><em class="park-scenery-only">${escGu(levelPresentation.boundary)}</em></div></header>
    <div class="park-asset-strip park-ledger"><span>游园帖 <b>${ticketClarity.balance}/${PARK_TICKET_CAP}</b></span><span>奇蜕 <b>${park.chitin}</b></span><span>宿缘 <b>${park.affinity}</b></span></div>
    <div class="park-ticket-clarity" aria-label="游园帖规则"><span>${escGu(ticketClarity.daily)}</span><span>${escGu(ticketClarity.cap)}</span><span>${escGu(ticketClarity.cost)}</span><strong>${escGu(ticketClarity.available)}</strong><small>${escGu(ticketClarity.cadence)}</small></div>
    <details class="park-secondary" open><summary><b>游园余兴与营造</b><small>听息、投盏、题名与园景成长</small></summary>
      ${park.sectNamed ? "" : `<section class="park-panel park-name"><h4>首次宗门题名</h4><p>名字会展示在游园牌匾上，落款后不可更改。</p><div><input type="text" maxlength="12" value="" placeholder="输入 2—12 个字" data-park-name-input aria-label="宗门名"><button type="button" data-park-rename="1">确认落款</button></div></section>`}
      <div class="park-workbench"><div class="park-activities">${activityNav}</div><section class="park-panel park-activity park-focus-panel" data-park-focus="${focusActivity}">${secondaryFocusContent}</section></div>
      <details class="park-panel park-donations"><summary><b>营造捐纳</b><small>消耗库存，换奇蜕与园景进度</small></summary><div class="park-choice-row"><button type="button" data-park-donate="scrip" ${(store.market?.scrip | 0) < PARK_DONATIONS.scrip.cost ? "disabled" : ""}>蛊钱 ${PARK_DONATIONS.scrip.cost} → 营造 ${PARK_DONATIONS.scrip.buildExp}</button>${materials}</div><div class="park-gu-donations">${guCandidates || "<span>暂无可捐的一、二转重复成蛊。</span>"}</div><p>固定兑换 · 保存失败不扣资产。</p></details>
      <p class="park-no-power">营造只提升同一园景的繁盛度与园景名阶，不改变宗门题名；不增加攻击、生命、真元、抽牌、护甲或炼蛊成功率。</p>
    </details>
  </section>`;
}

function renderGuluTabs() {
  return `<nav class="gulu-tabs" aria-label="蛊庐页签">
    <button type="button" class="gulu-tab${guluActiveTab === "home" ? " is-active" : ""}" data-gulu-tab="home">蛊圃</button>
    <button type="button" class="gulu-tab${guluActiveTab === "profile" ? " is-active" : ""}" data-gulu-tab="profile">修行谱</button>
    <button type="button" class="gulu-tab${guluActiveTab === "nurture" ? " is-active" : ""}" data-gulu-tab="nurture">养蛊室</button>
    <button type="button" class="gulu-tab${guluActiveTab === "park" ? " is-active" : ""}" data-gulu-tab="park">游园</button>
    <button type="button" class="gulu-tab${guluActiveTab === "forge" ? " is-active" : ""}" data-gulu-tab="forge">九转鼎</button>
    <button type="button" class="gulu-tab${guluActiveTab === "fusion" ? " is-active" : ""}" data-gulu-tab="fusion">合蛊坛</button>
    <button type="button" class="gulu-tab${guluActiveTab === "collection" ? " is-active" : ""}" data-gulu-tab="collection">藏册</button>
  </nav>`;
}

function getCultivationProfile(store) {
  const heroId = (typeof progression !== "undefined" && progression?.selectedHeroId) || "fate";
  const hero = (typeof HEROES !== "undefined" && HEROES[heroId]) || null;
  const benming = (typeof BENMING_GU !== "undefined" && BENMING_GU[heroId]) || null;
  const benmingInfo = typeof getBenmingStageInfo === "function" ? getBenmingStageInfo(heroId) : { stageName: "未显", dao: 0, next: null, toNext: 0 };
  const allGu = [
    ...(Array.isArray(store?.slots) ? store.slots : []),
    ...(Array.isArray(store?.nurture?.slots) ? store.nurture.slots : []),
  ].filter((slot) => slot?.state === "gu");
  const focusGu = allGu.slice().sort((a, b) => Number(Boolean(b.carry)) - Number(Boolean(a.carry))
    || (b.upgradeLevel | 0) - (a.upgradeLevel | 0))[0] || null;
  const activeRun = typeof runState !== "undefined" && runState?.status === "running" ? runState : null;
  const collectionCount = Object.keys(store?.collection || {}).length;
  const titleCollection = typeof loadJsonStore === "function" && typeof TITLE_COLLECTION_KEY !== "undefined"
    ? loadJsonStore(TITLE_COLLECTION_KEY) : {};
  const titleCount = typeof TITLE_CATALOG !== "undefined"
    ? TITLE_CATALOG.filter((title) => (titleCollection[title.id] | 0) > 0).length : 0;
  const loreCount = typeof LORE_PAGES !== "undefined" && typeof isLoreUnlocked === "function"
    ? LORE_PAGES.filter((page) => isLoreUnlocked(page.id)).length : 0;
  const layers = [
    { glyph: "命", name: "本命道统", value: `${benming?.name || "本命蛊"} · ${benmingInfo.stageName}`, detail: benmingInfo.next ? `道行 ${benmingInfo.dao}，距${benmingInfo.next.name}还差 ${benmingInfo.toNext}` : "当前道统已至圆满阶段" },
    { glyph: "契", name: "契养个体", value: focusGu ? `${getGuluDisplayName(focusGu)} · ${guluTurnName(focusGu.upgradeLevel | 0)}` : "尚无成蛊", detail: focusGu ? `${focusGu.carry ? "当前随行" : "当前重点个体"}；${getGuEvolutionChoiceModel(focusGu)?.summary || "个体蜕变尚未形成"} 来源与关键经历可在详情查看` : "先在蛊圃孵化一只属于你的蛊" },
    { glyph: "行", name: "本局精进", value: activeRun ? `${hero?.name || "蛊修"} · 第 ${typeof getCurrentRouteStep === "function" ? getCurrentRouteStep(activeRun) : 1} 段` : "当前未入塔", detail: activeRun ? "本局牌组、路线与战斗变化只属于本局" : "入塔后会在本局历程中记录成长" },
    { glyph: "录", name: "蛊谱收藏", value: `已收录 ${collectionCount} 种`, detail: `当前在庐 ${allGu.length} 只；藏册记录真实发现与养成` },
    { glyph: "誉", name: "身份荣誉", value: `称号 ${titleCount} · 残卷 ${loreCount}`, detail: "称号、结局与残卷代表经历，不直接叠加基础战力" },
  ];
  return { heroId, layers };
}

function renderCultivationProfile(store) {
  const profile = getCultivationProfile(store);
  return `<section class="cultivation-profile outgame-scroll-region">
    <header><small>蛊庐 · 成长索引</small><h3>修行谱</h3><p>这是已有成长的总目录：用来查本命、个体蛊、本局、收藏与荣誉分别记在哪里，不发任务、不另加属性。</p></header>
    <aside class="cultivation-profile-purpose"><b>怎么用</b><span>先看五层当前值；需要追溯个体来源与同行次数时，回蛊圃点该蛊的“查看详情”。</span></aside>
    <div class="cultivation-profile-layers">${profile.layers.map((layer) => `<article><i>${layer.glyph}</i><div><small>${layer.name}</small><strong>${escGu(layer.value)}</strong><details class="outgame-disclosure cultivation-profile-layer-detail"><summary>这一层记录什么</summary><p>${escGu(layer.detail)}</p></details></div></article>`).join("")}</div>
    <details class="outgame-disclosure cultivation-profile-guide"><summary>怎么看修行谱</summary><p>本命道统决定流派根基；契养个体记录每只蛊的来源与同行；本局精进随离塔结算；蛊谱收藏记录真实发现；身份荣誉承载称号、结局与残卷。收藏与履历不会偷换成永久基础战力。</p></details>
  </section>`;
}
/* V0.9.52 九转鼎（局外合炼，主界面直入）：炉方全表、材料/残核存量、「同名同转」成堆情况一次摊开，
 * 够料的那组直接给入炉按钮。纯展示 + 复用既有 data-gulu-forge 管线，不新增任何规则与状态。 */
/* ===== V0.9.55 升转阶梯（用户定调 B：看全程，不只看当前）=====
 * 九转要花大量基础材料 + 11 残核 + 6 蛊胎 + 多局通关，玩家必须在投入【之前】
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

  const nurtureCap = getNurtureSlotCap();
  const visibleNurtureSlots = n.slots.slice(0, nurtureCap);
  const occupied = visibleNurtureSlots.filter(Boolean).length;
  const focus = resolveGuluNurtureFocus(n);
  const ring = visibleNurtureSlots.map((slot, index) => {
    const pos = getNurtureOrbitSlot(index, nurtureCap);
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
    const showRewardedNurture = guluRewardedAdReady() && canRewardedNurture(store, slot.id, slot);
    if (showRewardedNurture) {
      guluTrackRewardedOffer(
        NmgAds.PLACEMENTS.NURTURE_PROGRESS,
        `${guluTodayKey()}|${slot.id}|${val}`,
        { scene: "nurture" },
      );
    }
    const rewardedNurtureButton = showRewardedNurture
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
  const showRewardedDew = guluRewardedAdReady() && canClaimRewardedDew(store, n);
  if (showRewardedDew) {
    guluTrackRewardedOffer(
      NmgAds.PLACEMENTS.NURTURE_DEW,
      `${guluTodayKey()}|${n.level | 0}|${n.dew | 0}`,
      { scene: "nurture" },
    );
  }
  const rewardedDewButton = showRewardedDew
    ? `<button type="button" class="gulu-rewarded-btn" data-nurture-rewarded-dew="1">看广告 · 元髓露 +1</button>`
    : "";

  const upgradeLine = nextConf
    ? `<button type="button" class="nurture-upgrade" data-nurture-upgrade="1"
        ${(normalizeRedeemOwnedAmount(store.market.scrip) >= conf.upScrip && guluMatTotal(store) >= conf.upMats) ? "" : "disabled"}>
        凿深灵泉 · ${n.level} → ${n.level + 1} 级
        <small>蛊钱 ${conf.upScrip} · 任意材料 ${conf.upMats} ｜ 升后 ${Math.round(nextConf.msPerDew / 60000)} 分钟一滴、可存 ${nextConf.cap} 滴</small>
      </button>`
    : `<p class="gulu-tip">灵泉已至五级，再无可凿之处。</p>`;

  return `<section class="gulu-nurture outgame-scroll-region">
    <header class="gulu-nurture-head">
      <h3>灵泉温养 <small>蛊虫收纳 ${occupied}/${nurtureCap}</small></h3>
      <p class="gulu-tip">选中泉边蛊虫，用元髓露温养；圆满后提高其入炉成功率。</p>
      <details class="outgame-disclosure gulu-nurture-rules"><summary>温养与收纳规则</summary><p>收纳中的蛊不占蛊圃，不能随行或喂本命蛊；九转鼎可直接选作合格的同名祭蛊，无需反复取放。灵泉离线产露，存满后暂停且不会腐坏。</p></details>
    </header>
    ${renderGuluRewardedAdNotice()}
    <section class="gulu-nurture-ring-wrap">
      <h4>泉边温养 <small>一滴元髓露 +${NURTURE_GAIN_PER_DEW} 度，满 ${NURTURE_MAX} 度入炉成功率 +${NURTURE_FORGE_BONUS}</small></h4>
      <div class="nurture-habitat" role="group" aria-label="灵泉与${nurtureCap}处蛊虫栖位">
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
  const orbitLinks = [];
  const cards = candidates.map(({ slot, index }, orbitIndex) => {
    const selected = guluFusionSelectionIds.includes(String(slot.id));
    const hasAnyPartner = candidates.some(({ slot: peer }) => peer.id !== slot.id
      && getGuluFusionPartners(slot.cardKey).includes(peer.cardKey)
      && (peer.upgradeLevel | 0) === (slot.upgradeLevel | 0));
    const isCompatible = Boolean(firstSelected
      ? (!selected && partnerKeys.has(slot.cardKey) && (slot.upgradeLevel | 0) === (firstSelected.upgradeLevel | 0))
      : hasAnyPartner);
    const isIncompatible = Boolean(firstSelected && !selected && !isCompatible);
    const count = Math.max(1, candidates.length);
    const angle = -90 + (360 / count) * orbitIndex;
    const radians = angle * Math.PI / 180;
    const orbitX = 50 + Math.cos(radians) * 42;
    const orbitY = 50 + Math.sin(radians) * 36;
    if (selected || isCompatible) orbitLinks.push(`<line class="${selected ? "is-selected" : "is-compatible"}" x1="50" y1="50" x2="${orbitX.toFixed(2)}" y2="${orbitY.toFixed(2)}"></line>`);
    const card = CARD_LIBRARY[slot.cardKey] || {};
    const art = getGuluCardArt(slot.cardKey);
    return `<button type="button" class="gulu-fusion-pick${selected ? " is-selected" : ""}${isCompatible ? " is-compatible" : ""}${isIncompatible ? " is-incompatible" : ""}" style="--fusion-x:${orbitX.toFixed(2)}%;--fusion-y:${orbitY.toFixed(2)}%" data-gulu-fusion-pick="${escGu(slot.id)}" aria-pressed="${selected}" ${isIncompatible ? "disabled" : ""}>
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
    <p class="gulu-fusion-cost">继承${escGu(guluTurnName(preview.resultLevel))}与较高路线品质「${escGu(getGuluGradeDisplayName(preview.resultGrade))}」 · 任意材料 ${preview.materialCost} 份</p>
    <p class="gulu-fusion-reset">温养清零 · 炉火保底清零</p>
    <p class="gulu-fusion-irreversible">不可逆消耗：确认后两只原蛊消失，只保留第一投入的原槽位与蛊虫身份。</p>
    <details class="outgame-disclosure gulu-fusion-comparison"><summary>查看三蛊效果与数值差异</summary>
      <p class="gulu-fusion-rationale">${escGu(preview.rationale)}</p>
      <div class="gulu-fusion-effects">
        ${renderEffect(preview.firstDetail, "投入一 · 当前效果")}
        ${renderEffect(preview.secondDetail, "投入二 · 当前效果")}
        ${renderEffect(preview.resultDetail, `产物 · ${guluTurnName(preview.resultLevel)}效果`)}
      </div>
      <ul class="gulu-fusion-deltas">${preview.changedFields.length
        ? preview.changedFields.map((field) => `<li><b>${escGu(field.label)}</b><span>${field.first ?? "—"} / ${field.second ?? "—"} → ${field.result ?? "—"}</span></li>`).join("")
        : "<li><span>产物以条件机制重组双方蛊效。</span></li>"}</ul>
    </details>
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
    <header><div><h3>选择投入 <small>不同蛊种 · 同转归一</small></h3><p>先选一只，再从亮起的兼容同转蛊中选第二只。</p></div><span aria-hidden="true">合</span></header>
    ${partnerGuide}
    <div class="gulu-fusion-layout">
      <div class="gulu-fusion-orbit">
        <svg class="gulu-fusion-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${orbitLinks.join("")}</svg>
        <div class="gulu-fusion-stage" aria-live="polite" aria-busy="false">
          <img class="gulu-fusion-stage-art" src="assets/scenes/fusion-altar.webp" alt="合蛊坛" decoding="async">
          <span class="gulu-fusion-stage-glow" aria-hidden="true"></span>
          <span class="gulu-fusion-stage-sparks" aria-hidden="true"></span>
          <span class="gulu-forge-stage-kicker">${chosen.length ? `蛊契 ${chosen.length}/2` : "双蛊待契"}</span>
          <strong class="gulu-forge-stage-status" data-detail="选择环坛亮起的同转蛊">${preview?.ok ? "蛊契已合" : "择蛊归一"}</strong>
        </div>
        <div class="gulu-fusion-picks">${cards || '<p class="gulu-tip">当前没有可合练的非随行成蛊。</p>'}</div>
      </div>
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
  return `<section class="gulu-fusion-altar outgame-scroll-region" aria-label="合蛊坛">
    <header class="gulu-fusion-altar-header">
      <div><small>异种同转 · 双蛊归一</small><h3>合蛊坛</h3><p>按合练明方，把两只同转蛊炼成一只新异蛊。</p></div>
      <dl><div><dt>合练方</dt><dd>${Object.keys(GULU_FUSION_RECIPES).length}</dd></div><div><dt>现有材料</dt><dd>${materialTotal}</dd></div></dl>
    </header>
    ${renderGuluFusionPanel(store)}
  </section>`;
}

function renderGuluForge(store) {
  const cap = getGuluSlotCap();
  const matTotal = MATERIAL_IDS.reduce((sum, id) => sum + normalizeRedeemOwnedAmount(store.materials[id]), 0);
  const forgeNumerals = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const forgeOrbitDelayMs = -(Date.now() % 36000);
  const recipeRows = forgeNumerals.map((numeral, level) => `<li style="--orbit-index:${level}"><button type="button" data-gulu-forge-step="${level}" aria-pressed="${String(guluForgeStepSelected === level)}" aria-label="查看${guluTurnName(level)}炉方"><b>${numeral}</b></button></li>`).join("");
  const selectedRecipe = guluForgeStepSelected >= 0 ? FORGE_RECIPES[guluForgeStepSelected + 1] : null;
  const selectedStable = guluForgeStepSelected >= 0 && guluForgeStepSelected <= 2;
  const selectedOffering = selectedRecipe?.sacrificeLevel ? `另献同名${guluTurnName(selectedRecipe.sacrificeLevel - 1)}蛊` : "同名同转蛊";
  const forgeStepDetail = guluForgeStepSelected < 0
    ? (guluForgeEntryHintVisible ? `<aside class="gulu-forge-step-detail is-idle"><b>点触环鼎大字</b><span>查看该转炉方、消耗与成功率</span></aside>` : "")
    : (selectedRecipe
      ? `<aside class="gulu-forge-step-detail"><b>${guluTurnName(guluForgeStepSelected)} → ${guluTurnName(guluForgeStepSelected + 1)}</b><strong>${selectedStable ? "稳炼必成" : `基础成功率 ${selectedRecipe.rate}%`}</strong><span>${selectedOffering} ${selectedRecipe.fodder} 只 · 材料 ${selectedRecipe.mats}${(selectedRecipe.core | 0) > 0 ? ` · 残核 ${selectedRecipe.core}` : ""}${(selectedRecipe.embryo | 0) > 0 ? ` · 蛊胎 ${selectedRecipe.embryo}` : ""}${(selectedRecipe.scrip | 0) > 0 ? ` · 蛊钱 ${selectedRecipe.scrip}` : ""}</span></aside>`
      : `<aside class="gulu-forge-step-detail is-complete"><b>玖 · 九转祖格</b><strong>蛊道尽头</strong><span>九转已圆满，不再入炉升转。</span></aside>`);
  const oneTurnJourney = getForgeJourneyMinimums(0);
  const twoTurnJourney = getForgeJourneyMinimums(1);
  // 炉险必须在动手前说明；逐转成功率只在炉方环与目标卡各显示一次。
  const rulesBoard = `<section class="gulu-forge-warn" role="note">
    <p class="gulu-forge-quick-rule"><b>低转二合一 · 高转献祭</b><span>一至四转必成 · 五转起有炉险</span></p>
    <details class="outgame-disclosure gulu-forge-rules"><summary><span aria-hidden="true">炼</span> 入炉四则</summary><ol>
      <li>一至六转同名同转二合一；六转以上另献同名三／四／五转蛊</li>
      <li>四转升五转起：失败留蛊，积累 +${FORGE_PITY_STEP}%</li>
      <li>固蛊符：失败时护回残核与蛊胎</li>
      <li>温养、积累、引火砂共用 ${FORGE_RATE_CAP}% 上限</li>
    </ol></details>
    <details class="outgame-disclosure gulu-forge-journey"><summary>查看零失败直达九转成本</summary><p>一转起共需 ${oneTurnJourney.totalEquivalentGu} 只（含当前目标，另备 ${oneTurnJourney.additionalEquivalentGu} 只）、材料 ${oneTurnJourney.materials}、残核 ${oneTurnJourney.cores}、蛊胎 ${oneTurnJourney.embryos}、蛊钱 ${oneTurnJourney.scrip}，峰值 ${oneTurnJourney.peakSlots} 格；二转起共需 ${twoTurnJourney.totalEquivalentGu} 只（另备 ${twoTurnJourney.additionalEquivalentGu} 只）、材料 ${twoTurnJourney.materials}、蛊钱 ${twoTurnJourney.scrip}，峰值 ${twoTurnJourney.peakSlots} 格。未计失败追加消耗。</p></details>
  </section>`;
  // 按「同名 + 同转」归堆——这正是炉方的计量单位，玩家一眼能看出还差几只。
  const groups = new Map();
  store.slots.forEach((slot, index) => {
    if (index >= cap || !slot || slot.state !== "gu") return;
    const key = `${slot.cardKey}@${slot.upgradeLevel | 0}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ slot, index });
  });
  const cardViews = [...groups.values()].map((entries) => {
    // 随行蛊不能入炉：同组优先选可用的非随行实例，避免随行实例抢占整组操作入口。
    const target = entries.find((e) => !e.slot.carry) || entries[0];
    const chk = canForgeUp(store, target.slot);
    const turn = guluTurnName(target.slot.upgradeLevel);
    const name = CARD_LIBRARY[target.slot.cardKey]?.name || target.slot.name || "成蛊";
    const risky = (target.slot.upgradeLevel | 0) >= 3;
    const nurtureBonus = risky ? getNurtureForgeBonus(target.slot) : 0;
    const pityBonus = risky ? Math.max(0, target.slot.forgePity | 0) : 0;
    const qualityBonus = risky ? getGuluQualityForgeBonus(target.slot) : 0;
    const shownRate = getForgeSuccessRate(target.slot.upgradeLevel, 0, nurtureBonus, pityBonus, qualityBonus);
    const forgeStepRevealed = guluForgeStepSelected === (target.slot.upgradeLevel | 0);
    const rateBreakdown = risky
      ? `炉方 ${chk.recipe?.rate | 0}%${qualityBonus > 0 ? ` · 精品 +${qualityBonus}%` : ""}${nurtureBonus > 0 ? ` · 温养 +${nurtureBonus}%` : ""}${pityBonus > 0 ? ` · 积累 +${pityBonus}%` : ""}`
      : "稳炼必成";
    const fodderNow = chk.fodder ? chk.fodder.length : 0;
    const need = chk.recipe ? chk.recipe.fodder : 0;
    const requirementRows = [
      ["同伴", fodderNow, need],
      ["材料", matTotal, chk.recipe?.mats | 0],
      ["残核", store.bossCores | 0, chk.recipe?.core | 0],
      ["蛊胎", store.guEmbryo | 0, chk.recipe?.embryo | 0],
      ["蛊钱", normalizeRedeemOwnedAmount(store.market?.scrip), chk.recipe?.scrip | 0],
    ];
    const requirementMarkup = `<div class="gulu-forge-requirements">${requirementRows.map(([label, now, required]) =>
      `<span class="gulu-forge-requirement${required > 0 && now >= required ? " is-ready" : ""}${required <= 0 ? " is-unused" : ""}"><b>${label}</b> ${now}/${required}</span>`
    ).join("")}</div>`;
    const line = chk.recipe
      ? `<span class="gulu-forge-rate-line${forgeStepRevealed ? " is-revealed" : ""}">${forgeStepRevealed
          ? `<b class="gulu-forge-rate">本次成功率 ${shownRate}%</b><small>${rateBreakdown}</small>`
          : `<b class="gulu-forge-rate">点触环鼎「${forgeNumerals[target.slot.upgradeLevel | 0]}」查看炉方</b>`}</span>
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
      ? `直达九转最低：共需同源蛊 ${journey.totalEquivalentGu} 只（含当前目标，另备 ${journey.additionalEquivalentGu} 只） · 材料 ${journey.materials} · 残核 ${journey.cores} · 蛊胎 ${journey.embryos} · 蛊钱 ${journey.scrip} · 峰值 ${journey.peakSlots} 格；未计失败追加消耗。`
      : "";
    const targetId = String(target.slot.id || `${target.slot.cardKey}@${target.slot.upgradeLevel | 0}`);
    const costOpen = guluForgeCostTargetId === targetId;
    const card = `<article class="gulu-forge-card${chk.ok ? " is-ready" : ""}">
      <h4>${escGu(name)} <b>${turn}</b><small>庐中共 ${entries.length} 只${target.slot.carry ? " · 目标随行中" : ""}</small></h4>
      <div class="gulu-forge-lines">${line}</div>
      ${(progressionSummary || journeySummary) ? `<button type="button" class="gulu-forge-cost-open" data-gulu-forge-cost-open="${escGu(targetId)}" aria-expanded="${String(costOpen)}">${costOpen ? "收起成长与九转成本" : "查看成长与直达九转成本"}</button>` : ""}
      ${renderGuTurnLadder(target.slot)}
      ${(!chk.ok && chk.reason) ? `<p class="gulu-forge-why">${escGu(chk.reason)}</p>` : ""}
      <button type="button" class="gulu-forge-btn" data-gulu-forge="${target.index}" ${chk.ok ? "" : "disabled"}>${chk.ok ? "入炉 · 升一转" : "炉方未备"}</button>
    </article>`;
    return { targetId, name, turn, progressionSummary, journeySummary, card };
  });
  const cards = cardViews.map((view) => view.card).join("");
  const selectedCostView = cardViews.find((view) => view.targetId === guluForgeCostTargetId);
  const costReader = selectedCostView ? `<section class="gulu-forge-cost-reader" data-gulu-forge-cost-reader tabindex="-1" aria-label="${escGu(selectedCostView.name)}成长与直达九转成本">
      <header><div><small>当前目标 · ${escGu(selectedCostView.turn)}</small><h4>${escGu(selectedCostView.name)}</h4></div><button type="button" data-gulu-forge-cost-close>收起</button></header>
      ${selectedCostView.progressionSummary ? `<p><b>成长记录</b>${escGu(selectedCostView.progressionSummary)}</p>` : ""}
      ${selectedCostView.journeySummary ? `<p><b>直达九转</b>${escGu(selectedCostView.journeySummary)}</p>` : ""}
    </section>` : "";
  const stockBoard = `<aside class="gulu-forge-stock-board" aria-label="鼎中库存">
    <h3>炉藏</h3>
    <dl>
      <div><dt>引火砂</dt><dd>${store.kindleSand | 0}</dd></div>
      <div><dt>固蛊符</dt><dd>${store.guWard | 0}</dd></div>
      <div><dt>蛊胎</dt><dd>${store.guEmbryo | 0}</dd></div>
      <div><dt>残核</dt><dd>${store.bossCores | 0}</dd></div>
      <div><dt>材料</dt><dd>${matTotal}</dd></div>
      <div><dt>蛊钱</dt><dd>${normalizeRedeemOwnedAmount(store.market?.scrip)}</dd></div>
    </dl>
    <details class="outgame-disclosure gulu-forge-terms"><summary>术语与高转材料</summary><p><span>孵化路线：基础／道脉</span><br><span>品质：次品／精品（精品炉率 +8%）</span><br><span>炼成蛊格：五天 · 六神 · 七八皇 · 九祖</span><br>六转起另耗残核与蛊胎。</p></details>
  </aside>`;
  return `<section class="gulu-forge-workbench outgame-scroll-region" aria-label="九转鼎炼蛊台">
    ${rulesBoard}
    <div class="gulu-forge-orbit">
      <ol class="gulu-forge-recipes" aria-label="九转炉方" style="--forge-orbit-delay:${forgeOrbitDelayMs}ms">${recipeRows}</ol>
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
      ${forgeStepDetail}
    </div>
    ${stockBoard}
    <section class="gulu-forge-target-ring">
      <h3>择蛊入炉 <small>主圃/养蛊室同名同转可作燃料 · 随行蛊不入炉</small></h3>
      <div class="gulu-forge-grid">${cards || "<p class=\"gulu-tip\">蛊圃暂无成蛊，破壳后再来。</p>"}</div>
      ${costReader}
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
function renderBaigushiMarketOfferCard(offer, state, options = {}) {
  const card = CARD_LIBRARY[offer.cardKey];
  const art = getGuluCardArt(offer.cardKey);
  const sold = Boolean(state.bought?.[offer.id]);
  const locked = options.locked === true;
  const grade = getGuluGradeDisplayName(offer.grade);
  return `<article class="baigushi-market-offer${sold ? " is-sold" : ""}${locked ? " is-locked" : ""}">
    <div class="baigushi-market-offer-art">${art ? `<img src="${escGu(art)}" alt="" loading="lazy" decoding="async">` : `<span>${escGu(card?.glyph || "蛊")}</span>`}<i>${escGu(grade)}</i></div>
    <div class="baigushi-market-offer-copy"><h4>${escGu(card?.name || offer.cardKey)}</h4><p>${escGu(stripTags(getCardEffect(offer.cardKey, GULU_GRADES[offer.grade]?.upgrade || 0)))}</p><small>${offer.heroId ? `${escGu(BENMING_GU?.[offer.heroId]?.name || "异脉")} · ` : ""}${offer.price} 蛊钱</small></div>
    <button type="button" data-baigushi-market-buy="${escGu(offer.id)}" ${sold || locked ? "disabled" : ""}>${sold ? "已售" : (locked ? "尚未开放" : `购入 · ${offer.price}`)}</button>
  </article>`;
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
  if (rewardedRestock) {
    guluTrackRewardedOffer(
      NmgAds.PLACEMENTS.MARKET_RESTOCK,
      `${dateKey}|${rewardedRestock.id}`,
      { scene: "market" },
    );
  }
  const rewardedRestockButton = rewardedRestock
    ? `<button type="button" class="gulu-rewarded-btn baigushi-quick-card" data-baigushi-rewarded-restock="${escGu(rewardedRestock.id)}"><span aria-hidden="true">补</span><strong>看广告 · 补货</strong><small>「${escGu(rewardedRestock.name)}」×1</small></button>`
    : "";
  /* V0.9.51 用户定调「这么多材料不能都显示」：只列持有量 >0 的，0 的不占位（此前 9 种恒显、多半是 ×0 噪音）。
   * 一件都没有时给一句提示，不留空白。 */
  const ownedMats = MATERIAL_IDS.filter((id) => normalizeRedeemOwnedAmount(store.materials[id]) > 0)
    .map((id) => `<span class="gulu-mat tone-${MATERIALS[id].tone || "jade"}">${renderGuluMaterialArt(MATERIALS[id])}${MATERIALS[id].name}<i>×${normalizeRedeemOwnedAmount(store.materials[id])}</i></span>`).join("")
    + ECOLOGY_MATERIAL_IDS.filter((id) => normalizeRedeemOwnedAmount(store.ecologyMaterials[id]) > 0)
      .map((id) => `<span class="gulu-mat tone-${ECOLOGY_MATERIALS[id].tone || "jade"}">${renderGuluMaterialArt(ECOLOGY_MATERIALS[id])}${ECOLOGY_MATERIALS[id].name}<i>×${normalizeRedeemOwnedAmount(store.ecologyMaterials[id])}</i></span>`).join("")
    + (normalizeRedeemOwnedAmount(store.bossCores) > 0 ? `<span class="gulu-mat tone-boss">${renderGuluMaterialArt({ image: GULU_FORGE_SUPPLY_ART.bossCores, glyph: "核" })}蛊母残核<i>×${normalizeRedeemOwnedAmount(store.bossCores)}</i></span>` : "");
  const resources = ownedMats || `<span class="gulu-mat-empty">尚无资材——通关带出或在此购入。</span>`;
  const materialShelf = MATERIAL_IDS.map((id) => {
    const price = BAIGUSHI_MATERIAL_PRICES[id];
    const left = dailyStock[id] | 0;
    const affordable = scripNow >= price;
    return `<article class="baigushi-material tone-${MATERIALS[id].tone || "jade"}">
      ${renderGuluMaterialArt(MATERIALS[id], "baigushi-material-art")}
      <div><strong>${MATERIALS[id].name}</strong><small>今日余 ${left}/3</small></div>
      <button type="button" data-baigushi-material="${id}" ${left > 0 && affordable ? "" : "disabled"}>${left <= 0 ? "售罄" : (affordable ? `${price} 蛊钱` : "蛊钱不足")}</button>
    </article>`;
  }).join("");
  const ecologyShelf = ecologyDaily.ids.map((id) => {
    const material = ECOLOGY_MATERIALS[id];
    const left = ecologyDaily.stock[id] | 0;
    const affordable = scripNow >= ECOLOGY_MARKET_GOOD.price;
    return `<article class="baigushi-material tone-${material.tone || "jade"}">${renderGuluMaterialArt(material, "baigushi-material-art")}<div><strong>${material.name}×${ECOLOGY_MARKET_GOOD.count}</strong><small>生态行脚 · 今日余 ${left}/1</small></div><button type="button" data-baigushi-ecology-material="${id}" ${left > 0 && affordable ? "" : "disabled"}>${left <= 0 ? "售罄" : (affordable ? `${ECOLOGY_MARKET_GOOD.price} 蛊钱` : "蛊钱不足")}</button></article>`;
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
  const marketState = getBaigushiMarketState(store, dateKey);
  const marketCatalog = getCurrentBaigushiMarketCatalog(store, dateKey);
  const primaryHero = BENMING_GU?.[marketCatalog.primaryHeroId];
  const primaryCards = marketCatalog.primaryOffers.map((offer) => renderBaigushiMarketOfferCard(offer, marketState)).join("");
  const otherPathCards = marketCatalog.otherPaths.map((path) => {
    const open = path.unlocked || Boolean(marketState.daoUnlocks[path.heroId]);
    const hero = BENMING_GU?.[path.heroId];
    if (!open && guluRewardedAdReady()) {
      guluTrackRewardedOffer(NmgAds.PLACEMENTS.MARKET_DAO_UNLOCK, `${dateKey}|${path.heroId}`, { scene: "market" });
    }
    return `<section class="baigushi-path-block${open ? " is-open" : " is-locked"}"><header><div><span>${escGu(hero?.glyph || "脉")}</span><h4>${escGu(hero?.name || path.heroId)}</h4></div>${open ? `<small>${path.unlocked ? "境界已达 · 今日开放" : "广告契 · 今日开放"}</small>` : `<button type="button" data-baigushi-dao-unlock="${escGu(path.heroId)}" ${guluRewardedAdReady() ? "" : "disabled"}>看广告 · 解锁今日寄售</button>`}</header><div class="baigushi-path-offers">${path.offers.map((offer) => renderBaigushiMarketOfferCard(offer, marketState, { locked: !open })).join("")}</div></section>`;
  }).join("");
  const ordinaryCards = marketCatalog.ordinaryOffers.map((offer) => renderBaigushiMarketOfferCard(offer, marketState)).join("");
  const refreshLeft = BAIGUSHI_MARKET_RULES.refreshLimit - marketState.refreshIndex;
  const parkTicketOffer = canClaimBaigushiMarketParkTicket(store, dateKey, { adAvailable: guluRewardedAdReady() });
  if (parkTicketOffer.ok) guluTrackRewardedOffer(NmgAds.PLACEMENTS.MARKET_PARK_TICKET, `${dateKey}|${parkTicketOffer.count}`, { scene: "market" });
  const ordinaryRemaining = marketCatalog.ordinaryOffers.filter((offer) => !marketState.bought[offer.id]).length;
  const ordinaryFullStall = `<section class="baigushi-stall-panel baigushi-ordinary-fullscreen" data-market-panel="market">
    <header class="baigushi-ordinary-fullscreen-head"><div><small>普通蛊池 · 每日通用蛊</small><h3>今日 ${BAIGUSHI_MARKET_RULES.ordinaryDailyStock} 只</h3><p>不含任何道脉专属蛊；列表可上下滑动，换市只重置普通池。</p></div><b>${ordinaryRemaining}/${BAIGUSHI_MARKET_RULES.ordinaryDailyStock}</b><button type="button" data-baigushi-ordinary-close="1">返回今日市集</button></header>
    <div class="baigushi-ordinary-fullscreen-tools"><button type="button" data-baigushi-market-refresh="1" ${refreshLeft > 0 && scripNow >= BAIGUSHI_MARKET_RULES.refreshCost ? "" : "disabled"}>换市 ${BAIGUSHI_MARKET_RULES.refreshCost} 蛊钱 · 余 ${refreshLeft}/2</button><span>上下滑动查看全部通用蛊</span></div>
    <div class="baigushi-ordinary-scroll">${ordinaryCards}</div>
  </section>`;
  const marketAStall = guluOrdinaryMarketOpen ? ordinaryFullStall : `<section class="baigushi-stall-panel baigushi-market-a" data-market-panel="market">
    <div class="baigushi-market-main">
      <section class="baigushi-market-primary"><header><div><small>本命道脉 · 今日专供</small><h3>${escGu(primaryHero?.name || "本命道脉")}</h3><p>按当前最高道行择脉，每日三枚道脉精品卵。</p></div><span>${escGu(primaryHero?.glyph || "命")}</span></header><div class="baigushi-primary-offers">${primaryCards}</div></section>
      <section class="baigushi-market-other"><header><div><small>异脉寄售</small><h3>五脉暗市</h3></div><p>本命三转自然开放；未达境界可用广告契开放今日寄售。</p></header><div class="baigushi-other-paths">${otherPathCards}</div></section>
      <section class="baigushi-market-materials"><header><div><small>炼材长案</small><h3>基础材与生态异材</h3></div><button type="button" data-baigushi-stall="materials">查看全部材料</button></header><div class="baigushi-market-material-strip">${materialShelf}${ecologyShelf}</div></section>
    </div>
    <aside class="baigushi-market-side">
      <section class="baigushi-ordinary-pool"><header><div><small>普通蛊池</small><h3>今日 ${BAIGUSHI_MARKET_RULES.ordinaryDailyStock} 只</h3></div><b>${ordinaryRemaining}/${BAIGUSHI_MARKET_RULES.ordinaryDailyStock}</b><button type="button" class="baigushi-ordinary-open" data-baigushi-ordinary-open="1">查看${BAIGUSHI_MARKET_RULES.ordinaryDailyStock}只</button></header><p>不含任何道脉专属蛊；换市只重置普通池。</p><button type="button" data-baigushi-market-refresh="1" ${refreshLeft > 0 && scripNow >= BAIGUSHI_MARKET_RULES.refreshCost ? "" : "disabled"}>换市 ${BAIGUSHI_MARKET_RULES.refreshCost} 蛊钱 · 余 ${refreshLeft}/2</button><div class="baigushi-ordinary-scroll">${ordinaryCards}</div></section>
      <section class="baigushi-ticket-counter"><span>帖</span><div><small>每日限售 · 广告契</small><h3>游园帖 ×1</h3><p>今日 ${parkTicketOffer.count || 0}/${BAIGUSHI_MARKET_RULES.parkTicketDailyLimit}</p></div><button type="button" data-baigushi-park-ticket="1" ${parkTicketOffer.ok ? "" : "disabled"}>${parkTicketOffer.remaining > 0 ? "看广告领取" : "今日售罄"}</button></section>
    </aside>
  </section>`;
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
    <h3>育蛊方 <small>用指定炼材定向结出基础蛊，不再单占一个摊位</small></h3>
    ${featuredEgg}
    <div class="baigushi-grid">${ecologyRecipes}</div>
    <div class="baigushi-grid">${recipes}</div>
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
  const bundleTargets = MATERIAL_IDS.map((id) => `<button type="button" data-baigushi-bundle-material="${id}" ${bundleLeft > 0 && scripNow >= bundleGood.price ? "" : "disabled"}>${renderGuluMaterialArt(MATERIALS[id], "baigushi-bundle-material-art")}${MATERIALS[id].name}</button>`).join("");
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
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.healingSalve, glyph: "散" }, "baigushi-curio-art")}<div><h4>养伤散</h4>${renderBaigushiDescription("立即解除本命蛊的静养状态。")}<small>今日余 ${salveLeft}/1 · 蛊钱 ${salveGood.price}</small></div><button type="button" data-baigushi-healing-salve="1" ${salveLeft > 0 && store.injuryUntil > now && scripNow >= salveGood.price ? "" : "disabled"}>${store.injuryUntil > now ? (salveLeft > 0 ? (scripNow >= salveGood.price ? "立即养伤" : "蛊钱不足") : "今日售罄") : "无需静养"}</button></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.materialCrate, glyph: "匣" }, "baigushi-curio-art")}<div><h4>炉材匣</h4>${renderBaigushiDescription(`${formatBaigushiCost(crateGood.contents)}。`)}<small>今日余 ${crateLeft}/1 · 蛊钱 ${crateGood.price}</small></div><button type="button" data-baigushi-material-crate="1" ${crateLeft > 0 && scripNow >= crateGood.price ? "" : "disabled"}>${crateLeft <= 0 ? "今日售罄" : (scripNow >= crateGood.price ? "购入炉材匣" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.gradeSeal, glyph: "质" }, "baigushi-curio-art")}<div><h4>凝质符</h4>${renderBaigushiDescription("指定未破壳的次品蛊卵提升为同路线精品；不会跨到另一条孵化路线。")}<small>今日余 ${gradeLeft}/1 · 蛊钱 ${gradeGood.price}</small></div><div class="baigushi-curio-actions">${gradeTargets}</div></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.marrowJade, glyph: "髓" }, "baigushi-curio-art")}<div><h4>换髓玉</h4>${renderBaigushiDescription("指定成蛊保留路线与品质重新结卵，换成另一只通用蛊。")}<small>今日余 ${marrowLeft}/1 · 蛊钱 ${marrowGood.price}</small></div><div class="baigushi-curio-actions">${marrowTargets}</div></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.daoFruit, glyph: "道" }, "baigushi-curio-art")}<div><h4>本命道果</h4>${renderBaigushiDescription(`${selectedBenming?.name || "当前本命蛊"}吞服后，道行立即 +${daoGood.dao}。`)}<small>今日余 ${daoLeft}/1 · 蛊钱 ${daoGood.price}</small></div><button type="button" data-baigushi-dao-fruit="1" ${daoLeft > 0 && selectedBenming && scripNow >= daoGood.price ? "" : "disabled"}>${daoLeft <= 0 ? "今日售罄" : (scripNow >= daoGood.price ? "吞服道果" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.guEmbryo, glyph: "胎" }, "baigushi-curio-art")}<div><h4>蛊胎</h4>${renderBaigushiDescription(`九转鼎六转以上炉方的必需之物。现存 ${normalizeRedeemOwnedAmount(store.guEmbryo)} 枚。`)}<small>今日余 ${embryoLeft}/1 · 蛊钱 ${embryoGood.price}</small></div><button type="button" data-baigushi-forge-supply="guEmbryo" ${embryoLeft > 0 && scripNow >= embryoGood.price ? "" : "disabled"}>${embryoLeft <= 0 ? "今日售罄" : (scripNow >= embryoGood.price ? "购入蛊胎" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.guWard, glyph: "固" }, "baigushi-curio-art")}<div><h4>固蛊符</h4>${renderBaigushiDescription(`高转合炼失败时自动碎裂，返还本炉消耗的蛊母残核与蛊胎；不提高成功率。现存 ${normalizeRedeemOwnedAmount(store.guWard)} 张。`)}<small>今日余 ${wardLeft}/1 · 蛊钱 ${wardGood.price}</small></div><button type="button" data-baigushi-forge-supply="guWard" ${wardLeft > 0 && scripNow >= wardGood.price ? "" : "disabled"}>${wardLeft <= 0 ? "今日售罄" : (scripNow >= wardGood.price ? "购入固蛊符" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.coreTriple, glyph: "核" }, "baigushi-curio-art")}<div><h4>残核匣 · 三枚装</h4>${renderBaigushiDescription(`一次得蛊母残核 ${coreTripleGood.count} 枚。一转直达九转零失败共要 17 枚，这是主要来源。现存 ${store.bossCores | 0} 枚。`)}<small>今日余 ${coreTripleLeft}/${coreTripleGood.dailyStock} · 蛊钱 ${coreTripleGood.price}</small></div><button type="button" data-baigushi-core-triple="1" ${coreTripleLeft > 0 && scripNow >= coreTripleGood.price ? "" : "disabled"}>${coreTripleLeft <= 0 ? "今日售罄" : (scripNow >= coreTripleGood.price ? "购入三枚" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.kindlePouch, glyph: "砂" }, "baigushi-curio-art")}<div><h4>砂囊</h4>${renderBaigushiDescription(`一次得引火砂 ${pouchGood.count} 份；每份可使一次入炉成功率 +${FORGE_KINDLE_BONUS}。现存 ${store.kindleSand | 0} 份。`)}<small>今日余 ${pouchLeft}/${pouchGood.dailyStock} · 蛊钱 ${pouchGood.price}</small></div><button type="button" data-baigushi-forge-supply="kindlePouch" ${pouchLeft > 0 && scripNow >= pouchGood.price ? "" : "disabled"}>${pouchLeft <= 0 ? "今日售罄" : (scripNow >= pouchGood.price ? "购入砂囊" : "蛊钱不足")}</button></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.twinMarrowPair, glyph: "对" }, "baigushi-curio-art")}<div><h4>双生对髓</h4>${renderBaigushiDescription(`照指定成蛊一次结 ${twinPairGood.count} 枚同名三转之卵；只取蛊种，不复制样本转数。需 ${twinPairGood.count} 个空圃，当前空 ${emptyPlots} 个。`)}<small>今日余 ${twinPairLeft}/${twinPairGood.dailyStock} · 蛊钱 ${twinPairGood.price}</small></div><div class="baigushi-curio-actions">${twinPairTargets}</div></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.materialBundle, glyph: "草" }, "baigushi-curio-art")}<div><h4>百草囊</h4>${renderBaigushiDescription(`自选一种炼蛊材料，一次得 ${bundleGood.count} 份。基础材与道脉材分别结算，不能跨组替代。`)}<small>今日余 ${bundleLeft}/${bundleGood.dailyStock} · 蛊钱 ${bundleGood.price}</small></div><div class="baigushi-curio-actions">${bundleTargets}</div></article>
      <article class="baigushi-curio">${renderGuluMaterialArt({ image: BAIGUSHI_CURIO_ART.hatchBreaker, glyph: "锥" }, "baigushi-curio-art")}<div><h4>破壳锥</h4>${renderBaigushiDescription("凿开指定蛊卵，立即破壳，不必再等。与看广告破壳各自独立、互不占用次数。")}<small>今日余 ${breakerLeft}/${breakerGood.dailyStock} · 蛊钱 ${breakerGood.price}</small></div><div class="baigushi-curio-actions">${breakerTargets}</div></article>
    </div>
  </section>`;
  const wardStall = `<section class="baigushi-stall-panel" data-market-panel="ward">
    <h3>护命柜 <small>保全稀有随行蛊，不提供永久数值成长</small></h3>
    <section class="baigushi-ward ${wardCount ? "is-owned" : ""}">
      ${renderGuluMaterialArt({ image: GULU_FORGE_SUPPLY_ART.guWard, glyph: "匣" }, "baigushi-ward-art")}
      <div><h4>护命蛊匣 <em>${wardCount}/${getBaigushiWardMax()}</em></h4>
      ${renderBaigushiDescription("下次真实陨落时，若有道脉蛊随行，自动保全其中一只；没有道脉蛊时绝不浪费。")}
      <small>${formatBaigushiCost(BAIGUSHI_WARD_COST.materials)}、蛊母残核×${BAIGUSHI_WARD_COST.bossCores}、蛊钱 ${BAIGUSHI_WARD_SCRIP_COST}</small></div>
      <button type="button" data-baigushi-ward="1" ${wardCount < getBaigushiWardMax() && wardAffordable ? "" : "disabled"}>${wardCount >= getBaigushiWardMax() ? "已达上限" : (wardAffordable ? "换取蛊匣" : "资材不足")}</button>
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
  const sealSunset = getBaigushiSealSunsetState(now);
  const sealStall = `<section class="baigushi-stall-panel" data-market-panel="seals">
    <h3>印记阁 <small>余 ${sealSunset.days} 天 · ${BAIGUSHI_SEAL_SUNSET_DATE} 下架 · 成就永久保留${sealPending.length ? ` · 待兑 ${sealPending.length} 枚` : ""}</small></h3>
    <div class="baigushi-seal-list">${sealRows}</div>
  </section>`;
  const stallPanels = { market: marketAStall, materials: materialStall, curios: curiosStall, ward: wardStall, ...(sealSunset.active ? { seals: sealStall } : {}) };
  if (!stallPanels[guluMarketStall]) guluMarketStall = "market";
  const stallNav = [["market", "今日市集"], ["materials", "炼材长案"], ["curios", "奇物行"], ["ward", "护命柜"], ...(sealSunset.active ? [["seals", `印记阁 · 余${sealSunset.days}天`]] : [])]
    .map(([id, label]) => `<button type="button" class="${guluMarketStall === id ? "is-active" : ""}" data-baigushi-stall="${id}" aria-pressed="${guluMarketStall === id}">${label}</button>`).join("");
  const showRewardedScrip = guluRewardedAdReady() && canClaimRewardedScrip(store, store.market);
  if (showRewardedScrip) {
    guluTrackRewardedOffer(
      NmgAds.PLACEMENTS.MARKET_GU_COIN,
      `${dateKey}|${scripNow}`,
      { scene: "market" },
    );
  }
  const rewardedScripButton = showRewardedScrip
    ? `<button type="button" class="gulu-rewarded-btn baigushi-quick-card" data-baigushi-rewarded-scrip="1"><span aria-hidden="true">契</span><strong>看广告 · 领 6 蛊钱</strong><small>今日夜市补贴</small></button>`
    : "";
  return `<section class="baigushi-shell outgame-scroll-region">
    <details class="outgame-disclosure baigushi-rules"><summary>蛊钱如何获得与使用</summary><p>蛊钱只在塔外流通。活着离塔时，每余 5 蛊石可换 1 蛊钱，每局至多换 12 枚；蛊钱不可带入命途，也不直接增加战斗数值。</p></details>
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
    if (guluCollectionFilter === "rare") return CARD_LIBRARY[entry.cardKey]?.parkRare === true;
    return true;
  });
  const filters = [["all", "全部"], ["rare", "珍稀蛊"], ["present", "当前在庐"], ["carried", "随行"], ["fed", "已投喂"], ["released", "已归野"]]
    .map(([id, label]) => `<button type="button" class="gulu-collection-filter${guluCollectionFilter === id ? " is-active" : ""}" data-gulu-collection-filter="${id}">${label}</button>`).join("");
  const cards = shown.map((entry) => {
    const card = CARD_LIBRARY[entry.cardKey];
    const counts = getGuluCollectionCurrentCounts(store, entry.cardKey);
    const grade = GULU_GRADES[entry.highestGrade] || GULU_GRADES.fan;
    const art = getGuluCardArt(entry.cardKey);
    const combatTone = typeof getGuCombatTone === "function" ? getGuCombatTone({ ...(card || {}), stage: entry.fusionCount > 0 ? "合练异蛊" : "" }) : "support";
    const rareBadge = card?.parkRare === true ? '<small class="gulu-rare-badge">珍稀蛊</small>' : "";
    return `<article class="gulu-collection-item tone-${combatTone}${card?.parkRare === true ? " is-rare" : ""}">
      <button type="button" class="gulu-collection-open" data-gulu-codex="${escGu(entry.cardKey)}">
        ${rareBadge}
        <span class="gulu-collection-art">${art ? `<img src="${art}" alt="" loading="lazy" decoding="async">` : `<i>${escGu(card?.glyph || "蛊")}</i>`}</span>
        <span class="gulu-collection-copy"><strong>${escGu(card?.name || entry.cardKey)}</strong><small>最高 ${getGuluGradeDisplayName(entry.highestGrade)} · 在庐 ${counts.inGulu} · 随行 ${counts.carried}</small><em>查看蛊虫详情</em></span>
      </button>
      <details class="outgame-disclosure gulu-collection-history"><summary>养成履历</summary><p>累计孵化 ${entry.hatchedCount | 0} · 合练所得 ${entry.fusionCount | 0}${(entry.giftedCount | 0) > 0 ? ` · 补发所得 ${entry.giftedCount | 0}` : ""} · 已投喂 ${entry.fedCount | 0} · 已归野 ${entry.releasedCount | 0}</p><p>${entry.legacyBackfill ? "旧档现存蛊已安全补录 · 自本版起收录" : `首次收录 ${new Date(entry.firstRecordedAt || 0).toLocaleDateString()} · ${entry.firstRecordedVersion || GULU_COLLECTION_BUILD}`}</p></details>
    </article>`;
  }).join("");
  return `<section class="gulu-collection outgame-scroll-region"><header><div><h3>蛊庐藏册</h3><p>找你养过的个体；完整蛊种资料仍查万蛊录。</p></div><span>已收录 ${entries.length}</span></header>
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

/* 九转鼎目标横栏同时承担横向选蛊与蛊庐正文纵向阅读。
 * 移动浏览器会把从横栏起手的纵向手势锁给这个横向滚动层，因此在此处只按
 * 首个明确方向接管本次触控：横向继续拖横栏，纵向交给 #guluBody。 */
function bindGuluForgeTargetTouch() {
  const body = dom.guluBody;
  if (!body || body.dataset.forgeTargetTouchBound === "1") return;
  body.dataset.forgeTargetTouchBound = "1";
  let gesture = null;
  body.addEventListener("touchstart", (event) => {
    const grid = event.target.closest?.(".gulu-forge-target-ring .gulu-forge-grid");
    const touch = event.touches?.[0];
    if (!grid || !touch || event.touches.length !== 1) { gesture = null; return; }
    gesture = {
      grid,
      startX: touch.clientX,
      startY: touch.clientY,
      startLeft: grid.scrollLeft,
      startTop: body.scrollTop,
      axis: "",
    };
  }, { passive: true });
  body.addEventListener("touchmove", (event) => {
    const touch = event.touches?.[0];
    if (!gesture || !touch || event.touches.length !== 1) return;
    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;
    if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 6) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (!gesture.axis) return;
    event.preventDefault();
    if (gesture.axis === "x") gesture.grid.scrollLeft = gesture.startLeft - dx;
    else body.scrollTop = gesture.startTop - dy;
  }, { passive: false });
  const finish = () => { gesture = null; };
  body.addEventListener("touchend", finish, { passive: true });
  body.addEventListener("touchcancel", finish, { passive: true });
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
function getGuluDisclosureKey(details, index) {
  const explicit = String(details?.dataset?.guluDisclosureKey || "").trim();
  if (explicit) return `key:${explicit}`;
  const summary = String(details?.querySelector?.("summary")?.textContent || "").replace(/\s+/g, " ").trim();
  return summary ? `summary:${summary}` : `index:${index}`;
}

function captureGuluDisclosureState(root) {
  return Array.from(root?.querySelectorAll?.("details") || []).map((details, index) => ({
    key: getGuluDisclosureKey(details, index),
    open: Boolean(details.open),
  }));
}

function restoreGuluDisclosureState(root, state) {
  const saved = new Map(Array.from(state || []).map((entry) => [String(entry?.key || ""), Boolean(entry?.open)]));
  Array.from(root?.querySelectorAll?.("details") || []).forEach((details, index) => {
    const key = getGuluDisclosureKey(details, index);
    if (saved.has(key)) details.open = saved.get(key);
  });
}

function renderGulu({ preserveScroll = true } = {}) {
  if (!dom.guluBody) return;
  scheduleGuluNoticeDismissal();
  const previousScrollTop = preserveScroll ? (getGuluScrollContainer()?.scrollTop || 0) : 0;
  const previousDisclosureState = captureGuluDisclosureState(dom.guluBody);
  const previousRecipeOverlay = dom.guluBody.querySelector?.("[data-gulu-recipes-overlay]") || null;
  const previousRecipeFilter = previousRecipeOverlay?.querySelector('[data-gulu-recipes-filter][aria-pressed="true"]')?.dataset.guluRecipesFilter || "all";
  const previousRecipeState = {
    open: Boolean(previousRecipeOverlay && !previousRecipeOverlay.classList.contains("hidden")),
    filter: previousRecipeFilter,
    scrollTop: previousRecipeOverlay?.querySelector(".gulu-recipe-scroll")?.scrollTop || 0,
  };
  const previousPoolPreviewOpen = Boolean(dom.guluBody.querySelector?.("[data-gulu-pool-preview-overlay]:not(.hidden)"));
  const previousOrdinaryScrollTop = dom.guluBody.querySelector?.(".baigushi-ordinary-fullscreen .baigushi-ordinary-scroll")?.scrollTop || 0;
  const setGuluMarkup = (markup) => {
    if (document.activeElement && dom.guluBody.contains(document.activeElement)
      && typeof document.activeElement.blur === "function") document.activeElement.blur();
    dom.guluBody.innerHTML = markup;
    restoreGuluDisclosureState(dom.guluBody, previousDisclosureState);
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
    if (guluOrdinaryMarketOpen) {
      const ordinaryScroll = dom.guluBody.querySelector?.(".baigushi-ordinary-fullscreen .baigushi-ordinary-scroll");
      if (ordinaryScroll) window.requestAnimationFrame(() => { ordinaryScroll.scrollTop = previousOrdinaryScrollTop; });
    }
    restoreGuluScroll(previousScrollTop);
  };
  dom.guluBody.classList.toggle("is-home-view", guluActiveTab === "home");
  dom.guluBody.classList.toggle("is-forge-view", guluActiveTab === "forge");
  dom.guluBody.classList.toggle("is-fusion-view", guluActiveTab === "fusion");
  dom.guluBody.classList.toggle("is-market-view", guluActiveTab === "market");
  dom.guluBody.classList.toggle("is-nurture-view", guluActiveTab === "nurture");
  dom.guluBody.classList.toggle("is-park-view", guluActiveTab === "park");
  guluRenaming = false; // 整体重渲染必然作废就地输入框——顺手清标志，防其卡 true 冻结 30s 自动刷新
  const receiptBefore = captureOutgameInventory(getGuluStore());
  const news = settleGuluTime();
  if (news.length) showOutgameReceiptFromChange(receiptBefore, getGuluStore(), { source: "蛊圃", title: "蛊卵破壳", summary: news.join("\n") });
  const s = getGuluStore();
  const now = guluNow();
  if (guluActiveTab === "profile") {
    setGuluMarkup(renderGuluTabs() + renderCultivationProfile(s));
    return;
  }
  if (guluActiveTab === "collection") {
    setGuluMarkup(renderGuluTabs() + renderGuluCollection(s));
    if (s.collectionUnread.length) { s.collectionUnread = []; saveGuluStore(); }
    if (typeof refreshCollectionHubBadges === "function") refreshCollectionHubBadges();
    return;
  }
  if (guluActiveTab === "park") {
    setGuluMarkup(renderGuluTabs()
      + (guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : "")
      + renderPark(s));
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
  const showRewardedSign = guluRewardedAdReady() && canClaimRewardedSign(s, signDateKey, signFingerprint);
  if (showRewardedSign) {
    guluTrackRewardedOffer(
      NmgAds.PLACEMENTS.DAILY_SIGN_REPEAT,
      `${signDateKey}|${signFingerprint}`,
      { scene: "gulu_daily" },
    );
  }
  const signRewardedBtn = showRewardedSign
    ? `<button type="button" class="gulu-rewarded-btn" data-gulu-rewarded-sign="1"><strong>看广告 · 日课材料再领</strong></button>`
    : "";
  const signDots = Array.from({ length: SIGN_CYCLE }, (_, k) => `<i class="gulu-sign-dot${k === SIGN_CYCLE - 1 ? " is-mile" : ""}${(!signState.signedToday && k === signState.nextIdx) ? " is-next" : ""}">${SIGN_REWARDS[k]}</i>`).join("");
  const signSection = `<section class="gulu-sec gulu-daily">
    <h3>归庐日课 <small>每日点卯得材料 · 连签 ${signState.displayStreak} 日 · 累计 ${signState.total} 日</small></h3>
    ${renderGuluRewardedAdNotice()}
    <div class="gulu-sign-row"><div class="gulu-sign-dots" title="七日循环，末日更丰">${signDots}</div>${signBtn}${signRewardedBtn}</div>
  </section>`;
  const matChips = MATERIAL_IDS.map((id) => `<span class="gulu-mat tone-${MATERIALS[id].tone || "jade"}">${renderGuluMaterialArt(MATERIALS[id])}${MATERIALS[id].name}<i>×${normalizeRedeemOwnedAmount(s.materials[id])}</i></span>`).join("")
    + `<span class="gulu-mat tone-boss">${renderGuluMaterialArt({ image: GULU_FORGE_SUPPLY_ART.bossCores, glyph: "核" })}蛊母残核<i>×${s.bossCores | 0}</i></span>`;
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
      const showRewardedHatch = guluRewardedAdReady() && canRewardedHatchInstant(s, slot.id, slot, now);
      if (showRewardedHatch) {
        guluTrackRewardedOffer(
          NmgAds.PLACEMENTS.GULU_HATCH_INSTANT,
          `${guluTodayKey()}|${slot.id}|${slot.hatchAt || 0}`,
          { scene: "gulu" },
        );
      }
      const hatchAdBtn = showRewardedHatch
        ? `<button type="button" class="gulu-rewarded-btn" data-gulu-rewarded-hatch="${escGu(slot.id)}"><strong>看广告 · 立即破壳</strong></button>`
        : "";
      const returnEgg = slot.retentionSource === FIRST_RETURN_EGG_SOURCE;
      return `<div class="gulu-slot is-egg quality-${grade.quality === "精品" ? "high" : "low"} ${returnEgg ? "is-return-egg" : ""}" data-slot-index="${i}"><h4>第 ${i + 1} 圃 · ${returnEgg ? "眠种蛊卵" : `${getGuluGradeDisplayName(slot.grade)}蛊卵`}</h4>
        ${returnEgg ? '<small class="gulu-return-promise">明日回响 · 基础虫池 · 精品炉性</small>' : ""}
        <p class="gulu-egg-glyph${soon ? " is-hatching" : ""}" data-gulu-poke="egg" title="戳一戳">${GULU_GRADE_GLYPHS[slot.grade] || "卵"}</p><p class="gulu-remain">${formatGuluRemain(slot.hatchAt - now)}破壳</p>${hatchAdBtn}</div>`;
    }
    const card = CARD_LIBRARY[slot.cardKey];
    const art = getGuluCardArt(slot.cardKey);
    const displayName = slot.customName || slot.name; // V0.9.28 命名：自定义优先
    const named = !!slot.customName;
    const combatTone = typeof getGuCombatTone === "function" ? getGuCombatTone({ ...(card || {}), fusedFrom: slot.fusedFrom }) : "support";
    const turnTag = `<b class="gulu-gu-turn-tag" title="九转鼎可继续升转">${guluTurnName(slot.upgradeLevel)}</b>`; // 转数收进标题角标（炉方全表在九转鼎页）
    const returnUnclaimed = slot.retentionSource === FIRST_RETURN_EGG_SOURCE && s.retention?.firstReturnEgg?.status === "hatched";
    return `<div class="gulu-slot is-gu tone-${combatTone} ${returnUnclaimed ? "is-return-unclaimed" : ""}" data-slot-index="${i}"><h4>第 ${i + 1} 圃 · <span class="gulu-gu-name${named ? " is-named" : ""}">${escGu(displayName)}</span>${turnTag}<small class="gulu-quality-label">${escGu(getGuluGradeDisplayName(slot.grade))}</small>${returnUnclaimed ? '<small class="gulu-return-ready">眠种归来 · 查看或随行</small>' : ""}<button type="button" class="gulu-rename-btn" data-gulu-rename="${i}" title="命名" aria-label="给这只蛊命名">题</button></h4>
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
  const altarPathStatus = legacyBenmingRun ? "当前老续局沿用旧规则" : (injured && getEffectiveBenmingStage(heroId) < 3 ? "静养降阶，路线暂失效" : (altarPathId ? `本局路线：${getBenmingPathDefinition(heroId, altarPathId)?.name}` : "新局入塔前二择一"));
  const altarPaths = BENMING_PATHS[heroId] && bi.stage >= 3 ? `<div class="benming-path-overview gulu-benming-paths ${injured && getEffectiveBenmingStage(heroId) < 3 ? "is-suppressed" : ""}">
    <p><strong>三转双路线</strong><span>${altarPathStatus}</span></p>
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
      ${BENMING_PATHS[heroId] && bi.stage >= 3 ? `<p class="gulu-altar-current-path">${escGu(altarPathStatus)}</p>` : ""}
      <details class="outgame-disclosure gulu-altar-details"><summary>身世、全阶段与路线</summary><p class="gulu-altar-lore">${heroGu.lore}</p><ul class="gulu-altar-stages">${altarStages}</ul>${altarPaths}</details>
      <details class="outgame-disclosure gulu-feed-rules"><summary>喂养规则与越级风险</summary><p>喂养压制按路线判定，与次品／精品无关：基础蛊可直接安全喂养；本命蛊二转后可安全吞食道脉蛊。越级喂养即蛊斗——胜则道行加倍，败则反噬静养。</p></details>
    </aside>` : "";
  setGuluMarkup(`
    ${renderGuluTabs()}
    ${renderGuluOverview(s)}
    ${guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : ""}
    <div class="gulu-layout">
      <div class="gulu-main outgame-scroll-region">
        ${signSection}
        <section class="gulu-sec"><h3>材料仓 <small>通关全额带出 · 陨落折四成 · 残核仅通关可带</small></h3><div class="gulu-mats">${matChips}</div></section>
        <section class="gulu-sec gulu-plots-sec"><h3>蛊圃 <small>选虫卵落圃，等待破壳</small><button type="button" class="gulu-pool-preview-open" data-gulu-pool-preview-open="1" aria-expanded="false">查看两类虫池</button></h3><details class="outgame-disclosure gulu-hatch-rules"><summary>孵化、品质与随行规则</summary><p>基础卵出常用通用蛊，道脉卵出进阶蛊与当前流派专属蛊；两类材料互不替代。每线都有次品与精品，战斗属性相同；次品省材，精品只提高四转升五转后的升转成功率。成蛊可随行（${carriedCount}/${getCarryMaxNow()}）或喂养本命蛊。</p></details><div class="gulu-slots">${slots}</div></section>
        <details class="gulu-sec outgame-disclosure gulu-events-details"><summary><strong>蛊庐动静</strong><small>最近 ${Math.min(8, s.events.length)} 条</small></summary><ul class="gulu-events">${events}</ul></details>
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
  if (tab === "park") {
    stopGuluAudio();
    window.AudioManager?.playScene?.("guluPark", { duration: 800, quiet: true });
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
  bindGuluForgeTargetTouch();
  window.NmgCardCast?.clear?.();
  const syncStore = getGuluStore();
  const previousSyncVersion = syncStore.codexSyncVersion;
  const syncResult = syncOwnedGuluDiscoveries(syncStore);
  if (syncResult.ok && (syncResult.added.length || previousSyncVersion !== syncStore.codexSyncVersion)) saveGuluStore();
  const supportedTabs = ["home", "profile", "nurture", "park", "forge", "fusion", "collection", "market"];
  guluActiveTab = supportedTabs.includes(tab) ? tab : "home";
  if (dom.guluTitle) dom.guluTitle.textContent = guluActiveTab === "market" ? "百蛊市" : "蛊庐";
  guluNoticeText = "";
  renderGulu({ preserveScroll: false });
  if (dom.guluBody) dom.guluBody.scrollTop = 0;
  dom.guluOverlay.classList.remove("hidden");
  if (guluActiveTab === "market") window.requestAnimationFrame(() => focusBaigushiDailyMarket());
  refreshModalLock();
  if (typeof syncTitleSceneLive === "function") syncTitleSceneLive();
  window.clearInterval(guluRefreshTimer);
  guluRefreshTimer = window.setInterval(() => {
    if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) { if (!guluRenaming && guluActiveTab !== "park") renderGulu(); } // 游园卡阵保持连续相位；命名中也不重渲染
    else window.clearInterval(guluRefreshTimer);
  }, 30000);
  // 当前视图决定蛊庐/炉房音轨；百蛊市入口会紧接着换到自己的市集曲目。
  syncGuluTabAudio(guluActiveTab);
  window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 });
  if (syncStore.retention?.firstReturnEgg?.status === "hatched" && typeof showCoachTip === "function") {
    showCoachTip("firstReturnEgg", "眠种新蛊已经破壳。可查看真实效果，自由选择随行、收纳或喂养；这里不再挂任何强制实战任务。", { forceToast: true, outOfRunTitle: true });
  } else {
    showGuluFirstVisitTip(guluActiveTab);
  }
  dom.guluCloseButton?.focus();
}

function focusBaigushiDailyMarket() {
  const body = dom.guluBody;
  const target = body?.querySelector?.(".baigushi-market-a");
  const scroller = getGuluScrollContainer();
  if (!scroller || !target) return false;
  const bodyRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const stickyNavHeight = body.querySelector?.(".baigushi-stall-nav")?.getBoundingClientRect?.().height || 0;
  scroller.scrollTop = Math.max(0, scroller.scrollTop + targetRect.top - bodyRect.top - stickyNavHeight - 8);
  return true;
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
  if (tab === "profile") {
    showCoachTip("firstCultivationProfile", "修行谱是已有成长的五层只读索引，不发属性、不发任务。需要追溯个体蛊从何而来、陪你走过多少战斗，请回蛊圃点它的“查看详情”。", asOutOfRun);
    return;
  }
  if (tab === "park") {
    const ticketClarity = getParkTicketClarity(getGuluStore()?.park?.tickets);
    showCoachTip("firstGuluPark", `万蛊游园是不打怪的塔外抽卡游园：${ticketClarity.daily}，${ticketClarity.cap}，${ticketClarity.cost}，${ticketClarity.available}；${ticketClarity.cadence}。广告契每日最多可补 3 帖；奇茧固定 0.5% 珍稀蛊直出，每 12 茧得 1 枚残蜕，6 枚可自选当期一只，即 72 茧硬自选。营造只改变园景，不加战力。`, asOutOfRun);
    return;
  }
  if (tab === "forge") {
    showCoachTip("firstForge", "九转鼎：选择同名同转蛊升一转。目标卡会显示本次成功率、消耗与缺料原因；完整炉则可展开查看。异蛊合练请去合蛊坛。", asOutOfRun);
    return;
  }
  if (tab === "fusion") {
    showCoachTip("firstFusion", "合蛊坛：先选一只，再选亮起的同转伙伴。产物、材料与两蛊消失警告会在确认前显示。", asOutOfRun);
    return;
  }
  if (tab === "market") {
    showCoachTip("firstMarket", "百蛊市：用蛊钱换炼蛊材料、蛊卵与奇物。先点上方摊位快速分类，商品效果点击「查看说明」展开；购买需再次确认。蛊钱由活着离塔和局内结算积攒。", asOutOfRun);
    return;
  }
  if (tab === "nurture") {
    showCoachTip("firstNurture", "养蛊室：选泉边蛊虫，用元髓露温养；圆满后提高它的入炉成功率。收纳和灵泉规则可展开查看。", asOutOfRun);
    return;
  }
  if (tab === "collection") {
    showCoachTip("firstGuluCollection", "藏册找你养过的个体；万蛊录查全部蛊种、敌怪与世界知识。点个体看详情，展开履历看养成记录。", asOutOfRun);
    return;
  }
  showCoachTip("firstGulu", "先选一条孵化线落卵；点“查看两类虫池”可确认具体产物。材料不足时再去百蛊市补齐。", asOutOfRun);
}
function openBaigushi() {
  guluMarketStall = "market";
  guluOrdinaryMarketOpen = false;
  openGulu("market");
  window.AudioManager?.playScene?.("baigushi", { duration: 800, quiet: true });
}
/* V0.9.52 九转鼎独立入口（主界面直入）：换自己的场景 BGM（炉火），不再沿用蛊庐虫鸣。 */
function openGuluForge() {
  showGuluForgeEntryHint();
  openGulu("forge");
}
function closeGulu() {
  if (typeof clearParkDrawSequence === "function") clearParkDrawSequence();
  guluRenaming = false; // 关面板即离开命名态，防标志滞留冻结下次自动刷新
  guluRedeemOpen = false;
  guluOrdinaryMarketOpen = false;
  dom.guluBody?.classList.remove("is-pool-preview-open");
  clearGuluForgeSequence();
  dom.guluForgeResultOverlay?.classList.add("hidden");
  guluForgeRitualState = null;
  if (guluForgeEntryHintTimer) window.clearTimeout(guluForgeEntryHintTimer);
  guluForgeEntryHintTimer = null;
  guluForgeEntryHintVisible = false;
  closeGuluActionConfirm();
  window.clearInterval(guluRefreshTimer);
  if (guluNoticeTimer) window.clearTimeout(guluNoticeTimer);
  guluNoticeTimer = null;
  guluNoticeScheduledText = "";
  stopGuluAudio(); // V0.9.26：虫鸣淡出 + 心跳停
  dom.guluOverlay?.classList.add("hidden");
  refreshModalLock();
  if (typeof syncTitleSceneLive === "function") syncTitleSceneLive();
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
