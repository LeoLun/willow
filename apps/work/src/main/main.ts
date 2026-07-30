import { join } from "node:path";
import { app } from "electron";
import { prepareHotUpdateLaunch } from "./update/hot-update-launcher";

const folderName = app.isPackaged ? "com.willow.work" : "com.willow.work-dev";
const legacyUserDataPath = join(app.getPath("appData"), folderName);
app.setPath("userData", legacyUserDataPath);

async function bootstrap() {
  const payloadEntry = prepareHotUpdateLaunch(legacyUserDataPath);
  if (payloadEntry) {
    require(payloadEntry);
    return;
  }
  const { startApplication } = await import("./application");
  await startApplication();
}

void bootstrap().catch((error) => {
  console.error("Failed to start Willow:", error);
  app.exit(1);
});
