/**
 * uiStore — cross-component UI state.
 *
 * Phase 7+: activity bar tab, sidebar visibility, bottom panel state.
 * Phase 8+: zen mode, output log.
 */
import type { AppSettings } from '$lib/ipc/settings';

export type SideBarTab = 'explorer' | 'search' | 'source-control' | 'extensions';
export type BottomTab  = 'problems' | 'output' | 'debug' | 'terminal' | 'ports';

class UiStore {
  // ── Command palette ───────────────────────────────────────────────────
  paletteOpen = $state(false);

  openPalette()   { this.paletteOpen = true;  }
  closePalette()  { this.paletteOpen = false; }
  togglePalette() { this.paletteOpen = !this.paletteOpen; }

  // ── Activity bar / sidebar ────────────────────────────────────────────
  activeSideBarTab = $state<SideBarTab>('explorer');
  sidebarOpen      = $state(true);

  /**
   * Click the same icon → toggle sidebar. Click a different icon → switch tab
   * and ensure sidebar is open.
   */
  setActiveSideBarTab(tab: SideBarTab): void {
    if (this.activeSideBarTab === tab) {
      this.sidebarOpen = !this.sidebarOpen;
    } else {
      this.activeSideBarTab = tab;
      this.sidebarOpen = true;
    }
  }

  // ── Bottom panel ──────────────────────────────────────────────────────
  bottomPanelOpen   = $state(true);
  activeBottomTab   = $state<BottomTab>('terminal');
  bottomPanelHeight = $state(220);

  toggleBottomPanel():              void { this.bottomPanelOpen = !this.bottomPanelOpen; }
  setActiveBottomTab(t: BottomTab): void { this.activeBottomTab = t; }

  // ── Zen mode ──────────────────────────────────────────────────────────
  /** When true, hides the Activity Bar, Sidebar, Bottom Panel, and Status Bar. */
  zenMode = $state(false);

  toggleZenMode(): void { this.zenMode = !this.zenMode; }

  // ── Output log (for the OUTPUT panel tab) ────────────────────────────
  outputLines = $state<string[]>([]);

  appendOutput(line: string): void {
    // Strip trailing CRLF, split on newlines so each logical line is an entry.
    const parts = line.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (const p of parts) {
      if (p.length > 0) this.outputLines = [...this.outputLines, p];
    }
  }

  clearOutput(): void { this.outputLines = []; }

  // ── Context menu ─────────────────────────────────────────────────────
  contextMenuOpen = $state(false);
  contextMenuX    = $state(0);
  contextMenuY    = $state(0);

  openContextMenu(x: number, y: number): void {
    this.contextMenuX    = x;
    this.contextMenuY    = y;
    this.contextMenuOpen = true;
  }

  closeContextMenu(): void { this.contextMenuOpen = false; }

  // ── Hydration ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hydrate(_s: AppSettings): void {
    // Nothing to restore yet — extend when panel heights land in AppSettings.
  }
}

export const uiStore = new UiStore();
