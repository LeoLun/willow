import { Window, WindowInstance, OnInit, On, OnDestroy, WindowMetadata } from "poetry";
import { BrowserWindow } from "electron";
import { join } from 'path';

const option: WindowMetadata = {
  options: {
    height: 800,
    width: 1200,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
    },
  },
  openDevTools: true,
}

if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  option.loadURL = MAIN_WINDOW_VITE_DEV_SERVER_URL
} else {
  option.loadFile = join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
}

@Window(option)
export class MainWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win: BrowserWindow;

  onInit() {
    console.log('OnInit')
    console.log('win', this.win) 
  }

  onDestroy() {
    console.log('onDestroy')
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
