/**
 * Typed IPC wrappers for settings persistence commands.
 * Settings are stored at ~/.saku-kaze/settings.json by the Rust backend.
 *
 * Pattern used by stores:
 *   1. On app startup, `+page.svelte` calls `loadSettings()` then `primeCache(s)`.
 *   2. Each store calls `patchAndSave({ fieldName: newValue })` whenever the user
 *      changes a preference. The module-level cache merges the patch before writing
 *      so multiple stores can update independent fields without clobbering each other.
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * User settings — mirrors the Rust `AppSettings` struct.
 * Field names are camelCase because Rust serialises with `rename_all = "camelCase"`.
 */
export interface AppSettings {
  fontSize: number;
  fontFamily: string;
  wordWrap: boolean;
  tabSize: number;
  /** `"off"` | `"onFocusChange"` | `"afterDelay"` */
  autoSave: string;
  /** Theme identifier, e.g. `"sakuDark"`. */
  theme: string;
  /** Absolute paths of recently opened files, most-recent first. */
  recentFiles: string[];
  /** Last opened workspace folder, or `null`. */
  lastWorkspace: string | null;
}

/**
 * Load settings from disk.
 * Returns application defaults if the settings file does not yet exist
 * or is corrupt — the app never hard-errors on missing settings.
 */
export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('load_settings');
}

/** Persist `settings` to disk atomically. */
export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

// ---------------------------------------------------------------------------
// Cache-based patch helper (used by stores for incremental saves)
// ---------------------------------------------------------------------------

/** In-memory mirror of the last-written settings. Seeded by primeCache(). */
let _cache: AppSettings = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  wordWrap: false,
  tabSize: 4,
  autoSave: 'off',
  theme: 'sakuDark',
  recentFiles: [],
  lastWorkspace: null,
};

/**
 * Seed the in-memory cache with the settings loaded from disk.
 * Call once at app startup immediately after `loadSettings()` returns,
 * before any `patchAndSave()` calls are made.
 */
export function primeCache(s: AppSettings): void {
  _cache = { ...s };
}

/**
 * Merge `patch` into the cached settings and atomically persist the result.
 * Each store calls this whenever the user changes a preference.
 */
export async function patchAndSave(patch: Partial<AppSettings>): Promise<void> {
  _cache = { ..._cache, ...patch };
  await saveSettings(_cache);
}
