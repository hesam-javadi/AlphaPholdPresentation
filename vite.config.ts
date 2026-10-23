import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js and the post-processing stack are large; this is a local presentation, not a web app.
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173 },
});
