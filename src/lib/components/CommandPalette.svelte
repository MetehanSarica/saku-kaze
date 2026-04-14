<script lang="ts">
  /**
   * CommandPalette.svelte — Ctrl+Shift+P quick-action overlay.
   *
   * Implements fuzzy-text filtering over a command list, keyboard navigation
   * (↑↓ + Enter), and Escape-to-close.  Commands delegate to stores/IPC.
   */
  import { uiStore }          from '$lib/stores/uiStore.svelte';
  import { fileStore }        from '$lib/stores/fileStore.svelte';
  import { workspaceStore }   from '$lib/stores/workspaceStore.svelte';
  import { editorStore }      from '$lib/stores/editorStore.svelte';
  import { toastStore }       from '$lib/stores/toastStore.svelte';
  import { openFileDialog, openFolderDialog, saveFileDialog } from '$lib/ipc/dialogs';
  import { fade }             from 'svelte/transition';

  // ── Command registry ─────────────────────────────────────────────────────

  interface Command {
    id:      string;
    label:   string;
    keybind?: string;
    action:  () => void | Promise<void>;
  }

  const commands: Command[] = [
    // ── File operations ──────────────────────────────────────────────────────
    {
      id: 'new-file',
      label: 'File: New File',
      keybind: 'Ctrl+N',
      action: () => { fileStore.newFile(); },
    },
    {
      id: 'open-file',
      label: 'File: Open File…',
      keybind: 'Ctrl+O',
      action: async () => {
        const path = await openFileDialog();
        if (!path) return;
        await fileStore.openFile(path).catch((e: unknown) => toastStore.error(String(e)));
      },
    },
    {
      id: 'open-folder',
      label: 'File: Open Folder…',
      action: async () => {
        const path = await openFolderDialog();
        if (!path) return;
        await workspaceStore.openFolder(path).catch((e: unknown) => toastStore.error(String(e)));
      },
    },
    {
      id: 'save-file',
      label: 'File: Save',
      keybind: 'Ctrl+S',
      action: async () => {
        const id = fileStore.activeFileId;
        if (!id) return;
        const file = fileStore.openFiles.get(id);
        if (!file) return;
        if (!file.path) {
          // Untitled — fall through to Save As
          const path = await saveFileDialog(file.name, editorStore.currentLanguage);
          if (!path) return;
          await fileStore.saveFileAs(id, path).catch((e: unknown) => toastStore.error(String(e)));
        } else {
          await fileStore.saveFile(id).catch((e: unknown) => toastStore.error(String(e)));
        }
        toastStore.success('Saved.');
      },
    },
    {
      id: 'save-as',
      label: 'File: Save As…',
      keybind: 'Ctrl+Shift+S',
      action: async () => {
        const id = fileStore.activeFileId;
        if (!id) return;
        const file = fileStore.openFiles.get(id);
        const path = await saveFileDialog(file?.name, editorStore.currentLanguage);
        if (!path) return;
        await fileStore.saveFileAs(id, path).catch((e: unknown) => toastStore.error(String(e)));
        toastStore.success('Saved.');
      },
    },
    {
      id: 'close-tab',
      label: 'File: Close Active Tab',
      keybind: 'Ctrl+W',
      action: () => {
        const id = fileStore.activeFileId;
        if (id) fileStore.closeFile(id);
      },
    },
    {
      id: 'toggle-wrap',
      label: 'View: Toggle Word Wrap',
      keybind: 'Alt+Z',
      action: () => editorStore.setWordWrap(!editorStore.wordWrap),
    },
    {
      id: 'font-inc',
      label: 'View: Increase Font Size',
      keybind: 'Ctrl++',
      action: () => editorStore.setFontSize(editorStore.fontSize + 1),
    },
    {
      id: 'font-dec',
      label: 'View: Decrease Font Size',
      keybind: 'Ctrl+-',
      action: () => editorStore.setFontSize(editorStore.fontSize - 1),
    },
    {
      id: 'font-reset',
      label: 'View: Reset Font Size',
      action: () => editorStore.setFontSize(14),
    },
    {
      id: 'tab-2',
      label: 'Editor: Set Tab Size to 2',
      action: () => editorStore.setTabSize(2),
    },
    {
      id: 'tab-4',
      label: 'Editor: Set Tab Size to 4',
      action: () => editorStore.setTabSize(4),
    },
    {
      id: 'lang-plain',
      label: 'Language: Plain Text',
      action: () => editorStore.setLanguage('plaintext'),
    },
    {
      id: 'lang-js',
      label: 'Language: JavaScript',
      action: () => editorStore.setLanguage('javascript'),
    },
    {
      id: 'lang-ts',
      label: 'Language: TypeScript',
      action: () => editorStore.setLanguage('typescript'),
    },
    {
      id: 'lang-rs',
      label: 'Language: Rust',
      action: () => editorStore.setLanguage('rust'),
    },
    {
      id: 'lang-py',
      label: 'Language: Python',
      action: () => editorStore.setLanguage('python'),
    },
    {
      id: 'lang-md',
      label: 'Language: Markdown',
      action: () => editorStore.setLanguage('markdown'),
    },
    {
      id: 'lang-json',
      label: 'Language: JSON',
      action: () => editorStore.setLanguage('json'),
    },
  ];

  // ── State ─────────────────────────────────────────────────────────────────

  let query       = $state('');
  let selectedIdx = $state(0);
  let inputEl     = $state<HTMLInputElement | undefined>(undefined);

  const filtered = $derived(
    query.trim() === ''
      ? commands
      : commands.filter(c =>
          c.label.toLowerCase().includes(query.toLowerCase())
        )
  );

  // Reset selection when filter changes
  $effect(() => {
    // read filtered to subscribe
    filtered; // eslint-disable-line @typescript-eslint/no-unused-expressions
    selectedIdx = 0;
  });

  // ── Keyboard handler ──────────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape')     { close(); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); return; }
    if (e.key === 'Enter')      { e.preventDefault(); runSelected(); return; }
  }

  function runSelected() {
    const cmd = filtered[selectedIdx];
    if (!cmd) return;
    close();
    cmd.action();
  }

  function close() {
    uiStore.closePalette();
    query = '';
    selectedIdx = 0;
  }
