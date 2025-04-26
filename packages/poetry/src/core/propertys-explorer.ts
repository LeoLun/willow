
import { IPC_METADATA, ON_METADATA, WINDOW_INSTANCE_METADATA } from '../common/constants';
import { isFunction } from '../common/utils';

export class PropertysExplorer {
  public scanForPropertys(
    instance: object
  ) {
    const instancePrototype = Object.getPrototypeOf(instance)
    const methodList: string[] = []
    const propertyList: string[] = []
    for (const property of Object.getOwnPropertyNames(instancePrototype)) {
      if (isFunction(instancePrototype[property])) {
        methodList.push(property)
      } else {
        propertyList.push(property)
      }
    }
    const propertys: any[] = propertyList.reduce((acc: any[], property: string) => {
      const event = this.explorePropertyMetadata(
        instance,
        instancePrototype,
        property,
      );

      if (event) {
        acc.push(event);
      }
      return acc;
    }, [])
    const methods = methodList.reduce((acc: any[], method: string) => {
      const event = this.exploreMethodMetadata(
        ON_METADATA.EVENT,
        instance,
        instancePrototype,
        method,
      );

      if (event) {
        acc.push(event);
      }
      return acc;
    }, []);

    const ipcMethods = methodList.reduce((acc: any[], method: string) => {
      const event = this.exploreMethodMetadata(
        IPC_METADATA.EVENT,
        instance,
        instancePrototype,
        method,
      );

      if (event) {
        acc.push(event);
      }
      return acc;
    }, []);

    return [propertys, methods, ipcMethods]
  }

  public exploreMethodMetadata(
    metadataKey: string,
    instance: { [key: string]: any },
    prototype: { [key: string]: any },
    methodName: string,
  ) {
    const instanceCallback = instance[methodName];
    const prototypeCallback = prototype[methodName];
    const eventName = Reflect.getMetadata(metadataKey, prototypeCallback);
    if (!eventName || eventName === '') {
      return null;
    }
    return {
      eventName,
      targetCallback: instanceCallback,
      methodName,
    };
  }

  public explorePropertyMetadata(
    instance: { [key: string]: any },
    prototype: { [key: string]: any },
    propertyName: string,
  ) {
    const instanceProperty = instance[propertyName];
    const prototypeProperty = prototype[propertyName];
    const isWindowInstance = Reflect.getMetadata(WINDOW_INSTANCE_METADATA, prototype, propertyName);
    if (!isWindowInstance) {
      return null;
    }
    return {
      propertyName
    };
  }
}