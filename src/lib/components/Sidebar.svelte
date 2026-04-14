<script lang="ts">
  /**
   * Sidebar.svelte — file explorer panel.
   *
   * States:
   *   No workspace open → shows "Open Folder" button (native dialog).
   *   Workspace loading → spinner row.
   *   Workspace loaded  → recursive FileTreeNode list + collapsible panels.
   *   Error             → error message with retry button.
   */
  import FileTreeNode        from './FileTreeNode.svelte';
  import { workspaceStore }  from '$lib/stores/workspaceStore.svelte';
  import { toastStore }      from '$lib/stores/toastStore.svelte';
  import { uiStore }         from '$lib/stores/uiStore.svelte';
  import { openFolderDialog } from '$lib/ipc/dialogs';

  // ── Search tab state ─────────────────────────────────────────────────
  let searchQuery = $state('');

  async function pickFolder() {
    try {
      const path = await openFolderDialog();
      if (!path) return;
      await workspaceStore.openFolder(path);
    } catch (err: unknown) {
      toastStore.error(typeof err === 'string' ? err : String(err));
    }
  }

  // ── Collapsible bottom panels ─────────────────────────────────────────
  let outlineOpen  = $state(true);
  let timelineOpen = $state(false);
  let depsOpen     = $state(false);
</script>

