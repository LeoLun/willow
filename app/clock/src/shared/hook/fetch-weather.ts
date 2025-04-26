import { IForecast } from "../type/weather";

export type IFetchWeatherResponce = {
  forecasts: IForecast[];
}

export interface IFetchWeather {
  fetchWeather(event:  Electron.IpcMainInvokeEvent): Promise<IFetchWeatherResponce>;
}

export interface IFetchWeatherRenderer {
  fetchWeather(): Promise<IFetchWeatherResponce>;
}
