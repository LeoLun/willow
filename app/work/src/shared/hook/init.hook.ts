/**
 * 初始化 IPC 通信类型定义
 */

/** 初始化进度消息 */
export type IInitProgressPayload = {
  data?: string;
  message?: string;
};

/** 工作空间初始化结果 */
export type IInitWorkspacePayload = {
  data: {
    workspacePath: string;
    baseStartPath: string;
  };
};

/** OpenCode 服务初始化结果 */
export type IInitOpencodeServicePayload = {
  data: {
    url: string;
  };
};

/** 主进程端 Init 接口 */
export interface IInit {
  init(event: Electron.IpcMainInvokeEvent): Promise<void>;
}

/** 渲染进程端 Init 接口 */
export interface IInitRenderer {
  /** 调用主进程 INIT 方法 */
  init(): Promise<void>;
  /** 监听初始化进度 */
  onInitProgress(callback: (payload: IInitProgressPayload) => void): () => void;
  /** 监听工作空间初始化完成 */
  onInitWorkspace(
    callback: (payload: IInitWorkspacePayload) => void,
  ): () => void;
  /** 监听 OpenCode 服务初始化完成 */
  onInitOpencodeService(
    callback: (payload: IInitOpencodeServicePayload) => void,
  ): () => void;
}
