<script lang="ts">
  /**
   * +page.svelte — root layout, global keyboard orchestrator, close-guard.
   *
   * CSS Grid (Phase 8 layout):
   *   Row 1 (32px)  : TitleBar
   *   Row 2 (1fr)   : ActivityBar | Sidebar | [TabBar + Breadcrumb + Editor + BottomPanel]
   *   Row 3 (24px)  : StatusBar
   */
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWindow }   from '@tauri-apps/api/window';

  import TitleBar       from '$lib/components/TitleBar.svelte';
  import ActivityBar    from '$lib/components/ActivityBar.svelte';
  import Sidebar        from '$lib/components/Sidebar.svelte';
  import TabBar         from '$lib/components/TabBar.svelte';
  import Breadcrumb     from '$lib/components/Breadcrumb.svelte';
  import Editor         from '$lib/components/Editor.svelte';
  import BottomPanel    from '$lib/components/BottomPanel.svelte';
  import StatusBar      from '$lib/components/StatusBar.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import ContextMenu    from '$lib/components/ContextMenu.svelte';
  import Toast          from '$lib/components/Toast.svelte';

  import { loadSettings, primeCache } from '$lib/ipc/settings';
  import {
    openFileDialog,
    saveFileDialog,
    askSaveBeforeClose,
  } from '$lib/ipc/dialogs';
  import { invoke } from '@tauri-apps/api/core';

  import { fileStore }       from '$lib/stores/fileStore.svelte';
  import { editorStore }     from '$lib/stores/editorStore.svelte';
  import { uiStore }         from '$lib/stores/uiStore.svelte';
  import { workspaceStore }  from '$lib/stores/workspaceStore.svelte';
  import { toastStore }      from '$lib/stores/toastStore.svelte';

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  let unlistenClose: (() => void) | null = null;

  onMount(async () => {
    // 1. Load and apply all persisted settings
    try {
      const s = await loadSettings();
      primeCache(s);
      editorStore.hydrate(s);
      uiStore.hydrate(s);
      workspaceStore.recentFiles = s.recentFiles ?? [];
      if (s.lastWorkspace) {
        await workspaceStore.openFolder(s.lastWorkspace).catch(() => {});
      }
    } catch (err: unknown) {
      toastStore.error(`Could not load settings: ${err}`);
    }

    // 2. Register dirty-file guard on window close
    const win = getCurrentWindow();
    unlistenClose = await win.onCloseRequested(async (event) => {
      if (!fileStore.hasUnsavedChanges) return;
      event.preventDefault();
      await handleCloseGuard(win);
    });
  });

  onDestroy(() => {
    unlistenClose?.();
  });

  // ── Close guard ─────────────────────────────────────────────────────────────

  async function handleCloseGuard(win: Awaited<ReturnType<typeof getCurrentWindow>>) {
    const dirtyNames = fileStore.dirtyFiles.map(f => f.name);
    const decision = await askSaveBeforeClose(dirtyNames).catch(() => 'cancel' as const);

    if (decision === 'save') {
      try {
        const skipped = await fileStore.saveAll();
        if (skipped.length > 0) {
          for (const id of skipped) {
            await doSaveAs(id);
          }
        }
        await win.destroy();
      } catch (err: unknown) {
        toastStore.error(`Save failed: ${err}`);
      }
    } else if (decision === 'discard') {
      await win.destroy();
    }
  }

  // ── File operation helpers ─────────────────────────────────────────────────

  async function doSave(id: string): Promise<void> {
    const file = fileStore.openFiles.get(id);
    if (!file) return;
    if (!file.path) { await doSaveAs(id); }
    else { await fileStore.saveFile(id); toastStore.success('Saved.'); }
  }

  /**
   * Prompt the user to choose a save location for `id`.
   * Returns the absolute path that was saved to, or null if cancelled.
   * The dialog's default filter and suggested filename reflect the active language.
   */
  async function doSaveAs(id: string): Promise<string | null> {
    const file = fileStore.openFiles.get(id);
    if (!file) return null;

    // Build a smart suggested name: untitled files get the language extension appended.
    const langExtMap: Record<string, string> = {
      javascript: 'js', typescript: 'ts', html: 'html', css: 'css',
      json: 'json', markdown: 'md', python: 'py', rust: 'rs',
      cpp: 'cpp', java: 'java', plaintext: 'txt',
    };
    const defaultExt    = langExtMap[editorStore.currentLanguage] ?? 'txt';
    const suggestedName = file.path
      ? file.name
      : `${file.name}.${defaultExt}`;

    const path = await saveFileDialog(suggestedName, editorStore.currentLanguage);
    if (!path) return null;
    await fileStore.saveFileAs(id, path);
    toastStore.success('Saved.');
    return path;
  }

  async function doOpenFile(): Promise<void> {
    const path = await openFileDialog();
    if (!path) return;
    await fileStore.openFile(path);
  }

  async function doCloseTab(id: string): Promise<void> {
    const file = fileStore.openFiles.get(id);
    if (file?.isDirty) {
      const discard = window.confirm(`"${file.name}" has unsaved changes.\n\nClose without saving?`);
      if (!discard) return;
    }
    fileStore.closeFile(id);
  }

  // ── Global keyboard shortcuts ──────────────────────────────────────────────

  async function handleKeydown(e: KeyboardEvent) {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (uiStore.contextMenuOpen) uiStore.closeContextMenu();
    if (uiStore.paletteOpen && e.key !== 'Escape') return;

    if (ctrl && shift && e.key === 'P') { e.preventDefault(); uiStore.togglePalette(); return; }
    if (ctrl && shift && e.key === 'E') { e.preventDefault(); uiStore.setActiveSideBarTab('explorer'); return; }
    if (ctrl && shift && e.key === 'J') { e.preventDefault(); uiStore.toggleBottomPanel(); return; }

    if (ctrl && !shift && e.key === 'n') { e.preventDefault(); fileStore.newFile(); return; }
    if (ctrl && !shift && e.key === 'o') { e.preventDefault(); await doOpenFile().catch((err: unknown) => toastStore.error(String(err))); return; }

    if (ctrl && shift && e.key === 'S') {
      e.preventDefault();
      const id = fileStore.activeFileId;
      if (id) await doSaveAs(id).catch((err: unknown) => toastStore.error(String(err)));
      return;
    }
    if (ctrl && !shift && e.key === 's') {
      e.preventDefault();
      const id = fileStore.activeFileId;
      if (id) await doSave(id).catch((err: unknown) => toastStore.error(String(err)));
      return;
    }
    if (ctrl && e.key === 'w') {
      e.preventDefault();
      const id = fileStore.activeFileId;
      if (id) await doCloseTab(id).catch((err: unknown) => toastStore.error(String(err)));
      return;
    }

    if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); editorStore.setFontSize(editorStore.fontSize + 1); return; }
    if (ctrl && e.key === '-')                    { e.preventDefault(); editorStore.setFontSize(editorStore.fontSize - 1); return; }
    if (e.altKey && e.key === 'z')                { e.preventDefault(); editorStore.setWordWrap(!editorStore.wordWrap);   return; }

    // ── Zen mode ──────────────────────────────────────────────────────────
    if (e.key === 'F11' && shift) { e.preventDefault(); uiStore.toggleZenMode(); return; }

    // ── Prevent accidental app reload ─────────────────────────────────────
    if (e.key === 'F5')                   { e.preventDefault(); await runCode(); return; }
    if (ctrl && e.key === 'r')            { e.preventDefault(); return; }

    if (e.key === 'Escape' && uiStore.paletteOpen) { e.preventDefault(); uiStore.closePalette(); }
  }

  // ── Run code ───────────────────────────────────────────────────────────────
  // Routes execution through the PTY terminal so stateful shell commands
  // (cd, virtual envs, cargo workspaces) work correctly.

  async function runCode(): Promise<void> {
    let file = fileStore.activeFile;
    if (!file) return;

    // ── Untitled buffer: prompt to save first (VS Code behaviour) ─────────
    if (!file.path) {
      const savedPath = await doSaveAs(fileStore.activeFileId!).catch((err: unknown) => {
        toastStore.error(`Save failed: ${err}`);
        return null;
      });
      if (!savedPath) return; // user cancelled — abort silently

      // Re-read the store entry after the id migration (untitled-N → real path).
      file = fileStore.openFiles.get(savedPath) ?? fileStore.activeFile;
      if (!file?.path) return;
      // doSaveAs already wrote the file to disk — nothing more to do here.
    } else {
      // ── Named file: silent auto-save before execution ──────────────────
      // The shell reads from disk, so we flush the current editor state now.
      // fileStore.saveFile writes the in-memory buffer atomically and clears
      // the dirty flag so the tab indicator stays accurate.
      try {
        await fileStore.saveFile(fileStore.activeFileId!);
      } catch (err: unknown) {
        toastStore.error(`Auto-save failed: ${err}`);
        return;
      }
    }

    const resolvedPath = file.path;
    const ext = resolvedPath.replace(/\\/g, '/').split('.').pop()?.toLowerCase() ?? '';

    const ptyCommands: Record<string, string> = {
      py:  `python "${resolvedPath}"\r`,
      rs:  `cargo run\r`,
      js:  `node "${resolvedPath}"\r`,
      mjs: `node "${resolvedPath}"\r`,
      ts:  `npx ts-node "${resolvedPath}"\r`,
    };

    const cmd = ptyCommands[ext];
    if (!cmd) {
      toastStore.error(`Run is not configured for .${ext || 'unknown'} files.`);
      return;
    }

    // Ensure the terminal panel is visible before sending the command.
    uiStore.bottomPanelOpen = true;
    uiStore.setActiveBottomTab('terminal');

    try {
      // spawn_pty is idempotent — safe to call even if the terminal is already running.
      await invoke('spawn_pty');
      await invoke('write_pty', { data: cmd });
    } catch (err: unknown) {
      toastStore.error(`Run failed: ${err}`);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="app-shell"
  class:app-shell--zen={uiStore.zenMode}
  role="application"
  aria-label="Saku Kaze editor"
>

  <!-- Row 1: Title bar -->
  <TitleBar />

  <!-- Row 2: Main body -->
  <div class="body-row">

    <!-- Activity bar (50px) — hidden in zen mode -->
    {#if !uiStore.zenMode}
      <ActivityBar />
    {/if}

    <!-- Sidebar (collapsible, hidden in zen mode) -->
    {#if uiStore.sidebarOpen && !uiStore.zenMode}
      <Sidebar />
    {/if}

    <!-- Center column: tabs + breadcrumb + editor + bottom panel -->
    <div class="center-col">
      <TabBar onrun={runCode} />
      <Breadcrumb />

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="editor-area"
        oncontextmenu={(e) => { e.preventDefault(); uiStore.openContextMenu(e.clientX, e.clientY); }}
      >
        {#if fileStore.tabCount > 0}
          <Editor />
        {:else}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="welcome" ondblclick={() => fileStore.newFile()}>
            <h1 class="welcome-title">Saku Kaze</h1>
            <p class="welcome-sub">A lightweight offline code editor</p>
            <div class="welcome-shortcuts">
              <div class="shortcut"><kbd>Ctrl+N</kbd>         New File</div>
              <div class="shortcut"><kbd>Ctrl+O</kbd>         Open File</div>
              <div class="shortcut"><kbd>Ctrl+S</kbd>         Save</div>
              <div class="shortcut"><kbd>Ctrl+Shift+S</kbd>   Save As</div>
              <div class="shortcut"><kbd>Ctrl+W</kbd>         Close Tab</div>
              <div class="shortcut"><kbd>Ctrl+Shift+P</kbd>   Command Palette</div>
              <div class="shortcut"><kbd>Alt+Z</kbd>          Toggle Word Wrap</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Bottom panel (resizable, hidden in zen mode) -->
      {#if uiStore.bottomPanelOpen && !uiStore.zenMode}
        <BottomPanel />
      {/if}
    </div>

  </div>

  <!-- Row 3: Status bar — hidden in zen mode -->
  {#if !uiStore.zenMode}
    <StatusBar />
  {/if}

</div>

<!-- Overlays -->
<CommandPalette />
<ContextMenu />
<Toast />

<style>
  :global(body) { margin: 0; overflow: hidden; }

  .app-shell {
    display: grid;
    grid-template-rows: 32px 1fr 24px;
    grid-template-columns: 1fr;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: var(--sk-bg);
    color: var(--sk-text);
  }

  /* Zen mode: title bar + editor only, no status bar row */
  .app-shell--zen {
    grid-template-rows: 32px 1fr;
  }

  /* ── Body row: activity + sidebar + center ────────── */
  .body-row {
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Center column ────────────────────────────────── */
  .center-col {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .editor-area {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  /* ── Welcome screen ───────────────────────────────── */
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 10px;
    user-select: none;
    cursor: default;
  }

  .welcome-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--sk-muted);
    letter-spacing: 0.06em;
    margin: 0;
  }

  .welcome-sub {
    font-size: 13px;
    color: var(--sk-border);
    margin: 0 0 12px;
  }

  .welcome-shortcuts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
  }

  .shortcut {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--sk-muted);
    font-family: 'JetBrains Mono Variable', monospace;
  }

  .shortcut kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 7px;
    background: var(--sk-surface);
    border: 1px solid var(--sk-border);
    border-radius: 4px;
    font-family: inherit;
    font-size: 10.5px;
    color: var(--sk-blue);
    min-width: 110px;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }
</style>
