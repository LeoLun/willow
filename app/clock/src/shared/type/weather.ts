/**
 * @description 天气预告信息
 */
export type IForecast = {
  /**
   * @description 空气质量指数等级
   */
  aqi_level: number;
  /**
   * @description 空气质量指数名称
   */
  aqi_name: string;
  /**
   * @description 空气质量指数相关信息的URL
   */
  aqi_url: string;
  /**
   * @description 白天天气描述
   */
  day_weather: string;
  /**
   * @description 白天天气代码
   */
  day_weather_code: string;
  /**
   * @description 白天天气简短描述
   */
  day_weather_short: string;
  /**
   * @description 白天天气相关信息的URL
   */
  day_weather_url: string;
  /**
   * @description 白天风向
   */
  day_wind_direction: string;
  /**
   * @description 白天风向代码
   */
  day_wind_direction_code: string;
  /**
   * @description 白天风力
   */
  day_wind_power: string;
  /**
   * @description 白天风力代码
   */
  day_wind_power_code: string;
  /**
   * @description 最高温度
   */
  max_degree: string;
  /**
   * @description 最低温度
   */
  min_degree: string;
  /**
   * @description 夜间天气描述
   */
  night_weather: string;
  /**
   * @description 夜间天气代码
   */
  night_weather_code: string;
  /**
   * @description 夜间天气简短描述
   */
  night_weather_short: string;
  /**
   * @description 夜间天气相关信息的URL
   */
  night_weather_url: string;
  /**
   * @description 夜间风向
   */
  night_wind_direction: string;
  /**
   * @description 夜间风向代码
   */
  night_wind_direction_code: string;
  /**
   * @description 夜间风力
   */
  night_wind_power: string;
  /**
   * @description 夜间风力代码
   */
  night_wind_power_code: string;
  /**
   * @description 预报时间
   */
  time: string;
};


/**
 * @description 实时天气数据
 */
export type IObserve = {
  /**
   * @description 温度（单位：度）
   */
  degree: string;

  /**
   * @description 湿度（百分比）
   */
  humidity: string;

  /**
   * @description 降水量
   */
  precipitation: string;

  /**
   * @description 大气压强
   */
  pressure: string;

  /**
   * @description 观测数据最后更新时间
   */
  update_time: string;

  /**
   * @description 当前天气状况描述
   */
  weather: string;

  /**
   * @description 当前天气状况的背景图片URL
   */
  weather_bg_pag: string;

  /**
   * @description 当前天气状况的代码
   */
  weather_code: string;

  /**
   * @description 当前天气状况的颜色
   */
  weather_color: string | null;

  /**
   * @description 当前主要天气状况描述
   */
  weather_first: string;

  /**
   * @description 当前天气状况的图片URL
   */
  weather_pag: string;

  /**
   * @description 当前天气状况的简短描述
   */
  weather_short: string;

  /**
   * @description 当前天气详细信息的URL
   */
  weather_url: string;

  /**
   * @description 风向（单位：度）
   */
  wind_direction: string;

  /**
   * @description 风向名称（例如："北风"、"南风"）
   */
  wind_direction_name: string;

  /**
   * @description 风力或风速描述
   */
  wind_power: string;
};