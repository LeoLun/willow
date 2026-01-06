# ai-tool

## 环境变量（.env）

本项目主进程入口 `src/main/main.ts` 会通过 `dotenv` 自动加载 `app/ai-tool/.env`。

### Notion（上传账单用）

在 `app/ai-tool/.env` 中添加：

```
NOTION_TOKEN=你的_notion_integration_token
NOTION_DATABASE_ID=你的_database_id
NOTION_DATA_SOURCE_ID=你的_data_source_id
```

说明：
- `NOTION_TOKEN`：Notion 集成 Token（敏感信息，**不要提交到 GitHub**）
- `NOTION_DATABASE_ID`：用于 `pages.create` 的 database id
- `NOTION_DATA_SOURCE_ID`：用于 `dataSources.query` 的 data source id


