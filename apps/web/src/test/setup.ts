import '@testing-library/jest-dom';
import { TextEncoder } from 'node:util';

// jsdom lacks TextEncoder, which react-router needs at import time.
Object.assign(globalThis, { TextEncoder });

// jsdom has <dialog> but not its modal API.
Object.assign(HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) {
    this.open = true;
  },
  close(this: HTMLDialogElement) {
    this.open = false;
  },
});
