/**
 * fileStore: reactive state for open editor tabs.
 *
 * Architecture rules:
 *  - Svelte 5 Runes ONLY. No legacy stores.
 *  - All disk I/O delegates to IPC wrappers in lib/ipc/files.ts.
 *  - Rust is source-of-truth for disk; this store is source-of-truth for
 *    in-memory buffers (content, dirty flag, line endings, language).
 *  - path is null for untitled (not-yet-saved) buffers.
 *
 * Reactivity: `openFiles` is a SvelteMap and every OpenFile is a $state
 * proxy, so in-place mutations (content, isDirty, path…) update the UI.
 */
import { SvelteMap }              from 'svelte/reactivity';
import { readFile, writeFile }    from '$lib/ipc/files';
import { workspaceStore }         from '$lib/stores/workspaceStore.svelte';
import { editorStore, detectLanguage } from '$lib/stores/editorStore.svelte';
import type { LanguageId }        from '$lib/stores/editorStore.svelte';
import { toastStore }             from '$lib/stores/toastStore.svelte';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LineEnding = '\n' | '\r\n';

export interface OpenFile {
  /** Unique id, stable for the lifetime of the tab (survives Save As). */
  id: string;
  /** Absolute path on disk, or null for unsaved buffers. */
  path: string | null;
  /** Bare name shown in the tab (e.g. "main.rs" or "Untitled-2"). */
  name: string;
  /** In-memory content, always LF-normalised (matches CodeMirror's doc). */
  content: string;
  /** True when the buffer has changes not yet written to disk. */
  isDirty: boolean;
  /** Line ending written to disk on save, detected on open. */
  eol: LineEnding;
  /** Syntax language for this tab. */
  language: LanguageId;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default EOL for new buffers: CRLF on Windows, LF elsewhere. */
const DEFAULT_EOL: LineEnding =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? '\r\n' : '\n';

/** Line ending of the first line break in `text`, or null if there is none. */
function detectEol(text: string): LineEnding | null {
  const i = text.indexOf('\n');
  if (i === -1) return null;
  return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n';
}

/** Convert LF-normalised buffer content to the file's on-disk line ending. */
function toDisk(content: string, eol: LineEnding): string {
  return eol === '\r\n' ? content.replace(/\n/g, '\r\n') : content;
}

function bareFileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

/** Compare two paths the way Windows does: slash- and case-insensitive. */
export function samePath(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
  return norm(a) === norm(b);
}

// ---------------------------------------------------------------------------
// Store class
// ---------------------------------------------------------------------------

class FileStore {
  // ── Reactive state ──────────────────────────────────────────────────────

  openFiles    = new SvelteMap<string, OpenFile>();
  activeFileId = $state<string | null>(null);

  // ── Private state ────────────────────────────────────────────────────────

  private idCounter       = 0;
  private untitledCounter = 0;
  /** In-flight opens keyed by normalised path, to prevent duplicate tabs. */
  private pendingOpens    = new Map<string, Promise<void>>();

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

