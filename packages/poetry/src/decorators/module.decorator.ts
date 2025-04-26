// decorators/module.decorator.ts
import 'reflect-metadata';
import { MODULE_METADATA } from '../common/constants';
import { injectable } from "inversify";

interface ModuleMetadata {
  imports?: any[];
  windows?: any[];
  providers?: any[];
  exports?: any[];
}

export function Module(metadata: ModuleMetadata): ClassDecorator {
  return (target: any) => {
    injectable()(target);
    Reflect.defineMetadata(MODULE_METADATA.IMPORTS, metadata.imports, target);
    Reflect.defineMetadata(MODULE_METADATA.WINDOWS, metadata.windows, target);
    Reflect.defineMetadata(MODULE_METADATA.PROVIDERS, metadata.providers, target);
    Reflect.defineMetadata(MODULE_METADATA.EXPORTS, metadata.exports, target);
  };
}