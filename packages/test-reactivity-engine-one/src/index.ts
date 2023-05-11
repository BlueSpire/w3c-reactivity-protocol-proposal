import {
  type ReactivityEngine,
  Subscriber,
  type SubscriberObject, 
  type ComputedObserver as IComputedObserver,
  type PropertyObserver as IPropertyObserver,
  type ObjectObserver as IObjectObserver,
  ObjectyObserver
} from "@w3c-protocols/reactivity";

let watcher: ComputedObserver | null = null;
const notifierLookup = new WeakMap<any, PropertyChangeNotifier>();
const volatileRegex = /(:|&&|\|\||if)/;

class SubscriberSet {
  #sub1: SubscriberObject | undefined = void 0;
  #sub2: SubscriberObject | undefined = void 0;
  #spillover: SubscriberObject[] | undefined = void 0;

  public readonly subject: any;

  public constructor(subject: any) {
    this.subject = subject;
  }

  public has(subscriber: SubscriberObject): boolean {
    return this.#spillover === void 0
      ? this.#sub1 === subscriber || this.#sub2 === subscriber
      : this.#spillover.indexOf(subscriber) !== -1;
  }

  public subscribe(subscriber: SubscriberObject): void {
    const spillover = this.#spillover;

    if (spillover === void 0) {
      if (this.has(subscriber)) {
        return;
      }

      if (this.#sub1 === void 0) {
        this.#sub1 = subscriber;
        return;
      }

      if (this.#sub2 === void 0) {
        this.#sub2 = subscriber;
        return;
      }

      this.#spillover = [this.#sub1, this.#sub2, subscriber];
      this.#sub1 = void 0;
      this.#sub2 = void 0;
    } else {
      const index = spillover.indexOf(subscriber);
      if (index === -1) {
        spillover.push(subscriber);
      }
    }
  }

  public unsubscribe(subscriber: SubscriberObject): void {
    const spillover = this.#spillover;

    if (spillover === void 0) {
      if (this.#sub1 === subscriber) {
        this.#sub1 = void 0;
      } else if (this.#sub2 === subscriber) {
        this.#sub2 = void 0;
      }
    } else {
      const index = spillover.indexOf(subscriber);
      if (index !== -1) {
        spillover.splice(index, 1);
      }
    }
  }

  public notify(...args: any[]): void {
    const spillover = this.#spillover;
    const subject = this.subject;

    if (spillover === void 0) {
      const sub1 = this.#sub1;
      const sub2 = this.#sub2;

      if (sub1 !== void 0) {
        sub1.handleChange(subject, ...args);
      }

      if (sub2 !== void 0) {
        sub2.handleChange(subject, ...args);
      }
    } else {
      for (let i = 0, ii = spillover.length; i < ii; ++i) {
        spillover[i].handleChange(subject, ...args);
      }
    }
  }
}

class PropertyChangeNotifier {
  #subscribers: Record<string | symbol, SubscriberSet> = {};
  #subjectSubscribers: SubscriberSet | null = null;

  public readonly subject: any;

  public constructor(subject: any) {
    this.subject = subject;
  }

  public notify(propertyKey: string | symbol, oldValue: any, newValue: any): void {
    this.#subscribers[propertyKey]?.notify(propertyKey, oldValue, newValue);
    this.#subjectSubscribers?.notify(propertyKey, oldValue, newValue);
  }

