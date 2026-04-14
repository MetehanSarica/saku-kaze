<script lang="ts">
  /**
   * FileTreeNode.svelte — one node (file or directory) in the sidebar tree.
   * Imports itself recursively for directories.
   */
  import FileTreeNode   from './FileTreeNode.svelte';
  import { fileStore }  from '$lib/stores/fileStore.svelte';
  import { toastStore } from '$lib/stores/toastStore.svelte';
  import { renameFile, deleteFile } from '$lib/ipc/files';
  import { workspaceStore } from '$lib/stores/workspaceStore.svelte';
  import type { FileNode } from '$lib/ipc/workspace';

  let {
    node,
    depth = 0,
  }: {
    node: FileNode;
    depth?: number;
  } = $props();

  let expanded   = $state(false);
  let expanding  = $state(false);
  let ctxVisible = $state(false);
  let ctxX       = $state(0);
  let ctxY       = $state(0);

  // ── Interaction ──────────────────────────────────────────────────────────

  async function handleClick() {
    if (node.is_dir) {
      if (!expanded && node.children === null) {
        // First expand of this dir: lazily load its children.
        expanding = true;
        try {
          await workspaceStore.expandFolder(node.path);
        } catch (err: unknown) {
          toastStore.error(typeof err === 'string' ? err : String(err));
          expanding = false;
          return;
        }
        expanding = false;
      }
      expanded = !expanded;
    } else {
      fileStore.openFile(node.path).catch((err: unknown) => {
        toastStore.error(typeof err === 'string' ? err : String(err));
      });
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    ctxX = e.clientX;
    ctxY = e.clientY;
    ctxVisible = true;
  }

  function closeCtx() { ctxVisible = false; }

  async function ctxDelete() {
    closeCtx();
    if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return;
    try {
      await deleteFile(node.path);
      await workspaceStore.refresh();
      toastStore.success(`Deleted "${node.name}"`);
    } catch (err: unknown) {
      toastStore.error(typeof err === 'string' ? err : String(err));
    }
  }

  async function ctxRename() {
    closeCtx();
    const newName = prompt(`Rename "${node.name}" to:`, node.name);
    if (!newName || newName === node.name) return;
    const parent  = node.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    const newPath = `${parent}/${newName}`;
    try {
      await renameFile(node.path, newPath);
      await workspaceStore.refresh();
      toastStore.success(`Renamed to "${newName}"`);
    } catch (err: unknown) {
      toastStore.error(typeof err === 'string' ? err : String(err));
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function dotColor(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      js: '#f0d264', jsx: '#f0d264', mjs: '#f0d264',
      ts: '#3178c6', tsx: '#3178c6',
      rs: '#ce412b',
      py: '#3572a5',
      html: '#e34c26', svelte: '#ff3e00',
      css: '#264de4', scss: '#c6538c',
      json: '#cbcb41',
      md: '#5975ad', mdx: '#5975ad',
      toml: '#9c4121',
      yaml: '#cb171e', yml: '#cb171e',
    };
    return map[ext] ?? '#6e7681';
  }

  // $derived ensures indent re-computes if depth ever becomes reactive.
  const indent   = $derived(`${depth * 12 + 8}px`);
  const isActive = $derived(!node.is_dir && fileStore.activeFileId === node.path);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="node-wrap">
  <!-- Row button -->
  <button
    class="node-row"
    class:node-row--active={isActive}
    class:node-row--dir={node.is_dir}
    style="padding-left: {indent}"
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
    title={node.path}
  >
    {#if node.is_dir}
      <span class="chevron">{expanding ? '⋯' : expanded ? '▾' : '▸'}</span>
    {:else}
      <span class="file-dot" style="background: {dotColor(node.name)}"></span>
    {/if}
    <span class="node-name">{node.name}</span>
  </button>

  <!-- Children (recursive) -->
  {#if node.is_dir && expanded && node.children && node.children.length > 0}
    {#each node.children as child (child.path)}
      <FileTreeNode node={child} depth={depth + 1} />
    {/each}
  {:else if node.is_dir && expanded && node.children && node.children.length === 0}
    <div class="empty-dir" style="padding-left: {(depth + 1) * 12 + 8}px">
      <span class="empty-label">empty</span>
    </div>
  {/if}
</div>

<!-- Context menu — rendered relative to viewport -->
{#if ctxVisible}
  <!-- Backdrop to close on outside click -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ctx-backdrop"
    onclick={closeCtx}
    onkeydown={(e) => e.key === 'Escape' && closeCtx()}
    oncontextmenu={(e) => { e.preventDefault(); closeCtx(); }}
  ></div>

  <menu
    class="ctx-menu"
    style="left: {ctxX}px; top: {ctxY}px"
    role="menu"
  >
    {#if !node.is_dir}
      <li role="menuitem">
        <button class="ctx-item" onclick={() => { closeCtx(); fileStore.openFile(node.path).catch((e: unknown) => toastStore.error(String(e))); }}>
          Open
        </button>
      </li>
    {/if}
    <li role="menuitem">
      <button class="ctx-item" onclick={ctxRename}>Rename…</button>
    </li>
    <li class="ctx-separator" role="separator"></li>
    <li role="menuitem">
      <button class="ctx-item ctx-item--danger" onclick={ctxDelete}>Delete</button>
    </li>
  </menu>
{/if}

<style>
  /* ── Row ────────────────────────────────────────── */
  .node-row {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    height: 22px;
    padding-right: 8px;
    background: transparent;
    border: none;
    color: var(--sk-muted);
    font-size: 12.5px;
    font-family: 'Inter Variable', sans-serif;
    cursor: default;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    transition: background 0.08s, color 0.08s;
  }

  .node-row:hover           { background: var(--sk-border); color: var(--sk-text); }
  .node-row--active         { background: #1c3a5f;         color: var(--sk-text); }
  .node-row--dir            { color: var(--sk-text); }
  .node-row--dir:hover      { background: rgba(255,255,255,0.05); }

  /* ── Chevron & dot ──────────────────────────────── */
  .chevron {
    font-size: 10px;
    color: var(--sk-muted);
    flex-shrink: 0;
    width: 10px;
    text-align: center;
  }

  .file-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: 1px;
  }

  .node-name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  /* ── Empty directory ────────────────────────────── */
  .empty-dir { height: 18px; display: flex; align-items: center; }
  .empty-label { font-size: 10px; color: var(--sk-border); font-style: italic; }

  /* ── Context menu ───────────────────────────────── */
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
  }

  .ctx-menu {
    position: fixed;
    z-index: 901;
    min-width: 140px;
    background: var(--sk-surface);
    border: 1px solid var(--sk-border);
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    list-style: none;
    margin: 0;
  }

  .ctx-item {
    display: block;
    width: 100%;
    padding: 5px 14px;
    background: transparent;
    border: none;
    color: var(--sk-text);
    font-size: 12.5px;
    text-align: left;
    cursor: default;
    transition: background 0.08s;
  }
  .ctx-item:hover         { background: var(--sk-border); }
  .ctx-item--danger       { color: #f85149; }
  .ctx-item--danger:hover { background: rgba(248,81,73,0.15); }

  .ctx-separator {
    height: 1px;
    background: var(--sk-border);
    margin: 3px 0;
  }
</style>
