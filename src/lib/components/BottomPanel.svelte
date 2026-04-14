<script lang="ts">
  /**
   * BottomPanel.svelte — PROBLEMS / OUTPUT / TERMINAL tabs.
   *
   * The TERMINAL tab hosts an xterm.js instance wired to a true PTY process
   * via the portable-pty Rust backend. All input/output flows through the
   * native PTY — no fake REPL, no prompt simulation.
   */
  import { onDestroy }   from 'svelte';
  import { Terminal }    from '@xterm/xterm';
  import { FitAddon }    from '@xterm/addon-fit';
  import { invoke }      from '@tauri-apps/api/core';
  import { listen }      from '@tauri-apps/api/event';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { uiStore }     from '$lib/stores/uiStore.svelte';
  import type { BottomTab } from '$lib/stores/uiStore.svelte';
  import '@xterm/xterm/css/xterm.css';

  const TABS: { id: BottomTab; label: string }[] = [
    { id: 'problems', label: 'PROBLEMS' },
    { id: 'output',   label: 'OUTPUT'   },
    { id: 'terminal', label: 'TERMINAL' },
  ];

  // ── Drag-to-resize ─────────────────────────────────────────────────────

  let isDragging = $state(false);
  let startY = 0;
  let startH = 0;

  function startDrag(e: MouseEvent) {
    isDragging = true;
    startY = e.clientY;
    startH = uiStore.bottomPanelHeight;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }

  function onMove(e: MouseEvent) {
    if (!isDragging) return;
    uiStore.bottomPanelHeight = Math.max(80, Math.min(startH + (startY - e.clientY), 600));
  }

  function onUp() {
    isDragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  // ── Terminal state ──────────────────────────────────────────────────────

  let xtermEl: HTMLDivElement | undefined = $state();

  // Never $state — these objects must not be wrapped in a Proxy.
  let term:           Terminal       | null = null;
  let fitAddon:       FitAddon       | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let unlistenPty:    UnlistenFn    | null = null;

  // ── Terminal initialisation ─────────────────────────────────────────────

  async function initTerminal(): Promise<void> {
    if (!xtermEl || term) return;

    term = new Terminal({
      theme: {
        background:          '#0d1117',
        foreground:          '#c9d1d9',
        cursor:              '#58a6ff',
        selectionBackground: '#1c3a5f',
        black:               '#0d1117',
        brightBlack:         '#6e7681',
        red:                 '#f85149',
        brightRed:           '#f85149',
        green:               '#7ee787',
        brightGreen:         '#7ee787',
        yellow:              '#ffa657',
        brightYellow:        '#ffa657',
        blue:                '#58a6ff',
        brightBlue:          '#79c0ff',
        magenta:             '#d2a8ff',
        brightMagenta:       '#d2a8ff',
        cyan:                '#56d4e0',
        brightCyan:          '#56d4e0',
        white:               '#c9d1d9',
        brightWhite:         '#ffffff',
      },
      fontFamily:        'monospace',
      fontSize:          14,
      lineHeight:        1.2,
      cursorBlink:       true,
      scrollback:        5000,
      allowTransparency: false,
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(xtermEl);
    requestAnimationFrame(() => fitAddon?.fit());

    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon?.fit());
    });
    resizeObserver.observe(xtermEl);

    // Pipe all PTY output directly into xterm.
    unlistenPty = await listen<string>('pty-output', (event) => {
      term?.write(event.payload);
    });

    // Spawn the real PTY process in the backend.
    try {
      await invoke('spawn_pty');
    } catch (err) {
      term.write('\x1b[31m[Failed to start PTY: ' + err + ']\x1b[0m\r\n');
      return;
    }

    // Forward every keystroke from xterm directly to the PTY master.
    term.onData((data: string) => {
      invoke('write_pty', { data }).catch((err) => {
        term?.write('\x1b[31m[write_pty error: ' + err + ']\x1b[0m\r\n');
      });
    });
  }

  // Lazy-init on first visit to TERMINAL tab; subsequent tab switches refit explicitly
  // because removing display:none doesn't always trigger a ResizeObserver callback.
  $effect(() => {
    const isTerminal = uiStore.activeBottomTab === 'terminal';
    if (!isTerminal || !xtermEl) return;

    if (!term) {
      requestAnimationFrame(() => initTerminal());
    } else {
      requestAnimationFrame(() => fitAddon?.fit());
    }
  });

  onDestroy(() => {
    unlistenPty?.();
    resizeObserver?.disconnect();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    term?.dispose();
  });
</script>

<!-- Drag handle -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="bp-handle"
  class:bp-handle--dragging={isDragging}
  onmousedown={startDrag}
  title="Drag to resize panel"
></div>

