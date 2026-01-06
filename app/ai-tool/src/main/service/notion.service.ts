import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  QueryDataSourceParameters,
} from "@notionhq/client";
import { Injectable } from "poetry";
import { getNotionToken } from "../config/notion.config";

/**
 * Notion 属性写入格式
 */
export type NotionPropertyValue =
  | { rich_text: { type: "text"; text: { content: string } }[] }
  | { title: { type: "text"; text: { content: string } }[] }
  | { date: { start: string; end?: string; time_zone?: string } }
  | { number: number }
  | { select: { name: string } }
  | { multi_select: { name: string }[] }
  | { url: string }
  | { email: string }
  | { phone_number: string }
  | { checkbox: boolean }
  | { people: { id: string }[] }
  | { relation: { id: string }[] }
  | { files: { name: string; external: { url: string } }[] }
  | { status: { name: string } }
  | { place: { name: string } };

export type NotionProperties = Record<string, NotionPropertyValue>;

@Injectable()
export class NotionService {
  private notion?: Client;

  private getClient(): Client {
    if (this.notion) return this.notion;
    this.notion = new Client({ auth: getNotionToken() });
    return this.notion;
  }

  // 服务逻辑
  constructor() {
    // 延迟初始化：仅在真正调用 Notion API 时才要求配置 NOTION_TOKEN
  }

  async retrieveDatabase(databaseId: string) {
    const response = await this.getClient().databases.retrieve({
      database_id: databaseId,
    });
    return response;
  }

  async retrieveDataSources(dataSourceId: string) {
    const response = await this.getClient().dataSources.retrieve({
      data_source_id: dataSourceId,
    });
    return response;
  }

  async createPage(args: CreatePageParameters) {
    const response = await this.getClient().pages.create(args);
    return response;
  }

  async queryPage(args: QueryDataSourceParameters) {
    const response = await this.getClient().dataSources.query(args);
    return response;
  }
}
