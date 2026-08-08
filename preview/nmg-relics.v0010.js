"use strict";
/* nmg-relics.js: V0.9.36 B-5b, relic selection/reward/display helpers. Load before game.v. */
function hasOrdinaryRelic(id) {
  return Boolean(runState?.ordinaryRelics?.includes(id));
}

function getBirthRelicStartingArmor(relicId) {
  if (relicId === "boneCarapace") return 4;
  if (relicId === "listeningBoneCase") return 5;
  return 0;
}

function gainOrdinaryRelic(id, sourceName = "命途所得", logChannel = "battle") {
  if (!runState || !ORDINARY_RELICS[id] || hasOrdinaryRelic(id)) return null;
  runState.ordinaryRelics.push(id);
  runState.relicHistory.push(id);
  markRelicDiscovered(id); // V0.9.9.2 遗物谱：获得即录入
  const relic = ORDINARY_RELICS[id];
  const message = `${sourceName}：获得遗物「${relic.name}」——${relic.description}`;
  if (logChannel === "journey" && typeof addJourneyLog === "function") addJourneyLog(message, "positive-log");
  else addLog(message, "positive-log");
  return id;
}

function gainRandomOrdinaryRelic(sourceName = "命途所得", channel = "reward", logChannel = "battle") {
  const available = getAvailableOrdinaryRelicIds();
  if (!available.length) return null;
  return gainOrdinaryRelic(sampleWithRunRandom(available, 1, channel)[0], sourceName, logChannel);
}

function getAvailableOrdinaryRelicIds(run = runState) {
  const pendingIds = new Set(
    [run?.pendingRelicOffer, ...(run?.pendingRelicOfferQueue || [])]
      .filter(Boolean)
      .map((offer) => offer.relicId)
  );
  return ORDINARY_RELIC_IDS.filter((id) => {
    if (run?.ordinaryRelics?.includes(id) || pendingIds.has(id)) return false;
    const faction = ORDINARY_RELICS[id]?.faction || "common";
    return faction === "common" || faction === run?.heroId;
  });
}

// V0.9.9.2 遗物掉落"可选"：掉落点只登记待抉择遗物，统一在回到命途图(showMapScreen)时弹窗，玩家收取/舍弃。
function pickRandomAvailableRelicId(channel = "reward") {
  const available = getAvailableOrdinaryRelicIds();
  return available.length ? sampleWithRunRandom(available, 1, channel)[0] : null;
}
// V0.9.9.2 残势续燃：开局取上场留存的命势（取后即清），仅命势英雄 + 持有该遗物。
function fateRemnantCarry() {
  if (!runState || runState.heroId !== "fate" || !hasOrdinaryRelic("fateRemnant")) return 0;
  const carried = runState.carriedFate || 0;
  runState.carriedFate = 0;
  return carried;
}
function queueRelicOffer(sourceName, channel = "reward") {
  if (!runState) return null;
  const id = pickRandomAvailableRelicId(channel);
  if (!id) return null;
  const offer = { relicId: id, source: sourceName };
  if (runState.pendingRelicOffer) {
    // 槽位已占（如精英战利品尚未领取）：排队而非覆盖，防止先前承诺的遗物被静默吞掉
    runState.pendingRelicOfferQueue = runState.pendingRelicOfferQueue || [];
    runState.pendingRelicOfferQueue.push(offer);
  } else {
    runState.pendingRelicOffer = offer;
  }
  return id;
}
function flushPendingRelicOffer() {
  if (!runState) return;
  // V0.9.12.1：无效 offer（跨版本遗物改名/删除的旧档）直接丢弃并顺延队列——否则死槽会永久卡住整局遗物弹窗。
  while (runState.pendingRelicOffer && !ORDINARY_RELICS[runState.pendingRelicOffer.relicId]) {
    runState.pendingRelicOffer = (runState.pendingRelicOfferQueue || []).shift() || null;
  }
  const offer = runState.pendingRelicOffer;
  if (!offer || !dom.relicOfferOverlay) return;
  const relic = ORDINARY_RELICS[offer.relicId];
  if (dom.relicOfferSource) dom.relicOfferSource.textContent = offer.source || "命途所得";
  if (dom.relicOfferChip) dom.relicOfferChip.className = `relic-offer-chip relic-${relic.tone || "gold"}`;
  if (dom.relicOfferGlyph) dom.relicOfferGlyph.innerHTML = getCombatRelicArtHtml(offer.relicId, relic.glyph);
  if (dom.relicOfferTitle) dom.relicOfferTitle.textContent = relic.name;
  if (dom.relicOfferDesc) dom.relicOfferDesc.textContent = relic.description;
  dom.relicOfferOverlay.classList.remove("hidden");
  refreshModalLock();
}
function resolveRelicOffer(accept) {
  const offer = runState?.pendingRelicOffer;
  if (runState) runState.pendingRelicOffer = null;
  dom.relicOfferOverlay?.classList.add("hidden");
  refreshModalLock();
  if (offer && ORDINARY_RELICS[offer.relicId]) {
    if (accept) {
      const gained = gainOrdinaryRelic(offer.relicId, offer.source);
      if (!gained) addLog(`遗物「${ORDINARY_RELICS[offer.relicId].name}」已在身上，这份机缘化作虚无。`, "system-log");
    } else {
      addLog(`你舍弃了遗物「${ORDINARY_RELICS[offer.relicId].name}」。`, "system-log");
    }
  }
  if (runState?.pendingRelicOfferQueue?.length) {
    runState.pendingRelicOffer = runState.pendingRelicOfferQueue.shift();
    // 延迟重弹下一份：同步重开会让双击的第二下直接盲收/盲弃玩家还没看到的遗物。
    window.setTimeout(() => flushPendingRelicOffer(), 360);
  }
  saveRunStateToStorage();
}

