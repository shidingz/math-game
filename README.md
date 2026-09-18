# 算算萌宠

幼儿园至六年级口算练习与宠物养成网页游戏。答题赚积分，积分可独立用于喂养或兑换伙伴。此目录是 **2026-09-14 整理后的独立开发项目**，可直接作为新的 Codex 项目打开，不需要原对话、上级文件夹或旧项目。

## 当前版本：照片制作服务（2026-09-18）

当前开发版本为 `wechat-v22-photo-service`。新增真正使用相机/相册、IndexedDB 和 HTTP 的 Canvas 网页客户端 `wechat/browser/`，以及在本机电脑运行的 `server/` 制作服务。灰猫案例已通过 4 次第三方生图请求生成三阶段、27 个动作；当前构建为 8 个内置伙伴加 1 个灰猫「新伙伴」。原根目录网页仍保留，两个网页入口不要混用。

制作服务只使用固定提示词调用生图 API；裁切、配色、名称、ID、图集与宠物注册全部按规则处理，没有额外 AI 质检、文本命名或代码生成。新伙伴免费拥有、可多次制作、改名与独立成长。固定格式检查不等于美术语义审核。

真实网页全流程已通过公开 Cloudflare HTTPS：照片上传、排队、4 次 302.AI 图片请求（无重试）、固定规则裁切、免费加入列表首位和刷新保存；三个远程阶段图集实际以 1536×1536 加载。首套随包灰猫 4 次加本次真实验收 4 次，共 8 次图片请求，没有其他 AI 调用；新生成伙伴仅归测试会话，预置包仍为 9 个伙伴。 灰猫另通过 81 个动作组合、6 次进化与 3 种视口的浏览器检查。

