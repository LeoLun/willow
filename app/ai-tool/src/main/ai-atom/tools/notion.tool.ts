import * as z from "zod";
import { Client } from "@notionhq/client";
import { DynamicStructuredTool } from "langchain";
import type { QueryDataSourceParameters } from "@notionhq/client";

export function registerNotionTools(state: { notionToken: string }) {
  const notion = new Client({ auth: state.notionToken });

  // 查询 Notion 数据库中的数据
  const queryNotionDatabaseTool = new DynamicStructuredTool({
    name: "query_notion_database",
    description: "查询 Notion 数据库中的数据。",
    schema: z.object({
      databaseId: z.string().describe("要查询的 Notion 数据库ID"),
      filter: z.object({
        property: z.string().describe("要查询的 Notion 属性"),
        title: z.object({
          equals: z.string().describe("要查询的 Notion 属性值"),
        }),
      }).describe("要查询的 Notion 过滤条件"),
    }),
    func: async ({ databaseId, filter }: { databaseId: string, filter: QueryDataSourceParameters }) => {
      const results: unknown[] = [];
      let start_cursor: string | undefined = undefined;
      let hasMore = true;
      while (hasMore) {
        const rsp = await notion.dataSources.query({
          data_source_id: databaseId,
          page_size: 100,
          start_cursor,
          filter
        } as unknown as QueryDataSourceParameters);
  
        results.push(...(rsp.results ?? []));
        if (!rsp.has_more) break;
        start_cursor = rsp.next_cursor ?? undefined;
        hasMore = !!start_cursor;
      }
      return results;
    },
  });

  return [queryNotionDatabaseTool];
}
