"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup, sameJSON } = require("./helpers/shim");

const THEME = { rootFs: 16, nodeFs: 14, fontFamily: "sans-serif" };
const FONT14 = "500 14px sans-serif";

function fresh() {
  const env = setup(["model", "math", "layout"]);
  return env;
}

test("splitParts 拆分文本与公式", () => {
  const { mm } = fresh();
  const parts = mm.Layout.splitParts("a$E=mc^2$b");
  assert.equal(parts.length, 3);
  assert.equal(parts[0].type, "text");
  assert.equal(parts[0].str, "a");
  assert.equal(parts[1].type, "math");
  assert.equal(parts[1].str, "E=mc^2");
  assert.ok(parts[1].tree);
  assert.equal(parts[2].type, "text");
  assert.equal(parts[2].str, "b");
});

test("splitParts 无公式时为纯文本", () => {
  const { mm } = fresh();
  const parts = mm.Layout.splitParts("plain text");
  assert.equal(parts.length, 1);
  assert.equal(parts[0].type, "text");
  assert.equal(parts[0].str, "plain text");
  const empty = mm.Layout.splitParts("");
  assert.equal(empty.length, 1);
  assert.equal(empty[0].type, "text");
  assert.equal(empty[0].str, "");
});

test("wrapParts 按宽度软折行", () => {
  const { mm } = fresh();
  const lines = mm.Layout.wrapParts("abcdefgh", 40, FONT14);
  assert.equal(lines.length, 2);
  for (const l of lines) {
    const w = l.reduce((s, p) => s + mm.Layout.measureText(p.str, FONT14), 0);
    assert.ok(w <= 40);
  }
});

test("wrapParts 显式换行分段", () => {
  const { mm } = fresh();
  const lines = mm.Layout.wrapParts("ab\ncd", 200, FONT14);
  assert.equal(lines.length, 2);
  assert.equal(lines[0][0].str, "ab");
  assert.equal(lines[1][0].str, "cd");
});

test("wrapParts 超宽公式独占一行", () => {
  const { mm } = fresh();
  const lines = mm.Layout.wrapParts("a$\\frac{aaaaaa}{bbbbbb}$b", 40, FONT14);
  assert.equal(lines.length, 3);
  assert.equal(lines[0][0].str, "a");
  assert.equal(lines[1][0].type, "math");
  assert.equal(lines[2][0].str, "b");
});

test("wrapText 公式行映射为 x", () => {
  const { mm } = fresh();
  const t = mm.Layout.wrapText("a$x$b", 200, FONT14);
  assert.equal(t[0], "axb");
});

test("truncate 超长截断加省略号", () => {
  const { mm } = fresh();
  assert.equal(mm.Layout.truncate("hello world", 40, FONT14), "hell\u2026");
  assert.equal(mm.Layout.truncate("hi", 40, FONT14), "hi");
  assert.equal(mm.Layout.truncate("", 40, FONT14), "");
  assert.equal(mm.Layout.truncate("abcdefgh", 64, FONT14), "abcdefgh");
});

test("fontMetrics 返回真实字形度量并缓存", () => {
  const { mm } = fresh();
  const m1 = mm.Layout.fontMetrics(FONT14);
  assert.equal(m1.ascent, 12);
  assert.equal(m1.descent, 3);
  assert.equal(m1.height, 15);
  assert.equal(mm.Layout.fontMetrics(FONT14), m1);
});

test("nodeSize 计算宽度与高度", () => {
  const { mm } = fresh();
  const n = mm.Model.createNode("hi");
  n.parentKind = "node";
  mm.Layout.nodeSize(n, THEME);
  assert.ok(n.w >= 40);
  assert.equal(n.h, mm.Layout.PAD_Y * 2 + 4 + Math.round(14 * 1.4));
});

test("nodeSize 感知自定义字号（行高随 fontSize 变化）", () => {
  const { mm } = fresh();
  const n = mm.Model.createNode("hi");
  n.parentKind = "node";
  n.style = { fontSize: 20 };
  mm.Layout.nodeSize(n, THEME);
  assert.equal(n.h, mm.Layout.PAD_Y * 2 + 4 + Math.round(20 * 1.4), "自定义字号行高");
  const bold = mm.Model.createNode("hi");
  bold.parentKind = "node";
  bold.style = { bold: true, fontSize: 14 };
  mm.Layout.nodeSize(bold, THEME);
  const plain = mm.Model.createNode("hi");
  plain.parentKind = "node";
  mm.Layout.nodeSize(plain, THEME);
  assert.equal(bold.h, plain.h, "加粗不影响尺寸（字体只换字重）");
});

