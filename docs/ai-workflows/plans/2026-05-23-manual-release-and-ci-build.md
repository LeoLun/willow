# Execution Plan: CI/CD 双轨触发机制 (合并自动触发构建校验与手动触发 Release 发布)

本执行计划针对 `manual-release-and-ci-build` 变更，旨在实现：
1. 合并/推送代码至 `main` 分支或提交针对 `main` 的 PR 时，自动触发轻量级 CI 构建校验（Lint、类型检查、全包编译）。
2. 打包与发布 Release 流程改为通过 GitHub Actions 控制台手动输入版本号触发，并将发布产物与指定版本号关联。

## 1. 计划详情

我们将实施划分成 3 个执行分片：

### Slice 1: 新增自动构建工作流 ci.yml
- **文件**：`.github/workflows/ci.yml` [NEW]
- **实现内容**：
  - 配置基于 `macos-latest` 的 CI 检查流。
  - 使用 `pnpm` (9.15.4) 及相关缓存。
  - 依赖安装完成后，执行：
    - `pnpm lint` 进行静态检查。
    - `npx tsc --noEmit`（在 `app/work` 目录下运行）进行 TypeScript 类型检查。
    - `pnpm build` 进行 monorepo 包编译。
- **校验**：确保配置文件正确定义且支持 push/PR triggers 到 `main` 分支。

### Slice 2: 修改 Release 发布工作流 release.yml
- **文件**：`.github/workflows/release.yml` [MODIFY]
- **实现内容**：
  - 移除原有的 tags push 触发条件。
  - 添加 `workflow_dispatch` 的 `version` 输入项，并设为 `required: true`。
  - 修改 `action-gh-release@v2` 步骤：
    - 设置 `tag_name: ${{ inputs.version }}`。
    - 设置 `name: Release ${{ inputs.version }}`。
- **校验**：审查 yaml 语法正确，特别注意 `workflow_dispatch` inputs 语法。

### Slice 3: 全局校验与提交发布
- **实现内容**：
  - 在本地运行 `pnpm lint` 和 `pnpm build` 确认项目本身构建无异常。
  - 使用 `git add` 和 `git commit` 将 CI/CD 文件的修改提交到 `main` 分支。
  - 推送到远程 GitHub 仓库，演示并编写最终的用户发布使用说明。

## 2. 验证与停止条件

### 自动验证
1. 运行 `pnpm lint` 确保没有 Oxlint 静态规则检查报错。
2. 运行 `pnpm build` 确认项目可以正常构建通过。

### 手动验收条件
- 检查 GitHub Actions 配置文件语法，保证在 GitHub 上无加载错误。
- 往 `main` 分支 push 会自动运行 `CI Build` 流程。
- 通过 Actions 点击 `Release` 工作流，能看到 `Run workflow` 按钮并要求输入版本号。
