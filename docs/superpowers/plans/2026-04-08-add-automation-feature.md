# Add Automation Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build end-to-end automation management with persisted automation records, `node-cron` scheduling, missed-run compensation, and a `/auto` UI that supports daily, hourly, weekly, and custom cron schedules.

**Architecture:** Add a new automation slice across the Electron main process, shared IPC contract, preload bridge, and Vue renderer. Persist automations in SQLite via Drizzle, schedule enabled records through a dedicated `AutomationSchedulerService`, execute runs through existing `SessionService`, and expose a dialog-driven UI on `/auto` that converts schedule presets into a canonical `triggerConfig.cronExpression`.

**Tech Stack:** Electron Forge, TypeScript, Vue 3, Pinia, Drizzle ORM, SQLite, `node-cron`, shadcn-vue

---

## File Map

**Main process**
- Modify: `app/work/src/main/app.module.ts`
- Modify: `app/work/src/main/controllers/init.controller.ts`
- Modify: `app/work/src/main/db/schema.ts`
- Create: `app/work/src/main/service/dao/automation.dao.service.ts`
- Create: `app/work/src/main/service/automation.service.ts`
- Create: `app/work/src/main/service/automation-runner.service.ts`
- Create: `app/work/src/main/service/automation-scheduler.service.ts`
- Create: `app/work/src/main/service/automation-cron.service.ts`
- Create: `app/work/src/main/controllers/automation/create.automation.controller.ts`
- Create: `app/work/src/main/controllers/automation/update.automation.controller.ts`
- Create: `app/work/src/main/controllers/automation/delete.automation.controller.ts`
- Create: `app/work/src/main/controllers/automation/get.automation.list.controller.ts`
- Create: `app/work/src/main/controllers/automation/toggle.automation.controller.ts`
- Create: `app/work/src/main/controllers/automation/get.automation.detail.controller.ts`
- Create: `app/work/src/main/db/migrations/0004_automation.sql`

**Shared / preload**
- Modify: `app/work/src/shared/api.ts`
- Modify: `app/work/src/shared/constants.ts`
- Modify: `app/work/src/preload/preload.ts`
- Modify: `app/work/src/shared/index.ts`

**Renderer**
- Modify: `app/work/src/renderer/src/pages/auto/Auto.vue`
- Create: `app/work/src/renderer/src/stores/automation.ts`
- Create: `app/work/src/renderer/src/layout/dialog/automation-form/AutomationForm.vue`
- Create: `app/work/src/renderer/src/layout/dialog/automation-form/index.ts`
- Create: `app/work/src/renderer/src/pages/auto/automation-schedule.ts`

**Verification**
- Run: `pnpm lint`
- Run: `pnpm --filter ./app/work run lint`
- Run: `pnpm --filter ./app/work run dev`

## Task 1: Add automation persistence and IPC contract

**Files:**
- Modify: `app/work/src/main/db/schema.ts`
- Create: `app/work/src/main/db/migrations/0004_automation.sql`
- Create: `app/work/src/main/service/dao/automation.dao.service.ts`
- Create: `app/work/src/main/service/automation.service.ts`
- Modify: `app/work/src/shared/api.ts`
- Modify: `app/work/src/shared/constants.ts`
- Modify: `app/work/src/preload/preload.ts`
- Create: `app/work/src/main/controllers/automation/create.automation.controller.ts`
- Create: `app/work/src/main/controllers/automation/update.automation.controller.ts`
- Create: `app/work/src/main/controllers/automation/delete.automation.controller.ts`
- Create: `app/work/src/main/controllers/automation/get.automation.list.controller.ts`
- Create: `app/work/src/main/controllers/automation/get.automation.detail.controller.ts`
- Create: `app/work/src/main/controllers/automation/toggle.automation.controller.ts`
- Modify: `app/work/src/main/app.module.ts`

- [ ] **Step 1: Extend the shared automation types before touching main/renderer code**

