"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

const THEME = { rootFs: 16, nodeFs: 14, fontFamily: "sans-serif" };

function fresh() {
  const env = setup(["model", "math", "layout", "render"]);
  return env;
}

function treeFixture(mm) {
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  const b = mm.Model.addChild(root, "B");
  const c = mm.Model.addChild(root, "C");
  mm.Model.addChild(a, "A1");
  mm.Model.addChild(a, "A2");
  const b1 = mm.Model.addChild(b, "B1");
  mm.Model.addChild(b1, "B1a");
  mm.Model.addChild(c, "C1");
  mm.Model.replaceRoot(root);
  return { root, a, b, c, b1 };
}

function frameBox(mm, f) {
  const vis = new Set(mm.Model.visibleNodes(mm.Model.root).map((n) => n.id));
  return mm.Render.frameGeometry(f, vis);
}

function rect(n) {
  return { x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h };
}

function intersects(box, r) {
  return box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
}

function isDescendantOf(mm, root, id, ancestor) {
  let cur = mm.Model.find(root, id);
  while (cur) {
    if (cur.id === ancestor.id) return true;
    cur = mm.Model.findParent(root, cur.id);
  }
  return false;
}

test("外框包裹成员的整个子树（成员子节点在框内）", () => {
  const { mm } = fresh();
  const { root, b, c } = treeFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, { id: "f", nodes: [b.id, c.id] });
  assert.ok(box);
  assert.equal(intersects(box, rect(mm.Model.find(root, "b1") ? b.children[0] : {})), false);
  const b1 = b.children[0];
  assert.ok(intersects(box, rect(b1)), "B1 应在外框内");
  assert.ok(intersects(box, rect(b1.children[0])), "B1a 应在外框内");
});

test("外框不覆盖外部节点（非成员且非成员子孙）", () => {
  const { mm } = fresh();
  const { root, b, c } = treeFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, { id: "f", nodes: [b.id, c.id] });
  const memberIds = new Set([b.id, c.id]);
  for (const n of mm.Model.visibleNodes(root)) {
    if (memberIds.has(n.id)) continue;
    if (isDescendantOf(mm, root, n.id, b) || isDescendantOf(mm, root, n.id, c)) continue;
    assert.equal(intersects(box, rect(n)), false, "节点 " + n.text + " 不应与外框重叠");
  }
});

test("外框与相邻兄弟子树保持间隔", () => {
  const { mm } = fresh();
  const { root, a, b } = treeFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, { id: "f", nodes: [a.id, b.id] });
  const c = root.children[2];
  assert.equal(intersects(box, rect(c)), false, "C 子树不应与外框重叠");
  assert.ok(box.y + box.h <= c.y - c.h / 2 - 1, "框底与 C 顶应有间隔");
});

test("成员折叠后外框收缩（隐藏子孙不计入）", () => {
  const { mm } = fresh();
  const { root, a, b } = treeFixture(mm);
  a.collapsed = true;
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, { id: "f", nodes: [a.id, b.id] });
  const a1 = a.children[0];
  assert.equal(intersects(box, rect(a1)), false, "折叠隐藏的 A1 不应计入外框");
});

test("成员不可见时跳过，全部不可见返回 null", () => {
  const { mm } = fresh();
  const { root, b } = treeFixture(mm);
  root.collapsed = true;
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, { id: "f", nodes: [b.id] });
  assert.equal(box, null);
});

test("成员展开后重新布局，外框跟随子树范围", () => {
  const { mm } = fresh();
  const { root, b } = treeFixture(mm);
  const boxBefore = frameBox(mm, { id: "f", nodes: [b.id] });
  assert.equal(boxBefore, null);
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, { id: "f", nodes: [b.id] });
  assert.ok(intersects(box, rect(b.children[0])), "展开后 B1 应在外框内");
});

test("自由布局下外框同样包裹成员子树", () => {
  const { mm } = fresh();
  const { root, b } = treeFixture(mm);
  mm.Model.setSettings({ layoutMode: "free" });
  mm.Layout.freeLayout(root, THEME);
  const box = frameBox(mm, { id: "f", nodes: [b.id] });
  assert.ok(box);
  assert.ok(intersects(box, rect(b.children[0])), "自由布局下 B1 应在外框内");
});

