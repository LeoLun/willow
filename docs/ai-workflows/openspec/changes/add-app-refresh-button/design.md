# 设计方案：应用 tab 刷新按钮

## 界面与布局设计

刷新按钮将放置在“应用” tab 按钮内部的文本“应用”右侧。

具体 DOM 结构设计如下：
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

## 交互行为

1. **悬停与提示**：鼠标悬停在刷新按钮上时显示 Tooltip/Title: `刷新应用`。
2. **点击事件**：点击刷新按钮时调用 `refreshApp` 函数，阻止事件冒泡以免触发 `activeTab` 切换。
3. **加载中状态**：
   - 增加 `isAppLoading` 响应式变量，默认 `false`。
   - 当点击刷新按钮后，`isAppLoading` 设为 `true`，`RotateCw` 图标应用 `animate-spin` 动画。
   - 重新加载完成后，`isAppLoading` 设为 `false`。
