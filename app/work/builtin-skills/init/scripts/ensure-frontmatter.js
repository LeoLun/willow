#!/usr/bin/env node

/**
 * ensure-frontmatter.js
 *
 * 确保 AGENTS.md 文件包含正确的 YAML frontmatter（name 和 description）。
 * 如果文件已有 frontmatter，则更新 name/description 字段；
 * 如果文件没有 frontmatter，则在文件头部插入。
 *
 * 用法：
 *   node ensure-frontmatter.js <agents-md-path> <name> <description>
 *
 * 示例：
 *   node ensure-frontmatter.js ./AGENTS.md "Willow 工作空间 Agent" "当任务属于 Willow 仓库范围时触发"
 */

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { resolve } = require("path");

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: null, body: content, raw: null };
  }
  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
    raw: match[0],
  };
}

function yamlQuote(value) {
  if (
    value.includes(":") ||
    value.includes("#") ||
    value.includes('"') ||
    value.includes("'") ||
    value.startsWith(" ") ||
    value.endsWith(" ")
  ) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `"${value}"`;
}

function setField(yaml, key, value) {
  const regex = new RegExp(`(?:^|\\r?\\n)(${key}\\s*:)[\\s\\S]*?(?=\\r?\\n\\S|$)`);
  if (regex.test(yaml)) {
    return yaml.replace(regex, (match, p1) => {
      const hasLeadingNewline = match.startsWith("\n") || match.startsWith("\r");
      const prefix = hasLeadingNewline ? (match.startsWith("\r") ? "\r\n" : "\n") : "";
      return `${prefix}${p1} ${yamlQuote(value)}`;
    });
  }
  return `${yaml.trimEnd()}\n${key}: ${yamlQuote(value)}`;
}

function buildFrontmatter(name, description) {
  return `---\nname: ${yamlQuote(name)}\ndescription: ${yamlQuote(description)}\n---\n`;
}

function run() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("用法: node ensure-frontmatter.js <agents-md-path> <name> <description>");
    process.exit(1);
  }

  const filePath = resolve(args[0]);
  const name = args[1];
  const description = args[2];

  if (!existsSync(filePath)) {
    const content = buildFrontmatter(name, description) + "\n";
    writeFileSync(filePath, content, "utf-8");
    console.log(`✅ 已创建 ${filePath}，并写入 frontmatter。`);
    return;
  }

  const content = readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  if (frontmatter === null) {
    const newContent = buildFrontmatter(name, description) + "\n" + content;
    writeFileSync(filePath, newContent, "utf-8");
    console.log(`✅ 已在 ${filePath} 头部插入 frontmatter。`);
    return;
  }

  let updated = frontmatter;
  updated = setField(updated, "name", name);
  updated = setField(updated, "description", description);

  if (updated === frontmatter) {
    console.log(`ℹ️  ${filePath} 的 frontmatter 已是最新，无需修改。`);
    return;
  }

  const newContent = `---\n${updated}\n---\n${body}`;
  writeFileSync(filePath, newContent, "utf-8");
  console.log(`✅ 已更新 ${filePath} 的 frontmatter。`);
}

run();
