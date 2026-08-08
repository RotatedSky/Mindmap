"use strict";
const fs = require("fs");
const path = require("path");
const { setup } = require("./helpers/shim");

const THEME = { rootFs: 16, nodeFs: 14, fontFamily: "sans-serif" };

const file = process.argv[2];
const dir = process.argv[3] || "right";
if (!file) {
  console.log("用法: node test/repro.js <失败现场.json> [布局方向]");
  console.log("布局方向: right|left|top|bottom|mindmap|balanced");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const mm = setup(["model", "math", "layout", "render"]).mm;
if (!mm.Model.deserialize(data)) {
  console.log("deserialize 失败，现场 JSON 损坏");
  process.exit(1);
}
const root = mm.Model.root;
mm.Layout.treeLayout(root, dir, THEME);
console.log("方向:", dir);

const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
for (const f of mm.Model.frames) {
  const g = mm.Render.frameGeometry(f, vis);
  console.log("frame", f.id, JSON.stringify(f.nodes), "label=" + f.label, "geo=" + JSON.stringify(g),
    "pad=[" + [mm.Layout.framePadTop(f.id), mm.Layout.framePadBot(f.id), mm.Layout.framePadLeft(f.id), mm.Layout.framePadRight(f.id)].join(",") + "]");
}

let problems = 0;
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
    const na = withinF(mm, fb, fa) && !withinF(mm, fa, fb);
    const nb = withinF(mm, fa, fb) && !withinF(mm, fb, fa);
    if (na || nb) {
      const out = na ? fa : fb, inn = na ? fb : fa;
      const go = na ? ga : gb, gi = na ? gb : ga;
      const pad = mm.Layout.FRAME_PAD;
      const okL = go.x + go.w - gi.x >= pad - 0.01;
      const okB = go.y + go.h - gi.y >= pad - 0.01;
      const okR = gi.x + gi.w - go.x >= pad - 0.01;
      const okT = gi.y + gi.h - go.y >= pad - 0.01;
      const pillOk = !inn.label || gi.y - 14 >= go.y - 0.01;
      console.log("嵌套", out.id, "⊃", inn.id,
        "间隔 L/B/R/T =", (go.x + go.w - gi.x).toFixed(2), (go.y + go.h - gi.y).toFixed(2), (gi.x + gi.w - go.x).toFixed(2), (gi.y + gi.h - go.y).toFixed(2),
        "pill穿出=" + (!pillOk));
      if (!(okL && okB && okR && okT && pillOk)) problems++;
    } else if (dx < 0 && dy < 0) {
      console.log("相交", fa.id, fb.id, JSON.stringify(ga), JSON.stringify(gb));
      problems++;
    }
  }
}
for (const f of mm.Model.frames) {
  if (!f.label) continue;
  const g = mm.Render.frameGeometry(f, vis);
  for (const id of f.nodes) {
    const n = mm.Model.find(root, id);
    if (n && g.y + 6 > n.y - n.h / 2 - 1) {
      console.log("pill 压成员", f.id, n.text);
      problems++;
    }
  }
}
console.log(problems ? problems + " 处问题" : "复现检查通过（无相交、无穿出）");
process.exit(problems ? 1 : 0);

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
