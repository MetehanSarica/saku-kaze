import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

// Unit tests run in jsdom with Svelte's browser build so runes and
// components behave as they do in the app. Tauri IPC is mocked per test.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
