(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const GAP_X = 72;
  const GAP_Y = 16;
  const PAD_X = 18;
  const PAD_Y = 10;
  const MAX_W = 260;
  const IMG_W = 96;
  const IMG_H = 60;
  const IMG_GAP = 8;

  const ctx = document.createElement("canvas").getContext("2d");

  function fontFor(node, theme) {
    const isRoot = node.parentKind === "root";
    const fs = isRoot ? theme.rootFs : theme.nodeFs;
    const weight = isRoot ? 700 : 500;
    return weight + " " + fs + "px " + theme.fontFamily;
  }

  function measureText(text, font) {
    ctx.font = font;
    return ctx.measureText(text).width;
  }

  const metricCache = Object.create(null);

  function fontMetrics(font) {
    let m = metricCache[font];
    if (m) return m;
    ctx.font = font;
    const fs = fontFs(font);
    const t = ctx.measureText("M\u4e2d");
    const ascent = typeof t.actualBoundingBoxAscent === "number"
      ? Math.round(t.actualBoundingBoxAscent)
      : Math.round(fs * 0.8);
    const descent = typeof t.actualBoundingBoxDescent === "number"
      ? Math.round(t.actualBoundingBoxDescent)
      : Math.round(fs * 0.2);
    m = { ascent, descent, height: ascent + descent };
    metricCache[font] = m;
    return m;
  }

  function truncate(text, maxW, font) {
    if (!text) return "";
    ctx.font = font;
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const w = ctx.measureText(text.slice(0, mid) + "\u2026").width;
      if (w <= maxW) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo) + "\u2026";
  }

  function wrapText(text, maxW, font) {
    return wrapParts(text, maxW, font).map((l) => l.map((p) => p.type === "text" ? p.str : "x").join(""));
  }

  function fontFs(font) {
    const m = /(\d+)px/.exec(font || "");
    return m ? parseInt(m[1], 10) : 16;
  }

  function partWidth(p, font) {
    if (p.type === "text") return measureText(p.str, font);
    return M.Math.width(p.tree, fontFs(font));
  }

  function splitParts(text) {
    const parts = [];
    const re = /\$([^$]+)\$/g;
    let last = 0, m;
    while ((m = re.exec(text || ""))) {
      if (m.index > last) parts.push({ type: "text", str: text.slice(last, m.index) });
      try {
        parts.push({ type: "math", str: m[1], tree: M.Math.parse(m[1]) });
      } catch (e) {
        parts.push({ type: "text", str: m[0] });
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ type: "text", str: text.slice(last) });
    if (!parts.length) parts.push({ type: "text", str: text });
    return parts;
  }

  function wrapParts(text, maxW, font) {
    const lines = [];
    let cur = [];
    let cw = 0;
    const flush = () => {
      if (cur.length) {
        lines.push(cur);
        cur = [];
        cw = 0;
      }
    };
    for (const p of splitParts(text)) {
      if (p.type === "math") {
        const w = M.Math.width(p.tree, fontFs(font));
        if (cur.length && cw + w > maxW) flush();
        cur.push(p);
        cw += w;
        continue;
      }
      for (const ch of p.str) {
        if (ch === "\n") {
          flush();
          continue;
        }
        const w = measureText(ch, font);
        if (cur.length && cw + w > maxW) flush();
        const last = cur[cur.length - 1];
        if (last && last.type === "text") last.str += ch;
        else cur.push({ type: "text", str: ch });
        cw += w;
      }
    }
    flush();
    if (!lines.length) lines.push([]);
    return lines;
  }

  function nodeSize(node, theme) {
    const isRoot = node.parentKind === "root";
    const font = fontFor(node, theme);
    const fs = (isRoot ? theme.rootFs : theme.nodeFs);
    const lines = wrapParts(node.text || "", MAX_W, font);
    let maxW = 0;
    for (const l of lines) {
      let w = 0;
      for (const p of l) w += partWidth(p, font);
      maxW = Math.max(maxW, w);
    }
    const w = Math.max(40, maxW + PAD_X * 2);
    const capped = Math.min(w, MAX_W + PAD_X * 2);
    const lh = Math.round(fs * 1.4);
    let h = PAD_Y * 2 + 4;
    for (const l of lines) {
      let lh2 = lh;
      for (const p of l) {
        if (p.type === "math") {
          const hh = M.Math.height(p.tree, fs);
          lh2 = Math.max(lh2, hh.ascent + hh.descent + 2);
        }
      }
      h += lh2;
    }
    if (node.image) h += IMG_H + IMG_GAP;
    node.w = capped;
    node.h = h;
  }

  function treeLayout(root, direction, theme) {
    function size(node, depth) {
      node.parentKind = depth === 0 ? "root" : "node";
      node.depth = depth;
      nodeSize(node, theme);
      node.subH = node.h;
      const kids = node.collapsed ? [] : node.children;
      if (!kids.length) return;
      let total = 0;
      for (const k of kids) {
        size(k, depth + 1);
        total += k.subH;
      }
      total += GAP_Y * (kids.length - 1);
      node.subH = Math.max(node.h, total);
    }
    function place(node, x, y, depth, childSide) {
      node.x = x;
      node.y = y;
      const kids = node.collapsed ? [] : node.children;
      if (!kids.length) return;
      let total = 0;
      for (const k of kids) total += k.subH;
      total += GAP_Y * (kids.length - 1);
      let cy = y - total / 2;
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        const s = (direction === "balanced" && depth === 0)
          ? (i % 2 === 0 ? 1 : -1)
          : childSide;
        k.side = s;
        place(k, x + s * (node.w / 2 + GAP_X + k.w / 2), cy + k.subH / 2, depth + 1, s);
        cy += k.subH + GAP_Y;
      }
    }
    size(root, 0);
    const rootSide = direction === "left" ? -1 : 1;
    root.side = rootSide;
    place(root, 0, 0, 0, rootSide);
    root.x = 0;
    root.y = 0;
  }

  function freeLayout(root, theme) {
    const visible = M.Model.visibleNodes(root);
    for (const n of visible) {
      n.parentKind = n === root ? "root" : "node";
      n.depth = n === root ? 0 : 1;
      nodeSize(n, theme);
      if (!n.freePos) {
        const existing = findLargestPlaced(visible);
        n.freePos = existing
          ? { x: existing.freePos.x + existing.w / 2 + GAP_X + n.w / 2, y: existing.freePos.y }
          : { x: 0, y: 0 };
      }
      n.x = n.freePos.x;
      n.y = n.freePos.y;
    }
  }

  function findLargestPlaced(visible) {
    let best = null;
    for (const n of visible) {
      if (n.freePos) {
        if (!best || n.freePos.x > best.freePos.x) best = n;
      }
    }
    return best;
  }

  function layoutAll() {
    const theme = M.Theme.get();
    const s = M.Model.settings;
    if (s.layoutMode === "free") {
      freeLayout(M.Model.root, theme);
    } else {
      treeLayout(M.Model.root, s.direction || "right", theme);
    }
  }

  function initFreePositions() {
    const visible = M.Model.visibleNodes(M.Model.root);
    for (const n of visible) {
      if (!n.freePos) n.freePos = { x: n.x, y: n.y };
    }
  }

  function bounds(visible) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of visible) {
      minX = Math.min(minX, n.x - n.w / 2);
      maxX = Math.max(maxX, n.x + n.w / 2);
      minY = Math.min(minY, n.y - n.h / 2);
      maxY = Math.max(maxY, n.y + n.h / 2);
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { minX, minY, maxX, maxY };
  }

  M.Layout = {
    GAP_X, GAP_Y, IMG_W, IMG_H, IMG_GAP, PAD_X, PAD_Y, MAX_W,
    layoutAll, treeLayout, freeLayout,
    initFreePositions, bounds, nodeSize,
    truncate, wrapText, wrapParts, splitParts, measureText, fontMetrics
  };
})();
