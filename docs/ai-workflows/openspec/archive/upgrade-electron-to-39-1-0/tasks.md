# 任务列表：升级 Electron 版本至 39.1.0

## 1. 更新依赖配置与安装

- [ ] 修改项目根目录下的 `pnpm-workspace.yaml`，将 `catalog` 中的 `electron` 版本更新为 `39.1.0`
- [ ] 移除项目根目录下的 `package.json` 中的 `pnpm.overrides.node-abi` 字段
- [ ] 在项目根目录下执行 `pnpm install` 以更新 lock 依赖关系
- [ ] 观察安装和自动触发的原生模块重新编译输出，检查是否有警告或错误

## 2. 重新编译原生模块 (better-sqlite3)

- [ ] 进入 `app/work` 目录，手动执行 `pnpm run rebuild:native` 强制针对 Electron 39.1.0 重新编译原生模块
- [ ] 确认编译过程顺利完成，且在主进程运行时无原生模块载入错误 (Cannot find module / Dynamic Link Error)

## 3. 全局构建与静态检查

- [ ] 在项目根目录下运行 `pnpm build`，确保所有 packages 和 app 能够成功构建，未发生任何编译错误
- [ ] 在项目根目录下运行 `pnpm lint` 和 `pnpm format:check`，确保代码风格和规范符合要求

## 4. 应用启动与功能验证

- [ ] 执行 `pnpm dev` 启动 Electron 桌面应用开发环境
- [ ] 验证主窗口（Main Window）能够正确载入，且样式正常
- [ ] 验证悬浮球窗口（Floating Ball Window）能够正确展示，且拖拽与交互无异常
- [ ] 验证历史会话、系统设置等需要通过 `better-sqlite3` 读写数据库的功能，确认数据库访问正常
- [ ] 检查终端控制台与 Chrome DevTools 控制台是否存在 Electron 相关的 Deprecation 警告或 Error，如有，进行适配处理

## 5. 打包测试

- [ ] 在 `app/work` 目录下运行 `pnpm package` 尝试打包应用，确保 Electron Forge 的打包配置能够支持新版 Electron 并顺利输出应用安装包
