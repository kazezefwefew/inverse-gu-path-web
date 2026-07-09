"use strict";
/* =====================================================================
 * 《逆命蛊途》万蛊录/图鉴模块  nmg-codex.js  (V0.9.36 批次B-3 模块化)
 * 从 game.js 抽出的图鉴系统：发现记录(markGuDiscovered/isGuUnlocked)、GU_CATEGORIES/GU_FILTERS、
 * openWanGuLu/renderWanGuLu/各标签渲染(蛊虫/本命/印录/残卷)、图鉴任务 CODEX_TASKS。
 * 附带通用工具 escGu(转义)/guGlyphFor——原就定义在本段内，随段移出，game.js 运行期照常调用。
 * ⚠ 须在 game.js 之前加载：本段构造期纯数据、无外部引用、无立即执行。
 * 注意：段内 renderCodexOverview/renderCodexTasks/renderGuTaskLink 各有两处定义(后覆盖前)——整段保序搬移、行为不变。
 * ===================================================================== */

/* ===================== 万蛊录（图鉴系统）===================== */
/* 可扩展：分类由 GU_CATEGORIES 驱动，未来加敌怪/Boss/异闻/流派只需放数据 + 在此置 ready:true。 */
const GU_DISCOVERED_KEY = "niming.discoveredGu";
function loadDiscoveredGu() {
  try {
    const raw = localStorage.getItem(GU_DISCOVERED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (err) { return new Set(); }
}
function saveDiscoveredGu(set) {
  try { localStorage.setItem(GU_DISCOVERED_KEY, JSON.stringify([...set])); } catch (err) { /* 忽略 */ }
}
function markGuDiscovered(cardKey) {
  if (!cardKey) return;
  const set = loadDiscoveredGu();
  if (set.has(cardKey)) return;
  set.add(cardKey);
  saveDiscoveredGu(set);
}
// 已解锁 = localStorage 持久集合 ∪ 当前局牌组中的卡键。
function getDiscoveredGuKeys() {
  const set = loadDiscoveredGu();
  (runState?.deckCards || []).forEach((entry) => { if (entry?.key) set.add(entry.key); });
  return set;
}
function isGuUnlocked(item, discovered) {
  return Boolean(item && item.cardKey && discovered.has(item.cardKey));
}

// V0.9.9.2 遗物谱：遗物收进万蛊录（本命 RELICS + 随身 ORDINARY_RELICS，获得即解锁·持久化）。
const RELIC_DISCOVERED_KEY = "niming.discoveredRelics";
function loadDiscoveredRelics() {
  try { const raw = localStorage.getItem(RELIC_DISCOVERED_KEY); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr) ? arr : []); } catch (err) { return new Set(); }
}
function markRelicDiscovered(relicId) {
  if (!relicId) return;
  const set = loadDiscoveredRelics();
  if (set.has(relicId)) return;
  set.add(relicId);
  try { localStorage.setItem(RELIC_DISCOVERED_KEY, JSON.stringify([...set])); } catch (err) { /* 忽略 */ }
}
// 已解锁 = 持久集合 ∪ 当前局已持有（本命 + 随身）
function getDiscoveredRelicIds() {
  const set = loadDiscoveredRelics();
  if (runState) {
    if (runState.relicId) set.add(runState.relicId);
    (runState.ordinaryRelics || []).forEach((id) => set.add(id));
  }
  return set;
}
function isRelicUnlocked(it, discovered) {
  return Boolean(it && it.relicId && discovered && discovered.has(it.relicId));
}
function relicFactionLabel(faction) {
  return ({ fate: "命势", blood: "血道", poison: "毒道", longevity: "寿道", common: "通用" })[faction] || "通用";
}
// 从 RELICS(本命) + ORDINARY_RELICS(随身) 动态生成遗物谱条目（单一数据源，不重复进 gu_catalog.js）。
function getRelicCatalogItems() {
  const items = [];
  Object.keys(RELICS).forEach((key) => {
    const r = RELICS[key];
    items.push({ id: "relic_" + key, category: "relic", relicId: key, name: r.name, glyph: r.glyph, tone: "gold",
      image: (PORTRAIT_PATHS.relics && PORTRAIT_PATHS.relics[key]) || "",
      kind: "本命遗物", rarity: "本命", faction: "本命", type: "遗物", gameplayEffect: r.description, dropsFrom: "开局四选一" });
  });
  Object.keys(ORDINARY_RELICS).forEach((key) => {
    const r = ORDINARY_RELICS[key];
    items.push({ id: "relic_" + key, category: "relic", relicId: key, name: r.name, glyph: r.glyph, tone: r.tone || "gold",
      kind: "随身遗物", rarity: "随身", faction: relicFactionLabel(r.faction), type: "遗物", gameplayEffect: r.description, dropsFrom: "命途所得（精英 / 逆命 / 血签 / 命途整备）" });
  });
  return items;
}

/* V0.9.16 丹囊：丹囊图鉴条目（恒显，小池子直接看全，帮助玩家理解新系统）。 */
function getItemCatalogItems() {
  return BATTLE_ITEM_IDS.map((key) => {
    const it = BATTLE_ITEMS[key];
    return { id: "item_" + key, category: "item", name: it.name, glyph: it.glyph, tone: "gold",
      kind: "战斗消耗品", rarity: "丹囊", faction: relicFactionLabel(it.faction), type: "消耗品",
      gameplayEffect: it.description, dropsFrom: "普通战斗掉落（约四分之一）· 蛊坊丹囊格 · 蛊损补偿" };
  });
}

// 万蛊录分类：第一版仅「蛊虫」实装，其余占位「即将开放」。
const GU_CATEGORIES = [
  { id: "overview", label: "总览", ready: true },
  { id: "gu", label: "蛊虫秘录", ready: true },
  { id: "hero", label: "蛊修列传", ready: true }, // V0.9.9 子批4：四名入塔蛊修传记，恒显
  { id: "relic", label: "遗物谱", ready: true }, // V0.9.9.2 遗物收进万蛊录：本命+随身，获得即解锁
  { id: "item", label: "丹囊", ready: true }, // V0.9.16 丹囊：战斗消耗品，恒显
  { id: "benming", label: "本命", ready: true }, // V0.9.20 本命蛊：跨局养成，恒显
  { id: "task", label: "图鉴任务", ready: true },
  { id: "seal", label: "蛊修印录", ready: true }, // V0.9.14：英雄×模式通关印记 + 称号收藏
  { id: "lore", label: "命蛊残卷", ready: true },
  { id: "eco", label: "生态·未实装", ready: true },
  { id: "enemy", label: "敌怪图谱", ready: true },
  { id: "boss", label: "首领残卷", ready: true },
  { id: "anecdote", label: "命途异闻", ready: false },
  { id: "faction", label: "流派源流", ready: false },
];
// 蛊虫列表筛选标签：按 type / faction / rarity 过滤。
const GU_FILTERS = [
  { id: "all", label: "全部", test: () => true },
  { id: "unlocked", label: "已悟", test: (it, d) => isGuUnlocked(it, d) },
  { id: "locked", label: "未悟", test: (it, d) => !isGuUnlocked(it, d) },
  { id: "attack", label: "攻击", test: (it) => it.type === "攻击" },
  { id: "defense", label: "防御", test: (it) => it.type === "防御" },
  { id: "support", label: "辅助", test: (it) => it.type === "辅助" || it.type === "状态" },
  { id: "poison", label: "毒道", test: (it) => it.faction === "毒道" },
  { id: "blood", label: "血道", test: (it) => it.faction === "血道" },
  { id: "bone", label: "骨道", test: (it) => it.faction === "骨道" },
  { id: "rare", label: "异蛊", test: (it) => it.rarity === "异蛊" },
  { id: "king", label: "王蛊", test: (it) => it.rarity === "王蛊" },
];
let wanGuLuEl = null;
let wanGuLuState = { tab: "gu", filter: "all", detailId: null, filterOpen: false };

