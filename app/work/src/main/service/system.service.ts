import { Injectable } from "@willow/poetry";
import { desktopCapturer, app } from "electron";
import { join } from "path";
import { writeFile } from "fs/promises";

@Injectable()
export class SystemService {
  async getAllScreens() {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
    }));
  }

  async saveScreenshot(buffer: Buffer, screenName: string) {
    const fileName = `Screenshot-${screenName.replace(/\s+/g, "-")}-${Date.now()}.png`;
    const filePath = join(app.getPath("desktop"), fileName);
    await writeFile(filePath, buffer);
    return filePath;
  }
}
