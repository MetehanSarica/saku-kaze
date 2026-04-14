mod commands;
mod models;
mod utils;

use commands::{fs_ops, settings, terminal, workspace};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(terminal::PtyState::new())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // File I/O
            fs_ops::read_file,
            fs_ops::write_file,
            fs_ops::delete_file,
            fs_ops::rename_file,
            // Workspace / directory tree
            workspace::read_directory,
            workspace::read_directory_shallow,
            // Settings persistence
            settings::load_settings,
            settings::save_settings,
            // PTY terminal
            terminal::spawn_pty,
            terminal::write_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
