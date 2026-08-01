import "reflect-metadata";
import { TRAY_INSTANCE_METADATA } from "../common/constants";

export function TrayInstance(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.set(target, propertyKey, null);
    Reflect.defineMetadata(TRAY_INSTANCE_METADATA, true, target, propertyKey);
  };
}
