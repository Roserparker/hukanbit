/* 胡侃比特 · 共享脚本：阅读进度条 + 滚动进场动画 */
(function () {
  "use strict";

  // 阅读进度条（仅文章页存在 #progress）
  var bar = document.getElementById("progress");
  if (bar) {
    var update = function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = "scaleX(" + ratio + ")";
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // 滚动进场
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  // 页脚年份
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- 字体与字号切换（宋/楷/仿/黑 × 小/标准/大/特大）---------- */
  var fsBtn = document.getElementById("font-switch");
  var fsMenu = document.getElementById("font-menu");
  if (fsBtn && fsMenu) {
    var fsGet = function () { try { return localStorage.getItem("hkb-font") || "song"; } catch (e) { return "song"; } };
    var fsMark = function () {
      var cur = fsGet();
      fsMenu.querySelectorAll("button[data-f]").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-f") === cur);
      });
    };
    var szGet = function () { try { return localStorage.getItem("hkb-size") || "m"; } catch (e) { return "m"; } };
    var szMark = function () {
      var cur = szGet();
      fsMenu.querySelectorAll("button[data-s]").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-s") === cur);
      });
    };
    fsBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      fsMenu.hidden = !fsMenu.hidden;
      if (!fsMenu.hidden) { fsMark(); szMark(); }
    });
    fsMenu.addEventListener("click", function (ev) {
      var sb = ev.target.closest("button[data-s]");
      if (sb) {
        var sv = sb.getAttribute("data-s");
        if (sv === "m") document.documentElement.removeAttribute("data-size");
        else document.documentElement.setAttribute("data-size", sv);
        try { sv === "m" ? localStorage.removeItem("hkb-size") : localStorage.setItem("hkb-size", sv); } catch (e) { /* 忽略 */ }
        szMark();
        ev.stopPropagation(); /* 菜单不收，方便连续比较字号 */
        return;
      }
      var b = ev.target.closest("button[data-f]");
      if (!b) return;
      var v = b.getAttribute("data-f");
      if (v === "song") document.documentElement.removeAttribute("data-font");
      else document.documentElement.setAttribute("data-font", v);
      try { v === "song" ? localStorage.removeItem("hkb-font") : localStorage.setItem("hkb-font", v); } catch (e) { /* 忽略 */ }
      fsMark();
      fsMenu.hidden = true;
      ev.stopPropagation();
    });
    document.addEventListener("click", function () { fsMenu.hidden = true; });
  }

  /* ---------- 点击涟漪 ----------
     每次按下，在指尖处荡开一圈细线（声呐式反馈）。
     尊重 prefers-reduced-motion；高频连点（如挖矿游戏）时限流。
     仅鼠标（pointer:fine）生效——触屏上这圈弧光很违和，故关闭。 */
  var pingReduced = false;
  var pingFine = true;
  try {
    var pingMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    pingReduced = pingMq.matches;
    if (typeof pingMq.addEventListener === "function") {
      pingMq.addEventListener("change", function (e) { pingReduced = e.matches; });
    }
    var fineMq = window.matchMedia("(hover: hover) and (pointer: fine)");
    pingFine = fineMq.matches;
    if (typeof fineMq.addEventListener === "function") {
      fineMq.addEventListener("change", function (e) { pingFine = e.matches; });
    }
  } catch (e) { /* 旧环境忽略 */ }

  var pingLive = 0;
  function spawnPing(x, y) {
    if (!pingFine || pingReduced || pingLive >= 12) return;
    var p = document.createElement("span");
    p.className = "click-ping";
    p.style.left = x + "px";
    p.style.top = y + "px";
    pingLive++;
    var dead = false;
    var done = function () {
      if (dead) return;
      dead = true;
      pingLive--;
      if (p.parentNode) p.parentNode.removeChild(p);
    };
    p.addEventListener("animationend", done);
    setTimeout(done, 750); // 动画事件丢失时的兜底
    document.body.appendChild(p);
  }

  var downEvt = window.PointerEvent ? "pointerdown" : "mousedown";
  document.addEventListener(downEvt, function (ev) {
    if (ev.button) return; // 右键/中键不响
    spawnPing(ev.clientX, ev.clientY);
  }, { passive: true });

  /* ---------- 学习足迹 ----------
     只存在你自己的浏览器 localStorage 里，不上传任何数据。
     设计参考 Coinbase Earn 的"学习即进度"：让读者看见自己走了多远。 */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式忽略 */ } }
  };

  // 文章页：记下"读过"
  var m = location.pathname.match(/articles\/(0[1-5])\.html$/);
  if (m) store.set("hkb-read-" + m[1], "1");
  // 实验室页：记下"来过"
  if (/lab\.html$/.test(location.pathname)) store.set("hkb-lab", "1");
  // 长廊：记下"参观过"（为将来的集章寻宝留钩子）
  if (/gallery\.html$/.test(location.pathname)) store.set("hkb-gallery", "1");
  // 布道厅
  if (/satoshi\.html$/.test(location.pathname)) store.set("hkb-satoshi", "1");
  // 学堂
  if (/study\.html$/.test(location.pathname)) store.set("hkb-study", "1");
  // 金库
  if (/treasury\.html$/.test(location.pathname)) store.set("hkb-treasury", "1");

  // 首页：点亮已读标签、阅读进度与"三步上手"的完成态
  var toc = document.querySelector(".toc");
  if (toc) {
    var readCount = 0;
    var links = toc.querySelectorAll("a[href^='articles/']");
    links.forEach(function (a) {
      var mm = a.getAttribute("href").match(/articles\/(0[1-5])\.html/);
      if (!mm || store.get("hkb-read-" + mm[1]) !== "1") return;
      readCount++;
      var tags = a.querySelector(".tags");
      if (tags) {
        var done = document.createElement("span");
        done.className = "tag done";
        done.textContent = "✓ 已读";
        tags.appendChild(done);
      }
    });
    var prog = document.getElementById("read-progress");
    if (prog && readCount > 0) {
      prog.hidden = false;
      prog.textContent = readCount >= 5
        ? "✓ 五篇全部读完——你已经比 99% 的人更懂钱了"
        : "已读 " + readCount + " / 5 · 接着读，每篇末尾都有配套实验";
    }
    var stepState = {
      read: store.get("hkb-read-01") === "1",
      mine: store.get("hkb-mined") === "1" || store.get("hkb-lab") === "1",
      tx: store.get("hkb-first-tx") === "1"
    };
    document.querySelectorAll(".step-card").forEach(function (card) {
      var key = card.getAttribute("data-step");
      if (!stepState[key]) return;
      card.classList.add("done");
      var st = card.querySelector(".step-status");
      if (st) st.textContent = "✓ 已完成";
    });
  }

  /* ---------- 创世转储：完整 285 字节，从噪声里浮出一句话 ----------
     区块 #0 完整三栏陈列（偏移 | 字节 | ASCII）。机器的呓语先静成底纹，
     随滚动，报头那 69 个字节逐字升温、走到光里，拼出一句人话；随后报纸复刻显影。 */
  var stele = document.getElementById("gen-stele");
  if (stele) {
    var dump = document.getElementById("gen-dump");
    var clip = document.getElementById("gen-clip");
    /* 创世区块原始字节（285B）：区块头 + 1 笔 coinbase 交易 */
    var HEX =
      "0100000000000000000000000000000000000000000000000000000000000000" +
      "000000003BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA" +
      "4B1E5E4A29AB5F49FFFF001D1DAC2B7C01010000000100000000000000000000" +
      "00000000000000000000000000000000000000000000FFFFFFFF4D04FFFF001D" +
      "0104455468652054696D65732030332F4A616E2F32303039204368616E63656C" +
      "6C6F72206F6E206272696E6B206F66207365636F6E64206261696C6F75742066" +
      "6F722062616E6B73FFFFFFFF0100F2052A01000000434104678AFDB0FE554827" +
      "1967F1A67130B7105CD6A828E03909A67962E0EA1F61DEB649F6BC3F4CEF38C4" +
      "F35504E51EC112DE5C384DF7BA0B8D578A4C702B6BF11D5FAC00000000";
    var MSG_START = 131, MSG_LEN = 69, LEN_BYTE = 130;
    var CP1252 = { 128:"€",130:"‚",131:"ƒ",132:"„",133:"…",134:"†",135:"‡",136:"ˆ",137:"‰",138:"Š",139:"‹",140:"Œ",142:"Ž",145:"‘",146:"’",147:"“",148:"”",149:"•",150:"–",151:"—",152:"˜",153:"™",154:"š",155:"›",156:"œ",158:"ž",159:"Ÿ" };
    function glyph(b) {
      if (b === 32) return " ";
      if (b > 32 && b < 127) return String.fromCharCode(b);
      if (b >= 160) return String.fromCharCode(b);
      if (CP1252[b]) return CP1252[b];
      return ".";
    }
    var bytes = [];
    for (var bi = 0; bi < HEX.length; bi += 2) bytes.push(parseInt(HEX.substr(bi, 2), 16));

    var mB = [], mA = [], rIdx, cIdx, gi;
    for (rIdx = 0; rIdx < Math.ceil(bytes.length / 16); rIdx++) {
      var row = document.createElement("div");
      row.className = "gen-row";
      var off = document.createElement("span");
      off.className = "gen-off";
      off.textContent = ("00000000" + (rIdx * 16).toString(16).toUpperCase()).slice(-8);
      row.appendChild(off);
      var bcol = document.createElement("span");
      bcol.className = "gen-bytes";
      var acol = document.createElement("span");
      acol.className = "gen-ascii";
      for (cIdx = 0; cIdx < 16; cIdx++) {
        gi = rIdx * 16 + cIdx;
        if (gi >= bytes.length) break;
        var bs = document.createElement("span");
        bs.textContent = HEX.substr(gi * 2, 2);
        if (cIdx === 7) bs.className = "gap";
        var as = document.createElement("span");
        as.textContent = glyph(bytes[gi]);
        if (gi >= MSG_START && gi < MSG_START + MSG_LEN) {
          var mk = gi - MSG_START;
          bs.className += (bs.className ? " " : "") + "gen-m";
          as.className = "gen-m";
          bs.setAttribute("data-m", mk);
          as.setAttribute("data-m", mk);
          mB[mk] = bs; mA[mk] = as;
        }
        if (gi === LEN_BYTE) { bs.title = "0x45 = 69：这句话的字节长度"; as.title = bs.title; }
        bcol.appendChild(bs);
        acol.appendChild(as);
      }
      row.appendChild(bcol);
      row.appendChild(acol);
      dump.appendChild(row);
    }

    /* 悬停：把任意一个发亮字节和它对应的字母一起挑亮 */
    function hot(t, on) {
      var k = t.getAttribute && t.getAttribute("data-m");
      if (k == null) return;
      if (mB[k]) mB[k].classList.toggle("hot", on);
      if (mA[k]) mA[k].classList.toggle("hot", on);
    }
    dump.addEventListener("mouseover", function (ev) { hot(ev.target, true); });
    dump.addEventListener("mouseout", function (ev) { hot(ev.target, false); });

    /* 一次性显影：进入视野即触发，与滚动彻底解耦——那 69 个字节逐字升温走到光里 */
    var lastLit = -1;
    function applyLit(n) {
      if (n === lastLit) return;
      for (var k = 0; k < MSG_LEN; k++) {
        var on = k < n;
        mB[k].classList.toggle("lit", on);
        mA[k].classList.toggle("lit", on);
      }
      stele.classList.toggle("focused", n > 4);
      lastLit = n;
    }
    var rmG = false;
    try { rmG = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* 忽略 */ }
    function runReveal() {
      if (rmG) { applyLit(MSG_LEN); clip.classList.add("show"); return; }
      var t0 = 0;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / 2600);
        applyLit(Math.round((1 - (1 - p) * (1 - p)) * MSG_LEN)); /* ease-out */
        if (p < 1) requestAnimationFrame(step);
        else { stele.classList.add("flash"); setTimeout(function () { clip.classList.add("show"); }, 500); }
      }
      requestAnimationFrame(step);
    }
    if ("IntersectionObserver" in window) {
      var gio = new IntersectionObserver(function (entries) {
        for (var gj = 0; gj < entries.length; gj++) {
          if (entries[gj].isIntersecting) { gio.disconnect(); runReveal(); break; }
        }
      }, { rootMargin: "0px 0px -18% 0px", threshold: 0.12 });
      gio.observe(stele);
    } else {
      applyLit(MSG_LEN);
      clip.classList.add("show");
    }
  }
})();