test("任意树结构下外框不覆盖非成员外部节点", () => {
  const { mm } = fresh();
  const root = mm.Model.sampleRoot();
  const kids = root.children.slice(0, 3);
  mm.Model.replaceRoot(root);
  mm.Layout.treeLayout(root, "right", THEME);
  const f = { id: "f", nodes: kids.map((k) => k.id) };
  const box = frameBox(mm, f);
  const memberIds = new Set(f.nodes);
  for (const n of mm.Model.visibleNodes(root)) {
    if (memberIds.has(n.id)) continue;
    if (kids.some((k) => isDescendantOf(mm, root, n.id, k))) continue;
    assert.equal(intersects(box, rect(n)), false, "节点 " + n.text + " 不应与外框重叠");
  }
});

function leavesFixture(mm) {
  const root = mm.Model.createNode("root");
  const x = mm.Model.addChild(root, "X");
  const m1 = mm.Model.addChild(root, "M1");
  const m2 = mm.Model.addChild(root, "M2");
  const y = mm.Model.addChild(root, "Y");
  mm.Model.replaceRoot(root);
  return { root, x, m1, m2, y };
}

test("外框上缘恒预留标签空间，底部保持 FRAME_MARGIN 间距", () => {
  const { mm } = fresh();
  const { root, x, m1, m2, y } = leavesFixture(mm);
  mm.Model.addFrame([m1.id, m2.id]);
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, mm.Model.frames[0]);
  assert.ok(box);
  const distTop = box.y - (x.y + x.h / 2);
  const distBot = (y.y - y.h / 2) - (box.y + box.h);
  assert.equal(distTop, mm.Layout.FRAME_MARGIN + mm.Layout.FRAME_LABEL_TOP, "框顶与上方兄弟间距含标签预留");
  assert.equal(distBot, mm.Layout.FRAME_MARGIN, "框底与下方兄弟间距");
});

test("加标签不引起布局变化（无标签时已恒预留标签空间）", () => {
  const { mm } = fresh();
  const { root, x, m1, m2, y } = leavesFixture(mm);
  mm.Model.addFrame([m1.id, m2.id]);
  const f = mm.Model.frames[0];
  mm.Layout.treeLayout(root, "right", THEME);
  const plain = frameBox(mm, f);
  assert.ok(plain);
  const plainBotGap = (y.y - y.h / 2) - (plain.y + plain.h);
  const plainRelTop = plain.y - (m1.y - m1.h / 2);
  assert.equal(plain.y - (x.y + x.h / 2), mm.Layout.FRAME_MARGIN + mm.Layout.FRAME_LABEL_TOP,
    "无标签时已预留标签空间");
  assert.equal(plainBotGap, mm.Layout.FRAME_MARGIN);
  assert.equal(plainRelTop, -mm.Layout.FRAME_PAD, "成员顶与外框顶相对位置 = FRAME_PAD");

  f.label = "第一组";
  mm.Layout.treeLayout(root, "right", THEME);
  const labeled = frameBox(mm, f);
  assert.ok(labeled);
  assert.equal(labeled.w, plain.w, "外框宽度不变");
  assert.equal(labeled.h, plain.h, "外框高度不变");
  assert.equal(labeled.y, plain.y, "外框纵向位置不变");
  assert.equal(labeled.x, plain.x, "外框横向位置不变");
  assert.equal(x.y + x.h / 2, m1.y - m1.h / 2 - mm.Layout.FRAME_MARGIN - mm.Layout.FRAME_PAD - mm.Layout.FRAME_LABEL_TOP,
    "上方兄弟让出标签高度空间");

  const labelTop = labeled.y - 4 - 10;
  const labelBot = labeled.y - 4 + 10;
  assert.ok(labelBot <= m1.y - m1.h / 2 - 2, "标签底不压成员节点");
  assert.ok(labelTop >= x.y + x.h / 2 + mm.Layout.FRAME_MARGIN - 1, "标签顶与上方兄弟有间距");
});

test("非连续成员：中间兄弟被移出框范围并保持间距", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  const b = mm.Model.addChild(root, "B");
  const c = mm.Model.addChild(root, "C");
  mm.Model.replaceRoot(root);
  mm.Model.addFrame([a.id, c.id]);
  mm.Layout.treeLayout(root, "right", THEME);
  const box = frameBox(mm, mm.Model.frames[0]);
  assert.ok(box);
  assert.ok(b.y > c.y, "中间兄弟 B 应被移到最后一个成员 C 之后");
  const dist = (b.y - b.h / 2) - (box.y + box.h);
  assert.equal(dist, mm.Layout.FRAME_MARGIN, "B 与外框底间距");
});

