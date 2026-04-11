import type { AutomationScheduleMode } from "@shared/api";
import type { Component } from "vue";

export interface AutomationTemplatePresetInput {
  title: string;
  prompt: string;
  scheduleMode: AutomationScheduleMode;
  cronExpression: string;
  dailyTime?: string;
  weeklyTime?: string;
  weeklyDays?: string[];
  customCronExpression?: string;
}

export interface AutomationTemplatePreset {
  id: string;
  title: string;
  description: string;
  icon: Component;
  iconClass: string;
  preset: AutomationTemplatePresetInput;
}
