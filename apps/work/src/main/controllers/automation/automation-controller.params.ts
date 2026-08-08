import type {
  AutomationStatus,
  AutomationTriggerType,
  CreateAutomationRequest,
  ModelConfig,
  UpdateAutomationRequest,
} from "@shared/api";

export function isValidPositiveId(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export function isAutomationStatus(value: unknown): value is AutomationStatus {
  return value === "enabled" || value === "disabled";
}

export function isTriggerType(value: unknown): value is AutomationTriggerType {
  return value === "schedule";
}

export function isModelConfig(value: unknown): value is ModelConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const model = value as Record<string, unknown>;
  return (
    typeof model.providerId === "string" &&
    model.providerId.trim() !== "" &&
    typeof model.modelId === "string" &&
    model.modelId.trim() !== ""
  );
}

export function validateTriggerInput(value: unknown): Error | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Error("trigger must be an object");
  }
  const trigger = value as Record<string, unknown>;
  if (!isTriggerType(trigger.type)) {
    return new Error('trigger.type must be "schedule"');
  }
  if (typeof trigger.cronExpression !== "string" || trigger.cronExpression.trim() === "") {
    return new Error("trigger.cronExpression must be a non-empty string");
  }
  if (typeof trigger.timezone !== "string" || trigger.timezone.trim() === "") {
    return new Error("trigger.timezone must be a non-empty string");
  }
  if (trigger.isActive !== undefined && typeof trigger.isActive !== "boolean") {
    return new Error("trigger.isActive must be a boolean");
  }
  return undefined;
}

export function validatePartialTriggerInput(value: unknown): Error | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Error("trigger must be an object");
  }
  const trigger = value as Record<string, unknown>;
  if (trigger.type !== undefined && !isTriggerType(trigger.type)) {
    return new Error('trigger.type must be "schedule"');
  }
  if (
    trigger.cronExpression !== undefined &&
    (typeof trigger.cronExpression !== "string" || trigger.cronExpression.trim() === "")
  ) {
    return new Error("trigger.cronExpression must be a non-empty string");
  }
  if (
    trigger.timezone !== undefined &&
    (typeof trigger.timezone !== "string" || trigger.timezone.trim() === "")
  ) {
    return new Error("trigger.timezone must be a non-empty string");
  }
  if (trigger.isActive !== undefined && typeof trigger.isActive !== "boolean") {
    return new Error("trigger.isActive must be a boolean");
  }
  return undefined;
}

export function validateCreateAutomationRequest(request: unknown): Error | undefined {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return new Error("request must be an object");
  }
  const value = request as Partial<CreateAutomationRequest>;
  if (!isValidPositiveId(value.workspaceId)) {
    return new Error("workspaceId must be a positive integer");
  }
  if (value.title !== undefined && typeof value.title !== "string") {
    return new Error("title must be a string");
  }
  if (typeof value.prompt !== "string" || value.prompt.trim() === "") {
    return new Error("prompt must be a non-empty string");
  }
  if (value.status !== undefined && !isAutomationStatus(value.status)) {
    return new Error('status must be "enabled" or "disabled"');
  }
  if (value.model !== undefined && !isModelConfig(value.model)) {
    return new Error("model must include non-empty providerId and modelId");
  }
  return validateTriggerInput(value.trigger);
}

export function validateUpdateAutomationRequest(request: unknown): Error | undefined {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return new Error("request must be an object");
  }
  const value = request as Partial<UpdateAutomationRequest>;
  if (!isValidPositiveId(value.id)) {
    return new Error("id must be a positive integer");
  }
  if (value.workspaceId !== undefined && !isValidPositiveId(value.workspaceId)) {
    return new Error("workspaceId must be a positive integer");
  }
  if (value.title !== undefined && typeof value.title !== "string") {
    return new Error("title must be a string");
  }
  if (
    value.prompt !== undefined &&
    (typeof value.prompt !== "string" || value.prompt.trim() === "")
  ) {
    return new Error("prompt must be a non-empty string");
  }
  if (value.status !== undefined && !isAutomationStatus(value.status)) {
    return new Error('status must be "enabled" or "disabled"');
  }
  if (value.model !== undefined && value.model !== null && !isModelConfig(value.model)) {
    return new Error("model must include non-empty providerId and modelId or be null");
  }
  if (value.trigger !== undefined) {
    return validatePartialTriggerInput(value.trigger);
  }
  return undefined;
}
