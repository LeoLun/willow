# refactor-builtin-skills Checklist

- [ ] 清除 `session.service.ts` 中的拦截硬编码 <!-- id: 0 -->
  - [ ] 移除 `isInitCommand` 相关的判断条件
  - [ ] 移除 `executeWorkspaceInitCommand` 方法
  - [ ] 移除对 `WorkspaceInitService` 的导入与构造函数注入
- [ ] 废弃 `WorkspaceInitService` 相关的系统组件 <!-- id: 1 -->
  - [ ] 彻底删除 `app/work/src/main/service/workspace-init.service.ts` 文件
  - [ ] 在 `app/work/src/main/app.module.ts` 中移除该服务的导入与 `providers` 注册
- [ ] 验证端到端执行链路 <!-- id: 2 -->
  - [ ] 在项目工作空间下，测试 `/` 选择 `init` 技能，确认消息发送后 AI 正常承接
  - [ ] 验证 AI 能自主读取目录、写入 `AGENTS.md` 并不报错运行 `ensure-frontmatter.js`
  - [ ] 确认主进程构建与编译正常通过
