# 胡侃比特 · 站点特性总档（For Claude Design）

> 线上地址：https://roserparker.github.io/hukanbit/ ｜ 仓库：github.com/Roserparker/hukanbit
> 本档是站点全部特性的权威清单，供设计系统协作使用。代码镜像见同目录 reference/。

## 一、定位与声音

中文比特币科普「线上美术馆」。**五重沉浸**：美术、技术、学习、文学、游戏。
语气=耐心的科普作者（站长声纹：账本世界观/尺子思维/能量本位/窗户纸教学法）。
**铁律**：不喊单、不预测价格、不贩卖焦虑、嘲讽只对系统不对读者、文末必带风险提示。

## 二、页面地图

| 页面 | 角色 | 要点 |
|---|---|---|
| index.html | 序厅 | 流场尘埃+热力学₿+轨道徽记+活链+三步上手+黄历+足迹进度 |
| articles/01–05.html | 文献馆 | 五篇长文；01/03/05 内嵌互动游戏 |
| lab.html | 实验馆 | 10 个实验（编号①–⑩） |
| gallery.html | 货币文明长廊 | 巴洛克暗厅（强制深色）；贝币/第纳尔/活展品₿ |
| satoshi.html | 布道厅·中本聪文献 | 琥珀磷光终端（1979 amber CRT）；15 条带日期出处的原话，中英对照+主题滤波；创世 hex 打字机；PGP 告别框；永亮提示符 |

## 三、互动组件（12 个，[data-game] 挂载契约）

games.js 扫描 `[data-game]` 自动渲染；gm- 前缀类名；全部依赖 CSS 变量自动适配明暗。

1. **time-machine** 购买力时光机（1971→今，CPI 面包，21M 锁定条）
2. **pow-miner** 孤勇者矿工（点击跑真 SHA-256，自动模式，区块高度递增）
3. **mempool** 停车场（12 格区块，费率竞拍，0/1 背包最优解对照）
4. **bazi-calendar** 八字黄历（流年流月流日，五行配色，金水能量条；万年历锚点已验证）
5. **btc-ticker** 价格挂件（CoinGecko，$1≈N 聪，页脚，安静不闪烁）
6. **first-tx** 沙盒转账钱包（五步：地址校验防错码→聪滑块→费率三档→按住发送→广播 6 确认）
7. **chain** 首页活链（4 封存块+1 打包块+mempool 浮点；2.3s/笔装块、满 4 封存前进；悬停看交易与确认数）
8. 实验室另有 lab.js 旧四件：通胀时光机/货币乘数机/哈希实验台/挖矿模拟器 + 测验
9. **gallery 内联**：贝部字族造字考古（10 繁体字点选）、第纳尔含银量滑块（96%→5% 随帝国褪色）、实时区块高度（mempool.space→blockstream 兜底）
10. **double-spend** 双花问题（三幕剧：复制币→同币付两人→账本拒绝第二笔）
11. **byzantine** 拜占庭将军（9 将军沙盘，叛徒 0–4 可调，火漆印=PoW 开关，51% 警示）
12. **genesis 拓片**（首页内联于 main.js）：真实 coinbase hex ↔ 头条字母双向映射，拓印动画

实验室共 12 实验（①–⑫）；「2100 万与减半」附发行模型注释（几何级数收敛 + 节点验算双保险）。

## 四、美学四层宇宙（自下而上）

1. **气**（flow.js 全站底层 canvas）：暗金尘埃柏林噪声流场 + Boids 三力（聚/游/离）+ 结缘金线；指尖力场=径向斥 0.45+切向绕行 0.30，缓动 0.12；**光之画笔**：鼠标轨迹=一条 1.05s 消逝的金线（两遍渲染晕光+笔芯）；尘埃向指尖结网；**闲笔成形**：动 360px 后静 2.6s，残光收束成单线 ₿ 手势（0.9s 画入/0.6s 停/1.1s 散）
2. **能量**：hero 热力学 ₿（黑体辐射渐变 #f6c453→#e8702a→#8a2c0d，暗色更亮；6.5s thermal-breathe；双层 drop-shadow）；文章页眉 ₿ 暗纹（静止）
3. **秩序**：轨道徽记（3 椭圆+卫星点，110s/圈）；活链；页脚瓷器底款 ₿ 方印
4. **文明**：纸面排版（衬线中文、弦纹 .rule 双细线、Tag 胶囊、celadon 豆青引线）

