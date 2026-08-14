import type { ReadPlanFileRequest, ReadPlanFileResponse } from "../api";

export interface IPlanApi {
  readPlanFile(request: ReadPlanFileRequest): Promise<ReadPlanFileResponse>;
}
