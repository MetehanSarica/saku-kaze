<script lang="ts">
  /**
   * TitleBar.svelte — custom frameless title bar.
   *
   * The entire bar carries data-tauri-drag-region so the user can drag the
   * window by clicking anywhere that is NOT a button.  Window-control buttons
   * use -webkit-app-region: no-drag (applied via the .wctl class).
   */
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { fileStore }  from '$lib/stores/fileStore.svelte';
  import { toastStore } from '$lib/stores/toastStore.svelte';

  const win = getCurrentWindow();
  let isMaximized = $state(false);

  // Store the unlisten handle so onDestroy can clean up.
  let unlistenResize: (() => void) | null = null;

  onMount(async () => {
    isMaximized = await win.isMaximized();
    // Keep the maximise icon in sync when the OS resizes the window.
    unlistenResize = await win.onResized(async () => {
      isMaximized = await win.isMaximized();
    });
  });

  onDestroy(() => {
    unlistenResize?.();
  });

  async function minimize()        { await win.minimize().catch(e => toastStore.error(String(e))); }
  async function toggleMaximize()  { await win.toggleMaximize().catch(e => toastStore.error(String(e))); }
  async function close() {
    try {
      // No dirty files → destroy directly, bypassing the onCloseRequested guard.
      // Dirty files   → emit close-requested so the save/discard dialog runs.
      if (!fileStore.hasUnsavedChanges) {
        await win.destroy();
      } else {
        await win.close();
      }
    } catch (e) {
      toastStore.error(String(e));
    }
  }
</script>

<!-- data-tauri-drag-region makes the whole bar draggable -->
<header class="titlebar" data-tauri-drag-region>

  <!-- App identity -->
  <div class="titlebar-left" data-tauri-drag-region>
    <span class="app-name" data-tauri-drag-region>Saku Kaze</span>
    {#if fileStore.activeFile}
      <span class="separator" data-tauri-drag-region>—</span>
      <span class="file-name" data-tauri-drag-region>
        {fileStore.activeFile.name}{fileStore.activeFile.isDirty ? ' ●' : ''}
      </span>
    {/if}
  </div>

  <!-- Window controls — must NOT be draggable -->
  <div class="wctl-group">
    <button class="wctl wctl-min"   onclick={minimize}       aria-label="Minimize"
      title="Minimize">
      <!-- Minimise icon: horizontal rule -->
      <svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>

    <button class="wctl wctl-max"   onclick={toggleMaximize} aria-label="Maximize"
      title={isMaximized ? 'Restore' : 'Maximize'}>
      {#if isMaximized}
        <!-- Restore icon: two overlapping squares -->
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
          <rect x="2" y="0" width="8" height="8"/>
          <polyline points="0,2 0,10 8,10"/>
        </svg>
      {:else}
        <!-- Maximise icon: single square -->
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
          <rect x="0.6" y="0.6" width="8.8" height="8.8"/>
        </svg>
      {/if}
    </button>

    <button class="wctl wctl-close" onclick={close}          aria-label="Close"
      title="Close">
      <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5">
        <line x1="0" y1="0" x2="10" y2="10"/>
        <line x1="10" y1="0" x2="0"  y2="10"/>
      </svg>
    </button>
  </div>

</header>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 0 0 0 14px;
    background: var(--sk-surface);
    border-bottom: 1px solid var(--sk-border);
    user-select: none;
    -webkit-user-select: none;
  }

  /* ── Left side ─────────────────────────────────── */
  .titlebar-left {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    flex: 1;
    min-width: 0;
  }

  .app-name {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--sk-pink);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .separator {
    font-size: 11px;
    color: var(--sk-border);
    flex-shrink: 0;
  }

  .file-name {
    font-size: 12px;
    color: var(--sk-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'JetBrains Mono Variable', monospace;
  }

  /* ── Window controls ───────────────────────────── */
  .wctl-group {
    display: flex;
    align-items: stretch;
    height: 100%;
    flex-shrink: 0;
    /* Must NOT be in drag region */
    -webkit-app-region: no-drag;
  }

  .wctl {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 100%;
    background: transparent;
    border: none;
    color: var(--sk-muted);
    cursor: default;
    transition: background 0.1s, color 0.1s;
    -webkit-app-region: no-drag;
  }

  .wctl:hover         { background: var(--sk-border); color: var(--sk-text); }
  .wctl-close:hover   { background: #c0392b;           color: #ffffff; }
</style>
