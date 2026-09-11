# 孙悟空 · HTML 游戏角色包

2026-09-12 更新：正式版首次进入免费任选一位初始伙伴，其他伙伴（包括孙悟空）均为300积分兑换。已有存档继续使用原有伙伴和成长，不重复发放初始宠物。布偶猫更新为奶凶毛团→傲雪伙伴→霜瞳守护者；精卫已从游戏移除，原素材备份在项目 `output/retired-jingwei/`，旧养成数据保留在存档的 `retiredPets` 中。测试版仍为独立存档，提供全部现有伙伴及调试按钮。

**当前首页已升级为口算喂养游戏。** 使用说明与角色扩展方法见 [GAME.md](GAME.md)。原来的自由等级/动作试玩已保留在 [studio.html](studio.html)。下文为角色素材与组件的技术说明。

三阶段、15 级成长、48 张透明动作关键帧，以及可运行的互动组件。沿用已确认的「幼年可爱、成年帅气」方向。打开 `studio.html` 可自由试玩角色；无需安装依赖、无需联网。`embed-example.html` 保留早期组件接入示例，正式游戏请使用 `index.html`。

## 内容

| 文件 | 用途 |
|---|---|
| `wukong.js` | 原生 Web Component，包含动作状态机、移动、成长与 Canvas 特效 |
| `index.html` + `game/` | 幼儿园及 1—6 年级计算、积分喂养、成长存档的游戏 |
| `studio.html` + `style.css` + `demo.js` | 保留的三阶段、全部等级及互动试玩页 |
| `embed-example.html` | 实际加法答题 → 成长值 → 升级的独立示例 |
| `assets/stage-{1,2,3}.png` | 运行时透明图集，每张 2048×2560，4 列×4 行 |
| `assets/stage-{1,2,3}.webp` | 同内容的无损 WebP 图集，供其他引擎选用 |
| `assets/stage-N-动作名.png` | 单独的 512×640 透明动作帧，共 48 张 |
| `assets/stage-N-portrait.png` | 三阶段静态立绘，与 idle 帧相同 |
| `manifest.json` | 图集矩形、锚点、动作、时长、等级和比例配置 |
| `design-guide.md` | 三阶段形象、15 级成长、动作与游戏反馈设定 |
| `source/` + `prompts/` | ImageGen 原始动作设计图与生成提示词 |
| `qa/` | 动作接触表、循环 GIF、素材检查及浏览器测试页 |

## 最小接入

把整个 `wukong-game` 文件夹复制到网页旁边，然后：

```html
<script src="wukong-game/wukong.js" defer></script>
<div style="max-width:640px; background:#eaf6f7; border-radius:24px">
  <wukong-game-pet id="wukong" level="1"></wukong-game-pet>
</div>
```

默认自动从 `wukong.js` 所在目录的 `assets/` 加载素材。`asset-base` 可指定相对于 **JS 文件** 的其他素材目录，也可以使用绝对 URL。不要把整张图集直接当作 `<img>` 立绘显示；静态图应选 `stage-N-portrait.png`。

```js
await customElements.whenDefined('wukong-game-pet');
const pet = document.getElementById('wukong');

pet.play('feed');           // 喂桃子
pet.play('celebrate');      // 答对题目
pet.play('comfort');        // 答错后鼓励，不扣成长
pet.setLevel(6);            // 升级；跨形态自动播放进化
pet.setLevel(11, { animate: false }); // 恢复存档，不播放进化
pet.moveTo(0.72);           // 向右跑到指定位置
pet.previewEffect();       // 展示本级特效，持续 3.8 秒
pet.pause(true);            // 冻结动画、移动、动作计时与特效
pet.pause(false);
```

### 动作名

`idle` 待机、`wave` 挥手、`pet` 摸头、`feed` 吃桃、`think` 思考、`comfort` 鼓励、`celebrate` 庆祝、`jump` 跳跃、`sleep` 小憩、`run` 跑动、`skill` 施法、`evolve` 进化。

- `idle`、`sleep`、`run` 持续，直到收到下一动作；`moveTo()` 跑到目的地后自动待机。
- 其他动作在 1.1–3 秒后自动待机。新动作立即接管旧动作，不会堆积定时器。
- `moveTo(x)` 使用 0–1 的横向位置；组件将目标限制到 0.28–0.72，为尾巴、金箍棒和动作留出边距。向左移动时水平镜像。
- 组件画布自身透明，可以放在自己的森林、地图、房间或 UI 中。场景背景只属于试玩页。
- 成长等级自动限制到 1–15；同一阶段体型每级增加约 2.5%，阶段升级更换完整立绘。
- 本级效果平时低强度显示，升级/施法时完整展开；成年形态始终保留筋斗云。为避免画面堆满粒子，不把 15 种特效同时叠加。
- 支持鼠标/触摸点击摸头、键盘方向键移动、空格/回车摸头。遵循系统「减少动态效果」设置，改为静态姿势和静态特效；有限动作仍按时结束。

### 事件与数据

```js
pet.addEventListener('pet-ready', e => console.log('当前形态素材已就绪', e.detail));
pet.addEventListener('pet-levelchange', e => {
  // { level, stage, action, previous, evolved }
  // 在这里接入自己的存档和 UI。
});
pet.addEventListener('pet-actionend', e => console.log(e.detail.completed));
pet.addEventListener('pet-error', e => console.error(e.detail.message));

console.log(pet.level, pet.stage, pet.action, pet.paused, pet.info);
console.log(window.WukongGameData.levels); // 15 级设计配置
```

还提供 `pet-action`、`pet-effect`、`pet-pause` 事件。事件可冒泡并穿过 Shadow DOM。组件从 DOM 移除时停止动画并注销监听器；多个组件共享已加载的图集。

### 素材技术规格

单帧 512×640，锚点 `(256, 588)`，图集按行排列。若接入 Phaser / Pixi / 自研 Canvas，可以直接使用 `manifest.json` 中的帧矩形。图片已经从原始底色分离，含真实 Alpha 通道；原始洋红底图只用于制作溯源。

角色是 **PNG / WebP 位图关键帧**，动画由姿势切换、平移、跳跃曲线和程序特效组合完成。可以自由放置、移动、缩放、镜像；不包含可任意弯曲四肢的骨骼绑定，也没有四方向/背面视图。挥手、吃桃、跑动每组有两张核心姿势；不是逐帧绘制的 24/30 FPS 长动画。

最小运行文件只有 `wukong.js` 和三张 `assets/stage-N.png`；其他图片、原始稿、提示词和检查页不用随正式游戏发布。这里的素材没有声音，也不依赖外部字体、CDN、账号、存档或付费服务。正式数学题库和积分规则由游戏决定，示例规则仅用于验证接入。

## 检查与再生成

1. 浏览器打开 `qa/runtime-check.html`，点击运行；检查等级、动作绘制、暂停、移动、跨阶段切换、输入边界及移除清理。
2. `qa/stage-N-contact.jpg` 可快速检查全部姿势；GIF 用于检查姿势衔接。
3. 原稿提取脚本：`python3 scripts/build_assets.py`，需要 Pillow、NumPy。
4. 导出配置：`node scripts/build_manifest.mjs`。

设计日期：2026-09-10。此包是网页游戏角色素材，不是 Codex 桌面宠物安装包。
