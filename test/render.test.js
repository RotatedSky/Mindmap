"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

const THEME = {
  rootFs: 16, nodeFs: 14, fontFamily: "sans-serif",
  accent: "#f09", line: "#888", canvasBg: "#fff",
  foldBg: "#eee", foldFg: "#333", radius: 10,
  nodeBg: "#eee", nodeBorder: "#aaa", nodeText: "#333",
  rootBg: "#2e6fb0", rootText: "#fff"
};

function fresh() {
  return setup(["model", "layout", "render"]);
}

function findNodeEl(el, id) {
  return el.children.find((c) => c.getAttribute("class") === "node" && c.getAttribute("data-id") === id);
}

function findRect(el) {
  return el.children.find((c) => c.getAttribute("class") === "nrect");
}

function findText(el) {
  return el.children.find((c) => c.tagName === "TEXT");
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

test("自定义样式应用到节点渲染（背景/文字/边框/粗细/圆角/字号/加粗）", () => {
  const { mm, singletonEl } = fresh();
  mm.Theme.get = () => THEME;
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  mm.Model.replaceRoot(root);
  a.style = { bg: "#112233", textColor: "#aabbcc", borderColor: "#ff0000", borderWidth: 3, radius: 0, fontSize: 20, bold: true };
  mm.Layout.treeLayout(root, "right", THEME);
  mm.Render.renderTreeInto(singletonEl);
  const grp = findNodeEl(singletonEl, a.id);
  const rect = findRect(grp);
  assert.equal(rect.getAttribute("fill"), "#112233", "背景色");
  assert.equal(rect.getAttribute("stroke"), "#ff0000", "边框色");
  assert.equal(rect.getAttribute("stroke-width"), "3", "边框粗细");
  assert.equal(rect.getAttribute("rx"), "0", "圆角");
  const t = findText(grp);
  assert.equal(t.getAttribute("font-size"), "20", "字号");
  assert.equal(t.getAttribute("font-weight"), "700", "加粗");
  assert.equal(t.children[0].getAttribute("fill"), "#aabbcc", "文字色");
});

test("无自定义样式时回退主题默认（子节点）", () => {
  const { mm, singletonEl } = fresh();
  mm.Theme.get = () => THEME;
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  mm.Model.replaceRoot(root);
  mm.Layout.treeLayout(root, "right", THEME);
  mm.Render.renderTreeInto(singletonEl);
  const rect = findRect(findNodeEl(singletonEl, a.id));
  assert.equal(rect.getAttribute("fill"), THEME.nodeBg, "默认背景来自主题");
  assert.equal(rect.getAttribute("stroke-width"), "1.5", "默认边框 1.5");
  const t = findText(findNodeEl(singletonEl, a.id));
  assert.equal(t.getAttribute("font-size"), String(THEME.nodeFs), "默认字号来自主题");
  assert.equal(t.getAttribute("font-weight"), "500", "默认字重 500");
});

test("style.bg 优先于 node.color，文字色独立于背景", () => {
  const { mm, singletonEl } = fresh();
  mm.Theme.get = () => THEME;
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  mm.Model.replaceRoot(root);
  a.color = "#ffffff";
  a.style = { bg: "#000000" };
  mm.Layout.treeLayout(root, "right", THEME);
  mm.Render.renderTreeInto(singletonEl);
  const rect = findRect(findNodeEl(singletonEl, a.id));
  assert.equal(rect.getAttribute("fill"), "#000000", "style.bg 覆盖 color");
  const t = findText(findNodeEl(singletonEl, a.id));
  assert.equal(t.children[0].getAttribute("fill"), "#222222", "文字按 color 亮度取色（未设 textColor）");
});

test("style 随 JSON 序列化保留，旧数据无 style 兼容", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  a.style = { bg: "#123456", bold: true };
  mm.Model.replaceRoot(root);
  const data = JSON.parse(JSON.stringify(mm.Model.serialize()));
  const mm2 = fresh().mm;
  mm2.Model.deserialize(data);
  const a2 = mm2.Model.find(mm2.Model.root, data.root.children[0].id);
  assert.equal(a2.style.bg, "#123456", "style 经序列化保留");
  assert.equal(a2.style.bold, true);

  delete data.root.children[0].style;
  const mm3 = fresh().mm;
  mm3.Model.deserialize(data);
  const a3 = mm3.Model.find(mm3.Model.root, data.root.children[0].id);
  assert.equal(a3.style, undefined, "旧数据无 style 字段");
});

test("导出 SVG 保留节点自定义样式", () => {
  const { mm } = fresh();
  mm.Theme.get = () => THEME;
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  mm.Model.replaceRoot(root);
  a.style = { bg: "#112233", borderColor: "#ff0000", borderWidth: 3, fontSize: 20, bold: true };
  mm.Layout.treeLayout(root, "right", THEME);
  const svg = mm.Render.toSVGString(null, "white");
  assert.ok(/fill="#112233"/.test(svg), "导出含自定义背景");
  assert.ok(/stroke="#ff0000"/.test(svg), "导出含自定义边框色");
  assert.ok(/stroke-width="3"/.test(svg), "导出含自定义边框粗细");
  assert.ok(/font-size="20"/.test(svg), "导出含自定义字号");
  assert.ok(/font-weight="700"/.test(svg), "导出含加粗");
});
