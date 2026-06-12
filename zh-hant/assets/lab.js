/* 胡侃比特 · 實驗室腳本
   所有實驗都在瀏覽器本地運行，不依賴任何服務器。 */
(function () {
  "use strict";

  /* ============ SHA-256 ============
     優先使用 Web Crypto；在不支持的環境（如某些 file:// 場景）下，
     退回到純 JS 實現（FIPS 180-4）。 */

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

  /* ============ ① 通脹時光機 ============ */
  (function () {
    var rate = document.getElementById("inf-rate");
    if (!rate) return;
    var years = document.getElementById("inf-years");
    var rateVal = document.getElementById("inf-rate-val");
    var yearsVal = document.getElementById("inf-years-val");
    var result = document.getElementById("inf-result");
    var note = document.getElementById("inf-note");
    var chart = document.getElementById("inf-chart");
    var START = 100; // 萬元

    function render() {
      var r = parseFloat(rate.value) / 100;
      var n = parseInt(years.value, 10);
      rateVal.textContent = parseFloat(rate.value) + "%";
      yearsVal.textContent = n + " 年";
      var remain = START * Math.pow(1 - r, n);
      result.textContent = "¥" + fmt(remain, 1) + " 萬";
      if (r === 0) {
        note.textContent = "沒有通脹的世界裏，價值的尺子是恆定的——100 萬永遠是 100 萬。這正是“恆定單位”的理想情況。";
      } else {
        var gone = START - remain;
        var half = Math.log(0.5) / Math.log(1 - r);
        note.textContent = "在 " + rate.value + "% 的年通脹下，100 萬存款 " + n + " 年後只剩約 " +
          fmt(remain, 1) + " 萬的購買力，憑空蒸發了 " + fmt(gone, 1) + " 萬（" + fmt(gone / START * 100, 1) + "%）。" +
          "按這個速度，購買力大約每 " + fmt(half, 0) + " 年減半。沒有人搶劫，也沒有人犯罪——這一切都是“合法”的。";
      }

      // 畫曲線
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
        '<text x="' + (padL - 6) + '" y="' + (padT + 4) + '" text-anchor="end">100萬</text>' +
        '<text x="' + (padL - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text>' +
        '<text x="' + padL + '" y="' + (Hh - 8) + '">今天</text>' +
        '<text x="' + (W - padR) + '" y="' + (Hh - 8) + '" text-anchor="end">' + n + ' 年後</text>' +
        '<text x="' + Math.min(endX - 8, W - padR - 4) + '" y="' + Math.max(endY - 10, 12) + '" text-anchor="end" fill="var(--accent-ink)">剩 ' + fmt(remain, 0) + ' 萬</text>';
    }

    rate.addEventListener("input", render);
    years.addEventListener("input", render);
    render();
  })();

  /* ============ ② 貨幣乘數機 ============ */
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
        row.innerHTML = '<span class="r-label">第 ' + round + ' 輪：存入 ¥' + fmt(deposit, 2) +
          '，銀行留 ¥' + fmt(keep, 2) + '，貸出 ¥' + fmt(loan, 2) + '</span><span>賬面累計 ¥' + fmt(total, 2) + "</span>";
        ledger.appendChild(row);
        ledger.scrollTop = ledger.scrollHeight;
        totalEl.textContent = "¥" + fmt(total, 0);
        deposit = loan;
        round++;
        if (deposit < 0.5 || round > 60) {
          clearInterval(timer); timer = null;
          runBtn.disabled = false;
          var mult = total / 100;
          note.textContent = "你的 ¥100 真實現金，在整個銀行體系的賬本上變成了約 ¥" + fmt(total, 0) +
            " 的“存款”——每個人都覺得自己有錢，但真實的現金只有 ¥100。放大倍數約 " + fmt(mult, 1) +
            " 倍。準備金率越低，憑空“造”出的錢越多。這就是貨幣乘數效應。";
        }
      }, 260);
    }

    rateEl.addEventListener("input", function () { updateMax(); });
    runBtn.addEventListener("click", run);
    resetBtn.addEventListener("click", reset);
    updateMax();
  })();

  /* ============ ③ 哈希實驗臺 ============ */
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
        note.textContent = "和上一次相比，64 個字符中有 " + changed + " 個變了。輸入只動了一點點，指紋卻面目全非——這就是雪崩效應。想悄悄篡改賬本而不被發現？不可能。";
      } else if (lastHash === hash && lastHash !== "") {
        note.textContent = "內容相同，指紋必然完全相同——這就是“可驗證”。";
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

  /* ============ ④ 挖礦模擬器 ============ */
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
            setTimeout(batch, 0); // 偶爾讓出主線程，保證頁面可響應
          } else {
            batch(); // 微任務鏈：避免後臺標籤頁的定時器節流
          }
        });
      }

      function finish(success, found, elapsed) {
        running = false;
        goBtn.textContent = "開始挖礦";
        if (!success) {
          logEl.textContent += "\n（已停止——這一區塊讓給別的礦工吧）";
          return;
        }
        var pretty = '<span class="zero">' + found.h.slice(0, difficulty) + "</span>" + found.h.slice(difficulty);
        resultEl.innerHTML = '<div class="success-card">📦 <strong>打包完成！</strong>紙箱已封死——箱裏那幾筆轉賬，從此誰也改不了。<br>⛏️ 第 <strong>' + fmt(found.n + 1) +
          "</strong> 次嘗試找到了以 " + difficulty + " 個 0 開頭的指紋（封條），用時 " + elapsed.toFixed(1) + " 秒。<br>" +
          '<span style="font-family:var(--mono);font-size:0.72rem;">' + pretty + "</span><br>" +
          "理論上平均要試 " + fmt(Math.pow(16, difficulty)) + " 次（運氣好就快，運氣差就慢——這就是“抽彩票”）。" +
          "想僞造這個區塊？一切從頭再試一遍。每個區塊都連着上一個區塊，改一個就要全部重挖——這就是不可篡改的能量成本。</div>";
      }

      batch();
    }

    goBtn.addEventListener("click", mine);
  })();

  /* ============ ⑤ 2100 萬與減半 ============ */
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
      issuedEl.textContent = fmt(issued / 10000, 0) + " 萬枚";
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
        '<text x="' + (W - padR) + '" y="' + (Y(CAP) - 6) + '" text-anchor="end">2100 萬上限 —— 永不超過</text>' +
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

  /* ============ ⑥ 小測驗 ============ */
  (function () {
    var panel = document.getElementById("quiz-panel");
    if (!panel) return;

    var QUESTIONS = [
      {
        q: "下面哪一項不是貨幣的三大功能之一？",
        opts: ["交換媒介", "定價單位", "價值儲存", "產生利息"],
        a: 3,
        ex: "貨幣的三大功能是：交換媒介、定價單位、價值儲存。產生利息是金融產品的屬性，不是貨幣本身的功能。詳見第一篇《何爲金錢》。"
      },
      {
        q: "1971 年發生了什麼大事，讓人類進入“純政府賬本時代”？",
        opts: ["美聯儲成立", "美元與黃金脫鉤", "佈雷頓森林體系建立", "歐元誕生"],
        a: 1,
        ex: "1971 年尼克松宣佈美元與黃金脫鉤，貨幣失去了錨定物的約束，開啓了隨意印鈔的時代。1971 年的 1 美元，購買力約等於 2024 年的 0.13 美元。"
      },
      {
        q: "在每年 2% 的通脹下，100 萬存款 30 年後的購買力大約還剩多少？",
        opts: ["約 94 萬", "約 70 萬", "約 55 萬", "約 40 萬"],
        a: 2,
        ex: "複利的力量：100 × 0.98³⁰ ≈ 55 萬。所謂“溫和通脹”，30 年悄悄拿走了你將近一半的購買力。可以去“通脹時光機”親手拖一拖。"
      },
      {
        q: "美元紙幣上印的 “Federal Reserve Note” 中，Note 最準確的意思是？",
        opts: ["筆記", "紙張", "備忘錄", "欠條 / 債務憑證"],
        a: 3,
        ex: "Note 在金融語境裏是“債務憑證”。美元的全稱其實是“美聯儲欠條”——所有法幣的底層都是債務。詳見第二篇《債務驅動的世界》。"
      },
      {
        q: "比特幣的總量上限是多少？",
        opts: ["1 億枚", "2100 萬枚", "2.1 億枚", "沒有上限，每年增發"],
        a: 1,
        ex: "2100 萬枚，寫死在源代碼裏，由全球兩萬多個節點共同守護。1 BTC 永遠 = 1/21,000,000 BTC。考慮到約 300–400 萬枚已永久丟失，實際流通量更少。"
      },
      {
        q: "比特幣的規則（比如 2100 萬上限）最終由誰守護？",
        opts: ["礦工", "交易所", "遍佈全球的節點", "中本聰本人"],
        a: 2,
        ex: "最關鍵的不是礦工而是節點——任何運行節點的普通人都在驗證規則。礦工就算挖出“違規區塊”，節點不承認，全網就不承認。2017 年的分叉幣 BCH 就是前車之鑑。"
      },
      {
        q: "“工作量證明（PoW）”證明的到底是什麼？",
        opts: ["礦工的數學水平很高", "真實消耗了能量，無法低成本僞造", "政府背書了這種貨幣", "礦機的算力品牌"],
        a: 1,
        ex: "PoW 證明的是“我真的付出了真金白銀的能量”。就像黃金的價值來自“再來一克需要 60 美元”的成本壁壘——任何資產的價值上限，取決於僞造它的成本。詳見第四篇《內在價值》。"
      }
    ];

    var idx = 0, score = 0;

    function showQuestion() {
      var item = QUESTIONS[idx];
      var html = '<p class="quiz-meta">第 ' + (idx + 1) + " / " + QUESTIONS.length + ' 題 · 當前得分 ' + score + "</p>" +
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
        after.innerHTML = '<div class="quiz-expl"><strong>' + (correct ? "✅ 答對了！" : "❌ 不對哦。") + "</strong> " + item.ex + "</div>" +
          '<div style="margin-top:1rem"><button class="btn" id="quiz-next" type="button">' +
          (idx + 1 < QUESTIONS.length ? "下一題" : "看結果") + "</button></div>";
        document.getElementById("quiz-next").addEventListener("click", function () {
          idx++;
          if (idx < QUESTIONS.length) showQuestion(); else showResult();
        });
      });
    }

    function showResult() {
      var msg;
      if (score === QUESTIONS.length) msg = "滿分！你對錢的理解已經超過了絕大多數人。可以把這個測驗發給朋友試試。";
      else if (score >= 5) msg = "很紮實！錯的那幾題，對應的文章值得再翻一遍。";
      else if (score >= 3) msg = "已經入門了。建議把第一篇和第三篇再讀一遍，很多概念會突然“通”。";
      else msg = "沒關係——這正說明這些知識被刻意藏起來了。從第一篇《何爲金錢》慢慢讀起吧。";
      panel.innerHTML = '<p class="quiz-meta">測驗完成</p>' +
        '<div class="big-stat">' + score + " / " + QUESTIONS.length + "</div>" +
        '<p class="stat-note">' + msg + "</p>" +
        '<div style="margin-top:1.2rem"><button class="btn" id="quiz-restart" type="button">再來一次</button> ' +
        '<a class="btn ghost" href="articles/01.html" style="margin-left:0.5rem">從第一篇讀起</a></div>';
      document.getElementById("quiz-restart").addEventListener("click", function () {
        idx = 0; score = 0; showQuestion();
      });
    }

    showQuestion();
  })();
})();
