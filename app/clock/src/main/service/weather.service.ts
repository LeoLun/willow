import { Injectable } from "poetry";
import { IForecast, IObserve } from "../../shared/type/weather";

@Injectable()
export class WeatherService {
  weatherUrl =
    "https://wis.qq.com/weather/common?source=pc&weather_type=observe%7Cforecast_24h&province=%E5%B9%BF%E4%B8%9C%E7%9C%81&city=%E7%8F%A0%E6%B5%B7%E5%B8%82&county=%E9%A6%99%E6%B4%B2%E5%8C%BA";

  async fetchWeather(): Promise<IForecast[]> {
    const response = await fetch(this.weatherUrl);
    const { data } = await response.json();
    const { forecast_24h: forecast } = data;
    return [
      forecast[0],
      forecast[1],
      forecast[2],
      forecast[3],
      forecast[4],
      forecast[5],
      forecast[6],
      forecast[7],
    ];
  }

  async fetchWeatherNow(): Promise<IObserve> {
    const response = await fetch(this.weatherUrl);
    const { data } = await response.json();
    const { observe } = data;
    return observe;
  }
}
