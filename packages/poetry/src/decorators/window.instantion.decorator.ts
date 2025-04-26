import {WINDOW_INSTANCE_METADATA} from '../common/constants';

export function WindowInstance(): PropertyDecorator {
  return (
    target: object,
    propertyKey: string | symbol
  ) => {
    Reflect.set(target, propertyKey, null);
    console.log('WindowInstance', target, propertyKey)
    Reflect.defineMetadata(WINDOW_INSTANCE_METADATA, true, target, propertyKey);
  };
}
