import { createAgent } from "langchain";
import { ChatServiceFactory } from "../service/chat-service/chat-service.factory";
import { ChatServiceType } from "../interfaces/chat-service.interface";
import { prompt } from '../prompt/input-bill.prompt'
import { BillRecord } from "../../shared";

export async function categoryBill(bill: BillRecord) {
  const chatServiceImpl = ChatServiceFactory.createChatService(ChatServiceType.DEEPSEEK);
  const model = chatServiceImpl.createChatAI();

  const agent = createAgent({
    name: "categoryBillAgent",
    model,
    description: "根据账单内容，输出交易类型",
  });

  // 剔除一些无效数据，减少 token 量
  const formatBill = {
    id: bill.id,
    transactionTime: bill.transactionTime,
    counterparty: bill.counterparty,
    item: bill.item,
    direction: bill.direction,
    amount: bill.amount,
    paymentMethod: bill.paymentMethod,
    status: bill.status,
    remark: bill.remark,
    channel: bill.channel,
  }

  const formattedMessages = await prompt.format({
    targetBill: formatBill,
  });
  console.log('formattedMessages', formattedMessages)
  const result = await agent.invoke({
    messages: formattedMessages,
  });
  console.log('result', result)
  return result.messages[result.messages.length - 1].content
}
