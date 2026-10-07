"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup, sameJSON } = require("./helpers/shim.js");

function hit() {
  return setup(["editor"]).mm.Editor.nearestRectIndex;
}

function rect(left, top, right, bottom) {
  return { left, top, right, bottom };
}

function freshModelEditor() {
  return setup(["model", "editor"]);
}

function treeABC(mm) {
  const root = mm.Model.createNode("root");
  mm.Model.replaceRoot(root);
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(root, "b");
  const c = mm.Model.addChild(root, "c");
  for (const n of [root, a, b, c]) { n.x = 0; n.y = 0; n.w = 100; n.h = 40; }
  a.y = 0; b.y = 100; c.y = 200;
  return { root, a, b, c };
}

test("nearestRectIndex: 命中矩形内部返回该索引", () => {
  const pick = hit();
  const rects = [rect(0, 0, 10, 10), rect(50, 50, 60, 60)];
  assert.equal(pick(rects, 5, 5, 10), 0);
  assert.equal(pick(rects, 55, 55, 10), 1);
});

test("nearestRectIndex: 矩形边上距离为 0", () => {
  const pick = hit();
  const rects = [rect(0, 0, 10, 10)];
  assert.equal(pick(rects, 0, 5, 0), 0);
  assert.equal(pick(rects, 10, 10, 0), 0);
  assert.equal(pick(rects, 5, 0, 0), 0);
});

test("nearestRectIndex: 容差内四侧与角落命中", () => {
  const pick = hit();
  const rects = [rect(100, 100, 140, 130)];
  assert.equal(pick(rects, 92, 115, 10), 0);
  assert.equal(pick(rects, 148, 115, 10), 0);
  assert.equal(pick(rects, 120, 91, 10), 0);
  assert.equal(pick(rects, 120, 139, 10), 0);
  assert.equal(pick(rects, 93, 93, 10), 0);
});

test("nearestRectIndex: 角落按欧氏距离判定，超出容差返回 -1", () => {
  const pick = hit();
  const rects = [rect(100, 100, 140, 130)];
  assert.equal(pick(rects, 94, 94, 10), 0);
  assert.equal(pick(rects, 92, 92, 10), -1);
  assert.equal(pick(rects, 89, 115, 10), -1);
  assert.equal(pick(rects, 120, 87, 10), -1);
});

test("nearestRectIndex: 容差边界值（距离 = slop）算命中", () => {
  const pick = hit();
  const rects = [rect(0, 0, 10, 10)];
  assert.equal(pick(rects, 20, 5, 10), 0);
  assert.equal(pick(rects, 20.5, 5, 10), -1);
});

test("nearestRectIndex: 多个候选时取最近，与顺序无关", () => {
  const pick = hit();
  const near = rect(0, 0, 10, 10);
  const far = rect(16, 0, 26, 10);
  assert.equal(pick([near, far], 12, 5, 10), 0);
  assert.equal(pick([near, far], 14, 5, 10), 1);
  assert.equal(pick([far, near], 14, 5, 10), 0);
});

test("nearestRectIndex: 距离相同时取靠前索引（确定性）", () => {
  const pick = hit();
  const left = rect(0, 0, 10, 10);
  const right = rect(20, 0, 30, 10);
  assert.equal(pick([left, right], 15, 5, 10), 0);
});

test("nearestRectIndex: 空列表与零容差", () => {
  const pick = hit();
  assert.equal(pick([], 5, 5, 10), -1);
  assert.equal(pick([rect(0, 0, 10, 10)], 15, 5, 0), -1);
});

test("nearestRectIndex: 屏幕像素容差与缩放无关", () => {
  const pick = hit();
  const zoomedOut = [rect(0, 0, 4, 4), rect(30, 0, 34, 4)];
  assert.equal(pick(zoomedOut, 2, 2, 10), 0);
  assert.equal(pick(zoomedOut, 22, 2, 10), 1);
  assert.equal(pick(zoomedOut, 17, 2, 10), -1);
});

test("classifyTreeDrop: 上下边缘为排序带、中间为挂载", () => {
  const { mm } = freshModelEditor();
  const { a, b } = treeABC(mm);
  assert.equal(mm.Editor.classifyTreeDrop(a, b, 100).kind, "child");
  assert.equal(mm.Editor.classifyTreeDrop(a, b, 82).kind, "before");
  assert.equal(mm.Editor.classifyTreeDrop(a, b, 118).kind, "after");
});

test("classifyTreeDrop: 非法目标返回 null", () => {
  const { mm } = freshModelEditor();
  const { root, a, b } = treeABC(mm);
  assert.equal(mm.Editor.classifyTreeDrop(a, a, 0), null);
  const kid = mm.Model.addChild(a, "kid");
  assert.equal(mm.Editor.classifyTreeDrop(a, kid, 0), null);
  assert.equal(mm.Editor.classifyTreeDrop(kid, a, 0), null);
  assert.equal(mm.Editor.classifyTreeDrop(a, root, 0), null);
});

test("resolveTreeDrop: 同父 before/after 换算为插入位置", () => {
  const { mm } = freshModelEditor();
  const { a, b, c } = treeABC(mm);
  let op = mm.Editor.resolveTreeDrop(c, { kind: "before", target: a });
  assert.equal(op.parent, mm.Model.findParent(mm.Model.root, a.id));
  assert.equal(op.index, 0);
  op = mm.Editor.resolveTreeDrop(a, { kind: "after", target: b });
  assert.equal(op.index, 1);
  assert.equal(mm.Editor.resolveTreeDrop(a, { kind: "before", target: b }), null);
  assert.equal(mm.Editor.resolveTreeDrop(b, { kind: "after", target: a }), null);
});

test("resolveTreeDrop: 跨父 before 落到目标父的指定位置", () => {
  const { mm } = freshModelEditor();
  const { root, a, b } = treeABC(mm);
  const kid = mm.Model.addChild(a, "kid");
  const op = mm.Editor.resolveTreeDrop(kid, { kind: "before", target: b });
  assert.equal(op.parent.id, root.id);
  assert.equal(op.index, root.children.indexOf(b));
  const childOp = mm.Editor.resolveTreeDrop(kid, { kind: "child", target: b });
  assert.equal(childOp.parent.id, b.id);
});

test("resolveTreeDrop + moveNode: 排序落点真实改变顺序", () => {
  const { mm } = freshModelEditor();
  const { root, a, b, c } = treeABC(mm);
  const op = mm.Editor.resolveTreeDrop(c, { kind: "before", target: a });
  assert.ok(op);
  mm.Model.change(() => mm.Model.moveNode(c, op.parent, op.index));
  const cur = mm.Model.find(mm.Model.root, root.id);
  sameJSON(cur.children.map((n) => n.text), ["c", "a", "b"]);
});
