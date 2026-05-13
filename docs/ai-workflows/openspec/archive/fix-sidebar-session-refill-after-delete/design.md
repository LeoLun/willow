# Design: fix-sidebar-session-refill-after-delete

## Overview

左侧栏工作空间会话列表是桌面工作台中的高频导航区。它的默认窗口大小是 5 条会话，并通过“查看更多...”进入完整历史页。删除会话后，可见窗口必须继续代表“该工作空间最新的最多 5 条会话”，而不是仅仅从旧窗口里拿掉一项；完整历史页也必须跟随当前工作空间和删除结果保持一致。

本次修复只改变删除后的数据同步语义，不改变左侧栏视觉结构。实现仍需遵守仓库根目录 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 中对桌面工作台、左侧导航密度、shadcn 基础组件和克制反馈的要求。

## Current Behavior

相关实现边界：

- [`NavMain.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/layout/sidebar/NavMain.vue) 打开删除确认弹窗，并在 `onDeleted` 中调用 `sessionStore.cleanSession(session.id, session.workspaceId)`
- [`DeleteSession.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/layout/dialog/delete-session/DeleteSession.vue) 直接调用 `electronAPI.deleteSession`
- [`session.ts`](/Users/liujinglun/code/willow/app/work/src/renderer/src/stores/session.ts) 使用 `SIDEBAR_SESSION_LIMIT = 5` 拉取侧边栏列表，并维护 `sessionMap` 与 `sessionTotals`
- `cleanSession` 只做本地 filter，不会补位，也不会刷新 `sessionTotals`
- [`WorkspaceHistory.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/workspace-history/WorkspaceHistory.vue) 只在 `onMounted` 时调用一次 `loadMore()`，不会在 `route.params.workspaceId` 变化时重置本地 `sessions`、`total` 和 `page`
- 历史页本地 `sessions` 独立于侧边栏 store，侧边栏删除成功后不会主动移除或重载历史页中的同一会话

因此，当 `sessionTotals[workspaceId] > 5` 且删除一条可见会话时，侧边栏会少显示一条；当用户停留在历史页时，还可能看到已删除会话或切换工作空间后仍显示旧工作空间历史数据。

## Chosen Approach

删除成功后，以被删除会话的 `workspaceId` 为粒度刷新侧边栏会话列表。

行为要求：

- 删除请求成功后，再更新前端列表
- 更新方式应重新获取该工作空间最新的 `SIDEBAR_SESSION_LIMIT` 条会话
- 同步更新该工作空间的总数
- 不需要刷新其他工作空间
- 不需要改变历史页分页接口
- 历史页在 `workspaceId` 路由参数变化时必须重置分页状态并重新加载目标工作空间第一页
- 若历史页当前工作空间正是被删除会话所属工作空间，删除成功后历史页必须重载或同步移除已删除会话

## State Ownership

建议将删除后的侧边栏同步能力收敛到 `useSessionStore`，让 `NavMain.vue` 只表达用户动作和弹窗回调。

可选实现形态：

- 保留 `DeleteSession.vue` 负责实际删除请求，`onDeleted` 后调用 store 的单工作空间刷新方法
- 或将删除请求统一收敛到 `sessionStore.deleteSession`，由 store 在删除成功后刷新对应工作空间

无论采用哪种实现，最终都必须避免“弹窗删除一次、store 删除再请求一次”的重复删除。

历史页数据仍由 `WorkspaceHistory.vue` 自己持有，因为它是分页列表而不是侧边栏 5 条窗口。它需要响应两个外部变化：

- `route.params.workspaceId` 变化：清空当前历史页分页状态，加载目标工作空间第一页
- 会话删除成功：如果删除会话所属 `workspaceId` 等于当前历史页 `workspaceId`，刷新当前历史页数据，避免已删除项残留

## Data Consistency Rules

### Sidebar Window

删除成功后，`sessionMap[workspaceId]` 应被服务端返回的最新列表替换，而不是在旧数组上继续局部拼接。

这样可以保证：

- 排序继续以主进程 / 数据层的 `lastActiveAt` 规则为准
- 下一条会话可以自动补进侧边栏
- 若其他会话在删除期间发生标题或活跃时间变化，刷新结果以服务端为准

### Total And “查看更多...”

`hasMoreSessions(workspaceId)` 必须基于刷新后的 `sessionTotals[workspaceId]` 判断。

删除后的预期：

- 总数仍大于 5：继续显示“查看更多...”
- 总数等于 5：隐藏“查看更多...”，同时展示 5 条会话
- 总数小于 5：隐藏“查看更多...”，展示真实剩余列表
- 总数为 0：展示“暂无会话”

### History Page Route Switching

当用户在历史页点击另一个工作空间的“查看更多...”时，路由仍是同一组件实例，只是 `workspaceId` 参数变化。

必须显式处理：

- 清空旧工作空间的 `sessions`
- 将 `total` 重置为未初始化状态
- 将 `page` 重置为第一页
- 使用新 `workspaceId` 请求第一页数据
- 页面标题跟随新工作空间名称更新
- sentinel / 无限滚动继续可用，不重复追加旧工作空间数据

### History Page Delete Synchronization

当侧边栏删除会话成功时：

- 如果当前页面不是历史页，不需要额外刷新历史页
- 如果当前历史页的 `workspaceId` 与删除会话所属工作空间不同，不刷新当前历史页
- 如果当前历史页的 `workspaceId` 与删除会话所属工作空间相同，历史页必须不再显示被删除会话

实现可以选择：

- 重置并重新加载当前历史页第一页，保证分页和总数完全一致
- 或从当前 `sessions` 中移除已删除会话并同步扣减 `total`，再按需补齐当前已加载窗口

推荐重载第一页，理由是实现简单、与服务端排序和总数保持一致，也避免本地分页补齐逻辑变复杂。

### Failure Handling

删除失败时：

- 不应先从本地移除会话
- 不应刷新出一个与实际删除结果不匹配的列表
- 弹窗可继续保持现有错误输出方式；本次不要求新增 toast

## Current Session Route Handling

若被删除的是当前 URL 中的 `sessionId`：

- 侧边栏不得继续高亮已删除会话
- 页面不得因为当前会话缺失而出现运行时异常
- 后续实现可以选择导航到工作空间新会话入口、工作空间历史页，或保持已有受控空态；但必须避免指向已删除会话的不可恢复状态

本次规格不强制指定唯一跳转目标，因为现有路由缺失会话时已有页面上下文需要在实现阶段确认。

## Visual And Interaction Constraints

- 保持左侧栏现有密度、缩进、折叠和菜单样式
- 保持历史会话页现有列表视觉、时间分组、空态和“已加载全部”文案
- 不新增额外加载骨架或全局遮罩
- 删除成功后的列表补位应表现为自然的数据更新，不制造明显动效
- 不更改“查看更多...”文案
- 不引入新的颜色 token 或自定义基础控件

## Implementation Notes

- 优先复用 `fetchSessionList([workspaceId])`
- 如需更清晰语义，可在 store 中增加 `refreshWorkspaceSessions(workspaceId)` 或类似方法
- `hasMoreSessions` 当前固定比较 `SIDEBAR_SESSION_LIMIT`，这与本次需求一致
- 若保留 `cleanSession`，应避免删除成功路径继续只调用它作为最终状态
- 历史页应避免只在 `onMounted` 加载数据；需要 watch `workspaceId` 或使用等价的路由更新处理
- 历史页删除同步可以通过轻量事件、store 状态版本号、或删除回调中的路由上下文判断实现；不得新增全局轮询

## Open Questions Resolved

### 删除后是否必须补到 5 条

必须。只要该工作空间删除后仍有至少 5 条会话，左侧栏就应展示 5 条。

### 是否要刷新所有工作空间

不需要。刷新范围限制在被删除会话所属工作空间。

### 是否改变默认展示数量

不改变，仍为 5 条。

### 历史页切换工作空间是否复用旧分页状态

不复用。每个目标工作空间进入历史页时都应从第一页重新加载，避免旧工作空间数据混入。

### 侧边栏删除后历史页是否必须原地同步

必须。若当前打开的是同一工作空间历史页，删除成功后历史页不能继续显示已删除会话。
