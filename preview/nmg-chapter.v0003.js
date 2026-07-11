"use strict";

/* 批次 E-1c：章节数据与 chapterProgress 共同描述当前位置；legacyFinal 是唯一完整通关终点。 */

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
  const legacyFinal = { id: "legacy-final", role: "legacyFinal", name: "命途塔兼容终点", legacyStep: 6 };
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
    nextLegacyFinalId: legacyFinal.id,
  };
  const beehiveBoss = {
    id: "boss-calamity-queen",
    role: "boss",
    legacyNodeIds: ["l3-6-boss"],
    legacyStep: 6,
    enemyId: "calamityQueenBoss",
    nextLegacyFinalId: legacyFinal.id,
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
    ],
    routeCombinations: [
      { id: "combo-miasma-bone", routeIds: [outer.id, miasma.id, bone.id], legacyFinalId: legacyFinal.id },
      { id: "combo-miasma-beehive", routeIds: [outer.id, miasma.id, beehive.id], legacyFinalId: legacyFinal.id },
      { id: "combo-bloodmarsh-bone", routeIds: [outer.id, bloodmarsh.id, bone.id], legacyFinalId: legacyFinal.id },
      { id: "combo-bloodmarsh-beehive", routeIds: [outer.id, bloodmarsh.id, beehive.id], legacyFinalId: legacyFinal.id },
    ],
    legacyFinal,
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
  if (nodeId === MINGTU_TOWER_CHAPTER.legacyFinal.id) return MINGTU_TOWER_CHAPTER.legacyFinal;
  if (route.boss.id === nodeId) return route.boss;
  return route.nodes.find((node) => node.id === nodeId)
    || route.mapAnchors.find((node) => node.id === nodeId)
    || null;
}

function getMingtuMapAnchor(route, step) {
  const safeStep = Math.max(1, Math.min(route?.maxLegacyStep || 1, Number(step) || 1));
  return route?.mapAnchors.find((anchor) => anchor.legacyStep === safeStep) || route?.mapAnchors[0] || null;
}

function createMingtuChapterProgress(actId = "act-outer-stairs", routeId = "outer", nodeId = "") {
  const route = getMingtuRouteById(actId, routeId) || getMingtuRouteById("act-outer-stairs", "outer");
  const validNode = (route.legacyLayer === 3 && nodeId === MINGTU_TOWER_CHAPTER.legacyFinal.id)
    || route.boss.id === nodeId
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
  if (!route || !legacyNode) return null;
  if (route.boss.legacyNodeIds.includes(legacyNode.id) || legacyNode.enemyId === route.boss.enemyId) return route.boss;
  return route.nodes.find((node) => node.legacyNodeIds.includes(legacyNode.id)) || null;
}

function getMingtuActiveRuntimeNode(run = {}) {
  const definition = getMingtuProgressNodeDefinition(run);
  if (!definition || definition.role === "map") return null;
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
  return getMingtuProgressNodeDefinition(run)?.legacyStep || 1;
}

function getMingtuProgressLayer(run = {}) {
  return getMingtuProgressRoute(run)?.legacyLayer || 1;
}

function isMingtuAct(run = {}, actId) {
  return run.chapterProgress?.actId === actId;
}

function getMingtuProgressRouteLegacyId(run = {}) {
  return getMingtuProgressRoute(run)?.legacyId || "outer";
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

function setMingtuActRuntimeData(run, actId, data = {}) {
  const key = actId === "act-mirror-wilds" ? "layer3" : actId === "act-debt-depths" ? "layer2" : "";
  if (key) Object.assign(ensureMingtuLegacyActState(run, key), data);
  syncMingtuLegacyLocationShadow(run);
  return key ? run[key] : null;
}

function setMingtuChapterMapPosition(run, actId, routeId, step = 1) {
  const route = getMingtuRouteById(actId, routeId) || getMingtuRouteById("act-outer-stairs", "outer");
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

function enterMingtuLegacyFinal(run = {}) {
  const route = getMingtuProgressRoute(run);
  const definition = getMingtuProgressNodeDefinition(run);
  if (!route || route.legacyLayer !== 3 || definition?.role !== "boss") return null;
  run.chapterProgress = createMingtuChapterProgress(route.actId, route.id, MINGTU_TOWER_CHAPTER.legacyFinal.id);
  syncMingtuLegacyLocationShadow(run);
  return run.chapterProgress;
}

function isMingtuLegacyFinal(run = {}) {
  return run.chapterProgress?.chapterId === MINGTU_TOWER_CHAPTER.id
    && run.chapterProgress?.nodeId === MINGTU_TOWER_CHAPTER.legacyFinal.id;
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
  const normalized = createMingtuChapterProgress(progress.actId, progress.routeId, progress.nodeId);
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
  const atLegacyFinal = isMingtuLegacyFinal(run)
    || Boolean(!run.chapterProgress && route?.legacyLayer === 3 && run.status === "cleared" && isBoss);
  return Object.freeze({
    chapterId: MINGTU_TOWER_CHAPTER.id,
    actId: act?.id || null,
    routeId: route?.id || null,
    nodeId: isBoss ? route.boss.id : node?.id || null,
    bossId: isBoss ? route.boss.id : null,
    isBoss,
    legacyFinalId: MINGTU_TOWER_CHAPTER.legacyFinal.id,
    atLegacyFinal,
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
  if (routes.at(-1).boss.nextLegacyFinalId !== combination.legacyFinalId) return [];
  return [...combination.routeIds, combination.legacyFinalId];
}

function validateMingtuChapterGraph() {
  const issues = [];
  const ids = new Set([MINGTU_TOWER_CHAPTER.id, MINGTU_TOWER_CHAPTER.legacyFinal.id]);
  const addUnique = (id, label) => {
    if (!id || ids.has(id)) issues.push(`${label} ID 重复或缺失：${id || "(空)"}`);
    else ids.add(id);
  };

  const routes = [];
  for (const act of MINGTU_TOWER_CHAPTER.acts) {
    addUnique(act.id, "区域");
    for (const route of act.routes) {
      routes.push(route);
      addUnique(route.id, "路线");
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
  if (new Set(routes.map((route) => route.boss.enemyId)).size !== 5) issues.push("五名区域 Boss 必须唯一");
  if (MINGTU_TOWER_CHAPTER.routeCombinations.length !== 4) issues.push("路线组合必须为 4");
  MINGTU_TOWER_CHAPTER.routeCombinations.forEach((combo) => {
    const trace = traceMingtuRouteCombination(combo.id);
    if (trace.at(-1) !== MINGTU_TOWER_CHAPTER.legacyFinal.id) issues.push(`${combo.id} 未到达统一终点`);
    combo.routeIds.forEach((routeId) => {
      if (!routes.some((route) => route.id === routeId)) issues.push(`${combo.id} 引用不存在的路线 ${routeId}`);
    });
  });
  return issues;
}
