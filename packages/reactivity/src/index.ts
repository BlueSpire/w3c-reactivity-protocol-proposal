export type SubscriberObject<T = any> = {
  handleChange(target: T, ...args: any[]): void;
};

export type SubscriberCallback<T = any> = (target: T, ...args: any[]) => void;

export type Subscriber<T = any> = SubscriberObject<T> | SubscriberCallback<T>;

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

export interface ObjectObserver {
  observe(target: any): any;
  disconnect(): void;
}

export interface ComputedObserver {
  observe(func: Function, ...args: any[]): any;
  disconnect(): void;
}

export interface ReactivityEngine {
  onAccess(target: object, propertyKey: string | symbol): void;
  onChange(target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void;
  createPropertyObserver(subscriber: Subscriber): PropertyObserver;
  createObjectObserver(subscriber: Subscriber): ObjectObserver;
  createComputedObserver(subscriber: Subscriber): ComputedObserver;
}

const noopFunc = () => void 0;

const noopComputedObserver: ComputedObserver = {
  disconnect: noopFunc,
  observe(func: Function, ...args: any[]) {
    return func(...args);
  }
};

const noopObjectObserver: ObjectObserver = {
  disconnect: noopFunc,
  observe(target: any) {
    return target;
  }
};

const noopPropertyObserver: PropertyObserver = {
  disconnect: noopFunc,
  observe(target: any, propertyKey: string | symbol) {
    return target[propertyKey];
  },
};

const noopEngine: ReactivityEngine = {
  onAccess: noopFunc,
  onChange: noopFunc,
  createPropertyObserver() { return noopPropertyObserver;  },
  createObjectObserver() { return noopObjectObserver; },
  createComputedObserver() { return noopComputedObserver;  }
};

let currentEngine: ReactivityEngine = noopEngine;

/**
 * Enables a reactivity engine to install its implementation.
 */
export const ReactivityEngine = Object.freeze({
  /**
   * Installs a reactivity engine.
   * @param engine The engine to install.
   */
  install(engine: ReactivityEngine) {
    if (currentEngine !== noopEngine) {
      throw new Error("You can only set the reactivity engine once.");
    }

    currentEngine = engine;
  }
});

export const PropertyObserver = (function (subscriber: Subscriber) {
  return currentEngine.createPropertyObserver(subscriber); 
}) as any as {
  prototype: PropertyObserver;
  new(subscriber: Subscriber): PropertyObserver;
}

export const ObjectyObserver = (function (subscriber: Subscriber) {
  return currentEngine.createObjectObserver(subscriber); 
}) as any as {
  prototype: ObjectObserver;
  new(subscriber: Subscriber): ObjectObserver;
}

export const ComputedObserver = (function (subscriber: Subscriber) {
  return currentEngine.createComputedObserver(subscriber);
}) as any as {
  prototype: ComputedObserver;
  new(subscriber: Subscriber<ComputedObserver>): ComputedObserver;
};

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

  defineProperty(target: object, propertyKey: string | symbol, initializer?: () => any): void {
    const field = new WeakMap();

    // TODO: store metadata

    function getValue(instance: object) {
      if (initializer && !field.has(instance)) {
        field.set(instance, initializer());
      }

      return field.get(instance);
    }

    Reflect.defineProperty(target, propertyKey, {
      get() {
        currentEngine.onAccess(this, propertyKey);
        return getValue(this);
      },

      set(newValue) {
        const oldValue = getValue(this);
        field.set(this, newValue);
        currentEngine.onChange(this, propertyKey, oldValue, newValue);
      }
    });
  }
});

/**
 * A decorator for accessors that makes them observable.
 */
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