test("外框与外框之间不重叠并保持 FRAME_SPACING 间距", () => {
  const { mm } = fresh();
  const { root, a, b, c } = treeFixture(mm);
  mm.Model.addFrame([a.id, b.id]);
  mm.Model.addFrame([c.id]);
  mm.Layout.treeLayout(root, "right", THEME);
  const box1 = frameBox(mm, mm.Model.frames[0]);
  const box2 = frameBox(mm, mm.Model.frames[1]);
  assert.ok(box1 && box2);
  assert.ok(box1.y + box1.h <= box2.y, "两个外框不应重叠");
  assert.equal(box2.y - (box1.y + box1.h), mm.Layout.FRAME_SPACING + mm.Layout.FRAME_LABEL_TOP,
    "框间间距 == FRAME_SPACING + 标签预留");
});

test("跨级外框互不重叠（成员在子树顶端与兄弟内）", () => {
  const { mm } = fresh();
  const { root, a, b } = treeFixture(mm);
  mm.Model.addFrame([a.id]);
  mm.Model.addFrame([b.children[0].id]);
  mm.Layout.treeLayout(root, "right", THEME);
  const box1 = frameBox(mm, mm.Model.frames[0]);
  const box2 = frameBox(mm, mm.Model.frames[1]);
  assert.ok(box1 && box2);
  assert.ok(box1.y + box1.h <= box2.y, "跨级外框不应重叠");
  assert.equal(box2.y - (box1.y + box1.h), mm.Layout.FRAME_SPACING + mm.Layout.FRAME_LABEL_TOP,
    "框间间距 == FRAME_SPACING + 标签预留");
});

test("成员在组深处时外框间距不小于 FRAME_SPACING", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "A");
  const b = mm.Model.addChild(root, "B");
  mm.Model.addChild(b, "B1");
  const b2 = mm.Model.addChild(b, "B2");
  mm.Model.replaceRoot(root);
  mm.Model.addFrame([a.id]);
  mm.Model.addFrame([b2.id]);
  mm.Layout.treeLayout(root, "right", THEME);
  const box1 = frameBox(mm, mm.Model.frames[0]);
  const box2 = frameBox(mm, mm.Model.frames[1]);
  assert.ok(box1 && box2);
  assert.ok(box1.y + box1.h <= box2.y, "跨级外框不应重叠");
  const dist = box2.y - (box1.y + box1.h);
  assert.ok(dist >= mm.Layout.FRAME_SPACING, "框间间距应不小于 FRAME_SPACING，实际 " + dist);
});

test("balanced 模式：推挤兄弟后侧向仍按原始顺序", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  const kids = [];
  for (let i = 0; i < 4; i++) kids.push(mm.Model.addChild(root, "K" + i));
  mm.Model.replaceRoot(root);
  mm.Model.addFrame([kids[0].id, kids[2].id]);
  mm.Layout.treeLayout(root, "balanced", THEME);
  const sides = kids.map((k) => k.side);
  assert.deepEqual(sides, [1, -1, 1, -1], "侧向应保持 右/左/右/左");
});

test("footprintOf 覆盖节点及全部子孙，折叠后收缩", () => {
  const { mm } = fresh();
  const { root, b, b1 } = treeFixture(mm);
  mm.Layout.treeLayout(root, "right", THEME);
  const bb = mm.Render.footprintOf(b);
  const wrap = { x: bb.minX, y: bb.minY, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY };
  assert.ok(intersects(wrap, rect(b)), "自身在足迹内");
  assert.ok(intersects(wrap, rect(b1)), "B1 在足迹内");
  assert.ok(intersects(wrap, rect(b1.children[0])), "B1a 在足迹内");
  b.collapsed = true;
  mm.Layout.treeLayout(root, "right", THEME);
  const bb2 = mm.Render.footprintOf(b);
  const wrap2 = { x: bb2.minX, y: bb2.minY, w: bb2.maxX - bb2.minX, h: bb2.maxY - bb2.minY };
  assert.equal(intersects(wrap2, rect(b1)), false, "折叠后隐藏子孙不计入");
});

test("单节点外框（frames 机制）绘制框包含全部子节点", () => {
  const env = fresh();
  const { mm } = env;
  const { root, b } = treeFixture(mm);
  mm.Theme.get = () => THEME;
  mm.Model.addFrame([b.id]);
  mm.Layout.treeLayout(root, "right", THEME);
  mm.Render.renderTreeInto(env.singletonEl, {});
  const rectEls = [];
  (function walk(el) {
    for (const c of el.children || []) {
      if (c._attrs && c._attrs.class === "frame-rect") rectEls.push(c);
      walk(c);
    }
  })(env.singletonEl);
  assert.equal(rectEls.length, 1, "应绘制一个 frame-rect 矩形");
  const f = mm.Model.frames[0];
  const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
  const geo = mm.Render.frameGeometry(f, vis);
  const b1 = b.children[0];
  const b1a = b1.children[0];
  assert.ok(geo.x <= b1.x - b1.w / 2, "外框左侧应覆盖 B1");
  assert.ok(geo.x + geo.w >= b1.x + b1.w / 2, "外框右侧应覆盖 B1");
  assert.ok(geo.y <= b1a.y - b1a.h / 2, "外框顶部应覆盖 B1a");
  assert.ok(geo.y + geo.h >= b1a.y + b1a.h / 2, "外框底部应覆盖 B1a");
});

