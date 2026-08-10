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
  assert.ok(/rx="12"/.test(rectM[0]), "外框默认圆角 12");
  assert.ok(/stroke-dasharray="8 5"/.test(rectM[0]), "外框默认虚线");
});

test("外框自定义样式（颜色/粗细/圆角/实线）进入渲染与导出", () => {
  const { mm } = fresh();
  const { root } = fixture(mm);
  mm.Theme.get = () => THEME;
  mm.Layout.treeLayout(root, "right", THEME);
  const f = mm.Model.frames[0];
  mm.Model.setFrameStyle(f.id, "borderColor", "#ff0000");
  mm.Model.setFrameStyle(f.id, "borderWidth", 3);
  mm.Model.setFrameStyle(f.id, "radius", 0);
  mm.Model.setFrameStyle(f.id, "dash", false);
  const svg = mm.Render.toSVGString(null, "white");
  const rectM = svg.match(/<rect[^>]*class="frame-rect"[^>]*>/);
  assert.ok(rectM, "应有外框矩形");
  assert.ok(/stroke="#ff0000"/.test(rectM[0]), "外框使用自定义颜色");
  assert.ok(/stroke-width="3"/.test(rectM[0]), "外框使用自定义粗细");
  assert.ok(/rx="0"/.test(rectM[0]), "外框使用自定义圆角");
  assert.ok(/stroke-dasharray="none"/.test(rectM[0]), "dash=false 时实线");
});

test("外框自定义样式不受选中态覆盖", () => {
  const { mm } = fresh();
  const { root } = fixture(mm);
  mm.Theme.get = () => THEME;
  mm.Layout.treeLayout(root, "right", THEME);
  const f = mm.Model.frames[0];
  mm.Model.setFrameStyle(f.id, "borderColor", "#00ff00");
  mm.Editor = { selectedRelationId: () => null, selectedFrameId: () => f.id };
  const svg = mm.Render.toSVGString(null, "white");
  const rectM = svg.match(/<rect[^>]*class="frame-rect"[^>]*>/);
  assert.ok(rectM, "应有外框矩形");
  assert.ok(/stroke="#00ff00"/.test(rectM[0]), "自定义颜色优先于主题选中色");
  assert.ok(/stroke-width="1\.5"/.test(rectM[0]), "未设粗细时保持默认，选中态不叠加到导出");
});

test("saveBlob：有 showSaveFilePicker 时写入用户所选文件", async () => {
  const { mm, sandbox } = setup(["model", "layout", "render", "exporter"]);
  const written = [];
  let picked = null;
  sandbox.window.showSaveFilePicker = async (opts) => {
    picked = opts;
    return {
      createWritable: async () => ({
        write: async (b) => written.push(b),
        close: async () => {}
      })
    };
  };
  const blob = new Blob(["x"], { type: "image/png" });
  const ok = await mm.Exporter.saveBlob(blob, "a.png", "image/png");
  assert.equal(ok, true);
  assert.equal(picked.suggestedName, "a.png");
  assert.equal(JSON.stringify(picked.types[0].accept), JSON.stringify({ "image/png": [".png"] }));
  assert.equal(written.length, 1);
  assert.equal(written[0], blob);
});

test("saveBlob：用户取消（AbortError）返回 false 且不触发下载", async () => {
  const { mm, sandbox } = setup(["model", "layout", "render", "exporter"]);
  let urlCalls = 0;
  sandbox.URL.createObjectURL = () => { urlCalls++; return "blob:mock"; };
  sandbox.window.showSaveFilePicker = async () => {
    const err = new Error("cancel");
    err.name = "AbortError";
    throw err;
  };
  const ok = await mm.Exporter.saveBlob(new Blob(["x"], { type: "image/png" }), "a.png", "image/png");
  assert.equal(ok, false);
  assert.equal(urlCalls, 0, "取消后不应回退下载");
});

test("saveBlob：不支持 File System Access API 时回退默认下载", async () => {
  const { mm, sandbox } = setup(["model", "layout", "render", "exporter"]);
  assert.equal(sandbox.window.showSaveFilePicker, undefined);
  let urlCalls = 0;
  sandbox.URL.createObjectURL = () => { urlCalls++; return "blob:mock"; };
  const ok = await mm.Exporter.saveBlob(new Blob(["x"], { type: "application/json" }), "a.json", "application/json");
  assert.equal(ok, true);
  assert.equal(urlCalls, 1, "回退走 URL 下载");
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
