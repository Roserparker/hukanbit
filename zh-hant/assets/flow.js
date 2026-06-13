/* ============================================================
   胡侃比特 · 鏈海與提燈（最底層背景，v2）

   遠景鏈海：極小的區塊在深處緩緩沉浮、按各自相位呼吸；
   相鄰區塊間不時結起一節豆青鎖鏈——畫入、停駐、化開。
   密碼學塵埃：稀疏的十六進制字符在暗處隱現。
   提燈巡館：光標是一盞暖光提燈，燈光所及，區塊甦醒、結鏈更勤。
   沒有線條追逐鼠標；reduced-motion 時整層不存在。
   ============================================================ */
(function () {
  "use strict";

  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch (e) { /* 忽略 */ }

  var TAU = Math.PI * 2;

  /* ---------- 畫布 ---------- */
  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  var cs = canvas.style;
  cs.position = "fixed";
  cs.inset = "0";
  cs.width = "100%";
  cs.height = "100%";
  cs.zIndex = "-1";
  cs.pointerEvents = "none";
  document.body.prepend(canvas);
  var brush = canvas.getContext("2d");

  /* ---------- 釉色（明暗兩窯） ---------- */
  var pal = { block: "139,98,32", link: "135,167,150", mote: "120,104,78", lant: "214,166,76", bA: 0.34, lA: 0.4, mA: 0.3, lantA: 0.05 };
  function tune(dark) {
    pal = dark
      ? { block: "196,148,58", link: "127,160,144", mote: "150,128,94", lant: "236,189,98", bA: 0.4, lA: 0.45, mA: 0.34, lantA: 0.06 }
      : { block: "128,92,34", link: "120,150,134", mote: "128,112,84", lant: "196,140,52", bA: 0.32, lA: 0.4, mA: 0.26, lantA: 0.045 };
  }
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    tune(mq.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", function (e) { tune(e.matches); });
    }
  } catch (e) { tune(false); }

  /* ---------- 輕噪聲（緩慢漂移用） ---------- */
  var perm = new Uint8Array(512);
  (function seed() {
    var p = new Uint8Array(256), i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = (Math.random() * (i + 1)) | 0; t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function grad(h, x, y) { switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } }
  function noise2(x, y) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    var u = fade(x), v = fade(y);
    var a = perm[X] + Y, b = perm[X + 1] + Y;
    return (1 - v) * ((1 - u) * grad(perm[a], x, y) + u * grad(perm[b], x - 1, y)) +
           v * ((1 - u) * grad(perm[a + 1], x, y - 1) + u * grad(perm[b + 1], x - 1, y - 1));
  }

  /* ---------- 世界 ---------- */
  var W = 0, H = 0, DPR = 1;
  var blocks = [];   /* 遠景小區塊 */
  var links = [];    /* 進行中的鎖鏈 {a,b,t0,life} */
  var motes = [];    /* 十六進制塵埃 {x,y,ch,t0,life} */
  var HEXCH = "0123456789abcdef";

  function newBlock() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      s: 3.5 + Math.random() * 3.5,          /* 半邊長 */
      ph: Math.random() * TAU,               /* 呼吸相位 */
      dr: Math.random() * 900,               /* 漂移相位 */
      wake: 0                                /* 提燈喚醒度 0..1 */
    };
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    brush.setTransform(DPR, 0, 0, DPR, 0, 0);
    var n = W < 640 ? 12 : Math.max(16, Math.min(26, Math.round((W * H) / 60000)));
    while (blocks.length < n) blocks.push(newBlock());
    blocks.length = n;
  }
  window.addEventListener("resize", resize);
  resize();

  /* ---------- 提燈（緩動跟隨，無軌跡） ---------- */
  var lant = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  window.addEventListener("pointermove", function (e) {
    lant.tx = e.clientX; lant.ty = e.clientY;
    if (lant.x < -999) { lant.x = lant.tx; lant.y = lant.ty; }
  }, { passive: true });
  function lantAway() { lant.x = lant.tx = -9999; lant.y = lant.ty = -9999; }
  window.addEventListener("pointerleave", lantAway);
  document.addEventListener("mouseleave", lantAway);
  var LANT_R = 150;

  /* ---------- 結鏈 ---------- */
  var LINK_DIST = 130;
  function tryLink(boost) {
    if (links.length >= (boost ? 7 : 4)) return;
    var a = blocks[(Math.random() * blocks.length) | 0];
    var best = null, bd = LINK_DIST * LINK_DIST;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b === a) continue;
      var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < bd && d2 > 400) { bd = d2; best = b; }
    }
    if (!best) return;
    /* 已有同對則不重複 */
    for (var k = 0; k < links.length; k++) {
      if ((links[k].a === a && links[k].b === best) || (links[k].a === best && links[k].b === a)) return;
    }
    links.push({ a: a, b: best, t0: performance.now(), life: 3600 + Math.random() * 1800 });
  }

  /* ---------- 塵埃 ---------- */
  function tryMote() {
    if (motes.length >= 7) return;
    motes.push({
      x: 20 + Math.random() * (W - 40),
      y: 20 + Math.random() * (H - 40),
      ch: HEXCH[(Math.random() * 16) | 0],
      t0: performance.now(),
      life: 3800 + Math.random() * 2400
    });
  }

  /* ---------- 流星（暗金比特流星 · 稀客） ----------
     不顯眼，不喧譁，偶爾一顆斜劃而過；頭是一枚小小的暗金幣。 */
  var meteors = [];
  function spawnMeteor() {
    var fromLeft = Math.random() < 0.5;
    var base = 0.72 + Math.random() * 0.2;            /* 與水平約 41°–53° */
    var ang = fromLeft ? base : (Math.PI - base);
    meteors.push({
      x: fromLeft ? Math.random() * W * 0.4 : W * 0.6 + Math.random() * W * 0.4,
      y: -30 - Math.random() * 60,
      vx: Math.cos(ang),
      vy: Math.sin(ang),
      t0: performance.now(),
      life: 1500 + Math.random() * 700,
      len: 64 + Math.random() * 46,
      speed: 0.24 + Math.random() * 0.12,
      coin: Math.random() < 0.55
    });
  }

  var lastLink = 0, lastMote = 0, lastMeteor = 0, meteorGap = 9000 + Math.random() * 6000;
  var chi = Math.random() * 100;

  /* ---------- 繪製 ---------- */
  function roundRect(x, y, s, r) {
    brush.beginPath();
    brush.moveTo(x - s + r, y - s);
    brush.arcTo(x + s, y - s, x + s, y + s, r);
    brush.arcTo(x + s, y + s, x - s, y + s, r);
    brush.arcTo(x - s, y + s, x - s, y - s, r);
    brush.arcTo(x - s, y - s, x + s, y - s, r);
    brush.closePath();
  }

  var rafId = 0;
  function breathe(now) {
    chi += 0.0011;

    /* 提燈緩行 */
    if (lant.tx > -999) {
      lant.x += (lant.tx - lant.x) * 0.1;
      lant.y += (lant.ty - lant.y) * 0.1;
    }
    var lit = lant.tx > -999;

    /* 節奏：平時偶爾結鏈；燈下勤一些 */
    if (now - lastLink > (lit ? 700 : 1500)) { lastLink = now; tryLink(lit); }
    if (now - lastMote > 2100) { lastMote = now; tryMote(); }
    if (now - lastMeteor > meteorGap) { lastMeteor = now; meteorGap = 7000 + Math.random() * 12000; if (meteors.length < 2) spawnMeteor(); }

    brush.clearRect(0, 0, W, H);

    /* 燈暈 */
    if (lit) {
      var g = brush.createRadialGradient(lant.x, lant.y, 0, lant.x, lant.y, LANT_R);
      g.addColorStop(0, "rgba(" + pal.lant + "," + pal.lantA + ")");
      g.addColorStop(1, "rgba(" + pal.lant + ",0)");
      brush.fillStyle = g;
      brush.beginPath();
      brush.arc(lant.x, lant.y, LANT_R, 0, TAU);
      brush.fill();
    }

    /* 鎖鏈：畫入 → 停駐 → 化開 */
    for (var li = links.length - 1; li >= 0; li--) {
      var L = links[li];
      var t = (now - L.t0) / L.life;
      if (t >= 1) { links.splice(li, 1); continue; }
      var alpha = t < 0.25 ? t / 0.25 : (t > 0.7 ? (1 - t) / 0.3 : 1);
      var ax = L.a.x, ay = L.a.y, bx = L.b.x, by = L.b.y;
      var prog = Math.min(1, t / 0.25); /* 畫入進度 */
      var mx = ax + (bx - ax) * prog, my = ay + (by - ay) * prog;
      brush.strokeStyle = "rgba(" + pal.link + "," + (alpha * pal.lA).toFixed(3) + ")";
      brush.lineWidth = 1;
      brush.beginPath();
      brush.moveTo(ax, ay);
      brush.lineTo(mx, my);
      brush.stroke();
      /* 鏈節小點 */
      brush.fillStyle = "rgba(" + pal.link + "," + (alpha * pal.lA * 0.9).toFixed(3) + ")";
      brush.beginPath();
      brush.arc((ax + mx) / 2, (ay + my) / 2, 1.2, 0, TAU);
      brush.fill();
    }

    /* 區塊 */
    for (var i = 0; i < blocks.length; i++) {
      var p = blocks[i];
      /* 極緩漂移（輕噪聲場） */
      var a = noise2(p.x * 0.0008 + p.dr, p.y * 0.0008 - chi) * TAU;
      p.x += Math.cos(a) * 0.06;
      p.y += Math.sin(a) * 0.06 - 0.02; /* 微微上浮，像深海雪倒放 */
      var m = 16;
      if (p.x < -m) p.x = W + m; else if (p.x > W + m) p.x = -m;
      if (p.y < -m) p.y = H + m; else if (p.y > H + m) p.y = -m;

      /* 提燈喚醒 */
      var tw = 0;
      if (lit) {
        var dx = p.x - lant.x, dy = p.y - lant.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LANT_R * LANT_R) tw = 1 - Math.sqrt(d2) / LANT_R;
      }
      p.wake += (tw - p.wake) * 0.08;

      var breatheA = 0.62 + 0.38 * Math.sin(now * 0.00045 + p.ph);
      var alpha2 = pal.bA * breatheA * (1 + p.wake * 1.1);
      brush.strokeStyle = "rgba(" + pal.block + "," + Math.min(0.85, alpha2).toFixed(3) + ")";
      brush.lineWidth = 1;
      roundRect(p.x, p.y, p.s, 2);
      brush.stroke();
      /* 燈下顯出塊裏的"交易"小點 */
      if (p.wake > 0.25) {
        brush.fillStyle = "rgba(" + pal.block + "," + (alpha2 * 0.85).toFixed(3) + ")";
        brush.beginPath();
        brush.arc(p.x, p.y, 1.1, 0, TAU);
        brush.fill();
      }
    }

    /* 十六進制塵埃 */
    brush.font = "9px ui-monospace, Menlo, monospace";
    for (var mi = motes.length - 1; mi >= 0; mi--) {
      var M = motes[mi];
      var mt = (now - M.t0) / M.life;
      if (mt >= 1) { motes.splice(mi, 1); continue; }
      var ma = Math.sin(mt * Math.PI);
      brush.fillStyle = "rgba(" + pal.mote + "," + (ma * pal.mA).toFixed(3) + ")";
      brush.fillText(M.ch, M.x, M.y);
    }

    /* 流星：偶爾一顆暗金比特流星斜劃而過——稀客，慢慢發現 */
    for (var qi = meteors.length - 1; qi >= 0; qi--) {
      var Q = meteors[qi];
      var qt = (now - Q.t0) / Q.life;
      if (qt >= 1) { meteors.splice(qi, 1); continue; }
      var trav = Q.speed * (now - Q.t0);
      var hx = Q.x + Q.vx * trav, hy = Q.y + Q.vy * trav;
      var ex = hx - Q.vx * Q.len, ey = hy - Q.vy * Q.len;
      var env = Math.sin(Math.min(1, qt) * Math.PI);   /* 0→1→0 進出場 */
      var gm = brush.createLinearGradient(ex, ey, hx, hy);
      gm.addColorStop(0, "rgba(" + pal.lant + ",0)");
      gm.addColorStop(1, "rgba(" + pal.lant + "," + (env * 0.5).toFixed(3) + ")");
      brush.strokeStyle = gm;
      brush.lineWidth = 1.4;
      brush.lineCap = "round";
      brush.beginPath();
      brush.moveTo(ex, ey);
      brush.lineTo(hx, hy);
      brush.stroke();
      brush.fillStyle = "rgba(" + pal.lant + "," + (env * 0.85).toFixed(3) + ")";
      brush.beginPath();
      brush.arc(hx, hy, Q.coin ? 2.4 : 1.7, 0, TAU);
      brush.fill();
      if (Q.coin) {                                    /* 鑄幣環：暗示這是一枚比特，不是尋常隕星 */
        brush.strokeStyle = "rgba(" + pal.lant + "," + (env * 0.4).toFixed(3) + ")";
        brush.lineWidth = 0.8;
        brush.beginPath();
        brush.arc(hx, hy, 4.4, 0, TAU);
        brush.stroke();
      }
    }
    brush.lineCap = "butt";

    rafId = requestAnimationFrame(breathe);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
    else if (!rafId) { rafId = requestAnimationFrame(breathe); }
  });

  rafId = requestAnimationFrame(breathe);
})();
