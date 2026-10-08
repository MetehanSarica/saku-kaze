/**
 * F5 "run file": builds the PowerShell command line sent to the terminal.
 *
 * The command runs from the file's own directory (so `cargo run` finds the
 * nearest Cargo.toml and relative paths behave), then returns the terminal to
 * where it was: `Push-Location …; try { … } finally { Pop-Location }`. The
 * finally block also runs when the program is stopped with Ctrl+C.
 */

/** Quote a string as a PowerShell single-quoted literal (no `$` expansion). */
export function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Program invocation per file extension; `file` is already PS-quoted. */
const RUNNERS: Record<string, (file: string) => string> = {
  py:  (f) => `python ${f}`,
  js:  (f) => `node ${f}`,
  mjs: (f) => `node ${f}`,
  cjs: (f) => `node ${f}`,
  ts:  (f) => `npx ts-node ${f}`,
  rs:  ()  => `cargo run`,
};

/** Extension (lower-case, no dot) of `path`, or '' if it has none. */
export function fileExtension(path: string): string {
  const base = path.replace(/\\/g, '/').split('/').pop() ?? '';
  return base.includes('.') ? (base.split('.').pop() ?? '').toLowerCase() : '';
}

/**
 * Build the PowerShell line (ending in `\r`) that runs `path`,
 * or null if there is no runner for its extension.
 */
export function buildRunCommand(path: string): string | null {
  const runner = RUNNERS[fileExtension(path)];
  if (!runner) return null;

  const winPath = path.replace(/\//g, '\\');
  let dir       = winPath.slice(0, Math.max(winPath.lastIndexOf('\\'), 0)) || '.';
  if (/^[A-Za-z]:$/.test(dir)) dir += '\\'; // "C:" means "current dir on C", not the root
  return `Push-Location -LiteralPath ${psQuote(dir)}; try { ${runner(psQuote(winPath))} } finally { Pop-Location }\r`;
}
