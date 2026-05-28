# 执行计划：应用 tab 旁添加刷新按钮

该计划旨在实现右侧边栏“应用” tab 旁边的刷新按钮，使用户可以直接重新加载 AI 应用。

## 依赖与前提条件

- 已有的 `electronAPI.loadAiApp` 可正常工作。

## 详细执行步骤

### 步骤 1：在 `ChatRightSidebar.vue` 中添加刷新状态与方法

- 修改文件：[ChatRightSidebar.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue)
- 引入或声明一个 reactive 状态：`const isAppLoading = ref(false);`
- 声明并实现 `refreshApp` 函数：
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

### 步骤 2：在 `ChatRightSidebar.vue` 的模板中添加刷新按钮

- 在 `NavigationMenu` 中定位到 `activeTab === 'app'` 对应的 `NavigationMenuItem`：
  ```html
  <NavigationMenuItem>
    <NavigationMenuLink as-child :active="activeTab === 'app'">
      <button type="button" class="h-8" @click="activeTab = 'app'">
        <FileText class="size-3.5" />
        应用
      </button>
    </NavigationMenuLink>
  </NavigationMenuItem>
  ```
- 修改为：
  ```html
  <NavigationMenuItem>
    <NavigationMenuLink as-child :active="activeTab === 'app'">
      <button type="button" class="h-8" @click="activeTab = 'app'">
        <FileText class="size-3.5" />
        应用
        <span
          class="group/refresh relative inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ml-1"
          title="刷新应用"
          @click.stop="refreshApp"
        >
          <RotateCw class="size-3" :class="{ 'animate-spin': isAppLoading }" />
        </span>
      </button>
    </NavigationMenuLink>
  </NavigationMenuItem>
  ```

## 验证计划

1. **规范检查**：
   - 运行 `pnpm lint` 验证无代码规范和类型报错。
2. **构建验证**：
   - 运行 `pnpm build` 确认项目可以正常完成构建。
3. **功能验证**：
   - 运行 `pnpm dev` 启动 Electron 应用。
   - 打开一个包含 AI 应用的会话/工作空间，并切换到“应用” tab。
   - 点击“应用”旁边的刷新按钮，观察控制台和窗口，确认 AI 应用已重新加载，且旋转动画正确显示并停止。
