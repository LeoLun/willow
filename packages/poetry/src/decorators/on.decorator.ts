import { ON_METADATA } from "../common/constants";

export function On(event: string): MethodDecorator {
  return (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
    Reflect.defineMetadata(ON_METADATA.EVENT, event, descriptor.value);
    return descriptor;
  };
}
