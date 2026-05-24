# Execution Plan - 修复检查更新接口 403 限流与缓存优化

## 目的与背景

当用户进入“关于”页面时，由于自动触发更新检查逻辑，在多次切换菜单时极易因频繁请求 GitHub Release API 导致 403 Rate Limit Exceeded 错误。本变更旨在为主进程 `UpdateService` 的更新检查增加 10 分钟缓存并配置符合 GitHub API 规范的 `User-Agent`，在发生 403 限流时提供友好的中文错误展示。

## 详细变更

1. **共享层 / Preload 层桥接类型**：
   - `app/work/src/shared/hook/update.hook.ts`：修改 `checkUpdate` 参数以接受 `{ force?: boolean }`。
   - `app/work/src/preload/preload.ts`：透传 `request` 参数。

2. **主进程逻辑**：
   - `app/work/src/main/controllers/config/check.update.controller.ts`：更新控制器以解析 `request?.force` 参数并传给服务。
   - `app/work/src/main/service/update.service.ts`：
     - 新增内存缓存字段：`lastCheckTime` (检测时间戳) 和 `cachedCheckResult` (缓存响应结果)。
     - 检查 `force`，若缓存有效（未强制且距离上次检测未满 10 分钟），直接返回缓存结果。
     - 为 GitHub API 请求添加 `User-Agent` 头部。
     - 遭遇 403 状态时，抛出明确的友好中文异常。

3. **渲染进程逻辑**：
   - `app/work/src/renderer/src/pages/setting/about/AboutSetting.vue`：
     - 自动检测：传参 `{ force: false }`。
     - 手动检测：传参 `{ force: true }`。

## 验证计划

- `pnpm lint` 校验无报错。
- `pnpm build` 编译无报错。
- 手动多次切换“关于”页面，检查是否只触发一次网络请求。
- 模拟 403 报错，检验 UI 展示。
