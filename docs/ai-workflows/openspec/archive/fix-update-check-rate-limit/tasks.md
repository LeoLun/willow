# 任务列表

## 1. 共享类型与 API 桥接定义
- [ ] 修改 `app/work/src/shared/hook/update.hook.ts` 中的 `checkUpdate` 参数定义，使其接受可选的 `{ force?: boolean }` 请求对象。
- [ ] 修改 `app/work/src/preload/preload.ts` 中 `checkUpdate` 的 IPC 转发逻辑，使其将 `request` 透传至 `ipcRenderer.invoke`。

## 2. 主进程控制器与服务层逻辑修改
- [ ] 修改 `app/work/src/main/controllers/config/check.update.controller.ts` 的控制器类型定义，从基类泛型 `void` 改为 `{ force?: boolean } | undefined`，在 `run` 方法中解析 `force` 参数。
- [ ] 修改 `app/work/src/main/service/update.service.ts`：
  - 新增 `lastCheckTime` (number) 和 `cachedCheckResult` (CheckUpdateResponse | null) 内存缓存变量。
  - 在 `checkUpdate` 方法签名中增加 `force = false` 参数。
  - 检查 `force` 和缓存状态：如果未强刷且缓存存在且未过期（10分钟内），直接返回缓存响应，并同步把服务自身的 `status` 设置为对应状态（避免 UI 与主进程服务状态失同步）。
  - 在 `fetch` 请求中加入 `User-Agent` 标头，值为 `willow-desktop/${version}`。
  - 在 `response` 不为 ok 时，如果响应状态码是 `403`，在 packaged 下抛出 `"检查更新请求过快，已被 GitHub 限制，请稍后再试（限流错误）"` 错误。
  - 更新缓存存储逻辑：网络请求成功后，将最新的比对结果和当前时间戳更新至 `cachedCheckResult` 和 `lastCheckTime`。

## 3. 渲染端交互适配
- [ ] 修改 `app/work/src/renderer/src/pages/setting/about/AboutSetting.vue` 中的 `handleCheckUpdate` 函数：
  - 页面加载时自动调用的静默检查 `handleCheckUpdate(true)` 中，IPC 传参为 `{ force: false }`。
  - 用户手动点击检查更新时调用的 `handleCheckUpdate(false)` 中，IPC 传参为 `{ force: true }`。

## 4. 验证与检查
- [ ] 在开发环境下运行项目，核实 `pnpm lint` 没有 oxlint 规则校验报错。
- [ ] 本地触发自动及手动检查更新逻辑，通过查看日志或在主进程加调试输出确认：
  - 切换页面多次进入“关于”设置时，自动静默检查能正确命中内存缓存。
  - 点击“检查更新”按钮时，能正确发起网络请求，并在 API 报错 403 时在 UI 展示可读的中文限制提示。
- [ ] 运行 `pnpm build` 确认打包和 TS 编译全部成功。
