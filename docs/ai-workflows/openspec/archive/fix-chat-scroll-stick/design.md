# 设计说明

## 修改文件

仅修改 `app/work/src/renderer/src/pages/chat/session/Session.vue`。

## 代码变更概要

### 1. 修复 `scheduleScrollToBottom` 竞态

在 `scrollToBottom()` 函数内部增加 `shouldStickToBottom` 守卫检查：

```ts
function scrollToBottom() {
  if (!shouldStickToBottom.value) return;
  const el = scrollArea.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}
```

这样，即使 `scheduleScrollToBottom` 已经排队了多个异步调用，只要用户在执行前滚动离开底部，所有后续调用都会被跳过。

### 2. "返回底部"按钮

在 template 中，在 `scrollArea` 的同级容器内添加绝对定位的浮动按钮：

```vue
<Transition name="scroll-bottom">
  <Button
    v-if="!shouldStickToBottom && !showWelcome"
    variant="outline"
    size="icon"
    class="absolute bottom-4 left-1/2 z-10 size-8 -translate-x-1/2 rounded-full bg-background shadow-sm"
    @click="handleScrollToBottom"
  >
    <ArrowDown class="size-4" />
  </Button>
</Transition>
```

需要在滚动区域的外层加一个 `relative` 容器来承载这个绝对定位按钮。

### 3. 点击处理函数

```ts
function handleScrollToBottom() {
  shouldStickToBottom.value = true;
  scrollToBottom();
}
```

注意此时需要绕过 `scrollToBottom` 内部的守卫（因为我们刚把 `shouldStickToBottom` 设为 `true`，时序上没问题——赋值是同步的，`scrollToBottom()` 紧随其后也是同步的）。

### 4. 过渡样式

使用 Vue `<Transition>` 配合 CSS class：

```css
.scroll-bottom-enter-active,
.scroll-bottom-leave-active {
  transition: opacity 200ms, transform 200ms;
}
.scroll-bottom-enter-from,
.scroll-bottom-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
```

## DESIGN.md 合规性

- 使用 `@willow/shadcn` 的 `Button` 组件，`variant="outline"` + `size="icon"`
- 使用 `lucide-vue-next` 的 `ArrowDown` 图标
- 阴影保持 `shadow-sm` 级别，符合"轻量浮层"原则
- 过渡保持功能性、轻量
- 不引入新 token 或脱离现有主题体系