test("旧数据 node.frame 迁移为 frames 机制且不重复", () => {
  const { mm } = fresh();
  const { root, a, b } = treeFixture(mm);
  const a1 = a.children[0], a2 = a.children[1];
  a.frame = true;
  b.frame = true;
  const data = JSON.parse(JSON.stringify(mm.Model.serialize()));
  data.frames = [{ id: "f_legacy", nodes: [b.id], label: null }];

  const mm2 = fresh().mm;
  mm2.Model.deserialize(data);
  assert.equal(mm2.Model.find(mm2.Model.root, a.id).frame, null, "旧 frame 标记被清除");
  assert.equal(mm2.Model.frames.length, 2, "节点与旧 frames 合并去重");
  assert.ok(mm2.Model.frames.some((f) => f.nodes.length === 1 && f.nodes[0] === a.id), "a 迁移为独立外框");
  assert.ok(mm2.Model.frames.some((f) => f.nodes.length === 1 && f.nodes[0] === b.id && f.id === "f_legacy"), "b 复用既有外框不重复添加");
  assert.equal(mm2.Model.find(mm2.Model.root, a1.id).frame, null, "子节点不受影响");
});

test("嵌套外框：大小框边框间留出间隔（标签计入外框）", () => {
  const { mm } = fresh();
  const { root } = treeFixture(mm);
  const n1 = root.children[1];
  const b1 = n1.children[0];
  mm.Model.addFrame([n1.id, b1.id]);
  mm.Model.frames[0].label = "大组";
  mm.Model.addFrame([b1.id]);
  mm.Model.frames[1].label = "小组";
  mm.Layout.treeLayout(root, "right", THEME);
  const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
  const big = mm.Render.frameGeometry(mm.Model.frames[0], vis);
  const small = mm.Render.frameGeometry(mm.Model.frames[1], vis);
  const gapBottom = big.y + big.h - (small.y + small.h);
  assert.equal(gapBottom, 14, "小框底边与大框底边间距 = FRAME_PAD");
  const gapTop = small.y - big.y;
  assert.equal(gapTop, 28, "小框顶边在大框顶边下方（含小框标签外露 FRAME_LABEL_TOP + FRAME_PAD）");
});

test("多层嵌套外框：各级边框均保持 FRAME_PAD 间隔", () => {
  const { mm } = fresh();
  const { root } = treeFixture(mm);
  const n1 = root.children[1];
  const b1 = n1.children[0];
  const b1a = b1.children[0];
  mm.Model.addFrame([n1.id, b1.id]);
  mm.Model.frames[0].label = "大组";
  mm.Model.addFrame([b1.id, b1a.id]);
  mm.Model.frames[1].label = "中组";
  mm.Model.addFrame([b1a.id]);
  mm.Model.frames[2].label = "小组";
  mm.Layout.treeLayout(root, "right", THEME);
  const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
  const bs = mm.Model.frames.map((f) => mm.Render.frameGeometry(f, vis));
  assert.equal(bs[0].y + bs[0].h - (bs[1].y + bs[1].h), 14, "大框底与中框底间隔 FRAME_PAD");
  assert.equal(bs[1].y + bs[1].h - (bs[2].y + bs[2].h), 14, "中框底与小框底间隔 FRAME_PAD");
  assert.ok(bs[2].y - mm.Layout.FRAME_LABEL_TOP >= bs[0].y, "小框标签仍在大框内");
});

test("旧数据成员同序异互含的框不爆栈且几何有限", () => {
  const { mm } = fresh();
  const { root, a, b } = treeFixture(mm);
  mm.Model.frames.push({ id: "fx_dup1", nodes: [a.id, b.id], label: null });
  mm.Model.frames.push({ id: "fx_dup2", nodes: [b.id, a.id], label: null });
  mm.Layout.treeLayout(root, "right", THEME);
  const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
  const bs = mm.Model.frames.map((f) => mm.Render.frameGeometry(f, vis));
  for (const g of bs) {
    assert.ok(g && Number.isFinite(g.x) && Number.isFinite(g.y) && g.w > 0 && g.h > 0);
  }
});

