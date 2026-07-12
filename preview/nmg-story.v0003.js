"use strict";

/*
 * V0.9.36 批次B-6c：叙事系统模块。
 * 须在 game.v 之前加载；顶层代码不得引用 game.js 后续才定义的绑定。
 */

/* ===== 序章存储键（原 game.js:34-34） ===== */
const PROLOGUE_STORAGE_KEY = "reverseGu.prologue.seen"; // V0.9.18 塔中回声：序章仅首次自动弹一次

/* ===== 残卷存储键（原 game.js:36-37） ===== */
const LORE_STORAGE_KEY = "reverseGu.lore.unlocked";
const LORE_SKIP_ANIMATION_STORAGE_KEY = "reverseGu.lore.skipAnimation";

/* ===== 序章弹窗状态（原 game.js:149-151） ===== */
let prologuePageIndex = 0; // V0.9.18 塔中回声：序章当前页
let prologueAutoPrompted = false; // 本次会话是否已尝试自动弹序章
let prologueWasAuto = false; // 本次开启是否为首次自动弹（关闭后需接新手教程）

/* ===== 命蛊残卷数据与状态（原 game.js:321-436） ===== */
const LORE_PAGES = Object.freeze([
  {
    id: "cost",
    title: "卷一：蛊生于代价",
    source: "古页显现：初入命途",
    hint: "初入命途时显现。",
    teaser: "第一声蛊鸣，生在将熄的寿灯里。",
    body: "传说最初之人跪在黑石前，割血三滴，断发一缕，又吹灭半盏寿灯。石缝里没有神声，只有细小虫鸣。那虫食血，衔发，伏在将熄的灯烟中成形。自此世人知晓，蛊不从天落，也不替人慈悲。凡欲改命，须先拿命中之物相喂。",
    quote: "蛊不是恩赐，蛊是代价开出的路。",
  },
  {
    id: "bloodStone",
    title: "卷二：血落黑石",
    source: "古页显现：第一次斩伏凶影",
    hint: "斩伏一次凶影后显现。",
    teaser: "黑石不言，却记得第一滴血的重量。",
    body: "黑石原本无名，只因第一滴血落下，才有了“命”的重量。最初之人不肯受天命束手，便把掌心按入石面。血不是祭品，乃是与命相争时最先交出的筹码。黑石不言，只将血收进深处，令后来者都看见一条暗红的缝。",
    quote: "血落黑石，人便开始与命交易。",
  },
  {
    id: "fiveMaterials",
    title: "卷三：五材入炉",
    source: "古页显现：第一次得五材",
    hint: "获得任意炼蛊材料后显现。",
    teaser: "五材不是物，是五种被折下的代价。",
    body: "五材并非炉边杂物。血砂取勇，使人敢以身入刃；虫蜕取躯，使旧壳让出新身；腐液取痛，使朽败也能啃穿坚物；命丝取机，使一念牵动万端；残魂取余念，使死者未尽之愿仍在火中低语。",
    quote: "五材入炉，五种代价同声。",
  },
  {
    id: "stableFire",
    title: "卷四：炉火稳定",
    source: "古页显现：第一次稳火成蛊",
    hint: "完成一次稳定炼化后显现。",
    teaser: "稳火最静，却也最会慢慢啃人。",
    body: "炉火稳定之时，最容易令人忘记火仍在吃人。蛊纹缓缓合拢，像伤口结痂，又像誓言落锁。炼者以为自己只是添了一分锋芒，却不知心血已被炉火细细称量。稳，并非无价，只是代价来得慢，来得轻，来得像习惯。",
    quote: "稳火不免代价，只让代价迟些开口。",
  },
  {
    id: "untamed",
    title: "卷五：蛊性不驯",
    source: "古页显现：第一次蛊性异变",
    hint: "经历一次炼蛊异变后显现。",
    teaser: "蛊会贴着欲望，长成别的形状。",
    body: "蛊不是死物，也不是听命的器具。它贴着人的欲望生长，见贪则生齿，见惧则生壳，见恨则染血，见求生便学会绕过旧形。所谓异变，并非炉火出错，而是藏在心底的念头得了虫身，在暗金火中第一次睁眼。",
    quote: "异变不是错误，是欲望现形。",
  },
  {
    id: "backlash",
    title: "卷六：反噬其主",
    source: "古页显现：第一次炉火逆冲",
    hint: "经历一次炼蛊反噬后显现。",
    teaser: "拖欠太久的代价，会沿命丝回头。",
    body: "人以为掌蛊，蛊亦在掌人。欠下的血会从伤口回来，拖延的寿会从灯芯折断，不肯认的残念会在炉底咬住手骨。反噬不是天罚，也非蛊虫无情。它只是代价被拖欠太久，终于沿着命丝找回主人。",
    quote: "反噬不是惩罚，是欠债归身。",
  },
  {
    id: "direGuard",
    title: "卷七：凶煞守路",
    source: "古页显现：第一次踏碎凶煞",
    hint: "击败一次凶煞守路者后显现。",
    teaser: "守路者多半不是妖，是未归的求命者。",
    body: "塔影深处的凶煞，未必皆生而为妖。古卷说，许多守路者曾披人皮，曾抱一盏寿灯，曾携蛊入塔求命。后来门未开，心先碎，蛊食其愿，塔收其名，只余执念盘踞阶前，替命途守住下一次失败。",
    quote: "守路凶煞，或是未归的求命者。",
  },
  {
    id: "unfinished",
    title: "卷八：命途未尽",
    source: "古页显现：第一次推开塔门",
    hint: "第一次推开命途塔尽头之门后显现。",
    teaser: "门开之后，仍会听见下一道锁响。",
    body: "有人以为门开即为尽头，古卷却说，门后仍有门。命途塔从不赐终局，只把人送到更深的黑处，使其听见另一道锁响。所谓逆命，不过是从旧命中脱身，又在新命前站定。能看见远处微灯者，仍须再问代价。",
    quote: "命途未尽，门后仍有门。",
  },
  /* ===== V0.9.15 路线残卷：四大生态各得其卷（踏入路线或拾取路线残卷节点时显现） ===== */
  {
    id: "loreMiasma",
    title: "卷九：瘴林深径",
    source: "路线残卷：瘴林深径",
    hint: "踏入第二层瘴林深径后显现。",
    teaser: "瘴不散，因为灯还亮着。",
    body: "古卷载，瘴林原是一片药谷。谷中人以百草饲蛊、以蛊入药，救人无数。后来塔起谷陷，药引尽化毒瘴。执灯者仍提灯巡谷，一如当年采药——只是灯里燃的不再是油，而是迷途者的魂。魂尽瘴应散，可执灯者不肯熄灯，瘴便千年不散。",
    quote: "瘴不散，是有人不肯熄灯。",
  },
  {
    id: "loreBloodmarsh",
    title: "卷十：血沼沉渊",
    source: "路线残卷：血沼沉渊",
    hint: "踏入第二层血沼沉渊后显现。",
    teaser: "沼底沉的不是水，是没讨回来的血。",
    body: "血沼旧名祭渊。古时求命者在此歃血立誓，以血为契向塔换命——换成者去，换不成者沉。千年血契层层淤积，凝成这片不冻不涸的沉渊。血衣蛊母披的那件衣，由历代毁约者的契书织成；它不猎生人，只收旧账。",
    quote: "血沼不吞人，只收当年欠下的血。",
  },
  {
    id: "loreBone",
    title: "卷十一：骨塔高陵",
    source: "路线残卷：骨塔高陵",
    hint: "踏入第三层骨塔高陵后显现。",
    teaser: "白骨叠塔，是败者最后的体面。",
    body: "塔下问命，塔上埋骨。凡在命途中折断的求命者，尸骨不腐、执念不散，被塔收作砖石，垒成这座高陵。守墓王原是第一位登塔者——他没能推开门，便回身守住来路，让后来的败者至少有处安眠。骨铃每响一声，便是新骨入陵。",
    quote: "高陵不是坟，是败者互相守望的家。",
  },
  {
    id: "loreBeehive",
    title: "卷十二：蜂窟魔巢",
    source: "路线残卷：蜂窟魔巢",
    hint: "踏入第三层蜂窟魔巢后显现。",
    teaser: "万蜂同振，振的是一个字：还。",
    body: "蜂窟原是塔的酿蜜处，百蜂采命途繁花，酿出续命的金浆。后来有人贪浆毁巢，取尽而不偿。蜂后不忘：自那日起，蜂群不再酿蜜，只酿毒；不再采花，只采债。万翅齐振之声，古卷释为一个字——还。",
    quote: "蜂群所讨的，不过是当年那一巢之债。",
  },
  /* ===== E-2c5b 终卷三连：塔心终局残卷（解锁点分散在终局三节拍：司命终问/盘心断裂/通关结算） ===== */
  {
    id: "mupanTruth",
    title: "终卷·上：万命为盘",
    source: "终局残卷：盘心断裂之际",
    hint: "击破万命母盘、盘心断裂时显现。",
    teaser: "所谓天命，不过是万人旧账压成的一张盘。",
    body: "世人仰望命途塔，以为塔上坐着写命的神。塔里没有神，只有一张盘。万人登塔求命，各自交出血、寿、蛊材与执念；盘把这些代价一笔笔收下、称量、归档，压成签，再发还给后来的求命者——名曰「既定之命」。于是先人的失败成了后人的命数，后人的代价又成了更后来者的判词。盘转了千年，无人问过一句：这命，起初是谁的？",
    quote: "天命无天，只有旧债。",
  },
  {
    id: "simingDuty",
    title: "终卷·中：守账之人",
    source: "终局残卷：司命终问之后",
    hint: "答过司命终问后显现。",
    teaser: "他不是命运的主人，只是最后一名守账者。",
    body: "司命人不司命。他原也是求命者，登塔那年，盘正无度吞取塔外之人的代价。他以自己的姓名立契，换来一条边界：塔只可收求命者亲手交付之物。名字付出去，就再没有回来。从此人间少了一个名姓，塔中多了一个职分——替盘记账，也替仍是人的求命者，守住最后一条规矩。千百年来，他见过每一个死在塔里的人。不是因为他冷漠，而是账上每一笔，他都记得。",
    quote: "他把名字借给了规矩，规矩才没有吃人。",
  },
  {
    id: "afterTower",
    title: "终卷·下：断盘之后",
    source: "终局残卷：章节通关",
    hint: "完成角色结局、章节通关后显现。",
    teaser: "盘碎了，代价还在——只是再没处推脱。",
    body: "盘心碎裂那夜，塔没有倒。代价也没有消失：血仍要偿，寿仍会尽，蛊仍择人而噬——世间的规矩一条都没有少，少掉的只有一样。从今往后，再没有一张盘替人写好判词，也再没有一座塔可以让人把自己的选择推给「命」。塔外，蛊源大陆的雾正在退。有人说黑石不止一块，有人说蛊的源头还在更远处鸣响。没有天命的世道，才刚刚开始。",
    quote: "塔碎处，路始生。",
  },
]);

