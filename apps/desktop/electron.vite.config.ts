import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['sql.js'],
        input: resolve(__dirname, 'src/main/main.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/preload.ts')
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    }
  }
});
