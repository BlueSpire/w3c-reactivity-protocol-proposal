export class ViewTemplate {
  create(): View {
    return new View();
  }
}

export class View {
  bind(model: any): void {

  }

  appendTo(node: Node) {

  }
}

export function html(text: TemplateStringsArray) {
  return new ViewTemplate();
}