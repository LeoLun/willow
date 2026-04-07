## ADDED Requirements

### Requirement: Tool definitions SHALL be created through a shared factory
系统必须为核心工具提供统一的 `createTool` 工厂，使所有工具定义都通过一致的契约声明，至少包含标准名称、面向用户的标签、描述、参数 schema、执行处理器以及可选的权限元数据。

#### Scenario: Registering a standard tool
- **WHEN** 开发者在 `packages/core/src/tools/` 下新增或修改一个工具
- **THEN** 该工具定义必须通过共享工厂创建，而不是直接返回临时拼装的对象字面量

### Requirement: The shared tool contract SHALL preserve runtime compatibility
系统必须保证通过共享工厂创建的工具实例与现有 agent runtime 保持兼容，仍然可以直接传给 `agent.setTools(...)`，且不改变模型运行时预期的工具调用外部结构。

#### Scenario: Creating the tool list
- **WHEN** core agent 组装可用工具列表
- **THEN** 通过共享工厂创建的工具能够被直接收集并传入 runtime，而不需要在调用处额外做适配

### Requirement: Tool definitions SHALL expose UI-safe metadata
系统必须暴露由共享工厂统一产出的、适合 UI 使用的工具元数据，使应用可以直接渲染工具名称、描述和权限状态，而不需要从分散的实现细节中反推行为。

#### Scenario: Rendering a tool call in the interface
- **WHEN** 前端收到一次工具调用或待审批事件
- **THEN** 它能够从共享工具定义契约中解析出工具展示名称和权限相关元数据

### Requirement: Tool definitions SHALL support tool-specific risk decisions
系统必须允许工具在共享契约之上声明或计算自身的风险决策方式，使低风险工具可以直接放行，而需要细粒度控制的工具可以基于自身参数决定是否触发审批。

#### Scenario: Declaring a low-risk tool
- **WHEN** 开发者定义 `ls`、`read`、`webfetch` 或 `websearch` 这类低风险工具
- **THEN** 该工具可以通过共享契约声明为默认直通执行，而不进入统一待审批流程

#### Scenario: Declaring a parameter-sensitive tool
- **WHEN** 开发者定义 `bash` 这类风险取决于参数内容的工具
- **THEN** 该工具可以通过共享契约接入基于命令内容的风险判断逻辑，而不是只能声明固定的全局审批策略
