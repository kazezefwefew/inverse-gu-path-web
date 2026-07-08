"use strict";
/* nmg-relics.js: V0.9.36 B-5b, relic selection/reward/display helpers. Load before game.v. */
function hasOrdinaryRelic(id) {
  return Boolean(runState?.ordinaryRelics?.includes(id));
}

function gainOrdinaryRelic(id, sourceName = "命途所得") {
  if (!runState || !ORDINARY_RELICS[id] || hasOrdinaryRelic(id)) return null;
  runState.ordinaryRelics.push(id);
  runState.relicHistory.push(id);
  markRelicDiscovered(id); // V0.9.9.2 遗物谱：获得即录入
  const relic = ORDINARY_RELICS[id];
  addLog(`${sourceName}：获得遗物「${relic.name}」——${relic.description}`, "positive-log");
  return id;
}

function gainRandomOrdinaryRelic(sourceName = "命途所得", channel = "reward") {
  const available = ORDINARY_RELIC_IDS.filter((id) => !hasOrdinaryRelic(id));
  if (!available.length) return null;
  return gainOrdinaryRelic(sampleWithRunRandom(available, 1, channel)[0], sourceName);
}

// V0.9.9.2 遗物掉落"可选"：掉落点只登记待抉择遗物，统一在回到命途图(showMapScreen)时弹窗，玩家收取/舍弃。
function pickRandomAvailableRelicId(channel = "reward") {
  // V0.9.9.2 Batch4 按流派偏发：候选 = 通用 + 当前英雄专属流派，未拥有。专属遗物只对该流派英雄掉落。
  const heroFaction = runState?.heroId; // fate/blood/poison/longevity
  const pendingIds = new Set(
    [runState?.pendingRelicOffer, ...(runState?.pendingRelicOfferQueue || [])]
      .filter(Boolean).map((o) => o.relicId)
  );
  const available = ORDINARY_RELIC_IDS.filter((id) => {
    if (hasOrdinaryRelic(id) || pendingIds.has(id)) return false;
    const f = ORDINARY_RELICS[id].faction || "common";
    return f === "common" || f === heroFaction;
  });
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
  if (dom.relicOfferGlyph) dom.relicOfferGlyph.textContent = relic.glyph;
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

// V0.9.9.2 遗物"看得见"：战斗内常驻随身遗物条（本命遗物另在 activeRelicCard 显示）。
// 仅当遗物集变化时重建 innerHTML——否则每帧重建会抹掉触发高亮动画。
function renderCombatRelicStrip() {
  if (!dom.combatRelicStrip || !runState) return;
  const ids = (runState.ordinaryRelics || []).filter((id) => ORDINARY_RELICS[id]);
  const activeRelic = RELICS[runState.relicId] || null;
  const sig = `${runState.relicId || ""}|${ids.join(",")}`;
  if (dom.combatRelicStrip.dataset.sig === sig) return;
  dom.combatRelicStrip.dataset.sig = sig;
  // V0.9.12.2 HUD止血：本命遗物在手机战斗中此前两处显示（activeRelicCard/topRelic）均被隐藏，属信息断供——
  // 作为首枚特殊描边芯片并入遗物条；桌面端 activeRelicCard 照旧显示，该芯片由 CSS 仅在手机战斗态展示。
  const activeChip = activeRelic
    ? `<span class="combat-relic-chip active-relic-chip" data-relic-id="__active" title="本命·${activeRelic.name}：${activeRelic.description}"><b>${activeRelic.glyph}</b></span>`
    : "";
  dom.combatRelicStrip.innerHTML = activeChip + ids.map((id) => {
    const r = ORDINARY_RELICS[id];
    return `<span class="combat-relic-chip relic-${r.tone || "gold"}" data-relic-id="${id}" title="${r.name}：${r.description}"><b>${r.glyph}</b></span>`;
  }).join("");
}

// V0.9.9.2 遗物自动触发时的醒目反馈：玩家立绘金色浮字 + 遗物条对应字形高亮脉冲。
// delay：战斗开始类被动（如青囊虫）用小延迟，等战斗 UI 就绪后再飘字。
function notifyRelicTrigger(relicId, detail = "", delay = 0) {
  const relic = ORDINARY_RELICS[relicId];
  if (!relic) return;
  const fire = () => {
    spawnFloatText(dom.playerPortrait, `遗物·${relic.name}${detail ? "｜" + detail : ""}`, "relic-float");
    const chip = dom.combatRelicStrip && dom.combatRelicStrip.querySelector(`[data-relic-id="${relicId}"]`);
    if (chip) {
      chip.classList.remove("relic-chip-trigger");
      void chip.offsetWidth; // 强制回流以重启动画
      chip.classList.add("relic-chip-trigger");
      window.setTimeout(() => chip.classList.remove("relic-chip-trigger"), 820);
    }
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

function getOrdinaryRelicSummary() {
  const ids = runState?.ordinaryRelics || [];
  return ids.length
    ? ids.map((id) => ORDINARY_RELICS[id]?.name).filter(Boolean).join("、")
    : "尚未获得普通遗物";
}
