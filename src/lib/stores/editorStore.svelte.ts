/**
 * editorStore — reactive state for CodeMirror editor configuration.
 *
 * Phase 7: each user-facing setter now calls patchAndSave() so preferences
 * are persisted to ~/.saku-kaze/settings.json immediately on change.
 * Initial hydration is done via hydrate() called from +page.svelte after
 * loadSettings() returns — hydrate() does NOT trigger a save.
 */
import { patchAndSave } from '$lib/ipc/settings';
import type { AppSettings } from '$lib/ipc/settings';

// ---------------------------------------------------------------------------
// Supported language identifiers
// ---------------------------------------------------------------------------

export type LanguageId =
  | 'plaintext'
  | 'javascript'
  | 'typescript'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'python'
  | 'rust'
  | 'cpp'
  | 'java';

// ---------------------------------------------------------------------------
// Store class
// ---------------------------------------------------------------------------

class EditorStore {
  // ── Reactive state ────────────────────────────────────────────────────

  /** Editor font size in pixels. */
  fontSize = $state(14);

  /** Editor font family. */
  fontFamily = $state('JetBrains Mono');

  /** Whether long lines wrap in the editor viewport. */
  wordWrap = $state(false);

  /** Number of spaces per indentation level. */
  tabSize = $state(4);

  /** Auto-save mode. */
  autoSave = $state<'off' | 'onFocusChange' | 'afterDelay'>('off');

  /**
   * Currently active syntax language.
   * Drives the CodeMirror language Compartment (Phase 4).
   * Updated automatically when a file is opened (via extension detection).
   */
  currentLanguage = $state<LanguageId>('plaintext');

  /**
   * Line count of the active document (updated by the CM6 editor).
   * Shown in the status bar.
   */
  lineCount = $state(1);

  /**
   * Cursor position in the active document.
   * Updated by the CM6 editor on every selection change.
   */
  cursorLine = $state(1);
  cursorCol = $state(1);

  // ── Derived ──────────────────────────────────────────────────────────

  /** Human-readable label for the status bar, e.g. "Ln 12, Col 5". */
  get cursorLabel(): string {
    return `Ln ${this.cursorLine}, Col ${this.cursorCol}`;
  }

  /** Human-readable language name for the status bar. */
  get languageLabel(): string {
    const labels: Record<LanguageId, string> = {
      plaintext:  'Plain Text',
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      html:       'HTML',
      css:        'CSS',
      json:       'JSON',
      markdown:   'Markdown',
      python:     'Python',
      rust:       'Rust',
      cpp:        'C++',
      java:       'Java',
    };
    return labels[this.currentLanguage] ?? 'Plain Text';
  }

  // ── Hydration (no save) ───────────────────────────────────────────────

  /**
   * Populate editor preferences from the persisted AppSettings without
   * triggering a disk write. Called once from +page.svelte on startup.
   */
  hydrate(s: AppSettings): void {
    this.fontSize   = Math.max(8, Math.min(s.fontSize, 48));
    this.fontFamily = s.fontFamily || 'JetBrains Mono';
    this.wordWrap   = s.wordWrap;
    this.tabSize    = Math.max(1, Math.min(s.tabSize, 8));
    this.autoSave   = (s.autoSave as 'off' | 'onFocusChange' | 'afterDelay') ?? 'off';
  }

  // ── Actions (each persists) ───────────────────────────────────────────

  setLanguage(lang: LanguageId): void {
    this.currentLanguage = lang;
    // language is not persisted in settings — it's detected per-file
  }

  setFontSize(size: number): void {
    this.fontSize = Math.max(8, Math.min(size, 48));
    patchAndSave({ fontSize: this.fontSize }).catch(console.error);
  }

  setFontFamily(family: string): void {
    this.fontFamily = family;
    patchAndSave({ fontFamily: this.fontFamily }).catch(console.error);
  }

  setWordWrap(enabled: boolean): void {
    this.wordWrap = enabled;
    patchAndSave({ wordWrap: this.wordWrap }).catch(console.error);
  }

  setTabSize(size: number): void {
    this.tabSize = Math.max(1, Math.min(size, 8));
    patchAndSave({ tabSize: this.tabSize }).catch(console.error);
  }

  setAutoSave(mode: 'off' | 'onFocusChange' | 'afterDelay'): void {
    this.autoSave = mode;
    patchAndSave({ autoSave: this.autoSave }).catch(console.error);
  }

  /** Update cursor position — called by CodeMirror on each selection change. */
  setCursor(line: number, col: number): void {
    this.cursorLine = line;
    this.cursorCol = col;
  }

  /**
   * Detect the appropriate language from a file extension and apply it.
   * Returns the detected LanguageId for callers that need it.
   */
  detectAndSetLanguage(filePath: string): LanguageId {
    const ext = filePath.replace(/\\/g, '/').split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, LanguageId> = {
      js:   'javascript',
      mjs:  'javascript',
      cjs:  'javascript',
      jsx:  'javascript',
      ts:   'typescript',
      tsx:  'typescript',
      mts:  'typescript',
      html: 'html',
      htm:  'html',
      svelte: 'html',
      css:  'css',
      scss: 'css',
      less: 'css',
      json: 'json',
      jsonc:'json',
      md:   'markdown',
      mdx:  'markdown',
      py:   'python',
      pyw:  'python',
      rs:   'rust',
      cpp:  'cpp',
      cc:   'cpp',
      cxx:  'cpp',
      hpp:  'cpp',
      c:    'cpp',
      h:    'cpp',
      java: 'java',
    };
    const lang: LanguageId = map[ext] ?? 'plaintext';
    this.currentLanguage = lang;
    return lang;
  }
}

export const editorStore = new EditorStore();
