use serde::{Deserialize, Serialize};

/// A node in the directory tree sent over IPC to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    /// The bare file/directory name (e.g. "main.rs").
    pub name: String,
    /// The absolute path (e.g. "C:/Users/…/main.rs").
    pub path: String,
    /// `true` if this node is a directory.
    pub is_dir: bool,
    /// Child nodes for directories; `None` for files.
    pub children: Option<Vec<FileNode>>,
}
