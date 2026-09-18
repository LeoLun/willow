// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";

const mocks = vi.hoisted(() => ({
  openDialog: vi.fn(),
  getMcp: vi.fn(),
  manageMcp: vi.fn(),
  listeners: new Map<string, Set<(event: unknown) => void>>(),
}));
vi.mock("@/components/dialog", () => ({ useDialog: () => ({ openDialog: mocks.openDialog }) }));
vi.mock("@/components/layout/BaseHeader.vue", async () => {
  const { h, defineComponent } = await import("vue");
  return {
    default: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h("header", slots.left?.()),
    }),
  };
});
vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener(name: string, callback: (event: unknown) => void) {
      if (!mocks.listeners.has(name)) mocks.listeners.set(name, new Set());
      mocks.listeners.get(name)!.add(callback);
    },
    removeEventListener: (name: string, callback: (event: unknown) => void) =>
      mocks.listeners.get(name)?.delete(callback),
    waitUntilReady: async () => {},
  }),
}));
vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getMcp: mocks.getMcp,
    manageMcp: mocks.manageMcp,
    getWorkspaceList: async ({ pinned }: { pinned: boolean }) => ({
      workspaces: [pinned ? { id: 1, name: "first" } : { id: 2, name: "second" }],
    }),
    getBuiltinSkillList: async () => ({ skills: [] }),
    getSkillList: async () => ({ skills: [] }),
  },
}));
import Skill from "../src/renderer/src/pages/main/skill/Skill.vue";
import { MCP_STATUS_EVENT } from "../src/shared/constants";

