import { IMessage } from "./message.interface";
import { IDatabase } from "./db.interface";

export interface ISessionConfig {
  id: string;
  title: string;
  systemPrompt: string;
  messages: IMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ISessionConfigWithDb extends ISessionConfig {
  db: IDatabase;
}

export interface ISession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  systemPrompt: string;
  messages: IMessage[];
  db: IDatabase;

  init(config: ISessionConfig): void;
  sendMessage(message: IMessage): IMessage;
  getMessages(): IMessage[];
  rename(title: string): void;
}

export interface ISessionFactory {
  (params: ISessionConfig): ISession;
}
export abstract class ISessionFactory {}
