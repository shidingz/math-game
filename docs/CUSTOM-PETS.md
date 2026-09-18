# 微信自定义伙伴：客户端与服务端接口 v1

最新照片流水线使用GPT通用奇幻提示词与固定图片转换，见 [FANTASY-PET-CONTRACT.md](FANTASY-PET-CONTRACT.md)。`layout:template-v1` 使用(256,448)足底锚点；可选`procedural`字段的version=2保存按角色像素计算的颜色及内置scene/motif/food枚举，旧version=1预设仍兼容。它只指定已打包的绘制功能，不接受远端代码。新包只需三张角色图集和头像，背景、特效、食物图标由程序绘制，进食时的食物在动作格内；旧图片式素材包仍兼容。

## 已实现与边界

客户端位于 `wechat/runtime/`。用户先按原规则领养初始伙伴，然后在「换伙伴 → 拍照 / 上传，制作新伙伴」选择同一主体的1—3张照片。每次提交产生新的 requestId；每个完成任务对应唯一 `custom-...` 宠物 ID，可多次制作，伙伴列表及制作记录分页显示。每只宠物的等级、成长、喂养次数独立，积分仍共用原钱包。

目前没有生成服务、支付或云成长存档。未配置接口时可以拍照/选图并保存本机待提交记录，也可删除该记录；不会扣款、调用生图或假装已经生成。后续配置接口后，已有草稿可手动继续提交。照片上传前有明确的提交按钮，选择照片不会自动上传。

完成任务通过启动/回到前台、页面中的「刷新进度」及前台15秒轮询发现；后台不会承诺持续轮询，退出后下次打开再同步。这里的“自动加入”是同步服务端结果，不是微信离线推送或订阅消息。

接口配置为空时不调用 wx.login。接上服务后通过 wx.login 的 code 换取你自己服务器的短期 token；不向客户端发放 Seedream 密钥、微信 AppSecret。成长存档仍保存在该设备的正式/测试独立存储中；服务端列表可恢复已交付素材，但不能恢复设备上丢失的成长进度。客户端积分不是可信支付凭据。

## 固定素材输入与打包

生成/后处理流水线只需交付规范图片，再调用通用打包脚本，不再生成 JS 或角色专用代码：

```text
input/
  stage-1.png       必填：初始阶段
  stage-2.png       必填：一次进化
  stage-3.png       必填：二次进化
  food.png          可选：透明食物图标
  scene.png         可选：场景背景
  fx-particle.png   可选：透明粒子
  fx-ground.png     可选：透明地面光环
  fx-back.png       可选：透明背后纹章
  fx-evolution.png  可选：透明升级元素
```

三张图集均为带真实透明背景的1536×1536 PNG，3×3，每格512×512。动作从左到右、从上到下为 `idle, blink, wave, pet, feed, think, sleep, jump, skill`。角色完整、居中、各动作比例相同，足底参考 (256,470)，预留耳朵、尾巴、装束运动边距。图集允许经过平台流程压成1152×1152，每格384，对应 `cellSize:384`。不能把未经抠图、带边框或半身裁切的 Seedream 原图直接当成成品。

打包工具会为每阶段计算九个透明像素边界，写入可选的 `stages[].bounds`，元素为 `{x,y,width,height}`（单格坐标）。共享播放器用边界保持角色可见大小与落脚位置。未提供边界时按完整格子显示；留白很大的图集会显得较小。压缩图集时边界也必须按相同比例转换。

```sh
# 与微信构建一样，打包图片需要 sharp。
npm install --no-save --package-lock=false sharp
npm run pack:pet -- --in /path/to/input --out /path/to/new-output \
  --id custom-unique-order-id --name '专属伙伴' \
  --base-url https://pets.example.com/pets
```

每次创建必须使用新的 ID，哪怕输入同一张照片。重试同一个订单使用原来的 ID。工具检查图集尺寸、每格非空及透明区域，自动裁出头像，按图片内容生成 revision，输出：

```text
new-output/
  pet.json
  custom-unique-order-id/<revision>/图片文件
```

把该图片目录按原结构上传 CDN，将 `pet.json` 对象放入任务 ready 响应中即可。不执行动态代码、不重建每个用户的客户端。未提供食物/背景/特效时使用通用样式；额外图片提供后由共享渲染器加载。特效采用固定旋转/淡入淡出/轨道运动，6级启用背后纹章，升级展示使用进化元素；不能仅靠一张图实现任意复杂特效逻辑。

角色头像从第一阶段待机格裁切；喂食500ms，20积分换20成长值，6/11级进化，15级以后继续成长且外观封顶。九个姿态加通用动画不等于武打角色的密集逐帧动画。后处理、身份一致性和视觉验收仍由生成服务负责。

