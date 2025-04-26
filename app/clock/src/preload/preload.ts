import { contextBridge, ipcRenderer } from "electron";
import type {
  IRenderHook,
  IFetchWeatherResponce,
  IFetchWeatherNowResponce,
} from "../shared";

import {
  FETCH_WEATHER,
  FETCH_WEATHER_NOW
} from "../shared";


const  ipcObject: IRenderHook  = {
  async fetchWeather(): Promise<IFetchWeatherResponce> {
    return await ipcRenderer.invoke(FETCH_WEATHER);
  },
  async fetchWeatherNow(): Promise<IFetchWeatherNowResponce> {
    return await ipcRenderer.invoke(FETCH_WEATHER_NOW);
  }
}

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
