import { StatisticsService } from "@main/service/statistics.service";
import type {
  ApiResponse,
  GetStatisticsRequest,
  GetStatisticsResponse,
  StatisticsGranularity,
} from "@shared/api";
import { GET_STATISTICS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

const GRANULARITIES = new Set<StatisticsGranularity>(["daily", "weekly", "all"]);

@Injectable()
export class GetStatisticsController extends IPCBaseController<
  GetStatisticsRequest,
  GetStatisticsResponse
> {
  constructor(private readonly statisticsService: StatisticsService) {
    super();
  }

  @IPC(GET_STATISTICS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetStatisticsRequest,
  ): Promise<ApiResponse<GetStatisticsResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }
    return this.buildResponse(this.statisticsService.getStatistics(request.granularity));
  }

  checkParams(request: GetStatisticsRequest): Error | undefined {
    if (!request || !GRANULARITIES.has(request.granularity)) {
      return new Error("granularity must be daily, weekly, or all");
    }
    return undefined;
  }
}
