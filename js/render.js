(function () {
  "use strict";

  const M = (window.MM = window.MM || {});
  const NS = "http://www.w3.org/2000/svg";

  const svg = {
    el: null,
    world: null,
    tx: 0, ty: 0, s: 1,
    nodeEls: new Map(),
    connEls: new Map(),
    defs: null,
    clipSeq: 0
  };

  const LINE_STYLES = [
    { id: "default", name: "\u9ed8\u8ba4\u5355\u8272", colors: null },
    { id: "rainbow", name: "\u5f69\u8679", colors: ["#e64545", "#e8883a", "#e6b800", "#3fae62", "#3a8fe0", "#8a5fd6"] },
    { id: "cool", name: "\u51b7\u8272", colors: ["#2f7fd6", "#1aa3b0", "#36b37e", "#5a8fd0", "#4cafb5", "#7a6fd0"] },
    { id: "warm", name: "\u6696\u8272", colors: ["#e0574f", "#e8893b", "#efb93e", "#d9606b", "#e0762e", "#cf4a6a"] },
    { id: "morandi", name: "\u83ab\u5170\u8fea", colors: ["#b5907f", "#8fb2a5", "#a2a6c7", "#c2a0a0", "#9aa87f", "#7f8ea8"] },
    { id: "mono", name: "\u9ed1\u767d\u7070", colors: ["#5a5a5a", "#8a8a8a", "#b0b0b0", "#3f3f3f", "#9f9f9f", "#707070"] }
  ];

  function lineColorFor(depth, theme) {
    const def = LINE_STYLES.find((s) => s.id === M.Model.settings.lineStyle);
    if (!def || !def.colors) return theme.line;
    return def.colors[((depth || 1) - 1) % def.colors.length];
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function numVar(name, fallback) {
    const v = parseFloat(cssVar(name));
    return isFinite(v) ? v : fallback;
  }

  function getTheme() {
    return {
      canvasBg: cssVar("--canvas-bg"),
      line: cssVar("--line"),
      nodeBg: cssVar("--node-bg"),
      nodeBorder: cssVar("--node-border"),
      nodeText: cssVar("--node-text"),
      rootBg: cssVar("--root-bg"),
      rootText: cssVar("--root-text"),
      foldBg: cssVar("--fold-bg"),
      foldFg: cssVar("--fold-fg"),
      accent: cssVar("--ui-accent"),
      radius: numVar("--radius", 10),
      nodeFs: numVar("--node-fs", 15),
      rootFs: numVar("--root-fs", 20),
      fontFamily: getComputedStyle(document.body).fontFamily || '"Segoe UI", sans-serif'
    };
  }

  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return 255;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function textColorFor(bg) {
    return luminance(bg) > 150 ? "#222222" : "#ffffff";
  }

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  function connectorPath(parent, child, theme) {
    const dir = child.side || (child.depth % 2 === 0 && M.Model.settings.direction === "balanced" ? -1 :
      (child.depth === 1 || M.Model.settings.direction === "right" ? 1 : -1));
    const p1x = parent.x + dir * parent.w / 2;
    const p2x = child.x - dir * child.w / 2;
    const d = Math.max(24, Math.abs(p2x - p1x) / 2);
    return "M " + p1x + " " + parent.y +
      " C " + (p1x + dir * d) + " " + parent.y +
      ", " + (p2x - dir * d) + " " + child.y +
      ", " + p2x + " " + child.y;
  }

  function buildNode(g, node, theme, opts) {
    const isRoot = node.depth === 0;
    const fill = node.color || (isRoot ? theme.rootBg : theme.nodeBg);
    const stroke = node.color || (isRoot ? theme.rootBg : theme.nodeBorder);
    const textFill = node.color ? textColorFor(node.color) : (isRoot ? theme.rootText : theme.nodeText);
    const fs = isRoot ? theme.rootFs : theme.nodeFs;
    const font = (isRoot ? 700 : 500) + " " + fs + "px " + theme.fontFamily;
    const x = node.x, y = node.y, w = node.w, h = node.h;
    const r = (isRoot ? theme.radius + 2 : theme.radius);

    const grp = svgEl("g", {
      class: "node",
      "data-id": node.id,
      transform: "translate(" + x + " " + y + ")"
    }, g);

    svgEl("rect", {
      class: "nrect",
      x: -w / 2, y: -h / 2, width: w, height: h,
      rx: r, fill: fill, stroke: stroke, "stroke-width": 1.5
    }, grp);

    if (node.image) {
      const iw = w - 16, ih = M.Layout.IMG_H;
      const clipId = "imgclip" + (++svg.clipSeq);
      const cp = svgEl("clipPath", { id: clipId }, svg.defs);
      svgEl("rect", { x: -iw / 2, y: -h / 2 + M.Layout.PAD_Y, width: iw, height: ih, rx: 6 }, cp);
      svgEl("image", {
        href: node.image, "clip-path": "url(#" + clipId + ")",
        x: -iw / 2, y: -h / 2 + M.Layout.PAD_Y,
        width: iw, height: ih, preserveAspectRatio: "xMidYMid slice"
      }, grp);
    }

    const lines = M.Layout.wrapParts(node.text || "", M.Layout.MAX_W, font);
    const lh = Math.round(fs * 1.4);
    const metrics = M.Layout.fontMetrics(font);
    const lineHs = [];
    let blockH = 0;
    for (const line of lines) {
      let lh2 = lh;
      for (const p of line) {
        if (p.type === "math") {
          const hh = M.Math.height(p.str, fs);
          lh2 = Math.max(lh2, hh.ascent + hh.descent + 2);
        }
      }
      lineHs.push(lh2);
      blockH += lh2;
    }
    const ascent = metrics.ascent;
    let regionTop, regionH;
    if (node.image) {
      regionTop = -h / 2 + M.Layout.PAD_Y + M.Layout.IMG_H + M.Layout.IMG_GAP + 4;
      regionH = h / 2 - M.Layout.PAD_Y - regionTop;
    } else {
      regionTop = -h / 2 + M.Layout.PAD_Y;
      regionH = h - M.Layout.PAD_Y * 2;
    }
    let yAcc = regionTop + (regionH - blockH) / 2;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const hasMath = line.some((p) => p.type === "math");
      const lh2 = lineHs[li];
      let yBase;
      if (hasMath) {
        let mA = 0, mD = 0;
        for (const p of line) {
          if (p.type !== "math") continue;
          const hh = M.Math.height(p.str, fs);
          if (hh.ascent > mA) mA = hh.ascent;
          if (hh.descent > mD) mD = hh.descent;
        }
        const mH = mA + mD + 2;
        if (mH > metrics.height) yBase = yAcc + (lh2 - mH) / 2 + mA + 1;
        else yBase = yAcc + (lh2 - metrics.height) / 2 + ascent;
      } else {
        yBase = yAcc + (lh2 - metrics.height) / 2 + ascent;
      }
      yAcc += lh2;
      if (!hasMath) {
        const tg = svgEl("text", {
          "text-anchor": "middle",
          "font-family": theme.fontFamily,
          "font-size": fs,
          "font-weight": isRoot ? 700 : 500
        }, grp);
        const tspan = svgEl("tspan", { x: 0, y: yBase, fill: textFill }, tg);
        tspan.textContent = line.map((p) => p.str).join("");
        continue;
      }
      let lineW = 0;
      for (const p of line) {
        lineW += p.type === "text" ? M.Layout.measureText(p.str, font) : M.Math.width(p.str, fs);
      }
      let cx = -lineW / 2;
      for (const p of line) {
        if (p.type === "text") {
          const t = svgEl("text", {
            x: cx, y: yBase,
            "text-anchor": "start",
            "font-family": theme.fontFamily,
            "font-size": fs,
            "font-weight": isRoot ? 700 : 500,
            fill: textFill
          }, grp);
          t.textContent = p.str;
          cx += M.Layout.measureText(p.str, font);
        } else {
          M.Math.render(grp, p.str, fs, textFill, cx, yBase);
          cx += M.Math.width(p.str, fs);
        }
      }
    }

    if (node.link) {
      const lg = svgEl("g", { class: "link-btn", "data-id": node.id, transform: "translate(" + (w / 2 - 10) + " " + (-h / 2 + 10) + ")" }, grp);
      svgEl("circle", { r: 8, fill: theme.foldBg, stroke: theme.line, "stroke-width": 1.2 }, lg);
      const lt = svgEl("text", {
        "text-anchor": "middle", y: 3.5, fill: theme.foldFg,
        "font-size": 11, "font-family": theme.fontFamily, "font-weight": 700
      }, lg);
      lt.textContent = "\u2197";
    }

    if (node.notes) {
      svgEl("circle", {
        class: "note-dot",
        "data-id": node.id,
        cx: -w / 2 - 8, cy: -h / 2 + 8, r: 6,
        fill: theme.foldBg, stroke: theme.accent, "stroke-width": 1.5,
        cursor: "pointer"
      }, grp);
    }

    if (node.children.length) {
      const side = node.depth === 0 ? 1 : (node.side || 1);
      const fg = svgEl("g", {
        class: "fold-btn", "data-id": node.id,
        transform: "translate(" + side * (w / 2 + 10) + " 0)", cursor: "pointer"
      }, grp);
      svgEl("circle", { r: 9, fill: theme.foldBg, stroke: theme.line, "stroke-width": 1.5 }, fg);
      const ft = svgEl("text", {
        "text-anchor": "middle", y: 4.5, fill: theme.foldFg,
        "font-size": 14, "font-family": theme.fontFamily, "font-weight": 700, "pointer-events": "none"
      }, fg);
      ft.textContent = node.collapsed ? "+" : "\u2212";
    }

    svg.nodeEls.set(node.id, grp);
    return grp;
  }

  function edgePoint(n, fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy;
    if (!dx && !dy) return { x: n.x, y: n.y };
    let t = 1;
    if (dx > 0) t = Math.min(t, (n.x + n.w / 2 - fx) / dx);
    if (dx < 0) t = Math.min(t, (n.x - n.w / 2 - fx) / dx);
    if (dy > 0) t = Math.min(t, (n.y + n.h / 2 - fy) / dy);
    if (dy < 0) t = Math.min(t, (n.y - n.h / 2 - fy) / dy);
    t = Math.max(0, Math.min(1, t));
    return { x: fx + t * dx, y: fy + t * dy };
  }

  function borderPoint(n, raw) {
    const hw = n.w / 2, hh = n.h / 2;
    const x = Math.max(-hw, Math.min(hw, raw.x));
    const y = Math.max(-hh, Math.min(hh, raw.y));
    const bx = hw - Math.abs(x), by = hh - Math.abs(y);
    if (bx < by) return { x: n.x + (x >= 0 ? hw : -hw), y: n.y + y };
    return { x: n.x + x, y: n.y + (y >= 0 ? hh : -hh) };
  }

  function freeSideAnchor(n, other) {
    const parent = M.Model.findParent(M.Model.root, n.id);
    if (!parent) return edgePoint(n, n.x, n.y, other.x, other.y);
    const dir = parent.x < n.x ? 1 : -1;
    return { x: n.x + dir * n.w / 2, y: n.y };
  }

  function bezierPoint(t, pa, c1, c2, pb) {
    const u = 1 - t;
    return {
      x: u * u * u * pa.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * pb.x,
      y: u * u * u * pa.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * pb.y
    };
  }

  function frameBorderPoint(geo, dx, dy) {
    const cx = geo.x + geo.w / 2, cy = geo.y + geo.h / 2;
    const hw = geo.w / 2, hh = geo.h / 2;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return { x: cx, y: cy };
    const t = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
    return { x: cx + dx * t, y: cy + dy * t };
  }

  function endpointVisible(rel, which, visibleIds) {
    const isFrame = which === "from" ? rel.fromFrame : rel.toFrame;
    const id = which === "from" ? rel.from : rel.to;
    if (isFrame) {
      const f = M.Model.frames.find((x) => x.id === id);
      return !!f && f.nodes.some((nid) => visibleIds.has(nid));
    }
    return visibleIds.has(id);
  }

  function endpointPos(rel, which, visibleIds) {
    const isFrame = which === "from" ? rel.fromFrame : rel.toFrame;
    const id = which === "from" ? rel.from : rel.to;
    if (isFrame) {
      const f = M.Model.frames.find((x) => x.id === id);
      const geo = f && frameGeometry(f, visibleIds);
      return geo ? { frame: f, geo } : null;
    }
    const n = M.Model.find(M.Model.root, id);
    return n ? { node: n } : null;
  }

  function relationGeometry(rel, theme, override) {
    theme = theme || M.Theme.get();
    const visibleIds = new Set(M.Model.visibleNodes(M.Model.root).map((n) => n.id));
    const a = endpointPos(rel, "from", visibleIds);
    const b = endpointPos(rel, "to", visibleIds);
    if (!a || !b) return null;
    const centerOf = (ep) => ep.frame ? { x: ep.geo.x + ep.geo.w / 2, y: ep.geo.y + ep.geo.h / 2 } : ep.node;
    const ca = centerOf(a), cb = centerOf(b);
    let pa, pb;
    const dirA = override && override.from ? { x: override.from.x - ca.x, y: override.from.y - ca.y } : { x: cb.x - ca.x, y: cb.y - ca.y };
    if (a.frame) {
      if (override && override.from) pa = frameBorderPoint(a.geo, dirA.x, dirA.y);
      else if (rel.fromPt) pa = frameBorderPoint(a.geo, rel.fromPt.x, rel.fromPt.y);
      else pa = frameBorderPoint(a.geo, dirA.x, dirA.y);
    } else if (override && override.from) pa = borderPoint(a.node, dirA);
    else if (rel.fromPt) pa = borderPoint(a.node, rel.fromPt);
    else pa = freeSideAnchor(a.node, b.frame ? cb : b.node);
    const dirB = override && override.to ? { x: override.to.x - cb.x, y: override.to.y - cb.y } : { x: ca.x - cb.x, y: ca.y - cb.y };
    if (b.frame) {
      if (override && override.to) pb = frameBorderPoint(b.geo, dirB.x, dirB.y);
      else if (rel.toPt) pb = frameBorderPoint(b.geo, rel.toPt.x, rel.toPt.y);
      else pb = frameBorderPoint(b.geo, dirB.x, dirB.y);
    } else if (override && override.to) pb = borderPoint(b.node, dirB);
    else if (rel.toPt) pb = borderPoint(b.node, rel.toPt);
    else pb = freeSideAnchor(b.node, a.frame ? ca : a.node);
    let dx = pb.x - pa.x, dy = pb.y - pa.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1) { dx = 1; dy = 0; dist = 1; }
    const tx = dx / dist, ty = dy / dist;
    const nx = -ty, ny = tx;
    let c1, c2;
    if (rel.cp1 && rel.cp2) {
      c1 = { x: pa.x + tx * rel.cp1.a + nx * rel.cp1.b, y: pa.y + ty * rel.cp1.a + ny * rel.cp1.b };
      c2 = { x: pb.x - tx * rel.cp2.c + nx * rel.cp2.d, y: pb.y - ty * rel.cp2.c + ny * rel.cp2.d };
    } else if (rel.cp) {
      const k = 2 / 3;
      const c = {
        x: (pa.x + pb.x) / 2 + tx * rel.cp.t + nx * rel.cp.n,
        y: (pa.y + pb.y) / 2 + ty * rel.cp.t + ny * rel.cp.n
      };
      c1 = { x: pa.x + (c.x - pa.x) * k, y: pa.y + (c.y - pa.y) * k };
      c2 = { x: pb.x + (c.x - pb.x) * k, y: pb.y + (c.y - pb.y) * k };
    } else {
      const k = Math.max(24, Math.min(60, dist * 0.35));
      c1 = { x: pa.x + tx * k, y: pa.y + ty * k };
      c2 = { x: pb.x - tx * k, y: pb.y - ty * k };
    }
    const d = "M " + pa.x + " " + pa.y +
      " C " + c1.x + " " + c1.y + ", " + c2.x + " " + c2.y + ", " + pb.x + " " + pb.y;
    let adx = pb.x - c2.x, ady = pb.y - c2.y;
    let adist = Math.hypot(adx, ady);
    if (adist < 1) { adx = -tx; ady = -ty; adist = 1; }
    adx /= adist; ady /= adist;
    const size = 9;
    const ax = pb.x, ay = pb.y;
    const bx = ax - adx * size, by = ay - ady * size;
    const px1 = bx - ady * size * 0.55, py1 = by + adx * size * 0.55;
    const px2 = bx + ady * size * 0.55, py2 = by - adx * size * 0.55;
    const labelPt = bezierPoint(rel.labelT == null ? 0.5 : rel.labelT, pa, c1, c2, pb);
    return {
      d,
      arrow: "M " + ax + " " + ay + " L " + px1 + " " + py1 + " L " + px2 + " " + py2 + " Z",
      labelX: labelPt.x,
      labelY: labelPt.y,
      pa, pb, c1, c2, tx, ty, nx, ny, dist
    };
  }

  function drawRelation(g, rel, theme, plain) {
    const geo = relationGeometry(rel, theme);
    if (!geo) return;
    const selected = !plain && M.Editor && M.Editor.selectedRelationId() === rel.id;
    const color = rel.color || theme.accent;

    svgEl("path", {
      class: "rel-path", "data-rel": rel.id,
      d: geo.d, fill: "none", stroke: color,
      "stroke-width": selected ? 4 : 2.5, "stroke-linecap": "round"
    }, g);

    svgEl("path", {
      class: "rel-arrow", "data-rel": rel.id,
      d: geo.arrow, fill: color, stroke: "none"
    }, g);

    if (!plain) {
      svgEl("path", {
        class: "rel-hit", "data-id": rel.id,
        d: geo.d, fill: "none", stroke: "transparent",
        "stroke-width": 16, "pointer-events": "stroke", cursor: "grab"
      }, g);
    }

    if (selected) {
      const handle = (x, y, pt) => {
        const hg = svgEl("g", {
          class: "rel-handle", "data-id": rel.id, "data-pt": pt,
          transform: "translate(" + x + " " + y + ")", cursor: "grab"
        }, g);
        svgEl("circle", { r: 6.5, fill: theme.foldBg, stroke: color, "stroke-width": 2 }, hg);
        svgEl("circle", { r: 2.5, fill: color, "pointer-events": "none" }, hg);
      };
      handle(geo.pa.x, geo.pa.y, "from");
      handle(geo.pb.x, geo.pb.y, "to");
      handle(geo.c1.x, geo.c1.y, "1");
      handle(geo.c2.x, geo.c2.y, "2");
    }

    if (rel.label) {
      const font = "500 12px " + theme.fontFamily;
      const lw = M.Layout.measureText(rel.label, font) + 18;
      const lg = svgEl("g", {
        class: "rel-label", "data-id": rel.id,
        transform: "translate(" + geo.labelX + " " + geo.labelY + ")", cursor: "pointer"
      }, g);
      svgEl("rect", {
        x: -lw / 2, y: -11, width: lw, height: 22, rx: 11,
        fill: theme.foldBg, stroke: color, "stroke-width": selected ? 2.5 : 1.4
      }, lg);
      const lt = svgEl("text", {
        "text-anchor": "middle", y: 4.5, "font-size": 12,
        "font-family": theme.fontFamily, fill: theme.foldFg, "pointer-events": "none"
      }, lg);
      lt.textContent = rel.label;
    }
  }

  function footprintOf(node) {
    let minX = node.x - node.w / 2, minY = node.y - node.h / 2;
    let maxX = node.x + node.w / 2, maxY = node.y + node.h / 2;
    if (!node.collapsed) {
      for (const c of node.children) {
        const bb = footprintOf(c);
        minX = Math.min(minX, bb.minX);
        minY = Math.min(minY, bb.minY);
        maxX = Math.max(maxX, bb.maxX);
        maxY = Math.max(maxY, bb.maxY);
      }
    }
    return { minX, minY, maxX, maxY };
  }

  function frameGeometry(f, visibleIds) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let any = false;
    for (const id of f.nodes) {
      if (!visibleIds.has(id)) continue;
      const n = M.Model.find(M.Model.root, id);
      if (!n) continue;
      const bb = footprintOf(n);
      minX = Math.min(minX, bb.minX);
      minY = Math.min(minY, bb.minY);
      maxX = Math.max(maxX, bb.maxX);
      maxY = Math.max(maxY, bb.maxY);
      any = true;
    }
    if (!any || !isFinite(minX)) return null;
    const padLeft = M.Layout.framePadLeft(f.id);
    const padRight = M.Layout.framePadRight(f.id);
    const padTop = M.Layout.framePadTop(f.id);
    const padBot = M.Layout.framePadBot(f.id);
    return { x: minX - padLeft, y: minY - padTop, w: maxX - minX + padLeft + padRight, h: maxY - minY + padTop + padBot };
  }

  function drawFrame(f, g, theme, visibleIds, plain) {
    const geo = frameGeometry(f, visibleIds);
    if (!geo) return;
    const selected = !plain && M.Editor && M.Editor.selectedFrameId() === f.id;
    const color = selected ? theme.accent : theme.line;
    svgEl("rect", {
      class: "frame-rect", "data-id": f.id,
      x: geo.x, y: geo.y, width: geo.w, height: geo.h, rx: 12,
      fill: "none", stroke: color, "stroke-width": selected ? 2.5 : 1.5,
      "stroke-dasharray": "8 5", "pointer-events": "none"
    }, g);
    if (!plain) {
      svgEl("rect", {
        class: "frame-hit", "data-id": f.id,
        x: geo.x, y: geo.y, width: geo.w, height: geo.h, rx: 12,
        fill: "none", stroke: "transparent", "stroke-width": 14,
        "pointer-events": "stroke", cursor: "pointer"
      }, g);
    }
    if (f.label) {
      const font = "500 12px " + theme.fontFamily;
      const lw = M.Layout.measureText(f.label, font) + 16;
      const lg = svgEl("g", {
        class: "frame-label", "data-id": f.id,
        transform: "translate(" + (geo.x + 10) + " " + (geo.y - 4) + ")", cursor: "pointer"
      }, g);
      svgEl("rect", {
        x: 0, y: -10, width: lw, height: 20, rx: 10,
        fill: theme.foldBg, stroke: color, "stroke-width": selected ? 2 : 1.2
      }, lg);
      const lt = svgEl("text", {
        x: lw / 2, y: 2, "text-anchor": "middle", "font-size": 12,
        "font-family": theme.fontFamily, fill: theme.foldFg, "pointer-events": "none"
      }, lg);
      lt.textContent = f.label;
    }
  }

  function hitFrame(wx, wy, excludeId) {
    const vis = new Set(M.Model.visibleNodes(M.Model.root).map((n) => n.id));
    let best = null, bestArea = Infinity;
    for (const f of M.Model.frames) {
      if (f.id === excludeId) continue;
      const g = frameGeometry(f, vis);
      if (g && wx >= g.x && wx <= g.x + g.w && wy >= g.y && wy <= g.y + g.h) {
        const area = g.w * g.h;
        if (area < bestArea) { best = f; bestArea = area; }
      }
    }
    return best;
  }

  function updateFrame(f) {
    const visible = M.Model.visibleNodes(M.Model.root);
    const geo = frameGeometry(f, new Set(visible.map((n) => n.id)));
    if (!geo) return;
    for (const cls of ["frame-rect", "frame-hit"]) {
      const el = svg.el.querySelector('rect.' + cls + '[data-id="' + f.id + '"]');
      if (!el) continue;
      el.setAttribute("x", geo.x);
      el.setAttribute("y", geo.y);
      el.setAttribute("width", geo.w);
      el.setAttribute("height", geo.h);
    }
    const lg = svg.el.querySelector('g.frame-label[data-id="' + f.id + '"]');
    if (lg) lg.setAttribute("transform", "translate(" + (geo.x + 10) + " " + (geo.y - 4) + ")");
  }

  function renderTreeInto(g, opts) {
    svg.defs = svgEl("defs", {}, g);
    svg.nodeEls.clear();
    svg.connEls.clear();
    const theme = M.Theme.get();
    const visible = M.Model.visibleNodes(M.Model.root);
    const visibleIds = new Set(visible.map((n) => n.id));
    for (const n of visible) {
      if (n !== M.Model.root) {
        const parent = M.Model.findParent(M.Model.root, n.id);
        const p = svgEl("path", {
          class: "connector", "data-id": n.id,
          d: connectorPath(parent, n, theme),
          fill: "none", stroke: lineColorFor(n.depth, theme), "stroke-width": 2
        }, g);
        svg.connEls.set(n.id, p);
      }
    }
    for (const f of M.Model.frames) drawFrame(f, g, theme, visibleIds);
    for (const n of visible) buildNode(g, n, theme, opts);
    for (const rel of M.Model.relations) {
      if (endpointVisible(rel, "from", visibleIds) && endpointVisible(rel, "to", visibleIds)) {
        drawRelation(g, rel, theme);
      }
    }
    return g;
  }

  function applySelectionClasses() {
    const sel = M.Model.selectedNodes().map((n) => n.id);
    const matches = M.Search ? M.Search.currentMatches() : [];
    for (const [id, el] of svg.nodeEls) {
      el.classList.toggle("selected", sel.includes(id));
      el.classList.toggle("search-hit", matches.has(id));
    }
  }

  function setTransform(tx, ty, s, animate) {
    svg.tx = tx; svg.ty = ty; svg.s = s;
    if (svg.world) {
      svg.world.setAttribute("transform", "translate(" + tx + " " + ty + ") scale(" + s + ")");
    }
    if (M.Editor && M.Editor.repositionEdit) M.Editor.repositionEdit();
  }

  function worldToScreen(x, y) {
    return { x: svg.tx + x * svg.s, y: svg.ty + y * svg.s };
  }

  function screenToWorld(x, y) {
    return { x: (x - svg.tx) / svg.s, y: (y - svg.ty) / svg.s };
  }

  function fit(padding) {
    const pad = padding || 60;
    const vw = svg.el.clientWidth, vh = svg.el.clientHeight;
    if (!vw || !vh) return;
    const b = M.Layout.bounds(M.Model.visibleNodes(M.Model.root));
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const s = Math.min((vw - pad * 2) / Math.max(bw, 1), (vh - pad * 2) / Math.max(bh, 1));
    const scale = Math.max(0.05, Math.min(s, 1.6));
    const tx = (vw - bw * scale) / 2 - b.minX * scale;
    const ty = (vh - bh * scale) / 2 - b.minY * scale;
    setTransform(tx, ty, scale);
  }

  function centerOn(node) {
    const vw = svg.el.clientWidth, vh = svg.el.clientHeight;
    const scale = Math.max(svg.s, 0.8);
    setTransform(vw / 2 - node.x * scale, vh / 2 - node.y * scale, scale);
  }

  function updateRelation(relId, geo) {
    const rel = M.Model.relations.find((r) => r.id === relId);
    if (!rel) return;
    geo = geo || relationGeometry(rel, M.Theme.get());
    if (!geo) return;
    for (const el of svg.el.querySelectorAll('[data-rel="' + relId + '"]')) {
      el.setAttribute("d", el.classList.contains("rel-arrow") ? geo.arrow : geo.d);
    }
    const lg = svg.el.querySelector('g.rel-label[data-id="' + relId + '"]');
    if (lg) lg.setAttribute("transform", "translate(" + geo.labelX + " " + geo.labelY + ")");
    const hs = svg.el.querySelectorAll('g.rel-handle[data-id="' + relId + '"]');
    for (const h of hs) {
      const pt = h.getAttribute("data-pt");
      const p = pt === "from" ? geo.pa : pt === "to" ? geo.pb : pt === "2" ? geo.c2 : geo.c1;
      h.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
    }
  }

  function updateFreeDrag(nodeIds) {
    const theme = M.Theme.get();
    const moved = new Set(nodeIds);
    for (const id of nodeIds) {
      const node = M.Model.find(M.Model.root, id);
      if (!node) continue;
      const el = svg.nodeEls.get(id);
      if (el) el.setAttribute("transform", "translate(" + node.x + " " + node.y + ")");
      if (node !== M.Model.root) {
        const parent = M.Model.findParent(M.Model.root, id);
        const conn = svg.connEls.get(id);
        if (conn && parent) conn.setAttribute("d", connectorPath(parent, node, theme));
      }
      for (const c of node.children) {
        if (moved.has(c.id)) continue;
        const conn = svg.connEls.get(c.id);
        if (conn) conn.setAttribute("d", connectorPath(node, c, theme));
      }
    }
    for (const rel of M.Model.relations) {
      if (moved.has(rel.from) || moved.has(rel.to)) updateRelation(rel.id);
    }
    for (const f of M.Model.frames) {
      if (f.nodes.some((id) => moved.has(id))) updateFrame(f);
    }
  }

  function render() {
    const el = svg.el;
    el.innerHTML = "";
    const world = svgEl("g", {}, el);
    svg.world = world;
    renderTreeInto(world);
    svgEl("path", {
      id: "rel-preview", class: "rel-preview",
      d: "", fill: "none",
      stroke: "rgba(255,140,26,.9)", "stroke-width": 2.5,
      "stroke-dasharray": "8 6", "pointer-events": "none",
      style: "display:none;pointer-events:none"
    }, world);
    setTransform(svg.tx, svg.ty, svg.s);
    applySelectionClasses();
  }

  function toSVGString(bounds, bg) {
    const tmp = document.createElementNS(NS, "svg");
    svg.defs = svgEl("defs", {}, tmp);
    svg.nodeEls.clear();
    const theme = M.Theme.get();
    const g = svgEl("g", {}, tmp);
    const visible = M.Model.visibleNodes(M.Model.root);
    const pad = 40;
    const b = bounds || M.Layout.bounds(visible);
    const vis = new Set(visible.map((n) => n.id));
    for (const f of M.Model.frames) {
      const geo = frameGeometry(f, vis);
      if (!geo) continue;
      b.minX = Math.min(b.minX, geo.x);
      b.minY = Math.min(b.minY, geo.y);
      b.maxX = Math.max(b.maxX, geo.x + geo.w);
      b.maxY = Math.max(b.maxY, geo.y + geo.h);
    }
    const W = b.maxX - b.minX + pad * 2;
    const H = b.maxY - b.minY + pad * 2;
    const offX = b.minX - pad, offY = b.minY - pad;
    g.setAttribute("transform", "translate(" + (-offX) + " " + (-offY) + ")");
    if (bg !== "transparent") {
      const bgColor = bg === "white" ? "#ffffff" : theme.canvasBg;
      svgEl("rect", { x: offX, y: offY, width: W, height: H, fill: bgColor }, g);
    }
    for (const n of visible) {
      if (n !== M.Model.root) {
        const parent = M.Model.findParent(M.Model.root, n.id);
        svgEl("path", {
          d: connectorPath(parent, n, theme),
          fill: "none", stroke: lineColorFor(n.depth, theme), "stroke-width": 2
        }, g);
      }
    }
    for (const rel of M.Model.relations) {
      if (endpointVisible(rel, "from", vis) && endpointVisible(rel, "to", vis)) {
        drawRelation(g, rel, theme, true);
      }
    }
    for (const f of M.Model.frames) drawFrame(f, g, theme, vis, true);
    for (const n of visible) buildNode(g, n, theme, {});
    const out = document.createElementNS(NS, "svg");
    out.setAttribute("xmlns", NS);
    out.setAttribute("width", Math.round(W));
    out.setAttribute("height", Math.round(H));
    out.setAttribute("viewBox", "0 0 " + W + " " + H);
    while (tmp.firstChild) out.appendChild(tmp.firstChild);
    return out.outerHTML;
  }

  M.Theme = { get: getTheme };
  M.Render = {
    LINE_STYLES,
    init(el) { svg.el = el; },
    render, renderTreeInto, applySelectionClasses,
    setTransform, worldToScreen, screenToWorld, fit, centerOn,
    toSVGString, updateFreeDrag, updateRelation, relationGeometry, bezierPoint, frameGeometry, footprintOf,
    hitFrame,
    get view() { return svg; }
  };
})();
