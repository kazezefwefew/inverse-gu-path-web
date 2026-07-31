"use strict";
/* 蛊斗场 PvP 纯规则：无内部可变状态；真实快照由 game.online 持有。 */
(function createOnlineBattleCore(global) {
  var CARDS = Object.freeze({
    strike: Object.freeze({ name: "裂甲蛊", cost: 1, damage: 8, text: "造成 8 伤害。" }),
    guard: Object.freeze({ name: "铜皮蛊", cost: 1, armor: 7, text: "获得 7 防御。" }),
    insight: Object.freeze({ name: "回息蛊", cost: 0, draw: 1, text: "抽 1 张牌。" }),
    devour: Object.freeze({ name: "群噬蛊", cost: 1, damage: 5, heal: 2, text: "造成 5 伤害，回复 2 生命。" }),
    molt: Object.freeze({ name: "蜕骨蛊", cost: 1, armor: 4, draw: 1, text: "获得 4 防御，抽 1 张牌。" }),
    gather: Object.freeze({ name: "聚元蛊", cost: 0, energy: 1, text: "获得 1 真元。" }),
    cleanse: Object.freeze({ name: "净瘴蛊", cost: 1, armor: 3, cleanse: 3, text: "获得 3 防御，移除 3 蚀毒。" }),
    redFang: Object.freeze({ name: "赤牙蛊", cost: 1, selfDamage: 1, damage: 9, text: "失去 1 生命，造成 9 伤害。" }),
    spore: Object.freeze({ name: "瘴孢蛊", cost: 1, poison: 2, text: "施加 2 蚀毒。" }),
    carapace: Object.freeze({ name: "玄甲蛊", cost: 2, armor: 13, text: "获得 13 防御。" }),
    spring: Object.freeze({ name: "回春蛊", cost: 2, heal: 7, draw: 1, text: "回复 7 生命，抽 1 张牌。" }),
    pierce: Object.freeze({ name: "穿心蛊", cost: 2, damage: 15, text: "造成 15 伤害。" }),
    echo: Object.freeze({ name: "回声蛊", cost: 1, draw: 2, text: "抽 2 张牌。" }),
    siphon: Object.freeze({ name: "夺元蛊", cost: 1, damage: 4, energy: 1, text: "造成 4 伤害，获得 1 真元。" }),
    ward: Object.freeze({ name: "避劫蛊", cost: 1, armor: 5, cleanse: 2, text: "获得 5 防御，移除 2 蚀毒。" }),
    leech: Object.freeze({ name: "血吸蛊", cost: 2, damage: 8, heal: 5, text: "造成 8 伤害，回复 5 生命。" }),
    fateSeal: Object.freeze({ name: "逆命签", cost: 1, damage: 5, draw: 1, text: "造成 5 伤害，抽 1 张牌。" }),
    bloodEdge: Object.freeze({ name: "血刃蛊", cost: 1, selfDamage: 2, damage: 12, text: "失去 2 生命，造成 12 伤害。" }),
    poisonFang: Object.freeze({ name: "青瘴蛊", cost: 1, damage: 4, poison: 3, text: "造成 4 伤害，施加 3 蚀毒。" }),
    longBreath: Object.freeze({ name: "长息蛊", cost: 1, armor: 4, heal: 3, text: "获得 4 防御，回复 3 生命。" }),
    dragonScale: Object.freeze({ name: "龙鳞蛊", cost: 1, armor: 5, armorDamage: 5, text: "获得 5 防御；若已有防御，再造成 5 伤害。" }),
    boneBell: Object.freeze({ name: "骨铃蛊", cost: 1, armor: 8, text: "获得 8 防御。" })
  });
  var HERO_SPECIAL = Object.freeze({
    fate: "fateSeal", blood: "bloodEdge", poison: "poisonFang",
    longevity: "longBreath", dragon: "dragonScale", bone: "boneBell"
  });
  var HERO_NAMES = Object.freeze({ fate: "命蛊客", blood: "血蛊客", poison: "毒蛊客", longevity: "寿蛊客", dragon: "龙蛊客", bone: "骨蛊客" });
  var COMMON_KEYS = Object.freeze(["strike", "guard", "insight", "devour", "molt", "gather", "cleanse", "redFang", "spore", "carapace", "spring", "pierce", "echo", "siphon", "ward", "leech"]);
  var PASSIVE_MAX = 3;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function cleanId(value, fallback) { var text = String(value || "").trim().slice(0, 96); return text || fallback; }
  function seedHash(value) {
    var h = 2166136261 >>> 0;
    String(value || "0").split("").forEach(function (char) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; });
    return h || 1;
  }
  function shuffled(list, seed) {
    var result = list.slice(); var x = seedHash(seed);
    for (var i = result.length - 1; i > 0; i -= 1) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      var j = x % (i + 1); var hold = result[i]; result[i] = result[j]; result[j] = hold;
    }
    return result;
  }
  function normalizeCommons(value) {
    var chosen = Array.isArray(value) ? value.filter(function (key, index, list) { return COMMON_KEYS.indexOf(key) >= 0 && list.indexOf(key) === index; }) : [];
    return (chosen.length === 6 ? chosen : ["strike", "guard", "insight", "molt", "devour", "cleanse"]).slice(0, 6);
  }
  function createDeck(heroId, seed, commons) {
    var special = HERO_SPECIAL[heroId] || HERO_SPECIAL.fate;
    var deck = [];
    normalizeCommons(commons).forEach(function (key) { deck.push(key, key); });
    deck.push(special, special, special);
    return shuffled(deck, seed);
  }
  function drawOne(player) {
    if (!player.draw.length && player.discard.length) {
      player.draw = player.discard.slice().reverse();
      player.discard = [];
    }
    if (player.draw.length) { player.hand.push(player.draw.shift()); return true; }
    return false;
  }
  function drawTo(player, count) { while (player.hand.length < count && (player.draw.length || player.discard.length)) drawOne(player); }
  function appendEvent(state, text) { state.events = (state.events || []).concat(String(text)).slice(-6); }
  function otherId(state, id) { return state.order[0] === id ? state.order[1] : state.order[0]; }
  function dealDamage(player, amount) {
    var incoming = Math.max(0, Number(amount) || 0);
    var blocked = Math.min(player.armor, incoming);
    player.armor -= blocked;
    player.hp = Math.max(0, player.hp - (incoming - blocked));
    return { blocked: blocked, life: incoming - blocked };
  }
  function createPassive(heroId) {
    return { key: heroId, stacks: 0, max: PASSIVE_MAX, charged: false, last: -1, pending: 0 };
  }
  function gainPassive(player, amount) {
    var passive = player.passive;
    if (!passive || passive.charged) return false;
    passive.stacks = Math.min(passive.max, passive.stacks + Math.max(0, Number(amount) || 0));
    if (passive.stacks >= passive.max) passive.charged = true;
    return passive.charged;
  }
  function consumeDamagePassive(player) {
    var passive = player.passive;
    if (!passive || !passive.charged || ["fate", "blood", "dragon"].indexOf(passive.key) < 0) return 0;
    passive.stacks = 0; passive.charged = false;
    return 4;
  }
  function noteBoneBlock(player, blocked) {
    if (!player.passive || player.passive.key !== "bone" || blocked <= 0 || player.passive.pending) return false;
    if (gainPassive(player, 1)) player.passive.pending = 1;
    return player.passive.pending === 1;
  }
  function finish(state, winnerId, reason) {
    state.status = "finished";
    state.winnerId = winnerId;
    state.reason = reason || "hp";
    state.activePlayerId = "";
    appendEvent(state, (state.players[winnerId]?.name || "一方") + "蛊势压境，胜负已分。");
  }
  function startTurn(state, id) {
    var player = state.players[id];
    if (player.passive && player.passive.key === "bone" && player.passive.pending) {
      player.passive.pending = 0; player.passive.stacks = 0; player.passive.charged = false;
      player.energy = Math.min(8, player.maxEnergy + 1);
      appendEvent(state, player.name + "的骨鸣回响，额外获得 1 真元。");
    } else player.energy = player.maxEnergy;
    if (player.poison > 0) {
      var poison = player.poison;
      player.poison = Math.max(0, poison - 1);
      var poisonHit = dealDamage(player, poison);
      noteBoneBlock(player, poisonHit.blocked);
      appendEvent(state, player.name + "蚀毒发作，承受 " + poison + " 点伤害。");
      if (player.hp <= 0) { finish(state, otherId(state, id), "hp"); return; }
    }
    var draws = Math.min(2, Math.max(0, 8 - player.hand.length));
    var drawn = 0;
    for (var index = 0; index < draws; index += 1) if (drawOne(player)) drawn += 1;
    if (player.passive && player.passive.key === "fate") gainPassive(player, drawn);
  }
  function createBattle(options) {
    options = options || {};
    var ids = Array.isArray(options.playerIds) ? options.playerIds : [];
    var first = cleanId(ids[0], "player-1");
    var second = cleanId(ids[1], "player-2");
    if (second === first) second = first + "-2";
    var seed = seedHash(options.seed || options.battleId || Date.now());
    var heroes = options.heroes || {};
    var order = shuffled([first, second], seed).slice(0, 2);
    var players = {}; var loadouts = options.loadouts || {}; var names = options.names || {};
    order.forEach(function (id, index) {
      var heroId = HERO_SPECIAL[heroes[id]] ? heroes[id] : "fate";
      var commons = normalizeCommons(loadouts[id]);
      players[id] = {
        heroId: heroId, name: cleanId(names[id], "求命者").replace(/[<>]/g, "").slice(0, 16), pathName: HERO_NAMES[heroId], hp: 100, maxHp: 100, armor: index === 1 ? 3 : 0, poison: 0,
        energy: 3, maxEnergy: 3, passive: createPassive(heroId), commons: commons, draw: createDeck(heroId, seed + index * 997, commons), hand: [], discard: []
      };
      drawTo(players[id], index === 1 ? 6 : 5);
    });
    var mode = options.mode === "private" ? "private" : "random";
    var startedAt = Math.max(0, Number(options.now) || Date.now());
    var idleTimeouts = {}; order.forEach(function (id) { idleTimeouts[id] = 0; });
    return {
      protocol: 2, battleId: cleanId(options.battleId, "online-duel"), revision: 0,
      mode: mode, rewardEligible: mode === "random", status: "active", reason: "", winnerId: "",
      round: 1, activePlayerId: order[0], order: order, players: players,
      turnDeadline: startedAt + 45000, turnActionCount: 0, idleTimeouts: idleTimeouts,
      lastAction: null,
      events: [players[order[0]].name + "执先手；" + players[order[1]].name + "得后发蛊印（起手 +1、护势 +3）。"]
    };
  }
  function validateState(state) {
    if (!state || state.protocol !== 2 || !state.battleId || !Array.isArray(state.order) || state.order.length !== 2) return false;
    if (!state.players || !state.players[state.order[0]] || !state.players[state.order[1]]) return false;
    if (["random", "private"].indexOf(state.mode) < 0 || ["active", "finished"].indexOf(state.status) < 0) return false;
    if (state.rewardEligible !== (state.mode === "random")) return false;
    if (!Number.isInteger(Number(state.revision)) || Number(state.revision) < 0 || !Number.isInteger(Number(state.round)) || Number(state.round) < 1) return false;
    if (!Number.isFinite(Number(state.turnDeadline)) || Number(state.turnDeadline) < 0 || !Number.isInteger(Number(state.turnActionCount)) || Number(state.turnActionCount) < 0) return false;
    if (!state.idleTimeouts || state.order.some(function (id) { return !Number.isInteger(Number(state.idleTimeouts[id])) || Number(state.idleTimeouts[id]) < 0; })) return false;
    if (state.status === "active" && state.order.indexOf(state.activePlayerId) < 0) return false;
    return state.order.every(function (id) {
      var player = state.players[id];
      if (!player || !HERO_SPECIAL[player.heroId] || typeof player.name !== "string" || !player.name || player.name.length > 16 || typeof player.pathName !== "string") return false;
      if (![player.hp, player.maxHp, player.armor, player.poison, player.energy, player.maxEnergy].every(function (value) { return Number.isFinite(Number(value)); })) return false;
      if (player.hp < 0 || player.maxHp !== 100 || player.hp > player.maxHp || player.armor < 0 || player.armor > 30 || player.poison < 0 || player.poison > 12 || player.energy < 0 || player.energy > 8 || player.maxEnergy !== 3) return false;
      if (![player.draw, player.hand, player.discard].every(Array.isArray)) return false;
      if (!player.passive || player.passive.key !== player.heroId || player.passive.max !== PASSIVE_MAX
        || !Number.isInteger(player.passive.stacks) || player.passive.stacks < 0 || player.passive.stacks > PASSIVE_MAX
        || typeof player.passive.charged !== "boolean" || !Number.isInteger(player.passive.last)
        || !Number.isInteger(player.passive.pending) || player.passive.pending < 0 || player.passive.pending > 1) return false;
      if (!normalizeCommons(player.commons).every(function (key, index) { return key === player.commons[index]; }) || player.commons.length !== 6) return false;
      return player.draw.concat(player.hand, player.discard).every(function (key) { return !!CARDS[key]; });
    });
  }
  function applyAction(input, actorId, action) {
    if (!validateState(input)) return { ok: false, error: "战斗状态无效" };
    if (input.status !== "active") return { ok: false, error: "蛊斗已经结束" };
    actorId = String(actorId || "");
    if (actorId !== String(input.activePlayerId)) return { ok: false, error: "尚未轮到该玩家" };
    action = action || {};
    var state = clone(input); var self = state.players[actorId]; var enemyId = otherId(state, actorId); var enemy = state.players[enemyId];
    if (action.type === "end") {
      state.revision += 1;
      if (action.timeout && state.turnActionCount === 0) state.idleTimeouts[actorId] += 1;
      else state.idleTimeouts[actorId] = 0;
      if (state.idleTimeouts[actorId] >= 2) { finish(state, enemyId, "timeout"); return { ok: true, state: state }; }
      var next = enemyId;
      if (next === state.order[0]) state.round += 1;
      state.activePlayerId = next;
      state.turnActionCount = 0;
      state.turnDeadline = Math.max(0, Number(action.at) || Math.max(0, Number(state.turnDeadline) - 45000)) + 45000;
      appendEvent(state, self.name + "收蛊，回合交替。");
      startTurn(state, next);
      return { ok: true, state: state };
    }
    if (action.type !== "play") return { ok: false, error: "未知行动" };
    var index = Number(action.handIndex);
    if (!Number.isInteger(index) || index < 0 || index >= self.hand.length) return { ok: false, error: "蛊牌位置无效" };
    var key = self.hand[index]; var card = CARDS[key];
    if (!card) return { ok: false, error: "未知蛊牌" };
    if (self.energy < card.cost) return { ok: false, error: "真元不足" };
    var hadArmor = self.armor > 0;
    var before = { selfHp: self.hp, selfArmor: self.armor, selfPoison: self.poison, enemyHp: enemy.hp, enemyArmor: enemy.armor, enemyPoison: enemy.poison };
    var passiveTriggered = "";
    var damageBoost = (card.damage || (card.armorDamage && hadArmor)) ? consumeDamagePassive(self) : 0;
    if (damageBoost) passiveTriggered = self.passive.key;
    self.energy -= card.cost;
    self.hand.splice(index, 1); self.discard.push(key);
    if (card.selfDamage) {
      var selfHit = dealDamage(self, card.selfDamage);
      noteBoneBlock(self, selfHit.blocked);
      if (self.passive.key === "blood" && gainPassive(self, 1)) passiveTriggered = passiveTriggered || "blood";
    }
    var hit = { blocked: 0, life: 0 };
    if (card.damage) hit = dealDamage(enemy, card.damage + damageBoost);
    if (card.armorDamage && hadArmor) {
      var armorHit = dealDamage(enemy, card.armorDamage + damageBoost);
      hit.blocked += armorHit.blocked; hit.life += armorHit.life;
    }
    if (hit.blocked > 0 && noteBoneBlock(enemy, hit.blocked)) passiveTriggered = passiveTriggered || "bone";
    if (card.poison) {
      var poisonBonus = self.passive.key === "poison" && self.passive.charged ? 2 : 0;
      if (poisonBonus) { self.passive.stacks = 0; self.passive.charged = false; passiveTriggered = passiveTriggered || "poison"; }
      enemy.poison = Math.min(12, enemy.poison + card.poison + poisonBonus);
      if (self.passive.key === "poison" && gainPassive(self, 1)) passiveTriggered = passiveTriggered || "poison";
    }
    if (card.armor) self.armor = Math.min(30, self.armor + card.armor);
    if (card.energy) self.energy = Math.min(8, self.energy + card.energy);
    if (card.cleanse) self.poison = Math.max(0, self.poison - card.cleanse);
    if (card.heal) {
      self.hp = Math.min(self.maxHp, self.hp + card.heal);
      if (self.hp > before.selfHp && self.passive.key === "longevity" && self.passive.last !== state.round) {
        self.passive.last = state.round;
        if (gainPassive(self, 1)) { self.armor = Math.min(30, self.armor + 5); passiveTriggered = passiveTriggered || "longevity"; self.passive.stacks = 0; self.passive.charged = false; }
      }
    }
    if (card.armor && hadArmor && self.passive.key === "dragon" && self.passive.last !== state.round) {
      self.passive.last = state.round;
      if (gainPassive(self, 1)) passiveTriggered = passiveTriggered || "dragon";
    }
    var drawnNow = 0;
    if (card.draw) for (var d = 0; d < card.draw; d += 1) if (drawOne(self)) drawnNow += 1;
    if (drawnNow && self.passive.key === "fate" && gainPassive(self, drawnNow)) passiveTriggered = passiveTriggered || "fate";
    state.revision += 1;
    state.turnActionCount += 1;
    state.lastAction = {
      revision: state.revision, cardKey: key, actorId: actorId, targetId: enemyId,
      damage: Math.max(0, before.enemyHp - enemy.hp), blocked: Math.max(0, before.enemyArmor - enemy.armor),
      heal: Math.max(0, self.hp - before.selfHp), poison: Math.max(0, enemy.poison - before.enemyPoison),
      armor: Math.max(0, self.armor - before.selfArmor), armorBroken: before.enemyArmor > 0 && enemy.armor === 0,
      draw: drawnNow, energyGain: Math.max(0, Number(card.energy) || 0), cleanse: Math.max(0, before.selfPoison - self.poison),
      selfDamage: Math.max(0, before.selfHp - self.hp), passive: passiveTriggered
    };
    appendEvent(state, self.name + "催动" + card.name + "。");
    if (self.hp <= 0) finish(state, enemyId, "hp");
    else if (enemy.hp <= 0) finish(state, actorId, "hp");
    return { ok: true, state: state };
  }
  function forfeit(input, loserId, reason) {
    if (!validateState(input) || input.status !== "active" || !input.players[loserId]) return clone(input);
    var state = clone(input);
    state.revision += 1;
    finish(state, otherId(state, loserId), reason || "leave");
    return state;
  }
  function acceptSnapshot(current, incoming) {
    if (!validateState(incoming)) return { ok: false, error: "战斗状态无效" };
    if (current && incoming.battleId !== current.battleId) return { ok: false, error: "战斗标识不一致" };
    if (current && Number(incoming.revision) <= Number(current.revision)) return { ok: false, error: "状态版本过旧" };
    return { ok: true, state: clone(incoming) };
  }
  global.NmgOnlineBattleCore = Object.freeze({
    cards: CARDS, heroNames: HERO_NAMES, commonKeys: COMMON_KEYS,
    draftPool: function (seed) { return shuffled(COMMON_KEYS, seed).slice(0, 12); },
    createBattle: createBattle, validateState: validateState,
    applyAction: applyAction, forfeit: forfeit, acceptSnapshot: acceptSnapshot
  });
})(typeof window !== "undefined" ? window : this);
