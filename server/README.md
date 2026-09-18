# 本机宠物生成服务

这是 Node.js 原生 HTTP 单机服务。网页负责上传照片、显示进度与安装素材；本机后台依次调用固定生图流程，按既定规则裁切 PNG，返回统一宠物素材包。只调用第三方生图模型，没有文本模型命名、AI 质检、AI 修图、动态代码生成或远程代码执行。默认新伙伴名称固定为“新伙伴”。

## 启动

需要 Node.js 22 及以上、`sharp`，在项目根执行：

```sh
npm --prefix server install
node --env-file=.env.local --env-file=.env.service.local server/start.cjs
```

`server/package.json` 单独声明图片处理依赖，不改变原项目无安装依赖的 `npm test`、`check`、`build`。后台子进程自动将 `server/node_modules` 加入 `NODE_PATH`；已有环境的 `NODE_PATH` 也会保留。

`.env.local` 继续保存 `API302_API_KEY`。根据 `server/.env.example` 将服务配置写入项目根已忽略的 `.env.service.local`，不要提交真实配置。Node 的 `--env-file` 要求文件存在，启动命令必须在项目根运行。默认监听 `127.0.0.1:8799`，网页通过另行配置的 HTTPS 隧道访问；程序不会主动创建隧道或向公网发布。电脑需保持运行和联网。

必要配置：

| 变量 | 说明 |
| --- | --- |
| `PET_SERVICE_ACCESS_CODE` | 至少 8 字符，建议随机长口令；不接受空口令。用于管理员或受邀测试者登录，不是微信身份鉴权。 |
| `PUBLIC_BASE_URL` | 公网 HTTPS origin，如 `https://your-host.example`，不能带路径、端口或凭据。素材链接使用该域名。 |
| `PET_SERVICE_ALLOWED_ORIGINS` | 逗号分隔的精确网页 origins，如 `https://name.github.io,http://127.0.0.1:8798`；不能写 `*` 或路径。 |

默认每天全局最多 10 次、每个 owner 最多 3 次；全局最多 10 个待处理任务、每 owner 最多 2 个。每日以 UTC 日期统计，计数持久保存，失败任务也计数。限制可用示例文件同名变量调整。上传照片最多全局 300 张、每 owner 60 张，包含未提交任务的照片，满额后需管理员归档/清理；不会偷偷删除用户照片。所有任务只保留本机记录；没有公网支付或账户系统。

`PET_SERVICE_PORT` 优先于 `PORT`，默认 8799。数据目录默认为 `artifacts/pet-service`；自定义相对路径相对启动目录。该目录包含私有照片、状态、任务结果，权限设为 0700，状态/照片文件 0600。**不要把数据目录交给静态服务器托管**。只通过服务提供的资产接口暴露交付 PNG。

## 接口

请求 JSON 需 `Content-Type: application/json`。除登录、健康检查和带秘密 token 的图片链接外，必须传 `Authorization: Bearer <token>`。错误为 `{ "error": "machine_code", "message": "中文说明" }`，HTTP 400/401/403/409/413/415/429 区分格式、登录、所有权、冲突、大小、类型和限流。

