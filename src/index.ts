/**
 * Pi Terminal for iOS
 * 
 * This package provides the runtime components needed to run the pi-coding-agent
 * on iOS with Ghostty terminal rendering and Bun's JSC runtime.
 */

export { atob, installAtobPolyfill } from './runtime/atob-polyfill';
export { PipeTerminal, type PipeTerminalOptions, type TerminalInterface } from './terminal/pipe-terminal';
export { runPi, type iOSRunnerOptions } from './runtime/ios-runner';
