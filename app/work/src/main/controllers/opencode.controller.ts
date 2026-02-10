import { Injectable, IPC } from "poetry";
import { OpencodeService } from "@main/service/opencode.service";
import type { IStartOpencode, IStartOpencodeResponce } from "@shared/index";
import { START_OPENCODE } from "@shared/index";

@Injectable()
export class OpencodeController implements IStartOpencode {
  constructor(private readonly opencodeService: OpencodeService) {}

  @IPC(START_OPENCODE)
  async startOpencode(): Promise<IStartOpencodeResponce> {
    console.log("startOpencode");
    const result = await this.opencodeService.start();
    console.log("result", result);
    return { url: result.url };
  }

  async stopOpencode() {
    console.log("stopOpencode");
    const result = await this.opencodeService.stop();
    console.log("result", result);
  }
}
