import { Observer, ReactivityEngine } from "@bluespire/reactivity";

export const testReactivityEngineOne: ReactivityEngine = {
  onAccess: function (target: object, propertyKey: string | symbol): void {
    throw new Error("Function not implemented.");
  },
  onChange: function (target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void {
    throw new Error("Function not implemented.");
  },
  createFunctionObserver: function (func: Function): Observer {
    throw new Error("Function not implemented.");
  }
};