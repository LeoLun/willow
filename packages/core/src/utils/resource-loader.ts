import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { loadSkills, type Skill } from "@earendil-works/pi-agent-core";
import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { getSystemPrompt } from "../prompt/system";
import type { AgentsFile } from "../types";

export class DefaultResourceLoader {
  private cwd: string;
  private agentDir: string;
  private skills: Skill[];
  private agentsFiles: AgentsFile[];
  private systemPrompt: string;
  private isInit: boolean = false;
  private env: ExecutionEnv;

  constructor(options: { cwd: string; agentDir: string; env: ExecutionEnv }) {
    this.cwd = options.cwd;
    this.agentDir = options.agentDir;
    this.skills = [];
    this.agentsFiles = [];
    this.systemPrompt = "";
    this.env = options.env;
  }

  async reload() {
    await Promise.all([this.loadSkills(), this.loadAgentFiles()]);
    this.systemPrompt = getSystemPrompt({
      cwd: this.cwd,
      skills: this.skills,
      agentsFiles: this.agentsFiles,
      roleAdditional: "",
    });
    this.isInit = true;
    return {
      skills: this.skills,
      agentsFiles: this.agentsFiles,
      systemPrompt: this.systemPrompt,
    };
  }

  private async loadSkills() {
    const globalAgentDir = isAbsolute(this.agentDir)
      ? this.agentDir
      : join(homedir(), this.agentDir);
    const agentDirName = basename(this.agentDir);
    const workspaceWillowAgentDir = isAbsolute(this.agentDir)
      ? join(this.cwd, agentDirName.startsWith(".") ? agentDirName : `.${agentDirName}`)
      : join(this.cwd, this.agentDir);

    const workspaceAgentDir = join(this.cwd, ".agents");

    const { skills } = await loadSkills(this.env, [
      join(globalAgentDir, "skills"),
      join(workspaceWillowAgentDir, "skills"),
      join(workspaceAgentDir, "skills"),
    ]);
    this.skills = skills;
  }

  private async loadAgentFiles() {
    const candidateGroups = [
      ["AGENTS.md", "AGENTS.MD"],
      ["CLAUDE.md", "CLAUDE.MD"],
    ];
    const root = await this.findRepositoryRoot();
    const directories = this.directoriesFromRoot(root, resolve(this.cwd));
    const files: AgentsFile[] = [];

    for (const directory of directories) {
      for (const candidates of candidateGroups) {
        for (const candidate of candidates) {
          const path = join(directory, candidate);
          const result = await this.env.readTextFile(path);
          if (result.ok) {
            files.push({ path, content: result.value });
            break;
          }
          if (result.error.code !== "not_found") {
            throw result.error;
          }
        }
      }
    }

    this.agentsFiles = files;
  }

  private async findRepositoryRoot(): Promise<string> {
    const result = await this.env.exec("git rev-parse --show-toplevel", {
      cwd: this.cwd,
    });
    if (!result.ok || result.value.exitCode !== 0) {
      return resolve(this.cwd);
    }

    const root = result.value.stdout.trim();
    return root ? resolve(root) : resolve(this.cwd);
  }

  private directoriesFromRoot(root: string, cwd: string): string[] {
    const pathFromRoot = relative(root, cwd);
    if (pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..")) {
      const directories = [root];
      if (pathFromRoot) {
        let current = root;
        for (const segment of pathFromRoot.split(sep)) {
          current = join(current, segment);
          directories.push(current);
        }
      }
      return directories;
    }

    return [cwd];
  }
  async getAgentsFiles() {
    if (!this.isInit) {
      await this.reload();
    }
    return this.agentsFiles;
  }

  async getSkills() {
    if (!this.isInit) {
      await this.reload();
    }
    return this.skills;
  }

  async reloadSkills() {
    await this.loadSkills();
    return this.skills;
  }

  async getSystemPrompt() {
    if (!this.isInit) {
      await this.reload();
    }
    return this.systemPrompt;
  }
}
