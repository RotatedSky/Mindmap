"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const PATTERNS = [
  { name: "Windows 盘符绝对路径", re: /\b[A-Za-z]:[\\/]/ },
  { name: "UNC 网络路径", re: /\\\\{2,}[A-Za-z]/ },
  { name: "Unix 常见绝对路径", re: /(^|[^A-Za-z0-9/])\/(usr|home|etc|tmp|var|opt|Users|private|root)\// }
];

function findAbsolutePaths(file) {
  const text = fs.readFileSync(file, "utf8");
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      if (p.re.test(line)) out.push({ file, line: i + 1, name: p.name, content: line.trim() });
    }
  });
  return out;
}

function sourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(js|css|html|json|webmanifest)$/.test(ent.name)) files.push(p);
    }
  };
  for (const dir of ["js", "test", "css", "tools"]) walk(path.join(ROOT, dir));
  for (const f of ["index.html", "sw.js", "manifest.webmanifest", "package.json"]) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) files.push(p);
  }
  return files;
}

test("检测函数能识别绝对路径并忽略 URL 与命名空间", () => {
  const win = ["C", ":", "\\", "Users", "\\", "x", "\\", "a.js"].join("");
  const winFwd = ["D", ":", "/", "SN", "/", "file.js"].join("");
  const url = ["https", ":", "//example.com"].join("");
  const ns = ["http", ":", "//www.w3.org/2000/svg"].join("");
  const data = ["data", ":", "image/png;base64,xx"].join("");
  const unix = ["load(\"", "/", "usr", "/", "local", "/", "bin", "/", "x\")"].join("");
  const regexLiteral = ["const r = /usr\\/x/;"].join("");
  const unc = ["\\", "\\", "\\", "\\", "server", "\\", "share"].join("");
  const escapedUnicode = ["\\u6587\\u5b57"].join("");
  assert.equal(PATTERNS[0].re.test("require(\"" + win + "\")"), true);
  assert.equal(PATTERNS[0].re.test("'" + winFwd + "'"), true);
  assert.equal(PATTERNS[0].re.test("const u = \"" + url + "\""), false);
  assert.equal(PATTERNS[0].re.test("const n = \"" + ns + "\""), false);
  assert.equal(PATTERNS[0].re.test("const d = \"" + data + "\""), false);
  assert.equal(PATTERNS[1].re.test(unc), true);
  assert.equal(PATTERNS[1].re.test(escapedUnicode), false);
  assert.equal(PATTERNS[1].re.test("atomText(\"\\frac\")"), false);
});

test("源码中不存在绝对文件路径", () => {
  const violations = [];
  for (const f of sourceFiles()) violations.push(...findAbsolutePaths(f));
  if (violations.length) {
    const detail = violations.map((v) => v.file + ":" + v.line + " [" + v.name + "] " + v.content).join("\n");
    assert.fail("发现绝对路径（请改为相对路径）:\n" + detail);
  }
});