test("兄弟嵌套分支 pad 独立计入（pill 不穿出外层框）", () => {
  const { mm } = fresh();
  const { root } = treeFixture(mm);
  const n89 = root.children[1];
  const n573 = n89.children[0];
  const n922 = n573.children[0];
  const n276 = mm.Model.addChild(n922, "n276");
  const n760 = mm.Model.addChild(n922, "n760");
  const f27 = mm.Model.addFrame([n922.id]);
  mm.Model.setFrameLabel(f27.id, "L59");
  const f28 = mm.Model.addFrame([n922.id, n276.id, n573.id]);
  mm.Model.setFrameLabel(f28.id, "L46");
  const f29 = mm.Model.addFrame([n760.id, n276.id]);
  mm.Model.setFrameLabel(f29.id, "L39");
  const f30 = mm.Model.addFrame([n922.id, n89.id]);
  mm.Layout.treeLayout(root, "right", THEME);
  assert.equal(mm.Layout.framePadTop(f27.id), 42, "含兄弟子框分支：14+14+14");
  assert.equal(mm.Layout.framePadTop(f28.id), 70, "含 f27 及其标签：42+14+14");
  assert.equal(mm.Layout.framePadTop(f30.id), 98, "嵌套分支递归独立：70+14+14");
  const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
  const gInn = mm.Render.frameGeometry(f28, vis);
  const gOut = mm.Render.frameGeometry(f30, vis);
  assert.ok(gInn.y - mm.Layout.FRAME_LABEL_TOP >= gOut.y, "内框标签 pill 不穿出外框顶边");
});

test("hitFrame 嵌套时命中最小（最内层）外框", () => {
  const { mm } = fresh();
  const { root } = treeFixture(mm);
  const b = root.children[1];
  const b1 = b.children[0];
  const b1a = b1.children[0];
  mm.Model.frames.push({ id: "fx_out", nodes: [b.id, b1a.id], label: null });
  mm.Model.frames.push({ id: "fx_mid", nodes: [b1.id, b1a.id], label: null });
  mm.Model.frames.push({ id: "fx_inn", nodes: [b1a.id], label: null });
  mm.Layout.treeLayout(root, "right", THEME);
  const vis = new Set(mm.Model.visibleNodes(root).map((n) => n.id));
  const gOut = mm.Render.frameGeometry(mm.Model.frames[0], vis);
  const gMid = mm.Render.frameGeometry(mm.Model.frames[1], vis);
  const gInn = mm.Render.frameGeometry(mm.Model.frames[2], vis);
  const innCx = gInn.x + gInn.w / 2, innCy = gInn.y + gInn.h / 2;
  assert.equal(mm.Render.hitFrame(innCx, innCy).id, "fx_inn", "三层重叠点命中最小框");
  assert.equal(mm.Render.hitFrame(innCx, innCy, "fx_inn").id, "fx_mid", "排除最小框后命中次小框");
  const midCx = gMid.x + 5, midCy = gMid.y + gMid.h / 2;
  assert.ok(!(midCx >= gInn.x && midCx <= gInn.x + gInn.w && midCy >= gInn.y && midCy <= gInn.y + gInn.h), "左 pad 点不在最小框内");
  assert.equal(mm.Render.hitFrame(midCx, midCy).id, "fx_mid", "左 pad 点命中中框");
  const outCx = gOut.x + 5, outCy = gOut.y + gOut.h / 2;
  assert.equal(mm.Render.hitFrame(outCx, outCy).id, "fx_out", "左 pad 点命中外框");
  assert.equal(mm.Render.hitFrame(gOut.x - 50, gOut.y - 50), null, "框外无命中");
});

test("全部收起：折叠子树内隐藏成员的外框不污染布局（坐标有限）", () => {
  const { mm } = fresh();
  const { root, a, b, c } = treeFixture(mm);
  const a1 = a.children[0];
  mm.Model.addFrame([a1.id]);
  for (const n of mm.Model.allNodes(root)) if (n !== root) n.collapsed = true;
  mm.Layout.treeLayout(root, "right", THEME);
  for (const n of mm.Model.visibleNodes(root)) {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), n.text + " 坐标有限（无 NaN）");
  }
  assert.ok(b.y !== c.y, "兄弟节点纵向分布正常");
  const gap = Math.abs(b.y - a.y);
  assert.ok(gap > 0 && gap < 200, "兄弟间距合理");
});
