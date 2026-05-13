# Tasks

## 1. 路径边界 helper

- [x] 1.1 检查 `packages/core/src/tools/path-utils.ts` 的现有路径解析语义。
- [x] 1.2 增加共享 helper，用于判断解析后的目标路径是否位于当前 `cwd` 内。
- [x] 1.3 覆盖相对路径、绝对路径、`..` 逃逸和 sibling 前缀目录边界。

## 2. 更新 write 权限策略

- [x] 2.1 在 [write.ts](/Users/liujinglun/code/willow/packages/core/src/tools/write.ts) 的 `meta.permission(params)` 中按目标路径判断。
- [x] 2.2 当前工作空间内目标返回 `allow`。
- [x] 2.3 当前工作空间外目标保持 `ask`，并保留高风险说明。
- [x] 2.4 确保执行阶段写入路径与 permission 判断使用同一解析语义。

## 3. 更新 edit 权限策略

- [x] 3.1 在 [edit.ts](/Users/liujinglun/code/willow/packages/core/src/tools/edit.ts) 的 `meta.permission(params)` 中按目标路径判断。
- [x] 3.2 当前工作空间内目标返回 `allow`。
- [x] 3.3 当前工作空间外目标保持 `ask`，并保留高风险说明。
- [x] 3.4 保持 `edit` 原有读写权限检查和唯一替换逻辑不变。

## 4. 验证

- [x] 4.1 为路径边界 helper 或工具 permission resolver 增加单元测试；如果当前包测试脚本不可用，则用最小可运行验证脚本覆盖关键场景。
- [x] 4.2 验证 `write` 相对路径和工作空间内绝对路径返回 `allow`。
- [x] 4.3 验证 `edit` 相对路径和工作空间内绝对路径返回 `allow`。
- [x] 4.4 验证 `../` 逃逸和工作空间外绝对路径返回 `ask`。
- [x] 4.5 验证 sibling 前缀目录不被误判为工作空间内。
- [x] 4.6 运行 `pnpm lint`。
- [x] 4.7 如改动影响类型或包构建，运行 `pnpm build`。
