"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SW = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const CACHE = (SW.match(/const CACHE = "([^"]+)"/) || [])[1];
const ASSETS = ((SW.match(/const ASSETS = \[([\s\S]*?)\];/) || [])[1] || "")
  .match(/"([^"]+)"/g)
  .map((s) => s.slice(1, -1));

function localRefs(html) {
  const out = new Set();
  const re = /\b(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const v = m[1];
    if (/^(https?:|data:|mailto:|blob:|#)/.test(v)) continue;
    out.add(v.startsWith("./") ? v : "./" + v);
  }
  return [...out];
}

test("sw.js 缓存名带版本号（改动 js/css/html 后需 bump）", () => {
  assert.match(String(CACHE || ""), /^mindmap-v\d+$/);
});

test("sw.js 预缓存清单无重复且文件均存在", () => {
  assert.equal(new Set(ASSETS).size, ASSETS.length, "ASSETS 存在重复项");
  const missing = ASSETS.filter((p) => p !== "./" && !fs.existsSync(path.join(ROOT, p.replace(/^\.\//, ""))));
  assert.deepEqual(missing, []);
});

test("index.html 与 manifest 引用的本地资源都已预缓存", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  const refs = localRefs(html).concat(manifest.icons.map((i) => "./" + i.src));
  const notCached = refs.filter((r) => !ASSETS.includes(r));
  assert.deepEqual(notCached, []);
});

test("index.html 含 iOS 主屏安装元信息（图标 / 全屏 / 名称）", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /rel="apple-touch-icon"[^>]*href="icon-192\.png"/);
  assert.match(html, /name="apple-mobile-web-app-capable"[^>]*content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-title"[^>]*content="[^"]+"/);
});

test("manifest 声明稳定的安装身份与方向", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.id, "./");
  assert.ok(["any", "portrait", "landscape"].includes(manifest.orientation));
});
