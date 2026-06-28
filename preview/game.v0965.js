"use strict";

/*
 * 《逆命蛊途》V0.9.2.1「网页试玩首轮反馈修复」
 * 结构说明：
 * 1. CARD_LIBRARY / ENEMY_LIBRARY / RELICS / REFINEMENTS 只保存数据；
 * 2. game 保存单场战斗状态，runState 保存完整四段命途试炼的继承数据；
 * 3. 结算函数不直接拼界面，统一由 render 系列函数刷新；
 * 4. 动画只是战斗反馈层，不参与数值，便于后续加入地图、事件和多场战斗。
 */

const CARD_LIBRARY = {
  // 原始五类卡牌：完整保留第一版效果。
  moonBlade: {
    name: "月刃蛊", cost: 1, type: "attack", category: "attack", typeName: "攻击蛊",
    glyph: "月", art: "刃", effect: "对敌人造成 <em>6</em> 点伤害",
  },
  ironSkin: {
    name: "铁皮蛊", cost: 1, type: "defense", category: "defense", typeName: "防御蛊",
    glyph: "铁", art: "甲", effect: "获得 <em>7</em> 点防御",
  },
  wineWorm: {
    name: "酒虫", cost: 1, type: "utility", category: "utility", typeName: "辅助蛊",
    glyph: "酒", art: "酿", effect: "下一张攻击蛊的伤害<em>翻倍</em>。",
  },
  bloodBlade: {
    name: "血刃蛊", cost: 1, type: "blood", category: "attack", typeName: "血道攻击",
    glyph: "血", art: "煞", effect: "失去 <em>3</em> 点生命，造成 <em>13 + 当前血煞</em> 点伤害，获得 <em>1</em> 层血煞",
  },
  burningEssence: {
    name: "燃元蛊", cost: 0, type: "utility", category: "utility", typeName: "燃命蛊",
    glyph: "燃", art: "元", effect: "获得 <em>1</em> 点真元，但失去 <em>2</em> 点生命",
  },

  // 通用进阶牌池：作为战后奖励的 40% 通用来源，不混入其他角色专属牌。
  heartEater: {
    name: "噬心蛊", cost: 2, type: "attack", category: "attack", typeName: "血道攻击",
    glyph: "噬", art: "心", effect: "造成 <em>12</em> 点伤害；血煞不少于 2 层时改为 <em>20</em>",
  },
  bloodReversal: {
    name: "逆血蛊", cost: 2, type: "blood", category: "attack", typeName: "血道攻击蛊",
    glyph: "逆", art: "血", effect: "失去 <em>5</em> 点生命，造成 <em>16 + 血煞×2</em> 点伤害，获得 <em>1</em> 层血煞",
  },
  bloodTide: {
    name: "血潮蛊", cost: 2, type: "blood", category: "attack", typeName: "血道攻击",
    glyph: "潮", art: "涌", effect: "造成 <em>5 + 血煞×3</em> 点伤害",
  },
  lifeFlame: {
    name: "寿火蛊", cost: 0, type: "attack", category: "attack", typeName: "寿道攻击",
    glyph: "寿", art: "烬", lifespanCost: 1, effect: "消耗 <em>1</em> 寿元，造成 <em>10</em> 点伤害",
  },
  witheredBloom: {
    name: "枯荣蛊", cost: 1, type: "utility", category: "utility", typeName: "寿道秘蛊",
    glyph: "荣", art: "生", lifespanCost: 2, effect: "消耗 <em>2</em> 寿元，恢复 <em>10</em> 点生命",
  },
  essenceGathering: {
    name: "聚元蛊", cost: 1, type: "utility", category: "utility", typeName: "元道辅助",
    glyph: "聚", art: "炁", effect: "获得 <em>2</em> 点真元并抽 <em>1</em> 张牌",
  },
  mysticCarapace: {
    name: "玄甲蛊", cost: 2, type: "defense", category: "defense", typeName: "防御蛊",
    glyph: "玄", art: "壳", effect: "获得 <em>16</em> 点防御",
  },
  returnLife: {
    name: "返命蛊", cost: 2, type: "utility", category: "utility", typeName: "血道疗愈",
    glyph: "返", art: "命", bloodCost: 3, effect: "消耗 <em>3</em> 层血煞，恢复 <em>16</em> 点生命",
  },
  swarmBite: {
    name: "群蛊噬", cost: 1, type: "attack", category: "attack", typeName: "攻击蛊",
    glyph: "群", art: "噬", effect: "造成 <em>4</em> 点伤害；本回合此前每出 1 张牌，追加 <em>3</em>",
  },
  meridianShift: {
    name: "移窍蛊", cost: 0, type: "utility", category: "utility", typeName: "辅助蛊",
    glyph: "窍", art: "迁", effect: "失去 <em>3</em> 点生命，抽 <em>2</em> 张牌",
  },

  // V0.8：通用构筑牌。所有角色都可在奖励与蛊坊中获得，用于扩大跨流派组合。
  armorBreaker: {
    name: "破甲蛊", cost: 1, type: "attack", category: "attack", typeName: "攻击蛊",
    glyph: "破", art: "甲", effect: "造成 <em>5</em> 点伤害；若敌人有防御，额外造成 <em>6</em> 点伤害",
  },
  yuanReturn: {
    name: "回元蛊", cost: 0, type: "utility", category: "utility", typeName: "辅助蛊",
    glyph: "回", art: "元", effect: "获得 <em>1</em> 点真元；本回合下一张辅助蛊抽 <em>1</em> 张牌",
  },
  shellRemnant: {
    name: "残壳蛊", cost: 1, type: "defense", category: "defense", typeName: "护甲蛊",
    glyph: "壳", art: "残", effect: "获得 <em>6</em> 点防御；若本回合已受伤，额外获得 <em>6</em> 点防御",
  },
  guFeeding: {
    name: "饲蛊术", cost: 1, type: "utility", category: "utility", typeName: "辅助蛊",
    glyph: "饲", art: "蛊", effect: "抽 <em>2</em> 张牌，然后弃 <em>1</em> 张牌",
  },
  soulCrack: {
    name: "裂魂蛊", cost: 2, type: "attack", category: "attack", typeName: "攻击蛊",
    glyph: "裂", art: "魂", lifespanCost: 1, effect: "造成 <em>18</em> 点伤害；失去 <em>1</em> 点寿元",
  },
  armorMeltPoison: {
    name: "蚀甲蛊", cost: 1, type: "poison", category: "attack", typeName: "毒道攻击蛊",
    glyph: "蚀", art: "甲", effect: "造成 <em>3</em> 点伤害，施加 <em>3</em> 层毒性；若敌人有防御，移除其 <em>5</em> 点防御",
  },
  bloodRobe: {
    name: "血衣蛊", cost: 1, type: "blood", category: "defense", typeName: "血道护甲蛊",
    glyph: "衣", art: "血", effect: "失去 <em>2</em> 点生命，获得 <em>12</em> 点防御，并获得 <em>1</em> 层血煞",
  },
  lifeLamp: {
    name: "命灯蛊", cost: 1, type: "fate", category: "utility", typeName: "命势辅助蛊",
    glyph: "灯", art: "命", effect: "获得 <em>1</em> 层命势；若命势已满，恢复 <em>4</em> 点生命",
  },

  // 流派专属：无名逆命者围绕攻击/护甲/辅助交替形成“命势”循环。
  fateThread: {
    name: "命线蛊", cost: 1, type: "fate", category: "attack", typeName: "攻击蛊",
    glyph: "线", art: "命", effect: "造成 <em>8</em> 点伤害；若命势不少于 <em>2</em> 层，额外造成 <em>6</em> 点伤害",
  },
  reversePath: {
    name: "逆途蛊", cost: 0, type: "fate", category: "utility", typeName: "辅助蛊",
    glyph: "逆", art: "途", effect: "获得 <em>3</em> 点防御，并获得 <em>1</em> 层命势",
  },
  fixedFate: {
    name: "定数蛊", cost: 1, type: "fate", category: "defense", typeName: "护甲蛊",
    glyph: "定", art: "数", effect: "获得 <em>9</em> 点防御；若本回合上一张牌不是护甲蛊，额外获得 <em>3</em> 点防御",
  },

  // 流派专属：绛妄以生命代价换取血煞和高爆发。
  bloodSacrifice: {
    name: "血祭蛊", cost: 0, type: "blood", category: "utility", typeName: "辅助蛊",
    glyph: "祭", art: "血", effect: "失去 <em>3</em> 点生命，获得 <em>2</em> 层血煞，抽 <em>1</em> 张牌",
  },
  bloodThirst: {
    name: "嗜血蛊", cost: 1, type: "blood", category: "attack", typeName: "攻击蛊",
    glyph: "嗜", art: "饮", effect: "造成 <em>7 + 当前血煞</em> 点伤害；恢复 <em>3</em> 点生命",
  },

  // 流派专属：青蟒以毒性层数和重复施毒压制敌人。
  greenMiasma: {
    name: "青瘴蛊", cost: 1, type: "poison", category: "utility", typeName: "毒道辅助蛊",
    glyph: "瘴", art: "毒", effect: "施加 <em>4</em> 层毒性",
  },
  insectSwarm: {
    name: "虫群蛊", cost: 1, type: "poison", category: "attack", typeName: "毒道攻击蛊",
    glyph: "虫", art: "群", effect: "造成 <em>4</em> 点伤害，并施加 <em>4</em> 层毒性",
  },
  moltingShell: {
    name: "蜕壳蛊", cost: 1, type: "poison", category: "defense", typeName: "护甲蛊",
    glyph: "蜕", art: "壳", effect: "获得 <em>8</em> 点防御；若敌人已中毒，抽 <em>1</em> 张牌",
  },
  poisonReturn: {
    name: "返毒蛊", cost: 1, type: "poison", category: "attack", typeName: "毒道攻击蛊",
    glyph: "返", art: "毒", effect: "造成 <em>6</em> 点伤害；若敌人中毒不少于 <em>8</em> 层，额外造成 <em>8</em> 点伤害",
  },

  // V0.6：异变炼蛊结果。异变卡不会进入普通奖励池，只会替换被炼化的卡牌实例。
  bloodMoon: {
    name: "血月蛊", cost: 1, type: "blood", category: "attack", typeName: "血道攻击蛊",
    glyph: "月", art: "血", effect: "失去 <em>2</em> 点生命，造成 <em>12</em> 点伤害；若拥有血煞，额外造成当前血煞层数的伤害",
  },
  moltedArmor: {
    name: "蜕甲蛊", cost: 1, type: "defense", category: "defense", typeName: "护甲蛊",
    glyph: "蜕", art: "甲", effect: "获得 <em>9</em> 点防御；若本回合未受伤，抽 <em>1</em> 张牌",
  },
  rotMiasma: {
    name: "腐瘴蛊", cost: 1, type: "poison", category: "utility", typeName: "毒道辅助蛊",
    glyph: "腐", art: "瘴", effect: "施加 <em>6</em> 层毒性；若敌人已经中毒，额外触发一次蚀毒",
  },
  fateSever: {
    name: "断命蛊", cost: 0, type: "fate", category: "utility", typeName: "辅助蛊",
    glyph: "断", art: "命", effect: "获得 <em>1</em> 层命势，抽 <em>1</em> 张牌；失去 <em>1</em> 点寿元",
  },
  leechBlade: {
    name: "血蛭刃", cost: 1, type: "blood", category: "attack", typeName: "血道攻击蛊",
    glyph: "蛭", art: "刃", effect: "失去 <em>4</em> 点生命，造成 <em>15</em> 点伤害；恢复造成伤害的 20% 生命，至少恢复 <em>2</em> 点",
  },
  drunkFateWorm: {
    name: "醉命虫", cost: 1, type: "fate", category: "utility", typeName: "辅助蛊",
    glyph: "醉", art: "酒", effect: "下一张攻击蛊伤害翻倍；若本回合已获得命势，抽 <em>1</em> 张牌",
  },
  soulBurn: {
    name: "魂燃蛊", cost: 0, type: "utility", category: "utility", typeName: "辅助蛊",
    glyph: "魂", art: "燃", effect: "获得 <em>2</em> 点真元，失去 <em>3</em> 点生命；本回合下一张蛊牌消耗 -1，最低为 0",
  },
  mutantBlade: {
    name: "异刃蛊", cost: 1, type: "attack", category: "attack", typeName: "异变攻击蛊",
    glyph: "异", art: "刃", effect: "失去 <em>2</em> 点生命，造成 <em>14</em> 点伤害",
  },
  mutantArmor: {
    name: "异甲蛊", cost: 1, type: "defense", category: "defense", typeName: "异变护甲蛊",
    glyph: "异", art: "甲", effect: "获得 <em>14</em> 点防御；弃 1 张随机手牌",
  },
  mutantPoison: {
    name: "异毒蛊", cost: 1, type: "poison", category: "utility", typeName: "异变毒道蛊",
    glyph: "异", art: "毒", effect: "施加 <em>9</em> 层毒性；你失去 <em>2</em> 点生命",
  },
  mutantFate: {
    name: "异命蛊", cost: 0, type: "utility", category: "utility", typeName: "异变辅助蛊",
    glyph: "异", art: "命", effect: "获得 <em>2</em> 点真元并抽 <em>1</em> 张牌；失去 <em>1</em> 点寿元",
  },
};

const CARD_EFFECT_TYPES = Object.freeze({
  moonBlade: "blade",
  fateThread: "blade",
  armorBreaker: "blade",
  mutantBlade: "blade",
  soulCrack: "blade",

  bloodBlade: "blood",
  bloodReversal: "blood",
  bloodMoon: "blood",
  leechBlade: "blood",
  bloodThirst: "blood",
  heartEater: "blood",
  bloodTide: "blood",

  greenMiasma: "poison",
  insectSwarm: "poison",
  poisonReturn: "poison",
  rotMiasma: "poison",
  mutantPoison: "poison",
  armorMeltPoison: "poison",
  swarmBite: "poison",

  ironSkin: "armor",
  fixedFate: "armor",
  moltingShell: "armor",
  mysticCarapace: "armor",
  shellRemnant: "armor",
  bloodRobe: "armor",
  mutantArmor: "armor",
  moltedArmor: "armor",

  wineWorm: "yuan",
  burningEssence: "yuan",
  yuanReturn: "yuan",
  essenceGathering: "yuan",
  soulBurn: "yuan",
  drunkFateWorm: "yuan",

  reversePath: "fate",
  lifeLamp: "fate",
  fateSever: "fate",
  meridianShift: "fate",
  witheredBloom: "fate",
  mutantFate: "fate",

  guFeeding: "utility",
  bloodSacrifice: "utility",
  returnLife: "utility",
  lifeFlame: "utility",
});

function inferCardEffectType(cardDefinition = {}) {
  if (cardDefinition.type === "poison" || cardDefinition.typeName?.includes("毒道")) return "poison";
  if (cardDefinition.category === "defense") return "armor";
  if (cardDefinition.type === "blood" && cardDefinition.category === "attack") return "blood";
  if (cardDefinition.type === "fate") return "fate";
  if (cardDefinition.category === "attack") return "blade";
  return "utility";
}

Object.entries(CARD_LIBRARY).forEach(([key, definition]) => {
  definition.effectType = CARD_EFFECT_TYPES[key] || inferCardEffectType(definition);
});

const ADVANCED_CARD_KEYS = [
  "heartEater", "bloodTide", "lifeFlame", "witheredBloom",
  "essenceGathering", "mysticCarapace", "returnLife", "swarmBite", "meridianShift",
];

const V08_COMMON_CARD_KEYS = Object.freeze([
  "armorBreaker", "yuanReturn", "shellRemnant", "guFeeding",
  "soulCrack", "armorMeltPoison", "bloodRobe", "lifeLamp",
]);

const BLOOD_MAX = 8;
const FATE_MOMENTUM_MAX = 3;

const HERO_STARTER_DECKS = Object.freeze({
  fate: [
    ...Array(3).fill("moonBlade"),
    ...Array(3).fill("ironSkin"),
    "wineWorm", "burningEssence", "fateThread", "reversePath",
  ],
  blood: [
    ...Array(2).fill("moonBlade"),
    ...Array(2).fill("ironSkin"),
    ...Array(2).fill("bloodBlade"),
    "wineWorm", "bloodSacrifice", "bloodThirst", "bloodReversal",
  ],
  poison: [
    ...Array(2).fill("moonBlade"),
    ...Array(2).fill("ironSkin"),
    "wineWorm", "burningEssence", "greenMiasma", "insectSwarm", "moltingShell", "poisonReturn",
  ],
});

const HERO_EXCLUSIVE_CARD_KEYS = Object.freeze({
  fate: ["fateThread", "reversePath", "fixedFate"],
  blood: ["bloodSacrifice", "bloodThirst", "bloodReversal"],
  poison: ["greenMiasma", "insectSwarm", "moltingShell", "poisonReturn"],
});

const COMMON_REWARD_CARD_KEYS = Object.freeze([
  "moonBlade", "ironSkin", "wineWorm", "bloodBlade", "burningEssence",
  ...V08_COMMON_CARD_KEYS,
  ...ADVANCED_CARD_KEYS,
]);

const STANDARD_REWARD_CARD_KEYS = Object.freeze([
  "moonBlade", "ironSkin", "wineWorm", "bloodBlade", "burningEssence",
  ...V08_COMMON_CARD_KEYS,
]);

const MATERIALS = Object.freeze({
  bloodSand: {
    name: "血砂", glyph: "砂", tone: "blood",
    short: "偏向血道、爆发、生命代价。",
    description: "适合攻击蛊和血道蛊；炉火更易催出爆发与反噬。",
  },
  insectMolt: {
    name: "虫蜕", glyph: "蜕", tone: "jade",
    short: "偏向防御、蜕壳、抽牌、生存。",
    description: "适合护甲蛊和辅助蛊；能稳住炉火并织出护身虫纹。",
  },
  rotLiquid: {
    name: "腐液", glyph: "腐", tone: "poison",
    short: "偏向毒性、腐蚀、持续伤害。",
    description: "适合毒道蛊；可放大毒性，也可能腐蚀施蛊者。",
  },
  fateSilk: {
    name: "命丝", glyph: "丝", tone: "gold",
    short: "偏向命势、真元、抽牌、连携。",
    description: "适合命势流卡牌和辅助蛊；能把不同蛊术串成连携。",
  },
  remnantSoul: {
    name: "残魂", glyph: "魂", tone: "soul",
    short: "偏向高风险异变，可能强，也可能反噬。",
    description: "适合所有卡，但不走匹配关系；异变率更高，反噬也更重。",
  },
});

const MATERIAL_IDS = Object.freeze(Object.keys(MATERIALS));
const MAX_RUN_MUTATIONS = 2;

const SPECIFIC_MUTATIONS = Object.freeze({
  "moonBlade:bloodSand": "bloodMoon",
  "ironSkin:insectMolt": "moltedArmor",
  "greenMiasma:rotLiquid": "rotMiasma",
  "reversePath:fateSilk": "fateSever",
  "bloodBlade:bloodSand": "leechBlade",
  "wineWorm:fateSilk": "drunkFateWorm",
  "burningEssence:remnantSoul": "soulBurn",
});

// V0.6：炼化配置集中维护。upgradeLevel 存在每张卡实例上，材料炼蛊会改写同一个卡牌实例。
const CARD_UPGRADE_CONFIG = Object.freeze({
  moonBlade: { rule: "基础伤害每级 +4" },
  ironSkin: { rule: "基础防御每级 +4" },
  wineWorm: { rule: "+1 抽 1 张牌；+2 消耗降为 0，仍抽 1 张牌" },
  bloodBlade: { rule: "基础伤害每级 +4，保留 3 点生命反噬" },
  burningEssence: { rule: "每级额外获得 1 点真元，生命反噬不降低" },
  heartEater: { rule: "普通与血煞催发伤害每级 +4" },
  bloodReversal: { rule: "基础伤害每级 +4，血煞倍率每级 +1" },
  bloodTide: { rule: "基础伤害每级 +4，血煞倍率每级 +1" },
  lifeFlame: { rule: "基础伤害每级 +4，寿元代价不降低" },
  witheredBloom: { rule: "治疗量每级 +4，寿元代价不降低" },
  essenceGathering: { rule: "+1 抽牌 +1；+2 真元 +1" },
  mysticCarapace: { rule: "基础防御每级 +4" },
  returnLife: { rule: "治疗量每级 +5，血煞代价不降低" },
  swarmBite: { rule: "基础伤害每级 +4，此前出牌追加每级 +1" },
  meridianShift: { rule: "每级额外抽 1 张牌，生命代价不降低" },
  armorBreaker: { rule: "基础伤害每级 +4，破甲追加每级 +2" },
  yuanReturn: { rule: "+1 后续辅助抽牌更稳；+2 真元额外 +1" },
  shellRemnant: { rule: "基础防御每级 +4，受伤追加防御每级 +2" },
  guFeeding: { rule: "每级额外抽 1 张牌，弃牌数不变" },
  soulCrack: { rule: "基础伤害每级 +4，寿元代价不降低" },
  armorMeltPoison: { rule: "每级伤害 +2、施毒 +1、蚀甲 +2" },
  bloodRobe: { rule: "基础防御每级 +4；+2 时额外获得 1 层血煞" },
  lifeLamp: { rule: "每级治疗 +2；+2 时命势收益 +1" },
  fateThread: { rule: "基础伤害每级 +4，命势额外伤害每级 +2" },
  reversePath: { rule: "防御每级 +3；+2 时额外获得 1 层命势" },
  fixedFate: { rule: "基础防御每级 +4，条件防御每级 +2" },
  bloodSacrifice: { rule: "+1 抽牌 +1；+2 血煞 +1，生命反噬不降低" },
  bloodThirst: { rule: "基础伤害每级 +4，治疗每级 +1；+2 血煞收益翻倍" },
  greenMiasma: { rule: "每级施毒 +2 层" },
  insectSwarm: { rule: "每级伤害 +2、施毒 +1 层" },
  moltingShell: { rule: "每级防御 +4；+2 时中毒抽牌 +1" },
  poisonReturn: { rule: "基础伤害与条件额外伤害每级 +3" },
  bloodMoon: { rule: "异变血道攻击：+2 时基础伤害 +4，血煞额外伤害保留" },
  moltedArmor: { rule: "异变护甲：+2 时基础防御 +4，未受伤抽牌保留" },
  rotMiasma: { rule: "异变毒道：+2 时施毒 +2，额外蚀毒保留" },
  fateSever: { rule: "异变辅助：+2 时额外获得 1 点真元，寿元代价保留" },
  leechBlade: { rule: "异变血道攻击：+2 时基础伤害 +4，吸血保留" },
  drunkFateWorm: { rule: "异变辅助：+2 时命势触发抽牌改为抽 2 张" },
  soulBurn: { rule: "残魂异变辅助：+2 时真元 +1，生命代价保留" },
  mutantBlade: { rule: "通用异变攻击：+2 时基础伤害 +4，生命代价保留" },
  mutantArmor: { rule: "通用异变护甲：+2 时基础防御 +4，弃牌代价保留" },
  mutantPoison: { rule: "通用异变毒道：+2 时施毒 +2，生命代价保留" },
  mutantFate: { rule: "通用异变辅助：+2 时抽牌 +1，寿元代价保留" },
});

// 立绘路径只在这里维护，全部基于已核验并规范化后的真实文件名。
const PORTRAIT_PATHS = Object.freeze({
  heroes: {
    fate: "assets/portraits/hero-fate-web.jpg",
    blood: "assets/portraits/hero-blood-web.jpg",
    poison: "assets/portraits/hero-poison-web.jpg",
  },
  enemies: {
    shanxiao: "assets/portraits/enemy-shanxiao-web.jpg",
    rottenShanxiao: "assets/portraits/enemy-shanxiao-web.jpg",
    bloodwolf: "assets/portraits/enemy-bloodwolf-web.jpg",
    redManeBloodwolf: "assets/portraits/enemy-bloodwolf-web.jpg",
    bloodwolfElite: "assets/portraits/enemy-bloodwolf-web.jpg",
    beeswarm: "assets/portraits/enemy-beeswarm-web.jpg",
    wildBeeTide: "assets/portraits/enemy-beeswarm-web.jpg",
    corpsepuppet: "assets/portraits/enemy-corpsepuppet-web.jpg",
    corpsepuppetPhase2: "assets/portraits/enemy-corpsepuppet-phase2-web.jpg",
    rotleafGu: "assets/portraits/rot-leaf-gu-insect.webp",
    miasmaParasite: "assets/portraits/green-miasma-parasite.webp",
    poisonVineCorpse: "assets/portraits/poison-vine-thrall.webp",
    miasmaLanternEliteGu: "assets/portraits/miasma-lantern-keeper.webp",
    miasmaMotherBoss: "assets/portraits/hundred-miasma-mother-gu.webp",
    bloodLeechSwarm: "assets/portraits/red-marsh-leech-swarm.webp",
    brokenMeridianGu: "assets/portraits/severed-meridian-cultist.webp",
    bloodMudGolem: "assets/portraits/blood-mud-puppet.webp",
    bloodRobePriestEliteGu: "assets/portraits/bloodrobe-gu-sacrificer.webp",
    bloodRobeMotherBoss: "assets/portraits/bloodrobe-gu-mother.webp",
  },
});

// 开局后预加载战斗资源(只在首次开局触发一次)：敌人立绘小图 + 预热战斗/首领 BGM，
// 避免开战那一刻才现拉、导致音乐慢半拍、立绘闪一下。纯加载时机优化，不改音频状态机与美术。
let battleAssetsPreloaded = false;
function preloadBattleAssets() {
  if (battleAssetsPreloaded) return;
  battleAssetsPreloaded = true;
  try {
    const seen = {};
    Object.values(PORTRAIT_PATHS.enemies).forEach((src) => {
      if (!src || seen[src]) return;
      seen[src] = true;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  } catch (imgErr) { /* 立绘预加载失败忽略 */ }
  try {
    if (window.AudioManager && typeof window.AudioManager.warmScene === "function") {
      window.AudioManager.warmScene("battle");
      window.AudioManager.warmScene("boss");
    }
  } catch (audioErr) { /* BGM 预热失败忽略 */ }
}

const HEROES = {
  fate: {
    name: "无名逆命者", role: "命势流蛊修", glyph: "命", maxHp: 60, energy: 3, lifespan: 23,
    passiveName: "命势流转", passive: "成功打出与上一张不同类型的卡牌时获得 1 层命势；命势满 3 层后真元 +1 并抽 1 张牌。",
    caption: "蛊影随身 · 天命不受",
  },
  blood: {
    name: "绛妄", role: "血道女蛊修", glyph: "血", maxHp: 52, energy: 3, lifespan: 20,
    passiveName: "血海饲蛊", passive: "血煞上限 8；血道攻击会按牌面引用当前血煞获得额外伤害。",
    caption: "以身饲虫 · 以命换力",
  },
  poison: {
    name: "青蟒", role: "毒道少年蛊师", glyph: "毒", maxHp: 56, energy: 3, lifespan: 21,
    passiveName: "万毒归宗", passive: "每回合开始施加 1 层毒性；敌人已中毒时再次被毒道卡施毒，会触发 2 点蚀毒伤害。",
    caption: "千虫藏袖 · 万毒随心",
  },
};

const ENEMY_LIBRARY = {
  shanxiao: {
    name: "山魈",
    title: "塔中凶兽",
    maxHp: 48,
    kicker: "阴风穿塔，兽啸逼近",
    intro: "山魈伏在阴影中，正窥伺你的破绽。",
    caption: "山鬼成魈 · 饮血裂石",
    actions: {
      claw: { name: "爪击", icon: "爪", kind: "attack", damage: 7 },
      rend: { name: "撕裂", icon: "裂", kind: "attack", damage: 11 },
      charge: { name: "蓄势", icon: "势", kind: "charge", bonus: 5 },
    },
  },
  rottenShanxiao: {
    name: "腐皮山魈",
    title: "腐毒凶兽",
    maxHp: 54,
    kicker: "腐皮剥落，腥毒渗阶",
    intro: "腐皮山魈拖着烂尾伏在塔阶旁，爪缝里滴着青黑毒液。",
    caption: "腐皮山魈 · 毒爪拖影",
    actions: {
      rotClaw: { name: "腐爪", icon: "腐", kind: "attack", damage: 6, playerPoison: 1 },
      mudSlam: { name: "污泥重拍", icon: "泥", kind: "attack", damage: 9 },
      rotBreath: { name: "腐息蓄毒", icon: "毒", kind: "charge", bonus: 4 },
    },
  },
  bloodwolf: {
    name: "异变血狼",
    title: "血沼凶兽",
    maxHp: 52,
    kicker: "血雾贴地，狼嚎裂心",
    intro: "异变血狼踏着猩红煞雾逼近，骨刺间仍挂着未干血迹。",
    caption: "骨刺沐血 · 煞气为食",
    actions: {
      bloodClaw: { name: "血爪", icon: "爪", kind: "attack", damage: 8 },
      hungerBite: { name: "饥噬", icon: "噬", kind: "attack", damage: 12 },
      bloodHowl: { name: "煞血长嚎", icon: "嚎", kind: "charge", bonus: 5 },
    },
  },
  redManeBloodwolf: {
    name: "赤鬃血狼",
    title: "赤鬃凶兽",
    maxHp: 50,
    kicker: "赤鬃燃血，狼影贴地",
    intro: "赤鬃血狼绕着你低伏游走，半身染血后只会更凶。",
    caption: "赤鬃血狼 · 伤重愈狂",
    actions: {
      redClaw: { name: "赤爪", icon: "爪", kind: "attack", damage: 8 },
      throatBite: { name: "锁喉咬", icon: "咬", kind: "attack", damage: 11 },
      maneHowl: { name: "赤鬃怒嚎", icon: "鬃", kind: "charge", bonus: 4 },
    },
    enrage: { threshold: 0.5, attackBonus: 3, name: "赤鬃狂怒" },
  },
  bloodwolfElite: {
    name: "血纹狼王",
    title: "命途精英",
    maxHp: 76,
    isElite: true,
    kicker: "血纹伏地，狼王拦路",
    intro: "血纹狼王从塔影中缓步踏出，背脊血纹如活虫般起伏。",
    caption: "狼王血纹 · 追魂裂骨",
    actions: {
      bonePounce: { name: "裂骨扑杀", icon: "裂", kind: "attack", damage: 13 },
      bloodMoonHowl: { name: "血月嚎叫", icon: "嚎", kind: "charge", bonus: 4, armor: 5 },
      soulBite: { name: "追魂撕咬", icon: "咬", kind: "attack", damage: 8, lowHpExtra: 5 },
    },
    enrage: { threshold: 0.3, attackBonus: 3, name: "血纹狂化" },
  },
  beeswarm: {
    name: "毒蜂蛊群",
    title: "失控虫群",
    maxHp: 44,
    kicker: "毒翅蔽灯，群蜂如潮",
    intro: "无数毒蜂纠缠成一张狰狞虫面，幽绿毒雾正从蜂群间滴落。",
    caption: "万蜂同巢 · 毒翅遮天",
    actions: {
      venomNeedle: { name: "毒针攒射", icon: "针", kind: "attack", damage: 7 },
      swarmRush: { name: "群蜂突袭", icon: "群", kind: "attack", damage: 4, hits: 2 },
      wingBeat: { name: "振翅聚毒", icon: "振", kind: "charge", bonus: 4 },
    },
  },
  wildBeeTide: {
    name: "乱蜂蛊潮",
    title: "暴乱虫群",
    maxHp: 46,
    kicker: "乱翅撞灯，蜂潮翻涌",
    intro: "乱蜂蛊潮并非一群虫，而像一团被怨念搅碎的毒云。",
    caption: "乱蜂蛊潮 · 双刺乱鸣",
    actions: {
      twinSting: { name: "乱刺连蜇", icon: "刺", kind: "attack", damage: 4, hits: 2 },
      venomSpill: { name: "毒翅擦身", icon: "毒", kind: "attack", damage: 6, playerPoison: 1 },
      swarmFold: { name: "蜂潮聚形", icon: "潮", kind: "charge", bonus: 3 },
    },
  },
  corpsepuppet: {
    name: "尸盘监守",
    title: "塔顶尸盘监守",
    maxHp: 108,
    isBoss: true,
    kicker: "尸盘转动，整座命途塔随之震颤",
    intro: "尸盘监守从腐朽王座上起身，胸腔蛊火照亮了塔顶尸盘的累累白骨。",
    caption: "尸盘镇塔 · 万蛊守门",
    actions: {
      corpseClaw: { name: "腐尸爪", icon: "尸", kind: "attack", damage: 10 },
      guFireBreath: { name: "蛊火吐息", icon: "火", kind: "attack", damage: 7, playerPoison: 2 },
      corpseCharge: { name: "尸盘蓄势", icon: "盘", kind: "charge", bonus: 7 },
    },
  },
/* ===== V0.9.6 第二层敌人定义（沿用现有 ENEMY_LIBRARY 结构：actions{kind,damage/bonus,playerPoison,hits,armor,lowHpExtra}、enrage、isElite/isBoss、phase2 由战斗对象承载） ===== */
/* ---- 瘴林路线（毒/持续伤害/削弱） ---- */
  rotleafGu: {
    name: "腐叶蛊虫", title: "瘴林杂蛊", maxHp: 58,
    kicker: "腐叶簌簌，毒涎滴阶",
    intro: "腐叶蛊虫蜷在烂叶堆中，背壳渗着青黑黏液，一动便有毒雾散开。",
    caption: "腐叶蛊虫 · 涎毒缠身",
    actions: {
      leafGnaw: { name: "腐叶啃噬", icon: "啃", kind: "attack", damage: 7, playerPoison: 2 },
      sporeSpray: { name: "孢毒喷吐", icon: "孢", kind: "attack", damage: 4, playerPoison: 3 },
      miasmaCoil: { name: "蓄瘴", icon: "瘴", kind: "charge", bonus: 5 },
    },
  },
  miasmaParasite: {
    name: "青瘴寄生", title: "附骨之瘴", maxHp: 60,
    kicker: "青瘴附骨，越缠越深",
    intro: "青瘴寄生半透的躯体里游着幽绿瘴气，专挑中毒者下口。",
    caption: "青瘴寄生 · 噬毒愈凶",
    actions: {
      latchBite: { name: "附骨咬", icon: "咬", kind: "attack", damage: 8, playerPoison: 1 },
      venomDrip: { name: "瘴息渗毒", icon: "渗", kind: "attack", damage: 5, playerPoison: 2, lowHpExtra: 4 },
      curlGuard: { name: "缩壳蓄瘴", icon: "壳", kind: "charge", bonus: 4, armor: 6 },
    },
  },
  poisonVineCorpse: {
    name: "毒藤尸", title: "藤缠腐尸", maxHp: 64,
    kicker: "毒藤穿尸，腐手拖泥",
    intro: "毒藤尸被瘴藤贯穿提起，半腐的拳头裹着倒刺毒藤砸来。",
    caption: "毒藤尸 · 藤击拖毒",
    actions: {
      vineSlam: { name: "毒藤重击", icon: "藤", kind: "attack", damage: 11, playerPoison: 1 },
      thornLash: { name: "倒刺连抽", icon: "刺", kind: "attack", damage: 4, hits: 2, playerPoison: 1 },
      rootBrace: { name: "扎根聚毒", icon: "根", kind: "charge", bonus: 6 },
    },
    enrage: { threshold: 0.4, attackBonus: 3, name: "藤毒暴走" },
  },
  miasmaLanternEliteGu: {
    name: "瘴林执灯者", title: "瘴林精英", maxHp: 92, isElite: true,
    kicker: "鬼灯引瘴，林深无路",
    intro: "瘴林执灯者提一盏青焰鬼灯缓步而来，灯过之处瘴气如潮翻涌。",
    caption: "瘴林执灯者 · 灯引万瘴",
    actions: {
      lanternStrike: { name: "灯杖横扫", icon: "杖", kind: "attack", damage: 12 },
      poisonTide: { name: "鬼灯引瘴", icon: "灯", kind: "attack", damage: 5, playerPoison: 4 },
      greenFlameCharge: { name: "青焰蓄瘴", icon: "焰", kind: "charge", bonus: 5, armor: 5 },
    },
    enrage: { threshold: 0.35, attackBonus: 4, name: "鬼灯狂瘴" },
  },
  miasmaMotherBoss: {
    name: "百瘴母蛊", title: "瘴林之主", maxHp: 124, isBoss: true,
    kicker: "百瘴归巢，林木尽腐",
    intro: "百瘴母蛊臃肿的腹囊里翻涌着上百种瘴毒，每一次蠕动都喷出新的毒雾。",
    caption: "百瘴母蛊 · 万毒同巢",
    actions: {
      maternalLash: { name: "母蛊拍击", icon: "拍", kind: "attack", damage: 9, playerPoison: 2 },
      hundredMiasma: { name: "百瘴喷涌", icon: "瘴", kind: "attack", damage: 5, playerPoison: 4 },
      broodCharge: { name: "孕瘴蓄势", icon: "孕", kind: "charge", bonus: 7 },
    },
    /* phase2「瘴母苏醒」改写见 getCurrentEnemyAction 扩展 */
  },
/* ---- 血沼路线（血道/自损/吸血/反噬） ---- */
  bloodLeechSwarm: {
    name: "血蛭群", title: "血沼蛭潮", maxHp: 56,
    kicker: "蛭群附身，吸血而肥",
    intro: "血蛭群从沼泥里成片涌出，吸饱血的躯体油亮发红。",
    caption: "血蛭群 · 附身吸血",
    actions: {
      leechBite: { name: "群蛭噬咬", icon: "蛭", kind: "attack", damage: 4, hits: 2, lifesteal: 4 },
      bloodGorge: { name: "饱血一吸", icon: "吸", kind: "attack", damage: 8, lifesteal: 6 },
      writhe: { name: "蠕动蓄势", icon: "蠕", kind: "charge", bonus: 5 },
    },
  },
  brokenMeridianGu: {
    name: "断脉蛊徒", title: "自戕血修", maxHp: 60,
    kicker: "自断经脉，以血换力",
    intro: "断脉蛊徒割开自己的腕脉，任血珠凝成赤刃，越是淌血出手越狠。",
    caption: "断脉蛊徒 · 自损换攻",
    actions: {
      bloodBladeThrow: { name: "血刃掷击", icon: "刃", kind: "attack", damage: 13, selfBleed: 5 },
      veinTap: { name: "引血加注", icon: "引", kind: "charge", bonus: 6, selfBleed: 4 },
      crimsonSlash: { name: "赤血斩", icon: "斩", kind: "attack", damage: 8, lowHpExtra: 5 },
    },
  },
  bloodMudGolem: {
    name: "血泥傀", title: "沼底血傀", maxHp: 66,
    kicker: "血泥成傀，越打越凝",
    intro: "血泥傀由凝结的血泥堆塑而成，受创的伤口会再吸沼血补回。",
    caption: "血泥傀 · 血泥自补",
    actions: {
      mudPound: { name: "血泥猛砸", icon: "砸", kind: "attack", damage: 11 },
      gather: { name: "凝泥固身", icon: "凝", kind: "charge", bonus: 5, armor: 8 },
      bloodMend: { name: "吸沼回血", icon: "愈", kind: "attack", damage: 6, lifesteal: 8 },
    },
    enrage: { threshold: 0.4, attackBonus: 3, name: "血泥暴凝" },
  },
  bloodRobePriestEliteGu: {
    name: "血衣祭蛊者", title: "血沼精英", maxHp: 96, isElite: true,
    kicker: "血衣加身，以命饲蛊",
    intro: "血衣祭蛊者披一件浸透鲜血的法袍，每一次挥洒都先割开自己。",
    caption: "血衣祭蛊者 · 血祭压迫",
    actions: {
      sacrificeStrike: { name: "血祭挥击", icon: "祭", kind: "attack", damage: 13, selfBleed: 6, lowHpExtra: 6 },
      sanguineWard: { name: "血衣护体", icon: "衣", kind: "charge", bonus: 5, armor: 6, lifesteal: 6 },
      crimsonRain: { name: "血雨连击", icon: "雨", kind: "attack", damage: 5, hits: 2 },
    },
    enrage: { threshold: 0.35, attackBonus: 4, name: "血祭狂涌" },
  },
  bloodRobeMotherBoss: {
    name: "血衣蛊母", title: "血沼之主", maxHp: 128, isBoss: true,
    kicker: "血衣覆世，血债同偿",
    intro: "血衣蛊母端坐于血池之上，周身血衣无风自动，越是搏杀她越亢奋。",
    caption: "血衣蛊母 · 血债血偿",
    actions: {
      robeLash: { name: "血衣绞击", icon: "绞", kind: "attack", damage: 10, lifesteal: 5 },
      bloodOffering: { name: "血祭重击", icon: "祭", kind: "attack", damage: 14, selfBleed: 6, lowHpExtra: 6 },
      crimsonGather: { name: "聚血蓄势", icon: "聚", kind: "charge", bonus: 7, lifesteal: 6 },
    },
    /* phase2「血衣覆身」改写见 getCurrentEnemyAction 扩展 */
  },
};

const NORMAL_ENEMY_IDS = ["shanxiao", "bloodwolf", "beeswarm", "rottenShanxiao", "redManeBloodwolf", "wildBeeTide"];

const MAP_NODE_DESCRIPTIONS = Object.freeze({
  battle: "凶影伏阶，胜后取蛊。",
  event: "异兆一闪，利害同来。",
  shop: "残灯开门，蛊石交易。",
  elite: "血煞盘踞，厚利藏险。",
  rest: "塔隙暂歇，只取一息。",
  boss: "尸盘镇塔，破之通关。",
});

const REST_NODE_NAMES = Object.freeze(["残灯小憩", "断井调息", "腐林避风", "塔隙养蛊"]);

const CHANCE_EVENTS = Object.freeze([
  {
    id: "dryWellMolt",
    name: "枯井遗蜕",
    story: "干裂井壁上挂着一层旧蜕，井底传来细密啃噬声。",
    options: [
      { label: "探井取蜕", detail: "失去 8 点生命，获得 1 张随机稀有蛊牌。", kind: "rareCard" },
      { label: "只取残蜕", detail: "获得 1 个虫蜕。", kind: "material", materialId: "insectMolt" },
      { label: "安全离开", detail: "不冒险，直接离开。", kind: "leave" },
    ],
  },
  {
    id: "brokenStele",
    name: "残碑悟道",
    story: "半截石碑刻着残缺蛊诀，碑缝中渗出微弱金光。",
    options: [
      { label: "强记杀诀", detail: "随机一张攻击蛊本局伤害 +3。", kind: "attackInsight" },
      { label: "抽取命丝", detail: "获得 1 个命丝。", kind: "material", materialId: "fateSilk" },
      { label: "调息片刻", detail: "恢复 10 点生命。", kind: "heal", amount: 10 },
    ],
  },
  {
    id: "restlessEgg",
    name: "蛊卵异动",
    story: "一枚无主蛊卵忽明忽暗，似乎在等新的血气孵化。",
    options: [
      { label: "以血温卵", detail: "获得 1 张随机蛊牌，但下一场战斗开始失去 4 点生命。", kind: "cardNextHurt" },
      { label: "卖给游商", detail: "获得 12 蛊石。", kind: "stones", amount: 12 },
      { label: "听残魂低语", detail: "失去 1 点寿元，获得 1 个残魂。", kind: "lifespanMaterial", materialId: "remnantSoul" },
    ],
  },
  {
    id: "bloodLantern",
    name: "血灯夜祭",
    story: "暗红灯火悬在塔梁下，灯芯像一条仍在抽动的血虫。",
    options: [
      { label: "献血点灯", detail: "失去 5 点生命，获得 1 个血砂和 1 个腐液。", kind: "bloodMaterials" },
      { label: "焚去旧蛊", detail: "移除 1 张随机基础卡。", kind: "removeBasic" },
      { label: "吞灯留煞", detail: "永久血煞上限 +1，但最大生命 -3。", kind: "bloodLimit" },
    ],
  },
  {
    id: "brokenBridgeCaravan",
    name: "断桥商队",
    story: "断桥边停着一支残破商队，货箱上爬满不知名的小蛊。",
    options: [
      { label: "以石换蛊", detail: "花费 10 蛊石，获得 1 张随机蛊牌。", kind: "buyRandomCard", cost: 10 },
      { label: "护送过桥", detail: "恢复 8 点生命。", kind: "heal", amount: 8 },
      { label: "抢夺残箱", detail: "获得 1 个随机材料；下一场战斗敌人攻击 +2。", kind: "stealMaterialEnemyBuff" },
    ],
  },
  {
    id: "bloodLotTemple",
    name: "枯庙血签",
    story: "枯庙里垂着三枚血签，签尾还在滴落温热血珠。",
    options: [
      { label: "抽血签", detail: "失去 4 点生命，获得 1 件普通遗物。", kind: "hurtRelic" },
      { label: "献寿问材", detail: "失去 1 点寿元，获得 2 个随机材料。", kind: "lifespanTwoMaterials" },
      { label: "不问神签", detail: "离开枯庙。", kind: "leave" },
    ],
  },
  {
    id: "guMasterRemains",
    name: "蛊师遗骸",
    story: "一具蛊师遗骸盘坐石阶，指骨仍按着一只未熄的小炉。",
    options: [
      { label: "焚去旧蛊", detail: "随机移除 1 张卡。", kind: "removeAnyCard" },
      { label: "借炉炼蛊", detail: "随机 1 张卡炼化 +1，但有 20% 概率反噬。", kind: "randomUpgradeBacklash" },
      { label: "取走蛊石", detail: "获得 8 蛊石。", kind: "stones", amount: 8 },
    ],
  },
  {
    id: "poisonPondReflection",
    name: "毒潭照影",
    story: "毒潭映出另一张脸，水面下有虫影把影子啃成碎片。",
    options: [
      { label: "收毒入匣", detail: "获得 1 张毒道卡。", kind: "poisonCard" },
      { label: "饮下毒影", detail: "下一场战斗开局失去 3 点生命，获得 1 个腐液。", kind: "poisonBloodResidue" },
      { label: "借潭调息", detail: "恢复 6 点生命。", kind: "heal", amount: 6 },
    ],
  },
]);

const RELICS = {
  jadeMarrow: {
    name: "寒玉髓", glyph: "玉", description: "最大生命 +8；入塔时恢复至上限。",
  },
  yuanCicada: {
    name: "纳元蝉", glyph: "蝉", description: "每回合基础真元由 3 提升至 4。",
  },
  boneCarapace: {
    name: "蜕骨甲", glyph: "骨", description: "每个回合开始时自动获得 3 点防御。",
  },
};

const ORDINARY_RELICS = Object.freeze({
  tailCutCharm: {
    name: "断尾符", glyph: "尾", tone: "jade",
    description: "每场战斗第一次生命低于 30% 时，恢复 8 点生命。",
  },
  bloodJadeCup: {
    name: "血玉盏", glyph: "盏", tone: "blood",
    description: "每当获得血煞时，恢复 1 点生命；每回合最多触发 2 次。",
  },
  greenPouchBug: {
    name: "青囊虫", glyph: "囊", tone: "poison",
    description: "每场战斗开始时，随机一张毒道蛊消耗 -1，本场战斗有效。",
  },
  fateCoin: {
    name: "命轨铜钱", glyph: "钱", tone: "gold",
    description: "命势圆满时，额外获得 1 点防御和 1 蛊石。",
  },
  shopContract: {
    name: "蛊坊残契", glyph: "契", tone: "gold",
    description: "蛊坊中第一次购买打 7 折，向下取整。",
  },
  furnaceAshSeal: {
    name: "炉灰印", glyph: "灰", tone: "soul",
    description: "每局第一次炼蛊反噬时，反噬代价减半。",
  },
});

const ORDINARY_RELIC_IDS = Object.freeze(Object.keys(ORDINARY_RELICS));

const REFINEMENTS = {
  yuanShell: { name: "养元蜕壳", glyph: "养", description: "立即恢复 18 点生命，但不超过最大生命。", effect: "heal" },
  bloodFragment: { name: "血纹残片", glyph: "血", description: "所有血道攻击蛊伤害 +3。", effect: "bloodDamage" },
  armorShell: { name: "玄甲蛊壳", glyph: "甲", description: "每场战斗开始时获得 5 点防御。", effect: "startArmor" },
};

const dom = {};
let game = null;
let runState = null;
let cardSerial = 0;
let bannerTimer = null;
let castTimer = null;
let enemyTurnTimer = null;
let cardUnlockTimer = null;
let mapNoticeTimer = null;
let mapTransitionTimer = null;
let battleLogs = [];
let journeyLogs = [];
let activeLogChannel = "battle";
let logsExpanded = { battle: false, journey: false };
const LOG_PREVIEW_COUNT = 6;
const MAX_BATTLE_LOGS = 100;
const EFFECT_STORAGE_KEY = "reverseGu.effects.enabled";
const TUTORIAL_STORAGE_KEY = "reverseGu.tutorial.seen";
const BATTLE_TIPS_STORAGE_KEY = "reverseGu.battleTips.seen";
const LORE_STORAGE_KEY = "reverseGu.lore.unlocked";
const LORE_SKIP_ANIMATION_STORAGE_KEY = "reverseGu.lore.skipAnimation";
const RECORDING_MODE_STORAGE_KEY = "reverseGu.recordingMode.enabled";
const TRIAL_MODE_STORAGE_KEY = "reverseGu.trial.mode";
const TRIAL_SEED_STORAGE_KEY = "reverseGu.trial.seedDraft";
const GAME_VERSION = "V0.9.6.2 开发者测试面板（preview）";
// TODO: 后续多幕路线扩展时继续抽象 finalNode / bossNode，避免固定四段流程继续扩散。
const MAX_ROUTE_STEP = 4;
const BOSS_ROUTE_STEP = 4;
const REST_ROUTE_STEP = 3;
const TRIAL_MODES = Object.freeze({
  normal: { id: "normal", name: "正常模式", brief: "随机路线、奖励与机缘。", note: "适合正常试玩。" },
  demo: { id: "demo", name: "录屏演示模式", brief: "路线更稳定，自动开启录屏模式。", note: "适合录制展示。" },
  balance: { id: "balance", name: "平衡测试模式", brief: "显示测试入口，可填种子复现路线。", note: "适合复制统计。" },
});
const MAX_EFFECT_NODES = 56;
const MAX_FLOAT_NODES = 36;
const animationClassTimers = new WeakMap();
let effectsEnabled = true;
let tutorialPageIndex = 0;
let tutorialAutoPrompted = false;
let pendingEliteNodeId = "";
let pendingShopRemoveCardId = "";
let trialMode = "normal";
let trialSeedDraft = "";

const KEYWORD_HELP = Object.freeze({
  真元: "催动蛊牌的资源；每回合开始恢复。",
  防御: "先抵挡伤害；敌方行动结束后清零。",
  寿元: "长期代价；部分强力蛊会消耗。",
  血煞: "血道爆发资源；会强化血道攻击。",
  毒性: "敌方回合结束时造成毒伤。",
  蚀毒: "敌人已中毒时再次施毒，追加伤害。",
  命势: "交替使用不同类型卡积累；满层回真元并抽牌。",
  炼化: "蛊牌强化为 +1 或 +2。",
  异变: "炼蛊中蛊性变化，变成新蛊。",
  反噬: "炼蛊失控产生代价。",
});

const TUTORIAL_PAGES = Object.freeze([
  {
    title: "选择蛊修",
    lines: [
      "无名逆命者：交替使用攻击、护甲、辅助，攒满命势后回真元并抽牌。",
      "绛妄：用生命换血煞，靠血道蛊打出爆发。",
      "青蟒：不断施毒，拖回合让毒性耗死敌人。",
    ],
  },
  {
    title: "战斗规则",
    lines: [
      "每回合真元恢复，点击手牌即可使用蛊牌。",
      "防御会先抵挡伤害，但敌方行动后会清零。",
      "敌人意图会提前显示：能守就守，能斩就抢。",
    ],
  },
  {
    title: "流派机制",
    lines: [
      "命势：不同类型卡交替出牌，满 3 层后真元 +1 并抽牌。",
      "血煞：血道资源，越高越利于爆发。",
      "毒性：敌方回合结束时结算；重复施毒会触发蚀毒。",
    ],
  },
  {
    title: "炼蛊规则",
    lines: [
      "普通战斗后可获得新蛊和炼蛊材料。",
      "材料入炉后会判定稳定炼化、蛊性异变或炼蛊反噬。",
      "稳定更可靠，异变更强也更难控，反噬会留下代价。",
    ],
  },
]);

const LORE_PAGES = Object.freeze([
  {
    id: "cost",
    title: "卷一：蛊生于代价",
    source: "古页显现：初入命途",
    hint: "初入命途时显现。",
    teaser: "第一声蛊鸣，生在将熄的寿灯里。",
    body: "传说最初之人跪在黑石前，割血三滴，断发一缕，又吹灭半盏寿灯。石缝里没有神声，只有细小虫鸣。那虫食血，衔发，伏在将熄的灯烟中成形。自此世人知晓，蛊不从天落，也不替人慈悲。凡欲改命，须先拿命中之物相喂。",
    quote: "蛊不是恩赐，蛊是代价开出的路。",
  },
  {
    id: "bloodStone",
    title: "卷二：血落黑石",
    source: "古页显现：第一次斩伏凶影",
    hint: "斩伏一次凶影后显现。",
    teaser: "黑石不言，却记得第一滴血的重量。",
    body: "黑石原本无名，只因第一滴血落下，才有了“命”的重量。最初之人不肯受天命束手，便把掌心按入石面。血不是祭品，乃是与命相争时最先交出的筹码。黑石不言，只将血收进深处，令后来者都看见一条暗红的缝。",
    quote: "血落黑石，人便开始与命交易。",
  },
  {
    id: "fiveMaterials",
    title: "卷三：五材入炉",
    source: "古页显现：第一次得五材",
    hint: "获得任意炼蛊材料后显现。",
    teaser: "五材不是物，是五种被折下的代价。",
    body: "五材并非炉边杂物。血砂取勇，使人敢以身入刃；虫蜕取躯，使旧壳让出新身；腐液取痛，使朽败也能啃穿坚物；命丝取机，使一念牵动万端；残魂取余念，使死者未尽之愿仍在火中低语。",
    quote: "五材入炉，五种代价同声。",
  },
  {
    id: "stableFire",
    title: "卷四：炉火稳定",
    source: "古页显现：第一次稳火成蛊",
    hint: "完成一次稳定炼化后显现。",
    teaser: "稳火最静，却也最会慢慢啃人。",
    body: "炉火稳定之时，最容易令人忘记火仍在吃人。蛊纹缓缓合拢，像伤口结痂，又像誓言落锁。炼者以为自己只是添了一分锋芒，却不知心血已被炉火细细称量。稳，并非无价，只是代价来得慢，来得轻，来得像习惯。",
    quote: "稳火不免代价，只让代价迟些开口。",
  },
  {
    id: "untamed",
    title: "卷五：蛊性不驯",
    source: "古页显现：第一次蛊性异变",
    hint: "经历一次炼蛊异变后显现。",
    teaser: "蛊会贴着欲望，长成别的形状。",
    body: "蛊不是死物，也不是听命的器具。它贴着人的欲望生长，见贪则生齿，见惧则生壳，见恨则染血，见求生便学会绕过旧形。所谓异变，并非炉火出错，而是藏在心底的念头得了虫身，在暗金火中第一次睁眼。",
    quote: "异变不是错误，是欲望现形。",
  },
  {
    id: "backlash",
    title: "卷六：反噬其主",
    source: "古页显现：第一次炉火逆冲",
    hint: "经历一次炼蛊反噬后显现。",
    teaser: "拖欠太久的代价，会沿命丝回头。",
    body: "人以为掌蛊，蛊亦在掌人。欠下的血会从伤口回来，拖延的寿会从灯芯折断，不肯认的残念会在炉底咬住手骨。反噬不是天罚，也非蛊虫无情。它只是代价被拖欠太久，终于沿着命丝找回主人。",
    quote: "反噬不是惩罚，是欠债归身。",
  },
  {
    id: "direGuard",
    title: "卷七：凶煞守路",
    source: "古页显现：第一次踏碎凶煞",
    hint: "击败一次凶煞守路者后显现。",
    teaser: "守路者多半不是妖，是未归的求命者。",
    body: "塔影深处的凶煞，未必皆生而为妖。古卷说，许多守路者曾披人皮，曾抱一盏寿灯，曾携蛊入塔求命。后来门未开，心先碎，蛊食其愿，塔收其名，只余执念盘踞阶前，替命途守住下一次失败。",
    quote: "守路凶煞，或是未归的求命者。",
  },
  {
    id: "unfinished",
    title: "卷八：命途未尽",
    source: "古页显现：第一次推开塔门",
    hint: "第一次推开命途塔尽头之门后显现。",
    teaser: "门开之后，仍会听见下一道锁响。",
    body: "有人以为门开即为尽头，古卷却说，门后仍有门。命途塔从不赐终局，只把人送到更深的黑处，使其听见另一道锁响。所谓逆命，不过是从旧命中脱身，又在新命前站定。能看见远处微灯者，仍须再问代价。",
    quote: "命途未尽，门后仍有门。",
  },
]);

const DEFAULT_LORE_ID = "cost";
let loreUnlockedIds = new Set();
let selectedLoreId = "";
let loreSkipAnimation = false;
let recordingModeEnabled = false;

function getBloodMax() {
  return BLOOD_MAX + Math.max(0, Number(runState?.bloodMaxBonus) || 0);
}

function safeStatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function createRunStats() {
  return {
    battleCount: 0,
    totalTurns: 0,
    battleTurns: [],
    battleSummaries: [],
    playerDamage: 0,
    enemyDamage: 0,
    armorGained: 0,
    healing: 0,
    poisonDamage: 0,
    bloodBonusDamage: 0,
    fateTriggers: 0,
    wineWormTriggers: 0,
    bossPoisonSuppressions: 0,
    bossPoisonSuppressedLayers: 0,
    bossHighestPoison: 0,
    bossPhase2Triggered: false,
    layer2Entered: false,
    layer2Route: "",
    layer2BossDefeated: false,
    stableRefines: 0,
    mutations: 0,
    backlashes: 0,
    cardsPlayed: 0,
    cardStats: {},
    bossTurns: 0,
    clearHp: 0,
    deathNode: "",
    deathEnemy: "",
  };
}

function createBattleStats(enemyDefinition, node) {
  return {
    enemyName: enemyDefinition?.name || "未知敌人",
    nodeType: node?.type || "battle",
    nodeName: node?.name || "",
    turns: 0,
    playerHp: 0,
    playerDamage: 0,
    enemyDamage: 0,
    armorGained: 0,
    healing: 0,
    poisonDamage: 0,
    cardsPlayed: 0,
    victory: false,
  };
}

function getRunStats() {
  if (!runState.runStats) runState.runStats = createRunStats();
  return runState.runStats;
}

function getCardStatKey(card) {
  const level = getUpgradeLevel(card);
  const status = [
    card.mutated ? "m" : "",
    card.damaged ? "d" : "",
    card.skewed ? "s" : "",
  ].filter(Boolean).join("");
  return `${card.instanceId || card.deckInstanceId || card.key}|${card.key}|${level}|${status}`;
}

function getCardStatLabel(card) {
  const status = getEntryStatusLabels(card);
  const suffix = status.length ? `【${status.join("·")}】` : "";
  const seal = getGuSeal(card);
  return `${getDisplayCardName(card.key, getUpgradeLevel(card))}${suffix}${seal ? ` · 蛊印${seal}` : ""}`;
}

function ensureCardStat(card, key = getCardStatKey(card)) {
  const stats = getRunStats();
  if (!stats.cardStats[key]) {
    stats.cardStats[key] = {
      key,
      name: getCardStatLabel(card),
      cardKey: card.key,
      upgradeLevel: getUpgradeLevel(card),
      mutated: Boolean(card.mutated),
      uses: 0,
      damage: 0,
      armor: 0,
      healing: 0,
      poisonApplied: 0,
      bloodBonusDamage: 0,
      fateGain: 0,
    };
  }
  return stats.cardStats[key];
}

function recordBattleStarted() {
  if (!runState || !game?.battleStats) return;
  const stats = getRunStats();
  stats.battleCount += 1;
  if (game.player.armor > 0) {
    recordArmorGained(game.player.armor);
  }
}

function recordCardPlayed(card) {
  const stats = getRunStats();
  const key = getCardStatKey(card);
  const cardStats = ensureCardStat(card, key);
  cardStats.uses += 1;
  stats.cardsPlayed += 1;
  if (game?.battleStats) game.battleStats.cardsPlayed += 1;
  return key;
}

function isActiveCardSource(sourceName) {
  if (!game?.activeCardContext) return false;
  return sourceName === game.activeCardContext.cardName || sourceName === game.activeCardContext.baseName;
}

function recordCardMetric(metric, amount, sourceName = "") {
  const value = safeStatNumber(amount);
  if (value <= 0 || !game?.activeCardContext) return;
  if (sourceName && !isActiveCardSource(sourceName)) return;
  const cardStats = ensureCardStat(game.activeCardContext.cardSnapshot, game.activeCardContext.cardStatsKey);
  cardStats[metric] = safeStatNumber(cardStats[metric]) + value;
}

function recordPlayerDamage(amount, { card = false } = {}) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.playerDamage += value;
  if (game?.battleStats) game.battleStats.playerDamage += value;
  if (card) recordCardMetric("damage", value);
}

function recordEnemyDamage(amount) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.enemyDamage += value;
  if (game?.battleStats) game.battleStats.enemyDamage += value;
}

function recordArmorGained(amount, sourceName = "") {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.armorGained += value;
  if (game?.battleStats) game.battleStats.armorGained += value;
  if (sourceName) recordCardMetric("armor", value, sourceName);
}

function recordHealing(amount, sourceName = "") {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.healing += value;
  if (game?.battleStats) game.battleStats.healing += value;
  if (sourceName) recordCardMetric("healing", value, sourceName);
}

function recordPoisonDamage(amount, { card = false } = {}) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.poisonDamage += value;
  if (game?.battleStats) game.battleStats.poisonDamage += value;
  recordPlayerDamage(value, { card });
}

function recordBloodBonusDamage(amount) {
  const value = safeStatNumber(amount);
  if (value <= 0 || !runState) return;
  const stats = getRunStats();
  stats.bloodBonusDamage += value;
  recordCardMetric("bloodBonusDamage", value);
}

function recordFateGain(amount) {
  recordCardMetric("fateGain", amount);
}

function extractBloodBonusFromDetail(detail, realDamage) {
  const match = String(detail || "").match(/(\d+)\s*层血煞(?:×(\d+))?/);
  if (!match) return 0;
  const layers = Number(match[1]) || 0;
  const multiplier = Number(match[2]) || 1;
  return Math.min(Math.max(0, layers * multiplier), Math.max(0, realDamage));
}

function recordBattleFinished(victory) {
  if (!runState || !game?.battleStats) return;
  const stats = getRunStats();
  const summary = {
    enemyName: game.enemy.definition.name,
    nodeType: runState.currentNode?.type || game.battleStats.nodeType || "battle",
    nodeName: runState.currentNode?.name || game.battleStats.nodeName || "",
    turns: game.turn,
    playerHp: game.player.hp,
    playerDamage: game.battleStats.playerDamage,
    enemyDamage: game.battleStats.enemyDamage,
    armorGained: game.battleStats.armorGained,
    healing: game.battleStats.healing,
    poisonDamage: game.battleStats.poisonDamage,
    cardsPlayed: game.battleStats.cardsPlayed,
    victory: Boolean(victory),
  };
  stats.totalTurns += game.turn;
  stats.battleTurns.push(game.turn);
  stats.battleSummaries.push(summary);
  if (runState.currentNode?.type === "boss" || game.enemy.definition.isBoss) {
    stats.bossTurns = game.turn;
  }
  if (victory && (runState.currentNode?.type === "boss" || game.enemy.definition.isBoss)) {
    stats.clearHp = game.player.hp;
  }
  if (!victory) {
    stats.deathNode = runState.currentNode?.name || `第 ${runState.currentRouteStep} 段`;
    stats.deathEnemy = game.enemy.definition.name;
  }
}

// progression 仅保存标题界面的选择；整局四段命途状态统一由 runState 管理。
const progression = {
  selectedHeroId: "fate",
  selectedRelicId: "jadeMarrow",
};

function cacheDom() {
  [
    "startScreen", "mobileOrientationOverlay", "mobileLogButton", "mobileAudioToggle", "mobileAudioClose", "heroChoices", "relicChoices", "advancedCardPreview", "startBattleButton", "runProgress", "trialModeHint",
    "tutorialOpenButton", "tutorialResetButton", "loreOpenButton", "trialSettingsButton", "settingsOpenButton", "recordingModeToggle", "tutorialOverlay", "tutorialCloseButton", "tutorialTitle", "tutorialBody",
    "balanceOpenButton", "balanceOverlay", "balanceCloseButton", "balanceSummary", "balanceCopyButton", "balanceCopyRunStatsButton",
    "tutorialPageText", "tutorialDots", "tutorialPrevButton", "tutorialNextButton", "tutorialSkipButton",
    "battleCoach", "battleCoachClose", "keywordTooltip",
    "mapScreen", "mapRoute", "mapHint", "mapDescription", "mapProgress", "mapStatus", "mapNotice", "mapTransition", "mapTransitionText", "mapGuStones", "mapDeckButton", "topGuStone",
    "deckViewButton", "resultDeckButton", "resultStatsButton", "resultLoreButton", "resultFeedbackButton", "feedbackCopyFallback", "deckOverlay", "deckCloseButton", "deckLoreButton", "deckStatsButton", "deckSummary", "deckStats", "deckMaterials", "deckRelics", "deckMarks", "deckList",
    "runStatsOverlay", "runStatsCloseButton", "runStatsSummary", "runStatsCopyButton",
    "fxLayer", "effectLayer", "audioControls", "effectToggle", "effectStatus", "turnBanner", "turnBannerKicker", "turnBannerText", "floorEyebrow", "towerProgress", "topRelicGlyph",
    "topRelicName", "turnNumber", "playerSideLabel", "playerTitle", "playerPortrait", "playerPortraitFallback", "playerPortraitImage",
    "playerPortraitCaption", "playerHp", "playerMaxHp", "playerHpBar", "playerEnergy",
    "playerArmor", "playerLifespan", "playerBlood", "buffList", "activeRelicGlyph",
    "activeRelicName", "enemySideLabel", "enemyTitle", "enemyHp", "enemyMaxHp", "enemyHpBar", "enemyPortrait",
    "intentBox", "intentIcon", "intentName", "intentDescription", "enemyPower", "enemyStatusList", "arenaKicker",
    "drawCount", "discardCount", "battleMessage", "endTurnButton", "endTurnHint", "logTitle", "logBattleTab", "logJourneyTab", "battleLog", "journeyLog", "clearLogButton", "logHistoryToggle",
    "hand", "castDisplay", "castGlyph", "castName", "resultOverlay", "resultSeal",
    "resultEyebrow", "resultTitle", "resultDescription", "resultTurns", "resultHp", "cardRewardPanel",
    "cardRewardChoices", "skipRewardButton", "materialRewardPanel", "materialRewardChoices", "skipMaterialButton", "refinePanel", "refineChoices", "runSummary",
    "furnacePanel", "furnaceMaterialList", "furnaceMaterialChoices", "furnaceChoices", "furnaceConfirm", "furnaceComplete", "furnaceSkipButton",
    "furnaceConfirmOriginal", "furnaceConfirmUpgraded", "furnaceRouteSummary", "confirmFurnaceButton", "backFurnaceButton",
    "eventPanel", "eventName", "eventStory", "eventChoices", "eventResult", "eliteConfirmPanel", "eliteConfirmButton", "eliteCancelButton",
    "shopPanel", "shopGuStones", "shopOverview", "shopCardChoices", "shopActions", "shopRemovePanel", "shopRemoveChoices", "shopRemoveConfirm", "shopRemoveConfirmText", "shopConfirmRemoveButton", "shopBackRemoveButton", "shopCancelRemoveButton",
    "loreOverlay", "loreCloseButton", "loreList", "loreProgress", "loreAnimationToggle", "loreResetButton",
    "trialSettingsOverlay", "trialSettingsCloseButton", "trialSettingsTitle", "trialModeChoices", "trialSeedInput", "trialSeedClearButton", "trialSettingsApplyButton",
    "settingsOverlay", "settingsCloseButton", "settingsTitle", "settingsVersion", "settingsMusicToggle", "settingsVolume", "settingsEffectToggle", "settingsRecordingToggle", "settingsLoreAnimationToggle", "settingsHomeButton", "settingsRestartButton", "settingsTutorialResetButton", "settingsLoreResetButton",
    "resultPrimaryButton", "resultSecondaryButton",
  ].forEach((id) => { dom[id] = document.getElementById(id); });
}

function getStoredFlag(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch (error) {
    console.warn("[本地设置读取失败]", key, error);
    return false;
  }
}

function setStoredFlag(key, value) {
  try {
    if (value) localStorage.setItem(key, "true");
    else localStorage.removeItem(key);
  } catch (error) {
    console.warn("[本地设置写入失败]", key, error);
  }
}

function getStoredText(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (error) {
    console.warn("[本地设置读取失败]", key, error);
    return fallback;
  }
}

function setStoredText(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch (error) {
    console.warn("[本地设置写入失败]", key, error);
  }
}

function refreshModalLock() {
  const hasModal = [dom.resultOverlay, dom.deckOverlay, dom.tutorialOverlay, dom.loreOverlay, dom.balanceOverlay, dom.runStatsOverlay, dom.trialSettingsOverlay, dom.settingsOverlay]
    .some((node) => node && !node.classList.contains("hidden"));
  document.body.classList.toggle("modal-open", hasModal);
  if (dom.mobileLogButton) updateMobileViewportState();
}

function isMobilePortraitPrompt() {
  return window.matchMedia?.("(max-width: 900px) and (orientation: portrait)")?.matches || false;
}

function isMobileLandscapePlay() {
  return window.matchMedia?.("(max-width: 1024px) and (max-height: 600px) and (orientation: landscape)")?.matches || false;
}

// 手机横屏安全布局判定：横屏 + 视口足够小（手机量级），桌面大屏不触发。
function isMobileLandscapeSafe() {
  const landscape = window.matchMedia
    ? window.matchMedia("(orientation: landscape)").matches
    : window.innerWidth > window.innerHeight;
  return landscape && window.innerHeight <= 650 && window.innerWidth <= 1100;
}

// 用真实可视高度驱动布局，避免手机浏览器地址栏占高导致的裁切/外层滚动。
function updateAppHeight() {
  const h = window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty("--app-height", `${h}px`);
}

function closeMobileLogPanel() {
  document.body.classList.remove("mobile-log-open");
  dom.mobileLogButton?.setAttribute("aria-expanded", "false");
}

function closeMobileAudioPanel() {
  document.body.classList.remove("mobile-audio-open");
  dom.mobileAudioToggle?.setAttribute("aria-expanded", "false");
}

function toggleMobileLogPanel() {
  const willOpen = !document.body.classList.contains("mobile-log-open");
  document.body.classList.toggle("mobile-log-open", willOpen);
  dom.mobileLogButton?.setAttribute("aria-expanded", String(willOpen));
}

function toggleMobileAudioPanel() {
  const willOpen = !document.body.classList.contains("mobile-audio-open");
  document.body.classList.toggle("mobile-audio-open", willOpen);
  dom.mobileAudioToggle?.setAttribute("aria-expanded", String(willOpen));
}

let intentHome = null;
// 战斗安全布局下把敌人意图框搬入中央舞台(.arena-panel)，离开时还原回原位。只移动节点、不改意图内容渲染。
function syncIntentPlacement(combatSafe) {
  const intent = document.getElementById("intentBox");
  if (!intent) return;
  const arena = document.querySelector(".arena-panel");
  if (combatSafe && arena) {
    if (intent.parentElement !== arena) {
      if (!intentHome) intentHome = { parent: intent.parentElement, next: intent.nextElementSibling };
      const endBtn = document.getElementById("endTurnButton");
      arena.insertBefore(intent, endBtn || null);
    }
  } else if (intentHome && intent.parentElement !== intentHome.parent) {
    intentHome.parent.insertBefore(intent, intentHome.next);
  }
}

function updateMobileViewportState() {
  updateAppHeight();
  const portraitPrompt = isMobilePortraitPrompt();
  const landscapePlay = isMobileLandscapePlay();
  const landscapeSafe = isMobileLandscapeSafe();
  const modalOpen = document.body.classList.contains("modal-open");
  const inActiveRun = !!dom.startScreen && dom.startScreen.classList.contains("hidden");
  const mapOpen = !!dom.mapScreen && !dom.mapScreen.classList.contains("hidden");
  // 战斗页安全布局：横屏手机 + 当前处于战斗（game 存在）。离开战斗 game 置空即自动移除。
  const combatSafe = landscapeSafe && !!game;
  // 极矮横屏（如部分手机全屏横屏 innerHeight<=430）再压一档氛围装饰，纯展示
  const compactLowHeight = landscapeSafe && window.innerHeight <= 430;
  const showLogButton = landscapePlay && inActiveRun && !mapOpen && !modalOpen;
  const showAudioButton = landscapePlay && !modalOpen;
  document.body.classList.toggle("mobile-portrait-lock", portraitPrompt);
  document.body.classList.toggle("mobile-landscape-play", landscapePlay);
  document.body.classList.toggle("mobile-landscape", landscapeSafe);
  document.body.classList.toggle("mobile-combat-safe", combatSafe);
  document.body.classList.toggle("compact-low-height", combatSafe && compactLowHeight);
  document.documentElement.classList.toggle("combat-lock-html", combatSafe);
  syncIntentPlacement(combatSafe);
  dom.mobileOrientationOverlay?.classList.toggle("hidden", !portraitPrompt);
  dom.mobileLogButton?.classList.toggle("hidden", !showLogButton);
  dom.mobileAudioToggle?.classList.toggle("hidden", !showAudioButton);
  if (!showLogButton) closeMobileLogPanel();
  if (!showAudioButton) closeMobileAudioPanel();
}

function readLoreUnlocks() {
  try {
    const raw = localStorage.getItem(LORE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => LORE_PAGES.some((page) => page.id === id)) : []);
  } catch (error) {
    console.warn("[残卷读取失败]", error);
    return new Set();
  }
}

function saveLoreUnlocks() {
  try {
    localStorage.setItem(LORE_STORAGE_KEY, JSON.stringify([...loreUnlockedIds]));
  } catch (error) {
    console.warn("[残卷保存失败]", error);
  }
}

function initLoreSystem() {
  loreUnlockedIds = readLoreUnlocks();
  loreSkipAnimation = getStoredFlag(LORE_SKIP_ANIMATION_STORAGE_KEY);
  unlockLorePage(DEFAULT_LORE_ID, { silent: true });
  updateLoreSettingControls();
}

function isLoreUnlocked(id) {
  return loreUnlockedIds.has(id);
}

function unlockLorePage(id, { silent = false } = {}) {
  const page = LORE_PAGES.find((item) => item.id === id);
  if (!page || loreUnlockedIds.has(id)) return false;
  loreUnlockedIds.add(id);
  saveLoreUnlocks();
  if (!silent) {
    addLog(`命蛊残卷新页已显：《${page.title}》`, "important");
    if (dom.loreOverlay && !dom.loreOverlay.classList.contains("hidden")) renderLoreOverlay();
  }
  return true;
}

function resetLoreUnlocks() {
  loreUnlockedIds = new Set();
  selectedLoreId = "";
  unlockLorePage(DEFAULT_LORE_ID, { silent: true });
  renderLoreOverlay();
  if (dom.runProgress) {
    dom.runProgress.textContent = "命蛊残卷解锁已重置。";
    dom.runProgress.classList.remove("hidden");
  }
}

function updateLoreSettingControls() {
  if (!dom.loreAnimationToggle) return;
  dom.loreAnimationToggle.textContent = `跳过残卷动画：${loreSkipAnimation ? "开" : "关"}`;
  dom.loreAnimationToggle.setAttribute("aria-pressed", String(loreSkipAnimation));
  if (dom.settingsLoreAnimationToggle) dom.settingsLoreAnimationToggle.textContent = `跳过残卷动画：${loreSkipAnimation ? "开" : "关"}`;
}

function toggleLoreAnimationSkip() {
  loreSkipAnimation = !loreSkipAnimation;
  setStoredFlag(LORE_SKIP_ANIMATION_STORAGE_KEY, loreSkipAnimation);
  updateLoreSettingControls();
  renderSettingsOverlay();
  renderLoreOverlay();
}

function initRecordingMode() {
  recordingModeEnabled = getStoredFlag(RECORDING_MODE_STORAGE_KEY);
  updateRecordingModeControls();
}

function updateRecordingModeControls() {
  document.body.classList.toggle("recording-mode", recordingModeEnabled);
  if (recordingModeEnabled) closeBalanceOverlay();
  if (!dom.recordingModeToggle) return;
  dom.recordingModeToggle.textContent = `录屏模式：${recordingModeEnabled ? "开" : "关"}`;
  dom.recordingModeToggle.setAttribute("aria-pressed", String(recordingModeEnabled));
  if (dom.settingsRecordingToggle) {
    dom.settingsRecordingToggle.textContent = `录屏模式：${recordingModeEnabled ? "开" : "关"}`;
    dom.settingsRecordingToggle.setAttribute("aria-pressed", String(recordingModeEnabled));
  }
}

function toggleRecordingMode() {
  recordingModeEnabled = !recordingModeEnabled;
  setStoredFlag(RECORDING_MODE_STORAGE_KEY, recordingModeEnabled);
  updateRecordingModeControls();
  updateTrialModeControls();
  renderSettingsOverlay();
  if (dom.runProgress) {
    dom.runProgress.textContent = recordingModeEnabled
      ? "录屏模式已开启：开发提示已隐藏。"
      : "录屏模式已关闭。";
    dom.runProgress.classList.remove("hidden");
  }
}

function normalizeTrialMode(mode) {
  return TRIAL_MODES[mode] ? mode : "normal";
}

function getTrialModeInfo(mode = trialMode) {
  return TRIAL_MODES[normalizeTrialMode(mode)] || TRIAL_MODES.normal;
}

function isDemoTrialMode() {
  return trialMode === "demo";
}

function isBalanceTrialMode() {
  return trialMode === "balance";
}

function normalizeTrialSeed(value = "") {
  const compact = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^MT/, "").slice(0, 4);
  return compact.length === 4 ? `MT-${compact}` : "";
}

function generateTrialSeed() {
  return `MT-${Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0")}`;
}

function seedToNumber(seed) {
  const text = normalizeTrialSeed(seed) || generateTrialSeed();
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seedToNumber(seed) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

function createRngChannel(seed, channel) {
  return {
    seed: `${normalizeTrialSeed(seed) || seed}-${channel}`,
    state: seedToNumber(`${normalizeTrialSeed(seed) || seed}-${channel}`) || 0x9e3779b9,
    uses: 0,
  };
}

function nextRngValue(channelState) {
  if (!channelState) return Math.random();
  let state = Number(channelState.state) || 0x9e3779b9;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  channelState.state = state >>> 0;
  channelState.uses = (Number(channelState.uses) || 0) + 1;
  return (channelState.state / 4294967296);
}

function createRunRngState(seed) {
  return {
    seed: normalizeTrialSeed(seed) || seed,
    channels: {
      route: createRngChannel(seed, "route"),
      enemyOrder: createRngChannel(seed, "enemy-order"),
      reward: createRngChannel(seed, "reward"),
      event: createRngChannel(seed, "event"),
      refine: createRngChannel(seed, "refine"),
      intent: createRngChannel(seed, "intent"),
    },
  };
}

function getRunRandom(channel = "route") {
  if (!runState?.rngState?.channels) return Math.random();
  if (!runState.rngState.channels[channel]) {
    runState.rngState.channels[channel] = createRngChannel(runState.trialSeed || generateTrialSeed(), channel);
  }
  return nextRngValue(runState.rngState.channels[channel]);
}

function setRecordingMode(value, { silent = false } = {}) {
  recordingModeEnabled = Boolean(value);
  setStoredFlag(RECORDING_MODE_STORAGE_KEY, recordingModeEnabled);
  updateRecordingModeControls();
  updateTrialModeControls();
  renderSettingsOverlay();
  if (!silent && dom.runProgress) {
    dom.runProgress.textContent = recordingModeEnabled ? "录屏模式已开启：开发提示已隐藏。" : "录屏模式已关闭。";
    dom.runProgress.classList.remove("hidden");
  }
}

function initTrialSettings() {
  trialMode = normalizeTrialMode(getStoredText(TRIAL_MODE_STORAGE_KEY, "normal"));
  trialSeedDraft = normalizeTrialSeed(getStoredText(TRIAL_SEED_STORAGE_KEY, ""));
  if (trialMode === "demo") setStoredFlag(RECORDING_MODE_STORAGE_KEY, true);
  updateTrialModeControls();
}

function setTrialMode(mode, { silent = false } = {}) {
  trialMode = normalizeTrialMode(mode);
  setStoredText(TRIAL_MODE_STORAGE_KEY, trialMode);
  if (trialMode === "demo") setRecordingMode(true, { silent: true });
  if (trialMode === "normal" || trialMode === "balance") setRecordingMode(false, { silent: true });
  updateTrialModeControls();
  renderTrialSettingsOverlay();
  if (!silent && dom.runProgress) {
    dom.runProgress.textContent = `${getTrialModeInfo().name}已保存，将从下一局开始生效。`;
    dom.runProgress.classList.remove("hidden");
  }
}

function getSeedForNextRun() {
  const savedSeed = isBalanceTrialMode() ? normalizeTrialSeed(trialSeedDraft) : "";
  return savedSeed || generateTrialSeed();
}

function updateTrialModeControls() {
  const info = getTrialModeInfo();
  document.body.classList.toggle("trial-mode-demo", trialMode === "demo");
  document.body.classList.toggle("trial-mode-balance", trialMode === "balance");
  document.body.dataset.trialMode = trialMode;
  if (dom.trialModeHint) {
    if (trialMode === "demo") {
      dom.trialModeHint.textContent = "录屏演示模式已开启：路线更适合展示。";
      dom.trialModeHint.classList.remove("hidden");
    } else if (trialMode === "balance") {
      dom.trialModeHint.textContent = `平衡测试模式：${trialSeedDraft ? `下局使用 ${trialSeedDraft}` : "下局会生成可复现种子"}。`;
      dom.trialModeHint.classList.remove("hidden");
    } else {
      dom.trialModeHint.classList.add("hidden");
    }
  }
  if (dom.balanceOpenButton) {
    const showBalance = trialMode === "balance" && !recordingModeEnabled;
    dom.balanceOpenButton.classList.toggle("hidden", !showBalance);
  }
  if (dom.trialSettingsButton) dom.trialSettingsButton.title = `当前：${info.name}`;
}

function renderTrialSettingsOverlay() {
  if (!dom.trialModeChoices) return;
  dom.trialModeChoices.innerHTML = Object.values(TRIAL_MODES).map((mode) => `
    <button class="trial-mode-card ${trialMode === mode.id ? "selected" : ""}" type="button" data-trial-mode="${mode.id}" aria-pressed="${trialMode === mode.id}">
      <strong>${mode.name}</strong>
      <span>${mode.brief}</span>
      <small>${mode.note}</small>
    </button>
  `).join("");
  if (dom.trialSeedInput) {
    dom.trialSeedInput.value = trialSeedDraft;
    dom.trialSeedInput.disabled = trialMode !== "balance";
    dom.trialSeedInput.placeholder = trialMode === "balance" ? "如 MT-7F3A" : "仅平衡测试模式使用";
  }
}

function openTrialSettingsOverlay() {
  if (!dom.trialSettingsOverlay) return;
  closeSettingsOverlay();
  renderTrialSettingsOverlay();
  dom.trialSettingsOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeTrialSettingsOverlay() {
  dom.trialSettingsOverlay?.classList.add("hidden");
  refreshModalLock();
}

function saveTrialSeedDraft(value) {
  trialSeedDraft = normalizeTrialSeed(value);
  setStoredText(TRIAL_SEED_STORAGE_KEY, trialSeedDraft);
  updateTrialModeControls();
  renderTrialSettingsOverlay();
}

function renderSettingsOverlay() {
  if (!dom.settingsOverlay) return;
  const audioState = window.AudioManager?.getState?.();
  if (dom.settingsVersion) {
    const cls = document.body.classList;
    dom.settingsVersion.textContent = [
      `当前版本：${GAME_VERSION}`,
      `build：${window.__NMG_BUILD__ ?? "-"}`,
      `视口：${window.innerWidth}×${window.innerHeight}`,
      `mobile-landscape：${cls.contains("mobile-landscape") ? "是" : "否"}`,
      `mobile-combat-safe：${cls.contains("mobile-combat-safe") ? "是" : "否"}`,
      `compact-low-height：${cls.contains("compact-low-height") ? "是" : "否"}`,
      `音频：${audioState ? `${audioState.muted ? "静音" : "开"} 音量${audioState.volume}` : "未就绪"}`,
    ].join(" · ");
  }
  if (dom.settingsMusicToggle) dom.settingsMusicToggle.textContent = `音乐：${audioState?.muted ? "关" : "开"}`;
  if (dom.settingsVolume && audioState) dom.settingsVolume.value = String(audioState.volume);
  if (dom.settingsEffectToggle) dom.settingsEffectToggle.textContent = `战斗特效：${effectsEnabled ? "开" : "关"}`;
  if (dom.settingsRecordingToggle) {
    dom.settingsRecordingToggle.textContent = `录屏模式：${recordingModeEnabled ? "开" : "关"}`;
    dom.settingsRecordingToggle.setAttribute("aria-pressed", String(recordingModeEnabled));
  }
  if (dom.settingsLoreAnimationToggle) dom.settingsLoreAnimationToggle.textContent = `跳过残卷动画：${loreSkipAnimation ? "开" : "关"}`;
  dom.settingsOverlay.classList.toggle("recording-clean", recordingModeEnabled);
}

function openSettingsOverlay() {
  if (!dom.settingsOverlay) return;
  closeTrialSettingsOverlay();
  renderSettingsOverlay();
  dom.settingsOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeSettingsOverlay() {
  dom.settingsOverlay?.classList.add("hidden");
  refreshModalLock();
}

function confirmReturnToTitle() {
  const message = "当前试炼进度将不会继续，确定返回首页吗？";
  if (!window.confirm(message)) return;
  playUiSfx();
  closeSettingsOverlay();
  resetRunToTitle();
}

function confirmRestartRun() {
  const message = "将重新开始一局，确定吗？";
  if (!window.confirm(message)) return;
  playUiSfx();
  closeSettingsOverlay();
  clearCombatEffects();
  hideRewardPanels();
  dom.resultOverlay?.classList.add("hidden");
  dom.deckOverlay?.classList.add("hidden");
  dom.runStatsOverlay?.classList.add("hidden");
  dom.loreOverlay?.classList.add("hidden");
  startNewRun();
}

function keywordAttr(keyword) {
  const text = KEYWORD_HELP[keyword];
  return text ? ` data-keyword="${keyword}" aria-label="${escapeAttribute(`${keyword}：${text}`)}"` : "";
}

function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sample(items, count, random = Math.random) {
  return shuffle(items, random).slice(0, count);
}

function getUpgradeLevel(cardOrEntry) {
  return Math.min(2, Math.max(0, Number(cardOrEntry?.upgradeLevel) || 0));
}

function getDisplayCardName(key, upgradeLevel = 0) {
  const base = CARD_LIBRARY[key]?.name || key;
  return upgradeLevel > 0 ? `${base} +${upgradeLevel}` : base;
}

function createDeckEntry(key) {
  cardSerial += 1;
  return {
    key,
    originalKey: key,
    instanceId: `deck-card-${cardSerial}`,
    upgradeLevel: 0,
    mutated: false,
    damaged: false,
    skewed: false,
    costPenalty: 0,
  };
}

function syncRunDeckKeys() {
  if (!runState?.deckCards) return;
  runState.deckKeys = runState.deckCards.map((card) => card.key);
}

function addRunDeckCard(key) {
  const entry = createDeckEntry(key);
  runState.deckCards.push(entry);
  syncRunDeckKeys();
  markGuDiscovered(key);
  return entry;
}

function hasOrdinaryRelic(id) {
  return Boolean(runState?.ordinaryRelics?.includes(id));
}

function gainOrdinaryRelic(id, sourceName = "命途所得") {
  if (!runState || !ORDINARY_RELICS[id] || hasOrdinaryRelic(id)) return null;
  runState.ordinaryRelics.push(id);
  runState.relicHistory.push(id);
  const relic = ORDINARY_RELICS[id];
  addLog(`${sourceName}：获得遗物「${relic.name}」——${relic.description}`, "positive-log");
  return id;
}

function gainRandomOrdinaryRelic(sourceName = "命途所得") {
  const available = ORDINARY_RELIC_IDS.filter((id) => !hasOrdinaryRelic(id));
  if (!available.length) return null;
  return gainOrdinaryRelic(sample(available, 1)[0], sourceName);
}

function getRandomPoisonCardKey() {
  const pool = [
    "greenMiasma", "insectSwarm", "moltingShell", "poisonReturn",
    "armorMeltPoison", "mutantPoison",
  ].filter((key) => CARD_LIBRARY[key]);
  return sample(pool, 1)[0] || "armorMeltPoison";
}

function removeRandomDeckCard() {
  // TODO: 事件结果随机待接入统一 RNG。
  if (!runState || runState.deckCards.length <= 6) return null;
  const index = Math.floor(Math.random() * runState.deckCards.length);
  const [removed] = runState.deckCards.splice(index, 1);
  syncRunDeckKeys();
  return removed || null;
}

function getSkewPenaltyText(cardOrEntry) {
  const key = cardOrEntry?.key;
  const definition = CARD_LIBRARY[key] || {};
  if (definition.category === "attack") return "偏斜：使用后失去 1 点生命";
  if (definition.category === "defense") return "偏斜：使用后弃 1 张随机手牌";
  if (definition.type === "poison" || definition.typeName?.includes("毒道")) return "偏斜：使用后失去 1 点生命";
  return "偏斜：使用后失去 1 点寿元";
}

function getEntryStatusLabels(entryOrCard) {
  const labels = [];
  if (entryOrCard?.mutated) labels.push("异变");
  if (entryOrCard?.damaged) labels.push("受损");
  if (entryOrCard?.skewed) labels.push("偏斜");
  return labels;
}

function getCardEffectForEntry(entry) {
  const notes = [];
  if (entry?.damageBonus > 0) notes.push(`悟道：本局伤害 +${entry.damageBonus}`);
  if (entry?.damaged && entry.costPenalty > 0) notes.push(`受损：本局消耗 +${entry.costPenalty}`);
  if (entry?.skewed) notes.push(getSkewPenaltyText(entry));
  const baseEffect = getCardEffect(entry.key, getUpgradeLevel(entry));
  return notes.length ? `${baseEffect}<br><small>${notes.join("；")}</small>` : baseEffect;
}

function withChinesePeriod(textOrHtml) {
  const content = String(textOrHtml || "").trim();
  if (!content) return "";
  const plain = stripTags(content).trim();
  return /[。！？]$/.test(plain) ? content : `${content}。`;
}

function getRefineText(level) {
  const value = getUpgradeLevel({ upgradeLevel: level });
  return value > 0 ? `+${value}` : "未炼化";
}

function getCardNatureText(entryOrCard) {
  const labels = getEntryStatusLabels(entryOrCard);
  return labels.length ? labels.join(" / ") : "稳定";
}

function getCardTypeDisplay(cardDefinition = {}) {
  const typeName = cardDefinition.typeName || "";
  if (cardDefinition.type === "blood" || typeName.includes("血道")) return "血道蛊";
  if (cardDefinition.type === "poison" || typeName.includes("毒道")) return "毒道蛊";
  if (cardDefinition.type === "fate") return "命势蛊";
  if (cardDefinition.category === "defense") return "护甲蛊";
  if (cardDefinition.category === "attack") return "攻击蛊";
  return "辅助蛊";
}

function getCardTitle(entryOrCard, { states = true } = {}) {
  const level = getUpgradeLevel(entryOrCard);
  const key = entryOrCard?.key;
  const title = getDisplayCardName(key, level);
  const labels = states ? getEntryStatusLabels(entryOrCard) : [];
  return labels.length ? `${title}${labels.map((label) => `【${label}】`).join("")}` : title;
}

function getCompactCardTitle(entryOrCard) {
  const base = CARD_LIBRARY[entryOrCard?.key]?.name || entryOrCard?.key || "未知蛊牌";
  const level = getUpgradeLevel(entryOrCard);
  return level > 0 ? `${base}+${level}` : base;
}

function getPrimaryDeckBadge(entryOrCard) {
  const level = getUpgradeLevel(entryOrCard);
  if (entryOrCard?.damaged) return { text: "受损", className: "badge-damaged" };
  if (entryOrCard?.skewed) return { text: "偏斜", className: "badge-skewed" };
  if (entryOrCard?.mutated) return { text: "异变", className: "badge-mutated" };
  if (level > 0) return { text: `+${level}`, className: "badge-upgrade" };
  return { text: "未炼化", className: "badge-unrefined" };
}

function getDeckEntryCost(entry) {
  const definition = CARD_LIBRARY[entry.key] || {};
  const upgradedCost = entry.key === "wineWorm" && getUpgradeLevel(entry) >= 2 ? 0 : definition.cost || 0;
  return upgradedCost + Math.max(0, Number(entry.costPenalty) || 0);
}

function getGuSeal(entry) {
  const deck = runState?.deckCards || [];
  const speciesKey = entry.originalKey || entry.key;
  const siblings = deck.filter((item) => (item.originalKey || item.key) === speciesKey);
  if (siblings.length <= 1) return "";
  const index = siblings.findIndex((item) => item.instanceId === entry.instanceId);
  if (index < 0) return "";
  const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const numerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const stem = stems[Math.floor(index / numerals.length)] || "癸";
  const numeral = numerals[index % numerals.length] || String(index + 1);
  return `${stem}${numeral}`;
}

function renderCardStateBadges(entryOrCard, { includeUnrefined = false } = {}) {
  const level = getUpgradeLevel(entryOrCard);
  const badges = [];
  if (level > 0) badges.push(`<i class="badge-upgrade"${keywordAttr("炼化")}>+${level}</i>`);
  else if (includeUnrefined) badges.push(`<i class="badge-unrefined"${keywordAttr("炼化")}>未炼化</i>`);
  if (entryOrCard?.mutated) badges.push(`<i class="badge-mutated"${keywordAttr("异变")}>异变</i>`);
  if (entryOrCard?.damaged) badges.push(`<i class="badge-damaged"${keywordAttr("反噬")}>受损</i>`);
  if (entryOrCard?.skewed) badges.push(`<i class="badge-skewed"${keywordAttr("反噬")}>偏斜</i>`);
  return badges.length ? `<div class="deck-state-badges">${badges.join("")}</div>` : "";
}

function renderCardInfoRows(entry, { includeSeal = true, includeOrigin = true } = {}) {
  const definition = CARD_LIBRARY[entry.key] || {};
  const originalDefinition = CARD_LIBRARY[entry.originalKey || entry.key];
  const seal = includeSeal ? getGuSeal(entry) : "";
  const rows = [
    ["品阶", "一转蛊"],
    ["类型", getCardTypeDisplay(definition)],
    ["消耗", `${getDeckEntryCost(entry)} 真元`],
    ["炼化", getRefineText(getUpgradeLevel(entry))],
    ["蛊性", getCardNatureText(entry)],
  ];
  if (includeOrigin && (entry.originalKey || entry.key) !== entry.key) {
    rows.push(["源蛊", originalDefinition?.name || "旧蛊"]);
  }
  if (seal) rows.push(["蛊印", seal]);
  return `<dl class="deck-card-info">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}

function renderCompactDeckMeta(entry) {
  const definition = CARD_LIBRARY[entry.key] || {};
  const seal = getGuSeal(entry);
  const nature = `蛊性：${getCardNatureText(entry)}`;
  const sealText = seal ? ` · 蛊印：${seal}` : "";
  return `<div class="deck-card-meta">一转蛊 · ${getCardTypeDisplay(definition)} · ${getDeckEntryCost(entry)} 真元</div>
    <div class="deck-card-submeta">${nature}${sealText}</div>`;
}

function createCardFromDeckEntry(entry) {
  const base = CARD_LIBRARY[entry.key];
  const upgradeLevel = getUpgradeLevel(entry);
  const costPenalty = Math.max(0, Number(entry.costPenalty) || 0);
  const cost = getDeckEntryCost(entry);
  return {
    ...base,
    key: entry.key,
    originalKey: entry.originalKey || entry.key,
    baseName: base.name,
    name: getDisplayCardName(entry.key, upgradeLevel),
    cost,
    printedCost: base.cost,
    costPenalty,
    effect: getCardEffectForEntry(entry),
    upgradeLevel,
    upgradeConfig: CARD_UPGRADE_CONFIG[entry.key] || getDefaultUpgradeConfig(base),
    instanceId: entry.instanceId,
    deckInstanceId: entry.instanceId,
    damageBonus: Math.max(0, Number(entry.damageBonus) || 0),
    mutated: Boolean(entry.mutated),
    mutationMaterialId: entry.mutationMaterialId || "",
    damaged: Boolean(entry.damaged),
    skewed: Boolean(entry.skewed),
  };
}

function createCard(key) {
  return createCardFromDeckEntry(createDeckEntry(key));
}

function buildStarterDeckKeys(heroId = progression.selectedHeroId) {
  const keys = [...(HERO_STARTER_DECKS[heroId] || HERO_STARTER_DECKS.fate)];
  return { keys, advancedKeys: HERO_EXCLUSIVE_CARD_KEYS[heroId] || [] };
}

function getDefaultUpgradeConfig(cardDefinition) {
  if (cardDefinition?.category === "defense") return { rule: "默认护甲卡：基础防御每级 +4" };
  if (cardDefinition?.category === "attack") return { rule: "默认攻击卡：基础伤害每级 +4" };
  return { rule: "默认辅助卡：每级提高主要数值 1 点" };
}

function getCardValues(cardOrKey, forcedLevel = null) {
  const key = typeof cardOrKey === "string" ? cardOrKey : cardOrKey.key;
  const level = forcedLevel === null ? getUpgradeLevel(cardOrKey) : getUpgradeLevel({ upgradeLevel: forcedLevel });
  const mutationLevel = Math.max(1, level);
  const mutationBoost = Math.max(0, mutationLevel - 1);
  switch (key) {
    case "moonBlade": return { damage: 6 + level * 4 };
    case "ironSkin": return { armor: 7 + level * 4 };
    case "wineWorm": return { draw: level >= 1 ? 1 : 0, cost: level >= 2 ? 0 : 1 };
    case "bloodBlade": return { selfDamage: 3, damage: 13 + level * 4, bloodGain: 1 };
    case "burningEssence": return { selfDamage: 2, energy: 1 + level };
    case "heartEater": return { damage: 12 + level * 4, empoweredDamage: 20 + level * 4 };
    case "bloodReversal": return { selfDamage: 5, damage: 16 + level * 4, bloodMultiplier: 2 + level, bloodGain: 1 };
    case "bloodTide": return { damage: 5 + level * 4, bloodMultiplier: 3 + level };
    case "lifeFlame": return { lifespanCost: 1, damage: 10 + level * 4 };
    case "witheredBloom": return { lifespanCost: 2, heal: 10 + level * 4 };
    case "essenceGathering": return { energy: 2 + (level >= 2 ? 1 : 0), draw: 1 + (level >= 1 ? 1 : 0) };
    case "mysticCarapace": return { armor: 16 + level * 4 };
    case "returnLife": return { bloodCost: 3, heal: 16 + level * 5 };
    case "swarmBite": return { damage: 4 + level * 4, perPlayed: 3 + level };
    case "meridianShift": return { selfDamage: 3, draw: 2 + level };
    case "armorBreaker": return { damage: 5 + level * 4, armorBonus: 6 + level * 2 };
    case "yuanReturn": return { energy: 1 + (level >= 2 ? 1 : 0), supportDraw: 1 + (level >= 1 ? 1 : 0) };
    case "shellRemnant": return { armor: 6 + level * 4, hurtArmor: 6 + level * 2 };
    case "guFeeding": return { draw: 2 + level, discard: 1 };
    case "soulCrack": return { damage: 18 + level * 4, lifespanCost: 1 };
    case "armorMeltPoison": return { damage: 3 + level * 2, poison: 3 + level, armorRemove: 5 + level * 2 };
    case "bloodRobe": return { selfDamage: 2, armor: 12 + level * 4, bloodGain: 1 + (level >= 2 ? 1 : 0) };
    case "lifeLamp": return { fateGain: 1 + (level >= 2 ? 1 : 0), heal: 4 + level * 2 };
    case "fateThread": return { damage: 8 + level * 4, fateBonus: 6 + level * 2 };
    case "reversePath": return { armor: 3 + level * 3, fateGain: 1 + (level >= 2 ? 1 : 0) };
    case "fixedFate": return { armor: 9 + level * 4, conditionArmor: 3 + level * 2 };
    case "bloodSacrifice": return { selfDamage: 3, bloodGain: 2 + (level >= 2 ? 1 : 0), draw: 1 + (level >= 1 ? 1 : 0) };
    case "bloodThirst": return { damage: 7 + level * 4, bloodMultiplier: 1 + (level >= 2 ? 1 : 0), heal: 3 + level };
    case "greenMiasma": return { poison: 4 + level * 2 };
    case "insectSwarm": return { damage: 4 + level * 2, poison: 4 + level };
    case "moltingShell": return { armor: 8 + level * 4, draw: 1 + (level >= 2 ? 1 : 0) };
    case "poisonReturn": return { damage: 6 + level * 3, poisonBonus: 8 + level * 3, poisonThreshold: 8 };
    case "bloodMoon": return { selfDamage: 2, damage: 12 + mutationBoost * 4, bloodMultiplier: 1 };
    case "moltedArmor": return { armor: 9 + mutationBoost * 4, draw: 1 };
    case "rotMiasma": return { poison: 6 + mutationBoost * 2, forceCorrosion: true };
    case "fateSever": return { fateGain: 1, draw: 1, lifespanCost: 1, energy: mutationLevel >= 2 ? 1 : 0 };
    case "leechBlade": return { selfDamage: 4, damage: 15 + mutationBoost * 4, healRate: 0.2, minHeal: 2 };
    case "drunkFateWorm": return { draw: mutationLevel >= 2 ? 2 : 1 };
    case "soulBurn": return { selfDamage: 3, energy: 2 + (mutationLevel >= 2 ? 1 : 0), costReduction: 1 };
    case "mutantBlade": return { selfDamage: 2, damage: 14 + mutationBoost * 4 };
    case "mutantArmor": return { armor: 14 + mutationBoost * 4, discard: 1 };
    case "mutantPoison": return { selfDamage: 2, poison: 9 + mutationBoost * 2 };
    case "mutantFate": return { energy: 2, draw: 1 + (mutationLevel >= 2 ? 1 : 0), lifespanCost: 1 };
    default: {
      const definition = CARD_LIBRARY[key] || {};
      if (definition.category === "defense") return { armor: 4 * level };
      if (definition.category === "attack") return { damage: 4 * level };
      return { utilityBonus: level };
    }
  }
}

function getCardEffect(key, upgradeLevel = 0) {
  const v = getCardValues(key, upgradeLevel);
  switch (key) {
    case "moonBlade": return `对敌人造成 <em>${v.damage}</em> 点伤害`;
    case "ironSkin": return `获得 <em>${v.armor}</em> 点防御`;
    case "wineWorm": {
      const drawText = v.draw > 0 ? `，并抽 <em>${v.draw}</em> 张牌` : "";
      return `下一张攻击蛊的伤害<em>翻倍</em>${drawText}`;
    }
    case "bloodBlade": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage} + 当前血煞</em> 点伤害，获得 <em>${v.bloodGain}</em> 层血煞`;
    case "burningEssence": return `获得 <em>${v.energy}</em> 点真元，但失去 <em>${v.selfDamage}</em> 点生命`;
    case "heartEater": return `造成 <em>${v.damage}</em> 点伤害；血煞不少于 2 层时改为 <em>${v.empoweredDamage}</em>`;
    case "bloodReversal": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage} + 血煞×${v.bloodMultiplier}</em> 点伤害，获得 <em>${v.bloodGain}</em> 层血煞`;
    case "bloodTide": return `造成 <em>${v.damage} + 血煞×${v.bloodMultiplier}</em> 点伤害`;
    case "lifeFlame": return `消耗 <em>${v.lifespanCost}</em> 寿元，造成 <em>${v.damage}</em> 点伤害`;
    case "witheredBloom": return `消耗 <em>${v.lifespanCost}</em> 寿元，恢复 <em>${v.heal}</em> 点生命`;
    case "essenceGathering": return `获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌`;
    case "mysticCarapace": return `获得 <em>${v.armor}</em> 点防御`;
    case "returnLife": return `消耗 <em>${v.bloodCost}</em> 层血煞，恢复 <em>${v.heal}</em> 点生命`;
    case "swarmBite": return `造成 <em>${v.damage}</em> 点伤害；本回合此前每出 1 张牌，追加 <em>${v.perPlayed}</em>`;
    case "meridianShift": return `失去 <em>${v.selfDamage}</em> 点生命，抽 <em>${v.draw}</em> 张牌`;
    case "armorBreaker": return `造成 <em>${v.damage}</em> 点伤害；若敌人有防御，额外造成 <em>${v.armorBonus}</em> 点伤害`;
    case "yuanReturn": return `获得 <em>${v.energy}</em> 点真元；本回合下一张辅助蛊抽 <em>${v.supportDraw}</em> 张牌`;
    case "shellRemnant": return `获得 <em>${v.armor}</em> 点防御；若本回合已受伤，额外获得 <em>${v.hurtArmor}</em> 点防御`;
    case "guFeeding": return `抽 <em>${v.draw}</em> 张牌，然后弃 <em>${v.discard}</em> 张牌`;
    case "soulCrack": return `造成 <em>${v.damage}</em> 点伤害；失去 <em>${v.lifespanCost}</em> 点寿元`;
    case "armorMeltPoison": return `造成 <em>${v.damage}</em> 点伤害，施加 <em>${v.poison}</em> 层毒性；若敌人有防御，移除其 <em>${v.armorRemove}</em> 点防御`;
    case "bloodRobe": return `失去 <em>${v.selfDamage}</em> 点生命，获得 <em>${v.armor}</em> 点防御，并获得 <em>${v.bloodGain}</em> 层血煞`;
    case "lifeLamp": return `获得 <em>${v.fateGain}</em> 层命势；若命势已满，恢复 <em>${v.heal}</em> 点生命`;
    case "fateThread": return `造成 <em>${v.damage}</em> 点伤害；若命势不少于 <em>2</em> 层，额外造成 <em>${v.fateBonus}</em> 点伤害`;
    case "reversePath": return `获得 <em>${v.armor}</em> 点防御，并获得 <em>${v.fateGain}</em> 层命势`;
    case "fixedFate": return `获得 <em>${v.armor}</em> 点防御；若本回合上一张牌不是护甲蛊，额外获得 <em>${v.conditionArmor}</em> 点防御`;
    case "bloodSacrifice": return `失去 <em>${v.selfDamage}</em> 点生命，获得 <em>${v.bloodGain}</em> 层血煞，抽 <em>${v.draw}</em> 张牌`;
    case "bloodThirst": return `造成 <em>${v.damage} + 当前血煞${v.bloodMultiplier > 1 ? `×${v.bloodMultiplier}` : ""}</em> 点伤害；恢复 <em>${v.heal}</em> 点生命`;
    case "greenMiasma": return `施加 <em>${v.poison}</em> 层毒性`;
    case "insectSwarm": return `造成 <em>${v.damage}</em> 点伤害，并施加 <em>${v.poison}</em> 层毒性`;
    case "moltingShell": return `获得 <em>${v.armor}</em> 点防御；若敌人已中毒，抽 <em>${v.draw}</em> 张牌`;
    case "poisonReturn": return `造成 <em>${v.damage}</em> 点伤害；若敌人中毒不少于 <em>${v.poisonThreshold}</em> 层，额外造成 <em>${v.poisonBonus}</em> 点伤害`;
    case "bloodMoon": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害；若拥有血煞，额外造成当前血煞层数的伤害`;
    case "moltedArmor": return `获得 <em>${v.armor}</em> 点防御；若本回合未受伤，抽 <em>${v.draw}</em> 张牌`;
    case "rotMiasma": return `施加 <em>${v.poison}</em> 层毒性；若敌人已经中毒，额外触发一次蚀毒`;
    case "fateSever": return `获得 <em>${v.fateGain}</em> 层命势，抽 <em>${v.draw}</em> 张牌${v.energy ? `，获得 <em>${v.energy}</em> 点真元` : ""}；失去 <em>${v.lifespanCost}</em> 点寿元`;
    case "leechBlade": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害；恢复造成伤害的 20% 生命，至少恢复 <em>${v.minHeal}</em> 点`;
    case "drunkFateWorm": return `下一张攻击蛊伤害翻倍；若本回合已获得命势，抽 <em>${v.draw}</em> 张牌`;
    case "soulBurn": return `获得 <em>${v.energy}</em> 点真元，失去 <em>${v.selfDamage}</em> 点生命；本回合下一张蛊牌消耗 -<em>${v.costReduction}</em>，最低为 0`;
    case "mutantBlade": return `失去 <em>${v.selfDamage}</em> 点生命，造成 <em>${v.damage}</em> 点伤害`;
    case "mutantArmor": return `获得 <em>${v.armor}</em> 点防御；弃 <em>${v.discard}</em> 张随机手牌`;
    case "mutantPoison": return `施加 <em>${v.poison}</em> 层毒性；你失去 <em>${v.selfDamage}</em> 点生命`;
    case "mutantFate": return `获得 <em>${v.energy}</em> 点真元并抽 <em>${v.draw}</em> 张牌；失去 <em>${v.lifespanCost}</em> 点寿元`;
    default:
      return CARD_LIBRARY[key]?.effect || "未知蛊术效果";
  }
}

function createMapState({ seed = "", mode = trialMode, random = null } = {}) {
  const routeRandom = typeof random === "function" ? random : createSeededRandom(seed || generateTrialSeed());
  const normalizedMode = normalizeTrialMode(mode);
  const firstPool = normalizedMode === "demo"
    ? ["bloodwolf", "shanxiao", ...NORMAL_ENEMY_IDS.filter((id) => id !== "bloodwolf" && id !== "shanxiao")]
    : NORMAL_ENEMY_IDS;
  const firstEnemies = shuffle(firstPool, routeRandom).slice(0, 2);
  if (normalizedMode === "demo" && !firstEnemies.some((id) => id === "bloodwolf" || id === "shanxiao")) {
    firstEnemies[0] = routeRandom() > 0.5 ? "bloodwolf" : "shanxiao";
  }
  const firstSegment = firstEnemies.map((enemyId, index) => ({
    id: `normal-${index + 1}`,
    step: 1,
    type: "battle",
    enemyId,
    icon: "兽",
    name: ENEMY_LIBRARY[enemyId].name,
    description: MAP_NODE_DESCRIPTIONS.battle,
  }));
  const secondBaseNodes = [
    { id: "chance-1", step: 2, type: "event", icon: "缘", name: "机缘", description: MAP_NODE_DESCRIPTIONS.event },
    { id: "shop-1", step: 2, type: "shop", icon: "坊", name: "蛊坊", description: MAP_NODE_DESCRIPTIONS.shop },
    { id: "elite-1", step: 2, type: "elite", enemyId: "bloodwolfElite", icon: "煞", name: "血纹狼王", description: MAP_NODE_DESCRIPTIONS.elite },
  ];
  const secondSegment = normalizedMode === "demo" ? secondBaseNodes : shuffle(secondBaseNodes, routeRandom);
  const thirdEnemyPool = NORMAL_ENEMY_IDS.filter((enemyId) => !firstEnemies.includes(enemyId));
  const thirdEnemyId = shuffle(thirdEnemyPool.length ? thirdEnemyPool : NORMAL_ENEMY_IDS, routeRandom)[0] || "shanxiao";
  const restName = REST_NODE_NAMES[Math.floor(routeRandom() * REST_NODE_NAMES.length)] || "残灯小憩";
  const thirdSegment = shuffle([
    {
      id: "normal-3",
      step: REST_ROUTE_STEP,
      type: "battle",
      enemyId: thirdEnemyId,
      enemyHpMultiplier: 1.1,
      icon: "兽",
      name: ENEMY_LIBRARY[thirdEnemyId].name,
      description: "塔压沉身，凶影更硬。",
    },
    {
      id: "rest-1",
      step: REST_ROUTE_STEP,
      type: "rest",
      icon: "息",
      name: restName,
      description: MAP_NODE_DESCRIPTIONS.rest,
    },
  ], routeRandom);
  const bossSegment = [{
    id: "boss-1",
    step: BOSS_ROUTE_STEP,
    type: "boss",
    enemyId: "corpsepuppet",
    icon: "盘",
    name: "尸盘监守",
    description: MAP_NODE_DESCRIPTIONS.boss,
  }];
  return {
    segments: [firstSegment, secondSegment, thirdSegment, bossSegment],
  };
}

function getAllMapNodes() {
  return runState?.mapState?.segments?.flat() || [];
}

function getMapNodeById(id) {
  return getAllMapNodes().find((node) => node.id === id) || null;
}

function getCurrentMapSegmentNodes() {
  return runState?.mapState?.segments?.[Math.max(0, runState.currentRouteStep - 1)] || [];
}

// runState 是整局命途试炼的唯一真相：地图、货币、持久生命、卡组与奖励都由它继承。
function createRunState() {
  const hero = HEROES[progression.selectedHeroId];
  const relicId = progression.selectedRelicId;
  const starterDeck = buildStarterDeckKeys(progression.selectedHeroId);
  const deckCards = starterDeck.keys.map(createDeckEntry);
  starterDeck.keys.forEach((key) => markGuDiscovered(key));
  const maxHp = hero.maxHp + (relicId === "jadeMarrow" ? 8 : 0);
  const seed = getSeedForNextRun();
  const mode = trialMode;
  const rngState = createRunRngState(seed);
  return {
    floor: 1,
    status: "running",
    heroId: progression.selectedHeroId,
    relicId,
    trialMode: mode,
    trialSeed: seed,
    rngState,
    currentHp: maxHp,
    maxHp,
    lifespan: hero.lifespan,
    baseEnergy: hero.energy + (relicId === "yuanCicada" ? 1 : 0),
    deckCards,
    deckKeys: deckCards.map((card) => card.key),
    initialAdvancedKeys: starterDeck.advancedKeys,
    normalEnemyOrder: shuffle(NORMAL_ENEMY_IDS, () => nextRngValue(rngState.channels.enemyOrder)),
    defeatedEnemies: [],
    guStones: 20,
    mapState: createMapState({ seed, mode, random: () => nextRngValue(rngState.channels.route) }),
    currentNode: null,
    completedNodes: [],
    lockedNodes: [],
    currentRouteStep: 1,
    eventHistory: [],
    restHistory: [],
    lastRestChoice: "",
    lastRestResult: "",
    routeHistory: [],
    lastMapNotice: "",
    lastEventNotice: "",
    shopPurchases: {},
    activeShopStock: [],
    pendingShopRemoveCardId: "",
    activeEventId: "",
    eliteDefeated: false,
    ordinaryRelics: [],
    relicHistory: [],
    eventRelicGained: false,
    bossPrepRelicGranted: false,
    shopDiscountUsed: false,
    lastBattleRewards: null,
    materialHistory: {},
    nextBattleHpLoss: 0,
    nextBattleEnemyAttackBonus: 0,
    bloodMaxBonus: 0,
    refinements: [],
    materials: MATERIAL_IDS.reduce((bag, id) => {
      bag[id] = 0;
      return bag;
    }, {}),
    mutationCount: 0,
    backlashCount: 0,
    stableCount: 0,
    runStats: createRunStats(),
    backlashMitigated: false,
    bloodAttackBonus: 0,
    startArmorBonus: 0,
    rewardResolved: false,
    materialRewardResolved: false,
    refinementResolved: false,
    furnaceResolved: false,
    pendingMaterialIds: [],
    pendingFurnaceCandidates: [],
    selectedFurnaceMaterialId: null,
    selectedFurnaceCardId: null,
    pendingFurnacePlan: null,
  };
}

function getEnemyIdForFloor(floor) {
  // TODO: 后续多幕路线扩展时抽象 finalNode / bossNode。
  if (runState?.currentNode?.enemyId) return runState.currentNode.enemyId;
  if (floor === MAX_ROUTE_STEP) return "corpsepuppet";
  return runState.normalEnemyOrder[floor - 1];
}

function createBattleState() {
  const hero = HEROES[runState.heroId];
  const enemyId = getEnemyIdForFloor(runState.floor);
  const enemyDefinition = ENEMY_LIBRARY[enemyId];
  const enemyHpMultiplier = Number(runState.currentNode?.enemyHpMultiplier) || 1;
  const enemyMaxHp = Math.max(1, Math.ceil(enemyDefinition.maxHp * enemyHpMultiplier));
  const startingArmor = (runState.relicId === "boneCarapace" ? 3 : 0) + runState.startArmorBonus;
  const deck = runState.deckCards.map(createCardFromDeckEntry);
  const combatRelic = {
    tailCutUsed: false,
    bloodJadeHealsThisTurn: 0,
    greenPouchCardName: "",
  };
  if (hasOrdinaryRelic("greenPouchBug")) {
    const poisonCards = deck.filter((card) => card.type === "poison" || card.typeName.includes("毒道"));
    const target = sample(poisonCards, 1)[0];
    if (target) {
      target.cost = Math.max(0, target.cost - 1);
      target.temporaryCostReduction = 1;
      combatRelic.greenPouchCardName = target.name;
    }
  }
  return {
    status: "playing",
    floor: runState.floor,
    turn: 1,
    inputLocked: false,
    handTarget: 5,
    attackBonus: 0,
    defenseBonus: 0,
    bloodAttackBonus: runState.bloodAttackBonus,
    cardsPlayedThisTurn: 0,
    lastCardCategoryThisTurn: null,
    activeCardContext: null,
    pendingEnemyPoisonPulse: false,
    fateGainedThisTurn: false,
    supportDrawPrimed: 0,
    enemyAttackBonus: runState.nextBattleEnemyAttackBonus || 0,
    combatRelic,
    battleStats: createBattleStats(enemyDefinition, runState.currentNode),
    player: {
      heroId: runState.heroId,
      definition: hero,
      hp: runState.currentHp,
      maxHp: runState.maxHp,
      energy: runState.baseEnergy,
      baseEnergy: runState.baseEnergy,
      nextTurnEnergyPenalty: 0,
      armor: startingArmor,
      lifespan: runState.lifespan,
      blood: 0,
      poison: 0,
      fateMomentum: 0,
      lastCardFlowType: null,
      doubleNextAttack: false,
      nextCardCostReduction: 0,
      wasDamagedThisTurn: false,
    },
    enemy: {
      id: enemyId,
      definition: enemyDefinition,
      hp: enemyMaxHp,
      maxHp: enemyMaxHp,
      armor: 0,
      chargedBonus: 0,
      poison: 0,
      intent: null,
      phase2: false,
      towerPressure: enemyHpMultiplier > 1,
    },
    drawPile: shuffle(deck),
    discardPile: [],
    hand: [],
  };
}

function syncRunStateFromBattle() {
  if (!runState || !game) return;
  runState.currentHp = game.player.hp;
  runState.maxHp = game.player.maxHp;
  runState.lifespan = game.player.lifespan;
}

function renderTitleScreen() {
  dom.heroChoices.innerHTML = Object.entries(HEROES).map(([id, hero]) => {
    const selected = id === progression.selectedHeroId;
    return `<button class="hero-choice hero-${id} ${selected ? "selected" : ""}"
      type="button" data-hero-id="${id}" aria-pressed="${selected}">
      <div class="hero-choice-portrait">
        <span class="hero-choice-fallback">${hero.glyph}</span>
        <img class="hero-choice-image" data-portrait-path="${PORTRAIT_PATHS.heroes[id]}" alt="${hero.name}立绘" decoding="async">
      </div>
      <div class="hero-choice-info">
        <span class="hero-choice-role">${hero.role}</span>
        <strong>${hero.name}</strong>
        <div class="hero-choice-stats"><span>生命 ${hero.maxHp}</span><span>真元 ${hero.energy}</span><span>寿元 ${hero.lifespan}</span></div>
        <p class="hero-choice-passive"><em>${hero.passiveName}</em>：${hero.passive}</p>
      </div>
    </button>`;
  }).join("");
  dom.heroChoices.querySelectorAll(".hero-choice-image").forEach((image) => {
    const owner = image.closest(".hero-choice");
    loadPortraitImage(image, image.dataset.portraitPath, image.alt, owner);
  });

  dom.relicChoices.innerHTML = Object.entries(RELICS).map(([id, relic]) => `
    <button class="relic-choice ${id === progression.selectedRelicId ? "selected" : ""}"
      type="button" data-relic-id="${id}" aria-pressed="${id === progression.selectedRelicId}">
      <span>${relic.glyph}</span>
      <div><strong>${relic.name}</strong><small>${relic.description}</small></div>
    </button>`).join("");

  dom.advancedCardPreview.innerHTML = buildStarterDeckKeys(progression.selectedHeroId).keys
    .map((key) => `<span>${CARD_LIBRARY[key].name}</span>`).join("");

  dom.runProgress.classList.add("hidden");
}

function showStartScreen() {
  if (dom.resultOverlay) dom.resultOverlay.classList.add("hidden");
  if (dom.deckOverlay) dom.deckOverlay.classList.add("hidden");
  if (dom.loreOverlay) dom.loreOverlay.classList.add("hidden");
  if (dom.balanceOverlay) dom.balanceOverlay.classList.add("hidden");
  if (dom.runStatsOverlay) dom.runStatsOverlay.classList.add("hidden");
  if (dom.trialSettingsOverlay) dom.trialSettingsOverlay.classList.add("hidden");
  if (dom.settingsOverlay) dom.settingsOverlay.classList.add("hidden");
  if (dom.mapScreen) dom.mapScreen.classList.add("hidden");
  closeBattleCoach(false);
  hideKeywordTooltip();
  refreshModalLock();
  dom.startScreen.classList.remove("hidden");
  document.body.classList.add("title-open");
  renderTitleScreen();
  updateTrialModeControls();
  updateMobileViewportState();
  maybeAutoOpenTutorial();
}

function updateGuStoneDisplays() {
  const value = runState?.guStones ?? 0;
  if (dom.topGuStone) dom.topGuStone.innerHTML = `蛊石 <strong>${value}</strong>`;
  if (dom.mapGuStones) dom.mapGuStones.innerHTML = `蛊石 <strong>${value}</strong>`;
  if (dom.shopGuStones) dom.shopGuStones.textContent = value;
}

function gainGuStones(amount, source = "命途所得") {
  if (!runState || !amount) return;
  runState.guStones += amount;
  addLog(`${source}：获得 ${amount} 蛊石。`, "positive-log");
  updateGuStoneDisplays();
}

function spendGuStones(amount) {
  if (!runState || runState.guStones < amount) return false;
  runState.guStones -= amount;
  updateGuStoneDisplays();
  return true;
}

function gainMaterial(materialId, count = 1, source = "命途所得") {
  if (!runState || !MATERIALS[materialId]) return;
  runState.materials[materialId] = (runState.materials[materialId] || 0) + count;
  runState.materialHistory[materialId] = (runState.materialHistory[materialId] || 0) + count;
  addLog(`${source}：获得「${MATERIALS[materialId].name}」x${count}。`, "positive-log");
  unlockLorePage("fiveMaterials");
}

function hideRewardPanels() {
  dom.cardRewardPanel?.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel?.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.shopRemovePanel?.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultLoreButton?.classList.add("hidden");
  dom.resultFeedbackButton?.classList.add("hidden");
  dom.feedbackCopyFallback?.classList.add("hidden");
}

function showMapScreen() {
  if (!runState || !dom.mapScreen) return;
  clearCombatEffects();
  game = null;
  switchLogChannel("journey");
  dom.startScreen.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  dom.deckOverlay?.classList.add("hidden");
  dom.trialSettingsOverlay?.classList.add("hidden");
  dom.settingsOverlay?.classList.add("hidden");
  dom.mapScreen.classList.remove("hidden");
  document.body.classList.remove("title-open");
  refreshModalLock();
  window.AudioManager?.playScene("menu", { duration: 520, quiet: true });
  renderMapScreen();
  updateMobileViewportState();
}

function getMapNodeState(node) {
  if (runState.completedNodes.includes(node.id)) return "completed";
  if (runState.lockedNodes.includes(node.id)) return "locked";
  if (node.step < runState.currentRouteStep) return "locked";
  if (node.step > runState.currentRouteStep) return "unlocked";
  return "available";
}

function getMapMaterialSummary() {
  if (!runState) return "材料 0";
  const total = MATERIAL_IDS.reduce((sum, id) => sum + (runState.materials[id] || 0), 0);
  const owned = MATERIAL_IDS
    .filter((id) => (runState.materials[id] || 0) > 0)
    .map((id) => `${MATERIALS[id].name}x${runState.materials[id]}`)
    .join("、");
  return owned || `材料 ${total}`;
}

function getMapDefeatedSummary() {
  return runState?.defeatedEnemies?.length ? runState.defeatedEnemies.join("、") : "尚未伏诛";
}

function getMapNodeStateLabel(node, state) {
  if (state === "completed") return "✓ 已踏破";
  if (state === "available") return "当前可选";
  if (state === "locked") {
    if (runState.lockedNodes.includes(node.id)) return "岔路封闭";
    return "未解锁";
  }
  return "未解锁";
}

function getMapTransitionText(type) {
  switch (type) {
    case "battle": return "凶影拦路";
    case "event": return "命途中现异兆";
    case "shop": return "残灯下有蛊坊开门";
    case "elite": return "血煞盘踞，退路已断";
    case "rest": return "塔隙微明，可暂整蛊息";
    case "boss": return runState?.layer2?.active ? "生态之主盘踞，杀机已现" : "尸盘转动，守关者苏醒";
    default: return "命途流转";
  }
}

function showMapTransition(text, callback) {
  window.clearTimeout(mapTransitionTimer);
  if (!dom.mapTransition || !dom.mapTransitionText) {
    callback?.();
    return;
  }
  dom.mapTransitionText.textContent = text;
  dom.mapTransition.classList.remove("hidden");
  dom.mapTransition.classList.remove("show");
  void dom.mapTransition.offsetWidth;
  dom.mapTransition.classList.add("show");
  mapTransitionTimer = window.setTimeout(() => {
    dom.mapTransition.classList.add("hidden");
    dom.mapTransition.classList.remove("show");
    callback?.();
  }, 520);
}

function showMapNotice(text) {
  window.clearTimeout(mapNoticeTimer);
  if (!dom.mapNotice || !text) return;
  dom.mapNotice.textContent = text;
  dom.mapNotice.classList.remove("hidden");
  mapNoticeTimer = window.setTimeout(() => {
    dom.mapNotice.classList.add("hidden");
    if (runState?.lastMapNotice === text) runState.lastMapNotice = "";
  }, 1200);
}

function getNodeCompleteNotice(node) {
  if (!node) return "";
  if (node.type === "shop") return "蛊坊交易已毕";
  if (node.type === "event") return runState.lastEventNotice || "机缘已定";
  if (node.type === "elite") return "血纹狼王已败";
  if (node.type === "rest") return runState.lastRestResult || "休整已毕";
  if (node.type === "boss") return "尸盘监守已破";
  return `${node.name}已伏诛`;
}

function renderMapScreen() {
  if (!runState || !dom.mapRoute) return;
  updateGuStoneDisplays();
  const stepText = runState.currentRouteStep <= MAX_ROUTE_STEP ? `第 ${runState.currentRouteStep} 段` : "终局";
  const __isL2Map = runState.layer === 2 || runState.layer2?.active;
  dom.mapDescription.textContent = __isL2Map
    ? (runState.currentRouteStep === 1
        ? "生态歧路重新铺开，两头凶影各踞一径。择一而行，另一岔路将闭。"
        : runState.currentRouteStep === 2
          ? "深处再裂：迎生态精英、探机缘，或入残灯蛊坊。"
          : runState.currentRouteStep === REST_ROUTE_STEP
            ? "残卷遗落于此，拾之倾向此径之道。"
            : "生态之主盘踞末路，破之则深行已尽。")
    : (runState.currentRouteStep === 1
    ? "塔路初分，凶兽各踞一阶。择一而行，另一岔路将闭。"
    : runState.currentRouteStep === 2
      ? "命途再裂：取机缘、入蛊坊，或迎血煞精英。"
      : runState.currentRouteStep === REST_ROUTE_STEP
        ? "临门分岔：再战一场，或在塔隙中稍作休整。"
        : "尸盘已转，守关者在塔顶等你。");
  dom.mapHint.textContent = runState.currentRouteStep <= MAX_ROUTE_STEP
    ? "选择发亮节点继续；灰暗岔路本局不再开启。"
    : "命途已尽，等待结算。";
  if (dom.mapStatus) {
    dom.mapStatus.innerHTML = `
      <span><em>当前</em><strong>${stepText}</strong></span>
      <span><em>命途种子</em><strong>${runState.trialSeed || "无"}</strong></span>
      <span><em>已伏诛</em><strong>${getMapDefeatedSummary()}</strong></span>
      <span><em>蛊石</em><strong>${runState.guStones}</strong></span>
      <span><em>材料</em><strong>${getMapMaterialSummary()}</strong></span>`;
  }
  if (dom.mapProgress) {
    // TODO: 后续多幕路线扩展时继续抽象 finalNode / bossNode。
    dom.mapProgress.innerHTML = Array.from({ length: MAX_ROUTE_STEP }, (_, index) => index + 1).map((step) => {
      const state = step < runState.currentRouteStep ? "completed" : step === runState.currentRouteStep ? "current" : "locked";
      return `<span class="${state}">${state === "completed" ? "✓" : step}<small>第 ${step} 段</small></span>`;
    }).join("<i></i>");
  }
  dom.mapRoute.innerHTML = runState.mapState.segments.map((segment, index) => {
    const step = index + 1;
    const lineClass = step < runState.currentRouteStep ? "completed" : step === runState.currentRouteStep ? "current" : "locked";
    const nodes = segment.map((node) => {
      const state = getMapNodeState(node);
      const disabled = state !== "available";
      const stateLabel = getMapNodeStateLabel(node, state);
      return `<button class="map-node ${node.type} ${state}" type="button" data-map-node="${node.id}" ${disabled ? "disabled" : ""}>
        <span class="map-node-icon">${node.icon}</span>
        <strong>${node.name}</strong>
        <small>${stateLabel}</small>
        <p>${node.description}</p>
      </button>`;
    }).join("");
    const isL2 = runState.layer === 2 || runState.layer2?.active;
    const l2Name = runState.layer2?.routeName || "生态深径";
    const segmentTitle = isL2
      ? (step === BOSS_ROUTE_STEP ? `末段 · ${l2Name}之主` : step === REST_ROUTE_STEP ? `第 ${step} 段 · 残卷` : `第 ${step} 段 · ${l2Name}`)
      : (step === REST_ROUTE_STEP ? "第 3 段 · 临门分岔" : step === BOSS_ROUTE_STEP ? "第 4 段 · 尸盘门" : `第 ${step} 段`);
    return `<section class="map-segment segment-step-${step} ${lineClass}">
      <div class="map-segment-label"><span>${segmentTitle}</span><i></i></div>
      <div class="map-node-row">${nodes}</div>
    </section>`;
  }).join("");
  renderTowerProgress();
  if (runState.lastMapNotice) showMapNotice(runState.lastMapNotice);
}

function lockSiblingNodes(node) {
  getCurrentMapSegmentNodes()
    .filter((item) => item.id !== node.id && !runState.lockedNodes.includes(item.id))
    .forEach((item) => runState.lockedNodes.push(item.id));
}

function enterMapNode(node) {
  if (!runState || !node) return;
  /* 第二层残卷节点：走专门奖励入口（不进战斗） */
  if (node.type === "reward" && runState.layer2?.active) {
    runState.currentNode = node;
    runState.floor = node.step;
    lockSiblingNodes(node);
    addLog(`命途分岔：你选择了${node.name}。`, "important");
    openLayer2Reward({ name: node.name });
    return;
  }
  runState.currentNode = node;
  runState.floor = node.step;
  lockSiblingNodes(node);
  addLog(`命途分岔：你选择了${node.name}。`, "important");
  if (node.enemyId && runState.layer2?.active && typeof layer2MarkBestiary === "function") layer2MarkBestiary(node.enemyId);
  if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
    startFloorBattle();
  } else if (node.type === "event") {
    openChanceEvent();
  } else if (node.type === "shop") {
    openShopNode();
  } else if (node.type === "rest") {
    openRestNode();
  }
}

function selectMapNode(nodeId) {
  if (!runState) return;
  const node = getMapNodeById(nodeId);
  if (!node || getMapNodeState(node) !== "available") return;
  playUiSfx();
  if (node.type === "elite") {
    openEliteConfirm(node);
    return;
  }
  if (node.type === "reward") { showMapTransition("生态残卷遗落", () => enterMapNode(node)); return; }
  showMapTransition(getMapTransitionText(node.type), () => enterMapNode(node));
}

function openEliteConfirm(node) {
  pendingEliteNodeId = node.id;
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result elite-confirm-result";
  hideRewardPanels();
  dom.resultSeal.textContent = "煞";
  dom.resultEyebrow.textContent = "命途分岔 · 精英";
  dom.resultTitle.textContent = (node.enemyId && typeof ENEMY_LIBRARY !== "undefined" && ENEMY_LIBRARY[node.enemyId]?.name) || "血纹狼王";
  dom.resultDescription.textContent = "此战风险更高，胜后奖励更厚。若暂不进入，可回到命途图重新考虑。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.eliteConfirmPanel?.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function confirmEliteBattle() {
  const node = getMapNodeById(pendingEliteNodeId);
  if (!node || getMapNodeState(node) !== "available") return;
  pendingEliteNodeId = "";
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  dom.mapScreen?.classList.remove("hidden");
  showMapTransition(getMapTransitionText(node.type), () => enterMapNode(node));
}

function cancelEliteBattle() {
  pendingEliteNodeId = "";
  dom.resultOverlay.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  refreshModalLock();
  showMapScreen();
}

function completeCurrentNodeAndReturnMap() {
  if (!runState?.currentNode) return;
  const node = runState.currentNode;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  runState.lastMapNotice = getNodeCompleteNotice(node);
  if (node.step === 2 && !runState.bossPrepRelicGranted) {
    const relicId = gainRandomOrdinaryRelic("Boss 前整备");
    runState.bossPrepRelicGranted = true;
    if (relicId) {
      runState.lastMapNotice = `${runState.lastMapNotice}；入 Boss 前获得${ORDINARY_RELICS[relicId].name}`;
    }
  }
  addLog(`命途记录：${runState.lastMapNotice}。`, "important");
  runState.currentRouteStep = Math.min(MAX_ROUTE_STEP, node.step + 1);
  runState.currentNode = null;
  showMapScreen();
}

function completeCurrentBattleNode() {
  if (!runState?.currentNode) return;
  const node = runState.currentNode;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  runState.currentRouteStep = Math.min(MAX_ROUTE_STEP, node.step + 1);
}

function startNewRun() {
  cardSerial = 0;
  runState = createRunState();
  resetAllLogs();
  addJourneyLog(`命途图展开：塔路分岔已显现。命途种子：${runState.trialSeed}。`, "important");
  addJourneyLog(`试炼模式：${getTrialModeInfo(runState.trialMode).name}。`, "system-log");
  showMapScreen();
}

function getRandomRewardCardKey({ rare = false } = {}) {
  const exclusive = HERO_EXCLUSIVE_CARD_KEYS[runState.heroId] || [];
  const pool = rare ? [...ADVANCED_CARD_KEYS, ...V08_COMMON_CARD_KEYS, ...exclusive] : [...STANDARD_REWARD_CARD_KEYS, ...exclusive];
  return sample(pool, 1)[0] || "moonBlade";
}

function healRunHp(amount, sourceName) {
  if (!runState || amount <= 0) return 0;
  const before = runState.currentHp;
  runState.currentHp = Math.min(runState.maxHp, runState.currentHp + amount);
  const healed = runState.currentHp - before;
  if (game?.player) game.player.hp = runState.currentHp;
  if (dom.resultHp) dom.resultHp.textContent = runState.currentHp;
  if (healed > 0) addLog(`${sourceName}：恢复 ${healed} 点生命。`, "positive-log");
  return healed;
}

function reduceRunMaxHp(amount, sourceName) {
  if (!runState || amount <= 0) return;
  runState.maxHp = Math.max(1, runState.maxHp - amount);
  runState.currentHp = Math.min(runState.currentHp, runState.maxHp);
  if (game?.player) {
    game.player.maxHp = runState.maxHp;
    game.player.hp = Math.min(game.player.hp, runState.maxHp);
  }
  if (dom.resultHp) dom.resultHp.textContent = runState.currentHp;
  addLog(`${sourceName}：最大生命 -${amount}。`, "damage-log");
}

function removeDeckEntryById(instanceId) {
  const index = runState.deckCards.findIndex((entry) => entry.instanceId === instanceId);
  if (index < 0) return null;
  const [removed] = runState.deckCards.splice(index, 1);
  syncRunDeckKeys();
  return removed;
}

function removeRandomBasicCard() {
  const basics = new Set(["moonBlade", "ironSkin", "wineWorm", "burningEssence", "bloodBlade"]);
  const candidates = runState.deckCards.filter((entry) => basics.has(entry.originalKey || entry.key));
  if (!candidates.length || runState.deckCards.length <= 6) return null;
  const target = sample(candidates, 1)[0];
  return removeDeckEntryById(target.instanceId);
}

/* ============================================================
 * V0.9.6 第二层「生态关卡」最小可玩流程（加性·不重构地图）
 * 设计：不进入 mapState 分段引擎，单独用 runState.layer2 线性推进，
 *       每个节点临时写入 runState.currentNode（合成节点）后复用现有
 *       startFloorBattle / openChanceEvent / openShopNode / openRestNode，
 *       战斗/事件完成回到 layer2 调度而非 completeCurrentNodeAndReturnMap。
 * ============================================================ */

/* 两条路线定义：介绍/推荐流派/风险/敌人序列 + 倾向奖励权重（用现有卡，不新增卡） */
const LAYER2_ROUTES = {
  miasma: {
    id: "miasma",
    name: "瘴林深径",
    icon: "瘴",
    intro: "瘴气终年不散的腐林，毒越积越深。久战者烂，速攻者亦难全身而退。",
    recommend: "推荐流派：毒道 / 虫群（叠毒滚雪球）",
    risk: "风险：敌人持续施毒，毒层越高其伤越重；拖延越久越危险。",
    enemiesPreview: "可能遭遇：腐叶蛊虫 · 青瘴寄生 · 毒藤尸 · 瘴林执灯者 · 百瘴母蛊",
    /* 节点链：普通→普通→三选一→精英→奖励→Boss（结构最小、复用现有节点类型） */
    nodes: [
      { kind: "battle", enemyId: "rotleafGu", name: "腐叶林径" },
      { kind: "battle", enemyId: "miasmaParasite", name: "青瘴湿洼", enemyHpMultiplier: 1.05 },
      { kind: "branch", name: "瘴径分岔" },
      { kind: "elite", enemyId: "miasmaLanternEliteGu", name: "执灯者" },
      { kind: "reward", name: "瘴林残卷" },
      { kind: "boss", enemyId: "miasmaMotherBoss", name: "百瘴巢穴" },
    ],
    bossId: "miasmaMotherBoss",
    /* 倾向奖励：在现有牌池里加权这些 key（不改池、不新增卡） */
    favoredCardKeys: ["greenMiasma", "poisonReturn", "insectSwarm", "heartEater"],
    loreId: "unfinished", /* 复用现有残卷页解锁，不新增残卷数据 */
    codexTaskId: "codex_miasmaProbe",
    bossTaskId: "codex_miasmaName",
  },
  bloodmarsh: {
    id: "bloodmarsh",
    name: "血沼沉渊",
    icon: "血",
    intro: "尸血淤积的深沼，血道蛊修在此以命饲蛊。你越虚弱，沼中之物越亢奋。",
    recommend: "推荐流派：血道（以血煞爆发收割）",
    risk: "风险：敌人自损换攻、吸血续命；你血量越低，它们压迫越强。",
    enemiesPreview: "可能遭遇：血蛭群 · 断脉蛊徒 · 血泥傀 · 血衣祭蛊者 · 血衣蛊母",
    nodes: [
      { kind: "battle", enemyId: "bloodLeechSwarm", name: "蛭潮浅滩" },
      { kind: "battle", enemyId: "brokenMeridianGu", name: "断脉血径", enemyHpMultiplier: 1.05 },
      { kind: "branch", name: "血沼分岔" },
      { kind: "elite", enemyId: "bloodRobePriestEliteGu", name: "血衣祭坛" },
      { kind: "reward", name: "血道残谱" },
      { kind: "boss", enemyId: "bloodRobeMotherBoss", name: "血池深渊" },
    ],
    bossId: "bloodRobeMotherBoss",
    favoredCardKeys: ["bloodBlade", "bloodReversal", "burningEssence", "heartEater"],
    loreId: "unfinished",
    codexTaskId: "codex_bloodmarshProbe",
    bossTaskId: "codex_bloodRobeName",
  },
};

/* 第二层进度持久化（仅供图鉴任务 count() 只读展示，不发奖） */
const LAYER2_PROGRESS_KEY = "nmg.layer2.progress";
function layer2LoadProgress() {
  try { const r = localStorage.getItem(LAYER2_PROGRESS_KEY); const o = r ? JSON.parse(r) : {}; return (o && typeof o === "object") ? o : {}; }
  catch (err) { return {}; }
}
function layer2SaveProgress(o) {
  try { localStorage.setItem(LAYER2_PROGRESS_KEY, JSON.stringify(o && typeof o === "object" ? o : {})); } catch (err) { /* 忽略 */ }
}
function layer2MarkProgress(field) {
  const o = layer2LoadProgress();
  o[field] = (o[field] | 0) + 1;
  layer2SaveProgress(o);
}

/* 第二层万蛊录解锁：enemy/boss 条目无 cardKey，单独用持久集合记“已遭遇” */
const LAYER2_BESTIARY_KEY = "nmg.layer2.bestiary";
function layer2LoadBestiary() {
  try { const r = localStorage.getItem(LAYER2_BESTIARY_KEY); const a = r ? JSON.parse(r) : []; return new Set(Array.isArray(a) ? a : []); }
  catch (err) { return new Set(); }
}
function layer2MarkBestiary(enemyId) {
  if (!enemyId) return;
  const set = layer2LoadBestiary();
  if (set.has(enemyId)) return;
  set.add(enemyId);
  try { localStorage.setItem(LAYER2_BESTIARY_KEY, JSON.stringify([...set])); } catch (err) { /* 忽略 */ }
}

/* ===== 命途未尽：一层 Boss 胜利后的选择面板（结算 / 深入） ===== */
function showUnfinishedPathChoice() {
  /* 复用 result-overlay 与两个现成按钮，不新增 index.html DOM */
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.eliteConfirmPanel?.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result unfinished-path-result";
  dom.resultSeal.textContent = "途";
  dom.resultEyebrow.textContent = "命途未尽 · 塔顶之上";
  dom.resultTitle.textContent = "尸盘已破，去路未尽";
  dom.resultDescription.textContent = "尸盘监守倒下，塔顶裂开一道向下的暗径——瘴气与血腥自深处涌上。就此收功，抑或踏入更深的生态？";
  dom.resultDeckButton?.classList.remove("hidden");
  dom.resultStatsButton?.classList.remove("hidden");
  dom.resultLoreButton?.classList.remove("hidden");
  dom.resultFeedbackButton?.classList.add("hidden");
  dom.resultPrimaryButton.textContent = "继续深入";
  dom.resultPrimaryButton.dataset.action = "enterLayer2";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultSecondaryButton.textContent = "就此结算";
  dom.resultSecondaryButton.dataset.action = "settleLayer1";
  dom.resultSecondaryButton.classList.remove("hidden");
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  refreshModalLock();
}

/* 选择「就此结算」：走原结算流程 */
function settleAtLayer1() {
  runState.status = "cleared";
  dom.resultSecondaryButton.dataset.action = "";
  dom.resultSecondaryButton.classList.add("hidden");
  showRunConclusion(true);
}

/* ===== 路线选择面板 ===== */
function showLayer2RouteSelect() {
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result layer2-route-result";
  dom.resultSeal.textContent = "径";
  dom.resultEyebrow.textContent = "第二层 · 生态分岔";
  dom.resultTitle.textContent = "择一径深入";
  dom.resultDescription.textContent = "两条生态歧路在脚下展开，择定便难回头。";
  /* 用 runSummary 容器铺两张路线卡（复用其滚动样式） */
  const card = (r) => `
    <button type="button" class="layer2-route-card" data-layer2-route="${r.id}">
      <span class="layer2-route-icon">${r.icon}</span>
      <strong class="layer2-route-name">${r.name}</strong>
      <p class="layer2-route-intro">${r.intro}</p>
      <p class="layer2-route-line layer2-route-rec">${r.recommend}</p>
      <p class="layer2-route-line layer2-route-risk">${r.risk}</p>
      <p class="layer2-route-line layer2-route-foes">${r.enemiesPreview}</p>
    </button>`;
  dom.runSummary.innerHTML = `<div class="layer2-route-grid">${card(LAYER2_ROUTES.miasma)}${card(LAYER2_ROUTES.bloodmarsh)}</div>`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
  /* 委托点击：在 bindEvents 已加 runSummary 监听 */
}

/* 选定路线，初始化 layer2 状态并推进首个节点 */
function chooseLayer2Route(routeId) {
  const route = LAYER2_ROUTES[routeId];
  if (!route || !runState) return;
  runState.layer2 = {
    active: true,
    routeId,
    routeName: route.name,
    nodeIndex: 0,
    branchChoice: "",
    bossDefeated: false,
    nodesCleared: 0,
    lastNodeName: "第二层入口",
  };
  layer2MarkProgress(routeId === "miasma" ? "miasmaEntered" : "bloodmarshEntered");
  getRunStats().layer2Entered = true;
  getRunStats().layer2Route = route.name;
  unlockLorePage(route.loreId || "unfinished");
  dom.runSummary.classList.add("hidden");
  /* V0.9.6.1：不再走线性 layer2Advance，进入真正的第二层分岔地图 */
  enterLayer2Map(routeId);
}

/* 第二层调度：依 nodeIndex 取节点，写入合成 currentNode，复用现有节点入口 */
function layer2Advance() {
  const st = runState?.layer2;
  if (!st || !st.active) return;
  const route = LAYER2_ROUTES[st.routeId];
  const node = route.nodes[st.nodeIndex];
  if (!node) { showLayer2Conclusion(true); return; }
  st.lastNodeName = `${route.name}·${node.name}`;
  if (node.kind === "branch") { showLayer2Branch(node); return; }
  if (node.kind === "reward") { openLayer2Reward(node); return; }
  /* battle / elite / boss：写合成节点后复用 startFloorBattle */
  const synthType = node.kind === "boss" ? "boss" : (node.kind === "elite" ? "elite" : "battle");
  runState.currentNode = {
    id: `layer2-${st.routeId}-${st.nodeIndex}`,
    step: MAX_ROUTE_STEP, /* 让 startFloorBattle 不误判普通层进度；层级判断改走 layer2.active */
    type: synthType,
    enemyId: node.enemyId,
    enemyHpMultiplier: node.enemyHpMultiplier || (synthType === "boss" ? 1 : 1),
    icon: synthType === "boss" ? "盘" : (synthType === "elite" ? "煞" : "兽"),
    name: node.name,
    description: synthType === "boss" ? "生态之主，破之深行。" : (synthType === "elite" ? "生态精英，厚利藏险。" : "生态凶影，胜后取蛊。"),
    layer2: true,
  };
  layer2MarkBestiary(node.enemyId);
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  startFloorBattle();
}

/* ===================================================================
 * V0.9.6.1 第二层「地图化」核心
 * 设计：不另写一套地图渲染/点击/推进。进二层时，把 runState.mapState
 * 换成「与一层同形」的 segments 结构（createLayer2MapState 生成），并把
 * runState.layer 置 2、重置 currentRouteStep/completedNodes/lockedNodes，
 * 然后调用现成 showMapScreen()。renderMapScreen / selectMapNode /
 * enterMapNode / lockSiblingNodes / getMapNodeState / getMapNodeStateLabel
 * 全部原样复用（它们只读 runState.mapState.segments + currentRouteStep）。
 * 只在 4 个“层感知”收口点做最小分支（见 jsEdits）。
 * 节点结构：起点(2普通分岔)→中段(精英/事件/休整/蛊坊 多选)→残卷奖励→Boss。
 * 主题：theme = miasma | bloodmarsh，影响普通战/精英/Boss 敌人与文案。
 * =================================================================== */

/* 第二层主题敌人池（取自 V0.9.6 已定义的 ENEMY_LIBRARY 条目，不新增敌人） */
const LAYER2_THEME_POOLS = {
  miasma: {
    normals: ["rotleafGu", "miasmaParasite", "poisonVineCorpse"],
    elite: "miasmaLanternEliteGu",
    boss: "miasmaMotherBoss",
  },
  bloodmarsh: {
    normals: ["bloodLeechSwarm", "brokenMeridianGu", "bloodMudGolem"],
    elite: "bloodRobePriestEliteGu",
    boss: "bloodRobeMotherBoss",
  },
};

/* 第二层非战斗节点文案占位（缺内容也不报错） */
const LAYER2_NODE_TEXT = {
  battle: "生态凶影，胜后取蛊。",
  event: "深处异兆，三念定局。",
  rest: "塔隙微明，可暂养息一息。",
  shop: "残灯下蛊坊半掩，以蛊石易牌。",
  elite: "生态精英，厚利藏险。",
  reward: "生态残卷遗落，倾向此径之道。",
  boss: "生态之主盘踞末路，破之深行。",
};

/* 抽取一个主题普通战敌人（带去重，避免一局重复太多） */
function pickLayer2Normal(theme, used) {
  const pool = (LAYER2_THEME_POOLS[theme]?.normals || LAYER2_THEME_POOLS.miasma.normals)
    .filter((id) => ENEMY_LIBRARY[id]);
  const fresh = pool.filter((id) => !used.has(id));
  const id = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))] || pool[0];
  used.add(id);
  return id;
}

/* 生成与一层同形的第二层地图 segments：
 *   段1：2 个普通战分岔（左/右，倾向标记仅作文案，敌人都来自主题池）
 *   段2：精英 + 事件/休整/蛊坊 三选一中的两条分岔（精英为高风险路）
 *   段3：生态残卷（reward，单节点）
 *   段4：第二层 Boss
 * routeId 即主题 theme（miasma/bloodmarsh）。 */
function createLayer2MapState(theme) {
  const pool = LAYER2_THEME_POOLS[theme] || LAYER2_THEME_POOLS.miasma;
  const used = new Set();
  const n1 = pickLayer2Normal(theme, used);
  const n2 = pickLayer2Normal(theme, used);
  const themeName = theme === "miasma" ? "瘴" : "血";
  const seg1 = [
    { id: "l2-1-a", step: 1, type: "battle", enemyId: n1, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n1]?.name || "生态凶影", description: LAYER2_NODE_TEXT.battle },
    { id: "l2-1-b", step: 1, type: "battle", enemyId: n2, layer2: true, l2theme: theme,
      icon: "兽", name: ENEMY_LIBRARY[n2]?.name || "生态凶影", description: LAYER2_NODE_TEXT.battle },
  ];
  /* 段2：三条分岔——精英(高风险高奖) / 机缘事件 / 休整蛊坊（随机给到其一非战斗），保证至少 2 选 */
  const softNode = Math.random() < 0.5
    ? { id: "l2-2-c", step: 2, type: "shop", layer2: true, l2theme: theme, icon: "坊", name: "残灯蛊坊", description: LAYER2_NODE_TEXT.shop }
    : { id: "l2-2-c", step: 2, type: "rest", layer2: true, l2theme: theme, icon: "息", name: "沼隙休整", description: LAYER2_NODE_TEXT.rest };
  const seg2 = [
    { id: "l2-2-a", step: 2, type: "elite", enemyId: pool.elite, layer2: true, l2theme: theme,
      icon: "煞", name: ENEMY_LIBRARY[pool.elite]?.name || "生态精英", description: LAYER2_NODE_TEXT.elite },
    { id: "l2-2-b", step: 2, type: "event", layer2: true, l2theme: theme, icon: "缘", name: "生态机缘", description: LAYER2_NODE_TEXT.event },
    softNode,
  ];
  /* 段3：生态残卷（用 reward 类型，enterMapNode 走专门入口） */
  const seg3 = [
    { id: "l2-3-a", step: REST_ROUTE_STEP, type: "reward", layer2: true, l2theme: theme,
      icon: "卷", name: theme === "miasma" ? "瘴林残卷" : "血道残谱", description: LAYER2_NODE_TEXT.reward },
  ];
  /* 段4：第二层 Boss */
  const seg4 = [
    { id: "l2-4-boss", step: BOSS_ROUTE_STEP, type: "boss", enemyId: pool.boss, layer2: true, l2theme: theme,
      icon: themeName, name: ENEMY_LIBRARY[pool.boss]?.name || "生态之主", description: LAYER2_NODE_TEXT.boss },
  ];
  return { segments: [seg1, seg2, seg3, seg4], theme };
}

/* 进入第二层地图：复用一层渲染管线（替换 mapState + 重置步进 + layer=2） */
function enterLayer2Map(routeId) {
  const route = LAYER2_ROUTES[routeId];
  if (!route || !runState) return;
  const theme = routeId; /* miasma / bloodmarsh */
  runState.layer = 2;
  runState.layer2 = {
    active: true,
    routeId,
    routeName: route.name,
    theme,
    branchChoice: "",
    bossDefeated: false,
    nodesCleared: 0,
    lastNodeName: "第二层入口",
  };
  /* 用第二层地图替换一层地图（一层地图体验不受影响：此时一层已结束） */
  runState.mapState = createLayer2MapState(theme);
  runState.currentRouteStep = 1;
  runState.completedNodes = [];
  runState.lockedNodes = [];
  runState.currentNode = null;
  runState.bossPrepRelicGranted = true; /* 二层不再触发一层 Boss 前整备遗物 */
  layer2MarkProgress(routeId === "miasma" ? "miasmaEntered" : "bloodmarshEntered");
  getRunStats().layer2Entered = true;
  getRunStats().layer2Route = route.name;
  addJourneyLog(`命途未尽：你踏入第二层「${route.name}」，生态歧路在脚下重新铺开。`, "important");
  dom.runSummary?.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  showMapScreen();
}

/* 第二层奖励节点（残卷）：复用 V0.9.6 倾向选牌；完成后回二层地图 */
function enterLayer2RewardNode(node) {
  runState.currentNode = node;
  lockSiblingNodes(node);
  openLayer2Reward({ name: node.name }); /* 复用现成奖励面板；完成走 completeOverlayNode→二层返图 */
}

/* 第二层战斗/非战斗完成后：推进步进、回到二层地图；Boss → 二层结算 */
function layer2CompleteNodeAndReturnMap() {
  const st = runState?.layer2;
  if (!st || !runState?.currentNode) return;
  const node = runState.currentNode;
  if (!runState.completedNodes.includes(node.id)) runState.completedNodes.push(node.id);
  if (!runState.routeHistory.includes(node.name)) runState.routeHistory.push(node.name);
  st.nodesCleared = (st.nodesCleared || 0) + 1;
  st.lastNodeName = `${st.routeName}·${node.name}`;
  if (node.type === "boss") {
    st.bossDefeated = true;
    getRunStats().layer2BossDefeated = true;
    layer2MarkProgress(st.routeId === "miasma" ? "miasmaBossDefeated" : "bloodmarshBossDefeated");
    runState.currentNode = null;
    showLayer2Conclusion(true);
    return;
  }
  runState.lastMapNotice = `第二层 · ${node.name}已了`;
  runState.currentRouteStep = Math.min(MAX_ROUTE_STEP, node.step + 1);
  runState.currentNode = null;
  showMapScreen();
}

/* 第二层节点完成后推进（被 finishBattle 胜利分支 / 奖励完成 / 事件完成调用） */
function layer2OnNodeCleared() {
  const st = runState?.layer2;
  if (!st || !st.active) return false;
  const route = LAYER2_ROUTES[st.routeId];
  const node = route.nodes[st.nodeIndex];
  st.nodesCleared += 1;
  if (node && node.kind === "boss") {
    st.bossDefeated = true;
    getRunStats().layer2BossDefeated = true;
    layer2MarkProgress(st.routeId === "miasma" ? "miasmaBossDefeated" : "bloodmarshBossDefeated");
    st.nodeIndex += 1;
    showLayer2Conclusion(true);
    return true;
  }
  st.nodeIndex += 1;
  layer2Advance();
  return true;
}

/* 三选一分岔：普通战 / 休整 / 蛊坊（复用现有事件、休整、蛊坊入口） */
function showLayer2Branch(node) {
  const st = runState.layer2;
  const route = LAYER2_ROUTES[st.routeId];
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result layer2-branch-result";
  dom.cardRewardPanel.classList.add("hidden");
  dom.runSummary?.classList.add("hidden");
  dom.resultSeal.textContent = "岔";
  dom.resultEyebrow.textContent = `第二层 · ${route.name}`;
  dom.resultTitle.textContent = node.name;
  dom.resultDescription.textContent = "三念定局，择一而行。";
  dom.runSummary.innerHTML = `<div class="layer2-branch-grid">
    <button type="button" class="layer2-branch-card" data-layer2-branch="event"><strong>探秘机缘</strong><small>触发一次生态机缘事件</small></button>
    <button type="button" class="layer2-branch-card" data-layer2-branch="rest"><strong>沼隙休整</strong><small>回血或固本，养息一息</small></button>
    <button type="button" class="layer2-branch-card" data-layer2-branch="shop"><strong>残灯蛊坊</strong><small>以蛊石易牌与炼化机会</small></button>
  </div>`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

/* 选定分岔类型：复用现有非战斗节点入口；完成回调统一走 layer2 */
function chooseLayer2Branch(kind) {
  const st = runState?.layer2;
  if (!st || !st.active) return;
  st.branchChoice = kind;
  dom.runSummary.classList.add("hidden");
  runState.currentNode = {
    id: `layer2-${st.routeId}-${st.nodeIndex}`,
    step: MAX_ROUTE_STEP, type: kind,
    icon: kind === "event" ? "缘" : (kind === "rest" ? "息" : "坊"),
    name: kind === "event" ? "生态机缘" : (kind === "rest" ? "沼隙休整" : "残灯蛊坊"),
    description: MAP_NODE_DESCRIPTIONS[kind] || "", layer2: true,
  };
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  if (kind === "event") openChanceEvent();
  else if (kind === "rest") openRestNode();
  else if (kind === "shop") openShopNode();
}

/* 第二层奖励节点：在现有牌奖励池上对该路线倾向 key 加权（不改池、不新增卡） */
function openLayer2Reward(node) {
  const st = runState.layer2;
  const route = LAYER2_ROUTES[st.routeId];
  unlockLorePage(route.loreId); /* 复用现成残卷页，作“路线残卷”露出 */
  runState.layer2.rewardResolved = false;
  runState.rewardResolved = false;
  runState.materialRewardResolved = false;
  /* 复用 openCardReward 的展示，但用倾向选牌覆盖候选 */
  const choices = generateLayer2RewardChoices(route);
  runState.pendingRewardKeys = choices;
  dom.resultOverlay.querySelector(".result-card").className = "result-card";
  dom.resultSeal.textContent = "获";
  dom.resultEyebrow.textContent = `第二层 · ${route.name} 残卷`;
  dom.resultTitle.textContent = "生态收获";
  dom.resultDescription.textContent = "生态深处遗落的蛊卵，倾向此径之道。三选其一，或舍弃前行。";
  dom.runSummary?.classList.add("hidden");
  dom.cardRewardChoices.innerHTML = choices.map((key) => {
    const item = CARD_LIBRARY[key];
    return `<button class="reward-card" type="button" data-reward-card="${key}">
      <span class="reward-card-glyph">${item.glyph}</span><strong>${item.name}</strong>
      <small>${item.typeName} · ${item.cost} 真元</small><p>${getCardEffect(key, 0)}</p>
    </button>`;
  }).join("");
  dom.skipRewardButton.disabled = false;
  dom.cardRewardPanel.classList.remove("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

/* 倾向加权选牌：优先从 favoredCardKeys 取，余位用现有通用池补（去重） */
function generateLayer2RewardChoices(route) {
  const used = new Set();
  const out = [];
  const favored = (route.favoredCardKeys || []).filter((k) => CARD_LIBRARY[k]);
  while (out.length < 2 && favored.length) {
    const k = takeUniqueRandom(favored, used);
    if (!k) break;
    out.push(k); used.add(k);
  }
  while (out.length < 3) {
    const k = getRandomRewardCardKey({ rare: Math.random() < 0.35 });
    if (!k) break;
    if (!used.has(k)) { out.push(k); used.add(k); }
    if (used.size > 30) break;
  }
  return out.slice(0, 3);
}

/* 第二层结算页：扩展显示（是否进入二层/路线/Boss/节点/新增条目数） */
function showLayer2Conclusion(cleared) {
  const st = runState.layer2 || {};
  runState.status = "cleared";
  /* 把二层结果并入现有 showRunConclusion；统计字段已在 getRunStats 写入 */
  showRunConclusion(true);
  /* 在结算 summary 顶部补一段第二层信息（DOM 追加，不改 showRunConclusion 主体） */
  const route = LAYER2_ROUTES[st.routeId];
  const extra = document.createElement("div");
  extra.className = "run-summary-item wide layer2-summary-block";
  extra.innerHTML = `<span>第二层 · ${route ? route.name : "未进入"}</span><strong>` +
    `Boss「${route ? LAYER2_ROUTES[st.routeId].name : "-"}」${st.bossDefeated ? "已破" : "未破"} · ` +
    `推进 ${st.nodesCleared || 0} 节点 · 终点「${st.lastNodeName || "-"}」</strong>`;
  dom.runSummary?.prepend(extra);
  // 关键：finishBattle 的二层分支提前 return，不会走到通用的显示遮罩处，这里自己显示，避免 Boss 胜利后卡住。
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateMobileViewportState();
}

function completeOverlayNode() {
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  if (runState?.layer2?.active) { layer2CompleteNodeAndReturnMap(); return; }
  completeCurrentNodeAndReturnMap();
}

function getEventChoiceTone(option) {
  if ([
    "rareCard", "cardNextHurt", "lifespanMaterial", "bloodMaterials", "bloodLimit",
    "stealMaterialEnemyBuff", "hurtRelic", "lifespanTwoMaterials", "randomUpgradeBacklash", "poisonBloodResidue",
  ].includes(option.kind)) return "risk";
  if (["material", "heal", "stones", "removeBasic", "buyRandomCard", "removeAnyCard", "poisonCard"].includes(option.kind)) return "steady";
  return "safe";
}

function getEventChoiceMeta(option) {
  if (getEventChoiceTone(option) === "risk") return "高风险";
  if (getEventChoiceTone(option) === "steady") return "稳妥收益";
  return "安全";
}

function getEventMapNotice(event, option, resultText) {
  if (option?.materialId) return `你带走了${MATERIALS[option.materialId].name}`;
  if (option?.kind === "bloodMaterials") return "你带走了血砂与腐液";
  if (option?.kind === "stealMaterialEnemyBuff") return "你夺得一味材料，但惊动了后路";
  if (option?.kind === "hurtRelic") return "血签落定，一件遗物入囊";
  if (option?.kind === "poisonBloodResidue") return "毒血残留，腐液入囊";
  if (option?.kind === "leave") return `${event.name}：你安全离开`;
  return `${event.name}已定`;
}

function openChanceEvent() {
  const event = sample(CHANCE_EVENTS, 1)[0];
  runState.activeEventId = event.id;
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result";
  hideRewardPanels();
  dom.resultSeal.textContent = "缘";
  dom.resultEyebrow.textContent = "命途分岔 · 机缘";
  dom.resultTitle.textContent = "机缘入局";
  dom.resultDescription.textContent = "这不是战斗，但每一次伸手都要付出代价。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.eventName.textContent = event.name;
  dom.eventStory.textContent = event.story;
  dom.eventChoices.innerHTML = event.options.map((option, index) => `
    <button class="event-choice ${getEventChoiceTone(option)}" type="button" data-event-choice="${index}">
      <strong>${option.label}</strong><em>${getEventChoiceMeta(option)}</em><small>${option.detail}</small>
    </button>`).join("");
  dom.eventResult.classList.add("hidden");
  dom.eventResult.textContent = "";
  dom.eventPanel.classList.remove("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function resolveChanceChoice(index) {
  const event = CHANCE_EVENTS.find((item) => item.id === runState?.activeEventId);
  const option = event?.options?.[Number(index)];
  if (!event || !option) return;
  dom.eventChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  let resultText = "";
  switch (option.kind) {
    case "rareCard": {
      const lost = reduceRunHpSafely(8);
      const key = getRandomRewardCardKey({ rare: true });
      addRunDeckCard(key);
      resultText = `井底旧蜕划破掌心，你失去 ${lost} 点生命，获得「${CARD_LIBRARY[key].name}」。`;
      break;
    }
    case "material":
      gainMaterial(option.materialId, 1, event.name);
      resultText = `你收下「${MATERIALS[option.materialId].name}」。`;
      break;
    case "heal":
      resultText = `碑下气息回转，恢复 ${healRunHp(option.amount, event.name)} 点生命。`;
      break;
    case "attackInsight": {
      const attacks = runState.deckCards.filter((entry) => CARD_LIBRARY[entry.key]?.category === "attack");
      if (attacks.length) {
        const target = sample(attacks, 1)[0];
        target.damageBonus = (target.damageBonus || 0) + 3;
        resultText = `残碑杀诀烙入「${CARD_LIBRARY[target.key].name}」，本局伤害 +3。`;
        addLog(`残碑悟道：${CARD_LIBRARY[target.key].name}本局伤害 +3。`, "positive-log");
      } else {
        resultText = "你没有可悟道的攻击蛊，碑光自行熄灭。";
      }
      break;
    }
    case "cardNextHurt": {
      const key = getRandomRewardCardKey();
      addRunDeckCard(key);
      runState.nextBattleHpLoss += 4;
      resultText = `蛊卵孵出「${CARD_LIBRARY[key].name}」，下一场战斗开始会反噬 4 点生命。`;
      addLog(`蛊卵异动：获得${CARD_LIBRARY[key].name}，下一场战斗开始失去 4 点生命。`, "damage-log");
      break;
    }
    case "stones":
      gainGuStones(option.amount, event.name);
      resultText = `你获得 ${option.amount} 蛊石。`;
      break;
    case "lifespanMaterial":
      reduceRunLifespan(1);
      gainMaterial(option.materialId, 1, event.name);
      resultText = `残魂入袖，你失去 1 点寿元，获得「${MATERIALS[option.materialId].name}」。`;
      break;
    case "bloodMaterials": {
      const lost = reduceRunHpSafely(5);
      gainMaterial("bloodSand", 1, event.name);
      gainMaterial("rotLiquid", 1, event.name);
      resultText = `血灯吞火，你失去 ${lost} 点生命，获得血砂与腐液。`;
      break;
    }
    case "removeBasic": {
      const removed = removeRandomBasicCard();
      resultText = removed ? `旧蛊焚尽：「${CARD_LIBRARY[removed.key].name}」已从蛊囊移除。` : "没有可移除的基础蛊，或卡组已接近最低数量。";
      if (removed) addLog(`血灯夜祭：移除${CARD_LIBRARY[removed.key].name}。`, "positive-log");
      break;
    }
    case "bloodLimit":
      runState.bloodMaxBonus += 1;
      reduceRunMaxHp(3, event.name);
      resultText = "血灯余焰入体，血煞上限 +1，但最大生命 -3。";
      break;
    case "buyRandomCard": {
      if (!spendGuStones(option.cost || 10)) {
        resultText = "蛊石不足，商队收起货箱。";
        break;
      }
      const key = getRandomRewardCardKey();
      addRunDeckCard(key);
      resultText = `你花费 ${option.cost || 10} 蛊石，购得「${CARD_LIBRARY[key].name}」。`;
      addLog(`断桥商队：购得${CARD_LIBRARY[key].name}。`, "positive-log");
      break;
    }
    case "stealMaterialEnemyBuff": {
      const id = sample(MATERIAL_IDS, 1)[0];
      gainMaterial(id, 1, event.name);
      runState.nextBattleEnemyAttackBonus += 2;
      resultText = `残箱中藏着「${MATERIALS[id].name}」，但商队怨蛊惊动了前路；下一场敌人攻击 +2。`;
      break;
    }
    case "hurtRelic": {
      const lost = reduceRunHpSafely(4);
      if (runState.eventRelicGained) {
        gainGuStones(8, event.name);
        resultText = `血签已认过旧主，你失去 ${lost} 点生命，只从签灰中取到 8 蛊石。`;
      } else {
        const relicId = gainRandomOrdinaryRelic(event.name);
        runState.eventRelicGained = Boolean(relicId);
        resultText = relicId
          ? `血签入掌，你失去 ${lost} 点生命，获得遗物「${ORDINARY_RELICS[relicId].name}」。`
          : `你失去 ${lost} 点生命，但已无可得遗物。`;
      }
      break;
    }
    case "lifespanTwoMaterials": {
      reduceRunLifespan(1);
      const ids = [sample(MATERIAL_IDS, 1)[0], sample(MATERIAL_IDS, 1)[0]];
      ids.forEach((id) => gainMaterial(id, 1, event.name));
      resultText = `血签换材，你失去 1 点寿元，获得${ids.map((id) => MATERIALS[id].name).join("与")}。`;
      break;
    }
    case "removeAnyCard": {
      const removed = removeRandomDeckCard();
      resultText = removed ? `遗骸炉火吞去「${CARD_LIBRARY[removed.key].name}」。` : "卡组已接近最低数量，旧炉没有吞噬你的蛊。";
      if (removed) addLog(`蛊师遗骸：移除${CARD_LIBRARY[removed.key].name}。`, "positive-log");
      break;
    }
    case "randomUpgradeBacklash": {
      const candidates = getUpgradeableDeckEntries();
      if (!candidates.length) {
        resultText = "蛊匣里没有可炼化的蛊，小炉自行熄灭。";
        break;
      }
      const target = sample(candidates, 1)[0];
      // TODO: 事件结果随机待接入统一 RNG。
      const backlash = Math.random() < 0.2;
      const result = backlash ? applyBacklashFurnace(target) : applyStableFurnace(target, null, `遗骸小炉：${getDisplayCardName(target.key, getUpgradeLevel(target))}炉火转稳。`);
      resultText = backlash
        ? `小炉逆冲，${getCompactCardTitle(target)}遭遇反噬。`
        : `小炉余焰炼成「${getCompactCardTitle(target)}」。`;
      runState.lastEventNotice = `${event.name}：${result.title}`;
      break;
    }
    case "poisonCard": {
      const key = getRandomPoisonCardKey();
      addRunDeckCard(key);
      resultText = `毒潭吐出「${CARD_LIBRARY[key].name}」，已纳入蛊囊。`;
      addLog(`毒潭照影：获得${CARD_LIBRARY[key].name}。`, "poison-log");
      break;
    }
    case "poisonBloodResidue":
      runState.nextBattleHpLoss += 3;
      gainMaterial("rotLiquid", 1, event.name);
      resultText = "毒血残留入体：下一场战斗开局失去 3 点生命，获得腐液。";
      break;
    default:
      resultText = "你没有触碰机缘，安全离开。";
      addLog(`${event.name}：安全离开。`, "system-log");
  }
  runState.eventHistory.push(`${event.name}：${option.label}`);
  addLog(`${event.name}：${option.label}。${stripTags(resultText)}`, option.kind === "leave" ? "system-log" : "important");
  runState.lastEventNotice = getEventMapNotice(event, option, resultText);
  addLogToChannel("journey", `命途札记：${runState.lastEventNotice}。`, "system-log");
  dom.eventResult.textContent = resultText;
  dom.eventResult.classList.remove("hidden");
  dom.resultDescription.textContent = resultText;
  dom.resultPrimaryButton.textContent = "继续前行";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
}

function openRestNode() {
  const node = runState.currentNode;
  runState.lastRestChoice = "";
  runState.lastRestResult = "";
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result rest-result";
  hideRewardPanels();
  dom.resultSeal.textContent = "息";
  dom.resultEyebrow.textContent = `第 ${REST_ROUTE_STEP} 段 · 临门分岔`;
  dom.resultTitle.textContent = node?.name || "休整节点";
  dom.resultDescription.textContent = "塔隙只容一息。选一件事，便继续前行。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.eventName.textContent = node?.name || "休整";
  dom.eventStory.textContent = "腐风暂止，蛊火低伏。此处不能久留，只能择一调理。";
  const canRemove = runState.deckCards.length > 6;
  dom.eventChoices.innerHTML = `
    <button class="event-choice steady" type="button" data-rest-choice="heal">
      <strong>调息养命</strong><em>稳妥休整</em><small>恢复 12 点生命，不超过最大生命。</small>
    </button>
    <button class="event-choice ${canRemove ? "steady" : "safe"}" type="button" data-rest-choice="remove" ${canRemove ? "" : "disabled"}>
      <strong>整理蛊囊</strong><em>${canRemove ? "删去一蛊" : "卡组至少保留 6 张"}</em><small>移除 1 张卡牌，不能让蛊囊少于 6 张。</small>
    </button>
    <button class="event-choice steady" type="button" data-rest-choice="material">
      <strong>添火入炉</strong><em>炉材入囊</em><small>获得 1 个随机炼蛊材料，并获得 5 蛊石。</small>
    </button>`;
  dom.eventResult.classList.add("hidden");
  dom.eventResult.textContent = "";
  dom.eventPanel.classList.remove("hidden");
  dom.shopRemovePanel?.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function setRestChoiceButtonsDisabled(disabled) {
  dom.eventChoices?.querySelectorAll("[data-rest-choice]").forEach((button) => {
    if (button.dataset.restChoice === "remove" && runState.deckCards.length <= 6) {
      button.disabled = true;
    } else {
      button.disabled = disabled;
    }
  });
}

function completeRestChoice(label, resultText, logClass = "positive-log") {
  if (!runState || runState.lastRestChoice) return;
  runState.lastRestChoice = label;
  runState.lastRestResult = `${runState.currentNode?.name || "休整节点"}：${resultText}`;
  runState.restHistory.push(`${label}：${resultText}`);
  setRestChoiceButtonsDisabled(true);
  dom.eventResult.textContent = resultText;
  dom.eventResult.classList.remove("hidden");
  dom.resultDescription.textContent = resultText;
  addLog(`休整节点：${label}。${resultText}`, logClass);
  addLogToChannel("journey", `命途札记：${runState.lastRestResult}。`, "system-log");
  dom.resultPrimaryButton.textContent = "继续前行";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
}

function resolveRestChoice(choice) {
  if (!runState || runState.currentNode?.type !== "rest" || runState.lastRestChoice) return;
  playUiSfx();
  if (choice === "heal") {
    const healed = healRunHp(12, runState.currentNode.name);
    completeRestChoice("调息养命", `恢复 ${healed} 点生命。`);
    return;
  }
  if (choice === "material") {
    const id = sample(MATERIAL_IDS, 1)[0];
    gainMaterial(id, 1, runState.currentNode.name);
    gainGuStones(5, runState.currentNode.name);
    completeRestChoice("添火入炉", `获得${MATERIALS[id].name}与 5 蛊石。`);
    return;
  }
  if (choice === "remove") {
    if (runState.deckCards.length <= 6) return;
    setRestChoiceButtonsDisabled(true);
    openRestRemovePicker();
  }
}

function openRestRemovePicker() {
  try {
    if (!runState || runState.currentNode?.type !== "rest") return;
    if (runState.deckCards.length <= 6) {
      dom.eventResult.textContent = "卡组不可少于 6 张。";
      dom.eventResult.classList.remove("hidden");
      setRestChoiceButtonsDisabled(false);
      return;
    }
    pendingShopRemoveCardId = "";
    runState.pendingShopRemoveCardId = "";
    dom.eventPanel.classList.add("hidden");
    dom.shopPanel.classList.remove("hidden");
    if (dom.shopGuStones) dom.shopGuStones.textContent = runState.guStones;
    if (dom.shopOverview) dom.shopOverview.innerHTML = `<span>休整：整理蛊囊</span><span>当前蛊囊 ${runState.deckCards.length} 张</span>`;
    if (dom.shopCardChoices) dom.shopCardChoices.innerHTML = "";
    if (dom.shopActions) dom.shopActions.innerHTML = "";
    if (dom.shopCancelRemoveButton) dom.shopCancelRemoveButton.textContent = "返回休整";
    dom.shopRemovePanel.classList.remove("hidden");
    dom.shopRemoveConfirm?.classList.add("hidden");
    dom.shopRemoveChoices.innerHTML = runState.deckCards
      .map((entry) => renderDeckEntryCard(entry, { button: true, action: "data-shop-remove-card" }))
      .join("");
    dom.resultDescription.textContent = "选择一只蛊移出蛊囊。返回可重新选择休整方式。";
  } catch (error) {
    console.error("休整整理蛊囊：打开删卡界面失败", error);
    dom.eventPanel?.classList.remove("hidden");
    dom.shopPanel?.classList.add("hidden");
    dom.eventResult.textContent = "蛊囊一时紊乱，请重试。";
    dom.eventResult.classList.remove("hidden");
    setRestChoiceButtonsDisabled(false);
  }
}

function removeRestCard(instanceId) {
  if (!runState || runState.currentNode?.type !== "rest" || runState.lastRestChoice || runState.deckCards.length <= 6) return;
  const removed = removeDeckEntryById(instanceId);
  if (!removed) return;
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  dom.shopPanel?.classList.add("hidden");
  dom.shopRemovePanel.classList.add("hidden");
  dom.eventPanel?.classList.remove("hidden");
  completeRestChoice("整理蛊囊", `移除「${CARD_LIBRARY[removed.key].name}」。`, "positive-log");
}

function getShopState() {
  const nodeId = runState.currentNode?.id || "shop";
  if (!runState.shopPurchases[nodeId]) {
    runState.shopPurchases[nodeId] = {
      cards: [false, false, false],
      heal: false,
      remove: false,
      material: false,
    };
  }
  return runState.shopPurchases[nodeId];
}

function openShopNode() {
  runState.activeShopStock = generateCardRewardChoices(runState.heroId);
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.querySelector(".result-card").className = "result-card map-result shop-result";
  hideRewardPanels();
  dom.resultSeal.textContent = "坊";
  dom.resultEyebrow.textContent = "命途分岔 · 蛊坊";
  dom.resultTitle.textContent = "暗灯蛊坊";
  dom.resultDescription.textContent = "蛊坊只开一刻。买定离手，离开后本段命途即定。";
  dom.resultTurns.textContent = "—";
  dom.resultHp.textContent = runState.currentHp;
  dom.shopPanel.classList.remove("hidden");
  renderShop();
  dom.resultPrimaryButton.textContent = "离开蛊坊";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.remove("hidden");
  refreshModalLock();
}

function getShopTradeLabel(purchased, price) {
  if (purchased) return "已交易";
  if (runState.guStones < price) return "蛊石不足";
  return `${price} 蛊石`;
}

function hasShopDiscountAvailable() {
  return hasOrdinaryRelic("shopContract") && !runState.shopDiscountUsed;
}

function getShopPrice(basePrice) {
  return hasShopDiscountAvailable() ? Math.floor(basePrice * 0.7) : basePrice;
}

function spendShopStones(basePrice) {
  const discounted = hasShopDiscountAvailable();
  const price = getShopPrice(basePrice);
  if (!spendGuStones(price)) return false;
  if (discounted) {
    runState.shopDiscountUsed = true;
    addLog(`蛊坊残契生效：本次交易价格降为 ${price} 蛊石。`, "positive-log");
  }
  return true;
}

function renderShopOverview() {
  if (!dom.shopOverview) return;
  dom.shopOverview.innerHTML = `
    <span><em>蛊石</em><strong>${runState.guStones}</strong></span>
    <span><em>生命</em><strong>${runState.currentHp}/${runState.maxHp}</strong></span>
    <span><em>蛊牌</em><strong>${runState.deckCards.length} 张</strong></span>`;
}

function renderShop() {
  const state = getShopState();
  updateGuStoneDisplays();
  renderShopOverview();
  const cardPrice = getShopPrice(12);
  const healPrice = getShopPrice(9);
  const removePrice = getShopPrice(18);
  const materialPrice = getShopPrice(11);
  pendingShopRemoveCardId = "";
  if (runState) runState.pendingShopRemoveCardId = "";
  dom.shopRemoveConfirm?.classList.add("hidden");
  const cardItems = runState.activeShopStock.map((key, index) => {
    const item = CARD_LIBRARY[key];
    const disabled = state.cards[index] || runState.guStones < cardPrice;
    return `<button class="shop-card-item reward-card" type="button" data-shop-card-index="${index}" ${disabled ? "disabled" : ""}>
      <span class="reward-card-glyph">${item.glyph}</span><strong>${item.name}</strong>
      <small>${item.typeName} · ${item.cost} 真元</small>
      <p>${getCardEffect(key, 0)}</p>
      <em class="shop-buy-state">${getShopTradeLabel(state.cards[index], cardPrice)}</em>
    </button>`;
  }).join("");
  dom.shopCardChoices.innerHTML = `<h4 class="shop-group-title">购入蛊牌</h4>${cardItems}`;
  const canRemove = runState.deckCards.length > 6 && runState.guStones >= removePrice && !state.remove;
  const removeReason = state.remove ? "已交易" : runState.deckCards.length <= 6 ? "卡组至少保留 6 张" : runState.guStones < removePrice ? "蛊石不足" : `${removePrice} 蛊石`;
  dom.shopActions.innerHTML = `
    <h4 class="shop-group-title">疗伤</h4>
    <button type="button" data-shop-action="heal" ${state.heal || runState.guStones < healPrice ? "disabled" : ""}><strong>调息疗伤</strong><small>恢复 14 生命</small><em>${getShopTradeLabel(state.heal, healPrice)}</em></button>
    <h4 class="shop-group-title">移除蛊牌</h4>
    <button type="button" data-shop-action="remove" ${canRemove ? "" : "disabled"}><strong>焚去一蛊</strong><small>删除 1 张卡</small><em>${removeReason}</em></button>
    <h4 class="shop-group-title">购入材料</h4>
    <button type="button" data-shop-action="material" ${state.material || runState.guStones < materialPrice ? "disabled" : ""}><strong>购入炉材</strong><small>随机获得 1 个材料</small><em>${getShopTradeLabel(state.material, materialPrice)}</em></button>`;
}

function buyShopCard(index) {
  const state = getShopState();
  const key = runState.activeShopStock[Number(index)];
  if (!key || state.cards[index] || !spendShopStones(12)) return;
  state.cards[index] = true;
  addRunDeckCard(key);
  addLog(`蛊坊购牌：${CARD_LIBRARY[key].name}加入蛊囊。`, "positive-log");
  renderShop();
}

function buyShopHeal() {
  const state = getShopState();
  if (state.heal || !spendShopStones(9)) return;
  state.heal = true;
  healRunHp(14, "蛊坊调息");
  renderShop();
}

function buyShopMaterial() {
  const state = getShopState();
  if (state.material || !spendShopStones(11)) return;
  state.material = true;
  const id = sample(MATERIAL_IDS, 1)[0];
  gainMaterial(id, 1, "蛊坊购材");
  renderShop();
}

function openShopRemovePicker() {
  const state = getShopState();
  if (state.remove || runState.deckCards.length <= 6 || runState.guStones < getShopPrice(18)) return;
  if (dom.shopCancelRemoveButton) dom.shopCancelRemoveButton.textContent = "返回蛊坊";
  dom.shopRemovePanel.classList.remove("hidden");
  dom.shopRemoveConfirm?.classList.add("hidden");
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  dom.shopRemoveChoices.innerHTML = runState.deckCards
    .map((entry) => renderDeckEntryCard(entry, { button: true, action: "data-shop-remove-card" }))
    .join("");
}

function cancelShopRemovePicker() {
  pendingShopRemoveCardId = "";
  if (runState) runState.pendingShopRemoveCardId = "";
  dom.shopRemoveConfirm?.classList.add("hidden");
  dom.shopRemovePanel.classList.add("hidden");
  if (runState?.currentNode?.type === "rest" && !runState.lastRestChoice) {
    dom.shopPanel?.classList.add("hidden");
    dom.eventPanel?.classList.remove("hidden");
    dom.eventResult.classList.add("hidden");
    dom.resultDescription.textContent = "塔隙只容一息。选一件事，便继续前行。";
    setRestChoiceButtonsDisabled(false);
  }
}

function previewShopRemoveCard(instanceId) {
  const entry = runState?.deckCards.find((card) => card.instanceId === instanceId);
  if (!entry || !dom.shopRemoveConfirm) return;
  pendingShopRemoveCardId = instanceId;
  runState.pendingShopRemoveCardId = instanceId;
  const level = getUpgradeLevel(entry);
  const status = [
    level > 0 ? `炼化 +${level}` : "未炼化",
    ...getEntryStatusLabels(entry),
  ].join(" · ");
  const suffix = runState?.currentNode?.type === "rest" ? "休整后此蛊将离开蛊囊。" : "移除后不会返还蛊石。";
  dom.shopRemoveConfirmText.textContent = `${getDisplayCardName(entry.key, level)}（${status || "稳定"}）。${suffix}`;
  dom.shopRemoveConfirm.classList.remove("hidden");
}

function confirmShopRemoveCard() {
  if (!pendingShopRemoveCardId) return;
  if (runState?.currentNode?.type === "rest") {
    removeRestCard(pendingShopRemoveCardId);
    return;
  }
  removeShopCard(pendingShopRemoveCardId);
}

function removeShopCard(instanceId) {
  const state = getShopState();
  if (state.remove || runState.deckCards.length <= 6 || !spendShopStones(18)) return;
  const removed = removeDeckEntryById(instanceId);
  if (!removed) return;
  state.remove = true;
  pendingShopRemoveCardId = "";
  runState.pendingShopRemoveCardId = "";
  addLog(`蛊坊：移除${CARD_LIBRARY[removed.key].name}。`, "positive-log");
  dom.shopRemovePanel.classList.add("hidden");
  renderShop();
}

function startFloorBattle() {
  if (!runState) return;
  // TODO: 后续多幕路线扩展时抽象 finalNode / bossNode。
  const isBossNode = runState.currentNode?.type === "boss" || runState.floor === MAX_ROUTE_STEP;
  const musicScene = isBossNode ? "boss" : "battle";
  window.AudioManager?.playScene(musicScene, { duration: isBossNode ? 600 : 520 });
  document.body.classList.add("hand-dealing");
  window.setTimeout(() => document.body.classList.remove("hand-dealing"), 900);
  clearCombatEffects();
  game = createBattleState();
  recordBattleStarted();
  runState.rewardResolved = false;
  runState.materialRewardResolved = isBossNode;
  runState.refinementResolved = true;
  runState.furnaceResolved = runState.currentNode?.type !== "elite";
  switchLogChannel("battle");
  resetBattleLog();
  dom.startScreen.classList.add("hidden");
  dom.mapScreen?.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  document.body.classList.remove("modal-open");
  dom.resultOverlay.querySelector(".result-card").className = "result-card";
  hideRewardPanels();
  dom.furnaceMaterialChoices?.classList.add("hidden");
  dom.furnaceMaterialList?.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  document.body.classList.remove("title-open");

  if (runState.nextBattleHpLoss > 0) {
    const lost = Math.min(runState.nextBattleHpLoss, Math.max(0, game.player.hp - 1));
    game.player.hp -= lost;
    runState.currentHp = game.player.hp;
    addLog(`命途余毒：本场战斗开始失去 ${lost} 点生命。`, "damage-log");
    runState.nextBattleHpLoss = 0;
  }
  if (game.enemyAttackBonus > 0) {
    addLog(`岔路恶果：本场战斗敌人攻击 +${game.enemyAttackBonus}。`, "damage-log");
    runState.nextBattleEnemyAttackBonus = 0;
  }
  if (game.enemy.towerPressure) {
    addLog("塔压：此战敌人生命略微提高。", "enemy-log");
  }
  if (game.combatRelic?.greenPouchCardName) {
    addLog(`青囊虫生效：本场「${game.combatRelic.greenPouchCardName}」消耗 -1。`, "positive-log");
  }

  drawToHandSize(game.handTarget);
  chooseEnemyIntent();
  const enemyName = game.enemy.definition.name;
  const heroName = game.player.definition.name;
  addLog(`${heroName}踏入命途图第 ${runState.floor} 段，${enemyName}自晦暗中现身。`, "system-log");
  addLog(`当前蛊匣共 ${runState.deckCards.length} 张牌；生命与寿元承接上一层。`, "system-log");
  addLog(`第 1 回合开始：真元恢复至 ${game.player.baseEnergy}，抽牌至 ${game.handTarget} 张。`, "important");
  applyHeroTurnStartPassive(true);
  logPassiveOpening();
  setBattleMessage(game.enemy.definition.intro);
  render();
  showTurnBanner("第 1 回合", "真元回涌");
  maybeShowBattleCoach();
  if (runState.currentNode?.type === "elite") {
    addLog("精英：血纹狼王现身。", "damage-log");
    showTurnBanner("精英现身", "血纹狼王现身");
  }
  if (isBossNode) playBossWakeEffect();
}

function resetRunToTitle() {
  // 彻底移除上一局的界面残留，避免日志、手牌或动画带入新局。
  clearCombatEffects();
  window.clearTimeout(mapNoticeTimer);
  window.clearTimeout(mapTransitionTimer);
  mapNoticeTimer = null;
  mapTransitionTimer = null;
  pendingEliteNodeId = "";
  pendingShopRemoveCardId = "";
  runState = null;
  game = null;
  cardSerial = 0;
  resetAllLogs();
  dom.hand.innerHTML = "";
  dom.buffList.innerHTML = "";
  dom.enemyStatusList.innerHTML = "";
  dom.towerProgress.innerHTML = "";
  dom.mapScreen?.classList.add("hidden");
  hideRewardPanels();
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultPrimaryButton.dataset.action = "";
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultOverlay.classList.add("hidden");
  dom.deckOverlay?.classList.add("hidden");
  closeBattleCoach(false);
  hideKeywordTooltip();
  refreshModalLock();
  window.AudioManager?.playScene("menu", { duration: 560, quiet: true });
  showStartScreen();
}

function logPassiveOpening() {
  const relic = RELICS[runState.relicId];
  const hero = game.player.definition;
  addLog(`蛊修被动「${hero.passiveName}」：${hero.passive}`, "system-log");
  addLog(`本命遗物「${relic.name}」已生效：${relic.description}`, "system-log");
  if (runState.ordinaryRelics.length) {
    const ordinaryText = runState.ordinaryRelics.map((id) => `${ORDINARY_RELICS[id].name}`).join("、");
    addLog(`随身遗物：${ordinaryText}。`, "system-log");
  }
  if (runState.relicId === "boneCarapace") {
    spawnFloatText(dom.playerPortrait, "+3 护甲", "defense-float");
    playArmorEffect();
  }
  if (runState.startArmorBonus > 0) {
    addLog("炼蛊强化「玄甲蛊壳」生效：本场战斗开始获得 5 点防御。", "positive-log");
    spawnFloatText(dom.playerPortrait, "+5 护甲", "defense-float");
    playArmorEffect();
  }
}

function maybeAutoOpenTutorial() {
  if (!dom.tutorialOverlay || tutorialAutoPrompted || getStoredFlag(TUTORIAL_STORAGE_KEY)) return;
  tutorialAutoPrompted = true;
  window.setTimeout(() => {
    if (!dom.startScreen.classList.contains("hidden") && dom.tutorialOverlay.classList.contains("hidden")) {
      openTutorial();
    }
  }, 180);
}

function openTutorial(page = 0) {
  if (!dom.tutorialOverlay) return;
  tutorialPageIndex = Math.max(0, Math.min(TUTORIAL_PAGES.length - 1, page));
  renderTutorialPage();
  dom.tutorialOverlay.classList.remove("hidden");
  refreshModalLock();
  dom.tutorialNextButton?.focus();
}

function closeTutorial({ markSeen = true } = {}) {
  dom.tutorialOverlay?.classList.add("hidden");
  if (markSeen) setStoredFlag(TUTORIAL_STORAGE_KEY, true);
  refreshModalLock();
}

function getLorePage(id) {
  return LORE_PAGES.find((page) => page.id === id) || null;
}

function renderLoreOverlay() {
  const unlockedCount = LORE_PAGES.filter((page) => isLoreUnlocked(page.id)).length;
  if (dom.loreProgress) dom.loreProgress.textContent = `残卷目录 · 已显 ${unlockedCount} / ${LORE_PAGES.length} 页`;
  if (!dom.loreList) return;
  dom.loreList.innerHTML = selectedLoreId ? renderLoreDetail(selectedLoreId) : renderLoreDirectory();
  updateLoreSettingControls();
}

function renderLoreDirectory() {
  return LORE_PAGES.map((page) => {
    const unlocked = isLoreUnlocked(page.id);
    const tag = unlocked ? "button" : "article";
    const action = unlocked ? ` type="button" data-lore-open="${page.id}"` : "";
    return `<${tag} class="lore-page lore-index-card ${unlocked ? "unlocked" : "locked"}"${action}>
      <div class="lore-index-head">
        <h3>${page.title}</h3>
        <span class="lore-status-pill">${unlocked ? "已解锁" : "残页未显"}</span>
      </div>
      <span class="lore-source">${unlocked ? page.source : page.hint}</span>
      <p class="lore-body">${unlocked ? page.teaser : "此页尚沉于命途中。"}</p>
      <strong class="lore-quote">${unlocked ? page.quote : "炉火未燃，此页未显。"}</strong>
    </${tag}>`;
  }).join("");
}

function renderLoreDetail(id) {
  const page = getLorePage(id);
  if (!page || !isLoreUnlocked(id)) {
    selectedLoreId = "";
    return renderLoreDirectory();
  }
  const animationClass = loreSkipAnimation ? "animation-skipped" : "unfolding";
  return `<article class="lore-detail ${animationClass}" data-lore-detail>
    <button class="lore-back-button" type="button" data-lore-back>返回目录</button>
    <span class="lore-source">${page.source}</span>
    <h3>${page.title}</h3>
    <p class="lore-body lore-detail-body">${page.body}</p>
    <strong class="lore-quote lore-detail-quote">${page.quote}</strong>
    <div class="lore-detail-actions">
      <button type="button" data-lore-copy="${page.id}">复制金句</button>
    </div>
  </article>`;
}

function openLoreDetail(id) {
  if (!isLoreUnlocked(id)) return;
  selectedLoreId = id;
  renderLoreOverlay();
}

function showLoreStatus(message) {
  if (!dom.loreProgress) return;
  dom.loreProgress.textContent = message;
}

async function copyLoreQuote(id) {
  const page = getLorePage(id);
  if (!page) return;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(page.quote);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    try {
      const input = document.createElement("textarea");
      input.value = page.quote;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      copied = document.execCommand?.("copy") || false;
      input.remove();
    } catch {
      copied = false;
    }
  }
  if (copied) showLoreStatus("残句已入剪贴板。");
}

function openLoreOverlay() {
  if (!dom.loreOverlay) return;
  selectedLoreId = "";
  renderLoreOverlay();
  dom.loreOverlay.classList.remove("hidden");
  refreshModalLock();
  dom.loreCloseButton?.focus();
}

function closeLoreOverlay() {
  selectedLoreId = "";
  dom.loreOverlay?.classList.add("hidden");
  refreshModalLock();
}

function renderTutorialPage() {
  const page = TUTORIAL_PAGES[tutorialPageIndex];
  if (!page) return;
  dom.tutorialTitle.textContent = page.title;
  dom.tutorialBody.innerHTML = `<ul>${page.lines.map((line) => `<li>${line}</li>`).join("")}</ul>`;
  dom.tutorialPageText.textContent = `${tutorialPageIndex + 1} / ${TUTORIAL_PAGES.length}`;
  dom.tutorialDots.innerHTML = TUTORIAL_PAGES.map((_, index) => `<b class="${index === tutorialPageIndex ? "current" : ""}"></b>`).join("");
  dom.tutorialPrevButton.disabled = tutorialPageIndex === 0;
  dom.tutorialNextButton.textContent = tutorialPageIndex === TUTORIAL_PAGES.length - 1 ? "完成" : "下一页";
}

function nextTutorialPage() {
  if (tutorialPageIndex >= TUTORIAL_PAGES.length - 1) {
    closeTutorial();
    return;
  }
  tutorialPageIndex += 1;
  renderTutorialPage();
}

function previousTutorialPage() {
  tutorialPageIndex = Math.max(0, tutorialPageIndex - 1);
  renderTutorialPage();
}

function resetNewPlayerGuidance() {
  setStoredFlag(TUTORIAL_STORAGE_KEY, false);
  setStoredFlag(BATTLE_TIPS_STORAGE_KEY, false);
  tutorialAutoPrompted = false;
  closeBattleCoach(false);
  openTutorial(0);
  if (dom.runProgress) {
    dom.runProgress.textContent = "新手提示已重置。";
    dom.runProgress.classList.remove("hidden");
  }
}

function maybeShowBattleCoach() {
  if (!dom.battleCoach || getStoredFlag(BATTLE_TIPS_STORAGE_KEY)) return;
  dom.battleCoach.classList.remove("hidden");
}

function closeBattleCoach(markSeen = true) {
  if (markSeen) setStoredFlag(BATTLE_TIPS_STORAGE_KEY, true);
  dom.battleCoach?.classList.add("hidden");
}

function showKeywordTooltip(target) {
  if (!target || !dom.keywordTooltip) return;
  const keyword = target.dataset.keyword;
  const text = KEYWORD_HELP[keyword] || ENEMY_STATUS_HELP[keyword];
  if (!text) return;
  dom.keywordTooltip.innerHTML = `<strong>${keyword}</strong><span>${text}</span>`;
  dom.keywordTooltip.classList.remove("hidden");
  dom.keywordTooltip.dataset.activeKeyword = keyword;
  window.requestAnimationFrame(() => positionKeywordTooltip(target));
}

function positionKeywordTooltip(target) {
  if (!target || !dom.keywordTooltip || dom.keywordTooltip.classList.contains("hidden")) return;
  const rect = target.getBoundingClientRect();
  const tip = dom.keywordTooltip;
  const tipRect = tip.getBoundingClientRect();
  const margin = 10;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - tipRect.width - margin, left));
  let top = rect.top - tipRect.height - 8;
  if (top < margin) top = rect.bottom + 8;
  top = Math.max(margin, Math.min(window.innerHeight - tipRect.height - margin, top));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideKeywordTooltip() {
  if (!dom.keywordTooltip) return;
  dom.keywordTooltip.classList.add("hidden");
  delete dom.keywordTooltip.dataset.activeKeyword;
}

function closeTopLayerByEsc() {
  if (dom.settingsOverlay && !dom.settingsOverlay.classList.contains("hidden")) {
    closeSettingsOverlay();
    return;
  }
  if (dom.trialSettingsOverlay && !dom.trialSettingsOverlay.classList.contains("hidden")) {
    closeTrialSettingsOverlay();
    return;
  }
  if (dom.runStatsOverlay && !dom.runStatsOverlay.classList.contains("hidden")) {
    closeRunStatsOverlay();
    return;
  }
  if (dom.balanceOverlay && !dom.balanceOverlay.classList.contains("hidden")) {
    closeBalanceOverlay();
    return;
  }
  if (dom.loreOverlay && !dom.loreOverlay.classList.contains("hidden")) {
    closeLoreOverlay();
    return;
  }
  if (dom.tutorialOverlay && !dom.tutorialOverlay.classList.contains("hidden")) {
    closeTutorial();
    return;
  }
  if (dom.deckOverlay && !dom.deckOverlay.classList.contains("hidden")) {
    closeDeckOverlay();
    return;
  }
  if (dom.battleCoach && !dom.battleCoach.classList.contains("hidden")) {
    closeBattleCoach();
    return;
  }
  if (document.body.classList.contains("mobile-audio-open")) {
    closeMobileAudioPanel();
    return;
  }
  if (document.body.classList.contains("mobile-log-open")) {
    closeMobileLogPanel();
    return;
  }
  hideKeywordTooltip();
}

// 主角被动统一在回合开始触发，避免分散到开局和后续回合两套逻辑中。
function applyHeroTurnStartPassive(isFirstTurn = false) {
  if (game.player.heroId === "poison") {
    applyEnemyPoison(1, "万毒归宗", { corrosive: false, logClass: "system-log" });
    if (isFirstTurn) addLog("毒道被动「万毒归宗」已启：重复施毒会触发蚀毒。", "system-log");
  }
}

function drawOneCard() {
  if (game.drawPile.length === 0) {
    if (game.discardPile.length === 0) return false;
    game.drawPile = shuffle(game.discardPile);
    game.discardPile = [];
    addLog("蛊匣轮转：弃牌堆已洗回抽牌堆。", "system-log");
  }
  game.hand.push(game.drawPile.pop());
  return true;
}

function drawCards(count) {
  let drawn = 0;
  for (let i = 0; i < count; i += 1) {
    if (!drawOneCard()) break;
    drawn += 1;
  }
  if (drawn > 0) playDrawCardEffect(drawn);
}

function drawToHandSize(targetSize) {
  while (game.hand.length < targetSize) {
    if (!drawOneCard()) break;
  }
}

function chooseEnemyIntent() {
  // TODO: 敌人意图随机待接入统一 RNG。
  const keys = Object.keys(game.enemy.definition.actions);
  game.enemy.intent = keys[Math.floor(Math.random() * keys.length)];
}

function getCurrentEnemyAction() {
  const action = game.enemy.definition.actions[game.enemy.intent];
  if (!action) return {};
  if (game.enemy.phase2) {
    // 尸盘监守（一层 Boss）相位改写，保持原值不动
    if (game.enemy.id === "corpsepuppet") {
      if (game.enemy.intent === "corpseClaw") return { ...action, damage: 12 };
      if (game.enemy.intent === "guFireBreath") return { ...action, damage: 8, playerPoison: 3 };
      if (game.enemy.intent === "corpseCharge") return { ...action, bonus: 9 };
    }
    // 第二层 Boss · 百瘴母蛊「瘴母苏醒」：毒更猛
    if (game.enemy.id === "miasmaMotherBoss") {
      if (game.enemy.intent === "maternalLash") return { ...action, damage: 11, playerPoison: 3 };
      if (game.enemy.intent === "hundredMiasma") return { ...action, damage: 7, playerPoison: 6 };
      if (game.enemy.intent === "broodCharge") return { ...action, bonus: 9 };
    }
    // 第二层 Boss · 血衣蛊母「血衣覆身」：吸血与压迫更强
    if (game.enemy.id === "bloodRobeMotherBoss") {
      if (game.enemy.intent === "robeLash") return { ...action, damage: 12, lifesteal: 7 };
      if (game.enemy.intent === "bloodOffering") return { ...action, damage: 17, lowHpExtra: 8 };
      if (game.enemy.intent === "crimsonGather") return { ...action, bonus: 9, lifesteal: 8 };
    }
  }
  return action;
}

function getLogList(channel = activeLogChannel) {
  return channel === "journey" ? journeyLogs : battleLogs;
}

function setLogList(channel, list) {
  if (channel === "journey") journeyLogs = list;
  else battleLogs = list;
}

function getLogElement(channel = activeLogChannel) {
  return channel === "journey" ? dom.journeyLog : dom.battleLog;
}

function updateLogTabs() {
  dom.logBattleTab?.classList.toggle("active", activeLogChannel === "battle");
  dom.logJourneyTab?.classList.toggle("active", activeLogChannel === "journey");
  dom.logBattleTab?.setAttribute("aria-selected", String(activeLogChannel === "battle"));
  dom.logJourneyTab?.setAttribute("aria-selected", String(activeLogChannel === "journey"));
  dom.battleLog?.classList.toggle("hidden", activeLogChannel !== "battle");
  dom.journeyLog?.classList.toggle("hidden", activeLogChannel !== "journey");
  if (dom.logTitle) dom.logTitle.textContent = activeLogChannel === "journey" ? "命途札记" : "战斗铭刻";
}

function isLogAtBottom(channel = activeLogChannel) {
  const target = getLogElement(channel);
  if (!target) return true;
  return target.scrollHeight - target.scrollTop - target.clientHeight <= 16;
}

// 双日志分卷：战斗铭刻记录战斗，命途札记记录路线、机缘、蛊坊、炼蛊和残卷。
function renderLogChannel(channel = activeLogChannel, { scrollMode = "bottom", previousScrollTop = 0 } = {}) {
  const target = getLogElement(channel);
  if (!target || !dom.logHistoryToggle) return;
  const list = getLogList(channel);
  const hiddenCount = Math.max(0, list.length - LOG_PREVIEW_COUNT);
  const expanded = Boolean(logsExpanded[channel]);
  const visibleLogs = expanded ? list : list.slice(-LOG_PREVIEW_COUNT);
  target.innerHTML = visibleLogs.map((entry) => (
    `<li class="${entry.className || ""}">${entry.message}</li>`
  )).join("");

  if (channel === activeLogChannel) {
    dom.logHistoryToggle.classList.toggle("hidden", hiddenCount === 0);
    dom.logHistoryToggle.textContent = expanded
      ? "收起旧记录"
      : `展开更早记录（${hiddenCount}）`;
    dom.logHistoryToggle.setAttribute("aria-expanded", String(expanded));
  }

  if (scrollMode === "preserve") target.scrollTop = previousScrollTop;
  else if (scrollMode === "top") target.scrollTop = 0;
  else target.scrollTop = target.scrollHeight;
}

function switchLogChannel(channel) {
  if (!["battle", "journey"].includes(channel)) return;
  activeLogChannel = channel;
  updateLogTabs();
  renderLogChannel(channel, { scrollMode: "bottom" });
}

function resetLogChannel(channel, summary = "") {
  setLogList(channel, []);
  logsExpanded[channel] = false;
  if (summary) setLogList(channel, [{ message: summary, className: "system-log" }]);
  renderLogChannel(channel);
}

function resetAllLogs() {
  battleLogs = [];
  journeyLogs = [];
  logsExpanded = { battle: false, journey: false };
  renderLogChannel("battle");
  renderLogChannel("journey");
}

function resetBattleLog() {
  resetLogChannel("battle");
}

function addLogToChannel(channel, message, className = "") {
  const wasAtBottom = isLogAtBottom(channel);
  const target = getLogElement(channel);
  const previousScrollTop = target?.scrollTop || 0;
  const list = getLogList(channel);
  list.push({ message, className });
  if (list.length > MAX_BATTLE_LOGS) list.shift();
  setLogList(channel, list);
  const shouldPreserve = logsExpanded[channel] && !wasAtBottom;
  renderLogChannel(channel, {
    scrollMode: shouldPreserve ? "preserve" : "bottom",
    previousScrollTop,
  });
}

function addLog(message, className = "") {
  addLogToChannel("battle", message, className);
}

function addJourneyLog(message, className = "") {
  addLogToChannel("journey", message, className);
}

function toggleOlderLogs() {
  const list = getLogList(activeLogChannel);
  if (list.length <= LOG_PREVIEW_COUNT) return;
  logsExpanded[activeLogChannel] = !logsExpanded[activeLogChannel];
  renderLogChannel(activeLogChannel, { scrollMode: logsExpanded[activeLogChannel] ? "top" : "bottom" });
}

function setBattleMessage(message) {
  dom.battleMessage.textContent = message;
}

function getEffectiveCardCost(card) {
  const reduction = Math.max(0, game?.player?.nextCardCostReduction || 0);
  return Math.max(0, card.cost - reduction);
}

function getCardBlockReason(card) {
  const values = getCardValues(card);
  if (game.player.energy < getEffectiveCardCost(card)) return "真元不足";
  const bloodCost = values.bloodCost || card.bloodCost || 0;
  const lifespanCost = values.lifespanCost || card.lifespanCost || 0;
  if (bloodCost && game.player.blood < bloodCost) return `需要 ${bloodCost} 层血煞`;
  if (lifespanCost && game.player.lifespan < lifespanCost) return "寿元不足";
  return "";
}

function playUiSfx() {
  window.AudioManager?.playSfx?.("uiClick", { volumeScale: 0.42 });
}

function initEffectSettings() {
  // 视觉特效只影响表现，不参与任何战斗数值；设置持久化到 localStorage。
  try {
    const stored = localStorage.getItem(EFFECT_STORAGE_KEY);
    effectsEnabled = stored !== "false";
  } catch {
    effectsEnabled = true;
  }
  updateEffectControls();
}

function updateEffectControls() {
  if (!dom.effectToggle || !dom.effectStatus) return;
  dom.effectToggle.setAttribute("aria-pressed", String(effectsEnabled));
  dom.effectToggle.classList.toggle("is-off", !effectsEnabled);
  dom.effectStatus.textContent = effectsEnabled ? "开" : "关";
  if (dom.settingsEffectToggle) dom.settingsEffectToggle.textContent = `战斗特效：${effectsEnabled ? "开" : "关"}`;
}

function setEffectsEnabled(enabled) {
  effectsEnabled = Boolean(enabled);
  try {
    localStorage.setItem(EFFECT_STORAGE_KEY, effectsEnabled ? "true" : "false");
  } catch {
    // 本地存储不可用时仍允许本次页面内切换，不影响游戏运行。
  }
  if (!effectsEnabled) clearEffectLayerOnly();
  updateEffectControls();
}

function toggleVisualEffects() {
  setEffectsEnabled(!effectsEnabled);
}

function playCardSfx(card) {
  window.AudioManager?.playSfx?.("cardPlay", { volumeScale: 0.56 });
  window.setTimeout(() => {
    if (card.type === "poison" || card.typeName.includes("毒道")) {
      window.AudioManager?.playSfx?.("poisonApply", { volumeScale: 0.62 });
    } else if (card.category === "defense") {
      window.AudioManager?.playSfx?.("block", { volumeScale: 0.58 });
    } else if (card.category === "attack") {
      const heavy = card.cost >= 2 || card.type === "blood" || stripTags(card.effect).includes("16");
      window.AudioManager?.playSfx?.(heavy ? "hitHeavy" : "hitLight", { volumeScale: heavy ? 0.58 : 0.52 });
    }
  }, 80);
}

// 更新公告（只记正式版本；最新的放最前）。
const UPDATE_LOG = [
  { v: "V0.9.6.1", title: "第二层地图化 + 敌人状态说明", notes: [
    "第二层升级为真正的分岔地图：起点双岔→精英/机缘/蛊坊多选→生态残卷→第二层 Boss，复用一层地图的渲染与点击",
    "瘴林 / 血沼主题影响普通战与精英、Boss 敌人池，进二层即有「新一关」感",
    "敌人状态图标可点击 / 长按查看说明（毒性、防御、塔压、狂怒、尸盘压毒等），与玩家状态共用同一套说明",
    "保留「命途未尽」入口与第二层结算字段（路线 / Boss / 节点数 / 新增万蛊录）",
  ] },
  { v: "V0.9.6", title: "第二层生态关卡预览", notes: [
    "一层 Boss 后新增「命途未尽」：可就此结算，或继续深入第二层",
    "第二层两条生态路线：瘴林深径（毒道）与血沼沉渊（血道），各含普通/三选一/精英/奖励/Boss",
    "新增 10 名生态敌人与 2 名生态 Boss（百瘴母蛊 / 血衣蛊母，皆有半血相位）",
    "万蛊录开放「敌怪图谱」「首领残卷」「生态」条目，遭遇即录、无立绘走暗色占位",
    "图鉴任务预埋瘴林初探/血沼初探/百瘴留名/血衣未散；结算与反馈新增第二层信息",
  ] },
  { v: "V0.9.4", title: "战斗手感与卡牌预览", notes: [
    "敌人意图新增「预计掉 X 血（已算护甲）」，大威胁时意图框红光警示",
    "出牌、受击加入轻微振动反馈（手机）",
    "点手牌可放大预览，看完整效果再决定出牌；预览弹窗加暗纹与寓言短句",
    "第四段首领（尸盘）立绘在手机上更大、露出头部",
  ] },
  { v: "V0.9.3", title: "移动端全屏与战斗界面重构", notes: [
    "手机横屏支持浏览器全屏（无地址栏），退出后可一键重进",
    "战斗界面重构：信息更集中、双方状态完整显示、立绘对称、手牌可收纳",
    "每局开战加入发牌动画；背景音乐与立绘大幅压缩，加载更快",
  ] },
];
/* ===================== 万蛊录（图鉴系统）===================== */
/* 可扩展：分类由 GU_CATEGORIES 驱动，未来加敌怪/Boss/异闻/流派只需放数据 + 在此置 ready:true。 */
const GU_DISCOVERED_KEY = "niming.discoveredGu";
function loadDiscoveredGu() {
  try {
    const raw = localStorage.getItem(GU_DISCOVERED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (err) { return new Set(); }
}
function saveDiscoveredGu(set) {
  try { localStorage.setItem(GU_DISCOVERED_KEY, JSON.stringify([...set])); } catch (err) { /* 忽略 */ }
}
function markGuDiscovered(cardKey) {
  if (!cardKey) return;
  const set = loadDiscoveredGu();
  if (set.has(cardKey)) return;
  set.add(cardKey);
  saveDiscoveredGu(set);
}
// 已解锁 = localStorage 持久集合 ∪ 当前局牌组中的卡键。
function getDiscoveredGuKeys() {
  const set = loadDiscoveredGu();
  (runState?.deckCards || []).forEach((entry) => { if (entry?.key) set.add(entry.key); });
  return set;
}
function isGuUnlocked(item, discovered) {
  return Boolean(item && item.cardKey && discovered.has(item.cardKey));
}

// 万蛊录分类：第一版仅「蛊虫」实装，其余占位「即将开放」。
const GU_CATEGORIES = [
  { id: "overview", label: "总览", ready: true },
  { id: "gu", label: "蛊虫秘录", ready: true },
  { id: "task", label: "图鉴任务", ready: true },
  { id: "lore", label: "命蛊残卷", ready: true },
  { id: "eco", label: "生态·未实装", ready: true },
  { id: "enemy", label: "敌怪图谱", ready: true },
  { id: "boss", label: "首领残卷", ready: true },
  { id: "anecdote", label: "命途异闻", ready: false },
  { id: "faction", label: "流派源流", ready: false },
];
// 蛊虫列表筛选标签：按 type / faction / rarity 过滤。
const GU_FILTERS = [
  { id: "all", label: "全部", test: () => true },
  { id: "unlocked", label: "已悟", test: (it, d) => isGuUnlocked(it, d) },
  { id: "locked", label: "未悟", test: (it, d) => !isGuUnlocked(it, d) },
  { id: "attack", label: "攻击", test: (it) => it.type === "攻击" },
  { id: "defense", label: "防御", test: (it) => it.type === "防御" },
  { id: "support", label: "辅助", test: (it) => it.type === "辅助" || it.type === "状态" },
  { id: "poison", label: "毒道", test: (it) => it.faction === "毒道" },
  { id: "blood", label: "血道", test: (it) => it.faction === "血道" },
  { id: "bone", label: "骨道", test: (it) => it.faction === "骨道" },
  { id: "rare", label: "异蛊", test: (it) => it.rarity === "异蛊" },
  { id: "king", label: "王蛊", test: (it) => it.rarity === "王蛊" },
];
let wanGuLuEl = null;
let wanGuLuState = { tab: "gu", filter: "all", detailId: null, filterOpen: false };

function guGlyphFor(item) {
  const card = item.cardKey ? CARD_LIBRARY[item.cardKey] : null;
  return (card && card.glyph) || (item.name ? item.name.charAt(0) : "蛊");
}
function escGu(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function openWanGuLu() {
  if (!wanGuLuEl) {
    wanGuLuEl = document.createElement("div");
    wanGuLuEl.className = "wangulu-overlay hidden";
    wanGuLuEl.innerHTML = '<div class="wangulu-backdrop"></div><div class="wangulu-panel" role="dialog" aria-modal="true" aria-label="万蛊录"><div class="wangulu-head"><h2>万蛊录</h2><span class="wangulu-sub">残卷所录，皆曾入囊之物</span><button type="button" class="wangulu-close" aria-label="关闭">×</button></div><div class="wangulu-tabs"></div><div class="wangulu-content"></div></div>';
    document.body.appendChild(wanGuLuEl);
    wanGuLuEl.querySelector(".wangulu-backdrop").addEventListener("click", closeWanGuLu);
    wanGuLuEl.querySelector(".wangulu-close").addEventListener("click", closeWanGuLu);
    wanGuLuEl.addEventListener("click", onWanGuLuClick);
  }
  wanGuLuState.detailId = null;
  wanGuLuState.filterOpen = false;
  selectedLoreId = "";
  renderWanGuLu();
  wanGuLuEl.classList.remove("hidden");
  const content = wanGuLuEl.querySelector(".wangulu-content");
  if (content) content.scrollTop = 0;
}
function closeWanGuLu() { if (wanGuLuEl) wanGuLuEl.classList.add("hidden"); }

function onWanGuLuClick(event) {
  const tabBtn = event.target.closest("[data-gu-tab]");
  if (tabBtn) {
    const cat = GU_CATEGORIES.find((c) => c.id === tabBtn.dataset.guTab);
    if (cat && cat.ready) { wanGuLuState.tab = cat.id; wanGuLuState.detailId = null; selectedLoreId = ""; renderWanGuLu(); }
    return;
  }
  const loreOpenBtn = event.target.closest("[data-lore-open]");
  if (loreOpenBtn) {
    if (isLoreUnlocked(loreOpenBtn.dataset.loreOpen)) {
      selectedLoreId = loreOpenBtn.dataset.loreOpen;
      renderWanGuLu();
      const c = wanGuLuEl.querySelector(".wangulu-content");
      if (c) c.scrollTop = 0;
    }
    return;
  }
  const loreBackBtn = event.target.closest("[data-lore-back]");
  if (loreBackBtn) {
    selectedLoreId = "";
    renderWanGuLu();
    const c = wanGuLuEl.querySelector(".wangulu-content");
    if (c) c.scrollTop = 0;
    return;
  }
  const loreCopyBtn = event.target.closest("[data-lore-copy]");
  if (loreCopyBtn) { copyLoreQuote(loreCopyBtn.dataset.loreCopy); return; }
  const filterToggle = event.target.closest("[data-gu-filter-toggle]");
  if (filterToggle) { wanGuLuState.filterOpen = !wanGuLuState.filterOpen; renderWanGuLu(); return; }
  const filterBtn = event.target.closest("[data-gu-filter]");
  if (filterBtn) { wanGuLuState.filter = filterBtn.dataset.guFilter; renderWanGuLu(); return; }
  const card = event.target.closest("[data-gu-id]");
  if (card) {
    if (card.classList.contains("is-locked")) return;
    wanGuLuState.detailId = card.dataset.guId; renderWanGuLu();
    const content = wanGuLuEl.querySelector(".wangulu-content");
    if (content) content.scrollTop = 0;
    return;
  }
  const back = event.target.closest("[data-gu-back]");
  if (back) {
    wanGuLuState.detailId = null; renderWanGuLu();
    const content = wanGuLuEl.querySelector(".wangulu-content");
    if (content) content.scrollTop = 0;
  }
}

function renderWanGuLu() {
  if (!wanGuLuEl) return;
  const tabsEl = wanGuLuEl.querySelector(".wangulu-tabs");
  tabsEl.innerHTML = GU_CATEGORIES.map((c) => {
    const cls = "wangulu-tab" + (c.id === wanGuLuState.tab ? " is-active" : "") + (c.ready ? "" : " is-soon");
    const soon = c.ready ? "" : '<i class="wangulu-soon">即将开放</i>';
    return '<button type="button" class="' + cls + '" data-gu-tab="' + c.id + '"' + (c.ready ? "" : " disabled") + '>' + escGu(c.label) + soon + '</button>';
  }).join("");
  const content = wanGuLuEl.querySelector(".wangulu-content");
  const cat = GU_CATEGORIES.find((c) => c.id === wanGuLuState.tab);
  if (!cat || !cat.ready) { content.innerHTML = '<div class="wangulu-empty">此卷尚封，墨迹未干。<br><span>敌怪 · 首领 · 异闻 · 流派，即将开放。</span></div>'; return; }
  if (cat.id === "overview") { content.innerHTML = renderCodexOverview(); return; }
  if (cat.id === "task") { content.innerHTML = renderCodexTasks(); return; }
  if (cat.id === "lore") { content.innerHTML = renderWanGuLuLore(); return; }
  if (wanGuLuState.detailId) { content.innerHTML = renderGuDetail(wanGuLuState.detailId); return; }
  content.innerHTML = renderGuList(cat.id);
}

function renderGuList(catId) {
  catId = catId || "gu";
  const isEco = catId === "eco";
  const isBestiary = catId === "enemy" || catId === "boss";
  const items = (window.GU_CATALOG || []).filter((it) => it.category === catId);
  const discovered = getDiscoveredGuKeys();
  const bestiary = isBestiary ? layer2LoadBestiary() : null;
  const isOpen = (it) => isEco ? true : (isBestiary ? (it.enemyId ? bestiary.has(it.enemyId) : true) : isGuUnlocked(it, discovered));
  let head = "";
  let shown = items;
  if (isEco) {
    head = '<p class="wangulu-counter">生态图鉴 · 共 ' + items.length + ' 种（暂未实装为战斗蛊牌）</p>';
  } else if (isBestiary) {
    const seen = items.filter((it) => isOpen(it)).length;
    head = '<p class="wangulu-counter">' + (catId === "boss" ? "首领残卷" : "敌怪图谱") + ' · 已遇 ' + seen + ' / ' + items.length + '（遭遇即录）</p>';
  } else {
    const filter = GU_FILTERS.find((f) => f.id === wanGuLuState.filter) || GU_FILTERS[0];
    shown = items.filter((it) => filter.test(it, discovered));
    const unlockedCount = items.filter((it) => isGuUnlocked(it, discovered)).length;
    const chips = GU_FILTERS.map((f) => '<button type="button" class="wangulu-chip' + (f.id === wanGuLuState.filter ? " is-active" : "") + '" data-gu-filter="' + f.id + '">' + escGu(f.label) + '</button>').join("");
    head = '<div class="wangulu-filterbar' + (wanGuLuState.filterOpen ? " is-open" : "") + '">'
      + '<button type="button" class="wangulu-filter-toggle" data-gu-filter-toggle aria-expanded="' + (wanGuLuState.filterOpen ? "true" : "false") + '">筛选 · ' + escGu(filter.label) + '</button>'
      + '<div class="wangulu-chips">' + chips + '</div></div>'
      + '<p class="wangulu-counter">已悟 ' + unlockedCount + ' / ' + items.length + ' 蛊</p>';
  }
  let grid = '<div class="wangulu-grid">';
  if (!shown.length) { grid += '<div class="wangulu-empty">无符此筛之蛊。</div>'; }
  shown.forEach((it) => {
    if (isOpen(it)) {
      const pendingFace = (isEco || isBestiary) ? false : true;
      const face = it.image
        ? '<span class="wangulu-item-glyph wangulu-item-thumb"><img src="' + escGu(it.image) + '" alt="' + escGu(it.name) + '" loading="lazy"></span>'
        : '<span class="wangulu-item-glyph' + (pendingFace ? ' wangulu-glyph-pending' : '') + (isBestiary ? ' wangulu-glyph-foe' : '') + '">' + escGu(guGlyphFor(it)) + (pendingFace ? '<i class="wangulu-pending-corner">待补</i>' : '') + '</span>';
      const tag = isEco
        ? '<span class="wangulu-item-rarity wangulu-eco-badge">未实装</span>'
        : '<span class="wangulu-item-rarity wangulu-r-' + escGu(it.rarity) + '">' + escGu(it.rarity) + '</span>';
      grid += '<button type="button" class="wangulu-item' + (isEco ? " is-eco" : "") + '" data-gu-id="' + it.id + '">'
        + face + '<span class="wangulu-item-name">' + escGu(it.name) + '</span>' + tag + '</button>';
    } else {
      grid += '<button type="button" class="wangulu-item is-locked" data-gu-id="' + it.id + '" aria-disabled="true">'
        + '<span class="wangulu-item-glyph wangulu-silhouette">?</span>'
        + '<span class="wangulu-item-name">？？？</span>'
        + '<span class="wangulu-item-rarity">未悟</span>'
        + '</button>';
    }
  });
  grid += '</div>';
  return head + grid;
}

function renderGuDetail(id) {
  const it = (window.GU_CATALOG || []).find((x) => x.id === id);
  if (!it) return '<div class="wangulu-empty">残页佚失。</div>';
  const discovered = getDiscoveredGuKeys();
  if (it.category !== "eco" && it.category !== "enemy" && it.category !== "boss" && !isGuUnlocked(it, discovered)) { wanGuLuState.detailId = null; return renderGuList(wanGuLuState.tab); }
  const glyph = guGlyphFor(it);
  const artHtml = it.image
    ? '<img class="wangulu-art-img" src="' + escGu(it.image) + '" alt="' + escGu(it.name) + '" loading="lazy">'
    : '<span class="wangulu-art-glyph">' + escGu(glyph) + '</span>' + (it.category === "eco" ? '' : '<span class="wangulu-art-pending">待补立绘</span>');
  const row = (label, val) => val ? '<div class="wangulu-row"><span class="wangulu-row-k">' + escGu(label) + '</span><span class="wangulu-row-v">' + escGu(val) + '</span></div>' : "";
  const effectHtml = it.gameplayEffect
    ? '<p class="wangulu-effect">' + escGu(it.gameplayEffect) + '</p><p class="wangulu-short">' + escGu(it.descriptionShort) + '</p>'
    : '<p class="wangulu-effect wangulu-unimpl">暂未实装为战斗蛊牌（生态图鉴）</p><p class="wangulu-short">' + escGu(it.descriptionShort) + '</p>';
  const ecoTag = it.category === "eco" ? '<span class="wangulu-eco-badge">未实装</span>' : '';
  return '<button type="button" class="wangulu-back" data-gu-back>‹ 返回蛊录</button>'
    + '<article class="wangulu-detail">'
    + '<header class="wangulu-detail-head"><h3>' + escGu(it.name) + '</h3>'
    + '<p class="wangulu-detail-alias">' + escGu(it.alias || "") + '</p>'
    + '<div class="wangulu-tags"><span class="wangulu-r-' + escGu(it.rarity) + '">' + escGu(it.rarity) + '</span>'
    + '<span>' + escGu(it.faction) + '</span><span>' + escGu(it.type) + '</span>' + ecoTag + '</div></header>'
    + '<section class="wangulu-sec"><h4>立绘</h4><div class="wangulu-art">' + artHtml + '<i class="wangulu-art-stage">' + escGu(it.stage || "") + '</i></div></section>'
    + '<section class="wangulu-sec"><h4>基本信息</h4>' + row("别名", it.alias) + row("品阶", it.rarity) + row("道脉", it.faction) + row("类型", it.type) + row("形态", it.stage) + '</section>'
    + '<section class="wangulu-sec"><h4>战斗效果</h4>' + effectHtml + '</section>'
    + '<section class="wangulu-sec"><h4>生态习性</h4>' + row("栖息", it.habitat) + row("食性", it.feeding) + row("秉性", it.temperament) + '</section>'
    + '<section class="wangulu-sec"><h4>来历异闻</h4><p class="wangulu-lore">' + escGu(it.descriptionLore) + '</p>' + row("出处", it.dropsFrom) + row("录入", it.unlockCondition) + '</section>'
    + '<section class="wangulu-sec"><h4>组合克制</h4>' + row("演化", it.evolution) + row("相济", it.synergy) + row("相克", it.counteredBy) + '</section>'
    + renderGuTaskLink(it)
    + '</article>';
}

// 命蛊残卷收进万蛊录：复用 LORE_PAGES 与现成的目录/详情渲染，点击经 onWanGuLuClick 委托。
function renderWanGuLuLore() {
  const unlockedCount = LORE_PAGES.filter((p) => isLoreUnlocked(p.id)).length;
  const counter = '<p class="wangulu-counter">命蛊残卷 · 已显 ' + unlockedCount + ' / ' + LORE_PAGES.length + ' 页</p>';
  if (selectedLoreId) {
    return counter + '<div class="wangulu-lore-detail">' + renderLoreDetail(selectedLoreId) + '</div>';
  }
  return counter + '<div class="wangulu-lore-grid">' + renderLoreDirectory() + '</div>';
}


/* ===================== 万蛊录 · 图鉴任务预埋（V0.9.5.2）=====================
   纯展示：进度只读计算，绝不发奖励、不碰 CARD_LIBRARY / 初始卡组 / 战斗逻辑。
   所有任务/奖励恒标「预埋·后续版本开放」。新老玩家无数据均不报错。 */

/* localStorage 预留存根：只记录「展示状态」(如是否看过任务介绍)，绝不碰战斗存档/设置。 */
const CODEX_TASKS_KEY = "nmg.codex.tasks";
const CODEX_DISCOVERY_KEY = "nmg.codex.discovery";
function codexLoad(key) {
  try {
    const raw = localStorage.getItem(key);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (err) { return {}; }
}
function codexSave(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj && typeof obj === "object" ? obj : {})); } catch (err) { /* 忽略 */ }
}
function codexResetStub() { try { localStorage.removeItem(CODEX_TASKS_KEY); localStorage.removeItem(CODEX_DISCOVERY_KEY); } catch (err) { /* 忽略 */ } }
function codexMarkSeen(taskId) {
  if (!taskId) return;
  const data = codexLoad(CODEX_TASKS_KEY);
  if (!data.seen || typeof data.seen !== "object") data.seen = {};
  data.seen[taskId] = true;
  codexSave(CODEX_TASKS_KEY, data);
}

/* 图鉴任务数据：5 个，纯预埋。count() 只读真实进度，状态恒「预埋·后续版本开放」。 */
const CODEX_TASKS = [
  {
    id: "codex_baigu", name: "百蛊初识", target: 8,
    condition: "发现 8 种战斗蛊。",
    rewardPreview: "后续版本：通用特殊蛊将得入战后奖励池。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_dudao", name: "毒道入门", target: 5,
    condition: "发现 5 种毒道蛊（含虫群相关）。",
    rewardPreview: "后续版本：开放毒道特殊事件或毒道蛊池扩展。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && (it.faction === "毒道" || it.faction === "虫群") && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_xuedao", name: "血道残谱", target: 5,
    condition: "发现 5 种血道蛊。",
    rewardPreview: "后续版本：开放血道特殊蛊。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && it.faction === "血道" && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_mingtu", name: "命途偏转", target: 3,
    condition: "发现 3 种命途异蛊。",
    rewardPreview: "后续版本：开放命势特殊事件。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && it.faction === "命途" && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_canjuan", name: "残卷窥真", target: 3,
    condition: "阅读 3 卷命蛊残卷。",
    rewardPreview: "后续版本：开放残卷异闻与特殊蛊。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      try { return (typeof LORE_PAGES !== "undefined" ? LORE_PAGES : []).filter((p) => isLoreUnlocked(p.id)).length; }
      catch (err) { return 0; }
    },
  },
  { id: "codex_miasmaProbe", name: "瘴林初探", target: 1,
    condition: "进入第二层「瘴林深径」1 次。",
    rewardPreview: "后续版本：解锁毒道特殊蛊机会。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().miasmaEntered | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_bloodmarshProbe", name: "血沼初探", target: 1,
    condition: "进入第二层「血沼沉渊」1 次。",
    rewardPreview: "后续版本：解锁血道特殊蛊机会。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().bloodmarshEntered | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_miasmaName", name: "百瘴留名", target: 1,
    condition: "击败第二层 Boss「百瘴母蛊」。",
    rewardPreview: "后续版本：解锁瘴林残卷。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().miasmaBossDefeated | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_bloodRobeName", name: "血衣未散", target: 1,
    condition: "击败第二层 Boss「血衣蛊母」。",
    rewardPreview: "后续版本：解锁血道残谱。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().bloodmarshBossDefeated | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
];
function codexTaskById(id) { return CODEX_TASKS.find((t) => t.id === id) || null; }
function codexTaskProgress(task) {
  let cur = 0;
  try { cur = Math.max(0, task && typeof task.count === "function" ? (task.count() | 0) : 0); } catch (err) { cur = 0; }
  const target = task && task.target ? task.target : 0;
  return { cur: target ? Math.min(cur, target) : cur, raw: cur, target, done: target ? cur >= target : false };
}

/* 派生元信息：不改 gu_catalog 17 条，UI 由此函数取关联任务/类型/路线标签。命途→fateGu。 */
function guCodexMeta(item) {
  const it = item || {};
  const isEco = it.category === "eco";
  let codexType = "battleGu";
  if (isEco) codexType = "ecologyGu";
  else if (it.faction === "命途") codexType = "fateGu";
  const tags = [];
  switch (it.faction) {
    case "毒道": tags.push("毒道"); break;
    case "虫群": tags.push("虫群", "毒道"); break;
    case "血道": tags.push("血道"); break;
    case "命途": tags.push("命势"); break;
    case "护身": tags.push("护甲"); break;
    case "燃命": tags.push("燃命"); break;
    case "骨道": tags.push("骨道"); break;
    case "控场": tags.push("通用"); break;
    default: tags.push("通用"); break;
  }
  if (isEco) tags.push("生态", "未实装");
  let relatedTaskId = "codex_baigu";
  if (it.faction === "血道") relatedTaskId = "codex_xuedao";
  else if (it.faction === "毒道" || it.faction === "虫群") relatedTaskId = "codex_dudao";
  else if (it.faction === "命途") relatedTaskId = "codex_mingtu";
  else if (isEco) relatedTaskId = "codex_canjuan";
  return {
    codexType,
    routeTags: tags,
    isImplemented: it.category === "gu",
    isSpecialUnlock: false,
    relatedTaskId,
  };
}

/* 总览：蛊道进境（纯展示统计）。 */
function renderCodexOverview() {
  const cat = window.GU_CATALOG || [];
  const d = getDiscoveredGuKeys();
  const total = cat.length;
  const battleSeen = cat.filter((it) => it.category === "gu" && isGuUnlocked(it, d)).length;
  const battleTotal = cat.filter((it) => it.category === "gu").length;
  const ecoTotal = cat.filter((it) => it.category === "eco").length;
  let loreSeen = 0;
  try { loreSeen = (typeof LORE_PAGES !== "undefined" ? LORE_PAGES : []).filter((p) => isLoreUnlocked(p.id)).length; } catch (err) { loreSeen = 0; }
  const cell = (k, v) => '<div class="codex-progress-cell"><span class="codex-progress-num">' + escGu(v) + '</span><span class="codex-progress-k">' + escGu(k) + '</span></div>';
  return '<p class="wangulu-counter">蛊道进境 · 残卷所窥，不过初篇</p>'
    + '<div class="codex-progress">'
    + cell("已收录蛊虫", total)
    + cell("已见战斗蛊", battleSeen + ' / ' + battleTotal)
    + cell("已见生态蛊", ecoTotal)
    + cell("已读残卷", loreSeen + ' / ' + (typeof LORE_PAGES !== "undefined" ? LORE_PAGES.length : 0))
    + cell("图鉴任务·预埋", CODEX_TASKS.length)
    + '</div>'
    + '<p class="codex-overview-verse">蛊道无尽，所见不过初篇。<br>待残卷补全，异蛊自会显形。</p>';
}

/* 图鉴任务列表：条件 + 奖励预告 + 真实进度 + 醒目「预埋」徽章。进度满也不发奖。 */
function renderCodexTasks() {
  const cards = CODEX_TASKS.map((task) => {
    const p = codexTaskProgress(task);
    const pct = p.target ? Math.round((p.cur / p.target) * 100) : 0;
    return '<div class="codex-task-card">'
      + '<div class="codex-task-head"><h4>' + escGu(task.name) + '</h4><span class="codex-seed-badge">' + escGu(task.note) + '</span></div>'
      + '<p class="codex-task-cond"><span class="codex-task-k">解锁条件</span>' + escGu(task.condition) + '</p>'
      + '<p class="codex-task-reward"><span class="codex-task-k">奖励预告</span>' + escGu(task.rewardPreview) + '</p>'
      + '<div class="codex-task-bar"><span class="codex-task-bar-fill" style="width:' + pct + '%"></span></div>'
      + '<p class="codex-task-prog">当前进度 ' + escGu(p.cur) + ' / ' + escGu(p.target) + '（仅记录·' + (p.done ? '条件已足，待后续版本开放' : '尚未达成') + '）</p>'
      + '</div>';
  }).join("");
  const variant = '<div class="codex-variant-note">'
    + '<h4>初始卡组变体 · 预告</h4>'
    + '<p>后续版本或可在不增牌数的前提下，替换初始卡组一至两张：</p>'
    + '<ul>'
    + '<li>毒道入门：月刃蛊 → 青瘴蛊</li>'
    + '<li>血道残谱：月刃蛊 → 血刃蛊</li>'
    + '<li>命途偏转：一张防御蛊 → 命线蛊</li>'
    + '</ul>'
    + '<p class="codex-variant-warn">以上皆为预埋设想，本版未实装，当前不改动任何初始卡组。</p>'
    + '</div>';
  return '<p class="wangulu-counter">图鉴任务 · 共 ' + CODEX_TASKS.length + ' 则（皆预埋，进度只录不发奖）</p>'
    + '<div class="codex-task-list">' + cards + '</div>'
    + variant;
}

/* 蛊虫详情「相关图鉴任务」小区：由 guCodexMeta 推导，纯展示状态。 */
function renderGuTaskLink(item) {
  if (!item) return "";
  const meta = guCodexMeta(item);
  const task = codexTaskById(meta.relatedTaskId);
  let body = "";
  if (task) {
    const stateLabel = meta.isImplemented ? "后续版本开放" : "暂未实装为战斗蛊牌";
    body += '<div class="wangulu-task-link"><span class="wangulu-task-name">' + escGu(task.name) + '</span><span class="wangulu-task-state">' + escGu(stateLabel) + '</span></div>';
  }
  if (!meta.isImplemented) {
    body += '<div class="wangulu-task-link"><span class="wangulu-task-name">生态异闻</span><span class="wangulu-task-state">暂未实装</span></div>';
  }
  if (!body) return "";
  return '<section class="wangulu-sec"><h4>相关图鉴任务</h4>' + body + '<p class="wangulu-task-foot">皆为预埋，后续版本开放，当前不发奖励。</p></section>';
}
let updateLogEl = null;
function showUpdateLog() {
  if (!updateLogEl) {
    updateLogEl = document.createElement("div");
    updateLogEl.className = "update-log-overlay hidden";
    let html = '<div class="update-log-backdrop"></div><div class="update-log-panel" role="dialog" aria-modal="true">'
      + '<div class="update-log-head"><h2>更新公告</h2><button type="button" id="updateLogClose" aria-label="关闭">×</button></div>'
      + '<div class="update-log-body">';
    UPDATE_LOG.forEach((entry) => {
      html += '<div class="update-log-entry"><p class="update-log-ver">' + entry.v + ' · ' + entry.title + '</p><ul>';
      entry.notes.forEach((note) => { html += '<li>' + note + '</li>'; });
      html += '</ul></div>';
    });
    updateLogEl.innerHTML = html + '</div></div>';
    document.body.appendChild(updateLogEl);
    updateLogEl.querySelector(".update-log-backdrop").addEventListener("click", hideUpdateLog);
    updateLogEl.querySelector("#updateLogClose").addEventListener("click", hideUpdateLog);
  }
  updateLogEl.classList.remove("hidden");
}
function hideUpdateLog() { if (updateLogEl) updateLogEl.classList.add("hidden"); }
// 检测到新正式版本时，首次进入自动弹一次更新公告。
function maybeAutoShowUpdateLog() {
  try {
    const latest = UPDATE_LOG[0].v;
    if (localStorage.getItem("niming.seenUpdate") !== latest) {
      showUpdateLog();
      localStorage.setItem("niming.seenUpdate", latest);
    }
  } catch (err) { /* localStorage 不可用则忽略 */ }
}

let cardPreviewEl = null;
// 卡牌预览底部的氛围寓言短句（按类型变化，纯展示文案）。
function cardFlavorText(card) {
  const t = card.typeName || "";
  if (t.indexOf("毒") >= 0) return "毒入膏肓，无声蚀命。";
  if (t.indexOf("血") >= 0) return "血债血偿，煞气凝形。";
  if (card.type === "attack") return "蛊牙噬骨，一击索命。";
  if (card.type === "defense") return "甲胄覆身，万邪退避。";
  return "蛊术无形，唯心可御。";
}
// 手机端点牌放大预览：弹出大图看完整效果，点“使用”才出牌、“取消/背景”关闭。只动展示，不改出牌逻辑。
function showCardPreview(instanceId) {
  const card = game && game.hand ? game.hand.find((c) => c.instanceId === instanceId) : null;
  if (!card) { playCard(instanceId); return; }
  if (!cardPreviewEl) {
    cardPreviewEl = document.createElement("div");
    cardPreviewEl.className = "card-preview-overlay hidden";
    cardPreviewEl.innerHTML = '<div class="card-preview-backdrop"></div>'
      + '<div class="card-preview-panel" role="dialog" aria-modal="true">'
      + '<div class="card-preview-head"><h3 id="cardPreviewName"></h3><span id="cardPreviewCost"></span></div>'
      + '<div id="cardPreviewType" class="card-preview-type"></div>'
      + '<p id="cardPreviewEffect" class="card-preview-effect"></p>'
      + '<p id="cardPreviewFlavor" class="card-preview-flavor"></p>'
      + '<div class="card-preview-actions"><button type="button" id="cardPreviewCancel">取消</button>'
      + '<button type="button" id="cardPreviewPlay">使用</button></div></div>';
    document.body.appendChild(cardPreviewEl);
    cardPreviewEl.querySelector(".card-preview-backdrop").addEventListener("click", hideCardPreview);
    cardPreviewEl.querySelector("#cardPreviewCancel").addEventListener("click", hideCardPreview);
    cardPreviewEl.querySelector("#cardPreviewPlay").addEventListener("click", () => {
      const id = cardPreviewEl.dataset.cardId;
      hideCardPreview();
      if (id) playCard(id);
    });
  }
  cardPreviewEl.dataset.cardId = instanceId;
  cardPreviewEl.querySelector("#cardPreviewName").textContent = card.name || "";
  const effectiveCost = game ? getEffectiveCardCost(card) : card.cost;
  cardPreviewEl.querySelector("#cardPreviewCost").textContent = "消耗 " + effectiveCost;
  cardPreviewEl.querySelector("#cardPreviewType").textContent = card.typeName || "";
  cardPreviewEl.querySelector("#cardPreviewEffect").innerHTML = card.effect || "";
  cardPreviewEl.querySelector("#cardPreviewFlavor").textContent = cardFlavorText(card);
  cardPreviewEl.classList.remove("hidden");
}
function hideCardPreview() {
  if (cardPreviewEl) cardPreviewEl.classList.add("hidden");
}

function playCard(instanceId) {
  hideCardPreview();
  if (!game || game.status !== "playing" || game.inputLocked) return;
  const cardIndex = game.hand.findIndex((card) => card.instanceId === instanceId);
  if (cardIndex < 0) return;
  const card = game.hand[cardIndex];
  const blockReason = getCardBlockReason(card);
  if (blockReason) {
    setBattleMessage(`${blockReason}，无法催动${card.name}。`);
    addLog(`${blockReason}，${card.name}未能催动。`);
    return;
  }

  // 一次出牌结算期间锁住输入，避免双击同一张牌造成重复扣费或重复伤害。
  game.inputLocked = true;
  safeVibrate(14);
  window.clearTimeout(cardUnlockTimer);
  const cardElement = dom.hand.querySelector(`[data-card-id="${instanceId}"]`);
  if (cardElement) {
    animateCardPlay(cardElement, card);
    cardElement.disabled = true;
    cardElement.classList.add("is-casting");
  }
  showCastDisplay(card);
  playCardUseEffect(card);

  const usedCostReduction = game.player.nextCardCostReduction > 0;
  game.player.energy -= getEffectiveCardCost(card);
  if (usedCostReduction) game.player.nextCardCostReduction = 0;
  game.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  const cardStatsKey = recordCardPlayed(card);
  game.activeCardContext = {
    key: card.key,
    cardStatsKey,
    cardName: card.name,
    baseName: card.baseName,
    cardSnapshot: { ...card },
    corrosionTriggered: false,
  };
  playCardSfx(card);
  resolveCard(card);
  applySupportDrawFollowup(card);
  applySkewPenalty(card);
  applyFateCardFlow(card);
  game.lastCardCategoryThisTurn = getCardFlowType(card);
  game.activeCardContext = null;
  game.cardsPlayedThisTurn += 1;
  const battleEnded = checkBattleResult();
  render();
  if (!battleEnded && game.status === "playing") {
    cardUnlockTimer = window.setTimeout(() => {
      if (!game || game.status !== "playing") return;
      game.inputLocked = false;
      render();
    }, 220);
  }
}

function applySupportDrawFollowup(card) {
  if (!game?.supportDrawPrimed || card.key === "yuanReturn" || card.category !== "utility") return;
  const drawCount = Math.max(1, game.supportDrawPrimed);
  game.supportDrawPrimed = 0;
  drawCards(drawCount);
  addLog(`回元余韵：下一张辅助蛊已生效，抽 ${drawCount} 张牌。`, "positive-log");
}

function resolveCard(card) {
  const v = getCardValues(card);
  switch (card.key) {
    case "moonBlade":
      resolveAttack(card, v.damage);
      break;
    case "ironSkin":
      gainArmor(v.armor, card.name);
      break;
    case "wineWorm":
      game.player.doubleNextAttack = true;
      if (v.draw > 0) {
        drawCards(v.draw);
        addLog(`酒虫醺意入匣：抽 ${v.draw} 张牌。`, "positive-log");
      }
      addLog(`你使用酒虫，酒意缠身：下一张攻击蛊伤害翻倍${v.draw > 0 ? `，并抽 ${v.draw} 张牌` : ""}。`, "player-log");
      setBattleMessage("酒意：下一张攻击蛊伤害翻倍。");
      break;
    case "bloodBlade":
      losePlayerHealth(v.selfDamage);
      {
        const bloodBefore = game.player.blood;
        const gained = gainBlood(v.bloodGain);
        addLog(`血刃反噬，你失去 ${v.selfDamage} 点生命，并获得 ${gained} 层血煞。`, "damage-log");
        resolveAttack(card, v.damage + bloodBefore, bloodBefore ? `${bloodBefore} 层血煞` : "");
      }
      break;
    case "burningEssence":
      losePlayerHealth(v.selfDamage);
      game.player.energy += v.energy;
      spawnFloatText(document.querySelector(".player-portrait"), `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用燃元蛊，失去 ${v.selfDamage} 点生命，获得 ${v.energy} 点真元。`, "damage-log");
      setBattleMessage("精血化元，短暂的力量灼烧着你的经脉。");
      break;
    case "heartEater": {
      const empowered = game.player.blood >= 2;
      resolveAttack(card, empowered ? v.empoweredDamage : v.damage, empowered ? "血煞催发" : "");
      break;
    }
    case "bloodReversal":
      losePlayerHealth(v.selfDamage);
      {
        const bloodBefore = game.player.blood;
        const bloodBonus = bloodBefore * v.bloodMultiplier;
        resolveAttack(card, v.damage + bloodBonus, bloodBefore ? `${bloodBefore} 层血煞×${v.bloodMultiplier}` : "");
        const gained = gainBlood(v.bloodGain);
        addLog(`逆血蛊反行经脉：你失去 ${v.selfDamage} 点生命，获得 ${gained} 层血煞。`, "damage-log");
      }
      break;
    case "bloodTide":
      resolveAttack(card, v.damage + game.player.blood * v.bloodMultiplier, `${game.player.blood} 层血煞×${v.bloodMultiplier}`);
      break;
    case "lifeFlame":
      spendLifespan(v.lifespanCost, card.name);
      resolveAttack(card, v.damage, "寿火燃烧");
      break;
    case "witheredBloom":
      spendLifespan(v.lifespanCost, card.name);
      healPlayer(v.heal, card.name);
      break;
    case "essenceGathering":
      game.player.energy += v.energy;
      drawCards(v.draw);
      spawnFloatText(document.querySelector(".player-portrait"), `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用聚元蛊，获得 ${v.energy} 点真元并抽 ${v.draw} 张牌。`, "positive-log");
      setBattleMessage("游离真元被蛊群纳入空窍，蛊匣随之轻鸣。");
      break;
    case "mysticCarapace":
      gainArmor(v.armor, card.name);
      break;
    case "returnLife":
      game.player.blood -= v.bloodCost;
      healPlayer(v.heal, card.name);
      addLog(`返命蛊吞去 ${v.bloodCost} 层血煞，逆转伤势。`, "positive-log");
      break;
    case "swarmBite":
      resolveAttack(card, v.damage + game.cardsPlayedThisTurn * v.perPlayed, `此前出牌 ${game.cardsPlayedThisTurn} 张`);
      break;
    case "meridianShift":
      losePlayerHealth(v.selfDamage);
      drawCards(v.draw);
      addLog(`你使用移窍蛊，失去 ${v.selfDamage} 点生命并抽 ${v.draw} 张牌。`, "damage-log");
      setBattleMessage("窍穴移位，剧痛中有新的蛊鸣回应。");
      break;
    case "armorBreaker": {
      const hasArmor = (game.enemy.armor || 0) > 0;
      resolveAttack(card, v.damage + (hasArmor ? v.armorBonus : 0), hasArmor ? "破甲" : "");
      break;
    }
    case "yuanReturn":
      game.player.energy += v.energy;
      game.supportDrawPrimed = Math.max(game.supportDrawPrimed || 0, v.supportDraw);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用回元蛊，获得 ${v.energy} 点真元；下一张辅助蛊抽 ${v.supportDraw} 张牌。`, "positive-log");
      setBattleMessage("真元回流，蛊匣中有细声回应。");
      break;
    case "shellRemnant": {
      const extra = game.player.wasDamagedThisTurn;
      gainArmor(v.armor + (extra ? v.hurtArmor : 0), card.name, extra ? "本回合已受伤" : "");
      break;
    }
    case "guFeeding":
      drawCards(v.draw);
      discardRandomHand(v.discard, card.name);
      addLog(`你使用饲蛊术，抽 ${v.draw} 张牌后弃 ${v.discard} 张牌。`, "player-log");
      setBattleMessage("蛊虫啃食旧息，换来新的蛊鸣。");
      break;
    case "soulCrack":
      spendLifespan(v.lifespanCost, card.name);
      resolveAttack(card, v.damage, "裂魂");
      break;
    case "armorMeltPoison": {
      const removed = removeEnemyArmor(v.armorRemove, card.name);
      resolveAttack(card, v.damage, removed ? `蚀去防御 ${removed}` : "");
      applyEnemyPoison(v.poison, card.name);
      break;
    }
    case "bloodRobe": {
      losePlayerHealth(v.selfDamage);
      gainArmor(v.armor, card.name);
      const gained = gainBlood(v.bloodGain);
      addLog(`血衣蛊缠身：失去 ${v.selfDamage} 点生命，血煞 +${gained}。`, "damage-log");
      break;
    }
    case "lifeLamp": {
      const willFull = game.player.heroId === "fate" && game.player.fateMomentum + v.fateGain >= FATE_MOMENTUM_MAX;
      const gained = gainFateMomentum(v.fateGain);
      if (willFull) healPlayer(v.heal, card.name);
      else if (gained > 0) addLog(`命灯蛊燃起，命势 +${gained}。`, "positive-log");
      else addLog("命灯蛊微燃，但未牵动你的命势。", "system-log");
      break;
    }
    case "fateThread": {
      const empowered = game.player.fateMomentum >= 2;
      resolveAttack(card, empowered ? v.damage + v.fateBonus : v.damage, empowered ? "命势不少于 2 层" : "");
      break;
    }
    case "reversePath":
      gainArmor(v.armor, card.name);
      gainFateMomentum(v.fateGain);
      break;
    case "fixedFate": {
      const extra = Boolean(game.lastCardCategoryThisTurn) && game.lastCardCategoryThisTurn !== "defense";
      gainArmor(extra ? v.armor + v.conditionArmor : v.armor, card.name, extra ? "上一张牌不是护甲蛊" : "");
      break;
    }
    case "bloodSacrifice": {
      losePlayerHealth(v.selfDamage);
      const gained = gainBlood(v.bloodGain);
      drawCards(v.draw);
      addLog(`血祭蛊反噬：失去 ${v.selfDamage} 点生命，血煞 +${gained}，抽 ${v.draw} 张牌。`, "damage-log");
      setBattleMessage("血祭入蛊，煞气沿着伤口回涌。");
      break;
    }
    case "bloodThirst":
      resolveAttack(card, v.damage + game.player.blood * v.bloodMultiplier, game.player.blood ? `${game.player.blood} 层血煞${v.bloodMultiplier > 1 ? `×${v.bloodMultiplier}` : ""}` : "");
      healPlayer(v.heal, card.name);
      break;
    case "greenMiasma":
      applyEnemyPoison(v.poison, card.name);
      setBattleMessage("青色瘴气吞没敌影，毒蛊开始啃噬经络。");
      break;
    case "insectSwarm":
      resolveAttack(card, v.damage);
      applyEnemyPoison(v.poison, card.name);
      break;
    case "moltingShell":
      gainArmor(v.armor, card.name);
      if (game.enemy.poison > 0) {
        drawCards(v.draw);
        addLog(`蜕壳蛊感应毒势：敌人已中毒，抽 ${v.draw} 张牌。`, "positive-log");
      }
      break;
    case "poisonReturn": {
      const empowered = game.enemy.poison >= v.poisonThreshold;
      resolveAttack(card, empowered ? v.damage + v.poisonBonus : v.damage, empowered ? `敌人毒性不少于 ${v.poisonThreshold} 层` : "");
      break;
    }
    case "bloodMoon": {
      losePlayerHealth(v.selfDamage);
      resolveAttack(card, v.damage + (game.player.blood > 0 ? game.player.blood * v.bloodMultiplier : 0), game.player.blood > 0 ? `${game.player.blood} 层血煞` : "");
      addLog(`血月蛊反噬：你失去 ${v.selfDamage} 点生命。`, "damage-log");
      break;
    }
    case "moltedArmor":
      gainArmor(v.armor, card.name);
      if (!game.player.wasDamagedThisTurn) {
        drawCards(v.draw);
        addLog(`蜕甲蛊完整铺展：本回合未受伤，抽 ${v.draw} 张牌。`, "positive-log");
      }
      break;
    case "rotMiasma": {
      const wasPoisoned = game.enemy.poison > 0;
      applyEnemyPoison(v.poison, card.name, { forceCorrosion: wasPoisoned });
      setBattleMessage("腐瘴入体，毒蛊沿伤口钻入敌影。");
      break;
    }
    case "fateSever":
      gainFateMomentum(v.fateGain);
      drawCards(v.draw);
      if (v.energy) {
        game.player.energy += v.energy;
        spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      }
      spendLifespan(v.lifespanCost, card.name);
      addLog(`你使用断命蛊，命势 +${v.fateGain}，抽 ${v.draw} 张牌。`, "player-log");
      break;
    case "leechBlade": {
      losePlayerHealth(v.selfDamage);
      const dealt = resolveAttack(card, v.damage, "血蛭噬咬");
      const heal = Math.max(v.minHeal, Math.floor(dealt * v.healRate));
      healPlayer(heal, card.name);
      addLog(`血蛭刃反噬：你失去 ${v.selfDamage} 点生命。`, "damage-log");
      break;
    }
    case "drunkFateWorm":
      game.player.doubleNextAttack = true;
      if (game.fateGainedThisTurn) {
        drawCards(v.draw);
        addLog(`醉命虫牵动命势：本回合已获得命势，抽 ${v.draw} 张牌。`, "positive-log");
      }
      addLog("你使用醉命虫，下一张攻击蛊的伤害将翻倍。", "player-log");
      setBattleMessage("醉意入命，下一道杀机被命丝牵紧。");
      break;
    case "soulBurn":
      losePlayerHealth(v.selfDamage);
      game.player.energy += v.energy;
      game.player.nextCardCostReduction = Math.max(game.player.nextCardCostReduction, v.costReduction);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用魂燃蛊，失去 ${v.selfDamage} 点生命，获得 ${v.energy} 点真元；下一张蛊牌消耗 -${v.costReduction}。`, "damage-log");
      break;
    case "mutantBlade":
      losePlayerHealth(v.selfDamage);
      resolveAttack(card, v.damage, "异变锋芒");
      addLog(`异刃蛊噬主：你失去 ${v.selfDamage} 点生命。`, "damage-log");
      break;
    case "mutantArmor":
      gainArmor(v.armor, card.name);
      discardRandomHand(v.discard, "异甲蛊");
      break;
    case "mutantPoison":
      applyEnemyPoison(v.poison, card.name);
      losePlayerHealth(v.selfDamage);
      addLog(`异毒蛊腐蚀掌心：你失去 ${v.selfDamage} 点生命。`, "damage-log");
      break;
    case "mutantFate":
      game.player.energy += v.energy;
      drawCards(v.draw);
      spendLifespan(v.lifespanCost, card.name);
      spawnFloatText(dom.playerPortrait, `+${v.energy} 真元`, "yuan-float");
      addLog(`你使用异命蛊，获得 ${v.energy} 点真元并抽 ${v.draw} 张牌。`, "positive-log");
      break;
    default:
      break;
  }
}

function losePlayerHealth(amount) {
  if (amount <= 0) return;
  game.player.hp = Math.max(0, game.player.hp - amount);
  game.player.wasDamagedThisTurn = true;
  spawnFloatText(document.querySelector(".player-portrait"), `-${amount}`, "");
  animateHit(document.querySelector(".player-portrait"));
  pulseElement(dom.playerHpBar, "hp-damage-pulse", 520);
  playPlayerHitEffect();
  checkTailCutRelic();
}

function checkTailCutRelic() {
  if (!game || game.status !== "playing" || !hasOrdinaryRelic("tailCutCharm")) return;
  if (game.combatRelic?.tailCutUsed) return;
  if (game.player.hp > game.player.maxHp * 0.3) return;
  game.combatRelic.tailCutUsed = true;
  if (game.player.hp <= 0) game.player.hp = 1;
  healPlayer(8, "断尾符");
  addLog("断尾符护主：濒危时恢复 8 点生命。", "positive-log");
}

function discardRandomHand(count, sourceName) {
  let discarded = 0;
  for (let i = 0; i < count; i += 1) {
    if (!game.hand.length) break;
    const index = Math.floor(Math.random() * game.hand.length);
    const [card] = game.hand.splice(index, 1);
    game.discardPile.push(card);
    discarded += 1;
  }
  if (discarded > 0) {
    addLog(`${sourceName}弃去 ${discarded} 张随机手牌。`, "damage-log");
    playDiscardCardEffect(discarded);
  }
  return discarded;
}

function applySkewPenalty(card) {
  if (!card.skewed || game.status !== "playing") return;
  if (card.category === "defense") {
    discardRandomHand(1, `${card.name}偏斜`);
    return;
  }
  if (card.category === "attack" || card.type === "poison" || card.typeName.includes("毒道")) {
    losePlayerHealth(1);
    addLog(`${card.name}偏斜反噬：你失去 1 点生命。`, "damage-log");
    return;
  }
  spendLifespan(1, `${card.name}偏斜`);
}

function gainBlood(baseAmount) {
  const before = game.player.blood;
  game.player.blood = Math.min(getBloodMax(), game.player.blood + baseAmount);
  const gained = game.player.blood - before;
  spawnFloatText(dom.playerPortrait, `+${gained} 血煞`, "blood-float");
  if (gained > 0) {
    playBloodGainEffect();
    if (hasOrdinaryRelic("bloodJadeCup") && (game.combatRelic?.bloodJadeHealsThisTurn || 0) < 2) {
      game.combatRelic.bloodJadeHealsThisTurn += 1;
      healPlayer(1, "血玉盏");
      addLog("血玉盏汲煞回温：恢复 1 点生命。", "positive-log");
    }
  }
  return gained;
}

function healPlayer(amount, sourceName) {
  const before = game.player.hp;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + amount);
  const healed = game.player.hp - before;
  recordHealing(healed, sourceName);
  spawnFloatText(document.querySelector(".player-portrait"), `+${healed} 生命`, "heal-float");
  if (healed > 0) {
    pulseElement(dom.playerHpBar, "hp-heal-pulse", 560);
    playHealEffect();
    if (getCardEffectType(game.activeCardContext?.cardSnapshot) === "blood") playBloodReturnEffect();
  }
  addLog(`你使用${sourceName}，恢复 ${healed} 点生命。`, "positive-log");
  setBattleMessage("枯败血肉重现生机，命火暂得喘息。");
}

function spendLifespan(amount, sourceName) {
  game.player.lifespan = Math.max(0, game.player.lifespan - amount);
  spawnFloatText(document.querySelector(".player-portrait"), `-${amount} 寿元`, "resource-float");
  addLog(`${sourceName}燃去 ${amount} 点寿元。`, "damage-log");
}

function gainArmor(baseAmount, sourceName, detail = "") {
  const amount = baseAmount + game.defenseBonus;
  game.player.armor += amount;
  recordArmorGained(amount, sourceName);
  flashCombatResource(".armor-resource");
  spawnFloatText(document.querySelector(".player-portrait"), `+${amount} 护甲`, "defense-float");
  playArmorEffect();
  addLog(`你使用${sourceName}，获得 ${amount} 点防御${detail ? `（${detail}）` : ""}。`, "positive-log");
  setBattleMessage("蛊甲覆体，替你承受来袭的杀机。");
}

function removeEnemyArmor(amount, sourceName) {
  const before = game.enemy.armor || 0;
  if (before <= 0 || amount <= 0) return 0;
  const removed = Math.min(before, amount);
  game.enemy.armor = Math.max(0, before - removed);
  spawnFloatText(dom.enemyPortrait, `-${removed} 防御`, "defense-float");
  addLog(`${sourceName}蚀去${game.enemy.definition.name} ${removed} 点防御。`, "poison-log");
  return removed;
}

function getCardFlowType(card) {
  if (card.category === "attack") return "attack";
  if (card.category === "defense") return "defense";
  return "utility";
}

function getCardFlowName(flowType) {
  return ({ attack: "攻击", defense: "护甲", utility: "辅助" })[flowType] || "未知";
}

// 无名逆命者的核心循环：不同类型卡牌交替使用，累积命势并在 3 层时爆发。
function applyFateCardFlow(card) {
  if (game.player.heroId !== "fate") return;
  const currentFlow = getCardFlowType(card);
  const lastFlow = game.player.lastCardFlowType;
  if (lastFlow && lastFlow !== currentFlow) {
    gainFateMomentum(1);
  }
  game.player.lastCardFlowType = currentFlow;
}

function gainFateMomentum(amount) {
  if (game.player.heroId !== "fate" || amount <= 0) return 0;
  const before = game.player.fateMomentum;
  game.player.fateMomentum = Math.min(FATE_MOMENTUM_MAX, game.player.fateMomentum + amount);
  const gained = game.player.fateMomentum - before;
  if (gained > 0) {
    recordFateGain(gained);
    game.fateGainedThisTurn = true;
    spawnFloatText(dom.playerPortrait, `+${gained} 命势`, "fate-float");
    playFateGainEffect();
    addLog(`命势流转：获得 ${gained} 层命势。`, "positive-log");
  }
  if (game.player.fateMomentum >= FATE_MOMENTUM_MAX) {
    getRunStats().fateTriggers += 1;
    game.player.fateMomentum = 0;
    game.player.energy += 1;
    drawCards(1);
    spawnFloatText(dom.playerPortrait, "+1 真元", "yuan-float");
    playFateFullEffect();
    addLog("命势圆满：真元 +1，抽 1 张牌。", "important");
    if (hasOrdinaryRelic("fateCoin")) {
      game.player.armor += 1;
      recordArmorGained(1);
      gainGuStones(1, "命轨铜钱");
      spawnFloatText(dom.playerPortrait, "+1 防御", "defense-float");
      addLog("命轨铜钱随命势一转：防御 +1，蛊石 +1。", "positive-log");
    }
    setBattleMessage("命势圆满，逆命蛊群同时鸣动。");
  }
  return gained;
}

function applyEnemyPoison(amount, sourceName, { corrosive = true, forceCorrosion = false, logClass = "poison-log" } = {}) {
  if (amount <= 0) return;
  const wasPoisoned = game.enemy.poison > 0;
  game.enemy.poison += amount;
  recordBossPoisonPeak();
  recordCardMetric("poisonApplied", amount, sourceName);
  addLog(`${sourceName}施毒：${game.enemy.definition.name}获得 ${amount} 层毒性。`, logClass);
  spawnFloatText(dom.enemyPortrait, `+${amount} 毒性`, "poison-float");
  game.pendingEnemyPoisonPulse = true;
  playPoisonApplyEffect();

  // 蚀毒只由青蟒的“本次出牌”触发，每张卡最多触发一次，避免多段施毒重复结算。
  const canCorrode = corrosive
    && (forceCorrosion || game.player.heroId === "poison")
    && wasPoisoned
    && (!game.activeCardContext || !game.activeCardContext.corrosionTriggered);
  if (canCorrode) {
    if (game.activeCardContext) game.activeCardContext.corrosionTriggered = true;
    game.enemy.hp = Math.max(0, game.enemy.hp - 2);
    recordPoisonDamage(2, { card: true });
    spawnFloatText(dom.enemyPortrait, "蚀毒 -2", "poison-float");
    animateHit(dom.enemyPortrait);
    playCorrosionEffect();
    addLog("蚀毒发作：额外造成 2 点伤害。", "poison-log");
    checkCorpseDiskPhase2();
  }
}

function isCorpseDiskBoss() {
  return Boolean(game?.enemy?.definition?.isBoss && game.enemy.id === "corpsepuppet");
}

// 第二层 Boss 半血相位：复用尸盘监守的检测/触发结构，仅换 id 与文案
function isLayer2PhaseBoss() {
  return Boolean(game?.enemy?.definition?.isBoss && (game.enemy.id === "miasmaMotherBoss" || game.enemy.id === "bloodRobeMotherBoss"));
}
function checkLayer2BossPhase2() {
  if (!isLayer2PhaseBoss()) return false;
  if (game.enemy.phase2 || game.enemy.hp <= 0) return false;
  if (game.enemy.hp > game.enemy.maxHp * 0.5) return false;
  game.enemy.phase2 = true;
  getRunStats().bossPhase2Triggered = true;
  const isMiasma = game.enemy.id === "miasmaMotherBoss";
  const title = isMiasma ? "瘴母苏醒" : "血衣覆身";
  const desc = isMiasma ? "百瘴翻涌，毒雾遮天，杀意暴涨。" : "血衣无风自动，血债加倍偿还。";
  addLog(`${title}：${desc}`, "boss-log");
  setBattleMessage(`${title}：${desc}`);
  showTurnBanner(title, desc);
  renderEnemyPortrait();
  renderEnemyStatuses();
  renderIntent();
  document.querySelector(".enemy-panel")?.classList.add("phase2-mode");
  return true;
}

function recordBossPoisonPeak() {
  if (!isCorpseDiskBoss()) return;
  const stats = getRunStats();
  stats.bossHighestPoison = Math.max(stats.bossHighestPoison || 0, game.enemy.poison || 0);
}

function checkCorpseDiskPhase2() {
  if (!isCorpseDiskBoss()) return false;
  if (game.enemy.phase2 || game.enemy.hp <= 0) return false;
  if (game.enemy.hp > game.enemy.maxHp * 0.5) return false;
  game.enemy.phase2 = true;
  getRunStats().bossPhase2Triggered = true;
  addLog("尸盘转轮，死气倒灌，守关者杀意渐盛。", "boss-log");
  setBattleMessage("尸盘转轮：死气倒灌，守关者杀意渐盛。");
  showTurnBanner("尸盘转轮", "死气倒灌，守关者杀意渐盛。");
  renderEnemyPortrait();
  renderEnemyStatuses();
  renderIntent();
  document.querySelector(".enemy-panel")?.classList.add("phase2-mode");
  playCorpseDiskPhase2Effect();
  return true;
}

// 攻击统一从这里结算，遗物、炼蛊和酒虫不会散落到每张卡的代码中。
function resolveAttack(card, baseDamage, detail = "") {
  const bloodBonus = isBloodAttackCard(card) ? game.bloodAttackBonus : 0;
  const instanceBonus = Math.max(0, Number(card.damageBonus) || 0);
  const modifiedBase = baseDamage + game.attackBonus + bloodBonus + instanceBonus;
  const doubled = game.player.doubleNextAttack;
  const damage = doubled ? modifiedBase * 2 : modifiedBase;
  if (doubled) game.player.doubleNextAttack = false;
  const enemyBlocked = Math.min(game.enemy.armor || 0, damage);
  const realDamage = Math.max(0, damage - enemyBlocked);
  game.enemy.armor = Math.max(0, (game.enemy.armor || 0) - damage);
  game.enemy.hp = Math.max(0, game.enemy.hp - realDamage);

  const notes = [];
  if (detail) notes.push(detail);
  if (game.attackBonus > 0) notes.push(`炼蛊 +${game.attackBonus}`);
  if (bloodBonus > 0) notes.push(`血纹残片 +${bloodBonus}`);
  if (instanceBonus > 0) notes.push(`悟道 +${instanceBonus}`);
  if (doubled) notes.push("酒虫翻倍");
  if (enemyBlocked > 0) notes.push(`敌方防御抵挡 ${enemyBlocked}`);
  const noteText = notes.length ? `（${notes.join("，")}）` : "";
  recordPlayerDamage(realDamage, { card: true });
  const bloodContribution = extractBloodBonusFromDetail(detail, realDamage);
  recordBloodBonusDamage(bloodContribution);
  if (doubled) {
    getRunStats().wineWormTriggers += 1;
    playWineTriggerEffect();
  }
  addLog(`你使用${card.name}，对${game.enemy.definition.name}造成 ${realDamage} 点伤害${noteText}。`, "player-log");
  setBattleMessage(`${card.name}命中${game.enemy.definition.name}，造成 ${realDamage} 点伤害！`);
  if (enemyBlocked > 0) spawnDelayedFloatText(dom.enemyPortrait, `格挡 ${enemyBlocked}`, "defense-float", 60);
  if (realDamage > 0) {
    const damageKind = getCardEffectType(card) === "blood" ? "blood-float" : "";
    spawnDelayedFloatText(dom.enemyPortrait, `-${realDamage}`, damageKind, 80);
    animateHit(dom.enemyPortrait);
  }
  playAttackEffect(card);
  checkCorpseDiskPhase2();
  checkLayer2BossPhase2();
  return realDamage;
}

function isBloodAttackCard(card) {
  return card.category === "attack" && (card.type === "blood" || card.typeName.includes("血道"));
}

function endTurn() {
  if (!game || game.status !== "playing" || game.inputLocked) return;
  game.inputLocked = true;
  render();
  const action = getCurrentEnemyAction();
  showTurnBanner("敌方行动", `${game.enemy.definition.name}施展：${action.name}`);
  window.clearTimeout(enemyTurnTimer);
  enemyTurnTimer = window.setTimeout(resolveEnemyTurn, 620);
}

function resolveEnemyTurn() {
  if (!game || game.status !== "playing") return;
  enemyTurnTimer = null;
  const action = getCurrentEnemyAction();
  playBossActionEffect(action);
  const enemyName = game.enemy.definition.name;
  const enemyLogClass = game.enemy.definition.isBoss ? "boss-log" : "enemy-log";

  if (action.kind === "charge") {
    game.enemy.chargedBonus = action.bonus;
    if (action.armor) {
      game.enemy.armor = (game.enemy.armor || 0) + action.armor;
      spawnFloatText(dom.enemyPortrait, `+${action.armor} 防御`, "defense-float");
    }
    addLog(`${enemyName}使用${action.name}，下一次攻击将额外造成 ${action.bonus} 点伤害${action.armor ? `，并获得 ${action.armor} 点防御` : ""}。`, enemyLogClass);
    setBattleMessage(`${enemyName}压低身形，危险气息正在聚拢……`);
    spawnFloatText(dom.enemyPortrait, `蓄势 +${action.bonus}`, "resource-float");
  } else {
    const hitCount = action.hits || 1;
    const lowHpBonus = action.lowHpExtra && game.player.hp < game.player.maxHp / 2 ? action.lowHpExtra : 0;
    const enrageBonus = game.enemy.definition.enrage && game.enemy.hp <= game.enemy.maxHp * game.enemy.definition.enrage.threshold
      ? game.enemy.definition.enrage.attackBonus
      : 0;
    const routeBonus = game.enemyAttackBonus || 0;
    const rawDamage = action.damage * hitCount + game.enemy.chargedBonus + lowHpBonus + enrageBonus + routeBonus;
    const bonus = game.enemy.chargedBonus;
    const blocked = Math.min(game.player.armor, rawDamage);
    const received = Math.max(0, rawDamage - game.player.armor);
    game.player.armor = Math.max(0, game.player.armor - rawDamage);
    game.player.hp = Math.max(0, game.player.hp - received);
    recordEnemyDamage(received);
    game.enemy.chargedBonus = 0;

    const detail = [
      hitCount > 1 ? `${hitCount} 次连击` : "",
      bonus > 0 ? `蓄势 +${bonus}` : "",
      lowHpBonus > 0 ? `追魂 +${lowHpBonus}` : "",
      enrageBonus > 0 ? `血纹狂化 +${enrageBonus}` : "",
      routeBonus > 0 ? `岔路恶果 +${routeBonus}` : "",
    ].filter(Boolean).join("，");
    addLog(`${enemyName}使用${action.name}，造成 ${rawDamage} 点伤害${detail ? `（${detail}）` : ""}；防御抵挡 ${blocked} 点，你受到 ${received} 点伤害。`, enemyLogClass);

    if (blocked > 0) spawnFloatText(document.querySelector(".player-portrait"), `格挡 ${blocked}`, "defense-float");
    if (received > 0) {
      game.player.wasDamagedThisTurn = true;
      spawnFloatText(document.querySelector(".player-portrait"), `-${received}`, "");
      animateHit(document.querySelector(".player-portrait"));
      playPlayerHitEffect();
      checkTailCutRelic();
      setBattleMessage(`${enemyName}的${action.name}撕开防线，你受到 ${received} 点伤害！`);
    } else {
      setBattleMessage(`蛊甲震颤，完整挡下${enemyName}的${action.name}。`);
    }

    if (action.lifespanDamage) {
      game.player.lifespan = Math.max(0, game.player.lifespan - action.lifespanDamage);
      addLog(`${action.name}啃去你 ${action.lifespanDamage} 点寿元。`, "damage-log");
      spawnFloatText(document.querySelector(".player-portrait"), `-${action.lifespanDamage} 寿元`, "resource-float");
    }
    if (action.energyDrain) {
      game.player.nextTurnEnergyPenalty = Math.max(game.player.nextTurnEnergyPenalty, action.energyDrain);
      addLog(`${action.name}封住空窍：下回合真元恢复减少 ${action.energyDrain}。`, "damage-log");
    }
    if (action.playerPoison) {
      game.player.poison += action.playerPoison;
      addLog(`${action.name}使你获得 ${action.playerPoison} 层毒性。`, "damage-log");
      spawnFloatText(dom.playerPortrait, `+${action.playerPoison} 毒性`, "resource-float");
      spawnEffectAt(dom.playerPortrait, "effect-poison-mist", { duration: 620 });
    }
  }

  // 防御在敌方行动完成后清零，既符合回合规则，也能真正抵挡本回合意图。
  game.player.armor = 0;
  resolvePoisonAtEnemyTurnEnd();
  render();
  if (checkBattleResult()) return;
  enemyTurnTimer = window.setTimeout(beginNextTurn, 360);
}

function resolvePoisonAtEnemyTurnEnd() {
  if (game.enemy.poison <= 0) return;
  recordBossPoisonPeak();
  applyCorpseDiskPoisonSuppression();
  const damage = game.enemy.poison;
  if (damage <= 0) return;
  game.enemy.hp = Math.max(0, game.enemy.hp - damage);
  recordPoisonDamage(damage);
  checkLayer2BossPhase2();
  addLog(`毒性发作，对${game.enemy.definition.name}造成 ${damage} 点伤害。`, "poison-log");
  setBattleMessage(`毒蛊侵入经络，${game.enemy.definition.name}受到 ${damage} 点毒性伤害！`);
  spawnFloatText(dom.enemyPortrait, `毒 -${damage}`, "poison-float");
  animateHit(dom.enemyPortrait);
  playPoisonTickEffect();
  checkCorpseDiskPhase2();
}

function applyCorpseDiskPoisonSuppression() {
  if (!isCorpseDiskBoss()) return;
  if (game.enemy.hp <= 0) return;
  if (game.enemy.poison <= 12) return;
  const removed = Math.min(3, game.enemy.poison);
  game.enemy.poison = Math.max(0, game.enemy.poison - removed);
  const stats = getRunStats();
  stats.bossPoisonSuppressions += 1;
  stats.bossPoisonSuppressedLayers += removed;
  addLog(`尸盘转动，压去 ${removed} 层毒性。`, "boss-log");
  spawnDelayedFloatText(dom.enemyPortrait, `压毒 -${removed}`, "poison-float", 60);
  playCorpseDiskPoisonSuppressionEffect(removed);
  game.pendingEnemyPoisonPulse = true;
}

function beginNextTurn() {
  if (!game || game.status !== "playing") return;
  enemyTurnTimer = null;
  game.turn += 1;
  game.player.wasDamagedThisTurn = false;
  resolvePlayerPoisonAtTurnStart();
  if (game.player.hp <= 0) {
    render();
    checkBattleResult();
    return;
  }
  const penalty = game.player.nextTurnEnergyPenalty;
  game.player.energy = Math.max(1, game.player.baseEnergy - penalty);
  game.player.nextTurnEnergyPenalty = 0;
  game.cardsPlayedThisTurn = 0;
  game.lastCardCategoryThisTurn = null;
  game.fateGainedThisTurn = false;
  game.supportDrawPrimed = 0;
  if (game.combatRelic) game.combatRelic.bloodJadeHealsThisTurn = 0;

  if (runState.relicId === "boneCarapace") {
    game.player.armor += 3;
    recordArmorGained(3);
    spawnFloatText(document.querySelector(".player-portrait"), "+3 护甲", "defense-float");
    playArmorEffect();
  }
  applyHeroTurnStartPassive();
  drawToHandSize(game.handTarget);
  chooseEnemyIntent();
  game.inputLocked = false;
  addLog(`第 ${game.turn} 回合开始：真元恢复至 ${game.player.energy}，手牌补至 ${game.handTarget} 张。`, "important");
  if (penalty > 0) addLog(`镇魂余力未散，本回合真元少恢复 ${penalty} 点。`, "damage-log");
  render();
  showTurnBanner(`第 ${game.turn} 回合`, "真元回涌");
}

function resolvePlayerPoisonAtTurnStart() {
  if (game.player.poison <= 0) return;
  const damage = game.player.poison;
  game.player.hp = Math.max(0, game.player.hp - damage);
  recordEnemyDamage(damage);
  game.player.poison = Math.max(0, game.player.poison - 1);
  game.player.wasDamagedThisTurn = true;
  addLog(`蛊火毒性发作：你受到 ${damage} 点伤害，毒性衰减 1 层。`, "damage-log");
  spawnFloatText(dom.playerPortrait, `毒 -${damage}`, "poison-float");
  animateHit(dom.playerPortrait);
  spawnEffectAt(dom.playerPortrait, "effect-poison-corrosion", { duration: 620 });
  playPlayerHitEffect();
  checkTailCutRelic();
}

function checkBattleResult() {
  // 同一张蛊若令双方同时归零，蛊修完成以命换命，仍判定夺得传承。
  if (game.enemy.hp <= 0) {
    finishBattle(true);
    return true;
  }
  if (game.player.hp <= 0) {
    finishBattle(false);
    return true;
  }
  return false;
}

function finishBattle(victory) {
  game.status = victory ? "victory" : "defeat";
  game.inputLocked = true;
  clearCombatEffects();
  recordBattleFinished(victory);
  syncRunStateFromBattle();
  const card = dom.resultOverlay.querySelector(".result-card");
  card.className = `result-card ${victory ? "victory" : "defeat"}`;
  hideRewardPanels();
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");

  if (victory) {
    window.AudioManager?.playSfx?.("victory", { volumeScale: 0.5 });
    playVictoryEffect();
    if (!runState.defeatedEnemies.includes(game.enemy.definition.name)) {
      runState.defeatedEnemies.push(game.enemy.definition.name);
    }
    addLog(`${game.enemy.definition.name}倒下。命途图第 ${runState.floor} 段已经踏破！`, "important");
    runState.lastBattleRewards = null;
    if (runState.currentNode?.type === "elite") {
      runState.eliteDefeated = true;
      unlockLorePage("direGuard");
      gainGuStones(20, "精英战胜利");
      const eliteMaterial = sample(MATERIAL_IDS, 1)[0];
      gainMaterial(eliteMaterial, 1, "精英战利品");
      const eliteRelic = gainRandomOrdinaryRelic("精英战利品");
      runState.lastBattleRewards = { type: "elite", stones: 20, materialId: eliteMaterial, relicId: eliteRelic, furnace: true };
      addLog(`精英：${game.enemy.definition.name}已败${runState.layer2?.active ? "。" : "，蛊炉机会已开启。"}`, "important");
    } else if (runState.currentNode?.type === "battle") {
      unlockLorePage("bloodStone");
      gainGuStones(10, "普通战斗胜利");
      runState.lastBattleRewards = { type: "battle", stones: 10, materialId: null, furnace: false };
    }
    // TODO: 后续多幕路线扩展时抽象 finalNode / bossNode。
    if (runState.layer2?.active) {
      // 第二层战斗：胜利后回第二层地图（Boss→二层结算），复用地图推进
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = game.player.hp;
      layer2CompleteNodeAndReturnMap();
      return;
    }
    if (runState.currentNode?.type === "boss" || runState.floor === MAX_ROUTE_STEP) {
      unlockLorePage("unfinished");
      completeCurrentBattleNode();
      // 一层 Boss 胜利不再强制结算：先弹「命途未尽」让玩家选结算/深入
      dom.resultTurns.textContent = game.turn;
      dom.resultHp.textContent = game.player.hp;
      showUnfinishedPathChoice();
      render();
      return;
    } else {
      openCardReward();
    }
  } else {
    window.AudioManager?.playSfx?.("defeat", { volumeScale: 0.5 });
    playDefeatEffect();
    addLog("你的生命归零，道途断绝。", "damage-log");
    runState.status = "failed";
    showRunConclusion(false);
  }

  dom.resultTurns.textContent = game.turn;
  dom.resultHp.textContent = game.player.hp;
  dom.resultOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateMobileViewportState();
  render();
}

function openCardReward() {
  runState.rewardResolved = false;
  const choices = generateCardRewardChoices(runState.heroId);
  runState.pendingRewardKeys = choices;
  dom.resultSeal.textContent = "获";
  dom.resultEyebrow.textContent = `命途图 · 第 ${runState.floor} 段踏破`;
  dom.resultTitle.textContent = "炼蛊收获";
  if (runState.currentNode?.type === "elite") {
    const material = MATERIALS[runState.lastBattleRewards?.materialId];
    const relic = ORDINARY_RELICS[runState.lastBattleRewards?.relicId];
    dom.resultEyebrow.textContent = "精英战利品 · 血纹狼王已败";
    dom.resultDescription.textContent = `已获得 20 蛊石${material ? `、${material.name}` : ""}${relic ? `与遗物「${relic.name}」` : ""}；选牌后将获得一次炼蛊机会。`;
  } else {
    dom.resultDescription.textContent = "从三枚新生蛊卵中收纳一枚，或舍弃收获继续前行。";
  }
  dom.cardRewardChoices.innerHTML = choices.map((key) => {
    const item = CARD_LIBRARY[key];
    return `<button class="reward-card" type="button" data-reward-card="${key}">
      <span class="reward-card-glyph">${item.glyph}</span><strong>${item.name}</strong>
      <small>${item.typeName} · ${item.cost} 真元</small><p>${getCardEffect(key, 0)}</p>
    </button>`;
  }).join("");
  dom.skipRewardButton.disabled = false;
  dom.cardRewardPanel.classList.remove("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
}

function takeUniqueRandom(pool, used) {
  // TODO: 奖励池随机待接入统一 RNG。
  const available = pool.filter((key) => !used.has(key));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function generateCardRewardChoices(heroId) {
  const exclusivePool = HERO_EXCLUSIVE_CARD_KEYS[heroId] || [];
  const commonPool = [...STANDARD_REWARD_CARD_KEYS, ...exclusivePool];
  const rarePool = [...ADVANCED_CARD_KEYS, ...V08_COMMON_CARD_KEYS];
  const choices = [];
  const used = new Set();

  if (runState?.trialMode === "demo" && exclusivePool.length) {
    const demoKey = takeUniqueRandom(exclusivePool, used);
    if (demoKey) {
      choices.push(demoKey);
      used.add(demoKey);
    }
  }

  while (choices.length < 3) {
    const preferRare = Math.random() < 0.3;
    let key = preferRare
      ? takeUniqueRandom(rarePool, used)
      : takeUniqueRandom(commonPool, used);
    if (!key) key = takeUniqueRandom(preferRare ? commonPool : rarePool, used);
    if (!key) break;
    choices.push(key);
    used.add(key);
  }

  return choices;
}

function renderMaterialChoice(id, { disabled = false } = {}) {
  const item = MATERIALS[id];
  return `<button class="material-choice material-${item.tone}" type="button" data-material-id="${id}" ${disabled ? "disabled" : ""}>
    <span class="material-glyph">${item.glyph}</span>
    <strong>${item.name}</strong>
    <small>${item.short}</small>
    <p>${item.description}</p>
  </button>`;
}

function generateMaterialRewardChoices() {
  // TODO: 奖励池随机待接入统一 RNG。
  return sample(MATERIAL_IDS, 3);
}

function openMaterialReward() {
  runState.materialRewardResolved = false;
  const choices = generateMaterialRewardChoices();
  runState.pendingMaterialIds = choices;
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel.classList.remove("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.resultSeal.textContent = "材";
  dom.resultEyebrow.textContent = `命途图 · 第 ${runState.floor} 段炉灰`;
  dom.resultTitle.textContent = "炼蛊材料";
  dom.resultDescription.textContent = "从炉灰中取一味材料，下一次蛊炉开启时可用于稳定炼化、异变或承受反噬。";
  dom.materialRewardChoices.innerHTML = choices.map((id) => renderMaterialChoice(id)).join("");
  dom.skipMaterialButton.disabled = false;
}

function resolveMaterialReward(materialId = null) {
  if (!runState || runState.materialRewardResolved) return;
  if (materialId && !runState.pendingMaterialIds.includes(materialId)) return;
  runState.materialRewardResolved = true;
  if (materialId) {
    gainMaterial(materialId, 1, "炼蛊材料");
    dom.materialRewardChoices.querySelector(`[data-material-id="${materialId}"]`)?.classList.add("selected");
  } else {
    addLog("你没有取走本层炼蛊材料。", "system-log");
  }
  dom.materialRewardChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.skipMaterialButton.disabled = true;
  showNextFloorButton();
}

function resolveCardReward(cardKey = null) {
  if (!runState || runState.rewardResolved) return;
  if (cardKey && !runState.pendingRewardKeys.includes(cardKey)) return;
  runState.rewardResolved = true;
  if (cardKey) {
    addRunDeckCard(cardKey);
    dom.cardRewardChoices.querySelector(`[data-reward-card="${cardKey}"]`)?.classList.add("selected");
    addLog(`炼蛊收获：${CARD_LIBRARY[cardKey].name}已加入蛊匣。`, "positive-log");
  } else {
    addLog("你舍弃了本层炼蛊收获。", "system-log");
  }
  dom.cardRewardChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.skipRewardButton.disabled = true;
  if (runState.layer2?.active && runState.currentNode?.type === "reward") {
    window.setTimeout(() => { dom.resultOverlay.classList.add("hidden"); refreshModalLock(); layer2CompleteNodeAndReturnMap(); }, 220);
  } else if (runState.currentNode?.type === "elite") {
    window.setTimeout(openFurnace, 180);
  } else {
    window.setTimeout(openMaterialReward, 180);
  }
}

function openFloorTwoRefinement() {
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.resultEyebrow.textContent = "二段炉火 · 再择一变";
  dom.resultTitle.textContent = "炼蛊抉择";
  dom.resultDescription.textContent = "这次强化会随你进入后续命途。";
  dom.refineChoices.innerHTML = Object.entries(REFINEMENTS).map(([id, item]) => `
    <button class="refine-choice" type="button" data-refinement-id="${id}">
      <span>${item.glyph}</span><strong>${item.name}</strong><small>${item.description}</small>
    </button>`).join("");
  dom.refinePanel.classList.remove("hidden");
}

function chooseRefinement(id) {
  if (!runState || runState.refinementResolved || !REFINEMENTS[id]) return;
  const refinement = REFINEMENTS[id];
  runState.refinementResolved = true;
  runState.refinements.push(id);
  if (refinement.effect === "heal") {
    const before = runState.currentHp;
    runState.currentHp = Math.min(runState.maxHp, runState.currentHp + 18);
    game.player.hp = runState.currentHp;
    dom.resultHp.textContent = runState.currentHp;
    const healed = runState.currentHp - before;
    if (healed > 0) spawnFloatText(dom.playerPortrait, `+${healed} 生命`, "heal-float");
    render();
  } else if (refinement.effect === "bloodDamage") {
    runState.bloodAttackBonus += 3;
  } else if (refinement.effect === "startArmor") {
    runState.startArmorBonus += 5;
  }
  dom.refineChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.refineChoices.innerHTML = `<div class="refinement-complete"><span>${refinement.glyph}</span><strong>${refinement.name}</strong><small>${refinement.description}</small></div>`;
  dom.resultDescription.textContent = `「${refinement.name}」已经融入本局命途。`;
  addLog(`炼蛊抉择：获得「${refinement.name}」。`, "positive-log");
  openFurnace();
}

function getDeckEntryById(instanceId) {
  return runState?.deckCards?.find((entry) => entry.instanceId === instanceId) || null;
}

function getUpgradeableDeckEntries() {
  return (runState?.deckCards || []).filter((entry) => getUpgradeLevel(entry) < 2);
}

function renderDeckEntryCard(entry, { button = false, action = "", selected = false } = {}) {
  const level = getUpgradeLevel(entry);
  const tag = button ? "button" : "article";
  const buttonAttrs = button ? ` type="button" ${action ? `${action}="${entry.instanceId}"` : ""}` : "";
  const upgradedClass = level > 0 ? `upgraded upgrade-${level}` : "";
  const badge = getPrimaryDeckBadge(entry);
  const badgeKeyword = badge.text === "异变" ? "异变" : badge.text === "受损" || badge.text === "偏斜" ? "反噬" : "炼化";
  return `<${tag} class="deck-list-card ${upgradedClass} ${entry.mutated ? "is-mutated" : ""} ${entry.damaged ? "is-damaged" : ""} ${entry.skewed ? "is-skewed" : ""} ${selected ? "selected" : ""}"${buttonAttrs}>
    <div class="deck-card-head">
      <strong class="deck-card-name">${getCompactCardTitle(entry)}</strong>
      <span class="deck-primary-badge ${badge.className}"${keywordAttr(badgeKeyword)}>${badge.text}</span>
    </div>
    ${renderCompactDeckMeta(entry)}
    <p class="deck-card-effect">${withChinesePeriod(getCardEffectForEntry(entry))}</p>
  </${tag}>`;
}

function renderFurnaceChoice(entry) {
  const level = getUpgradeLevel(entry);
  const mutationText = entry.mutated
    ? "已异变过"
    : runState.mutationCount >= MAX_RUN_MUTATIONS
      ? "本局异变已满"
      : "可异变";
  return `<button class="furnace-choice ${level > 0 ? `upgraded upgrade-${level}` : ""} ${entry.mutated ? "is-mutated" : ""}" type="button" data-furnace-card="${entry.instanceId}">
    <span class="upgrade-badge">${level > 0 ? `+${level}` : "可炼化"}</span>
    <strong>${getCardTitle(entry)}</strong>
    ${renderCardStateBadges(entry)}
    <dl class="furnace-card-meta">
      <div><dt>当前</dt><dd>${getRefineText(level)}</dd></div>
      <div><dt>异变</dt><dd>${mutationText}</dd></div>
      <div><dt>上限</dt><dd>${level >= 2 ? "已达 +2" : "未达 +2"}</dd></div>
      <div><dt>蛊性</dt><dd>${getCardNatureText(entry)}</dd></div>
    </dl>
    <p>${withChinesePeriod(getCardEffectForEntry(entry))}</p>
  </button>`;
}

function renderFurnaceCompare(entry, level, label) {
  const previewEntry = { ...entry, upgradeLevel: level };
  return `<span class="upgrade-badge">${label}</span>
    <strong>${getCardTitle(previewEntry, { states: false })}</strong>
    ${renderCardInfoRows(previewEntry, { includeSeal: false, includeOrigin: false })}
    <p>${withChinesePeriod(getCardEffectForEntry(previewEntry))}</p>`;
}

function getUpgradeResultText(entry, oldLevel, newLevel) {
  const v = getCardValues(entry.key, newLevel);
  const name = getDisplayCardName(entry.key, newLevel);
  switch (entry.key) {
    case "moonBlade": return `炼成${name}，基础伤害提升至 ${v.damage}。`;
    case "ironSkin": return `炼成${name}，基础防御提升至 ${v.armor}。`;
    case "wineWorm": return `炼成${name}，下一张攻击蛊伤害翻倍，并抽 ${v.draw} 张牌${newLevel >= 2 ? "，消耗降为 0" : ""}。`;
    case "bloodBlade": return `炼成${name}，基础伤害提升至 ${v.damage}，血煞收益保留。`;
    case "bloodReversal": return `炼成${name}，基础伤害提升至 ${v.damage}，血煞倍率提升至 ×${v.bloodMultiplier}。`;
    case "bloodTide": return `炼成${name}，基础伤害提升至 ${v.damage}，血煞倍率提升至 ×${v.bloodMultiplier}。`;
    case "greenMiasma": return `炼成${name}，施毒提升至 ${v.poison} 层。`;
    case "insectSwarm": return `炼成${name}，伤害提升至 ${v.damage}，施毒提升至 ${v.poison} 层。`;
    case "mysticCarapace":
    case "fixedFate":
    case "moltingShell": return `炼成${name}，基础防御提升至 ${v.armor}。`;
    case "reversePath": return `炼成${name}，防御提升至 ${v.armor}，命势收益提升至 ${v.fateGain}。`;
    case "essenceGathering": return `炼成${name}，获得 ${v.energy} 真元并抽 ${v.draw} 张牌。`;
    case "bloodSacrifice": return `炼成${name}，血煞 +${v.bloodGain}，抽 ${v.draw} 张牌。`;
    case "bloodThirst": return `炼成${name}，基础伤害提升至 ${v.damage}，恢复提升至 ${v.heal}。`;
    case "armorBreaker": return `炼成${name}，基础伤害提升至 ${v.damage}，破甲追加提升至 ${v.armorBonus}。`;
    case "yuanReturn": return `炼成${name}，获得 ${v.energy} 真元，辅助余韵抽 ${v.supportDraw} 张。`;
    case "shellRemnant": return `炼成${name}，基础防御提升至 ${v.armor}，受伤追加提升至 ${v.hurtArmor}。`;
    case "guFeeding": return `炼成${name}，抽牌提升至 ${v.draw} 张。`;
    case "soulCrack": return `炼成${name}，基础伤害提升至 ${v.damage}，寿元代价保留。`;
    case "armorMeltPoison": return `炼成${name}，伤害 ${v.damage}、施毒 ${v.poison}、蚀甲 ${v.armorRemove}。`;
    case "bloodRobe": return `炼成${name}，防御提升至 ${v.armor}，血煞 +${v.bloodGain}。`;
    case "lifeLamp": return `炼成${name}，命势 +${v.fateGain}，满势治疗 ${v.heal}。`;
    default: return `炼成${name}，效果更新为：${stripTags(getCardEffect(entry.key, newLevel))}。`;
  }
}

function hasAnyMaterial() {
  return MATERIAL_IDS.some((id) => (runState?.materials?.[id] || 0) > 0);
}

function getMaterialCount(id) {
  return runState?.materials?.[id] || 0;
}

function renderMaterialInventory() {
  return MATERIAL_IDS.map((id) => {
    const item = MATERIALS[id];
    const count = getMaterialCount(id);
    return `<article class="material-chip material-${item.tone} ${count <= 0 ? "empty" : ""}" title="${escapeAttribute(item.description)}">
      <span><b>${item.glyph}</b><strong>${item.name} x${count}</strong></span>
      <small>偏向：${item.short}</small>
      <em>${item.description}</em>
    </article>`;
  }).join("");
}

function renderRelicInventory() {
  if (!runState) return "";
  const birthRelic = RELICS[runState.relicId];
  const ordinary = runState.ordinaryRelics.map((id) => ORDINARY_RELICS[id]).filter(Boolean);
  const items = [
    { ...birthRelic, kind: "本命遗物", tone: "gold" },
    ...ordinary.map((item) => ({ ...item, kind: "普通遗物" })),
  ];
  return items.map((item) => `<article class="relic-chip relic-${item.tone || "gold"}">
    <span><b>${item.glyph}</b><strong>${item.name}</strong><em>${item.kind}</em></span>
    <small>${item.description}</small>
  </article>`).join("");
}

function renderFurnaceMaterialButton(id) {
  const item = MATERIALS[id];
  const count = getMaterialCount(id);
  return `<button class="material-choice material-${item.tone}" type="button" data-furnace-material="${id}" ${count <= 0 ? "disabled" : ""}>
    <span class="material-glyph">${item.glyph}</span>
    <strong>${item.name}</strong>
    <small>持有 ${count} · 适合：${getMaterialFitText(id)}</small>
    <p>${item.description}</p>
  </button>`;
}

function getMaterialFitText(id) {
  if (id === "bloodSand") return "攻击蛊、血道蛊";
  if (id === "insectMolt") return "护甲蛊、辅助蛊";
  if (id === "rotLiquid") return "毒道蛊";
  if (id === "fateSilk") return "命势蛊、辅助蛊";
  return "所有蛊，但风险更高";
}

function isMaterialMatched(entry, materialId) {
  const card = CARD_LIBRARY[entry.key];
  if (!card || materialId === "remnantSoul") return false;
  const typeName = card.typeName || "";
  if (materialId === "bloodSand") return card.category === "attack" || card.type === "blood" || typeName.includes("血道");
  if (materialId === "insectMolt") return card.category === "defense" || card.category === "utility";
  if (materialId === "rotLiquid") return card.type === "poison" || typeName.includes("毒道");
  if (materialId === "fateSilk") return card.type === "fate" || card.category === "utility";
  return false;
}

function getFurnaceProbabilities(entry, materialId) {
  if (materialId === "remnantSoul") return { stable: 40, mutation: 40, backlash: 20, label: "残魂高风险" };
  if (isMaterialMatched(entry, materialId)) return { stable: 70, mutation: 20, backlash: 10, label: "材料匹配" };
  return { stable: 50, mutation: 25, backlash: 25, label: "材料不匹配" };
}

function getFurnaceMatchHint(entry, materialId) {
  if (materialId === "remnantSoul") {
    return { className: "soul", text: "残魂入炉，异变概率提高，但反噬难测。" };
  }
  if (isMaterialMatched(entry, materialId)) {
    return { className: "match", text: "材料契合，炉火较稳。" };
  }
  return { className: "mismatch", text: "蛊性相冲，反噬风险提高。" };
}

function getGenericMutationKey(entry) {
  const card = CARD_LIBRARY[entry.key] || {};
  if (card.type === "poison" || card.typeName?.includes("毒道")) return "mutantPoison";
  if (card.category === "defense") return "mutantArmor";
  if (card.category === "attack") return "mutantBlade";
  return "mutantFate";
}

function getMutationTargetKey(entry, materialId) {
  return SPECIFIC_MUTATIONS[`${entry.key}:${materialId}`] || getGenericMutationKey(entry);
}

function canCardEnterFurnace(entry) {
  return entry && getUpgradeLevel(entry) < 2;
}

function canMutateEntry(entry) {
  return Boolean(entry && !entry.mutated && runState.mutationCount < MAX_RUN_MUTATIONS);
}

function getFurnacePlan(entry, materialId) {
  const probabilities = getFurnaceProbabilities(entry, materialId);
  const currentLevel = getUpgradeLevel(entry);
  const stableLevel = Math.min(2, currentLevel + 1);
  const mutationKey = getMutationTargetKey(entry, materialId);
  const mutationAllowed = canMutateEntry(entry);
  const material = MATERIALS[materialId];
  return {
    entryId: entry.instanceId,
    materialId,
    materialName: material.name,
    probabilities,
    currentLevel,
    stableLevel,
    mutationKey,
    mutationAllowed,
    mutationRedirectReason: entry.mutated
      ? "此蛊已发生过异变；若掷出异变，将转为稳定炼化。"
      : runState.mutationCount >= MAX_RUN_MUTATIONS
        ? "本局异变次数已达上限；若掷出异变，将转为稳定炼化。"
        : "",
  };
}

function renderFurnaceRouteSummary(entry, plan) {
  const mutationName = CARD_LIBRARY[plan.mutationKey]?.name || "未知异变";
  const stablePreview = { ...entry, upgradeLevel: plan.stableLevel };
  const material = MATERIALS[plan.materialId];
  const hint = getFurnaceMatchHint(entry, plan.materialId);
  const mutationText = plan.mutationAllowed
    ? `${mutationName}：${withChinesePeriod(stripTags(getCardEffect(plan.mutationKey, 1)))}`
    : plan.mutationRedirectReason;
  const backlashText = "反噬可能：蛊损消耗 +1、反伤 6 生命、折损 2 寿元，或偏斜 +1 但附带小代价。";
  return `<div class="route-hint ${hint.className}">
      <strong>${material.name}</strong><span>${hint.text}</span>
    </div>
    <div class="route-grid">
      <article class="stable-route"><b${keywordAttr("炼化")}>稳定炼化 <strong>${plan.probabilities.stable}%</strong></b><p>${getDisplayCardName(entry.key, plan.stableLevel)}：${withChinesePeriod(stripTags(getCardEffectForEntry(stablePreview)))}</p></article>
      <article class="mutation-route"><b${keywordAttr("异变")}>蛊性异变 <strong>${plan.probabilities.mutation}%</strong></b><p>${mutationText}</p></article>
      <article class="backlash-route"><b${keywordAttr("反噬")}>炼蛊反噬 <strong>${plan.probabilities.backlash}%</strong></b><p>${backlashText}</p></article>
    </div>`;
}

function consumeSelectedMaterial(materialId) {
  if (!runState.materials[materialId]) return false;
  runState.materials[materialId] -= 1;
  return true;
}

function applyStableFurnace(entry, materialId, forcedText = "") {
  const oldLevel = getUpgradeLevel(entry);
  entry.upgradeLevel = Math.min(2, oldLevel + 1);
  runState.stableCount = (runState.stableCount || 0) + 1;
  getRunStats().stableRefines += 1;
  const oldName = getDisplayCardName(entry.key, oldLevel);
  const newName = getDisplayCardName(entry.key, entry.upgradeLevel);
  const material = MATERIALS[materialId];
  const text = forcedText || `炉火稳定：${oldName}炼化为${newName}。`;
  addLog(`${text}${material ? ` ${material.name}融入蛊纹。` : ""}`, "positive-log");
  unlockLorePage("stableFire");
  return { kind: "stable", title: `炉火稳定：${newName}`, className: "stable" };
}

function applyMutationFurnace(entry, materialId) {
  const previousKey = entry.key;
  const targetKey = getMutationTargetKey(entry, materialId);
  const originalName = CARD_LIBRARY[previousKey]?.name || previousKey;
  entry.originalKey = entry.originalKey || previousKey;
  entry.key = targetKey;
  entry.upgradeLevel = 1;
  entry.mutated = true;
  entry.mutationMaterialId = materialId;
  entry.damaged = false;
  entry.skewed = false;
  entry.costPenalty = 0;
  runState.mutationCount = Math.min(MAX_RUN_MUTATIONS, runState.mutationCount + 1);
  getRunStats().mutations += 1;
  const newName = getDisplayCardName(targetKey, entry.upgradeLevel);
  addLog(`蛊性异变：${MATERIALS[materialId].name}扭转${originalName}，化为${newName}。`, "important");
  unlockLorePage("untamed");
  return { kind: "mutation", title: `蛊性异变：${newName}`, className: "mutation" };
}

function reduceRunHpSafely(amount) {
  const before = runState.currentHp;
  runState.currentHp = Math.max(1, runState.currentHp - amount);
  if (game?.player) game.player.hp = Math.max(1, game.player.hp - amount);
  dom.resultHp.textContent = runState.currentHp;
  return before - runState.currentHp;
}

function reduceRunLifespan(amount) {
  runState.lifespan -= amount;
  if (game?.player) game.player.lifespan -= amount;
  let maxHpLost = 0;
  if (runState.lifespan < 0) {
    maxHpLost = 5;
    runState.lifespan = 0;
    runState.maxHp = Math.max(1, runState.maxHp - maxHpLost);
    runState.currentHp = Math.min(runState.currentHp, runState.maxHp);
    if (game?.player) {
      game.player.lifespan = 0;
      game.player.maxHp = runState.maxHp;
      game.player.hp = Math.min(game.player.hp, runState.maxHp);
    }
  }
  dom.resultHp.textContent = runState.currentHp;
  return maxHpLost;
}

function applyBacklashFurnace(entry) {
  // TODO: 炼蛊结果随机待接入统一 RNG。
  const options = ["damageCard", "hurtPlayer", "loseLifespan", "skewCard"];
  const result = options[Math.floor(Math.random() * options.length)];
  const cardName = getDisplayCardName(entry.key, getUpgradeLevel(entry));
  runState.backlashCount = (runState.backlashCount || 0) + 1;
  getRunStats().backlashes += 1;
  unlockLorePage("backlash");
  const mitigated = consumeFurnaceAshMitigation();
  if (result === "damageCard") {
    entry.damaged = true;
    if (!mitigated) entry.costPenalty = (entry.costPenalty || 0) + 1;
    addLog(`炼蛊反噬：${cardName}蛊损未成${mitigated ? "，炉灰印压住消耗反噬" : "，本局消耗 +1"}。`, "damage-log");
    return { kind: "backlash", title: `炼蛊反噬：${cardName}受损`, className: "backlash" };
  }
  if (result === "hurtPlayer") {
    const amount = mitigated ? 3 : 6;
    const lost = reduceRunHpSafely(amount);
    addLog(`炉火逆冲，${cardName}未成，反伤其主：失去 ${lost} 点生命${mitigated ? "（炉灰印减半）" : ""}。`, "damage-log");
    return { kind: "backlash", title: "炼蛊反噬：反伤其主", className: "backlash" };
  }
  if (result === "loseLifespan") {
    const amount = mitigated ? 1 : 2;
    const maxHpLost = reduceRunLifespan(amount);
    addLog(`寿元折损：${cardName}未成，你失去 ${amount} 点寿元${maxHpLost ? "，最大生命 -5" : ""}${mitigated ? "（炉灰印减半）" : ""}。`, "damage-log");
    return { kind: "backlash", title: "炼蛊反噬：寿元折损", className: "backlash" };
  }
  entry.upgradeLevel = Math.min(2, getUpgradeLevel(entry) + 1);
  if (!mitigated) entry.skewed = true;
  addLog(`蛊性偏斜：${getDisplayCardName(entry.key, entry.upgradeLevel)}成形${mitigated ? "，炉灰印压住偏斜代价" : `，但${getSkewPenaltyText(entry)}`}。`, "damage-log");
  return { kind: "backlash", title: mitigated ? `炉灰印镇炉：${getDisplayCardName(entry.key, entry.upgradeLevel)}` : `蛊性偏斜：${getDisplayCardName(entry.key, entry.upgradeLevel)}`, className: "backlash" };
}

function consumeFurnaceAshMitigation() {
  if (!hasOrdinaryRelic("furnaceAshSeal") || runState.backlashMitigated) return false;
  runState.backlashMitigated = true;
  addLog("炉灰印生效：本局第一次炼蛊反噬代价减半。", "positive-log");
  return true;
}

function resolveFurnacePlan(entry, plan) {
  // TODO: 炼蛊结果随机待接入统一 RNG。
  const roll = Math.random() * 100;
  if (roll < plan.probabilities.stable) return applyStableFurnace(entry, plan.materialId);
  if (roll < plan.probabilities.stable + plan.probabilities.mutation) {
    if (plan.mutationAllowed) return applyMutationFurnace(entry, plan.materialId);
    return applyStableFurnace(entry, plan.materialId, `异变受限，炉火转稳：${getDisplayCardName(entry.key, getUpgradeLevel(entry))}炼化为${getDisplayCardName(entry.key, Math.min(2, getUpgradeLevel(entry) + 1))}。`);
  }
  return applyBacklashFurnace(entry);
}

function openFurnace() {
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.runSummary.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSeal.textContent = "炉";
  dom.resultEyebrow.textContent = "蛊炉异变 · 材料炼蛊";
  dom.resultTitle.textContent = "蛊炉异变";
  dom.resultDescription.textContent = "先选一味材料，再选一张蛊牌。炉火会在稳定、异变与反噬之间随机判定。";
  dom.furnacePanel.classList.remove("hidden");
  dom.furnaceMaterialList.classList.remove("hidden");
  dom.furnaceMaterialChoices.classList.remove("hidden");
  dom.furnaceConfirm.classList.add("hidden");
  dom.furnaceComplete.classList.add("hidden");
  dom.furnaceChoices.classList.add("hidden");
  dom.furnaceSkipButton.classList.remove("hidden");
  dom.furnaceSkipButton.disabled = false;
  runState.furnaceResolved = false;
  runState.selectedFurnaceMaterialId = null;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  dom.furnaceMaterialList.innerHTML = renderMaterialInventory();
  dom.furnaceMaterialChoices.innerHTML = MATERIAL_IDS.map(renderFurnaceMaterialButton).join("");
  dom.furnaceChoices.innerHTML = "";
  dom.furnaceRouteSummary.innerHTML = "";
  playFurnaceOpenEffect();

  if (!hasAnyMaterial()) {
    runState.furnaceResolved = true;
    dom.furnaceMaterialChoices.classList.add("hidden");
    dom.furnaceSkipButton.classList.add("hidden");
    dom.furnaceComplete.classList.remove("hidden");
    dom.furnaceComplete.innerHTML = "<strong>炉火无材</strong><small>当前没有炼蛊材料，可继续前往下一层。</small>";
    addLog("炉火无材：当前没有炼蛊材料，本次蛊炉跳过。", "system-log");
    showNextFloorButton();
    return;
  }

  const candidates = getUpgradeableDeckEntries().filter(canCardEnterFurnace);
  runState.pendingFurnaceCandidates = candidates.map((entry) => entry.instanceId);
  if (!candidates.length) {
    runState.furnaceResolved = true;
    dom.furnaceMaterialChoices.classList.add("hidden");
    dom.furnaceChoices.innerHTML = "";
    dom.furnaceSkipButton.classList.add("hidden");
    dom.furnaceComplete.classList.remove("hidden");
    dom.furnaceComplete.innerHTML = "<strong>炉火无蛊</strong><small>当前蛊囊中没有可继续炼化的卡牌。</small>";
    addLog("蛊炉无蛊：当前卡组内没有可炼化卡牌。", "system-log");
    showNextFloorButton();
    return;
  }

  addLog("炉火燃起：请选择材料与一只蛊虫入炉。", "important");
}

function selectFurnaceMaterial(materialId) {
  if (!runState || runState.furnaceResolved || !MATERIALS[materialId] || getMaterialCount(materialId) <= 0) return;
  runState.selectedFurnaceMaterialId = materialId;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  const candidates = getUpgradeableDeckEntries().filter(canCardEnterFurnace);
  runState.pendingFurnaceCandidates = candidates.map((entry) => entry.instanceId);
  dom.furnaceMaterialList.innerHTML = renderMaterialInventory();
  dom.furnaceMaterialChoices.innerHTML = MATERIAL_IDS.map((id) => {
    const html = renderFurnaceMaterialButton(id);
    return id === materialId ? html.replace("material-choice", "material-choice selected") : html;
  }).join("");
  dom.furnaceChoices.innerHTML = candidates.map(renderFurnaceChoice).join("");
  dom.furnaceChoices.classList.remove("hidden");
  dom.furnaceConfirm.classList.add("hidden");
  dom.furnaceComplete.classList.add("hidden");
  dom.resultDescription.textContent = `已选择「${MATERIALS[materialId].name}」。请选择一张蛊牌查看稳定、异变与反噬路线。`;
}

function selectFurnaceCandidate(instanceId) {
  if (!runState || runState.furnaceResolved) return;
  if (!runState.pendingFurnaceCandidates.includes(instanceId)) return;
  if (!runState.selectedFurnaceMaterialId) return;
  const entry = getDeckEntryById(instanceId);
  if (!entry || !canCardEnterFurnace(entry)) return;
  runState.selectedFurnaceCardId = instanceId;
  const currentLevel = getUpgradeLevel(entry);
  const plan = getFurnacePlan(entry, runState.selectedFurnaceMaterialId);
  runState.pendingFurnacePlan = plan;
  dom.furnaceChoices.classList.add("hidden");
  dom.furnaceMaterialChoices.classList.add("hidden");
  dom.furnaceSkipButton.classList.add("hidden");
  dom.furnaceConfirm.classList.remove("hidden");
  dom.furnaceConfirmOriginal.innerHTML = renderFurnaceCompare(entry, currentLevel, "当前效果");
  dom.furnaceConfirmUpgraded.innerHTML = renderFurnaceCompare(entry, plan.stableLevel, `稳定炼化 +${plan.stableLevel}`);
  dom.furnaceRouteSummary.innerHTML = renderFurnaceRouteSummary(entry, plan);
  dom.resultDescription.textContent = `材料「${plan.materialName}」与${CARD_LIBRARY[entry.key].name}入炉。确认后将随机判定，并消耗该材料。`;
}

function returnToFurnaceChoices() {
  if (!runState || runState.furnaceResolved) return;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  dom.furnaceConfirm.classList.add("hidden");
  dom.furnaceMaterialChoices.classList.remove("hidden");
  if (runState.selectedFurnaceMaterialId) dom.furnaceChoices.classList.remove("hidden");
  dom.furnaceSkipButton.classList.remove("hidden");
  dom.resultDescription.textContent = runState.selectedFurnaceMaterialId
    ? `已选择「${MATERIALS[runState.selectedFurnaceMaterialId].name}」。请选择一张蛊牌查看路线。`
    : "先选一味材料，再选一张蛊牌。";
}

function confirmFurnaceUpgrade() {
  if (!runState || runState.furnaceResolved || !runState.selectedFurnaceCardId || !runState.selectedFurnaceMaterialId) return;
  const entry = getDeckEntryById(runState.selectedFurnaceCardId);
  const plan = runState.pendingFurnacePlan;
  if (!entry || !plan || plan.entryId !== entry.instanceId || getMaterialCount(plan.materialId) <= 0) return;
  const outcome = resolveFurnacePlan(entry, plan);
  consumeSelectedMaterial(plan.materialId);
  runState.furnaceResolved = true;
  runState.selectedFurnaceMaterialId = null;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  syncRunDeckKeys();
  dom.furnaceConfirm.classList.add("hidden");
  dom.furnaceChoices.classList.add("hidden");
  dom.furnaceMaterialChoices.classList.add("hidden");
  dom.furnaceMaterialList.innerHTML = renderMaterialInventory();
  dom.furnaceSkipButton.classList.add("hidden");
  dom.furnaceComplete.classList.remove("hidden");
  dom.furnaceComplete.className = `furnace-complete ${outcome.className || ""}`;
  dom.furnaceComplete.innerHTML = `<strong>${outcome.title}</strong><small>${stripTags(getCardEffectForEntry(entry))}</small>`;
  playFurnaceCompleteEffect(entry, outcome);
  render();
  showNextFloorButton();
}

function skipFurnace() {
  if (!runState || runState.furnaceResolved) return;
  runState.furnaceResolved = true;
  runState.selectedFurnaceMaterialId = null;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  dom.furnaceMaterialChoices?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.furnaceChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.furnaceSkipButton.disabled = true;
  dom.furnaceSkipButton.classList.add("hidden");
  dom.furnaceConfirm.classList.add("hidden");
  dom.furnaceChoices.classList.add("hidden");
  dom.furnaceMaterialChoices.classList.add("hidden");
  dom.furnaceComplete.classList.remove("hidden");
  dom.furnaceComplete.innerHTML = "<strong>炉火暂熄</strong><small>本次未进行炼化。</small>";
  addLog("炉火暂熄：本次未进行炼化。", "system-log");
  showNextFloorButton();
}

function showNextFloorButton() {
  dom.resultPrimaryButton.textContent = "返回命途图";
  dom.resultPrimaryButton.dataset.action = "completeNode";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultPrimaryButton.focus();
}

function advanceToNextFloor() {
  if (!runState?.rewardResolved) return;
  if (runState.currentNode?.type === "battle" && !runState.materialRewardResolved) return;
  if (runState.currentNode?.type === "elite" && !runState.furnaceResolved) return;
  dom.resultOverlay.classList.add("hidden");
  refreshModalLock();
  if (runState?.layer2?.active) { layer2CompleteNodeAndReturnMap(); return; }
  completeCurrentNodeAndReturnMap();
}

function hasRunMutation() {
  return (runState?.mutationCount || 0) > 0 || runState?.deckCards?.some((entry) => entry.mutated);
}

function hasRunBacklash() {
  return (runState?.backlashCount || 0) > 0 || runState?.deckCards?.some((entry) => entry.damaged || entry.skewed || entry.costPenalty > 0);
}

function getConclusionSubtitle() {
  const lines = [];
  lines.push(runState.eliteDefeated ? "你踏碎凶煞，命途更深。" : "你避开凶险，稳步登塔。");
  if (hasRunMutation()) lines.push("蛊性异变，命途已偏。");
  if (hasRunBacklash()) lines.push("炉火曾逆，仍未断途。");
  return lines.join(" ");
}

function getKeyCardSummary() {
  const scored = (runState?.deckCards || []).map((entry) => {
    const definition = CARD_LIBRARY[entry.key] || {};
    let score = getUpgradeLevel(entry) * 3 + (entry.mutated ? 5 : 0) + (entry.damageBonus || 0);
    if (definition.category === "attack") score += 2;
    if (entry.skewed || entry.damaged) score -= 1;
    return { entry, score };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0]?.entry;
  if (!best) return "尚无关键蛊牌";
  const status = getEntryStatusLabels(best);
  const level = getUpgradeLevel(best);
  const suffix = status.length ? `【${status.join("·")}】` : "";
  return `${getDisplayCardName(best.key, level)}${suffix}`;
}

function getHighestUpgradeSummary() {
  const highest = Math.max(0, ...(runState?.deckCards || []).map((entry) => getUpgradeLevel(entry)));
  return highest > 0 ? `+${highest}` : "未炼化";
}

function getOrdinaryRelicSummary() {
  const ids = runState?.ordinaryRelics || [];
  return ids.length
    ? ids.map((id) => ORDINARY_RELICS[id]?.name).filter(Boolean).join("、")
    : "尚未获得普通遗物";
}

function getCardStatsArray() {
  return Object.values(getRunStats().cardStats || {});
}

function getTopCardStat(metric) {
  return getCardStatsArray()
    .filter((item) => safeStatNumber(item[metric]) > 0)
    .sort((a, b) => safeStatNumber(b[metric]) - safeStatNumber(a[metric]))[0] || null;
}

function formatTopCardStat(metric, unit = "") {
  const item = getTopCardStat(metric);
  if (!item) return "尚无记录";
  return `${item.name}（${safeStatNumber(item[metric])}${unit}）`;
}

function getRouteSummaryText() {
  const routeNames = [...(runState?.routeHistory || [])];
  if (runState?.currentNode && !routeNames.includes(runState.currentNode.name)) routeNames.push(runState.currentNode.name);
  return routeNames.length ? routeNames.join(" → ") : "尚未踏入分岔";
}

function getRouteNodeByStep(step) {
  if (!runState) return null;
  const nodes = getAllMapNodes();
  if (runState.currentNode?.step === step) return runState.currentNode;
  return nodes.find((node) => node.step === step && runState.completedNodes.includes(node.id)) || null;
}

function getThirdStepChoiceSummary() {
  const node = getRouteNodeByStep(REST_ROUTE_STEP);
  if (!node) return "尚未抵达";
  if (node.type === "rest") return `休整节点：${node.name}`;
  if (node.type === "battle") return `凶兽节点：${node.name}`;
  return node.name || "无";
}

function getRestResultSummary() {
  if (!runState?.restHistory?.length) return "无";
  return runState.restHistory[runState.restHistory.length - 1] || "无";
}

function getRunEvaluation(cleared) {
  const stats = getRunStats();
  if (!cleared) return "残灯未灭，蛊路可再行。";
  const currentHp = Number(runState?.currentHp) || 0;
  const maxHp = Math.max(1, Number(runState?.maxHp) || 1);
  const hpRatio = currentHp / maxHp;
  if (hpRatio <= 0.2) {
    return stats.bloodBonusDamage > 0 ? "以血换刃，险死还生。" : "血尽命悬，终破尸盘。";
  }
  if (stats.bloodBonusDamage >= Math.max(stats.poisonDamage, stats.playerDamage * 0.25) && stats.bloodBonusDamage > 0 && hpRatio <= 0.45) {
    return "血煞盈刃，命悬一线。";
  }
  if (stats.poisonDamage >= Math.max(stats.bloodBonusDamage, stats.playerDamage * 0.35) && stats.poisonDamage > 0) {
    return "毒雾缠身，敌未近而命已蚀。";
  }
  if (stats.fateTriggers >= 3) return "命势回环，出牌如织。";
  if (stats.backlashes > 0) return "炉火曾逆，仍未断途。";
  if (hpRatio >= 0.55 && stats.armorGained >= Math.max(30, stats.enemyDamage)) return "步步稳行，命途已破。";
  return "尸盘已破，命途未尽。";
}

function getBattleStatsLines() {
  const battles = getRunStats().battleSummaries || [];
  if (!battles.length) return ["尚无铭刻"];
  return battles.map((battle, index) => {
    const result = battle.victory ? "胜" : "败";
    return `${index + 1}. ${battle.enemyName}（${result}）：${battle.turns} 回合，造成 ${battle.playerDamage}，承伤 ${battle.enemyDamage}`;
  });
}

function renderStatsList(items) {
  if (!items.length) return '<p>尚无铭刻。</p>';
  return `<ul class="stats-list">${items.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join("")}</ul>`;
}

function renderCardRanking(metric, unit = "", limit = 5) {
  const cards = getCardStatsArray()
    .filter((item) => safeStatNumber(item[metric]) > 0)
    .sort((a, b) => safeStatNumber(b[metric]) - safeStatNumber(a[metric]))
    .slice(0, limit);
  if (!cards.length) return "<p>尚无铭刻。</p>";
  return `<ul class="stats-list">${cards.map((item, index) => (
    `<li><span>${index + 1}. ${item.name}</span><strong>${safeStatNumber(item[metric])}${unit}</strong></li>`
  )).join("")}</ul>`;
}

function getRunStatsHtml() {
  if (!runState) return "<section><h3>本局统计</h3><p>尚无铭刻。</p></section>";
  const stats = getRunStats();
  const baseItems = [
    ["试炼模式", getTrialModeInfo(runState.trialMode).name],
    ["命途种子", runState.trialSeed || "无"],
    ["第 3 段选择", getThirdStepChoiceSummary()],
    ["休整结果", getRestResultSummary()],
    ["战斗场数", stats.battleCount],
    ["总回合数", stats.totalTurns],
    ["Boss 回合", stats.bossTurns || "尚未遭遇"],
    ["使用卡牌", stats.cardsPlayed],
    ["总伤害", stats.playerDamage],
    ["敌方伤害", stats.enemyDamage],
    ["总防御", stats.armorGained],
    ["总治疗", stats.healing],
  ];
  const mechanicItems = [
    ["毒性伤害", stats.poisonDamage],
    ["血煞额外伤害", stats.bloodBonusDamage],
    ["命势圆满", stats.fateTriggers],
    ["酒虫触发", stats.wineWormTriggers],
    ["Boss 压毒", stats.bossPoisonSuppressions || 0],
    ["Boss 最高毒层", stats.bossHighestPoison || 0],
    ["Boss 压去毒层", stats.bossPoisonSuppressedLayers || 0],
    ["Boss 二相", stats.bossPhase2Triggered ? "已触发" : "未触发"],
    ["稳定 / 异变 / 反噬", `${stats.stableRefines} / ${stats.mutations} / ${stats.backlashes}`],
  ];
  return `
    <section><h3>总览</h3>${renderStatsList(baseItems)}</section>
    <section><h3>流派与炼蛊</h3>${renderStatsList(mechanicItems)}</section>
    <section><h3>卡牌使用排行</h3>${renderCardRanking("uses", " 次")}</section>
    <section><h3>卡牌伤害排行</h3>${renderCardRanking("damage", " 点")}</section>
    <section><h3>防御来源排行</h3>${renderCardRanking("armor", " 点")}</section>
    <section><h3>治疗来源排行</h3>${renderCardRanking("healing", " 点")}</section>
    <section><h3>施毒层数排行</h3>${renderCardRanking("poisonApplied", " 层")}</section>
    <section><h3>血煞贡献排行</h3>${renderCardRanking("bloodBonusDamage", " 点")}</section>
    <section><h3>命势贡献排行</h3>${renderCardRanking("fateGain", " 层")}</section>
    <section class="wide"><h3>战斗场次记录</h3><ul class="stats-list">${getBattleStatsLines().map((line) => `<li><span>${line}</span><strong></strong></li>`).join("")}</ul></section>`;
}

function getRunStatsCopyText(cleared = runState?.status === "cleared") {
  if (!runState) return "《逆命蛊途》本局统计\n尚无铭刻";
  const stats = getRunStats();
  const hero = HEROES[runState.heroId]?.name || "未知蛊修";
  const relic = RELICS[runState.relicId]?.name || "未知遗物";
  return [
    "《逆命蛊途》本局统计",
    `版本：${GAME_VERSION}`,
    `模式：${getTrialModeInfo(runState.trialMode).name}`,
    `命途种子：${runState.trialSeed || "无"}`,
    `录屏模式：${recordingModeEnabled ? "开" : "关"}`,
    `角色：${hero}`,
    `本命遗物：${relic}`,
    `路线：${getRouteSummaryText()}`,
    `是否进入第二层：${runState.layer2?.active ? "是" : "否"}`,
    `第二层路线：${runState.layer2?.active ? safeFeedbackText(runState.layer2.routeName) : "未进入"}`,
    `第二层Boss击败：${runState.layer2?.bossDefeated ? "是" : (runState.layer2?.active ? "否" : "未进入")}`,
    `第二层终点节点：${runState.layer2?.active ? safeFeedbackText(runState.layer2.lastNodeName) : "无"}`,
    `新增万蛊录条目（已遇敌怪/首领）：${(typeof layer2LoadBestiary === "function" ? layer2LoadBestiary().size : 0)}`,
    `第 3 段选择：${getThirdStepChoiceSummary()}`,
    `休整结果：${getRestResultSummary()}`,
    `是否通关：${cleared ? "是" : "否"}`,
    `总回合：${stats.totalTurns}`,
    `Boss 回合：${stats.bossTurns || 0}`,
    `剩余生命：${runState.currentHp} / ${runState.maxHp}`,
    `总伤害：${stats.playerDamage}`,
    `毒性伤害：${stats.poisonDamage}`,
    `Boss 压毒次数：${stats.bossPoisonSuppressions || 0}`,
    `Boss 最高毒层：${stats.bossHighestPoison || 0}`,
    `Boss 压去毒层：${stats.bossPoisonSuppressedLayers || 0}`,
    `Boss 二相触发：${stats.bossPhase2Triggered ? "是" : "否"}`,
    `血煞额外伤害：${stats.bloodBonusDamage}`,
    `命势触发：${stats.fateTriggers}`,
    `总防御：${stats.armorGained}`,
    `总治疗：${stats.healing}`,
    `炼蛊稳定 / 异变 / 反噬：${stats.stableRefines} / ${stats.mutations} / ${stats.backlashes}`,
    `最高伤害卡：${formatTopCardStat("damage", " 点")}`,
    `最高防御卡：${formatTopCardStat("armor", " 点")}`,
    `死亡节点或通关节点：${cleared ? "塔顶尸盘" : `${stats.deathNode || runState.currentNode?.name || "命途未明"} / ${stats.deathEnemy || "未知敌人"}`}`,
    "提示：若复现问题，请附截图或录屏。",
  ].join("\n");
}

function renderRunStatsOverlay() {
  if (!dom.runStatsSummary) return;
  dom.runStatsSummary.innerHTML = getRunStatsHtml();
}

function openRunStatsOverlay() {
  if (!dom.runStatsOverlay) return;
  renderRunStatsOverlay();
  dom.runStatsOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeRunStatsOverlay() {
  dom.runStatsOverlay?.classList.add("hidden");
  refreshModalLock();
}

async function copyRunStatsSummary() {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(getRunStatsCopyText());
    if (dom.runProgress) dom.runProgress.textContent = "本局统计摘要已复制。";
  } catch (error) {
    console.warn("[本局统计复制失败]", error);
    if (dom.runProgress) dom.runProgress.textContent = "当前浏览器未开放剪贴板。";
  }
}

function safeFeedbackText(value, fallback = "无") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function getFeedbackInfoText(cleared = runState?.status === "cleared") {
  if (!runState) return "《逆命蛊途》内测反馈信息\n当前无本局数据。";
  const stats = getRunStats();
  const hero = HEROES[runState.heroId]?.name || "无";
  const relic = RELICS[runState.relicId]?.name || "无";
  const relicText = getOrdinaryRelicSummary();
  return [
    "《逆命蛊途》内测反馈信息",
    `版本：${GAME_VERSION}`,
    `模式：${getTrialModeInfo(runState.trialMode).name}`,
    `命途种子：${safeFeedbackText(runState.trialSeed)}`,
    `录屏模式：${recordingModeEnabled ? "开" : "关"}`,
    `角色：${hero}`,
    `本命遗物：${relic}`,
    `是否通关：${cleared ? "是" : "否"}`,
    `死亡节点：${cleared ? "无" : safeFeedbackText(stats.deathNode || runState.currentNode?.name)}`,
    `路线：${getRouteSummaryText()}`,
    `是否进入第二层：${runState.layer2?.active ? "是" : "否"}`,
    `第二层路线：${runState.layer2?.active ? safeFeedbackText(runState.layer2.routeName) : "未进入"}`,
    `第二层Boss击败：${runState.layer2?.bossDefeated ? "是" : (runState.layer2?.active ? "否" : "未进入")}`,
    `第二层终点节点：${runState.layer2?.active ? safeFeedbackText(runState.layer2.lastNodeName) : "无"}`,
    `新增万蛊录条目（已遇敌怪/首领）：${(typeof layer2LoadBestiary === "function" ? layer2LoadBestiary().size : 0)}`,
    `第 3 段选择：${getThirdStepChoiceSummary()}`,
    `休整结果：${getRestResultSummary()}`,
    `最终生命：${safeFeedbackText(`${runState.currentHp} / ${runState.maxHp}`)}`,
    `最终蛊石：${runState.guStones || 0}`,
    `最终卡组数量：${runState.deckCards?.length || 0}`,
    `获得遗物：${relicText}`,
    `炼蛊稳定 / 异变 / 反噬：${stats.stableRefines || 0} / ${stats.mutations || 0} / ${stats.backlashes || 0}`,
    `Boss 二相是否触发：${stats.bossPhase2Triggered ? "是" : "否"}`,
    `Boss 最高毒层：${stats.bossHighestPoison || 0}`,
    `Boss 压毒次数：${stats.bossPoisonSuppressions || 0}`,
    `Boss 压去毒层：${stats.bossPoisonSuppressedLayers || 0}`,
    `总回合：${stats.totalTurns || 0}`,
    `Boss 回合：${stats.bossTurns || 0}`,
    `本局评价：${getRunEvaluation(Boolean(cleared))}`,
    "提示：若复现问题，请附截图或录屏。",
    "玩家备注：",
  ].join("\n");
}

async function copyFeedbackInfo() {
  const text = getFeedbackInfoText(runState?.status === "cleared");
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(text);
    if (dom.runProgress) {
      dom.runProgress.textContent = "反馈信息已复制。";
      dom.runProgress.classList.remove("hidden");
    }
    if (dom.feedbackCopyFallback) dom.feedbackCopyFallback.classList.add("hidden");
  } catch (error) {
    if (dom.feedbackCopyFallback) {
      dom.feedbackCopyFallback.value = text;
      dom.feedbackCopyFallback.classList.remove("hidden");
      dom.feedbackCopyFallback.focus();
      dom.feedbackCopyFallback.select();
    }
    console.warn("[反馈信息复制失败]", error);
  }
}

function showRunConclusion(cleared) {
  window.AudioManager?.playScene("menu", { duration: 600, quiet: true });
  const hero = HEROES[runState.heroId];
  const relic = RELICS[runState.relicId];
  const stats = getRunStats();
  const defeated = runState.defeatedEnemies.length ? runState.defeatedEnemies.join("、") : "尚未击败敌人";
  const routeText = getRouteSummaryText();
  const materialText = MATERIAL_IDS
    .filter((id) => (runState.materialHistory[id] || 0) > 0)
    .map((id) => `${MATERIALS[id].name}x${runState.materialHistory[id]}`)
    .join("、") || "尚未获得材料";
  const keyCard = getKeyCardSummary();
  const relicText = getOrdinaryRelicSummary();
  const deathStepText = `第 ${runState.currentRouteStep} 段`;
  const topDamageCard = formatTopCardStat("damage", " 点");
  const topArmorCard = formatTopCardStat("armor", " 点");
  const lastBattleSummary = stats.battleSummaries[stats.battleSummaries.length - 1];
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.eventPanel?.classList.add("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.resultSeal.textContent = cleared ? "通" : "绝";
  dom.resultEyebrow.textContent = cleared ? "命途分岔 · 功成" : `止步第 ${runState.currentRouteStep} 段`;
  dom.resultTitle.textContent = cleared ? "命途塔通关" : "道途断绝";
  dom.resultDescription.textContent = cleared
    ? getRunEvaluation(true)
    : `${stats.deathEnemy || game.enemy.definition.name}终结了此局命途，死于${deathStepText}。${getRunEvaluation(false)}`;
  dom.runSummary.innerHTML = `
    <div class="run-summary-item"><span>入塔蛊修</span><strong>${hero.name}</strong></div>
    <div class="run-summary-item"><span>本命遗物</span><strong>${relic.name}</strong></div>
    <div class="run-summary-item"><span>试炼模式</span><strong>${getTrialModeInfo(runState.trialMode).name}</strong></div>
    <div class="run-summary-item"><span>命途种子</span><strong>${runState.trialSeed || "无"}</strong></div>
    <div class="run-summary-item"><span>第 3 段选择</span><strong>${getThirdStepChoiceSummary()}</strong></div>
    <div class="run-summary-item"><span>休整结果</span><strong>${getRestResultSummary()}</strong></div>
    <div class="run-summary-item"><span>最终生命</span><strong>${runState.currentHp} / ${runState.maxHp}</strong></div>
    <div class="run-summary-item"><span>最终卡组</span><strong>${runState.deckCards.length} 张</strong></div>
    <div class="run-summary-item"><span>最终蛊石</span><strong>${runState.guStones}</strong></div>
    <div class="run-summary-item"><span>击败精英</span><strong>${runState.eliteDefeated ? "是" : "否"}</strong></div>
    <div class="run-summary-item"><span>总回合数</span><strong>${stats.totalTurns}</strong></div>
    <div class="run-summary-item"><span>Boss 战回合</span><strong>${stats.bossTurns || "未遭遇"}</strong></div>
    <div class="run-summary-item"><span>最高伤害卡</span><strong>${topDamageCard}</strong></div>
    <div class="run-summary-item"><span>最高防御卡</span><strong>${topArmorCard}</strong></div>
    <div class="run-summary-item"><span>最高炼化等级</span><strong>${getHighestUpgradeSummary()}</strong></div>
    <div class="run-summary-item"><span>炼蛊结果</span><strong>稳 ${stats.stableRefines} / 异 ${stats.mutations} / 噬 ${stats.backlashes}</strong></div>
    <div class="run-summary-item"><span>毒性总伤害</span><strong>${stats.poisonDamage}</strong></div>
    <div class="run-summary-item"><span>Boss 压毒次数</span><strong>${stats.bossPoisonSuppressions || 0}</strong></div>
    <div class="run-summary-item"><span>Boss 最高毒层</span><strong>${stats.bossHighestPoison || 0}</strong></div>
    <div class="run-summary-item"><span>Boss 压去毒层</span><strong>${stats.bossPoisonSuppressedLayers || 0}</strong></div>
    <div class="run-summary-item"><span>Boss 二相</span><strong>${stats.bossPhase2Triggered ? "已触发" : "未触发"}</strong></div>
    <div class="run-summary-item"><span>血煞额外伤害</span><strong>${stats.bloodBonusDamage}</strong></div>
    <div class="run-summary-item"><span>总防御</span><strong>${stats.armorGained}</strong></div>
    <div class="run-summary-item"><span>总治疗</span><strong>${stats.healing}</strong></div>
    ${cleared ? "" : `<div class="run-summary-item"><span>最后承伤</span><strong>${lastBattleSummary?.enemyDamage || 0}</strong></div>`}
    <div class="run-summary-item wide"><span>获得遗物</span><strong>${relicText}</strong></div>
    <div class="run-summary-item wide"><span>走过路线</span><strong>${routeText}</strong></div>
    <div class="run-summary-item wide"><span>第二层</span><strong>${runState.layer2?.active ? `${runState.layer2.routeName} · Boss${runState.layer2.bossDefeated ? "已破" : "未破"} · 终点「${runState.layer2.lastNodeName || "-"}」` : "未进入"}</strong></div>
    <div class="run-summary-item wide"><span>新增万蛊录</span><strong>已遇敌怪/首领 ${(typeof layer2LoadBestiary === "function" ? layer2LoadBestiary().size : 0)} 条</strong></div>
    <div class="run-summary-item wide resource-block"><span>材料与蛊石</span><strong>${materialText} · 蛊石 ${runState.guStones}</strong></div>
    <div class="run-summary-item wide"><span>${cleared ? "击败敌人" : `抵达第 ${runState.floor} 段 · 已击败`}</span><strong>${defeated}</strong></div>
    ${cleared ? "" : `<div class="run-summary-item wide"><span>死亡节点</span><strong>${deathStepText} · ${stats.deathNode || runState.currentNode?.name || "命途未明"} · ${stats.deathEnemy || "未知敌人"}</strong></div>`}
    <div class="run-summary-item wide"><span>本局评价</span><strong>${getRunEvaluation(cleared)}</strong></div>
    <div class="run-summary-item wide feedback-line"><span>内测反馈</span><strong>你觉得哪张蛊最强？如果卡组过强或过弱，请记录角色、遗物和关键蛊牌。</strong></div>`;
  dom.runSummary.classList.remove("hidden");
  dom.resultPrimaryButton.textContent = "再入命途塔";
  dom.resultPrimaryButton.dataset.action = "newRun";
  dom.resultPrimaryButton.classList.remove("hidden");
  dom.resultLoreButton?.classList.remove("hidden");
  dom.resultFeedbackButton?.classList.remove("hidden");
  dom.feedbackCopyFallback?.classList.add("hidden");
  dom.resultSecondaryButton.classList.add("hidden");
  dom.resultPrimaryButton.focus();
}

// fxLayer 与 effectLayer 都只承载临时视觉节点；关闭战斗特效时必须一起清理。
function clearEffectLayerOnly() {
  if (dom.effectLayer) dom.effectLayer.innerHTML = "";
  if (dom.fxLayer) dom.fxLayer.innerHTML = "";
  document.body.classList.remove("screen-shake-lite", "hit-pause-lite");
  document.querySelectorAll(".panel-hit-heavy, .status-bounce, .fate-pulse, .blood-pulse, .resource-pulse, .yuan-pulse, .armor-guard-pulse, .hp-damage-pulse, .hp-heal-pulse, .blood-trail, .boss-awake, .boss-phase-flash, .boss-phase-flash-strong, .boss-charge-glow, .portrait-dimmed, .portrait-phase-shift, .portrait-phase-zoom, .furnace-active, .furnace-forging").forEach((element) => {
    element.classList.remove("panel-hit-heavy", "status-bounce", "fate-pulse", "blood-pulse", "resource-pulse", "yuan-pulse", "armor-guard-pulse", "hp-damage-pulse", "hp-heal-pulse", "blood-trail", "boss-awake", "boss-phase-flash", "boss-phase-flash-strong", "boss-charge-glow", "portrait-dimmed", "portrait-phase-shift", "portrait-phase-zoom", "furnace-active", "furnace-forging");
  });
}

function clearCombatEffects() {
  window.clearTimeout(bannerTimer);
  window.clearTimeout(castTimer);
  window.clearTimeout(enemyTurnTimer);
  window.clearTimeout(cardUnlockTimer);
  bannerTimer = null;
  castTimer = null;
  enemyTurnTimer = null;
  cardUnlockTimer = null;
  if (dom.fxLayer) dom.fxLayer.innerHTML = "";
  clearEffectLayerOnly();
  dom.turnBanner?.classList.remove("show");
  dom.castDisplay?.classList.remove("show");
  document.querySelectorAll(".panel-hit, .panel-hit-heavy, .damage-flash, .hit-shake, .status-bounce, .fate-pulse, .blood-pulse, .resource-pulse, .yuan-pulse, .armor-guard-pulse, .hp-damage-pulse, .hp-heal-pulse, .blood-trail, .boss-awake, .boss-phase-flash, .boss-phase-flash-strong, .boss-charge-glow, .portrait-dimmed, .portrait-phase-shift, .portrait-phase-zoom, .furnace-active, .furnace-forging").forEach((element) => {
    element.classList.remove("panel-hit", "panel-hit-heavy", "damage-flash", "hit-shake", "status-bounce", "fate-pulse", "blood-pulse", "resource-pulse", "yuan-pulse", "armor-guard-pulse", "hp-damage-pulse", "hp-heal-pulse", "blood-trail", "boss-awake", "boss-phase-flash", "boss-phase-flash-strong", "boss-charge-glow", "portrait-dimmed", "portrait-phase-shift", "portrait-phase-zoom", "furnace-active", "furnace-forging");
  });
}

function showTurnBanner(kicker, text) {
  window.clearTimeout(bannerTimer);
  dom.turnBannerKicker.textContent = kicker;
  dom.turnBannerText.textContent = text;
  dom.turnBanner.classList.remove("show");
  void dom.turnBanner.offsetWidth;
  dom.turnBanner.classList.add("show");
  bannerTimer = window.setTimeout(() => dom.turnBanner.classList.remove("show"), 900);
}

function showCastDisplay(card) {
  window.clearTimeout(castTimer);
  dom.castGlyph.textContent = card.glyph;
  dom.castName.textContent = card.name;
  dom.castDisplay.classList.remove("show");
  void dom.castDisplay.offsetWidth;
  dom.castDisplay.classList.add("show");
  castTimer = window.setTimeout(() => dom.castDisplay.classList.remove("show"), 760);
}

function animateCardPlay(element, card) {
  if (!effectsAllowed()) return;
  const rect = element.getBoundingClientRect();
  const arenaRect = document.querySelector(".arena-panel").getBoundingClientRect();
  const clone = element.cloneNode(true);
  clone.classList.add("card-phantom", getCardPhantomClass(card));
  clone.setAttribute("aria-hidden", "true");
  clone.style.setProperty("--card-x", `${rect.left}px`);
  clone.style.setProperty("--card-y", `${rect.top}px`);
  clone.style.setProperty("--card-w", `${rect.width}px`);
  clone.style.setProperty("--card-h", `${rect.height}px`);
  clone.style.setProperty("--card-dx", `${arenaRect.left + arenaRect.width / 2 - rect.left - rect.width / 2}px`);
  clone.style.setProperty("--card-dy", `${arenaRect.top + arenaRect.height * 0.28 - rect.top - rect.height / 2}px`);
  clone.title = card.name;
  appendEffectNode(clone, 680);
  clone.addEventListener("animationend", () => clone.remove(), { once: true });
  window.setTimeout(() => clone.remove(), 720);
}

function spawnFloatText(target, text, kind) {
  if (!effectsAllowed() || !target || !dom.fxLayer) return;
  const rect = target.getBoundingClientRect();
  const item = document.createElement("span");
  item.className = `float-text ${kind || ""}`;
  item.textContent = text;
  item.style.left = `${rect.left + rect.width / 2}px`;
  item.style.top = `${rect.top + rect.height * 0.44}px`;
  dom.fxLayer.appendChild(item);
  trimFloatLayer();
  item.addEventListener("animationend", () => item.remove(), { once: true });
  window.setTimeout(() => item.remove(), 1100);
}

function animateHit(element) {
  if (element && element.closest && element.closest(".player-panel")) safeVibrate(16);
  if (!effectsAllowed() || !element) return;
  const panel = element.closest(".combatant");
  restartTimedClass(element, "damage-flash", 380);
  if (panel) restartTimedClass(panel, "panel-hit", 380);
}

function effectsAllowed() {
  return Boolean(effectsEnabled && dom.effectLayer);
}

// 轻振动：特性检测 + try/catch，仅在 navigator.vibrate 存在时调用；桌面无害。
function safeVibrate(ms) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch (err) { /* 部分浏览器非用户手势会抛错，忽略 */ }
}

function appendEffectNode(node, fallbackDuration = 900) {
  if (!effectsAllowed() || !node) return null;
  dom.effectLayer.appendChild(node);
  trimEffectLayer();
  window.setTimeout(() => node.remove(), fallbackDuration);
  return node;
}

function trimEffectLayer() {
  if (!dom.effectLayer) return;
  while (dom.effectLayer.children.length > MAX_EFFECT_NODES) {
    dom.effectLayer.firstElementChild?.remove();
  }
}

function trimFloatLayer() {
  if (!dom.fxLayer) return;
  while (dom.fxLayer.children.length > MAX_FLOAT_NODES) {
    dom.fxLayer.firstElementChild?.remove();
  }
}

function getTargetPoint(target, yRatio = 0.5) {
  const rect = target?.getBoundingClientRect?.();
  if (rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height * yRatio,
    };
  }
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
}

function spawnEffectAt(target, className, { text = "", duration = 900, yRatio = 0.5 } = {}) {
  if (!effectsAllowed()) return null;
  const point = getTargetPoint(target, yRatio);
  const node = document.createElement("span");
  node.className = `battle-effect ${className}`;
  if (text) node.textContent = text;
  node.style.left = `${point.x}px`;
  node.style.top = `${point.y}px`;
  appendEffectNode(node, duration + 120);
  node.addEventListener("animationend", () => node.remove(), { once: true });
  return node;
}

function spawnCenterEffect(className, text = "", duration = 900) {
  if (!effectsAllowed()) return null;
  const node = document.createElement("span");
  node.className = `battle-effect center-effect ${className}`;
  if (text) node.textContent = text;
  appendEffectNode(node, duration + 120);
  node.addEventListener("animationend", () => node.remove(), { once: true });
  return node;
}

function pulseElement(element, className, duration = 460) {
  if (!effectsAllowed() || !element) return;
  restartTimedClass(element, className, duration);
}

function clearAnimationClassTimer(element, className) {
  if (!element || !className) return;
  const timers = animationClassTimers.get(element);
  if (!timers) return;
  const timer = timers.get(className);
  if (timer) window.clearTimeout(timer);
  timers.delete(className);
  if (timers.size === 0) animationClassTimers.delete(element);
}

function scheduleAnimationClassRemoval(element, className, duration) {
  if (!element || !className) return;
  clearAnimationClassTimer(element, className);
  let timers = animationClassTimers.get(element);
  if (!timers) {
    timers = new Map();
    animationClassTimers.set(element, timers);
  }
  const timer = window.setTimeout(() => {
    element.classList.remove(className);
    const activeTimers = animationClassTimers.get(element);
    if (activeTimers) {
      activeTimers.delete(className);
      if (activeTimers.size === 0) animationClassTimers.delete(element);
    }
  }, duration);
  timers.set(className, timer);
}

function restartTimedClass(element, className, duration = 460) {
  if (!element || !className) return;
  clearAnimationClassTimer(element, className);
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  scheduleAnimationClassRemoval(element, className, duration);
}

function queryEffectElement(selector) {
  return document.querySelector(selector);
}

function triggerScreenShake() {
  if (!effectsAllowed()) return;
  restartTimedClass(document.body, "screen-shake-lite", 120);
}

function triggerHitPause(duration = 90) {
  if (!effectsAllowed()) return;
  restartTimedClass(document.body, "hit-pause-lite", duration);
}

function spawnDelayedFloatText(target, text, kind = "", delay = 70) {
  if (delay <= 0) {
    spawnFloatText(target, text, kind);
    return;
  }
  window.setTimeout(() => spawnFloatText(target, text, kind), delay);
}

function getCardPhantomClass(card) {
  return `phantom-${getCardEffectType(card)}`;
}

function getCardEffectType(card) {
  return card?.effectType || CARD_LIBRARY[card?.key]?.effectType || inferCardEffectType(card || {});
}

function flashCombatResource(selector, className = "resource-pulse", duration = 520) {
  pulseElement(queryEffectElement(selector), className, duration);
}

function playCardUseEffect(card) {
  if (!effectsAllowed()) return;
  switch (getCardEffectType(card)) {
    case "blade":
      spawnEffectAt(dom.enemyPortrait, "effect-moon-slash effect-moon-slash-prime", { duration: 340, yRatio: 0.48 });
      break;
    case "blood":
      spawnEffectAt(dom.enemyPortrait, "effect-blood-rune effect-blood-rune-prime", { duration: 520, yRatio: 0.48 });
      flashCombatResource(".blood-resource", "blood-pulse", 520);
      break;
    case "poison":
      spawnEffectAt(dom.enemyPortrait, "effect-poison-mist effect-poison-mist-prime", { duration: 680, yRatio: 0.52 });
      spawnEffectAt(dom.enemyPortrait, "effect-bug-shadow effect-bug-shadow-prime", { duration: 680, yRatio: 0.36 });
      break;
    case "armor":
      spawnEffectAt(dom.playerPortrait, "effect-armor-sigil effect-armor-guard", { duration: 620, yRatio: 0.48 });
      flashCombatResource(".armor-resource");
      break;
    case "yuan":
      spawnEffectAt(dom.playerPortrait, "effect-yuan-flow effect-yuan-strong", { duration: 640, yRatio: 0.52 });
      flashCombatResource(".yuan-resource", "yuan-pulse");
      if (game?.player?.doubleNextAttack || card.key === "wineWorm" || card.key === "drunkFateWorm") {
        flashCombatResource(".buff-list", "status-bounce", 420);
      }
      break;
    case "fate":
      spawnEffectAt(dom.playerPortrait, "effect-fate-ring effect-fate-ring-prime", { duration: 640, yRatio: 0.5 });
      playFateGainEffect();
      break;
    default:
      spawnCenterEffect("effect-utility-rune effect-utility-prime", card.glyph || "", 600);
      break;
  }
}

function playAttackEffect(card) {
  if (!effectsAllowed()) return;
  window.setTimeout(() => playAttackImpactEffect(card), 240);
}

function playAttackImpactEffect(card) {
  if (!effectsAllowed()) return;
  const effectType = getCardEffectType(card);
  if (effectType === "blood") {
    const highBlood = (game?.player?.blood || 0) >= Math.max(5, Math.floor(getBloodMax() * 0.65));
    spawnEffectAt(dom.enemyPortrait, highBlood ? "effect-blood-rune effect-blood-rune-overflow" : "effect-blood-rune effect-blood-rune-prime", { duration: 560 });
    pulseElement(dom.enemyPortrait, "blood-trail", 420);
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit-heavy", 430);
    if (game?.player?.hp <= game?.player?.maxHp * 0.35) flashCombatResource(".blood-resource", "blood-pulse", 680);
    triggerHitPause(105);
    triggerScreenShake();
    return;
  }
  if (effectType === "poison") {
    spawnEffectAt(dom.enemyPortrait, "effect-poison-mist effect-poison-mist-prime", { duration: 720 });
    spawnEffectAt(dom.enemyPortrait, "effect-bug-shadow effect-bug-shadow-prime", { duration: 680, yRatio: 0.36 });
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit", 360);
    return;
  }
  if (effectType === "blade") {
    spawnEffectAt(dom.enemyPortrait, "effect-moon-slash effect-moon-slash-prime", { duration: 430 });
    if (card.key === "armorBreaker" || card.key === "armorMeltPoison") {
      spawnEffectAt(dom.enemyPortrait, "effect-armor-crack", { duration: 520, yRatio: 0.5 });
    }
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit", 360);
    return;
  }
  const heavy = isBloodAttackCard(card) || card.type === "blood" || card.cost >= 2 || card.key === "bloodBlade";
  if (heavy) {
    spawnEffectAt(dom.enemyPortrait, "effect-blood-rune effect-blood-rune-prime", { duration: 520 });
    pulseElement(dom.enemyPortrait, "blood-trail", 360);
    pulseElement(document.querySelector(".enemy-panel"), "panel-hit-heavy", 360);
    triggerHitPause(95);
    triggerScreenShake();
  } else {
    spawnEffectAt(dom.enemyPortrait, "effect-moon-slash effect-moon-slash-prime", { duration: 420 });
  }
}

function playPlayerHitEffect() {
  if (!effectsAllowed()) return;
  spawnEffectAt(dom.playerPortrait, "effect-blood-splash", { duration: 430 });
  pulseElement(document.querySelector(".player-panel"), "panel-hit-heavy", 340);
}

function playArmorEffect() {
  spawnEffectAt(dom.playerPortrait, "effect-armor-sigil effect-armor-guard", { duration: 720, yRatio: 0.48 });
  pulseElement(queryEffectElement(".armor-resource"), "armor-guard-pulse", 620);
}

function playHealEffect() {
  spawnEffectAt(dom.playerPortrait, "effect-heal-sparks effect-heal-return", { duration: 820, yRatio: 0.58 });
}

function playBloodReturnEffect() {
  if (!effectsAllowed()) return;
  spawnEffectAt(dom.playerPortrait, "effect-blood-return", { duration: 720, yRatio: 0.52 });
  pulseElement(dom.playerHpBar, "hp-heal-pulse", 560);
}

function playPoisonApplyEffect() {
  spawnEffectAt(dom.enemyPortrait, "effect-poison-mist effect-poison-mist-prime", { duration: 760 });
  spawnEffectAt(dom.enemyPortrait, "effect-bug-shadow effect-bug-shadow-prime", { duration: 700, yRatio: 0.36 });
  pulseElement(dom.enemyStatusList, "status-bounce", 420);
}

function playPoisonTickEffect() {
  spawnEffectAt(dom.enemyPortrait, "effect-poison-corrosion effect-poison-corrosion-prime", { duration: 760 });
}

function playCorrosionEffect() {
  spawnEffectAt(dom.enemyPortrait, "effect-poison-burst effect-poison-burst-prime", { text: "蚀毒", duration: 760 });
}

function playFateGainEffect() {
  pulseElement(queryEffectElement(".fate-status"), "fate-pulse", 520);
}

function playFateFullEffect() {
  spawnCenterEffect("effect-fate-wheel effect-fate-wheel-prime", "命势圆满", 980);
  spawnCenterEffect("effect-fate-reward", "真元 +1 · 抽 1 张牌", 900);
}

function playBloodGainEffect() {
  pulseElement(queryEffectElement(".blood-status"), "blood-pulse", 520);
  flashCombatResource(".blood-resource", "blood-pulse", (game?.player?.blood || 0) >= 6 ? 760 : 560);
}

function playWineTriggerEffect() {
  if (!effectsAllowed()) return;
  flashCombatResource(".buff-list", "status-bounce", 520);
  flashCombatResource(".yuan-resource", "yuan-pulse", 520);
  spawnCenterEffect("effect-yuan-trigger", "酒意催发", 720);
}

function playDrawCardEffect(count = 1) {
  if (!effectsAllowed()) return;
  const text = count > 1 ? `牵引 ${count} 张` : "牵引";
  spawnEffectAt(dom.hand, "effect-card-draw-line", { text, duration: 620, yRatio: 0.24 });
}

function playDiscardCardEffect(count = 1) {
  if (!effectsAllowed()) return;
  const text = count > 1 ? `弃 ${count}` : "弃";
  spawnEffectAt(dom.hand, "effect-card-discard-dust", { text, duration: 620, yRatio: 0.28 });
}

function playCorpseDiskPoisonSuppressionEffect(removed) {
  if (!effectsAllowed()) return;
  spawnEffectAt(dom.enemyPortrait, "effect-boss-poison-suppression", { text: `压毒 -${removed}`, duration: 760, yRatio: 0.46 });
  pulseElement(dom.enemyStatusList, "boss-charge-glow", 620);
}

function playBossWakeEffect() {
  if (!effectsAllowed()) return;
  pulseElement(document.querySelector(".enemy-panel"), "boss-awake", 940);
  spawnEffectAt(dom.enemyPortrait, "effect-boss-mist", { duration: 940 });
  spawnCenterEffect("effect-boss-title", `${game.enemy?.definition?.name || "守关者"}苏醒`, 980);
}

function playCorpseDiskPhase2Effect() {
  if (!effectsAllowed()) return;
  triggerHitPause(300);
  const enemyPanel = document.querySelector(".enemy-panel");
  pulseElement(enemyPanel, "boss-phase-flash", 1120);
  pulseElement(enemyPanel, "boss-phase-flash-strong", 1120);
  pulseElement(dom.enemyPortrait, "portrait-phase-shift", 1020);
  pulseElement(dom.enemyPortrait, "portrait-phase-zoom", 1020);
  spawnCenterEffect("effect-boss-title effect-boss-title-prime", "尸盘转轮", 1120);
  spawnCenterEffect("effect-boss-subtitle", "死气倒灌，守关者杀意渐盛。", 1120);
  spawnCenterEffect("effect-boss-phase-haze effect-boss-phase-haze-strong", "", 1120);
  spawnEffectAt(dom.enemyPortrait, "effect-blood-rune effect-blood-rune-overflow", { duration: 860, yRatio: 0.48 });
}

function playBossActionEffect(action) {
  if (!effectsAllowed() || !isCorpseDiskBoss() || !game.enemy.phase2) return;
  if (game.enemy.intent === "corpseClaw") {
    spawnEffectAt(dom.playerPortrait, "effect-boss-claw effect-boss-claw-prime", { duration: 700, yRatio: 0.48 });
    triggerHitPause(90);
    triggerScreenShake();
  } else if (game.enemy.intent === "guFireBreath") {
    spawnEffectAt(dom.playerPortrait, "effect-boss-greenfire effect-boss-greenfire-prime", { duration: 760, yRatio: 0.48 });
  } else if (game.enemy.intent === "corpseCharge" || action?.kind === "charge") {
    pulseElement(dom.enemyStatusList, "boss-charge-glow", 920);
    spawnEffectAt(dom.enemyPortrait, "effect-boss-mist effect-boss-charge-mist", { duration: 900 });
  }
}

function playVictoryEffect() {
  if (!effectsAllowed()) return;
  pulseElement(dom.enemyPortrait, "portrait-dimmed", 900);
  spawnCenterEffect("effect-gold-seal", "命途已破", 900);
}

function playDefeatEffect() {
  if (!effectsAllowed()) return;
  pulseElement(dom.playerPortrait, "portrait-dimmed", 900);
  spawnCenterEffect("effect-crack", "道途断绝", 900);
}

function playFurnaceOpenEffect() {
  if (!effectsAllowed()) return;
  const resultCard = dom.resultOverlay?.querySelector(".result-card");
  resultCard?.classList.add("furnace-active");
}

function playFurnaceCompleteEffect(entry, outcome = null) {
  if (!effectsAllowed()) return;
  pulseElement(dom.furnaceComplete, "furnace-forging", 900);
  const effectClass = outcome?.kind === "mutation"
    ? "effect-furnace-mutation"
    : outcome?.kind === "backlash"
      ? "effect-furnace-backlash"
      : "effect-furnace-seal";
  const text = outcome?.kind === "mutation"
    ? "蛊性异变"
    : outcome?.kind === "backlash"
      ? "炼蛊反噬"
      : `炼成：${getDisplayCardName(entry.key, getUpgradeLevel(entry))}`;
  spawnCenterEffect(effectClass, text, 920);
}

function render() {
  if (!game) return;
  updateMobileViewportState();
  const { player, enemy } = game;
  const relic = RELICS[runState.relicId];
  const hero = player.definition;
  const nodeLabel = runState.currentNode?.type === "elite" ? "精英" : runState.currentNode?.type === "boss" ? "Boss" : "战斗";
  dom.turnNumber.textContent = game.turn;
  dom.floorEyebrow.textContent = isMobileLandscapeSafe()
    ? `第${runState.floor}段 · ${nodeLabel}`
    : `命途图 · 第 ${runState.floor} 段 · ${nodeLabel}`;
  dom.playerSideLabel.textContent = hero.role;
  dom.playerTitle.textContent = hero.name;
  dom.playerPortraitCaption.textContent = hero.caption;
  dom.playerPortrait.setAttribute("aria-label", `${hero.name}立绘`);
  dom.playerHp.textContent = player.hp;
  dom.playerMaxHp.textContent = player.maxHp;
  dom.playerHpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  dom.playerEnergy.textContent = `${player.energy} / ${player.baseEnergy}`;
  dom.playerArmor.textContent = player.armor;
  dom.playerLifespan.textContent = player.lifespan;
  dom.playerBlood.textContent = `${player.blood} / ${getBloodMax()}`;
  dom.topRelicGlyph.textContent = relic.glyph;
  dom.topRelicName.textContent = relic.name;
  dom.activeRelicGlyph.textContent = relic.glyph;
  dom.activeRelicName.textContent = relic.name;
  updateGuStoneDisplays();

  dom.enemyTitle.textContent = enemy.definition.name;
  dom.enemySideLabel.textContent = enemy.definition.title;
  dom.enemyHp.textContent = enemy.hp;
  dom.enemyMaxHp.textContent = enemy.maxHp;
  dom.enemyHpBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
  dom.arenaKicker.textContent = enemy.definition.kicker;
  dom.endTurnHint.textContent = `${enemy.definition.name}将执行意图`;
  dom.drawCount.textContent = game.drawPile.length;
  dom.discardCount.textContent = game.discardPile.length;
  const enemyPanel = document.querySelector(".enemy-panel");
  enemyPanel?.classList.toggle("boss-mode", Boolean(enemy.definition.isBoss));
  enemyPanel?.classList.toggle("elite-mode", Boolean(enemy.definition.isElite));
  enemyPanel?.classList.toggle("phase2-mode", Boolean(enemy.phase2));

  renderTowerProgress();
  renderPlayerPortrait();
  renderEnemyPortrait();
  renderBuffs();
  renderIntent();
  renderEnemyStatuses();
  renderHand();
  dom.endTurnButton.disabled = game.status !== "playing" || game.inputLocked;
}

function renderBuffs() {
  const buffs = [];
  if (game.player.heroId === "poison") {
    buffs.push({ label: "毒道被动：万毒归宗", title: game.player.definition.passive, className: "poison-passive-status", keyword: "蚀毒" });
  } else {
    buffs.push({ label: `被动：${game.player.definition.passiveName}`, title: game.player.definition.passive, className: "passive-status" });
  }
  if (game.player.heroId === "fate") {
    buffs.push({
      label: `命势：${game.player.fateMomentum}/${FATE_MOMENTUM_MAX}`,
      title: "打出与上一张不同类型的卡牌时获得 1 层命势；满 3 层后真元 +1 并抽 1 张牌。",
      className: "fate-status",
      keyword: "命势",
    });
  }
  if (game.player.doubleNextAttack) buffs.push({ label: "酒意：下一张攻击蛊伤害翻倍", title: "下一张攻击蛊造成双倍伤害，触发后消失。" });
  if (game.player.heroId === "blood" || game.player.blood > 0) {
    buffs.push({
      label: `血煞：${game.player.blood}/${getBloodMax()}`,
      title: `血煞上限 ${getBloodMax()}；血道攻击会按牌面引用当前血煞获得额外伤害。当前血煞收益：+${game.player.blood} 或按卡牌倍率结算。`,
      className: `blood-status ${game.player.blood >= 6 ? "high-blood" : ""}`,
      keyword: "血煞",
    });
  }
  if (game.player.poison > 0) buffs.push({ label: `中毒：${game.player.poison} 层`, title: "敌方回合结束后受到等同层数的伤害，随后衰减 1 层。", className: "poison-status", keyword: "毒性" });
  runState.refinements.forEach((id) => buffs.push({ label: `炼蛊：${REFINEMENTS[id].name}`, title: REFINEMENTS[id].description, className: "refinement-status", keyword: "炼化" }));
  dom.buffList.innerHTML = buffs.length
    ? buffs.map((buff) => `<span class="buff-tag ${buff.className || ""}" ${buff.keyword ? keywordAttr(buff.keyword) : `title="${escapeAttribute(buff.title)}"`}>${buff.label}</span>`).join(" ")
    : '<span class="empty-buff">暂无蛊术加持</span>';
}

function renderTowerProgress() {
  const floor = Math.min(MAX_ROUTE_STEP, runState?.currentRouteStep || runState?.floor || 1);
  const parts = Array.from({ length: MAX_ROUTE_STEP }, (_, index) => index + 1).map((number) => {
    const state = number < floor ? "completed" : number === floor ? "current" : "locked";
    const node = `<span class="tower-node ${state}" aria-label="第 ${number} 段${state === "completed" ? "已完成" : state === "current" ? "当前" : "未解锁"}">${state === "completed" ? "✓" : number}</span>`;
    const link = number < MAX_ROUTE_STEP ? `<i class="tower-link ${floor > number ? "completed" : ""}"></i>` : "";
    return `${node}${link}`;
  });
  dom.towerProgress.innerHTML = `${parts.join("")}<span class="tower-floor-label">命途图进度<strong>第 ${floor} 段 / 第 ${MAX_ROUTE_STEP} 段</strong></span>`;
}

function getDeckStats() {
  const stats = { total: 0, attack: 0, defense: 0, utility: 0, blood: 0, poison: 0, upgraded: 0 };
  (runState?.deckCards || []).forEach((entry) => {
    const card = CARD_LIBRARY[entry.key];
    stats.total += 1;
    if (card.category === "attack") stats.attack += 1;
    if (card.category === "defense") stats.defense += 1;
    if (card.category === "utility") stats.utility += 1;
    if (card.type === "blood" || card.typeName.includes("血道")) stats.blood += 1;
    if (card.type === "poison" || card.typeName.includes("毒道")) stats.poison += 1;
    if (getUpgradeLevel(entry) > 0) stats.upgraded += 1;
  });
  return stats;
}

function getTemporaryMarks() {
  const marks = [];
  if (!runState) return marks;
  if (runState.nextBattleHpLoss > 0) marks.push({ label: `毒血残留：下一场开局失去 ${runState.nextBattleHpLoss} 生命`, duration: "下一场战斗" });
  if (runState.nextBattleEnemyAttackBonus > 0) marks.push({ label: `劫箱余祸：下一场敌人攻击 +${runState.nextBattleEnemyAttackBonus}`, duration: "下一场战斗" });
  if (runState.bloodMaxBonus > 0) marks.push({ label: `血灯烙印：血煞上限 +${runState.bloodMaxBonus}`, duration: "本局" });
  runState.deckCards.forEach((entry) => {
    if (entry.damageBonus > 0) marks.push({ label: `${CARD_LIBRARY[entry.key]?.name || "蛊牌"}伤害 +${entry.damageBonus}`, duration: "本局" });
  });
  if (game?.combatRelic?.greenPouchCardName) {
    marks.push({ label: `${game.combatRelic.greenPouchCardName}消耗 -1`, duration: "本场战斗" });
  }
  return marks;
}

function renderTemporaryMarksInventory() {
  const marks = getTemporaryMarks();
  if (!marks.length) return `<h3>临时咒痕</h3><p class="empty-inventory">暂无临时咒痕。</p>`;
  return `<h3>临时咒痕</h3><div>${marks.map((mark) => (
    `<span class="curse-chip"><strong>${mark.label}</strong><small>${mark.duration}</small></span>`
  )).join("")}</div>`;
}

function renderDeckOverlay() {
  if (!runState) return;
  const stats = getDeckStats();
  const refinementText = runState.refinements.length
    ? runState.refinements.map((id) => REFINEMENTS[id].name).join("、")
    : "暂无炼蛊择变";
  dom.deckSummary.innerHTML = `
    <span>当前卡组总数 <strong>${stats.total}</strong></span>
    <span>已炼化 <strong>${stats.upgraded}</strong></span>
    <span>当前命途 <strong>第 ${Math.min(MAX_ROUTE_STEP, runState.currentRouteStep)} 段</strong></span>
    <span>命途种子 <strong>${runState.trialSeed || "无"}</strong></span>
    <span>蛊石 <strong>${runState.guStones}</strong></span>
    <span>普通遗物 <strong>${runState.ordinaryRelics.length}</strong></span>
    <span>炼蛊强化 <strong>${refinementText}</strong></span>`;
  dom.deckStats.innerHTML = `
    <span>攻击蛊 ${stats.attack}</span>
    <span>护甲蛊 ${stats.defense}</span>
    <span>辅助蛊 ${stats.utility}</span>
    <span>血道蛊 ${stats.blood}</span>
    <span>毒道蛊 ${stats.poison}</span>`;
  dom.deckMaterials.innerHTML = `<h3>炼蛊材料</h3><div>${renderMaterialInventory()}</div>`;
  if (dom.deckRelics) dom.deckRelics.innerHTML = `<h3>遗物</h3><div>${renderRelicInventory()}</div>`;
  if (dom.deckMarks) dom.deckMarks.innerHTML = renderTemporaryMarksInventory();
  dom.deckList.innerHTML = runState.deckCards.map((entry) => renderDeckEntryCard(entry)).join("");
}

function openDeckOverlay() {
  if (!runState || !dom.deckOverlay) return;
  renderDeckOverlay();
  dom.deckOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeDeckOverlay() {
  dom.deckOverlay?.classList.add("hidden");
  refreshModalLock();
}

function getEnemyDamageSummary(enemy) {
  const actions = Object.values(enemy.actions || {});
  const damages = actions
    .flatMap((action) => [action.damage, action.baseDamage, action.secondDamage].filter((value) => Number(value) > 0))
    .map(Number);
  if (!damages.length) return "特殊行动";
  return `${Math.min(...damages)}-${Math.max(...damages)}`;
}

function getBalanceSummaryText() {
  const heroLines = Object.values(HEROES).map((hero) => `${hero.name}：生命 ${hero.maxHp}，真元 ${hero.energy}，寿元 ${hero.lifespan}`);
  const enemyLines = Object.values(ENEMY_LIBRARY).map((enemy) => `${enemy.name}：生命 ${Number(enemy.maxHp) || 0}，伤害 ${getEnemyDamageSummary(enemy)}`);
  const shopLines = [
    "买卡：12 蛊石",
    "治疗：9 蛊石 / 14 生命",
    "移除：18 蛊石",
    "随机材料：11 蛊石",
    "蛊坊残契：首次交易 7 折",
  ];
  const furnaceLines = [
    "材料契合：稳定 70% / 异变 20% / 反噬 10%",
    "材料相冲：稳定 50% / 异变 25% / 反噬 25%",
    "残魂入炉：稳定 40% / 异变 40% / 反噬 20%",
  ];
  return [
    "《逆命蛊途》平衡摘要",
    "",
    "主角基础属性",
    ...heroLines,
    "",
    "敌人生命与伤害",
    ...enemyLines,
    "",
    "蛊坊价格",
    ...shopLines,
    "",
    "炼蛊概率",
    ...furnaceLines,
    "",
    `当前卡牌数量：${Object.keys(CARD_LIBRARY).length}`,
    `当前遗物数量：${Object.keys(RELICS).length + Object.keys(ORDINARY_RELICS).length}`,
    `当前事件数量：${CHANCE_EVENTS.length}`,
    `当前敌人数量：${Object.keys(ENEMY_LIBRARY).length}`,
  ].join("\n");
}

function renderBalanceOverlay() {
  if (!dom.balanceSummary) return;
  dom.balanceSummary.innerHTML = getBalanceSummaryText()
    .split("\n\n")
    .map((block) => `<pre>${escapeAttribute(block)}</pre>`)
    .join("");
}

function openBalanceOverlay() {
  if (!dom.balanceOverlay || recordingModeEnabled || trialMode !== "balance") return;
  renderBalanceOverlay();
  dom.balanceOverlay.classList.remove("hidden");
  refreshModalLock();
}

function closeBalanceOverlay() {
  dom.balanceOverlay?.classList.add("hidden");
  refreshModalLock();
}

async function copyBalanceSummary() {
  const text = getBalanceSummaryText();
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(text);
    if (dom.runProgress) dom.runProgress.textContent = "平衡摘要已复制。";
  } catch (error) {
    console.warn("[平衡摘要复制失败]", error);
    if (dom.runProgress) dom.runProgress.textContent = "当前浏览器未开放剪贴板。";
  }
}

/* ===================================================================
 * V0.9.6.1 敌人状态说明：复用玩家那套 keyword tooltip（#keywordTooltip）。
 * 思路：扩 KEYWORD_HELP 增补“敌人侧”关键词；renderEnemyStatuses 里每个
 * 状态 span 用 enemyStatusAttr() 输出 data-keyword（命中则走统一 tooltip），
 * 命不中时回退到原 title。全局 pointerover/focusin/click/长按监听已覆盖
 * [data-keyword]（见 jsEdits 的长按补丁），桌面悬停/点击、手机长按/点击皆可看。
 * 无专属文案的状态：至少给“名 + 基础效果”兜底，Console 不报错。
 * =================================================================== */

/* 敌人状态说明（与玩家共用 KEYWORD_HELP；这里补敌人侧词条） */
const ENEMY_STATUS_HELP = {
  尸盘压毒: "毒性超过 12 层时，敌方回合结束清除 3 层毒性。",
  尸盘转轮: "生命过半后进入二阶，攻击与蓄势增强。",
  塔压: "此战敌人生命略微提高。",
  狂怒: "生命低于阈值后进入狂怒，攻击力提升。",
  自损: "以割伤自身换取更高伤害；你血量越低它越亢奋。",
  吸血: "命中后回复等量生命，续战不退。",
  蓄势: "本回合蓄力，下次攻击附加额外伤害。",
  护体: "覆一层血衣/护甲，先抵挡伤害后清零。",
};

/* 生成敌人状态的 tooltip 属性：优先 KEYWORD_HELP，其次 ENEMY_STATUS_HELP，
 * 都没有时用 fallback 文案兜底（保证“名+基础效果”），始终带 data-keyword。 */
function enemyStatusAttr(keyword, fallback) {
  const text = KEYWORD_HELP[keyword] || ENEMY_STATUS_HELP[keyword] || fallback || `${keyword}：敌方状态。`;
  /* 临时注入到敌人侧字典，使 showKeywordTooltip 能取到文案（不动玩家 KEYWORD_HELP 词条） */
  if (!KEYWORD_HELP[keyword] && !ENEMY_STATUS_HELP[keyword]) ENEMY_STATUS_HELP[keyword] = text;
  return ` data-keyword="${keyword}" tabindex="0" role="button" aria-label="${escapeAttribute(`${keyword}：${text}`)}"`;
}

function renderEnemyStatuses() {
  const statuses = [];
  if (game.enemy.id === "corpsepuppet") {
    statuses.push(`<span class="enemy-status enemy-boss-passive"${enemyStatusAttr("尸盘压毒")}>尸盘压毒</span>`);
    if (game.enemy.phase2) {
      statuses.push(`<span class="enemy-status enemy-boss-phase"${enemyStatusAttr("尸盘转轮")}>尸盘转轮</span>`);
    }
  }
  /* 第二层敌人狂怒相位（V0.9.6 enrage）可查询 */
  if (game.enemy.enraged) statuses.push(`<span class="enemy-status enemy-enrage-status"${enemyStatusAttr(game.enemy.enrageName || "狂怒", "生命低于阈值后狂怒，攻击提升。")}>${game.enemy.enrageName || "狂怒"}</span>`);
  if (game.enemy.towerPressure) statuses.push(`<span class="enemy-status"${enemyStatusAttr("塔压")}>塔压</span>`);
  if ((game.enemy.armor || 0) > 0) statuses.push(`<span class="enemy-status enemy-armor-status"${enemyStatusAttr("防御")}>防御 <strong>${game.enemy.armor}</strong></span>`);
  if (game.enemy.poison > 0) statuses.push(`<span class="enemy-status enemy-poison-status"${enemyStatusAttr("毒性")}>毒性 <strong>${game.enemy.poison}</strong></span>`);
  dom.enemyStatusList.innerHTML = statuses.join("");
  if (game.pendingEnemyPoisonPulse) {
    game.pendingEnemyPoisonPulse = false;
    pulseElement(dom.enemyStatusList.querySelector(".enemy-poison-status") || dom.enemyStatusList, "status-bounce", 420);
  }
}

function renderIntent() {
  const action = getCurrentEnemyAction();
  dom.intentBox.title = `敌人将在你结束回合后施展「${action.name}」。`;
  dom.intentIcon.textContent = action.icon;
  dom.intentName.textContent = action.name;
  if (action.kind === "charge") {
    dom.intentDescription.textContent = `本回合不攻击；下一次攻击 +${action.bonus}${action.armor ? `，获得 ${action.armor} 防御` : ""}`;
    updateIntentThreat(0);
  } else {
    const hitCount = action.hits || 1;
    const lowHpBonus = action.lowHpExtra && game.player.hp < game.player.maxHp / 2 ? action.lowHpExtra : 0;
    const enrageBonus = game.enemy.definition.enrage && game.enemy.hp <= game.enemy.maxHp * game.enemy.definition.enrage.threshold
      ? game.enemy.definition.enrage.attackBonus
      : 0;
    const routeBonus = game.enemyAttackBonus || 0;
    const totalDamage = action.damage * hitCount + game.enemy.chargedBonus + lowHpBonus + enrageBonus + routeBonus;
    const extras = [];
    if (hitCount > 1) extras.push(`${hitCount} 次连击`);
    if (game.enemy.chargedBonus > 0) extras.push("蓄势已计入");
    if (lowHpBonus > 0) extras.push(`追魂 +${lowHpBonus}`);
    if (enrageBonus > 0) extras.push("血纹狂化");
    if (routeBonus > 0) extras.push(`岔路恶果 +${routeBonus}`);
    if (action.lifespanDamage) extras.push(`另损 ${action.lifespanDamage} 寿元`);
    if (action.energyDrain) extras.push(`下回合少 ${action.energyDrain} 真元`);
    if (action.playerPoison) extras.push(`施加 ${action.playerPoison} 层毒性`);
    dom.intentDescription.textContent = `将造成 ${totalDamage} 点伤害${extras.length ? `（${extras.join("，")}）` : ""}`;
    // 净伤宣示：护甲一次性全量抵消（与 resolveEnemyTurn 同逻辑），预计掉血 = max(0, 总伤 - 当前护甲)。
    const netDamage = Math.max(0, totalDamage - (game.player.armor || 0));
    updateIntentThreat(netDamage);
  }
  dom.enemyPower.textContent = `蓄势：下次攻击 +${game.enemy.chargedBonus}`;
  dom.enemyPower.classList.toggle("hidden", game.enemy.chargedBonus === 0);
}

// 意图框内「预计掉 X 血（已算护甲）」一行 + 高威胁红光脉动。节点建一次后复用(切 hidden)，避免反复增删触发 aria-live 播报；脉动受 effectsAllowed 控制。
function updateIntentThreat(netDamage) {
  if (!dom.intentBox) return;
  let line = dom.intentBox.querySelector(".intent-net-damage");
  if (!line) {
    line = document.createElement("p");
    line.className = "intent-net-damage hidden";
    line.setAttribute("aria-hidden", "true");
    const host = dom.intentDescription && dom.intentDescription.parentNode ? dom.intentDescription.parentNode : dom.intentBox;
    host.appendChild(line);
  }
  if (netDamage > 0) {
    line.textContent = `预计掉 ${netDamage} 血（已算护甲）`;
    line.classList.remove("hidden");
    const playerHp = game.player ? game.player.hp : 0;
    const highThreat = effectsAllowed() && (netDamage >= 12 || (playerHp > 0 && netDamage > playerHp / 3));
    line.classList.toggle("is-high-threat", highThreat);
    dom.intentBox.classList.toggle("intent-threat-high", highThreat);
  } else {
    line.classList.add("hidden");
    line.classList.remove("is-high-threat");
    dom.intentBox.classList.remove("intent-threat-high");
  }
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, "");
}

function escapeAttribute(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getCardKeywordHelp(card) {
  const keywords = [];
  if (card.category === "attack") keywords.push("攻击：造成伤害，可被酒虫翻倍。");
  if (card.category === "defense") keywords.push("护甲：获得防御，优先抵挡敌方伤害。");
  if (card.category === "utility") keywords.push("辅助：提供抽牌、真元或特殊状态。");
  if (card.type === "fate") keywords.push("命势：不同类型卡牌交替出牌可叠加，满 3 层真元 +1 并抽 1 张牌。");
  if (isBloodAttackCard(card) || card.type === "blood") keywords.push(`血煞：上限 ${getBloodMax()}，血道攻击按牌面引用当前血煞。`);
  if (card.type === "poison" || card.typeName.includes("毒道")) keywords.push("毒性：敌方回合结束时造成等同层数的伤害；重复施毒可触发蚀毒。");
  if (card.upgradeLevel > 0) keywords.push(`炼化：当前 +${card.upgradeLevel}；${card.upgradeConfig?.rule || "强化了主要数值。"}`);
  if (card.mutated) keywords.push("异变：由蛊炉材料炼蛊转化而来，不能再次异变。");
  if (card.damaged) keywords.push(`受损：本局该卡消耗 +${card.costPenalty || 1}。`);
  if (card.skewed) keywords.push(getSkewPenaltyText(card));
  return keywords;
}

function toShortCardName(name) {
  if (typeof name !== "string") return name;
  // 长名去末尾"蛊"作短名（月刃蛊→月刃、返毒蛊→返毒）；二字名如"酒虫"保持原样。
  return name.length >= 3 && name.endsWith("蛊") ? name.slice(0, -1) : name;
}

function getCardTooltip(card, blockReason = "") {
  const effectiveCost = game ? getEffectiveCardCost(card) : card.cost;
  const lines = [
    blockReason ? `无法使用：${blockReason}` : `使用${card.name}`,
    `${card.typeName} · 消耗 ${effectiveCost} 真元${effectiveCost !== card.cost ? `（原消耗 ${card.cost}）` : ""}`,
    stripTags(card.effect),
    ...getCardKeywordHelp(card),
  ];
  return lines.join("\n");
}

function renderHand() {
  const locked = game.status !== "playing" || game.inputLocked;
  dom.hand.innerHTML = game.hand.map((card) => {
    const blockReason = getCardBlockReason(card);
    const disabled = locked || Boolean(blockReason);
    const blockClass = blockReason === "真元不足" ? "insufficient-energy" : blockReason ? "insufficient-resource" : "";
    const upgradeClass = card.upgradeLevel > 0 ? `upgraded-card upgrade-${card.upgradeLevel}` : "";
    const statusLabels = getEntryStatusLabels(card);
    const effectiveCost = getEffectiveCardCost(card);
    const title = getCardTooltip(card, blockReason);
    const plainEffect = stripTags(card.effect);
    const fullCardName = card.baseName || CARD_LIBRARY[card.key]?.name || stripTags(card.name);
    const combatCardName = document.body.classList.contains("mobile-combat-safe")
      ? toShortCardName(fullCardName)
      : fullCardName;
    return `
      <button class="card ${card.type} category-${card.category} ${blockClass} ${upgradeClass} ${card.mutated ? "is-mutated" : ""} ${card.damaged ? "is-damaged" : ""} ${card.skewed ? "is-skewed" : ""}" type="button"
        data-card-id="${card.instanceId}" data-glyph="${card.glyph}" data-category="${card.category}"
        ${disabled ? "disabled" : ""} title="${escapeAttribute(title)}" aria-disabled="${disabled}"
        aria-label="${escapeAttribute(`${card.name}，消耗 ${effectiveCost} 点真元，${plainEffect}`)}">
        <div class="card-title-row">
          <h3>${combatCardName}</h3>
          <span class="card-top-marks">
            <span class="card-cost ${effectiveCost !== card.cost ? "discounted" : ""}" aria-label="真元消耗">${effectiveCost}</span>
            ${card.upgradeLevel > 0 ? `<span class="card-upgrade-badge" aria-label="炼化等级">+${card.upgradeLevel}</span>` : ""}
          </span>
        </div>
        <div class="card-meta-row">
          <span class="card-type">${card.typeName}</span>
          ${statusLabels.length ? `<span class="card-state-badges">${statusLabels.map((label) => `<i>${label}</i>`).join("")}</span>` : ""}
        </div>
        <div class="card-art" aria-hidden="true">${card.art}</div>
        <p class="card-effect">${card.effect}</p>
        ${blockReason ? `<span class="card-block-reason">${blockReason}</span>` : ""}
      </button>`;
  }).join("");
}

function loadPortraitImage(image, path, label, owner, options = {}) {
  if (!image || !owner || !path) return;
  if (image.dataset.requestedPath === path) return;
  image.dataset.requestedPath = path;
  owner.classList.remove("image-loaded");
  image.classList.remove("image-load-error");
  image.hidden = false;
  image.onload = () => {
    image.dataset.loadedPath = path;
    delete image.dataset.failedPath;
    owner.classList.add("image-loaded");
  };
  image.onerror = () => {
    image.dataset.failedPath = path;
    image.classList.add("image-load-error");
    if (options.fallbackPath && options.fallbackPath !== path) {
      console.warn(`[立绘加载失败] ${label}：${path}。已回退至一相立绘。`);
      image.dataset.requestedPath = "";
      loadPortraitImage(image, options.fallbackPath, options.fallbackLabel || label, owner);
      return;
    }
    image.hidden = true;
    owner.classList.remove("image-loaded");
    console.warn(`[立绘加载失败] ${label}：${path}。已启用符号占位图。`);
  };
  image.src = path;
}

function renderPlayerPortrait() {
  const heroId = game.player.heroId;
  const path = PORTRAIT_PATHS.heroes[heroId];
  if (dom.playerPortrait.dataset.heroId === heroId && dom.playerPortraitImage.dataset.requestedPath === path) return;
  dom.playerPortrait.dataset.heroId = heroId;
  dom.playerPortraitFallback.innerHTML = `<span class="portrait-rune">${game.player.definition.glyph}</span>`;
  dom.playerPortraitImage.alt = `${game.player.definition.name}立绘`;
  loadPortraitImage(dom.playerPortraitImage, path, game.player.definition.name, dom.playerPortrait);
}

function renderEnemyPortrait() {
  const portraitPhase = game.enemy.id === "corpsepuppet" && game.enemy.phase2 ? "phase2" : "phase1";
  const portraitPath = portraitPhase === "phase2"
    ? PORTRAIT_PATHS.enemies.corpsepuppetPhase2
    : PORTRAIT_PATHS.enemies[game.enemy.id];
  if (dom.enemyPortrait.dataset.enemyId === game.enemy.id && dom.enemyPortrait.dataset.phase === portraitPhase) return;
  dom.enemyPortrait.dataset.enemyId = game.enemy.id;
  dom.enemyPortrait.dataset.phase = portraitPhase;
  dom.enemyPortrait.className = `portrait enemy-portrait enemy-${game.enemy.id} ${portraitPhase === "phase2" ? "enemy-phase2" : ""}`;
  dom.enemyPortrait.setAttribute("aria-label", `${game.enemy.definition.name}立绘`);
  dom.enemyPortrait.innerHTML = `<div class="portrait-fallback" aria-hidden="true">${getEnemySvg(game.enemy.id)}</div>
    <img class="portrait-image" alt="${game.enemy.definition.name}立绘" decoding="async">
    <span class="portrait-image-shade" aria-hidden="true"></span>
    <span class="portrait-caption">${game.enemy.definition.caption}</span>`;
  const image = dom.enemyPortrait.querySelector(".portrait-image");
  loadPortraitImage(image, portraitPath, game.enemy.definition.name, dom.enemyPortrait, {
    fallbackPath: portraitPhase === "phase2" ? PORTRAIT_PATHS.enemies.corpsepuppet : "",
    fallbackLabel: `${game.enemy.definition.name}一相立绘`,
  });
}

function getEnemySvg(enemyId) {
  const fallbacks = {
    shanxiao: { glyph: "魈", color: "#b94137" },
    rottenShanxiao: { glyph: "腐", color: "#8cae5d" },
    bloodwolf: { glyph: "狼", color: "#b94137" },
    redManeBloodwolf: { glyph: "鬃", color: "#c34a3e" },
    bloodwolfElite: { glyph: "狼", color: "#d14b43" },
    beeswarm: { glyph: "蜂", color: "#8cae5d" },
    wildBeeTide: { glyph: "潮", color: "#8cae5d" },
    corpsepuppet: { glyph: "尸", color: "#72a587" },
  };
  const fallback = fallbacks[enemyId] || { glyph: "邪", color: "#bda26d" };
  return `<svg class="enemy-figure-svg" viewBox="0 0 260 190" aria-hidden="true">
    <circle cx="130" cy="94" r="65" fill="none" stroke="${fallback.color}" stroke-opacity=".22"/>
    <circle cx="130" cy="94" r="49" fill="${fallback.color}" fill-opacity=".07" stroke="${fallback.color}" stroke-opacity=".34" stroke-dasharray="5 7"/>
    <path d="M65 150 Q130 22 196 150" fill="none" stroke="${fallback.color}" stroke-opacity=".18"/>
    <text x="130" y="112" text-anchor="middle" fill="${fallback.color}" font-size="58" font-family="KaiTi">${fallback.glyph}</text>
  </svg>`;
}

function bindEvents() {
  dom.heroChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-hero-id]");
    if (!choice) return;
    playUiSfx();
    progression.selectedHeroId = choice.dataset.heroId;
    renderTitleScreen();
  });
  dom.relicChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-relic-id]");
    if (!choice) return;
    playUiSfx();
    progression.selectedRelicId = choice.dataset.relicId;
    renderTitleScreen();
  });
  dom.tutorialOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openTutorial(0);
  });
  document.getElementById("updateLogButton")?.addEventListener("click", () => {
    playUiSfx();
    showUpdateLog();
  });
  document.getElementById("wanGuLuButton")?.addEventListener("click", () => {
    playUiSfx();
    openWanGuLu();
  });
  maybeAutoShowUpdateLog();
  dom.loreOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openLoreOverlay();
  });
  dom.trialSettingsButton?.addEventListener("click", () => {
    playUiSfx();
    openTrialSettingsOverlay();
  });
  dom.trialSettingsCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeTrialSettingsOverlay();
  });
  dom.trialSettingsOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.trialSettingsOverlay) closeTrialSettingsOverlay();
  });
  dom.trialModeChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-trial-mode]");
    if (!choice) return;
    playUiSfx();
    setTrialMode(choice.dataset.trialMode);
  });
  dom.trialSeedInput?.addEventListener("input", (event) => {
    event.target.value = String(event.target.value).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 7);
  });
  dom.trialSeedClearButton?.addEventListener("click", () => {
    playUiSfx();
    saveTrialSeedDraft("");
  });
  dom.trialSettingsApplyButton?.addEventListener("click", () => {
    playUiSfx();
    saveTrialSeedDraft(dom.trialSeedInput?.value || "");
    if (dom.runProgress) {
      dom.runProgress.textContent = "试炼设置已保存。";
      dom.runProgress.classList.remove("hidden");
    }
    closeTrialSettingsOverlay();
  });
  dom.settingsOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openSettingsOverlay();
  });
  dom.settingsCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeSettingsOverlay();
  });
  dom.settingsOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.settingsOverlay) closeSettingsOverlay();
  });
  dom.settingsMusicToggle?.addEventListener("click", () => {
    playUiSfx();
    window.AudioManager?.toggleMute?.();
    window.setTimeout(renderSettingsOverlay, 60);
  });
  dom.settingsVolume?.addEventListener("input", (event) => {
    window.AudioManager?.setVolume?.(event.target.value);
    renderSettingsOverlay();
  });
  dom.settingsEffectToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleVisualEffects();
    renderSettingsOverlay();
  });
  dom.settingsRecordingToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleRecordingMode();
  });
  dom.settingsLoreAnimationToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleLoreAnimationSkip();
  });
  dom.settingsHomeButton?.addEventListener("click", () => {
    confirmReturnToTitle();
  });
  dom.settingsRestartButton?.addEventListener("click", () => {
    confirmRestartRun();
  });
  dom.settingsTutorialResetButton?.addEventListener("click", () => {
    playUiSfx();
    resetNewPlayerGuidance();
  });
  dom.settingsLoreResetButton?.addEventListener("click", () => {
    playUiSfx();
    resetLoreUnlocks();
  });
  dom.balanceOpenButton?.addEventListener("click", () => {
    playUiSfx();
    openBalanceOverlay();
  });
  dom.balanceCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeBalanceOverlay();
  });
  dom.balanceOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.balanceOverlay) closeBalanceOverlay();
  });
  dom.balanceCopyButton?.addEventListener("click", () => {
    playUiSfx();
    copyBalanceSummary();
  });
  dom.balanceCopyRunStatsButton?.addEventListener("click", () => {
    playUiSfx();
    copyRunStatsSummary();
  });
  dom.recordingModeToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleRecordingMode();
  });
  dom.tutorialResetButton?.addEventListener("click", () => {
    playUiSfx();
    resetNewPlayerGuidance();
  });
  dom.tutorialCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeTutorial();
  });
  dom.tutorialSkipButton?.addEventListener("click", () => {
    playUiSfx();
    closeTutorial();
  });
  dom.tutorialPrevButton?.addEventListener("click", () => {
    playUiSfx();
    previousTutorialPage();
  });
  dom.tutorialNextButton?.addEventListener("click", () => {
    playUiSfx();
    nextTutorialPage();
  });
  dom.tutorialOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.tutorialOverlay) closeTutorial();
  });
  dom.loreCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeLoreOverlay();
  });
  dom.loreOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.loreOverlay) closeLoreOverlay();
  });
  dom.loreList?.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-lore-open]");
    if (openButton) {
      playUiSfx();
      openLoreDetail(openButton.dataset.loreOpen);
      return;
    }
    const backButton = event.target.closest("[data-lore-back]");
    if (backButton) {
      playUiSfx();
      selectedLoreId = "";
      renderLoreOverlay();
      return;
    }
    const copyButton = event.target.closest("[data-lore-copy]");
    if (copyButton) {
      playUiSfx();
      copyLoreQuote(copyButton.dataset.loreCopy);
      return;
    }
    const detail = event.target.closest("[data-lore-detail]");
    if (detail && !loreSkipAnimation) detail.classList.add("animation-complete");
  });
  dom.loreAnimationToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleLoreAnimationSkip();
  });
  dom.loreResetButton?.addEventListener("click", () => {
    playUiSfx();
    resetLoreUnlocks();
  });
  dom.battleCoachClose?.addEventListener("click", () => {
    playUiSfx();
    closeBattleCoach();
  });
  dom.startBattleButton.addEventListener("click", () => {
    playUiSfx();
    preloadBattleAssets();
    startNewRun();
  });
  dom.deckViewButton?.addEventListener("click", () => {
    playUiSfx();
    openDeckOverlay();
  });
  dom.deckStatsButton?.addEventListener("click", () => {
    playUiSfx();
    openRunStatsOverlay();
  });
  dom.mapDeckButton?.addEventListener("click", () => {
    playUiSfx();
    openDeckOverlay();
  });
  dom.mapRoute?.addEventListener("click", (event) => {
    const node = event.target.closest("[data-map-node]");
    if (node) selectMapNode(node.dataset.mapNode);
  });
  dom.resultDeckButton?.addEventListener("click", () => {
    playUiSfx();
    openDeckOverlay();
  });
  dom.resultStatsButton?.addEventListener("click", () => {
    playUiSfx();
    openRunStatsOverlay();
  });
  dom.resultLoreButton?.addEventListener("click", () => {
    playUiSfx();
    openLoreOverlay();
  });
  dom.resultFeedbackButton?.addEventListener("click", () => {
    playUiSfx();
    copyFeedbackInfo();
  });
  dom.deckLoreButton?.addEventListener("click", () => {
    playUiSfx();
    openLoreOverlay();
  });
  dom.deckCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeDeckOverlay();
  });
  dom.runStatsCloseButton?.addEventListener("click", () => {
    playUiSfx();
    closeRunStatsOverlay();
  });
  dom.runStatsOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.runStatsOverlay) closeRunStatsOverlay();
  });
  dom.runStatsCopyButton?.addEventListener("click", () => {
    playUiSfx();
    copyRunStatsSummary();
  });
  dom.effectToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleVisualEffects();
  });
  dom.mobileLogButton?.addEventListener("click", () => {
    playUiSfx();
    toggleMobileLogPanel();
  });
  dom.mobileAudioToggle?.addEventListener("click", () => {
    playUiSfx();
    toggleMobileAudioPanel();
  });
  dom.mobileAudioClose?.addEventListener("click", () => {
    playUiSfx();
    closeMobileAudioPanel();
  });
  dom.deckOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.deckOverlay) closeDeckOverlay();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTopLayerByEsc();
  });
  window.addEventListener("resize", updateMobileViewportState);
  window.addEventListener("orientationchange", updateMobileViewportState);
  window.addEventListener("visibilitychange", updateMobileViewportState);
  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest?.("[data-keyword]");
    if (target) showKeywordTooltip(target);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest?.("[data-keyword]")) hideKeywordTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest?.("[data-keyword]");
    if (target) showKeywordTooltip(target);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.("[data-keyword]")) hideKeywordTooltip();
  });
  /* 手机长按状态图标看说明（玩家/敌人共用 data-keyword） */
  let __kwLongPressTimer = null;
  document.addEventListener("touchstart", (event) => {
    const target = event.target.closest?.("[data-keyword]");
    if (!target) return;
    window.clearTimeout(__kwLongPressTimer);
    __kwLongPressTimer = window.setTimeout(() => showKeywordTooltip(target), 320);
  }, { passive: true });
  document.addEventListener("touchend", () => {
    window.clearTimeout(__kwLongPressTimer);
    window.setTimeout(hideKeywordTooltip, 1600);
  }, { passive: true });
  document.addEventListener("touchmove", () => { window.clearTimeout(__kwLongPressTimer); }, { passive: true });
  document.addEventListener("click", (event) => {
    if (document.body.classList.contains("mobile-audio-open")) {
      const insideAudio = dom.audioControls?.contains(event.target);
      const onAudioToggle = dom.mobileAudioToggle?.contains(event.target);
      if (!insideAudio && !onAudioToggle) closeMobileAudioPanel();
    }
    const target = event.target.closest?.("[data-keyword]");
    if (target) showKeywordTooltip(target);
    else hideKeywordTooltip();
  });
  dom.hand.addEventListener("click", (event) => {
    const cardButton = event.target.closest(".card");
    if (!cardButton) return;
    const id = cardButton.dataset.cardId;
    if (document.body.classList.contains("mobile-combat-safe")) showCardPreview(id);
    else playCard(id);
  });
  dom.endTurnButton.addEventListener("click", () => {
    playUiSfx();
    endTurn();
  });
  dom.logHistoryToggle.addEventListener("click", toggleOlderLogs);
  dom.logBattleTab?.addEventListener("click", () => switchLogChannel("battle"));
  dom.logJourneyTab?.addEventListener("click", () => switchLogChannel("journey"));
  dom.clearLogButton.addEventListener("click", () => {
    if (activeLogChannel === "journey") {
      const nodeText = runState?.currentNode ? `当前节点：${runState.currentNode.name || "命途节点"}。` : "命途札记已清。";
      resetLogChannel("journey", nodeText);
      return;
    }
    if (!game) {
      resetLogChannel("battle", "战斗铭刻已清。");
      return;
    }
    resetLogChannel("battle", `第 ${Math.min(MAX_ROUTE_STEP, runState?.currentRouteStep || runState?.floor || 1)} 段：${game.player.definition.name}对阵${game.enemy.definition.name}。`);
    addLog(`当前第 ${game.turn} 回合；生命 ${game.player.hp}/${game.player.maxHp}，敌人生命 ${game.enemy.hp}/${game.enemy.maxHp}。`, "system-log");
  });
  dom.cardRewardChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-reward-card]");
    if (choice) {
      playUiSfx();
      resolveCardReward(choice.dataset.rewardCard);
    }
  });
  dom.skipRewardButton.addEventListener("click", () => {
    playUiSfx();
    resolveCardReward(null);
  });
  dom.materialRewardChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-material-id]");
    if (choice) {
      playUiSfx();
      resolveMaterialReward(choice.dataset.materialId);
    }
  });
  dom.skipMaterialButton?.addEventListener("click", () => {
    playUiSfx();
    resolveMaterialReward(null);
  });
  dom.eventChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-event-choice]");
    if (choice) {
      playUiSfx();
      resolveChanceChoice(choice.dataset.eventChoice);
      return;
    }
    const restChoice = event.target.closest("[data-rest-choice]");
    if (restChoice) {
      resolveRestChoice(restChoice.dataset.restChoice);
    }
  });
  dom.eliteConfirmButton?.addEventListener("click", () => {
    playUiSfx();
    confirmEliteBattle();
  });
  dom.eliteCancelButton?.addEventListener("click", () => {
    playUiSfx();
    cancelEliteBattle();
  });
  dom.shopCardChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-shop-card-index]");
    if (choice) {
      playUiSfx();
      buyShopCard(choice.dataset.shopCardIndex);
    }
  });
  dom.shopActions?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-shop-action]")?.dataset.shopAction;
    if (!action) return;
    playUiSfx();
    if (action === "heal") buyShopHeal();
    else if (action === "remove") openShopRemovePicker();
    else if (action === "material") buyShopMaterial();
  });
  dom.shopRemoveChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-shop-remove-card]");
    if (choice) {
      playUiSfx();
      previewShopRemoveCard(choice.dataset.shopRemoveCard);
    }
  });
  dom.shopConfirmRemoveButton?.addEventListener("click", () => {
    playUiSfx();
    confirmShopRemoveCard();
  });
  dom.shopBackRemoveButton?.addEventListener("click", () => {
    playUiSfx();
    if (runState?.currentNode?.type === "rest" && !runState.lastRestChoice) {
      cancelShopRemovePicker();
      return;
    }
    dom.shopRemoveConfirm?.classList.add("hidden");
    pendingShopRemoveCardId = "";
    if (runState) runState.pendingShopRemoveCardId = "";
  });
  dom.shopCancelRemoveButton?.addEventListener("click", () => {
    playUiSfx();
    cancelShopRemovePicker();
  });
  dom.refineChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-refinement-id]");
    if (choice) {
      playUiSfx();
      chooseRefinement(choice.dataset.refinementId);
    }
  });
  dom.furnaceMaterialChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-furnace-material]");
    if (choice) {
      playUiSfx();
      selectFurnaceMaterial(choice.dataset.furnaceMaterial);
    }
  });
  dom.furnaceChoices?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-furnace-card]");
    if (choice) {
      playUiSfx();
      selectFurnaceCandidate(choice.dataset.furnaceCard);
    }
  });
  dom.confirmFurnaceButton?.addEventListener("click", () => {
    playUiSfx();
    confirmFurnaceUpgrade();
  });
  dom.backFurnaceButton?.addEventListener("click", () => {
    playUiSfx();
    returnToFurnaceChoices();
  });
  dom.furnaceSkipButton?.addEventListener("click", () => {
    playUiSfx();
    skipFurnace();
  });
  dom.resultPrimaryButton.addEventListener("click", () => {
    playUiSfx();
    const action = dom.resultPrimaryButton.dataset.action;
    if (action === "enterLayer2") { showLayer2RouteSelect(); return; }
    else if (action === "nextFloor") advanceToNextFloor();
    else if (action === "completeNode") {
      if (runState?.currentNode?.type === "event" || runState?.currentNode?.type === "shop" || runState?.currentNode?.type === "rest") completeOverlayNode();
      else advanceToNextFloor();
    }
    else if (action === "newRun") resetRunToTitle();
  });
  dom.resultSecondaryButton.addEventListener("click", () => {
    playUiSfx();
    if (dom.resultSecondaryButton.dataset.action === "settleLayer1") { settleAtLayer1(); return; }
    resetRunToTitle();
  });
  dom.runSummary?.addEventListener("click", (event) => {
    const routeBtn = event.target.closest("[data-layer2-route]");
    if (routeBtn) { playUiSfx(); chooseLayer2Route(routeBtn.dataset.layer2Route); return; }
    const branchBtn = event.target.closest("[data-layer2-branch]");
    if (branchBtn) { playUiSfx(); chooseLayer2Branch(branchBtn.dataset.layer2Branch); return; }
  });
}

/* ===================== DEV MODE 开发者测试面板 · V0.9.6.2 ===================== */
/* 纯加性：仅 preview 路径 + ?dev=kaan 时注入。正式入口 root 即便带 ?dev=kaan 也绝不启用。 */
/* 不改 CARD_LIBRARY / 初始卡组 / 敌人 / Boss 数值 / 音频状态机 / 手机战斗 HUD。 */
function isDevMode() {
  try {
    return location.pathname.includes("/preview/") &&
      new URLSearchParams(location.search).get("dev") === "kaan";
  } catch (err) { return false; }
}

function devNotify(msg, cls = "system-log") {
  // 战斗中走战斗日志，否则走旅程日志，无则 console
  try {
    if (typeof game !== "undefined" && game && typeof addLog === "function") { addLog(`[DEV] ${msg}`, cls); return; }
    if (typeof addJourneyLog === "function") { addJourneyLog(`[DEV] ${msg}`, cls); return; }
  } catch (err) {}
  console.log(`[DEV] ${msg}`);
}

function devRender() { try { if (typeof render === "function") render(); } catch (err) { console.warn("[DEV] render 失败", err); } }

function devRequireBattle() {
  if (typeof game === "undefined" || !game || !game.player || !game.enemy) {
    devNotify("当前不在战斗中，此操作无效。", "damage-log");
    return false;
  }
  return true;
}

function devRequireRun() {
  if (typeof runState === "undefined" || !runState) {
    devNotify("当前无命途状态（未开始游戏）。", "damage-log");
    return false;
  }
  return true;
}

/* 测试套牌：只往当前 runState.deckCards 临时加现有 CARD_LIBRARY 卡；不存在跳过 + console.warn */
function devAddTestDeck(label, keys) {
  if (!devRequireRun()) return;
  if (typeof addRunDeckCard !== "function" || typeof CARD_LIBRARY === "undefined") {
    devNotify("加卡函数/卡库不可用。", "damage-log"); return;
  }
  let added = 0;
  keys.forEach((k) => {
    if (CARD_LIBRARY[k]) { addRunDeckCard(k); added += 1; }
    else console.warn(`[DEV] 测试套牌跳过：CARD_LIBRARY 中无 key "${k}"`);
  });
  devNotify(`已加入${label}测试套牌 ${added}/${keys.length} 张。`, "positive-log");
  devRender();
}

/* 万蛊录：解锁全部条目（卡 + 二层敌人/Boss + 残卷）。仅 dev 模式、用户主动点击时写 localStorage。 */
function devUnlockAllCodex() {
  let cardN = 0;
  if (typeof window !== "undefined" && Array.isArray(window.GU_CATALOG) && typeof markGuDiscovered === "function") {
    window.GU_CATALOG.forEach((item) => { if (item && item.cardKey) { markGuDiscovered(item.cardKey); cardN += 1; } });
  }
  // 兜底：把当前 CARD_LIBRARY 全部 key 也写入发现集合
  if (typeof CARD_LIBRARY !== "undefined" && typeof markGuDiscovered === "function") {
    Object.keys(CARD_LIBRARY).forEach((k) => markGuDiscovered(k));
  }
  // 二层敌人/Boss
  const L2_ENEMIES = ["rotleafGu", "miasmaParasite", "miasmaLanternEliteGu", "miasmaMotherBoss",
    "bloodLeechSwarm", "brokenMeridianGu", "bloodRobePriestEliteGu", "bloodRobeMotherBoss"];
  if (typeof layer2MarkBestiary === "function") L2_ENEMIES.forEach((id) => layer2MarkBestiary(id));
  // 残卷
  if (typeof LORE_PAGES !== "undefined" && Array.isArray(LORE_PAGES) && typeof unlockLorePage === "function") {
    LORE_PAGES.forEach((p) => { if (p && p.id) unlockLorePage(p.id, { silent: true }); });
  }
  devNotify(`已解锁全部万蛊录：卡 ${cardN} 条 + 二层敌人/Boss + 残卷。`, "positive-log");
  devRender();
}

function devResetCodex() {
  try { localStorage.removeItem("niming.discoveredGu"); } catch (err) {}
  try { if (typeof LAYER2_BESTIARY_KEY !== "undefined") localStorage.removeItem(LAYER2_BESTIARY_KEY); } catch (err) {}
  try { localStorage.removeItem("nmg.layer2.progress"); } catch (err) {}
  try { if (typeof resetLoreUnlocks === "function") resetLoreUnlocks(); } catch (err) {}
  devNotify("已重置万蛊录发现数据（卡/二层敌人/二层进度/残卷）。", "important");
  devRender();
}

function devMarkLayer2Enemies() {
  const L2_ENEMIES = ["rotleafGu", "miasmaParasite", "miasmaLanternEliteGu", "miasmaMotherBoss",
    "bloodLeechSwarm", "brokenMeridianGu", "bloodRobePriestEliteGu", "bloodRobeMotherBoss"];
  if (typeof layer2MarkBestiary !== "function") { devNotify("layer2MarkBestiary 不可用。", "damage-log"); return; }
  L2_ENEMIES.forEach((id) => layer2MarkBestiary(id));
  devNotify("已标记第二层敌人/Boss 为已遭遇。", "positive-log");
  devRender();
}

function devMarkLayer2BossDefeated() {
  if (!devRequireRun()) return;
  if (runState.layer2 && runState.layer2.active) {
    runState.layer2.bossDefeated = true;
    const rid = runState.layer2.routeId;
    if (typeof layer2MarkProgress === "function") {
      layer2MarkProgress(rid === "miasma" ? "miasmaBossDefeated" : "bloodmarshBossDefeated");
    }
    devNotify("已标记第二层 Boss 已击败。", "positive-log");
  } else {
    devNotify("当前不在第二层，无法标记 Boss 击败。", "damage-log");
  }
  devRender();
}

/* 跳转：直接开一层/二层 Boss 战。设置 currentNode 后 startFloorBattle()（createBattleState 优先读 currentNode.enemyId）。 */
function devJumpBoss(opts) {
  if (!devRequireRun()) return;
  if (opts.layer2) {
    runState.layer = 2;
    runState.layer2 = { active: true, routeId: opts.routeId, routeName: opts.routeName || "", theme: opts.routeId,
      branchChoice: "", bossDefeated: false, nodesCleared: 0, lastNodeName: "DEV-Boss直跳" };
  } else {
    runState.floor = (typeof MAX_ROUTE_STEP !== "undefined") ? MAX_ROUTE_STEP : 4;
  }
  runState.routeHistory = runState.routeHistory || []; runState.completedNodes = runState.completedNodes || [];
  runState.currentNode = { id: "dev-boss", type: "boss", enemyId: opts.enemyId, name: opts.name, step: runState.floor };
  devNotify(`跳转至 Boss：${opts.name}`, "important");
  if (typeof startFloorBattle === "function") startFloorBattle();
}

function devCopyToClipboard(label, obj) {
  let text;
  try { text = JSON.stringify(obj, null, 2); } catch (err) { text = String(obj); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => devNotify(`${label} 已复制到剪贴板。`, "system-log"))
      .catch((err) => { console.warn("[DEV] 复制失败", err); console.log(`[DEV] ${label}:`, obj); devNotify(`${label} 复制失败，已打印到 console。`, "damage-log"); });
  } else {
    console.log(`[DEV] ${label}:`, obj);
    devNotify(`剪贴板不可用，${label} 已打印到 console。`, "system-log");
  }
}

/* Dev 动作映射表：id -> handler。全部调用真实游戏函数/字段后 devRender()。 */
const DEV_ACTIONS = {
  // —— 资源 ——
  "stone100": () => { if (typeof gainGuStones === "function" && devRequireRun()) { gainGuStones(100, "DEV测试"); devRender(); } },
  "stone999": () => { if (typeof gainGuStones === "function" && devRequireRun()) { gainGuStones(999, "DEV测试"); devRender(); } },
  "healFull": () => { if (!devRequireBattle()) return; game.player.hp = game.player.maxHp; if (runState) runState.currentHp = game.player.hp; devNotify("生命已回满。", "positive-log"); devRender(); },
  "hp1": () => { if (!devRequireBattle()) return; game.player.hp = 1; if (runState) runState.currentHp = 1; devNotify("当前生命设为 1。", "damage-log"); devRender(); },
  "energy3": () => { if (!devRequireBattle()) return; game.player.energy += 3; devNotify("真元 +3。", "positive-log"); devRender(); },
  "energy10": () => { if (!devRequireBattle()) return; game.player.energy += 10; devNotify("真元 +10。", "positive-log"); devRender(); },
  // —— 战斗 ——
  "enemyHp1": () => { if (!devRequireBattle()) return; game.enemy.hp = 1; devNotify("敌人生命降为 1。", "damage-log"); devRender(); },
  "killEnemy": () => { if (!devRequireBattle()) return; game.enemy.hp = 0; devNotify("立刻击败当前敌人，触发胜利结算。", "important"); if (typeof checkBattleResult === "function") checkBattleResult(); else devRender(); },
  "armor20": () => { if (!devRequireBattle()) return; if (typeof gainArmor === "function") gainArmor(20, "DEV测试"); else game.player.armor += 20; devRender(); },
  "enemyPoison10": () => { if (!devRequireBattle()) return; if (typeof applyEnemyPoison === "function") applyEnemyPoison(10, "DEV毒性", { corrosive: false }); else game.enemy.poison += 10; devRender(); },
  "clearPlayerDebuff": () => { if (!devRequireBattle()) return; game.player.poison = 0; devNotify("已清除玩家负面状态（毒）。", "positive-log"); devRender(); },
  "clearEnemyState": () => { if (!devRequireBattle()) return; game.enemy.poison = 0; game.enemy.armor = 0; game.enemy.chargedBonus = 0; game.enemy.phase2 = false; devNotify("已清除敌人状态（毒/甲/蓄势/相位标记）。", "positive-log"); devRender(); },
  // —— 跳转 ——
  "jumpL1Boss": () => devJumpBoss({ layer2: false, enemyId: "corpsepuppet", name: "尸盘监守" }),
  "jumpL2Miasma": () => { if (!devRequireRun()) return; if (typeof enterLayer2Map === "function") enterLayer2Map("miasma"); devNotify("跳转至第二层地图·瘴林。", "important"); },
  "jumpL2Blood": () => { if (!devRequireRun()) return; if (typeof enterLayer2Map === "function") enterLayer2Map("bloodmarsh"); devNotify("跳转至第二层地图·血沼。", "important"); },
  "jumpRouteSelect": () => { if (!devRequireRun()) return; if (typeof showLayer2RouteSelect === "function") showLayer2RouteSelect(); devNotify("打开第二层路线选择。", "important"); },
  "jumpMiasmaBoss": () => devJumpBoss({ layer2: true, routeId: "miasma", routeName: "瘴林", enemyId: "miasmaMotherBoss", name: "百瘴母蛊" }),
  "jumpBloodBoss": () => devJumpBoss({ layer2: true, routeId: "bloodmarsh", routeName: "血沼", enemyId: "bloodRobeMotherBoss", name: "血衣蛊母" }),
  "showConclusion": () => { if (!devRequireRun()) return; if (typeof showRunConclusion === "function") { showRunConclusion(true); devNotify("打开结算页（通关）。", "important"); } },
  // —— 卡牌测试 ——
  "draw3": () => { if (!devRequireBattle()) return; if (typeof drawCards === "function") drawCards(3); devNotify("抽 3 张牌。", "system-log"); devRender(); },
  "rewardRandom": () => { if (!devRequireRun()) return; if (typeof getRandomRewardCardKey === "function" && typeof addRunDeckCard === "function") { const k = getRandomRewardCardKey(); addRunDeckCard(k); devNotify(`获得随机奖励牌：${k}`, "positive-log"); devRender(); } },
  "openReward": () => { if (!devRequireRun()) return; if (typeof openCardReward === "function") openCardReward(); },
  "deckPoison": () => devAddTestDeck("毒道", ["greenMiasma", "poisonReturn", "insectSwarm", "moltingShell"]),
  "deckBlood": () => devAddTestDeck("血道", ["bloodBlade", "bloodReversal", "burningEssence", "heartEater"]),
  "deckFate": () => devAddTestDeck("命势", ["fateThread", "reversePath", "fixedFate", "lifeLamp"]),
  "deckArmor": () => devAddTestDeck("护甲", ["ironSkin", "mysticCarapace", "shellRemnant", "moltedArmor"]),
  // —— 万蛊录 ——
  "codexUnlockAll": devUnlockAllCodex,
  "codexReset": devResetCodex,
  "codexMarkL2": devMarkLayer2Enemies,
  "codexMarkBoss": devMarkLayer2BossDefeated,
  // —— 调试 ——
  "copyRun": () => { if (!devRequireRun()) return; devCopyToClipboard("runState", runState); },
  "copyGame": () => { if (!devRequireBattle()) return; devCopyToClipboard("game", game); },
  "copyMap": () => { if (!devRequireRun()) return; devCopyToClipboard("mapState", runState.mapState); },
  "logState": () => { console.log("=== DEV runState ===", typeof runState !== "undefined" ? runState : null); console.log("=== DEV game ===", typeof game !== "undefined" ? game : null); console.log("=== DEV mapState ===", (typeof runState !== "undefined" && runState) ? runState.mapState : null); devNotify("已打印 runState/game/mapState 到 console（F12）。", "system-log"); },
  "showVersion": () => { const v = (typeof GAME_VERSION !== "undefined") ? GAME_VERSION : "-"; const b = (typeof window !== "undefined" && window.__NMG_BUILD__) ? window.__NMG_BUILD__ : "-"; devNotify(`版本：${v} | Build：${b}`, "system-log"); console.log(`[DEV] 版本：${v} | Build：${b}`); devRender(); },
};

/* 面板分类结构（按钮文案 + action id） */
const DEV_PANEL_GROUPS = [
  { title: "资源", buttons: [
    ["蛊石 +100", "stone100"], ["蛊石 +999", "stone999"],
    ["回满生命", "healFull"], ["生命设为1", "hp1"],
    ["真元 +3", "energy3"], ["真元 +10", "energy10"],
  ] },
  { title: "战斗（需战斗中）", buttons: [
    ["敌血降为1", "enemyHp1"], ["立刻击败敌人", "killEnemy"],
    ["自身 +20护甲", "armor20"], ["敌人 +10毒", "enemyPoison10"],
    ["清玩家负面", "clearPlayerDebuff"], ["清敌人状态", "clearEnemyState"],
  ] },
  { title: "跳转", buttons: [
    ["一层Boss·尸盘监守", "jumpL1Boss"],
    ["二层地图·瘴林", "jumpL2Miasma"], ["二层地图·血沼", "jumpL2Blood"],
    ["二层路线选择", "jumpRouteSelect"],
    ["百瘴母蛊(开战)", "jumpMiasmaBoss"], ["血衣蛊母(开战)", "jumpBloodBoss"],
    ["打开结算页", "showConclusion"],
  ] },
  { title: "卡牌测试", buttons: [
    ["抽3张牌", "draw3"], ["随机奖励牌", "rewardRandom"],
    ["打开选牌奖励", "openReward"],
    ["加毒道套牌", "deckPoison"], ["加血道套牌", "deckBlood"],
    ["加命势套牌", "deckFate"], ["加护甲套牌", "deckArmor"],
  ] },
  { title: "万蛊录", buttons: [
    ["解锁全部条目", "codexUnlockAll"], ["重置发现数据", "codexReset"],
    ["标记二层敌人已见", "codexMarkL2"], ["标记二层Boss已击败", "codexMarkBoss"],
  ] },
  { title: "调试", buttons: [
    ["复制 runState", "copyRun"], ["复制 game", "copyGame"],
    ["复制 mapState", "copyMap"], ["打印到 console", "logState"],
    ["显示版本+build", "showVersion"],
  ] },
];

let __devPanelBuilt = false;

function buildDevPanelDom() {
  if (__devPanelBuilt) return;
  __devPanelBuilt = true;

  // 角落 DEV MODE 小标识
  const badge = document.createElement("div");
  badge.className = "dev-mode-badge";
  badge.textContent = "DEV MODE";
  document.body.appendChild(badge);

  // 右下角 DEV 开关按钮
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "dev-mode-button";
  toggleBtn.textContent = "DEV";
  document.body.appendChild(toggleBtn);

  // 面板
  const panel = document.createElement("div");
  panel.className = "dev-panel hidden";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "开发者测试模式");

  const header = document.createElement("div");
  header.className = "dev-panel-header";
  header.innerHTML =
    '<div class="dev-panel-titles">' +
    '<strong class="dev-panel-title">开发者测试模式</strong>' +
    '<span class="dev-panel-sub">仅用于作者调试、录屏、平衡测试。当前数据不代表正式玩家体验。</span>' +
    '</div>';
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "dev-panel-close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "关闭");
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "dev-panel-body";
  DEV_PANEL_GROUPS.forEach((group) => {
    const sec = document.createElement("section");
    sec.className = "dev-group";
    const gh = document.createElement("button");
    gh.type = "button";
    gh.className = "dev-group-header";
    gh.innerHTML = `<span>${group.title}</span><i class="dev-group-caret">▾</i>`;
    const grid = document.createElement("div");
    grid.className = "dev-group-grid";
    group.buttons.forEach(([label, action]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dev-action-btn";
      b.textContent = label;
      b.dataset.devAction = action;
      grid.appendChild(b);
    });
    gh.addEventListener("click", () => { sec.classList.toggle("collapsed"); });
    sec.appendChild(gh);
    sec.appendChild(grid);
    body.appendChild(sec);
  });
  panel.appendChild(body);
  document.body.appendChild(panel);

  // 开关
  toggleBtn.addEventListener("click", () => { panel.classList.toggle("hidden"); });
  closeBtn.addEventListener("click", () => { panel.classList.add("hidden"); });

  // 事件委托：所有 action 按钮
  body.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-dev-action]");
    if (!btn) return;
    const action = btn.dataset.devAction;
    const handler = DEV_ACTIONS[action];
    if (typeof handler !== "function") { console.warn(`[DEV] 未知 action：${action}`); return; }
    try { handler(); }
    catch (err) { console.error(`[DEV] action "${action}" 执行出错`, err); devNotify(`操作出错：${action}（见 console）`, "damage-log"); }
  });
}

function initDevMode() {
  if (!isDevMode()) return; // 门控不满足：不注入任何 DOM / 按钮
  document.body.classList.add("dev-mode-on");
  buildDevPanelDom();
  console.log("[DEV] 开发者测试模式已启用（preview + dev=kaan）。");
}
/* =================== /DEV MODE =================== */

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  initLoreSystem();
  initEffectSettings();
  initTrialSettings();
  initRecordingMode();
  updateTrialModeControls();
  bindEvents();
  updateMobileViewportState();
  showStartScreen();
  initDevMode();
});
