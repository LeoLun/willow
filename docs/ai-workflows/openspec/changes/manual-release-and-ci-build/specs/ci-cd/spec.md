# OpenSpec Specification: CI/CD 双轨触发规范

## 1. 触发规则

### 1.1 CI 自动构建校验 (`ci.yml`)
- **触发分支**：`main`
- **触发事件**：
  - `push` 到 `main` 分支（即合并 PR 或直接 push）
  - 针对 `main` 分支的 `pull_request`
- **执行内容**：
  1. 拉取代码 (`actions/checkout@v4`)
  2. 安装 `pnpm` (9.15.4) 及缓存依赖。
  3. 安装 Node.js (20)
  4. 运行 `pnpm lint` 静态检查。
  5. 运行 `npx tsc --noEmit` 进行 TypeScript 类型检查。
  6. 运行 `pnpm build` 进行 monorepo 包编译。

### 1.2 Release 手动发布 (`release.yml`)
- **触发方式**：仅限 `workflow_dispatch` (手动触发)
- **输入参数**：
  - `version` (类型: string, 必须: 是)：表示本次发布的版本号（例如 `v1.0.0`）。
- **执行内容**：
  1. 拉取代码。
  2. 设置 `pnpm` (9.15.4) 与 Node.js (20)。
  3. 编译 monorepo 依赖包。
  4. 执行 Mac App (x64) 构建打包。
  5. 执行 Mac App (arm64) 构建打包。
  6. 提取 `app.asar` 文件作为热更新增量包资源。
  7. 校验输出文件完整性。
  8. 调用 `softprops/action-gh-release@v2`：
     - `tag_name` 设置为手动输入的 `${{ inputs.version }}`。
     - `name` 设置为 `Release ${{ inputs.version }}`。
     - 上传 x64 与 arm64 的 `.dmg`，`.zip` 文件以及 `app.asar` 资源。

## 2. 环境变量与安全机密
- 保持原有的 Apple ID 及签名环境变量绑定：
  - `APPLE_ID: ${{ secrets.APPLE_ID }}`
  - `APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}`
  - `APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}`
- 使用 `GITHUB_TOKEN` 执行发布资产的上传。
