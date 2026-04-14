use serde::{Deserialize, Serialize};

/// User-configurable settings persisted to `~/.saku-kaze/settings.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Editor font size in pixels (default 14).
    pub font_size: u32,
    /// Editor font family name (default "JetBrains Mono").
    pub font_family: String,
    /// Whether the editor wraps long lines (default false).
    pub word_wrap: bool,
    /// Number of spaces per indentation level (default 4).
    pub tab_size: u32,
    /// Auto-save mode: "off" | "onFocusChange" | "afterDelay" (default "off").
    pub auto_save: String,
    /// Active theme identifier, for future use (default "sakuDark").
    pub theme: String,
    /// Absolute paths of recently opened files (most-recent first).
    pub recent_files: Vec<String>,
    /// Absolute path of the last opened workspace folder, if any.
    pub last_workspace: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            font_size: 14,
            font_family: "JetBrains Mono".to_string(),
            word_wrap: false,
            tab_size: 4,
            auto_save: "off".to_string(),
            theme: "sakuDark".to_string(),
            recent_files: Vec::new(),
            last_workspace: None,
        }
    }
}