  public subscribe(subscriber: SubscriberObject, propertyToWatch?: string | symbol): void {
    let subscribers: SubscriberSet;

    if (propertyToWatch) {
      subscribers =
        this.#subscribers[propertyToWatch] ??
        (this.#subscribers[propertyToWatch] = new SubscriberSet(this.subject));
    } else {
      subscribers =
        this.#subjectSubscribers ??
        (this.#subjectSubscribers = new SubscriberSet(this.subject));
    }

    subscribers.subscribe(subscriber);
  }

  public unsubscribe(subscriber: SubscriberObject, propertyToUnwatch?: string | symbol): void {
    if (propertyToUnwatch) {
      this.#subscribers[propertyToUnwatch]?.unsubscribe(subscriber);
    } else {
      this.#subjectSubscribers?.unsubscribe(subscriber);
    }
  }
}


function getNotifier(source: any): PropertyChangeNotifier {
  let found = source.$fastController ?? notifierLookup.get(source);

  if (found === void 0) {
    notifierLookup.set(
      source,
      (found = new PropertyChangeNotifier(source))
    );
  }

  return found;
}

interface SubscriptionRecord {
  propertySource: any;
  propertyName: string | symbol;
  notifier: PropertyChangeNotifier;
  next: SubscriptionRecord | undefined;
}

class ComputedObserver implements IComputedObserver {
  #needsRefresh: boolean = true;
  #isVolatileBinding = false;
  #subscriber: SubscriberObject;
  #func!: Function;

  private first: SubscriptionRecord = this as any;
  private last: SubscriptionRecord | null = null;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
  }

  observe(func: Function, ...args: any[]): any {
    if (func !== this.#func) {
      this.#isVolatileBinding = volatileRegex.test(func.toString());
      this.#func = func;
    }

    if (this.#needsRefresh && this.last !== null) {
      this.disconnect();
    }

    const previousWatcher = watcher;
    watcher = this.#needsRefresh ? this : null;
    this.#needsRefresh = this.#isVolatileBinding;
    let result;

    try {
      result = func(...args);
    } finally {
      watcher = previousWatcher;
    }

    return result;
  }

  disconnect(): void {
    if (this.last !== null) {
      let current = this.first;

      while (current !== void 0) {
        current.notifier.unsubscribe(this, current.propertyName);
        current = current.next!;
      }

      this.last = null;
      this.#needsRefresh = true;
    }
  }

  watch(target: object, propertyKey: string | symbol) {
    const prev = this.last;
    const notifier = getNotifier(target);
    const current: SubscriptionRecord = prev === null ? this.first : ({} as any);

    current.propertySource = target;
    current.propertyName = propertyKey;
    current.notifier = notifier;

    notifier.subscribe(this, propertyKey);

    if (prev !== null) {
        if (!this.#needsRefresh) {
            // Declaring the variable prior to assignment below circumvents
            // a bug in Angular's optimization process causing infinite recursion
            // of this watch() method. Details https://github.com/microsoft/fast/issues/4969
            let prevValue;
            watcher = null;
            /* eslint-disable-next-line */
            prevValue = prev.propertySource[prev.propertyName];
            /* eslint-disable-next-line */
            watcher = this;

            if (target === prevValue) {
                this.#needsRefresh = true;
            }
        }

        prev.next = current;
    }

    this.last = current!;
  }

  handleChange(): void {
    // TODO: queue
    
    if (this.last !== null) {
      this.#subscriber.handleChange(this);
    }
  }
}

class PropertyObserver implements IPropertyObserver {
  #subscriber: SubscriberObject;
  #notifier: PropertyChangeNotifier | null = null;
  #propertyKey: string | symbol | null = null;
  #oldValue: any;
  #currentValue: any;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
  }

  observe(target: any, propertyKey: string | symbol) {
    const notifier = getNotifier(target);
    if (this.#notifier !== notifier) {
      this.disconnect();
    }

    this.#notifier = notifier;
    this.#propertyKey = propertyKey;
    this.#notifier.subscribe(this, propertyKey);
    this.#oldValue = this.#currentValue;
    this.#currentValue = target[propertyKey];

    return this.#currentValue;
  }

  disconnect(): void {
    if (this.#notifier && this.#propertyKey) {
      this.#notifier.unsubscribe(this.#subscriber, this.#propertyKey);
      this.#notifier = null;
      this.#propertyKey = null;
      this.#oldValue = null;
      this.#currentValue = null;
    }
  }

  handleChange() {
    this.#oldValue = this.#currentValue;
    this.#currentValue = this.#notifier!.subject[this.#propertyKey!];
    this.#subscriber.handleChange(this.#notifier!.subject, this.#propertyKey, this.#oldValue, this.#currentValue);
  }
}

class ObjectObserver implements IObjectObserver {
  #subscriber: SubscriberObject;
  #notifier: PropertyChangeNotifier | null = null;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
  }

  observe(target: any) {
    const notifier = getNotifier(target);
    if (this.#notifier !== notifier) {
      this.disconnect();
    }

    this.#notifier = notifier;
    this.#notifier.subscribe(this);

    return target;
  }

  disconnect(): void {
    if (this.#notifier) {
      this.#notifier.unsubscribe(this.#subscriber);
      this.#notifier = null;
    }
  }

  handleChange(target: any, propertyKey: string | symbol, oldValue: any, newValue: any) {
    this.#subscriber.handleChange(target, propertyKey, oldValue, newValue);
  }
}

export const testReactivityEngineOne: ReactivityEngine = {
  onAccess(target: object, propertyKey: string | symbol): void {
    watcher && watcher.watch(target, propertyKey);
  },

  onChange(target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void {
    getNotifier(target).notify(propertyKey, oldValue, newValue);
  },

  createComputedObserver(subscriber: Subscriber): IComputedObserver {
    return new ComputedObserver(subscriber);
  },

  createPropertyObserver(subscriber: Subscriber): IPropertyObserver {
    return new PropertyObserver(subscriber);
  },

  createObjectObserver(subcriber: Subscriber): IObjectObserver {
    return new ObjectObserver(subcriber);
  }
};