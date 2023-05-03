import { ReactivityEngine, observable } from "@bluespire/reactivity";
import { testReactivityEngineOne } from "@bluespire/test-reactivity-engine-one";
import { html } from "@bluespire/test-view-engine";

ReactivityEngine.install(testReactivityEngineOne);

class Counter {
  @observable accessor count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}

const template = html`
  <button data-bind="@click=decrement">-</button>
  <span data-bind=":innerText=count"></span>
  <button data-bind="@click=increment">+</button>
`;

const instance = new Counter();
const view = template.create();

view.bind(instance);
view.appendTo(document.body);