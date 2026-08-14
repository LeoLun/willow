import planModePrompt from "./plan-mode.md?raw";

export function getPlanModePrompt(planDirectory: string): string {
  return planModePrompt.replace("{{PLAN_DIRECTORY}}", planDirectory);
}
