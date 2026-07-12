"use strict";

/* 批次 E-2c1：章节数据与 chapterProgress 共同描述当前位置；塔心是固定序列型终局 act。 */

const MINGTU_TOWER_HEART_ACT_ID = "act-tower-heart";
const MINGTU_TOWER_HEART_ROUTE_ID = "route-tower-heart-fixed";
const MINGTU_TOWER_HEART_QUESTION_CHOICES = Object.freeze(["reject-written-fate"]);
const MINGTU_TOWER_HEART_DEBT_IDS = Object.freeze(["blood", "life", "fate", "poison", "armor", "haste"]);
const MINGTU_TOWER_HEART_BOSS_STATUSES = Object.freeze(["locked", "ready", "inBattle", "defeated"]);
// 只用于识别 E-1/E-2c 早期 Preview 存档，不属于当前章节图或运行期入口。
const MINGTU_LEGACY_FINAL_NODE_ID = "legacy-final";
const MINGTU_TOWER_HEART_SCENES = deepFreezeChapterValue([
  { id: "tower-heart-gate", key: "gate", role: "transition", name: "断契之门", nextId: "tower-heart-prepare" },
  { id: "tower-heart-prepare", key: "prepare", role: "prepare", name: "塔心整备", nextId: "tower-heart-question" },
  { id: "tower-heart-question", key: "question", role: "story", name: "司命终问", nextId: "tower-heart-reflection" },
  { id: "tower-heart-reflection", key: "reflection", role: "debtReveal", name: "命债照见", nextId: "tower-heart-boss" },
  { id: "tower-heart-boss", key: "boss", role: "finalBoss", name: "万命母盘", enemyId: "wanmingMupan", nextId: "tower-heart-ending" },
  { id: "tower-heart-ending", key: "ending", role: "epilogue", name: "角色结局", nextId: null },
]);

function deepFreezeChapterValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreezeChapterValue);
  return Object.freeze(value);
}

function makeLegacyNodes(routeKey, prefix) {
  const specs = prefix === ""
    ? [
        [1, [["normal-1", "battle"], ["normal-2", "battle"]]],
        [2, [["chance-1", "event"], ["shop-1", "shop"], ["elite-1", "elite"]]],
        [3, [["normal-3", "battle"], ["chance-2", "event"]]],
        [4, [["shop-2", "shop"], ["rest-2", "rest"], ["defy-1", "elite"]]],
        [5, [["normal-4", "battle"], ["rest-1", "rest"]]],
      ]
    : [
        [1, [[`${prefix}-1-a`, "battle"], [`${prefix}-1-b`, "battle"], [`${prefix}-1-c`, "battle"]]],
        [2, [[`${prefix}-2-a`, "event"], [`${prefix}-2-b`, "elite"], [`${prefix}-2-c`, "shopOrRest"]]],
        [3, [[`${prefix}-3-a`, "battle"], [`${prefix}-3-b`, "battle"]]],
        [4, [[`${prefix}-4-a`, "shop"], [`${prefix}-4-b`, "rest"], [`${prefix}-4-c`, "elite"]]],
        [5, [[`${prefix}-5-a`, "event"], [`${prefix}-5-b`, "rest"]]],
      ];

  return specs.flatMap(([step, entries], index) => {
    const next = specs[index + 1]?.[1] || [];
    return entries.map(([legacyId, role]) => ({
      id: `node-${routeKey}-${legacyId}`,
      legacyNodeIds: [legacyId],
      legacyStep: step,
      role,
      nextIds: next.map(([nextLegacyId]) => `node-${routeKey}-${nextLegacyId}`),
    }));
  });
}

function makeRoute({ id, legacyId, name, legacyDisplayName, actId, legacyLayer, prefix, normalPool, eliteId, boss }) {
  const nodes = makeLegacyNodes(legacyId, prefix);
  const mapAnchors = Array.from({ length: 6 }, (_, index) => ({
    id: `map-${id}-step-${index + 1}`,
    legacyStep: index + 1,
    role: "map",
  }));
  const lastNodes = nodes.filter((node) => node.legacyStep === 5);
  lastNodes.forEach((node) => { node.nextIds = [boss.id]; });
  return {
    id,
    legacyId,
    name,
    legacyDisplayName,
    actId,
    legacyLayer,
    maxLegacyStep: 6,
    normalPool,
    eliteId,
    nodes,
    mapAnchors,
    boss,
  };
}