/* ---------- 语言偏好记忆（简/繁/EN 切换时记下选择） ---------- */
(function () {
  "use strict";
  var links = document.querySelectorAll(".lang-switch a[data-lang]");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function () {
      try { localStorage.setItem("hkb-lang", this.getAttribute("data-lang")); } catch (e) { /* 忽略 */ }
    });
  }
})();

/* ---------- 悬浮重播徽标「画入」 ----------
   cursor 每次进入文章卡 / 实验室招牌，金线重新生长一遍——勾住注意力。
   做法：把徽标及其线条的 animation 先置 none、强制回流、再清空，
   于是 CSS 里 .visible 的 ill-draw / ill-ignite 会从头重跑（none→name 即重启）。
   ——比切类名更可靠：同名动画靠切类名是不会重启的（这正是上一版只「亮」不「画」的原因）。
   尊重 prefers-reduced-motion；触屏无 hover，初次滚动进场动画照常。 */
(function () {
  "use strict";
  var rm = false;
  try { rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* 忽略 */ }
  if (rm) return;
  function replay(host) {
    var ill = host.querySelector(".art-ill");
    if (!ill) return;
    var els = [ill], strokes = ill.querySelectorAll(".ill .s"), j;
    for (j = 0; j < strokes.length; j++) els.push(strokes[j]);
    for (j = 0; j < els.length; j++) els[j].style.animation = "none";
    void ill.offsetWidth;          /* 强制回流，让 .visible 的动画从头重跑 */
    for (j = 0; j < els.length; j++) els[j].style.animation = "";
  }
  var hosts = document.querySelectorAll(".art-card a, .lab-teaser");
  for (var i = 0; i < hosts.length; i++) {
    hosts[i].addEventListener("mouseenter", (function (h) {
      return function () { replay(h); };
    })(hosts[i]));
  }
})();

