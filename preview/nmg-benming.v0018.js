"use strict";
/* nmg-benming.js：本命蛊数据、道行、形态、路线与立绘辅助。须在 game.v 之前加载。 */
/* ===== V0.9.20 本命蛊：跨局养成——每位蛊修一只本命蛊，局末结道行、跨局进形态，被动常驻。 =====
 * 道行只增不减（nmg.benming JSON {heroId: 道行}），形态由阈值推导不落盘（坏档零风险）。
 * 被动强度封顶：真形全档叠加约等于两件普通遗物；十重天不豁免不加成。 */
const BENMING_KEY = "nmg.benming";
/* V0.9.51 阶名用「转」（用户定调）。先改过一版「品」阶，但蛊庐孵出的蛊本就按凡/灵/玄/天品分级，
 * 同一个词两套含义、玩家会混（"绝品是人物绝品？"），故本命蛊改用与蛊品完全分家的「转」。
 * 蛊卵为未破壳状态，不计转。历代旧名对照：幼虫/凡品→一转、成虫/灵品→二转、
 * 真形/玄品→三转、神化/天品→四转、归墟/绝品→五转。 */
const BENMING_STAGES = Object.freeze([
  { stage: 0, name: "蛊卵", threshold: 0 },
  { stage: 1, name: "一转", threshold: 60 },
  { stage: 2, name: "二转", threshold: 180 },
  { stage: 3, name: "三转", threshold: 420 },
  { stage: 4, name: "四转", threshold: 800 },  // V0.9.33 玄品之上再开两阶，给满级玩家新追求
  { stage: 5, name: "五转", threshold: 1500 },
  /* V0.9.51 长尾（用户反馈"很多玩家已满级"）：五转以上再开四转，对齐《蛊真人》九转位阶。
   * 铁律——六转起【不给任何战力】，只开元进度（携带数/圃位/孵化提速）。
   * 本命蛊被动强度本就封顶在"约两件遗物"，再往上堆会让老玩家碾压新人、并逼迫全局重平衡；
   * 而元进度既是长期目标，又不改变战斗强度曲线。 */
  { stage: 6, name: "六转", threshold: 2600 },
  { stage: 7, name: "七转", threshold: 4200 },
  { stage: 8, name: "八转", threshold: 6500 },
  { stage: 9, name: "九转", threshold: 10000 },
]);
/* 六转起的元进度解锁表（全部与战斗数值无关）。 */
const BENMING_META_UNLOCKS = Object.freeze({
  5: "入塔可携带 3 只随行蛊",
  6: "蛊庐再辟一圃（第 6 圃）",
  7: "入塔可携带 4 只随行蛊",
  8: "蛊卵孵化时间缩短 20%",
  9: "入塔可携带 5 只随行蛊 · 得「九转」称号",
});
/* 按最高转数算入塔携带上限（跨蛊修取最高：养满一只就惠及全角色，避免逼玩家每个角色重刷）。 */
function getBenmingCarryMax() {
  let best = 0;
  try {
    const store = getBenmingStore();
    Object.keys(store || {}).forEach((h) => { best = Math.max(best, getBenmingStage(h)); });
  } catch (e) { best = 0; }
  if (best >= 9) return 5;
  if (best >= 7) return 4;
  if (best >= 5) return 3;
  return 2;
}
/* 八转：孵化提速 20%（元进度，不碰战斗）。 */
function getBenmingHatchSpeedup() {
  let best = 0;
  try {
    const store = getBenmingStore();
    Object.keys(store || {}).forEach((h) => { best = Math.max(best, getBenmingStage(h)); });
  } catch (e) { best = 0; }
  return best >= 8 ? 0.8 : 1;
}
const BENMING_GU = Object.freeze({
  fate: {
    name: "衔命虫", glyph: "衔",
    lore: "衔着他被判死的那根命线，至今不肯松口。",
    stagePassives: ["尚在卵中沉睡。", "开局命势 +1。", "每场首次命势圆满时，额外抽 1 张牌。", "每局开局从「三相织命 / 噬签改命」中选择一条互斥路线。", "开局命势再 +1（累计 +2）。", "所选路线获得五转强化；入塔可携带 3 只随行蛊。", "元进度：蛊庐再辟一圃。", "元进度：入塔可携带 4 只随行蛊。", "元进度：蛊卵孵化时间缩短 20%。", "元进度：入塔可携带 5 只随行蛊，并得「九转」称号。"],
  },
  blood: {
    name: "赤茧蛊", glyph: "茧",
    lore: "血债结成的茧，茧里裹着没讨回来的旧仇。",
    stagePassives: ["尚在卵中沉睡。", "每场战斗开局自带 2 层血煞。", "血煞上限 +2。", "每局开局从「缝煞成茧 / 裂茧代偿」中选择一条互斥路线。", "血煞上限再 +2（累计 +4）。", "所选路线获得五转强化；入塔可携带 3 只随行蛊。", "元进度：蛊庐再辟一圃。", "元进度：入塔可携带 4 只随行蛊。", "元进度：蛊卵孵化时间缩短 20%。", "元进度：入塔可携带 5 只随行蛊，并得「九转」称号。"],
  },
  poison: {
    name: "蜕鳞蛊", glyph: "鳞",
    lore: "万毒噬身那夜蜕下的第一片鳞，还带着牙印。",
    stagePassives: ["尚在卵中沉睡。", "每场首次施毒额外 +1 层。", "攻击中毒的敌人时，伤害 +2。", "每局开局从「逆鳞后毒 / 蜕鳞借毒」中选择一条互斥路线。", "攻击中毒敌人的额外伤害再 +2（累计 +4）。", "所选路线获得五转强化；入塔可携带 3 只随行蛊。", "元进度：蛊庐再辟一圃。", "元进度：入塔可携带 4 只随行蛊。", "元进度：蛊卵孵化时间缩短 20%。", "元进度：入塔可携带 5 只随行蛊，并得「九转」称号。"],
  },
  longevity: {
    name: "灯芯蛊", glyph: "芯",
    lore: "半盏寿灯里没烧完的芯，一头连着朝，一头连着暮。",
    stagePassives: ["尚在卵中沉睡。", "寿元上限 +2。", "每局首次焚寿时，返还 1 点寿元。", "每局开局从「积薪成炬 / 朝暮回灯」中选择一条互斥路线。", "寿元上限再 +2（累计 +4）。", "所选路线获得五转强化；入塔可携带 3 只随行蛊。", "元进度：蛊庐再辟一圃。", "元进度：入塔可携带 4 只随行蛊。", "元进度：蛊卵孵化时间缩短 20%。", "元进度：入塔可携带 5 只随行蛊，并得「九转」称号。"],
  },
  dragon: {
    name: "烬脉龙蛊", glyph: "脉",
    lore: "末代墨裔从焦骨里剜出的活脉，七鳞合鸣时，仍记得真龙如何昂首。",
    stagePassives: ["尚在卵中沉睡。", "每场战斗开局获得 1 枚龙鳞。", "每场首次蓄满龙鳞时，获得 4 点防御。", "每局开局从「焚脉腾渊 / 玄甲镇脉」中选择一条互斥路线。", "开局龙鳞再 +1（累计 2 枚）。", "所选路线获得五转强化；入塔可携带 3 只随行蛊。", "元进度：蛊庐再辟一圃。", "元进度：入塔可携带 4 只随行蛊。", "元进度：蛊卵孵化时间缩短 20%。", "元进度：入塔可携带 5 只随行蛊，并得「九转」称号。"],
  },
  bone: {
    name: "叩寿骨铃", glyph: "叩",
    lore: "铃腔里没有铃舌，只有一只会替亡骨应声的活蛊。",
    stagePassives: ["尚在卵中沉睡。", "每场战斗开始时获得 1 点骨鸣。", "每场首次达到 3 点骨鸣时，获得 3 点防御。", "每局开局从「镇魂律 / 断命律」中选择一条互斥路线。", "开局骨鸣再 +1（累计 2 点）。", "所选路线获得五转强化；入塔可携带 3 只随行蛊。", "元进度：蛊庐再辟一圃。", "元进度：入塔可携带 4 只随行蛊。", "元进度：蛊卵孵化时间缩短 20%。", "元进度：入塔可携带 5 只随行蛊，并得「九转」称号。"],
  },
});
const BENMING_PATHS = Object.freeze({
  fate: Object.freeze({
    threeWeave: Object.freeze({
      id: "threeWeave",
      name: "三相织命",
      glyph: "织",
      kind: "凑齐三类牌",
      summary: "攻击、护甲、辅助三类牌各打出一张，第三类额外获得命势与 3 点防御；重复类型会重新起算。",
      guide: Object.freeze({
        play: "攻击、护甲、辅助三类各打出一张，顺序不限；第三类额外获得命势。",
        caution: "三类凑齐前打出重复类型，会重新起算。",
        benefit: "每回合首次凑齐三类牌获得 3 点防御；命势圆满后，多出的1点命势可以保留。",
        fit: "喜欢轮换牌类、频繁触发命势圆满的玩家。",
      }),
      lore: "衔命虫把杀意、护壳、蛊术三股蛊息绞成活结。少一股，命结不成；重复一股，命线打结，只能重新织起。",
      trueForm: "攻击、护甲、辅助三类各打出一张（顺序不限），第三类额外获得命势；每回合首次凑齐获得 3 点防御，凑齐前重复类型会重新起算。",
      guixu: "每回合第一次打出重复类型时，这次不会重新起算；该牌仍按原规则获得命势。",
    }),
    devourOmen: Object.freeze({
      id: "devourOmen",
      name: "噬签改命",
      glyph: "签",
      kind: "改换敌人技能",
      summary: "每回合第一次命势圆满时，可改换敌人准备使用的技能；完成取舍后获得 3 点防御，新技能不一定更弱。",
      guide: Object.freeze({
        play: "每回合第一次命势圆满时，可以改换敌人当前准备使用的技能；完成取舍后获得 3 点防御。",
        caution: "新技能不一定更弱；也可以暂时不改，但满命势期间不能继续获得命势。",
        guixu: "可以先看一个新意图，再决定更换还是保留。",
        fit: "熟悉敌人技能、喜欢临场应变的玩家。",
      }),
      lore: "衔命虫把圆满命势压在齿间，等敌势显形后咬碎命签（敌人当前准备使用的技能）。改来的未必更好，但结果不再由天先写死。",
      trueForm: "每回合第一次命势圆满时，可改换敌人当前准备使用的技能；完成取舍后获得 3 点防御，满命势期间不能继续获得命势。",
      guixu: "可以先看敌人一个新技能，再决定更换还是保留原技能；决定后结算命势圆满。",
    }),
  }),
  blood: Object.freeze({
    bloodStitch: Object.freeze({
      id: "bloodStitch",
      name: "缝煞成茧",
      glyph: "缝",
      kind: "先铺垫，再收束自损",
      summary: "先打出一张非血道牌完成铺垫，再打出的第一张血道牌会少失去 1 点生命，并额外获得 1 层血煞。",
      guide: Object.freeze({
        play: "每回合先打出一张非血道牌，再用血道牌收束。",
        caution: "三转时若先打血道牌，本回合会错过缝煞；没有自损的血道牌也会用掉铺垫，但不会获得减伤和额外血煞。",
        benefit: "有自损的血道牌少失去 1 点生命，并在该牌原本获得血煞时额外获得 1 层。",
        guixu: "五转后，提前打血道牌不会错过本回合机会，之后仍可先铺垫再触发。",
        fit: "适合愿意安排出牌顺序、用非血道牌为爆发做铺垫的玩家。",
      }),
      lore: "赤茧蛊以异息作针，把将落未落的血债缝回茧壳。",
      trueForm: "每回合先打出一张非血道牌完成铺垫；之后第一张血道牌若会令你失去生命，则少失去 1 点生命，并额外获得 1 层血煞。提前打出血道牌会错过本回合机会。",
      guixu: "提前打出血道牌不再令本回合错过缝煞；之后仍可用非血道牌铺垫，并触发一次缝煞。",
    }),
    bloodAtonement: Object.freeze({
      id: "bloodAtonement",
      name: "裂茧代偿",
      glyph: "偿",
      kind: "主动支付血煞，抵消自损",
      summary: "打出会自损的血道攻击牌时，可主动消耗 3 层血煞，少失去 3 点生命；该次攻击仍按支付前的血煞计算。",
      guide: Object.freeze({
        play: "打出会自损的血道攻击牌时，在确认页主动选择代偿。",
        caution: "每次消耗 3 层血煞；不适用于非攻击牌、没有自损的攻击牌或遗物造成的自损。",
        benefit: "本次自损减少 3 点，且本次攻击仍按支付前的血煞计算。",
        guixu: "五转后每回合最多可代偿两次；同一张牌仍只能代偿一次。",
        fit: "适合保留血煞作为生存筹码、在关键攻击前主动权衡的玩家。",
      }),
      lore: "赤茧蛊撕开旧茧，以三缕血煞替宿主承下一笔现世血债。",
      trueForm: "每回合一次：打出会自损的血道攻击牌时，可主动消耗 3 层血煞，使该牌少令你失去 3 点生命；本次攻击按支付前的血煞计算。",
      guixu: "每回合最多可代偿两次；同一张牌最多一次。",
    }),
  }),
  poison: Object.freeze({
    poisonAfterstrike: Object.freeze({
      id: "poisonAfterstrike",
      name: "逆鳞后毒",
      glyph: "逆",
      kind: "先攻后毒，追加毒层",
      summary: "每回合先完整打出一张攻击牌，之后第一张主动施毒的牌在毒抗结算后额外增加 2 层毒。",
      guide: Object.freeze({
        play: "每回合先完整打出一张攻击牌，再用之后的一张牌给敌人施毒；这次施毒在毒抗结算后额外增加 2 层。",
        caution: "三转时，先打施毒牌会错过本回合机会；同时攻击并施毒的牌不能自己为自己铺垫。",
        guixu: "先施毒不再永久错过；之后仍可完成一次「攻击牌 → 施毒牌」。",
        fit: "喜欢安排出牌顺序、持续堆毒并兼顾攻击节奏的玩家。",
      }),
      lore: "蜕鳞蛊先以逆鳞划开命路，再把毒送入伤口。过早吐出的毒雾只会散在旧鳞之外，不能钻入新伤。",
      trueForm: "每回合先完整打出一张攻击牌；之后第一张主动施毒的牌在毒抗结算后额外增加 2 层毒。先打施毒牌会错过本回合机会，同时攻击并施毒的牌不能为自己铺垫。",
      guixu: "先打施毒牌不再永久错过；之后完整打出一张攻击牌，再由更晚的一张牌施毒，仍可触发一次。",
    }),
    poisonBorrowedScale: Object.freeze({
      id: "poisonBorrowedScale",
      name: "蜕鳞借毒",
      glyph: "借",
      kind: "主动剥毒，换取护甲",
      summary: "敌人准备攻击时，每回合一次：移除敌人 4 层毒，立即获得 6 点护甲。",
      guide: Object.freeze({
        play: "敌人准备攻击时，每回合一次，可移除敌人 4 层毒，立即获得 6 点护甲。",
        caution: "毒层不足或敌人本回合不攻击时不能使用；移除的毒会降低回合末毒伤。",
        guixu: "若这次敌方攻击最终没有伤到生命，攻击结束后返还 2 层毒。",
        fit: "愿意牺牲持续伤害、根据敌人意图换取即时生存的玩家。",
      }),
      lore: "蜕鳞蛊能把附在敌人身上的毒鳞暂时剥回主人身前。借来的鳞只能挡住眼前一击；剥得越多，留给敌人的毒便越浅。",
      trueForm: "敌人准备攻击时，每回合一次：主动移除敌人 4 层毒，立即获得 6 点护甲。",
      guixu: "若这次敌方攻击最终没有伤到生命，攻击结束后返还 2 层先前剥走的毒。",
    }),
  }),
  /* V0.9.51 #29 朝暮双路线：五修中最后一个补齐。
   * 两条路都围绕"焚寿"这唯一的核心买卖分岔——一条把烧掉的寿换成越滚越高的伤害，
   * 一条把烧掉的寿当场换回血肉；前者赌后期，后者稳当下。 */
  longevity: Object.freeze({
    kindlingPyre: Object.freeze({
      id: "kindlingPyre",
      name: "积薪成炬",
      glyph: "炬",
      kind: "焚寿累积爆发",
      summary: "本场每累计焚 3 点寿元，攻击伤害 +2（本场有效，至多 +8）。",
      guide: Object.freeze({
        play: "本场战斗里持续焚寿，每累计 3 点就把攻击伤害抬高 2 点。",
        caution: "只在本场内累计，战斗结束清零；寿元也是命，烧过头会寿尽而陨。",
        benefit: "越到后段伤害越高，适合把一场硬仗打成滚雪球。",
        guixu: "五转后加成上限由 +8 提高到 +12。",
        fit: "愿意前期忍耐、把寿元押在一场决战里的玩家。",
      }),
      lore: "灯芯蛊把焚去的寿一节节堆作薪柴。柴堆得越高，火头越旺——只是柴烧完了，人也就到头了。",
      trueForm: "本场战斗每累计焚 3 点寿元，攻击伤害 +2，至多 +8；战斗结束清零。",
      guixu: "本场累计加成上限由 +8 提高到 +12。",
    }),
    duskRelight: Object.freeze({
      id: "duskRelight",
      name: "朝暮回灯",
      glyph: "灯",
      kind: "焚寿转化续航",
      summary: "每回合首次焚寿时，按焚去的寿元等量恢复生命。",
      guide: Object.freeze({
        play: "每回合第一次焚寿会把烧掉的寿元等量换成生命。",
        caution: "每回合只换一次；同一回合再焚寿不再回血。",
        benefit: "把寿元当作可再生的血量，长线消耗战更稳。",
        guixu: "五转后按 1.5 倍恢复（向下取整）。",
        fit: "偏好稳扎稳打、用寿元换生存空间的玩家。",
      }),
      lore: "朝烧一寸，暮还一分。灯芯蛊把烧去的年岁化回血肉——寿终会尽，但不必尽在今日。",
      trueForm: "每回合首次焚寿时，按焚去的寿元等量恢复生命。",
      guixu: "改为按焚去寿元的 1.5 倍恢复生命（向下取整）。",
    }),
  }),
  dragon: Object.freeze({
    emberAscension: Object.freeze({
      id: "emberAscension",
      name: "焚脉腾渊",
      glyph: "焚",
      kind: "化龙爆发",
      summary: "手动化龙时额外获得 1 点真元，让蓄满的龙鳞立即转化为当回合爆发。",
      guide: Object.freeze({
        play: "在手牌足以连续进攻的回合主动化龙，额外真元会立即加入当前回合。",
        caution: "额外真元只在化龙瞬间获得，不会在之后的龙形回合重复发放。",
        guixu: "化龙时的额外真元由 1 点提高为 2 点。",
        fit: "适合主动蓄鳞、等待高质量攻击手牌后一口气爆发的玩家。",
      }),
      lore: "烬脉龙蛊把蓄满的逆鳞烧成一道腾渊火脉，催宿主在龙吟落下前倾尽真元。",
      trueForm: "手动化龙时额外获得 1 点真元。",
      guixu: "手动化龙时改为额外获得 2 点真元。",
    }),
    obsidianAegis: Object.freeze({
      id: "obsidianAegis",
      name: "玄甲镇脉",
      glyph: "镇",
      kind: "化龙护命",
      summary: "手动化龙时立即获得 8 点防御，可把化龙留到敌人重击将至时使用。",
      guide: Object.freeze({
        play: "观察敌人意图，在重击将至时化龙，以防御承住眼前攻势。",
        caution: "防御只在化龙瞬间获得；若敌人没有攻击，可能浪费这次护命价值。",
        guixu: "化龙时获得的防御由 8 点提高为 12 点。",
        fit: "适合稳健蓄鳞、把化龙同时当作攻守转换按钮的玩家。",
      }),
      lore: "烬脉龙蛊令黑金龙甲沿旧伤闭合，先镇住将裂的血脉，再放宿主踏火而行。",
      trueForm: "手动化龙时立即获得 8 点防御。",
      guixu: "手动化龙时改为立即获得 12 点防御。",
    }),
  }),
  bone: Object.freeze({
    soulSettling: Object.freeze({
      id: "soulSettling", name: "镇魂律", glyph: "镇", kind: "骨鸣化甲",
      summary: "骨鸣达到 3 点后发动镇魂：消耗骨鸣换取防御；高骨鸣时还能加深敌人衰老。",
      guide: Object.freeze({
        play: "在敌人重击前积攒骨鸣，以镇魂把骨响化为防御。",
        caution: "叩铃每回合只能发动一次，低于 3 点骨鸣无法发动。",
        benefit: "三转后镇魂保留 1 点骨鸣，且每场首次镇魂额外使敌人衰老 1。",
        guixu: "五转后每点骨鸣获得的防御由 3 提高为 4。",
        fit: "偏好稳守、用碎甲节奏换取长线生存的玩家。",
      }),
      lore: "骨铃将亡者余响压回甲中，先镇住眼前的杀意，再听下一声命数。",
      trueForm: "镇魂结算后保留 1 点骨鸣；每场首次镇魂额外使敌人衰老 1。",
      guixu: "镇魂每消耗 1 点骨鸣改为获得 4 点防御。",
    }),
    fateBreaking: Object.freeze({
      id: "fateBreaking", name: "断命律", glyph: "断", kind: "碎甲直伤",
      summary: "主动碎甲并消耗骨鸣，化作不计为攻击牌的直伤。",
      guide: Object.freeze({
        play: "先叠高防御与骨鸣，再用断命把防御转成直伤收尾。",
        caution: "没有防御时不能发动；五转后发动会令本回合不能再从卡牌获得防御。",
        benefit: "三转后主动碎甲上限由 12 提高到 16。",
        guixu: "五转后每点骨鸣的伤害由 2 提高为 3。",
        fit: "偏好蓄势、牺牲安全线换取爆发的玩家。",
      }),
      lore: "骨铃把护身之甲一节节敲碎，裂响越深，命线断得越快。",
      trueForm: "断命的主动碎甲上限提高到 16。",
      guixu: "每点骨鸣的直伤提高到 3；发动后本回合不能再从卡牌获得防御。",
    }),
  }),
});
const BENMING_LEGACY_PATH_NAMES = Object.freeze({
  fate: "旧规则·圆满余泽",
  blood: "旧规则·破茧吮煞",
  poison: "旧规则·宿毒入局",
  longevity: "旧规则·焚寿燃命",
  dragon: "旧规则·七鳞化龙",
  bone: "旧规则·基础叩铃",
});
const BENMING_LEGACY_STAGE_PASSIVES = Object.freeze({
  fate: Object.freeze({
    3: "命势圆满时，额外获得 1 点防御与 1 蛊石。",
    5: "命势圆满的额外收益翻倍（+2 防御、+2 蛊石）。",
  }),
  blood: Object.freeze({
    3: "每场首次血煞满溢时，恢复 4 点生命。",
    5: "每场开局自带血煞再 +2（累计 4 层）。",
  }),
  poison: Object.freeze({
    3: "每场开局敌人自带 2 层毒性。",
    5: "每场开局敌人自带毒性再 +2（累计 4 层）。",
  }),
  longevity: Object.freeze({
    3: "焚寿燃命的伤害加成 +25%。",
    5: "焚寿燃命的伤害加成再 +25%（累计 +50%）。",
  }),
  dragon: Object.freeze({
    3: "旧规则不启用双路线；手动化龙仍按基础规则结算。",
    5: "旧规则不启用路线五转强化；入塔可携带 3 只随行蛊。",
  }),
  bone: Object.freeze({
    3: "旧规则不启用双路线；叩铃仍按基础镇魂与断命结算。",
    5: "旧规则不启用路线五转强化；入塔可携带 3 只随行蛊。",
  }),
});
/* D-2c：schema 2→3。D-2b 起 createRunState 给所有英雄无条件写 schema，
 * 存量蜕鳞局已带 schema 2，无法按设计稿"无 schema"识别旧局；改为按英雄分档：
 * 该英雄路线上线时的 schema 即门槛（blood=2、poison=3），低于门槛=旧规则局。 */
