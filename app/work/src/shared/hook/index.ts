import { IEchoRenderer } from "./echo.hook";
import { IInitRenderer } from "./init.hook";
import { IDialogRenderer } from "./dialog.hook";

export interface IRenderHook
  extends IEchoRenderer, IInitRenderer, IDialogRenderer {}

export * from "./echo.hook";
export * from "./init.hook";
export * from "./dialog.hook";
