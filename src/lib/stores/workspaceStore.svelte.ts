/**
 * workspaceStore — reactive state for the open folder, directory tree,
 * and recent-files list.
 *
 * Phase 7 additions:
 *  - recentFiles: string[] — persisted in settings, populated by addRecentFile().
 *  - openFolder() and closeFolder() persist lastWorkspace via patchAndSave().
 *  - addRecentFile() is called by fileStore.openFile() on every successful open.
 */
import { readDirectoryShallow } from '$lib/ipc/workspace';
import type { FileNode } from '$lib/ipc/workspace';
import { patchAndSave } from '$lib/ipc/settings';

// Re-export so consumers only need to import from the store
export type { FileNode };

// ---------------------------------------------------------------------------
// Store class
// ---------------------------------------------------------------------------

const MAX_RECENT = 10;

class WorkspaceStore {
  // ── Reactive state ────────────────────────────────────────────────────

  /** Absolute path of the currently open root folder, or `null`. */
  rootPath = $state<string | null>(null);

  /** Full recursive directory tree. Empty array when no folder is open. */
  directoryTree = $state<FileNode[]>([]);

  /** `true` while a directory read is in progress. */
  isLoading = $state(false);

  /** Last error message from IPC, or `null`. Cleared on next successful load. */
  error = $state<string | null>(null);

  /** Absolute paths of recently opened files, most-recent first. */
  recentFiles = $state<string[]>([]);

  // ── Derived ──────────────────────────────────────────────────────────

  /** Display-friendly name for the root folder (bare directory name). */
  get rootName(): string | null {
    if (!this.rootPath) return null;
    return this.rootPath.replace(/\\/g, '/').split('/').pop() ?? this.rootPath;
  }

  /** `true` when a workspace folder is open. */
  get hasWorkspace(): boolean {
    return this.rootPath !== null;
  }

  // ── Actions ──────────────────────────────────────────────────────────

  /**
   * Open a folder as the workspace root and load its directory tree.
   * Replaces any previously open folder. Persists lastWorkspace on success.
   */
  async openFolder(path: string): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      // Shallow load: only the immediate children of the root are fetched.
      // Sub-directories are expanded on demand via expandFolder().
      const tree = await readDirectoryShallow(path);
      this.directoryTree = tree;
      this.rootPath = path;
      patchAndSave({ lastWorkspace: path }).catch(console.error);
    } catch (err: unknown) {
      this.error = typeof err === 'string' ? err : String(err);
      // Do NOT clear rootPath / tree — leave previous state visible
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Lazily load the children of a directory node that has not been expanded yet.
   * Called by FileTreeNode when the user clicks a directory whose `children` is null.
   * The loaded subtree (1 level deep) is spliced into the reactive tree in-place.
   */
  async expandFolder(path: string): Promise<void> {
    const children = await readDirectoryShallow(path);
    this._patchNode(this.directoryTree, path, children);
  }

  /** Walk the reactive tree and replace the `children` of the matching node. */
  private _patchNode(nodes: FileNode[], targetPath: string, children: FileNode[]): boolean {
    for (const node of nodes) {
      if (node.path === targetPath) {
        node.children = children;
        return true;
      }
      if (node.children) {
        if (this._patchNode(node.children, targetPath, children)) return true;
      }
    }
    return false;
  }

  /**
   * Re-read the current workspace directory from disk.
   * No-op if no folder is open.
   */
  async refresh(): Promise<void> {
    if (!this.rootPath) return;
    await this.openFolder(this.rootPath);
  }

  /** Close the current workspace, clearing tree and rootPath. Persists the change. */
  closeFolder(): void {
    this.rootPath = null;
    this.directoryTree = [];
    this.error = null;
    patchAndSave({ lastWorkspace: null }).catch(console.error);
  }

  /**
   * Push `path` to the front of the recent-files list (deduped, capped at
   * MAX_RECENT entries). Persists the updated list.
   * Called by fileStore.openFile() after every successful file open.
   */
  addRecentFile(path: string): void {
    const deduped = this.recentFiles.filter(f => f !== path);
    this.recentFiles = [path, ...deduped].slice(0, MAX_RECENT);
    patchAndSave({ recentFiles: this.recentFiles }).catch(console.error);
  }
}

export const workspaceStore = new WorkspaceStore();