const BENMING_PATH_SCHEMA = 5; // V0.9.51 #29：朝暮双路线上线
const BENMING_PATH_SCHEMA_MIN = Object.freeze({ blood: 2, poison: 3, dragon: 4, longevity: 5, bone: 5 });
const BENMING_FATE_MAX = 3;
const BENMING_FATE_BURST_MAX = 2;
let __benmingCache = null;
function getBenmingStore() {
  if (__benmingCache) return __benmingCache;
  try { __benmingCache = JSON.parse(localStorage.getItem(BENMING_KEY)) || {}; } catch (e) { __benmingCache = {}; }
  return __benmingCache;
}
function getBenmingDaoxing(heroId) {
  const v = Number(getBenmingStore()[heroId]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}
function addBenmingDaoxing(heroId, amount) {
  if (!heroId || !(amount > 0)) return;
  const store = getBenmingStore();
  store[heroId] = getBenmingDaoxing(heroId) + Math.floor(amount);
  try { safeWriteJson(BENMING_KEY, JSON.stringify(store)); } catch (e) { /* 存储不可用则忽略 */ }
}
function getBenmingStage(heroId) {
  const dao = getBenmingDaoxing(heroId);
  let stage = 0;
  BENMING_STAGES.forEach((s) => { if (dao >= s.threshold) stage = s.stage; });
  return stage;
}
function getBenmingStageInfo(heroId) {
  const stage = getBenmingStage(heroId);
  const dao = getBenmingDaoxing(heroId);
  const next = BENMING_STAGES[stage + 1] || null;
  return { stage, stageName: BENMING_STAGES[stage].name, dao, next, toNext: next ? next.threshold - dao : 0 };
}

function getEffectiveBenmingStage(heroId) {
  let effective = getBenmingStage(heroId);
  const guluStore = typeof getGuluStore === "function" ? getGuluStore() : null;
  const now = typeof guluNow === "function" ? guluNow() : Date.now();
  if (guluStore?.injuryUntil && now < guluStore.injuryUntil) effective = Math.max(0, effective - 1);
  return effective;
}

function getBenmingPathDefinition(heroId, pathId) {
  return BENMING_PATHS[heroId]?.[pathId] || null;
}

function getRunBenmingPath(run) {
  if (!run || !Object.prototype.hasOwnProperty.call(run, "benmingPath")) return null;
  return getBenmingPathDefinition(run.heroId || "fate", run.benmingPath)?.id || null;
}

function isLegacyBenmingRun(run) {
  if (!run) return false;
  if (run.heroId === "fate") return !Object.prototype.hasOwnProperty.call(run, "benmingPath");
  const minSchema = BENMING_PATH_SCHEMA_MIN[run.heroId];
  if (minSchema) return !(Number(run.benmingPathSchema) >= minSchema);
  return false;
}

function getBenmingPathDisplayName(run) {
  if (!run) return "未启用";
  if (isLegacyBenmingRun(run)) return BENMING_LEGACY_PATH_NAMES[run.heroId] || "旧规则";
  return getBenmingPathDefinition(run.heroId, getRunBenmingPath(run))?.name || "未启用";
}

function getBenmingStagePassiveText(heroId, stage, pathId = null, legacy = false) {
  const gu = BENMING_GU[heroId];
  if (!gu) return "";
  if (!BENMING_PATHS[heroId] || (stage !== 3 && stage !== 5)) return gu.stagePassives[stage] || "";
  if (legacy) return BENMING_LEGACY_STAGE_PASSIVES[heroId]?.[stage] || gu.stagePassives[stage] || "";
  const path = getBenmingPathDefinition(heroId, pathId);
  if (!path) return gu.stagePassives[stage] || "";
  return stage === 3 ? path.trueForm : path.guixu;
}

function getDragonBenmingOpeningScale(stage) {
  const value = Math.max(0, Number(stage) || 0);
  return value >= 4 ? 2 : (value >= 1 ? 1 : 0);
}

function getDragonBenmingReadyArmor(stage, alreadyGranted = false) {
  return !alreadyGranted && (Number(stage) || 0) >= 2 ? 4 : 0;
}

/* V0.9.51 #29 朝暮双路线·纯规则（无 RNG、不读写 runState/game/DOM，便于门禁 vm 断言）。 */

/* 积薪成炬：按本场累计焚寿量算攻击加成——每 3 点 +2，五转把上限由 8 抬到 12。 */
function getKindlingPyreAttackBonus(stage, pathId, burnedThisBattle) {
  if (pathId !== "kindlingPyre" || (Number(stage) || 0) < 3) return 0;
  const burned = Math.max(0, Math.floor(Number(burnedThisBattle) || 0));
  const cap = (Number(stage) || 0) >= 5 ? 12 : 8;
  return Math.min(cap, Math.floor(burned / 3) * 2);
}

/* 朝暮回灯：每回合首次焚寿按焚量回血，五转 1.5 倍（向下取整）。调用方负责"每回合一次"的 latch。 */
function getDuskRelightHeal(stage, pathId, burnedAmount) {
  if (pathId !== "duskRelight" || (Number(stage) || 0) < 3) return 0;
  const burned = Math.max(0, Math.floor(Number(burnedAmount) || 0));
  if (burned <= 0) return 0;
  return (Number(stage) || 0) >= 5 ? Math.floor(burned * 1.5) : burned;
}

function getDragonBenmingTransformBonus(stage, pathId) {
  const value = Math.max(0, Number(stage) || 0);
  if (value < 3) return { energy: 0, armor: 0 };
  if (pathId === "emberAscension") return { energy: value >= 5 ? 2 : 1, armor: 0 };
  if (pathId === "obsidianAegis") return { energy: 0, armor: value >= 5 ? 12 : 8 };
  return { energy: 0, armor: 0 };
}

// 纯规则：规划本回合缝煞状态，不读写 runState、game 或 DOM。
function resolveBloodStitchFlow(currentState, options = {}) {
  const state = ["unprepared", "prepared", "spent", "forfeited"].includes(currentState)
    ? currentState
    : "unprepared";
  const isBloodCard = Boolean(options.isBloodCard);
  const selfDamage = Math.max(0, Number(options.selfDamage) || 0);
  const guixu = Boolean(options.guixu);
  const unchanged = {
    state, triggered: false, consumed: false, forfeited: false,
    selfDamageReduction: 0, bonusBlood: 0,
  };
  if (state === "spent" || state === "forfeited") return unchanged;
  if (!isBloodCard) return { ...unchanged, state: "prepared" };
  if (state === "prepared") {
    return {
      state: "spent",
      triggered: selfDamage > 0,
      consumed: true,
      forfeited: false,
      selfDamageReduction: selfDamage > 0 ? 1 : 0,
      bonusBlood: selfDamage > 0 ? 1 : 0,
    };
  }
  if (guixu) return unchanged;
  return { ...unchanged, state: "forfeited", forfeited: true };
}

// 纯规则：预览或确认一次裂茧代偿；副作用由 game.js 在确认后执行。
function planBloodAtonement(options = {}) {
  const blood = Math.max(0, Number(options.blood) || 0);
  const usesThisTurn = Math.max(0, Number(options.usesThisTurn) || 0);
  const selfDamage = Math.max(0, Number(options.selfDamage) || 0);
  const maxUses = options.guixu ? 2 : 1;
  const eligible = Boolean(options.isBloodCard)
    && Boolean(options.isAttack)
    && selfDamage > 0
    && blood >= 3
    && usesThisTurn < maxUses
    && !options.cardAlreadyAtoned;
  const applied = eligible && Boolean(options.confirmed);
  return {
    eligible,
    applied,
    reason: eligible ? "" : (blood < 3 ? "血煞不足 3 层" : (usesThisTurn >= maxUses ? "本回合代偿次数已用尽" : "此牌不能代偿")),
    bloodSnapshot: blood,
    bloodAfter: applied ? blood - 3 : blood,
    bloodSpent: applied ? 3 : 0,
    selfDamageAfter: applied ? Math.max(0, selfDamage - 3) : selfDamage,
    selfDamageIfApplied: eligible ? Math.max(0, selfDamage - 3) : selfDamage,
    hpSaved: applied ? Math.min(3, selfDamage) : 0,
    usesAfter: applied ? usesThisTurn + 1 : usesThisTurn,
    maxUses,
  };
}

// 纯规则：以出牌前状态推演一次逆鳞后毒；bonusPoison 由 game.js 合并进该牌自身的施毒事件，不得二次施毒。
function resolvePoisonAfterstrikeFlow(currentState, options = {}) {
  const state = ["waitingAttack", "primed", "spent", "forfeited"].includes(currentState)
    ? currentState
    : "waitingAttack";
  const isAttackCard = Boolean(options.isAttackCard);
  const appliesPoison = Boolean(options.appliesPoison);
  const guixu = Boolean(options.guixu);
  const unchanged = { state, triggered: false, bonusPoison: 0, forfeited: false, primed: false };
  if (state === "spent" || state === "forfeited") return unchanged;
  if (state === "primed") {
    if (appliesPoison) return { state: "spent", triggered: true, bonusPoison: 2, forfeited: false, primed: false };
    return unchanged;
  }
  // waitingAttack：施毒牌先行——真形当回合弃权；归墟不弃权，且施毒攻击可为更晚的施毒牌铺垫（不能自触发）。
  if (appliesPoison) {
    if (!guixu) return { state: "forfeited", triggered: false, bonusPoison: 0, forfeited: true, primed: false };
    if (isAttackCard) return { state: "primed", triggered: false, bonusPoison: 0, forfeited: false, primed: true };
    return unchanged;
  }
  if (isAttackCard) return { state: "primed", triggered: false, bonusPoison: 0, forfeited: false, primed: true };
  return unchanged;
}

// 纯规则：预览或确认一次蜕鳞借毒；扣毒与给甲的副作用由 game.js 在确认后经现有入口执行。
function planPoisonBorrowedScale(options = {}) {
  const poison = Math.max(0, Number(options.poison) || 0);
  const enemyAttacking = Boolean(options.enemyAttacking);
  const used = Boolean(options.usedThisTurn);
  const eligible = enemyAttacking && poison >= 4 && !used;
  const applied = eligible && Boolean(options.confirmed);
  return {
    eligible,
    applied,
    reason: eligible ? "" : (!enemyAttacking ? "敌人本回合没有攻击意图" : (poison < 4 ? "敌人毒层不足 4" : "本回合已借过毒")),
    poisonCost: 4,
    armorGain: 6,
    poisonSnapshot: poison,
    poisonAfter: applied ? poison - 4 : poison,
    guixuReturn: options.guixu ? 2 : 0,
  };
}

// 纯规则：归墟借毒验收——该次敌方攻击全部段合计生命伤害为 0 才返还 2 层旧毒；返还不是施毒。
function planPoisonBorrowedReturn(options = {}) {
  const pending = Boolean(options.pending);
  const guixu = Boolean(options.guixu);
  const lifeDamage = Math.max(0, Number(options.lifeDamage) || 0);
  return { returned: pending && guixu && lifeDamage === 0 ? 2 : 0 };
}

// 无名逆命者路线的保底护持：只抬高三转路线的收益下限，不增加命势圆满次数，避免重开无限循环。
function planFateRouteGuard(pathId, event, usedThisTurn) {
  const used = Boolean(usedThisTurn);
  const eligible = !used && (
    (pathId === "threeWeave" && event === "triadComplete")
    || (pathId === "devourOmen" && event === "rewriteComplete")
  );
  return { armor: eligible ? 3 : 0, used: used || eligible };
}

// 纯规则函数：只规划三相序列与本张出牌命势，战斗副作用仍由 game.js 统一执行。
function resolveFateTriadFlow(sequence, graceUsed, currentFlow, lastFlow, chainFate, guixu) {
  const validFlows = ["attack", "defense", "utility"];
  let nextSequence = Array.isArray(sequence)
    ? sequence.filter((flow, index, list) => validFlows.includes(flow) && list.indexOf(flow) === index)
    : [];
  if (!validFlows.includes(currentFlow)) {
    return { sequence: nextSequence, graceUsed: Boolean(graceUsed), fateGain: 0, completed: false, repeated: false };
  }

  const repeated = nextSequence.includes(currentFlow);
  let nextGraceUsed = Boolean(graceUsed);
  const graceConsumed = repeated && guixu && !nextGraceUsed;
  if (repeated) {
    if (graceConsumed) nextGraceUsed = true;
    else nextSequence = [currentFlow];
  } else {
    nextSequence.push(currentFlow);
  }

  const gainsByFlow = Boolean(lastFlow) && (lastFlow !== currentFlow || Boolean(chainFate));
  let fateGain = gainsByFlow ? 1 : 0;
  const completed = !repeated && validFlows.every((flow) => nextSequence.includes(flow));
  if (completed) {
    fateGain = gainsByFlow ? 2 : 0;
    nextSequence = [];
  }
  return { sequence: nextSequence, graceUsed: nextGraceUsed, fateGain, completed, repeated, graceConsumed };
}

// 纯规则函数：单次命势来源至多结算一次；第三次圆满永远被两次上限截住。
function planFateMomentumGain(momentum, amount, burstsThisTurn, allowOverflow, deferFull) {
  const before = Math.max(0, Math.min(BENMING_FATE_MAX, Number(momentum) || 0));
  const gainAmount = Math.max(0, Number(amount) || 0);
  const bursts = Math.max(0, Number(burstsThisTurn) || 0);
  if (gainAmount <= 0) return { gained: 0, momentumAfter: before, settlements: 0, pending: false };

  if (bursts >= BENMING_FATE_BURST_MAX) {
    return {
      gained: Math.max(0, Math.min(gainAmount, BENMING_FATE_MAX - before)),
      momentumAfter: Math.min(BENMING_FATE_MAX, before + gainAmount),
      settlements: 0,
      pending: false,
    };
  }

  const total = before + gainAmount;
  if (total < BENMING_FATE_MAX) {
    return { gained: gainAmount, momentumAfter: total, settlements: 0, pending: false };
  }

  const gained = Math.max(0, allowOverflow && before < BENMING_FATE_MAX
    ? gainAmount
    : Math.min(gainAmount, BENMING_FATE_MAX - before));
  if (deferFull) {
    return { gained, momentumAfter: BENMING_FATE_MAX, settlements: 0, pending: true };
  }
  const overflow = allowOverflow && before < BENMING_FATE_MAX
    ? Math.min(BENMING_FATE_MAX - 1, Math.max(0, total - BENMING_FATE_MAX))
    : 0;
  return { gained, momentumAfter: overflow, settlements: 1, pending: false };
}

// 战斗内被动判定：本局蛊修是该蛊之主，且形态已到档。V0.9.22：蛊斗反噬静养期内形态降一档。
function benmingPassive(heroId, stage) {
  if (!runState || runState.heroId !== heroId) return false;
  return getEffectiveBenmingStage(heroId) >= stage;
}
/* ===== 本命蛊立绘字面量清单（务必与 assets/codex/benming/ 实际文件保持一致） =====
 * 为什么必须有这份清单：TapTap 打包器（ops/taptap-h5-demo.js 的 assetRefs）只用正则扫描源码里的
 * **字面量**资产路径来决定拷贝哪些文件；下面 getBenmingImagePath 用模板字符串拼路径，正则扫到
 * `assets/codex/benming/` 撞上 ${ 就断了，匹配不到 .jpg —— 结果整包一张本命蛊立绘都不带，
 * 装进 TapTap 后全部 404，再被 <img onerror="this.remove()"> 静默删掉，表现为「本命蛊图片全消失」，
 * 且本地跑永远复现不出来。V0.9.45 自测包实测：本地 31 张 → 包内 0 张。
 * nmg-voices.js 的 VOICE_ASSET_MANIFEST 是同一问题的既有解法，此处照办。
 * 新增/删除立绘时必须同步本清单，ops/check-asset-manifests.js 会红灯拦截不同步。 */
const BENMING_IMAGE_MANIFEST = Object.freeze([
  "assets/codex/benming/fate-0.jpg", "assets/codex/benming/fate-1.jpg", "assets/codex/benming/fate-2.jpg",
  "assets/codex/benming/fate-3.jpg", "assets/codex/benming/fate-4.jpg", "assets/codex/benming/fate-5.jpg",
  "assets/codex/benming/blood-0.jpg", "assets/codex/benming/blood-1.jpg", "assets/codex/benming/blood-2.jpg",
  "assets/codex/benming/blood-3.jpg", "assets/codex/benming/blood-4.jpg", "assets/codex/benming/blood-5.jpg",
  "assets/codex/benming/poison-0.jpg", "assets/codex/benming/poison-1.jpg", "assets/codex/benming/poison-2.jpg",
  "assets/codex/benming/poison-3.jpg", "assets/codex/benming/poison-4.jpg", "assets/codex/benming/poison-5.jpg",
  "assets/codex/benming/longevity-0.jpg", "assets/codex/benming/longevity-1.jpg", "assets/codex/benming/longevity-2.jpg",
  "assets/codex/benming/longevity-3.jpg", "assets/codex/benming/longevity-4.jpg", "assets/codex/benming/longevity-5.jpg",
  "assets/codex/benming/dragon-0.jpg", "assets/codex/benming/dragon-1.jpg", "assets/codex/benming/dragon-2.jpg",
  "assets/codex/benming/dragon-3a.jpg", "assets/codex/benming/dragon-3b.jpg", "assets/codex/benming/dragon-4.jpg",
  "assets/codex/benming/dragon-5.jpg",
  "assets/codex/benming/wenling-bone-chime.webp",
  "assets/codex/benming/fate-6.webp", "assets/codex/benming/fate-7.webp",
  "assets/codex/benming/fate-8.webp", "assets/codex/benming/fate-9.webp",
  "assets/codex/benming/blood-6.webp", "assets/codex/benming/blood-7.webp",
  "assets/codex/benming/blood-8.webp", "assets/codex/benming/blood-9.webp",
  "assets/codex/benming/poison-6.webp", "assets/codex/benming/poison-7.webp",
  "assets/codex/benming/poison-8.webp", "assets/codex/benming/poison-9.webp",
  "assets/codex/benming/longevity-6.webp", "assets/codex/benming/longevity-7.webp",
  "assets/codex/benming/longevity-8.webp", "assets/codex/benming/longevity-9.webp",
  "assets/codex/benming/dragon-6.webp", "assets/codex/benming/dragon-7.webp",
  "assets/codex/benming/dragon-8.webp", "assets/codex/benming/dragon-9.webp",
  "assets/codex/benming/bone-6.webp", "assets/codex/benming/bone-7.webp",
  "assets/codex/benming/bone-8.webp", "assets/codex/benming/bone-9.webp",
]);

// 烬脉龙蛊在真形(stage3)按路线分化；六转起六只本命蛊均使用独立 WebP 高转立绘。
function getBenmingImagePath(heroId, stage, pathId = null) {
  const normalizedStage = Number(stage) || 0;
  if (normalizedStage >= 6) return `assets/codex/benming/${heroId}-${normalizedStage}.webp`;
  if (heroId === "bone") return "assets/codex/benming/wenling-bone-chime.webp";
  if (heroId === "dragon" && normalizedStage === 3) {
    return `assets/codex/benming/dragon-3${pathId === "obsidianAegis" ? "b" : "a"}.jpg`;
  }
  return `assets/codex/benming/${heroId}-${normalizedStage}.jpg`;
}
