"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

const THEME = {
  rootFs: 16, nodeFs: 14, fontFamily: "sans-serif",
  accent: "#f09", line: "#888", canvasBg: "#fff",
  foldBg: "#eee", foldFg: "#333"
};

function fresh() {
  return setup(["model", "layout", "render"]);
}

function fixture(mm) {
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  const b = mm.Model.addChild(root, "B");
  mm.Model.addChild(root, "C");
  mm.Model.replaceRoot(root);
  const rel = mm.Model.addRelation(a.id, b.id);
  mm.Model.setRelationLabel(rel.id, "L");
  mm.Model.addFrame([a.id, b.id]);
  return { root, a, b, rel };
}

test("SVG 导出包含关联曲线、箭头与外框", () => {
  const { mm } = fresh();
  const { root } = fixture(mm);
  mm.Theme.get = () => THEME;
  mm.Layout.treeLayout(root, "right", THEME);
  const svg = mm.Render.toSVGString(null, "white");
  assert.ok(/class="rel-path"/.test(svg), "应包含关联曲线");
  assert.ok(/class="rel-arrow"/.test(svg), "应包含关联箭头");
  assert.ok(/class="rel-label"/.test(svg), "应包含关联标签");
  assert.ok(/class="frame-rect"/.test(svg), "应包含外框矩形");
  assert.ok(!/rel-hit/.test(svg), "不应包含命中区");
  assert.ok(!/rel-handle/.test(svg), "不应包含端点手柄");
  assert.ok(!/frame-hit/.test(svg), "不应包含外框命中区");
});

test("导出不受选中状态影响（手柄、加粗、选中色不进入导出）", () => {
  const { mm } = fresh();
  const { root, rel } = fixture(mm);
  mm.Theme.get = () => THEME;
  mm.Layout.treeLayout(root, "right", THEME);
  const f = mm.Model.frames[0];
  mm.Editor = { selectedRelationId: () => rel.id, selectedFrameId: () => f.id };
  const svg = mm.Render.toSVGString(null, "white");
  assert.ok(!/rel-handle/.test(svg), "选中手柄不应进入导出");
  const pathM = svg.match(/<path[^>]*class="rel-path"[^>]*>/);
  assert.ok(pathM, "应有关联曲线");
  assert.ok(/stroke-width="2\.5"/.test(pathM[0]), "关联线宽应保持 2.5");
  assert.ok(!/stroke-width="4"/.test(pathM[0]), "选中加粗不应进入导出");
  assert.ok(/stroke="#f09"/.test(pathM[0]), "关联线用默认主题色（非泄漏）");
  const rectM = svg.match(/<rect[^>]*class="frame-rect"[^>]*>/);
  assert.ok(rectM, "应有外框矩形");
  assert.ok(/stroke="#888"/.test(rectM[0]), "外框应为默认线条色");
  assert.ok(/stroke-width="1\.5"/.test(rectM[0]), "外框线宽应保持 1.5");
});

test("导出尺寸覆盖外框范围，背景色正确", () => {
  const { mm } = fresh();
  const { root, b } = fixture(mm);
  mm.Theme.get = () => THEME;
  mm.Layout.treeLayout(root, "right", THEME);
  mm.Model.addChild(b, "B1");
  mm.Layout.treeLayout(root, "right", THEME);
  const f = mm.Model.frames[0];
  const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
  const fg = mm.Render.frameGeometry(f, vis);
  const bounds = mm.Layout.bounds(mm.Model.visibleNodes(root));
  assert.ok(fg.x + fg.w > bounds.maxX, "外框应超出节点包围盒右边界");
  const svg = mm.Render.toSVGString(null, "white");
  const m = svg.match(/<rect[^>]*fill="#ffffff"[^>]*>/);
  assert.ok(m, "白色背景矩形应在导出中");
  const h = parseFloat(svg.match(/height="([\d.]+)"/)[1]);
  const w = parseFloat(svg.match(/width="([\d.]+)"/)[1]);
  assert.ok(w >= fg.x + fg.w - bounds.minX + 40, "导出宽度应覆盖外框右边缘");
});