const DEFAULT_LORE_ID = "cost";
let loreUnlockedIds = new Set();
let selectedLoreId = "";
let loreSkipAnimation = false;

/* ===== 残卷解锁与设置辅助（原 game.js:862-928） ===== */
function readLoreUnlocks() {
  try {
    const raw = localStorage.getItem(LORE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => LORE_PAGES.some((page) => page.id === id)) : []);
  } catch (error) {
    console.warn("[残卷读取失败]", error);
    return new Set();
  }
}

function saveLoreUnlocks() {
  try {
    localStorage.setItem(LORE_STORAGE_KEY, JSON.stringify([...loreUnlockedIds]));
  } catch (error) {
    console.warn("[残卷保存失败]", error);
  }
}

function initLoreSystem() {
  loreUnlockedIds = readLoreUnlocks();
  loreSkipAnimation = getStoredFlag(LORE_SKIP_ANIMATION_STORAGE_KEY);
  unlockLorePage(DEFAULT_LORE_ID, { silent: true });
  updateLoreSettingControls();
}

function isLoreUnlocked(id) {
  return loreUnlockedIds.has(id);
}

function unlockLorePage(id, { silent = false } = {}) {
  const page = LORE_PAGES.find((item) => item.id === id);
  if (!page || loreUnlockedIds.has(id)) return false;
  loreUnlockedIds.add(id);
  saveLoreUnlocks();
  if (!silent) {
    addLog(`命蛊残卷新页已显：《${page.title}》`, "important");
    if (dom.loreOverlay && !dom.loreOverlay.classList.contains("hidden")) renderLoreOverlay();
  }
  return true;
}

