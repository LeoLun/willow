import { FileText, GitPullRequest, Kanban, ScrollText } from "lucide-vue-next";
import BoardPanel from "./BoardPanel.vue";
import FilePanel from "./FilePanel.vue";
import PlanPanel from "./PlanPanel.vue";
import ReviewPanel from "./ReviewPanel.vue";
import type {
  RightSidebarPanelKind,
  RightSidebarPanelStateMap,
  RuntimeSidebarPanelDefinition,
  SidebarPanelDefinition,
} from "./types";

const panelDefinitions = {
  file: {
    kind: "file",
    label: "文件",
    icon: FileText,
    component: FilePanel,
    multiplicity: "multiple",
    entryPoints: { addMenu: true, emptyState: true },
    createState: () => ({}),
    getTitle: (state) => state.selectedFile?.name ?? "打开文件",
  } satisfies SidebarPanelDefinition<"file">,
  review: {
    kind: "review",
    label: "审阅",
    icon: GitPullRequest,
    component: ReviewPanel,
    multiplicity: "single",
    entryPoints: { addMenu: true, emptyState: true },
    createState: () => ({}),
    getTitle: () => "审阅",
  } satisfies SidebarPanelDefinition<"review">,
  plan: {
    kind: "plan",
    label: "Plan",
    icon: ScrollText,
    component: PlanPanel,
    multiplicity: "multiple",
    entryPoints: { addMenu: false, emptyState: false },
    createState: () => ({}),
    getTitle: (state) => state.plan?.fileName ?? "Plan",
  } satisfies SidebarPanelDefinition<"plan">,
  board: {
    kind: "board",
    label: "看板",
    icon: Kanban,
    component: BoardPanel,
    multiplicity: "single",
    entryPoints: { addMenu: true, emptyState: true },
    createState: () => ({}),
    getTitle: () => "看板",
  } satisfies SidebarPanelDefinition<"board">,
} satisfies {
  [Kind in RightSidebarPanelKind]: SidebarPanelDefinition<Kind>;
};

export const rightSidebarPanelDefinitions = [
  panelDefinitions.review,
  panelDefinitions.file,
  panelDefinitions.board,
  panelDefinitions.plan,
] as RuntimeSidebarPanelDefinition[];

export function getRightSidebarPanelDefinition<Kind extends RightSidebarPanelKind>(
  kind: Kind,
): SidebarPanelDefinition<Kind> {
  return panelDefinitions[kind] as unknown as SidebarPanelDefinition<Kind>;
}

export function getRightSidebarPanelTitle<Kind extends RightSidebarPanelKind>(
  kind: Kind,
  state: RightSidebarPanelStateMap[Kind],
): string {
  return getRightSidebarPanelDefinition(kind).getTitle(state);
}
