/**
 * PipeTerminal - A terminal implementation for iOS that works with pipes instead of TTY.
 * 
 * This replaces pi-tui's ProcessTerminal which requires a real TTY with setRawMode etc.
 * On iOS, we use pipes for stdin/stdout communication with the Bun runtime.
 */

export interface TerminalInterface {
  readonly columns: number;
  readonly rows: number;
  readonly kittyProtocolActive: boolean;
  start(onInput: (data: string) => void, onResize: () => void): void;
  stop(): void;
  write(data: string): void;
  hideCursor(): void;
  showCursor(): void;
}

export interface PipeTerminalOptions {
  columns?: number;
  rows?: number;
}

export class PipeTerminal implements TerminalInterface {
  private _columns: number;
  private _rows: number;
  private inputHandler: ((data: string) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private _running = false;
  private stdinListener: ((data: string) => void) | null = null;

  constructor(options: PipeTerminalOptions = {}) {
    this._columns = options.columns ?? 45;
    this._rows = options.rows ?? 50;
  }

  get columns(): number {
    return this._columns;
  }

  get rows(): number {
    return this._rows;
  }

  get kittyProtocolActive(): boolean {
    return false;
  }

  setSize(columns: number, rows: number): void {
    this._columns = columns;
    this._rows = rows;
    if (this.resizeHandler) {
      this.resizeHandler();
    }
  }

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.inputHandler = onInput;
    this.resizeHandler = onResize;
    this._running = true;

    // Set up stdin listener
    this.stdinListener = (data: string) => {
      if (this.inputHandler && this._running) {
        this.inputHandler(data);
      }
    };

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.stdinListener);
    process.stdin.resume();
  }

  stop(): void {
    this._running = false;
    
    if (this.stdinListener) {
      process.stdin.off('data', this.stdinListener);
      this.stdinListener = null;
    }
    
    this.inputHandler = null;
    this.resizeHandler = null;
    process.stdin.pause();
  }

  write(data: string): void {
    process.stdout.write(data);
  }

  hideCursor(): void {
    this.write('\x1b[?25l');
  }

  showCursor(): void {
    this.write('\x1b[?25h');
  }
}
