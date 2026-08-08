"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

const THEME = { rootFs: 16, nodeFs: 14, fontFamily: "sans-serif" };

function fresh() {
  return setup(["model", "math", "layout", "render"]);
}

function siblings(mm) {
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "Alpha");
  const b = mm.Model.addChild(root, "Beta");
  mm.Model.addChild(b, "Beta1");
  mm.Model.replaceRoot(root);
  return { root, a, b };
}

test("兄弟关系：端点位于无上级连线的一侧（右布局）", () => {
  const { mm } = fresh();
  const { root, a, b } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(a.id, b.id);
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.equal(geo.pa.x, a.x + a.w / 2, "A 端点应在右侧边缘（父在左侧）");
  assert.equal(geo.pa.y, a.y);
  assert.equal(geo.pb.x, b.x + b.w / 2, "B 端点应在右侧边缘（父在左侧）");
  assert.equal(geo.pb.y, b.y);
});

test("根节点作为端点：无父节点时朝向对方节点", () => {
  const { mm } = fresh();
  const { root, a } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(root.id, a.id);
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.equal(geo.pa.x, root.x + root.w / 2, "根端点应在右边缘");
  const t = (root.w / 2) / (a.x - root.x);
  assert.equal(geo.pa.y, root.y + t * (a.y - root.y), "沿朝 A 中心的射线出边");
  assert.equal(geo.pb.x, a.x + a.w / 2, "A 端点仍在自由侧（右边缘）");
  assert.equal(geo.pb.y, a.y);
});

test("balanced 左侧子节点：端点位于左边缘", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  const kids = [];
  for (let i = 0; i < 3; i++) kids.push(mm.Model.addChild(root, "K" + i));
  mm.Model.replaceRoot(root);
  mm.Layout.treeLayout(root, "balanced", THEME);
  assert.deepEqual(kids.map((k) => k.side), [1, -1, 1]);
  const [a, b] = kids;
  const rel = mm.Model.addRelation(a.id, b.id);
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.equal(geo.pa.x, a.x + a.w / 2, "右侧子节点端点应在右边缘");
  assert.equal(geo.pb.x, b.x - b.w / 2, "左侧子节点端点应在左边缘");
  assert.equal(geo.pb.y, b.y);
});

test("fromPt/toPt：端点落在节点边框上", () => {
  const { mm } = fresh();
  const { root, a, b } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(a.id, b.id);
  rel.fromPt = { x: 0, y: -100 };
  rel.toPt = { x: 100, y: 0 };
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.equal(geo.pa.x, a.x, "fromPt 垂直方向 → 顶部边缘中点");
  assert.equal(geo.pa.y, a.y - a.h / 2);
  assert.equal(geo.pb.x, b.x + b.w / 2, "toPt 水平方向 → 右侧边缘中点");
  assert.equal(geo.pb.y, b.y);
});

test("端点偏移越界或在节点内部时钳制到边框", () => {
  const { mm } = fresh();
  const { root, a, b } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(a.id, b.id);
  rel.fromPt = { x: 1000, y: 1000 };
  let geo = mm.Render.relationGeometry(rel);
  assert.equal(geo.pa.x, a.x + a.w / 2, "越界 → 右下角");
  assert.equal(geo.pa.y, a.y + a.h / 2);
  rel.fromPt = { x: 2, y: 2 };
  geo = mm.Render.relationGeometry(rel);
  assert.equal(geo.pa.y, a.y + a.h / 2, "内部点推到最近边（底边）");
  assert.equal(geo.pa.x, a.x + 2);
});

test("override 预览端点同样钳制在边框", () => {
  const { mm } = fresh();
  const { root, a, b } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(a.id, b.id);
  const geo = mm.Render.relationGeometry(rel, THEME, { from: { x: 99999, y: -99999 } });
  assert.ok(geo);
  assert.equal(geo.pa.x, a.x + a.w / 2);
  assert.equal(geo.pa.y, a.y - a.h / 2);
  assert.equal(geo.pb.x, b.x + b.w / 2, "未覆盖的 to 端点仍为默认锚点");
});

