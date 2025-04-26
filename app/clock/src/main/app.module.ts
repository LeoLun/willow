import { On, WindowFactoryResolver, Module, IPC } from "poetry";
import { WeatherService } from "./service/weather.service";
import { MainWindow } from "./window/main.window";
import { app, BrowserWindow, session } from "electron";
import type { IFetchWeather } from "../shared";
import { FETCH_WEATHER, FETCH_WEATHER_NOW } from "../shared";
import started from 'electron-squirrel-startup';

if (started) {
  app.quit();
}

@Module({
  imports: [],
  windows: [MainWindow],
  providers: [WeatherService],
})
export class AppModule implements IFetchWeather {
  private windowFactoryResolver: WindowFactoryResolver;
  private weatherService: WeatherService;

  constructor(
    windowFactoryResolver: WindowFactoryResolver,
    weatherService: WeatherService
  ) {
    console.log("windowFactoryResolver", windowFactoryResolver);
    this.windowFactoryResolver = windowFactoryResolver;
    this.weatherService = weatherService;
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

  @IPC(FETCH_WEATHER)
  async fetchWeather() {
    const forecasts = await this.weatherService.fetchWeather();
    return {
      forecasts,
    };
  }

  @IPC(FETCH_WEATHER_NOW)
  async fetchWeatherNow() {
    const observe = await this.weatherService.fetchWeatherNow();
    return {
      observe,
    };
  }
}
