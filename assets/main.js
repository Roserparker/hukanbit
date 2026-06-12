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

  /* ---------- 创世转储：285 字节的显影 ----------
     区块 #0 以原始三栏转储陈列（偏移 | 字节 | ASCII，与 2009 年的
     十六进制查看器同款）。初看全是机器呓语；随滚动，报头的 69 个
     字节逐字升温走到光里，随后报纸复刻显影。 */
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
        if (gi === LEN_BYTE) { bs.title = "0x45 = 69：头条的字节长度"; as.title = bs.title; }
        bcol.appendChild(bs);
        acol.appendChild(as);
      }
      row.appendChild(bcol);
      row.appendChild(acol);
      dump.appendChild(row);
    }

    /* 悬停：字节 ↔ 字母 双向点亮 */
    function hot(t, on) {
      var k = t.getAttribute && t.getAttribute("data-m");
      if (k == null) return;
      if (mB[k]) mB[k].classList.toggle("hot", on);
      if (mA[k]) mA[k].classList.toggle("hot", on);
    }
    dump.addEventListener("mouseover", function (ev) { hot(ev.target, true); });
    dump.addEventListener("mouseout", function (ev) { hot(ev.target, false); });

    /* 滚动显影 */
    var lastLit = -1, clipShown = false, ticking = false;
    function applyLit(n) {
      if (n === lastLit) return;
      for (var k = 0; k < MSG_LEN; k++) {
        var on = k < n;
        mB[k].classList.toggle("lit", on);
        mA[k].classList.toggle("lit", on);
      }
      stele.classList.toggle("focused", n > 8);
      lastLit = n;
    }
    function measure() {
      var r = stele.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var span = Math.max(120, Math.min(r.height * 0.72, vh * 1.05));
      var p = (vh * 0.88 - r.top) / span;
      p = Math.max(0, Math.min(1, p));
      applyLit(Math.round(p * MSG_LEN));
      if (p >= 1 && !clipShown) { clipShown = true; clip.classList.add("show"); }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; measure(); });
    }
    var rmG = false;
    try { rmG = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* 忽略 */ }
    if (rmG) {
      applyLit(MSG_LEN);
      clip.classList.add("show");
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      measure();
    }
  }
})();