test("fromPt 随序列化保存，旧数据无 fromPt 时用默认锚点", () => {
  const { mm } = fresh();
  const { root, a, b } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(a.id, b.id);
  rel.fromPt = { x: -3, y: 6 };
  const data = JSON.parse(JSON.stringify(mm.Model.serialize()));

  const mm2 = fresh().mm;
  mm2.Model.deserialize(data);
  mm2.Layout.treeLayout(mm2.Model.root, "right", THEME);
  const rel2 = mm2.Model.relations[0];
  const a2 = mm2.Model.find(mm2.Model.root, rel2.from);
  const geo2 = mm2.Render.relationGeometry(rel2);
  assert.equal(geo2.pa.x, a2.x - 3, "fromPt 经序列化保留");
  assert.equal(geo2.pa.y, a2.y + a2.h / 2, "(-3,6) 钳制到底边");

  delete data.relations[0].fromPt;
  const mm3 = fresh().mm;
  mm3.Model.deserialize(data);
  mm3.Layout.treeLayout(mm3.Model.root, "right", THEME);
  const rel3 = mm3.Model.relations[0];
  const a3 = mm3.Model.find(mm3.Model.root, rel3.from);
  const geo3 = mm3.Render.relationGeometry(rel3);
  assert.equal(geo3.pa.x, a3.x + a3.w / 2, "无 fromPt → 默认自由侧锚点");
});

test("标签沿贝塞尔曲线定位：labelT 0/0.5/1 对应起点/中点/终点", () => {
  const { mm } = fresh();
  const { root, a, b } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(a.id, b.id);
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.equal(geo.labelX, (geo.pa.x + 3 * geo.c1.x + 3 * geo.c2.x + geo.pb.x) / 8, "无 labelT 默认 0.5");
  assert.equal(geo.labelY, (geo.pa.y + 3 * geo.c1.y + 3 * geo.c2.y + geo.pb.y) / 8);

  rel.labelT = 0;
  let g = mm.Render.relationGeometry(rel);
  assert.equal(g.labelX, geo.pa.x);
  assert.equal(g.labelY, geo.pa.y);

  rel.labelT = 1;
  g = mm.Render.relationGeometry(rel);
  assert.equal(g.labelX, geo.pb.x);
  assert.equal(g.labelY, geo.pb.y);

  rel.labelT = 0.5;
  g = mm.Render.relationGeometry(rel);
  assert.equal(g.labelX, (geo.pa.x + 3 * geo.c1.x + 3 * geo.c2.x + geo.pb.x) / 8);
  assert.equal(g.labelY, (geo.pa.y + 3 * geo.c1.y + 3 * geo.c2.y + geo.pb.y) / 8);
});

