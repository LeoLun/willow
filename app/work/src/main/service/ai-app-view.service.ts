import path from "node:path";
import { pathToFileURL } from "node:url";
import { Injectable, OnDestroy } from "@willow/poetry";
import { BrowserWindow, net, protocol, WebContentsView } from "electron";

@Injectable()
export class AiAppViewService implements OnDestroy {
  private view: WebContentsView | null = null;
  private workspaceRoot: string | null = null;
  private protocolRegistered = false;
  private visible = false;

  private buildFileUrl(requestUrl: string): string | null {
    if (!this.workspaceRoot) return null;
    const url = new URL(requestUrl);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const workspaceRoot = path.resolve(this.workspaceRoot);
    const filePath = path.resolve(workspaceRoot, relativePath);
    if (!filePath.startsWith(`${workspaceRoot}${path.sep}`) && filePath !== workspaceRoot) {
      return null;
    }
    return pathToFileURL(filePath).toString();
  }

  private ensureProtocol(): void {
    if (this.protocolRegistered) return;
    protocol.handle("ai-app", (request) => {
      const fileUrl = this.buildFileUrl(request.url);
      if (!fileUrl) {
        return new Response("workspace not set", { status: 500 });
      }
      return net.fetch(fileUrl);
    });
    this.protocolRegistered = true;
  }

  private loadErrorPage(): void {
    const errorHTML = `data:text/html;charset=utf-8,${encodeURIComponent(
      '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:%23999;margin:0"><p>当前工作空间根目录未找到 index.html 文件</p></body></html>',
    )}`;
    this.view?.webContents.loadURL(errorHTML);
  }

  private loadEntry(view: WebContentsView): void {
    const handleFail = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      validatedURL: string,
      isMainFrame?: boolean,
    ) => {
      if (isMainFrame === false) return;
      console.error("ai-app load failed:", errorCode, errorDescription, validatedURL);
      view.webContents.off("did-finish-load", handleFinish);
      this.loadErrorPage();
    };
    const handleFinish = () => {
      view.webContents.off("did-fail-load", handleFail);
    };
    view.webContents.once("did-fail-load", handleFail);
    view.webContents.once("did-finish-load", handleFinish);
    view.webContents.loadURL("ai-app://localhost/index.html");
  }

  private ensureView(mainWindow: BrowserWindow): WebContentsView {
    if (this.view) return this.view;
    this.view = new WebContentsView({
      webPreferences: {
        webSecurity: true,
        contextIsolation: true,
      },
    });
    this.view.setVisible(false);
    mainWindow.contentView.addChildView(this.view);

    return this.view;
  }

  showApp(workspaceRoot: string, mainWindow: BrowserWindow): void {
    if (!workspaceRoot) return;
    this.ensureProtocol();
    const view = this.ensureView(mainWindow);

    this.workspaceRoot = workspaceRoot;

    this.visible = true;
    view.setVisible(true);
    this.loadEntry(view);
  }

  hideView(): void {
    this.visible = false;
    if (this.view) {
      this.view.setVisible(false);
    }
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    if (this.view && this.visible) {
      this.view.setBounds(bounds);
    }
  }

  onDestroy(): void {
    if (this.view) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.contentView.removeChildView(this.view);
      this.view.webContents.close();
      this.view = null;
    }
  }
}
