import { Window, WindowInstance, OnInit, On, OnDestroy } from "poetry";
import { SomeService } from "../service/some.service";
import { BrowserView } from "electron";
import path from 'path';

@Window({
  options: {
    height: 800,
    width: 1200,
    // frame: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  },
  loadURL: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  openDevTools: true,
})
export class MainWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win: BrowserView;

  constructor(private someService: SomeService) {}

  onInit() {
    console.log('OnInit')
    console.log('OnInit', this.someService)
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
