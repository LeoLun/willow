import { readFile } from 'fs/promises';
import iconv from 'iconv-lite';
import { parse } from "csv-parse";
import type { BillRecord } from "../../shared";

export class AlipayBillService {
  public async parseBill(filePath: string): Promise<BillRecord[]> {
    // 1. 读取文件 Buffer
    const buffer = await readFile(filePath);

    // 2. 解码：支付宝 CSV 通常是 GBK 编码
    // 如果解码出来还是乱码，可以尝试 'utf-8'，但国内下载通常是 GBK
    const content = iconv.decode(buffer, 'gbk');

    // 3. 预处理：找到表头行
    // 支付宝 CSV 前面有很多行注释，表头通常以 "交易时间" 开头
    const lines = content.split('\n');
    let headerLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      // 移除可能存在的空格进行匹配
      if (lines[i].trim().startsWith('交易时间')) {
        headerLineIndex = i;
        break;
      }
    }

    if (headerLineIndex === -1) {
      throw new Error('未找到支付宝账单表头');
    }

    // 4. 截取有效 CSV 内容（从表头开始到结束）
    // 另外，支付宝底部可能也有统计信息，这里我们只取正文
    // 我们可以把前面的行去掉，重新组合成字符串给 csv-parse 处理
    const csvContent = lines.slice(headerLineIndex).join('\n');

    // 5. 解析 CSV
    const records = parse(csvContent, {
      columns: true,       // 使用第一行作为 Key
      skip_empty_lines: true,
      trim: true,          // 自动去除字段前后的空格
      relax_column_count: true // 允许列数不一致（防止底部统计行报错）
    });

    // 6. 数据映射
    const billRecords: BillRecord[] = [];
    for await (const record of records) {
      const item = this.transformRow(record);
      if (item) billRecords.push(item);
    }
    return billRecords;
  }

  private transformRow(row: any): BillRecord {
    if (!row['交易时间']) return null;

    return {
      id: `zfb-${row['交易订单号']}`,
      transactionTime: this.toISOWithTZ(row['交易时间']),
      category: '', 
      channel: '支付宝',
      counterparty: row['交易对方'] || '',
      item: row['商品说明'] || '',
      direction: row['收/支'] === '不计收支' ? '不计入收支' : row['收/支'],
      amount: parseFloat(row['金额'] || '0'),
      paymentMethod: row['收/付款方式'] || '',
      status: row['交易状态'] || '',
      transactionId: row['交易订单号'] || '',
      merchantId: row['商家订单号'] || '',
      remark: row['备注'] || '',
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