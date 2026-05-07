# add-directory-picker-to-create-workspace 设计

## UI 稿（实现源）

实现以 `ui/work.pen` 中以下两个 Frame 为准：

| 状态 | Frame 路径 | 节点 ID |
|------|-----------|---------|
| 未选择目录 | `Willow / Create Workspace Dialog (未选择目录)` | `YXd7X` |
| 已选择目录 | `Willow / Create Workspace Dialog (已选择目录)` | `L4Vpw` |

### UI 稿结构对照（未选择目录 → YXd7X）

```
Card (q5Rg7): 480px, cornerRadius 8, fill $--card
│            shadow + $--border stroke, 居中于 1280×800 frame
├─ Header (m5v3E5): padding 24, gap 8, layout vertical
│  ├─ Title (sCgYe): "创建新工作空间", fontSize 18, fontWeight 600
│  │                  fill $--foreground, fontFamily Geist
│  └─ Desc (rZGZZ): "输入工作空间名称并选择项目目录"
│                    fontSize 14, normal, fill $--muted-foreground
├─ Content (lf02v): gap 16, padding [0,24,24,24], layout vertical
│  ├─ Name Input Group (Z0HZv): gap 6
│  │  ├─ Label (reznr): "名称", fontSize 14, fontWeight 500
│  │  └─ Input (UG8JK): height 40, cornerRadius 6, fill $--background
│  │                    border $--input, padding [10,12]
│  │                    placeholder "工作空间名称"
│  └─ Directory Section (ImHnY): gap 6
│     ├─ Label (t16bIZ): "项目目录（可选）", fontSize 14, fontWeight 500
│     └─ Dir Row (KFJr9): layout vertical, gap 8
│        └─ Select Dir Button (Z9abc):
│           height 36, cornerRadius 6, fill $--background
│           border $--border, shadow, padding [8,16], gap 6
│           ├─ folder-open icon (U4SiPr): 16×16, fill $--foreground
│           └─ Text (bZvoX): "选择目录", fontSize 14, fontWeight 500
└─ Footer (Z1D8Ms): justifyContent end, gap 12, padding [0,24,24,24]
   ├─ Cancel Button (MGGyv): width 80, height 36, cornerRadius 6
   │                         fill $--background, border $--border, shadow
   │  └─ Text (KY0Ep): "取消", fontSize 14, fontWeight 500, fill $--foreground
   └─ Create Button (v9rcU): width 80, height 36, cornerRadius 6
                              fill $--primary
      └─ Text (czNcH): "创建", fontSize 14, fontWeight 500, fill $--primary-foreground
```

### UI 稿结构对照（已选择目录 → L4Vpw）

与未选择状态完全相同，仅 Directory Section 替换为：

```
Directory Section (c7X2bG): gap 6
├─ Label (V41bcm): "项目目录（可选）", fontSize 14, fontWeight 500
└─ Selected Path Display (aPndo):
   height 36, cornerRadius 6, fill $--secondary, border $--border
   padding [0,12], gap 6, alignItems center
   ├─ folder icon (z0qioW): 16×16, fill $--foreground
   ├─ Path text (KNexm): "/Users/liujinglun/Documents/my-project"
   │                      fontSize 13, normal, fill $--foreground
   └─ check icon (aTkMJ): 14×14, fill $--muted-foreground
```

## 方案选择

采用提案中的 Approach A：在 `CreateWorkspace.vue` 内直接添加目录选择逻辑。

关键取舍：

- 复用已有 `electronAPI.selectDirectory()`，不新增 IPC 通道。
- `path` 使用 `ref<string>("")` 管理本地状态，提交时传入 `createWorkspace({ name, path })`。
- 目录选择为可选操作（label 显示"项目目录（可选）"），不影响现有必填项校验逻辑。
- 使用 shadcn 已有的 `Button`（variant outline）、图标组件（lucide）、input 样式，无需新增组件。
- 路径展示使用 `class="flex items-center gap-1.5 rounded-md border bg-secondary px-3 h-9 text-[13px]"` 对应 UI 稿中 `aPndo` 的样式。

## 图标映射

| UI 稿图标 | lucide 名称 | 用途 |
|-----------|------------|------|
| folder-open | `FolderOpen` | 选择目录按钮 |
| folder | `Folder` | 已选路径展示 |
| check | `Check` | 已选路径确认标记 |

## 组件状态设计

### 状态：未选择目录（`path` 为空）

```html
<!-- 对应 YXd7X / Z9abc -->
<Button variant="outline" class="w-full" @click="handleSelectDirectory">
  <FolderOpen class="size-4" />
  选择目录
</Button>
```

### 状态：已选择目录（`path` 不为空）

```html
<!-- 对应 L4Vpw / aPndo -->
<div class="flex items-center gap-1.5 rounded-md border bg-secondary px-3 h-9">
  <Folder class="size-4 shrink-0" />
  <span class="text-[13px] truncate">{{ path }}</span>
  <Check class="size-3.5 shrink-0 text-muted-foreground" />
</div>
```

### 过渡与边界

- 用户取消原生选择器：`result.selected === false`，`path` 保持原值不变。
- 用户选择新目录：覆盖旧路径，展示更新。
- 默认路径传 `undefined`，原生选择器使用系统默认起始目录。

## 提交逻辑

修改 `handleSubmit()`：

```typescript
const { workspace } = await electronAPI.createWorkspace({
  name: trimmed,
  path: path.value.trim(),  // 原为 ""
});
```

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/work/src/renderer/src/layout/dialog/create-workspace/CreateWorkspace.vue` | 修改 | 新增 `path` ref，添加目录选择 UI，修改提交逻辑 |

仅修改一个文件，无新增依赖。UI 样式完全使用 `@willow/shadcn` 已有组件和 Tailwind 类名，不引入新 CSS。

## 验证

验收标准以 UI 稿 `YXd7X` 和 `L4Vpw` 为准：

- 打开弹窗 → 目录区域展示"选择目录"按钮（对照 `YXd7X`）。
- 点击"选择目录" → 系统原生文件夹选择器弹出。
- 选择文件夹 → 弹窗切换为路径展示条（对照 `L4Vpw`）。
- 取消选择 → 弹窗保持"选择目录"按钮状态。
- 不选目录填名称提交 → 行为与现有一致，`path=""`。
- 选目录后提交 → `path` 携带选中路径。
- 运行 `pnpm lint` 无新增错误。
