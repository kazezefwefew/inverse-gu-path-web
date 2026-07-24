"use strict";
/* nmg-gulu.js：V0.9.36 批次B-4，蛊庐/归庐日课/香火弹窗抽离；须在 game.v 之前加载。 */
/* ===== V0.9.22 蛊庐（批1）：局外养蛊——材料带出(通关全额/阵亡四成)、孵卵真实时间成长、成蛊两格带入塔、蛊斗喂养本命蛊。 =====
 * 独立存储 nmg.gulu（坏档不碰局内与本命蛊）；时间结算单一入口 settleGuluTime（宽容处理改时钟，单机不较真）；
 * 局外无种子通道，随机走 guluRandom（回归脚本按 return Math.random 白名单放行）。 */
const GULU_KEY = "nmg.gulu";
const GULU_COLLECTION_VERSION = 2;
const GULU_COLLECTION_BUILD = "v0.9.39";
const GULU_HATCH_TIME_VERSION = 2;
const GULU_SLOTS = 4; // 基础圃数（老档下限）
const GULU_SLOTS_MAX = 5; // 通关任意路线后再辟一圃；数组恒补到此，旧档占用圃永不被裁
const GULU_CARRY_MAX = 2;
const GULU_INJURY_MS = 8 * 3600 * 1000; // 蛊斗反噬静养 8 小时
const GULU_GRADES = Object.freeze({
  fan: { name: "凡品", rank: 1, hatchMs: 10 * 60 * 1000, mats: 2, core: 0, dao: 10, upgrade: 0, rare: false, timeText: "10 分钟" },
  ling: { name: "灵品", rank: 2, hatchMs: 1 * 3600 * 1000, mats: 5, core: 0, dao: 24, upgrade: 1, rare: false, timeText: "1 小时" },
  xuan: { name: "玄品", rank: 3, hatchMs: 4 * 3600 * 1000, mats: 9, core: 0, dao: 60, upgrade: 1, rare: true, timeText: "4 小时" },
  tian: { name: "天品", rank: 4, hatchMs: 8 * 3600 * 1000, mats: 6, core: 1, dao: 150, upgrade: 2, rare: true, timeText: "8 小时" },
});
const BAIGUSHI_WARD_MAX = 2;
const BAIGUSHI_SCRIP_RATE = 5;
const BAIGUSHI_SCRIP_RUN_CAP = 12;
const BAIGUSHI_DAILY_STOCK = 3;
const BAIGUSHI_RECIPE_SCRIP_COST = 2;
const BAIGUSHI_WARD_SCRIP_COST = 11;
const BAIGUSHI_MISC_GOODS = Object.freeze({
  featuredEgg: Object.freeze({ price: 6, dailyStock: 1 }),
  growthIncense: Object.freeze({ price: 3, dailyStock: 2 }),
  healingSalve: Object.freeze({ price: 5, dailyStock: 1 }),
  materialCrate: Object.freeze({
    price: 11,
    dailyStock: 1,
    contents: Object.freeze({ bloodSand: 1, insectMolt: 1, rotLiquid: 1, fateSilk: 1, remnantSoul: 1, boneCrystal: 1, lifeEmber: 1, yuanDew: 1 }),
  }),
  choiceMaterialCrate: Object.freeze({ price: 6, dailyStock: 1, count: 3 }),
  gradeSeal: Object.freeze({ price: 9, dailyStock: 1 }),
  marrowJade: Object.freeze({ price: 8, dailyStock: 1 }),
  daoFruit: Object.freeze({ price: 10, dailyStock: 1, dao: 60 }),
  coreCrate: Object.freeze({ price: 12, dailyStock: 1, count: 1 }),
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
const GULU_GRADE_GLYPHS = Object.freeze({ fan: "凡", ling: "灵", xuan: "玄", tian: "天" });
const GULU_GRADE_TONES = Object.freeze({ fan: "gold", ling: "jade", xuan: "tian", tian: "blood" }); // 破壳仪式分色
// V0.9.35 天品随行·蛊气加持：天品成蛊随行入塔时，按其（破卵所抽卡的）维度额外给一份小加成——回应"天品太废"（此前携带仅等于一张 +2 强化的稀有牌）。
// 仅天品(rank4)享；确定性纯加法小值（无 RNG/无除法/无循环，保种子回归与防"0血过关/卡死"）；携带至多 GULU_CARRY_MAX 只叠加。
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
    .filter((g, i) => i < getGuluSlotCap() && g && g.state === "gu" && g.carry && g.grade === "tian" && CARD_LIBRARY[g.cardKey])
    .slice(0, GULU_CARRY_MAX)
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
      cardKey, hatchedCount: 0, highestGrade: "fan", fedCount: 0, releasedCount: 0,
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
      if (typeof markGuDiscovered === "function") markGuDiscovered(cardKey);
    });
    changed = true;
  } else if (!store.collection || typeof store.collection !== "object" || Array.isArray(store.collection)) {
    store.collection = {};
    changed = true;
  }
  Object.values(store.collection || {}).forEach((entry) => {
    const releasedCount = Math.max(0, entry.releasedCount | 0);
    if (entry.releasedCount !== releasedCount) {
      entry.releasedCount = releasedCount;
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
function getGuluStore() {
  if (!__guluCache) {
    try { const raw = JSON.parse(localStorage.getItem(GULU_KEY)); __guluCache = raw && typeof raw === "object" ? raw : {}; } catch (e) { __guluCache = {}; }
  }
  const s = __guluCache;
  s.materials = s.materials && typeof s.materials === "object" ? s.materials : {};
  s.bossCores = Math.max(0, s.bossCores | 0);
  if (!Array.isArray(s.slots)) s.slots = [];
  while (s.slots.length < GULU_SLOTS_MAX) s.slots.push(null); // V0.9.35：恒补到上限，占用的第四圃永不被裁
  s.injuryUntil = Number(s.injuryUntil) || 0;
  if (!Array.isArray(s.events)) s.events = [];
  s.serial = s.serial | 0;
  s.sign = (s.sign && typeof s.sign === "object" && !Array.isArray(s.sign)) ? s.sign : {}; // V0.9.35 归庐日课：{lastDate,streak,total}
  s.market = (s.market && typeof s.market === "object" && !Array.isArray(s.market)) ? s.market : {};
  s.market.scrip = Math.max(0, s.market.scrip | 0);
  s.market.deathWard = Math.min(BAIGUSHI_WARD_MAX, Math.max(0, s.market.deathWard | 0));
  s.market.purchases = Math.max(0, s.market.purchases | 0);
  s.market.dailyStockDate = String(s.market.dailyStockDate || "");
  s.market.dailyStock = (s.market.dailyStock && typeof s.market.dailyStock === "object" && !Array.isArray(s.market.dailyStock))
    ? s.market.dailyStock : {};
  if (!Array.isArray(s.collectionUnread)) s.collectionUnread = [];
  const migratedCollection = migrateGuluCollection(s);
  const migratedHatchTimes = migrateGuluHatchTimes(s);
  if (migratedCollection || migratedHatchTimes) {
    try { safeWriteJson(GULU_KEY, JSON.stringify(s)); } catch (e) { /* 迁移写回失败不阻塞当前会话 */ }
  }
  return s;
}
function saveGuluStore() { try { safeWriteJson(GULU_KEY, JSON.stringify(getGuluStore())); } catch (e) { /* 存储不可用则忽略 */ } }
// 可用圃数——通关任意路线（eliteUnlocked，单调持久，只增不减）后由 4 辟为 5。
// 数组恒定 GULU_SLOTS_MAX 格，此处只决定"可孵卵/可用"的前 N 格；解锁单调故永不回锁遮蔽占用圃。
function getGuluSlotCap() { return (progression && progression.eliteUnlocked) ? GULU_SLOTS_MAX : GULU_SLOTS; }
// ===== V0.9.35 归庐日课（每日签到）：局外轻奖励，只发蛊庐材料（禁发战斗资源/残核/道行）；7日循环、温和不逼肝、漏签只断连签不没收既得。=====
const SIGN_CYCLE = 7;
const SIGN_REWARDS = Object.freeze([2, 2, 2, 3, 2, 2, 4]); // day1..7 发放材料份数；第7日里程碑更丰
function guluTodayKey() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; } // 本地墙钟自然日（照 isGuluNight/saveStamp）
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
    s.materials[id] = (s.materials[id] | 0) + 1;
    gained[id] = (gained[id] | 0) + 1;
  }
  const summary = Object.keys(gained).map((id) => `${MATERIALS[id].name}×${gained[id]}`).join("、");
  const milestone = st.nextIdx === SIGN_CYCLE - 1;
  guluPushEvent(s, `归庐日课·连签第 ${sign.streak} 日：得 ${summary}。`);
  saveGuluStore();
  return { ok: true, text: `点卯得 ${summary}（连签 ${sign.streak} 日）。`, milestone, summary, streak: sign.streak };
}
function guluMatTotal(store) { return MATERIAL_IDS.reduce((n, id) => n + (store.materials[id] | 0), 0); }
function formatBaigushiCost(cost) {
  return Object.entries(cost).map(([id, count]) => `${MATERIALS[id]?.name || id}×${count}`).join("、");
}
function canPayBaigushiMaterials(store, cost) {
  return Object.entries(cost).every(([id, count]) => (store.materials[id] | 0) >= count);
}
function payBaigushiMaterials(store, cost) {
  Object.entries(cost).forEach(([id, count]) => { store.materials[id] = Math.max(0, (store.materials[id] | 0) - count); });
}
function settleMarketScripFromRun(store, guStones, outcome) {
  const living = outcome === "cleared" || outcome === "withdrawn";
  const available = Math.max(0, guStones | 0);
  const uncapped = living ? Math.floor(available / BAIGUSHI_SCRIP_RATE) : 0;
  const gained = Math.min(BAIGUSHI_SCRIP_RUN_CAP, uncapped);
  if (!store.market || typeof store.market !== "object") store.market = {};
  store.market.scrip = Math.max(0, store.market.scrip | 0) + gained;
  return {
    gained,
    spentStones: gained * BAIGUSHI_SCRIP_RATE,
    capped: living && uncapped > gained,
  };
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
function canBuyBaigushiDailyGood(store, goodId, dateKey) {
  const good = BAIGUSHI_MISC_GOODS[goodId];
  const daily = getBaigushiDailyGoods(store, dateKey);
  if (!good || (daily.stock?.[goodId] | 0) <= 0) return { ok: false, good, daily, text: "此物今日已售罄。" };
  if ((store.market.scrip | 0) < good.price) return { ok: false, good, daily, text: `市契不足：需要 ${good.price} 枚。` };
  return { ok: true, good, daily };
}
function settleBaigushiDailyGood(store, goodId, purchase) {
  purchase.daily.stock[goodId] -= 1;
  store.market.scrip -= purchase.good.price;
  store.market.purchases += 1;
}
function buyBaigushiGrowthIncense(eggId, dateKey = guluTodayKey(), now = guluNow()) {
  const store = getGuluStore();
  const slot = store.slots.find((entry, index) => index < getGuluSlotCap() && entry?.id === eggId && entry.state === "egg");
  const remaining = slot ? Math.max(0, (Number(slot.hatchAt) || 0) - now) : 0;
  if (!slot || remaining <= 0) return { ok: false, text: "没有可催生的蛊卵。" };
  const purchase = canBuyBaigushiDailyGood(store, "growthIncense", dateKey);
  if (!purchase.ok) return purchase;
  const shortened = Math.ceil(remaining * 0.75);
  slot.hatchAt = now + shortened;
  settleBaigushiDailyGood(store, "growthIncense", purchase);
  guluPushEvent(store, `百蛊市催生香用于${slot.name || "蛊卵"}：剩余破壳时间缩短 25%。`);
  saveGuluStore();
  return { ok: true, remaining: shortened, text: `催生香已燃，剩余破壳时间缩短 25%，余市契 ${store.market.scrip}。` };
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
  return { ok: true, text: `养伤散已服，本命蛊可再次蛊斗，余市契 ${store.market.scrip}。` };
}
function buyBaigushiMaterialCrate(dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const purchase = canBuyBaigushiDailyGood(store, "materialCrate", dateKey);
  if (!purchase.ok) return purchase;
  Object.entries(purchase.good.contents).forEach(([id, count]) => {
    store.materials[id] = (store.materials[id] | 0) + count;
  });
  settleBaigushiDailyGood(store, "materialCrate", purchase);
  guluPushEvent(store, `百蛊市购得炉材匣：${formatBaigushiCost(purchase.good.contents)}。`);
  saveGuluStore();
  return { ok: true, text: `炉材匣已开：${formatBaigushiCost(purchase.good.contents)}，余市契 ${store.market.scrip}。` };
}

function buyBaigushiChoiceMaterials(materialId, dateKey = guluTodayKey()) {
  const store = getGuluStore();
  if (!MATERIALS[materialId]) return { ok: false, text: "此物不可装入选材匣。" };
  const purchase = canBuyBaigushiDailyGood(store, "choiceMaterialCrate", dateKey);
  if (!purchase.ok) return purchase;
  store.materials[materialId] = (store.materials[materialId] | 0) + purchase.good.count;
  settleBaigushiDailyGood(store, "choiceMaterialCrate", purchase);
  guluPushEvent(store, `百蛊市五行选材匣开启：${MATERIALS[materialId].name}×${purchase.good.count}。`);
  saveGuluStore();
  return { ok: true, materialId, text: `取出${MATERIALS[materialId].name}×${purchase.good.count}，余市契 ${store.market.scrip}。` };
}

function getNextGuluGrade(gradeId) {
  const order = ["fan", "ling", "xuan", "tian"];
  const index = order.indexOf(gradeId);
  return index >= 0 && index < order.length - 1 ? order[index + 1] : "";
}

function buyBaigushiGradeSeal(eggId, dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const slot = store.slots.find((entry, index) => index < getGuluSlotCap() && entry?.id === eggId && entry.state === "egg");
  const nextGrade = slot ? getNextGuluGrade(slot.grade) : "";
  if (!slot) return { ok: false, text: "没有找到可凝阶的蛊卵。" };
  if (!nextGrade) return { ok: false, text: "这枚蛊卵已是天品，无法继续凝阶。" };
  const purchase = canBuyBaigushiDailyGood(store, "gradeSeal", dateKey);
  if (!purchase.ok) return purchase;
  const beforeName = GULU_GRADES[slot.grade]?.name || slot.grade;
  slot.grade = nextGrade;
  settleBaigushiDailyGood(store, "gradeSeal", purchase);
  guluPushEvent(store, `凝阶符落印：${beforeName}蛊卵升为${GULU_GRADES[nextGrade].name}。`);
  saveGuluStore();
  return { ok: true, eggId, grade: nextGrade, text: `凝阶完成：蛊卵已升为${GULU_GRADES[nextGrade].name}，余市契 ${store.market.scrip}。` };
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
  const replacement = getBaigushiMarrowReplacement(slot.cardKey);
  if (!replacement || replacement === slot.cardKey) return { ok: false, text: "市册中没有可替换的通用蛊。" };
  const purchase = canBuyBaigushiDailyGood(store, "marrowJade", dateKey);
  if (!purchase.ok) return purchase;
  const oldName = slot.name || CARD_LIBRARY[slot.cardKey]?.name || "旧蛊";
  slot.state = "egg";
  slot.fixedCardKey = replacement;
  slot.startedAt = now;
  slot.hatchAt = now + BAIGUSHI_HATCH_MS;
  slot.carry = false;
  delete slot.cardKey;
  delete slot.name;
  settleBaigushiDailyGood(store, "marrowJade", purchase);
  guluPushEvent(store, `换髓玉重结「${oldName}」：保留品阶，10 分钟后育成${CARD_LIBRARY[replacement]?.name || "另一通用蛊"}。`);
  saveGuluStore();
  return { ok: true, guId, cardKey: replacement, text: `换髓完成：保留品阶重新结卵，余市契 ${store.market.scrip}。` };
}

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
  return { ok: true, heroId, text: `${BENMING_GU[heroId].name}道行 +${purchase.good.dao}，余市契 ${store.market.scrip}。` };
}

