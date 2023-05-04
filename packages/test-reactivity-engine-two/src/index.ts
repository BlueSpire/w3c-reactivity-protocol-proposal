import { 
  type ReactivityEngine, 
  type ComputedObserver as IComputedObserver, 
  Subscriber, 
  type SubscriberObject
} from "@w3c-protocols/reactivity";

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

function incrementVersion(target: any, propertyKey: string | symbol) {
  const versionId = getVersionId(target, propertyKey);
  const currentVersion = versions[versionId];

  if (currentVersion === void 0) {
    versions[versionId] = 1;
  } else {
    versions[versionId] = currentVersion + 1;
  }
}

interface ObserverListItem {
  next: ObserverListItem | null;
  prev: ObserverListItem | null;
  check(): void;
}

class ObserverList {
  #head: ObserverListItem | null = null;
  #tail: ObserverListItem | null = null;
  
  add(item: ObserverListItem) {
    if (item.prev || item === this.#head) {
      return;
    }
  
    if (this.#tail !== null) {
      this.#tail.next = item;
      item.prev = this.#tail;
      this.#tail = item;
    } else {
      this.#head = item;
      this.#tail = item;
    }
  }

  remove(item: ObserverListItem) {
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

  check() {
    let current = this.#head;
  
    while (current !== null) {
      current.check();
      current = current.next;
    }
  }
}

let watcher: ComputedObserver | null = null;
const currentList = new ObserverList();

class ComputedObserver implements IComputedObserver, ObserverListItem {
  #deps: Record<string, number> = Object.create(null);
  #subscriber: SubscriberObject;

  prev: ComputedObserver | null = null;
  next: ComputedObserver | null = null;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
  }

  observe(func: Function, ...args: any[]) {
    currentList.add(this);

    const previousWatcher = watcher;
    watcher = this;
    let result;

    try {
      result = func(...args);
    } finally {
      watcher = previousWatcher;
    }

    return result;
  }

  disconnect(): void {
    currentList.remove(this);
  }

  watch(target: any, propertyKey: string | symbol) {
    const versionId = getVersionId(target, propertyKey);
    const version = getVersion(versionId);
    this.#deps[versionId] = version;
  }

  check() {
    let needsNotify = false;
    const deps = this.#deps;

    for (const versionId in deps) {
      const currentVersion = deps[versionId];
      const latestVersion = versions[versionId];
      
      if (latestVersion > currentVersion) {
        needsNotify = true;
        deps[versionId] = latestVersion;
      }
    }

    if (needsNotify) {
      this.#subscriber.handleChange(this);
    }
  }
}

export const testReactivityEngineTwo: ReactivityEngine = {
  onAccess: function (target: object, propertyKey: string | symbol): void {
    watcher && watcher.watch(target, propertyKey);
  },
  
  onChange: function (target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void {
    incrementVersion(target, propertyKey);

    // TODO: queue and account for changes that happen during traversal
    currentList.check();
  },

  createComputedObserver(subscriber: Subscriber): IComputedObserver {
    return new ComputedObserver(subscriber);
  }
};