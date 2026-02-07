import 'reflect-metadata';
import { AppModule } from "./app.module";
import { CoreFactory } from "poetry";

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();