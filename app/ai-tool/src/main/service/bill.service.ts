import { Injectable } from "poetry";
import { dialog } from "electron";
import { extname, basename } from 'path'
import { NotionService } from "./notion.service";
import { WeChatBillService } from "./wechat-bill.service";
import { AI_CLASSIFY_DONE, PARSE_BILL_RESULT, UPADTA_BILL, UPLOAD_BILL_PROGRESS } from "../../shared";
import type { BillRecord, IAiClassifyBillResponce, IParseBillFileResponce, IUploadBillToNotionResponce } from "../../shared";
import { TaskQueue } from "../utils/task-queue";
import { categoryBill } from "../agent/bill.agent";
import { AlipayBillService } from "./alipay-bill.service";
import { getNotionDataSourceId, getNotionDatabaseId } from "../config/notion.config";



@Injectable()
export class BillService {
  private notionService: NotionService;
  private wechatBillService: WeChatBillService;
  private alipayBillService: AlipayBillService;
  private taskQueue = new TaskQueue(2);
  private billJobs = new Map<string, { filePath: string; billList: BillRecord[]; total: number; createdAt: number; classified: boolean }>();

  constructor(
    notionService: NotionService,
    wechatBillService: WeChatBillService,
    alipayBillService: AlipayBillService,
  ) {
    this.notionService = notionService;
    this.wechatBillService = wechatBillService;
    this.alipayBillService = alipayBillService;
  }

  private async parseBillRecordsFromFile(filePath: string): Promise<BillRecord[]> {
    const ext = extname(filePath).toLowerCase();
    const fileName = basename(filePath);
    if (ext === '.xlsx' || fileName.includes('微信')) {
      console.log('识别为: 微信账单 (XLSX)');
      return await this.wechatBillService.parseBill(filePath);
    }
    if (ext === '.csv' || fileName.includes('支付宝')) {
      console.log('识别为: 支付宝账单 (CSV/GBK)');
      return await this.alipayBillService.parseBill(filePath);
    }
    throw new Error('不支持的文件格式');
  }

  async parseBillList(event: Electron.IpcMainInvokeEvent, filePath: string): Promise<IParseBillFileResponce> {
    if (!filePath) return { result: 'error', error: '缺少文件路径' };

    let billList: BillRecord[] = [];
    try {
      billList = await this.parseBillRecordsFromFile(filePath);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('解析失败:', error);
      return { result: 'error', error };
    }

    // 初始化状态（用于前端展示：未开始 AI 时显示 wait）
    for (const bill of billList) {
      bill.category = bill.category || 'wait';
    }

    event.sender.send(PARSE_BILL_RESULT, billList);

    const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.billJobs.set(jobId, { filePath, billList, total: billList.length, createdAt: Date.now(), classified: false });
    return { result: 'success', jobId, total: billList.length };
  }

  async aiClassifyBill(event: Electron.IpcMainInvokeEvent, jobId: string): Promise<IAiClassifyBillResponce> {
    if (!jobId) return { result: 'error', error: '缺少 jobId' };
    const job = this.billJobs.get(jobId);
    if (!job) return { result: 'error', error: '找不到解析结果，请先选择文件并解析' };

    const billList = job.billList;

    // AI 分类（并发受 TaskQueue 控制）
    const promiseList: Array<Promise<BillRecord>> = [];
    for (const bill of billList) {
      event.sender.send(UPADTA_BILL, bill);
      promiseList.push(this.taskQueue.add<BillRecord>(async () => {
        bill.category = 'start';
        event.sender.send(UPADTA_BILL, bill);
        bill.category = await this.aiFill(bill);
        event.sender.send(UPADTA_BILL, bill);
        return bill;
      }));
    }
    await Promise.all(promiseList);

    job.classified = true;
    event.sender.send(AI_CLASSIFY_DONE, { jobId, total: billList.length });
    return { result: 'success', jobId, total: billList.length };
  }

