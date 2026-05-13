import { IPC_METADATA } from "../common/constants";

export function IPC(event: string): MethodDecorator {
  return (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
    Reflect.defineMetadata(IPC_METADATA.EVENT, event, descriptor.value);
    return descriptor;
  };
}
