use crate::models::app_settings::AppSettings;
use std::path::PathBuf;
use tauri::Manager;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve the path to `~/.saku-kaze/settings.json`, creating the directory
/// if it does not already exist.
fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("Failed to resolve home directory: {}", e))?;

    let config_dir = home.join(".saku-kaze");

    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir).map_err(|e| {
            format!(
                "Failed to create settings directory '{}': {}",
                config_dir.display(),
                e
            )
        })?;
    }

    Ok(config_dir.join("settings.json"))
}

// ---------------------------------------------------------------------------
// load_settings
// ---------------------------------------------------------------------------

/// Load user settings from `~/.saku-kaze/settings.json`.
///
/// If the file does not exist, or if it is corrupted / partially migrated,
/// returns [`AppSettings::default()`] so the app always has a valid
/// configuration to work with.
#[tauri::command]
pub async fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings file '{}': {}", path.display(), e))?;

    // On parse failure, log the error but return defaults so the app isn't
    // permanently broken by a corrupt settings file.
    match serde_json::from_str::<AppSettings>(&content) {
        Ok(settings) => Ok(settings),
        Err(e) => {
            eprintln!(
                "[saku-kaze] settings.json parse error (returning defaults): {}",
                e
            );
            Ok(AppSettings::default())
        }
    }
}

// ---------------------------------------------------------------------------
// save_settings
// ---------------------------------------------------------------------------

/// Persist `settings` to `~/.saku-kaze/settings.json`.
///
/// The write is atomic: the JSON is first written to a sibling `.tmp` file,
/// then renamed over the target so that a crash during the write cannot
/// corrupt the existing settings.
#[tauri::command]
pub async fn save_settings(
    app: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    let path = settings_path(&app)?;

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialise settings: {}", e))?;

    let tmp_path = path.with_extension("json.sktmp");

    std::fs::write(&tmp_path, json.as_bytes()).map_err(|e| {
        format!(
            "Failed to write temp settings file '{}': {}",
            tmp_path.display(),
            e
        )
    })?;

    std::fs::rename(&tmp_path, &path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        format!(
            "Failed to finalise settings write to '{}': {}",
            path.display(),
            e
        )
    })?;

    Ok(())
}
