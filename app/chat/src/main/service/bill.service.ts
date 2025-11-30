import { Injectable } from "poetry";
import { dialog } from "electron";
import { extname, basename } from 'path'
import { NotionService } from "./notion.service";
import { WeChatBillService } from "./wechat-bill.service";
import { PARSE_BILL_RESULT, UPADTA_BILL } from "../../shared";
import type { BillRecord } from "../../shared";
import { TaskQueue } from "../utils/task-queue";
import { categoryBill } from "../agent/bill.agent";
import { AlipayBillService } from "./alipay-bill.service";



@Injectable()
export class BillService {
  private notionService: NotionService;
  private wechatBillService: WeChatBillService;
  private alipayBillService: AlipayBillService;
  private taskQueue = new TaskQueue(2);

  constructor(
    notionService: NotionService,
    wechatBillService: WeChatBillService,
    alipayBillService: AlipayBillService,
  ) {
    this.notionService = notionService;
    this.wechatBillService = wechatBillService;
    this.alipayBillService = alipayBillService;
  }

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

    // 发送消息, 开始解析文件
    
    let billList: BillRecord[] = [];
    // 读取文件信息
    try {
      const ext = extname(filePath).toLowerCase();
      const fileName = basename(filePath);
      if (ext === '.xlsx' || fileName.includes('微信')) {
        // 处理微信账单
        console.log('识别为: 微信账单 (XLSX)');
        billList = await this.wechatBillService.parseBill(filePath);
      } else if (ext === '.csv' || fileName.includes('支付宝')) {
        // 处理支付宝账单
        console.log('识别为: 支付宝账单 (CSV/GBK)');
        billList = await this.alipayBillService.parseBill(filePath);
      } else {
        throw new Error('不支持的文件格式');
      }
    } catch (error) {
      console.error('解析失败:', error);
      return { result: "error" };
    }

    event.sender.send(PARSE_BILL_RESULT, billList);
    // 发送消息, 解析完成
    const promiseList = []

    // 调用 AI 填充分类和备注
    for (const bill of billList) {
      bill.category = 'wait'
      event.sender.send(UPADTA_BILL, bill);
      promiseList.push(this.taskQueue.add<BillRecord>(async () => {
        bill.category = 'start'
        event.sender.send(UPADTA_BILL, bill);
        bill.category = await this.aiFill(bill);
        event.sender.send(UPADTA_BILL, bill);
        return bill;
      }));
    }
    // 等待全部执行完毕
    await Promise.all(promiseList);

    // 调用 notion 导入文件
    // database id: 2accff4da9b580da98b4d761b078f80f
    // data_source_id: 2accff4d-a9b5-8027-ac9e-000bde36b6cb
    // 读取数据库
    for(let i = 0; i < billList.length; i++) {
      const bill = billList[i];
      console.log(`正在导入中 ${i+1}/${billList.length}`)

      // 检查是否已经存在
      const { results } = await this.notionService.queryPage({
        data_source_id: '2accff4d-a9b5-8027-ac9e-000bde36b6cb',
        filter: {
          property: '序号',
          title: {
            equals: bill.id,
          },
        }
      })
      if(results.length === 0) {
        await this.notionService.createPage({
          parent: { database_id: '2accff4da9b580da98b4d761b078f80f' },
          properties: this.transformWxBillToNotion(bill) as any,
        });
      } else {
        console.log(`已存在 ${bill.id}`)
      }
    }
    console.log("导入完成");
    return { result: "success" };
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
