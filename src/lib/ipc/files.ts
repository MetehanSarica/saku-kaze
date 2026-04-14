/**
 * Typed IPC wrappers for file-system commands.
 * Every function is async and maps 1-to-1 with a Rust #[tauri::command].
 * Errors surface as rejected Promises carrying the String returned by Rust.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface FileChunkPayload {
  path: string;
  data: string;
  done: boolean;
}

/**
 * Read a UTF-8 text file.
 *
 * Files < 5 MiB are returned inline. Files 5–50 MiB trigger chunked
 * streaming over `file-chunk` events; this wrapper reassembles them
 * transparently so callers always receive a single string.
 * Files > 50 MiB reject with an error string from Rust.
 */
export async function readFile(path: string): Promise<string> {
  // Register the listener BEFORE invoke so no chunks are dropped.
  const chunks: string[] = [];
  let resolveStream!: (s: string) => void;
  let rejectStream!:  (e: unknown) => void;
  const streamPromise = new Promise<string>((res, rej) => {
    resolveStream = res;
    rejectStream  = rej;
  });

  // Safety: if the streaming path stalls (Rust panics mid-stream, etc.)
  // we time out after 30 seconds so the Promise doesn't hang forever.
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    unlisten();
    rejectStream(new Error(`Timed out reading '${path}' — streaming did not complete within 30 s`));
  }, 30_000);

  const unlisten = await listen<FileChunkPayload>('file-chunk', (event) => {
    if (timedOut) return;
    if (event.payload.path !== path) return;
    chunks.push(event.payload.data);
    if (event.payload.done) {
      clearTimeout(timeout);
      unlisten();
      resolveStream(chunks.join(''));
    }
  });

  try {
    const result = await invoke<string>('read_file', { path });
    if (result !== 'STREAMING') {
      // Small file returned inline; the listener is no longer needed.
      clearTimeout(timeout);
      unlisten();
      resolveStream(result);
    }
    // If 'STREAMING', resolveStream fires via the event listener above.
  } catch (err) {
    clearTimeout(timeout);
    unlisten();
    rejectStream(err);
  }

  return streamPromise;
}

/**
 * Atomically write `content` to `path`.
 * Uses write-to-.sktmp-then-rename to prevent data loss on crash.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_file', { path, content });
}

/** Delete a file or an empty directory. */
export async function deleteFile(path: string): Promise<void> {
  return invoke<void>('delete_file', { path });
}

/**
 * Move / rename a file or directory.
 * Both arguments must be absolute paths; the parent of `newPath` must exist.
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>('rename_file', { oldPath, newPath });
}
