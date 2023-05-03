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

export interface Disposable {
  dispose(): void;
}

export interface Observer extends Disposable {
  observe(...args: any[]): any;
  subscribe(subscriber: SubscriberObject): void;
  unsubscribe(subscriber: SubscriberObject): void;
}

export interface ReactivityEngine {
  onAccess(target: object, propertyKey: string | symbol): void;
  onChange(target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void;
  createPropertyObserver?(propertyKey: string | symbol): Observer;
  createComputedObserver(func: Function): Observer;
}

const noopFunc = () => void 0;

class NoopComputedObserver implements Observer {
  constructor(private func: Function) {}

  observe(...args: any[]) {
    return this.func.apply(null, args);
  }

  subscribe = noopFunc;
  unsubscribe = noopFunc;
  dispose = noopFunc;
}

let noopEngine: ReactivityEngine = {
  onAccess: noopFunc,
  onChange: noopFunc,
  createComputedObserver(func: Function) {
    return new NoopComputedObserver(func);
  }
};

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

/**
 * Create various types of observers.
 * @remarks
 * Primarily used by view engines to implement binding systems.
 */
export const Observer = Object.freeze({
  forProperty(propertyKey: string | symbol): Observer {
    if (currentEngine.createPropertyObserver) {
      return currentEngine.createPropertyObserver(propertyKey);
    }

    const func = (target: any) => target[propertyKey];
    return currentEngine.createComputedObserver(func);
  },

  forComputed(func: Function): Observer {
    return currentEngine.createComputedObserver(func);
  }
});

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
  property(target: object, propertyKey: string | symbol, subscriber: Subscriber): Disposable {
    const o = Observer.forProperty(propertyKey);
    const s = Subscriber.normalize(subscriber);
    o.subscribe(s);
    o.observe(target);
    return o;
  },

  computed(func: Function, subscriber: Subscriber, ...args: any[]): Disposable {
    const o = currentEngine.createComputedObserver(func);
    const originalSub = Subscriber.normalize(subscriber);
    const newSub = {
      handleChange(target: object, ...rest: any[]) {
        o.observe(...args);
        originalSub.handleChange(target, ...rest);
      }
    };

    o.subscribe(newSub);
    o.observe(...args);
    return o;
  }
});