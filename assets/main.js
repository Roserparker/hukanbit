/* 胡侃比特 · 共享脚本：阅读进度条 + 滚动进场动画 */
(function () {
  "use strict";

  // 阅读进度条（仅文章页存在 #progress）
  var bar = document.getElementById("progress");
  if (bar) {
    var update = function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = pct + "%";
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

  /* ---------- 点击涟漪 ----------
     每次按下，在指尖处荡开一圈细线（声呐式反馈）。
     尊重 prefers-reduced-motion；高频连点（如挖矿游戏）时限流。 */
  var pingReduced = false;
  try {
    var pingMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    pingReduced = pingMq.matches;
    if (typeof pingMq.addEventListener === "function") {
      pingMq.addEventListener("change", function (e) { pingReduced = e.matches; });
    }
  } catch (e) { /* 旧环境忽略 */ }

  var pingLive = 0;
  function spawnPing(x, y) {
    if (pingReduced || pingLive >= 12) return;
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

  /* ---------- 创世拓片：十六进制 ↔ 头条的双向映射 ----------
     前 16 个十六进制字符（04ffff001d010445）是脚本前缀；
     其后每两个字符是一个 ASCII 字节，对应头条的一个字母。 */
  var stele = document.getElementById("gen-stele");
  if (stele) {
    var hexEl = stele.querySelector(".gen-hex");
    var enEl = stele.querySelector(".gen-en");
    var raw = hexEl.getAttribute("data-hex") || "";
    var PRE = 16;
    var frag = document.createDocumentFragment();
    var gi, gsp;
    for (gi = 0; gi < PRE; gi += 2) {
      gsp = document.createElement("span");
      gsp.className = "gen-pre";
      gsp.textContent = raw.slice(gi, gi + 2);
      frag.appendChild(gsp);
    }
    var gidx = 0, gchars = [];
    for (gi = PRE; gi < raw.length; gi += 2, gidx++) {
      var pair = raw.slice(gi, gi + 2);
      gsp = document.createElement("span");
      gsp.className = "gen-byte";
      gsp.setAttribute("data-i", gidx);
      gsp.style.transitionDelay = (gidx * 16) + "ms";
      gsp.textContent = pair;
      frag.appendChild(gsp);
      gchars.push(String.fromCharCode(parseInt(pair, 16)));
    }
    hexEl.textContent = "";
    hexEl.appendChild(frag);

    var ef = document.createDocumentFragment();
    gchars.forEach(function (ch, k) {
      var c = document.createElement("span");
      c.setAttribute("data-i", k);
      c.style.transitionDelay = (500 + k * 14) + "ms";
      c.textContent = ch;
      ef.appendChild(c);
    });
    enEl.textContent = "";
    enEl.appendChild(ef);

    var litAll = function (k, on) {
      stele.querySelectorAll('[data-i="' + k + '"]').forEach(function (n) {
        n.classList.toggle("lit", on);
      });
    };
    stele.addEventListener("mouseover", function (ev) {
      var t = ev.target;
      if (t.getAttribute && t.getAttribute("data-i") != null) litAll(t.getAttribute("data-i"), true);
    });
    stele.addEventListener("mouseout", function (ev) {
      var t = ev.target;
      if (t.getAttribute && t.getAttribute("data-i") != null) litAll(t.getAttribute("data-i"), false);
    });

    var fire = function () { stele.classList.add("on"); };
    var rmGen = false;
    try { rmGen = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* 忽略 */ }
    if (rmGen || !("IntersectionObserver" in window)) {
      fire();
    } else {
      var gio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { fire(); gio.disconnect(); }
        });
      }, { threshold: 0.35 });
      gio.observe(stele);
    }
  }
})();
