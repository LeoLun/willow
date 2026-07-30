// @vitest-environment jsdom

import type { SkillInfo } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, shallowRef, type App } from "vue";
import type { ComposerPanelNavigationHandle } from "../src/renderer/src/components/prompt-composer";

const getSkillList = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", () => ({
  electronAPI: { getSkillList },
}));

import SkillSearchPanel from "../src/renderer/src/components/prompt-composer/SkillSearchPanel.vue";

const mountedApps: App[] = [];

function mountPanel(query: string, onSelect = vi.fn()) {
  const currentQuery = ref(query);
  const panel = shallowRef<ComposerPanelNavigationHandle>();
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(SkillSearchPanel, {
        ref: panel,
        workspaceId: 1,
        query: currentQuery.value,
        onSelect,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, currentQuery, onSelect, panel };
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  getSkillList.mockReset();
  vi.restoreAllMocks();
});

describe("SkillSearchPanel", () => {
  it("filters, highlights, wraps, and selects skills with the keyboard", async () => {
    const skills: SkillInfo[] = [
      {
        name: "review",
        description: "Inspect pull request changes",
        filePath: "/skills/review/SKILL.md",
      },
      {
        name: "write-docs",
        description: "Create documentation",
        filePath: "/skills/write-docs/SKILL.md",
      },
    ];
    getSkillList.mockResolvedValueOnce({ skills });
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const mounted = mountPanel("");

    await vi.waitFor(() => {
      expect(mounted.container.querySelectorAll("[data-slot=skill-list-item]")).toHaveLength(2);
    });
    const items = () => [
      ...mounted.container.querySelectorAll<HTMLElement>("[data-slot=skill-list-item]"),
    ];
    expect(items()[0]?.dataset.active).toBe("true");

    mounted.panel.value?.handlePanelKeydown("ArrowUp");
    await nextTick();
    expect(items()[1]?.dataset.active).toBe("true");

    mounted.panel.value?.handlePanelKeydown("ArrowDown");
    await nextTick();
    expect(items()[0]?.dataset.active).toBe("true");
    expect(scrollIntoView).toHaveBeenCalled();

    mounted.panel.value?.handlePanelKeydown("Enter");
    expect(mounted.onSelect).toHaveBeenCalledWith(skills[0]);

    mounted.currentQuery.value = "documentation";
    await nextTick();
    expect(items()).toHaveLength(1);
    expect(items()[0]?.textContent).toContain("write-docs");
    expect(items()[0]?.dataset.active).toBe("true");
  });

  it("clears the active option when filtering has no matches", async () => {
    getSkillList.mockResolvedValueOnce({
      skills: [
        {
          name: "review",
          description: "Inspect changes",
          filePath: "/skills/review/SKILL.md",
        },
      ],
    });
    const mounted = mountPanel("missing");

    await vi.waitFor(() => expect(mounted.container.textContent).toContain("没有匹配的 skill"));
    mounted.panel.value?.handlePanelKeydown("Enter");

    expect(mounted.onSelect).not.toHaveBeenCalled();
    expect(mounted.container.querySelector("[role=listbox]")).toBeNull();
  });
});
