"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup, sameJSON } = require("./helpers/shim");

function fresh() {
  return setup(["model"]);
}

function freshWithLayout() {
  return setup(["model", "layout"]);
}

test("模板库包含 5 套模板且字段完整、id 唯一", () => {
  const { mm } = fresh();
  const tpls = mm.Model.templates;
  assert.ok(Array.isArray(tpls));
  const ids = new Set();
  for (const t of tpls) {
    assert.ok(t.id && typeof t.id === "string", "模板 id");
    assert.ok(t.name && typeof t.name === "string", "模板名称");
    assert.ok(t.desc && typeof t.desc === "string", "模板描述");
    assert.equal(typeof t.build, "function", "模板 build");
    ids.add(t.id);
  }
  assert.equal(ids.size, tpls.length, "id 不应重复");
  assert.equal(tpls.length, 5);
});

test("applyTemplate 应用后根节点、关联与外框挂载正确", () => {
  const { mm } = fresh();
  const ok = mm.Model.applyTemplate("meeting");
  assert.equal(ok, true);
  const root = mm.Model.root;
  assert.equal(root.text, "会议纪要");
  assert.equal(root.children.length, 4);
  assert.equal(mm.Model.relations.length, 1);
  const rel = mm.Model.relations[0];
  assert.ok(rel.id, "关联 id 存在");
  assert.ok(mm.Model.find(root, rel.from), "from 节点存在");
  assert.ok(mm.Model.find(root, rel.to), "to 节点存在");
  assert.equal(mm.Model.frames.length, 1);
  const f = mm.Model.frames[0];
  assert.ok(f.id, "外框 id 存在");
  for (const nid of f.nodes) assert.ok(mm.Model.find(root, nid), "外框成员存在");
});

test("applyTemplate 未知 id 返回 false 且不改变状态", () => {
  const { mm } = fresh();
  const before = mm.Model.serialize();
  assert.equal(mm.Model.applyTemplate("nonexistent"), false);
  sameJSON(mm.Model.serialize(), before, "状态不应变化");
});

test("同一模板重复应用生成的 id 不冲突", () => {
  const { mm } = fresh();
  mm.Model.applyTemplate("project");
  const root1 = mm.Model.root;
  const relIds1 = mm.Model.relations.map((r) => r.id);
  const frameIds1 = mm.Model.frames.map((f) => f.id);
  mm.Model.applyTemplate("project");
  const root2 = mm.Model.root;
  assert.notEqual(root1.id, root2.id, "根节点 id 应重新生成");
  for (const id of relIds1) assert.ok(!mm.Model.relations.some((r) => r.id === id), "旧关联 id 不残留");
  for (const id of frameIds1) assert.ok(!mm.Model.frames.some((f) => f.id === id), "旧外框 id 不残留");
  const all = [root2.id];
  (function walk(n) { n.children.forEach((c) => { all.push(c.id); walk(c); }); })(root2);
  assert.equal(new Set(all).size, all.length, "节点 id 全部唯一");
});

test("思维发散模板应用自由布局设置与 freePos", () => {
  const { mm } = fresh();
  mm.Model.applyTemplate("brainstorm");
  assert.equal(mm.Model.settings.layoutMode, "free");
  const root = mm.Model.root;
  assert.equal(root.children.length, 4);
  for (const k of root.children) {
    assert.ok(k.freePos && typeof k.freePos.x === "number", "freePos 存在");
  }
  const xs = new Set(root.children.map((k) => k.freePos.x + "," + k.freePos.y));
  assert.equal(xs.size, 4, "四个角位置互不相同");
});

test("示例模板演示各功能字段", () => {
  const { mm } = fresh();
  mm.Model.applyTemplate("sample");
  const root = mm.Model.root;
  const has = (pred) => {
    let found = false;
    (function walk(n) {
      if (pred(n)) found = true;
      n.children.forEach(walk);
    })(root);
    return found;
  };
  assert.ok(has((n) => n.color), "演示节点着色");
  assert.ok(has((n) => n.link), "演示链接");
  assert.ok(has((n) => n.image), "演示图片");
  assert.ok(has((n) => n.notes), "演示备注");
  assert.ok(has((n) => /\$.*\$/.test(n.text)), "演示公式");
  assert.equal(mm.Model.relations.length, 1, "演示关联线");
  assert.equal(mm.Model.frames.length, 1, "演示外框");
});

test("sampleRoot 与示例模板一致（兼容旧调用）", () => {
  const { mm } = fresh();
  const s = mm.Model.sampleRoot();
  mm.Model.applyTemplate("sample");
  const t = mm.Model.root;
  assert.equal(s.text, t.text);
  assert.equal(s.children.length, t.children.length);
});

test("模板树可通过 treeLayout 正常布局", () => {
  const { mm } = freshWithLayout();
  mm.Model.applyTemplate("meeting");
  const T = { rootFs: 16, nodeFs: 14, fontFamily: "sans-serif" };
  mm.Layout.treeLayout(mm.Model.root, "right", T);
  let ok = true;
  (function walk(n) {
    if (n.children.length) {
      for (const c of n.children) {
        if (!(c.x > n.x + 10) && c.depth > 0) ok = false;
        walk(c);
      }
    }
  })(mm.Model.root);
  assert.ok(ok, "子节点应位于父节点右侧");
});
