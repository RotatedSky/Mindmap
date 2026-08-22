"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

function fresh() {
  return setup(["i18n"]);
}

test("默认语言为中文，tr 保持中文原文", () => {
  const { mm } = fresh();
  assert.equal(mm.I18n.getLang(), "zh");
  assert.equal(mm.I18n.tr("导出"), "导出");
  assert.equal(mm.I18n.tr("新建思绪图"), "新建思绪图");
});

test("setLang('en') 切换语言、持久化并更新 html lang", () => {
  const env = fresh();
  const { mm } = env;
  mm.I18n.setLang("en");
  assert.equal(mm.I18n.getLang(), "en");
  assert.equal(env.localStorage.getItem("mm.lang"), "en");
  assert.equal(env.singletonEl.getAttribute("lang"), "en");
  assert.equal(mm.I18n.tr("导出"), "Export");
  assert.equal(mm.I18n.tr("新建思绪图"), "New Mind Map");
});

test("setLang('zh') 可切回中文", () => {
  const env = fresh();
  const { mm } = env;
  mm.I18n.setLang("en");
  mm.I18n.setLang("zh");
  assert.equal(mm.I18n.getLang(), "zh");
  assert.equal(env.localStorage.getItem("mm.lang"), "zh");
  assert.equal(mm.I18n.tr("导出"), "导出");
});

test("tr 支持在长句中替换已知中文片段", () => {
  const { mm } = fresh();
  mm.I18n.setLang("en");
  assert.equal(mm.I18n.tr("已导出 PNG（分支）"), "Exported PNG (branch)");
  assert.equal(mm.I18n.tr("已复制 3 个节点"), "Copied 3 nodes");
  assert.equal(mm.I18n.tr("已导出 PDF（2 页）"), "Exported PDF (2 pages)");
  assert.equal(mm.I18n.tr("保存（Ctrl+S）：.mind/.json 文件直接回写，其他格式选择保存类型"), "Save (Ctrl+S): write back to .mind/.json files, choose type for other formats");
});

test("init 读取 localStorage 中的语言", () => {
  const env = fresh();
  env.localStorage.setItem("mm.lang", "en");
  const { mm } = env;
  assert.equal(mm.I18n.init(), "en");
  assert.equal(mm.I18n.getLang(), "en");
});

test("apply 翻译元素 title 属性", () => {
  const env = fresh();
  const { mm } = env;
  const el = env.sandbox.document.createElement("div");
  el.setAttribute("title", "新建");
  mm.I18n.setLang("en");
  mm.I18n.apply(el);
  assert.equal(el.getAttribute("title"), "New");
});

test("apply 可逆：英文切回中文恢复原标题", () => {
  const env = fresh();
  const { mm } = env;
  const el = env.sandbox.document.createElement("div");
  el.setAttribute("title", "新建");
  mm.I18n.setLang("en");
  mm.I18n.apply(el);
  assert.equal(el.getAttribute("title"), "New");
  mm.I18n.setLang("zh");
  mm.I18n.apply(el);
  assert.equal(el.getAttribute("title"), "新建");
});

test("apply 不翻译 textarea 内容但翻译其 placeholder", () => {
  const env = fresh();
  const { mm } = env;
  const ta = env.sandbox.document.createElement("textarea");
  ta.setAttribute("placeholder", "搜索节点…");
  ta.textContent = "用户内容";
  mm.I18n.setLang("en");
  mm.I18n.apply(ta);
  assert.equal(ta.getAttribute("placeholder"), "Search nodes…");
  assert.equal(ta.textContent, "用户内容");
});

test("缺失的翻译键回退为原文", () => {
  const { mm } = fresh();
  mm.I18n.setLang("en");
  assert.equal(mm.I18n.tr("不存在的界面文字"), "不存在的界面文字");
});
