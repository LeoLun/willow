# 任务列表

## 1. GitHub Actions 工作流修改
- [ ] 修改 `.github/workflows/release.yml`：
  - 在 `Create Release and Upload Assets` 步骤后面，添加 `Generate latest.json` 步骤：
    - `sleep 5` 以待 API 数据同步。
    - 使用 `curl` 请求 `https://api.github.com/repos/LeoLun/willow/releases/latest`。
    - 输出并验证生成的 `latest.json`。
  - 添加 `Deploy to GitHub Pages` 步骤：
    - 使用 `peaceiris/actions-gh-pages@v4`。
    - 将 `latest.json` 部署至项目 `gh-pages` 分支。

## 2. 客户端主进程逻辑修改
- [ ] 修改 `app/work/src/main/service/update.service.ts` 中的 `checkUpdate` 函数：
  - 增加对 GitHub Pages `https://leolun.github.io/willow/latest.json` 的优先请求。
  - 在 Pages 请求失败时，在控制台打印警告，并降级（Fallback）请求 GitHub API `https://api.github.com/repos/LeoLun/willow/releases/latest`。
  - 调整错误处理，区分是否使用了 Fallback 以及是否返回了 403，确保在 API 依然限流时能正确抛出限流中文错误。

## 3. 验证与检查
- [ ] 运行 `pnpm lint` 验证无代码规范报错。
- [ ] 运行 `pnpm exec tsc --noEmit` 验证主进程及相关代码无编译或类型错误。
- [ ] 运行 `pnpm format` 统一代码格式。
- [ ] 本地临时将 Pages 域名修改为无效地址（如 `https://invalid-domain.github.io/latest.json`），运行 dev 模式验证：
  - 系统是否成功捕获异常。
  - 是否成功 Fallback 降级到 GitHub API 进行二次检查。
