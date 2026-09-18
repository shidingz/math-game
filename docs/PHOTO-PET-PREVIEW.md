# 照片宠物：先比较设计，再制作完整素材

当前使用方舟的 Seedream Lite / Pro，方向为半写实的可爱→灵动→帅气；第一阶段像照片，后两阶段允许自由幻想进化，标志配饰仍可辨认。不指定目标动物的品种、毛色、衣服或孙悟空成长路线。

四版比较使用相同照片、相同提示词，只改变模型和是否提供现有暹罗猫三阶段彩色参考：

| 模型 | 无其他角色参考 | 有暹罗猫成长参考 |
|---|---|---|
| `doubao-seedream-5-0-260128` | Lite 无参考 | Lite 有参考 |
| `doubao-seedream-5-0-pro-260628` | Pro 无参考 | Pro 有参考 |

暹罗猫仅提供成长幅度与游戏美术表达，不提供目标身份。原照片始终是身份来源。实际提示词和参考图副本保存在各输出目录。

```sh
# Node 22+，需要 sharp；密钥在工作进程 .env.local / ARK_API_KEY。
# 省略 --submit 不发收费请求。
npm run pet:compare -- --out artifacts/design-study --photos /path/to/photo.png --submit

# 锁定选中的三阶段设计，制作其余六项素材。
npm run pet:generate -- --out artifacts/unique-pet-job --photos /path/to/photo.png \
  --design-image /path/to/selected-three-stage.png --reference none \
  --model doubao-seedream-5-0-pro-260628 \
  --step all --id custom-unique-job-id --name '专属伙伴' --submit
```

设计比较与完整制作均支持1—3张同一主体照片，`--photos` 用逗号分隔。`--design-image` 跳过设定生图；后续动作只传对应阶段设计，不再传其他角色。默认输出待检查试装包，`--review` 开启已授权的方舟视觉检查，见 [SEEDREAM-ASSET-KIT.md](SEEDREAM-ASSET-KIT.md)。

每只新宠物使用新的 ID 和任务目录；同一任务恢复使用相同输入与目录。请求超时且结果未知时不会自动重复收费。Lite 和 Pro 均逐项请求一张图；Pro 实测不支持组图开关，脚本已省略该参数。

客户端接收三张透明九宫格图集、头像、食物、背景、四种特效及 `pet.json`，可不断新增伙伴并独立保存成长，无需逐只编写 JS。客户端不会把原照片自行变成动作图。照片上传与任务接口的真实后台尚未部署，见 [CUSTOM-PETS.md](CUSTOM-PETS.md)。

历史中转站实验脚本 `scripts/laozhang-image.cjs` 保留，但三次均返回429，没有图片，不作为当前执行方案。
