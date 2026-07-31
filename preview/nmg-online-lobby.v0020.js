"use strict";
/* 蛊斗场大厅：登录、五屏大厅、带暗记邀请、整备轮次、权威快照与表现层。战斗真相只在 game.online。 */
(function createOnlineLobby(global) {
  var ACTION_ACK_TIMEOUT_MS = 4500;
  var EMOTE_COOLDOWN_MS = 3000;
  var entry, overlay, profileMount = null, profileMountTimer = 0, battleClockTimer = 0, supportProbeTimer = 0, matchTimer = 0;
  var ready = false, initialized = false, actionPending = false, actionPendingTimer = 0, logSequence = 0;
  var selectedHeroId = "fate", selectedCommons = [], focusedCommonKey = "", selectedHandIndex = -1, selectedHandKey = "", draftPoolKeys = [];
  var roomMode = "random", playerConfigs = {}, rewardSettledBattleId = "", selectionNonce = "", inviteSecret = "", lobbyEpoch = 1;
  var renderedHp = {}, offlineTimers = {}, inviteCheckTimers = {}, authorizedInvitePlayers = {}, lastPresentedRevision = -1, lastEmoteSentAt = 0, lastEmoteReceivedAt = 0, matchStartedAt = 0, matchPoolProbeEnabled = false;
  var voiceBattleId = "", lowLifeBattleId = "", resultVoiceBattleId = "";
  var actionPresentationQueue = [], actionPresentationBusy = false, actionPresentationToken = 0, localCastSourceRect = null;
  const HERO_ART = Object.freeze({
    fate: "assets/portraits/duel/hero-fate-duel.webp", blood: "assets/portraits/duel/hero-blood-duel.webp",
    poison: "assets/portraits/duel/hero-poison-duel.webp", longevity: "assets/portraits/duel/hero-longevity-duel.webp",
    dragon: "assets/portraits/duel/hero-dragon-duel.webp", bone: "assets/portraits/hero-wenling.webp"
  });
  const CARD_ART = Object.freeze({
    strike: "assets/codex/gu/armor-breaker-gu.webp", guard: "assets/codex/gu/iron-shell-gu.webp", insight: "assets/codex/gu/return-breath-gu.webp",
    fateSeal: "assets/codex/gu/fate-sever-gu.webp", bloodEdge: "assets/codex/gu/bloodblade-gu.webp", poisonFang: "assets/codex/gu/green-miasma-gu.webp",
    longBreath: "assets/codex/gu/long-breath-gu.webp", dragonScale: "assets/codex/gu/reverse-scale-gu.webp", boneBell: "assets/codex/gu/bonebell-gu.webp",
    devour: "assets/codex/gu/swarm-gu.webp", molt: "assets/codex/gu/bone-molt-gu.webp", gather: "assets/codex/gu/essence-gather-gu.webp",
    cleanse: "assets/codex/gu/cleanse-gu.webp", redFang: "assets/codex/gu/red-fang-gu.webp", spore: "assets/codex/gu/miasma-spore-gu.webp",
    carapace: "assets/codex/gu/mystic-carapace-pvp-gu.webp", spring: "assets/codex/gu/spring-renewal-gu.webp", pierce: "assets/codex/gu/heart-piercer-gu.webp",
    echo: "assets/codex/gu/breath-cicada-gu.webp", siphon: "assets/codex/gu/essence-siphon-gu.webp", ward: "assets/codex/gu/calamity-ward-gu.webp", leech: "assets/codex/gu/swarm-bite-gu.webp"
  });
  const PASSIVE_LABELS = Object.freeze({ fate: "命势", blood: "血怒", poison: "瘴印", longevity: "回生", dragon: "鳞势", bone: "骨鸣" });
  const EMOTES = Object.freeze({ greet: "问候", praise: "称赞", think: "思考", surprise: "惊讶", sigh: "叹息", rematch: "再来一局" });

  function byId(id) { return global.document && global.document.getElementById(id); }
  function setText(id, value) { var node = byId(id); if (node) node.textContent = value; }
  function setDisabled(id, value) { var node = byId(id); if (node) node.disabled = !!value; }
  function toggleHidden(id, value) { var node = byId(id); if (node) node.classList.toggle("hidden", !!value); }
  function bridge() { return global.NmgOnlineGameBridge; }
  function battleState() { return bridge() && bridge().getState ? bridge().getState() : null; }
  function currentRoom() { return global.NmgMultiplayer.getState(); }
  function setLobbyPage(name) {
    if (!overlay) return;
    overlay.querySelectorAll("[data-online-page]").forEach(function (node) { node.classList.toggle("is-active", node.dataset.onlinePage === name); });
    if (name === "identity") global.setTimeout(syncProfileButton, 40); else destroyProfileButton();
  }
  function refreshEntrySupport(attempt) {
    if (!entry) return false;
    var supported = !!(global.NmgTapLogin && global.NmgTapLogin.isSupported() && global.NmgMultiplayer && global.NmgMultiplayer.isSupported());
    entry.classList.toggle("hidden", !supported);
    if (supportProbeTimer) global.clearTimeout(supportProbeTimer);
    supportProbeTimer = 0;
    if (!supported && Number(attempt) < 120) supportProbeTimer = global.setTimeout(function () { refreshEntrySupport(Number(attempt) + 1); }, 250);
    return supported;
  }
  function addLog(text, tone) {
    var list = byId("onlineLobbyLog"); if (!list) return;
    var item = global.document.createElement("li"); item.className = tone || ""; item.textContent = String(++logSequence) + " · " + text; list.appendChild(item);
    while (list.children.length > 5) list.removeChild(list.firstElementChild); list.scrollTop = list.scrollHeight;
  }
  function shortId(value) { var text = String(value || ""); return !text ? "—" : text.length <= 14 ? text : text.slice(0, 6) + "…" + text.slice(-5); }
  function randomBytes(count) {
    var bytes = new Uint8Array(count);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") global.crypto.getRandomValues(bytes);
    else for (var i = 0; i < count; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return bytes;
  }
  function freshNonce() { return Array.from(randomBytes(16)).map(function (value) { return value.toString(16).padStart(2, "0"); }).join(""); }
  function freshInviteSecret() {
    var alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", value = "";
    Array.from(randomBytes(8)).forEach(function (byte) { value += alphabet[byte % alphabet.length]; });
    return value;
  }
  function encodeInviteCode(roomId, secret) {
    var source = unescape(encodeURIComponent(String(roomId || "")));
    var payload = global.btoa ? global.btoa(source).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_") : String(roomId || "");
    return "GU-" + payload + "-" + String(secret || "").toUpperCase();
  }
  function decodeInviteCode(code) {
    var match = String(code || "").trim().match(/^GU-([A-Za-z0-9_-]{1,128})-([0-9A-Z]{8})$/i);
    if (!match) return null;
    try {
      var raw = match[1].replace(/-/g, "+").replace(/_/g, "/"); while (raw.length % 4) raw += "=";
      var roomId = global.atob ? decodeURIComponent(escape(global.atob(raw))) : match[1];
      return roomId ? { roomId: roomId, secret: match[2].toUpperCase() } : null;
    } catch (error) { return null; }
  }
  function cleanNickname(value) { return String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 16) || "求命者"; }
  function extractProps(value) {
    var raw = value && (value.customProperties || (value.playerInfo && value.playerInfo.customProperties));
    if (raw && typeof raw === "object") return raw;
    try { return JSON.parse(String(raw || "{}")); } catch (error) { return {}; }
  }
  function sanitizeConfig(value) {
    value = value && typeof value === "object" ? value : {};
    var allowed = new Set(draftPoolKeys);
    var commons = Array.isArray(value.commons) ? value.commons.filter(function (key, index, list) { return allowed.has(key) && list.indexOf(key) === index; }).slice(0, 6) : [];
    return { heroId: Object.prototype.hasOwnProperty.call(HERO_ART, value.heroId) ? value.heroId : "fate", commons: commons,
      nickname: cleanNickname(value.nickname), mode: value.mode === "private" ? "private" : "random",
      nonce: String(value.nonce || "").replace(/[^a-f0-9]/gi, "").slice(0, 64), epoch: Math.max(1, Number(value.epoch) || 1) };
  }
  function profilePayload(extra) {
    var login = global.NmgTapLogin.getState();
    return Object.assign({ heroId: selectedHeroId, commons: selectedCommons.slice(), nickname: cleanNickname(login.profile && login.profile.nickname),
      mode: roomMode, nonce: selectionNonce, epoch: lobbyEpoch, inviteSecret: inviteSecret }, extra || {});
  }
  function renderDraftPool(seed) {
    var holder = byId("onlineCommonChoices"); if (!holder) return;
    selectedCommons = []; focusedCommonKey = ""; holder.textContent = ""; selectedHandIndex = -1; selectedHandKey = "";
    var pool = global.NmgOnlineBattleCore.draftPool(String(seed || "waiting") + "|" + lobbyEpoch); var cards = global.NmgOnlineBattleCore.cards; draftPoolKeys = pool.slice();
    pool.forEach(function (key) {
      var card = cards[key], button = global.document.createElement("button"); button.type = "button"; button.dataset.onlineCommon = key;
      button.setAttribute("aria-label", card.name + "，轻触查看技能，再次轻触选择");
      var art = global.document.createElement("i"); art.style.backgroundImage = 'url("' + (CARD_ART[key] || CARD_ART.strike) + '")';
      var name = global.document.createElement("b"); name.textContent = card.name;
      button.appendChild(art); button.appendChild(name); holder.appendChild(button);
    });
    setText("onlineCommonCount", "已选 0 / 6");
    renderCommonInspect("");
  }
  function renderCommonInspect(key) {
    var cards = global.NmgOnlineBattleCore.cards, card = cards[key];
    setText("onlineCommonInspectName", card ? card.name : "先查看一只蛊虫");
    setText("onlineCommonInspectCost", card ? "消耗 " + card.cost + " 真元" : "第一次点击查看完整功效");
    setText("onlineCommonInspectText", card ? card.text : "第二次点击同一只蛊虫，才会加入或移出本局六蛊阵容。");
    setText("onlineCommonInspectHint", card ? (selectedCommons.indexOf(key) >= 0 ? "已入阵 · 再点一次移出" : "再点一次选择") : "圆形立绘用于快速辨认");
  }
  async function toggleCommonSelection(key, button) {
    var at = selectedCommons.indexOf(key);
    if (at >= 0) selectedCommons.splice(at, 1);
    else if (selectedCommons.length < 6) selectedCommons.push(key);
    else { addLog("本局最多选择六只通用蛊", "error"); return; }
    button.classList.toggle("is-selected", selectedCommons.indexOf(key) >= 0);
    setText("onlineCommonCount", "已选 " + selectedCommons.length + " / 6");
    renderCommonInspect(key);
    setDisabled("onlineReadyButton", !currentRoom().inRoom || currentRoom().playerCount !== 2 || selectedCommons.length !== 6);
    if (currentRoom().inRoom) await sendConfig();
  }
  function isCurrentBattleSnapshot(state) {
    var room = currentRoom(), roomId = String(room.roomId || "");
    return !!(room.inRoom && roomId && state && global.NmgOnlineBattleCore.validateState(state) && String(state.battleId || "").indexOf(roomId + "-" + lobbyEpoch + "-") === 0);
  }
  function setActionPending(value) {
    actionPending = !!value;
    if (actionPendingTimer) global.clearTimeout(actionPendingTimer); actionPendingTimer = 0;
    if (actionPending) actionPendingTimer = global.setTimeout(function () { actionPending = false; actionPendingTimer = 0; addLog("未收到行动回执，可重试", "error"); renderBattle(); }, ACTION_ACK_TIMEOUT_MS);
  }
  function syncRoomState(message) {
    var state = currentRoom(), login = global.NmgTapLogin.getState();
    setText("onlineLobbyStatus", message || (state.inRoom ? (roomMode === "random" ? "随机蛊斗房" : "邀请切磋房") : state.connected ? "联机服务已连接" : "等待连接"));
    setText("onlineRoomId", shortId(state.roomId)); setText("onlinePlayerCount", String(state.playerCount || 0) + " / 2");
    setDisabled("onlineConnectButton", !login.authenticated || state.connected); setDisabled("onlineMatchButton", !state.connected || state.inRoom);
    setDisabled("onlineCreateButton", !state.connected || state.inRoom); setDisabled("onlineInviteOpenButton", !state.connected || state.inRoom);
    setDisabled("onlineJoinButton", !state.connected || state.inRoom); setDisabled("onlineInviteButton", !state.inRoom || roomMode !== "private");
    setDisabled("onlineReadyButton", !state.inRoom || state.playerCount < 2 || selectedCommons.length !== 6); setDisabled("onlineLeaveButton", !state.inRoom);
    var readyButton = byId("onlineReadyButton"); if (readyButton) readyButton.textContent = ready ? "取消准备" : "选定蛊修并准备";
  }
  function renderProfile(profile, pending) {
    var avatar = byId("onlineProfileAvatar");
    var profileUnavailable = global.NmgTapLogin && global.NmgTapLogin.getState().status === "profile-unavailable";
    if (profile) {
      setText("onlineProfileName", profile.nickname || "求命者"); setText("onlineProfileHint", "TapTap 身份已就绪");
      if (avatar && profile.avatarUrl) { avatar.textContent = ""; avatar.style.backgroundImage = 'url("' + String(profile.avatarUrl).replace(/["\\]/g, "") + '")'; }
    } else {
      setText("onlineProfileName", profileUnavailable ? "已登录 · 昵称权限未开放" : pending ? "已登录 · 待授权昵称" : "尚未登录");
      setText("onlineProfileHint", profileUnavailable ? "在 TapTap 后台开启头像昵称权限后即可显示真实身份" : pending ? "轻触右侧按钮授权头像昵称" : "先完成 TapTap 登录");
      if (avatar) { avatar.textContent = "命"; avatar.style.backgroundImage = ""; }
    }
    var button = byId("onlineProfileButton"); if (button) button.classList.toggle("hidden", !pending || !!profile || profileUnavailable);
  }
  function destroyProfileButton() { if (profileMountTimer) global.clearTimeout(profileMountTimer); profileMountTimer = 0; if (profileMount) { profileMount.destroy(); profileMount = null; } }
  function mountProfileButton() {
    destroyProfileButton(); var button = byId("onlineProfileButton"); if (!button || button.classList.contains("hidden") || overlay.classList.contains("hidden")) return;
    profileMount = global.NmgTapLogin.mountProfileButton(button.getBoundingClientRect(), function (profile) {
      renderProfile(profile, false); addLog("头像昵称授权完成", "ok"); destroyProfileButton(); if (currentRoom().inRoom) sendConfig();
    }, function (reason) {
      if (reason === "privacy-api-permission") { renderProfile(null, false); addLog("TapTap 后台未开放头像昵称权限，暂用默认称谓，不影响联机", "error"); destroyProfileButton(); }
      else addLog("头像昵称未授权：" + reason, "error");
    });
    if (!profileMount || !profileMount.ok) {
      if (profileMount && profileMount.permanent) renderProfile(null, false);
      else addLog("当前容器未能创建授权按钮，请重新打开蛊斗场", "error");
    }
  }
  function syncProfileButton() { if (global.NmgTapLogin && global.NmgTapLogin.getState().status === "profile-pending") mountProfileButton(); }
  function setBattleMode(active) {
    destroyProfileButton(); toggleHidden("onlineLobbySetup", active); toggleHidden("onlineBattleArena", !active);
    var card = overlay && overlay.querySelector(".online-lobby-card"); if (card) card.classList.toggle("is-battle", !!active);
    setText("onlineLobbyTitle", active ? "一人一命，斗蛊定胜" : "蛊斗场");
    if (global.AudioManager && typeof global.AudioManager.playScene === "function") global.AudioManager.playScene(active ? "duel" : "menu");
  }
  function renderStatuses(holder, player) {
    holder.textContent = "";
    function chip(text, tone) { var node = global.document.createElement("span"); node.className = "online-status-chip " + (tone || ""); node.textContent = text; holder.appendChild(node); }
    if (player.poison > 0) chip("蚀毒 " + player.poison, "is-poison");
    if (player.passive) chip((PASSIVE_LABELS[player.passive.key] || "战态") + " " + player.passive.stacks + "/" + player.passive.max, player.passive.charged ? "is-charged" : "");
    if (player.passive && player.passive.pending) chip("下回合 +1 真元", "is-charged");
  }
  function renderPartyCard(id, player, playerId, activePlayerId) {
    var node = byId(id); if (!node || !player) return; node.textContent = "";
    var art = global.document.createElement("div"); art.className = "online-duelist-art"; art.style.backgroundImage = 'url("' + (HERO_ART[player.heroId] || HERO_ART.fate) + '")';
    var veil = global.document.createElement("div"); veil.className = "online-duelist-veil";
    var title = global.document.createElement("strong"); title.textContent = (id === "onlineBattleSelf" ? "你 · " : "对手 · ") + player.name;
    var hp = global.document.createElement("span"); hp.className = "online-duelist-hp"; hp.innerHTML = '<i style="width:' + Math.max(0, Math.min(100, player.hp / player.maxHp * 100)) + '%"></i>';
    var detail = global.document.createElement("small"); detail.textContent = player.pathName + "　命 " + player.hp + "/" + player.maxHp + "　甲 " + player.armor + "　元 " + player.energy;
    var statuses = global.document.createElement("div"); statuses.id = id === "onlineBattleSelf" ? "onlineBattleSelfStatuses" : "onlineBattleAllyStatuses"; statuses.className = "online-duelist-statuses"; renderStatuses(statuses, player);
    veil.appendChild(title); veil.appendChild(hp); veil.appendChild(detail); node.appendChild(art); node.appendChild(veil); node.appendChild(statuses);
    node.classList.toggle("is-turn", String(playerId) === String(activePlayerId));
    if (renderedHp[playerId] != null && player.hp < renderedHp[playerId]) { node.classList.remove("was-hit"); void node.offsetWidth; node.classList.add("was-hit"); global.setTimeout(function () { node.classList.remove("was-hit"); }, 380); }
    renderedHp[playerId] = player.hp;
  }
  function renderCardInspect(self) {
    var holder = byId("onlineCardInspect"), cards = global.NmgOnlineBattleCore.cards;
    if (!holder || selectedHandIndex < 0 || !self || !self.hand[selectedHandIndex]) { toggleHidden("onlineCardInspect", true); return; }
    var key = self.hand[selectedHandIndex], card = cards[key]; selectedHandKey = key;
    var detail = holder.querySelector("div"); detail.querySelector("b").textContent = card.name; detail.querySelector("small").textContent = "消耗 " + card.cost + " 真元"; detail.querySelector("p").textContent = card.text;
    setDisabled("onlineCardConfirm", self.energy < card.cost || actionPending); toggleHidden("onlineCardInspect", false);
  }
  function playSfx(key, fallback, volumeScale) {
    if (!global.AudioManager || !global.AudioManager.playSfx) return;
    var volume = Number(volumeScale) || .72;
    global.AudioManager.playSfx(key, { volumeScale: volume }) || (fallback && global.AudioManager.playSfx(fallback, { volumeScale: Math.min(volume, .68) }));
  }
  function playLobbyClick(event) {
    var button = event && event.target && event.target.closest && event.target.closest("button");
    if (!button || button.disabled || button.closest("#onlineBattleArena")) return;
    playSfx("uiClick");
  }
  function triggerVoice(event, heroId, turn) { if (global.NMGVoiceDirector && global.NMGVoiceDirector.trigger) global.NMGVoiceDirector.trigger(event, { heroId: heroId, turn: turn }); }
  function playConfirmedActionFeedback(action, state) {
    var arena = byId("onlineBattleArena"), flash = global.document.createElement("i");
    if (arena) { flash.className = "online-action-flash"; arena.appendChild(flash); global.setTimeout(function () { flash.remove(); }, 560); }
    if (action.armorBroken) playSfx("hitHeavy");
    else if (action.damage > 0) playSfx(action.damage >= 12 ? "hitHeavy" : "hitLight");
    else if (action.blocked > 0) playSfx("block");
    if (action.poison > 0) playSfx("poisonApply");
    if (action.heal > 0) playSfx("duelHeal", "guluFeed");
    if (action.armor > 0) playSfx("duelArmorGain", "block");
    if (action.draw > 0) playSfx("duelDraw", "uiClick");
    if (action.energyGain > 0) playSfx("duelEnergy", "boneNoteGain");
    if (action.cleanse > 0) playSfx("duelCleanse", "forgeWard");
    var actor = state.players[action.actorId]; if (actor && action.passive) triggerVoice(action.passive === "poison" ? "corrosion" : action.passive === "blood" ? "sacrifice" : action.passive === "dragon" ? "transform" : action.passive === "bone" ? "chime" : action.passive === "fate" ? "fulfill" : "restore", actor.heroId, state.round);
  }
  function actionAnchorFromRect(rect) {
    if (!rect) return null;
    return { getBoundingClientRect: function () { return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.left + rect.width, bottom: rect.top + rect.height }; } };
  }
  async function drainActionPresentationQueue() {
    if (actionPresentationBusy || !actionPresentationQueue.length) return;
    actionPresentationBusy = true;
    var item = actionPresentationQueue.shift(), action = item.action, state = item.state, selfId = item.selfId, token = item.token;
    var cards = global.NmgOnlineBattleCore.cards, card = cards[action.cardKey] || cards.strike;
    var mine = String(action.actorId) === String(selfId);
    var actorNode = byId(mine ? "onlineBattleSelf" : "onlineBattleAlly");
    var enemyNode = byId(mine ? "onlineBattleAlly" : "onlineBattleSelf");
    var offensive = action.damage > 0 || action.blocked > 0 || action.poison > 0 || action.armorBroken;
    var source = mine && item.localRect ? actionAnchorFromRect(item.localRect) : actorNode;
    playSfx("cardPlay");
    try {
      if (global.NmgCardCast?.present) {
        await global.NmgCardCast.present({
          source: source,
          target: offensive ? enemyNode : actorNode,
          card: { name: card.name, art: CARD_ART[action.cardKey] || CARD_ART.strike, turn: 1 },
          side: mine ? "self" : "opponent",
          kind: offensive ? "attack" : (action.armor > 0 ? "defense" : "support"),
          reduced: item.reduced,
          onImpact: function () { playConfirmedActionFeedback(action, state); },
        });
      } else playConfirmedActionFeedback(action, state);
    } catch (error) {
      playConfirmedActionFeedback(action, state);
    }
    actionPresentationBusy = false;
    if (token === actionPresentationToken) drainActionPresentationQueue();
  }
  function presentLastAction(state, selfId) {
    var action = state.lastAction;
    if (!action || Number(action.revision) <= lastPresentedRevision) return;
    lastPresentedRevision = Number(action.revision);
    var reduced = actionPresentationQueue.length >= 3;
    actionPresentationQueue.push({ action: Object.assign({}, action), state: state, selfId: selfId, token: actionPresentationToken, reduced: reduced, localRect: String(action.actorId) === String(selfId) ? localCastSourceRect : null });
    if (String(action.actorId) === String(selfId)) localCastSourceRect = null;
    drainActionPresentationQueue();
  }
  function settleReward(state, selfId) {
    if (!state || state.status !== "finished" || rewardSettledBattleId === state.battleId) return; rewardSettledBattleId = state.battleId;
    if (String(state.winnerId) !== String(selfId)) return;
    var room = currentRoom(), knownType = String(room.roomType || ""); var eligible = roomMode === "random" && (!knownType || knownType.indexOf("pvp-random") === 0);
    if (!state.rewardEligible || state.mode !== "random" || !eligible) { addLog("邀请切磋获胜，不结算奖励", "ok"); return; }
    if (typeof global.grantOnlineDuelReward !== "function") { addLog("胜利已落定，奖励模块暂不可用", "error"); return; }
    var reward = global.grantOnlineDuelReward(state.battleId, state.rewardEligible); if (reward.ok) addLog("胜利奖励：蛊钱 +100，随机生态异材 +1", "ok");
  }
  function renderBattleResult(state, won) {
    var holder = byId("onlineBattleResult"); if (!holder) return;
    holder.textContent = ""; holder.classList.toggle("is-victory", !!won); holder.classList.toggle("is-defeat", !won);
    var seal = global.document.createElement("i"); seal.className = "online-result-seal"; seal.textContent = won ? "胜" : "败";
    var title = global.document.createElement("strong"); title.textContent = won ? "蛊斗告捷" : "此局落败";
    var detail = global.document.createElement("small"); detail.textContent = won ? (state.rewardEligible ? "蛊钱与生态异材已收入蛊庐" : "切磋已定 · 本房无奖励") : "重整蛊序，与同途者再战";
    holder.appendChild(seal); holder.appendChild(title); holder.appendChild(detail);
  }
  function renderBattle() {
    var state = battleState(); if (!state) return;
    var selfId = String(global.NmgMultiplayer.getPlayerId() || ""), enemyId = state.order.find(function (id) { return String(id) !== selfId; }) || state.order[1];
    var self = state.players[selfId] || state.players[state.order[0]], enemy = state.players[enemyId] || state.players[state.order[1]];
    setBattleMode(true); setText("onlineBattleRound", state.round);
    if (voiceBattleId !== state.battleId) { voiceBattleId = state.battleId; lastPresentedRevision = -1; actionPresentationToken += 1; actionPresentationQueue = []; actionPresentationBusy = false; localCastSourceRect = null; triggerVoice("battle", self.heroId, state.round); }
    var myTurn = state.status === "active" && String(state.activePlayerId) === selfId, seconds = Math.max(0, Math.ceil((Number(state.turnDeadline) - Date.now()) / 1000));
    setText("onlineBattleTurn", state.status !== "active" ? "本局已结束" : (myTurn ? "轮到你出牌" : "等待对手行动") + " · " + seconds + "秒");
    var turn = byId("onlineBattleTurn"); if (turn) turn.classList.toggle("is-self", myTurn);
    renderPartyCard("onlineBattleSelf", self, selfId, state.activePlayerId); renderPartyCard("onlineBattleAlly", enemy, enemyId, state.activePlayerId);
    if (self.hp <= 30 && lowLifeBattleId !== state.battleId) { lowLifeBattleId = state.battleId; triggerVoice("lowlife", self.heroId, state.round); }
    var hand = byId("onlineBattleHand"), cards = global.NmgOnlineBattleCore.cards;
    if (selectedHandIndex >= self.hand.length || (selectedHandIndex >= 0 && selectedHandKey && self.hand[selectedHandIndex] !== selectedHandKey)) { selectedHandIndex = -1; selectedHandKey = ""; }
    if (hand) { hand.textContent = ""; self.hand.forEach(function (key, index) {
      var card = cards[key], button = global.document.createElement("button"); button.type = "button"; button.dataset.onlineCard = String(index); button.disabled = !myTurn || actionPending || self.energy < card.cost; button.classList.toggle("is-selected", index === selectedHandIndex);
      var art = global.document.createElement("i"); art.className = "online-card-art"; art.style.backgroundImage = 'url("' + (CARD_ART[key] || CARD_ART.strike) + '")';
      var name = global.document.createElement("b"); name.textContent = card.name; var cost = global.document.createElement("small"); cost.textContent = "真元 " + card.cost; var text = global.document.createElement("span"); text.textContent = card.text;
      button.appendChild(art); button.appendChild(name); button.appendChild(cost); button.appendChild(text); hand.appendChild(button);
    }); }
    renderCardInspect(self); setDisabled("onlineBattleEndTurn", !myTurn || actionPending);
    var events = byId("onlineBattleEvents"); if (events) { events.innerHTML = (state.events || []).map(function (text) { return "<li>" + String(text).replace(/[<>&]/g, "") + "</li>"; }).join(""); events.scrollTop = events.scrollHeight; }
    presentLastAction(state, selfId);
    var finished = state.status === "finished"; toggleHidden("onlineBattleResult", !finished); toggleHidden("onlineBattleReturn", !finished);
    if (finished) {
      var won = String(state.winnerId) === selfId; renderBattleResult(state, won); settleReward(state, selfId);
      if (resultVoiceBattleId !== state.battleId) { resultVoiceBattleId = state.battleId; triggerVoice(won ? "victory" : "defeat", self.heroId, state.round); playSfx(won ? "victory" : "defeat", null, .9); }
    }
  }
  async function sendBattleState(state) { var result = await global.NmgMultiplayer.send("battle-state", { state: state, epoch: lobbyEpoch }); if (!result.ok) addLog("战斗同步失败：" + result.error, "error"); return result; }
  async function sendConfig() {
    var id = String(global.NmgMultiplayer.getPlayerId() || ""); if (!id) return;
    playerConfigs[id] = sanitizeConfig(profilePayload()); await global.NmgMultiplayer.updatePlayerCustomProperties(profilePayload()); await global.NmgMultiplayer.send("duel-config", playerConfigs[id]);
  }
  async function maybeStartBattle() {
    var room = currentRoom(); if (!room.isHost || room.playerCount !== 2 || room.readyCount !== 2 || battleState()) return;
    var ids = [room.playerId].concat(room.remoteIds || []).slice(0, 2);
    if (!playerConfigs[ids[0]] || !playerConfigs[ids[1]]) { await sendConfig(); return; }
    if (playerConfigs[ids[0]].commons.length !== 6 || playerConfigs[ids[1]].commons.length !== 6) return;
    if (ids.some(function (id) { return playerConfigs[id].epoch !== lobbyEpoch; })) return;
    var heroes = {}, loadouts = {}, names = {}; ids.forEach(function (id) { heroes[id] = playerConfigs[id].heroId; loadouts[id] = playerConfigs[id].commons; names[id] = playerConfigs[id].nickname; });
    var sharedSeed = String(room.roomId || "room") + "|" + lobbyEpoch + "|" + ids.slice().sort().map(function (id) { return playerConfigs[id].nonce; }).join("|");
    var created = bridge().create({ playerIds: ids, heroes: heroes, loadouts: loadouts, names: names, mode: roomMode, seed: sharedSeed, battleId: String(room.roomId || "room") + "-" + lobbyEpoch + "-" + Date.now() });
    if (!created.ok) { addLog("蛊斗创建失败：" + created.error, "error"); return; }
    rewardSettledBattleId = ""; setActionPending(false); renderBattle(); addLog("双方蛊组封定，蛊斗开始", "ok");
    if (!(await global.NmgMultiplayer.send("battle-start", { state: created.state, epoch: lobbyEpoch })).ok) await leave();
  }
  async function useBattleAction(action) {
    var state = battleState(), selfId = String(global.NmgMultiplayer.getPlayerId() || "");
    if (!state || state.status !== "active" || String(state.activePlayerId) !== selfId || actionPending) return;
    if (action && action.type === "play") {
      var sourceCard = byId("onlineBattleHand") && byId("onlineBattleHand").querySelector('[data-online-card="' + Number(action.handIndex) + '"]');
      if (sourceCard && sourceCard.getBoundingClientRect) {
        var sourceRect = sourceCard.getBoundingClientRect();
        localCastSourceRect = { left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height };
      }
    }
    selectedHandIndex = -1; selectedHandKey = ""; setActionPending(true); renderBattle();
    if (global.NmgMultiplayer.isHost()) {
      var applied = bridge().applyAction(selfId, Object.assign({}, action, { at: Date.now() })); setActionPending(false);
      if (!applied.ok) { addLog(applied.error, "error"); renderBattle(); return; } renderBattle(); if (!(await sendBattleState(applied.state)).ok) await leave(); return;
    }
    var sent = await global.NmgMultiplayer.send("battle-action", { battleId: state.battleId, revision: state.revision, action: action, epoch: lobbyEpoch });
    if (!sent.ok) { setActionPending(false); addLog("行动未送达：" + sent.error, "error"); renderBattle(); }
  }
  async function tickBattleClock() {
    var state = battleState(); if (!state || state.status !== "active") return;
    var seconds = Math.max(0, Math.ceil((Number(state.turnDeadline) - Date.now()) / 1000)), selfId = String(global.NmgMultiplayer.getPlayerId() || ""), mine = String(state.activePlayerId) === selfId;
    setText("onlineBattleTurn", (mine ? "轮到你出牌" : "等待对手行动") + " · " + seconds + "秒");
    if (seconds > 0 || !global.NmgMultiplayer.isHost() || actionPending) return;
    setActionPending(true); var applied = bridge().applyAction(state.activePlayerId, { type: "end", timeout: true, at: Date.now() }); setActionPending(false);
    if (applied.ok) { renderBattle(); if (!(await sendBattleState(applied.state)).ok) await leave(); }
  }
  async function beginPrepEpoch(nextEpoch, broadcast) {
    lobbyEpoch = Math.max(lobbyEpoch + (broadcast ? 1 : 0), Number(nextEpoch) || 1); ready = false; playerConfigs = {}; selectionNonce = freshNonce();
    selectedCommons = []; selectedHandIndex = -1; selectedHandKey = ""; if (bridge()) bridge().end(); setBattleMode(false);
    await global.NmgMultiplayer.setReady(false); renderDraftPool(currentRoom().roomId); setLobbyPage("preparing"); syncRoomState("等待双方重新整备");
    if (broadcast) await global.NmgMultiplayer.send("prep-epoch", { epoch: lobbyEpoch }); await sendConfig();
  }
  async function returnToLobby() { setActionPending(false); await beginPrepEpoch(lobbyEpoch, true); addLog("新一轮蛊池已生成，可在原房再战", "ok"); }
  async function login() {
    setDisabled("onlineLoginButton", true); var result = await global.NmgTapLogin.login();
    if (!result.ok) { setDisabled("onlineLoginButton", false); addLog("登录失败：" + result.reason, "error"); return; }
    renderProfile(result.profile, result.status === "profile-pending"); setDisabled("onlineConnectButton", false); addLog("TapTap 登录成功", "ok");
    if (result.status === "profile-pending") profileMountTimer = global.setTimeout(mountProfileButton, 80);
  }
  async function connect() {
    destroyProfileButton(); setDisabled("onlineConnectButton", true); var result = await global.NmgMultiplayer.connect();
    if (!result.ok) { setDisabled("onlineConnectButton", false); addLog("连接失败：" + result.error, "error"); return; }
    addLog("联机服务已连接", "ok"); syncRoomState("联机服务已连接"); setLobbyPage("modes");
  }
  function stopMatchingWait() { if (matchTimer) global.clearInterval(matchTimer); matchTimer = 0; matchStartedAt = 0; matchPoolProbeEnabled = false; }
  async function updateMatchFacts() {
    if (!matchStartedAt) return; var elapsed = Math.max(0, Math.floor((Date.now() - matchStartedAt) / 1000)); setText("onlineMatchElapsed", "已等待 " + elapsed + " 秒");
    setText("onlineMatchEstimate", elapsed < 15 ? "约 10–45 秒" : elapsed < 45 ? "约 15–60 秒" : "匹配池较少，继续等待");
    if (!matchPoolProbeEnabled) { setText("onlineMatchPool", "正在接入匹配池"); return; }
    if (elapsed % 5 !== 0) return; var result = await global.NmgMultiplayer.getRoomList("pvp-random-v1");
    if (!result.supported) setText("onlineMatchPool", "当前容器不提供人数");
    else if (!result.ok) setText("onlineMatchPool", "暂时无法探查");
    else { var waiting = result.rooms.reduce(function (sum, room) { var count = Number(room.playerCount || (room.players && room.players.length) || 0); return sum + (count < 2 ? Math.max(1, count) : 0); }, 0); setText("onlineMatchPool", "约 " + waiting + " 人候场"); }
  }
  function startMatchingWait(allowPoolProbe) { stopMatchingWait(); matchPoolProbeEnabled = !!allowPoolProbe; matchStartedAt = Date.now(); setLobbyPage("matching"); updateMatchFacts(); matchTimer = global.setInterval(updateMatchFacts, 1000); }
  async function enterRoom(result, mode, text) {
    if (!result.ok) { stopMatchingWait(); addLog(text + "失败：" + result.error, "error"); setLobbyPage("modes"); syncRoomState(); return; }
    roomMode = mode; ready = false; playerConfigs = {}; authorizedInvitePlayers = {}; lobbyEpoch = 1; selectionNonce = freshNonce(); renderDraftPool(currentRoom().roomId); syncRoomState(); await sendConfig();
    if (mode === "random" && currentRoom().playerCount < 2) { addLog("已进入匹配池，等待对手", "ok"); startMatchingWait(true); }
    else if (mode === "private" && currentRoom().playerCount < 2) { setText("onlineInviteCode", encodeInviteCode(currentRoom().roomId, inviteSecret)); setLobbyPage("invite"); addLog("邀请房已创建，复制蛊印给好友", "ok"); }
    else { stopMatchingWait(); setLobbyPage("preparing"); addLog(text + "成功，双方开始整备", "ok"); }
  }
  async function match() { destroyProfileButton(); roomMode = "random"; inviteSecret = ""; startMatchingWait(false); await enterRoom(await global.NmgMultiplayer.matchRoom(2, "pvp-random-v1", profilePayload()), "random", "随机匹配"); }
  async function createPrivate() { destroyProfileButton(); roomMode = "private"; inviteSecret = freshInviteSecret(); await enterRoom(await global.NmgMultiplayer.createRoom("逆命蛊途·邀请切磋", "pvp-private-v1", profilePayload()), "private", "邀请房创建"); }
  async function joinPrivate() {
    destroyProfileButton(); var decoded = decodeInviteCode(byId("onlineRoomCodeInput") && byId("onlineRoomCodeInput").value);
    if (!decoded) { addLog("蛊印格式不完整，请复制完整双段蛊印", "error"); return; }
    roomMode = "private"; inviteSecret = decoded.secret; await enterRoom(await global.NmgMultiplayer.joinRoom(decoded.roomId, profilePayload()), "private", "加入邀请房");
  }
  async function copyRoomInvite() {
    var code = encodeInviteCode(currentRoom().roomId, inviteSecret); if (!currentRoom().roomId) return;
    try { await global.navigator.clipboard.writeText("逆命蛊途·邀请切磋｜蛊印：" + code); addLog("完整邀请蛊印已复制", "ok"); }
    catch (error) { addLog("复制失败，请手动记录 " + code, "error"); }
  }
  async function toggleReady() {
    if (selectedCommons.length !== 6) return; var result = await global.NmgMultiplayer.setReady(!ready);
    if (!result.ok) { addLog("准备同步失败：" + result.error, "error"); return; } ready = result.ready; await sendConfig(); addLog(ready ? "你已准备" : "你已取消准备", "ok"); syncRoomState(); maybeStartBattle();
  }
  async function leave() {
    stopMatchingWait(); var state = battleState(), selfId = global.NmgMultiplayer.getPlayerId();
    if (state && state.status === "active") { if (global.NmgMultiplayer.isHost()) { var lost = bridge().forfeit(selfId, "leave"); if (lost.ok) await sendBattleState(lost.state); } else await global.NmgMultiplayer.send("battle-forfeit", { battleId: state.battleId, revision: state.revision, epoch: lobbyEpoch }); }
    Object.keys(offlineTimers).forEach(function (id) { global.clearTimeout(offlineTimers[id]); }); offlineTimers = {};
    Object.keys(inviteCheckTimers).forEach(function (id) { global.clearTimeout(inviteCheckTimers[id]); }); inviteCheckTimers = {}; authorizedInvitePlayers = {};
    if (bridge()) bridge().end(); setBattleMode(false); var result = await global.NmgMultiplayer.leaveRoom(); ready = false; playerConfigs = {}; inviteSecret = ""; addLog(result.ok ? "已离开房间" : "离房回执异常，本地已清理", result.ok ? "" : "error"); syncRoomState("联机服务已连接"); setLobbyPage("modes");
  }
  async function cancelMatch() { if (currentRoom().inRoom) await leave(); else { stopMatchingWait(); setLobbyPage("modes"); } }
  async function inviteBack() { if (currentRoom().inRoom) await leave(); else setLobbyPage("modes"); }
  function showEmote(id, mine) {
    if (!EMOTES[id]) return; if (!mine && byId("onlineMuteEmotes") && byId("onlineMuteEmotes").checked) return;
    var holder = byId(mine ? "onlineSelfEmote" : "onlineAllyEmote"); if (!holder) return; holder.innerHTML = '<img src="assets/icons/duel-emotes/' + id + '.svg" alt="' + EMOTES[id] + '">'; holder.classList.remove("hidden"); void holder.offsetWidth; global.setTimeout(function () { holder.classList.add("hidden"); }, 2200);
  }
  async function sendEmote(id) {
    var now = Date.now(); if (!battleState() || !EMOTES[id] || now - lastEmoteSentAt < EMOTE_COOLDOWN_MS) return; lastEmoteSentAt = now; showEmote(id, true); toggleHidden("onlineEmoteMenu", true); byId("onlineEmoteToggle").setAttribute("aria-expanded", "false");
    await global.NmgMultiplayer.send("duel-emote", { id: id, at: now, epoch: lobbyEpoch });
  }
  function open() {
    if (!overlay) return; overlay.classList.remove("hidden"); var login = global.NmgTapLogin.getState(); renderProfile(login.profile, login.status === "profile-pending");
    if (battleState()) renderBattle(); else { setBattleMode(false); syncRoomState(login.authenticated ? "等待连接" : "等待登录"); setLobbyPage(currentRoom().inRoom ? "preparing" : currentRoom().connected ? "modes" : "identity"); }
  }
  async function close() { destroyProfileButton(); if (currentRoom().inRoom) await leave(); if (overlay) overlay.classList.add("hidden"); }
  function validInvitePlayer(info) { return roomMode !== "private" || !inviteSecret || String(extractProps(info).inviteSecret || "").toUpperCase() === inviteSecret; }
  async function rejectInvitePlayer(id) { addLog("陌生蛊印校验失败，已移出房间", "error"); await global.NmgMultiplayer.kickRoomPlayer(id); }
  async function acceptInvitePlayer(id) { authorizedInvitePlayers[String(id)] = true; addLog("对手蛊印校验通过", "ok"); await global.NmgMultiplayer.send("invite-accepted", { epoch: lobbyEpoch }); }
  function bindRuntimeEvents() {
    global.NmgMultiplayer.on("onPlayerJoined", async function (info) {
      var id = String(info && (info.id || info.playerId) || "");
      if (global.NmgMultiplayer.isHost() && roomMode === "private") {
        var props = extractProps(info);
        if (props.inviteSecret && !validInvitePlayer(info)) { await rejectInvitePlayer(id); return; }
        if (validInvitePlayer(info)) await acceptInvitePlayer(id);
        else {
          addLog("正在校验对手蛊印", "ok");
          inviteCheckTimers[id] = global.setTimeout(async function () {
            delete inviteCheckTimers[id]; var remote = global.NmgMultiplayer.getRemotePlayers()[id];
            if (remote && validInvitePlayer(remote)) await acceptInvitePlayer(id); else await rejectInvitePlayer(id);
          }, 1200);
        }
      }
      if (offlineTimers[id]) { global.clearTimeout(offlineTimers[id]); delete offlineTimers[id]; addLog("对手已重新连入", "ok"); } else addLog("对手已进入", "ok");
      stopMatchingWait(); if (!battleState()) setLobbyPage("preparing"); syncRoomState("双端已同房"); await sendConfig(); if (global.NmgMultiplayer.isHost() && battleState()) await sendBattleState(battleState());
    });
    global.NmgMultiplayer.on("onPlayerLeft", function (id) {
      var state = battleState(); if (state && state.status === "active") { var result = bridge().forfeit(id, "disconnect"); if (result.ok) { renderBattle(); if (global.NmgMultiplayer.isHost()) sendBattleState(result.state); } }
      ready = false; addLog("对手已离开", "error"); syncRoomState("等待对手"); if (!state && roomMode === "private") setLobbyPage("invite");
    });
    global.NmgMultiplayer.on("onReadyChanged", function (id, value) { if (id !== global.NmgMultiplayer.getPlayerId()) addLog(value ? "对手已准备" : "对手取消准备"); syncRoomState(); maybeStartBattle(); });
    global.NmgMultiplayer.on("onPlayerPropertiesChanged", async function (id, info) {
      id = String(id || ""); if (!global.NmgMultiplayer.isHost() || roomMode !== "private" || authorizedInvitePlayers[id]) return;
      if (inviteCheckTimers[id]) { global.clearTimeout(inviteCheckTimers[id]); delete inviteCheckTimers[id]; }
      if (validInvitePlayer(info)) await acceptInvitePlayer(id); else await rejectInvitePlayer(id);
    });
    global.NmgMultiplayer.on("onPlayerOffline", function (id) {
      id = String(id || ""); if (!id || offlineTimers[id]) return; addLog("对手连接波动，保留席位 8 秒", "error");
      offlineTimers[id] = global.setTimeout(function () { delete offlineTimers[id]; var state = battleState(); if (state && state.status === "active") { var result = bridge().forfeit(id, "disconnect"); if (result.ok) { renderBattle(); if (global.NmgMultiplayer.isHost()) sendBattleState(result.state); } } }, 8000);
    });
    global.NmgMultiplayer.on("onData", async function (data, fromId) {
      if (!data || !currentRoom().inRoom) return;
      if (roomMode === "private" && global.NmgMultiplayer.isHost() && !authorizedInvitePlayers[String(fromId)]) return;
      if (data.t === "invite-accepted") { await sendConfig(); return; }
      if (data.t === "prep-epoch" && data.p && Number(data.p.epoch) > lobbyEpoch) { await beginPrepEpoch(Number(data.p.epoch), false); return; }
      if (data.t === "duel-config" && data.p) { var config = sanitizeConfig(data.p); if (config.epoch !== lobbyEpoch) return; playerConfigs[String(fromId)] = config; if (global.NmgMultiplayer.isHost()) maybeStartBattle(); return; }
      if (data.t === "duel-emote" && data.p && Number(data.p.epoch) === lobbyEpoch && EMOTES[data.p.id]) { var now = Date.now(); if (now - lastEmoteReceivedAt >= EMOTE_COOLDOWN_MS) { lastEmoteReceivedAt = now; showEmote(data.p.id, false); } return; }
      if (data.t === "battle-start" && data.p && data.p.state && Number(data.p.epoch) === lobbyEpoch && !global.NmgMultiplayer.isHost()) { if (!isCurrentBattleSnapshot(data.p.state) || battleState()) return; var started = bridge().start(data.p.state); if (started.ok) { rewardSettledBattleId = ""; setActionPending(false); renderBattle(); addLog("蛊斗开始", "ok"); } return; }
      if (data.t === "battle-action" && global.NmgMultiplayer.isHost() && data.p && Number(data.p.epoch) === lobbyEpoch) {
        var current = battleState(); if (!current || String(current.activePlayerId) !== String(fromId) || String(data.p.battleId) !== String(current.battleId) || Number(data.p.revision) !== Number(current.revision)) { if (current) await sendBattleState(current); return; }
        var applied = bridge().applyAction(fromId, Object.assign({}, data.p.action, { at: Date.now(), timeout: false })); if (applied.ok) { renderBattle(); await sendBattleState(applied.state); } return;
      }
      if (data.t === "battle-forfeit" && global.NmgMultiplayer.isHost() && Number(data.p && data.p.epoch) === lobbyEpoch) { var forfeited = bridge().forfeit(fromId, "leave"); if (forfeited.ok) { renderBattle(); await sendBattleState(forfeited.state); } return; }
      if (data.t === "battle-state" && data.p && data.p.state && Number(data.p.epoch) === lobbyEpoch && !global.NmgMultiplayer.isHost()) { if (!isCurrentBattleSnapshot(data.p.state) || !battleState()) return; var accepted = bridge().acceptSnapshot(data.p.state); if (accepted.ok) { setActionPending(false); renderBattle(); } }
    });
    global.NmgMultiplayer.on("onDisconnected", function (message) { stopMatchingWait(); var state = battleState(); if (state && state.status === "active") { bridge().forfeit(global.NmgMultiplayer.getPlayerId(), "disconnect"); renderBattle(); } else { if (bridge()) bridge().end(); setBattleMode(false); } ready = false; addLog("连接中断：" + message, "error"); syncRoomState("连接已中断"); setLobbyPage("identity"); });
    global.NmgMultiplayer.on("onError", function (message) { addLog("联机服务：" + message, "error"); });
  }
  function init(attempt) {
    entry = byId("onlineLobbyEntry"); overlay = byId("onlineLobbyOverlay");
    if (!entry || !overlay || !global.NmgTapLogin || !global.NmgMultiplayer || !global.NmgOnlineBattleCore || !bridge()) { if (Number(attempt) < 120) global.setTimeout(function () { init(Number(attempt) + 1); }, 250); return; }
    if (initialized) { refreshEntrySupport(0); return; } initialized = true; refreshEntrySupport(0);
    entry.addEventListener("click", function () { playSfx("uiClick"); open(); }); overlay.addEventListener("click", playLobbyClick); byId("onlineLobbyClose").addEventListener("click", close); byId("onlineLoginButton").addEventListener("click", login); byId("onlineProfileButton").addEventListener("click", syncProfileButton);
    byId("onlineConnectButton").addEventListener("click", connect); byId("onlineMatchButton").addEventListener("click", match); byId("onlineCreateButton").addEventListener("click", createPrivate); byId("onlineInviteOpenButton").addEventListener("click", function () { setLobbyPage("invite"); });
    byId("onlineJoinButton").addEventListener("click", joinPrivate); byId("onlineInviteButton").addEventListener("click", copyRoomInvite); byId("onlineInviteBack").addEventListener("click", inviteBack); byId("onlineMatchCancel").addEventListener("click", cancelMatch);
    byId("onlineReadyButton").addEventListener("click", toggleReady); byId("onlineLeaveButton").addEventListener("click", leave); byId("onlineBattleReturn").addEventListener("click", returnToLobby); byId("onlineBattleEndTurn").addEventListener("click", function () { useBattleAction({ type: "end" }); });
    byId("onlineBattleHand").addEventListener("click", function (event) { var card = event.target && event.target.closest && event.target.closest("[data-online-card]"); if (!card) return; var index = Number(card.dataset.onlineCard); if (selectedHandIndex === index) useBattleAction({ type: "play", handIndex: index }); else { selectedHandIndex = index; selectedHandKey = battleState().players[global.NmgMultiplayer.getPlayerId()].hand[index]; renderBattle(); } });
    byId("onlineCardConfirm").addEventListener("click", function () { if (selectedHandIndex >= 0) useBattleAction({ type: "play", handIndex: selectedHandIndex }); });
    byId("onlineEmoteToggle").addEventListener("click", function () { var menu = byId("onlineEmoteMenu"), open = menu.classList.contains("hidden"); menu.classList.toggle("hidden", !open); this.setAttribute("aria-expanded", String(open)); });
    byId("onlineEmoteMenu").addEventListener("click", function (event) { var button = event.target && event.target.closest && event.target.closest("[data-duel-emote]"); if (button) sendEmote(button.dataset.duelEmote); });
    byId("onlineHeroChoices").addEventListener("click", async function (event) { var button = event.target && event.target.closest && event.target.closest("[data-online-hero]"); if (!button || ready) return; selectedHeroId = button.dataset.onlineHero; byId("onlineHeroChoices").querySelectorAll("button").forEach(function (item) { item.classList.toggle("is-selected", item === button); }); triggerVoice("select", selectedHeroId, 0); if (currentRoom().inRoom) await sendConfig(); });
    byId("onlineCommonChoices").addEventListener("click", async function (event) {
      var button = event.target && event.target.closest && event.target.closest("[data-online-common]"); if (!button || ready) return;
      var key = button.dataset.onlineCommon;
      if (focusedCommonKey !== key) {
        focusedCommonKey = key;
        byId("onlineCommonChoices").querySelectorAll("button").forEach(function (item) { item.classList.toggle("is-focused", item === button); });
        renderCommonInspect(key);
        return;
      }
      await toggleCommonSelection(key, button);
    });
    bindRuntimeEvents(); battleClockTimer = global.setInterval(tickBattleClock, 500);
    global.document.addEventListener("visibilitychange", function () { if (!global.document.hidden) { refreshEntrySupport(0); syncProfileButton(); } });
    global.addEventListener("focus", function () { refreshEntrySupport(0); syncProfileButton(); }); global.addEventListener("resize", syncProfileButton); global.addEventListener("orientationchange", syncProfileButton); global.addEventListener("pageshow", syncProfileButton);
  }
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", function () { init(0); }, { once: true }); else init(0); }
  global.NmgOnlineLobby = { open: open, close: close };
})(typeof window !== "undefined" ? window : this);
