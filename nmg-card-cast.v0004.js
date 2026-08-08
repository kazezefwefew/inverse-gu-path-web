(function initNmgCardCast(global) {
  "use strict";

  const FULL_TIMINGS = Object.freeze({ lift: 40, flight: 110, impact: 80, afterglow: 70, total: 300 });
  const REDUCED_TIMINGS = Object.freeze({ lift: 0, flight: 0, impact: 60, afterglow: 0, total: 60 });
  const FLAVOR_GLYPHS = Object.freeze({
    poison: "瘴", blood: "煞", dragon: "鳞", bone: "骨", fate: "命", longevity: "寿",
    attack: "破", defense: "守", support: "引",
  });

  function getTimings(reduced) {
    return reduced ? { ...REDUCED_TIMINGS } : { ...FULL_TIMINGS };
  }

  function effectsDisabled(options) {
    if (options?.disabled === true) return true;
    try {
      return global.document?.body?.classList?.contains?.("effects-off") === true;
    } catch (error) {
      return false;
    }
  }

  function shouldReduce(options) {
    if (options?.reduced === true) return true;
    try {
      return global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    } catch (error) {
      return false;
    }
  }

  function rectOf(node) {
    if (!node || typeof node.getBoundingClientRect !== "function") return null;
    const rect = node.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
    return rect;
  }

  function centerOf(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function clampPoint(point, viewportWidth, viewportHeight) {
    return {
      x: Math.max(52, Math.min(Math.max(52, viewportWidth - 52), point.x)),
      y: Math.max(70, Math.min(Math.max(70, viewportHeight - 70), point.y)),
    };
  }

  function wait(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, Math.max(0, ms | 0)));
  }

  function ensureLayer(doc) {
    let layer = typeof doc.querySelector === "function" ? doc.querySelector(".nmg-card-cast-layer") : null;
    if (layer) return layer;
    layer = doc.createElement("div");
    layer.className = "nmg-card-cast-layer";
    layer.setAttribute("aria-hidden", "true");
    (doc.body || doc.documentElement).appendChild(layer);
    return layer;
  }

  function clear() {
    const layer = global.document?.querySelector?.(".nmg-card-cast-layer");
    if (!layer) return false;
    if (typeof layer.replaceChildren === "function") layer.replaceChildren();
    else while (layer.firstChild) layer.removeChild(layer.firstChild);
    return true;
  }

  function getFlavor(card, kind) {
    const copy = `${card?.name || ""} ${card?.type || ""} ${card?.school || ""}`;
    if (/毒|瘴|蟒|蜕鳞|腐|蚀/.test(copy)) return "poison";
    if (/血|煞|赤|茧/.test(copy)) return "blood";
    if (/龙|鳞|烬/.test(copy)) return "dragon";
    if (/骨|铃|叩|鸣/.test(copy)) return "bone";
    if (/寿|春|生机|回光|灯芯/.test(copy)) return "longevity";
    if (/命|劫|签|月刃/.test(copy)) return "fate";
    return kind === "attack" || kind === "defense" ? kind : "support";
  }

  function createFxNode(doc, className, flavor, point) {
    const node = doc.createElement("i");
    node.className = `${className} is-${flavor}`;
    node.setAttribute("aria-hidden", "true");
    if (point) {
      node.style.left = `${point.x}px`;
      node.style.top = `${point.y}px`;
    }
    return node;
  }

  function createPhantom(doc, card, side, kind, flavor) {
    const phantom = doc.createElement("div");
    phantom.className = `nmg-card-cast-phantom is-${side === "opponent" ? "opponent" : "self"} is-${kind || "support"} is-${flavor}`;
    phantom.dataset.cardName = String(card?.name || "蛊牌");
    phantom.dataset.cardArt = String(card?.art || "");
    phantom.style.pointerEvents = "none";
    if (card?.art) {
      const art = doc.createElement("i");
      art.className = "nmg-card-cast-art";
      art.style.backgroundImage = `url("${String(card.art).replace(/["\\]/g, "")}")`;
      phantom.appendChild(art);
    }
    const copy = doc.createElement("span");
    copy.className = "nmg-card-cast-copy";
    const turn = Number(card?.turn) > 0 ? ` · ${Math.max(1, Math.min(9, Number(card.turn) | 0))}转` : "";
    copy.textContent = `${card?.name || "蛊牌"}${turn}`;
    phantom.appendChild(copy);
    const sigil = doc.createElement("b");
    sigil.className = "nmg-card-cast-sigil";
    sigil.textContent = FLAVOR_GLYPHS[flavor] || "蛊";
    phantom.appendChild(sigil);
    return phantom;
  }

  function animateTo(node, point, duration, scale, opacity) {
    const transform = `translate(-50%, -50%) translate(${point.x}px, ${point.y}px) scale(${scale})`;
    if (typeof node.animate === "function") {
      const current = node.style.transform || `translate(-50%, -50%) translate(${point.x}px, ${point.y}px) scale(1)`;
      const animation = node.animate([
        { transform: current, opacity: node.style.opacity || "1" },
        { transform, opacity: String(opacity) },
      ], { duration, easing: "cubic-bezier(.2,.78,.2,1)", fill: "forwards" });
      return animation.finished.catch(() => undefined).then(() => {
        node.style.transform = transform;
        node.style.opacity = String(opacity);
      });
    }
    node.style.transform = transform;
    node.style.opacity = String(opacity);
    return wait(duration);
  }

  function animateFlight(node, source, target, duration) {
    const distance = Math.hypot(target.x - source.x, target.y - source.y);
    const arc = Math.max(24, Math.min(46, distance * 0.08));
    const midpoint = {
      x: source.x + (target.x - source.x) * 0.54,
      y: Math.max(70, source.y + (target.y - source.y) * 0.54 - arc),
    };
    const frames = [
      { transform: `translate(-50%, -50%) translate(${source.x}px, ${source.y}px) scale(1.02)`, opacity: "1", offset: 0 },
      { transform: `translate(-50%, -50%) translate(${midpoint.x}px, ${midpoint.y}px) scale(1.05)`, opacity: "1", offset: 0.54 },
      { transform: `translate(-50%, -50%) translate(${target.x}px, ${target.y}px) scale(.74)`, opacity: ".18", offset: 1 },
    ];
    if (typeof node.animate === "function") {
      const animation = node.animate(frames, { duration, easing: "cubic-bezier(.2,.72,.18,1)", fill: "forwards" });
      return animation.finished.catch(() => undefined).then(() => {
        node.style.transform = frames[2].transform;
        node.style.opacity = frames[2].opacity;
      });
    }
    node.style.transform = frames[2].transform;
    node.style.opacity = frames[2].opacity;
    return wait(duration);
  }

  async function present(options = {}) {
    let impacted = false;
    const impactOnce = () => {
      if (impacted) return;
      impacted = true;
      try { options.onImpact?.(); } catch (error) { global.console?.error?.(error); }
    };
    if (effectsDisabled(options)) {
      impactOnce();
      return { completed: true, reduced: true, skipped: true };
    }

    const doc = global.document;
    const sourceRect = rectOf(options.source);
    const targetRect = rectOf(options.target);
    const reduced = shouldReduce(options) || !doc || !sourceRect || !targetRect;
    if (!doc || !sourceRect || !targetRect || typeof doc.createElement !== "function") {
      impactOnce();
      return { completed: true, reduced: true, skipped: false };
    }

    const timings = getTimings(reduced);
    const rawSource = centerOf(sourceRect);
    const rawTarget = centerOf(targetRect);
    const viewportWidth = Number(global.innerWidth) || Math.max(rawSource.x, rawTarget.x) * 2 || 844;
    const viewportHeight = Number(global.innerHeight) || Math.max(rawSource.y, rawTarget.y) * 2 || 390;
    const source = clampPoint(rawSource, viewportWidth, viewportHeight);
    const target = clampPoint(rawTarget, viewportWidth, viewportHeight);
    const layer = ensureLayer(doc);
    const kind = options.kind === "attack" || options.kind === "defense" ? options.kind : "support";
    const flavor = getFlavor(options.card, kind);
    const phantom = createPhantom(doc, options.card, options.side, kind, flavor);
    layer.appendChild(phantom);
    phantom.style.setProperty?.("--cast-flight-angle", `${Math.atan2(target.y - source.y, target.x - source.x)}rad`);
    phantom.style.transform = `translate(-50%, -50%) translate(${source.x}px, ${source.y}px) scale(.86)`;
    phantom.style.opacity = "0";

    if (reduced) {
      phantom.classList?.add?.("is-reduced", "is-revealed");
      phantom.style.transform = `translate(-50%, -50%) translate(${target.x}px, ${target.y}px) scale(.9)`;
      phantom.style.opacity = "1";
      try {
        impactOnce();
        phantom.classList?.add?.("is-impact");
        await wait(timings.impact);
      } finally {
        impactOnce();
        phantom.remove?.();
      }
      return { completed: true, reduced: true, skipped: false };
    }

    const impact = createFxNode(doc, "nmg-card-cast-impact", flavor, target);
    const afterglow = createFxNode(doc, "nmg-card-cast-afterglow", flavor, target);
    layer.appendChild(impact);
    layer.appendChild(afterglow);

    try {
      await animateTo(phantom, { x: source.x, y: source.y - (reduced ? 4 : 18) }, timings.lift, 1.02, 1);
      phantom.classList?.add?.("is-lifted");
      phantom.classList?.add?.("is-flying", "is-revealed");
      await animateFlight(phantom, { x: source.x, y: source.y - 18 }, target, timings.flight);
      phantom.classList?.remove?.("is-flying");
      impactOnce();
      phantom.classList?.add?.("is-impact");
      impact.classList?.add?.("is-active");
      afterglow.classList?.add?.("is-active");
      await wait(timings.impact);
      phantom.remove?.();
      impact.remove?.();
      await wait(timings.afterglow);
    } finally {
      impactOnce();
      phantom.remove?.();
      impact.remove?.();
      afterglow.remove?.();
    }
    return { completed: true, reduced: false, skipped: false };
  }

  global.NmgCardCast = Object.freeze({ present, clear, getTimings, getFlavor });
})(typeof window !== "undefined" ? window : globalThis);
