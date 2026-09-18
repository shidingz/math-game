# 开发说明

当前开发版本为 `wechat-v23-classic-home`：浏览器首页恢复经典 DOM 伙伴卡片，手机自然滚动、桌面双栏；Canvas 只承担角色动画与操作弹窗。生成服务、会话存档键和成长规则不变；微信原生布局保持原样。浏览器样式从 `game/game.css`、`game/theme.css` 和 `wechat/browser/classic.css` 合成，构建版本覆盖 HTML/CSS/JS。203 单测与三视口 729 动作边界/交互验证通过，详见 [VALIDATION.md](VALIDATION.md)。

v22 历史记录：保留 v21 的背景、主题特效与双伙伴互动，新增本机制作服务与真实浏览器适配器。灰猫案例已完成四次图片 API 生成、三阶段 27 动作，当前构建共 9 个伙伴。公开 Cloudflare 上的真实上传→4 次生图→裁切→领取→刷新全流程已通过，远程三阶段 1536×1536 图集加载正常；当前随包仍 9 个伙伴，新任务只属于验收会话。dev 的 `5922dde` 已构建并发布到 GitHub Pages `/dev/`，线上页面和服务连通检查通过。201 项通用测试、7 组服务测试及灰猫 81 动作组合/6 次进化/3 视口检查通过，完整实测边界见 [VALIDATION.md](VALIDATION.md)。操作见 [LOCAL-PET-SERVICE.md](LOCAL-PET-SERVICE.md)，主题视觉见 [WEBSITE-EFFECTS.md](WEBSITE-EFFECTS.md)。

## 微信自定义宠物增补

默认素材生成使用`pet:generate:alpha`（同`pet:generate`）：透明PNG黑线模板、Alpha保留与容错分格、统一图集及像素配色；多候选按固定检查选择。真实案例、规则及命令见[透明模板规范](ALPHA-PET-PIPELINE.md)。标准输出仍为`template-v1`，新增宠物仅注册数据包，不增加角色专属渲染代码。灰底历史流程保留`pet:generate:guided`。

`wechat/runtime/custom-pets.js` 校验数据包并构造共享动作配置；`pet-studio.js` 管理多任务、多宠物注册与去重；`pet-service.js` 封装可配置的登录/上传/制作接口。`platform.js` 在原存档中保留 `customPetLibrary` 与 `customPetNames`（用户按宠物ID起的本机别名）；成长仍由原 `game/core.js` 处理。新增照片和接口不会改变网页注册表；普通伙伴兑换价已按新要求统一为200积分。协议、固定图片格式和接入命令见 [CUSTOM-PETS.md](CUSTOM-PETS.md)。v22 已实现 `server/` 本机口令会话、照片所有权和单 worker 队列，以及 `wechat/browser/` 的真实文件选择/IndexedDB/fetch 适配；没有配置地址时仍仅保存草稿。原生微信 wx.login 分支需另接身份服务，不能直接把微信 code 送给口令登录。现行服务契约见 [server/README.md](../server/README.md)。

微信小游戏适配源在 `wechat/runtime/`，通过 `npm run build:wechat` 导出。`game/core.js`、`growth.js`、`questions.js` 在导出时原样复制到 `shared/` 并记录哈希；不要在导出目录直接分叉积分或成长规则。微信专用测试位于 `tests/wechat.test.cjs`，浏览器流程验收位于 `scripts/wechat-smoke.cjs`。原网页的入口与素材版本未因新增平台而变更。

微信独立测试构建使用 `--test --test-default`，在非release环境默认进入无限积分模式，`test=0` 可核对正式规则；不带这些选项仍是正式构建。无限积分由控制器在测试交易后恢复原数值余额，UI显示∞，不修改共享Core或正式存档。生成完成的伙伴在正式与测试模式均免费拥有，最新伙伴排在列表前部，保留各自进度；首次普通初始领养保持。`scripts/wechat-unlimited-smoke.cjs` 覆盖实际素材、零余额喂养、刷新与正式隔离。

## 技术结构

原根目录网页是纯 HTML/CSS/JavaScript，没有框架或外部 CDN。新版 Canvas 网页由 `scripts/build-web-game.cjs` 打包微信通用运行层与浏览器适配器，后台在本机 Node HTTP 进程运行；没有云端成长账户系统或支付。脚本通过 index.html 的 defer 顺序加载，运行时使用全局命名空间。questions.js、growth.js、core.js、test-tools.js 同时兼容 CommonJS，Node 单元测试可直接加载。

