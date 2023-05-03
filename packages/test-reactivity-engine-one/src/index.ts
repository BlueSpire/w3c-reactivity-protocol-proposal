import { SubscriberObject } from "@bluespire/reactivity";
import { Observer, ReactivityEngine } from "@bluespire/reactivity";

let watcher: ComputedObserver | null = null;
const notifierLookup = new WeakMap<any, PropertyChangeNotifier>();
const volatileRegex = /(:|&&|\|\||if)/;

class SubscriberSet {
  private sub1: SubscriberObject | undefined = void 0;
  private sub2: SubscriberObject | undefined = void 0;
  private spillover: SubscriberObject[] | undefined = void 0;

  public readonly subject: any;

  public constructor(subject: any) {
    this.subject = subject;
  }

  public has(subscriber: SubscriberObject): boolean {
    return this.spillover === void 0
      ? this.sub1 === subscriber || this.sub2 === subscriber
      : this.spillover.indexOf(subscriber) !== -1;
  }

  public subscribe(subscriber: SubscriberObject): void {
    const spillover = this.spillover;

    if (spillover === void 0) {
      if (this.has(subscriber)) {
        return;
      }

      if (this.sub1 === void 0) {
        this.sub1 = subscriber;
        return;
      }

      if (this.sub2 === void 0) {
        this.sub2 = subscriber;
        return;
      }

      this.spillover = [this.sub1, this.sub2, subscriber];
      this.sub1 = void 0;
      this.sub2 = void 0;
    } else {
      const index = spillover.indexOf(subscriber);
      if (index === -1) {
        spillover.push(subscriber);
      }
    }
  }

  public unsubscribe(subscriber: SubscriberObject): void {
    const spillover = this.spillover;

    if (spillover === void 0) {
      if (this.sub1 === subscriber) {
        this.sub1 = void 0;
      } else if (this.sub2 === subscriber) {
        this.sub2 = void 0;
      }
    } else {
      const index = spillover.indexOf(subscriber);
      if (index !== -1) {
        spillover.splice(index, 1);
      }
    }
  }

  public notify(...args: any[]): void {
    const spillover = this.spillover;
    const subject = this.subject;

    if (spillover === void 0) {
      const sub1 = this.sub1;
      const sub2 = this.sub2;

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
  private subscribers: Record<string | symbol, SubscriberSet> = {};
  private subjectSubscribers: SubscriberSet | null = null;

  public readonly subject: any;

  public constructor(subject: any) {
    this.subject = subject;
  }

  public notify(propertyKey: string | symbol, oldValue: any, newValue: any): void {
    this.subscribers[propertyKey]?.notify(propertyKey, oldValue, newValue);
    this.subjectSubscribers?.notify(propertyKey, oldValue, newValue);
  }

  public subscribe(subscriber: SubscriberObject, propertyToWatch?: string | symbol): void {
    let subscribers: SubscriberSet;

    if (propertyToWatch) {
      subscribers =
        this.subscribers[propertyToWatch] ??
        (this.subscribers[propertyToWatch] = new SubscriberSet(this.subject));
    } else {
      subscribers =
        this.subjectSubscribers ??
        (this.subjectSubscribers = new SubscriberSet(this.subject));
    }

    subscribers.subscribe(subscriber);
  }

  public unsubscribe(subscriber: SubscriberObject, propertyToUnwatch?: string | symbol): void {
    if (propertyToUnwatch) {
      this.subscribers[propertyToUnwatch]?.unsubscribe(subscriber);
    } else {
      this.subjectSubscribers?.unsubscribe(subscriber);
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

class ComputedObserver extends SubscriberSet implements Observer {
  private needsRefresh: boolean = true;
  private isVolatileBinding = false;
  private first: SubscriptionRecord = this as any;
  private last: SubscriptionRecord | null = null;

  constructor(private func: Function) {
    super(func);
    this.isVolatileBinding = volatileRegex.test(func.toString());
  }

  observe(...args: unknown[]): unknown {
    if (this.needsRefresh && this.last !== null) {
      this.dispose();
    }

    const previousWatcher = watcher;
    watcher = this.needsRefresh ? this : null;
    this.needsRefresh = this.isVolatileBinding;
    let result;

    try {
      result = this.func.apply(null, args);
    } finally {
      watcher = previousWatcher;
    }

    return result;
  }

  subscribe(subscriber: SubscriberObject): void {
    super.subscribe(subscriber);
  }

  unsubscribe(subscriber: SubscriberObject): void {
    super.unsubscribe(subscriber);
  }

  dispose(): void {
    if (this.last !== null) {
      let current = this.first;

      while (current !== void 0) {
        current.notifier.unsubscribe(this, current.propertyName);
        current = current.next!;
      }

      this.last = null;
      this.needsRefresh = true;
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
        if (!this.needsRefresh) {
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
                this.needsRefresh = true;
            }
        }

        prev.next = current;
    }

    this.last = current!;
  }

  handleChange(): void {
    if (this.last !== null) {
      this.notify();
    }
  }
}

export const testReactivityEngineOne: ReactivityEngine = {
  onAccess(target: object, propertyKey: string | symbol): void {
    watcher && watcher.watch(target, propertyKey);
  },

  onChange(target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void {
    getNotifier(target).notify(propertyKey, oldValue, newValue);
  },

  createComputedObserver(func: Function): Observer {
    return new ComputedObserver(func);
  }
};