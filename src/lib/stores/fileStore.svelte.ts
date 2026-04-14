/**
 * fileStore — reactive state for open editor tabs.
 *
 * Architecture rules:
 *  - Svelte 5 Runes ONLY. No legacy stores.
 *  - All disk I/O delegates to IPC wrappers in lib/ipc/files.ts.
 *  - Rust is source-of-truth for disk; this store is source-of-truth for
 *    in-memory buffers (content, dirty flag, cursor positions).
 *  - path is null for untitled (not-yet-saved) buffers.
 */
import { readFile, writeFile } from '$lib/ipc/files';
import { workspaceStore }    from '$lib/stores/workspaceStore.svelte';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenFile {
  /** Unique stable identifier.
   *  Named files:    equal to the absolute path.
   *  Untitled files: "untitled-N" (generated, stable across renames). */
  id: string;
  /** Absolute path on disk, or null for unsaved buffers. */
  path: string | null;
  /** Bare name shown in the tab (e.g. "main.rs" or "Untitled-2"). */
  name: string;
  /** Current in-memory content (may differ from disk when isDirty). */
  content: string;
  /** True when the buffer has changes not yet written to disk. */
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// Store class
// ---------------------------------------------------------------------------

class FileStore {
  // ── Reactive state ──────────────────────────────────────────────────────

  openFiles    = $state(new Map<string, OpenFile>());
  activeFileId = $state<string | null>(null);

  // ── Private counters ─────────────────────────────────────────────────────

  private untitledCounter = 0;

  // ── Derived ──────────────────────────────────────────────────────────────

  get activeFile(): OpenFile | null {
    if (this.activeFileId === null) return null;
    return this.openFiles.get(this.activeFileId) ?? null;
  }

  get openFileList(): OpenFile[] {
    return Array.from(this.openFiles.values());
  }

  get tabCount(): number {
    return this.openFiles.size;
  }

  get hasUnsavedChanges(): boolean {
    for (const f of this.openFiles.values()) {
      if (f.isDirty) return true;
    }
    return false;
  }

  get dirtyFiles(): OpenFile[] {
    return Array.from(this.openFiles.values()).filter(f => f.isDirty);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private bareFileName(path: string): string {
    return path.replace(/\\/g, '/').split('/').pop() ?? path;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Open an existing file by absolute path.
   * If already open, just focuses the tab (no re-read).
   */
  async openFile(path: string): Promise<void> {
    const existing = this.openFiles.get(path);
    if (existing) {
      this.activeFileId = path;
      return;
    }

    const content = await readFile(path);
    const file: OpenFile = {
      id: path, path, name: this.bareFileName(path), content, isDirty: false,
    };
    this.openFiles = new Map(this.openFiles).set(path, file);
    this.activeFileId = path;
    workspaceStore.addRecentFile(path);
  }

  /**
   * Create a new untitled buffer.
   * Returns the generated id so the caller can focus it.
   */
  newFile(): string {
    this.untitledCounter++;
    const id   = `untitled-${this.untitledCounter}`;
    const name = `Untitled-${this.untitledCounter}`;
    const file: OpenFile = { id, path: null, name, content: '', isDirty: false };
    this.openFiles = new Map(this.openFiles).set(id, file);
    this.activeFileId = id;
    return id;
  }

  /**
   * Push a keystroke change into the in-memory buffer (marks file dirty).
   * Called on every CodeMirror updateListener tick.
   */
  updateContent(id: string, content: string): void {
    const file = this.openFiles.get(id);
    if (!file) return;
    file.content  = content;
    file.isDirty  = true;
  }

  /**
   * Save an open file to its existing path.
   * Throws if the file has no path — callers must use saveFileAs() instead.
   */
  async saveFile(id: string): Promise<void> {
    const file = this.openFiles.get(id);
    if (!file) throw new Error(`No open file with id "${id}"`);
    if (!file.path) throw new Error('NEEDS_PATH'); // sentinel caught by page handler
    await writeFile(file.path, file.content);
    file.isDirty = false;
  }

  /**
   * Write a file to a (possibly new) absolute path, then update the tab.
   * Used for "Save As" and for the first save of untitled buffers.
   *
   * When the id changes (untitled → real path), the Map key is migrated so
   * the tab ID becomes the path (consistent with named-file behaviour).
   */
  async saveFileAs(id: string, newPath: string): Promise<void> {
    const file = this.openFiles.get(id);
    if (!file) throw new Error(`No open file with id "${id}"`);

    await writeFile(newPath, file.content);

    const newName    = this.bareFileName(newPath);
    const wasActive  = this.activeFileId === id;
    const newMap     = new Map(this.openFiles);

    // Remove the old entry; insert under the new path-as-key.
    newMap.delete(id);
    newMap.set(newPath, { ...file, id: newPath, path: newPath, name: newName, isDirty: false });
    this.openFiles = newMap;

    if (wasActive) this.activeFileId = newPath;
  }

  /**
   * Close a tab by id. Does NOT check dirty state — callers must guard.
   * Focus moves to the most-recently-added remaining tab.
   */
  closeFile(id: string): void {
    if (!this.openFiles.has(id)) return;
    const newMap = new Map(this.openFiles);
    newMap.delete(id);
    this.openFiles = newMap;

    if (this.activeFileId === id) {
      const keys = Array.from(newMap.keys());
      this.activeFileId = keys.length > 0 ? keys[keys.length - 1] : null;
    }
  }

  /** Focus a tab without triggering I/O. */
  setActiveFile(id: string): void {
    if (this.openFiles.has(id)) this.activeFileId = id;
  }

  /** Save every dirty file that has a path.  Returns ids of untitled skips. */
  async saveAll(): Promise<string[]> {
    const skipped: string[] = [];
    for (const [id, file] of this.openFiles) {
      if (!file.isDirty) continue;
      if (!file.path)   { skipped.push(id); continue; }
      await writeFile(file.path, file.content);
      file.isDirty = false;
    }
    return skipped;
  }
}

export const fileStore = new FileStore();