| 模块 | 职责 |
| --- | --- |
| game/questions.js | 年级/题型定义、随机出题、有理数解析运算、答案等价判断、题目校验 |
| game/growth.js | 14 个升级门槛、累计成长值、实际等级到外观等级映射 |
| game/core.js | 新存档与迁移、初始领养、答题结算、喂养、兑换、切换伙伴、错题回顾 |
| game/characters.js | MathPetCharacters 注册表及悟空配置；其他 *-character.js 为角色适配器 |
| game/themes.js / theme.css | 角色色系、场景装饰、缩放、手机与桌面布局 |
| game/interaction.js | 随机点击/待机调度，喂食与弹窗时暂停，销毁时清理 |
| game/wukong-level-up.js / .css | PetLevelUp，全角色共用的全屏升级流程（文件名沿用历史命名） |
| game/app.js | DOM 绑定、弹窗、渲染、答题自动切换、提示和调试面板 |
| game/storage.js / test-tools.js | 正式/测试存档选择、测试交易工具 |
| wukong.js / characters/* | Canvas 角色播放器；多数角色另外有 SVG 背景特效生成器 |
| wechat/browser/* | 真实网页 API、按服务地址分开的会话/存档和 IndexedDB 照片 |
| scripts/build-web-game.cjs | 从微信导出构建独立 Canvas 静态站，只接收公开 URL 与素材域名 |
| server/service.cjs / pipeline-worker.cjs | 口令会话、幂等队列、规则交付与异步恢复生图任务 |

依赖顺序：角色数据/播放器及题库成长 → core 与 themes → 注册表和角色适配器 → test-tools/storage/interaction/level-up → app。注册表顺序影响伙伴选择界面，不要靠移动图片文件改变顺序。当前顺序应从实际脚本与注册表读取，不把本文件列表当作排序配置。

## 规则与状态

答对一次结算 10 积分，重复提交同一道已答题不会再次奖励。每轮 10 题；题目正确后约 400ms 自动进入下一题，错题展示答案和解释，由用户手动继续。最近 30 道错题保存在 mistakes；新轮次从符合年级/范围的最近错题中取至多两题复习。题目使用约分后的 `{n,d}`，避免小数浮点误差；不要改成简单字符串或浮点相等。

年级值 0 是幼儿园，1—6 对应小学；范围由 questions.GRADES[].topics 和 balanced 组成。切换年级/范围会重建当前练习轮次，角色成长保留。

升级门槛（离开 Lv.1 至 Lv.14）为：

```js
[40,40,60,80,80,120,140,140,140,160,120,120,120,140]
```

累计 300/1000/1500 成长值到 Lv.6/11/15。每份食物消耗 20 分并给 20 成长值，先扣分再播放 500ms 动画，完成后展示提示或升级。Lv.15 起每级门槛 300；core 中保存实际等级，播放器最多接收 15 的外观等级。进化只发生于进入 6 和 11。题数换算假定全部答对且积分都用于喂养；兑换角色会消耗同一个钱包，不能保证只按答题总数就升级。

首选宠物通过 chooseStarter 一次性免费发放；其他由 unlockPet 主动兑换，每只 200 分、重复兑换不再扣分。feed 与 startRound 完全独立，没有“必须做完一轮才能喂养”的限制。

存档主要字段：version=4、growthVersion=2、starterChosen、starterPet、points、activePet、unlockedPets、pets[id]={level,growth,feeds}、grade、topic、round、totalSolved、totalAnswered、totalRounds、mistakes。迁移接受版本 1—4；精卫的旧进度放在 retiredPets，不显示在游戏内。growthVersion缺失的旧标准曲线存档保留等级，并把当前等级的成长按旧/新门槛比例转换一次；不改积分、喂养次数和所有权。Lv.15以上门槛仍300，不从新的Lv.14门槛推导。

| 入口 | localStorage key |
| --- | --- |
| 正式版 | math-pet-game:v2（载荷 version=4，与 key 版本不是同一概念） |
| 测试版 | math-pet-game:test:v1 |
| 旧正式版迁移读取 | math-pet-game:v1 |

上表是原根目录网页的存档键。新版 Canvas 网页另以 `math-pet-web:game:v1:<formal|test>:<编码后的服务地址>` 隔离；切换制作服务只带入内置/随包伙伴进度，不把另一服务的远程伙伴和任务发送过去。会话 token/过期标记按完整服务地址保存，原照片在 IndexedDB。401 后停止业务请求，旧 token 仅在输入正确口令后用于同地址续期，保留原 owner 的任务。后端只持久制作任务和结果，不同步宠物等级/积分。

存档按 origin 隔离。localhost 的不同端口、GitHub Pages、微信小程序之间不会自动同步；本仓库不含真实用户存档。不要为了测试读取或覆盖用户现有浏览器存储，浏览器测试使用隔离上下文。

## UI、动画与生命周期

手机首页喂养和做题两列，宠物为主要视觉区域。game.css 是基础，theme.css 包含后续主题和紧凑布局覆盖；修改前先看最终计算样式。测试面板额外占高度，测试版允许滚动，正式主页以常见手机/电脑一屏体验为目标；年级、选宠物和做题弹窗可独立滚动。

feed-notice 位于 pet-scene 底部，在宠物脚下、growth 上方，显示 2200ms；出现时临时隐藏 touch-hint，pointer-events:none，不会阻挡按钮。其他 toast 也不拦截点击。连续喂养刷新提示，切换角色清除旧提示。

角色适配器返回 element、play、setLevel、pause、action、on、destroy。底层派发 pet-interact、pet-actionend、pet-ready、pet-error 等事件。随机待机通常每 10—18 秒触发；对话框/喂食/页面隐藏时应暂停。多次升级、关闭、失败等流程由 PetLevelUp 取消/清理，避免原角色永久隐藏。

图像是 RGBA 位图姿势帧，动作是帧切换 + 平移/跳跃/倾斜 + Canvas/SVG/CSS 特效，不是骨骼动画。各角色图集规格不同，见 asset-inventory.json。孙悟空、哪吒包含大幅武打姿势，需要手机边界适配；不要仅放大整个画布而裁掉兵器。尊重 prefers-reduced-motion。高 DPI 画布并不等于无限清晰，源姿势分辨率和手机 GPU 内存仍是限制。

## 修改与验证

1. 从 README 启动游戏，确认 ?test=1 的可控测试状态。
2. 先修改纯数据/交易逻辑，再更新适配器和 UI；角色艺术修改仅影响对应角色。
3. 修改图片或动作数据时 `npm run assets` 更新清单；`npm test` 和 `npm run check` 应通过。
4. 运行 `npm run build` 验证精简运行包独立生成；它不包含编辑用单帧。
5. 运行浏览器检查，覆盖手机和桌面、所有角色三形态、喂食、正确自动下一题、错误手动下一题、兑换、存档、全屏升级。
6. 核实资源版本号后提交。不要把截图、node_modules、旧设计稿或生成原图放进发布树。

scripts/project.cjs 的运行文件列表用于 dist 打包；新增脚本必须同时加入此列表或对应扫描规则。新增图片应更新资产收集规则，避免运行包缺图。

## 固定照片宠物流程

新任务使用默认Alpha Worker，名称固定、ID自动、画风参考按配置选择。禁止接入额外命名、视觉或代码模型；AI仅用于四张宠物图。现行微信使用 `kingdom-scenes.js` 的48项Q版背景素材、`effect-motifs.js`的32种完整图形与`pet-particles.js`的20套主题组合，不加载旧 `assets/fantasy-scenes/` 大背景；旧图只保留历史。`pet-geometry.js` 决定手机舞台和各动作安全缩放。审计与异常恢复见 [RULE-ONLY-PET-FLOW.md](RULE-ONLY-PET-FLOW.md)。不要把历史 `pet:audit` 等开发工具接入正式队列。

本机服务默认每 45 秒异步推进同一私有任务目录，重启不重建已记录的 provider task。只有明确终态 429/500/502/503/504 每步骤最多重试一次；不确定 POST、规则改变或几何拒绝会暂停。ready 行用 `pet` 字段交付 HTTPS 图片包，最终 PNG 使用不可猜资产 token 链接，原照片和日志不公开。密钥、口令与私有状态不得进入静态构建。

独立依赖安装：`npm --prefix server install`；启动：`npm run pet:serve`（加载根目录两个私有 env 文件）；服务测试：`npm run test:pet-server`（假 worker，不收费）。原 `npm test/check/build` 仍无安装依赖。浏览器构建用 `npm run build:web-game -- --from <微信导出目录> --out <网站目录>`，具体参数见 [LOCAL-PET-SERVICE.md](LOCAL-PET-SERVICE.md)。

## 微信首页交互（2026-09-18）

当前背景版本`toy-worlds-v3`、特效版本`website-themes-v2`、导出版本`wechat-v22-photo-service`。背景先室内外等概率分组，再按色调/种子组合。`pet-particles.js`按首阶段色调和稳定ID选择主题、图形、摆位及缓慢漂动；2–5个完整图形全部在宠物后层，普通升级与进化整体增强，当前阶段配色自适应。彩带、细碎粒子及额外底座已停用，运行时无模型调用。成长卡仍显示6/11级进化与剩余题数；详见[WEBSITE-EFFECTS.md](WEBSITE-EFFECTS.md)。自定义伙伴默认名「新伙伴」，用`controller.petName()`统一显示用户别名，禁止直接修改素材包/内置宠物名。首页和升级不显示阶段名。选择练习范围后返回主页，点击做题才进入或生成新题。体型从Lv.1到Lv.15连续放大，进化阶段之间按共同待机高度归一化；详细规则与验收见[CLEAN-GROWTH-EFFECTS.md](CLEAN-GROWTH-EFFECTS.md)。
