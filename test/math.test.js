"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setup, sameJSON } = require("./helpers/shim");

function fresh() {
  return setup(["math"]);
}

test("parse 单个字符为 atom", () => {
  const { mm } = fresh();
  const t = mm.Math.parse("a");
  assert.equal(t.type, "atom");
  assert.equal(t.str, "a");
});

test("parse 普通表达式为 row", () => {
  const { mm } = fresh();
  const t = mm.Math.parse("E=mc");
  assert.equal(t.type, "row");
  assert.equal(t.items.length, 4);
  sameJSON(t.items.map((i) => i.str), ["E", "=", "m", "c"]);
});

test("parse 上标与下标", () => {
  const { mm } = fresh();
  const sup = mm.Math.parse("x^2");
  assert.equal(sup.type, "script");
  assert.equal(sup.base.str, "x");
  assert.equal(sup.sup.type, "atom");
  assert.equal(sup.sup.str, "2");
  const sub = mm.Math.parse("x_1");
  assert.equal(sub.type, "script");
  assert.equal(sub.sub.str, "1");
});

test("parse 分数", () => {
  const { mm } = fresh();
  const t = mm.Math.parse("\\frac{a}{b}");
  assert.equal(t.type, "frac");
  assert.equal(t.num.type, "row");
  assert.equal(t.num.items[0].str, "a");
  assert.equal(t.den.items[0].str, "b");
});

test("parse 平方根", () => {
  const { mm } = fresh();
  const t = mm.Math.parse("\\sqrt{x}");
  assert.equal(t.type, "sqrt");
  assert.equal(t.body.type, "row");
  assert.equal(t.body.items[0].str, "x");
});

test("parse 希腊字母与运算符", () => {
  const { mm } = fresh();
  assert.equal(mm.Math.parse("\\alpha").str, "\u03b1");
  assert.equal(mm.Math.parse("\\beta").str, "\u03b2");
  assert.equal(mm.Math.parse("\\times").str, "\u00d7");
  assert.equal(mm.Math.parse("\\infty").str, "\u221e");
  assert.equal(mm.Math.parse("\\to").str, "\u2192");
});

test("parse 未知命令原样保留", () => {
  const { mm } = fresh();
  assert.equal(mm.Math.parse("\\foo").str, "\\foo");
});

test("parse 花括号分组", () => {
  const { mm } = fresh();
  const t = mm.Math.parse("a^{bc}");
  assert.equal(t.type, "script");
  assert.equal(t.sup.type, "row");
  sameJSON(t.sup.items.map((i) => i.str), ["b", "c"]);
});

test("width/height 返回正值且尺寸合理", () => {
  const { mm } = fresh();
  const atom = mm.Math.parse("a");
  assert.ok(mm.Math.width(atom, 16) > 0);
  const h = mm.Math.height(atom, 16);
  assert.ok(h.ascent >= 12);
  assert.ok(h.descent >= 3);
  assert.equal(h.ascent + h.descent, h.ascent + h.descent);
});

test("分数比单字符更高更宽", () => {
  const { mm } = fresh();
  const atom = mm.Math.parse("a");
  const frac = mm.Math.parse("\\frac{a}{b}");
  assert.ok(mm.Math.width(frac, 16) > mm.Math.width(atom, 16));
  const ah = mm.Math.height(atom, 16);
  const fh = mm.Math.height(frac, 16);
  assert.ok(fh.ascent + fh.descent > ah.ascent + ah.descent);
});

test("sqrt 高度不低于正文", () => {
  const { mm } = fresh();
  const body = mm.Math.parse("x");
  const rt = mm.Math.parse("\\sqrt{x}");
  const bh = mm.Math.height(body, 16);
  const rh = mm.Math.height(rt, 16);
  assert.ok(rh.ascent + rh.descent >= bh.ascent + bh.descent);
});

test("相同字号下测量结果稳定", () => {
  const { mm } = fresh();
  const t = mm.Math.parse("E=mc^2");
  assert.equal(mm.Math.width(t, 16), mm.Math.width(t, 16));
});
