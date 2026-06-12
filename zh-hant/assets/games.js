/* ============================================================
   胡侃比特 · 互動小遊戲（games.js）
   ------------------------------------------------------------
   結構：
     1. 公共工具：sha256Sync（純 JS，file:// 可用，移植自 lab.js）、
        數字格式化、DOM 小助手、reduced-motion 檢測
     2. createTimeMachine(root)  —— 遊戲一 · 購買力時光機
     3. createPowMiner(root)     —— 遊戲二 · 孤勇者礦工
     4. createMempool(root)      —— 遊戲三 · 內存池停車場
     5. registry + boot：DOMContentLoaded 後掃描 [data-game]，
        清空掛載點並渲染對應遊戲；重複初始化安全（先調用上一次
        實例返回的 destroy 清理 rAF / interval / 事件）。
   約定：
     - 純 vanilla JS，單一 IIFE，無模塊、無 fetch、無外部依賴
     - 組件內部一律使用閉包裏的 DOM 引用，不用 id 查找自己
     - 同一遊戲可在一頁中掛載多次（工廠函數，互不干擾）
   ============================================================ */
(function () {
  "use strict";

  /* ================= 1. 公共工具 ================= */

  /* ---- SHA-256（FIPS 180-4 純 JS 同步實現，與 lab.js 同源）---- */
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

  /* ---- 數字格式化（中文千分位習慣）---- */
  var TAU = Math.PI * 2;

  /* ---- 序幕引導：首次進入時用三句話講清"你將要做什麼" ----
     看過即記（localStorage），右上角 ❔ 可隨時重看。 */
  function gmIntro(root, name, steps, build) {
    var KEY = "hkb-intro-" + name;
    var seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch (e) { /* 忽略 */ }

    function start() {
      try { localStorage.setItem(KEY, "1"); } catch (e) { /* 忽略 */ }
      root.innerHTML = "";
      build();
      var rp = btn("gm-replay", "❔ 引導");
      rp.addEventListener("click", function () { show(0); });
      root.appendChild(rp);
    }

    function show(i) {
      root.innerHTML = "";
      var p = el("div", "gm-primer");
      p.appendChild(el("p", "gm-primer-step", "引導 " + (i + 1) + " / " + steps.length));
      p.appendChild(el("p", "gm-primer-big", steps[i][0]));
      if (steps[i][1]) p.appendChild(el("p", "gm-primer-sm", steps[i][1]));
      var row = el("div", "gm-row");
      row.style.justifyContent = "center";
      if (i < steps.length - 1) {
        var sk = btn("gm-btn gm-ghost", "跳過引導");
        sk.addEventListener("click", start);
        row.appendChild(sk);
        var nx = btn("gm-btn", "下一步 →");
        nx.addEventListener("click", function () { show(i + 1); });
        row.appendChild(nx);
      } else {
        var go = btn("gm-btn", "開始 ▶");
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

  /* ---- ₿ 鑄幣徽記：凡出現聰/比特幣金額處佩戴 ---- */
  function coin() {
    var c = el("span", "gm-coin");
    c.setAttribute("aria-hidden", "true");
    return c;
  }

  /* ---- reduced-motion：減少閃爍與大動畫 ---- */
  var reducedMotion = false;
  try {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", function (ev) { reducedMotion = ev.matches; });
    }
  } catch (e) { /* 舊環境忽略 */ }

  /* ---- 稀疏年份表的線性插值 ---- */
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

  /* ================= 2. 遊戲一 · 購買力時光機 ================= */

  /* 美國 CPI-U 年均近似值（依據美國 BLS，稀疏表 + 線性插值，數據爲約值） */
  var CPI_TABLE = [
    [1971, 40.5], [1975, 53.8], [1980, 82.4], [1985, 107.6], [1990, 130.7],
    [1995, 152.4], [2000, 172.2], [2005, 195.3], [2008, 215.3], [2010, 218.1],
    [2015, 237.0], [2020, 258.8], [2022, 292.7], [2024, 313.7], [2026, 327.0]
  ];

  /* 美元 M2 供應量近似值（萬億美元，稀疏表） */
  var M2_TABLE = [
    [1971, 0.7], [1980, 1.6], [1990, 3.3], [2000, 4.9], [2008, 8.2],
    [2015, 12.3], [2020, 19.1], [2022, 21.7], [2025, 21.5], [2026, 21.8]
  ];

  /* 年代註腳：關鍵年份史實 */
  var MILESTONES = [
    [1971, "尼克松宣佈美元與黃金脫鉤，紙幣從此失去錨定物——印多少，只看政策需要。"],
    [1980, "美國通脹率衝到 13.5%。把錢存銀行的人，眼睜睜看着購買力加速融化。"],
    [1999, "歐元誕生。又一種憑信用發行的紙幣加入這場遊戲，規則沒有變。"],
    [2008, "金融危機席捲全球，央行開閘救市。10 月 31 日，比特幣白皮書悄然發佈。"],
    [2009, "1 月 3 日，創世區塊誕生。2100 萬的上限，自此寫進代碼、交給數學。"],
    [2020, "應對疫情的“無限量化寬鬆”：美元 M2 一年膨脹約 25%，史無前例。"],
    [2024, "比特幣完成第四次減半，區塊獎勵降至 3.125 BTC——一切如 2009 年的時間表。"]
  ];

  var BREAD_1971 = 0.25; // 1971 年白麪包約 $0.25/條

  function breadPrice(year) {
    return BREAD_1971 * lerpTable(CPI_TABLE, year) / lerpTable(CPI_TABLE, 1971);
  }

  /* 按減半規則粗算某年年初已挖出的 BTC（近似：4 年一個獎勵期，期內線性） */
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
    var BREAD_ICONS = 40; // 每個 🍞 代表 10 條

    /* ---- 搭骨架 ---- */
    root.appendChild(el("p", "gm-kicker", "互動 · 購買力時光機"));
    root.appendChild(el("h3", "gm-title", "同樣的 100 美元，拖一下，看它還能買幾條麪包"));
    root.appendChild(el("p", "gm-desc", "拖動下面的年份滑塊，從 1971 年走到今天。左邊是美元的購買力，右邊是另一套系統的供給規則。"));

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
    slider.setAttribute("aria-label", "選擇年份，從 1971 到 2026");
    panel.appendChild(slider);

    var hint = el("p", "gm-note", "← 把滑塊往右拖，時間會替你說明一切。");
    panel.appendChild(hint);

    var cols = el("div", "gm-tm-cols");
    panel.appendChild(cols);

    /* 左列：麪包 */
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
    left.appendChild(el("p", "gm-block-caption", "每個 🍞 代表 10 條麪包（1971 年：400 條）"));

    var stats = el("div", "gm-stat-grid");
    var cellPP = el("div", "gm-cell");
    cellPP.appendChild(el("span", "gm-label", "購買力只剩"));
    var valPP = el("span", "gm-value");
    cellPP.appendChild(valPP);
    var cellM2 = el("div", "gm-cell");
    cellM2.appendChild(el("span", "gm-label", "同期美元 M2 供應量"));
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

    /* 右列：另一套系統 */
    var right = el("div");
    cols.appendChild(right);
    var capPanel = el("div", "gm-cap-panel");
    right.appendChild(capPanel);
    capPanel.appendChild(el("p", "gm-cap-title", "另一套系統"));

    var capBar = el("div", "gm-cap-bar");
    var capLock = el("div", "gm-cap-lock", "🔒 上限：21,000,000 BTC");
    capBar.appendChild(capLock);
    capPanel.appendChild(capBar);
    capPanel.appendChild(el("p", "gm-cap-note", "任何年份、任何人都無法更改這條上限。"));

    var minedWrap = el("div", "gm-mined-wrap");
    var minedBar = el("div", "gm-mined-bar");
    var minedFill = el("div", "gm-mined-fill");
    minedBar.appendChild(minedFill);
    minedWrap.appendChild(minedBar);
    var minedNote = el("p", "gm-cap-note");
    minedWrap.appendChild(minedNote);
    capPanel.appendChild(minedWrap);

    root.appendChild(el("p", "gm-foot", "數據爲約值，依據美國 BLS CPI 與美聯儲 M2 統計。教學收尾只有一句：法幣的購買力曲線由政策決定，比特幣的供給曲線由數學決定。"));

    /* ---- 渲染邏輯 ---- */
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
      breadBig.textContent = "還能買 " + fmt(loaves) + " 條";
      breadSub.textContent = "白麪包約 $" + price.toFixed(2) + "/條 · 1971 年這筆錢能買 400 條";

      var lit = Math.max(1, Math.round(loaves / 10));
      if (lit > BREAD_ICONS) lit = BREAD_ICONS;
      for (var k2 = 0; k2 < BREAD_ICONS; k2++) {
        breadCells[k2].classList.toggle("gm-dim", k2 >= lit);
      }

      var pp = lerpTable(CPI_TABLE, Y_MIN) / lerpTable(CPI_TABLE, y) * 100;
      valPP.textContent = fmt(pp, pp < 20 ? 1 : 0) + "%";
      var m2x = lerpTable(M2_TABLE, y) / lerpTable(M2_TABLE, Y_MIN);
      valM2.textContent = "約 ×" + fmt(m2x, m2x < 10 ? 1 : 0) + "（$" + fmt(lerpTable(M2_TABLE, y), 1) + " 萬億）";

      var ms = milestoneFor(y);
      msYear.textContent = ms[0] + " 年";
      msText.textContent = (ms[0] === y ? "" : "（最近的里程碑）") + ms[1];

      if (y < 2009) {
        minedFill.style.width = "0%";
        minedNote.textContent = "比特幣：（尚未誕生）——但上限已經註定，連它的創造者也改不了。";
      } else {
        var pct = btcIssuedAt(y) / 21000000 * 100;
        minedFill.style.width = pct.toFixed(1) + "%";
        minedNote.textContent = "至 " + y + " 年已挖出約 " + fmt(pct, 1) + "%，其餘仍按時間表鎖在未來的區塊裏。";
      }

      if (!dragged && y !== Y_MIN) {
        dragged = true;
        hint.textContent = "繼續拖。注意：沒有任何一年，麪包會變多。";
      }
    }

    slider.addEventListener("input", render);
    render();

    return function destroy() { /* 本遊戲無定時器，無需清理 */ };
  }

  /* ================= 3. 遊戲二 · 孤勇者礦工 ================= */

  function buildPowMiner(root) {
    var MANUAL_DIFF = 2;      // 手動模式固定難度：2 個前導 0
    var CLICK_BATCH = 30;     // 每次點擊執行的真實 SHA-256 次數
    var MAX_LOG_LINES = 30;   // 亂碼區最多保留的行數

    /* ---- 骨架 ---- */
    root.appendChild(el("p", "gm-kicker", "互動 · 孤勇者礦工"));
    root.appendChild(el("h3", "gm-title", "親手算一次哈希，理解什麼叫“工作量證明”"));
    root.appendChild(el("p", "gm-desc", "點擊按鈕，你的設備會真實地計算 SHA-256。目標：找到一個讓哈希以足夠多 0 開頭的 Nonce。沒有捷徑，只有一次次地試。"));

    var panel = el("div", "gm-panel");
    root.appendChild(panel);

    var mineBtn = btn("gm-mine-btn", "挖一下 ⛏", "執行一批哈希計算");
    panel.appendChild(mineBtn);
    panel.appendChild(el("p", "gm-block-caption", "按住可以連點 · 手動難度：哈希需以 2 個 0 開頭"));

    var ctrlRow = el("div", "gm-row");
    var autoBtn = btn("gm-switch", "開啓自動挖礦");
    autoBtn.setAttribute("aria-pressed", "false");
    ctrlRow.appendChild(autoBtn);
    var segLabel = el("label", null, "自動難度");
    ctrlRow.appendChild(segLabel);
    var seg = el("div", "gm-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "自動挖礦難度：前導 0 的個數");
    var segBtns = [];
    [2, 3, 4].forEach(function (d) {
      var b = btn(null, d + " 個 0");
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
    var valTries = statCell("累計嘗試");
    var valClicks = statCell("你點擊了");
    var valSpeed = statCell("算力");
    var valTime = statCell("本塊用時");
    valSpeed.textContent = "—";
    valTime.textContent = "0 秒";
    panel.appendChild(stats);

    /* ---- 能量對照：你的塵埃 vs 全網的城市 ---- */
    var emeter = el("div", "gm-energy");
    var eYou = el("p", "gm-energy-row");
    eYou.appendChild(el("span", "gm-energy-k", "你已燃燒"));
    var eYouV = el("span", "gm-energy-v", "0 mJ");
    eYou.appendChild(eYouV);
    var eYouNote = el("span", "gm-energy-n", "——還不夠點亮任何東西");
    eYou.appendChild(eYouNote);
    var eNet = el("p", "gm-energy-row");
    eNet.appendChild(el("span", "gm-energy-k", "全網同期"));
    var eNetV = el("span", "gm-energy-v net", "0 度電");
    eNet.appendChild(eNetV);
    eNet.appendChild(el("span", "gm-energy-n", "——功率約 200 億瓦，≈ 整個泰國的全國用電"));
    emeter.appendChild(eYou);
    emeter.appendChild(eNet);
    panel.appendChild(emeter);

    var energyJ = 0;
    var netT0 = performance.now();
    var NET_KWH_PER_S = 5556; /* ≈20GW 口徑 */
    function fmtEnergy(j) {
      return j < 1 ? (j * 1000).toFixed(0) + " mJ" : j.toFixed(2) + " J";
    }
    function energyNote(j) {
      if (j < 0.05) return "——還不夠點亮任何東西";
      if (j < 5) return "——夠一盞 LED 亮 " + (j / 0.05).toFixed(1) + " 秒";
      return "——夠手機亮屏 " + j.toFixed(0) + " 秒";
    }
    function updateEnergy() {
      eYouV.textContent = fmtEnergy(energyJ);
      eYouNote.textContent = energyNote(energyJ);
    }
    /* 全網電錶：自你打開此頁起，一座"國家"在替這本賬呼吸 */
    if (root.__netIv) clearInterval(root.__netIv);
    root.__netIv = setInterval(function () {
      var kwh = (performance.now() - netT0) / 1000 * NET_KWH_PER_S;
      eNetV.textContent = fmt(Math.round(kwh)) + " 度電";
    }, 1000);

    /* 每次點擊：一粒能量耗散的小數字 */
    var zapLive = 0;
    function spawnZap() {
      if (reducedMotion || zapLive >= 5) return;
      zapLive++;
      var z = el("span", "gm-zap", "−12 mJ ⚡");
      mineBtn.parentNode.appendChild(z);
      setTimeout(function () { zapLive--; if (z.parentNode) z.parentNode.removeChild(z); }, 800);
    }

    var log = el("div", "gm-log");
    log.setAttribute("aria-hidden", "true"); // 純展示的亂碼流，對讀屏器靜默
    panel.appendChild(log);

    var resultBox = el("div");
    resultBox.setAttribute("role", "status");
    panel.appendChild(resultBox);

    root.appendChild(el("p", "gm-foot", "你剛剛消耗了真實的時間與能量，換來一條誰都無法僞造的記錄——這就是工作量證明：用物理世界的成本，爲數字世界的賬本背書。"));

    /* ---- 狀態 ---- */
    var blockHeight = 1;
    var prevHash = "0000000000000000";
    var nonce = 0;            // 當前塊內的 nonce
    var blockTries = 0;       // 當前塊嘗試次數
    var totalTries = 0;       // 累計嘗試次數
    var clicks = 0;
    var blockT0 = 0;          // 當前塊開始時間
    var found = false;        // 當前塊是否已挖到
    var autoOn = false;
    var autoDiff = 3;
    var rafId = 0;
    var holdTimer = 0, holdInterval = 0, holdFired = false;
    var autoResume = 0;
    var speedWinT = 0, speedWinN = 0; // 算力統計窗口
    var destroyed = false;

    function blockData() {
      return "胡侃比特·教學區塊#" + blockHeight + "|prev:" + prevHash.slice(0, 12) + "|tx:老周→小胡 0.42 BTC|nonce:";
    }

    function burn(count) {
      energyJ += count * 0.0004; /* 約 0.4 mJ/次（移動端 JS 哈希量級） */
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

    /* 執行一批哈希；返回找到的 {n, h} 或 null */
    function runBatch(size, diff, sampleEvery) {
      if (!blockT0) blockT0 = performance.now();
      var target = "0".repeat(diff);
      var data = blockData();
      var foundHit = null;
      var sampled = 0;
      var maxSamples = reducedMotion ? 1 : 3; // reduced-motion 下減少滾動頻率
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
      mineBtn.textContent = "✓ 已鑄造";
      setTimeout(function () {
        mineBtn.disabled = false;
        mineBtn.textContent = "繼續挖下一塊 ⛏";
      }, 1600);
      try { localStorage.setItem("hkb-mined", "1"); } catch (e) { /* 隱私模式忽略 */ }
      var elapsed = ((performance.now() - blockT0) / 1000).toFixed(1);
      resultBox.innerHTML = "";
      var card = el("div", "gm-success");
      var head = el("p", "gm-success-head");
      head.appendChild(coin());
      head.appendChild(document.createTextNode("✓ 區塊 #" + blockHeight + " 已鑄造 · 獎勵 3.125 比特幣"));
      card.appendChild(head);
      var hashP = el("p", "gm-mono");
      hashP.appendChild(el("span", "gm-zero", hit.h.slice(0, diff)));
      hashP.appendChild(document.createTextNode(hit.h.slice(diff)));
      card.appendChild(hashP);
      card.appendChild(el("p", "gm-note", "Nonce = " + fmt(hit.n) + " · 本塊共嘗試 " + fmt(blockTries) + " 次 · 用時 " + elapsed + " 秒"));
      card.appendChild(el("p", "gm-note", "這條記錄從此與前一個區塊咬合。想僞造它？把剛纔的功夫從頭再來一遍——而且要快過全世界。"));
      card.appendChild(el("p", "gm-note faint", "能量對照：你這塊試了 " + fmt(blockTries) + " 次，設備約耗 " + (blockTries * 0.0004).toFixed(2) + " 焦耳。真實比特幣網絡鑄造一個區塊，平均要試約 4×10²² 次、燒掉約 290 萬度電——相當於北京全城 10 分鐘的用電。你的嘗試是其中一粒塵埃，而億萬粒塵埃的總和，就是無法僞造的城牆。"));
      resultBox.appendChild(card);
      if (!reducedMotion) {
        panel.classList.remove("gm-flash");
        void panel.offsetWidth; // 重新觸發動畫
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

    /* ---- 手動挖礦 ---- */
    var lockUntil = 0;
    function manualStep() {
      if (autoOn) return;
      if (performance.now() < lockUntil) return; /* 鑄造後冷卻：防誤觸吞結果 */
      if (found) startNextBlock();
      clicks++;
      spawnZap();
      var hit = runBatch(CLICK_BATCH, MANUAL_DIFF, 7);
      updateStats("—（手動）");
      if (hit) celebrate(hit, MANUAL_DIFF);
    }

    mineBtn.addEventListener("click", function () {
      if (holdFired) { holdFired = false; return; } // 長按結束派發的 click 忽略
      manualStep();
    });

    /* 按住連點：pointerdown 350ms 後開始重複 */
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

    /* ---- 自動挖礦（requestAnimationFrame，每幀一批不卡 UI）---- */
    function autoFrame() {
      if (!autoOn || destroyed) return;
      if (found) { rafId = requestAnimationFrame(autoFrame); return; }
      var batch = autoDiff === 2 ? 90 : (autoDiff === 3 ? 400 : 650);
      if (reducedMotion) batch = Math.max(40, Math.round(batch * 0.6));
      var hit = runBatch(batch, autoDiff, Math.ceil(batch / 3));
      /* 算力：滑動窗口估算 */
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
        /* 短暫停頓後自動開下一塊，可以一直看下去 */
        autoResume = setTimeout(function () {
          if (autoOn && !destroyed) startNextBlock();
        }, 1200);
      }
      rafId = requestAnimationFrame(autoFrame);
    }

    function setAuto(on) {
      autoOn = on;
      autoBtn.textContent = on ? "停止自動挖礦" : "開啓自動挖礦";
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

  /* ================= 4. 遊戲三 · 內存池停車場 ================= */

  /* 候選交易池（fee 會做 ±20% 抖動；構造上保證“按費率排序”的貪心解
     與窮舉最優解一致，且咖啡幾乎永遠擠不進去） */
  var MP_POOL = [
    { e: "☕", name: "買杯咖啡", size: 1, fee: 2 },
    { e: "🍜", name: "一碗牛肉麪", size: 1, fee: 3 },
    { e: "🎮", name: "遊戲充值", size: 1, fee: 5 },
    { e: "📱", name: "網購手機", size: 2, fee: 15 },
    { e: "💼", name: "工資發放", size: 3, fee: 40 },
    { e: "🏠", name: "買房首付", size: 3, fee: 60 },
    { e: "🐋", name: "鯨魚大額轉賬", size: 2, fee: 90 },
    { e: "🏦", name: "交易所歸集", size: 4, fee: 120 }
  ];

  var MP_CAP = 12;

  /* 貪心：按費率（手續費÷大小）降序依次裝入 */
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

  /* 窮舉最優（n ≤ 8，最多 256 個子集，瞬間完成） */
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

  /* 生成一班交易：隨機 7–8 筆 + 費用抖動；重試直到貪心 = 最優且咖啡落選 */
  function mpGenerate() {
    for (var attempt = 0; attempt < 40; attempt++) {
      var txs = [];
      var dropIdx = -1;
      if (Math.random() < 0.5) {
        /* 50% 概率只發 7 筆：隨機去掉一張非咖啡、非鯨魚的中間卡 */
        var droppable = [1, 2, 3, 4];
        dropIdx = droppable[Math.floor(Math.random() * droppable.length)];
      }
      for (var i = 0; i < MP_POOL.length; i++) {
        if (i === dropIdx) continue;
        var base = MP_POOL[i];
        var jitter = 0.8 + Math.random() * 0.4;
        var fee = Math.max(1, Math.round(base.fee * jitter));
        if (base.name === "買杯咖啡") fee = Math.min(fee, 3); // 咖啡永遠出不起高價
        txs.push({ id: i, e: base.e, name: base.name, size: base.size, fee: fee, where: "pool" });
      }
      /* 洗牌展示順序 */
      for (var j = txs.length - 1; j > 0; j--) {
        var k2 = Math.floor(Math.random() * (j + 1));
        var tmp = txs[j]; txs[j] = txs[k2]; txs[k2] = tmp;
      }
      var g = mpGreedy(txs);
      var coffeeIn = g.chosen.some(function (t) { return t.name === "買杯咖啡"; });
      if (g.revenue === mpOptimal(txs) && !coffeeIn) return txs;
    }
    /* 兜底：用未抖動的基礎數值（已驗證貪心 = 最優 = ¥310，咖啡落選） */
    return MP_POOL.map(function (b, idx) {
      return { id: idx, e: b.e, name: b.name, size: b.size, fee: b.fee, where: "pool" };
    });
  }

  function buildMempool(root) {
    /* ---- 骨架 ---- */
    root.appendChild(el("p", "gm-kicker", "互動 · 內存池停車場"));
    root.appendChild(el("h3", "gm-title", "區塊空間拍賣：你來當一回礦工"));
    root.appendChild(el("p", "gm-desc", "橋（區塊）只有 12 格，等待區的交易卻裝不完。先點選一筆交易，再點擊橋面裝入；點已裝入的交易可以移回。裝好後點「打包區塊」，看看礦工會怎麼選。"));

    var panel = el("div", "gm-panel");
    root.appendChild(panel);

    panel.appendChild(el("p", "gm-section-label", "區塊 · 容量 12 格"));
    var readout = el("div", "gm-mp-readout");
    var roUsed = el("span");
    var roFee = el("span");
    readout.appendChild(roUsed);
    readout.appendChild(roFee);
    panel.appendChild(readout);

    var block = el("div", "gm-block");
    block.setAttribute("role", "button");
    block.setAttribute("aria-label", "區塊區域：選中交易後點擊這裏裝入");
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
    panel.appendChild(el("p", "gm-block-caption", "↑ 這座橋每 10 分鐘才發一班，全世界共用"));

    var tip = el("p", "gm-tip");
    tip.setAttribute("aria-live", "polite");
    panel.appendChild(tip);

    panel.appendChild(el("p", "gm-section-label", "等待區 · Mempool"));
    var pool = el("div", "gm-pool");
    panel.appendChild(pool);

    var btnRow = el("div", "gm-row");
    btnRow.style.marginTop = "1.1rem";
    var packBtn = btn("gm-btn", "打包區塊 ✓");
    var nextBtn = btn("gm-btn gm-ghost", "下一班區塊");
    btnRow.appendChild(packBtn);
    btnRow.appendChild(nextBtn);
    panel.appendChild(btnRow);

    var revealBox = el("div");
    panel.appendChild(revealBox);

    root.appendChild(el("p", "gm-foot", "區塊空間是稀缺資源，手續費是競拍出價。小額日常支付擠不進主鏈，所以它們去“二層”（如閃電網絡）——主鏈負責結算，就像法院不受理雞毛蒜皮。"));

    /* ---- 狀態 ---- */
    var txs = [];
    var placedOrder = []; // 已裝入的 tx（按放入順序）
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
          c.title = t.name + "（點擊移回等待區）";
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
      roFee.innerHTML = "礦工收入 <strong>¥" + fmt(feeSum()) + "</strong>";
    }

    function renderPool() {
      pool.innerHTML = "";
      txs.forEach(function (t) {
        if (t.where !== "pool") return;
        var card = el("div", "gm-card" + (t.id === selectedId ? " gm-selected" : ""));
        card.dataset.id = String(t.id);
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.setAttribute("aria-label", t.name + "，佔 " + t.size + " 格，手續費 " + t.fee + " 元" + (t.id === selectedId ? "，已選中" : ""));
        card.appendChild(el("div", "gm-card-name", t.e + " " + t.name));
        var meta = el("div", "gm-card-meta");
        meta.appendChild(el("span", null, t.size + " 格"));
        meta.appendChild(el("span", "gm-card-fee", "¥" + fmt(t.fee)));
        card.appendChild(meta);
        card.draggable = true; // 鼠標拖拽作爲增強；點選模式完整可用
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
        setTip("裝不下了——只剩 " + left + " 格，這筆要 " + t.size + " 格。先把別的移出來，或者放棄它。", true);
        return;
      }
      t.where = "block";
      placedOrder.push(t);
      selectedId = null;
      setTip(t.e + " " + t.name + " 已裝入。它出了 ¥" + fmt(t.fee) + "，買下 " + t.size + " 格橋面。");
      renderBlock();
      renderPool();
    }

    function removeTx(id) {
      if (locked) return;
      var t = findTx(id);
      if (!t || t.where !== "block") return;
      t.where = "pool";
      placedOrder = placedOrder.filter(function (x) { return x.id !== id; });
      setTip(t.e + " " + t.name + " 被請下了橋，回到等待區繼續排隊。");
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
        setTip("已選中 " + t.e + " " + t.name + "。現在點擊上面的區塊裝入它。");
      } else {
        setTip("");
      }
      renderPool();
    });

    /* 鍵盤可達：Enter / 空格 等同點擊 */
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
      else setTip("先在下面的等待區點選一筆交易，再點這裏裝入。");
    });

    block.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (selectedId != null) placeSelected();
    });

    /* 鼠標拖拽增強（桌面）；觸屏走點選流程 */
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

    /* ---- 打包揭曉 ---- */
    packBtn.addEventListener("click", function () {
      if (locked) return;
      if (placedOrder.length === 0) {
        setTip("橋還空着——先裝入幾筆交易，再打包。", true);
        return;
      }
      locked = true;
      packBtn.disabled = true;
      selectedId = null;
      renderPool();

      var mine = feeSum();
      var g = mpGreedy(txs);
      var coffee = null;
      txs.forEach(function (t) { if (t.name === "買杯咖啡") coffee = t; });

      revealBox.innerHTML = "";
      var box = el("div", "gm-reveal" + (mine >= g.revenue ? " gm-best" : ""));
      if (mine >= g.revenue) {
        box.appendChild(el("p", "gm-reveal-head", "✓ 收入 ¥" + fmt(mine) + "——你和礦工想到一塊去了"));
        box.appendChild(el("p", null, "礦工的真實算法正是這麼做的：把每筆交易按“費率 = 手續費 ÷ 佔用空間”排序，從高到低裝，直到裝不下。你憑直覺跑出了最優解。"));
      } else {
        box.appendChild(el("p", "gm-reveal-head", "你的收入：¥" + fmt(mine) + " · 礦工的算法能拿到：¥" + fmt(g.revenue)));
        box.appendChild(el("p", null, "差距 ¥" + fmt(g.revenue - mine) + "。礦工不看交易“重不重要”，只按費率（手續費 ÷ 大小）從高到低裝。它會選："));
        var ul = el("ul");
        g.chosen.forEach(function (t) {
          ul.appendChild(el("li", null, t.e + " " + t.name + " —— " + t.size + " 格 · ¥" + fmt(t.fee) + "（¥" + fmt(t.fee / t.size, 1) + "/格）"));
        });
        box.appendChild(ul);
      }
      if (coffee) {
        var coffeeLine;
        if (coffee.where === "block") {
          coffeeLine = "☕ 你心軟放進了那杯咖啡——但它每格只出 ¥" + fmt(coffee.fee / coffee.size, 1) + "，佔掉的位置本可以賣更高的價。礦工不會這麼做，不是冷血，是機制。";
        } else {
          coffeeLine = "☕ 那杯咖啡還堵在停車場——它出的 ¥" + fmt(coffee.fee) + " 不夠買下這格空間。下一班、再下一班，它大概率還是擠不進去。";
        }
        var cp = el("p", null, coffeeLine);
        box.appendChild(cp);
      }
      revealBox.appendChild(box);
      setTip("點「下一班區塊」換一批交易再玩一次。");
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

  /* ================= 5. 八字黃曆（文化彩蛋） =================
     干支推算說明：
     - 流日：儒略日序號對 60 取模（錨點：2000-01-01 = 戊午日，與通行萬年曆庫一致）
     - 流年：以立春（約 2 月 4 日）爲界
     - 流月：取最近一個已過的“節”（近似日期表，交界日 ±1 天以專業萬年曆爲準）
     定位是文化彩蛋，不是命理工具，更不是投資指標。 */

  var STEMS = "甲乙丙丁戊己庚辛壬癸";
  var BRANCHES = "子醜寅卯辰巳午未申酉戌亥";
  var ZODIAC = "鼠牛虎兔龍蛇馬羊猴雞狗豬";
  /* 五行編號：0 木 1 火 2 土 3 金 4 水 */
  var STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  var BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  var ELS = [
    { name: "木", cls: "gm-el-wood" },
    { name: "火", cls: "gm-el-fire" },
    { name: "土", cls: "gm-el-earth" },
    { name: "金", cls: "gm-el-metal" },
    { name: "水", cls: "gm-el-water" }
  ];
  /* 十二“節”的近似公曆日期（月, 日），從立春起 */
  var JIE = [[2, 4], [3, 6], [4, 5], [5, 6], [6, 6], [7, 7], [8, 8], [9, 8], [10, 8], [11, 7], [12, 7], [1, 6]];

  function baziPillars(y, m, d) {
    var stamp = Date.UTC(y, m - 1, d);
    var jdn = Math.floor(stamp / 86400000) + 2440588;
    var dayIdx = ((jdn - 11) % 60 + 60) % 60;

    var effYear = (m > 2 || (m === 2 && d >= 4)) ? y : y - 1;
    var yearIdx = ((effYear - 4) % 60 + 60) % 60;

    var mi = -1;
    for (var k = 0; k < 12; k++) {
      var jy = effYear + (k === 11 ? 1 : 0); /* 小寒落在下一公曆年 */
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
    root.appendChild(el("p", "gm-kicker", "文化彩蛋 · 僅供一樂"));
    root.appendChild(el("p", "gm-title", "流日五行 · 比特幣金水說"));
    root.appendChild(el("p", "gm-desc", "古人用天干地支給時間記賬——某種意義上，這是最早的“時間戳鏈”。選個日子（比如你的生日），看看那天的五行能量。"));

    var row = el("div", "gm-row");
    var lab = el("label", null, "選擇日期");
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
    root.appendChild(el("p", "gm-note gm-tip", "聲明：八字是古人理解時間的詩意方式，不是投資指標。判斷比特幣，請用前面文章裏的數學與事實；節氣交界日的干支，以專業萬年曆爲準。"));

    function charChip(idx, isStem) {
      var info = elOf(idx, isStem);
      var chip = el("span", "gm-char " + info.cls, (isStem ? STEMS : BRANCHES)[idx]);
      var sm = el("small", null, info.name);
      chip.appendChild(sm);
      chip.title = (isStem ? STEMS : BRANCHES)[idx] + " · 五行屬" + info.name;
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
      head.textContent = "公曆 " + y + " 年 " + m + " 月 " + d + " 日 · 星期" + wk +
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
      btcLine.textContent = "站長的玩法：比特幣偏金水——數字黃金爲金，全球流動爲水。這一天六字之中，金水佔 " + jinshui + " 席。";
      fill.style.width = Math.round(jinshui / 6 * 100) + "%";
      var text;
      if (jinshui >= 4) text = "金水汪洋。玄學地說，鏈上能量充沛——科學地說，比特幣每一天都照常出塊。";
      else if (jinshui === 3) text = "金水有氣，能量平穩流轉。該讀書讀書，該備份助記詞備份助記詞。";
      else if (jinshui === 2) text = "火土漸旺。玄學建議：少看盤，多讀文章。";
      else text = "火土當道。正好——關掉行情軟件，去實驗室親手挖一個區塊。";
      reading.textContent = "今日批註：" + text;
    }

    input.addEventListener("change", render);
    backBtn.addEventListener("click", function () { input.value = isoOf(new Date()); render(); });
    render();
  }

  /* ================= 6. 實時價格掛件 =================
     數據源 CoinGecko 公共接口；拿不到就安靜地顯示“暫不可用”，
     絕不閃爍、絕不紅綠轟炸——它只是個安靜的小鐘表。 */

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
    root.classList.remove("gm-box"); /* 角落掛件，不要大面板 */
    root.innerHTML = "";
    var box = el("span", "gm-ticker");
    box.setAttribute("role", "status");
    box.setAttribute("aria-label", "比特幣實時價格");
    var sym = coin();
    var price = el("span", "gm-tk-dim", "實時價格加載中…");
    var sats = el("span", "gm-tk-dim", "");
    var chg = el("span", "gm-tk-dim gm-tk-chg", "");
    box.appendChild(sym); box.appendChild(price); box.appendChild(sats); box.appendChild(chg);
    root.appendChild(box);

    function refresh() {
      fetchBtcUsd(function (res) {
        if (!res) {
          price.textContent = "實時價格暫不可用";
          price.className = "gm-tk-dim";
          sats.textContent = ""; chg.textContent = ""; chg.className = "gm-tk-dim gm-tk-chg";
          return;
        }
        price.textContent = "$" + fmt(res.usd);
        price.className = "";
        sats.textContent = "$1 ≈ " + fmt(Math.round(1e8 / res.usd)) + " 聰";
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

  /* ================= 7. 第一筆轉賬（沙盒錢包） =================
     全程模擬、零真實資金。目標只有一個：
     讓讀者發現“轉一筆比特幣”並不比掃碼付款更難。 */

  var DEMO_ADDR = "bc1qhukd3m0w24x7c9e8s5tval6fz0kgnp4u2yqr7";
  var TX_VSIZE = 140; /* 一筆普通轉賬約 140 vB */
  var FEE_OPTS = [
    { icon: "🐢", name: "經濟艙", rate: 2, eta: "幾小時內" },
    { icon: "🚶", name: "標準", rate: 8, eta: "約 30 分鐘" },
    { icon: "🚀", name: "下一班", rate: 25, eta: "約 10 分鐘" }
  ];

  function createFirstTx(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "沙盒模擬 · 不涉及任何真實資金"));
    root.appendChild(el("p", "gm-title", "你的第一筆轉賬"));
    root.appendChild(el("p", "gm-desc", "一個練習用的錢包。走完五步，你就親手完成過一筆（模擬的）比特幣轉賬了。"));

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
      wallet.appendChild(el("span", "gm-sandbox-badge", "SANDBOX · 模擬環境"));
      wallet.appendChild(dots());
      if (state.step === 0) stepAddr();
      else if (state.step === 1) stepAmount();
      else if (state.step === 2) stepFee();
      else if (state.step === 3) stepConfirm();
      else stepBroadcast();
    }

    /* —— 第 1 步：收款地址（順便體驗防錯碼） —— */
    function stepAddr() {
      wallet.appendChild(el("h4", "gm-step-title", "① 收款人"));
      var card = el("div", "gm-addr-card");
      card.appendChild(el("div", null, "🏪 老胡的咖啡店 · 收款地址"));
      card.appendChild(el("div", "gm-addr-mono", DEMO_ADDR));
      wallet.appendChild(card);

      var input = el("input", "gm-addr-input");
      input.type = "text";
      input.placeholder = "把地址粘貼到這裏";
      input.setAttribute("aria-label", "收款地址輸入框");
      input.autocomplete = "off"; input.spellcheck = false;
      wallet.appendChild(input);
      var msg = el("p", "gm-field-msg dim", "試試點「幫我粘貼」——然後故意改錯一個字符😏");
      wallet.appendChild(msg);

      var paste = btn("gm-btn gm-ghost", "幫我粘貼");
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
          msg.textContent = "試試點「幫我粘貼」——然後故意改錯一個字符😏";
          navi.next.disabled = true;
          return;
        }
        if (v === DEMO_ADDR) {
          input.classList.add("ok");
          msg.className = "gm-field-msg ok";
          msg.textContent = "✓ 地址校驗通過。比特幣地址自帶防錯碼（校驗和），抄對了纔可能發出去。";
          navi.next.disabled = false;
        } else {
          var i = 0;
          while (i < v.length && i < DEMO_ADDR.length && v[i] === DEMO_ADDR[i]) i++;
          input.classList.add("bad");
          msg.className = "gm-field-msg bad";
          msg.textContent = "✗ 校驗失敗：第 " + (i + 1) + " 個字符對不上。真實錢包也會這樣直接拒絕——地址抄錯不會“寄丟”，只會根本發不出去。";
          navi.next.disabled = true;
        }
      }
      input.addEventListener("input", check);
      paste.addEventListener("click", function () { input.value = DEMO_ADDR; check(); input.focus(); });
    }

    /* —— 第 2 步：金額（學會用“聰”思考） —— */
    function stepAmount() {
      wallet.appendChild(el("h4", "gm-step-title", "② 金額"));
      var big = el("p", "gm-big");
      big.appendChild(coin());
      var bigNum = document.createTextNode(fmt(state.sats) + " 聰");
      big.appendChild(bigNum);
      var sub = el("p", "gm-note", fiatHint(state.sats));
      var row = el("div", "gm-row");
      var slider = el("input", "gm-range");
      slider.type = "range"; slider.min = "1000"; slider.max = "210000"; slider.step = "1000";
      slider.value = String(state.sats);
      slider.setAttribute("aria-label", "轉賬金額（聰）");
      row.appendChild(slider);
      wallet.appendChild(big); wallet.appendChild(sub); wallet.appendChild(row);
      wallet.appendChild(el("p", "gm-note gm-tip", "1 比特幣 = 1 億聰（satoshi）。用聰來思考，你就不會再覺得“一個幣太貴、與我無關”。"));
      slider.addEventListener("input", function () {
        state.sats = +slider.value;
        bigNum.nodeValue = fmt(state.sats) + " 聰";
        sub.textContent = fiatHint(state.sats);
      });
      wallet.appendChild(nav(function () { go(0); }, function () { go(2); }).row);
    }

    /* —— 第 3 步：手續費（呼應停車場） —— */
    function stepFee() {
      wallet.appendChild(el("h4", "gm-step-title", "③ 手續費出價"));
      var opts = el("div", "gm-fee-opts");
      var note = el("p", "gm-note", "");
      FEE_OPTS.forEach(function (o, i) {
        var card = btn("gm-fee-opt" + (state.fee === i ? " on" : ""), "");
        card.appendChild(el("span", "big", o.icon + " " + o.name));
        card.appendChild(el("span", "dim", o.rate + " sat/vB · " + o.eta));
        card.appendChild(el("span", "dim", "≈ " + fmt(o.rate * TX_VSIZE) + " 聰"));
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
        note.textContent = "這筆交易約佔 " + TX_VSIZE + " vB 的區塊空間，你的出價 = " + o.rate + " × " + TX_VSIZE + " = " + fmt(o.rate * TX_VSIZE) + " 聰。還記得停車場嗎？這就是你給小車貼的價籤。";
      }
      upd();
      wallet.appendChild(opts);
      wallet.appendChild(note);
      wallet.appendChild(nav(function () { go(1); }, function () { go(3); }).row);
    }

    /* —— 第 4 步：確認 + 按住發送 —— */
    function stepConfirm() {
      wallet.appendChild(el("h4", "gm-step-title", "④ 確認"));
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
      srow("金額", fmt(state.sats) + " 聰", true);
      srow("手續費", fmt(feeSats) + " 聰（" + o.rate + " sat/vB）", true);
      srow("合計", fmt(state.sats + feeSats) + " 聰 " + fiatHint(state.sats + feeSats), true);
      wallet.appendChild(sum);

      var hold = btn("gm-hold", "");
      var fillBar = el("span", "gm-hold-fill");
      var lb = el("span", "gm-hold-label", "按住發送 ▸");
      hold.appendChild(fillBar); hold.appendChild(lb);
      wallet.appendChild(hold);
      var msg = el("p", "gm-field-msg dim", "轉出後無法撤回，所以請按住約 1 秒——這 1 秒裏，做決定的只有你，沒有客服、沒有審批。");
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
        msg.textContent = "鬆手了？沒關係——這個鍵永遠只屬於你，想好了再按。";
      }
      hold.addEventListener("pointerdown", start);
      hold.addEventListener("pointerup", cancel);
      hold.addEventListener("pointerleave", cancel);
      hold.addEventListener("pointercancel", cancel);
      hold.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(4); } });

      wallet.appendChild(nav(function () { go(2); }, null).row);
    }

    /* —— 第 5 步：廣播 → 打包 → 確認 —— */
    function stepBroadcast() {
      wallet.appendChild(el("h4", "gm-step-title", "⑤ 廣播"));
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

      later(function () { step("已簽名，廣播到 P2P 網絡——你的節點把這筆交易告訴了它認識的每個節點。"); }, 300);
      later(function () { step("進入 mempool 排隊。你的出價是 " + FEE_OPTS[state.fee].rate + " sat/vB，" + (state.fee === 0 ? "隊伍有點長，慢慢等。" : "排位相當靠前。")); }, 1300);
      later(function () {
        step("礦工挖出新區塊，你的交易被裝進了區塊 #" + fmt(state.height) + "。（演示加速：現實中平均每 10 分鐘一塊）");
        wallet.appendChild(confs);
        wallet.appendChild(confLabel);
        for (var i = 0; i < 6; i++) confs.appendChild(el("span", "gm-conf"));
        var n = 0;
        var iv = setInterval(function () {
          n++;
          confs.children[n - 1].classList.add("on");
          confLabel.textContent = "確認數 " + n + "/6" + (n < 6 ? "——每多一個區塊，篡改它的成本就翻倍地漲。" : "");
          if (n >= 6) {
            clearInterval(iv);
            try { localStorage.setItem("hkb-first-tx", "1"); } catch (e) { /* 隱私模式忽略 */ }
            confLabel.textContent = "六塊已咬合成鏈——你的轉賬壓在最底層，每一塊都是一道再也搬不開的封印。";
            var ok = el("div", "gm-success");
            var okLine = el("div");
            okLine.appendChild(coin());
            okLine.appendChild(document.createTextNode("✓ " + fmt(state.sats) + " 聰已到賬。這筆（模擬的）轉賬沒有經過任何銀行、任何客服、任何審批——從你的手，直接到對方的手。這就是點對點。"));
            ok.appendChild(okLine);
            wallet.appendChild(ok);
            var again = btn("gm-btn gm-ghost", "再來一筆");
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

  /* ================= 8. 活的區塊鏈（首頁 hero 動態鏈） =================
     四個已封存區塊 + 一個打包中的虛線區塊 + 一撮 mempool 待辦轉賬。
     每隔約 2 秒裝入一筆轉賬，裝滿即封存、鏈條前進——挖礦的具像化。
     懸停/點按任何元素可看內部信息。 */

  var CHAIN_TXS = [
    { e: "☕", t: "小明 → 街角咖啡店", a: "0.0001 ₿" },
    { e: "💼", t: "老闆 → 全體工資", a: "0.31 ₿" },
    { e: "🐋", t: "鯨魚 → 冷錢包歸集", a: "120 ₿" },
    { e: "🌉", t: "馬尼拉 → 老家匯款", a: "0.02 ₿" },
    { e: "🏪", t: "網店 → 供貨商結算", a: "0.8 ₿" },
    { e: "🎁", t: "爺爺 → 孫子的壓歲錢", a: "0.05 ₿" },
    { e: "📦", t: "交易所 → 用戶提幣", a: "2.4 ₿" },
    { e: "🛠", t: "DAO → 開發者報酬", a: "0.6 ₿" }
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
    var pinned = null; /* 點按固定的目標（觸屏） */

    function dotEl(k) { return el("span", "gm-tx-dot " + (k % 2 ? "alt" : "")); }

    function blockEl(b, miningFlag) {
      var d = btn("gm-chain-block" + (miningFlag ? " mining" : ""), "");
      for (var k = 0; k < b.txs.length; k++) d.appendChild(dotEl(k));
      d.setAttribute("aria-label", miningFlag ? "正在打包的區塊" : "區塊 #" + b.height);
      d.__info = { kind: miningFlag ? "mining" : "sealed", b: b };
      return d;
    }

    function tipHtml(info) {
      tip.innerHTML = "";
      if (info.kind === "mempool") {
        tip.appendChild(el("p", "gm-chain-tip-head", "內存池 Mempool"));
        tip.appendChild(el("p", null, mempoolN + " 筆轉賬正在排隊，各自出着手續費的價。"));
        return;
      }
      var b = info.b;
      if (info.kind === "mining") {
        tip.appendChild(el("p", "gm-chain-tip-head", "區塊 #" + fmt(b.height) + " · 打包中 " + b.txs.length + "/4"));
      } else {
        var confs = mining.height - b.height;
        tip.appendChild(el("p", "gm-chain-tip-head", "區塊 #" + fmt(b.height) + " · ✓ 已封存 · 確認 " + confs));
      }
      for (var k = 0; k < b.txs.length; k++) {
        var t = b.txs[k];
        tip.appendChild(el("p", null, t.e + " " + t.t + " · " + t.a + " · 費率 " + t.fee));
      }
      tip.appendChild(el("p", "gm-chain-tip-foot",
        info.kind === "mining" ? "礦機正在尋找合格哈希……" : "後面每多一個區塊，篡改它的成本就翻一倍。"));
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
      mp.setAttribute("aria-label", "內存池：等待打包的轉賬");
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
        /* 封存：鏈條前進一格 */
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

  /* ================= 9. 雙花問題（信任的難題 · 之一） ================= */

  function buildDoubleSpend(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "信任的難題 · 之一"));
    root.appendChild(el("p", "gm-title", "雙花問題 Double Spending"));
    root.appendChild(el("p", "gm-desc", "數字的東西天生可以複製。一段可以被複制的“錢”，還能叫錢嗎？中本聰要殺死的第一個敵人，就是 Ctrl+C。"));

    var stage = el("div");
    root.appendChild(stage);

    function btnRow() { return el("div", "gm-row"); }

    /* —— 第一幕：沒有賬本的世界 —— */
    function actOne() {
      stage.innerHTML = "";
      stage.appendChild(el("p", "gm-act", "第一幕 · 複製自由"));
      stage.appendChild(el("p", "gm-note", "這是你的一枚“數字硬幣”——本質上是一個文件。"));
      var coins = el("div", "gm-ds-coins");
      coins.appendChild(coin());
      stage.appendChild(coins);
      var note = el("p", "gm-note", "");
      stage.appendChild(note);
      var row = btnRow();
      var dup = btn("gm-btn gm-ghost", "複製粘貼這枚幣");
      var pay = btn("gm-btn", "用“同一枚”同時付款 →");
      row.appendChild(dup); row.appendChild(pay);
      stage.appendChild(row);

      var n = 1;
      dup.addEventListener("click", function () {
        if (n >= 14) return;
        n++;
        coins.appendChild(coin());
        note.textContent = "複製不要錢。若它可以複製，每一枚的價值 → " + fmt(100 / n, 1) + "%。它的稀缺性正在蒸發。";
      });
      pay.addEventListener("click", actTwo);
    }

    /* —— 第二幕：雙花成功 = 貨幣死亡 —— */
    function actTwo() {
      stage.innerHTML = "";
      stage.appendChild(el("p", "gm-act", "第二幕 · 雙花成功 = 貨幣死亡"));
      stage.appendChild(el("p", "gm-note", "你把“同一枚幣”的文件，同時發給了兩個人："));
      var recv = el("div", "gm-ds-recv");
      var a = el("div", "gm-ds-card"); a.innerHTML = "🙋‍♀️ 小紅<br><span class='state'>收到文件，驗證爲真 ✓</span>";
      var b = el("div", "gm-ds-card"); b.innerHTML = "🙋 小剛<br><span class='state'>收到文件，驗證爲真 ✓</span>";
      recv.appendChild(a); recv.appendChild(b);
      stage.appendChild(recv);
      setTimeout(function () { a.classList.add("got"); }, reducedMotion ? 0 : 250);
      setTimeout(function () { b.classList.add("got"); }, reducedMotion ? 0 : 550);
      stage.appendChild(el("p", "gm-note", "兩人各自檢查文件——都是真的，於是都收下了。兩筆支付同時成立：這就是“雙花”。一種能被花兩次的錢，價值必然歸零。在沒有賬本的世界裏，這無法阻止。"));
      var row = btnRow();
      var go = btn("gm-btn", "進入賬本的世界 →");
      row.appendChild(go);
      stage.appendChild(row);
      go.addEventListener("click", actThree);
    }

    /* —— 第三幕：賬本的世界 —— */
    function actThree() {
      stage.innerHTML = "";
      stage.appendChild(el("p", "gm-act", "第三幕 · 賬本的世界"));
      stage.appendChild(el("p", "gm-note", "現在，錢不再是文件——錢是這本公共賬本上的一條記錄："));
      var led = el("div", "gm-ds-ledger");
      led.appendChild(el("div", "ok", "區塊 #1 ｜ 鑄造 → 你：1 枚 ✓"));
      stage.appendChild(led);
      var row = btnRow();
      var p1 = btn("gm-btn", "付給小紅");
      var p2 = btn("gm-btn gm-ghost", "再把“同一枚”付給小剛");
      p2.disabled = true;
      row.appendChild(p1); row.appendChild(p2);
      stage.appendChild(row);
      var tail = el("div");
      stage.appendChild(tail);

      p1.addEventListener("click", function () {
        if (p1.disabled) return;
        p1.disabled = true;
        led.appendChild(el("div", "ok", "區塊 #2 ｜ 你 → 小紅：1 枚 ✓（你的餘額：0）"));
        p2.disabled = false;
      });
      p2.addEventListener("click", function () {
        if (p2.disabled) return;
        p2.disabled = true;
        var rej = el("div", "no", "區塊 #✗ ｜ 你 → 小剛：1 枚 —— 被全網拒絕：賬本顯示你的餘額爲 0");
        led.appendChild(rej);
        if (!reducedMotion) { led.classList.add("gm-shake"); setTimeout(function () { led.classList.remove("gm-shake"); }, 450); }
        var v = el("div", "gm-verdict");
        v.appendChild(el("p", null, "看到了嗎：錢不在文件裏，錢在賬本里。文件可以複製，但賬本上的“先後順序”無法複製——後到的那筆，自動作廢。"));
        v.appendChild(el("p", null, "可是新的問題來了：這本賬由誰來記？如果記賬的人自己作弊呢？這就是下一個實驗——拜占庭將軍問題。"));
        var rs = btn("gm-btn gm-ghost", "重看一遍");
        rs.addEventListener("click", actOne);
        tail.appendChild(v);
        tail.appendChild(rs);
      });
    }

    actOne();
  }

  /* ================= 10. 拜占庭將軍（信任的難題 · 之二） ================= */

  function buildByzantine(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "信任的難題 · 之二"));
    root.appendChild(el("p", "gm-title", "拜占庭將軍問題"));
    root.appendChild(el("p", "gm-desc", "九路聯軍圍城，必須同時進攻才能取勝。軍中混着叛徒，信使可以撒謊、冒名、對不同人說不同話。沒有統帥，誠實的將軍們如何達成一致？——這道難題懸了幾十年，直到 2008 年。"));

    var row1 = el("div", "gm-row");
    var lab = el("label", null, "叛徒人數");
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
    var powBtn = btn("gm-btn gm-ghost", "火漆印：關");
    var pow = false;
    powBtn.addEventListener("click", function () {
      pow = !pow;
      powBtn.textContent = pow ? "火漆印：開 ✓" : "火漆印：關";
      powBtn.className = pow ? "gm-btn" : "gm-btn gm-ghost";
    });
    var go = btn("gm-btn", "傳令 · 進攻");
    row1.appendChild(lab); row1.appendChild(seg); row1.appendChild(powBtn); row1.appendChild(go);
    root.appendChild(row1);
    root.appendChild(el("p", "gm-note gm-tip", "「火漆印」= 每道軍令必須附一枚耗費真實時間才能鑄出的印章（工作量證明）。開關它，看看世界有什麼不同。"));

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
    log.textContent = "調好叛徒人數，點「傳令」。";
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
        /* 謊言免費的世界：軍令互相矛盾，誠實者分裂 */
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
          "> 叛徒向不同的人發出了不同的軍令（僞造一條命令的成本：0）",
          "> 有人還冒用了忠誠將軍的名義亂髮消息",
          "> 結果：進攻 " + atk + " 路 · 後撤 " + rtr + " 路 —— 兵力不足，攻城失敗",
          "> 虛線圈出的是叛徒——事前，你根本看不出來"
        ]);
        var v1 = el("div", "gm-verdict");
        v1.appendChild(el("p", null, "問題不在於誠實的人不夠多，而在於謊言和真話一樣便宜。只要僞造零成本，再多的誠實也匯不成一致。"));
        verdictBox.appendChild(v1);
      } else {
        /* 火漆印的世界：說話有成本，最長令鏈由誠實多數鑄成 */
        gens.forEach(function (g, k) {
          setTimeout(function () {
            g.classList.add("attack");
            if (isT(k)) g.classList.add("traitor");
          }, reducedMotion ? 0 : 150 * k);
        });
        setTimeout(function () { city.classList.add("fallen"); }, reducedMotion ? 0 : 1600);
        var lines = [
          "> 新規生效：每道軍令必須附「火漆印」——鑄一枚要燒一炷香",
          "> 叛徒只有 " + tCount + "/9 的鑄印能力，僞造的命令既慢又少",
          "> 誠實多數鑄出了最長的那條令鏈，所有人只認它",
          "> 九路同時進攻 —— 城破 ✓"
        ];
        if (tCount >= 4) lines.push("> 警告：叛徒已達 4/9。一旦過半，最長鏈也會撒謊——這就是「51% 攻擊」的含義。");
        logLines(lines);
        var v2 = el("div", "gm-verdict");
        v2.appendChild(el("p", null, "無須認識彼此，無須信任信使——只需跟隨“耗費能量最多的那條鏈”。這就是中本聰給拜占庭將軍們的答案，也是此刻全球幾十萬個比特幣節點正在做的事。"));
        verdictBox.appendChild(v2);
      }
    }

    go.addEventListener("click", run);
    root.appendChild(el("p", "gm-note faint", "極簡化演示。嚴格表述見 Lamport 等《拜占庭將軍問題》（1982）與比特幣白皮書第 4 節。"));
  }

  /* ================= 11. 另一本賬：美國國債實時鐘 =================
     基線常數保證離線也走表（按近期增速外推）；
     美國財政部 Debt to the Penny API 可達時自動校準爲官方口徑。 */

  var DEBT_FALL_TS = Date.UTC(2026, 5, 1);    /* 2026-06-01 */
  var DEBT_FALL_AMT = 39.0e12;                /* 第四篇口徑：39–40 萬億取保守端 */
  var DEBT_FALL_RATE = 80000;                 /* ≈ $2.5 萬億/年 */

  function createDebtClock(root) {
    root.classList.remove("gm-box");
    root.innerHTML = "";
    var slab = el("div", "gm-debt");
    root.appendChild(slab);
    slab.appendChild(el("p", "gm-debt-k", "美國聯邦政府債務總額 · 實時"));
    var big = el("p", "gm-debt-n", "$ —");
    var sub = el("p", "gm-debt-sub");
    var rise = el("span", "rise", "");
    sub.appendChild(rise);
    var subTail = document.createTextNode("");
    sub.appendChild(subTail);
    var src = el("p", "gm-debt-src", "校準中——正在詢問美國財政部……");
    var mirror = el("p", "gm-debt-mirror");
    mirror.appendChild(document.createTextNode("對面那本賬的上限："));
    mirror.appendChild(coin());
    mirror.appendChild(document.createTextNode("21,000,000——寫死的，誰也加不了一頁。"));
    slab.appendChild(big);
    slab.appendChild(sub);
    slab.appendChild(src);
    slab.appendChild(mirror);

    var base = DEBT_FALL_AMT, baseTs = DEBT_FALL_TS, rate = DEBT_FALL_RATE;

    function render() {
      var v = base + rate * Math.max(0, (Date.now() - baseTs) / 1000);
      big.textContent = "$" + fmt(Math.floor(v));
      rise.textContent = "每一秒 +$" + fmt(Math.round(rate));
      subTail.nodeValue = " ｜ 攤到每個美國人頭上 ≈ $" + fmt(Math.round(v / 341000000)) + " ｜ 國債利息已超過軍費";
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
          src.textContent = "已按官方數據校準 · 美國財政部 Debt to the Penny · 截至 " + d[0].record_date + "（此後爲按近期增速外推）";
        })
        .catch(function () {
          src.textContent = "基線：2026-06 約 $39 萬億（財政部口徑）· 此刻數字爲按年增約 $2.5 萬億的外推——離線它也在漲，這正是問題本身。";
        });
    }
    return function () { clearInterval(iv); };
  }

  /* ================= 12. BTC Yield 計算器（金庫 · 飛輪的數學） =================
     驚人的事實：增發一輪帶來的每股含幣變化，與幣價無關——
     yield = (1 + d·m) / (1 + d) − 1，只由溢價 m 與稀釋 d 決定。 */

  function createBtcYield(root) {
    root.innerHTML = "";
    root.appendChild(el("p", "gm-kicker", "飛輪的數學 · 親手擰一擰"));
    root.appendChild(el("p", "gm-title", "一輪增發，每股變重多少？"));
    root.appendChild(el("p", "gm-desc", "假設公司增發新股募資、並把募來的錢全部買成比特幣。拖動兩個旋鈕，看老股東的每一股發生什麼。"));

    var m = 1.8, d = 0.10;

    var row1 = el("div", "gm-row");
    row1.appendChild(el("label", null, "市場給的溢價 mNAV"));
    var sm = el("input", "gm-range");
    sm.type = "range"; sm.min = "0.8"; sm.max = "3"; sm.step = "0.05"; sm.value = String(m);
    sm.setAttribute("aria-label", "mNAV 溢價倍數");
    var vm = el("span", "gm-val", "1.80×");
    row1.appendChild(sm); row1.appendChild(vm);
    root.appendChild(row1);

    var row2 = el("div", "gm-row");
    row2.appendChild(el("label", null, "本輪增發稀釋"));
    var sd = el("input", "gm-range");
    sd.type = "range"; sd.min = "0"; sd.max = "30"; sd.step = "1"; sd.value = "10";
    sd.setAttribute("aria-label", "增發稀釋比例");
    var vd = el("span", "gm-val", "10%");
    row2.appendChild(sd); row2.appendChild(vd);
    root.appendChild(row2);

    var big = el("p", "gm-big", "");
    root.appendChild(big);

    var wrap = el("div", "gm-yield-wrap");
    var b1w = el("div", "gm-yield-bar"); var b1 = el("div", "fill"); b1w.appendChild(b1);
    var b2w = el("div", "gm-yield-bar"); var b2 = el("div", "fill"); b2w.appendChild(b2);
    var c1 = el("div", "gm-yield-col"); c1.appendChild(b1w); c1.appendChild(el("p", "gm-yield-lab", "增發前 · 每股含幣"));
    var c2 = el("div", "gm-yield-col"); c2.appendChild(b2w); c2.appendChild(el("p", "gm-yield-lab", "增發後 · 每股含幣"));
    wrap.appendChild(c1); wrap.appendChild(c2);
    root.appendChild(wrap);

    var note = el("p", "gm-note", "");
    root.appendChild(note);
    root.appendChild(el("p", "gm-note gm-tip", "注意這道算式裏沒有幣價——飛輪的燃料是「溢價」，不是「漲價」。這正是 MSTR 把 BTC Yield 當 KPI 的原因：它衡量的是資本運作本身的功力，而非行情的運氣。"));

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
        note.textContent = "不增發，每股含幣原地不動。擰動上面的旋鈕試試。";
      } else if (m > 1.001) {
        note.textContent = "溢價 " + m.toFixed(2) + "× 之下，募來的錢買到的幣多於新股的攤薄——老股東的每一股都變重了。只要市場願意付溢價，每一次增發都是對老股東的饋贈。這就是飛輪的全部祕密。";
      } else if (m < 0.999) {
        note.textContent = "⚠ 警示：mNAV 低於 1 時增發，買回的幣追不上股本攤薄——每股含幣不升反降，飛輪反轉成絞肉機。紀律嚴明的儲備公司在折價時絕不增發。";
      } else {
        note.textContent = "mNAV = 1：增發不增不減，等於白忙——這就是 ETF 的世界，永遠 1 : 1。";
      }
    }
    sm.addEventListener("input", upd);
    sd.addEventListener("input", upd);
    upd();
  }

  /* ---- 序幕接線：五個需要"先講清你在幹嘛"的遊戲 ---- */
  function createTimeMachine(root) {
    gmIntro(root, "time-machine", [
      ["這是一臺時間機器", "它只回答一個問題：你的錢，隨時間去了哪裏。"],
      ["左邊是法幣的世界", "拖動年份，看 100 美元還能買幾條麪包。"],
      ["右邊是另一套系統", "一條永遠鎖死在 21,000,000 的線。"]
    ], function () { buildTimeMachine(root); });
  }

  function createPowMiner(root) {
    gmIntro(root, "pow-miner", [
      ["你即將成爲一臺礦機", "挖礦不是挖土——是億萬次地『猜』一個幸運數字。"],
      ["每點一下 = 真算 30 次 SHA-256", "目標：找到一個以 0 開頭的哈希。找到，就鑄出一個區塊。"],
      ["這會消耗真實能量", "正因爲作假必須把能量重燒一遍，賬本才無法僞造。這就是『能量貨幣』。"]
    ], function () { buildPowMiner(root); });
  }

  function createMempool(root) {
    gmIntro(root, "mempool", [
      ["你現在是礦工", "面前是一座寬度固定的橋（區塊），和一羣想過橋的車（轉賬）。"],
      ["每輛車都出了運費", "橋裝不下所有車——載誰先過？你說了算。"],
      ["裝滿後點『打包』", "看看你的直覺，和真實礦工的算法差多少。"]
    ], function () { buildMempool(root); });
  }

  function createDoubleSpend(root) {
    gmIntro(root, "double-spend", [
      ["先認識比特幣的頭號敵人", "數字的東西天生能複製——可錢，絕不能被複制。"],
      ["你將親手『作惡』一次", "把同一枚幣花給兩個人，看沒有賬本的世界怎麼崩塌。"],
      ["然後進入賬本的世界", "看同樣的把戲，如何被全網當場拒絕。"]
    ], function () { buildDoubleSpend(root); });
  }

  function createByzantine(root) {
    gmIntro(root, "byzantine", [
      ["九路大軍圍住一座城", "必須同時進攻才能贏——但軍中有叛徒，信使還會撒謊。"],
      ["這是懸了幾十年的難題", "當謊言和真話一樣便宜，共識就不可能。"],
      ["直到有人發明了『火漆印』", "讓說話變貴。調好叛徒人數，親自傳一次令。"]
    ], function () { buildByzantine(root); });
  }

  /* ================= 13. registry + 啓動 ================= */

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
    "btc-yield": createBtcYield
  };

  function boot() {
    var mounts = document.querySelectorAll("[data-game]");
    for (var i = 0; i < mounts.length; i++) {
      var mount = mounts[i];
      var factory = registry[mount.getAttribute("data-game")];
      if (!factory) continue;
      /* 重複初始化安全：先清理上一個實例的 rAF / interval */
      if (typeof mount.__gmDestroy === "function") {
        try { mount.__gmDestroy(); } catch (err) { /* 忽略 */ }
      }
      mount.innerHTML = ""; // 清掉 JS 不可用時的 fallback 文案
      mount.classList.add("gm-box");
      try {
        mount.__gmDestroy = factory(mount) || null;
      } catch (err) {
        mount.textContent = "（這個小遊戲沒能啓動，但不影響閱讀正文。）";
      }
    }
  }

  /* 價格小鐘全站常駐：頁面沒放掛載點時，自動在右下角生一個 */
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
    bootAll(); // defer 腳本通常在 DOMContentLoaded 前執行，此分支兜底
  }
})();
