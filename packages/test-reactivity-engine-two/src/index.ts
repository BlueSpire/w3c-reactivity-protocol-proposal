import { 
  type ReactivityEngine, 
  type ComputedObserver as IComputedObserver, 
  Subscriber, 
  type SubscriberObject
} from "@bluespire/reactivity";

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

let watcher: ComputedObserver | null = null;

class ComputedObserver implements IComputedObserver {
  #deps: Record<string, number> = Object.create(null);
  #subscriber: SubscriberObject;

  prev: ComputedObserver | null = null;
  next: ComputedObserver | null = null;

  constructor(subscriber: Subscriber) {
    this.#subscriber = Subscriber.normalize(subscriber);
  }

  observe(func: Function, ...args: any[]) {
    addToList(this);

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
    removeFromList(this);
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
    checkList();
  },

  createComputedObserver(subscriber: Subscriber): IComputedObserver {
    return new ComputedObserver(subscriber);
  }
};