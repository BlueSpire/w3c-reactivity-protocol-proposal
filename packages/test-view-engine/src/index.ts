import { Observer } from "@bluespire/reactivity";

export const DOMAspect = Object.freeze({
  none: 0,
  attribute: 1,
  booleanAttribute: 2,
  property: 3,
  content: 4,
  tokenList: 5,
  event: 6,
} as const);


export type DOMAspect = typeof DOMAspect[Exclude<keyof typeof DOMAspect, "none">];

interface Directive {
  sourceAspect: string;
  aspectType: DOMAspect;
  targetAspect: string;
  behavior: string;
}

function assignAspect(directive: Directive, value?: string): void {
  if (!value) {
      directive.aspectType = DOMAspect.content;
      return;
  }

  directive.sourceAspect = value;

  switch (value[0]) {
      case ":":
          directive.targetAspect = value.substring(1);
          directive.aspectType =
              directive.targetAspect === "classList"
                  ? DOMAspect.tokenList
                  : DOMAspect.property;
          break;
      case "?":
          directive.targetAspect = value.substring(1);
          directive.aspectType = DOMAspect.booleanAttribute;
          break;
      case "@":
          directive.targetAspect = value.substring(1);
          directive.aspectType = DOMAspect.event;
          break;
      default:
          directive.targetAspect = value;
          directive.aspectType = DOMAspect.attribute;
          break;
  }
}


const templateCache = new Map();
export class ViewTemplate {
  #template: HTMLTemplateElement | null = null;
  #html: string;
  #directives: Directive[] = []

  constructor(html: string) {
    this.#html = html;
  }

  create(): View {
    if (!this.#template) {
      this.#template = document.createElement("template");
      this.#template.innerHTML = this.#html;

      const directives = this.#directives;

      this.#template.content.querySelectorAll("[data-bind]").forEach(x => {
        const data = x.getAttribute("data-bind")!;
        const expressions = data.split(",").map(x => x.trim());

        for (let e of expressions) {
          const parts = e.split("=").map(x => x.trim());
          const directive: Directive = { behavior: parts[1] } as any;
          assignAspect(directive, parts[0]);
          directives.push(directive);
        }
      });
    }

    const fragment = this.#template.content.cloneNode(true) as DocumentFragment;
    return new View(fragment, this.#directives);
  }

  render(model: any, node: Node) {
    const view = this.create();
    view.bind(model);
    view.appendTo(node);
    return view;
  }

  static for(htmlText: string) {
    let found = templateCache.get(htmlText);
    
    if (!found) {
      found = new ViewTemplate(htmlText);
      templateCache.set(htmlText, found);
    }

    return found;
  }
}

interface Behavior {
  bind(model: any): void;
  unbind(): void;
}

interface BehaviorEntry {
  directive: Directive;
  behavior: Behavior;
  target: Element;
}

class ListenerBehavior implements Behavior {
  private model: any;

  constructor(
    private directive: Directive, 
    private target: Element
  ) {}

  bind(model: any) {
    this.model = model;
    this.target.addEventListener(this.directive.targetAspect, this);
  }

  unbind(): void {
    this.target.removeEventListener(this.directive.targetAspect, this);
  }

  handleEvent(event: Event) {
    this.model[this.directive.behavior](event);
  }
}

class OneWayBindingBehavior implements Behavior {
  private model: any;
  private observer!: Observer;

  constructor(
    private directive: Directive, 
    private target: Element
  ) {}

  bind(model: any): void {
    this.model = model;

    if (!this.observer) {
      this.observer = Observer.forProperty(this.directive.behavior);
      this.observer.subscribe(this);
    }

    this.handleChange();
  }

  unbind(): void {
    this.observer.disconnect();
  }

  handleChange() {
    const value = this.observer.observe(this.model);

    switch(this.directive.aspectType) {
      case DOMAspect.attribute:
        value === null || value === undefined
            ? this.target.removeAttribute(this.directive.targetAspect)
            : this.target.setAttribute(this.directive.targetAspect, value);
        break;
      case DOMAspect.property:
        (this.target as any)[this.directive.targetAspect] = value;
        break;
      case DOMAspect.booleanAttribute:
        value
          ? this.target.setAttribute(this.directive.targetAspect, "")
          : this.target.removeAttribute(this.directive.targetAspect);
        break;
      default:
        throw new Error("Not Implemented");
    }
  }
}

function createBehavior(directive: Directive, target: Element) {
  if (directive.aspectType === DOMAspect.event) {
    return new ListenerBehavior(directive, target);
  }

  return new OneWayBindingBehavior(directive, target);
}

export class View {
  #fragment;
  behaviors: BehaviorEntry[];

  constructor(fragment: DocumentFragment, directives: Directive[]) {
    this.#fragment = fragment;
    this.behaviors = [];
    this.#fragment.querySelectorAll("[data-bind]").forEach((target, i) => {
      const directive = directives[i];
      const behavior = createBehavior(directive, target);
      this.behaviors.push({
        directive,
        target,
        behavior
      })
    });
  }

  bind(model: any) {
    this.behaviors.forEach(x => x.behavior.bind(model));
  }

  unbind() {
    this.behaviors.forEach(x => x.behavior.unbind());
  }

  appendTo(node: Node) {
    node.appendChild(this.#fragment);
  }
}

export function html(strings: TemplateStringsArray, ...values: any[]) {
  let htmlString = "";

  for (let i = 0, ii = strings.length - 1; i < ii; ++i) {
    htmlString += strings[i];

    let value = values[i];
    
    if (Array.isArray(value)) {
      value = value.join("");
    }

    htmlString += value;
  }

  htmlString += strings[strings.length - 1];

  return ViewTemplate.for(htmlString);
}