import { IEchoRenderer } from "./echo.hook";
import { IStartOpencodeRenderer } from "./opencode.hook";
import { IInitRenderer } from "./init.hook";
import { IDialogRenderer } from "./dialog.hook";

export interface IRenderHook
  extends IEchoRenderer,
    IStartOpencodeRenderer,
    IInitRenderer,
    IDialogRenderer {}

export * from "./echo.hook";
export * from "./opencode.hook";
export * from "./init.hook";
export * from "./dialog.hook";