const MINGTU_TOWER_CHAPTER = deepFreezeChapterValue((() => {
  const towerHeart = {
    id: MINGTU_TOWER_HEART_ROUTE_ID,
    name: "塔心终局",
    actId: MINGTU_TOWER_HEART_ACT_ID,
    kind: "fixedSequence",
    sequence: MINGTU_TOWER_HEART_SCENES,
    entryNodeId: MINGTU_TOWER_HEART_SCENES[0].id,
  };
  const outerBoss = {
    id: "boss-corpse-puppet",
    role: "boss",
    legacyNodeIds: ["boss-1"],
    legacyStep: 6,
    enemyId: "corpsepuppet",
    nextActId: "act-debt-depths",
  };
  const miasmaBoss = {
    id: "boss-miasma-mother",
    role: "boss",
    legacyNodeIds: ["l2-6-boss"],
    legacyStep: 6,
    enemyId: "miasmaMotherBoss",
    nextActId: "act-mirror-wilds",
  };
  const bloodmarshBoss = {
    id: "boss-blood-robe-mother",
    role: "boss",
    legacyNodeIds: ["l2-6-boss"],
    legacyStep: 6,
    enemyId: "bloodRobeMotherBoss",
    nextActId: "act-mirror-wilds",
  };
  const boneBoss = {
    id: "boss-bone-nest-guardian",
    role: "boss",
    legacyNodeIds: ["l3-6-boss"],
    legacyStep: 6,
    enemyId: "boneNestGuardianBoss",
    nextTowerHeartNodeId: towerHeart.entryNodeId,
  };
  const beehiveBoss = {
    id: "boss-calamity-queen",
    role: "boss",
    legacyNodeIds: ["l3-6-boss"],
    legacyStep: 6,
    enemyId: "calamityQueenBoss",
    nextTowerHeartNodeId: towerHeart.entryNodeId,
  };

  const outer = makeRoute({
    id: "route-outer",
    legacyId: "outer",
    name: "断命外阶",
    legacyDisplayName: "命途塔",
    actId: "act-outer-stairs",
    legacyLayer: 1,
    prefix: "",
    normalPool: ["shanxiao", "bloodwolf", "beeswarm", "rottenShanxiao", "redManeBloodwolf", "wildBeeTide"],
    eliteId: "bloodwolfElite",
    boss: outerBoss,
  });
  const miasma = makeRoute({
    id: "route-miasma",
    legacyId: "miasma",
    name: "腐瘴深径",
    legacyDisplayName: "瘴林深径",
    actId: "act-debt-depths",
    legacyLayer: 2,
    prefix: "l2",
    normalPool: ["rotleafGu", "miasmaParasite", "poisonVineCorpse"],
    eliteId: "miasmaLanternEliteGu",
    boss: miasmaBoss,
  });
  const bloodmarsh = makeRoute({
    id: "route-bloodmarsh",
    legacyId: "bloodmarsh",
    name: "血沼深径",
    legacyDisplayName: "血沼沉渊",
    actId: "act-debt-depths",
    legacyLayer: 2,
    prefix: "l2",
    normalPool: ["bloodLeechSwarm", "brokenMeridianGu", "bloodMudGolem"],
    eliteId: "bloodRobePriestEliteGu",
    boss: bloodmarshBoss,
  });
  const bone = makeRoute({
    id: "route-bone",
    legacyId: "bone",
    name: "白骨巢径",
    legacyDisplayName: "骨塔高陵",
    actId: "act-mirror-wilds",
    legacyLayer: 3,
    prefix: "l3",
    normalPool: ["bonebellGu", "skeletonPuppetGu", "boneArmorGuardGu"],
    eliteId: "boneCommanderElite",
    boss: boneBoss,
  });
  const beehive = makeRoute({
    id: "route-beehive",
    legacyId: "beehive",
    name: "灾蜂巢径",
    legacyDisplayName: "蜂窟魔巢",
    actId: "act-mirror-wilds",
    legacyLayer: 3,
    prefix: "l3",
    normalPool: ["venomBeeGu", "beehiveBroodGu", "chaosSwarmHordeGu"],
    eliteId: "beehiveGuardElite",
    boss: beehiveBoss,
  });

  return {
    id: "mingtu-tower",
    acts: [
      { id: "act-outer-stairs", legacyLayer: 1, name: "断命外阶", routes: [outer] },
      { id: "act-debt-depths", legacyLayer: 2, name: "命债双渊", routes: [miasma, bloodmarsh] },
      { id: "act-mirror-wilds", legacyLayer: 3, name: "照命绝域", routes: [bone, beehive] },
      { id: MINGTU_TOWER_HEART_ACT_ID, kind: "finale", name: "塔心", routes: [towerHeart] },
    ],
    routeCombinations: [
      { id: "combo-miasma-bone", routeIds: [outer.id, miasma.id, bone.id], finaleEntryId: towerHeart.entryNodeId },
      { id: "combo-miasma-beehive", routeIds: [outer.id, miasma.id, beehive.id], finaleEntryId: towerHeart.entryNodeId },
      { id: "combo-bloodmarsh-bone", routeIds: [outer.id, bloodmarsh.id, bone.id], finaleEntryId: towerHeart.entryNodeId },
      { id: "combo-bloodmarsh-beehive", routeIds: [outer.id, bloodmarsh.id, beehive.id], finaleEntryId: towerHeart.entryNodeId },
    ],
    towerHeart,
  };
})());

