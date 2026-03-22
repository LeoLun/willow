import "reflect-metadata";
import { AppModule } from "./app.module";
import { CoreFactory } from "@willow/poetry";
import { config } from "dotenv";

config();

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();