function resetLoreUnlocks() {
  loreUnlockedIds = new Set();
  selectedLoreId = "";
  unlockLorePage(DEFAULT_LORE_ID, { silent: true });
  renderLoreOverlay();
  if (dom.runProgress) {
    dom.runProgress.textContent = "命蛊残卷解锁已重置。";
    dom.runProgress.classList.remove("hidden");
  }
}

function updateLoreSettingControls() {
  if (!dom.loreAnimationToggle) return;
  dom.loreAnimationToggle.textContent = `跳过残卷动画：${loreSkipAnimation ? "开" : "关"}`;
  dom.loreAnimationToggle.setAttribute("aria-pressed", String(loreSkipAnimation));
  if (dom.settingsLoreAnimationToggle) dom.settingsLoreAnimationToggle.textContent = `跳过残卷动画：${loreSkipAnimation ? "开" : "关"}`;
}

function toggleLoreAnimationSkip() {
  loreSkipAnimation = !loreSkipAnimation;
  setStoredFlag(LORE_SKIP_ANIMATION_STORAGE_KEY, loreSkipAnimation);
  updateLoreSettingControls();
  renderSettingsOverlay();
  renderLoreOverlay();
}

/* ===== 司命人跨局死亡计数辅助（原 game.js:3867-3870） ===== */
/* ===== V0.9.18 司命人 NPC：每层机缘节点可能遇一次（首遇必出、之后 35%、同层不重复），台词随英雄/重逢/跨局死亡次数变化 ===== */
const SIMING_DEATHS_KEY = "nmg.siming.deaths";
function getSimingDeaths() { try { return Number(localStorage.getItem(SIMING_DEATHS_KEY)) || 0; } catch (e) { return 0; } }
function bumpSimingDeaths() { try { localStorage.setItem(SIMING_DEATHS_KEY, String(getSimingDeaths() + 1)); } catch (e) { /* 存储不可用则忽略 */ } }

