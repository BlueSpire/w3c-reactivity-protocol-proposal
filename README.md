# Reactivity Protocol Proposl

This repo contains a WIP design for a universal reactivity protocol, as part of the ongoing work of the W3C Web Components Community Group's Community Protocols effort. It also contains a couple test reactivity engine implementations, as well as view engine and application test consumers.

The primary purpose of this repo is to research, experiment, and try to understand whether a general reactivity protocol is feasible, allowing model systems to decouple themselves from view engines and reactivity libraries. If this experiment succeeds, it will be turned into an official proposal.

## Setup

1. Run `npm i` at the root of this repo to install dependencies.
2. Run `npm run build` at the root of this repo to build all packages.

### Test Client

1. Run `npm start` in the client folder to build and run the test app in watch mode. Edit the `main.ts` file to swap out view engine implementations.

## Project Structure

Packages are set up to depend on each other through [Typescript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html).

If you run with `tsc -b` it will automatically build the dependent packages first.

There is special file-system linking that happens when you run `npm i`, so any edits in dependent packages are immediately seen by packages that depend on them.

All package `tsconfig.json` files derive from the one at root. The root specifies `"composite": true` to allow Typescript project references. It also enables `declaration` and `declarationMap` to allow exporting types to other packages.

## Package Dependencies

You have two choices of where to reference external dependencies:

1. In the root `package.json`. This is good when you want to have all of your packages use the same version of the dependency, as everything in the repo can import from them and it only needs to be declared once.
2. In the `package.json` files under `packages/`. This will still install them to top-level `node_modules` folder, unless the version is different from one declared at root. This might be handy if only that package uses the dependency.