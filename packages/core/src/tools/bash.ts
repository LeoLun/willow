import { spawn } from "child_process";
import { existsSync } from "fs";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

export interface BashToolDetails {
  cwd: string;
  command: string;
  exitCode: number | null;
  timedOut: boolean;
  outputTruncated: boolean;
  /** 截断前原始合并输出的大致字节数（若未截断可与输出一致） */
  rawOutputBytes: number;
}

const MAX_OUTPUT = 256 * 1024;

const bashSchema = Type.Object({
  command: Type.String({ description: "要执行的 Bash 命令" }),
  timeout: Type.Optional(Type.Number({ description: "超时时间（秒）" })),
});

export function createBashTool(cwd: string): AgentTool<typeof bashSchema> {
  return {
    name: "bash",
    label: "执行命令",
    description: "在工作目录中执行 bash 命令。返回合并后的 stdout 与 stderr。",
    parameters: bashSchema,
    async execute(_toolCallId, params, signal) {
      const { command, timeout } = params;
      if (!existsSync(cwd)) {
        throw new Error(`工作目录不存在：${cwd}`);
      }

      return new Promise((resolve, reject) => {
        let output = "";
        let timedOut = false;

        const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
        const args = process.platform === "win32" ? ["/c", command] : ["-c", command];

        const child = spawn(shell, args, {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        });

        let timeoutHandle: NodeJS.Timeout | undefined;
        if (timeout && timeout > 0) {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, timeout * 1000);
        }

        const onAbort = () => child.kill("SIGTERM");
        signal?.addEventListener("abort", onAbort, { once: true });

        child.stdout?.on("data", (data: Buffer) => {
          output += data.toString();
        });
        child.stderr?.on("data", (data: Buffer) => {
          output += data.toString();
        });

        child.on("close", (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          signal?.removeEventListener("abort", onAbort);

          if (signal?.aborted) {
            reject(new Error("命令已中止"));
            return;
          }

          if (timedOut) {
            const textOut = truncateOutput(output);
            const details: BashToolDetails = {
              cwd,
              command,
              exitCode: code,
              timedOut: true,
              outputTruncated: Buffer.byteLength(output, "utf-8") > MAX_OUTPUT,
              rawOutputBytes: Buffer.byteLength(output, "utf-8"),
            };
            resolve({
              content: [
                {
                  type: "text",
                  text: `命令在 ${timeout} 秒后超时。\n部分输出：\n${textOut}`,
                },
              ],
              details,
            });
            return;
          }

          const exitInfo = code !== 0 ? `\n[退出码：${code}]` : "";
          const details: BashToolDetails = {
            cwd,
            command,
            exitCode: code,
            timedOut: false,
            outputTruncated: Buffer.byteLength(output, "utf-8") > MAX_OUTPUT,
            rawOutputBytes: Buffer.byteLength(output, "utf-8"),
          };
          resolve({
            content: [
              {
                type: "text",
                text: truncateOutput(output) + exitInfo,
              },
            ],
            details,
          });
        });

        child.on("error", (err) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          signal?.removeEventListener("abort", onAbort);
          reject(err);
        });
      });
    },
  };
}

function truncateOutput(output: string): string {
  if (Buffer.byteLength(output, "utf-8") <= MAX_OUTPUT) return output;

  const lines = output.split("\n");
  const result: string[] = [];
  let size = 0;

  for (const line of lines) {
    const lineSize = Buffer.byteLength(line + "\n", "utf-8");
    if (size + lineSize > MAX_OUTPUT) {
      result.push(`\n[输出在约 ${Math.round(MAX_OUTPUT / 1024)}KB 处截断]`);
      break;
    }
    result.push(line);
    size += lineSize;
  }

  return result.join("\n");
}
