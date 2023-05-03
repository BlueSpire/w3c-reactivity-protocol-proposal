import { ReactivityEngine, Watch } from "@bluespire/reactivity";
import { testReactivityEngineOne } from "@bluespire/test-reactivity-engine-one";
import { Counter } from "./counter.js";
import { template as counterTemplate } from "./coutner.template.js";
import { testReactivityEngineTwo } from "@bluespire/test-reactivity-engine-two";

ReactivityEngine.install(testReactivityEngineTwo);

const model = new Counter();
counterTemplate.render(model, document.body);

Watch.property(
  model, 
  "count", 
  (_, oldValue, newValue) => console.log(`Counter updated from ${oldValue} to ${newValue}.`)
);