/* ===== 序章弹窗辅助（原 game.js:4977-5040） ===== */
function maybeAutoOpenPrologue() {
  if (!dom.prologueOverlay || prologueAutoPrompted || getStoredFlag(PROLOGUE_STORAGE_KEY)) return false;
  prologueAutoPrompted = true;
  window.setTimeout(() => {
    if (!dom.startScreen.classList.contains("hidden") && dom.prologueOverlay.classList.contains("hidden")) {
      openPrologue({ auto: true });
    }
  }, 180);
  return true;
}

function updatePrologueMotionMode() {
  if (!dom?.prologueOverlay) return;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const coarsePointer = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches === true;
  const narrowViewport = window.matchMedia?.("(max-width: 860px), (max-height: 650px)")?.matches === true;
  const effectsOff = typeof effectsEnabled !== "undefined" && !effectsEnabled;
  dom.prologueOverlay.classList.toggle("prologue-safe-motion", effectsOff || reducedMotion || coarsePointer || narrowViewport);
}

function openPrologue({ page = 0, auto = false } = {}) {
  if (!dom.prologueOverlay) return;
  prologueWasAuto = auto;
  prologuePageIndex = Math.max(0, Math.min(PROLOGUE_PAGES.length - 1, page));
  updatePrologueMotionMode();
  renderProloguePage();
  dom.prologueOverlay.classList.remove("hidden");
  refreshModalLock();
  dom.prologueNextButton?.focus();
}

function closePrologue() {
  dom.prologueOverlay?.classList.add("hidden");
  setStoredFlag(PROLOGUE_STORAGE_KEY, true); // 看过/跳过均标记，之后不再自动弹
  unlockLorePage("cost", { silent: true }); // V0.9.19：序章即卷一「蛊生于代价」的显现，看完出处闭环入图鉴
  refreshModalLock();
  if (prologueWasAuto) {
    prologueWasAuto = false;
    // 序章看完后：全新玩家（没看过教程）接新手引导；老玩家（升级到本版）此时才补看本版更新公告，
    // 因为 maybeAutoShowUpdateLog 在 init 时被序章门槛拦下过一次（见其 PROLOGUE_STORAGE_KEY 守卫）。
    if (getStoredFlag(TUTORIAL_STORAGE_KEY)) maybeAutoShowUpdateLog();
    else maybeAutoOpenTutorial();
  }
}

