// 写一个时间服务，暴露三个方法，每一秒通知一次，每小时通知一次，每天通知一次
interface ITimeService {
  onSecondChange(callback: (time: Date) => void): void;
  onDayChange(callback: (time: Date) => void): void;
  onHourChange(callback: (time: Date) => void): void;
  onQuarterChange(callback: (time: Date) => void): void;
}

class TimeServiceImpl implements ITimeService {
  private secondChangeCallbacks: Array<(time: Date) => void> = [];
  private dayChangeCallbacks: Array<(time: Date) => void> = [];
  private hourChangeCallbacks: Array<(time: Date) => void> = [];
  private quarterChangeCallbacks: Array<(time: Date) => void> = [];
  private lastTime: Date = new Date();

  constructor() {
    setInterval(() => {
      const now = new Date();
      if (now.getSeconds() !== this.lastTime.getSeconds()) {
        this.secondChangeCallbacks.forEach(callback => callback(now));
      }
      if (now.getHours() !== this.lastTime.getHours()) {
        this.hourChangeCallbacks.forEach(callback => callback(now));
      }
      if (now.getDay() !== this.lastTime.getDay()) {
        this.dayChangeCallbacks.forEach(callback => callback(now));
      }
      // 每 15 分钟一次
      if (Math.floor(now.getMinutes() / 15) !== Math.floor(this.lastTime.getMinutes() / 15)) {
        this.quarterChangeCallbacks.forEach(callback => callback(now));
      }
      this.lastTime = now;
    }, 1000);
  }

  onSecondChange(callback: (time: Date) => void): void {
    this.secondChangeCallbacks.push(callback);
  }

  onDayChange(callback: (time: Date) => void): void {
    this.dayChangeCallbacks.push(callback);
  }
  onHourChange(callback: (time: Date) => void): void {
    this.hourChangeCallbacks.push(callback);
  }
  onQuarterChange(callback: (time: Date) => void): void {
    this.quarterChangeCallbacks.push(callback);
  }
}

// 导出一个单例
export const TimeService: ITimeService = new TimeServiceImpl();