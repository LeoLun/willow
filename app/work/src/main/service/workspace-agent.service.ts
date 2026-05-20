import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import type { GetWorkspaceAgentsResponse, WorkspaceAgentSummary } from "@shared/api";
import { parseFrontmatter } from "@willow/core";
import { Injectable } from "@willow/poetry";

type AgentsFrontmatter = Record<string, unknown> & {
  name?: string;
  description?: string;
};

type ProjectWorkspace = {
  id: number;
  name: string;
  path: string;
};

@Injectable()
export class WorkspaceAgentService {
  constructor(private readonly workspaceDao: WorkspaceDao) {}

  async getWorkspaceAgents(): Promise<GetWorkspaceAgentsResponse> {
    const workspaces = this.workspaceDao.findByKind("project");
    const agents = await Promise.all(
      workspaces.map((workspace) => this.readWorkspaceAgent(workspace)),
    );
    return { agents };
  }

  async readWorkspaceAgent(workspace: ProjectWorkspace): Promise<WorkspaceAgentSummary> {
    const fallback = this.createUnavailableSummary(workspace);

    try {
      const content = await readFile(join(workspace.path, "AGENTS.md"), "utf8");
      const { frontmatter } = parseFrontmatter<AgentsFrontmatter>(content);
      const agentName = frontmatter.name?.trim() ?? "";
      const agentDescription = frontmatter.description?.trim() ?? "";

      if (!agentName || !agentDescription) {
        return fallback;
      }

      return {
        ...fallback,
        agentName,
        agentDescription,
        available: true,
      };
    } catch {
      return fallback;
    }
  }

  private createUnavailableSummary(workspace: ProjectWorkspace): WorkspaceAgentSummary {
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspacePath: workspace.path,
      agentName: "",
      agentDescription: "",
      available: false,
    };
  }
}
