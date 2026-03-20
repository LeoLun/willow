import { ApiResponse } from "@shared/api";
// 抽象基类
export abstract class IPCBaseController<T, K> {
  public abstract run(
    _event: Electron.IpcMainInvokeEvent,
    request: T,
  ): Promise<ApiResponse<K>>;

  abstract checkParams(request: T): Error | undefined;

  protected buildResponse(data: K): ApiResponse<K> {
    return {
      code: 0,
      data,
      msg: "ok",
    } as ApiResponse<K>;
  }

  protected buildError(code: number, message: string): ApiResponse<K> {
    return {
      code,
      msg: message,
    } as ApiResponse<K>;
  }
}
