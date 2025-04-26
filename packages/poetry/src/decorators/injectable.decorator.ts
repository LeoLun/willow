import { injectable } from "inversify";

export function Injectable(): ClassDecorator {
  return (target: any) => {
    injectable()(target);
  };
}