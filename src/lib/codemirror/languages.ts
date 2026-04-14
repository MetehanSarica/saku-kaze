/**
 * Language support registry for CodeMirror 6.
 *
 * All language packages are bundled at build time — no dynamic imports,
 * no CDN fetches. This keeps the app fully offline-capable.
 */
import { javascript } from '@codemirror/lang-javascript';
import { html }       from '@codemirror/lang-html';
import { css }        from '@codemirror/lang-css';
import { json }       from '@codemirror/lang-json';
import { markdown }   from '@codemirror/lang-markdown';
import { python }     from '@codemirror/lang-python';
import { rust }       from '@codemirror/lang-rust';
import { cpp }        from '@codemirror/lang-cpp';
import { java }       from '@codemirror/lang-java';
import type { Extension } from '@codemirror/state';
import type { LanguageId } from '$lib/stores/editorStore.svelte';

/**
 * Return the CodeMirror `Extension` for the given language ID.
 * Returns an empty array (no-op extension) for `"plaintext"` or unknown IDs.
 */
export function getLanguageExtension(lang: LanguageId): Extension {
  switch (lang) {
    case 'javascript': return javascript({ jsx: true });
    case 'typescript': return javascript({ typescript: true, jsx: true });
    case 'html':       return html({ matchClosingTags: true, autoCloseTags: true });
    case 'css':        return css();
    case 'json':       return json();
    case 'markdown':   return markdown();
    case 'python':     return python();
    case 'rust':       return rust();
    case 'cpp':        return cpp();
    case 'java':       return java();
    case 'plaintext':
    default:           return [];
  }
}
