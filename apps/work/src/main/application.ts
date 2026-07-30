import { CoreFactory } from "@willow/poetry";
import "reflect-metadata";
import { AppModule } from "./app.module";
import { configureApplicationMenu } from "./application-menu";

export async function startApplication(): Promise<void> {
  configureApplicationMenu();
  await CoreFactory.create(AppModule);
}
