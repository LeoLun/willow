# OpenSpec Proposal: GitHub Actions 自动 CI 构建与手动 Release 发布双轨触发

## 动机

为了防止每次代码提交到 `main` 分支时都自动触发耗时且耗资源的完整应用打包发布（Release）工作流，同时为了保证 `main` 分支的代码质量与类型安全性，我们需要将 CI/CD 流程拆分为双轨：
1. **自动 CI 构建验证**：当代码合并/推送至 `main` 分支或提交针对 `main` 的 PR 时，自动触发轻量级的 CI 流程，运行 Lint、类型检查与包编译构建，以确保主分支代码的稳定性。
2. **手动 Release 发布**：只有当需要真正发版时，由开发者在 GitHub Actions 界面手动触发 Release 工作流，并手动输入目标版本号，完成全架构应用打包、通用 `app.asar` 提取与 GitHub Release 资产上传。

## 目标

1. 新增 `ci.yml` 配置文件，用于自动触发 CI 轻量级构建与校验。
2. 修改 `release.yml` 配置文件，关闭 `push tags` 自动触发，改用 `workflow_dispatch` 手动触发，并支持指定 `version` 输入。
3. 确保在手动触发 Release 时，构建出的 Assets 正确关联到指定的版本号，并且自动在 Git 中生成对应的发布 tag。

## 范围

- **CI 构建工作流**：新增 `.github/workflows/ci.yml`，配置 `main` 分支的自动构建与校验。
- **Release 发布工作流**：修改 `.github/workflows/release.yml`，改为手动触发，支持自定义版本输入并正确注入 `action-gh-release`。

## 非范围

- **自动更新的内部接口与 UI 逻辑**：不涉及 Electron 应用内部的 `UpdateService` 与前端 UI 的改动，这些逻辑保持现状。
