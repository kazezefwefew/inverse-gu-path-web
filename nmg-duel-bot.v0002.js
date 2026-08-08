"use strict";
/* 守擂傀儡只通过联机纯规则选择合法行动。它读取自身手牌与双方公开数值，
 * 不读取对手手牌，也不按未来抽牌内容估值；每次实际行动后必须重新决策。 */
(function createDuelBot(global) {
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function hashSeed(value) {
    var hash = 2166136261 >>> 0;
    String(value || "0").split("").forEach(function (char) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; });
    return hash || 1;
  }
  function shuffled(list, seed) {
    var result = list.slice(), value = hashSeed(seed);
    for (var index = result.length - 1; index > 0; index -= 1) {
      value ^= value << 13; value ^= value >>> 17; value ^= value << 5; value >>>= 0;
      var target = value % (index + 1), held = result[index]; result[index] = result[target]; result[target] = held;
    }
    return result;
  }
  function chooseLoadout(seed) {
    var core = global.NmgOnlineBattleCore;
    if (!core) return { heroId: "fate", commons: [] };
    var heroes = Object.keys(core.heroNames), heroId = heroes[hashSeed(seed) % heroes.length];
    var commons = ["attack", "armor", "utility"].flatMap(function (category) {
      return shuffled(core.commonKeys.filter(function (key) { return core.cards[key].category === category; }), String(seed) + "|" + category).slice(0, 2);
    });
    return { heroId: heroId, commons: commons };
  }
  function resourceValue(player) {
    return player?.resource && Number.isFinite(Number(player.resource.value)) ? Number(player.resource.value) : 0;
  }
  function publicMetrics(state, actorId) {
    var self = state.players[actorId], enemyId = state.order[0] === actorId ? state.order[1] : state.order[0], enemy = state.players[enemyId];
    return {
      selfHp: self.hp, selfArmor: self.armor, selfPoison: self.poison, selfResource: resourceValue(self), selfHand: self.hand.length, selfEnergy: self.energy,
      enemyHp: enemy.hp, enemyArmor: enemy.armor, enemyPoison: enemy.poison, enemyWeaken: enemy.weaken, enemyId: enemyId,
    };
  }
  function scoreOutcome(before, after, actorId, action) {
    var own = after.players[actorId], enemy = after.players[before.enemyId];
    if (after.status === "finished") return after.winnerId === actorId ? 1000000 : -1000000;
    if (action.type === "end") return 0;
    var score = 0;
    score += (before.enemyHp - enemy.hp) * 8;
    score += (before.enemyArmor - enemy.armor) * 2;
    score += (enemy.poison - before.enemyPoison) * 5;
    score += (enemy.weaken - before.enemyWeaken) * 6;
    score += (own.hp - before.selfHp) * 5;
    score += (own.armor - before.selfArmor) * 3;
    var cleansed = before.selfPoison - own.poison;
    score += cleansed * (before.selfHp <= before.selfPoison + 12 ? 25 : 10);
    score += (resourceValue(own) - before.selfResource) * 4;
    score += Math.max(0, own.hand.length - before.selfHand) * 12;
    var lostHp = Math.max(0, before.selfHp - own.hp);
    score -= lostHp * (before.selfHp <= 15 ? 16 : 6);
    if (own.hp <= own.poison && own.poison > 0) score -= 180;
    if (action.type === "ability" && action.ability === "dragonTransform") score += 80;
    if (action.type === "ability" && action.ability === "boneSoul") score += 18;
    if (action.type === "draw") score += 16;
    if (after.lastAction && after.lastAction.actorId === actorId && after.lastAction.mechanic === "fateFulfill") score += 30;
    return score;
  }
  function actionIntent(action, card) {
    if (action.type === "end") return "收势观局";
    if (action.type === "draw") return "余元引蛊";
    if (action.type === "ability") return action.ability === "dragonTransform" ? "七鳞龙化" : action.ability === "boneFate" ? "碎甲断命" : "叩铃镇魂";
    if (card?.cleanse) return "净瘴自保";
    if (card?.heal || card?.armor) return "固守命线";
    if (card?.poison) return "蚀毒逼命";
    return "催蛊压境";
  }
  function legalCandidates(state, actorId) {
    var core = global.NmgOnlineBattleCore, self = state.players[actorId], candidates = [{ action: { type: "end" }, key: "z:end", card: null }];
    self.hand.forEach(function (key, index) {
      var card = core.cards[key];
      if (card && !core.cardPlayableReason(self, card)) candidates.push({ action: { type: "play", handIndex: index }, key: "c:" + key + ":" + index, card: card });
    });
    if (!self.hand.length && self.energy >= 1 && !self.freeDrawUsed && (self.draw.length || self.discard.length)) candidates.push({ action: { type: "draw" }, key: "a:draw", card: null });
    var resource = self.resource || {};
    if (resource.key === "dragon" && resource.value >= 7 && resource.transformedTurns <= 0) candidates.push({ action: { type: "ability", ability: "dragonTransform" }, key: "a:dragon", card: null });
    if (resource.key === "bone" && resource.value >= 3 && !resource.chimeUsed) {
      candidates.push({ action: { type: "ability", ability: "boneSoul" }, key: "a:bone-soul", card: null });
      if (self.armor > 0) candidates.push({ action: { type: "ability", ability: "boneFate" }, key: "a:bone-fate", card: null });
    }
    return candidates;
  }
  function chooseAction(input, actorId) {
    var core = global.NmgOnlineBattleCore, state = clone(input), id = String(actorId || "");
    if (!core || !core.validateState(state) || state.status !== "active" || state.activePlayerId !== id) return { action: { type: "end" }, intent: "收势观局", score: 0 };
    var before = publicMetrics(state, id);
    var evaluated = legalCandidates(state, id).map(function (candidate) {
      var result = core.applyAction(state, id, candidate.action);
      return { action: candidate.action, intent: actionIntent(candidate.action, candidate.card), score: result.ok ? scoreOutcome(before, result.state, id, candidate.action) : -Infinity, key: candidate.key };
    }).sort(function (left, right) { return right.score - left.score || left.key.localeCompare(right.key); });
    var best = evaluated[0];
    if (!best || best.score <= 0) return { action: { type: "end" }, intent: "收势观局", score: 0 };
    return { action: clone(best.action), intent: best.intent, score: Math.round(best.score * 100) / 100 };
  }
  global.NmgDuelBot = Object.freeze({ chooseAction: chooseAction, chooseLoadout: chooseLoadout });
})(typeof window !== "undefined" ? window : this);
