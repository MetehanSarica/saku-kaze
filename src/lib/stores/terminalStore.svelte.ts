/**
 * terminalStore: lifecycle of the single PTY shell session.
 *
 * BottomPanel owns the xterm instance and registers a `starter` (which spawns
 * the PTY at the terminal's current size) via attach(). Anyone who needs a
 * running shell (e.g. F5 "run file") calls ensureRunning(), which waits for
 * the terminal to be attached, starts the shell if needed, and dedupes
 * concurrent starts. markExited() is called on the `pty-exit` event.
 */

const ATTACH_TIMEOUT_MS = 10_000;

class TerminalStore {
  // ── Reactive state ────────────────────────────────────────────────────
  /** True while a shell process is running. */
  running = $state(false);

  // ── Private state ─────────────────────────────────────────────────────
  private starter: (() => Promise<void>) | null = null;
  private starting: Promise<void> | null = null;
  private attachWaiters: (() => void)[] = [];

  // ── Actions ───────────────────────────────────────────────────────────

  /** Register the function that spawns the PTY (called by BottomPanel). */
  attach(starter: () => Promise<void>): void {
    this.starter = starter;
    for (const resolve of this.attachWaiters) resolve();
    this.attachWaiters = [];
  }

  /** Unregister the starter (BottomPanel destroyed). */
  detach(): void {
    this.starter = null;
  }

  /** Mark the shell as exited so the next ensureRunning() starts a new one. */
  markExited(): void {
    this.running = false;
  }

  /**
   * Resolve once a shell is running, starting one if necessary.
   * Rejects if the terminal is not attached within 10 s or the spawn fails.
   */
  async ensureRunning(): Promise<void> {
    await this.waitForAttach();
    if (this.running) return;

    if (!this.starting) {
      const starter = this.starter!;
      this.starting = starter()
        .then(() => { this.running = true; })
        .finally(() => { this.starting = null; });
    }
    await this.starting;
  }

  private waitForAttach(): Promise<void> {
    if (this.starter) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.attachWaiters = this.attachWaiters.filter(w => w !== done);
        reject(new Error('Terminal did not start. Open the TERMINAL panel and try again.'));
      }, ATTACH_TIMEOUT_MS);
      const done = () => { clearTimeout(timer); resolve(); };
      this.attachWaiters.push(done);
    });
  }
}

export const terminalStore = new TerminalStore();
