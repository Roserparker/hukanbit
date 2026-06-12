# 胡侃比特 · 设计笔记

## 设计基因
本站的视觉语言：安静杂志风（纸张色 + 衬线中文 + 琥珀 accent #b45309），定位纯科普、反 FOMO。
**这一层是品牌，不可被替换。**

## 三重熔接（2026-06-11）：站长声纹 × 雍正瓷器 × 复古未来主义
- **站长声纹**：蒸馏为 `~/.claude/skills/hukanbit-author-perspective/`（6/6 质检，100% 一手语料）。全站新文案须过该 skill 的反模式清单（不喊单、嘲讽对系统不对读者、幽默后上秤）。
- **雍正瓷器（克制层）**：单色釉思路——新增 `--celadon`（豆青 #87a796 / 暗色 #7fa090）只用于 blockquote 弦线与链环；`.rule` 改为双道细线（弦纹）；页脚 `.inner::after` 是"底款"——双方框 ₿ 印，落在每页最末，如瓷器底部款识。原则：增一分则拙，全站可见的新装饰 ≤4 处。
- **复古未来主义（动效层）**：首页 hero 背景 = 三道椭圆轨道 + 卫星点（data-URI SVG，110s/圈缓慢自转，原子时代太空徽章式），轨道中心一枚 26vw 的衬线 ₿（accent 色 5% 透明度，静止）；文章页眉右上 8.5rem ₿ 暗纹（4%）。所有透明度暗色模式微调上浮；reduced-motion 下轨道停转。
- **₿ 进背景的三个位置**：hero 轨道中心（仪式感）→ 文章页眉（暗纹）→ 页脚底款（印章）。同一符号，三种身份：天体、水印、款识。
- **活的区块链**（首页 hero，data-game="chain"）：4 个已封存区块 + 1 个打包中虚线块 + mempool 浮点。每 2.3s 装入一笔转账，装满 4 笔封存（暖橙闪光）、链条前进、确认数随之增长。悬停/点按看区块内转账（转账文案带站长味：爷爷给孙子的压岁钱等）。这是 mempool 停车场游戏的"环境版镜像"——不需要操作，看着就懂挖矿。
- **亮橙暖色**（2026-06-12 应用户要求）：主色从烬琥珀 #b45309 提亮为暖橙 #c2410c（暗色 #f08c3e），hero 加 radial 炉火光晕（accent-wash），主 CTA 用 .btn.warm（橙底+暖阴影），favicon 同步。理由："让人因为美术想留下来"——暖度↑但仍是釉色逻辑，不是荧光橙。
- **点击涟漪**（全站）：pointerdown 处荡开一圈 1px 细线声呐环（accent 色，0.55s，cubic-bezier 同卡片缓动）。属于"反馈"不占装饰名额；限流 ≤12 个并发（挖矿连点场景）、reduced-motion 全关、右键中键不响。卡片 :active 轻微"落座"配合。实现：main.js spawnPing + style.css .click-ping。

## Armstrong/Coinbase 蒸馏的应用（2026-06-11）
来源：`~/.claude/skills/brian-armstrong-perspective/`（由女娲 skill 蒸馏，6/6 质检通过）。

应用的是**原则**而非皮肤——刻意没有引入 Coinbase Blue，因为本站的信任感来自纸张与排版，而非金融蓝：

| Armstrong 原则 | 本站落地 |
|---|---|
| 每屏一个主行动 | 首页 hero 增加主 CTA「从第一篇开始读」（之前没有任何行动入口） |
| 3 步到首次成功 | 首页「三步上手」：读第一篇 → 挖一个区块 → 模拟转账 |
| 教育即漏斗（Earn 模式） | localStorage 学习足迹：文章 ✓已读 标签、阅读进度条、三步完成态（hkb-read-NN / hkb-lab / hkb-mined / hkb-first-tx），纯本地、不上传 |
| 信任微文案 | 三步区下方："全程免费 · 无需注册 · 不收集任何数据" |
| 数字是主角 / tabular | 游戏组件沿用 gm-big + tabular-nums（已有，保持） |
| 不碰媚俗 | 全站既有原则，与 Armstrong 反模式一致（无火箭/倒计时/红绿轰炸） |

## 组件契约
- 互动组件经 `[data-game]` 挂载：time-machine / pow-miner / mempool / bazi-calendar / btc-ticker / first-tx
- games.css 类名一律 `gm-` 前缀；颜色只用 style.css 的 CSS 变量（自动暗色模式）
- 五行配色 token：`--el-wood/fire/earth/metal/water`（games.css，亮暗双套）
- 学习足迹 key：`hkb-read-01..05`、`hkb-lab`、`hkb-mined`、`hkb-first-tx`