/* ---------- 术语注释：点按开合的小卡片 ----------
   正文生词（法币、M2、准备金……）不再用整段文字解释——
   点一下词本身，弹出两三句讲透的小注。
   点按开合、Esc 关闭并还焦、点外即关、同屏只开一张。 */
(function () {
  "use strict";
  if (!document.querySelector(".term-wrap")) return;
  var openBtn = null;
  function cardOf(btn) {
    var id = btn.getAttribute("aria-controls");
    return id ? document.getElementById(id) : null;
  }
  function close() {
    if (!openBtn) return;
    var card = cardOf(openBtn);
    if (card) card.hidden = true;
    openBtn.setAttribute("aria-expanded", "false");
    openBtn = null;
  }
  function open(btn) {
    close();
    var card = cardOf(btn);
    if (!card) return;
    card.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    openBtn = btn;
    card.classList.remove("flip");
    var r = card.getBoundingClientRect();
    if (r.right > window.innerWidth - 10) card.classList.add("flip");
  }
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("button.term") : null;
    if (btn) {
      ev.stopPropagation();
      if (openBtn === btn) close(); else open(btn);
      return;
    }
    if (openBtn && !(ev.target.closest && ev.target.closest(".term-card"))) close();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && openBtn) {
      var b = openBtn;
      close();
      b.focus();
    }
  });
})();