function getMingtuActById(actId) {
  return MINGTU_TOWER_CHAPTER.acts.find((act) => act.id === actId) || null;
}

function getMingtuRouteById(actId, routeId) {
  const act = getMingtuActById(actId);
  if (!act) return null;
  return act.routes.find((route) => route.id === routeId || route.legacyId === routeId) || null;
}

function getMingtuBossDefinition(actId, routeId) {
  return getMingtuRouteById(actId, routeId)?.boss || null;
}

function getMingtuProgressRoute(run = {}) {
  const progress = run.chapterProgress;
  if (!progress || progress.chapterId !== MINGTU_TOWER_CHAPTER.id) return null;
  return getMingtuRouteById(progress.actId, progress.routeId);
}

function getMingtuProgressNodeDefinition(run = {}) {
  const route = getMingtuProgressRoute(run);
  const nodeId = run.chapterProgress?.nodeId;
  if (!route || !nodeId) return null;
  if (route.kind === "fixedSequence") return route.sequence.find((node) => node.id === nodeId) || null;
  if (route.boss.id === nodeId) return route.boss;
  return route.nodes.find((node) => node.id === nodeId)
    || route.mapAnchors.find((node) => node.id === nodeId)
    || null;
}

function getMingtuMapAnchor(route, step) {
  const safeStep = Math.max(1, Math.min(route?.maxLegacyStep || 1, Number(step) || 1));
  return route?.mapAnchors.find((anchor) => anchor.legacyStep === safeStep) || route?.mapAnchors[0] || null;
}

function isMingtuTowerHeartReflection(value) {
  return Boolean(value
    && MINGTU_TOWER_HEART_DEBT_IDS.includes(value.primaryId)
    && MINGTU_TOWER_HEART_DEBT_IDS.includes(value.secondaryId)
    && value.primaryId !== value.secondaryId);
}

function createMingtuTowerHeartMetadata(value = {}) {
  const completedSceneIds = Array.from(new Set(Array.isArray(value.completedSceneIds)
    ? value.completedSceneIds.filter((id) => MINGTU_TOWER_HEART_SCENES.some((scene) => scene.id === id))
    : []));
  const questionChoice = MINGTU_TOWER_HEART_QUESTION_CHOICES.includes(value.questionChoice)
    ? value.questionChoice
    : null;
  const reflection = isMingtuTowerHeartReflection(value.reflection)
    ? { primaryId: value.reflection.primaryId, secondaryId: value.reflection.secondaryId }
    : null;
  const bossStatus = MINGTU_TOWER_HEART_BOSS_STATUSES.includes(value.bossStatus)
    ? value.bossStatus
    : "locked";
  return { completedSceneIds, questionChoice, reflection, bossStatus };
}

function normalizeMingtuTowerHeartChapterProgress(progress = {}, { recoverBattle = false } = {}) {
  const requestedScene = MINGTU_TOWER_HEART_SCENES.find((scene) => scene.id === progress.nodeId)
    || MINGTU_TOWER_HEART_SCENES[0];
  const metadata = createMingtuTowerHeartMetadata(progress.towerHeart);
  const complete = (id) => metadata.completedSceneIds.includes(id);
  let scene = requestedScene;
  if (scene.id !== "tower-heart-gate" && !complete("tower-heart-gate")) scene = MINGTU_TOWER_HEART_SCENES[0];
  else if (!["tower-heart-gate", "tower-heart-prepare"].includes(scene.id) && !complete("tower-heart-prepare")) scene = MINGTU_TOWER_HEART_SCENES[1];
  else if (!["tower-heart-gate", "tower-heart-prepare", "tower-heart-question"].includes(scene.id)
    && (!complete("tower-heart-question") || !metadata.questionChoice)) scene = MINGTU_TOWER_HEART_SCENES[2];
  else if (["tower-heart-boss", "tower-heart-ending"].includes(scene.id)
    && (!complete("tower-heart-reflection") || !metadata.reflection)) scene = MINGTU_TOWER_HEART_SCENES[3];
  else if (scene.id === "tower-heart-ending"
    && (!complete("tower-heart-boss") || metadata.bossStatus !== "defeated")) scene = MINGTU_TOWER_HEART_SCENES[4];

  if (recoverBattle && scene.id === "tower-heart-boss" && metadata.bossStatus === "inBattle") metadata.bossStatus = "ready";
  if (["tower-heart-gate", "tower-heart-prepare", "tower-heart-question", "tower-heart-reflection"].includes(scene.id)) {
    metadata.bossStatus = "locked";
  } else if (scene.id === "tower-heart-boss" && metadata.bossStatus === "locked") {
    metadata.bossStatus = "ready";
  }
  return {
    chapterId: MINGTU_TOWER_CHAPTER.id,
    actId: MINGTU_TOWER_HEART_ACT_ID,
    routeId: MINGTU_TOWER_HEART_ROUTE_ID,
    nodeId: scene.id,
    towerHeart: metadata,
  };
}

