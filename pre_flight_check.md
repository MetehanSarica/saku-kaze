# Saku Kaze -- Pre-Flight QA Audit

**Date:** 2026-04-15
**Phase:** 8 complete, preparing for Phase 9 (Packaging & Distribution)
**Auditor:** Claude Opus 4.6 (automated sweep)

---

## Systems Passed

### Rust / Tauri Backend

- **Zero `.unwrap()` calls** in all command handlers (`fs_ops.rs`, `terminal.rs`, `workspace.rs`, `settings.rs`). Every fallible operation uses `.map_err()` returning `Result<T, String>`.
- **Single `.expect()`** at `lib.rs:32` for the Tauri app builder — standard pattern, acceptable (app cannot function if the builder itself fails).
- **Atomic file writes** in both `write_file` and `save_settings` use the `.sktmp`-then-rename pattern with cleanup on failure.
- **PTY lifecycle** is correct: `PtyState` stores writer, slave, AND master handles in `Mutex<Option<...>>` to prevent premature drops (Windows ConPTY OS error 232). Background reader thread exits cleanly on `Ok(0) | Err(_)`.
- **Idempotent `spawn_pty`**: checks `writer.is_some()` before spawning; safe to call from both BottomPanel and `runCode()`.
- **Chunked streaming** (`read_file`): 5 MiB inline / 5-50 MiB chunked / >50 MiB rejected. Chunks emitted synchronously after full read — no main-thread blocking risk from the emit loop.
- **Directory traversal** capped at `MAX_DEPTH = 32` with `unwrap_or_default()` on recursive errors. Permission-denied entries are silently skipped.
- **Settings resilience**: `load_settings` returns `AppSettings::default()` on corrupt/missing file — app never hard-errors on bad config.
- **Managed state**: `PtyState` is pre-registered via `.manage()` before `.invoke_handler()` — no double-register panic.

### Svelte 5 Frontend

- **Runes-only architecture**: all stores use `$state`, `$derived`, `$effect`. No legacy `writable`/`readable` stores detected.
- **fileStore reactivity**: `openFiles` is `$state(new Map<...>())`. All mutations that change the Map identity (open, close, saveAs) create a new Map via `new Map(this.openFiles)`. In-place mutations (`updateContent`, `saveFile`) modify proxied object properties, which Svelte 5 deep reactivity tracks correctly.
- **Editor sync guard**: `isUpdatingFromStore` flag prevents the CM6 `updateListener` from echoing programmatic doc-replace changes back to `fileStore`, avoiding infinite update loops and dirty-flag corruption.
- **String comparison short-circuit**: the file-sync `$effect` in `Editor.svelte` compares `newContent === curContent` before dispatching, so keystroke echoes (case b) are no-ops.
- **Auto-Save on Run**: `runCode()` in `+page.svelte` awaits `fileStore.saveFile()` before constructing the PTY command — sequential, no race condition.
- **Save-before-run for untitled files**: `doSaveAs()` returns `string | null`; on cancel (`null`) the run aborts silently. After save, the file entry is re-read from the migrated Map key.

### Component Lifecycle & Cleanup

- **BottomPanel.svelte**: `onDestroy` cleans up `unlistenPty`, `resizeObserver.disconnect()`, drag event listeners (`mousemove`, `mouseup`), and `term.dispose()`.
- **TitleBar.svelte**: `onDestroy` calls `unlistenResize?.()` for the window resize listener.
- **+page.svelte**: `onDestroy` calls `unlistenClose?.()` for the close-requested listener.
- **Editor.svelte**: `onMount` returns a cleanup function that calls `view.destroy()`.
- **BottomPanel $effect**: `initTerminal()` has a `if (!xtermEl || term) return` guard — even if multiple `requestAnimationFrame` callbacks queue up from rapid tab switches, only the first executes. No duplicate ResizeObserver risk.
- **Context menu**: backdrop `onmousedown` closes the menu; `handleKeydown` in `+page.svelte` dismisses context menu at top of handler before processing shortcuts.

### Phase 8 Chunked Streaming

- **Frontend `readFile`** (`src/lib/ipc/files.ts`): listener registered before `invoke` so no chunks are dropped. 30-second timeout rejects the Promise and cleans up the listener if streaming stalls (Rust panic, pipe break, etc.).
- **Path-based demux**: `event.payload.path !== path` check prevents cross-file chunk mixing during concurrent opens.
- **Large-file highlight cutoff**: `Editor.svelte` disables syntax highlighting for files >1 MiB to prevent incremental parser from blocking the main thread.