</script>

{#if uiStore.paletteOpen}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="backdrop"
    transition:fade={{ duration: 120 }}
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
  ></div>

  <!-- Palette panel -->
  <div
    class="palette"
    role="dialog"
    aria-label="Command palette"
    aria-modal="true"
    transition:fade={{ duration: 120 }}
  >
    <!-- Search input -->
    <div class="palette-search">
      <span class="search-icon">⌘</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="search-input"
        type="text"
        placeholder="Type a command…"
        bind:value={query}
        bind:this={inputEl}
        onkeydown={onKeyDown}
        autocomplete="off"
        spellcheck="false"
        autofocus
      />
      {#if query}
        <button class="clear-btn" onclick={() => { query = ''; inputEl?.focus(); }}>×</button>
      {/if}
    </div>

    <!-- Results list -->
    <div class="palette-list" role="listbox">
      {#if filtered.length === 0}
        <div class="no-results">No commands match "{query}"</div>
      {:else}
        {#each filtered as cmd, i (cmd.id)}
          <button
            class="palette-item"
            class:palette-item--selected={i === selectedIdx}
            role="option"
            aria-selected={i === selectedIdx}
            onclick={runSelected}
            onmouseenter={() => { selectedIdx = i; }}
          >
            <span class="cmd-label">{cmd.label}</span>
            {#if cmd.keybind}
              <span class="cmd-keybind">{cmd.keybind}</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    <!-- Footer hint -->
    <div class="palette-footer">
      <span>↑↓ navigate</span>
      <span>↵ run</span>
      <span>Esc close</span>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ───────────────────────────────────── */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(2px);
    z-index: 800;
  }

  /* ── Palette container ──────────────────────────── */
  .palette {
    position: fixed;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 48px));
    background: var(--sk-surface);
    border: 1px solid var(--sk-border);
    border-radius: 8px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(88, 166, 255, 0.1);
    z-index: 801;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Search row ─────────────────────────────────── */
  .palette-search {
    display: flex;
    align-items: center;
    padding: 0 14px;
    border-bottom: 1px solid var(--sk-border);
    gap: 10px;
    flex-shrink: 0;
  }

  .search-icon {
    font-size: 15px;
    color: var(--sk-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    height: 46px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--sk-text);
    font-size: 14px;
    font-family: 'Inter Variable', sans-serif;
    user-select: text;
    -webkit-user-select: text;
  }
  .search-input::placeholder { color: var(--sk-muted); }

  .clear-btn {
    background: transparent;
    border: none;
    color: var(--sk-muted);
    font-size: 16px;
    cursor: default;
    padding: 0 2px;
    line-height: 1;
    opacity: 0.6;
    flex-shrink: 0;
  }
  .clear-btn:hover { opacity: 1; }

  /* ── Results list ───────────────────────────────── */
  .palette-list {
    overflow-y: auto;
    max-height: 320px;
    padding: 4px 0;
  }

  .no-results {
    padding: 20px 16px;
    font-size: 13px;
    color: var(--sk-muted);
    text-align: center;
  }

  .palette-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 16px;
    background: transparent;
    border: none;
    color: var(--sk-text);
    font-size: 13px;
    font-family: 'Inter Variable', sans-serif;
    text-align: left;
    cursor: default;
    transition: background 0.08s;
  }

  .palette-item--selected,
  .palette-item:hover {
    background: #1c3a5f;
  }

  .cmd-label   { flex: 1; }
  .cmd-keybind {
    font-size: 11px;
    color: var(--sk-muted);
    background: var(--sk-bg);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--sk-border);
    font-family: 'JetBrains Mono Variable', monospace;
    flex-shrink: 0;
  }

  /* ── Footer ─────────────────────────────────────── */
  .palette-footer {
    display: flex;
    gap: 16px;
    padding: 7px 16px;
    border-top: 1px solid var(--sk-border);
    font-size: 10.5px;
    color: var(--sk-muted);
    font-family: 'JetBrains Mono Variable', monospace;
    flex-shrink: 0;
  }
</style>
