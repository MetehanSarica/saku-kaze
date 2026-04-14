<script lang="ts">
  /**
   * Toast.svelte — stackable notification toasts.
   * Renders in the top-right corner, auto-dismisses after the store's timer.
   * Errors from Rust IPC (Result<T, String>) are surfaced here.
   */
  import { fly, fade } from 'svelte/transition';
  import { toastStore } from '$lib/stores/toastStore.svelte';

  const icons: Record<string, string> = {
    error:   '✕',
    warning: '⚠',
    success: '✓',
    info:    'ℹ',
  };
</script>

<div class="toast-portal" aria-live="assertive" aria-atomic="false">
  {#each toastStore.toasts as toast (toast.id)}
    <div
      class="toast toast--{toast.type}"
      in:fly={{ x: 60, duration: 220 }}
      out:fade={{ duration: 180 }}
      role="alert"
    >
      <span class="toast-icon">{icons[toast.type] ?? 'ℹ'}</span>
      <span class="toast-msg">{toast.message}</span>
      <button
        class="toast-close"
        aria-label="Dismiss notification"
        onclick={() => toastStore.dismiss(toast.id)}
      >×</button>
    </div>
  {/each}
</div>

<style>
  .toast-portal {
    position: fixed;
    top: 42px;      /* just below the title bar */
    right: 12px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    width: 360px;
    max-width: calc(100vw - 24px);
  }

  /* ── Toast card ─────────────────────────────────── */
  .toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid transparent;
    font-size: 12.5px;
    line-height: 1.5;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    pointer-events: all;
    word-break: break-word;
    font-family: 'JetBrains Mono Variable', monospace;
  }

  .toast--error   { background: #1a0a0a; border-color: #4d1a1a; color: #f98989; }
  .toast--warning { background: #1a1200; border-color: #4d3800; color: #ffc87a; }
  .toast--success { background: #091a0f; border-color: #1a4731; color: #7ee787; }
  .toast--info    { background: #0d1a2a; border-color: #1c3a5f; color: #7dcfff; }

  /* ── Icon ───────────────────────────────────────── */
  .toast-icon {
    flex-shrink: 0;
    font-size: 13px;
    margin-top: 1px;
    font-style: normal;
  }

  /* ── Message ────────────────────────────────────── */
  .toast-msg { flex: 1; }

  /* ── Dismiss button ─────────────────────────────── */
  .toast-close {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 15px;
    cursor: default;
    opacity: 0.5;
    padding: 0;
    line-height: 1;
    margin-top: -1px;
    transition: opacity 0.1s;
  }
  .toast-close:hover { opacity: 1; }
</style>
