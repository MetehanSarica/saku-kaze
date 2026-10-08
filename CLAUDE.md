# Saku Kaze — project guide for Claude

Offline-first desktop code editor (lightweight VS Code alternative).
**Tauri v2 (Rust) + Svelte 5 runes + SvelteKit (SPA, adapter-static) + CodeMirror 6 + xterm.js.**
Windows-first: NSIS installer, `currentUser` install mode, terminal spawns `powershell.exe`.

## Commands

```bash
pnpm install                 # deps (pnpm only — no npm/yarn lockfiles)
pnpm tauri dev               # run the app (Vite on :1420 + Tauri window)
pnpm check                   # svelte-kit sync + svelte-check — must report 0 errors
pnpm test                    # Vitest (jsdom) — stores and Editor component
cd src-tauri && cargo check  # Rust type-check (cargo clippy for lints)
cd src-tauri && cargo test   # Rust unit tests
pnpm build:release           # tauri build + copy NSIS .exe into ./releases/
```

Tests: frontend tests live next to the code as `*.svelte.test.ts` (the `.svelte` part lets them use runes), configured in `vitest.config.ts`. Mock Tauri with `vi.mock('@tauri-apps/api/core', …)` / `vi.mock('$lib/ipc/…')`. Don't use `vi.resetModules()` — it loads a second Svelte runtime whose signals the test can't observe; reset singleton stores in `beforeEach` instead. Rust tests are `#[cfg(test)] mod tests` at the bottom of the module.

## Layout

```
src/
  routes/+page.svelte        root layout, global keyboard shortcuts, close guard, F5 "run file"
  lib/ipc/*.ts               typed wrappers around invoke() — one per Rust command
  lib/stores/*.svelte.ts     rune-based store classes, each exports a singleton
                             (fileStore, editorStore, workspaceStore, uiStore, toastStore)
  lib/codemirror/            setup.ts (base extensions + Compartments), languages.ts, themes/sakuDark.ts
  lib/components/            Svelte 5 components (Editor, TabBar, Sidebar, FileTreeNode, BottomPanel, …)
src-tauri/src/
  lib.rs                     plugin registration + generate_handler! list
  commands/                  fs_ops, workspace, settings, terminal (PTY)
  models/                    AppSettings, FileNode (serde structs sent over IPC)
  capabilities/default.json  permission allowlist for the main window
```

## IPC contract (non-negotiable)

- All filesystem / OS access lives in Rust as `#[tauri::command]` returning `Result<T, String>`.
- No `unwrap()` / `expect()` in command code — use `map_err(|e| format!("…'{}': {}", path, e))` and include the path.
- New command checklist: implement in `commands/*.rs` → register in `lib.rs` `generate_handler!` → add a typed wrapper in `src/lib/ipc/` → call the wrapper from stores. Components should not call `invoke()` directly (the terminal code in `BottomPanel.svelte` / `+page.svelte` is a legacy exception).
- Argument names: JS passes camelCase (`{ oldPath }`), Tauri maps to Rust snake_case (`old_path`).
- Struct field casing differs per model: `AppSettings` uses `#[serde(rename_all = "camelCase")]`, `FileNode` does **not** (`is_dir`). The TS interface must mirror the Rust struct exactly.
- File writes are atomic: write `.<name>.sktmp` in the same dir, then `rename`. Keep that pattern.
- Read size tiers: < 5 MiB inline string; 5–50 MiB returns `"STREAMING"` and emits `file-chunk` events split on UTF-8 char boundaries (`readFile()` reassembles); > 50 MiB rejected.
- Rust returns paths with forward slashes; frontend normalises with `.replace(/\\/g, '/')`.
- New plugin APIs need a permission in `src-tauri/capabilities/default.json`.
- Surface errors to the user via `toastStore.error(...)`, never silently swallow.

## Svelte 5 rules

- Runes only: `$state`, `$derived`, `$effect`, `$props`, `{@render}`, `onclick=` (not `on:click`). No `svelte/store`, no `export let`.
- Stores are classes in `*.svelte.ts` with `$state` fields and plain methods; export one instance.
- **Reactivity gotcha:** `$state` deep-proxies only plain objects and arrays. `Map`, `Set` and class instances are *not* tracked — mutating an object stored inside a `$state(new Map())` does not update the UI. Use `SvelteMap` from `svelte/reactivity` and store `$state` objects in it (see `fileStore.addFile`).
- Never put `EditorView`, xterm `Terminal`, `FitAddon` or other library instances in `$state` — keep them in plain `let`.
- Use `<script module>`, not the deprecated `<script context="module">`.