  /** Find an open tab by path (slash- and case-insensitive). */
  findByPath(path: string): OpenFile | null {
    for (const f of this.openFiles.values()) {
      if (samePath(f.path, path)) return f;
    }
    return null;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /** Insert a new tab as a deeply reactive object and focus it. */
  private addFile(init: Omit<OpenFile, 'id'>): OpenFile {
    const file = $state<OpenFile>({ id: `file-${++this.idCounter}`, ...init });
    this.openFiles.set(file.id, file);
    this.activeFileId = file.id;
    return file;
  }

  /** Write `file` to `path`; clears isDirty only if no edits happened mid-write. */
  private async writeToDisk(file: OpenFile, path: string): Promise<void> {
    const snapshot = file.content;
    await writeFile(path, toDisk(snapshot, file.eol));
    if (file.content === snapshot) file.isDirty = false;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Open an existing file by absolute path.
   * If already open, just focuses the tab (no re-read).
   */
  async openFile(path: string): Promise<void> {
    const existing = this.findByPath(path);
    if (existing) {
      this.activeFileId = existing.id;
      return;
    }

    const key = path.replace(/\\/g, '/').toLowerCase();
    const pending = this.pendingOpens.get(key);
    if (pending) return pending;

    const task = (async () => {
      const raw = await readFile(path);
      this.addFile({
        path,
        name:     bareFileName(path),
        content:  raw.replace(/\r\n?/g, '\n'),
        isDirty:  false,
        eol:      detectEol(raw) ?? DEFAULT_EOL,
        language: detectLanguage(path),
      });
      workspaceStore.addRecentFile(path);
    })();

    this.pendingOpens.set(key, task);
    try {
      await task;
    } finally {
      this.pendingOpens.delete(key);
    }
  }

  /**
   * Create a new untitled buffer.
   * Returns the generated id so the caller can focus it.
   */
  newFile(): string {
    this.untitledCounter++;
    return this.addFile({
      path:     null,
      name:     `Untitled-${this.untitledCounter}`,
      content:  '',
      isDirty:  false,
      eol:      DEFAULT_EOL,
      language: 'plaintext',
    }).id;
  }

  /**
   * Push a keystroke change into the in-memory buffer (marks file dirty).
   * Called on every CodeMirror updateListener tick.
   */
  updateContent(id: string, content: string): void {
    const file = this.openFiles.get(id);
    if (!file) return;
    file.content = content;
    file.isDirty = true;
  }

  /**
   * Save an open file to its existing path.
   * Throws if the file has no path; callers must use saveFileAs() instead.
   */
  async saveFile(id: string): Promise<void> {
    const file = this.openFiles.get(id);
    if (!file) throw new Error(`No open file with id "${id}"`);
    if (!file.path) throw new Error('NEEDS_PATH'); // sentinel caught by page handler
    await this.writeToDisk(file, file.path);
  }

  /**
   * Write a file to a (possibly new) absolute path, then update the tab.
   * Used for "Save As" and for the first save of untitled buffers.
   * The tab id does not change. Another tab already showing `newPath` is
   * closed, since its file has just been overwritten.
   */
  async saveFileAs(id: string, newPath: string): Promise<void> {
    const file = this.openFiles.get(id);
    if (!file) throw new Error(`No open file with id "${id}"`);

    await this.writeToDisk(file, newPath);

    const other = this.findByPath(newPath);
    if (other && other.id !== id) this.closeFile(other.id);

    file.path     = newPath;
    file.name     = bareFileName(newPath);
    file.language = detectLanguage(newPath);
    if (this.activeFileId === id) editorStore.setLanguage(file.language);
    workspaceStore.addRecentFile(newPath);
  }

  /**
   * Close a tab by id. Does NOT check dirty state; use closeFileWithConfirm()
   * for user-initiated closes.
   * Focus moves to the most-recently-added remaining tab.
   */
  closeFile(id: string): void {
    if (!this.openFiles.has(id)) return;
    this.openFiles.delete(id);

    if (this.activeFileId === id) {
      const keys = Array.from(this.openFiles.keys());
      this.activeFileId = keys.length > 0 ? keys[keys.length - 1] : null;
    }
  }

  /**
   * Close a tab, asking for confirmation first if it has unsaved changes.
   * Returns true if the tab was closed.
   */
  closeFileWithConfirm(id: string): boolean {
    const file = this.openFiles.get(id);
    if (!file) return false;
    if (file.isDirty) {
      const discard = window.confirm(`"${file.name}" has unsaved changes.\n\nClose without saving?`);
      if (!discard) return false;
      toastStore.warning(`"${file.name}" closed without saving.`);
    }
    this.closeFile(id);
    return true;
  }

  /** Focus a tab without triggering I/O. */
  setActiveFile(id: string): void {
    if (this.openFiles.has(id)) this.activeFileId = id;
  }

  /** Save every dirty file that has a path.  Returns ids of untitled skips. */
  async saveAll(): Promise<string[]> {
    const skipped: string[] = [];
    for (const file of this.openFiles.values()) {
      if (!file.isDirty) continue;
      if (!file.path)   { skipped.push(file.id); continue; }
      await this.writeToDisk(file, file.path);
    }
    return skipped;
  }
}

export const fileStore = new FileStore();
