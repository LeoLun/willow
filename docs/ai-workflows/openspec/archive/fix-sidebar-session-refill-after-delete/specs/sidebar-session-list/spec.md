# sidebar-session-list Specification

## ADDED Requirements

### Requirement: Delete refreshes the sidebar session window

左侧栏工作空间会话列表在删除会话成功后，必须刷新被删除会话所属工作空间的侧边栏会话窗口，使其展示该工作空间最新的最多 5 条会话。

#### Scenario: More sessions remain after deleting a visible session

- **GIVEN** 某工作空间共有 6 条或更多会话
- **AND** 左侧栏当前展示该工作空间最新 5 条会话
- **WHEN** 用户删除其中一条已展示会话
- **THEN** 删除成功后左侧栏应重新展示该工作空间最新 5 条会话
- **AND** 原本排在第 6 位的会话应在仍符合排序规则时补入可见列表

#### Scenario: Fewer than five sessions remain after deletion

- **GIVEN** 某工作空间共有 5 条或更少会话
- **WHEN** 用户删除其中一条会话
- **THEN** 左侧栏应展示删除后的真实剩余会话
- **AND** 不应显示空白占位项来凑满 5 条

### Requirement: More indicator uses the refreshed total

“查看更多...”入口必须基于删除成功后刷新得到的工作空间会话总数判断。

#### Scenario: More indicator remains visible

- **GIVEN** 某工作空间删除一条会话后总数仍大于 5
- **WHEN** 左侧栏完成删除后的刷新
- **THEN** “查看更多...”入口应继续显示

#### Scenario: More indicator becomes hidden

- **GIVEN** 某工作空间删除一条会话后总数小于或等于 5
- **WHEN** 左侧栏完成删除后的刷新
- **THEN** “查看更多...”入口应隐藏

### Requirement: Deletion failure keeps the existing list intact

删除请求失败时，左侧栏不得提前移除对应会话或刷新成错误状态。

#### Scenario: Delete request fails

- **GIVEN** 用户在左侧栏打开某个会话的删除确认
- **WHEN** 删除请求失败
- **THEN** 该会话应继续保留在当前侧边栏列表中
- **AND** `sessionTotals` 不应因为失败请求被扣减或覆盖成错误值

### Requirement: Current route remains controlled when deleting the active session

当用户删除当前路由对应的会话时，应用必须避免继续指向不可用的已删除会话状态。

#### Scenario: Active session is deleted

- **GIVEN** 当前 URL 指向会话 A
- **AND** 用户在左侧栏删除会话 A
- **WHEN** 删除成功且侧边栏刷新完成
- **THEN** 左侧栏不应继续高亮会话 A
- **AND** 主内容区不应出现运行时异常或不可恢复空白状态

### Requirement: History page reloads when workspace route changes

历史会话页必须在 `workspaceId` 路由参数变化时重置自身分页状态，并加载目标工作空间的历史会话。

#### Scenario: User opens another workspace history page from the sidebar

- **GIVEN** 用户当前位于工作空间 A 的历史会话页
- **AND** 页面已经加载了工作空间 A 的历史会话
- **WHEN** 用户在侧边栏点击工作空间 B 的“查看更多...”
- **THEN** 历史页标题应显示工作空间 B
- **AND** 历史会话列表应清空工作空间 A 的数据并加载工作空间 B 的第一页历史会话
- **AND** 分页状态应从第一页重新开始

#### Scenario: Target workspace has no sessions

- **GIVEN** 用户当前位于工作空间 A 的历史会话页
- **WHEN** 用户切换到没有会话的工作空间 B 的历史会话页
- **THEN** 页面应展示“暂无会话记录”
- **AND** 不应继续显示工作空间 A 的历史会话

### Requirement: History page synchronizes with sidebar deletion

当侧边栏删除会话成功后，若当前打开的是同一工作空间的历史会话页，历史页必须不再显示已删除会话。

#### Scenario: Delete a session while viewing the same workspace history

- **GIVEN** 用户当前位于工作空间 A 的历史会话页
- **AND** 会话 X 显示在该历史页列表中
- **WHEN** 用户从侧边栏删除工作空间 A 的会话 X
- **THEN** 删除成功后历史页不应继续显示会话 X
- **AND** 历史页总数、分页状态和“已加载全部”状态应与删除后的服务端数据一致

#### Scenario: Delete a session from another workspace

- **GIVEN** 用户当前位于工作空间 A 的历史会话页
- **WHEN** 用户从侧边栏删除工作空间 B 的会话
- **THEN** 工作空间 A 的历史页列表不应被无关刷新或替换
