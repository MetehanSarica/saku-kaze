<script lang="ts">
  /**
   * Editor.svelte — the CodeMirror 6 editor component.
   *
   * Responsibilities:
   *  - Create and own a single EditorView instance (lifecycle: mount → destroy).
   *  - Sync INBOUND: watch fileStore.activeFile; when a new file is opened or
   *    the active tab switches, replace the editor document.
   *  - Sync OUTBOUND: push every user keystroke to fileStore.updateContent(),
   *    marking the file dirty. Also update editorStore cursor position.
   *  - Reconfigure Compartments reactively when language, theme, wordWrap, or
   *    tabSize change in editorStore.
   *
   * IPC contract: this component has NO direct filesystem access.
   * All content comes through fileStore, which calls the Rust IPC commands.
   */
  import { onMount } from 'svelte';
  import { EditorView }  from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
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

  /**
   * Guard flag: set to `true` while the effect is dispatching a doc-replace
   * caused by a file-switch. Prevents the updateListener from echoing the
   * programmatic change back to fileStore (would corrupt dirty tracking).
   */
  let isUpdatingFromStore = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    const initialContent = fileStore.activeFile?.content ?? '';

    const state = EditorState.create({
      doc: initialContent,
      extensions: createBaseExtensions({
        language: getLanguageExtension(editorStore.currentLanguage),
        theme:    sakuDark,
        wordWrap: editorStore.wordWrap,
        tabSize:  editorStore.tabSize,
        onUpdate(update) {
          if (isUpdatingFromStore) return;

          // Push doc changes → fileStore (marks file dirty)
          if (update.docChanged) {
            const id = fileStore.activeFileId;
            if (id) {
              fileStore.updateContent(id, update.state.doc.toString());
            }
          }

          // Update cursor label in status bar on every selection change
          if (update.docChanged || update.selectionSet) {
            const sel  = update.state.selection.main;
            const line = update.state.doc.lineAt(sel.head);
            editorStore.setCursor(line.number, sel.head - line.from + 1);
          }
        },
      }),
    });

    view = new EditorView({ state, parent: container });
    viewReady = true;

    // Cleanup on component destroy
    return () => {
      view?.destroy();
      view = null;
      viewReady = false;
    };
  });

  // ── Reactive: sync content when active file changes ────────────────────────
  //
  // This effect reads fileStore.activeFile (a Svelte 5 reactive getter) and
  // fileStore.activeFile.content (a proxied property). It fires:
  //   a) when the user switches tabs (activeFileId changes → activeFile changes)
  //   b) when updateContent() is called from the updateListener above
  //
  // Case (b) is a no-op because the editor doc already equals the store content
  // at that point (we pushed from the editor TO the store, not the other way).
  // The string comparison short-circuits before any dispatch.
  $effect(() => {
    if (!viewReady || !view) return;

    const file       = fileStore.activeFile;
    const newContent = file?.content ?? '';
    const curContent = view.state.doc.toString();

    if (newContent === curContent) return;   // already in sync (case b) → bail

    // Case (a): genuine file switch — replace the whole document
    isUpdatingFromStore = true;
    view.dispatch({
      changes:   { from: 0, to: curContent.length, insert: newContent },
      selection: { anchor: 0 },
      // Scroll to top so the user sees the start of the new file
      effects: EditorView.scrollIntoView(0),
    });
    isUpdatingFromStore = false;

    // Detect language from the new file's extension and update the compartment
    if (file?.path) {
      editorStore.detectAndSetLanguage(file.path);
    }

    // Reset status bar
    editorStore.setCursor(1, 1);
  });

  // ── Reactive: language compartment ────────────────────────────────────────
  // For files larger than 1 MiB, syntax highlighting is disabled to keep
  // the incremental parser from blocking the main thread on large documents.
  const HIGHLIGHT_SIZE_LIMIT = 1 * 1024 * 1024; // 1 MiB

  $effect(() => {
    if (!viewReady || !view) return;
    const lang    = editorStore.currentLanguage;   // reactive read
    const content = fileStore.activeFile?.content ?? '';
    const langExt = content.length > HIGHLIGHT_SIZE_LIMIT
      ? []                              // skip heavy parsing for large files
      : getLanguageExtension(lang);
    view.dispatch({
      effects: languageCompartment.reconfigure(langExt),
    });
  });

  // ── Reactive: theme compartment ───────────────────────────────────────────
  // Reserved for Phase 7 (light/dark toggle). For now sakuDark is fixed.
  // The effect is wired up so swapping is one line when ready.
  $effect(() => {
    if (!viewReady || !view) return;
    // (no reactive read yet — will bind to a theme store field in Phase 7)
    view.dispatch({
      effects: themeCompartment.reconfigure(sakuDark),
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
      effects: tabSizeCompartment.reconfigure([
        EditorState.tabSize.of(size),
        indentUnit.of(' '.repeat(size)),
      ]),
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
