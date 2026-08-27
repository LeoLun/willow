# Git 变更报告：2026-08-25

- 报告日期：2026-08-25（自然日，00:00:00 – 23:59:59，+0800）
- 生成时间：2026-08-26
- 仓库：`/Users/liujinglun/code/willow`
- 查询范围：`git log --since="2026-08-25 00:00:00" --until="2026-08-25 23:59:59" --date=iso`，另附 `--all` 全分支核对

## 一、总体概况

| 指标 | 数值 |
| --- | --- |
| 提交总数（main） | 1 |
| 提交总数（全分支核对） | 1（无其他分支提交） |
| 提交人 | liujinglun1（1） |
| 涉及文件数 | 7 |
| 新增/删除行数 | +260 / -23 |

## 二、提交明细

| Hash | 作者 | 时间（+0800） | 类型 | 摘要 |
| --- | --- | --- | --- | --- |
| `528dedc` | liujinglun1 | 18:59:47 | feat | 优化工具调用 |

> 该提交已在 `main` 分支上，无远程 gh-pages 或其他分支的并发提交。

## 三、变更类型分布（Conventional Commit）

| 类型 | 数量 | 说明 |
| --- | --- | --- |
| feat | 1 | 优化工具调用（核心工具系统增强） |

## 四、主要变更内容

本次提交聚焦 `packages/core` 的工具调用体验与可靠性，核心是**增强 `edit` 工具的错误诊断**，并为工具执行补充通用辅助能力：

1. **`edit` 工具失败诊断增强**（`packages/core/src/tools/edit.ts`，+68/-3）：
   - 当任一 `oldText` 在文件中找不到时，报错会定位到具体的 `edits` 下标并给出文本摘要；
   - 通过 bigram 相似度（`lineSimilarity`，阈值 0.45）在文件中寻找最近似的当前行，报错中附上最接近的行号和内容，帮助 Agent 重新 `read` 后精确重试；
   - 保持整次调用原子性：任一替换项缺失时文件不被写入，且不会自动应用模糊匹配结果。
2. **工具执行通用辅助函数**（`packages/core/src/tools/shared.ts`，+140/-11）：
   - 路径级写操作队列：为每个规范化绝对路径维护 Promise 链，避免并发的 `write`、`edit` 或计划文件操作相互覆盖（仅进程内生效，非跨进程文件锁，文档已明确说明）；
   - 通用权限审批流程：`full-access` 直接放行，其余模式由审批回调决定，审批前后均检查中止信号；缺失回调、拒绝或无效结果一律按拒绝处理；
   - 写权限校验逻辑：敏感目标（如 `.env`、私钥、策略 `denyWrite`）直接拒绝且不可审批放行；工作区、系统临时目录、全局技能目录及显式 `allowWrite` 根目录内直接放行；其余目标发起 `outside-workspace-write` 审批；路径边界由 policy 模块按 canonical path 判断，`..`、符号链接等无法绕过授权；
   - 工具执行检查点（`checkpointAbort`）与逻辑行数统计（支持 LF/CRLF/CR）等辅助能力。
3. **工具基类与提示词**（`packages/core/src/tools/base.ts` +16/-3、`packages/core/src/prompt/system.md` +1/-1）：
   - `BaseTool` 构造函数增加 `@TODO 构建工作空间及副作用区域` 占位，并补充参数校验/权限校验/执行/响应构建的流程注释；参数错误信息格式化调整；
   - 系统提示词中 `edit` 的描述更新为"整次调用原子、所有替换项需定位同一文件"的准确表述。
4. **测试与文档**：
   - `packages/core/test/tools.test.ts`（+28/-1）：新增"失败时定位替换项并建议最近似当前行"的测试，并验证失败后文件未被写入；更新原有错误文案断言；
   - `packages/core/test/system.test.ts`（+3/-3）：同步更新系统提示词断言；
   - `docs/permission-design.md`（+4/-1）：补充 `edit` 缺失文本错误的定位与提示行为说明。

### 涉及文件

| 文件 | 变更 |
| --- | --- |
| `docs/permission-design.md` | +4/-1 |
| `packages/core/src/prompt/system.md` | +1/-1 |
| `packages/core/src/tools/base.ts` | +16/-3 |
| `packages/core/src/tools/edit.ts` | +68/-3 |
| `packages/core/src/tools/shared.ts` | +140/-11 |
| `packages/core/test/system.test.ts` | +3/-3 |
| `packages/core/test/tools.test.ts` | +28/-1 |

## 五、主要涉及模块

- **packages/core**：工具系统（`tools/edit.ts`、`tools/shared.ts`、`tools/base.ts`）、系统提示词（`prompt/system.md`）及相关测试
- **docs**：`permission-design.md` 权限设计文档同步

## 六、风险与待办

- **`@TODO` 占位**：`base.ts` 构造函数留有 `@TODO 构建工作空间及副作用区域`，工作空间/副作用区域构建尚未实现，后续需跟进。
- **进程内队列局限**：shared.ts 的路径级写操作队列仅保证单进程内顺序，不提供跨进程文件锁或文件系统事务能力，文档已注明；若未来存在多进程写入同一文件场景需另行设计。
- **模糊匹配仅为提示**：`edit` 错误诊断提供的"最近似行"提示仅供重试参考，工具不会自动应用，Agent 需重新读取文件后精确重试，不会引入静默错误写入。
- **工作区状态**：生成报告时工作区存在未提交改动（`apps/work` 下约 20 个文件，含新增 `permission-mode.service.ts`、`set-permission-mode.message.controller.ts` 等），属于今天（2026-08-26）的开发内容，未计入本次报告。

## 七、附注

- 数据来源：`git log --since="2026-08-25 00:00:00" --until="2026-08-25 23:59:59" --date=iso`，按 commit date（+0800）过滤；全分支核对使用 `--all`（仅 `528dedc` 一个提交）。
- 提交 `528dedc` 位于 `main` 分支，生成报告时 `main` 最新提交为 `33ef1dd`（feat: v1.2.13）。
