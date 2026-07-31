"use strict";
/* =====================================================================
 * 《逆命蛊途》静态数据模块  nmg-data.js  (V0.9.36 批次B-1 模块化·首抽)
 * 从 game.js 抽出的纯静态数据前缀：CARD_LIBRARY … REFINEMENTS。
 * ⚠ 必须在 game.js 之前加载（index.html 里排在 game.vXXXX.js 之前）——
 *   本块含顶层立即执行（给每张卡注入 effectType），且 game.js 后段构造期会读这些常量；
 *   排到 game.js 之后会 TDZ 白屏。改这里同样走快照三步（build.mjs 已纳管 nmg-data 族）。
 * ===================================================================== */

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
    // V0.9.57 后续修订：卡面必须照实显示当前三档倍率，不再沿用旧版指数叠层说明。
    glyph: "酒", art: "酿", effect: "叠 1 层酒意（最多 3 层）。下一张攻击蛊伤害按层数<em>×2 / ×2.5 / ×3</em>，出手后清空全部层。",
  },
  bloodBlade: {
    name: "血刃蛊", cost: 1, type: "blood", category: "attack", typeName: "血道攻击",
    glyph: "血", art: "煞", effect: "失去 <em>3</em> 点生命，造成 <em>13 + 当前血煞</em> 点伤害，获得 <em>1</em> 层血煞",
  },
  burningEssence: {
    name: "燃元蛊", cost: 0, type: "utility", category: "utility", typeName: "燃命蛊",
    glyph: "燃", art: "元", effect: "获得 <em>2</em> 点真元并抽 <em>1</em> 张牌，失去 <em>2</em> 点生命",
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
    glyph: "聚", art: "炁", effect: "获得 <em>2</em> 点真元",
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
    glyph: "群", art: "噬", effect: "造成 <em>4</em> 点伤害；本回合此前每出 1 张牌，追加 <em>2</em>，最多计 <em>3</em> 张",
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
    glyph: "灯", art: "命", effect: "若出牌前命势已满，恢复 <em>4</em> 点生命；否则获得 <em>1</em> 层命势",
  },
  returnBreath: {
    name: "回息蛊", cost: 1, type: "fate", category: "utility", typeName: "调息辅助蛊",
    glyph: "息", art: "命", effect: "抽 <em>2</em> 张牌，然后随机弃 <em>1</em> 张",
  },
  hiddenMeridian: {
    name: "伏脉蛊", cost: 1, type: "shell", category: "defense", typeName: "蓄势防御蛊",
    glyph: "伏", art: "甲", effect: "获得 <em>5</em> 点防御；下回合开始时再获得 <em>5</em> 点防御",
  },
  thunderGuide: {
    name: "引雷蛊", cost: 1, type: "blade", category: "attack", typeName: "雷道攻击蛊",
    glyph: "雷", art: "刃", effect: "造成 <em>8</em> 点伤害；本回合此前打出过牌时，额外造成 <em>4</em> 点伤害",
  },
  apertureGuard: {
    name: "守窍蛊", cost: 1, type: "shell", category: "defense", typeName: "护窍防御蛊",
    glyph: "窍", art: "甲", effect: "获得 <em>10</em> 点防御",
  },
  emberRemnant: {
    name: "余烬蛊", cost: 1, type: "yuan", category: "utility", typeName: "余烬辅助蛊",
    glyph: "烬", art: "元", effect: "抽 <em>2</em> 张牌，随机弃 <em>1</em> 张；若成功弃牌，获得 <em>5</em> 点防御",
  },
  shadowBind: {
    name: "缚影蛊", cost: 1, type: "blade", category: "attack", typeName: "缚影攻防蛊",
    glyph: "缚", art: "刃", effect: "造成 <em>5</em> 点伤害并获得 <em>5</em> 点防御",
  },
  borrowLife: {
    name: "借命蛊", cost: 0, type: "blood", category: "utility", typeName: "借命辅助蛊",
    glyph: "借", art: "血", effect: "失去 <em>2</em> 点生命，获得 <em>1</em> 点真元并抽 <em>1</em> 张牌；不会令你死亡",
  },

  // V0.9.59：八只通用蛊，补齐攻、防、元、异四组构筑桥梁。
  jadeFang: {
    name: "玉髓牙蛊", cost: 1, type: "blade", category: "attack", typeName: "护势攻击蛊",
    glyph: "玉", art: "牙", effect: "造成 <em>7</em> 点伤害；你有防御时额外造成 <em>5</em> 点",
  },
  hollowNeedle: {
    name: "空窍针蛊", cost: 1, type: "blade", category: "attack", typeName: "先机攻击蛊",
    glyph: "窍", art: "针", effect: "造成 <em>6</em> 点伤害；若是本回合第一张牌，额外造成 <em>7</em> 点",
  },
  coiledShell: {
    name: "盘蜕蛊", cost: 1, type: "shell", category: "defense", typeName: "收势防御蛊",
    glyph: "盘", art: "蜕", effect: "获得 <em>7</em> 点防御；出牌后手牌不多于 3 张时额外获得 <em>5</em> 点",
  },
  mirrorCarapace: {
    name: "镜甲蛊", cost: 1, type: "shell", category: "defense", typeName: "照甲防御蛊",
    glyph: "镜", art: "甲", effect: "获得 <em>8</em> 点防御；敌人有防御时额外获得 <em>4</em> 点",
  },
  breathCicada: {
    name: "吐纳蝉", cost: 0, type: "yuan", category: "utility", typeName: "调息辅助蛊",
    glyph: "纳", art: "蝉", effect: "获得 <em>3</em> 点防御；若是本回合第一张牌，获得 <em>1</em> 点真元，否则抽 <em>1</em> 张牌",
  },
  yuanVessel: {
    name: "承元蛊", cost: 1, type: "yuan", category: "utility", typeName: "承元辅助蛊",
    glyph: "承", art: "元", effect: "获得 <em>1</em> 点真元与 <em>5</em> 点防御",
  },
  rustMite: {
    name: "锈甲螨", cost: 1, type: "poison", category: "utility", typeName: "蚀甲毒蛊",
    glyph: "锈", art: "螨", effect: "移除敌人 <em>6</em> 点防御并施加 <em>2</em> 层毒性；成功蚀甲时再施加 <em>2</em> 层",
  },
  silenceMoth: {
    name: "息声蛾", cost: 1, type: "utility", category: "utility", typeName: "衰势辅助蛊",
    glyph: "息", art: "蛾", effect: "使敌人衰老 <em>1</em>，获得 <em>4</em> 点防御；敌人已有衰老时额外获得 <em>4</em> 点",
  },
  jadeMirrorFang: {
    name: "玉镜獠甲蛊", cost: 2, type: "blade", category: "attack", typeName: "护势照甲异蛊",
    glyph: "獠", art: "镜", effect: "造成 <em>12</em> 点伤害并获得 <em>10</em> 点防御；你有防御时伤害 +<em>6</em>，敌人有防御时护甲 +<em>6</em>",
  },
  coiledNeedleShell: {
    name: "盘窍针蜕蛊", cost: 2, type: "blade", category: "attack", typeName: "先机收势异蛊",
    glyph: "盘", art: "针", effect: "造成 <em>10</em> 点伤害并获得 <em>8</em> 点防御；首张伤害 +<em>8</em>，出牌后手牌不多于 3 张时护甲 +<em>6</em>",
  },
  vesselBreathCicada: {
    name: "承息玉蝉蛊", cost: 1, type: "yuan", category: "utility", typeName: "承元吐纳异蛊",
    glyph: "承", art: "蝉", effect: "获得 <em>1</em> 点真元与 <em>9</em> 点防御；若不是本回合第一张牌，再抽 <em>1</em> 张牌",
  },
  rustSilenceMoth: {
    name: "锈寂螟蛊", cost: 2, type: "poison", category: "utility", typeName: "蚀甲衰势异蛊",
    glyph: "寂", art: "锈", effect: "移除敌人 <em>8</em> 点防御，施加 <em>4</em> 层毒性与 <em>1</em> 层衰老，并获得 <em>8</em> 点防御；蚀甲与旧衰各有追加",
  },
  longBreathGu: {
    name: "长息蛊", cost: 1, type: "yuan", category: "utility", typeName: "换息辅助蛊",
    glyph: "息", art: "蜿", exhaust: true, effect: "抽 <em>2</em> 张牌，再主动弃 <em>2</em> 张；本场消耗",
  },
  chainThunderGu: {
    name: "连霆蛊", cost: 1, type: "blade", category: "attack", typeName: "雷序攻击蛊",
    glyph: "霆", art: "链", effect: "造成 <em>6</em> 点伤害；本回合每次切换出牌类别，再造成 <em>2</em> 点伤害，最多 <em>2</em> 次",
  },
  calamityAshGu: {
    name: "劫灰蛊", cost: 1, type: "utility", category: "utility", typeName: "弃灭辅助蛊",
    glyph: "劫", art: "灰", exhaust: true, effect: "本回合每主动弃牌或消耗另一张牌，积 1 灰；回合末每灰造成 <em>2</em> 点伤害，最多 <em>3</em> 灰；本场消耗",
  },
  redTideGu: {
    name: "赤汐蛊", cost: 1, type: "blood", category: "attack", typeName: "血煞终结蛊",
    glyph: "汐", art: "潮", bloodCost: 2, effect: "至少需要 <em>2</em> 层血煞；吞下至多 <em>3</em> 层，造成 <em>5 + 实际耗煞×4</em> 点伤害；对血食敌人本回合首次额外 <em>+3</em>",
  },
  lifePyreScorpion: {
    name: "燃命蝎", cost: 1, type: "lifespan", category: "attack", typeName: "焚寿爆发蛊",
    glyph: "燃", art: "蝎", lifespanCost: 2, effect: "焚去 <em>2</em> 寿元，造成 <em>8 + 实际焚寿×4</em> 点伤害；对腐生敌人本回合首次额外 <em>+3</em>",
  },
  vicissitudeTurtle: {
    name: "沧桑龟", cost: 1, type: "lifespan", category: "defense", typeName: "衰老承伤蛊",
    glyph: "沧", art: "龟", effect: "使敌人衰老 <em>1</em>（本卡最多叠至 3），获得 <em>7 + 衰老×2</em> 点防御；本回合首次克制甲壳并蚀甲 <em>4</em>",
  },
  ashBreathMayfly: {
    name: "劫息蜉蝣", cost: 2, type: "utility", category: "utility", typeName: "抽弃化灰合练蛊",
    glyph: "蜉", art: "灰", exhaust: true, effect: "布下有限劫灰，抽 <em>2</em> 张并主动弃 <em>2</em> 张；自身化灰计 1；本场消耗",
  },
  returnThunderDragonfly: {
    name: "回霆玄蜓", cost: 2, type: "blade", category: "attack", typeName: "回息雷序合练蛊",
    glyph: "蜓", art: "霆", effect: "造成 <em>6</em> 点伤害并布下有限雷序；抽 <em>2</em> 张、随机弃 <em>1</em> 张",
  },
  redTideBladeLeech: {
    name: "赤汐刃蛭", cost: 2, type: "blood", category: "attack", typeName: "耗煞生煞合练蛊",
    glyph: "蛭", art: "汐", bloodCost: 2, effect: "先吞旧血煞造成终结伤害，再失去 <em>3</em> 点生命并获得 <em>1</em> 层新血煞",
  },
  lifePyreSandScorpion: {
    name: "燎命砂蝎", cost: 2, type: "lifespan", category: "attack", typeName: "累焚爆发合练蛊",
    glyph: "燎", art: "蝎", lifespanCost: 2, effect: "焚去 <em>2</em> 寿元，按实际焚寿与本场累计焚寿造成伤害",
  },
  witheredMulberryTurtle: {
    name: "枯桑驮碑", cost: 2, type: "lifespan", category: "defense", typeName: "岁甲桑田合练蛊",
    glyph: "碑", art: "桑", lifespanCost: 1, effect: "焚去 <em>1</em> 寿元，使非尸傀敌人有限衰老并按衰老层数获得防御",
  },

  // V0.9.9 寿道·子批3：朝暮专属进阶蛊（type:"lifespan" 取霜白暗金配色；焚寿/蚀岁/回光/桑田/续命）。
  burnLife: {
    name: "焚寿蛊", cost: 1, type: "lifespan", category: "attack", typeName: "寿道攻击",
    glyph: "焚", art: "寿", lifespanCost: 2,
    effect: "消耗 <em>2</em> 寿元，造成 <em>6</em> 点伤害；本场每焚去 1 点寿元额外 <em>+2</em>（含本次）",
  },
  erodeAge: {
    name: "蚀岁蛊", cost: 1, type: "lifespan", category: "attack", typeName: "寿道攻击",
    glyph: "蚀", art: "岁",
    effect: "造成 <em>8</em> 点伤害，并夺回 <em>2</em> 点寿元（不超过上限）",
  },
  focalLife: {
    name: "回光蛊", cost: 1, type: "lifespan", category: "utility", typeName: "寿道秘蛊",
    glyph: "回", art: "光", lifespanCost: 3,
    effect: "消耗 <em>3</em> 寿元，本回合攻击蛊伤害<em>翻倍</em>",
  },
  mulberryField: {
    name: "桑田蛊", cost: 1, type: "lifespan", category: "utility", typeName: "寿道秘蛊",
    glyph: "桑", art: "田", lifespanCost: 1,
    effect: "消耗 <em>1</em> 寿元，使敌人<em>衰老 3</em>（攻击意图永久 -3，可叠加）",
  },
  prolongLife: {
    name: "续命蛊", cost: 1, type: "lifespan", category: "utility", typeName: "寿道疗愈",
    glyph: "续", art: "命",
    effect: "恢复 <em>6</em> 点寿元（不超过上限）",
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
    glyph: "嗜", art: "饮", effect: "造成 <em>7 + 当前血煞</em> 点伤害；恢复 <em>4</em> 点生命",
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

  // 龙裔专属：烬鳞以攻击/护甲的首次有效结算养鳞，满鳞后主动龙化。
  scaleHiding: {
    name: "藏鳞蛊", cost: 1, type: "dragon", category: "defense", typeName: "龙裔护甲蛊",
    glyph: "藏", art: "鳞", effect: "获得 <em>8</em> 点防御，并获得 <em>1</em> 枚龙鳞",
  },
  reverseScale: {
    name: "逆鳞蛊", cost: 1, type: "dragon", category: "attack", typeName: "龙裔攻击蛊",
    glyph: "逆", art: "鳞", effect: "失去 <em>2</em> 点生命，造成 <em>9</em> 点伤害，并获得 <em>2</em> 枚龙鳞",
  },
  chiBreath: {
    name: "螭息蛊", cost: 2, type: "dragon", category: "attack", typeName: "龙裔攻击蛊",
    glyph: "螭", art: "息", effect: "造成 <em>14</em> 点伤害；龙化期间额外造成 <em>8</em> 点伤害",
  },
  boneMolt: {
    name: "蜕骨蛊", cost: 1, type: "dragon", category: "utility", typeName: "龙裔秘蛊",
    glyph: "蜕", art: "骨", effect: "消耗 <em>2</em> 枚龙鳞，抽 <em>2</em> 张牌并获得 <em>6</em> 点防御",
  },
  cloudHorn: {
    name: "行云角蛊", cost: 1, type: "dragon", category: "utility", typeName: "龙裔秘蛊",
    glyph: "云", art: "角", effect: "获得 <em>1</em> 枚龙鳞；龙化期间改为延长 <em>1</em> 回合（每次龙化限一次）",
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
    glyph: "醉", art: "酒", effect: "叠 1 层酒意（最多 3 层，伤害 <em>×2 / ×2.5 / ×3</em>）；若本回合已获得命势，抽 <em>1</em> 张牌",
  },
  soulBurn: {
    name: "魂燃蛊", cost: 0, type: "utility", category: "utility", typeName: "辅助蛊",
    glyph: "魂", art: "燃", effect: "获得 <em>2</em> 点真元，失去 <em>3</em> 点生命；本回合下一张蛊牌消耗 -1，最低为 0",
  },
  resonantCarapace: {
    name: "叩响甲蛊", cost: 1, type: "bone", category: "defense", typeName: "骨道护甲蛊",
    glyph: "响", art: "甲", effect: "主动碎去至多 <em>4</em> 点防御，再获得 <em>10</em> 点防御；本回合敌人首次击碎防御时，反击 <em>6</em> 点并抽 <em>1</em> 张牌",
  },
  emberArmorPiercer: {
    name: "烬穿甲蛊", cost: 1, type: "yuan", category: "attack", typeName: "余烬破甲蛊",
    glyph: "烬", art: "穿", effect: "造成 <em>5</em> 点伤害；敌人有防御时额外造成 <em>6</em> 点。抽 <em>2</em> 张并弃 <em>1</em> 张，成功弃牌则获得 <em>5</em> 点防御",
  },
  woundedArmorFang: {
    name: "伤甲牙蛊", cost: 1, type: "shell", category: "attack", typeName: "伤势破甲蛊",
    glyph: "伤", art: "牙", effect: "造成 <em>5</em> 点伤害；敌人有防御时额外造成 <em>6</em> 点。获得 <em>6</em> 点防御，本回合已受伤则再获得 <em>6</em> 点",
  },
  chimingJointBreaker: {
    name: "铃断节蛊", cost: 1, type: "bone", category: "attack", typeName: "骨道攻守蛊",
    glyph: "铃", art: "断", effect: "主动碎去至多 <em>8</em> 点防御，造成 <em>5 + 实际碎甲</em> 点伤害；再获得 <em>6</em> 点防御并使敌人衰老 <em>1</em>",
  },
  thunderBoneCourt: {
    name: "雷骨庭蛊", cost: 1, type: "bone", category: "attack", typeName: "骨雷攻守蛊",
    glyph: "雷", art: "庭", effect: "造成 <em>8</em> 点伤害，本回合此前打出过牌时额外造成 <em>4</em> 点；获得 <em>5 + 骨鸣×2</em> 点防御",
  },
  hiddenThunderMeridian: {
    name: "伏雷脉蛊", cost: 1, type: "blade", category: "attack", typeName: "雷道蓄甲蛊",
    glyph: "伏", art: "雷", effect: "造成 <em>8</em> 点伤害，本回合此前打出过牌时额外造成 <em>4</em> 点；获得 <em>5</em> 点防御，下回合再获得 <em>5</em> 点",
  },
  bloodSwarmBlade: {
    name: "血群刃蛊", cost: 1, type: "blood", category: "attack", typeName: "血道连噬蛊",
    glyph: "群", art: "刃", effect: "失去 <em>3</em> 点生命，造成 <em>9 + 当前血煞 + 此前出牌×2</em> 点伤害，并获得 <em>1</em> 层血煞",
  },
  borrowedBloodRobe: {
    name: "借命血衣蛊", cost: 1, type: "blood", category: "defense", typeName: "血道借命护甲蛊",
    glyph: "借", art: "衣", effect: "失去 <em>2</em> 点生命，获得 <em>10</em> 点防御与 <em>1</em> 层血煞，再获得 <em>1</em> 点真元并抽 <em>1</em> 张牌",
  },
  meridianBloodRobe: {
    name: "移窍血衣蛊", cost: 1, type: "blood", category: "defense", typeName: "血道移窍护甲蛊",
    glyph: "窍", art: "衣", effect: "失去 <em>3</em> 点生命，获得 <em>10</em> 点防御与 <em>1</em> 层血煞，并抽 <em>2</em> 张牌",
  },
  heartLeech: {
    name: "噬心嗜血蛊", cost: 2, type: "blood", category: "attack", typeName: "血道噬心疗愈蛊",
    glyph: "嗜", art: "心", effect: "造成 <em>7 + 当前血煞</em> 点伤害；血煞不少于 2 层时额外造成 <em>8</em> 点；恢复 <em>4</em> 点生命",
  },
  tideReturningBlood: {
    name: "潮返命蛊", cost: 2, type: "blood", category: "attack", typeName: "血道耗煞疗愈蛊",
    glyph: "返", art: "潮", effect: "造成 <em>5 + 血煞×3</em> 点伤害，随后消耗 <em>3</em> 层血煞并恢复 <em>12</em> 点生命",
  },
  lastLightHeart: {
    name: "回光噬心蛊", cost: 2, type: "lifespan", category: "attack", typeName: "寿血爆发蛊",
    glyph: "光", art: "心", lifespanCost: 3, effect: "消耗 <em>3</em> 寿元，本回合攻击蛊伤害翻倍；造成 <em>12</em> 点伤害，血煞不少于 2 层时改为 <em>20</em>",
  },
  venomArmorEcho: {
    name: "返蚀甲蛊", cost: 1, type: "poison", category: "attack", typeName: "毒道蚀甲追毒蛊",
    glyph: "返", art: "蚀", effect: "移除敌人 <em>5</em> 点防御，造成 <em>4</em> 点伤害；敌人毒性不少于 8 层时额外造成 <em>8</em> 点，并施加 <em>3</em> 层毒性",
  },
  miasmaShadowCarapace: {
    name: "瘴影甲蛊", cost: 1, type: "poison", category: "attack", typeName: "毒道攻守蛊",
    glyph: "瘴", art: "甲", effect: "造成 <em>5</em> 点伤害，获得 <em>5</em> 点防御，并施加 <em>4</em> 层毒性",
  },
  pyreBloom: {
    name: "焚荣蛊", cost: 1, type: "lifespan", category: "attack", typeName: "寿道焚命攻愈蛊",
    glyph: "焚", art: "荣", lifespanCost: 2, effect: "消耗 <em>2</em> 寿元，造成 <em>6 + 本场焚寿×2</em> 点伤害，并恢复 <em>10</em> 点生命",
  },
  essenceSoulRend: {
    name: "燃元裂魂蛊", cost: 2, type: "lifespan", category: "attack", typeName: "元寿双蚀攻击蛊",
    glyph: "元", art: "裂", lifespanCost: 1, effect: "失去 <em>2</em> 点生命与 <em>1</em> 点寿元，获得 <em>2</em> 点真元并抽 <em>1</em> 张牌，造成 <em>18</em> 点伤害",
  },
  aeonLeech: {
    name: "蚀续蛊", cost: 1, type: "lifespan", category: "attack", typeName: "寿道夺岁攻击蛊",
    glyph: "蚀", art: "续", effect: "造成 <em>8</em> 点伤害，并恢复 <em>6</em> 点寿元（不超过上限）",
  },
  fatedMoonGuard: {
    name: "定月蛊", cost: 1, type: "fate", category: "attack", typeName: "命势攻守蛊",
    glyph: "定", art: "月", effect: "造成 <em>6</em> 点伤害并获得 <em>9</em> 点防御；本回合上一张牌不是护甲蛊时，额外获得 <em>3</em> 点防御",
  },
  apertureCurrentGuard: {
    name: "元窍守蛊", cost: 1, type: "shell", category: "defense", typeName: "元道护窍蛊",
    glyph: "元", art: "窍", effect: "获得 <em>10</em> 点防御与 <em>1</em> 点真元；本回合下一张辅助蛊抽 <em>1</em> 张牌",
  },
  mysticEssenceCarapace: {
    name: "聚元玄甲蛊", cost: 2, type: "yuan", category: "defense", typeName: "元道护甲蛊",
    glyph: "聚", art: "甲", effect: "获得 <em>2</em> 点真元并抽 <em>1</em> 张牌，再获得 <em>14</em> 点防御",
  },
  dragonMoltBreath: {
    name: "蜕骨螭息蛊", cost: 2, type: "dragon", category: "attack", typeName: "龙裔蜕鳞攻击蛊",
    glyph: "蜕", art: "息", effect: "消耗 <em>2</em> 枚未化形龙鳞，抽 <em>2</em> 张牌并获得 <em>6</em> 点防御，再造成 <em>14</em> 点伤害；龙化期间免龙鳞消耗并额外造成 <em>8</em> 点",
  },
  circulatingScaleMolt: {
    name: "藏蜕鳞蛊", cost: 1, type: "dragon", category: "defense", typeName: "龙裔蜕鳞护甲蛊",
    glyph: "藏", art: "蜕", effect: "消耗 <em>2</em> 枚未化形龙鳞，抽 <em>2</em> 张牌、获得 <em>8</em> 点防御并回生 <em>1</em> 枚龙鳞；龙化期间免龙鳞消耗",
  },
  stormReverseHorn: {
    name: "逆云角蛊", cost: 1, type: "dragon", category: "attack", typeName: "龙裔逆鳞攻击蛊",
    glyph: "逆", art: "角", effect: "失去 <em>2</em> 点生命，造成 <em>9</em> 点伤害并获得 <em>2</em> 枚龙鳞；龙化期间改为延长 <em>1</em> 回合，每次龙化限一次",
  },
  venomMoltCarapace: {
    name: "毒蜕铁甲蛊", cost: 1, type: "poison", category: "defense", typeName: "毒道护甲蛊",
    glyph: "毒", art: "蜕", effect: "获得 <em>10</em> 点防御；若敌人已中毒，抽 <em>1</em> 张牌",
  },
  sacrificialMarshRobe: {
    name: "祭沼血甲蛊", cost: 1, type: "blood", category: "defense", typeName: "血道护甲蛊",
    glyph: "祭", art: "沼", effect: "先消耗至多 <em>2</em> 层已有血煞，获得 <em>5 + 每层×5</em> 点防御；消耗 2 层血煞时抽 <em>1</em> 张牌，随后失去 <em>3</em> 点生命并获得 <em>2</em> 层血煞",
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
  boneBell: {
    name: "骨铃蛊", cost: 1, type: "bone", category: "defense", typeName: "骨道护甲蛊",
    glyph: "铃", art: "骨", effect: "获得 <em>6</em> 点防御，使敌人衰老 <em>1</em>",
  },
  knockArmor: {
    name: "叩甲蛊", cost: 1, type: "bone", category: "defense", typeName: "骨道护甲蛊",
    glyph: "叩", art: "甲", effect: "主动碎去至多 <em>4</em> 点防御，再获得 <em>10</em> 点防御",
  },
  breakJoint: {
    name: "断节蛊", cost: 1, type: "bone", category: "attack", typeName: "骨道攻击蛊",
    glyph: "断", art: "节", effect: "主动碎去至多 <em>8</em> 点防御，造成 <em>5 + 实际碎甲</em> 点伤害",
  },
  afterEcho: {
    name: "余响蛊", cost: 1, type: "bone", category: "utility", typeName: "骨道辅助蛊",
    glyph: "余", art: "响", effect: "本回合敌人首次击碎你的防御时，反击 <em>6</em> 点并抽 <em>1</em> 张牌",
  },
  boneCourt: {
    name: "骨庭蛊", cost: 1, type: "bone", category: "defense", typeName: "骨道护甲蛊",
    glyph: "庭", art: "骨", effect: "获得 <em>5 + 骨鸣×2</em> 点防御；不会因此直接获得骨鸣",
  },
  chaosBee: {
    name: "乱蜂蛊", cost: 1, type: "poison", category: "attack", typeName: "虫群毒道蛊",
    glyph: "蜂", art: "刺", effect: "造成 <em>6</em> 点伤害并施加 <em>3</em> 层毒性；敌人已中毒时再施加 <em>2</em> 层",
  },
  bloodMarshGu: {
    name: "血沼蛊", cost: 1, type: "blood", category: "defense", typeName: "血道护甲蛊",
    glyph: "沼", art: "血", effect: "获得 <em>4</em> 点防御；消耗至多 <em>2</em> 层血煞，每层再获得 <em>5</em> 点防御；消耗 2 层时抽 1 张牌",
  },
};

const CARD_EFFECT_TYPES = Object.freeze({
  moonBlade: "blade",
  fateThread: "blade",
  armorBreaker: "blade",
  mutantBlade: "blade",
  soulCrack: "blade",
  burnLife: "blade",
  erodeAge: "blade",

  bloodBlade: "blood",
  bloodReversal: "blood",
  bloodMoon: "blood",
  leechBlade: "blood",
  bloodThirst: "blood",
  heartEater: "blood",
  bloodTide: "blood",
  chaosBee: "poison",

  greenMiasma: "poison",
  insectSwarm: "poison",
  poisonReturn: "poison",
  reverseScale: "blood",
  chiBreath: "blood",
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
  scaleHiding: "armor",
  boneBell: "armor",
  knockArmor: "armor",
  breakJoint: "blade",
  afterEcho: "fate",
  boneCourt: "armor",
  bloodMarshGu: "armor",
  resonantCarapace: "armor",
  emberArmorPiercer: "yuan",
  woundedArmorFang: "blade",
  chimingJointBreaker: "blade",
  thunderBoneCourt: "blade",
  hiddenThunderMeridian: "blade",
  bloodSwarmBlade: "blood",
  borrowedBloodRobe: "armor",
  meridianBloodRobe: "armor",
  heartLeech: "blood",
  tideReturningBlood: "blood",
  lastLightHeart: "blood",
  venomArmorEcho: "poison",
  miasmaShadowCarapace: "poison",
  pyreBloom: "blade",
  essenceSoulRend: "blade",
  aeonLeech: "blade",
  fatedMoonGuard: "fate",
  apertureCurrentGuard: "armor",
  mysticEssenceCarapace: "armor",
  dragonMoltBreath: "blade",
  circulatingScaleMolt: "armor",
  stormReverseHorn: "blade",
  venomMoltCarapace: "armor",
  sacrificialMarshRobe: "armor",

  wineWorm: "yuan",
  burningEssence: "yuan",
  yuanReturn: "yuan",
  essenceGathering: "yuan",
  soulBurn: "yuan",
  drunkFateWorm: "yuan",

  reversePath: "fate",
  lifeLamp: "fate",
  returnBreath: "fate",
  hiddenMeridian: "shell",
  thunderGuide: "blade",
  apertureGuard: "shell",
  emberRemnant: "yuan",
  shadowBind: "blade",
  borrowLife: "blood",
  jadeFang: "blade",
  hollowNeedle: "blade",
  coiledShell: "armor",
  mirrorCarapace: "armor",
  breathCicada: "yuan",
  yuanVessel: "yuan",
  rustMite: "poison",
  silenceMoth: "utility",
  jadeMirrorFang: "blade",
  coiledNeedleShell: "blade",
  vesselBreathCicada: "yuan",
  rustSilenceMoth: "poison",
  ashBreathMayfly: "utility",
  returnThunderDragonfly: "blade",
  redTideBladeLeech: "blood",
  lifePyreSandScorpion: "blade",
  witheredMulberryTurtle: "armor",
  fateSever: "fate",
  meridianShift: "fate",
  witheredBloom: "fate",
  mutantFate: "fate",

  guFeeding: "utility",
  bloodSacrifice: "utility",
  returnLife: "utility",
  lifeFlame: "utility",
  focalLife: "utility",
  mulberryField: "utility",
  prolongLife: "utility",
  boneMolt: "utility",
  cloudHorn: "utility",
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

const ECOLOGY_CARD_KEYS = Object.freeze([
  "boneBell", "chaosBee", "bloodMarshGu",
]);

const ADVANCED_CARD_KEYS = [
  "heartEater", "bloodTide", "lifeFlame", "witheredBloom",
  "essenceGathering", "mysticCarapace", "returnLife", "swarmBite", "meridianShift",
  ...ECOLOGY_CARD_KEYS,
];

const V08_COMMON_CARD_KEYS = Object.freeze([
  "armorBreaker", "yuanReturn", "shellRemnant", "guFeeding",
  "soulCrack", "armorMeltPoison", "bloodRobe", "lifeLamp",
]);

const S2_COMMON_CARD_KEYS = Object.freeze([
  "armorMeltPoison", "returnBreath", "hiddenMeridian", "thunderGuide",
  "apertureGuard", "emberRemnant", "shadowBind", "borrowLife",
]);

const V0959_COMMON_CARD_KEYS = Object.freeze([
  "jadeFang", "hollowNeedle", "coiledShell", "mirrorCarapace",
  "breathCicada", "yuanVessel", "rustMite", "silenceMoth",
]);

const ECOLOGY_BATCH_TWO_CARD_KEYS = Object.freeze([
  "longBreathGu", "chainThunderGu", "calamityAshGu",
]);
const ECOLOGY_BATCH_THREE_CARD_KEYS = Object.freeze([
  "redTideGu", "lifePyreScorpion", "vicissitudeTurtle",
]);

const BLOOD_MAX = 10;
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
    "wineWorm", "bloodSacrifice", "bloodThirst", "bloodTide",
  ],
  poison: [
    ...Array(2).fill("moonBlade"),
    ...Array(2).fill("ironSkin"),
    "wineWorm", "burningEssence", "greenMiasma", "insectSwarm", "moltingShell", "poisonReturn",
  ],
  longevity: [
    ...Array(2).fill("moonBlade"),
    ...Array(2).fill("ironSkin"),
    "wineWorm", "lifeFlame", "lifeFlame", "witheredBloom", "soulCrack", "burningEssence",
  ],
  dragon: [
    ...Array(2).fill("moonBlade"),
    ...Array(2).fill("ironSkin"),
    "wineWorm", "scaleHiding", "reverseScale", "chiBreath", "boneMolt", "cloudHorn",
  ],
  bone: [
    ...Array(2).fill("moonBlade"),
    ...Array(2).fill("ironSkin"),
    "wineWorm", "boneBell", "knockArmor", "breakJoint", "afterEcho", "boneCourt",
  ],
});