<aside class="sidebar">

  <!-- Header — title changes per active tab -->
  <div class="sidebar-header">
    <span class="sidebar-title">
      {#if uiStore.activeSideBarTab === 'explorer'}Explorer
      {:else if uiStore.activeSideBarTab === 'search'}Search
      {:else if uiStore.activeSideBarTab === 'source-control'}Source Control
      {:else}Extensions
      {/if}
    </span>
    {#if uiStore.activeSideBarTab === 'explorer' && workspaceStore.hasWorkspace}
      <button class="icon-btn" title="Refresh" onclick={() => workspaceStore.refresh()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
    {/if}
  </div>

  <!-- Content area -->
  <div class="sidebar-body">

    {#if uiStore.activeSideBarTab === 'explorer'}
      <!-- ════ EXPLORER ════ -->
      {#if !workspaceStore.hasWorkspace}
        <div class="open-folder-panel">
          <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p class="panel-hint">No folder open</p>
          <button class="open-btn" onclick={pickFolder}>Open Folder…</button>
          <p class="panel-hint-sub">Or drag a folder here</p>
        </div>
      {:else if workspaceStore.isLoading}
        <div class="loading-row">
          <span class="spinner">⋯</span>
          <span class="loading-text">Reading directory…</span>
        </div>
      {:else if workspaceStore.error}
        <div class="error-panel">
          <p class="error-text">{workspaceStore.error}</p>
          <button class="open-btn" onclick={() => workspaceStore.refresh()}>Retry</button>
        </div>
      {:else}
        <div class="root-label">
          <span class="root-chevron">▾</span>
          <span class="root-name">{workspaceStore.rootName}</span>
        </div>
        <div class="tree-list" role="tree">
          {#each workspaceStore.directoryTree as node (node.path)}
            <FileTreeNode {node} depth={0} />
          {/each}
        </div>
      {/if}

    {:else if uiStore.activeSideBarTab === 'search'}
      <!-- ════ SEARCH ════ -->
      <div class="search-panel">
        <input
          class="search-input"
          type="text"
          placeholder="Search…"
          bind:value={searchQuery}
          aria-label="Search workspace"
        />
        {#if searchQuery.length === 0}
          <p class="panel-hint" style="padding: 10px 12px;">Type to search across all files.</p>
        {:else}
          <p class="panel-hint" style="padding: 10px 12px;">
            Search is not yet connected to a backend. Results will appear here.
          </p>
        {/if}
      </div>

    {:else if uiStore.activeSideBarTab === 'source-control'}
      <!-- ════ SOURCE CONTROL ════ -->
      <div class="stub-panel">
        <svg class="stub-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <circle cx="6"  cy="6"  r="3"/>
          <circle cx="18" cy="18" r="3"/>
          <path d="M6 9v3a6 6 0 0 0 6 6h0M18 15v-3a6 6 0 0 0-6-6h0"/>
        </svg>
        <p class="panel-hint">No source control provider registered.</p>
        <p class="panel-hint-sub">Git integration is planned for a future phase.</p>
      </div>

    {:else}
      <!-- ════ EXTENSIONS ════ -->
      <div class="stub-panel">
        <svg class="stub-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <p class="panel-hint">Extension marketplace is not available in offline mode.</p>
        <p class="panel-hint-sub">Extensions are planned for Phase 10.</p>
      </div>
    {/if}

  </div>

  <!-- ── Collapsible bottom panels (only on explorer tab when workspace is open) ── -->
  {#if uiStore.activeSideBarTab === 'explorer' && workspaceStore.hasWorkspace && !workspaceStore.isLoading}

    <!-- OUTLINE -->
    <div class="panel-section">
      <button
        class="panel-header"
        onclick={() => { outlineOpen = !outlineOpen; }}
        aria-expanded={outlineOpen}
      >
        <span class="panel-chevron">{outlineOpen ? '▾' : '▸'}</span>
        <span class="panel-title">OUTLINE</span>
      </button>
      {#if outlineOpen}
        <div class="panel-body">
          <div class="panel-placeholder">Open a file to see its outline.</div>
        </div>
      {/if}
    </div>

    <!-- TIMELINE -->
    <div class="panel-section">
      <button
        class="panel-header"
        onclick={() => { timelineOpen = !timelineOpen; }}
        aria-expanded={timelineOpen}
      >
        <span class="panel-chevron">{timelineOpen ? '▾' : '▸'}</span>
        <span class="panel-title">TIMELINE</span>
      </button>
      {#if timelineOpen}
        <div class="panel-body">
          <div class="panel-placeholder">No timeline data available.</div>
        </div>
      {/if}
    </div>

    <!-- RUST DEPENDENCIES -->
    <div class="panel-section">
      <button
        class="panel-header"
        onclick={() => { depsOpen = !depsOpen; }}
        aria-expanded={depsOpen}
      >
        <span class="panel-chevron">{depsOpen ? '▾' : '▸'}</span>
        <span class="panel-title">RUST DEPENDENCIES</span>
      </button>
      {#if depsOpen}
        <div class="panel-body">
          {#each ['serde 1.0', 'serde_json 1.0', 'tauri 2.x', 'tauri-plugin-dialog 2.x', 'tauri-plugin-window-state 2.x'] as dep}
            <div class="dep-row">
              <span class="dep-icon">📦</span>
              <span class="dep-name">{dep}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {/if}

</aside>

<style>
  /* ── Shell ──────────────────────────────────────── */
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 220px;
    min-width: 140px;
    max-width: 480px;
    height: 100%;
    background: var(--sk-surface);
    border-right: 1px solid var(--sk-border);
    overflow: hidden;
    resize: horizontal;
    flex-shrink: 0;
  }

  /* ── Header ─────────────────────────────────────── */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px 0 12px;
    height: 36px;
    border-bottom: 1px solid var(--sk-border);
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--sk-muted);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--sk-muted);
    cursor: default;
    transition: background 0.1s, color 0.1s;
  }
  .icon-btn:hover { background: var(--sk-border); color: var(--sk-text); }

  /* ── Body ───────────────────────────────────────── */
  .sidebar-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Open folder panel ──────────────────────────── */
  .open-folder-panel {
    padding: 32px 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .folder-icon {
    width: 40px;
    height: 40px;
    color: var(--sk-border);
    flex-shrink: 0;
  }

  .panel-hint {
    font-size: 12px;
    color: var(--sk-muted);
    line-height: 1.5;
    margin: 0;
  }

  .panel-hint-sub {
    font-size: 10.5px;
    color: var(--sk-border);
    margin: 0;
  }

  .open-btn {
    padding: 5px 10px;
    background: var(--sk-accent);
    border: none;
    border-radius: 4px;
    color: #0d1117;
    font-size: 12px;
    font-weight: 600;
    cursor: default;
    width: 100%;
    transition: opacity 0.1s;
  }
  .open-btn:hover { opacity: 0.85; }

  /* ── Loading ────────────────────────────────────── */
  .loading-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 12px;
    color: var(--sk-muted);
    font-size: 12px;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  .spinner { animation: pulse 1.2s ease-in-out infinite; font-size: 18px; }
  .loading-text { font-style: italic; }

  /* ── Error ──────────────────────────────────────── */
  .error-panel {
    padding: 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .error-text { font-size: 11.5px; color: #f85149; word-break: break-word; }

  /* ── Root label ─────────────────────────────────── */
  .root-label {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px 4px;
    color: var(--sk-text);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-bottom: 1px solid var(--sk-border);
    flex-shrink: 0;
  }
  .root-chevron { font-size: 10px; color: var(--sk-muted); }
  .root-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Tree list ──────────────────────────────────── */
  .tree-list {
    padding: 4px 0;
  }

  /* ── Collapsible panels ─────────────────────────── */
  .panel-section {
    border-top: 1px solid var(--sk-border);
    flex-shrink: 0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 5px 8px;
    background: transparent;
    border: none;
    color: var(--sk-muted);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-family: 'Inter Variable', sans-serif;
    cursor: default;
    text-align: left;
    transition: background 0.1s;
  }
  .panel-header:hover { background: rgba(255,255,255,0.04); }

  .panel-chevron { font-size: 9px; flex-shrink: 0; }
  .panel-title   { flex: 1; }

  .panel-body {
    padding: 4px 0 6px;
  }

  .panel-placeholder {
    padding: 4px 16px;
    font-size: 11.5px;
    color: var(--sk-border);
    font-style: italic;
  }

  /* ── Rust dependency rows ───────────────────────── */
  .dep-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 12px 2px 16px;
    font-size: 11.5px;
    color: var(--sk-muted);
    cursor: default;
    transition: background 0.1s;
  }
  .dep-row:hover { background: rgba(255,255,255,0.04); color: var(--sk-text); }
  .dep-icon { font-size: 10px; flex-shrink: 0; }
  .dep-name { font-family: 'JetBrains Mono Variable', monospace; }

  /* ── Search panel ───────────────────────────────── */
  .search-panel {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 5px 8px;
    background: var(--sk-bg);
    border: 1px solid var(--sk-border);
    border-radius: 4px;
    color: var(--sk-text);
    font-size: 12.5px;
    font-family: 'Inter Variable', sans-serif;
    outline: none;
    transition: border-color 0.1s;
  }
  .search-input:focus { border-color: var(--sk-blue); }

  /* ── Stub panels (Git / Extensions) ────────────── */
  .stub-panel {
    padding: 32px 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .stub-icon {
    width: 36px;
    height: 36px;
    color: var(--sk-border);
    flex-shrink: 0;
  }
</style>
