# 🍃 Saku Kaze

**A high-performance, offline-first text editor built with Tauri v2, Rust, and Svelte 5.**

Saku Kaze is a lightweight yet powerful code editor engineered for speed, reliability, and a deeply integrated developer experience. No network telemetry, no background AI overhead — just a pure, optimized tool designed to keep you in the flow state.

> *"Saku Kaze" (咲く風) — the blooming wind.*

---

## ✨ Features

- **True PTY Terminal** — A fully integrated terminal powered by a custom Rust backend and `portable-pty`. Handles complex background processes, pipe disconnects, and standard I/O without crashing.
- **Optimized Editor Engine** — Powered by CodeMirror 6 with Svelte 5 Runes-based state management. Completely race-condition-free — keystrokes and file syncs stay perfectly aligned.
- **Chunked File Streaming** — Safely reads and streams large files (up to 50 MiB) using chunked Rust payloads, preventing UI freezes or main-thread blocking.
- **Smart Auto-Save** — Intelligent "Auto-Save on Run" ensures your code is always written to disk before execution.
- **Saku Dark Theme** — A bespoke dark aesthetic crafted for long coding sessions to minimize eye strain.
- **Native OS Integration** — Custom context menus and deeply integrated window management.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Svelte 5 (Runes), CodeMirror 6, Vite |
| Backend | Rust, Tauri v2 |
| Terminal | portable-pty |
| Styling | Tailwind CSS, PostCSS |
| Distribution | NSIS Installer (Windows) |

---

## 📦 Installation

1. Go to the [Releases](https://github.com/MetehanSarica/saku-kaze/releases) page.
2. Download the latest `Saku Kaze_x.x.x_x64-setup.exe` file.
3. Run the installer — it installs locally to the current user and requires **no administrator privileges**.
4. Launch Saku Kaze.

---

## 🧑‍💻 Development Setup

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (with `pnpm`)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Clone & Install

```bash
git clone https://github.com/MetehanSarica/saku-kaze.git
cd saku-kaze
pnpm install
```

### Run in Development Mode

Starts the Vite dev server and opens the Tauri application window.

```bash
pnpm run tauri dev
```

### Build for Production

Compiles the optimized Rust backend, bundles the frontend, and extracts the final `.exe` installer into a `releases/` folder at the project root.

```bash
pnpm run build:release
```

---

## 📁 Project Structure

```
saku-kaze/
├── src/              # Svelte frontend source
├── src-tauri/        # Rust/Tauri backend source
├── scripts/          # Build & post-build scripts
├── static/           # Static assets
├── .vscode/          # VS Code workspace settings
├── package.json
├── svelte.config.js
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## 🎨 Languages

![Svelte](https://img.shields.io/badge/Svelte-59.1%25-FF3E00?style=flat-square&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-26.4%25-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-13.0%25-DEA584?style=flat-square&logo=rust&logoColor=black)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

Built with [Tauri](https://tauri.app/), [Svelte](https://svelte.dev/), [CodeMirror](https://codemirror.net/), and [portable-pty](https://crates.io/crates/portable-pty).
