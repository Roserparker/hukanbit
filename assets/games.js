/* ============================================================
   胡侃比特 · 互动小游戏（games.js）
   ------------------------------------------------------------
   结构：
     1. 公共工具：sha256Sync（纯 JS，file:// 可用，移植自 lab.js）、
        数字格式化、DOM 小助手、reduced-motion 检测
     2. createTimeMachine(root)  —— 游戏一 · 购买力时光机
     3. createPowMiner(root)     —— 游戏二 · 孤勇者矿工
     4. createMempool(root)      —— 游戏三 · 内存池停车场
     5. registry + boot：DOMContentLoaded 后扫描 [data-game]，
        清空挂载点并渲染对应游戏；重复初始化安全（先调用上一次
        实例返回的 destroy 清理 rAF / interval / 事件）。
   约定：
     - 纯 vanilla JS，单一 IIFE，无模块、无外部依赖；原则上无 fetch
       （唯一豁免：block-explorer 拉取 mempool.space 实时区块，失败静默降级为内置快照）
     - 组件内部一律使用闭包里的 DOM 引用，不用 id 查找自己
     - 同一游戏可在一页中挂载多次（工厂函数，互不干扰）
   ============================================================ */
(function () {
  "use strict";

  /* ================= 1. 公共工具 ================= */

  /* ---- SHA-256（FIPS 180-4 纯 JS 同步实现，与 lab.js 同源）---- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Sync(str) {
    var bytes = new TextEncoder().encode(str);
    var l = bytes.length;
    var bitLen = l * 8;
    var padded = new Uint8Array((((l + 8) >> 6) + 1) << 6);
    padded.set(bytes);
    padded[l] = 0x80;
    var dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen >>> 0);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Int32Array(64);

    for (var i = 0; i < padded.length; i += 64) {
      for (var j = 0; j < 16; j++) w[j] = dv.getInt32(i + j * 4);
      for (j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var hex = "";
    for (i = 0; i < 8; i++) hex += (H[i] >>> 0).toString(16).padStart(8, "0");
    return hex;
  }

  /* ---- 数字格式化（中文千分位习惯）---- */
  var TAU = Math.PI * 2;

  /* ---- 序幕引导：首次进入时用三句话讲清"你将要做什么" ----
     看过即记（localStorage），右上角 ❔ 可随时重看。 */
  function gmIntro(root, name, steps, build) {
    var KEY = "hkb-intro-" + name;
    var seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch (e) { /* 忽略 */ }

    function start() {
      try { localStorage.setItem(KEY, "1"); } catch (e) { /* 忽略 */ }
      root.innerHTML = "";
      build();
      var rp = btn("gm-replay", "❔ 引导");
      rp.addEventListener("click", function () { show(0); });
      root.appendChild(rp);
    }

    function show(i) {
      root.innerHTML = "";
      var p = el("div", "gm-primer");
      p.appendChild(el("p", "gm-primer-step", "引导 " + (i + 1) + " / " + steps.length));
      p.appendChild(el("p", "gm-primer-big", steps[i][0]));
      if (steps[i][1]) p.appendChild(el("p", "gm-primer-sm", steps[i][1]));
      var row = el("div", "gm-row");
      row.style.justifyContent = "center";
      if (i < steps.length - 1) {
        var sk = btn("gm-btn gm-ghost", "跳过引导");
        sk.addEventListener("click", start);
        row.appendChild(sk);
        var nx = btn("gm-btn", "下一步 →");
        nx.addEventListener("click", function () { show(i + 1); });
        row.appendChild(nx);
      } else {
        var go = btn("gm-btn", "开始 ▶");
        go.addEventListener("click", start);
        row.appendChild(go);
      }
      p.appendChild(row);
      root.appendChild(p);
    }

    if (seen) start(); else show(0);
  }

  function fmt(n, digits) {
    return n.toLocaleString("zh-CN", { maximumFractionDigits: digits == null ? 0 : digits });
  }

  /* ---- DOM 小助手：el(tag, className, text) ---- */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function btn(cls, text, label) {
    var b = el("button", cls, text);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    return b;
  }

  /* ---- ₿ 铸币徽记：凡出现聪/比特币金额处佩戴 ---- */
  function coin() {
    var c = el("span", "gm-coin");
    c.setAttribute("aria-hidden", "true");
    return c;
  }

  /* ---- reduced-motion：减少闪烁与大动画 ---- */
  var reducedMotion = false;
  try {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", function (ev) { reducedMotion = ev.matches; });
    }
  } catch (e) { /* 旧环境忽略 */ }

  /* ---- 稀疏年份表的线性插值 ---- */
  function lerpTable(table, x) {
    var i;
    if (x <= table[0][0]) return table[0][1];
    if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
    for (i = 1; i < table.length; i++) {
      if (x <= table[i][0]) {
        var x0 = table[i - 1][0], y0 = table[i - 1][1];
        var x1 = table[i][0], y1 = table[i][1];
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      }
    }
    return table[table.length - 1][1];
  }

  /* ================= 2. 游戏一 · 购买力时光机 ================= */

  /* 美国 CPI-U 年均近似值（依据美国 BLS，稀疏表 + 线性插值，数据为约值） */
  var CPI_TABLE = [
    [1971, 40.5], [1975, 53.8], [1980, 82.4], [1985, 107.6], [1990, 130.7],
    [1995, 152.4], [2000, 172.2], [2005, 195.3], [2008, 215.3], [2010, 218.1],
    [2015, 237.0], [2020, 258.8], [2022, 292.7], [2024, 313.7], [2026, 327.0]
  ];

  /* 美元 M2 供应量近似值（万亿美元，稀疏表） */
  var M2_TABLE = [
    [1971, 0.7], [1980, 1.6], [1990, 3.3], [2000, 4.9], [2008, 8.2],
    [2015, 12.3], [2020, 19.1], [2022, 21.7], [2025, 21.5], [2026, 21.8]
  ];

  /* 年代注脚：关键年份史实 */
  var MILESTONES = [
    [1971, "尼克松宣布美元与黄金脱钩，纸币从此失去锚定物——印多少，只看政策需要。"],
    [1980, "美国通胀率冲到 13.5%。把钱存银行的人，眼睁睁看着购买力加速融化。"],
    [1999, "欧元诞生。又一种凭信用发行的纸币加入这场游戏，规则没有变。"],
    [2008, "金融危机席卷全球，央行开闸救市。10 月 31 日，比特币白皮书悄然发布。"],
    [2009, "1 月 3 日，创世区块诞生。2100 万的上限，自此写进代码、交给数学。"],
    [2020, "应对疫情的“无限量化宽松”：美元 M2 一年膨胀约 25%，史无前例。"],
    [2024, "比特币完成第四次减半，区块奖励降至 3.125 BTC——一切如 2009 年的时间表。"]
  ];

  var BREAD_1971 = 0.25; // 1971 年白面包约 $0.25/条

  function breadPrice(year) {
    return BREAD_1971 * lerpTable(CPI_TABLE, year) / lerpTable(CPI_TABLE, 1971);
  }

  /* 按减半规则粗算某年年初已挖出的 BTC（近似：4 年一个奖励期，期内线性） */
  function btcIssuedAt(year) {
    var t = year - 2009;
    if (t <= 0) return 0;
    var era = Math.floor(t / 4);
    var frac = (t % 4) / 4;
    var total = 0;
    for (var k2 = 0; k2 < era && k2 < 33; k2++) total += 210000 * (50 / Math.pow(2, k2));
    if (era < 33) total += frac * 210000 * (50 / Math.pow(2, era));
    return Math.min(total, 21000000);
  }

  function buildTimeMachine(root) {
    var Y_MIN = 1971, Y_MAX = 2026;
    var BREAD_ICONS = 40; // 每个 🍞 代表 10 条

    /* ---- 搭骨架 ---- */
    root.appendChild(el("p", "gm-kicker", "互动 · 购买力时光机"));
    root.appendChild(el("h3", "gm-title", "同样的 100 美元，拖一下，看它还能买几条面包"));
    root.appendChild(el("p", "gm-desc", "拖动下面的年份滑块，从 1971 年走到今天。左边是美元的购买力，右边是另一套系统的供给规则。"));

    var panel = el("div", "gm-panel");
    root.appendChild(panel);

    var yearLine = el("div", "gm-row");
    var yearBig = el("div", "gm-tm-year", "1971 年");
    yearLine.appendChild(yearBig);
    panel.appendChild(yearLine);

    var slider = el("input", "gm-range");
    slider.type = "range";
    slider.min = String(Y_MIN);
    slider.max = String(Y_MAX);
    slider.step = "1";
    slider.value = String(Y_MIN);
    slider.setAttribute("aria-label", "选择年份，从 1971 到 2026");
    panel.appendChild(slider);

    var hint = el("p", "gm-note", "← 把滑块往右拖，时间会替你说明一切。");
    panel.appendChild(hint);

    var cols = el("div", "gm-tm-cols");
    panel.appendChild(cols);

    /* 左列：面包 */
    var left = el("div");
    cols.appendChild(left);
    var breadBig = el("div", "gm-big");
    left.appendChild(breadBig);
    var breadSub = el("p", "gm-note");
    left.appendChild(breadSub);

    var grid = el("div", "gm-bread-grid");
    grid.setAttribute("aria-hidden", "true");
    var breadCells = [];
    for (var i = 0; i < BREAD_ICONS; i++) {
      var c = el("span", "gm-bread", "🍞");
      breadCells.push(c);
      grid.appendChild(c);
    }
    left.appendChild(grid);
    left.appendChild(el("p", "gm-block-caption", "每个 🍞 代表 10 条面包（1971 年：400 条）"));

    var stats = el("div", "gm-stat-grid");
    var cellPP = el("div", "gm-cell");
    cellPP.appendChild(el("span", "gm-label", "购买力只剩"));
    var valPP = el("span", "gm-value");
    cellPP.appendChild(valPP);
    var cellM2 = el("div", "gm-cell");
    cellM2.appendChild(el("span", "gm-label", "同期美元 M2 供应量"));
    var valM2 = el("span", "gm-value");
    cellM2.appendChild(valM2);
    stats.appendChild(cellPP);
    stats.appendChild(cellM2);
    left.appendChild(stats);

    var milestone = el("div", "gm-tm-milestone");
    var msYear = el("span", "gm-ms-year");
    var msText = el("span");
    milestone.appendChild(msYear);
    milestone.appendChild(msText);
    left.appendChild(milestone);

    /* 右列：另一套系统 */
    var right = el("div");
    cols.appendChild(right);
    var capPanel = el("div", "gm-cap-panel");
    right.appendChild(capPanel);
    capPanel.appendChild(el("p", "gm-cap-title", "另一套系统"));

    var capBar = el("div", "gm-cap-bar");
    var capLock = el("div", "gm-cap-lock", "🔒 上限：21,000,000 BTC");
    capBar.appendChild(capLock);
    capPanel.appendChild(capBar);
    capPanel.appendChild(el("p", "gm-cap-note", "任何年份、任何人都无法更改这条上限。"));

    var minedWrap = el("div", "gm-mined-wrap");
    var minedBar = el("div", "gm-mined-bar");
    var minedFill = el("div", "gm-mined-fill");
    minedBar.appendChild(minedFill);
    minedWrap.appendChild(minedBar);
    var minedNote = el("p", "gm-cap-note");
    minedWrap.appendChild(minedNote);
    capPanel.appendChild(minedWrap);

    root.appendChild(el("p", "gm-foot", "数据为约值，依据美国 BLS CPI 与美联储 M2 统计。教学收尾只有一句：法币的购买力曲线由政策决定，比特币的供给曲线由数学决定。"));

    /* ---- 渲染逻辑 ---- */
    var dragged = false;

    function milestoneFor(year) {
      var hit = MILESTONES[0];
      for (var k2 = 0; k2 < MILESTONES.length; k2++) {
        if (MILESTONES[k2][0] <= year) hit = MILESTONES[k2];
      }
      return hit;
    }

    function render() {
      var y = parseInt(slider.value, 10);
      yearBig.textContent = y + " 年";

      var price = breadPrice(y);
      var loaves = Math.max(1, Math.round(100 / price));
      breadBig.textContent = "还能买 " + fmt(loaves) + " 条";
      breadSub.textContent = "白面包约 $" + price.toFixed(2) + "/条 · 1971 年这笔钱能买 400 条";

      var lit = Math.max(1, Math.round(loaves / 10));
      if (lit > BREAD_ICONS) lit = BREAD_ICONS;
      for (var k2 = 0; k2 < BREAD_ICONS; k2++) {
        breadCells[k2].classList.toggle("gm-dim", k2 >= lit);
      }

      var pp = lerpTable(CPI_TABLE, Y_MIN) / lerpTable(CPI_TABLE, y) * 100;
      valPP.textContent = fmt(pp, pp < 20 ? 1 : 0) + "%";
      var m2x = lerpTable(M2_TABLE, y) / lerpTable(M2_TABLE, Y_MIN);
      valM2.textContent = "约 ×" + fmt(m2x, m2x < 10 ? 1 : 0) + "（$" + fmt(lerpTable(M2_TABLE, y), 1) + " 万亿）";

      var ms = milestoneFor(y);
      msYear.textContent = ms[0] + " 年";
      msText.textContent = (ms[0] === y ? "" : "（最近的里程碑）") + ms[1];

      if (y < 2009) {
        minedFill.style.width = "0%";
        minedNote.textContent = "比特币：（尚未诞生）——但上限已经注定，连它的创造者也改不了。";
      } else {
        var pct = btcIssuedAt(y) / 21000000 * 100;
        minedFill.style.width = pct.toFixed(1) + "%";
        minedNote.textContent = "至 " + y + " 年已挖出约 " + fmt(pct, 1) + "%，其余仍按时间表锁在未来的区块里。";
      }

      if (!dragged && y !== Y_MIN) {
        dragged = true;
        hint.textContent = "继续拖。注意：没有任何一年，面包会变多。";
      }
    }

    slider.addEventListener("input", render);
    render();

    return function destroy() { /* 本游戏无定时器，无需清理 */ };
  }

  /* ================= 3. 游戏二 · 孤勇者矿工 ================= */

  function buildPowMiner(root) {
    var MANUAL_DIFF = 2;      // 手动模式固定难度：2 个前导 0
    var CLICK_BATCH = 30;     // 每次点击执行的真实 SHA-256 次数
    var MAX_LOG_LINES = 30;   // 乱码区最多保留的行数

    /* ---- 骨架 ---- */
    root.appendChild(el("p", "gm-kicker", "互动 · 孤勇者矿工"));
    root.appendChild(el("h3", "gm-title", "亲手算一次哈希，理解什么叫“工作量证明”"));
    root.appendChild(el("p", "gm-desc", "点击按钮，你的设备会真实地计算 SHA-256。目标：找到一个让哈希以足够多 0 开头的 Nonce。没有捷径，只有一次次地试。"));

    var panel = el("div", "gm-panel");
    root.appendChild(panel);

    var mineBtn = btn("gm-mine-btn", "挖一下 ⛏", "执行一批哈希计算");
    panel.appendChild(mineBtn);
    panel.appendChild(el("p", "gm-block-caption", "按住可以连点 · 手动难度：哈希需以 2 个 0 开头"));

    var ctrlRow = el("div", "gm-row");
    var autoBtn = btn("gm-switch", "开启自动挖矿");
    autoBtn.setAttribute("aria-pressed", "false");
    ctrlRow.appendChild(autoBtn);
    var segLabel = el("label", null, "自动难度");
    ctrlRow.appendChild(segLabel);
    var seg = el("div", "gm-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "自动挖矿难度：前导 0 的个数");
    var segBtns = [];
    [2, 3, 4].forEach(function (d) {
      var b = btn(null, d + " 个 0");
      b.dataset.d = String(d);
      if (d === 3) b.classList.add("gm-on");
      segBtns.push(b);
      seg.appendChild(b);
    });
    ctrlRow.appendChild(seg);
    panel.appendChild(ctrlRow);

    var stats = el("div", "gm-stat-grid");
    function statCell(label) {
      var cellWrap = el("div", "gm-cell");
      cellWrap.appendChild(el("span", "gm-label", label));
      var v = el("span", "gm-value", "0");
      cellWrap.appendChild(v);
      stats.appendChild(cellWrap);
      return v;
    }
    var valTries = statCell("累计尝试");
    var valClicks = statCell("你点击了");
    var valSpeed = statCell("算力");
    var valTime = statCell("本块用时");
    valSpeed.textContent = "—";
    valTime.textContent = "0 秒";
    panel.appendChild(stats);

    /* ---- 能量对照：你的尘埃 vs 全网的城市 ---- */
    var emeter = el("div", "gm-energy");
    var eYou = el("p", "gm-energy-row");
    eYou.appendChild(el("span", "gm-energy-k", "你已燃烧"));
    var eYouV = el("span", "gm-energy-v", "0 mJ");
    eYou.appendChild(eYouV);
    var eYouNote = el("span", "gm-energy-n", "——还不够点亮任何东西");
    eYou.appendChild(eYouNote);
    var eNet = el("p", "gm-energy-row");
    eNet.appendChild(el("span", "gm-energy-k", "全网同期"));
    var eNetV = el("span", "gm-energy-v net", "0 度电");
    eNet.appendChild(eNetV);
    eNet.appendChild(el("span", "gm-energy-n", "——功率约 200 亿瓦，≈ 整个泰国的全国用电"));
    emeter.appendChild(eYou);
    emeter.appendChild(eNet);
    panel.appendChild(emeter);

    var energyJ = 0;
    var netT0 = performance.now();
    var NET_KWH_PER_S = 5556; /* ≈20GW 口径 */
    function fmtEnergy(j) {
      return j < 1 ? (j * 1000).toFixed(0) + " mJ" : j.toFixed(2) + " J";
    }
    function energyNote(j) {
      if (j < 0.05) return "——还不够点亮任何东西";
      if (j < 5) return "——够一盏 LED 亮 " + (j / 0.05).toFixed(1) + " 秒";
      return "——够手机亮屏 " + j.toFixed(0) + " 秒";
    }
    function updateEnergy() {
      eYouV.textContent = fmtEnergy(energyJ);
      eYouNote.textContent = energyNote(energyJ);
    }
    /* 全网电表：自你打开此页起，一座"国家"在替这本账呼吸 */
    if (root.__netIv) clearInterval(root.__netIv);
    root.__netIv = setInterval(function () {
      var kwh = (performance.now() - netT0) / 1000 * NET_KWH_PER_S;
      eNetV.textContent = fmt(Math.round(kwh)) + " 度电";
    }, 1000);

    /* 每次点击：一粒能量耗散的小数字 */
    var zapLive = 0;
    function spawnZap() {
      if (reducedMotion || zapLive >= 5) return;
      zapLive++;
      var z = el("span", "gm-zap", "−12 mJ ⚡");
      mineBtn.parentNode.appendChild(z);
      setTimeout(function () { zapLive--; if (z.parentNode) z.parentNode.removeChild(z); }, 800);
    }

    var log = el("div", "gm-log");
    log.setAttribute("aria-hidden", "true"); // 纯展示的乱码流，对读屏器静默
    panel.appendChild(log);

    var resultBox = el("div");
    resultBox.setAttribute("role", "status");
    panel.appendChild(resultBox);

    root.appendChild(el("p", "gm-foot", "你刚刚消耗了真实的时间与能量，换来一条谁都无法伪造的记录——这就是工作量证明：用物理世界的成本，为数字世界的账本背书。"));

    /* ---- 状态 ---- */
    var blockHeight = 1;
    var prevHash = "0000000000000000";
    var nonce = 0;            // 当前块内的 nonce
    var blockTries = 0;       // 当前块尝试次数
    var totalTries = 0;       // 累计尝试次数
    var clicks = 0;
    var blockT0 = 0;          // 当前块开始时间
    var found = false;        // 当前块是否已挖到
    var autoOn = false;
    var autoDiff = 3;
    var rafId = 0;
    var holdTimer = 0, holdInterval = 0, holdFired = false;
    var autoResume = 0;
    var speedWinT = 0, speedWinN = 0; // 算力统计窗口
    var destroyed = false;

    function blockData() {
      return "胡侃比特·教学区块#" + blockHeight + "|prev:" + prevHash.slice(0, 12) + "|tx:老周→小胡 0.42 BTC|nonce:";
    }

    function burn(count) {
      energyJ += count * 0.0004; /* 约 0.4 mJ/次（移动端 JS 哈希量级） */
      updateEnergy();
    }

    function leadingZeros(h) {
      var n = 0;
      while (n < h.length && h.charAt(n) === "0") n++;
      return n;
    }

    function pushLine(n, h, isHit) {
      var line = el("span", "gm-log-line" + (isHit ? " gm-hit" : ""));
      var z = leadingZeros(h);
      line.appendChild(document.createTextNode("nonce=" + n + " → "));
      if (z > 0) line.appendChild(el("span", "gm-zero", h.slice(0, z)));
      line.appendChild(document.createTextNode(h.slice(z)));
      log.appendChild(line);
      while (log.children.length > MAX_LOG_LINES) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }

    function updateStats(speedText) {
      valTries.textContent = fmt(totalTries);
      valClicks.textContent = fmt(clicks) + " 下";
      valTime.textContent = blockT0 ? ((performance.now() - blockT0) / 1000).toFixed(1) + " 秒" : "0 秒";
      if (speedText != null) valSpeed.textContent = speedText;
    }

    /* 执行一批哈希；返回找到的 {n, h} 或 null */
    function runBatch(size, diff, sampleEvery) {
      if (!blockT0) blockT0 = performance.now();
      var target = "0".repeat(diff);
      var data = blockData();
      var foundHit = null;
      var sampled = 0;
      var maxSamples = reducedMotion ? 1 : 3; // reduced-motion 下减少滚动频率
      for (var i = 0; i < size; i++) {
        var n = nonce++;
        var h = sha256Sync(data + n);
        blockTries++; totalTries++;
        var ok = h.slice(0, diff) === target;
        if ((i % sampleEvery === 0 && sampled < maxSamples) || ok) {
          pushLine(n, h, ok);
          sampled++;
        }
        if (ok) { foundHit = { n: n, h: h }; break; }
      }
      burn(size);
      return foundHit;
    }

    function celebrate(hit, diff) {
      found = true;
      lockUntil = performance.now() + 1600;
      mineBtn.disabled = true;
      mineBtn.textContent = "✓ 已铸造";
      setTimeout(function () {
        mineBtn.disabled = false;
        mineBtn.textContent = "继续挖下一块 ⛏";
      }, 1600);
      try { localStorage.setItem("hkb-mined", "1"); } catch (e) { /* 隐私模式忽略 */ }
      var elapsed = ((performance.now() - blockT0) / 1000).toFixed(1);
      resultBox.innerHTML = "";
      var card = el("div", "gm-success");
      var head = el("p", "gm-success-head");
      head.appendChild(coin());
      head.appendChild(document.createTextNode("✓ 区块 #" + blockHeight + " 已铸造 · 奖励 3.125 比特币"));
      card.appendChild(head);
      var hashP = el("p", "gm-mono");
      hashP.appendChild(el("span", "gm-zero", hit.h.slice(0, diff)));
      hashP.appendChild(document.createTextNode(hit.h.slice(diff)));
      card.appendChild(hashP);
      card.appendChild(el("p", "gm-note", "Nonce = " + fmt(hit.n) + " · 本块共尝试 " + fmt(blockTries) + " 次 · 用时 " + elapsed + " 秒"));
      card.appendChild(el("p", "gm-note", "这条记录从此与前一个区块咬合。想伪造它？把刚才的功夫从头再来一遍——而且要快过全世界。"));
      card.appendChild(el("p", "gm-note faint", "能量对照：你这块试了 " + fmt(blockTries) + " 次，设备约耗 " + (blockTries * 0.0004).toFixed(2) + " 焦耳。真实比特币网络铸造一个区块，平均要试约 4×10²² 次、烧掉约 290 万度电——相当于北京全城 10 分钟的用电。你的尝试是其中一粒尘埃，而亿万粒尘埃的总和，就是无法伪造的城墙。"));
      resultBox.appendChild(card);
      if (!reducedMotion) {
        panel.classList.remove("gm-flash");
        void panel.offsetWidth; // 重新触发动画
        panel.classList.add("gm-flash");
      }
      prevHash = hit.h;
      blockHeight++;
    }

    function startNextBlock() {
      found = false;
      nonce = 0;
      blockTries = 0;
      blockT0 = 0;
      resultBox.innerHTML = "";
      mineBtn.textContent = "挖一下 ⛏";
    }

    /* ---- 手动挖矿 ---- */
    var lockUntil = 0;
    function manualStep() {
      if (autoOn) return;
      if (performance.now() < lockUntil) return; /* 铸造后冷却：防误触吞结果 */
      if (found) startNextBlock();
      clicks++;
      spawnZap();
      var hit = runBatch(CLICK_BATCH, MANUAL_DIFF, 7);
      updateStats("—（手动）");
      if (hit) celebrate(hit, MANUAL_DIFF);
    }

    mineBtn.addEventListener("click", function () {
      if (holdFired) { holdFired = false; return; } // 长按结束派发的 click 忽略
      manualStep();
    });

    /* 按住连点：pointerdown 350ms 后开始重复 */
    mineBtn.addEventListener("pointerdown", function () {
      if (autoOn) return;
      clearTimeout(holdTimer); clearInterval(holdInterval);
      holdTimer = setTimeout(function () {
        holdFired = true;
        holdInterval = setInterval(function () {
          if (found || autoOn) { clearInterval(holdInterval); return; }
          manualStep();
        }, reducedMotion ? 180 : 95);
      }, 350);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (evName) {
      mineBtn.addEventListener(evName, function () {
        clearTimeout(holdTimer);
        clearInterval(holdInterval);
      });
    });

    /* ---- 自动挖矿（requestAnimationFrame，每帧一批不卡 UI）---- */
    function autoFrame() {
      if (!autoOn || destroyed) return;
      if (found) { rafId = requestAnimationFrame(autoFrame); return; }
      var batch = autoDiff === 2 ? 90 : (autoDiff === 3 ? 400 : 650);
      if (reducedMotion) batch = Math.max(40, Math.round(batch * 0.6));
      var hit = runBatch(batch, autoDiff, Math.ceil(batch / 3));
      /* 算力：滑动窗口估算 */
      var now = performance.now();
      if (!speedWinT) { speedWinT = now; speedWinN = 0; }
      speedWinN += batch;
      var speedText = null;
      if (now - speedWinT >= 500) {
        speedText = fmt(speedWinN / ((now - speedWinT) / 1000), 0) + " 次/秒";
        speedWinT = now; speedWinN = 0;
      }
      updateStats(speedText);
      if (hit) {
        celebrate(hit, autoDiff);
        /* 短暂停顿后自动开下一块，可以一直看下去 */
        autoResume = setTimeout(function () {
          if (autoOn && !destroyed) startNextBlock();
        }, 1200);
      }
      rafId = requestAnimationFrame(autoFrame);
    }

    function setAuto(on) {
      autoOn = on;
      autoBtn.textContent = on ? "停止自动挖矿" : "开启自动挖矿";
      autoBtn.classList.toggle("gm-on", on);
      autoBtn.setAttribute("aria-pressed", on ? "true" : "false");
      mineBtn.disabled = on;
      if (on) {
        if (found) startNextBlock();
        speedWinT = 0;
        rafId = requestAnimationFrame(autoFrame);
      } else {
        cancelAnimationFrame(rafId);
        clearTimeout(autoResume);
        valSpeed.textContent = "—";
      }
    }

    autoBtn.addEventListener("click", function () { setAuto(!autoOn); });

    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      autoDiff = parseInt(b.dataset.d, 10);
      segBtns.forEach(function (x) { x.classList.toggle("gm-on", x === b); });
    });

    updateStats(null);

    /* ---- 清理：重新渲染前停掉 rAF / interval ---- */
    return function destroy() {
      destroyed = true;
      autoOn = false;
      cancelAnimationFrame(rafId);
      clearTimeout(holdTimer);
      clearInterval(holdInterval);
      clearTimeout(autoResume);
    };
  }

  /* ================= 4. 游戏三 · 内存池停车场 ================= */

  /* 候选交易池（fee 会做 ±20% 抖动；构造上保证“按费率排序”的贪心解
     与穷举最优解一致，且咖啡几乎永远挤不进去） */
  var MP_POOL = [
    { e: "☕", name: "买杯咖啡", size: 1, fee: 2 },
    { e: "🍜", name: "一碗牛肉面", size: 1, fee: 3 },
    { e: "🎮", name: "游戏充值", size: 1, fee: 5 },
    { e: "📱", name: "网购手机", size: 2, fee: 15 },
    { e: "💼", name: "工资发放", size: 3, fee: 40 },
    { e: "🏠", name: "买房首付", size: 3, fee: 60 },
    { e: "🐋", name: "鲸鱼大额转账", size: 2, fee: 90 },
    { e: "🏦", name: "交易所归集", size: 4, fee: 120 }
  ];

  var MP_CAP = 12;

  /* 贪心：按费率（手续费÷大小）降序依次装入 */
  function mpGreedy(txs) {
    var sorted = txs.slice().sort(function (a, b) {
      return (b.fee / b.size) - (a.fee / a.size);
    });
    var used = 0, revenue = 0, chosen = [];
    for (var i = 0; i < sorted.length; i++) {
      if (used + sorted[i].size <= MP_CAP) {
        used += sorted[i].size;
        revenue += sorted[i].fee;
        chosen.push(sorted[i]);
      }
    }
    return { revenue: revenue, used: used, chosen: chosen };
  }

  /* 穷举最优（n ≤ 8，最多 256 个子集，瞬间完成） */
  function mpOptimal(txs) {
    var best = 0;
    for (var mask = 0; mask < (1 << txs.length); mask++) {
      var sizeSum = 0, feeSum = 0;
      for (var i = 0; i < txs.length; i++) {
        if (mask & (1 << i)) { sizeSum += txs[i].size; feeSum += txs[i].fee; }
      }
      if (sizeSum <= MP_CAP && feeSum > best) best = feeSum;
    }
    return best;
  }

  /* 生成一班交易：随机 7–8 笔 + 费用抖动；重试直到贪心 = 最优且咖啡落选 */
  function mpGenerate() {
    for (var attempt = 0; attempt < 40; attempt++) {
      var txs = [];
      var dropIdx = -1;
      if (Math.random() < 0.5) {
        /* 50% 概率只发 7 笔：随机去掉一张非咖啡、非鲸鱼的中间卡 */
        var droppable = [1, 2, 3, 4];
        dropIdx = droppable[Math.floor(Math.random() * droppable.length)];
      }
      for (var i = 0; i < MP_POOL.length; i++) {
        if (i === dropIdx) continue;
        var base = MP_POOL[i];
        var jitter = 0.8 + Math.random() * 0.4;
        var fee = Math.max(1, Math.round(base.fee * jitter));
        if (base.name === "买杯咖啡") fee = Math.min(fee, 3); // 咖啡永远出不起高价
        txs.push({ id: i, e: base.e, name: base.name, size: base.size, fee: fee, where: "pool" });
      }
      /* 洗牌展示顺序 */
      for (var j = txs.length - 1; j > 0; j--) {
        var k2 = Math.floor(Math.random() * (j + 1));
        var tmp = txs[j]; txs[j] = txs[k2]; txs[k2] = tmp;
      }
      var g = mpGreedy(txs);
      var coffeeIn = g.chosen.some(function (t) { return t.name === "买杯咖啡"; });
      if (g.revenue === mpOptimal(txs) && !coffeeIn) return txs;
    }
    /* 兜底：用未抖动的基础数值（已验证贪心 = 最优 = ¥310，咖啡落选） */
    return MP_POOL.map(function (b, idx) {
      return { id: idx, e: b.e, name: b.name, size: b.size, fee: b.fee, where: "pool" };
    });
  }

  function buildMempool(root) {
    /* ---- 骨架 ---- */
    root.appendChild(el("p", "gm-kicker", "互动 · 内存池停车场"));
    root.appendChild(el("h3", "gm-title", "区块空间拍卖：你来当一回矿工"));
    root.appendChild(el("p", "gm-desc", "桥（区块）只有 12 格，等待区的交易却装不完。先点选一笔交易，再点击桥面装入；点已装入的交易可以移回。装好后点「打包区块」，看看矿工会怎么选。"));

    var panel = el("div", "gm-panel");
    root.appendChild(panel);

    panel.appendChild(el("p", "gm-section-label", "区块 · 容量 12 格"));
    var readout = el("div", "gm-mp-readout");
    var roUsed = el("span");
    var roFee = el("span");
    readout.appendChild(roUsed);
    readout.appendChild(roFee);
    panel.appendChild(readout);

    var block = el("div", "gm-block");
    block.setAttribute("role", "button");
    block.setAttribute("aria-label", "区块区域：选中交易后点击这里装入");
    block.tabIndex = 0;
    var blockGrid = el("div", "gm-block-grid");
    var cells = [];
    for (var ci = 0; ci < MP_CAP; ci++) {
      var cell = el("div", "gm-cell");
      cells.push(cell);
      blockGrid.appendChild(cell);
    }
    block.appendChild(blockGrid);
    panel.appendChild(block);
    panel.appendChild(el("p", "gm-block-caption", "↑ 这座桥每 10 分钟才发一班，全世界共用"));

    var tip = el("p", "gm-tip");
    tip.setAttribute("aria-live", "polite");
    panel.appendChild(tip);

    panel.appendChild(el("p", "gm-section-label", "等待区 · Mempool"));
    var pool = el("div", "gm-pool");
    panel.appendChild(pool);

    var btnRow = el("div", "gm-row");
    btnRow.style.marginTop = "1.1rem";
    var packBtn = btn("gm-btn", "打包区块 ✓");
    var nextBtn = btn("gm-btn gm-ghost", "下一班区块");
    btnRow.appendChild(packBtn);
    btnRow.appendChild(nextBtn);
    panel.appendChild(btnRow);

    var revealBox = el("div");
    panel.appendChild(revealBox);

    root.appendChild(el("p", "gm-foot", "区块空间是稀缺资源，手续费是竞拍出价。小额日常支付挤不进主链，所以它们去“二层”（如闪电网络）——主链负责结算，就像法院不受理鸡毛蒜皮。"));

    /* ---- 状态 ---- */
    var txs = [];
    var placedOrder = []; // 已装入的 tx（按放入顺序）
    var selectedId = null;
    var locked = false;
    var shakeTimer = 0;

    function usedSlots() {
      return placedOrder.reduce(function (s, t) { return s + t.size; }, 0);
    }

    function feeSum() {
      return placedOrder.reduce(function (s, t) { return s + t.fee; }, 0);
    }

    function findTx(id) {
      for (var i = 0; i < txs.length; i++) if (txs[i].id === id) return txs[i];
      return null;
    }

    /* ---- 渲染 ---- */
    function renderBlock() {
      var idx = 0;
      for (var i = 0; i < placedOrder.length; i++) {
        var t = placedOrder[i];
        for (var s = 0; s < t.size; s++) {
          var c = cells[idx++];
          c.className = "gm-cell gm-filled";
          c.textContent = s === 0 ? t.e : "";
          c.dataset.id = String(t.id);
          c.title = t.name + "（点击移回等待区）";
        }
      }
      for (; idx < MP_CAP; idx++) {
        var ec = cells[idx];
        ec.className = "gm-cell";
        ec.textContent = "";
        delete ec.dataset.id;
        ec.title = "";
      }
      roUsed.innerHTML = "已用 <strong>" + usedSlots() + " / " + MP_CAP + "</strong> 格";
      roFee.innerHTML = "矿工收入 <strong>¥" + fmt(feeSum()) + "</strong>";
    }

    function renderPool() {
      pool.innerHTML = "";
      txs.forEach(function (t) {
        if (t.where !== "pool") return;
        var card = el("div", "gm-card" + (t.id === selectedId ? " gm-selected" : ""));
        card.dataset.id = String(t.id);
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.setAttribute("aria-label", t.name + "，占 " + t.size + " 格，手续费 " + t.fee + " 元" + (t.id === selectedId ? "，已选中" : ""));
        card.appendChild(el("div", "gm-card-name", t.e + " " + t.name));
        var meta = el("div", "gm-card-meta");
        meta.appendChild(el("span", null, t.size + " 格"));
        meta.appendChild(el("span", "gm-card-fee", "¥" + fmt(t.fee)));
        card.appendChild(meta);
        card.draggable = true; // 鼠标拖拽作为增强；点选模式完整可用
        pool.appendChild(card);
      });
      block.classList.toggle("gm-target", selectedId != null && !locked);
    }

    function setTip(text, warn) {
      tip.textContent = text || "";
      tip.classList.toggle("gm-warn", !!warn);
    }

    /* ---- 交互 ---- */
    function placeSelected() {
      if (locked || selectedId == null) return;
      var t = findTx(selectedId);
      if (!t || t.where !== "pool") return;
      var left = MP_CAP - usedSlots();
      if (t.size > left) {
        if (!reducedMotion) {
          block.classList.remove("gm-shake");
          void block.offsetWidth;
          block.classList.add("gm-shake");
          clearTimeout(shakeTimer);
          shakeTimer = setTimeout(function () { block.classList.remove("gm-shake"); }, 400);
        }
        setTip("装不下了——只剩 " + left + " 格，这笔要 " + t.size + " 格。先把别的移出来，或者放弃它。", true);
        return;
      }
      t.where = "block";
      placedOrder.push(t);
      selectedId = null;
      setTip(t.e + " " + t.name + " 已装入。它出了 ¥" + fmt(t.fee) + "，买下 " + t.size + " 格桥面。");
      renderBlock();
      renderPool();
    }

    function removeTx(id) {
      if (locked) return;
      var t = findTx(id);
      if (!t || t.where !== "block") return;
      t.where = "pool";
      placedOrder = placedOrder.filter(function (x) { return x.id !== id; });
      setTip(t.e + " " + t.name + " 被请下了桥，回到等待区继续排队。");
      renderBlock();
      renderPool();
    }

    pool.addEventListener("click", function (e) {
      if (locked) return;
      var card = e.target.closest(".gm-card");
      if (!card || !pool.contains(card)) return;
      var id = parseInt(card.dataset.id, 10);
      selectedId = (selectedId === id) ? null : id;
      if (selectedId != null) {
        var t = findTx(id);
        setTip("已选中 " + t.e + " " + t.name + "。现在点击上面的区块装入它。");
      } else {
        setTip("");
      }
      renderPool();
    });

    /* 键盘可达：Enter / 空格 等同点击 */
    pool.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var card = e.target.closest(".gm-card");
      if (!card) return;
      e.preventDefault();
      card.click();
    });

    block.addEventListener("click", function (e) {
      if (locked) return;
      var cell = e.target.closest(".gm-cell");
      if (cell && cell.dataset.id != null) {
        removeTx(parseInt(cell.dataset.id, 10));
        return;
      }
      if (selectedId != null) placeSelected();
      else setTip("先在下面的等待区点选一笔交易，再点这里装入。");
    });

    block.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (selectedId != null) placeSelected();
    });

    /* 鼠标拖拽增强（桌面）；触屏走点选流程 */
    pool.addEventListener("dragstart", function (e) {
      if (locked) return;
      var card = e.target.closest(".gm-card");
      if (!card) return;
      selectedId = parseInt(card.dataset.id, 10);
      renderPool();
      if (e.dataTransfer) e.dataTransfer.setData("text/plain", card.dataset.id);
    });
    block.addEventListener("dragover", function (e) {
      if (!locked && selectedId != null) e.preventDefault();
    });
    block.addEventListener("drop", function (e) {
      e.preventDefault();
      placeSelected();
    });

    /* ---- 打包揭晓 ---- */
    packBtn.addEventListener("click", function () {
      if (locked) return;
      if (placedOrder.length === 0) {
        setTip("桥还空着——先装入几笔交易，再打包。", true);
        return;
      }
      locked = true;
      packBtn.disabled = true;
      selectedId = null;
      renderPool();

      var mine = feeSum();
      var g = mpGreedy(txs);
      var coffee = null;
      txs.forEach(function (t) { if (t.name === "买杯咖啡") coffee = t; });

      revealBox.innerHTML = "";
      var box = el("div", "gm-reveal" + (mine >= g.revenue ? " gm-best" : ""));
      if (mine >= g.revenue) {
        box.appendChild(el("p", "gm-reveal-head", "✓ 收入 ¥" + fmt(mine) + "——你和矿工想到一块去了"));
        box.appendChild(el("p", null, "矿工的真实算法正是这么做的：把每笔交易按“费率 = 手续费 ÷ 占用空间”排序，从高到低装，直到装不下。你凭直觉跑出了最优解。"));
      } else {
        box.appendChild(el("p", "gm-reveal-head", "你的收入：¥" + fmt(mine) + " · 矿工的算法能拿到：¥" + fmt(g.revenue)));
        box.appendChild(el("p", null, "差距 ¥" + fmt(g.revenue - mine) + "。矿工不看交易“重不重要”，只按费率（手续费 ÷ 大小）从高到低装。它会选："));
        var ul = el("ul");
        g.chosen.forEach(function (t) {
          ul.appendChild(el("li", null, t.e + " " + t.name + " —— " + t.size + " 格 · ¥" + fmt(t.fee) + "（¥" + fmt(t.fee / t.size, 1) + "/格）"));
        });
        box.appendChild(ul);
      }
      if (coffee) {
        var coffeeLine;
        if (coffee.where === "block") {
          coffeeLine = "☕ 你心软放进了那杯咖啡——但它每格只出 ¥" + fmt(coffee.fee / coffee.size, 1) + "，占掉的位置本可以卖更高的价。矿工不会这么做，不是冷血，是机制。";
        } else {
          coffeeLine = "☕ 那杯咖啡还堵在停车场——它出的 ¥" + fmt(coffee.fee) + " 不够买下这格空间。下一班、再下一班，它大概率还是挤不进去。";
        }
        var cp = el("p", null, coffeeLine);
        box.appendChild(cp);
      }
      revealBox.appendChild(box);
      setTip("点「下一班区块」换一批交易再玩一次。");
    });

    /* ---- 下一班 ---- */
    function newRound() {
      txs = mpGenerate();
      placedOrder = [];
      selectedId = null;
      locked = false;
      packBtn.disabled = false;
      revealBox.innerHTML = "";
      setTip("");
      renderBlock();
      renderPool();
    }

    nextBtn.addEventListener("click", newRound);
    newRound();

    return function destroy() {
      clearTimeout(shakeTimer);
    };
  }

  /* ================= 5. 八字黄历（文化彩蛋） =================
     干支推算说明：
     - 流日：儒略日序号对 60 取模（锚点：2000-01-01 = 戊午日，与通行万年历库一致）
     - 流年：以立春（约 2 月 4 日）为界
     - 流月：取最近一个已过的“节”（近似日期表，交界日 ±1 天以专业万年历为准）
     定位是文化彩蛋，不是命理工具，更不是投资指标。 */

  var STEMS = "甲乙丙丁戊己庚辛壬癸";
  var BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  var ZODIAC = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
  /* 五行编号：0 木 1 火 2 土 3 金 4 水 */
  var STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  var BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  var ELS = [
    { name: "木", cls: "gm-el-wood" },
    { name: "火", cls: "gm-el-fire" },
    { name: "土", cls: "gm-el-earth" },
    { name: "金", cls: "gm-el-metal" },
    { name: "水", cls: "gm-el-water" }
  ];
  /* 十二“节”的近似公历日期（月, 日），从立春起 */
  var JIE = [[2, 4], [3, 6], [4, 5], [5, 6], [6, 6], [7, 7], [8, 8], [9, 8], [10, 8], [11, 7], [12, 7], [1, 6]];

  function baziPillars(y, m, d) {
    var stamp = Date.UTC(y, m - 1, d);
    var jdn = Math.floor(stamp / 86400000) + 2440588;
    var dayIdx = ((jdn - 11) % 60 + 60) % 60;

    var effYear = (m > 2 || (m === 2 && d >= 4)) ? y : y - 1;
    var yearIdx = ((effYear - 4) % 60 + 60) % 60;

    var mi = -1;
    for (var k = 0; k < 12; k++) {
      var jy = effYear + (k === 11 ? 1 : 0); /* 小寒落在下一公历年 */
      if (stamp >= Date.UTC(jy, JIE[k][0] - 1, JIE[k][1])) mi = k;
    }
    if (mi < 0) mi = 11;

    var firstStem = [2, 4, 6, 8, 0][(yearIdx % 10) % 5]; /* 五虎遁月 */
    return {
      year: { stem: yearIdx % 10, branch: yearIdx % 12 },
      month: { stem: (firstStem + mi) % 10, branch: (2 + mi) % 12 },
      day: { stem: dayIdx % 10, branch: dayIdx % 12 },
      zodiac: ZODIAC[yearIdx % 12]
    };
  }

  function elOf(charIdx, isStem) {
    return ELS[isStem ? STEM_EL[charIdx] : BRANCH_EL[charIdx]];
  }

  function createAlmanac(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "文化彩蛋 · 仅供一乐"));
    root.appendChild(el("p", "gm-title", "流日五行 · 比特币金水说"));
    root.appendChild(el("p", "gm-desc", "古人用天干地支给时间记账——某种意义上，这是最早的“时间戳链”。选个日子（比如你的生日），看看那天的五行能量。"));

    var row = el("div", "gm-row");
    var lab = el("label", null, "选择日期");
    var input = el("input", "gm-alm-date");
    input.type = "date";
    var today = new Date();
    function isoOf(dt) {
      return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
    }
    input.value = isoOf(today);
    input.max = "2100-12-31";
    input.min = "1900-01-01";
    var backBtn = btn("gm-btn gm-ghost", "回到今天");
    row.appendChild(lab); row.appendChild(input); row.appendChild(backBtn);
    root.appendChild(row);

    var head = el("p", "gm-alm-head", "");
    var pillarsBox = el("div", "gm-pillars");
    var meterWrap = el("div");
    var meter = el("div", "gm-meter");
    var fill = el("div", "gm-meter-fill");
    meter.appendChild(fill);
    var reading = el("p", "gm-note", "");
    var btcLine = el("p", "gm-note", "");
    root.appendChild(head);
    root.appendChild(pillarsBox);
    root.appendChild(btcLine);
    meterWrap.appendChild(meter);
    root.appendChild(meterWrap);
    root.appendChild(reading);

    var legend = el("div", "gm-legend");
    for (var li = 0; li < ELS.length; li++) {
      var item = el("span", null, ELS[li].name);
      var dot = el("span", "dot " + ELS[li].cls);
      item.insertBefore(dot, item.firstChild);
      legend.appendChild(item);
    }
    root.appendChild(legend);
    root.appendChild(el("p", "gm-note gm-tip", "声明：八字是古人理解时间的诗意方式，不是投资指标。判断比特币，请用前面文章里的数学与事实；节气交界日的干支，以专业万年历为准。"));

    function charChip(idx, isStem) {
      var info = elOf(idx, isStem);
      var chip = el("span", "gm-char " + info.cls, (isStem ? STEMS : BRANCHES)[idx]);
      var sm = el("small", null, info.name);
      chip.appendChild(sm);
      chip.title = (isStem ? STEMS : BRANCHES)[idx] + " · 五行属" + info.name;
      return chip;
    }

    function pillarCol(label, p) {
      var col = el("div", "gm-pillar");
      col.appendChild(el("span", "gm-pillar-label", label));
      col.appendChild(charChip(p.stem, true));
      col.appendChild(charChip(p.branch, false));
      return col;
    }

    function render() {
      var parts = (input.value || isoOf(today)).split("-");
      var y = +parts[0], m = +parts[1], d = +parts[2];
      if (!y || !m || !d) return;
      var pz = baziPillars(y, m, d);
      var wk = "日一二三四五六"[new Date(y, m - 1, d).getDay()];
      head.textContent = "公历 " + y + " 年 " + m + " 月 " + d + " 日 · 星期" + wk +
        " · " + STEMS[pz.year.stem] + BRANCHES[pz.year.branch] + pz.zodiac + "年";

      pillarsBox.innerHTML = "";
      pillarsBox.appendChild(pillarCol("流年", pz.year));
      pillarsBox.appendChild(pillarCol("流月", pz.month));
      pillarsBox.appendChild(pillarCol("流日", pz.day));

      var six = [
        [pz.year.stem, true], [pz.year.branch, false],
        [pz.month.stem, true], [pz.month.branch, false],
        [pz.day.stem, true], [pz.day.branch, false]
      ];
      var jinshui = 0;
      for (var i = 0; i < six.length; i++) {
        var e = six[i][1] ? STEM_EL[six[i][0]] : BRANCH_EL[six[i][0]];
        if (e === 3 || e === 4) jinshui++;
      }
      btcLine.textContent = "站长的玩法：比特币偏金水——数字黄金为金，全球流动为水。这一天六字之中，金水占 " + jinshui + " 席。";
      fill.style.width = Math.round(jinshui / 6 * 100) + "%";
      var text;
      if (jinshui >= 4) text = "金水汪洋。玄学地说，链上能量充沛——科学地说，比特币每一天都照常出块。";
      else if (jinshui === 3) text = "金水有气，能量平稳流转。该读书读书，该备份助记词备份助记词。";
      else if (jinshui === 2) text = "火土渐旺。玄学建议：少看盘，多读文章。";
      else text = "火土当道。正好——关掉行情软件，去实验室亲手挖一个区块。";
      reading.textContent = "今日批注：" + text;
    }

    input.addEventListener("change", render);
    backBtn.addEventListener("click", function () { input.value = isoOf(new Date()); render(); });
    render();
  }

  /* ================= 6. 实时价格挂件 =================
     数据源 CoinGecko 公共接口；拿不到就安静地显示“暂不可用”，
     绝不闪烁、绝不红绿轰炸——它只是个安静的小钟表。 */

  var lastBtcUsd = null;

  function fetchBtcUsd(cb) {
    if (typeof fetch !== "function") { cb(null); return; }
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.bitcoin && data.bitcoin.usd) {
          lastBtcUsd = data.bitcoin.usd;
          cb({ usd: data.bitcoin.usd, chg: data.bitcoin.usd_24h_change });
        } else cb(null);
      })
      .catch(function () { cb(null); });
  }

  function createTicker(root) {
    root.classList.remove("gm-box"); /* 角落挂件，不要大面板 */
    root.innerHTML = "";
    var box = el("span", "gm-ticker");
    box.setAttribute("role", "status");
    box.setAttribute("aria-label", "比特币实时价格");
    var sym = coin();
    var price = el("span", "gm-tk-dim", "实时价格加载中…");
    var sats = el("span", "gm-tk-dim", "");
    var chg = el("span", "gm-tk-dim gm-tk-chg", "");
    box.appendChild(sym); box.appendChild(price); box.appendChild(sats); box.appendChild(chg);
    root.appendChild(box);

    function refresh() {
      fetchBtcUsd(function (res) {
        if (!res) {
          price.textContent = "实时价格暂不可用";
          price.className = "gm-tk-dim";
          sats.textContent = ""; chg.textContent = ""; chg.className = "gm-tk-dim gm-tk-chg";
          return;
        }
        price.textContent = "$" + fmt(res.usd);
        price.className = "";
        sats.textContent = "$1 ≈ " + fmt(Math.round(1e8 / res.usd)) + " 聪";
        sats.className = "gm-tk-dim";
        if (typeof res.chg === "number") {
          var up = res.chg >= 0;
          chg.textContent = "24h " + (up ? "+" : "−") + Math.abs(res.chg).toFixed(1) + "%";
          chg.className = (up ? "gm-tk-up" : "gm-tk-down") + " gm-tk-chg";
        }
      });
    }
    refresh();
    var timer = setInterval(refresh, 120000);
    return function () { clearInterval(timer); };
  }

  /* ================= 7. 第一笔转账（沙盒钱包） =================
     全程模拟、零真实资金。目标只有一个：
     让读者发现“转一笔比特币”并不比扫码付款更难。 */

  var DEMO_ADDR = "bc1qhukd3m0w24x7c9e8s5tval6fz0kgnp4u2yqr7";
  var TX_VSIZE = 140; /* 一笔普通转账约 140 vB */
  var FEE_OPTS = [
    { icon: "🐢", name: "经济舱", rate: 2, eta: "几小时内" },
    { icon: "🚶", name: "标准", rate: 8, eta: "约 30 分钟" },
    { icon: "🚀", name: "下一班", rate: 25, eta: "约 10 分钟" }
  ];

  function createFirstTx(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "沙盒模拟 · 不涉及任何真实资金"));
    root.appendChild(el("p", "gm-title", "你的第一笔转账"));
    root.appendChild(el("p", "gm-desc", "一个练习用的钱包。走完五步，你就亲手完成过一笔（模拟的）比特币转账了。"));

    var wallet = el("div", "gm-wallet");
    root.appendChild(wallet);

    var state = { step: 0, sats: 21000, fee: 1, height: 905000 + Math.floor(Math.random() * 400) };

    function fiatHint(sats) {
      var p = lastBtcUsd;
      var assumed = p == null;
      var usd = sats / 1e8 * (p == null ? 100000 : p);
      return "≈ $" + fmt(usd, 2) + (assumed ? "（按 $100,000/BTC 估算）" : "");
    }

    function dots() {
      var wrap = el("div", "gm-steps");
      for (var i = 0; i < 5; i++) wrap.appendChild(el("span", "gm-step-dot" + (i <= state.step ? " on" : "")));
      return wrap;
    }

    function nav(backFn, nextFn, nextText) {
      var row = el("div", "gm-wallet-row");
      if (backFn) {
        var b = btn("gm-btn gm-ghost", "← 上一步");
        b.addEventListener("click", backFn);
        row.appendChild(b);
      }
      if (nextFn) {
        var n = btn("gm-btn", nextText || "下一步 →");
        n.addEventListener("click", nextFn);
        row.appendChild(n);
        return { row: row, next: n };
      }
      return { row: row, next: null };
    }

    function go(step) { state.step = step; render(); }

    function render() {
      wallet.innerHTML = "";
      wallet.appendChild(el("span", "gm-sandbox-badge", "SANDBOX · 模拟环境"));
      wallet.appendChild(dots());
      if (state.step === 0) stepAddr();
      else if (state.step === 1) stepAmount();
      else if (state.step === 2) stepFee();
      else if (state.step === 3) stepConfirm();
      else stepBroadcast();
    }

    /* —— 第 1 步：收款地址（顺便体验防错码） —— */
    function stepAddr() {
      wallet.appendChild(el("h4", "gm-step-title", "① 收款人"));
      var card = el("div", "gm-addr-card");
      card.appendChild(el("div", null, "🏪 老胡的咖啡店 · 收款地址"));
      card.appendChild(el("div", "gm-addr-mono", DEMO_ADDR));
      wallet.appendChild(card);

      var input = el("input", "gm-addr-input");
      input.type = "text";
      input.placeholder = "把地址粘贴到这里";
      input.setAttribute("aria-label", "收款地址输入框");
      input.autocomplete = "off"; input.spellcheck = false;
      wallet.appendChild(input);
      var msg = el("p", "gm-field-msg dim", "试试点「帮我粘贴」——然后故意改错一个字符😏");
      wallet.appendChild(msg);

      var paste = btn("gm-btn gm-ghost", "帮我粘贴");
      var navi = nav(null, function () { go(1); }, "下一步 →");
      navi.next.disabled = true;
      var row = el("div", "gm-wallet-row");
      row.appendChild(paste);
      wallet.appendChild(row);
      wallet.appendChild(navi.row);

      function check() {
        var v = input.value.trim();
        input.classList.remove("bad", "ok");
        if (!v) {
          msg.className = "gm-field-msg dim";
          msg.textContent = "试试点「帮我粘贴」——然后故意改错一个字符😏";
          navi.next.disabled = true;
          return;
        }
        if (v === DEMO_ADDR) {
          input.classList.add("ok");
          msg.className = "gm-field-msg ok";
          msg.textContent = "✓ 地址校验通过。比特币地址自带防错码（校验和），抄对了才可能发出去。";
          navi.next.disabled = false;
        } else {
          var i = 0;
          while (i < v.length && i < DEMO_ADDR.length && v[i] === DEMO_ADDR[i]) i++;
          input.classList.add("bad");
          msg.className = "gm-field-msg bad";
          msg.textContent = "✗ 校验失败：第 " + (i + 1) + " 个字符对不上。真实钱包也会这样直接拒绝——地址抄错不会“寄丢”，只会根本发不出去。";
          navi.next.disabled = true;
        }
      }
      input.addEventListener("input", check);
      paste.addEventListener("click", function () { input.value = DEMO_ADDR; check(); input.focus(); });
    }

    /* —— 第 2 步：金额（学会用“聪”思考） —— */
    function stepAmount() {
      wallet.appendChild(el("h4", "gm-step-title", "② 金额"));
      var big = el("p", "gm-big");
      big.appendChild(coin());
      var bigNum = document.createTextNode(fmt(state.sats) + " 聪");
      big.appendChild(bigNum);
      var sub = el("p", "gm-note", fiatHint(state.sats));
      var row = el("div", "gm-row");
      var slider = el("input", "gm-range");
      slider.type = "range"; slider.min = "1000"; slider.max = "210000"; slider.step = "1000";
      slider.value = String(state.sats);
      slider.setAttribute("aria-label", "转账金额（聪）");
      row.appendChild(slider);
      wallet.appendChild(big); wallet.appendChild(sub); wallet.appendChild(row);
      wallet.appendChild(el("p", "gm-note gm-tip", "1 比特币 = 1 亿聪（satoshi）。用聪来思考，你就不会再觉得“一个币太贵、与我无关”。"));
      slider.addEventListener("input", function () {
        state.sats = +slider.value;
        bigNum.nodeValue = fmt(state.sats) + " 聪";
        sub.textContent = fiatHint(state.sats);
      });
      wallet.appendChild(nav(function () { go(0); }, function () { go(2); }).row);
    }

    /* —— 第 3 步：手续费（呼应停车场） —— */
    function stepFee() {
      wallet.appendChild(el("h4", "gm-step-title", "③ 手续费出价"));
      var opts = el("div", "gm-fee-opts");
      var note = el("p", "gm-note", "");
      FEE_OPTS.forEach(function (o, i) {
        var card = btn("gm-fee-opt" + (state.fee === i ? " on" : ""), "");
        card.appendChild(el("span", "big", o.icon + " " + o.name));
        card.appendChild(el("span", "dim", o.rate + " sat/vB · " + o.eta));
        card.appendChild(el("span", "dim", "≈ " + fmt(o.rate * TX_VSIZE) + " 聪"));
        card.addEventListener("click", function () {
          state.fee = i;
          var all = opts.querySelectorAll(".gm-fee-opt");
          for (var k = 0; k < all.length; k++) all[k].classList.remove("on");
          card.classList.add("on");
          upd();
        });
        opts.appendChild(card);
      });
      function upd() {
        var o = FEE_OPTS[state.fee];
        note.textContent = "这笔交易约占 " + TX_VSIZE + " vB 的区块空间，你的出价 = " + o.rate + " × " + TX_VSIZE + " = " + fmt(o.rate * TX_VSIZE) + " 聪。还记得停车场吗？这就是你给小车贴的价签。";
      }
      upd();
      wallet.appendChild(opts);
      wallet.appendChild(note);
      wallet.appendChild(nav(function () { go(1); }, function () { go(3); }).row);
    }

    /* —— 第 4 步：确认 + 按住发送 —— */
    function stepConfirm() {
      wallet.appendChild(el("h4", "gm-step-title", "④ 确认"));
      var o = FEE_OPTS[state.fee];
      var feeSats = o.rate * TX_VSIZE;
      var sum = el("div", "gm-summary");
      function srow(k, v, mark) {
        var r = el("div", "row");
        r.appendChild(el("span", null, k));
        var val = el("span", "v");
        if (mark) val.appendChild(coin());
        val.appendChild(document.createTextNode(v));
        r.appendChild(val);
        sum.appendChild(r);
      }
      srow("收款人", "老胡的咖啡店");
      srow("金额", fmt(state.sats) + " 聪", true);
      srow("手续费", fmt(feeSats) + " 聪（" + o.rate + " sat/vB）", true);
      srow("合计", fmt(state.sats + feeSats) + " 聪 " + fiatHint(state.sats + feeSats), true);
      wallet.appendChild(sum);

      var hold = btn("gm-hold", "");
      var fillBar = el("span", "gm-hold-fill");
      var lb = el("span", "gm-hold-label", "按住发送 ▸");
      hold.appendChild(fillBar); hold.appendChild(lb);
      wallet.appendChild(hold);
      var msg = el("p", "gm-field-msg dim", "转出后无法撤回，所以请按住约 1 秒——这 1 秒里，做决定的只有你，没有客服、没有审批。");
      wallet.appendChild(msg);

      var timer = null;
      var holdMs = reducedMotion ? 250 : 1100;
      function start(ev) {
        if (timer) return;
        ev.preventDefault();
        hold.classList.add("holding");
        timer = setTimeout(function () { timer = null; go(4); }, holdMs);
      }
      function cancel() {
        if (!timer) return;
        clearTimeout(timer); timer = null;
        hold.classList.remove("holding");
        msg.textContent = "松手了？没关系——这个键永远只属于你，想好了再按。";
      }
      hold.addEventListener("pointerdown", start);
      hold.addEventListener("pointerup", cancel);
      hold.addEventListener("pointerleave", cancel);
      hold.addEventListener("pointercancel", cancel);
      hold.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(4); } });

      wallet.appendChild(nav(function () { go(2); }, null).row);
    }

    /* —— 第 5 步：广播 → 打包 → 确认 —— */
    function stepBroadcast() {
      wallet.appendChild(el("h4", "gm-step-title", "⑤ 广播"));
      var flow = el("ul", "gm-txflow");
      wallet.appendChild(flow);
      var confs = el("div", "gm-confs");
      var confLabel = el("p", "gm-note", "");
      var timers = [];

      function later(fn, ms) { timers.push(setTimeout(fn, reducedMotion ? 0 : ms)); }
      function step(text) {
        var li = el("li", null, text);
        flow.appendChild(li);
        return li;
      }

      later(function () { step("已签名，广播到 P2P 网络——你的节点把这笔交易告诉了它认识的每个节点。"); }, 300);
      later(function () { step("进入 mempool 排队。你的出价是 " + FEE_OPTS[state.fee].rate + " sat/vB，" + (state.fee === 0 ? "队伍有点长，慢慢等。" : "排位相当靠前。")); }, 1300);
      later(function () {
        step("矿工挖出新区块，你的交易被装进了区块 #" + fmt(state.height) + "。（演示加速：现实中平均每 10 分钟一块）");
        wallet.appendChild(confs);
        wallet.appendChild(confLabel);
        for (var i = 0; i < 6; i++) confs.appendChild(el("span", "gm-conf"));
        var n = 0;
        var iv = setInterval(function () {
          n++;
          confs.children[n - 1].classList.add("on");
          confLabel.textContent = "确认数 " + n + "/6" + (n < 6 ? "——每多一个区块，篡改它的成本就翻倍地涨。" : "");
          if (n >= 6) {
            clearInterval(iv);
            try { localStorage.setItem("hkb-first-tx", "1"); } catch (e) { /* 隐私模式忽略 */ }
            confLabel.textContent = "六块已咬合成链——你的转账压在最底层，每一块都是一道再也搬不开的封印。";
            var ok = el("div", "gm-success");
            var okLine = el("div");
            okLine.appendChild(coin());
            okLine.appendChild(document.createTextNode("✓ " + fmt(state.sats) + " 聪已到账。这笔（模拟的）转账没有经过任何银行、任何客服、任何审批——从你的手，直接到对方的手。这就是点对点。"));
            ok.appendChild(okLine);
            wallet.appendChild(ok);
            var again = btn("gm-btn gm-ghost", "再来一笔");
            var row = el("div", "gm-wallet-row");
            row.appendChild(again);
            wallet.appendChild(row);
            again.addEventListener("click", function () {
              state.height++;
              go(0);
            });
          }
        }, reducedMotion ? 60 : 700);
        timers.push(iv);
      }, 2600);
    }

    render();
  }

  /* ================= 8. 活的区块链（首页 hero 动态链） =================
     四个已封存区块 + 一个打包中的虚线区块 + 一撮 mempool 待办转账。
     每隔约 2 秒装入一笔转账，装满即封存、链条前进——挖矿的具像化。
     悬停/点按任何元素可看内部信息。 */

  var CHAIN_TXS = [
    { e: "☕", t: "小明 → 街角咖啡店", a: "0.0001 ₿" },
    { e: "💼", t: "老板 → 全体工资", a: "0.31 ₿" },
    { e: "🐋", t: "鲸鱼 → 冷钱包归集", a: "120 ₿" },
    { e: "🌉", t: "马尼拉 → 老家汇款", a: "0.02 ₿" },
    { e: "🏪", t: "网店 → 供货商结算", a: "0.8 ₿" },
    { e: "🎁", t: "爷爷 → 孙子的压岁钱", a: "0.05 ₿" },
    { e: "📦", t: "交易所 → 用户提币", a: "2.4 ₿" },
    { e: "🛠", t: "DAO → 开发者报酬", a: "0.6 ₿" }
  ];

  function chainPickTx() {
    var t = CHAIN_TXS[Math.floor(Math.random() * CHAIN_TXS.length)];
    return { e: t.e, t: t.t, a: t.a, fee: (1 + Math.floor(Math.random() * 24)) + " sat/vB" };
  }

  function createChain(root) {
    root.classList.remove("gm-box");
    root.innerHTML = "";
    root.classList.add("gm-chain-root");

    var height = 905400 + Math.floor(Math.random() * 300);
    var sealed = [];
    for (var i = 0; i < 4; i++) {
      var txs = [];
      var n = 2 + Math.floor(Math.random() * 3);
      for (var j = 0; j < n; j++) txs.push(chainPickTx());
      sealed.push({ height: height - 3 + i, txs: txs });
    }
    var mining = { height: height + 1, txs: [chainPickTx()] };
    var mempoolN = 5;

    var row = el("div", "gm-chain");
    root.appendChild(row);
    var tip = el("div", "gm-chain-tip");
    tip.hidden = true;
    root.appendChild(tip);
    var pinned = null; /* 点按固定的目标（触屏） */

    function dotEl(k) { return el("span", "gm-tx-dot " + (k % 2 ? "alt" : "")); }

    function blockEl(b, miningFlag) {
      var d = btn("gm-chain-block" + (miningFlag ? " mining" : ""), "");
      for (var k = 0; k < b.txs.length; k++) d.appendChild(dotEl(k));
      d.setAttribute("aria-label", miningFlag ? "正在打包的区块" : "区块 #" + b.height);
      d.__info = { kind: miningFlag ? "mining" : "sealed", b: b };
      return d;
    }

    function tipHtml(info) {
      tip.innerHTML = "";
      if (info.kind === "mempool") {
        tip.appendChild(el("p", "gm-chain-tip-head", "内存池 Mempool"));
        tip.appendChild(el("p", null, mempoolN + " 笔转账正在排队，各自出着手续费的价。"));
        return;
      }
      var b = info.b;
      if (info.kind === "mining") {
        tip.appendChild(el("p", "gm-chain-tip-head", "区块 #" + fmt(b.height) + " · 打包中 " + b.txs.length + "/4"));
      } else {
        var confs = mining.height - b.height;
        tip.appendChild(el("p", "gm-chain-tip-head", "区块 #" + fmt(b.height) + " · ✓ 已封存 · 确认 " + confs));
      }
      for (var k = 0; k < b.txs.length; k++) {
        var t = b.txs[k];
        tip.appendChild(el("p", null, t.e + " " + t.t + " · " + t.a + " · 费率 " + t.fee));
      }
      tip.appendChild(el("p", "gm-chain-tip-foot",
        info.kind === "mining" ? "矿机正在寻找合格哈希……" : "后面每多一个区块，篡改它的成本就翻一倍。"));
    }

    function showTip(target) {
      tipHtml(target.__info);
      tip.hidden = false;
      var rb = root.getBoundingClientRect();
      var tb = target.getBoundingClientRect();
      var x = tb.left - rb.left + tb.width / 2;
      tip.style.left = Math.max(8, Math.min(x - tip.offsetWidth / 2, rb.width - tip.offsetWidth - 8)) + "px";
      tip.style.top = (tb.top - rb.top - tip.offsetHeight - 10) + "px";
    }

    function hideTip() { if (!pinned) tip.hidden = true; }

    function render() {
      row.innerHTML = "";
      for (var k = 0; k < sealed.length; k++) {
        row.appendChild(blockEl(sealed[k], false));
        row.appendChild(el("span", "gm-chain-link"));
      }
      var mb = blockEl(mining, true);
      row.appendChild(mb);
      row.appendChild(el("span", "gm-chain-link dashed"));
      var mp = btn("gm-mempool", "");
      for (var m = 0; m < mempoolN; m++) mp.appendChild(dotEl(m));
      mp.setAttribute("aria-label", "内存池：等待打包的转账");
      mp.__info = { kind: "mempool" };
      row.appendChild(mp);
      return mb;
    }

    var miningEl = render();

    row.addEventListener("mouseover", function (ev) {
      var t = ev.target.closest("[aria-label]");
      if (t && t.__info) { pinned = null; showTip(t); }
    });
    row.addEventListener("mouseout", hideTip);
    row.addEventListener("click", function (ev) {
      var t = ev.target.closest("[aria-label]");
      if (!t || !t.__info) return;
      if (pinned === t) { pinned = null; tip.hidden = true; }
      else { pinned = t; showTip(t); }
      ev.stopPropagation();
    });
    document.addEventListener("click", function () { pinned = null; tip.hidden = true; });

    function tick() {
      if (mining.txs.length < 4) {
        mining.txs.push(chainPickTx());
        if (mempoolN > 1) mempoolN--;
        miningEl = render();
        if (!reducedMotion) {
          var dots = miningEl.querySelectorAll(".gm-tx-dot");
          if (dots.length) dots[dots.length - 1].classList.add("pop");
        }
      } else {
        /* 封存：链条前进一格 */
        sealed.push(mining);
        sealed.shift();
        mining = { height: mining.height + 1, txs: [] };
        mempoolN = 4 + Math.floor(Math.random() * 3);
        miningEl = render();
        var just = row.querySelectorAll(".gm-chain-block")[3];
        if (just) just.classList.add("just-sealed");
      }
      if (pinned) { pinned = null; tip.hidden = true; }
    }

    var timer = setInterval(tick, reducedMotion ? 4200 : 2300);
    return function () { clearInterval(timer); };
  }

  /* ================= 9. 双花问题（信任的难题 · 之一） ================= */

  function buildDoubleSpend(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "信任的难题 · 之一"));
    root.appendChild(el("p", "gm-title", "双花问题 Double Spending"));
    root.appendChild(el("p", "gm-desc", "数字的东西天生可以复制。一段可以被复制的“钱”，还能叫钱吗？中本聪要杀死的第一个敌人，就是 Ctrl+C。"));

    var stage = el("div");
    root.appendChild(stage);

    function btnRow() { return el("div", "gm-row"); }

    /* —— 第一幕：没有账本的世界 —— */
    function actOne() {
      stage.innerHTML = "";
      stage.appendChild(el("p", "gm-act", "第一幕 · 复制自由"));
      stage.appendChild(el("p", "gm-note", "这是你的一枚“数字硬币”——本质上是一个文件。"));
      var coins = el("div", "gm-ds-coins");
      coins.appendChild(coin());
      stage.appendChild(coins);
      var note = el("p", "gm-note", "");
      stage.appendChild(note);
      var row = btnRow();
      var dup = btn("gm-btn gm-ghost", "复制粘贴这枚币");
      var pay = btn("gm-btn", "用“同一枚”同时付款 →");
      row.appendChild(dup); row.appendChild(pay);
      stage.appendChild(row);

      var n = 1;
      dup.addEventListener("click", function () {
        if (n >= 14) return;
        n++;
        coins.appendChild(coin());
        note.textContent = "复制不要钱。若它可以复制，每一枚的价值 → " + fmt(100 / n, 1) + "%。它的稀缺性正在蒸发。";
      });
      pay.addEventListener("click", actTwo);
    }

    /* —— 第二幕：双花成功 = 货币死亡 —— */
    function actTwo() {
      stage.innerHTML = "";
      stage.appendChild(el("p", "gm-act", "第二幕 · 双花成功 = 货币死亡"));
      stage.appendChild(el("p", "gm-note", "你把“同一枚币”的文件，同时发给了两个人："));
      var recv = el("div", "gm-ds-recv");
      var a = el("div", "gm-ds-card"); a.innerHTML = "🙋‍♀️ 小红<br><span class='state'>收到文件，验证为真 ✓</span>";
      var b = el("div", "gm-ds-card"); b.innerHTML = "🙋 小刚<br><span class='state'>收到文件，验证为真 ✓</span>";
      recv.appendChild(a); recv.appendChild(b);
      stage.appendChild(recv);
      setTimeout(function () { a.classList.add("got"); }, reducedMotion ? 0 : 250);
      setTimeout(function () { b.classList.add("got"); }, reducedMotion ? 0 : 550);
      stage.appendChild(el("p", "gm-note", "两人各自检查文件——都是真的，于是都收下了。两笔支付同时成立：这就是“双花”。一种能被花两次的钱，价值必然归零。在没有账本的世界里，这无法阻止。"));
      var row = btnRow();
      var go = btn("gm-btn", "进入账本的世界 →");
      row.appendChild(go);
      stage.appendChild(row);
      go.addEventListener("click", actThree);
    }

    /* —— 第三幕：账本的世界 —— */
    function actThree() {
      stage.innerHTML = "";
      stage.appendChild(el("p", "gm-act", "第三幕 · 账本的世界"));
      stage.appendChild(el("p", "gm-note", "现在，钱不再是文件——钱是这本公共账本上的一条记录："));
      var led = el("div", "gm-ds-ledger");
      led.appendChild(el("div", "ok", "区块 #1 ｜ 铸造 → 你：1 枚 ✓"));
      stage.appendChild(led);
      var row = btnRow();
      var p1 = btn("gm-btn", "付给小红");
      var p2 = btn("gm-btn gm-ghost", "再把“同一枚”付给小刚");
      p2.disabled = true;
      row.appendChild(p1); row.appendChild(p2);
      stage.appendChild(row);
      var tail = el("div");
      stage.appendChild(tail);

      p1.addEventListener("click", function () {
        if (p1.disabled) return;
        p1.disabled = true;
        led.appendChild(el("div", "ok", "区块 #2 ｜ 你 → 小红：1 枚 ✓（你的余额：0）"));
        p2.disabled = false;
      });
      p2.addEventListener("click", function () {
        if (p2.disabled) return;
        p2.disabled = true;
        var rej = el("div", "no", "区块 #✗ ｜ 你 → 小刚：1 枚 —— 被全网拒绝：账本显示你的余额为 0");
        led.appendChild(rej);
        if (!reducedMotion) { led.classList.add("gm-shake"); setTimeout(function () { led.classList.remove("gm-shake"); }, 450); }
        var v = el("div", "gm-verdict");
        v.appendChild(el("p", null, "看到了吗：钱不在文件里，钱在账本里。文件可以复制，但账本上的“先后顺序”无法复制——后到的那笔，自动作废。"));
        v.appendChild(el("p", null, "可是新的问题来了：这本账由谁来记？如果记账的人自己作弊呢？这就是下一个实验——拜占庭将军问题。"));
        var rs = btn("gm-btn gm-ghost", "重看一遍");
        rs.addEventListener("click", actOne);
        tail.appendChild(v);
        tail.appendChild(rs);
      });
    }

    actOne();
  }

  /* ================= 10. 拜占庭将军（信任的难题 · 之二） ================= */

  function buildByzantine(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "信任的难题 · 之二"));
    root.appendChild(el("p", "gm-title", "拜占庭将军问题"));
    root.appendChild(el("p", "gm-desc", "九路联军围城，必须同时进攻才能取胜。军中混着叛徒，信使可以撒谎、冒名。没有统帅，诚实的将军们怎么统一行动？我们分两幕看。"));

    var field = el("div", "gm-bz-field");
    var city = el("div", "gm-bz-city", "🏯");
    field.appendChild(city);
    var gens = [];
    for (var i = 0; i < 9; i++) {
      var g = el("span", "gm-bz-gen");
      var ang = (i / 9) * TAU - Math.PI / 2;
      g.style.left = (50 + 44 * Math.cos(ang)) + "%";
      g.style.top = (50 + 44 * Math.sin(ang)) + "%";
      field.appendChild(g);
      gens.push(g);
    }

    var actRow = el("div", "gm-row");
    var act1 = btn("gm-btn", "第一幕 · 谎言免费的世界");
    var act2 = btn("gm-btn gm-ghost", "第二幕 · 给说话定价（火漆印）");
    act2.disabled = true;
    actRow.appendChild(act1);
    actRow.appendChild(act2);
    root.appendChild(actRow);
    root.appendChild(field);

    var log = el("div", "gm-log");
    log.style.height = "auto";
    log.style.minHeight = "5.5em";
    log.textContent = "先点「第一幕」。";
    root.appendChild(log);
    var verdictBox = el("div");
    root.appendChild(verdictBox);

    var TCOUNT = 2;

    function reset() {
      verdictBox.innerHTML = "";
      city.classList.remove("fallen");
      gens.forEach(function (g) { g.className = "gm-bz-gen"; });
    }
    function pickTraitors() {
      var idx = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(function () { return Math.random() - 0.5; });
      return idx.slice(0, TCOUNT);
    }
    function logLines(lines) {
      log.innerHTML = "";
      lines.forEach(function (t, k) {
        var d = el("div", null, t);
        if (reducedMotion) log.appendChild(d);
        else setTimeout(function () { log.appendChild(d); }, 340 * k);
      });
    }

    function runAct1() {
      reset();
      var traitors = pickTraitors();
      var isT = function (k) { return traitors.indexOf(k) >= 0; };
      var atk = 0, rtr = 0;
      gens.forEach(function (g, k) {
        var attack = isT(k) ? Math.random() < 0.5 : Math.random() < 0.62;
        setTimeout(function () {
          g.classList.add(attack ? "attack" : "retreat");
          if (isT(k)) g.classList.add("traitor");
        }, reducedMotion ? 0 : 150 * k);
        if (attack) atk++; else rtr++;
      });
      logLines([
        "> 两名叛徒对不同的人说了不同的话（撒一个谎的成本：0）",
        "> 亮色＝收到「进攻」，暗色＝收到「后撤」——命令自相矛盾",
        "> 结果：进攻 " + atk + " 路、后撤 " + rtr + " 路——兵力不足，攻城失败",
        "> 关键：事前没人分得清谁是叛徒（虚线圈是事后揭晓）"
      ]);
      var v = el("div", "gm-verdict");
      v.appendChild(el("p", null, "败因不是诚实的人不够多，而是谎言和真话一样便宜——伪造零成本时，再多的诚实也拼不成一致。这道题悬了几十年。"));
      verdictBox.appendChild(v);
      act1.textContent = "第一幕 · 再看一遍";
      act2.disabled = false;
      act2.classList.remove("gm-ghost");
    }

    function runAct2() {
      reset();
      var traitors = pickTraitors();
      var isT = function (k) { return traitors.indexOf(k) >= 0; };
      gens.forEach(function (g, k) {
        setTimeout(function () {
          g.classList.add("attack");
          if (isT(k)) g.classList.add("traitor");
        }, reducedMotion ? 0 : 150 * k);
      });
      setTimeout(function () { city.classList.add("fallen"); }, reducedMotion ? 0 : 1600);
      logLines([
        "> 新规：每道军令必须附一枚「火漆印」，铸一枚要实打实烧一炷香",
        "> 叛徒只有 2/9 的铸印速度——假命令又慢又少，盖不过真命令",
        "> 所有人只认「火漆印最多的那串命令」，矛盾自动消失",
        "> 九路同时进攻——城破 ✓"
      ]);
      var v = el("div", "gm-verdict");
      v.appendChild(el("p", null, "把「说话」变贵，共识就从不可能变成必然。火漆印＝工作量证明；「印最多的那串命令」＝最长链。只要诚实的算力过半，账本就没法被谎言改写——这就是比特币每 10 分钟都在做的事。"));
      verdictBox.appendChild(v);
      act2.textContent = "第二幕 · 再看一遍";
    }

    act1.addEventListener("click", runAct1);
    act2.addEventListener("click", runAct2);
    root.appendChild(el("p", "gm-note faint", "极简化演示（叛徒固定 2/9）。若叛徒过半，「印最多的命令」也会撒谎——那就是「51% 攻击」。严格表述见 Lamport 等（1982）与比特币白皮书第 4 节。"));
  }

  /* ================= 11. 另一本账：美国国债实时钟 =================
     基线常数保证离线也走表（按近期增速外推）；
     美国财政部 Debt to the Penny API 可达时自动校准为官方口径。 */

  var DEBT_FALL_TS = Date.UTC(2026, 5, 1);    /* 2026-06-01 */
  var DEBT_FALL_AMT = 39.0e12;                /* 第四篇口径：39–40 万亿取保守端 */
  var DEBT_FALL_RATE = 80000;                 /* ≈ $2.5 万亿/年 */

  function createDebtClock(root) {
    root.classList.remove("gm-box");
    root.innerHTML = "";
    var slab = el("div", "gm-debt");
    root.appendChild(slab);
    slab.appendChild(el("p", "gm-debt-k", "美国联邦政府债务总额 · 实时"));
    var big = el("p", "gm-debt-n", "$ —");
    var sub = el("p", "gm-debt-sub");
    var rise = el("span", "rise", "");
    sub.appendChild(rise);
    var subTail = document.createTextNode("");
    sub.appendChild(subTail);
    var src = el("p", "gm-debt-src", "校准中——正在询问美国财政部……");
    var mirror = el("p", "gm-debt-mirror");
    mirror.appendChild(document.createTextNode("对面那本账的上限："));
    mirror.appendChild(coin());
    mirror.appendChild(document.createTextNode("21,000,000——写死的，谁也加不了一页。"));
    slab.appendChild(big);
    slab.appendChild(sub);
    slab.appendChild(src);
    slab.appendChild(mirror);

    var base = DEBT_FALL_AMT, baseTs = DEBT_FALL_TS, rate = DEBT_FALL_RATE;

    function render() {
      var v = base + rate * Math.max(0, (Date.now() - baseTs) / 1000);
      big.textContent = "$" + fmt(Math.floor(v));
      rise.textContent = "每一秒 +$" + fmt(Math.round(rate));
      subTail.nodeValue = " ｜ 摊到每个美国人头上 ≈ $" + fmt(Math.round(v / 341000000)) + " ｜ 国债利息已超过军费";
    }
    render();
    var iv = setInterval(render, reducedMotion ? 1000 : 150);

    if (typeof fetch === "function") {
      fetch("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=8&fields=record_date,tot_pub_debt_out_amt")
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (j) {
          var d = j && j.data;
          if (!d || d.length < 2) throw 0;
          var a = parseFloat(d[0].tot_pub_debt_out_amt);
          var b = parseFloat(d[d.length - 1].tot_pub_debt_out_amt);
          var ta = Date.parse(d[0].record_date), tb = Date.parse(d[d.length - 1].record_date);
          if (!(a > 1e13 && ta > tb)) throw 0;
          if (a > b) rate = (a - b) / ((ta - tb) / 1000);
          base = a; baseTs = ta;
          src.textContent = "已按官方数据校准 · 美国财政部 Debt to the Penny · 截至 " + d[0].record_date + "（此后为按近期增速外推）";
        })
        .catch(function () {
          src.textContent = "基线：2026-06 约 $39 万亿（财政部口径）· 此刻数字为按年增约 $2.5 万亿的外推——离线它也在涨，这正是问题本身。";
        });
    }
    return function () { clearInterval(iv); };
  }

  /* ================= 12. BTC Yield 计算器（金库 · 飞轮的数学） =================
     惊人的事实：增发一轮带来的每股含币变化，与币价无关——
     yield = (1 + d·m) / (1 + d) − 1，只由溢价 m 与稀释 d 决定。 */

  function createBtcYield(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "飞轮的数学 · 亲手拧一拧"));
    root.appendChild(el("p", "gm-title", "一轮增发，每股变重多少？"));
    root.appendChild(el("p", "gm-desc", "假设公司增发新股募资、并把募来的钱全部买成比特币。拖动两个旋钮，看老股东的每一股发生什么。"));

    var m = 1.8, d = 0.10;

    var row1 = el("div", "gm-row");
    row1.appendChild(el("label", null, "市场给的溢价 mNAV"));
    var sm = el("input", "gm-range");
    sm.type = "range"; sm.min = "0.8"; sm.max = "3"; sm.step = "0.05"; sm.value = String(m);
    sm.setAttribute("aria-label", "mNAV 溢价倍数");
    var vm = el("span", "gm-val", "1.80×");
    row1.appendChild(sm); row1.appendChild(vm);
    root.appendChild(row1);

    var row2 = el("div", "gm-row");
    row2.appendChild(el("label", null, "本轮增发稀释"));
    var sd = el("input", "gm-range");
    sd.type = "range"; sd.min = "0"; sd.max = "30"; sd.step = "1"; sd.value = "10";
    sd.setAttribute("aria-label", "增发稀释比例");
    var vd = el("span", "gm-val", "10%");
    row2.appendChild(sd); row2.appendChild(vd);
    root.appendChild(row2);

    var big = el("p", "gm-big", "");
    root.appendChild(big);

    var wrap = el("div", "gm-yield-wrap");
    var b1w = el("div", "gm-yield-bar"); var b1 = el("div", "fill"); b1w.appendChild(b1);
    var b2w = el("div", "gm-yield-bar"); var b2 = el("div", "fill"); b2w.appendChild(b2);
    var c1 = el("div", "gm-yield-col"); c1.appendChild(b1w); c1.appendChild(el("p", "gm-yield-lab", "增发前 · 每股含币"));
    var c2 = el("div", "gm-yield-col"); c2.appendChild(b2w); c2.appendChild(el("p", "gm-yield-lab", "增发后 · 每股含币"));
    wrap.appendChild(c1); wrap.appendChild(c2);
    root.appendChild(wrap);

    var note = el("p", "gm-note", "");
    root.appendChild(note);
    root.appendChild(el("p", "gm-note gm-tip", "注意这道算式里没有币价——飞轮的燃料是「溢价」，不是「涨价」。这正是 MSTR 把 BTC Yield 当 KPI 的原因：它衡量的是资本运作本身的功力，而非行情的运气。"));

    function upd() {
      m = parseFloat(sm.value); d = parseInt(sd.value, 10) / 100;
      vm.textContent = m.toFixed(2) + "×";
      vd.textContent = Math.round(d * 100) + "%";
      var y = d === 0 ? 0 : (1 + d * m) / (1 + d) - 1;
      big.textContent = "BTC Yield：" + (y >= 0 ? "+" : "") + (y * 100).toFixed(2) + "%";
      big.style.color = y > 0.0001 ? "var(--good)" : (y < -0.0001 ? "var(--bad)" : "var(--ink)");
      var base = 52, after = base * (1 + y);
      b1.style.height = base + "%";
      b2.style.height = Math.max(4, Math.min(96, after)) + "%";
      b2.style.background = y >= 0 ? "var(--good)" : "var(--bad)";
      if (d === 0) {
        note.textContent = "不增发，每股含币原地不动。拧动上面的旋钮试试。";
      } else if (m > 1.001) {
        note.textContent = "溢价 " + m.toFixed(2) + "× 之下，募来的钱买到的币多于新股的摊薄——老股东的每一股都变重了。只要市场愿意付溢价，每一次增发都是对老股东的馈赠。这就是飞轮的全部秘密。";
      } else if (m < 0.999) {
        note.textContent = "⚠ 警示：mNAV 低于 1 时增发，买回的币追不上股本摊薄——每股含币不升反降，飞轮反转成绞肉机。纪律严明的储备公司在折价时绝不增发。";
      } else {
        note.textContent = "mNAV = 1：增发不增不减，等于白忙——这就是 ETF 的世界，永远 1 : 1。";
      }
    }
    sm.addEventListener("input", upd);
    sd.addEventListener("input", upd);
    upd();
  }

  /* ---- 序幕接线：五个需要"先讲清你在干嘛"的游戏 ---- */
  function createTimeMachine(root) {
    gmIntro(root, "time-machine", [
      ["这是一台时间机器", "它只回答一个问题：你的钱，随时间去了哪里。"],
      ["左边是法币的世界", "拖动年份，看 100 美元还能买几条面包。"],
      ["右边是另一套系统", "一条永远锁死在 21,000,000 的线。"]
    ], function () { buildTimeMachine(root); });
  }

  function createPowMiner(root) {
    gmIntro(root, "pow-miner", [
      ["你即将成为一台矿机", "挖矿不是挖土——是亿万次地『猜』一个幸运数字。"],
      ["每点一下 = 真算 30 次 SHA-256", "目标：找到一个以 0 开头的哈希。找到，就铸出一个区块。"],
      ["这会消耗真实能量", "正因为作假必须把能量重烧一遍，账本才无法伪造。这就是『能量货币』。"]
    ], function () { buildPowMiner(root); });
  }

  function createMempool(root) {
    gmIntro(root, "mempool", [
      ["你现在是矿工", "面前是一座宽度固定的桥（区块），和一群想过桥的车（转账）。"],
      ["每辆车都出了运费", "桥装不下所有车——载谁先过？你说了算。"],
      ["装满后点『打包』", "看看你的直觉，和真实矿工的算法差多少。"]
    ], function () { buildMempool(root); });
  }

  function createDoubleSpend(root) {
    gmIntro(root, "double-spend", [
      ["先认识比特币的头号敌人", "数字的东西天生能复制——可钱，绝不能被复制。"],
      ["你将亲手『作恶』一次", "把同一枚币花给两个人，看没有账本的世界怎么崩塌。"],
      ["然后进入账本的世界", "看同样的把戏，如何被全网当场拒绝。"]
    ], function () { buildDoubleSpend(root); });
  }

  function createByzantine(root) {
    gmIntro(root, "byzantine", [
      ["九路大军围住一座城", "必须同时进攻才能赢——但军中有叛徒，信使还会撒谎。"],
      ["第一幕：谎言免费的世界", "先亲眼看共识怎么崩。"],
      ["第二幕：给说话定价", "再看一枚『火漆印』怎么让共识成为必然。"]
    ], function () { buildByzantine(root); });
  }

  /* ================= 13. registry + 启动 ================= */


  /* ================= 12.5 支付窗 · 闪电演习柜台 ================= */
  /* 纯演习：不产生任何真实发票，不可支付，不收真钱。
     教的是动作与体感：商家开票 → 钱包扫码 → 路由 → 秒级结清。 */
  function createLightningDemo(root) {
    var TICKETS = [
      { id: "chord", name: "弦纹馆票", price: 21, motto: "一根弦纹，三分留白" },
      { id: "genesis", name: "创世报纸票根", price: 121, motto: "The Times, 03/Jan/2009" },
      { id: "lantern", name: "提灯夜场票", price: 2100, motto: "灯下区块自苏醒" }
    ];
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    root.classList.add("gm-pay");
    var pick = node("div", "gm-pay-tickets");
    var stage = node("div", "gm-pay-stage");
    var hint = node("p", "gm-pay-note");
    hint.textContent = "选一张馆票，体验一遍闪电支付的完整动作。演习柜台不收真钱——这里练的是手感，不是花销。";
    root.appendChild(pick);
    root.appendChild(hint);
    root.appendChild(stage);

    function node(tag, cls, text) {
      var el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text !== undefined) el.textContent = text;
      return el;
    }

    function fakeInvoice(t) {
      var chars = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
      var body = "";
      for (var i = 0; i < 88; i++) body += chars[(Math.random() * chars.length) | 0];
      return "lnbc" + t.price + "n1p" + body + "（演习样张 · 不可支付）";
    }

    function serial() {
      var d = new Date();
      var ymd = String(d.getFullYear()).slice(2) + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
      return "HKB-" + ymd + "-" + String((Math.random() * 9000 + 1000) | 0);
    }

    function clearStage() {
      timers.forEach(clearTimeout);
      timers = [];
      stage.innerHTML = "";
    }

    function showInvoice(t) {
      clearStage();
      var inv = node("div", "gm-pay-inv");
      inv.appendChild(node("p", "h", "闪电发票（演习） · LIGHTNING INVOICE"));
      inv.appendChild(node("p", "amt", t.price.toLocaleString() + " 聪"));
      inv.appendChild(node("p", "memo", "备注：胡侃比特 · " + t.name + " ｜ 真实流程里，这一步是商家先开票"));
      inv.appendChild(node("p", "raw", fakeInvoice(t)));
      var btn = node("button", "gm-act", "模拟扫码支付 ⚡");
      btn.type = "button";
      btn.addEventListener("click", function () { payFlow(t, btn); });
      var note = node("p", "gm-pay-note", "发票（invoice）是一张「收款二维码 + 金额 + 备注」的打包。你的钱包扫它，而不是它扫你。");
      stage.appendChild(inv);
      stage.appendChild(btn);
      stage.appendChild(note);
    }

    function payFlow(t, btn) {
      btn.disabled = true;
      var route = node("div", "gm-pay-route");
      route.appendChild(node("span", "", "你的钱包"));
      var hops = [];
      for (var i = 0; i < 3; i++) {
        route.appendChild(node("span", "gm-pay-link"));
        var h = node("span", "gm-pay-hop");
        hops.push(h);
        route.appendChild(h);
      }
      route.appendChild(node("span", "gm-pay-link"));
      route.appendChild(node("span", "", "本馆节点"));
      stage.appendChild(route);
      hops.forEach(function (h, i) { later(function () { h.classList.add("lit"); }, 280 + i * 320); });
      later(function () {
        var done = node("p", "gm-pay-done", "✓ 已结清 · 用时 1.2 秒 · 路由费不到 1 聪");
        stage.appendChild(done);
        later(function () { showTicket(t); }, 600);
      }, 1340);
    }

    function showTicket(t) {
      var sn = serial();
      var tk = node("div", "gm-ticket");
      tk.appendChild(node("p", "tk-k", "胡侃比特 · 馆票 · ADMIT ONE"));
      tk.appendChild(node("p", "tk-n", t.name));
      tk.appendChild(node("p", "tk-m", "“" + t.motto + "”"));
      tk.appendChild(node("p", "tk-s", sn + " · " + t.price.toLocaleString() + " sats"));
      tk.appendChild(node("p", "tk-d", new Date().toLocaleDateString("zh-CN") + " · 凭此票可在记忆里随时入馆"));
      tk.appendChild(node("span", "tk-w", "演 习"));
      stage.appendChild(tk);
      var note = node("p", "gm-pay-note",
        "刚才发生的事，在真实闪电网络上一模一样：开票、扫码、几跳路由、秒级结清、手续费几乎为零。" +
        "唯一的区别是——真窗开张那天，柜台后面要先站着律师和牌照。");
      stage.appendChild(note);
      try { localStorage.setItem("hkb-pay-demo", sn); } catch (e) { /* 忽略 */ }
    }

    TICKETS.forEach(function (t) {
      var b = node("button", "gm-pay-t");
      b.type = "button";
      b.appendChild(node("span", "n", t.name));
      b.appendChild(node("span", "p", t.price.toLocaleString() + " 聪（演习币）"));
      b.appendChild(node("span", "m", t.motto));
      b.addEventListener("click", function () {
        var sib = pick.querySelectorAll(".gm-pay-t");
        for (var i = 0; i < sib.length; i++) sib[i].classList.remove("sel");
        b.classList.add("sel");
        showInvoice(t);
      });
      pick.appendChild(b);
    });

    return function destroy() { timers.forEach(clearTimeout); };
  }

  /* ================= 14. 2026-07 大改版新增八件套 ================= */
  /* 约定不变：工厂函数 + 闭包 DOM + 可选 destroy。
     其中 block-explorer 是全库唯一允许 fetch 的组件（失败静默降级为快照数据）。 */

  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function svgText(x, y, cls, str, anchor) {
    var t = svgEl("text", { x: x, y: y, "class": cls });
    if (anchor) t.setAttribute("text-anchor", anchor);
    t.textContent = str;
    return t;
  }
  /* 通用滑杆行：label + range + 读数 */
  function ctlRow(label, min, max, step, value) {
    var row = el("div", "gm-ctl");
    row.appendChild(el("label", "gm-ctl-lab", label));
    var input = document.createElement("input");
    input.type = "range"; input.min = min; input.max = max; input.step = step; input.value = value;
    row.appendChild(input);
    var val = el("span", "gm-ctl-val");
    row.appendChild(val);
    return { row: row, input: input, val: val };
  }

  /* ---- 14.1 复利侵蚀模拟器（第一篇 · 替换静态表格）---- */
  function createCompoundDecay(root) {
    root.classList.add("gm-inline");
    root.appendChild(el("p", "gm-cd-head", "亲手拨一拨：通胀这台复利机器，怎么吃你的存款"));
    var c1 = ctlRow("存款本金", 10, 1000, 10, 100);
    var c2 = ctlRow("年通胀率", 0, 15, 0.5, 2);
    var c3 = ctlRow("经过年数", 1, 50, 1, 30);
    var big = el("p", "gm-cd-big");
    var note = el("p", "gm-cd-note");
    var chart = svgEl("svg", { viewBox: "0 0 560 150", "class": "gm-cd-chart", "aria-hidden": "true" });
    root.appendChild(c1.row); root.appendChild(c2.row); root.appendChild(c3.row);
    root.appendChild(big); root.appendChild(note); root.appendChild(chart);
    function upd() {
      var P = +c1.input.value, r = +c2.input.value / 100, n = +c3.input.value;
      c1.val.textContent = fmt(P) + " 万";
      c2.val.textContent = (+c2.input.value).toFixed(1).replace(/\.0$/, "") + "%";
      c3.val.textContent = n + " 年";
      var real = P / Math.pow(1 + r, n);
      big.textContent = "还剩 " + fmt(real, real < 10 ? 1 : 0) + " 万的购买力";
      var lost = Math.round((1 - real / P) * 100);
      note.textContent = r === 0
        ? "通胀为零的世界——购买力纹丝不动。可这样的世界，法币史上并不存在。"
        : "名义上它还是 " + fmt(P) + " 万，一分没少；但能买到的东西，蒸发了 " + lost + "%。每年只有 " + c2.val.textContent + "，" + n + " 年复利下来，就是这个数。";
      while (chart.firstChild) chart.removeChild(chart.firstChild);
      var w = 560, h = 150, pad = 10;
      chart.appendChild(svgEl("path", { d: "M" + pad + " " + (h - pad) + "H" + (w - pad), "class": "gm-cd-axis" }));
      chart.appendChild(svgEl("path", { d: "M" + pad + " " + pad + "H" + (w - pad), "class": "gm-cd-dash" }));
      var pts = [];
      for (var y = 0; y <= n; y++) {
        var v = P / Math.pow(1 + r, y);
        pts.push((pad + (w - 2 * pad) * y / n).toFixed(1) + " " + (h - pad - (h - 2 * pad) * (v / P)).toFixed(1));
      }
      chart.appendChild(svgEl("path", { d: "M" + pts.join("L"), "class": "gm-cd-line" }));
      var last = pts[pts.length - 1].split(" ");
      chart.appendChild(svgEl("circle", { cx: last[0], cy: last[1], r: 3.4, "class": "gm-cd-dot" }));
      chart.appendChild(svgText(pad, pad - 2 < 8 ? 9 : pad - 2, "gm-cd-lbl", "今天的购买力"));
    }
    c1.input.addEventListener("input", upd);
    c2.input.addEventListener("input", upd);
    c3.input.addEventListener("input", upd);
    upd();
  }

  /* ---- 14.2 价值的语言（第一篇 · 货币作为语言）---- */
  function createValueLang(root) {
    root.classList.add("gm-inline");
    root.appendChild(el("p", "gm-vl-head", "两次握手：先对上语言，再对上「价值的语言」"));
    var wrap = el("div", "gm-vl-wrap");
    root.appendChild(wrap);
    function panel(title, options, judge) {
      var p = el("div", "gm-vl-panel");
      p.appendChild(el("p", "gm-vl-t", title));
      var row = el("div", "gm-vl-row");
      var out = el("p", "gm-vl-out", "——点一个试试");
      options.forEach(function (o) {
        var b = btn("gm-btn gm-ghost gm-vl-opt", o);
        b.addEventListener("click", function () {
          var sib = row.querySelectorAll(".gm-vl-opt");
          for (var i = 0; i < sib.length; i++) sib[i].classList.remove("sel");
          b.classList.add("sel");
          var r = judge(o);
          out.textContent = r[1];
          out.classList.toggle("ok", r[0]);
          out.classList.toggle("no", !r[0]);
        });
        row.appendChild(b);
      });
      p.appendChild(row); p.appendChild(out);
      wrap.appendChild(p);
    }
    panel("① 在纽约街头向人问路，你开口说——", ["你好", "Hello"], function (o) {
      return o === "Hello"
        ? [true, "对方笑着给你指了路。语言对上了，交流才成立。"]
        : [false, "对方一脸茫然地走开了。不是你说错了什么——是你们不共享同一门语言。"];
    });
    panel("② 在同一条街买咖啡，你递出的是——", ["美元", "津巴布韦币"], function (o) {
      return o === "美元"
        ? [true, "成交。店员收钱、递咖啡——你们说的是同一门「价值的语言」。"]
        : [false, "店员摆手拒收。哪怕你带来几千亿，也买不走一杯咖啡——共识不在，钱就只是纸。"];
    });
    root.appendChild(el("p", "gm-vl-note", "货币的本质是语言：说的人和听的人都认，价值才开得了口。"));
  }

  /* ---- 14.3 两把尺子（第二篇 · 米恒定 vs 米缩水）---- */
  function createTwoRulers(root) {
    root.classList.add("gm-inline");
    root.appendChild(el("p", "gm-rl-head", "同一张 3 米的沙发——拖动月份，亲手量一遍"));
    var ctl = ctlRow("月份", 1, 12, 1, 1);
    root.appendChild(ctl.row);
    var wrap = el("div", "gm-rl-wrap");
    root.appendChild(wrap);
    function makeWorld(title) {
      var p = el("div", "gm-rl-panel");
      p.appendChild(el("p", "gm-rl-t", title));
      var svg = svgEl("svg", { viewBox: "0 0 260 118", "class": "gm-rl-svg", "aria-hidden": "true" });
      p.appendChild(svg);
      var read = el("p", "gm-rl-read");
      p.appendChild(read);
      wrap.appendChild(p);
      return { svg: svg, read: read };
    }
    var wA = makeWorld("米恒定的世界");
    var wB = makeWorld("米缩水的世界");
    var payoff = el("div", "gm-rl-payoff");
    root.appendChild(payoff);
    function drawWorld(w, cmPerM) {
      var svg = w.svg;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl("path", {
        "class": "gm-rl-sofa",
        d: "M32 60V44C32 38 40 38 40 44V52H220V44C220 38 228 38 228 44V60C228 66 220 66 219 63H41C40 66 32 66 32 60ZM41 52H219V60H41Z"
      }));
      var pxPerMeter = (188 / 3) * (100 / cmPerM);
      var y0 = 82;
      var g = svgEl("g", null);
      g.appendChild(svgEl("path", { d: "M32 " + y0 + "H228", "class": "gm-rl-bar" }));
      var m = 0, x = 32;
      while (x <= 228.5 && m < 40) {
        g.appendChild(svgEl("path", { d: "M" + x.toFixed(1) + " " + y0 + "v9", "class": "gm-rl-tick" }));
        g.appendChild(svgText(x.toFixed(1), y0 + 23, "gm-rl-num", String(m), "middle"));
        m += 1; x += pxPerMeter;
      }
      svg.appendChild(g);
      return 3 * cmPerM / 100;
    }
    function upd() {
      var mo = +ctl.input.value;
      ctl.val.textContent = mo + " 月";
      var cm = 100 + (mo - 1) * (100 / 11);
      drawWorld(wA, 100);
      wA.read.textContent = "沙发读数：3 米。一整年，纹丝不动。";
      var r = drawWorld(wB, cm);
      wB.read.textContent = mo === 1
        ? "沙发读数：3 米。现在两个世界还一样。"
        : "沙发读数：" + r.toFixed(1).replace(/\.0$/, "") + " 米——沙发没变，是尺子缩了。";
      if (mo === 12) showPayoff();
      else { payoff.classList.remove("show"); payoff.innerHTML = ""; }
    }
    function showPayoff() {
      if (payoff.classList.contains("show")) return;
      payoff.classList.add("show");
      payoff.innerHTML = "";
      payoff.appendChild(el("p", "gm-rl-t", "现在，把「米」换成「计价单位」——三把尺子摆在你面前："));
      [["法币尺", "fiat", "刻度年年变密：印钞随时稀释。你量出来的「涨」，一半是尺子在缩。"],
       ["黄金尺", "gold", "五千年基本恒定：每年只新挖约 1.5%——慢，但仍然在变。"],
       ["比特币尺", "btc", "刻度写死：2100 万，一格不多。人类第一把不会缩水的尺子。"]
      ].forEach(function (r) {
        var row = el("div", "gm-rl-rrow gm-rl-" + r[1]);
        row.appendChild(el("span", "gm-rl-rname", r[0]));
        var bar = el("span", "gm-rl-rbar");
        bar.appendChild(el("span", "gm-rl-rfill"));
        row.appendChild(bar);
        row.appendChild(el("span", "gm-rl-rnote", r[2]));
        payoff.appendChild(row);
      });
    }
    ctl.input.addEventListener("input", upd);
    upd();
  }

  /* ---- 14.4 MBS 切片工坊（第二篇 · 次贷危机）---- */
  function buildMbs(root) {
    var stage = el("div", "gm-mbs");
    root.appendChild(stage);
    stage.appendChild(el("p", "gm-mbs-note",
      "一桶混装房贷：多数人按时还款，混着约 5% 的定时炸弹。整桶直接卖，没人敢要——看华尔街怎么切。"));
    var bucket = el("div", "gm-mbs-bucket");
    for (var i = 0; i < 20; i++) bucket.appendChild(el("span", "gm-mbs-chip" + (i % 7 === 3 ? " risky" : "")));
    stage.appendChild(bucket);
    var act = btn("gm-btn", "开始切片（Tranching）→");
    stage.appendChild(act);
    var after = el("div", "gm-mbs-after");
    stage.appendChild(after);
    act.addEventListener("click", function () {
      act.disabled = true;
      bucket.classList.add("gone");
      act.classList.add("gone");
      buildTranches();
    });
    function buildTranches() {
      var rows = {};
      [["aaa", "顶层 AAA · 70%", "优先偿付 · 卖给养老金、保险公司"],
       ["bbb", "中层 BBB · 20%", "第二顺位 · 卖给对冲基金"],
       ["junk", "劣后层 · 10%", "最后偿付、收益超高 · 银行自留或卖给冒险家"]
      ].forEach(function (d) {
        var row = el("div", "gm-mbs-tr gm-mbs-" + d[0]);
        row.appendChild(el("span", "gm-mbs-tname", d[1]));
        var bar = el("span", "gm-mbs-bar");
        var fill = el("span", "gm-mbs-fill");
        bar.appendChild(fill);
        row.appendChild(bar);
        var state = el("span", "gm-mbs-state", "");
        row.appendChild(state);
        row.appendChild(el("span", "gm-mbs-tnote", d[2]));
        after.appendChild(row);
        rows[d[0]] = { fill: fill, row: row, state: state };
      });
      var stamp = el("div", "gm-mbs-stamp", "AAA");
      after.appendChild(stamp);
      requestAnimationFrame(function () { stamp.classList.add("on"); });
      after.appendChild(el("p", "gm-mbs-note",
        "评级机构盖章：顶层「和美国国债一样安全」。现在换你来做压力测试——把真实违约率往上调："));
      var ctl = ctlRow("实际违约率", 0, 40, 1, 5);
      after.appendChild(ctl.row);
      var verdict = el("p", "gm-mbs-verdict");
      after.appendChild(verdict);
      function set(r, frac) {
        r.fill.style.width = (frac * 100).toFixed(0) + "%";
        r.state.textContent = frac <= 0 ? "安好" : frac < 1 ? "受损 " + Math.round(frac * 100) + "%" : "穿仓";
        r.row.classList.toggle("dead", frac >= 1);
        r.row.classList.toggle("hurt", frac > 0 && frac < 1);
      }
      function upd() {
        var d = +ctl.input.value;
        ctl.val.textContent = d + "%";
        var loss = d;
        var j = Math.min(loss, 10); loss -= j;
        var b = Math.min(loss, 20); loss -= b;
        var a = Math.min(loss, 70);
        set(rows.junk, j / 10);
        set(rows.bbb, b / 20);
        set(rows.aaa, a / 70);
        verdict.textContent =
          d <= 5 ? "5% 上下：只有劣后层在流血——「安全垫」看起来在起作用。华尔街最爱给你看的就是这一格。" :
          d < 10 ? "劣后层快被吞光了。持有这层的人开始跳楼价甩卖。" :
          d < 15 ? "劣后清零，火烧到 BBB——对冲基金的仓位开始蒸发。" :
          d < 30 ? "BBB 大面积穿仓。「第二顺位」原来不是保险，是排队挨打的顺序。" :
          "火烧进了 AAA——「和国债一样安全」的养老金资产开始亏损。2008 年，走到这一格只用了几个月。";
      }
      ctl.input.addEventListener("input", upd);
      upd();
    }
  }
  function createMbs(root) {
    gmIntro(root, "mbs-tranche", [
      ["华尔街的炼金术", "把一桶谁都不敢买的房贷，变成 AAA 级「理财产品」。"],
      ["秘诀叫分级（Tranching）", "切成三层：谁先赔、谁后赔，排好队再分头卖掉。"],
      ["然后，你来当压力测试员", "亲手调高违约率，看每一层在几号塌方。"]
    ], function () { buildMbs(root); });
  }

  /* ---- 14.5 能量秤（第三篇 · 能量货币）---- */
  function createEnergyScale(root) {
    root.classList.add("gm-inline");
    root.appendChild(el("p", "gm-en-head", "一枚比特币，到底封存了多少能量？"));
    var big = el("p", "gm-en-big", "0");
    var unit = el("p", "gm-en-unit", "度电（kWh）");
    root.appendChild(big); root.appendChild(unit);
    var TARGET = 930000;
    var raf = null, ran = false;
    function run() {
      if (ran) return;
      ran = true;
      if (reducedMotion) { big.textContent = fmt(TARGET); return; }
      var t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / 2200);
        big.textContent = fmt(Math.round(TARGET * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    }
    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) {
        for (var i = 0; i < es.length; i++) {
          if (es[i].isIntersecting) { io.disconnect(); io = null; run(); break; }
        }
      }, { threshold: 0.35 });
      io.observe(root);
    } else run();
    var row = el("div", "gm-en-row");
    var out = el("p", "gm-en-out");
    root.appendChild(row); root.appendChild(out);
    [["北京全城", "整个北京市——地铁、工厂、写字楼、千万户人家——3.5 分钟的总用电。"],
     ["一户人家", "一个普通三口之家 300 多年的用电量（按年均约 2,800 度计）。你家要从清朝初年一直用到今天。"],
     ["电动车", "把一辆 60 度电池的电动车充满约 1.55 万次——续航加起来能绕地球开 150 圈。"],
     ["手机", "给手机充满约 6,000 万次。每天充一次，够你充 17 万年。"]
    ].forEach(function (c, i) {
      var b = btn("gm-btn gm-ghost gm-en-opt", c[0]);
      b.addEventListener("click", function () {
        var sib = row.querySelectorAll(".gm-en-opt");
        for (var j = 0; j < sib.length; j++) sib[j].classList.remove("sel");
        b.classList.add("sel");
        out.textContent = c[1];
      });
      row.appendChild(b);
      if (i === 0) { b.classList.add("sel"); out.textContent = c[1]; }
    });
    root.appendChild(el("p", "gm-en-foot",
      "≈93 万度：按 2026 年全网算力与主流矿机能效折算的量级示意。口径不同数字会有出入，但「大得吓人的一笔真实能量」这件事不会变——而这笔能量的代价，就是伪造一枚比特币的门票价。"));
    return function destroy() {
      if (io) io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }

  /* ---- 14.6 海关锁（第三篇 · 工作量证明）---- */
  function buildLock(root) {
    var timers = [];
    function tick(fn, ms) { var t = setInterval(fn, ms); timers.push(t); return t; }
    var wrap = el("div", "gm-lk-wrap");
    root.appendChild(wrap);
    var pa = el("div", "gm-lk-panel");
    pa.appendChild(el("p", "gm-lk-t", "行李箱上的 4 位海关锁"));
    var dials = el("div", "gm-lk-dials");
    var ds = [];
    for (var i = 0; i < 4; i++) { var d = el("span", "gm-lk-dial", "0"); ds.push(d); dials.appendChild(d); }
    pa.appendChild(dials);
    var st1 = el("p", "gm-lk-stat", "一共 10,000 种组合");
    pa.appendChild(st1);
    var go1 = btn("gm-btn", "让电脑硬试");
    pa.appendChild(go1);
    wrap.appendChild(pa);
    go1.addEventListener("click", function () {
      go1.disabled = true;
      dials.classList.remove("open");
      var target = 2000 + ((Math.random() * 8000) | 0);
      var n = 0;
      var t = tick(function () {
        n = Math.min(target, n + 460);
        var s = ("0000" + n).slice(-4);
        for (var i = 0; i < 4; i++) ds[i].textContent = s[i];
        st1.textContent = "已试 " + fmt(n) + " / 10,000";
        if (n >= target) {
          clearInterval(t);
          dials.classList.add("open");
          st1.textContent = "咔哒——第 " + fmt(target) + " 次试出来了，用时不到两秒。";
          go1.textContent = "再试一次";
          go1.disabled = false;
        }
      }, 55);
    });
    var pb = el("div", "gm-lk-panel gm-lk-bigp");
    pb.appendChild(el("p", "gm-lk-t", "比特币的海关锁：2²⁵⁶ 种组合"));
    var field = svgEl("svg", { viewBox: "0 0 260 110", "class": "gm-lk-field", "aria-hidden": "true" });
    for (var s = 0; s < 150; s++) {
      field.appendChild(svgEl("circle", {
        cx: (Math.random() * 252 + 4).toFixed(1),
        cy: (Math.random() * 102 + 4).toFixed(1),
        r: (Math.random() * 1.1 + 0.3).toFixed(2),
        "class": "gm-lk-star"
      }));
    }
    pb.appendChild(field);
    pb.appendChild(el("p", "gm-lk-stat", "≈ 1.16 × 10⁷⁷ —— 和可观测宇宙的原子数量同一量级"));
    var go2 = btn("gm-btn", "同一台电脑，接着试");
    pb.appendChild(go2);
    var out2 = el("p", "gm-lk-out");
    pb.appendChild(out2);
    wrap.appendChild(pb);
    go2.addEventListener("click", function () {
      go2.disabled = true;
      out2.textContent = "";
      var tries = 0;
      var t0 = Date.now();
      var t = tick(function () {
        tries += 4980000;
        var pct = tries / 1.16e77 * 100;
        out2.innerHTML = "已试 " + fmt(tries) + " 次<br>进度：" + pct.toExponential(1) + "%——进度条动都没动。";
        if (Date.now() - t0 > 5200) {
          clearInterval(t);
          out2.innerHTML = "电脑认输了。就算把全球全部算力借给你（每秒上万亿亿次），平均也要 10⁴⁹ 年量级才能撞开一把——宇宙年龄 138 亿年，在它面前约等于零。<br><b>「几乎不可能破解」不是修辞——是宇宙级的不可能。</b>";
          go2.textContent = "重试（结局不变）";
          go2.disabled = false;
        }
      }, 110);
    });
    root.appendChild(el("p", "gm-lk-foot",
      "说明：挖矿「破解」的不是谁的钱包，而是给新区块找一个合格指纹——难度大到只能亿万次地试，谁先试中，谁获得记账权和奖励。"));
    root.__lkTimers = timers;
  }
  function createLock(root) {
    gmIntro(root, "customs-lock", [
      ["先开一把小锁", "行李箱的 4 位密码锁：一共一万种组合，电脑几秒就能硬试出来。"],
      ["再看比特币这把", "组合数是 2 的 256 次方——写出来是 78 位数。"],
      ["亲手试一试", "同一台电脑对着它试到宇宙尽头，进度条都不会动一格。"]
    ], function () { buildLock(root); });
    return function destroy() {
      if (root.__lkTimers) { root.__lkTimers.forEach(clearInterval); root.__lkTimers = null; }
    };
  }

  /* ---- 14.7 稀缺性图表（第三篇 · 永远 2100 万）---- */
  function createScarcityChart(root) {
    root.classList.add("gm-inline");
    root.appendChild(el("p", "gm-sc-head", "同一段历史，两把尺子——切换计价单位，再看一遍"));
    var seg = el("div", "gm-sc-seg");
    var bF = btn("gm-btn gm-ghost gm-sc-tab sel", "用法币量（2013 = 100）");
    var bB = btn("gm-btn gm-ghost gm-sc-tab", "用比特币量（枚）");
    seg.appendChild(bF); seg.appendChild(bB);
    root.appendChild(seg);
    var chart = svgEl("svg", { viewBox: "0 0 560 270", "class": "gm-sc-chart", "aria-hidden": "true" });
    root.appendChild(chart);
    var cap = el("p", "gm-sc-cap");
    root.appendChild(cap);
    root.appendChild(el("p", "gm-sc-foot",
      "数据为约值：币价取各年年末，美元购买力按美国 CPI 递减，北京房价为同一套房的挂牌指数化示意。正文里「1.5 万枚」取的是 2013 年年中约 $100 的时点，图中 2013 年取年末 $754。纵轴为对数刻度。"));
    var YEARS = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    var USD = [100, 98, 98, 97, 95, 93, 91, 90, 85, 79, 76, 73, 72];
    var HOUSE = [100, 108, 122, 148, 170, 176, 180, 184, 190, 181, 172, 168, 165];
    var BTC = [100, 42, 57, 128, 1878, 496, 954, 3846, 6142, 2195, 5606, 12391, 13263];
    var HOUSE_BTC = [1868, 4402, 3277, 1463, 100, 376, 196, 49, 30, 85, 33, 15, 14];
    var W = 560, H = 270, PL = 46, PR = 96, PT = 18, PB = 30;
    function draw(mode) {
      while (chart.firstChild) chart.removeChild(chart.firstChild);
      var series = mode === "fiat"
        ? [["美元购买力", USD, "gm-sc-usd"], ["北京同一套房", HOUSE, "gm-sc-house"], ["比特币", BTC, "gm-sc-btc"]]
        : [["同一套房要多少枚", HOUSE_BTC, "gm-sc-hbtc"]];
      var all = [];
      series.forEach(function (s) { all = all.concat(s[1]); });
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
      var llo = Math.log10(lo) - 0.08, lhi = Math.log10(hi) + 0.08;
      function X(i) { return PL + (W - PL - PR) * i / (YEARS.length - 1); }
      function Y(v) { return H - PB - (H - PT - PB) * (Math.log10(v) - llo) / (lhi - llo); }
      [1, 10, 100, 1000, 10000].forEach(function (g) {
        if (g < lo / 1.6 || g > hi * 1.6) return;
        chart.appendChild(svgEl("path", { d: "M" + PL + " " + Y(g).toFixed(1) + "H" + (W - PR), "class": "gm-sc-grid" }));
        chart.appendChild(svgText(PL - 6, Y(g) + 3.5, "gm-sc-glbl", fmt(g), "end"));
      });
      [2013, 2017, 2021, 2025].forEach(function (yr) {
        chart.appendChild(svgText(X(YEARS.indexOf(yr)), H - PB + 16, "gm-sc-glbl", String(yr), "middle"));
      });
      series.forEach(function (s) {
        var d = s[1].map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join("");
        chart.appendChild(svgEl("path", { d: d, "class": "gm-sc-line " + s[2] }));
        var lx = X(s[1].length - 1), ly = Y(s[1][s[1].length - 1]);
        chart.appendChild(svgEl("circle", { cx: lx.toFixed(1), cy: ly.toFixed(1), r: 3, "class": "gm-sc-dot " + s[2] }));
        chart.appendChild(svgText(lx + 7, ly + 3.5, "gm-sc-lbl " + s[2], s[0] + " " + fmt(s[1][s[1].length - 1])));
      });
      cap.textContent = mode === "fiat"
        ? "用法币量：美元购买力悄悄跌到 72，房子「涨」到 165，比特币涨到 13,263——三条线，其实是同一根尺子在缩水。"
        : "换比特币量，故事翻了个面：同一套北京房子，从 1,868 枚一路跌到 14 枚。房子没变，钱变了。";
    }
    bF.addEventListener("click", function () { bF.classList.add("sel"); bB.classList.remove("sel"); draw("fiat"); });
    bB.addEventListener("click", function () { bB.classList.add("sel"); bF.classList.remove("sel"); draw("btc"); });
    draw("fiat");
  }

  /* ---- 14.8 迷你区块浏览器（第三篇 · 比特币账本）——全库唯一 fetch ---- */
  function createBlockExplorer(root) {
    var head = el("div", "gm-xp-head");
    head.appendChild(el("p", "gm-xp-t", "真实的账本，正在你眼前生长"));
    var badge = el("span", "gm-xp-badge", "连接账本中…");
    head.appendChild(badge);
    root.appendChild(head);
    var strip = el("div", "gm-xp-strip");
    root.appendChild(strip);
    root.appendChild(el("p", "gm-xp-note",
      "每张卡片都是一个真实区块（纸箱）：编号是它在链上的高度，链环表示每个区块都咬着上一个的哈希——这就是「区块链」三个字的全部含义。"));
    var link = el("p", "gm-xp-link");
    var a = document.createElement("a");
    a.href = "https://mempool.space/zh/";
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = "去完整的区块浏览器，看每一笔转账 →";
    link.appendChild(a);
    root.appendChild(link);
    var FALLBACK = [
      { height: 958927, id: "00000000000000000001337544431817e006be12b9bd437e071ddbb2a6eece26", timestamp: 1784578434, tx_count: 4067, size: 1589518 },
      { height: 958926, id: "0000000000000000000219da59eae4c86c64d4707b74fcb615fe52743157324b", timestamp: 1784576004, tx_count: 4250, size: 1621009 },
      { height: 958925, id: "00000000000000000001b0bb37ac83c1022a01db2e7e6e7217c71569cdb1f861", timestamp: 1784574967, tx_count: 4038, size: 1606490 },
      { height: 958924, id: "0000000000000000000080cdd7bb3d3d3ad8530ecdc62e908fad687d88add0e8", timestamp: 1784573647, tx_count: 3461, size: 1469633 },
      { height: 958923, id: "00000000000000000001e2272e8108d9023b54f8b5055e8c4361bcbbb8f0e0b1", timestamp: 1784573617, tx_count: 4030, size: 1627037 }
    ];
    function rel(ts) {
      var s = Math.max(0, (Date.now() / 1000 - ts) | 0);
      if (s < 90) return s + " 秒前";
      if (s < 5400) return Math.round(s / 60) + " 分钟前";
      if (s < 172800) return Math.round(s / 3600) + " 小时前";
      return new Date(ts * 1000).toLocaleDateString("zh-CN");
    }
    function render(blocks, live) {
      badge.textContent = live ? "实时 · mempool.space" : "离线 · 2026-07-20 真实快照";
      badge.classList.toggle("live", live);
      strip.innerHTML = "";
      var list = blocks.slice(0, 5).reverse();
      list.forEach(function (b, i) {
        if (i) strip.appendChild(el("span", "gm-xp-chain"));
        var card = el("div", "gm-xp-card" + (i === list.length - 1 ? " new" : ""));
        card.appendChild(el("p", "gm-xp-h", "#" + fmt(b.height)));
        card.appendChild(el("p", "gm-xp-row2", fmt(b.tx_count) + " 笔转账"));
        card.appendChild(el("p", "gm-xp-row2", (b.size / 1e6).toFixed(2) + " MB · " + rel(b.timestamp)));
        var hash = el("p", "gm-xp-hash", "…" + b.id.slice(-10));
        hash.title = b.id;
        card.appendChild(hash);
        if (i === list.length - 1) card.appendChild(el("span", "gm-xp-now", "最新"));
        strip.appendChild(card);
      });
    }
    var dead = false;
    var ctlr = typeof AbortController === "function" ? new AbortController() : null;
    var tmo = setTimeout(function () { if (ctlr) { try { ctlr.abort(); } catch (e) { /* 忽略 */ } } }, 4500);
    try {
      fetch("https://mempool.space/api/v1/blocks", ctlr ? { signal: ctlr.signal } : undefined)
        .then(function (r) { if (!r.ok) throw new Error("bad"); return r.json(); })
        .then(function (js) {
          clearTimeout(tmo);
          if (!dead && js && js.length) render(js, true);
        })
        .catch(function () {
          clearTimeout(tmo);
          if (!dead) render(FALLBACK, false);
        });
    } catch (e) {
      clearTimeout(tmo);
      render(FALLBACK, false);
    }
    return function destroy() {
      dead = true;
      clearTimeout(tmo);
      if (ctlr) { try { ctlr.abort(); } catch (e) { /* 忽略 */ } }
    };
  }

  var registry = {
    "time-machine": createTimeMachine,
    "pow-miner": createPowMiner,
    "mempool": createMempool,
    "bazi-calendar": createAlmanac,
    "btc-ticker": createTicker,
    "first-tx": createFirstTx,
    "chain": createChain,
    "double-spend": createDoubleSpend,
    "byzantine": createByzantine,
    "debt-clock": createDebtClock,
    "btc-yield": createBtcYield,
    "lightning-demo": createLightningDemo,
    "compound-decay": createCompoundDecay,
    "value-language": createValueLang,
    "two-rulers": createTwoRulers,
    "mbs-tranche": createMbs,
    "energy-scale": createEnergyScale,
    "customs-lock": createLock,
    "scarcity-chart": createScarcityChart,
    "block-explorer": createBlockExplorer
  };

  function boot() {
    var mounts = document.querySelectorAll("[data-game]");
    for (var i = 0; i < mounts.length; i++) {
      var mount = mounts[i];
      var factory = registry[mount.getAttribute("data-game")];
      if (!factory) continue;
      /* 重复初始化安全：先清理上一个实例的 rAF / interval */
      if (typeof mount.__gmDestroy === "function") {
        try { mount.__gmDestroy(); } catch (err) { /* 忽略 */ }
      }
      mount.innerHTML = ""; // 清掉 JS 不可用时的 fallback 文案
      mount.classList.add("gm-box");
      try {
        mount.__gmDestroy = factory(mount) || null;
      } catch (err) {
        mount.textContent = "（这个小游戏没能启动，但不影响阅读正文。）";
      }
    }
  }

  /* 价格小钟全站常驻：页面没放挂载点时，自动在右下角生一个 */
  function ensureTicker() {
    if (document.querySelector('[data-game="btc-ticker"]')) return;
    var slot = document.createElement("div");
    slot.className = "ticker-slot";
    slot.setAttribute("data-game", "btc-ticker");
    slot.setAttribute("data-gm-init", "1");
    document.body.appendChild(slot);
    createTicker(slot);
  }

  function bootAll() { boot(); ensureTicker(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAll);
  } else {
    bootAll(); // defer 脚本通常在 DOMContentLoaded 前执行，此分支兜底
  }
})();
