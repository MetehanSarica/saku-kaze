use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize, SlavePty};
use serde::Serialize;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// A live PTY session. Both the slave and master are kept so they are never
/// dropped while the shell runs: on Windows ConPTY, dropping either closes
/// the pseudoconsole and kills the child (OS error 232).
struct PtySession {
    /// Distinguishes sessions so a stale exit-waiter never clears a newer one.
    id:      u64,
    writer:  Box<dyn Write     + Send>,
    master:  Box<dyn MasterPty + Send>,
    _slave:  Box<dyn SlavePty  + Send>,
}

/// Terminal state. Pre-registered with app.manage() in lib.rs.
/// `session` is `None` until spawn_pty runs, and again after the shell exits.
pub struct PtyState {
    session: Mutex<Option<PtySession>>,
    next_id: AtomicU64,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
            next_id: AtomicU64::new(1),
        }
    }
}

/// Payload of the `pty-exit` event, emitted when the shell process ends.
#[derive(Serialize, Clone)]
struct PtyExitPayload {
    /// Exit code, or `None` if it could not be determined.
    code: Option<u32>,
}

// ---------------------------------------------------------------------------
// spawn_pty
// ---------------------------------------------------------------------------

/// Opens a real PTY and spawns PowerShell inside it.
///
/// Idempotent: returns Ok immediately if a shell is already running.
/// `cwd` is the starting directory (falls back to the home directory when
/// missing or invalid); `cols`/`rows` set the initial PTY size.
///
/// Output is streamed as `pty-output` events. When the shell exits the
/// session is cleared and `pty-exit` is emitted, so a later spawn_pty call
/// starts a fresh shell.
#[tauri::command]
pub fn spawn_pty(
    state: State<'_, PtyState>,
    app:   AppHandle,
    cwd:   Option<String>,
    cols:  Option<u16>,
    rows:  Option<u16>,
) -> Result<(), String> {
    // Hold the lock for the whole spawn so concurrent calls can't start two shells.
    let mut guard = state.session.lock().map_err(|e| format!("PTY lock poisoned: {e}"))?;
    if guard.is_some() {
        return Ok(()); // PTY already running
    }

    let pair = native_pty_system()
        .openpty(PtySize {
            rows: rows.unwrap_or(24).max(1),
            cols: cols.unwrap_or(80).max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let cmd_name = "powershell.exe";
    let mut cmd = CommandBuilder::new(cmd_name);
    cmd.args(["-NoLogo", "-NoProfile"]);

    let start_dir = cwd
        .filter(|d| Path::new(d).is_dir())
        .or_else(|| app.path().home_dir().ok().map(|h| h.to_string_lossy().into_owned()));
    if let Some(dir) = start_dir {
        cmd.cwd(dir);
    }

    // spawn_command takes &self so pair.slave remains owned afterwards.
    // Catch NotFound so a missing interpreter shows a clear message in the
    // terminal instead of a silent pipe failure.
    let mut child = match pair.slave.spawn_command(cmd) {
        Ok(child) => child,
        Err(e) => {
            let err_str = e.to_string();
            let is_not_found = err_str.contains("os error 2")
                || err_str.to_lowercase().contains("not found")
                || err_str.to_lowercase().contains("no such file");
            if is_not_found {
                let msg = format!(
                    "\r\n[Saku Kaze Error]: '{cmd_name}' is not recognized. \
                     Ensure it is installed and added to your system PATH.\r\n"
                );
                let _ = app.emit("pty-output", msg);
                return Ok(());
            }
            return Err(format!("Failed to spawn {cmd_name}: {e}"));
        }
    };

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    let id = state.next_id.fetch_add(1, Ordering::Relaxed);
    *guard = Some(PtySession {
        id,
        writer,
        master: pair.master,
        _slave: pair.slave,
    });
    drop(guard);

    // Background thread: stream PTY output to the frontend. Multi-byte UTF-8
    // characters split across reads are carried over to the next read.
    let out_app = app.clone();
    std::thread::spawn(move || {
        let mut buf     = [0u8; 4096];
        let mut pending = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let text = decode_utf8_stream(&mut pending, &buf[..n]);
                    if !text.is_empty() {
                        let _ = out_app.emit("pty-output", text);
                    }
                }
            }
        }
    });

    // Background thread: wait for the shell to exit, then drop the session
    // (which closes the pseudoconsole and ends the reader thread).
    std::thread::spawn(move || {
        let code = child.wait().ok().map(|status| status.exit_code());
        let state = app.state::<PtyState>();
        if let Ok(mut guard) = state.session.lock() {
            if guard.as_ref().map(|s| s.id) == Some(id) {
                *guard = None;
            }
        }
        let _ = app.emit("pty-exit", PtyExitPayload { code });
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// write_pty / resize_pty
// ---------------------------------------------------------------------------

/// Forwards raw bytes from xterm.js directly into the PTY master writer.
#[tauri::command]
pub fn write_pty(data: String, state: State<'_, PtyState>) -> Result<(), String> {
    let mut guard = state
        .session
        .lock()
        .map_err(|e| format!("PTY lock poisoned: {e}"))?;

    let session = guard
        .as_mut()
        .ok_or_else(|| "PTY not running, call spawn_pty first".to_string())?;

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))?;

    session
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY writer: {e}"))
}

