# 照片角色与程序美术

最新默认流程已改为GPT奇幻伙伴v3，见 [FANTASY-PET-CONTRACT.md](FANTASY-PET-CONTRACT.md)：动作自由设计、同宽高比标准化、同阶段统一缩放、按角色像素主色匹配背景特效。下面保留v1暹罗猫动作模板与随机预设方案，供旧素材复核；旧任务不可套用新规则重新加工后冒充原任务。

当前方案：只让生图模型生成必须画出来的角色；头像裁切、背景、特效、食物图标和配置由固定程序完成。已试用 Seedream Pro 和通过 302.AI 调用的 `gpt-image-2.5-sunburst`，共用素材格式与转换器。用户照片是身份来源，模型自行判断主体类型与成熟程度。三阶段设计时，暹罗猫只提供美术风格参考，不限制主体轮廓、服饰、体型比例或进化幅度；三等宽列是输出格式。后续动作图才使用暹罗猫27姿势作为动作与布局参考，并保持已经独立设计的角色身份。

最新设计提示词强调从照片主体原创性格、能力和进化故事，不给参考猫换脸或换毛色，不沿用其服饰、纹样或成长路线，也不要求穿衣、装甲。形象设计只固定三列、完整全身、留白与白底；删除了此前“与参考体型占比一致”的要求。修改提示词后应创建新任务目录，旧任务按原提示词留档。

## 生成与复用范围

| 内容 | 实现 |
| --- | --- |
| 三阶段角色设定 | 1次生图，用户照片＋暹罗猫三阶段排版参考，3072×1024，三列 |
| 三阶段动作 | 3次生图，每次传已确定阶段＋暹罗猫对应动作，1536×1536、3×3、每格512 |
| 三阶段头像 | 从各阶段待机帧按规则缩小，无生图 |
| 背景 | Canvas预设：莲光花园、翠野、月夜；组合三套配色 |
| 1—15级与升级特效 | Canvas预设：莲花、星点、水晶；按等级增加圆环、粒子、拱门和翼形线条 |
| 食物图标 | Canvas预设：米饭碗、水果碗、饼干；喂食图本身已含碗，不重复叠加 |

随机组合在创建宠物时由唯一ID产生种子，保存到 `pet.json.procedural`。保存的是版本、种子和预设编号，不是远端代码。同一宠物重新打开使用同一组合；不同ID可得到不同组合。v1配色和算法需保持稳定，改变样式应新增预设版本，不能让旧宠物重开变样。

## 固定排版

`scripts/siamese-reference-kit.cjs` 从现有透明帧生成统一模板，不调用AI：各阶段使用统一比例缩入512格，保留睡觉、跳跃与站立的相对体型，足底为(256,448)。模板清单记录每格位置、用途及源图哈希。

生图要求与参考画布尺寸和格子顺序相同。转换器严格按512格切分，不寻找新格子、不移动切线；错尺寸、空格、越界和不可去底结果拒绝。通过检查后，只用等比缩放和位移将主体放入对应参考占位框，足底一致，不拉伸身体。不同物种的轮廓不可能逐像素相同；提示词也不能保证原始输出每次精确排版，因此最终坐标由程序规范。

最终三个图集为1536×1536透明PNG，`layout:template-v1`，与此前`aligned-v1`共同受支持。新包可不带`food.png`、`scene.png`和`fx-*.png`。原有自带图片的旧宠物继续使用原素材。

## 命令

```sh
# Node 22+；此流水线只需sharp。导出角色参考不需要浏览器，也不调用API。
npm run pet:references -- artifacts/siamese-character-reference

# 默认Pro。无--submit时仅准备参数；正常4次生图，单项格式失败最多重试一次。
npm run pet:generate:seedream -- --out artifacts/new-job --photos /path/to/photo.png \
  --id custom-unique-job --name '专属伙伴' --submit

# 已有图片只做固定规则转换；可在禁用网络时运行，不调用AI。
npm run pet:assemble:template -- --in artifacts/new-job --id custom-unique-job --name '专属伙伴'

# 独立无限积分测试工程
npm run build:wechat -- --out artifacts/new-job/wechat-test \
  --config /path/to/minigame-1/project.config.json --test --test-default \
  --local-pets artifacts/new-job/candidate/catalog.json --allow-trial-pets
npm run check:wechat -- artifacts/new-job/wechat-test
```

每个新订单使用新ID和目录；恢复同一任务使用原ID、照片和目录。已成功选择的尝试会保留，不因重新运行切回旧图。收到响应但下载失败只恢复下载；接口结果不明不会自动重发。模块、文件或其他运行错误须停止，不当作坏图片再次计费。

通用模板：`scripts/pet-template-prompts.cjs`；转换：`scripts/pet-template-assemble.cjs`；预设：`wechat/runtime/pet-presets.js`。代码不包含本次小柴的专属分支。

## 本轮结果

Sunburst 小柴在 `artifacts/shiba-sunburst-kit`，ID `custom-shiba-sunburst-01`，名“小柴·日曜”。复用用户已确认的 Sunburst 设计，该轮新增三次动作图请求，每阶段1536×1536九宫格，均首次生成后通过固定裁切检查。原图、实际提示词、参考图和任务号按阶段留档；转换在禁止网络时完成，无后处理AI。接入说明见 [302-PET-ART.md](302-PET-ART.md)。

新小柴位于 `artifacts/shiba-siamese-template`，ID `custom-shiba-template-01`。原预设对比用小柴保留在之前目录。此次实际5次角色生图：第一阶段在联调中因转换模块未就绪发生一次多余生成，已修正为调用前加载模块；背景、特效、食物没有生图请求。候选保留美术待检查标记，仅证明固定格式可在测试游戏运行，不能宣称每次照片相似度或动作语义自动合格。

客户端仍未连接真实上传/订单后端。本地命令和程序美术可以迁移到服务器，但本轮不包含支付、云存档或微信真机发布。
