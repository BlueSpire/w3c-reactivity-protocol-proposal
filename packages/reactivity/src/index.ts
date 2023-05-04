export type SubscriberObject = {
  handleChange(target: object, ...args: any[]): void;
};

export type SubscriberCallback = (target: object, ...args: any[]) => void;

export type Subscriber = SubscriberObject | SubscriberCallback;

export const Subscriber = Object.freeze({
  normalize(subscriber: Subscriber): SubscriberObject {
    if (typeof subscriber === "function") {
      return { handleChange: subscriber };
    }
  
    return subscriber;
  }
});

export interface PropertyObserver {
  observe(target: any, propertyKey: string | symbol): any;
  disconnect(): void;
}

export interface ComputedObserver {
  observe(func: Function, ...args: any[]): any;
  disconnect(): void;
}

export interface ReactivityEngine {
  onAccess(target: object, propertyKey: string | symbol): void;
  onChange(target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void;
  createPropertyObserver?(subscriber: Subscriber): PropertyObserver;
  createComputedObserver(subscriber: Subscriber): ComputedObserver;
}

const noopFunc = () => void 0;

class NonObservingComputedObserver implements ComputedObserver {
  constructor(_: Subscriber) {}

  observe(func: Function, ...args: any[]) {
    return func.apply(null, args);
  }

  disconnect = noopFunc;
}

let noopEngine: ReactivityEngine = {
  onAccess: noopFunc,
  onChange: noopFunc,
  createComputedObserver(subscriber: Subscriber) {
    return new NonObservingComputedObserver(subscriber);
  }
};

class FallbackPropertyObserver implements PropertyObserver {
  #computedObserver: ComputedObserver;
  #subscriber: SubscriberObject;
  #oldValue: any;
  #currentValue: any;
  #target: any;
  #func!: Function;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
    this.#computedObserver = currentEngine.createComputedObserver(this);
  }

  observe(target: any, propertyKey: string | symbol) {
    this.#target = target;
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
    this.#subscriber.handleChange(this.#target, this.#oldValue, this.#currentValue);
  }
}

let currentEngine: ReactivityEngine = noopEngine;

/**
 * Enables a reactivity engine to install its implementation.
 */
export const ReactivityEngine = Object.freeze({
  install(engine: ReactivityEngine) {
    if (currentEngine !== noopEngine) {
      throw new Error("You can only set the reactivity engine once.");
    }

    currentEngine = engine;
  }
});

export const PropertyObserver = (subscriber: Subscriber) => {
  if (currentEngine.createPropertyObserver) {
    return currentEngine.createPropertyObserver(subscriber);
  }

  return new FallbackPropertyObserver(subscriber) as PropertyObserver; 
}

export const ComputedObserver = (subscriber: Subscriber) => {
  return currentEngine.createComputedObserver(subscriber);
}

/**
 * Implement reactive properties.
 * @remarks
 * Primarily used by application developers to implement reactive components and models.
 */
export const Observable = Object.freeze({
  trackAccess(target: object, propertyKey: string | symbol): void {
    currentEngine.onAccess(target, propertyKey);
  },

  trackChange(target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void {
    currentEngine.onChange(target, propertyKey, oldValue, newValue);
  },

  getAccessors(object: any) {
    // TODO: return metadata
    return [];
  },

  defineProperty(target: object, propertyKey: string | symbol): void {
    const field = new WeakMap();

    // TODO: store metadata

    Reflect.defineProperty(target, propertyKey, {
      get() {
        currentEngine.onAccess(this, propertyKey);
        return field.get(this);
      },

      set(newValue) {
        const oldValue = field.get(this);
        field.set(this, newValue);
        currentEngine.onChange(this, propertyKey, oldValue, newValue);
      }
    });
  }
});

export function observable(value: any, context: ClassAccessorDecoratorContext) {
  switch (context.kind) {
    case "accessor":
      let { get, set } = value;

      // TODO: store metadata

      return {
        get() {
          currentEngine.onAccess(this, context.name);
          return get.call(this);
        },

        set(newValue: any) {
          const oldValue = get.call(this);
          set.call(this, newValue);
          currentEngine.onChange(this, context.name, oldValue, newValue);
        }
      };
    default:
      throw new Error(`The observable decorator cannot be used on ${context.kind} targets.`);
  }
}

/**
 * Observe properties and functions.
 * @remarks
 * Primarily used by application developers when they need to explicitly observe changes in state.
 */
export const Watch = Object.freeze({
  property(subscriber: Subscriber, target: object, propertyKey: string | symbol): PropertyObserver {
    const o = PropertyObserver(subscriber);
    o.observe(target, propertyKey);
    return o;
  },

  computed(subscriber: Subscriber, func: Function, ...args: any[]): ComputedObserver {
    const o = ComputedObserver(subscriber);
    o.observe(func, ...args);
    return o;
  }
});