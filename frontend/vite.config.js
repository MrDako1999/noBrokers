import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// We ship the whole `src/` tree as `.js` (no JSX extension) per the project
// convention from PoultryManager. esbuild needs to be told these `.js`
// files contain JSX so the parser doesn't choke on the `<>` syntax.
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
