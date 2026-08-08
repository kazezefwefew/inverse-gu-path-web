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
  return ({ fate: "命势", blood: "血道", poison: "毒道", longevity: "寿道", dragon: "龙裔", bone: "骨道", common: "通用" })[faction] || "通用"; // V0.9.51 #27：龙裔遗物入谱
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
      image: (PORTRAIT_PATHS.relics && PORTRAIT_PATHS.relics[key]) || "",
      kind: "随身遗物", rarity: "随身", faction: relicFactionLabel(r.faction), type: "遗物", gameplayEffect: r.description, dropsFrom: "命途所得（精英 / 逆命 / 血签 / 命途整备）" });
  });
  return items;
}

/* V0.9.16 丹囊：丹囊图鉴条目（恒显，小池子直接看全，帮助玩家理解新系统）。 */
function getItemCatalogItems() {
  return BATTLE_ITEM_IDS.map((key) => {
    const it = BATTLE_ITEMS[key];
    return { id: "item_" + key, category: "item", name: it.name, glyph: it.glyph, tone: "gold",
      image: (PORTRAIT_PATHS.battleItems && PORTRAIT_PATHS.battleItems[key]) || "",
      kind: "战斗消耗品", rarity: "丹囊", faction: relicFactionLabel(it.faction), type: "消耗品",
      gameplayEffect: it.description, dropsFrom: "普通战斗掉落（约四分之一）· 蛊坊丹囊格 · 蛊损补偿" };
  });
}

const CODEX_ANECDOTES = Object.freeze([
  {
    id: "anecdote_miasma_lamps", category: "anecdote", name: "瘴林借灯", glyph: "瘴", rarity: "异闻",
    alias: "灯照的是路，还是蛊", type: "命途异闻", faction: "瘴林深径", stage: "第二层",
    descriptionShort: "瘴林执灯者从不替活人照路。", descriptionLore: "入瘴林的人常看见远处有灯。追得越急，灯离得越远；停下喘息时，灯却会贴到背后。老蛊修说，那不是引路灯，而是百瘴母蛊借活人的影子丈量新巢。",
    note: "设计指向：毒道路线强调先布毒势、再追击，不鼓励无脑拖延。",
  },
  {
    id: "anecdote_bloodmarsh_debt", category: "anecdote", name: "血沼旧债", glyph: "血", rarity: "异闻",
    alias: "沼中没有白捡的血", type: "命途异闻", faction: "血沼沉渊", stage: "第二层",
    descriptionShort: "血衣蛊母记得每一滴不属于沼泽的血。", descriptionLore: "血沼会把伤者的血收进泥底，也会在许多年后连本带利地吐回。有人凭沼血养蛊一夜破境，第二日却发现自己的影子还留在泥里，替蛊母继续偿债。",
    note: "设计指向：血煞既是爆发资源，也是需要主动疏导的风险。",
  },
  {
    id: "anecdote_bone_bell", category: "anecdote", name: "骨铃数寿", glyph: "铃", rarity: "异闻",
    alias: "铃响一声，少一口余年", type: "命途异闻", faction: "骨塔高陵", stage: "第三层",
    descriptionShort: "骨铃并不招魂，它只提醒亡者谁还活着。", descriptionLore: "高陵风止时，骨铃仍会自己响。守陵人说每一声都在数某个入塔者的余寿；若有人回头寻找声源，铃便从他的骨头里继续响下去。",
    note: "设计指向：骨道以防御和削弱敌势换取稳定回合。",
  },
  {
    id: "anecdote_bee_queen", category: "anecdote", name: "无巢之蜂", glyph: "蜂", rarity: "异闻",
    alias: "蜂群只认一声心跳", type: "命途异闻", faction: "蜂窟魔巢", stage: "第三层",
    descriptionShort: "乱蜂并非各自为战，它们共享蛊母的一次怒意。", descriptionLore: "蜂窟里找不到真正的巢门。每只毒蜂都是门，每滴腐蜜都是路。只要蛊母心跳一次，散在千处的蜂便会同时转头，朝同一个染毒的伤口飞去。",
    note: "设计指向：虫群围绕已有毒层追击，形成先铺后爆的节奏。",
  },
]);

