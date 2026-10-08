import { describe, it, expect } from 'vitest';
import { buildRunCommand, psQuote, fileExtension } from './run';

describe('psQuote', () => {
  it('wraps in single quotes and doubles embedded quotes', () => {
    expect(psQuote("C:\\it's\\a.py")).toBe("'C:\\it''s\\a.py'");
  });

  it('leaves $ alone — single quotes do not expand variables', () => {
    expect(psQuote('C:\\$env\\a.py')).toBe("'C:\\$env\\a.py'");
  });
});

describe('fileExtension', () => {
  it('handles dots in folder names and files without an extension', () => {
    expect(fileExtension('C:/my.proj/Makefile')).toBe('');
    expect(fileExtension('C:/my.proj/Main.PY')).toBe('py');
  });
});

describe('buildRunCommand', () => {
  it('runs python from the file directory and restores the location', () => {
    expect(buildRunCommand('C:/work/app/main.py')).toBe(
      "Push-Location -LiteralPath 'C:\\work\\app'; try { python 'C:\\work\\app\\main.py' } finally { Pop-Location }\r",
    );
  });

  it('runs cargo run from the .rs file directory so Cargo finds Cargo.toml', () => {
    expect(buildRunCommand('D:\\crate\\src\\main.rs')).toBe(
      "Push-Location -LiteralPath 'D:\\crate\\src'; try { cargo run } finally { Pop-Location }\r",
    );
  });

  it('uses the drive root, not the drive\'s current directory, for root files', () => {
    expect(buildRunCommand('C:/a.js')).toContain("Push-Location -LiteralPath 'C:\\';");
  });

  it('quotes paths with spaces, $ and apostrophes safely', () => {
    expect(buildRunCommand("C:/My Files/$x/it's.js")).toBe(
      "Push-Location -LiteralPath 'C:\\My Files\\$x'; try { node 'C:\\My Files\\$x\\it''s.js' } finally { Pop-Location }\r",
    );
  });

  it('returns null for files with no runner', () => {
    expect(buildRunCommand('C:/notes.txt')).toBeNull();
    expect(buildRunCommand('C:/Makefile')).toBeNull();
  });
});
