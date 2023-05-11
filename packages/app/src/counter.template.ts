import { html } from "@bluespire/test-view-engine";

export const template = html`
  <button data-bind="@click=decrement" class="action">-</button>
  <span data-bind=":innerText=count" class="counter"></span>
  <button data-bind="@click=increment" class="action">+</button>
`;