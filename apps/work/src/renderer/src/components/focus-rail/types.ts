/**
 * FocusRail 业务无关的数据结构。
 *
 * FocusRail 只依赖这些字段做导航、Hover Preview 与 Active 指示，
 * 具体业务展示通过 `#content` slot 自定义。
 */
export interface FocusRailItem {
  /**
   * 唯一 ID
   */
  id: string;

  /**
   * Rail 对应页面 DOM 节点 ID。
   * 如果不传，则默认使用 id。
   */
  targetId?: string;

  /**
   * 详情标题
   */
  title: string;

  /**
   * 摘要
   */
  summary?: string;

  /**
   * 详情列表
   */
  details?: string[];

  /**
   * Item 层级。
   *
   * 1 = 最长
   * 2 = 中等
   * 3 = 最短
   */
  level?: 1 | 2 | 3;

  /**
   * 自定义状态
   */
  status?: "default" | "success" | "warning" | "error";

  /**
   * 是否禁用
   */
  disabled?: boolean;

  /**
   * 业务侧附加数据
   */
  metadata?: Record<string, unknown>;
}
