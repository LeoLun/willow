import "reflect-metadata";
import { CoreFactory } from "@willow/poetry";
import { config } from "dotenv";
import { AppModule } from "./app.module";

config();

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();
