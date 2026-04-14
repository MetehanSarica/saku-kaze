<script lang="ts">
  /**
   * Breadcrumb.svelte — path strip above the editor.
   *
   * Shows: workspaceName › relative › path › segments › filename
   * Derived from fileStore.activeFile.path and workspaceStore.rootPath.
   */
  import { fileStore }      from '$lib/stores/fileStore.svelte';
  import { workspaceStore } from '$lib/stores/workspaceStore.svelte';

  /** Split an absolute path into normalised forward-slash segments. */
  function splitPath(p: string): string[] {
    return p.replace(/\\/g, '/').split('/').filter(Boolean);
  }

  const crumbs = $derived((): string[] => {
    const file = fileStore.activeFile;
    if (!file) return [];
    if (!file.path) return [file.name]; // untitled

    const fileParts = splitPath(file.path);

    if (workspaceStore.rootPath) {
      const rootParts = splitPath(workspaceStore.rootPath);
      // Chop off the workspace prefix so we show a relative path.
      if (fileParts.slice(0, rootParts.length).join('/') === rootParts.join('/')) {
        const relParts = fileParts.slice(rootParts.length);
        const rootName = rootParts[rootParts.length - 1] ?? '';
        return [rootName, ...relParts];
      }
    }
    // Fallback: last 4 segments of the absolute path
    return fileParts.slice(-4);
  });
</script>

{#if fileStore.activeFile}
  <nav class="breadcrumb" aria-label="File path">
    {#each crumbs() as segment, i (i)}
      {#if i > 0}
        <span class="bc-sep" aria-hidden="true">›</span>
      {/if}
      <span
        class="bc-seg"
        class:bc-seg--last={i === crumbs().length - 1}
      >{segment}</span>
    {/each}
  </nav>
{/if}

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    height: 22px;
    padding: 0 12px;
    background: var(--sk-bg, #0d1117);
    border-bottom: 1px solid #21262d;
    gap: 2px;
    overflow: hidden;
    flex-shrink: 0;
    user-select: none;
  }

  .bc-sep {
    font-size: 11px;
    color: #6e7681;
    padding: 0 1px;
    flex-shrink: 0;
  }

  .bc-seg {
    font-size: 11.5px;
    font-family: 'JetBrains Mono Variable', monospace;
    color: #6e7681;
    white-space: nowrap;
    cursor: default;
    padding: 0 2px;
    border-radius: 3px;
    transition: color 0.1s;
    flex-shrink: 0;
  }

  .bc-seg:hover            { color: #c9d1d9; background: rgba(255,255,255,0.05); }
  .bc-seg--last            { color: #c9d1d9; }
  .bc-seg--last:hover      { color: #ffffff; }
</style>
