# 执行计划：add-directory-picker-to-create-workspace

**日期**: 2026-05-07
**变更**: 给创建新工作空间弹窗添加选择目录功能
**UI 稿**: `ui/work.pen` — `YXd7X`（未选择）、`L4Vpw`（已选择）
**涉及文件**: 1 个 (`CreateWorkspace.vue`)

## 前置条件检查

- [x] `electronAPI.selectDirectory()` 已在 IPC 层完整实现
- [x] `CreateWorkspaceRequest.path` 已是可选字段，后端已支持
- [x] UI 稿已完成两种状态设计
- [ ] 无阻塞项

## 执行切片

### Slice 1: Script — 新增状态与处理函数

**文件**: `app/work/src/renderer/src/layout/dialog/create-workspace/CreateWorkspace.vue`
**位置**: `<script setup lang="ts">` 块

**操作**:

1. 在 `const loading = ref(false)` 之后新增：
```typescript
const path = ref("");
```

2. 在 `handleSubmit` 函数之前新增 `handleSelectDirectory` 函数：
```typescript
async function handleSelectDirectory() {
  const result = await electronAPI.selectDirectory();
  if (result.selected && result.path) {
    path.value = result.path;
  }
}
```

**验证**: TypeScript 类型检查无错误（`electronAPI.selectDirectory()` 返回 `ISelectDirectoryResult`）。

---

### Slice 2: Template — 名称输入框后、Footer 前插入目录选择区域

**文件**: 同上
**位置**: `<Input>` 组件之后、`<DialogFooter>` 之前

**当前模板结构**（关键部分）:
```html
<form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
  <Input v-model="name" placeholder="工作区名称" autofocus />
  <DialogFooter>
    ...
  </DialogFooter>
</form>
```

**替换为**:
```html
<form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
  <div class="grid gap-4">
    <!-- 名称输入 —— 现有逻辑 -->
    <Input v-model="name" placeholder="工作区名称" autofocus />

    <!-- 目录选择 —— 对照 UI 稿 ImHnY / c7X2bG -->
    <div class="grid gap-1.5">
      <label class="text-sm font-medium">项目目录（可选）</label>
      <!-- 未选择状态：对照 YXd7X / Z9abc -->
      <Button
        v-if="!path"
        type="button"
        variant="outline"
        class="w-full"
        @click="handleSelectDirectory"
      >
        <FolderOpen class="size-4" />
        选择目录
      </Button>
      <!-- 已选择状态：对照 L4Vpw / aPndo -->
      <button
        v-else
        type="button"
        class="flex items-center gap-1.5 rounded-md border bg-secondary px-3 h-9"
        @click="handleSelectDirectory"
      >
        <Folder class="size-4 shrink-0" />
        <span class="text-[13px] truncate">{{ path }}</span>
        <Check class="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </div>
  </div>

  <DialogFooter>
    ...
  </DialogFooter>
</form>
```

**图标导入**（在 `<script setup>` 中新增）:
```typescript
import { Folder, FolderOpen, Check } from "lucide-vue-next";
```

**验证**: 
- 对照 UI 稿 `YXd7X`：按钮全宽 outline 风格，folder-open 图标 + "选择目录"文字
- 对照 UI 稿 `L4Vpw`：secondary 背景 + border，folder 图标 + 路径文本 + check 图标

---

### Slice 3: Script — 修改提交逻辑

**文件**: 同上
**位置**: `handleSubmit` 函数内，第 29 行

**当前代码**:
```typescript
const { workspace } = await electronAPI.createWorkspace({
  name: trimmed,
  path: "",
});
```

**替换为**:
```typescript
const { workspace } = await electronAPI.createWorkspace({
  name: trimmed,
  path: path.value.trim(),
});
```

**验证**: 
- 未选目录时 `path.value.trim()` 返回 `""`，行为与现有一致。
- 已选目录时返回选中路径，正确传入。

---

### Slice 4: 验证与收尾

**手动验证清单**（按 UI 稿验收）:

| # | 操作 | 预期结果 | 对照 |
|---|------|---------|------|
| 4.1 | 打开弹窗 | 目录区域展示"选择目录"按钮 | `YXd7X` |
| 4.2 | 点击"选择目录" | 系统原生文件夹选择器弹出 | — |
| 4.3 | 选择文件夹并确认 | 切换为路径展示条（folder + 路径 + check） | `L4Vpw` |
| 4.4 | 再次点击路径条 | 重新拉起选择器，新路径覆盖旧路径 | `L4Vpw` |
| 4.5 | 在原生选择器中取消 | 弹窗状态不变 | 保持原状态 |
| 4.6 | 不选目录填名称提交 | 成功创建，`path=""` | — |
| 4.7 | 选目录后提交 | 成功创建，`path` 携带路径 | — |

**自动化检查**:
```bash
cd app/work && pnpm lint
```

---

## 依赖与假设

- **无外部依赖**：复用已有的 `electronAPI.selectDirectory()`、`Button`、`Input`、`DialogFooter`。
- **无新增文件**：仅修改 `CreateWorkspace.vue`。
- **图标来源**：`lucide-vue-next`（项目已依赖）。
- **假设**：`lucide-vue-next` 已安装；若未安装则作为 `Folder`、`FolderOpen`、`Check` 从 `lucide-vue-next` 导入。

## 停止条件

- 弹窗两种状态与 UI 稿 `YXd7X` / `L4Vpw` 视觉不一致时停止，对照 UI 稿修正后再继续。
- `pnpm lint` 失败时停止，修复 lint 错误后再继续。
- 原生选择器无法弹出时停止，检查 `electronAPI.selectDirectory()` IPC 链路。
