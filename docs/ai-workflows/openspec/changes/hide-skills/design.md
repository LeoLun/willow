# 设计文档：屏蔽技能 Tab 和页面

## 架构与设计决策

### 1. 侧边栏菜单移除

在 `app/work/src/renderer/src/layout/sidebar/NavMain.vue` 中，删除对应“技能”的 `SidebarMenuItem`：

```html
<!-- 移除前 -->
<SidebarMenuItem>
  <SidebarMenuButton class="cursor-pointer" @click="router.push('/skills')">
    <LayoutGrid />
    <span>技能</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```

移除后，侧边栏只保留“新会话”和“自动化”两项主菜单。

### 2. 路由屏蔽

在 `app/work/src/renderer/src/router.ts` 中：
- 移除对 `Skills` 组件的导入：
  ```typescript
  import Skills from "./pages/skills/Skills.vue";
  ```
- 移除 `/skills` 路由配置：
  ```typescript
  { path: "/skills", name: "skills", component: Skills },
  ```

这会使得 `/skills` 路径在应用中不再生效，防止用户绕过侧边栏通过路由直接访问该页面。