const HERO_EXCLUSIVE_CARD_KEYS = Object.freeze({
  fate: ["fateThread", "reversePath", "fixedFate"],
  blood: ["bloodSacrifice", "bloodThirst", "bloodReversal", "redTideGu"],
  poison: ["greenMiasma", "insectSwarm", "moltingShell", "poisonReturn"],
  longevity: ["lifeFlame", "witheredBloom", "soulCrack", "burnLife", "erodeAge", "focalLife", "mulberryField", "prolongLife", "lifePyreScorpion", "vicissitudeTurtle"], // 寿道进阶与生态蜕形只进朝暮专属奖励池
  dragon: ["scaleHiding", "reverseScale", "chiBreath", "boneMolt", "cloudHorn"],
  bone: ["boneBell", "knockArmor", "breakJoint", "afterEcho", "boneCourt"],
});

const COMMON_REWARD_CARD_KEYS = Object.freeze([
  "moonBlade", "ironSkin", "wineWorm", "bloodBlade", "burningEssence",
  ...V08_COMMON_CARD_KEYS,
  ...S2_COMMON_CARD_KEYS,
  ...V0959_COMMON_CARD_KEYS,
  ...ECOLOGY_BATCH_TWO_CARD_KEYS,
  ...ADVANCED_CARD_KEYS,
].filter((key, index, all) => all.indexOf(key) === index));

