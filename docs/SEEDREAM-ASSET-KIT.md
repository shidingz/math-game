# Seedream 照片伙伴流水线

**最新方案已改为暹罗猫逐项角色参考＋程序预设。** 默认 `npm run pet:generate` 仅生成三阶段设定和三个动作图集，背景、15级特效、升级动效、食物图标由程序生成，详见 [PROCEDURAL-PET-ART.md](PROCEDURAL-PET-ART.md)。下面保留上一轮七图流程的实现记录；该历史入口现为 `npm run pet:generate:legacy`，不作为默认方案。

> 上一轮方案：Seedream Pro，不添加其他角色参考；半写实「可爱→灵动→帅气」。模型根据照片自行判断主体类型、成熟程度和对应阶段。生图后的转换仅使用固定规则，不调用视觉模型或 Agent。

## 当前范围

微信客户端可以读取统一图片包，多个生成任务对应多个独立成长的宠物，不需要为每只宠物生成 JavaScript。照片/任务接口和素材协议见 [CUSTOM-PETS.md](CUSTOM-PETS.md)。本目录的脚本是本地或服务器上的制作工作进程，不是已经部署的上传、支付或订单后台；密钥不进入微信包。

默认使用 `doubao-seedream-5-0-pro-260628`（Pro），保留显式切换 `doubao-seedream-5-0-260128`（Lite）的实验能力。默认不开启视觉模型检查；历史的 `--review` 仍是可选实验功能，本轮不使用。API 密钥仅从工作进程的 `.env.local` / `ARK_API_KEY` 读取，不写进日志、客户端或 Git。

## 一个任务，内部逐项制作

用户只需提交一次照片，最终一次交付完整宠物。内部使用七项明确命名的输出：三阶段设定图、三个阶段各一张九宫格动作图、食物、场景和四格特效图。设定图仅用于统一身份，最终头像从第一阶段待机姿势裁出。内部多次 API 请求不等于用户需要多次操作。

此前的一次六图生成实验存在返回顺序变化、半身图、背景/特效混入角色、配饰丢失和动作不符。当前不依赖返回数组顺序猜测素材用途，每一项只请求一张图，先锁定形态，再制作动作。

通用提示词源文件是 [pet-design-prompts.cjs](../scripts/pet-design-prompts.cjs)，不写入本次宠物的品种、颜色或围巾描述。旧 `docs/prompts/seedream-pet-kit.txt` 仅保留为六图实验记录，不是当前流水线入口。

参考图由脚本从现有游戏素材生成：

- 设定图：1—3张用户照片作为唯一身份来源；`--reference siamese` 可加现有暹罗猫三阶段彩色参考，默认 `none` 不加其他角色。
- 动作图：只传已经确定的一个阶段设计，不再传孙悟空轮廓、比熊动作或暹罗猫。九格动作及格式由通用提示词描述。
- 食物、场景、特效：使用同一张三阶段设定图作主题参考，不把参考角色画入独立素材。

成长方向为半写实可爱→灵动→帅气。照片可以是动物、人物、物品，也可以已经成熟；模型自行判断主体、辨识特征及成熟程度，决定照片更适合对应哪个阶段，再设计前后形态。模板不再要求第一阶段像幼年的照片。中后形态允许大胆幻想，保留身份线索与原有标志配饰的类型、主色和辨识纹样，具体造型由模型发挥。

## 运行

需要 Node.js 22+ 和 `sharp`，原网页命令仍不需要安装依赖。私有源照片和生成过程保存在 Git 忽略的 `artifacts/`。

```sh
npm install --no-save --package-lock=false sharp
# 先配置本机 .env.local 中的 ARK_API_KEY；不要把密钥放进命令或客户端。

# 不传 --submit 只准备参数，不调用收费接口。
node scripts/seedream-pet-pipeline.cjs --out artifacts/example-job --photos /path/to/photo.png --step design

# 完整任务：默认Pro无其他角色参考，至多12次生图请求，每项最多2次。
# 生成以后仅进行本地像素检查、切图、去底、对齐和打包。
node scripts/seedream-pet-pipeline.cjs --out artifacts/example-job --photos /path/to/photo.png \
  --step all --id custom-unique-job-id --name '专属伙伴' \
  --max-requests 12 --submit
```

1—3张同一主体照片使用逗号分隔的 `--photos`。每次新制作使用新的目录和宠物 ID；同一次制作的恢复使用原目录和相同输入。`--design-image /path/to/selected.png` 锁定已比较过的三阶段设计，跳过设定生图，只制作其余六项；设计哈希变化会拒绝混用。`--model` 选择 Lite 或 Pro，Pro 不发送其不支持的组图参数。相同素材编号更新会保留客户端成长，不应用于两个不同用户的独立订单。

不传 `--review` 时，产出 `trial:true` 的可运行测试素材包：`quality.json.conversion.status=ready` 表示固定格式转换完成，`aiCalls=0` 表示转换过程没有 AI 调用。艺术质量保持 `needs-visual-review`，不会把像素检查包装成相似度、动作语义或审美合格。完整任务状态为 `ready-for-test`。历史 `--review` 会另行调用真实视觉模型，本轮默认流程不使用。

单项操作使用 `--step stage1|stage2|stage3|food|scene|effects`。手动重试需要新的 `--attempt 2`；可以传入 `--feedback-file review.json`。不要通过新建目录的方式无限绕过一次任务的调用上限。

