import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { throwIfAborted, withMutationQueue } from "../tools/shared.js";
import { resolveMemoryConfig } from "./config.js";
import {
  createDefaultMemory,
  parseMemoryDocument,
  serializeMemoryDocument,
  validateMemoryUpdate,
} from "./markdown.js";
import { authorizeMemoryPath, getMemoryPath, isMissingFile } from "./paths.js";
import type {
  MemoryOptions,
  MemoryScope,
  MemorySnapshot,
  MemoryUpdateInput,
  MemoryUpdateResult,
} from "./types.js";

async function readContent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

export async function readMemory(
  options: MemoryOptions,
  scope: MemoryScope,
): Promise<MemorySnapshot> {
  const config = await resolveMemoryConfig(options);
  const snapshot: MemorySnapshot = {
    scope,
    path: getMemoryPath(options, scope),
    exists: false,
    content: "",
    byteCount: 0,
    maxBytes: scope === "global" ? config.maxGlobalMemoryBytes : config.maxProjectMemoryBytes,
    enabled: scope === "global" ? config.enabled : config.projectEnabled,
    error: config.errors[scope] ?? config.errors.global,
  };
  try {
    const path = await authorizeMemoryPath(options, scope);
    const content = await readContent(path);
    snapshot.exists = content !== undefined;
    snapshot.content = content ?? "";
    snapshot.byteCount = Buffer.byteLength(snapshot.content);
    if (snapshot.byteCount > snapshot.maxBytes)
      snapshot.error ??= "Memory exceeds capacity; condense it before recall or further updates.";
  } catch (error) {
    snapshot.error ??= String(error);
  }
  return snapshot;
}

async function atomicWrite(
  options: MemoryOptions,
  scope: MemoryScope,
  text: string,
  signal?: AbortSignal,
  config = false,
): Promise<void> {
  const path = await authorizeMemoryPath(options, scope, config);
  throwIfAborted(signal);
  await mkdir(dirname(path), { recursive: true });
  await authorizeMemoryPath(options, scope, config);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(text, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    throwIfAborted(signal);
    await authorizeMemoryPath(options, scope, config);
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error: unknown) => {
      if (!isMissingFile(error)) throw error;
    });
  }
}

export async function ensureMemoryFile(
  options: MemoryOptions,
  scope: MemoryScope,
): Promise<string> {
  const path = await authorizeMemoryPath(options, scope);
  return withMutationQueue(path, async () => {
    await authorizeMemoryPath(options, scope);
    if ((await readContent(path)) === undefined)
      await atomicWrite(options, scope, createDefaultMemory(scope));
    return path;
  });
}

export async function updateMemory(
  options: MemoryOptions,
  input: MemoryUpdateInput,
  signal?: AbortSignal,
): Promise<MemoryUpdateResult> {
  validateMemoryUpdate(input);
  const path = await authorizeMemoryPath(options, input.scope);
  return withMutationQueue(path, async () => {
    throwIfAborted(signal);
    const config = await resolveMemoryConfig(options);
    if (!(input.scope === "global" ? config.enabled : config.projectEnabled))
      throw new Error(config.errors[input.scope] ?? config.errors.global ?? "Memory is disabled");
    await authorizeMemoryPath(options, input.scope);
    const original = (await readContent(path)) ?? createDefaultMemory(input.scope);
    const document = parseMemoryDocument(original);
    let section = document.sections.find((section) => section.name === input.section);
    if (input.oldText !== undefined) {
      const offset = section?.content.indexOf(input.oldText) ?? -1;
      if (!section || offset < 0 || section.content.indexOf(input.oldText, offset + 1) >= 0)
        throw new Error("oldText must match exactly once in the specified section");
      section.content =
        section.content.slice(0, offset) +
        input.newText +
        section.content.slice(offset + input.oldText.length);
    } else {
      if (section?.content.includes(input.newText))
        return { scope: input.scope, path, byteCount: Buffer.byteLength(original), changed: false };
      if (!section) {
        section = { name: input.section, content: "\n" };
        document.sections.push(section);
      }
      const newline = original.includes("\r\n") ? "\r\n" : "\n";
      section.content =
        section.content.replace(/(?:\r?\n)*$/, "") + newline + input.newText + newline + newline;
    }
    const text = serializeMemoryDocument(document);
    const parsed = parseMemoryDocument(text);
    if (
      parsed.sections.length !== document.sections.length ||
      parsed.sections.some((section, index) => section.name !== document.sections[index]?.name)
    )
      throw new Error("Memory update must not introduce or remove section headings");
    const byteCount = Buffer.byteLength(text);
    const maxBytes =
      input.scope === "global" ? config.maxGlobalMemoryBytes : config.maxProjectMemoryBytes;
    if (byteCount > maxBytes)
      throw new Error(
        "Memory capacity exceeded. Condense or replace older memory before adding new memory.",
      );
    if (text !== original) await atomicWrite(options, input.scope, text, signal);
    return { scope: input.scope, path, byteCount, changed: text !== original };
  });
}

/** Save an explicitly edited document without overwriting concurrent agent updates. */
export async function saveMemory(
  options: MemoryOptions,
  scope: MemoryScope,
  content: string,
  expectedContent: string | null,
): Promise<MemoryUpdateResult> {
  if (
    typeof content !== "string" ||
    (expectedContent !== null && typeof expectedContent !== "string")
  )
    throw new Error("Invalid memory document");
  parseMemoryDocument(content);
  const path = await authorizeMemoryPath(options, scope);
  return withMutationQueue(path, async () => {
    const config = await resolveMemoryConfig(options);
    const configError = config.errors[scope] ?? config.errors.global;
    if (configError) throw new Error(configError);
    await authorizeMemoryPath(options, scope);
    const original = await readContent(path);
    if ((original ?? null) !== expectedContent)
      throw new Error("记忆已被更新，请取消编辑并重新加载后再保存。");
    const byteCount = Buffer.byteLength(content, "utf8");
    const maxBytes =
      scope === "global" ? config.maxGlobalMemoryBytes : config.maxProjectMemoryBytes;
    if (byteCount > maxBytes) throw new Error("记忆超出容量限制，请精简内容后再保存。");
    if (content !== original) await atomicWrite(options, scope, content);
    return { scope, path, byteCount, changed: content !== original };
  });
}

/** Global master switch. Preserve capacities and unknown configuration fields. */
export async function setMemoryEnabled(options: MemoryOptions, enabled: boolean): Promise<void> {
  if (typeof enabled !== "boolean") throw new Error("Memory enabled must be boolean");
  const globalOptions = { cwd: options.cwd };
  const path = await authorizeMemoryPath(globalOptions, "global", true);
  await withMutationQueue(path, async () => {
    const config = await resolveMemoryConfig(globalOptions);
    if (config.errors.global) throw new Error(config.errors.global);
    await authorizeMemoryPath(globalOptions, "global", true);
    const original = await readContent(path);
    const value = original === undefined ? {} : JSON.parse(original);
    await atomicWrite(
      globalOptions,
      "global",
      JSON.stringify({ ...value, enabled }, null, 2) + "\n",
      undefined,
      true,
    );
  });
}
