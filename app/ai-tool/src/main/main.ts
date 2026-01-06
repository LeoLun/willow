import 'reflect-metadata';
import { AppModule } from "./app.module";
import { CoreFactory } from "poetry";
import { config } from 'dotenv';

// 加载环境变量
config();

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();