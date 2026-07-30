// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick, type App } from "vue";

const mocks = vi.hoisted(() => ({
  getBuiltinSkillList: vi.fn(),
  getWorkspaceList: vi.fn(),
  getSkillList: vi.fn(),
  setBuiltinSkillEnabled: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getBuiltinSkillList: mocks.getBuiltinSkillList,
    getWorkspaceList: mocks.getWorkspaceList,
    getSkillList: mocks.getSkillList,
    setBuiltinSkillEnabled: mocks.setBuiltinSkillEnabled,
  },
}));

import Skill from "../src/renderer/src/pages/main/skill/Skill.vue";

const mountedApps: App[] = [];
const reviewSkill = {
  id: "review",
  name: "review",
  description: "Review implementation changes",
  scope: "global" as const,
  enabled: true,
};
const workspace = {
  id: 7,
  name: "Willow",
  path: "/workspace/willow",
  pinned: true,
  createdAt: new Date("2026-07-30T00:00:00.000Z"),
  updatedAt: new Date("2026-07-30T00:00:00.000Z"),
};
const globalSkill = {
  name: "personal",
  description: "Personal global skill",
  filePath: "/users/test/.willow/skills/personal/SKILL.md",
  source: "global" as const,
};
const projectSkill = {
  name: "project-review",
  description: "Review this project",
  filePath: "/workspace/willow/.agents/skills/project-review/SKILL.md",
  source: "project" as const,
};

async function mountPage(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp(Skill);
  app.mount(container);
  mountedApps.push(app);
  await nextTick();
  return container;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBuiltinSkillList.mockResolvedValue({ skills: [reviewSkill] });
  mocks.getWorkspaceList.mockImplementation(async ({ pinned }) => ({
    workspaces: pinned ? [workspace] : [],
  }));
  mocks.getSkillList.mockResolvedValue({ skills: [globalSkill, projectSkill] });
  mocks.setBuiltinSkillEnabled.mockImplementation(async ({ enabled }) => ({
    skill: { ...reviewSkill, enabled },
  }));
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("skills page", () => {
  it("renders built-in, global, and project skills in their sections", async () => {
    const container = await mountPage();

    await vi.waitFor(() => {
      const item = container.querySelector("[data-slot=builtin-skill-item]");
      expect(item?.textContent).toContain("review");
      expect(item?.textContent).toContain("Review implementation changes");
      expect(container.querySelector("[data-slot=project-skill-item]")?.textContent).toContain(
        "project-review",
      );
    });
    expect(
      container.querySelector("[data-slot=builtin-skill-switch]")?.getAttribute("aria-checked"),
    ).toBe("true");
    expect(container.querySelectorAll("[data-slot=builtin-skill-switch]")).toHaveLength(1);

    const globalTab = container.querySelector<HTMLButtonElement>(
      "[data-slot=installed-skill-tab][data-skill-source=global]",
    );
    expect(globalTab).not.toBeNull();
    globalTab!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));

    await vi.waitFor(() =>
      expect(container.querySelector("[data-slot=global-skill-item]")?.textContent).toContain(
        "personal",
      ),
    );
    expect(container.querySelector("[data-slot=builtin-skill-item]")).toBeNull();
    expect(container.querySelector("[data-slot=builtin-skill-switch]")).toBeNull();
  });

  it("keeps the built-in switch in the title row without narrowing its description", async () => {
    const container = await mountPage();
    await vi.waitFor(() =>
      expect(container.querySelector("[data-slot=builtin-skill-item]")).not.toBeNull(),
    );
    const content = container.querySelector("[data-slot=installed-skill-content]")!;
    const titleRow = content.querySelector("[data-slot=installed-skill-title-row]")!;
    const description = content.querySelector("[data-slot=installed-skill-description]")!;

    expect(titleRow.querySelector("[data-slot=builtin-skill-switch]")).not.toBeNull();
    expect(titleRow.contains(description)).toBe(false);
    expect(description.parentElement).toBe(content);
  });

  it("optimistically toggles a skill and locks only that switch while saving", async () => {
    let resolveSave!: (value: { skill: typeof reviewSkill }) => void;
    mocks.setBuiltinSkillEnabled.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const container = await mountPage();
    await vi.waitFor(() =>
      expect(container.querySelector("[data-slot=builtin-skill-switch]")).not.toBeNull(),
    );
    const toggle = container.querySelector<HTMLButtonElement>("[data-slot=builtin-skill-switch]")!;

    toggle.click();
    await vi.waitFor(() => {
      expect(mocks.setBuiltinSkillEnabled).toHaveBeenCalledWith({
        id: "review",
        enabled: false,
      });
      expect(toggle.disabled).toBe(true);
      expect(toggle.getAttribute("aria-checked")).toBe("false");
    });

    resolveSave({ skill: { ...reviewSkill, enabled: false } });
    await vi.waitFor(() => expect(toggle.disabled).toBe(false));
  });

  it("rolls back a failed toggle and shows a row-level error", async () => {
    mocks.setBuiltinSkillEnabled.mockRejectedValueOnce(new Error("save failed"));
    const container = await mountPage();
    await vi.waitFor(() =>
      expect(container.querySelector("[data-slot=builtin-skill-switch]")).not.toBeNull(),
    );
    const toggle = container.querySelector<HTMLButtonElement>("[data-slot=builtin-skill-switch]")!;

    toggle.click();

    await vi.waitFor(() => {
      expect(toggle.getAttribute("aria-checked")).toBe("true");
      expect(container.querySelector("[data-slot=builtin-skill-error]")?.textContent).toContain(
        "保存失败",
      );
    });
  });

  it("renders loading, empty, and retryable error states", async () => {
    let resolveLoad!: (value: { skills: [] }) => void;
    mocks.getSkillList.mockResolvedValue({ skills: [] });
    mocks.getBuiltinSkillList.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    const loadingContainer = await mountPage();
    expect(loadingContainer.querySelector("[data-slot=builtin-skills-loading]")).not.toBeNull();
    resolveLoad({ skills: [] });
    await vi.waitFor(() =>
      expect(loadingContainer.querySelector("[data-slot=builtin-skills-empty]")).not.toBeNull(),
    );

    mountedApps.pop()?.unmount();
    loadingContainer.remove();
    mocks.getBuiltinSkillList
      .mockRejectedValueOnce(new Error("scan failed"))
      .mockResolvedValueOnce({ skills: [] });
    const errorContainer = await mountPage();
    await vi.waitFor(() =>
      expect(errorContainer.querySelector("[data-slot=builtin-skills-error]")).not.toBeNull(),
    );

    errorContainer.querySelector<HTMLButtonElement>("[data-slot=builtin-skills-retry]")?.click();
    await vi.waitFor(() =>
      expect(errorContainer.querySelector("[data-slot=builtin-skills-empty]")).not.toBeNull(),
    );
    expect(mocks.getBuiltinSkillList).toHaveBeenCalledTimes(3);
  });
});
