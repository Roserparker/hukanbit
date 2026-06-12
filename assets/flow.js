/* ============================================================
   胡侃比特 · 流场尘埃（最底层背景动画）

   四条哲学，四套算法：
   · 大象无形 —— z-index:-1，透明度 0.05–0.15，抽象点线，绝不扰文
   · 上善若水 —— 手写 2D 柏林噪声流场，慢速漂移，无界环回，绝不反弹
   · 道生万物 —— Boids 三力（聚拢/同游/疏离）+ 距离结缘金线：
                节点自发成簇、同游、离散——去中心化网络的涌现
   · 道法自然 —— 指尖力场 = 径向轻斥 + 切向绕行（水遇石而绕行），
                力场位置带缓动，如水波有惯性

   纯 Vanilla JS + Canvas，无依赖；粒子 36–110 随窗口自适应。
   ============================================================ */
(function () {
  "use strict";

  /* —— 冥想优先：用户要求减少动效时，整层不存在 —— */
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch (e) { /* 忽略 */ }

  var TAU = Math.PI * 2;

  /* ---------- 画布：垫在一切之下（大象无形） ---------- */
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

  /* ---------- 心法参数（一处调，全局变） ---------- */
  var FLOW_SCALE = 0.0011;  /* 流场疏密 */
  var FLOW_PUSH  = 0.013;   /* 水流之力（极轻） */
  var CALM       = 0.94;    /* 阻尼：一切归于平静 */
  var MAX_V      = 0.45;    /* 慢，再慢一点 */
  var LINK_DIST  = 96;      /* 结缘的距离 */
  var COHERE     = 0.00012; /* 道生万物 · 聚拢：向邻居微微靠近 */
  var ALIGN      = 0.010;   /* 道生万物 · 同游：与邻居速度趋同 */
  var SEP_DIST   = 22;      /* 道生万物 · 疏离：太近则相敬 */
  var SEP_F      = 0.05;
  var RIP_R      = 130;     /* 指尖力场半径 */
  var RIP_PUSH   = 0.45;    /* 道法自然 · 径向轻斥 */
  var RIP_SWIRL  = 0.30;    /* 道法自然 · 切向绕行 */
  var RIP_EASE   = 0.12;    /* 力场追随指尖的缓动 */

  /* ---------- 尺度与粒子 ---------- */
  var W = 0, H = 0, DPR = 1;
  var essence = [];

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

  window.addEventListener("resize", resize);
  resize();

  /* ---------- 指尖的涟漪（带缓动的力场） ---------- */
  var ripple = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  window.addEventListener("pointermove", function (e) {
    ripple.tx = e.clientX; ripple.ty = e.clientY;
    if (ripple.x < -999) { ripple.x = ripple.tx; ripple.y = ripple.ty; }
  }, { passive: true });
  function rippleAway() {
    ripple.x = ripple.tx = -9999;
    ripple.y = ripple.ty = -9999;
  }
  window.addEventListener("pointerleave", rippleAway);
  document.addEventListener("mouseleave", rippleAway);

  /* ---------- 力之一：水流与涟漪 ---------- */
  var chi = Math.random() * 100; /* 缓缓流逝的"气" */

  function applyField(p) {
    /* 上善若水：柏林噪声给出此处的流向 */
    var a = noise2(p.x * FLOW_SCALE + p.drift, p.y * FLOW_SCALE - chi) * TAU * 1.8;
    p.vx += Math.cos(a) * FLOW_PUSH;
    p.vy += Math.sin(a) * FLOW_PUSH;

    /* 道法自然：径向轻斥 + 切向绕行 */
    var dx = p.x - ripple.x, dy = p.y - ripple.y;
    var d2 = dx * dx + dy * dy;
    if (d2 < RIP_R * RIP_R && d2 > 0.01) {
      var d = Math.sqrt(d2);
      var t = 1 - d / RIP_R;
      var fr = t * t * RIP_PUSH;   /* 排斥：拨开水面 */
      var ft = t * t * RIP_SWIRL;  /* 绕行：水遇石而行其侧 */
      var nx = dx / d, ny = dy / d;
      p.vx += nx * fr - ny * ft;
      p.vy += ny * fr + nx * ft;
    }
  }

  /* ---------- 力之二 + 结缘：一次配对，既画线又共生 ---------- */
  function weave() {
    var max2 = LINK_DIST * LINK_DIST;
    var sep2 = SEP_DIST * SEP_DIST;
    var i, j, a, b, dx, dy, d2, d, t;
    for (i = 0; i < essence.length; i++) {
      a = essence[i];
      for (j = i + 1; j < essence.length; j++) {
        b = essence[j];
        dx = b.x - a.x; dy = b.y - a.y;
        d2 = dx * dx + dy * dy;
        if (d2 >= max2) continue;
        d = Math.sqrt(d2) || 0.001;
        t = 1 - d / LINK_DIST;

        /* 结缘金线（道生万物的可见形） */
        brush.strokeStyle = "rgba(" + palette.link + "," +
          (t * palette.linkA * Math.min(a.depth, b.depth)).toFixed(3) + ")";
        brush.lineWidth = 0.6;
        brush.beginPath();
        brush.moveTo(a.x, a.y);
        brush.lineTo(b.x, b.y);
        brush.stroke();

        /* 聚拢：相连者微微靠近 */
        a.vx += dx * COHERE; a.vy += dy * COHERE;
        b.vx -= dx * COHERE; b.vy -= dy * COHERE;

        /* 同游：相连者速度趋同 */
        var avx = (b.vx - a.vx) * ALIGN, avy = (b.vy - a.vy) * ALIGN;
        a.vx += avx; a.vy += avy;
        b.vx -= avx; b.vy -= avy;

        /* 疏离：太近则相敬如宾，不挤作一团 */
        if (d2 < sep2) {
          var s = (1 - d / SEP_DIST) * SEP_F;
          var sx = (dx / d) * s, sy = (dy / d) * s;
          a.vx -= sx; a.vy -= sy;
          b.vx += sx; b.vy += sy;
        }
      }
    }
  }

  /* ---------- 归静与前行 ---------- */
  function settle(p) {
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

  /* ---------- 呼吸 ---------- */
  var rafId = 0;
  function breathe() {
    chi += 0.0016;

    /* 力场缓动追随指尖（水波有惯性） */
    if (ripple.tx > -999) {
      ripple.x += (ripple.tx - ripple.x) * RIP_EASE;
      ripple.y += (ripple.ty - ripple.y) * RIP_EASE;
    }

    var i;
    for (i = 0; i < essence.length; i++) applyField(essence[i]);

    brush.clearRect(0, 0, W, H);
    weave();

    for (i = 0; i < essence.length; i++) {
      var p = essence[i];
      settle(p);
      brush.fillStyle = "rgba(" + palette.dust + "," + (palette.dustA * p.depth).toFixed(3) + ")";
      brush.beginPath();
      brush.arc(p.x, p.y, p.size * p.depth, 0, TAU);
      brush.fill();
    }

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
