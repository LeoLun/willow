import { existsSync, readdirSync, readFileSync, realpathSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join, resolve } from "path";
import { parseFrontmatter } from "./utils/frontmatter";

const WILLOW_CONFIG_DIR = ".agents";

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  "disable-model-invocation"?: boolean;
  [key: string]: unknown;
}

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  disableModelInvocation: boolean;
}

export interface LoadSkillsResult {
  skills: Skill[];
  warnings: string[];
  userDir: string;
  projectDir: string;
  builtinDir?: string;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

function loadSkillFromFile(filePath: string): {
  skill: Skill | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  try {
    const raw = readFileSync(filePath, "utf-8");
    const { frontmatter } = parseFrontmatter<SkillFrontmatter>(raw);
    const skillDir = dirname(filePath);
    const parentDirName = basename(skillDir);

    if (!frontmatter.description?.trim()) {
      warnings.push(`${filePath}: frontmatter 缺少 description`);
      return { skill: null, warnings };
    }

    const name = (frontmatter.name || parentDirName).trim();
    if (!name) {
      warnings.push(`${filePath}: 无法确定技能名称`);
      return { skill: null, warnings };
    }

    return {
      skill: {
        name,
        description: frontmatter.description.trim(),
        filePath: resolve(filePath),
        baseDir: skillDir,
        disableModelInvocation: frontmatter["disable-model-invocation"] === true,
      },
      warnings,
    };
  } catch (e: any) {
    warnings.push(`${filePath}: ${e?.message ?? e}`);
    return { skill: null, warnings };
  }
}

/** 递归查找所有名为 SKILL.md 的文件（简化版；pi 的规则更细，见 loadSkillsFromDirInternal） */
function collectSkillMdFiles(rootDir: string, out: string[] = []): string[] {
  if (!existsSync(rootDir)) return out;
  for (const ent of readdirSync(rootDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = join(rootDir, ent.name);
    if (ent.isDirectory()) {
      collectSkillMdFiles(full, out);
    } else if (ent.name === "SKILL.md") {
      out.push(full);
    }
  }
  return out;
}

function mergeByName(
  userBatch: Skill[],
  projectBatch: Skill[],
  builtinBatch: Skill[],
  warnings: string[],
): Skill[] {
  const map = new Map<string, Skill>();
  const realPaths = new Set<string>();

  const add = (s: Skill, silent = false) => {
    let real: string;
    try {
      real = realpathSync(s.filePath);
    } catch {
      real = s.filePath;
    }
    if (realPaths.has(real)) return;
    const existing = map.get(s.name);
    if (existing) {
      if (!silent) {
        warnings.push(`技能名称「${s.name}」冲突；保留 ${existing.filePath}，忽略 ${s.filePath}`);
      }
      return;
    }
    map.set(s.name, s);
    realPaths.add(real);
  };

  for (const s of userBatch) add(s);
  for (const s of projectBatch) add(s);
  for (const s of builtinBatch) add(s, true);
  return [...map.values()];
}

export function loadSkills(options: {
  cwd: string;
  userData?: string;
  agentDir?: string;
  builtinDir?: string;
}): LoadSkillsResult {
  const cwd = options.cwd;
  let agentDir: string;
  const warnings: string[] = [];
  if (options.userData) {
    agentDir = join(options.userData, WILLOW_CONFIG_DIR);
  } else if (options.agentDir) {
    agentDir = options.agentDir;
  } else {
    agentDir = join(homedir(), WILLOW_CONFIG_DIR);
  }
  const userDir = join(agentDir, "skills");
  const projectDir = join(cwd, WILLOW_CONFIG_DIR, "skills");
  const userSkills: Skill[] = [];
  for (const f of collectSkillMdFiles(userDir)) {
    if (f === join(userDir, "init", "SKILL.md")) {
      continue;
    }
    const r = loadSkillFromFile(f);
    warnings.push(...r.warnings);
    if (r.skill) userSkills.push(r.skill);
  }

  const projectSkills: Skill[] = [];
  for (const f of collectSkillMdFiles(projectDir)) {
    const r = loadSkillFromFile(f);
    warnings.push(...r.warnings);
    if (r.skill) projectSkills.push(r.skill);
  }

  const builtinSkills: Skill[] = [];
  if (options.builtinDir && existsSync(options.builtinDir)) {
    for (const f of collectSkillMdFiles(options.builtinDir)) {
      const r = loadSkillFromFile(f);
      warnings.push(...r.warnings);
      if (r.skill) builtinSkills.push(r.skill);
    }
  }

  const skills = mergeByName(userSkills, projectSkills, builtinSkills, warnings);
  return {
    skills,
    warnings,
    userDir,
    projectDir,
    builtinDir: options.builtinDir,
  };
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  const visible = skills.filter((s) => !s.disableModelInvocation);
  if (visible.length === 0) return "";

  const lines = [
    "\n\n以下技能针对特定任务提供专门说明。",
    "当任务与某条 description 相符时，使用 read 工具加载该技能文件。",
    "若技能文件中引用相对路径，请相对于该技能目录（SKILL.md 所在目录）解析，并在工具调用中使用该路径。",
    "",
    "<available_skills>",
  ];

  for (const s of visible) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(s.name)}</name>`);
    lines.push(`    <description>${escapeXml(s.description)}</description>`);
    lines.push(`    <location>${escapeXml(s.filePath)}</location>`);
    lines.push("  </skill>");
  }
  lines.push("</available_skills>");
  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
