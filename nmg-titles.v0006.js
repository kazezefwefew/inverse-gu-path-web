/* ===== V0.9.67 称号：收藏、佩戴与本命九转补发的单一事实源 =====
 * 称号是局外展示荣誉，不参与 runState / game，也不提供战斗数值。
 * 旧 `nmg.titleCollection` 原样沿用；只新增一个当前佩戴偏好键。 */
const TITLE_COLLECTION_KEY = "nmg.titleCollection"; // { titleId: 获得次数 }
const TITLE_EQUIPPED_KEY = "nmg.titleEquipped";     // titleId

/* generateRunTitle 按 id 取词条，万蛊录与蛊斗也只从此处取固定文案。 */
const TITLE_CATALOG = Object.freeze([
  { id: "nineTurn", title: "九转", sub: "本命蛊历九蜕而不灭，九转之名自此随身。", hint: "任一本命蛊炼至九转" },
  { id: "guluKeeper", title: "蛊庐守候者", sub: "破壳、温养、收纳与随行皆有时序，你已让蛊庐真正活了起来。", hint: "曾在蛊庐留下完整的照料印记" },
  { id: "duelAncestral", title: "祖庭问鼎", sub: "蛊斗诸阶尽在身后，你已在祖庭之巅留下自己的名号。", hint: "蛊斗场排位晋升祖庭" },
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
const TITLE_CATALOG_MAP = TITLE_CATALOG.reduce((map, title) => {
  map[title.id] = title;
  return map;
}, {});

function markTitleCollected(titleId) {
  if (!TITLE_CATALOG_MAP[titleId]) return false;
  const collection = loadJsonStore(TITLE_COLLECTION_KEY);
  const isNew = !collection[titleId];
  collection[titleId] = (collection[titleId] | 0) + 1;
  saveJsonStore(TITLE_COLLECTION_KEY, collection);
  return isNew;
}

function unlockTitle(titleId, { autoEquip = false } = {}) {
  if (!TITLE_CATALOG_MAP[titleId]) return false;
  const collection = loadJsonStore(TITLE_COLLECTION_KEY);
  const isNew = !collection[titleId];
  if (isNew) {
    collection[titleId] = 1;
    saveJsonStore(TITLE_COLLECTION_KEY, collection);
  }
  if (autoEquip && !getEquippedTitleId()) setEquippedTitleId(titleId);
  return isNew;
}

function getEquippedTitleId() {
  let titleId = "";
  try { titleId = String(localStorage.getItem(TITLE_EQUIPPED_KEY) || ""); } catch (error) { return ""; }
  if (!TITLE_CATALOG_MAP[titleId]) return "";
  const collection = loadJsonStore(TITLE_COLLECTION_KEY);
  return (collection[titleId] | 0) > 0 ? titleId : "";
}

function setEquippedTitleId(titleId) {
  const normalized = String(titleId || "");
  const collection = loadJsonStore(TITLE_COLLECTION_KEY);
  if (!TITLE_CATALOG_MAP[normalized] || !((collection[normalized] | 0) > 0)) return false;
  try { localStorage.setItem(TITLE_EQUIPPED_KEY, normalized); } catch (error) { return false; }
  return true;
}

function getEquippedTitle() {
  return TITLE_CATALOG_MAP[getEquippedTitleId()] || null;
}

/* 联机只允许目录内 ID；不接收玩家自填称号文字。远端是否真实拥有由平台能力升级后再校验。 */
function normalizePublicTitleId(titleId) {
  const normalized = String(titleId || "");
  return TITLE_CATALOG_MAP[normalized] ? normalized : "";
}

function syncNineTurnTitleUnlock() {
  if (typeof BENMING_GU === "undefined" || typeof getBenmingStage !== "function") return false;
  const reached = Object.keys(BENMING_GU).some((heroId) => (getBenmingStage(heroId) | 0) >= 9);
  return reached ? unlockTitle("nineTurn", { autoEquip: true }) : false;
}

function syncDuelRankTitleUnlocks() {
  if (typeof getGuluStore !== "function") return false;
  const owned = getGuluStore()?.duelRankTitles;
  return Array.isArray(owned) && owned.includes("duelAncestral")
    ? unlockTitle("duelAncestral", { autoEquip: true })
    : false;
}

if (typeof window !== "undefined") {
  window.NmgTitles = Object.freeze({
    getEquippedTitleId,
    getEquippedTitle,
    normalizePublicTitleId,
    getPublicTitle(titleId) {
      const normalized = normalizePublicTitleId(titleId);
      return normalized ? TITLE_CATALOG_MAP[normalized] : null;
    },
  });
}
