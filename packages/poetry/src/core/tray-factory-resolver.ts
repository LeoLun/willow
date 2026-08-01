import { Container, interfaces } from "inversify";

export class TrayFactoryResolver {
  constructor(private container: Container) {}

  resolveTrayFactory<T>(tray: interfaces.Newable<T>): T {
    return this.container.resolve<T>(tray);
  }
}
