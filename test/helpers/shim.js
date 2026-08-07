"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("node:assert/strict");

const JS_DIR = path.join(__dirname, "..", "..", "js");

function measureTextStub(str) {
  let w = 0;
  for (const ch of String(str)) w += ch.codePointAt(0) > 0x2fff ? 16 : 8;
  return { width: w, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 3 };
}

function makeElement(tag, getSingleton) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {},
    children: [],
    _listeners: {},
    _text: "",
    _value: "",
    _attrs: {},
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    appendChild(c) {
      if (c._parent) {
        const i = c._parent.children.indexOf(c);
        if (i >= 0) c._parent.children.splice(i, 1);
      }
      c._parent = this;
      this.children.push(c);
      return c;
    },
    get firstChild() { return this.children[0] || null; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    addEventListener(type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = this._listeners[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatch(type, event) {
      for (const fn of this._listeners[type] || []) fn(event || { key: "", preventDefault() {} });
    },
    querySelector() { return getSingleton(); },
    querySelectorAll() { return []; },
    get outerHTML() {
      const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      let html = "<" + this.tagName.toLowerCase();
      for (const k in this._attrs) html += " " + k + '="' + esc(this._attrs[k]) + '"';
      html += ">";
      for (const c of this.children) html += c.outerHTML;
      if (this._text) html += esc(this._text);
      return html + "</" + this.tagName.toLowerCase() + ">";
    },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    focus() {},
    select() {},
    click() {},
    remove() {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  };
  return el;
}

function createSandbox() {
  const timers = new Map();
  let nextTimer = 1;

  const canvasCtx = { font: "", measureText: measureTextStub };
  const singletonEl = makeElement("div", () => singletonEl);

  const documentStub = {
    createElement(tag) {
      if (tag === "canvas") return { getContext: () => canvasCtx };
      return makeElement(tag, () => singletonEl);
    },
    createElementNS(ns, tag) { return makeElement(tag, () => singletonEl); },
    getElementById() { return singletonEl; },
    querySelector() { return singletonEl; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    body: singletonEl,
    documentElement: singletonEl,
    readyState: "complete"
  };

  const storage = new Map();
  const localStorageStub = {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); },
    clear() { storage.clear(); },
    key(i) { return [...storage.keys()][i] ?? null; },
    get length() { return storage.size; }
  };

  const windowStub = {
    MM: null,
    addEventListener() {},
    removeEventListener() {},
    open() { return null; },
    setTimeout(fn, ms) {
      const id = nextTimer++;
      timers.set(id, { fn, ms: ms || 0 });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };

  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: localStorageStub,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    console,
    setTimeout: windowStub.setTimeout,
    clearTimeout: windowStub.clearTimeout,
    Blob: function Blob(parts, opts) { this.parts = parts; this.type = (opts && opts.type) || ""; },
    URL: {
      createObjectURL() { return "blob:mock"; },
      revokeObjectURL() {}
    },
    FileReader: function FileReader() {
      this.readAsText = () => { this.result = "{}"; if (this.onload) this.onload(); };
    }
  };

  return {
    sandbox,
    mm: () => windowStub.MM,
    singletonEl,
    localStorage: localStorageStub,
    timers: {
      tick(ms) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.ms <= ms)
          .sort((a, b) => a[1].ms - b[1].ms);
        for (const [id, t] of due) {
          timers.delete(id);
          t.fn();
        }
      },
      pending() { return timers.size; }
    }
  };
}

function loadModule(sandbox, name) {
  const code = fs.readFileSync(path.join(JS_DIR, name + ".js"), "utf8");
  vm.runInNewContext(code, sandbox, { filename: name + ".js" });
  return sandbox.window.MM;
}

function setup(mods) {
  const env = createSandbox();
  for (const name of mods || ["model"]) {
    loadModule(env.sandbox, name);
  }
  return Object.assign(env, { mm: env.sandbox.window.MM });
}

function sameJSON(actual, expected, msg) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);
}

module.exports = { setup, loadModule, createSandbox, sameJSON, JS_DIR };
