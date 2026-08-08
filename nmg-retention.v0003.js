(function () {
  "use strict";

  const EVENT_FIELDS = Object.freeze({
    session_start: ["version", "platform", "device_class", "returning_bucket"],
    ftue_step: ["version", "platform", "device_class", "step", "elapsed_bucket", "hero_id"],
    battle_end: ["version", "platform", "device_class", "hero_id", "result", "route_step", "elapsed_bucket", "reason_code"],
    reward_claim: ["version", "platform", "device_class", "reward_type", "route_step", "elapsed_bucket"],
    run_checkpoint: ["version", "platform", "device_class", "checkpoint", "hero_id", "route_step", "elapsed_bucket"],
    run_end: ["version", "platform", "device_class", "hero_id", "result", "route_step", "elapsed_bucket", "reason_code"],
    return_goal_claim: ["version", "platform", "device_class", "goal_type", "returning_bucket", "elapsed_bucket"],
  });
  const FTUE_STEPS = new Set([
    "age_confirm",
    "home_ready",
    "recommended_loadout_confirm",
    "first_card",
    "first_end_turn",
    "first_battle_win",
    "first_reward",
    "first_route_choice",
  ]);
  const COPY_FIELDS = Object.freeze([
    "step",
    "result",
    "route_step",
    "elapsed_bucket",
    "reason_code",
    "reward_type",
    "checkpoint",
    "goal_type",
    "returning_bucket",
    "hero_id",
  ]);

  let sink = null;
  let events = [];

  const HERO_IDS = new Set(["fate", "blood", "poison", "longevity", "dragon", "bone"]);
  const RETRY_FOCUS_RULES = Object.freeze({
    armor_guard: Object.freeze({ label: "复起目标：用防御完整挡下一次重击", target: 1 }),
    damage_tempo: Object.freeze({ label: "复起目标：前三回合形成稳定伤害节奏", target: 18 }),
    yuan_spend: Object.freeze({ label: "复起目标：把本回合大部分真元转成有效出牌", target: 0.75 }),
    hero_mechanic: Object.freeze({ label: "复起目标：触发一次本命核心机制", target: 1 }),
    safe_cost: Object.freeze({ label: "复起目标：留足生命与寿元退路再结束回合", target: 1 }),
    balanced_turn: Object.freeze({ label: "复起目标：完成一次攻防兼备的回合", target: 1 }),
  });

  function getRetryFocusCode(cause) {
    const text = String(cause || "");
    if (/护甲不足|未打断.*蓄力|连击|抢攻/.test(text)) return "armor_guard";
    if (/伤害不足|僵持|拖战|相位/.test(text)) return "damage_tempo";
    if (/资源未用/.test(text)) return "yuan_spend";
    if (/核心机制未触发/.test(text)) return "hero_mechanic";
    if (/自损透支|寿元焚尽/.test(text)) return "safe_cost";
    return "balanced_turn";
  }

  function createRetryFocus(diagnosis, heroId) {
    if (!diagnosis || !HERO_IDS.has(heroId)) return null;
    const code = getRetryFocusCode(diagnosis.cause);
    const rule = RETRY_FOCUS_RULES[code];
    return Object.freeze({
      code,
      heroId,
      label: rule.label,
      state: "active",
      progress: 0,
      target: rule.target,
    });
  }

  function evaluateRetryFocus(focus, signal) {
    if (!focus || focus.state !== "active") return focus;
    const value = signal && typeof signal === "object" ? signal : {};
    let completed = false;
    let progress = Number(focus.progress) || 0;
    if (focus.code === "armor_guard" && value.kind === "enemy_action_end" && value.enemyHeavy) {
      progress = Number(value.blocked) > 0 && Number(value.received) <= 0 ? 1 : 0;
      completed = progress >= focus.target;
    } else if (focus.code === "damage_tempo" && value.kind === "turn_end" && Number(value.turn) <= 3) {
      progress = Math.max(progress, Number(value.damageTotal) || 0);
      completed = progress >= focus.target;
    } else if (focus.code === "yuan_spend" && value.kind === "turn_end" && Number(value.yuanStart) > 0) {
      progress = Math.max(progress, (Number(value.yuanSpent) || 0) / Number(value.yuanStart));
      completed = progress >= focus.target;
    } else if (focus.code === "hero_mechanic" && value.kind === "hero_mechanic") {
      progress = value.heroId === focus.heroId ? 1 : 0;
      completed = progress >= focus.target;
    } else if (focus.code === "safe_cost" && value.kind === "turn_end") {
      progress = Number(value.hpRatio) >= 0.5 && Number(value.lifespan) >= 3 ? 1 : 0;
      completed = progress >= focus.target;
    } else if (focus.code === "balanced_turn" && value.kind === "turn_end") {
      progress = Number(value.damage) > 0 && Number(value.armorGained) > 0 ? 1 : 0;
      completed = progress >= focus.target;
    }
    return Object.freeze({ ...focus, progress, state: completed ? "completed" : "active" });
  }

  function buildCopyText(items) {
    const lines = ["首程摘要（仅在主动复制时附带）"];
    items.forEach((event, index) => {
      const details = COPY_FIELDS
        .filter((key) => Object.prototype.hasOwnProperty.call(event.properties, key))
        .map((key) => `${key}=${String(event.properties[key])}`);
      lines.push(`${index + 1}. ${event.type}${details.length ? ` · ${details.join(" · ")}` : ""}`);
    });
    return lines.join("\n");
  }

  function emit(type, properties) {
    const allowed = EVENT_FIELDS[type];
    const input = properties && typeof properties === "object" && !Array.isArray(properties) ? properties : {};
    if (!allowed || Object.keys(input).some((key) => !allowed.includes(key))) return false;
    if (type === "ftue_step" && !FTUE_STEPS.has(input.step)) return false;
    const event = Object.freeze({ type, properties: Object.freeze({ ...input }) });
    events = [...events.slice(-63), event];
    if (typeof sink === "function") sink(event);
    return true;
  }

  window.NmgRetention = Object.freeze({
    emit,
    createRetryFocus,
    evaluateRetryFocus,
    setSink(fn) {
      sink = typeof fn === "function" ? fn : null;
    },
    resetSession() {
      events = [];
    },
    getSessionSummary() {
      return { events: events.slice(), copyText: buildCopyText(events) };
    },
  });
})();
