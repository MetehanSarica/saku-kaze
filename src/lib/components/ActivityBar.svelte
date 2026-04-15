<script lang="ts">
  /**
   * ActivityBar.svelte — the narrow icon strip on the far left (VSCode-style).
   *
   * Top group: Explorer, Search, Source Control, Extensions.
   * Bottom group: Account, Settings.
   *
   * Clicking the active icon toggles the sidebar; clicking a different icon
   * switches tabs and opens the sidebar.
   */
  import { uiStore }  from '$lib/stores/uiStore.svelte';
  import type { SideBarTab } from '$lib/stores/uiStore.svelte';

  interface Item {
    id:    SideBarTab;
    label: string;
    icon:  string; // SVG path data
  }

  const topItems: Item[] = [
    {
      id: 'explorer',
      label: 'Explorer',
      icon: 'M3 3h8v2H5v12h8v-2h2v4H3V3zm14 4h-6v2h4v6h-4v2h6V7z M9 9h6v2H9V9z',
    },
    {
      id: 'search',
      label: 'Search',
      icon: 'M11 3a8 8 0 1 0 0 16A8 8 0 0 0 11 3zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 11 5zm5.657 10.243 2.829 2.828-1.415 1.415-2.828-2.828 1.414-1.415z',
    },
    {
      id: 'source-control',
      label: 'Source Control',
      icon: 'M9 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM9 9v1.5A2.5 2.5 0 0 0 11.5 13H13v-2h-1.5A.5.5 0 0 1 11 10.5V9H9z',
    },
    {
      id: 'extensions',
      label: 'Extensions',
      icon: 'M3 12l4-4 2 2 5-5 3 3-5 5-2-2-3 3-4-2zm0 5h18v2H3v-2z',
    },
  ];
</script>

<nav class="activity-bar" aria-label="Activity bar">

  <!-- Top icons -->
  <div class="ab-group ab-group--top">
    {#each topItems as item (item.id)}
      {@const active = uiStore.activeSideBarTab === item.id && uiStore.sidebarOpen}
      <button
        class="ab-btn"
        class:ab-btn--active={active}
        title={item.label}
        aria-label={item.label}
        aria-pressed={active}
        onclick={() => uiStore.setActiveSideBarTab(item.id)}
      >
        <!-- Active indicator bar -->
        {#if active}
          <span class="ab-indicator"></span>
        {/if}
        <svg
          class="ab-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d={item.icon} />
        </svg>
      </button>
    {/each}
  </div>

  <!-- Bottom icons -->
  <div class="ab-group ab-group--bottom">
    <button class="ab-btn" title="Account" aria-label="Account" onclick={() => uiStore.toggleSettings()}>
      <svg class="ab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 11c-5 0-9 2.24-9 5v1h18v-1c0-2.76-4-5-9-5z"/>
      </svg>
    </button>
    <button class="ab-btn" title="Settings" aria-label="Settings" onclick={() => uiStore.toggleSettings()}>
      <svg class="ab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.69.07-1.08s-.03-.73-.07-1.08l2.3-1.8c.21-.16.27-.45.13-.68l-2.18-3.78c-.13-.23-.42-.31-.65-.23l-2.72 1.09c-.56-.43-1.16-.79-1.82-1.05L14.17 2H9.83L9.5 4.96C8.84 5.22 8.24 5.58 7.68 6.01L4.96 4.92c-.23-.08-.52 0-.65.23L2.13 8.93c-.14.23-.08.52.13.68l2.3 1.8c-.04.35-.07.7-.07 1.09s.03.73.07 1.08l-2.3 1.8c-.21.16-.27.45-.13.68l2.18 3.78c.13.23.42.31.65.23l2.72-1.09c.56.43 1.16.79 1.82 1.05l.33 2.96h4.34l.33-2.96c.66-.26 1.26-.62 1.82-1.05l2.72 1.09c.23.08.52 0 .65-.23l2.18-3.78c.14-.23.08-.52-.13-.68l-2.3-1.8z"/>
      </svg>
    </button>
  </div>

</nav>

<style>
  .activity-bar {
    display: flex;
    flex-direction: column;
    width: 50px;
    height: 100%;
    background: #181818;
    border-right: 1px solid #21262d;
    flex-shrink: 0;
    user-select: none;
  }

  .ab-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 0;
  }

  .ab-group--top  { flex: 1; }
  .ab-group--bottom { padding-bottom: 8px; }

  .ab-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: transparent;
    border: none;
    color: #6e7681;
    cursor: default;
    border-radius: 6px;
    transition: color 0.12s;
  }

  .ab-btn:hover            { color: #c9d1d9; }
  .ab-btn--active          { color: #c9d1d9; }
  .ab-btn--active:hover    { color: #ffffff; }

  /* Left-edge active bar */
  .ab-indicator {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 24px;
    background: #c9d1d9;
    border-radius: 0 2px 2px 0;
  }

  .ab-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }
</style>
