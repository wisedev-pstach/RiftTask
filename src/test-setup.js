import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
// jsdom has no canvas renderer. Browser smoke exercises the real renderer;
// PTY native execution is separately tested against the real node-pty module.
vi.mock('@xterm/xterm',()=>({Terminal:class{cols=80;rows=24;open(){}loadAddon(){}onData(){return {dispose(){}};}write(){}reset(){}dispose(){}focus(){}}}));
vi.mock('@xterm/addon-fit',()=>({FitAddon:class{fit(){}}}));
afterEach(cleanup);
