# OpenSpec Proposal: GitHub Actions 构建与自动更新机制

## 动机

随着 Willow 桌面应用的迭代，需要实现以下两个能力：
1. **持续集成与发布**：支持使用 GitHub Actions 自动构建 macOS 平台安装包（包括 Apple Silicon/arm64 与 Intel/x64 架构芯片），提高发版效率并减少人工构建错误。
2. **应用内自动更新**：支持在应用启动或用户手动触发时检查 GitHub 上的新版本。若检测到新版本，则支持在应用内下载并引导用户完成更新，提升用户体验并保证安全性和功能同步。

## 目标

1. **GitHub Actions 自动化构建**：
   - 配置 GitHub Actions 工作流。
   - 支持通过 Git Tag（如 `v*`）或手动触发（`workflow_dispatch`）触发构建。
   - 在 macOS 运行器上分别构建 x64 与 arm64 架构的 DMG 和 ZIP 安装包。
   - 自动生成 GitHub Release 并将构建产物上传至 Release 资源中。

2. **应用内自动更新**：
   - 在 Electron 主进程中实现 GitHub Release 版本检测与下载逻辑。
   - 提供 IPC 接口供渲染进程查询更新状态、开始下载、展示进度并触发安装。
   - 在设置页面中添加“检查更新”入口，显示当前版本，并能在发现新版本时进行提示、显示更新日志、下载及安装。

## 范围

- **GitHub Actions 配置文件**：新增 `.github/workflows/release.yml`。
- **主进程逻辑**：
  - 新增 `UpdateService` 或在 `SystemService` 中扩展更新检测、下载和安装（在 macOS 下打开 DMG）逻辑。
  - 新增 `UpdateController` 负责处理与渲染进程的 IPC 通信。
- **渲染进程逻辑**：
  - 在设置页面（`ConfigurationSetting.vue` 或类似页面）中添加检查更新的 UI 和状态展示。
  - 实现下载进度条和更新弹窗。
- **构建脚本适配**：
  - 调整 `app/work` 下的 Electron Forge 构建配置，确保输出命名的规范性，以便自动更新机制能够精确匹配对应的安装包（arm64 vs x64）。

## 非范围

- **Windows/Linux 的自动更新自动安装**：本阶段主要针对 macOS 芯片架构进行优化，Windows/Linux 版本可在之后扩展（暂不作为本次核心目标）。
- **Apple Developer 证书硬性签名/公证强制要求**：由于证书和公证需要付费 Apple 开发者账号，构建流程应在**无证书**情况下默认生成未签名（或 ad-hoc 签名）的安装包，并支持在配置了 GitHub Secrets 证书环境变量时自动进行硬签名和公证。
