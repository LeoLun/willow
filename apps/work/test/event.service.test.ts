import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { EventService } from "../src/main/service/event.service";
import { EVENT_BUS } from "../src/shared/constants";

class WebContentsMock extends EventEmitter {
  destroyed = false;
  send = vi.fn();

  isDestroyed(): boolean {
    return this.destroyed;
  }

  destroy(): void {
    this.destroyed = true;
    this.emit("destroyed");
  }
}

describe("EventService", () => {
  it("unsubscribes and releases destroyed WebContents", () => {
    const service = new EventService();
    const first = new WebContentsMock();
    const second = new WebContentsMock();
    service.registerEvent(first as unknown as Electron.WebContents);
    service.registerEvent(second as unknown as Electron.WebContents);

    service.sendEvent("event", { value: 1 });
    expect(first.send).toHaveBeenCalledWith(EVENT_BUS, {
      event: "event",
      data: { value: 1 },
    });
    first.destroy();
    service.sendEvent("later", { value: 2 });
    expect(first.send).toHaveBeenCalledOnce();
    expect(second.send).toHaveBeenCalledTimes(2);
    expect((service as any).registeredWebContents.size).toBe(1);

    second.destroy();
    expect((service as any).registeredWebContents.size).toBe(0);
    expect((service as any).eventBus$.observers).toHaveLength(0);
  });
});