## 公开客户端配置

复制 `wechat/custom-pets.example.json` 到自己的公开配置文件，只允许两个字段：

```json
{"baseUrl":"https://api.example.com","assetHosts":["pets.example.com"]}
```

```sh
npm run build:wechat -- --out /path/to/staging \
  --config /path/to/minigame-1/project.config.json \
  --custom-pets /path/to/public-custom-pets.json
npm run check:wechat -- /path/to/staging
```

不传 `--custom-pets` 默认关闭联网生成入口，照片草稿仍可保存。`assetHosts` 是精确域名白名单，不能带协议或通配符。通过校验的素材只接受 HTTPS URL；建议 revision 目录使用永久地址，不要返回很快过期的签名地址。素材下载使用微信下载 API，再交给图片解码；内存图片缓存有上限，重启可能需要重新下载，并未实现全量离线素材持久缓存。

微信后台应配置实际 request、uploadFile、downloadFile 合法域名，以及照片相关隐私声明和权限；真实相机权限、隐私授权流程及网络可用性仍需真机验收。官方 API：[选图](https://developers.weixin.qq.com/minigame/dev/api/media/image/wx.chooseImage.html)、[上传](https://developers.weixin.qq.com/minigame/dev/api/network/upload/wx.uploadFile.html)。

## 服务端 HTTP 约定

以下接口全部由开发者后续实现，不是已经部署的地址。请求/响应为 JSON，照片上传除外。2xx 代表成功；401 清除客户端 token，下次请求重新登录；其他错误保留记录，用户可以重试，不会换 requestId 再提交一次。

### POST /session

请求 `{"code":"wx.login返回值"}`，响应 `{"token":"短期会话token"}`。服务端用微信登录接口验证 code、建立 openid 对应账户。不能相信客户端传来的用户ID。其余接口要求 `Authorization: Bearer <token>`，必须校验任务和照片属于当前账户。

### POST /pet-photos

multipart/form-data，文件字段 `file`；文本字段 `requestId`、`index`（0—2）。响应 `{"photoId":"opaque-photo-id"}`。

按 `(账户, requestId, index)` 幂等处理。重传必须返回同一个 photoId；限制类型、尺寸、字节数并验证实际图片内容。客户端单张限制10MB，后端必须再次检查。上传成功不等于已下单；孤立上传由后台定期清理。

### POST /pet-jobs

```json
{"requestId":"req-unique-id","photoIds":["photo-id-1"]}
```

响应 `{"requestId":"req-unique-id","status":"queued"}`，也可返回现有任务的 processing、failed 或 ready 状态。服务端以 `(账户, requestId)` 为唯一键：网络超时重试同一请求只恢复原任务，不再次扣费或生成。新 requestId 才代表用户的下一次制作；不同任务必须得到不同宠物ID。支付尚未设计/实现，不能从客户端请求推断用户已付费。

### GET /pet-jobs

同一次返回中，ready任务应按完成顺序从旧到新排列。客户端按首次收到的素材包顺序保存，逆序显示；重复同步已有编号不会改变其顺序和成长。该接口排序要求用于保证最新完成的伙伴显示在首位。

返回当前账户的完整任务列表（此版客户端未实现服务端分页，不能只返回首页而声称是完整恢复）：

```json
{
  "jobs": [
    {"requestId":"req-unique-id","status":"processing"},
    {
      "requestId":"req-another-id",
      "status":"ready",
      "pet": {
        "schemaVersion":1,
        "id":"custom-unique-order-id",
        "name":"专属伙伴",
        "revision":"immutable-image-revision",
        "cellSize":512,
        "stages":[
          {"name":"初始伙伴","image":"https://pets.example.com/pets/id/rev/stage-1.png"},
          {"name":"觉醒伙伴","image":"https://pets.example.com/pets/id/rev/stage-2.png"},
          {"name":"守护伙伴","image":"https://pets.example.com/pets/id/rev/stage-3.png"}
        ],
        "portrait":"https://pets.example.com/pets/id/rev/portrait.png",
        "food":{"name":"成长点心","image":"https://pets.example.com/pets/id/rev/food.png"},
        "scene":"https://pets.example.com/pets/id/rev/scene.png",
        "effects":{
          "particle":"https://pets.example.com/pets/id/rev/fx-particle.png",
          "ground":"https://pets.example.com/pets/id/rev/fx-ground.png",
          "back":"https://pets.example.com/pets/id/rev/fx-back.png",
          "evolution":"https://pets.example.com/pets/id/rev/fx-evolution.png"
        },
        "color":"#468f9b"
      }
    }
  ]
}
```

返回状态只支持 queued、processing、ready、failed。ready 必须一次交付完整合法的 pet 对象。重复 ready 只更新素材描述，不重置等级，不重复产生宠物；已经完成的任务不会被陈旧的 processing 回退。未知或冲突的任务/素材包会提示失败并停止该批入库。

服务器确认任务后，本机源照片会释放，任务记录保留。未提交的草稿照片保存在微信文件存储；删除小游戏数据会丢失草稿。正在提交的任务保持相同 requestId，无法确认结果时应先查询或重试原请求。

## 本地现成素材试装（无需服务端）

导出增加 `--local-pets catalog.json`。catalog 是多个 `pet.json` 路径组成的数组，相对于 catalog 文件；每份 manifest 使用同一 schema，但图片引用只能是与 manifest 同目录的 PNG 文件名。每只宠物必须用不同的 custom- 编号。构建检查尺寸、透明留白、路径与重复编号，再生成包含内容哈希的包内地址；线上 API 仍只接受白名单 HTTPS。

完成首次初始领养后，生成完成或随包提供的自定义伙伴自动免费加入，最新完成排在列表第一位，可以直接选择；“加入本地伙伴”仍保留为幂等恢复入口。不扣积分，不改变初始伙伴规则。同一编号重复加入保留成长；不同编号独立存档。本地描述不写入服务端素材库，避免重启时被 HTTPS 校验拒绝。构建目录不存在这些素材时，成长记录仍保留；重新装回相同编号即可恢复。普通内置伙伴兑换价为200积分。

第四版围巾小狗的实际试装素材在忽略目录 `artifacts/scarf-dog-trial/`，三张动作源图按第 1、5、6 张排序，场景使用第 2 张、食物使用第 3 张。试装转换脚本为 `scripts/prepare-pet-trial.cjs`，只裁九宫格、缩放和拼接，不补画身体、不抠图。`trial:true` 必须额外显式传 `--allow-trial-pets`，历史版本界面名称曾带“·试装”；现行版本只保留构建权限标记，不修改伙伴名称；正式素材校验未放宽。

```sh
npm run build:wechat -- --out /path/to/new-staging --config /path/to/minigame-1/project.config.json --local-pets artifacts/scarf-dog-trial/catalog.json --allow-trial-pets
npm run check:wechat -- /path/to/new-staging
WECHAT_PREVIEW_URL=http://127.0.0.1:8774/preview.html npm run test:wechat-local
```

本地素材随微信包发布，每只自定义宠物作为独立资源分包（custom-assets/<id>），首次显示头像、动作或场景前按需加载。主包只保留描述数据；主包/每分包4 MiB、总包20 MiB是构建的保守上限，最终以微信工具统计为准。该模式适合开发试装和少量内置宠物；大量用户的专属宠物应走远端资源包接口。试装目录与截图不提交 Git，正常无参数构建不会默认打入试装图。

### 第四版素材检查结论

- 三阶段可以被播放器切换，围巾在第三阶段仍然存在，但第一、二阶段轮廓差别偏弱。
- 原图是有白底与边框的设计卡片，部分动作只有半身，睡眠是张嘴姿势，抚摸图含外来人手。裁切无法修复身体缺失或错误动作，正式使用需重新交付全身、透明、对齐的动作素材。
- 每阶段 9 张单姿势，通用播放器能播放动作切换、喂食与进化。它不会从单张图自动生成连续走路、睡眠或武打动画；需要连续运动时须提供更多帧并扩展统一格式。
- 特效原图把整只狗与光效烘焙在一起，未作为独立叠加层装入，沿用通用程序特效。背景和星星饼干已接入，但饼干与喂食动作图里的食物不完全一致。
- 原 8 只角色不变，试装作为第 9 位可领取伙伴；本次不代表完成了真实生图后端或微信真机验收。

## 验证命令

```sh
npm test
npm run check
npm run check:wechat -- /path/to/staging
WECHAT_EXPORT=/path/to/staging WECHAT_PREVIEW_URL=http://127.0.0.1:8773/preview.html npm run test:wechat-custom
```

浏览器测试用合成接口结果和已有比熊素材验证接入机制，不代表已完成真实照片生图、微信拍照、支付或真机发布。正式上线前仍需真实服务与微信权限联调。

## 用户自定义名字（2026-09-18）

素材包名称固定为「新伙伴」。客户端通过`customPetNames: { [petId]: "用户输入名字" }`保存1—12字的本机显示名，与`customPetLibrary`并列。HTTP协议和宠物素材包无需改动；服务端返回新版本素材不会覆盖该别名。主页、列表、制作记录、升级页统一读取显示名；内置宠物保持原名。名字不参与ID、配色、动作、解锁或成长计算，也不需要模型。以后接入云存档时同步该字段即可；当前不提供跨设备同步。
