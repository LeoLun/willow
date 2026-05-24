import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CoreFactory } from "@willow/poetry";
import "reflect-metadata";
import { config } from "dotenv";
import { app, protocol } from "electron";
import { AppModule } from "./app.module";

config();

const folderName = app.isPackaged ? "com.willow.work" : "com.willow.work-dev";
const legacyUserDataPath = join(app.getPath("appData"), folderName);
app.setPath("userData", legacyUserDataPath);

function attemptUpdateRollback() {
  if (!app.isPackaged) return;

  const markerPath = join(app.getPath("userData"), ".update-marker.json");
  if (!existsSync(markerPath)) return;

  console.log("[UpdateRollback] Found update marker at", markerPath);

  try {
    const raw = readFileSync(markerPath, "utf-8");
    console.log("[UpdateRollback] Marker content:", raw);
    const marker = JSON.parse(raw);
    const oldAsarPath = join(process.resourcesPath, "app.asar.old");
    const hasOldAsar = existsSync(oldAsarPath);
    console.log(
      `[UpdateRollback] attempts=${marker.attempts}, version=${marker.version}, hasOldAsar=${hasOldAsar}`,
    );

    if (marker.attempts >= 1 && hasOldAsar) {
      console.warn("[UpdateRollback] Crash detected after update — initiating rollback");
      const appAsarPath = join(process.resourcesPath, "app.asar");
      const brokenPath = join(process.resourcesPath, "app.asar.broken");
      console.log(`[UpdateRollback] Renaming current asar → ${brokenPath}`);
      renameSync(appAsarPath, brokenPath);
      console.log(`[UpdateRollback] Restoring backup → ${appAsarPath}`);
      renameSync(oldAsarPath, appAsarPath);
      unlinkSync(markerPath);
      console.log("[UpdateRollback] Rollback complete, relaunching");
      app.relaunch();
      app.exit(0);
    } else {
      marker.attempts = (marker.attempts || 0) + 1;
      writeFileSync(markerPath, JSON.stringify(marker));
      console.log(
        `[UpdateRollback] First post-update launch, incremented attempts to ${marker.attempts}`,
      );
    }
  } catch (e) {
    console.error("[UpdateRollback] Rollback check failed:", e);
    try {
      unlinkSync(markerPath);
    } catch {}
  }
}

attemptUpdateRollback();

protocol.registerSchemesAsPrivileged([
  { scheme: "ai-app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();
