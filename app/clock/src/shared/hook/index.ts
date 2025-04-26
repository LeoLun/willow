import { IFetchWeatherRenderer } from './fetch-weather';
import { IFetchWeatherNowRenderer } from './fetch-weather-now';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IRenderHook extends IFetchWeatherRenderer, IFetchWeatherNowRenderer {}

export * from './fetch-weather';
export * from './fetch-weather-now';