# OpenSpec Proposal: 修复检查更新接口 403 限流与请求频次优化

## 动机

在 Willow 桌面应用中，进入设置页面的“关于”部分时，会自动触发检查更新的 API 请求 (`https://api.github.com/repos/LeoLun/willow/releases/latest`)。
由于以下原因，这极易触发 GitHub API 的 403 频率限制 (Rate Limit Exceeded)：
1. **高频挂载请求**：用户在设置菜单切换页面时，About 页面会反复 `onMounted`，导致频繁发送检查更新请求。
2. **缺乏 User-Agent 头**：主进程使用 Node `fetch` 发起 API 请求时没有配置自定义 `User-Agent` 请求头，不符合 GitHub API 的规范规范（GitHub 明确要求所有 API 请求提供 valid `User-Agent`，否则会有更严格的限流或直接拦截）。
3. **缺乏本地缓存**：检查更新的响应没有在内存中进行短期缓存，导致每次调用都是网络请求。

当遇到 403 错误时，界面直接展示了未翻译的异常信息，体验不够友好。因此，需要设计一个更健壮且优雅的更新检查缓存及防抖/限流应对策略。

## 目标

1. **规避高频重复请求**：在主进程 `UpdateService` 中实现检查更新结果的本地内存缓存（如 10 分钟缓存期）。
2. **符合 GitHub API 规范**：为所有发往 GitHub API 的 `fetch` 请求添加规范的 `User-Agent` 请求头（例如 `willow-desktop/<version>`）。
3. **区分自动检查与手动检查**：允许前端在“关于”页面进行手动强刷检查，而自动检查（如页面挂载时的静默检查）优先使用本地缓存。
4. **友好的错误处理**：对 GitHub API 的 403 状态码（Rate Limit Exceeded）进行特异性捕获，在界面上输出更友好、可懂的中文错误提示，而不是原始的 Varnish / GitHub 403 Response。

## 范围

- **主进程 `UpdateService`**：
  - 添加内存缓存字段，记录上一次请求成功的时间和响应数据。
  - 支持 `checkUpdate(force)`，当 `force` 为 `false` 时使用缓存，`force` 为 `true` 时绕过缓存强刷新。
  - 在 `fetch` 中配置 `User-Agent` 头。
  - 拦截 403 限流状态码，抛出自定义中文提示信息。
- **主进程 `CheckUpdateController`**：
  - 接收来自 IPC 的 `request: { force?: boolean }` 参数，并传递给 `UpdateService`。
- **Preload 桥接**：
  - 更新 `preload.ts` 的 `checkUpdate` 方法签名以接收 `request?: { force?: boolean }` 参数。
  - 更新 `shared/hook/update.hook.ts` 的 `IUpdateApi` 接口类型。
- **渲染进程 `AboutSetting.vue`**：
  - 自动静默检查更新（`handleCheckUpdate(true)`）时，通过 IPC 传参 `{ force: false }`。
  - 手动点击“检查更新”（`handleCheckUpdate(false)`）时，通过 IPC 传参 `{ force: true }`。

## 非范围

- Windows / Linux 平台的更新打包。
- 使用第三方分发渠道（如 App Store 或自定义第三方 API 服务）来分发更新包。
