# Tasks

## 1. OpenSpec Baseline

- [x] 新建 `add-ui-playground-dev-page` change
- [x] 明确目标、非目标、成功标准和推荐方案
- [x] 定义 playground 的职责边界、依赖边界和视觉约束
- [x] 为独立 UI 调试能力补充 spec

## 2. Playground Scaffold

- [x] 新增 `@willow/ui` 的独立 playground 入口或等价轻量 app
- [x] 配置单独的 dev 启动命令，启动 localhost Web 服务，且不影响现有根 `pnpm dev`
- [x] 保证 playground 能在不启动 Electron 的情况下独立运行
- [x] 明确浏览器访问方式与默认本地地址输出

## 3. Demo Experience

- [x] 为 playground 建立稳定的 demo 导航和内容展示骨架
- [x] 提供代表性的消息组件、工具渲染器和状态样例
- [x] 让开发者可以快速观察常见样式边界，例如长内容、折叠内容、空态和错误态

## 4. Style Alignment

- [x] 复用 `@willow/ui` 样式入口与必要依赖，避免复制平行实现
- [x] 校验 playground 的页面壳和示例容器符合仓库根 `DESIGN.md`
- [x] 明确 playground 不依赖 Electron、IPC 和业务 store 初始化

## 5. Verification

- [x] 验证独立 dev 命令可以启动 playground localhost 服务
- [x] 验证开发者可以通过浏览器直接打开调试页
- [x] 验证至少一组核心 `@willow/ui` 组件可在 playground 中稳定渲染
- [x] 验证 playground 关闭后不影响 `app/work` 原有开发流程