- `GET /health` → `{ok:true,service:"pet-generation",version:1}`，不返回密钥、路径、队列或用户信息。
- `POST /session {code,deviceId?}` → `{token}`。`code` 是访问口令；`deviceId` 不作为身份依据。口令正确且请求携带已记录的旧 Bearer token 时续期原 owner，旧 token 即使已过期也可作为仅此接口的续期凭据；其他接口仍拒绝过期 token。未知 token 或没有 token 时创建新的随机 owner/session。浏览器须保存 token，在刷新后复用，并在 401 后保留用于同服务地址的重登录，否则不能仅凭口令找回另一会话照片。session 默认 30 天过期，状态文件仅保存 token 哈希。
- `POST /pet-photos` → `{photoId}`。multipart 字段只有 `file`、`requestId`、`index`。`index` 为 `0/1/2`。每张最多 10 MiB，PNG/JPEG/WebP 静态图，最多 2400 万像素。服务用 sharp 真解码、去除元数据、按最长边 2048 等比标准化为 PNG；同时最多处理两次上传。上传 `(owner,requestId,index)` 幂等；相同位置不同内容返回 409，不覆盖。
- `POST /pet-jobs {requestId,photoIds}` → `{requestId,status,createdAt,updatedAt,...}`。图片必须属于此 owner、此 requestId，且按 index 顺序传 1–3 个 photoId。只写入队列，返回 202；同 owner/requestId 重复提交相同图片返回已有任务，返回 200，不重复收费。
- `GET /pet-jobs` → `{jobs:[...]}`。只返回此 owner 的全部任务，按完成时间（待完成用创建时间）从旧到新排列。状态为 `queued/processing/ready/failed`。ready 行带 `pet`（**不是 `pack`**），符合 `wechat/runtime/custom-pets.js` 的素材包规范；每次不同 requestId 都有独立随机 custom id。还会返回 `technicalValidation:"passed",semanticReview:"not-performed"`；固定规则合格不等于 AI 已审核美术质量。
- `GET /assets/<256-bit-random-token>/<filename.png>`：仅提供该 ready 任务白名单内最终 PNG，不公开原照片、pipeline 文件、日志或任意路径。图片组件不能携带 Authorization，所以 URL token 本身是只读访问凭证，须像私人分享链接一样保密。没有 token 猜测能力的人无法按 pet id 或 photo id读取图片；掌握链接的人可以读取对应素材。

网页 CORS 只接受配置的精确 Origin；没有 Origin 的微信原生请求和本机管理员请求仍需 Bearer 鉴权。CORS 不是身份认证。基础 IP 请求上限 240/分钟、口令请求 12/分钟、owner 请求 120/分钟、上传 20/分钟、排队 10/分钟；不信任客户端 X-Forwarded-For。隧道可能让所有访问者共享本机来源 IP，该规则适用于受控的小规模测试。返回 429 时给 `Retry-After: 60`。

## 任务与故障恢复

任务使用 `scripts/pet-alpha-pipeline.cjs`，固定萨摩耶画风参考、三阶段设计和三张九宫格动作图。单 worker 用异步 `spawn` 推进，默认每 45 秒恢复同目录的 provider task，不阻塞上传/状态 HTTP。后续任务依次排队。原图、任务 id、状态在磁盘持久化，状态 JSON 先写临时文件并 fsync 再原子 rename；同数据目录通过实例锁禁止两个服务同时推进。

Ctrl-C/SIGTERM 会停止新的推进并结束子进程；启动时继续原任务目录。若中断发生在已提交但尚未收到 task id 的时间窗，暂停为 failed，需要管理员核实第三方后台，**不会盲目重发**。临时查询/下载失败仅恢复已有 task；第三方明确终态 429/500/502/503/504 时，每个 design/stage 步骤最多新建一次重试，旧步骤保留为 `*-attempt-1`。不能确认提交、规则发生变化、格式不合格或其他错误均暂停；默认超过 24 小时等待也暂停。

详细日志只保留本机 `jobs/<id>/server-last-run.log`、`server-error.log` 和 pipeline 文件，HTTP 不返回原始错误、密钥、绝对路径或第三方响应。不要通过更换 requestId 反复试同一个失败任务来代替排错。删除实例锁前先确认旧进程已停止；无法解析或损坏的状态文件不会自动清空重建。

更换隧道地址后修改 `PUBLIC_BASE_URL` 并重启，`GET /pet-jobs` 会生成新域名的素材链接。客户端还需同步 API 地址和资源域名白名单；已有下载缓存仍可用，但过期远程域名需要重新同步。没有会话管理界面、自动数据清理、付款和多机数据库，这一版适合本机受控试运行。

## 不收费的自动测试

```sh
npm --prefix server test
```

测试只使用本机临时 HTTP 端口、合成 PNG、假的 worker/假的子进程，不访问第三方 API，也不触发生图费用。覆盖会话恢复与隔离、上传真假/大小/像素限制、重复与冲突请求、单 worker、异步响应、素材秘密链接、重启恢复、持久每日限额、确认失败的一次重试和不确定提交暂停。真实生图、HTTPS 隧道连通、网页端完整领取需另行验收。
