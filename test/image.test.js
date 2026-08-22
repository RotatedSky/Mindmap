"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, sameJSON } = require("./helpers/shim");

function imageFile(overrides) {
  return Object.assign({ name: "a.png", type: "image/png", size: 1024 }, overrides || {});
}

function installImageStubs(env, opts) {
  const state = Object.assign({ width: 100, height: 80, dataUrl: "data:image/png;base64,AAAA" }, opts || {});
  env.sandbox.FileReader = function () {
    this.readAsDataURL = () => {
      this.result = state.dataUrl;
      Promise.resolve().then(() => this.onload && this.onload());
    };
  };
  env.sandbox.Image = class {
    constructor() {
      this.width = state.width;
      this.height = state.height;
    }
    set src(v) {
      this._src = v;
      Promise.resolve().then(() => this.onload && this.onload());
    }
    get src() { return this._src; }
  };
  const canvases = [];
  env.sandbox.document.createElement = (tag) => {
    if (tag !== "canvas") return { style: {}, setAttribute() {}, appendChild() {} };
    const ctx = { fillStyle: "", fillRect() {}, drawImage() {} };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: (type, quality) => {
        const ext = /png/i.test(type) ? "png" : "jpeg";
        return "data:image/" + ext + ";base64," + "x".repeat(state.dataUrlLength || 100);
      }
    };
    canvases.push(canvas);
    return canvas;
  };
  return { canvases, state };
}

test("isImageFile 识别图片类型", () => {
  const env = setup(["image"]);
  const I = env.mm.Image;
  assert.equal(I.isImageFile({ type: "image/png" }), true);
  assert.equal(I.isImageFile({ type: "image/svg+xml" }), true);
  assert.equal(I.isImageFile({ type: "text/plain" }), false);
  assert.equal(I.isImageFile(null), false);
});

test("imageFileFromDataTransfer 从 items / files 提取图片", () => {
  const env = setup(["image"]);
  const I = env.mm.Image;
  const png = imageFile();
  const txt = { name: "a.txt", type: "text/plain", size: 1 };
  assert.equal(I.imageFileFromDataTransfer({ items: [{ kind: "file", type: "image/png", getAsFile: () => png }] }), png);
  assert.equal(I.imageFileFromDataTransfer({ files: [txt, png] }), png);
  assert.equal(I.imageFileFromDataTransfer({ files: [txt] }), null);
  assert.equal(I.imageFileFromDataTransfer(null), null);
});

test("scaleSize 等比缩放且小图不变", () => {
  const env = setup(["image"]);
  const I = env.mm.Image;
  sameJSON(I.scaleSize(3200, 1600, 1600), { width: 1600, height: 800, scale: 0.5 });
  sameJSON(I.scaleSize(800, 600, 1600), { width: 800, height: 600, scale: 1 });
  sameJSON(I.scaleSize(0, 0, 1600), { width: 1, height: 1, scale: 1 });
});

test("shouldCompress 按体积和尺寸判断，SVG 不压缩", () => {
  const env = setup(["image"]);
  const I = env.mm.Image;
  assert.equal(I.shouldCompress({ type: "image/png", size: 3 * 1024 * 1024 }, 100, 100), true);
  assert.equal(I.shouldCompress({ type: "image/png", size: 1024 }, 2000, 100), true);
  assert.equal(I.shouldCompress({ type: "image/png", size: 1024 }, 800, 600), false);
  assert.equal(I.shouldCompress({ type: "image/svg+xml", size: 10 * 1024 * 1024 }, 5000, 5000), false);
});

test("readImageFile 小图原样返回不压缩", async () => {
  const env = setup(["image"]);
  installImageStubs(env, { width: 800, height: 600 });
  const file = imageFile({ size: 1024 });
  const res = await env.mm.Image.readImageFile(file);
  assert.equal(res.dataUrl, "data:image/png;base64,AAAA");
  assert.equal(res.compressed, false);
  assert.equal(res.width, 800);
  assert.equal(res.height, 600);
});

test("readImageFile 超大图走 canvas 压缩", async () => {
  const env = setup(["image"]);
  const { canvases } = installImageStubs(env, { width: 4000, height: 3000, dataUrlLength: 200 });
  const file = imageFile({ size: 8 * 1024 * 1024 });
  const res = await env.mm.Image.readImageFile(file);
  assert.equal(res.compressed, true);
  assert.ok(res.dataUrl.startsWith("data:image/"));
  assert.ok(canvases.length > 0);
  assert.ok(res.width <= env.mm.Image.MAX_DIM);
  assert.ok(res.height <= env.mm.Image.MAX_DIM);
});

test("readImageFile SVG 原样返回且不压缩", async () => {
  const env = setup(["image"]);
  installImageStubs(env, { width: 5000, height: 5000 });
  const file = imageFile({ name: "a.svg", type: "image/svg+xml", size: 8 * 1024 * 1024 });
  const res = await env.mm.Image.readImageFile(file);
  assert.equal(res.dataUrl, "data:image/png;base64,AAAA");
  assert.equal(res.compressed, false);
});

test("readImageFile 超过输入上限拒绝", async () => {
  const env = setup(["image"]);
  installImageStubs(env);
  const file = imageFile({ size: 60 * 1024 * 1024 });
  await assert.rejects(() => env.mm.Image.readImageFile(file), /too-large/);
});

test("readImageFile 非图片拒绝", async () => {
  const env = setup(["image"]);
  installImageStubs(env);
  const file = { name: "a.txt", type: "text/plain", size: 10 };
  await assert.rejects(() => env.mm.Image.readImageFile(file), /not-image/);
});
