# 本机照片制作服务与 Canvas 网页

本文对应 `wechat-v22-photo-service`，更新于 2026-09-18。新版 Canvas 网页计划发布在 GitHub Pages `/dev/`；本文记录时尚未推送部署。Cloudflare HTTPS 隧道已获用户授权，公网健康检查正常；真实网页已上传灰猫并开始新的生图任务，完整制作领取流程仍在验收，不能把健康检查或已有本机测试当成全流程成功。

## 当前可以做什么

网页用真实相机/相册选择 1—3 张照片，保存本机草稿后上传；本机 Node 服务顺序制作并持久记录任务，网页轮询后把数据包加入伙伴列表。每次新请求获得独立 custom id，默认名「新伙伴」、免费拥有、最新排前，可自行改名并分别培养。

生图只调用固定提示词的 302.AI `gpt-image-2.5-sunburst`，通常为一张三阶段设计和三张动作图集，共 4 次请求。三个阶段共 27 个动作；裁切、透明处理、统一尺寸、头像、主色、背景/特效组合及宠物注册都是固定程序规则，没有文本命名、AI 质检、AI 修图或动态生成代码。已完成灰猫案例的最终包位于 `assets/custom-pets/gray-cat/`，随包构建为 8 内置加 1 新伙伴，共 9 个。

固定格式检查只能验证图片适合播放器，不保证每次都满足用户对形象或动作的美术期待。返回素材保留技术合格与未做语义审核的区别。

## 本机启动

需要 Node.js 22 及以上。在仓库根目录执行：

```sh
npm --prefix server install
npm run pet:serve
```

启动命令会加载根目录 `.env.local` 与 `.env.service.local`，两个文件需要存在。前者保存第三方 API Key；后者当前已在这台电脑配置，包含访问口令、服务公网地址、CORS origins 和限额。不要把内容贴入公开文档、截图或提交 Git。新的电脑可参考 `server/.env.example` 自行创建私有配置。

关键设置：

| 设置 | 用途 |
| --- | --- |
| `PET_SERVICE_ACCESS_CODE` | 网页连接使用的长随机口令；后台拒绝空口令 |
| `PUBLIC_BASE_URL` | 隧道公网 HTTPS origin，无路径、端口或凭据；供最终图片 URL 使用 |
| `PET_SERVICE_ALLOWED_ORIGINS` | 允许访问的精确网页 origins，逗号分隔，如 GitHub Pages 站点 origin 与本机测试 origin；不用 `*` |
| `PET_SERVICE_PORT` | 本机 API 端口，默认 8799 |
| `PET_SERVICE_DATA_DIR` | 私有照片、任务及状态目录，默认 `artifacts/pet-service` |

服务默认只监听 `127.0.0.1`。另行配置的 HTTPS 隧道将公网请求转发到该端口，程序不会自动开启隧道。只有健康检查、口令登录和不可猜 token 的最终图片接口不使用业务 Bearer 头；照片与任务必须验证会话及所有权。不要把数据目录交给普通静态服务器公开。

电脑必须保持开机、联网和进程运行；浏览器页面关闭后，本机后台可继续制作。重启会从同任务目录恢复，而不是重新提交已记录的生图 task。停止可 Ctrl-C；异常断电恰好发生在提交未收到 task id 时会暂停，需要管理员核实，避免自动重复付费。

## 构建新版网页

根目录 `index.html` 仍是原 DOM 网页；新版来自 `wechat/browser/`，必须使用新构建命令，不能直接发布旧 `preview.html`。

以下在仓库根运行，macOS/Linux 示例先把独立 sharp 安装路径提供给微信素材导出：

```sh
NODE_PATH=./server/node_modules npm run build:wechat -- \
  --out artifacts/photo-service/wechat-test \
  --test --test-default \
  --local-pets assets/custom-pets/catalog.json \
  --allow-trial-pets

npm run build:web-game -- \
  --from artifacts/photo-service/wechat-test \
  --out artifacts/photo-service/web \
  --test --test-default \
  --public-config deployment/public-config.json
```

