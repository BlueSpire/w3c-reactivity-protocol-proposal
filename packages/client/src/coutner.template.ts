import { html } from "@bluespire/test-view-engine";

export const template = html`
  <button data-bind="@click=decrement">-</button>
  <span data-bind=":innerText=count"></span>
  <button data-bind="@click=increment">+</button>
`;