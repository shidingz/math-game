# 微信小程序迁移规划

当前交付是 HTML 网页，**尚未创建微信小程序工程或配置 appid**。此文是后续开发切入点，不表示网页可以直接作为原生小程序提交。

## 建议迁移顺序

1. 明确交付为原生小程序，还是小程序中承载现有网页；确认账号、appid、业务域名及目标设备。当前代码中没有这些配置。
2. 保留 questions.js、growth.js、core.js 的纯逻辑及测试，将状态交易模块暴露给小程序页面；先用同一组题目和存档样本核对结果。
3. 将 DOM 事件和 dialog UI 改写为小程序页面/组件；grade=0、分数输入、正确自动继续、错误手动继续等行为保持一致。
4. 为存储、计时、页面前后台事件、图片加载、Canvas、随机数建立平台适配层。浏览器 localStorage 不可假定在另一平台存在；正式、测试仍使用独立存档命名空间。
5. 优先做一个角色的三阶段和 500ms 喂食，再接入全屏升级、随机动作、15级特效，最后推广到其余角色。
6. 真机验证后再准备登录/云存档、资源托管和发布配置；这是新增工作，不属于当前静态网页已有功能。

## 可以复用与需要改写的边界

| 内容 | 处理建议 |
| --- | --- |
| 精确有理数、题库、奖励、成长和兑换交易 | 直接复用纯逻辑，保持现有单元测试 |
| 最终 PNG、帧坐标、动作和等级数据 | 从 asset-inventory.json 迁移；保留视觉等级上限规则 |
| document/window、customElements、Shadow DOM、dialog | 改为平台页面、组件和事件；不能直接运行现有 Web Component |
| Canvas drawImage 与动画时钟 | 编写平台适配器并实测高 DPI、资源加载和前后台暂停 |
| DOM 内联 SVG / CSS 动画特效 | 根据实际平台能力转换为 Canvas 绘制或其他支持的形式 |
| localStorage / storage 事件 | 实现平台存储适配，显式迁移、校验与版本升级 |
| GitHub Pages 的 ?test=1 | 仅是网页调试开关；微信正式包应明确排除或限制调试入口 |

## 素材与性能

目前源项目保留成品单帧和图集，因此比运行包大。先 `npm run build`，统计 dist 中资源；不要将整个源码、测试和编辑单帧放进小程序包。即使仅保留图集，仍需按当前微信包体与下载规范规划压缩、按角色/阶段加载、缓存、资源托管和释放。

建议为低内存设备实现图片缓存上限、切角色释放旧图、后台停止 RAF、Canvas 像素比上限、粒子数量降级、全屏升级复用已加载纹理。关键图像清晰度需在 iOS/Android 真机检查。图集不是骨骼资源，若要任意连续关节动作，需要另外制作骨骼或更密集帧。

当前所有分数与解锁由客户端计算。若后续引入云存档、支付或排行榜，服务器校验需要单独设计；不要把 localStorage 中的测试状态当作可信账号数据。

## 文档入口与待核实事项

以下为后续开发时应重新打开的微信官方入口。本次文档抓取未成功，**不在这里固化包体数字、准入条件或 API 版本结论**，请以当前官方文档和开发者工具校验为准：

- [小程序框架](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Canvas 组件](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html)
- [本地存储](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html)
- [分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html)
- [web-view](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)

## 验收清单

新用户领养、旧数据恢复、年级0—6出题、分数等价答案、重复提交不重复奖励、主动兑换300分、独立喂养、500ms反馈、提示不挡按钮、各宠物三形态与15级特效、Lv.15后继续升级、全屏背景变暗、前后台恢复、低内存/低网速、正式与测试数据隔离。至少在一台 iOS 和一台 Android 真机验证。
