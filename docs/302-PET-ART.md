# 302.AI Sunburst 照片伙伴试装

当前默认入口为 `scripts/pet-alpha-pipeline.cjs`，采用[透明模板与容错分格规范](ALPHA-PET-PIPELINE.md)。旧直接生图和灰底模板分别保留`pet:generate:direct`与`pet:generate:guided`。下文记录历史Sunburst小柴的v1模板制作，不要将其九宫格参考图与新提示词混用。

本次采用用户已确认的三阶段设定，生成三个阶段的完整九宫格动作，再用现有通用转换器加入独立微信测试工程。小游戏加载图片包和受校验的配置，不执行模型输出的代码，也没有为小柴编写专属渲染分支。

## 已有结果

- 目录：`artifacts/shiba-sunburst-kit`；宠物 ID：`custom-shiba-sunburst-01`；显示名：小柴·日曜。
- `design/image-1.png`：复用此前已生成并确认的3072×1024三阶段设定。
- `stage1`、`stage2`、`stage3`：每阶段一次 `gpt-image-2.5-sunburst` 图片编辑请求，1536×1536、quality high、n=1。每个目录保存真实提示词、两张输入参考、任务状态和原始输出。
- `processed/stageN/frames`：固定512格切分后的27个透明单帧；`candidate`：三个透明图集、头像、预设参数与素材清单。
- `wechat-test`：原8伙伴＋上次小柴＋新日曜小柴，默认无限积分；主包231KiB，总计14.94MiB。各宠物使用独立编号和成长存档。
- `review/index.html`：三阶段设定、27姿势切换、图集和游戏截图；本机服务8780时访问 `/review/`，游戏为 `/wechat-test/preview.html`。

本轮新增3次付费动作请求，设计图是上轮结果，没有重复请求。转换报告中的 `modelRequests:3` 对应本任务目录的三个动作任务，不包含此前生成设计的请求。背景、15级特效、升级效果和按钮食物图标都来自程序预设。进食姿势中的碗和食物已包含在动作图片里。

## 本地工作模块

`scripts/api302-image.cjs` 提供 `submit()` 和 `poll()`；只在本地制作进程或服务端工作进程使用。密钥从被忽略的 `.env.local` 的 `API302_API_KEY` 读取，不进入微信包或网页。

```js
const client = require('./scripts/api302-image.cjs');
const prompts = require('./scripts/pet-template-prompts.cjs');
// 每次新任务使用独立目录。references 顺序必须对应提示词中的图1、图2。
await client.submit({
  directory: 'artifacts/new-job/stage1',
  prompt: prompts.actions(1),
  references: ['artifacts/new-job/stage-1-design.png',
               'artifacts/new-job/reference-kit/stage1-key.png'],
  size: '1536x1536', quality: 'high', prepare: true
});
// 审核实际输入后，将 prepare 改为 false 才会发起请求。
// 收到 taskId 后仅定时调用 poll；pending 表示继续等待，不要重发 POST。
await client.poll('artifacts/new-job/stage1');
```

采用异步编辑接口 `/v1/images/edits?async=true`，查询 `/async_result`。成功提交的任务落盘后只恢复查询与下载；相同目录输入改变会拒绝，结果不明的POST不会自动重试，需先核对供应商任务记录。接口和模型名称仅代表本次供应商实际返回，不对其底层模型身份作额外保证。

## 确定性装配与试装

任务目录需有固定参考清单 `reference-kit/manifest.json`、设定图、三个动作图，以及如下 `selection.json`：

```json
{"design":"design/image-1.png","stage1":"stage1/image-1.png","stage2":"stage2/image-1.png","stage3":"stage3/image-1.png"}
```

```sh
node scripts/pet-template-assemble.cjs --in artifacts/new-job \
  --id custom-unique-job --name '专属伙伴'
npm run build:wechat -- --out artifacts/new-job/wechat-test \
  --config /path/to/minigame-1/project.config.json --test --test-default \
  --local-pets artifacts/new-job/candidate/catalog.json --allow-trial-pets
npm run check:wechat -- artifacts/new-job/wechat-test
```

多个素材包通过JSON目录列表一并传入 `--local-pets`，每个使用不同ID。本次目录列表为 `artifacts/shiba-sunburst-kit/test-catalog.json`。恢复同一宠物须保持ID，不清空已有成长存档。

当前每阶段是九个关键姿势，播放器叠加位移与缩放，不是连续逐帧动画。模型图中第二、三阶段差异较细，最终观感还需用户试玩判断；格式检查不代表自动审美验收。候选保留试装标记。当前没有部署生成订单后台，本轮未完成微信真机、上传、审核或发布。
