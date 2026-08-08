"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

const THEME = {
  rootFs: 16, nodeFs: 14, fontFamily: "sans-serif",
  accent: "#f09", line: "#888", canvasBg: "#fff",
  foldBg: "#eee", foldFg: "#333", radius: 10
};

function fresh() {
  return setup(["model", "layout", "render"]);
}

function connectorStrokes(mm, el) {
  return el.children
    .filter((c) => c.getAttribute("class") === "connector")
    .map((c) => c.getAttribute("stroke"));
}

function exportStrokes(svg) {
  return [...svg.matchAll(/fill="none" stroke="([^"]+)" stroke-width="2"/g)].map((m) => m[1]);
}

function deepFixture(mm) {
  const root = mm.Model.createNode("root");
  let node = root;
  for (let i = 0; i < 7; i++) node = mm.Model.addChild(node, "x");
  mm.Model.addChild(root, "sib");
  mm.Model.replaceRoot(root);
  mm.Layout.treeLayout(root, "right", THEME);
  return root;
}

const RAINBOW = ["#e64545", "#e8883a", "#e6b800", "#3fae62", "#3a8fe0", "#8a5fd6"];

test("LINE_STYLES 暴露 6 套配置，default 排首位", () => {
  const { mm } = fresh();
  assert.equal(mm.Render.LINE_STYLES.length, 6);
  assert.equal(mm.Render.LINE_STYLES[0].id, "default");
  assert.ok(mm.Render.LINE_STYLES.every((s) => s.id && s.name));
});

test("默认单色：所有层级连线用主题线条色", () => {
  const { mm, singletonEl } = fresh();
  mm.Theme.get = () => THEME;
  deepFixture(mm);
  mm.Render.renderTreeInto(singletonEl);
  const strokes = connectorStrokes(mm, singletonEl);
  assert.equal(strokes.length, 8);
  assert.ok(strokes.every((s) => s === THEME.line));
});

test("彩虹：层级 1~7 依次取色，第 7 层循环回第 1 色", () => {
  const { mm, singletonEl } = fresh();
  mm.Theme.get = () => THEME;
  mm.Model.setSettings({ lineStyle: "rainbow" });
  deepFixture(mm);
  mm.Render.renderTreeInto(singletonEl);
  const strokes = connectorStrokes(mm, singletonEl);
  assert.deepEqual(strokes, [RAINBOW[0], RAINBOW[1], RAINBOW[2], RAINBOW[3], RAINBOW[4], RAINBOW[5], RAINBOW[0], RAINBOW[0]]);
});

test("未知/非法 lineStyle 回退主题线条色", () => {
  const { mm, singletonEl } = fresh();
  mm.Theme.get = () => THEME;
  mm.Model.setSettings({ lineStyle: "does-not-exist" });
  deepFixture(mm);
  mm.Render.renderTreeInto(singletonEl);
  assert.ok(connectorStrokes(mm, singletonEl).every((s) => s === THEME.line));
});

test("自由布局：所有连线用第 1 色", () => {
  const { mm, singletonEl } = fresh();
  mm.Theme.get = () => THEME;
  mm.Model.setSettings({ lineStyle: "rainbow" });
  const root = mm.Model.createNode("root");
  mm.Model.addChild(root, "A");
  mm.Model.addChild(root, "B");
  mm.Model.replaceRoot(root);
  mm.Layout.freeLayout(root, THEME);
  mm.Render.renderTreeInto(singletonEl);
  const strokes = connectorStrokes(mm, singletonEl);
  assert.ok(strokes.length >= 2);
  assert.ok(strokes.every((s) => s === RAINBOW[0]));
});

test("导出 SVG 连线颜色与画布渲染一致（彩虹循环）", () => {
  const { mm } = fresh();
  mm.Theme.get = () => THEME;
  mm.Model.setSettings({ lineStyle: "rainbow" });
  deepFixture(mm);
  const svg = mm.Render.toSVGString(null, "white");
  const strokes = exportStrokes(svg);
  assert.equal(strokes.length, 8);
  assert.deepEqual(strokes, [RAINBOW[0], RAINBOW[1], RAINBOW[2], RAINBOW[3], RAINBOW[4], RAINBOW[5], RAINBOW[0], RAINBOW[0]]);
});

test("lineStyle 随 JSON 序列化保留，旧数据回退默认", () => {
  const { mm } = fresh();
  mm.Model.setSettings({ lineStyle: "warm" });
  const data = JSON.parse(JSON.stringify(mm.Model.serialize()));
  const mm2 = fresh().mm;
  mm2.Model.deserialize(data);
  assert.equal(mm2.Model.settings.lineStyle, "warm", "lineStyle 经序列化保留");

  delete data.settings.lineStyle;
  const mm3 = fresh().mm;
  mm3.Model.deserialize(data);
  assert.equal(mm3.Model.settings.lineStyle, "default", "旧数据无 lineStyle 回退默认");
  mm3.Theme.get = () => THEME;
  mm3.Layout.treeLayout(mm3.Model.root, "right", THEME);
  const svg = mm3.Render.toSVGString(null, "white");
  assert.ok(exportStrokes(svg).every((s) => s === THEME.line));
});
