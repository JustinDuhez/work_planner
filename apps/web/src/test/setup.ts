import '@testing-library/jest-dom';
import { TextEncoder } from 'node:util';

// jsdom lacks TextEncoder, which react-router needs at import time.
Object.assign(globalThis, { TextEncoder });