```ts
export type AutomationTriggerType = "schedule";
export type AutomationRunMode = "new_session" | "reuse_session";
export type AutomationRunStatus = "idle" | "success" | "failed";
export type AutomationSchedulePreset = "daily" | "hourly" | "weekly" | "custom";

export interface AutomationTriggerConfig {
  cronExpression: string;
  schedulePreset?: AutomationSchedulePreset;
  weekday?: number;
  time?: string;
  timezone?: string;
}

export interface AutomationRecord {
  id: number;
  name: string;
  workspaceId: number;
  prompt: string;
  triggerType: AutomationTriggerType;
  triggerConfig: AutomationTriggerConfig;
  runMode: AutomationRunMode;
  boundSessionId?: number | null;
  enabled: boolean;
  lastScheduledAt?: Date | null;
  lastRunAt?: Date | null;
  lastRunStatus: AutomationRunStatus;
  lastErrorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAutomationRequest {
  name: string;
  workspaceId: number;
  prompt: string;
  triggerType: "schedule";
  triggerConfig: AutomationTriggerConfig;
  runMode: AutomationRunMode;
  enabled: boolean;
}
```

- [ ] **Step 2: Add IPC channel constants and preload bridge methods**

```ts
export const GET_AUTOMATION_LIST = "GET_AUTOMATION_LIST";
export const GET_AUTOMATION_DETAIL = "GET_AUTOMATION_DETAIL";
export const CREATE_AUTOMATION = "CREATE_AUTOMATION";
export const UPDATE_AUTOMATION = "UPDATE_AUTOMATION";
export const DELETE_AUTOMATION = "DELETE_AUTOMATION";
export const TOGGLE_AUTOMATION = "TOGGLE_AUTOMATION";
```

```ts
getAutomationList: async () => { /* ipcRenderer.invoke(GET_AUTOMATION_LIST) */ },
getAutomationDetail: async (request) => { /* ipcRenderer.invoke(GET_AUTOMATION_DETAIL, request) */ },
createAutomation: async (request) => { /* ipcRenderer.invoke(CREATE_AUTOMATION, request) */ },
updateAutomation: async (request) => { /* ipcRenderer.invoke(UPDATE_AUTOMATION, request) */ },
deleteAutomation: async (request) => { /* ipcRenderer.invoke(DELETE_AUTOMATION, request) */ },
toggleAutomation: async (request) => { /* ipcRenderer.invoke(TOGGLE_AUTOMATION, request) */ },
```

- [ ] **Step 3: Add the database table in `schema.ts`**

```ts
export const automations = sqliteTable("automations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  prompt: text("prompt").notNull(),
  triggerType: text("trigger_type").notNull(),
  triggerConfig: text("trigger_config").notNull(),
  runMode: text("run_mode").notNull(),
  boundSessionId: integer("bound_session_id").references(() => sessions.id),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastScheduledAt: integer("last_scheduled_at", { mode: "timestamp" }),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  lastRunStatus: text("last_run_status").notNull().default("idle"),
  lastErrorMessage: text("last_error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});
```

- [ ] **Step 4: Create the matching SQL migration**

