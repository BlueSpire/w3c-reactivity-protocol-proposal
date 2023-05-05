# W3C Reactivity Protocol Proposal

This repo contains a work-in-progress design for a universal reactivity protocol, as part of the ongoing work of the W3C Web Components Community Group's Community Protocols effort. It also contains two test reactivity engine implementations, as well as a test view engine and a test application.

Here are a few interesting places to look:

* The proposal can be found in `proposal.md`.
* The protocol implementation can be found in `packages/reactivity/src/index.ts`.
* You can see a reactive model built with only a reference to the protocol in `packages/app/src/counter.ts`.
* You can see how the test app configures the reactivity engine in `packages/app/src/main.ts`.
  * You can swap out the two reactivity engine implementations here without any changes to the view engine or the model.

The primary purpose of this repo is to research, experiment, and try to understand whether a general reactivity protocol is feasible, allowing:

  * Model systems to decouple themselves from view engines and reactivity libraries. 
  * View engines to decouple themselves from reactivity libraries.

## Repo Setup

1. Run `npm i` at the root of this repo to install dependencies.
2. Run `npm run build` at the root of this repo to build all packages.

### Test Client

1. Run `npm start` in the `packages/app` folder to build and run the test app in watch mode. Edit the `src/main.ts` file to swap out view engine implementations.

## Project Structure

Packages are set up to depend on each other through [Typescript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html).

If you run with `tsc -b` it will automatically build the dependent packages first.

There is special file-system linking that happens when you run `npm i`, so any edits in dependent packages are immediately seen by packages that depend on them.

All package `tsconfig.json` files derive from the one at root. The root specifies `"composite": true` to allow Typescript project references. It also enables `declaration` and `declarationMap` to allow exporting types to other packages.

## Package Dependencies

You have two choices of where to reference external dependencies:

1. In the root `package.json`. This is good when you want to have all of your packages use the same version of the dependency, as everything in the repo can import from them and it only needs to be declared once.
2. In the `package.json` files under `packages/`. This will still install them to top-level `node_modules` folder, unless the version is different from one declared at root. This might be handy if only that package uses the dependency.