```sh
# 复核已有选中素材，不重新生图；原照片参数用于相似度检查。
npm run pet:audit -- --in artifacts/example-job --photos /path/to/photo.png --submit

# 将现有素材仅装配为可在游戏中检查的试装包。
npm run pet:assemble -- --in artifacts/example-job --id custom-unique-job-id --name '专属伙伴'
```

## 断点与质量检查

每项请求记录提示词、参考图副本、输入哈希、模型、用量和响应，再下载图片。响应已返回而图片下载失败时，只恢复下载；请求结果不明时停下，不自动再发一次可能重复计费的 POST。独占请求标记阻止两个工作进程同时提交相同尝试。

流水线依据照片中高饱和颜色的分布选择绿、蓝或红底，选定后固定于该任务的 recipe。对与边缘连通的蓝/绿/红底区域支持一定的渐变和色偏，避免模型未输出精确RGB时留下整片杂色。这样可以减少绿色配饰被固定绿底误删的问题，但不能保证所有材质都能正确抠图。半透明、反光、细毛、与底色相近的幻想装束仍需检查；生成图不符合抠图条件时应重做。

本地像素检查负责：实际透明留白、非空身体、边界裁切、九宫格安全分割及主体比例。按共同尺度对齐到512像素单格，足底锚点为 (256,470)，睡觉姿势不会因逐格放大而变成巨型宠物。最终动作图集为1536×1536 PNG。程序不补画被截断的身体。

视觉检查负责：身份、进化、配饰、动作、肢体、无角色背景和独立装饰。模型可能误解参考图或产生审美误判，失败结果须结合实际图片分析，不能为了放行而删除质量要求。当前测试发现 Lite 存在这类误判，尚不能承诺所有照片都能无人值守成功交付。

只有七项视觉检查全部通过，且检查指纹与当前图片、参考和模型一致，完整流水线才标记 `quality.json.status=accepted`。修改图片后旧结果失效。`pack:pet` 会拒绝仍待质检的生成候选，也会拒绝已通过质检后被改动的图片。

## 游戏交付

`candidate/` 包含三张图集、头像、食物、场景、四张独立特效、`pet.json`、`catalog.json` 与质量报告。`layout:aligned-v1` 启用所有动作共用比例与足底锚点。喂食图片由共享播放器叠加，积分、成长、500ms喂食、6/11级进化规则不由模型决定。

```sh
# 独立无限积分测试工程：无需编译参数，打开即体验全部伙伴。
npm run build:wechat -- --out /path/to/staging \
  --config /path/to/minigame-1/project.config.json \
  --test --test-default \
  --local-pets artifacts/example-job/candidate/catalog.json --allow-trial-pets
npm run check:wechat -- /path/to/staging

# 已通过的最终素材转为远端资源包；之后由你自己的任务服务交付。
npm run pack:pet -- --in artifacts/example-job/candidate --out /path/to/new-output \
  --id custom-unique-job-id --name '专属伙伴' --base-url https://pets.example.com/pets
```

增加新宠物只增加数据和图片；代码包含统一动作和特效播放规则。重复制作使用不同 ID，目录清单可列出多个 `pet.json`，不会覆盖前一次宠物。转换和构建没有宠物专用分支，也不产生角色专用 JavaScript。当前每阶段9个姿势依赖通用切换、位移和缩放，不能宣称等同54帧武打或骨骼动画。要更多连续动作，应一次扩展公共协议及播放器，再让后续宠物按该协议交付。

## 验证

```sh
npm test
npm run test:pet-assets  # 需要 sharp；全流程使用离线假接口，不发送照片或产生费用
npm run assets
npm run check
WECHAT_PREVIEW_URL=http://127.0.0.1:8775/preview.html npm run test:wechat-local
```

离线测试覆盖断点恢复、重复提交保护、单项重试、调用上限、质检后图片变更、底色选择、透明边界、姿势比例，以及禁用所有网络时重复装配的成品哈希一致性；它不证明真实模型的艺术质量。浏览器检查使用独立存档，可检查真实导出的图片和交互，不能代替微信真机、隐私授权、支付和正式发布验收。

## 官方文档核对（2026-09-16）

已阅读用户提供的 [Pro 教程](https://console.volcengine.com/ark/region:cn-beijing/docs/82379/2582774?lang=zh)、[交互编辑指南](https://console.volcengine.com/ark/region:cn-beijing/docs/82379/2582775?lang=zh) 和 [图片生成教程](https://console.volcengine.com/ark/region:cn-beijing/docs/82379/1824121?lang=zh)。

- 通用教程建议提示词不超过300汉字。现行设计与动作模板由测试校验字数；之前试验的实际提示词仍保留在各请求目录，不用新模板覆盖旧记录。
- Pro 支持单图及多参考图，不支持普通组图或流式输出；原请求中的组图参数已按型号省略。
- Pro 支持0—999归一化 `<bbox>` 坐标局部编辑。本轮用它去除动作图中的外来人手，但模型同时改变了一个非目标姿势。`merge-pet-cells.cjs` 只合入指定格，其余格从原图保留，并记录来源哈希。
- Pro 的 `background=transparent` 仅适用于单张透明输入图的图生图；不能直接用于普通用户照片。图层拆分可输出透明层，本轮尚未集成或验证该能力。
- 两套本轮素材均为试装，视觉模型有误判和成长幅度争议，未标记为自动质检全部合格。大PNG质检前可缩小压缩传输副本，交付素材不受影响。

本地试装的多只宠物分别打入资源分包，避免全部进入主包。照片制作的真实后台仍需另行部署。
