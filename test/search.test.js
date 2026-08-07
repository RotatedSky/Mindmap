"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

function fresh() {
  const env = setup(["model", "search"]);
  env.mm.Render = { applySelectionClasses() {}, centerOn() {} };
  env.mm.Search.init();
  return env;
}

function searchQuery(env, query) {
  env.singletonEl.value = query;
  env.singletonEl.dispatch("input", { key: "", preventDefault() {} });
  return env.mm.Search.currentMatches();
}

test("搜索匹配可见节点", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  const root = mm.Model.root;
  mm.Model.addChild(root, "苹果");
  mm.Model.addChild(root, "香蕉");
  mm.Model.addChild(root, "苹果派");
  const matches = searchQuery(env, "苹果");
  assert.equal(matches.size, 2);
  mm.Model.addChild(root, "葡萄");
  searchQuery(env, "不存在");
  assert.equal(env.mm.Search.currentMatches().size, 0);
});

test("搜索忽略折叠子树", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  const root = mm.Model.root;
  const kid = mm.Model.addChild(root, "可见");
  mm.Model.addChild(kid, "隐藏内容");
  kid.collapsed = true;
  assert.equal(searchQuery(env, "隐藏").size, 0);
  kid.collapsed = false;
  assert.equal(searchQuery(env, "隐藏").size, 1);
});

test("搜索大小写不敏感", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  mm.Model.addChild(mm.Model.root, "HelloWorld");
  assert.equal(searchQuery(env, "helloworld").size, 1);
  assert.equal(searchQuery(env, "HELLOWORLD").size, 1);
});

test("空查询不匹配任何节点", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  mm.Model.addChild(mm.Model.root, "anything");
  assert.equal(searchQuery(env, "").size, 0);
  assert.equal(searchQuery(env, "   ").size, 0);
});

test("Enter 键在匹配项间循环", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  mm.Model.addChild(mm.Model.root, "目标A");
  mm.Model.addChild(mm.Model.root, "目标B");
  mm.Model.addChild(mm.Model.root, "目标C");
  searchQuery(env, "目标");
  assert.equal(env.singletonEl.textContent, "1/3");
  env.singletonEl.dispatch("keydown", { key: "Enter", preventDefault() {} });
  assert.equal(env.singletonEl.textContent, "2/3");
  env.singletonEl.dispatch("keydown", { key: "Enter", preventDefault() {} });
  assert.equal(env.singletonEl.textContent, "3/3");
  env.singletonEl.dispatch("keydown", { key: "Enter", preventDefault() {} });
  assert.equal(env.singletonEl.textContent, "1/3");
});

test("close 清空匹配与计数", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  mm.Model.addChild(mm.Model.root, "目标");
  searchQuery(env, "目标");
  assert.equal(env.mm.Search.currentMatches().size, 1);
  env.mm.Search.close();
  assert.equal(env.mm.Search.currentMatches().size, 0);
  assert.equal(env.singletonEl.textContent, "");
});
