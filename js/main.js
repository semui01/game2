// Entry point. In the Claude artifact viewer, `claude.hot` keeps progress and a
// running level across live updates; everywhere else it is simply absent.

import { App } from './app.js';

function start(data = {}) {
  const app = new App(document.getElementById('app'), data);
  globalThis.claude?.hot?.snapshot?.(() => app.snapshot());
}

if (globalThis.claude?.hot?.ready) globalThis.claude.hot.ready(start);
else start(globalThis.claude?.hot?.data ?? {});
