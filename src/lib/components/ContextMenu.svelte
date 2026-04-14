<script lang="ts">
  import { uiStore } from '$lib/stores/uiStore.svelte';

  // ── Clipboard helpers ────────────────────────────────────────────────────

  async function cut(): Promise<void> {
    const sel = window.getSelection()?.toString() ?? '';
    if (sel) await navigator.clipboard.writeText(sel);
    document.execCommand('cut');
    uiStore.closeContextMenu();
  }

  async function copy(): Promise<void> {
    const sel = window.getSelection()?.toString() ?? '';
    if (sel) await navigator.clipboard.writeText(sel);
    uiStore.closeContextMenu();
  }

  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand('insertText', false, text);
    } catch {
      document.execCommand('paste');
    }
    uiStore.closeContextMenu();
  }

  function openPalette(): void {
    uiStore.closeContextMenu();
    uiStore.openPalette();
  }
</script>

{#if uiStore.contextMenuOpen}
  <!-- Backdrop: invisible full-screen layer that closes the menu on outside click -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="cm-backdrop"
    onmousedown={() => uiStore.closeContextMenu()}
    oncontextmenu={(e) => { e.preventDefault(); uiStore.closeContextMenu(); }}
  ></div>

  <div
    class="cm-menu"
    style="left: {uiStore.contextMenuX}px; top: {uiStore.contextMenuY}px;"
    role="menu"
    aria-label="Editor context menu"
  >
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="cm-item" role="menuitem" onmousedown={cut}>
      <span class="cm-label">Cut</span>
      <span class="cm-shortcut">Ctrl+X</span>
    </div>

    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="cm-item" role="menuitem" onmousedown={copy}>
      <span class="cm-label">Copy</span>
      <span class="cm-shortcut">Ctrl+C</span>
    </div>

    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="cm-item" role="menuitem" onmousedown={paste}>
      <span class="cm-label">Paste</span>
      <span class="cm-shortcut">Ctrl+V</span>
    </div>

    <div class="cm-separator" role="separator"></div>

    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="cm-item" role="menuitem" onmousedown={openPalette}>
      <span class="cm-label">Command Palette</span>
      <span class="cm-shortcut">Ctrl+Shift+P</span>
    </div>
  </div>
{/if}

<style>
  /* Invisible full-screen backdrop — closes the menu on outside interaction */
  .cm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: transparent;
  }

  /* Menu panel — floats above the backdrop */
  .cm-menu {
    position: fixed;
    z-index: 1000;
    min-width: 220px;
    padding: 4px 0;
    background:    #252526;
    border:        1px solid #454545;
    border-radius: 4px;
    box-shadow:    0 4px 16px rgba(0, 0, 0, 0.5);
    font-family:   'Inter Variable', 'Inter', sans-serif;
    font-size:     13px;
    user-select:   none;
  }

  /* Row */
  .cm-item {
    display:         flex;
    align-items:     center;
    justify-content: space-between;
    padding:         5px 16px 5px 12px;
    gap:             32px;
    cursor:          default;
    color:           #cccccc;
    border-radius:   0;
    transition:      background 0.07s;
  }

  .cm-item:hover {
    background: #04395e;
  }

  /* Action label (left) */
  .cm-label {
    flex-shrink: 0;
  }

  /* Keyboard shortcut hint (right, muted) */
  .cm-shortcut {
    color:       #9d9d9d;
    font-size:   11.5px;
    white-space: nowrap;
    margin-left: auto;
  }

  /* Horizontal rule between groups */
  .cm-separator {
    height:     1px;
    margin:     4px 0;
    background: #454545;
  }
</style>