const CODEX_FACTIONS = Object.freeze([
  { id: "faction_fate", category: "faction", name: "命势流", glyph: "命", rarity: "源流", alias: "异类相织，圆满改命", type: "构筑源流", faction: "命势", stage: "攻·防·辅",
    descriptionShort: "交替打出不同类型的蛊牌积累命势。", descriptionLore: "命势不认蛊名，只认变化。攻击、护甲、辅助彼此换手，命线才会收紧；重复同类会让织路断开。", note: "长处：适应面广。风险：出牌顺序受限。代表蛊：命线蛊、逆途蛊、定数蛊。" },
  { id: "faction_blood", category: "faction", name: "血道流", glyph: "血", rarity: "源流", alias: "以伤养煞，以煞换命", type: "构筑源流", faction: "血道", stage: "自损·血煞",
    descriptionShort: "用生命换取血煞，再把血煞转为伤害、疗愈或护甲。", descriptionLore: "血道真正的门槛不是敢不敢受伤，而是能否在伤口失控前把血煞花出去。", note: "长处：爆发与恢复强。风险：生命线紧张。代表蛊：血刃蛊、返命蛊、血沼蛊。" },
  { id: "faction_poison", category: "faction", name: "毒道流", glyph: "毒", rarity: "源流", alias: "先蚀其表，再坏其里", type: "构筑源流", faction: "毒道", stage: "施毒·蚀毒",
    descriptionShort: "持续施毒削抗，再用追毒蛊收束。", descriptionLore: "毒不是一张牌的伤害，而是一条不断加深的伤口。真正的毒修会准备破抗、续毒和终结三种手段。", note: "长处：持续压制与破甲。风险：前期启动慢。代表蛊：青瘴蛊、蚀甲蛊、乱蜂蛊。" },
  { id: "faction_longevity", category: "faction", name: "寿道流", glyph: "寿", rarity: "源流", alias: "焚今日，夺明朝", type: "构筑源流", faction: "寿道", stage: "焚寿·夺寿",
    descriptionShort: "主动消耗寿元换取爆发，再从敌手夺回余年。", descriptionLore: "寿道并非单纯自残。它把寿元当成可借、可焚、可夺回的第二资源，但每一次误算都没有重来的余地。", note: "长处：回合爆发高。风险：寿元耗尽直接败亡。代表蛊：寿火蛊、焚寿蛊、蚀岁蛊。" },
  { id: "faction_dragon", category: "faction", name: "龙裔流", glyph: "龙", rarity: "源流", alias: "蓄鳞化龙，一息决胜", type: "构筑源流", faction: "龙裔", stage: "龙鳞·龙化",
    descriptionShort: "积攒龙鳞进入龙形，在有限回合内倾泻攻势。", descriptionLore: "龙鳞是蛰伏，龙化是偿还。只会屯鳞的人等不到胜机，只会抢化的人又没有足够的牌承接。", note: "长处：龙化窗口极强。风险：窗口外节奏偏慢。代表蛊：藏鳞蛊、逆鳞蛊、螭息蛊。" },
  { id: "faction_bone", category: "faction", name: "骨道流", glyph: "骨", rarity: "源流", alias: "闻铃辨骨，叩响断命", type: "构筑源流", faction: "骨道", stage: "骨鸣·叩铃",
    descriptionShort: "闻铃以得甲、破甲与主动碎甲积攒骨鸣，再叩响叩寿骨铃。", descriptionLore: "骨道取死物之坚，也听活人骨缝里的回声。闻铃先以厚甲承势，待骨鸣三响后，可将铃声化作镇魂之甲，或碎去自身防御换取穿骨直伤。", note: "长处：攻守可按局势切换。风险：叩铃会清空骨鸣，断命还需有甲可碎。代表蛊：叩甲蛊、断节蛊、余响蛊、骨庭蛊。" },
  { id: "faction_swarm", category: "faction", name: "虫群流", glyph: "群", rarity: "源流", alias: "一蛊引潮，百蛊追伤", type: "构筑源流", faction: "虫群", stage: "连携·追毒",
    descriptionShort: "连续出牌或借已有毒势，让后续虫群不断增幅。", descriptionLore: "虫群不在乎哪一只蛊最强，它只在乎上一只蛊留下了什么。伤口、毒性与出牌次序，都是下一群飞来的路标。", note: "长处：连携成长快。风险：起手和顺序要求高。代表蛊：群蛊噬、虫群蛊、乱蜂蛊。" },
]);

// 万蛊录分类：战斗、世界与构筑信息均已有真实数据支撑。
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
  { id: "eco", label: "命途生态", ready: true },
  { id: "enemy", label: "敌怪图谱", ready: true },
  { id: "boss", label: "首领残卷", ready: true },
  { id: "anecdote", label: "命途异闻", ready: true },
  { id: "faction", label: "流派源流", ready: true },
];
/* 图鉴只负责蛊虫【种类】，不再拿凡/灵/异/王与蛊庐的凡/灵/玄/天品阶混用。
 * 合练蛊由明确合练产物标记识别；其余按道脉分为通用蛊或流派蛊。 */
function getGuKindLabel(it) {
  if (it?.parkRare === true || (it?.cardKey && typeof CARD_LIBRARY !== "undefined" && CARD_LIBRARY[it.cardKey]?.parkRare === true)) return "珍稀蛊";
  if (String(it?.stage || "").startsWith("合练异蛊")) return "合练蛊";
  if (["通用", "护身", "控场", "燃命"].includes(String(it?.faction || ""))) return "通用蛊";
  return "流派蛊";
}
/* 颜色只表达战斗定位，不再兼任品质、稀有度或孵化档位。
 * 万蛊录与蛊庐共用这套口径：攻红、守蓝、辅绿、合练紫。 */
function getGuCombatTone(it) {
  if (Array.isArray(it?.fusedFrom) && it.fusedFrom.length > 0) return "mutation";
  if (String(it?.stage || "").startsWith("合练异蛊")) return "mutation";
  const role = `${String(it?.category || "")} ${String(it?.type || "")}`.toLowerCase();
  if (/defense|防御|护甲|攻防/.test(role)) return "defense";
  if (/attack|攻击|输出|blood|poison|lifespan/.test(role)) return "attack";
  return "support";
}
const GU_FILTERS = [
  { id: "all", label: "全部", test: () => true },
  { id: "rare", label: "珍稀蛊", test: (it) => getGuKindLabel(it) === "珍稀蛊" },
  { id: "unlocked", label: "已悟", test: (it, d) => isGuUnlocked(it, d) },
  { id: "locked", label: "未悟", test: (it, d) => !isGuUnlocked(it, d) },
  { id: "general", label: "通用蛊", test: (it) => getGuKindLabel(it) === "通用蛊" },
  { id: "factionGu", label: "流派蛊", test: (it) => getGuKindLabel(it) === "流派蛊" },
  { id: "fusion", label: "合练蛊", test: (it) => getGuKindLabel(it) === "合练蛊" },
  { id: "attack", label: "攻击", test: (it) => it.type === "攻击" },
  { id: "defense", label: "防御", test: (it) => it.type === "防御" },
  { id: "support", label: "辅助", test: (it) => it.type === "辅助" || it.type === "状态" },
  { id: "poison", label: "毒道", test: (it) => it.faction === "毒道" },
  { id: "blood", label: "血道", test: (it) => it.faction === "血道" },
  { id: "bone", label: "骨道", test: (it) => it.faction === "骨道" },
];
let wanGuLuEl = null;
let wanGuLuState = { tab: "gu", filter: "all", detailId: null, detailTab: "combat", filterOpen: false };
const CODEX_HUB_SEEN_KEY = "nmg.codex.hubSeen";

