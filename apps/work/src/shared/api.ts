export interface ApiResponse<K> {
  code: number;
  msg: string;
  data?: K;
}
export interface RegisterEventRequest {
  event?: string;
}

export interface RegisterEventResponse {}
