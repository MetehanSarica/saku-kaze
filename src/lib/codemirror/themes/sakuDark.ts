/**
 * Saku Kaze — sakuDark theme for CodeMirror 6.
 *
 * Palette (from plan.md):
 *   Background   #0d1117  (near-black)
 *   Surface      #161b22  (gutters, panels, active line)
 *   Selection    #1c3a5f  (blue tint)
 *   Cursor       #58a6ff  (ice blue)
 *   Strings      #f0a0b0  (sakura pink)
 *   Keywords     #7dcfff  (ice blue)
 *   Comments     #6e7681  (muted gray)
 *   Numbers/Type #ffa657  (warm orange)
 *   Functions    #d2a8ff  (soft purple)
 *   Errors       #f85149  (red)
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

// ---------------------------------------------------------------------------
// Editor chrome theme (background, gutters, selection, cursor…)
// ---------------------------------------------------------------------------

const sakuDarkEditorTheme = EditorView.theme(
  {
    // Root
    '&': {
      color: '#c9d1d9',
      backgroundColor: '#0d1117',
    },
    '.cm-content': {
      caretColor: '#58a6ff',
      padding: '4px 0 50vh',
    },

    // Cursor
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#58a6ff',
      borderLeftWidth: '2px',
      transition: 'left 0.08s ease-out, top 0.08s ease-out',
    },

    // Selection
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#264f78 !important' },
    '& ::selection': { backgroundColor: '#264f78 !important' },

    // Focused border
    '&.cm-focused': { outline: 'none' },

    // Active line — transparent so the selection layer shows through
    '.cm-activeLine':       { backgroundColor: '#ffffff0f' },
    '.cm-activeLineGutter': { backgroundColor: '#ffffff0f' },

    // Selection match highlight (find occurrences)
    '.cm-selectionMatch': {
      backgroundColor: '#1c3a5f',
      outline: '1px solid #3b82f6',
    },

    // Bracket matching
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: '#1c4060',
      outline: '1px solid #4a9eff',
    },
    '&.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#4d1a1a',
      outline: '1px solid #f85149',
    },

    // Gutters (line numbers)
    '.cm-gutters': {
      backgroundColor: '#0d1117',
      color: '#6e7681',
      border: 'none',
      borderRight: '1px solid #21262d',
    },
    '.cm-lineNumbers .cm-gutterElement': { paddingLeft: '12px', paddingRight: '8px' },
    '.cm-foldGutter .cm-gutterElement':  { paddingLeft: '4px' },

    // Fold placeholder
    '.cm-foldPlaceholder': {
      backgroundColor: '#21262d',
      border: 'none',
      color: '#6e7681',
      borderRadius: '2px',
      padding: '0 4px',
    },

    // Search panel
    '.cm-panels': {
      backgroundColor: '#161b22',
      color: '#c9d1d9',
    },
    '.cm-panels.cm-panels-top':    { borderBottom: '1px solid #21262d' },
    '.cm-panels.cm-panels-bottom': { borderTop:    '1px solid #21262d' },
    '.cm-searchMatch': {
      backgroundColor: '#2a4365',
      outline: '1px solid #3b82f6',
      borderRadius: '2px',
    },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#1c3a5f' },

    // Autocomplete tooltip
    '.cm-tooltip': {
      backgroundColor: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    },
    '.cm-tooltip-autocomplete ul li': {
      padding: '2px 8px',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: '#1c3a5f',
      color: '#c9d1d9',
    },

    // Lint gutter marks
    '.cm-lint-marker-error':   { color: '#f85149' },
    '.cm-lint-marker-warning': { color: '#ffa657' },
    '.cm-lintRange-error': {
      textDecoration:     'underline wavy #f85149',
      textUnderlineOffset: '3px',
    },
    '.cm-lintRange-warning': {
      textDecoration:     'underline wavy #ffa657',
      textUnderlineOffset: '3px',
    },

    // Scrollbar (WebKit)
    '.cm-scroller::-webkit-scrollbar': { width: '8px', height: '8px' },
    '.cm-scroller::-webkit-scrollbar-track': { background: '#0d1117' },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      background: '#21262d',
      borderRadius: '4px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': { background: '#30363d' },
  },
  { dark: true }
);

// ---------------------------------------------------------------------------
// Syntax highlight rules
// ---------------------------------------------------------------------------

const sakuDarkHighlightStyle = HighlightStyle.define([
  // Keywords — ice blue
  { tag: t.keyword,                   color: '#7dcfff', fontWeight: 'bold' },
  { tag: t.operatorKeyword,           color: '#7dcfff' },
  { tag: t.modifier,                  color: '#7dcfff' },
  { tag: t.definitionKeyword,         color: '#7dcfff' },
  { tag: t.controlKeyword,            color: '#ff7b72' },   // control flow: red-orange

  // Strings — sakura pink
  { tag: [t.string, t.special(t.string)], color: '#f0a0b0' },
  { tag: t.regexp,                        color: '#f0a0b0' },
  { tag: t.inserted,                      color: '#f0a0b0' },

  // Comments — muted gray
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: '#6e7681', fontStyle: 'italic' },

  // Numbers & booleans — warm orange
  { tag: [t.number, t.integer, t.float],  color: '#ffa657' },
  { tag: t.bool,                          color: '#79c0ff' },
  { tag: t.null,                          color: '#79c0ff' },

  // Types & classes — soft purple
  { tag: [t.typeName, t.className],       color: '#d2a8ff' },
  { tag: t.namespace,                     color: '#d2a8ff' },
  { tag: t.self,                          color: '#d2a8ff' },
  { tag: t.annotation,                    color: '#d2a8ff' },

  // Functions — pale gold / light blue
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#e3b341' },
  { tag: t.labelName,                     color: '#c9d1d9' },

  // Variables & properties
  { tag: [t.variableName, t.name],        color: '#c9d1d9' },
  { tag: t.propertyName,                  color: '#79c0ff' },
  { tag: t.special(t.variableName),       color: '#ffab70' },

  // Operators & punctuation
  { tag: t.operator,                      color: '#7dcfff' },
  { tag: [t.punctuation, t.separator],    color: '#8b949e' },
  { tag: t.bracket,                       color: '#c9d1d9' },
  { tag: t.squareBracket,                 color: '#c9d1d9' },

  // Meta & preprocessor
  { tag: t.meta,                          color: '#8b949e' },
  { tag: t.processingInstruction,         color: '#7dcfff' },
  { tag: t.escape,                        color: '#79c0ff' },

  // Markup / Markdown
  { tag: t.heading,                       color: '#79c0ff', fontWeight: 'bold' },
  { tag: t.strong,                        fontWeight: 'bold' },
  { tag: t.emphasis,                      fontStyle: 'italic' },
  { tag: t.strikethrough,                 textDecoration: 'line-through' },
  { tag: t.link,                          color: '#58a6ff', textDecoration: 'underline' },
  { tag: t.url,                           color: '#58a6ff' },
  { tag: t.monospace,                     color: '#f0a0b0' },

  // Attribute names (HTML/JSX)
  { tag: t.attributeName,                 color: '#79c0ff' },
  { tag: t.attributeValue,               color: '#f0a0b0' },

  // Tag names (HTML/JSX)
  { tag: t.tagName,                       color: '#7ee787' },   // green, classic HTML
  { tag: t.angleBracket,                  color: '#8b949e' },

  // Errors
  { tag: t.invalid,                       color: '#f85149', textDecoration: 'underline' },
  { tag: t.deleted,                       color: '#f85149' },

  // Atoms / constants
  { tag: t.atom,                          color: '#79c0ff' },
  { tag: t.constant(t.name),             color: '#79c0ff' },
]);

// ---------------------------------------------------------------------------
// Combined export
// ---------------------------------------------------------------------------

/** The sakuDark theme as a single CodeMirror Extension. */
export const sakuDark: Extension = [
  sakuDarkEditorTheme,
  syntaxHighlighting(sakuDarkHighlightStyle),
];
