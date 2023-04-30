export interface ReactivityEngine {

}

let noopEngine: ReactivityEngine = {

};

let currentEngine: ReactivityEngine = noopEngine;

export const ReactivityEngine = Object.freeze({
  install(engine: ReactivityEngine) {
    if (currentEngine !== noopEngine) {
      throw new Error("You can only set the reactivity engine once.");
    }

    currentEngine = engine;
  }
});

export const Observable = Object.freeze({
  trackAccess() {

  },

  trackChange() {

  },

  defineProperty() {

  }
});

export function observable() {

}

export const Observer = Object.freeze({
  forFunction() {

  }
});