(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const FONT = '"Georgia", "Times New Roman", "Noto Serif CJK SC", serif';

  const GREEK = {
    alpha: "\u03b1", beta: "\u03b2", gamma: "\u03b3", delta: "\u03b4",
    epsilon: "\u03b5", zeta: "\u03b6", eta: "\u03b7", theta: "\u03b8",
    iota: "\u03b9", kappa: "\u03ba", lambda: "\u03bb", mu: "\u03bc",
    nu: "\u03bd", xi: "\u03be", omicron: "\u03bf", pi: "\u03c0",
    rho: "\u03c1", sigma: "\u03c3", tau: "\u03c4", upsilon: "\u03c5",
    phi: "\u03c6", chi: "\u03c7", psi: "\u03c8", omega: "\u03c9",
    Gamma: "\u0393", Delta: "\u0394", Theta: "\u0398", Lambda: "\u039b",
    Xi: "\u039e", Pi: "\u03a0", Sigma: "\u03a3", Phi: "\u03a6",
    Psi: "\u03a8", Omega: "\u03a9"
  };

  const OPS = {
    times: "\u00d7", div: "\u00f7", pm: "\u00b1", mp: "\u2213",
    cdot: "\u00b7", leq: "\u2264", geq: "\u2265", neq: "\u2260",
    approx: "\u2248", equiv: "\u2261", sim: "\u223c", propto: "\u221d",
    infty: "\u221e", to: "\u2192", rightarrow: "\u2192", leftarrow: "\u2190",
    uparrow: "\u2191", downarrow: "\u2193", Rightarrow: "\u21d2", Leftarrow: "\u21d0",
    sum: "\u2211", int: "\u222b", prod: "\u220f", partial: "\u2202",
    nabla: "\u2207", dots: "\u2026", ldots: "\u2026", cdots: "\u22ef",
    prime: "\u2032", in: "\u2208", notin: "\u2209", subset: "\u2282",
    supset: "\u2283", subseteq: "\u2286", supseteq: "\u2287",
    cup: "\u222a", cap: "\u2229", forall: "\u2200", exists: "\u2203",
    emptyset: "\u2205", angle: "\u2220", degree: "\u00b0", perp: "\u22a5",
    parallel: "\u2225", sqrt: null, frac: null
  };

  const ctx = document.createElement("canvas").getContext("2d");

  function measure(str, fs) {
    ctx.font = fs + "px " + FONT;
    const m = ctx.measureText(str);
    return {
      w: m.width,
      ascent: Math.max(fs * 0.75, m.actualBoundingBoxAscent || 0),
      descent: Math.max(fs * 0.2, m.actualBoundingBoxDescent || 0)
    };
  }

  function atomText(c) {
    return { type: "atom", str: c };
  }

  function parse(src) {
    let i = 0;
    const s = src;

    function parseArg() {
      if (s[i] === "{") {
        i++;
        const box = parseExpr("}");
        if (s[i] === "}") i++;
        return box;
      }
      if (s[i] === "^" || s[i] === "_") {
        i++;
        return parseArg();
      }
      if (s[i] === "\\") {
        return parseCommand();
      }
      if (i < s.length) {
        return atomText(s[i++]);
      }
      return null;
    }

    function parseCommand() {
      i++;
      let name = "";
      while (i < s.length && /[a-zA-Z]/.test(s[i])) name += s[i++];
      if (!name) {
        if (i < s.length) {
          const c = s[i];
          i++;
          if (c === ",") return { type: "space", w: 0.16 };
          if (c === ";") return { type: "space", w: 0.28 };
          if (c === "!") return { type: "space", w: 0.08 };
          if (c === " ") return { type: "space", w: 0.35 };
          return atomText(c);
        }
        return atomText("\\");
      }
      if (name === "frac") {
        const num = parseArg();
        const den = parseArg();
        if (num && den) return { type: "frac", num, den };
        return atomText("\\frac");
      }
      if (name === "sqrt") {
        const body = parseArg();
        if (body) return { type: "sqrt", body };
        return atomText("\\sqrt");
      }
      if (name === "left" || name === "right" || name === "big" || name === "Big") {
        if (s[i] === "(" || s[i] === ")" || s[i] === "[" || s[i] === "]" || s[i] === "{") {
          const c = s[i];
          i++;
          return atomText(c === "{" ? "(" : c === "}" ? ")" : c);
        }
        return { type: "space", w: 0.05 };
      }
      if (name === "text") {
        if (s[i] === "{") {
          i++;
          let t = "";
          while (i < s.length && s[i] !== "}") t += s[i++];
          if (s[i] === "}") i++;
          return { type: "text", str: t };
        }
        return { type: "space", w: 0.1 };
      }
      if (name === "quad") return { type: "space", w: 1 };
      if (name === "qquad") return { type: "space", w: 2 };
      if (name in GREEK) return atomText(GREEK[name]);
      if (name in OPS && OPS[name]) return atomText(OPS[name]);
      return atomText("\\" + name);
    }

    function parseExpr(stop) {
      const items = [];
      while (i < s.length) {
        const c = s[i];
        if (c === stop) break;
        if (c === "^" || c === "_") {
          const last = items.length ? items.pop() : null;
          if (!last) { i++; continue; }
          const kind = c;
          i++;
          const arg = parseArg();
          if (!arg) { items.push(last); continue; }
          if (kind === "^") items.push({ type: "script", base: last, sup: arg });
          else items.push({ type: "script", base: last, sub: arg });
          continue;
        }
        if (c === "{") {
          i++;
          const box = parseExpr("}");
          if (s[i] === "}") i++;
          items.push(box);
          continue;
        }
        if (c === "}") break;
        if (c === "\\") {
          items.push(parseCommand());
          continue;
        }
        i++;
        items.push(atomText(c));
      }
      return { type: "row", items };
    }

    const tree = parseExpr("");
    if (tree.items.length === 1) return tree.items[0];
    return tree;
  }

  function scriptFont(fs) { return Math.round(fs * 0.72); }
  function radicalFont(fs) { return Math.round(fs * 1.15); }

  function measureBox(box, fs) {
    if (box.type === "atom") return measure(box.str, fs);
    if (box.type === "text") return measure(box.str, fs);
    if (box.type === "space") {
      const m = measure(" ", fs);
      return { w: m.w * box.w, ascent: m.ascent, descent: m.descent };
    }
    if (box.type === "row") {
      let w = 0, as = 0, de = 0;
      for (const it of box.items) {
        const m = measureBox(it, fs);
        w += m.w;
        as = Math.max(as, m.ascent);
        de = Math.max(de, m.descent);
      }
      return { w, ascent: as, descent: de };
    }
    if (box.type === "script") {
      const b = measureBox(box.base, fs);
      const sfs = scriptFont(fs);
      let sup = null, sub = null;
      if (box.sup) sup = measureBox(box.sup, sfs);
      if (box.sub) sub = measureBox(box.sub, sfs);
      const scriptW = Math.max(sup ? sup.w : 0, sub ? sub.w : 0);
      return { w: b.w + scriptW, ascent: b.ascent, descent: b.descent };
    }
    if (box.type === "frac") {
      const n = measureBox(box.num, scriptFont(fs));
      const d = measureBox(box.den, scriptFont(fs));
      const gap = fs * 0.18;
      const bar = 1;
      return {
        w: Math.max(n.w, d.w) + fs * 0.3,
        ascent: n.ascent + n.descent + gap + bar / 2,
        descent: d.ascent + d.descent + gap + bar / 2
      };
    }
    if (box.type === "sqrt") {
      const body = measureBox(box.body, fs);
      const rad = measure("\u221a", radicalFont(fs));
      return {
        w: rad.w + body.w + fs * 0.12,
        ascent: rad.ascent + body.ascent * 0.28,
        descent: body.descent
      };
    }
    return { w: 0, ascent: fs * 0.75, descent: fs * 0.2 };
  }

  function width(tree, fs) {
    return measureBox(tree, fs || 16).w;
  }

  function height(tree, fs) {
    const m = measureBox(tree, fs || 16);
    return { ascent: m.ascent, descent: m.descent };
  }

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  function drawText(g, str, fs, x, y, color) {
    const t = svgEl("text", {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      "font-size": fs,
      "font-family": FONT,
      "text-anchor": "start",
      fill: color
    }, g);
    t.textContent = str;
    return t;
  }

  function drawBox(g, box, fs, x, y, color) {
    if (box.type === "atom" || box.type === "text") {
      drawText(g, box.str, fs, x, y, color);
      return;
    }
    if (box.type === "space") return;
    if (box.type === "row") {
      let cx = x;
      for (const it of box.items) {
        drawBox(g, it, fs, cx, y, color);
        cx += measureBox(it, fs).w;
      }
      return;
    }
    if (box.type === "script") {
      const b = measureBox(box.base, fs);
      drawBox(g, box.base, fs, x, y, color);
      const sfs = scriptFont(fs);
      const bx = x + b.w;
      if (box.sup) {
        const sup = measureBox(box.sup, sfs);
        drawBox(g, box.sup, sfs, bx, y - b.ascent - sup.descent * 0.4 - fs * 0.1, color);
      }
      if (box.sub) {
        drawBox(g, box.sub, sfs, bx, y + b.descent + sfs * 0.45, color);
      }
      return;
    }
    if (box.type === "frac") {
      const sfs = scriptFont(fs);
      const n = measureBox(box.num, sfs);
      const d = measureBox(box.den, sfs);
      const gap = fs * 0.18;
      const w = Math.max(n.w, d.w) + fs * 0.3;
      const nw = measureBox(box.num, sfs).w;
      const dw = measureBox(box.den, sfs).w;
      drawBox(g, box.num, sfs, x + (w - nw) / 2, y - gap - n.descent, color);
      svgEl("rect", {
        x: x, y: y - 0.5, width: w, height: 1,
        fill: color
      }, g);
      drawBox(g, box.den, sfs, x + (w - dw) / 2, y + gap + d.ascent, color);
      return;
    }
    if (box.type === "sqrt") {
      const rfs = radicalFont(fs);
      const body = measureBox(box.body, fs);
      const rad = measure("\u221a", rfs);
      const overY = y - body.ascent - fs * 0.05;
      drawText(g, "\u221a", rfs, x, y - body.ascent * 0.24, color);
      drawBox(g, box.body, fs, x + rad.w, y, color);
      svgEl("line", {
        x1: x + rad.w + fs * 0.05, y1: overY, x2: x + rad.w + body.w + fs * 0.1, y2: overY,
        stroke: color, "stroke-width": 1
      }, g);
      return;
    }
  }

  function render(g, tree, fs, color, x, y) {
    drawBox(g, tree, fs, x, y, color);
  }

  M.Math = { parse, width, height, render };
})();
