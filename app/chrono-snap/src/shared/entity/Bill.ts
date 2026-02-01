// 定义输出的数据结构
export type BillRecord = {
  id: string; // 序号
  transactionTime: string; // 交易时间 2025-10-31T12:39:44+08:00
  category: string; // 交易类型
  counterparty: string;
  item: string;
  direction: "支出" | "收入" | "不计入收支";
  amount: number;
  paymentMethod: string;
  status: string;
  transactionId: string;
  merchantId: string;
  remark: string;
  channel: string;
}