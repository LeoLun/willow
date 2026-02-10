import { IEchoRenderer } from "./echo.hook";
import { IStartOpencodeRenderer } from "./opencode.hook";

export interface IRenderHook extends IEchoRenderer, IStartOpencodeRenderer {}

export * from "./echo.hook";
export * from "./opencode.hook";
