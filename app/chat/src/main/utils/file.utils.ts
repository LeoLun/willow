import { readFile } from "fs/promises";
import { PDFParse } from "pdf-parse";
import { read } from "xlsx";

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


export async function readXlsxText(filePath: string): Promise<{ sheetName: string; data: string }[]> {
  const buf = await readFile(filePath);
  /* buf is a Buffer */
  const workbook = read(buf);
  const sheetNames = workbook.SheetNames;
  // 读取全部sheet
  const sheetData = sheetNames.map((sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    return {
      sheetName,
      data: JSON.stringify(worksheet),
    };
  });
  return sheetData;
}