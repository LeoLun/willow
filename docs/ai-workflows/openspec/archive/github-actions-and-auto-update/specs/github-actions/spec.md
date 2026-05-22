# 需求规范：GitHub Actions 构建

## 需求

### R1: 触发机制
- 工作流 MUST 支持在推送形如 `v*`（例如 `v1.0.0`）的 Git Tag 时自动触发。
- 工作流 MUST 支持在 GitHub 页面上通过 `workflow_dispatch` 手动触发。

### R2: 运行环境与依赖准备
- 运行器环境 MUST 使用 macOS（建议 `macos-latest` 或 `macos-14` 以原生支持 Apple Silicon 构建）。
- 依赖管理工具 MUST 使用 `pnpm`，版本需与项目中配置的 `packageManager` 一致（即 `9.15.4`）。
- Node.js 版本建议使用 `20.x`。
- 构建前 MUST 正确运行 `pnpm install` 以及必要的 `pnpm build`（构建 monorepo 中的共享包，如 `@willow/core`，`@willow/poetry`，`@willow/shadcn`，`@willow/ui` ）。

### R3: 双芯片架构构建
- 构建任务 MUST 同时输出适用于 Apple Silicon（`arm64`）和 Intel 芯片（`x64`）的安装包。
- 最终构建产物格式 MUST 包含 `.dmg` 和 `.zip`（通过调用 `pnpm --filter willow-work make:mac`，分别传入 `--arch=arm64` 和 `--arch=x64` 对应的脚本）。

### R4: 证书与签名回退机制
- 若 GitHub Secrets 中未配置 macOS 签名证书（如 `API_KEY`、`APPLE_ID` 等），工作流 SHOULD 允许构建未签名（Ad-hoc 签名）的应用，不应因此中断构建。
- 若配置了相应的 Apple Developer 证书与公证信息，工作流 SHOULD 支持自动调用签名与公证。

### R5: 发布与产物上传
- 构建完成后，工作流 MUST 自动在 GitHub 上创建一个 Draft 状态（或直接发布，取决于配置，通常新建 Tag 时发布）的 Release。
- 所有生成的安装包（如 `Willow-Work-x64.dmg`, `Willow-Work-arm64.dmg` 等） MUST 上传至该 Release 的 assets 中。

## 验收标准

- [ ] 在 GitHub 仓库中推送 `v1.0.0` Tag 能触发构建流水线。
- [ ] 流水线能够顺利执行 `pnpm install`、`pnpm build`（构建依赖包）和主应用 make 流程。
- [ ] 构建流水线执行完毕后，自动生成 GitHub Release。
- [ ] Release 的附件中包含 macOS x64 DMG/ZIP 和 macOS arm64 DMG/ZIP 四个文件。
