import type { McpToolSummary, Tool } from "./types.js";

function normalize(text: string): string {
  return text
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

export function rankMcpTools(
  query: string,
  entries: { serverName: string; tools: Tool[]; cached: boolean }[],
): McpToolSummary[] {
  const normalized = query.trim() === "*" ? "" : normalize(query.trim());
  const terms = normalized.split(/\s+/).filter(Boolean);
  return entries
    .flatMap(({ serverName, tools, cached }) =>
      tools.map((tool) => {
        const name = normalize(tool.name);
        const description = normalize(tool.description ?? "");
        const params = normalize(JSON.stringify(tool.inputSchema));
        const server = normalize(serverName);
        let score = name === normalized ? 1000 : normalized && name.includes(normalized) ? 300 : 0;
        for (const term of terms)
          score +=
            (name.includes(term) ? 100 : 0) +
            (description.includes(term) ? 30 : 0) +
            (server.includes(term) ? 20 : 0) +
            (params.includes(term) ? 5 : 0);
        return {
          score,
          serverName,
          toolName: tool.name,
          description: (tool.description ?? "").slice(0, 500),
          cached,
        };
      }),
    )
    .filter((x) => !terms.length || x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.serverName.localeCompare(b.serverName) ||
        a.toolName.localeCompare(b.toolName),
    )
    .map(({ score: _score, ...entry }) => entry);
}
