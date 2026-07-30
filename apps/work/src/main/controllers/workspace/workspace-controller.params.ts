export function checkWorkspaceId(request: { workspaceId: number } | undefined): Error | undefined {
  if (!request || !Number.isInteger(request.workspaceId) || request.workspaceId <= 0) {
    return new Error("workspaceId must be a positive integer");
  }
  return undefined;
}
