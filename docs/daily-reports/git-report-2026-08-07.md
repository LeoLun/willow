# Git 变更报告：2026-08-07

- 报告日期：2026-08-07（自然日，00:00:00 – 23:59:59，+0800）
- 生成时间：2026-08-08
- 仓库：`/Users/liujinglun/code/willow`
- 查询范围：全部分支（`git log --all`），diff 基准为 `82a9253`（2026-08-04）

## 一、总体概况

| 指标 | 数值 |
| --- | --- |
| 提交总数 | 4（main 分支 3 个 + gh-pages 自动提交 1 个） |
| 提交人 | 2（liujinglun1 × 3、github-actions[bot] × 1，后者为 CI 自动） |
| 涉及文件数 | 40（main 分支净变更 39 个文件） |
| 新增行数 | +3904（main 分支） |
| 删除行数 | -34（main 分支） |
| 新版本 | v1.0.12（tag 于 `bfa22ba`） |

## 二、提交明细

| Commit | 时间 (+0800) | 提交人 | 分支 | 说明 |
| --- | --- | --- | --- | --- |
| `3f3c5c2` | 15:51:07 | liujinglun1 | main | feat: 支持看板和输入框填空能力（skill 资源、main process、renderer） |
| `03b3788` | 15:51:30 | liujinglun1 | main | feat: 支持看板和输入框填空能力（shared API、hook、tests） |
| `bfa22ba` | 16:47:24 | liujinglun1 | main | feat: 1.0.12（版本发布，tag `v1.0.12`） |
| `c016f0f` | 16:51:34 | github-actions[bot] | gh-pages | docs: update latest.json to v1.0.12（CI 自动同步 release 信息） |

提交人统计：liujinglun1 × 3（手动）、github-actions[bot] × 1（自动，仅更新 `latest.json`，非业务代码）。

## 三、变更类型分布（Conventional Commit）

| 类型 | 数量 | 占比 | 说明 |
| --- | --- | --- | --- |
| feat | 3 | 75% | 看板面板 + 输入框填空 + v1.0.12 版本发布 |
| docs | 1 | 25% | gh-pages 上 CI 自动更新 `latest.json` |
| fix / refactor / chore | 0 | 0% | — |

## 四、主要涉及模块与文件

全部业务变更集中在 `apps/work`（Electron 桌面应用），核心主题是**「看板（Board）面板」与「输入框填空（Prompt Template）」两项新能力**：

1. **新技能资源**：新增 `resources/skills/create-board/` 技能（SKILL.md、agents/openai.yaml、4 份设计参考：airbnb / apple / claude / cursor，约 2200 行参考文档）。
2. **Main process**：
   - 新增 `controllers/board/get.board.controller.ts`、`service/board-panel.service.ts`（看板内容读取服务）
   - 新增 `window/main-window-web-preferences.ts`（webPreferences 调整，见风险项）
   - 修改 `app.module.ts`、`main.window.ts`、`preload.ts`
3. **Renderer**：
   - 新增 `right-sidebar/BoardPanel.vue`、`prompt-composer/PromptTemplateField.vue`
   - 修改 `PromptComposer.vue`（+356 行，本次最大改动）、`tool-display.ts`、`ChatBase.vue`、right-sidebar 面板注册机制（panel-registry / types）等
4. **Shared**：新增 `hook/board.hook.ts`，修改 `api.ts`、`constants.ts`
5. **测试**：新增 `board-panel.service.test.ts`、`board-panel.test.ts`、`main-window-web-preferences.test.ts`、`prompt-composer.test.ts`（+295 行）等，新增约 700 行测试代码。
6. **其他**：`apps/work/package.json`（版本号 1.0.12）、`index.html`（CSP 增加 `frame-src 'self' file:`）、`latest.json`（CI 同步）、`.codegraph/daemon.pid`（工具噪声，非业务变更）。

## 五、风险与待办

- **`.codegraph/daemon.pid` 被提交进 git**：属于本地运行时文件（PID 每次启动都会变化），两次提交均误带该文件，建议加入 `.gitignore`。
- **开发模式关闭 `webSecurity`**：`main-window-web-preferences.ts` 在 Vite dev server 下设置 `webSecurity: false` 以允许 board iframe 加载 `file://` URL。代码注释说明打包版不受影响（renderer 同样来自 `file://`），但仍属安全降级点，建议后续验证打包版行为并评估更严格的替代方案（如 `webSecurity` 保持开启 + CSP 精确放行）。
- **提交信息可改进**：`3f3c5c2` 与 `03b3788` 共用标题「feat: 支持看板和输入框填空能力」；`bfa22ba` 实为版本发布却使用 `feat` 前缀，可改用 `chore`/`release` 更准确。
- **单次提交体量大**：`3f3c5c2` 含 27 个文件、+3197 行（含 skill 参考文档），后续可拆分便于 review 与回滚定位。
- **工作区存在大量未提交改动**：生成报告时 `git status` 显示 69 个已修改未提交文件（涉及 `packages/core`、agent.service、ai-tool-approval.service、message.service、schema.ts 等），属于 2026-08-08 进行中的工作，请确认是否需要及时提交，避免与昨天的发布基线混淆。

## 六、附注

- 数据来源：`git log --all --since="2026-08-07 00:00:00" --until="2026-08-07 23:59:59"`，按 commit date 过滤（含 UTC 时区的 gh-pages 提交，已换算为 +0800）。
- main 分支净变更统计：`git diff 82a9253 bfa22ba --shortstat` → 39 files changed, 3904 insertions(+), 34 deletions(-)。
