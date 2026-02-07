import { Injectable } from "poetry";

@Injectable()
export class EchoService {

  echo(message: string) {
    return `echo: ${message}`;
  }
}