// 战斗遗物共用字形：桌面遗物条与移动端底部状态栏使用同一份顺序和说明。
// 本命遗物永远排在最前，随后才是本局获得的普通遗物。
const RELIC_VISIBLE_LIMIT = 5;
function getCombatRelicArtHtml(id, glyph) {
  const art = PORTRAIT_PATHS.relics?.[id];
  return art
    ? `<span class="combat-relic-art" aria-hidden="true"><img src="${art}" alt="" loading="lazy" decoding="async"></span>`
    : `<b>${glyph}</b>`;
}
function buildCombatRelicRailMarkup() {
  return buildCombatRelicRailMarkupForMode(false);
}
function buildMobileCombatRelicRailMarkup() {
  return buildCombatRelicRailMarkupForMode(true);
}
function buildCombatRelicRailMarkupForMode(revealAll = false) {
  if (!runState) return "";
  const ids = (runState.ordinaryRelics || []).filter((id) => ORDINARY_RELICS[id]);
  const activeRelic = RELICS[runState.relicId] || null;
  const activeChip = activeRelic
    ? `<span class="combat-relic-chip active-relic-chip" data-relic-id="__active" role="button" tabindex="0" title="本命·${activeRelic.name}：${activeRelic.description}" data-keyword="${activeRelic.name}" data-status-title="${escapeAttribute(`本命遗物·${activeRelic.name}`)}" data-status-detail="${escapeAttribute(`${activeRelic.description} 本局全程生效。`)}" aria-label="本命遗物·${activeRelic.name}：${activeRelic.description}">${getCombatRelicArtHtml(runState.relicId, activeRelic.glyph)}<span class="combat-relic-name">${escapeAttribute(activeRelic.name)}</span></span>`
    : "";
  const ordinaryChips = ids.map((id, index) => {
    const r = ORDINARY_RELICS[id];
    return `<span class="combat-relic-chip relic-${r.tone || "gold"}${!revealAll && index >= RELIC_VISIBLE_LIMIT ? " relic-overflow-chip" : ""}" data-relic-id="${id}" role="button" tabindex="0" title="${r.name}：${r.description}" data-keyword="${r.name}" data-status-title="${escapeAttribute(`遗物·${r.name}`)}" data-status-detail="${escapeAttribute(`${r.description} 本局持有期间持续生效。`)}" aria-label="遗物·${r.name}：${r.description}">${getCombatRelicArtHtml(id, r.glyph)}<span class="combat-relic-name">${escapeAttribute(r.name)}</span></span>`;
  }).join("");
  const overflow = Math.max(0, ids.length - RELIC_VISIBLE_LIMIT);
  const toggle = overflow && !revealAll
    ? `<button type="button" class="combat-relic-toggle" aria-expanded="false" aria-label="展开其余 ${overflow} 件遗物">+${overflow}</button>`
    : "";
  return activeChip + ordinaryChips + toggle;
}

