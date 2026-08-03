import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, net, protocol } from "electron";
import { prepareHotUpdateLaunch } from "./update/hot-update-launcher";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "willow-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const folderName = app.isPackaged ? "com.willow.work" : "com.willow.work-dev";
const legacyUserDataPath = join(app.getPath("appData"), folderName);
app.setPath("userData", legacyUserDataPath);

async function bootstrap() {
  await app.whenReady();
  protocol.handle("willow-file", (request) => {
    const url = request.url.replace(/^willow-file:\/\//, "");
    const decodedPath = decodeURIComponent(url);
    return net.fetch(pathToFileURL(decodedPath).toString());
  });

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
