import { join } from "node:path";
import { CoreFactory } from "@willow/poetry";
import "reflect-metadata";
import { config } from "dotenv";
import { app } from "electron";
import { AppModule } from "./app.module";

config();

const legacyUserDataPath = join(app.getPath("appData"), "com.willow.work");
app.setPath("userData", legacyUserDataPath);

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();
