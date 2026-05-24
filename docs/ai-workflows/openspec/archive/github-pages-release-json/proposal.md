# OpenSpec Proposal: 通过 GitHub Pages 托管最新版本 JSON 规避限流

## 动机

为了彻底解决 GitHub API 限流问题，我们需要一个不计入 GitHub 速率限制 (Rate Limit) 的静态文件托管地址来提供最新的 Release 版本信息。
GitHub Pages 是最理想的静态托管方案：
1. **零限流限制**：GitHub Pages 托管的静态 JSON 文件不需要通过 GitHub REST API 访问，拥有极高的高并发和高可用能力，且完全不消耗 API 限流额度。
2. **极速响应**：通过 GitHub Pages CDN 分发，在全球有极佳的访问速度。

我们需要在发布新版本时自动更新该静态 JSON 文件，并在桌面应用客户端中优先请求此静态文件。如果静态请求失败，再优雅降级 fallback 到 GitHub API 接口。

## 目标

1. **自动生成与更新最新版本 JSON**：在 GitHub Actions `Release` 工作流中，每次成功创建 Release 时，自动调用 GitHub API 获取最新 Release 的完整 JSON，并将其写入 `latest.json`。
2. **自动部署到 GitHub Pages**：在 GitHub Actions 中自动将 `latest.json` 推送到 `gh-pages` 分支进行托管，使外界可以通过 `https://leolun.github.io/willow/latest.json` 访问。
3. **客户端请求双通道 fallback 策略**：
   - 优先通过 `https://leolun.github.io/willow/latest.json` 检查更新。
   - 若 GitHub Pages 请求不可用（如 404 或网络波动），自动降级请求 `https://api.github.com/repos/LeoLun/willow/releases/latest`。

## 范围

- **GitHub Actions 工作流 (`.github/workflows/release.yml`)**：
  - 在 Release 步骤后增加更新并部署 `latest.json` 的步骤。
  - 使用 GitHub Action（如 `peaceiris/actions-gh-pages`）自动将构建出的 `latest.json` 部署至项目的 `gh-pages` 分支。
- **主进程 `UpdateService`**：
  - 修改 `checkUpdate` 请求逻辑，默认优先调用 `https://leolun.github.io/willow/latest.json`。
  - 在 catch/error 处理中，若优先请求失败，自动发起对 GitHub API `https://api.github.com/repos/LeoLun/willow/releases/latest` 的备用请求。
  - 只有在备用请求也失败时才抛出错误。

## 非范围

- 迁移历史版本的 release 资源到其他云存储（如 OSS/S3），仅使用 GitHub Pages 作为版本检测的中转配置文件托管。
