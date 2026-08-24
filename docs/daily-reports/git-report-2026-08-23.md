# Git 变更报告：2026-08-23

- 报告日期：2026-08-23（自然日，00:00:00 – 23:59:59，+0800）
- 生成时间：2026-08-24
- 仓库：`/Users/liujinglun/code/willow`
- 查询范围：`git log --since="2026-08-23 00:00:00" --until="2026-08-23 23:59:59"`（主分支 `main`），另附 `--all` 全分支核对

## 一、总体概况

| 指标 | 数值 |
| --- | --- |
| 提交总数（main） | 1 |
| 提交总数（全分支，含 gh-pages bot 提交） | 2 |
| 提交人 | liujinglun1（1）、github-actions[bot]（1，仅 gh-pages） |
| 涉及文件数（主提交） | 7 |
| 新增/删除行数（主提交） | +154 / -15 |

## 二、提交明细

| Hash | 作者 | 时间（+0800） | 类型 | 摘要 |
| --- | --- | --- | --- | --- |
| `08afde5` | liujinglun1 | 22:03:40 | feat | v1.2.9 支持 ds 视觉模型 |

> 附（全分支）：`4c8899f`，github-actions[bot]，23:07:17（15:07 UTC），`docs: update latest.json to v1.2.9`。该提交仅存在于 `origin/gh-pages` 远程分支（发布页元数据自动更新），不在本地任何分支，不计入主开发代码变更。

## 三、变更类型分布（Conventional Commit）

| 类型 | 数量 | 说明 |
| --- | --- | --- |
| feat | 1 | v1.2.9 支持 ds 视觉模型（main） |
| docs | 1 | gh-pages 上 latest.json 版本元数据自动更新（bot，非开发分支） |

## 四、主要变更内容

本次提交为一次版本发布（v1.2.8 → v1.2.9），核心是**为 DeepSeek 增加视觉（Vision）模型支持**，通过 pnpm patch 机制注入第三方依赖 `@earendil-works/pi-ai`：

1. **版本号升级**：`apps/work/package.json` 1.2.8 → 1.2.9。
2. **依赖升级**：`packages/core` 中 `@earendil-works/pi-agent-core`、`@earendil-works/pi-ai` 由 `^0.80.3` 升至 `^0.80.6`，并同步更新 `pnpm-lock.yaml`。
3. **新增补丁** `patches/@earendil-works__pi-ai@0.80.6.patch`（+112 行）：在 `pi-ai` 的模型目录（`DEEPSEEK_MODELS` / `MODELS`）中注入新模型 `deepseek-v4-flash-vision-exp`，特性包括：
   - `input: ["text", "image"]`（文本 + 图像输入）
   - reasoning 模型，`thinkingFormat: "deepseek"`，`thinkingLevelMap` 支持 high/max 档位
   - `contextWindow: 1000000`，`maxTokens: 384000`
   - 成本：input `$0.14` / output `$0.28` / cacheRead `$0.0028` / cacheWrite `$0`
4. **测试更新**：
   - `packages/core/test/model-catalog.test.ts`（+28）：新增 `deepseek-v4-flash-vision-exp` 模型目录断言，以及视觉模型的 `input` 属性与内置模型一致性校验；
   - `packages/core/test/core.test.ts`（+5）：扩展 DeepSeek 模型解析测试，覆盖新的视觉模型 ID。

### 涉及文件

| 文件 | 变更 |
| --- | --- |
| `apps/work/package.json` | +1/-1，版本号 1.2.8 → 1.2.9 |
| `package.json` | +2/-1，patchedDependencies 增加 pi-ai 补丁 |
| `packages/core/package.json` | +2/-2，依赖升级至 ^0.80.6 |
| `patches/@earendil-works__pi-ai@0.80.6.patch` | 新增，+112 |
| `pnpm-lock.yaml` | +13/-2，锁文件同步 |
| `packages/core/test/model-catalog.test.ts` | +28/-0 |
| `packages/core/test/core.test.ts` | +5/-0 |

## 五、主要涉及模块

- **packages/core**：依赖升级与模型目录测试
- **patches/**：pi-ai 补丁注入视觉模型
- **版本发布**：v1.2.9（release 流程，含 gh-pages latest.json 更新）

## 六、风险与待办

- **补丁依赖上游版本**：`deepseek-v4-flash-vision-exp` 通过 patch 注入 `pi-ai@0.80.6`，若后续升级 `pi-ai`（≥0.80.6 的下一版本）补丁可能失效或冲突，需同步检查上游是否已正式支持该模型。
- **视觉模型为实验版本（exp）**：模型 ID 带 `exp` 后缀，定价与行为可能随 DeepSeek 官方调整，建议在正式版本发布前验证图像输入的实际效果。
- **gh-pages bot 提交**：`4c8899f` 仅更新发布页元数据，不在开发分支上，无需处理，但合并/发布时注意 `latest.json` 与 v1.2.9 的一致性。
- **工作区状态**：生成报告时工作区仅有 `.DS_Store` 等未跟踪系统文件，无未提交代码改动。

## 七、附注

- 数据来源：`git log --since="2026-08-23 00:00:00" --until="2026-08-23 23:59:59" --date=iso`，按 commit date（+0800）过滤；全分支核对使用 `--all`。
- 主提交 `08afde5` 已推送到 `origin/main`；gh-pages 提交为 GitHub Actions 自动生成。
