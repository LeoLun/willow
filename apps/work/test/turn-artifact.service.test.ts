import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { describe, expect, it, vi } from "vitest";
import type { SessionService } from "../src/main/service/session.service";
import {
  TURN_ARTIFACT_ENTRY,
  TurnArtifactService,
} from "../src/main/service/turn-artifact.service";

describe("TurnArtifactService", () => {
  it("collects successful write and edit results without observing unrelated changes", async () => {
    const appendCustomEntry = vi.fn(async () => "artifact-entry");
    const service = new TurnArtifactService({ appendCustomEntry } as unknown as SessionService);
    const capture = service.begin(1, "session", []);
    capture.recordMessage({
      role: "toolResult",
      toolCallId: "write-added",
      toolName: "write",
      content: [],
      details: {
        kind: "write",
        path: "added.txt",
        created: true,
        addedLines: 2,
        removedLines: 0,
      },
    });
    capture.recordMessage({
      role: "toolResult",
      toolCallId: "edit-existing",
      toolName: "edit",
      content: [],
      details: {
        kind: "edit",
        path: "existing.txt",
        addedLines: 3,
        removedLines: 1,
      },
    });
    capture.recordMessage({
      role: "toolResult",
      toolCallId: "failed-write",
      toolName: "write",
      isError: true,
      content: [],
      details: {
        kind: "write",
        path: "failed.txt",
        created: true,
        addedLines: 1,
        removedLines: 0,
      },
    });

    const artifact = await capture.complete(42);
    expect(artifact?.files).toEqual([
      { path: "added.txt", status: "added", additions: 2, deletions: 0 },
      { path: "existing.txt", status: "modified", additions: 3, deletions: 1 },
    ]);
    expect(appendCustomEntry).toHaveBeenCalledWith(1, "session", TURN_ARTIFACT_ENTRY, artifact);
  });

  it("merges repeated write and edit operations and excludes earlier branch results", async () => {
    const service = new TurnArtifactService({
      appendCustomEntry: vi.fn(async () => "artifact-entry"),
    } as unknown as SessionService);
    const branch = [
      {
        type: "message",
        message: {
          role: "toolResult",
          toolCallId: "previous-write",
          toolName: "write",
          content: [],
          details: {},
          timestamp: 1,
        },
      },
    ] as SessionTreeEntry[];
    const capture = service.begin(1, "session", branch);
    for (const message of [
      {
        role: "toolResult",
        toolCallId: "previous-write",
        toolName: "write",
        content: [],
        details: {
          kind: "write",
          path: "ignored.txt",
          created: true,
          addedLines: 1,
          removedLines: 0,
        },
      },
      {
        role: "toolResult",
        toolCallId: "current-write",
        toolName: "write",
        content: [],
        details: {
          kind: "write",
          path: "combined.txt",
          created: true,
          addedLines: 2,
          removedLines: 0,
        },
      },
      {
        role: "toolResult",
        toolCallId: "current-edit",
        toolName: "edit",
        content: [],
        details: {
          kind: "edit",
          path: "combined.txt",
          addedLines: 1,
          removedLines: 2,
        },
      },
    ]) {
      capture.recordMessage(message);
    }

    const artifact = await capture.complete(43);
    expect(artifact?.files).toEqual([
      { path: "combined.txt", status: "added", additions: 3, deletions: 2 },
    ]);
  });

  it("pairs successful writePlan messages and restores persisted artifacts", async () => {
    const appendCustomEntry = vi.fn(async () => "artifact-entry");
    const service = new TurnArtifactService({ appendCustomEntry } as unknown as SessionService);
    const capture = service.begin(1, "session", []);
    capture.recordMessage({
      role: "assistant",
      timestamp: 10,
      content: [
        {
          type: "toolCall",
          id: "plan-call",
          name: "writePlan",
          arguments: { name: "feature", content: "# Complete plan\n\nDetails" },
        },
      ],
    });
    capture.recordMessage({
      role: "toolResult",
      toolCallId: "plan-call",
      toolName: "writePlan",
      timestamp: 11,
      content: [],
      details: {
        kind: "writePlan",
        path: "/plans/feature.md",
        fileName: "feature.md",
        lineCount: 3,
        byteCount: 24,
      },
    });
    capture.recordMessage({ role: "assistant", timestamp: 12, content: [] });

    const artifact = await capture.complete();
    expect(artifact?.plans).toEqual([
      {
        byteCount: 24,
        content: "# Complete plan\n\nDetails",
        fileName: "feature.md",
        lineCount: 3,
        path: "/plans/feature.md",
      },
    ]);
    const branch = [
      {
        type: "custom",
        customType: TURN_ARTIFACT_ENTRY,
        data: artifact,
      },
    ] as SessionTreeEntry[];
    expect(service.getArtifacts(branch)).toEqual([artifact]);
  });

  it("captures updated plan content as a turn artifact", async () => {
    const service = new TurnArtifactService({
      appendCustomEntry: vi.fn(async () => "artifact-entry"),
    } as unknown as SessionService);
    const capture = service.begin(1, "session", []);
    capture.recordMessage({
      role: "assistant",
      timestamp: 20,
      content: [
        {
          type: "toolCall",
          id: "update-plan-call",
          name: "updatePlan",
          arguments: { fileName: "feature.md", content: "# Revised plan\n\nDetails" },
        },
      ],
    });
    capture.recordMessage({
      role: "toolResult",
      toolCallId: "update-plan-call",
      toolName: "updatePlan",
      timestamp: 21,
      content: [],
      details: {
        kind: "updatePlan",
        path: "/plans/feature.md",
        fileName: "feature.md",
        lineCount: 3,
        byteCount: 23,
      },
    });

    expect((await capture.complete(22))?.plans).toEqual([
      {
        byteCount: 23,
        content: "# Revised plan\n\nDetails",
        fileName: "feature.md",
        lineCount: 3,
        path: "/plans/feature.md",
      },
    ]);
  });
});
