"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

function fresh() {
  const env = setup(["model", "storage"]);
  env.mm.App = { toast() {} };
  return env;
}

async function idbPut(env, raw) {
  const req = env.sandbox.indexedDB.open();
  await new Promise((res) => {
    req.onsuccess = () => {
      const put = req.result.transaction("kv", "readwrite").objectStore("kv").put(raw, "data.v1");
      put.onsuccess = () => res();
    };
  });
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

test("init 把旧 localStorage 数据迁移到 IndexedDB", async () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  mm.Model.change(() => { mm.Model.root.text = "旧版本数据"; });
  const raw = JSON.stringify(mm.Model.serialize());
  env.localStorage.setItem(mm.Storage.KEY, raw);
  mm.Model.reset();
  const ok = await mm.Storage.init();
  assert.equal(ok, true);
  assert.equal(mm.Model.root.text, "旧版本数据");
});

test("init 优先加载 IndexedDB 数据", async () => {
  const env = fresh();
  const { mm } = env;
  mm.Model.reset();
  mm.Model.change(() => { mm.Model.root.text = "IndexedDB 版本"; });
  const raw = JSON.stringify(mm.Model.serialize());
  await idbPut(env, raw);
  env.localStorage.setItem(mm.Storage.KEY, JSON.stringify({ root: { text: "旧版本" }, version: 1 }));
  const ok = await mm.Storage.init();
  assert.equal(ok, true);
  assert.equal(mm.Model.root.text, "IndexedDB 版本");
});

test("save 落盘 IndexedDB", async () => {
  const env = fresh();
  const { mm, timers } = env;
  mm.Model.reset();
  mm.Model.change(() => { mm.Model.root.text = "入库数据"; });
  mm.Storage.save();
  timers.tick(400);
  await new Promise((r) => setTimeout(r, 0));
  const ok = await mm.Storage.init();
  assert.equal(ok, true);
  assert.equal(mm.Model.root.text, "入库数据");
});

test("openFile 无 File System Access 时返回 null", () => {
  const env = fresh();
  assert.equal(env.mm.Storage.openFile(), null);
});

const FIXTURE = { root: { text: "文件内容", children: [] }, version: 1 };

test("openFile 走 showOpenFilePicker 加载并保留句柄", async () => {
  const env = fresh();
  const { mm } = env;
  const handle = {
    name: "测试.mind",
    getFile: async () => ({ text: async () => JSON.stringify(FIXTURE) }),
    createWritable: () => { throw new Error("not used"); }
  };
  env.sandbox.window.showOpenFilePicker = () => Promise.resolve([handle]);
  const ok = await mm.Storage.openFile();
  assert.equal(ok, true);
  assert.equal(mm.Model.root.text, "文件内容");
});

test("openFile 取消返回 false 且不破坏数据", async () => {
  const env = fresh();
  const { mm } = env;
  env.sandbox.window.showOpenFilePicker = () => Promise.reject({ name: "AbortError" });
  const ok = await mm.Storage.openFile();
  assert.equal(ok, false);
});

test("saveToFile 回写已打开文件", async () => {
  const env = fresh();
  const { mm } = env;
  let written = "";
  const handle = {
    name: "测试.mind",
    getFile: async () => ({ text: async () => JSON.stringify(FIXTURE) }),
    createWritable: async () => ({
      write: async (s) => { written = String(s); },
      close: async () => {}
    })
  };
  env.sandbox.window.showOpenFilePicker = () => Promise.resolve([handle]);
  await mm.Storage.openFile();
  mm.Model.change(() => { mm.Model.root.text = "改写内容"; });
  const ok = await mm.Storage.saveToFile();
  assert.equal(ok, true);
  assert.ok(written.includes("改写内容"));
});

test("saveToFile 无句柄时打开保存格式选择", async () => {
  const env = fresh();
  const { mm } = env;
  let opened = false;
  env.mm.App.showSaveDialog = () => { opened = true; };
  const ok = await mm.Storage.saveToFile();
  assert.equal(ok, undefined);
  assert.equal(opened, true, "无文件句柄应打开保存格式选择");
});

