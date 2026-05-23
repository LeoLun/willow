# 2026-05-23-hide-skills.md

## 执行切片 1: 隐藏侧边栏的“技能”Tab

### 目标

在侧边栏中不显示“技能”导航项，从而对用户屏蔽该页面入口。

### 影响文件

- [app/work/src/renderer/src/layout/sidebar/NavMain.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/layout/sidebar/NavMain.vue)

### 修改点

1. 移除 lines 126-131 的“技能” Tab 菜单项。

### 校验命令

```bash
pnpm lint
```

---

## 执行切片 2: 屏蔽 `/skills` 路由

### 目标

确保 `/skills` 页面在应用中不可通过路由直接访问。

### 影响文件

- [app/work/src/renderer/src/router.ts](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/router.ts)

### 修改点

1. 移除 `import Skills from "./pages/skills/Skills.vue";` 导入语句。
2. 移除 `routes` 数组中的 `{ path: "/skills", name: "skills", component: Skills }` 配置项。

### 校验命令

```bash
pnpm lint
pnpm build
```

---

## 执行切片 3: 集成验证

### 验证步骤

1. 运行 `pnpm lint` 验证是否有静态检查错误。
2. 运行 `pnpm build` 确认项目构建无误。
3. 手动验证：启动应用，检查侧边栏中是否已无“技能”Tab，且若以编程或地址方式访问 `/skills`，页面无法渲染（由于没有该路由，应用会回退或不处理该路由）。
