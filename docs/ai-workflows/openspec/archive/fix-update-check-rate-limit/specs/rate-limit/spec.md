# 检查更新接口限流与缓存规范

## 行为定义

### 1. `UpdateService` 的缓存管理
- 主进程 `UpdateService` 需要维护以下私有状态：
  - `lastCheckTime: number`：上一次向 GitHub 发起网络请求检查更新的 Unix 时间戳（单位毫秒），初始值为 `0`。
  - `cachedCheckResult: CheckUpdateResponse | null`：缓存的上一次检查结果，初始值为 `null`。
- `checkUpdate(force: boolean)` 行为：
  - 如果 `force === false` 且 `cachedCheckResult` 不为空，且当前时间距离 `lastCheckTime` 小于 `10` 分钟 (600,000ms)，则直接返回 `cachedCheckResult`。
  - 否则，发起网络请求：
    - 使用 `app.getVersion()` 获取当前软件版本。
    - 发送 `GET https://api.github.com/repos/LeoLun/willow/releases/latest` 请求。
    - 请求头中必须包含：
      - `User-Agent: willow-desktop/<version>` (如 `willow-desktop/0.0.1`)。
    - 网络请求成功后，更新 `lastCheckTime = Date.now()` 并将响应的 `CheckUpdateResponse` 存入 `cachedCheckResult`，然后返回该结果。
    - 网络请求失败时：
      - 如果是开发环境 (`!app.isPackaged`)，降级为开启 Mock 更新（这与现有逻辑一致，但现有 Mock 结果不污染正式的缓存）。
      - 如果是生产环境，且响应状态码为 `403`：
        - 抛出友好且明确的中文错误信息：`"检查更新请求过快，已被 GitHub 限制，请稍后再试（限流错误）"`。
      - 其它非 200 响应状态：
        - 抛出 `无法获取更新信息: ${response.statusText}` 或更详细的错误原因。

### 2. IPC 传输通道参数化
- `CHECK_UPDATE` 常量的 IPC 消息格式：
  - 渲染进程通过 `ipcRenderer.invoke(CHECK_UPDATE, { force?: boolean })` 发起调用。
  - 接收参数：`request?: { force?: boolean }`。
- `CheckUpdateController` 的 `run` 方法：
  - 读取 `request`，解析其中的 `force` 字段（默认为 `false`）。
  - 调用 `this.updateService.checkUpdate(force)` 并将结果返回给渲染进程。

### 3. 前端静默/强制行为区分
- `AboutSetting.vue` 组件挂载时 (`onMounted`)：
  - 触发 `handleCheckUpdate(true)`（即静默检查），传入参数为 `{ force: false }`，不弹框、不修改 `updateStatus` 为 `error`，仅用于在后台更新状态。若有缓存，则使用缓存，避免刷新 About 菜单导致向 GitHub 发起网络请求。
- `AboutSetting.vue` 中的 “检查更新” 按钮：
  - 点击时，触发 `handleCheckUpdate(false)`，传入参数为 `{ force: true }`，指示主进程绕过缓存进行网络请求。
  - 界面显示 `checking` 状态。
  - 若网络请求因为 403 限流失败，在下方红字错误展示区显示中文友好提示：`"检查更新请求过快，已被 GitHub 限制，请稍后再试（限流错误）"`。
