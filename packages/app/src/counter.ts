import { observable } from "@w3c-protocols/reactivity";

export class Counter {
  @observable accessor count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}