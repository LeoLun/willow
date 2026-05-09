import { join } from "node:path";
import { CoreFactory } from "@willow/poetry";
import "reflect-metadata";
import { config } from "dotenv";
import { app, protocol } from "electron";
import { AppModule } from "./app.module";

config();

const legacyUserDataPath = join(app.getPath("appData"), "com.willow.work");
app.setPath("userData", legacyUserDataPath);

protocol.registerSchemesAsPrivileged([
  { scheme: "ai-app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();
