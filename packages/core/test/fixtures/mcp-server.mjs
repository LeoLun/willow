import { createInterface } from "node:readline";

const tools = [
  {
    name: "take_screenshot",
    description: "Take a screenshot 截图",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
      additionalProperties: false,
    },
  },
];
createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result = {};
  if (request.method === "initialize")
    result = {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: "test", version: "1" },
    };
  if (request.method === "tools/list") result = { tools };
  if (request.method === "tools/call") {
    const message = request.params.arguments.message;
    if (message === "hang") return;
    result = {
      content: [
        {
          type: "text",
          text:
            message === "env"
              ? JSON.stringify({
                  secret: process.env.OPENAI_API_KEY ?? null,
                  explicit: process.env.MCP_EXPLICIT ?? null,
                })
              : message,
        },
      ],
      isError: message === "error",
    };
  }
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n");
});
