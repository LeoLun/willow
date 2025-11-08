import { readFile } from "fs/promises";
import { PDFParse } from "pdf-parse";

/**
 * 读取PDF文件内容
 * @param filePath PDF文件路径
 * @returns PDF文件内容
 */
export async function readPDFText(filePath: string, maxLength = 1000) {
  const dataBuffer = await readFile(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  try {
    const result = await parser.getText();
    await parser.destroy();
    return result.text.slice(0, maxLength);
  } catch (error) {
    await parser.destroy();
    return '';
  }
}
