"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup, sameJSON } = require("./helpers/shim");

function fresh() {
  return setup(["model"]);
}

function freshRoot() {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  mm.Model.replaceRoot(root);
  return { mm, root };
}

test("createNode 返回默认节点", () => {
  const { mm } = fresh();
  const n = mm.Model.createNode("hello");
  assert.ok(n.id);
  assert.equal(n.text, "hello");
  assert.equal(n.children.length, 0);
  assert.equal(n.collapsed, false);
  assert.equal(n.image, null);
  assert.equal(n.link, null);
  assert.equal(n.color, null);
  assert.equal(n.notes, null);
  assert.equal(n.frame, null);
  assert.equal(n.freePos, null);
  assert.equal(n.align, undefined);
});

test("id 唯一递增", () => {
  const { mm } = fresh();
  const a = mm.Model.createNode("a");
  const b = mm.Model.createNode("b");
  assert.notEqual(a.id, b.id);
});

test("addChild 追加与插入", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  mm.Model.addChild(root, "first");
  mm.Model.addChild(root, "third");
  mm.Model.addChild(root, "second", 1);
  sameJSON(root.children.map((c) => c.text), ["first", "second", "third"]);
  assert.equal(root.collapsed, false);
});

test("addSibling 插到当前节点之后，根节点时作为子节点", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  mm.Model.addChild(root, "c");
  mm.Model.addSibling(a, "b");
  sameJSON(root.children.map((c) => c.text), ["a", "b", "c"]);
  const onRoot = mm.Model.addSibling(root, "d");
  assert.equal(mm.Model.findParent(root, onRoot.id), root);
});

test("removeNode 删除子树并清理引用", () => {
  const { mm, root } = freshRoot();
  const kid = mm.Model.addChild(root, "kid");
  const grand = mm.Model.addChild(kid, "grand");
  const rel = mm.Model.addRelation(root.id, grand.id);
  const frame = mm.Model.addFrame([kid.id]);
  mm.Model.selectNode(kid, false);
  mm.Model.removeNode(kid);
  assert.equal(mm.Model.find(root, kid.id), null);
  assert.equal(mm.Model.find(root, grand.id), null);
  assert.equal(mm.Model.relations.length, 0);
  assert.equal(mm.Model.relationsFor(root.id).length, 0);
  assert.equal(mm.Model.frames.length, 0);
  assert.ok(rel.id);
  assert.ok(frame.id);
  assert.equal(mm.Model.selectedNodes().length, 0);
});

test("removeNode 根节点时重置其字段", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  root.text = "root text";
  mm.Model.addChild(root, "x");
  mm.Model.selectNode(root, false);
  mm.Model.removeNode(root);
  assert.equal(root.text, "");
  assert.equal(root.children.length, 0);
  assert.equal(root.image, null);
  assert.equal(root.link, null);
  assert.equal(root.color, null);
  assert.equal(root.notes, null);
  assert.equal(root.frame, null);
  assert.equal(root.collapsed, false);
  assert.equal(root.freePos, null);
  assert.equal(mm.Model.selectedNodes().length, 0);
});

test("moveNode 移动、拒绝环与根节点", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(root, "b");
  const c = mm.Model.addChild(a, "c");
  assert.equal(mm.Model.moveNode(b, a), true);
  sameJSON(root.children.map((n) => n.text), ["a"]);
  assert.equal(mm.Model.moveNode(a, c), false);
  assert.equal(mm.Model.moveNode(root, a), false);
  assert.equal(mm.Model.moveNode(b, a), true);
});

test("isDescendant 判断祖先关系", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  const a = mm.Model.addChild(root, "a");
  const c = mm.Model.addChild(a, "c");
  assert.equal(mm.Model.isDescendant(a, c), true);
  assert.equal(mm.Model.isDescendant(c, a), false);
  assert.equal(mm.Model.isDescendant(root, c), true);
});

test("change/undo/redo 回退与重做", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  const original = root.text;
  mm.Model.change(() => { root.text = "changed"; });
  assert.equal(mm.Model.root.text, "changed");
  assert.equal(mm.Model.undo(), true);
  assert.equal(mm.Model.root.text, original);
  assert.equal(mm.Model.redo(), true);
  assert.equal(mm.Model.root.text, "changed");
  assert.equal(mm.Model.undo(), true);
  assert.equal(mm.Model.undo(), false);
  assert.equal(mm.Model.redo(), true);
  assert.equal(mm.Model.redo(), false);
});

test("undo 栈上限 100 条", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  for (let i = 0; i < 120; i++) {
    mm.Model.change(() => { root.text = "v" + i; });
  }
  let count = 0;
  while (mm.Model.undo()) count++;
  assert.equal(count, 100);
});