const STANDARD_REWARD_CARD_KEYS = Object.freeze([
  "moonBlade", "ironSkin", "wineWorm", "bloodBlade", "burningEssence",
  ...V08_COMMON_CARD_KEYS,
  ...S2_COMMON_CARD_KEYS,
  ...V0959_COMMON_CARD_KEYS,
  ...ECOLOGY_BATCH_TWO_CARD_KEYS,
].filter((key, index, all) => all.indexOf(key) === index));

const STARTER_GU_DEFAULT_KEYS = Object.freeze(["moonBlade", "ironSkin"]);
const exclusiveStarterKeys = new Set(Object.values(HERO_EXCLUSIVE_CARD_KEYS).flat());
const STARTER_GU_CHOICE_KEYS = Object.freeze(
  STANDARD_REWARD_CARD_KEYS.filter((key) => CARD_LIBRARY[key] && !exclusiveStarterKeys.has(key)),
);

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
  boneCrystal: {
    name: "锐骨晶", glyph: "骨", tone: "bone",
    short: "偏向破甲、蚀甲与穿透爆发。",
    description: "适合带破甲、蚀甲效果的攻蛊；锋锐骨屑会顺着甲缝刻入蛊纹。",
  },
  lifeEmber: {
    name: "寿烬", glyph: "烬", tone: "life",
    short: "偏向寿道、疗愈与命数转化。",
    description: "适合寿道蛊与疗愈蛊；余烬以命数温炉，火势绵长而不躁。",
  },
  yuanDew: {
    name: "元髓露", glyph: "元", tone: "yuan",
    short: "偏向零费、真元与快速连发。",
    description: "适合零费蛊和聚元蛊；元髓入炉后流转极快，利于连续催蛊。",
  },
});

const MATERIAL_IDS = Object.freeze(Object.keys(MATERIALS));
const ECOLOGY_MATERIALS = Object.freeze({
  miasmaMossSac: { name: "瘴苔囊", glyph: "瘴", tone: "poison", short: "瘴林活苔结成的育蛊囊。" },
  bloodMarshMarrow: { name: "血沼髓", glyph: "沼", tone: "blood", short: "血沼沉积的温热虫髓。" },
  weatheredBoneSalt: { name: "风化骨盐", glyph: "盐", tone: "bone", short: "骨原风蚀后析出的白盐。" },
  mysticHiveWax: { name: "玄巢蜡", glyph: "蜡", tone: "gold", short: "玄巢工虫封存雷息的巢蜡。" },
});
const ECOLOGY_MATERIAL_IDS = Object.freeze(Object.keys(ECOLOGY_MATERIALS));
const MAX_RUN_MUTATIONS = REFINING_BALANCE.maxRunMutations;

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
  bloodBlade: { rule: "基础伤害每级 +4，保留 3 点生命反噬" },
  burningEssence: { rule: "基础真元提升至 2，每级再 +1；附带抽 1 张牌" },
  heartEater: { rule: "普通与血煞催发伤害每级 +4" },
  bloodReversal: { rule: "基础伤害每级 +4，血煞倍率每级 +1" },
  bloodTide: { rule: "基础伤害每级 +4，血煞倍率每级 +1" },
  lifeFlame: { rule: "基础伤害每级 +4，寿元代价不降低" },
  witheredBloom: { rule: "治疗量每级 +4，寿元代价不降低" },
  mysticCarapace: { rule: "基础防御每级 +4" },
  returnLife: { rule: "治疗量每级 +5，血煞代价不降低" },
  meridianShift: { rule: "每级额外抽 1 张牌，生命代价不降低" },
  armorBreaker: { rule: "基础伤害每级 +4，破甲追加每级 +2" },
  shellRemnant: { rule: "基础防御每级 +4，受伤追加防御每级 +2" },
  guFeeding: { rule: "每级额外抽 1 张牌，弃牌数不变" },
  soulCrack: { rule: "基础伤害每级 +4，寿元代价不降低" },
  burnLife: { rule: "基础伤害每级 +4；焚寿代价与每点加伤不变" },
  erodeAge: { rule: "基础伤害每级 +4；夺回寿元不变" },
  focalLife: { rule: "每级少消耗 1 点寿元（3→2→1）；+2 时额外抽 1 张牌" },
  mulberryField: { rule: "每级衰老 +1，寿元代价不变" },
  prolongLife: { rule: "每级回寿 +2" },
  armorMeltPoison: { rule: "每级伤害 +2、施毒 +1、蚀甲 +2" },
  bloodRobe: { rule: "基础防御每级 +4；+2 时额外获得 1 层血煞" },
  lifeLamp: { rule: "每级治疗 +2；+2 时命势收益 +1" },
  hiddenMeridian: { rule: "当前防御与下回合防御每级各 +2" },
  thunderGuide: { rule: "+1 基础伤害 +3；+2 连携伤害 +2" },
  apertureGuard: { rule: "基础防御每级 +4" },
  emberRemnant: { rule: "+1 防御 +3；+2 抽牌 +1" },
  shadowBind: { rule: "伤害与防御每级各 +2" },
  jadeFang: { rule: "基础伤害每级 +3，有甲追加每级 +2" },
  hollowNeedle: { rule: "基础伤害每级 +3，首张追加每级 +2" },
  coiledShell: { rule: "基础防御每级 +3，少手牌追加每级 +2" },
  mirrorCarapace: { rule: "基础防御每级 +3，照敌甲追加每级 +2" },
  breathCicada: { rule: "防御每级 +2；首张真元与非首张抽牌固定" },
  yuanVessel: { rule: "防御每级 +3；真元固定" },
  rustMite: { rule: "蚀甲每级 +2、毒性每级 +1；成功追加毒固定" },
  silenceMoth: { rule: "基础防御每级 +3、已有衰老追加每级 +2；衰老固定" },
  jadeMirrorFang: { rule: "伤害每级 +4、防御每级 +3；护势与照甲追加每级 +2" },
  coiledNeedleShell: { rule: "伤害与防御每级 +3；先机与收势追加每级 +2" },
  vesselBreathCicada: { rule: "防御每级 +4；真元与非首张抽牌固定" },
  rustSilenceMoth: { rule: "蚀甲每级 +2、毒性每级 +1、防御每级 +3；衰老与条件追加固定" },
  fateThread: { rule: "基础伤害每级 +4，命势额外伤害每级 +2" },
  reversePath: { rule: "防御每级 +3；+2 时额外获得 1 层命势" },
  fixedFate: { rule: "基础防御每级 +4，条件防御每级 +2" },
  bloodSacrifice: { rule: "+1 抽牌 +1；+2 血煞 +1，生命反噬不降低" },
  bloodThirst: { rule: "基础伤害每级 +4，治疗每级 +1；+2 血煞收益翻倍" },
  greenMiasma: { rule: "每级施毒 +2 层" },
  insectSwarm: { rule: "每级伤害 +2、施毒 +1 层" },
  moltingShell: { rule: "每级防御 +4；+2 时中毒抽牌 +1" },
  poisonReturn: { rule: "基础伤害与条件额外伤害每级 +3" },
  scaleHiding: { rule: "基础防御每级 +4，龙鳞获得量不变" },
  reverseScale: { rule: "基础伤害每级 +4，反噬与龙鳞获得量不变" },
  chiBreath: { rule: "基础伤害每级 +4，龙化额外伤害每级 +2" },
  boneMolt: { rule: "每级防御 +3；消耗与抽牌不变" },
  cloudHorn: { rule: "每级额外获得 1 枚龙鳞；延长次数不变" },
  bloodMoon: { rule: "异变血道攻击：+2 时基础伤害 +4，血煞额外伤害保留" },
  moltedArmor: { rule: "异变护甲：+2 时基础防御 +4，未受伤抽牌保留" },
  rotMiasma: { rule: "异变毒道：+2 时施毒 +2，额外蚀毒保留" },
  fateSever: { rule: "异变辅助：+1 时额外获得 1 点真元，寿元代价保留" },
  leechBlade: { rule: "异变血道攻击：+2 时基础伤害 +4，吸血保留" },
  drunkFateWorm: { rule: "异变辅助：+1 时命势触发抽牌改为抽 2 张" },
  soulBurn: { rule: "残魂异变辅助：+1 时真元 +1，生命代价保留" },
  resonantCarapace: { rule: "每转防御与受击碎甲反击伤害各 +3；碎甲与抽牌固定" },
  emberArmorPiercer: { rule: "每转伤害 +3、破甲追加与弃牌成甲各 +2；抽弃数固定" },
  woundedArmorFang: { rule: "每转伤害与基础防御 +3、破甲追加与受伤防御 +2" },
  chimingJointBreaker: { rule: "每转伤害与防御 +3；碎甲固定，三转时衰老 +1" },
  thunderBoneCourt: { rule: "每转伤害与基础防御 +3；三转时连携伤害 +2" },
  hiddenThunderMeridian: { rule: "每转伤害 +3、当前与下回合防御各 +2；三转时连携伤害 +2" },
  bloodSwarmBlade: { rule: "每转基础伤害 +4、此前出牌追加 +1；生命代价、血煞倍率与血煞收益固定" },
  borrowedBloodRobe: { rule: "每转防御 +4；二转起多抽 1 张，三转时血煞收益 +1" },
  meridianBloodRobe: { rule: "每转防御 +4、抽牌 +1；三转时血煞收益 +1" },
  heartLeech: { rule: "每转基础伤害 +4、血煞阈值追加 +2、治疗 +1；三转时血煞倍率 +1" },
  tideReturningBlood: { rule: "每转基础伤害与治疗 +4、血煞倍率 +1；血煞代价固定" },
  lastLightHeart: { rule: "每转寿元代价 -1、普通与催发伤害 +4；三转时额外抽 1 张牌" },
  venomArmorEcho: { rule: "每转伤害与毒性阈值追加 +3、蚀甲 +2、施毒 +1；毒性阈值固定" },
  miasmaShadowCarapace: { rule: "每转伤害与防御 +3、施毒 +1" },
  pyreBloom: { rule: "每转基础伤害与治疗 +4；寿元代价与每点焚寿加伤固定" },
  essenceSoulRend: { rule: "每转伤害 +4、真元 +1；生命与寿元代价、抽牌固定" },
  aeonLeech: { rule: "每转伤害 +4、寿元恢复 +2" },
  fatedMoonGuard: { rule: "每转伤害与基础防御 +3、条件防御 +2" },
  apertureCurrentGuard: { rule: "每转防御 +3；真元与辅助蛊抽牌固定" },
  mysticEssenceCarapace: { rule: "每转真元 +1、防御 +4；抽牌固定" },
  dragonMoltBreath: { rule: "每转伤害与防御 +4、龙化加伤 +2；龙鳞代价与抽牌固定" },
  circulatingScaleMolt: { rule: "每转防御 +4；龙鳞代价、抽牌与回生龙鳞固定" },
  stormReverseHorn: { rule: "每转伤害 +4；生命代价、龙鳞收益与龙化延长固定" },
  venomMoltCarapace: { rule: "每转防御 +4；敌人已中毒时抽牌固定" },
  sacrificialMarshRobe: { rule: "每转基础防御 +3；耗煞上限、逐层防御、满耗抽牌、生命代价与血煞补充固定" },
  mutantBlade: { rule: "通用异变攻击：+2 时基础伤害 +4，生命代价保留" },
  mutantArmor: { rule: "通用异变护甲：+2 时基础防御 +4，弃牌代价保留" },
  mutantPoison: { rule: "通用异变毒道：+2 时施毒 +2，生命代价保留" },
  mutantFate: { rule: "通用异变辅助：+1 时抽牌 +1，寿元代价保留" },
  boneBell: { rule: "基础防御每级 +3；三转时衰老由 1 提升为 2，之后封顶" },
  knockArmor: { rule: "每级获得防御 +3；主动碎甲上限固定为 4" },
  breakJoint: { rule: "每级基础伤害 +3；主动碎甲上限固定为 8" },
  afterEcho: { rule: "每级反击伤害 +3；抽牌数固定为 1" },
  boneCourt: { rule: "每级基础防御 +3；骨鸣倍率固定为每点 +2" },
  chaosBee: { rule: "每级伤害 +2、基础施毒 +1；追毒固定 2 层" },
  bloodMarshGu: { rule: "基础防御每级 +3；每层血煞换甲与抽牌条件不变" },
});

