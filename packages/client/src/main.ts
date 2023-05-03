import { ReactivityEngine, observable } from "@bluespire/reactivity";
import { testReactivityEngineOne } from "@bluespire/test-reactivity-engine-one";
import { html } from "@bluespire/test-view-engine";

ReactivityEngine.install(testReactivityEngineOne);

class Model {
  @observable accessor firstName = "Rob";
}

const template = html`
  <span data-bind=":innerText=firstName"></span>
`;

const instance = new Model();
const view = template.create();

view.bind(instance);
view.appendTo(document.body);