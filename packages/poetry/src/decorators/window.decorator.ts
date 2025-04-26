/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { BrowserWindowConstructorOptions } from 'electron';
import { injectable } from "inversify";
import { WINDOW_METADATA } from '../common/constants';

export interface WindowMetadata {
  options?: BrowserWindowConstructorOptions;
  loadURL?: string;
  loadFile?: string;
  openDevTools?: boolean;
}

export function Window(metadata: WindowMetadata): ClassDecorator {
  return (target: any) => {
    injectable()(target);
    Reflect.defineMetadata(WINDOW_METADATA.OPTIONS, metadata.options, target);
    Reflect.defineMetadata(WINDOW_METADATA.LOAD_URL, metadata.loadURL, target);
    Reflect.defineMetadata(WINDOW_METADATA.LOAD_FILE, metadata.loadFile, target);
    Reflect.defineMetadata(WINDOW_METADATA.OPEN_DEV_TOOLS, metadata.openDevTools, target);
  };
}