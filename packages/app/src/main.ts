import { ObjectyObserver, PropertyObserver, ReactivityEngine } from "@w3c-protocols/reactivity";
import { testReactivityEngineOne } from "@bluespire/test-reactivity-engine-one";
import { testReactivityEngineTwo } from "@bluespire/test-reactivity-engine-two";
import { Counter } from "./counter.js";
import { template as counterTemplate } from "./counter.template.js";


ReactivityEngine.install(testReactivityEngineOne);

const model = new Counter();
counterTemplate.render(model, document.body);

const watcher1 = new PropertyObserver((_, p, ov, nv) => console.log(`PropertyObserver: Counter updated from ${ov} to ${nv}.`));
watcher1.observe(model, "count");

// NOTE: If the fallback is being used (engine two), the below will not update subscribers. 
// The reason for this is that we need the observable metadata to reliably make this work. 
// Once we have decorator metadata in place, we can fix this.
const watcher2 = new ObjectyObserver((_, p, ov, nv) => console.log(`ObjectObserver: Counter updated "${p}" from ${ov} to ${nv}.`));
watcher2.observe(model);