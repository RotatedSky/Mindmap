"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers/shim");

function fresh() {
  return setup(["model", "markdown"]);
}

test("parse 列表项构建树", () => {
  const { mm } = fresh();
  const root = mm.Markdown.parse("- a\n- b\n  - b1");
  assert.equal(root.text, "a");
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].text, "b");
  assert.equal(root.children[0].children[0].text, "b1");
});

test("parse 标题语法定为根文本", () => {
  const { mm } = fresh();
  const root = mm.Markdown.parse("# 标题\n- 子项");
  assert.equal(root.text, "标题");
  assert.equal(root.children[0].text, "子项");
});

test("parse 多级标题层级", () => {
  const { mm } = fresh();
  const root = mm.Markdown.parse("# A\n## B\n### C\n## D");
  assert.equal(root.text, "A");
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0].text, "B");
  assert.equal(root.children[0].children[0].text, "C");
  assert.equal(root.children[1].text, "D");
});

test("parse 引用行作为上一节点备注", () => {
  const { mm } = fresh();
  const root = mm.Markdown.parse("- a\n  > 备注1\n  > 备注2");
  assert.equal(root.text, "a");
  assert.equal(root.notes, "备注1\n备注2");
});

test("parse 缩进续行并入多行文本", () => {
  const { mm } = fresh();
  const root = mm.Markdown.parse("- a\n  续行");
  assert.equal(root.text, "a\n续行");
});

test("parse 链接与图片", () => {
  const { mm } = fresh();
  const root = mm.Markdown.parse("- [官网](https://example.com)");
  assert.equal(root.text, "官网");
  assert.equal(root.link, "https://example.com");
  const img = mm.Markdown.parse("- ![](data:image/png;base64,xx) 图");
  assert.equal(img.image, "data:image/png;base64,xx");
  assert.equal(img.text, "图");
});

test("parse 空输入给默认标题", () => {
  const { mm } = fresh();
  const root = mm.Markdown.parse("");
  assert.ok(root.text);
});

test("serialize 输出缩进列表", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  const a = mm.Model.addChild(root, "a");
  mm.Model.addChild(a, "a1");
  mm.Model.addChild(root, "b");
  const md = mm.Markdown.serialize(root);
  assert.equal(md, "- root\n  - a\n    - a1\n  - b");
});

test("serialize 包含链接与备注", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  root.link = "https://x.com";
  root.notes = "note line";
  const md = mm.Markdown.serialize(root);
  assert.ok(md.includes("[root](https://x.com)"));
  assert.ok(md.includes("> note line"));
});

test("serialize 多行节点文本保留换行", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("line1\nline2");
  const md = mm.Markdown.serialize(root);
  assert.ok(md.includes("line1\n  line2"));
});

test("roundtrip 序列化再解析结构一致", () => {
  const { mm } = fresh();
  const root = mm.Model.sampleRoot();
  const md = mm.Markdown.serialize(root);
  const back = mm.Markdown.parse(md);
  assert.equal(back.text, root.text);
  assert.equal(back.children.length, root.children.length);
  assert.equal(back.children[0].children.length, root.children[0].children.length);
  assert.equal(back.children[1].children.length, root.children[1].children.length);
});

test("roundtrip 保留链接、图片、备注", () => {
  const { mm } = fresh();
  const root = mm.Model.createNode("root");
  const kid = mm.Model.addChild(root, "kid");
  kid.link = "https://kid.example";
  kid.notes = "kid note";
  kid.image = "data:image/png;base64,zz";
  const back = mm.Markdown.parse(mm.Markdown.serialize(root));
  const bk = back.children[0];
  assert.equal(bk.link, "https://kid.example");
  assert.equal(bk.notes, "kid note");
  assert.equal(bk.image, "data:image/png;base64,zz");
});
