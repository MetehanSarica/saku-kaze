use crate::models::file_node::FileNode;
use std::path::Path;

/// Maximum recursion depth for directory traversal.
/// Prevents stack overflows on pathological directory trees.
const MAX_DEPTH: usize = 32;

// ---------------------------------------------------------------------------
// read_directory
// ---------------------------------------------------------------------------

/// Recursively read a directory tree rooted at `path`.
///
/// Returns a `Vec<FileNode>` representing the sorted contents:
/// directories are listed before files, and within each group entries are
/// sorted case-insensitively by name.
///
/// Symlinks are followed. Entries that cannot be read (e.g. permission errors)
/// are silently skipped — the caller will see a partial tree rather than an
/// outright error, which is friendlier for system directories.
#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&path);

    if !root.exists() {
        return Err(format!("Directory '{}' does not exist", path));
    }
    if !root.is_dir() {
        return Err(format!("'{}' is not a directory", path));
    }

    read_dir_recursive(root, 0)
}

// ---------------------------------------------------------------------------
// read_directory_shallow
// ---------------------------------------------------------------------------

/// Read only the immediate children of `path` (no recursion).
///
/// Directory children are returned with `children: null` (Rust `None`),
/// signalling to the frontend that the subtree has not yet been loaded.
/// The frontend calls this command again when the user expands a directory
/// (lazy / on-demand loading).
#[tauri::command]
pub async fn read_directory_shallow(path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&path);

    if !root.exists() {
        return Err(format!("Directory '{}' does not exist", path));
    }
    if !root.is_dir() {
        return Err(format!("'{}' is not a directory", path));
    }

    read_dir_one_level(root)
}

/// Read exactly one level of a directory.
/// Directories get `children: None` (not yet loaded); files get `children: None` too.
fn read_dir_one_level(dir: &Path) -> Result<Vec<FileNode>, String> {
    let read_dir = std::fs::read_dir(dir)
        .map_err(|e| format!("Cannot read directory '{}': {}", dir.display(), e))?;

    let mut nodes: Vec<FileNode> = read_dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let entry_path = entry.path();
            let name = entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())?;
            let path_str = entry_path
                .to_str()
                .map(|s| s.replace('\\', "/"))?;
            let is_dir = entry_path.is_dir();
            // children: None means "not yet loaded" for dirs, and "no children" for files.
            Some(FileNode { name, path: path_str, is_dir, children: None })
        })
        .collect();

    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(nodes)
}

/// Internal recursive helper — separated so we can track depth without
/// exposing the depth parameter over IPC.
fn read_dir_recursive(dir: &Path, depth: usize) -> Result<Vec<FileNode>, String> {
    if depth > MAX_DEPTH {
        return Ok(Vec::new());
    }

    let read_dir = std::fs::read_dir(dir)
        .map_err(|e| format!("Cannot read directory '{}': {}", dir.display(), e))?;

    let mut nodes: Vec<FileNode> = read_dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let entry_path = entry.path();

            let name = entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())?;

            // Normalise to forward slashes for cross-platform consistency on
            // the JS side (Windows paths use backslashes natively).
            let path_str = entry_path
                .to_str()
                .map(|s| s.replace('\\', "/"))?;

            let is_dir = entry_path.is_dir();

            let children = if is_dir {
                // Recurse; on error (e.g. access denied) yield an empty list
                // so the node still appears in the tree.
                Some(read_dir_recursive(&entry_path, depth + 1).unwrap_or_default())
            } else {
                None
            };

            Some(FileNode {
                name,
                path: path_str,
                is_dir,
                children,
            })
        })
        .collect();

    // Dirs before files, then alphabetical within each group (case-insensitive).
    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}