## CodeMirror rules

- One `EditorView` for the whole app (`Editor.svelte`). Reconfigure via the Compartments in `setup.ts` (`languageCompartment`, `themeCompartment`, `wrapCompartment`, `tabSizeCompartment`) — don't rebuild the view.
- One `EditorState` per tab: `switchTo()` stashes the outgoing state + `scrollSnapshot()` and loads the incoming one with `view.setState()`, then `applyConfig()` re-applies current settings to it. Never replace a tab's content by dispatching a whole-doc change — that enters undo history and leaks across tabs. Settings that live in a compartment must be added to both `createState()` and `applyConfig()`.
- Tab ids (`file-N`) are stable for the tab's lifetime — Save As changes `path`, not `id`. Look tabs up by path with `fileStore.findByPath()` / `samePath()` (slash- and case-insensitive).
- Buffer content in `fileStore` is always LF (as CodeMirror stores it). Each `OpenFile` has an `eol` detected on open; `writeToDisk` converts back. Don't write `file.content` to disk directly.
- Each `OpenFile` carries its own `language`; `editorStore.currentLanguage` mirrors the active tab.
- Syntax highlighting is skipped for docs > 1 MiB (`HIGHLIGHT_SIZE_LIMIT`).
- New language: add the `@codemirror/lang-*` package, a case in `languages.ts`, the `LanguageId` union + labels + extension map in `editorStore`, `LANG_EXT` in `ipc/dialogs.ts`, and the run/save extension maps in `+page.svelte`.

## Settings

Persisted at `~/.saku-kaze/settings.json`. Adding a field means touching **all four**: Rust `AppSettings` + its `Default` impl, TS `AppSettings` + the `_cache` default in `ipc/settings.ts`. Stores persist via `patchAndSave({ field })` and load via `hydrate(s)` (which must not save). `AppSettings` is `#[serde(default)]`, so missing fields fall back individually — keep the `Default` impl complete.

## Terminal (PTY)

`commands/terminal.rs` keeps one PowerShell PTY in `PtyState`. On Windows ConPTY, dropping the slave or master kills the child — both must stay stored. Output is emitted as `pty-output` events; input goes through `write_pty`. Known gaps: no resize command, no respawn after `exit`, UTF-8 can split across 4 KB reads.

## Offline & styling

- Zero network at runtime: no CDN links, no remote fonts, no dynamic imports from the web. Languages are bundled statically.
- Fonts come from `@fontsource-variable/*`; the CSS family names are `'Inter Variable'` and `'JetBrains Mono Variable'` (not `Inter` / `JetBrains Mono`).
- Colours: CSS variables `--sk-*` in `src/app.css` (mirrored in `tailwind.config.ts`). Component styling lives mostly in scoped `<style>` blocks. The editor palette is in `themes/sakuDark.ts`, the terminal palette in `BottomPanel.svelte`.

## Keyboard shortcuts

Global shortcuts live in `handleKeydown` in `+page.svelte`. If CodeMirror would swallow the key, add a `run: () => false` passthrough in the `Prec.highest` keymap in `setup.ts`. When adding/changing a shortcut, also update the `keybindings` list in `SettingsModal.svelte`, the welcome screen in `+page.svelte`, and the `CommandPalette.svelte` entry.

## Current state (v0.1.1)

Working: open/save/save-as, tabs, lazy file tree with rename/delete, settings persistence, command palette, PTY terminal, F5 run (py/js/mjs/ts/rs), close guard.
Placeholders (UI only, no backend): Search panel, Outline, Timeline, hard-coded "Rust Dependencies" list, Source Control, Extensions, Account, Auto Save setting, Problems and Output panels.
Unused: `read_directory` (recursive) command, `tauri-plugin-shell`, `utils/encoding.rs` stub.

## Conventions

- Match surrounding style: section-banner comments (`// ── Name ───`), doc comments on every command/store method, aligned assignments.
- Keep versions in sync across `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
- Before calling work done: `pnpm check` shows 0 errors, `pnpm test` and `cargo test` pass, `cargo check` is clean; for UI changes, run `pnpm tauri dev` and exercise the feature.
- Git: default branch `main`; do feature work on a branch; commit only when asked.
