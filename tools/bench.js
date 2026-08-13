"use strict";

const { createSandbox, loadModule } = require("../test/helpers/shim");

function buildTree(mm, total, children) {
  const root = mm.Model.createNode("root");
  const queue = [root];
  let count = 1;
  while (count < total && queue.length) {
    const parent = queue.shift();
    for (let i = 0; i < children && count < total; i++) {
      const node = mm.Model.createNode("\u8282\u70b9" + count + " \u6d4b\u8bd5" + i);
      parent.children.push(node);
      queue.push(node);
      count++;
    }
  }
  mm.Model.replaceRoot(root);
  return root;
}

function time(fn) {
  const t0 = process.hrtime.bigint();
  const out = fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, out };
}

function bench(n) {
  const env = createSandbox();
  loadModule(env.sandbox, "model");
  const mm = env.sandbox.window.MM;
  const THEME = { rootFs: 16, nodeFs: 14, fontFamily: "sans-serif", canvasBg: "#fff", line: "#888", accents: [] };
  mm.Theme = { get: () => THEME };
  mm.Search = { currentMatches: () => new Set() };
  loadModule(env.sandbox, "layout");
  loadModule(env.sandbox, "render");

  function makeSvg() {
    return {
      innerHTML: "",
      setAttribute() {},
      getAttribute() { return null; },
      appendChild() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      ownerSVGElement: null,
      children: []
    };
  }
  mm.Render.init(makeSvg());
  env.sandbox.getComputedStyle = () => ({ getPropertyValue: () => "" });

  const root = buildTree(mm, n, 4);
  const layout = time(() => mm.Layout.layoutAll());
  const render = time(() => mm.Render.render());
  const svg = time(() => mm.Render.toSVGString(null, "white"));
  console.log(
    String(n).padStart(6) + " \u8282\u70b9  layout=" + layout.ms.toFixed(1).padStart(7) + "ms  render=" +
    render.ms.toFixed(1).padStart(7) + "ms  svg=" + svg.ms.toFixed(1).padStart(7) + "ms"
  );
}

for (const n of [200, 500, 1000, 2000, 5000]) bench(n);
console.log("done");