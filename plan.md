  Saku Kaze — Master Development Plan

  ---
  Phase 0: Prerequisites & Environment

  Required Toolchains

  ┌────────────────────────────────┬───────────────────────────────────────────────┬─────────────────────────────────────────────┐
  │              Tool              │                    Version                    │                   Purpose                   │
  ├────────────────────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ Rust                           │ stable ≥ 1.82 (via rustup)                    │ Backend, Tauri core                         │
  ├────────────────────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ Node.js                        │ LTS 20.x (via nvm-windows)                    │ Svelte dev server, build tooling            │
  ├────────────────────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ pnpm                           │ ≥ 9.x                                         │ Package manager (faster, stricter than npm) │
  ├────────────────────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ Tauri CLI                      │ v2.x (cargo install tauri-cli --version "^2") │ Scaffolding, bundling                       │
  ├────────────────────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ Visual Studio Build Tools 2022 │ MSVC v143 + Windows 10/11 SDK                 │ Rust compilation on Windows                 │
  ├────────────────────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ WebView2                       │ Evergreen (ships with Win 10/11)              │ Tauri's rendering engine                    │
  └────────────────────────────────┴───────────────────────────────────────────────┴─────────────────────────────────────────────┘

  Environment Verification Commands

  rustc --version          # ≥ 1.82.0
  node --version           # ≥ 20.0.0
  pnpm --version           # ≥ 9.0.0
  cargo tauri --version    # ≥ 2.0.0

  Critical: Offline Constraint Setup

  All npm packages and Rust crates are fetched at build time only. The compiled .exe has zero runtime network dependencies. No CDN links in HTML. Fonts (Inter/JetBrains Mono) are vendored as static assets. Language grammars for CodeMirror ship as bundled JS — no
   dynamic fetching.

  ---
  The Architecture

  High-Level Data Flow

  ┌─────────────────────────────────────────────────┐
  │                  Svelte 5 Frontend              │
  │                                                 │
  │  ┌───────────┐   ┌────────────┐   ┌──────────┐ │
  │  │ Tab Bar   │   │ CodeMirror │   │ Sidebar  │ │
  │  │ (Runes)   │   │ 6 Editor   │   │ Explorer │ │
  │  └─────┬─────┘   └─────┬──────┘   └────┬─────┘ │
  │        │               │               │       │
  │        └───────┬───────┘───────┬───────┘       │
  │                │               │                │
  │         ┌──────▼──────┐ ┌─────▼───────┐        │
  │         │ editorStore │ │ fileStore   │        │
  │         │ (Runes)     │ │ (Runes)     │        │
  │         └──────┬──────┘ └─────┬───────┘        │
  │                └───────┬──────┘                 │
  │                        │                        │
  │                ┌───────▼────────┐               │
  │                │  IPC Bridge    │               │
  │                │  (invoke())    │               │
  │                └───────┬────────┘               │
  └────────────────────────┼────────────────────────┘
                           │  Tauri IPC (JSON)
  ┌────────────────────────┼────────────────────────┐
  │                ┌───────▼────────┐               │
  │                │ Command Router │               │
  │                │ (tauri::command)│               │
  │                └───────┬────────┘               │
  │                        │                        │
  │         ┌──────────────┼──────────────┐         │
  │         │              │              │         │
  │   ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐   │
  │   │ fs_ops    │ │ workspace │ │ settings  │   │
  │   │ module    │ │ module    │ │ module    │   │
  │   └───────────┘ └───────────┘ └───────────┘   │
  │                                                 │
  │                  Rust Backend                    │
  └─────────────────────────────────────────────────┘

  IPC Strategy: The Contract

  This is the most critical architectural decision. Every rule here must be followed by the code-writing LLM.

  Rule 1: All file I/O lives in Rust. The Svelte frontend never touches fs or fetch. Every disk operation goes through a #[tauri::command] function.

  Rule 2: Typed Result envelope. Every Rust command returns Result<T, String>. The String error is a human-readable message. Svelte always handles both arms — display content or show error toast. No unwrap() in command handlers. Ever.

  // Pattern for EVERY command:
  #[tauri::command]
  fn read_file(path: String) -> Result<String, String> {
      std::fs::read_to_string(&path).map_err(|e| format!("Failed to read '{}': {}", path, e))
  }

  Rule 3: Large file strategy. Files under 5 MB are sent as a single String over IPC. For files 5–50 MB, Rust streams content via Tauri events (app.emit("file-chunk", chunk)), and Svelte assembles them. Files over 50 MB get a warning dialog before loading. This 
  threshold is a constant in Rust (const LARGE_FILE_THRESHOLD: usize = 5 * 1024 * 1024;).

  Rule 4: Non-blocking IPC. All invoke() calls on the frontend are awaited inside async functions. No blocking the UI thread. Rust commands that do heavy I/O use #[tauri::command(async)] (which is default in Tauri v2 — but be explicit).

  Rule 5: Frontend state is the source of truth for UI; Rust is the source of truth for disk. The frontend holds "what the user sees" (open tabs, unsaved buffers, cursor positions). Rust holds "what's on disk" (file contents, directory trees, file metadata).    
  Save operations push from frontend state to Rust. Load operations pull from Rust to frontend state.

  State Management: Svelte 5 Runes

  Three core stores, implemented as Rune-based reactive modules:

  ┌──────────────────────────┬────────────────────────────────────────┬──────────────────────────────────────────┐
  │          Store           │             Responsibility             │                Key State                 │
  ├──────────────────────────┼────────────────────────────────────────┼──────────────────────────────────────────┤
  │ fileStore.svelte.ts      │ Open files, dirty tracking, active tab │ openFiles, activeFileId, isDirty map     │
  ├──────────────────────────┼────────────────────────────────────────┼──────────────────────────────────────────┤
  │ editorStore.svelte.ts    │ CodeMirror config, language, theme     │ currentLanguage, wordWrap, fontSize      │
  ├──────────────────────────┼────────────────────────────────────────┼──────────────────────────────────────────┤
  │ workspaceStore.svelte.ts │ Sidebar tree, recent files, settings   │ directoryTree, recentFiles, userSettings │
  └──────────────────────────┴────────────────────────────────────────┴──────────────────────────────────────────┘

  Each store is a module exporting $state and $derived runes. No Svelte stores API (writable/readable) — Runes only.

  ---
  Project Structure

  saku-kaze/
  ├── src-tauri/                          # Rust backend
  │   ├── Cargo.toml
  │   ├── tauri.conf.json                 # Tauri v2 config (NSIS, window, permissions)
  │   ├── capabilities/                   # Tauri v2 permission capabilities
  │   │   └── default.json
  │   ├── icons/                          # App icons (all sizes)
  │   ├── src/
  │   │   ├── main.rs                     # Entry point, command registration
  │   │   ├── commands/                   # IPC command handlers
  │   │   │   ├── mod.rs
  │   │   │   ├── fs_ops.rs              # read_file, write_file, rename, delete
  │   │   │   ├── workspace.rs           # read_directory_tree, watch_directory
  │   │   │   └── settings.rs            # load_settings, save_settings
  │   │   ├── models/                     # Shared types (serialized over IPC)
  │   │   │   ├── mod.rs
  │   │   │   ├── file_node.rs           # FileNode struct for directory tree
  │   │   │   └── app_settings.rs        # Settings struct
  │   │   └── utils/                      # Helpers
  │   │       ├── mod.rs
  │   │       └── encoding.rs            # Encoding detection (UTF-8/UTF-16)
  │   └── eula/
  │       └── MIT_EULA.txt               # Embedded in NSIS installer
  │
  ├── src/                                # Svelte 5 frontend
  │   ├── app.html                        # HTML shell (no CDN links)
  │   ├── app.css                         # Tailwind directives + CSS variables
  │   ├── lib/
  │   │   ├── stores/                     # Rune-based state
  │   │   │   ├── fileStore.svelte.ts
  │   │   │   ├── editorStore.svelte.ts
  │   │   │   └── workspaceStore.svelte.ts
  │   │   ├── ipc/                        # Typed IPC wrappers
  │   │   │   ├── files.ts               # invoke('read_file'), invoke('write_file')
  │   │   │   ├── workspace.ts           # invoke('read_directory')
  │   │   │   └── settings.ts            # invoke('load_settings')
  │   │   ├── codemirror/                 # CM6 setup
  │   │   │   ├── setup.ts              # Base extensions, keymaps
  │   │   │   ├── languages.ts          # Language compartment + bundled grammars
  │   │   │   └── themes/
  │   │   │       └── sakuDark.ts       # Custom dark theme
  │   │   ├── components/
  │   │   │   ├── Editor.svelte          # CodeMirror wrapper component
  │   │   │   ├── TabBar.svelte          # Open file tabs
  │   │   │   ├── Sidebar.svelte         # File explorer tree
  │   │   │   ├── StatusBar.svelte       # Language, line/col, encoding
  │   │   │   ├── TitleBar.svelte        # Custom draggable title bar
  │   │   │   ├── CommandPalette.svelte  # Ctrl+Shift+P quick actions
  │   │   │   └── Toast.svelte           # Error/info notifications
  │   │   └── utils/
  │   │       ├── languageDetect.ts      # Map file extension → CM6 language
  │   │       └── keybindings.ts         # Custom keybinding definitions
  │   ├── routes/                         # SvelteKit-style (single route)
  │   │   └── +page.svelte               # Main layout: Sidebar | Editor | StatusBar
  │   └── vite-env.d.ts
  │
  ├── static/                             # Vendored static assets
  │   └── fonts/
  │       ├── inter/                      # UI font (woff2 files)
  │       └── jetbrains-mono/            # Editor font (woff2 files)
  │
  ├── package.json
  ├── pnpm-lock.yaml
  ├── svelte.config.js
  ├── vite.config.ts
  ├── tailwind.config.ts
  ├── tsconfig.json
  └── README.md

  ---
  Phase-by-Phase Roadmap

  Phase 1: Scaffold & Build Pipeline

  Goal: cargo tauri dev opens an empty window with a styled HTML shell.

  Steps:
  1. Initialize Tauri v2 project with Svelte + TypeScript template (pnpm create tauri-app --template sveltekit-ts or manual scaffold with Vite).
  2. Configure tauri.conf.json: window title "Saku Kaze", default size 1280x800, decorations false (custom title bar), transparent false.
  3. Set up Tailwind CSS with dark-mode-first config (darkMode: 'class', default class applied).
  4. Vendor Inter and JetBrains Mono fonts into static/fonts/, reference via @font-face in app.css.
  5. Create empty +page.svelte with a placeholder layout (title bar, sidebar, main area, status bar — all empty divs with bg colors).
  6. Verify cargo tauri dev compiles and shows the window.

  Deliverable: Running app shell with custom fonts, Tailwind, dark background. Zero functionality.

  ---
  Phase 2: Rust File I/O Commands

  Goal: The Rust backend can read files, write files, and list directories.

  Steps:
  1. Create commands/fs_ops.rs with:
    - read_file(path: String) -> Result<String, String> — reads UTF-8 text, returns content.
    - write_file(path: String, content: String) -> Result<(), String> — atomic write (write to .tmp, then rename).
    - delete_file(path: String) -> Result<(), String>
    - rename_file(old: String, new_name: String) -> Result<(), String>
  2. Create commands/workspace.rs with:
    - read_directory(path: String) -> Result<Vec<FileNode>, String> — returns recursive tree.
    - FileNode struct: { name, path, is_dir, children: Option<Vec<FileNode>> }
  3. Create commands/settings.rs with:
    - load_settings() -> Result<AppSettings, String> — reads from ~/.saku-kaze/settings.json, returns defaults if missing.
    - save_settings(settings: AppSettings) -> Result<(), String>
  4. Register all commands in main.rs via .invoke_handler(tauri::generate_handler![...]).
  5. Configure Tauri v2 capabilities (capabilities/default.json) to permit the required APIs.

  Deliverable: All IPC commands callable from JS. Testable via invoke() in browser console during cargo tauri dev.

  ---
  Phase 3: IPC Bridge & Stores

  Goal: Svelte can call Rust and reactively hold state.

  Steps:
  1. Create typed wrappers in lib/ipc/files.ts:
  import { invoke } from '@tauri-apps/api/core';
  export async function readFile(path: string): Promise<string> {
    return invoke<string>('read_file', { path });
  }
  1. One wrapper per Rust command. Every wrapper is async and typed.
  2. Build fileStore.svelte.ts using Runes:
    - $state for openFiles: Map<string, OpenFile> where OpenFile = { id, path, name, content, isDirty }.
    - $state for activeFileId: string | null.
    - $derived for activeFile (computed from map + id).
    - Actions: openFile(path), closeFile(id), saveFile(id), updateContent(id, content).
  3. Build workspaceStore.svelte.ts:
    - $state for directoryTree: FileNode[] and rootPath: string | null.
    - Action: openFolder(path) — calls IPC, populates tree.
  4. Build editorStore.svelte.ts:
    - $state for fontSize, wordWrap, currentLanguage.
    - These drive CodeMirror compartment reconfigurations (Phase 4).

  Deliverable: Stores are reactive, IPC calls succeed, state updates propagate. No UI yet.

  ---
  Phase 4: CodeMirror 6 Integration

  Goal: A functional code editor with syntax highlighting and dynamic language switching.

  Steps:
  1. Install CM6 packages (all bundled at build time):
    - @codemirror/state, @codemirror/view, @codemirror/commands
    - @codemirror/language + specific language packages: @codemirror/lang-javascript, @codemirror/lang-html, @codemirror/lang-css, @codemirror/lang-json, @codemirror/lang-markdown, @codemirror/lang-python, @codemirror/lang-rust, @codemirror/lang-cpp,
  @codemirror/lang-java
    - @codemirror/autocomplete, @codemirror/search, @codemirror/lint
  2. Create codemirror/setup.ts — base configuration:
    - Line numbers, active line highlight, bracket matching, indentation guides
    - Default keymap + search keymap
    - Two Compartments: one for language, one for theme.
  3. Create codemirror/languages.ts:
    - Map of extension → language support ({ "js": javascript(), "ts": javascript({ typescript: true }), ... }).
    - switchLanguage(view: EditorView, ext: string) function that reconfigures the language compartment.
  4. Create codemirror/themes/sakuDark.ts — custom dark theme:
    - Background: #0d1117 (near-black), selection: #1c3a5f, cursor: #58a6ff
    - Syntax colors: soft pastels — strings in sakura pink (#f0a0b0), keywords in ice blue (#7dcfff), comments in muted gray (#6e7681).
  5. Create Editor.svelte:
    - onMount: create EditorView, attach to container div.
    - Bind to fileStore.activeFile.content — when content changes externally (file opened), call view.dispatch to replace doc.
    - On editor changes (via EditorView.updateListener), push new content to fileStore.updateContent() — this sets isDirty = true.
    - $effect watching editorStore.currentLanguage — reconfigure compartment on change.

  Deliverable: Fully functional editor pane with syntax highlighting, dark theme, and dynamic language detection on file open.

  ---
  Phase 5: UI Shell — Sidebar, Tabs, Title Bar, Status Bar

  Goal: The app looks and feels like a professional code editor.

  Steps:
  1. TitleBar.svelte: Custom draggable title bar (since decorations are off). Uses Tauri's data-tauri-drag-region. Window control buttons (minimize, maximize, close) calling appWindow.minimize(), etc. Display filename + dirty indicator.
  2. Sidebar.svelte: Recursive file tree component. Clicking a file calls fileStore.openFile(path). Folder expand/collapse. Icons for file types (use simple SVG or Unicode). Right-click context menu: New File, New Folder, Rename, Delete.
  3. TabBar.svelte: Horizontal tabs from fileStore.openFiles. Active tab highlighted. Close button per tab (with "save first?" prompt if dirty). Middle-click to close. Drag-to-reorder is deferred (not Phase 5).
  4. StatusBar.svelte: Bottom bar showing: language name, line:column (from CM6 cursor state), encoding (UTF-8), indentation (spaces/tabs). Clickable language name opens a language picker.
  5. CommandPalette.svelte: Ctrl+Shift+P overlay. Fuzzy-filter list of actions (Open File, Save, Change Language, Toggle Word Wrap). This is a stretch goal for Phase 5 — a basic version is fine.
  6. Toast.svelte: Notification component for errors from IPC. Auto-dismiss after 5 seconds. Stackable.
  7. Layout in +page.svelte: CSS Grid layout — grid-template-columns: auto 1fr, grid-template-rows: auto 1fr auto. Title bar spans full width. Sidebar is resizable (CSS resize: horizontal or a drag handle).

  Deliverable: Full visual shell. Open folder, browse files, click to open in tabs, edit, see status bar update.

  ---
  Phase 6: File Operations & Dirty State

  Goal: Save, Save As, Ctrl+N, Ctrl+O, close-with-prompt.

  Steps:
  1. Wire Ctrl+S → fileStore.saveFile(activeFileId) → IPC write_file.
  2. Wire Ctrl+Shift+S → Tauri's save dialog (@tauri-apps/plugin-dialog) → write_file with new path.
  3. Wire Ctrl+O → Tauri open dialog (file filter for common text extensions) → read_file → open in new tab.
  4. Wire Ctrl+N → create untitled buffer in fileStore (no path, no disk write until first save).
  5. Closing a dirty tab shows a confirmation dialog: Save / Don't Save / Cancel.
  6. Window close event (tauri://close-requested) checks all dirty files — prompt to save before quit.
  7. Wire Ctrl+Shift+P to open Command Palette.

  Deliverable: Full file lifecycle. No data loss from accidental closes.

  ---
  Phase 7: Settings, Persistence & Polish

  Goal: User preferences persist across sessions.

  Steps:
  1. Settings file at ~/.saku-kaze/settings.json (Rust creates dir if missing).
  2. Settings: fontSize, fontFamily, wordWrap, tabSize, autoSave (off/onFocusChange/afterDelay), theme (for future use).
  3. Settings UI: either a dedicated settings tab (rendered as a form) or a JSON editor for settings.json opened as a special tab.
  4. Recent files list persisted in settings. Shown on empty state / welcome screen.
  5. Window state persistence: remember last window size/position via tauri-plugin-window-state.
  6. Last open folder restored on app launch.

  Deliverable: The app remembers preferences and last session.

  ---
  Phase 8: Large File Handling & Performance

  Goal: Graceful handling of files from 1 MB to 50 MB.

  Steps:
  1. Rust: detect file size before reading. If > LARGE_FILE_THRESHOLD (5 MB), emit chunked events instead of returning the full string.
  2. Svelte: listen to file-chunk events, assemble in a buffer, then set into CodeMirror in one transaction.
  3. For files > 50 MB: return an error suggesting the user use a dedicated tool. Configurable threshold in settings.
  4. CodeMirror: ensure EditorView is created with reasonable viewport settings (CM6 handles virtualization natively, but test with large files).
  5. Directory tree: lazy-load children on folder expand (don't recurse the entire tree upfront for huge projects).

  Deliverable: Smooth editing of 5–50 MB files. No UI freezes.

  ---
  Phase 9: Packaging & Distribution

  Goal: Produce a standalone .exe installer.

  Steps:
  1. Configure tauri.conf.json for NSIS bundler:
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "windows": {
      "nsis": {
        "installMode": "currentUser",
        "license": "src-tauri/eula/MIT_EULA.txt"
      }
    }
  }
  2. Set app icon (all required sizes in src-tauri/icons/).
  3. Set identifier to com.sakukaze.editor (or similar).
  4. Set version in tauri.conf.json and Cargo.toml.
  5. Build: cargo tauri build — produces NSIS installer in src-tauri/target/release/bundle/nsis/.
  6. Test clean install on a fresh Windows machine (or VM). Verify: installs to %LOCALAPPDATA%, EULA shows, app launches, file associations work if configured.

  Deliverable: Distributable .exe installer with embedded EULA.

  ---
  Phase 10 (Future): Stretch Goals

  Not in initial scope, but the architecture supports these:

  - Multi-tab split view (horizontal/vertical panes)
  - Integrated terminal (via Tauri shell plugin)
  - Extension system (Lua or WASM-based plugins)
  - Git integration (status indicators in sidebar, basic diff view)
  - Find in Files (Rust-powered recursive grep with ripgrep-like performance)
  - Minimap (CM6 extension)
  - Custom themes (user-loadable JSON theme files)

  ---
  The "Sonnet Context Block"

  ▎ Saku Kaze is a Tauri v2 desktop text editor with a Rust backend and Svelte 5 frontend (Runes, no legacy stores). All file I/O is performed exclusively in Rust via #[tauri::command] functions that return Result<T, String> — the frontend never touches the     
  ▎ filesystem directly. The IPC bridge uses @tauri-apps/api/core's invoke(), and every call is async/await. State lives in three Rune-based stores (fileStore, editorStore, workspaceStore) that drive a CodeMirror 6 editor configured with Compartments for dynamic
  ▎  language and theme switching. Files under 5 MB transfer as a single string; larger files use Tauri event-based chunking. The app is 100% offline — fonts are vendored, language grammars are bundled, and there are zero CDN or network dependencies.
  ▎
  ▎ Code rules: Never use unwrap() in Rust command handlers — always propagate errors as String via map_err. Never use Svelte's legacy writable/readable stores — use only $state, $derived, and $effect runes. Never import from a CDN or make network requests.     
  ▎ Every Rust command must be registered in main.rs's invoke_handler. Every frontend IPC call must go through a typed wrapper in lib/ipc/. The CodeMirror instance lives in Editor.svelte and is reconfigured reactively via $effect blocks watching store values.   
  ▎ The UI is dark-mode-first with Tailwind CSS, custom title bar (native decorations disabled), and CSS Grid layout. Distribution targets Windows NSIS with currentUser install mode and an embedded MIT EULA.

  ---
  Now let me save this project context to memory for future conversations.

  Wrote 2 memories (ctrl+o to expand)

● The Master Development Plan is complete. Here's a quick summary of what you have:

  - Phase 0: Environment setup (Rust 1.82+, Node 20, pnpm 9, Tauri CLI v2, VS Build Tools)
  - Phases 1–9: Sequential build from empty scaffold to distributable .exe
  - Architecture: Strict IPC contract — Rust owns disk, Svelte owns UI, all communication via typed invoke() wrappers returning Result<T, String>
  - Sonnet Context Block: Ready to paste as permanent system context for Claude 3.5 Sonnet when it starts writing code module-by-module

  The plan is designed so each phase produces a testable deliverable, and Sonnet can be given one phase at a time with the context block to stay aligned. When you're ready to start Phase 1, just say the word.