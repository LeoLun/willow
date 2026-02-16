/**
 * 目录选择对话框 IPC 通信类型定义
 */

/** 选择目录的返回值 */
export type ISelectDirectoryResult = {
  /** 用户是否选择了目录（未取消） */
  selected: boolean;
  /** 选择的目录路径 */
  path?: string;
};

/** 渲染进程端 Dialog 接口 */
export interface IDialogRenderer {
  /** 打开目录选择对话框 */
  selectDirectory(defaultPath?: string): Promise<ISelectDirectoryResult>;
}
