# 任务列表

## 1. 实现应用刷新按钮与逻辑

- [x] 修改 [ChatRightSidebar.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue)：
  - 添加 `isAppLoading` 状态变量：`const isAppLoading = ref(false);`
  - 添加 `refreshApp` 异步函数，调用 `electronAPI.loadAiApp` 重新加载应用，并重新计算 Bounds：
    ```typescript
    async function refreshApp() {
      if (!workspacePath.value) return;
      try {
        isAppLoading.value = true;
        await electronAPI.loadAiApp({ workspaceRoot: workspacePath.value });
        sendBounds();
      } catch (err) {
        console.error("Failed to reload AI app", err);
      } finally {
        isAppLoading.value = false;
      }
    }
    ```
  - 更新 template 中的 `应用` 导航栏项，加入带 `RotateCw` 图标的刷新按钮，并绑定 `@click.stop="refreshApp"` 以及 `:class="{ 'animate-spin': isAppLoading }"`。

## 2. 验证与构建

- [x] 运行 `pnpm lint` 检查代码规范。
- [x] 运行 `pnpm build` 确认编译正常。
- [ ] 启动应用（`pnpm dev`），切换到“应用” Tab，点击刷新按钮，验证 AI 应用是否成功重新加载，且没有报错。
