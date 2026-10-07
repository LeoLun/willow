export type MemoryScope = "global" | "project";

export interface MemorySection {
  name: string;
  content: string;
}

export interface MemoryDocument {
  preamble: string;
  sections: MemorySection[];
}

export interface MemoryOptions {
  cwd: string;
  projectTrusted?: boolean;
}

export interface MemoryConfig {
  enabled: boolean;
  maxGlobalMemoryBytes: number;
  maxProjectMemoryBytes: number;
}

export interface ResolvedMemoryConfig extends MemoryConfig {
  projectEnabled: boolean;
  errors: Partial<Record<MemoryScope, string>>;
}

export interface MemorySnapshot {
  scope: MemoryScope;
  path: string;
  exists: boolean;
  content: string;
  byteCount: number;
  maxBytes: number;
  enabled: boolean;
  error?: string;
}

export interface MemoryUpdateInput {
  scope: MemoryScope;
  section: string;
  oldText?: string;
  newText: string;
}

export interface MemoryUpdateResult {
  scope: MemoryScope;
  path: string;
  byteCount: number;
  changed: boolean;
}
