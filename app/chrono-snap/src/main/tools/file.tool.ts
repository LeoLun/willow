import * as z from "zod";
import { readdir, mkdir, rename, stat } from "fs/promises";
import { DynamicStructuredTool } from "langchain";
import { readPDFText, readXlsxText } from "../utils/file.utils";

export function registerFileTools() {
  const listDirectoryTool = new DynamicStructuredTool({
    name: "list_directory",
    description: "列出指定目录下的文件和子目录。",
    schema: z.object({
      dir: z.string().describe("要读取的目录路径"),
    }),
    func: async ({ dir }: { dir: string }) => {
      const entries = await readdir(dir, { withFileTypes: true });
      return entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
    },
  });

  const createDirTool = new DynamicStructuredTool({
    name: "create_directory",
    description: "创建新目录。",
    schema: z.object({
      dirPath: z.string().describe("要创建的目录路径"),
    }),
    func: async ({ dirPath }: { dirPath: string }) => {
      await mkdir(dirPath, { recursive: true });
      return `目录已创建：${dirPath}`;
    },
  });

  const moveFileTool = new DynamicStructuredTool({
    name: "move_file",
    description: "移动文件到新路径。",
    schema: z.object({
      from: z.string().describe("源文件路径"),
      to: z.string().describe("目标路径"),
    }),
    func: async ({ from, to }: { from: string; to: string }) => {
      await rename(from, to);
      return `文件已移动：${from} → ${to}`;
    },
  });

  const renameFileTool = new DynamicStructuredTool({
    name: "rename_file",
    description: "重命名文件或文件夹。",
    schema: z.object({
      targetPath: z.string().describe("要重命名的文件或文件夹路径"),
      recommendations: z.array(z.string()).describe("新的文件名或文件夹名数组，每个元素为 1 个推荐新文件名（不含扩展名）"),
    }),
    func: async ({ targetPath, recommendations }: { targetPath: string; recommendations: string[] }) => {
      console.log("renameFileTool", targetPath, recommendations);
      return `已重命名：${targetPath} → ${recommendations[0]}`;
    },
  });

  // 读取PDF文件内容
  const readPdfFileTool = new DynamicStructuredTool({
    name: "read_pdf_file",
    description: "读取PDF文件内容。",
    schema: z.object({
      filePath: z.string().describe("要读取的PDF文件路径"),
    }),
    func: async ({ filePath }: { filePath: string }) => {
      console.log("读取PDF文件内容：", filePath);
      const pdfText = await readPDFText(filePath, 1000);
      return pdfText;
    },
  });

  // 读取 xlsx 文件内容
  const readXlsxFileTool = new DynamicStructuredTool({
    name: "read_xlsx_file",
    description: "读取xlsx文件内容。",
    schema: z.object({
      filePath: z.string().describe("要读取的xlsx文件路径"),
    }),
    func: async ({ filePath }: { filePath: string }) => {
      console.log("读取xlsx文件内容：", filePath);
      const xlsxText = await readXlsxText(filePath);
      console.log("xlsxText", xlsxText);
      return xlsxText;
    },
  });

  // 读取文件基本信息
  const readFileInfoTool = new DynamicStructuredTool({
    name: "read_file_info",
    description: "读取文件基本信息。",
    schema: z.object({
      filePath: z.string().describe("要读取的文件路径"),
    }),
    func: async ({ filePath }: { filePath: string }) => {
      console.log("读取文件基本信息：", filePath);
      const fileStat = await stat(filePath);
      return {
        name: filePath.split("/").pop() || "",
        type: fileStat.isDirectory() ? "directory" : "file",
        size: fileStat.size,
        createdAt: fileStat.birthtime,
        modifiedAt: fileStat.mtime,
      };
    },
  }); 

  return [listDirectoryTool, createDirTool, moveFileTool, renameFileTool, readPdfFileTool, readXlsxFileTool, readFileInfoTool];
}
