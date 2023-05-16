# W3C Reactivity Protocol Proposal

The primary purpose of this repo is to research, experiment, and try to understand whether a general reactivity protocol is feasible, allowing:

  * Model systems to decouple themselves from view engines and reactivity libraries. 
  * View engines to decouple themselves from reactivity libraries.
  * Native HTML templates to be able to rely on minimal APIs, even if the browser doesn't yet ship with an implementation.

Achieving this would enable application developers to:

* Swap out their view layers without needing to re-write their models.
* More easily mix multiple view layer technologies together without sync/reliability problems.
* Choose between multiple reactivity implementations, picking the one that has the best performance characteristics based on their application needs. For example, one engine might be faster for initial view rendering, but another might be faster for view updating. Engines could also be selected based on target device. So, a lower memory engine could be used on mobile devices, for example.

## Consumers

There are three different consumers of the protocol: reactivity engines, view engines, and model/application developers. Let's look at the proposal from each of these perspectives, in reverse order.

### Model and Application Developers

The primary APIs needed by app developers are those that enable them to create reactive values and models. The protocol provides both a declarative and an imperative way of creating property signals. It also provides low-level APIs for creating custom signals.

**Example: Declaring a model with an observable property**

```ts
import { observable } from "@w3c-protocols/reactivity";

export class Counter {
  @observable accessor count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}
```

The `observable` decorator creates an observable property. The underlying protocol doesn't provide an implementation of the signal infrastructure, just a way for the model/app developer to declare something as reactive. We'll look at how the reactivity implementation provides the implementation shortly. There's also an imperative API, which can be used on any object like this:

**Example: Using the imperative API to define an observable property**

```ts
import { Observable } from "@w3c-protocols/reactivity";

Observable.defineProperty(someObject, "someProperty");
```

Under the hood, both the declarative and the imperative APIs create properties where the getter calls the configured reactivity engine's `onAccess()` callback and the setter calls the engine's `onChange()` callback. 

The protocol provides a facade to the underlying engine via the `Observable.trackAccess()` and `Observable.trackChange()` APIs for consumers that want to create custom signals. Here's how one could create a simple signal on top of the protocol:

**Example: Creating a custom signal**

```ts
import { Observable } from "@w3c-protocols/reactivity";

export function signal(value, name = generateUniqueSignalName()) {
  const getValue = () => {
    Observable.trackAccess(getValue, name);
    return value;
  }

  const setValue = newValue => {
    const oldValue = value;
    value = newValue;
    Observable.trackChange(getValue, name, oldValue, newValue);
  }

  getValue.set = setValue;
  Reflect.defineProperty(getValue, "name", { value: name });

  return getValue;
}
```

**Example: Using a custom signal**

```ts
const count = signal(0);
console.log('The count is: ' + count());

count.set(3);
console.log('The count is: ' + count());
```

### View Engine Developers

While app developers have a primary use case of creating reactive values, models, and components, view engine developers primarily need to observe these reactive objects, so they can update DOM. The primary APIs being proposed for this are `ObjectObserver`, `PropertyObserver`, and `ComputedObserver`. These are named and their APIs are designed to follow the existing patterns put in place by `MutationObserver`, `ResizeObserver`, and `IntersectionObserver`. A view engine that wants to observe a binding and then update DOM would use the API like this:

**Example: A view engine updating the DOM whenever a binding changes**

```ts
import { ComputedObserver } from "@w3c-protocols/reactivity";

const updateDOM = () => element.innerText = counter.count;
const observer = new ComputedObserver(o => o.observe(updateDOM));
observer.observe(updateDOM);
```

In fact, you may recognize this as the `effect` pattern, provided by various libraries, which could generally be implemented on top of the protocol like this:

**Example: Implementing an effect helper on top of the protocol**

```ts
function effect(func: Function) {
  const observer = new ComputedObserver(o => o.observe(func));
  observer.observe(func);
  return observer;
}
```

**Example: Using an effect helper to update the DOM**

```ts
effect(() => element.innerText = counter.count);
```

Each of the `*Observer` classes take a `Subcriber` in its consturctor, just like the standard `MutationObserver`, `ResizeObserver`, and `IntersectionObserver`. Following the same pattern, they each also have `observe(...)` and `disconnect()` methods. The implementation of each of these is provided by the underlying reactivity engine.

### Reactivity Engine Developers

A reactivity engine must implement the following interface:

```ts
interface ReactivityEngine {
  onAccess(target: object, propertyKey: string | symbol): void;
  onChange(target: object, propertyKey: string | symbol, oldValue: any, newValue: any): void;
  createComputedObserver(subscriber: Subscriber): ComputedObserver;
  createPropertyObserver(subscriber: Subscriber): PropertyObserver;
  createObjectObserver(subscriber: Subscriber): ObjectObserver;
}
```

The app developer can then plug in the reactivity engine of their choice, with the following code:

**Example: Configuring a reactivity engine**

```ts
import { ReactivityEngine } from "@w3c-protocols/reactivity";

// Install any engine that implements the interface.
ReactivityEngine.install(myFavoriteReactivityEngine);
```

**NOTE:** By default, the protocol provides a noop implementation, so all reactive models will function properly without reactivity enabled.

Here is a brief explanation of the interface methods:

* `onAccess(...)` - The protocol will call this whenever an observable value is accessed, allowing the underlying implementation to track the access. This is invoked from the getter of a protocol-defined property. Custom signal implementations can also directly invoke this via `Observable.trackAccess(...)`.
* `onChange(...)` - The protocol will call this whenever an observable value changes, allowing the underlying implementation to respond to the change. This is invoked from the setter of a protocol-defined property. Custom signal implementations can also directly invoke this via `Observable.trackChange(...)`.
* `createComputedObserver(...)` - The protocol calls this whenever `new ComputedObserver()` runs so that the implementation can provide its own computed observation mechanism.
* `createPropertyObserver(...)` - The protocol calls this whenever `new PropertyObserver()` runs so that the implementation can provide its own property observation mechanism.
* `createObjectObserver(...)` - The protocol calls this whenever `new ObjectObserver()` runs so that the implementation can provide its own object observation mechanism.

Since `ObjectObserver` can be implemented in terms of `PropertyObserver` and `PropertyObserver` can both be implemented in terms of `ComputedObserver`, the protocol provides a `FallbackPropertyObserver` and `FallbackObjectObserver` that do just that. This means that the underlying implementation is only required to implement `createComputedObserver()`. But implementations can choose to optimize property and object observation if they want to by providing observers for these scenarios.

The proposal repo contains a work-in-progress design for this protocol. It also contains two test reactivity engine implementations, as well as a test view engine, and a test application.

> **WARNING:** Do not even think about using the test reactivity engines or the test view engine in a real app. They have been deliberately simplified, have known issues, and are not the least bit production-ready. They serve only to validate the protocol.

## Open Questions

* Should the protocol enable view engines to mark groups of observers for more efficient observe/disconnect?
  * e.g. `Observable.pushScope()`, `Observable.popScope()`, and `scope.disconnect()`.
* Should the protocol provide a way to create observable arrays and array observers?
  * e.g. `const a = Observable.array(1,2,3,4,5);` and `new ArrayObserver(...).observe(a);`;
* Should the shared protocol library take on the responsibility of implementing common patterns on top of the protocol such as `signal`, `effect`, and `resource`? (An effect implementation is currently provided.)