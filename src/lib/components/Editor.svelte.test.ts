import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve()) }));

const { fileStore } = await import('$lib/stores/fileStore.svelte');
const Editor = (await import('./Editor.svelte')).default;
let component: ReturnType<typeof mount> | null = null;

function getView(): EditorView {
  const dom = document.querySelector('.cm-editor');
  const view = dom && EditorView.findFromDOM(dom as HTMLElement);
  if (!view) throw new Error('EditorView not mounted');
  return view;
}

function type(view: EditorView, text: string) {
  view.dispatch({ changes: { from: view.state.doc.length, insert: text }, userEvent: 'input.type' });
}

beforeEach(() => {
  for (const id of Array.from(fileStore.openFiles.keys())) fileStore.closeFile(id);
  fileStore.newFile();
  component = mount(Editor, { target: document.body });
  flushSync();
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  document.body.innerHTML = '';
});

describe('Editor per-tab state', () => {
  it('undo never pulls content from another tab', () => {
    const view = getView();
    const a = fileStore.activeFileId!;
    type(view, 'aaa');

    const b = fileStore.newFile();
    flushSync();
    expect(view.state.doc.toString()).toBe('');

    // Old bug: this undo reverted the tab switch and put "aaa" into tab B.
    expect(undo(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('');
    expect(fileStore.openFiles.get(b)!.isDirty).toBe(false);

    type(view, 'bbb');
    fileStore.setActiveFile(a);
    flushSync();
    expect(view.state.doc.toString()).toBe('aaa');

    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('');
    expect(fileStore.openFiles.get(a)!.content).toBe('');
    expect(fileStore.openFiles.get(b)!.content).toBe('bbb');
  });

  it('restores each tab\'s own document and cursor when switching back', () => {
    const view = getView();
    const a = fileStore.activeFileId!;
    type(view, 'first\nsecond');
    view.dispatch({ selection: { anchor: 3 } });

    fileStore.newFile();
    flushSync();
    type(view, 'other');

    fileStore.setActiveFile(a);
    flushSync();
    expect(view.state.doc.toString()).toBe('first\nsecond');
    expect(view.state.selection.main.head).toBe(3);
  });

  it('drops a closed tab and shows the remaining one', () => {
    const view = getView();
    const a = fileStore.activeFileId!;
    type(view, 'keep');
    const b = fileStore.newFile();
    flushSync();
    type(view, 'gone');

    fileStore.closeFile(b);
    flushSync();
    expect(fileStore.activeFileId).toBe(a);
    expect(view.state.doc.toString()).toBe('keep');
  });
});
