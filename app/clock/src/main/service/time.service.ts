import { Injectable } from "poetry";


@Injectable()
export class TimeService {
  // 获取当前时间
  getCurrentTime() {
    return new Date().toLocaleTimeString();
  }
}