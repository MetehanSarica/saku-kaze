Saku Kaze
Saku Kaze is a high-performance, offline-first text editor engineered for speed, reliability, and a deeply integrated developer experience. Built on a modern stack utilizing Tauri v2, Rust, and Svelte 5, it provides a lightweight but powerful environment for writing and executing code.

Core Philosophy
Saku Kaze is built with a strict focus on local performance and offline capability. There is no network telemetry and no background AI processing overhead. It is a pure, highly optimized tool designed to keep you in the flow state, utilizing native system resources efficiently.

Features
True PTY Terminal: A fully integrated, functional terminal powered by a custom Rust backend and portable-pty. It behaves exactly like a standard IDE terminal, safely handling complex background processes, pipe disconnects, and standard input/output without crashing.

Optimized Editor Engine: Powered by CodeMirror 6 and managed by Svelte 5 Runes. State management is completely race-condition-free, ensuring keystrokes and file syncs are perfectly aligned.

Chunked File Streaming: Capable of safely reading and streaming large files (up to 50 MiB) using chunked Rust payloads, preventing UI freezes or main-thread blocking.

Smart Auto-Save: Intelligent "Auto-Save on Run" functionality ensures your code is always safely written to the local disk before execution.

Saku Dark Theme: A bespoke dark aesthetic crafted specifically for long coding sessions to minimize eye strain.

Native OS Integration: Features custom context menus and deeply integrated window management capabilities.

Tech Stack
Frontend: Svelte 5 (Runes architecture), CodeMirror 6, Vite

Backend: Rust, Tauri v2

Terminal Backend: portable-pty

Distribution: NSIS Installer (Windows)

Installation
Navigate to the Releases page of this repository.

Download the latest Saku Kaze_x.x.x_x64-setup.exe file.

Run the installer. It installs locally to the current user and requires no administrator privileges.

Launch Saku Kaze.

Development Setup
If you want to clone the repository and build Saku Kaze from source, ensure you have Node.js (with pnpm), Rust, and the Tauri prerequisites installed on your system.

1. Clone the repository
Bash
git clone https://github.com/MetehanSarica/saku-kaze.git
cd saku-kaze
2. Install dependencies
Bash
pnpm install
3. Run in Development Mode
This will start the Vite dev server and open the Tauri application window.

Bash
pnpm run tauri dev
4. Build for Production
Saku Kaze uses a custom post-build extraction script to make retrieving the final installer easier. Running the command below will compile the optimized Rust backend, bundle the frontend, and automatically extract the .exe into a highly visible releases/ folder at the root of the project.

Bash
pnpm run build:release
License
This project is licensed under the MIT License.
