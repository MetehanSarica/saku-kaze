<script lang="ts">
  /**
   * StatusBar.svelte — bottom strip showing editor metadata.
   * All values are derived reactively from editorStore and fileStore.
   */
  import { fileStore }   from '$lib/stores/fileStore.svelte';
  import { editorStore } from '$lib/stores/editorStore.svelte';
  import { uiStore }     from '$lib/stores/uiStore.svelte';
</script>

<footer class="statusbar">

  <!-- Left cluster: file & encoding info -->
  <div class="cluster cluster-left">
    <span class="item">UTF-8</span>
    <span class="divider"></span>
    {#if fileStore.activeFile}
      <span class="item {fileStore.activeFile.isDirty ? 'item--dirty' : ''}">
        {fileStore.activeFile.isDirty ? '● Unsaved' : '✓ Saved'}
      </span>
      <span class="divider"></span>
    {/if}
    <span class="item">
      Spaces: {editorStore.tabSize}
    </span>
  </div>

  <!-- Right cluster: language & cursor -->
  <div class="cluster cluster-right">
    <button class="item item--lang" onclick={() => uiStore.openPalette()}>{editorStore.languageLabel}</button>
    <span class="divider"></span>
    <span class="item">{editorStore.cursorLabel}</span>
  </div>

</footer>

<style>
  .statusbar {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    height: 24px;
    background: var(--sk-surface);
    border-top: 1px solid var(--sk-border);
    font-size: 11.5px;
    font-family: 'JetBrains Mono Variable', monospace;
    user-select: none;
    overflow: hidden;
  }

  .cluster {
    display: flex;
    align-items: stretch;
  }

  .item {
    display: flex;
    align-items: center;
    padding: 0 10px;
    color: var(--sk-muted);
    white-space: nowrap;
    cursor: default;
    transition: background 0.1s, color 0.1s;
  }

  .item:hover {
    background: var(--sk-border);
    color: var(--sk-text);
  }

  .item--dirty { color: var(--sk-pink); }

  /* Language button */
  .item--lang {
    color: var(--sk-blue);
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: inherit;
    cursor: default;
  }
  .item--lang:hover {
    background: var(--sk-border);
    color: var(--sk-text);
  }

  .divider {
    width: 1px;
    background: var(--sk-border);
    margin: 4px 0;
    flex-shrink: 0;
  }
</style>
