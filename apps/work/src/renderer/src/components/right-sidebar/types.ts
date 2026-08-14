import type { TurnPlanArtifact } from "@shared/api";
import type { Component } from "vue";

export type BoardPanelState = Record<string, never>;

export interface FilePanelState {
  selectedFile?: {
    id: string;
    name: string;
    path: string;
  };
}

export interface ReviewPanelState {
  selectedChange?: {
    area: "staged" | "unstaged";
    path: string;
  };
}

export interface PlanPanelState {
  plan?: TurnPlanArtifact;
}

export interface RightSidebarPanelStateMap {
  board: BoardPanelState;
  file: FilePanelState;
  plan: PlanPanelState;
  review: ReviewPanelState;
}

export type RightSidebarPanelKind = keyof RightSidebarPanelStateMap;
export type RightSidebarPanelState = RightSidebarPanelStateMap[RightSidebarPanelKind];

export type RightSidebarTab = {
  [Kind in RightSidebarPanelKind]: {
    id: string;
    kind: Kind;
    state: RightSidebarPanelStateMap[Kind];
  };
}[RightSidebarPanelKind];

export interface SidebarPanelContext {
  workspaceId?: number;
}

export interface SidebarPanelDefinition<Kind extends RightSidebarPanelKind> {
  kind: Kind;
  label: string;
  icon: Component;
  component: Component;
  multiplicity: "single" | "multiple";
  entryPoints: {
    addMenu: boolean;
    emptyState: boolean;
  };
  createState(context: SidebarPanelContext): RightSidebarPanelStateMap[Kind];
  getTitle(state: RightSidebarPanelStateMap[Kind]): string;
  isAvailable?(context: SidebarPanelContext): boolean;
}

export interface RuntimeSidebarPanelDefinition {
  kind: RightSidebarPanelKind;
  label: string;
  icon: Component;
  component: Component;
  multiplicity: "single" | "multiple";
  entryPoints: {
    addMenu: boolean;
    emptyState: boolean;
  };
  createState(context: SidebarPanelContext): RightSidebarPanelState;
  getTitle(state: RightSidebarPanelState): string;
  isAvailable?(context: SidebarPanelContext): boolean;
}

export interface RightSidebarHandle {
  openPlan(plan: TurnPlanArtifact): void;
}
