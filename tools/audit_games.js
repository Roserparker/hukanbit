#!/usr/bin/env node
/* 发布前运行时体检：在 Node 里用 DOM 替身执行 games.js 的全部组件工厂。
   用法：node tools/audit_games.js assets/games.js
        node tools/audit_games.js zh-hant/assets/games.js
   两条路径都跑：①「看过开场」（hkb-intro-* 已设，直接执行完整构建——TAU 那类 bug 在这里现形）
               ②「初次到访」（开场卡渲染路径）。
   判定：挂载点出现「没能启动/沒能啟動」兜底文案 = 该组件运行时崩溃。 */
"use strict";
var fs = require("fs");
var vm = require("vm");

var file = process.argv[2] || "assets/games.js";
var code = fs.readFileSync(file, "utf-8");

var GAMES = ["time-machine", "pow-miner", "mempool", "bazi-calendar", "btc-ticker",
             "first-tx", "chain", "double-spend", "byzantine", "debt-clock", "btc-yield"];
var INTRO = ["time-machine", "pow-miner", "mempool", "double-spend", "byzantine"];

function noop() {}

function mkCtx() {
  return new Proxy({}, {
    get: function (t, k) {
      if (k === "canvas") return mkEl("canvas");
      if (typeof k === "string") return function () { return mkGrad(); };
      return noop;
    },
    set: function () { return true; }
  });
}
function mkGrad() { return { addColorStop: noop }; }

function mkEl(tag) {
  var classes = {};
  var el = {
    tagName: String(tag || "div").toUpperCase(),
    children: [],
    childNodes: [],
    style: new Proxy({ setProperty: noop, removeProperty: noop }, {
      get: function (t, k) { return t[k] !== undefined ? t[k] : ""; },
      set: function (t, k, v) { t[k] = v; return true; }
    }),
    dataset: {},
    attributes: {},
    classList: {
      add: function () { for (var i = 0; i < arguments.length; i++) classes[arguments[i]] = 1; },
      remove: function () { for (var i = 0; i < arguments.length; i++) delete classes[arguments[i]]; },
      contains: function (c) { return !!classes[c]; },
      toggle: function (c, f) { if (f === undefined) f = !classes[c]; f ? (classes[c] = 1) : delete classes[c]; return !!f; }
    },
    _text: "",
    innerHTML: "",
    setAttribute: function (k, v) { this.attributes[k] = String(v); if (k.indexOf("data-") === 0) this.dataset[k.slice(5).replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = String(v); },
    getAttribute: function (k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
    removeAttribute: function (k) { delete this.attributes[k]; },
    appendChild: function (c) { this.children.push(c); this.childNodes.push(c); if (c) c.parentNode = this; return c; },
    prepend: function (c) { this.children.unshift(c); if (c) c.parentNode = this; },
    insertBefore: function (c) { this.children.unshift(c); if (c) c.parentNode = this; return c; },
    removeChild: function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove: function () {},
    insertAdjacentHTML: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
    querySelector: function () { return mkEl("div"); },
    querySelectorAll: function () { return []; },
    closest: function () { return null; },
    contains: function () { return false; },
    cloneNode: function () { return mkEl(tag); },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 320, bottom: 200, width: 320, height: 200 }; },
    getContext: function () { return mkCtx(); },
    focus: noop, blur: noop, click: noop,
    offsetWidth: 320, offsetHeight: 200, clientWidth: 320, clientHeight: 200,
    scrollLeft: 0, scrollTop: 0, scrollWidth: 320, scrollHeight: 200,
    parentNode: null, firstChild: null, nextSibling: null,
    value: "", disabled: false, hidden: false
  };
  Object.defineProperty(el, "textContent", {
    get: function () { return el._text; },
    set: function (v) { el._text = String(v); }
  });
  return el;
}

function runPass(label, seedIntro) {
  var mounts = {};
  GAMES.forEach(function (g) {
    var m = mkEl("div");
    m.setAttribute("data-game", g);
    mounts[g] = m;
  });

  var store = {};
  if (seedIntro) INTRO.forEach(function (g) { store["hkb-intro-" + g] = "1"; });

  var doc = {
    readyState: "complete",
    hidden: false,
    documentElement: mkEl("html"),
    head: mkEl("head"),
    body: mkEl("body"),
    createElement: mkEl,
    createElementNS: function (ns, t) { return mkEl(t); },
    createDocumentFragment: function () { return mkEl("fragment"); },
    createTextNode: function (t) { var n = mkEl("text"); n.textContent = t; return n; },
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: function (sel) {
      if (sel.indexOf("btc-ticker") >= 0) return mounts["btc-ticker"];
      return null;
    },
    querySelectorAll: function (sel) {
      if (sel === "[data-game]") return GAMES.map(function (g) { return mounts[g]; });
      return [];
    }
  };

  var sandbox = {
    console: console,
    Math: Math, Date: Date, JSON: JSON, Promise: Promise,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
    setTimeout: function () { return 1; }, clearTimeout: noop,
    setInterval: function () { return 1; }, clearInterval: noop,
    requestAnimationFrame: function () { return 1; },
    cancelAnimationFrame: noop,
    performance: { now: function () { return 0; } },
    navigator: { language: "zh-CN", onLine: false },
    localStorage: {
      getItem: function (k) { return store[k] !== undefined ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    sessionStorage: {
      getItem: function () { return null; }, setItem: noop, removeItem: noop
    },
    matchMedia: function () { return { matches: false, addEventListener: noop, addListener: noop }; },
    getComputedStyle: function () { return { getPropertyValue: function () { return ""; } }; },
    fetch: function () { return new Promise(function () {}); },
    devicePixelRatio: 1,
    innerWidth: 1280, innerHeight: 800,
    addEventListener: noop, removeEventListener: noop,
    document: doc
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });

  var fails = [], untouched = [];
  GAMES.forEach(function (g) {
    var txt = mounts[g].textContent || "";
    if (txt.indexOf("没能启动") >= 0 || txt.indexOf("沒能啟動") >= 0 || txt.indexOf("沒能啓動") >= 0) fails.push(g);
    /* boot 对每个触达的挂载点都会赋 __gmDestroy（成功）或写兜底文案（失败）；
       ticker/chain/debt 会自己摘掉 gm-box，故不能用 gm-box 判定 */
    if (!("__gmDestroy" in mounts[g]) && txt.indexOf("没能") < 0 && txt.indexOf("沒能") < 0) untouched.push(g);
  });
  if (untouched.length) {
    console.error("FAIL [" + label + "] boot 未触达挂载点（体检空转）: " + untouched.join(", "));
    return false;
  }
  if (fails.length) {
    console.error("FAIL [" + label + "] " + file + " → " + fails.join(", "));
    return false;
  }
  console.log("ok   [" + label + "] " + file + " · " + GAMES.length + " factories ran");
  return true;
}

var ok1 = runPass("intro-seen ", true);
var ok2 = runPass("intro-fresh", false);
process.exit(ok1 && ok2 ? 0 : 1);
