<script lang="ts">
  /**
   * Editor.svelte — the CodeMirror 6 editor component.
   *
   * Responsibilities:
   *  - Create and own a single EditorView instance (lifecycle: mount → destroy).
   *  - Keep one EditorState per tab. Switching tabs stashes the outgoing state
   *    (doc, undo history, selection, scroll) and swaps in the incoming one via
   *    view.setState(), so undo never crosses files.
   *  - Sync OUTBOUND: push every user keystroke to fileStore.updateContent(),
   *    marking the file dirty. Also update editorStore cursor position.
   *  - Reconfigure Compartments reactively when language, wordWrap, or tabSize
   *    change in editorStore, and re-apply them to a restored tab state.
   *
   * IPC contract: this component has NO direct filesystem access.
   * All content comes through fileStore, which calls the Rust IPC commands.
   */
  import { onMount, untrack } from 'svelte';
  import { EditorView }  from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import type { StateEffect } from '@codemirror/state';
  import { indentUnit }  from '@codemirror/language';

  import {
    createBaseExtensions,
    languageCompartment,
    themeCompartment,
    wrapCompartment,
    tabSizeCompartment,
  } from '$lib/codemirror/setup';
  import { sakuDark }              from '$lib/codemirror/themes/sakuDark';
  import { getLanguageExtension }  from '$lib/codemirror/languages';
  import { fileStore }             from '$lib/stores/fileStore.svelte';
  import { editorStore }           from '$lib/stores/editorStore.svelte';
  import type { LanguageId }       from '$lib/stores/editorStore.svelte';

  // ── DOM reference ─────────────────────────────────────────────────────────
  let container: HTMLDivElement;

  // ── Editor view (plain let, not $state — EditorView must not be proxied) ──
  let view: EditorView | null = null;

  /**
   * Reactive flag that becomes true once the EditorView is mounted.
   * Using $state (not a plain boolean) ensures all $effect blocks that
   * bailed with `view === null` are re-scheduled when the view is ready.
   */
  let viewReady = $state(false);

  // ── Per-tab state ─────────────────────────────────────────────────────────

  /** Stashed editor state of every non-visible tab, keyed by OpenFile.id. */
  const tabStates = new Map<string, { state: EditorState; scroll: StateEffect<unknown> }>();

  /** Id of the tab whose state is currently loaded in the view. */
  let currentId: string | null = null;

  // ── Configuration helpers ─────────────────────────────────────────────────

  // For files larger than 1 MiB, syntax highlighting is disabled to keep
  // the incremental parser from blocking the main thread on large documents.
  const HIGHLIGHT_SIZE_LIMIT = 1 * 1024 * 1024; // 1 MiB

  function languageFor(lang: LanguageId, docLength: number) {
    return docLength > HIGHLIGHT_SIZE_LIMIT ? [] : getLanguageExtension(lang);
  }

  function tabSizeFor(size: number) {
    return [EditorState.tabSize.of(size), indentUnit.of(' '.repeat(size))];
  }

  /** Build a fresh EditorState for a tab using the current editor settings. */
  function createState(content: string, lang: LanguageId): EditorState {
    return EditorState.create({
      doc: content,
      extensions: createBaseExtensions({
        language: languageFor(lang, content.length),
        theme:    sakuDark,
        wordWrap: editorStore.wordWrap,
        tabSize:  editorStore.tabSize,
        onUpdate(update) {
          // Push doc changes → fileStore (marks file dirty)
          if (update.docChanged && currentId) {
            fileStore.updateContent(currentId, update.state.doc.toString());
          }

          // Update cursor label in status bar on every selection change
          if (update.docChanged || update.selectionSet) {
            updateCursor(update.state);
          }
        },
      }),
    });
  }

  /** Re-apply every compartment from current settings (for a restored state). */
  function applyConfig(v: EditorView, lang: LanguageId): void {
    v.dispatch({
      effects: [
        languageCompartment.reconfigure(languageFor(lang, v.state.doc.length)),
        themeCompartment.reconfigure(sakuDark),
        wrapCompartment.reconfigure(editorStore.wordWrap ? EditorView.lineWrapping : []),
        tabSizeCompartment.reconfigure(tabSizeFor(editorStore.tabSize)),
      ],
    });
  }

  function updateCursor(state: EditorState): void {
    const sel  = state.selection.main;
    const line = state.doc.lineAt(sel.head);
    editorStore.setCursor(line.number, sel.head - line.from + 1);
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

  /** Stash the outgoing tab's state and load the state for tab `id`. */
  function switchTo(v: EditorView, id: string | null): void {
    if (id === currentId) return;

    if (currentId !== null && fileStore.openFiles.has(currentId)) {
      tabStates.set(currentId, { state: v.state, scroll: v.scrollSnapshot() });
    }
    // Drop stashed states of tabs that have been closed.
    for (const key of tabStates.keys()) {
      if (!fileStore.openFiles.has(key)) tabStates.delete(key);
    }

    currentId = id;
    const file = id ? fileStore.openFiles.get(id) : undefined;
    if (!file) return;

    editorStore.setLanguage(file.language);

    const saved = tabStates.get(file.id);
    if (saved) {
      tabStates.delete(file.id);
      v.setState(saved.state);
      applyConfig(v, file.language);
      v.dispatch({ effects: saved.scroll });
    } else {
      v.setState(createState(file.content, file.language));
    }
    updateCursor(v.state);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    view = new EditorView({ parent: container });
    switchTo(view, fileStore.activeFileId);
    viewReady = true;

    // Cleanup on component destroy
    return () => {
      view?.destroy();
      view = null;
      viewReady = false;
      currentId = null;
      tabStates.clear();
    };
  });

  // ── Reactive: swap state when the active tab changes ──────────────────────
  $effect(() => {
    if (!viewReady || !view) return;
    const id = fileStore.activeFileId;          // reactive read
    const v  = view;
    untrack(() => switchTo(v, id));
  });

  // ── Reactive: language compartment ────────────────────────────────────────
  // Also records the language on the active tab, so a palette override sticks
  // to that tab. activeFile is untracked: this must only run on language change.
  $effect(() => {
    if (!viewReady || !view) return;
    const lang = editorStore.currentLanguage;   // reactive read
    const v    = view;
    untrack(() => {
      const file = fileStore.activeFile;
      if (file && file.language !== lang) file.language = lang;
      v.dispatch({
        effects: languageCompartment.reconfigure(languageFor(lang, v.state.doc.length)),
      });
    });
  });

  // ── Reactive: word-wrap compartment ───────────────────────────────────────
  $effect(() => {
    if (!viewReady || !view) return;
    const wrap = editorStore.wordWrap;          // reactive read
    view.dispatch({
      effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  });

  // ── Reactive: tab-size compartment ────────────────────────────────────────
  $effect(() => {
    if (!viewReady || !view) return;
    const size = editorStore.tabSize;           // reactive read
    view.dispatch({
      effects: tabSizeCompartment.reconfigure(tabSizeFor(size)),
    });
  });
</script>

<!--
  The container div receives the CodeMirror editor via EditorView({ parent }).
  Font size is driven by a CSS variable so we avoid reconfiguring the entire
  view just for a font change — CSS handles it for free.
-->
<div
  class="editor-host"
  style="--editor-font-size: {editorStore.fontSize}px; --editor-font-family: '{editorStore.fontFamily} Variable', '{editorStore.fontFamily}', monospace;"
  bind:this={container}
  role="textbox"
  aria-label="Code editor"
  aria-multiline="true"
></div>

<style>
  .editor-host {
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Scope CM6 styles inside this component only */
  .editor-host :global(.cm-editor) {
    height: 100%;
    font-size: var(--editor-font-size, 14px);
    font-family: var(--editor-font-family, 'JetBrains Mono', monospace);
    line-height: 1.6;
  }

  .editor-host :global(.cm-scroller) {
    overflow: auto;
    font-family: inherit;
  }

  .editor-host :global(.cm-content),
  .editor-host :global(.cm-line) {
    font-family: inherit;
  }

  /* Keep gutter aligned with content */
  .editor-host :global(.cm-gutters) {
    min-height: 100%;
  }

  /* Ensure the editor fills the host on narrow viewports */
  .editor-host :global(.cm-editor.cm-focused) {
    outline: none;
  }
</style>
