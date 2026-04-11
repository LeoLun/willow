# 2026-04-12 add-automation-name-option

## Goal

在现有 `add-automation-feature` OpenSpec 范围内，为自动化创建/编辑流程补充“名称”选项，并确保 renderer、IPC、主进程 service、AI tools 对名称字段使用同一语义：用户可选填写，未填写时回退到自动生成标题。

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/add-automation-feature/proposal.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/design.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/specs/automation/spec.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/tasks.md`
- `DESIGN.md`

## Execution Slices

### Slice 1: Contract Alignment

1. 在 OpenSpec 中明确名称字段为可选输入，而不是仅自动生成。
2. 在 shared API、controller、service 输入类型中增加可选 `title` 字段。
3. 确保 AI tools 的 create/update 也支持传入 `title`。

验证：
- TypeScript 类型可从 renderer 一直传到主进程与 tools。
- 未传 `title` 时仍能正常创建。

### Slice 2: Service Title Resolution

1. 将自动化标题生成逻辑收敛为“优先用户输入，其次按 prompt 自动生成”。
2. 编辑自动化时，仅在显式传入 `title` 时更新标题，避免因为改 prompt 覆盖用户自定义名称。

验证：
- 新建时传入 `title` 会落库。
- 新建时不传 `title` 会使用自动生成标题。
- 编辑 prompt 不会意外改掉已有自定义标题。

### Slice 3: Renderer Form Submission

1. 在自动化表单中把“名称”字段接入请求体，而不是只做本地展示。
2. 保持字段可选，不把名称作为必填项。
3. 调整说明文案和 placeholder，让用户理解不填会自动生成。

验证：
- 新建/编辑弹窗都能保存名称。
- 空名称提交时仍可成功创建。

## Stop Conditions

- 自动化名称在 renderer、IPC、service、AI tools 四条链路上语义一致。
- 无需数据库迁移；现有 `title` 字段即可承载本次变更。
