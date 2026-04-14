/**
 * Typed wrappers around @tauri-apps/plugin-dialog.
 *
 * All functions return null when the user dismisses the dialog without
 * making a selection, so callers can pattern-match `if (!result) return`.
 *
 * Errors (OS dialog failure, plugin not registered, etc.) propagate as
 * rejected Promises — callers should funnel them through toastStore.
 */
import { open, save, ask, message } from '@tauri-apps/plugin-dialog';

// ---------------------------------------------------------------------------
// File open / folder open
// ---------------------------------------------------------------------------

/** Open a native file-picker. Returns the chosen absolute path or null. */
export async function openFileDialog(): Promise<string | null> {
  // open() with multiple:false returns string | null — no array case.
  return open({
    title: 'Open File',
    multiple: false,
    directory: false,
    filters: [
      {
        name: 'Text & Code',
        extensions: [
          'txt', 'md', 'mdx',
          'js', 'jsx', 'mjs', 'cjs',
          'ts', 'tsx', 'mts',
          'svelte', 'vue',
          'html', 'htm',
          'css', 'scss', 'less',
          'json', 'jsonc', 'toml', 'yaml', 'yml',
          'rs', 'py', 'pyw', 'rb', 'go',
          'cpp', 'cc', 'cxx', 'hpp', 'c', 'h',
          'java', 'kt', 'swift',
          'sh', 'bash', 'zsh', 'fish', 'ps1',
          'sql', 'graphql', 'gql',
          'xml', 'svg',
          'env', 'lock', 'config', 'conf', 'ini',
        ],
      },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
}

/** Open a native folder-picker. Returns the chosen absolute path or null. */
export async function openFolderDialog(): Promise<string | null> {
  // open() with directory:true returns string | null.
  return open({
    title: 'Open Folder',
    multiple: false,
    directory: true,
  });
}

// ---------------------------------------------------------------------------
// File save
// ---------------------------------------------------------------------------

/** Maps CodeMirror LanguageId → primary file extension for the save dialog. */
const LANG_EXT: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  html:       'html',
  css:        'css',
  json:       'json',
  markdown:   'md',
  python:     'py',
  rust:       'rs',
  cpp:        'cpp',
  java:       'java',
  plaintext:  'txt',
};

/**
 * Open a native save-file dialog.
 * @param suggestedName  Pre-filled filename shown in the dialog.
 * @param language       Active CodeMirror LanguageId — used to set the
 *                       default filter so the OS dialog defaults to the
 *                       right extension (e.g. "Python Files (*.py)").
 * @returns The chosen absolute path, or null if cancelled.
 */
export async function saveFileDialog(
  suggestedName?: string,
  language?: string,
): Promise<string | null> {
  const primaryExt = (language && LANG_EXT[language]) ? LANG_EXT[language] : 'txt';
  const langLabel  = language && language !== 'plaintext'
    ? language.charAt(0).toUpperCase() + language.slice(1)
    : 'Text';

  return save({
    title: 'Save File',
    defaultPath: suggestedName,
    filters: [
      // First filter is the OS default — always the active language type.
      { name: `${langLabel} Files`,  extensions: [primaryExt] },
      { name: 'Text & Code', extensions: ['txt', 'md', 'js', 'ts', 'rs', 'py', 'json', 'html', 'css'] },
      { name: 'All Files',   extensions: ['*'] },
    ],
  });
}

// ---------------------------------------------------------------------------
// Confirmation dialogs
// ---------------------------------------------------------------------------

/**
 * Ask the user whether to save dirty files before a destructive action.
 * Returns 'save' | 'discard' | 'cancel'.
 *
 * Implemented as two sequential native dialogs because Tauri's ask() is
 * two-button only (no native 3-button dialog API in v2).
 */
export async function askSaveBeforeClose(
  dirtyNames: string[],
): Promise<'save' | 'discard' | 'cancel'> {
  const list = dirtyNames.slice(0, 5).join(', ');
  const suffix = dirtyNames.length > 5 ? ` …and ${dirtyNames.length - 5} more` : '';

  // First dialog: "Do you want to save?"  Yes → save.  No → ask about discard.
  const wantSave = await ask(
    `The following files have unsaved changes:\n${list}${suffix}\n\nSave before closing?`,
    { title: 'Unsaved Changes', kind: 'warning', okLabel: 'Save', cancelLabel: "Don't Save" },
  );

  if (wantSave) return 'save';

  // Second dialog: confirm discard (prevents accidental "No" clicks)
  const wantDiscard = await ask(
    'Your changes will be lost. Discard and close?',
    { title: 'Discard Changes?', kind: 'warning', okLabel: 'Discard', cancelLabel: 'Cancel' },
  );

  return wantDiscard ? 'discard' : 'cancel';
}

/** Show a simple error message dialog. */
export async function showError(msg: string): Promise<void> {
  await message(msg, { title: 'Saku Kaze', kind: 'error' });
}