test("nodeSize 多行高度累加", () => {
  const { mm } = fresh();
  const n = mm.Model.createNode("line1\nline2");
  n.parentKind = "node";
  mm.Layout.nodeSize(n, THEME);
  const single = mm.Model.createNode("one");
  single.parentKind = "node";
  mm.Layout.nodeSize(single, THEME);
  assert.equal(n.h, single.h + Math.round(14 * 1.4));
});

test("nodeSize 超宽文本宽度封顶", () => {
  const { mm } = fresh();
  const cap = mm.Layout.MAX_W + mm.Layout.PAD_X * 2;
  const n50 = mm.Model.createNode("w".repeat(50));
  n50.parentKind = "node";
  mm.Layout.nodeSize(n50, THEME);
  const n80 = mm.Model.createNode("w".repeat(80));
  n80.parentKind = "node";
  mm.Layout.nodeSize(n80, THEME);
  assert.ok(n80.w <= cap);
  assert.equal(n80.w, n50.w);
});

test("nodeSize 含图片时增加图片区高度", () => {
  const { mm } = fresh();
  const n = mm.Model.createNode("pic");
  n.image = "data:image/png;base64,xxx";
  n.parentKind = "node";
  mm.Layout.nodeSize(n, THEME);
  const plain = mm.Model.createNode("pic");
  plain.parentKind = "node";
  mm.Layout.nodeSize(plain, THEME);
  assert.equal(n.h, plain.h + mm.Layout.IMG_H + mm.Layout.IMG_GAP);
});

test("treeLayout 右向：子节点在右侧", () => {
  const { mm } = fresh();
  const root = mm.Model.sampleRoot();
  mm.Layout.treeLayout(root, "right", THEME);
  assert.equal(root.x, 0);
  assert.equal(root.y, 0);
  assert.equal(root.parentKind, "root");
  for (const c of root.children) {
    assert.equal(c.parentKind, "node");
    assert.ok(c.x > root.x);
    assert.equal(c.side, 1);
  }
});

test("treeLayout 左向：子节点在左侧", () => {
  const { mm } = fresh();
  const root = mm.Model.sampleRoot();
  mm.Layout.treeLayout(root, "left", THEME);
  for (const c of root.children) {
    assert.ok(c.x < root.x);
    assert.equal(c.side, -1);
  }
});

test("treeLayout 均衡：首层左右交替", () => {
  const { mm } = fresh();
  const root = mm.Model.sampleRoot();
  mm.Layout.treeLayout(root, "balanced", THEME);
  root.children.forEach((c, i) => {
    assert.equal(c.side, i % 2 === 0 ? 1 : -1);
  });
});

test("treeLayout 折叠后不布局子节点", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  mm.Model.addChild(root, "kid");
  root.collapsed = true;
  mm.Layout.treeLayout(root, "right", THEME);
  assert.equal(root.children[0].x, undefined);
});

test("freeLayout 依据 freePos 定位", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(root, "b");
  a.freePos = { x: 100, y: 50 };
  b.freePos = { x: -80, y: -30 };
  mm.Layout.freeLayout(root, THEME);
  assert.equal(a.x, 100);
  assert.equal(a.y, 50);
  assert.equal(b.x, -80);
  assert.equal(b.y, -30);
});

test("initFreePositions 从当前坐标回填", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  const a = mm.Model.addChild(root, "a");
  a.x = 10;
  a.y = 20;
  mm.Layout.initFreePositions();
  sameJSON(a.freePos, { x: 10, y: 20 });
});

test("bounds 计算包围盒，空集合返回零", () => {
  const { mm } = fresh();
  sameJSON(mm.Layout.bounds([]), { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  const root = mm.Model.sampleRoot();
  mm.Layout.treeLayout(root, "right", THEME);
  const b = mm.Layout.bounds(mm.Model.visibleNodes(root));
  assert.ok(b.minX <= 0 && b.maxX > 0);
  assert.ok(b.minY <= 0 && b.maxY > 0);
});

test("layoutAll 树形/自由模式派发", () => {
  const env = fresh();
  const { mm } = env;
  mm.Theme = { get: () => THEME };
  mm.Model.setSettings({ layoutMode: "tree", direction: "right" });
  mm.Layout.layoutAll();
  assert.equal(mm.Model.root.x, 0);
  mm.Model.setSettings({ layoutMode: "free" });
  mm.Layout.layoutAll();
  for (const n of mm.Model.visibleNodes(mm.Model.root)) {
    assert.ok(typeof n.x === "number");
    assert.ok(typeof n.y === "number");
  }
});
