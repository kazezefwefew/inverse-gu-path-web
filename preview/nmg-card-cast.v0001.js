(function initNmgCardCast(global) {
  "use strict";

  const FULL_TIMINGS = Object.freeze({ lift: 80, center: 180, reveal: 180, strike: 110, total: 550 });
  const REDUCED_TIMINGS = Object.freeze({ lift: 30, center: 70, reveal: 100, strike: 50, total: 250 });

  function getTimings(reduced) {
    return reduced ? { ...REDUCED_TIMINGS } : { ...FULL_TIMINGS };
  }

  function shouldReduce(options) {
    if (options?.reduced === true) return true;
    try {
      if (global.document?.body?.classList?.contains?.("effects-off")) return true;
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

  function createPhantom(doc, card, side, kind, sourceRect) {
    const phantom = doc.createElement("div");
    phantom.className = `nmg-card-cast-phantom is-${side === "opponent" ? "opponent" : "self"} is-${kind || "support"}`;
    phantom.dataset.cardName = String(card?.name || "蛊牌");
    phantom.dataset.cardArt = String(card?.art || "");
    phantom.style.pointerEvents = "none";
    phantom.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
    phantom.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
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

  async function present(options = {}) {
    let impacted = false;
    const impactOnce = () => {
      if (impacted) return;
      impacted = true;
      try { options.onImpact?.(); } catch (error) { global.console?.error?.(error); }
    };
    const doc = global.document;
    const sourceRect = rectOf(options.source);
    const targetRect = rectOf(options.target);
    const reduced = shouldReduce(options) || !doc || !sourceRect || !targetRect;
    if (!doc || !sourceRect || !targetRect || typeof doc.createElement !== "function") {
      impactOnce();
      return { completed: true, reduced: true };
    }

    const timings = getTimings(reduced);
    const source = centerOf(sourceRect);
    const target = centerOf(targetRect);
    const viewportWidth = Number(global.innerWidth) || Math.max(source.x, target.x) * 2 || 844;
    const viewportHeight = Number(global.innerHeight) || Math.max(source.y, target.y) * 2 || 390;
    const center = { x: viewportWidth * 0.5, y: viewportHeight * 0.46 };
    const layer = ensureLayer(doc);
    const phantom = createPhantom(doc, options.card, options.side, options.kind, sourceRect);
    layer.appendChild(phantom);
    phantom.style.transform = `translate(-50%, -50%) translate(${source.x}px, ${source.y}px) scale(.86)`;
    phantom.style.opacity = "0";

    try {
      await animateTo(phantom, { x: source.x, y: source.y - (reduced ? 4 : 18) }, timings.lift, 1.02, 1);
      await animateTo(phantom, center, timings.center, reduced ? 1.02 : 1.16, 1);
      phantom.classList?.add?.("is-revealed");
      await wait(timings.reveal);
      await animateTo(phantom, target, timings.strike, reduced ? 0.92 : 0.72, 0.12);
      impactOnce();
      phantom.classList?.add?.("is-impact");
      await wait(reduced ? 20 : 70);
    } finally {
      impactOnce();
      phantom.remove?.();
    }
    return { completed: true, reduced };
  }

  global.NmgCardCast = Object.freeze({ present, getTimings });
})(typeof window !== "undefined" ? window : globalThis);
