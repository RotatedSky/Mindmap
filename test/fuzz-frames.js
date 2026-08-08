"use strict";
const { setup } = require("./helpers/shim");
const assert = require("node:assert");

const THEME = { rootFs: 16, nodeFs: 14, fontFamily: "sans-serif" };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randTree(mm, rng, depth) {
  const root = mm.Model.createNode("r" + Math.floor(rng() * 1000));
  function fill(n, d) {
    const k = d >= 4 ? 0 : Math.floor(rng() * 4);
    for (let i = 0; i < k; i++) {
      const c = mm.Model.addChild(n, "n" + Math.floor(rng() * 1000));
      fill(c, d + 1);
    }
  }
  fill(root, 0);
  mm.Model.replaceRoot(root);
  return root;
}

function collect(mm) {
  return mm.Model.visibleNodes(mm.Model.root);
}

function randomFrames(mm, rng) {
  const nodes = collect(mm).filter((n) => n !== mm.Model.root);
  if (!nodes.length) return;
  const tries = 1 + Math.floor(rng() * 4);
  for (let t = 0; t < tries; t++) {
    const k = 1 + Math.floor(rng() * 3);
    if (k === 1) {
      mm.Model.addFrame([nodes[Math.floor(rng() * nodes.length)].id]);
    } else {
      const base = nodes[Math.floor(rng() * nodes.length)];
      const set = [base.id];
      for (let i = 1; i < k; i++) {
        const cand = nodes[Math.floor(rng() * nodes.length)];
        if (cand.id !== base.id && !set.includes(cand.id)) set.push(cand.id);
      }
      mm.Model.addFrame(set);
    }
  }
  for (const f of mm.Model.frames) {
    if (rng() < 0.5) mm.Model.setFrameLabel(f.id, "L" + Math.floor(rng() * 100));
  }
}

function withinF(mm, inner, outer) {
  for (const id of inner.nodes) {
    let n = mm.Model.find(mm.Model.root, id);
    let inside = false;
    while (n) {
      if (outer.nodes.includes(n.id)) { inside = true; break; }
      n = mm.Model.findParent(mm.Model.root, n.id);
    }
    if (!inside) return false;
  }
  return true;
}

function isNested(mm, outer, inner) {
  if (outer === inner) return false;
  return withinF(mm, inner, outer) && !withinF(mm, outer, inner);
}

let failures = 0;
function check(cond, msg, ctx) {
  if (!cond) {
    failures++;
    console.log("FAIL:", msg);
    if (ctx) dumpFailure(ctx);
  }
}

function dumpFailure(ctx) {
  const dirPath = require("path").join(__dirname, "failures");
  require("fs").mkdirSync(dirPath, { recursive: true });
  const file = require("path").join(dirPath, "fuzz-" + ctx.seed + "-r" + ctx.run + "-" + ctx.dir + ".json");
  require("fs").writeFileSync(file, JSON.stringify(ctx.mm.Model.serialize()));
  console.log("现场已留存:", file);
  console.log("复现: node test/repro.js " + file + " " + ctx.dir);
}

function run(seed, count, dirs) {
  let rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const ctx = { mm: null, seed, run: i, dir: null };
    const mm = setup(["model", "math", "layout", "render"]).mm;
    const root = randTree(mm, rng);
    randomFrames(mm, rng);
    const dir = dirs[Math.floor(rng() * dirs.length)];
    ctx.mm = mm;
    ctx.dir = dir;
    mm.Layout.treeLayout(root, dir, THEME);
    const vis = new Set(collect(mm).map((n) => n.id));
    const geos = mm.Model.frames.map((f) => mm.Render.frameGeometry(f, vis));
    for (let a = 0; a < geos.length; a++) {
      if (!geos[a]) continue;
      const fa = mm.Model.frames[a];
      for (let b = a + 1; b < geos.length; b++) {
        if (!geos[b]) continue;
        const fb = mm.Model.frames[b];
        const ga = geos[a], gb = geos[b];
        const dx = Math.max(ga.x, gb.x) - Math.min(ga.x + ga.w, gb.x + gb.w);
        const dy = Math.max(ga.y, gb.y) - Math.min(ga.y + ga.h, gb.y + gb.h);
        const na = isNested(mm, fa, fb), nb = isNested(mm, fb, fa);
        if (na || nb) {
          const out = na ? fa : fb, inn = na ? fb : fa;
          const go = na ? ga : gb, gi = na ? gb : ga;
          check(go.x + go.w - gi.x >= 14 - 0.01, "嵌套左间隔 <14", ctx);
          check(go.y + go.h - gi.y >= 14 - 0.01, "嵌套下间隔 <14", ctx);
          check(gi.x + gi.w - go.x >= 14 - 0.01, "嵌套右间隔 <14", ctx);
          check(gi.y + gi.h - go.y >= 14 - 0.01, "嵌套上间隔 <14", ctx);
          const pillTop = gi.y - 14;
          if (inn.label) {
            if (!(pillTop >= go.y - 0.01)) {
              console.log("=== pill 穿出 run", i, "dir", dir, "===");
              console.log("out:", JSON.stringify({ id: out.id, nodes: out.nodes, label: out.label, geo: go }));
              console.log("inn:", JSON.stringify({ id: inn.id, nodes: inn.nodes, label: inn.label, geo: gi }));
              console.log("pads out:", mm.Layout.framePadTop(out.id), "inn:", mm.Layout.framePadTop(inn.id));
              console.log("frameList:", JSON.stringify(mm.Model.frames.map((f) => ({ id: f.id, nodes: f.nodes, label: f.label }))));
              console.log("nodes:", JSON.stringify(collect(mm).map((n) => ({ id: n.id, text: n.text, x: n.x, y: n.y, w: n.w, h: n.h, parent: mm.Model.findParent(mm.Model.root, n.id) && mm.Model.findParent(mm.Model.root, n.id).text }))));
              dumpFailure(ctx);
              process.exit(1);
            }
          }
        } else {
          if (dx < 0 && dy < 0) {
            console.log("=== intersect run", i, "dir", dir, "===");
            console.log("frames:", JSON.stringify(mm.Model.frames.map((f) => ({ nodes: f.nodes, label: f.label }))));
            console.log("geos A:", JSON.stringify(ga), "B:", JSON.stringify(gb));
            console.log("nodes:", JSON.stringify(collect(mm).map((n) => ({ id: n.id, x: n.x, y: n.y }))));
            dumpFailure(ctx);
            process.exit(1);
          }
        }
      }
      const fl = mm.Model.frames[a];
      if (fl.label) {
        const pillBot = geos[a].y + 6;
        for (const id of fl.nodes) {
          const n = mm.Model.find(mm.Model.root, id);
          if (!n) continue;
          const top = n.y - n.h / 2;
          check(pillBot <= top - 1, "pill 底压成员节点: pillBot=" + pillBot + " nTop=" + top, ctx);
        }
      }
    }
  }
}

console.log("seed=20260808 5000 runs, 6 dirs...");
run(20260808, 5000, ["right", "left", "top", "bottom", "mindmap", "balanced"]);
console.log(failures ? failures + " FAILURES" : "ALL OK");
process.exit(failures ? 1 : 0);
