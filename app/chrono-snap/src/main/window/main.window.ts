import { Window, WindowInstance, OnInit, On, OnDestroy } from "poetry";
import { BrowserWindow } from "electron";
import path from 'path';

@Window({
  options: {
    height: 800,
    width: 1200,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  },
  loadURL: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  // openDevTools: true,
})
export class MainWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win: BrowserWindow;

  async onInit() {
    //
  }

  onDestroy() {
    console.log('onDestroy')
  }

  getWindow() {
    return this.win;
  }

  @On('show')
  onShow() {
    console.log('OnShow')
  }

  @On('hide')
  onHide() {
    console.log('OnHide')
  }
}