  async uploadBillToNotion(event: Electron.IpcMainInvokeEvent, jobId: string): Promise<IUploadBillToNotionResponce> {
    if (!jobId) return { result: 'error', error: '缺少 jobId' };
    const job = this.billJobs.get(jobId);
    if (!job) return { result: 'error', error: '找不到待上传的分类结果，请先完成 AI 分类' };
    if (!job.classified) return { result: 'error', error: '尚未完成 AI 分类，请先完成 AI 分类再上传' };

    let uploaded = 0;
    let skipped = 0;

    try {
      const notionDataSourceId = getNotionDataSourceId();
      const notionDatabaseId = getNotionDatabaseId();

      const billList = job.billList;
      for (let i = 0; i < billList.length; i++) {
        const bill = billList[i];
        console.log(`正在导入中 ${i + 1}/${billList.length}`);

        // 逐条开始：用于前端定位到“当前上传中”的账单
        event.sender.send(UPLOAD_BILL_PROGRESS, {
          jobId,
          billId: bill.id,
          stage: 'start',
          current: i + 1,
          total: billList.length,
          uploaded,
          skipped,
        });

        const { results } = await this.notionService.queryPage({
          data_source_id: notionDataSourceId,
          filter: {
            property: '序号',
            title: {
              equals: bill.id,
            },
          }
        });

        let action: 'uploaded' | 'skipped' = 'skipped';
        if ((results ?? []).length === 0) {
          await this.notionService.createPage({
            parent: { database_id: notionDatabaseId },
            properties: this.transformWxBillToNotion(bill) as any,
          });
          uploaded++;
          action = 'uploaded';
        } else {
          console.log(`已存在 ${bill.id}`);
          skipped++;
          action = 'skipped';
        }

        event.sender.send(UPLOAD_BILL_PROGRESS, {
          jobId,
          billId: bill.id,
          stage: 'done',
          action,
          current: i + 1,
          total: billList.length,
          uploaded,
          skipped,
        });
      }

      console.log("导入完成");
      // 上传完就清理，避免内存一直涨
      this.billJobs.delete(jobId);
      return { result: 'success', uploaded, skipped };
    } catch (e: any) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('上传失败:', error);
      return { result: 'error', error };
    }
  }

  // 导入账单到 Notion
  async importToNotion(event: Electron.IpcMainInvokeEvent, filePath?: string) {
    // 如果没有文件路径，打开文件选择器，选择文件
    if (!filePath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "xlsx Files", extensions: ["xlsx", "csv"] }],
      });
      if (canceled) {
        return { result: "canceled" };
      }
      filePath = filePaths[0];
    }
    const classifyRsp = await this.aiClassifyBill(event, filePath);
    if (classifyRsp.result !== 'success' || !classifyRsp.jobId) {
      return { result: "error" };
    }
    const uploadRsp = await this.uploadBillToNotion(event, classifyRsp.jobId);
    return { result: uploadRsp.result };
  }

  private async aiFill(bill: BillRecord): Promise<string> {
    const res = await categoryBill(bill) as string;
    try {
      bill.category = JSON.parse(res).category
    } catch (error) {
      bill.category = 'error'
    }
    return bill.category
  }

  private transformWxBillToNotion(bill: BillRecord) {
    return {
      "交易时间": {
        date: { start: bill.transactionTime },
      },

      "当前状态": {
        rich_text: [
          {
            type: "text",
            text: { content: bill.status },
          },
        ],
      },

      "支付方式": {
        rich_text: [
          {
            type: "text",
            text: { content: bill.paymentMethod },
          },
        ],
      },

      "交易渠道": {
        select: {
          name: bill.channel,
        },
      },

      "商品": {
        rich_text: [
          {
            type: "text",
            text: { content: bill.item },
          },
        ],
      },

      "金额(元)": {
        number: bill.amount,
      },

      "收入/支出": {
        select: {
          name: bill.direction,
        },
      },

      "交易对方": {
        rich_text: [
          {
            type: "text",
            text: { content: bill.counterparty },
          },
        ],
      },

      "备注": {
        rich_text: [
          {
            type: "text",
            text: { content: bill.remark },
          },
        ],
      },

      "序号": {
        title: [
          {
            type: "text",
            text: { content: bill.id },
          },
        ],
      },

      "交易类型": {
        "select": {
          "name": bill.category,
        }
      },
    };
  }
}