test("bezierPoint 与几何一致，labelT 序列化保留且越界钳制", () => {
  const { mm } = fresh();
  const { root, a, b } = siblings(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const rel = mm.Model.addRelation(a.id, b.id);
  const geo = mm.Render.relationGeometry(rel);
  const p = mm.Render.bezierPoint(0.5, geo.pa, geo.c1, geo.c2, geo.pb);
  assert.equal(p.x, geo.labelX);
  assert.equal(p.y, geo.labelY);

  mm.Model.setRelationLabelT(rel.id, 0.25);
  assert.equal(rel.labelT, 0.25);
  mm.Model.setRelationLabelT(rel.id, 5);
  assert.equal(rel.labelT, 1, "越界钳制到 1");

  const data = JSON.parse(JSON.stringify(mm.Model.serialize()));
  const mm2 = fresh().mm;
  mm2.Model.deserialize(data);
  assert.equal(mm2.Model.relations[0].labelT, 1, "labelT 经序列化保留");
});

function frameFixture(mm) {
  const root = mm.Model.createNode("root");
  const m1 = mm.Model.addChild(root, "M1");
  const m2 = mm.Model.addChild(root, "M2");
  const y = mm.Model.addChild(root, "Y");
  mm.Model.replaceRoot(root);
  mm.Model.addFrame([m1.id, m2.id]);
  return { root, m1, m2, y, f: mm.Model.frames[0] };
}

function frameBox(mm, f) {
  const vis = new Set(mm.Model.visibleNodes(mm.Model.root).map((n) => n.id));
  return mm.Render.frameGeometry(f, vis);
}

function onBorder(p, g) {
  return (p.x === g.x || p.x === g.x + g.w || p.y === g.y || p.y === g.y + g.h);
}

test("外框挂链：from 端点落在外框边界，to 端点为节点锚点", () => {
  const { mm } = fresh();
  const { root, m1, m2, y, f } = frameFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const fg = frameBox(mm, f);
  assert.ok(fg);
  const rel = mm.Model.addRelation(f.id, y.id, { fromFrame: true });
  assert.ok(rel, "外框→节点关联创建成功");
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.ok(onBorder(geo.pa, fg), "from 端点在外框矩形边界上");
  assert.ok(geo.pa.x >= fg.x && geo.pa.x <= fg.x + fg.w && geo.pa.y >= fg.y && geo.pa.y <= fg.y + fg.h);
  assert.equal(geo.pb.x, y.x + y.w / 2, "节点端使用自由侧锚点（右布局）");
  assert.equal(geo.pb.y, y.y);
});

test("节点→外框：to 端点落在外框边界", () => {
  const { mm } = fresh();
  const { root, y, f } = frameFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const fg = frameBox(mm, f);
  const rel = mm.Model.addRelation(y.id, f.id, { toFrame: true });
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.equal(geo.pa.x, y.x + y.w / 2, "from 端为节点");
  assert.ok(onBorder(geo.pb, fg), "to 端点在外框矩形边界上");
});

test("外框挂链：去重区分端点类型，序列化保留，删除外框清理关联", () => {
  const { mm } = fresh();
  const { root, y, f } = frameFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  assert.ok(mm.Model.addRelation(f.id, y.id, { fromFrame: true }));
  assert.equal(mm.Model.addRelation(f.id, y.id, { fromFrame: true }), null, "同类型重复拒绝");
  assert.ok(mm.Model.addRelation(f.id, y.id), "节点间关联与外框关联可共存");

  const data = JSON.parse(JSON.stringify(mm.Model.serialize()));
  const mm2 = fresh().mm;
  mm2.Model.deserialize(data);
  assert.equal(mm2.Model.relations[0].fromFrame, true, "fromFrame 经序列化保留");
  assert.equal(mm2.Model.relations[0].toFrame, undefined, "无 toFrame 标记");

  const f2 = mm2.Model.frames[0];
  mm2.Model.removeFrame(f2.id);
  assert.equal(mm2.Model.relations.some((r) => r.fromFrame), false, "删除外框清理挂链关联");
  assert.equal(mm2.Model.relations.length, 1, "节点间关联保留");
});

test("成员全部删除后外框自动移除并清理挂链关联", () => {
  const { mm } = fresh();
  const { root, m1, m2, y, f } = frameFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  mm.Model.addRelation(f.id, y.id, { fromFrame: true });
  mm.Model.removeNode(m1);
  mm.Model.removeNode(m2);
  assert.equal(mm.Model.frames.length, 0, "空外框被移除");
  assert.equal(mm.Model.relations.length, 0, "挂链关联被清理");
});

test("外框端点锚点：fromPt 相对框中心定位并随序列化保留", () => {
  const { mm } = fresh();
  const { root, y, f } = frameFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const fg = frameBox(mm, f);
  const rel = mm.Model.addRelation(f.id, y.id, { fromFrame: true });
  rel.fromPt = { x: 0, y: -1000 };
  const geo = mm.Render.relationGeometry(rel);
  assert.ok(geo);
  assert.equal(geo.pa.x, fg.x + fg.w / 2, "垂直向上锚点 → 框上边中点");
  assert.equal(geo.pa.y, fg.y);

  rel.fromPt = { x: -1000, y: 0 };
  const geo2 = mm.Render.relationGeometry(rel);
  assert.equal(geo2.pa.x, fg.x, "水平向左锚点 → 框左边中点");
  assert.equal(geo2.pa.y, fg.y + fg.h / 2);

  const data = JSON.parse(JSON.stringify(mm.Model.serialize()));
  const mm2 = fresh().mm;
  mm2.Model.deserialize(data);
  mm2.Layout.treeLayout(mm2.Model.root, "right", THEME);
  const rel2 = mm2.Model.relations[0];
  const g2 = mm2.Render.frameGeometry(mm2.Model.frames[0],
    new Set(mm2.Model.visibleNodes(mm2.Model.root).map((n) => n.id)));
  const geo3 = mm2.Render.relationGeometry(rel2);
  assert.equal(geo3.pa.x, g2.x, "fromPt 经序列化保留（框位置以反序列化后为准）");
  assert.equal(geo3.pa.y, g2.y + g2.h / 2);
});
