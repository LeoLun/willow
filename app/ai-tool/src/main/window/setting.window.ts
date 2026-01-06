import { Window, WindowInstance, OnInit, On, OnDestroy } from "poetry";
import { BrowserWindow } from "electron";
import path from 'path';

@Window({
  options: {
    height: 400,
    width: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  },
  loadURL: `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/setting`,
})
export class SettingWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win: BrowserWindow;

  onInit() {
    console.log('OnInit')
    console.log('win', this.win) 
  }

  onDestroy() {
    console.log('onDestroy')
  }

  showModal(parentWindow: BrowserWindow) {
    this.win.setParentWindow(parentWindow);
    this.win.show();
    console.log('isModal', this.win.isModal())
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
