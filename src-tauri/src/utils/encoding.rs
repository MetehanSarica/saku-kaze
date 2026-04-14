// Encoding detection stub — Phase 8 will implement UTF-8 / UTF-16 detection.
// Currently unused; suppressing dead_code warnings.
#![allow(dead_code)]

/// Returns `true` if the byte slice appears to be valid UTF-8.
pub fn is_utf8(bytes: &[u8]) -> bool {
    std::str::from_utf8(bytes).is_ok()
}
