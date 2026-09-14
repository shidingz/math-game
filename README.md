# 算算萌宠

幼儿园至六年级口算练习与宠物养成网页游戏。答题赚积分，积分可独立用于喂养或兑换伙伴。此目录是 **2026-09-14 整理后的独立开发项目**，可直接作为新的 Codex 项目打开，不需要原对话、上级文件夹或旧项目。

## 本地运行

安装 Node.js 22 或更高版本，在本目录运行：

```sh
npm start
```

- 正式版：<http://127.0.0.1:8766/>
- 测试版：<http://127.0.0.1:8766/?test=1>，也可访问 `/test.html`
- 如端口被占用：`PORT=8770 npm start`（macOS/Linux）。

运行、单元测试、资源检查和打包均无第三方依赖，**不需要 npm install**。也可以用任意静态 HTTP 服务器启动；建议通过 HTTP 访问，不依赖 file:// 下的浏览器存储行为。

```sh
npm test             # 游戏逻辑、角色播放器等自动测试
npm run check        # 检查素材哈希、坐标数据、入口引用和喂食时长
npm run build        # dist/ 中输出网页运行文件，排除文档、测试和单帧编辑素材
```

浏览器检查是可选项：先 `npm install --no-save --package-lock=false playwright`、`npx playwright install chromium`，再 `npm run test:browser`；已有 Chrome 可设置 `BROWSER_CHANNEL=chrome`。截图写入被 Git 忽略的 `artifacts/`。

## 新 Codex 项目如何继续

选择当前 `math-game` 文件夹作为项目目录。建议第一条消息：

> 先阅读 AGENTS.md、docs/DEVELOPMENT.md、docs/HANDOFF.md 和 docs/WECHAT-MIGRATION.md，运行现有检查，基于当前游戏继续开发微信小程序。保留已经确认的角色形象、积分规则和存档兼容性。

入口是根目录 `index.html`，不再有外层 `wukong-game/`。Git 仓库独立存在于当前目录，origin 为 `git@github.com:shidingz/math-game.git`。复制文件夹或重新克隆仓库都能继续开发。

## 当前内容

- 8 个伙伴：布偶猫、柯基犬、萨摩耶、暹罗猫、比熊犬、孙悟空、哪吒、玉兔。
- 首次正式游戏免费任选 1 个伙伴；其他伙伴每个 300 积分兑换。
- 幼儿园与 1—6 年级题库、可切换年级/范围、错题回顾。
- 每轮 10 题，每题答对 +10 积分；正确约 400ms 自动进入下一题，错误显示答案后手动继续。
- 喂食花 20 积分、增加 20 成长值，动画 500ms；喂养成功提示在宠物脚下、进度条上方。
- 累计约 30 道正确题到 Lv.6、80 道到 Lv.11、150 道到 Lv.15（奖励全部用于喂养时）；Lv.15 后每级 300 成长值继续升级，外观不再变化。
- 点击随机互动、低频随机待机、逐级特效与全屏暗背景升级展示。

测试版首次赠送 10,000 积分、解锁全部伙伴，可反复加分、改等级、直接升级和播放动作。它不是后端意义的无限积分服务；只有浏览器本地测试工具，存档与正式版隔离。

## 文件导航

| 路径 | 内容 |
| --- | --- |
| `index.html`、`game/` | 游戏入口、题库、积分/成长、主题、存档和交互 |
| `wukong.js`、`assets/` | 最新「可爱→灵动→帅气」孙悟空 |
| `characters/` | 其他七个角色的数据、播放器、特效和最终 PNG |
| `asset-inventory.json` | 从当前代码生成的完整素材清单、帧坐标、阶段、动作、等级、哈希 |
| `tests/` | 可重复执行的单元测试 |
| `scripts/` | 本地服务器、资源清单/检查/打包、浏览器验收 |
| `docs/` | 开发说明、角色制作指南、交接、清理范围和小程序迁移规划 |
| `.github/workflows/check.yml` | GitHub 自动测试与资源检查 |

## 发布

仓库：<https://github.com/shidingz/math-game>

正式版：<https://shidingz.github.io/math-game/>；测试版：<https://shidingz.github.io/math-game/?test=1>。

当前沿用 GitHub Pages 从 `main` 根目录发布，保留 `.nojekyll`。不要将来源改为 `docs/`，这里的 docs 是开发文档；`dist/` 仅用于其他静态托管，不提交到 Git。

```sh
git status
npm test
npm run check
npm run build
git add -A
git commit -m "Describe the change"
git push origin main
```

GitHub Pages 分支发布说明：[官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。推送完成后还应确认 Pages 部署成功，以及线上版本确实更新。

此项目目前是静态网页，不含微信 appid、小程序工程、服务器、登录或云存档。微信版本待后续开发，参见迁移文档。
