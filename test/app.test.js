"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup, loadModule } = require("./helpers/shim");

async function fresh() {
  const env = setup(["model"]);
  env.singletonEl.dataset = {};
  patchStyle(env.singletonEl);
  const byId = {};
  function makeById() {
    const el = env.sandbox.document.createElement("div");
    el.dataset = {};
    patchStyle(el);
    return el;
  }
  env.byId = byId;
  const origGet = env.sandbox.document.getElementById.bind(env.sandbox.document);
  env.sandbox.document.getElementById = (id) => {
    if (id === "empty-hint" || id === "empty-hint-close") {
      if (!byId[id]) byId[id] = makeById();
      return byId[id];
    }
    return origGet(id);
  };
  env.sandbox.location = { protocol: "file:" };
  env.sandbox.navigator = {};
  env.sandbox.requestAnimationFrame = (fn) => 0;
  const mm = env.mm;
  mm.Render = { init() {}, render() {}, fit() {}, LINE_STYLES: [] };
  mm.Layout = { layoutAll() {}, initFreePositions() {} };
  mm.Search = { init() {}, open() {} };
  mm.Outline = { init() {}, isOpen() { return false; }, setOpen() {}, refresh() {} };
  mm.Notes = { init() {}, isOpen() { return false; }, setOpen() {}, refresh() {} };
  mm.Style = { init() {}, isOpen() { return false; }, setOpen() {}, refresh() {} };
  mm.Editor = { init() {}, zoomBy() {} };
  mm.Minimap = { init() {} };
  mm.Math = { fontsReady() { return Promise.resolve(); }, precache() { return Promise.resolve(); } };
  mm.Markdown = { parse() { return null; }, serialize() { return ""; } };
  mm.Exporter = {};
  mm.Storage = { init() { return Promise.resolve(); }, save() {}, saveToFile() {} };
  loadModule(env.sandbox, "app");
  await Promise.resolve();
  await Promise.resolve();
  const blank = mm.Model.createNode("root");
  mm.Model.replaceRoot(blank);
  return env;
}

function patchStyle(el) {
  if (!el.style.setProperty) el.style.setProperty = () => {};
  if (!el.style.removeProperty) el.style.removeProperty = () => {};
}

function emptyHintEl(env) {
  return env.byId["empty-hint"];
}

function emptyCloseEl(env) {
  return env.byId["empty-hint-close"];
}

test("空树显示空白提示", async () => {
  const env = fresh();
  const e = await env;
  const { mm } = e;
  assert.equal(mm.App.isEmptyHintDismissed(), false);
  mm.App.updateEmptyHint();
  assert.equal(emptyHintEl(e).style.display, "");
});

test("有子节点时隐藏空白提示", async () => {
  const e = await fresh();
  const { mm } = e;
  mm.Model.addChild(mm.Model.root, "child");
  mm.App.updateEmptyHint();
  assert.equal(emptyHintEl(e).style.display, "none");
});

test("关闭后记住选择，空树也不再显示", async () => {
  const e = await fresh();
  const { mm } = e;
  mm.App.updateEmptyHint();
  assert.equal(emptyHintEl(e).style.display, "");
  mm.App.dismissEmptyHint();
  assert.equal(mm.App.isEmptyHintDismissed(), true);
  assert.equal(e.localStorage.getItem("mm.empty-hint.hidden.v1"), "1");
  assert.equal(emptyHintEl(e).style.display, "none");
  mm.App.updateEmptyHint();
  assert.equal(emptyHintEl(e).style.display, "none");
});

test("点击关闭按钮触发关闭", async () => {
  const e = await fresh();
  const { mm } = e;
  mm.App.updateEmptyHint();
  assert.equal(emptyHintEl(e).style.display, "");
  emptyCloseEl(e).dispatch("click", { stopPropagation() {} });
  assert.equal(mm.App.isEmptyHintDismissed(), true);
  assert.equal(emptyHintEl(e).style.display, "none");
});