新版已发布到 [GitHub Pages /dev/](https://shidingz.github.io/math-game/dev/)，部署代码提交为 `5922dde`。首轮环境分支限制已由用户修正，第二轮构建与部署均成功；已用全新未登录浏览器验证线上 9 伙伴、三阶段和服务跨域健康检查。主站根页仍与 main 字节一致。本轮未做微信真机或审核发布。启动与构建见 [本机照片制作服务](docs/LOCAL-PET-SERVICE.md)，实测记录见 [VALIDATION](docs/VALIDATION.md)。

## 本地运行

安装 Node.js 22 或更高版本，在本目录运行：

```sh
npm start
```

- 正式版：<http://127.0.0.1:8766/>
- 测试版：<http://127.0.0.1:8766/?test=1>，也可访问 `/test.html`
- 如端口被占用：`PORT=8770 npm start`（macOS/Linux）。

原根目录网页的运行、`npm test`、资源检查和 `npm run build` 均无第三方依赖，**不需要 npm install**。微信素材导出与本机制作服务另外需要 sharp，可用 `npm --prefix server install` 安装独立服务依赖。也可以用任意静态 HTTP 服务器启动；建议通过 HTTP 访问，不依赖 file:// 下的浏览器存储行为。

```sh
npm test             # 游戏逻辑、角色播放器等自动测试
npm run check        # 检查素材哈希、坐标数据、入口引用和喂食时长
npm run build        # dist/ 中输出网页运行文件，排除文档、测试和单帧编辑素材
npm run pet:serve    # 本机制作服务；需先配置两个私有 env 文件和独立服务依赖
npm run test:pet-server # 假 worker 服务测试，不调用收费 API
```

浏览器检查是可选项：先 `npm install --no-save --package-lock=false playwright`、`npx playwright install chromium`，再 `npm run test:browser`；已有 Chrome 可设置 `BROWSER_CHANNEL=chrome`。截图写入被 Git 忽略的 `artifacts/`。

## 新 Codex 项目如何继续

选择当前 `math-game` 文件夹作为项目目录。建议第一条消息：

> 先阅读 AGENTS.md、docs/DEVELOPMENT.md、docs/HANDOFF.md 和 docs/WECHAT-MIGRATION.md，运行现有检查，基于当前游戏继续开发微信小程序。保留已经确认的角色形象、积分规则和存档兼容性。

入口是根目录 `index.html`，不再有外层 `wukong-game/`。Git 仓库独立存在于当前目录，origin 为 `git@github.com:shidingz/math-game.git`。复制文件夹或重新克隆仓库都能继续开发。

## 当前内容

- 8 个内置伙伴（v22 Canvas 构建另含灰猫案例，共 9 个伙伴）：布偶猫、柯基犬、萨摩耶、暹罗猫、比熊犬、孙悟空、哪吒、玉兔。
- 首次正式游戏免费任选 1 个伙伴；其他伙伴每个 200 积分兑换。
- 幼儿园与 1—6 年级题库、可切换年级/范围、错题回顾。
- 每轮 10 题，每题答对 +10 积分；正确约 400ms 自动进入下一题，错误显示答案后手动继续。
- 喂食花 20 积分、增加 20 成长值，动画 500ms；喂养成功提示在宠物脚下、进度条上方。
- 累计约 30 道正确题到 Lv.6、100 道到 Lv.11、150 道到 Lv.15（奖励全部用于喂养时）；Lv.15 后每级 300 成长值继续升级，外观不再变化。
- 点击随机互动、低频随机待机、逐级特效与全屏暗背景升级展示。

原根目录网页测试版首次赠送 10,000 积分、解锁全部伙伴，可反复加分、改等级、直接升级和播放动作。新版 Canvas 显式测试构建显示 ∞ 积分，交易后按本机测试规则恢复余额；两者都不是服务端可信积分系统，正式与测试存档隔离。

## 文件导航

| 路径 | 内容 |
| --- | --- |
| `index.html`、`game/` | 游戏入口、题库、积分/成长、主题、存档和交互 |
| `wukong.js`、`assets/` | 最新「可爱→灵动→帅气」孙悟空 |
| `characters/` | 其他七个角色的数据、播放器、特效和最终 PNG |
| `asset-inventory.json` | 从当前代码生成的完整素材清单、帧坐标、阶段、动作、等级、哈希 |
| `tests/` | 可重复执行的单元测试 |
| `scripts/` | 本地服务器、资源清单/检查/打包、浏览器验收 |
| `wechat/browser/`、`scripts/build-web-game.cjs` | 真实 Canvas 网页适配器与独立静态站构建，不使用微信 preview shim |
| `server/` | 本机口令制作服务、持久任务与异步 worker、独立依赖及假数据测试 |
| `assets/custom-pets/` | 可发布的最终自定义伙伴 PNG 和数据包；中间过程仍仅在 artifacts |
| `docs/` | 开发说明、角色制作指南、交接、清理范围和小程序迁移规划 |
| `.github/workflows/check.yml` | GitHub 自动测试与资源检查 |

## 发布

仓库：<https://github.com/shidingz/math-game>

正式版：<https://shidingz.github.io/math-game/>；测试版：<https://shidingz.github.io/math-game/?test=1>。

原站此前由 GitHub Pages 的 `main` 根目录发布。新增 `.github/workflows/deploy-dev.yml` 在 `dev` 推送后用 Actions 发布，保留 main 的原站，并把新版 Canvas 放到 `/dev/`。Pages 来源使用 GitHub Actions，且 `github-pages` 环境需允许 dev 分支。dev `5922dde` 的构建与部署已成功，线上 9 伙伴和服务跨域连通已验证。不要将来源改为 `docs/`，这里的 docs 是开发文档；`dist/` 仅用于其他静态托管，不提交到 Git。

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

本仓库保留静态网页，并新增 `wechat/` 中的原生 Canvas 微信小游戏实现与导出脚本。小游戏复用题库、积分和成长逻辑，内置角色按宠物分包加载；v22 新增独立本机制作后台，但没有云成长存档或支付。使用现有小游戏工程的配置导出，保留其 AppID。

微信版本新增自定义伙伴客户端：多次拍照/选图、制作记录、通用素材包、多宠物分页与独立成长。新版浏览器通过访问口令连接本机服务，按服务地址保存会话，刷新后恢复制作任务；未配置地址时仍保存本机草稿。原生微信的 wx.login 分支尚未与口令服务联调，不能把网页连接当作微信身份认证。现行用法见 [docs/LOCAL-PET-SERVICE.md](docs/LOCAL-PET-SERVICE.md)，图片包背景说明见 [docs/CUSTOM-PETS.md](docs/CUSTOM-PETS.md)。

照片制作默认使用302.AI `gpt-image-2.5-sunburst`，通用提示词支持任意生物、任意阶段的图片，半写实画风与奇幻内容分开。正常四张角色图：三阶段设定＋三个动作图集。动作不再模仿猫的姿态或食物；头像、主色匹配、场景、特效和配置按固定规则生成。新生成伙伴免费拥有、最新的显示在列表第一位；其他内置伙伴200积分兑换，首次免费初始领养保持。

当前默认使用透明模板提示词 `alpha-original-v1`，参考选择继承 `generic-original-v2`：自然主体照片保留可用特征；插画、虚拟角色或无法判断的输入默认只提供宽泛主题，再统一制作三个阶段动作。此默认规则也适用于用户自己的插画，不依赖模型认出具体角色名。单图、多图使用相同文案。实际模型未必执行原创分支，不能把提示词当作版权判断或审核结论；明确失败的请求不会自动换模型重试。[查看完整设计提示词](docs/prompts/gpt-pet-alpha-design.txt)。

`npm run pet:generate` 是可恢复的本地异步任务，每次执行推进任务，待返回后再次执行同一命令，不会重复提交已保存的任务。转换规范先于生图锁定，见 [docs/FANTASY-PET-CONTRACT.md](docs/FANTASY-PET-CONTRACT.md)；既有Sunburst小柴记录见 [docs/302-PET-ART.md](docs/302-PET-ART.md)。历史Seedream流程保留为 `pet:generate:seedream`。v22 的 `server/` 通过异步子进程推进同一流水线，提供持久单队列；它不是支付订单系统。

默认 `pet:generate`（也可用 `pet:generate:alpha`）使用真正的透明PNG三格/九格模板，模板只有黑色分界线。提示词要求精确排版和留白；程序允许尺寸、格线与主体位置的小幅偏差，清理低透明度噪点和已识别直线，再寻找透明间隙分格，保留原Alpha、统一缩放并补游戏留白。多个返回候选按同一规则检查选择，转换不调用AI。支持 `--stop-after design` 或 `stage1`/`stage2`/`stage3` 暂停，真实美术仍需查看。[透明模板与容错裁切规范](docs/ALPHA-PET-PIPELINE.md)。

旧灰底模板保留为 `pet:generate:guided`，兼容原任务与 `--design-image` / `--action-images` 导入；直接生图入口为 `pet:generate:direct`，独立模板实验为 `pet:layout-study`。[旧模板实测记录](docs/GUIDED-PET-LAYOUT.md)。

```sh
# 微信素材导出与本机制作服务需要 sharp，原有网页命令仍无安装依赖。
npm install --no-save --package-lock=false sharp
npm run build:wechat -- --out /path/to/staging --config /path/to/minigame-1/project.config.json
# 如需测试构建，再加 --test，并在微信编译条件中传 test=1。
```

导出与真机验收说明见 [wechat/README.md](wechat/README.md)；迁移边界与限制见 [docs/WECHAT-MIGRATION.md](docs/WECHAT-MIGRATION.md)。`npm run test:wechat-browser` 可针对导出目录的本机 HTTP 服务运行隔离浏览器验收，需要 Playwright 与 Chrome。

最新固定流水线默认以萨摩耶三阶段作画风参考，所有新伙伴统一名为「新伙伴」，自动生成独立ID。按用户要求，生成后只作像素与格式检查，不调用AI质检或个性化代码。运行时使用48项场景素材与32种程序特效图形、20套主题组合，按像素配色、稳定随机种子与等级组合背景/特效，程序驱动动画；旧大幅预制背景已停用，每次用户生成仍只需四次宠物生图请求。完整说明和运行时接口审计见 [docs/RULE-ONLY-PET-FLOW.md](docs/RULE-ONLY-PET-FLOW.md)。

微信手机版使用更大的背景展示框，宠物逐级长大但满级仍留有活动空间。成长条只提示下一次进化还差多少题：累计30题对应Lv.6、100题对应Lv.11（积分用于喂养），Lv.11起显示“已达终极形态”。室内与室外先等概率分组，再按宠物色调选场景。旧Q版特效已停用，宠物特效参照线上原版的雪晶、月牙、莲纹、祥云与护盾主题，取消彩带与细碎粒子；16种生活背景增加动态物件，已解锁伙伴会按真实阶段偶尔来访，互动时双方等大分站两侧，详见[原版主题特效与伙伴互动](docs/WEBSITE-EFFECTS.md)。

微信首页现支持自定义伙伴点击改名（本机保存）、从小体型逐级长大，以及选择练习范围后返回主页再开始做题。早期星环/光带设计记录见[程序成长与交互说明](docs/CLEAN-GROWTH-EFFECTS.md)，当前主题外观以[原版主题特效](docs/WEBSITE-EFFECTS.md)为准。
