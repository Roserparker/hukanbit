/* 胡侃比特 · 实验室脚本
   所有实验都在浏览器本地运行，不依赖任何服务器。 */
(function () {
  "use strict";

  /* ============ SHA-256 ============
     优先使用 Web Crypto；在不支持的环境（如某些 file:// 场景）下，
     退回到纯 JS 实现（FIPS 180-4）。 */

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

  var useSubtle = typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function";

  function sha256Hex(str) {
    if (useSubtle) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
        var arr = new Uint8Array(buf), hex = "";
        for (var i = 0; i < arr.length; i++) hex += arr[i].toString(16).padStart(2, "0");
        return hex;
      }).catch(function () { useSubtle = false; return sha256Sync(str); });
    }
    return Promise.resolve(sha256Sync(str));
  }

  function fmt(n, digits) {
    return n.toLocaleString("zh-CN", { maximumFractionDigits: digits == null ? 0 : digits });
  }

  /* ============ ① 通胀时光机 ============ */
  (function () {
    var rate = document.getElementById("inf-rate");
    if (!rate) return;
    var years = document.getElementById("inf-years");
    var rateVal = document.getElementById("inf-rate-val");
    var yearsVal = document.getElementById("inf-years-val");
    var result = document.getElementById("inf-result");
    var note = document.getElementById("inf-note");
    var chart = document.getElementById("inf-chart");
    var START = 100; // 万元

    function render() {
      var r = parseFloat(rate.value) / 100;
      var n = parseInt(years.value, 10);
      rateVal.textContent = parseFloat(rate.value) + "%";
      yearsVal.textContent = n + " 年";
      var remain = START * Math.pow(1 - r, n);
      result.textContent = "¥" + fmt(remain, 1) + " 万";
      if (r === 0) {
        note.textContent = "没有通胀的世界里，价值的尺子是恒定的——100 万永远是 100 万。这正是“恒定单位”的理想情况。";
      } else {
        var gone = START - remain;
        var half = Math.log(0.5) / Math.log(1 - r);
        note.textContent = "在 " + rate.value + "% 的年通胀下，100 万存款 " + n + " 年后只剩约 " +
          fmt(remain, 1) + " 万的购买力，凭空蒸发了 " + fmt(gone, 1) + " 万（" + fmt(gone / START * 100, 1) + "%）。" +
          "按这个速度，购买力大约每 " + fmt(half, 0) + " 年减半。没有人抢劫，也没有人犯罪——这一切都是“合法”的。";
      }

      // 画曲线
      var W = 560, Hh = 180, padL = 46, padR = 16, padT = 16, padB = 26;
      var pw = W - padL - padR, ph = Hh - padT - padB;
      function X(t) { return padL + (t / n) * pw; }
      function Y(v) { return padT + (1 - v / START) * ph; }
      var pts = [];
      for (var t = 0; t <= n; t++) pts.push(X(t).toFixed(1) + "," + Y(START * Math.pow(1 - r, t)).toFixed(1));
      var line = "M" + pts.join(" L");
      var area = line + " L" + X(n).toFixed(1) + "," + Y(0) + " L" + X(0) + "," + Y(0) + " Z";
      var endY = Y(remain), endX = X(n);
      chart.innerHTML =
        '<line class="axis" x1="' + padL + '" y1="' + Y(0) + '" x2="' + (W - padR) + '" y2="' + Y(0) + '"/>' +
        '<line class="axis" x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + Y(0) + '"/>' +
        '<path class="area" d="' + area + '"/>' +
        '<path class="curve" d="' + line + '"/>' +
        '<circle class="marker" cx="' + endX + '" cy="' + endY + '" r="4"/>' +
        '<text x="' + (padL - 6) + '" y="' + (padT + 4) + '" text-anchor="end">100万</text>' +
        '<text x="' + (padL - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text>' +
        '<text x="' + padL + '" y="' + (Hh - 8) + '">今天</text>' +
        '<text x="' + (W - padR) + '" y="' + (Hh - 8) + '" text-anchor="end">' + n + ' 年后</text>' +
        '<text x="' + Math.min(endX - 8, W - padR - 4) + '" y="' + Math.max(endY - 10, 12) + '" text-anchor="end" fill="var(--accent-ink)">剩 ' + fmt(remain, 0) + ' 万</text>';
    }

    rate.addEventListener("input", render);
    years.addEventListener("input", render);
    render();
  })();

  /* ============ ② 货币乘数机 ============ */
  (function () {
    var rateEl = document.getElementById("mul-rate");
    if (!rateEl) return;
    var rateVal = document.getElementById("mul-rate-val");
    var runBtn = document.getElementById("mul-run");
    var resetBtn = document.getElementById("mul-reset");
    var totalEl = document.getElementById("mul-total");
    var maxEl = document.getElementById("mul-max");
    var ledger = document.getElementById("mul-ledger");
    var note = document.getElementById("mul-note");
    var timer = null;

    function updateMax() {
      rateVal.textContent = rateEl.value + "%";
      maxEl.textContent = "¥" + fmt(10000 / parseInt(rateEl.value, 10));
    }

    function reset() {
      if (timer) { clearInterval(timer); timer = null; }
      ledger.innerHTML = "";
      totalEl.textContent = "¥0";
      note.textContent = "";
      runBtn.disabled = false;
    }

    function run() {
      reset();
      runBtn.disabled = true;
      var r = parseInt(rateEl.value, 10) / 100;
      var deposit = 100, total = 0, round = 1;
      timer = setInterval(function () {
        var keep = deposit * r;
        var loan = deposit - keep;
        total += deposit;
        var row = document.createElement("div");
        row.className = "row";
        row.innerHTML = '<span class="r-label">第 ' + round + ' 轮：存入 ¥' + fmt(deposit, 2) +
          '，银行留 ¥' + fmt(keep, 2) + '，贷出 ¥' + fmt(loan, 2) + '</span><span>账面累计 ¥' + fmt(total, 2) + "</span>";
        ledger.appendChild(row);
        ledger.scrollTop = ledger.scrollHeight;
        totalEl.textContent = "¥" + fmt(total, 0);
        deposit = loan;
        round++;
        if (deposit < 0.5 || round > 60) {
          clearInterval(timer); timer = null;
          runBtn.disabled = false;
          var mult = total / 100;
          note.textContent = "你的 ¥100 真实现金，在整个银行体系的账本上变成了约 ¥" + fmt(total, 0) +
            " 的“存款”——每个人都觉得自己有钱，但真实的现金只有 ¥100。放大倍数约 " + fmt(mult, 1) +
            " 倍。准备金率越低，凭空“造”出的钱越多。这就是货币乘数效应。";
        }
      }, 260);
    }

    rateEl.addEventListener("input", function () { updateMax(); });
    runBtn.addEventListener("click", run);
    resetBtn.addEventListener("click", reset);
    updateMax();
  })();

  /* ============ ③ 哈希实验台 ============ */
  (function () {
    var input = document.getElementById("hash-input");
    if (!input) return;
    var output = document.getElementById("hash-output");
    var note = document.getElementById("hash-note");
    var lastHash = "";
    var seq = 0;

    function render(hash) {
      var html = "";
      var changed = 0;
      for (var i = 0; i < hash.length; i++) {
        var cls = "";
        if (lastHash && hash[i] !== lastHash[i]) { cls = "changed"; changed++; }
        html += cls ? '<span class="' + cls + '">' + hash[i] + "</span>" : hash[i];
      }
      output.innerHTML = html;
      if (lastHash && lastHash !== hash) {
        note.textContent = "和上一次相比，64 个字符中有 " + changed + " 个变了。输入只动了一点点，指纹却面目全非——这就是雪崩效应。想悄悄篡改账本而不被发现？不可能。";
      } else if (lastHash === hash && lastHash !== "") {
        note.textContent = "内容相同，指纹必然完全相同——这就是“可验证”。";
      }
      lastHash = hash;
    }

    function update() {
      var mySeq = ++seq;
      sha256Hex(input.value).then(function (h) {
        if (mySeq === seq) render(h);
      });
    }

    input.addEventListener("input", update);
    update();
  })();

  /* ============ ④ 挖矿模拟器 ============ */
  (function () {
    var goBtn = document.getElementById("mine-go");
    if (!goBtn) return;
    var dataEl = document.getElementById("mine-data");
    var diffWrap = document.getElementById("mine-diff");
    var triesEl = document.getElementById("mine-tries");
    var speedEl = document.getElementById("mine-speed");
    var timeEl = document.getElementById("mine-time");
    var logEl = document.getElementById("mine-log");
    var resultEl = document.getElementById("mine-result");
    var running = false;
    var difficulty = 3;

    diffWrap.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn || running) return;
      difficulty = parseInt(btn.dataset.d, 10);
      diffWrap.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === btn); });
    });

    function mine() {
      if (running) { running = false; return; }
      running = true;
      goBtn.textContent = "停止";
      resultEl.innerHTML = "";
      var target = "0".repeat(difficulty);
      var data = dataEl.value;
      var nonce = 0;
      var t0 = performance.now();
      var lastLines = [];
      var batchCount = 0;

      function batch() {
        if (!running) { finish(false); return; }
        var promises = [];
        var batchSize = 96;
        for (var i = 0; i < batchSize; i++) {
          (function (n) {
            promises.push(sha256Hex(data + " | nonce:" + n).then(function (h) { return { n: n, h: h }; }));
          })(nonce++);
        }
        Promise.all(promises).then(function (results) {
          var found = null;
          for (var i = 0; i < results.length; i++) {
            if (results[i].h.slice(0, difficulty) === target) { found = results[i]; break; }
          }
          var elapsed = (performance.now() - t0) / 1000;
          triesEl.textContent = fmt(found ? found.n + 1 : nonce);
          speedEl.textContent = fmt(nonce / Math.max(elapsed, 0.001), 0) + " 次/秒";
          timeEl.textContent = elapsed.toFixed(1) + " 秒";
          var sample = found || results[results.length - 1];
          lastLines.push("nonce=" + sample.n + " → " + sample.h);
          if (lastLines.length > 4) lastLines.shift();
          logEl.textContent = lastLines.join("\n");
          if (found) {
            finish(true, found, elapsed);
          } else if (++batchCount % 24 === 0) {
            setTimeout(batch, 0); // 偶尔让出主线程，保证页面可响应
          } else {
            batch(); // 微任务链：避免后台标签页的定时器节流
          }
        });
      }

      function finish(success, found, elapsed) {
        running = false;
        goBtn.textContent = "开始挖矿";
        if (!success) {
          logEl.textContent += "\n（已停止——这一区块让给别的矿工吧）";
          return;
        }
        var pretty = '<span class="zero">' + found.h.slice(0, difficulty) + "</span>" + found.h.slice(difficulty);
        resultEl.innerHTML = '<div class="success-card">⛏️ 挖到了！第 <strong>' + fmt(found.n + 1) +
          "</strong> 次尝试找到了以 " + difficulty + " 个 0 开头的指纹，用时 " + elapsed.toFixed(1) + " 秒。<br>" +
          '<span style="font-family:var(--mono);font-size:0.72rem;">' + pretty + "</span><br>" +
          "理论上平均要试 " + fmt(Math.pow(16, difficulty)) + " 次（运气好就快，运气差就慢——这就是“抽彩票”）。" +
          "想伪造这个区块？一切从头再试一遍。每个区块都连着上一个区块，改一个就要全部重挖——这就是不可篡改的能量成本。</div>";
      }

      batch();
    }

    goBtn.addEventListener("click", mine);
  })();

  /* ============ ⑤ 2100 万与减半 ============ */
  (function () {
    var yearEl = document.getElementById("sup-year");
    if (!yearEl) return;
    var yearVal = document.getElementById("sup-year-val");
    var rewardEl = document.getElementById("sup-reward");
    var issuedEl = document.getElementById("sup-issued");
    var pctEl = document.getElementById("sup-pct");
    var chart = document.getElementById("sup-chart");
    var CAP = 21000000;

    function rewardOfEra(era) { return era < 33 ? 50 / Math.pow(2, era) : 0; }

    function issuedAt(year) {
      var t = year - 2009;
      if (t <= 0) return 0;
      var era = Math.floor(t / 4);
      var frac = (t % 4) / 4;
      var total = 0;
      for (var k = 0; k < era && k < 33; k++) total += 210000 * rewardOfEra(k);
      if (era < 33) total += frac * 210000 * rewardOfEra(era);
      return Math.min(total, CAP);
    }

    function render() {
      var y = parseInt(yearEl.value, 10);
      yearVal.textContent = String(y);
      var era = Math.floor((y - 2009) / 4);
      var rw = rewardOfEra(era);
      var issued = issuedAt(y);
      rewardEl.textContent = rw >= 0.0001 ? (rw % 1 === 0 ? rw : rw.toFixed(rw >= 1 ? 4 : 8).replace(/0+$/, "").replace(/\.$/, "")) + " BTC" : "≈0 BTC";
      issuedEl.textContent = fmt(issued / 10000, 0) + " 万枚";
      pctEl.textContent = fmt(issued / CAP * 100, 2) + "%";

      var W = 560, Hh = 200, padL = 52, padR = 16, padT = 22, padB = 26;
      var pw = W - padL - padR, ph = Hh - padT - padB;
      function X(yr) { return padL + (yr - 2009) / (2141 - 2009) * pw; }
      function Y(v) { return padT + (1 - v / CAP) * ph; }
      var pts = [];
      for (var yr = 2009; yr <= 2141; yr++) pts.push(X(yr).toFixed(1) + "," + Y(issuedAt(yr)).toFixed(1));
      var line = "M" + pts.join(" L");
      var area = line + " L" + X(2141).toFixed(1) + "," + Y(0) + " L" + X(2009) + "," + Y(0) + " Z";
      var mx = X(y), my = Y(issued);
      var halvings = "";
      [2012, 2016, 2020, 2024, 2028].forEach(function (hy) {
        halvings += '<circle cx="' + X(hy).toFixed(1) + '" cy="' + Y(issuedAt(hy)).toFixed(1) + '" r="2.5" fill="var(--ink-faint)"/>';
      });
      chart.innerHTML =
        '<line class="axis" x1="' + padL + '" y1="' + Y(0) + '" x2="' + (W - padR) + '" y2="' + Y(0) + '"/>' +
        '<line class="axis" x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + Y(0) + '"/>' +
        '<line x1="' + padL + '" y1="' + Y(CAP) + '" x2="' + (W - padR) + '" y2="' + Y(CAP) + '" stroke="var(--ink-faint)" stroke-dasharray="4 4" stroke-width="1"/>' +
        '<text x="' + (W - padR) + '" y="' + (Y(CAP) - 6) + '" text-anchor="end">2100 万上限 —— 永不超过</text>' +
        '<path class="area" d="' + area + '"/>' +
        '<path class="curve" d="' + line + '"/>' +
        halvings +
        '<circle class="marker" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="5"/>' +
        '<text x="' + padL + '" y="' + (Hh - 8) + '">2009</text>' +
        '<text x="' + X(2070).toFixed(1) + '" y="' + (Hh - 8) + '" text-anchor="middle">2070</text>' +
        '<text x="' + (W - padR) + '" y="' + (Hh - 8) + '" text-anchor="end">2140</text>' +
        '<text x="' + (padL - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text>' +
        '<text x="' + Math.min(mx + 8, W - 120) + '" y="' + Math.max(my - 10, 14) + '" fill="var(--accent-ink)">' + y + ' 年</text>';
    }

    yearEl.addEventListener("input", render);
    render();
  })();

  /* ============ ⑥ 小测验 ============ */
  (function () {
    var panel = document.getElementById("quiz-panel");
    if (!panel) return;

    var QUESTIONS = [
      {
        q: "下面哪一项不是货币的三大功能之一？",
        opts: ["交换媒介", "定价单位", "价值储存", "产生利息"],
        a: 3,
        ex: "货币的三大功能是：交换媒介、定价单位、价值储存。产生利息是金融产品的属性，不是货币本身的功能。详见第一篇《何为金钱》。"
      },
      {
        q: "1971 年发生了什么大事，让人类进入“纯政府账本时代”？",
        opts: ["美联储成立", "美元与黄金脱钩", "布雷顿森林体系建立", "欧元诞生"],
        a: 1,
        ex: "1971 年尼克松宣布美元与黄金脱钩，货币失去了锚定物的约束，开启了随意印钞的时代。1971 年的 1 美元，购买力约等于 2024 年的 0.13 美元。"
      },
      {
        q: "在每年 2% 的通胀下，100 万存款 30 年后的购买力大约还剩多少？",
        opts: ["约 94 万", "约 70 万", "约 55 万", "约 40 万"],
        a: 2,
        ex: "复利的力量：100 × 0.98³⁰ ≈ 55 万。所谓“温和通胀”，30 年悄悄拿走了你将近一半的购买力。可以去“通胀时光机”亲手拖一拖。"
      },
      {
        q: "美元纸币上印的 “Federal Reserve Note” 中，Note 最准确的意思是？",
        opts: ["笔记", "纸张", "备忘录", "欠条 / 债务凭证"],
        a: 3,
        ex: "Note 在金融语境里是“债务凭证”。美元的全称其实是“美联储欠条”——所有法币的底层都是债务。详见第二篇《债务驱动的世界》。"
      },
      {
        q: "比特币的总量上限是多少？",
        opts: ["1 亿枚", "2100 万枚", "2.1 亿枚", "没有上限，每年增发"],
        a: 1,
        ex: "2100 万枚，写死在源代码里，由全球两万多个节点共同守护。1 BTC 永远 = 1/21,000,000 BTC。考虑到约 300–400 万枚已永久丢失，实际流通量更少。"
      },
      {
        q: "比特币的规则（比如 2100 万上限）最终由谁守护？",
        opts: ["矿工", "交易所", "遍布全球的节点", "中本聪本人"],
        a: 2,
        ex: "最关键的不是矿工而是节点——任何运行节点的普通人都在验证规则。矿工就算挖出“违规区块”，节点不承认，全网就不承认。2017 年的分叉币 BCH 就是前车之鉴。"
      },
      {
        q: "“工作量证明（PoW）”证明的到底是什么？",
        opts: ["矿工的数学水平很高", "真实消耗了能量，无法低成本伪造", "政府背书了这种货币", "矿机的算力品牌"],
        a: 1,
        ex: "PoW 证明的是“我真的付出了真金白银的能量”。就像黄金的价值来自“再来一克需要 60 美元”的成本壁垒——任何资产的价值上限，取决于伪造它的成本。详见第四篇《内在价值》。"
      }
    ];

    var idx = 0, score = 0;

    function showQuestion() {
      var item = QUESTIONS[idx];
      var html = '<p class="quiz-meta">第 ' + (idx + 1) + " / " + QUESTIONS.length + ' 题 · 当前得分 ' + score + "</p>" +
        '<p class="quiz-q">' + item.q + "</p>" + '<div class="quiz-opts">';
      item.opts.forEach(function (o, i) {
        html += '<button type="button" data-i="' + i + '">' + String.fromCharCode(65 + i) + ". " + o + "</button>";
      });
      html += "</div><div id='quiz-after'></div>";
      panel.innerHTML = html;

      panel.querySelector(".quiz-opts").addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || btn.disabled) return;
        var chosen = parseInt(btn.dataset.i, 10);
        var correct = chosen === item.a;
        if (correct) score++;
        panel.querySelectorAll(".quiz-opts button").forEach(function (b) {
          b.disabled = true;
          var i = parseInt(b.dataset.i, 10);
          if (i === item.a) b.classList.add("correct");
          else if (i === chosen) b.classList.add("wrong");
        });
        var after = panel.querySelector("#quiz-after");
        after.innerHTML = '<div class="quiz-expl"><strong>' + (correct ? "✅ 答对了！" : "❌ 不对哦。") + "</strong> " + item.ex + "</div>" +
          '<div style="margin-top:1rem"><button class="btn" id="quiz-next" type="button">' +
          (idx + 1 < QUESTIONS.length ? "下一题" : "看结果") + "</button></div>";
        document.getElementById("quiz-next").addEventListener("click", function () {
          idx++;
          if (idx < QUESTIONS.length) showQuestion(); else showResult();
        });
      });
    }

    function showResult() {
      var msg;
      if (score === QUESTIONS.length) msg = "满分！你对钱的理解已经超过了绝大多数人。可以把这个测验发给朋友试试。";
      else if (score >= 5) msg = "很扎实！错的那几题，对应的文章值得再翻一遍。";
      else if (score >= 3) msg = "已经入门了。建议把第一篇和第三篇再读一遍，很多概念会突然“通”。";
      else msg = "没关系——这正说明这些知识被刻意藏起来了。从第一篇《何为金钱》慢慢读起吧。";
      panel.innerHTML = '<p class="quiz-meta">测验完成</p>' +
        '<div class="big-stat">' + score + " / " + QUESTIONS.length + "</div>" +
        '<p class="stat-note">' + msg + "</p>" +
        '<div style="margin-top:1.2rem"><button class="btn" id="quiz-restart" type="button">再来一次</button> ' +
        '<a class="btn ghost" href="articles/01.html" style="margin-left:0.5rem">从第一篇读起</a></div>';
      document.getElementById("quiz-restart").addEventListener("click", function () {
        idx = 0; score = 0; showQuestion();
      });
    }

    showQuestion();
  })();
})();
