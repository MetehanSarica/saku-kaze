/**
 * Typed IPC wrappers for the PTY terminal commands and events.
 * Every function maps 1-to-1 with a Rust #[tauri::command] or event.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface SpawnPtyOptions {
  /** Starting directory; Rust falls back to the home dir if missing/invalid. */
  cwd?:  string | null;
  cols:  number;
  rows:  number;
}

/** Start the PowerShell PTY. Idempotent: no-op if a shell is already running. */
export async function spawnPty(opts: SpawnPtyOptions): Promise<void> {
  return invoke<void>('spawn_pty', { cwd: opts.cwd ?? null, cols: opts.cols, rows: opts.rows });
}

/** Send raw input (keystrokes or a command line ending in `\r`) to the shell. */
export async function writePty(data: string): Promise<void> {
  return invoke<void>('write_pty', { data });
}

/** Resize the PTY to the terminal viewport. No-op if no shell is running. */
export async function resizePty(cols: number, rows: number): Promise<void> {
  return invoke<void>('resize_pty', { cols, rows });
}

/** Subscribe to shell output. */
export async function onPtyOutput(cb: (text: string) => void): Promise<UnlistenFn> {
  return listen<string>('pty-output', (e) => cb(e.payload));
}

/** Subscribe to shell exit. `code` is null when it could not be determined. */
export async function onPtyExit(cb: (code: number | null) => void): Promise<UnlistenFn> {
  return listen<{ code: number | null }>('pty-exit', (e) => cb(e.payload.code));
}