// 立绘路径只在这里维护，全部基于已核验并规范化后的真实文件名。
const PORTRAIT_PATHS = Object.freeze({
  heroes: {
    fate: "assets/portraits/hero-fate-web.jpg",
    blood: "assets/portraits/hero-blood-web.jpg",
    poison: "assets/portraits/hero-poison-web.jpg",
    longevity: [
      // V0.9.9 子批3后修：原 .png 每张 2.2~2.5MB（941×1672）→ 重压成 720×1279 JPEG（~160-200KB），手机加载不再失败/占位
      "assets/portraits/hero-longevity-1-web.jpg",
      "assets/portraits/hero-longevity-2-web.jpg",
      "assets/portraits/hero-longevity-3-web.jpg",
      "assets/portraits/hero-longevity-4-web.jpg",
    ],
    dragon: "assets/portraits/hero-dragon-web.webp",
    dragonTransformed: "assets/portraits/hero-dragon-transformed-web.webp",
    bone: "assets/portraits/hero-wenling.webp",
  },
  enemies: {
    stoneGuFalcon: "assets/portraits/stone-gu-falcon.webp",
    steleGolem: "assets/portraits/stele-stone-golem.webp",
    vineCrone: "assets/portraits/vine-crone-spirit.webp",
    shadowHound: "assets/portraits/shadow-eating-hound.webp",
    miasmaToad: "assets/portraits/miasma-toad-lord.webp",
    splitSkullMonk: "assets/portraits/split-skull-monk.webp",
    bloodEelMother: "assets/portraits/blood-eel-mother.webp",
    sunkenPuppeteer: "assets/portraits/sunken-puppeteer.webp",
    boneBellGuard: "assets/portraits/bone-bell-guard.webp",
    steleLeech: "assets/portraits/stele-boring-leech.webp",
    waxAttendant: "assets/portraits/wax-sealed-attendant.webp",
    honeyWomb: "assets/portraits/honey-brood-womb.webp",
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
    bonebellGu: "assets/portraits/bone-bell-patrol-gu.webp",
    skeletonPuppetGu: "assets/portraits/rotten-armor-gu-soldier.webp",
    boneArmorGuardGu: "assets/portraits/bone-armor-gu-guard.webp",
    boneCommanderElite: "assets/portraits/bone-tower-commander.webp",
    boneNestGuardianBoss: "assets/portraits/bone-nest-tomb-king.webp",
    venomBeeGu: "assets/portraits/venom-bee-gu.webp",
    beehiveBroodGu: "assets/portraits/beehive-brood-gu.webp",
    chaosSwarmHordeGu: "assets/portraits/swarm-surge-gu.webp",
    beehiveGuardElite: "assets/portraits/beehive-gu-guard.webp",
    calamityQueenBoss: "assets/portraits/calamity-bee-queen.webp",
    wanmingMupan: "assets/portraits/wanming-mupan-phase-1.webp",
    wanmingMupanPhase1: "assets/portraits/wanming-mupan-phase-1.webp",
    wanmingMupanPhase2: "assets/portraits/wanming-mupan-phase-2.webp",
    wanmingMupanPhase3: "assets/portraits/wanming-mupan-phase-3.webp",
    wanmingMupanBroken: "assets/portraits/wanming-mupan-broken.webp",
  },
  scenes: {
    towerHeartArena: "assets/scenes/tower-heart-arena.webp",
  },
  // V0.9.9.2 本命遗物立绘（遗物谱用）；原 ~2.5MB PNG 压成 640px JPEG(~65-115KB)，手机加载不失败
  relics: {
    jadeMarrow: "assets/portraits/relic-jade-marrow-web.jpg",
    yuanCicada: "assets/portraits/relic-yuan-cicada-web.jpg",
    boneCarapace: "assets/portraits/relic-molt-bone-web.jpg",
    ridgeScaleUrn: "assets/portraits/relic-ridge-scale-urn-web.jpg",
    siSuiLun: "assets/portraits/relic-age-wheel-web.jpg",
    listeningBoneCase: "assets/relics/listening-bone-case.webp",
    residualBonePin: "assets/relics/residual-bone-pin.webp",
    hollowChimeMolt: "assets/relics/hollow-chime-molt.webp",
    boneSealSlip: "assets/relics/bone-seal-slip.webp",
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
    Object.values(PORTRAIT_PATHS.scenes || {}).forEach((src) => {
      if (!src) return;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  } catch (sceneErr) { /* 场景预加载失败忽略 */ }
  try {
    if (window.AudioManager && typeof window.AudioManager.warmScene === "function") {
      window.AudioManager.warmScene("battle");
      window.AudioManager.warmScene("boss");
    }
  } catch (audioErr) { /* BGM 预热失败忽略 */ }
}

const HEROES = {
  fate: {
    name: "无名逆命者", role: "命势流蛊修", glyph: "命", ...PLAYER_BALANCE.heroes.fate,
    passiveName: "命势流转", passive: "成功打出与上一张不同类型的卡牌时获得 1 层命势；命势满 3 层后真元 +1 并抽 1 张牌。",
    caption: "蛊影随身 · 天命不受",
    quest: "命格断他是死局——他入塔，是要亲手掰断这两个字。", // V0.9.15 所求：入塔动机（选人卡与列传展示）
  },
  blood: {
    name: "绛妄", role: "血道女蛊修", glyph: "血", ...PLAYER_BALANCE.heroes.blood,
    passiveName: "血海饲蛊", passive: "血煞上限 10；血道攻击按牌面引用当前血煞获得额外伤害；每场战斗后按本场打出的血道牌数回血（每张 +1，上限 8）。",
    caption: "以身饲虫 · 以命换力",
    quest: "以血换力，只求换到无人再能从她手里夺走的东西。",
  },
  poison: {
    name: "青蟒", role: "毒道少年蛊师", glyph: "毒", ...PLAYER_BALANCE.heroes.poison,
    passiveName: "万毒归宗", passive: "每回合开始施加 1 层毒性；敌人已中毒时再次被毒道卡施毒，会触发 2 点蚀毒伤害。",
    caption: "千虫藏袖 · 万毒随心",
    quest: "曾被万毒噬身而不死——他要让毒认他为主，而非他认命。",
  },
  longevity: {
    name: "朝暮", role: "寿道焚命蛊修", glyph: "寿", ...PLAYER_BALANCE.heroes.longevity,
    passiveName: "焚寿燃命", passive: "寿元可作寿道蛊牌的燃料焚烧；当前寿元越低，蛊术伤害越高（满寿 +0／过半 +3／残寿 +6／垂暮 +10），立绘随寿元苍老。寿元归零即陨。",
    caption: "朝如青丝 · 暮已成雪",
    quest: "寿数将尽，与其守灯枯坐，不如烧成塔中最亮的一次。",
  },
  dragon: {
    name: "烬鳞", role: "龙裔蛊修", glyph: "龙", ...PLAYER_BALANCE.heroes.dragon,
    passiveName: "逆鳞化龙",
    passive: "每回合首次以攻击蛊实际伤敌、首次以护甲蛊实际获得防御时，各得 1 枚龙鳞。满 7 鳞可主动龙化 2 回合：每回合真元 +1，攻击蛊伤害 +2，护甲蛊防御 +2。",
    caption: "骨藏逆鳞 · 一啸化龙",
    quest: "他入塔不是为证明血脉，而是要夺回决定自己究竟为人还是为龙的权力。",
  },
  bone: {
    name: "闻铃", role: "骨道听命蛊修", glyph: "骨", ...PLAYER_BALANCE.heroes.bone,
    passiveName: "叩骨听命",
    passive: "以卡牌首次获得防御、敌人首次击碎防御或主动碎去至少 4 点防御时获得骨鸣。骨鸣达到 3 点后，每回合可叩铃一次，在镇魂与断命间择一。",
    caption: "骨响为律 · 叩铃断命",
    quest: "她听见每块枯骨都在替亡者叩门，入塔只为找出那声从未停过的铃。",
  },
};

const ENEMY_LIBRARY = {
  /* ===== V0.9.51 正篇扩容（段数 6→9）新增 12 敌：一层 4 / 二层 4 / 三层 4。
   * 强度按所在层与既有同层敌人对齐；机制一律复用现有关键字（毒/吸血/蓄力/易伤/护甲），
   * 不引入新机制以免与三层生态既有规则打架。 ===== */
  stoneGuFalcon: {
    name: "石阶蛊隼", title: "缝目凶禽", maxHp: 44,
    kicker: "翅影掠阶，缝线未松",
    intro: "石阶蛊隼双目被红丝缝死，却仍精准锁住你的咽喉。",
    caption: "缝目盲飞 · 循血而击",
    actions: {
      diveClaw: { name: "俯冲攫爪", icon: "攫", kind: "attack", damage: 9 },
      featherRain: { name: "铜羽乱射", icon: "羽", kind: "attack", damage: 4, hits: 2 },
      circle: { name: "盘旋蓄势", icon: "旋", kind: "charge", bonus: 6, interruptThreshold: 8 },
    },
  },
  steleGolem: {
    name: "蚀碑石傀", title: "碑文之躯", maxHp: 62,
    kicker: "碑片相擦，祭文剥落",
    intro: "蚀碑石傀由残碑拼合而成，缝隙里渗着暗红汁液。",
    caption: "碑成躯壳 · 缓而难破",
    actions: {
      slabCrush: { name: "碑压", icon: "压", kind: "attack", damage: 12 },
      graveGuard: { name: "碑阵合围", icon: "阵", kind: "defend", block: 10 },
      inscribe: { name: "刻文蓄力", icon: "刻", kind: "charge", bonus: 8, interruptThreshold: 10 },
    },
  },
  vineCrone: {
    name: "缚魂藤妪", title: "铃下枯藤", maxHp: 50,
    kicker: "铃声不响，藤根先动",
    intro: "缚魂藤妪盘在石阶上，藤间小铃静得反常。",
    caption: "以铃缚魂 · 静时最凶",
    actions: {
      vineLash: { name: "藤鞭", icon: "鞭", kind: "attack", damage: 8, applyVulnerable: 1 },
      bellSnare: { name: "铃缚", icon: "缚", kind: "attack", damage: 5, playerPoison: 2 },
      rootGuard: { name: "盘根", icon: "根", kind: "defend", block: 8 },
    },
  },
  shadowHound: {
    name: "啖影犬", title: "无首之犬", maxHp: 46,
    kicker: "四足无声，影中有脸",
    intro: "啖影犬颈上翻涌着影，影里浮出被它吞过的面孔。",
    caption: "食影无声 · 咬处即痛",
    actions: {
      silentBite: { name: "无声撕咬", icon: "噬", kind: "attack", damage: 11 },
      shadowSurge: { name: "影涌", icon: "影", kind: "attack", damage: 6, lifesteal: 4 },
      fade: { name: "隐入影中", icon: "隐", kind: "defend", block: 9 },
    },
  },
  miasmaToad: {
    name: "涎瘴蟾君", title: "瘴林巨蟾", maxHp: 78,
    ecologyTags: ["decay"],
    kicker: "腹鼓一声，黄绿雾起",
    intro: "涎瘴蟾君鼓起毒囊，黏涎自颚间垂落。",
    caption: "一鼓成瘴 · 久战者烂",
    actions: {
      miasmaSpew: { name: "喷瘴", icon: "瘴", kind: "attack", damage: 6, playerPoison: 4 },
      tongueLash: { name: "涎舌卷击", icon: "舌", kind: "attack", damage: 13 },
      swell: { name: "鼓腹蓄毒", icon: "鼓", kind: "charge", bonus: 9, interruptThreshold: 11 },
    },
  },
  splitSkullMonk: {
    name: "裂颅瘴僧", title: "颅生瘴华", maxHp: 72,
    ecologyTags: ["decay", "corpse"],
    kicker: "颅顶开花，念珠已朽",
    intro: "裂颅瘴僧低头合十，颅顶裂口里开着一冠瘴花。",
    caption: "以身饲瘴 · 伪作虔诚",
    actions: {
      beadStrike: { name: "朽珠击顶", icon: "珠", kind: "attack", damage: 12 },
      sporeChant: { name: "诵瘴", icon: "诵", kind: "attack", damage: 4, playerPoison: 5 },
      pray: { name: "伪祷凝息", icon: "祷", kind: "defend", block: 12 },
    },
  },
  bloodEelMother: {
    name: "溯血鳗母", title: "血沼腹渊", maxHp: 82,
    ecologyTags: ["bloodFeeder"],
    kicker: "腹中有骨，隔皮可见",
    intro: "溯血鳗母半透的躯体里，浮着未消化的骨与铜器。",
    caption: "吞而不化 · 血中长生",
    actions: {
      threePetalBite: { name: "三瓣噬", icon: "噬", kind: "attack", damage: 14, lifesteal: 6 },
      bloodSurge: { name: "血涌拍击", icon: "涌", kind: "attack", damage: 7, hits: 2 },
      coil: { name: "盘身蓄势", icon: "盘", kind: "charge", bonus: 10, interruptThreshold: 12 },
    },
  },
  sunkenPuppeteer: {
    name: "沉尸傀偶师", title: "线上浮尸", maxHp: 74,
    ecologyTags: ["corpse"],
    kicker: "红线绷紧，浮尸抬手",
    intro: "沉尸傀偶师半没在血水里，数十根红线牵着沼中浮尸。",
    caption: "牵尸为兵 · 己身亦悬",
    actions: {
      corpsePull: { name: "牵尸扑击", icon: "牵", kind: "attack", damage: 6, hits: 2 },
      stringCut: { name: "割线", icon: "割", kind: "attack", damage: 13, applyVulnerable: 2 },
      hoist: { name: "提线自护", icon: "提", kind: "defend", block: 11 },
    },
  },
  boneBellGuard: {
    name: "锁骨钟卫", title: "胸悬铜钟", maxHp: 96,
    kicker: "钟舌一荡，骨塔皆震",
    intro: "锁骨钟卫立于阶前，胸腔那口铜钟里垂着一截脊骨。",
    caption: "钟响骨鸣 · 立而不退",
    actions: {
      bellToll: { name: "撞钟", icon: "钟", kind: "attack", damage: 15 },
      boneGuard: { name: "骨甲合围", icon: "甲", kind: "defend", block: 14 },
      resonate: { name: "钟鸣蓄震", icon: "震", kind: "charge", bonus: 12, interruptThreshold: 14 },
    },
  },
  steleLeech: {
    name: "啃碑骨蛭", title: "环齿钻碑", maxHp: 88,
    kicker: "石屑纷落，螺沟在延",
    intro: "啃碑骨蛭以环环利齿钻穿碑石，身后留下螺旋沟壑。",
    caption: "食石不食肉 · 挡路者碎",
    actions: {
      grindBore: { name: "环齿钻击", icon: "钻", kind: "attack", damage: 9, armorRemove: 8 },
      dustSpray: { name: "骨屑喷面", icon: "屑", kind: "attack", damage: 5, applyVulnerable: 2 },
      burrow: { name: "钻石蓄劲", icon: "潜", kind: "charge", bonus: 11, interruptThreshold: 13 },
    },
  },
  waxAttendant: {
    name: "蜡封蜂侍", title: "琥珀中人", maxHp: 84,
    kicker: "蜡壳皲裂，又自合拢",
    intro: "蜡封蜂侍整个封在蜂蜡里，蜡下隐约还是挣扎的姿态。",
    caption: "封而未死 · 破而复合",
    actions: {
      waxSlam: { name: "蜡壳撞击", icon: "撞", kind: "attack", damage: 13 },
      honeyBind: { name: "蜜缚", icon: "蜜", kind: "attack", damage: 6, applyVulnerable: 2 },
      reseal: { name: "重塑蜡壳", icon: "封", kind: "defend", block: 13 },
    },
  },
  honeyWomb: {
    name: "蜜噬母胎", title: "巢顶悬囊", maxHp: 92,
    kicker: "囊壁搏动，金红滴落",
    intro: "蜜噬母胎悬在巢顶，半透囊壁内蜷着尚未成形的蜂蛊。",
    caption: "以蜜养蛊 · 滴落即毒",
    actions: {
      honeyDrip: { name: "蜜毒滴落", icon: "滴", kind: "attack", damage: 5, playerPoison: 5 },
      broodBurst: { name: "幼蛊迸出", icon: "迸", kind: "attack", damage: 7, hits: 2 },
      gestate: { name: "孕蛊蓄势", icon: "孕", kind: "charge", bonus: 11, interruptThreshold: 12 },
    },
  },

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
      bloodMoonHowl: { name: "血月嚎叫", icon: "嚎", kind: "charge", bonus: 4, armor: 5, armorCap: 12 },
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
    name: "腐叶蛊虫", title: "瘴林杂蛊", maxHp: 58, poisonResist: 0.15,
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
    name: "青瘴寄生", title: "附骨之瘴", maxHp: 60, poisonConvert: { threshold: 8, give: 3, cap: 6, cooldown: 2 },
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
    name: "毒藤尸", title: "藤缠腐尸", maxHp: 64, blockPurge: 3,
    kicker: "毒藤穿尸，腐手拖泥",
    intro: "毒藤尸被瘴藤贯穿提起，半腐的拳头裹着倒刺毒藤砸来。",
    caption: "毒藤尸 · 藤击拖毒",
    actions: {
      vineSlam: { name: "毒藤重击", icon: "藤", kind: "attack", damage: 11, playerPoison: 1 },
      thornLash: { name: "倒刺连抽", icon: "刺", kind: "attack", damage: 4, hits: 2, playerPoison: 1 },
      rootBrace: { name: "扎根聚毒", icon: "根", kind: "charge", bonus: 6, armor: 6 },
    },
    enrage: { threshold: 0.4, attackBonus: 3, name: "藤毒暴走" },
  },
  miasmaLanternEliteGu: {
    name: "瘴林执灯者", title: "瘴林精英", maxHp: 92, isElite: true, poisonConvert: { threshold: 8, give: 4, cap: 8, cooldown: 2 },
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
    name: "百瘴母蛊", title: "瘴林之主", maxHp: 124, isBoss: true, poisonResist: 0.3, poisonSwallow: { threshold: 12, heal: 6 },
    ecologyTags: ["decay"],
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
      crimsonSlash: { name: "赤血斩", icon: "斩", kind: "attack", damage: 8, lowHpExtra: 5, applyVulnerable: 1 },
    },
  },
  bloodMudGolem: {
    name: "血泥傀", title: "沼底血傀", maxHp: 66,
    kicker: "血泥成傀，越打越凝",
    intro: "血泥傀由凝结的血泥堆塑而成，受创的伤口会再吸沼血补回。",
    caption: "血泥傀 · 血泥自补",
    actions: {
      mudPound: { name: "血泥猛砸", icon: "砸", kind: "attack", damage: 11 },
      gather: { name: "凝泥固身", icon: "凝", kind: "charge", bonus: 5, armor: 8, armorCap: 16 },
      bloodMend: { name: "吸沼回血", icon: "愈", kind: "attack", damage: 6, lifesteal: 6 },
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
      sanguineWard: { name: "血衣护体", icon: "衣", kind: "charge", bonus: 5, armor: 6, armorCap: 18, lifesteal: 4 },
      crimsonRain: { name: "血雨连击", icon: "雨", kind: "attack", damage: 5, hits: 2 },
    },
    enrage: { threshold: 0.35, attackBonus: 4, name: "血祭狂涌" },
  },
  bloodRobeMotherBoss: {
    name: "血衣蛊母", title: "血沼之主", maxHp: 128, isBoss: true,
    ecologyTags: ["bloodFeeder"],
    kicker: "血衣覆世，血债同偿",
    intro: "血衣蛊母端坐于血池之上，周身血衣无风自动，越是搏杀她越亢奋。",
    caption: "血衣蛊母 · 血债血偿",
    actions: {
      robeLash: { name: "血衣绞击", icon: "绞", kind: "attack", damage: 10, lifesteal: 5 },
      bloodOffering: { name: "血祭重击", icon: "祭", kind: "attack", damage: 14, selfBleed: 6, lowHpExtra: 6 },
      crimsonGather: { name: "聚血蓄势", icon: "聚", kind: "charge", bonus: 7, lifesteal: 4 },
    },
    /* phase2「血衣覆身」改写见 getCurrentEnemyAction 扩展 */
  },
/* ===== V0.9.8 第三层敌人定义（镜像 ENEMY_LIBRARY 结构：actions{kind,damage/bonus,hits,armor,playerPoison,lowHpExtra} + isElite/isBoss/enrage + 新机制 def 字段/action 标志：disorientBell/interruptThreshold/commanderMark/playerPoisonSting，def{boneArmorBonus/summonGuard/hasSwarmMechanic/swarmDamagePerLayer/hasCounterAttack/counterDamage/counterAttackThreshold}；phase2 由 getCurrentEnemyAction 改写） ===== */
/* ---- 骨塔高陵路线（护甲/蓄力打断/召卫/执令） ---- */
  bonebellGu: {
    name: "骨铃巡蛊", title: "骨塔杂蛊", maxHp: 44,
    def: { boneArmorStart: 6, boneArmorRegen: 3, boneArmorCap: 12 }, // V0.9.8.9 骨塔硬核：杂蛊也覆轻甲
    kicker: "骨铃轻摇，乱人心神",
    intro: "骨铃巡蛊背壳垂着一串森白骨铃，每一次摇动都在你耳中织出杂音。",
    caption: "骨铃巡蛊 · 乱铃扰神",
    actions: {
      bellPeck: { name: "骨喙啄击", icon: "啄", kind: "attack", damage: 7 },
      disorientRing: { name: "乱铃摇魂", icon: "铃", kind: "attack", damage: 4, disorientBell: 1 },
      bellGather: { name: "聚铃蓄势", icon: "聚", kind: "charge", bonus: 5 },
    },
  },
  skeletonPuppetGu: {
    name: "朽甲蛊兵", title: "骨塔列卒", maxHp: 62, poisonResist: 0.3,
    ecologyTags: ["armor", "corpse"],
    def: { boneArmorStart: 10, boneArmorRegen: 5, boneArmorCap: 20 }, // V0.9.8.9 骨塔硬核
    kicker: "朽甲列阵，蓄力重砸",
    intro: "朽甲蛊兵周身覆着朽烂旧甲，由残骨与蛊丝拼缀成形，举起骨锤时关节咔咔作响。",
    caption: "朽甲蛊兵 · 蓄力重击",
    actions: {
      boneClub: { name: "骨锤横扫", icon: "锤", kind: "attack", damage: 9 },
      braceBone: { name: "缩骨蓄甲", icon: "甲", kind: "charge", bonus: 4, armor: 8, armorCap: 28 }, // V0.9.12.1：上限=回甲上限20+一次蓄力余量，防无限滚甲
      heavySlam: { name: "蓄力重砸", icon: "砸", kind: "charge", bonus: 9, interruptThreshold: 13 },
    },
  },
  boneArmorGuardGu: {
    name: "骨甲蛊卫", title: "骨塔甲士", maxHp: 60, poisonResist: 0.25,
    ecologyTags: ["armor"],
    kicker: "骨甲覆身，有甲愈凶",
    intro: "骨甲蛊卫通体覆着层叠骨甲，护甲未破时出手格外沉重。",
    caption: "骨甲蛊卫 · 甲坚击重",
    def: { boneArmorBonus: 6, boneArmorStart: 16, boneArmorRegen: 6, boneArmorCap: 26 }, // V0.9.8.9 骨塔硬核：甲士=厚甲核心，有甲愈凶6
    actions: {
      guardStrike: { name: "甲拳重击", icon: "拳", kind: "attack", damage: 8 },
      plateBrace: { name: "覆甲固身", icon: "覆", kind: "charge", bonus: 4, armor: 12, armorCap: 38 }, // V0.9.12.1：上限=回甲上限26+一次蓄力余量
      armoredSweep: { name: "骨甲横扫", icon: "扫", kind: "attack", damage: 6, hits: 2 },
    },
    enrage: { threshold: 0.4, attackBonus: 3, name: "骨甲暴坚" },
  },
  boneCommanderElite: {
    name: "骨塔执令者", title: "骨塔精英", maxHp: 92, isElite: true,
    def: { boneArmorStart: 14, boneArmorRegen: 6, boneArmorCap: 24 }, // V0.9.8.9 骨塔硬核
    kicker: "执令在手，号令尸群",
    intro: "骨塔执令者举着一截发令骨杖，杖头骨纹一亮，便有重击随令而至。",
    caption: "骨塔执令者 · 执令加身",
    actions: {
      commandStrike: { name: "号令斩击", icon: "斩", kind: "attack", damage: 12 },
      issueCommand: { name: "执令印记", icon: "令", kind: "charge", bonus: 5, commanderMark: true },
      boneVolleyElite: { name: "骨矢连射", icon: "矢", kind: "attack", damage: 6, hits: 2 },
    },
    enrage: { threshold: 0.35, attackBonus: 4, name: "厉令狂涌" },
  },
  boneNestGuardianBoss: {
    name: "骨巢守墓王", title: "骨塔之主", maxHp: 140, isBoss: true, poisonResist: 0.3, poisonSwallow: { threshold: 14, heal: 6 },
    ecologyTags: ["armor", "corpse"],
    kicker: "骨巢镇陵，守墓不退",
    intro: "骨巢守墓王盘踞于万骨堆成的高陵之巅，召卫叠甲、蓄力重击，层层压来。",
    caption: "骨巢守墓王 · 召卫镇陵",
    def: { summonGuard: true, boneArmorStart: 16, boneArmorRegen: 4, boneArmorCap: 28 }, // V0.9.8.9 骨塔硬核：召卫+覆甲双甲源,上限28封顶
    actions: {
      tombCrush: { name: "镇陵重压", icon: "压", kind: "attack", damage: 11 },
      boneVolley: { name: "骨矢齐射", icon: "矢", kind: "attack", damage: 6, hits: 2 },
      sepulchreCharge: { name: "召卫蓄力", icon: "召", kind: "charge", bonus: 9, armor: 10, armorCap: 38, interruptThreshold: 14 }, // V0.9.12.1：上限=回甲上限28+一次蓄力余量
    },
    /* phase2「骨巢开裂」改写见 getCurrentEnemyAction 扩展 */
  },
/* ---- 蜂窟魔巢路线（毒刺/蜂群/抢攻/多段） ---- */
  venomBeeGu: {
    name: "毒蜂蛊", title: "蜂窟杂蛊", maxHp: 42,
    kicker: "毒蜂乱舞，针针带毒",
    intro: "毒蜂蛊振翅悬于半空，腹尾毒针滴着幽绿黏液，专挑空门连刺。",
    caption: "毒蜂蛊 · 毒针连刺",
    actions: {
      venomJab: { name: "毒针连刺", icon: "刺", kind: "attack", damage: 4, hits: 2 },
      poisonSting: { name: "渗毒蜇刺", icon: "蜇", kind: "attack", damage: 5, playerPoisonSting: 2, lowHpExtra: 3 },
      hover: { name: "悬翅蓄势", icon: "悬", kind: "charge", bonus: 5 },
    },
  },
  beehiveBroodGu: {
    name: "蜂巢虫蛊", title: "蜂窟孵母", maxHp: 58,
    kicker: "蜂巢孵潮，越拖越凶",
    intro: "蜂巢虫蛊背负一座蠕动的小蜂巢，每过一刻便孵出新的蜂群扑面而来。",
    caption: "蜂巢虫蛊 · 蜂群孵化",
    def: { hasSwarmMechanic: true, swarmDamagePerLayer: 2 },
    actions: {
      broodBite: { name: "孵巢撕咬", icon: "咬", kind: "attack", damage: 7 },
      swarmRelease: { name: "放蜂袭面", icon: "蜂", kind: "attack", damage: 5, playerPoison: 1 },
      incubate: { name: "孵巢蓄势", icon: "孵", kind: "charge", bonus: 4, armor: 5 },
    },
    enrage: { threshold: 0.4, attackBonus: 3, name: "蜂巢暴孵" },
  },
  chaosSwarmHordeGu: {
    name: "蜂潮蛊涌", title: "蜂窟潮群", maxHp: 56,
    kicker: "蜂潮翻涌，密则反噬",
    intro: "蜂潮蛊涌是无数毒蜂裹成的一团活潮，你出手越密，它越是乱翅抢攻。",
    caption: "蜂潮蛊涌 · 密牌抢攻",
    def: { hasCounterAttack: true, counterDamage: 8, counterAttackThreshold: 4 },
    actions: {
      swarmLash: { name: "乱蜂鞭挞", icon: "潮", kind: "attack", damage: 5, hits: 2 },
      stingSwarm: { name: "群刺扑面", icon: "群", kind: "attack", damage: 7, playerPoison: 1 },
      gatherSwarm: { name: "聚潮蓄势", icon: "聚", kind: "charge", bonus: 5 },
    },
    enrage: { threshold: 0.4, attackBonus: 3, name: "乱蜂狂潮" },
  },
  beehiveGuardElite: {
    name: "蜂窟守卫", title: "蜂窟精英", maxHp: 90, isElite: true,
    kicker: "守卫巡巢，触之即刺",
    intro: "蜂窟守卫披着蜡甲巡弋于巢道，密集的招数会激它蜂刺反噬。",
    caption: "蜂窟守卫 · 蜂刺反噬",
    def: { hasCounterAttack: true, counterDamage: 8, counterAttackThreshold: 4 },
    actions: {
      guardSting: { name: "蜡甲蜇击", icon: "蜇", kind: "attack", damage: 11 },
      waxBarrage: { name: "蜡针连射", icon: "针", kind: "attack", damage: 5, hits: 2, playerPoison: 1 },
      waxBrace: { name: "蜡甲蓄势", icon: "蜡", kind: "charge", bonus: 5, armor: 6 },
    },
    enrage: { threshold: 0.35, attackBonus: 4, name: "蜂刺狂涌" },
  },
  calamityQueenBoss: {
    name: "灾厄蜂后", title: "蜂窟之主", maxHp: 138, isBoss: true,
    kicker: "蜂后临巢，万翅同振",
    intro: "灾厄蜂后伏于魔巢核心，麾下蜂群无穷无尽，毒刺与多段齐落，半血后更掀蜂群暴动。",
    caption: "灾厄蜂后 · 万蜂同振",
    def: { hasSwarmMechanic: true, swarmDamagePerLayer: 2 },
    actions: {
      queenSting: { name: "蜂后毒刺", icon: "刺", kind: "attack", damage: 5, hits: 2, playerPoisonSting: 1 },
      swarmBurst: { name: "蜂群迸射", icon: "迸", kind: "attack", damage: 6, playerPoison: 3 },
      broodCharge: { name: "孕蜂蓄势", icon: "孕", kind: "charge", bonus: 7 },
    },
    /* phase2「蜂群暴动」改写见 getCurrentEnemyAction 扩展 */
  },
  wanmingMupan: {
    name: "万命母盘",
    title: "命途塔心 · 最终照命",
    maxHp: ENEMY_BALANCE.mupan.maxHp,
    isBoss: true,
    isMupan: true,
    poisonResist: ENEMY_BALANCE.mupan.poisonResist,
    kicker: "万命归盘，旧债成签",
    intro: "母盘翻阅你此行付出的每一份代价，并把最深的习惯刻成死签。",
    caption: "万命母盘 · 照债落签",
    actions: Object.freeze(Object.fromEntries(
      Object.values(ENEMY_BALANCE.mupan.actions).flat().map((action) => [action.id, action])
    )),
  },
};

const NORMAL_ENEMY_IDS = ["shanxiao", "bloodwolf", "beeswarm", "rottenShanxiao", "redManeBloodwolf", "wildBeeTide"];

const MAP_NODE_DESCRIPTIONS = Object.freeze({
  battle: "凶影伏阶，胜后取蛊。",
  event: "异兆一闪，利害同来。",
  shop: "残灯开门，蛊石交易。",
  elite: "血煞盘踞，厚利藏险。",
  defy: "舍常规之利，搏命挑绝敌；胜则厚赏，败则命殒。", // V0.9.8.6 逆命节点：高风险高回报
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
  // V0.9.51 #28 通用机缘扩量：全部复用参数化 kind（heal/stones/material/lifespanMaterial/buyRandomCard/leave），零新 handler。
  {
    id: "wanderingGuPeddler",
    name: "游方蛊贩",
    story: "转角的灯影下蹲着个货郎，担子两头挂满小陶罐，罐口全用红线封着。他不抬头，只把一只罐子往你脚边推了推。",
    options: [
      { label: "买下封罐", detail: "花 10 蛊石，获得 1 张随机蛊牌。", kind: "buyRandomCard", cost: 10 },
      { label: "替他挑担", detail: "帮货郎挑一程，获得 6 蛊石。", kind: "stones", amount: 6 },
      { label: "不碰红线", detail: "封着的东西自有它封着的道理，离开。", kind: "leave" },
    ],
  },
  {
    id: "mossShrineSpring",
    name: "苔龛灵泉",
    story: "半截神龛陷在青苔里，龛下渗出一线细泉。泉水极清，清得能照见你骨头缝里的伤。",
    options: [
      { label: "掬泉洗伤", detail: "恢复 10 点生命。", kind: "heal", amount: 10 },
      { label: "以寿引露", detail: "失去 1 点寿元，凝出 1 滴元露。", kind: "lifespanMaterial", materialId: "yuanDew" },
      { label: "拜过便走", detail: "对无名神龛作一揖，离开。", kind: "leave" },
    ],
  },
  {
    id: "boneFishPond",
    name: "骨鱼枯塘",
    story: "干涸的塘底躺着一尾白骨鱼，鳞是骨片拼的，眼窝里各嵌一枚小石。鱼骨间隙还卡着些前人没敢捡的东西。",
    options: [
      { label: "拾取塘石", detail: "获得 8 蛊石。", kind: "stones", amount: 8 },
      { label: "抽取骨晶", detail: "从鱼骨中起出 1 枚骨晶。", kind: "material", materialId: "boneCrystal" },
      { label: "不动死物", detail: "骨鱼保持着游动的姿势——别惊扰它，离开。", kind: "leave" },
    ],
  },
  /* ===== V0.9.57 奇遇扩量（玩家反馈：跑图重复感强）=====
   * 全部复用既有 kind，效果引擎一行未改——新奇遇只是给同一批结算方式换上不同的处境与代价。
   * 写法沿用旧条目的三选一：一个「贪」、一个「稳」、一个「退」，避免出现无脑最优解。 */
  {
    id: "hangingCocoonRow",
    name: "檐下悬茧",
    story: "塔檐底下吊着一排干茧，风一过便互相磕碰，声音像有人在数数。数到第七声时，有一只茧自己裂了。",
    options: [
      { label: "剖开裂茧", detail: "失去 8 点生命，获得 1 张随机稀有蛊牌。", kind: "rareCard" },
      { label: "收拢空壳", detail: "获得 1 个虫蜕。", kind: "material", materialId: "insectMolt" },
      { label: "等它数完", detail: "退到檐外，听那排干茧把数数完。", kind: "leave" },
    ],
  },
  {
    id: "ashInkSlab",
    name: "灰墨残砚",
    story: "砚台里的墨早已干成灰饼，可砚底还压着半张未写完的蛊方。落款处的名字被人用指甲刮花了。",
    options: [
      { label: "补全蛊方", detail: "随机一张攻击蛊本局伤害 +3。", kind: "attackInsight" },
      { label: "刮取墨灰", detail: "获得 1 个残魂。", kind: "material", materialId: "remnantSoul" },
      { label: "合砚而去", detail: "把砚台盖回原样——有些方子不该补全。", kind: "leave" },
    ],
  },
  {
    id: "moltingSnakeCave",
    name: "蜕蛇石罅",
    story: "石缝里塞满层层旧蜕，最里一层还温着。蜕主人显然刚走，走时把什么东西落在了缝底。",
    options: [
      { label: "掏取缝底", detail: "失去 4 点生命，得一次遗物抉择；本局已得过则改得 8 蛊石。", kind: "hurtRelic" },
      { label: "剥取新蜕", detail: "获得 1 个虫蜕。", kind: "material", materialId: "insectMolt" },
      { label: "堵回石缝", detail: "把旧蜕塞回原处，不让它知道有人来过。", kind: "leave" },
    ],
  },
  {
    id: "hollowDrumTower",
    name: "空鼓危楼",
    story: "楼里立着一面无皮的鼓，鼓身缠着蛊丝。你路过时它自己响了一声——空的，却震得人胸口发闷。",
    options: [
      { label: "以掌击鼓", detail: "鼓声震落一张蛊——随机移除牌组中 1 张蛊。", kind: "removeAnyCard" },
      { label: "取丝为用", detail: "获得 1 个命丝。", kind: "material", materialId: "fateSilk" },
      { label: "绕鼓而行", detail: "不去惊动那面自己会响的鼓。", kind: "leave" },
    ],
  },
  {
    id: "saltedGuJar",
    name: "腌蛊陶瓮",
    story: "半人高的陶瓮埋在墙根，封泥完好，里头浸着不知多少年的蛊。掀开一线，气味冲得眼睛发疼。",
    options: [
      { label: "取一勺卤", detail: "获得 1 个腐液。", kind: "material", materialId: "rotLiquid" },
      { label: "整瓮变卖", detail: "获得 14 蛊石。", kind: "stones", amount: 14 },
      { label: "重新封泥", detail: "把封泥按回去，别让它见风。", kind: "leave" },
    ],
  },
  {
    id: "wornPrayerBeads",
    name: "磨秃念珠",
    story: "一串念珠散在阶上，颗颗磨得没了棱角。数下来只有一百零七颗——少的那一颗，多半是被谁咽下去了。",
    options: [
      { label: "串珠护身", detail: "恢复 12 点生命。", kind: "heal", amount: 12 },
      { label: "碾珠取粉", detail: "获得 1 个寿烬。", kind: "material", materialId: "lifeEmber" },
      { label: "替他补齐", detail: "从怀里摸出一枚石子补上缺口，然后离开。", kind: "leave" },
    ],
  },
  {
    id: "twinShadowMirror",
    name: "双影铜镜",
    story: "铜镜锈得只剩巴掌大一块能照人。可你在里头看见了两个自己——一个在动，一个在等你先动。",
    options: [
      { label: "照见破绽", detail: "移除牌组中 1 张基础蛊。", kind: "removeBasic" },
      { label: "刮取镜锈", detail: "获得 1 个残魂。", kind: "material", materialId: "remnantSoul" },
      { label: "背镜而走", detail: "不去分辨哪个先动——转身，别回头。", kind: "leave" },
    ],
  },
  {
    id: "peddlerBrokenCart",
    name: "翻车货郎",
    story: "货担翻在道旁，蛊笼摔破了几只。货郎不在，货还在——地上插着块木牌：「自取者，留钱。」",
    options: [
      { label: "留钱自取", detail: "花费 12 蛊石买入 1 张随机蛊牌。", kind: "buyRandomCard", cost: 12 },
      { label: "只捡散货", detail: "获得 1 个血砂。", kind: "material", materialId: "bloodSand" },
      { label: "扶正货担", detail: "把翻倒的货担扶好，一件不取。", kind: "leave" },
    ],
  },
  {
    id: "emberVentCrack",
    name: "焰隙余温",
    story: "地缝里透出灼气，缝口结着一层琉璃似的硬壳。壳下有东西在慢慢地烧，烧了很久，还没烧完。",
    options: [
      { label: "凿壳取烬", detail: "失去 1 点寿元，取出 1 份寿烬。", kind: "lifespanMaterial", materialId: "lifeEmber" },
      { label: "借温养元", detail: "获得 1 个元髓露。", kind: "material", materialId: "yuanDew" },
      { label: "避开地缝", detail: "绕开这条还在烧的地缝。", kind: "leave" },
    ],
  },
]);

const HERO_CHANCE_EVENTS = Object.freeze({
  fate: Object.freeze([
    {
      id: "fateBrokenThread",
      heroId: "fate",
      name: "断命旧线",
      story: "塔壁垂下一缕灰白命线，线头缠着一枚早该熄灭的名签。签上没有姓名，只写着一个死字。",
      options: [
        { label: "割线入囊", detail: "失去 4 点生命，获得 1 个命丝和 1 张命势蛊。", kind: "heroFateThreadCard" },
        { label: "顺线调息", detail: "恢复 8 点生命。", kind: "heal", amount: 8 },
        { label: "不认旧命", detail: "不碰命线，直接离开。", kind: "leave" },
      ],
    },
    /* V0.9.57 专属机缘扩量：此前每位蛊修只有一条，跑几局就见完了（玩家实报「无尽内容太少」）。
     * 每人补两条，全部复用既有 kind——效果引擎一行未改，扩的是处境与选择。 */
    {
      id: "fateTallyDesk",
      heroId: "fate",
      name: "司命废案",
      story: "半塌的案几上摊着一册废弃命簿，页页都被朱笔划掉。最末一页空着，笔搁在旁边，像在等人续写。",
      options: [
        { label: "续写此页", detail: "随机一张攻击蛊本局伤害 +3。", kind: "attackInsight" },
        { label: "抽走朱丝", detail: "获得 1 个命丝。", kind: "material", materialId: "fateSilk" },
        { label: "合簿而去", detail: "被划掉的命，续了也未必是自己的——离开。", kind: "leave" },
      ],
    },
    {
      id: "fateKnotLattice",
      heroId: "fate",
      name: "结绳窗棂",
      story: "空窗上绷着密密一层结绳，每个结都对应塔里死过的一个人。风过时，绳结自己松了一个。",
      options: [
        { label: "解开松结", detail: "移除牌组中 1 张基础蛊。", kind: "removeBasic" },
        { label: "取绳束腕", detail: "恢复 10 点生命。", kind: "heal", amount: 10 },
        { label: "重新系紧", detail: "把松掉的那个结重新系好，然后离开。", kind: "leave" },
      ],
    },
  ]),
  blood: Object.freeze([
    {
      id: "bloodDebtShrine",
      heroId: "blood",
      name: "血债小祠",
      story: "小祠里供着半截红绳，绳下压着旧契。绛妄一靠近，契上的血字便倒着爬回她掌心。",
      options: [
        { label: "咬回血契", detail: "失去 6 点生命，血煞上限 +1，并获得 1 个血砂。", kind: "heroBloodOathLimit" },
        { label: "挑走灯灰", detail: "获得 1 个血砂和 1 个腐液。", kind: "bloodMaterials" },
        { label: "踢翻小祠", detail: "不再认这笔血债，直接离开。", kind: "leave" },
      ],
    },
    {
      id: "bloodBasinDregs",
      heroId: "blood",
      name: "血盆积垢",
      story: "石盆底积着一层暗红硬垢，指甲一刮就簌簌落粉。绛妄闻得出来——这不是别人的血，是同一条血道上走过的人剩下的。",
      options: [
        { label: "刮垢入袖", detail: "获得 1 个血砂。", kind: "material", materialId: "bloodSand" },
        { label: "以血化垢", detail: "失去 8 点生命，获得 1 张随机稀有蛊牌。", kind: "rareCard" },
        { label: "泼水冲净", detail: "把盆底冲干净，谁也别再刮。", kind: "leave" },
      ],
    },
    {
      id: "bloodRedThreadKnot",
      heroId: "blood",
      name: "断腕红绳",
      story: "断腕系着的红绳还打着活结，绳的另一头没入砖缝，牵得很紧——像那边还有人在拉。",
      options: [
        { label: "顺绳而拽", detail: "失去 4 点生命，得一次遗物抉择；本局已得过则改得 8 蛊石。", kind: "hurtRelic" },
        { label: "割绳止血", detail: "恢复 12 点生命。", kind: "heal", amount: 12 },
        { label: "松手退开", detail: "绳那头拉得越紧，越不该去看。", kind: "leave" },
      ],
    },
  ]),
  poison: Object.freeze([
    {
      id: "poisonSleeveWell",
      heroId: "poison",
      name: "袖底毒井",
      story: "井水无波，却映出青蟒幼时被万毒噬身的影子。井底毒虫没有扑来，只伏低触须，像在等他认主。",
      options: [
        { label: "令毒认主", detail: "获得 1 张毒道卡和 1 个腐液；下一场战斗开局失去 2 点生命。", kind: "heroPoisonClaim" },
        { label: "借井调息", detail: "恢复 6 点生命。", kind: "heal", amount: 6 },
        { label: "封井而走", detail: "不取井毒，直接离开。", kind: "leave" },
      ],
    },
    {
      id: "poisonMothLantern",
      heroId: "poison",
      name: "蚀灯毒蛾",
      story: "残灯罩里困着几只毒蛾，翅粉早把铜罩蚀出细孔。它们不撞灯，只绕着青蟒转——像在认一个比火更值得扑的东西。",
      options: [
        { label: "收蛾入囊", detail: "获得 1 个腐液。", kind: "material", materialId: "rotLiquid" },
        { label: "以粉淬牙", detail: "随机一张攻击蛊本局伤害 +3。", kind: "attackInsight" },
        { label: "熄灯放蛾", detail: "把灯吹了，让它们自己散去。", kind: "leave" },
      ],
    },
    {
      id: "poisonSpiderScale",
      heroId: "poison",
      name: "蛛纹旧秤",
      story: "药秤的秤盘结着蛛网，秤杆刻度被人反复磨改过。改到最后，最重的那一格写的是「命」。",
      options: [
        { label: "照旧刻称量", detail: "花 10 蛊石买入 1 张随机蛊牌。", kind: "buyRandomCard", cost: 10 },
        { label: "刮取秤锈", detail: "获得 1 个锐骨晶。", kind: "material", materialId: "boneCrystal" },
        { label: "折断秤杆", detail: "有些东西不该拿来称，走。", kind: "leave" },
      ],
    },
  ]),
  // V0.9.51 #28：烬鳞此前是唯一没有专属机缘的蛊修，补桶（getChanceEventPool 按 heroId 自动纳入）。
  dragon: Object.freeze([
    {
      id: "dragonEmberOath",
      heroId: "dragon",
      name: "烬鳞旧誓",
      story: "塔砖裂缝里嵌着半片焦黑龙鳞，还带着余温。烬鳞伸手时，鳞片自己贴上他的掌心，像认出了同一炉火里烧出来的骨血。",
      options: [
        { label: "以血续誓", detail: "失去 4 点生命，下一场战斗开局龙鳞 +2。", kind: "heroDragonEmberOath" },
        { label: "拾鳞取火", detail: "从鳞下起出 1 枚命烬。", kind: "material", materialId: "lifeEmber" },
        { label: "不认旧誓", detail: "那炉火早熄了，离开。", kind: "leave" },
      ],
    },
    {
      id: "dragonMoltPit",
      heroId: "dragon",
      name: "蜕鳞灰坑",
      story: "坑底堆着整副蜕下的鳞，层层压得极实。最上面那层还没冷透——蜕的那位刚走不久，走得很急。",
      options: [
        { label: "掘取热鳞", detail: "失去 4 点生命，得一次遗物抉择；本局已得过则改得 8 蛊石。", kind: "hurtRelic" },
        { label: "拾取冷鳞", detail: "获得 1 个锐骨晶。", kind: "material", materialId: "boneCrystal" },
        { label: "填坑而去", detail: "把鳞埋回去——蜕过的东西不该被人翻出来。", kind: "leave" },
      ],
    },
    {
      id: "dragonScorchedBell",
      heroId: "dragon",
      name: "焦壁铜铃",
      story: "烧焦的塔壁上挂着一只熔了半边的铜铃。它不响，可烬鳞走近时，胸口的鳞先替它震了一下。",
      options: [
        { label: "以气鸣铃", detail: "获得 1 个元髓露。", kind: "material", materialId: "yuanDew" },
        { label: "取铜养炉", detail: "获得 12 蛊石。", kind: "stones", amount: 12 },
        { label: "任它哑着", detail: "熔了半边的铃，本就不必再响。", kind: "leave" },
      ],
    },
  ]),
  longevity: Object.freeze([
    {
      id: "longevityBorrowedLamp",
      heroId: "longevity",
      name: "借寿残灯",
      story: "一盏残灯悬在无风处，灯芯像白发一样卷曲。朝暮听见灯里有人问：借一息寿，换一分亮，可敢？",
      options: [
        { label: "借灯炼蛊", detail: "失去 1 点寿元，随机一张可炼化的卡稳定炼化 +1。", kind: "heroLongevityLampRefine" },
        { label: "收灯中魂", detail: "失去 1 点寿元，获得 1 个残魂。", kind: "lifespanMaterial", materialId: "remnantSoul" },
        { label: "吹灯离开", detail: "不借寿火，直接离开。", kind: "leave" },
      ],
    },
    {
      id: "longevityWaterClock",
      heroId: "longevity",
      name: "停摆刻漏",
      story: "铜漏早已停摆，壶里积水结了一层白垢。朝暮看得出来——它不是坏了，是有人把最后一滴按住了，不肯让它落。",
      options: [
        { label: "放它落下", detail: "失去 1 点寿元，取得 1 份寿烬。", kind: "lifespanMaterial", materialId: "lifeEmber" },
        { label: "刮取水垢", detail: "获得 1 个残魂。", kind: "material", materialId: "remnantSoul" },
        { label: "让它停着", detail: "有些时辰，停着比走完慈悲。", kind: "leave" },
      ],
    },
    {
      id: "longevityAshUrn",
      heroId: "longevity",
      name: "无名骨瓮",
      story: "瓮上无名，只刻着一个岁数：十九。瓮口封得极紧，封泥却是新的——每隔些年，就有人回来重封一次。",
      options: [
        { label: "替他续封", detail: "恢复 12 点生命。", kind: "heal", amount: 12 },
        { label: "取一撮烬", detail: "失去 1 点寿元，取得 1 份寿烬。", kind: "lifespanMaterial", materialId: "lifeEmber" },
        { label: "叩瓮而去", detail: "十九岁的人不必再借谁的寿——离开。", kind: "leave" },
      ],
    },
  ]),
});

/* ===================== V0.9.8 第三层主题机缘事件（加性，仅在 runState.layer3.active 时按 theme 分流；离开走默认 leave；随机牌只用真实 CARD_LIBRARY key） ===================== */
const LAYER3_THEME_EVENTS = Object.freeze({
  bone: [
    {
      id: "l3_boneBellShrine",
      name: "断铃石龛",
      story: "残破石龛中悬着一枚锈裂骨铃，铃舌处缠满早已风干的发丝，似有低频嗡鸣自骨缝渗出。",
      options: [
        { label: "敲响骨铃", detail: "获得 14 蛊石，但铃声惊动守陵之物——下一场战斗敌人攻击 +3。", kind: "boneBellChime" },
        { label: "拾取铃下残片", detail: "获得 1 张随机防御蛊。", kind: "boneFragmentDefense" },
        { label: "绕龛而过", detail: "不去招惹死骨，悄然离开。", kind: "leave" },
      ],
    },
    {
      id: "l3_boneStepScroll",
      name: "骨阶残卷",
      story: "骨砌石阶夹缝间塞着半卷人皮残卷，墨迹是干涸的暗褐色，记着一段失传的护身蛊诀。",
      options: [
        { label: "翻阅护身诀", detail: "领悟一式：获得 1 张随机防御蛊，或最大生命 +5（随机其一）。", kind: "boneScrollArmorOrHp" },
        { label: "拓印残卷", detail: "失去 3 点生命拓下蛊纹，恢复 8 点生命作为悟道反哺。", kind: "boneScrollImprint" },
        { label: "合上残卷", detail: "诀不全则反噬，弃之而行。", kind: "leave" },
      ],
    },
  ],
  beehive: [
    {
      id: "l3_waxBroodNest",
      name: "蜂蜡虫巢",
      story: "半融的蜂蜡巢挂在窟壁，蜡层下蠕动着未孵化的毒蛹，一股甜腻腐气令人头皮发麻。",
      options: [
        { label: "取蜡得石", detail: "获得 13 蛊石，但惊动毒蛹——下一场战斗开局失去 3 点生命。", kind: "waxStonesPoison" },
        { label: "以烟熏散", detail: "焚草熏走蜂群，借暖息调养，恢复 10 点生命。", kind: "waxSmokeHeal" },
        { label: "绕开虫巢", detail: "不碰这窝活蜡，绕道离开。", kind: "leave" },
      ],
    },
    {
      id: "l3_honeyRemnantGu",
      name: "噬蜜残蛊",
      story: "一只半死的噬蜜蛊蜷在蜡缝里，毒囊仍在微微鼓动，似在等一个肯收容它的宿主。",
      options: [
        { label: "收入蛊囊", detail: "获得 1 张随机毒道蛊。", kind: "honeyPoisonCard" },
        { label: "焚毁残蛊", detail: "以火逼出蛊石：随机移除 1 张卡，或得 9 蛊石（随机其一）。", kind: "honeyBurnRemoveOrStones" },
        { label: "置之不理", detail: "任它自生自灭，转身离开。", kind: "leave" },
      ],
    },
  ],
});

/* ===== V0.9.51 #28 第二层主题机缘事件：补层2与层3的待遇不对称（此前层2只换皮无专属池）。
 * 与层3「整池替换」不同，层2 采用「混入」——getChanceEventPool 把主题事件并进通用+英雄池，
 * 保持事件多样性的同时带出生态风味。全部复用参数化 kind，零新 handler。 ===== */
const LAYER2_THEME_EVENTS = Object.freeze({
  miasma: [
    {
      id: "l2_miasmaLanternRow",
      name: "瘴林灯阵",
      story: "腐林深处悬着一排绿灯，灯下的路是干净的——瘴气绕着灯走，像怕着灯里的东西。",
      options: [
        { label: "沿灯借道", detail: "借灯避瘴，恢复 8 点生命。", kind: "heal", amount: 8 },
        { label: "摘灯取膏", detail: "刮下灯壁腐膏，获得 1 份腐液。", kind: "material", materialId: "rotLiquid" },
        { label: "绕灯而行", detail: "灯下的干净路未必是给活人走的，离开。", kind: "leave" },
      ],
    },
    {
      id: "l2_miasmaSporeCache",
      name: "孢囊藏珍",
      story: "一丛拳头大的孢囊结在树瘤上，囊壁半透，里头沉着几点亮色——是先行者的遗物被菌丝裹了进去。",
      options: [
        { label: "破囊取石", detail: "破开孢囊，获得 7 蛊石。", kind: "stones", amount: 7 },
        { label: "花钱雇虫", detail: "花 10 蛊石引虫食囊，取出 1 张随机蛊牌。", kind: "buyRandomCard", cost: 10 },
        { label: "不碰菌丝", detail: "被裹进去的未必只有遗物，离开。", kind: "leave" },
      ],
    },
  ],
  bloodmarsh: [
    {
      id: "l2_bloodmarshDryWell",
      name: "血沼涸井",
      story: "沼心立着一口枯井，井绳还在轻轻晃。井底不见水，只有一层暗红结晶，像谁把最后一滴血也熬干了。",
      options: [
        { label: "刮取血晶", detail: "刮下井底血晶，获得 1 份血砂。", kind: "material", materialId: "bloodSand" },
        { label: "投石听声", detail: "投石探井得回响指引，获得 6 蛊石。", kind: "stones", amount: 6 },
        { label: "不近井口", detail: "井绳在晃——刚刚有东西下去了，离开。", kind: "leave" },
      ],
    },
    {
      id: "l2_bloodmarshFloatingCoffin",
      name: "沼上浮棺",
      story: "半口薄棺横在血沼上，棺盖推开一条缝。里头没有尸首，只有一盏还温着的小灯，灯芯用白发搓成。",
      options: [
        { label: "借灯养伤", detail: "借棺中灯火调息，恢复 9 点生命。", kind: "heal", amount: 9 },
        { label: "以寿续灯", detail: "失去 1 点寿元为灯续火，灯下凝出 1 个残魂。", kind: "lifespanMaterial", materialId: "remnantSoul" },
        { label: "合上棺盖", detail: "替那位不在了的主人把棺盖掩好，离开。", kind: "leave" },
      ],
    },
  ],
});

/* ===== V0.9.18 塔中回声：叙事第二批（序章 / 司命人 NPC / 英雄结局 / Boss 对峙） ===== */

// 开场序章：首次进入开始界面自动弹一次，可在设置里重看。文本与《命蛊残卷》正典严格同源
// （卷一「蛊生于代价」原文：石缝里没有神声——V0.9.19 修正此前"黑石开口"与卷一矛盾的自创句）；看完自动解锁卷一。
const PROLOGUE_PAGES = Object.freeze([
  { title: "黑石", text: "传说最初之人跪在黑石前，割血三滴，断发一缕，又吹灭半盏寿灯。石缝里没有神声，只有细小虫鸣——那虫食血，衔发，伏在将熄的灯烟中成形。\n\n自此世人知晓：蛊不从天落，也不替人慈悲。凡欲改命，须先拿命中之物相喂。" },
  { title: "命途塔", text: "后来，代价堆成了一座塔。塔里有人收血、有人收寿、有人收还没说出口的执念。\n\n它从不赐终局，只把登塔者送往更深的黑处，让他们听见下一道锁响。世人叫它命途塔。" },
  { title: "入塔", text: "你也来了，带着一身还没还清的东西，站在塔门前。\n\n记住一句话：命途塔中，从来没有天命之人。" }
]);

// 司命人：塔中收代价的人，天命的代理，第一个会说话的活人。台词随英雄、是否重逢、跨局死亡次数变化。
const SIMING = Object.freeze({
  name: "司命人",
  firstMeet: "一个青袍人负手立于残灯下，看不清脸。「我司此塔命数。你带进来的东西，迟早都要还。」",
  reunion: "青袍人又在前路等你。「这么快又见面。塔很深，你才走了一小段。」",
  afterDeath: (n) => `青袍人抬眼看你，眼神似曾相识。「又是你。你已在此折过 ${n} 回——命途塔记得每一个不肯认命的人。」`,
  heroLine: Object.freeze({
    fate: "「命格判你死。可你偏要来掰断那个字——有意思。」",
    blood: "「你要夺回的东西，我这儿没有。但路还长，谁说得准。」",
    poison: "「万毒噬身而不死……毒认了你半个主，另半个，还在看着。」",
    longevity: "「灯将尽的人，反而烧得最亮。你想好要烧到哪一步了吗？」",
    dragon: "「把龙骨藏进人身，便能装作凡人么？六片逆鳞一醒，塔会先听见你的名字。」"
  }),
  options: Object.freeze([
    { label: "以血奉司命", detail: "失去 6 点生命，获得 12 蛊石与 1 个随机材料。", kind: "simingBlood" },
    { label: "以寿换蛊", detail: "失去 2 点寿元，获得 1 张随机稀有蛊牌。", kind: "simingLife" },
    { label: "不予理会", detail: "「代价不急，来日方长。」——转身离开。", kind: "simingLeave" }
  ])
});

// 四英雄通关结局尾声：呼应各自「所求」，在结算页通关时显示，形成入塔动机→结局的闭环。
const HERO_ENDINGS = Object.freeze({
  fate: "塔顶的风里，那个「死」字终于被你亲手掰断。命格无声，你成了自己命途上第一个不受天命的人。",
  blood: "血债两清。你夺回的从来不是某样东西，而是「再没有人能从你手里夺走」这件事本身。",
  poison: "万毒俯首。从此毒以你为主，你以毒为命——被噬过的人，终于把命运噬了回来。",
  longevity: "最后一盏寿灯燃尽的刹那，你照亮了整座塔。朝如青丝，暮已成雪，而这一烧，值了。",
  dragon: "塔顶龙吟未散。你没有向旧血脉低头，也没有再把真形锁回人身——从此鳞火由你而燃，龙名由你而定。",
  bone: "最后一声骨铃散去，塔替众生写下的死期裂成粉末。闻铃收起叩寿骨铃——从此她只听骨响，不替天数命。"
});

// Boss 战前对峙：进入 Boss 战时给一句压迫感文本（按敌人 id）。
const BOSS_TAUNTS = Object.freeze({
  corpsepuppet: "尸盘监守缓缓转头：「登塔者……又一个来还债的。」",
  miasmaMotherBoss: "百瘴母蛊在雾中低鸣：「瘴林收过太多名字，不差你一个。」",
  bloodRobeMotherBoss: "血衣蛊母抖开血袍：「旧账未清者，血债加倍偿还。」",
  boneNestGuardianBoss: "骨巢守墓王抬起骨杖：「此处只安眠败者。你，也想留下么？」",
  calamityQueenBoss: "灾厄蜂后万翅齐振：「还——把当年那一巢，都还来。」"
});

const RELICS = {
  jadeMarrow: {
    name: "寒玉髓", glyph: "玉", description: "最大生命 +8；每场战斗结束后恢复 6 点生命。",
  },
  yuanCicada: {
    name: "纳元蝉", glyph: "蝉", description: "每回合基础真元由 3 提升至 4。",
  },
  boneCarapace: {
    name: "蜕骨甲", glyph: "骨", description: "每个回合开始时自动获得 4 点防御。",
  },
  // V0.9.9 寿道·子批2c：饲岁轮——寿元上限 +12（起始寿元同涨），以战后焚寿换取下场首回合真元。
  siSuiLun: {
    name: "饲岁轮", glyph: "岁", description: "寿元上限 +12（起始寿元同涨）；每场战斗结束焚去 2 点寿元，下场首回合真元 +2。",
  },
  // V0.9.51 用户定调「龙人似乎没有本命遗物」：补第五枚，龙裔味但非龙裔专属（本命遗物是全角色四选一，此处变五选一）。
  ridgeScaleUrn: {
    name: "蕴鳞瓮", glyph: "蕴", description: "每场战斗开局获得 2 枚龙鳞（非龙裔蛊修改为获得 4 点防御）。",
  },
  listeningBoneCase: {
    name: "听骨匣", glyph: "听", description: "每场战斗开始获得 5 点防御；敌人首次击碎你的防御后，下回合获得 4 点防御并抽 1 张牌。",
  },
};

/* ===== V0.9.16 丹囊：战斗消耗品（囊中活蛊，用一次即失）。 =====
 * 效果全部复用现有结算入口（healPlayer/gainBlood/applyEnemyPoison/gainFateMomentum/gainLifespan 等），
 * 不新开结算相位；直伤类必须带 Boss 转阶段检查（V0.9.12.1 势爆符漏检的教训）。
 * faction 偏发同遗物：掉落池 = 通用 + 当前英雄流派。 */
const BATTLE_ITEMS = Object.freeze({
  huihunDan: { name: "回魂丹蛊", glyph: "丹", faction: "common", description: "恢复 8 点生命。" },
  huxinJia: { name: "护心甲蛊", glyph: "甲", faction: "common", description: "获得 8 点防御。" },
  yinluChong: { name: "引路虫", glyph: "引", faction: "common", description: "抽 2 张牌。" },
  ningyuanSha: { name: "凝元砂", glyph: "元", faction: "common", description: "本回合真元 +1。" },
  ningshaPo: { name: "凝煞珀", glyph: "煞", faction: "blood", description: "血煞 +3。" },
  chixueLu: { name: "炽血露", glyph: "炽", faction: "blood", description: "对敌人直接造成 6 点伤害（无视护甲）。" },
  baoduNang: { name: "爆毒囊", glyph: "爆", faction: "poison", description: "敌人获得 4 层毒性。" },
  qingzhangSan: { name: "清瘴散", glyph: "清", faction: "poison", description: "自身毒性 -4、毒刺 -2。" },
  yinshiLing: { name: "引势铃", glyph: "铃", faction: "fate", description: "命势 +2。" },
  dingpanZhu: { name: "定盘珠", glyph: "珠", faction: "fate", description: "下一张蛊牌费用 -1。" },
  zhuyanLu: { name: "驻颜露", glyph: "驻", faction: "longevity", description: "回复 3 点寿元。" },
  suijinXiang: { name: "岁烬香", glyph: "烬", faction: "longevity", description: "敌人衰老 +2（攻击伤害永久平减）。" },
});
const BATTLE_ITEM_IDS = Object.keys(BATTLE_ITEMS);
const SATCHEL_CAP = PLAYER_BALANCE.satchel.baseCap;
// V0.9.19 十重天·三重薄囊：丹囊上限 3→2。所有容量判断走此函数，勿直用 SATCHEL_CAP。
function getSatchelCap() {
  return (runState?.mode === "tian" && (runState.tianTier || 0) >= 3) ? PLAYER_BALANCE.satchel.tianThinPouchCap : SATCHEL_CAP;
}

// V0.9.9.2 Batch4：每枚带 faction（common 通用 / fate 命势 / blood 血道 / poison 毒道 / longevity 寿道）。
// 专属遗物只对该流派英雄掉落（见 pickRandomAvailableRelicId），common 通用；faction 与 heroId 对齐。
const ORDINARY_RELICS = Object.freeze({
  tailCutCharm: {
    name: "断尾符", glyph: "尾", tone: "jade", faction: "common",
    description: "每场战斗第一次生命低于 30% 时，恢复 8 点生命。",
  },
  bloodJadeCup: {
    name: "血玉盏", glyph: "盏", tone: "blood", faction: "blood",
    description: "每当获得血煞时，恢复 1 点生命；每回合最多触发 2 次。",
  },
  greenPouchBug: {
    name: "青囊虫", glyph: "囊", tone: "poison", faction: "poison",
    description: "每场战斗开始时，随机一张毒道蛊消耗 -1，本场战斗有效。",
  },
  fateCoin: {
    name: "命轨铜钱", glyph: "钱", tone: "gold", faction: "fate",
    description: "命势圆满时，额外获得 1 点防御和 1 蛊石。",
  },
  shopContract: {
    name: "蛊坊残契", glyph: "契", tone: "gold", faction: "common",
    description: "蛊坊中第一次购买打 7 折，向下取整。",
  },
  furnaceAshSeal: {
    name: "炉灰印", glyph: "灰", tone: "soul", faction: "common",
    description: "每局第一次炼蛊反噬时，反噬代价减半。",
  },
  // V0.9.9.2 暴击系统首枚遗物（毒道·暴击流）
  venomFang: {
    name: "淬毒尖牙", glyph: "牙", tone: "poison", faction: "poison",
    description: "攻击中毒的敌人时，34% 概率暴击（该次伤害 ×1.6）。",
  },
  // V0.9.9.2 Batch4 命势流派专属遗物（仅命势蛊修「无名逆命者」可掉落）
  chainFate: {
    name: "连势符", glyph: "连", tone: "gold", faction: "fate",
    description: "连续打出同类型蛊也累积命势（不再要求交替出牌）。",
  },
  fateSurge: {
    name: "势盈引", glyph: "盈", tone: "gold", faction: "fate",
    description: "命势圆满时，额外抽 1 张牌。",
  },
  fateBurst: {
    name: "势爆符", glyph: "爆", tone: "gold", faction: "fate",
    description: "命势圆满时，对敌人直接造成 6 点伤害（无视护甲）。",
  },
  fateRemnant: {
    name: "残势续燃", glyph: "续", tone: "gold", faction: "fate",
    description: "战斗胜利后，保留半数命势带入下场首战。",
  },
  // V0.9.9.2 Batch4 血道流派专属遗物
  bloodAbyss: {
    name: "血溟囊", glyph: "溟", tone: "blood", faction: "blood",
    description: "血煞上限翻倍；但每回合开始自损 2 点生命。",
  },
  bloodPrimer: {
    name: "饲血符", glyph: "饲", tone: "blood", faction: "blood",
    description: "每场战斗开始时，自带 5 层血煞。",
  },
  bloodRepay: {
    name: "血偿契", glyph: "偿", tone: "blood", faction: "blood",
    description: "受到伤害时，按损失生命的一半（向下取整）转为血煞。",
  },
  bloodEcho: {
    name: "噬血回响", glyph: "响", tone: "blood", faction: "blood",
    description: "打出血道攻击蛊时，额外按当前血煞的 30%（向下取整）回复生命。",
  },
  // V0.9.9.2 Batch4 毒道流派专属遗物（另有暴击遗物淬毒尖牙）
  thickVenom: {
    name: "浓毒瓶", glyph: "浓", tone: "poison", faction: "poison",
    description: "每次施加毒性时，额外 +1 层。",
  },
  boneVenom: {
    name: "蚀骨毒", glyph: "蚀", tone: "poison", faction: "poison",
    description: "攻击中毒的敌人时，额外造成其当前毒层数的伤害。",
  },
  venomLead: {
    name: "引毒幡", glyph: "引", tone: "poison", faction: "poison",
    description: "每回合开始时，若敌人已中毒，其毒性 +2。",
  },
  // V0.9.9.2 Batch4 寿道流派专属遗物
  burnDraw: {
    name: "焚牌饲岁", glyph: "焚", tone: "soul", faction: "longevity",
    description: "寿元每低一档，每回合开始额外抽 1 张牌。",
  },
  soulBurnMirror: {
    name: "焚魂镜", glyph: "魂", tone: "soul", faction: "longevity",
    description: "焚寿燃命的伤害加成翻倍。",
  },
  lifeKindle: {
    name: "薪火符", glyph: "薪", tone: "soul", faction: "longevity",
    description: "焚寿时，每焚 1 点寿元额外获得 1 点护甲。",
  },
  // V0.9.9.2 Batch4 通用遗物
  desperatePact: {
    name: "险中契", glyph: "险", tone: "gold", faction: "common",
    description: "生命低于 50% 时，所有蛊术伤害 +25%。",
  },
  loneValor: {
    name: "孤勇符", glyph: "勇", tone: "gold", faction: "common",
    description: "手牌不多于 2 张时，攻击伤害 +30%。",
  },
  stoneInterest: {
    name: "蛊石生息", glyph: "息", tone: "gold", faction: "common",
    description: "每段战斗胜利后，额外获得 3 枚蛊石。",
  },
  // V0.9.51 #27 遗物扩量：补龙裔 0 枚之洞（4）+ 寿道加厚（2）+ 命/血/毒/通用各 1
  ironGallSeal: {
    name: "胆铁印", glyph: "胆", tone: "jade", faction: "common",
    description: "每场战斗开局获得 3 点护甲。",
  },
  fateLoom: {
    name: "织命梭", glyph: "梭", tone: "jade", faction: "fate",
    description: "命势圆满时，下一张蛊牌费用 -1（不叠加）。",
  },
  bloodBrandSeal: {
    name: "烙血玺", glyph: "烙", tone: "blood", faction: "blood",
    description: "血煞攒满时，攻击伤害 +15%。",
  },
  venomHeartPearl: {
    name: "毒心珠", glyph: "珠", tone: "poison", faction: "poison",
    description: "每回合开始时，若敌人毒性不低于 5 层，回复 2 点生命。",
  },
  emberRobe: {
    name: "燃烬衣", glyph: "烬", tone: "soul", faction: "longevity",
    description: "每场战斗首次焚寿时，恢复 1 点真元。",
  },
  duskLamp: {
    name: "暮灯盏", glyph: "暮", tone: "soul", faction: "longevity",
    description: "战斗胜利时，若本场焚过寿元，回复 4 点生命。",
  },
  scaleForge: {
    name: "锻鳞炉", glyph: "锻", tone: "gold", faction: "dragon",
    description: "每场战斗开局获得 1 枚龙鳞。",
  },
  dragonFury: {
    name: "逆鳞怒纹", glyph: "怒", tone: "blood", faction: "dragon",
    description: "龙形期间，攻击伤害 +20%。",
  },
  dragonHide: {
    name: "鳞甲蜕", glyph: "蜕", tone: "jade", faction: "dragon",
    description: "龙形期间，每回合开始获得 3 点护甲。",
  },
  dragonBloodAmber: {
    name: "龙血珀", glyph: "珀", tone: "blood", faction: "dragon",
    description: "化龙显形的瞬间，回复 6 点生命。",
  },
  /* ===== V0.9.57 遗物扩量（玩家实报「遗物太少了」，无尽第 30 层）=====
   * 补的是分布最薄的两头：通用池只有 7 枚（人人都能拿，本该最厚）、龙裔只有 4 枚。
   * 每枚都在 game.js/nmg-relics.js 里真接了触发点——不做只有描述没有效果的空壳。
   * 触发点刻意集中在四处既有稳定位置（开局建场 / 回合开始 / 命势圆满 / 战斗收尾），
   * 不为一枚遗物新开钩子。 */
  whetstoneShard: {
    name: "磨蛊石", glyph: "磨", tone: "bone", faction: "common",
    description: "每场战斗中第一次打出攻击蛊时，该次伤害 +4。",
  },
  hollowGourd: {
    name: "空瓢", glyph: "瓢", tone: "yuan", faction: "common",
    description: "每场战斗的第一回合，真元 +1。",
  },
  mendingThread: {
    name: "缀甲线", glyph: "缀", tone: "jade", faction: "common",
    description: "敌人行动后防御清零时，保留 2 点防御到下一回合。",
  },
  cinderPouch: {
    name: "余烬袋", glyph: "袋", tone: "life", faction: "common",
    description: "每场战斗胜利后，恢复 4 点生命。",
  },
  scaleDustSac: {
    name: "鳞屑囊", glyph: "屑", tone: "jade", faction: "dragon",
    description: "每场战斗的第一回合，龙鳞 +1。",
  },
  dragonPulseCore: {
    name: "龙脉核", glyph: "脉", tone: "gold", faction: "dragon",
    description: "龙形期间，每回合开始真元 +1。",
  },
  ashLantern: {
    name: "烬灯", glyph: "灯", tone: "life", faction: "longevity",
    description: "每场战斗中第一次焚寿时，获得 5 点防御。",
  },
  weaveKnot: {
    name: "织结", glyph: "结", tone: "gold", faction: "fate",
    description: "每场战斗中第一次命势圆满时，额外抽 1 张牌。",
  },
  residualBonePin: {
    name: "残音骨簪", glyph: "簪", tone: "bone", faction: "bone",
    description: "每回合首次主动碎去至少 4 点防御时，对敌人直接造成 3 点伤害。",
  },
  hollowChimeMolt: {
    name: "空腔铃蜕", glyph: "蜕", tone: "bone", faction: "bone",
    description: "每场战斗首次令骨鸣达到 6 点时，抽 2 张牌。",
  },
  boneSealSlip: {
    name: "镇骨缄", glyph: "缄", tone: "bone", faction: "bone",
    description: "每场战斗首次发动镇魂时，额外保留 1 点骨鸣；与本命路线合计最多保留 2 点。",
  },
});

const ORDINARY_RELIC_IDS = Object.freeze(Object.keys(ORDINARY_RELICS));

const REFINEMENTS = {
  yuanShell: { name: "养元蜕壳", glyph: "养", description: "立即恢复 18 点生命，但不超过最大生命。", effect: "heal" },
  bloodFragment: { name: "血纹残片", glyph: "血", description: "所有血道攻击蛊伤害 +3。", effect: "bloodDamage" },
  armorShell: { name: "玄甲蛊壳", glyph: "甲", description: "每场战斗开始时获得 5 点防御。", effect: "startArmor" },
};
