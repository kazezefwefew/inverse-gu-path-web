(function (root) {
  "use strict";

  const queue = [];
  let triggerFocus = null;
  let dismissTimer = null;
  const AUTO_DISMISS_MS = 1700;

  function cancelAutoDismiss() {
    if (dismissTimer != null && typeof root.clearTimeout === "function") root.clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  function scheduleAutoDismiss() {
    cancelAutoDismiss();
    if (typeof root.setTimeout !== "function") return;
    dismissTimer = root.setTimeout(() => {
      dismissTimer = null;
      dismiss();
    }, AUTO_DISMISS_MS);
  }

  function nodes() {
    if (!root.document || typeof root.document.getElementById !== "function") return null;
    const result = {
      overlay: root.document.getElementById("outgameReceiptOverlay"),
      source: root.document.getElementById("outgameReceiptSource"),
      title: root.document.getElementById("outgameReceiptTitle"),
      tone: root.document.getElementById("outgameReceiptTone"),
      items: root.document.getElementById("outgameReceiptItems"),
      summary: root.document.getElementById("outgameReceiptSummary"),
    };
    return Object.values(result).every(Boolean) ? result : null;
  }

  function text(value) {
    return value == null ? "" : String(value);
  }

  function rememberTriggerFocus() {
    const active = root.document && root.document.activeElement;
    triggerFocus = active && typeof active.focus === "function" ? active : null;
  }

  function restoreTriggerFocus() {
    const target = triggerFocus;
    triggerFocus = null;
    if (!target) return;
    try {
      target.focus();
    } catch (_) {
      // A detached trigger must not prevent receipt cleanup.
    }
  }

  function render() {
    const target = nodes();
    const receipt = queue[0];
    if (!target || !receipt) return;

    target.source.textContent = text(receipt.source);
    target.title.textContent = text(receipt.title);
    /* `tone` is an internal palette key used by reward items (jade/gold/blood...).
     * Only an explicit human-readable subtitle may enter the visible copy line. */
    target.tone.textContent = text(receipt.subtitle);
    target.summary.textContent = text(receipt.summary);
    target.items.replaceChildren();
    /* V0.9.54 美化：条目改为「印字 · 名／注 · 数量」三段结构，并按 item.tone 分色。
     * 原本整行塞进一个 textContent，名字/数量/注解没有层级，看着像调试输出。
     * 全程 createElement + textContent，绝不 innerHTML —— 名称来自存档，必须当不可信文本处理。 */
    (Array.isArray(receipt.items) ? receipt.items : []).forEach((item) => {
      const row = root.document.createElement("div");
      const tone = text(item && item.tone).replace(/[^a-z]/gi, "");
      row.className = `outgame-receipt-item${tone ? ` tone-${tone}` : ""}`;
      // 错峰入场交给 CSS :nth-child——不写内联 style，模块才能在最简 DOM 桩里跑门禁
      const glyph = root.document.createElement("span");
      glyph.className = "ogr-glyph";
      glyph.textContent = text(item && item.glyph);
      const body = root.document.createElement("span");
      body.className = "ogr-body";
      const name = root.document.createElement("strong");
      name.textContent = text(item && item.name);
      body.appendChild(name);
      const detail = text(item && item.detail);
      if (detail) {
        const note = root.document.createElement("small");
        note.textContent = detail;
        body.appendChild(note);
      }
      const amount = root.document.createElement("b");
      amount.className = "ogr-amount";
      amount.textContent = `×${text(item && item.amount)}`;
      row.appendChild(glyph);
      row.appendChild(body);
      row.appendChild(amount);
      target.items.appendChild(row);
    });
    target.overlay.hidden = false;
    scheduleAutoDismiss();
  }

  function enqueue(receipt) {
    if (!nodes()) return;
    if (!queue.length) rememberTriggerFocus();
    queue.push(receipt || {});
    if (queue.length === 1) render();
  }

  function dismiss() {
    if (!queue.length) return;
    cancelAutoDismiss();
    queue.shift();
    const target = nodes();
    if (!queue.length) {
      if (target) target.overlay.hidden = true;
      restoreTriggerFocus();
      return;
    }
    render();
  }

  function clear() {
    cancelAutoDismiss();
    queue.length = 0;
    const target = nodes();
    if (target) target.overlay.hidden = true;
    restoreTriggerFocus();
  }

  function isOpen() {
    const target = nodes();
    return Boolean(target && queue.length && !target.overlay.hidden);
  }

  root.NmgOutgameReceipts = { enqueue, dismiss, clear, isOpen, pendingCount: () => queue.length };
})(globalThis);
