import { Container, interfaces } from "inversify";

export class WindowFactoryResolver {
  constructor(private container: Container) {}

  resolveWindowFactory<T>(window: interfaces.Newable<T>): T {
    return this.container.resolve<T>(window);
  }
}