test("saveAs 用 showSaveFilePicker 写 JSON 并保留句柄供后续回写", async () => {
  const env = fresh();
  const { mm, sandbox } = env;
  let written = "";
  let picked = null;
  sandbox.window.showSaveFilePicker = async (opts) => {
    picked = opts;
    return {
      name: "导出.mind",
      createWritable: async () => ({
        write: async (s) => { written = String(s); },
        close: async () => {}
      })
    };
  };
  mm.Model.reset();
  const ok = await mm.Storage.saveAs("mind");
  assert.equal(ok, true);
  assert.ok(picked.suggestedName.endsWith(".mind"), "保存选择器建议名用 .mind 扩展");
  assert.ok(written.includes(mm.Model.root.text), "写入 JSON 内容");
  mm.Model.change(() => { mm.Model.root.text = "回写内容"; });
  const ok2 = await mm.Storage.saveToFile();
  assert.equal(ok2, true);
  assert.ok(written.includes("回写内容"), "后续 Ctrl+S 直接回写所选文件");
});

test("saveAs json 建议名用 .json 扩展", async () => {
  const env = fresh();
  const { mm, sandbox } = env;
  let picked = null;
  sandbox.window.showSaveFilePicker = async (opts) => {
    picked = opts;
    return {
      name: "导出.json",
      createWritable: async () => ({
        write: async () => {},
        close: async () => {}
      })
    };
  };
  mm.Model.reset();
  const ok = await mm.Storage.saveAs("json");
  assert.equal(ok, true);
  assert.ok(picked.suggestedName.endsWith(".json"), "保存选择器建议名用 .json 扩展");
});

test("saveAs md 写出 Markdown 大纲", async () => {
  const env = setup(["model", "markdown", "storage"]);
  const { mm, sandbox } = env;
  mm.App = { toast() {} };
  let written = "";
  sandbox.window.showSaveFilePicker = async () => ({
    name: "大纲.md",
    createWritable: async () => ({
      write: async (s) => { written = String(s); },
      close: async () => {}
    })
  });
  mm.Model.reset();
  const ok = await mm.Storage.saveAs("md");
  assert.equal(ok, true);
  assert.ok(written.startsWith("- "), "Markdown 大纲以列表开头");
});

test("saveAs 无 File System Access 时回退下载", async () => {
  const env = fresh();
  const { mm } = env;
  let called = false;
  env.mm.Exporter = {
    saveBlob: async () => { called = true; return true; }
  };
  mm.Model.reset();
  const ok = await mm.Storage.saveAs("json");
  assert.equal(ok, true);
  assert.equal(called, true, "无保存选择器应回退到 saveBlob 下载");
});

test("saveAs 用户取消返回 false", async () => {
  const env = fresh();
  const { mm, sandbox } = env;
  sandbox.window.showSaveFilePicker = () => Promise.reject({ name: "AbortError" });
  const ok = await mm.Storage.saveAs("json");
  assert.equal(ok, false);
});

test("clearFile 清除句柄后 saveToFile 走保存格式选择", async () => {
  const env = fresh();
  const { mm, sandbox } = env;
  let picked = null;
  sandbox.window.showSaveFilePicker = async (opts) => {
    picked = opts;
    return {
      name: "out.mind",
      createWritable: async () => ({
        write: async () => {},
        close: async () => {}
      })
    };
  };
  mm.Model.reset();
  const ok = await mm.Storage.saveAs("json");
  assert.equal(ok, true, "saveAs 保留句柄");
  let opened = false;
  env.mm.App.showSaveDialog = () => { opened = true; };
  mm.Storage.clearFile();
  const ok2 = await mm.Storage.saveToFile();
  assert.equal(ok2, undefined);
  assert.equal(opened, true, "clearFile 后 saveToFile 弹出保存格式选择");
});

test("init 无数据返回 false", async () => {
  const env = fresh();
  const { mm } = env;
  const ok = await mm.Storage.init();
  assert.equal(ok, false);
});
