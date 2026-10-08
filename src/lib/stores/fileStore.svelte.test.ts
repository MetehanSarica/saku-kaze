import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';

const readFile  = vi.fn<(path: string) => Promise<string>>();
const writeFile = vi.fn<(path: string, content: string) => Promise<void>>();

vi.mock('$lib/ipc/files', () => ({ readFile, writeFile }));
vi.mock('$lib/ipc/settings', () => ({ patchAndSave: vi.fn(() => Promise.resolve()) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve()) }));

const { fileStore } = await import('./fileStore.svelte');

// Reset the singleton between tests (vi.resetModules would load a second
// Svelte runtime whose signals can't be observed from this file's effects).
beforeEach(() => {
  for (const id of Array.from(fileStore.openFiles.keys())) fileStore.closeFile(id);
  readFile.mockReset();
  writeFile.mockReset().mockResolvedValue(undefined);
  vi.restoreAllMocks();
});

describe('line endings', () => {
  it('normalises CRLF on open and writes CRLF back on save', async () => {
    readFile.mockResolvedValue('a\r\nb\r\n');
    await fileStore.openFile('C:/p/a.txt');
    const file = fileStore.activeFile!;
    expect(file.content).toBe('a\nb\n');
    expect(file.eol).toBe('\r\n');

    fileStore.updateContent(file.id, 'a\nb\nc\n');
    await fileStore.saveFile(file.id);
    expect(writeFile).toHaveBeenCalledWith('C:/p/a.txt', 'a\r\nb\r\nc\r\n');
  });

  it('keeps LF files as LF', async () => {
    readFile.mockResolvedValue('x\ny\n');
    await fileStore.openFile('C:/p/b.rs');
    const file = fileStore.activeFile!;
    expect(file.eol).toBe('\n');
    fileStore.updateContent(file.id, 'x\ny\nz\n');
    await fileStore.saveFile(file.id);
    expect(writeFile).toHaveBeenCalledWith('C:/p/b.rs', 'x\ny\nz\n');
  });
});

describe('dirty tracking', () => {
  it('is reactive: effects see isDirty flip on edit and save', async () => {
    readFile.mockResolvedValue('');
    await fileStore.openFile('C:/p/c.txt');
    const id = fileStore.activeFileId!;

    const seen: boolean[] = [];
    const stop = $effect.root(() => {
      $effect(() => { seen.push(fileStore.activeFile?.isDirty ?? false); });
    });
    flushSync();

    fileStore.updateContent(id, 'hello');
    flushSync();
    await fileStore.saveFile(id);
    flushSync();
    stop();

    expect(seen).toEqual([false, true, false]);
  });

  it('stays dirty when the buffer changes while a save is in flight', async () => {
    readFile.mockResolvedValue('');
    await fileStore.openFile('C:/p/d.txt');
    const id = fileStore.activeFileId!;
    fileStore.updateContent(id, 'v1');

    let finishWrite!: () => void;
    writeFile.mockImplementationOnce(() => new Promise<void>(r => { finishWrite = r; }));
    const saving = fileStore.saveFile(id);
    fileStore.updateContent(id, 'v2');        // typed during the write
    finishWrite();
    await saving;

    expect(writeFile).toHaveBeenCalledWith('C:/p/d.txt', 'v1');
    expect(fileStore.activeFile!.isDirty).toBe(true);
  });
});

describe('tabs', () => {
  it('keeps the same tab id through Save As and re-detects the language', async () => {
    const id = fileStore.newFile();
    fileStore.updateContent(id, 'print(1)');
    await fileStore.saveFileAs(id, 'C:/p/script.py');

    expect(fileStore.activeFileId).toBe(id);
    const file = fileStore.activeFile!;
    expect(file.path).toBe('C:/p/script.py');
    expect(file.name).toBe('script.py');
    expect(file.language).toBe('python');
    expect(file.isDirty).toBe(false);
  });

  it('opens a path only once, even with different slashes/case or concurrent opens', async () => {
    readFile.mockResolvedValue('x');
    await Promise.all([
      fileStore.openFile('C:\\p\\e.txt'),
      fileStore.openFile('c:/P/e.txt'),
    ]);
    await fileStore.openFile('C:/p/e.txt');
    expect(fileStore.tabCount).toBe(1);
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('does not close a dirty tab when the user cancels the confirm', () => {
    const id = fileStore.newFile();
    fileStore.updateContent(id, 'unsaved');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    expect(fileStore.closeFileWithConfirm(id)).toBe(false);
    expect(fileStore.tabCount).toBe(1);
  });
});
