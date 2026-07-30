import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetStatisticsController } from "../src/main/controllers/statistics/get.statistics.controller";
import type { StatisticsService } from "../src/main/service/statistics.service";
import type { GetStatisticsResponse } from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const getStatistics = vi.fn<StatisticsService["getStatistics"]>();
const service = { getStatistics } as unknown as StatisticsService;
const controller = new GetStatisticsController(service);

function response(granularity: "daily" | "weekly" | "all"): GetStatisticsResponse {
  return {
    granularity,
    summary: { totalTokens: 0, cacheReadTokens: 0, totalTasks: 0, totalCost: 0 },
    activityBuckets: [],
    modelUsage: [],
  };
}

describe("GetStatisticsController", () => {
  beforeEach(() => {
    getStatistics.mockReset();
  });

  it.each(["daily", "weekly", "all"] as const)("returns %s statistics", async (granularity) => {
    const data = response(granularity);
    getStatistics.mockReturnValueOnce(data);

    await expect(controller.run(event, { granularity })).resolves.toEqual({
      code: 0,
      data,
      msg: "ok",
    });
    expect(getStatistics).toHaveBeenCalledWith(granularity);
  });

  it.each([undefined, {}, { granularity: "monthly" }])(
    "rejects invalid input without calling the service",
    async (request) => {
      await expect(controller.run(event, request as never)).resolves.toEqual({
        code: 400,
        msg: "granularity must be daily, weekly, or all",
      });
      expect(getStatistics).not.toHaveBeenCalled();
    },
  );

  it("propagates service failures", async () => {
    const error = new Error("database unavailable");
    getStatistics.mockImplementationOnce(() => {
      throw error;
    });
    await expect(controller.run(event, { granularity: "daily" })).rejects.toBe(error);
  });
});
