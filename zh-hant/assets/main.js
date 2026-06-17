/* 胡侃比特 · 共享腳本：閱讀進度條 + 滾動進場動畫 */
(function () {
  "use strict";

  // 閱讀進度條（僅文章頁存在 #progress）
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

  // 滾動進場
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

  // 頁腳年份
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- 字體與字號切換（宋/楷/仿/黑 × 小/標準/大/特大）---------- */
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
        ev.stopPropagation(); /* 菜單不收，方便連續比較字號 */
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

  /* ---------- 點擊漣漪 ----------
     每次按下，在指尖處盪開一圈細線（聲吶式反饋）。
     尊重 prefers-reduced-motion；高頻連點（如挖礦遊戲）時限流。 */
  var pingReduced = false;
  try {
    var pingMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    pingReduced = pingMq.matches;
    if (typeof pingMq.addEventListener === "function") {
      pingMq.addEventListener("change", function (e) { pingReduced = e.matches; });
    }
  } catch (e) { /* 舊環境忽略 */ }

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
    setTimeout(done, 750); // 動畫事件丟失時的兜底
    document.body.appendChild(p);
  }

  var downEvt = window.PointerEvent ? "pointerdown" : "mousedown";
  document.addEventListener(downEvt, function (ev) {
    if (ev.button) return; // 右鍵/中鍵不響
    spawnPing(ev.clientX, ev.clientY);
  }, { passive: true });

  /* ---------- 學習足跡 ----------
     只存在你自己的瀏覽器 localStorage 裏，不上傳任何數據。
     設計參考 Coinbase Earn 的"學習即進度"：讓讀者看見自己走了多遠。 */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隱私模式忽略 */ } }
  };

  // 文章頁：記下"讀過"
  var m = location.pathname.match(/articles\/(0[1-5])\.html$/);
  if (m) store.set("hkb-read-" + m[1], "1");
  // 實驗室頁：記下"來過"
  if (/lab\.html$/.test(location.pathname)) store.set("hkb-lab", "1");
  // 長廊：記下"參觀過"（爲將來的集章尋寶留鉤子）
  if (/gallery\.html$/.test(location.pathname)) store.set("hkb-gallery", "1");
  // 佈道廳
  if (/satoshi\.html$/.test(location.pathname)) store.set("hkb-satoshi", "1");
  // 學堂
  if (/study\.html$/.test(location.pathname)) store.set("hkb-study", "1");
  // 金庫
  if (/treasury\.html$/.test(location.pathname)) store.set("hkb-treasury", "1");

  // 首頁：點亮已讀標籤、閱讀進度與"三步上手"的完成態
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
        done.textContent = "✓ 已讀";
        tags.appendChild(done);
      }
    });
    var prog = document.getElementById("read-progress");
    if (prog && readCount > 0) {
      prog.hidden = false;
      prog.textContent = readCount >= 5
        ? "✓ 五篇全部讀完——你已經比 99% 的人更懂錢了"
        : "已讀 " + readCount + " / 5 · 接着讀，每篇末尾都有配套實驗";
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

  /* ---------- 創世轉儲：完整 285 字節，從噪聲裏浮出一句話 ----------
     區塊 #0 完整三欄陳列（偏移 | 字節 | ASCII）。機器的囈語先靜成底紋，
     隨滾動，報頭那 69 個字節逐字升溫、走到光裏，拼出一句人話；隨後報紙復刻顯影。 */
  var stele = document.getElementById("gen-stele");
  if (stele) {
    var dump = document.getElementById("gen-dump");
    var clip = document.getElementById("gen-clip");
    /* 創世區塊原始字節（285B）：區塊頭 + 1 筆 coinbase 交易 */
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
        if (gi === LEN_BYTE) { bs.title = "0x45 = 69：這句話的字節長度"; as.title = bs.title; }
        bcol.appendChild(bs);
        acol.appendChild(as);
      }
      row.appendChild(bcol);
      row.appendChild(acol);
      dump.appendChild(row);
    }

    /* 懸停：把任意一個發亮字節和它對應的字母一起挑亮 */
    function hot(t, on) {
      var k = t.getAttribute && t.getAttribute("data-m");
      if (k == null) return;
      if (mB[k]) mB[k].classList.toggle("hot", on);
      if (mA[k]) mA[k].classList.toggle("hot", on);
    }
    dump.addEventListener("mouseover", function (ev) { hot(ev.target, true); });
    dump.addEventListener("mouseout", function (ev) { hot(ev.target, false); });

    /* 一次性顯影：進入視野即觸發，與滾動徹底解耦——那 69 個字節逐字升溫走到光裏 */
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

/* ---------- 語言偏好記憶（簡/繁/EN 切換時記下選擇） ---------- */
(function () {
  "use strict";
  var links = document.querySelectorAll(".lang-switch a[data-lang]");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function () {
      try { localStorage.setItem("hkb-lang", this.getAttribute("data-lang")); } catch (e) { /* 忽略 */ }
    });
  }
})();

/* ---------- 懸浮重播徽標「畫入」 ----------
   cursor 每次進入文章卡 / 實驗室招牌，金線重新生長一遍——勾住注意力。
   做法：把徽標及其線條的 animation 先置 none、強制迴流、再清空，
   於是 CSS 裏 .visible 的 ill-draw / ill-ignite 會從頭重跑（none→name 即重啓）。
   ——比切類名更可靠：同名動畫靠切類名是不會重啓的（這正是上一版只「亮」不「畫」的原因）。
   尊重 prefers-reduced-motion；觸屏無 hover，初次滾動進場動畫照常。 */
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
    void ill.offsetWidth;          /* 強制迴流，讓 .visible 的動畫從頭重跑 */
    for (j = 0; j < els.length; j++) els[j].style.animation = "";
  }
  var hosts = document.querySelectorAll(".art-card a, .lab-teaser");
  for (var i = 0; i < hosts.length; i++) {
    hosts[i].addEventListener("mouseenter", (function (h) {
      return function () { replay(h); };
    })(hosts[i]));
  }
})();
