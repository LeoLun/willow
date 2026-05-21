# 设计文档：内置技能目录实现

## 架构决策

### 1. 内置技能目录位置与打包方式

在代码库中指定 `app/work/builtin-skills` 目录为内置技能存放目录。
为了让打包后的应用也能读取到这些技能，我们需要在 `app/work/forge.config.mjs` 中将其添加为 `extraResource`：

```javascript
packagerConfig: {
  // ...
  extraResource: [
    "./src/main/db/migrations",
    "./builtin-skills" // 新增拷贝内置技能目录
  ]
}
```

这样，打包后的内置技能路径为 `process.resourcesPath/builtin-skills`。

### 2. 路径获取与传递

在主进程中，通过以下方式确定内置技能目录在开发与打包环境下的实际路径：

```typescript
const builtinDir = app.isPackaged
  ? join(process.resourcesPath, "builtin-skills")
  : join(app.getAppPath(), "builtin-skills");
```

我们需要在以下两处将 `builtinDir` 传递给 `@willow/core` 的 `loadSkills` 方法：
1. `app/work/src/main/service/skill.service.ts` 中的 `getAvailableSkills`。
2. `app/work/src/main/service/agent.service.ts` 中的 `CoreAgent` 初始化处（通过 `CoreAgentOptions` 传入）。

### 3. @willow/core 中技能加载与合并的修改

修改 `packages/core/src/skills.ts`：

#### A. 接口变更

```typescript
export interface LoadSkillsResult {
  skills: Skill[];
  warnings: string[];
  userDir: string;
  projectDir: string;
  builtinDir?: string; // 新增返回字段
}
```

#### B. 加载流程变更

在 `loadSkills(options)` 中支持 `builtinDir` 参数，并加载其中的技能：

```typescript
export function loadSkills(options: {
  cwd: string;
  userData?: string;
  agentDir?: string;
  builtinDir?: string; // 新增输入字段
}): LoadSkillsResult {
  // ... 原有逻辑 ...
  
  const builtinSkills: Skill[] = [];
  if (options.builtinDir && existsSync(options.builtinDir)) {
    for (const f of collectSkillMdFiles(options.builtinDir)) {
      const r = loadSkillFromFile(f);
      warnings.push(...r.warnings);
      if (r.skill) builtinSkills.push(r.skill);
    }
  }

  // 合并技能：userSkills 优先级最高，projectSkills 其次，builtinSkills 最低
  const skills = mergeByName(userSkills, projectSkills, builtinSkills, warnings);
  
  return { skills, warnings, userDir, projectDir, builtinDir: options.builtinDir };
}
```

#### C. `mergeByName` 修改

修改 `mergeByName` 以支持合并内置技能：

```typescript
function mergeByName(
  userBatch: Skill[],
  projectBatch: Skill[],
  builtinBatch: Skill[],
  warnings: string[]
): Skill[] {
  const map = new Map<string, Skill>();
  const realPaths = new Set<string>();

  const add = (s: Skill, isBuiltin = false) => {
    let real: string;
    try {
      real = realpathSync(s.filePath);
    } catch {
      real = s.filePath;
    }
    if (realPaths.has(real)) return;
    const existing = map.get(s.name);
    if (existing) {
      // 如果是被高优先级的用户技能或项目技能覆盖，则不需要发出强警告，或者发出提示性警告
      // 这里可以根据实际需求决定是否记录在 warnings 中
      if (!isBuiltin) {
        warnings.push(`技能名称「${s.name}」冲突；保留 ${existing.filePath}，忽略 ${s.filePath}`);
      }
      return;
    }
    map.set(s.name, s);
    realPaths.add(real);
  };

  // 按优先级从高到低添加，先添加的会保留
  for (const s of userBatch) add(s);
  for (const s of projectBatch) add(s);
  for (const s of builtinBatch) add(s, true);

  return [...map.values()];
}
```

### 4. UI 标签展示

在 `app/work/src/main/service/skill.service.ts` 中：

```typescript
        const scope = this.resolveScope(skill.filePath, userDir, projectDir, builtinDir);
        if (!scope) {
          return null;
        }
        if (!workspace && scope === "workspace") {
          return null;
        }
        const isBuiltin = builtinDir && this.isWithin(skill.filePath, builtinDir);
        return {
          name: skill.name,
          description: skill.description,
          filePath: skill.filePath,
          scope,
          scopeLabel: isBuiltin ? "内置" : (scope === "global" ? "全局" : "工作空间"),
        } satisfies SkillSummary;
```

`resolveScope` 调整：

```typescript
  private resolveScope(
    filePath: string,
    userDir: string,
    projectDir: string,
    builtinDir?: string,
  ): SkillScope | undefined {
    if (this.isWithin(filePath, projectDir)) {
      return "workspace";
    }
    if (this.isWithin(filePath, userDir)) {
      return "global";
    }
    if (builtinDir && this.isWithin(filePath, builtinDir)) {
      return "global"; // 内置技能对于所有工作空间都是全局可用的
    }
    return undefined;
  }
```
