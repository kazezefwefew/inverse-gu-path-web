"use strict";
/* nmg-benming.js：V0.9.36 B-6a，本命蛊数据、道行、形态、被动与立绘辅助。须在 game.v 之前加载。 */
/* ===== V0.9.20 本命蛊：跨局养成——每位蛊修一只本命蛊，局末结道行、跨局进形态，被动常驻。 =====
 * 道行只增不减（nmg.benming JSON {heroId: 道行}），形态由阈值推导不落盘（坏档零风险）。
 * 被动强度封顶：真形全档叠加约等于两件普通遗物；十重天不豁免不加成。 */
const BENMING_KEY = "nmg.benming";
const BENMING_STAGES = Object.freeze([
  { stage: 0, name: "蛊卵", threshold: 0 },
  { stage: 1, name: "幼虫", threshold: 60 },
  { stage: 2, name: "成虫", threshold: 180 },
  { stage: 3, name: "真形", threshold: 420 },
  { stage: 4, name: "神化", threshold: 800 },  // V0.9.33 真形之上再开两阶，给满级玩家新追求
  { stage: 5, name: "归墟", threshold: 1500 },
]);
const BENMING_GU = Object.freeze({
  fate: {
    name: "衔命虫", glyph: "衔",
    lore: "衔着他被判死的那根命线，至今不肯松口。",
    stagePassives: ["尚在卵中沉睡。", "开局命势 +1。", "每场首次命势圆满时，额外抽 1 张牌。", "命势圆满时，额外获得 1 点防御与 1 蛊石。", "开局命势再 +1（累计 +2）。", "命势圆满的额外收益翻倍（+2 防御、+2 蛊石）。"],
  },
  blood: {
    name: "赤茧蛊", glyph: "茧",
    lore: "血债结成的茧，茧里裹着没讨回来的旧仇。",
    stagePassives: ["尚在卵中沉睡。", "每场战斗开局自带 2 层血煞。", "血煞上限 +2。", "每场首次血煞满溢时，恢复 4 点生命。", "血煞上限再 +2（累计 +4）。", "每场开局自带血煞再 +2（累计 4 层）。"],
  },
  poison: {
    name: "蜕鳞蛊", glyph: "鳞",
    lore: "万毒噬身那夜蜕下的第一片鳞，还带着牙印。",
    stagePassives: ["尚在卵中沉睡。", "每场首次施毒额外 +1 层。", "攻击中毒的敌人时，伤害 +2。", "每场开局敌人自带 2 层毒性。", "攻击中毒敌人的额外伤害再 +2（累计 +4）。", "每场开局敌人自带毒性再 +2（累计 4 层）。"],
  },
  longevity: {
    name: "灯芯蛊", glyph: "芯",
    lore: "半盏寿灯里没烧完的芯，一头连着朝，一头连着暮。",
    stagePassives: ["尚在卵中沉睡。", "寿元上限 +2。", "每局首次焚寿时，返还 1 点寿元。", "焚寿燃命的伤害加成 +25%。", "寿元上限再 +2（累计 +4）。", "焚寿燃命的伤害加成再 +25%（累计 +50%）。"],
  },
});
let __benmingCache = null;
function getBenmingStore() {
  if (__benmingCache) return __benmingCache;
  try { __benmingCache = JSON.parse(localStorage.getItem(BENMING_KEY)) || {}; } catch (e) { __benmingCache = {}; }
  return __benmingCache;
}
function getBenmingDaoxing(heroId) {
  const v = Number(getBenmingStore()[heroId]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}
function addBenmingDaoxing(heroId, amount) {
  if (!heroId || !(amount > 0)) return;
  const store = getBenmingStore();
  store[heroId] = getBenmingDaoxing(heroId) + Math.floor(amount);
  try { safeWriteJson(BENMING_KEY, JSON.stringify(store)); } catch (e) { /* 存储不可用则忽略 */ }
}
function getBenmingStage(heroId) {
  const dao = getBenmingDaoxing(heroId);
  let stage = 0;
  BENMING_STAGES.forEach((s) => { if (dao >= s.threshold) stage = s.stage; });
  return stage;
}
function getBenmingStageInfo(heroId) {
  const stage = getBenmingStage(heroId);
  const dao = getBenmingDaoxing(heroId);
  const next = BENMING_STAGES[stage + 1] || null;
  return { stage, stageName: BENMING_STAGES[stage].name, dao, next, toNext: next ? next.threshold - dao : 0 };
}
// 战斗内被动判定：本局蛊修是该蛊之主，且形态已到档。V0.9.22：蛊斗反噬静养期内形态降一档。
function benmingPassive(heroId, stage) {
  if (!runState || runState.heroId !== heroId) return false;
  let effective = getBenmingStage(heroId);
  const injuryUntil = getGuluStore().injuryUntil;
  if (injuryUntil && guluNow() < injuryUntil) effective = Math.max(0, effective - 1);
  return effective >= stage;
}
// V0.9.34 神化/归墟(stage4/5)专属立绘已就位（heroId-4/5.jpg）；不再封顶复用真形。
function getBenmingImagePath(heroId, stage) { return `assets/codex/benming/${heroId}-${Number(stage) || 0}.jpg`; }
