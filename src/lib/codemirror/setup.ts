/**
 * CodeMirror 6 base setup for Saku Kaze.
 *
 * Exports:
 *  - Four Compartments (language, theme, wordWrap, tabSize) used by Editor.svelte
 *    to reconfigure the view without destroying and recreating it.
 *  - `createBaseExtensions()` — the static extension list shared by every editor.
 *
 * Compartments are module-level singletons because there is only one editor
 * instance in this app at a time.
 */
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import {
  EditorState,
  Compartment,
  Prec,
} from '@codemirror/state';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  indentUnit,
  syntaxTree,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { lintKeymap, lintGutter, linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';

// ---------------------------------------------------------------------------
// Compartments — dynamic slots that can be reconfigured without a full rebuild
// ---------------------------------------------------------------------------

/** Swapped when the user opens a file with a different language. */
export const languageCompartment = new Compartment();

/** Reserved for future theme switching (e.g. light/dark toggle in Phase 7). */
export const themeCompartment = new Compartment();

/** Toggled by `editorStore.wordWrap`. */
export const wrapCompartment = new Compartment();

/** Updated whenever `editorStore.tabSize` changes. */
export const tabSizeCompartment = new Compartment();

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface BaseExtensionOptions {
  /** Initial language extension (from getLanguageExtension). */
  language: Extension;
  /** Initial theme extension (sakuDark). */
  theme: Extension;
  /** Whether lines should wrap initially. */
  wordWrap: boolean;
  /** Spaces per indentation level. */
  tabSize: number;
  /**
   * Callback fired on every update.
   * Used by Editor.svelte to push doc changes to fileStore and cursor to editorStore.
   */
  onUpdate: (update: import('@codemirror/view').ViewUpdate) => void;
}

/**
 * Build the full extension list for a new `EditorState`.
 * Stable extensions come first; dynamic compartments wrap their initial values.
 */
export function createBaseExtensions(opts: BaseExtensionOptions): Extension[] {
  return [
    // ── Core editing behaviours ─────────────────────────────────────────
    lineNumbers(),
    lintGutter(),
    // Syntax-error linter: walks the Lezer parse tree and flags every error
    // node the active language grammar emits as a red squiggly diagnostic.
    // Works for all Lezer-backed languages (JS, TS, Python, Rust, CSS, JSON…).
    // Falls back to zero diagnostics for plaintext (no parser, no errors).
    linter((view) => {
      const diagnostics: Diagnostic[] = [];
      syntaxTree(view.state).iterate({
        enter(node) {
          if (node.type.isError) {
            diagnostics.push({
              from: node.from,
              to: Math.max(node.to, node.from + 1),
              severity: 'error',
              message: 'Syntax error',
            });
          }
        },
      });
      return diagnostics;
    }),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    // Fallback highlight (when no language is loaded)
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),

    // ── Passthrough: let global shortcuts bubble to window ──────────────
    // These keys are handled by +page.svelte via <svelte:window onkeydown>.
    // run:()=>false means CM never marks them handled / calls preventDefault.
    Prec.highest(keymap.of([
      { key: 'Mod-s',       run: () => false },
      { key: 'Mod-Shift-s', run: () => false },
      { key: 'Mod-o',       run: () => false },
      { key: 'Mod-n',       run: () => false },
    ])),

    // ── Key bindings ────────────────────────────────────────────────────
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),

    // ── Dynamic compartments ────────────────────────────────────────────
    languageCompartment.of(opts.language),
    themeCompartment.of(opts.theme),
    wrapCompartment.of(opts.wordWrap ? EditorView.lineWrapping : []),
    tabSizeCompartment.of([
      EditorState.tabSize.of(opts.tabSize),
      indentUnit.of(' '.repeat(opts.tabSize)),
    ]),

    // ── Viewport margin ──────────────────────────────────────────────────
    // Keep 60px of scroll margin above/below the cursor so it's never
    // flush against the panel edges. CM6's virtual rendering is automatic;
    // this only affects where the view scrolls to keep the cursor visible.
    EditorView.scrollMargins.of(() => ({ top: 60, bottom: 60 })),

    // ── Change listener ─────────────────────────────────────────────────
    EditorView.updateListener.of(opts.onUpdate),
  ];
}
