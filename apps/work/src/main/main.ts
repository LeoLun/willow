import { join } from "node:path";
import { CoreFactory } from "@willow/poetry";
import "reflect-metadata";
import { app } from "electron";
import { AppModule } from "./app.module";
import { configureApplicationMenu } from "./application-menu";

configureApplicationMenu();
const folderName = app.isPackaged ? "com.willow.work" : "com.willow.work-dev";
const legacyUserDataPath = join(app.getPath("appData"), folderName);
app.setPath("userData", legacyUserDataPath);

console.log("------------");

async function bootstrap() {
  console.log("bootstrap");
  await CoreFactory.create(AppModule);
}

bootstrap();
