(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const GAP_X = 72;
  const GAP_Y = 16;
  const FRAME_PAD = 14;
  const FRAME_MARGIN = 10;
  const FRAME_SPACING = 24;
  const FRAME_LABEL_TOP = 14;
  const PAD_X = 18;
  const PAD_Y = 10;
  const MAX_W = 260;
  const IMG_W = 96;
  const IMG_H = 60;
  const IMG_GAP = 8;

  const ctx = document.createElement("canvas").getContext("2d");

  function fontFor(node, theme) {
    const isRoot = node.parentKind === "root";
    const st = node.style || {};
    const fs = st.fontSize || (isRoot ? theme.rootFs : theme.nodeFs);
    const weight = st.bold ? 700 : (isRoot ? 700 : 500);
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
    return M.Math.width(p.str, fontFs(font));
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
        const w = M.Math.width(p.str, fontFs(font));
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
    const st = node.style || {};
    const font = fontFor(node, theme);
    const fs = st.fontSize || (isRoot ? theme.rootFs : theme.nodeFs);
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
          const hh = M.Math.height(p.str, fs);
          lh2 = Math.max(lh2, hh.ascent + hh.descent + 2);
        }
      }
      h += lh2;
    }
    if (node.image) h += IMG_H + IMG_GAP;
    node.w = capped;
    node.h = h;
  }

  function buildFrameIndex(root) {
    const memberIds = new Map();
    for (const f of M.Model.frames) {
      for (const id of f.nodes) {
        let s = memberIds.get(id);
        if (!s) { s = new Set(); memberIds.set(id, s); }
        s.add(f.id);
      }
    }
    const idx = new Map();
    function walk(n) {
      let set = null;
      const own = memberIds.get(n.id);
      if (own) set = new Set(own);
      if (!n.collapsed) {
        for (const c of n.children) {
          const cs = walk(c);
          if (cs) {
            if (!set) set = new Set();
            for (const fid of cs) set.add(fid);
          }
        }
      }
      if (set) idx.set(n.id, set);
      return set;
    }
    walk(root);
    return { idx, own: memberIds };
  }

  function frameOrder(kids, frameIdx) {
    if (!frameIdx || !frameIdx.size) return kids.slice();
    let order = kids.slice();
    const frameIds = [];
    for (const k of order) {
      const s = frameIdx.get(k.id);
      if (s) for (const fid of s) if (!frameIds.includes(fid)) frameIds.push(fid);
    }
    for (let pass = 0; pass <= order.length; pass++) {
      let moved = false;
      for (const fid of frameIds) {
        let min = -1, max = -1;
        const involved = [];
        for (let i = 0; i < order.length; i++) {
          const s = frameIdx.get(order[i].id);
          if (s && s.has(fid)) {
            involved.push(i);
            if (min < 0) min = i;
            max = i;
          }
        }
        if (min < 0 || max - min === involved.length - 1) continue;
        const displaced = [];
        for (let i = min + 1; i < max; i++) {
          if (!involved.includes(i)) displaced.push(order[i]);
        }
        if (!displaced.length) continue;
        const rest = [];
        for (const k of order) if (!displaced.includes(k)) rest.push(k);
        rest.splice(rest.indexOf(order[max]) + 1, 0, ...displaced);
        order = rest;
        moved = true;
      }
      if (!moved) break;
    }
    return order;
  }

  function frameLabelTop(fid) {
    const f = M.Model.frames.find((x) => x.id === fid);
    return f && f.label ? FRAME_LABEL_TOP : 0;
  }

  function withinFrame(f2, f) {
    for (const id of f2.nodes) {
      let n = M.Model.find(M.Model.root, id);
      let inside = false;
      while (n) {
        if (f.nodes.includes(n.id)) { inside = true; break; }
        n = M.Model.findParent(M.Model.root, n.id);
      }
      if (!inside) return false;
    }
    return true;
  }

  function nestedFrames(f) {
    const out = [];
    for (const f2 of M.Model.frames) {
      if (f2 === f || !f2.nodes.length) continue;
      if (withinFrame(f2, f) && !withinFrame(f, f2)) out.push(f2);
    }
    return out;
  }

  function framePadLeft(fid, seen) {
    const f = M.Model.frames.find((x) => x.id === fid);
    let pad = FRAME_PAD;
    if (!f || (seen && seen.has(fid))) return pad;
    seen = seen ? new Set(seen) : new Set();
    seen.add(fid);
    for (const f2 of nestedFrames(f)) {
      pad = Math.max(pad, framePadLeft(f2.id, seen) + FRAME_PAD);
    }
    return pad;
  }

  function framePadRight(fid, seen) {
    const f = M.Model.frames.find((x) => x.id === fid);
    let pad = FRAME_PAD;
    if (!f || (seen && seen.has(fid))) return pad;
    seen = seen ? new Set(seen) : new Set();
    seen.add(fid);
    for (const f2 of nestedFrames(f)) {
      pad = Math.max(pad, framePadRight(f2.id, seen) + FRAME_PAD);
    }
    return pad;
  }

  function framePadTop(fid, seen) {
    const f = M.Model.frames.find((x) => x.id === fid);
    let pad = FRAME_PAD;
    if (!f || (seen && seen.has(fid))) return pad;
    seen = seen ? new Set(seen) : new Set();
    seen.add(fid);
    for (const f2 of nestedFrames(f)) {
      pad = Math.max(pad, framePadTop(f2.id, seen) + frameLabelTop(f2.id) + FRAME_PAD);
    }
    return pad;
  }

  function framePadBot(fid, seen) {
    const f = M.Model.frames.find((x) => x.id === fid);
    let pad = FRAME_PAD;
    if (!f || (seen && seen.has(fid))) return pad;
    seen = seen ? new Set(seen) : new Set();
    seen.add(fid);
    for (const f2 of nestedFrames(f)) {
      pad = Math.max(pad, framePadBot(f2.id, seen) + FRAME_PAD);
    }
    return pad;
  }

  function boundaryGaps(order, frameIdx) {
    const minAt = new Map(), maxAt = new Map();
    for (let i = 0; i < order.length; i++) {
      const s = frameIdx.get(order[i].id);
      if (!s) continue;
      for (const fid of s) {
        if (!minAt.has(fid)) minAt.set(fid, i);
        maxAt.set(fid, i);
      }
    }
    const gaps = [];
    for (let i = 0; i < order.length - 1; i++) {
      let downO = -Infinity, upO = -Infinity;
      let downHas = false, upHas = false;
      const a = order[i], b = order[i + 1];
      const sa = frameIdx.get(a.id);
      if (sa) for (const fid of sa) {
        if (maxAt.get(fid) === i) {
          downHas = true;
          downO = Math.max(downO, a.fmBot.get(fid) + framePadBot(fid) - a.ownHalf);
        }
      }
      const sb = frameIdx.get(b.id);
      if (sb) for (const fid of sb) {
        if (minAt.get(fid) === i + 1) {
          upHas = true;
          upO = Math.max(upO, framePadTop(fid) + FRAME_LABEL_TOP - b.fmTop.get(fid) - b.ownHalf);
        }
      }
      if (downHas && upHas) {
        gaps.push(Math.max(GAP_Y, FRAME_SPACING + downO + upO));
      } else if (downHas) {
        gaps.push(Math.max(GAP_Y, FRAME_MARGIN + downO));
      } else if (upHas) {
        gaps.push(Math.max(GAP_Y, FRAME_MARGIN + upO));
      } else {
        gaps.push(GAP_Y);
      }
    }
    return gaps;
  }

  function treeLayout(root, direction, theme) {
    function size(node, depth, frameIdx, own) {
      node.parentKind = depth === 0 ? "root" : "node";
      node.depth = depth;
      nodeSize(node, theme);
      node.subH = node.h;
      node.fmTop = new Map();
      node.fmBot = new Map();
      const kids = node.collapsed ? [] : node.children;
      let total = 0;
      if (kids.length) {
        for (const k of kids) {
          size(k, depth + 1, frameIdx, own);
          total += k.subH;
        }
        const order = frameOrder(kids, frameIdx);
        const gaps = boundaryGaps(order, frameIdx);
        for (const g of gaps) total += g;
        let cy = -total / 2;
        for (let i = 0; i < order.length; i++) {
          const k = order[i];
          const ky = cy + k.subH / 2;
          for (const [fid, v] of k.fmTop) {
            const nv = v + ky;
            const cur = node.fmTop.get(fid);
            if (cur === undefined || nv < cur) node.fmTop.set(fid, nv);
          }
          for (const [fid, v] of k.fmBot) {
            const nv = v + ky;
            const cur = node.fmBot.get(fid);
            if (cur === undefined || nv > cur) node.fmBot.set(fid, nv);
          }
          cy += k.subH + (i < order.length - 1 ? gaps[i] : 0);
        }
      }
      node.ownHalf = Math.max(node.h, total) / 2;
      const o = own.get(node.id);
      if (o) {
        for (const fid of o) {
          const t = node.fmTop.get(fid);
          if (t === undefined || -node.ownHalf < t) node.fmTop.set(fid, -node.ownHalf);
          const b = node.fmBot.get(fid);
          if (b === undefined || node.ownHalf > b) node.fmBot.set(fid, node.ownHalf);
        }
      }
      node.subH = Math.max(node.h, total);
    }
    function place(node, x, y, depth, childSide, frameIdx) {
      node.x = x;
      node.y = y;
      const kids = node.collapsed ? [] : node.children;
      if (!kids.length) return;
      const order = frameOrder(kids, frameIdx);
      let total = 0;
      for (const k of order) total += k.subH;
      const gaps = boundaryGaps(order, frameIdx);
      for (const g of gaps) total += g;
      let cy = y - total / 2;
      for (let i = 0; i < order.length; i++) {
        const k = order[i];
        const origIdx = kids.indexOf(k);
        const s = (direction === "balanced" && depth === 0)
          ? (origIdx % 2 === 0 ? 1 : -1)
          : childSide;
        k.side = s;
        place(k, x + s * (node.w / 2 + GAP_X + k.w / 2), cy + k.subH / 2, depth + 1, s, frameIdx);
        cy += k.subH + (i < order.length - 1 ? gaps[i] : 0);
      }
    }
    const fi = buildFrameIndex(root);
    size(root, 0, fi.idx, fi.own);
    const rootSide = direction === "left" ? -1 : 1;
    root.side = rootSide;
    place(root, 0, 0, 0, rootSide, fi.idx);
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
    GAP_X, GAP_Y, FRAME_PAD, FRAME_MARGIN, FRAME_SPACING, FRAME_LABEL_TOP, IMG_W, IMG_H, IMG_GAP, PAD_X, PAD_Y, MAX_W,
    frameLabelTop, framePadTop, framePadBot, framePadLeft, framePadRight,
    layoutAll, treeLayout, freeLayout,
    initFreePositions, bounds, nodeSize,
    truncate, wrapText, wrapParts, splitParts, measureText, fontMetrics
  };
})();
