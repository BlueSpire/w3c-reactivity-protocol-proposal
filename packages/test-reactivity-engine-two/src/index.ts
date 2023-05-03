import { Observer, ReactivityEngine, SubscriberObject } from "@bluespire/reactivity";

let watcher: ComputedObserver | null = null;

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

let objectId = 0;
function nextObjectId() {
  return ++objectId;
}

const objectIds = new WeakMap<any, number>();
const versions: Record<string, number> = {};

function getVersionId(target: any, propertyKey: string | symbol) {
  let id = objectIds.get(target);
  
  if (id === void 0) {
    id = nextObjectId();
    objectIds.set(target, id);
  }

  return `${id}:${String(propertyKey)};`;
}

function getVersion(versionId: string) {
  return versions[versionId] ?? (versions[versionId] = 0);
}

let head: ComputedObserver | null = null;
let tail: ComputedObserver | null = null;

function addToList(item: ComputedObserver) {
  if (item.prev || item === head) {
    return;
  }

  if (tail !== null) {
    tail.next = item;
    item.prev = tail;
    tail = item;
  } else {
    head = item;
    tail = item;
  }
}

function removeFromList(item: ComputedObserver) {
  const next = item.next;
  const prev = item.prev;

  if (next) {
    next.prev = prev;
  }

  if (prev) {
    prev.next = next;
  }

  item.next = null;
  item.prev = null;
}

function checkList() {
  let current = head;

  while (current !== null) {
    current.check();
    current = current.next;
  }
}

class ComputedObserver extends SubscriberSet implements Observer {
  deps: Record<string, number> = Object.create(null);
  prev: ComputedObserver | null = null;
  next: ComputedObserver | null = null;

  observe(...args: any[]) {
    addToList(this);

    const previousWatcher = watcher;
    watcher = this;
    let result;

    try {
      result = this.subject.apply(null, args);
    } finally {
      watcher = previousWatcher;
    }

    return result;
  }

  disconnect(): void {
    removeFromList(this);
  }

  watch(target: any, propertyKey: string | symbol) {
    const versionId = getVersionId(target, propertyKey);
    const version = getVersion(versionId);
    this.deps[versionId] = version;
  }

  check() {
    let needsNotify = false;
    const deps = this.deps;

    for (const versionId in deps) {
      const currentVersion = deps[versionId];
      const latestVersion = versions[versionId];
      
      if (latestVersion > currentVersion) {
        needsNotify = true;
        deps[versionId] = latestVersion;
      }
    }

    if (needsNotify) {
      this.notify();
    }
  }
}

export const testReactivityEngineTwo: ReactivityEngine = {
  onAccess: function (target: object, propertyKey: string | symbol): void {
    watcher && watcher.watch(target, propertyKey);
  },
  
  onChange: function (target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void {
    const versionId = getVersionId(target, propertyKey);
    versions[versionId] = getVersion(versionId) + 1;
    checkList();
  },

  createComputedObserver: function (func: Function): Observer {
    return new ComputedObserver(func);
  }
};