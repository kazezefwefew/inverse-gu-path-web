"use strict";
/* 蛊斗场大厅：登录、五屏大厅、带暗记邀请、整备轮次、权威快照与表现层。战斗真相只在 game.online。 */
(function createOnlineLobby(global) {
  var ACTION_ACK_TIMEOUT_MS = 4500;
  var EMOTE_COOLDOWN_MS = 3000;
  var BOT_ACTION_MIN_MS = 500;
  var BOT_ACTION_MAX_MS = 1100;
  var DUEL_RANK_STORAGE_KEY = "nmg_online_duel_rank_v1";
  var entry, overlay, profileMount = null, profileMountTimer = 0, battleClockTimer = 0, supportProbeTimer = 0, matchTimer = 0, botActionTimer = 0;
  var ready = false, initialized = false, actionPending = false, actionPendingTimer = 0, logSequence = 0;
  var selectedHeroId = "fate", selectedCommons = [], focusedCommonKey = "", selectedHandIndex = -1, selectedHandKey = "", draftPoolKeys = [];
  var roomMode = "random", playerConfigs = {}, rewardSettledBattleId = "", selectionNonce = "", inviteSecret = "", lobbyEpoch = 1;
  var lastRankSettlement = null;
  var renderedHp = {}, offlineTimers = {}, inviteCheckTimers = {}, authorizedInvitePlayers = {}, lastPresentedRevision = -1, lastEmoteSentAt = 0, lastEmoteReceivedAt = 0, matchStartedAt = 0, matchPoolProbeEnabled = false;
  var voiceBattleId = "", lowLifeBattleId = "", resultVoiceBattleId = "";
  var actionPresentationQueue = [], actionPresentationBusy = false, actionPresentationToken = 0, localCastSourceRect = null;
  var localBotActive = false, localSelfId = "", botPlayerId = "guardian-bot", matchRequestToken = 0;
  const HERO_ART = Object.freeze({
    fate: "assets/portraits/duel/hero-fate-clean.v3.webp", blood: "assets/portraits/duel/hero-blood-duel.webp",
    poison: "assets/portraits/duel/hero-poison-duel.webp", longevity: "assets/portraits/duel/hero-longevity-duel.webp",
    dragon: "assets/portraits/duel/hero-dragon-duel.webp", bone: "assets/portraits/hero-wenling.webp"
  });
  const CARD_ART = Object.freeze({
    strike: "assets/codex/gu/moonblade-gu.webp", devour: "assets/codex/gu/heart-devour-gu.webp", redFang: "assets/codex/gu/red-fang-gu.webp",
    pierce: "assets/codex/gu/heart-piercer-gu.webp", siphon: "assets/codex/gu/essence-siphon-gu.webp", leech: "assets/codex/gu/heart-leech-gu.webp",
    thunderGuide: "assets/codex/gu/thunder-guide-gu.webp", armorBreaker: "assets/codex/gu/armor-breaker-gu.webp",
    guard: "assets/codex/gu/iron-shell-gu.webp", molt: "assets/codex/gu/molted-armor-gu.webp", carapace: "assets/codex/gu/mystic-carapace-pvp-gu.webp",
    ward: "assets/codex/gu/calamity-ward-gu.webp", shell: "assets/codex/gu/broken-shell-gu.webp", mirror: "assets/codex/gu/mirror-carapace-gu.webp",
    hiddenMeridian: "assets/codex/gu/hidden-meridian-gu.webp", coiledShell: "assets/codex/gu/coiled-shell-gu.webp",
    insight: "assets/codex/gu/return-breath-gu.webp", gather: "assets/codex/gu/essence-gather-gu.webp", cleanse: "assets/codex/gu/cleanse-gu.webp",
    spore: "assets/codex/gu/miasma-spore-gu.webp", spring: "assets/codex/gu/spring-renewal-gu.webp", echo: "assets/codex/gu/breath-cicada-gu.webp",
    yuanVessel: "assets/codex/gu/yuan-vessel-gu.webp", borrowLife: "assets/codex/gu/borrow-life-gu.webp",
    fateSeal: "assets/codex/gu/fate-sever-gu.webp", fateThread: "assets/codex/gu/fate-thread-gu.webp", reversePath: "assets/codex/gu/inverse-path-gu.webp", fixedNumber: "assets/codex/gu/fixed-fate-gu.webp",
    bloodSacrifice: "assets/codex/gu/blood-sacrifice-gu.webp", bloodThirst: "assets/codex/gu/blood-thirst-gu.webp", bloodRobe: "assets/codex/gu/blood-robe-gu.webp", bloodTide: "assets/codex/gu/blood-tide-gu.webp",
    greenMiasma: "assets/codex/gu/green-miasma-gu.webp", insectSwarm: "assets/codex/gu/swarm-gu.webp", moltingShell: "assets/codex/gu/molting-shell-gu.webp", returningPoison: "assets/codex/gu/return-poison-gu.webp",
    lifeFlame: "assets/codex/gu/life-flame-gu.webp", witheredBloom: "assets/codex/gu/withered-bloom-gu.webp", lifePyre: "assets/codex/gu/life-pyre-scorpion.webp", lifeRenew: "assets/codex/gu/return-life-gu.webp",
    scaleHiding: "assets/codex/gu/scale-hiding-gu.webp", reverseScale: "assets/codex/gu/reverse-scale-gu.webp", chiBreath: "assets/codex/gu/chi-breath-gu.webp", boneMolt: "assets/codex/gu/bone-molt-gu.webp",
    boneBell: "assets/codex/gu/bonebell-gu.webp", boneSacrifice: "assets/codex/gu/knock-armor-gu.webp", boneSever: "assets/codex/gu/break-joint-gu.webp", afterEcho: "assets/codex/gu/after-echo-gu.webp", boneCourt: "assets/codex/gu/bone-court-gu.webp"
  });
  const HERO_MECHANIC_SUMMARY = Object.freeze({
    fate: "命势换类蓄势；每满 3 点回元并抽蛊", blood: "自损与血蛊积攒血煞，伤害随血煞增长",
    poison: "每回合施毒；毒牌命中中毒者触发蚀毒", longevity: "寿元既是燃料也是性命，残寿提高伤害",
    dragon: "攻防各自积鳞，七鳞后可主动龙化", bone: "护甲、破甲、碎甲共鸣，三鸣可二择一"
  });
  const ABILITY_PRESENTATION = Object.freeze({
    dragonTransform: { name: "七鳞龙化", art: "assets/codex/gu/reverse-scale-gu.webp", kind: "support" },
    boneSoul: { name: "骨鸣·镇魂", art: "assets/codex/gu/bonebell-gu.webp", kind: "defense" },
    boneFate: { name: "骨鸣·断命", art: "assets/codex/gu/break-joint-gu.webp", kind: "attack" }
  });
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
    if (name === "identity") { renderDuelRank(); global.setTimeout(syncProfileButton, 40); } else destroyProfileButton();
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
  function loadDuelRank(at) {
    var raw = null;
    try { raw = JSON.parse(global.localStorage.getItem(DUEL_RANK_STORAGE_KEY) || "null"); } catch (error) { raw = null; }
    return global.NmgDuelRank.normalize(raw, at);
  }
  function saveDuelRank(state) {
    try { global.localStorage.setItem(DUEL_RANK_STORAGE_KEY, JSON.stringify(state)); return true; } catch (error) { return false; }
  }
  function rewardSummary(reward) {
    if (!reward) return "暂无";
    return [reward.scrip ? "蛊钱 " + reward.scrip : "", reward.materialEach ? "全材各 " + reward.materialEach : "", reward.randomMaterial ? "随机炼材 " + reward.randomMaterial : "", reward.bossCores ? "残核 " + reward.bossCores : "", reward.guEmbryo ? "蛊胎 " + reward.guEmbryo : "", reward.kindleSand ? "引火砂 " + reward.kindleSand : "", reward.guWard ? "固蛊符 " + reward.guWard : ""].filter(Boolean).join(" · ");
  }
  function renderDuelRank(state) {
    if (!global.NmgDuelRank) return;
    var normalized = global.NmgDuelRank.normalize(state || loadDuelRank(), Date.now());
    var tier = global.NmgDuelRank.tierFor(normalized.points), tiers = global.NmgDuelRank.tiers;
    var today = normalized.daily[global.NmgDuelRank.dayKey(Date.now())] || { rated: 0 };
    setText("onlineRankSeason", normalized.seasonId.replace("-", "年") + "月赛季");
    setText("onlineRankName", tier.name); setText("onlineRankPoints", normalized.points);
    setText("onlineRankDaily", "今日 " + Math.min(global.NmgDuelRank.dailyRatedCap, Math.max(0, today.rated | 0)) + "/" + global.NmgDuelRank.dailyRatedCap + " 场");
    var icon = byId("onlineRankIcon"); if (icon) { icon.src = tier.icon; icon.alt = tier.name + "段位徽章"; icon.dataset.tone = tier.tone; }
    var maximum = tiers[tiers.length - 1].min, progress = byId("onlineRankProgress");
    if (progress) progress.style.width = Math.min(100, normalized.points / maximum * 100) + "%";
    var ladder = byId("onlineRankCard"); if (ladder) ladder.querySelectorAll(".online-rank-ladder > span").forEach(function (node, index) { node.classList.toggle("is-reached", index <= tiers.indexOf(tier)); });
    var claims = new Set(normalized.rewardClaims || []), day = global.NmgDuelRank.dayKey(Date.now()), week = normalized.weekly || {};
    var firstMatch = claims.has("daily:" + day + ":first-match"), humanWin = claims.has("daily:" + day + ":human-first-win"), botWin = claims.has("daily:" + day + ":bot-first-win");
    setText("onlineRankDailyReward", (firstMatch ? "首场已领" : "首场待领") + " · " + (humanWin ? "真人首胜已领" : "真人首胜待领") + " · " + (botWin ? "傀儡首胜已领" : "傀儡首胜待领"));
    setText("onlineRankWeeklyReward", "排位 " + Math.min(5, Math.max(0, week.rated | 0)) + "/5 场" + (claims.has("weekly:" + week.weekKey + ":five") ? " · 已领" : ""));
    var tierIndex = tiers.indexOf(tier), nextTier = tiers[Math.min(tiers.length - 1, tierIndex + 1)], nextReward = global.NmgDuelRank.PROMOTION_REWARDS[nextTier.id];
    setText("onlineRankNextChest", tierIndex >= tiers.length - 1 ? "祖庭已登顶" : nextTier.name + "宝匣 · " + rewardSummary(nextReward));
    setText("onlineRankSeasonReward", "当前预计 · " + rewardSummary(global.NmgDuelRank.SEASON_REWARDS[tier.id]));
  }
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
  function normalizePublicTitleId(value) {
    return global.NmgTitles && typeof global.NmgTitles.normalizePublicTitleId === "function"
      ? global.NmgTitles.normalizePublicTitleId(value)
      : "";
  }
  function getLocalTitleId() {
    return global.NmgTitles && typeof global.NmgTitles.getEquippedTitleId === "function"
      ? normalizePublicTitleId(global.NmgTitles.getEquippedTitleId())
      : "";
  }
  function getPublicTitle(value) {
    var titleId = normalizePublicTitleId(value);
    return titleId && global.NmgTitles && typeof global.NmgTitles.getPublicTitle === "function"
      ? global.NmgTitles.getPublicTitle(titleId)
      : null;
  }
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
      nickname: cleanNickname(value.nickname), titleId: normalizePublicTitleId(value.titleId), mode: value.mode === "private" ? "private" : "random",
      nonce: String(value.nonce || "").replace(/[^a-f0-9]/gi, "").slice(0, 64), epoch: Math.max(1, Number(value.epoch) || 1) };
  }
  function profilePayload(extra) {
    var login = global.NmgTapLogin.getState();
    return Object.assign({ heroId: selectedHeroId, commons: selectedCommons.slice(), nickname: cleanNickname(login.profile && login.profile.nickname), titleId: getLocalTitleId(),
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
    renderHeroGuPreview();
  }
  function renderHeroGuPreview() {
    var holder = byId("onlineHeroGuPreview"), cards = global.NmgOnlineBattleCore.cards;
    if (!holder || !cards) return;
    holder.textContent = "";
    var summary = global.document.createElement("small"); summary.textContent = HERO_MECHANIC_SUMMARY[selectedHeroId] || ""; holder.appendChild(summary);
    global.NmgOnlineBattleCore.heroSpecialKeys(selectedHeroId).forEach(function (key) {
      var card = cards[key], chip = global.document.createElement("span"); chip.textContent = card.name; chip.title = card.text; holder.appendChild(chip);
    });
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
    setDisabled("onlineReadyButton", (!localBotActive && (!currentRoom().inRoom || currentRoom().playerCount !== 2)) || selectedCommons.length !== 6);
    if (currentRoom().inRoom && !localBotActive) await sendConfig();
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
    setText("onlineLobbyStatus", message || (localBotActive ? "守擂傀儡 · 明牌对战" : state.inRoom ? (roomMode === "random" ? "随机蛊斗房" : "邀请切磋房") : state.connected ? "联机服务已连接" : "等待连接"));
    setText("onlineRoomId", localBotActive ? "守擂席" : shortId(state.roomId)); setText("onlinePlayerCount", localBotActive ? "1 人 + 1 傀儡" : String(state.playerCount || 0) + " / 2");
    setDisabled("onlineConnectButton", !login.authenticated || state.connected); setDisabled("onlineMatchButton", !state.connected || state.inRoom || localBotActive);
    setDisabled("onlineCreateButton", !state.connected || state.inRoom || localBotActive); setDisabled("onlineInviteOpenButton", !state.connected || state.inRoom || localBotActive);
    setDisabled("onlineJoinButton", !state.connected || state.inRoom || localBotActive); setDisabled("onlineInviteButton", !state.inRoom || roomMode !== "private");
    setDisabled("onlineReadyButton", (!localBotActive && (!state.inRoom || state.playerCount < 2)) || selectedCommons.length !== 6); setDisabled("onlineLeaveButton", !state.inRoom && !localBotActive);
    var readyButton = byId("onlineReadyButton"); if (readyButton) readyButton.textContent = ready ? "取消准备" : "选定蛊修并准备";
  }
  function renderProfile(profile, pending) {
    var avatar = byId("onlineProfileAvatar");
    var titleNode = byId("onlineProfileTitle"), equippedTitle = getPublicTitle(getLocalTitleId());
    var profileUnavailable = global.NmgTapLogin && global.NmgTapLogin.getState().status === "profile-unavailable";
    if (profile) {
      setText("onlineProfileName", profile.nickname || "求命者"); setText("onlineProfileHint", "TapTap 身份已就绪");
      if (avatar && profile.avatarUrl) { avatar.textContent = ""; avatar.style.backgroundImage = 'url("' + String(profile.avatarUrl).replace(/["\\]/g, "") + '")'; }
    } else {
      setText("onlineProfileName", profileUnavailable ? "已登录 · 昵称权限未开放" : pending ? "已登录 · 待授权昵称" : "尚未登录");
      setText("onlineProfileHint", profileUnavailable ? "在 TapTap 后台开启头像昵称权限后即可显示真实身份" : pending ? "轻触右侧按钮授权头像昵称" : "先完成 TapTap 登录");
      if (avatar) { avatar.textContent = "命"; avatar.style.backgroundImage = ""; }
    }
    if (titleNode) { titleNode.textContent = equippedTitle ? "「" + equippedTitle.title + "」" : ""; titleNode.classList.toggle("hidden", !equippedTitle); }
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
    if (player.weaken > 0) chip("衰老 " + player.weaken, "");
    if (player.breakEchoArmed) chip("余响待发", "is-charged");
    var resource = player.resource || {};
    if (resource.key === "fate") chip("命势 " + resource.value + "/" + resource.max, resource.value >= 2 ? "is-charged" : "");
    else if (resource.key === "blood") chip("血煞 " + resource.value + "/" + resource.max, resource.value >= 6 ? "is-charged" : "");
    else if (resource.key === "poison") chip(resource.corrosionUsedThisTurn ? "蚀毒已发" : "蚀毒待发", resource.corrosionUsedThisTurn ? "" : "is-charged");
    else if (resource.key === "longevity") chip("寿元 " + resource.value + "/" + resource.max, resource.value <= 6 ? "is-charged" : "");
    else if (resource.key === "dragon") chip(resource.transformedTurns > 0 ? "龙化 " + resource.transformedTurns + " 回合" : "龙鳞 " + resource.value + "/" + resource.max, resource.value >= 7 || resource.transformedTurns > 0 ? "is-charged" : "");
    else if (resource.key === "bone") chip("骨鸣 " + resource.value + "/" + resource.max, resource.value >= 3 && !resource.chimeUsed ? "is-charged" : "");
  }
  function renderPartyCard(id, player, playerId, activePlayerId) {
    var node = byId(id); if (!node || !player) return; node.textContent = "";
    var art = global.document.createElement("div"); art.className = "online-duelist-art"; art.style.backgroundImage = 'url("' + (HERO_ART[player.heroId] || HERO_ART.fate) + '")';
    var veil = global.document.createElement("div"); veil.className = "online-duelist-veil";
    var title = global.document.createElement("strong"); title.textContent = (id === "onlineBattleSelf" ? "你 · " : "对手 · ") + player.name;
    var publicTitle = getPublicTitle(playerConfigs[String(playerId)] && playerConfigs[String(playerId)].titleId);
    var titleBadge = global.document.createElement("em"); titleBadge.className = "online-duelist-title"; titleBadge.textContent = publicTitle ? "「" + publicTitle.title + "」" : ""; titleBadge.classList.toggle("hidden", !publicTitle);
    var hp = global.document.createElement("span"); hp.className = "online-duelist-hp"; hp.innerHTML = '<i style="width:' + Math.max(0, Math.min(100, player.hp / player.maxHp * 100)) + '%"></i>';
    var detail = global.document.createElement("small"); detail.textContent = player.pathName + "　命 " + player.hp + "/" + player.maxHp + "　甲 " + player.armor + "　元 " + player.energy;
    var statuses = global.document.createElement("div"); statuses.id = id === "onlineBattleSelf" ? "onlineBattleSelfStatuses" : "onlineBattleAllyStatuses"; statuses.className = "online-duelist-statuses"; renderStatuses(statuses, player);
    veil.appendChild(title); veil.appendChild(titleBadge); veil.appendChild(hp); veil.appendChild(detail); node.appendChild(art); node.appendChild(veil); node.appendChild(statuses);
    node.classList.toggle("is-turn", String(playerId) === String(activePlayerId));
    if (renderedHp[playerId] != null && player.hp < renderedHp[playerId]) { node.classList.remove("was-hit"); void node.offsetWidth; node.classList.add("was-hit"); global.setTimeout(function () { node.classList.remove("was-hit"); }, 380); }
    renderedHp[playerId] = player.hp;
  }
  function renderCardInspect(self) {
    var holder = byId("onlineCardInspect"), cards = global.NmgOnlineBattleCore.cards;
    if (!holder || selectedHandIndex < 0 || !self || !self.hand[selectedHandIndex]) { toggleHidden("onlineCardInspect", true); return; }
    var key = self.hand[selectedHandIndex], card = cards[key], reason = global.NmgOnlineBattleCore.cardPlayableReason(self, card); selectedHandKey = key;
    var detail = holder.querySelector("div"); detail.querySelector("b").textContent = card.name; detail.querySelector("small").textContent = reason || ("消耗 " + card.cost + " 真元"); detail.querySelector("p").textContent = card.text;
    setDisabled("onlineCardConfirm", !!reason || actionPending); toggleHidden("onlineCardInspect", false);
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
    var actor = state.players[action.actorId], mechanic = String(action.mechanic || "");
    if (actor && mechanic) triggerVoice(mechanic.indexOf("poison") >= 0 || mechanic === "corrosion" ? "corrosion" : mechanic.indexOf("blood") >= 0 ? "sacrifice" : mechanic.indexOf("dragon") >= 0 ? "transform" : mechanic.indexOf("bone") >= 0 ? "chime" : mechanic.indexOf("fate") >= 0 ? "fulfill" : "restore", actor.heroId, state.round);
  }
  function actionAnchorFromRect(rect) {
    if (!rect) return null;
    return { getBoundingClientRect: function () { return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.left + rect.width, bottom: rect.top + rect.height }; } };
  }
  async function drainActionPresentationQueue() {
    if (actionPresentationBusy || !actionPresentationQueue.length) return;
    actionPresentationBusy = true;
    var item = actionPresentationQueue.shift(), action = item.action, state = item.state, selfId = item.selfId, token = item.token;
    var cards = global.NmgOnlineBattleCore.cards, ability = ABILITY_PRESENTATION[action.mechanic], card = cards[action.cardKey] || ability || cards.strike;
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
          card: { name: card.name, art: (ability && ability.art) || CARD_ART[action.cardKey] || CARD_ART.strike, turn: 1 },
          side: mine ? "self" : "opponent",
          kind: (ability && ability.kind) || (offensive ? "attack" : (action.armor > 0 ? "defense" : "support")),
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
  function claimDuelContext(rankState, context, collected) {
    if (typeof global.claimDuelRankRewards !== "function") return rankState;
    var claimed = global.claimDuelRankRewards(rankState, context);
    if (claimed.rankState) rankState = claimed.rankState;
    if (claimed.ok && Array.isArray(claimed.rewardLines)) collected.push.apply(collected, claimed.rewardLines);
    return rankState;
  }
  function settleReward(state, selfId, enemyId) {
    if (!state || state.status !== "finished") return null;
    if (rewardSettledBattleId === state.battleId) return lastRankSettlement;
    rewardSettledBattleId = state.battleId;
    var result = global.NmgDuelRank.applyResult(loadDuelRank(), {
      battleId: state.battleId, opponentId: enemyId, mode: state.mode,
      won: String(state.winnerId) === String(selfId), at: Date.now()
    });
    var rankState = result.state, rewardLines = [], at = Date.now();
    if (result.ok) {
      var opponentType = state.mode === "bot" ? "bot" : "human";
      rankState = claimDuelContext(rankState, { kind: "rated-match", opponentType: opponentType, won: String(state.winnerId) === String(selfId), at: at }, rewardLines);
      if (String(state.winnerId) === String(selfId)) rankState = claimDuelContext(rankState, { kind: opponentType === "bot" ? "bot-win" : "human-win", at: at }, rewardLines);
      rankState = claimDuelContext(rankState, { kind: "weekly", at: at }, rewardLines);
      if (result.promoted) rankState = claimDuelContext(rankState, { kind: "promotion", tierId: result.tier.id, at: at }, rewardLines);
      result.state = rankState; result.rewardLines = rewardLines;
    }
    if (result.ok || result.recorded) saveDuelRank(rankState);
    renderDuelRank(rankState);
    if (result.ok) addLog((result.delta >= 0 ? "赛季荣誉 +" : "赛季荣誉 ") + result.delta + (result.promoted ? " · 晋升 " + result.tier.name : ""), "ok");
    else if (result.reason === "daily-cap") addLog("今日 8 场计分已满，本局仅记切磋", "ok");
    else if (result.reason === "bot-cap") addLog("今日 3 场傀儡计分已满，本局仅记切磋", "ok");
    else if (result.reason === "opponent-cap") addLog("同一对手今日已计 2 场，本局不再计分", "ok");
    else addLog("邀请切磋不计入赛季荣誉", "ok");
    if (rewardLines.length) {
      addLog("排位奖励：" + rewardLines.join("，"), "ok");
      if (global.NmgOutgameReceipts?.enqueue) global.NmgOutgameReceipts.enqueue({ source: "蛊斗场", title: "排位重赏入库", subtitle: state.mode === "bot" ? "守擂傀儡 · 明确标注" : "真人排位", summary: rewardLines.join("，"), items: rewardLines.map(function (line) { return { glyph: "赏", name: line, detail: "已存入蛊庐", amount: 1, tone: "gold" }; }) });
    }
    lastRankSettlement = result; return result;
  }
  function renderBattleResult(state, won, rankResult) {
    var holder = byId("onlineBattleResult"); if (!holder) return;
    holder.textContent = ""; holder.classList.toggle("is-victory", !!won); holder.classList.toggle("is-defeat", !won);
    var seal = global.document.createElement("i"); seal.className = "online-result-seal"; seal.textContent = won ? "胜" : "败";
    var title = global.document.createElement("strong"); title.textContent = won ? "蛊斗告捷" : "此局落败";
    var detail = global.document.createElement("small"), rankText = "邀请切磋 · 不计赛季荣誉";
    if (rankResult && rankResult.ok) rankText = rankResult.delta > 0 ? "赛季荣誉 +" + rankResult.delta + (rankResult.promoted ? " · 晋升 " + rankResult.tier.name : "") : "定级保护 · 荣誉不扣";
    else if (rankResult && rankResult.reason === "daily-cap") rankText = "今日计分已满 · 本局仅记切磋";
    else if (rankResult && rankResult.reason === "opponent-cap") rankText = "同对手计分已满 · 本局不再计分";
    detail.textContent = rankText;
    holder.appendChild(seal); holder.appendChild(title); holder.appendChild(detail);
  }
  function driveBotTurn() {
    if (!localBotActive || botActionTimer || !global.NmgDuelBot) return;
    var state = battleState();
    if (!state || state.status !== "active" || String(state.activePlayerId) !== botPlayerId) return;
    var picked = global.NmgDuelBot.chooseAction(state, botPlayerId);
    if (!picked || !picked.action) picked = { action: { type: "end" }, intent: "收势观察" };
    var delay = BOT_ACTION_MIN_MS + (Math.abs((Number(state.revision) * 131 + Number(state.round) * 47) | 0) % (BOT_ACTION_MAX_MS - BOT_ACTION_MIN_MS + 1));
    setText("onlineBotIntent", "守擂傀儡 · " + (picked.intent || "推演中")); toggleHidden("onlineBotIntent", false);
    botActionTimer = global.setTimeout(function () {
      botActionTimer = 0;
      var current = battleState();
      if (!localBotActive || !current || current.status !== "active" || String(current.activePlayerId) !== botPlayerId) return;
      var applied = bridge().applyAction(botPlayerId, Object.assign({}, picked.action, { at: Date.now() }));
      if (!applied.ok) applied = bridge().applyAction(botPlayerId, { type: "end", at: Date.now() });
      if (!applied.ok) addLog("守擂傀儡行动未能结算", "error");
      renderBattle();
    }, delay);
  }
  function renderBattle() {
    var state = battleState(); if (!state) return;
    var selfId = localBotActive ? localSelfId : String(global.NmgMultiplayer.getPlayerId() || ""), enemyId = state.order.find(function (id) { return String(id) !== selfId; }) || state.order[1];
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
      var card = cards[key], reason = global.NmgOnlineBattleCore.cardPlayableReason(self, card), button = global.document.createElement("button"); button.type = "button"; button.dataset.onlineCard = String(index); button.disabled = !myTurn || actionPending || !!reason; button.title = reason || card.text; button.classList.toggle("is-selected", index === selectedHandIndex);
      var art = global.document.createElement("i"); art.className = "online-card-art"; art.style.backgroundImage = 'url("' + (CARD_ART[key] || CARD_ART.strike) + '")';
      var name = global.document.createElement("b"); name.textContent = card.name; var cost = global.document.createElement("small"); cost.textContent = "真元 " + card.cost; var text = global.document.createElement("span"); text.textContent = card.text;
      button.appendChild(art); button.appendChild(name); button.appendChild(cost); button.appendChild(text); hand.appendChild(button);
    }); }
    renderCardInspect(self); setDisabled("onlineBattleEndTurn", !myTurn || actionPending);
    var drawReady = myTurn && !actionPending && self.hand.length === 0 && self.energy >= 1 && !self.freeDrawUsed && (self.draw.length > 0 || self.discard.length > 0);
    toggleHidden("onlineBattleDrawButton", !drawReady); setDisabled("onlineBattleDrawButton", !drawReady);
    var resource = self.resource || {}, dragonReady = resource.key === "dragon" && resource.value >= 7 && resource.transformedTurns <= 0;
    var boneReady = resource.key === "bone" && resource.value >= 3 && !resource.chimeUsed;
    toggleHidden("onlineDragonTransform", resource.key !== "dragon"); setDisabled("onlineDragonTransform", !myTurn || actionPending || !dragonReady);
    toggleHidden("onlineBoneSoul", resource.key !== "bone"); setDisabled("onlineBoneSoul", !myTurn || actionPending || !boneReady);
    toggleHidden("onlineBoneFate", resource.key !== "bone"); setDisabled("onlineBoneFate", !myTurn || actionPending || !boneReady || self.armor <= 0);
    var events = byId("onlineBattleEvents"); if (events) { events.innerHTML = (state.events || []).map(function (text) { return "<li>" + String(text).replace(/[<>&]/g, "") + "</li>"; }).join(""); events.scrollTop = events.scrollHeight; }
    presentLastAction(state, selfId);
    var finished = state.status === "finished"; toggleHidden("onlineBattleResult", !finished); toggleHidden("onlineBattleReturn", !finished);
    if (finished) {
      var won = String(state.winnerId) === selfId, rankResult = settleReward(state, selfId, enemyId); renderBattleResult(state, won, rankResult);
      if (resultVoiceBattleId !== state.battleId) { resultVoiceBattleId = state.battleId; triggerVoice(won ? "victory" : "defeat", self.heroId, state.round); playSfx(won ? "victory" : "defeat", null, .9); }
    } else if (localBotActive) driveBotTurn();
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
    rewardSettledBattleId = ""; lastRankSettlement = null; setActionPending(false); renderBattle(); addLog("双方蛊组封定，蛊斗开始", "ok");
    if (!(await global.NmgMultiplayer.send("battle-start", { state: created.state, epoch: lobbyEpoch })).ok) await leave();
  }
  async function useBattleAction(action) {
    var state = battleState(), selfId = localBotActive ? localSelfId : String(global.NmgMultiplayer.getPlayerId() || "");
    if (!state || state.status !== "active" || String(state.activePlayerId) !== selfId || actionPending) return;
    if (action && action.type === "play") {
      var sourceCard = byId("onlineBattleHand") && byId("onlineBattleHand").querySelector('[data-online-card="' + Number(action.handIndex) + '"]');
      if (sourceCard && sourceCard.getBoundingClientRect) {
        var sourceRect = sourceCard.getBoundingClientRect();
        localCastSourceRect = { left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height };
      }
    }
    selectedHandIndex = -1; selectedHandKey = ""; setActionPending(true); renderBattle();
    if (localBotActive) {
      var localApplied = bridge().applyAction(selfId, Object.assign({}, action, { at: Date.now() }));
      setActionPending(false);
      if (!localApplied.ok) addLog(localApplied.error || "行动未能结算", "error");
      renderBattle(); return;
    }
    if (global.NmgMultiplayer.isHost()) {
      var previous = state, applied = bridge().applyAction(selfId, Object.assign({}, action, { at: Date.now() }));
      if (!applied.ok) { setActionPending(false); addLog(applied.error, "error"); renderBattle(); return; }
      var synced = await sendBattleState(applied.state); setActionPending(false);
      if (!synced.ok && bridge().restore) { bridge().restore(previous); addLog("本次行动已回退，可重新尝试", "error"); }
      renderBattle(); return;
    }
    var sent = await global.NmgMultiplayer.send("battle-action", { battleId: state.battleId, revision: state.revision, action: action, epoch: lobbyEpoch });
    if (!sent.ok) { setActionPending(false); addLog("行动未送达：" + sent.error, "error"); renderBattle(); }
  }
  async function tickBattleClock() {
    var state = battleState(); if (!state || state.status !== "active") return;
    var seconds = Math.max(0, Math.ceil((Number(state.turnDeadline) - Date.now()) / 1000)), selfId = localBotActive ? localSelfId : String(global.NmgMultiplayer.getPlayerId() || ""), mine = String(state.activePlayerId) === selfId;
    setText("onlineBattleTurn", (mine ? "轮到你出牌" : "等待对手行动") + " · " + seconds + "秒");
    if (localBotActive) {
      if (!mine) { driveBotTurn(); return; }
      if (seconds > 0 || actionPending) return;
      setActionPending(true); bridge().applyAction(selfId, { type: "end", timeout: true, at: Date.now() }); setActionPending(false); renderBattle(); return;
    }
    if (seconds > 0 || !global.NmgMultiplayer.isHost() || actionPending) return;
    setActionPending(true); var previous = state, applied = bridge().applyAction(state.activePlayerId, { type: "end", timeout: true, at: Date.now() });
    if (applied.ok) { var synced = await sendBattleState(applied.state); if (!synced.ok && bridge().restore) bridge().restore(previous); }
    setActionPending(false); renderBattle();
  }
  async function beginPrepEpoch(nextEpoch, broadcast) {
    lobbyEpoch = Math.max(lobbyEpoch + (broadcast ? 1 : 0), Number(nextEpoch) || 1); ready = false; playerConfigs = {}; selectionNonce = freshNonce();
    selectedCommons = []; selectedHandIndex = -1; selectedHandKey = ""; if (bridge()) bridge().end(); setBattleMode(false);
    await global.NmgMultiplayer.setReady(false); renderDraftPool(currentRoom().roomId); setLobbyPage("preparing"); syncRoomState("等待双方重新整备");
    if (broadcast) await global.NmgMultiplayer.send("prep-epoch", { epoch: lobbyEpoch }); await sendConfig();
  }
  async function returnToLobby() {
    setActionPending(false);
    if (localBotActive) {
      stopBotAction(); if (bridge()) bridge().end(); ready = false; selectedCommons = []; selectedHandIndex = -1; selectedHandKey = ""; selectionNonce = freshNonce();
      renderDraftPool("guardian-bot|" + Date.now()); setBattleMode(false); setLobbyPage("preparing"); syncRoomState("守擂傀儡仍在席 · 可重新整备"); addLog("新一轮蛊池已生成，可再次挑战守擂傀儡", "ok"); return;
    }
    await beginPrepEpoch(lobbyEpoch, true); addLog("新一轮蛊池已生成，可在原房再战", "ok");
  }
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
  function summarizeVisibleMatchPool(rooms) {
    var total = 0, exact = true;
    (Array.isArray(rooms) ? rooms : []).forEach(function (room) {
      var count = 0, known = false;
      if (room && room.playerCount != null && Number.isFinite(Number(room.playerCount))) {
        count = Math.max(0, Number(room.playerCount)); known = true;
      } else if (room && Array.isArray(room.players)) {
        count = room.players.length; known = true;
      }
      if (known && count >= 2) return;
      if (!known || count < 1) { count = 1; exact = false; }
      total += count;
    });
    return { count: total, exact: exact };
  }
  async function updateMatchFacts() {
    if (!matchStartedAt) return; var elapsed = Math.max(0, Math.floor((Date.now() - matchStartedAt) / 1000)); setText("onlineMatchElapsed", "已等待 " + elapsed + " 秒");
    setText("onlineMatchEstimate", elapsed < 15 ? "约 10–45 秒" : elapsed < 45 ? "约 15–60 秒" : "匹配池较少，继续等待");
    if (!matchPoolProbeEnabled) { setText("onlineMatchPool", "正在接入匹配池"); return; }
    if (elapsed % 5 !== 0) return; var result = await global.NmgMultiplayer.getRoomList("pvp-random-v1");
    if (!result.supported) setText("onlineMatchPool", "当前容器不提供候场人数");
    else if (!result.ok) setText("onlineMatchPool", "暂时无法探查");
    else {
      var visible = summarizeVisibleMatchPool(result.rooms);
      if (!visible.count) setText("onlineMatchPool", "暂未发现候场者");
      else setText("onlineMatchPool", (visible.exact ? "" : "至少 ") + visible.count + " 人候场（平台可见）");
    }
  }
  function stopBotAction() { if (botActionTimer) global.clearTimeout(botActionTimer); botActionTimer = 0; toggleHidden("onlineBotIntent", true); }
  function startMatchingWait(allowPoolProbe) { stopMatchingWait(); matchPoolProbeEnabled = !!allowPoolProbe; matchStartedAt = Date.now(); setLobbyPage("matching"); updateMatchFacts(); matchTimer = global.setInterval(updateMatchFacts, 1000); }
  async function enterRoom(result, mode, text) {
    if (!result.ok) { stopMatchingWait(); addLog(text + "失败：" + result.error, "error"); setLobbyPage("modes"); syncRoomState(); return; }
    roomMode = mode; ready = false; playerConfigs = {}; authorizedInvitePlayers = {}; lobbyEpoch = 1; selectionNonce = freshNonce(); renderDraftPool(currentRoom().roomId); syncRoomState(); await sendConfig();
    if (mode === "random" && currentRoom().playerCount < 2) { addLog("已进入匹配池，等待对手", "ok"); startMatchingWait(true); }
    else if (mode === "private" && currentRoom().playerCount < 2) { setText("onlineInviteCode", encodeInviteCode(currentRoom().roomId, inviteSecret)); setLobbyPage("invite"); addLog("邀请房已创建，复制蛊印给好友", "ok"); }
    else { stopMatchingWait(); setLobbyPage("preparing"); addLog(text + "成功，双方开始整备", "ok"); }
  }
  async function match() {
    destroyProfileButton(); localBotActive = false; roomMode = "random"; inviteSecret = ""; startMatchingWait(false);
    var token = ++matchRequestToken, result = await global.NmgMultiplayer.matchRoom(2, "pvp-random-v1", profilePayload());
    if (token !== matchRequestToken) { if (global.NmgMultiplayer.getState().inRoom) await global.NmgMultiplayer.leaveRoom(); return; }
    await enterRoom(result, "random", "随机匹配");
  }
  function continueHumanMatch() { addLog("继续等待真人；守擂傀儡仍可随时选择", "ok"); }
  async function startBotMatch() {
    matchRequestToken += 1; stopMatchingWait(); stopBotAction();
    if (global.NmgMultiplayer.getState().inRoom) await global.NmgMultiplayer.leaveRoom();
    localBotActive = true; roomMode = "bot"; ready = false; playerConfigs = {}; selectionNonce = freshNonce();
    renderDraftPool("guardian-bot|" + Date.now()); setLobbyPage("preparing"); syncRoomState("守擂傀儡已就位 · 请选择六只通用蛊");
    addLog("已选择守擂傀儡：同规则、最强决策、明确标注", "ok");
  }
  function startLocalBotBattle() {
    var selfId = String(global.NmgMultiplayer.getPlayerId() || "local-player"), seed = "guardian|" + Date.now() + "|" + selectionNonce;
    localSelfId = selfId;
    var botLoadout = global.NmgDuelBot.chooseLoadout(seed), login = global.NmgTapLogin.getState(), heroes = {}, loadouts = {}, names = {};
    heroes[selfId] = selectedHeroId; heroes[botPlayerId] = botLoadout.heroId; loadouts[selfId] = selectedCommons.slice(); loadouts[botPlayerId] = botLoadout.commons;
    names[selfId] = cleanNickname(login.profile && login.profile.nickname); names[botPlayerId] = "守擂傀儡";
    playerConfigs[selfId] = { heroId: selectedHeroId, commons: selectedCommons.slice(), nickname: names[selfId], titleId: getLocalTitleId(), mode: "bot", nonce: selectionNonce, epoch: lobbyEpoch };
    playerConfigs[botPlayerId] = { heroId: botLoadout.heroId, commons: botLoadout.commons, nickname: "守擂傀儡", titleId: "", mode: "bot", nonce: "guardian", epoch: lobbyEpoch };
    var created = bridge().create({ playerIds: [selfId, botPlayerId], heroes: heroes, loadouts: loadouts, names: names, mode: "bot", seed: seed, battleId: "bot-" + Date.now() });
    if (!created.ok) { addLog("守擂傀儡开局失败：" + created.error, "error"); return; }
    rewardSettledBattleId = ""; lastRankSettlement = null; ready = true; setActionPending(false); renderBattle(); addLog("守擂傀儡应战 · 它不会读取你的手牌", "ok");
  }
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
    if (selectedCommons.length !== 6) return;
    if (localBotActive) { if (!battleState()) startLocalBotBattle(); return; }
    var result = await global.NmgMultiplayer.setReady(!ready);
    if (!result.ok) { addLog("准备同步失败：" + result.error, "error"); return; } ready = result.ready; await sendConfig(); addLog(ready ? "你已准备" : "你已取消准备", "ok"); syncRoomState(); maybeStartBattle();
  }
  async function leave() {
    stopMatchingWait(); stopBotAction(); matchRequestToken += 1;
    if (localBotActive) { if (bridge()) bridge().end(); localBotActive = false; roomMode = "random"; ready = false; playerConfigs = {}; setBattleMode(false); syncRoomState("联机服务已连接"); setLobbyPage("modes"); addLog("已离开守擂席", "ok"); return; }
    var state = battleState(), selfId = global.NmgMultiplayer.getPlayerId();
    if (state && state.status === "active") { if (global.NmgMultiplayer.isHost()) { var lost = bridge().forfeit(selfId, "leave"); if (lost.ok) await sendBattleState(lost.state); } else await global.NmgMultiplayer.send("battle-forfeit", { battleId: state.battleId, revision: state.revision, epoch: lobbyEpoch }); }
    Object.keys(offlineTimers).forEach(function (id) { global.clearTimeout(offlineTimers[id]); }); offlineTimers = {};
    Object.keys(inviteCheckTimers).forEach(function (id) { global.clearTimeout(inviteCheckTimers[id]); }); inviteCheckTimers = {}; authorizedInvitePlayers = {};
    if (bridge()) bridge().end(); setBattleMode(false); var result = await global.NmgMultiplayer.leaveRoom(); ready = false; playerConfigs = {}; inviteSecret = ""; addLog(result.ok ? "已离开房间" : "离房回执异常，本地已清理", result.ok ? "" : "error"); syncRoomState("联机服务已连接"); setLobbyPage("modes");
  }
  async function cancelMatch() { matchRequestToken += 1; if (currentRoom().inRoom) await leave(); else { stopMatchingWait(); setLobbyPage("modes"); } }
  async function inviteBack() { if (currentRoom().inRoom) await leave(); else setLobbyPage("modes"); }
  function showEmote(id, mine) {
    if (!EMOTES[id]) return; if (!mine && byId("onlineMuteEmotes") && byId("onlineMuteEmotes").checked) return;
    var holder = byId(mine ? "onlineSelfEmote" : "onlineAllyEmote"); if (!holder) return; holder.innerHTML = '<img src="assets/icons/duel-emotes/' + id + '.svg" alt="' + EMOTES[id] + '">'; holder.classList.remove("hidden"); void holder.offsetWidth; global.setTimeout(function () { holder.classList.add("hidden"); }, 2200);
  }
  async function sendEmote(id) {
    var now = Date.now(); if (!battleState() || !EMOTES[id] || now - lastEmoteSentAt < EMOTE_COOLDOWN_MS) return; lastEmoteSentAt = now; showEmote(id, true); toggleHidden("onlineEmoteMenu", true); byId("onlineEmoteToggle").setAttribute("aria-expanded", "false");
    if (localBotActive) return;
    await global.NmgMultiplayer.send("duel-emote", { id: id, at: now, epoch: lobbyEpoch });
  }
  function open() {
    if (!overlay) return; overlay.classList.remove("hidden"); renderDuelRank(); var login = global.NmgTapLogin.getState(); renderProfile(login.profile, login.status === "profile-pending");
    if (battleState()) renderBattle(); else { setBattleMode(false); syncRoomState(login.authenticated ? "等待连接" : "等待登录"); setLobbyPage(localBotActive || currentRoom().inRoom ? "preparing" : currentRoom().connected ? "modes" : "identity"); }
  }
  async function close() { destroyProfileButton(); if (currentRoom().inRoom || localBotActive) await leave(); else stopBotAction(); if (overlay) overlay.classList.add("hidden"); }
  function validInvitePlayer(info) { return roomMode !== "private" || !inviteSecret || String(extractProps(info).inviteSecret || "").toUpperCase() === inviteSecret; }
  async function rejectInvitePlayer(id) { addLog("陌生蛊印校验失败，已移出房间", "error"); await global.NmgMultiplayer.kickRoomPlayer(id); }
  async function acceptInvitePlayer(id) { authorizedInvitePlayers[String(id)] = true; addLog("对手蛊印校验通过", "ok"); await global.NmgMultiplayer.send("invite-accepted", { epoch: lobbyEpoch }); }
  function bindRuntimeEvents() {
    global.NmgMultiplayer.on("onPlayerJoined", async function (info) {
      if (localBotActive) return;
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
      if (localBotActive) return;
      var state = battleState(); if (state && state.status === "active") { var result = bridge().forfeit(id, "disconnect"); if (result.ok) { renderBattle(); if (global.NmgMultiplayer.isHost()) sendBattleState(result.state); } }
      ready = false; addLog("对手已离开", "error"); syncRoomState("等待对手"); if (!state && roomMode === "private") setLobbyPage("invite");
    });
    global.NmgMultiplayer.on("onReadyChanged", function (id, value) { if (localBotActive) return; if (id !== global.NmgMultiplayer.getPlayerId()) addLog(value ? "对手已准备" : "对手取消准备"); syncRoomState(); maybeStartBattle(); });
    global.NmgMultiplayer.on("onPlayerPropertiesChanged", async function (id, info) {
      if (localBotActive) return;
      id = String(id || ""); if (!global.NmgMultiplayer.isHost() || roomMode !== "private" || authorizedInvitePlayers[id]) return;
      if (inviteCheckTimers[id]) { global.clearTimeout(inviteCheckTimers[id]); delete inviteCheckTimers[id]; }
      if (validInvitePlayer(info)) await acceptInvitePlayer(id); else await rejectInvitePlayer(id);
    });
    global.NmgMultiplayer.on("onPlayerOffline", function (id) {
      if (localBotActive) return;
      id = String(id || ""); if (!id || offlineTimers[id]) return; addLog("对手连接波动，保留席位 8 秒", "error");
      offlineTimers[id] = global.setTimeout(function () { delete offlineTimers[id]; var state = battleState(); if (state && state.status === "active") { var result = bridge().forfeit(id, "disconnect"); if (result.ok) { renderBattle(); if (global.NmgMultiplayer.isHost()) sendBattleState(result.state); } } }, 8000);
    });
    global.NmgMultiplayer.on("onData", async function (data, fromId) {
      if (localBotActive || !data || !currentRoom().inRoom) return;
      if (roomMode === "private" && global.NmgMultiplayer.isHost() && !authorizedInvitePlayers[String(fromId)]) return;
      if (data.t === "invite-accepted") { await sendConfig(); return; }
      if (data.t === "prep-epoch" && data.p && Number(data.p.epoch) > lobbyEpoch) { await beginPrepEpoch(Number(data.p.epoch), false); return; }
      if (data.t === "duel-config" && data.p) { var config = sanitizeConfig(data.p); if (config.epoch !== lobbyEpoch) return; playerConfigs[String(fromId)] = config; if (global.NmgMultiplayer.isHost()) maybeStartBattle(); return; }
      if (data.t === "duel-emote" && data.p && Number(data.p.epoch) === lobbyEpoch && EMOTES[data.p.id]) { var now = Date.now(); if (now - lastEmoteReceivedAt >= EMOTE_COOLDOWN_MS) { lastEmoteReceivedAt = now; showEmote(data.p.id, false); } return; }
      if (data.t === "battle-start" && data.p && data.p.state && Number(data.p.epoch) === lobbyEpoch && !global.NmgMultiplayer.isHost()) { if (!isCurrentBattleSnapshot(data.p.state) || battleState()) return; var started = bridge().start(data.p.state); if (started.ok) { rewardSettledBattleId = ""; lastRankSettlement = null; setActionPending(false); renderBattle(); addLog("蛊斗开始", "ok"); } return; }
      if (data.t === "battle-action" && global.NmgMultiplayer.isHost() && data.p && Number(data.p.epoch) === lobbyEpoch) {
        var current = battleState(); if (!current || String(current.activePlayerId) !== String(fromId) || String(data.p.battleId) !== String(current.battleId) || Number(data.p.revision) !== Number(current.revision)) { if (current) await sendBattleState(current); return; }
        var applied = bridge().applyAction(fromId, Object.assign({}, data.p.action, { at: Date.now(), timeout: false }));
        if (applied.ok) { var synced = await sendBattleState(applied.state); if (!synced.ok && bridge().restore) bridge().restore(current); renderBattle(); } return;
      }
      if (data.t === "battle-forfeit" && global.NmgMultiplayer.isHost() && Number(data.p && data.p.epoch) === lobbyEpoch) { var forfeited = bridge().forfeit(fromId, "leave"); if (forfeited.ok) { renderBattle(); await sendBattleState(forfeited.state); } return; }
      if (data.t === "battle-state" && data.p && data.p.state && Number(data.p.epoch) === lobbyEpoch && !global.NmgMultiplayer.isHost()) { if (!isCurrentBattleSnapshot(data.p.state) || !battleState()) return; var accepted = bridge().acceptSnapshot(data.p.state); if (accepted.ok) { setActionPending(false); renderBattle(); } }
    });
    global.NmgMultiplayer.on("onDisconnected", function (message) { if (localBotActive) return; stopMatchingWait(); var state = battleState(); if (state && state.status === "active") { bridge().forfeit(global.NmgMultiplayer.getPlayerId(), "disconnect"); renderBattle(); } else { if (bridge()) bridge().end(); setBattleMode(false); } ready = false; addLog("连接中断：" + message, "error"); syncRoomState("连接已中断"); setLobbyPage("identity"); });
    global.NmgMultiplayer.on("onError", function (message) { addLog("联机服务：" + message, "error"); });
  }
  function init(attempt) {
    entry = byId("onlineLobbyEntry"); overlay = byId("onlineLobbyOverlay");
    if (!entry || !overlay || !global.NmgTapLogin || !global.NmgMultiplayer || !global.NmgOnlineBattleCore || !global.NmgDuelRank || !bridge()) { if (Number(attempt) < 120) global.setTimeout(function () { init(Number(attempt) + 1); }, 250); return; }
    if (initialized) { refreshEntrySupport(0); return; } initialized = true; refreshEntrySupport(0);
    entry.addEventListener("click", function () { playSfx("uiClick"); open(); }); overlay.addEventListener("click", playLobbyClick); byId("onlineLobbyClose").addEventListener("click", close); byId("onlineLoginButton").addEventListener("click", login); byId("onlineProfileButton").addEventListener("click", syncProfileButton);
    byId("onlineConnectButton").addEventListener("click", connect); byId("onlineMatchButton").addEventListener("click", match); byId("onlineCreateButton").addEventListener("click", createPrivate); byId("onlineInviteOpenButton").addEventListener("click", function () { setLobbyPage("invite"); });
    byId("onlineJoinButton").addEventListener("click", joinPrivate); byId("onlineInviteButton").addEventListener("click", copyRoomInvite); byId("onlineInviteBack").addEventListener("click", inviteBack); byId("onlineMatchCancel").addEventListener("click", cancelMatch);
    byId("onlineKeepHumanButton").addEventListener("click", continueHumanMatch); byId("onlineBotMatchButton").addEventListener("click", startBotMatch);
    byId("onlineReadyButton").addEventListener("click", toggleReady); byId("onlineLeaveButton").addEventListener("click", leave); byId("onlineBattleReturn").addEventListener("click", returnToLobby); byId("onlineBattleEndTurn").addEventListener("click", function () { useBattleAction({ type: "end" }); });
    byId("onlineBattleDrawButton").addEventListener("click", function () { useBattleAction({ type: "draw" }); });
    byId("onlineDragonTransform").addEventListener("click", function () { useBattleAction({ type: "ability", ability: "dragonTransform" }); });
    byId("onlineBoneSoul").addEventListener("click", function () { useBattleAction({ type: "ability", ability: "boneSoul" }); });
    byId("onlineBoneFate").addEventListener("click", function () { useBattleAction({ type: "ability", ability: "boneFate" }); });
    byId("onlineBattleHand").addEventListener("click", function (event) { var card = event.target && event.target.closest && event.target.closest("[data-online-card]"); if (!card) return; var index = Number(card.dataset.onlineCard), selfId = localBotActive ? localSelfId : global.NmgMultiplayer.getPlayerId(); if (selectedHandIndex === index) useBattleAction({ type: "play", handIndex: index }); else { selectedHandIndex = index; selectedHandKey = battleState().players[selfId].hand[index]; renderBattle(); } });
    byId("onlineCardConfirm").addEventListener("click", function () { if (selectedHandIndex >= 0) useBattleAction({ type: "play", handIndex: selectedHandIndex }); });
    byId("onlineEmoteToggle").addEventListener("click", function () { var menu = byId("onlineEmoteMenu"), open = menu.classList.contains("hidden"); menu.classList.toggle("hidden", !open); this.setAttribute("aria-expanded", String(open)); });
    byId("onlineEmoteMenu").addEventListener("click", function (event) { var button = event.target && event.target.closest && event.target.closest("[data-duel-emote]"); if (button) sendEmote(button.dataset.duelEmote); });
    byId("onlineHeroChoices").addEventListener("click", async function (event) { var button = event.target && event.target.closest && event.target.closest("[data-online-hero]"); if (!button || ready) return; selectedHeroId = button.dataset.onlineHero; byId("onlineHeroChoices").querySelectorAll("button").forEach(function (item) { item.classList.toggle("is-selected", item === button); }); renderHeroGuPreview(); triggerVoice("select", selectedHeroId, 0); if (currentRoom().inRoom) await sendConfig(); });
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
    renderHeroGuPreview(); bindRuntimeEvents(); battleClockTimer = global.setInterval(tickBattleClock, 500);
    global.document.addEventListener("visibilitychange", function () { if (!global.document.hidden) { refreshEntrySupport(0); syncProfileButton(); } });
    global.addEventListener("focus", function () { refreshEntrySupport(0); syncProfileButton(); }); global.addEventListener("resize", syncProfileButton); global.addEventListener("orientationchange", syncProfileButton); global.addEventListener("pageshow", syncProfileButton);
  }
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", function () { init(0); }, { once: true }); else init(0); }
  global.NmgOnlineLobby = { open: open, close: close };
})(typeof window !== "undefined" ? window : this);
