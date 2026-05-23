# 任务列表：屏蔽技能 Tab 和页面

## 1. 侧边栏修改
- [ ] 在 `app/work/src/renderer/src/layout/sidebar/NavMain.vue` 中移除技能 Tab 的菜单项。

## 2. 路由修改
- [ ] 在 `app/work/src/renderer/src/router.ts` 中移除 `/skills` 路由及对应的组件导入。

## 3. 验证与构建
- [ ] 运行 `pnpm lint` 确保没有代码风格和静态分析错误。
- [ ] 运行 `pnpm build` 确保项目构建成功。