// V0.9.9.2 遗物"看得见"：桌面端仍保留原遗物条；移动端由底部状态栏统一承载。
// 仅当遗物集变化时重建 innerHTML——否则每帧重建会抹掉触发高亮动画。
function renderCombatRelicStrip() {
  if (!dom.combatRelicStrip || !runState) return;
  const ids = (runState.ordinaryRelics || []).filter((id) => ORDINARY_RELICS[id]);
  const sig = `${runState.relicId || ""}|${ids.join(",")}`;
  if (dom.combatRelicStrip.dataset.sig === sig) return;
  dom.combatRelicStrip.dataset.sig = sig;
  dom.combatRelicStrip.innerHTML = buildCombatRelicRailMarkup();
}

// V0.9.9.2 遗物自动触发时的醒目反馈：玩家立绘金色浮字 + 遗物条对应字形高亮脉冲。
// delay：战斗开始类被动（如青囊虫）用小延迟，等战斗 UI 就绪后再飘字。
function notifyRelicTrigger(relicId, detail = "", delay = 0) {
  const relic = ORDINARY_RELICS[relicId];
  if (!relic) return;
  const fire = () => {
    spawnFloatText(dom.playerPortrait, `遗物·${relic.name}${detail ? "｜" + detail : ""}`, "relic-float");
    const chips = [dom.mobileBuffRail, dom.combatRelicStrip]
      .filter(Boolean)
      .flatMap((container) => Array.from(container.querySelectorAll(`[data-relic-id="${relicId}"]`)));
    chips.forEach((chip) => {
      chip.classList.remove("relic-chip-trigger");
      void chip.offsetWidth; // 强制回流以重启动画
      chip.classList.add("relic-chip-trigger");
      window.setTimeout(() => chip.classList.remove("relic-chip-trigger"), 820);
    });
  };
  if (delay > 0) window.setTimeout(fire, delay);
  else fire();
}

function checkTailCutRelic() {
  if (!game || game.status !== "playing" || !hasOrdinaryRelic("tailCutCharm")) return;
  if (game.combatRelic?.tailCutUsed) return;
  if (game.player.hp > game.player.maxHp * 0.3) return;
  game.combatRelic.tailCutUsed = true;
  if (game.player.hp <= 0) game.player.hp = 1;
  healPlayer(8, "断尾符");
  addLog("断尾符护主：濒危时恢复 8 点生命。", "positive-log");
  notifyRelicTrigger("tailCutCharm", "濒危·回血 8");
}

/* ===== V0.9.57 遗物扩量的接线（玩家实报「遗物太少了」）=====
 * 全部挂在既有稳定触发点上，不新开钩子；每枚都有 notifyRelicTrigger，
 * 让玩家看得见它到底有没有生效——这是上一批遗物就定下的规矩。 */

/* 开场一次性：空瓢（真元 +1）、鳞屑囊（龙鳞 +1）。在建场完成、第一回合开打前调用。 */
function applyBattleStartRelics() {
  if (!game || !runState) return;
  if (hasOrdinaryRelic("hollowGourd")) {
    game.player.energy += 1;
    addLog("空瓢倾底：本场第一回合真元 +1。", "positive-log");
    notifyRelicTrigger("hollowGourd", "开场·真元+1");
  }
  if (hasOrdinaryRelic("scaleDustSac") && typeof isDragonHero === "function" && isDragonHero()) {
    // 走 gainDragonScale 单源：它自带龙形期不叠、封顶与统计，别绕过去直接写 scale。
    gainDragonScale(1, "鳞屑囊");
    notifyRelicTrigger("scaleDustSac", "开场·龙鳞+1");
  }
}