test("copy/paste 重映射 id 并保留子树与关系", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  const a = mm.Model.addChild(root, "a");
  const c = mm.Model.addChild(a, "c");
  mm.Model.addRelation(a.id, c.id);
  mm.Model.selectNode(a, false);
  assert.equal(mm.Model.copySelection(), true);
  const target = mm.Model.addChild(root, "target");
  assert.equal(mm.Model.pasteInto(target, 0), true);
  const pasted = target.children[target.children.length - 1];
  assert.notEqual(pasted.id, a.id);
  assert.equal(pasted.text, "a");
  assert.equal(pasted.children[0].text, "c");
  assert.notEqual(pasted.children[0].id, c.id);
  assert.ok(mm.Model.relations.some((r) => r.from === pasted.id && r.to === pasted.children[0].id));
  assert.equal(mm.Model.frames.length, 0);
});

test("paste 克隆不会共享引用", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  const a = mm.Model.addChild(root, "a");
  mm.Model.selectNode(a, false);
  mm.Model.copySelection();
  const t1 = mm.Model.addChild(root, "t1");
  const t2 = mm.Model.addChild(root, "t2");
  mm.Model.pasteInto(t1, 0);
  mm.Model.pasteInto(t2, 0);
  t1.children[t1.children.length - 1].text = "mutated";
  assert.equal(t2.children[t2.children.length - 1].text, "a");
});

test("visibleNodes 遵循折叠，allNodes 忽略", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  mm.Model.addChild(a, "hidden");
  mm.Model.addChild(root, "b");
  assert.equal(mm.Model.visibleNodes(root).length, 4);
  a.collapsed = true;
  const visible = mm.Model.visibleNodes(root);
  assert.equal(visible.length, 3);
  assert.equal(visible.some((n) => n.text === "hidden"), false);
  assert.equal(mm.Model.allNodes(root).length, 4);
});

test("selectNode 单选与多选切换", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(root, "b");
  mm.Model.selectNode(a, false);
  mm.Model.selectNode(b, true);
  sameJSON(mm.Model.selectedNodes().map((n) => n.text).sort(), ["a", "b"]);
  mm.Model.selectNode(b, true);
  sameJSON(mm.Model.selectedNodes().map((n) => n.text), ["a"]);
  assert.equal(mm.Model.primaryNode().id, a.id);
  mm.Model.clearSelection();
  assert.equal(mm.Model.selectedNodes().length, 0);
  assert.equal(mm.Model.primaryNode(), null);
});

test("setSelection 指定主节点", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(root, "b");
  mm.Model.setSelection([a.id, b.id], b.id);
  assert.equal(mm.Model.primaryNode().id, b.id);
  mm.Model.setSelection([], null);
  assert.equal(mm.Model.primaryNode(), null);
});

test("relations 去重与增删", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(root, "b");
  const r = mm.Model.addRelation(a.id, b.id);
  assert.ok(r);
  assert.equal(mm.Model.addRelation(a.id, b.id), null);
  assert.equal(mm.Model.addRelation(a.id, a.id), null);
  assert.equal(mm.Model.addRelation(null, b.id), null);
  assert.equal(mm.Model.relationsFor(a.id).length, 1);
  mm.Model.setRelationLabel(r.id, "rel label");
  assert.equal(mm.Model.relations[0].label, "rel label");
  assert.equal(mm.Model.removeRelation(r.id), true);
  assert.equal(mm.Model.relationsFor(a.id).length, 0);
  assert.equal(mm.Model.removeRelation(r.id), false);
});

test("frames 增删改与删除节点时清理", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(root, "b");
  const f = mm.Model.addFrame([a.id, b.id]);
  assert.ok(f.id);
  mm.Model.setFrameLabel(f.id, "group");
  assert.equal(mm.Model.frames[0].label, "group");
  mm.Model.removeNode(a);
  assert.equal(mm.Model.frames[0].nodes.includes(a.id), false);
  mm.Model.removeNode(b);
  assert.equal(mm.Model.frames.length, 0);
});

test("addFrame 拒绝重复成员框（不同顺序）", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(a, "b");
  mm.Model.addFrame([a.id, b.id]);
  const dup = mm.Model.addFrame([b.id, a.id]);
  assert.equal(dup, null);
  assert.equal(mm.Model.frames.length, 1);
});

test("addFrame 拒绝被现有框完全覆盖的框", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(a, "b");
  mm.Model.addFrame([a.id]);
  const covered = mm.Model.addFrame([a.id, b.id]);
  assert.equal(covered, null);
  assert.equal(mm.Model.frames.length, 1);
});

test("addFrame 允许完全在现有框内部的嵌套框", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const b = mm.Model.addChild(a, "b");
  mm.Model.addFrame([a.id, b.id]);
  const inner = mm.Model.addFrame([b.id]);
  assert.ok(inner);
  assert.equal(mm.Model.frames.length, 2);
});

