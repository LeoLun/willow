import { TavilyDao } from "@main/service/dao/tavily.dao.service";
import { Injectable } from "@willow/poetry";

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

@Injectable()
export class TavilyService {
  constructor(private readonly tavilyDao: TavilyDao) {}

  getAll() {
    const currentMonth = getCurrentMonth();
    const keys = this.tavilyDao.findAll();

    for (const key of keys) {
      if (key.usageResetMonth !== currentMonth) {
        this.tavilyDao.update(key.id, {
          currentMonthUsage: 0,
          usageResetMonth: currentMonth,
        });
      }
    }

    return this.tavilyDao.findAll();
  }

  add(apiKey: string, monthlyLimit: number = 1000) {
    return this.tavilyDao.insert({
      apiKey,
      monthlyLimit,
      currentMonthUsage: 0,
      usageResetMonth: getCurrentMonth(),
    });
  }

  update(id: number, data: { apiKey?: string; monthlyLimit?: number }) {
    return this.tavilyDao.update(id, data);
  }

  delete(id: number) {
    return this.tavilyDao.deleteById(id);
  }

  /**
   * 均衡负载：选择当月用量最低且未超限的 key，
   * 选中后自动递增用量计数。
   */
  getApiKey(): string {
    const currentMonth = getCurrentMonth();
    const keys = this.tavilyDao.findAll();

    if (keys.length === 0) {
      return "";
    }

    let bestKey: (typeof keys)[0] | null = null;

    for (const key of keys) {
      if (key.usageResetMonth !== currentMonth) {
        this.tavilyDao.update(key.id, {
          currentMonthUsage: 0,
          usageResetMonth: currentMonth,
        });
        key.currentMonthUsage = 0;
        key.usageResetMonth = currentMonth;
      }

      if (key.currentMonthUsage >= key.monthlyLimit) {
        continue;
      }

      if (!bestKey || key.currentMonthUsage < bestKey.currentMonthUsage) {
        bestKey = key;
      }
    }

    if (!bestKey) {
      return "";
    }

    this.tavilyDao.update(bestKey.id, {
      currentMonthUsage: bestKey.currentMonthUsage + 1,
    });

    return bestKey.apiKey;
  }
}
