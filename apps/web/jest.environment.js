import JSDOMEnvironment from 'jest-environment-jsdom';

// jsdom has no fetch API; react-router's data router needs Request and friends, and
// Node's Request only accepts Node's own AbortSignal.
export default class extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);
    Object.assign(this.global, {
      Request,
      Response,
      Headers,
      AbortController,
      AbortSignal,
    });
  }
}