function createMingtuChapterProgress(actId = "act-outer-stairs", routeId = "outer", nodeId = "", metadata = undefined) {
  const route = getMingtuRouteById(actId, routeId) || getMingtuRouteById("act-outer-stairs", "outer");
  if (route.kind === "fixedSequence") {
    return normalizeMingtuTowerHeartChapterProgress({
      nodeId,
      towerHeart: metadata?.towerHeart || metadata,
    });
  }
  const validNode = route.boss.id === nodeId
    || route.nodes.some((node) => node.id === nodeId)
    || route.mapAnchors.some((node) => node.id === nodeId);
  return {
    chapterId: MINGTU_TOWER_CHAPTER.id,
    actId: route.actId,
    routeId: route.id,
    nodeId: validNode ? nodeId : getMingtuMapAnchor(route, 1).id,
  };
}

function findMingtuCanonicalNode(route, legacyNode) {
  if (!route || route.kind === "fixedSequence" || !legacyNode) return null;
  if (route.boss.legacyNodeIds.includes(legacyNode.id) || legacyNode.enemyId === route.boss.enemyId) return route.boss;
  return route.nodes.find((node) => node.legacyNodeIds.includes(legacyNode.id)) || null;
}

function getMingtuActiveRuntimeNode(run = {}) {
  const definition = getMingtuProgressNodeDefinition(run);
  if (!definition || definition.role === "map") return null;
  if (definition.role === "finalBoss") {
    return { id: definition.id, type: "boss", role: definition.role, enemyId: definition.enemyId, name: definition.name, finalNode: true };
  }
  const nodes = run.mapState?.segments?.flat?.() || [];
  const match = nodes.find((node) => definition.legacyNodeIds?.includes(node.id)
    || (definition.role === "boss" && node.enemyId === definition.enemyId));
  if (match) return match;
  if (definition.role === "boss") {
    return {
      id: definition.legacyNodeIds[0],
      step: definition.legacyStep,
      type: "boss",
      enemyId: definition.enemyId,
      name: "Boss",
    };
  }
  return null;
}

function getMingtuProgressStep(run = {}) {
  const definition = getMingtuProgressNodeDefinition(run);
  return definition && Number.isFinite(Number(definition.legacyStep)) ? Number(definition.legacyStep) : 0;
}

function getMingtuProgressLayer(run = {}) {
  const route = getMingtuProgressRoute(run);
  return route?.kind === "fixedSequence" ? 0 : (route?.legacyLayer || 1);
}

function isMingtuAct(run = {}, actId) {
  return run.chapterProgress?.actId === actId;
}

function getMingtuProgressRouteLegacyId(run = {}) {
  const route = getMingtuProgressRoute(run);
  return route?.legacyId || route?.id || "outer";
}

function getMingtuProgressRouteName(run = {}) {
  const route = getMingtuProgressRoute(run);
  return route?.legacyDisplayName || route?.name || "命途塔";
}

function ensureMingtuLegacyActState(run, key) {
  if (!run[key] || typeof run[key] !== "object") run[key] = {};
  return run[key];
}

function syncMingtuLegacyLocationShadow(run = {}, runtimeNode = undefined) {
  const route = getMingtuProgressRoute(run);
  const definition = getMingtuProgressNodeDefinition(run);
  if (!route || !definition) return run;
  if (route.kind === "fixedSequence") {
    run.currentNode = null;
    return run;
  }
  const step = definition.legacyStep;
  run.layer = route.legacyLayer;
  run.floor = step;
  run.currentRouteStep = step;
  run.currentNode = definition.role === "map"
    ? null
    : (runtimeNode || getMingtuActiveRuntimeNode(run));

  const layer2 = run.layer2 && typeof run.layer2 === "object" ? run.layer2 : null;
  const layer3 = run.layer3 && typeof run.layer3 === "object" ? run.layer3 : null;
  if (route.legacyLayer === 1) {
    if (layer2) layer2.active = false;
    if (layer3) layer3.active = false;
  } else if (route.legacyLayer === 2) {
    const state = ensureMingtuLegacyActState(run, "layer2");
    state.active = true;
    state.routeId = route.legacyId;
    state.theme = route.legacyId;
    state.routeName = route.legacyDisplayName || route.name;
    if (layer3) layer3.active = false;
  } else {
    const state = ensureMingtuLegacyActState(run, "layer3");
    state.active = true;
    state.routeId = route.legacyId;
    state.theme = route.legacyId;
    state.routeName = route.legacyDisplayName || route.name;
    if (layer2) layer2.active = true;
  }
  return run;
}