function server(
  name: string,
  source: "global" | "project",
  status = "not-connected",
  hasCredentials = false,
) {
  return {
    name,
    source,
    status,
    hasCredentials,
    definition: { url: "https://example.com/mcp" },
    transport: "http",
    toolCount: 0,
    cached: false,
  };
}
function snapshot(
  target: { scope?: string; workspaceId?: number },
  servers = target.scope === "global"
    ? [server("global-service", "global", "connected", true)]
    : [
        server("global-service", "global", "connected", true),
        server(`project-${target.workspaceId}`, "project"),
      ],
) {
  return {
    ...target,
    servers,
    configRevision: "a".repeat(64),
    status: {
      ...target,
      revision: 1,
      servers,
      connectedCount: servers.filter((s) => s.status === "connected").length,
    },
  };
}
let app: App;
let container: HTMLElement;
async function mount(path = "/skill?view=mcp&workspaceId=2") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/skill", name: "skill", component: Skill }],
  });
  app = createApp(defineComponent({ setup: () => () => h(RouterView) }));
  app.use(router);
  await router.push(path);
  container = document.createElement("div");
  document.body.append(container);
  app.mount(container);
  await nextTick();
  return router;
}
function button(text: string, root: ParentNode = container) {
  const result = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  expect(result, `button ${text}`).toBeTruthy();
  return result!;
}
function tab(text: string) {
  button(text).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.getMcp.mockImplementation(async (target) => snapshot(target));
  mocks.manageMcp.mockImplementation(async (request) => ({ project: snapshot(request) }));
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe("skills and MCP page", () => {
  it("defaults to skills, switches via the header, and preserves selection in the route", async () => {
    const router = await mount("/skill");
    expect(container.querySelector("[data-slot=mcp-page]")).toBeNull();
    tab("MCP");
    await vi.waitFor(() => expect(container.textContent).toContain("project-1"));
    expect(router.currentRoute.value.query.view).toBe("mcp");
    tab("second");
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    expect(router.currentRoute.value.query.workspaceId).toBe("2");
    tab("技能");
    await vi.waitFor(() => expect(container.querySelector("[data-slot=mcp-page]")).toBeNull());
    expect(router.currentRoute.value.query.view).toBeUndefined();
  });

  it("opens the requested project, labels inherited services, and keeps login separate from connection", async () => {
    mocks.getMcp.mockImplementation(async (target) =>
      snapshot(
        target,
        target.scope === "global"
          ? [
              server("public", "global", "connected"),
              server("logged-in", "global", "not-connected", true),
              server("expired", "global", "needs-auth", true),
            ]
          : [server("inherited", "global"), server(`project-${target.workspaceId}`, "project")],
      ),
    );
    await mount();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    expect(container.textContent).not.toContain("project-1");
    expect(container.querySelectorAll("[data-slot=mcp-logged-in]")).toHaveLength(1);
    expect(container.textContent).toContain("需要登录");
    expect(container.querySelectorAll("[data-slot=mcp-server-item]")).toHaveLength(5);
    expect(
      container
        .querySelectorAll("[data-slot=mcp-server-list]")[0]
        ?.classList.contains("md:grid-cols-2"),
    ).toBe(true);
    expect(container.querySelector("form, input, textarea, [role=dialog]")).toBeNull();
    expect(container.querySelectorAll("[data-slot=mcp-check]")).toHaveLength(5);
    expect(
      [...container.querySelectorAll("[data-slot=mcp-panel] button")].every((item) =>
        ["Check", "去登录", "退出登录"].includes(item.textContent?.trim() ?? ""),
      ),
    ).toBe(true);
    expect(mocks.manageMcp).not.toHaveBeenCalled();
  });

  it("logs out an inherited service once and refreshes its login state", async () => {
    await mount();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    const projectSection = container.querySelectorAll("section")[1]!;
    const logout = projectSection.querySelector<HTMLButtonElement>("[data-slot=mcp-logout]")!;
    let resolve!: (value: unknown) => void;
    mocks.manageMcp.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    logout.click();
    await nextTick();
    expect(logout.disabled).toBe(true);
    expect(logout.textContent).toContain("退出中");
    logout.click();
    expect(mocks.manageMcp).toHaveBeenCalledTimes(1);
    expect(mocks.manageMcp).toHaveBeenCalledWith({
      scope: "project",
      workspaceId: 2,
      serverName: "global-service",
      action: "logout",
    });
    resolve({
      project: snapshot({ workspaceId: 2 }, [server("global-service", "global", "needs-auth")]),
    });
    await vi.waitFor(() => expect(projectSection.textContent).toContain("去登录"));
    expect(projectSection.querySelector("[data-slot=mcp-logout]")).toBeNull();
    expect(projectSection.querySelector("[data-slot=mcp-logged-in]")).toBeNull();
  });

  it("keeps the logout button available after a failed logout", async () => {
    await mount();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    const projectSection = container.querySelectorAll("section")[1]!;
    const logout = projectSection.querySelector<HTMLButtonElement>("[data-slot=mcp-logout]")!;
    mocks.manageMcp.mockRejectedValueOnce(new Error("退出登录失败"));
    logout.click();
    await vi.waitFor(() => expect(projectSection.textContent).toContain("退出登录失败"));
    expect(logout.disabled).toBe(false);
    expect(projectSection.querySelector("[data-slot=mcp-logged-in]")).not.toBeNull();
  });

  it("ignores read responses from a previous project and never submits mutations", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getMcp.mockImplementation((target) =>
      target.workspaceId === 2
        ? new Promise((done) => {
            resolve = done;
          })
        : Promise.resolve(snapshot(target)),
    );
    await mount();
    await vi.waitFor(() =>
      expect(mocks.getMcp).toHaveBeenCalledWith({ scope: "project", workspaceId: 2 }),
    );
    tab("first");
    await vi.waitFor(() => expect(container.textContent).toContain("project-1"));
    resolve(snapshot({ workspaceId: 2 }, [server("late-response", "project")]));
    await nextTick();
    expect(container.textContent).not.toContain("late-response");
    expect(mocks.manageMcp).not.toHaveBeenCalled();
    expect(container.querySelector("form, input, textarea, [role=dialog]")).toBeNull();
  });

  it("checks a connection once, updates its status, and shows failures without configuration editing", async () => {
    await mount();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    const projectSection = container.querySelectorAll("section")[1]!;
    const check = projectSection.querySelectorAll<HTMLButtonElement>("[data-slot=mcp-check]")[1]!;
    let resolve!: (value: unknown) => void;
    mocks.manageMcp.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    check.click();
    await nextTick();
    expect(check.disabled).toBe(true);
    expect(check.textContent).toContain("检查中");
    check.click();
    expect(mocks.manageMcp).toHaveBeenCalledTimes(1);
    expect(mocks.manageMcp).toHaveBeenCalledWith({
      scope: "project",
      workspaceId: 2,
      serverName: "project-2",
      action: "connect",
    });
    resolve({
      project: snapshot({ workspaceId: 2 }, [server("project-2", "project", "connected")]),
    });
    await vi.waitFor(() => expect(projectSection.textContent).toContain("已连接"));
    const retry = [...projectSection.querySelectorAll("[data-slot=mcp-server-item]")]
      .find((item) => item.textContent?.includes("project-2"))!
      .querySelector<HTMLButtonElement>("[data-slot=mcp-check]")!;
    await vi.waitFor(() => expect(retry.disabled).toBe(false));
    mocks.manageMcp.mockRejectedValueOnce(new Error("连接超时"));
    retry.click();
    await vi.waitFor(() => expect(projectSection.textContent).toContain("连接超时"));
    expect(container.querySelector("form, input, textarea")).toBeNull();
  });

  it("clears a failed check after login connects the service through a status update", async () => {
    mocks.getMcp.mockImplementation(async (target) =>
      snapshot(target, [server("postman", "global", "needs-auth")]),
    );
    await mount("/skill?view=mcp");
    await vi.waitFor(() => expect(container.textContent).toContain("postman"));
    const globalSection = container.querySelector("section")!;
    mocks.manageMcp.mockRejectedValueOnce(new Error("需要登录或更新密钥。"));
    globalSection.querySelector<HTMLButtonElement>("[data-slot=mcp-check]")!.click();
    await vi.waitFor(() => expect(globalSection.textContent).toContain("需要登录或更新密钥。"));

    mocks.getMcp.mockImplementation(async (target) => {
      const next = snapshot(target, [server("postman", "global", "connected", true)]);
      next.status.revision = 2;
      return next;
    });
    for (const listener of mocks.listeners.get(MCP_STATUS_EVENT) ?? []) {
      listener({ scope: "global" });
    }
    await vi.waitFor(() => expect(globalSection.textContent).toContain("已连接"));
    expect(globalSection.textContent).toContain("已登录");
    expect(globalSection.textContent).not.toContain("需要登录或更新密钥。");
  });

  it("offers login after a check requires authentication and opens the existing dialog with the service scope", async () => {
    await mount();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    const projectSection = container.querySelectorAll("section")[1]!;
    mocks.manageMcp.mockResolvedValueOnce({
      project: snapshot({ scope: "project", workspaceId: 2 }, [
        server("project-2", "project", "needs-auth"),
      ]),
    });
    projectSection.querySelectorAll<HTMLButtonElement>("[data-slot=mcp-check]")[1]!.click();
    await vi.waitFor(() => expect(projectSection.textContent).toContain("去登录"));
    expect(mocks.openDialog).not.toHaveBeenCalled();
    button("去登录", projectSection).click();
    expect(mocks.openDialog).toHaveBeenLastCalledWith(expect.anything(), {
      scope: "project",
      workspaceId: 2,
      serverName: "project-2",
    });
    mocks.getMcp.mockImplementation(async (target) =>
      snapshot(target, [server("inherited", "global", "needs-auth")]),
    );
    tab("first");
    await vi.waitFor(() => expect(projectSection.textContent).toContain("inherited"));
    button("去登录", projectSection).click();
    expect(mocks.openDialog).toHaveBeenLastCalledWith(expect.anything(), {
      scope: "global",
      serverName: "inherited",
    });
    expect(mocks.manageMcp).toHaveBeenCalledTimes(1);
  });

  it("ignores a check response after switching projects and checks inherited global services", async () => {
    await mount();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    let resolve!: (value: unknown) => void;
    mocks.manageMcp.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    container
      .querySelectorAll("section")[1]!
      .querySelector<HTMLButtonElement>("[data-slot=mcp-check]")!
      .click();
    expect(mocks.manageMcp).toHaveBeenCalledWith({
      scope: "project",
      workspaceId: 2,
      serverName: "global-service",
      action: "connect",
    });
    tab("first");
    await vi.waitFor(() => expect(container.textContent).toContain("project-1"));
    resolve({ project: snapshot({ workspaceId: 2 }, [server("late-check", "project")]) });
    await nextTick();
    expect(container.textContent).not.toContain("late-check");
  });

  it("shows empty and failed configuration states and retries without losing scope", async () => {
    mocks.getMcp.mockImplementation(async (target) =>
      target.scope === "global" ? snapshot(target, []) : Promise.reject(new Error("项目加载失败")),
    );
    await mount();
    await vi.waitFor(() => expect(container.textContent).toContain("项目加载失败"));
    expect(container.textContent).toContain("暂无全局 MCP");
    mocks.getMcp.mockImplementation(async (target) => snapshot(target));
    const projectSection = [...container.querySelectorAll("section")][1]!;
    button("重试", projectSection).click();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
  });
});
