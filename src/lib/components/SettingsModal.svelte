<script lang="ts">
  import { uiStore }    from '$lib/stores/uiStore.svelte';
  import { editorStore } from '$lib/stores/editorStore.svelte';

  let activeTab = $state('account');

  const tabs = [
    { id: 'account',     label: 'Account'     },
    { id: 'editor',      label: 'Editor'      },
    { id: 'appearance',  label: 'Appearance'  },
    { id: 'keybindings', label: 'Keybindings' },
  ];

  const fontFamilies = [
    'JetBrains Mono',
    'Fira Code',
    'Cascadia Code',
    'Consolas',
    'monospace',
  ];

  const keybindings = [
    { key: 'Ctrl+N',         action: 'New File'           },
    { key: 'Ctrl+O',         action: 'Open File'          },
    { key: 'Ctrl+S',         action: 'Save'               },
    { key: 'Ctrl+Shift+S',   action: 'Save As'            },
    { key: 'Ctrl+W',         action: 'Close Tab'          },
    { key: 'Ctrl+Shift+P',   action: 'Command Palette'    },
    { key: 'Ctrl+Shift+E',   action: 'Focus Explorer'     },
    { key: 'Ctrl+Shift+J',   action: 'Toggle Panel'       },
    { key: 'Alt+Z',          action: 'Toggle Word Wrap'   },
    { key: 'Shift+F11',      action: 'Zen Mode'           },
    { key: 'F5',             action: 'Run File'           },
    { key: 'Ctrl+=',         action: 'Increase Font Size' },
    { key: 'Ctrl+−',         action: 'Decrease Font Size' },
  ];

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) uiStore.closeSettings();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') uiStore.closeSettings();
  }
</script>

