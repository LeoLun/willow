import { IObserve } from "../type/weather";

export type IFetchWeatherNowResponce = {
  observe: IObserve;
}

export interface IFetchWeatherNow {
  fetchWeatherNow(event:  Electron.IpcMainInvokeEvent): Promise<IFetchWeatherNowResponce>;
}

export interface IFetchWeatherNowRenderer {
  fetchWeatherNow(): Promise<IFetchWeatherNowResponce>;
}
