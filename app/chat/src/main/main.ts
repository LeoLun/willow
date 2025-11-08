import 'reflect-metadata';
import { AppModule } from "./app.module";
import { CoreFactory } from "poetry";
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function bootstrap() {
  await CoreFactory.create(AppModule);
}

bootstrap();