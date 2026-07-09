/*! 胡侃比特 · 自建访客分析追踪器 v1
 * 零依赖 · ES5 兼容（照顾低端机）· 不引入任何 GFW 阻塞型资源。
 * 隐私：随机第一方访客 id（非跨站、非 IP）；尊重 DNT；不采集任何个人信息。
 * 用法（页面底部，配置在 deploy 后填）：
 *   <script src="assets/analytics.js?v=…" data-endpoint="https://你的worker域名/collect" data-site="hukanbit" defer></script>
 * 未配置 data-endpoint 时整段静默不工作，可安全随站发布。
 */
(function () {
  "use strict";
  var s = document.currentScript || (function () { var a = document.getElementsByTagName("script"); return a[a.length - 1]; })();
  var cfg = window.HKB_A || {};
  var ENDPOINT = cfg.endpoint || (s && s.getAttribute("data-endpoint")) || "";
  if (!ENDPOINT) return; // 未配置 → 静默

  var SITE = cfg.site || (s && s.getAttribute("data-site")) || "hukanbit";
  var SEL = cfg.sections || (s && s.getAttribute("data-sections")) || "main section, .gx-exhibit, .experiment, [data-track]";
  var skipLocal = ((s && s.getAttribute("data-skip-local")) || "true") !== "false";

  var host = location.hostname;
  if (skipLocal && (host === "" || host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host) || location.protocol === "file:")) return;

  /* ── 身份（匿名、第一方）── */
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  var dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.msDoNotTrack === "1";
  var vid = "";
  try { if (!dnt) { vid = localStorage.getItem("hkb-a-vid"); if (!vid) { vid = rid(); localStorage.setItem("hkb-a-vid", vid); } } } catch (e) {}
  var sid = "";
  function touchSession() {
    try {
      var raw = sessionStorage.getItem("hkb-a-sid"), o = raw ? JSON.parse(raw) : null, t = Date.now();
      if (!sid) { sid = (o && (t - o.t) < 18e5) ? o.id : rid(); }      // 30 分钟无活动 = 新会话
      sessionStorage.setItem("hkb-a-sid", JSON.stringify({ id: sid, t: t }));
    } catch (e) { if (!sid) sid = rid(); }
  }
  touchSession();
  if (!vid) vid = sid; // DNT 或无存储 → 用会话级临时 id

  /* ── 环境探测 ── */
  var ua = navigator.userAgent || "";
  var device = /Mobi|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua) ? "mobile" : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
  var os = /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /CrOS/i.test(ua) ? "ChromeOS" : /Linux/i.test(ua) ? "Linux" : "其他";
  var browser = /Edg\//i.test(ua) ? "Edge" : /OPR\/|Opera/i.test(ua) ? "Opera" : /MicroMessenger/i.test(ua) ? "微信" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "其他";
  var utm = {}; (function () {
    var q = location.search.slice(1).split("&");
    for (var i = 0; i < q.length; i++) { var kv = q[i].split("="); var k = decodeURIComponent(kv[0] || "");
      if (k.indexOf("utm_") === 0) utm[k.slice(4)] = decodeURIComponent((kv[1] || "").replace(/\+/g, " ")); }
  })();

  function ctx() {
    return {
      path: location.pathname, title: document.title,
      lang: document.documentElement.getAttribute("lang") || navigator.language || "",
      ref: document.referrer || "", origin: location.origin,
      screen: (screen.width || 0) + "x" + (screen.height || 0), vw: window.innerWidth || 0,
      device: device, os: os, browser: browser, utm: utm
    };
  }

  /* ── 传输（增量上报）── */
  function send(events) {
    if (!events || !events.length) return;
    var payload = JSON.stringify({ site: SITE, vid: vid, sid: sid, ctx: ctx(), events: events });
    var ok = false;
    try { if (navigator.sendBeacon) ok = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain;charset=UTF-8" })); } catch (e) {}
    if (!ok) { try { fetch(ENDPOINT, { method: "POST", body: payload, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } }); } catch (e) {} }
    touchSession();
  }

  /* ── 板块停留 + 会话时长 + 滚动深度 ── */
  var inView = {};   // 正在计时的板块 → 起始时间
  var geom = {};     // 当前几何相交的板块（用于切回前台后恢复计时）
  var secAcc = {};   // 板块累计停留（毫秒，增量）
  var engAcc = 0, engSince = 0, maxScroll = 0;
  var visible = !document.hidden;

  function labelFor(el) {
    if (el.__hkb) return el.__hkb;
    var l = el.getAttribute("data-track");
    if (!l) { var h = el.querySelector("h1,h2,h3"); l = h && h.textContent ? h.textContent : (el.id || el.className || el.tagName); }
    l = (l || "").replace(/\s+/g, " ").trim().slice(0, 80) || "(未命名)";
    el.__hkb = l; return l;
  }
  function settle() {
    var t = Date.now();
    if (!visible) return;
    if (engSince) { engAcc += t - engSince; engSince = t; }
    for (var k in inView) if (inView.hasOwnProperty(k)) { secAcc[k] = (secAcc[k] || 0) + (t - inView[k]); inView[k] = t; }
  }
  function flush() {
    settle();
    var evs = [], k;
    for (k in secAcc) if (secAcc.hasOwnProperty(k) && secAcc[k] >= 1000) { evs.push({ t: "sec", name: k, dwell: Math.round(secAcc[k]) }); }
    secAcc = {};
    if (engAcc >= 1000) { evs.push({ t: "end", dur: Math.round(engAcc), scroll: maxScroll }); engAcc = 0; }
    send(evs);
  }

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      var t = Date.now();
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i], lab = labelFor(en.target);
        if (en.isIntersecting) { geom[lab] = 1; if (visible && !inView[lab]) inView[lab] = t; }
        else { delete geom[lab]; if (inView[lab]) { secAcc[lab] = (secAcc[lab] || 0) + (t - inView[lab]); delete inView[lab]; } }
      }
    }, { threshold: 0, rootMargin: "-30% 0px -30% 0px" }); // 进入视口中央“阅读带”才计时，长短板块都准
    try { var els = document.querySelectorAll(SEL); for (var i = 0; i < els.length; i++) io.observe(els[i]); } catch (e) {}
  }

  window.addEventListener("scroll", function () {
    var de = document.documentElement, b = document.body;
    var h = Math.max(de.scrollHeight, b ? b.scrollHeight : 0);
    var p = h > 0 ? Math.round(((window.pageYOffset || de.scrollTop) + window.innerHeight) / h * 100) : 0;
    if (p > maxScroll) maxScroll = p > 100 ? 100 : p;
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { settle(); inView = {}; engSince = 0; visible = false; flush(); }
    else { visible = true; engSince = Date.now(); for (var k in geom) if (geom.hasOwnProperty(k)) inView[k] = Date.now(); }
  });
  window.addEventListener("pagehide", flush);
  setInterval(function () { if (visible) flush(); }, 2e4); // 心跳 20s：实时在线 + 防丢数据

  /* ── 启动：先记一次页面浏览 ── */
  send([{ t: "pv" }]);
})();
