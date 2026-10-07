import type { MemoryFileRequest } from "@shared/api";

export function checkMemoryRequest(request: MemoryFileRequest): Error | undefined {
  if (!request || typeof request !== "object" || Array.isArray(request))
    return new Error("Invalid memory request");
  if (Object.keys(request).some((key) => key !== "scope" && key !== "workspaceId"))
    return new Error("Unexpected memory request field");
  if (request.scope === "global")
    return request.workspaceId === undefined
      ? undefined
      : new Error("Global memory does not accept workspaceId");
  if (
    request.scope !== "project" ||
    !Number.isSafeInteger(request.workspaceId) ||
    request.workspaceId <= 0
  )
    return new Error("Project memory requires a positive workspaceId");
  return undefined;
}
