# 2026-05-22-fix-sleep-cron.md

## 执行切片 1: 引入 Electron powerMonitor 并监听 resume 事件

### 目标

解决设置定时任务后，笔记本盒盖休眠再次打开时，定时任务不会继续执行的问题。

### 影响文件

- [app/work/src/main/service/automation.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/automation.service.ts)

### 修改点

1. 在 `automation.service.ts` 文件顶部引入 `powerMonitor`。
2. 增加 `isPowerMonitorSubscribed` 标记，防止重复监听。
3. 在 `restoreSchedules` 方法中，注册 `powerMonitor` 的 `resume` 事件回调，回调中再次调用 `restoreSchedules()` 以重置 `node-cron` 定时器并补运行休眠期间遗漏的任务。

### 校验命令

```bash
pnpm lint
pnpm build
```

---

## 执行切片 2: 集成验证与测试

### 验证步骤

1. 启动应用并创建/启用一个每分钟执行一次的定时任务。
2. 通过关闭电脑盖子休眠，或临时在代码中触发 `powerMonitor.emit('resume')`。
3. 检查控制台输出并确认：
   - 触发了 `restoreSchedules` 方法。
   - 休眠期间错过的任务以 `catch_up` 类型被正确补运行。
   - 随后的任务依然能够按每分钟准时执行。
