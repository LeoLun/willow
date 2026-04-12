import type { Component } from "vue";

export interface DemoDefinition {
  id: string;
  title: string;
  description: string;
  group: string;
  component: Component;
}