### IPC & Capabilities

- **`capabilities/default.json`**: all required permissions present for core, dialog, window-state, opener, shell. Window control permissions (close, destroy, minimize, maximize, start-dragging, is-maximized) are complete.
- **Key passthrough**: CodeMirror setup (`setup.ts`) uses `Prec.highest` to prevent CM6 from swallowing `Mod-s`, `Mod-Shift-s`, `Mod-o`, `Mod-n` — these bubble correctly to the `<svelte:window onkeydown>` handler.

### Settings Persistence

- **`patchAndSave` pattern**: module-level `_cache` is seeded by `primeCache()` at startup. Each store patches only its fields, preventing cross-store clobbering.
- **Hydration**: `editorStore.hydrate()` and `uiStore.hydrate()` populate state without triggering saves.

---

## Fixes Applied

### 1. Chunked Read Timeout (files.ts)

**Problem:** `readFile()` for files in the 5-50 MiB streaming range created a Promise that could hang forever if the Rust backend panicked mid-stream or the event pipe broke.

**Fix:** Added a 30-second `setTimeout` safety net that rejects the stream Promise, calls `unlisten()`, and includes the file path in the error message. A `timedOut` guard prevents late-arriving chunks from resolving a rejected Promise.

**File:** `src/lib/ipc/files.ts` lines 35-41

### 2. Build Targets Narrowed to NSIS (tauri.conf.json)

**Problem:** `"targets": "all"` would attempt to build every installer format (NSIS, MSI, etc.) on `tauri build`. On Windows, some targets may fail or produce unwanted artifacts. Phase 9 plan specifies NSIS as the distribution format.

**Fix:** Changed `"targets": "all"` to `"targets": ["nsis"]`.

**File:** `src-tauri/tauri.conf.json` line 27

### 3. CommandPalette Save Dialog Language Parameter (CommandPalette.svelte)

**Problem:** The "File: Save" and "File: Save As" commands in CommandPalette called `saveFileDialog(file.name)` without passing the active language. This caused the OS save dialog to default to "Text Files (*.txt)" instead of the correct language filter (e.g. "Python Files (*.py)"). The same calls in `+page.svelte` correctly passed `editorStore.currentLanguage`.

**Fix:** Added `editorStore.currentLanguage` as the second argument to both `saveFileDialog` calls in the CommandPalette command registry.

**File:** `src/lib/components/CommandPalette.svelte` lines 63, 80

---

## Blocker Risks

### NSIS Installer Configuration (Medium Priority)

`tauri.conf.json` currently has no NSIS-specific configuration. For a production release, you should add:

```json
"nsis": {
  "installMode": "currentUser",
  "languages": ["English"],
  "displayLanguageSelector": false
}
```

Consider also adding a license file path if distribution requires EULA acceptance. This is a configuration task, not a code bug — the build will succeed without it, but the installer UX will use Tauri defaults.

### Vestigial Shell Spawn Permissions (Low Priority)

`capabilities/default.json` still contains `shell:allow-spawn` rules for powershell, cargo, python, node, and npx from the pre-PTY architecture. Now that code execution goes through `invoke('spawn_pty')` + `invoke('write_pty')`, these rules are dead config. They are not harmful but widen the capability surface beyond what the app actually uses. Consider removing them and the `shell:allow-execute` / `shell:allow-stdin-write` / `shell:allow-kill` permissions if no other code path uses them.

### No Code Signing (Expected)

The release profile in `Cargo.toml` is correctly configured (`opt-level = "s"`, `lto = true`, `strip = true`, `panic = "abort"`), but the NSIS installer will not be code-signed. Windows SmartScreen will flag the `.exe` on first run. This is expected for Phase 9 and can be addressed in a later phase with a code-signing certificate.

---

## Release Readiness

**Verdict: GO**

The codebase is structurally sound for Phase 9 packaging. All Rust command handlers propagate errors safely (no unwrap/panic paths). PTY lifecycle is correctly managed for Windows ConPTY. Svelte 5 reactivity is properly wired with appropriate guards against update loops and race conditions. Component cleanup is thorough — no memory leaks detected. The three fixes applied during this audit (streaming timeout, build targets, save dialog language) close the remaining gaps.

The NSIS configuration blocker is a nice-to-have for installer polish but does not prevent a functional build. Proceed with `pnpm tauri build` when ready.
