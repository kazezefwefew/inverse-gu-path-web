"use strict";
/* nmg-refining.js: V0.9.36 B-5a, refining/furnace flow. Load before game.v. */
function renderMaterialChoice(id, { disabled = false } = {}) {
  const item = MATERIALS[id];
  return `<button class="material-choice material-${item.tone}" type="button" data-material-id="${id}" ${disabled ? "disabled" : ""}>
    <span class="material-glyph">${item.glyph}</span>
    <strong>${item.name}</strong>
    <small>${item.short}</small>
    <p>${item.description}</p>
  </button>`;
}

function generateMaterialRewardChoices() {
  return sampleWithRunRandom(MATERIAL_IDS, REWARD_BALANCE.materialRewardChoiceCount, "reward");
}

function openMaterialReward() {
  const resultCard = dom.resultOverlay?.querySelector(".result-card");
  dom.materialRewardChoices?.querySelectorAll(".is-claimed").forEach((choice) => {
    choice.classList.remove("is-claimed", "selected");
    choice.removeAttribute("data-claimed-label");
  });
  resultCard?.classList.remove("reward-choice-active", "reward-confirming", "furnace-choice-active", "furnace-confirming");
  resultCard?.classList.add("material-choice-active");
  resultCard?.classList.remove("material-confirming");
  if (resultCard) resultCard.scrollTop = 0;
  runState.materialRewardResolved = false;
  runState.pendingMaterialPick = null;
  dom.materialRewardConfirm?.classList.add("hidden");
  const choices = generateMaterialRewardChoices();
  runState.pendingMaterialIds = choices;
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel.classList.remove("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.furnacePanel?.classList.add("hidden");
  dom.resultSeal.textContent = "材";
  dom.resultEyebrow.textContent = `命途图 · 第 ${getMingtuProgressStep(runState)} 段炉灰`;
  dom.resultTitle.textContent = "炼蛊材料";
  dom.resultDescription.textContent = "从炉灰中取一味材料，下一次蛊炉开启时可用于稳定炼化、异变或承受反噬。";
  dom.materialRewardChoices.innerHTML = choices.map((id) => renderMaterialChoice(id)).join("");
  dom.skipMaterialButton.disabled = false;
}

function resolveMaterialReward(materialId = null) {
  if (!runState || runState.materialRewardResolved) return;
  if (materialId && !runState.pendingMaterialIds.includes(materialId)) return;
  runState.materialRewardResolved = true;
  runState.pendingMaterialPick = null; // V0.9.31 收尾两段式：确认/不取都收起确认条
  dom.materialRewardConfirm?.classList.add("hidden");
  if (materialId) {
    gainMaterial(materialId, 1, "炼蛊材料");
    const claimedChoice = dom.materialRewardChoices.querySelector(`[data-material-id="${materialId}"]`);
    if (claimedChoice) {
      claimedChoice.classList.remove("selected");
      claimedChoice.dataset.claimedLabel = "已取材";
      claimedChoice.classList.add("is-claimed");
    }
  } else {
    addLog("你没有取走本层炼蛊材料。", "system-log");
  }
  dom.materialRewardChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.skipMaterialButton.disabled = true;
  dom.resultOverlay?.querySelector(".result-card")?.classList.remove("material-choice-active", "material-confirming");
  showNextFloorButton();
}


function selectMaterialCandidate(materialId) {
  if (!runState || runState.materialRewardResolved) return;
  if (!runState.pendingMaterialIds?.includes(materialId)) return;
  runState.pendingMaterialPick = materialId;
  dom.resultOverlay?.querySelector(".result-card")?.classList.add("material-confirming");
  dom.materialRewardChoices?.querySelectorAll("[data-material-id]").forEach((b) => b.classList.toggle("selected", b.dataset.materialId === materialId));
  if (dom.materialRewardConfirm) dom.materialRewardConfirm.classList.remove("hidden");
  if (dom.materialRewardConfirmText) dom.materialRewardConfirmText.textContent = `取走「${MATERIALS[materialId]?.name || materialId}」入炉灰？`;
  try { playUiSfx(); } catch (e) { /* 忽略 */ }
}
function confirmMaterialReward() {
  if (!runState || runState.materialRewardResolved || !runState.pendingMaterialPick) return;
  const pick = runState.pendingMaterialPick;
  runState.pendingMaterialPick = null;
  dom.materialRewardConfirm?.classList.add("hidden");
  resolveMaterialReward(pick);
}
function resetMaterialSelection() {
  if (runState) runState.pendingMaterialPick = null;
  dom.resultOverlay?.querySelector(".result-card")?.classList.remove("material-confirming");
  dom.materialRewardConfirm?.classList.add("hidden");
  dom.materialRewardChoices?.querySelectorAll(".selected").forEach((b) => b.classList.remove("selected"));
  try { playUiSfx(); } catch (e) { /* 忽略 */ }
}

function openFloorTwoRefinement() {
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.resultEyebrow.textContent = "二段炉火 · 再择一变";
  dom.resultTitle.textContent = "炼蛊抉择";
  dom.resultDescription.textContent = "这次强化会随你进入后续命途。";
  dom.refineChoices.innerHTML = Object.entries(REFINEMENTS).map(([id, item]) => `
    <button class="refine-choice" type="button" data-refinement-id="${id}">
      <span>${item.glyph}</span><strong>${item.name}</strong><small>${item.description}</small>
    </button>`).join("");
  dom.refinePanel.classList.remove("hidden");
}

function chooseRefinement(id) {
  if (!runState || runState.refinementResolved || !REFINEMENTS[id]) return;
  const refinement = REFINEMENTS[id];
  runState.refinementResolved = true;
  runState.refinements.push(id);
  if (refinement.effect === "heal") {
    const before = runState.currentHp;
    runState.currentHp = Math.min(runState.maxHp, runState.currentHp + 18);
    game.player.hp = runState.currentHp;
    dom.resultHp.textContent = runState.currentHp;
    const healed = runState.currentHp - before;
    if (healed > 0) spawnFloatText(dom.playerPortrait, `+${healed} 生命`, "heal-float");
    render();
  } else if (refinement.effect === "bloodDamage") {
    runState.bloodAttackBonus += 3;
  } else if (refinement.effect === "startArmor") {
    runState.startArmorBonus += 5;
  }
  dom.refineChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.refineChoices.innerHTML = `<div class="refinement-complete"><span>${refinement.glyph}</span><strong>${refinement.name}</strong><small>${refinement.description}</small></div>`;
  dom.resultDescription.textContent = `「${refinement.name}」已经融入本局命途。`;
  addLog(`炼蛊抉择：获得「${refinement.name}」。`, "positive-log");
  openFurnace();
}

function getDeckEntryById(instanceId) {
  return runState?.deckCards?.find((entry) => entry.instanceId === instanceId) || null;
}

function getUpgradeableDeckEntries() {
  // V0.9.51：上限按牌算——天品孵化蛊可炼到四转（庐养的卖点），此前写死 <2 会把它挡在三转。
  return (runState?.deckCards || []).filter((entry) => getUpgradeLevel(entry) < getUpgradeCapFor(entry));
}


/* V0.9.51：炼化上限按牌算——天品孵化蛊(guluUpgradeCap=3)可至四转，其余止于三转。 */
function getUpgradeCapFor(entry) {
  return Math.max(2, Math.min(3, Number(entry?.guluUpgradeCap) || 2));
}
function renderFurnaceChoice(entry) {
  const level = getUpgradeLevel(entry);
  const mutationText = entry.mutated
    ? "已异变过"
    : runState.mutationCount >= MAX_RUN_MUTATIONS
      ? "本局异变已满"
      : "可异变";
  return `<button class="furnace-choice ${level > 0 ? `upgraded upgrade-${level}` : ""} ${entry.mutated ? "is-mutated" : ""}" type="button" data-furnace-card="${entry.instanceId}">
    <span class="upgrade-badge">${level > 0 ? getRefineTurnName(level) : "一转 · 可炼化"}</span>
    <strong>${getCardTitle(entry)}</strong>
    ${renderCardStateBadges(entry)}
    <dl class="furnace-card-meta">
      <div><dt>当前</dt><dd>${getRefineText(level)}</dd></div>
      <div><dt>异变</dt><dd>${mutationText}</dd></div>
      <div><dt>上限</dt><dd>${level >= getUpgradeCapFor(entry) ? `已至${getRefineTurnName(level)}` : `可炼至${getRefineTurnName(getUpgradeCapFor(entry))}`}</dd></div>
      <div><dt>蛊性</dt><dd>${getCardNatureText(entry)}</dd></div>
      ${renderFurnaceNextTurnRow(entry, level)}
    </dl>
    <p>${withChinesePeriod(getCardEffectForEntry(entry))}</p>
  </button>`;
}

/* V0.9.55 玩家反馈「局内炼蛊看不到下一转的数值」：选卡列表补一行「下一转」。
 * 两种情况必须说清楚，否则玩家是在盲花材料：
 *   ①能变强 → 直接把数值差写出来（伤害 14 → 18）；
 *   ②纯资源牌 → V0.9.55 起真元/抽牌一类不再随转数成长，炼它毫无收益，必须提前拦。 */
function renderFurnaceNextTurnRow(entry, level) {
  const cap = getUpgradeCapFor(entry);
  if (level >= cap) return "";
  if (typeof cardGainsFromRefine === "function" && !cardGainsFromRefine(entry)) {
    return `<div class="furnace-next-warn"><dt>下一转</dt><dd>此蛊为资源型，炼化不提升数值——建议改炼别的蛊</dd></div>`;
  }
  const delta = typeof getRefineDeltaText === "function" ? getRefineDeltaText(entry, level, level + 1) : "";
  return `<div class="furnace-next-gain"><dt>下一转</dt><dd>${delta ? escapeAttribute(delta) : "效果小幅提升"}</dd></div>`;
}

function renderFurnaceCompare(entry, level, label) {
  const previewEntry = { ...entry, upgradeLevel: level };
  return `<span class="upgrade-badge">${label}</span>
    <strong>${getCardTitle(previewEntry, { states: false })}</strong>
    ${renderCardInfoRows(previewEntry, { includeSeal: false, includeOrigin: false })}
    <p>${withChinesePeriod(getCardEffectForEntry(previewEntry))}</p>`;
}

function getUpgradeResultText(entry, oldLevel, newLevel) {
  const v = getCardValues({ ...entry, upgradeLevel: newLevel }, newLevel);
  const name = getDisplayCardName(entry.key, newLevel);
  switch (entry.key) {
    case "moonBlade": return `炼成${name}，基础伤害提升至 ${v.damage}。`;
    case "ironSkin": return `炼成${name}，基础防御提升至 ${v.armor}。`;
    case "wineWorm": return `炼成${name}，下一张攻击蛊伤害翻倍，并抽 ${v.draw} 张牌${newLevel >= 2 ? "，消耗降为 0" : ""}。`;
    case "bloodBlade": return `炼成${name}，基础伤害提升至 ${v.damage}，血煞收益保留。`;
    case "bloodReversal": return `炼成${name}，基础伤害提升至 ${v.damage}，血煞倍率提升至 ×${v.bloodMultiplier}。`;
    case "bloodTide": return `炼成${name}，基础伤害提升至 ${v.damage}，血煞倍率提升至 ×${v.bloodMultiplier}。`;
    case "greenMiasma": return `炼成${name}，施毒提升至 ${v.poison} 层。`;
    case "insectSwarm": return `炼成${name}，伤害提升至 ${v.damage}，施毒提升至 ${v.poison} 层。`;
    case "mysticCarapace":
    case "fixedFate":
    case "moltingShell": return `炼成${name}，基础防御提升至 ${v.armor}。`;
    case "reversePath": return `炼成${name}，防御提升至 ${v.armor}，命势收益提升至 ${v.fateGain}。`;
    case "essenceGathering": return `炼成${name}，获得 ${v.energy} 真元并抽 ${v.draw} 张牌。`;
    case "bloodSacrifice": return `炼成${name}，血煞 +${v.bloodGain}，抽 ${v.draw} 张牌。`;
    case "bloodThirst": return `炼成${name}，基础伤害提升至 ${v.damage}，恢复提升至 ${v.heal}。`;
    case "armorBreaker": return `炼成${name}，基础伤害提升至 ${v.damage}，破甲追加提升至 ${v.armorBonus}。`;
    case "yuanReturn": return `炼成${name}，获得 ${v.energy} 真元，辅助余韵抽 ${v.supportDraw} 张。`;
    case "shellRemnant": return `炼成${name}，基础防御提升至 ${v.armor}，受伤追加提升至 ${v.hurtArmor}。`;
    case "guFeeding": return `炼成${name}，抽牌提升至 ${v.draw} 张。`;
    case "soulCrack": return `炼成${name}，基础伤害提升至 ${v.damage}，寿元代价保留。`;
    case "armorMeltPoison": return `炼成${name}，伤害 ${v.damage}、施毒 ${v.poison}、蚀甲 ${v.armorRemove}。`;
    case "bloodRobe": return `炼成${name}，防御提升至 ${v.armor}，血煞 +${v.bloodGain}。`;
    case "lifeLamp": return `炼成${name}，命势 +${v.fateGain}，满势治疗 ${v.heal}。`;
    default: return `炼成${name}，效果更新为：${stripTags(getCardEffect({ ...entry, upgradeLevel: newLevel }, newLevel))}。`;
  }
}

function hasAnyMaterial() {
  return MATERIAL_IDS.some((id) => (runState?.materials?.[id] || 0) > 0);
}

function getMaterialCount(id) {
  return runState?.materials?.[id] || 0;
}

function renderMaterialInventory() {
  return MATERIAL_IDS.map((id) => {
    const item = MATERIALS[id];
    const count = getMaterialCount(id);
    return `<article class="material-chip material-${item.tone} ${count <= 0 ? "empty" : ""}" title="${escapeAttribute(item.description)}">
      <span><b>${item.glyph}</b><strong>${item.name} x${count}</strong></span>
      <small>偏向：${item.short}</small>
      <em>${item.description}</em>
    </article>`;
  }).join("");
}


function renderFurnaceMaterialButton(id) {
  const item = MATERIALS[id];
  const count = getMaterialCount(id);
  return `<button class="material-choice material-${item.tone}" type="button" data-furnace-material="${id}" ${count <= 0 ? "disabled" : ""}>
    <span class="material-glyph">${item.glyph}</span>
    <strong>${item.name}</strong>
    <small>持有 ${count} · 适合：${getMaterialFitText(id)}</small>
    <p>${item.description}</p>
  </button>`;
}

function getMaterialFitText(id) {
  if (id === "bloodSand") return "攻击蛊、血道蛊";
  if (id === "insectMolt") return "护甲蛊、辅助蛊";
  if (id === "rotLiquid") return "毒道蛊";
  if (id === "fateSilk") return "命势蛊、辅助蛊";
  if (id === "boneCrystal") return "攻击蛊、破甲蛊、蚀甲蛊"; // V0.9.55：攻击蛊纳入，文案与 isMaterialMatched 同步
  if (id === "lifeEmber") return "寿道蛊、疗愈蛊";
  if (id === "yuanDew") return "零费蛊、聚元蛊";
  return "所有蛊，但风险更高";
}

function isMaterialMatched(entry, materialId) {
  const card = CARD_LIBRARY[entry.key];
  if (!card || materialId === "remnantSoul") return false;
  const typeName = card.typeName || "";
  if (materialId === "bloodSand") return card.category === "attack" || card.type === "blood" || typeName.includes("血道");
  if (materialId === "insectMolt") return card.category === "defense" || card.category === "utility";
  if (materialId === "rotLiquid") return card.type === "poison" || typeName.includes("毒道");
  if (materialId === "fateSilk") return card.type === "fate" || card.category === "utility";
  /* V0.9.55 玩家反馈「攻击蛊的材料太少」——实测确认：全库 60 张牌里，
   * utility 每张平均能匹配 2.77 种材料，attack 只有 1.39（只认血砂一路），差了一倍。
   * 同时锐骨晶全库只匹配 2 张牌，近乎废材料——而它自己的说明本就写着
   * 「偏向破甲、蚀甲与穿透爆发」，穿透爆发却从未实现。
   * 故把攻击蛊纳入锐骨晶：攻击多一条材料路（1.39→约 2.4，仍略低于 utility 的 2.77，
   * 不反超），锐骨晶也从废材料回到有用（2→约 25 张）。一处改，两个病。 */
  if (materialId === "boneCrystal") return card.category === "attack" || entry.key === "armorBreaker" || entry.key === "armorMeltPoison" || typeName.includes("破甲") || typeName.includes("蚀甲");
  if (materialId === "lifeEmber") return card.type === "lifespan" || typeName.includes("疗愈");
  if (materialId === "yuanDew") return card.cost === 0 || entry.key === "essenceGathering" || entry.key === "burningEssence";
  return false;
}

function getFurnaceProbabilities(entry, materialId) {
  if (materialId === "remnantSoul") return REFINING_BALANCE.furnaceProbabilities.remnantSoul;
  if (isMaterialMatched(entry, materialId)) return REFINING_BALANCE.furnaceProbabilities.matched;
  return REFINING_BALANCE.furnaceProbabilities.mismatched;
}
// V0.9.19 十重天·六重炉险：稳定让 10pp 给反噬。单一事实源——resolveFurnacePlan 与决策页展示同口径（V0.9.30 修展示/实际不一致）。
function getFurnaceTianShift() {
  return (runState?.mode === "tian" && (runState.tianTier || 0) >= REFINING_BALANCE.tianFurnaceShiftTier) ? REFINING_BALANCE.tianFurnaceBacklashShift : 0;
}
// 决策页展示用的实际概率（含六重炉险位移）：稳定 -shift、反噬 +shift、异变不动。
function getShownFurnaceProbabilities(rawProbs) {
  const shift = getFurnaceTianShift();
  if (!shift) return rawProbs;
  return {
    ...rawProbs,
    stable: Math.max(0, rawProbs.stable - shift),
    backlash: Math.min(100, rawProbs.backlash + shift),
  };
}

function getFurnaceMatchHint(entry, materialId) {
  if (materialId === "remnantSoul") {
    return { className: "soul", text: "残魂入炉，异变概率提高，但反噬难测。" };
  }
  if (isMaterialMatched(entry, materialId)) {
    return { className: "match", text: "材料契合，炉火较稳。" };
  }
  return { className: "mismatch", text: "蛊性相冲，反噬风险提高。" };
}

function getGenericMutationKey(entry) {
  const card = CARD_LIBRARY[entry.key] || {};
  if (card.type === "poison" || card.typeName?.includes("毒道")) return "mutantPoison";
  if (card.category === "defense") return "mutantArmor";
  if (card.category === "attack") return "mutantBlade";
  return "mutantFate";
}

function getMutationTargetKey(entry, materialId) {
  return SPECIFIC_MUTATIONS[`${entry.key}:${materialId}`] || getGenericMutationKey(entry);
}

function canCardEnterFurnace(entry) {
  return entry && getUpgradeLevel(entry) < getUpgradeCapFor(entry);
}

function canMutateEntry(entry) {
  return Boolean(entry && !entry.mutated && runState.mutationCount < MAX_RUN_MUTATIONS);
}

function getFurnacePlan(entry, materialId) {
  const probabilities = getFurnaceProbabilities(entry, materialId);
  const currentLevel = getUpgradeLevel(entry);
  const stableLevel = Math.min(getUpgradeCapFor(entry), currentLevel + 1);
  const mutationKey = getMutationTargetKey(entry, materialId);
  const mutationAllowed = canMutateEntry(entry);
  const material = MATERIALS[materialId];
  return {
    entryId: entry.instanceId,
    materialId,
    materialName: material.name,
    probabilities,
    currentLevel,
    stableLevel,
    mutationKey,
    mutationAllowed,
    mutationRedirectReason: entry.mutated
      ? "此蛊已发生过异变；若掷出异变，将转为稳定炼化。"
      : runState.mutationCount >= MAX_RUN_MUTATIONS
        ? "本局异变次数已达上限；若掷出异变，将转为稳定炼化。"
        : "",
  };
}

function renderFurnaceRouteSummary(entry, plan) {
  const mutationName = CARD_LIBRARY[plan.mutationKey]?.name || "未知异变";
  const stablePreview = { ...entry, upgradeLevel: plan.stableLevel };
  const material = MATERIALS[plan.materialId];
  const hint = getFurnaceMatchHint(entry, plan.materialId);
  const mutationText = plan.mutationAllowed
    ? `${mutationName}：${withChinesePeriod(stripTags(getCardEffect(plan.mutationKey, 1)))}`
    : plan.mutationRedirectReason;
  const backlashText = "反噬可能：蛊损暂歇、反伤 6 生命、折损 2 寿元，或偏斜 +1 但附带小代价（不再永久卡损或砍最大生命）——极小概率「逆火淬体」，反噬翻盘为强化。";
  const odds = getShownFurnaceProbabilities(plan.probabilities); // V0.9.30 展示实际概率（含六重炉险位移，与 resolve 同口径）
  return `<div class="route-hint ${hint.className}">
      <strong>${material.name}</strong><span>${hint.text}</span>
    </div>
    <div class="route-oddsbar" role="img" aria-label="炉火概率：稳定 ${odds.stable}% 异变 ${odds.mutation}% 反噬 ${odds.backlash}%">
      <span class="odds-seg odds-stable" style="flex:${Math.max(0, odds.stable)}"></span>
      <span class="odds-seg odds-mutation" style="flex:${Math.max(0, odds.mutation)}"></span>
      <span class="odds-seg odds-backlash" style="flex:${Math.max(0, odds.backlash)}"></span>
    </div>
    <div class="route-grid">
      <article class="stable-route"><b${keywordAttr("炼化")}>稳定炼化 <strong>${odds.stable}%</strong></b><p>${getDisplayCardName(entry.key, plan.stableLevel)}：${withChinesePeriod(stripTags(getCardEffectForEntry(stablePreview)))}</p></article>
      <article class="mutation-route"><b${keywordAttr("异变")}>蛊性异变 <strong>${odds.mutation}%</strong></b><p>${mutationText}</p></article>
      <article class="backlash-route"><b${keywordAttr("反噬")}>炼蛊反噬 <strong>${odds.backlash}%</strong></b><p>${backlashText}</p></article>
    </div>`;
}

function consumeSelectedMaterial(materialId) {
  if (!runState.materials[materialId]) return false;
  runState.materials[materialId] -= 1;
  if (typeof updateTopMaterials === "function") updateTopMaterials(); // V0.9.51 顶栏材料条随消耗即时刷新
  return true;
}

function applyStableFurnace(entry, materialId, forcedText = "") {
  const oldLevel = getUpgradeLevel(entry);
  entry.upgradeLevel = Math.min(getUpgradeCapFor(entry), oldLevel + 1);
  runState.stableCount = (runState.stableCount || 0) + 1;
  getRunStats().stableRefines += 1;
  const oldName = getDisplayCardName(entry.key, oldLevel);
  const newName = getDisplayCardName(entry.key, entry.upgradeLevel);
  const material = MATERIALS[materialId];
  const text = forcedText || `炉火稳定：${oldName}炼化为${newName}。`;
  addLog(`${text}${material ? ` ${material.name}融入蛊纹。` : ""}`, "positive-log");
  unlockLorePage("stableFire");
  return { kind: "stable", title: `炉火稳定：${newName}`, className: "stable" };
}

function applyMutationFurnace(entry, materialId) {
  const previousKey = entry.key;
  const targetKey = getMutationTargetKey(entry, materialId);
  const originalName = CARD_LIBRARY[previousKey]?.name || previousKey;
  entry.originalKey = entry.originalKey || previousKey;
  entry.key = targetKey;
  entry.upgradeLevel = 1;
  entry.mutated = true;
  entry.mutationMaterialId = materialId;
  entry.damaged = false;
  entry.skewed = false;
  entry.costPenalty = 0;
  runState.mutationCount = Math.min(MAX_RUN_MUTATIONS, runState.mutationCount + 1);
  getRunStats().mutations += 1;
  const newName = getDisplayCardName(targetKey, entry.upgradeLevel);
  addLog(`蛊性异变：${MATERIALS[materialId].name}扭转${originalName}，化为${newName}。`, "important");
  unlockLorePage("untamed");
  return { kind: "mutation", title: `蛊性异变：${newName}`, className: "mutation" };
}

function reduceRunHpSafely(amount) {
  const before = runState.currentHp;
  runState.currentHp = Math.max(1, runState.currentHp - amount);
  recordMupanCostDelta(getRunStats(), "selfHpLost", before, runState.currentHp, "active");
  if (game?.player) game.player.hp = Math.max(1, game.player.hp - amount);
  dom.resultHp.textContent = runState.currentHp;
  return before - runState.currentHp;
}

function reduceRunLifespan(amount, { source = "active" } = {}) {
  const before = runState.lifespan;
  runState.lifespan -= amount;
  if (game?.player) game.player.lifespan -= amount;
  let maxHpLost = 0;
  // V0.9.8.5（1-C）：寿元见底只夹到 0，不再连带砍最大生命（去掉"赌一把"永久亏损）。
  if (runState.lifespan < 0) {
    runState.lifespan = 0;
    if (game?.player) game.player.lifespan = 0;
  }
  recordMupanCostDelta(getRunStats(), "lifespanSpent", before, runState.lifespan, source);
  dom.resultHp.textContent = runState.currentHp;
  return maxHpLost;
}

function applyBacklashFurnace(entry) {
  const options = ["damageCard", "hurtPlayer", "loseLifespan", "skewCard"];
  const result = options[getRunRandomInt(options.length, "refine")];
  const cardName = getDisplayCardName(entry.key, getUpgradeLevel(entry));
  runState.backlashCount = (runState.backlashCount || 0) + 1;
  getRunStats().backlashes += 1;
  unlockLorePage("backlash");
  const mitigated = consumeFurnaceAshMitigation();
  if (result === "damageCard") {
    entry.damaged = true;
    // V0.9.8.5（1-C）：去掉永久 costPenalty+1（"赌一把"不再永久卡损），只作蛊损提示。
    addLog(`炼蛊反噬：${cardName}蛊损未成${mitigated ? "，炉灰印压住反噬" : "，蛊性未稳、暂歇片刻"}。`, "damage-log");
    // V0.9.16 丹囊：蛊损不再白亏——炉中残料化作一件消耗品作补偿（满囊自动折算蛊石）
    const compensateId = pickBattleItemId();
    if (compensateId) grantBattleItem(compensateId, "蛊损残料所化");
    return { kind: "backlash", title: `炼蛊反噬：${cardName}受损`, className: "backlash" };
  }
  if (result === "hurtPlayer") {
    const amount = mitigated ? REFINING_BALANCE.backlash.hurtPlayer.mitigated : REFINING_BALANCE.backlash.hurtPlayer.normal;
    const lost = reduceRunHpSafely(amount);
    addLog(`炉火逆冲，${cardName}未成，反伤其主：失去 ${lost} 点生命${mitigated ? "（炉灰印减半）" : ""}。`, "damage-log");
    return { kind: "backlash", title: "炼蛊反噬：反伤其主", className: "backlash" };
  }
  if (result === "loseLifespan") {
    const amount = mitigated ? REFINING_BALANCE.backlash.loseLifespan.mitigated : REFINING_BALANCE.backlash.loseLifespan.normal;
    reduceRunLifespan(amount);
    addLog(`寿元折损：${cardName}未成，你失去 ${amount} 点寿元${mitigated ? "（炉灰印减半）" : ""}。`, "damage-log");
    return { kind: "backlash", title: "炼蛊反噬：寿元折损", className: "backlash" };
  }
  entry.upgradeLevel = Math.min(getUpgradeCapFor(entry), getUpgradeLevel(entry) + 1);
  if (!mitigated) entry.skewed = true;
  addLog(`蛊性偏斜：${getDisplayCardName(entry.key, entry.upgradeLevel)}成形${mitigated ? "，炉灰印压住偏斜代价" : `，但${getSkewPenaltyText(entry)}`}。`, "damage-log");
  return { kind: "backlash", title: mitigated ? `炉灰印镇炉：${getDisplayCardName(entry.key, entry.upgradeLevel)}` : `蛊性偏斜：${getDisplayCardName(entry.key, entry.upgradeLevel)}`, className: "backlash" };
}

function consumeFurnaceAshMitigation() {
  if (!hasOrdinaryRelic("furnaceAshSeal") || runState.backlashMitigated) return false;
  runState.backlashMitigated = true;
  addLog("炉灰印生效：本局第一次炼蛊反噬代价减半。", "positive-log");
  return true;
}

function resolveFurnacePlan(entry, plan) {
  const roll = getRunRandom("refine") * 100;
  // V0.9.19 十重天·六重炉险：稳定区间让 10 个百分点给反噬（异变区间不动，反噬概率 +10pp）。
  const tianFurnaceShift = getFurnaceTianShift();
  const stableEnd = plan.probabilities.stable - tianFurnaceShift;
  const mutationEnd = stableEnd + plan.probabilities.mutation;
  if (roll < stableEnd) return applyStableFurnace(entry, plan.materialId);
  if (roll < mutationEnd) {
    if (plan.mutationAllowed) return applyMutationFurnace(entry, plan.materialId);
    return applyStableFurnace(entry, plan.materialId, `异变受限，炉火转稳：${getDisplayCardName(entry.key, getUpgradeLevel(entry))}炼化为${getDisplayCardName(entry.key, Math.min(getUpgradeCapFor(entry), getUpgradeLevel(entry) + 1))}。`);
  }
  // V0.9.30 逆火淬体：反噬区间最上缘 1/8 逆转为强化——把最怕的结果偶尔变狂喜。
  // 复用同一次 roll（不新增 getRunRandom 抽取），不打乱 refine 通道的 RNG 序列（种子/路线回归安全）。
  const backlashWidth = Math.max(0, 100 - mutationEnd);
  if (backlashWidth > 0 && roll >= 100 - backlashWidth * REFINING_BALANCE.reverseForgeBacklashShare) return applyReverseForge(entry, plan.materialId);
  return applyBacklashFurnace(entry);
}
// V0.9.30 逆火淬体：本欲反噬却被逆炼——淬净（去蛊损/偏斜）并稳升一级。强度约等于一次稳定炼化，稀有度来自"从反噬里翻盘"。
function applyReverseForge(entry, materialId) {
  const oldLevel = getUpgradeLevel(entry);
  entry.upgradeLevel = Math.min(getUpgradeCapFor(entry), oldLevel + 1);
  entry.damaged = false;
  entry.skewed = false;
  runState.reverseForgeCount = (runState.reverseForgeCount || 0) + 1;
  getRunStats().stableRefines += 1; // 计入稳定统计（正向结果）
  const newName = getDisplayCardName(entry.key, entry.upgradeLevel);
  const material = MATERIALS[materialId];
  addLog(`逆火淬体：炉火本欲反噬，却被这蛊生生逆炼——${newName}淬成${material ? `，${material.name}尽数化入蛊纹` : ""}。`, "positive-log");
  unlockLorePage("stableFire");
  return { kind: "reverse", title: `逆火淬体：${newName}`, className: "reverse" };
}
// V0.9.30 开炉仪式：结果砸下全屏分色仪式（复用破壳 showRiteOverlay + 现成 tone 样式），补上"开炉那一刻"的爽点。
const FURNACE_RITE_STYLE = Object.freeze({
  stable:   { tone: "gold",  seal: "稳", eyebrow: "蛊炉 · 炉火稳定", sfx: "forgeSuccess", hint: "点击任意处 · 收蛊", text: "炉火稳稳收势，蛊纹更深一分。" },
  mutation: { tone: "tian",  seal: "异", eyebrow: "蛊炉 · 蛊性异变", sfx: "forgeWard",    hint: "点击任意处 · 收蛊", text: "材料扭转蛊性，一蛊化作它形。" },
  reverse:  { tone: "jade",  seal: "淬", eyebrow: "蛊炉 · 逆火淬体", sfx: "forgeWard",    hint: "点击任意处 · 收蛊", text: "炉火本欲反噬，却被这蛊生生逆炼成器——大凶化大吉。" },
  backlash: { tone: "blood", seal: "噬", eyebrow: "蛊炉 · 炼蛊反噬", sfx: "forgeFail",    hint: "点击任意处 · 忍痛", text: "炉火逆冲，蛊未成器，反噬其主。" },
});
/* V0.9.51 用户定调：开炉仪式接入被炼蛊的立绘——炉火砸下时看见的是"我这只蛊"，
 * 而非一个通用印章。取万蛊录 GU_CATALOG 的 image（56 张蛊牌全覆盖），查不到则回落印章。 */
function getGuArtByCardKey(cardKey) {
  if (!cardKey || typeof window === "undefined" || !Array.isArray(window.GU_CATALOG)) return "";
  const hit = window.GU_CATALOG.find((it) => it.cardKey === cardKey);
  return (hit && hit.image) || "";
}
function showFurnaceRite(outcome, entry) {
  if (!outcome) return;
  const style = FURNACE_RITE_STYLE[outcome.kind] || FURNACE_RITE_STYLE.stable;
  window.AudioManager?.playSfx?.(style.sfx, { volumeScale: outcome.kind === "backlash" ? 1 : 0.95 });
  showRiteOverlay({
    tone: style.tone, eyebrow: style.eyebrow, seal: style.seal,
    title: outcome.title, text: style.text, hint: style.hint,
    autoMs: outcome.kind === "reverse" ? 6800 : 5200,
    art: getGuArtByCardKey(entry?.originalKey || entry?.key),
  });
}

function openFurnace() {
  const resultCard = dom.resultOverlay?.querySelector(".result-card");
  const furnaceScene = dom.furnacePanel?.querySelector(".furnace-scene");
  resultCard?.classList.remove("reward-choice-active", "reward-confirming", "material-choice-active", "material-confirming");
  resultCard?.classList.add("furnace-choice-active");
  resultCard?.classList.remove("furnace-confirming");
  if (resultCard) resultCard.scrollTop = 0;
  dom.cardRewardPanel.classList.add("hidden");
  dom.materialRewardPanel?.classList.add("hidden");
  dom.refinePanel.classList.add("hidden");
  dom.runSummary.classList.add("hidden");
  dom.resultPrimaryButton.classList.add("hidden");
  dom.resultSeal.textContent = "炉";
  dom.resultEyebrow.textContent = "蛊炉异变 · 材料炼蛊";
  dom.resultTitle.textContent = "蛊炉异变";
  dom.resultDescription.textContent = "先选一味材料，再选一张蛊牌。炉火会在稳定、异变与反噬之间随机判定。";
  dom.furnacePanel.classList.remove("hidden");
  dom.furnaceMaterialList.classList.remove("hidden");
  dom.furnaceMaterialChoices.classList.remove("hidden");
  dom.furnaceConfirm.classList.add("hidden");
  dom.confirmFurnaceButton.disabled = false;
  dom.backFurnaceButton.disabled = false;
  dom.furnaceComplete.classList.add("hidden");
  dom.furnaceChoices.classList.add("hidden");
  dom.furnaceSkipButton.classList.remove("hidden");
  dom.furnaceSkipButton.disabled = false;
  if (furnaceScene) {
    furnaceScene.dataset.materialTone = "idle";
    furnaceScene.classList.remove("is-heating", "is-feeding", "is-forging", "is-result-stable", "is-result-mutation", "is-result-reverse", "is-result-backlash");
  }
  runState.furnaceResolved = false;
  runState.selectedFurnaceMaterialId = null;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  runState.furnaceSequenceLocked = false;
  dom.furnaceMaterialList.innerHTML = renderMaterialInventory();
  dom.furnaceMaterialChoices.innerHTML = MATERIAL_IDS.map(renderFurnaceMaterialButton).join("");
  dom.furnaceChoices.innerHTML = "";
  dom.furnaceRouteSummary.innerHTML = "";
  playFurnaceOpenEffect();

  if (!hasAnyMaterial()) {
    runState.furnaceResolved = true;
    dom.furnaceMaterialChoices.classList.add("hidden");
    dom.furnaceSkipButton.classList.add("hidden");
    dom.furnaceComplete.classList.remove("hidden");
    dom.furnaceComplete.innerHTML = "<strong>炉火无材</strong><small>当前没有炼蛊材料，可继续前往下一层。</small>";
    addLog("炉火无材：当前没有炼蛊材料，本次蛊炉跳过。", "system-log");
    showNextFloorButton();
    return;
  }

  const candidates = getUpgradeableDeckEntries().filter(canCardEnterFurnace);
  runState.pendingFurnaceCandidates = candidates.map((entry) => entry.instanceId);
  if (!candidates.length) {
    runState.furnaceResolved = true;
    dom.furnaceMaterialChoices.classList.add("hidden");
    dom.furnaceChoices.innerHTML = "";
    dom.furnaceSkipButton.classList.add("hidden");
    dom.furnaceComplete.classList.remove("hidden");
    dom.furnaceComplete.innerHTML = "<strong>炉火无蛊</strong><small>当前蛊囊中没有可继续炼化的卡牌。</small>";
    addLog("蛊炉无蛊：当前卡组内没有可炼化卡牌。", "system-log");
    showNextFloorButton();
    return;
  }

  addLog("炉火燃起：请选择材料与一只蛊虫入炉。", "important");
  maybeShowFurnaceCoach();
}

// V0.9.8.5（1-D）：首次开炉一次性引导（稳定/异变/反噬），仅弹一次。复用 getStoredFlag/setStoredFlag，不新增 HTML。
const FURNACE_TIPS_STORAGE_KEY = "reverseGu.furnaceTips.seen";
function maybeShowFurnaceCoach() {
  if (getStoredFlag(FURNACE_TIPS_STORAGE_KEY)) return;
  setStoredFlag(FURNACE_TIPS_STORAGE_KEY, true);
  addLog("【炼蛊指引】选「材料 + 一只蛊」入炉：材料匹配该蛊流派时，大概率『稳定』强化（+伤害/数值），小概率『异变』（更强但有小代价），仅极小概率『反噬』（已大幅削弱，不再永久卡损或砍最大生命）。", "important");
  setBattleMessage("炼蛊：材料匹配流派越稳，赌一把期望为正。");
}

function selectFurnaceMaterial(materialId) {
  if (!runState || runState.furnaceResolved || !MATERIALS[materialId] || getMaterialCount(materialId) <= 0) return;
  runState.selectedFurnaceMaterialId = materialId;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  const candidates = getUpgradeableDeckEntries().filter(canCardEnterFurnace);
  runState.pendingFurnaceCandidates = candidates.map((entry) => entry.instanceId);
  dom.furnaceMaterialList.innerHTML = renderMaterialInventory();
  dom.furnaceMaterialChoices.innerHTML = MATERIAL_IDS.map((id) => {
    const html = renderFurnaceMaterialButton(id);
    return id === materialId ? html.replace("material-choice", "material-choice selected") : html;
  }).join("");
  dom.furnaceChoices.innerHTML = candidates.map(renderFurnaceChoice).join("");
  dom.furnaceChoices.classList.remove("hidden");
  dom.furnaceConfirm.classList.add("hidden");
  dom.furnaceComplete.classList.add("hidden");
  const furnaceScene = dom.furnacePanel?.querySelector(".furnace-scene");
  if (furnaceScene) {
    furnaceScene.dataset.materialTone = MATERIALS[materialId].tone || "idle";
    furnaceScene.classList.add("is-heating");
    furnaceScene.classList.remove("is-forging");
  }
  dom.resultDescription.textContent = `已选择「${MATERIALS[materialId].name}」。请选择一张蛊牌查看稳定、异变与反噬路线。`;
}

function selectFurnaceCandidate(instanceId) {
  if (!runState || runState.furnaceResolved) return;
  if (!runState.pendingFurnaceCandidates.includes(instanceId)) return;
  if (!runState.selectedFurnaceMaterialId) return;
  const entry = getDeckEntryById(instanceId);
  if (!entry || !canCardEnterFurnace(entry)) return;
  runState.selectedFurnaceCardId = instanceId;
  const currentLevel = getUpgradeLevel(entry);
  const plan = getFurnacePlan(entry, runState.selectedFurnaceMaterialId);
  runState.pendingFurnacePlan = plan;
  dom.furnaceChoices.classList.add("hidden");
  dom.furnaceMaterialChoices.classList.add("hidden");
  dom.furnaceSkipButton.classList.add("hidden");
  dom.furnaceConfirm.classList.remove("hidden");
  dom.resultOverlay?.querySelector(".result-card")?.classList.add("furnace-confirming");
  dom.furnaceConfirmOriginal.innerHTML = renderFurnaceCompare(entry, currentLevel, "当前效果");
  dom.furnaceConfirmUpgraded.innerHTML = renderFurnaceCompare(entry, plan.stableLevel, `稳定炼化 +${plan.stableLevel}`);
  dom.furnaceRouteSummary.innerHTML = renderFurnaceRouteSummary(entry, plan);
  dom.resultDescription.textContent = `材料「${plan.materialName}」与${CARD_LIBRARY[entry.key].name}入炉。确认后将随机判定，并消耗该材料。`;
}

function returnToFurnaceChoices() {
  if (!runState || runState.furnaceResolved) return;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  dom.furnaceConfirm.classList.add("hidden");
  dom.confirmFurnaceButton.disabled = false;
  dom.backFurnaceButton.disabled = false;
  dom.resultOverlay?.querySelector(".result-card")?.classList.remove("furnace-confirming");
  dom.furnaceMaterialChoices.classList.remove("hidden");
  if (runState.selectedFurnaceMaterialId) dom.furnaceChoices.classList.remove("hidden");
  dom.furnaceSkipButton.classList.remove("hidden");
  dom.resultDescription.textContent = runState.selectedFurnaceMaterialId
    ? `已选择「${MATERIALS[runState.selectedFurnaceMaterialId].name}」。请选择一张蛊牌查看路线。`
    : "先选一味材料，再选一张蛊牌。";
}

function confirmFurnaceUpgrade() {
  if (!runState || runState.furnaceResolved || runState.furnaceSequenceLocked || !runState.selectedFurnaceCardId || !runState.selectedFurnaceMaterialId) return;
  const entry = getDeckEntryById(runState.selectedFurnaceCardId);
  const plan = runState.pendingFurnacePlan;
  if (!entry || !plan || plan.entryId !== entry.instanceId || getMaterialCount(plan.materialId) <= 0) return;
  const furnaceScene = dom.furnacePanel?.querySelector(".furnace-scene");
  runState.furnaceSequenceLocked = true;
  dom.confirmFurnaceButton.disabled = true;
  dom.backFurnaceButton.disabled = true;
  furnaceScene?.classList.remove("is-result-stable", "is-result-mutation", "is-result-reverse", "is-result-backlash");
  furnaceScene?.classList.add("is-heating", "is-feeding");
  window.AudioManager?.playSfx?.("card", { volumeScale: 0.72 });
  setTimeout(() => {
    furnaceScene?.classList.remove("is-feeding");
    furnaceScene?.classList.add("is-forging");
    window.AudioManager?.playSfx?.("forgeRumble", { volumeScale: 0.74 });
  }, 420);
  setTimeout(() => {
    const outcome = resolveFurnacePlan(entry, plan);
    consumeSelectedMaterial(plan.materialId);
    runState.furnaceResolved = true;
    runState.furnaceSequenceLocked = false;
    runState.selectedFurnaceMaterialId = null;
    runState.selectedFurnaceCardId = null;
    runState.pendingFurnacePlan = null;
    furnaceScene?.classList.remove("is-forging");
    furnaceScene?.classList.add(`is-result-${outcome.kind || "stable"}`);
    dom.resultOverlay?.querySelector(".result-card")?.classList.remove("furnace-choice-active", "furnace-confirming");
    syncRunDeckKeys();
    dom.furnaceConfirm.classList.add("hidden");
    dom.furnaceChoices.classList.add("hidden");
    dom.furnaceMaterialChoices.classList.add("hidden");
    dom.furnaceMaterialList.innerHTML = renderMaterialInventory();
    dom.furnaceSkipButton.classList.add("hidden");
    dom.furnaceComplete.classList.remove("hidden");
    dom.furnaceComplete.className = `furnace-complete ${outcome.className || ""}`;
    dom.furnaceComplete.innerHTML = `<strong>${outcome.title}</strong><small>${stripTags(getCardEffectForEntry(entry))}</small>`;
    playFurnaceCompleteEffect(entry, outcome);
    render();
    showNextFloorButton();
    setTimeout(() => showFurnaceRite(outcome, entry), 260); // 先让玩家看见出炉闪光，再落全屏结算印
  }, 1280);
}

function skipFurnace() {
  if (!runState || runState.furnaceResolved || runState.furnaceSequenceLocked) return;
  runState.furnaceResolved = true;
  runState.selectedFurnaceMaterialId = null;
  runState.selectedFurnaceCardId = null;
  runState.pendingFurnacePlan = null;
  dom.resultOverlay?.querySelector(".result-card")?.classList.remove("furnace-choice-active", "furnace-confirming");
  dom.furnaceMaterialChoices?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.furnaceChoices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  dom.furnaceSkipButton.disabled = true;
  dom.furnaceSkipButton.classList.add("hidden");
  dom.furnaceConfirm.classList.add("hidden");
  dom.furnaceChoices.classList.add("hidden");
  dom.furnaceMaterialChoices.classList.add("hidden");
  dom.furnacePanel?.querySelector(".furnace-scene")?.classList.remove("is-heating", "is-forging");
  dom.furnaceComplete.classList.remove("hidden");
  dom.furnaceComplete.innerHTML = "<strong>炉火暂熄</strong><small>本次未进行炼化。</small>";
  addLog("炉火暂熄：本次未进行炼化。", "system-log");
  showNextFloorButton();
}


function hasRunMutation() {
  return (runState?.mutationCount || 0) > 0 || runState?.deckCards?.some((entry) => entry.mutated);
}

function hasRunBacklash() {
  return (runState?.backlashCount || 0) > 0 || runState?.deckCards?.some((entry) => entry.damaged || entry.skewed || entry.costPenalty > 0);
}


function getHighestUpgradeSummary() {
  const highest = Math.max(0, ...(runState?.deckCards || []).map((entry) => getUpgradeLevel(entry)));
  return highest > 0 ? `+${highest}` : "未炼化";
}


function playFurnaceOpenEffect() {
  if (!effectsAllowed()) return;
  const resultCard = dom.resultOverlay?.querySelector(".result-card");
  resultCard?.classList.add("furnace-active");
}

function playFurnaceCompleteEffect(entry, outcome = null) {
  if (!effectsAllowed()) return;
  pulseElement(dom.furnaceComplete, "furnace-forging", 900);
  const effectClass = outcome?.kind === "mutation"
    ? "effect-furnace-mutation"
    : outcome?.kind === "backlash"
      ? "effect-furnace-backlash"
      : "effect-furnace-seal";
  const text = outcome?.kind === "mutation"
    ? "蛊性异变"
    : outcome?.kind === "backlash"
      ? "炼蛊反噬"
      : `炼成：${getDisplayCardName(entry.key, getUpgradeLevel(entry))}`;
  spawnCenterEffect(effectClass, text, 920);
}
