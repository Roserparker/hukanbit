/* ============================================================
   胡侃比特 · 流场尘埃（最底层背景动画）
   上善若水，大象无形——
   一层暗金尘埃在柏林噪声的流场里缓缓漂浮，
   靠近者以微光相连（去中心化节点的生长），
   指尖掠过时如水面被轻轻拨开，离开后徐徐聚拢。
   纯 Vanilla JS + Canvas，无依赖；约 36–110 粒，随窗口自适应。
   ============================================================ */
(function () {
  "use strict";

  /* —— 冥想优先：用户要求减少动效时，整层不存在 —— */
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch (e) { /* 忽略 */ }

  var TAU = Math.PI * 2;

  /* ---------- 画布：垫在一切之下 ---------- */
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

  /* ---------- 釉色：明暗两窑 ---------- */
  var palette = { dust: "184,134,11", link: "184,134,11", dustA: 0.5, linkA: 0.12 };
  function tunePalette(dark) {
    if (dark) {
      palette = { dust: "196,148,58", link: "184,134,11", dustA: 0.55, linkA: 0.15 };
    } else {
      palette = { dust: "139,98,32", link: "146,104,36", dustA: 0.4, linkA: 0.1 };
    }
  }
  try {
    var darkMq = window.matchMedia("(prefers-color-scheme: dark)");
    tunePalette(darkMq.matches);
    if (typeof darkMq.addEventListener === "function") {
      darkMq.addEventListener("change", function (e) { tunePalette(e.matches); });
    }
  } catch (e) { tunePalette(false); }

  /* ---------- 柏林噪声（经典梯度噪声，2D） ---------- */
  var perm = new Uint8Array(512);
  (function seed() {
    var p = new Uint8Array(256), i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      j = (Math.random() * (i + 1)) | 0;
      t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function grad(h, x, y) {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  }
  function noise2(x, y) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    var u = fade(x), v = fade(y);
    var a = perm[X] + Y, b = perm[X + 1] + Y;
    return (
      (1 - v) * ((1 - u) * grad(perm[a], x, y) + u * grad(perm[b], x - 1, y)) +
      v * ((1 - u) * grad(perm[a + 1], x, y - 1) + u * grad(perm[b + 1], x - 1, y - 1))
    ); /* ∈ 约 [-1, 1] */
  }

  /* ---------- 尺度与粒子 ---------- */
  var W = 0, H = 0, DPR = 1;
  var essence = [];          /* 尘埃本体 */
  var LINK_DIST = 96;        /* 结缘的距离 */

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    brush.setTransform(DPR, 0, 0, DPR, 0, 0);
    var count = Math.max(36, Math.min(110, Math.round((W * H) / 22000)));
    while (essence.length < count) essence.push(birth());
    essence.length = count;
  }

  function birth() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0,
      vy: 0,
      size: 0.6 + Math.random() * 1.1,     /* 极微小的尘 */
      depth: 0.35 + Math.random() * 0.65,  /* 远近：影响亮度 */
      drift: Math.random() * 1000          /* 各自的流场相位 */
    };
  }

  window.addEventListener("resize", resize);
  resize();

  /* ---------- 指尖的涟漪：温柔的排斥力场 ---------- */
  var ripple = { x: -9999, y: -9999, r: 130 };
  window.addEventListener("pointermove", function (e) {
    ripple.x = e.clientX; ripple.y = e.clientY;
  }, { passive: true });
  window.addEventListener("pointerleave", function () {
    ripple.x = -9999; ripple.y = -9999;
  });
  document.addEventListener("mouseleave", function () {
    ripple.x = -9999; ripple.y = -9999;
  });

  /* ---------- 呼吸的时间 ---------- */
  var chi = Math.random() * 100;   /* 缓缓流逝的"气" */
  var FLOW_SCALE = 0.0011;         /* 流场的疏密 */
  var FLOW_PUSH = 0.013;           /* 水流之力（极轻） */
  var CALM = 0.94;                 /* 阻尼：一切归于平静 */
  var MAX_V = 0.45;                /* 慢，再慢一点 */

  function step(p) {
    /* 水流：柏林噪声给出此处的流向 */
    var a = noise2(p.x * FLOW_SCALE + p.drift, p.y * FLOW_SCALE - chi) * TAU * 1.8;
    p.vx += Math.cos(a) * FLOW_PUSH;
    p.vy += Math.sin(a) * FLOW_PUSH;

    /* 涟漪：指尖靠近，如拨水面 */
    var dx = p.x - ripple.x, dy = p.y - ripple.y;
    var d2 = dx * dx + dy * dy, r = ripple.r;
    if (d2 < r * r && d2 > 0.01) {
      var d = Math.sqrt(d2);
      var f = (1 - d / r);
      f = f * f * 0.55;            /* 力随距离平方衰减，温柔 */
      p.vx += (dx / d) * f;
      p.vy += (dy / d) * f;
    }

    /* 归静 */
    p.vx *= CALM; p.vy *= CALM;
    var v2 = p.vx * p.vx + p.vy * p.vy;
    if (v2 > MAX_V * MAX_V) {
      var k = MAX_V / Math.sqrt(v2);
      p.vx *= k; p.vy *= k;
    }
    p.x += p.vx; p.y += p.vy;

    /* 无界：从一边离开，自另一边归来（绝不反弹） */
    var m = 24;
    if (p.x < -m) p.x = W + m; else if (p.x > W + m) p.x = -m;
    if (p.y < -m) p.y = H + m; else if (p.y > H + m) p.y = -m;
  }

  function render() {
    brush.clearRect(0, 0, W, H);

    /* 结缘：靠近的节点之间，一缕几不可见的金线 */
    var i, j, a, b, dx, dy, d2, max2 = LINK_DIST * LINK_DIST;
    for (i = 0; i < essence.length; i++) {
      a = essence[i];
      for (j = i + 1; j < essence.length; j++) {
        b = essence[j];
        dx = a.x - b.x; dy = a.y - b.y;
        d2 = dx * dx + dy * dy;
        if (d2 < max2) {
          var t = 1 - Math.sqrt(d2) / LINK_DIST;
          brush.strokeStyle = "rgba(" + palette.link + "," + (t * palette.linkA * Math.min(a.depth, b.depth)).toFixed(3) + ")";
          brush.lineWidth = 0.6;
          brush.beginPath();
          brush.moveTo(a.x, a.y);
          brush.lineTo(b.x, b.y);
          brush.stroke();
        }
      }
    }

    /* 尘埃 */
    for (i = 0; i < essence.length; i++) {
      a = essence[i];
      brush.fillStyle = "rgba(" + palette.dust + "," + (palette.dustA * a.depth).toFixed(3) + ")";
      brush.beginPath();
      brush.arc(a.x, a.y, a.size * a.depth, 0, TAU);
      brush.fill();
    }
  }

  var rafId = 0;
  function breathe() {
    chi += 0.0016;
    for (var i = 0; i < essence.length; i++) step(essence[i]);
    render();
    rafId = requestAnimationFrame(breathe);
  }

  /* 页面不在眼前时，万物休眠 */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!rafId) {
      rafId = requestAnimationFrame(breathe);
    }
  });

  rafId = requestAnimationFrame(breathe);
})();