function guGlyphFor(item) {
  const card = item.cardKey ? CARD_LIBRARY[item.cardKey] : null;
  return (card && card.glyph) || (item.name ? item.name.charAt(0) : "蛊");
}
function escGu(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function getCodexDiscoveryTotal() {
  let total = loadDiscoveredGu().size + loadDiscoveredRelics().size;
  try { total += getLayer2Bestiary().size + getLayer3Bestiary().size; } catch (err) { /* 旧构建无生态记录时跳过 */ }
  try { total += (LORE_PAGES || []).filter((page) => isLoreUnlocked(page.id)).length; } catch (err) { /* 残卷模块未就绪时跳过 */ }
  return total;
}
function getCodexClaimableCount() {
  try { return CODEX_TASKS.filter((task) => codexTaskState(task).claimable).length; } catch (err) { return 0; }
}
function getCodexHubNotice() {
  let seen = 0;
  try { seen = Math.max(0, Number(localStorage.getItem(CODEX_HUB_SEEN_KEY)) || 0); } catch (err) { seen = 0; }
  const discovered = getCodexDiscoveryTotal();
  const fresh = Math.max(0, discovered - seen);
  const claimable = getCodexClaimableCount();
  return { count: fresh + claimable, fresh, claimable, label: claimable ? `待领取 ${claimable}` : (fresh ? `新发现 ${fresh}` : "") };
}
function markCodexHubSeen() {
  try { localStorage.setItem(CODEX_HUB_SEEN_KEY, String(getCodexDiscoveryTotal())); } catch (err) { /* 存储不可用不阻塞 */ }
}

function openWanGuLu(tabId = "") {
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
  wanGuLuState.detailTab = "combat";
  wanGuLuState.filterOpen = false;
  selectedLoreId = "";
  const requestedTab = GU_CATEGORIES.find((category) => category.id === tabId && category.ready);
  if (requestedTab) wanGuLuState.tab = requestedTab.id;
  else if (getCodexClaimableCount() > 0) wanGuLuState.tab = "task";
  markCodexHubSeen();
  renderWanGuLu();
  wanGuLuEl.classList.remove("hidden");
  if (typeof showCoachTip === "function") {
    showCoachTip("firstWanGuLu", "万蛊录查蛊种、敌怪与世界知识；蛊庐藏册找你亲手养过的个体，个体蜕变也只在蛊庐与正式命途中生效。", { forceToast: true, outOfRunTitle: true });
  }
  const content = wanGuLuEl.querySelector(".wangulu-content");
  if (content) content.scrollTop = 0;
  if (typeof refreshCollectionHubBadges === "function") refreshCollectionHubBadges();
}

function openWanGuLuEntry(cardKey) {
  const item = (window.GU_CATALOG || []).find((entry) => entry.cardKey === cardKey);
  if (item && typeof markGuDiscovered === "function") markGuDiscovered(cardKey);
  openWanGuLu();
  if (!item) return false;
  wanGuLuState.tab = "gu";
  wanGuLuState.detailId = item.id;
  wanGuLuState.detailTab = "combat";
  renderWanGuLu();
  const content = wanGuLuEl && wanGuLuEl.querySelector(".wangulu-content");
  if (content) content.scrollTop = 0;
  return true;
}
function closeWanGuLu() { if (wanGuLuEl) wanGuLuEl.classList.add("hidden"); }

function onWanGuLuClick(event) {
  const equipTitleBtn = event.target.closest("[data-title-equip]");
  if (equipTitleBtn) {
    const titleId = equipTitleBtn.dataset.titleEquip;
    if (setEquippedTitleId(titleId)) {
      try { playUiSfx(); } catch (error) { /* 音效失败不阻断佩戴 */ }
      const title = TITLE_CATALOG_MAP[titleId];
      if (typeof devNotify === "function") devNotify(`已佩戴称号「${title?.title || "未名"}」。`, "positive-log");
      renderWanGuLu();
      if (typeof refreshHomeTitlePresentation === "function") refreshHomeTitlePresentation();
    }
    return;
  }
  const claimBtn = event.target.closest("[data-codex-claim]");
  if (claimBtn) {
    const taskId = claimBtn.dataset.codexClaim;
    const result = codexClaimTask(taskId);
    if (result && result.ok) {
      try { playUiSfx(); } catch (err) { /* 忽略音效失败 */ }
      if (typeof addJourneyLog === "function") addJourneyLog(`万蛊录：图鉴成就「${result.taskName || "未名"}」达成，领得蛊钱 ${result.scrip || 0}。`, "positive-log");
      if (typeof enqueueOutgameReceipt === "function") {
        const items = [{ glyph: "录", name: `收录凭记 · ${result.taskName || "未名"}`, amount: 1, detail: "已入万蛊录" }];
        if ((result.scrip | 0) > 0) items.push({ glyph: "契", name: "蛊钱", amount: result.scrip | 0, detail: "已入百蛊市" });
        enqueueOutgameReceipt(
          { source: "万蛊录 · 图鉴任务", title: "收录凭记已领取", tone: "gold", items, summary: "收藏进度与实际蛊钱均已写入存档。" },
          wanGuLuEl?.querySelector(".wangulu-close"),
        );
      }
    } else if (typeof devNotify === "function") {
      devNotify((result && result.message) || "图鉴成就尚不可领取。", "system-log");
    }
    renderWanGuLu();
    if (typeof refreshCollectionHubBadges === "function") refreshCollectionHubBadges();
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
  const detailTabBtn = event.target.closest("[data-gu-detail-tab]");
  if (detailTabBtn) {
    const nextTab = detailTabBtn.dataset.guDetailTab;
    if (["combat", "ecology", "source", "relations"].includes(nextTab)) {
      wanGuLuState.detailTab = nextTab;
      renderWanGuLu();
    }
    return;
  }
  const relatedGu = event.target.closest("[data-gu-card-key]");
  if (relatedGu) {
    const related = (window.GU_CATALOG || []).find((entry) => entry.cardKey === relatedGu.dataset.guCardKey);
    if (related && isGuUnlocked(related, getDiscoveredGuKeys())) {
      wanGuLuState.detailId = related.id;
      wanGuLuState.detailTab = "combat";
      renderWanGuLu();
    }
    return;
  }
  const card = event.target.closest("[data-gu-id]");
  if (card) {
    if (card.classList.contains("is-locked")) return;
    wanGuLuState.detailId = card.dataset.guId; wanGuLuState.detailTab = "combat"; renderWanGuLu();
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
    const claimBadge = c.id === "task" && getCodexClaimableCount() > 0 ? '<i class="wangulu-tab-badge">' + getCodexClaimableCount() + '</i>' : '';
    return '<button type="button" class="' + cls + '" data-gu-tab="' + c.id + '"' + (c.ready ? "" : " disabled") + '>' + escGu(c.label) + claimBadge + soon + '</button>';
  }).join("");
  const content = wanGuLuEl.querySelector(".wangulu-content");
  const isCreatureDetail = Boolean(wanGuLuState.detailId && ["gu", "eco", "enemy", "boss"].includes(wanGuLuState.tab));
  content.classList.toggle("is-creature-detail", isCreatureDetail);
  wanGuLuEl.querySelector(".wangulu-panel")?.classList.toggle("is-creature-detail", isCreatureDetail);
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

/* 本命蛊页：全英雄六形态全览——缺图退印章占位 + 被动 + 道行总账。 */
function renderBenmingCodex() {
  const totalDao = Object.keys(BENMING_GU).reduce((n, id) => n + getBenmingDaoxing(id), 0);
  const cards = Object.entries(BENMING_GU).map(([heroId, gu]) => {
    const hero = HEROES[heroId];
    const info = getBenmingStageInfo(heroId);
    const isCurrentRunHero = typeof runState !== "undefined" && runState?.heroId === heroId;
    const legacyRun = isCurrentRunHero && isLegacyBenmingRun(runState);
    const selectedPathId = isCurrentRunHero
      ? getRunBenmingPath(runState)
      : (progression?.selectedHeroId === heroId ? getBenmingPathDefinition(heroId, progression?.selectedBenmingPath)?.id : null);
    const stages = BENMING_STAGES.map((s) => {
      const reached = info.stage >= s.stage;
      const img = getBenmingImagePath(heroId, s.stage, selectedPathId);
      return `<div class="benming-stage ${reached ? "is-reached" : "is-locked"} ${info.stage === s.stage ? "is-current" : ""}">
        <div class="benming-stage-art">
          <span class="benming-stage-fallback">${reached ? gu.glyph : "？"}</span>
          ${reached ? `<img src="${img}" alt="${gu.name}·${s.name}" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        </div>
        <strong>${s.name}</strong>
        <small>${reached ? getBenmingStagePassiveText(heroId, s.stage, selectedPathId, legacyRun) : `道行 ${s.threshold} 后显形`}</small>
      </div>`;
    }).join("");
    const pathOverview = BENMING_PATHS[heroId] ? `<div class="benming-path-overview ${info.stage < 3 ? "is-locked" : ""}">
      <p><strong>三转双路线</strong><span>${legacyRun ? "当前老续局沿用旧规则" : (info.stage >= 3 ? "每局开局二择一" : "三转后解锁")}</span></p>
      ${Object.values(BENMING_PATHS[heroId]).map((path) => `<section class="benming-path-entry ${selectedPathId === path.id ? "is-active" : ""}">
        <b>${path.glyph}</b><div><strong>${path.name}${selectedPathId === path.id ? " · 当前局" : ""}</strong><span>${path.summary}</span><small>五转：${path.guixu}</small></div>
      </section>`).join("")}
    </div>` : "";
    return `<article class="benming-card">
      <header><b>${gu.glyph}</b><div><strong>${gu.name}</strong><span>${hero?.name || heroId} 的本命蛊 · ${info.stageName} · 道行 ${info.dao}${info.next ? ` / ${info.next.threshold}` : " · 圆满"}</span></div></header>
      <p class="benming-lore">${gu.lore}</p>
      <div class="benming-stages">${stages}</div>
      ${pathOverview}
    </article>`;
  }).join("");
  return '<p class="wangulu-counter">本命蛊 · 跨局养成 · 六修道行合计 ' + totalDao + '（局末自动结算，休整节点可饲蛊）</p>'
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
  const equippedTitleId = getEquippedTitleId();
  const gotTitles = TITLE_CATALOG.filter((t) => (collection[t.id] | 0) > 0).length;
  const titleCards = TITLE_CATALOG.map((t) => {
    const n = collection[t.id] | 0;
    if (n > 0) {
      const equipped = equippedTitleId === t.id;
      return '<article class="seal-title-card is-earned' + (equipped ? ' is-equipped' : '') + '"><strong>' + escGu(t.title) + (n > 1 ? '<i class="seal-title-count">×' + n + '</i>' : '') + '</strong>'
        + '<p>' + escGu(t.sub) + '</p><button type="button" class="seal-title-equip" data-title-equip="' + escGu(t.id) + '"' + (equipped ? ' disabled aria-pressed="true"' : ' aria-pressed="false"') + '>' + (equipped ? '已佩戴' : '佩戴') + '</button></article>';
    }
    return '<article class="seal-title-card is-locked"><strong>？？？</strong><p>' + escGu(t.hint) + '</p></article>';
  }).join("");
  return '<p class="wangulu-counter">通关印记 ' + sealEarned + ' / ' + sealTotal + ' · 称号收藏 ' + gotTitles + ' / ' + TITLE_CATALOG.length + '（自 V0.9.14 起收录）</p>'
    + '<section class="wangulu-sec"><h4>通关印记 · 英雄×模式</h4><div class="seal-matrix">' + heroRows + '</div></section>'
    + '<section class="wangulu-sec"><h4>称号收藏 · 结算与里程碑所得</h4><div class="seal-title-grid">' + titleCards + '</div></section>';
}

function renderGuList(catId) {
  catId = catId || "gu";
  const isEco = catId === "eco";
  const isHero = catId === "hero"; // V0.9.9 子批4：蛊修列传恒显（无 cardKey、不走解锁）
  const isRelic = catId === "relic"; // V0.9.9.2 遗物谱：获得即解锁
  const isItem = catId === "item"; // V0.9.16 丹囊：恒显
  const isBestiary = catId === "enemy" || catId === "boss";
  const isTextCodex = catId === "anecdote" || catId === "faction";
  const items = isRelic ? getRelicCatalogItems() : (isItem ? getItemCatalogItems() : (catId === "anecdote" ? CODEX_ANECDOTES : (catId === "faction" ? CODEX_FACTIONS : (window.GU_CATALOG || []).filter((it) => it.category === catId))));
  const discovered = getDiscoveredGuKeys();
  const discoveredRelics = isRelic ? getDiscoveredRelicIds() : null;
  const bestiary = isBestiary ? layer2LoadBestiary() : null;
  const isOpen = (it) => isRelic ? isRelicUnlocked(it, discoveredRelics) : ((isEco || isHero || isItem || isTextCodex) ? true : (isBestiary ? (it.enemyId ? bestiary.has(it.enemyId) : true) : isGuUnlocked(it, discovered)));
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
    head = '<p class="wangulu-counter">命途生态 · 共 ' + items.length + ' 处（路线、栖地与异境记录）</p>';
  } else if (isTextCodex) {
    head = '<p class="wangulu-counter">' + (catId === "anecdote" ? "命途异闻" : "流派源流") + ' · 共 ' + items.length + ' 卷</p>';
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
      + '<p class="wangulu-counter">已悟 ' + unlockedCount + ' / ' + items.length + ' 蛊 · 种类分通用、流派、合练；孵化路线与品质请在蛊庐查看</p>';
  }
  let grid = '<div class="wangulu-grid">';
  if (!shown.length) { grid += '<div class="wangulu-empty">无符此筛之蛊。</div>'; }
  shown.forEach((it) => {
    if (isOpen(it)) {
      const pendingFace = (isEco || isBestiary || isHero || isRelic || isItem || isTextCodex) ? false : true;
      const face = it.image
        ? '<span class="wangulu-item-glyph wangulu-item-thumb"><img src="' + escGu(it.image) + '" alt="' + escGu(it.name) + '" loading="lazy"></span>'
        : '<span class="wangulu-item-glyph' + (pendingFace ? ' wangulu-glyph-pending' : '') + (isBestiary ? ' wangulu-glyph-foe' : '') + '">' + escGu(guGlyphFor(it)) + (pendingFace ? '<i class="wangulu-pending-corner">待补</i>' : '') + '</span>';
      const kindLabel = it.category === "gu" ? getGuKindLabel(it) : it.rarity;
      const combatTone = it.category === "gu" ? getGuCombatTone(it) : "";
      const tag = isEco
        ? '<span class="wangulu-item-rarity wangulu-eco-badge">生态</span>'
        : '<span class="wangulu-item-rarity' + (combatTone ? ' wangulu-kind-' + combatTone : ' wangulu-r-' + escGu(it.rarity)) + '">' + escGu(kindLabel) + '</span>';
      grid += '<button type="button" class="wangulu-item' + (isEco ? " is-eco" : "") + (combatTone ? ' wangulu-tone-' + combatTone : '') + '" data-gu-id="' + it.id + '">'
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
  if (!it) it = CODEX_ANECDOTES.find((x) => x.id === id) || CODEX_FACTIONS.find((x) => x.id === id);
  if (!it && typeof id === "string" && id.indexOf("relic_") === 0) it = getRelicCatalogItems().find((x) => x.id === id);
  if (!it && typeof id === "string" && id.indexOf("item_") === 0) it = getItemCatalogItems().find((x) => x.id === id); // V0.9.16 丹囊
  if (!it) return '<div class="wangulu-empty">残页佚失。</div>';
  if (it.category === "anecdote" || it.category === "faction") return renderCodexTextDetail(it);
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
  const effectHtml = it.gameplayEffect
    ? '<p class="wangulu-effect">' + escGu(it.gameplayEffect) + '</p><p class="wangulu-short">' + escGu(it.descriptionShort) + '</p>'
    : '<p class="wangulu-effect wangulu-unimpl">暂未实装为战斗蛊牌（生态图鉴）</p><p class="wangulu-short">' + escGu(it.descriptionShort) + '</p>';
  const ecoTag = it.category === "eco" ? '<span class="wangulu-eco-badge">未实装</span>' : '';
  const sourceRows = row("出处", it.dropsFrom) + row("录入", it.unlockCondition);
  const ecologyRows = row("栖息", it.habitat) + row("食性", it.feeding) + row("秉性", it.temperament);
  const relationText = (label, value) => {
    if (!value) return "";
    const links = (window.GU_CATALOG || []).filter((entry) => entry.cardKey && entry.id !== it.id && value.includes(`「${entry.name}」`));
    let body = escGu(value);
    links.forEach((entry) => {
      const escapedName = escGu(`「${entry.name}」`);
      const unlocked = isGuUnlocked(entry, discovered);
      const replacement = unlocked
        ? `<button type="button" class="wangulu-related-link" data-gu-card-key="${escGu(entry.cardKey)}">${escapedName}</button>`
        : `<span class="wangulu-related-rumor">${escapedName} · 生态传闻</span>`;
      body = body.split(escapedName).join(replacement);
    });
    if (!links.length && /「[^」]+」/.test(value)) body += '<small class="wangulu-relation-note">生态传闻 · 尚未显形</small>';
    return `<div class="wangulu-row"><span class="wangulu-row-k">${escGu(label)}</span><span class="wangulu-row-v">${body}</span></div>`;
  };
  const comboRows = relationText("演化", it.evolution) + relationText("相济", it.synergy) + relationText("相克", it.counteredBy);
  const combatTone = it.category === "gu" ? getGuCombatTone(it) : "support";
  const tabs = [
    ["combat", "战斗"], ["ecology", "生态"], ["source", "获取"], ["relations", "相济相克"],
  ].map(([tabId, label]) => `<button type="button" data-gu-detail-tab="${tabId}" class="${wanGuLuState.detailTab === tabId ? "is-active" : ""}" aria-pressed="${wanGuLuState.detailTab === tabId}">${label}</button>`).join("");
  const panes = {
    combat: '<section class="wangulu-detail-pane wangulu-primary-sec"><h4>真实战斗效果</h4>' + effectHtml + '<div class="wangulu-meta-strip">' + row("种类", getGuKindLabel(it)) + row("道脉", it.faction) + row("战斗定位", it.type) + row("形态", it.stage) + '</div></section>',
    ecology: '<section class="wangulu-detail-pane"><h4>生态习性</h4>' + (ecologyRows || '<p class="wangulu-short">生态记录尚待补全。</p>') + '<h4 class="wangulu-subhead">来历异闻</h4><p class="wangulu-lore">' + escGu(it.descriptionLore) + '</p></section>',
    source: '<section class="wangulu-detail-pane"><h4>获取方式</h4>' + (sourceRows || '<p class="wangulu-short">遭遇或获得后自动录入。</p>') + renderGuTaskLink(it) + '</section>',
    relations: '<section class="wangulu-detail-pane"><h4>组合克制</h4>' + (comboRows || '<p class="wangulu-short">尚未发现明确的生态联动。</p>') + '</section>',
  };
  return '<button type="button" class="wangulu-back" data-gu-back>‹ 返回蛊录</button>'
    + '<article class="wangulu-detail wangulu-detail-shell">'
    + '<aside class="wangulu-detail-art"><div class="wangulu-art">' + artHtml + '<i class="wangulu-art-stage">' + escGu(it.stage || "") + '</i></div></aside>'
    + '<div class="wangulu-detail-info"><header class="wangulu-detail-head"><h3>' + escGu(it.name) + '</h3>'
    + '<p class="wangulu-detail-alias">' + escGu(it.alias || "") + '</p>'
    + '<div class="wangulu-tags"><span class="wangulu-kind-' + combatTone + '">' + escGu(it.category === "gu" ? getGuKindLabel(it) : it.rarity) + '</span>'
    + '<span>' + escGu(it.faction) + '</span><span>' + escGu(it.type) + '</span>' + ecoTag + '</div></header>'
    + '<nav class="wangulu-detail-tabs" aria-label="蛊虫详情">' + tabs + '</nav>'
    + (panes[wanGuLuState.detailTab] || panes.combat) + '</div>'
    + '</article>';
}

function renderCodexTextDetail(it) {
  const title = it.category === "anecdote" ? "异闻正文" : "流派要诀";
  return '<button type="button" class="wangulu-back" data-gu-back>‹ 返回万蛊录</button>'
    + '<article class="wangulu-detail wangulu-text-detail">'
    + '<header class="wangulu-detail-head"><h3>' + escGu(it.name) + '</h3><p class="wangulu-detail-alias">' + escGu(it.alias) + '</p>'
    + '<div class="wangulu-tags"><span>' + escGu(it.rarity) + '</span><span>' + escGu(it.faction) + '</span><span>' + escGu(it.stage) + '</span></div></header>'
    + '<section class="wangulu-sec wangulu-primary-sec"><h4>' + title + '</h4><p class="wangulu-lore">' + escGu(it.descriptionLore) + '</p></section>'
    + '<section class="wangulu-sec"><h4>卷下注</h4><p class="wangulu-short">' + escGu(it.note) + '</p></section>'
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

/* 图鉴任务数据。count() 只读真实进度；达标可领取奖励=蛊钱（V0.9.51）。任务可带 scrip 覆盖单项奖励额，否则用默认。 */
const CODEX_TASK_DEFAULT_SCRIP = 6; // 每个图鉴收集成就默认发 6 蛊钱
const CODEX_TASKS = [
  {
    id: "codex_baigu", name: "百蛊初识", target: 8,
    condition: "发现 8 种战斗蛊。",
    rewardPreview: "命途契·识蛊契：蛊牌总收录满 30 种时，结算由司命人递契。", // V0.9.40 QS-1a：奖励预告兑现为实际契名

    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_dudao", name: "毒道入门", target: 5,
    condition: "发现 5 种毒道蛊（含虫群相关）。",
    rewardPreview: "命途契·深毒契：毒道收录满 6 种时，结算由司命人递契。", // V0.9.40 QS-1a：奖励预告兑现为实际契名
    status: "seed", note: "预埋·后续版本开放",
    count: () => {
      const d = getDiscoveredGuKeys();
      return (window.GU_CATALOG || []).filter((it) => it.category === "gu" && (it.faction === "毒道" || it.faction === "虫群") && isGuUnlocked(it, d)).length;
    },
  },
  {
    id: "codex_xuedao", name: "血道残谱", target: 5,
    condition: "发现 5 种血道蛊。",
    rewardPreview: "命途契·浊血契：血道收录满 6 种时，结算由司命人递契。", // V0.9.40 QS-1a：奖励预告兑现为实际契名
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

/* V0.9.40 QS-1a 命途契小节：列全部契与解锁状态（任务页顶部）。契数据在 nmg-contracts.js（运行期已加载）。 */
function renderContractCodexSection() {
  if (typeof CONTRACTS === "undefined") return "";
  const contractStore = loadContractStore(); // 整页重绘帧上只读存储一次，map 内复用
  const unlockedCount = CONTRACT_IDS.filter((id) => Boolean(contractStore.unlocked[id])).length;
  const rows = CONTRACT_IDS.map((id) => {
    const def = CONTRACTS[id];
    const unlocked = Boolean(contractStore.unlocked[id]);
    const state = unlocked
      ? (def.implemented ? "已解锁 · 整备可签" : "已解锁 · 契文将至")
      : (def.implemented ? "未解锁" : "未解锁 · 契文将至");
    return '<div class="codex-contract-row' + (unlocked ? " is-unlocked" : "") + '">'
      + '<span class="codex-contract-glyph">' + escGu(def.glyph) + '</span>'
      + '<div class="codex-contract-copy"><strong>' + escGu(def.name) + '</strong><small>' + escGu(def.kind) + ' · ' + escGu(state) + '</small>'
      + '<p>' + (unlocked ? escGu(def.summary) + ' 代价：' + escGu(def.cost) : '解锁：' + escGu(def.unlockHint)) + '</p></div>'
      + '</div>';
  }).join("");
  return '<details class="outgame-disclosure codex-contract-section">'
    + '<summary>命途契 · 已解锁 ' + escGu(unlockedCount) + ' / ' + escGu(CONTRACT_IDS.length) + '</summary>'
    + '<p class="codex-contract-sub">达成条件后解锁；下一局整备可择一签契改写规则，代价明码。</p>'
    + rows
    + '</details>';
}

/* 图鉴任务列表：条件 + 奖励预告 + 真实进度 + 醒目「预埋」徽章。进度满也不发奖。
 * ※ 注意：本函数存在同名后定义（收录凭记领取版）覆盖——此处为死代码，改行为请去后一处。 */
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
  return '<p class="wangulu-counter">图鉴任务 · 共 ' + CODEX_TASKS.length + ' 则（进度真实累计；命途契自 V0.9.40 起陆续兑现）</p>'
    + renderContractCodexSection()
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
   授予收录凭记与蛊钱，不改卡牌、敌人、战斗数值或初始牌组。旧版预埋渲染在此处被覆盖。 */
function codexTaskStore() {
  const data = codexLoad(CODEX_TASKS_KEY);
  if (!data.claimed || typeof data.claimed !== "object" || Array.isArray(data.claimed)) data.claimed = {};
  if (!data.claimedAt || typeof data.claimedAt !== "object" || Array.isArray(data.claimedAt)) data.claimedAt = {};
  return data;
}
function codexTaskRewardName(task) {
  return "蛊钱 ×" + Math.max(0, Number(task && task.scrip) || CODEX_TASK_DEFAULT_SCRIP);
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
  if (state.claimed) return { ok: false, message: "这则收录凭记已经领取。" };
  if (!state.claimable) return { ok: false, message: "图鉴任务尚未达成。" };
  const data = codexTaskStore();
  data.claimed[task.id] = true;
  data.claimedAt[task.id] = new Date().toISOString();
  codexSave(CODEX_TASKS_KEY, data);
  // V0.9.51 用户定调：图鉴收集成就给实际奖励=蛊钱（发进蛊庐百蛊市；蛊钱只在塔外流通）。
  const scrip = Math.max(0, Number(task.scrip) || CODEX_TASK_DEFAULT_SCRIP);
  let scripGranted = 0;
  if (scrip > 0 && typeof getGuluStore === "function") {
    try {
      const store = getGuluStore();
      if (store) {
        if (!store.market || typeof store.market !== "object") store.market = {};
        store.market.scrip = Math.max(0, store.market.scrip | 0) + scrip;
        scripGranted = scrip;
        if (typeof saveGuluStore === "function") saveGuluStore();
      }
    } catch (err) { /* 蛊庐存储不可用则只记领取、不发蛊钱 */ }
  }
  return { ok: true, taskName: task.name, rewardName: state.rewardName, scrip: scripGranted };
}
function codexClaimedCount() {
  const claimed = codexGetClaimedMap();
  return CODEX_TASKS.filter((task) => claimed[task.id]).length;
}

const CODEX_ECO_PROGRESS_FIELDS = Object.freeze({
  eco_miasmaforest: ["layer2", "miasmaEntered"],
  eco_bloodmarsh_zone: ["layer2", "bloodmarshEntered"],
  eco_boneTower: ["layer3", "boneEntered"],
  eco_beehive: ["layer3", "beehiveEntered"],
});
function isCodexEcoDiscovered(item, layer2Progress, layer3Progress) {
  const source = CODEX_ECO_PROGRESS_FIELDS[item?.id];
  if (!source) return false;
  const progress = source[0] === "layer3" ? layer3Progress : layer2Progress;
  return (progress?.[source[1]] | 0) > 0;
}
function getCodexOverviewCounts() {
  const cat = window.GU_CATALOG || [];
  const discovered = getDiscoveredGuKeys();
  let layer2Progress = {};
  let layer3Progress = {};
  try { layer2Progress = typeof layer2LoadProgress === "function" ? layer2LoadProgress() : {}; } catch (err) { layer2Progress = {}; }
  try { layer3Progress = typeof layer3LoadProgress === "function" ? layer3LoadProgress() : {}; } catch (err) { layer3Progress = {}; }
  const battleEntries = cat.filter((item) => item.category === "gu");
  const ecoEntries = cat.filter((item) => item.category === "eco");
  return {
    battleSeen: battleEntries.filter((item) => isGuUnlocked(item, discovered)).length,
    battleTotal: battleEntries.length,
    ecoSeen: ecoEntries.filter((item) => isCodexEcoDiscovered(item, layer2Progress, layer3Progress)).length,
    ecoTotal: ecoEntries.length,
  };
}

/* 总览：同步显示真实发现量与图鉴任务领取进度。 */
function renderCodexOverview() {
  const counts = getCodexOverviewCounts();
  let loreSeen = 0;
  try { loreSeen = (typeof LORE_PAGES !== "undefined" ? LORE_PAGES : []).filter((p) => isLoreUnlocked(p.id)).length; } catch (err) { loreSeen = 0; }
  const claimedTasks = codexClaimedCount();
  const cell = (k, v) => '<div class="codex-progress-cell"><span class="codex-progress-num">' + escGu(v) + '</span><span class="codex-progress-k">' + escGu(k) + '</span></div>';
  return '<p class="wangulu-counter">蛊道进境 · 残卷所窥，不过初篇</p>'
    + '<div class="codex-progress">'
    + cell("已收录蛊虫", counts.battleSeen + ' / ' + counts.battleTotal)
    + cell("已见命途生态", counts.ecoSeen + ' / ' + counts.ecoTotal)
    + cell("已读残卷", loreSeen + ' / ' + (typeof LORE_PAGES !== "undefined" ? LORE_PAGES.length : 0))
    + cell("图鉴任务 · 已领", claimedTasks + ' / ' + CODEX_TASKS.length)
    + '</div>'
    + '<p class="codex-overview-verse">达成图鉴任务可领蛊钱；蛊钱只在塔外百蛊市使用。</p>';
}

/* 图鉴任务列表：真实进度 + 可领取收藏印记。 */
/* V0.9.40 QS-1a：与命途契绑定的图鉴任务——奖励行追加契指向（兑现 V0.9.5.2 奖励预告；领取发契的并轨在 QS-1b）。 */
const CODEX_TASK_CONTRACT_HINTS = Object.freeze({ codex_dudao: "deepPoison", codex_xuedao: "turbidBlood", codex_baigu: "guSeeker" });
/* ※ 生效版（同名前定义被本函数覆盖）：收录凭记领取版。 */
function renderCodexTasks() {
  const cards = CODEX_TASKS.map((task) => {
    const state = codexTaskState(task);
    const p = state.progress;
    const pct = p.target ? Math.round((p.cur / p.target) * 100) : 0;
    const cardCls = "codex-task-card" + (p.done ? " is-done" : "") + (state.claimable ? " is-claimable" : "") + (state.claimed ? " is-claimed" : "");
    const action = state.claimed
      ? '<button type="button" class="codex-task-claim" disabled>已领取</button>'
      : (state.claimable
        ? '<button type="button" class="codex-task-claim is-ready" data-codex-claim="' + escGu(task.id) + '">领取收录凭记与蛊钱 ' + escGu(task.scrip || CODEX_TASK_DEFAULT_SCRIP) + '</button>'
        : '<button type="button" class="codex-task-claim" disabled>尚未达成</button>');
    const progText = state.claimed ? "已领取收录凭记与蛊钱" : (state.claimable ? "可领取收录凭记与蛊钱" : "继续探索命途");
    const contractDetail = (function () {
      const cid = CODEX_TASK_CONTRACT_HINTS[task.id];
      const def = cid && typeof CONTRACTS !== "undefined" ? CONTRACTS[cid] : null;
      return def ? '<p class="codex-task-reward codex-task-contract"><span class="codex-task-k">关联命途契</span>' + escGu(def.name) + '：' + escGu(def.unlockHint) + '</p>' : "";
    })();
    return '<div class="' + cardCls + '">'
      + '<div class="codex-task-head"><h4>' + escGu(task.name) + '</h4><span class="codex-task-stamp">' + escGu(state.label) + '</span></div>'
      + '<p class="codex-task-cond"><span class="codex-task-k">达成条件</span>' + escGu(task.condition) + '</p>'
      + '<div class="codex-task-bar"><span class="codex-task-bar-fill" style="width:' + pct + '%"></span></div>'
      + '<p class="codex-task-prog">当前进度 ' + escGu(p.cur) + ' / ' + escGu(p.target) + '（' + escGu(progText) + '）</p>'
      + '<div class="codex-task-actions">' + action + '</div>'
      + '<details class="outgame-disclosure codex-task-details"><summary>奖励与关联说明</summary><p class="codex-task-reward"><span class="codex-task-k">任务奖励</span>' + escGu(state.rewardName) + ' · 永久收进万蛊录，不影响战斗数值。</p>' + contractDetail + '</details>'
      + '</div>';
  }).join("");
  return '<p class="wangulu-counter">图鉴任务 · 已领 ' + codexClaimedCount() + ' / ' + CODEX_TASKS.length + ' 则</p>'
    + renderContractCodexSection() // V0.9.40 QS-1a：命途契小节（列全部契与解锁状态）
    + '<p class="codex-task-note">先看进度与可领状态；按钮会如实发放收录凭记与蛊钱。</p>'
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