function isMingtuTowerHeart(run = {}) {
  return run.chapterProgress?.chapterId === MINGTU_TOWER_CHAPTER.id
    && run.chapterProgress?.actId === MINGTU_TOWER_HEART_ACT_ID
    && run.chapterProgress?.routeId === MINGTU_TOWER_HEART_ROUTE_ID;
}

function getMingtuTowerHeartScene(run = {}) {
  if (!isMingtuTowerHeart(run)) return null;
  return MINGTU_TOWER_HEART_SCENES.find((scene) => scene.id === run.chapterProgress.nodeId) || null;
}

function isMingtuTowerHeartSceneComplete(run = {}, sceneId = run.chapterProgress?.nodeId) {
  return Boolean(isMingtuTowerHeart(run)
    && MINGTU_TOWER_HEART_SCENES.some((scene) => scene.id === sceneId)
    && run.chapterProgress.towerHeart?.completedSceneIds?.includes(sceneId));
}

function setMingtuTowerHeartScene(run, sceneId, metadata = run.chapterProgress?.towerHeart) {
  run.chapterProgress = createMingtuChapterProgress(
    MINGTU_TOWER_HEART_ACT_ID,
    MINGTU_TOWER_HEART_ROUTE_ID,
    sceneId,
    { towerHeart: metadata },
  );
  syncMingtuLegacyLocationShadow(run);
  return run.chapterProgress;
}

function markMingtuTowerHeartSceneComplete(metadata, sceneId) {
  if (!metadata.completedSceneIds.includes(sceneId)) metadata.completedSceneIds.push(sceneId);
}

function hasMingtuCompletedRegionBosses(run = {}) {
  const stats = run.runStats || {};
  return Boolean((run.layer2?.bossDefeated || stats.layer2BossDefeated)
    && (run.layer3?.bossDefeated || stats.layer3BossDefeated));
}

function enterMingtuTowerHeart(run = {}) {
  if (!run || run.status !== "running") return null;
  if (isMingtuTowerHeart(run)) return run.chapterProgress;
  const route = getMingtuProgressRoute(run);
  const definition = getMingtuProgressNodeDefinition(run);
  const bossCompleted = definition?.legacyNodeIds?.some((id) => run.completedNodes?.includes(id));
  if (!route || route.legacyLayer !== 3 || definition?.role !== "boss" || !bossCompleted || !hasMingtuCompletedRegionBosses(run)) return null;
  return setMingtuTowerHeartScene(run, MINGTU_TOWER_HEART_SCENES[0].id, createMingtuTowerHeartMetadata());
}

function completeMingtuTowerHeartScene(run = {}, sceneId) {
  if (!isMingtuTowerHeart(run) || run.status !== "running" || run.chapterProgress.nodeId !== sceneId) return null;
  if (!["tower-heart-gate", "tower-heart-prepare"].includes(sceneId)) return null;
  const scene = getMingtuTowerHeartScene(run);
  if (!scene?.nextId) return null;
  const metadata = createMingtuTowerHeartMetadata(run.chapterProgress.towerHeart);
  markMingtuTowerHeartSceneComplete(metadata, sceneId);
  return setMingtuTowerHeartScene(run, scene.nextId, metadata);
}

function chooseMingtuTowerHeartQuestion(run = {}, choiceId) {
  if (!isMingtuTowerHeart(run) || run.status !== "running" || !MINGTU_TOWER_HEART_QUESTION_CHOICES.includes(choiceId)) return false;
  const metadata = createMingtuTowerHeartMetadata(run.chapterProgress.towerHeart);
  if (metadata.questionChoice) return metadata.questionChoice === choiceId;
  if (run.chapterProgress.nodeId !== "tower-heart-question") return false;
  metadata.questionChoice = choiceId;
  markMingtuTowerHeartSceneComplete(metadata, "tower-heart-question");
  setMingtuTowerHeartScene(run, "tower-heart-reflection", metadata);
  return true;
}

