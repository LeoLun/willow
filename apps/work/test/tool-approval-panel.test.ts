// @vitest-environment jsdom

import type { ToolApprovalEventPayload } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import ToolApprovalPanel from "../src/renderer/src/components/tool/ToolApprovalPanel.vue";

const mountedApps: App[] = [];

function createRequest(
  overrides: Partial<ToolApprovalEventPayload> = {},
): ToolApprovalEventPayload {
  return {
    approvalId: "approval",
    workspaceId: 1,
    sessionId: "session",
    toolCallId: "call",
    toolName: "bash",
    input: { command: "curl example.com" },
    reason: "sandbox-denied",
    display: "curl example.com",
    ...overrides,
  };
}

function mountPanel(request: ToolApprovalEventPayload, onDecision = vi.fn(async () => undefined)) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () => h(ToolApprovalPanel, { request, onDecision }),
  });
  mountedApps.push(app);
  app.mount(container);
  return { container, onDecision };
}

async function flushDecision(): Promise<void> {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("ToolApprovalPanel", () => {
  it("renders independently and preserves escaped AI review details", async () => {
    const mounted = mountPanel(
      createRequest({
        mayHavePartialEffects: true,
        aiReview: {
          status: "rejected",
          reason: '<img src=x onerror="window.hacked=true"> Too broad.',
        },
      }),
    );

    expect(mounted.container.querySelector("[data-slot=tool-approval-panel]")).not.toBeNull();
    expect(mounted.container.querySelector("[role=dialog]")).toBeNull();
    expect(
      mounted.container.querySelector("[data-slot=ai-approval-review]")?.textContent,
    ).toContain("AI 未批准");
    expect(
      mounted.container.querySelector("[data-slot=ai-approval-review] > div")?.classList,
    ).toContain("items-start");
    expect(mounted.container.textContent).toContain(
      '<img src=x onerror="window.hacked=true"> Too broad.',
    );
    expect(mounted.container.querySelector("img")).toBeNull();
    expect(mounted.container.textContent).toContain("可能已产生部分工作区内副作用");

    const allow = [...mounted.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("仅本次允许"),
    );
    allow?.click();
    await flushDecision();
    expect(mounted.onDecision).toHaveBeenCalledWith("allow");
  });

  it("submits an explicit denial", async () => {
    const mounted = mountPanel(createRequest());
    const deny = [...mounted.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("拒绝"),
    );

    deny?.click();
    await flushDecision();

    expect(mounted.onDecision).toHaveBeenCalledWith("deny");
  });

  it("blocks repeated decisions while a submission is pending", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onDecision = vi.fn(() => pending);
    const mounted = mountPanel(createRequest(), onDecision);
    const [deny, allow] = [...mounted.container.querySelectorAll("button")];

    allow.click();
    deny.click();
    await nextTick();

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith("allow");
    expect(deny.disabled).toBe(true);
    expect(allow.disabled).toBe(true);
    expect(allow.getAttribute("aria-busy")).toBe("true");

    finish();
    await flushDecision();
    expect(deny.disabled).toBe(false);
    expect(allow.disabled).toBe(false);
  });

  it("keeps the panel available and reports a submission failure", async () => {
    const mounted = mountPanel(
      createRequest(),
      vi.fn(async () => {
        throw new Error("审批服务暂不可用");
      }),
    );
    const allow = [...mounted.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("仅本次允许"),
    );

    allow?.click();
    await flushDecision();

    expect(mounted.container.querySelector("[data-slot=tool-approval-panel]")).not.toBeNull();
    expect(mounted.container.querySelector("[role=alert]")?.textContent).toContain(
      "审批服务暂不可用",
    );
    expect(allow?.hasAttribute("disabled")).toBe(false);
  });

  it("distinguishes an unavailable AI review", () => {
    const mounted = mountPanel(
      createRequest({
        toolName: "write",
        input: { path: "/outside" },
        reason: "outside-workspace-write",
        display: "/outside",
        aiReview: { status: "failed", reason: "未配置小模型。" },
      }),
    );

    expect(mounted.container.textContent).toContain("AI 审批不可用");
    expect(mounted.container.textContent).toContain("未配置小模型。");
  });

  it("shows normalized risk, justification, rule, and sandbox violations", () => {
    const mounted = mountPanel(
      createRequest({
        risk: "high",
        ruleId: "bash.sandbox-escalation",
        action: {
          type: "exec",
          command: "printf elevated",
          cwd: "/workspace",
          interactive: false,
          sandboxPermissions: "elevated",
          justification: "The output path is required.",
        },
        approvalReason: {
          type: "bash.sandbox-escalation",
          message: "One-time full access requested.",
          metadata: {
            violations: [{ type: "filesystem-write", message: "deny file-write /outside" }],
          },
        },
      }),
    );

    expect(
      mounted.container.querySelector("[data-slot=tool-approval-risk]")?.textContent,
    ).toContain("风险：高");
    expect(mounted.container.textContent).toContain("bash.sandbox-escalation");
    expect(mounted.container.textContent).toContain("The output path is required.");
    expect(mounted.container.textContent).toContain("deny file-write /outside");
  });

  it("describes a domain allowlist request as a scoped sandbox grant", () => {
    const mounted = mountPanel(
      createRequest({
        input: { command: "curl https://example.com" },
        reason: "network-domain",
        display: "example.com",
        mayHavePartialEffects: true,
      }),
    );

    expect(mounted.container.textContent).toContain("目标域名不在网络允许列表中");
    expect(mounted.container.textContent).toContain("仅放行上述资源");
    expect(mounted.container.textContent).toContain("在沙箱中完整");
  });

  it("describes an application launch as control of an external application", () => {
    const command = 'open -a "Microsoft Word" report.docx';
    const mounted = mountPanel(
      createRequest({
        input: { command },
        reason: "application-launch",
        display: command,
        mayHavePartialEffects: true,
      }),
    );

    expect(mounted.container.textContent).toContain("启动或控制外部应用");
    expect(mounted.container.querySelector("[data-slot=tool-approval-command]")?.textContent).toBe(
      command,
    );
    expect(mounted.container.textContent).toContain("可能已经产生部分工作区内副作用");
    expect(mounted.container.textContent).toContain(
      "仅为本次工具调用开启应用启动与 Apple Events 能力",
    );
  });

  it.each([
    ["executable-install", "安装或替换用户可执行文件", "持久化代码执行入口"],
    ["process-inspection", "查看沙箱外的进程信息", "不开放浏览器所需的完整 Mach IPC"],
    ["local-network-listen", "监听本机回环网络端口", "外部网络仍受域名允许列表限制"],
    ["interactive-terminal", "启用交互式终端能力", "不会接收用户键盘输入"],
  ] as const)("describes the %s capability and its scope", (reason, label, scope) => {
    const mounted = mountPanel(
      createRequest({
        reason,
        display: "scoped capability",
        mayHavePartialEffects: true,
      }),
    );

    expect(mounted.container.textContent).toContain(label);
    expect(mounted.container.textContent).toContain(scope);
  });

  it.each([
    ["automation-create", "创建持久化的定时任务", "立即注册计划"],
    ["automation-update", "修改持久化的定时任务", "刷新触发计划"],
    ["automation-delete", "删除持久化的定时任务", "已生成的聊天会话会保留"],
  ] as const)("describes the %s persistent effect", (reason, label, effect) => {
    const mounted = mountPanel(
      createRequest({
        toolName:
          reason === "automation-create"
            ? "createAutomation"
            : reason === "automation-update"
              ? "updateAutomation"
              : "deleteAutomation",
        reason,
        display: "automation #7",
      }),
    );

    expect(mounted.container.textContent).toContain(label);
    expect(mounted.container.textContent).toContain(effect);
    expect(
      mounted.container.querySelector("[data-slot=tool-approval-partial-effects]"),
    ).not.toBeNull();
  });
});
