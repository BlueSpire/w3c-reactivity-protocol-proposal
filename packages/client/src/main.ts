import { PropertyObserver, ReactivityEngine } from "@bluespire/reactivity";
import { testReactivityEngineOne } from "@bluespire/test-reactivity-engine-one";
import { Counter } from "./counter.js";
import { template as counterTemplate } from "./coutner.template.js";
import { testReactivityEngineTwo } from "@bluespire/test-reactivity-engine-two";

ReactivityEngine.install(testReactivityEngineOne);

const model = new Counter();
counterTemplate.render(model, document.body);

const watcher = new PropertyObserver((_, ov, nv) => console.log(`Counter updated from ${ov} to ${nv}.`));
watcher.observe(model, "count");