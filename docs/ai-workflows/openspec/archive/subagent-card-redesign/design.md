# 子 Agent 卡片视觉设计

## 布局结构

```
┌──────────────────────────────────────────────────┐
│ ● 委派「Willow / 工作空间 Agent」   [>]          │
│   正在委派执行中...                               │
└──────────────────────────────────────────────────┘
```

### 行内元素分解

1. **状态指示器**（左侧）
   - 运行中：`Loader2` 旋转图标（`animate-spin`），`text-primary`
   - 完成：`CheckCircle2`，`text-emerald-500`
   - 失败：`XCircle`，`text-destructive`
   - 等待中：`Loader2` 旋转图标，`text-muted-foreground`

2. **标题**（中间，flex-1）
   - 文字：`委派「{workspaceName} / {agentName}」`
   - 运行中使用 `Shimmer` 效果
   - 完成/失败后使用 `text-muted-foreground`
   - 字号：`text-sm leading-5`，截断处理 `truncate`

3. **状态文字**（标题下方）
   - 文字：`正在委派执行中...` / `委派执行已完成` / `委派执行已失败` 等
   - 样式：`text-xs text-muted-foreground`

4. **导航箭头**（右侧，hover 可见）
   - 图标：`ChevronRight`（lucide）
   - 默认隐藏，整个卡片 hover 时显示
   - 样式：`text-muted-foreground hover:text-foreground`
   - 点击触发 `onNavigateToSession(childSessionId)`

## 交互行为

- **默认态**：无箭头，标题 + 状态文字平铺展示
- **hover 态**：右侧出现 `>` 箭头，整体轻微背景变化 `hover:bg-muted/40`
- **点击箭头**：跳转到子会话页面
- 无 Collapsible / 展开折叠行为

## Token 使用

遵守 DESIGN.md 和现有 `index.css` token：
- 背景：`transparent`（默认），`bg-muted/40`（hover）
- 文字：`text-foreground`、`text-muted-foreground`
- 边框：无额外边框（保持与其他 tool call 一致的无边框风格）
- 圆角：`rounded-md`（遵循 `--radius` 体系）
- 间距：`gap-2`、`py-1`
