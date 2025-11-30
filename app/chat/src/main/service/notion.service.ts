import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  QueryDataSourceParameters,
} from "@notionhq/client";
import { Injectable } from "poetry";

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
  private notion: Client;

  // 服务逻辑
  constructor() {
    // 初始化 Notion 客户端
    this.notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });
  }

  async retrieveDatabase(databaseId: string) {
    const response = await this.notion.databases.retrieve({
      database_id: databaseId,
    });
    return response;
  }

  async retrieveDataSources(dataSourceId: string) {
    const response = await this.notion.dataSources.retrieve({
      data_source_id: dataSourceId,
    });
    return response;
  }

  async createPage(args: CreatePageParameters) {
    const response = await this.notion.pages.create(args);
    return response;
  }

  async queryPage(args: QueryDataSourceParameters) {
    const response = await this.notion.dataSources.query(args);
    return response;
  }
}
