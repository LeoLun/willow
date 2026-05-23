# 任务列表：将 dev 模式和正式安装包的 sqlite 数据隔离

## 1. 代码修改

- [ ] 修改 `app/work/src/main/main.ts`：
  - 引入或直接使用 `app.isPackaged` 判断当前运行环境。
  - 将 `userData` 路径动态设置为 `com.willow.work-dev`（开发模式下）或 `com.willow.work`（打包模式下）。

## 2. 构建与运行验证

- [ ] 运行开发模式验证：
  - 运行 `pnpm dev` 启动开发版应用。
  - 观察应用是否能成功初始化，且没有任何报错。
  - 确认在本地 `appData` 目录下（例如 macOS 上的 `~/Library/Application Support/`）生成了全新的 `com.willow.work-dev` 目录。
  - 检查该目录下是否包含 `willow.db` 等文件，且 Drizzle 迁移全部成功执行。
- [ ] 验证生产模式稳定性：
  - 运行 `pnpm build` 进行打包构建编译，确保代码无编译错误。
  - (可选) 验证或确保打包后的应用仍读写原有的 `com.willow.work` 目录，且用户原有数据完整。

## 3. 代码质量检查

- [ ] 运行 `pnpm lint` 检查代码样式和 Lint 规则。
- [ ] 运行 `pnpm type-check` 或 `tsc` 验证 TypeScript 类型正确性。
