"use strict";
/* PVE 因果纵深纯规则模块。
 * 只接收普通对象并返回不可变结果；不访问 DOM、存档、网络，也不直接修改 runState/game。
 * 具体事件回响与敌人机制在后续任务中按同一信号合同扩展。
 */
(function attachPveMechanics(global) {
  const ECHO_KINDS = new Set(["restlessEgg", "steleTrial", "caravanPursuit", "poisonShadow"]);
  const SIGNAL_KINDS = new Set([
    "battle_start",
    "card_resolved",
    "enemy_damaged",
    "player_turn_end",
    "enemy_action_start",
    "enemy_action_end",
    "charge_interrupted",
    "blood_gap_hit",
    "poison_converted",
    "lifesteal_attack",
    "armor_broken",
    "enemy_enraged",
    "corpse_disk_phase_warning",
    "corpse_disk_phase_transition",
    "block_purged",
    "blood_gap_armed",
    "self_bleed",
    "layer2_boss_phase_warning",
    "layer2_boss_phase_transition",
    "commander_marked",
    "swarm_counter_window",
    "mupan_habit_warning",
    "mupan_habit_window",
    "tian_mechanic_warning",
    "tian_phase_warning",
    "tian_phase_transition",
    "battle_end",
  ]);
  const EMPTY_EFFECTS = Object.freeze([]);
  const EVENT_ECHO_DEFINITIONS = Object.freeze({
    "restlessEgg:cardNextHurt": Object.freeze({ kind: "restlessEgg" }),
    "brokenStele:attackInsight": Object.freeze({ kind: "steleTrial" }),
    "brokenBridgeCaravan:stealMaterialEnemyBuff": Object.freeze({ kind: "caravanPursuit" }),
    "poisonPondReflection:poisonBloodResidue": Object.freeze({ kind: "poisonShadow" }),
  });
  const ENEMY_LESSON_DEFINITIONS = Object.freeze({
    shanxiao: Object.freeze({ id: "interrupt_shanxiao" }),
    brokenMeridianGu: Object.freeze({ id: "blood_gap" }),
    miasmaParasite: Object.freeze({ id: "poison_reversal" }),
    bloodMudGolem: Object.freeze({ id: "block_lifesteal" }),
    skeletonPuppetGu: Object.freeze({ id: "break_and_interrupt" }),
    chaosSwarmHordeGu: Object.freeze({ id: "slow_hand" }),
  });
  const PRESSURE = Object.freeze({
    normal: Object.freeze({ mode: "normal", intensity: 1, maxPrimary: 1, maxSecondary: 0 }),
    elite: Object.freeze({ mode: "elite", intensity: 1.15, maxPrimary: 1, maxSecondary: 1 }),
  });
  const PRESSURE_CONFLICTS = Object.freeze([
    Object.freeze(["draw_reduction", "hand_size_reduction"]),
    Object.freeze(["energy_reduction", "hand_size_reduction"]),
  ]);

  function normalizeEchoes(raw) {
    return Object.freeze((Array.isArray(raw) ? raw : [])
      .filter((item) => item && ECHO_KINDS.has(item.kind) && item.settled !== true)
      .map((item) => Object.freeze({
        id: String(item.id || ""),
        sourceEventId: String(item.sourceEventId || ""),
        kind: item.kind,
        target: String(item.target || "next_battle"),
        remaining: Math.max(0, Number(item.remaining) | 0),
        started: item.started === true,
        triggered: item.triggered === true,
        markedCardId: String(item.markedCardId || ""),
        markedCardPlayed: item.markedCardPlayed === true,
        settled: false,
      })));
  }

  function getEventEchoBalance(kind) {
    if (typeof PVE_CAUSAL_BALANCE === "undefined") return Object.freeze({});
    return PVE_CAUSAL_BALANCE.eventEchoes?.[kind] || Object.freeze({});
  }

  function createEventEcho(eventId, optionKind, nonce, context) {
    const definition = EVENT_ECHO_DEFINITIONS[`${String(eventId || "")}:${String(optionKind || "")}`];
    if (!definition) return null;
    const extra = context && typeof context === "object" ? context : {};
    return Object.freeze({
      id: `${String(nonce || "echo")}:${definition.kind}`,
      sourceEventId: String(eventId || ""),
      kind: definition.kind,
      target: "next_battle",
      remaining: 1,
      started: false,
      triggered: false,
      markedCardId: String(extra.markedCardId || ""),
      markedCardPlayed: false,
      settled: false,
    });
  }

  function eventEchoResult(echo, effects, receipt) {
    return Object.freeze({
      echo: Object.freeze(echo),
      effects: Object.freeze(effects.map((effect) => Object.freeze(effect))),
      receipt: receipt || null,
    });
  }

  function completeEventEcho(echo, effects, receipt) {
    return eventEchoResult({ ...echo, remaining: 0, settled: true }, [...effects, { op: "complete" }], receipt);
  }

  function reduceEventEcho(echo, signal) {
    if (!echo || echo.settled === true || !signal || !SIGNAL_KINDS.has(signal.kind)) {
      return eventEchoResult(echo || {}, [], null);
    }
    const balance = getEventEchoBalance(echo.kind);
    if (signal.kind === "battle_start") {
      if (echo.started === true) return eventEchoResult(echo, [], null);
      const next = { ...echo, started: true };
      if (echo.kind === "restlessEgg" || echo.kind === "poisonShadow") {
        return eventEchoResult(next, [{ op: "playerHpLoss", amount: Math.max(0, Number(balance.openingHpLoss) || 0) }], "开战反噬");
      }
      if (echo.kind === "caravanPursuit") {
        return eventEchoResult(next, [{ op: "enemyAttackBonus", amount: Math.max(0, Number(balance.enemyAttackBonus) || 0) }], "商队追索");
      }
      return eventEchoResult(next, [], null);
    }
    if (signal.kind === "card_resolved") {
      if (echo.kind === "steleTrial" && echo.markedCardId && String(signal.cardId || "") === echo.markedCardId) {
        return eventEchoResult({ ...echo, markedCardPlayed: true }, [], "残碑试诀已出手");
      }
      if (echo.kind === "poisonShadow" && echo.started === true && echo.triggered !== true && Number(signal.damage) > 0) {
        return completeEventEcho(
          { ...echo, triggered: true },
          [{ op: "enemyPoison", amount: Math.max(0, Number(balance.firstDamagePoison) || 0) }],
          "毒影借身已触发",
        );
      }
      return eventEchoResult(echo, [], null);
    }
    if (signal.kind === "battle_end") {
      const won = signal.won === true;
      if (echo.kind === "restlessEgg" && won) {
        return completeEventEcho(echo, [{
          op: "grantMaterial",
          materialId: String(balance.winMaterialId || "insectMolt"),
          amount: Math.max(1, Number(balance.winMaterialAmount) || 1),
        }], "躁动蛊卵已孵定");
      }
      if (echo.kind === "steleTrial" && won && echo.markedCardPlayed === true) {
        return completeEventEcho(echo, [{ op: "grantStones", amount: Math.max(0, Number(balance.winStones) || 0) }], "残碑试诀完成");
      }
      if (echo.kind === "caravanPursuit" && won) {
        return completeEventEcho(echo, [{ op: "grantStones", amount: Math.max(0, Number(balance.winStones) || 0) }], "商队追索已断");
      }
      return completeEventEcho(echo, [], won ? "回响已散" : "败局断因");
    }
    return eventEchoResult(echo, [], null);
  }

  function getEnemyLessonBalance() {
    if (typeof PVE_CAUSAL_BALANCE === "undefined") return Object.freeze({});
    return PVE_CAUSAL_BALANCE.enemyLessons || Object.freeze({});
  }

  function getExpansionMechanicBalance() {
    if (typeof PVE_CAUSAL_BALANCE === "undefined") return Object.freeze({});
    return PVE_CAUSAL_BALANCE.expansionMechanics || Object.freeze({});
  }

  function getModePressureBalance() {
    if (typeof PVE_CAUSAL_BALANCE === "undefined") return Object.freeze({});
    return PVE_CAUSAL_BALANCE.modePressure || Object.freeze({});
  }

  function freezeEnemyLesson(lesson) {
    return Object.freeze({
      ...lesson,
      progress: Object.freeze({ ...(lesson.progress || {}) }),
    });
  }

  function createEnemyLesson(enemyId) {
    const definition = ENEMY_LESSON_DEFINITIONS[String(enemyId || "")];
    if (!definition) return null;
    return freezeEnemyLesson({
      id: definition.id,
      enemyId: String(enemyId),
      state: "active",
      rewarded: false,
      progress: {
        interrupted: false,
        bloodGapHit: false,
        poisonConverted: false,
        poisonWindowTurns: 0,
        lifestealBlocked: false,
        armorBroken: false,
        slowTurns: 0,
      },
    });
  }

  function enemyLessonResult(lesson, effects, progress) {
    return Object.freeze({
      lesson: freezeEnemyLesson(lesson),
      effects: Object.freeze(effects.map((effect) => Object.freeze(effect))),
      progress: progress || null,
    });
  }

  function reduceEnemyLesson(rawLesson, signal) {
    if (!rawLesson || !signal || !SIGNAL_KINDS.has(signal.kind)) {
      return enemyLessonResult(rawLesson || {}, [], null);
    }
    const balance = getEnemyLessonBalance();
    const progress = { ...(rawLesson.progress || {}) };
    let state = rawLesson.state === "completed" ? "completed" : "active";
    const effects = [];
    if (signal.kind === "charge_interrupted") {
      if (rawLesson.id === "interrupt_shanxiao"
        && Number(signal.threshold) >= Math.max(1, Number(balance.shanxiaoInterruptThreshold) || 1)) {
        progress.interrupted = true;
        state = "completed";
      }
      if (rawLesson.id === "break_and_interrupt"
        && Number(signal.threshold) >= Math.max(1, Number(balance.skeletonInterruptThreshold) || 1)) {
        progress.interrupted = true;
        if (progress.armorBroken) state = "completed";
      }
    } else if (signal.kind === "blood_gap_hit" && rawLesson.id === "blood_gap") {
      progress.bloodGapHit = true;
      state = "completed";
    } else if (signal.kind === "poison_converted" && rawLesson.id === "poison_reversal") {
      progress.poisonConverted = true;
      progress.poisonWindowTurns = Math.max(1, Number(balance.poisonWindowTurns) || 1);
    } else if (signal.kind === "lifesteal_attack" && rawLesson.id === "block_lifesteal") {
      if (Number(signal.received) <= 0) {
        progress.lifestealBlocked = true;
        state = "completed";
      }
    } else if (signal.kind === "armor_broken" && rawLesson.id === "break_and_interrupt") {
      progress.armorBroken = true;
      if (progress.interrupted) state = "completed";
    } else if (signal.kind === "player_turn_end") {
      if (rawLesson.id === "slow_hand") {
        const cap = Math.max(1, Number(balance.slowHandMaxCards) || 1);
        progress.slowTurns = Number(signal.cardsPlayed) <= cap ? Math.min(2, (Number(progress.slowTurns) || 0) + 1) : 0;
      }
      if (rawLesson.id === "poison_reversal" && progress.poisonWindowTurns > 0) {
        progress.poisonWindowTurns = Math.max(0, progress.poisonWindowTurns - 1);
      }
    }
    if (signal.kind === "battle_end" && signal.won === true) {
      if (rawLesson.id === "poison_reversal" && progress.poisonConverted
        && signal.killedByPoison === true
        && Number(signal.turnsSinceConvert) <= Math.max(1, Number(balance.poisonWindowTurns) || 1)) state = "completed";
      if (rawLesson.id === "slow_hand" && Number(progress.slowTurns) >= Math.max(1, Number(balance.slowHandTurns) || 1)) state = "completed";
    }
    const next = { ...rawLesson, state, progress };
    if (signal.kind === "battle_end" && signal.won === true && state === "completed" && rawLesson.rewarded !== true) {
      next.rewarded = true;
      effects.push({ op: "grantStones", amount: Math.max(0, Number(balance.rewardStones) || 3) });
    }
    return enemyLessonResult(next, effects, state === "completed" ? "completed" : progress);
  }

  function getModePressure(context) {
    const input = context && typeof context === "object" ? context : {};
    if (input.mode === "tian") {
      const tier = Math.max(1, Number(input.tier) || 1);
      return Object.freeze({ mode: "tian", intensity: tier, maxPrimary: 1, maxSecondary: tier >= 4 ? 1 : 0 });
    }
    if (input.mode === "endless") {
      const floor = Math.max(1, Number(input.floor) || 1);
      return Object.freeze({ mode: "endless", intensity: floor, maxPrimary: 1, maxSecondary: floor >= 6 ? 1 : 0 });
    }
    const configured = getModePressureBalance()[input.mode];
    if (configured) {
      return Object.freeze({
        mode: input.mode,
        intensity: Math.max(0, Number(configured.intensity) || 1),
        maxPrimary: Math.max(0, Number(configured.maxPrimary) || 0),
        maxSecondary: Math.max(0, Number(configured.maxSecondary) || 0),
      });
    }
    return PRESSURE[input.mode] || PRESSURE.normal;
  }

  function validatePressureRules(rawRules) {
    const accepted = [];
    const rejected = [];
    (Array.isArray(rawRules) ? rawRules : []).map((rule) => String(rule || "")).filter(Boolean).forEach((rule) => {
      const passiveDot = /_dot$/.test(rule);
      const conflicts = PRESSURE_CONFLICTS.some((pair) => pair.includes(rule) && pair.some((entry) => accepted.includes(entry)));
      const duplicateDot = passiveDot && accepted.some((entry) => /_dot$/.test(entry));
      if (conflicts || duplicateDot) rejected.push(rule);
      else accepted.push(rule);
    });
    return Object.freeze({ accepted: Object.freeze(accepted), rejected: Object.freeze(rejected) });
  }

  /* 无尽和十重天共用同一份冲突校验：先走既有规则家族去重/互斥，
   * 再对无尽明确的三类硬压力做上限。返回原对象，以便选择结果就是实际生效集合。 */
  function validatePressureBudget(rawEntries) {
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const legacy = validatePressureRules(entries.map((entry) => String(entry?.pressureFamily || entry?.id || "")));
    const blockedIds = new Set(legacy.rejected);
    const accepted = [];
    const rejected = [];
    const counts = { resource_lock: 0, hand_lock: 0, passive_damage: 0 };
    entries.forEach((entry) => {
      const category = String(entry?.pressureCategory || "edge");
      const identity = String(entry?.pressureFamily || entry?.id || "");
      const overBudget = Object.prototype.hasOwnProperty.call(counts, category) && counts[category] >= 1;
      if (blockedIds.has(identity) || overBudget) {
        rejected.push(entry);
        return;
      }
      accepted.push(entry);
      if (Object.prototype.hasOwnProperty.call(counts, category)) counts[category] += 1;
    });
    return Object.freeze({ accepted: Object.freeze(accepted), rejected: Object.freeze(rejected) });
  }

  function planModePressure(context, primaryFamily, rawSecondary) {
    const pressure = getModePressure(context);
    const primary = String(primaryFamily || "");
    const requested = validatePressureRules(rawSecondary);
    const compatible = getModePressureBalance().compatibleSecondaries?.[primary] || [];
    const secondary = [];
    const rejected = [...requested.rejected];
    requested.accepted.forEach((rule) => {
      if (secondary.length >= pressure.maxSecondary || !compatible.includes(rule)) rejected.push(rule);
      else secondary.push(rule);
    });
    return Object.freeze({
      pressure,
      primary: Object.freeze(primary && pressure.maxPrimary > 0 ? [primary] : []),
      secondary: Object.freeze(secondary),
      rejected: Object.freeze(rejected),
    });
  }

  function applyModePressureToAction(rawAction, pressurePlan, secondaryEffects) {
    const action = rawAction && typeof rawAction === "object" ? rawAction : {};
    const plan = pressurePlan && typeof pressurePlan === "object" ? pressurePlan : null;
    const effectMap = secondaryEffects && typeof secondaryEffects === "object" ? secondaryEffects : null;
    if (!plan || !effectMap) return action;
    const allowed = new Set(Array.isArray(plan.secondary) ? plan.secondary : []);
    let filtered = null;
    Object.entries(effectMap).forEach(([family, fields]) => {
      if (allowed.has(family)) return;
      (Array.isArray(fields) ? fields : []).forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(action, field)) return;
        if (!filtered) filtered = { ...action };
        delete filtered[field];
      });
    });
    return filtered ? Object.freeze(filtered) : action;
  }

  // 十重天仍走与 Task9 相同的白名单冲突契约；这里仅承接已经由 runState
  // 确认的选择，确保意图与结算读取同一份实际动作。
  function applyTianMechanicToRuntimeAction(rawAction, selection, phaseActive) {
    if (typeof global.applyTianMechanicToAction !== "function") return rawAction;
    return global.applyTianMechanicToAction(rawAction, selection, phaseActive);
  }

  function applyEndlessVariantToRuntimeAction(rawAction, variants) {
    if (typeof global.applyEndlessVariantToRuntimeAction !== "function") return rawAction;
    return global.applyEndlessVariantToRuntimeAction(rawAction, variants);
  }

  function settleHandSizeCap(rawHand, targetSize) {
    const hand = Array.isArray(rawHand) ? rawHand.slice() : [];
    const cap = Math.max(1, Number(targetSize) || 1);
    return Object.freeze({
      hand: Object.freeze(hand.slice(0, cap)),
      discarded: Object.freeze(hand.slice(cap)),
    });
  }

  function hasRequiredMechanicActionCapability(definition, pressurePlan) {
    const source = definition && typeof definition === "object" ? definition : {};
    const requiredFields = Array.isArray(source.mechanicRequiredActionFields)
      ? source.mechanicRequiredActionFields.map((field) => String(field || "")).filter(Boolean)
      : [];
    if (!requiredFields.length) return true;
    return Object.values(source.actions || {}).some((rawAction) => {
      const action = applyModePressureToAction(rawAction, pressurePlan, source.pressureSecondaryEffects);
      return requiredFields.every((field) => Boolean(action[field]));
    });
  }

  function createBattleMechanic(enemyId, definition, context) {
    const source = definition && typeof definition === "object" ? definition : {};
    const pressurePlan = planModePressure(context, source.pressurePrimary, source.pressureSecondary);
    return Object.freeze({
      enemyId: String(enemyId || ""),
      profileId: String(source.mechanicProfile || ""),
      handler: String(source.mechanicHandler || ""),
      triggerSignal: String(source.mechanicTrigger || ""),
      warningSignal: String(source.mechanicWarningSignal || "layer2_boss_phase_warning"),
      transitionSignal: String(source.mechanicTransitionSignal || "layer2_boss_phase_transition"),
      identity: String(source.mechanicIdentity || ""),
      counter: String(source.mechanicCounter || ""),
      counterEffect: String(source.mechanicCounterEffect || ""),
      pressurePlan,
      state: source.mechanicProfile && source.mechanicHandler && hasRequiredMechanicActionCapability(source, pressurePlan) ? "active" : "inactive",
      counters: Object.freeze({}),
      progress: Object.freeze({ markArmed: false, stacks: 0, windowOpen: false, phaseWarning: false, phaseTransitioned: false }),
      pressure: getModePressure(context),
    });
  }

  function interrupt(state, signal) {
    return signal.kind === "charge_interrupted" && Number(signal.threshold) > 0;
  }

  function armor_gate(state, signal) {
    return signal.kind === "armor_broken";
  }

  function lifesteal_block(state, signal) {
    return signal.kind === "lifesteal_attack" && Number(signal.received) <= 0;
  }

  function stack_growth(state, signal, balance) {
    const progress = { ...(state.progress || {}) };
    if (signal.kind === "enemy_action_end") {
      progress.stacks = Math.max(0, Number(progress.stacks) || 0) + 1;
      return { progress, countered: false, effects: [{ op: "mechanic_stack_gained", profileId: state.profileId }] };
    }
    return {
      progress,
      countered: signal.kind === "enemy_damaged"
        && Number(progress.stacks) > 0
        && Number(signal.damage) >= Math.max(1, Number(balance.minimumCounterDamage) || 1),
    };
  }

  function mark_then_strike(state, signal) {
    const progress = { ...(state.progress || {}) };
    if (signal.kind === "enemy_action_start" && signal.actionKind === "attack") {
      progress.markArmed = true;
      return { progress, countered: false, effects: [{ op: "mark_applied", profileId: state.profileId }] };
    }
    const markedStrikeEnded = signal.kind === "enemy_action_end" && progress.markArmed === true;
    if (markedStrikeEnded) progress.markArmed = false;
    return {
      progress,
      countered: markedStrikeEnded && Number(signal.received) <= 0,
      effects: markedStrikeEnded ? [{ op: "clear_mark", profileId: state.profileId }] : [],
    };
  }

  function burst_window(state, signal, balance) {
    const progress = { ...(state.progress || {}) };
    if (signal.kind === "enemy_action_start" && (signal.actionKind === "charge" || signal.actionKind === "defend")) {
      progress.windowOpen = true;
      return { progress, countered: false, effects: [{ op: "window_open", profileId: state.profileId }] };
    }
    if (signal.kind === "player_turn_end" && progress.windowOpen === true) {
      progress.windowOpen = false;
      return { progress, countered: false, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    return {
      progress,
      countered: signal.kind === "enemy_damaged"
        && progress.windowOpen === true
        && Number(signal.damage) >= Math.max(1, Number(balance.minimumCounterDamage) || 1),
    };
  }

  function boss_phase_window(state, signal, balance) {
    const progress = { ...(state.progress || {}) };
    if (signal.kind === state.warningSignal && progress.phaseWarning !== true) {
      progress.phaseWarning = true;
      return { progress, countered: false, effects: [{ op: "boss_phase_warning", profileId: state.profileId }] };
    }
    if (signal.kind === state.transitionSignal && progress.phaseTransitioned !== true) {
      progress.phaseTransitioned = true;
      progress.windowOpen = true;
      return { progress, countered: false, effects: [{ op: "window_open", profileId: state.profileId }] };
    }
    if (signal.kind === "player_turn_end" && progress.windowOpen === true) {
      progress.windowOpen = false;
      return { progress, countered: false, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    if (signal.kind === "enemy_damaged"
      && progress.windowOpen === true
      && Number(signal.damage) >= Math.max(1, Number(balance.minimumCounterDamage) || 1)) {
      progress.windowOpen = false;
      return { progress, countered: true, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    return { progress, countered: false, effects: [] };
  }

  function corpse_disk_phase(state, signal, balance) {
    const progress = { ...(state.progress || {}) };
    if (signal.kind === "corpse_disk_phase_warning" && progress.phaseWarning !== true) {
      progress.phaseWarning = true;
      return { progress, countered: false, effects: [{ op: "boss_phase_warning", profileId: state.profileId }] };
    }
    if (signal.kind === "corpse_disk_phase_transition" && progress.phaseTransitioned !== true) {
      progress.phaseTransitioned = true;
      progress.windowOpen = true;
      return { progress, countered: false, effects: [{ op: "window_open", profileId: state.profileId }] };
    }
    if (signal.kind === "player_turn_end" && progress.windowOpen === true) {
      progress.windowOpen = false;
      return { progress, countered: false, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    const countered = signal.kind === "enemy_damaged"
      && progress.windowOpen === true
      && Number(signal.damage) >= Math.max(1, Number(balance.minimumCounterDamage) || 1);
    if (countered) progress.windowOpen = false;
    return {
      progress,
      countered,
      effects: countered ? [{ op: "window_closed", profileId: state.profileId }] : [],
    };
  }

  function enrage_window(state, signal, balance) {
    const progress = { ...(state.progress || {}) };
    if (signal.kind === "enemy_enraged") {
      if (progress.windowOpen === true) return { progress, countered: false, effects: [] };
      progress.windowOpen = true;
      return { progress, countered: false, effects: [{ op: "window_open", profileId: state.profileId }] };
    }
    if (signal.kind === "player_turn_end" && progress.windowOpen === true) {
      progress.windowOpen = false;
      return { progress, countered: false, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    if (signal.kind === "enemy_damaged"
      && progress.windowOpen === true
      && Number(signal.damage) >= Math.max(1, Number(balance.minimumCounterDamage) || 1)) {
      progress.windowOpen = false;
      return { progress, countered: true, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    return { progress, countered: false, effects: [] };
  }

  function trigger_window(state, signal, balance) {
    const progress = { ...(state.progress || {}) };
    if (signal.kind === state.triggerSignal) {
      if (progress.windowOpen === true) return { progress, countered: false, effects: [] };
      progress.windowOpen = true;
      return { progress, countered: false, effects: [{ op: "window_open", profileId: state.profileId }] };
    }
    if (signal.kind === "player_turn_end" && progress.windowOpen === true) {
      progress.windowOpen = false;
      return { progress, countered: false, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    if (signal.kind === "enemy_damaged"
      && progress.windowOpen === true
      && Number(signal.damage) >= Math.max(1, Number(balance.minimumCounterDamage) || 1)) {
      progress.windowOpen = false;
      return { progress, countered: true, effects: [{ op: "window_closed", profileId: state.profileId }] };
    }
    return { progress, countered: false, effects: [] };
  }

  const MECHANIC_HANDLERS = Object.freeze({ interrupt, armor_gate, lifesteal_block, stack_growth, mark_then_strike, burst_window, enrage_window, corpse_disk_phase, boss_phase_window, trigger_window });

  function applyMechanicEffects(enemy, effects) {
    const next = { ...(enemy && typeof enemy === "object" ? enemy : {}) };
    const balance = getExpansionMechanicBalance();
    (Array.isArray(effects) ? effects : []).forEach((effect) => {
      if (!effect || typeof effect !== "object") return;
      if (effect.op === "mechanic_stack_gained") {
        next.mechanicStacks = Math.min(Math.max(1, Number(balance.maximumStacks) || 1), (Number(next.mechanicStacks) || 0) + 1);
      } else if (effect.op === "clear_charge") {
        next.chargedBonus = 0;
        next.charging = false;
        next.currentInterruptThreshold = 0;
        next.mechanicBurstWindow = false;
      } else if (effect.op === "clear_stacks") {
        next.mechanicStacks = 0;
      } else if (effect.op === "mark_applied") {
        next.mechanicMarked = true;
      } else if (effect.op === "clear_mark") {
        next.mechanicMarked = false;
      } else if (effect.op === "clear_command") {
        next.commanderEffect = 0;
      } else if (effect.op === "clear_counter") {
        next.counterArmed = false;
      } else if (effect.op === "window_open") {
        next.mechanicBurstWindow = true;
      } else if (effect.op === "window_closed") {
        next.mechanicBurstWindow = false;
      } else if (effect.op === "clear_armor") {
        next.armor = 0;
      } else if (effect.op === "weaken_next_attack") {
        next.mechanicAttackPenalty = Math.max(Number(next.mechanicAttackPenalty) || 0, Math.max(1, Number(balance.counterAttackPenalty) || 1));
      }
    });
    return Object.freeze(next);
  }

  function reduceMechanic(state, signal) {
    if (!state || !signal || !SIGNAL_KINDS.has(signal.kind)) {
      return Object.freeze({ state, effects: EMPTY_EFFECTS, progress: null });
    }
    if (state.state !== "active" || !MECHANIC_HANDLERS[state.handler]) {
      return Object.freeze({ state, effects: EMPTY_EFFECTS, progress: state.progress || null });
    }
    const outcome = MECHANIC_HANDLERS[state.handler](state, signal, getExpansionMechanicBalance());
    const normalized = typeof outcome === "boolean" ? { countered: outcome, progress: state.progress || {}, effects: [] } : outcome;
    const progress = Object.freeze({ ...(normalized.progress || state.progress || {}) });
    if (normalized.countered !== true) {
      const effects = Object.freeze((normalized.effects || []).map((effect) => Object.freeze(effect)));
      return Object.freeze({ state: Object.freeze({ ...state, progress }), effects, progress });
    }
    const next = Object.freeze({ ...state, state: "countered", progress });
    const effects = [
      { op: "mechanic_countered", profileId: state.profileId },
      ...(normalized.effects || []),
    ];
    if (state.counterEffect) effects.push({ op: state.counterEffect, profileId: state.profileId });
    return Object.freeze({ state: next, effects: Object.freeze(effects.map((effect) => Object.freeze(effect))), progress });
  }

  global.NmgPveMechanics = Object.freeze({
    normalizeEchoes,
    createEventEcho,
    reduceEventEcho,
    createEnemyLesson,
    reduceEnemyLesson,
    getModePressure,
    validatePressureRules,
    validatePressureBudget,
    planModePressure,
    applyModePressureToAction,
    applyTianMechanicToRuntimeAction,
    applyEndlessVariantToRuntimeAction,
    settleHandSizeCap,
    createBattleMechanic,
    applyMechanicEffects,
    reduceMechanic,
  });
}(window));