/* 回合开始：龙脉核（龙形期间真元 +1）。挂在 beginNextTurn 的真元结算之后。 */
function applyTurnStartRelics() {
  if (!game || !runState) return;
  if (hasOrdinaryRelic("dragonPulseCore")
    && typeof isDragonHero === "function" && isDragonHero()
    && game.dragon?.transformed) {
    game.player.energy += 1;
    addLog("龙脉核搏动：龙形期间真元 +1。", "positive-log");
    notifyRelicTrigger("dragonPulseCore", "龙形·真元+1");
  }
}

/* 磨蛊石：本场第一次打出攻击蛊时该次 +4 伤害。返回应追加的伤害值（0 表示不触发）。 */
function getWhetstoneBonus(card) {
  if (!game || !runState || !hasOrdinaryRelic("whetstoneShard")) return 0;
  if (game.combatRelic?.whetstoneUsed) return 0;
  if (!card || card.category !== "attack") return 0;
  game.combatRelic.whetstoneUsed = true;
  addLog("磨蛊石开锋：本场首击伤害 +4。", "positive-log");
  notifyRelicTrigger("whetstoneShard", "首击·伤害+4");
  return 4;
}

/* 烬灯：本场第一次焚寿时 +5 防御。由 spendLifespan 调用。 */
function applyAshLanternOnBurn() {
  if (!game || !runState || !hasOrdinaryRelic("ashLantern")) return;
  if (game.combatRelic?.ashLanternUsed) return;
  game.combatRelic.ashLanternUsed = true;
  gainArmor(5, "烬灯", "焚寿护身");
  addLog("烬灯映骨：本场首次焚寿，获得 5 点防御。", "positive-log");
  notifyRelicTrigger("ashLantern", "焚寿·防御+5");
}

/* 织结：本场第一次命势圆满时额外抽 1 张。由 resolveFateFull 调用。 */
function applyWeaveKnotOnFateFull() {
  if (!game || !runState || !hasOrdinaryRelic("weaveKnot")) return;
  if (game.combatRelic?.weaveKnotUsed) return;
  game.combatRelic.weaveKnotUsed = true;
  drawCards(1);
  addLog("织结绷紧：本场首次命势圆满，额外抽 1 张。", "positive-log");
  notifyRelicTrigger("weaveKnot", "首次圆满·抽1");
}

/* 缀甲线：敌人行动后防御清零时保留 2 点。返回清零后应保留的防御值。 */
function getMendingThreadKeep(armorBeforeClear) {
  if (!runState || !hasOrdinaryRelic("mendingThread")) return 0;
  const keep = Math.min(2, Math.max(0, Number(armorBeforeClear) || 0));
  if (keep > 0) {
    addLog(`缀甲线绷住：保留 ${keep} 点防御到下一回合。`, "positive-log");
    notifyRelicTrigger("mendingThread", `留甲 ${keep}`);
  }
  return keep;
}

/* 余烬袋：战斗胜利后回 4 血。由 finishBattle 的胜利分支调用。 */
function applyCinderPouchOnVictory() {
  if (!runState || !hasOrdinaryRelic("cinderPouch")) return;
  healPlayer(4, "余烬袋");
  addLog("余烬袋余温：战后恢复 4 点生命。", "positive-log");
  notifyRelicTrigger("cinderPouch", "战后·回血4");
}

function renderRelicInventory() {
  if (!runState) return "";
  const birthRelic = RELICS[runState.relicId];
  const ordinary = runState.ordinaryRelics.map((id) => ({ ...ORDINARY_RELICS[id], id })).filter((item) => item.name);
  const items = [
    { ...birthRelic, id: runState.relicId, kind: "本命遗物", tone: "gold" },
    ...ordinary.map((item) => ({ ...item, kind: "普通遗物" })),
  ];
  return items.map((item) => `<article class="relic-chip relic-${item.tone || "gold"}">
    <span>${getCombatRelicArtHtml(item.id, item.glyph)}<strong>${item.name}</strong><em>${item.kind}</em></span>
    <small>${item.description}</small>
  </article>`).join("");
}

function getOrdinaryRelicSummary() {
  const ids = runState?.ordinaryRelics || [];
  return ids.length
    ? ids.map((id) => ORDINARY_RELICS[id]?.name).filter(Boolean).join("、")
    : "尚未获得普通遗物";
}
