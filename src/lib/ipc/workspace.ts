/**
 * Typed IPC wrappers for workspace / directory-tree commands.
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * A node in the directory tree, mirroring the Rust `FileNode` struct.
 *
 * `children` meanings:
 *   `null`     — directory whose contents have not been loaded yet (lazy node).
 *   `[]`       — directory that is genuinely empty.
 *   `[...]`    — directory with loaded children.
 *   `null`     — also used for plain files (is_dir === false).
 */
export interface FileNode {
  name: string;
  path: string;
  /** `true` when this node is a directory. */
  is_dir: boolean;
  /** `null` = not yet loaded (dirs) or not applicable (files). */
  children: FileNode[] | null;
}

/**
 * Recursively read a directory tree rooted at `path`.
 * Returns directories before files, sorted case-insensitively within each group.
 */
export async function readDirectory(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>('read_directory', { path });
}

/**
 * Read only the immediate children of `path` (no recursion).
 * Directory children are returned with `children: null` — they must be
 * expanded on demand via a subsequent `readDirectoryShallow` call.
 */
export async function readDirectoryShallow(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>('read_directory_shallow', { path });
}
