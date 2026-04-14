<script lang="ts">
  /**
   * TabBar.svelte — horizontal scrollable strip of open-file tabs.
   *
   * - Click a tab        → focuses it
   * - Middle-click       → close (with dirty guard)
   * - × button           → close (with dirty guard)
   * - Active tab         → sakura-pink bottom border
   * - Run button         → calls onrun() prop (same as F5)
   */
  import { fileStore }   from '$lib/stores/fileStore.svelte';
  import { toastStore }  from '$lib/stores/toastStore.svelte';

  let { onrun }: { onrun?: () => void } = $props();

  async function closeTab(id: string, e: MouseEvent) {
    e.stopPropagation();
    const file = fileStore.openFiles.get(id);

    if (file?.isDirty) {
      // Use browser confirm for per-tab close — quick and non-blocking.
      // The full 3-button Save/Discard/Cancel guard is on window close (Phase 6).
      const discard = window.confirm(
        `"${file.name}" has unsaved changes.\n\nClose without saving?`
      );
      if (!discard) return;
      toastStore.warning(`"${file.name}" closed without saving.`);
    }

    fileStore.closeFile(id);
  }

  function handleMiddleClick(id: string, e: MouseEvent) {
    if (e.button === 1) closeTab(id, e);
  }
</script>

{#if fileStore.tabCount > 0}
  <div class="tabbar" role="tablist" aria-label="Open files">
    {#each fileStore.openFileList as file (file.id)}
      {@const active = fileStore.activeFileId === file.id}
      <!--
        Outer element is a <div role="tab"> to avoid the browser's
        "button-inside-button" repair which breaks Svelte's vDOM.
        The close × is the only real <button> inside.
      -->
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="tab"
        class:tab--active={active}
        role="tab"
        aria-selected={active}
        tabindex="0"
        title={file.path}
        onclick={() => fileStore.setActiveFile(file.id)}
        onkeydown={(e) => e.key === 'Enter' && fileStore.setActiveFile(file.id)}
        onmousedown={(e) => handleMiddleClick(file.id, e)}
      >
        <!-- File-type colour dot -->
        <span class="tab-dot" style="background: {getDotColor(file.name)}"></span>

        <!-- Name + dirty indicator -->
        <span class="tab-name">{file.name}</span>
        {#if file.isDirty}
          <span class="tab-dirty" aria-label="Unsaved changes">●</span>
        {/if}

        <!-- Close button -->
        <button
          class="tab-close"
          aria-label="Close {file.name}"
          onclick={(e) => closeTab(file.id, e)}
          tabindex="-1"
        >×</button>
      </div>
    {/each}

    <!-- Spacer pushes run button to the right -->
    <div class="tab-spacer"></div>

    <!-- Run button (F5) -->
    <button
      class="run-btn"
      title="Run file (F5)"
      aria-label="Run file"
      onclick={() => onrun?.()}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M3.5 2.5l10 5.5-10 5.5V2.5z"/>
      </svg>
    </button>
  </div>
{/if}

<script context="module" lang="ts">
  /** Map common extensions to a small indicator colour. */
  function getDotColor(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      js: '#f0d264', jsx: '#f0d264', mjs: '#f0d264',
      ts: '#3178c6', tsx: '#3178c6',
      rs: '#ce412b',
      py: '#3572a5',
      html: '#e34c26', svelte: '#ff3e00',
      css: '#264de4', scss: '#c6538c',
      json: '#cbcb41',
      md: '#5975ad',
      toml: '#9c4121',
    };
    return map[ext] ?? '#6e7681';
  }
</script>

<style>
  .tabbar {
    display: flex;
    align-items: stretch;
    height: 36px;
    background: var(--sk-bg);
    border-bottom: 1px solid var(--sk-border);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    flex-shrink: 0;
    gap: 0;
  }

  /* Hide scrollbar on WebKit but keep scrollability */
  .tabbar::-webkit-scrollbar { height: 3px; }
  .tabbar::-webkit-scrollbar-track { background: transparent; }
  .tabbar::-webkit-scrollbar-thumb { background: var(--sk-border); border-radius: 2px; }

  /* ── Individual tab ─────────────────────────────── */
  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px 0 10px;
    min-width: 100px;
    max-width: 200px;
    height: 100%;
    background: var(--sk-surface);
    border: none;
    border-right: 1px solid var(--sk-border);
    border-bottom: 2px solid transparent;   /* placeholder for active indicator */
    color: var(--sk-muted);
    font-size: 12px;
    font-family: 'JetBrains Mono Variable', monospace;
    cursor: default;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    flex-shrink: 0;
    position: relative;
  }

  .tab:hover {
    background: var(--sk-border);
    color: var(--sk-text);
  }

  .tab--active {
    background: var(--sk-bg);
    color: var(--sk-text);
    border-bottom-color: var(--sk-pink);    /* sakura-pink active indicator */
  }

  /* ── Dot ────────────────────────────────────────── */
  .tab-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── Name ───────────────────────────────────────── */
  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: left;
  }

  /* ── Dirty indicator ────────────────────────────── */
  .tab-dirty {
    color: var(--sk-pink);
    font-size: 9px;
    flex-shrink: 0;
    /* Hide when tab is hovered — close button takes over */
  }
  .tab:hover .tab-dirty { display: none; }

  /* ── Close button ───────────────────────────────── */
  .tab-close {
    display: none;                          /* hidden by default */
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background: transparent;
    border: none;
    color: var(--sk-muted);
    font-size: 13px;
    cursor: default;
    flex-shrink: 0;
    line-height: 1;
    padding: 0;
    transition: background 0.1s, color 0.1s;
  }

  .tab:hover .tab-close { display: flex; } /* show × on hover */

  .tab-close:hover {
    background: rgba(248, 81, 73, 0.2);
    color: #f85149;
  }

  /* ── Spacer + Run button ────────────────────────────── */
  .tab-spacer {
    flex: 1;
  }

  .run-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 100%;
    background: transparent;
    border: none;
    border-left: 1px solid var(--sk-border);
    color: #3fb950;
    cursor: default;
    flex-shrink: 0;
    transition: background 0.1s, color 0.1s;
  }

  .run-btn:hover {
    background: #2d3139;
    color: #56d364;
  }

  .run-btn:active {
    background: #1c2128;
  }
</style>
