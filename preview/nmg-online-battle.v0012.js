"use strict";
/* 蛊斗场权威纯规则：六脉沿用 PVE 核心资源，数值按 100 命公平对战缩尺。 */
(function createOnlineBattleCore(global) {
  var CARDS = Object.freeze({
    /* 公共攻击 */
    strike: Object.freeze({ name: "月刃蛊", cost: 1, category: "attack", damage: 7, text: "造成 7 伤害。" }),
    devour: Object.freeze({ name: "群噬蛊", cost: 1, category: "attack", damage: 6, text: "造成 6 伤害。" }),
    redFang: Object.freeze({ name: "赤牙蛊", cost: 1, category: "attack", damage: 8, text: "造成 8 伤害。" }),
    pierce: Object.freeze({ name: "穿心蛊", cost: 2, category: "attack", damage: 14, text: "造成 14 伤害。" }),
    siphon: Object.freeze({ name: "夺元蛊", cost: 1, category: "attack", damage: 4, energy: 1, text: "造成 4 伤害，获得 1 真元。" }),
    leech: Object.freeze({ name: "血吸蛊", cost: 2, category: "attack", damage: 8, heal: 4, text: "造成 8 伤害，回复 4 生命。" }),
    thunderGuide: Object.freeze({ name: "引雷蛊", cost: 1, category: "attack", damage: 8, comboDamage: 4, text: "造成 8 伤害；本回合此前打出过牌时，额外 +4。" }),
    armorBreaker: Object.freeze({ name: "破甲蛊", cost: 1, category: "attack", damage: 5, enemyArmorDamage: 6, text: "造成 5 伤害；对手有防御时额外 +6。" }),
    /* 公共护甲 */
    guard: Object.freeze({ name: "铁皮蛊", cost: 1, category: "armor", armor: 7, text: "获得 7 防御。" }),
    molt: Object.freeze({ name: "蜕骨蛊", cost: 1, category: "armor", armor: 4, draw: 1, text: "获得 4 防御，抽 1 张牌。" }),
    carapace: Object.freeze({ name: "玄甲蛊", cost: 2, category: "armor", armor: 13, text: "获得 13 防御。" }),
    ward: Object.freeze({ name: "避劫蛊", cost: 1, category: "armor", armor: 5, cleanse: 2, text: "获得 5 防御，移除 2 蚀毒。" }),
    shell: Object.freeze({ name: "残壳蛊", cost: 1, category: "armor", armor: 6, hurtArmor: 5, text: "获得 6 防御；本回合受过伤则再得 5。" }),
    mirror: Object.freeze({ name: "镜甲蛊", cost: 2, category: "armor", armor: 9, enemyArmorBonus: 4, text: "获得 9 防御；对手有防御时再得 4。" }),
    hiddenMeridian: Object.freeze({ name: "伏脉蛊", cost: 1, category: "armor", armor: 5, nextTurnArmor: 5, text: "获得 5 防御；下回合开始时再得 5。" }),
    coiledShell: Object.freeze({ name: "盘蜕蛊", cost: 1, category: "armor", armor: 7, lowHandArmor: 5, text: "获得 7 防御；出牌后手牌不多于 3 张时再得 5。" }),
    /* 公共辅助 */
    insight: Object.freeze({ name: "回息蛊", cost: 0, category: "utility", draw: 1, text: "抽 1 张牌。" }),
    gather: Object.freeze({ name: "聚元蛊", cost: 1, category: "utility", energy: 2, text: "获得 2 真元。" }),
    cleanse: Object.freeze({ name: "净瘴蛊", cost: 1, category: "utility", cleanse: 4, text: "移除 4 蚀毒。" }),
    spore: Object.freeze({ name: "瘴孢蛊", cost: 1, category: "utility", poison: 2, text: "施加 2 蚀毒。" }),
    spring: Object.freeze({ name: "回春蛊", cost: 2, category: "utility", heal: 7, draw: 1, text: "回复 7 生命，抽 1 张牌。" }),
    echo: Object.freeze({ name: "回声蛊", cost: 1, category: "utility", draw: 2, text: "抽 2 张牌。" }),
    yuanVessel: Object.freeze({ name: "承元蛊", cost: 1, category: "utility", armor: 5, energy: 1, text: "获得 5 防御与 1 真元。" }),
    borrowLife: Object.freeze({ name: "借命蛊", cost: 0, category: "utility", selfDamage: 2, nonlethal: true, energy: 1, draw: 1, text: "失去 2 生命，获得 1 真元并抽 1 张牌；不会致死。" }),

    /* 命势 */
    fateSeal: Object.freeze({ name: "逆命签", cost: 1, category: "utility", damage: 5, draw: 1, text: "造成 5 伤害，抽 1 张牌。" }),
    fateThread: Object.freeze({ name: "命线蛊", cost: 1, category: "attack", damage: 6, fateThreshold: 2, fateBonusDamage: 5, text: "造成 6 伤害；命势不少于 2 时额外 +5。" }),
    reversePath: Object.freeze({ name: "逆途蛊", cost: 1, category: "armor", armor: 4, fateGain: 1, text: "获得 4 防御与 1 命势。" }),
    fixedNumber: Object.freeze({ name: "定数蛊", cost: 2, category: "armor", armor: 9, categoryShiftArmor: 3, text: "获得 9 防御；若上一张不是护甲蛊，再得 3。" }),
    /* 血道 */
    bloodSacrifice: Object.freeze({ name: "血祭蛊", cost: 0, category: "utility", selfDamage: 3, bloodGain: 2, draw: 1, text: "失去 3 生命，获得 2 血煞，抽 1 张牌。" }),
    bloodThirst: Object.freeze({ name: "嗜血蛊", cost: 1, category: "attack", damage: 7, bloodScale: 1, heal: 7, text: "造成 7 + 当前血煞伤害，回复 7 生命。" }),
    bloodRobe: Object.freeze({ name: "血衣蛊", cost: 1, category: "armor", selfDamage: 2, armor: 14, bloodGain: 1, text: "失去 2 生命，获得 14 防御与 1 血煞。" }),
    bloodTide: Object.freeze({ name: "血潮蛊", cost: 2, category: "attack", damage: 5, bloodScale: 3, text: "造成 5 + 当前血煞×3 伤害。" }),
    /* 毒道 */
    greenMiasma: Object.freeze({ name: "青瘴蛊", cost: 1, category: "utility", poison: 3, text: "施加 3 蚀毒。" }),
    insectSwarm: Object.freeze({ name: "虫群蛊", cost: 1, category: "attack", damage: 4, poison: 2, text: "造成 4 伤害并施加 2 蚀毒。" }),
    moltingShell: Object.freeze({ name: "蜕壳蛊", cost: 1, category: "armor", armor: 7, drawIfEnemyPoisoned: 1, text: "获得 7 防御；对手已中毒则抽 1。" }),
    returningPoison: Object.freeze({ name: "归毒蛊", cost: 2, category: "attack", damage: 5, poisonThreshold: 8, poisonBonusDamage: 5, text: "造成 5 伤害；对手至少 8 毒时额外 +5。" }),
    /* 寿道 */
    lifeFlame: Object.freeze({ name: "命焰蛊", cost: 1, category: "attack", lifespanCost: 1, damage: 7, text: "焚 1 寿元，造成 7 伤害并承受残寿加成。" }),
    witheredBloom: Object.freeze({ name: "枯荣蛊", cost: 1, category: "utility", lifespanCost: 2, heal: 7, text: "焚 2 寿元，回复 7 生命。" }),
    lifePyre: Object.freeze({ name: "燃命蝎", cost: 2, category: "attack", lifespanCost: 2, damage: 5, burnDamage: 3, text: "焚 2 寿元，造成 5 + 实际焚寿×3 伤害。" }),
    lifeRenew: Object.freeze({ name: "蚀岁蛊", cost: 2, category: "attack", damage: 6, lifespanGain: 2, text: "造成 6 伤害，续回 2 寿元。" }),
    /* 龙裔 */
    scaleHiding: Object.freeze({ name: "藏鳞蛊", cost: 1, category: "armor", armor: 8, scaleGain: 1, text: "获得 8 防御与 1 龙鳞。" }),
    reverseScale: Object.freeze({ name: "逆鳞蛊", cost: 1, category: "attack", selfDamage: 2, damage: 9, scaleGain: 2, text: "失去 2 生命，造成 9 伤害并得 2 龙鳞。" }),
    chiBreath: Object.freeze({ name: "螭息蛊", cost: 2, category: "attack", damage: 13, transformedBonusDamage: 6, text: "造成 13 伤害；龙化期间额外 +6。" }),
    boneMolt: Object.freeze({ name: "蜕骨龙蛊", cost: 1, category: "armor", scaleCost: 2, armor: 6, draw: 2, text: "耗 2 龙鳞，抽 2 并得 6 防御；龙化免耗。" }),
    /* 骨道 */
    boneBell: Object.freeze({ name: "骨铃蛊", cost: 1, category: "armor", armor: 4, weaken: 1, text: "获得 4 防御，使对手衰老 1（攻击伤害永久 -1，最多 3 层）。" }),
    boneSacrifice: Object.freeze({ name: "叩甲蛊", cost: 1, category: "armor", armorSacrifice: 4, armor: 8, text: "主动碎去至多 4 防御，再获得 8 防御。" }),
    boneSever: Object.freeze({ name: "断节蛊", cost: 1, category: "attack", armorSacrifice: 8, damage: 6, sacrificeDamage: 1, text: "主动碎去至多 8 防御，造成 6 + 实际碎甲伤害。" }),
    afterEcho: Object.freeze({ name: "余响蛊", cost: 1, category: "utility", breakEcho: 6, drawOnBreak: 1, text: "本轮对手首次击碎你的防御时，反击 6 点直伤并抽 1 张牌。" }),
    boneCourt: Object.freeze({ name: "骨庭蛊", cost: 2, category: "armor", armor: 5, resonanceArmor: 1, text: "获得 5 + 骨鸣防御。" })
  });

  var COMMON_GROUPS = Object.freeze({
    attack: Object.freeze(["strike", "devour", "redFang", "pierce", "siphon", "leech", "thunderGuide", "armorBreaker"]),
    armor: Object.freeze(["guard", "molt", "carapace", "ward", "shell", "mirror", "hiddenMeridian", "coiledShell"]),
    utility: Object.freeze(["insight", "gather", "cleanse", "spore", "spring", "echo", "yuanVessel", "borrowLife"])
  });
  var COMMON_KEYS = Object.freeze([].concat(COMMON_GROUPS.attack, COMMON_GROUPS.armor, COMMON_GROUPS.utility));
  var HERO_SPECIALS = Object.freeze({
    fate: Object.freeze(["fateSeal", "fateThread", "reversePath", "fixedNumber"]),
    blood: Object.freeze(["bloodSacrifice", "bloodThirst", "bloodRobe", "bloodTide"]),
    poison: Object.freeze(["greenMiasma", "insectSwarm", "moltingShell", "returningPoison"]),
    longevity: Object.freeze(["lifeFlame", "witheredBloom", "lifePyre", "lifeRenew"]),
    dragon: Object.freeze(["scaleHiding", "reverseScale", "chiBreath", "boneMolt"]),
    bone: Object.freeze(["boneBell", "boneSacrifice", "boneSever", "afterEcho", "boneCourt"])
  });
  var HERO_NAMES = Object.freeze({ fate: "无名逆命者", blood: "绛妄", poison: "青蟒", longevity: "朝暮", dragon: "烬鳞", bone: "闻铃" });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function cleanId(value, fallback) { var text = String(value || "").trim().slice(0, 96); return text || fallback; }
  function seedHash(value) {
    var h = 2166136261 >>> 0;
    String(value || "0").split("").forEach(function (char) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; });
    return h || 1;
  }
  function shuffled(list, seed) {
    var result = list.slice(), x = seedHash(seed);
    for (var i = result.length - 1; i > 0; i -= 1) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      var j = x % (i + 1), hold = result[i]; result[i] = result[j]; result[j] = hold;
    }
    return result;
  }
  function heroSpecialKeys(heroId) { return (HERO_SPECIALS[heroId] || HERO_SPECIALS.fate).slice(); }
  function normalizeCommons(value) {
    var chosen = Array.isArray(value) ? value.filter(function (key, index, list) { return COMMON_KEYS.indexOf(key) >= 0 && list.indexOf(key) === index; }) : [];
    return (chosen.length === 6 ? chosen : ["strike", "guard", "insight", "molt", "devour", "cleanse"]).slice(0, 6);
  }
  function createDeck(heroId, seed, commons) {
    var deck = [];
    normalizeCommons(commons).forEach(function (key) { deck.push(key); });
    heroSpecialKeys(heroId).forEach(function (key) { deck.push(key); });
    return shuffled(deck, seed);
  }
  function drawOne(player) {
    if (!player.draw.length && player.discard.length) { player.draw = player.discard.slice().reverse(); player.discard = []; }
    if (player.draw.length) { player.hand.push(player.draw.shift()); return true; }
    return false;
  }
  function drawCards(player, count) { var drawn = 0; while (drawn < count && player.hand.length < 8 && drawOne(player)) drawn += 1; return drawn; }
  function drawTo(player, count) { while (player.hand.length < count && drawOne(player)) { /* initial draw */ } }
  function otherId(state, id) { return state.order[0] === id ? state.order[1] : state.order[0]; }
  // TapTap 联机单条消息上限为 2KB；完整结算另有 lastAction，战报只保留最近一条。
  function appendEvent(state, value) { state.events = [String(value).slice(0, 72)]; }
  function dealDamage(player, amount, direct) {
    var incoming = Math.max(0, Math.floor(Number(amount) || 0));
    var blocked = direct ? 0 : Math.min(player.armor, incoming);
    if (!direct) player.armor -= blocked;
    var life = incoming - blocked;
    player.hp = Math.max(0, player.hp - life);
    return { blocked: blocked, life: life };
  }
  function gainResource(player, amount) {
    if (!player.resource) return 0;
    var before = player.resource.value;
    player.resource.value = Math.min(player.resource.max, before + Math.max(0, Number(amount) || 0));
    return player.resource.value - before;
  }
  function createResource(heroId) {
    if (heroId === "fate") return { key: "fate", value: 0, max: 3, lastCategory: "", completionsThisTurn: 0 };
    if (heroId === "blood") return { key: "blood", value: 0, max: 10 };
    if (heroId === "poison") return { key: "poison", corrosionUsedThisTurn: false };
    if (heroId === "longevity") return { key: "longevity", value: 12, max: 12, burned: 0 };
    if (heroId === "dragon") return { key: "dragon", value: 0, max: 7, transformedTurns: 0, attackGranted: false, armorGranted: false };
    return { key: "bone", value: 0, max: 6, armorGainGranted: false, armorBreakGranted: false, sacrificeGranted: false, chimeUsed: false };
  }
  function resetTurnResource(player) {
    var r = player.resource;
    if (r.key === "fate") r.completionsThisTurn = 0;
    if (r.key === "poison") r.corrosionUsedThisTurn = false;
    if (r.key === "dragon") { r.attackGranted = false; r.armorGranted = false; }
    if (r.key === "bone") { r.armorGainGranted = false; r.armorBreakGranted = false; r.sacrificeGranted = false; r.chimeUsed = false; }
    player.wasDamagedThisTurn = false;
    player.cardsPlayedThisTurn = 0;
    player.freeDrawUsed = false;
  }
  function finish(state, winnerId, reason) {
    state.status = "finished"; state.winnerId = winnerId; state.reason = reason || "hp"; state.activePlayerId = "";
    appendEvent(state, (state.players[winnerId] && state.players[winnerId].name || "一方") + "蛊势压境，胜负已分。");
  }
  function noteBoneBreak(player, armorBefore) {
    if (player.resource.key !== "bone" || armorBefore <= 0 || player.armor > 0 || player.resource.armorBreakGranted) return false;
    player.resource.armorBreakGranted = true; gainResource(player, 1); return true;
  }
  function startTurn(state, id) {
    var player = state.players[id], enemy = state.players[otherId(state, id)];
    player.breakEchoArmed = false;
    resetTurnResource(player);
    player.energy = player.maxEnergy;
    if (player.nextTurnArmor > 0) {
      var delayedArmor = Math.min(player.nextTurnArmor, 40 - player.armor);
      player.armor += delayedArmor; player.nextTurnArmor = 0;
      appendEvent(state, player.name + "伏脉苏醒，获得 " + delayedArmor + " 防御。");
    }
    if (player.resource.key === "dragon" && player.resource.transformedTurns > 0) player.energy = Math.min(10, player.energy + 1);
    if (state.round >= 12) {
      var fire = 3 + (state.round - 12) * 2;
      var fireHit = dealDamage(player, fire, true);
      if (fireHit.life > 0) player.wasDamagedThisTurn = true;
      state.lastAction = { revision: state.revision, actorId: "fatefire", targetId: id, damage: fire, mechanic: "fatefire" };
      appendEvent(state, "命火焚身，" + player.name + "失去 " + fire + " 生命。");
      if (player.hp <= 0) { finish(state, otherId(state, id), "fatefire"); return; }
    }
    if (player.poison > 0) {
      var poison = player.poison, poisonArmorBefore = player.armor; player.poison = Math.max(0, poison - 1);
      var poisonHit = dealDamage(player, poison, false);
      if (poisonHit.blocked + poisonHit.life > 0) player.wasDamagedThisTurn = true;
      noteBoneBreak(player, poisonArmorBefore);
      appendEvent(state, player.name + "蚀毒发作，承受 " + poison + " 点伤害。");
      if (player.hp <= 0) { finish(state, otherId(state, id), "hp"); return; }
    }
    if (player.turnsTaken > 0) drawCards(player, 3);
    player.turnsTaken += 1;
    if (player.resource.key === "poison") {
      enemy.poison = Math.min(20, enemy.poison + 1);
      appendEvent(state, player.name + "催动万毒归宗，施加 1 蚀毒。");
    }
  }
  function draftPool(seed) {
    return [].concat(
      shuffled(COMMON_GROUPS.attack, seed + "|attack").slice(0, 4),
      shuffled(COMMON_GROUPS.armor, seed + "|armor").slice(0, 4),
      ["cleanse"],
      shuffled(COMMON_GROUPS.utility.filter(function (key) { return key !== "cleanse"; }), seed + "|utility").slice(0, 3)
    );
  }
  function createBattle(options) {
    options = options || {};
    var ids = Array.isArray(options.playerIds) ? options.playerIds : [], first = cleanId(ids[0], "player-1"), second = cleanId(ids[1], "player-2");
    if (second === first) second = first + "-2";
    var seed = seedHash(options.seed || options.battleId || Date.now()), heroes = options.heroes || {}, order = shuffled([first, second], seed).slice(0, 2);
    var players = {}, loadouts = options.loadouts || {}, names = options.names || {};
    order.forEach(function (id, index) {
      var heroId = HERO_SPECIALS[heroes[id]] ? heroes[id] : "fate", commons = normalizeCommons(loadouts[id]);
      players[id] = { heroId: heroId, name: cleanId(names[id], "求命者").replace(/[<>]/g, "").slice(0, 16), pathName: HERO_NAMES[heroId], hp: 100, maxHp: 100,
        armor: index === 1 ? 3 : 0, nextTurnArmor: 0, poison: 0, weaken: 0, breakEchoArmed: false, energy: 3, maxEnergy: 3, resource: createResource(heroId), commons: commons,
        turnsTaken: index === 0 ? 1 : 0, cardsPlayedThisTurn: 0, wasDamagedThisTurn: false, freeDrawUsed: false, draw: createDeck(heroId, seed + index * 997, commons), hand: [], discard: [] };
      drawTo(players[id], index === 1 ? 6 : 5);
    });
    var mode = options.mode === "private" ? "private" : options.mode === "bot" ? "bot" : "random", startedAt = Math.max(0, Number(options.now) || Date.now()), idleTimeouts = {};
    order.forEach(function (id) { idleTimeouts[id] = 0; });
    return { protocol: 3, battleId: cleanId(options.battleId, "online-duel"), revision: 0, mode: mode, rewardEligible: false, status: "active", reason: "", winnerId: "",
      round: 1, activePlayerId: order[0], order: order, players: players, turnDeadline: startedAt + 45000, turnActionCount: 0, idleTimeouts: idleTimeouts,
      lastAction: null, events: [players[order[0]].name + "执先手；" + players[order[1]].name + "得后发蛊印（起手 +1、护势 +3）。"] };
  }
  function validResource(player) {
    var r = player.resource;
    if (!r || r.key !== player.heroId) return false;
    if (r.key === "poison") return typeof r.corrosionUsedThisTurn === "boolean";
    if (!Number.isFinite(Number(r.value)) || r.value < 0 || r.value > r.max) return false;
    if (r.key === "fate") return r.max === 3 && typeof r.lastCategory === "string" && Number.isInteger(r.completionsThisTurn) && r.completionsThisTurn >= 0 && r.completionsThisTurn <= 2;
    if (r.key === "blood") return r.max === 10;
    if (r.key === "longevity") return r.max === 12 && Number.isFinite(Number(r.burned));
    if (r.key === "dragon") return r.max === 7 && Number.isInteger(r.transformedTurns) && r.transformedTurns >= 0 && r.transformedTurns <= 2
      && typeof r.attackGranted === "boolean" && typeof r.armorGranted === "boolean";
    return r.max === 6 && typeof r.armorGainGranted === "boolean" && typeof r.armorBreakGranted === "boolean"
      && typeof r.sacrificeGranted === "boolean" && typeof r.chimeUsed === "boolean";
  }
  function validateState(state) {
    if (!state || state.protocol !== 3 || !state.battleId || !Array.isArray(state.order) || state.order.length !== 2 || state.order[0] === state.order[1]) return false;
    if (!state.players || !state.players[state.order[0]] || !state.players[state.order[1]]) return false;
    if (["random", "private", "bot"].indexOf(state.mode) < 0 || ["active", "finished"].indexOf(state.status) < 0 || state.rewardEligible !== false) return false;
    if (!Number.isInteger(Number(state.revision)) || state.revision < 0 || !Number.isInteger(Number(state.round)) || state.round < 1) return false;
    if (!Number.isFinite(Number(state.turnDeadline)) || !Number.isInteger(Number(state.turnActionCount)) || !state.idleTimeouts) return false;
    if (state.status === "active" && (state.order.indexOf(state.activePlayerId) < 0 || state.winnerId || state.reason)) return false;
    if (state.status === "finished" && (state.activePlayerId !== "" || state.order.indexOf(state.winnerId) < 0 || ["hp", "fatefire", "lifespan", "timeout", "leave", "disconnect"].indexOf(state.reason) < 0)) return false;
    var playersValid = state.order.every(function (id) {
      var p = state.players[id];
      if (!p || !HERO_SPECIALS[p.heroId] || typeof p.name !== "string" || !p.name || p.name.length > 16 || typeof p.pathName !== "string") return false;
      if (![p.hp, p.maxHp, p.armor, p.poison, p.weaken, p.energy, p.maxEnergy, p.nextTurnArmor].every(function (v) { return Number.isFinite(Number(v)); })) return false;
      if (p.hp < 0 || p.maxHp !== 100 || p.hp > 100 || p.armor < 0 || p.armor > 40 || p.poison < 0 || p.poison > 20 || p.weaken < 0 || p.weaken > 6 || p.energy < 0 || p.energy > 10 || p.maxEnergy !== 3 || typeof p.breakEchoArmed !== "boolean") return false;
      if (p.nextTurnArmor < 0 || p.nextTurnArmor > 40 || !Number.isInteger(p.cardsPlayedThisTurn) || p.cardsPlayedThisTurn < 0 || !Number.isInteger(p.turnsTaken) || p.turnsTaken < 0 || typeof p.wasDamagedThisTurn !== "boolean" || typeof p.freeDrawUsed !== "boolean" || !validResource(p)) return false;
      if (![p.draw, p.hand, p.discard].every(Array.isArray) || p.commons.length !== 6) return false;
      if (!normalizeCommons(p.commons).every(function (key, i) { return key === p.commons[i]; })) return false;
      return p.draw.concat(p.hand, p.discard).every(function (key) { return !!CARDS[key]; });
    });
    if (!playersValid) return false;
    if (state.status === "active") return state.order.every(function (id) { var p = state.players[id]; return p.hp > 0 && (p.resource.key !== "longevity" || p.resource.value > 0); });
    var loserId = otherId(state, state.winnerId), loser = state.players[loserId];
    if (state.reason === "hp" || state.reason === "fatefire") return loser.hp === 0;
    if (state.reason === "lifespan") return loser.resource.key === "longevity" && loser.resource.value === 0;
    if (state.reason === "timeout") return Number(state.idleTimeouts[loserId]) >= 2;
    return true;
  }
  function lifeDamageBonus(player) {
    if (player.resource.key !== "longevity") return 0;
    var ratio = player.resource.value / player.resource.max;
    return ratio <= .25 ? 6 : ratio <= .5 ? 4 : ratio < 1 ? 2 : 0;
  }
  function cardPlayableReason(player, card) {
    if (!player || !card) return "未知蛊牌";
    if (player.energy < card.cost) return "真元不足";
    if (card.lifespanCost && (player.resource.key !== "longevity" || player.resource.value < card.lifespanCost)) return "寿元不足";
    if (card.scaleCost && player.resource.key === "dragon" && player.resource.transformedTurns <= 0 && player.resource.value < card.scaleCost) return "龙鳞不足";
    return "";
  }
  function resolveFate(player, card, state, drawnRef) {
    var r = player.resource, gained = Math.max(0, Number(card.fateGain) || 0), changed = r.lastCategory && r.lastCategory !== card.category;
    if (changed) gained += 1;
    r.lastCategory = card.category;
    if (gained > 0) r.value = Math.min(r.max, r.value + gained);
    if (r.value >= 3 && r.completionsThisTurn < 2) {
      r.value -= 3; r.completionsThisTurn += 1; player.energy = Math.min(10, player.energy + 1); drawnRef.value += drawCards(player, 1);
      appendEvent(state, player.name + "命势圆满，真元 +1 并抽 1 张牌。"); return true;
    }
    return false;
  }
  function applyAbility(state, actorId, action) {
    var self = state.players[actorId], enemyId = otherId(state, actorId), enemy = state.players[enemyId], r = self.resource, mechanic = "", directDamage = 0;
    if (action.ability === "dragonTransform") {
      if (r.key !== "dragon" || r.value < 7 || r.transformedTurns > 0) return { ok: false, error: "尚不能龙化" };
      r.value = 0; r.transformedTurns = 2; self.energy = Math.min(10, self.energy + 1); mechanic = "dragonTransform";
      appendEvent(state, self.name + "七鳞归骨，主动龙化两回合。");
    } else if (action.ability === "boneSoul" || action.ability === "boneFate") {
      if (r.key !== "bone" || r.value < 3 || r.chimeUsed) return { ok: false, error: "尚不能叩铃" };
      r.value -= 3; r.chimeUsed = true;
      if (action.ability === "boneSoul") {
        var soulArmorBefore = self.armor; self.armor = Math.min(40, self.armor + 10); directDamage = self.armor - soulArmorBefore; mechanic = "boneSoul";
        appendEvent(state, self.name + "叩铃·镇魂，获得 " + directDamage + " 防御。");
      }
      else {
        if (self.armor <= 0) return { ok: false, error: "没有可碎防御" };
        var sacrificed = Math.min(8, self.armor); self.armor -= sacrificed; directDamage = 6 + sacrificed; dealDamage(enemy, directDamage, true); mechanic = "boneFate";
        appendEvent(state, self.name + "叩铃·断命，碎甲直伤 " + directDamage + "。");
      }
    } else return { ok: false, error: "未知本命主动" };
    state.revision += 1; state.turnActionCount += 1;
    state.lastAction = { revision: state.revision, actorId: actorId, targetId: enemyId, damage: mechanic === "boneFate" ? directDamage : 0,
      blocked: 0, heal: 0, poison: 0, armor: mechanic === "boneSoul" ? directDamage : 0, draw: 0, energyGain: mechanic === "dragonTransform" ? 1 : 0, cleanse: 0, selfDamage: 0, mechanic: mechanic };
    if (enemy.hp <= 0) finish(state, actorId, "hp");
    return { ok: true, state: state };
  }
  function applyAction(input, actorId, action) {
    if (!validateState(input)) return { ok: false, error: "战斗状态无效" };
    if (input.status !== "active") return { ok: false, error: "蛊斗已经结束" };
    actorId = String(actorId || ""); if (actorId !== String(input.activePlayerId)) return { ok: false, error: "尚未轮到该玩家" };
    action = action || {};
    var state = clone(input), self = state.players[actorId], enemyId = otherId(state, actorId), enemy = state.players[enemyId];
    if (action.type === "end") {
      state.revision += 1;
      if (action.timeout && state.turnActionCount === 0) state.idleTimeouts[actorId] += 1; else state.idleTimeouts[actorId] = 0;
      if (state.idleTimeouts[actorId] >= 2) { finish(state, enemyId, "timeout"); return { ok: true, state: state }; }
      if (self.resource.key === "dragon" && self.resource.transformedTurns > 0) self.resource.transformedTurns -= 1;
      var next = enemyId; if (next === state.order[0]) state.round += 1;
      state.activePlayerId = next; state.turnActionCount = 0; state.turnDeadline = Math.max(0, Number(action.at) || state.turnDeadline) + 45000;
      appendEvent(state, self.name + "收蛊，回合交替。"); startTurn(state, next); return { ok: true, state: state };
    }
    if (action.type === "draw") {
      if (self.hand.length) return { ok: false, error: "手中尚有蛊牌" };
      if (self.energy < 1) return { ok: false, error: "真元不足" };
      if (self.freeDrawUsed) return { ok: false, error: "本回合已经引蛊" };
      if (!self.draw.length && !self.discard.length) return { ok: false, error: "蛊囊暂时无牌可引" };
      self.energy -= 1; self.freeDrawUsed = true;
      var emptyHandDrawn = drawCards(self, 1);
      state.revision += 1; state.turnActionCount += 1;
      state.lastAction = { revision: state.revision, actorId: actorId, targetId: actorId, damage: 0, blocked: 0, heal: 0,
        poison: 0, armor: 0, draw: emptyHandDrawn, energyGain: 0, cleanse: 0, selfDamage: 0, mechanic: "emptyHandDraw" };
      appendEvent(state, self.name + "耗 1 真元余元引蛊，抽取 1 张牌。");
      return { ok: true, state: state };
    }
    if (action.type === "ability") return applyAbility(state, actorId, action);
    if (action.type !== "play") return { ok: false, error: "未知行动" };
    var handIndex = Number(action.handIndex);
    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= self.hand.length) return { ok: false, error: "蛊牌位置无效" };
    var key = self.hand[handIndex], card = CARDS[key]; if (!card) return { ok: false, error: "未知蛊牌" };
    var unplayable = cardPlayableReason(self, card); if (unplayable) return { ok: false, error: unplayable };
    var before = { selfHp: self.hp, selfArmor: self.armor, selfPoison: self.poison, enemyHp: enemy.hp, enemyArmor: enemy.armor, enemyPoison: enemy.poison };
    var previousCategory = self.resource.key === "fate" ? self.resource.lastCategory : "", bloodSpent = 0, lifespanSpent = 0, armorSacrificed = 0, mechanic = "";
    self.energy -= card.cost; self.hand.splice(handIndex, 1); self.discard.push(key);
    if (card.selfDamage) {
      self.hp = Math.max(card.nonlethal ? 1 : 0, self.hp - card.selfDamage);
      if (before.selfHp - self.hp > 0) self.wasDamagedThisTurn = true;
    }
    if (card.lifespanCost) { lifespanSpent = Math.min(self.resource.value, card.lifespanCost); self.resource.value -= lifespanSpent; self.resource.burned += lifespanSpent; }
    if (card.scaleCost && self.resource.key === "dragon" && self.resource.transformedTurns <= 0) self.resource.value -= card.scaleCost;
    if (card.armorSacrifice) { armorSacrificed = Math.min(self.armor, card.armorSacrifice); self.armor -= armorSacrificed; }
    if (card.bloodSpend && self.resource.key === "blood") { bloodSpent = Math.min(self.resource.value, card.bloodSpend); self.resource.value -= bloodSpent; }
    var damage = Math.max(0, Number(card.damage) || 0);
    if (card.bloodScale && self.resource.key === "blood") damage += self.resource.value * card.bloodScale;
    if (card.bloodPerSpent) damage += bloodSpent * card.bloodPerSpent;
    if (card.burnDamage) damage += lifespanSpent * card.burnDamage;
    if (card.sacrificeDamage) damage += armorSacrificed * card.sacrificeDamage;
    if (card.fateThreshold && self.resource.key === "fate" && self.resource.value >= card.fateThreshold) damage += card.fateBonusDamage || 0;
    if (card.poisonThreshold && enemy.poison >= card.poisonThreshold) damage += card.poisonBonusDamage || 0;
    if (card.comboDamage && self.cardsPlayedThisTurn > 0) { damage += card.comboDamage; mechanic = mechanic || "combo"; }
    if (card.enemyArmorDamage && before.enemyArmor > 0) { damage += card.enemyArmorDamage; mechanic = mechanic || "armorBreak"; }
    if (self.resource.key === "longevity" && card.category === "attack") damage += lifeDamageBonus(self);
    if (self.resource.key === "dragon" && self.resource.transformedTurns > 0 && card.category === "attack") damage += 2 + (card.transformedBonusDamage || 0);
    if (card.category === "attack" && self.weaken > 0) damage = Math.max(0, damage - self.weaken);
    var hit = damage > 0 ? dealDamage(enemy, damage, false) : { blocked: 0, life: 0 };
    noteBoneBreak(enemy, before.enemyArmor);
    if (before.enemyArmor > 0 && enemy.armor === 0 && enemy.breakEchoArmed) {
      enemy.breakEchoArmed = false;
      dealDamage(self, CARDS.afterEcho.breakEcho, true);
      drawCards(enemy, CARDS.afterEcho.drawOnBreak);
      appendEvent(state, enemy.name + "余响反震，直伤 " + CARDS.afterEcho.breakEcho + " 并抽 " + CARDS.afterEcho.drawOnBreak + " 张牌。");
    }
    if (self.hp <= 0) {
      self.wasDamagedThisTurn = true;
      self.cardsPlayedThisTurn += 1;
      state.revision += 1; state.turnActionCount += 1;
      state.lastAction = { revision: state.revision, cardKey: key, actorId: actorId, targetId: enemyId,
        damage: Math.max(0, before.enemyHp - enemy.hp), blocked: Math.max(0, before.enemyArmor - enemy.armor), heal: 0,
        poison: 0, armor: 0, armorBroken: before.enemyArmor > 0 && enemy.armor === 0, draw: 0, energyGain: 0,
        cleanse: 0, selfDamage: Math.max(0, before.selfHp - self.hp), mechanic: "afterEcho" };
      appendEvent(state, self.name + "催动" + card.name + "，却被余响反震殒命。");
      finish(state, enemyId, "hp");
      return { ok: true, state: state };
    }
    var poisonAdded = 0;
    if (card.poison) {
      var alreadyPoisoned = enemy.poison > 0;
      poisonAdded = Math.min(card.poison, 20 - enemy.poison); enemy.poison += poisonAdded;
      if (self.resource.key === "poison" && alreadyPoisoned && !self.resource.corrosionUsedThisTurn) {
        self.resource.corrosionUsedThisTurn = true; dealDamage(enemy, 2, false); mechanic = "poisonCorrosion";
      }
    }
    var armorGain = Math.max(0, Number(card.armor) || 0);
    if (card.hurtArmor && self.wasDamagedThisTurn) armorGain += card.hurtArmor;
    if (card.enemyArmorBonus && before.enemyArmor > 0) armorGain += card.enemyArmorBonus;
    if (card.lowHandArmor && self.hand.length <= 3) armorGain += card.lowHandArmor;
    if (card.categoryShiftArmor && previousCategory && previousCategory !== "armor") armorGain += card.categoryShiftArmor;
    if (card.resonanceArmor && self.resource.key === "bone") armorGain += self.resource.value * card.resonanceArmor;
    if (self.resource.key === "dragon" && self.resource.transformedTurns > 0 && card.category === "armor") armorGain += 2;
    var armorBeforeGain = self.armor; self.armor = Math.min(40, self.armor + armorGain); armorGain = self.armor - armorBeforeGain;
    if (card.cleanse) self.poison = Math.max(0, self.poison - card.cleanse);
    if (card.weaken) enemy.weaken = Math.min(3, enemy.weaken + card.weaken);
    if (card.breakEcho) self.breakEchoArmed = true;
    if (card.heal) self.hp = Math.min(self.maxHp, self.hp + card.heal);
    if (card.energy) self.energy = Math.min(10, self.energy + card.energy);
    if (card.nextTurnArmor) self.nextTurnArmor = Math.min(40, self.nextTurnArmor + card.nextTurnArmor);
    if (card.lifespanGain && self.resource.key === "longevity") self.resource.value = Math.min(self.resource.max, self.resource.value + card.lifespanGain);
    if (card.bloodGain && self.resource.key === "blood") gainResource(self, card.bloodGain);
    if (card.scaleGain && self.resource.key === "dragon" && self.resource.transformedTurns <= 0) gainResource(self, card.scaleGain);
    var drawn = drawCards(self, Math.max(0, Number(card.draw) || 0) + (card.drawIfEnemyPoisoned && enemy.poison > 0 ? card.drawIfEnemyPoisoned : 0));
    if (self.resource.key === "dragon" && self.resource.transformedTurns <= 0) {
      if (card.category === "attack" && hit.blocked + hit.life > 0 && !self.resource.attackGranted) { self.resource.attackGranted = true; gainResource(self, 1); mechanic = mechanic || "dragonScale"; }
      if (card.category === "armor" && armorGain > 0 && !self.resource.armorGranted) { self.resource.armorGranted = true; gainResource(self, 1); mechanic = mechanic || "dragonScale"; }
    }
    if (self.resource.key === "bone") {
      if (card.category === "armor" && armorGain > 0 && !self.resource.armorGainGranted) { self.resource.armorGainGranted = true; gainResource(self, 1); mechanic = mechanic || "boneResonance"; }
      if (armorSacrificed >= 4 && !self.resource.sacrificeGranted) { self.resource.sacrificeGranted = true; gainResource(self, 1); mechanic = mechanic || "boneResonance"; }
    }
    var drawnRef = { value: drawn };
    if (self.resource.key === "fate" && resolveFate(self, card, state, drawnRef)) mechanic = "fateFulfill";
    drawn = drawnRef.value;
    self.cardsPlayedThisTurn += 1;
    state.revision += 1; state.turnActionCount += 1;
    state.lastAction = { revision: state.revision, cardKey: key, actorId: actorId, targetId: enemyId,
      damage: Math.max(0, before.enemyHp - enemy.hp), blocked: Math.max(0, before.enemyArmor - enemy.armor), heal: Math.max(0, self.hp - before.selfHp),
      poison: Math.max(0, enemy.poison - before.enemyPoison), armor: Math.max(0, self.armor - before.selfArmor), armorBroken: before.enemyArmor > 0 && enemy.armor === 0,
      draw: drawn, energyGain: Math.max(0, Number(card.energy) || 0), cleanse: Math.max(0, before.selfPoison - self.poison), selfDamage: Math.max(0, before.selfHp - self.hp), mechanic: mechanic };
    appendEvent(state, self.name + "催动" + card.name + "。");
    if (self.resource.key === "longevity" && self.resource.value <= 0) finish(state, enemyId, "lifespan");
    else if (self.hp <= 0) finish(state, enemyId, "hp"); else if (enemy.hp <= 0) finish(state, actorId, "hp");
    return { ok: true, state: state };
  }
  function forfeit(input, loserId, reason) {
    if (!validateState(input) || input.status !== "active" || !input.players[loserId]) return clone(input);
    var state = clone(input); state.revision += 1; finish(state, otherId(state, loserId), reason || "leave"); return state;
  }
  function acceptSnapshot(current, incoming) {
    if (!validateState(incoming)) return { ok: false, error: "战斗状态无效" };
    if (current && incoming.battleId !== current.battleId) return { ok: false, error: "战斗标识不一致" };
    if (current && Number(incoming.revision) <= Number(current.revision)) return { ok: false, error: "状态版本过旧" };
    return { ok: true, state: clone(incoming) };
  }
  global.NmgOnlineBattleCore = Object.freeze({ cards: CARDS, heroNames: HERO_NAMES, commonKeys: COMMON_KEYS,
    heroSpecialKeys: heroSpecialKeys, draftPool: draftPool, createBattle: createBattle, validateState: validateState,
    cardPlayableReason: cardPlayableReason, applyAction: applyAction, forfeit: forfeit, acceptSnapshot: acceptSnapshot });
})(typeof window !== "undefined" ? window : this);
