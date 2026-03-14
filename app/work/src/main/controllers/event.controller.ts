import { Injectable, IPC } from "@willow/poetry";
import { EventService } from "@main/service/event.service";

@Injectable()
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @IPC("REGISTER_EVENT")
  registerEvent(_event: Electron.IpcMainInvokeEvent): string {
    return this.eventService.registerEvent(_event.sender);
  }
}
