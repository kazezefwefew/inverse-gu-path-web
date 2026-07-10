"use strict";

/* 批次 E-1a：只读描述现有命途塔路线；局内进度仍以 runState 为唯一真相。 */

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

function makeRoute({ id, legacyId, name, actId, legacyLayer, prefix, normalPool, eliteId, boss }) {
  const nodes = makeLegacyNodes(legacyId, prefix);
  const lastNodes = nodes.filter((node) => node.legacyStep === 5);
  lastNodes.forEach((node) => { node.nextIds = [boss.id]; });
  return {
    id,
    legacyId,
    name,
    actId,
    legacyLayer,
    maxLegacyStep: 6,
    normalPool,
    eliteId,
    nodes,
    boss,
  };
}

const MINGTU_TOWER_CHAPTER = deepFreezeChapterValue((() => {
  const legacyFinal = { id: "legacy-final", role: "legacyFinal" };
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

function getMingtuLegacyRoute(run = {}) {
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

function isMingtuBossNode(run = {}, node = run.currentNode) {
  const route = getMingtuLegacyRoute(run);
  const boss = route?.boss;
  if (!boss || !node) return false;
  return boss.legacyNodeIds.includes(node.id) || Boolean(node.enemyId && node.enemyId === boss.enemyId);
}

function isMingtuBossSegment(run = {}, step = run.currentRouteStep ?? run.floor) {
  const boss = getMingtuLegacyRoute(run)?.boss;
  return Boolean(boss && Number(step) === boss.legacyStep);
}

function resolveMingtuLegacyContext(run = {}) {
  const route = getMingtuLegacyRoute(run);
  const act = route ? getMingtuActById(route.actId) : null;
  const node = route?.nodes.find((entry) => entry.legacyNodeIds.includes(run.currentNode?.id)) || null;
  const isBoss = isMingtuBossNode(run, run.currentNode);
  const atLegacyFinal = Boolean(route?.legacyLayer === 3 && run.status === "cleared" && isBoss);
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
