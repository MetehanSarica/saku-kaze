use serde::Serialize;
use std::path::Path;
use tauri::Emitter;

/// Files under this threshold are returned as a single IPC string.
const LARGE_FILE_THRESHOLD: usize = 5 * 1024 * 1024;   // 5 MiB

/// Files above this limit are rejected outright.
const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;          // 50 MiB

/// IPC chunk size for 5–50 MiB files streamed via Tauri events.
const CHUNK_SIZE: usize = 1024 * 1024;                  // 1 MiB per chunk

// ---------------------------------------------------------------------------
// Event payload for chunked file transfer
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
pub struct FileChunkPayload {
    /// Absolute path — lets the frontend demux events for concurrent opens.
    pub path: String,
    /// UTF-8 data for this chunk (may be empty on the terminal chunk).
    pub data: String,
    /// `true` on the last chunk; the frontend resolves its stream promise here.
    pub done: bool,
}

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------

/// Read a UTF-8 text file and return its contents.
///
/// Size tiers:
///   < 5 MiB   → returned inline as a `String`.
///   5–50 MiB  → returns `"STREAMING"` and emits `file-chunk` events (1 MiB
///               each). The frontend's `readFile()` wrapper reassembles them.
///   > 50 MiB  → returns `Err("File exceeds 50MB limit")`.
#[tauri::command]
pub async fn read_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Cannot access '{}': {}", path, e))?;

    if !metadata.is_file() {
        return Err(format!("'{}' is not a regular file", path));
    }

    let size = metadata.len() as usize;

    if size > MAX_FILE_SIZE {
        return Err(format!(
            "File exceeds 50MB limit: '{}' is {:.1} MB — use a dedicated tool for files this large.",
            path,
            size as f64 / (1024.0 * 1024.0)
        ));
    }

    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read '{}': {}", path, e))?;

    if size > LARGE_FILE_THRESHOLD {
        // ── Streaming mode ────────────────────────────────────────────────
        // Read entire file into memory then stream over IPC in 1 MiB chunks.
        // The frontend sets up its listener before calling invoke(), so no
        // chunks are lost.
        let chunks: Vec<&[u8]> = bytes.chunks(CHUNK_SIZE).collect();
        let total = chunks.len();

        for (i, chunk) in chunks.iter().enumerate() {
            let data = String::from_utf8(chunk.to_vec()).map_err(|_| {
                format!("'{}' is not valid UTF-8 — binary files are not supported.", path)
            })?;

            app.emit(
                "file-chunk",
                FileChunkPayload {
                    path: path.clone(),
                    data,
                    done: i == total - 1,
                },
            )
            .map_err(|e| format!("Failed to emit file-chunk event: {}", e))?;
        }

        // Signal the frontend that streaming has started.
        return Ok("STREAMING".to_string());
    }

    // ── Small file ────────────────────────────────────────────────────────
    String::from_utf8(bytes).map_err(|_| {
        format!(
            "'{}' does not appear to be valid UTF-8. Binary file support is not implemented.",
            path
        )
    })
}

// ---------------------------------------------------------------------------
// write_file  (atomic)
// ---------------------------------------------------------------------------

/// Atomically write `content` to `path` (write to `.sktmp` then rename).
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let target = Path::new(&path);

    let parent = target.parent().ok_or_else(|| {
        format!("'{}' has no parent directory — cannot write file", path)
    })?;

    let file_name = target
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("'{}' has an invalid file name", path))?;

    let tmp_path = parent.join(format!(".{}.sktmp", file_name));

    std::fs::write(&tmp_path, content.as_bytes()).map_err(|e| {
        format!("Failed to write temp file '{}': {}", tmp_path.display(), e)
    })?;

    std::fs::rename(&tmp_path, target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        format!("Failed to finalise write to '{}': {}", path, e)
    })?;

    Ok(())
}

// ---------------------------------------------------------------------------
// delete_file
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let meta = std::fs::metadata(&path)
        .map_err(|e| format!("Cannot access '{}': {}", path, e))?;

    if meta.is_dir() {
        std::fs::remove_dir(&path)
            .map_err(|e| format!("Failed to delete directory '{}': {}", path, e))
    } else {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete '{}': {}", path, e))
    }
}

// ---------------------------------------------------------------------------
// rename_file
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| {
        format!("Failed to rename '{}' → '{}': {}", old_path, new_path, e)
    })
}
