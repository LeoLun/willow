import { readFile } from "fs/promises";
import { read, utils } from "xlsx";
import type { BillRecord } from "../../shared";


export class WeChatBillService {
  /**
   * 解析 XLSX 文件
   * @param filePath 文件路径
   */
  public async parseBill(filePath: string): Promise<BillRecord[]> {
    // 1. 读取文件
    const buf = await readFile(filePath);
    const workbook = read(buf);

    // 2. 获取第一个工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 3. 将工作表转换为二维数组，以便查找表头位置
    // header: 1 表示按行输出原始数组，不尝试解析 Key
    const rawData = utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    console.log("rawData", rawData);
    // 4. 动态查找表头行
    // 微信账单通常在第 17 行左右，特征是包含 "交易时间"
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      // 检查这一行是否包含关键字段
      if (row && row.includes("交易时间") && row.includes("金额(元)")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error(
        '未能在 Excel 中找到有效的账单表头（需包含"交易时间"列）'
      );
    }

    console.log(`定位到表头在第 ${headerRowIndex + 1} 行，开始解析数据...`);

    // 5. 使用 sheet_to_json 从表头行开始解析
    // range: headerRowIndex 告诉库从这一行开始作为 Header
    const jsonData = utils.sheet_to_json<any>(worksheet, {
      range: headerRowIndex,
    });

    // 6. 数据清洗与映射
    const results: BillRecord[] = jsonData
      .map((row) => this.transformRow(row))
      .filter((item) => item.transactionTime); // 过滤掉可能的空行或统计行

    return results;
  }

  /**
   * 数据清洗：中文 Key -> 英文 Key，数值格式化
   */
  private transformRow(row: any): BillRecord {
    // 提取金额：Excel 解析出来的可能是字符串 "¥5.00" 也可能是数字
    let amount = 0;
    const rawAmount = row["金额(元)"];

    if (typeof rawAmount === "number") {
      amount = rawAmount;
    } else if (typeof rawAmount === "string") {
      amount = parseFloat(rawAmount.replace("¥", "").trim());
    }

    return {
      id: `wx-${row["交易单号"]}`,
      transactionTime: this.toISOWithTZ(row["交易时间"]),
      category: '', // 留空；AI 会根据备注自动分类
      counterparty: row["交易对方"],
      item: row["商品"],
      direction: row["收/支"],
      amount: amount,
      paymentMethod: row["支付方式"],
      status: row["当前状态"],
      transactionId: row["交易单号"],
      merchantId: row["商户单号"],
      channel: '微信支付',
      remark: row["备注"] || "",
    };
  }

  private toISOWithTZ(input: string, tzOffset = "+08:00") {
    const date = new Date(input.replace(" ", "T"));
    // 格式化成 yyyy-MM-ddTHH:mm:ss
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    const ss = pad(date.getSeconds());

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${tzOffset}`;
  }
}
