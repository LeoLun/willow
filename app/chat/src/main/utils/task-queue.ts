export class TaskQueue {
  private concurrency: number;
  private running = 0;
  private queue: (() => Promise<any>)[] = [];

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  // 添加任务（任务必须是返回 Promise 的函数）
  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = async () => {
        this.running++;
        try {
          // 发送执行消息
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.running--;
          this.next();
        }
      };

      this.queue.push(run);
      this.next();
    });
  }

  private next() {
    if (this.running >= this.concurrency) return;
    const task = this.queue.shift();
    task?.();
  }
}