function guGlyphFor(item) {
  const card = item.cardKey ? CARD_LIBRARY[item.cardKey] : null;
  return (card && card.glyph) || (item.name ? item.name.charAt(0) : "蛊");
}
function escGu(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function openWanGuLu() {
  if (!wanGuLuEl) {
    wanGuLuEl = document.createElement("div");
    wanGuLuEl.className = "wangulu-overlay hidden";
    wanGuLuEl.innerHTML = '<div class="wangulu-backdrop"></div><div class="wangulu-panel" role="dialog" aria-modal="true" aria-label="万蛊录"><div class="wangulu-head"><h2>万蛊录</h2><span class="wangulu-sub">残卷所录，皆曾入囊之物</span><button type="button" class="wangulu-close" aria-label="关闭">×</button></div><div class="wangulu-tabs"></div><div class="wangulu-content"></div></div>';
    document.body.appendChild(wanGuLuEl);
    wanGuLuEl.querySelector(".wangulu-backdrop").addEventListener("click", closeWanGuLu);
    wanGuLuEl.querySelector(".wangulu-close").addEventListener("click", closeWanGuLu);
    wanGuLuEl.addEventListener("click", onWanGuLuClick);
  }
  wanGuLuState.detailId = null;
  wanGuLuState.filterOpen = false;
  selectedLoreId = "";
  renderWanGuLu();
  wanGuLuEl.classList.remove("hidden");
  const content = wanGuLuEl.querySelector(".wangulu-content");
  if (content) content.scrollTop = 0;
}
function closeWanGuLu() { if (wanGuLuEl) wanGuLuEl.classList.add("hidden"); }

function onWanGuLuClick(event) {
  const claimBtn = event.target.closest("[data-codex-claim]");
  if (claimBtn) {
    const taskId = claimBtn.dataset.codexClaim;
    const result = codexClaimTask(taskId);
    if (result && result.ok) {
      try { playUiSfx(); } catch (err) { /* 忽略音效失败 */ }
      if (typeof addJourneyLog === "function") addJourneyLog(`万蛊录：领取图鉴印记「${result.taskName || "未名"}」。`, "positive-log");
    } else if (typeof devNotify === "function") {
      devNotify((result && result.message) || "图鉴印记尚不可领取。", "system-log");
    }
    renderWanGuLu();
    return;
  }
  const tabBtn = event.target.closest("[data-gu-tab]");
  if (tabBtn) {
    const cat = GU_CATEGORIES.find((c) => c.id === tabBtn.dataset.guTab);
    if (cat && cat.ready) { wanGuLuState.tab = cat.id; wanGuLuState.detailId = null; selectedLoreId = ""; renderWanGuLu(); }
    return;
  }
  const loreOpenBtn = event.target.closest("[data-lore-open]");
  if (loreOpenBtn) {
    if (isLoreUnlocked(loreOpenBtn.dataset.loreOpen)) {
      selectedLoreId = loreOpenBtn.dataset.loreOpen;
      renderWanGuLu();
      const c = wanGuLuEl.querySelector(".wangulu-content");
      if (c) c.scrollTop = 0;
    }
    return;
  }
  const loreBackBtn = event.target.closest("[data-lore-back]");
  if (loreBackBtn) {
    selectedLoreId = "";
    renderWanGuLu();
    const c = wanGuLuEl.querySelector(".wangulu-content");
    if (c) c.scrollTop = 0;
    return;
  }
  const loreCopyBtn = event.target.closest("[data-lore-copy]");
  if (loreCopyBtn) { copyLoreQuote(loreCopyBtn.dataset.loreCopy); return; }
  const filterToggle = event.target.closest("[data-gu-filter-toggle]");
  if (filterToggle) { wanGuLuState.filterOpen = !wanGuLuState.filterOpen; renderWanGuLu(); return; }
  const filterBtn = event.target.closest("[data-gu-filter]");
  if (filterBtn) { wanGuLuState.filter = filterBtn.dataset.guFilter; renderWanGuLu(); return; }
  const card = event.target.closest("[data-gu-id]");
  if (card) {
    if (card.classList.contains("is-locked")) return;
    wanGuLuState.detailId = card.dataset.guId; renderWanGuLu();
    const content = wanGuLuEl.querySelector(".wangulu-content");
    if (content) content.scrollTop = 0;
    return;
  }
  const back = event.target.closest("[data-gu-back]");
  if (back) {
    wanGuLuState.detailId = null; renderWanGuLu();
    const content = wanGuLuEl.querySelector(".wangulu-content");
    if (content) content.scrollTop = 0;
  }
}

function renderWanGuLu() {
  if (!wanGuLuEl) return;
  const tabsEl = wanGuLuEl.querySelector(".wangulu-tabs");
  tabsEl.innerHTML = GU_CATEGORIES.map((c) => {
    const cls = "wangulu-tab" + (c.id === wanGuLuState.tab ? " is-active" : "") + (c.ready ? "" : " is-soon");
    const soon = c.ready ? "" : '<i class="wangulu-soon">即将开放</i>';
    return '<button type="button" class="' + cls + '" data-gu-tab="' + c.id + '"' + (c.ready ? "" : " disabled") + '>' + escGu(c.label) + soon + '</button>';
  }).join("");
  const content = wanGuLuEl.querySelector(".wangulu-content");
  const cat = GU_CATEGORIES.find((c) => c.id === wanGuLuState.tab);
  if (!cat || !cat.ready) { content.innerHTML = '<div class="wangulu-empty">此卷尚封，墨迹未干。<br><span>敌怪 · 首领 · 异闻 · 流派，即将开放。</span></div>'; return; }
  if (cat.id === "overview") { content.innerHTML = renderCodexOverview(); return; }
  if (cat.id === "task") { content.innerHTML = renderCodexTasks(); return; }
  if (cat.id === "seal") { content.innerHTML = renderSealCodex(); return; }
  if (cat.id === "benming") { content.innerHTML = renderBenmingCodex(); return; } // V0.9.20 本命蛊页
  if (cat.id === "lore") { content.innerHTML = renderWanGuLuLore(); return; }
  if (wanGuLuState.detailId) { content.innerHTML = renderGuDetail(wanGuLuState.detailId); return; }
  content.innerHTML = renderGuList(cat.id);
}

/* V0.9.20 本命蛊页：四蛊 × 四形态全览——立绘（webp 待落图，缺图退印章占位）+ 被动 + 道行总账。 */
function renderBenmingCodex() {
  const totalDao = Object.keys(BENMING_GU).reduce((n, id) => n + getBenmingDaoxing(id), 0);
  const cards = Object.entries(BENMING_GU).map(([heroId, gu]) => {
    const hero = HEROES[heroId];
    const info = getBenmingStageInfo(heroId);
    const stages = BENMING_STAGES.map((s) => {
      const reached = info.stage >= s.stage;
      const img = getBenmingImagePath(heroId, s.stage);
      return `<div class="benming-stage ${reached ? "is-reached" : "is-locked"} ${info.stage === s.stage ? "is-current" : ""}">
        <div class="benming-stage-art">
          <span class="benming-stage-fallback">${reached ? gu.glyph : "？"}</span>
          ${reached ? `<img src="${img}" alt="${gu.name}·${s.name}" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        </div>
        <strong>${s.name}</strong>
        <small>${reached ? gu.stagePassives[s.stage] : `道行 ${s.threshold} 后显形`}</small>
      </div>`;
    }).join("");
    return `<article class="benming-card">
      <header><b>${gu.glyph}</b><div><strong>${gu.name}</strong><span>${hero?.name || heroId} 的本命蛊 · ${info.stageName} · 道行 ${info.dao}${info.next ? ` / ${info.next.threshold}` : " · 圆满"}</span></div></header>
      <p class="benming-lore">${gu.lore}</p>
      <div class="benming-stages">${stages}</div>
    </article>`;
  }).join("");
  return '<p class="wangulu-counter">本命蛊 · 跨局养成 · 四修道行合计 ' + totalDao + '（局末自动结算，休整节点可饲蛊）</p>'
    + '<div class="benming-grid">' + cards + '</div>';
}

/* V0.9.14 蛊修印录页：①英雄×模式通关印记矩阵 ②称号收藏（未得显剪影+获取条件）。全部读 localStorage，不碰战斗逻辑。 */
function renderSealCodex() {
  const modeOrder = ["normal", "elite", "deathtrial"];
  const heroRows = Object.entries(HEROES).map(([heroId, hero]) => {
    const seals = getHeroSeals(heroId);
    const chips = modeOrder.map((mode) => {
      const meta = SEAL_MODE_META[mode];
      const n = seals[mode] | 0;
      return '<span class="seal-chip ' + meta.cls + (n > 0 ? " is-earned" : "") + '" title="' + escGu(meta.full) + '">'
        + escGu(meta.label) + (n > 1 ? '<i>×' + n + '</i>' : '') + '</span>';
    }).join("");
    // V0.9.19 天印：十重天进度独立一枚（显示已通重数，通满第十重即为满印）。
    const tianN = getTianCleared(heroId);
    const tianChip = '<span class="seal-chip seal-tian' + (tianN > 0 ? " is-earned" : "") + '" title="天印 · 十重天已通至第 ' + tianN + ' 重">'
      + (tianN >= TIAN_MAX_TIER ? "天印·圆满" : (tianN > 0 ? "天·" + tianN + "重" : "天印")) + '</span>';
    return '<div class="seal-hero-row"><span class="seal-hero-name">' + escGu(hero.name) + '</span><span class="seal-chips">' + chips + tianChip + '</span></div>';
  }).join("");
  const sealTotal = Object.keys(HEROES).length * modeOrder.length;
  const sealEarned = Object.keys(HEROES).reduce((n, heroId) => {
    const s = getHeroSeals(heroId);
    return n + modeOrder.filter((m) => (s[m] | 0) > 0).length;
  }, 0);
  const collection = loadJsonStore(TITLE_COLLECTION_KEY);
  const gotTitles = TITLE_CATALOG.filter((t) => (collection[t.id] | 0) > 0).length;
  const titleCards = TITLE_CATALOG.map((t) => {
    const n = collection[t.id] | 0;
    if (n > 0) {
      return '<article class="seal-title-card is-earned"><strong>' + escGu(t.title) + (n > 1 ? '<i class="seal-title-count">×' + n + '</i>' : '') + '</strong>'
        + '<p>' + escGu(t.sub) + '</p></article>';
    }
    return '<article class="seal-title-card is-locked"><strong>？？？</strong><p>' + escGu(t.hint) + '</p></article>';
  }).join("");
  return '<p class="wangulu-counter">通关印记 ' + sealEarned + ' / ' + sealTotal + ' · 称号收藏 ' + gotTitles + ' / ' + TITLE_CATALOG.length + '（自 V0.9.14 起收录）</p>'
    + '<section class="wangulu-sec"><h4>通关印记 · 英雄×模式</h4><div class="seal-matrix">' + heroRows + '</div></section>'
    + '<section class="wangulu-sec"><h4>称号收藏 · 每局结算所得</h4><div class="seal-title-grid">' + titleCards + '</div></section>';
}

function renderGuList(catId) {
  catId = catId || "gu";
  const isEco = catId === "eco";
  const isHero = catId === "hero"; // V0.9.9 子批4：蛊修列传恒显（无 cardKey、不走解锁）
  const isRelic = catId === "relic"; // V0.9.9.2 遗物谱：获得即解锁
  const isItem = catId === "item"; // V0.9.16 丹囊：恒显
  const isBestiary = catId === "enemy" || catId === "boss";
  const items = isRelic ? getRelicCatalogItems() : (isItem ? getItemCatalogItems() : (window.GU_CATALOG || []).filter((it) => it.category === catId));
  const discovered = getDiscoveredGuKeys();
  const discoveredRelics = isRelic ? getDiscoveredRelicIds() : null;
  const bestiary = isBestiary ? layer2LoadBestiary() : null;
  const isOpen = (it) => isRelic ? isRelicUnlocked(it, discoveredRelics) : ((isEco || isHero || isItem) ? true : (isBestiary ? (it.enemyId ? bestiary.has(it.enemyId) : true) : isGuUnlocked(it, discovered)));
  let head = "";
  let shown = items;
  if (isHero) {
    head = '<p class="wangulu-counter">蛊修列传 · 共 ' + items.length + ' 位入塔蛊修</p>';
  } else if (isItem) {
    head = '<p class="wangulu-counter">丹囊 · 共 ' + items.length + ' 种战斗消耗品（囊中活蛊，用一次即失）</p>';
  } else if (isRelic) {
    const gotN = items.filter((it) => isOpen(it)).length;
    head = '<p class="wangulu-counter">遗物谱 · 已得 ' + gotN + ' / ' + items.length + '（获得即录）</p>';
  } else if (isEco) {
    head = '<p class="wangulu-counter">生态图鉴 · 共 ' + items.length + ' 种（暂未实装为战斗蛊牌）</p>';
  } else if (isBestiary) {
    const seen = items.filter((it) => isOpen(it)).length;
    head = '<p class="wangulu-counter">' + (catId === "boss" ? "首领残卷" : "敌怪图谱") + ' · 已遇 ' + seen + ' / ' + items.length + '（遭遇即录）</p>';
  } else {
    const filter = GU_FILTERS.find((f) => f.id === wanGuLuState.filter) || GU_FILTERS[0];
    shown = items.filter((it) => filter.test(it, discovered));
    const unlockedCount = items.filter((it) => isGuUnlocked(it, discovered)).length;
    const chips = GU_FILTERS.map((f) => '<button type="button" class="wangulu-chip' + (f.id === wanGuLuState.filter ? " is-active" : "") + '" data-gu-filter="' + f.id + '">' + escGu(f.label) + '</button>').join("");
    head = '<div class="wangulu-filterbar' + (wanGuLuState.filterOpen ? " is-open" : "") + '">'
      + '<button type="button" class="wangulu-filter-toggle" data-gu-filter-toggle aria-expanded="' + (wanGuLuState.filterOpen ? "true" : "false") + '">筛选 · ' + escGu(filter.label) + '</button>'
      + '<div class="wangulu-chips">' + chips + '</div></div>'
      + '<p class="wangulu-counter">已悟 ' + unlockedCount + ' / ' + items.length + ' 蛊</p>';
  }
  let grid = '<div class="wangulu-grid">';
  if (!shown.length) { grid += '<div class="wangulu-empty">无符此筛之蛊。</div>'; }
  shown.forEach((it) => {
    if (isOpen(it)) {
      const pendingFace = (isEco || isBestiary || isHero || isRelic || isItem) ? false : true;
      const face = it.image
        ? '<span class="wangulu-item-glyph wangulu-item-thumb"><img src="' + escGu(it.image) + '" alt="' + escGu(it.name) + '" loading="lazy"></span>'
        : '<span class="wangulu-item-glyph' + (pendingFace ? ' wangulu-glyph-pending' : '') + (isBestiary ? ' wangulu-glyph-foe' : '') + '">' + escGu(guGlyphFor(it)) + (pendingFace ? '<i class="wangulu-pending-corner">待补</i>' : '') + '</span>';
      const tag = isEco
        ? '<span class="wangulu-item-rarity wangulu-eco-badge">未实装</span>'
        : '<span class="wangulu-item-rarity wangulu-r-' + escGu(it.rarity) + '">' + escGu(it.rarity) + '</span>';
      grid += '<button type="button" class="wangulu-item' + (isEco ? " is-eco" : "") + '" data-gu-id="' + it.id + '">'
        + face + '<span class="wangulu-item-name">' + escGu(it.name) + '</span>' + tag + '</button>';
    } else {
      grid += '<button type="button" class="wangulu-item is-locked" data-gu-id="' + it.id + '" aria-disabled="true">'
        + '<span class="wangulu-item-glyph wangulu-silhouette">?</span>'
        + '<span class="wangulu-item-name">？？？</span>'
        + '<span class="wangulu-item-rarity">未悟</span>'
        + '</button>';
    }
  });
  grid += '</div>';
  return head + grid;
}

function renderGuDetail(id) {
  let it = (window.GU_CATALOG || []).find((x) => x.id === id);
  if (!it && typeof id === "string" && id.indexOf("relic_") === 0) it = getRelicCatalogItems().find((x) => x.id === id);
  if (!it && typeof id === "string" && id.indexOf("item_") === 0) it = getItemCatalogItems().find((x) => x.id === id); // V0.9.16 丹囊
  if (!it) return '<div class="wangulu-empty">残页佚失。</div>';
  // V0.9.9 子批4：蛊修列传走专属版式（无蛊虫的生态/组合，改本命被动 + 列传），恒显不走解锁。
  if (it.category === "hero") return renderHeroDetail(it);
  // V0.9.16 丹囊详情：恒显，复用遗物详情版式（kind/faction/功用/出处字段齐全）。
  if (it.category === "item") return renderRelicDetail(it);
  // V0.9.9.2 遗物谱详情：未解锁则回列表，解锁走专属版式。
  if (it.category === "relic") {
    if (!isRelicUnlocked(it, getDiscoveredRelicIds())) { wanGuLuState.detailId = null; return renderGuList(wanGuLuState.tab); }
    return renderRelicDetail(it);
  }
  const discovered = getDiscoveredGuKeys();
  if (it.category !== "eco" && it.category !== "enemy" && it.category !== "boss" && !isGuUnlocked(it, discovered)) { wanGuLuState.detailId = null; return renderGuList(wanGuLuState.tab); }
  const glyph = guGlyphFor(it);
  const artHtml = it.image
    ? '<img class="wangulu-art-img" src="' + escGu(it.image) + '" alt="' + escGu(it.name) + '" loading="lazy">'
    : '<span class="wangulu-art-glyph">' + escGu(glyph) + '</span>' + (it.category === "eco" ? '' : '<span class="wangulu-art-pending">待补立绘</span>');
  const row = (label, val) => val ? '<div class="wangulu-row"><span class="wangulu-row-k">' + escGu(label) + '</span><span class="wangulu-row-v">' + escGu(val) + '</span></div>' : "";
  const fold = (title, body) => body ? '<details class="wangulu-fold"><summary>' + escGu(title) + '</summary>' + body + '</details>' : "";
  const effectHtml = it.gameplayEffect
    ? '<p class="wangulu-effect">' + escGu(it.gameplayEffect) + '</p><p class="wangulu-short">' + escGu(it.descriptionShort) + '</p>'
    : '<p class="wangulu-effect wangulu-unimpl">暂未实装为战斗蛊牌（生态图鉴）</p><p class="wangulu-short">' + escGu(it.descriptionShort) + '</p>';
  const ecoTag = it.category === "eco" ? '<span class="wangulu-eco-badge">未实装</span>' : '';
  const sourceRows = row("出处", it.dropsFrom) + row("录入", it.unlockCondition);
  const ecologyRows = row("栖息", it.habitat) + row("食性", it.feeding) + row("秉性", it.temperament);
  const comboRows = row("演化", it.evolution) + row("相济", it.synergy) + row("相克", it.counteredBy);
  return '<button type="button" class="wangulu-back" data-gu-back>‹ 返回蛊录</button>'
    + '<article class="wangulu-detail">'
    + '<header class="wangulu-detail-head"><h3>' + escGu(it.name) + '</h3>'
    + '<p class="wangulu-detail-alias">' + escGu(it.alias || "") + '</p>'
    + '<div class="wangulu-tags"><span class="wangulu-r-' + escGu(it.rarity) + '">' + escGu(it.rarity) + '</span>'
    + '<span>' + escGu(it.faction) + '</span><span>' + escGu(it.type) + '</span>' + ecoTag + '</div></header>'
    + '<div class="wangulu-meta-strip">' + row("品阶", it.rarity) + row("道脉", it.faction) + row("类型", it.type) + row("形态", it.stage) + '</div>'
    + '<div class="wangulu-priority-grid">'
    + '<section class="wangulu-sec wangulu-primary-sec"><h4>战斗效果</h4>' + effectHtml + '</section>'
    + '<section class="wangulu-sec"><h4>获取方式</h4>' + (sourceRows || '<p class="wangulu-short">遭遇或获得后自动录入。</p>') + '</section>'
    + '</div>'
    + '<section class="wangulu-sec wangulu-art-sec"><h4>立绘</h4><div class="wangulu-art">' + artHtml + '<i class="wangulu-art-stage">' + escGu(it.stage || "") + '</i></div></section>'
    + fold("生态习性", ecologyRows)
    + fold("来历异闻", '<p class="wangulu-lore">' + escGu(it.descriptionLore) + '</p>')
    + fold("组合克制", comboRows)
    + renderGuTaskLink(it)
    + '</article>';
}

// V0.9.9 子批4：蛊修列传详情——专属版式，不套用蛊虫的生态习性/组合克制段。
function renderHeroDetail(it) {
  const glyph = it.glyph || (it.name ? it.name.charAt(0) : "蛊");
  const artHtml = it.image
    ? '<img class="wangulu-art-img" src="' + escGu(it.image) + '" alt="' + escGu(it.name) + '" loading="lazy">'
    : '<span class="wangulu-art-glyph">' + escGu(glyph) + '</span>';
  const row = (label, val) => val ? '<div class="wangulu-row"><span class="wangulu-row-k">' + escGu(label) + '</span><span class="wangulu-row-v">' + escGu(val) + '</span></div>' : "";
  return '<button type="button" class="wangulu-back" data-gu-back>‹ 返回蛊录</button>'
    + '<article class="wangulu-detail wangulu-hero-detail">'
    + '<header class="wangulu-detail-head"><h3>' + escGu(it.name) + '</h3>'
    + '<p class="wangulu-detail-alias">' + escGu(it.alias || "") + '</p>'
    + '<div class="wangulu-tags"><span class="wangulu-r-' + escGu(it.rarity) + '">' + escGu(it.rarity) + '</span>'
    + '<span>' + escGu(it.faction) + '</span><span>' + escGu(it.type) + '</span></div></header>'
    + '<div class="wangulu-meta-strip">' + row("道脉", it.faction) + row("形态", it.type) + row("初始生命", it.heroHp) + row("初始真元", it.heroEnergy) + row("初始寿元", it.heroLifespan) + '</div>'
    + '<div class="wangulu-priority-grid">'
    + '<section class="wangulu-sec wangulu-primary-sec"><h4>本命被动</h4><p class="wangulu-effect">' + escGu(it.gameplayEffect || "") + '</p><p class="wangulu-short">' + escGu(it.descriptionShort || "") + '</p></section>'
    + '<section class="wangulu-sec"><h4>录入方式</h4>' + row("出处", it.dropsFrom) + row("录入", it.unlockCondition) + '</section>'
    + '</div>'
    + '<section class="wangulu-sec wangulu-art-sec"><h4>立绘</h4><div class="wangulu-art">' + artHtml + '<i class="wangulu-art-stage">' + escGu(it.stage || "") + '</i></div></section>'
    + renderHeroSealSection(it)
    + '<details class="wangulu-fold"><summary>列传</summary><p class="wangulu-lore">' + escGu(it.descriptionLore || "") + '</p></details>'
    + '</article>';
}

/* V0.9.14 蛊修印录：列传详情内的通关印记段（按英雄名反查 heroId，查不到则不渲染）。V0.9.15 追加"所求"行。 */
function renderHeroSealSection(it) {
  const entry = Object.entries(HEROES).find(([, h]) => h.name === it.name);
  if (!entry) return "";
  const questHtml = entry[1].quest
    ? '<details class="wangulu-fold"><summary>所求</summary><p class="wangulu-lore">' + escGu(entry[1].quest) + '</p></details>'
    : "";
  const seals = getHeroSeals(entry[0]);
  const chips = ["normal", "elite", "deathtrial"].map((mode) => {
    const meta = SEAL_MODE_META[mode];
    const n = seals[mode] | 0;
    return '<span class="seal-chip ' + meta.cls + (n > 0 ? " is-earned" : "") + '">' + escGu(meta.label) + (n > 1 ? '<i>×' + n + '</i>' : '') + '</span>';
  }).join("");
  return questHtml + '<section class="wangulu-sec"><h4>通关印记</h4><div class="seal-chips seal-chips-detail">' + chips + '</div></section>';
}

// V0.9.9.2 遗物谱详情——专属版式（本命/随身 + 功用 + 出处），复用蛊修详情样式类。
function renderRelicDetail(it) {
  const glyph = it.glyph || (it.name ? it.name.charAt(0) : "遗");
  const row = (label, val) => val ? '<div class="wangulu-row"><span class="wangulu-row-k">' + escGu(label) + '</span><span class="wangulu-row-v">' + escGu(val) + '</span></div>' : "";
  const artHtml = it.image
    ? '<img class="wangulu-art-img" src="' + escGu(it.image) + '" alt="' + escGu(it.name) + '" loading="lazy">'
    : '<span class="wangulu-art-glyph relic-' + escGu(it.tone) + '">' + escGu(glyph) + '</span>';
  return '<button type="button" class="wangulu-back" data-gu-back>‹ 返回蛊录</button>'
    + '<article class="wangulu-detail wangulu-hero-detail">'
    + '<header class="wangulu-detail-head"><h3>' + escGu(it.name) + '</h3>'
    + '<div class="wangulu-tags"><span>' + escGu(it.kind) + '</span><span>' + escGu(it.faction) + '</span></div></header>'
    + '<div class="wangulu-meta-strip">' + row("类别", it.kind) + row("道脉", it.faction) + row("获得", it.dropsFrom) + '</div>'
    + '<div class="wangulu-priority-grid">'
    + '<section class="wangulu-sec wangulu-primary-sec"><h4>遗物功用</h4><p class="wangulu-effect">' + escGu(it.gameplayEffect || "") + '</p></section>'
    + '<section class="wangulu-sec"><h4>获取方式</h4>' + row("获得", it.dropsFrom) + '</section>'
    + '</div>'
    + '<details class="wangulu-fold"><summary>' + (it.image ? '立绘' : '纹样') + '</summary><div class="wangulu-art">' + artHtml + '</div></details>'
    + '</article>';
}

// 命蛊残卷收进万蛊录：复用 LORE_PAGES 与现成的目录/详情渲染，点击经 onWanGuLuClick 委托。
function renderWanGuLuLore() {
  const unlockedCount = LORE_PAGES.filter((p) => isLoreUnlocked(p.id)).length;
  const counter = '<p class="wangulu-counter">命蛊残卷 · 已显 ' + unlockedCount + ' / ' + LORE_PAGES.length + ' 页</p>';
  if (selectedLoreId) {
    return counter + '<div class="wangulu-lore-detail">' + renderLoreDetail(selectedLoreId) + '</div>';
  }
  return counter + '<div class="wangulu-lore-grid">' + renderLoreDirectory() + '</div>';
}


/* ===================== 万蛊录 · 图鉴任务预埋（V0.9.5.2）=====================
   纯展示：进度只读计算，绝不发奖励、不碰 CARD_LIBRARY / 初始卡组 / 战斗逻辑。
   所有任务/奖励恒标「预埋·后续版本开放」。新老玩家无数据均不报错。 */

/* localStorage 预留存根：只记录「展示状态」(如是否看过任务介绍)，绝不碰战斗存档/设置。 */
const CODEX_TASKS_KEY = "nmg.codex.tasks";
const CODEX_DISCOVERY_KEY = "nmg.codex.discovery";
function codexLoad(key) {
  try {
    const raw = localStorage.getItem(key);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (err) { return {}; }
}
function codexSave(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj && typeof obj === "object" ? obj : {})); } catch (err) { /* 忽略 */ }
}
function codexResetStub() { try { localStorage.removeItem(CODEX_TASKS_KEY); localStorage.removeItem(CODEX_DISCOVERY_KEY); } catch (err) { /* 忽略 */ } }
function codexMarkSeen(taskId) {
  if (!taskId) return;
  const data = codexLoad(CODEX_TASKS_KEY);
  if (!data.seen || typeof data.seen !== "object") data.seen = {};
  data.seen[taskId] = true;
  codexSave(CODEX_TASKS_KEY, data);
}

/* 图鉴任务数据：5 个，纯预埋。count() 只读真实进度，状态恒「预埋·后续版本开放」。 */
const CODEX_TASKS = [
  {
    id: "codex_baigu", name: "百蛊初识", target: 8,
    condition: "发现 8 种战斗蛊。",
    rewardPreview: "后续版本：通用特殊蛊将得入战后奖励池。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_dudao", name: "毒道入门", target: 5,
    condition: "发现 5 种毒道蛊（含虫群相关）。",
    rewardPreview: "后续版本：开放毒道特殊事件或毒道蛊池扩展。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && (it.faction === "毒道" || it.faction === "虫群") && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_xuedao", name: "血道残谱", target: 5,
    condition: "发现 5 种血道蛊。",
    rewardPreview: "后续版本：开放血道特殊蛊。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && it.faction === "血道" && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_mingtu", name: "命途偏转", target: 3,
    condition: "发现 3 种命途异蛊。",
    rewardPreview: "后续版本：开放命势特殊事件。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && it.faction === "命途" && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_canjuan", name: "残卷窥真", target: 3,
    condition: "阅读 3 卷命蛊残卷。",
    rewardPreview: "后续版本：开放残卷异闻与特殊蛊。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      try { return (typeof LORE_PAGES !== "undefined" ? LORE_PAGES : []).filter((p) => isLoreUnlocked(p.id)).length; }
      catch (err) { return 0; }
    },
  },
  { id: "codex_miasmaProbe", name: "瘴林初探", target: 1,
    condition: "进入第二层「瘴林深径」1 次。",
    rewardPreview: "后续版本：解锁毒道特殊蛊机会。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().miasmaEntered | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_bloodmarshProbe", name: "血沼初探", target: 1,
    condition: "进入第二层「血沼沉渊」1 次。",
    rewardPreview: "后续版本：解锁血道特殊蛊机会。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().bloodmarshEntered | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_miasmaName", name: "百瘴留名", target: 1,
    condition: "击败第二层 Boss「百瘴母蛊」。",
    rewardPreview: "后续版本：解锁瘴林残卷。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().miasmaBossDefeated | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_bloodRobeName", name: "血衣未散", target: 1,
    condition: "击败第二层 Boss「血衣蛊母」。",
    rewardPreview: "后续版本：解锁血道残谱。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return (layer2LoadProgress().bloodmarshBossDefeated | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_boneProbe", name: "骨塔初探", target: 1,
    condition: "进入第三层「骨塔高陵」1 次。",
    rewardPreview: "后续版本：解锁骨道特殊蛊机会。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return ((typeof layer3LoadProgress === "function" ? layer3LoadProgress().boneEntered : 0) | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_beehiveProbe", name: "蜂窟初探", target: 1,
    condition: "进入第三层「蜂窟魔巢」1 次。",
    rewardPreview: "后续版本：解锁毒道·蜂群特殊蛊机会。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return ((typeof layer3LoadProgress === "function" ? layer3LoadProgress().beehiveEntered : 0) | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_boneKingSlain", name: "守墓王破封", target: 1,
    condition: "击败第三层 Boss「骨巢守墓王」。",
    rewardPreview: "后续版本：解锁骨塔残卷。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return ((typeof layer3LoadProgress === "function" ? layer3LoadProgress().boneBossDefeated : 0) | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
  { id: "codex_queenSlain", name: "蜂后伏诛", target: 1,
    condition: "击败第三层 Boss「灾厄蜂后」。",
    rewardPreview: "后续版本：解锁蜂窟残卷。",
    status: "seed", note: "预埋·后续版本开放",
    count: () => { try { return ((typeof layer3LoadProgress === "function" ? layer3LoadProgress().beehiveBossDefeated : 0) | 0) > 0 ? 1 : 0; } catch (err) { return 0; } },
  },
];
function codexTaskById(id) { return CODEX_TASKS.find((t) => t.id === id) || null; }
function codexTaskProgress(task) {
  let cur = 0;
  try { cur = Math.max(0, task && typeof task.count === "function" ? (task.count() | 0) : 0); } catch (err) { cur = 0; }
  const target = task && task.target ? task.target : 0;
  return { cur: target ? Math.min(cur, target) : cur, raw: cur, target, done: target ? cur >= target : false };
}

/* 派生元信息：不改 gu_catalog 17 条，UI 由此函数取关联任务/类型/路线标签。命途→fateGu。 */
function guCodexMeta(item) {
  const it = item || {};
  const isEco = it.category === "eco";
  let codexType = "battleGu";
  if (isEco) codexType = "ecologyGu";
  else if (it.faction === "命途") codexType = "fateGu";
  const tags = [];
  switch (it.faction) {
    case "毒道": tags.push("毒道"); break;
    case "虫群": tags.push("虫群", "毒道"); break;
    case "血道": tags.push("血道"); break;
    case "命途": tags.push("命势"); break;
    case "护身": tags.push("护甲"); break;
    case "燃命": tags.push("燃命"); break;
    case "骨道": tags.push("骨道"); break;
    case "控场": tags.push("通用"); break;
    default: tags.push("通用"); break;
  }
  if (isEco) tags.push("生态", "未实装");
  let relatedTaskId = "codex_baigu";
  if (it.faction === "血道") relatedTaskId = "codex_xuedao";
  else if (it.faction === "毒道" || it.faction === "虫群") relatedTaskId = "codex_dudao";
  else if (it.faction === "命途") relatedTaskId = "codex_mingtu";
  else if (isEco) relatedTaskId = "codex_canjuan";
  return {
    codexType,
    routeTags: tags,
    isImplemented: it.category === "gu",
    isSpecialUnlock: false,
    relatedTaskId,
  };
}

/* 总览：蛊道进境（纯展示统计）。 */
function renderCodexOverview() {
  const cat = window.GU_CATALOG || [];
  const d = getDiscoveredGuKeys();
  const total = cat.length;
  const battleSeen = cat.filter((it) => it.category === "gu" && isGuUnlocked(it, d)).length;
  const battleTotal = cat.filter((it) => it.category === "gu").length;
  const ecoTotal = cat.filter((it) => it.category === "eco").length;
  let loreSeen = 0;
  try { loreSeen = (typeof LORE_PAGES !== "undefined" ? LORE_PAGES : []).filter((p) => isLoreUnlocked(p.id)).length; } catch (err) { loreSeen = 0; }
  const cell = (k, v) => '<div class="codex-progress-cell"><span class="codex-progress-num">' + escGu(v) + '</span><span class="codex-progress-k">' + escGu(k) + '</span></div>';
  return '<p class="wangulu-counter">蛊道进境 · 残卷所窥，不过初篇</p>'
    + '<div class="codex-progress">'
    + cell("已收录蛊虫", total)
    + cell("已见战斗蛊", battleSeen + ' / ' + battleTotal)
    + cell("已见生态蛊", ecoTotal)
    + cell("已读残卷", loreSeen + ' / ' + (typeof LORE_PAGES !== "undefined" ? LORE_PAGES.length : 0))
    + cell("图鉴任务·预埋", CODEX_TASKS.length)
    + '</div>'
    + '<p class="codex-overview-verse">蛊道无尽，所见不过初篇。<br>待残卷补全，异蛊自会显形。</p>';
}

/* 图鉴任务列表：条件 + 奖励预告 + 真实进度 + 醒目「预埋」徽章。进度满也不发奖。 */
function renderCodexTasks() {
  const cards = CODEX_TASKS.map((task) => {
    const p = codexTaskProgress(task);
    const pct = p.target ? Math.round((p.cur / p.target) * 100) : 0;
    return '<div class="codex-task-card">'
      + '<div class="codex-task-head"><h4>' + escGu(task.name) + '</h4><span class="codex-seed-badge">' + escGu(task.note) + '</span></div>'
      + '<p class="codex-task-cond"><span class="codex-task-k">解锁条件</span>' + escGu(task.condition) + '</p>'
      + '<p class="codex-task-reward"><span class="codex-task-k">奖励预告</span>' + escGu(task.rewardPreview) + '</p>'
      + '<div class="codex-task-bar"><span class="codex-task-bar-fill" style="width:' + pct + '%"></span></div>'
      + '<p class="codex-task-prog">当前进度 ' + escGu(p.cur) + ' / ' + escGu(p.target) + '（仅记录·' + (p.done ? '条件已足，待后续版本开放' : '尚未达成') + '）</p>'
      + '</div>';
  }).join("");
  const variant = '<div class="codex-variant-note">'
    + '<h4>初始卡组变体 · 预告</h4>'
    + '<p>后续版本或可在不增牌数的前提下，替换初始卡组一至两张：</p>'
    + '<ul>'
    + '<li>毒道入门：月刃蛊 → 青瘴蛊</li>'
    + '<li>血道残谱：月刃蛊 → 血刃蛊</li>'
    + '<li>命途偏转：一张防御蛊 → 命线蛊</li>'
    + '</ul>'
    + '<p class="codex-variant-warn">以上皆为预埋设想，本版未实装，当前不改动任何初始卡组。</p>'
    + '</div>';
  return '<p class="wangulu-counter">图鉴任务 · 共 ' + CODEX_TASKS.length + ' 则（皆预埋，进度只录不发奖）</p>'
    + '<div class="codex-task-list">' + cards + '</div>'
    + variant;
}

/* 蛊虫详情「相关图鉴任务」小区：由 guCodexMeta 推导，纯展示状态。 */
function renderGuTaskLink(item) {
  if (!item) return "";
  const meta = guCodexMeta(item);
  const task = codexTaskById(meta.relatedTaskId);
  let body = "";
  if (task) {
    const stateLabel = meta.isImplemented ? "后续版本开放" : "暂未实装为战斗蛊牌";
    body += '<div class="wangulu-task-link"><span class="wangulu-task-name">' + escGu(task.name) + '</span><span class="wangulu-task-state">' + escGu(stateLabel) + '</span></div>';
  }
  if (!meta.isImplemented) {
    body += '<div class="wangulu-task-link"><span class="wangulu-task-name">生态异闻</span><span class="wangulu-task-state">暂未实装</span></div>';
  }
  if (!body) return "";
  return '<section class="wangulu-sec"><h4>相关图鉴任务</h4>' + body + '<p class="wangulu-task-foot">皆为预埋，后续版本开放，当前不发奖励。</p></section>';
}
/* ===================== 万蛊录 · 图鉴任务转正（V0.9.12）=====================
   只授予收藏印记，不改卡牌、奖励池、战斗数值或初始牌组。旧版预埋渲染在此处被覆盖。 */
function codexTaskStore() {
  const data = codexLoad(CODEX_TASKS_KEY);
  if (!data.claimed || typeof data.claimed !== "object" || Array.isArray(data.claimed)) data.claimed = {};
  if (!data.claimedAt || typeof data.claimedAt !== "object" || Array.isArray(data.claimedAt)) data.claimedAt = {};
  return data;
}
function codexTaskRewardName(task) {
  return "图鉴印记「" + ((task && task.name) || "未名") + "」";
}
function codexGetClaimedMap() {
  return codexTaskStore().claimed || {};
}
function codexIsTaskClaimed(taskId) {
  const claimed = codexGetClaimedMap();
  return Boolean(taskId && claimed[taskId]);
}
function codexTaskState(task) {
  const progress = codexTaskProgress(task);
  const claimed = codexIsTaskClaimed(task && task.id);
  const claimable = Boolean(progress.done && !claimed);
  return {
    progress,
    claimed,
    claimable,
    label: claimed ? "已领取" : (claimable ? "可领取" : "进行中"),
    rewardName: codexTaskRewardName(task),
  };
}
function codexClaimTask(taskId) {
  const task = codexTaskById(taskId);
  if (!task) return { ok: false, message: "未找到这则图鉴任务。" };
  const state = codexTaskState(task);
  if (state.claimed) return { ok: false, message: "这枚图鉴印记已经领取。" };
  if (!state.claimable) return { ok: false, message: "图鉴任务尚未达成。" };
  const data = codexTaskStore();
  data.claimed[task.id] = true;
  data.claimedAt[task.id] = new Date().toISOString();
  codexSave(CODEX_TASKS_KEY, data);
  return { ok: true, taskName: task.name, rewardName: state.rewardName };
}
function codexClaimedCount() {
  const claimed = codexGetClaimedMap();
  return CODEX_TASKS.filter((task) => claimed[task.id]).length;
}

/* 总览：同步显示图鉴任务领取进度。 */
function renderCodexOverview() {
  const cat = window.GU_CATALOG || [];
  const d = getDiscoveredGuKeys();
  const total = cat.length;
  const battleSeen = cat.filter((it) => it.category === "gu" && isGuUnlocked(it, d)).length;
  const battleTotal = cat.filter((it) => it.category === "gu").length;
  const ecoTotal = cat.filter((it) => it.category === "eco").length;
  let loreSeen = 0;
  try { loreSeen = (typeof LORE_PAGES !== "undefined" ? LORE_PAGES : []).filter((p) => isLoreUnlocked(p.id)).length; } catch (err) { loreSeen = 0; }
  const claimedTasks = codexClaimedCount();
  const cell = (k, v) => '<div class="codex-progress-cell"><span class="codex-progress-num">' + escGu(v) + '</span><span class="codex-progress-k">' + escGu(k) + '</span></div>';
  return '<p class="wangulu-counter">蛊道进境 · 残卷所窥，不过初篇</p>'
    + '<div class="codex-progress">'
    + cell("已收录蛊虫", total)
    + cell("已见战斗蛊", battleSeen + ' / ' + battleTotal)
    + cell("已见生态蛊", ecoTotal)
    + cell("已读残卷", loreSeen + ' / ' + (typeof LORE_PAGES !== "undefined" ? LORE_PAGES.length : 0))
    + cell("图鉴任务 · 已领", claimedTasks + ' / ' + CODEX_TASKS.length)
    + '</div>'
    + '<p class="codex-overview-verse">完成图鉴任务可领取图鉴印记。<br>印记只作收藏与记录，不改变战斗数值。</p>';
}

/* 图鉴任务列表：真实进度 + 可领取收藏印记。 */
function renderCodexTasks() {
  const cards = CODEX_TASKS.map((task) => {
    const state = codexTaskState(task);
    const p = state.progress;
    const pct = p.target ? Math.round((p.cur / p.target) * 100) : 0;
    const cardCls = "codex-task-card" + (p.done ? " is-done" : "") + (state.claimable ? " is-claimable" : "") + (state.claimed ? " is-claimed" : "");
    const action = state.claimed
      ? '<button type="button" class="codex-task-claim" disabled>已领取</button>'
      : (state.claimable
        ? '<button type="button" class="codex-task-claim is-ready" data-codex-claim="' + escGu(task.id) + '">领取图鉴印记</button>'
        : '<button type="button" class="codex-task-claim" disabled>尚未达成</button>');
    const progText = state.claimed ? "已领取图鉴印记" : (state.claimable ? "可领取图鉴印记" : "继续探索命途");
    return '<div class="' + cardCls + '">'
      + '<div class="codex-task-head"><h4>' + escGu(task.name) + '</h4><span class="codex-task-stamp">' + escGu(state.label) + '</span></div>'
      + '<p class="codex-task-cond"><span class="codex-task-k">达成条件</span>' + escGu(task.condition) + '</p>'
      + '<p class="codex-task-reward"><span class="codex-task-k">任务奖励</span>' + escGu(state.rewardName) + ' · 永久收进万蛊录，不影响战斗数值。</p>'
      + '<div class="codex-task-bar"><span class="codex-task-bar-fill" style="width:' + pct + '%"></span></div>'
      + '<p class="codex-task-prog">当前进度 ' + escGu(p.cur) + ' / ' + escGu(p.target) + '（' + escGu(progText) + '）</p>'
      + '<div class="codex-task-actions">' + action + '</div>'
      + '</div>';
  }).join("");
  return '<p class="wangulu-counter">图鉴任务 · 已领 ' + codexClaimedCount() + ' / ' + CODEX_TASKS.length + ' 则</p>'
    + '<p class="codex-task-note">领取图鉴印记只改变万蛊录收藏进度，不改卡组、奖励、敌人或战斗数值。</p>'
    + '<div class="codex-task-list">' + cards + '</div>';
}

/* 蛊虫详情中的相关任务：展示真实领取状态。 */
function renderGuTaskLink(item) {
  if (!item) return "";
  const meta = guCodexMeta(item);
  const task = codexTaskById(meta.relatedTaskId);
  let body = "";
  if (task) {
    const state = codexTaskState(task);
    body += '<div class="wangulu-task-link"><span class="wangulu-task-name">' + escGu(task.name) + '</span><span class="wangulu-task-state">' + escGu(state.label) + '</span></div>';
  }
  if (!meta.isImplemented) {
    body += '<div class="wangulu-task-link"><span class="wangulu-task-name">生态异闻</span><span class="wangulu-task-state">尚未成为战斗蛊牌</span></div>';
  }
  if (!body) return "";
  return '<section class="wangulu-sec"><h4>相关图鉴任务</h4>' + body + '<p class="wangulu-task-foot">图鉴任务只授收藏印记，不改变战斗数值。</p></section>';
}
