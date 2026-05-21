# 2026-05-21 — 内置技能目录实现

对应 OpenSpec 变更：`docs/ai-workflows/openspec/changes/builtin-skills/`

---

## 依赖与假设

- `packages/core` 的 `loadSkills()` 是技能发现的唯一入口，UI 和 Agent 均通过它获取可用技能。
- Electron Forge 的 `packagerConfig.extraResource` 会把指定目录原样拷贝到 `process.resourcesPath` 下。
- 当前 `SkillSummary.scopeLabel` 类型是 `"全局" | "工作空间"` 字面量联合；需要扩展为包含 `"内置"`。

---

## Slice 1：创建内置技能目录与占位技能

### 实现步骤

1. 创建 `app/work/builtin-skills/` 目录。
2. 创建一个占位测试技能 `app/work/builtin-skills/echo-test/SKILL.md`，内容：

```yaml
---
name: echo-test
description: 测试用内置技能，用于验证内置技能目录加载是否正常。
---
```

### 验证

- 文件存在且 frontmatter 解析无误（后续 Slice 会在集成测试中覆盖）。

---

## Slice 2：修改 `@willow/core` 技能加载逻辑

### 涉及文件

- [skills.ts](file:///Users/liujinglun/code/willow/packages/core/src/skills.ts)
- [core-agent.ts](file:///Users/liujinglun/code/willow/packages/core/src/core-agent.ts)
- [index.ts](file:///Users/liujinglun/code/willow/packages/core/src/index.ts)（导出不变，仅类型扩展会自动跟随）

### 实现步骤

#### 2-A. `LoadSkillsResult` 接口新增 `builtinDir`

```diff
 export interface LoadSkillsResult {
   skills: Skill[];
   warnings: string[];
   userDir: string;
   projectDir: string;
+  builtinDir?: string;
 }
```

#### 2-B. `loadSkills()` 函数新增 `builtinDir` 参数

在 `options` 签名中增加 `builtinDir?: string`。

在 `projectSkills` 收集结束后、`mergeByName` 调用前，新增：

```typescript
const builtinSkills: Skill[] = [];
if (options.builtinDir && existsSync(options.builtinDir)) {
  for (const f of collectSkillMdFiles(options.builtinDir)) {
    const r = loadSkillFromFile(f);
    warnings.push(...r.warnings);
    if (r.skill) builtinSkills.push(r.skill);
  }
}
```

调用 `mergeByName` 时传入三个批次。返回值中附带 `builtinDir: options.builtinDir`。

#### 2-C. `mergeByName()` 支持三批次

将函数签名由 `(firstBatch, secondBatch, warnings)` 改为 `(userBatch, projectBatch, builtinBatch, warnings)`。

- `userBatch` 和 `projectBatch` 冲突时保持现有的硬警告。
- `builtinBatch` 被覆盖时**静默跳过**（不记入 `warnings`），因为这是设计预期。

```typescript
function mergeByName(
  userBatch: Skill[],
  projectBatch: Skill[],
  builtinBatch: Skill[],
  warnings: string[],
): Skill[] {
  const map = new Map<string, Skill>();
  const realPaths = new Set<string>();

  const add = (s: Skill, silent = false) => {
    let real: string;
    try { real = realpathSync(s.filePath); } catch { real = s.filePath; }
    if (realPaths.has(real)) return;
    const existing = map.get(s.name);
    if (existing) {
      if (!silent) {
        warnings.push(`技能名称「${s.name}」冲突；保留 ${existing.filePath}，忽略 ${s.filePath}`);
      }
      return;
    }
    map.set(s.name, s);
    realPaths.add(real);
  };

  for (const s of userBatch) add(s);
  for (const s of projectBatch) add(s);
  for (const s of builtinBatch) add(s, true);

  return [...map.values()];
}
```

#### 2-D. `CoreAgentOptions` 新增 `builtinDir`

在 [core-agent.ts](file:///Users/liujinglun/code/willow/packages/core/src/core-agent.ts) L13-L24 的 `CoreAgentOptions` 接口中加入：

```diff
 export interface CoreAgentOptions {
   cwd: string;
   agentDir?: string;
   userData?: string;
+  builtinDir?: string;
   // ...
 }
```

在 `CoreAgent` 构造函数中将 `builtinDir` 传入 `loadSkills()`：

```diff
     const { skills, userDir, projectDir } = loadSkills({
       cwd: this.cwd,
       agentDir: options.agentDir,
       userData: options.userData,
+      builtinDir: options.builtinDir,
     });
```

### 验证

- `pnpm --filter @willow/core build` 成功。
- 无新增类型错误。

---

## Slice 3：修改类型定义扩展 `scopeLabel`

### 涉及文件

- [api.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/api.ts) L176
- [types.ts](file:///Users/liujinglun/code/willow/packages/sender/src/types.ts) L23

### 实现步骤

#### 3-A. `@shared/api.ts` 中 `SkillSummary.scopeLabel` 扩展

```diff
 export interface SkillSummary {
   name: string;
   description: string;
   filePath: string;
   scope: SkillScope;
-  scopeLabel: "全局" | "工作空间";
+  scopeLabel: "全局" | "工作空间" | "内置";
 }
```

#### 3-B. `packages/sender/src/types.ts` 中 `SenderSkillOption.scopeLabel` 扩展

```diff
 export interface SenderSkillOption {
   name: string;
   description: string;
   filePath: string;
   scope: SenderSkillScope;
-  scopeLabel: "全局" | "工作空间";
+  scopeLabel: "全局" | "工作空间" | "内置";
 }
```

### 验证

- 全局类型检查通过。

---

## Slice 4：修改 Electron 主进程服务

### 涉及文件

- [skill.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/skill.service.ts)
- [agent.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/agent.service.ts)

### 实现步骤

#### 4-A. `SkillService` 新增 `getBuiltinSkillsDir()` 私有方法

```typescript
private getBuiltinSkillsDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "builtin-skills")
    : join(app.getAppPath(), "builtin-skills");
}
```

#### 4-B. `getAvailableSkills()` 传入 `builtinDir` 并处理 scope label

```diff
   getAvailableSkills(workspaceId?: number): GetAvailableSkillsResponse {
     const workspace = workspaceId ? this.workspaceDao.findById(workspaceId) : undefined;
     const cwd = workspace?.path ?? this.getEmptyWorkspaceCwd();
-    const { skills, userDir, projectDir } = loadSkills({
+    const builtinDir = this.getBuiltinSkillsDir();
+    const { skills, userDir, projectDir } = loadSkills({
       cwd,
       userData: app.getPath("userData"),
+      builtinDir,
     });

     const summaries = skills
       .map((skill) => {
         if (this.isLegacyBuiltinInitSkill(skill.filePath, userDir)) {
           return null;
         }
-        const scope = this.resolveScope(skill.filePath, userDir, projectDir);
+        const scope = this.resolveScope(skill.filePath, userDir, projectDir, builtinDir);
         if (!scope) {
           return null;
         }
         if (!workspace && scope === "workspace") {
           return null;
         }
+        const isBuiltin = this.isWithin(skill.filePath, builtinDir);
         return {
           name: skill.name,
           description: skill.description,
           filePath: skill.filePath,
           scope,
-          scopeLabel: scope === "global" ? "全局" : "工作空间",
+          scopeLabel: isBuiltin ? "内置" : scope === "global" ? "全局" : "工作空间",
         } satisfies SkillSummary;
       })
```

#### 4-C. `resolveScope()` 新增 `builtinDir` 参数

```diff
   private resolveScope(
     filePath: string,
     userDir: string,
     projectDir: string,
+    builtinDir?: string,
   ): SkillScope | undefined {
     if (this.isWithin(filePath, projectDir)) {
       return "workspace";
     }
     if (this.isWithin(filePath, userDir)) {
       return "global";
     }
+    if (builtinDir && this.isWithin(filePath, builtinDir)) {
+      return "global";
+    }
     return undefined;
   }
```

#### 4-D. `AgentService.getDefaultAgent()` 传入 `builtinDir`

在 [agent.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/agent.service.ts) L251 附近：

```diff
     const coreAgent = new CoreAgent(agent, {
       cwd,
       userData: app.getPath("userData"),
+      builtinDir: app.isPackaged
+        ? join(process.resourcesPath, "builtin-skills")
+        : join(app.getAppPath(), "builtin-skills"),
       websearch: ...,
```

需要在文件顶部导入 `join`（`import { join } from "node:path"`，如果尚未导入）。

### 验证

- `pnpm lint` 无新错误。
- `pnpm build` 构建成功。

---

## Slice 5：修改打包配置

### 涉及文件

- [forge.config.mjs](file:///Users/liujinglun/code/willow/app/work/forge.config.mjs) L27

### 实现步骤

```diff
   packagerConfig: {
     // ...
-    extraResource: ["./src/main/db/migrations"],
+    extraResource: ["./src/main/db/migrations", "./builtin-skills"],
   },
```

### 验证

- 检查构建产物中 `Resources/builtin-skills/` 目录存在。

---

## Slice 6：端到端验证

### 步骤

1. 运行 `pnpm build` — 确认所有包构建成功。
2. 运行 `pnpm lint` — 确认无样式错误。
3. 运行 `pnpm dev` — 启动 Electron 应用。
4. 在对话框中输入 `/` — 确认 `echo-test` 出现在资源选择器中，标签显示为"内置"。
5. 在当前工作空间 `.agents/skills/echo-test/SKILL.md` 中放置同名技能 — 重新加载后确认标签变为"工作空间"且内容来自工作空间版本。
6. 删除工作空间覆盖后恢复为"内置"标签。

### 停止条件

- 所有 6 项验收标准（spec.md）全部通过。
- `pnpm build` 和 `pnpm lint` 干净通过。

---

## 下一步

执行阶段使用 `workflow-implement`。
