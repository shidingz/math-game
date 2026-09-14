# 开发说明

## 技术结构

纯 HTML/CSS/JavaScript，没有框架、构建链、外部 CDN、账号或后端。脚本通过 index.html 的 defer 顺序加载，运行时使用全局命名空间。questions.js、growth.js、core.js、test-tools.js 同时兼容 CommonJS，Node 单元测试可直接加载。

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

依赖顺序：角色数据/播放器及题库成长 → core 与 themes → 注册表和角色适配器 → test-tools/storage/interaction/level-up → app。注册表顺序影响伙伴选择界面，不要靠移动图片文件改变顺序。当前顺序应从实际脚本与注册表读取，不把本文件列表当作排序配置。

## 规则与状态

答对一次结算 10 积分，重复提交同一道已答题不会再次奖励。每轮 10 题；题目正确后约 400ms 自动进入下一题，错题展示答案和解释，由用户手动继续。最近 30 道错题保存在 mistakes；新轮次从符合年级/范围的最近错题中取至多两题复习。题目使用约分后的 `{n,d}`，避免小数浮点误差；不要改成简单字符串或浮点相等。

年级值 0 是幼儿园，1—6 对应小学；范围由 questions.GRADES[].topics 和 balanced 组成。切换年级/范围会重建当前练习轮次，角色成长保留。

升级门槛（离开 Lv.1 至 Lv.14）为：

```js
[40,40,60,80,80,80,100,100,100,120,120,140,140,300]
```

累计 300/800/1500 成长值到 Lv.6/11/15。每份食物消耗 20 分并给 20 成长值，先扣分再播放 500ms 动画，完成后展示提示或升级。Lv.15 起每级门槛 300；core 中保存实际等级，播放器最多接收 15 的外观等级。进化只发生于进入 6 和 11。题数换算假定全部答对且积分都用于喂养；兑换角色会消耗同一个钱包，不能保证只按答题总数就升级。

首选宠物通过 chooseStarter 一次性免费发放；其他由 unlockPet 主动兑换，每只 300 分、重复兑换不再扣分。feed 与 startRound 完全独立，没有“必须做完一轮才能喂养”的限制。

存档主要字段：version=4、starterChosen、starterPet、points、activePet、unlockedPets、pets[id]={level,growth,feeds}、grade、topic、round、totalSolved、totalAnswered、totalRounds、mistakes。迁移接受版本 1—4；精卫的旧进度放在 retiredPets，不显示在游戏内。

| 入口 | localStorage key |
| --- | --- |
| 正式版 | math-pet-game:v2（载荷 version=4，与 key 版本不是同一概念） |
| 测试版 | math-pet-game:test:v1 |
| 旧正式版迁移读取 | math-pet-game:v1 |

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
