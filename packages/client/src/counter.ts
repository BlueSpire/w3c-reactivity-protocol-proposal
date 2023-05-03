import { observable } from "@bluespire/reactivity";

export class Counter {
  @observable accessor count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}