用于原生微信时另传 `--config` 指向已有项目配置，以保留 AppID；不要覆盖真实 `minigame-1`。当前灰猫包保留 trial 标记，构建需显式 `--allow-trial-pets`，该标记不作为玩家名字显示。

公开配置文件只能包含 `baseUrl` 与 `assetHosts`，不能含口令、token 或第三方 Key。网页默认只允许 HTTPS 服务；仅本机 localhost/127.0.0.1 页面允许 HTTP 本机服务用于调试。生产图片仍要求 HTTPS 且命中素材域名白名单。

`--test --test-default` 是无限积分测试构建；不传它们为正式规则。正式和测试使用不同本地命名空间。新增 `.github/workflows/deploy-dev.yml` 在推送 dev 分支时构建，取 main 的原站到根目录，并将新版放入 `/dev/`。仓库 Pages 需要选择 GitHub Actions，`github-pages` 环境的部署分支规则还需允许 dev；目前尚未确认发布完成。可用仓库变量 `PET_SERVICE_URL` 覆盖公开 API 地址，该变量只能是 URL，不能填写任何密钥。推送后需单独确认 Actions/Pages 成功及线上版本，这一步不由生成服务自动完成。

## 用户操作与恢复

1. 打开新版页面，选择初始伙伴。
2. 点击“连接服务”，输入正确服务地址和访问口令；口令不保存在浏览器，返回的会话 token 会按完整地址保存。
3. 点击“制作伙伴”，拍照或选择 1—3 张同一主体的图片，提交制作。
4. 状态从排队变为制作中，完成后自动加入列表首位；可离开制作页再回来同步。
5. 再次制作会创建另一只伙伴，已有成长和改名不被覆盖。

照片在提交前保存于 IndexedDB；任务被后台确认后释放本机照片。刷新会恢复本地任务并查询同一后台。token 过期收到 401 时，停止使用它发送业务请求，保留为同服务地址的重登录凭据；输入正确口令后后台恢复原 owner，因此旧排队任务与半上传图片仍可继续。换新设备或清空浏览器 token 不能仅凭相同口令接管旧 owner。

切换服务 URL 时，token 不会被发往另一地址；另一服务的远程伙伴与任务仍留在原地址的存档中。隧道更换域名后需要更新后台 `PUBLIC_BASE_URL`、公开配置和客户端服务地址/素材白名单；它是不同服务地址的浏览器作用域，不应假定自动迁移原会话。长期使用宜固定域名，避免频繁更换临时地址。

## 限制、诊断与验收

默认全局每天 10 个任务、每 owner 3 个任务，排队全局 10 个、每 owner 2 个；失败任务也计数。每张最多 10 MiB，PNG/JPEG/WebP 静态图片，最多 2400 万像素。服务真解码并最长边 2048 等比标准化，原图不会直接公开。更详细的配额、接口响应与错误规则见 [服务 README](../server/README.md)。

- 连接失败：检查本机进程、隧道域名、`PUBLIC_BASE_URL`、精确 CORS origin 是否匹配；访问口令错误返回 401。
- 制作暂停：查看私有任务目录的 pipeline 状态和 `server-last-run.log`，不要通过不断新建 requestId 来重试同一笔不确定提交。
- 图片无法显示：检查 HTTPS 素材域名白名单和浏览器 CORS；图片组件不携 Bearer，而使用只读的不可猜 token 链接。
- 规则转换拒绝：本次没有可安全交付的标准图集，暂停处理；不会自动调用其他 AI 修图。

```sh
npm test                  # 原项目无依赖测试
npm run check
npm run build
npm run test:pet-server    # 独立服务假 worker 测试，需要 server 依赖，不收费
```

本轮 7 组服务测试已覆盖鉴权/CORS、图片校验、所有权、幂等、单 worker、重启、限额、素材链接、一次技术重试与真正过期续接。本机浏览器还使用真实服务加已有合格素材 fixture 测试任务恢复与多次领取；这不能代替真实付费生图整条链、公网 HTTPS、微信原生或手机真机验收。当前不包含支付订单、云端积分/成长同步、微信账户认证、审核或正式发布。
