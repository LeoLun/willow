/* oxlint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import type { NativeImage } from "electron";
import { injectable } from "inversify";
import { TRAY_METADATA } from "../common/constants";

export interface TrayMetadata {
  image: NativeImage | string;
  guid?: string;
  templateImage?: boolean;
}

export function Tray(metadata: TrayMetadata): ClassDecorator {
  return (target: any) => {
    injectable()(target);
    Reflect.defineMetadata(TRAY_METADATA.IMAGE, metadata.image, target);
    Reflect.defineMetadata(TRAY_METADATA.GUID, metadata.guid, target);
    Reflect.defineMetadata(TRAY_METADATA.TEMPLATE_IMAGE, metadata.templateImage, target);
  };
}
