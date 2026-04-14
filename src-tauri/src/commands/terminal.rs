use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize, SlavePty};
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Persistent PTY session. Pre-registered with app.manage() in lib.rs so that
/// spawn_pty can be called multiple times without panicking (idempotent).
pub struct PtyState {
    writer:  Mutex<Option<Box<dyn Write    + Send>>>,
    _slave:  Mutex<Option<Box<dyn SlavePty  + Send>>>,
    _master: Mutex<Option<Box<dyn MasterPty + Send>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            writer:  Mutex::new(None),
            _slave:  Mutex::new(None),
            _master: Mutex::new(None),
        }
    }
}

/// Opens a real PTY and spawns PowerShell inside it.
///
/// Idempotent — returns Ok immediately if the PTY is already running.
/// Both the slave and master are stored in PtyState so they are never
/// dropped while the session is alive. On Windows ConPTY, dropping the
/// slave causes the child process to exit immediately (OS error 232).
#[tauri::command]
pub fn spawn_pty(state: State<'_, PtyState>, app: AppHandle) -> Result<(), String> {
    {
        let guard = state.writer.lock().map_err(|e| format!("writer lock: {e}"))?;
        if guard.is_some() {
            return Ok(()); // PTY already running
        }
    }

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.args(["-NoLogo", "-NoProfile"]);

    // spawn_command takes &self so pair.slave remains owned afterwards.
    pair.slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn PowerShell: {e}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    // Store slave + master so they are never dropped (dropping either on
    // Windows closes the underlying conpty handle and kills the child).
    *state._slave.lock().map_err(|e| format!("slave lock: {e}"))?  = Some(pair.slave);
    *state._master.lock().map_err(|e| format!("master lock: {e}"))? = Some(pair.master);
    *state.writer.lock().map_err(|e| format!("writer lock: {e}"))?  = Some(writer);

    // Background thread: stream PTY output to the frontend.
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app.emit("pty-output", text);
                }
            }
        }
    });

    Ok(())
}

/// Forwards raw bytes from xterm.js directly into the PTY master writer.
#[tauri::command]
pub fn write_pty(data: String, state: State<'_, PtyState>) -> Result<(), String> {
    let mut guard = state
        .writer
        .lock()
        .map_err(|e| format!("PTY writer lock poisoned: {e}"))?;

    let writer = guard
        .as_mut()
        .ok_or_else(|| "PTY not initialized — call spawn_pty first".to_string())?;

    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))?;

    writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY writer: {e}"))
}