<div class="bottom-panel" style="height: {uiStore.bottomPanelHeight}px;">

  <!-- Tab bar -->
  <div class="bp-tabbar" role="tablist" aria-label="Panel tabs">
    {#each TABS as tab (tab.id)}
      <button
        class="bp-tab"
        class:bp-tab--active={uiStore.activeBottomTab === tab.id}
        role="tab"
        aria-selected={uiStore.activeBottomTab === tab.id}
        onclick={() => uiStore.setActiveBottomTab(tab.id)}
      >{tab.label}</button>
    {/each}

    <div class="bp-spacer"></div>

    <button
      class="bp-close"
      aria-label="Close panel"
      onclick={() => uiStore.toggleBottomPanel()}
      title="Close panel (Ctrl+Shift+J)"
    >×</button>
  </div>

  <!-- Content panels — all kept in DOM; hidden via CSS so xterm canvas survives tab switches -->

  <div class="bp-content" class:bp-hidden={uiStore.activeBottomTab !== 'problems'} aria-hidden={uiStore.activeBottomTab !== 'problems'}>
    <div class="bp-empty">No problems have been detected in the workspace.</div>
  </div>

  <div class="bp-content" class:bp-hidden={uiStore.activeBottomTab !== 'output'} aria-hidden={uiStore.activeBottomTab !== 'output'}>
    {#if uiStore.outputLines.length === 0}
      <div class="bp-empty">Run a file with F5 to see output here.</div>
    {:else}
      <div class="bp-output">
        {#each uiStore.outputLines as line, i (i)}
          <div class="bp-out-line">{line}</div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="bp-content bp-content--terminal" class:bp-hidden={uiStore.activeBottomTab !== 'terminal'} aria-hidden={uiStore.activeBottomTab !== 'terminal'}>
    <div class="bp-xterm-host" bind:this={xtermEl}></div>
  </div>

</div>

<style>
  /* ── Drag handle ─────────────────────────────────────────── */
  .bp-handle {
    height: 4px;
    background: transparent;
    cursor: row-resize;
    flex-shrink: 0;
    transition: background 0.1s;
    border-top: 1px solid #21262d;
  }
  .bp-handle:hover,
  .bp-handle--dragging { background: #58a6ff44; }

  /* ── Panel shell ─────────────────────────────────────────── */
  .bottom-panel {
    display: flex;
    flex-direction: column;
    background: #0d1117;
    overflow: hidden;
    flex-shrink: 0;
    min-height: 80px;
  }

  /* ── Tab bar ─────────────────────────────────────────────── */
  .bp-tabbar {
    display: flex;
    align-items: stretch;
    height: 35px;
    background: #161b22;
    border-bottom: 1px solid #21262d;
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .bp-tabbar::-webkit-scrollbar { display: none; }

  .bp-tab {
    display: flex;
    align-items: center;
    padding: 0 14px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6e7681;
    font-size: 11px;
    font-family: 'Inter Variable', sans-serif;
    font-weight: 600;
    letter-spacing: 0.06em;
    cursor: default;
    white-space: nowrap;
    transition: color 0.1s, border-color 0.1s;
    flex-shrink: 0;
  }
  .bp-tab:hover   { color: #c9d1d9; }
  .bp-tab--active { color: #c9d1d9; border-bottom-color: #58a6ff; }

  .bp-spacer { flex: 1; }

  .bp-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    background: transparent;
    border: none;
    color: #6e7681;
    font-size: 18px;
    cursor: default;
    flex-shrink: 0;
    transition: color 0.1s;
  }
  .bp-close:hover { color: #f85149; }

  /* ── Content panels ──────────────────────────────────────── */
  .bp-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #21262d transparent;
    min-height: 0;
  }

  .bp-content--terminal {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .bp-hidden { display: none !important; }

  .bp-empty {
    padding: 12px 16px;
    font-size: 12px;
    color: #6e7681;
    font-family: 'Inter Variable', sans-serif;
    font-style: italic;
  }

  /* ── Output log ──────────────────────────────────────────── */
  .bp-output {
    padding: 6px 0;
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 12.5px;
    line-height: 1.55;
  }

  .bp-out-line {
    padding: 1px 16px;
    color: #c9d1d9;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .bp-out-line:hover { background: rgba(255,255,255,0.03); }

  /* ── xterm host ──────────────────────────────────────────── */
  .bp-xterm-host {
    flex: 1;
    min-height: 0;
    padding: 4px 6px;
    overflow: hidden;
    box-sizing: border-box;
  }

  /* Make xterm fill the host div exactly */
  .bp-xterm-host :global(.xterm) {
    height: 100%;
  }

  .bp-xterm-host :global(.xterm-viewport) {
    overflow-y: auto !important;
    scrollbar-width: thin;
    scrollbar-color: #21262d transparent;
  }

  .bp-xterm-host :global(.xterm-viewport::-webkit-scrollbar) {
    width: 6px;
  }
  .bp-xterm-host :global(.xterm-viewport::-webkit-scrollbar-thumb) {
    background: #21262d;
    border-radius: 3px;
  }

  /* Prevent xterm's internal padding from double-spacing with our host padding */
  .bp-xterm-host :global(.xterm-screen) {
    padding: 0;
  }
</style>
