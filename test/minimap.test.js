"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim.js");

function fresh() {
  const env = setup(["model", "layout", "render", "search", "minimap"]);
  const mm = env.mm;
  const root = mm.Model.createNode("\u6839");
  mm.Model.addChild(root, "A");
  const b = mm.Model.addChild(root, "B");
  mm.Model.addChild(b, "B1");
  mm.Model.replaceRoot(root);
  mm.Layout.treeLayout(mm.Model.root, mm.Model.settings.direction || "right", mm.Theme.get());
  const canvas = env.sandbox.document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 120;
  mm.Render.init(canvas);
  mm.Minimap.init(canvas);
  return { mm, canvas };
}

test("init wires pointer events on canvas", () => {
  const { canvas } = fresh();
  const listeners = (canvas._listeners || {});
  assert.ok(listeners.pointerdown, "pointerdown wired");
  assert.ok(listeners.pointermove, "pointermove wired");
  assert.ok(listeners.pointercancel, "pointercancel wired");
});

test("minimap module exposes minimap and drawViewport", () => {
  const { mm } = fresh();
  assert.equal(typeof mm.Minimap.minimap, "function");
  assert.equal(typeof mm.Minimap.drawViewport, "function");
});

test("render and setTransform trigger minimap without error", () => {
  const { mm } = fresh();
  mm.Render.render();
  mm.Render.setTransform(10, 20, 1.5);
  assert.equal(mm.Render.view.s, 1.5);
});

test("click on minimap centers main view at that world point", () => {
  const { mm, canvas } = fresh();
  mm.Render.render();
  mm.Render.setTransform(0, 0, 2);
  canvas.dispatch("pointerdown", { clientX: 90, clientY: 60, pointerId: 1, preventDefault() {} });
  const v = mm.Render.view;
  assert.equal(v.s, 2);
  assert.ok(Math.abs(v.tx) < 1e6);
  assert.ok(Math.abs(v.ty) < 1e6);
});

test("viewport 每次刷新都整幅重放底图，不残留旧框线（无拖影）", () => {
  const { mm, canvas } = fresh();
  const c = canvas.getContext("2d");
  let blits = 0;
  const orig = c.drawImage;
  c.drawImage = () => { blits++; };
  try {
    blits = 0;
    mm.Render.render();
    assert.equal(blits, 2, "render 自己 + setTransform 各整幅重放一次");
    const before = blits;
    mm.Minimap.drawViewport();
    assert.equal(blits, before + 1, "平移/缩放后整幅重放，覆盖旧视野框");
    const before2 = blits;
    mm.Render.setTransform(-5, -9, 0.5);
    assert.equal(blits, before2 + 1, "setTransform 刷新同样整幅重放");
  } finally {
    c.drawImage = orig;
  }
});