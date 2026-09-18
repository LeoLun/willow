# 技能 & MCP

在侧栏打开「技能 & MCP」，通过左上角切换到 MCP。也可在项目菜单选择「MCP 服务」直接进入对应项目。
页面沿用技能页的双列图标列表，只读展示全局和项目服务、工具数量、连接状态及已登录标志，
不提供添加、编辑、删除、密钥设置操作。每个服务提供 Check 按钮，尝试建立连接并更新连接状态；禁用服务不能检查。通过配置文件管理服务；任务触发的登录引导仍使用弹窗。保存配置不会启动服务；
已配置服务默认信任，连接、登录和调用均不需要独立信任确认。stdio 服务使用当前用户的主机权限运行，Agent 调用仍按会话权限模式审批。
远程服务支持 Streamable HTTP，并在明确不支持该协议时回退到 SSE。

全局配置保存在 `app.getPath("userData")/mcp.json`，项目配置保存在项目根目录 `.mcp.json`，格式如下：

```json
{
  "mcpServers": {
    "local": {
      "command": "npx",
      "args": ["-y", "your-mcp-server"],
      "env": { "API_KEY": "${willow:env.API_KEY}" }
    },
    "remote": {
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

全局服务对所有项目生效，共享连接、工具缓存和登录。项目同名配置完整覆盖全局配置，
包括禁用项；删除项目覆盖后恢复继承。项目页面标注继承服务的「全局」来源，页面不提供配置编辑。
全局 stdio 默认工作目录为全局配置所在目录，项目 stdio 默认工作目录为项目根目录；
相对 `cwd` 基于各自默认目录解析。配置读取和页面打开不连接服务、不发起登录。
「已登录」表示保存了 OAuth 或 Bearer 凭证且当前无需重新登录，与「已连接」状态分别展示。
公开服务连接成功不会显示「已登录」。全局注销、断开和删除影响所有使用该服务的项目。

可设置 `cwd`、`headers`、`disabled`、`requestTimeoutMs`，以及 `oauth.clientId` 和
`oauth.scope`。静态 Token 使用 `headers.Authorization: "Bearer ..."`，也可通过管理 API 设置密钥。
HTTP 服务自动识别认证需求，不需要 `auth` 字段。支持可选的 `type: "http" | "sse"`。
工具发现、描述或调用遇到 OAuth 认证需求时，应用弹出登录引导；点击「去登录」后打开浏览器授权，完成后继续连接。
授权准备失败时弹窗显示失败阶段并提供重试入口。客户端认证方式按授权服务发布的元数据选择。
并发发现请求共用一次登录，停止任务会取消待完成的授权；登录通过任务触发的引导完成。
OAuth 登录使用系统浏览器和临时本机回调，支持动态客户端注册，也可以指定 Client ID。
配置中的 `${ENV_NAME}` 从进程环境解析；不支持执行动态密钥命令。

## 密钥保存位置

凭据加密写入 Electron `userData/willow.db` 的 `mcp_credentials` 表。
macOS 正式版路径为 `~/Library/Application Support/com.willow.work/willow.db`，
开发版为 `~/Library/Application Support/com.willow.work-dev/willow.db`。
本地加密密钥保存在同一目录的 `credential.key`，沿用应用已有加密实现。
凭据按全局/项目作用域、服务和配置指纹隔离；全局凭据不归属任何项目，Renderer 只能读取保存状态，不能读回明文。

管理 API 输入的环境变量和请求头固定值会加密保存，`.mcp.json` 中写入 `${willow:...}` 引用。
已有配置文件中的明文密钥可以使用「转存明文密钥」迁移。注销清除认证 Token；
删除服务或项目会清理对应的凭据和工具缓存；删除项目保留全局服务的连接、凭据和缓存。

## Agent 搜索与调用

Agent 使用三个代理工具：

- `mcpSearch`：搜索已启用的全局与项目有效服务工具目录；首次发现最多并发连接 3 个服务。
- `mcpDescribe`：获取指定工具的完整参数 JSON Schema。
- `mcpCall`：校验参数并按会话权限审批后执行，不自动重放失败调用。

目录发现可以启动 stdio 服务或连接远程服务以读取元数据，不会调用远程工具。
`mcpSearch` 在本地搜索，不查询公网服务市场，也不调用远程搜索工具。
空字符串或 `*` 列出工具。每轮 Agent 的系统提示包含全局与项目有效服务清单，并明确要求用户指定 MCP
或项目服务时通过 `mcpSearch → mcpDescribe → mcpCall` 执行；未经用户授权不改用 Bash CLI。
匹配服务名称、工具名称、描述和参数 Schema；将驼峰、下划线和连字符规范化后进行关键词匹配，
支持中文子串。精确工具名权重最高，其次是名称、描述、服务名和参数；同分结果稳定排序。
默认返回 10 项，可指定 `serverName` 缩小范围。搜索缓存会标明缓存状态，发现失败单独返回警告。

计划模式仅提供搜索和描述，不提供调用。配置变化使旧调用审批失效。
服务的 `readOnlyHint` 不作为免审批依据；资源、Prompt、sampling 和 elicitation 不在本期范围内。
