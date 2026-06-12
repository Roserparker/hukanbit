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
     - 纯 vanilla JS，单一 IIFE，无模块、无 fetch、无外部依赖
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

  function createTimeMachine(root) {
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

  function createPowMiner(root) {
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
      return foundHit;
    }

    function celebrate(hit, diff) {
      found = true;
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
      resultBox.appendChild(card);
      if (!reducedMotion) {
        panel.classList.remove("gm-flash");
        void panel.offsetWidth; // 重新触发动画
        panel.classList.add("gm-flash");
      }
      mineBtn.textContent = "继续挖下一块 ⛏";
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
    function manualStep() {
      if (autoOn) return;
      if (found) startNextBlock();
      clicks++;
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

  function createMempool(root) {
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
    var chg = el("span", "gm-tk-dim", "");
    box.appendChild(sym); box.appendChild(price); box.appendChild(sats); box.appendChild(chg);
    root.appendChild(box);

    function refresh() {
      fetchBtcUsd(function (res) {
        if (!res) {
          price.textContent = "实时价格暂不可用";
          price.className = "gm-tk-dim";
          sats.textContent = ""; chg.textContent = "";
          return;
        }
        price.textContent = "$" + fmt(res.usd);
        price.className = "";
        sats.textContent = "$1 ≈ " + fmt(Math.round(1e8 / res.usd)) + " 聪";
        sats.className = "gm-tk-dim";
        if (typeof res.chg === "number") {
          var up = res.chg >= 0;
          chg.textContent = "24h " + (up ? "+" : "−") + Math.abs(res.chg).toFixed(1) + "%";
          chg.className = up ? "gm-tk-up" : "gm-tk-down";
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

  function createDoubleSpend(root) {
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

  function createByzantine(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "信任的难题 · 之二"));
    root.appendChild(el("p", "gm-title", "拜占庭将军问题"));
    root.appendChild(el("p", "gm-desc", "九路联军围城，必须同时进攻才能取胜。军中混着叛徒，信使可以撒谎、冒名、对不同人说不同话。没有统帅，诚实的将军们如何达成一致？——这道难题悬了几十年，直到 2008 年。"));

    var row1 = el("div", "gm-row");
    var lab = el("label", null, "叛徒人数");
    var seg = el("span", "gm-seg");
    var tCount = 2;
    [0, 1, 2, 3, 4].forEach(function (k) {
      var b = btn(null, String(k));
      if (k === tCount) b.className = "gm-on";
      b.addEventListener("click", function () {
        tCount = k;
        seg.querySelectorAll("button").forEach(function (o) { o.className = ""; });
        b.className = "gm-on";
      });
      seg.appendChild(b);
    });
    var powBtn = btn("gm-btn gm-ghost", "火漆印：关");
    var pow = false;
    powBtn.addEventListener("click", function () {
      pow = !pow;
      powBtn.textContent = pow ? "火漆印：开 ✓" : "火漆印：关";
      powBtn.className = pow ? "gm-btn" : "gm-btn gm-ghost";
    });
    var go = btn("gm-btn", "传令 · 进攻");
    row1.appendChild(lab); row1.appendChild(seg); row1.appendChild(powBtn); row1.appendChild(go);
    root.appendChild(row1);
    root.appendChild(el("p", "gm-note gm-tip", "「火漆印」= 每道军令必须附一枚耗费真实时间才能铸出的印章（工作量证明）。开关它，看看世界有什么不同。"));

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
    root.appendChild(field);

    var log = el("div", "gm-log");
    log.style.height = "auto";
    log.style.minHeight = "5.5em";
    log.textContent = "调好叛徒人数，点「传令」。";
    root.appendChild(log);
    var verdictBox = el("div");
    root.appendChild(verdictBox);

    function logLines(lines) {
      log.innerHTML = "";
      lines.forEach(function (t, k) {
        var d = el("div", null, t);
        if (reducedMotion) log.appendChild(d);
        else setTimeout(function () { log.appendChild(d); }, 300 * k);
      });
    }

    function run() {
      verdictBox.innerHTML = "";
      city.classList.remove("fallen");
      gens.forEach(function (g) { g.className = "gm-bz-gen"; });

      var idx = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(function () { return Math.random() - 0.5; });
      var traitors = idx.slice(0, tCount);
      var isT = function (k) { return traitors.indexOf(k) >= 0; };

      if (!pow) {
        /* 谎言免费的世界：军令互相矛盾，诚实者分裂 */
        var atk = 0, rtr = 0;
        gens.forEach(function (g, k) {
          var attack = isT(k) ? Math.random() < 0.5 : Math.random() < 0.5 + 0.4 / (tCount + 1);
          setTimeout(function () {
            g.classList.add(attack ? "attack" : "retreat");
            if (isT(k)) g.classList.add("traitor");
          }, reducedMotion ? 0 : 150 * k);
          if (attack) atk++; else rtr++;
        });
        logLines([
          "> 叛徒向不同的人发出了不同的军令（伪造一条命令的成本：0）",
          "> 有人还冒用了忠诚将军的名义乱发消息",
          "> 结果：进攻 " + atk + " 路 · 后撤 " + rtr + " 路 —— 兵力不足，攻城失败",
          "> 虚线圈出的是叛徒——事前，你根本看不出来"
        ]);
        var v1 = el("div", "gm-verdict");
        v1.appendChild(el("p", null, "问题不在于诚实的人不够多，而在于谎言和真话一样便宜。只要伪造零成本，再多的诚实也汇不成一致。"));
        verdictBox.appendChild(v1);
      } else {
        /* 火漆印的世界：说话有成本，最长令链由诚实多数铸成 */
        gens.forEach(function (g, k) {
          setTimeout(function () {
            g.classList.add("attack");
            if (isT(k)) g.classList.add("traitor");
          }, reducedMotion ? 0 : 150 * k);
        });
        setTimeout(function () { city.classList.add("fallen"); }, reducedMotion ? 0 : 1600);
        var lines = [
          "> 新规生效：每道军令必须附「火漆印」——铸一枚要烧一炷香",
          "> 叛徒只有 " + tCount + "/9 的铸印能力，伪造的命令既慢又少",
          "> 诚实多数铸出了最长的那条令链，所有人只认它",
          "> 九路同时进攻 —— 城破 ✓"
        ];
        if (tCount >= 4) lines.push("> 警告：叛徒已达 4/9。一旦过半，最长链也会撒谎——这就是「51% 攻击」的含义。");
        logLines(lines);
        var v2 = el("div", "gm-verdict");
        v2.appendChild(el("p", null, "无须认识彼此，无须信任信使——只需跟随“耗费能量最多的那条链”。这就是中本聪给拜占庭将军们的答案，也是此刻全球几十万个比特币节点正在做的事。"));
        verdictBox.appendChild(v2);
      }
    }

    go.addEventListener("click", run);
    root.appendChild(el("p", "gm-note faint", "极简化演示。严格表述见 Lamport 等《拜占庭将军问题》（1982）与比特币白皮书第 4 节。"));
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

  /* ================= 12. registry + 启动 ================= */

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
    "debt-clock": createDebtClock
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot(); // defer 脚本通常在 DOMContentLoaded 前执行，此分支兜底
  }
})();
