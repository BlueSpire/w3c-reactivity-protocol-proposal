import { ComputedObserver } from "./index.js";

export function effect(func: Function) {
  const observer = new ComputedObserver(o => o.observe(func));
  observer.observe(func);
  return observer;
}