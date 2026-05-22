# OpenSpec Tasks: CI/CD 双轨触发机制任务列表

- [ ] 创建或更新 `ci.yml` 自动构建工作流
  - [ ] 确保在代码合并/推送至 `main` 分支或提交针对 `main` 的 PR 时自动运行
  - [ ] 确保运行 Lint，类型检查与全包编译
- [ ] 修改 `release.yml` 发布工作流
  - [ ] 去除 tags push 触发条件，仅保留 `workflow_dispatch` 手动触发
  - [ ] 引入 `version` 手动输入参数
  - [ ] 配置 `action-gh-release` 使得发布物正确关联到指定的 `version` 标签上
- [ ] 校验配置文件语法与格式
  - [ ] 使用 `pnpm lint` 校验代码规范
  - [ ] 使用 `pnpm build` 确认编译构建没有受到任何影响
- [ ] 提交并推送到 GitHub 远程仓库
