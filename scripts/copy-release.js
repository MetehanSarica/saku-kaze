import { readdirSync, copyFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const root    = resolve(import.meta.dirname, '..');
const nsisSrc = join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const destDir = join(root, 'releases');

mkdirSync(destDir, { recursive: true });

const exes = readdirSync(nsisSrc).filter(f => f.endsWith('.exe'));

if (exes.length === 0) {
  console.error('No .exe found in', nsisSrc);
  process.exit(1);
}

for (const exe of exes) {
  const src  = join(nsisSrc, exe);
  const dest = join(destDir, exe);
  copyFileSync(src, dest);
  console.log(`✓ Copied: releases/${exe}`);
}
