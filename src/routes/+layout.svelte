<script lang="ts">
  // Vendored fonts — bundled by Vite, no CDN
  import '@fontsource-variable/inter';
  import '@fontsource-variable/jetbrains-mono';
  import '../app.css';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

{@render children()}