/* ---------- 移动端导航：汉堡抽屉 ----------
   ≤880px 时头部把八项导航折叠进一个下拉抽屉。按钮由 JS 注入，
   无需改任何 HTML；桌面端按钮 display:none 不出现。
   点按开合 / 点链接即关 / 点抽屉外即关 / Esc 关 / 放大回桌面自动复位。 */
(function () {
  "use strict";
  var header = document.querySelector(".site-header");
  var inner = header && header.querySelector(".inner");
  var nav = inner && inner.querySelector(".site-nav");
  if (!header || !inner || !nav) return;
  if (!nav.id) nav.id = "site-nav";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nav-toggle";
  btn.setAttribute("aria-label", "打开导航菜单");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", nav.id);
  for (var i = 0; i < 3; i++) {
    var bar = document.createElement("span");
    bar.className = "bar";
    btn.appendChild(bar);
  }
  inner.appendChild(btn);

  function close() {
    if (!header.classList.contains("nav-open")) return;
    header.classList.remove("nav-open");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "打开导航菜单");
  }
  function open() {
    header.classList.add("nav-open");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "关闭导航菜单");
  }

  btn.addEventListener("click", function (ev) {
    ev.stopPropagation();
    if (header.classList.contains("nav-open")) close(); else open();
  });
  nav.addEventListener("click", function (ev) {
    if (ev.target.closest("a")) close();
  });
  document.addEventListener("click", function (ev) {
    if (header.classList.contains("nav-open") && !ev.target.closest(".site-header")) close();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" || ev.key === "Esc") close();
  });
  try {
    var wide = window.matchMedia("(min-width: 881px)");
    var onWide = function () { if (wide.matches) close(); };
    if (typeof wide.addEventListener === "function") wide.addEventListener("change", onWide);
    else if (typeof wide.addListener === "function") wide.addListener(onWide);
  } catch (e) { /* 旧环境忽略 */ }
})();
