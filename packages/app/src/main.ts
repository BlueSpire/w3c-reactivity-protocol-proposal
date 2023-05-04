import { PropertyObserver, ReactivityEngine } from "@w3c-protocols/reactivity";
import { testReactivityEngineOne } from "@bluespire/test-reactivity-engine-one";
import { testReactivityEngineTwo } from "@bluespire/test-reactivity-engine-two";
import { Counter } from "./counter.js";
import { template as counterTemplate } from "./counter.template.js";


ReactivityEngine.install(testReactivityEngineTwo);

const model = new Counter();
counterTemplate.render(model, document.body);

const watcher = new PropertyObserver((_, ov, nv) => console.log(`Counter updated from ${ov} to ${nv}.`));
watcher.observe(model, "count");