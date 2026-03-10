import type {
  IMessage,
  ISession,
  IDatabase,
  ISessionConfig,
} from "../interfaces";

export class SessionImpl implements ISession {
  private _id: string = "";
  private _title: string = "";
  private _createdAt: string = "";
  private _updatedAt: string = "";
  private _systemPrompt: string = "";
  private _messages: IMessage[] = [];
  private _db: IDatabase;

  get id(): string {
    return this._id;
  }
  get title(): string {
    return this._title;
  }
  get createdAt(): string {
    return this._createdAt;
  }
  get updatedAt(): string {
    return this._updatedAt;
  }
  get systemPrompt(): string {
    return this._systemPrompt;
  }
  get messages(): IMessage[] {
    return this._messages;
  }
  get db(): IDatabase {
    return this._db;
  }

  constructor(db: IDatabase) {
    this._db = db;
  }

  init(config: ISessionConfig) {
    this._id = config.id;
    this._title = config.title;
    this._systemPrompt = config.systemPrompt;
    this._messages = config.messages;
    this._createdAt = config.createdAt;
    this._updatedAt = config.updatedAt;
  }

  sendMessage(message: IMessage): IMessage {
    throw new Error("Method not implemented.");
  }
  getMessages(): IMessage[] {
    return this.messages;
  }
  rename(title: string): void {
    throw new Error("Method not implemented.");
  }
}
