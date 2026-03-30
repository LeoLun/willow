import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Component } from "vue";

export type MessageRole = AgentMessage["role"];

export interface MessageRenderer<TMessage extends AgentMessage = AgentMessage> {
  component: Component;
  props?: (message: TMessage) => Record<string, any>;
}

const messageRenderers = new Map<MessageRole, MessageRenderer<any>>();

export function registerMessageRenderer<TRole extends MessageRole>(
  role: TRole,
  renderer: MessageRenderer<Extract<AgentMessage, { role: TRole }>>,
): void {
  messageRenderers.set(role, renderer);
}

export function getMessageRenderer(role: MessageRole): MessageRenderer | undefined {
  return messageRenderers.get(role);
}

export function renderMessage(
  message: AgentMessage,
): { component: Component; props: Record<string, any> } | undefined {
  const renderer = messageRenderers.get(message.role);
  if (!renderer) return undefined;
  return {
    component: renderer.component,
    props: renderer.props ? renderer.props(message) : { message },
  };
}
