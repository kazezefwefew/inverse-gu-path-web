"use strict";
/* TapTap 双人联机门面：只负责连接、匹配、准备与轻量消息，不承载战斗真相。 */
(function createMultiplayerFacade(global) {
  var MAX_MESSAGE_BYTES = 2048;
  var manager = null;
  var bound = false;
  var connected = false;
  var room = null;
  var playerId = null;
  var host = false;
  var remotes = {};
  var ready = {};
  var roomDiscoveryTail = Promise.resolve();
  var callbacks = {
    onPlayerJoined: null,
    onPlayerLeft: null,
    onPlayerOffline: null,
    onData: null,
    onRoomJoined: null,
    onDisconnected: null,
    onReadyChanged: null,
    onPlayerPropertiesChanged: null,
    onError: null
  };

  function isSupported() {
    return !!(global.tap && typeof global.tap.getOnlineBattleManager === "function");
  }
  function errorText(error) {
    if (!error) return "未知错误";
    return String(error.errMsg || error.message || error.msg || error.reason || error).slice(0, 180);
  }
  function fire(name, first, second) {
    try { if (typeof callbacks[name] === "function") callbacks[name](first, second); } catch (error) {}
  }
  function pickPlayerId(info) {
    if (!info) return null;
    return (info.playerInfo && (info.playerInfo.id || info.playerInfo.playerId)) || info.playerId || info.id || info.fromPlayerId || null;
  }
  function pickMessage(info) {
    return info && (info.msg || info.message || info.content || (info.data && info.data.msg));
  }
  function utf8Bytes(text) {
    if (typeof global.TextEncoder === "function") return new global.TextEncoder().encode(text).length;
    try { return unescape(encodeURIComponent(text)).length; } catch (error) { return text.length * 3; }
  }
  function callManager(method, options) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      function done(fn, value) {
        if (settled) return;
        settled = true;
        fn(value || {});
      }
      try {
        if (!manager || typeof manager[method] !== "function") throw new Error(method + " unavailable");
        var result = manager[method](Object.assign({}, options || {}, {
          success: function (value) { done(resolve, value); },
          fail: function (error) { done(reject, error); }
        }));
        if (result && typeof result.then === "function") result.then(function (value) { done(resolve, value); }, function (error) { done(reject, error); });
      } catch (error) { done(reject, error); }
    });
  }
  function queueRoomDiscovery(task) {
    var run = roomDiscoveryTail.catch(function () {}).then(task);
    roomDiscoveryTail = run.catch(function () {});
    return run;
  }
  function resetRoom() {
    room = null;
    host = false;
    remotes = {};
    ready = {};
  }
  function addRemote(info) {
    var id = pickPlayerId(info);
    if (!id || id === playerId) return;
    remotes[id] = info.playerInfo || info;
    var status = Number((info.playerInfo && info.playerInfo.customStatus) != null ? info.playerInfo.customStatus : info.customStatus);
    ready[id] = status === 1;
    fire("onPlayerJoined", info.playerInfo || info);
  }
  function handleProperties(info) {
    var id = pickPlayerId(info);
    if (!id) return;
    var player = info.playerInfo || info;
    if (id !== playerId) remotes[id] = Object.assign({}, remotes[id] || {}, player);
    fire("onPlayerPropertiesChanged", id, player);
  }
  function removeRemote(info) {
    var id = pickPlayerId(info);
    if (!id) return;
    delete remotes[id];
    delete ready[id];
    fire("onPlayerLeft", id);
  }
  function handleStatus(info) {
    var id = pickPlayerId(info);
    if (!id) return;
    var status = Number(info.status != null ? info.status : (info.customStatus != null ? info.customStatus : (info.playerInfo && info.playerInfo.customStatus)));
    ready[id] = status === 1;
    fire("onReadyChanged", id, ready[id]);
  }
  function handleMessage(info) {
    if (!room) return;
    var fromId = pickPlayerId(info);
    if (fromId && fromId === playerId) return;
    var raw = pickMessage(info);
    var data;
    try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (error) { return; }
    if (!data || typeof data !== "object") return;
    var roomId = String(room.id || room.roomId || "");
    if (!roomId || String(data.s || "") !== roomId) return;
    fire("onData", { t: data.t, p: data.p }, fromId);
  }
  function handleDisconnected(info) {
    connected = false;
    resetRoom();
    fire("onDisconnected", errorText(info || "连接已断开"), info && info.code);
  }
  function bindListeners() {
    if (bound || !manager || typeof manager.registerListener !== "function") return;
    bound = true;
    var listener = {
      onDisconnected: handleDisconnected,
      onBattleServiceError: function (info) { fire("onError", errorText(info), info && info.code); },
      onPlayerEntered: addRemote,
      onPlayerLeft: removeRemote,
      onPlayerKicked: removeRemote,
      onPlayerOffline: function (info) { fire("onPlayerOffline", pickPlayerId(info)); },
      onPlayerCustomStatusChanged: handleStatus,
      onPlayerCustomPropertiesChanged: handleProperties,
      onRoomPropertiesChanged: function () {},
      onFrameSyncStarted: function () {},
      onFrameReceived: function () {},
      onFrameSyncStopped: function () {},
      onCustomMessageReceived: handleMessage,
      playerEnterRoom: addRemote,
      playerLeaveRoom: removeRemote,
      playerOffline: function (info) { fire("onPlayerOffline", pickPlayerId(info)); },
      onFrameSyncStart: function () {},
      onFrame: function () {},
      onFrameSyncStop: function () {},
      onCustomMessage: handleMessage
    };
    manager.registerListener(listener);
  }

  async function connect() {
    if (!isSupported()) return { ok: false, status: "unsupported", error: "当前环境不支持 TapTap 联机" };
    if (connected && playerId) return { ok: true, status: "connected", playerId: playerId };
    try {
      manager = global.tap.getOnlineBattleManager();
      bindListeners();
      var result = await callManager("connect");
      playerId = result.playerId || (result.playerInfo && result.playerInfo.id) || null;
      if (!playerId) return { ok: false, status: "failed", error: "联机服务未返回玩家标识" };
      connected = true;
      return { ok: true, status: "connected", playerId: playerId };
    } catch (error) {
      connected = false;
      return { ok: false, status: "failed", error: errorText(error) };
    }
  }

  function acceptRoomResult(result, status) {
    room = result.roomInfo || result.room || null;
    if (!room) return { ok: false, status: "failed", error: "已进入房间但未取得房间信息" };
    host = String(room.ownerId || room.ownerPlayerId || "") === String(playerId);
    remotes = {};
    ready = {};
    ready[playerId] = false;
    (Array.isArray(room.players) ? room.players : []).forEach(function (entry) {
      if (pickPlayerId(entry) === playerId) ready[playerId] = Number(entry.customStatus) === 1;
      else addRemote(entry);
    });
    fire("onRoomJoined", room);
    return { ok: true, status: status, roomInfo: room, isHost: host };
  }

  async function matchRoom(maxPlayers, roomType, props) {
    if (!isSupported()) return { ok: false, status: "unsupported", error: "当前环境不支持 TapTap 联机" };
    if (!connected) return { ok: false, status: "not-connected", error: "尚未连接联机服务" };
    var type = String(roomType || "pvp-random-v1").slice(0, 48);
    try {
      return await queueRoomDiscovery(async function () {
        var result = await callManager("matchRoom", { data: {
          roomCfg: {
            maxPlayerCount: Math.max(2, Math.min(2, Number(maxPlayers) || 2)),
            type: type,
            matchParams: { mode: type, protocol: "v1" }
          },
          playerCfg: { customProperties: JSON.stringify(props || {}) }
        } });
        return acceptRoomResult(result, "matched");
      });
    } catch (error) { return { ok: false, status: "failed", error: errorText(error) }; }
  }

  async function createRoom(name, roomType, props) {
    if (!connected) return { ok: false, status: "not-connected", error: "尚未连接联机服务" };
    var type = String(roomType || "pvp-private-v1").slice(0, 48);
    try {
      var result = await callManager("createRoom", { data: {
        roomCfg: {
          name: String(name || "蛊斗切磋").slice(0, 32),
          maxPlayerCount: 2,
          type: type,
          customProperties: JSON.stringify({ mode: "private", protocol: "v2" }),
          matchParams: { mode: type, protocol: "v2" }
        },
        playerCfg: { customProperties: JSON.stringify(props || {}) }
      } });
      return acceptRoomResult(result, "created");
    } catch (error) { return { ok: false, status: "failed", error: errorText(error) }; }
  }

  async function joinRoom(roomId, props) {
    if (!connected) return { ok: false, status: "not-connected", error: "尚未连接联机服务" };
    var id = String(roomId || "").trim().slice(0, 96);
    if (!id) return { ok: false, status: "invalid-room", error: "请输入房间码" };
    try {
      var result = await callManager("joinRoom", { data: {
        roomId: id,
        playerCfg: { customProperties: JSON.stringify(props || {}) }
      } });
      return acceptRoomResult(result, "joined");
    } catch (error) { return { ok: false, status: "failed", error: errorText(error) }; }
  }

  async function setReady(value) {
    if (!room || !connected) return { ok: false, ready: false, error: "尚未加入房间" };
    var next = !!value;
    try {
      await callManager("updatePlayerCustomStatus", { status: next ? 1 : 0 });
      ready[playerId] = next;
      fire("onReadyChanged", playerId, next);
      return { ok: true, ready: next };
    } catch (error) { return { ok: false, ready: !!ready[playerId], error: errorText(error) }; }
  }

  async function updatePlayerCustomProperties(props) {
    if (!room || !connected) return { ok: false, error: "尚未加入房间" };
    try {
      await callManager("updatePlayerCustomProperties", { customProperties: JSON.stringify(props || {}) });
      return { ok: true };
    } catch (error) { return { ok: false, error: errorText(error) }; }
  }

  async function kickRoomPlayer(id) {
    if (!room || !connected || !host) return { ok: false, error: "仅房主可以移出玩家" };
    var target = String(id || "");
    if (!target || !remotes[target]) return { ok: false, error: "玩家不在房间内" };
    try {
      await callManager("kickRoomPlayer", { playerId: target });
      return { ok: true };
    } catch (error) { return { ok: false, error: errorText(error) }; }
  }

  async function getRoomList(roomType) {
    if (!manager || typeof manager.getRoomList !== "function") return { ok: false, supported: false, rooms: [] };
    try {
      return await queueRoomDiscovery(async function () {
        var result = await callManager("getRoomList", { data: { type: String(roomType || "pvp-random-v1").slice(0, 48) } });
        var rooms = result.roomList || result.rooms || result.list || [];
        return { ok: true, supported: true, rooms: Array.isArray(rooms) ? rooms : [] };
      });
    } catch (error) { return { ok: false, supported: true, rooms: [], error: errorText(error) }; }
  }

  async function send(type, payload) {
    if (!room || !connected) return { ok: false, error: "尚未加入房间" };
    var json;
    var roomId = String(room.id || room.roomId || "");
    try { json = JSON.stringify({ s: roomId, t: String(type || "event").slice(0, 48), p: payload == null ? {} : payload }); }
    catch (error) { return { ok: false, error: "消息无法序列化" }; }
    if (utf8Bytes(json) > MAX_MESSAGE_BYTES) return { ok: false, error: "消息超过 2048 字节" };
    try {
      await callManager("sendCustomMessage", { data: { msg: json, type: 0 } });
      return { ok: true };
    } catch (error) { return { ok: false, error: errorText(error) }; }
  }

  async function leaveRoom() {
    if (!room) { resetRoom(); return { ok: true }; }
    try { await callManager("leaveRoom"); } catch (error) { resetRoom(); return { ok: false, error: errorText(error) }; }
    resetRoom();
    return { ok: true };
  }
  function getState() {
    var ids = Object.keys(remotes);
    var readyCount = Object.keys(ready).filter(function (id) { return ready[id] === true; }).length;
    return {
      supported: isSupported(), connected: connected, inRoom: !!room, isHost: host,
      playerId: playerId, roomId: room && (room.id || room.roomId) || null,
      roomType: room && (room.type || room.roomType) || null,
      playerCount: room ? 1 + ids.length : 0, readyCount: readyCount, remoteIds: ids
    };
  }

  global.NmgMultiplayer = {
    isSupported: isSupported,
    connect: connect,
    matchRoom: matchRoom,
    createRoom: createRoom,
    joinRoom: joinRoom,
    setReady: setReady,
    updatePlayerCustomProperties: updatePlayerCustomProperties,
    kickRoomPlayer: kickRoomPlayer,
    getRoomList: getRoomList,
    send: send,
    leaveRoom: leaveRoom,
    getState: getState,
    isHost: function () { return host; },
    getPlayerId: function () { return playerId; },
    getRemoteIds: function () { return Object.keys(remotes); },
    getRemotePlayers: function () { return JSON.parse(JSON.stringify(remotes)); },
    on: function (name, handler) { if (Object.prototype.hasOwnProperty.call(callbacks, name)) callbacks[name] = handler; },
    errText: errorText
  };
})(typeof window !== "undefined" ? window : this);
