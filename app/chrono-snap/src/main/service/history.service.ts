// 每隔 x 时间，记录一次截图，并保存到本地
import { Injectable } from "poetry";
import { SystemService } from "./system.service";

@Injectable()
export class HistoryService {

  constructor(private systemService: SystemService) {
    this.systemService.getAllScreens().then(screens => {
      console.log(screens);
    });
  }

}