**美术宪法**：①暗厅+单侧金光（巴洛克）②每屏装饰 ≤4（雍正）③插画一律单线（毕加索）④动效慢于呼吸（道）⑤凡金额必佩 gm-coin 铸币徽记（₿ 斜 12°，铸币凹凸 box-shadow）⑥凡消逝快于注意（光绘 ≈1s）。

## 五、设计令牌（权威值在 style.css）

- 明：paper #faf7f1 / ink #221e18 / line #e5ddcf / **accent #c2410c** / accent-ink #9a3412 / celadon #87a796
- 暗：paper #191613 / ink #e8e2d6 / **accent #f08c3e** / celadon #7fa090
- **长廊强制暗**（body.gallery-page 覆盖变量）：paper #14100c / card #1e1812 / line #362d21
- 五行（games.css）：木 #4d7c57 火 #b5483a 土 #9a6b2f 金 #a8861d 水 #3f6e9e（暗色各提亮）
- 字体：衬线 Songti/Noto Serif SC；UI 无衬线系统栈；数字 tabular-nums + mono
- 圆角：卡 10–12 / 胶囊 999 / 钱包 16；缓动署名曲线 cubic-bezier(0.22,0.61,0.36,1) 0.3s
- 点击涟漪：40px 1px 细线环 0.55s；卡片 hover -4px 双层柔影

## 六、工程特性

- 纯静态零依赖零构建；file:// 可直接打开；GitHub Pages 自动部署（push 后约 1 分钟）
- 真实算法：纯 JS SHA-256（FIPS 测试向量验证）；八字干支（1900/2000 双锚点+立春/节气边界验证）
- 外部 API 仅三个（全部优雅降级）：CoinGecko 价格、mempool.space/blockstream 区块高度
- 学习足迹（仅 localStorage，无上传）：hkb-read-01..05 / hkb-lab / hkb-gallery / hkb-mined / hkb-first-tx → 首页 ✓已读标签、进度语、三步上手完成态
- 无障碍：prefers-reduced-motion 全链路尊重（流场整层不渲染/呼吸停/涟漪关）；:focus-visible 焦点环；aria-label 齐备
- 性能：粒子 36–110 自适应、DPR≤2、document.hidden 休眠、涟漪并发≤12

## 七、规划中（MUSEUM-PLAN.md 详设）

长廊扩至 8 件展品（雅浦石币/交子/佛罗林/魏玛/津巴布韦）→ 长廊集章寻宝 → 布道厅（中本聪文献）→ 全馆导览图。

## 八、可调用的思维 Skills（本机）

armstrong（产品/信任/简单）· hukanbit-author（站长声纹写作）· picasso（品味裁判/减法）· huashu-nuwa（造新 skill）。

## 九、兼容性宪法（2026-06-12 馆主令）

**目标排序：中国大陆可达性 > 低端手机性能 > 全设备兼容（iOS/Android/iPad/桌面）。**

- **零 GFW 阻塞依赖**：字体走 fonts.loli.net 镜像且 media=print 异步加载（镜像失效→静默回退系统字体，永不阻塞首屏）；无 Google/Facebook/CDN 阻塞资源
- **外部 API 仅三个且全部优雅降级**（CoinGecko 价格 / mempool.space·blockstream 区块高度）——失败只显示"暂不可用"，不影响任何核心功能；全站核心 100% 本地运行
- **性能**：flow.js 移动端粒子 ≤40（桌面 ≤110）、DPR≤2、hidden 休眠、涟漪限流、reduced-motion 全链路
- **已知风险与路线**：github.io 在大陆间歇性受限——路线 A 绑定自定义域名 + Cloudflare；路线 B Gitee Pages 同步镜像。待馆主选择。
- **分享层**：九页 OG/Twitter Card + assets/og-cover.png（1200×630）

## 十、云游路牌（index #wayfinding）

赛博指路牌：中柱挑 ₿ 灯，六块箭头 signage 左右错落（clip-path 箭尖，纯 CSS 零脚本）。出口：BitcoinTalk / bitcoin.org 白皮书 / 中本聪研究所 / mempool.space / BTCStudy（中文）/ learnmeabitcoin。含安全提示（助记词）与网络环境注明。hover 守瓷器教义（只亮不动）。
