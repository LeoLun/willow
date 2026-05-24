# Execution Plan - 通过 GitHub Pages 托管最新版本 JSON 并优化客户端 Fallback

## 目的与背景

为了规避 GitHub API 403 限流报错，将在发布新 release 时通过 GitHub Actions 抓取最新发布信息生成 `latest.json` 并推送至 `gh-pages` 静态分支进行公开托管。
客户端会优先通过 GitHub Pages 获取 `latest.json`。如 Pages 获取失败，则降级 fallback 至 GitHub API 进行二次重试。

## 详细变更步骤

### 1. GitHub Actions 工作流修改
- 目标文件：`.github/workflows/release.yml`
- 修改内容：
  - 在 `softprops/action-gh-release@v2`（发布资源步骤）后增加 `Generate latest.json` 和 `Deploy to GitHub Pages` 两个步骤。
  - 使用 `sleep 5` 等待 API 同步，用 `curl` 抓取最新 JSON，然后利用 `peaceiris/actions-gh-pages@v4` 进行推送。

### 2. 客户端主进程更新检测重构
- 目标文件：`app/work/src/main/service/update.service.ts`
- 修改内容：
  - 在 `checkUpdate` 方法中，封装双重 `fetch` 请求。
  - 第一步向 `https://leolun.github.io/willow/latest.json` 静态 URL 发起网络请求。
  - 若出错（如 404 或网络故障），捕获并提示 `GitHub Pages update check failed, falling back to GitHub API`，然后降级为向原 `https://api.github.com/repos/LeoLun/willow/releases/latest` API 地址重试请求。
  - 在备用请求中如果触发 403 限流，则按原有友好方式向渲染进程抛出自定义错误。

## 验证计划

- `pnpm lint` 校验代码规范。
- `pnpm --filter willow-work exec tsc --noEmit` 校验类型系统安全。
- 本地手动调试：
  - 在代码中人为制造 GitHub Pages URL 网络失败（修改其主机名），进入关于设置页检查其是否控制台打印 Warn 警告日志并成功 fallback 触发 API 检查。