function lockMingtuTowerHeartReflection(run = {}, reflection) {
  if (!isMingtuTowerHeart(run) || run.status !== "running" || !isMingtuTowerHeartReflection(reflection)) return false;
  const metadata = createMingtuTowerHeartMetadata(run.chapterProgress.towerHeart);
  if (metadata.reflection) {
    return metadata.reflection.primaryId === reflection.primaryId && metadata.reflection.secondaryId === reflection.secondaryId;
  }
  if (run.chapterProgress.nodeId !== "tower-heart-reflection" || !metadata.questionChoice) return false;
  metadata.reflection = { primaryId: reflection.primaryId, secondaryId: reflection.secondaryId };
  metadata.bossStatus = "ready";
  markMingtuTowerHeartSceneComplete(metadata, "tower-heart-reflection");
  setMingtuTowerHeartScene(run, "tower-heart-boss", metadata);
  return true;
}

function startMingtuTowerHeartBoss(run = {}) {
  if (!isMingtuTowerHeart(run) || run.status !== "running" || run.chapterProgress.nodeId !== "tower-heart-boss") return false;
  const metadata = createMingtuTowerHeartMetadata(run.chapterProgress.towerHeart);
  if (metadata.bossStatus === "inBattle") return true;
  if (metadata.bossStatus !== "ready" || !metadata.reflection) return false;
  metadata.bossStatus = "inBattle";
  setMingtuTowerHeartScene(run, "tower-heart-boss", metadata);
  return true;
}

function completeMingtuTowerHeartBoss(run = {}) {
  if (!isMingtuTowerHeart(run) || run.status !== "running" || run.chapterProgress.nodeId !== "tower-heart-boss") return false;
  const metadata = createMingtuTowerHeartMetadata(run.chapterProgress.towerHeart);
  if (metadata.bossStatus !== "inBattle") return false;
  metadata.bossStatus = "defeated";
  markMingtuTowerHeartSceneComplete(metadata, "tower-heart-boss");
  setMingtuTowerHeartScene(run, "tower-heart-ending", metadata);
  return true;
}

function completeMingtuTowerHeartEnding(run = {}) {
  if (!isMingtuTowerHeart(run) || run.status !== "running" || run.chapterProgress.nodeId !== "tower-heart-ending") return false;
  const metadata = createMingtuTowerHeartMetadata(run.chapterProgress.towerHeart);
  if (metadata.bossStatus !== "defeated" || !metadata.completedSceneIds.includes("tower-heart-boss")) return false;
  markMingtuTowerHeartSceneComplete(metadata, "tower-heart-ending");
  setMingtuTowerHeartScene(run, "tower-heart-ending", metadata);
  return true;
}

function isMingtuTowerHeartReadyToClear(run = {}) {
  return Boolean(run.status === "running"
    && isMingtuTowerHeart(run)
    && run.chapterProgress.nodeId === "tower-heart-ending"
    && run.chapterProgress.towerHeart?.bossStatus === "defeated"
    && isMingtuTowerHeartSceneComplete(run, "tower-heart-ending"));
}

function isMingtuSafeRunCheckpoint(run = {}) {
  if (!run || run.status !== "running") return false;
  if (isMingtuTowerHeart(run)) {
    const scene = getMingtuTowerHeartScene(run);
    if (!scene) return false;
    return scene.id !== "tower-heart-boss" || run.chapterProgress.towerHeart?.bossStatus === "ready";
  }
  return getMingtuProgressNodeDefinition(run)?.role === "map";
}

function setMingtuActRuntimeData(run, actId, data = {}) {
  const key = actId === "act-mirror-wilds" ? "layer3" : actId === "act-debt-depths" ? "layer2" : "";
  if (key) Object.assign(ensureMingtuLegacyActState(run, key), data);
  syncMingtuLegacyLocationShadow(run);
  return key ? run[key] : null;
}

function setMingtuChapterMapPosition(run, actId, routeId, step = 1) {
  const route = getMingtuRouteById(actId, routeId) || getMingtuRouteById("act-outer-stairs", "outer");
  if (route.kind === "fixedSequence") return run.chapterProgress || null;
  run.chapterProgress = createMingtuChapterProgress(route.actId, route.id, getMingtuMapAnchor(route, step).id);
  syncMingtuLegacyLocationShadow(run);
  return run.chapterProgress;
}

function enterMingtuChapterNode(run, runtimeNode) {
  const route = getMingtuProgressRoute(run);
  const definition = findMingtuCanonicalNode(route, runtimeNode);
  if (!definition) return null;
  run.chapterProgress = createMingtuChapterProgress(route.actId, route.id, definition.id);
  syncMingtuLegacyLocationShadow(run, runtimeNode);
  return run.chapterProgress;
}

function advanceMingtuChapterNode(run, runtimeNode = getMingtuActiveRuntimeNode(run)) {
  const route = getMingtuProgressRoute(run);
  const definition = findMingtuCanonicalNode(route, runtimeNode) || getMingtuProgressNodeDefinition(run);
  const nextStep = Math.min(route?.maxLegacyStep || 1, (definition?.legacyStep || 1) + 1);
  return setMingtuChapterMapPosition(run, route?.actId, route?.id, nextStep);
}

