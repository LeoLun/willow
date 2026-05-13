# Plan: fix-sidebar-session-refill-after-delete

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/fix-sidebar-session-refill-after-delete/proposal.md`
- `docs/ai-workflows/openspec/changes/fix-sidebar-session-refill-after-delete/design.md`
- `docs/ai-workflows/openspec/changes/fix-sidebar-session-refill-after-delete/tasks.md`
- `docs/ai-workflows/openspec/changes/fix-sidebar-session-refill-after-delete/specs/sidebar-session-list/spec.md`
- `DESIGN.md`

## Implementation Goal

删除左侧栏工作空间内的会话后，只刷新被删除会话所属工作空间的侧边栏会话窗口，使它重新展示最新的最多 5 条会话，并同步总数驱动“查看更多...”显示状态。删除失败不能提前修改本地列表；删除当前路由会话时不能留下已删除会话高亮或异常空白。完整历史会话页也要保持一致：切换不同工作空间的“查看更多...”时重置分页并加载目标工作空间；侧边栏删除当前历史页所属工作空间的会话后，历史页不再显示已删除项。

## Decisions

1. 采用 OpenSpec 推荐的 Approach A：删除成功后按 `workspaceId` 重新拉取该工作空间侧边栏会话列表。
2. 不新增后端接口，优先复用现有 `electronAPI.getSessionList({ workspaceIds: [workspaceId], limit: 5 })` 链路。
3. 不改变 `SIDEBAR_SESSION_LIMIT = 5`，不调整“查看更多...”文案、样式或左侧栏结构。
4. 删除请求必须只有一个调用方实际执行，避免 `DeleteSession.vue` 和 `sessionStore.deleteSession(...)` 双重删除。
5. 当前路由会话被删除后的目标路由可在实现阶段按现有页面状态选择，但必须满足“不高亮已删除会话、不崩溃”的规格。
6. 历史页不新增删除入口、不改视觉结构；只补齐现有分页列表的生命周期同步。
7. 历史页切换工作空间时不复用旧分页状态，每次目标 `workspaceId` 变化都从第一页重新加载。
8. 侧边栏删除同步历史页优先采用“重置并重载当前历史页第一页”，以服务端排序和总数为准。

## Execution Slices

### Slice 1: 收敛 session store 的刷新语义

目标：让 store 提供明确的“刷新某工作空间侧边栏会话窗口”能力，并确保刷新会同时更新列表和总数。

涉及文件：

- `app/work/src/renderer/src/stores/session.ts`

步骤：

1. 检查 `fetchSessionList(workspaceIds)` 当前对 `response.sessions` 与 `response.totals` 的合并逻辑，确认单工作空间调用会替换 `sessionMap[workspaceId]`。
2. 增加语义更清晰的单工作空间方法，例如 `refreshWorkspaceSessions(workspaceId)`，内部复用 `fetchSessionList([workspaceId])`。
3. 调整 `deleteSession(id, workspaceId)` 的职责：推荐让它执行删除请求，删除成功后调用 `refreshWorkspaceSessions(workspaceId)`，并返回删除结果或刷新后的 map。
4. 保留或清理 `cleanSession(...)` 时要确认没有其他调用方依赖；若保留，应避免左侧栏删除成功路径继续只调用它作为最终状态。
5. 确认删除失败时不会进入本地 filter，也不会覆盖 `sessionTotals`。

验证点：

- 删除成功后的 store 最终状态来自 `fetchSessionList([workspaceId])` 返回值。
- `sessionTotals[workspaceId]` 会跟随刷新后的 totals 更新。
- `hasMoreSessions(workspaceId)` 继续基于更新后的总数和固定上限 5 判断。

### Slice 2: 串联删除弹窗和左侧栏回调

目标：删除确认完成后触发 store 的单工作空间刷新，同时避免重复调用删除 API。

涉及文件：

- `app/work/src/renderer/src/layout/sidebar/NavMain.vue`
- `app/work/src/renderer/src/layout/dialog/delete-session/DeleteSession.vue`

步骤：

1. 选择删除请求归属：
   - 推荐方案：`DeleteSession.vue` 继续只负责确认 UI 和提交动作，但调用 `sessionStore.deleteSession(session.id, session.workspaceId)`，成功后 emit `deleted`。
   - 若保留 `DeleteSession.vue` 直接调用 `electronAPI.deleteSession`，则 `NavMain.vue` 的 `onDeleted` 必须调用 `refreshWorkspaceSessions(workspaceId)`，不能调用 `deleteSession(...)` 再删一次。
2. 按所选方案更新 `NavMain.vue` 的 `handleDeleteSession(...)` 回调，删除成功后不再只调用 `cleanSession(...)`。
3. 保持现有 Dialog 视觉结构、按钮层级和 destructive 删除按钮，不新增额外 UI。
4. 确认 dropdown 打开状态不会因为刷新留下错误菜单；如现有状态自然关闭即可，不额外做 UI 改造。

验证点：

- 从左侧栏删除一条会话只产生一次 `deleteSession` IPC 请求。
- 删除成功后只刷新被删除会话所属工作空间的 `getSessionList`。
- 删除失败时弹窗 catch 后不会 emit `deleted`，侧边栏不变。

### Slice 3: 处理删除当前路由会话

目标：当前 URL 指向的会话被删除后，页面状态受控，不继续指向已删除会话。

涉及文件：

- `app/work/src/renderer/src/layout/sidebar/NavMain.vue`
- 可能涉及 `app/work/src/renderer/src/pages/chat/Chat.vue`
- 可能涉及 `app/work/src/renderer/src/pages/chat/session/Session.vue`

步骤：

1. 检查当前路由会话缺失时 `Chat.vue`、`Session.vue` 的现有表现，判断是否已有受控空态或自动修复。
2. 在 `NavMain.vue` 删除成功回调中识别 `route.params.sessionId` 是否等于被删除会话 id。
3. 若当前会话被删除，执行最小路由修复：
   - 优先导航到 `/?workspaceId=<deleted.workspaceId>`，让用户回到该工作空间的新会话入口；
   - 如实现阶段发现该入口不符合现有路由语义，再选择工作空间历史页或已有受控空态。
4. 确认路由跳转发生在删除成功之后，避免失败删除时离开当前会话。
5. 确认刷新后的 `sessionMap` 不包含已删除会话，因此左侧栏不会继续高亮。

验证点：

- 删除当前会话后 URL 不再停留在 `/<deletedSessionId>`，或主内容区有明确受控空态。
- 左侧栏不再高亮已删除项。
- 删除非当前会话时不发生无关路由跳转。

### Slice 4: 静态验证和手动验收

目标：覆盖 OpenSpec 中列表补位、更多状态、失败保护和当前路由四类风险。

命令验证：

1. 运行 `pnpm lint`。
2. 若改动引入类型风险或 lint 无法覆盖，运行 `pnpm build`。
3. 全仓搜索 `cleanSession(`，确认左侧栏删除成功路径不再只做本地移除。
4. 全仓搜索 `deleteSession({ id` 或相关 IPC 调用，确认会话删除没有重复请求路径。

手动验证：

1. 准备一个总数大于 5 的工作空间，展开左侧栏，删除一条可见会话；确认列表自动补回 5 条。
2. 准备一个删除后总数等于 5 的工作空间，删除后确认“查看更多...”隐藏且仍展示 5 条。
3. 准备一个删除后总数小于 5 的工作空间，删除后确认展示真实剩余数量且不显示“查看更多...”。
4. 删除当前 URL 对应会话，确认不会保留已删除高亮，不出现空白崩溃。
5. 模拟或观察删除失败场景，确认失败时列表未提前移除；若不易手动模拟，在最终说明中标注未覆盖原因和代码级保障。
6. 删除某个工作空间的会话后，观察其他工作空间列表没有被重新拉取或视觉跳动。

### Slice 5: 修复历史页路由参数切换

目标：同一个 `WorkspaceHistory.vue` 实例在 `workspaceId` 路由参数变化时，清空旧工作空间数据并加载目标工作空间第一页。

涉及文件：

- `app/work/src/renderer/src/pages/workspace-history/WorkspaceHistory.vue`

步骤：

1. 将当前 `onMounted` 中“加载工作空间列表 + 调用 `loadMore()`”拆成可复用初始化流程。
2. 增加 `resetHistoryState()`，负责将 `sessions` 置空、`total` 置回 `-1`、`page` 置回 `1`，并清理可能影响下一次加载的局部状态。
3. 增加 `reloadHistory()` 或等价方法，按顺序执行重置和第一页加载。
4. 使用 `watch(workspaceId, ...)` 或 Vue Router 等价机制监听 `route.params.workspaceId` 变化；新旧值不同时调用 `reloadHistory()`。
5. 确保首次进入页面仍会加载工作空间列表并加载第一页，避免 `onMounted` 和 watcher 同时重复请求第一页。
6. 在 `loadMore()` 内读取一个稳定的当前 `workspaceId` 快照，避免请求过程中路由切换后把旧响应追加到新工作空间列表。
7. 如果 `workspaceId` 无效或转换为 `NaN`，不发起历史会话请求，并展示受控空态或保持空列表。
8. 保持 IntersectionObserver 逻辑可用；sentinel 进入视口时继续调用 `loadMore()`，但必须基于当前工作空间的新分页状态。

验证点：

- 从工作空间 A 的历史页点击工作空间 B 的“查看更多...”，列表不会保留 A 的会话。
- 标题显示工作空间 B，空态 / “已加载全部”状态也基于 B 的数据。
- 切换工作空间时不会把第一页重复追加两次。

### Slice 6: 同步侧边栏删除到当前历史页

目标：侧边栏删除会话成功后，若当前页面是同一工作空间历史页，历史页重载当前工作空间第一页；删除其他工作空间会话不影响当前历史页。

涉及文件：

- `app/work/src/renderer/src/stores/session.ts`
- `app/work/src/renderer/src/pages/workspace-history/WorkspaceHistory.vue`
- 可能涉及 `app/work/src/renderer/src/layout/dialog/delete-session/DeleteSession.vue`

步骤：

1. 在 `useSessionStore` 中增加轻量删除同步信号，例如 `lastDeletedSession = ref<Session | null>(null)` 或递增版本号携带 `sessionId` / `workspaceId`。
2. 在 `deleteSession(id, workspaceId)` 的删除请求成功且侧边栏刷新完成后，更新该删除同步信号。
3. 保持删除失败路径不更新删除同步信号，避免历史页误刷新。
4. 在 `WorkspaceHistory.vue` 中通过 store refs 监听删除同步信号。
5. 当删除信号的 `workspaceId` 等于当前 `workspaceId` 时，调用 `reloadHistory()`。
6. 当删除信号的 `workspaceId` 与当前历史页不同，直接忽略。
7. 如果被删除的是当前 URL 对应会话，继续沿用 Slice 3 的路由修复；历史页同步不新增额外跳转。
8. 避免全局轮询、全工作空间重拉或历史页无条件重载。

验证点：

- 当前在工作空间 A 历史页，侧边栏删除 A 的会话后，历史页不再显示该会话。
- 当前在工作空间 A 历史页，侧边栏删除 B 的会话后，A 的历史页不刷新、不替换。
- 删除失败时历史页不重载。

### Slice 7: 历史页专项验证

目标：覆盖新增 OpenSpec 中历史页路由切换和删除同步场景。

命令验证：

1. 运行 `pnpm lint`。
2. 运行 `pnpm build`。
3. 运行本次改动文件的 `pnpm exec oxfmt --check app/work/src/renderer/src/pages/workspace-history/WorkspaceHistory.vue app/work/src/renderer/src/stores/session.ts app/work/src/renderer/src/layout/dialog/delete-session/DeleteSession.vue app/work/src/renderer/src/layout/sidebar/NavMain.vue`。
4. 全仓搜索删除同步信号引用，确认只有 store 写入、历史页读取，不形成多处隐式副作用。

手动验证：

1. 进入工作空间 A 历史页，滚动加载部分历史，再点击工作空间 B 的“查看更多...”，确认标题、列表、分页状态切到 B。
2. 从工作空间 A 历史页切换到无会话或少量会话的工作空间 B，确认不残留 A 的列表，并正确显示空态或“已加载全部”。
3. 当前在工作空间 A 历史页时，从侧边栏删除 A 的某个已显示会话，确认历史页重载后不再显示该会话。
4. 当前在工作空间 A 历史页时，从侧边栏删除工作空间 B 的会话，确认 A 的历史页不被替换。
5. 删除当前 URL 对应会话时，确认原有路由修复仍成立，不出现已删除高亮或异常空白。

## Stop Conditions

- 如果发现 `getSessionList` 单工作空间调用无法返回刷新后的 totals，停止并回到 `workflow-spec` 确认是否需要新增接口或调整响应契约。
- 如果当前会话被删除后的路由修复需要新增产品级空态、确认弹窗或导航规则，停止并回到 `workflow-spec` 补充行为定义。
- 如果实现需要修改左侧栏展示上限、历史页分页、排序规则或 UI 结构，停止并回到 `workflow-spec`，因为这些都超出本次范围。
- 如果删除请求已被其他组件复用且职责改动会影响非左侧栏删除入口，先收敛为新增 store 方法并保留旧行为，再评估是否需要补充规格。
- 如果历史页需要新增独立删除按钮、筛选器、分页 UI 或新的空态文案，停止并回到 `workflow-spec`，因为本次只修数据同步。
- 如果删除同步信号需要跨进程广播或持久化，停止并回到 `workflow-spec`；当前规格只要求同一 renderer 会话内的侧边栏删除同步。
- 如果路由切换时出现并发请求导致旧响应覆盖新列表，优先用请求快照或递增 token 解决；若需要改后端响应契约，再回到 `workflow-spec`。

## Task Mapping

- OpenSpec 1.1：Slice 1 step 1、3、4
- OpenSpec 1.2：Slice 1 step 2、3
- OpenSpec 1.3：Slice 1 step 2、3、验证点
- OpenSpec 2.1：Slice 2
- OpenSpec 2.2：Slice 1 step 5、Slice 2 验证点
- OpenSpec 2.3：Slice 3
- OpenSpec 3.1：Slice 4 手动验证 1
- OpenSpec 3.2：Slice 4 手动验证 2、3
- OpenSpec 3.3：Slice 4 手动验证 6
- OpenSpec 3.4：Slice 3、Slice 4 手动验证 4
- OpenSpec 3.5：Slice 4 命令验证
- OpenSpec 4.1：Slice 5
- OpenSpec 4.2：Slice 6 step 1-5
- OpenSpec 4.3：Slice 6 step 6、Slice 7 手动验证 4
- OpenSpec 4.4：Slice 7 手动验证 1、2

## Handoff To workflow-implement

执行时严格按以上切片推进。优先保持代码改动集中在：

- `app/work/src/renderer/src/stores/session.ts`
- `app/work/src/renderer/src/layout/sidebar/NavMain.vue`
- `app/work/src/renderer/src/layout/dialog/delete-session/DeleteSession.vue`
- `app/work/src/renderer/src/pages/workspace-history/WorkspaceHistory.vue`

完成实现后更新 OpenSpec `tasks.md` 勾选状态，并记录实际运行的命令验证与手动验证结果。
