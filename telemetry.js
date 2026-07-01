(function () {
  "use strict";

  const endpoint = window.NMG_TELEMETRY_ENDPOINT || "";
  if (!endpoint) return;

  const STORAGE_VISITOR = "nmg.telemetry.visitorId";
  const STORAGE_OPTOUT = "nmg.telemetry.optOut";
  const SESSION_KEY = "nmg.telemetry.sessionId";
  const HEARTBEAT_MS = 30000;

  if (localStorage.getItem(STORAGE_OPTOUT) === "1") return;

  const nowId = () => {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  };

  const visitorId = (() => {
    try {
      const current = localStorage.getItem(STORAGE_VISITOR);
      if (current) return current;
      const created = `v-${nowId()}`;
      localStorage.setItem(STORAGE_VISITOR, created);
      return created;
    } catch {
      return `v-${nowId()}`;
    }
  })();

  const sessionId = (() => {
    try {
      const current = sessionStorage.getItem(SESSION_KEY);
      if (current) return current;
      const created = `s-${nowId()}`;
      sessionStorage.setItem(SESSION_KEY, created);
      return created;
    } catch {
      return `s-${nowId()}`;
    }
  })();

  const device = (() => {
    const coarse = matchMedia("(pointer: coarse)").matches;
    const narrow = Math.min(innerWidth, innerHeight) < 700;
    if (coarse && narrow) return "mobile";
    if (coarse) return "tablet";
    return "desktop";
  })();

  let started = false;
  let timer = 0;

  function payload(type, extra) {
    return {
      type,
      visitorId,
      sessionId,
      build: window.__NMG_BUILD__ || "",
      version: window.NMG_GAME_VERSION || window.GAME_VERSION || "",
      device,
      path: location.pathname + location.search,
      referrer: document.referrer || "",
      extra: extra || {},
    };
  }

  function send(type, extra) {
    const body = JSON.stringify(payload(type, extra));
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }
    } catch {}
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(() => {});
    } catch {}
  }

  function heartbeat() {
    if (document.visibilityState === "hidden") return;
    send("heartbeat");
  }

  function markStart(source) {
    if (started) return;
    started = true;
    send("game_start", { source });
  }

  function bindStartButtons() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("#startBattleButton, [data-action='startRun'], .start-button")) {
        markStart("start_button");
      }
    }, true);
  }

  window.NMGTelemetry = Object.freeze({
    markStart,
    send,
    visitorId,
    sessionId,
  });

  send("visit");
  bindStartButtons();
  timer = window.setInterval(heartbeat, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", heartbeat);
  window.addEventListener("pagehide", () => send("heartbeat"));
  window.addEventListener("beforeunload", () => {
    if (timer) window.clearInterval(timer);
    send("heartbeat");
  });
})();
