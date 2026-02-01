import { On, WindowFactoryResolver, Module, IPC } from "poetry";
import { MainWindow } from "./window/main.window";
import { app, BrowserWindow, session } from "electron";
import type { IEcho } from "../shared";
import { ECHO } from "../shared";
import started from 'electron-squirrel-startup';
import { EchoService } from "./service/echo.service";

if (started) {
  app.quit();
}

@Module({
  imports: [],
  windows: [MainWindow],
  providers: [EchoService],
})
export class AppModule implements IEcho { 
  private windowFactoryResolver: WindowFactoryResolver;
  private echoService: EchoService;

  constructor(
    windowFactoryResolver: WindowFactoryResolver,
    echoService: EchoService
  ) {
    console.log("windowFactoryResolver", windowFactoryResolver);
    this.windowFactoryResolver = windowFactoryResolver;
    this.echoService = echoService;
  }

  createWindow() {
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  onReady() {
    this.createWindow();

    // 获取默认会话
    const ses = session.defaultSession;

    // 拦截请求并修改请求头
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.url.includes("mat1.gtimg.com")) {
        if (details.requestHeaders['Referer']) {
          delete details.requestHeaders['Referer'];
        }
      }
      // 继续请求
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  }

  @On("window-all-closed")
  onWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  @On("activate")
  onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow();
    }
  }

  @IPC(ECHO)
  async echo() {
    const message = await this.echoService.echo("hello world");
    return {
      message,
    };
  }
}
