import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    // three.js and the post-processing stack are large; this is a local presentation, not a web app.
    chunkSizeWarningLimit: 2000,
    // `npm run build:offline`: every asset (fonts, images) goes inline, so tools/inline.mjs can fold
    // the whole talk into one index.html that opens from disk with a double click.
    ...(mode === 'offline' && {
      outDir: 'dist-offline',
      chunkSizeWarningLimit: 8000,
      assetsInlineLimit: () => true,
      cssCodeSplit: false,
      modulePreload: false,
    }),
  },
  base: mode === 'offline' ? './' : '/',
  server: { port: 5173 },
}));