function renderProloguePage() {
  const page = PROLOGUE_PAGES[prologuePageIndex];
  if (!page) return;
  dom.prologueTitle.textContent = page.title;
  dom.prologueBody.innerHTML = page.text
    .split("\n\n")
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
  dom.prologueBody.scrollTop = 0;
  // V0.9.19：翻页水墨入场——重挂 class 强制回流以重放动画
  dom.prologueBody.classList.remove("page-in");
  dom.prologueTitle.classList.remove("page-in");
  void dom.prologueBody.offsetWidth;
  dom.prologueBody.classList.add("page-in");
  dom.prologueTitle.classList.add("page-in");
  dom.prologuePageText.textContent = `${prologuePageIndex + 1} / ${PROLOGUE_PAGES.length}`;
  dom.prologueDots.innerHTML = PROLOGUE_PAGES.map((_, index) => `<b class="${index === prologuePageIndex ? "current" : ""}"></b>`).join("");
  dom.prologuePrevButton.disabled = prologuePageIndex === 0;
  dom.prologueNextButton.textContent = prologuePageIndex === PROLOGUE_PAGES.length - 1 ? "入塔" : "下一页";
}

function nextProloguePage() {
  if (prologuePageIndex >= PROLOGUE_PAGES.length - 1) {
    closePrologue();
    return;
  }
  prologuePageIndex += 1;
  renderProloguePage();
}

/* ===== 序章回翻与残卷弹窗展示辅助（原 game.js:5064-5171） ===== */
function previousProloguePage() {
  prologuePageIndex = Math.max(0, prologuePageIndex - 1);
  renderProloguePage();
}

function getLorePage(id) {
  return LORE_PAGES.find((page) => page.id === id) || null;
}

function renderLoreOverlay() {
  const unlockedCount = LORE_PAGES.filter((page) => isLoreUnlocked(page.id)).length;
  if (dom.loreProgress) dom.loreProgress.textContent = `残卷目录 · 已显 ${unlockedCount} / ${LORE_PAGES.length} 页`;
  if (!dom.loreList) return;
  dom.loreList.innerHTML = selectedLoreId ? renderLoreDetail(selectedLoreId) : renderLoreDirectory();
  updateLoreSettingControls();
}

function renderLoreDirectory() {
  return LORE_PAGES.map((page) => {
    const unlocked = isLoreUnlocked(page.id);
    const tag = unlocked ? "button" : "article";
    const action = unlocked ? ` type="button" data-lore-open="${page.id}"` : "";
    return `<${tag} class="lore-page lore-index-card ${unlocked ? "unlocked" : "locked"}"${action}>
      <div class="lore-index-head">
        <h3>${page.title}</h3>
        <span class="lore-status-pill">${unlocked ? "已解锁" : "残页未显"}</span>
      </div>
      <span class="lore-source">${unlocked ? page.source : page.hint}</span>
      <p class="lore-body">${unlocked ? page.teaser : "此页尚沉于命途中。"}</p>
      <strong class="lore-quote">${unlocked ? page.quote : "炉火未燃，此页未显。"}</strong>
    </${tag}>`;
  }).join("");
}

function renderLoreDetail(id) {
  const page = getLorePage(id);
  if (!page || !isLoreUnlocked(id)) {
    selectedLoreId = "";
    return renderLoreDirectory();
  }
  const animationClass = loreSkipAnimation ? "animation-skipped" : "unfolding";
  return `<article class="lore-detail ${animationClass}" data-lore-detail>
    <button class="lore-back-button" type="button" data-lore-back>返回目录</button>
    <span class="lore-source">${page.source}</span>
    <h3>${page.title}</h3>
    <p class="lore-body lore-detail-body">${page.body}</p>
    <strong class="lore-quote lore-detail-quote">${page.quote}</strong>
    <div class="lore-detail-actions">
      <button type="button" data-lore-copy="${page.id}">复制金句</button>
    </div>
  </article>`;
}

function openLoreDetail(id) {
  if (!isLoreUnlocked(id)) return;
  selectedLoreId = id;
  renderLoreOverlay();
}

function showLoreStatus(message) {
  if (!dom.loreProgress) return;
  dom.loreProgress.textContent = message;
}

async function copyLoreQuote(id) {
  const page = getLorePage(id);
  if (!page) return;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(page.quote);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    try {
      const input = document.createElement("textarea");
      input.value = page.quote;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      copied = document.execCommand?.("copy") || false;
      input.remove();
    } catch {
      copied = false;
    }
  }
  if (copied) showLoreStatus("残句已入剪贴板。");
}

function openLoreOverlay() {
  if (!dom.loreOverlay) return;
  selectedLoreId = "";
  renderLoreOverlay();
  dom.loreOverlay.classList.remove("hidden");
  refreshModalLock();
  dom.loreCloseButton?.focus();
}

function closeLoreOverlay() {
  selectedLoreId = "";
  dom.loreOverlay?.classList.add("hidden");
  refreshModalLock();
}
