(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  let canvas = null;
  let ctx = null;
  let base = null;
  let baseCtx = null;
  let state = null;

  function worldBounds() {
    const visible = M.Model.visibleNodes(M.Model.root);
    const b = M.Layout.bounds(visible);
    const vis = new Set(visible.map((n) => n.id));
    for (const f of M.Model.frames) {
      const geo = M.Render.frameGeometry(f, vis);
      if (!geo) continue;
      b.minX = Math.min(b.minX, geo.x);
      b.minY = Math.min(b.minY, geo.y);
      b.maxX = Math.max(b.maxX, geo.x + geo.w);
      b.maxY = Math.max(b.maxY, geo.y + geo.h);
    }
    return b;
  }

  function drawNode(c, n, theme, scale) {
    const pw = Math.max(n.w * scale, 3);
    const ph = Math.max(n.h * scale, 3);
    const st = n.style || {};
    c.fillStyle = st.bg || n.color || (n.depth === 0 ? theme.rootBg : theme.nodeBg);
    c.strokeStyle = st.borderColor || (n.depth === 0 ? theme.rootBg : theme.nodeBorder);
    c.lineWidth = 0.6;
    c.beginPath();
    c.rect(n.x - pw / 2, n.y - ph / 2, pw, ph);
    c.fill();
    c.stroke();
  }

  function ensureBase() {
    if (!base) {
      base = document.createElement("canvas");
      base.width = canvas.width;
      base.height = canvas.height;
      baseCtx = base.getContext("2d");
    }
    return baseCtx;
  }

  function renderBase() {
    if (!canvas || !ctx) return;
    const c = ensureBase();
    const theme = M.Theme.get();
    const b = worldBounds();
    const bw = Math.max(b.maxX - b.minX, 1);
    const bh = Math.max(b.maxY - b.minY, 1);
    const scale = Math.min(base.width / bw, base.height / bh);
    const ox = (base.width - bw * scale) / 2 - b.minX * scale;
    const oy = (base.height - bh * scale) / 2 - b.minY * scale;
    state = { b, bw, bh, scale, ox, oy };

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, base.width, base.height);
    c.fillStyle = theme.canvasBg;
    c.fillRect(0, 0, base.width, base.height);
    c.translate(ox, oy);
    c.scale(scale, scale);

    c.strokeStyle = theme.line;
    c.lineWidth = 1 / scale;
    c.beginPath();
    for (const n of M.Model.visibleNodes(M.Model.root)) {
      if (n === M.Model.root) continue;
      const parent = M.Model.findParent(M.Model.root, n.id);
      if (!parent) continue;
      c.moveTo(parent.x, parent.y);
      c.lineTo(n.x, n.y);
    }
    c.stroke();

    for (const n of M.Model.visibleNodes(M.Model.root)) drawNode(c, n, theme, scale);

    for (const f of M.Model.frames) {
      const geo = M.Render.frameGeometry(f, new Set(M.Model.visibleNodes(M.Model.root).map((n) => n.id)));
      if (!geo) continue;
      c.strokeStyle = (f.style && f.style.borderColor) || theme.line;
      c.lineWidth = 1 / scale;
      c.strokeRect(geo.x, geo.y, geo.w, geo.h);
    }
    c.restore();
  }

  function minimap() {
    if (!canvas || !ctx) return;
    renderBase();
    drawViewport();
  }

  function drawViewport() {
    if (!ctx || !state) return;
    if (!base) return;
    const el = M.Render.view.el;
    const vw = el && el.clientWidth ? el.clientWidth : base.width * 2;
    const vh = el && el.clientHeight ? el.clientHeight : base.height * 2;
    const tl = M.Render.screenToWorld(0, 0);
    const br = M.Render.screenToWorld(vw, vh);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.strokeStyle = themeAccent();
    ctx.lineWidth = 1.5;
    ctx.strokeRect(state.ox + tl.x * state.scale, state.oy + tl.y * state.scale,
      (br.x - tl.x) * state.scale, (br.y - tl.y) * state.scale);
    ctx.restore();
  }

  function themeAccent() {
    try { return M.Theme.get().accent; } catch (err) { return "#f60"; }
  }

  function toWorld(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const b = worldBounds();
    const bw = Math.max(b.maxX - b.minX, 1);
    const bh = Math.max(b.maxY - b.minY, 1);
    const scale = Math.min(canvas.width / bw, canvas.height / bh);
    const ox = (canvas.width - bw * scale) / 2 - b.minX * scale;
    const oy = (canvas.height - bh * scale) / 2 - b.minY * scale;
    return { x: (x - ox) / scale, y: (y - oy) / scale };
  }

  function centerTo(ev) {
    const w = toWorld(ev);
    const el = M.Render.view.el;
    const vw = el && el.clientWidth ? el.clientWidth : canvas.clientWidth;
    const vh = el && el.clientHeight ? el.clientHeight : canvas.clientHeight;
    const scale = Math.max(M.Render.view.s || 1, 0.8);
    M.Render.setTransform(vw / 2 - w.x * scale, vh / 2 - w.y * scale, scale);
  }

  function init(el) {
    canvas = el;
    ctx = el.getContext("2d");
    let dragging = false;
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dragging = true;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      centerTo(e);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      e.preventDefault();
      centerTo(e);
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("pointercancel", () => { dragging = false; });
    minimap();
  }

  M.Minimap = { init, minimap, drawViewport };
})();