/// Resize the PTY to match the xterm.js viewport. No-op if no shell is running.
#[tauri::command]
pub fn resize_pty(cols: u16, rows: u16, state: State<'_, PtyState>) -> Result<(), String> {
    let guard = state
        .session
        .lock()
        .map_err(|e| format!("PTY lock poisoned: {e}"))?;

    match guard.as_ref() {
        Some(session) => session
            .master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {e}")),
        None => Ok(()),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Decode `input` as UTF-8, prefixed by bytes left over from the previous
/// call. An incomplete character at the end is kept in `pending` for the
/// next call; genuinely invalid bytes become U+FFFD.
fn decode_utf8_stream(pending: &mut Vec<u8>, input: &[u8]) -> String {
    pending.extend_from_slice(input);

    let mut out   = String::new();
    let mut start = 0;

    while start < pending.len() {
        match std::str::from_utf8(&pending[start..]) {
            Ok(s) => {
                out.push_str(s);
                start = pending.len();
            }
            Err(e) => {
                let valid = e.valid_up_to();
                out.push_str(&String::from_utf8_lossy(&pending[start..start + valid]));
                start += valid;
                match e.error_len() {
                    Some(len) => {
                        out.push('\u{FFFD}');
                        start += len;
                    }
                    None => break, // incomplete char at the end, wait for more bytes
                }
            }
        }
    }

    pending.drain(..start);
    out
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::decode_utf8_stream;

    #[test]
    fn joins_a_character_split_across_reads() {
        let bytes = "çağ".as_bytes(); // ç = 2 bytes, ğ = 2 bytes
        let mut pending = Vec::new();
        let first  = decode_utf8_stream(&mut pending, &bytes[..1]);
        let second = decode_utf8_stream(&mut pending, &bytes[1..4]);
        let third  = decode_utf8_stream(&mut pending, &bytes[4..]);
        assert_eq!(first, "");
        assert_eq!(second, "ça");
        assert_eq!(third, "ğ");
        assert!(pending.is_empty());
    }

    #[test]
    fn replaces_invalid_bytes_and_keeps_going() {
        let mut pending = Vec::new();
        assert_eq!(decode_utf8_stream(&mut pending, b"a\xFFb"), "a\u{FFFD}b");
        assert!(pending.is_empty());
    }

    #[test]
    fn passes_ascii_through() {
        let mut pending = Vec::new();
        assert_eq!(decode_utf8_stream(&mut pending, b"PS C:\\> "), "PS C:\\> ");
    }
}