function migrateLegacyMingtuChapterProgress(run = {}) {
  if (run.chapterProgress) return run.chapterProgress;
  const route = getMingtuLegacyRoute(run);
  const legacyStep = Math.max(1, Math.min(route.maxLegacyStep, Number(run.currentRouteStep ?? run.floor) || 1));
  const canonicalNode = findMingtuCanonicalNode(route, run.currentNode);
  if (!canonicalNode && legacyStep === route.boss.legacyStep && Array.isArray(run.completedNodes)) {
    const bossIds = new Set(route.boss.legacyNodeIds);
    run.completedNodes = run.completedNodes.filter((nodeId) => !bossIds.has(nodeId));
  }
  run.chapterProgress = createMingtuChapterProgress(
    route.actId,
    route.id,
    canonicalNode?.id || getMingtuMapAnchor(route, legacyStep).id,
  );
  syncMingtuLegacyLocationShadow(run, canonicalNode ? run.currentNode : undefined);
  return run.chapterProgress;
}

function ensureMingtuChapterProgress(run = {}) {
  if (!run.chapterProgress) return migrateLegacyMingtuChapterProgress(run);
  const progress = run.chapterProgress;
  if (run.status === "running" && progress.nodeId === MINGTU_LEGACY_FINAL_NODE_ID) {
    run.chapterProgress = createMingtuChapterProgress(
      MINGTU_TOWER_HEART_ACT_ID,
      MINGTU_TOWER_HEART_ROUTE_ID,
      MINGTU_TOWER_HEART_SCENES[0].id,
    );
    syncMingtuLegacyLocationShadow(run);
    return run.chapterProgress;
  }
  const normalized = progress.actId === MINGTU_TOWER_HEART_ACT_ID || progress.routeId === MINGTU_TOWER_HEART_ROUTE_ID
    ? normalizeMingtuTowerHeartChapterProgress(progress, { recoverBattle: true })
    : createMingtuChapterProgress(progress.actId, progress.routeId, progress.nodeId);
  run.chapterProgress = normalized;
  syncMingtuLegacyLocationShadow(run);
  return normalized;
}

function getMingtuLegacyRoute(run = {}) {
  const progressRoute = getMingtuProgressRoute(run);
  if (progressRoute) return progressRoute;
  const layer3Active = run.layer3?.active || Number(run.layer) === 3;
  if (layer3Active) {
    return getMingtuRouteById("act-mirror-wilds", run.layer3?.routeId || run.layer3?.theme || "bone")
      || getMingtuRouteById("act-mirror-wilds", "bone");
  }
  const layer2Active = run.layer2?.active || Number(run.layer) === 2;
  if (layer2Active) {
    return getMingtuRouteById("act-debt-depths", run.layer2?.routeId || run.layer2?.theme || "miasma")
      || getMingtuRouteById("act-debt-depths", "miasma");
  }
  return getMingtuRouteById("act-outer-stairs", "outer");
}

function getMingtuContextNode(run = {}) {
  return run.chapterProgress ? getMingtuActiveRuntimeNode(run) : run.currentNode;
}

function isMingtuBossNode(run = {}, node = getMingtuContextNode(run)) {
  const route = getMingtuLegacyRoute(run);
  const boss = route?.boss;
  if (!boss || !node) return false;
  return boss.legacyNodeIds.includes(node.id) || Boolean(node.enemyId && node.enemyId === boss.enemyId);
}

function isMingtuBossSegment(run = {}, step = run.chapterProgress ? getMingtuProgressStep(run) : (run.currentRouteStep ?? run.floor)) {
  const boss = getMingtuLegacyRoute(run)?.boss;
  return Boolean(boss && Number(step) === boss.legacyStep);
}

function resolveMingtuLegacyContext(run = {}) {
  const route = getMingtuLegacyRoute(run);
  const act = route ? getMingtuActById(route.actId) : null;
  const runtimeNode = getMingtuContextNode(run);
  const node = route?.nodes.find((entry) => entry.legacyNodeIds.includes(runtimeNode?.id)) || null;
  const isBoss = isMingtuBossNode(run, runtimeNode);
  return Object.freeze({
    chapterId: MINGTU_TOWER_CHAPTER.id,
    actId: act?.id || null,
    routeId: route?.id || null,
    nodeId: isBoss ? route.boss.id : node?.id || null,
    bossId: isBoss ? route.boss.id : null,
    isBoss,
  });
}

