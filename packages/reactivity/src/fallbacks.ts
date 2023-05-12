import { ComputedObserver, ObjectObserver, Observable, PropertyObserver, Subscriber, SubscriberObject } from "./index.js";

export class FallbackObjectObserver implements ObjectObserver {
  #observers: PropertyObserver[] = [];
  #subscriber: SubscriberObject;
  #target: any;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
  }

  observe(target: any) {
    if (target === this.#target) {
      return;
    }

    this.disconnect();
    this.#target = target;

    for (const key of Observable.getAccessors(target)) {
      const o = new PropertyObserver(this);
      o.observe(target, key);
      this.#observers.push(o);
    }

    return target;
  }

  disconnect(): void {
    this.#target = null;
    this.#observers.forEach(x => x.disconnect());
    this.#observers.length = 0;
  }

  handleChange(target: any, propertyKey: string | symbol, oldValue: any, newValue: any): void {
    this.#subscriber.handleChange(target, propertyKey, oldValue, newValue);
  }
}

export class FallbackPropertyObserver implements PropertyObserver {
  #computedObserver: ComputedObserver;
  #subscriber: SubscriberObject;
  #oldValue: any;
  #currentValue: any;
  #target: any;
  #propertyKey!: string | symbol;
  #func!: Function;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
    this.#computedObserver = new ComputedObserver(this);
  }

  observe(target: any, propertyKey: string | symbol) {
    this.#target = target;
    this.#propertyKey = propertyKey;
    this.#func = () => this.#target[propertyKey];
    this.#oldValue = this.#currentValue;
    this.#currentValue = this.#computedObserver.observe(this.#func);
    return this.#currentValue;
  }

  disconnect(): void {
    this.#target = null;
    this.#oldValue = null;
    this.#currentValue = null;
    this.#computedObserver.disconnect();
  }

  handleChange(): void {
    this.#oldValue = this.#currentValue;
    this.#currentValue = this.#computedObserver.observe(this.#func);
    this.#subscriber.handleChange(this.#target, this.#propertyKey, this.#oldValue, this.#currentValue);
  }
}