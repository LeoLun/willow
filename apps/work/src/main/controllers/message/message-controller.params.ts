type MessageSessionRequest = {
  workspaceId: number;
  sessionId: string;
};

export function checkMessageSessionParams(request: MessageSessionRequest): Error | undefined {
  if (!request || !Number.isInteger(request.workspaceId) || request.workspaceId <= 0) {
    return new Error("workspaceId must be a positive integer");
  }
  if (typeof request.sessionId !== "string" || request.sessionId.trim() === "") {
    return new Error("sessionId must be a non-empty string");
  }
  return undefined;
}
