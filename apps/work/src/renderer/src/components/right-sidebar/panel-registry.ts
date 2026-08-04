import { FileText, GitPullRequest } from "lucide-vue-next";
import FilePanel from "./FilePanel.vue";
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
    label: "审阅(Demo)",
    icon: GitPullRequest,
    component: ReviewPanel,
    multiplicity: "single",
    entryPoints: { addMenu: true, emptyState: true },
    createState: () => ({ selectedChangeId: "right-sidebar" }),
    getTitle: () => "审阅",
  } satisfies SidebarPanelDefinition<"review">,
} satisfies {
  [Kind in RightSidebarPanelKind]: SidebarPanelDefinition<Kind>;
};

export const rightSidebarPanelDefinitions = [
  panelDefinitions.review,
  panelDefinitions.file,
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