function buyBaigushiCoreCrate(dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const purchase = canBuyBaigushiDailyGood(store, "coreCrate", dateKey);
  if (!purchase.ok) return purchase;
  store.bossCores = (store.bossCores | 0) + purchase.good.count;
  settleBaigushiDailyGood(store, "coreCrate", purchase);
  guluPushEvent(store, `蛊母残核匣开启：蛊母残核×${purchase.good.count}。`);
  saveGuluStore();
  return { ok: true, text: `获得蛊母残核×${purchase.good.count}，余市契 ${store.market.scrip}。` };
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
  guluPushEvent(store, `百蛊市轮换落卵：第 ${slotIndex + 1} 圃将育成「灵品·${cardName}」。`);
  saveGuluStore();
  return { ok: true, slotIndex, cardKey, text: `轮换蛊卵已落入第 ${slotIndex + 1} 圃：10 分钟后育成「灵品·${cardName}」。` };
}
function buyBaigushiMaterial(materialId, dateKey = guluTodayKey()) {
  const store = getGuluStore();
  const price = BAIGUSHI_MATERIAL_PRICES[materialId];
  if (!price || !MATERIALS[materialId]) return { ok: false, text: "此物不在今日市册中。" };
  const stock = getBaigushiDailyStock(store, dateKey);
  if ((stock[materialId] | 0) <= 0) return { ok: false, text: `${MATERIALS[materialId].name}今日已售罄。` };
  if ((store.market.scrip | 0) < price) return { ok: false, text: `市契不足：需要 ${price} 枚。` };
  store.market.scrip -= price;
  stock[materialId] -= 1;
  store.materials[materialId] = (store.materials[materialId] | 0) + 1;
  store.market.purchases += 1;
  guluPushEvent(store, `百蛊市购得${MATERIALS[materialId].name}×1，耗市契 ${price}。`);
  saveGuluStore();
  return { ok: true, materialId, price, text: `购得${MATERIALS[materialId].name}×1，余市契 ${store.market.scrip}。` };
}
function buyBaigushiRecipe(recipeId) {
  const store = getGuluStore();
  const recipe = BAIGUSHI_RECIPES[recipeId];
  if (!recipe) return { ok: false, text: "此育蛊方并不存在。" };
  const slotIndex = store.slots.findIndex((slot, i) => i < getGuluSlotCap() && !slot);
  if (slotIndex < 0) return { ok: false, text: "蛊圃已满，请先空出一圃。" };
  if (!canPayBaigushiMaterials(store, recipe.cost)) return { ok: false, text: `材料不足：需 ${formatBaigushiCost(recipe.cost)}。` };
  if ((store.market.scrip | 0) < BAIGUSHI_RECIPE_SCRIP_COST) return { ok: false, text: `市契不足：定向育蛊另需 ${BAIGUSHI_RECIPE_SCRIP_COST} 枚。` };
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
  guluPushEvent(store, `百蛊市定向落卵：第 ${slotIndex + 1} 圃将育成「灵品·${cardName}」（10 分钟破壳）。`);
  saveGuluStore();
  return { ok: true, slotIndex, cardKey: recipe.cardKey, text: `已落卵第 ${slotIndex + 1} 圃：10 分钟后必定育成「灵品·${cardName}」。` };
}
function buyBaigushiDeathWard() {
  const store = getGuluStore();
  if ((store.market.deathWard | 0) >= BAIGUSHI_WARD_MAX) return { ok: false, text: `护命蛊匣已备妥，库存上限为 ${BAIGUSHI_WARD_MAX}。` };
  if ((store.bossCores | 0) < BAIGUSHI_WARD_COST.bossCores || !canPayBaigushiMaterials(store, BAIGUSHI_WARD_COST.materials)) {
    return { ok: false, text: `所需：${formatBaigushiCost(BAIGUSHI_WARD_COST.materials)}、蛊母残核×${BAIGUSHI_WARD_COST.bossCores}。` };
  }
  if ((store.market.scrip | 0) < BAIGUSHI_WARD_SCRIP_COST) return { ok: false, text: `市契不足：护命蛊匣另需 ${BAIGUSHI_WARD_SCRIP_COST} 枚。` };
  payBaigushiMaterials(store, BAIGUSHI_WARD_COST.materials);
  store.bossCores -= BAIGUSHI_WARD_COST.bossCores;
  store.market.scrip -= BAIGUSHI_WARD_SCRIP_COST;
  store.market.deathWard += 1;
  store.market.purchases += 1;
  guluPushEvent(store, "百蛊市购得护命蛊匣：下次陨落时可自动保全一只天品随行蛊。");
  saveGuluStore();
  return { ok: true, text: "护命蛊匣已入库：只在陨落且有天品随行蛊时自动消耗。" };
}
function settleCarriedGuAfterRun(store, carriedGuIds, keepCarriedGu) {
  const ids = Array.isArray(carriedGuIds) ? carriedGuIds : [];
  const result = { fallen: [], preserved: [], wardConsumed: false };
  if (!ids.length) return result;
  if (keepCarriedGu) {
    result.preserved = store.slots.filter((slot) => slot && ids.includes(slot.id)).map((slot) => slot.name);
    return result;
  }
  const wardIndex = (store.market?.deathWard | 0) > 0
    ? store.slots.findIndex((slot) => slot && ids.includes(slot.id) && slot.state === "gu" && slot.grade === "tian")
    : -1;
  if (wardIndex >= 0) {
    result.wardConsumed = true;
    result.preserved.push(store.slots[wardIndex].name);
    store.market.deathWard -= 1;
  }
  store.slots.forEach((slot, i) => {
    if (!slot || !ids.includes(slot.id) || i === wardIndex) return;
    result.fallen.push(slot.name);
    store.slots[i] = null;
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
  if (typeof markGuDiscovered === "function") markGuDiscovered(slot.cardKey);
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
function settleGuluTime() {
  const s = getGuluStore();
  const now = guluNow();
  const news = [];
  const hatchedNow = [];
  s.slots.forEach((slot, i) => {
    if (slot && slot.state === "egg" && now >= slot.hatchAt) {
      const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
      const pool = grade.rare ? ADVANCED_CARD_KEYS : STANDARD_REWARD_CARD_KEYS;
      const key = (slot.fixedCardKey && CARD_LIBRARY[slot.fixedCardKey])
        ? slot.fixedCardKey
        : (pool[Math.floor(guluRandom() * pool.length)] || "moonBlade");
      slot.state = "gu";
      slot.cardKey = key;
      slot.upgradeLevel = grade.upgrade;
      slot.name = `${grade.name}·${CARD_LIBRARY[key]?.name || key}`;
      markGuDiscovered(key); // 破卵即入万蛊录
      recordGuluHatch(s, slot);
      news.push(`蛊圃第 ${i + 1} 栏破卵：「${slot.name}」成蛊。`);
      hatchedNow.push(slot);
    }
  });
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
function guluStartHatch(slotIndex, gradeId) {
  const s = getGuluStore();
  const grade = GULU_GRADES[gradeId];
  if (slotIndex >= getGuluSlotCap()) return { ok: false, text: "第五圃尚未辟开（通关任意路线后解锁）。" };
  if (!grade || s.slots[slotIndex]) return { ok: false, text: "此栏已有蛊。" };
  if (guluMatTotal(s) < grade.mats) return { ok: false, text: `材料不足（需 ${grade.mats} 份）。` };
  if ((s.bossCores | 0) < grade.core) return { ok: false, text: "缺蛊母残核（Boss 战利，须活着带出塔）。" };
  let need = grade.mats;
  MATERIAL_IDS.slice().sort((a, b) => (s.materials[b] | 0) - (s.materials[a] | 0)).forEach((id) => {
    while (need > 0 && (s.materials[id] | 0) > 0) { s.materials[id] -= 1; need -= 1; }
  });
  s.bossCores -= grade.core;
  s.serial += 1;
  s.slots[slotIndex] = { id: `gu${s.serial}`, state: "egg", grade: gradeId, startedAt: guluNow(), hatchAt: guluNow() + grade.hatchMs, carry: false };
  guluPushEvent(s, `蛊圃第 ${slotIndex + 1} 栏落卵：${grade.name}蛊卵入土（${grade.timeText}破壳）。`);
  saveGuluStore();
  return { ok: true, text: `${grade.name}蛊卵已入土，${grade.timeText}后破壳。` };
}
function guluToggleCarry(slotIndex) {
  const s = getGuluStore();
  const slot = s.slots[slotIndex];
  if (!slot || slot.state !== "gu") return { ok: false, text: "此栏无成蛊。" };
  if (!slot.carry && s.slots.filter((g) => g && g.state === "gu" && g.carry).length >= GULU_CARRY_MAX) {
    return { ok: false, text: `入塔携带至多 ${GULU_CARRY_MAX} 只。` };
  }
  slot.carry = !slot.carry;
  saveGuluStore();
  return { ok: true, text: slot.carry ? `「${slot.name}」已入行囊，下局随行入塔。` : `「${slot.name}」已归圃。` };
}
function getGuluRunningRun() {
  if (typeof runState !== "undefined" && runState?.status === "running") return runState;
  if (typeof loadRunAutosave === "function") {
    const payload = loadRunAutosave();
    if (payload?.run?.status === "running") return payload.run;
  }
  return null;
}
function getGuluDisplayName(slot) {
  return slot?.customName || slot?.name || CARD_LIBRARY[slot?.cardKey]?.name || "此蛊";
}
function isGuluCarriedInRun(slot, activeRun) {
  return !!(slot?.id && activeRun?.status === "running" && Array.isArray(activeRun.carriedGuIds) && activeRun.carriedGuIds.includes(slot.id));
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
  const isTian = slot.grade === "tian";
  const warnedName = isTian && !displayName.startsWith("天品·") ? `天品·${displayName}` : displayName;
  return {
    ok: true,
    kind: "release",
    slotId: slot.id,
    slotIndex,
    isTian,
    title: isTian ? "遣归天品蛊？" : "遣蛊归野",
    text: isTian
      ? `即将遣归「${warnedName}」。其随行加持、孵化材料与蛊母残核均不会返还，此操作不能撤销。`
      : `确定遣归「${displayName}」？此蛊将永久离开蛊庐，不能找回，也不会返还孵化材料。`,
    cancelLabel: "暂且留下",
    confirmLabel: isTian ? "确认遣归天品" : "确认遣归",
  };
}
function guluReleaseToWild(slotIndex, activeRun = getGuluRunningRun()) {
  const preview = getGuluReleasePreview(slotIndex, activeRun);
  if (!preview.ok) return preview;
  const s = getGuluStore();
  const slot = s.slots[slotIndex];
  if (!slot || slot.state !== "gu" || slot.id !== preview.slotId) return { ok: false, text: "此蛊圃状态已改变，请重新确认。" };
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
  if (s.injuryUntil && guluNow() < s.injuryUntil) return { ok: false, text: "本命蛊仍在静养，不可进食。" };
  const heroId = progression.selectedHeroId;
  const gu = BENMING_GU[heroId];
  if (!gu) return { ok: false, text: "无本命蛊。" };
  const stage = getBenmingStage(heroId);
  const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
  const over = grade.rank - (stage + 1);
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
  const heroId = progression.selectedHeroId;
  const gu = BENMING_GU[heroId];
  const grade = GULU_GRADES[slot.grade] || GULU_GRADES.fan;
  const over = preview.over; // 压制线：蛊卵≤凡/幼虫≤灵/成虫≤玄/真形≤天
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
let guluActiveTab = "home";
let guluMarketStall = "insects";
let guluCollectionFilter = "all";
let guluPendingAction = null;
function isGuluActionConfirmOpen() {
  return !!(dom.guluActionConfirm && !dom.guluActionConfirm.classList.contains("hidden"));
}
function closeGuluActionConfirm() {
  guluPendingAction = null;
  dom.guluActionConfirm?.classList.add("hidden");
  dom.guluActionConfirm?.classList.remove("is-tian", "is-feed-risk");
}
function openGuluActionConfirm(kind, slotIndex) {
  const preview = kind === "release" ? getGuluReleasePreview(slotIndex) : getGuluFeedPreview(slotIndex);
  if (!preview.ok) {
    guluNoticeText = preview.text;
    renderGulu();
    return preview;
  }
  if (!dom.guluActionConfirm) return { ok: false, text: "确认层暂不可用。" };
  guluPendingAction = { kind, slotIndex, slotId: preview.slotId };
  dom.guluActionConfirmTitle.textContent = preview.title;
  dom.guluActionConfirmText.textContent = preview.text;
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
  const slot = getGuluStore().slots[pending.slotIndex];
  if (!slot || slot.state !== "gu" || slot.id !== pending.slotId) {
    closeGuluActionConfirm();
    return { ok: false, action: pending.kind, text: "此蛊圃状态已改变，请重新确认。" };
  }
  const result = pending.kind === "release"
    ? guluReleaseToWild(pending.slotIndex)
    : guluFeedToBenming(pending.slotIndex);
  closeGuluActionConfirm();
  return { ...result, action: pending.kind };
}
function renderGuluTabs() {
  return `<nav class="gulu-tabs" aria-label="蛊庐页签">
    <button type="button" class="gulu-tab${guluActiveTab === "home" ? " is-active" : ""}" data-gulu-tab="home">蛊圃</button>
    <button type="button" class="gulu-tab${guluActiveTab === "collection" ? " is-active" : ""}" data-gulu-tab="collection">藏册</button>
  </nav>`;
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
    <div><span>随行</span><strong>${carried}/${GULU_CARRY_MAX}</strong><small>带入命途</small></div>
  </section>`;
}
function renderBaigushi(store) {
  const dailyStock = getBaigushiDailyStock(store);
  const dailyGoods = getBaigushiDailyGoods(store);
  const now = guluNow();
  const resources = MATERIAL_IDS.map((id) => `<span class="gulu-mat tone-${MATERIALS[id].tone || "jade"}"><b>${MATERIALS[id].glyph}</b>${MATERIALS[id].name}<i>×${store.materials[id] | 0}</i></span>`).join("")
    + `<span class="gulu-mat tone-boss"><b>核</b>蛊母残核<i>×${store.bossCores | 0}</i></span>`;
  const materialShelf = MATERIAL_IDS.map((id) => {
    const price = BAIGUSHI_MATERIAL_PRICES[id];
    const left = dailyStock[id] | 0;
    const affordable = (store.market.scrip | 0) >= price;
    return `<article class="baigushi-material tone-${MATERIALS[id].tone || "jade"}">
      <span aria-hidden="true">${MATERIALS[id].glyph}</span>
      <div><strong>${MATERIALS[id].name}</strong><small>今日余 ${left}/3</small></div>
      <button type="button" data-baigushi-material="${id}" ${left > 0 && affordable ? "" : "disabled"}>${left <= 0 ? "售罄" : (affordable ? `${price} 市契` : "市契不足")}</button>
    </article>`;
  }).join("");
  const recipes = Object.entries(BAIGUSHI_RECIPES).map(([id, recipe]) => {
    const card = CARD_LIBRARY[recipe.cardKey];
    const canAfford = canPayBaigushiMaterials(store, recipe.cost) && (store.market.scrip | 0) >= BAIGUSHI_RECIPE_SCRIP_COST;
    const hasPlot = store.slots.some((slot, i) => i < getGuluSlotCap() && !slot);
    return `<article class="baigushi-recipe tone-${recipe.tone}">
      <span class="baigushi-glyph" aria-hidden="true">${recipe.glyph}</span>
      <div><h4>${recipe.name}</h4><strong>灵品·${card?.name || recipe.cardKey}</strong>
      <p>${card ? stripTags(getCardEffect(recipe.cardKey, 1)) : "蛊性未明"}</p>
      <small>${formatBaigushiCost(recipe.cost)} · 市契 ${BAIGUSHI_RECIPE_SCRIP_COST} · 10 分钟定向破壳</small></div>
      <button type="button" data-baigushi-recipe="${id}" ${canAfford && hasPlot ? "" : "disabled"}>${hasPlot ? (canAfford ? "落卵此方" : "材料不足") : "蛊圃已满"}</button>
    </article>`;
  }).join("");
  const wardCount = store.market.deathWard | 0;
  const wardAffordable = canPayBaigushiMaterials(store, BAIGUSHI_WARD_COST.materials)
    && (store.bossCores | 0) >= BAIGUSHI_WARD_COST.bossCores
    && (store.market.scrip | 0) >= BAIGUSHI_WARD_SCRIP_COST;
  const featuredCard = CARD_LIBRARY[dailyGoods.featuredCardKey];
  const featuredGood = BAIGUSHI_MISC_GOODS.featuredEgg;
  const featuredLeft = dailyGoods.stock.featuredEgg | 0;
  const hasPlot = store.slots.some((slot, index) => index < getGuluSlotCap() && !slot);
  const featuredEgg = `<article class="baigushi-featured">
    <span class="baigushi-glyph" aria-hidden="true">${featuredCard?.glyph || "卵"}</span>
    <div><h4>今日轮换蛊卵</h4><strong>灵品·${featuredCard?.name || "待定蛊虫"}</strong>
    <p>${featuredCard ? stripTags(getCardEffect(dailyGoods.featuredCardKey, 1)) : "市册正在重排。"}</p>
    <small>10 分钟定向破壳 · 今日余 ${featuredLeft}/1 · 市契 ${featuredGood.price}</small></div>
    <button type="button" data-baigushi-featured-egg="1" ${featuredLeft > 0 && hasPlot && (store.market.scrip | 0) >= featuredGood.price ? "" : "disabled"}>${featuredLeft <= 0 ? "今日售罄" : (!hasPlot ? "蛊圃已满" : ((store.market.scrip | 0) >= featuredGood.price ? "购入轮换卵" : "市契不足"))}</button>
  </article>`;
  const insectStall = `<section class="baigushi-stall-panel" data-market-panel="insects">
    <h3>灵虫铺 <small>轮换蛊卵与五份定向明方</small></h3>
    ${featuredEgg}
    <div class="baigushi-grid">${recipes}</div>
  </section>`;
  const materialStall = `<section class="baigushi-stall-panel" data-market-panel="materials">
    <h3>炉材摊 <small>每日每种限购 3 份 · 本地零时补货</small></h3>
    <div class="baigushi-material-shelf">${materialShelf}</div>
  </section>`;
  const incenseGood = BAIGUSHI_MISC_GOODS.growthIncense;
  const incenseLeft = dailyGoods.stock.growthIncense | 0;
  const eggs = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "egg" && (Number(slot.hatchAt) || 0) > now);
  const incenseTargets = eggs.length
    ? eggs.map(({ slot, index }) => `<button type="button" data-baigushi-incense-target="${escGu(slot.id)}" ${incenseLeft > 0 && (store.market.scrip | 0) >= incenseGood.price ? "" : "disabled"}>用于第 ${index + 1} 圃</button>`).join("")
    : '<button type="button" disabled>暂无蛊卵</button>';
  const salveGood = BAIGUSHI_MISC_GOODS.healingSalve;
  const salveLeft = dailyGoods.stock.healingSalve | 0;
  const crateGood = BAIGUSHI_MISC_GOODS.materialCrate;
  const crateLeft = dailyGoods.stock.materialCrate | 0;
  const choiceGood = BAIGUSHI_MISC_GOODS.choiceMaterialCrate;
  const choiceLeft = dailyGoods.stock.choiceMaterialCrate | 0;
  const choiceTargets = MATERIAL_IDS.map((id) => `<button type="button" data-baigushi-choice-material="${id}" ${choiceLeft > 0 && (store.market.scrip | 0) >= choiceGood.price ? "" : "disabled"}>${MATERIALS[id].glyph}·${MATERIALS[id].name}</button>`).join("");
  const gradeGood = BAIGUSHI_MISC_GOODS.gradeSeal;
  const gradeLeft = dailyGoods.stock.gradeSeal | 0;
  const gradeTargets = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "egg" && getNextGuluGrade(slot.grade))
    .map(({ slot, index }) => `<button type="button" data-baigushi-grade-egg="${escGu(slot.id)}" ${gradeLeft > 0 && (store.market.scrip | 0) >= gradeGood.price ? "" : "disabled"}>第 ${index + 1} 圃升阶</button>`).join("") || '<button type="button" disabled>暂无可升阶蛊卵</button>';
  const marrowGood = BAIGUSHI_MISC_GOODS.marrowJade;
  const marrowLeft = dailyGoods.stock.marrowJade | 0;
  const marrowTargets = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => index < getGuluSlotCap() && slot?.state === "gu" && getBaigushiMarrowReplacement(slot.cardKey))
    .map(({ slot, index }) => `<button type="button" data-baigushi-marrow-gu="${escGu(slot.id)}" ${marrowLeft > 0 && (store.market.scrip | 0) >= marrowGood.price ? "" : "disabled"}>重结第 ${index + 1} 圃</button>`).join("") || '<button type="button" disabled>暂无可换髓成蛊</button>';
  const daoGood = BAIGUSHI_MISC_GOODS.daoFruit;
  const daoLeft = dailyGoods.stock.daoFruit | 0;
  const coreGood = BAIGUSHI_MISC_GOODS.coreCrate;
  const coreLeft = dailyGoods.stock.coreCrate | 0;
  const selectedBenming = BENMING_GU[progression?.selectedHeroId];
  const curiosStall = `<section class="baigushi-stall-panel" data-market-panel="curios">
    <h3>奇物行 <small>市契只由活着闯关所得 · 每日限量</small></h3>
    <div class="baigushi-curio-grid">
      <article class="baigushi-curio"><span>香</span><div><h4>催生香</h4><p>令指定蛊卵当前剩余破壳时间减少 25%。</p><small>今日余 ${incenseLeft}/2 · 市契 ${incenseGood.price}</small></div><div class="baigushi-curio-actions">${incenseTargets}</div></article>
      <article class="baigushi-curio"><span>散</span><div><h4>养伤散</h4><p>立即解除本命蛊的静养状态。</p><small>今日余 ${salveLeft}/1 · 市契 ${salveGood.price}</small></div><button type="button" data-baigushi-healing-salve="1" ${salveLeft > 0 && store.injuryUntil > now && (store.market.scrip | 0) >= salveGood.price ? "" : "disabled"}>${store.injuryUntil > now ? (salveLeft > 0 ? ((store.market.scrip | 0) >= salveGood.price ? "立即养伤" : "市契不足") : "今日售罄") : "无需静养"}</button></article>
      <article class="baigushi-curio"><span>匣</span><div><h4>炉材匣</h4><p>${formatBaigushiCost(crateGood.contents)}。</p><small>今日余 ${crateLeft}/1 · 市契 ${crateGood.price}</small></div><button type="button" data-baigushi-material-crate="1" ${crateLeft > 0 && (store.market.scrip | 0) >= crateGood.price ? "" : "disabled"}>${crateLeft <= 0 ? "今日售罄" : ((store.market.scrip | 0) >= crateGood.price ? "购入炉材匣" : "市契不足")}</button></article>
      <article class="baigushi-curio"><span>选</span><div><h4>五行选材匣</h4><p>自选一种炼蛊材料，一次获得 3 份。</p><small>今日余 ${choiceLeft}/1 · 市契 ${choiceGood.price}</small></div><div class="baigushi-curio-actions">${choiceTargets}</div></article>
      <article class="baigushi-curio"><span>阶</span><div><h4>凝阶符</h4><p>指定未破壳蛊卵提升一个品阶，天品不可再升。</p><small>今日余 ${gradeLeft}/1 · 市契 ${gradeGood.price}</small></div><div class="baigushi-curio-actions">${gradeTargets}</div></article>
      <article class="baigushi-curio"><span>髓</span><div><h4>换髓玉</h4><p>指定成蛊保留品阶重新结卵，换成另一只通用蛊。</p><small>今日余 ${marrowLeft}/1 · 市契 ${marrowGood.price}</small></div><div class="baigushi-curio-actions">${marrowTargets}</div></article>
      <article class="baigushi-curio"><span>道</span><div><h4>本命道果</h4><p>${selectedBenming?.name || "当前本命蛊"}吞服后，道行立即 +${daoGood.dao}。</p><small>今日余 ${daoLeft}/1 · 市契 ${daoGood.price}</small></div><button type="button" data-baigushi-dao-fruit="1" ${daoLeft > 0 && selectedBenming && (store.market.scrip | 0) >= daoGood.price ? "" : "disabled"}>${daoLeft <= 0 ? "今日售罄" : ((store.market.scrip | 0) >= daoGood.price ? "吞服道果" : "市契不足")}</button></article>
      <article class="baigushi-curio"><span>核</span><div><h4>蛊母残核匣</h4><p>开启后获得蛊母残核 1 枚，可用于炼制护命蛊匣。</p><small>今日余 ${coreLeft}/1 · 市契 ${coreGood.price}</small></div><button type="button" data-baigushi-core-crate="1" ${coreLeft > 0 && (store.market.scrip | 0) >= coreGood.price ? "" : "disabled"}>${coreLeft <= 0 ? "今日售罄" : ((store.market.scrip | 0) >= coreGood.price ? "购入残核" : "市契不足")}</button></article>
    </div>
  </section>`;
  const wardStall = `<section class="baigushi-stall-panel" data-market-panel="ward">
    <h3>护命柜 <small>保全稀有随行蛊，不提供永久数值成长</small></h3>
    <section class="baigushi-ward ${wardCount ? "is-owned" : ""}">
      <span class="baigushi-glyph" aria-hidden="true">匣</span>
      <div><h4>护命蛊匣 <em>${wardCount}/${BAIGUSHI_WARD_MAX}</em></h4>
      <p>下次真实陨落时，若有天品蛊随行，自动保全其中一只；没有天品时绝不浪费。</p>
      <small>${formatBaigushiCost(BAIGUSHI_WARD_COST.materials)}、蛊母残核×${BAIGUSHI_WARD_COST.bossCores}、市契 ${BAIGUSHI_WARD_SCRIP_COST}</small></div>
      <button type="button" data-baigushi-ward="1" ${wardCount < BAIGUSHI_WARD_MAX && wardAffordable ? "" : "disabled"}>${wardCount >= BAIGUSHI_WARD_MAX ? "已达上限" : (wardAffordable ? "换取蛊匣" : "资材不足")}</button>
    </section>
  </section>`;
  const stallPanels = { insects: insectStall, materials: materialStall, curios: curiosStall, ward: wardStall };
  if (!stallPanels[guluMarketStall]) guluMarketStall = "insects";
  const stallNav = [["insects", "灵虫铺"], ["materials", "炉材摊"], ["curios", "奇物行"], ["ward", "护命柜"]]
    .map(([id, label]) => `<button type="button" class="${guluMarketStall === id ? "is-active" : ""}" data-baigushi-stall="${id}" aria-pressed="${guluMarketStall === id}">${label}</button>`).join("");
  return `<section class="baigushi-shell">
    <header class="baigushi-header"><div><small>塔外夜市 · 明价易物</small><h3>百蛊市</h3><p>市契只在塔外流通。活着离塔时，每余 5 蛊石可换 1 市契，每局至多换 12 枚。</p></div><span aria-hidden="true">市</span></header>
    <section class="gulu-sec"><h3>市契与资材 <small>市契 ${store.market.scrip | 0} · 不可带入命途</small></h3><div class="gulu-mats">${resources}</div></section>
    <nav class="baigushi-stall-nav" aria-label="百蛊市摊位">${stallNav}</nav>
    ${stallPanels[guluMarketStall]}
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
    return `<button type="button" class="gulu-collection-item grade-${entry.highestGrade}" data-gulu-codex="${escGu(entry.cardKey)}">
      <span class="gulu-collection-art">${art ? `<img src="${art}" alt="" loading="lazy" decoding="async">` : `<i>${escGu(card?.glyph || "蛊")}</i>`}</span>
      <span class="gulu-collection-copy"><strong>${escGu(card?.name || entry.cardKey)}</strong><small>最高 ${grade.name} · 累计孵化 ${entry.hatchedCount | 0}</small>
      <small>在庐 ${counts.inGulu} · 随行 ${counts.carried} · 已投喂 ${entry.fedCount | 0} · 已归野 ${entry.releasedCount | 0}</small>
      <em>${entry.legacyBackfill ? "旧档现存蛊已安全补录 · 自本版起收录" : `首次收录 ${new Date(entry.firstRecordedAt || 0).toLocaleDateString()} · ${entry.firstRecordedVersion || GULU_COLLECTION_BUILD}`}</em></span>
    </button>`;
  }).join("");
  return `<section class="gulu-collection"><header><div><h3>蛊庐藏册</h3><p>只记亲手孵化与养成；蛊虫来历、战斗效果仍查万蛊录。</p></div><span>已收录 ${entries.length}</span></header>
    <div class="gulu-collection-filters">${filters}</div>
    <div class="gulu-collection-grid">${cards || '<div class="gulu-collection-empty"><b>藏册尚空</b><span>蛊卵破壳后会在此留下第一笔记录。</span></div>'}</div>
  </section>`;
}
function renderGulu() {
  if (!dom.guluBody) return;
  guluRenaming = false; // 整体重渲染必然作废就地输入框——顺手清标志，防其卡 true 冻结 30s 自动刷新
  const news = settleGuluTime();
  const s = getGuluStore();
  const now = guluNow();
  if (guluActiveTab === "collection") {
    dom.guluBody.innerHTML = renderGuluTabs() + renderGuluCollection(s);
    if (s.collectionUnread.length) { s.collectionUnread = []; saveGuluStore(); }
    if (typeof refreshCollectionHubBadges === "function") refreshCollectionHubBadges();
    return;
  }
  if (guluActiveTab === "market") {
    dom.guluBody.innerHTML = (guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : "")
      + renderBaigushi(s);
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
  const signDots = Array.from({ length: SIGN_CYCLE }, (_, k) => `<i class="gulu-sign-dot${k === SIGN_CYCLE - 1 ? " is-mile" : ""}${(!signState.signedToday && k === signState.nextIdx) ? " is-next" : ""}">${SIGN_REWARDS[k]}</i>`).join("");
  const signSection = `<section class="gulu-sec gulu-daily">
    <h3>归庐日课 <small>每日点卯得材料 · 连签 ${signState.displayStreak} 日 · 累计 ${signState.total} 日</small></h3>
    <div class="gulu-sign-row"><div class="gulu-sign-dots" title="七日循环，末日更丰">${signDots}</div>${signBtn}</div>
  </section>`;
  const matChips = MATERIAL_IDS.map((id) => `<span class="gulu-mat tone-${MATERIALS[id].tone || "jade"}"><b>${MATERIALS[id].glyph}</b>${MATERIALS[id].name}<i>×${s.materials[id] | 0}</i></span>`).join("")
    + `<span class="gulu-mat tone-boss"><b>核</b>蛊母残核<i>×${s.bossCores | 0}</i></span>`;
  const slots = s.slots.map((slot, i) => {
    if (i >= slotCap) {
      // 未解锁的第五圃——占位卡，明示解锁条件，不出孵卵按钮（守卫在 guluStartHatch 兜底）
      return `<div class="gulu-slot is-locked"><h4>第 ${i + 1} 圃 · 未辟</h4>
        <div class="gulu-slot-lock"><span class="gulu-lock-glyph" aria-hidden="true">封</span><p>通关任意路线后<br>辟出第五圃</p></div></div>`;
    }
    if (!slot) {
      const btns = Object.entries(GULU_GRADES).map(([gid, g]) => {
        const can = guluMatTotal(s) >= g.mats && (s.bossCores | 0) >= g.core;
        // V0.9.33 产出透传：把"抽哪个池/破卵带几级/喂本命蛊多少道行"写到按钮上，让玄/天品的价值看得见（回应"天品太废"多为不知其值）
        const poolLabel = g.rare ? "稀有蛊池" : "基础蛊池";
        const yieldLine = `${poolLabel} · 破卵+${g.upgrade} · 饲本命蛊+${g.dao}道行`;
        const title = `${g.name}：从${poolLabel}${g.rare ? "（含寿火/枯荣等稀有蛊）" : "（13 种基础蛊）"}随机破卵，成蛊自带 +${g.upgrade} 强化；喂本命蛊 +${g.dao} 道行（越高品阶越养形态）。`;
        return `<button type="button" class="gulu-grade grade-${gid}" data-gulu-hatch="${i}:${gid}" title="${escGu(title)}" ${can ? "" : "disabled"}>${g.name}<small>${g.mats}材${g.core ? "+残核" : ""} · ${g.timeText}</small><small class="gulu-grade-yield">${yieldLine}</small></button>`;
      }).join("");
      return `<div class="gulu-slot is-empty"><h4>第 ${i + 1} 圃 · 空土</h4><div class="gulu-grades">${btns}</div></div>`;
    }
    if (slot.state === "egg") {
      const grade = GULU_GRADES[slot.grade];
      const span = Math.max(1, (slot.hatchAt || 0) - (slot.startedAt || 0));
      const soon = slot.startedAt > 0 && (now - slot.startedAt) / span >= 0.9; // 末段 10% 现裂纹（startedAt 缺失的旧档不误判为临孵）
      return `<div class="gulu-slot is-egg grade-${slot.grade}" data-slot-index="${i}"><h4>第 ${i + 1} 圃 · ${grade.name}蛊卵</h4>
        <p class="gulu-egg-glyph${soon ? " is-hatching" : ""}" data-gulu-poke="egg" title="戳一戳">${GULU_GRADE_GLYPHS[slot.grade] || "卵"}</p><p class="gulu-remain">${formatGuluRemain(slot.hatchAt - now)}破壳</p></div>`;
    }
    const card = CARD_LIBRARY[slot.cardKey];
    const art = getGuluCardArt(slot.cardKey);
    const displayName = slot.customName || slot.name; // V0.9.28 命名：自定义优先
    const named = !!slot.customName;
    return `<div class="gulu-slot is-gu grade-${slot.grade}" data-slot-index="${i}"><h4>第 ${i + 1} 圃 · <span class="gulu-gu-name${named ? " is-named" : ""}">${escGu(displayName)}</span><button type="button" class="gulu-rename-btn" data-gulu-rename="${i}" title="命名" aria-label="给这只蛊命名">题</button></h4>
      <div class="gulu-gu-art" data-gulu-poke="gu" title="戳一戳"><i>${GULU_GRADE_GLYPHS[slot.grade] || "蛊"}</i>${art ? `<img src="${art}" alt="${escGu(displayName)}" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        ${slot.carry ? `<span class="gulu-carry-flag">随行</span>` : ""}</div>
      <p class="gulu-gu-desc">${card ? getCardEffect(slot.cardKey, slot.upgradeLevel | 0) : "蛊性不明"}</p>
      ${slot.grade === "tian" ? `<p class="gulu-carry-boon" title="仅天品随行入塔时额外生效">随行加持 · ${CARRIED_TIAN_DIM_LABEL[carriedTianDimKey(slot.cardKey)]}</p>` : ""}
      <div class="gulu-slot-actions">
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
    <p><strong>真形双路线</strong><span>${legacyBenmingRun ? "当前老续局沿用旧规则" : (injured && getEffectiveBenmingStage(heroId) < 3 ? "静养降阶，路线暂失效" : (altarPathId ? `本局：${getBenmingPathDefinition(heroId, altarPathId)?.name}` : "新局入塔前二择一"))}</span></p>
    ${Object.values(BENMING_PATHS[heroId]).map((path) => `<section class="benming-path-entry ${altarPathId === path.id ? "is-active" : ""}">
      <b>${path.glyph}</b><div><strong>${path.name}</strong><span>${path.summary}</span><small>归墟：${path.guixu}</small></div>
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
      <p class="gulu-tip">压制线：蛊卵≤凡 · 幼虫≤灵 · 成虫≤玄 · 真形≤天。越级喂养即蛊斗——胜则道行加倍，败则反噬静养。</p>
    </aside>` : "";
  dom.guluBody.innerHTML = `
    ${renderGuluTabs()}
    ${renderGuluOverview(s)}
    ${guluNoticeText ? `<p class="gulu-notice">${escGu(guluNoticeText)}</p>` : ""}
    <div class="gulu-layout">
      <div class="gulu-main">
        ${signSection}
        <section class="gulu-sec"><h3>材料仓 <small>通关全额带出 · 陨落折四成 · 残核仅通关可带</small></h3><div class="gulu-mats">${matChips}</div></section>
        <section class="gulu-sec"><h3>蛊圃 <small>真实时间破壳 · 随行入塔（${carriedCount}/${GULU_CARRY_MAX}，通关保留、陨落同殒）或喂给本命蛊</small></h3><div class="gulu-slots">${slots}</div></section>
        <section class="gulu-sec"><h3>蛊庐动静</h3><ul class="gulu-events">${events}</ul></section>
        ${NMG_XIANGHUO_ENABLED ? `<div class="gulu-lamp-row"><button type="button" class="gulu-lamp" data-xianghuo-open="gulu" aria-label="香火供奉"><i class="gulu-lamp-glyph" aria-hidden="true">灯</i><span>长明灯 · 添一炷香火</span></button></div>` : ""}
      </div>
      ${altar}
    </div>`;
  // V0.9.23 破壳强反馈：本次结算里有新破壳且蛊庐可见 → 走破壳仪式（按品阶分色）
  // V0.9.36 修：只认「本次刚破壳」的蛊（guluLastHatched），而非全圃 hatchAt 最大者——否则圃里已有别的成蛊时，
  //         仪式会张冠李戴（玩家报「第四圃出寿火蛊，仪式却写聚元蛊」）。多只同批破壳则取其中最迟破壳的一只。
  if (guluLastHatched.length && dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) {
    const newest = guluLastHatched.slice().sort((a, b) => (b.hatchAt || 0) - (a.hatchAt || 0))[0];
    if (newest && newest.state === "gu") {
      const grade = GULU_GRADES[newest.grade] || GULU_GRADES.fan;
      window.AudioManager?.playSfx?.(GULU_HATCH_SFX[newest.grade] || "guluHatchFan", { volumeScale: 1 }); // V0.9.26：破壳音与仪式分色同帧、同品驱动
      showRiteOverlay({
        tone: GULU_GRADE_TONES[newest.grade] || "gold",
        eyebrow: "蛊圃 · 破壳", seal: GULU_GRADE_GLYPHS[newest.grade] || "蛊",
        title: newest.name,
        text: `${grade.name}之蛊破壳而出。\n${CARD_LIBRARY[newest.cardKey] ? stripTags(getCardEffect(newest.cardKey, newest.upgradeLevel | 0)) : ""}`,
        hint: "点击任意处 · 收蛊", autoMs: 6000,
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
  guluActiveTab = tab === "market" ? "market" : "home";
  if (dom.guluTitle) dom.guluTitle.textContent = guluActiveTab === "market" ? "百蛊市" : "蛊庐";
  guluNoticeText = "";
  renderGulu();
  if (dom.guluBody) dom.guluBody.scrollTop = 0;
  dom.guluOverlay.classList.remove("hidden");
  refreshModalLock();
  window.clearInterval(guluRefreshTimer);
  guluRefreshTimer = window.setInterval(() => {
    if (dom.guluOverlay && !dom.guluOverlay.classList.contains("hidden")) { if (!guluRenaming) renderGulu(); } // 命名中不重渲染，免吞输入
    else window.clearInterval(guluRefreshTimer);
  }, 30000);
  // V0.9.26 音频：场景 BGM 交叉进场 + 陶罐开门 + 心跳/虫鸣节拍器
  window.AudioManager?.playScene?.("gulu", { duration: 800, quiet: true });
  window.AudioManager?.playSfx?.("guluPot", { volumeScale: 0.9 });
  guluHeartbeatDue = 0;
  guluNightOn = false;
  guluChirpOn = false; guluChirpPhaseUntil = 0; // 开面板：夜里先来一阵虫鸣再转静
  window.clearInterval(guluAudioTimer);
  guluAudioTimer = window.setInterval(guluAudioTick, 1000);
  guluAudioTick();
  dom.guluCloseButton?.focus();
}
function openBaigushi() {
  guluMarketStall = "insects";
  openGulu("market");
  window.AudioManager?.playScene?.("baigushi", { duration: 800, quiet: true });
}
function closeGulu() {
  guluRenaming = false; // 关面板即离开命名态，防标志滞留冻结下次自动刷新
  closeGuluActionConfirm();
  window.clearInterval(guluRefreshTimer);
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
