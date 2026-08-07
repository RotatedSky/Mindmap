"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

function fresh() {
  const env = setup(["model", "storage"]);
  env.mm.App = { toast() {} };
  return env;
}

test("flush 立即写入 localStorage", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  const raw = env.localStorage.getItem(mm.Storage.KEY);
  assert.equal(raw, null);
  mm.Storage.flush();
  const saved = JSON.parse(env.localStorage.getItem(mm.Storage.KEY));
  assert.equal(saved.root.text, mm.Model.root.text);
  assert.equal(saved.version, 1);
});

test("save 防抖 400ms 后写入", () => {
  const env = fresh();
  const { mm, timers } = env;
  mm.Storage.save();
  assert.equal(env.localStorage.getItem(mm.Storage.KEY), null);
  timers.tick(400);
  assert.ok(env.localStorage.getItem(mm.Storage.KEY));
});

test("连续 save 只触发一次写入", () => {
  const env = fresh();
  const { mm, timers } = env;
  mm.Storage.save();
  mm.Storage.save();
  mm.Storage.save();
  timers.tick(400);
  assert.equal(timers.pending(), 0);
  assert.ok(env.localStorage.getItem(mm.Storage.KEY));
});

test("load 恢复保存的数据", () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  mm.Model.change(() => { mm.Model.root.text = "保存的标题"; });
  mm.Storage.flush();
  mm.Model.reset();
  assert.notEqual(mm.Model.root.text, "保存的标题");
  assert.equal(mm.Storage.load(), true);
  assert.equal(mm.Model.root.text, "保存的标题");
});

test("load 无数据或损坏数据返回 false", () => {
  const env = fresh();
  const { mm } = env;
  assert.equal(mm.Storage.load(), false);
  env.localStorage.setItem(mm.Storage.KEY, "{{{not json");
  assert.equal(mm.Storage.load(), false);
});

test("save 的 setItem 抛错时静默忽略", () => {
  const env = fresh();
  const { mm, timers } = env;
  const orig = env.localStorage.setItem.bind(env.localStorage);
  env.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  mm.Storage.flush();
  env.localStorage.setItem = orig;
  assert.equal(timers.pending(), 0);
});