function traceMingtuRouteCombination(combinationId) {
  const combination = MINGTU_TOWER_CHAPTER.routeCombinations.find((entry) => entry.id === combinationId);
  if (!combination) return [];
  const routes = combination.routeIds.map((routeId) => MINGTU_TOWER_CHAPTER.acts
    .flatMap((act) => act.routes)
    .find((route) => route.id === routeId));
  if (routes.some((route) => !route)) return [];
  for (let index = 0; index < routes.length - 1; index += 1) {
    if (routes[index].boss.nextActId !== routes[index + 1].actId) return [];
  }
  if (routes.at(-1).boss.nextTowerHeartNodeId !== combination.finaleEntryId) return [];
  return [...combination.routeIds, combination.finaleEntryId];
}

function validateMingtuChapterGraph() {
  const issues = [];
  const ids = new Set([MINGTU_TOWER_CHAPTER.id]);
  const addUnique = (id, label) => {
    if (!id || ids.has(id)) issues.push(`${label} ID 重复或缺失：${id || "(空)"}`);
    else ids.add(id);
  };

  const routes = [];
  const finaleRoutes = [];
  for (const act of MINGTU_TOWER_CHAPTER.acts) {
    addUnique(act.id, "区域");
    for (const route of act.routes) {
      addUnique(route.id, "路线");
      if (route.kind === "fixedSequence") {
        finaleRoutes.push(route);
        if (act.kind !== "finale") issues.push(`${route.id} 未归入 finale act`);
        if (!Array.isArray(route.sequence) || route.sequence.length !== 6) issues.push(`${route.id} 固定场景必须为 6`);
        route.sequence?.forEach((node, index) => {
          addUnique(node.id, "塔心场景");
          const expectedNext = route.sequence[index + 1]?.id || null;
          if (node.nextId !== expectedNext) issues.push(`${node.id} 固定后继错误`);
        });
        for (const forbidden of ["mapAnchors", "normalPool", "eliteId", "boss"]) {
          if (Object.prototype.hasOwnProperty.call(route, forbidden)) issues.push(`${route.id} 不得包含 ${forbidden}`);
        }
        continue;
      }
      routes.push(route);
      route.nodes.forEach((node) => addUnique(node.id, "节点"));
      route.mapAnchors.forEach((node) => addUnique(node.id, "地图锚点"));
      addUnique(route.boss.id, "Boss");
      if (route.boss.role !== "boss" || !route.boss.enemyId) issues.push(`${route.id} Boss 身份声明不完整`);
      const routeNodeIds = new Set([...route.nodes.map((node) => node.id), route.boss.id]);
      route.nodes.forEach((node) => node.nextIds.forEach((nextId) => {
        if (!routeNodeIds.has(nextId)) issues.push(`${node.id} 指向不存在的节点 ${nextId}`);
      }));
      const visit = (id, stack = new Set()) => {
        if (stack.has(id)) return true;
        const node = route.nodes.find((entry) => entry.id === id);
        if (!node) return false;
        const nextStack = new Set(stack).add(id);
        return node.nextIds.some((nextId) => visit(nextId, nextStack));
      };
      route.nodes.forEach((node) => {
        if (visit(node.id)) issues.push(`${route.id} 存在死循环`);
      });
      const reachable = new Set();
      const walk = (id) => {
        if (reachable.has(id)) return;
        reachable.add(id);
        const node = route.nodes.find((entry) => entry.id === id);
        node?.nextIds.forEach(walk);
      };
      route.nodes.filter((node) => node.legacyStep === 1).forEach((node) => walk(node.id));
      if (!reachable.has(route.boss.id)) issues.push(`${route.id} 无法到达 Boss`);
    }
  }

  if (routes.length !== 5) issues.push("区域路线总数必须为 5");
  if (finaleRoutes.length !== 1) issues.push("塔心固定序列必须唯一");
  if (new Set(routes.map((route) => route.boss.enemyId)).size !== 5) issues.push("五名区域 Boss 必须唯一");
  if (MINGTU_TOWER_CHAPTER.routeCombinations.length !== 4) issues.push("路线组合必须为 4");
  MINGTU_TOWER_CHAPTER.routeCombinations.forEach((combo) => {
    const trace = traceMingtuRouteCombination(combo.id);
    if (trace.at(-1) !== MINGTU_TOWER_CHAPTER.towerHeart.entryNodeId) issues.push(`${combo.id} 未到达塔心入口`);
    if (trace.includes(MINGTU_LEGACY_FINAL_NODE_ID)) issues.push(`${combo.id} 新流程仍经过旧终点`);
    combo.routeIds.forEach((routeId) => {
      if (!routes.some((route) => route.id === routeId)) issues.push(`${combo.id} 引用不存在的路线 ${routeId}`);
    });
  });
  return issues;
}
