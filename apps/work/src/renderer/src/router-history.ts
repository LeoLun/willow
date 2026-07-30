export function getRendererHistoryMode(protocol: string): "hash" | "web" {
  return protocol === "file:" ? "hash" : "web";
}
