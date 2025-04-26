import { Container } from "inversify";

export class WindowFactoryResolver {
  constructor(
    private container: Container
  ){}

  resolveWindowFactory(window: any) {
    return this.container.resolve(window);
  }
}