{#if uiStore.isSettingsOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    tabindex="-1"
  >
    <div class="modal">

      <!-- ── Header ──────────────────────────────────────────────────── -->
      <div class="modal-header">
        <span class="modal-title">Settings</span>
        <button class="close-btn" onclick={() => uiStore.closeSettings()} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- ── Tab bar ─────────────────────────────────────────────────── -->
      <nav class="modal-tabs">
        {#each tabs as tab (tab.id)}
          <button
            class="tab"
            class:tab--active={activeTab === tab.id}
            onclick={() => (activeTab = tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </nav>

      <!-- ── Body ────────────────────────────────────────────────────── -->
      <div class="modal-body">

        <!-- Account --------------------------------------------------- -->
        {#if activeTab === 'account'}
          <div class="placeholder-section">
            <svg class="placeholder-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 11c-5 0-9 2.24-9 5v1h18v-1c0-2.76-4-5-9-5z"/>
            </svg>
            <p class="placeholder-title">Account Settings</p>
            <p class="placeholder-sub">Account and profile settings will appear here in a future update.</p>
          </div>

        <!-- Editor ---------------------------------------------------- -->
        {:else if activeTab === 'editor'}
          <div class="settings-group">
            <h3 class="group-label">Text</h3>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Font Size</span>
                <span class="setting-desc">Editor font size in pixels (8–48)</span>
              </div>
              <div class="number-control">
                <button
                  class="num-btn"
                  onclick={() => editorStore.setFontSize(editorStore.fontSize - 1)}
                  aria-label="Decrease"
                >−</button>
                <input
                  class="num-input"
                  type="number"
                  min="8"
                  max="48"
                  value={editorStore.fontSize}
                  onchange={(e) => editorStore.setFontSize(Number((e.target as HTMLInputElement).value))}
                />
                <button
                  class="num-btn"
                  onclick={() => editorStore.setFontSize(editorStore.fontSize + 1)}
                  aria-label="Increase"
                >+</button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Font Family</span>
                <span class="setting-desc">Editor typeface</span>
              </div>
              <select
                class="setting-select"
                value={editorStore.fontFamily}
                onchange={(e) => editorStore.setFontFamily((e.target as HTMLSelectElement).value)}
              >
                {#each fontFamilies as f}
                  <option value={f}>{f}</option>
                {/each}
              </select>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Tab Size</span>
                <span class="setting-desc">Spaces per indentation level</span>
              </div>
              <select
                class="setting-select"
                value={editorStore.tabSize}
                onchange={(e) => editorStore.setTabSize(Number((e.target as HTMLSelectElement).value))}
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
                <option value={8}>8 spaces</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-label">Editing</h3>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Word Wrap</span>
                <span class="setting-desc">Wrap long lines to the viewport width</span>
              </div>
              <button
                class="toggle"
                class:toggle--on={editorStore.wordWrap}
                role="switch"
                aria-checked={editorStore.wordWrap}
                aria-label="Toggle word wrap"
                onclick={() => editorStore.setWordWrap(!editorStore.wordWrap)}
              >
                <span class="toggle-thumb"></span>
              </button>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Auto Save</span>
                <span class="setting-desc">Automatically save file changes</span>
              </div>
              <select
                class="setting-select"
                value={editorStore.autoSave}
                onchange={(e) => editorStore.setAutoSave(
                  (e.target as HTMLSelectElement).value as 'off' | 'onFocusChange' | 'afterDelay'
                )}
              >
                <option value="off">Off</option>
                <option value="onFocusChange">On Focus Change</option>
                <option value="afterDelay">After Delay</option>
              </select>
            </div>
          </div>

        <!-- Appearance ------------------------------------------------ -->
        {:else if activeTab === 'appearance'}
          <div class="settings-group">
            <h3 class="group-label">Theme</h3>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Color Theme</span>
                <span class="setting-desc">Editor color scheme</span>
              </div>
              <select class="setting-select" value="sakuDark" disabled>
                <option value="sakuDark">Saku Dark</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-label">Layout</h3>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Zen Mode</span>
                <span class="setting-desc">Hide all panels except the editor (Shift+F11)</span>
              </div>
              <button
                class="toggle"
                class:toggle--on={uiStore.zenMode}
                role="switch"
                aria-checked={uiStore.zenMode}
                aria-label="Toggle zen mode"
                onclick={() => uiStore.toggleZenMode()}
              >
                <span class="toggle-thumb"></span>
              </button>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Bottom Panel</span>
                <span class="setting-desc">Show the terminal and output panel</span>
              </div>
              <button
                class="toggle"
                class:toggle--on={uiStore.bottomPanelOpen}
                role="switch"
                aria-checked={uiStore.bottomPanelOpen}
                aria-label="Toggle bottom panel"
                onclick={() => uiStore.toggleBottomPanel()}
              >
                <span class="toggle-thumb"></span>
              </button>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-name">Sidebar</span>
                <span class="setting-desc">Show the file explorer sidebar</span>
              </div>
              <button
                class="toggle"
                class:toggle--on={uiStore.sidebarOpen}
                role="switch"
                aria-checked={uiStore.sidebarOpen}
                aria-label="Toggle sidebar"
                onclick={() => (uiStore.sidebarOpen = !uiStore.sidebarOpen)}
              >
                <span class="toggle-thumb"></span>
              </button>
            </div>
          </div>

        <!-- Keybindings ----------------------------------------------- -->
        {:else if activeTab === 'keybindings'}
          <div class="settings-group">
            <h3 class="group-label">Keyboard Shortcuts</h3>
            <div class="kb-table">
              {#each keybindings as kb}
                <div class="kb-row">
                  <span class="kb-action">{kb.action}</span>
                  <kbd class="kb-key">{kb.key}</kbd>
                </div>
              {/each}
            </div>
          </div>
        {/if}

      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 10px;
    width: 580px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  }

  /* ── Header ──────────────────────────────────────────────────────────── */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 0;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 14px;
    font-weight: 600;
    color: #c9d1d9;
    letter-spacing: 0.02em;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    color: #6e7681;
    cursor: default;
    border-radius: 6px;
    transition: color 0.12s, background 0.12s;
  }

  .close-btn:hover { color: #c9d1d9; background: #21262d; }

  /* ── Tabs ────────────────────────────────────────────────────────────── */
  .modal-tabs {
    display: flex;
    gap: 2px;
    padding: 12px 20px 0;
    border-bottom: 1px solid #21262d;
    flex-shrink: 0;
  }

  .tab {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    color: #6e7681;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: default;
    border-radius: 4px 4px 0 0;
    margin-bottom: -1px;
    transition: color 0.12s;
  }

  .tab:hover    { color: #c9d1d9; }
  .tab--active  { color: #c9d1d9; border-bottom-color: #58a6ff; }

  /* ── Body ────────────────────────────────────────────────────────────── */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 24px;
  }

  /* ── Settings groups ─────────────────────────────────────────────────── */
  .settings-group {
    padding-top: 24px;
  }

  .settings-group + .settings-group {
    border-top: 1px solid #21262d;
    margin-top: 8px;
  }

  .group-label {
    font-size: 10px;
    font-weight: 600;
    color: #6e7681;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 14px;
  }

  /* ── Setting row ─────────────────────────────────────────────────────── */
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 44px;
    border-radius: 6px;
    padding: 6px 8px;
    margin: 0 -8px;
    transition: background 0.1s;
  }

  .setting-row:hover { background: #1c2128; }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .setting-name {
    font-size: 13px;
    color: #c9d1d9;
    font-weight: 500;
  }

  .setting-desc {
    font-size: 11px;
    color: #484f58;
    line-height: 1.4;
  }

  /* ── Select ──────────────────────────────────────────────────────────── */
  .setting-select {
    appearance: none;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #c9d1d9;
    font-size: 12px;
    padding: 5px 28px 5px 10px;
    min-width: 140px;
    cursor: default;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%236e7681' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    transition: border-color 0.12s;
    flex-shrink: 0;
  }

  .setting-select:focus { outline: none; border-color: #58a6ff; }
  .setting-select:disabled { opacity: 0.5; }
  .setting-select option { background: #161b22; }

  /* ── Number control ──────────────────────────────────────────────────── */
  .number-control {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .num-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 5px;
    color: #c9d1d9;
    font-size: 14px;
    cursor: default;
    transition: background 0.1s, border-color 0.1s;
    flex-shrink: 0;
  }

  .num-btn:hover { background: #21262d; border-color: #58a6ff; }

  .num-input {
    width: 48px;
    text-align: center;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 5px;
    color: #c9d1d9;
    font-size: 12px;
    padding: 4px 4px;
    -moz-appearance: textfield;
    transition: border-color 0.12s;
  }

  .num-input:focus { outline: none; border-color: #58a6ff; }
  .num-input::-webkit-inner-spin-button,
  .num-input::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; }

  /* ── Toggle switch ───────────────────────────────────────────────────── */
  .toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 36px;
    height: 20px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 10px;
    cursor: default;
    transition: background 0.2s, border-color 0.2s;
    padding: 0;
    flex-shrink: 0;
  }

  .toggle--on { background: #1f6feb; border-color: #388bfd; }

  .toggle-thumb {
    position: absolute;
    left: 2px;
    width: 14px;
    height: 14px;
    background: #6e7681;
    border-radius: 50%;
    transition: left 0.2s, background 0.2s;
  }

  .toggle--on .toggle-thumb {
    left: 18px;
    background: #fff;
  }

  /* ── Keybindings table ───────────────────────────────────────────────── */
  .kb-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kb-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 8px;
    border-radius: 5px;
    transition: background 0.1s;
  }

  .kb-row:hover { background: #1c2128; }

  .kb-action {
    font-size: 12px;
    color: #c9d1d9;
  }

  .kb-key {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10.5px;
    color: #58a6ff;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 2px 8px;
    white-space: nowrap;
  }

  /* ── Account placeholder ─────────────────────────────────────────────── */
  .placeholder-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 0 32px;
    text-align: center;
  }

  .placeholder-icon {
    width: 40px;
    height: 40px;
    color: #30363d;
  }

  .placeholder-title {
    font-size: 14px;
    font-weight: 600;
    color: #6e7681;
    margin: 0;
  }

  .placeholder-sub {
    font-size: 12px;
    color: #484f58;
    margin: 0;
    max-width: 320px;
    line-height: 1.6;
  }
</style>
