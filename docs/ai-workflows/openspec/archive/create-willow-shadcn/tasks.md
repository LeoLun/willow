# Tasks

## 1. OpenSpec Baseline

- [x] 新建 `create-willow-shadcn` change
- [x] 明确目标、非目标、成功标准与推荐方案
- [x] 明确 `@willow/shadcn`、`@willow/ui` 与 `app/work` 本地组件目录的职责边界
- [x] 为共享基础组件包补充独立 spec

## 2. Package Architecture

- [x] 创建 `@willow/shadcn` workspace 包骨架
- [x] 定义共享组件目录、公共入口和导出约定
- [x] 梳理迁移所需的公共依赖、工具函数和样式入口

## 3. Migration

- [x] 从 `app/work/src/renderer/src/components/ui/` 中挑选首批共享基础组件迁入 `@willow/shadcn`
- [x] 为 `app/work` 补齐必要的兼容层或引用切换策略
- [x] 逐步让 `app/work`、`app/ui-playground` 等消费方改用 `@willow/shadcn`

## 4. Verification

- [x] 校验新包职责与 `@willow/ui` 没有重叠
- [x] 校验共享基础组件不再以 `app/work` 内部目录作为长期真相源
- [x] 校验组件组织方式与仓库现有 `shadcn-vue` / `DESIGN.md` 基线一致
