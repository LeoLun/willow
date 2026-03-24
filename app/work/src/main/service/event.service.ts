import { Injectable } from "@willow/poetry";
import { Subject, fromEvent } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { EVENT_BUS } from "@shared/constants";
@Injectable()
export class EventService {
  // 1. 创建一个 Subject 作为中央总线（多播）
  private eventBus$ = new Subject<{ event: string; data: any }>();

  registerEvent(webContents: Electron.WebContents, event?: string) {
    // @TODO 后续支持针对单个事件监听

    // 2. 将 webContents 的销毁事件转化为 Observable
    const destroyed$ = fromEvent(webContents, "destroyed");

    // 3. 订阅总线，直到 webContents 销毁
    this.eventBus$
      .pipe(takeUntil(destroyed$))
      .subscribe(({ event, data }: { event: string; data: any }) => {
        if (!webContents.isDestroyed()) {
          webContents.send(EVENT_BUS, { event, data });
        }
      });

    return "Successfully subscribed via RxJS!";
  }

  // 发送事件：直接推送给 Subject
  sendEvent(event: string, data: any) {
    this.eventBus$.next({ event, data });
  }
}
