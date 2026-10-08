import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { terminalStore } from './terminalStore.svelte';

beforeEach(() => {
  terminalStore.detach();
  terminalStore.markExited();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('terminalStore', () => {
  it('waits for the terminal to attach, then starts the shell once', async () => {
    const starter = vi.fn(() => Promise.resolve());
    const first  = terminalStore.ensureRunning();
    const second = terminalStore.ensureRunning();

    terminalStore.attach(starter);
    await Promise.all([first, second]);

    expect(starter).toHaveBeenCalledTimes(1);
    expect(terminalStore.running).toBe(true);

    await terminalStore.ensureRunning();          // already running → no new spawn
    expect(starter).toHaveBeenCalledTimes(1);
  });

  it('starts a new shell after the previous one exited', async () => {
    const starter = vi.fn(() => Promise.resolve());
    terminalStore.attach(starter);
    await terminalStore.ensureRunning();

    terminalStore.markExited();
    expect(terminalStore.running).toBe(false);
    await terminalStore.ensureRunning();
    expect(starter).toHaveBeenCalledTimes(2);
  });

  it('stays stopped and lets the caller retry when spawning fails', async () => {
    const starter = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    terminalStore.attach(starter);

    await expect(terminalStore.ensureRunning()).rejects.toThrow('boom');
    expect(terminalStore.running).toBe(false);
    await terminalStore.ensureRunning();
    expect(terminalStore.running).toBe(true);
  });

  it('rejects if the terminal never attaches', async () => {
    vi.useFakeTimers();
    const pending = terminalStore.ensureRunning();
    const assertion = expect(pending).rejects.toThrow('Terminal did not start');
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
