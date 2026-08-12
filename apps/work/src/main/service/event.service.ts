import { EVENT_BUS } from "@shared/constants";
import { Injectable } from "@willow/poetry";
import { Subject } from "rxjs";

@Injectable()
export class EventService {
  private registeredWebContents = new Set<Electron.WebContents>();

  // 1. 创建一个 Subject 作为中央总线（多播）
  private eventBus$ = new Subject<{ event: string; data: any }>();

  registerEvent(webContents: Electron.WebContents) {
    // 1. 判断是否已经注册
    if (this.registeredWebContents.has(webContents)) {
      return;
    }
    this.registeredWebContents.add(webContents);

    const subscription = this.eventBus$.subscribe(({ event, data }) => {
      if (!webContents.isDestroyed()) {
        webContents.send(EVENT_BUS, { event, data });
      }
    });
    webContents.once("destroyed", () => {
      subscription.unsubscribe();
      this.registeredWebContents.delete(webContents);
    });

    return "Successfully subscribed via RxJS!";
  }

  // 发送事件：直接推送给 Subject
  sendEvent(event: string, data: any) {
    this.eventBus$.next({ event, data });
  }
}