test("serialize/deserialize 往返一致", () => {
  const { mm } = fresh();
  const root = mm.Model.root;
  mm.Model.addChild(root, "child");
  mm.Model.setSettings({ direction: "left" });
  const json = JSON.stringify(mm.Model.serialize());
  const obj = JSON.parse(json);
  mm.Model.reset();
  assert.equal(mm.Model.deserialize(obj), true);
  assert.equal(mm.Model.root.text, root.text);
  assert.equal(mm.Model.root.children.length, root.children.length);
  assert.equal(mm.Model.settings.direction, "left");
  assert.equal(mm.Model.settings.theme, "blue");
});

test("deserialize 拒绝坏数据", () => {
  const { mm } = fresh();
  assert.equal(mm.Model.deserialize(null), false);
  assert.equal(mm.Model.deserialize({}), false);
});

test("reset 恢复示例树并清空历史", () => {
  const { mm } = fresh();
  mm.Model.addChild(mm.Model.root, "x");
  mm.Model.change(() => { mm.Model.root.text = "y"; });
  mm.Model.reset();
  assert.ok(mm.Model.root.text);
  assert.equal(mm.Model.root.text, "欢迎使用思绪图工具");
  assert.equal(mm.Model.undo(), false);
});

test("replaceRoot 替换整树并清空历史", () => {
  const { mm } = fresh();
  const n = mm.Model.createNode("new root");
  mm.Model.addChild(n, "c1");
  mm.Model.replaceRoot(n);
  assert.equal(mm.Model.root.text, "new root");
  assert.equal(mm.Model.undo(), false);
});

test("onChange 回调触发", () => {
  const { mm } = fresh();
  let called = 0;
  mm.Model.onChange = () => { called++; };
  mm.Model.change(() => { mm.Model.root.text = "t"; });
  mm.Model.undo();
  mm.Model.redo();
  mm.Model.selectNode(mm.Model.root, false);
  mm.Model.clearSelection();
  assert.ok(called >= 5);
});

test("setFrameStyle 设置/删除/清空外框样式", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const f = mm.Model.addFrame([a.id]);
  mm.Model.setFrameStyle(f.id, "borderColor", "#ff0000");
  mm.Model.setFrameStyle(f.id, "borderWidth", 3);
  mm.Model.setFrameStyle(f.id, "dash", false);
  sameJSON(f.style, { borderColor: "#ff0000", borderWidth: 3, dash: false });
  mm.Model.setFrameStyle(f.id, "dash", null);
  sameJSON(f.style, { borderColor: "#ff0000", borderWidth: 3 });
  mm.Model.setFrameStyle(f.id, "borderColor", null);
  mm.Model.setFrameStyle(f.id, "borderWidth", null);
  assert.equal(f.style, null);
});

test("外框样式支持撤销/重做", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const f = mm.Model.addFrame([a.id]);
  mm.Model.record();
  mm.Model.setFrameStyle(f.id, "borderColor", "#123456");
  mm.Model.touch();
  assert.equal(mm.Model.frames[0].style.borderColor, "#123456");
  mm.Model.undo();
  assert.equal(mm.Model.frames[0].style, undefined, "撤销恢复无样式快照");
  mm.Model.redo();
  assert.equal(mm.Model.frames[0].style.borderColor, "#123456", "重做恢复样式");
});

test("外框样式序列化往返保留且旧数据兼容", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  const f = mm.Model.addFrame([a.id]);
  mm.Model.setFrameStyle(f.id, "borderColor", "#00ff00");
  mm.Model.setFrameStyle(f.id, "dash", false);
  const obj = JSON.parse(JSON.stringify(mm.Model.serialize()));
  assert.equal(obj.frames[0].style.borderColor, "#00ff00");

  const mm2 = fresh().mm;
  mm2.Model.deserialize(obj);
  assert.equal(mm2.Model.frames[0].style.borderColor, "#00ff00");
  assert.equal(mm2.Model.frames[0].style.dash, false);

  const legacy = JSON.parse(JSON.stringify(obj));
  legacy.frames[0].style = undefined;
  legacy.frames[0].label = "L";
  const mm3 = fresh().mm;
  assert.equal(mm3.Model.deserialize(legacy), true);
  assert.equal(mm3.Model.frames[0].style, undefined, "旧数据无 style 字段不报错");
  assert.equal(mm3.Model.frames[0].label, "L");
});

test("粘贴节点复制外框时保留样式", () => {
  const { mm, root } = freshRoot();
  const a = mm.Model.addChild(root, "a");
  mm.Model.addChild(a, "a1");
  const f = mm.Model.addFrame([a.id, a.children[0].id]);
  mm.Model.setFrameStyle(f.id, "borderWidth", 4);
  mm.Model.selectNode(a, false);
  assert.equal(mm.Model.copySelection(), true);
  const target = mm.Model.addChild(root, "t");
  assert.equal(mm.Model.pasteInto(target, "after"), true);
  const pasted = mm.Model.frames.find((x) => x.id !== f.id);
  assert.ok(pasted, "应复制出外框");
  assert.equal(pasted.style.borderWidth, 4, "外框样式随粘贴复制");
});