```sql
CREATE TABLE `automations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `workspace_id` integer NOT NULL,
  `prompt` text NOT NULL,
  `trigger_type` text NOT NULL,
  `trigger_config` text NOT NULL,
  `run_mode` text NOT NULL,
  `bound_session_id` integer,
  `enabled` integer DEFAULT 1 NOT NULL,
  `last_scheduled_at` integer,
  `last_run_at` integer,
  `last_run_status` text DEFAULT 'idle' NOT NULL,
  `last_error_message` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
  FOREIGN KEY (`bound_session_id`) REFERENCES `sessions`(`id`)
);
```

- [ ] **Step 5: Implement DAO methods with JSON parse/stringify at the boundary**

```ts
findAll() {}
findById(id: number) {}
findEnabled() {}
insert(data: NewAutomationRow) {}
update(id: number, patch: Partial<NewAutomationRow>) {}
deleteById(id: number) {}
```

```ts
private toRecord(row: AutomationRow): AutomationRecord {
  return {
    ...row,
    triggerConfig: JSON.parse(row.triggerConfig),
  };
}
```

- [ ] **Step 6: Implement `AutomationService` validation and CRUD orchestration**

```ts
async createAutomation(input: CreateAutomationRequest) {
  this.assertWorkspaceExists(input.workspaceId);
  this.assertScheduleTrigger(input.triggerType, input.triggerConfig);
  return this.automationDao.insert({
    ...input,
    triggerConfig: JSON.stringify(input.triggerConfig),
    lastRunStatus: "idle",
  });
}
```

- [ ] **Step 7: Add one controller per IPC action using the existing controller pattern**

```ts
@IPC(CREATE_AUTOMATION)
async run(
  _event: Electron.IpcMainInvokeEvent,
  request: CreateAutomationRequest,
): Promise<ApiResponse<CreateAutomationResponse>> {
  const automation = await this.automationService.createAutomation(request);
  return this.buildResponse({ automation });
}
```

- [ ] **Step 8: Register the new service and controllers in `app.module.ts`**

```ts
providers: [
  // existing providers...
  AutomationDao,
  AutomationService,
],
controllers: [
  // existing controllers...
  GetAutomationListController,
  GetAutomationDetailController,
  CreateAutomationController,
  UpdateAutomationController,
  DeleteAutomationController,
  ToggleAutomationController,
],
```

- [ ] **Step 9: Run lint on the touched TypeScript surface**

Run: `pnpm lint`
Expected: no new errors from automation files

## Task 2: Build cron conversion, scheduling, and execution services

**Files:**
- Create: `app/work/src/main/service/automation-cron.service.ts`
- Create: `app/work/src/main/service/automation-runner.service.ts`
- Create: `app/work/src/main/service/automation-scheduler.service.ts`
- Modify: `app/work/src/main/service/automation.service.ts`
- Modify: `app/work/src/main/controllers/init.controller.ts`
- Modify: `app/work/src/main/app.module.ts`
- Modify: `app/work/src/main/service/session.service.ts`

- [ ] **Step 1: Add `node-cron` dependency and import points**

```json
{
  "dependencies": {
    "node-cron": "^4.2.1"
  }
}
```

```ts
import cron from "node-cron";
```

- [ ] **Step 2: Implement preset-to-cron and cron-to-preset helpers in `automation-cron.service.ts`**

```ts
buildCronExpression(config: AutomationTriggerConfig): string {
  if (config.schedulePreset === "hourly") return "0 * * * *";
  if (config.schedulePreset === "daily" && config.time) {
    const [hour, minute] = config.time.split(":").map(Number);
    return `${minute} ${hour} * * *`;
  }
  if (config.schedulePreset === "weekly" && config.time && config.weekday !== undefined) {
    const [hour, minute] = config.time.split(":").map(Number);
    return `${minute} ${hour} * * ${config.weekday}`;
  }
  return config.cronExpression;
}
```

```ts
parsePreset(expression: string): AutomationTriggerConfig {
  if (expression === "0 * * * *") return { cronExpression: expression, schedulePreset: "hourly" };
  // Match “M H * * *” => daily
  // Match “M H * * D” => weekly
  return { cronExpression: expression, schedulePreset: "custom" };
}
```

- [ ] **Step 3: Validate cron input centrally so both service and UI use the same rules**

```ts
assertValidCron(expression: string) {
  if (!cron.validate(expression)) {
    throw new Error("invalid cron expression");
  }
}
```

- [ ] **Step 4: Implement `AutomationRunner` on top of `SessionService`**

```ts
async run(automation: AutomationRecord, scheduledAt: Date) {
  const sessionId =
    automation.runMode === "reuse_session"
      ? await this.ensureBoundSession(automation)
      : (await this.sessionService.createSession(automation.workspaceId)).id;

  await this.automationDao.update(automation.id, {
    lastScheduledAt: scheduledAt,
  });

  try {
    await this.sessionService.sendMessage(sessionId, {
      message: automation.prompt,
    });
    await this.automationDao.update(automation.id, {
      lastRunAt: new Date(),
      lastRunStatus: "success",
      lastErrorMessage: null,
    });
  } catch (error) {
    await this.automationDao.update(automation.id, {
      lastRunAt: new Date(),
      lastRunStatus: "failed",
      lastErrorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

- [ ] **Step 5: Implement `AutomationSchedulerService` with an in-memory task map keyed by automation ID**

```ts
private tasks = new Map<number, cron.ScheduledTask>();

scheduleAutomation(automation: AutomationRecord) {
  this.unscheduleAutomation(automation.id);
  if (!automation.enabled) return;
  const task = cron.schedule(automation.triggerConfig.cronExpression, async () => {
    await this.runner.run(automation, new Date());
  });
  this.tasks.set(automation.id, task);
}
```

- [ ] **Step 6: Add startup recovery and latest-missed compensation**

```ts
async restoreAll() {
  const enabled = await this.automationDao.findEnabled();
  for (const automation of enabled) {
    const missedAt = this.cronService.findLatestMissedExecution(
      automation.triggerConfig.cronExpression,
      automation.lastScheduledAt,
      new Date(),
    );
    if (missedAt) {
      await this.runner.run(automation, missedAt);
    }
    this.scheduleAutomation(automation);
  }
}
```

- [ ] **Step 7: Trigger scheduler refreshes from automation CRUD paths**

```ts
await this.scheduler.scheduleAutomation(createdAutomation);
await this.scheduler.scheduleAutomation(updatedAutomation);
this.scheduler.unscheduleAutomation(id);
```

- [ ] **Step 8: Wire startup restore into `InitController.init()` after DB initialization**

```ts
constructor(
  private readonly dbService: DbService,
  private readonly workspaceService: WorkspaceService,
  private readonly automationSchedulerService: AutomationSchedulerService,
) {}

await this.automationSchedulerService.restoreAll();
```

- [ ] **Step 9: Run app lint and confirm no missing provider/controller injection**

Run: `pnpm --filter ./app/work run lint`
Expected: no unresolved imports or DI constructor issues

## Task 3: Build the renderer automation store and schedule mapping utilities

**Files:**
- Create: `app/work/src/renderer/src/stores/automation.ts`
- Create: `app/work/src/renderer/src/pages/auto/automation-schedule.ts`
- Modify: `app/work/src/renderer/src/lib/ipc.ts`
- Modify: `app/work/src/shared/index.ts`

- [ ] **Step 1: Create a shared renderer schedule utility that mirrors the main-process cron rules**

```ts
export function presetToCron(input: {
  schedulePreset: "daily" | "hourly" | "weekly" | "custom";
  time?: string;
  weekday?: number;
  cronExpression?: string;
}) {
  if (input.schedulePreset === "hourly") return "0 * * * *";
  if (input.schedulePreset === "daily" && input.time) {
    const [hour, minute] = input.time.split(":").map(Number);
    return `${minute} ${hour} * * *`;
  }
  if (input.schedulePreset === "weekly" && input.time && input.weekday !== undefined) {
    const [hour, minute] = input.time.split(":").map(Number);
    return `${minute} ${hour} * * ${input.weekday}`;
  }
  return input.cronExpression ?? "";
}
```

```ts
export function cronToPreset(expression: string) {
  if (expression === "0 * * * *") return { schedulePreset: "hourly" as const };
  return { schedulePreset: "custom" as const, cronExpression: expression };
}
```

- [ ] **Step 2: Add a Pinia store to load and mutate automations**

```ts
export const useAutomationStore = defineStore("automation", () => {
  const automations = ref<AutomationRecord[]>([]);
  const loading = ref(false);

  async function fetchAutomationList() {
    loading.value = true;
    try {
      const response = await electronAPI.getAutomationList();
      automations.value = response.automations;
      return automations.value;
    } finally {
      loading.value = false;
    }
  }
```

- [ ] **Step 3: Normalize create/update payloads in the store so the form stays simple**

```ts
async function createAutomation(form: AutomationFormValues) {
  const triggerConfig = {
    ...form.triggerConfig,
    cronExpression: presetToCron(form.triggerConfig),
  };
  await electronAPI.createAutomation({ ...form, triggerType: "schedule", triggerConfig });
  await fetchAutomationList();
}
```

- [ ] **Step 4: Expose toggle and delete helpers for list actions**

```ts
async function toggleAutomation(id: number, enabled: boolean) {
  await electronAPI.toggleAutomation({ id, enabled });
  await fetchAutomationList();
}

async function deleteAutomation(id: number) {
  await electronAPI.deleteAutomation({ id });
  await fetchAutomationList();
}
```

- [ ] **Step 5: Run renderer lint for the new utility/store**

Run: `pnpm --filter ./app/work run lint`
Expected: no renderer import/type errors

## Task 4: Implement `/auto` page and automation form dialog

**Files:**
- Modify: `app/work/src/renderer/src/pages/auto/Auto.vue`
- Create: `app/work/src/renderer/src/layout/dialog/automation-form/AutomationForm.vue`
- Create: `app/work/src/renderer/src/layout/dialog/automation-form/index.ts`
- Modify: `app/work/src/renderer/src/router.ts`
- Reuse: `app/work/src/renderer/src/layout/dialog/use-dialog.ts`

- [ ] **Step 1: Build the automation form dialog skeleton using the existing dialog pattern**

```vue
<DialogHeader>
  <DialogTitle>{{ automation ? "编辑自动化" : "添加自动化" }}</DialogTitle>
  <DialogDescription>配置工作空间、提示词、调度方式与执行模式</DialogDescription>
</DialogHeader>
```

```ts
const form = ref({
  name: "",
  workspaceId: 0,
  prompt: "",
  runMode: "new_session" as const,
  enabled: true,
  triggerConfig: {
    schedulePreset: "daily" as const,
    time: "09:00",
    weekday: 1,
    cronExpression: "",
  },
});
```

- [ ] **Step 2: Render the four schedule modes exactly from the OpenSpec**

```vue
<Select v-model="form.triggerConfig.schedulePreset">
  <SelectTrigger><SelectValue placeholder="选择频率" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="daily">每天</SelectItem>
    <SelectItem value="hourly">每小时</SelectItem>
    <SelectItem value="weekly">每周</SelectItem>
    <SelectItem value="custom">自定义</SelectItem>
  </SelectContent>
</Select>
```

```vue
<Input v-if="form.triggerConfig.schedulePreset === 'daily'" v-model="form.triggerConfig.time" type="time" />
<div v-else-if="form.triggerConfig.schedulePreset === 'hourly'" class="text-sm text-muted-foreground">每小时整点执行一次</div>
<div v-else-if="form.triggerConfig.schedulePreset === 'weekly'" class="grid gap-3">
  <Select v-model="form.triggerConfig.weekday">...</Select>
  <Input v-model="form.triggerConfig.time" type="time" />
</div>
<Input v-else v-model="form.triggerConfig.cronExpression" placeholder="0 9 * * 1" />
```

- [ ] **Step 3: Add submission validation and edit backfill**

```ts
onMounted(() => {
  if (!automation) return;
  form.value = {
    name: automation.name,
    workspaceId: automation.workspaceId,
    prompt: automation.prompt,
    runMode: automation.runMode,
    enabled: automation.enabled,
    triggerConfig: cronToPreset(automation.triggerConfig.cronExpression),
  };
});
```

```ts
async function handleSubmit() {
  if (!form.value.name || !form.value.workspaceId || !form.value.prompt.trim()) {
    error.value = "请填写名称、工作空间和提示词";
    return;
  }
  await save(form.value);
  emit("close");
}
```

- [ ] **Step 4: Replace the placeholder `Auto.vue` with a complete list/empty-state screen**

```vue
<section class="flex items-center justify-between">
  <div>
    <h1 class="text-2xl font-semibold">自动化</h1>
    <p class="text-sm text-muted-foreground">定时在指定工作空间中自动执行提示词</p>
  </div>
  <Button @click="openCreate">添加自动化</Button>
</section>
```

```vue
<Card v-if="automations.length === 0">
  <CardHeader>
    <CardTitle>还没有自动化</CardTitle>
    <CardDescription>创建第一条自动化，让固定提示词按计划自动运行。</CardDescription>
  </CardHeader>
  <CardContent>
    <Button @click="openCreate">添加自动化</Button>
  </CardContent>
</Card>
```

- [ ] **Step 5: Render list actions for enable/disable, edit, and delete**

```vue
<Switch
  :model-value="automation.enabled"
  @update:model-value="automationStore.toggleAutomation(automation.id, $event)"
/>
<Button variant="outline" size="sm" @click="openEdit(automation)">编辑</Button>
<Button variant="destructive" size="sm" @click="automationStore.deleteAutomation(automation.id)">删除</Button>
```

- [ ] **Step 6: Fetch automation and workspace data when the page mounts**

```ts
onMounted(async () => {
  await Promise.all([
    automationStore.fetchAutomationList(),
    workspaceStore.fetchWorkspaceList(),
  ]);
});
```

- [ ] **Step 7: Run the app and manually verify the dialog flow**

Run: `pnpm dev`
Expected: Electron app opens, `/auto` shows empty state, and the form opens from both the header and empty-state button

## Task 5: Manual integration verification and cleanup

**Files:**
- Modify: `docs/superpowers/plans/2026-04-08-add-automation-feature.md`
- Review: `openspec/changes/add-automation-feature/design.md`
- Review: `openspec/changes/add-automation-feature/tasks.md`

- [ ] **Step 1: Verify daily/hourly/weekly/custom payloads**

Run these manual scenarios in the app:
- Daily `09:00` saves `0 9 * * *`
- Hourly saves `0 * * * *`
- Weekly Monday `09:00` saves `0 9 * * 1`
- Custom keeps the raw cron string

Expected: reopening the edit dialog restores preset-compatible values and falls back to custom when needed

- [ ] **Step 2: Verify run mode behavior**

Run these manual scenarios:
- Create an automation with `runMode: "new_session"` and confirm each execution creates a new session
- Create an automation with `runMode: "reuse_session"` and confirm later executions append to the same session

Expected: `boundSessionId` stays empty for new-session mode and persists for reuse mode

- [ ] **Step 3: Verify enabled/disabled scheduling**

Run these manual scenarios:
- Enable an automation and confirm it is scheduled
- Disable the same automation and confirm it stops triggering
- Delete the automation and confirm it is unscheduled

Expected: list state, DB record state, and scheduler state remain aligned

- [ ] **Step 4: Verify missed-run compensation**

Run these manual scenarios:
- Create an enabled automation with a near-future cron
- Quit the app before the scheduled time
- Reopen after one missed slot
- Repeat after multiple missed slots

Expected: the app compensates only the latest missed scheduled time

- [ ] **Step 5: Final verification commands**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm --filter ./app/work run lint`
Expected: PASS

Run: `pnpm dev`
Expected: manual automation scenarios above work end-to-end

- [ ] **Step 6: Commit in focused slices**

```bash
git add app/work/src/main app/work/src/shared app/work/src/preload
git commit -m "feat: 增加自动化主进程能力"
```

```bash
git add app/work/src/renderer/src/pages/auto app/work/src/renderer/src/stores app/work/src/renderer/src/layout/dialog/automation-form
git commit -m "feat: 增加自动化页面与表单"
```

```bash
git add docs/superpowers/plans/2026-04-08-add-automation-feature.md openspec/changes/add-automation-feature
git commit -m "docs: 完善自动化实现计划"
```

## Self-Review

- OpenSpec coverage:
  - 数据模型与 IPC 契约: Task 1
  - `node-cron` 调度、执行模式、结果回写、重启补偿: Task 2
  - `/auto` 页面、空态、列表、表单、四种定时模式、默认新建会话: Task 3-4
  - 联调与手动验证: Task 5
- Placeholder scan:
  - No `TODO` / `TBD`
  - All tasks contain exact file paths and explicit commands
- Type consistency:
  - Canonical trigger payload uses `triggerConfig.cronExpression`
  - UI-only preset fields remain `schedulePreset`, `weekday`, `time`
  - Run mode remains `new_session | reuse_session`
